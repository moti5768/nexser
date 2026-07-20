// desktop.js
import { FS, forceSave } from "./fs.js";
import { launch } from "./kernel.js";
import { alertWindow, progressWindow } from "./window.js";
import { resolveFS, validateName, importFileSmart } from "./fs-utils.js";
import { addRecent } from "./recent.js";
import { attachContextMenu } from "./context-menu.js";
import { resolveAppByPath, getIcon } from "./file-associations.js";
import { openWithDialog as explorerOpenWithDialog, showProperties } from "./apps/explorer.js";

// 選択状態管理
let globalSelected = { item: null, window: null };

// --------------------
// デスクトップ描画
// --------------------
export function buildDesktop() {
    globalSelected = { item: null, window: null };

    const desktop = document.getElementById("desktop");
    if (!desktop) return;

    let iconsContainer = document.getElementById("desktop-icons");
    if (!iconsContainer) {
        iconsContainer = document.createElement("div");
        iconsContainer.id = "desktop-icons";
        desktop.appendChild(iconsContainer);
    }

    // 🔥 追加：Fragmentでまとめて描画
    const fragment = document.createDocumentFragment();

    function createIcon(name, node) {
        const item = document.createElement("div");
        item.className = "icon";
        item.dataset.name = name;

        const iconGraphic = document.createElement("div");
        iconGraphic.className = "icon-graphic";
        iconGraphic.textContent = getIcon(name, node);

        const iconLabel = document.createElement("div");
        iconLabel.className = "icon-label";
        iconLabel.textContent = name;

        item.appendChild(iconGraphic);
        item.appendChild(iconLabel);

        const fullPath = `Desktop/${name}`;

        // 選択
        item.addEventListener("click", e => {
            e.stopPropagation();
            if (globalSelected.item) globalSelected.item.classList.remove("selected");
            item.classList.add("selected");
            globalSelected.item = item;
            globalSelected.window = desktop;
        });

        // ダブルクリック
        item.addEventListener("dblclick", () => {
            openFSItem(name, node, "Desktop");
        });

        // 右クリック
        attachContextMenu(item, () => [
            {
                label: "削除",
                action: () => deleteFSItem("Desktop", name)
            },
            {
                label: "プログラムから開く",
                disabled: () => node.type !== "file",
                action: () => {
                    if (node.type === "file") {
                        explorerOpenWithDialog(fullPath, node);
                    } else {
                        alertWindow("システムエラー防止のため開けません", { width: 350, height: 120 });
                    }
                }
            },
            {
                label: "プロパティ",
                action: () => showProperties(name, node, fullPath)
            }
        ]);

        return item; // ← appendしない
    }

    // 🔥 ここでまとめて作る
    for (const name in FS.Desktop) {
        if (name === "type" || name === "system") continue;
        fragment.appendChild(createIcon(name, FS.Desktop[name]));
    }

    // 🔥 一括反映
    iconsContainer.innerHTML = "";
    iconsContainer.appendChild(fragment);

    // --------------------
    // 右クリックメニュー（デスクトップ）
    // --------------------
    const desktopNode = FS.Desktop; // ← resolveFS削減

    attachContextMenu(desktop, (e) => {
        if (e.target.closest(".window")) return [];

        const items = [];

        if (globalSelected.item) {
            const name = globalSelected.item.dataset.name;
            const node = desktopNode[name];

            if (node) {
                items.push({
                    label: "開く",
                    action: () => openFSItem(name, node, "Desktop")
                });
            }
        }

        items.push({
            label: "新しいフォルダ",
            action: () => createNewItem("Desktop", iconsContainer, "folder")
        });

        items.push({
            label: "新しいファイル",
            action: () => createNewItem("Desktop", iconsContainer, "file")
        });

        items.push({
            label: "選択アイテムを削除",
            disabled: !globalSelected.item,
            action: () => {
                if (globalSelected.item) {
                    const name = globalSelected.item.dataset.name;
                    deleteFSItem("Desktop", name);
                    globalSelected.item = null;
                }
            }
        });

        if (globalSelected.item) {
            const name = globalSelected.item.dataset.name;
            const node = desktopNode[name];
            const fullPath = `Desktop/${name}`;

            items.push({
                label: "プログラムから開く",
                disabled: node.type !== "file",
                action: () => {
                    if (node.type === "file") {
                        explorerOpenWithDialog(fullPath, node);
                    } else {
                        alertWindow("ファイル以外は開けません", { width: 300, height: 120 });
                    }
                }
            });

            items.push({
                label: "プロパティ",
                action: () => showProperties(name, node, fullPath)
            });
        }

        return items;
    });

    // --------------------
    // デスクトップクリック
    // --------------------
    desktop.onclick = (e) => {
        desktop.focus();

        if (!e.target.closest(".icon")) {
            if (globalSelected.item) {
                globalSelected.item.classList.remove("selected");
                globalSelected.item = null;
                globalSelected.window = null;
            }
        }
    };

    // ────────────────────────────────────────────────────────
    // 🔥 追加：外部からのファイルドロップ受付機能
    // ────────────────────────────────────────────────────────
    // ⭐ 修正：イベントリスナーの多重登録を防ぐガードを追加
    if (!desktop._dndInstalled) {
        desktop._dndInstalled = true;

        desktop.addEventListener("dragover", (e) => {
            e.preventDefault();
            e.stopPropagation();
            desktop.classList.add("drag-over"); // 視覚効果用のCSSクラス
        });

        desktop.addEventListener("dragleave", (e) => {
            e.preventDefault();
            e.stopPropagation();
            desktop.classList.remove("drag-over");
        });

        desktop.addEventListener("drop", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            desktop.classList.remove("drag-over");

            const folderNode = FS.Desktop; // デスクトップの仮想FSノードを参照
            if (!folderNode) return;

            // ドロップされた直後のエントリを取得
            const initialEntries = [];
            if (e.dataTransfer.items) {
                for (let i = 0; i < e.dataTransfer.items.length; i++) {
                    const item = e.dataTransfer.items[i];
                    if (item.kind === 'file') {
                        const entry = item.webkitGetAsEntry();
                        if (entry) initialEntries.push(entry);
                    }
                }
            } else {
                initialEntries.push(...Array.from(e.dataTransfer.files));
            }

            if (initialEntries.length === 0) return;

            // 総項目数をカウント（プログレスバー用）
            let totalFiles = 0;
            const countEntries = async (entry) => {
                totalFiles++;
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

            for (const ent of initialEntries) {
                if (ent instanceof File) totalFiles++;
                else await countEntries(ent);
            }

            // プログレスウィンドウの生成
            const pg = progressWindow("コピー中...", "コピーの準備をしています...", {
                width: 380,
                height: 250,
                autoClose: true
            });

            desktop.style.opacity = "0.5";
            desktop.style.pointerEvents = "none";
            let processedCount = 0;

            // デスクトップ用の名前重複回避ヘルパー
            const getUniqueDesktopName = (node, name) => {
                if (!node[name]) return name;
                const dotIdx = name.lastIndexOf(".");
                const base = dotIdx !== -1 ? name.substring(0, dotIdx) : name;
                const ext = dotIdx !== -1 ? name.substring(dotIdx) : "";
                let idx = 1;
                let finalName = name;
                while (node[finalName]) {
                    finalName = `${base} (${idx++})${ext}`;
                }
                return finalName;
            };

            const addFileToNode = async (file, targetNode) => {
                pg.update(processedCount, totalFiles, `${file.name} をコピーしています...`);
                let targetName = getUniqueDesktopName(targetNode, file.name);

                try {
                    const content = await importFileSmart(file);
                    targetNode[targetName] = {
                        type: "file",
                        content,
                        size: file.size,
                        lastModified: file.lastModified
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
                    let dirName = getUniqueDesktopName(targetNode, entry.name);
                    targetNode[dirName] = { type: "folder" };
                    const newDirNode = targetNode[dirName];

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

            try {
                for (const item of initialEntries) {
                    if (item instanceof File) {
                        await addFileToNode(item, folderNode);
                    } else {
                        await processEntry(item, folderNode);
                    }
                }

                // 最終更新
                pg.update(totalFiles, totalFiles, "すべての項目のコピーが完了しました。");
                await forceSave();

            } catch (err) {
                console.error("Drop processing failed:", err);
                if (pg && typeof pg.close === "function") pg.close();
            } finally {
                desktop.style.opacity = "1";
                desktop.style.pointerEvents = "auto";
                window.dispatchEvent(new Event("fs-updated"));
                buildDesktop();

                setTimeout(() => {
                    if (pg && typeof pg.close === "function") pg.close();
                }, 500);
            }
        });
    } // ⭐ ガード処理はここまで

    requestAnimationFrame(adjustDesktopIconArea);
    window.dispatchEvent(new Event("desktop-ready"));
}

// タスクバー高さに応じてアイコン領域を調整
// タスクバー高さに応じてアイコン領域を調整
function adjustDesktopIconArea() {
    const desktop = document.getElementById("desktop");
    const iconsContainer = document.getElementById("desktop-icons");
    const taskbar = document.getElementById("taskbar");
    if (!desktop || !iconsContainer || !taskbar) return;

    // 🔥 修正点1: 起動中で画面が隠れている(display:none)時は高さが0になるため、デフォルト値(40など)を仮置きする
    const taskbarHeight = taskbar.offsetHeight > 0 ? taskbar.offsetHeight : 40;

    iconsContainer.style.position = "absolute";
    iconsContainer.style.top = "0";
    iconsContainer.style.left = "0";
    iconsContainer.style.right = "0";
    iconsContainer.style.bottom = `${taskbarHeight}px`; // タスクバー分の余白
    iconsContainer.style.display = "flex";

    // 🔥 修正点2: アイコンを「上から下」へ並べ、画面下まで到達したら「右」へ折り返す (Windows標準の挙動)
    iconsContainer.style.flexDirection = "column";
    iconsContainer.style.flexWrap = "wrap";

    iconsContainer.style.alignContent = "flex-start";
    iconsContainer.style.padding = "10px"; // 内側余白
    iconsContainer.style.overflow = "auto";
}

// --------------------
// 起動完了時やリサイズ時に確実に再計算させる仕組み
// --------------------
// 🔥 修正点3: 画面が非表示から表示に切り替わった瞬間を検知してレイアウトを直す
if (!window._desktopResizeObserver) {
    window._desktopResizeObserver = new ResizeObserver(() => {
        adjustDesktopIconArea();
    });
    // 画面全体(body)のサイズや表示状態の変化を監視
    window._desktopResizeObserver.observe(document.body);
}

// 既存のイベントリスナー（これは残しておいてOKです）
window.addEventListener("desktop-resize", adjustDesktopIconArea);

// --------------------
// 新規フォルダ/ファイル作成
// --------------------
function createNewItem(currentPath, container, itemType = "folder") {
    const folderNode = resolveFS(currentPath);
    if (!folderNode || !container) return;

    // 二重作成防止（フラグ管理）
    if (createNewItem.isCreating) return;
    createNewItem.isCreating = true;

    // 初期表示名の設定
    let baseName = itemType === "folder" ? "新しいフォルダ" : "新しいテキスト.txt";
    let defaultName = baseName;
    let counter = 1;

    // 重複チェック
    while (folderNode[defaultName]) {
        if (itemType === "folder") {
            defaultName = `新しいフォルダ (${counter++})`;
        } else {
            defaultName = `新しいテキスト (${counter++}).txt`;
        }
    }

    const iconDiv = document.createElement("div");
    iconDiv.className = "icon";
    container.appendChild(iconDiv);

    const input = document.createElement("input");
    input.type = "text";
    input.value = defaultName;
    input.style.cssText = "font-size:13px; text-align:left; width:auto; min-width:100px; z-index:10;";
    iconDiv.appendChild(input);

    input.focus();

    // ファイルの場合は拡張子の手前までを選択、フォルダは全選択
    const dotIndex = defaultName.lastIndexOf(".");
    if (itemType === "file" && dotIndex > 0) {
        input.setSelectionRange(0, dotIndex);
    } else {
        input.select();
    }

    // 幅を文字数に応じて自動調整
    const adjustWidth = () => {
        input.style.width = `${Math.max(input.value.length * 8, 100)}px`;
    };
    adjustWidth();
    input.addEventListener("input", adjustWidth);

    let isShowingError = false;
    let isCommitting = false;

    const finishEditing = () => {
        if (isShowingError || isCommitting) return;
        isCommitting = true;

        let newName = input.value.trim() || defaultName;

        // バリデーション (fs-utils.js)
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

        let finalName = newName;
        let idx = 1;
        while (folderNode[finalName]) {
            finalName = `${newName} (${idx++})`;
        }

        // 指定されたタイプで作成
        if (itemType === "folder") {
            folderNode[finalName] = { type: "folder" };
        } else {
            folderNode[finalName] = { type: "file", content: "" };
        }

        iconDiv.remove();
        createNewItem.isCreating = false;
        window.dispatchEvent(new Event("fs-updated"));
    };

    input.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            e.preventDefault();
            finishEditing();
        } else if (e.key === "Escape") {
            isCommitting = true;
            iconDiv.remove();
            createNewItem.isCreating = false;
        }
    });

    input.addEventListener("blur", () => {
        if (isShowingError || isCommitting) return;
        iconDiv.remove();
        createNewItem.isCreating = false;
    });
}

