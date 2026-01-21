// desktop.js
import { FS } from "./fs.js";
import { launch } from "./kernel.js";
import { createWindow } from "./window.js";
import { resolveFS } from "./fs-utils.js";
import { addRecent } from "./recent.js";

export function buildDesktop() {
    const desktop = document.getElementById("desktop");
    desktop.innerHTML = ""; // 初期化

    function createIcon(name, itemData, parentPath = "Desktop") {
        const item = document.createElement("div");
        item.className = "icon";
        item.textContent = name;
        desktop.appendChild(item);

        let clickTimer = null;
        item.addEventListener("click", () => {
            if (clickTimer) {
                clearTimeout(clickTimer);
                clickTimer = null;

                const fullPath = `${parentPath}/${name}`;

                // リンク解決
                let targetNode = itemData;
                let targetPath = fullPath;

                if (itemData.type === "link") {
                    targetPath = itemData.target;
                    targetNode = resolveFS(itemData.target);
                    if (!targetNode) return;
                }

                // タイプ別処理
                switch (targetNode.type) {
                    case "app":
                        launch(targetPath);
                        addRecent({ type: "app", path: targetPath });
                        break;
                    case "folder":
                        // フォルダは Explorer で開く
                        launch("Programs/Explorer.app", { path: targetPath });
                        addRecent({ type: "app", path: targetPath });
                        break;
                    case "file":
                        import("./apps/fileviewer.js").then(mod => {
                            const content = createWindow(name);
                            mod.default(content, { name, content: targetNode.content });
                        });
                        addRecent({ type: "app", path: targetPath });
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

    // デスクトップ直下のアイコンを生成
    for (const name in FS.Desktop) {
        if (name === "type") continue;
        createIcon(name, FS.Desktop[name]);
    }
}