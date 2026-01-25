/* kernel.js : OSの中枢 */

import { FS } from "./fs.js";
import { buildDesktop } from "./desktop.js";
import { buildStartMenu, refreshStartMenu } from "./startmenu.js";
import { initTaskbar } from "./taskbar.js";
import {
    createWindow,
    removeAllTaskbarButtons,
    errorWindow,
    showModalWindow,
    bringToFront
} from "./window.js";
import { showPromptScreen } from "./boot.js";
import { startup_sound } from "./sounds.js";
import { addRecent } from "./recent.js";
import { installDynamicButtonEffect } from "./ui.js";

const explorerWindows = new Map(); // path → window
const moduleCache = new Map();
let pidCounter = 1;
const processes = new Map(); // uniqueKey → { pid, path, window, state }

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
    if (item.type === "link") return launch(item.target, options);

    const isExplorer = item.type === "app" && item.entry?.includes("explorer.js");

    // 重複防止用キーを決定
    const uniqueKey = options.uniqueKey ?? (item.singleton ? path : null);

    // 既存ウィンドウチェック
    let existingWin = null;
    if (isExplorer) existingWin = explorerWindows.get(options.path || "Desktop") || null;
    else if (uniqueKey) existingWin = processes.get(uniqueKey)?.window || null;

    if (existingWin && document.body.contains(existingWin)) {
        const taskbarBtn = existingWin._taskbarBtn;
        if (existingWin.dataset.minimized === "true") {
            taskbarBtn?.click();
        } else {
            bringToFront(existingWin);
        }
        return;
    }

    if (isExplorer) explorerWindows.delete(options.path || "Desktop");
    if (uniqueKey) processes.delete(uniqueKey);

    try {
        if (item.type === "app") {
            let appModule;
            if (moduleCache.has(item.entry)) appModule = moduleCache.get(item.entry);
            else {
                appModule = await import(item.entry);
                moduleCache.set(item.entry, appModule);
            }
            if (!appModule.default) throw new Error("アプリが正しくエクスポートされていません");

            const displayName =
                options?.path
                    ? basename(options.path)
                    : (options.showFullPath ? path : item.name || basename(path));

            const content = createWindow(displayName);
            const win = content.parentElement;

            appModule.default(content, options); // アプリ起動

            addRecent(path);

            // processes マップに登録
            if (uniqueKey) {
                processes.set(uniqueKey, { pid: pidCounter++, path, window: win, state: "normal" });
            }

            // Explorer 用オブザーバー
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

            // ファイルビューアも uniqueKey で重複防止可能
            if (options.uniqueKey) {
                processes.set(options.uniqueKey, { pid: pidCounter++, path, window: content.parentElement, state: "normal" });
            }
        }

        // フォルダの場合は Explorer を起動（リボン付き）
        else if (item.type === "folder") {
            const displayName = options.showFullPath ? path : basename(path);

            // Explorer を起動
            await launch("Programs/Explorer.app", {
                path,                   // Explorer 内で currentPath として使用
                parentCwd: options.parentCwd,
                ribbonMenus: options.ribbonMenus, // Explorer.js で使用
                showFullPath: options.showFullPath
            });
        } else throw new Error(`不明なタイプ: ${item.type}`);
    } catch (err) {
        console.error(err);
        errorWindow(`起動に失敗しました: ${path}\n${err.message}`, { taskbar: false });
    }

    refreshStartMenu();
}

/* ===== 仮想パス解決 ===== */
function resolve(path) {
    if (typeof path !== "string") return null;

    let fsPath = path.replace(/^C:\//, "");
    const parts = fsPath.split("/").filter(Boolean);
    let cur = FS;

    for (const p of parts) {
        if (!cur) return null;
        cur = cur[p];
        if (!cur) return null;

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
        // モーダル表示
        showModalWindow("ログオフ確認",
            "開いているウィンドウがあります。すべて閉じてログオフしますか？",
            {
                width: 360,
                height: 140,
                taskbar: false,
                buttons: [
                    { label: "はい", onClick: performLogoff },
                    { label: "いいえ", onClick: null }
                ]
            }
        );
    } else {
        performLogoff();
    }
}
