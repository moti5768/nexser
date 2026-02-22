// startmenu.js
import { FS } from "./fs.js";
import { launch, logOff } from "./kernel.js";
import { getRecent, addRecent } from "./recent.js";
import { resolveFS } from "./fs-utils.js";
import { openDB } from "./db.js";
import { resolveAppByPath, getIcon } from "./file-associations.js";
import { basename } from "./fs-utils.js";
import { hasExtension } from "./apps/explorer.js";

const startBtn = document.getElementById("start-btn");
let recentListenerInstalled = false;

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
        if (startBtn) startBtn.classList.remove("pressed");  // ← nullチェック追加
        if (typeof closeStartMenu === "function") closeStartMenu();
        if (menu) menu.style.display = "none";
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

        const iconSpan = document.createElement("span");
        iconSpan.className = "icon";
        iconSpan.style.marginRight = "8px"; // アイコンと文字の間に少し隙間を
        iconSpan.textContent = getIcon(name, node);
        item.appendChild(iconSpan);

        // テキストラベルの作成
        const textSpan = document.createElement("span");
        textSpan.className = "text";
        textSpan.textContent = name;
        item.appendChild(textSpan);

        container.appendChild(item);

        const fullPath = `${basePath}/${name}`;
        const isFileByExt = hasExtension(name);
        const effectiveType = isFileByExt ? "file" : node.type;

        // ===== 起動可能アイテムの処理 (Desktop.js の openFSItem に準拠) =====
        if (["app", "link", "file"].includes(effectiveType)) {
            item.onclick = async () => { // ダイアログのインポートを待つため async
                let targetNode = node;
                let targetPath = fullPath;
                let currentType = targetNode.type;

                // 1. リンクの解決
                if (currentType === "link") {
                    targetPath = targetNode.target;
                    targetNode = resolveFS(targetPath);
                    if (!targetNode) return;
                    currentType = targetNode.type;
                }

                // 2. 名前に拡張子がある場合はフォルダでもファイルとして扱う
                if (currentType === "folder" && hasExtension(name)) {
                    currentType = "file";
                }

                // 3. 起動ロジック
                switch (currentType) {
                    case "app":
                        if (targetNode.shell) return;
                        launch(targetPath, { path: targetPath, uniqueKey: targetPath });
                        addRecent({ type: "app", path: targetPath });
                        break;

                    case "file": {
                        const appPath = resolveAppByPath(targetPath);
                        if (appPath) {
                            // 関連付けられたアプリで起動
                            launch(appPath, { path: targetPath, node: targetNode, uniqueKey: targetPath });
                        } else {
                            // Desktop.js 同様、Explorer のアプリ選択ダイアログを呼び出す
                            const { openWithDialog } = await import("./apps/explorer.js");
                            openWithDialog(targetPath, targetNode);
                        }
                        addRecent({ type: "file", path: targetPath });
                        break;
                    }

                    case "folder":
                        launch("Programs/Applications/Explorer.app", { path: targetPath, uniqueKey: targetPath });
                        addRecent({ type: "folder", path: targetPath });
                        break;

                    default:
                        console.warn("Unknown type:", currentType, targetPath);
                }

                // メニューを閉じ、ボタンの状態を戻す
                menuRoot.style.display = "none";
                const startBtn = document.getElementById("start-btn");
                if (startBtn) startBtn.classList.remove("pressed");
            };
        }

        // ===== フォルダ階層の展開（サブメニュー） =====
        if (effectiveType === "folder") {
            item.classList.add("has-children");

            const sub = createMenu(node, fullPath, menuRoot);
            sub.classList.add("submenu");
            item.appendChild(sub);

            setupHover(item, sub);
        }
    }

    // 空フォルダの場合の表示
    if (!hasItems) {
        const empty = document.createElement("div");
        empty.className = "start-item empty";
        empty.textContent = "(Empty)";
        container.appendChild(empty);
    }

    return container;
}

