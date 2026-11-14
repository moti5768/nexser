// fs.js
import {
    saveFS,
    loadFS,
    dbGet,
    dbSet,
    saveNodeDiff,
    LARGE_FILE_THRESHOLD
} from "./fs-db.js";

let saveTimer = null;
let deletedDefaults = new Set();
let isSaving = false;
let isInitializing = false;
const DEBUG_FS = false;
const PROTECTED_KEYS = new Set(["type", "entry", "singleton", "shell", "system", "lastModified"]);
const RAW_TARGET = Symbol("RAW_TARGET");

export let isBulkUpdating = false;
export function setBulkUpdating(flag) {
    isBulkUpdating = flag;
    // 一括更新完了時に未保存の差分があれば即座に保存スケジュールへ乗せる
    if (!flag && (dirtyNodePaths.size > 0 || deletedNodePaths.size > 0 || dirtyMetaOnlyPaths.size > 0 || needsFullSyncSave)) {
        scheduleDiffSave();
    }
}

// =========================================
// 【NTFS風改善】ファイル排他ロック管理機構
// =========================================
const fileLocks = new Map(); // path -> { mode: "exclusive", pid: string }

export function lockFile(path, mode = "exclusive", pid = "system") {
    const current = fileLocks.get(path);
    if (current && current.mode === "exclusive") {
        console.warn(`[FS Lock] 共有違反: ${path} はすでにロックされています。`);
        return false;
    }
    fileLocks.set(path, { mode, pid });
    return true;
}

export function unlockFile(path, pid = "system") {
    const current = fileLocks.get(path);
    if (current && current.pid === pid) {
        fileLocks.delete(path);
        return true;
    }
    return false;
}

export function unlockFilesByPath(pathPrefix) {
    for (const [path] of fileLocks.entries()) {
        if (path === pathPrefix || path.startsWith(pathPrefix + "/")) {
            fileLocks.delete(path);
            console.log(`[FS Lock] パス解放に伴いロックを自動解除しました: ${path}`);
        }
    }
}