// --------------------
// アイテム削除 (ゴミ箱対応版)
// --------------------
function deleteFSItem(parentPath, itemName) {
    const parentNode = resolveFS(parentPath);
    if (!parentNode || !parentNode[itemName]) return;

    // ゴミ箱ノードを取得
    const trashNode = resolveFS("Trash");
    if (!trashNode) {
        // ゴミ箱がない場合は念のため従来通りの直接削除を試みる
        if (!confirm(`「${itemName}」を完全に消去しますか？`)) return;
        delete parentNode[itemName];
        window.dispatchEvent(new Event("fs-updated"));
        return;
    }

    try {
        // 1. 元のデータをコピーし、復元用の「元の親パス」を記録
        const targetItemData = JSON.parse(JSON.stringify(parentNode[itemName]));
        targetItemData.originalPath = parentPath; // ★復元先を記録

        // 2. 元の場所から削除 (Proxyによる保護がある場合はここでエラーになる)
        const success = delete parentNode[itemName];
        if (!success) throw new Error("Blocked by Proxy");

        // 3. ゴミ箱内での名前を決定 (重複回避)
        let targetName = itemName;
        if (trashNode[itemName]) {
            let counter = 1;
            let baseName = `${Date.now()}_${itemName}`;
            targetName = baseName;
            while (trashNode[targetName]) {
                targetName = `${baseName}_${counter++}`;
            }
        }

        // 4. ゴミ箱へ追加
        trashNode[targetName] = targetItemData;

        // 完了通知
        window.dispatchEvent(new Event("fs-updated"));
    } catch (e) {
        console.warn(`[Desktop Guard] 削除拒否: ${itemName}`);
        alertWindow(`「${itemName}」は保護されているため削除できません。`, {
            title: "システム保護",
            width: 350,
            height: 160
        });
    }
}

