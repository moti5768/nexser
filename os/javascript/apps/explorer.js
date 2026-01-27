// Explorer.js
import { launch } from "../kernel.js";
import { createWindow, showModalWindow } from "../window.js";
import { resolveFS } from "../fs-utils.js";
import { FS, initFS } from "../fs.js";
import { buildDesktop } from "../desktop.js";
import { attachContextMenu } from "../context-menu.js";
import { resolveAppByPath, getExtension } from "../file-associations.js";
import { addRecent } from "../recent.js";

let globalSelected = { item: null, window: null };

function hasExtension(name) {
    return /\.[a-z0-9]+$/i.test(name);
}

// ------------------------
// 共通関数
// ------------------------
function deleteFSItem(parentPath, itemName, rerender) {
    const parentNode = resolveFS(parentPath);
    if (!parentNode || !parentNode[itemName]) return;
    delete parentNode[itemName];
    rerender?.();
    buildDesktop();
    window.dispatchEvent(new Event("fs-updated"));
}

function createNewFolder(currentPath, listContainer, renderCallback) {
    const folderNode = resolveFS(currentPath);
    if (!folderNode || !listContainer) return;

    let folderName = "新しいフォルダ";
    let counter = 1;
    while (folderNode[folderName]) folderName = `新しいフォルダ (${counter++})`;

    const itemDiv = document.createElement("div");
    itemDiv.className = "explorer-item";

    const input = document.createElement("input");
    input.type = "text";
    input.value = folderName;
    input.style.cssText = "width:100px;font-size:13px;text-align:center";
    itemDiv.appendChild(input);
    listContainer.appendChild(itemDiv);

    input.focus();
    input.select();

    const finishEditing = () => {
        itemDiv.remove();

        let newName = input.value.trim() || folderName;
        let finalName = newName;
        let idx = 1;
        while (folderNode[finalName]) finalName = `${newName} (${idx++})`;

        const ext = getExtension(finalName);
        if (ext === ".app") folderNode[finalName] = { type: "app", entry: "" };
        else if (ext) folderNode[finalName] = { type: "file", content: "" };
        else folderNode[finalName] = { type: "folder" };

        renderCallback?.();
        buildDesktop();
        window.dispatchEvent(new Event("fs-updated"));
    };

    input.addEventListener("blur", finishEditing);
    input.addEventListener("keydown", e => { if (e.key === "Enter") finishEditing(); });
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

    // ------------------------
    // ダブルクリック・アドレスバー共通ロジック
    // ------------------------
    function openFSItem(name, node, parentPath) {
        let targetPath = parentPath
            ? `${parentPath}/${name}`
            : name;
        let targetNode = node;

        if (node.type === "link") {
            targetPath = node.target;
            targetNode = resolveFS(targetPath);
            if (!targetNode) return;
        }

        let effectiveType = targetNode.type;
        if (effectiveType === "folder" && hasExtension(name)) effectiveType = "file";

        switch (effectiveType) {
            case "folder":
                currentPath = targetPath;
                render(currentPath);
                break;
            case "app":
                launch(targetPath, { path: targetPath, uniqueKey: targetPath });
                break;
            case "file": {
                const appPath = resolveAppByPath(targetPath);
                if (appPath) launch(appPath, { path: targetPath, node: targetNode, uniqueKey: targetPath });
                else import("../apps/fileviewer.js").then(mod => {
                    const content = createWindow(name);
                    mod.default(content, { name, content: targetNode.content });
                });
                break;
            }
        }
        addRecent({ type: effectiveType, path: targetPath });
    }

    // ------------------------
    // 折りたたみ式アドレスバー作成
    // ------------------------
    function createTreeDropdown(container, currentPath) {
        // 既存の子要素を削除
        while (container.firstChild) container.removeChild(container.firstChild);
        container.classList.add("tree-container");

        // ラベル（フォルダ名だけ）
        const label = document.createElement("span");
        label.className = "tree-label";
        label.textContent = currentPath.split("/").pop();
        container.appendChild(label);

        // ツリーパネル（body直下に置く）
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
        // クリアして再利用
        treePanel.innerHTML = "";

        // パネルの位置をラベル下に調整
        function positionTreePanel() {
            const rect = label.getBoundingClientRect();
            treePanel.style.left = rect.left + "px";
            treePanel.style.top = rect.bottom + "px";
        }

        // ラベル横に矢印ボタンを追加
        const arrowBtn = document.createElement("button");
        arrowBtn.className = "tree-label-arrow";
        arrowBtn.textContent = "▼";
        arrowBtn.style.position = "absolute";
        arrowBtn.style.marginRight = "0px";
        arrowBtn.style.right = "0px";
        label.appendChild(arrowBtn);

        // ボタンでツリーパネル開閉
        arrowBtn.addEventListener("mousedown", e => {
            e.stopPropagation();
            positionTreePanel();
            const isOpen = treePanel.style.display === "block";
            treePanel.style.display = isOpen ? "none" : "block";
        });

        label.addEventListener("mousedown", e => {
            e.stopPropagation();
            positionTreePanel();
            const isOpen = treePanel.style.display === "block";
            treePanel.style.display = isOpen ? "none" : "block";
        });

        // 外クリックで閉じる
        // 外クリックで閉じる（多重登録防止）
        if (!win._treeOutsideHandlerInstalled) {
            win._treeOutsideHandlerInstalled = true;

            document.addEventListener("mousedown", e => {
                const treePanel = win._treePanel;
                if (!treePanel) return;

                if (!treePanel.contains(e.target)) {
                    treePanel.style.display = "none";
                }
            });
        }


        // ------------------------
        // ツリー再帰
        // ------------------------
        function buildTree(node, parentEl, path = "", depth = 0, prefix = "", currentPath = "") {
            const entries = Object.entries(node).filter(([k]) => k !== "type");

            entries.forEach(([name, child], index) => {
                const fullPath = path ? `${path}/${name}` : name;
                const isFolder = child.type === "folder" || (!child.type && !hasExtension(name));
                const hasChildren = isFolder && Object.keys(child).some(k => k !== "type");

                const isLast = index === entries.length - 1;
                const newPrefix = prefix + (isLast ? "└─ " : "├─ ");

                const item = document.createElement("div");
                item.className = "tree-item";
                item.style.fontFamily = "Consolas, monospace";
                item.style.cursor = "pointer";
                parentEl.appendChild(item);

                let arrowBtn;
                let subContainer;

                if (hasChildren) {
                    // 矢印ボタン
                    arrowBtn = document.createElement("button");
                    arrowBtn.className = "tree-arrow";
                    arrowBtn.textContent = "▶";
                    arrowBtn.style.marginRight = "4px";
                    arrowBtn.style.fontFamily = "Consolas, monospace";
                    arrowBtn.style.width = "20px";
                    arrowBtn.style.height = "20px";
                    arrowBtn.style.padding = "0";
                    arrowBtn.style.lineHeight = "18px";
                    arrowBtn.style.textAlign = "center";
                    item.appendChild(arrowBtn);

                    // 子コンテナ
                    subContainer = document.createElement("div");
                    subContainer.style.marginLeft = "12px";
                    parentEl.appendChild(subContainer);

                    // 自動展開：currentPath 以下なら開く
                    if (currentPath.startsWith(fullPath)) {
                        subContainer.style.display = "block";
                        arrowBtn.textContent = "▼";
                    } else {
                        subContainer.style.display = "none";
                    }

                    // クリックで開閉
                    arrowBtn.addEventListener("click", e => {
                        e.stopPropagation();
                        const expanded = subContainer.style.display === "block";
                        subContainer.style.display = expanded ? "none" : "block";
                        arrowBtn.textContent = expanded ? "▶" : "▼";
                    });
                } else {
                    // フォルダでない場合はスペーサー
                    const spacer = document.createElement("span");
                    spacer.style.display = "inline-block";
                    spacer.style.width = "24px";
                    item.appendChild(spacer);
                }

                // テキスト
                const text = document.createElement("span");
                text.textContent = newPrefix + name;
                item.appendChild(text);

                // クリックで開く
                item.addEventListener("click", e => {
                    e.stopPropagation();
                    openFSItem(name, child, path || "");

                    // ツリーパネルを閉じる
                    if (treePanel) {
                        treePanel.style.display = "none";
                        // 矢印ボタンも閉じた状態に戻す
                        const parentArrow = item.querySelector(".tree-arrow");
                        if (parentArrow) parentArrow.textContent = "▶";
                    }
                });

                // 再帰
                if (hasChildren) {
                    buildTree(child, subContainer, fullPath, depth + 1, prefix + (isLast ? "   " : "│  "), currentPath);
                }
            });
        }

        // 呼び出し側
        buildTree(FS, treePanel, "", 0, "", currentPath);

    }

    // ------------------------
    // 描画
    // ------------------------
    const render = (path) => {

        currentPath = path;
        updateTitle(path);

        let listContainer = root.querySelector(".explorer-list");
        let pathLabel = root.querySelector(".path-label");
        let treeContainer = root.querySelector(".tree-container");

        if (globalSelected.window === root.closest(".window")) {
            globalSelected.item?.classList.remove("selected");
            globalSelected.item = null;
            globalSelected.window = null;
        }

        // 初回生成
        if (!listContainer) {
            root.innerHTML = "";
            const container = document.createElement("div");
            container.className = "explorer-container";
            container.style.display = "flex";
            container.style.flexDirection = "column";
            container.style.height = "100%";

            const header = document.createElement("div");
            header.className = "explorer-header";

            const backBtn = document.createElement("button");
            backBtn.id = "back-btn";
            backBtn.textContent = "←";
            backBtn.style.marginRight = "8px";

            pathLabel = document.createElement("span");
            pathLabel.className = "path-label";

            treeContainer = document.createElement("div");
            treeContainer.className = "tree-container";

            createTreeDropdown(treeContainer, currentPath);

            header.appendChild(backBtn);
            header.appendChild(treeContainer);
            header.appendChild(pathLabel);

            listContainer = document.createElement("div");
            listContainer.className = "explorer-list";
            listContainer.style.flex = "1 1 auto";
            listContainer.style.overflowY = "auto";

            container.appendChild(header);
            container.appendChild(listContainer);
            root.appendChild(container);

            backBtn.onclick = () => {
                if (currentPath === "Desktop") return;
                const parts = currentPath.split("/");
                parts.pop();
                currentPath = parts.join("/") || "Desktop";
                render(currentPath);
            };
        } else {
            if (treeContainer) createTreeDropdown(treeContainer, currentPath);
        }

        // パス表示
        if (pathLabel) pathLabel.textContent = currentPath;

        // ファイル・フォルダリスト
        listContainer.innerHTML = "";
        const folder = resolveFS(path);
        if (!folder) return;

        for (const name in folder) {
            if (name === "type") continue;
            const itemData = folder[name];

            const item = document.createElement("div");
            item.textContent = name;
            item.className = "explorer-item";
            listContainer.appendChild(item);
            // シングルクリックで選択
            item.addEventListener("click", e => {
                e.stopPropagation();

                // 前回選択解除（全ウィンドウ対象）
                if (globalSelected.item) {
                    globalSelected.item.classList.remove("selected");
                }

                // 新しく選択
                item.classList.add("selected");
                globalSelected.item = item;
                globalSelected.window = win; // このアイテムがどのウィンドウか
            });

            item.addEventListener("dblclick", () => openFSItem(name, itemData, path));
        }

        // 右クリック
        const contentEl = root.querySelector(".content") || root.closest(".window")?.querySelector(".content");
        // 右クリック（選択アイテム基準）
        if (contentEl) {
            attachContextMenu(contentEl, (e) => {
                const items = [];
                items.push({
                    label: "新規フォルダ",
                    action: () => createNewFolder(currentPath, listContainer, () => render(currentPath))
                });

                items.push({
                    label: "選択アイテムを削除",
                    action: () => {
                        if (globalSelected.item) {
                            const name = globalSelected.item.textContent;
                            deleteFSItem(currentPath, name, () => {
                                render(currentPath);
                                globalSelected.item = null;
                            });
                        }
                    },
                    disabled: !globalSelected.item
                });

                // 選択アイテムがあれば「プログラムから開く」を追加
                if (globalSelected.item) {
                    const name = globalSelected.item.textContent;
                    const node = resolveFS(currentPath)[name];

                    const isFolder = node?.type === "folder"; // フォルダかチェック
                    items.push({
                        label: "プログラムから開く",
                        action: () => {
                            if (!isFolder) openWithDialog(`${currentPath}/${name}`, node);
                        },
                        disabled: isFolder // フォルダなら無効化
                    });
                }
                return items;
            });
        }

        // ステータスバー
        const statusBar = win?._statusBar;
        if (statusBar) {
            let folders = 0, files = 0, apps = 0, links = 0;
            for (const key in folder) {
                if (key === "type") continue;
                const node = folder[key];
                switch (node.type) {
                    case "folder": folders++; break;
                    case "file": files++; break;
                    case "app": apps++; break;
                    case "link": links++; break;
                }
            }

            const parts = [];
            if (folders) parts.push(`${folders} folder${folders > 1 ? "s" : ""}`);
            if (files) parts.push(`${files} file${files > 1 ? "s" : ""}`);
            if (apps) parts.push(`${apps} app${apps > 1 ? "s" : ""}`);
            if (links) parts.push(`${links} link${links > 1 ? "s" : ""}`);
            statusBar.textContent = parts.length ? parts.join(", ") : "(empty)";
        }
    };

    // ------------------------
    // Ribbon
    // ------------------------
    const defaultRibbonMenus = [
        {
            title: "Window", items: [
                { label: "最小化", action: () => win.querySelector(".min-btn")?.click() },
                { label: "最大化 / 元のサイズに戻す", action: () => win.querySelector(".max-btn")?.click() },
                { label: "閉じる", action: () => win.querySelector(".close-btn")?.click() }
            ]
        },
        {
            title: "File", items: [
                {
                    label: "ファイル/フォルダの作成", action: () => {
                        const listContainer = root.querySelector(".explorer-list");
                        createNewFolder(currentPath, listContainer, () => render(currentPath));
                    }
                },
                {
                    label: "選択アイテムを削除", action: () => {
                        if (globalSelected.item) {
                            deleteFSItem(currentPath, globalSelected.item.textContent, () => {
                                render(currentPath);
                                globalSelected.item = null;
                            });
                        }
                    }
                }
            ]
        }
    ];
    setupRibbon(win, () => currentPath, render, defaultRibbonMenus);

    render(currentPath);

    if (!win._fsWatcherInstalled) {
        win._fsWatcherInstalled = true;
        window.addEventListener("fs-updated", () => { if (currentPath === "Desktop") render(currentPath); });
    }

    function updateTitle(path) {
        if (!win) return;
        const name = path.split("/").pop() || path;
        if (titleEl) titleEl.textContent = name;
        if (taskBtn) { taskBtn.textContent = name; taskBtn.dataset.title = name; }
        win.dataset.title = name;
    }
}