// 1. ベースデータ
const baseFS = {
    "C:": {
        type: "folder",
        system: true,
        System: {
            type: "folder",
            system: true,
            "AUTOBOOT.CFG": { type: "file", system: true, content: "", hidden: true },
            "SoundConfig.json": { type: "file", system: true, content: "{}" }
        },
        Desktop: {
            type: "folder",
            system: true,
            Trash: { type: "link", target: "C:/Trash", system: true },
            "My Computer": { type: "link", target: "C:/Programs" },
            "ControlPanel": { type: "link", target: "C:/Programs/ControlPanel" },
            Documents: { type: "link", target: "C:/Programs/Documents" },
            "Terminal.app": { type: "link", target: "C:/Programs/Applications/Terminal.app" },
            "Calc.app": { type: "link", target: "C:/Programs/Applications/Calc.app" },
            "Soundsplayer.app": { type: "link", target: "C:/Programs/Applications/Soundsplayer.app" },
            "Settings.app": { type: "link", target: "C:/Programs/Applications/Settings.app" }
        },
        StartMenu: {
            type: "folder",
            system: true,
            Programs: { type: "link", target: "C:/Programs" },
            ControlPanel: { type: "link", target: "C:/Programs/ControlPanel" },
            Documents: { type: "link", target: "C:/Programs/Documents" },
            "Settings.app": { type: "link", target: "C:/Programs/Applications/Settings.app" },
            "Terminal.app": { type: "link", target: "C:/Programs/Applications/Terminal.app" }
        },
        Trash: { type: "folder", system: true },
        Programs: {
            type: "folder",
            system: true,
            Applications: {
                type: "folder",
                system: true,
                "Calc.app": { type: "app", entry: "./apps/calc.js", system: true, singleton: true },
                "TextEditor.app": { type: "app", entry: "./apps/texteditor.js", system: true },
                "CodeEditor.app": { type: "app", entry: "./apps/codeeditor.js", system: true },
                "ImageViewer.app": { type: "app", entry: "./apps/imageviewer.js", system: true },
                "VideoPlayer.app": { type: "app", entry: "./apps/videoplayer.js", system: true },
                "Clock.app": { type: "app", entry: "./apps/clock.js", system: true, singleton: true },
                "Terminal.app": { type: "app", entry: "./apps/terminal.js", system: true, singleton: true },
                "TaskManager.app": { type: "app", name: "Task Manager", entry: "./apps/taskmanager.js", system: true, singleton: true },
                "Settings.app": { type: "app", entry: "./apps/settings.js", system: true, singleton: true },
                "Explorer.app": { type: "app", entry: "./apps/explorer.js", system: true, hidden: true },
                "Soundsplayer.app": { type: "app", entry: "./apps/soundplayer.js", system: true },
                "AudioPlayer.app": { type: "app", entry: "./apps/audioplayer.js", system: true },
                "Paint.app": { type: "app", entry: "./apps/paint.js", system: true },
                "RegistryEditor.app": { type: "app", entry: "./apps/registryeditor.js", system: true },
                "SystemProperties.app": { type: "app", entry: "./apps/systemproperties.js", system: true },
                "TaskbarProperties.app": { type: "app", entry: "./apps/taskbarproperties.js", system: true },
                "PDFViewer.app": { type: "app", entry: "./apps/pdfviewer.js", system: true },
                "Browser.app": { type: "app", entry: "./apps/Browser.js", system: true },
                "Networkmonitor.app": { type: "app", entry: "./apps/network_monitor.js", system: true },
                "Eventlog.app": { type: "app", entry: "./apps/eventlog.js", system: true },
                "Toolbar.app": { type: "app", entry: "./apps/toolbar.js", system: true, frameless: true, singleton: true, shell: true },
                "Startmenu.app": { type: "app", entry: "./apps/startmenu.js", system: true, frameless: true, singleton: true, shell: true }
            },
            ControlPanel: {
                type: "folder",
                system: true,
                "TaskbarProperties.app": { type: "link", target: "C:/Programs/Applications/TaskbarProperties.app" },
                "SystemProperties.app": { type: "link", target: "C:/Programs/Applications/SystemProperties.app" }
            },
            Accessories: {
                type: "folder",
                system: true,
                "Calc.app": { type: "link", target: "C:/Programs/Applications/Calc.app" },
                "TextEditor.app": { type: "link", target: "C:/Programs/Applications/TextEditor.app" },
                "Paint.app": { type: "link", target: "C:/Programs/Applications/Paint.app" },
                Games: {
                    type: "folder",
                    system: true,
                    "Tetris.app": { type: "app", entry: "./apps/games/tetris.js", system: true },
                    "Minesweeper.app": { type: "app", entry: "./apps/games/minesweeper.js", system: true }
                },
                Multimedia: {
                    type: "folder",
                    system: true,
                    "CodeEditor.app": { type: "link", target: "C:/Programs/Applications/CodeEditor.app" },
                    "ImageViewer.app": { type: "link", target: "C:/Programs/Applications/ImageViewer.app" },
                    "PDFViewer.app": { type: "link", target: "C:/Programs/Applications/PDFViewer.app" },
                    "VideoPlayer.app": { type: "link", target: "C:/Programs/Applications/VideoPlayer.app" }
                },
                Systemtools: {
                    type: "folder",
                    system: true,
                    "Clock.app": { type: "link", target: "C:/Programs/Applications/Clock.app" },
                    "Terminal.app": { type: "link", target: "C:/Programs/Applications/Terminal.app" },
                    "TaskManager.app": { type: "link", target: "C:/Programs/Applications/TaskManager.app" },
                    "RegistryEditor.app": { type: "link", target: "C:/Programs/Applications/RegistryEditor.app" }
                }
            },
            Documents: { type: "folder", system: true },
            Music: { type: "folder", system: true },
            Picture: { type: "folder", system: true },
            Movie: { type: "folder", system: true },
            Settings: {
                type: "folder",
                system: true,
                "Settings.app": { type: "link", target: "C:/Programs/Applications/Settings.app" }
            }
        }
    }
};

const FACTORY_FS = structuredClone(baseFS);

// --- 各階層ごとのピンポイント差分追跡キュー ---
const dirtyNodePaths = new Set();
const deletedNodePaths = new Set();
const dirtyMetaOnlyPaths = new Set();
let needsFullSyncSave = false;

