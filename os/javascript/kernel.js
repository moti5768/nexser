/* kernel.js : OSの中枢 */
import { FS } from "./fs.js";
import { buildDesktop } from "./desktop.js";
import { buildStartMenu, refreshStartMenu } from "./startmenu.js";
import { initTaskbar } from "./taskbar.js";
import {
    createWindow,
    removeAllTaskbarButtons,
    errorWindow,
    bringToFront,
    confirmWindow,
    destroyWindow
} from "./window.js";
import { showPromptScreen } from "./boot.js";
import { startup_sound } from "./sounds.js";
import { addRecent } from "./recent.js";
import { installDynamicButtonEffect } from "./ui.js";
import { resolveFS, basename } from "./fs-utils.js";
import { resolveAppByPath } from "./file-associations.js";

const explorerWindows = new Map();
const moduleCache = new Map();
const importLocks = new Map();        // ★ import競合防止 (維持)
const launching = new Set();          // ★ 起動レース防止 (維持)

let pidCounter = 1;
const processes = new Map();

/* =========================
   Metrics（CPU / Memory）
========================= */

let cpuLoad = 0;
let lastTick = performance.now();

// イベントループ負荷からCPU近似値を計測
setInterval(() => {
    const now = performance.now();
    const lag = now - lastTick - 1000;
    lastTick = now;
    cpuLoad = Math.max(0, Math.min(100, lag * 2));
}, 1000);

function getMemoryMB() {
    // ★ performance.memory が無い環境（Chrome以外）へのガードを追加 (維持)
    const mem = (performance && performance.memory) ? performance.memory.usedJSHeapSize : 0;
    return Math.round(mem / 1024 / 1024);
}

/* =========================
   安全 import（競合防止付き）
========================= */
async function safeImport(entry) {
    if (moduleCache.has(entry)) return moduleCache.get(entry);
    if (importLocks.has(entry)) return importLocks.get(entry);

    const promise = (async () => {
        try {
            const mod = await import(entry);
            moduleCache.set(entry, mod);
            return mod;
        } catch (e) {
            console.error("import failed:", entry, e);
            throw new Error(`module load failed: ${entry}`);
        } finally {
            importLocks.delete(entry);
        }
    })();

    importLocks.set(entry, promise);
    return promise;
}

/* ===== カーネル初期化 ===== */
export async function initKernelAsync(progressCallback = () => { }) {
    const root = document.getElementById("os-root");
    if (!root) throw new Error("os-root not found");

    progressCallback("Initializing kernel...");

    // 1. 構造の注入
    root.innerHTML = `
        <div id="desktop"></div>
        <div id="taskbar">
            <button id="start-btn">Start</button>
        </div>
        <div id="start-menu"></div>
    `;

    // ★追加：ブラウザが上記HTMLを認識し、高さを計算できるよう一拍置く
    await new Promise(r => requestAnimationFrame(r));

    progressCallback("UI containers created...");

    // 2. デスクトップ構築
    // desktop.js 内の requestAnimationFrame と相まって、正確な位置に配置されます
    buildDesktop();

    progressCallback("Desktop built...");
    buildStartMenu();

    progressCallback("Start Menu built...");

    // 3. タスクバー初期化
    initTaskbar();

    progressCallback("Taskbar initialized...");

    // 4. エフェクト適用
    // 引数に root を渡すことで、再起動時のクリーンアップを確実にします
    installDynamicButtonEffect();

    progressCallback("UI effects applied...");

    progressCallback("Kernel initialization complete!");
}

/* =========================
   起動API（完全安定版）
========================= */
// kernel.js の上部（関数の外）に配置
const tabAppInstances = new Map(); // appEntryPath -> { win, handle }

