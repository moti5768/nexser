// fs.js
import { saveFS, loadFS, dbGet, dbSet } from "./fs-db.js";

let saveTimer = null;
let deletedDefaults = new Set();
let isSaving = false;
let isInitializing = false;
const DEBUG_FS = false;
const PROTECTED_KEYS = new Set(["type", "entry", "singleton", "shell", "target", "name", "system", "lastModified"]);

export let isBulkUpdating = false;
export function setBulkUpdating(flag) {
    isBulkUpdating = flag;
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
    for (const [path, lockInfo] of fileLocks.entries()) {
        if (path === pathPrefix || path.startsWith(pathPrefix + "/")) {
            fileLocks.delete(path);
            console.log(`[FS Lock] パス解放に伴いロックを自動解除しました: ${path}`);
        }
    }
}

// 1. ベースデータ
// ✅ 改善後：Windows と同様に "C:" ドライブを明確なルートコンテナとし、その配下に体系化
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
                "Explorer.app": { type: "app", entry: "./apps/explorer.js", system: true, shell: true, hidden: true },
                "Soundsplayer.app": { type: "app", entry: "./apps/soundplayer.js", system: true },
                "AudioPlayer.app": { type: "app", entry: "./apps/audioplayer.js", system: true },
                "Paint.app": { type: "app", entry: "./apps/paint.js", system: true },
                "RegistryEditor.app": { type: "app", entry: "./apps/registryeditor.js", system: true },
                "SystemProperties.app": { type: "app", entry: "./apps/systemproperties.js", system: true },
                "TaskbarProperties.app": { type: "app", entry: "./apps/taskbarproperties.js", system: true },
                "PDFViewer.app": { type: "app", entry: "./apps/pdfviewer.js", system: true },
                "Browser.app": { type: "app", entry: "./apps/Browser.js", system: true },
                "Networkmonitor.app": { type: "app", entry: "./apps/network_monitor.js", system: true }
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

// --- コアロジック ---

const proxyCache = new WeakMap();

