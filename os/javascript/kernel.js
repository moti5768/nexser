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

    // 起動完了の一斉描画までシェルウィンドウが1フレームでもチラつくのを防ぐ
    if (win && window.nexser?.isBooting && !options._modal) {
        win.style.visibility = "hidden";
    }

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

/**
 * 仮想ファイルシステム（FS）の実データ統計を走査して取得
 */
function collectFSActualStats(rootNode) {
    const stats = { folders: 0, files: 0, apps: 0, links: 0, externalFiles: 0 };
    const skipKeys = new Set([
        "type", "entry", "singleton", "shell", "system", "lastModified",
        "hidden", "originalPath", "size", "content", "name", "target", "code", "windowOptions", "frameless"
    ]);
    const visited = new WeakSet();

    function walk(node) {
        if (!node || typeof node !== "object" || visited.has(node)) return;
        visited.add(node);

        for (const [key, val] of Object.entries(node)) {
            if (skipKeys.has(key) || !val || typeof val !== "object") continue;
            if (val.type === "folder") {
                stats.folders++;
                walk(val);
            } else if (val.type === "file") {
                stats.files++;
                if (val.content === "__EXTERNAL_DATA__") stats.externalFiles++;
            } else if (val.type === "app") {
                stats.apps++;
                if (val.content === "__EXTERNAL_DATA__") stats.externalFiles++;
            } else if (val.type === "link") {
                stats.links++;
            }
        }
    }

    if (rootNode) walk(rootNode);
    return stats;
}

/**
 * ブラウザの IndexedDB / ストレージ実使用量（MB）を取得
 */
async function getStorageUsageText() {
    try {
        if (navigator.storage?.estimate) {
            const { usage, quota } = await navigator.storage.estimate();
            if (typeof usage === "number") {
                const usedMB = (usage / (1024 * 1024)).toFixed(2);
                const quotaGB = typeof quota === "number" ? ` / ${(quota / (1024 * 1024 * 1024)).toFixed(1)} GB` : "";
                return `${usedMB} MB${quotaGB}`;
            }
        }
    } catch (_) { }
    return "計測不可";
}