// 修正後の openFSItem
function openFSItem(name, node, parentPath) {
    let targetNode = node;
    let targetPath = `${parentPath}/${name}`;

    // 1. ショートカットの解決 (Windowsは常にリンク先を追う)
    if (targetNode.type === "link") {
        targetPath = targetNode.target;
        targetNode = resolveFS(targetPath);
        if (!targetNode) {
            alertWindow("リンク先が見つかりません。");
            return;
        }
    }

    // 2. 実行タイプの特定
    const type = targetNode.type;
    const associatedApp = resolveAppByPath(targetPath);

    // 3. アプリケーションの実行
    if (type === "app") {
        launch(targetPath, { path: targetPath, uniqueKey: targetPath });
        addRecent({ type: "app", path: targetPath });
    }
    // 4. フォルダの展開
    else if (type === "folder") {
        // Windowsは常に共通のエクスプローラーを起動
        launch("Programs/Applications/Explorer.app", {
            path: targetPath,
            uniqueKey: targetPath,
            showFullPath: true // Windowsらしくパスを表示
        });
        addRecent({ type: "folder", path: targetPath });
    }
    // 5. ファイルの実行
    else if (type === "file") {
        if (associatedApp) {
            // 関連付けがあればそのアプリで起動
            launch(associatedApp, { path: targetPath, node: targetNode, uniqueKey: targetPath });
        } else {
            // ⭐ 簡易ビューアではなく、Explorerと同じ「アプリ選択ダイアログ」を出す
            explorerOpenWithDialog(targetPath, targetNode);
        }
        addRecent({ type: "file", path: targetPath });
    }
}


