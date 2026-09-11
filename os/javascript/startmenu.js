// startmenu.js
import { FS } from "./fs.js";
import { launch, logOff } from "./kernel.js";
import { confirmWindow } from "./window.js";
import { getRecent, addRecent, removeRecent } from "./recent.js";
import { resolveFS } from "./fs-utils.js";
import { resolveAppByPath, getIcon } from "./file-associations.js";
import { basename } from "./fs-utils.js";
import { hasExtension } from "./apps/explorer.js";
import { loadSetting } from "./apps/settings.js";

const startBtn = document.getElementById("start-btn");
let recentListenerInstalled = false;

// グローバルな状態管理用 (スモールアイコン)
window.smallIcons = false;

/* =====================================================
   Start Menu Builder
===================================================== */
export async function buildStartMenu() {
    window.smallIcons = (await loadSetting("smallIcons")) ?? false;
    window.showRecent = (await loadSetting("showRecentItems")) ?? true;

    const menu = document.getElementById("start-menu");
    if (!menu) return;
    menu.innerHTML = "";

    // 設定クラスの付与（CSSでの制御用）
    menu.classList.toggle("small-icons", window.smallIcons);

    // FSに定義されている StartMenu をルートとしてメニューを構築
    const startMenuContainer = createMenu(FS.StartMenu, "StartMenu", menu);
    while (startMenuContainer.firstChild) {
        menu.appendChild(startMenuContainer.firstChild);
    }

    // ログオフボタン
    const logoffBtn = document.createElement("div");
    logoffBtn.className = "start-item danger";
    logoffBtn.textContent = "ログオフ";
    logoffBtn.style.marginTop = "8px";
    logoffBtn.onclick = async () => {
        await logOff();
        if (startBtn) startBtn.classList.remove("pressed");
        if (menu) menu.style.display = "none";
    };
    menu.appendChild(logoffBtn);

    // Recent (最近使った項目)
    if (window.showRecent !== false) {
        await buildRecentArea(menu);
    }
}

