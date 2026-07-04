// fs.js
import { saveFS, loadFS } from "./fs-db.js";

let saveTimer = null;
const DEBUG_FS = false;
const PROTECTED_KEYS = new Set(["type", "entry", "singleton", "shell", "target", "name", "system"]);

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
        system: true,
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
            "TaskbarProperties.app": { type: "app", entry: "./apps/taskbarproperties.js", system: true },
            "PDFViewer.app": { type: "app", entry: "./apps/pdfviewer.js", system: true }
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
            if (PROTECTED_KEYS.has(prop) && Object.hasOwn(target, prop)) return true;
            target[prop] = value;

            // isSaving 中は保存予約をしない
            if (!isSaving) {
                scheduleSave();
                window.dispatchEvent(new Event("fs-updated"));
            }
            return true;
        },

        deleteProperty(target, prop) {
            if (PROTECTED_KEYS.has(prop) || (target[prop] && target[prop].system === true)) {
                return false;
            }
            delete target[prop];

            // ここにも追加
            if (!isSaving) {
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

function deepSync(currentProxy, savedNode, defaultNode) {
    for (const key in currentProxy) {
        if (PROTECTED_KEYS.has(key)) continue;
        if (savedNode && !(key in savedNode)) {
            const curVal = currentProxy[key];
            if (!curVal || !curVal.system) {
                delete currentProxy[key];
            }
        }
    }

    for (const key in savedNode) {
        if (PROTECTED_KEYS.has(key)) continue;

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
                currentProxy[key] = structuredClone(defaultNode[key]);
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
        const rawFS = structuredClone(baseFS);

        // 簡単な整合性チェック
        if (!rawFS || typeof rawFS !== 'object') throw new Error("Invalid FS structure");

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

/**
 * 【追加・改善】強制即時保存 (リロード前の消失防止用、多重実行防止付き)
 */
export async function forceSave() {
    // 待機中のタイマーがあればクリアする
    if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
    }

    // すでに別スレッド（非同期タスク）が保存実行中の場合は、
    // 重複して performSave を呼ばずに pendingSave フラグを立てて終了する
    if (isSaving) {
        pendingSave = true;
        return;
    }

    await performSave();
}

export async function initFS() {
    const saved = await loadFS();
    if (!saved) return;

    // 初期化中は保存処理を完全にブロックする
    isSaving = true;
    try {
        // ここで deepSync を実行
        // ※内部の set トラップ内で isSaving を見て保存をスキップするようにする
        deepSync(FS, saved, FACTORY_FS);
        if (DEBUG_FS) console.log("[FS] System synchronized successfully.");
    } catch (e) {
        console.error("[FS] Restore failed", e);
    } finally {
        isSaving = false;
        // 初期化が終わったら念のため一度だけ強制保存し、整合性を確定させる
        await performSave();
    }
}

/**
 * 【追加】システム診断 & ゴミデータクリーンアップエンジン
 * @param {boolean} executeRepair - 実際に削除・修復処理を行うフラグ
 */
export async function diagnoseAndCleanFS(executeRepair = false) {
    const report = {
        garbageItems: 0,
        garbageNames: [], // ★ 追加: 具体的な不要ファイル名のリスト
        corruptionDetected: false,
        logs: []
    };

    // 1. ゴミ箱 (Trash) のスキャン・クリーンアップ
    if (FS.Trash) {
        const trashKeys = Object.keys(FS.Trash).filter(key => !PROTECTED_KEYS.has(key));
        report.garbageItems += trashKeys.length;
        report.garbageNames = trashKeys; // ★ 追加: 検出したファイル名を格納

        if (executeRepair && trashKeys.length > 0) {
            trashKeys.forEach(key => {
                // system属性を無視して強制安全削除
                delete FS.Trash[key];
            });
            report.logs.push(`ゴミ箱から ${trashKeys.length} 個の項目を完全に削除しました。`);
        } else if (trashKeys.length > 0) {
            report.logs.push(`ゴミ箱の中に ${trashKeys.length} 個のファイルが残っています。`);
        }
    }

    // 2. システムコアディレクトリのデータ破損チェック (Integrity Check)
    const vitalNodes = ["System", "Desktop", "Programs"];
    vitalNodes.forEach(node => {
        if (!FS[node] || FS[node].type !== "folder") {
            report.corruptionDetected = true;
            report.logs.push(`【警告】システム構造破損: '${node}' ディレクトリが不正、または消失しています。`);

            // 修復実行フラグがある場合は FACTORY_FS から復元
            if (executeRepair) {
                FS[node] = structuredClone(FACTORY_FS[node]); // ★ baseFS から FACTORY_FS に変更
                report.logs.push(`[修復] '${node}' ディレクトリを工場出荷時の状態に再生成しました。`);
            }
        }
    });

    // 修復が行われた場合は即時保存して状態を確定
    if (executeRepair) {
        await forceSave();
        window.dispatchEvent(new Event("fs-updated"));
    }

    return report;
}