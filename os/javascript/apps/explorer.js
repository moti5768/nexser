// Explorer.js
import { launch } from "../kernel.js";
import { showModalWindow, alertWindow, bringToFront, progressWindow } from "../window.js";
import { resolveFS, validateName, importFileSmart, getUniqueName } from "../fs-utils.js";
import { FS, initFS, forceSave, markDefaultDeleted } from "../fs.js";
import { attachContextMenu } from "../context-menu.js";
import { resolveAppByPath, getIcon } from "../file-associations.js";
import { addRecent } from "../recent.js";
import { setupRibbon } from "../ribbon.js";
import { saveSetting, loadSetting } from "./settings.js";

// 複数選択・範囲選択に対応
let globalSelected = { items: new Set(), window: null, lastSelected: null };
// プロパティウィンドウの重複チェック用
const propertyWindows = {};
const sharedTextEncoder = new TextEncoder();
const IGNORED_METADATA_KEYS = new Set(["type", "name", "size", "content", "entry", "singleton", "target"]);

export function hasExtension(name) {
    return /\.[a-z0-9]+$/i.test(name);
}

// ------------------------
// 共通関数
// ------------------------
function deleteFSItem(parentPath, itemName, rerender) {
    const parentNode = resolveFS(parentPath);
    if (!parentNode || !parentNode[itemName]) return;

    // --- ゴミ箱内からの完全消去の場合 ---
    if (isTrashPath(parentPath)) {
        const msg = `
            <div style="padding:10px; font-size:13px;">
                「${itemName}」を完全に消去しますか？<br>
                <small style="color:#ff4444;">※この操作は取り消せません。</small>
            </div>`;

        const win = showModalWindow("完全削除の確認", msg, {
            width: 320,
            height: 175,
            taskbar: false,
            overlay: true,
            buttons: [
                {
                    label: "削除",
                    action: async () => {
                        const targetNode = resolveFS(parentPath);
                        if (targetNode && targetNode[itemName]) {
                            const item = targetNode[itemName];
                            // ゴミ箱内のアイテムが持つ originalPath から元のフルパスを復元
                            const originalPath = item.originalPath ? `${item.originalPath}/${itemName}` : itemName;

                            delete targetNode[itemName];

                            // ★ 削除されたデフォルト項目として記録
                            await markDefaultDeleted(originalPath);
                        }

                        await forceSave();

                        // 2. ウィンドウを先に閉じる（イベント発火時の干渉を防ぐ）
                        if (win._modalOverlay) win._modalOverlay.remove();
                        win.remove();

                        // 3. システム全体に通知し、描画を更新
                        window.dispatchEvent(new Event("fs-updated"));
                        if (typeof rerender === 'function') rerender();
                    }
                },
                {
                    label: "キャンセル",
                    action: () => {
                        if (win._modalOverlay) win._modalOverlay.remove();
                        win.remove();
                    }
                }
            ]
        });
        return;
    }

    try {
        const targetItemData = JSON.parse(JSON.stringify(parentNode[itemName]));
        targetItemData.originalPath = parentPath;

        const trashNode = resolveFS("Trash");
        if (!trashNode) return;

        delete parentNode[itemName];

        let targetName = itemName;

        if (trashNode[itemName]) {
            let counter = 1;
            // Date.now() が同一ミリ秒で衝突する可能性を考慮し、whileで確実に回避
            let baseName = `${Date.now()}_${itemName}`;
            targetName = baseName;
            while (trashNode[targetName]) {
                targetName = `${baseName}_${counter++}`;
            }
        }

        trashNode[targetName] = targetItemData;

        window.dispatchEvent(new Event("fs-updated"));
        rerender?.();
    } catch (e) {
        alertWindow(`「${itemName}」は保護されているため削除できません。`);
    }
}

/**
 * ゴミ箱から元に戻す機能
 */
export function restoreFSItem(itemName, rerender) {
    const trash = resolveFS("Trash");
    const item = trash[itemName];
    if (!item) return;

    // 1. 復元先のノードを取得。見つからなければ Desktop を代替にする
    let destPath = item.originalPath || "Desktop";
    let destNode = resolveFS(destPath);

    if (!destNode) {
        destPath = "Desktop";
        destNode = resolveFS(destPath);
    }

    if (destNode) {
        const data = JSON.parse(JSON.stringify(item));
        delete data.originalPath;

        // 2. 復元先での名前重複を回避するロジックを追加
        // ゴミ箱用につけた「Date.now()_」プレフィックスがあれば除去して綺麗にする（任意）
        let cleanName = itemName.replace(/^\d+_/, "");

        // 既存のヘルパー関数を使用して重複を回避
        let finalName = getUniqueName(destNode, cleanName);

        // 3. データの移動を実行
        destNode[finalName] = data;
        delete trash[itemName];

        rerender?.();
        window.dispatchEvent(new Event("fs-updated"));
    }
}

/**
 * ゴミ箱を空にする機能
 */
export function emptyTrash(rerender) {
    const trash = resolveFS("Trash");
    if (!trash) return;

    const keys = Object.keys(trash).filter(key => !isSystemMetaKey(key));

    if (keys.length === 0) {
        return alertWindow("ゴミ箱は空です。");
    }

    const msg = `
        <div style="padding:10px; font-size:13px;">
            ゴミ箱にある ${keys.length} 個のアイテムをすべて完全に削除しますか？
        </div>`;

    const win = showModalWindow("ゴミ箱を空にする", msg, {
        width: 320,
        height: 175,
        overlay: true,
        buttons: [
            {
                label: "すべて削除",
                action: async () => {
                    const latestTrash = resolveFS("Trash");
                    for (const key of keys) {
                        const item = latestTrash[key];
                        if (item) {
                            const originalPath = item.originalPath ? `${item.originalPath}/${key}` : key;
                            delete latestTrash[key];

                            // ★ 個別にデフォルト削除として記録
                            await markDefaultDeleted(originalPath);
                        }
                    }

                    await forceSave();

                    if (win._modalOverlay) win._modalOverlay.remove();
                    win.remove();

                    window.dispatchEvent(new Event("fs-updated"));
                    rerender?.();
                }
            },
            {
                label: "キャンセル",
                action: () => {
                    if (win._modalOverlay) win._modalOverlay.remove();
                    win.remove();
                }
            }
        ]
    });
}

function createNewItem(currentPath, listContainer, renderCallback, type = "folder") {
    const folderNode = resolveFS(currentPath);
    if (!folderNode || !listContainer) return;

    if (listContainer.querySelector("input") || createNewItem.isCreating) return;
    createNewItem.isCreating = true;

    // 初期名の設定
    let baseName = type === "folder" ? "新しいフォルダ" : "新しいテキスト.txt";
    let itemName = getUniqueName(folderNode, baseName);

    const itemDiv = document.createElement("div");
    itemDiv.className = "explorer-item";

    const input = document.createElement("input");
    input.type = "text";
    input.value = itemName;
    input.style.cssText = "font-size:13px; text-align:left; width:auto; min-width:100px;";
    itemDiv.appendChild(input);

    const adjustWidth = () => {
        input.style.width = `${Math.max(input.value.length * 8, 100)}px`;
    };
    adjustWidth();
    input.addEventListener("input", adjustWidth);
    listContainer.appendChild(itemDiv);

    input.focus();

    // ファイルの場合は拡張子の手前までを選択、フォルダは全選択
    const dotIndex = itemName.lastIndexOf(".");
    if (type === "file" && dotIndex > 0) {
        input.setSelectionRange(0, dotIndex);
    } else {
        input.select();
    }

    let isShowingError = false;
    let isCommitting = false;

    input.addEventListener("blur", () => {
        if (isShowingError || isCommitting) return;
        // 入力途中でフォーカスが外れた場合は、削除せずに入力を確定(保存)させる
        finishEditing();
    });

    const finishEditing = () => {
        if (isShowingError || isCommitting) return;
        isCommitting = true;

        let newName = input.value.trim() || itemName;
        const error = validateName(newName);

        if (error) {
            isCommitting = false;
            isShowingError = true;
            alertWindow(error, { width: 360, height: 160, taskbar: false });
            setTimeout(() => {
                isShowingError = false;
                input.focus();
            }, 0);
            return;
        }

        itemDiv.remove();
        createNewItem.isCreating = false;

        let finalName = getUniqueName(folderNode, newName);

        // 指定されたタイプで作成
        const now = Date.now();
        if (type === "folder") {
            folderNode[finalName] = { type: "folder", lastModified: now };
        } else {
            folderNode[finalName] = { type: "file", content: "", lastModified: now };
        }

        renderCallback?.();
        window.dispatchEvent(new Event("fs-updated"));
    };

    input.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            e.preventDefault();
            finishEditing();
        }
        if (e.key === "Escape") {
            itemDiv.remove();
            createNewItem.isCreating = false;
        }
    });
}

// ----------------------------------------------------------------
// 共通ヘルパー関数（重複防止用）
// ----------------------------------------------------------------
function isTrashPath(path) {
    return path === "Trash" || path.startsWith("Trash/");
}

