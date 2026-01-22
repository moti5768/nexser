// Explorer.js
import { launch } from "../kernel.js";
import { createWindow } from "../window.js";
import { resolveFS } from "../fs-utils.js";
import { FS, initFS } from "../fs.js";
import { buildDesktop } from "../desktop.js";
import { attachContextMenu } from "../context-menu.js";
import { resolveAppByPath } from "../file-associations.js";

function hasExtension(name) {
    return /\.[a-z0-9]+$/i.test(name);
}

export default async function Explorer(root, options = {}) {
    const win = root.closest(".window");
    const titleEl = win?.querySelector(".title-text");
    const taskBtn = win?._taskbarBtn;

    await initFS();

    let currentPath = options.path || "Desktop";

    const render = (path) => {
        currentPath = path;
        updateTitle(path);

        // Explorer リスト部分だけ描画
        let listContainer = root.querySelector(".explorer-list");
        if (!listContainer) {
            root.innerHTML = `
                <div class="explorer-header">
                    <button id="back-btn">&larr;</button>
                    <span class="path-label">${path}</span>
                </div>
                <div class="explorer-list scrollbar_none"></div>
            `;
            listContainer = root.querySelector(".explorer-list");
        }
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

            const fullPath = `${path}/${name}`;

            attachContextMenu(item, () => [{
                label: "削除",
                action: () => {
                    const parentNode = resolveFS(path);
                    if (!parentNode) return;

                    delete parentNode[name];
                    render(path);
                    buildDesktop();
                    window.dispatchEvent(new Event("fs-updated"));
                }
            }]);

            let clickTimer = null;
            item.addEventListener("click", () => {
                if (clickTimer) {
                    clearTimeout(clickTimer);
                    clickTimer = null;

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
                } else {
                    clickTimer = setTimeout(() => { clearTimeout(clickTimer); clickTimer = null; }, 250);
                }
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

    // Ribbon メニュー
    const ribbonMenus = [
        {
            title: "Window", items: [
                { label: "Minimize", action: () => win.querySelector(".min-btn")?.click() },
                { label: "Maximize", action: () => win.querySelector(".max-btn")?.click() },
                { label: "Close", action: () => win.querySelector(".close-btn")?.click() }
            ]
        },
        {
            title: "File", items: [{
                label: "Newfolder", action: () => {
                    const folderName = prompt("新しいフォルダ名");
                    if (!folderName) return;
                    const folderNode = resolveFS(currentPath);
                    folderNode[folderName] = hasExtension(folderName) ? { type: "file", content: "" } : { type: "folder" };
                    render(currentPath);
                    buildDesktop();
                    window.dispatchEvent(new Event("fs-updated"));
                }
            }]
        },
        { title: "Edit", items: [{ label: "Cut", action: () => { } }, { label: "Copy", action: () => { } }, { label: "Paste", action: () => { } }] },
        { title: "View", items: [{ label: "Icons", action: () => { } }, { label: "List", action: () => { } }, { label: "Details", action: () => { } }] }
    ];

    setupRibbon(win, () => currentPath, render, ribbonMenus);
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


// リボン設定関数
export function setupRibbon(win, getCurrentPath, renderCallback, menus) {
    if (!win?._ribbon) return;
    const ribbon = win._ribbon;
    ribbon.innerHTML = "";

    const defaultMenus = [
        {
            title: "Window", items: [
                { label: "Minimize", action: () => win.querySelector(".min-btn")?.click() },
                { label: "Maximize", action: () => win.querySelector(".max-btn")?.click() },
                { label: "Close", action: () => win.querySelector(".close-btn")?.click() }
            ]
        }
    ];

    (menus || defaultMenus).forEach(menu => addRibbonMenu(ribbon, menu.title, menu.items));
}

// 共通関数
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
