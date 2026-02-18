// fs.js
import { saveFS, loadFS } from "./fs-db.js";

let saveTimer = null;
const PROTECTED_KEYS = ["type", "entry", "singleton", "shell", "target", "name"];

export let FS = {
    "System": {
        type: "folder",
        "AUTOBOOT.CFG": { type: "file", content: "" },
        "SoundConfig.json": { type: "file", content: "{}" }
    },
    Desktop: {
        type: "folder",
        Programs: { type: "link", target: "Programs" },
        Desktop: { type: "link", target: "Desktop" },
        Documents: { type: "link", target: "Programs/Documents" },
        "Terminal.app": { type: "link", target: "Programs/Applications/Terminal.app" },
        "Calc.app": { type: "link", target: "Programs/Applications/Calc.app" },
        "Soundsplayer.app": { type: "link", target: "Programs/Applications/Soundsplayer.app" },
        "Settings.app": { type: "link", target: "Programs/Applications/Settings.app" }
    },
    Programs: {
        type: "folder",
        Applications: {
            type: "folder",
            "Calc.app": { type: "app", entry: "./apps/calc.js", singleton: true },
            "TextEditor.app": { type: "app", entry: "./apps/texteditor.js" },
            "CodeEditor.app": { type: "app", entry: "./apps/codeeditor.js" },
            "ImageViewer.app": { type: "app", entry: "./apps/imageviewer.js" },
            "VideoPlayer.app": { type: "app", entry: "./apps/videoplayer.js" },
            "Clock.app": { type: "app", entry: "./apps/clock.js", singleton: true },
            "Terminal.app": { type: "app", entry: "./apps/terminal.js", singleton: true },
            "TaskManager.app": { type: "app", name: "Task Manager", entry: "./apps/taskmanager.js", singleton: true },
            "Settings.app": { type: "app", entry: "./apps/settings.js", singleton: true },
            "Explorer.app": { type: "app", entry: "./apps/explorer.js", shell: true },
            "Soundsplayer.app": { type: "app", entry: "./apps/soundplayer.js" }
        },
        Accessories: {
            type: "folder",
            "Calc.app": { type: "link", target: "Programs/Applications/Calc.app" },
            "TextEditor.app": { type: "link", target: "Programs/Applications/TextEditor.app" },
            Multimedia: {
                type: "folder",
                "CodeEditor.app": { type: "link", target: "Programs/Applications/CodeEditor.app" },
                "ImageViewer.app": { type: "link", target: "Programs/Applications/ImageViewer.app" },
                "VideoPlayer.app": { type: "link", target: "Programs/Applications/VideoPlayer.app" }
            },
            Systemtools: {
                type: "folder",
                "Clock.app": { type: "link", target: "Programs/Applications/Clock.app" },
                "Terminal.app": { type: "link", target: "Programs/Applications/Terminal.app" },
                "TaskManager.app": { type: "link", target: "Programs/Applications/TaskManager.app" }
            }
        },
        Documents: {
            type: "folder",
            "Readme.txt": { type: "file", content: "Welcome to NEXSER OS", style: { fontSize: 48, fontFamily: "serif", fontWeight: "bold", fontStyle: "italic" } }
        },
        Music: { type: "folder" },
        Picture: {
            type: "folder",
            "photo1.png": { type: "file", content: "image1data" },
            "photo2.png": { type: "file", content: "image2data" }
        },
        Movie: { type: "folder" },
        Settings: {
            type: "folder",
            "Settings.app": { type: "link", target: "Programs/Applications/Settings.app" }
        }
    }
};

// 自動保存
let isSaving = false;
async function scheduleSave() {
    if (saveTimer || isSaving) return; // 保存中もスキップして保護
    saveTimer = setTimeout(async () => {
        saveTimer = null;
        isSaving = true;
        try {
            await saveFS(FS);
        } finally {
            isSaving = false;
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
        // --- 【修正】書き込み保護 ---
        set(target, prop, value) {
            // プロパティが保護リストに含まれ、かつ既にオブジェクトに存在する場合のみ変更を拒否
            if (PROTECTED_KEYS.includes(prop) && Object.prototype.hasOwnProperty.call(target, prop)) {
                console.warn(`[FS Guard] システム予約プロパティ '${prop}' は保護されているため変更できません。BSODを回避しました。`);
                return true; // 処理をスキップして終了（呼び出し側にエラーは投げない）
            }

            target[prop] = wrapProxy(value);
            scheduleSave();
            return true;
        },
        // --- 【修正】削除保護 ---
        deleteProperty(target, prop) {
            // 保護キーの削除を禁止
            if (PROTECTED_KEYS.includes(prop)) {
                console.warn(`[FS Guard] システム予約プロパティ '${prop}' は保護されているため削除できません。BSODを回避しました。`);
                return false; // 削除を拒否
            }

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
        // 保存されたデータも Proxy を通して反映（不正なデータがあればここでブロックされる）
        Object.assign(FS, wrapProxy(saved));
        console.log("FS loaded from DB and protected.");
    }
}

// FS を Proxy 化
FS = wrapProxy(FS);