/* =====================================================
   Recursive Menu Generator
===================================================== */
function createMenu(folder, basePath, menuRoot) {
    const container = document.createElement("div");
    container.className = "start-menu-level";

    // スモールアイコン時はコンテナにクラス付与
    if (window.smallIcons) container.classList.add("small");

    let hasItems = false;

    for (const name in folder) {
        if (name === "type" || name === "system" || name === "lastModified") continue;

        const node = folder[name];
        if (node.hidden) continue; // 隠しファイルを除外

        hasItems = true;

        const item = document.createElement("div");
        item.className = "start-item";

        const iconSpan = document.createElement("span");
        iconSpan.className = "icon";

        // スモールアイコン設定に応じてサイズを変更
        const iconSize = window.smallIcons ? "14px" : "18px";
        const marginSize = window.smallIcons ? "6px" : "8px";
        Object.assign(iconSpan.style, {
            fontSize: iconSize,
            marginRight: marginSize,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center"
        });

        iconSpan.textContent = getIcon(name, node);
        item.appendChild(iconSpan);

        // テキストラベルの作成
        const textSpan = document.createElement("span");
        textSpan.className = "text";
        textSpan.textContent = name;
        if (window.smallIcons) textSpan.style.fontSize = "11px";
        item.appendChild(textSpan);

        container.appendChild(item);

        const fullPath = `${basePath}/${name}`;

        // リンク先がフォルダである場合を考慮してタイプを解決
        let targetNode = node;
        let targetPath = fullPath;
        let currentType = node.type;

        if (currentType === "link") {
            targetPath = node.target;
            targetNode = resolveFS(targetPath);
            if (targetNode) {
                currentType = targetNode.type;
            } else {
                currentType = "broken-link";
            }
        }

        const effectiveType = (currentType === "folder")
            ? "folder"
            : ((node.type === "folder") ? "folder" : (hasExtension(name) ? "file" : currentType));

        // 起動可能アイテムの処理
        if (["app", "link", "file"].includes(effectiveType)) {
            item.onclick = async () => {
                let runNode = node;
                let runPath = fullPath;
                let runType = runNode.type;

                if (runType === "link") {
                    runPath = runNode.target;
                    runNode = resolveFS(runPath);
                    if (!runNode) {
                        confirmWindow(
                            `問題のあるショートカット\n\nこのショートカットが参照している '${runPath}' は変更または移動されているか、存在しないため、正しく機能しません。\n\nこのショートカットを削除しますか？`,
                            (result) => {
                                if (result) {
                                    console.log(`ショートカットを削除します: ${fullPath}`);
                                }
                            },
                            { width: 400, overlay: true }
                        );
                        menuRoot.style.display = "none";
                        if (startBtn) startBtn.classList.remove("pressed");
                        return;
                    }
                    runType = runNode.type;
                }

                switch (runType) {
                    case "app":
                        if (runNode.shell) return;
                        launch(runPath, { path: runPath, uniqueKey: runPath });
                        addRecent({ type: "app", path: runPath });
                        break;
                    case "file": {
                        const appPath = resolveAppByPath(runPath);
                        if (appPath) {
                            launch(appPath, { path: runPath, node: runNode, uniqueKey: runPath });
                        } else {
                            const { openWithDialog } = await import("./apps/explorer.js");
                            openWithDialog(runPath, runNode);
                        }
                        addRecent({ type: "file", path: runPath });
                        break;
                    }
                    case "folder":
                        launch("Programs/Applications/Explorer.app", { path: runPath, uniqueKey: runPath });
                        addRecent({ type: "folder", path: runPath });
                        break;
                }

                menuRoot.style.display = "none";
                if (startBtn) startBtn.classList.remove("pressed");
            };
        }

        // フォルダ（またはフォルダを指すリンク）の場合のサブメニュー展開
        if (effectiveType === "folder") {
            item.classList.add("has-children");
            const subFolderNode = (node.type === "link") ? targetNode : node;
            const subFolderPath = (node.type === "link") ? targetPath : fullPath;

            const sub = createMenu(subFolderNode, subFolderPath, menuRoot);
            sub.classList.add("submenu");
            item.appendChild(sub);
            setupHover(item, sub);
        }
    }

    if (!hasItems) {
        const empty = document.createElement("div");
        empty.className = "start-item empty";
        empty.textContent = "(Empty)";
        container.appendChild(empty);
    }

    return container;
}

/* =====================================================
   Hover helper / Recent Area / Launcher (維持)
===================================================== */
function setupHover(parent, submenu) {
    let hideTimer = null;
    const show = () => {
        clearTimeout(hideTimer);
        submenu.style.display = "block";
        submenu.style.left = "";
        submenu.style.top = "";

        const rect = submenu.getBoundingClientRect();
        const parentRect = parent.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (rect.right > viewportWidth) {
            submenu.style.left = `-${rect.width}px`;
            const newRect = submenu.getBoundingClientRect();
            if (newRect.left < 0) submenu.style.left = `-${parentRect.left}px`;
        }

        if (rect.bottom > viewportHeight) {
            const overflow = rect.bottom - viewportHeight;
            const safeOffset = Math.min(overflow + 10, parentRect.top);
            submenu.style.top = `-${safeOffset}px`;
        }
    };

    const scheduleHide = () => {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => { submenu.style.display = "none"; }, 200);
    };

    const isInside = el => parent.contains(el) || submenu.contains(el);
    parent.addEventListener("mouseenter", show);
    submenu.addEventListener("mouseenter", show);
    parent.addEventListener("mouseleave", e => { if (!isInside(e.relatedTarget)) scheduleHide(); });
    submenu.addEventListener("mouseleave", e => { if (!isInside(e.relatedTarget)) scheduleHide(); });
}

