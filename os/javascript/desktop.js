// desktop.js
import { FS } from "./fs.js";
import { launch } from "./kernel.js";
import { createWindow } from "./window.js";
import { resolveFS } from "./fs-utils.js";
import { addRecent } from "./recent.js";
import { attachContextMenu } from "./context-menu.js";
import { resolveAppByPath } from "./file-associations.js";

/**
 * デスクトップアイコンを生成・更新
 */
export function buildDesktop() {
    const desktop = document.getElementById("desktop");
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

        // 右クリックメニュー（削除を追加）
        attachContextMenu(item, (e) => [{
            label: "削除",
            action: () => {
                const parentNode = resolveFS(parentPath);
                if (!parentNode) return;
                delete parentNode[name]; // Proxy で自動保存
                buildDesktop();
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
                    targetNode = resolveFS(itemData.target);
                    if (!targetNode) return;
                }

                switch (targetNode.type) {
                    case "app":
                        launch(targetPath, { path: targetPath, uniqueKey: targetPath });
                        addRecent({ type: "app", path: targetPath });
                        break;
                    case "folder":
                        launch("Programs/Explorer.app", { path: targetPath, uniqueKey: targetPath });
                        addRecent({ type: "app", path: targetPath });
                        break;
                    case "file": {
                        const appPath = resolveAppByPath(targetPath);
                        if (appPath) {
                            launch(appPath, {
                                path: targetPath,
                                node: targetNode,
                                uniqueKey: targetPath
                            });
                            addRecent({ type: "app", path: appPath });
                        } else {
                            import("./apps/fileviewer.js").then(mod => {
                                const content = createWindow(name);
                                mod.default(content, { name, content: targetNode.content });
                            });
                            addRecent({ type: "app", path: targetPath });
                        }
                        break;
                    }
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

    // =========================
    // デスクトップ右クリックメニュー（空白クリック用）
    // =========================
    attachContextMenu(desktop, (e) => {
        // window 内をクリックした場合は何も出さない
        if (e.target.closest(".window")) return [];

        const desktopNode = resolveFS("Desktop");
        if (!desktopNode) return [];

        const items = [];

        // 新規フォルダ
        items.push({
            label: "新規フォルダ",
            action: () => {
                let folderName = "新しいフォルダ";
                let counter = 1;
                while (desktopNode[folderName]) {
                    folderName = `新しいフォルダ (${counter++})`;
                }

                // DOM に仮アイコンだけ作成
                const iconDiv = document.createElement("div");
                iconDiv.className = "icon";
                const iconsContainer = document.getElementById("desktop-icons");
                iconsContainer.appendChild(iconDiv);

                const input = document.createElement("input");
                input.type = "text";
                input.value = folderName;
                input.style.width = "100px";
                input.style.fontSize = "13px";
                input.style.textAlign = "center";
                iconDiv.appendChild(input);
                input.focus();
                input.select();

                // 入力完了時の処理
                function finishEditing() {
                    if (!desktopNode) return;
                    iconDiv.remove();

                    let newName = input.value.trim() || folderName;

                    // FS に名前が重複していれば自動調整
                    let finalName = newName;
                    let idx = 1;
                    while (desktopNode[finalName]) {
                        finalName = `${newName} (${idx++})`;
                    }

                    const isFile = /\.[a-z0-9]+$/i.test(finalName);

                    desktopNode[finalName] = isFile
                        ? { type: "file", content: "" }
                        : { type: "folder" };

                    buildDesktop();
                    window.dispatchEvent(new Event("fs-updated"));
                }

                input.addEventListener("blur", finishEditing);
                input.addEventListener("keydown", e => {
                    if (e.key === "Enter") finishEditing();
                });
            }
        });

        // デスクトップ上のアイコンに対する削除（選択していれば）
        items.push({
            label: "削除",
            disabled: !e.target.classList.contains("icon"),
            action: () => {
                const targetName = e.target.textContent;
                if (!desktopNode[targetName]) return;

                delete desktopNode[targetName];
                buildDesktop();
                window.dispatchEvent(new Event("fs-updated"));
            }
        });

        return items;
    });
}

// =========================
// FS変更イベント監視（★追加）
// =========================

let desktopInitialized = false;

function installDesktopWatcher() {
    if (desktopInitialized) return;
    desktopInitialized = true;

    window.addEventListener("fs-updated", () => {
        buildDesktop();
    });
}

installDesktopWatcher();