export async function launch(path, options = {}) {
    let win = null;
    if (typeof path !== "string") {
        errorWindow(`無効なパス: ${path}`, { taskbar: false });
        return;
    }

    if (launching.has(path)) return;
    launching.add(path);

    try {
        const item = resolveFS(path);
        if (!item) {
            errorWindow(`対象が見つかりません: ${path}`, { taskbar: false });
            return;
        }

        if (item.type === "link") {
            launching.delete(path);
            return await launch(item.target, { ...options, originalNode: item });
        }

        /* ================= タブ対応アプリのチェック ================= */
        // すでにこのアプリ(item.entry)が起動しており、かつタブ形式をサポートしている場合
        if (item.type === "app" && item.entry && tabAppInstances.has(item.entry)) {
            const instance = tabAppInstances.get(item.entry);
            if (document.body.contains(instance.win)) {
                bringToFront(instance.win);
                if (instance.win.dataset.minimized === "true") {
                    instance.win._taskbarBtn?.click();
                }

                // アプリ側のハンドルに新しいファイルを開くよう指示
                if (instance.handle && typeof instance.handle.openNewTab === 'function') {
                    // options.path (開く対象ファイル) があればそれを渡す
                    instance.handle.openNewTab(options.path || path);
                    return; // 新規起動せずに終了
                }
            } else {
                tabAppInstances.delete(item.entry); // ウィンドウが消えていれば登録解除
            }
        }

        const isExplorer =
            item.type === "app" &&
            item.entry?.includes("explorer.js");

        const uniqueKey =
            options.uniqueKey ?? (item.singleton ? path : null);

        let existingWin = null;
        if (isExplorer)
            existingWin = explorerWindows.get(options.path || "Desktop") || null;
        else if (uniqueKey)
            existingWin = processes.get(uniqueKey)?.window || null;

        if (existingWin && document.body.contains(existingWin)) {
            if (existingWin.dataset.minimized === "true")
                existingWin._taskbarBtn?.click();
            else
                bringToFront(existingWin);
            return;
        }

        if (isExplorer) explorerWindows.delete(options.path || "Desktop");
        if (uniqueKey) processes.delete(uniqueKey);

        /* ================= APP ================= */
        if (item.type === "app") {
            const appModule = await safeImport(item.entry);
            if (!appModule?.default)
                throw new Error("アプリが正しくエクスポートされていません");

            const displayName =
                options?.path
                    ? basename(options.path)
                    : (options.showFullPath
                        ? path
                        : item.name || basename(path));

            const content = createWindow(displayName, {
                node: options.originalNode || item
            });

            win = content?.closest(".window");
            if (!win || !document.body.contains(win))
                throw new Error("Window creation failed");

            try {
                // ★ アプリの戻り値（ハンドル）を受け取る
                const appHandle = await appModule.default(content, options);

                // タブ対応アプリであれば登録
                if (appHandle && appHandle.isTabApp) {
                    tabAppInstances.set(item.entry, { win, handle: appHandle });
                }

                if (typeof win._applyRealIcon === "function") {
                    win._applyRealIcon();
                }
            } catch (e) {
                console.error("app runtime error:", e);
                errorWindow(`アプリがクラッシュしました\n${e.message}`, { taskbar: false });
                throw e;
            }

            addRecent(path);

            const key = uniqueKey ?? `app:${path}:${Date.now()}`;
            const pid = pidCounter++;

            processes.set(key, {
                pid,
                path,
                window: win,
                state: "normal",
                startTime: performance.now(),
                memory: 0,
                cpu: 0
            });

            win.dataset.processKey = key;

            const observer = new MutationObserver(() => {
                if (!win.isConnected) {
                    if (isExplorer) explorerWindows.delete(options.path || "Desktop");
                    processes.delete(key);
                    // ウィンドウが閉じられたらタブ管理からも削除
                    if (item.entry) tabAppInstances.delete(item.entry);
                    observer.disconnect();
                    win._observer = null;
                }
            });

            win._observer = observer;
            const container = document.getElementById("desktop") || document.body;
            observer.observe(container, { childList: true });

            if (isExplorer) {
                explorerWindows.set(options.path || "Desktop", win);
            }
        }

        /* ================= FILE ================= */
        else if (item.type === "file") {
            // file-associations から起動すべきアプリを取得
            const appPath = resolveAppByPath(path);
            if (appPath) {
                // ファイルを開く場合は、そのアプリを「そのファイルパスを引数にして」起動する
                launching.delete(path);
                return await launch(appPath, { ...options, path: path });
            }

            // 対応アプリがない場合のフォールバック（fileviewer）
            const mod = await safeImport("./apps/fileviewer.js");
            if (!mod?.default) throw new Error("fileviewer export missing");

            const content = createWindow(basename(path), { node: item });
            win = content?.closest(".window");
            if (!win) throw new Error("Window creation failed");

            await mod.default(content, {
                name: basename(path),
                content: item.content
            });

            if (typeof win._applyRealIcon === "function") {
                win._applyRealIcon();
            }

            const key = options.uniqueKey ?? `file:${path}:${Date.now()}`;
            const pid = pidCounter++;

            processes.set(key, {
                pid,
                path,
                window: win,
                state: "normal",
                startTime: performance.now(),
                memory: 0,
                cpu: 0
            });

            win.dataset.processKey = key;

            const observer = new MutationObserver(() => {
                if (!win.isConnected) {
                    processes.delete(key);
                    observer.disconnect();
                }
            });
            win._observer = observer;
            const container = document.getElementById("desktop") || document.body;
            observer.observe(container, { childList: true });
        }

        /* ================= FOLDER ================= */
        else if (item.type === "folder") {
            await launch("Programs/Applications/Explorer.app", {
                path,
                parentCwd: options.parentCwd,
                ribbonMenus: options.ribbonMenus,
                showFullPath: options.showFullPath
            });
        }
        else {
            throw new Error(`不明なタイプ: ${item.type}`);
        }

    } catch (err) {
        console.error("Launch error:", err);
        if (win) destroyWindow(win);
        errorWindow(`起動に失敗しました: ${path}\n${err.message}`, { taskbar: false });
    } finally {
        launching.delete(path);
        try { refreshStartMenu(); } catch { }
    }
}


/* =========================
   Process metrics updater
========================= */