async function buildRecentArea(root) {
    const existing = root.querySelectorAll(".start-recent");
    existing.forEach(el => el.remove());

    const box = document.createElement("div");
    box.className = "start-recent";

    const title = document.createElement("div");
    title.textContent = "最近使った項目";
    title.className = "start-recent-title";
    if (window.smallIcons) title.style.fontSize = "10px";

    const list = document.createElement("div");
    list.className = "start-recent-list";

    let recent = await getRecent();
    const seen = new Set();
    recent = recent.filter(r => {
        if (seen.has(r.path)) return false;
        seen.add(r.path);
        return true;
    });

    if (!recent.length) {
        const empty = document.createElement("div");
        empty.textContent = "(なし)";
        empty.className = "start-recent-empty";
        list.appendChild(empty);
    } else {
        for (const item of recent) {
            const div = document.createElement("div");
            div.className = "start-recent-item";
            div.textContent = item.path;
            if (window.smallIcons) div.style.fontSize = "11px";
            div.onclick = () => {
                launchByType(item.type, item.path);
                root.style.display = "none";
            };
            list.appendChild(div);
        }
    }
    box.appendChild(title);
    box.appendChild(list);
    root.insertBefore(box, root.firstChild);
}

async function launchByType(type, path) {
    let node = resolveFS(path);

    // ★ノードが存在しない（リンク切れなど）の場合はエラーダイアログを出す
    if (!node) {
        confirmWindow(
            `ショートカット エラー\n\nこの項目 '${path}' は既に削除されたか、利用できません。\n\n「最近使った項目」から削除しますか？`,
            async (result) => {
                if (result) {
                    // 実際に履歴から削除する
                    await removeRecent(path);
                }
            },
            { width: 400, overlay: true }
        );
        return;
    }

    let effectiveType = type === "link" ? node.type : type;
    const recentItem = { type: node.type, path: path, display: basename(path) };

    switch (effectiveType) {
        case "app":
            if (node.shell) return;
            launch(path, { path, uniqueKey: path });
            addRecent(recentItem);
            break;
        case "file": {
            const appPath = resolveAppByPath(path);
            if (appPath) launch(appPath, { path, node, uniqueKey: path });
            else {
                const { openWithDialog } = await import("./apps/explorer.js");
                openWithDialog(path, node);
            }
            addRecent(recentItem);
            break;
        }
        case "folder":
            launch("Programs/Applications/Explorer.app", { path, uniqueKey: path });
            addRecent(recentItem);
            break;
    }
}

/* =====================================================
   Refresh & Settings Listener
===================================================== */
let refreshTimer = null;
export function refreshStartMenu() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async () => {
        await buildStartMenu();
        updateStartMenuPosition();
    }, 10);
}

// タスクバープロパティからの設定変更をリッスン
window.addEventListener("taskbar-style-changed", (e) => {
    if (e.detail.smallIcons !== undefined) {
        window.smallIcons = e.detail.smallIcons;
        refreshStartMenu();
    }
});

/* =====================================================
   初期化ロジック
===================================================== */
async function initSettings() {
    window.showRecent = (await loadSetting("showRecentItems")) ?? true;
    window.smallIcons = (await loadSetting("smallIcons")) ?? false;
}

export async function startMenuReady() {
    await initSettings();
    await buildStartMenu();
}

window.addEventListener("fs-updated", refreshStartMenu);
window.addEventListener("recent-updated", refreshStartMenu);

/* =====================================================
   Start Menu 位置更新
===================================================== */
export function updateStartMenuPosition() {
    const menu = document.getElementById("start-menu");
    const startBtn = document.getElementById("start-btn");
    if (!menu || !startBtn) return;

    const rect = startBtn.getBoundingClientRect();
    const margin = 6;
    menu.style.position = "fixed";

    let top = rect.top - menu.offsetHeight - margin;
    let left = rect.left;

    if (top < 0) {
        top = margin;
        left = rect.right + margin;
    }

    if (left + menu.offsetWidth > window.innerWidth) {
        left = Math.max(margin, window.innerWidth - menu.offsetWidth - margin);
    }

    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
}

window.addEventListener("resize", updateStartMenuPosition);
window.addEventListener("scroll", updateStartMenuPosition);