function isSystemMetaKey(key) {
    return key === "type" || key === "system" || key === "originalPath" || key === "lastModified";
}

function updateStatusBarSummary(statusBar, folderNode) {
    if (!statusBar || !folderNode) return;
    const counts = {};

    for (const key in folderNode) {
        if (isSystemMetaKey(key)) continue;
        const type = folderNode[key].type;
        if (type) counts[type] = (counts[type] || 0) + 1;
    }

    const parts = Object.entries(counts).map(
        ([type, count]) => `${count} ${type}${count > 1 ? "s" : ""}`
    );

    statusBar.textContent = parts.length ? parts.join(", ") : "(empty)";
}

// ------------------------
// Explorer 本体
// ------------------------
export default async function Explorer(root, options = {}) {
    const win = root.closest(".window");
    const titleEl = win?.querySelector(".title-text");
    const taskBtn = win?._taskbarBtn;

    await initFS();
    let currentPath = options.path || "Desktop";
    let historyStack = [];
    let forwardStack = [];
    let viewMode = await loadSetting("explorerViewMode") || "list";
    const rawHidden = await loadSetting("explorerShowHidden");
    let showHidden = rawHidden === true || rawHidden === "true";

    // ★追加: 自動整列（ソート）用の状態管理
    let sortKey = await loadSetting("explorerSortKey") || "name"; // 'name', 'type', 'size', 'date'
    let sortOrder = await loadSetting("explorerSortOrder") || "asc"; // 'asc', 'desc'

    // 固定参照保持
    let listContainer, pathLabel, treeContainer;

    let isSelecting = false;
    let selectionBox = null;
    let startX, startY;
    let wasDragging = false;

    const navigateTo = (path, saveHistory = true) => {
        // console.log("移動先:", path, "現在の場所:", currentPath);
        // 通常の移動時のみ、同じ場所への移動を無視する
        // 履歴移動(saveHistory=false)の時は、強制的に再描画(render)させる
        if (saveHistory && path === currentPath) return;
        if (saveHistory) {
            historyStack.push(currentPath);
            forwardStack = [];
        }
        currentPath = path;
        render(currentPath); // これで確実に画面が更新される
    };

    // ------------------------
    // ダブルクリック・アドレスバー共通ロジック
    // ------------------------
    function openFSItem(name, node, parentPath) {
        let targetPath = parentPath ? `${parentPath}/${name}` : name;
        let targetNode = node;

        if (node.type === "link") {
            targetPath = node.target;
            targetNode = resolveFS(targetPath);
            if (!targetNode) {
                alertWindow(`リンク先「${targetPath}」が存在しません`, {
                    width: 360,
                    height: 160,
                    taskbar: false
                });
                return;
            }
        }

        let effectiveType = targetNode.type;

        switch (effectiveType) {
            case "folder":
                navigateTo(targetPath);
                break;
            case "app":
                if (targetNode.shell) return;
                launch(targetPath, { path: targetPath, uniqueKey: targetPath });
                break;
            case "file": {
                const appPath = resolveAppByPath(targetPath);
                if (appPath) {
                    // 既に関連付けられているアプリがある場合
                    launch(appPath, { path: targetPath, node: targetNode, uniqueKey: targetPath });
                } else {
                    if (targetNode.type === "file") {
                        openWithDialog(targetPath, targetNode);
                    }
                }
                break;
            }
        }
        addRecent({ type: effectiveType, path: targetPath });
    }

    // ------------------------
    // 折りたたみ式アドレスバー作成
    // ------------------------
    function createTreeDropdown(container, currentPath) {
        while (container.firstChild) container.removeChild(container.firstChild);
        container.classList.add("tree-container");

        const label = document.createElement("span");
        label.className = "tree-label";
        label.textContent = currentPath.split("/").pop();
        container.appendChild(label);

        let treePanel = win._treePanel;
        if (!treePanel) {
            treePanel = document.createElement("div");
            treePanel.className = "tree-panel";
            treePanel.style.display = "none";
            const winEl = root.closest(".window");
            winEl.appendChild(treePanel);
            treePanel.style.position = "fixed";
            win._treePanel = treePanel;
        }
        treePanel.innerHTML = "";

        function positionTreePanel() {
            const rect = label.getBoundingClientRect();
            treePanel.style.left = rect.left + "px";
            treePanel.style.top = rect.bottom + "px";
        }

        const arrowBtn = document.createElement("button");
        arrowBtn.className = "tree-label-arrow";
        arrowBtn.textContent = "▼";
        arrowBtn.style.position = "absolute";
        arrowBtn.style.marginRight = "0px";
        arrowBtn.style.right = "0px";
        label.appendChild(arrowBtn);

        arrowBtn.addEventListener("mousedown", e => {
            e.stopPropagation();
            positionTreePanel();
            const isOpen = treePanel.style.display === "block";
            treePanel.style.display = isOpen ? "none" : "block";
        });
        label.addEventListener("mousedown", e => {
            e.stopPropagation();
            document.querySelectorAll(".ribbon-dropdown").forEach(dd => dd.style.display = "none");
            document.querySelectorAll(".ribbon-menu").forEach(m => m.classList.remove("selected"));
            positionTreePanel();
            const win = label.closest(".window");
            if (win) bringToFront(win);
            const isOpen = treePanel.style.display === "block";
            treePanel.style.display = isOpen ? "none" : "block";
        });

        // explorer.js の _treeOutsideHandlerInstalled 部分
        if (!win._treeOutsideHandlerInstalled) {
            win._treeOutsideHandlerInstalled = true;
            win._treeOutsideClickHandler = e => {
                const treePanel = win._treePanel;
                if (!treePanel || treePanel.style.display === "none") return;

                // 「これら以外」をクリックしたら閉じる判定を明確化
                const isSafeElement =
                    e.target.closest(".tree-container") ||
                    e.target.closest(".tree-panel") ||
                    e.target.closest(".ribbon-menu") ||
                    e.target.closest("#start-btn");

                if (!isSafeElement) {
                    treePanel.style.display = "none";
                }
            };
            document.addEventListener("mousedown", win._treeOutsideClickHandler);
        }

        function buildTree(node, parentEl, path = "", depth = 0, prefix = "", currentPath = "", visited = new Set()) {
            // 【重要】無限ループ防止: 既に訪れたオブジェクト（ノード）ならスキップ
            if (node && typeof node === "object") {
                if (visited.has(node)) return;
                visited.add(node);
            }

            // メタデータを除外してループ
            const entries = Object.entries(node).filter(([k, v]) => !isSystemMetaKey(k) && (showHidden || !v.hidden)); // ★隠しファイル表示設定を考慮

            entries.forEach(([name, child], index) => {
                const fullPath = path ? `${path}/${name}` : name;

                // 【重要】isFolder の判定を厳格にする (link は中身を追跡しない)
                const isFolder = child.type === "folder";

                // 子要素があるか判定（メタデータ以外のキーがあるか）
                const hasChildren = isFolder && Object.keys(child).some(k => !isSystemMetaKey(k));

                const isLast = index === entries.length - 1;
                const newPrefix = prefix + (isLast ? "└─ " : "├─ ");

                const item = document.createElement("div");
                item.className = "tree-item";
                item.style.fontFamily = "Consolas, monospace";
                item.style.cursor = "pointer";
                parentEl.appendChild(item);

                let arrowBtn, subContainer;

                if (hasChildren) {
                    arrowBtn = document.createElement("button");
                    arrowBtn.className = "tree-arrow";
                    arrowBtn.textContent = "▶";
                    arrowBtn.style.cssText = "margin-right:4px; font-family:Consolas, monospace; width:20px; height:20px; padding:0; line-height:18px; text-align:center;";
                    item.appendChild(arrowBtn);

                    subContainer = document.createElement("div");
                    subContainer.style.marginLeft = "12px";
                    parentEl.appendChild(subContainer);

                    if (currentPath.startsWith(fullPath)) {
                        subContainer.style.display = "block";
                        arrowBtn.textContent = "▼";
                    } else {
                        subContainer.style.display = "none";
                    }

                    arrowBtn.addEventListener("click", e => {
                        e.stopPropagation();
                        const expanded = subContainer.style.display === "block";
                        subContainer.style.display = expanded ? "none" : "block";
                        arrowBtn.textContent = expanded ? "▶" : "▼";
                    });
                } else {
                    const spacer = document.createElement("span");
                    spacer.style.display = "inline-block";
                    spacer.style.width = "24px";
                    item.appendChild(spacer);
                }

                const text = document.createElement("span");
                text.textContent = newPrefix + name;
                item.appendChild(text);

                item.addEventListener("click", e => {
                    e.stopPropagation();
                    openFSItem(name, child, path || "");
                    if (win._treePanel) {
                        win._treePanel.style.display = "none";
                    }
                });

                // 再帰呼び出し時、visited セットを引き継ぐ
                if (hasChildren) {
                    buildTree(child, subContainer, fullPath, depth + 1, prefix + (isLast ? "   " : "│  "), currentPath, visited);
                }
            });
        }

        // 呼び出し側も visited をリセットするように変更
        buildTree(FS, treePanel, "", 0, "", currentPath, new Set());

    }

    // ------------------------
    // 描画
    // ------------------------
    const render = async (path) => {
        currentPath = path;
        // 複数選択用の解除処理に修正
        if (globalSelected.items.size > 0) {
            globalSelected.items.forEach(i => i.classList.remove("selected"));
            globalSelected.items.clear();
            globalSelected.lastSelected = null;
            globalSelected.window = null;
        }

        // 最後に1回だけリボンをセットアップする
        setupRibbon(win, () => currentPath, render, getExplorerMenus());

        // 初回生成
        if (!listContainer) {
            const content = root.querySelector(".content") || root;
            content.innerHTML = "";

            const container = document.createElement("div");
            container.className = "explorer-container";
            container.style.display = "flex";
            container.style.flexDirection = "column";
            container.style.height = "100%";

            listContainer = document.createElement("div");
            listContainer.className = "explorer-list";
            listContainer.style.flex = "1 1 auto";
            listContainer.style.overflowY = "auto";

            listContainer.tabIndex = 0;

            // --- render関数内の listContainer 生成・初期化部分に追記 ---

            // ドラッグ中（重なっている間）の視覚効果
            listContainer.addEventListener("dragover", (e) => {
                e.preventDefault();
                e.stopPropagation();
                listContainer.classList.add("drag-over"); // CSSで背景色を変える等のスタイル用
            });

            listContainer.addEventListener("dragleave", (e) => {
                e.preventDefault();
                e.stopPropagation();
                listContainer.classList.remove("drag-over");
            });

            // explorer.js 内のドロップイベント処理 (修正版)
            listContainer.addEventListener("drop", async (e) => {
                e.preventDefault();
                e.stopPropagation();
                listContainer.classList.remove("drag-over");

                const folderNode = resolveFS(currentPath);
                if (!folderNode || folderNode.type !== "folder") return;

                // --- 1. ドロップされた直後のエントリを取得 ---
                const initialEntries = [];
                let hasFiles = false;
                if (e.dataTransfer.items) {
                    for (let i = 0; i < e.dataTransfer.items.length; i++) {
                        const item = e.dataTransfer.items[i];
                        if (item.kind === 'file') {
                            hasFiles = true;
                            const entry = item.webkitGetAsEntry();
                            if (entry) initialEntries.push(entry);
                        }
                    }
                } else {
                    if (e.dataTransfer.files.length > 0) hasFiles = true;
                    initialEntries.push(...Array.from(e.dataTransfer.files));
                }

                // ⭐ 追加: URLがドロップされた場合の処理
                const uriList = e.dataTransfer.getData("text/uri-list");
                const textPlain = e.dataTransfer.getData("text/plain");
                const urlToSave = uriList || textPlain;

                if (!hasFiles && urlToSave && urlToSave.startsWith("http")) {
                    let urlName = "新しいショートカット.url";
                    try {
                        const urlObj = new URL(urlToSave);
                        urlName = (urlObj.hostname).replace(/[\/\\?%*:|"<>]/g, "_") + ".url";
                    } catch (err) { }

                    const finalName = getUniqueName(folderNode, urlName);

                    // Windows仕様のURLファイルとして保存
                    folderNode[finalName] = {
                        type: "file",
                        content: `[InternetShortcut]\nURL=${urlToSave}`,
                        size: urlToSave.length + 21,
                        lastModified: Date.now()
                    };

                    await forceSave();
                    window.dispatchEvent(new Event("fs-updated"));
                    render(currentPath);
                    return;
                }

                if (initialEntries.length === 0) return;

                // --- 2. 総項目数をカウントする (フォルダ自体もカウントに含める) ---
                let totalFiles = 0;
                const countEntries = async (entry) => {
                    totalFiles++; // フォルダまたはファイルを1つとしてカウント
                    if (entry.isDirectory) {
                        const reader = entry.createReader();
                        const getEntries = () => new Promise(res => reader.readEntries(res));
                        let batch;
                        do {
                            batch = await getEntries();
                            if (batch) {
                                for (const sub of batch) await countEntries(sub);
                            }
                        } while (batch && batch.length > 0);
                    }
                };

                // 最初のスキャン
                for (const ent of initialEntries) {
                    if (ent instanceof File) totalFiles++;
                    else await countEntries(ent);
                }

                // --- 3. プログレスウィンドウの生成 ---
                const pg = progressWindow("コピー中...", "コピーの準備をしています...", {
                    width: 380,
                    height: 250,
                    autoClose: true
                });

                listContainer.style.opacity = "0.5";
                listContainer.style.pointerEvents = "none";

                let processedCount = 0;

                const addFileToNode = async (file, targetNode) => {
                    // 進捗更新 (processedCount はインクリメント前に渡してOK)
                    pg.update(processedCount, totalFiles, `${file.name} をコピーしています...`);

                    let targetName = getUniqueName(targetNode, file.name);

                    try {
                        const content = await importFileSmart(file);
                        targetNode[targetName] = {
                            type: "file",
                            content,
                            size: file.size,
                            lastModified: file.lastModified || Date.now()
                        };
                    } catch (err) {
                        console.error(`Failed to read file: ${file.name}`, err);
                    }
                    processedCount++;
                };

                const processEntry = async (entry, targetNode) => {
                    if (entry.isFile) {
                        const file = await new Promise(res => entry.file(res));
                        await addFileToNode(file, targetNode);
                    } else if (entry.isDirectory) {
                        let dirName = getUniqueName(targetNode, entry.name);
                        targetNode[dirName] = {
                            type: "folder",
                            lastModified: Date.now()
                        };
                        const newDirNode = targetNode[dirName];

                        // --- フォルダ作成自体を1カウントとして処理 ---
                        processedCount++;
                        pg.update(processedCount, totalFiles, `${dirName} を作成しています...`);

                        const reader = entry.createReader();
                        const getEntries = () => new Promise(res => reader.readEntries(res));
                        let batch;
                        do {
                            batch = await getEntries();
                            if (batch) {
                                for (const subEntry of batch) {
                                    await processEntry(subEntry, newDirNode);
                                }
                            }
                        } while (batch && batch.length > 0);
                    }
                };

                // --- 5. 実行 ---
                try {
                    for (const item of initialEntries) {
                        if (item instanceof File) {
                            await addFileToNode(item, folderNode);
                        } else {
                            await processEntry(item, folderNode);
                        }
                    }
                    folderNode.lastModified = Date.now();
                    // 最終更新 (これで確実に autoClose がトリガーされる)
                    pg.update(totalFiles, totalFiles, "すべての項目のコピーが完了しました。");
                    await forceSave();

                } catch (err) {
                    console.error("Drop processing failed:", err);
                    if (pg && typeof pg.close === "function") pg.close();
                } finally {
                    listContainer.style.opacity = "1";
                    listContainer.style.pointerEvents = "auto";

                    // ==========================================
                    // ⭐ メモリ解放 (GCの促進)
                    // ==========================================
                    // 1. 巨大なオブジェクトツリーの参照を切断
                    initialEntries.length = 0;

                    // 2. ブラウザ側のD&Dキャッシュを強力にクリア
                    if (e.dataTransfer) {
                        if (typeof e.dataTransfer.clearData === 'function') {
                            e.dataTransfer.clearData();
                        }
                        if (e.dataTransfer.items && typeof e.dataTransfer.items.clear === 'function') {
                            try { e.dataTransfer.items.clear(); } catch (err) { }
                        }
                    }

                    window.dispatchEvent(new Event("fs-updated"));
                    render(currentPath);

                    // 3. クロージャによるFileオブジェクト等のメモリ拘束（リーク）を防ぐため、
                    // setTimeoutには必要な参照(pg)のみを引数として渡す
                    const closeProgress = (progressWindowObj) => {
                        if (progressWindowObj && typeof progressWindowObj.close === "function") {
                            progressWindowObj.close();
                        }
                    };
                    setTimeout(closeProgress, 500, pg);
                }
            });

            container.appendChild(listContainer);

            const header = document.createElement("div");
            header.className = "explorer-header scrollbar_none";
            header.style.display = "flex";
            header.style.flexWrap = "nowrap";
            header.style.alignItems = "center";
            header.style.gap = "4px";
            header.style.padding = "2px";
            header.style.overflowX = "auto";

            const backBtn = document.createElement("button");
            backBtn.textContent = "←";
            backBtn.style.flexShrink = "0";
            // 初期状態は履歴がないので無効化しておく
            backBtn.disabled = historyStack.length === 0;
            backBtn.classList.toggle("pointer_none", historyStack.length === 0);


            const upBtn = document.createElement("button");
            upBtn.className = "up-button"; // クラス名を追加
            upBtn.textContent = "↑";
            upBtn.title = "上の階層へ";

            upBtn.onclick = () => {
                const pathParts = currentPath.split("/");
                if (pathParts.length > 1) {
                    pathParts.pop();
                    navigateTo(pathParts.join("/"));
                } else if (currentPath !== "") {
                    navigateTo("");
                }
            };

            const forwardBtn = document.createElement("button");
            forwardBtn.textContent = "→";
            forwardBtn.style.flexShrink = "0";
            // 初期状態は進む先がないので無効化しておく
            forwardBtn.disabled = forwardStack.length === 0;
            forwardBtn.classList.toggle("pointer_none", forwardStack.length === 0);

            const refreshBtn = document.createElement("button");
            refreshBtn.textContent = "↻"; // リフレッシュアイコン風
            refreshBtn.title = "最新の情報に更新";
            refreshBtn.style.flexShrink = "0";
            refreshBtn.onclick = () => render(currentPath);

            const viewControls = document.createElement("div");
            viewControls.className = "view-controls";
            viewControls.style.display = "flex";
            viewControls.style.flexWrap = "nowrap";
            viewControls.style.gap = "0px";
            viewControls.style.marginRight = "4px";
            viewControls.style.marginTop = "4px";
            viewControls.style.flexShrink = "0";

            // ボタン生成用の共通関数
            const createViewModeBtn = (label, mode, title) => {
                const btn = document.createElement("button");
                btn.className = viewMode === mode ? "view-mode-btn selected" : "view-mode-btn";
                btn.textContent = label;
                btn.title = title;
                btn.dataset.mode = mode; // ★どのモードのボタンか識別できるように追加
                btn.style.padding = "2px 6px";
                btn.style.marginRight = "4px";

                btn.onmousedown = async () => {
                    viewMode = mode;
                    await saveSetting("explorerViewMode", viewMode);
                    viewControls.querySelectorAll(".view-mode-btn").forEach(b => {
                        b.classList.remove("selected");
                    });
                    btn.classList.add("selected");
                    render(currentPath); // モードを保存して再描画
                };
                return btn;
            };

            // 3つのボタンを生成
            const listBtn = createViewModeBtn("目", "list", "リスト表示");
            const iconBtn = createViewModeBtn("⊞", "icon", "アイコン表示");
            const detailBtn = createViewModeBtn("≡", "details", "詳細表示");

            // ★ 追加: 隠しファイルの表示切り替えUI
            const hiddenContainer = document.createElement("label");
            hiddenContainer.style.display = "flex";
            hiddenContainer.style.alignItems = "center";
            hiddenContainer.style.marginLeft = "10px";
            hiddenContainer.style.fontSize = "12px";
            hiddenContainer.style.cursor = "pointer";

            const hiddenCheckbox = document.createElement("input");
            hiddenCheckbox.type = "checkbox";
            hiddenCheckbox.checked = showHidden;
            hiddenCheckbox.style.marginRight = "4px";
            hiddenCheckbox.onchange = async () => {
                showHidden = hiddenCheckbox.checked;
                await saveSetting("explorerShowHidden", showHidden); // 状態を保存
                render(currentPath); // すぐに反映
            };

            hiddenContainer.appendChild(hiddenCheckbox);
            hiddenContainer.appendChild(document.createTextNode("隠しファイル"));

            viewControls.appendChild(listBtn);
            viewControls.appendChild(iconBtn);
            viewControls.appendChild(detailBtn);
            viewControls.appendChild(hiddenContainer); // ★ 追加

            backBtn.onclick = () => {
                if (historyStack.length > 0) {
                    forwardStack.push(currentPath);
                    const prev = historyStack.pop();
                    navigateTo(prev, false);
                }
            };

            forwardBtn.onclick = () => {
                if (forwardStack.length > 0) {
                    historyStack.push(currentPath);
                    const next = forwardStack.pop();
                    navigateTo(next, false);
                }
            };

            pathLabel = document.createElement("span");
            pathLabel.className = "path-label";
            pathLabel.style.whiteSpace = "nowrap";
            pathLabel.style.overflow = "hidden";
            pathLabel.style.textOverflow = "ellipsis";
            // 2. 他のボタンは維持しつつ、パス表示部分だけを優先的に縮ませる設定
            pathLabel.style.minWidth = "0px"; // ★重要: これがないとFlexbox内で限界まで縮みません
            pathLabel.style.flexShrink = "1";

            // 3. Windowsのように、先頭（親階層）を「...」にして、末尾（現在のフォルダ）を残すテクニック
            pathLabel.style.direction = "rtl";
            pathLabel.style.textAlign = "left";

            treeContainer = document.createElement("div");
            treeContainer.className = "tree-container";
            treeContainer.style.flexShrink = "0";

            createTreeDropdown(treeContainer, currentPath);

            header.appendChild(backBtn);
            header.appendChild(forwardBtn);
            header.appendChild(upBtn);
            header.appendChild(refreshBtn);
            header.appendChild(viewControls);
            header.appendChild(treeContainer);
            header.appendChild(pathLabel);

            const searchInput = document.createElement("input");
            searchInput.type = "text";
            searchInput.placeholder = "検索...";
            searchInput.className = "explorer-search-input border";
            // Windowsクラシック風のスタイル（適宜CSSへ移動してください）
            Object.assign(searchInput.style, {
                width: "150px",
                minWidth: "100px", // ★追加: 最小幅（これ以上は縮ませない）
                marginLeft: "auto",
                marginRight: "4px",
                fontSize: "12px",
                height: "18px",
                flexShrink: "1"   // ★追加: 隙間が減った時に柔軟に縮むことを許可する
            });

            searchInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    const query = searchInput.value.trim();
                    if (query) {
                        renderSearchResults(query); // 検索結果描画へ
                    } else {
                        render(currentPath); // 空なら通常表示に戻す
                    }
                }
            });
            header.appendChild(searchInput);

            const ribbon = win?._ribbon;
            if (ribbon) {
                const separator = document.createElement("div");
                separator.className = "explorer-separator";
                ribbon.insertAdjacentElement("afterend", separator);
                separator.insertAdjacentElement("afterend", header);
            } else {
                root.insertBefore(header, content);
            }

            content.appendChild(container);

            listContainer.addEventListener("click", e => {
                if (wasDragging) return;
                // クリック対象が explorer-item か、その内部かを判定
                const item = e.target.closest(".explorer-item");
                if (!item) {
                    // クリックがリスト外なら選択解除
                    if (globalSelected.items.size > 0) {
                        globalSelected.items.forEach(i => i.classList.remove("selected"));
                        globalSelected.items.clear();
                        globalSelected.lastSelected = null;
                        globalSelected.window = null;

                        // ステータスバー更新
                        const statusBar = win?._statusBar;
                        if (statusBar) {
                            const folder = resolveFS(currentPath);
                            // 空白をクリックしたら選択解除
                            updateStatusBarSummary(statusBar, folder);
                        }

                        setupRibbon(win, () => currentPath, render, explorerMenus);

                    }
                }
            });

            listContainer.addEventListener("mousedown", (e) => {
                if (e.button !== 0) return; // 左クリックのみ
                // .explorer-item 上でも開始できるように判定を削除
                startX = e.clientX;
                startY = e.clientY;
                isSelecting = false;
                wasDragging = false;
            });

            document.addEventListener("mousemove", (e) => {
                if (startX === undefined || startY === undefined) return;

                const dx = Math.abs(e.clientX - startX);
                const dy = Math.abs(e.clientY - startY);

                // 3px以上マウスが動いたらドラッグ(範囲選択)開始と判定
                if (!isSelecting && (dx > 3 || dy > 3)) {
                    isSelecting = true;
                    wasDragging = true;

                    // Ctrlキーを押していない場合は既存の選択をクリア
                    if (!e.ctrlKey) {
                        globalSelected.items.forEach(i => i.classList.remove("selected"));
                        globalSelected.items.clear();
                        globalSelected.lastSelected = null;
                    }

                    selectionBox = document.createElement("div");
                    selectionBox.style.cssText = "position:fixed; border:1px solid #0078D7; background-color:rgba(0, 120, 215, 0.2); z-index:1000; pointer-events:none;";
                    document.body.appendChild(selectionBox);
                }

                if (isSelecting && selectionBox) {
                    e.preventDefault(); // デフォルトのテキスト選択や画像ドラッグを防ぐ
                    const currentX = e.clientX;
                    const currentY = e.clientY;
                    selectionBox.style.left = Math.min(startX, currentX) + "px";
                    selectionBox.style.top = Math.min(startY, currentY) + "px";
                    selectionBox.style.width = Math.abs(startX - currentX) + "px";
                    selectionBox.style.height = Math.abs(startY - currentY) + "px";

                    const boxRect = selectionBox.getBoundingClientRect();
                    const items = listContainer.querySelectorAll(".explorer-item");

                    items.forEach(item => {
                        const itemRect = item.getBoundingClientRect();
                        const isIntersecting = !(
                            itemRect.right < boxRect.left || itemRect.left > boxRect.right ||
                            itemRect.bottom < boxRect.top || itemRect.top > boxRect.bottom
                        );
                        if (isIntersecting) {
                            item.classList.add("selected");
                            globalSelected.items.add(item);
                        } else if (!e.ctrlKey) {
                            item.classList.remove("selected");
                            globalSelected.items.delete(item);
                        }
                    });
                }
            });

            document.addEventListener("mouseup", () => {
                startX = undefined;
                startY = undefined;

                if (isSelecting) {
                    isSelecting = false;
                    if (selectionBox) selectionBox.remove();
                    selectionBox = null;

                    setupRibbon(win, () => currentPath, render, getExplorerMenus());

                    // clickイベントが発火し終わった後にフラグを下ろす
                    setTimeout(() => { wasDragging = false; }, 50);
                }
            });

        } // ← 初回生成 if (!listContainer) の終わり

        // 【改善】if-else分岐の外にまとめ、再描画・初回生成の両方で必ず実行させます
        if (treeContainer) createTreeDropdown(treeContainer, currentPath);

        // --- render 関数の最後（364行目付近）に追加 ---

        // 現在の履歴スタックに応じて、ボタンの有効・無効を切り替える
        const bBtn = win?.querySelector(".explorer-header button:nth-child(1)");
        const fBtn = win?.querySelector(".explorer-header button:nth-child(2)");
        const uBtn = win?.querySelector(".up-button");

        // ★追加: 右クリックメニュー等で表示形式が変更された際、ヘッダーのボタン選択状態を同期する
        const viewControlsEl = win?.querySelector(".view-controls");
        if (viewControlsEl) {
            viewControlsEl.querySelectorAll(".view-mode-btn").forEach(b => {
                if (b.dataset.mode === viewMode) {
                    b.classList.add("selected");
                } else {
                    b.classList.remove("selected");
                }
            });
        }

        if (bBtn) {
            // 履歴がなければ disabled にし、pointer_none クラスを付与する
            const isBackDisabled = historyStack.length === 0;
            bBtn.disabled = isBackDisabled;
            bBtn.classList.toggle("pointer_none", isBackDisabled);
        }

        if (fBtn) {
            // 進むスタックがなければ disabled にし、pointer_none クラスを付与する
            const isForwardDisabled = forwardStack.length === 0;
            fBtn.disabled = isForwardDisabled;
            fBtn.classList.toggle("pointer_none", isForwardDisabled);
        }

        if (uBtn) {
            // フォルダ移動のたびにここが走り、最新の currentPath で判定される
            const isAtRoot = currentPath === "" || currentPath === "Desktop";
            uBtn.disabled = isAtRoot;
            uBtn.classList.toggle("pointer_none", isAtRoot);
        }

        // ファイル・フォルダリスト
        listContainer.innerHTML = "";
        const folder = resolveFS(currentPath);
        if (!folder) return;

        // レイアウトを初期化（アイコン表示の時はタイル状に並べる）
        if (viewMode === "icon") {
            listContainer.style.display = "grid";
            listContainer.style.gridTemplateColumns = "repeat(auto-fill, minmax(100px, 1fr))";
            listContainer.style.gap = "4px";
            listContainer.style.padding = "10px";
        } else {
            listContainer.style.display = "block";
            listContainer.style.padding = "0";
        }

        const fragment = document.createDocumentFragment();

        // ▼ 変更：選択処理の共通化 (Ctrl/Shift 複数選択対応)
        const selectItemUI = async (targetItem, e) => {
            globalSelected.window = win;
            const itemsArray = Array.from(listContainer.querySelectorAll(".explorer-item"));

            if (e && e.ctrlKey) {
                // Ctrlキー: 個別追加・解除
                if (globalSelected.items.has(targetItem)) {
                    globalSelected.items.delete(targetItem);
                    targetItem.classList.remove("selected");
                } else {
                    globalSelected.items.add(targetItem);
                    targetItem.classList.add("selected");
                }
                globalSelected.lastSelected = targetItem;
            } else if (e && e.shiftKey && globalSelected.lastSelected) {
                // Shiftキー: 範囲選択
                const startIdx = itemsArray.indexOf(globalSelected.lastSelected);
                const endIdx = itemsArray.indexOf(targetItem);
                const [min, max] = [Math.min(startIdx, endIdx), Math.max(startIdx, endIdx)];

                globalSelected.items.forEach(i => i.classList.remove("selected"));
                globalSelected.items.clear();

                for (let i = min; i <= max; i++) {
                    globalSelected.items.add(itemsArray[i]);
                    itemsArray[i].classList.add("selected");
                }
            } else {
                // 通常クリック: 単一選択
                globalSelected.items.forEach(i => i.classList.remove("selected"));
                globalSelected.items.clear();
                globalSelected.items.add(targetItem);
                targetItem.classList.add("selected");
                globalSelected.lastSelected = targetItem;
            }

            setupRibbon(win, () => currentPath, render, explorerMenus);

            // ステータスバーの更新
            const statusBar = win?._statusBar;
            if (statusBar && globalSelected.items.size === 1) {
                const targetName = targetItem.dataset.name;
                const node = resolveFS(currentPath)?.[targetName];
                if (node) {
                    const size = await calcNodeSize(node, `${currentPath}/${targetName}`);
                    statusBar.textContent = `${targetName} | ${node.type} | ${formatSize(size)}`;
                }
            } else if (statusBar && globalSelected.items.size > 1) {
                statusBar.textContent = `${globalSelected.items.size} 個のアイテムを選択中`;
            }
        };

        // ★改善: メタデータを除外し、ソート設定（自動整列）に基づいて配列を作成
        const itemsList = await Promise.all(Object.keys(folder)
            .filter(name => !isSystemMetaKey(name) && (showHidden || !folder[name].hidden))
            .map(async name => {
                const itemData = folder[name];
                const childPath = currentPath ? `${currentPath}/${name}` : name;
                const size = await calcNodeSize(itemData, childPath);
                return { name, itemData, size };
            }));

        const sortedItems = itemsList.sort((a, b) => {
            const isFolderA = a.itemData.type === "folder";
            const isFolderB = b.itemData.type === "folder";

            // Windows標準の挙動: 名前ソート以外でも基本的にフォルダを先頭にまとめる
            if (isFolderA && !isFolderB) return -1;
            if (!isFolderA && isFolderB) return 1;

            let result = 0;
            if (sortKey === "date") {
                const dateA = a.itemData.lastModified || 0;
                const dateB = b.itemData.lastModified || 0;
                result = dateA - dateB;
            } else if (sortKey === "size") {
                result = a.size - b.size;
            } else if (sortKey === "type") {
                const typeA = a.itemData.type || "";
                const typeB = b.itemData.type || "";
                result = typeA.localeCompare(typeB, 'ja');
                if (result === 0) result = a.name.localeCompare(b.name, 'ja');
            } else {
                result = a.name.localeCompare(b.name, 'ja');
            }

            return sortOrder === "asc" ? result : -result;
        });

        if (viewMode === "details") {
            const headerRow = document.createElement("div");
            headerRow.className = "details-header-row";
            headerRow.style.cssText = "display: flex; padding: 4px 8px; border-bottom: 1px solid #ccc; background: #f8f9fa; font-size: 12px; position: sticky; top: 0; z-index: 10;";

            const createColHeader = (text, key, flexStyle, padLeft) => {
                const col = document.createElement("div");
                // 展開（ソート）時の矢印マークを削除
                col.textContent = text;
                // 縦並び防止と列幅の固定化
                col.style.cssText = `flex: ${flexStyle}; padding-left: ${padLeft}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; user-select: none;`;

                // クリックでソート切り替え
                col.onclick = async () => {
                    if (sortKey === key) {
                        sortOrder = sortOrder === "asc" ? "desc" : "asc";
                    } else {
                        sortKey = key;
                        sortOrder = "asc";
                    }
                    await saveSetting("explorerSortKey", sortKey);
                    await saveSetting("explorerSortOrder", sortOrder);
                    render(currentPath);
                };
                return col;
            };

            headerRow.appendChild(createColHeader("名前", "name", "1 1 auto", "26px"));
            headerRow.appendChild(createColHeader("種類", "type", "0 0 150px", "8px"));
            headerRow.appendChild(createColHeader("サイズ", "size", "0 0 100px", "8px"));
            headerRow.appendChild(createColHeader("更新日時", "date", "0 0 150px", "8px"));
            fragment.appendChild(headerRow);
        }

        for (const { name, itemData, size: sizeValue } of sortedItems) {
            const childPath = currentPath ? `${currentPath}/${name}` : name;

            const item = document.createElement("div");
            // viewMode に応じたクラスを確実に付与
            item.className = `explorer-item ${viewMode}-view`;
            item.dataset.name = name;

            // ★追加: 隠しファイルの場合は半透明にする (Windows風)
            if (itemData.hidden) {
                item.style.opacity = "0.5";
            }

            const iconChar = getIcon(name, itemData);

            // --- HTML構造の生成 ---
            if (viewMode === "icon") {
                item.innerHTML = `
                    <div class="item-icon-large">${iconChar}</div>
                    <div class="item-name-label">${name}</div>
                `;
            } else if (viewMode === "details") {
                // ★改善: 事前計算された sizeValue を再利用（await を削除し高速化）
                const size = formatSize(sizeValue);

                // アイテムのレイアウトをFlexbox化してヘッダー列と幅を合わせるためのスタイル調整
                item.style.display = "flex";
                item.style.alignItems = "center";
                item.style.padding = "2px 8px";

                // type プロパティに応じて表示名を細かく分岐
                let typeLabel = "ファイル";
                switch (itemData.type) {
                    case "folder":
                        typeLabel = "フォルダ";
                        break;
                    case "link":
                        typeLabel = "ショートカット";
                        break;
                    case "app":
                        typeLabel = "アプリ";
                        break;
                    case "file":
                        typeLabel = "ファイル";
                        break;
                    default:
                        typeLabel = "不明";
                }

                const dateOpts = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' };
                const modifiedStr = itemData.lastModified
                    ? new Date(itemData.lastModified).toLocaleDateString('ja-JP', dateOpts)
                    : '';

                // flexプロパティとwhite-spaceで幅を固定し、縦並びを解消してヘッダーと位置を揃える
                item.innerHTML = `
        <div style="flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: 6px; overflow: hidden;">
            <span class="item-icon-small" style="flex-shrink: 0; display: flex; align-items: center; justify-content: center;">${iconChar}</span>
            <span class="item-name-text" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</span>
        </div>
        <span class="item-type-text" style="flex: 0 0 120px; padding-left: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${typeLabel}</span>
        <span class="item-size-text" style="flex: 0 0 100px; padding-left: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${size}</span>
        <span class="item-date-text" style="flex: 0 0 140px; padding-left: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${modifiedStr}</span>
    `;
            } else {
                // リスト表示
                item.innerHTML = `
                    <span class="item-icon-small">${iconChar}</span>
                    <span class="item-name-text">${name}</span>
                `;
            }

            fragment.appendChild(item);

            item.addEventListener("click", async e => {
                if (wasDragging) return;
                e.stopPropagation();
                await selectItemUI(item, e);
                listContainer.focus();
            });

            item.addEventListener("dblclick", () => {
                const node = resolveFS(currentPath)?.[name];
                if (!node) return;
                openFSItem(name, node, currentPath);
            });
        }
        listContainer.appendChild(fragment);

        // ★改善: context-menu.js の仕様に合わせた右クリックメニュー（背景とアイテムで切り替え）
        const contentEl = root.querySelector(".content") || root.closest(".window")?.querySelector(".content");
        if (contentEl) {
            attachContextMenu(contentEl, (e) => {
                const isInsideTrash = isTrashPath(currentPath);
                const clickedItem = e.target.closest(".explorer-item");

                // --- 1. 背景（何もアイテムがない場所）を右クリックした場合 ---
                if (!clickedItem) {
                    // 背景クリック時は選択を解除
                    if (globalSelected.items.size > 0) {
                        globalSelected.items.forEach(i => i.classList.remove("selected"));
                        globalSelected.items.clear();
                        globalSelected.lastSelected = null;
                    }

                    return [
                        { label: `表示: 大アイコン ${viewMode === "icon" ? "✔" : ""}`, action: async () => { viewMode = "icon"; await saveSetting("explorerViewMode", viewMode); render(currentPath); } },
                        { label: `表示: リスト ${viewMode === "list" ? "✔" : ""}`, action: async () => { viewMode = "list"; await saveSetting("explorerViewMode", viewMode); render(currentPath); } },
                        { label: `表示: 詳細 ${viewMode === "details" ? "✔" : ""}`, action: async () => { viewMode = "details"; await saveSetting("explorerViewMode", viewMode); render(currentPath); } },
                        { label: "---" }, // context-menu.js のセパレーター形式
                        { label: `並べ替え: 名前 ${sortKey === "name" ? "●" : ""}`, action: async () => { sortKey = "name"; await saveSetting("explorerSortKey", sortKey); render(currentPath); } },
                        { label: `並べ替え: 種類 ${sortKey === "type" ? "●" : ""}`, action: async () => { sortKey = "type"; await saveSetting("explorerSortKey", sortKey); render(currentPath); } },
                        { label: `並べ替え: サイズ ${sortKey === "size" ? "●" : ""}`, action: async () => { sortKey = "size"; await saveSetting("explorerSortKey", sortKey); render(currentPath); } },
                        { label: `並べ替え: 更新日時 ${sortKey === "date" ? "●" : ""}`, action: async () => { sortKey = "date"; await saveSetting("explorerSortKey", sortKey); render(currentPath); } },
                        { label: `昇順 / 降順 (${sortOrder === "asc" ? "昇順" : "降順"})`, action: async () => { sortOrder = sortOrder === "asc" ? "desc" : "asc"; await saveSetting("explorerSortOrder", sortOrder); render(currentPath); } },
                        { label: "---" },
                        { label: "最新の情報に更新", action: () => render(currentPath) },
                        { label: "---" },
                        { label: "新規フォルダ", action: () => createNewItem(currentPath, listContainer, () => render(currentPath), "folder"), disabled: isInsideTrash },
                        { label: "新規テキストファイル", action: () => createNewItem(currentPath, listContainer, () => render(currentPath), "file"), disabled: isInsideTrash }
                    ];
                }

                // --- 2. アイテム上を右クリックした場合 ---
                if (!globalSelected.items.has(clickedItem)) {
                    globalSelected.items.forEach(i => i.classList.remove("selected"));
                    globalSelected.items.clear();
                    globalSelected.items.add(clickedItem);
                    clickedItem.classList.add("selected");
                    globalSelected.lastSelected = clickedItem;
                }

                const fileMenu = getExplorerMenus().find(m => m.title === "File");
                const baseItems = fileMenu ? fileMenu.items.map(it => ({
                    label: it.label,
                    action: it.action,
                    disabled: typeof it.disabled === "function" ? it.disabled() : it.disabled
                })) : [];

                const openItems = baseItems.filter(it => it.label === "開く" || it.label === "元に戻す" || it.label === "プログラムから開く");
                const deleteItems = baseItems.filter(it => it.label === "選択アイテムを削除" || it.label === "完全に削除" || it.label === "ゴミ箱を空にする");
                const propItems = baseItems.filter(it => it.label === "プロパティ");

                const result = [...openItems];
                if (deleteItems.length) {
                    if (result.length) result.push({ label: "---" });
                    result.push(...deleteItems);
                }
                if (propItems.length) {
                    if (result.length) result.push({ label: "---" });
                    result.push(...propItems);
                }

                return result;
            });
        }

        // ステータスバー
        const statusBar = win?._statusBar;
        if (statusBar) {
            // ⭐ 何か選択されている間は上書きしない
            if (globalSelected.items.size > 0) return;
            // 最後にステータスバーを更新
            updateStatusBarSummary(statusBar, folder);
        }

        if (!listContainer._keydownBound) {
            listContainer.addEventListener("keydown", e => {
                e.stopPropagation();
                const items = Array.from(listContainer.querySelectorAll(".explorer-item"));
                if (!items.length) return;

                // 複数選択されている場合は最初の要素を起点にする
                const firstSelected = Array.from(globalSelected.items)[0];
                let currentIndex = items.findIndex(el => el === firstSelected);

                async function selectItem(index) {
                    const items = listContainer.querySelectorAll(".explorer-item");
                    const item = items[index];
                    if (!item) return;

                    await selectItemUI(item, null); // キー操作は単一選択扱い
                    item.scrollIntoView({ block: "nearest" });
                }

                if (e.key === "ArrowDown") {
                    e.preventDefault();
                    currentIndex = (currentIndex + 1) % items.length;
                    selectItem(currentIndex);
                }

                if (e.key === "ArrowUp") {
                    e.preventDefault();
                    currentIndex = (currentIndex - 1 + items.length) % items.length;
                    selectItem(currentIndex);
                }

                if (e.key === "Enter") {
                    e.preventDefault();
                    if (globalSelected.items.size === 0) return;

                    // エンターキーで選択されているアイテムをすべて開く
                    globalSelected.items.forEach(selectedItem => {
                        const name = selectedItem.dataset.name;
                        const node = resolveFS(currentPath)?.[name];
                        if (node) openFSItem(name, node, currentPath);
                    });
                }
            });
            listContainer._keydownBound = true;
        }
        requestAnimationFrame(() => {
            updateTitle_explorer(path);
        });
    };

    const renderSearchResults = async (query) => {
        listContainer.innerHTML = "";
        pathLabel.textContent = `「${query}」の検索結果`;

        // 現在のディレクトリ以下を検索（FS全体にしたい場合は resolveFS("") に変更）
        const rootNode = resolveFS(currentPath);
        const results = searchFS(rootNode, query, currentPath, showHidden); // ★ showHiddenを渡す

        if (results.length === 0) {
            listContainer.innerHTML = `<div style="padding:10px; font-size:12px; color:#666;">一致する項目はありません。</div>`;
            return;
        }

        // 検索結果の描画
        results.forEach(res => {
            const item = document.createElement("div");
            item.className = `explorer-item ${viewMode}-view`;
            item.dataset.name = res.name;

            // ★追加: 検索結果でも隠しファイルの場合は半透明にする
            if (res.node.hidden) {
                item.style.opacity = "0.5";
            }

            const iconChar = getIcon(res.name, res.node);

            item.innerHTML = `
            <span class="item-icon-small">${iconChar}</span>
            <span class="item-name-text">${res.name}</span>
            <span style="color:#888; font-size:10px; margin-left:8px;">(${res.path})</span>
        `;

            listContainer.appendChild(item);

            item.onclick = (e) => {
                if (!e.ctrlKey) {
                    globalSelected.items.forEach(i => i.classList.remove("selected"));
                    globalSelected.items.clear();
                }
                item.classList.add("selected");
                globalSelected.items.add(item);
            };

            item.ondblclick = () => {
                const parentPath = res.path.split('/').slice(0, -1).join('/');
                openFSItem(res.name, res.node, parentPath);
            };
        });
    };
    // ------------------------
    // Ribbon
    // ------------------------
    function getExplorerMenus() {
        const isInsideTrash = isTrashPath(currentPath);
        return [
            {
                title: "File",
                items: [
                    {
                        label: isInsideTrash ? "元に戻す" : "開く",
                        action: () => {
                            if (globalSelected.items.size === 0) return;

                            const items = Array.from(globalSelected.items);

                            if (isInsideTrash) {
                                // ゴミ箱内ならループでまとめて復元してから最後に1回再描画
                                items.forEach(selectedItem => {
                                    restoreFSItem(selectedItem.dataset.name);
                                });
                                render(currentPath);
                            } else {
                                items.forEach(selectedItem => {
                                    const name = selectedItem.dataset.name;
                                    const node = resolveFS(currentPath)?.[name];
                                    if (node) openFSItem(name, node, currentPath);
                                });
                            }
                        },
                        disabled: () => globalSelected.items.size === 0
                    },
                    {
                        label: "新しいフォルダ",
                        action: () => createNewItem(currentPath, listContainer, () => render(currentPath), "folder"),
                        disabled: () => isInsideTrash
                    },
                    {
                        label: isInsideTrash ? "ゴミ箱を空にする" : "新しいファイル",
                        action: () => {
                            if (isInsideTrash) {
                                emptyTrash(() => render(currentPath));
                            } else {
                                createNewItem(currentPath, listContainer, () => render(currentPath), "file");
                            }
                        }
                    },
                    {
                        label: isInsideTrash ? "完全に削除" : "選択アイテムを削除",
                        action: () => {
                            if (globalSelected.items.size === 0) return;

                            const itemNames = Array.from(globalSelected.items).map(item => item.dataset.name);

                            if (isInsideTrash) {
                                // ゴミ箱内：確認ダイアログを1回だけ表示し、一括で完全削除する
                                const msg = `
                                    <div style="padding:10px; font-size:13px;">
                                        選択した ${itemNames.length} 個のアイテムを完全に消去しますか？<br>
                                        <small style="color:#ff4444;">※この操作は取り消せません。</small>
                                    </div>`;

                                const confirmWin = showModalWindow("完全削除の確認", msg, {
                                    width: 320,
                                    height: 175,
                                    taskbar: false,
                                    overlay: true,
                                    buttons: [
                                        {
                                            label: "削除",
                                            action: async () => {
                                                const targetNode = resolveFS(currentPath);
                                                if (targetNode) {
                                                    for (const name of itemNames) {
                                                        const item = targetNode[name];
                                                        if (item) {
                                                            const originalPath = item.originalPath ? `${item.originalPath}/${name}` : name;
                                                            delete targetNode[name];

                                                            // ★ 削除されたデフォルト項目として記録
                                                            await markDefaultDeleted(originalPath);
                                                        }
                                                    }
                                                }

                                                await forceSave();

                                                if (confirmWin._modalOverlay) confirmWin._modalOverlay.remove();
                                                confirmWin.remove();

                                                window.dispatchEvent(new Event("fs-updated"));
                                                render(currentPath);
                                            }
                                        },
                                        {
                                            label: "キャンセル",
                                            action: () => {
                                                if (confirmWin._modalOverlay) confirmWin._modalOverlay.remove();
                                                confirmWin.remove();
                                            }
                                        }
                                    ]
                                });
                            } else {
                                // 通常フォルダ：ゴミ箱へ一括移動して最後に1回再描画
                                itemNames.forEach(name => {
                                    deleteFSItem(currentPath, name);
                                });
                                render(currentPath);
                            }
                        },
                        disabled: () => globalSelected.items.size === 0
                    },
                    {
                        label: "プログラムから開く",
                        action: () => {
                            if (globalSelected.items.size === 0) return;

                            const firstItem = Array.from(globalSelected.items)[0];
                            const name = firstItem.dataset.name;
                            const node = resolveFS(currentPath)?.[name];

                            if (node && node.type === "file") {
                                openWithDialog(`${currentPath}/${name}`, node);
                            } else {
                                alertWindow("このアイテムはプログラムから開くことができません。");
                            }
                        },
                        disabled: () => {
                            if (globalSelected.items.size !== 1 || isInsideTrash) return true;
                            const firstItem = Array.from(globalSelected.items)[0];
                            const node = resolveFS(currentPath)?.[firstItem.dataset.name];
                            return !node || node.type !== "file";
                        }
                    },
                    {
                        label: "プロパティ",
                        action: () => {
                            if (globalSelected.items.size === 0) return;

                            globalSelected.items.forEach(selectedItem => {
                                const name = selectedItem.dataset.name;
                                const node = resolveFS(currentPath)?.[name];
                                const fullPath = currentPath ? `${currentPath}/${name}` : name;
                                if (node) showProperties(name, node, fullPath);
                            });
                        },
                        disabled: () => globalSelected.items.size === 0
                    }
                ]
            }
        ];
    }

    const explorerMenus = getExplorerMenus();
    setupRibbon(win, () => currentPath, render, explorerMenus);


    render(currentPath);

    let renderScheduled = false;
    const handleFsUpdated = () => {
        if (renderScheduled) return;
        renderScheduled = true;
        const pathToRender = currentPath;
        requestAnimationFrame(() => {
            render(pathToRender);
            renderScheduled = false;
        });
    };

    if (!win._fsWatcherInstalled) {
        win._fsWatcherInstalled = true;
        window.addEventListener("fs-updated", handleFsUpdated);
    }

    function updateTitle_explorer(path) {
        if (!win) return;

        // 現在のパスから名前とノード情報を取得
        const name = path.split("/").pop() || path;
        const node = resolveFS(path);

        // 1. まずアイコンを取得（getIcon関数でゴミ箱なら🗑️が返るはずです）
        let iconChar = node ? getIcon(name, node) : "📁";

        // 2. ゴミ箱以外で、かつフォルダなら 📁 にする
        // 【修正】ゴミ箱（Trash）の時は、getIconの判定を優先させる（上書きしない）
        if (node && node.type === "folder" && name !== "Trash") {
            iconChar = "📁";
        }

        // 1. ウィンドウタイトルのテキストを更新
        if (titleEl) titleEl.textContent = name;

        // 2. ウィンドウタイトルのアイコンを更新
        const windowIcon = win.querySelector(".window-icon");
        if (windowIcon) {
            windowIcon.textContent = iconChar;
        }

        // 3. タスクバーの更新
        if (taskBtn) {
            const iconSpan = taskBtn.querySelector(".taskbar-icon");
            const textSpan = taskBtn.querySelector(".taskbar-text");

            if (iconSpan) iconSpan.textContent = iconChar;
            if (textSpan) textSpan.textContent = name;
            taskBtn.dataset.title = name;
        }

        win.dataset.title = name;
        if (pathLabel) {
            pathLabel.innerHTML = `<bdi dir="ltr">${path}</bdi>`;
        }
    }

    return {
        dispose: () => {
            window.removeEventListener("fs-updated", handleFsUpdated);
            if (win._treePanel) {
                win._treePanel.remove();
                win._treePanel = null;
            }
            if (win._treeOutsideClickHandler) {
                document.removeEventListener("mousedown", win._treeOutsideClickHandler);
                win._treeOutsideClickHandler = null;
            }
            if (win._treePanel) {
                win._treePanel.remove();
                win._treePanel = null;
            }
        }
    };

}

