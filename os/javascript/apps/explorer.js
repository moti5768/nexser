// Explorer.js
import { launch } from "../kernel.js";
import { createWindow, showModalWindow, alertWindow } from "../window.js";
import { resolveFS, validateName } from "../fs-utils.js";
import { FS, initFS } from "../fs.js";
import { buildDesktop } from "../desktop.js";
import { attachContextMenu } from "../context-menu.js";
import { resolveAppByPath, getExtension } from "../file-associations.js";
import { addRecent } from "../recent.js";

let globalSelected = { item: null, window: null };
let isCreating = false;

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

    // 安全性向上: 二重作成防止
    if (listContainer.querySelector("input") || createNewFolder.isCreating) return;
    createNewFolder.isCreating = true;

    let folderName = "新しいフォルダ";
    let counter = 1;
    while (folderNode[folderName]) folderName = `新しいフォルダ (${counter++})`;

    const itemDiv = document.createElement("div");
    itemDiv.className = "explorer-item";

    const input = document.createElement("input");
    input.type = "text";
    input.value = folderName;
    input.style.cssText = "font-size:13px; text-align:left; width:auto; min-width:100px;";
    itemDiv.appendChild(input);

    // 文字数に応じて幅を調整
    const adjustWidth = () => {
        // 文字数 * 8px を目安に幅を変更（必要に応じて調整）
        input.style.width = `${Math.max(input.value.length * 8, 100)}px`;
    };

    // 初期幅調整
    adjustWidth();

    // 入力中も自動調整
    input.addEventListener("input", adjustWidth);

    listContainer.appendChild(itemDiv);

    input.focus();
    input.select();

    let isShowingError = false;
    let isCommitting = false;

    // blur でキャンセル
    input.addEventListener("blur", () => {
        if (isShowingError || isCommitting) return;
        itemDiv.remove();
        createNewFolder.isCreating = false;
    });

    const finishEditing = () => {
        if (isShowingError || isCommitting) return;
        isCommitting = true;

        let newName = input.value.trim() || folderName;
        const error = validateName(newName);

        if (error) {
            isCommitting = false;
            isShowingError = true;
            alertWindow(error, { width: 360, height: 160, taskbar: false });
            setTimeout(() => {
                isShowingError = false;
                input.focus();
                input.select();
            }, 0);
            return;
        }

        itemDiv.remove();
        createNewFolder.isCreating = false;

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

    input.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            e.preventDefault();
            finishEditing();
        }
        if (e.key === "Escape") {
            itemDiv.remove();
            createNewFolder.isCreating = false;
        }
    });
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

    // 固定参照保持
    let listContainer, pathLabel, treeContainer;

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
        if (effectiveType === "folder" && hasExtension(name)) effectiveType = "file";

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
            positionTreePanel();
            const isOpen = treePanel.style.display === "block";
            treePanel.style.display = isOpen ? "none" : "block";
        });

        if (!win._treeOutsideHandlerInstalled) {
            win._treeOutsideHandlerInstalled = true;
            document.addEventListener("mousedown", e => {
                const treePanel = win._treePanel;
                if (!treePanel) return;
                if (!treePanel.contains(e.target)) treePanel.style.display = "none";
            });
        }

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

                let arrowBtn, subContainer;

                if (hasChildren) {
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

                    subContainer = document.createElement("div");
                    subContainer.style.marginLeft = "12px";
                    parentEl.appendChild(subContainer);

                    if (currentPath.startsWith(fullPath)) {
                        subContainer.style.display = "block";
                        arrowBtn.textContent = "▼";
                    } else subContainer.style.display = "none";

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
                    if (treePanel) {
                        treePanel.style.display = "none";
                        const parentArrow = item.querySelector(".tree-arrow");
                        if (parentArrow) parentArrow.textContent = "▶";
                    }
                });

                if (hasChildren) buildTree(child, subContainer, fullPath, depth + 1, prefix + (isLast ? "   " : "│  "), currentPath);
            });
        }

        buildTree(FS, treePanel, "", 0, "", currentPath);
    }

    // ------------------------
    // 描画
    // ------------------------
    const render = (path) => {
        currentPath = path;
        updateTitle(currentPath);

        if (globalSelected.item) {
            globalSelected.item.classList.remove("selected");
            globalSelected.item = null;
            globalSelected.window = null;
            setupRibbon(win, () => currentPath, render, getExplorerMenus());
        }

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

            container.appendChild(listContainer);

            const header = document.createElement("div");
            header.className = "explorer-header";

            const backBtn = document.createElement("button");
            backBtn.textContent = "←";
            // 初期状態は履歴がないので無効化しておく
            backBtn.disabled = historyStack.length === 0;
            backBtn.classList.toggle("pointer_none", historyStack.length === 0);

            const forwardBtn = document.createElement("button");
            forwardBtn.textContent = "→";
            // 初期状態は進む先がないので無効化しておく
            forwardBtn.disabled = forwardStack.length === 0;
            forwardBtn.classList.toggle("pointer_none", forwardStack.length === 0);

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

            treeContainer = document.createElement("div");
            treeContainer.className = "tree-container";

            createTreeDropdown(treeContainer, currentPath);

            header.appendChild(backBtn);
            header.appendChild(forwardBtn);
            header.appendChild(treeContainer);
            header.appendChild(pathLabel);

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

        } else {
            if (treeContainer) createTreeDropdown(treeContainer, currentPath);
        }

        // --- render 関数の最後（364行目付近）に追加 ---

        // 現在の履歴スタックに応じて、ボタンの有効・無効を切り替える
        // win（Explorerを動かしているウィンドウ）の中からボタンを探して更新します
        const bBtn = win?.querySelector(".explorer-header button:nth-child(1)");
        const fBtn = win?.querySelector(".explorer-header button:nth-child(2)");

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

        // パス表示
        if (pathLabel) pathLabel.textContent = currentPath;

        // ファイル・フォルダリスト
        listContainer.innerHTML = "";
        const folder = resolveFS(currentPath);
        if (!folder) return;

        for (const name in folder) {
            if (name === "type") continue;
            const itemData = folder[name];

            const item = document.createElement("div");
            item.textContent = name;
            item.className = "explorer-item";
            listContainer.appendChild(item);

            item.addEventListener("click", e => {
                e.stopPropagation();
                globalSelected.item?.classList.remove("selected");
                item.classList.add("selected");
                globalSelected.item = item;
                globalSelected.window = win;
                setupRibbon(win, () => currentPath, render, getExplorerMenus());
                const node = resolveFS(currentPath)?.[name];
                if (!node) return; // 安全に早期リターン
                const size = calcNodeSize(node);

                const statusBar = win?._statusBar;
                if (statusBar) {
                    statusBar.textContent =
                        `${name} | ${node.type} | ${formatSize(size)}`;
                }
                listContainer.focus();
            });
            item.addEventListener("dblclick", () => {
                const node = resolveFS(currentPath)?.[name];
                if (!node) return;
                openFSItem(name, node, currentPath);
            });
        }

        // 右クリック
        const contentEl = root.querySelector(".content") || root.closest(".window")?.querySelector(".content");
        if (contentEl) {
            attachContextMenu(contentEl, () => {
                const fileMenu = getExplorerMenus().find(m => m.title === "File");
                if (!fileMenu) return [];

                return fileMenu.items.map(it => ({
                    label: it.label,
                    action: it.action,
                    disabled: typeof it.disabled === "function" ? it.disabled() : it.disabled
                }));
            });
        }

        // ステータスバー
        const statusBar = win?._statusBar;
        if (statusBar) {

            // ⭐ 何か選択されている間は上書きしない
            if (globalSelected.item) return;

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

        if (!listContainer._keydownBound) {
            listContainer.addEventListener("keydown", e => {
                const items = Array.from(listContainer.querySelectorAll(".explorer-item"));
                if (!items.length) return;

                let currentIndex = items.findIndex(el => el === globalSelected.item);

                function selectItem(index) {
                    globalSelected.item?.classList.remove("selected");
                    const item = items[index];
                    item.classList.add("selected");
                    globalSelected.item = item;
                    globalSelected.window = win;

                    // ステータスバー更新
                    const node = resolveFS(currentPath)?.[item.textContent];
                    const size = calcNodeSize(node);
                    const statusBar = win?._statusBar;
                    if (statusBar) {
                        statusBar.textContent =
                            `${item.textContent} | ${node.type} | ${formatSize(size)}`;
                    }

                    item.scrollIntoView({ block: "nearest" });
                    setupRibbon(win, () => currentPath, render, getExplorerMenus());
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
                    // 安全性向上: nodeが存在しない場合に早期リターン
                    if (!globalSelected.item) return;
                    const name = globalSelected.item.textContent;
                    const node = resolveFS(currentPath)?.[name];
                    if (!node) return;
                    openFSItem(name, node, currentPath);
                }
            });

            listContainer._keydownBound = true; // 初回だけ追加
        }

    };

    // ------------------------
    // Ribbon
    // ------------------------
    function getExplorerMenus() {
        return [
            {
                title: "Window",
                items: [
                    { label: "最小化", action: () => win.querySelector(".min-btn")?.click() },
                    { label: "最大化 / 元のサイズに戻す", action: () => win.querySelector(".max-btn")?.click() },
                    { label: "閉じる", action: () => win.querySelector(".close-btn")?.click() }
                ]
            },
            {
                title: "File",
                items: [
                    {
                        label: "開く",
                        action: () => {
                            if (!globalSelected.item) return;
                            const name = globalSelected.item.textContent;
                            const node = resolveFS(currentPath)[name];
                            openFSItem(name, node, currentPath);
                        },
                        disabled: () => !globalSelected.item
                    },
                    {
                        label: "新規フォルダ/ファイル作成",
                        action: () => createNewFolder(currentPath, listContainer, () => render(currentPath))
                    },
                    {
                        label: "選択アイテムを削除",
                        action: () => {
                            if (!globalSelected.item) return;
                            deleteFSItem(
                                currentPath,
                                globalSelected.item.textContent,
                                () => {
                                    render(currentPath);
                                    globalSelected.item = null;
                                    setupRibbon(win, () => currentPath, render, getExplorerMenus());
                                }
                            );
                        },
                        disabled: () => !globalSelected.item
                    },
                    {
                        label: "プログラムから開く",
                        action: () => {
                            if (!globalSelected.item) return;
                            const name = globalSelected.item.textContent;
                            const node = resolveFS(currentPath)[name];
                            if (node?.type !== "folder") openWithDialog(`${currentPath}/${name}`, node);
                        },
                        disabled: () => {
                            if (!globalSelected.item) return true;
                            const node = resolveFS(currentPath)[globalSelected.item.textContent];
                            return !node || node.type === "folder";
                        }
                    }
                ]
            }
        ];
    }

    setupRibbon(win, () => currentPath, render, getExplorerMenus());

    render(currentPath);

    if (!win._fsWatcherInstalled) {
        win._fsWatcherInstalled = true;
        // 安全性向上: 複数イベントをまとめて1回レンダリング
        let renderScheduled = false;
        window.addEventListener("fs-updated", () => {
            if (renderScheduled) return;
            renderScheduled = true;
            requestAnimationFrame(() => {
                render(currentPath);
                renderScheduled = false;
            });
        });

    }

    function updateTitle(path) {
        if (!win) return;
        const name = path.split("/").pop() || path;
        if (titleEl) titleEl.textContent = name;
        if (taskBtn) { taskBtn.textContent = name; taskBtn.dataset.title = name; }
        win.dataset.title = name;

        // content 外にある pathLabel を更新
        if (pathLabel) pathLabel.textContent = path;
    }
}

function calcNodeSize(node) {
    if (!node) return 0;

    if (node.type === "file") {
        return node.content?.length ?? 0;
    }

    if (node.type === "folder") {
        let total = 0;
        for (const key in node) {
            if (key === "type") continue;
            total += calcNodeSize(node[key]);
        }
        return total;
    }

    // app / link はサイズ0扱い
    return 0;
}

function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
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
        div.onclick = () => {
            if (div.classList.contains("pointer_none")) return;
            it.action();
        };

        if (it.disabled) {
            const isDisabled = typeof it.disabled === "function" ? it.disabled() : it.disabled;
            if (isDisabled) div.classList.add("pointer_none");
        }

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

    const content = showModalWindow(`「${fileName}」を開くアプリを選択`, "", {
        taskbar: false,
        width: 300,
        height: Math.min(400, apps.length * 40 + 60),
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