function wrapProxy(obj, path = "") {
    if (!obj || typeof obj !== "object") return obj;

    if (proxyCache.has(obj)) {
        return proxyCache.get(obj);
    }

    const proxy = new Proxy(obj, {
        get(target, prop) {
            if (prop === '__proto__' || prop === 'constructor' || prop === 'prototype') {
                return undefined;
            }

            const value = target[prop];
            if (typeof prop === "symbol") {
                return target[prop];
            }

            const currentPath = path ? `${path}/${prop}` : prop;

            if (prop === "content" && value === "__EXTERNAL_DATA__") {
                if (DEBUG_FS) console.info(`[FS] Large data access: ${path}`);
            }

            if (value && typeof value === "object") {
                return wrapProxy(value, currentPath);
            }
            return value;
        },

        set(target, prop, value) {
            if (prop === '__proto__' || prop === 'constructor' || prop === 'prototype') {
                return false;
            }

            if (PROTECTED_KEYS.has(prop) && Object.hasOwn(target, prop)) return true;

            // 【NTFS風改善】ファイルが排他ロックされている場合は書き込みを拒否
            const currentPath = path ? `${path}/${prop}` : prop;
            const lockInfo = fileLocks.get(currentPath);
            if (lockInfo && lockInfo.mode === "exclusive") {
                console.error(`[FS Error] 書き込み拒否: '${currentPath}' はロックされています。`);
                return false;
            }

            if (!isInitializing && prop !== "lastModified" && target[prop] !== value) {
                target.lastModified = Date.now();
            }
            target[prop] = value;

            if (!isSaving && !isInitializing && !isBulkUpdating) {
                if (prop === "content" && value !== "__EXTERNAL_DATA__") {
                    import("./fs-db.js").then(db => {
                        db.saveSingleFile(currentPath, value).catch(err => {
                            console.error(`[FS] 個別ファイルの差分保存に失敗しました: ${currentPath}`, err);
                        });
                    });
                }
                else if (prop === "lastModified") {
                    return true;
                }
                else {
                    // ⭐ 【部分差分改善】全体保存の代わりに、変更があったルートフォルダ単位のみを個別保存する
                    const topKey = currentPath.split("/")[0];
                    import("./fs-db.js").then(db => {
                        if (db.saveFolderNode && baseFS[topKey]) {
                            db.saveFolderNode(topKey, baseFS[topKey]).catch(err => {
                                console.error(`[FS] フォルダ部分保存に失敗しました: ${topKey}`, err);
                            });
                        } else {
                            scheduleSave(); // フォールバック
                        }
                    });
                }

                window.dispatchEvent(new Event("fs-updated"));
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

            delete target[prop];

            if (!isInitializing) {
                target.lastModified = Date.now();
            }

            if (!isSaving && !isInitializing && !isBulkUpdating) {
                // ⭐ 【部分差分改善】削除時も全体保存を行わず、該当ルートフォルダのみを個別部分保存する
                const topKey = currentPath.split("/")[0];
                import("./fs-db.js").then(db => {
                    if (db.saveFolderNode && baseFS[topKey]) {
                        db.saveFolderNode(topKey, baseFS[topKey]).catch(err => {
                            console.error(`[FS] 削除時のフォルダ部分保存に失敗しました: ${topKey}`, err);
                        });
                    } else {
                        scheduleSave();
                    }
                });

                window.dispatchEvent(new Event("fs-updated"));
            }
            return true;
        }
    });

    proxyCache.set(obj, proxy);
    return proxy;
}

export const FS = wrapProxy(baseFS, "");

// --- 同期（Sync）エンジン ---

function deepSync(currentProxy, savedNode, defaultNode, path = "", visited = new WeakSet()) {
    if (!currentProxy || typeof currentProxy !== "object" || visited.has(currentProxy)) return;
    visited.add(currentProxy);

    try {
        for (const key in currentProxy) {
            if (PROTECTED_KEYS.has(key)) continue;
            if (savedNode && !(key in savedNode)) {
                const curVal = currentProxy[key];
                if (!curVal || !curVal.system) {
                    delete currentProxy[key];

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

            if (savedValue && typeof savedValue === 'object' && savedValue.type === 'folder') {
                if (!currentProxy[key] || currentProxy[key].type !== 'folder') {
                    currentProxy[key] = { type: 'folder' };
                }

                for (const subKey in savedValue) {
                    if (PROTECTED_KEYS.has(subKey) || subKey === "hidden" || subKey === "originalPath") {
                        currentProxy[key][subKey] = savedValue[subKey];
                    }
                }

                deepSync(currentProxy[key], savedValue, defaultValue, currentPath, visited);
            } else {
                currentProxy[key] = savedValue;
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
                    if (DEBUG_FS) console.log(`[FS Update] New system item added: ${key}`);
                }
            }
        }
    } finally {
        visited.delete(currentProxy);
    }
}

// --- 保存・初期化 (Promiseチェーン版) ---

let currentSavePromise = Promise.resolve();

async function executeSave() {
    isSaving = true;
    try {
        await saveFS(baseFS);
        if (DEBUG_FS) console.log("[FS] Save completed.");
    } catch (e) {
        console.error("[FS] Save failed:", e);
        throw new Error(`FS_FATAL_WRITE_FAULT: ${e.message}`);
    } finally {
        isSaving = false;
    }
}

async function scheduleSave() {
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
        }, 1000); // 通常の自動保存は1秒のデバウンス（遅延）を維持
    });
}

export async function forceSave() {
    // 予約されている通常の自動保存タイマーがあればクリアして今すぐ実行に切り替える
    if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
    }

    currentSavePromise = currentSavePromise.catch(() => { }).then(() => executeSave());
    return currentSavePromise;
}

// 内部互換用
async function performSave() {
    return forceSave();
}

