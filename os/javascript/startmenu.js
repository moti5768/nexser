// startmenu.js
import { FS } from "./fs.js";
import { launch, logOff } from "./kernel.js";
import { getRecent } from "./recent.js";
import { resolveFS } from "./fs-utils.js";
import { createWindow } from "./window.js";
import { openDB } from "./db.js"; // ← settings.js ではなく db.js から


const startBtn = document.getElementById("start-btn");
let recentListenerInstalled = false;

/* =====================================================
   Start Menu Builder
===================================================== */
export async function buildStartMenu() {
    const menu = document.getElementById("start-menu");
    menu.innerHTML = "";

    /* ===== Programs ===== */
    const programsRoot = document.createElement("div");
    programsRoot.className = "start-item has-children";
    programsRoot.textContent = "Programs";

    const programsMenu = createMenu(FS.Programs, "Programs", menu);
    programsMenu.classList.add("submenu");
    programsRoot.appendChild(programsMenu);

    let progHideTimer = null;
    const showPrograms = () => {
        clearTimeout(progHideTimer);
        programsMenu.style.display = "block";
    };
    const hidePrograms = () => {
        progHideTimer = setTimeout(() => {
            programsMenu.style.display = "none";
        }, 300);
    };

    programsRoot.addEventListener("mouseenter", showPrograms);
    programsRoot.addEventListener("mouseleave", hidePrograms);
    programsMenu.addEventListener("mouseenter", showPrograms);
    programsMenu.addEventListener("mouseleave", hidePrograms);

    menu.appendChild(programsRoot);

    /* ===== Separator ===== */
    const hr = document.createElement("div");
    hr.style.borderTop = "1px solid #333";
    hr.style.margin = "6px 0";
    menu.appendChild(hr);

    /* ===== Desktop ===== */
    const desktopMenu = createMenu(FS.Desktop, "Desktop", menu);
    menu.appendChild(desktopMenu);

    /* ===== Logoff ===== */
    const logoffBtn = document.createElement("div");
    logoffBtn.className = "start-item danger";
    logoffBtn.textContent = "ログオフ";
    logoffBtn.style.marginTop = "8px";
    logoffBtn.onclick = async () => {
        await logOff();
        startBtn.classList.remove("pressed");
        menu.style.display = "none";
    };
    menu.appendChild(logoffBtn);

    /* ===== Recent ===== */
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

    for (const name in folder) {
        if (name === "type") continue;

        const node = folder[name];
        const item = document.createElement("div");
        item.className = "start-item";
        item.textContent = name;
        container.appendChild(item);

        const fullPath = `${basePath}/${name}`;

        /* ---- Launchable items ---- */
        if (node.type === "app" || node.type === "link" || node.type === "file") {
            item.onclick = () => {
                let targetNode = node;
                let targetPath = fullPath;

                if (node.type === "link") {
                    targetPath = node.target;
                    targetNode = resolveFS(node.target);
                    if (!targetNode) return;
                }

                launchByType(targetNode?.type, targetPath);
                menuRoot.style.display = "none";
            };
        }

        /* ---- Folder ---- */
        if (node.type === "folder") {
            item.classList.add("has-children");

            const sub = createMenu(node, fullPath, menuRoot);
            sub.classList.add("submenu");
            item.appendChild(sub);

            let hideTimer = null;
            const showSub = () => clearTimeout(hideTimer) || (sub.style.display = "block");
            const hideSub = () => hideTimer = setTimeout(() => sub.style.display = "none", 200);

            item.addEventListener("mouseenter", showSub);
            item.addEventListener("mouseleave", hideSub);
            sub.addEventListener("mouseenter", showSub);
            sub.addEventListener("mouseleave", hideSub);
        }
    }

    return container;
}

/* =====================================================
   Recent Area
===================================================== */
async function buildRecentArea(root) {
    const existing = root.querySelector(".start-recent");
    if (existing) existing.remove();

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
    if (type && path) {
        import("./recent.js").then(m => m.addRecent({ type, path }));
    }
    switch (type) {
        case "app":
        case "file":
            launch(path);
            break;
        case "folder":
            launch("Programs/Explorer.app", { path });
            break;
        default:
            console.warn("Unknown recent item type:", type, path);
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

// モジュールロード時に一度だけ実行
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
        window.showRecent = val ?? true; // デフォルト true
    } catch {
        window.showRecent = true;
    }
}

/* =====================================================
   Start Menu 初期化用
   Settings の DB読み込み後に呼ぶ
===================================================== */
export async function startMenuReady() {
    await initShowRecent();
    await buildStartMenu();
}
