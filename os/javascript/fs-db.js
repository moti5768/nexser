// fs-db.js
import { openDB } from "./db.js";
import { resolveFS } from "./fs-utils.js";

const STORE_KV = "kv";
const STORE_FILES = "files"; // データ本体保存用
const FS_KEY = "fs";

const LARGE_FILE_THRESHOLD = 100 * 1024;
// ★追加: 保存上限 (100GB)
const MAX_STORAGE_LIMIT = 100 * 1024 * 1024 * 1024;

let saveChain = Promise.resolve();

/* =========================
   Low level API
========================= */

// --- 【追加】削除用の低レベルAPI ---
export async function dbDelete(key, storeName = STORE_KV) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const req = store.delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// --- 【追加】全キー取得用API（クリーンアップで使用） ---
async function dbGetAllKeys(storeName = STORE_FILES) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const req = store.getAllKeys();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function dbSet(key, value, storeName = STORE_KV) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        try {
            store.put(value, key);
        } catch (e) {
            reject(new Error(`Storage failed in ${storeName}: ${e.message}`));
            return;
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function dbGet(key, storeName = STORE_KV) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

/* =========================
   FS API 内部ユーティリティ
========================= */

function extractAndStrip(obj, path = "", largeFiles = new Map()) {
    if (!obj || typeof obj !== "object") return obj;
    const copy = Array.isArray(obj) ? [] : {};

    for (const key of Object.keys(obj)) {
        const value = obj[key];
        const currentPath = path ? `${path}/${key}` : key;

        if (key === "content" && typeof value === "string" && value.length > LARGE_FILE_THRESHOLD) {
            largeFiles.set(path, value); // path は親のパス
            copy[key] = "__EXTERNAL_DATA__";
            copy["size"] = value.length;
        } else if (typeof value === "object" && value !== null) {
            copy[key] = extractAndStrip(value, currentPath, largeFiles);
        } else {
            copy[key] = value;
        }
    }
    return copy;
}

/* =========================
   FS API (Public)
========================= */

export async function getFileContent(path) {
    return await dbGet(path, STORE_FILES);
}

/**
 * FSをIndexedDBに保存する (クリーンアップ対応版)
 */
/**
 * 堅牢性を高めた一括保存処理
 */
export async function saveFS(fs) {
    saveChain = saveChain.then(async () => {
        if (navigator.storage && navigator.storage.estimate) {
            const { usage } = await navigator.storage.estimate();
            if (usage >= MAX_STORAGE_LIMIT) {
                console.error(`[FS-DB] Save aborted: Storage limit reached (${(usage / 1024 / 1024 / 1024).toFixed(2)}GB / 100GB)`);
                import("./window.js").then(m => {
                    m.alertWindow(`ディスク領域不足: 100GB の制限に達したため、変更を保存できませんでした。不要なファイルを削除してください。`, { title: "システム エラー" });
                }).catch(() => {
                    // 万が一 window.js がロードできない場合
                    alert("ディスク領域不足: 100GB の制限に達しました。");
                });
                return; // 保存処理を行わずに終了
            }
        }
        const db = await openDB();
        const tx = db.transaction([STORE_FILES, STORE_KV], "readwrite");
        const fileStore = tx.objectStore(STORE_FILES);
        const kvStore = tx.objectStore(STORE_KV);

        try {
            const largeFiles = new Map();
            const cleanFS = extractAndStrip(fs, "", largeFiles);

            if (!cleanFS?.System) throw new Error("FS corruption detected.");

            // 1. 今回取得した新しい大容量データを保存
            for (const [path, data] of largeFiles) {
                fileStore.put(data, path);
            }

            // 2. 不要データの削除（ここを改善）
            const allSavedPaths = await new Promise((res) => {
                const req = fileStore.getAllKeys();
                req.onsuccess = () => res(req.result);
            });

            for (const savedPath of allSavedPaths) {
                // 今回の保存リストになく、かつ「FS構造」からも消えている場合のみ削除
                const node = resolveFS(savedPath);

                // node が存在しない = ユーザーが明示的に削除した
                // node.content が "__EXTERNAL_DATA__" でもない = 構造から完全に消えた
                if (!largeFiles.has(savedPath) && !node) {
                    fileStore.delete(savedPath);
                    console.log(`[FS-DB] GC: Deleted orphaned file data at ${savedPath}`);
                }
            }

            // 3. 構造の保存
            kvStore.put(cleanFS, FS_KEY);

            await new Promise((res, rej) => {
                tx.oncomplete = res;
                tx.onerror = () => rej(tx.error);
            });
            console.log("[FS-DB] Atomic save completed.");
        } catch (err) {
            tx.abort();
            console.error("[FS-DB] Save failed:", err);
        }
    });
    return saveChain;
}

export async function loadFS() {
    try {
        const data = await dbGet(FS_KEY, STORE_KV);
        return data || null;
    } catch (err) {
        console.error("[FS-DB] Load failed:", err);
        return null;
    }
}