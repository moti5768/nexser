// startmenu.js
import { FS } from "./fs.js";
import { launch, logOff } from "./kernel.js";
import { getRecent, addRecent } from "./recent.js";
import { resolveFS } from "./fs-utils.js";
import { openDB } from "./db.js";
import { resolveAppByPath } from "./file-associations.js";
import {
    createWindow
} from "./window.js";
import { basename } from "./kernel.js";

const startBtn = document.getElementById("start-btn");
let recentListenerInstalled = false;

/* =====================================================
   Utils
===================================================== */
function hasExtension(name) {
    return /\.[a-z0-9]+$/i.test(name);
}

/* =====================================================
   Start Menu Builder
===================================================== */
export async function buildStartMenu() {
    const menu = document.getElementById("start-menu");
    if (!menu) return;
    menu.innerHTML = "";

    // Programs
    const programsRoot = document.createElement("div");
    programsRoot.className = "start-item has-children";
    programsRoot.textContent = "Programs";

    const programsMenu = createMenu(FS.Programs, "Programs", menu);
    programsMenu.classList.add("submenu");
    programsRoot.appendChild(programsMenu);

    setupHover(programsRoot, programsMenu);
    menu.appendChild(programsRoot);

    // Separator
    const hr = document.createElement("div");
    hr.style.borderTop = "1px solid #333";
    hr.style.margin = "6px 0";
    menu.appendChild(hr);

    // Desktop
    const desktopMenu = createMenu(FS.Desktop, "Desktop", menu);
    menu.appendChild(desktopMenu);

    // Logoff
    const logoffBtn = document.createElement("div");
    logoffBtn.className = "start-item danger";
    logoffBtn.textContent = "ログオフ";
    logoffBtn.style.marginTop = "8px";
    logoffBtn.onclick = async () => {
        await logOff();
        startBtn.classList.remove("pressed");
        closeStartMenu();
        menu.style.display = "none";
    };
    menu.appendChild(logoffBtn);

    // Recent
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

    let hasItems = false;

    for (const name in folder) {
        if (name === "type") continue;
        hasItems = true;

        const node = folder[name];
        const item = document.createElement("div");
        item.className = "start-item";
        item.textContent = name;
        container.appendChild(item);

        const fullPath = `${basePath}/${name}`;
        const isFileByExt = hasExtension(name);
        const effectiveType = isFileByExt ? "file" : node.type;

        // ===== 起動可能アイテム =====
        if (["app", "link", "file"].includes(effectiveType)) {
            item.onclick = () => {
                let targetNode = node;
                let targetPath = fullPath;
                let effectiveType = targetNode.type;

                // リンクの場合はリンク先の type に置き換える
                if (effectiveType === "link") {
                    targetPath = targetNode.target;
                    targetNode = resolveFS(targetPath);
                    if (!targetNode) return;
                    effectiveType = targetNode.type;
                }

                // 拡張子があれば folder でも file にする
                if (effectiveType === "folder" && hasExtension(name)) effectiveType = "file";

                switch (effectiveType) {
                    case "app":
                        launch(targetPath, { path: targetPath, uniqueKey: targetPath });
                        addRecent({ type: "app", path: targetPath });
                        break;

                    case "file": {
                        // ファイルはそのファイルだけ開く
                        const appPath = resolveAppByPath(targetPath);
                        if (appPath) {
                            launch(appPath, { path: targetPath, node: targetNode, uniqueKey: targetPath });
                        } else {
                            import("./apps/fileviewer.js").then(mod => {
                                const content = createWindow(name);
                                mod.default(content, { name, content: targetNode.content });
                            });
                        }
                        addRecent({ type: "file", path: targetPath });
                        break;
                    }

                    case "folder":
                        // フォルダだけ Explorer を開く（親階層は展開しない）
                        launch("Programs/Explorer.app", {
                            path: targetPath,
                            uniqueKey: targetPath,
                            showFullPath: false
                        });
                        addRecent({ type: "folder", path: targetPath });
                        break;

                    default:
                        console.warn("Unknown type:", effectiveType, targetPath);
                }

                menuRoot.style.display = "none";
            };

        }



        // ===== フォルダ（※拡張子が無い場合のみ）=====
        if (effectiveType === "folder") {
            item.classList.add("has-children");

            const sub = createMenu(node, fullPath, menuRoot);
            sub.classList.add("submenu");
            item.appendChild(sub);

            setupHover(item, sub);
        }
    }

    // 空フォルダの場合
    if (!hasItems) {
        const empty = document.createElement("div");
        empty.className = "start-item empty";
        empty.textContent = "(empty)";
        container.appendChild(empty);
    }

    return container;
}