// ⭐ shell: true を持つアプリケーションを自動起動するヘルパー関数（進捗通知対応）
export async function launchShellApps(onProgress = null) {
    try {
        const { FS } = await import("./fs.js");
        const applications = FS["C:"]?.Programs?.Applications;
        if (!applications) return [];

        const shellEntries = Object.entries(applications).filter(
            ([, appObj]) => appObj && appObj.shell && appObj.type === "app"
        );

        const launchedList = [];
        for (let i = 0; i < shellEntries.length; i++) {
            const [appName] = shellEntries[i];
            const appPath = `C:/Programs/Applications/${appName}`;
            if (typeof onProgress === "function") {
                onProgress(appName, appPath, i + 1, shellEntries.length);
            }
            console.log(`[Kernel] Launching shell app: ${appPath}`);
            await launch(appPath);
            launchedList.push(appName);
        }
        return launchedList;
    } catch (e) {
        console.error("[Kernel] Failed to launch shell apps:", e);
        return [];
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
    if (window.nexser?.isBooting) {
        const iconsContainer = document.getElementById("desktop-icons");
        if (iconsContainer) iconsContainer.style.display = "none";
    }
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

// 5. ブート優先実行用の統合起動シーケンス（実データ連携・詳細表示版）
export async function bootKernelSequenceAsync({ screen, initFS, loadSetting, initScreensaver, print = () => { } }) {
    window.nexser = window.nexser || {};
    window.nexser.isLoggingOff = false;
    window.nexser.isBooting = true;

    let progressWin = null;
    let inputShield = null;

    try {
        // 1. カーネル空間初期化（#desktop と #taskbar のDOM生成、windowAPI確定）
        await initKernelSpaceAsync(msg => print(`[Kernel] ${msg}`));

        // 2. boot直後にCUI非表示・desktop表示・taskbar非表示へ即切替
        if (screen) screen.style.display = "none";
        const root = document.getElementById("os-root");
        if (root) root.style.display = "block";

        const taskbar = document.getElementById("taskbar");
        if (taskbar) {
            taskbar.style.visibility = "hidden";
            taskbar.style.pointerEvents = "none";
        }

        // 起動音が鳴る前のあらゆる操作（デスクトップ・シェルアプリ等）を物理的に遮断するシールド
        inputShield = document.createElement("div");
        inputShield.id = "boot-input-shield";
        Object.assign(inputShield.style, {
            position: "fixed",
            inset: "0",
            zIndex: "99990",
            background: "transparent",
            pointerEvents: "all",
            cursor: "wait"
        });
        document.body.appendChild(inputShield);

        // 3. 起動読み込みプログレスバーウィンドウを表示（autoClose: false で手動破棄を完全制御）
        progressWin = getWindowAPI()?.progressWindow(
            "Nexser OS の起動",
            "カーネル空間を初期化しています...",
            {
                allowCancel: false,
                autoClose: false,
                taskbar: false,
                width: 480,
                disableControls: true,
                disableClose: true
            }
        );
        if (progressWin?.win) {
            progressWin.win.style.zIndex = "99999";
        }

        // 4. DBからファイルシステムを読み込み、実データ件数・容量を表示
        progressWin?.update(
            12,
            100,
            "IndexedDB ストア (kv / files) へ接続中...",
            "[1/6] ファイルシステムをマウントしています..."
        );
        await initFS(msg => progressWin?.update(24, 100, msg));

        const { FS, diagnoseAndCleanFS } = await import("./fs.js");
        const fsStats = collectFSActualStats(FS["C:"]);
        const storageUsage = await getStorageUsageText();

        progressWin?.update(
            36,
            100,
            `ドライブ C: 復元完了 (使用容量: ${storageUsage})\nフォルダ: ${fsStats.folders}件 / ファイル: ${fsStats.files}件 / アプリ: ${fsStats.apps}件 (外部実データ: ${fsStats.externalFiles}件)`,
            "[2/6] システムシェルとタスクバーを構築しています..."
        );

        // 5. システムシェル（タスクバー・スタートメニュー）の構築（実設定値を反映）
        const savedPos = (await loadSetting("taskbarPosition")) || "bottom";
        const savedHeight = (await loadSetting("taskbarSize")) || 40;
        const isWinMode = Boolean(await loadSetting("taskbarWindowMode"));
        document.documentElement.style.setProperty('--taskbar-height', `${savedHeight}px`);

        progressWin?.update(
            48,
            100,
            `配置: ${savedPos} / 高さ: ${savedHeight}px / ウィンドウモード: ${isWinMode ? "有効" : "無効"}\nスタートメニューとダイナミックUIを初期化中...`
        );
        await initShellAsync(msg => print(`[Shell] ${msg}`));

        // 6. デスクトップビューの構築（実アイコン件数を表示）
        const desktopKeys = FS["C:"]?.Desktop
            ? Object.keys(FS["C:"].Desktop).filter(k => !["type", "system", "lastModified"].includes(k))
            : [];
        progressWin?.update(
            62,
            100,
            `パス: C:/Desktop (${desktopKeys.length} 個のデスクトップ項目を配置中)\nアイコンキャッシュとレイアウトを適用しています...`,
            "[3/6] デスクトップ環境を準備しています..."
        );
        await initDesktopAsync(msg => print(`[Desktop] ${msg}`));

        // 7. ユーザースペース（システム整合性診断・実レポート表示）
        progressWin?.update(
            74,
            100,
            "検証対象: C:/System, C:/Programs, C:/Desktop, C:/StartMenu\n外部データリンク (__EXTERNAL_DATA__) の整合性を確認中...",
            "[4/6] システム整合性を診断しています..."
        );
        const report = await diagnoseAndCleanFS(false);
        if (report.corruptionDetected) {
            playSystemEventSound('error');
            getWindowAPI()?.errorWindow(
                "【システム診断】\nシステムファイルの破損または消失を検出しました。\n\n一部の重要なフォルダが正常に読み込めない状態です。\n設定アプリ (Settings.app) の「System」タブから「Run Cleanup & Repair」を実行して修復してください。",
                { title: "システム整合性チェック", taskbar: true }
            );
        }
        progressWin?.update(
            82,
            100,
            `診断結果: ${report.corruptionDetected ? "不整合を検出（要修復）" : "すべてのシステム領域が正常"}\nゴミ箱 (C:/Trash) 内のアイテム: ${report.garbageItems}件`
        );

        // 8. シェルアプリ（Toolbar / Startmenu 等）とスクリーンセーバーの起動
        const launchedShells = await launchShellApps((appName, appPath, idx, total) => {
            const pct = 82 + Math.round((idx / Math.max(1, total)) * 10);
            progressWin?.update(
                pct,
                100,
                `対象 (${idx}/${total}): ${appPath}\n現在の稼働プロセス数: ${processes.size}件`,
                "[5/6] 常駐シェルサービスを起動しています..."
            );
        });

        progressWin?.update(
            95,
            100,
            `起動済みシェル: ${launchedShells.length > 0 ? launchedShells.join(", ") : "なし"}\nスクリーンセーバー監視サービスを初期化中...`,
            "[6/6] システムサービスを最終調整しています..."
        );
        try {
            await initScreensaver();
            print('[Screensaver] Ready');
        } catch (ssErr) {
            print('[Screensaver] Skipped (Non-critical failure)');
            console.warn("Screensaver failed to initialize, but boot will continue:", ssErr);
        }

        progressWin?.update(
            100,
            100,
            `稼働プロセス: ${processes.size}件 / ストレージ: ${storageUsage}\nすべての初期化が完了しました。デスクトップを表示します...`,
            "Nexser OS の起動完了"
        );
        await new Promise(r => setTimeout(r, 250));

        // 9. プログレスバーを完全破棄し、すべてを一斉描画・操作解禁
        if (progressWin) {
            progressWin.close();
            progressWin = null;
        }
        if (inputShield) {
            inputShield.remove();
            inputShield = null;
        }

        window.nexser.isBooting = false;

        const iconsContainer = document.getElementById("desktop-icons");
        if (iconsContainer) {
            iconsContainer.style.display = "";
        }
        window.dispatchEvent(new Event("desktop-resize"));

        const currentTaskbar = document.getElementById("taskbar");
        if (currentTaskbar) {
            currentTaskbar.style.visibility = "visible";
            currentTaskbar.style.pointerEvents = "auto";
            const floatingTbWin = currentTaskbar.closest(".window");
            if (floatingTbWin) {
                floatingTbWin.style.visibility = "visible";
                floatingTbWin.style.pointerEvents = "auto";
            }
        }

        document.querySelectorAll("#os-root .window").forEach(win => {
            win.style.visibility = "visible";
        });

        // 10. すべて描画・操作解禁した直後に起動音を再生
        playSystemEventSound('startup');
        print("OS Boot Completed Successfully.");
        try {
            logSystemEvent(
                "System",
                "Information",
                "OSBootstrapper",
                1000,
                "System Startup",
                `Nexser OS が正常に起動しました (フォルダ: ${fsStats.folders}, ファイル: ${fsStats.files}, アプリ: ${fsStats.apps})。`
            );
        } catch (logErr) {
            console.warn("[Boot] Failed to log boot event:", logErr);
        }
    } catch (e) {
        window.nexser.isBooting = false;
        if (progressWin) progressWin.close();
        if (inputShield) inputShield.remove();
        throw e;
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

        // イベント通知と IndexedDB 永続化を logSystemEvent に一本化（重複保存・競合防止）
        await logSystemEvent(
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

/* =========================
   ログオフ（完全統合・シェル完全除外版）
========================= */
export async function logOff() {
    // ⭐ ログオフ処理が呼ばれた瞬間に最速でフラグを立てて、すべての再描画をブロックする
    window.nexser = window.nexser || {};
    window.nexser.isBooting = false;
    window.nexser.isLoggingOff = true;

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
        playSystemEventSound('logoff');

        // デスクトップアイコン群・タスクバー（ウィンドウモード含む）を即座に非表示化
        const desktopIcons = document.getElementById("desktop-icons");
        const taskbar = document.getElementById("taskbar");
        if (desktopIcons) desktopIcons.style.display = "none";
        if (taskbar) {
            taskbar.style.visibility = "hidden";
            const floatingTbWin = taskbar.closest(".window");
            if (floatingTbWin) floatingTbWin.style.visibility = "hidden";
        }

        // ログオフ中の誤操作を防ぐシールド
        const logoffShield = document.createElement("div");
        logoffShield.id = "logoff-input-shield";
        Object.assign(logoffShield.style, {
            position: "fixed",
            inset: "0",
            zIndex: "99990",
            background: "transparent",
            pointerEvents: "all",
            cursor: "wait"
        });
        document.body.appendChild(logoffShield);

        const progressWin = getWindowAPI()?.progressWindow(
            "Nexser OS ログオフ",
            "セッション終了処理を開始しています...",
            {
                allowCancel: false,
                autoClose: false,
                taskbar: false,
                width: 480,
                disableControls: true,
                disableClose: true
            }
        );
        if (progressWin?.win) {
            progressWin.win.style.zIndex = "99999";
        }

        try {
            // 1. 未保存の差分保存完了を待機
            progressWin?.update(
                12,
                100,
                "バックグラウンド書き込みキューの完了を待機中...",
                "[1/5] 未保存データをストレージへフラッシュしています..."
            );
            const { waitForSaveCompletion, forceSave, diagnoseAndCleanFS } = await import("./fs.js");
            await waitForSaveCompletion();

            // 2. 稼働中の全プロセス（アプリ・シェル）を実データ表示しながら終了
            const activeProcs = getProcessList();
            const totalProcs = activeProcs.length;

            if (totalProcs === 0) {
                progressWin?.update(
                    35,
                    100,
                    "終了対象のアクティブプロセスはありません。",
                    "[2/5] プロセス終了完了"
                );
            } else {
                for (let i = 0; i < totalProcs; i++) {
                    const proc = activeProcs[i];
                    const pct = 15 + Math.round(((i + 1) / totalProcs) * 25);
                    const procType = proc.state === "shell" ? "システムシェル" : "アプリケーション";
                    progressWin?.update(
                        pct,
                        100,
                        `終了中 (${i + 1}/${totalProcs}): ${proc.name} [${procType}]\nPID: ${proc.pid} / 稼働時間: ${proc.uptime}秒 / パス: ${proc.path}`,
                        "[2/5] 実行中のプロセスを終了しています..."
                    );
                    killProcess(proc.key);
                }
            }

            // 3. システムログを IndexedDB へ書き込み
            progressWin?.update(
                50,
                100,
                `対象ストア: ${LOG_STORAGE_KEY}\nセッション終了および ${totalProcs} 件のプロセス終了イベントを記録中...`,
                "[3/5] イベントログをデータベースへ保存しています..."
            );

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
                description: `ユーザーがシステムからログオフしました (終了プロセス: ${totalProcs}件)。`
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

            progressWin?.update(
                64,
                100,
                `ログ保存完了 (累計保持件数: System ${allLogs.System.length}件 / Application ${allLogs.Application.length}件)\nファイルシステムの最終同期を実行中...`,
                "[4/5] ファイルシステムの整合性を検証しています..."
            );

            // 4. DB強制保存と整合性診断・修復
            await forceSave();
            const fsReport = await diagnoseAndCleanFS(true);
            if (fsReport.corruptionDetected) {
                console.warn("[Logoff] ファイルシステムの破損を検知し、修復を実行しました。", fsReport.logs);
            }

            // 5. DB書き込み最終検証と使用容量確認
            const verifiedLog = await dbGet(LOG_STORAGE_KEY, "kv");
            if (!verifiedLog) {
                throw new Error("データベースへのログ書き込み検証に失敗しました。");
            }

            const storageUsage = await getStorageUsageText();
            progressWin?.update(
                100,
                100,
                `整合性検証: ${fsReport.corruptionDetected ? "破損を自動修復済み" : "正常"} / ストレージ使用量: ${storageUsage}\nすべてのセッションデータが安全に保存されました。`,
                "[5/5] Nexser OS からログオフしています..."
            );
            await new Promise(r => setTimeout(r, 450));

        } catch (e) {
            console.error("[Kernel] ログオフ時のデータ保存・データベース検証に失敗しました:", e);
        } finally {
            if (progressWin) {
                progressWin.close();
            }
            logoffShield.remove();
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
                } else {
                    // キャンセルされた場合はログオフフラグを戻す
                    window.nexser.isLoggingOff = false;
                }
            },
            {
                width: 460,
                overlay: true,
                isHtml: true,
                taskbar: false,
                disableControls: true
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