// fs.js
import { saveFS, loadFS } from "./fs-db.js";

let saveTimer = null;
const PROTECTED_KEYS = ["type", "entry", "singleton", "shell", "target", "name"];

// 1. ベースデータ (Proxy化しない純粋なデータ構造)
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
        Programs: { type: "link", target: "Programs" },
        Documents: { type: "link", target: "Programs/Documents" },
        "Terminal.app": { type: "link", target: "Programs/Applications/Terminal.app" },
        "Calc.app": { type: "link", target: "Programs/Applications/Calc.app" },
        "Soundsplayer.app": { type: "link", target: "Programs/Applications/Soundsplayer.app" },
        "Settings.app": { type: "link", target: "Programs/Applications/Settings.app" }
    },
    Trash: { type: "folder", system: true },
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
            "AudioPlayer.app": { type: "app", entry: "./apps/audioplayer.js", system: true },
            "Paint.app": { type: "app", entry: "./apps/paint.js", system: true }
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
                "TaskManager.app": { type: "link", target: "Programs/Applications/TaskManager.app" }
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

// Proxy 生成ロジック
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
            // 1. メタデータの保護
            if (PROTECTED_KEYS.includes(prop) && Object.prototype.hasOwnProperty.call(target, prop)) {
                console.warn(`[FS Guard] システムプロパティ '${prop}' は変更できません`);
                return true;
            }

            // 2. システム保護ロジックの改善
            // すでに存在するシステムアイテムを更新する場合のチェック
            if (target.system && target[prop] && target[prop].system) {
                // もし新しい値(value)がオブジェクトで、typeが既存と異なる場合は「構造変更」とみなしてブロック
                if (typeof value === "object" && value !== null && value.type !== target[prop].type) {
                    console.warn(`[FS Guard] システムアイテム '${prop}' の構造（type）は変更できません`);
                    return true;
                }
                // ※ ここで return true せずに処理を続行すれば、
                // typeが同じ場合（＝中身の更新や同一オブジェクトの再代入）は許可されます。
            }

            // 3. サイズ情報の削除
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
            if (PROTECTED_KEYS.includes(prop) || (target[prop] && target[prop].system === true)) {
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

// ★ 最初から Proxy された状態の FS を公開する（これが重要）
export const FS = wrapProxy(baseFS, "");

// --- ユーティリティ ---

export function isValidNode(node) {
    if (!node || typeof node !== 'object') return false;
    if (!['folder', 'file', 'link', 'app'].includes(node.type)) return false;
    return true;
}

// 安全な再帰的マージ関数
function deepMerge(target, source) {
    for (const key in source) {
        // ソースがフォルダの場合、階層を深くする
        if (source[key] && typeof source[key] === 'object' && source[key].type === 'folder') {
            if (!target[key]) target[key] = { type: 'folder' };
            deepMerge(target[key], source[key]);
        } else {
            // ファイル/リンク等は直接代入（Proxyが自動的に機能する）
            if (isValidNode(source[key])) {
                target[key] = source[key];
            } else {
                console.error(`[FS Recovery] Skipping invalid node: ${key}`);
            }
        }
    }
}

// 自動保存
let isSaving = false;
async function scheduleSave() {
    if (saveTimer || isSaving) return;
    saveTimer = setTimeout(async () => {
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

// 初期化関数
export async function initFS() {
    const saved = await loadFS();
    if (!saved) return;

    isSaving = true; // 復元中の自動保存をロック
    try {
        deepMerge(FS, saved);
        console.log("[FS] System restored safely.");
    } catch (e) {
        console.error("[FS] Restore failed, using defaults", e);
    } finally {
        isSaving = false;
    }
}