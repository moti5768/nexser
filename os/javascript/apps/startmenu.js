// startmenu.js
import { FS } from "../fs.js";
import { getRecent, addRecent, removeRecent } from "../recent.js";
import { resolveFS, basename } from "../fs-utils.js";
import { resolveAppByPath, getIcon } from "../file-associations.js";
import { loadSetting } from "./settings.js";

const startBtn = document.getElementById("start-btn");

// グローバルな状態管理用 (スモールアイコン)
window.smallIcons = false;

/* =====================================================
   Start Menu Builder
===================================================== */
export async function buildStartMenu() {
    const menu = document.getElementById("start-menu");
    if (!menu) return;

    window.smallIcons = Boolean(await loadSetting("smallIcons"));
    window.showRecent = (await loadSetting("showRecentItems")) ?? true;

    menu.innerHTML = "";
    menu.classList.toggle("small-icons", window.smallIcons);

    const startMenuContainer = createMenu(FS["C:"].StartMenu, "C:/StartMenu", menu);
    if (startMenuContainer) {
        menu.appendChild(startMenuContainer);
    }

    // ログオフボタン (✨ 循環参照を防ぐため、動的インポートで kernel を取得)
    const logoffBtn = document.createElement("div");
    logoffBtn.className = "start-item danger";
    logoffBtn.textContent = "ログオフ";
    logoffBtn.style.marginTop = "8px";
    logoffBtn.onclick = async () => {
        try {
            const { logOff } = await import("../kernel.js");
            await logOff();
        } catch (e) {
            console.error("[StartMenu] Failed to log off:", e);
        }
        if (startBtn) startBtn.classList.remove("pressed");
        if (menu) menu.style.display = "none";
    };
    menu.appendChild(logoffBtn);

    // Recent (最近使った項目)
    if (window.showRecent !== false) {
        await buildRecentArea(menu);
    }

    // メニュー全体に対するクリックイベントの一括委譲
    if (!menu.dataset.listenerAttached) {
        menu.dataset.listenerAttached = "true";
        menu.addEventListener("click", async (e) => {
            const item = e.target.closest(".start-item");
            if (!item || item.classList.contains("empty") || item.classList.contains("danger")) return;

            e.stopPropagation();
            const fullPath = item.dataset.path;
            if (!fullPath) return;

            const rawNode = resolveFS(fullPath);
            if (!rawNode) return;

            // リンクの安全な解決
            let currentNode = rawNode;
            let currentPath = fullPath;
            const visited = new Set();

            while (currentNode && currentNode.type === "link" && typeof currentNode.target === "string") {
                if (visited.has(currentPath) || visited.size >= 10) {
                    console.warn(`[StartMenu] Circular or deep link detected: ${currentPath}`);
                    currentNode = null;
                    break;
                }
                visited.add(currentPath);
                currentPath = currentNode.target;
                currentNode = resolveFS(currentPath);
            }

            let runNode = currentNode;
            let runPath = currentPath;

            if (!runNode) {
                window.nexser?.windowAPI.confirmWindow(
                    `問題のあるショートカット\n\nこのショートカットが参照している '${runPath}' は変更または移動されているか、存在しないため、正しく機能しません。\n\nこのショートカットを削除しますか？`,
                    (result) => {
                        if (result) {
                            console.log(`ショートカットを削除します: ${fullPath}`);
                        }
                    },
                    { width: 400, overlay: true }
                );
                menu.style.display = "none";
                if (startBtn) startBtn.classList.remove("pressed");
                return;
            }

            const runType = runNode.type;
            // ✨ 起動処理も動的インポート化
            const { launch } = await import("../kernel.js");

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
                        const { openWithDialog } = await import("./explorer.js");
                        openWithDialog(runPath, runNode);
                    }
                    addRecent({ type: "file", path: runPath });
                    break;
                }
                case "folder":
                    launch("C:/Programs/Applications/Explorer.app", { path: runPath, uniqueKey: runPath });
                    addRecent({ type: "folder", path: runPath });
                    break;
            }

            menu.style.display = "none";
            if (startBtn) startBtn.classList.remove("pressed");
        });
    }
}