setInterval(() => {
    const mem = getMemoryMB();

    for (const proc of processes.values()) {
        proc.memory = mem;
        proc.cpu = cpuLoad;
    }
}, 1000);


/* ===== プロセス一覧 ===== */
export function getProcessList() {
    return Array.from(processes.entries())
        .map(([key, proc]) => {

            const win = proc.window;

            let zIndex = "";
            let minimized = false;
            let x = "";
            let y = "";
            let w = "";
            let h = "";

            if (win && document.body.contains(win)) {

                const rect = win.getBoundingClientRect();

                zIndex = getComputedStyle(win).zIndex || "";
                minimized = win.dataset.minimized === "true";

                x = Math.round(rect.left);
                y = Math.round(rect.top);
                w = Math.round(rect.width);
                h = Math.round(rect.height);
            }

            return {
                key,
                pid: proc.pid,
                path: proc.path,
                name: basename(proc.path),
                state: proc.state,
                window: win,
                memory: proc.memory,
                cpu: proc.cpu,
                uptime: Math.floor((performance.now() - proc.startTime) / 1000),

                zIndex,
                minimized,
                x,
                y,
                width: w,
                height: h
            };
        });
}

/* =========================
   killProcess（完全安全版） (維持)
========================= */
export function killProcess(key) {

    const proc = processes.get(key);
    if (!proc) return false;

    const win = proc.window;

    try {
        if (win?._cleanup) win._cleanup();

        if (win?._observer)
            win._observer.disconnect();

        if (win?._taskbarBtn?.remove)
            win._taskbarBtn.remove();

        if (win?.remove)
            win.remove();
    } catch (e) {
        console.warn("window remove failed:", e);
    }

    for (const [path, w] of explorerWindows.entries()) {
        if (w === win) {
            explorerWindows.delete(path);
            break;
        }
    }

    processes.delete(key);
    return true;
}

/* ===== UIリセット ===== */
export function resetUI() {

    try {
        document.querySelectorAll(".window")
            .forEach(w => {
                const key = w.dataset.processKey;
                if (key) {
                    killProcess(key);
                } else {
                    try {
                        if (w._observer) w._observer.disconnect();
                        w.remove();
                    } catch { }
                }
            });

        removeAllTaskbarButtons();

        processes.clear();
        explorerWindows.clear();
    } catch { }
}

/* ===== ログオフ (維持) ===== */
export async function logOff() {
    const windows = document.querySelectorAll(".window");
    const hasAnyWindow = windows.length > 0;

    const performLogoff = () => {
        playSystemEventSound('logoff');
        resetUI();
        moduleCache.clear();
        showPromptScreen("nexser logoff");
    };

    if (hasAnyWindow) {
        confirmWindow(
            "開いているウィンドウがあります。すべて閉じてログオフしますか？",
            (result) => {
                if (result) performLogoff();
            },
            {
                width: 380,
                overlay: true
            },
        );
    } else {
        performLogoff();
    }
}

/**
 * FSに保存された音声データを再生する (維持)
 */
export function playSavedAudio(filename) {
    const file = FS.Programs?.Music?.[filename];
    if (file && file.content) {
        const audio = new Audio(file.content);
        audio.play().catch(console.error);
    }
}
/**
 * システムイベントに関連付けられた音声を再生する (維持 + 外部データ取得対応)
 */
export async function playSystemEventSound(eventName) {
    try {
        const configText = FS.System?.["SoundConfig.json"]?.content;
        const config = JSON.parse(configText || "{}");
        const filename = config[eventName];

        if (filename) {
            const file = FS.Programs?.Music?.[filename];
            if (file) {
                let audioData = file.content;

                // ★ 追加: 外部DBに保存されている実データを取得する
                if (audioData === "__EXTERNAL_DATA__") {
                    const { getFileContent } = await import("./fs-db.js");
                    audioData = await getFileContent(`Programs/Music/${filename}`);
                }

                if (audioData) {
                    const audio = new Audio(audioData);
                    audio.play().catch(err => {
                        // オートプレイ制限 (NotAllowedError) への対処を維持
                        if (err.name === "NotAllowedError") {
                            const playOnGesture = () => {
                                audio.play();
                                document.removeEventListener("click", playOnGesture);
                                document.removeEventListener("keydown", playOnGesture);
                            };
                            document.addEventListener("click", playOnGesture);
                            document.addEventListener("keydown", playOnGesture);
                        }
                    });
                }
            }
        } else if (eventName === 'startup') {
            // startup_sound のフォールバックロジックを維持
            try {
                startup_sound();
            } catch (e) {
                const playBeepOnGesture = () => {
                    startup_sound();
                    document.removeEventListener("click", playBeepOnGesture);
                    document.removeEventListener("keydown", playBeepOnGesture);
                };
                document.addEventListener("click", playBeepOnGesture);
                document.addEventListener("keydown", playBeepOnGesture);
            }
        }
    } catch (e) {
        console.warn("Sound event failed", e);
    }
}