/* kernel.js : OSの中枢 */
import { playSystemEventSound } from './sounds.js';
import { buildDesktop } from "./desktop.js";
import { initTaskbar } from "./taskbar.js";
import { showBSOD } from "./bsod.js";
import { showPromptScreen, resetSystemVerification } from "./boot.js";
import { addRecent } from "./recent.js";
import { installDynamicButtonEffect } from "./ui.js";
import { resolveFS, basename } from "./fs-utils.js";
import { resolveAppByPath } from "./file-associations.js";
import { dbGet, dbSet } from "./fs-db.js";
import { setKernelWindowCreator, createWindow as createRawWindow } from "./window.js";

const LOG_STORAGE_KEY = "nexser_system_logs_v1";

const getWindowAPI = () => window.nexser?.windowAPI;

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
            window.dispatchEvent(new CustomEvent("nexser-system-log", {
                detail: {
                    category: "System",
                    level: "Warning",
                    source: "KernelErrorHandler",
                    eventId: 2001,
                    taskCategory: "Exception Handling",
                    description: `Non-critical exception caught: ${msg}`
                }
            }));

            // エラーを発生させた要素からプロセスキー（processKey）を逆引きして該当アプリのみ終了
            const targetWin = e.target?.closest ? e.target.closest(".window") : null;
            if (targetWin && targetWin.dataset.processKey) {
                const key = targetWin.dataset.processKey;
                console.warn(`[Kernel] App error detected. Terminating process: ${key}`);
                getWindowAPI()?.errorWindow(`アプリケーションエラーが発生したため終了しました。\n${msg}`, { taskbar: false });
                killProcess(key);
            }
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

    const promise = (async () => {
        let timerId;
        const timeout = new Promise((_, reject) => {
            timerId = setTimeout(() => reject(new Error("Import Timeout")), 10000);
        });

        try {
            // タイムアウト付きでインポート
            const mod = await Promise.race([import(entry), timeout]);
            clearTimeout(timerId); // ★ 成功時にタイマーを確実にクリア
            moduleCache.set(entry, mod);
            return mod;
        } catch (e) {
            clearTimeout(timerId); // ★ 失敗時もタイマーを確実にクリア
            console.error("import failed:", entry, e);
            throw e;
        } finally {
            importLocks.delete(entry); // 失敗しても成功してもロックは外す
        }
    })();

    importLocks.set(entry, promise);
    return promise;
}

/* ===== カーネル初期化 ===== */

/**
 * カーネルを介してウィンドウを生成し、プロセス管理へ自動登録する
 */
export function createKernelWindow(title, options = {}) {
    // windowAPI を経由せず、直接オリジナルの createWindow を呼び出して無限ループを回避
    const content = createRawWindow(title, options);
    const win = content?.closest(".window");

    // 2. プロセスキーが指定されている場合はカーネルのプロセス管理に自動登録
    if (win && options.processKey) {
        registerProcess(win, options.processKey, options.path || "", options.handle || null);
    }

    return content;
}

/* =========================
   Secure Kernel API
========================= */
export function initKernelAPI() {
    if (typeof window === "undefined") return;

    const secureKernelAPI = {
        // ★ import なしで外部からアプリやファイル・フォルダを起動できるように launch を追加
        launch: async (path, options) => {
            return await launch(path, options);
        },
        getProcessList: () => {
            return Array.from(processes.values()).map(proc => ({
                pid: proc.pid,
                path: proc.path,
                name: basename(proc.path),
                state: proc.state,
                uptime: Math.floor((performance.now() - proc.startTime) / 1000),
                memory: proc.memory,
                cpu: proc.cpu
            }));
        },
        sendMessage: (senderPid, targetPid, message) => {
            return sendProcessMessage(senderPid, targetPid, message);
        },
        logSystemEvent: (category, level, source, eventId, taskCategory, description, extra) => {
            return logSystemEvent(category, level, source, eventId, taskCategory, description, extra);
        }
    };

    Object.freeze(secureKernelAPI);

    window.nexser = window.nexser || {};

    // すでに定義されている場合の重複エラーを防ぐため try-catch で保護
    try {
        Object.defineProperty(window.nexser, "kernelAPI", {
            value: secureKernelAPI,
            writable: false,
            configurable: true, // 再定義を許可
            enumerable: true
        });
    } catch (e) {
        // 万が一再定義できない環境の場合は直接プロパティに代入
        window.nexser.kernelAPI = secureKernelAPI;
    }
}