// --------------------
// FS更新監視
// --------------------
let desktopInitialized = false;
function installDesktopWatcher() {
    if (desktopInitialized) return;
    desktopInitialized = true;
    window.addEventListener("fs-updated", () => buildDesktop());
}
installDesktopWatcher();

// --------------------
// キーボードナビゲーションの実装
// --------------------
let isDesktopKeyHandlerAttached = false;

function setupDesktopKeyboardNavigation() {
    if (isDesktopKeyHandlerAttached) return;

    document.addEventListener("keydown", (e) => {
        // --- ガード処理：デスクトップがアクティブか判定 ---
        const active = document.activeElement;

        // 1. 入力欄（リネーム中など）にフォーカスがある場合は即座に終了
        if (active.tagName === "INPUT" || active.tagName === "TEXTAREA") return;

        // 2. ウィンドウ（アプリ）内の要素にフォーカスがある場合は無視
        if (active.closest(".window")) return;

        // 3. デスクトップ要素の存在確認
        const desktop = document.getElementById("desktop");
        const iconsContainer = document.getElementById("desktop-icons");
        if (!desktop || !iconsContainer) return;

        // 4. デスクトップまたはbody（どこも選んでいない状態）以外がアクティブなら無視
        // buildDesktop内で desktop.tabIndex = 0 を設定し、クリック時に .focus() させるのが前提
        const isDesktopFocused = (active === desktop || active === document.body);
        if (!isDesktopFocused) return;

        // --- 移動ロジック開始 ---
        const icons = Array.from(iconsContainer.querySelectorAll(".icon"));
        if (icons.length === 0) return;

        let currentIndex = icons.findIndex(el => el.classList.contains("selected"));

        const selectIcon = (targetEl) => {
            if (!targetEl) return;
            // 全選択解除
            icons.forEach(el => el.classList.remove("selected"));
            // 新規選択
            targetEl.classList.add("selected");
            globalSelected.item = targetEl;
            globalSelected.window = desktop;
            // 視界に入るようスクロール
            targetEl.scrollIntoView({ block: "nearest", inline: "nearest" });
        };

        // 物理的な距離で最適なアイコンを探す（ご提示のロジックを完全維持）
        const getNearestIcon = (currentEl, direction) => {
            const currentRect = currentEl.getBoundingClientRect();
            const currentCenterX = currentRect.left + currentRect.width / 2;
            const currentCenterY = currentRect.top + currentRect.height / 2;

            let bestMatch = null;
            let minDistance = Infinity;

            icons.forEach(target => {
                if (target === currentEl) return;
                const targetRect = target.getBoundingClientRect();
                const targetCenterX = targetRect.left + targetRect.width / 2;
                const targetCenterY = targetRect.top + targetRect.height / 2;

                let isProperDirection = false;
                if (direction === "ArrowDown") isProperDirection = targetRect.top >= currentRect.bottom - 5;
                if (direction === "ArrowUp") isProperDirection = targetRect.bottom <= currentRect.top + 5;

                if (isProperDirection) {
                    const dist = Math.pow(targetCenterX - currentCenterX, 2) + Math.pow(targetCenterY - currentCenterY, 2);
                    if (dist < minDistance) {
                        minDistance = dist;
                        bestMatch = target;
                    }
                }
            });
            return bestMatch;
        };

        // キー分岐
        switch (e.key) {
            case "ArrowRight":
                e.preventDefault();
                selectIcon(icons[currentIndex === -1 ? 0 : (currentIndex + 1) % icons.length]);
                break;
            case "ArrowLeft":
                e.preventDefault();
                selectIcon(icons[currentIndex === -1 ? 0 : (currentIndex - 1 + icons.length) % icons.length]);
                break;
            case "ArrowDown":
                e.preventDefault();
                if (currentIndex === -1) {
                    selectIcon(icons[0]);
                } else {
                    const next = getNearestIcon(icons[currentIndex], "ArrowDown");
                    if (next) selectIcon(next);
                }
                break;
            case "ArrowUp":
                e.preventDefault();
                if (currentIndex === -1) {
                    selectIcon(icons[icons.length - 1]);
                } else {
                    const prev = getNearestIcon(icons[currentIndex], "ArrowUp");
                    if (prev) selectIcon(prev);
                }
                break;
            case "Enter":
                if (globalSelected.item) {
                    e.preventDefault();
                    const name = globalSelected.item.dataset.name;
                    const desktopNode = resolveFS("Desktop");
                    const node = desktopNode ? desktopNode[name] : null;
                    if (node) openFSItem(name, node, "Desktop");
                }
                break;
        }
    });

    isDesktopKeyHandlerAttached = true;
}

// 最後に実行
setupDesktopKeyboardNavigation();

// タスクバーの高さが変わったらアイコン領域を再調整
window.addEventListener("desktop-resize", adjustDesktopIconArea);