/**
 * フォルダ内の子要素の並び順のみを完全差分更新で変更する（サブツリー再保存・メタデータ欠落を防止）
 */
export function reorderNodeKeys(nodePath, orderedKeys) {
    const parts = nodePath.split("/").filter(Boolean);
    let rawNode = baseFS;
    for (const part of parts) {
        if (!rawNode || typeof rawNode !== "object") return false;
        rawNode = unwrapProxy(rawNode[part]);
    }
    if (!rawNode || typeof rawNode !== "object") return false;

    const childBackup = {};
    for (const k of Object.keys(rawNode)) {
        if (!PROTECTED_KEYS.has(k)) {
            childBackup[k] = rawNode[k];
            delete rawNode[k];
        }
    }

    for (const k of orderedKeys) {
        if (k in childBackup) {
            rawNode[k] = childBackup[k];
            delete childBackup[k];
        }
    }
    // 万一 orderedKeys に含まれなかった残余キーがあれば末尾に復元
    for (const k of Object.keys(childBackup)) {
        rawNode[k] = childBackup[k];
    }

    rawNode.lastModified = Date.now();
    dirtyMetaOnlyPaths.add(nodePath);

    if (!isBulkUpdating) {
        scheduleDiffSave();
        window.dispatchEvent(new Event("fs-updated"));
    }
    return true;
}

function queueDirtyPath(nodePath) {
    if (!nodePath) return;

    // 自身および祖先パスが削除キューに入っていた場合は競合を防ぐため解除
    deletedNodePaths.delete(nodePath);
    const parts = nodePath.split("/");
    for (let i = 1; i < parts.length; i++) {
        const ancestor = parts.slice(0, i).join("/");
        deletedNodePaths.delete(ancestor);
        // すでに祖先フォルダが更新キューにある場合、配下は再帰収集されるため重複追加しない
        if (dirtyNodePaths.has(ancestor)) {
            return;
        }
    }

    // 自身が親となる場合、配下の重複サブパスを整理
    for (const p of dirtyNodePaths) {
        if (p.startsWith(nodePath + "/")) {
            dirtyNodePaths.delete(p);
        }
    }

    dirtyNodePaths.add(nodePath);
}

function queueDeletedPath(nodePath) {
    if (!nodePath) return;

    // すでに親階層が削除キューに入っている場合は重複登録しない
    const parts = nodePath.split("/");
    for (let i = 1; i < parts.length; i++) {
        if (deletedNodePaths.has(parts.slice(0, i).join("/"))) {
            return;
        }
    }

    // 配下の更新キュー・削除キューを掃除して統合
    for (const p of dirtyNodePaths) {
        if (p === nodePath || p.startsWith(nodePath + "/")) {
            dirtyNodePaths.delete(p);
        }
    }
    for (const p of deletedNodePaths) {
        if (p.startsWith(nodePath + "/")) {
            deletedNodePaths.delete(p);
        }
    }
    for (const p of dirtyMetaOnlyPaths) {
        if (p === nodePath || p.startsWith(nodePath + "/")) {
            dirtyMetaOnlyPaths.delete(p);
        }
    }

    deletedNodePaths.add(nodePath);
}

// --- コアロジック ---

const proxyCache = new WeakMap();

function unwrapProxy(val) {
    if (val && typeof val === "object" && val[RAW_TARGET]) {
        return val[RAW_TARGET];
    }
    return val;
}

