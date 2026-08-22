/* kernel.js : OSの中枢 */
import { FS } from "./fs.js";
import { buildDesktop } from "./desktop.js";
import { buildStartMenu, refreshStartMenu } from "./startmenu.js";
import { initTaskbar } from "./taskbar.js";
import { showBSOD } from "./bsod.js";
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
   BSOD管理
========================= */
const CRITICAL_PREFIXES = ["BOOT_", "KERNEL_", "FS_", "0x"];
function isCriticalError(msg) {
    return CRITICAL_PREFIXES.some(prefix => String(msg).includes(prefix));
}

export function initSystemErrorHandler() {
    // 非同期エラー（Promise拒否）
    window.addEventListener("unhandledrejection", (e) => {
        const error = e.reason;
        const msg = error?.message || String(error);

        // ★ 非同期側でも重大なエラーのときだけBSODにする
        if (isCriticalError(msg)) {
            showBSOD(`KERNEL_UNHANDLED_REJECTION: ${msg}`, error);
        } else {
            console.warn("[Kernel Notice] Non-critical unhandled rejection:", msg);
        }
    });

    // 通常のエラー
    window.addEventListener("error", (e) => {
        const msg = e.error ? e.error.message : e.message;
        if (isCriticalError(msg)) {
            showBSOD(`KERNEL_FAULT: ${msg}`, e.error);
        } else {
            console.warn("[Kernel Notice] Non-critical exception caught:", msg);
        }
    });
}
/* =========================
   Metrics（CPU / Memory）
========================= */

let cpuLoad = 0;
let lastTick = performance.now();

// イベントループ負荷からCPU近似値を計測
setInterval(() => {
    const now = performance.now();
    const diff = now - lastTick;
    lastTick = now;

    // 【修正】タブがバックグラウンドに回った際のタイマー遅延（スロットリング）を除外
    // 1000ms間隔のタイマーが2000ms以上遅れた場合はブラウザによる意図的な遅延とみなす
    if (diff > 2000) {
        cpuLoad = 0; // OSの高負荷による遅延ではないため0にリセット
    } else {
        const lag = Math.max(0, diff - 1000);
        cpuLoad = Math.min(100, Math.round((lag / 1000) * 100));
    }
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

    const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 10000)
    );

    const promise = (async () => {
        try {
            // タイムアウト付きでインポート
            const mod = await Promise.race([import(entry), timeout]);
            moduleCache.set(entry, mod);
            return mod;
        } catch (e) {
            console.error("import failed:", entry, e);
            throw e;
        } finally {
            importLocks.delete(entry); // 失敗しても成功してもロックは外す
        }
    })();

    importLocks.set(entry, promise);
    return promise;
}

