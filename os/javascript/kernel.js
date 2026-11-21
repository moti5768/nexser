/* kernel.js : OSの中枢 */
import { playSystemEventSound } from './sounds.js';
import { buildDesktop } from "./desktop.js";
import { initTaskbar } from "./taskbar.js";
import { showBSOD } from "./bsod.js";
import { showPromptScreen, resetSystemVerification } from "./boot.js";
import { addRecent } from "./recent.js";
import { installDynamicButtonEffect } from "./ui.js";
import {
    resolveFS,
    basename,
    normalizePath,
    cloneFSNode,
    isChildNodeObject,
    readFileContent,
    writeFileContent,
    ensureDirectory,
    listDirectory,
    statFS,
    deleteFSNode
} from "./fs-utils.js";
import {
    resolveAppByPath,
    registerFileAssociation,
    sanitizeIcon,
    exportCustomAssociations,
    importCustomAssociations
} from "./file-associations.js";
import { dbGet, dbSet, setStorageHalted } from "./fs-db.js";
import { unlockFilesByPid, setFSReadOnly, forceSave, isFileLocked } from "./fs.js";
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

let systemErrorHandlerInstalled = false;
let isSystemDead = false;
let isGuiActive = false;

// ?pid=123 クエリから該当プロセスキーを直接特定する
function findProcessKeyByPidTag(text) {
    if (!text) return null;
    const match = String(text).match(/[?&]pid=(\d+)/);
    if (!match) return null;

    const targetPid = Number(match[1]);
    for (const [key, proc] of processes.entries()) {
        if (!proc.isShell && proc.pid === targetPid) {
            return key;
        }
    }
    return null;
}

// スタックトレースから原因となった非シェルプロセスを特定する
function findProcessKeyByStack(error) {
    const stack = (error && typeof error.stack === "string") ? error.stack : new Error().stack;
    if (!stack) return null;

    // 1. ?pid=XX タグが含まれていれば複数ウィンドウでも100%特定
    const pidKey = findProcessKeyByPidTag(stack);
    if (pidKey) return pidKey;

    // 2. フォールバック：ファイル名またはパスで照合
    const lines = stack.split("\n");
    for (const line of lines) {
        for (const [key, proc] of processes.entries()) {
            if (proc.isShell) continue;
            if (proc.entry) {
                const entryName = basename(proc.entry);
                if (entryName && line.includes(entryName)) return key;
            } else if (proc.path && line.includes(proc.path)) {
                return key;
            }
        }
    }
    return null;
}

function findProcessKeyByError(e) {
    // 0. ?pid=XX タグが含まれていれば最優先で特定
    const pidKey = findProcessKeyByPidTag(e.filename) || findProcessKeyByPidTag(e.error?.stack);
    if (pidKey) return pidKey;

    // 1. DOM要素（画像・スクリプト読み込み失敗など）からウィンドウを逆引き
    const targetWin = e.target instanceof Element ? e.target.closest(".window") : null;
    if (targetWin?.dataset?.processKey) {
        return targetWin.dataset.processKey;
    }

    // 2. JS実行時エラーのソースファイルURL（e.filename）から稼働中アプリを逆引き
    if (e.filename) {
        for (const [key, proc] of processes.entries()) {
            if (proc.isShell) continue; // シェルは誤爆終了させない
            const entryName = proc.entry ? basename(proc.entry) : "";
            if (entryName && e.filename.includes(entryName)) {
                return key;
            }
        }
    }
    return null;
}

export function initSystemErrorHandler() {
    if (systemErrorHandlerInstalled) return;
    systemErrorHandlerInstalled = true;

    // 非同期エラー（Promise拒否）
    window.addEventListener("unhandledrejection", (e) => {
        if (isSystemDead) return;
        const error = e.reason;
        const msg = error?.message || String(error);

        if (isCriticalError(msg)) {
            showBSOD(`KERNEL_UNHANDLED_REJECTION: ${msg}`, error);
        } else {
            console.warn("[Kernel Notice] Non-critical unhandled rejection:", msg);
            logSystemEvent(
                "System",
                "Warning",
                "KernelErrorHandler",
                2002,
                "Async Exception Handling",
                `Unhandled promise rejection caught: ${msg}`
            );

            const key = findProcessKeyByStack(error);
            if (key && processes.has(key)) {
                console.warn(`[Kernel] Async app error detected. Terminating process: ${key}`);
                getWindowAPI()?.errorWindow(`アプリケーションエラー（非同期処理）が発生したため終了しました。\n${msg}`, { taskbar: false });
                killProcess(key);
            }
        }
    });

    // 通常のエラー（キャプチャフェーズで要素読み込みエラーも捕捉）
    window.addEventListener("error", (e) => {
        if (isSystemDead) return;
        const msg = e.error ? e.error.message : (e.message || "Resource load error");
        if (isCriticalError(msg)) {
            showBSOD(`KERNEL_FAULT: ${msg}`, e.error);
        } else {
            logSystemEvent(
                "System",
                "Warning",
                "KernelErrorHandler",
                2001,
                "Exception Handling",
                `Non-critical exception caught: ${msg}`
            );

            const key = findProcessKeyByError(e);
            if (key && processes.has(key)) {
                console.warn(`[Kernel] App error detected. Terminating process: ${key}`);
                getWindowAPI()?.errorWindow(`アプリケーションエラーが発生したため終了しました。\n${msg}`, { taskbar: false });
                killProcess(key);
            }
        }
    }, true);
}

/* =========================
   Metrics（CPU / Memory） & Kernel Daemons
========================= */

let cpuLoad = 0;
let lastTick = performance.now();
let cpuMetricsInterval = null;
let processWatchdogInterval = null;

function getMemoryMB() {
    // ★ performance.memory が無い環境（Chrome以外）へのガードを追加 (維持)
    const mem = (performance && performance.memory) ? performance.memory.usedJSHeapSize : 0;
    return Math.round(mem / 1024 / 1024);
}

function startKernelDaemons() {
    stopKernelDaemons();
    lastTick = performance.now();
    cpuLoad = 0;

    // イベントループ負荷からCPU近似値を計測
    cpuMetricsInterval = setInterval(() => {
        if (isSystemDead || window.nexser?.isLoggingOff) return;
        const now = performance.now();
        const diff = now - lastTick;
        lastTick = now;

        // タブがバックグラウンドに回った際のタイマー遅延（スロットリング）を除外
        if (diff > 2000) {
            cpuLoad = 0;
        } else {
            const lag = Math.max(0, diff - 1000);
            cpuLoad = Math.min(100, Math.round((lag / 1000) * 100));
        }
    }, 1000);

    // プロセス監視（メトリクス更新＆フリーズ検知）
    processWatchdogInterval = setInterval(() => {
        if (isSystemDead || window.nexser?.isLoggingOff) return;
        const mem = getMemoryMB();
        const now = performance.now();

        for (const [key, proc] of Array.from(processes.entries())) {
            proc.memory = mem;
            proc.cpu = cpuLoad;
            if (proc.isShell) continue;

            // フリーズ監視（アプリ側で heartbeat が設定されている場合）
            if (proc.lastHeartbeat && ((now - proc.lastHeartbeat) > 10000)) {
                console.error(`[Watchdog] Freeze detected in process ${proc.pid} (${proc.path}). Terminating.`);
                killProcess(key);
                getWindowAPI()?.errorWindow(`アプリケーション '${basename(proc.path)}' が応答しないため、強制終了しました。`, { taskbar: true });
            }
        }
    }, 2000);
}