function wrapProxy(obj, path = "") {
    if (!obj || typeof obj !== "object") return obj;

    const rawObj = unwrapProxy(obj);
    if (proxyCache.has(rawObj)) {
        return proxyCache.get(rawObj);
    }

    const proxy = new Proxy(rawObj, {
        get(target, prop) {
            if (prop === RAW_TARGET) {
                return target;
            }
            if (prop === "__proto__" || prop === "constructor" || prop === "prototype") {
                return undefined;
            }

            const value = target[prop];
            if (typeof prop === "symbol") {
                return value;
            }

            const currentPath = path ? `${path}/${prop}` : prop;

            if (prop === "content" && value === "__EXTERNAL_DATA__") {
                if (DEBUG_FS) console.info(`[FS] Large data access: ${path}`);
            }

            if (
                value &&
                typeof value === "object" &&
                !(value instanceof Blob) &&
                !(value instanceof ArrayBuffer) &&
                !ArrayBuffer.isView(value)
            ) {
                return wrapProxy(value, currentPath);
            }
            return value;
        },

        set(target, prop, value) {
            if (prop === "__proto__" || prop === "constructor" || prop === "prototype") {
                return false;
            }

            if (PROTECTED_KEYS.has(prop) && target.system === true && Object.hasOwn(target, prop)) {
                return true;
            }

            // 【NTFS風改善】ファイルが排他ロックされている場合は書き込みを拒否
            const currentPath = path ? `${path}/${prop}` : prop;
            const lockInfo = fileLocks.get(currentPath);
            if (lockInfo && lockInfo.mode === "exclusive") {
                console.error(`[FS Error] 書き込み拒否: '${currentPath}' はロックされています。`);
                return false;
            }

            // Proxyオブジェクトが直接代入された場合は生オブジェクトを取り出して二重ラップを防止
            const cleanValue = unwrapProxy(value);

            if (!isInitializing && prop !== "lastModified" && prop !== "size" && target[prop] !== cleanValue) {
                target.lastModified = Date.now();
            }

            // content 代入時にサイズメタデータを同期
            if (prop === "content" && cleanValue !== "__EXTERNAL_DATA__") {
                const isBlobOrBuffer =
                    cleanValue instanceof Blob ||
                    cleanValue instanceof ArrayBuffer ||
                    ArrayBuffer.isView(cleanValue);
                if (isBlobOrBuffer) {
                    target.size = cleanValue.size || cleanValue.byteLength || 0;
                } else if (typeof cleanValue === "string") {
                    target.size = cleanValue.length;
                }
            }

            target[prop] = cleanValue;

            if (!isInitializing) {
                if (prop === "lastModified" || prop === "size") {
                    return true;
                }

                // 子ノード（folder / file / app / link）の追加・置換か、ノード内プロパティ変更かを判定
                const isChildNode =
                    cleanValue &&
                    typeof cleanValue === "object" &&
                    !(cleanValue instanceof Blob) &&
                    !(cleanValue instanceof ArrayBuffer) &&
                    !ArrayBuffer.isView(cleanValue) &&
                    "type" in cleanValue;

                if (isChildNode) {
                    // 該当階層（および新規フォルダなら配下）と直近の親フォルダの2階層だけを差分登録
                    queueDirtyPath(currentPath);
                    if (path) queueDirtyPath(path);
                } else if (path) {
                    // ファイル内容（content）や属性変更は、そのファイル階層（path）の1件だけを差分登録
                    queueDirtyPath(path);
                }

                if (!isBulkUpdating) {
                    scheduleDiffSave();
                    window.dispatchEvent(new Event("fs-updated"));
                }
            }
            return true;
        },

        deleteProperty(target, prop) {
            if (PROTECTED_KEYS.has(prop) || (target[prop] && target[prop].system === true)) {
                return false;
            }

            const currentPath = path ? `${path}/${prop}` : prop;
            const lockInfo = fileLocks.get(currentPath);
            if (lockInfo && lockInfo.mode === "exclusive") {
                console.error(`[FS Error] 削除拒否: '${currentPath}' はロックされています。`);
                return false;
            }

            const prevVal = target[prop];
            const isChildNode =
                prevVal &&
                typeof prevVal === "object" &&
                !(prevVal instanceof Blob) &&
                !(prevVal instanceof ArrayBuffer) &&
                !ArrayBuffer.isView(prevVal) &&
                "type" in prevVal;

            delete target[prop];

            if (!isInitializing) {
                target.lastModified = Date.now();

                if (isChildNode) {
                    // 子ノード（ファイル・フォルダ等）の削除時のみ削除キューへ登録
                    queueDeletedPath(currentPath);
                    if (path) queueDirtyPath(path);
                } else if (path) {
                    // hidden等の単なるメタ属性削除時は、該当ノードの更新キューのみ登録
                    queueDirtyPath(path);
                }

                if (!isBulkUpdating) {
                    scheduleDiffSave();
                    window.dispatchEvent(new Event("fs-updated"));
                }
            }
            return true;
        }
    });

    proxyCache.set(rawObj, proxy);
    return proxy;
}