/**
 * 物理的な占有量をシミュレートして計算する
 */
export async function calcNodeSize(node, path = "") {
    if (!node) return 0;

    if (node.type === "file") {
        if (typeof node.size === "number") return node.size;
        if (node.content && node.content !== "__EXTERNAL_DATA__") {
            return sharedTextEncoder.encode(node.content).length;
        }
        return 0;
    }

    if (node.type === "folder") {
        const keys = Object.keys(node).filter(key => !IGNORED_METADATA_KEYS.has(key));
        const sizes = await Promise.all(keys.map(key => {
            const childNode = node[key];
            if (!childNode) return 0;
            const childPath = path ? `${path}/${key}` : key;
            return calcNodeSize(childNode, childPath);
        }));
        return sizes.reduce((total, s) => total + s, 0);
    }
    return 0;
}

function formatSize(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const units = ["B", "KB", "MB", "GB", "TB", "PB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)) + " " + units[i];
}

// FS 内の全アプリを取得
function getAllApps() {
    const apps = [];
    function traverse(node, path = "") {
        for (const name in node) {
            if (name === "type") continue;
            const child = node[name];
            const fullPath = path ? `${path}/${name}` : name;

            // child.type が "app" で、かつ名前が "Explorer.app" 以外を抽出
            if (child.type === "app") {
                if (name !== "Explorer.app") {
                    apps.push({ name, path: fullPath });
                }
            }
            else if (child.type === "folder") {
                traverse(child, fullPath);
            }
        }
    }
    traverse(FS);
    return apps;
}

export function openWithDialog(filePath, fileNode) {
    const apps = getAllApps();
    if (apps.length === 0) return alert("アプリがありません");

    const fileName = filePath.split("/").pop();

    const content = showModalWindow(`「${fileName}」を開くアプリを選択`, "", {
        taskbar: false,
        width: 300,
        height: Math.min(400, apps.length * 40 + 60),
        overlay: true,
        silent: true,
        buttons: []
    });

    content.innerHTML = "";
    apps.forEach(app => {
        const btn = document.createElement("button");
        btn.textContent = app.name;
        Object.assign(btn.style, { display: "block", width: "100%", margin: "4px 0", padding: "6px 0" });
        btn.onclick = () => {
            launch(app.path, { path: filePath, node: fileNode, uniqueKey: filePath });
            const win = content.parentElement;
            if (win) {
                win.remove();
                win._modalOverlay?.remove();
            }
        };
        content.appendChild(btn);
    });
}

/**
 * アイテムのプロパティを表示する
 */
export async function showProperties(name, node, path) {
    // 1. 既に開いているかチェック
    if (propertyWindows[path]) {
        bringToFront(propertyWindows[path]);
        return;
    }

    // ⭐ 追加: Data URL (data:...;base64,...) をデコードして生のテキストを取得するヘルパー関数
    const getDecodedContent = (content) => {
        if (typeof content !== "string") return "";
        if (content.startsWith("data:")) {
            try {
                const base64Index = content.indexOf(";base64,");
                if (base64Index !== -1) {
                    const base64 = content.substring(base64Index + 8);
                    const binary = atob(base64);
                    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
                    return new TextDecoder().decode(bytes);
                }
            } catch (e) {
                console.error("Base64 decode error:", e);
            }
        }
        return content;
    };

    const size = await calcNodeSize(node, path);
    const formattedSize = formatSize(size);
    const parentPath = path.split('/').slice(0, -1).join('/') || "(root)";
    const iconChar = getIcon(name, node);

    // URLファイルかの判定とURL文字列の抽出
    const isUrl = name.toLowerCase().endsWith(".url") && node.type === "file";
    let urlValue = "";

    // ⭐ 変更: Data URL の場合でもデコードしてテキスト化してから読み取る
    const rawContent = getDecodedContent(node.content);
    if (isUrl && typeof rawContent === "string") {
        const match = rawContent.match(/URL=(.+)/i);
        urlValue = match ? match[1].trim() : rawContent.trim();
    }

    // 更新日時のフォーマット処理を追加
    const dateOpts = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
    const modifiedStr = node.lastModified
        ? new Date(node.lastModified).toLocaleDateString('ja-JP', dateOpts)
        : '不明';

    const msg = `
        <div style="padding:15px; font-size:12px; line-height:1.8; user-select:none; font-family: 'Segoe UI', Tahoma, sans-serif;">
            <div style="display:flex; align-items:center; gap:15px; padding-bottom:15px;">
                <span style="font-size:36px;">${iconChar}</span>
                <input type="text" value="${name}" class="border" style="flex:1; padding:3px; font-size:12px;" readonly>
            </div>
            <hr style="border:0; border-top:1px solid #dfdfdf; margin: 0 0 10px 0;">
            
            <table style="width:100%; border-collapse:collapse;">
                <tr><td style="width:85px; color:#333;">ファイルの種類:</td><td style="color:#000;">${node.type === 'folder' ? 'ファイル フォルダー' : (node.type || '不明')}</td></tr>
                
                <!-- ▼ 修正：URLの場合はただの文字ではなく input フィールド（id="prop-url-input"）にする -->
                ${isUrl ? `<tr><td style="color:#333;">URL:</td><td><input type="text" id="prop-url-input" value="${urlValue}" style="width:100%; border:1px solid #ccc; padding:2px;"></td></tr>` : ''}
                
                <tr><td style="color:#333;">場所:</td><td style="color:#000;">${parentPath}</td></tr>
                <tr><td style="color:#333;">サイズ:</td><td style="color:#000;">${formattedSize} (${size.toLocaleString()} バイト)</td></tr>
            </table>
            
            <hr style="border:0; border-top:1px solid #dfdfdf; margin: 10px 0;">
            
            <table style="width:100%; border-collapse:collapse;">
                <tr><td style="width:85px; color:#333;">更新日時:</td><td style="color:#000;">${modifiedStr}</td></tr>
                <tr><td style="color:#333;">属性:</td><td><label><input type="checkbox" id="prop-hidden-checkbox" ${node.hidden ? "checked" : ""}> 隠しファイル</label></td></tr>
            </table>
        </div>`;

    // ⭐ 追加: URLかどうかでボタンの構成を切り替える
    const dialogButtons = [
        {
            label: "OK",
            action: async () => { // 引数をなくす
                let isChanged = false;

                // 1. URLの保存処理 (URLファイルの場合のみ実行)
                if (isUrl) {
                    const input = win.querySelector("#prop-url-input"); // スコープ内の win を直接参照
                    if (input && input.value !== urlValue) {
                        const newContentText = `[InternetShortcut]\r\nURL=${input.value}\r\n`;

                        if (typeof node.content === "string" && node.content.startsWith("data:")) {
                            const bytes = new TextEncoder().encode(newContentText);
                            const binary = String.fromCharCode(...bytes);
                            const base64 = btoa(binary);

                            const mimeMatch = node.content.match(/^data:([^;]+);/);
                            const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";

                            node.content = `data:${mime};base64,${base64}`;
                        } else {
                            node.content = newContentText;
                        }

                        node.size = new TextEncoder().encode(node.content).length;
                        node.lastModified = Date.now();
                        isChanged = true;
                    }
                }

                // 2. 隠しファイル属性の保存処理
                const hiddenCheckbox = win.querySelector("#prop-hidden-checkbox"); // スコープ内の win を直接参照
                if (hiddenCheckbox) {
                    if (hiddenCheckbox.checked !== !!node.hidden) {
                        if (hiddenCheckbox.checked) {
                            node.hidden = true;
                        } else {
                            delete node.hidden;
                        }
                        isChanged = true;
                    }
                }

                // 変更があった場合のみシステムに更新を通知
                if (isChanged) {
                    node.lastModified = Date.now();
                    await forceSave();
                    window.dispatchEvent(new Event("fs-updated"));
                }

                if (win._modalOverlay) win._modalOverlay.remove();
                win.remove();
            }
        },
        {
            label: "キャンセル",
            action: () => { // 引数をなくす
                if (win._modalOverlay) win._modalOverlay.remove();
                win.remove();
            }
        }
    ];

    const win = showModalWindow(`${name} のプロパティ`, msg, {
        width: 350,
        height: 420, // isUrlでの高さ分岐を削除して固定
        taskbar: false,
        overlay: false,
        silent: true,
        buttons: dialogButtons // ⭐ 統合したボタンを適用
    });

    // 2. 管理リストに登録
    propertyWindows[path] = win;

    // 3. ウィンドウがDOMから消えたら自動でリストから削除する
    const observer = new MutationObserver(() => {
        if (!document.body.contains(win)) {
            delete propertyWindows[path];
            observer.disconnect(); // 監視を終了
        }
    });

    // ウィンドウが所属する親要素（bodyなど）を監視
    observer.observe(document.body, { childList: true });
}

function searchFS(node, query, path = "", showHidden = false) {
    let results = [];
    const q = query.toLowerCase();

    for (const name in node) {
        if (isSystemMetaKey(name)) continue;
        const child = node[name];
        if (!showHidden && child.hidden) continue; // ★隠しファイル表示設定を考慮

        const fullPath = path ? `${path}/${name}` : name;

        // 名前が一致（部分一致）
        if (name.toLowerCase().includes(q)) {
            results.push({ name, node: child, path: fullPath });
        }

        // フォルダならその中身も再帰的に探す
        if (child.type === "folder") {
            // ★第4引数に showHidden を追加し、サブフォルダ検索時も設定を維持する
            results = results.concat(searchFS(child, query, fullPath, showHidden));
        }
    }
    return results;
}