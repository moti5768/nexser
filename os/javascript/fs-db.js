// fs-db.js
import { openDB } from "./db.js";
// 【改善】resolveFS のインポートは不要になったため削除し、クリーンにしました

const STORE_KV = "kv";
const STORE_FILES = "files"; // データ本体保存用
const FS_KEY = "fs";

const LARGE_FILE_THRESHOLD = 100 * 1024;

let saveChain = Promise.resolve();

/* =========================
   Low level API
========================= */

export async function dbDelete(key, storeName = STORE_KV) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        store.delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

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

    const isArr = Array.isArray(obj);
    const copy = isArr ? [] : {};
    const keys = Object.keys(obj);

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const value = obj[key];

        if (key === "content" && typeof value === "string" && value.length > LARGE_FILE_THRESHOLD) {
            largeFiles.set(path, value);
            copy[key] = "__EXTERNAL_DATA__";
            copy["size"] = value.length;
            continue;
        }

        if (value !== null && typeof value === "object") {
            const nextPath = path ? `${path}/${key}` : key;
            copy[key] = extractAndStrip(value, nextPath, largeFiles);
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

export async function saveFS(fs) {
    saveChain = saveChain.then(async () => {
        if (navigator.storage && navigator.storage.estimate) {
            const { usage, quota } = await navigator.storage.estimate();
            if (usage >= quota * 0.95) {
                const quotaGB = (quota / 1024 / 1024 / 1024).toFixed(2);
                console.error(`[FS-DB] Save aborted: Storage limit reached (${(usage / 1024 / 1024 / 1024).toFixed(2)}GB / ${quotaGB}GB)`);

                import("./window.js").then(m => {
                    m.alertWindow(`ディスク領域不足: ブラウザの制限 (${quotaGB}GB) に達したため、保存できません。`, { title: "システム エラー" });
                }).catch(() => {
                    alert("ディスク領域不足です。");
                });
                return;
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

            const keysReq = fileStore.getAllKeys();

            largeFiles.forEach((data, path) => {
                fileStore.put(data, path);
            });

            const allSavedPaths = await new Promise((res, rej) => {
                keysReq.onsuccess = () => res(keysReq.result || []);
                keysReq.onerror = () => {
                    console.error("Critical: Could not retrieve DB keys during GC.");
                    rej(keysReq.error);
                };
            });

            // 【改善】typeに依存せず、オブジェクトツリーの構造そのものを抽出して堅牢化
            const activePaths = new Set();
            function collectActivePaths(node, currentPath = "") {
                if (!node || typeof node !== "object") return;
                for (const key in node) {
                    // システム用キーや文字列データのキーはパスとみなさない
                    if (key === "type" || key === "system" || key === "content" || key === "size") continue;

                    const child = node[key];
                    if (child !== null && typeof child === "object") {
                        const fullPath = currentPath ? `${currentPath}/${key}` : key;
                        activePaths.add(fullPath);
                        collectActivePaths(child, fullPath);
                    }
                }
            }
            collectActivePaths(fs);

            for (let i = 0; i < allSavedPaths.length; i++) {
                const savedPath = allSavedPaths[i];

                if (largeFiles.has(savedPath)) continue;

                if (!activePaths.has(savedPath)) {
                    fileStore.delete(savedPath);
                    console.log(`[FS-DB] GC: Deleted orphaned file data at ${savedPath}`);
                }
            }

            kvStore.put(cleanFS, FS_KEY);

            await new Promise((res, rej) => {
                tx.oncomplete = res;
                tx.onerror = () => rej(tx.error);
            });
            console.log("[FS-DB] Atomic save completed.");
        } catch (err) {
            tx.abort();
            console.error("[FS-DB] Save failed:", err);
            throw err;
        }
    }).catch(err => {
        console.warn("[FS-DB] Save chain recovered from an error. Next save is permitted.", err);
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