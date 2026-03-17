// fs.js
import { saveFS, loadFS } from "./fs-db.js";

let saveTimer = null;
const DEBUG_FS = false;
const PROTECTED_KEYS = ["type", "entry", "singleton", "shell", "target", "name"];

// 1. ベースデータ
const baseFS = {
    System: {
        type: "folder",
        system: true,
        "AUTOBOOT.CFG": { type: "file", system: true, content: "" },
        "SoundConfig.json": { type: "file", system: true, content: "{}" }
    },
    Desktop: {
        type: "folder",
        Trash: { type: "link", target: "Trash", system: true },
        "My Computer": { type: "link", target: "Programs", system: true },
        "ControlPanel": { type: "link", target: "Programs/ControlPanel", system: true },
        Documents: { type: "link", target: "Programs/Documents" },
        "Terminal.app": { type: "link", target: "Programs/Applications/Terminal.app" },
        "Calc.app": { type: "link", target: "Programs/Applications/Calc.app" },
        "Soundsplayer.app": { type: "link", target: "Programs/Applications/Soundsplayer.app" },
        "Settings.app": { type: "link", target: "Programs/Applications/Settings.app" }
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
            "Explorer.app": { type: "app", entry: "./apps/explorer.js", system: true, shell: true },
            "Soundsplayer.app": { type: "app", entry: "./apps/soundplayer.js", system: true },
            "AudioPlayer.app": { type: "app", entry: "./apps/audioplayer.js", system: true },
            "Paint.app": { type: "app", entry: "./apps/paint.js", system: true },
            "RegistryEditor.app": { type: "app", entry: "./apps/registryeditor.js", system: true },
            "SystemProperties.app": { type: "app", entry: "./apps/systemproperties.js", system: true },
            "TaskbarProperties.app": { type: "app", entry: "./apps/taskbarproperties.js", system: true }
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
            Multimedia: {
                type: "folder",
                system: true,
                "CodeEditor.app": { type: "link", target: "Programs/Applications/CodeEditor.app" },
                "ImageViewer.app": { type: "link", target: "Programs/Applications/ImageViewer.app" },
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
            system: true,
            "Readme.txt": { type: "file", content: "Welcome to NEXSER OS", style: { fontSize: 48, fontFamily: "serif", fontWeight: "bold", fontStyle: "italic" } }
        },
        Music: { type: "folder", system: true },
        Picture: {
            type: "folder",
            system: true,
            "photo1.png": { type: "file", content: "image1data" },
            "photo2.png": { type: "file", content: "image2data" }
        },
        Movie: { type: "folder", system: true },
        Settings: {
            type: "folder",
            system: true,
            "Settings.app": { type: "link", target: "Programs/Applications/Settings.app" }
        }
    }
};

// --- コアロジック ---

const proxyCache = new WeakMap();

function wrapProxy(obj, path = "") {
    if (!obj || typeof obj !== "object") return obj;

    if (proxyCache.has(obj)) {
        return proxyCache.get(obj);
    }

    const proxy = new Proxy(obj, {
        get(target, prop) {
            const value = target[prop];
            if (typeof prop === "symbol") {
                return target[prop];
            }

            const currentPath = path ? `${path}/${prop}` : prop;

            if (prop === "content" && value === "__EXTERNAL_DATA__") {
                if (DEBUG_FS) console.info(`[FS] Large data access: ${path}`);
            }

            return wrapProxy(value, currentPath);
        },

        set(target, prop, value) {
            if (PROTECTED_KEYS.includes(prop) && Object.prototype.hasOwnProperty.call(target, prop)) {
                if (DEBUG_FS) console.warn(`[FS Guard] '${prop}' は変更不可`);
                return true;
            }
            target[prop] = value;
            scheduleSave();
            window.dispatchEvent(new Event("fs-updated"));
            return true;
        },

        deleteProperty(target, prop) {
            if (PROTECTED_KEYS.includes(prop) || (target[prop] && target[prop].system === true)) {
                if (DEBUG_FS) console.warn(`[FS Guard] '${prop}' は削除不可`);
                return false;
            }

            if (prop in target) {
                delete target[prop];
            }

            scheduleSave();
            window.dispatchEvent(new Event("fs-updated"));
            return true;
        }
    });

    proxyCache.set(obj, proxy);
    return proxy;
}

export const FS = wrapProxy(baseFS, "");

// --- 同期（Sync）エンジン ---

function deepSync(currentProxy, savedNode, defaultNode) {
    for (const key in currentProxy) {
        if (PROTECTED_KEYS.includes(key)) continue;
        if (savedNode && !(key in savedNode)) {
            if (!currentProxy[key]?.system) {
                delete currentProxy[key];
            }
        }
    }

    for (const key in savedNode) {
        if (PROTECTED_KEYS.includes(key)) continue;

        const savedValue = savedNode[key];
        const defaultValue = defaultNode ? defaultNode[key] : null;

        if (savedValue && typeof savedValue === 'object' && savedValue.type === 'folder') {
            if (!currentProxy[key] || currentProxy[key].type !== 'folder') {
                currentProxy[key] = { type: 'folder' };
            }
            deepSync(currentProxy[key], savedValue, defaultValue);
        } else {
            currentProxy[key] = savedValue;
        }
    }

    if (defaultNode) {
        for (const key in defaultNode) {
            if (!(key in currentProxy)) {
                currentProxy[key] = JSON.parse(JSON.stringify(defaultNode[key]));
                if (DEBUG_FS) console.log(`[FS Update] New system item added: ${key}`);
            }
        }
    }
}

// --- 保存・初期化 ---

let isSaving = false;

/**
 * 実際の書き込み処理 (100%維持しつつ共通化)
 */
async function performSave() {
    isSaving = true;
    try {
        const rawFS = JSON.parse(JSON.stringify(FS));
        await saveFS(rawFS);
        if (DEBUG_FS) console.log("[FS] Save completed.");
    } catch (e) {
        console.error("[FS] Save failed:", e);
    } finally {
        isSaving = false;
    }
}

/**
 * 通常の遅延保存 (1秒待機)
 */
async function scheduleSave() {
    if (saveTimer || isSaving) return;
    saveTimer = setTimeout(async () => {
        saveTimer = null;
        await performSave();
    }, 1000);
}

/**
 * 【追加】強制即時保存 (リロード前の消失防止用)
 */
export async function forceSave() {
    if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
    }
    await performSave();
}

export async function initFS() {
    const saved = await loadFS();
    if (!saved) return;

    isSaving = true;
    try {
        deepSync(FS, saved, baseFS);
        if (DEBUG_FS) console.log("[FS] System synchronized successfully.");
    } catch (e) {
        console.error("[FS] Restore failed", e);
    } finally {
        isSaving = false;
    }
}