/* =====================================================
   Hover helper
===================================================== */
function setupHover(parent, submenu) {
    let hideTimer = null;
    let initialized = false;

    const show = () => {
        clearTimeout(hideTimer);
        submenu.style.display = "block";

        if (!initialized) {
            const rect = submenu.getBoundingClientRect();
            const viewportWidth = window.innerWidth;

            if (rect.right > viewportWidth) {
                submenu.style.left = `-${rect.width}px`;
            } else {
                submenu.style.left = "";
            }

            const viewportHeight = window.innerHeight;
            if (rect.bottom > viewportHeight) {
                const offset = rect.bottom - viewportHeight + 10;
                submenu.style.top = `-${offset}px`;
            } else {
                submenu.style.top = "";
            }

            initialized = true;
        }
    };

    const scheduleHide = () => {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
            submenu.style.display = "none";
        }, 200);
    };

    const isInside = el =>
        parent.contains(el) || submenu.contains(el);

    parent.addEventListener("mouseenter", show);
    submenu.addEventListener("mouseenter", show);

    parent.addEventListener("mouseleave", e => {
        if (!isInside(e.relatedTarget)) {
            scheduleHide();
        }
    });

    submenu.addEventListener("mouseleave", e => {
        if (!isInside(e.relatedTarget)) {
            scheduleHide();
        }
    });
}

/* =====================================================
   Recent Area
===================================================== */
async function buildRecentArea(root) {
    const existing = root.querySelectorAll(".start-recent");
    existing.forEach(el => el.remove());

    const box = document.createElement("div");
    box.className = "start-recent";

    const title = document.createElement("div");
    title.textContent = "最近使った項目";
    title.className = "start-recent-title";

    const list = document.createElement("div");
    list.className = "start-recent-list";

    let recent = await getRecent();

    // ★ 追加（重複防止）
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
async function launchByType(type, path) {
    if (!type || !path) return;

    // FS 内の node を取得
    let node = resolveFS(path);
    if (!node) {
        console.warn("FS に存在しないパス:", path);
        return;
    }

    // link は target の実体に置き換える
    let effectiveType = type;
    if (effectiveType === "link") {
        effectiveType = node.type;
    }

    // ユーザーが開いた FS 内 path を Recent 登録用に準備
    const recentItem = {
        type: node.type,
        path: path,
        display: basename(path)
    };

    switch (effectiveType) {
        case "app":
            if (node.shell) return;
            // Desktop と同様の起動引数
            launch(path, { path, uniqueKey: path });
            addRecent(recentItem);
            break;

        case "file": {
            const appPath = resolveAppByPath(path);
            if (appPath) {
                // 関連付けアプリがあれば起動
                launch(appPath, { path, node, uniqueKey: path });
            } else {
                // アプリがない場合は Explorer のアプリ選択ダイアログを表示
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

        default:
            console.warn("Unknown type:", effectiveType, path);
    }
}

/* =====================================================
   Refresh API
===================================================== */
let refreshTimer = null;
export function refreshStartMenu() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async () => {
        const menu = document.getElementById("start-menu");
        if (!menu) return;
        await buildStartMenu();
    }, 10);
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

/* =====================================================
   Start Menu 位置更新
===================================================== */
export function updateStartMenuPosition() {
    const menu = document.getElementById("start-menu");
    const startBtn = document.getElementById("start-btn");
    if (!menu || !startBtn) return;

    const rect = startBtn.getBoundingClientRect();
    const margin = 6; // ボタンとメニューの間の余白

    menu.style.position = "fixed";

    // 上に置く
    let top = rect.top - menu.offsetHeight - margin;
    let left = rect.left;

    // ボタンがメニューで隠れる場合は横にずらす（右方向優先）
    if (top < 0) {
        top = margin; // 上端に固定して、隠れないようにする
        left = rect.right + margin; // ボタンの右に表示
    }

    // 画面右端を超える場合は左方向に調整
    if (left + menu.offsetWidth > window.innerWidth) {
        left = Math.max(margin, window.innerWidth - menu.offsetWidth - margin);
    }

    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
}


// リサイズやスクロールでも更新
window.addEventListener("resize", updateStartMenuPosition);
window.addEventListener("scroll", updateStartMenuPosition);