/* =====================================================
   Hover helper
===================================================== */
function setupHover(parent, submenu) {
    let hideTimer = null;
    let initialized = false; // ← 追加: 一度だけ位置調整

    const show = () => {
        clearTimeout(hideTimer);
        submenu.style.display = "block";

        if (!initialized) {
            const rect = submenu.getBoundingClientRect();
            const viewportWidth = window.innerWidth;

            if (rect.right > viewportWidth) {
                // 右にはみ出す場合は左に表示
                submenu.style.left = `-${rect.width}px`;
            } else {
                submenu.style.left = ""; // デフォルト
            }

            const viewportHeight = window.innerHeight;
            if (rect.bottom > viewportHeight) {
                const offset = rect.bottom - viewportHeight + 10;
                submenu.style.top = `-${offset}px`;
            } else {
                submenu.style.top = "";
            }

            initialized = true; // 一度だけ計算
        }
    };

    const hide = () => hideTimer = setTimeout(() => submenu.style.display = "none", 200);

    parent.addEventListener("mouseenter", show);
    parent.addEventListener("mouseleave", hide);
    submenu.addEventListener("mouseenter", show);
    submenu.addEventListener("mouseleave", hide);
}


/* =====================================================
   Recent Area
===================================================== */
async function buildRecentArea(root) {
    // 複数存在する start-recent をすべて削除
    const existing = root.querySelectorAll(".start-recent");
    existing.forEach(el => el.remove());

    const box = document.createElement("div");
    box.className = "start-recent";

    const title = document.createElement("div");
    title.textContent = "最近使った項目";
    title.className = "start-recent-title";

    const list = document.createElement("div");
    list.className = "start-recent-list";

    const recent = await getRecent();

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

/* =====================================================
   Unified launcher
===================================================== */
function launchByType(type, path) {
    if (!type || !path) return;

    // FS 内の node を取得
    let node = resolveFS(path);
    if (!node) {
        console.warn("FS に存在しないパス:", path);
        return;
    }

    // link は target の type に置き換える
    if (type === "link") type = node.type;

    // ユーザーが開いた FS 内 path を Recent 登録用に準備
    const recentItem = {
        type: node.type,      // app/file/folder
        path,                 // FS 内の path
        display: basename(path)
    };

    switch (type) {
        case "app":
            launch(path, { path, uniqueKey: path });
            addRecent(recentItem); // FS 内の path を追加
            break;

        case "file": {
            const appPath = resolveAppByPath(path);
            if (appPath) {
                launch(appPath, { path, uniqueKey: path });
            } else {
                import("./apps/fileviewer.js").then(mod => {
                    const content = createWindow(basename(path));
                    mod.default(content, { name: basename(path), content: node.content || "" });
                });
            }
            addRecent(recentItem); // FS 内の path を追加（絶対に appPath ではない）
            break;
        }

        case "folder":
            launch("Programs/Explorer.app", { path, uniqueKey: path, showFullPath: true });
            addRecent(recentItem); // FS 内の path を追加
            break;

        default:
            console.warn("Unknown type:", type, path);
    }
}

/* =====================================================
   Refresh API
===================================================== */
export async function refreshStartMenu() {
    const menu = document.getElementById("start-menu");
    if (!menu) return;
    await buildStartMenu();
}

/* =====================================================
   Recent Listener
===================================================== */
function installRecentListener() {
    if (recentListenerInstalled) return;
    recentListenerInstalled = true;

    window.addEventListener("recent-updated", () => {
        refreshStartMenu();
    });
}
installRecentListener();

/* =====================================================
   DBから showRecent 読み込み
===================================================== */
async function initShowRecent() {
    try {
        const db = await openDB();
        const tx = db.transaction("settings", "readonly");
        const req = tx.objectStore("settings").get("showRecentItems");
        const val = await new Promise(resolve => {
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        });
        window.showRecent = val ?? true;
    } catch {
        window.showRecent = true;
    }
}

/* =====================================================
   Start Menu 初期化
===================================================== */
export async function startMenuReady() {
    await initShowRecent();
    await buildStartMenu();
}

function installFSListener() {
    window.addEventListener("fs-updated", () => {
        refreshStartMenu();
    });
}
installFSListener();
