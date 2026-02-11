// fs.js
import { saveFS, loadFS } from "./fs-db.js";

let saveTimer = null;

// 初期 FS 定義
export let FS = {
    Desktop: {
        type: "folder",
        Programs: { type: "link", target: "Programs" },
        Desktop: { type: "link", target: "Desktop" },
        Documents: { type: "link", target: "Programs/Documents" },
        "Terminal.app": { type: "link", target: "Programs/Accessories/Systemtools/Terminal.app" },
        "Calc.app": { type: "link", target: "Programs/Accessories/Calc.app" },
        "Settings.app": { type: "link", target: "Programs/Settings/Settings.app" }
    },
    Programs: {
        type: "folder",
        Accessories: {
            type: "folder",
            "Calc.app": { type: "app", entry: "./apps/calc.js", singleton: true },
            "TextEditor.app": { type: "app", entry: "./apps/texteditor.js" },
            Multimedia: {
                type: "folder",
                "CodeEditor.app": { type: "app", entry: "./apps/codeeditor.js" },
                "ImageViewer.app": { type: "app", entry: "./apps/imageviewer.js" },
                "VideoPlayer.app": { type: "app", entry: "./apps/videoplayer.js" }
            },
            Systemtools: {
                type: "folder",
                "Clock.app": { type: "app", entry: "./apps/clock.js", singleton: true },
                "Terminal.app": { type: "app", entry: "./apps/terminal.js", singleton: true },
                "TaskManager.app": {
                    type: "app",
                    name: "Task Manager",
                    entry: "./apps/taskmanager.js",
                    singleton: true
                }
            }
        },
        "Explorer.app": { type: "app", entry: "./apps/explorer.js" },
        Documents: {
            type: "folder",
            "Readme.txt": { type: "file", content: "Welcome to NEXSER OS" }
        },
        Picture: {
            type: "folder",
            "photo1.png": { type: "file", content: "image1data" },
            "photo2.png": { type: "file", content: "image2data" }
        },
        Movie: { type: "folder" },
        Settings: {
            type: "folder",
            "Settings.app": { type: "app", entry: "./apps/settings.js", singleton: true }
        }
    }
};

// 自動保存
function scheduleSave() {
    if (saveTimer) return;

    saveTimer = setTimeout(async () => {
        saveTimer = null;
        try {
            await saveFS(FS);
            console.log("FS saved");
        } catch (e) {
            console.warn("FS save failed", e);
        }
    }, 300);
}

// Proxy 化（再帰的）
function wrapProxy(obj) {
    if (!obj || typeof obj !== "object") return obj;

    return new Proxy(obj, {
        get(target, prop) {
            const value = target[prop];
            return wrapProxy(value);
        },
        set(target, prop, value) {
            target[prop] = wrapProxy(value);
            scheduleSave();
            return true;
        },
        deleteProperty(target, prop) {
            delete target[prop];
            scheduleSave();
            return true;
        }
    });
}

// FS 初期化
export async function initFS() {
    const saved = await loadFS();
    if (saved) {
        // Proxy でラップして FS に反映
        Object.assign(FS, wrapProxy(saved));
        console.log("FS loaded from DB");
    }
}

// FS を Proxy 化
FS = wrapProxy(FS);