function stopKernelDaemons() {
    if (cpuMetricsInterval !== null) {
        clearInterval(cpuMetricsInterval);
        cpuMetricsInterval = null;
    }
    if (processWatchdogInterval !== null) {
        clearInterval(processWatchdogInterval);
        processWatchdogInterval = null;
    }
    cpuLoad = 0;
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

/* =========================
   仮想FSパッケージ（フォルダ構造アプリ）ローダー & サンドボックス制御
========================= */
const SANDBOX_RESTRICTED_PREFIXES = [
    "c:/system",
    "c:/programs/applications",
    "c:/programs/packages",
    "c:/programs/controlpanel",
    "c:/programs/accessories",
    "c:/programs/settings"
];

/**
 * 動的アプリからのFSアクセス可否を判定する
 * - ユーザー領域 (C:/Desktop, C:/Programs/Documents, Music, Picture, Movie 等) は読み書き許可
 * - 自身のパッケージルート配下は読み取り許可（書き込みは禁止）
 * - システム領域・他アプリ領域はブロック
 */
function assertSandboxPathAccess(targetPath, mode = "read", packageRoot = null) {
    const norm = normalizePath(targetPath).replace(/\/+$/, "") || "C:/";
    const lowerNorm = norm.toLowerCase();

    if (packageRoot) {
        const normPkg = normalizePath(packageRoot).replace(/\/+$/, "").toLowerCase();
        if (lowerNorm === normPkg || lowerNorm.startsWith(normPkg + "/")) {
            if (mode === "read") return norm;
            throw new Error(`[Security] パッケージ実行領域 '${norm}' への書き込み・削除は許可されていません。データ保存は C:/Programs/Documents 等または syscall.saveSetting を使用してください。`);
        }
    }

    const isRestricted = SANDBOX_RESTRICTED_PREFIXES.some(
        prefix => lowerNorm === prefix || lowerNorm.startsWith(prefix + "/")
    );
    if (isRestricted) {
        throw new Error(`[Security] システム保護領域 '${norm}' へのアクセス (${mode}) は許可されていません。`);
    }
    return norm;
}

const KNOWN_APP_PERMISSIONS = new Set([
    "fs:read",
    "fs:write",
    "settings",
    "app:launch",
    "ipc",
    "window:preview",
    "system:assoc",
    "fs:icon",
    "log"
]);

// permissions 未宣言の既存パッケージ向けデフォルト権限（後方互換性を維持）
const LEGACY_DEFAULT_PERMISSIONS = new Set([
    "fs:read",
    "fs:write",
    "settings",
    "app:launch",
    "ipc",
    "window:preview",
    "fs:icon",
    "log"
]);

/**
 * パッケージの manifest.json / ノード定義から実効権限セットを解決する
 */
function resolvePackagePermissions(isPackageApp, pkgManifest, item) {
    if (!isPackageApp) {
        return { allowAll: true, set: new Set(KNOWN_APP_PERMISSIONS) };
    }
    const rawPerms = Array.isArray(pkgManifest?.permissions)
        ? pkgManifest.permissions
        : (Array.isArray(item?.permissions) ? item.permissions : null);

    if (!rawPerms) {
        return { allowAll: false, set: new Set(LEGACY_DEFAULT_PERMISSIONS) };
    }
    if (rawPerms.includes("*")) {
        return { allowAll: true, set: new Set(KNOWN_APP_PERMISSIONS) };
    }

    const granted = new Set();
    for (const p of rawPerms) {
        const perm = String(p || "").trim();
        if (KNOWN_APP_PERMISSIONS.has(perm)) {
            granted.add(perm);
        }
    }
    return { allowAll: false, set: granted };
}

/**
 * コメント・文字列リテラルを除外して静的セキュリティ検査の誤爆を防ぐ
 */
function stripCommentsAndStringsForSecurityScan(code) {
    return String(code || "")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/\/\/[^\n\r]*/g, " ")
        .replace(/`(?:\\[\s\S]|[^`\\])*`/g, '""')
        .replace(/'(?:\\[\s\S]|[^'\\])*'/g, '""')
        .replace(/"(?:\\[\s\S]|[^"\\])*"/g, '""');
}

/**
 * 動的コードの危険な直接参照・サンドボックス脱出手段を検査する
 */
function assertSafeDynamicCode(sourceCode, filePath) {
    const scanned = stripCommentsAndStringsForSecurityScan(sourceCode);

    if (/\bimport\s*\(/.test(scanned)) {
        throw new Error(`[Security] ${filePath}: ネイティブ動的 import() は禁止されています。代わりに await syscall.importModule("./file.js") を使用してください。`);
    }
    if (/\b(window|globalThis|self)\s*(\.\s*nexser|\[\s*['"]nexser['"]\s*\])/.test(sourceCode)) {
        throw new Error(`[Security] ${filePath}: システムグローバル (nexser) への直接参照は禁止されています。syscall または windowAPI を使用してください。`);
    }
    if (/\b_nexserOriginalDispatchEvent\b/.test(scanned)) {
        throw new Error(`[Security] ${filePath}: カーネル内部フックへの直接参照は禁止されています。`);
    }
    if (/\beval\s*\(/.test(scanned) || /\bnew\s+Function\b/.test(scanned) || /(?:^|[^.\w$])Function\s*\(/.test(scanned)) {
        throw new Error(`[Security] ${filePath}: eval() や Function コンストラクタによる動的コード実行は禁止されています。`);
    }
    if (/\b(indexedDB|localStorage|sessionStorage)\b/.test(scanned) || /\bdocument\s*\.\s*cookie\b/.test(scanned)) {
        throw new Error(`[Security] ${filePath}: ブラウザストレージへの直接アクセスは禁止されています。syscall.saveSetting / syscall.writeFile を使用してください。`);
    }
}

/**
 * パッケージ内の相対パスを packageRoot 内に限定して解決する
 */
function resolvePackageInternalPath(packageRoot, baseDir, relPath) {
    const normRoot = normalizePath(packageRoot).replace(/\/+$/, "");
    const cleanRel = String(relPath || "").replace(/\\/g, "/").trim();
    if (!cleanRel) throw new Error("空のパスは指定できません。");

    const candidateBase = cleanRel.startsWith("/")
        ? `${normRoot}/${cleanRel.replace(/^\/+/, "")}`
        : `${baseDir.replace(/\/+$/, "")}/${cleanRel}`;
    const resolved = normalizePath(candidateBase).replace(/\/+$/, "");

    const lowerRoot = normRoot.toLowerCase();
    const lowerResolved = resolved.toLowerCase();
    if (lowerResolved !== lowerRoot && !lowerResolved.startsWith(lowerRoot + "/")) {
        throw new Error(`[Security] パッケージ外へのアクセスは禁止されています: ${relPath}`);
    }
    return resolved;
}

/**
 * パッケージ内の仮想JSファイルを再帰的に解析し、Blob URLベースのESモジュールグラフを構築する
 */
async function compileVirtualPackageModule(packageRoot, targetFilePath, pid, resources, compiledCache = new Map(), resolvingStack = new Set()) {
    const normRoot = normalizePath(packageRoot).replace(/\/+$/, "");

    // 拡張子省略 (.js / /index.js) の自動補完
    let resolvedPath = normalizePath(targetFilePath).replace(/\/+$/, "");
    let fileNode = resolveFS(resolvedPath);
    if (!fileNode || fileNode.type !== "file") {
        if (resolveFS(`${resolvedPath}.js`)?.type === "file") {
            resolvedPath = `${resolvedPath}.js`;
            fileNode = resolveFS(resolvedPath);
        } else if (resolveFS(`${resolvedPath}/index.js`)?.type === "file") {
            resolvedPath = `${resolvedPath}/index.js`;
            fileNode = resolveFS(resolvedPath);
        }
    }

    const lowerRoot = normRoot.toLowerCase();
    if (!resolvedPath.toLowerCase().startsWith(lowerRoot + "/")) {
        throw new Error(`[Security] パッケージ外のモジュールは読み込めません: ${resolvedPath}`);
    }
    if (!fileNode || fileNode.type !== "file") {
        throw new Error(`モジュールが見つかりません: ${resolvedPath}`);
    }

    if (compiledCache.has(resolvedPath)) {
        return compiledCache.get(resolvedPath);
    }
    if (resolvingStack.has(resolvedPath)) {
        throw new Error(`循環インポートが検出されました: ${resolvedPath}`);
    }

    resolvingStack.add(resolvedPath);

    try {
        const raw = await readFileContent(resolvedPath);
        const sourceCode = typeof raw === "string" ? raw : "";
        assertSafeDynamicCode(sourceCode, resolvedPath);

        const currentDir = resolvedPath.slice(0, resolvedPath.lastIndexOf("/")) || normRoot;

        // 静的 import / export ... from "..." および import "..." を抽出して書き換え
        const specifierRegex = /(\b(?:import|export)\s+(?:[\s\S]*?\bfrom\s+)?)(['"])([^'"]+)\2/g;
        const matches = Array.from(sourceCode.matchAll(specifierRegex));

        let transformedCode = "";
        let lastIndex = 0;

        for (const match of matches) {
            const fullMatch = match[0];
            const prefix = match[1];
            const quote = match[2];
            const specifier = match[3];
            const matchStart = match.index;

            transformedCode += sourceCode.slice(lastIndex, matchStart);

            if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
                throw new Error(`[Security] ${resolvedPath}: パッケージ外部モジュール '${specifier}' の直接 import は許可されていません。OS機能は syscall を使用してください。`);
            }

            const depPath = resolvePackageInternalPath(normRoot, currentDir, specifier);
            const depBlobUrl = await compileVirtualPackageModule(
                normRoot,
                depPath,
                pid,
                resources,
                compiledCache,
                resolvingStack
            );

            transformedCode += `${prefix}${quote}${depBlobUrl}${quote}`;
            lastIndex = matchStart + fullMatch.length;
        }
        transformedCode += sourceCode.slice(lastIndex);

        // DevToolsおよびクラッシュ時PID逆引き用の sourceURL を付与
        const finalCode = `${transformedCode}\n//# sourceURL=${resolvedPath}?pid=${pid}`;
        const blob = new Blob([finalCode], { type: "text/javascript" });
        const blobUrl = URL.createObjectURL(blob);

        resources.blobUrls.add(blobUrl);
        compiledCache.set(resolvedPath, blobUrl);
        return blobUrl;
    } finally {
        resolvingStack.delete(resolvedPath);
    }
}

// ★ アプリ起動時の必須条件ポリシー（boot.js の PACKAGE_INSTALL_POLICY と同期）
const PACKAGE_RUNTIME_POLICY = {
    requiredFiles: ["manifest.json"],
    requiredDirs: ["assets"], // 必須フォルダを増やす例: ["assets", "core"] / 不要なら []
    requirePermissions: true  // false にすると permissions 未記載パッケージも起動許可
};