export const FS = wrapProxy(baseFS, "");

// --- 同期（Sync）エンジン ---

function deepSync(currentProxy, savedNode, defaultNode, path = "", visited = new WeakSet()) {
    if (!currentProxy || typeof currentProxy !== "object" || visited.has(currentProxy)) return false;
    visited.add(currentProxy);

    let hasChanges = false;

    try {
        for (const key in currentProxy) {
            if (PROTECTED_KEYS.has(key)) continue;
            if (savedNode && !(key in savedNode)) {
                const curVal = currentProxy[key];
                if (!curVal || !curVal.system) {
                    delete currentProxy[key];
                    hasChanges = true;

                    const currentPath = path ? `${path}/${key}` : key;
                    if (defaultNode && defaultNode[key]) {
                        deletedDefaults.add(currentPath);
                        dbSet("deleted_defaults", Array.from(deletedDefaults), "kv").catch(e => console.error(e));
                    }
                }
            }
        }

        for (const key in savedNode) {
            if (PROTECTED_KEYS.has(key)) continue;

            const savedValue = savedNode[key];
            const defaultValue = defaultNode ? defaultNode[key] : null;
            const currentPath = path ? `${path}/${key}` : key;

            if (savedValue && typeof savedValue === "object" && savedValue.type === "folder") {
                if (!currentProxy[key] || currentProxy[key].type !== "folder") {
                    currentProxy[key] = { type: "folder" };
                    hasChanges = true;
                }

                for (const subKey in savedValue) {
                    if (PROTECTED_KEYS.has(subKey) || subKey === "hidden" || subKey === "originalPath") {
                        if (currentProxy[key][subKey] !== savedValue[subKey]) {
                            currentProxy[key][subKey] = savedValue[subKey];
                            hasChanges = true;
                        }
                    }
                }

                if (deepSync(currentProxy[key], savedValue, defaultValue, currentPath, visited)) {
                    hasChanges = true;
                }
            } else {
                // システムアイテム（system: true）の同期処理：コード側の定義をマスターとする
                if (defaultValue && typeof defaultValue === "object" && defaultValue.system) {
                    if (defaultValue.type === "file") {
                        const nextContent =
                            savedValue && savedValue.content !== undefined
                                ? savedValue.content
                                : defaultValue.content;
                        currentProxy[key] = {
                            ...defaultValue,
                            content: nextContent
                        };
                        if (savedValue && savedValue.size !== undefined) {
                            currentProxy[key].size = savedValue.size;
                        }
                    } else {
                        currentProxy[key] = structuredClone(defaultValue);
                    }
                    hasChanges = true;
                } else {
                    currentProxy[key] = savedValue;
                }
            }
        }

        if (defaultNode) {
            for (const key in defaultNode) {
                if (!(key in currentProxy)) {
                    const currentPath = path ? `${path}/${key}` : key;
                    if (deletedDefaults.has(currentPath)) {
                        continue;
                    }
                    currentProxy[key] = structuredClone(defaultNode[key]);
                    hasChanges = true;
                    if (DEBUG_FS) console.log(`[FS Update] New system item added: ${key}`);
                }
            }
        }
    } finally {
        visited.delete(currentProxy);
    }

    return hasChanges;
}

// --- 保存・初期化 (Promiseチェーン + ピンポイント階層差分コミット) ---

let currentSavePromise = Promise.resolve();

