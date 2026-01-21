// Explorer.js
import { launch } from "../kernel.js";
import { createWindow } from "../window.js";
import { resolveFS } from "../fs-utils.js";
import { FS, initFS } from "../fs.js";
import { buildDesktop } from "../desktop.js";
import { attachContextMenu } from "../context-menu.js"; // 右クリック用

export default async function Explorer(root, options = {}) {
    const win = root.closest(".window");
    const titleEl = win?.querySelector(".title-text");
    const taskBtn = win?._taskbarBtn;

    // 起動時に IndexedDB から FS を読み込み
    await initFS();

    let currentPath = options.path || "Desktop";

    const render = (path) => {
        currentPath = path;
        updateTitle(path);

        // HTML描画
        root.innerHTML = `
            <div class="explorer-header">
                <button id="back-btn">&larr;</button>
                <span class="path-label">${path}</span>
            </div>
            <div class="explorer-list scrollbar_none"></div>
        `;

        const list = root.querySelector(".explorer-list");
        const folder = resolveFS(path);
        if (!folder) return;

        for (const name in folder) {
            if (name === "type") continue;
            const itemData = folder[name];

            const item = document.createElement("div");
            item.textContent = name;
            item.className = "explorer-item";
            list.appendChild(item);

            const fullPath = `${path}/${name}`;

            // 右クリックメニューで削除
            attachContextMenu(item, () => [{
                label: "削除",
                action: () => {
                    const parentNode = resolveFS(path);
                    if (!parentNode) return;

                    delete parentNode[name]; // Proxy で自動保存
                    render(path);            // Explorer 再描画
                    buildDesktop();          // デスクトップ更新
                    window.dispatchEvent(new Event("fs-updated"));
                }
            }]);

            // 左クリック処理
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

                    switch (targetNode.type) {
                        case "app":
                            launch(targetPath);
                            break;
                        case "folder":
                            currentPath = targetPath;
                            render(currentPath);
                            break;
                        case "file":
                            import("../apps/fileviewer.js").then(mod => {
                                const content = createWindow(name);
                                mod.default(content, { name, content: targetNode.content });
                            });
                            break;
                        default:
                            console.warn("不明なタイプ:", targetNode.type);
                    }
                } else {
                    clickTimer = setTimeout(() => {
                        clearTimeout(clickTimer);
                        clickTimer = null;
                    }, 250);
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

    render(currentPath);
    setupRibbon(win, () => currentPath, render);


    function updateTitle(path) {
        if (!win) return;
        const name = path.split("/").pop() || path;
        if (titleEl) titleEl.textContent = name;
        if (taskBtn) {
            taskBtn.textContent = name;
            taskBtn.dataset.title = name;
        }
        win.dataset.title = name;
    }
}

// リボン設定
function setupRibbon(win, getCurrentPath, renderCallback) {
    if (!win?._ribbon) return;
    const ribbon = win._ribbon;
    ribbon.innerHTML = "";

    // 新規フォルダ
    const newFolderBtn = document.createElement("button");
    newFolderBtn.textContent = "新規フォルダ";
    newFolderBtn.onclick = () => {
        const folderName = prompt("新しいフォルダ名を入力");
        if (!folderName) return;

        const currentPath = getCurrentPath();       // 最新の階層を取得
        const folderNode = resolveFS(currentPath);
        if (!folderNode) return;

        folderNode[folderName] = { type: "folder" }; // Proxyで自動保存

        renderCallback(currentPath);  // 最新の階層で再描画
        buildDesktop();               // デスクトップ更新
        window.dispatchEvent(new Event("fs-updated"));
    };
    ribbon.appendChild(newFolderBtn);
}