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

// 1. ベースデータ
const baseFS = {
    System: {
        type: "folder",
        system: true,
        "AUTOBOOT.CFG": { type: "file", system: true, content: "", hidden: true },
        "SoundConfig.json": { type: "file", system: true, content: "{}" }
    },
    Desktop: {
        type: "folder",
        system: true,
        Trash: { type: "link", target: "Trash", system: true },
        "My Computer": { type: "link", target: "Programs" },
        "ControlPanel": { type: "link", target: "Programs/ControlPanel" },
        Documents: { type: "link", target: "Programs/Documents" },
        "Terminal.app": { type: "link", target: "Programs/Applications/Terminal.app" },
        "Calc.app": { type: "link", target: "Programs/Applications/Calc.app" },
        "Soundsplayer.app": { type: "link", target: "Programs/Applications/Soundsplayer.app" },
        "Settings.app": { type: "link", target: "Programs/Applications/Settings.app" }
    },
    StartMenu: {
        type: "folder",
        system: true,
        Programs: { type: "link", target: "Programs" },
        ControlPanel: { type: "link", target: "Programs/ControlPanel" },
        Documents: { type: "link", target: "Programs/Documents" },
        "Settings.app": { type: "link", target: "Programs/Applications/Settings.app" },
        "Terminal.app": { type: "link", target: "Programs/Applications/Terminal.app" }
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
            "TaskbarProperties.app": { type: "link", target: "Programs/Applications/TaskbarProperties.app" },
            "SystemProperties.app": { type: "link", target: "Programs/Applications/SystemProperties.app" }
        },
        Accessories: {
            type: "folder",
            system: true,
            "Calc.app": { type: "link", target: "Programs/Applications/Calc.app" },
            "TextEditor.app": { type: "link", target: "Programs/Applications/TextEditor.app" },
            "Paint.app": { type: "link", target: "Programs/Applications/Paint.app" },
            Games: {
                type: "folder",
                system: true,
                "Tetris.app": { type: "app", entry: "./apps/games/tetris.js", system: true },
                "Minesweeper.app": { type: "app", entry: "./apps/games/minesweeper.js", system: true }
            },
            Multimedia: {
                type: "folder",
                system: true,
                "CodeEditor.app": { type: "link", target: "Programs/Applications/CodeEditor.app" },
                "ImageViewer.app": { type: "link", target: "Programs/Applications/ImageViewer.app" },
                "PDFViewer.app": { type: "link", target: "Programs/Applications/PDFViewer.app" },
                "VideoPlayer.app": { type: "link", target: "Programs/Applications/VideoPlayer.app" }
            },
            Systemtools: {
                type: "folder",
                system: true,
                "Clock.app": { type: "link", target: "Programs/Applications/Clock.app" },
                "Terminal.app": { type: "link", target: "Programs/Applications/Terminal.app" },
                "TaskManager.app": { type: "link", target: "Programs/Applications/TaskManager.app" },
                "RegistryEditor.app": { type: "link", target: "Programs/Applications/RegistryEditor.app" }
            }
        },
        Documents: {
            type: "folder",
            system: true
        },
        Music: { type: "folder", system: true },
        Picture: {
            type: "folder",
            system: true
        },
        Movie: { type: "folder", system: true },
        Settings: {
            type: "folder",
            system: true,
            "Settings.app": { type: "link", target: "Programs/Applications/Settings.app" }
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
                scheduleSave();
                window.dispatchEvent(new Event("fs-updated"));
            }
            return true;
        },

        deleteProperty(target, prop) {
            if (PROTECTED_KEYS.has(prop) || (target[prop] && target[prop].system === true)) {
                return false;
            }

            // 【NTFS風改善】削除時もロック中であればブロック
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
                scheduleSave();
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

// --- 保存・初期化 ---

async function performSave() {
    isSaving = true;
    try {
        await saveFS(baseFS);
        if (DEBUG_FS) console.log("[FS] Save completed.");
    } catch (e) {
        console.error("[FS] Save failed:", e);
        throw new Error(`FS_FATAL_WRITE_FAULT: ${e.message}`);
    } finally {
        isSaving = false;

        if (pendingSave) {
            pendingSave = false;
            scheduleSave();
        }
    }
}

let pendingSave = false;

async function scheduleSave() {
    if (saveTimer) return;

    if (isSaving) {
        pendingSave = true;
        return;
    }

    saveTimer = setTimeout(async () => {
        saveTimer = null;
        await performSave();

        if (pendingSave) {
            pendingSave = false;
            scheduleSave();
        }
    }, 1000);
}

export async function forceSave() {
    if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
    }

    if (isSaving) {
        pendingSave = true;
        return;
    }

    await performSave();
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
        await performSave();
    }
}

export async function diagnoseAndCleanFS(executeRepair = false) {
    const report = {
        garbageItems: 0,
        garbageNames: [],
        corruptionDetected: false,
        logs: []
    };

    if (FS.Trash) {
        const trashKeys = Object.keys(FS.Trash).filter(key => !PROTECTED_KEYS.has(key));
        report.garbageItems += trashKeys.length;
        report.garbageNames = trashKeys;

        if (executeRepair && trashKeys.length > 0) {
            trashKeys.forEach(key => {
                delete FS.Trash[key];
            });
            report.logs.push(`ゴミ箱から ${trashKeys.length} 個の項目を完全に削除しました。`);
        } else if (trashKeys.length > 0) {
            report.logs.push(`ゴミ箱の中に ${trashKeys.length} 個のファイルが残っています。`);
        }
    }

    const vitalNodes = ["System", "Desktop", "Programs", "StartMenu"];
    vitalNodes.forEach(node => {
        if (!FS[node] || FS[node].type !== "folder") {
            report.corruptionDetected = true;
            report.logs.push(`【警告】システム構造破損: '${node}' ディレクトリが不正、または消失しています。`);

            if (executeRepair) {
                FS[node] = structuredClone(FACTORY_FS[node]);
                report.logs.push(`[修復] '${node}' ディレクトリを工場出荷時の状態に再生成しました。`);
            }
        }
    });

    if (executeRepair) {
        await forceSave();
        window.dispatchEvent(new Event("fs-updated"));
    }

    return report;
}

export async function markDefaultDeleted(path) {
    const parts = path.split("/");
    let node = FACTORY_FS;
    for (const p of parts) {
        if (node && node[p]) {
            node = node[p];
        } else {
            node = null;
            break;
        }
    }
    if (node) {
        deletedDefaults.add(path);
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
        if (isSaving || pendingSave) {
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
            const sysData = await dbGet("fs_System", "kv");

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