async function executeSave() {
    if (dirtyNodePaths.size === 0 && deletedNodePaths.size === 0 && dirtyMetaOnlyPaths.size === 0 && !needsFullSyncSave) {
        return;
    }

    isSaving = true;
    const dirtyBatch = Array.from(dirtyNodePaths);
    const deletedBatch = Array.from(deletedNodePaths);
    const metaOnlyBatch = Array.from(dirtyMetaOnlyPaths);
    const runFullSync = needsFullSyncSave;

    dirtyNodePaths.clear();
    deletedNodePaths.clear();
    dirtyMetaOnlyPaths.clear();
    needsFullSyncSave = false;

    try {
        if (runFullSync) {
            await saveFS(baseFS);
            if (DEBUG_FS) console.log("[FS] Full hierarchical sync completed.");
        } else {
            await saveNodeDiff(baseFS, dirtyBatch, deletedBatch, metaOnlyBatch);
            if (DEBUG_FS) {
                console.log(`[FS] Pinpoint diff save completed (updated: ${dirtyBatch.length}, deleted: ${deletedBatch.length}, metaOnly: ${metaOnlyBatch.length}).`);
            }
        }
    } catch (e) {
        // 書き込み失敗時は次回リトライできるようキューへ戻す
        dirtyBatch.forEach(p => dirtyNodePaths.add(p));
        deletedBatch.forEach(p => deletedNodePaths.add(p));
        metaOnlyBatch.forEach(p => dirtyMetaOnlyPaths.add(p));
        if (runFullSync) needsFullSyncSave = true;

        console.error("[FS] Save failed:", e);
        throw new Error(`FS_FATAL_WRITE_FAULT: ${e.message}`);
    } finally {
        isSaving = false;
    }
}

async function scheduleDiffSave() {
    if (saveTimer) return;

    return new Promise((resolve) => {
        saveTimer = setTimeout(async () => {
            saveTimer = null;
            currentSavePromise = currentSavePromise.catch(() => { }).then(() => executeSave());
            try {
                await currentSavePromise;
            } finally {
                resolve();
            }
        }, 300); // 300ms以内の連続操作をまとめてピンポイント差分保存
    });
}

export async function waitForSaveCompletion() {
    if (saveTimer) {
        await forceSave();
    }
    while (isSaving) {
        await new Promise(r => setTimeout(r, 50));
    }
    await currentSavePromise;
}

export async function forceSave(fullSync = false) {
    if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
    }

    if (fullSync) {
        needsFullSyncSave = true;
    } else if (dirtyNodePaths.size === 0 && deletedNodePaths.size === 0 && dirtyMetaOnlyPaths.size === 0 && !needsFullSyncSave) {
        // 差分がなければ無駄な全階層スキャンを行わず、進行中の保存完了のみ待機
        return currentSavePromise;
    }

    currentSavePromise = currentSavePromise.catch(() => { }).then(() => executeSave());
    return currentSavePromise;
}


let initFSPromise = null;

export async function initFS(progressCallback = () => { }) {
    if (initFSPromise) return initFSPromise;

    initFSPromise = (async () => {
        progressCallback("データベースからファイルシステムを読み込み中...");
        let saved = null;
        let retries = 3;

        while (retries > 0) {
            try {
                saved = await loadFS();
                if (saved) break;
            } catch (err) {
                console.warn(`[FS] Load attempt failed, retries left: ${retries - 1}`, err);
            }
            retries--;
            if (retries > 0) {
                await new Promise(r => setTimeout(r, 250));
            }
        }

        const hasInitializedBefore = localStorage.getItem("nexser_installed") === "true";

        if (!saved && hasInitializedBefore) {
            initFSPromise = null;
            console.error("[FS] Critical: Existing database could not be loaded. Aborting to prevent data loss.");
            const { showBSOD } = await import("./bsod.js");
            showBSOD("UNMOUNTABLE_BOOT_VOLUME", new Error("ストレージからのデータ読み込みに失敗しました。データを保護するため起動を中断します。"));
            return;
        }

        progressCallback("システム構成と削除履歴を同期中...");
        const savedDeletedDefaults = await dbGet("deleted_defaults", "kv");
        if (savedDeletedDefaults && Array.isArray(savedDeletedDefaults)) {
            deletedDefaults = new Set(savedDeletedDefaults);
        }

        isSaving = true;
        isInitializing = true;
        let needsPostSyncSave = false;

        try {
            if (!saved) {
                localStorage.setItem("nexser_installed", "true");
                if (DEBUG_FS) console.log("[FS] First-time boot: Initializing and saving factory data...");
                needsFullSyncSave = true;
                await executeSave();
            } else {
                localStorage.setItem("nexser_installed", "true");
                needsPostSyncSave = deepSync(FS, saved, FACTORY_FS, "", new WeakSet());
                if (DEBUG_FS) console.log("[FS] System synchronized successfully.");
            }
        } catch (e) {
            initFSPromise = null;
            console.error("[FS] Initialization/Restore failed:", e);
            const { showBSOD } = await import("./bsod.js");
            showBSOD("UNMOUNTABLE_BOOT_VOLUME", new Error(`FS_FATAL_RESTORE_FAULT: ${e.message}`));
        } finally {
            isInitializing = false;
            isSaving = false;
            if (needsPostSyncSave) {
                needsFullSyncSave = true;
                await forceSave();
            }
            progressCallback("ファイルシステムの読み込みが完了しました。");
        }
    })();

    return initFSPromise;
}

