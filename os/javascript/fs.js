// fs.js
import { saveFS } from "./fs-db.js";
let saveTimer = null;
export let FS = {
    Desktop: {
        type: "folder",
        // ★ ショートカット
        "Explorer.app": { type: "link", target: "Programs/Explorer.app" },
        "Documents": { type: "link", target: "Programs/Documents" },
        "Images": { type: "link", target: "Programs/Documents/Images" },
        "Terminal.app": { type: "link", target: "Programs/Terminal.app" },
        "Calc.app": { type: "link", target: "Programs/Calc.app" },
        "Settings.app": { type: "link", target: "Programs/Settings.app" }
    },

    Programs: {
        type: "folder",
        // ★ アプリ実体はここだけ
        "Explorer.app": { type: "app", entry: "./apps/explorer.js" },
        "Documents": {
            type: "folder",
            "Notes.txt": { type: "file", content: "My personal notes..." },
            "Images": {
                type: "folder",
                "photo1.png": { type: "file", content: "image1data" },
                "photo2.png": { type: "file", content: "image2data" }
            }
        },
        "Settings.app": { type: "app", entry: "./apps/settings.js", singleton: true },
        "Terminal.app": { type: "app", entry: "./apps/terminal.js", singleton: true },
        "Calc.app": { type: "app", entry: "./apps/calc.js", singleton: true },
        "Readme.txt": { type: "file", content: "Welcome to NEXSER OS" }
    }
};

export function replaceFS(newFS) {
    if (!newFS) return;
    FS = wrapProxy(newFS);
}

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
    }, 300); // 300ms デバウンス
}

/* =========================
   Auto Save Proxy
========================= */

function wrapProxy(obj) {
    if (!obj || typeof obj !== "object") return obj;

    return new Proxy(obj, {
        get(target, prop) {
            const v = target[prop];
            return wrapProxy(v);
        },
        set(target, prop, value) {
            target[prop] = value;
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

// FS を Proxy 化
FS = wrapProxy(FS);