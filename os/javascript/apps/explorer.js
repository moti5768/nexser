// Explorer.js
import { launch } from "../kernel.js";
import { createWindow } from "../window.js";
import { resolveFS } from "../fs-utils.js";
import { FS, initFS } from "../fs.js";
import { buildDesktop } from "../desktop.js";
import { attachContextMenu } from "../context-menu.js";
import { resolveAppByPath } from "../file-associations.js";
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

        folderNode[finalName] = { type: "folder" };

        renderCallback?.();
        buildDesktop();
        window.dispatchEvent(new Event("fs-updated"));
    };

    input.addEventListener("blur", finishEditing);
    input.addEventListener("keydown", e => { if (e.key === "Enter") finishEditing(); });
}

// ------------------------
// メイン関数
// ------------------------
export default async function Explorer(root, options = {}) {
    const win = root.closest(".window");
    const titleEl = win?.querySelector(".title-text");
    const taskBtn = win?._taskbarBtn;

    await initFS();

    let currentPath = options.path || "Desktop";

    const render = (path) => {
        currentPath = path;
        updateTitle(path);

        let listContainer = root.querySelector(".explorer-list");
        let pathLabel = root.querySelector(".path-label");

        if (!listContainer) {
            root.innerHTML = `
                <div class="explorer-header">
                    <button id="back-btn">&larr;</button>
                    <span class="path-label"></span>
                </div>
                <div class="explorer-list scrollbar_none"></div>
            `;
            listContainer = root.querySelector(".explorer-list");
            pathLabel = root.querySelector(".path-label");
        }

        if (pathLabel) pathLabel.textContent = currentPath;
        listContainer.innerHTML = "";

        const folder = resolveFS(path);
        if (!folder) return;

        // ------------------------
        // 各アイテム描画
        // ------------------------
        for (const name in folder) {
            if (name === "type") continue;
            const itemData = folder[name];

            const item = document.createElement("div");
            item.textContent = name;
            item.className = "explorer-item";
            listContainer.appendChild(item);

            const fullPath = `${path}/${name}`;

            item.addEventListener("dblclick", () => {
                let targetNode = itemData;
                let targetPath = fullPath;

                if (itemData.type === "link") {
                    targetPath = itemData.target;
                    targetNode = resolveFS(targetPath);
                    if (!targetNode) return;
                }

                let effectiveType = targetNode.type;
                if (effectiveType === "folder" && hasExtension(name)) effectiveType = "file";

                switch (effectiveType) {
                    case "app":
                        launch(targetPath, { path: targetPath, uniqueKey: targetPath });
                        break;
                    case "folder":
                        currentPath = targetPath;
                        render(currentPath);
                        break;
                    case "file": {
                        const appPath = resolveAppByPath(targetPath);
                        if (appPath) {
                            launch(appPath, { path: targetPath, node: targetNode, uniqueKey: targetPath });
                        } else {
                            import("../apps/fileviewer.js").then(mod => {
                                const content = createWindow(name);
                                mod.default(content, { name, content: targetNode.content });
                            });
                        }
                        break;
                    }
                }

                addRecent({ type: effectiveType, path: targetPath });
            });
        }

        // ------------------------
        // コンテント右クリックメニュー
        // ------------------------
        const contentEl = root.querySelector(".content") || root.closest(".window")?.querySelector(".content");
        if (contentEl) {
            attachContextMenu(contentEl, (e) => {
                const items = [];

                // 常に新規フォルダ
                items.push({
                    label: "新規フォルダ",
                    action: () => createNewFolder(currentPath, listContainer, () => render(currentPath))
                });

                // 削除はアイテム上でのみ有効
                if (e.target.classList.contains("explorer-item")) {
                    const targetName = e.target.textContent;
                    items.push({
                        label: "削除",
                        action: () => deleteFSItem(currentPath, targetName, () => render(currentPath))
                    });
                } else {
                    items.push({
                        label: "削除",
                        disabled: true,
                        action: () => { }
                    });
                }

                return items;
            });
        }

        // 戻るボタン
        const backBtn = root.querySelector("#back-btn");
        backBtn.onclick = () => {
            if (currentPath === "Desktop") return;
            const parts = currentPath.split("/");
            parts.pop();
            currentPath = parts.join("/") || "Desktop";
            render(currentPath);
        };

        // ステータスバー更新
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

    // Ribbon メニュー設定
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
        },
        {
            title: "Edit", items: [
                { label: "Cut", action: () => { } },
                { label: "Copy", action: () => { } },
                { label: "Paste", action: () => { } }
            ]
        },
        {
            title: "View", items: [
                { label: "Icons", action: () => { } },
                { label: "List", action: () => { } },
                { label: "Details", action: () => { } }
            ]
        }
    ];

    // setupRibbon 呼び出し
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