export async function diagnoseAndCleanFS(executeRepair = false) {
    const report = {
        garbageItems: 0,
        garbageNames: [],
        corruptionDetected: false,
        logs: []
    };

    const { deleteFileContentRecursive, getFileContent } = await import("./fs-db.js");

    // 1. ゴミ箱内のアイテムを完全に空にする（実データ削除 + デフォルト削除マーク付き）
    const trashNode = FS["C:"] ? FS["C:"].Trash : null;
    if (trashNode) {
        const trashKeys = Object.keys(trashNode).filter(key => !PROTECTED_KEYS.has(key));
        report.garbageItems += trashKeys.length;
        report.garbageNames = trashKeys;

        if (executeRepair && trashKeys.length > 0) {
            let deletedCount = 0;
            setBulkUpdating(true);
            try {
                for (const key of trashKeys) {
                    const item = trashNode[key];
                    if (!item || item.system === true) continue;

                    const cleanName = key.replace(/^\d+_/, "");
                    const originalPath = item.originalPath ? `${item.originalPath}/${cleanName}` : cleanName;
                    const deleted = delete trashNode[key];

                    if (deleted) {
                        await deleteFileContentRecursive(`C:/Trash/${key}`);
                        await markDefaultDeleted(originalPath);
                        deletedCount++;
                    }
                }
            } finally {
                setBulkUpdating(false);
            }
            if (deletedCount > 0) {
                report.logs.push(`ゴミ箱から ${deletedCount} 個の項目と実データを完全に削除しました。`);
            }
        } else if (trashKeys.length > 0) {
            report.logs.push(`ゴミ箱の中に ${trashKeys.length} 個のファイルが残っています。`);
        }
    }

    // 2. ルートドライブおよび重要システムフォルダの構造チェック
    if (!FS["C:"] || FS["C:"].type !== "folder") {
        report.corruptionDetected = true;
        report.logs.push(`【警告】システム構造破損: 'C:' ドライブが不正、または消失しています。`);
        if (executeRepair) {
            setBulkUpdating(true);
            try {
                FS["C:"] = structuredClone(FACTORY_FS["C:"]);
            } finally {
                setBulkUpdating(false);
            }
            needsFullSyncSave = true;
            report.logs.push(`[修復] 'C:' ドライブを工場出荷時の状態に再生成しました。`);
        }
    }

    const vitalNodes = ["System", "Desktop", "Programs", "StartMenu"];
    let needsRepair = false;

    vitalNodes.forEach(node => {
        if (!FS["C:"] || !FS["C:"][node] || FS["C:"][node].type !== "folder") {
            report.corruptionDetected = true;
            report.logs.push(`【警告】システム構造破損: 'C:/${node}' ディレクトリが不正、または消失しています。`);

            if (executeRepair) {
                needsRepair = true;
                if (!FS["C:"]) FS["C:"] = { type: "folder", system: true };

                setBulkUpdating(true);
                try {
                    FS["C:"][node] = structuredClone(FACTORY_FS["C:"][node]);
                    report.logs.push(`[修復] 'C:/${node}' ディレクトリを工場出荷時の状態に再生成しました。`);
                } finally {
                    setBulkUpdating(false);
                }
            }
        }
    });

    // 3. kv（仮想FS）と files（外部大容量実データ）のリンク切れ突合検査
    const verifyExternalDataLinks = async (node, currentPath, visited = new WeakSet()) => {
        if (!node || typeof node !== "object" || visited.has(node)) return;
        visited.add(node);

        try {
            for (const key of Object.keys(node)) {
                if (PROTECTED_KEYS.has(key) || key === "hidden" || key === "originalPath" || key === "size" || key === "content") continue;
                const child = node[key];
                if (!child || typeof child !== "object") continue;

                const childPath = `${currentPath}/${key}`;

                if (child.type === "folder") {
                    await verifyExternalDataLinks(child, childPath, visited);
                } else if ((child.type === "file" || child.type === "app") && child.content === "__EXTERNAL_DATA__") {
                    const externalContent = await getFileContent(childPath);
                    if (externalContent === null || externalContent === undefined) {
                        report.corruptionDetected = true;
                        report.logs.push(`【警告】データリンク切れ: '${childPath}' の外部実データがストレージ上に存在しません。`);

                        if (executeRepair) {
                            needsRepair = true;
                            setBulkUpdating(true);
                            try {
                                child.content = "";
                                child.size = 0;
                                child.lastModified = Date.now();
                            } finally {
                                setBulkUpdating(false);
                            }
                            report.logs.push(`[修復] '${childPath}' を空の有効ファイルとして復旧しました。`);
                        }
                    }
                }
            }
        } finally {
            visited.delete(node);
        }
    };

    if (FS["C:"]) {
        await verifyExternalDataLinks(FS["C:"], "C:");
    }

    if (executeRepair && (needsRepair || needsFullSyncSave || dirtyNodePaths.size > 0 || deletedNodePaths.size > 0)) {
        await forceSave();
        window.dispatchEvent(new Event("fs-updated"));
    }

    return report;
}