/* =====================================================
   Recursive Menu Generator (Optimized with Lazy Loading)
===================================================== */
function createMenu(folder, basePath, menuRoot, visitedPaths = new Set()) {
    if (visitedPaths.has(basePath) || visitedPaths.size > 20) {
        console.warn(`[StartMenu] Circular folder recursion detected: ${basePath}`);
        return null;
    }

    const container = document.createElement("div");
    container.className = "start-menu-level";

    if (window.smallIcons) container.classList.add("small");

    const currentVisited = new Set(visitedPaths);
    currentVisited.add(basePath);

    const fragment = document.createDocumentFragment();
    let hasItems = false;

    function resolveLinkSafely(startNode, startPath) {
        let currentNode = startNode;
        let currentPath = startPath;
        const visited = new Set();

        while (currentNode && currentNode.type === "link" && typeof currentNode.target === "string") {
            if (visited.has(currentPath) || visited.size >= 10) {
                console.warn(`[StartMenu] Circular or deep link detected: ${currentPath}`);
                return { node: null, path: currentPath };
            }
            visited.add(currentPath);
            currentPath = currentNode.target;
            currentNode = resolveFS(currentPath);
        }
        return { node: currentNode, path: currentPath };
    }

    for (const name in folder) {
        if (name === "type" || name === "system" || name === "lastModified") continue;

        const node = folder[name];
        if (node.hidden) continue;

        hasItems = true;

        const item = document.createElement("div");
        item.className = "start-item";

        const fullPath = `${basePath}/${name}`;
        item.dataset.path = fullPath;
        item.dataset.name = name;

        const iconSpan = document.createElement("span");
        iconSpan.className = "icon";

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

        const textSpan = document.createElement("span");
        textSpan.className = "text";
        textSpan.textContent = name;
        if (window.smallIcons) textSpan.style.fontSize = "11px";
        item.appendChild(textSpan);

        fragment.appendChild(item);

        const resolved = resolveLinkSafely(node, fullPath);
        const targetNode = resolved.node;
        const targetPath = resolved.path;

        const effectiveType = targetNode ? targetNode.type : "broken";

        if (effectiveType === "folder" && targetNode) {
            item.classList.add("has-children");

            const subContainer = document.createElement("div");
            subContainer.className = "start-menu-level submenu";
            if (window.smallIcons) subContainer.classList.add("small");
            subContainer.dataset.loaded = "false";
            item.appendChild(subContainer);

            setupHover(item, subContainer, () => {
                if (subContainer.dataset.loaded === "false") {
                    subContainer.dataset.loaded = "true";
                    const built = createMenu(targetNode, targetPath, menuRoot, currentVisited);
                    if (built) {
                        subContainer.appendChild(built);
                    }
                }
            });
        }
    }

    if (!hasItems) {
        const empty = document.createElement("div");
        empty.className = "start-item empty";
        empty.textContent = "(Empty)";
        fragment.appendChild(empty);
    }

    container.appendChild(fragment);
    return container;
}

/* =====================================================
   Hover helper / Recent Area / Launcher
===================================================== */
function setupHover(parent, submenu, onShow) {
    let hideTimer = null;
    const show = () => {
        clearTimeout(hideTimer);
        if (onShow) onShow();

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

    if (!node) {
        window.nexser?.windowAPI.confirmWindow(
            `ショートカット エラー\n\nこの項目 '${path}' は既に削除されたか、利用できません。\n\n「最近使った項目」から削除しますか？`,
            async (result) => {
                if (result) {
                    await removeRecent(path);
                }
            },
            { width: 400, overlay: true }
        );
        return;
    }

    let effectiveType = type === "link" ? node.type : type;
    const recentItem = { type: node.type, path: path, display: basename(path) };
    const { launch } = await import("../kernel.js");

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
                const { openWithDialog } = await import("./explorer.js");
                openWithDialog(path, node);
            }
            addRecent(recentItem);
            break;
        }
        case "folder":
            launch("C:/Programs/Applications/Explorer.app", { path, uniqueKey: path });
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

async function initSettings() {
    window.showRecent = (await loadSetting("showRecentItems")) ?? true;
    window.smallIcons = Boolean(await loadSetting("smallIcons"));
}