/* ===== カーネル初期化 (最新・最適化版) ===== */
export async function initKernelAsync(progressCallback = () => { }) {
    const root = document.getElementById("os-root");
    if (!root) throw new Error("os-root not found");
    initSystemErrorHandler();
    // 1. 基本構造の注入
    // 描画コストを下げるため、まずは最小限のHTMLを流し込む
    progressCallback("Initializing kernel structure...");
    root.innerHTML = `
        <div id="desktop"></div>
        <div id="taskbar">
            <button id="start-btn">Start</button>
        </div>
        <div id="start-menu"></div>
    `;

    // ブラウザにDOMの反映とレイアウト計算の隙を与える（バックグラウンド処理化の肝）
    await new Promise(r => requestAnimationFrame(r));

    // 2. デスクトップ構築
    // buildDesktop() が内部でアイコン配置などを行う際の計算時間を確保
    progressCallback("Building Desktop icons and layout...");
    buildDesktop();
    await new Promise(r => requestAnimationFrame(r));

    // 3. スタートメニュー構築
    progressCallback("Preparing Start Menu...");
    buildStartMenu();
    // ここで一瞬待機を入れることで、メニューの重なり等の計算を安定させる
    await new Promise(r => setTimeout(r, 0));

    // 4. タスクバー初期化
    progressCallback("Initializing Taskbar...");
    initTaskbar();
    await new Promise(r => requestAnimationFrame(r));

    // 5. UIエフェクトの適用
    // ボタンの動的エフェクトなどは最後に適用し、操作可能になったことを示す
    progressCallback("Applying dynamic UI effects...");
    installDynamicButtonEffect();

    // 全てのレンダリングが完了するまで一拍置く
    await new Promise(r => requestAnimationFrame(r));

    // ==========================================
    // 【追加】ブート時の自動システムスキャン (破損検知のお知らせ)
    // ==========================================
    progressCallback("Scanning system integrity...");
    try {
        // 先ほど fs.js に作った診断関数を動的に読み込む
        const { diagnoseAndCleanFS } = await import("./fs.js");
        const report = await diagnoseAndCleanFS(false); // 起動時はチェックのみ(false)

        // もし System や Desktop が壊れていたら警告を出す
        if (report.corruptionDetected) {
            // kernel.js 内にあるエラー音再生を呼び出す
            playSystemEventSound('error');

            // window.js からインポートされている errorWindow でデスクトップにお知らせ
            errorWindow(
                "【システム診断】\nシステムファイルの破損または消失を検出しました。\n\n一部の重要なフォルダが正常に読み込めない状態です。\n設定アプリ (Settings.app) の「System」タブから「Run Cleanup & Repair」を実行して修復してください。",
                { title: "システム整合性チェック", taskbar: true }
            );
        }
    } catch (e) {
        console.warn("Boot-time system scan failed:", e);
    }
    // ==========================================

    progressCallback("Kernel initialization complete!");
}

/* =========================
   起動API（リファクタリング版）
========================= */
const tabAppInstances = new Map();

export async function launch(path, options = {}) {
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

        // タイプごとに処理を専用関数へ委譲してスッキリさせる
        switch (item.type) {
            case "link":
                return await launchLink(item, path, options);
            case "app":
                return await launchApp(item, path, options);
            case "file":
                return await launchFile(item, path, options);
            case "folder":
                return await launchFolder(item, path, options);
            default:
                throw new Error(`不明なタイプ: ${item.type}`);
        }

    } catch (err) {
        console.error("Launch error:", err);
        errorWindow(`起動に失敗しました: ${path}\n${err.message}`, { taskbar: false });
    } finally {
        launching.delete(path);
        try { refreshStartMenu(); } catch { }
    }
}

/* --- 1. リンク起動の処理 --- */
async function launchLink(item, path, options) {
    const targetItem = resolveFS(item.target);
    if (!targetItem) {
        confirmWindow(
            `問題のあるショートカット\n\nこのショートカットが参照している '${item.target}' は存在しません。\nこのショートカットを削除しますか？`,
            (result) => {
                if (result) console.log(`ショートカットを削除します: ${path}`);
            },
            { width: 400, overlay: true }
        );
        return;
    }
    // ロック解除は外側の launch() の finally に任せるため、ここでは削除しない
    return await launch(item.target, { ...options, originalNode: item });
}

/* --- 2. フォルダ起動の処理 --- */
async function launchFolder(item, path, options) {
    return await launch("Programs/Applications/Explorer.app", {
        path,
        parentCwd: options.parentCwd,
        ribbonMenus: options.ribbonMenus,
        showFullPath: options.showFullPath
    });
}