// 1. カーネルスペース（DOM注入とエラー制御）
export async function initKernelSpaceAsync(progressCallback = () => { }) {
    const root = document.getElementById("os-root");
    if (!root) throw new Error("os-root not found");

    // ⭐ 再boot時にPIDカウンターやプロセス管理の状態を完全にリセット
    pidCounter = 1;
    processes.clear();
    explorerWindows.clear();

    initSystemErrorHandler();
    initKernelAPI(); // ⭐ カーネルAPIの初期化と凍結登録

    setKernelWindowCreator((title, options) => {
        return createKernelWindow(title, options);
    });

    progressCallback("Initializing Kernel Space (DOM & Error Handlers)...");

    logSystemEvent(
        "System",
        "Information",
        "Kernel",
        1003,
        "System Initialization",
        "カーネルが初期化され、システムが起動（または再起動）しました。"
    );

    root.innerHTML = `
        <div id="desktop"></div>
        <div id="taskbar">
            <button id="start-btn" data-tooltip="スタート">Start</button>
        </div>
    `;
    await new Promise(r => requestAnimationFrame(r));
}

// ⭐ shell: true を持つアプリケーションを自動起動するヘルパー関数
export async function launchShellApps() {
    try {
        const { FS } = await import("./fs.js");
        const applications = FS["C:"]?.Programs?.Applications;
        if (!applications) return;

        for (const [appName, appObj] of Object.entries(applications)) {
            // shell: true が設定されているアプリを自動起動対象とする
            if (appObj && appObj.shell && appObj.type === "app") {
                const appPath = `C:/Programs/Applications/${appName}`;
                console.log(`[Kernel] Launching shell app: ${appPath}`);
                await launch(appPath);
            }
        }
    } catch (e) {
        console.error("[Kernel] Failed to launch shell apps:", e);
    }
}

// 2. システムシェル（タスクバー・スタートメニュー）※デスクトップより先に構築
export async function initShellAsync(progressCallback = () => { }) {
    progressCallback("Initializing System Shell (Taskbar & Start Menu)...");

    // ⭕ await を追加し、タスクバーの設定・レイアウト適用が完全に完了するのを待つ
    await initTaskbar();
    await new Promise(r => requestAnimationFrame(r));

    try {
        const { startMenuReady } = await import("./apps/startmenu.js");
        if (typeof startMenuReady === "function") {
            await startMenuReady(); // タスクバーの位置・サイズが確定した状態でスタートメニューを初期化する
        }
    } catch (e) {
        console.warn("[Kernel] StartMenu failed to initialize:", e);
    }
    await new Promise(r => setTimeout(r, 0));

    installDynamicButtonEffect();
    await new Promise(r => requestAnimationFrame(r));
}

// 3. デスクトップビュー
export async function initDesktopAsync(progressCallback = () => { }) {
    progressCallback("Loading Desktop View...");
    buildDesktop();
    await new Promise(r => requestAnimationFrame(r));
}

// 4. ユーザースペース（システム診断など）
export async function initUserSpaceAsync(progressCallback = () => { }) {
    progressCallback("Scanning system integrity...");
    try {
        const { diagnoseAndCleanFS } = await import("./fs.js");
        const report = await diagnoseAndCleanFS(false);

        if (report.corruptionDetected) {
            playSystemEventSound('error');
            getWindowAPI()?.errorWindow(
                "【システム診断】\nシステムファイルの破損または消失を検出しました。\n\n一部の重要なフォルダが正常に読み込めない状態です。\n設定アプリ (Settings.app) の「System」タブから「Run Cleanup & Repair」を実行して修復してください。",
                { title: "システム整合性チェック", taskbar: true }
            );
        }
    } catch (e) {
        console.warn("Boot-time system scan failed:", e);
    }
}