export async function initFS() {
    const saved = await loadFS();
    const hasInitializedBefore = localStorage.getItem("nexser_installed") === "true";

    if (!saved && hasInitializedBefore) {
        console.error("[FS] Boot volume data is missing! Triggering BSOD.");
        const { showBSOD } = await import("./bsod.js");
        showBSOD("UNMOUNTABLE_BOOT_VOLUME", new Error("Boot volume could not be mounted or has been deleted."));
        return;
    }

    const savedDeletedDefaults = await dbGet("deleted_defaults", "kv");
    if (savedDeletedDefaults && Array.isArray(savedDeletedDefaults)) {
        deletedDefaults = new Set(savedDeletedDefaults);
    }

    isSaving = true;
    isInitializing = true;

    try {
        if (!saved) {
            localStorage.setItem("nexser_installed", "true");
            if (DEBUG_FS) console.log("[FS] First-time boot: Initializing and saving factory data...");
            await performSave();
        } else {
            localStorage.setItem("nexser_installed", "true");
            deepSync(FS, saved, FACTORY_FS, "", new WeakSet());
            if (DEBUG_FS) console.log("[FS] System synchronized successfully.");
        }
    } catch (e) {
        console.error("[FS] Initialization/Restore failed:", e);
        const { showBSOD } = await import("./bsod.js");
        showBSOD("UNMOUNTABLE_BOOT_VOLUME", new Error(`FS_FATAL_RESTORE_FAULT: ${e.message}`));
    } finally {
        isInitializing = false;
        isSaving = false;
        if (!saved) {
            await performSave();
        }
    }
}

export async function diagnoseAndCleanFS(executeRepair = false) {
    const report = {
        garbageItems: 0,
        garbageNames: [],
        corruptionDetected: false,
        logs: []
    };

    const trashNode = FS["C:"] ? FS["C:"].Trash : null;
    if (trashNode) {
        const trashKeys = Object.keys(trashNode).filter(key => !PROTECTED_KEYS.has(key));
        report.garbageItems += trashKeys.length;
        report.garbageNames = trashKeys;

        if (executeRepair && trashKeys.length > 0) {
            trashKeys.forEach(key => {
                delete trashNode[key];
            });
            report.logs.push(`ゴミ箱から ${trashKeys.length} 個の項目を完全に削除しました。`);
        } else if (trashKeys.length > 0) {
            report.logs.push(`ゴミ箱の中に ${trashKeys.length} 個のファイルが残っています。`);
        }
    }

    if (!FS["C:"] || FS["C:"].type !== "folder") {
        report.corruptionDetected = true;
        report.logs.push(`【警告】システム構造破損: 'C:' ドライブが不正、または消失しています。`);
        if (executeRepair) {
            FS["C:"] = structuredClone(FACTORY_FS["C:"]);
            report.logs.push(`[修復] 'C:' ドライブを工場出荷時の状態に再生成しました。`);
        }
    }

    const vitalNodes = ["System", "Desktop", "Programs", "StartMenu"];
    let needsRepair = false;

    vitalNodes.forEach(node => {
        // ✅ C: ドライブ配下のフォルダ構造を検証
        if (!FS["C:"] || !FS["C:"][node] || FS["C:"][node].type !== "folder") {
            report.corruptionDetected = true;
            report.logs.push(`【警告】システム構造破損: 'C:/${node}' ディレクトリが不正、または消失しています。`);

            if (executeRepair) {
                needsRepair = true;
                if (!FS["C:"]) FS["C:"] = { type: "folder", system: true };

                // ⭐ 一括更新フラグを有効化して、個別の自動部分保存の頻発を抑制
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

    if (executeRepair && needsRepair) {
        await forceSave();
        window.dispatchEvent(new Event("fs-updated"));
    }

    return report;
}

export async function markDefaultDeleted(path) {
    // 循環インポートを回避するため、実行時に動的インポートする
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
        if (isSaving) {
            try {
                localStorage.setItem("OS_EMERGENCY_BACKUP", "dirty");
            } catch (e) { }
        }
        forceSave().catch(e => console.error("[FS] Unload save failed:", e));
    });

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
            forceSave().catch(e => console.error("[FS] Background save failed:", e));
        }
    });

    watchdogInterval = setInterval(async () => {
        if (isInitializing || isSaving) return;

        try {
            const hasInstalled = localStorage.getItem("nexser_installed") === "true";
            if (!hasInstalled) return;

            const { dbGet } = await import("./fs-db.js");
            const sysData = await dbGet("fs_C:", "kv"); // ✅ C: ドライブの保存データを正しく参照

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