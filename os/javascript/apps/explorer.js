// Explorer.js
import { launch } from "../kernel.js";
import { createWindow } from "../window.js";
import { resolveFS } from "../fs-utils.js";
import { FS, initFS } from "../fs.js";
import { buildDesktop } from "../desktop.js";
import { attachContextMenu } from "../context-menu.js";
import { resolveAppByPath, getExtension } from "../file-associations.js";
import { addRecent } from "../recent.js";

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
        let treePanel = document.querySelector(".tree-panel");
        if (!treePanel) {
            treePanel = document.createElement("div");
            treePanel.className = "tree-panel";
            treePanel.style.display = "none";
            document.body.appendChild(treePanel);
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
        document.addEventListener("mousedown", e => {
            if (!treePanel.contains(e.target) && e.target !== label && e.target !== arrowBtn) {
                treePanel.style.display = "none";
                arrowBtn.textContent = "▼"; // 閉じた状態に戻す
            }
        });

        // ------------------------
        // ツリー再帰
        // ------------------------
        function buildTree(node, parentEl, path = "", depth = 0) {
            for (const name in node) {
                if (name === "type") continue;
                const child = node[name];
                const fullPath = path ? `${path}/${name}` : name;
                const isFolder = child.type === "folder" || (!child.type && !hasExtension(name));

                const item = document.createElement("div");
                item.className = "tree-item";
                item.style.paddingLeft = `${depth * 12}px`;
                parentEl.appendChild(item);

                // 子を持つフォルダだけ矢印
                const hasChildren = isFolder && Object.keys(child).some(k => k !== "type");
                let itemArrowBtn, subContainer;

                if (hasChildren) {
                    itemArrowBtn = document.createElement("button");
                    itemArrowBtn.className = "tree-arrow";
                    itemArrowBtn.textContent = "▶";
                    item.appendChild(itemArrowBtn);

                    subContainer = document.createElement("div");
                    subContainer.className = "tree-sub-container";
                    subContainer.style.display = "none";
                    item.appendChild(subContainer);

                    itemArrowBtn.addEventListener("click", e => {
                        e.stopPropagation();
                        const expanded = subContainer.style.display === "block";
                        subContainer.style.display = expanded ? "none" : "block";
                        itemArrowBtn.textContent = expanded ? "▶" : "▼";
                    });
                }

                const text = document.createElement("span");
                text.className = "tree-item-name";
                text.textContent = name;
                item.appendChild(text);

                item.addEventListener("click", e => {
                    e.stopPropagation();

                    // ★ Explorerのアイテムと同じ呼び方に統一
                    // path = 親フォルダのパス（ルート基準）
                    openFSItem(name, child, path || "");

                    treePanel.style.display = "none";
                    arrowBtn.textContent = "▼";
                });


                if (hasChildren) buildTree(child, subContainer, fullPath, depth + 1);
            }
        }

        buildTree(FS, treePanel);
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

            item.addEventListener("dblclick", () => openFSItem(name, itemData, path));
        }

        // 右クリック
        const contentEl = root.querySelector(".content") || root.closest(".window")?.querySelector(".content");
        if (contentEl) {
            attachContextMenu(contentEl, (e) => {
                const items = [];
                items.push({
                    label: "新規フォルダ",
                    action: () => createNewFolder(currentPath, listContainer, () => render(currentPath))
                });

                if (e.target.classList.contains("explorer-item")) {
                    const targetName = e.target.textContent;
                    items.push({
                        label: "削除",
                        action: () => deleteFSItem(currentPath, targetName, () => render(currentPath))
                    });
                } else {
                    items.push({ label: "削除", disabled: true, action: () => { } });
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
