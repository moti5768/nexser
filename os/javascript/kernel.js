/* kernel.js : OSの中枢 */

import { FS } from "./fs.js";
import { buildDesktop } from "./desktop.js";
import { buildStartMenu, refreshStartMenu } from "./startmenu.js";
import { initTaskbar } from "./taskbar.js";
import {
    createWindow,
    confirmWindow,
    scheduleRefreshTopWindow,
    removeAllTaskbarButtons,
    errorWindow
} from "./window.js";
import { nextZ } from "./zindex.js";
import { showPromptScreen } from "./boot.js";
import { startup_sound } from "./sounds.js";
import { addRecent } from "./recent.js";
import { installDynamicButtonEffect } from "./ui.js";
import { createWindow as _createWindow } from './window.js';

const explorerWindows = new Map();
const moduleCache = new Map();

/* ===== プロセス管理 ===== */
let pidCounter = 1;
const processes = new Map(); // path → process

/* ===== カーネル初期化 ===== */
export function initKernel() {
    console.log("kernel init");

    const root = document.getElementById("os-root");
    if (!root) {
        console.error("os-root not found");
        return;
    }

    root.innerHTML = `
        <div id="desktop"></div>
        <div id="taskbar">
            <button id="start-btn">Start</button>
        </div>
        <div id="start-menu"></div>
    `;

    startup_sound();
    buildDesktop();
    buildStartMenu();
    initTaskbar();
    installDynamicButtonEffect();
}

/* ===== ヘルパー: basename ===== */
export function basename(path) {
    if (!path) return "";
    const parts = path.split("/").filter(Boolean);
    return parts[parts.length - 1] || "";
}

/* ===== 起動API（全UI共通） ===== */
export async function launch(path, options = {}) {
    if (typeof path !== "string") {
        errorWindow(`無効なパス: ${path}`, { taskbar: false });
        return;
    }

    const item = resolve(path);
    if (!item) {
        errorWindow(`対象が見つかりません: ${path}`, { taskbar: false });
        return;
    }

    // link 解決
    if (item.type === "link") {
        return launch(item.target, options);
    }

    const isExplorer = item.type === "app" && item.entry?.includes("explorer.js");

    // 既存ウィンドウがある場合は前面化
    const getExistingWindow = () => {
        if (isExplorer) return explorerWindows.get(options.path || "Desktop") || null;
        if (item.singleton) return processes.get(path)?.window || null;
        return null;
    };
    const existingWin = getExistingWindow();
    if (existingWin && document.body.contains(existingWin)) {
        const taskbarBtn = existingWin._taskbarBtn;
        if (existingWin.dataset.minimized === "true") {
            taskbarBtn?.click();
        } else {
            existingWin.style.zIndex = nextZ();
            scheduleRefreshTopWindow();
        }
        return;
    }

    if (isExplorer) explorerWindows.delete(options.path || "Desktop");
    if (item.singleton) processes.delete(path);

    try {
        if (item.type === "app") {
            let appModule;
            if (moduleCache.has(item.entry)) appModule = moduleCache.get(item.entry);
            else {
                appModule = await import(item.entry);
                moduleCache.set(item.entry, appModule);
            }
            if (!appModule.default) throw new Error("アプリが正しくエクスポートされていません");

            const displayName = options.showFullPath ? path : item.name || basename(path);
            const content = createWindow(displayName);
            const win = content.parentElement;

            // Explorer には options.path を渡す
            appModule.default(content, options);

            // Recent に FS パス保存
            addRecent(path);

            if (item.singleton) {
                processes.set(path, { pid: pidCounter++, path, window: win, state: "normal" });
            }

            if (isExplorer) {
                const openPath = options.path || "Desktop";
                explorerWindows.set(openPath, win);

                if (win._observer) win._observer.disconnect();
                const observer = new MutationObserver(() => {
                    if (!document.body.contains(win)) {
                        explorerWindows.delete(openPath);
                        observer.disconnect();
                        win._observer = null;
                    }
                });
                win._observer = observer;
                observer.observe(document.body, { childList: true, subtree: true });
            }
        }

        else if (item.type === "file") {
            const entry = "./apps/fileviewer.js";
            let mod;
            if (moduleCache.has(entry)) mod = moduleCache.get(entry);
            else {
                mod = await import(entry);
                moduleCache.set(entry, mod);
            }
            if (!mod.default) throw new Error("ファイルビューアが正しくエクスポートされていません");

            const displayName = options.showFullPath ? path : basename(path);
            const content = createWindow(displayName);
            mod.default(content, { name: basename(path), content: item.content });
        }

        else if (item.type === "folder") {
            // フォルダの場合は Explorer.app を起動
            await launch("Programs/Explorer.app", { path, parentCwd: options.parentCwd });
        }

        else {
            throw new Error(`不明なタイプ: ${item.type}`);
        }
    } catch (err) {
        console.error(err);
        errorWindow(`起動に失敗しました: ${path}\n${err.message}`, { taskbar: false });
    }

    refreshStartMenu();
}


/* ===== 仮想パス解決 ===== */
function resolve(path) {
    if (typeof path !== "string") return null;

    // FS 内パス用に C:/ を削除
    let fsPath = path.replace(/^C:\//, "");
    const parts = fsPath.split("/").filter(Boolean);
    let cur = FS;

    for (const p of parts) {
        if (!cur) return null;
        cur = cur[p];
        if (!cur) return null;

        // link 解決
        if (cur.type === "link") {
            cur = resolve(cur.target);
            if (!cur) return null;
        }
    }
    return cur;
}

/* ===== UIリセット ===== */
export function resetUI() {
    document.querySelectorAll(".window").forEach(w => w.remove());
    removeAllTaskbarButtons();
    processes.clear();
    explorerWindows.clear();
}

/* ===== ログオフ ===== */
export async function logOff() {
    const windows = document.querySelectorAll(".window");
    const hasAnyWindow = windows.length > 0;

    const performLogoff = () => {
        document.querySelectorAll(".window").forEach(w => w.remove());
        processes.clear();
        explorerWindows.clear();
        showPromptScreen("nexser logoff");
    };

    if (hasAnyWindow) {
        confirmWindow(
            "開いているウィンドウがあります。すべて閉じてログオフしますか？",
            confirmed => confirmed && performLogoff(),
            { taskbar: false }
        );
    } else {
        performLogoff();
    }
}