function isRelativePackageAssetPath(val) {
    if (typeof val !== "string" || !val.trim()) return false;
    const trimmed = val.trim();
    if (trimmed.startsWith("data:") || /^https?:\/\//i.test(trimmed)) return false;
    return trimmed.includes("/") || trimmed.includes("\\") || /\.(png|svg|webp|ico|jpg|jpeg|gif)$/i.test(trimmed);
}

/**
 * パッケージ内の manifest.json を読み込み、パース結果とエラー理由を返す
 */
async function loadPackageManifest(packageRoot) {
    const normRoot = normalizePath(packageRoot).replace(/\/+$/, "");
    const manifestPath = `${normRoot}/manifest.json`;
    const manifestNode = resolveFS(manifestPath);
    if (!manifestNode || manifestNode.type !== "file") {
        return { data: null, error: "必須ファイル 'manifest.json' が見つかりません。" };
    }

    try {
        const raw = await readFileContent(manifestPath);
        if (typeof raw !== "string" || !raw.trim()) {
            return { data: null, error: "'manifest.json' の内容が空です。" };
        }
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return { data: null, error: "'manifest.json' の形式が不正です（JSONオブジェクト必須）。" };
        }
        return { data: parsed, error: null };
    } catch (e) {
        console.warn(`[Kernel] Failed to parse manifest.json at ${manifestPath}:`, e);
        return { data: null, error: `'manifest.json' の構文エラー: ${e.message}` };
    }
}

/**
 * インストール済みパッケージが起動必須条件を満たしているか厳格検証する
 */
function validateInstalledPackage(packageRoot, manifestResult, appPath) {
    const errors = [];
    const normRoot = normalizePath(packageRoot).replace(/\/+$/, "");
    const pkgNode = resolveFS(normRoot);

    if (!pkgNode || pkgNode.type !== "folder") {
        errors.push(`パッケージフォルダが見つかりません: '${normRoot}'`);
    } else {
        // 1. OS共通の必須ファイル検証
        for (const reqFile of PACKAGE_RUNTIME_POLICY.requiredFiles) {
            try {
                const fullPath = resolvePackageInternalPath(normRoot, normRoot, reqFile);
                const node = resolveFS(fullPath);
                if (!node || node.type !== "file") {
                    errors.push(`必須ファイルが見つかりません: '${reqFile}'`);
                }
            } catch (err) {
                errors.push(err.message);
            }
        }

        // 2. OS共通の必須フォルダ検証
        for (const reqDir of PACKAGE_RUNTIME_POLICY.requiredDirs) {
            try {
                const fullPath = resolvePackageInternalPath(normRoot, normRoot, reqDir);
                const node = resolveFS(fullPath);
                if (!node || node.type !== "folder") {
                    errors.push(`必須フォルダが見つかりません: '${reqDir}/'`);
                }
            } catch (err) {
                errors.push(err.message);
            }
        }
    }

    const pkgManifest = manifestResult?.data || null;
    if (!pkgManifest) {
        errors.push(manifestResult?.error || "'manifest.json' を読み込めません。");
    } else {
        if (typeof pkgManifest.name !== "string" || !pkgManifest.name.trim()) {
            errors.push("manifest.json に必須項目 'name' がありません。");
        }
        if (typeof pkgManifest.version !== "string" || !/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(pkgManifest.version.trim())) {
            errors.push("manifest.json に有効な必須項目 'version' がありません。");
        }
        if (typeof pkgManifest.main !== "string" || !pkgManifest.main.trim()) {
            errors.push("manifest.json に必須項目 'main' がありません。");
        } else {
            try {
                const entryPath = resolvePackageInternalPath(normRoot, normRoot, pkgManifest.main);
                const entryNode = resolveFS(entryPath);
                if (!entryPath.toLowerCase().endsWith(".js") || !entryNode || entryNode.type !== "file") {
                    errors.push(`必須エントリファイルが見つかりません: '${pkgManifest.main}'`);
                }
            } catch (err) {
                errors.push(err.message);
            }
        }

        if (PACKAGE_RUNTIME_POLICY.requirePermissions && !Array.isArray(pkgManifest.permissions)) {
            errors.push("manifest.json に必須項目 'permissions'（配列）がありません。");
        }
        if (Array.isArray(pkgManifest.permissions)) {
            for (const p of pkgManifest.permissions) {
                const perm = String(p || "").trim();
                if (perm !== "*" && !KNOWN_APP_PERMISSIONS.has(perm)) {
                    errors.push(`manifest.json に不明な権限が含まれています: '${p}'`);
                }
            }
        }

        if (pkgManifest.styles !== undefined) {
            const stylesArr = Array.isArray(pkgManifest.styles)
                ? pkgManifest.styles
                : (typeof pkgManifest.styles === "string" ? [pkgManifest.styles] : null);
            if (!stylesArr) {
                errors.push("manifest.json の 'styles' の形式が不正です。");
            } else {
                for (const st of stylesArr) {
                    try {
                        const stylePath = resolvePackageInternalPath(normRoot, normRoot, st);
                        const styleNode = resolveFS(stylePath);
                        if (!styleNode || styleNode.type !== "file") {
                            errors.push(`manifest.json で指定されたCSSファイルが見つかりません: '${st}'`);
                        }
                    } catch (err) {
                        errors.push(err.message);
                    }
                }
            }
        }

        if (isRelativePackageAssetPath(pkgManifest.icon)) {
            try {
                const iconPath = resolvePackageInternalPath(normRoot, normRoot, pkgManifest.icon);
                const iconNode = resolveFS(iconPath);
                if (!iconNode || iconNode.type !== "file") {
                    errors.push(`manifest.json で指定されたアイコンファイルが見つかりません: '${pkgManifest.icon}'`);
                }
            } catch (err) {
                errors.push(err.message);
            }
        }

        if (Array.isArray(pkgManifest.requiredFiles)) {
            for (const rf of pkgManifest.requiredFiles) {
                try {
                    const rfPath = resolvePackageInternalPath(normRoot, normRoot, rf);
                    const rfNode = resolveFS(rfPath);
                    if (!rfNode || rfNode.type !== "file") {
                        errors.push(`必須ファイルが見つかりません: '${rf}'`);
                    }
                } catch (err) {
                    errors.push(err.message);
                }
            }
        }

        if (Array.isArray(pkgManifest.requiredDirs)) {
            for (const rd of pkgManifest.requiredDirs) {
                try {
                    const rdPath = resolvePackageInternalPath(normRoot, normRoot, rd);
                    const rdNode = resolveFS(rdPath);
                    if (!rdNode || rdNode.type !== "folder") {
                        errors.push(`必須フォルダが見つかりません: '${rd}/'`);
                    }
                } catch (err) {
                    errors.push(err.message);
                }
            }
        }
    }

    if (errors.length > 0) {
        logSystemEvent(
            "Security",
            "Error",
            basename(appPath),
            3002,
            "Package Integrity Failed",
            `パッケージ '${basename(appPath)}' の必須条件チェックに失敗したため起動を拒否しました: ${errors.join(" / ")}`
        );
        throw new Error(`パッケージの必須条件を満たしていないため起動できません。\n・${errors.join("\n・")}`);
    }

    return pkgManifest;
}

/* ===== カーネル初期化 ===== */

/**
 * カーネルを介してウィンドウを生成し、プロセス管理へ自動登録する
 */
