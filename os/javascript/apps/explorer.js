// explorer.js
import { launch } from "../kernel.js";
import { createWindow } from "../window.js";
import { resolveFS, normalizePath } from "../fs-utils.js";
import { addRecent } from "../recent.js";
import { refreshStartMenu } from "../startmenu.js";

export default function Explorer(root, options = {}) {

    const win = root.closest(".window");
    const titleEl = win?.querySelector(".title-text");
    const taskBtn = win?._taskbarBtn;

    let currentPath = options.path || "Desktop";

    const render = (path) => {
        updateTitle(path);
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

            let clickTimer = null;
            item.addEventListener("click", () => {
                if (clickTimer) {
                    clearTimeout(clickTimer);
                    clickTimer = null;

                    // リンク解決
                    let targetNode = itemData;
                    let targetPath = `${path}/${name}`;
                    if (itemData.type === "link") {
                        targetPath = itemData.target;
                        targetNode = resolveFS(targetPath);
                        if (!targetNode) return;
                    }

                    // タイプ別処理
                    switch (targetNode.type) {

                        case "app":
                            launch(targetPath);
                            addRecent({ type: "app", path: targetPath });
                            break;

                        case "folder":
                            currentPath = targetPath;
                            render(currentPath);
                            addRecent({ type: "folder", path: targetPath });
                            break;

                        case "file":
                            import("../apps/fileviewer.js").then(mod => {
                                const content = createWindow(name);
                                mod.default(content, { name, content: targetNode.content });
                            });
                            addRecent({ type: "file", path: targetPath });
                            break;

                        default:
                            console.warn("不明なタイプ:", targetNode.type);
                            break;
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
    };

    render(currentPath);

    function updateTitle(path) {
        if (!win) return;

        const name = path.split("/").pop() || path;

        // タイトルバー
        if (titleEl) {
            titleEl.textContent = name;
        }

        // タスクバー
        if (taskBtn) {
            taskBtn.textContent = name;
            taskBtn.dataset.title = name; // （あれば同期）
        }

        // window自身の管理データも更新（API用）
        win.dataset.title = name;
    }


}