export async function markDefaultDeleted(path) {
    const { normalizePath } = await import("./fs-utils.js");
    const normalized = normalizePath(path);

    const parts = normalized.replace(/^C:\//, "").split("/").filter(Boolean);
    let node = FACTORY_FS["C:"];
    for (const p of parts) {
        if (node && node[p]) {
            node = node[p];
        } else {
            node = null;
            break;
        }
    }
    if (node) {
        deletedDefaults.add(normalized);
        await dbSet("deleted_defaults", Array.from(deletedDefaults), "kv").catch(e => console.error(e));
    }
}

export async function unmarkDefaultDeleted(path) {
    const { normalizePath } = await import("./fs-utils.js");
    const normalized = normalizePath(path);
    if (deletedDefaults.has(normalized)) {
        deletedDefaults.delete(normalized);
        await dbSet("deleted_defaults", Array.from(deletedDefaults), "kv").catch(e => console.error(e));
    }
}

let watchdogInterval = null;

if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", () => {
        if (watchdogInterval) {
            clearInterval(watchdogInterval);
            watchdogInterval = null;
        }

        if (saveTimer) {
            clearTimeout(saveTimer);
            saveTimer = null;
        }
        if (isSaving || dirtyNodePaths.size > 0 || deletedNodePaths.size > 0 || dirtyMetaOnlyPaths.size > 0) {
            try {
                localStorage.setItem("OS_EMERGENCY_BACKUP", "dirty");
            } catch (e) { }
            forceSave().catch(e => console.error("[FS] Unload save failed:", e));
        }
    });

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
            if (saveTimer || dirtyNodePaths.size > 0 || deletedNodePaths.size > 0 || dirtyMetaOnlyPaths.size > 0) {
                forceSave().catch(e => console.error("[FS] Background save failed:", e));
            }
        }
    });

    watchdogInterval = setInterval(async () => {
        if (isInitializing || isSaving || saveTimer !== null) return;

        try {
            const hasInstalled = localStorage.getItem("nexser_installed") === "true";
            if (!hasInstalled) return;

            // ルート階層ノード（fs_node:C:）の存在を監視
            const sysData = await dbGet("fs_node:C:", "kv");

            if (!sysData) {
                console.error("[FS Watchdog] Critical: Boot volume or database has been deleted externally!");
                const { showBSOD } = await import("./bsod.js");
                showBSOD("UNMOUNTABLE_BOOT_VOLUME", new Error("Runtime boot volume storage or database has been deleted."));
            }
        } catch (e) {
            console.error("[FS Watchdog] Critical: Storage access failure detected:", e);
            try {
                const { showBSOD } = await import("./bsod.js");
                showBSOD("UNMOUNTABLE_BOOT_VOLUME", new Error(`Storage integrity fault: ${e.message || "Unknown error"}`));
            } catch (bsodErr) {
                console.error("Failed to trigger BSOD from watchdog:", bsodErr);
            }
        }
    }, 3000);
}