export function createKernelWindow(title, options = {}) {
    // BSOD中（モーダル含む全ウィンドウ）、およびログオフ・CUI待機中の非モーダル生成を実DOMへ通さない
    if (isSystemDead || ((window.nexser?.isLoggingOff || !isGuiActive) && !options._modal)) {
        const detachedWin = document.createElement("div");
        detachedWin.className = "window";
        detachedWin.dataset.title = title;
        detachedWin._destroy = () => { };
        detachedWin._closeDialog = () => { };
        detachedWin._applyRealIcon = () => { };

        const detachedContent = document.createElement("div");
        detachedContent.className = "content";
        detachedWin.appendChild(detachedContent);
        return detachedContent;
    }

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

    // カーネル管理下の統一ファイルシステムAPI（標準アプリ・シェルからも直接import不要で利用可能）
    const kernelFS = Object.freeze({
        readFile: async (targetPath, cwd = "C:/") => await readFileContent(targetPath, cwd),
        writeFile: async (targetPath, data, cwd = "C:/", ownerPid = "system") => {
            if (isSystemDead) return false;
            const ok = writeFileContent(targetPath, data, cwd, ownerPid);
            await forceSave();
            window.dispatchEvent(new Event("fs-updated"));
            return ok;
        },
        ensureDir: async (targetPath, cwd = "C:/", ownerPid = "system") => {
            if (isSystemDead) return null;
            const node = ensureDirectory(targetPath, cwd, ownerPid);
            await forceSave();
            window.dispatchEvent(new Event("fs-updated"));
            return Boolean(node);
        },
        listDir: (targetPath = "C:/", cwd = "C:/") => listDirectory(targetPath, cwd),
        stat: (targetPath, cwd = "C:/") => statFS(targetPath, cwd),
        deleteNode: async (targetPath, cwd = "C:/", ownerPid = "system") => {
            if (isSystemDead) return false;
            const ok = await deleteFSNode(targetPath, cwd, ownerPid);
            await forceSave();
            window.dispatchEvent(new Event("fs-updated"));
            return ok;
        },
        isLocked: (targetPath, ownerPid = null) => isFileLocked(targetPath, ownerPid),
        flush: async (fullSync = false) => await forceSave(fullSync)
    });

    // カーネル管理下の統一設定API（settingsストアとアプリkv設定の窓口を一元化）
    const kernelSettings = Object.freeze({
        load: async (key, defaultValue = null) => {
            const { loadSetting } = await import("./apps/settings.js");
            const val = await loadSetting(key);
            return val === null ? defaultValue : val;
        },
        save: async (key, value) => {
            if (isSystemDead) return false;
            const { saveSetting } = await import("./apps/settings.js");
            return await saveSetting(key, value);
        }
    });

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
        getSystemState: () => Object.freeze({
            isGuiActive: Boolean(isGuiActive),
            isBooting: Boolean(window.nexser?.isBooting),
            isLoggingOff: Boolean(window.nexser?.isLoggingOff),
            isSystemDead: Boolean(isSystemDead),
            processCount: processes.size,
            cpuLoad,
            memoryMB: getMemoryMB()
        }),
        fs: kernelFS,
        settings: kernelSettings,
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

let logoffEventGuardInstalled = false;

// ログオフ中・BSOD中・CUI待機中に飛ぶGUI更新イベントをカーネル層で一括遮断
function installLogoffEventGuard() {
    if (logoffEventGuardInstalled || typeof window === "undefined") return;
    logoffEventGuardInstalled = true;

    const blockedEventsDuringShutdown = new Set([
        "taskbar-style-changed",
        "taskbar-size-external-change",
        "desktop-resize",
        "request-refresh-start-menu",
        "request-start-menu-position-update",
        "setting-changed",
        "app-setting-changed",
        "fs-updated",
        "recent-updated",
        "screensaver-settings-changed"
    ]);

    const shouldBlockGuiEvent = () => Boolean(window.nexser?.isLoggingOff || isSystemDead || !isGuiActive);

    // import時に先行登録されたリスナー（desktop.js等）より前で確実に止めるため dispatchEvent 入口をフック
    if (!window._nexserOriginalDispatchEvent) {
        const originalDispatchEvent = window.dispatchEvent.bind(window);
        window._nexserOriginalDispatchEvent = originalDispatchEvent;
        try {
            window.dispatchEvent = function (event) {
                if (shouldBlockGuiEvent() && event && blockedEventsDuringShutdown.has(event.type)) {
                    return false;
                }
                return originalDispatchEvent(event);
            };
        } catch (err) {
            console.warn("[Kernel] Failed to wrap window.dispatchEvent:", err);
        }
    }

    const blockIfShuttingDown = (e) => {
        if (shouldBlockGuiEvent()) {
            e.stopImmediatePropagation();
        }
    };

    for (const eventName of blockedEventsDuringShutdown) {
        window.addEventListener(eventName, blockIfShuttingDown, { capture: true });
    }
}

// 1. カーネルスペース（DOM注入とエラー制御）
export async function initKernelSpaceAsync(progressCallback = () => { }) {
    const root = document.getElementById("os-root");
    if (!root) throw new Error("os-root not found");

    // ⭐ 再boot時にシステム状態・FS/ストレージ保護・PIDカウンター・プロセス管理を完全にリセット
    isSystemDead = false;
    isGuiActive = true;
    setStorageHalted(false);
    setFSReadOnly(false);
    pidCounter = 1;
    processes.clear();
    explorerWindows.clear();
    tabAppInstances.clear();
    launching.clear();

    installLogoffEventGuard();
    initSystemErrorHandler();
    initKernelAPI(); // ⭐ カーネルAPIの初期化と凍結登録
    startKernelDaemons();

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
    const visited = new WeakSet();

    function walk(node) {
        if (!node || typeof node !== "object" || visited.has(node)) return;
        visited.add(node);

        for (const val of Object.values(node)) {
            if (!isChildNodeObject(val)) continue;
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

// ⭐ FS上で shell: true が定義されたアプリケーションを再帰探索して自動起動する
export async function launchShellApps(onProgress = null) {
    try {
        const { FS } = await import("./fs.js");
        const programsRoot = FS["C:"]?.Programs;
        if (!programsRoot) return [];

        const shellEntries = [];
        const visited = new WeakSet();

        function collectShellApps(node, currentPath) {
            if (!node || typeof node !== "object" || visited.has(node)) return;
            visited.add(node);

            for (const [name, child] of Object.entries(node)) {
                if (!child || typeof child !== "object" || typeof child.type !== "string") continue;
                const childPath = `${currentPath}/${name}`;
                if (child.type === "app" && child.shell === true) {
                    shellEntries.push({ name, path: childPath });
                } else if (child.type === "folder") {
                    collectShellApps(child, childPath);
                }
            }
        }

        collectShellApps(programsRoot, "C:/Programs");

        const launchedList = [];
        for (let i = 0; i < shellEntries.length; i++) {
            const { name, path: appPath } = shellEntries[i];
            if (typeof onProgress === "function") {
                onProgress(name, appPath, i + 1, shellEntries.length);
            }
            console.log(`[Kernel] Launching shell app: ${appPath}`);
            await launch(appPath);
            launchedList.push(name);
        }
        return launchedList;
    } catch (e) {
        console.error("[Kernel] Failed to launch shell apps:", e);
        return [];
    }
}

// 2. システムシェル基盤（タスクバー・UIエフェクト）構築 ※個別シェルアプリは FS 定義から launchShellApps で起動
export async function initShellAsync(progressCallback = () => { }) {
    progressCallback("Initializing System Shell (Taskbar & UI Effects)...");

    await initTaskbar();
    await new Promise(r => requestAnimationFrame(r));

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

        // ★ 永続化されたカスタム拡張子・アイコン設定を復元
        try {
            const assocJson = await readFileContent("C:/System/FileAssociations.json");
            if (typeof assocJson === "string" && assocJson.trim()) {
                importCustomAssociations(JSON.parse(assocJson));
            }
        } catch (assocErr) {
            console.warn("[Kernel] Failed to load FileAssociations.json:", assocErr);
        }

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

        // ★ 外部ウィジェット等で保存されたプレビュー設定を、アプリ未起動でもOS起動直後に確実反映
        try {
            const { syncWidgetToolPackageSettings } = await import("./apps/settings.js");
            if (typeof syncWidgetToolPackageSettings === "function") {
                await syncWidgetToolPackageSettings();
            }
        } catch (syncErr) {
            console.warn("[Kernel] Failed to sync widget preview settings:", syncErr);
        }

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
        isGuiActive = false;
        window.nexser.isBooting = false;
        stopKernelDaemons();
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

export async function launch(rawPath, options = {}) {
    if (isSystemDead || window.nexser?.isLoggingOff || !isGuiActive) {
        return;
    }

    if (typeof rawPath !== "string" || !rawPath.trim()) {
        getWindowAPI()?.errorWindow(`無効なパス: ${rawPath}`, { taskbar: false });
        return;
    }

    const path = normalizePath(rawPath);
    if (launching.has(path)) return;
    launching.add(path);
    try {
        const item = resolveFS(path);
        if (!item) {
            getWindowAPI()?.errorWindow(`対象が見つかりません: ${path}`, { taskbar: false });
            return;
        }

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
            async (result) => {
                if (!result) return;
                if (item.system === true) {
                    getWindowAPI()?.errorWindow("システム保護されたショートカットは削除できません。", { taskbar: false });
                    return;
                }
                const parentPath = path.slice(0, path.lastIndexOf("/")) || "C:/";
                const parentNode = resolveFS(parentPath);
                const linkName = basename(path);
                if (parentNode && delete parentNode[linkName]) {
                    const { markDefaultDeleted, forceSave } = await import("./fs.js");
                    await markDefaultDeleted(path);
                    await forceSave();
                    window.dispatchEvent(new Event("fs-updated"));
                }
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
        const actualContent = await readFileContent(path);
        await mod.default(content, { name: basename(path), content: actualContent });
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
    // タブ対応アプリのチェック（パッケージアプリは path をキーにして undefined 衝突を防止）
    const tabInstanceKey = item.entry || path;
    if (tabInstanceKey && tabAppInstances.has(tabInstanceKey)) {
        const instance = tabAppInstances.get(tabInstanceKey);
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
            tabAppInstances.delete(tabInstanceKey);
        }
    }

    const isExplorer = item.entry?.includes("explorer.js");
    const explorerTargetKey = isExplorer ? normalizePath(options.path || "C:/Desktop") : null;
    const uniqueKey = options.uniqueKey ?? (item.singleton ? path : null);
    let existingWin = isExplorer ? explorerWindows.get(explorerTargetKey) : (uniqueKey ? processes.get(uniqueKey)?.window : null);

    if (existingWin && document.body.contains(existingWin)) {
        if (existingWin.dataset.minimized === "true") existingWin._taskbarBtn?.click();
        else getWindowAPI()?.bringToFront(existingWin);
        return;
    }

    if (isExplorer) explorerWindows.delete(explorerTargetKey);
    if (uniqueKey) processes.delete(uniqueKey);

    // ==========================================
    // 1. 変数とプロセス管理リソースコンテナの定義
    // ==========================================
    const isPackageApp = Boolean(item.packageRoot);
    if (!isPackageApp && !item.entry) {
        throw new Error("単一ファイル形式のアプリは廃止されました。パッケージフォルダ形式で再インストールしてください。");
    }

    const packageRoot = isPackageApp ? normalizePath(item.packageRoot).replace(/\/+$/, "") : null;
    let pkgManifest = null;
    if (isPackageApp) {
        const manifestResult = await loadPackageManifest(packageRoot);
        pkgManifest = validateInstalledPackage(packageRoot, manifestResult, path);
    }

    const mergedWindowOptions = {
        ...(item.windowOptions || {}),
        ...(pkgManifest?.windowOptions || {})
    };
    const appDisplayLabel = pkgManifest?.name || item.name || basename(path);
    const displayName = (options?.path && options.path !== path)
        ? basename(options.path)
        : (options.showFullPath ? path : appDisplayLabel);
    const isFrameless = Boolean(item.frameless || pkgManifest?.frameless || options.frameless);
    const isShell = Boolean(item.shell || options.shell);
    const processPath = (isExplorer && options.path) ? normalizePath(options.path) : path;
    const key = uniqueKey ?? `app:${processPath}:${Date.now()}`;
    const pid = pidCounter++;
    const appSettingNamespace = basename(processPath).replace(/\.app$/i, "").toLowerCase();

    const resources = {
        disposed: false,
        timeouts: new Set(),
        intervals: new Set(),
        listeners: [],
        blobUrls: new Set(),
        styles: new Set(),
        compiledModules: new Map()
    };

    const isProcessActive = () => !resources.disposed && !isSystemDead && !window.nexser?.isLoggingOff && isGuiActive;

    const appPermissions = resolvePackagePermissions(isPackageApp, pkgManifest, item);
    const hasPermission = (perm) => appPermissions.allowAll || appPermissions.set.has(perm);
    const assertPermission = (perm) => {
        if (!hasPermission(perm)) {
            logSystemEvent(
                "Security",
                "Warning",
                basename(processPath),
                3001,
                "Permission Denied",
                `アプリ '${appDisplayLabel}' (PID: ${pid}) に権限 '${perm}' がないため実行を拒否しました。`
            );
            throw new Error(`[Security] 権限 '${perm}' が manifest.json で宣言されていないため実行できません。`);
        }
    };

    const normalizeSettingKey = (settingKey) => {
        const clean = String(settingKey ?? "").trim();
        if (!clean || clean.includes(":") || clean.length > 128) {
            throw new Error(`無効な設定キーです: ${settingKey}`);
        }
        return clean;
    };

    const rawWindowAPI = getWindowAPI();
    const safeWindowAPI = rawWindowAPI ? Object.freeze({
        createWindow: (...args) => isProcessActive() ? rawWindowAPI.createWindow?.(...args) : null,
        destroyWindow: (...args) => rawWindowAPI.destroyWindow?.(...args),
        alertWindow: (...args) => isProcessActive() ? rawWindowAPI.alertWindow?.(...args) : null,
        confirmWindow: (...args) => isProcessActive() ? rawWindowAPI.confirmWindow?.(...args) : null,
        errorWindow: (...args) => isProcessActive() ? rawWindowAPI.errorWindow?.(...args) : null,
        progressWindow: (...args) => isProcessActive() ? rawWindowAPI.progressWindow?.(...args) : null,
        showModalWindow: (...args) => isProcessActive() ? rawWindowAPI.showModalWindow?.(...args) : null,
        updateWindowTitle: (...args) => isProcessActive() ? rawWindowAPI.updateWindowTitle?.(...args) : null,
        bringToFront: (...args) => isProcessActive() ? rawWindowAPI.bringToFront?.(...args) : null,
        setPreviewEnabled: (...args) => {
            if (!isProcessActive()) return;
            assertPermission("window:preview");
            return rawWindowAPI.setPreviewEnabled?.(...args);
        },
        setTaskbarPreviewEnabled: (enabled) => {
            if (!isProcessActive()) return;
            assertPermission("window:preview");
            if (typeof window.setTaskbarPreviewEnabled === "function") {
                window.setTaskbarPreviewEnabled(Boolean(enabled));
            }
        }
    }) : null;

    const injectStyleElement = (cssText, sourceTag = "inline") => {
        if (!isProcessActive()) return null;
        const styleEl = document.createElement("style");
        styleEl.dataset.nexserAppPid = String(pid);
        styleEl.dataset.nexserStyleSource = sourceTag;
        styleEl.textContent = String(cssText || "");
        document.head.appendChild(styleEl);
        resources.styles.add(styleEl);
        return styleEl;
    };

    const resolveDynamicPath = (targetPath, mode = "read") => {
        const rawTarget = String(targetPath || "");
        const baseCwd = (isPackageApp && (rawTarget.startsWith("./") || rawTarget.startsWith("../")))
            ? packageRoot
            : "C:/";
        const norm = normalizePath(rawTarget, baseCwd);
        if (isPackageApp) {
            return assertSandboxPathAccess(norm, mode, packageRoot);
        }
        return norm;
    };

    const baseSyscall = {
        pid,
        path: processPath,
        permissions: Object.freeze(Array.from(appPermissions.set)),
        hasPermission: (perm) => hasPermission(perm),
        packageInfo: isPackageApp ? Object.freeze({
            name: appDisplayLabel,
            version: pkgManifest?.version || item.version || "1.0.0",
            root: packageRoot,
            main: pkgManifest?.main || item.main || "main.js"
        }) : null,
        windowAPI: safeWindowAPI,
        exit: () => killProcess(key),
        launch: async (targetPath, launchOpts = {}) => {
            if (!isProcessActive()) return;
            assertPermission("app:launch");
            return await launch(targetPath, launchOpts);
        },
        postMessage: (targetPid, message) => {
            if (!isProcessActive()) return false;
            assertPermission("ipc");
            return sendProcessMessage(pid, targetPid, message);
        },
        onMessage: null,
        heartbeat: () => {
            if (!isProcessActive()) return;
            const p = processes.get(key);
            if (p) p.lastHeartbeat = performance.now();
        },
        setTimeout: (fn, delay, ...args) => {
            if (!isProcessActive() || typeof fn !== "function") return null;
            const id = setTimeout(() => {
                resources.timeouts.delete(id);
                if (!isProcessActive()) return;
                fn(...args);
            }, delay);
            resources.timeouts.add(id);
            return id;
        },
        clearTimeout: (id) => {
            resources.timeouts.delete(id);
            clearTimeout(id);
        },
        setInterval: (fn, delay, ...args) => {
            if (!isProcessActive() || typeof fn !== "function") return null;
            const id = setInterval(() => {
                if (!isProcessActive()) {
                    clearInterval(id);
                    resources.intervals.delete(id);
                    return;
                }
                fn(...args);
            }, delay);
            resources.intervals.add(id);
            return id;
        },
        clearInterval: (id) => {
            resources.intervals.delete(id);
            clearInterval(id);
        },
        addWindowListener: (type, listener, opts) => {
            if (!isProcessActive() || typeof listener !== "function") return;
            const wrapped = (ev) => {
                if (!isProcessActive()) return;
                listener(ev);
            };
            window.addEventListener(type, wrapped, opts);
            resources.listeners.push({ type, listener: wrapped, rawListener: listener, opts });
        },
        removeWindowListener: (type, listener, opts) => {
            const remaining = [];
            for (const entry of resources.listeners) {
                if (entry.type === type && (entry.rawListener === listener || entry.listener === listener)) {
                    window.removeEventListener(type, entry.listener, opts ?? entry.opts);
                } else {
                    remaining.push(entry);
                }
            }
            resources.listeners = remaining;
        },
        lockFile: async (targetPath, mode = "exclusive") => {
            if (!isProcessActive()) return false;
            assertPermission("fs:write");
            const norm = resolveDynamicPath(targetPath, "write");
            const { lockFile } = await import("./fs.js");
            return lockFile(norm, mode, String(pid));
        },
        unlockFile: async (targetPath) => {
            assertPermission("fs:write");
            const norm = resolveDynamicPath(targetPath, "write");
            const { unlockFile } = await import("./fs.js");
            return unlockFile(norm, String(pid));
        },
        readFile: async (targetPath) => {
            assertPermission("fs:read");
            const norm = resolveDynamicPath(targetPath, "read");
            return await readFileContent(norm);
        },
        writeFile: async (targetPath, data) => {
            if (!isProcessActive()) return false;
            assertPermission("fs:write");
            const norm = resolveDynamicPath(targetPath, "write");
            const ok = writeFileContent(norm, data, "C:/", String(pid));
            const { waitForSaveCompletion } = await import("./fs.js");
            await waitForSaveCompletion();
            window.dispatchEvent(new Event("fs-updated"));
            return ok;
        },
        listDir: async (targetPath = "C:/Programs/Documents") => {
            assertPermission("fs:read");
            const norm = resolveDynamicPath(targetPath, "read");
            return listDirectory(norm);
        },
        mkdir: async (targetPath) => {
            if (!isProcessActive()) return false;
            assertPermission("fs:write");
            const norm = resolveDynamicPath(targetPath, "write");
            ensureDirectory(norm, "C:/", String(pid));
            const { waitForSaveCompletion } = await import("./fs.js");
            await waitForSaveCompletion();
            window.dispatchEvent(new Event("fs-updated"));
            return true;
        },
        deleteFile: async (targetPath) => {
            if (!isProcessActive()) return false;
            assertPermission("fs:write");
            const norm = resolveDynamicPath(targetPath, "write");
            const ok = await deleteFSNode(norm, "C:/", String(pid));
            await forceSave();
            window.dispatchEvent(new Event("fs-updated"));
            return ok;
        },
        exists: (targetPath) => {
            try {
                assertPermission("fs:read");
                const norm = resolveDynamicPath(targetPath, "read");
                return resolveFS(norm) !== null;
            } catch {
                return false;
            }
        },
        stat: (targetPath) => {
            assertPermission("fs:read");
            const norm = resolveDynamicPath(targetPath, "read");
            return statFS(norm);
        },
        // ★ パッケージ内のアセット（JSON/テキスト/画像/音声等）を読み込む
        readAsset: async (relPath) => {
            if (!isPackageApp) throw new Error("readAsset はパッケージ型アプリでのみ使用できます。");
            const assetPath = resolvePackageInternalPath(packageRoot, packageRoot, relPath);
            return await readFileContent(assetPath);
        },
        // ★ パッケージ内のアセットを ObjectURL / DataURL として取得（終了時に自動解放）
        getAssetURL: async (relPath, mimeType = "") => {
            if (!isPackageApp) throw new Error("getAssetURL はパッケージ型アプリでのみ使用できます。");
            if (!isProcessActive()) return null;
            const assetPath = resolvePackageInternalPath(packageRoot, packageRoot, relPath);
            const content = await readFileContent(assetPath);
            if (!isProcessActive() || content === null || content === undefined) return null;
            if (typeof content === "string" && content.startsWith("data:")) {
                return content;
            }
            const blob = content instanceof Blob
                ? content
                : new Blob([content], { type: mimeType || "application/octet-stream" });
            const url = URL.createObjectURL(blob);
            resources.blobUrls.add(url);
            return url;
        },
        // ★ パッケージ内CSSファイルを読み込んで適用（プロセス終了時に自動除去）
        loadStyle: async (relPath) => {
            if (!isPackageApp) throw new Error("loadStyle はパッケージ型アプリでのみ使用できます。");
            if (!isProcessActive()) return null;
            const cssPath = resolvePackageInternalPath(packageRoot, packageRoot, relPath);
            const cssText = await readFileContent(cssPath);
            if (!isProcessActive()) return null;
            if (typeof cssText !== "string") throw new Error(`CSSファイルが見つかりません: ${relPath}`);
            return injectStyleElement(cssText, cssPath);
        },
        // ★ インラインCSSを安全に適用（プロセス終了時に自動除去）
        injectStyle: (cssText) => {
            return injectStyleElement(cssText, "inline");
        },
        // ★ パッケージ内JSモジュールの安全な動的インポート
        importModule: async (relPath) => {
            if (!isPackageApp) throw new Error("importModule はパッケージ型アプリでのみ使用できます。");
            if (!isProcessActive()) throw new Error("プロセスは既に終了しています。");
            const modPath = resolvePackageInternalPath(packageRoot, packageRoot, relPath);
            const blobUrl = await compileVirtualPackageModule(
                packageRoot,
                modPath,
                pid,
                resources,
                resources.compiledModules
            );
            return await import(blobUrl);
        },
        // ★ アプリ固有の永続設定ストレージ（IndexedDB kv ストア）
        loadSetting: async (settingKey, defaultValue = null) => {
            assertPermission("settings");
            const keyStr = normalizeSettingKey(settingKey);
            const fullKey = `app_setting:${appSettingNamespace}:${keyStr}`;
            const val = await dbGet(fullKey, "kv");
            return val === undefined ? defaultValue : val;
        },
        saveSetting: async (settingKey, value) => {
            if (!isProcessActive()) return false;
            assertPermission("settings");
            const keyStr = normalizeSettingKey(settingKey);
            const fullKey = `app_setting:${appSettingNamespace}:${keyStr}`;
            await dbSet(fullKey, value, "kv");
            window.dispatchEvent(new CustomEvent("app-setting-changed", {
                detail: {
                    namespace: appSettingNamespace,
                    key: keyStr,
                    fullKey,
                    value
                }
            }));
            return true;
        },
        // ★ カーネルのイベントログへ記録
        log: (level = "Information", message = "") => {
            assertPermission("log");
            const validLevels = new Set(["Information", "Warning", "Error"]);
            const safeLevel = validLevels.has(level) ? level : "Information";
            return logSystemEvent("Application", safeLevel, basename(processPath), 1100, "App Log", String(message));
        },
        // ★ 外部サンドボックスから安全に拡張子・アイコンを登録＆永続化するAPI
        registerFileAssociation: async (ext, icon = null, assocOptions = {}) => {
            if (!isProcessActive()) return false;
            assertPermission("system:assoc");
            const targetApp = isPackageApp ? processPath : (assocOptions.appPath || processPath);
            registerFileAssociation(ext, targetApp, icon, { allowOverride: Boolean(assocOptions.allowOverride) });

            const { FS } = await import("./fs.js");
            if (FS["C:"]?.System) {
                const serialized = JSON.stringify(exportCustomAssociations(), null, 2);
                if (!FS["C:"].System["FileAssociations.json"]) {
                    FS["C:"].System["FileAssociations.json"] = { type: "file", system: true, content: serialized };
                } else {
                    FS["C:"].System["FileAssociations.json"].content = serialized;
                }
                await forceSave();
            }
            return true;
        },
        // ★ 自身のアプリ、またはユーザー領域のファイル/フォルダに個別アイコン（node.icon）を設定するAPI
        setCustomIcon: async (targetPath, icon) => {
            if (!isProcessActive()) return false;
            assertPermission("fs:icon");
            const norm = normalizePath(targetPath);
            const isSelfApp = norm.toLowerCase() === processPath.toLowerCase();

            if (isPackageApp && !isSelfApp) {
                assertSandboxPathAccess(norm, "write", packageRoot);
            }

            const targetNode = resolveFS(norm);
            if (!targetNode) throw new Error(`対象が見つかりません: ${norm}`);

            const cleanIcon = sanitizeIcon(icon);
            if (!cleanIcon) throw new Error("無効または安全でないアイコンです。");

            targetNode.icon = cleanIcon;
            await forceSave();
            window.dispatchEvent(new Event("fs-updated"));
            return true;
        }
    };

    // ==========================================
    // 2. 外部パッケージ用の制限されたサンドボックス Syscall
    // ==========================================
    const sandboxSyscall = Object.seal({
        ...baseSyscall
    });

    let appModule;

    if (isPackageApp) {
        try {
            const pkgNode = resolveFS(packageRoot);
            if (!pkgNode || pkgNode.type !== "folder") {
                throw new Error(`パッケージフォルダが見つかりません: ${packageRoot}`);
            }

            // マニフェストまたはノード定義のスタイルシートを自動注入
            const styleList = Array.isArray(pkgManifest?.styles)
                ? pkgManifest.styles
                : (Array.isArray(item.styles) ? item.styles : (typeof item.styles === "string" ? [item.styles] : []));
            for (const styleRel of styleList) {
                await sandboxSyscall.loadStyle(styleRel);
            }

            const mainRel = pkgManifest?.main || item.main || "main.js";
            const entryPath = resolvePackageInternalPath(packageRoot, packageRoot, mainRel);
            const entryBlobUrl = await compileVirtualPackageModule(
                packageRoot,
                entryPath,
                pid,
                resources,
                resources.compiledModules
            );
            appModule = await import(entryBlobUrl);
        } catch (e) {
            // 起動前失敗時も生成済みリソース（Blob URL / Style）を即座に回収
            resources.blobUrls.forEach(url => { try { URL.revokeObjectURL(url); } catch (_) { } });
            resources.styles.forEach(el => { try { el.remove(); } catch (_) { } });
            console.error("Package app load failed:", e);
            throw new Error(`パッケージの読み込みに失敗しました: ${e.message}`);
        }
    } else {
        const sep = item.entry.includes("?") ? "&" : "?";
        const importEntry = item.singleton ? item.entry : `${item.entry}${sep}pid=${pid}`;
        appModule = await safeImport(importEntry);
    }

    if (!appModule?.default) {
        resources.blobUrls.forEach(url => { try { URL.revokeObjectURL(url); } catch (_) { } });
        resources.styles.forEach(el => { try { el.remove(); } catch (_) { } });
        throw new Error("アプリが正しくエクスポートされていません");
    }

    // 非同期のモジュール読み込み中にログオフ・BSOD・CUIへ移行していた場合はリソースを回収して即中断
    if (isSystemDead || window.nexser?.isLoggingOff || !isGuiActive) {
        resources.disposed = true;
        resources.blobUrls.forEach(url => { try { URL.revokeObjectURL(url); } catch (_) { } });
        resources.styles.forEach(el => { try { el.remove(); } catch (_) { } });
        return;
    }

    // ==========================================
    // 3. ウィンドウ生成とシステムコールの割り当て
    // ==========================================
    const content = getWindowAPI()?.createWindow(displayName, {
        ...mergedWindowOptions,
        node: options.originalNode || item,
        frameless: isFrameless,
        hideRibbon: isFrameless,
        hideStatus: isFrameless
    });
    const win = content?.closest(".window");
    if (!win) {
        resources.blobUrls.forEach(url => { try { URL.revokeObjectURL(url); } catch (_) { } });
        resources.styles.forEach(el => { try { el.remove(); } catch (_) { } });
        throw new Error("Window creation failed");
    }

    let appHandle = null;

    const syscall = isPackageApp ? sandboxSyscall : {
        ...baseSyscall,
        restart: () => restartProcess(key)
    };

    // 起動中の例外時もリソース回収できるよう先に仮登録
    registerProcess(win, key, processPath, null, isShell, options, pid, {
        entry: item.entry || (packageRoot ? `${packageRoot}/${pkgManifest?.main || item.main || "main.js"}` : ""),
        singleton: Boolean(item.singleton || pkgManifest?.singleton),
        syscall,
        resources
    });

    try {
        appHandle = await appModule.default(content, { ...options, syscall, windowAPI: safeWindowAPI });
        const proc = processes.get(key);
        if (proc) proc.handle = appHandle;

        if (appHandle?.isTabApp) tabAppInstances.set(tabInstanceKey, { win, handle: appHandle });
        if (typeof win._applyRealIcon === "function") win._applyRealIcon();

        const processState = isShell ? "shell" : "normal";
        const logSource = basename(processPath);
        await logSystemEvent(
            "Application",
            "Information",
            logSource,
            1000,
            "App Lifecycle",
            `アプリケーション '${logSource}' (PID: ${pid}) が正常に起動しました。`,
            { isShell, state: processState }
        );
    } catch (e) {
        console.error("app runtime error:", e);
        logSystemEvent(
            "Application",
            "Error",
            basename(processPath),
            1001,
            "App Crash",
            `アプリケーション '${basename(processPath)}' (PID: ${pid}) が実行時エラーで強制終了しました: ${e.message}`
        );
        killProcess(key);
        getWindowAPI()?.errorWindow(`アプリがクラッシュしました\n${e.message}`, { taskbar: false });
        throw e;
    }

    if (!isShell) {
        const recentType = isExplorer ? "folder" : (options.path && options.path !== path ? "file" : "app");
        const recentPath = options.path || processPath;
        addRecent({ type: recentType, path: recentPath });
    }

    if (isExplorer) explorerWindows.set(explorerTargetKey, win);
}

/* --- 共通：全プロセス共有のDOM離脱監視オブザーバー --- */
let sharedProcessDomObserver = null;
let domSweepScheduled = false;

function ensureSharedProcessDomObserver() {
    if (sharedProcessDomObserver || typeof document === "undefined" || !document.body) return;

    sharedProcessDomObserver = new MutationObserver(() => {
        if (domSweepScheduled || processes.size === 0) return;
        domSweepScheduled = true;

        queueMicrotask(() => {
            domSweepScheduled = false;
            for (const [procKey, proc] of Array.from(processes.entries())) {
                if (proc.window && !proc.window.isConnected) {
                    killProcess(procKey);
                }
            }
        });
    });

    sharedProcessDomObserver.observe(document.body, { childList: true, subtree: true });
}

/* --- 共通：プロセス登録ヘルパー --- */
function registerProcess(win, key, path, handle, isShell = false, options = {}, forcedPid = null, meta = {}) {
    const pid = forcedPid !== null ? forcedPid : pidCounter++;
    processes.set(key, {
        pid,
        path,
        entry: meta.entry || "",
        singleton: Boolean(meta.singleton),
        window: win,
        handle,
        syscall: meta.syscall || null,
        resources: meta.resources || null,
        state: isShell ? "shell" : "normal",
        isShell,
        options,
        startTime: performance.now(),
        lastHeartbeat: null,
        memory: 0,
        cpu: 0
    });
    win.dataset.processKey = key;

    ensureSharedProcessDomObserver();

    win._cleanup = () => {
        const currentKey = win.dataset.processKey || key;
        if (processes.has(currentKey)) killProcess(currentKey);
    };
}

/* =========================
   Watchdog & Process Metrics
   ※ startKernelDaemons() / stopKernelDaemons() にてライフサイクル管理
========================= */


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
    const resources = proc.resources;

    processes.delete(key);
    if (resources) {
        resources.disposed = true;
    }

    try {
        // 1. プロセスが保持していたタイマー・イベントリスナー・Blob URL・CSSを強制回収
        if (resources) {
            try {
                resources.timeouts?.forEach(id => clearTimeout(id));
                resources.intervals?.forEach(id => clearInterval(id));
                resources.listeners?.forEach(({ type, listener, opts }) => {
                    try { window.removeEventListener(type, listener, opts); } catch (_) { }
                });
                resources.blobUrls?.forEach(url => {
                    try { URL.revokeObjectURL(url); } catch (_) { }
                });
                resources.styles?.forEach(styleEl => {
                    try { styleEl.remove(); } catch (_) { }
                });
                resources.timeouts?.clear();
                resources.intervals?.clear();
                resources.listeners.length = 0;
                resources.blobUrls?.clear();
                resources.styles?.clear();
                resources.compiledModules?.clear();
            } catch (resErr) {
                console.warn(`[Kernel] Resource cleanup warning (PID: ${pid}):`, resErr);
            }
        }

        // 2. PID単位でファイルロックを即座に自動解放（他プロセスのロック誤解除を防止）
        try {
            unlockFilesByPid(String(pid));
        } catch (lockErr) {
            console.warn(`[Kernel] Lock release warning (PID: ${pid}):`, lockErr);
        }

        // 3. アプリ側の終了フックを個別に例外隔離して実行（例外が出てもウィンドウ破棄を止めない）
        if (handle) {
            for (const hookName of ["dispose", "destroy", "unmount"]) {
                if (typeof handle[hookName] === "function") {
                    try {
                        handle[hookName]();
                    } catch (hookErr) {
                        console.warn(`[Kernel] App ${hookName}() failed (PID: ${pid}):`, hookErr);
                    }
                }
            }
        }

        // 4. ウィンドウ・タスクバーボタン・DOMリソースを確実に破棄
        if (win) {
            if (win._cleanup) {
                const cleanup = win._cleanup;
                win._cleanup = null;
                try { cleanup(); } catch (_) { }
            }

            if (win._observer) {
                try { win._observer.disconnect(); } catch (_) { }
                win._observer = null;
            }

            try {
                if (typeof getWindowAPI()?.detachWindowResources === "function") {
                    getWindowAPI().detachWindowResources(win);
                } else if (win._taskbarBtn) {
                    win._taskbarBtn.remove();
                    win._taskbarBtn = null;
                }
            } catch (detachErr) {
                console.warn(`[Kernel] Window resource detach warning (PID: ${pid}):`, detachErr);
            }

            try {
                win.innerHTML = "";
                win.remove();
            } catch (_) { }
        }
    } finally {
        if (proc.entry && !proc.singleton) {
            const sep = proc.entry.includes("?") ? "&" : "?";
            moduleCache.delete(`${proc.entry}${sep}pid=${pid}`);
        }

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
                        if (w._observer) {
                            w._observer.disconnect();
                            w._observer = null;
                        }
                        if (typeof getWindowAPI()?.detachWindowResources === "function") {
                            getWindowAPI().detachWindowResources(w);
                        } else if (w._abortController) {
                            w._abortController.abort();
                        }
                        w.remove();
                    } catch { }
                }
            });

        getWindowAPI()?.removeAllTaskbarButtons();

        processes.clear();
        explorerWindows.clear();
        tabAppInstances.clear();

        // ⭐ UIリセット時にもPIDカウンターを1に巻き戻す
        pidCounter = 1;
    } catch { }
}

/* =========================
   ログオフ（完全統合・シェル完全除外版）
========================= */
let isLogoffPromptOpen = false;

export async function logOff() {
    window.nexser = window.nexser || {};
    if (window.nexser.isLoggingOff || isLogoffPromptOpen) return;

    const windows = document.querySelectorAll(".window");

    // 💡 FS上の shell: true 定義および Taskbar シェルウィンドウを除外
    const activeNormalWindows = Array.from(windows).filter(w => {
        if (w.dataset.title === "Taskbar") return false;
        const key = w.dataset.processKey;
        const proc = processes.get(key);
        if (!proc) return true;
        return !proc.isShell;
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
        isGuiActive = false;
        window.nexser.isBooting = false;
        window.nexser.isLoggingOff = true;
        stopKernelDaemons();

        // スクリーンセーバー等の常駐OSサービスへログオフ開始を通知して即時停止
        window.dispatchEvent(new Event("nexser-logoff"));
        try {
            const { stopScreensaverService } = await import("./screensaver.js");
            if (typeof stopScreensaverService === "function") {
                stopScreensaverService();
            }
        } catch (ssErr) {
            console.warn("[Kernel] Failed to stop screensaver service on logoff:", ssErr);
        }
        const strayScreensaver = document.getElementById("screensaver-layer");
        if (strayScreensaver) strayScreensaver.remove();

        playSystemEventSound('logoff');

        // デスクトップアイコン群・タスクバー・既存の全非モーダルウィンドウを即座に非表示化
        const desktopIcons = document.getElementById("desktop-icons");
        const taskbar = document.getElementById("taskbar");
        if (desktopIcons) {
            desktopIcons.style.setProperty("display", "none", "important");
            desktopIcons.style.visibility = "hidden";
            desktopIcons.style.pointerEvents = "none";
        }
        if (taskbar) {
            taskbar.style.visibility = "hidden";
            taskbar.style.pointerEvents = "none";
        }
        document.querySelectorAll(".window").forEach(w => {
            if (!w._modal) {
                w.style.visibility = "hidden";
                w.style.display = "none";
                w.style.pointerEvents = "none";
            }
        });

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

            // 3. セッション終了ログを直列キュー経由で IndexedDB へ書き込み（各プロセス終了ログは killProcess 側で記録済み）
            progressWin?.update(
                50,
                100,
                `対象ストア: ${LOG_STORAGE_KEY}\nセッション終了および ${totalProcs} 件のプロセス終了イベントを記録中...`,
                "[3/5] イベントログをデータベースへ保存しています..."
            );

            await logSystemEvent(
                "System",
                "Information",
                "SessionManager",
                1004,
                "Logoff",
                `ユーザーがシステムからログオフしました (終了プロセス: ${totalProcs}件)。`
            );

            const allLogs = (await dbGet(LOG_STORAGE_KEY, "kv")) || { System: [], Application: [] };
            progressWin?.update(
                64,
                100,
                `ログ保存完了 (累計保持件数: System ${allLogs.System?.length || 0}件 / Application ${allLogs.Application?.length || 0}件)\nファイルシステムの最終同期を実行中...`,
                "[4/5] ファイルシステムの整合性を検証しています..."
            );

            // 4. DB強制保存と整合性診断・修復（ゴミ箱は消去しない）
            await forceSave();
            const fsReport = await diagnoseAndCleanFS(true, { cleanTrash: false });
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

        // デスクトップ・タスクバーのDOM領域を完全に非表示＆空化して残留を物理的に防ぐ
        const osRoot = document.getElementById("os-root");
        if (osRoot) {
            osRoot.style.display = "none";
            osRoot.innerHTML = "";
        }

        if (typeof resetSystemVerification === "function") {
            resetSystemVerification();
        }

        showPromptScreen("nexser logoff");
    };

    // 通常のアプリケーションウィンドウが開いている場合のみ、実行中アプリの一覧付き確認ダイアログを表示
    if (hasNormalWindow) {
        isLogoffPromptOpen = true;
        const appListHtml = userApps.map(app => `<div style="padding: 2px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">• ${app.name} <span style="color: #666; font-size: 11px;">(PID: ${app.pid}, 稼働: ${app.uptime}秒)</span></div>`).join("");

        const confirmMessage = `以下のアプリケーションが実行中です。システムをログオフすると、未保存のデータが失われる可能性があります。<br><br>` +
            `<b>終了予定のプロセス (${userApps.length}件):</b>` +
            `<div style="max-height: 120px; overflow-y: auto; background: #ffffff; padding: 8px; margin: 6px 0; font-size: 12px; border: 1px inset #808080; text-align: left;">${appListHtml}</div>` +
            `本当にシステムをログオフしますか？`;

        getWindowAPI()?.confirmWindow(
            confirmMessage,
            async (result) => {
                isLogoffPromptOpen = false;
                if (result) {
                    await performLogoff();
                }
            },
            {
                width: 460,
                overlay: true,
                isHtml: true,
                taskbar: false,
                disableControls: true,
                onClose: () => { isLogoffPromptOpen = false; }
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
        if (!oldPath || !newPath || oldPath === newPath) return;

        const replacePrefix = (targetPath) => {
            if (targetPath === oldPath) return newPath;
            if (targetPath.startsWith(oldPath + "/")) {
                return newPath + targetPath.slice(oldPath.length);
            }
            return targetPath;
        };

        // 1. explorerWindows マップ（開いているフォルダ管理）のキーを同期
        for (const [expPath, expWin] of Array.from(explorerWindows.entries())) {
            if (expPath === oldPath || expPath.startsWith(oldPath + "/")) {
                const updatedExpPath = replacePrefix(expPath);
                explorerWindows.delete(expPath);
                if (expWin && document.body.contains(expWin)) {
                    explorerWindows.set(updatedExpPath, expWin);
                }
            }
        }

        // 2. processes マップ・再起動オプション・ウィンドウ・タスクバーを同期
        const renamedNode = resolveFS(newPath);
        const windowAPI = getWindowAPI();

        for (const [key, proc] of Array.from(processes.entries())) {
            const matchProcPath = proc.path === oldPath || proc.path.startsWith(oldPath + "/");
            const optPath = typeof proc.options?.path === "string" ? proc.options.path : "";
            const matchOptPath = optPath === oldPath || optPath.startsWith(oldPath + "/");

            if (matchProcPath || matchOptPath) {
                const updatedPath = matchProcPath ? replacePrefix(proc.path) : replacePrefix(optPath);
                if (matchProcPath) {
                    proc.path = updatedPath;
                }

                // 再起動（restartProcess）に備えて proc.options 内のパス情報も更新
                if (proc.options && typeof proc.options === "object") {
                    if (typeof proc.options.path === "string") {
                        proc.options.path = replacePrefix(proc.options.path);
                    }
                    if (typeof proc.options.uniqueKey === "string") {
                        proc.options.uniqueKey = replacePrefix(proc.options.uniqueKey);
                    }
                }

                // プロセス管理キー自体が旧パスベース（または file:旧パス:...）の場合は新パスへ付け替え
                if (key === oldPath || key.startsWith(oldPath + "/")) {
                    const updatedKey = replacePrefix(key);
                    processes.delete(key);
                    processes.set(updatedKey, proc);
                    if (proc.window) {
                        proc.window.dataset.processKey = updatedKey;
                    }
                } else if (key.startsWith(`file:${oldPath}:`) || key.startsWith(`file:${oldPath}/`)) {
                    const suffix = key.slice(5);
                    const updatedKey = `file:${replacePrefix(suffix)}`;
                    processes.delete(key);
                    processes.set(updatedKey, proc);
                    if (proc.window) {
                        proc.window.dataset.processKey = updatedKey;
                    }
                }

                // 対象ウィンドウ・タスクバーボタンのタイトルとアイコンを更新
                if (proc.window && document.body.contains(proc.window)) {
                    const newTitle = basename(updatedPath);
                    const targetNode = updatedPath === newPath ? renamedNode : resolveFS(updatedPath);

                    if (windowAPI && typeof windowAPI.updateWindowTitle === "function") {
                        windowAPI.updateWindowTitle(proc.window, newTitle, false, targetNode);
                    } else {
                        proc.window.dataset.title = newTitle;
                        const titleElem = proc.window.querySelector(".title-text");
                        if (titleElem) titleElem.textContent = newTitle;
                    }

                    // アプリ／エクスプローラー側がリネーム通知ハンドラを持っていれば通知
                    if (proc.handle && typeof proc.handle.onRename === "function") {
                        try {
                            proc.handle.onRename({ oldPath, newPath, updatedPath });
                        } catch (err) {
                            console.warn("[Kernel] handle.onRename error:", err);
                        }
                    }
                }
            }
        }

        // 3. タスクマネージャー等のプロセス一覧UIに即時反映を通知
        window.dispatchEvent(new CustomEvent("process-updated", {
            detail: { oldPath, newPath }
        }));
    });
}

// Explorer 内のフォルダ移動を explorerWindows と processes へ同期
if (typeof window !== "undefined") {
    window.addEventListener("explorer-path-changed", (e) => {
        const { processKey, oldPath, newPath } = e.detail || {};
        if (!processKey || !newPath) return;

        const proc = processes.get(processKey);
        if (!proc || !proc.window || !document.body.contains(proc.window)) return;

        const normOld = oldPath ? normalizePath(oldPath) : null;
        const normNew = normalizePath(newPath);

        if (normOld && explorerWindows.get(normOld) === proc.window) {
            explorerWindows.delete(normOld);
        } else {
            for (const [k, w] of explorerWindows.entries()) {
                if (w === proc.window) {
                    explorerWindows.delete(k);
                    break;
                }
            }
        }
        explorerWindows.set(normNew, proc.window);

        proc.path = normNew;
        if (proc.options && typeof proc.options === "object") {
            proc.options.path = normNew;
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
    if (isSystemDead || window.nexser?.isLoggingOff || !isGuiActive) return false;

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
    if (isSystemDead || window.nexser?.isLoggingOff || !isGuiActive) return false;

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

    // syscall.onMessage と handle.onMessage の両方をサポート
    const handler =
        (typeof targetProc.syscall?.onMessage === "function" && targetProc.syscall.onMessage) ||
        (typeof targetProc.handle?.onMessage === "function" && targetProc.handle.onMessage);

    if (handler) {
        try {
            handler({ senderPid, data: message });
            return true;
        } catch (e) {
            console.error(`[IPC] Error delivering message to PID ${targetPid}:`, e);
            return false;
        }
    }
    return false;
}

let logWriteChain = Promise.resolve();

export function logSystemEvent(category, level, source, eventId, taskCategory, description, extra = {}) {
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

    // 2. 直列化キューで IndexedDB へ書き込み（連続ログ時の上書き消失を防止）
    logWriteChain = logWriteChain.then(async () => {
        let allLogs = (await dbGet(LOG_STORAGE_KEY, "kv")) || {
            System: [],
            Application: [],
            Security: []
        };

        if (!allLogs[category]) allLogs[category] = [];
        allLogs[category].unshift(logEntry);

        if (allLogs[category].length > 500) allLogs[category].length = 500;

        await dbSet(LOG_STORAGE_KEY, allLogs, "kv");
    }).catch(e => {
        console.warn("[Kernel] Failed to persist logSystemEvent to DB:", e);
    });

    return logWriteChain;
}

if (typeof window !== "undefined") {
    window.addEventListener("nexser-bsod", async () => {
        isGuiActive = false;
        isSystemDead = true;
        setFSReadOnly(true);
        setStorageHalted(true);
        stopKernelDaemons();

        // BSOD発生時に常駐スクリーンセーバーを即時停止して割り込みを防止
        try {
            const { stopScreensaverService } = await import("./screensaver.js");
            if (typeof stopScreensaverService === "function") {
                stopScreensaverService();
            }
        } catch (_) { }
        const strayScreensaver = document.getElementById("screensaver-layer");
        if (strayScreensaver) strayScreensaver.remove();

        // 稼働中プロセスのタイマー・イベント・ロックを強制解放（BSOD画面DOM自体は触らない）
        for (const proc of Array.from(processes.values())) {
            try {
                if (proc.resources) {
                    proc.resources.disposed = true;
                    proc.resources.timeouts?.forEach(id => clearTimeout(id));
                    proc.resources.intervals?.forEach(id => clearInterval(id));
                    proc.resources.listeners?.forEach(({ type, listener, opts }) => {
                        try { window.removeEventListener(type, listener, opts); } catch (_) { }
                    });
                    proc.resources.blobUrls?.forEach(url => {
                        try { URL.revokeObjectURL(url); } catch (_) { }
                    });
                    proc.resources.timeouts?.clear();
                    proc.resources.intervals?.clear();
                    proc.resources.listeners.length = 0;
                    proc.resources.blobUrls?.clear();
                }
                unlockFilesByPid(String(proc.pid));
            } catch (_) { }
        }
        processes.clear();
        launching.clear();
    });
}