// desktop.js
import { FS } from "./fs.js";
import { launch } from "./kernel.js";
import { createWindow } from "./window.js";
import { resolveFS, normalizePath } from "./fs-utils.js";
import { addRecent } from "./recent.js";
import { attachContextMenu } from "./context-menu.js";

/**
 * デスクトップアイコンを生成・更新
 */
export function buildDesktop() {
    let desktop = document.getElementById("desktop");
    if (!desktop) return;

    // アイコンコンテナを取得、なければ作る
    let iconsContainer = document.getElementById("desktop-icons");
    if (!iconsContainer) {
        iconsContainer = document.createElement("div");
        iconsContainer.id = "desktop-icons";
        desktop.appendChild(iconsContainer);
    }
    iconsContainer.innerHTML = ""; // アイコンだけ初期化

    function createIcon(name, itemData, parentPath = "Desktop") {
        const item = document.createElement("div");
        item.className = "icon";
        item.textContent = name;
        iconsContainer.appendChild(item);

        const fullPath = `${parentPath}/${name}`;

        // 右クリックメニュー
        attachContextMenu(item, () => [{
            label: "削除",
            action: () => {
                const parentNode = resolveFS(parentPath);
                if (!parentNode) return;
                delete parentNode[name]; // Proxy で自動保存
                buildDesktop();
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
                    targetNode = resolveFS(itemData.target);
                    if (!targetNode) return;
                }

                switch (targetNode.type) {
                    case "app":
                        launch(targetPath);
                        addRecent({ type: "app", path: targetPath });
                        break;
                    case "folder":
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
