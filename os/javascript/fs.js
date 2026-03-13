// fs.js
import { saveFS, loadFS } from "./fs-db.js";

let saveTimer = null;
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
            "RegistryEditor.app": { type: "app", entry: "./apps/registryeditor.js", system: true }
        },
        ControlPanel: { type: "folder", system: true },
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

function wrapProxy(obj, path = "") {
    if (!obj || typeof obj !== "object") return obj;

    return new Proxy(obj, {
        get(target, prop) {
            const value = target[prop];
            const currentPath = path ? `${path}/${prop}` : prop;
            if (prop === "content" && value === "__EXTERNAL_DATA__") {
                console.info(`[FS] 大容量データアクセス: ${path}`);
            }
            return wrapProxy(value, currentPath);
        },
        set(target, prop, value) {
            if (PROTECTED_KEYS.includes(prop) && Object.prototype.hasOwnProperty.call(target, prop)) {
                console.warn(`[FS Guard] '${prop}' は変更不可`);
                return true;
            }
            if (target.system && target[prop] && target[prop].system) {
                if (typeof value === "object" && value !== null && value.type !== target[prop].type) {
                    console.warn(`[FS Guard] '${prop}' の構造型は変更不可`);
                    return true;
                }
            }
            if (prop === "content" && target.size !== undefined) delete target.size;

            target[prop] = wrapProxy(value, path ? `${path}/${prop}` : prop);
            scheduleSave();
            window.dispatchEvent(new Event("fs-updated"));
            return true;
        },
        deleteProperty(target, prop) {
            // system: true がついているものは消せない（Windowsのシステム保護ファイル相当）
            if (PROTECTED_KEYS.includes(prop) || (target[prop] && target[prop].system === true)) {
                console.warn(`[FS Guard] '${prop}' はシステム保護されているため削除できません。`);
                return false;
            }
            delete target[prop];
            scheduleSave();
            window.dispatchEvent(new Event("fs-updated"));
            return true;
        }
    });
}

export const FS = wrapProxy(baseFS, "");

// --- 同期（Sync）エンジン ---

/**
 * saved（保存データ）をベースにし、baseFS（デフォルト）から新しい要素を補完する
 */
function deepSync(currentProxy, savedNode, defaultNode) {
    // 1. 保存データ(savedNode)に無いが、現在のメモリ(currentProxy)に存在するものを処理
    for (const key in currentProxy) {
        if (PROTECTED_KEYS.includes(key)) continue;

        // 保存データにキーが存在しない ＝ ユーザーが削除した
        if (savedNode && !(key in savedNode)) {
            // システム必須属性がない場合のみ、削除を確定させる
            if (!currentProxy[key]?.system) {
                delete currentProxy[key];
            }
        }
    }

    // 2. 保存データ(savedNode)にあるものをメモリに反映
    for (const key in savedNode) {
        if (PROTECTED_KEYS.includes(key)) continue;

        const savedValue = savedNode[key];
        const defaultValue = defaultNode ? defaultNode[key] : null;

        if (savedValue && typeof savedValue === 'object' && savedValue.type === 'folder') {
            // フォルダなら再帰
            if (!currentProxy[key] || currentProxy[key].type !== 'folder') {
                currentProxy[key] = { type: 'folder' };
            }
            deepSync(currentProxy[key], savedValue, defaultValue);
        } else {
            // ファイル、アプリ、リンク等は上書き
            currentProxy[key] = savedValue;
        }
    }

    // 3. baseFS（デフォルト）にあって、保存データにもメモリにも無いものを補完
    // これにより、OSアップデートで追加された新しいファイルが出現する
    if (defaultNode) {
        for (const key in defaultNode) {
            if (!(key in currentProxy)) {
                currentProxy[key] = JSON.parse(JSON.stringify(defaultNode[key]));
                console.log(`[FS Update] New system item added: ${key}`);
            }
        }
    }
}

// --- 保存・初期化 ---

let isSaving = false;
async function scheduleSave() {
    if (saveTimer || isSaving) return;
    saveTimer = setTimeout(async () => {
        saveTimer = null;
        isSaving = true;
        try {
            // Proxyを剥がして純粋なオブジェクトとして保存
            const rawFS = JSON.parse(JSON.stringify(FS));
            await saveFS(rawFS);
        } catch (e) {
            console.error("[FS] Save failed:", e);
        } finally {
            isSaving = false;
        }
    }, 300);
}

export async function initFS() {
    const saved = await loadFS();
    if (!saved) return;

    isSaving = true;
    try {
        // 現在の FS (baseFSが最初に入っている) に対して、保存データを同期する
        deepSync(FS, saved, baseFS);
        console.log("[FS] System synchronized successfully.");
    } catch (e) {
        console.error("[FS] Restore failed", e);
    } finally {
        isSaving = false;
    }
}