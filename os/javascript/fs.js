// fs.js
import { saveFS, loadFS } from "./fs-db.js";

let saveTimer = null;
const PROTECTED_KEYS = ["type", "entry", "singleton", "shell", "target", "name"];

export let FS = {
    System: {
        type: "folder",
        system: true,
        "AUTOBOOT.CFG": { type: "file", system: true, content: "" },
        "SoundConfig.json": { type: "file", system: true, content: "{}" }
    },
    Desktop: {
        type: "folder",
        Trash: { type: "link", target: "Trash", system: true },
        Programs: { type: "link", target: "Programs" },
        Documents: { type: "link", target: "Programs/Documents" },
        "Terminal.app": { type: "link", target: "Programs/Applications/Terminal.app" },
        "Calc.app": { type: "link", target: "Programs/Applications/Calc.app" },
        "Soundsplayer.app": { type: "link", target: "Programs/Applications/Soundsplayer.app" },
        "Settings.app": { type: "link", target: "Programs/Applications/Settings.app" }
    },
    Trash: {
        type: "folder",
        system: true,
    },
    Programs: {
        type: "folder",
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
            "AudioPlayer.app": { type: "app", entry: "./apps/audioplayer.js", system: true }
        },
        Accessories: {
            type: "folder",
            system: true,
            "Calc.app": { type: "link", target: "Programs/Applications/Calc.app" },
            "TextEditor.app": { type: "link", target: "Programs/Applications/TextEditor.app" },
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
                "TaskManager.app": { type: "link", target: "Programs/Applications/TaskManager.app" }
            }
        },
        Documents: {
            type: "folder",
            system: true,
            "Readme.txt": { type: "file", content: "Welcome to NEXSER OS", style: { fontSize: 48, fontFamily: "serif", fontWeight: "bold", fontStyle: "italic" } }
        },
        Music: { type: "folder", system: true, },
        Picture: {
            type: "folder",
            system: true,
            "photo1.png": { type: "file", content: "image1data" },
            "photo2.png": { type: "file", content: "image2data" }
        },
        Movie: { type: "folder", system: true, },
        Settings: {
            type: "folder",
            system: true,
            "Settings.app": { type: "link", target: "Programs/Applications/Settings.app" }
        }
    }
};

// 自動保存
let isSaving = false;
async function scheduleSave() {
    if (saveTimer || isSaving) return;
    saveTimer = setTimeout(async () => {
        console.log("[FS Debug] Starting saveFS...");
        saveTimer = null;
        isSaving = true;
        try {
            const rawFS = JSON.parse(JSON.stringify(FS));
            await saveFS(rawFS);
            console.log("[FS Debug] saveFS completed.");
        } catch (e) {
            console.error("[FS] Snapshot failed:", e);
        } finally {
            isSaving = false;
        }
    }, 300);
}

// Proxy 化（再帰的）
function wrapProxy(obj, path = "") {
    if (!obj || typeof obj !== "object") return obj;

    return new Proxy(obj, {
        get(target, prop) {
            const value = target[prop];
            const currentPath = path ? `${path}/${prop}` : prop;
            if (prop === "content" && value === "__EXTERNAL_DATA__") {
                console.info(`[FS] 大容量データへのアクセスを検知: ${path}`);
            }
            return wrapProxy(value, currentPath);
        },
        set(target, prop, value) {
            // 1. メタデータの保護 (type, entry, system など重要な鍵自体は上書きさせない)
            if (PROTECTED_KEYS.includes(prop) && Object.prototype.hasOwnProperty.call(target, prop)) {
                console.warn(`[FS Guard] システムプロパティ '${prop}' は変更できません`);
                return true;
            }

            // 2. システムアイテムの保護ロジックを修正
            // target[prop] ではなく、今書き込もうとしている対象(target)自体が system かどうかで判定します
            if (target.system) {
                // システムフォルダやシステムファイルの中にあるプロパティ(content, style等)の書き換えは許可
                // ただし、そのプロパティ自体がまた system: true を持っている「子アイテム」の場合はブロックを継続
                if (target[prop] && target[prop].system && typeof value === "object") {
                    console.warn(`[FS Guard] システムアイテム '${prop}' 自体は上書きできません`);
                    return true;
                }
            }

            // 3. 既存のサイズ削除ロジック
            if (prop === "content" && target.size !== undefined) {
                delete target.size;
            }

            // 4. 書き込み実行
            target[prop] = wrapProxy(value, path ? `${path}/${prop}` : prop);
            scheduleSave();
            window.dispatchEvent(new Event("fs-updated"));
            return true;
        },
        deleteProperty(target, prop) {
            if (PROTECTED_KEYS.includes(prop)) {
                return false;
            }
            const targetItem = target[prop];
            if (targetItem && targetItem.system === true) {
                console.warn(`[FS Guard] システム保護されたアイテム '${prop}' は削除できません。`);
                return false;
            }
            delete target[prop];
            scheduleSave();
            window.dispatchEvent(new Event("fs-updated"));
            return true;
        }
    });
}

// FS 初期化
export async function initFS() {
    const saved = await loadFS();
    if (saved) {
        isSaving = true; // 復元中の自動保存をロック
        try {
            // 【修正ポイント】
            // 全削除（delete FS[key]）をせず、保存データで上書きする
            for (const key in saved) {
                // すでに system: true なフォルダ（System など）が存在する場合、
                // その中身だけを更新するようにすると、より安全です。
                FS[key] = saved[key];
            }

            console.log("[FS] System restored safely.");
        } catch (e) {
            console.error("[FS] Restore error:", e);
        } finally {
            isSaving = false; // ロック解除
        }
    }
}

// FS を Proxy 化
FS = wrapProxy(FS, "");