// ------------------------
// Ribbon ヘルパー
// ------------------------
export function setupRibbon(win, getCurrentPath, renderCallback, menus) {
    if (!win?._ribbon) return;
    const ribbon = win._ribbon;
    ribbon.innerHTML = "";
    (menus || []).forEach(menu => addRibbonMenu(ribbon, menu.title, menu.items));
}

function addRibbonMenu(ribbon, title, items) {
    const menu = document.createElement("div");
    menu.className = "ribbon-menu";

    const span = document.createElement("span");
    span.className = "ribbon-title";
    span.textContent = title;
    menu.appendChild(span);

    const dropdown = document.createElement("div");
    dropdown.className = "ribbon-dropdown";

    items.forEach(it => {
        const div = document.createElement("div");
        div.className = "ribbon-item";
        div.textContent = it.label;
        div.onclick = it.action;
        dropdown.appendChild(div);
    });

    menu.appendChild(dropdown);
    ribbon.appendChild(menu);
}


// FS 内の全アプリを取得
function getAllApps() {
    const apps = [];
    function traverse(node, path = "") {
        for (const name in node) {
            if (name === "type") continue;
            const child = node[name];
            const fullPath = path ? `${path}/${name}` : name;
            if (child.type === "app") apps.push({ name, path: fullPath });
            else if (child.type === "folder") traverse(child, fullPath);
        }
    }
    traverse(FS);
    return apps;
}

export function openWithDialog(filePath, fileNode) {
    const apps = getAllApps();
    if (apps.length === 0) return alert("アプリがありません");

    const fileName = filePath.split("/").pop();

    // モーダル作成
    const content = showModalWindow(`「${fileName}」を開くアプリを選択`, "", {
        taskbar: false,
        width: 300,
        height: Math.min(400, apps.length * 40 + 60), // 高さ自動調整
        buttons: [] // 標準のOKボタンは不要
    });

    // モーダル内にアプリ一覧ボタンを描画
    content.innerHTML = ""; // 既存内容クリア
    apps.forEach(app => {
        const btn = document.createElement("button");
        btn.textContent = app.name;
        Object.assign(btn.style, {
            display: "block",
            width: "100%",
            margin: "4px 0",
            padding: "6px 0"
        });
        btn.onclick = () => {
            launch(app.path, { path: filePath, node: fileNode, uniqueKey: filePath });
            // モーダル閉じる
            const win = content.parentElement;
            win.remove();
            win._modalOverlay?.remove();
        };
        content.appendChild(btn);
    });
}