export async function startMenuReady() {
    initGlobalListeners();
    await initSettings();
    await buildStartMenu();
    updateStartMenuPosition();
}

function handleTaskbarStyleChanged(e) {
    if (e.detail.smallIcons !== undefined) {
        window.smallIcons = e.detail.smallIcons;
        refreshStartMenu();
    }
}

let listenersInitialized = false;

function initGlobalListeners() {
    if (listenersInitialized) return;
    listenersInitialized = true;

    window.addEventListener("fs-updated", refreshStartMenu);
    window.addEventListener("recent-updated", refreshStartMenu);
    window.addEventListener("request-start-menu-position-update", updateStartMenuPosition);
    window.addEventListener("request-refresh-start-menu", refreshStartMenu);
    window.addEventListener("taskbar-style-changed", handleTaskbarStyleChanged);
}

/* =====================================================
   Start Menu 位置更新（タスクバーの縦横判定および横方向展開対応版）
===================================================== */
export function updateStartMenuPosition() {
    const menu = document.getElementById("start-menu");
    const startBtn = document.getElementById("start-btn");
    const taskbar = document.getElementById("taskbar");
    if (!menu || !startBtn) return;

    // 非表示状態でも正確な幅・高さを取得できるよう一時的に可視化して計測
    requestAnimationFrame(() => {
        const wasHidden = menu.style.display === "none" || !menu.style.display;
        if (wasHidden) {
            menu.style.visibility = "hidden";
            menu.style.display = "block";
        }

        const menuWidth = menu.offsetWidth;
        const menuHeight = menu.offsetHeight;

        if (wasHidden) {
            menu.style.display = "none";
            menu.style.visibility = "";
        }

        const rect = startBtn.getBoundingClientRect();
        const margin = 6;
        menu.style.position = "fixed";

        let top = 0;
        let left = 0;

        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        // ★ タスクバーが縦配置（left / right）かどうかをクラスから確実に判定
        const isVertical = taskbar ? taskbar.classList.contains("vertical") : false;

        if (isVertical) {
            // タスクバーが左右にある場合：必ず「横方向（ボタンの左右）」に展開
            const isLeft = rect.left < screenWidth * 0.5;
            if (isLeft) {
                // タスクバーが左 -> スタートメニューはボタンの右側に表示
                left = rect.right + margin;
            } else {
                // タスクバーが右 -> スタートメニューはボタンの左側に表示
                left = rect.left - menuWidth - margin;
            }
            top = rect.top; // ボタンの上端に高さを合わせる
        } else {
            // タスクバーが上下にある場合：縦方向（ボタンの上下）に展開
            const isTop = rect.top < screenHeight * 0.5;
            if (isTop) {
                // タスクバーが上 -> スタートメニューはボタンの下に表示
                top = rect.bottom + margin;
            } else {
                // タスクバーが下 -> スタートメニューはボタンの上に表示
                top = rect.top - menuHeight - margin;
            }
            left = rect.left; // ボタンの左端に位置を合わせる
        }

        // 画面外にはみ出さないための最終安全補正
        if (left + menuWidth > screenWidth) {
            left = Math.max(margin, screenWidth - menuWidth - margin);
        }
        if (left < 0) {
            left = margin;
        }
        if (top + menuHeight > screenHeight) {
            top = Math.max(margin, screenHeight - menuHeight - margin);
        }
        if (top < 0) {
            top = margin;
        }

        menu.style.top = `${top}px`;
        menu.style.left = `${left}px`;
    });
}

window.addEventListener("resize", updateStartMenuPosition);
window.addEventListener("scroll", updateStartMenuPosition);

// ✨ カーネルからアプリとして呼び出された際のデフォルトエクスポートとクリーンアップ（dispose）
export default async function startMenuApp(content, options) {
    await startMenuReady();
    if (content) {
        content.style.display = "none";
    }

    return {
        isTabApp: false,
        dispose: () => {
            // スタートメニューを空にして隠す
            const menu = document.getElementById("start-menu");
            if (menu) {
                menu.innerHTML = "";
                menu.style.display = "none";
            }
        }
    };
}