// ★ 後方互換性維持：他のファイルから従来通り呼ばれても動作するようにする
export async function initKernelAsync(progressCallback = () => { }) {
    await initKernelSpaceAsync(progressCallback);
    await initShellAsync(progressCallback); // シェルを先に
    await initDesktopAsync(progressCallback); // デスクトップを後に
    await initUserSpaceAsync(progressCallback);
    progressCallback("Kernel initialization complete!");
}

/* =========================
   起動API（リファクタリング版）
========================= */
const tabAppInstances = new Map();

export async function launch(path, options = {}) {
    if (typeof path !== "string") {
        getWindowAPI()?.errorWindow(`無効なパス: ${path}`, { taskbar: false });
        return;
    }

    if (launching.has(path)) return;
    launching.add(path);

    try {
        const item = resolveFS(path);
        if (!item) {
            getWindowAPI()?.errorWindow(`対象が見つかりません: ${path}`, { taskbar: false });
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
        getWindowAPI()?.errorWindow(`起動に失敗しました: ${path}\n${err.message}`, { taskbar: false });
    } finally {
        launching.delete(path);
        try {
            // ✨ カスタムイベントを発行してスタートメニュー側に更新を伝える
            window.dispatchEvent(new CustomEvent("request-refresh-start-menu"));
        } catch { }
    }
}

/* --- 1. リンク起動の処理 --- */
async function launchLink(item, path, options) {
    const targetItem = resolveFS(item.target);
    if (!targetItem) {
        getWindowAPI()?.confirmWindow(
            `問題のあるショートカット\n\nこのショートカットが参照している '${item.target}' は存在しません。\nこのショートカットを削除しますか？`,
            (result) => {
                if (result) console.log(`ショートカットを削除します: ${path}`);
            },
            { width: 400, overlay: true }
        );
        return;
    }
    // ロック解除は外側の launch() の finally に任せるため、ここでは削除しない
    return await launch(item.target, {
        ...options,
        originalNode: item,
        uniqueKey: options.uniqueKey || item.target
    });
}

/* --- 2. フォルダ起動の処理 --- */
async function launchFolder(item, path, options) {
    return await launch("C:/Programs/Applications/Explorer.app", {
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

    const content = getWindowAPI()?.createWindow(basename(path), { node: item });
    const win = content?.closest(".window");
    if (!win) throw new Error("Window creation failed");

    try {
        await mod.default(content, { name: basename(path), content: item.content });
        if (typeof win._applyRealIcon === "function") win._applyRealIcon();
    } catch (e) {
        // ★ ファイルビューアの初期化エラー時に中途半端なウィンドウを破棄する
        if (typeof getWindowAPI()?.destroyWindow === "function" && win) {
            getWindowAPI()?.destroyWindow(win);
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
            // 最小化されている場合は先に復元をトリガーし、そうでない場合のみ最前面へ
            if (instance.win.dataset.minimized === "true") {
                instance.win._taskbarBtn?.click();
            } else {
                getWindowAPI()?.bringToFront(instance.win);
            }
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
    let existingWin = isExplorer ? explorerWindows.get(options.path || "C:/Desktop") : (uniqueKey ? processes.get(uniqueKey)?.window : null);

    if (existingWin && document.body.contains(existingWin)) {
        if (existingWin.dataset.minimized === "true") existingWin._taskbarBtn?.click();
        else getWindowAPI()?.bringToFront(existingWin);
        return;
    }

    if (isExplorer) explorerWindows.delete(options.path || "C:/Desktop");
    if (uniqueKey) processes.delete(uniqueKey);

    // ==========================================
    // 1. 変数をここで一度だけ一意に定義する
    // ==========================================
    const displayName = options?.path ? basename(options.path) : (options.showFullPath ? path : item.name || basename(path));
    const isFrameless = Boolean(item.frameless || options.frameless);
    const isShell = Boolean(item.shell || options.shell);
    const processPath = (isExplorer && options.path) ? options.path : path;
    const key = uniqueKey ?? `app:${processPath}:${Date.now()}`;
    const pid = pidCounter++;

    // ==========================================
    // 2. サードパーティー（動的コード）用の制限されたサンドボックス Syscall
    // ==========================================
    const sandboxSyscall = Object.freeze({
        pid,
        path: processPath,
        exit: () => killProcess(key),
        postMessage: (targetPid, message) => sendProcessMessage(pid, targetPid, message)
    });

    let appModule;

    if (item.code) {
        try {
            const cleanCode = item.code.replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '');
            const executableCode = cleanCode
                .replace(/export\s+default\s+async\s+function\s*(\w*)/, 'async function $1')
                .replace(/export\s+default\s+function\s*(\w*)/, 'function $1');

            const { FS, forceSave } = await import("./fs.js");
            const { resolveFS } = await import("./fs-utils.js");
            const { getFileContent } = await import("./fs-db.js");
            const windowAPI = window.nexser?.windowAPI;

            const RESTRICTED_DIRS = new Set(["System", "Programs"]);

            function createSecureFS(targetFS) {
                const fsHandler = {
                    get(target, prop, receiver) {
                        const res = Reflect.get(target, prop, receiver);
                        if (target === targetFS["C:"] && typeof prop === "string" && RESTRICTED_DIRS.has(prop)) {
                            return Object.freeze(JSON.parse(JSON.stringify(res || {})));
                        }
                        if (res && typeof res === "object") {
                            return new Proxy(res, fsHandler);
                        }
                        return res;
                    },
                    set(target, prop, value) {
                        if (target === targetFS["C:"] && typeof prop === "string" && RESTRICTED_DIRS.has(prop)) {
                            throw new Error(`[Security] 許可されていない操作です: システム領域 'C:/${prop}' を書き換えることはできません。`);
                        }
                        return Reflect.set(target, prop, value);
                    },
                    deleteProperty(target, prop) {
                        if (target === targetFS["C:"] && typeof prop === "string" && RESTRICTED_DIRS.has(prop)) {
                            throw new Error(`[Security] 許可されていない操作です: システム領域 'C:/${prop}' を削除することはできません。`);
                        }
                        return Reflect.deleteProperty(target, prop);
                    }
                };
                return new Proxy(targetFS, fsHandler);
            }

            const safeFS = createSecureFS(FS);

            // 動的コード側には安全な sandboxSyscall のみをバインド
            const runScript = new Function(
                'FS', 'forceSave', 'resolveFS', 'windowAPI', 'getFileContent', 'syscall',
                `return (${executableCode});`
            );

            appModule = {
                default: runScript(safeFS, forceSave, resolveFS, windowAPI, getFileContent, sandboxSyscall)
            };
        } catch (e) {
            console.error("Dynamic code evaluation failed:", e);
            throw new Error(`動的コードの解析に失敗しました: ${e.message}`);
        }
    } else {
        appModule = await safeImport(item.entry);
    }

    if (!appModule?.default) throw new Error("アプリが正しくエクスポートされていません");

    // ==========================================
    // 3. ウィンドウ生成とシステムコールの割り当て
    // ==========================================
    const content = getWindowAPI()?.createWindow(displayName, {
        node: options.originalNode || item,
        frameless: isFrameless,
        hideRibbon: isFrameless,
        hideStatus: isFrameless
    });
    const win = content?.closest(".window");
    if (!win) throw new Error("Window creation failed");

    let appHandle = null;

    // 動的コード（サードパーティー）には sandboxSyscall、通常のシステムアプリにはフル機能の syscall を割り当て
    const syscall = item.code ? sandboxSyscall : {
        pid,
        path: processPath,
        exit: () => killProcess(key),
        restart: () => restartProcess(key),
        postMessage: (targetPid, message) => sendProcessMessage(pid, targetPid, message),
        onMessage: null
    };

    try {
        appHandle = await appModule.default(content, { ...options, syscall });
        if (appHandle?.isTabApp) tabAppInstances.set(item.entry, { win, handle: appHandle });
        if (typeof win._applyRealIcon === "function") win._applyRealIcon();

        const processState = isShell ? "shell" : "normal";
        const logCategory = "Application";
        const logSource = basename(processPath);
        const logDesc = `アプリケーション '${logSource}' (PID: ${pid}) が正常に起動しました。`;

        // 1. リアルタイム更新通知用のカスタムイベント発火
        logSystemEvent(
            logCategory,
            "Information",
            logSource,
            1000,
            "App Lifecycle",
            logDesc,
            {
                isShell: isShell,
                state: processState
            }
        );

        // 2. イベントログ画面が開いていなくても確実に IndexedDB へ直接保存する
        try {
            const { dbGet, dbSet } = await import("./fs-db.js");
            let allLogs = (await dbGet(LOG_STORAGE_KEY, "kv")) || {
                System: [],
                Application: [],
                Security: []
            };

            if (!allLogs[logCategory]) allLogs[logCategory] = [];

            allLogs[logCategory].unshift({
                level: "Information",
                time: new Date().toLocaleTimeString(),
                timestamp: Date.now(),
                source: logSource,
                eventId: 1000,
                category: "App Lifecycle",
                isShell,
                state: processState,
                description: logDesc
            });

            if (allLogs[logCategory].length > 500) allLogs[logCategory].pop();
            await dbSet(LOG_STORAGE_KEY, allLogs, "kv");
        } catch (dbErr) {
            console.warn("[Kernel] Direct log persistence failed:", dbErr);
        }
    } catch (e) {
        console.error("app runtime error:", e);
        if (typeof getWindowAPI()?.destroyWindow === "function" && win) {
            getWindowAPI()?.destroyWindow(win);
        }
        getWindowAPI()?.errorWindow(`アプリがクラッシュしました\n${e.message}`, { taskbar: false });
        throw e;
    }

    addRecent(processPath);
    registerProcess(win, key, processPath, appHandle, isShell, options, pid);

    if (isExplorer) explorerWindows.set(options.path || "C:/Desktop", win);
}

/* --- 共通：プロセス登録とObserver設定のヘルパー --- */
function registerProcess(win, key, path, handle, isShell = false, options = {}, forcedPid = null) {
    const pid = forcedPid !== null ? forcedPid : pidCounter++; // ⭐二重採番を完全に防止
    processes.set(key, {
        pid,
        path,
        window: win,
        handle,
        state: isShell ? "shell" : "normal",
        isShell,
        options,
        startTime: performance.now(),
        memory: 0,
        cpu: 0
    });
    win.dataset.processKey = key;

    // (以降のObserver設定などはそのまま)
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
   Watchdog & Process Metrics
========================= */
setInterval(async () => {
    const mem = getMemoryMB();
    const now = performance.now();

    for (const [key, proc] of processes.entries()) {
        proc.memory = mem;
        proc.cpu = cpuLoad;

        // フリーズ監視（アプリ側で heartbeat が設定されている場合）
        if (proc.lastHeartbeat && ((now - proc.lastHeartbeat) > 10000)) {
            console.error(`[Watchdog] Freeze detected in process ${proc.pid} (${proc.path}). Terminating.`);
            killProcess(key);
            getWindowAPI()?.errorWindow(`アプリケーション '${basename(proc.path)}' が応答しないため、強制終了しました。`, { taskbar: true });
        }
    }
}, 2000);


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
   killProcess（完全安全・ロック自動解放版）
========================= */
export function killProcess(key) {
    const proc = processes.get(key);
    if (!proc) return false;

    const pid = proc.pid;
    const procName = basename(proc.path);
    const win = proc.window;
    const handle = proc.handle;
    const procPath = proc.path;

    processes.delete(key);

    try {
        if (procPath) {
            import("./fs.js").then(({ unlockFilesByPath }) => {
                if (typeof unlockFilesByPath === "function") {
                    unlockFilesByPath(procPath);
                }
            }).catch(err => {
                console.warn("[Kernel] Failed to release file locks on process termination:", err);
            });
        }

        if (handle) {
            if (typeof handle.dispose === 'function') handle.dispose();
            if (typeof handle.destroy === 'function') handle.destroy();
            if (typeof handle.unmount === 'function') handle.unmount();
        }

        if (win) {
            if (win._cleanup) {
                const cleanup = win._cleanup;
                win._cleanup = null;
                try { cleanup(); } catch (_) { }
            }

            if (win._observer) {
                win._observer.disconnect();
                win._observer = null;
            }

            win.innerHTML = "";

            if (win._taskbarBtn) {
                win._taskbarBtn.remove();
                win._taskbarBtn = null;
            }

            win.remove();
        }

    } catch (e) {
        console.warn("Process cleanup warning:", e);
    } finally {
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

        proc.window = null;
        proc.handle = null;
    }

    // ★ 修正: アプリケーションの終了なのでカテゴリを "Application" に変更し、
    // ログオフ時の一斉終了でイベントが埋もれないように正確なソース名で通知します
    logSystemEvent(
        "Application",
        "Information",
        procName,
        1002,
        "App Lifecycle",
        `アプリケーション '${procName}' (PID: ${pid}) が正常に終了しました。`,
        {
            isShell: proc.isShell,
            state: proc.state
        }
    );

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

        getWindowAPI()?.removeAllTaskbarButtons();

        processes.clear();
        explorerWindows.clear();

        // ⭐ UIリセット時にもPIDカウンターを1に巻き戻す
        pidCounter = 1;
    } catch { }
}

/* ===== ログオフ（完全統合・シェル完全除外版） ===== */
export async function logOff() {
    const windows = document.querySelectorAll(".window");

    // 💡 ドキュメント上のウィンドウおよびプロセス管理から「シェル」を完全に除外して判定
    const activeNormalWindows = Array.from(windows).filter(w => {
        const key = w.dataset.processKey;
        const proc = processes.get(key);
        if (!proc) return true; // プロセス未登録は通常ウィンドウ扱い

        // isShell フラグ、またはアプリ名に toolbar / startmenu が含まれる場合はシェルとみなして除外
        if (proc.isShell) return false;
        const lowerPath = (proc.path || "").toLowerCase();
        if (lowerPath.includes("toolbar") || lowerPath.includes("startmenu")) return false;

        return true;
    });

    const userApps = activeNormalWindows.map(w => {
        const key = w.dataset.processKey;
        const proc = processes.get(key);
        return {
            name: proc ? basename(proc.path) : (w.dataset.title || "不明なアプリ"),
            pid: proc ? proc.pid : "?",
            uptime: proc ? Math.floor((performance.now() - proc.startTime) / 1000) : 0
        };
    });

    const hasNormalWindow = userApps.length > 0;

    const performLogoff = async () => {
        window.nexser = window.nexser || {};
        window.nexser.isLoggingOff = true;
        playSystemEventSound('logoff');

        // デスクトップのアイコン群（#desktop-icons）とタスクバーを即座に非表示にする
        const desktopIcons = document.getElementById("desktop-icons");
        const taskbar = document.getElementById("taskbar");
        if (desktopIcons) desktopIcons.style.display = "none";
        if (taskbar) taskbar.style.visibility = "hidden";

        // 詳細なステータスを表示するプログレスウィンドウ
        const progressWin = getWindowAPI()?.progressWindow("nexser ログオフ マネージャー", "セッションを安全に終了しています...", {
            allowCancel: false,
            taskbar: false,
            width: 440,
            height: 200
        });

        if (progressWin) progressWin.update(10, 100, "ファイルシステムの書き込み完了を待機中...");

        try {
            // ⭐ ファイルシステムやデータベースへの書き込み完了を待機
            const { waitForSaveCompletion } = await import("./fs.js");
            await waitForSaveCompletion();

            if (progressWin) progressWin.update(25, 100, "すべてのプロセスとシェルを終了中...");

            // 1. 現在開いている全プロセス（シェル含む）の一覧を取得して完全終了
            const activeProcs = getProcessList();
            activeProcs.forEach(proc => {
                killProcess(proc.key);
            });

            if (progressWin) progressWin.update(40, 100, "システムログをデータベースに書き込み中...");

            // 2. IndexedDB から現在のログデータを取得・更新
            let allLogs = (await dbGet(LOG_STORAGE_KEY, "kv")) || {
                System: [],
                Application: [],
                Security: []
            };

            const nowTime = new Date().toLocaleTimeString();
            const nowTimestamp = Date.now();

            allLogs.System.unshift({
                level: "Information",
                time: nowTime,
                timestamp: nowTimestamp,
                source: "SessionManager",
                eventId: 1004,
                category: "Logoff",
                description: "ユーザーがシステムからログオフしました。"
            });

            activeProcs.forEach(proc => {
                allLogs.Application.unshift({
                    level: "Information",
                    time: nowTime,
                    timestamp: nowTimestamp,
                    source: proc.name,
                    eventId: 1002,
                    category: "App Lifecycle",
                    isShell: proc.isShell,
                    state: proc.state,
                    description: `アプリケーション/シェル '${proc.name}' (PID: ${proc.pid}) が正常に終了しました。`
                });
            });

            if (allLogs.System.length > 500) allLogs.System.length = 500;
            if (allLogs.Application.length > 500) allLogs.Application.length = 500;

            await dbSet(LOG_STORAGE_KEY, allLogs, "kv");

            if (progressWin) progressWin.update(70, 100, "ファイルシステムのデータベース整合性を検証中...");

            // 3. データベースおよびファイルシステムの書き込み完了を強制保障（forceSave）
            const { forceSave, diagnoseAndCleanFS } = await import("./fs.js");
            await forceSave();

            // 4. 実際にファイルデータベース（IndexedDB）の整合性を診断・修復
            const fsReport = await diagnoseAndCleanFS(true);
            if (fsReport.corruptionDetected) {
                console.warn("[Logoff] ファイルシステムの破損を検知し、修復を実行しました。", fsReport.logs);
            }

            // 5. データベースに実際にデータが正しく書き込まれているかを最終確認
            const verifiedLog = await dbGet(LOG_STORAGE_KEY, "kv");
            if (!verifiedLog) {
                throw new Error("データベースへのログ書き込み検証に失敗しました。");
            }

            // ⭐ 100%到達時にメッセージを変更し、少しウェイトを入れてからログオフへ移行
            if (progressWin) {
                progressWin.update(100, 100, "nexserをログオフしています...");
                await new Promise(r => setTimeout(r, 600)); // 0.6秒間メッセージを表示
            }

        } catch (e) {
            console.error("[Kernel] ログオフ時のデータ保存・データベース検証に失敗しました:", e);
        }

        if (progressWin) {
            progressWin.close();
        }

        resetUI();
        moduleCache.clear();

        if (typeof resetSystemVerification === "function") {
            resetSystemVerification();
        }

        showPromptScreen("nexser logoff");
    };

    // 通常のアプリケーションウィンドウが開いている場合のみ、実行中アプリの一覧付き確認ダイアログを表示
    if (hasNormalWindow) {
        const appListHtml = userApps.map(app => `<div style="padding: 2px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">• ${app.name} <span style="color: #666; font-size: 11px;">(PID: ${app.pid}, 稼働: ${app.uptime}秒)</span></div>`).join("");

        const confirmMessage = `以下のアプリケーションが実行中です。システムをログオフすると、未保存のデータが失われる可能性があります。<br><br>` +
            `<b>終了予定のプロセス (${userApps.length}件):</b>` +
            `<div style="max-height: 120px; overflow-y: auto; background: #ffffff; padding: 8px; margin: 6px 0; font-size: 12px; border-radius: 3px; border: 1px inset #808080; text-align: left;">${appListHtml}</div>` +
            `本当にシステムをログオフしますか？`;

        getWindowAPI()?.confirmWindow(
            confirmMessage,
            async (result) => {
                if (result) {
                    await performLogoff();
                }
            },
            {
                width: 460,
                overlay: true,
                isHtml: true // HTMLタグを有効化して綺麗なリストを表示
            }
        );
    } else {
        await performLogoff();
    }
}

/* =========================
   リネーム（名称変更）イベント検知
========================= */
if (typeof window !== "undefined") {
    window.addEventListener("fs-renamed", (e) => {
        const { oldPath, newPath } = e.detail || {};
        if (!oldPath || !newPath) return;

        for (const [key, proc] of processes.entries()) {
            // パスが完全一致、または配下フォルダの場合にパスを更新
            if (proc.path === oldPath || proc.path.startsWith(oldPath + "/")) {
                const updatedPath = proc.path.replace(oldPath, newPath);
                proc.path = updatedPath;

                // ウィンドウタイトルの更新
                if (proc.window) {
                    const newTitle = basename(updatedPath);
                    const windowAPI = getWindowAPI();

                    // ウィンドウAPI経由でウィンドウとタスクバーを同時に更新
                    if (windowAPI && typeof windowAPI.updateWindowTitle === "function") {
                        windowAPI.updateWindowTitle(proc.window, newTitle, false);
                    } else {
                        // フォールバック
                        const titleElem = proc.window.querySelector(".title-text");
                        if (titleElem) {
                            titleElem.textContent = newTitle;
                        }
                    }
                }
            }
        }
    });
}

/* =========================
   Shell 制御 & プロセス再起動
========================= */
export const Shell = {
    // Shell経由で安全にアプリを再起動
    async restart(key) {
        return await restartProcess(key);
    },
    // システムアクティビティの取得
    getActiveProcesses() {
        return getProcessList();
    }
};

/**
 * プロセスを安全に終了して再起動する
 */
export async function restartProcess(key) {
    const proc = processes.get(key);
    if (!proc) return false;

    const savedPath = proc.path;

    // ⭐ プロセスに保存されていた options をベースに、必要なフラグを確実に組み立てる
    const savedOptions = {
        ...(proc.options || {}),
        frameless: Boolean(proc.options?.frameless || proc.isShell),
        hideRibbon: Boolean(proc.options?.frameless || proc.isShell),
        hideStatus: Boolean(proc.options?.frameless || proc.isShell),
        uniqueKey: key
    };

    // 現在のプロセスをクリーンアップして終了
    killProcess(key);

    await new Promise(r => setTimeout(r, 100));
    console.log(`[Kernel/Shell] Restarting process with saved options:`, savedPath, savedOptions);

    // ⭐ 保存したオプションを引き継いで再launchする
    return await launch(savedPath, savedOptions);
}

/* =========================
   プロセス間通信 (IPC / postMessage)
========================= */
export function sendProcessMessage(senderPid, targetPid, message) {
    let targetProc = null;
    for (const proc of processes.values()) {
        if (proc.pid === targetPid) {
            targetProc = proc;
            break;
        }
    }

    if (!targetProc) {
        console.warn(`[IPC] Target PID ${targetPid} not found.`);
        return false;
    }

    // 受信側アプリのハンドラを呼び出し
    if (targetProc.handle && typeof targetProc.handle.onMessage === "function") {
        try {
            targetProc.handle.onMessage({ senderPid, data: message });
            return true;
        } catch (e) {
            console.error(`[IPC] Error delivering message to PID ${targetPid}:`, e);
            return false;
        }
    }
    return false;
}

export async function logSystemEvent(category, level, source, eventId, taskCategory, description, extra = {}) {
    const logEntry = {
        level,
        time: new Date().toLocaleTimeString(),
        timestamp: Date.now(),
        source,
        eventId,
        category: taskCategory,
        description,
        ...extra
    };

    // 1. リアルタイムで開いている画面への通知
    window.dispatchEvent(new CustomEvent("nexser-system-log", {
        detail: { category, ...logEntry }
    }));

    // 2. 画面が開いていなくても確実に IndexedDB へ直接保存する
    try {
        let allLogs = (await dbGet(LOG_STORAGE_KEY, "kv")) || {
            System: [],
            Application: [],
            Security: []
        };

        if (!allLogs[category]) allLogs[category] = [];
        allLogs[category].unshift(logEntry);

        // 最大保持数500件を超えたら古いものを削除
        if (allLogs[category].length > 500) allLogs[category].pop();

        await dbSet(LOG_STORAGE_KEY, allLogs, "kv");
    } catch (e) {
        console.warn("[Kernel] Failed to persist logSystemEvent to DB:", e);
    }
}