/* --- 3. ファイル起動の処理 --- */
async function launchFile(item, path, options) {
    const appPath = resolveAppByPath(path);
    if (appPath) {
        // 早期のロック解除はせず、外側の launch() の finally に任せるため削除
        return await launch(appPath, { ...options, path: path });
    }

    const mod = await safeImport("./apps/fileviewer.js");
    if (!mod?.default) throw new Error("fileviewer export missing");

    const content = createWindow(basename(path), { node: item });
    const win = content?.closest(".window");
    if (!win) throw new Error("Window creation failed");

    try {
        await mod.default(content, { name: basename(path), content: item.content });
        if (typeof win._applyRealIcon === "function") win._applyRealIcon();
    } catch (e) {
        // ★ ファイルビューアの初期化エラー時に中途半端なウィンドウを破棄する
        if (typeof destroyWindow === "function" && win) {
            destroyWindow(win);
        }
        throw e; // 上位の catch に委譲してエラーWindowを表示させる
    }

    registerProcess(win, options.uniqueKey ?? `file:${path}:${Date.now()}`, path, null);
}

/* --- 4. アプリ起動の処理 --- */
async function launchApp(item, path, options) {
    // タブ対応アプリのチェック
    if (item.entry && tabAppInstances.has(item.entry)) {
        const instance = tabAppInstances.get(item.entry);
        if (document.body.contains(instance.win)) {
            bringToFront(instance.win);
            if (instance.win.dataset.minimized === "true") instance.win._taskbarBtn?.click();
            if (instance.handle?.openNewTab) {
                instance.handle.openNewTab(options.path || path);
                return;
            }
        } else {
            tabAppInstances.delete(item.entry);
        }
    }

    const isExplorer = item.entry?.includes("explorer.js");
    const uniqueKey = options.uniqueKey ?? (item.singleton ? path : null);
    let existingWin = isExplorer ? explorerWindows.get(options.path || "Desktop") : (uniqueKey ? processes.get(uniqueKey)?.window : null);

    if (existingWin && document.body.contains(existingWin)) {
        if (existingWin.dataset.minimized === "true") existingWin._taskbarBtn?.click();
        else bringToFront(existingWin);
        return;
    }

    if (isExplorer) explorerWindows.delete(options.path || "Desktop");
    if (uniqueKey) processes.delete(uniqueKey);

    let appModule;
    if (item.code) {
        try {
            const cleanCode = item.code.replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '');
            const executableCode = cleanCode
                .replace(/export\s+default\s+async\s+function/, 'window.__tempAppExport = async function')
                .replace(/export\s+default\s+function/, 'window.__tempAppExport = function');

            const { FS, forceSave } = await import("./fs.js");
            const { resolveFS } = await import("./fs-utils.js");
            const { updateWindowTitle, showModalWindow } = await import("./window.js");
            const { getFileContent } = await import("./fs-db.js");

            const runScript = new Function(
                'FS', 'forceSave', 'resolveFS', 'updateWindowTitle', 'showModalWindow', 'getFileContent',
                executableCode
            );
            runScript(FS, forceSave, resolveFS, updateWindowTitle, showModalWindow, getFileContent);

            appModule = { default: window.__tempAppExport };
            window.__tempAppExport = undefined;
        } catch (e) {
            console.error("Dynamic code evaluation failed:", e);
            throw new Error(`動的コードの解析に失敗しました: ${e.message}`);
        }
    } else {
        appModule = await safeImport(item.entry);
    }

    if (!appModule?.default) throw new Error("アプリが正しくエクスポートされていません");

    const displayName = options?.path ? basename(options.path) : (options.showFullPath ? path : item.name || basename(path));
    const content = createWindow(displayName, { node: options.originalNode || item });
    const win = content?.closest(".window");
    if (!win) throw new Error("Window creation failed");

    let appHandle = null;
    try {
        appHandle = await appModule.default(content, options);
        if (appHandle?.isTabApp) tabAppInstances.set(item.entry, { win, handle: appHandle });
        if (typeof win._applyRealIcon === "function") win._applyRealIcon();
    } catch (e) {
        console.error("app runtime error:", e);
        // ★ エラー時に中途半端なウィンドウが残らないよう破棄する
        if (typeof destroyWindow === "function" && win) {
            destroyWindow(win);
        }
        errorWindow(`アプリがクラッシュしました\n${e.message}`, { taskbar: false });
        throw e;
    }

    addRecent(path);
    const key = uniqueKey ?? `app:${path}:${Date.now()}`;
    registerProcess(win, key, path, appHandle);

    if (isExplorer) explorerWindows.set(options.path || "Desktop", win);
}

