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
    confirmWindow
} from "./window.js";
import { showPromptScreen } from "./boot.js";
import { startup_sound } from "./sounds.js";
import { addRecent } from "./recent.js";
import { installDynamicButtonEffect } from "./ui.js";

// ★ fs-utils.js から堅牢なユーティリティを導入
import { resolveFS, basename, normalizePath } from "./fs-utils.js";

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
export async function launch(path, options = {}) {

    if (typeof path !== "string") {
        errorWindow(`無効なパス: ${path}`, { taskbar: false });
        return;
    }

    if (launching.has(path)) return;
    launching.add(path);

    try {
        // ★ 改善: kernel内のresolveをfs-utilsのresolveFSに置換（循環参照も自動解決）
        const item = resolveFS(path);
        if (!item) {
            errorWindow(`対象が見つかりません: ${path}`, { taskbar: false });
            return;
        }

        if (item.type === "link") {
            // リンク元の情報を originalNode として引き継ぐ
            return await launch(item.target, { ...options, originalNode: item });
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

        if (isExplorer)
            explorerWindows.delete(options.path || "Desktop");

        if (uniqueKey)
            processes.delete(uniqueKey);

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

            // item (ファイルの実体) を options として createWindow に渡す
            const content = createWindow(displayName, {
                // ショートカットならそのアイコン、直接起動ならそのファイルのアイコンを使う
                node: options.originalNode || item
            });

            // ★ contentから親ウィンドウ要素(.window)を確実に取得
            const win = content?.closest(".window");

            if (!win || !document.body.contains(win))
                throw new Error("Window creation failed");

            try {
                // ★ 非同期実行にも対応できるよう await を追加（維持）
                await appModule.default(content, options);
                if (typeof win._applyRealIcon === "function") {
                    win._applyRealIcon();
                }
            } catch (e) {
                console.error("app runtime error:", e);
                errorWindow(`アプリがクラッシュしました\n${e.message}`, { taskbar: false });
            }

            addRecent(path);

            const key =
                uniqueKey ?? `app:${path}:${Date.now()}`;

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

            /* ★ ゾンビプロセス防止 (MutationObserver 最適化版) (維持) */
            const observer = new MutationObserver(() => {
                if (!win.isConnected) {
                    if (isExplorer) explorerWindows.delete(options.path || "Desktop");
                    processes.delete(key);
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

            const mod =
                await safeImport("./apps/fileviewer.js");

            if (!mod?.default)
                throw new Error("fileviewer export missing");

            const content = createWindow(basename(path), { node: item });

            const win = content?.closest(".window");

            if (!win)
                throw new Error("Window creation failed");

            // ★ 非同期を考慮
            await mod.default(content, {
                name: basename(path),
                content: item.content
            });

            if (typeof win._applyRealIcon === "function") {
                win._applyRealIcon();
            }

            const key =
                options.uniqueKey ??
                `file:${path}:${Date.now()}`;

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
        console.error(err);
        errorWindow(
            `起動に失敗しました: ${path}\n${err.message}`,
            { taskbar: false }
        );
    } finally {
        // ★ ここが重要：エラーが発生しても必ず起動中フラグを解除する
        launching.delete(path);
        try { refreshStartMenu(); } catch { }
    }
}

// kernel.js 内の resolve は fs-utils.js の resolveFS に役目を譲りました

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
 * システムイベントに関連付けられた音声を再生する (維持)
 */
export function playSystemEventSound(eventName) {
    try {
        const configText = FS.System?.["SoundConfig.json"]?.content;
        const config = JSON.parse(configText || "{}");
        const filename = config[eventName];

        if (filename) {
            const file = FS.Programs?.Music?.[filename];
            if (file && file.content) {
                const audio = new Audio(file.content);
                audio.play().catch(err => {
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
        } else if (eventName === 'startup') {
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