/* --- 共通：プロセス登録とObserver設定のヘルパー --- */
function registerProcess(win, key, path, handle) {
    const pid = pidCounter++;
    processes.set(key, {
        pid,
        path,
        window: win,
        handle,
        state: "normal",
        startTime: performance.now(),
        memory: 0,
        cpu: 0
    });

    win.dataset.processKey = key;

    const observer = new MutationObserver((mutations, obs) => {
        if (!document.body.contains(win)) {
            obs.disconnect();
            if (processes.has(key)) killProcess(key);
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    win._observer = observer;

    win._cleanup = () => {
        if (processes.has(key)) killProcess(key);
    };
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
    const list = [];
    for (const [key, proc] of processes) {
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

        list.push({
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
        });
    }
    return list;
}

/* =========================
   killProcess（完全安全版）
========================= */
export function killProcess(key) {
    const proc = processes.get(key);
    if (!proc) return false;

    // ★ 修正: 多重呼び出しを完全に防ぐため、真っ先にプロセス一覧から除外する
    processes.delete(key);

    const win = proc.window;
    const handle = proc.handle;

    try {
        // 1. アプリ側のクリーンアップ（タイマー停止、メモリ解放など）
        if (handle && typeof handle.dispose === 'function') {
            handle.dispose();
        }

        // (既存) DOMに紐づいた後方互換用のクリーンアップ
        if (win?._cleanup) {
            const cleanup = win._cleanup;
            win._cleanup = null;
            cleanup();
        }

        // 2. Observerを真っ先に切断
        if (win?._observer) {
            win._observer.disconnect();
            win._observer = null;
        }

        // 3. タスクバーとウィンドウをUIから削除
        if (win?._taskbarBtn) win._taskbarBtn.remove();
        if (win) win.remove();

    } catch (e) {
        console.warn("Process cleanup failed:", e);
    } finally {
        // エクスプローラー管理やタブ管理からの削除はそのまま実行
        for (const [path, w] of explorerWindows.entries()) {
            if (w === win) {
                explorerWindows.delete(path);
                break;
            }
        }
        for (const [entry, instance] of tabAppInstances.entries()) {
            if (instance.win === win) {
                tabAppInstances.delete(entry);
                break;
            }
        }
    }
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
 * FSに保存された音声データを再生する
 */
export async function playSavedAudio(path) {
    const file = resolveFS(`Programs/Music/${path}`);
    if (file && file.content) {
        let audioData = file.content;
        if (audioData === "__EXTERNAL_DATA__") {
            const { getFileContent } = await import("./fs-db.js");
            audioData = await getFileContent(`Programs/Music/${path}`);
        }
        if (audioData) {
            const audio = new Audio(audioData);
            audio.play().catch(console.error);
        }
    }
}

/**
 * システムイベントに関連付けられた音声を再生する
 */
export async function playSystemEventSound(eventName) {
    try {
        const configText = FS.System?.["SoundConfig.json"]?.content;
        const config = JSON.parse(configText || "{}");
        const path = config[eventName];

        if (path) {
            // resolveFS を使ってサブフォルダ階層のパスから安全にファイルを取得
            const file = resolveFS(`Programs/Music/${path}`);
            if (file) {
                let audioData = file.content;

                // 外部DBに保存されている実データを取得する
                if (audioData === "__EXTERNAL_DATA__") {
                    const { getFileContent } = await import("./fs-db.js");
                    audioData = await getFileContent(`Programs/Music/${path}`);
                }

                if (audioData) {
                    const audio = new Audio(audioData);
                    audio.play().catch(err => {
                        // オートプレイ制限 (NotAllowedError) への対処
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