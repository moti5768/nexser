// fs-db.js
import { openDB } from "./db.js";

const STORE_KV = "kv";
const STORE_FILES = "files";
const FS_KEY = "fs";

const LARGE_FILE_THRESHOLD = 100 * 1024; // 100KB以上を外部保存
const CHUNK_SIZE = 10 * 1024 * 1024;     // 10MBごとに分割

let saveChain = Promise.resolve();

/* =========================
   Low level API
========================= */

async function withStore(storeName, mode, callback) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        let requestResult;

        try {
            const req = callback(store);
            if (req && typeof req.onsuccess !== 'undefined') {
                req.onsuccess = () => requestResult = req.result;
            }
        } catch (e) {
            const msg = e?.message || String(e) || "Unknown error";
            reject(new Error(`Storage failed in ${storeName}: ${msg}`));
            return;
        }

        tx.oncomplete = () => resolve(requestResult);
        tx.onerror = (event) => reject(tx.error || event?.target?.error || new Error(`Transaction error in ${storeName}`));
        tx.onabort = (event) => reject(tx.error || event?.target?.error || new Error(`Transaction aborted in ${storeName}`));
    });
}

export async function dbDelete(key, storeName = STORE_KV) {
    return withStore(storeName, "readwrite", store => store.delete(key));
}

export async function dbSet(key, value, storeName = STORE_KV) {
    return withStore(storeName, "readwrite", store => store.put(value, key));
}

export async function dbGet(key, storeName = STORE_KV) {
    return withStore(storeName, "readonly", store => store.get(key));
}

/* =========================
   FS API 内部ユーティリティ
========================= */

function extractAndStrip(obj, path = "", largeFiles = new Map()) {
    if (!obj || typeof obj !== "object") return obj;

    if (obj instanceof Blob || obj instanceof ArrayBuffer || ArrayBuffer.isView(obj)) {
        return obj;
    }

    const isArr = Array.isArray(obj);
    const copy = isArr ? [] : {};
    const keys = Object.keys(obj);

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const value = obj[key];

        const isBlobOrBuffer = value instanceof Blob || value instanceof ArrayBuffer || ArrayBuffer.isView(value);
        const isLargeString = typeof value === "string" && value.length > LARGE_FILE_THRESHOLD;

        if (key === "content" && (isBlobOrBuffer || isLargeString)) {
            if (value !== "__EXTERNAL_DATA__") {
                largeFiles.set(path, value);
                copy[key] = "__EXTERNAL_DATA__";
                copy["size"] = isBlobOrBuffer ? (value.size || value.byteLength || 0) : value.length;
                continue;
            }
        }

        if (value !== null && typeof value === "object" && !isBlobOrBuffer) {
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

// 分割（チャンク）されたデータを復元して読み込む
export async function getFileContent(path) {
    const meta = await dbGet(path, STORE_FILES);
    if (!meta) return null;

    // チャンク化されている場合は全チャンクを取得して復元
    if (typeof meta === "object" && meta.__IS_CHUNKED__) {
        const chunkPromises = [];
        for (let i = 0; i < meta.totalChunks; i++) {
            chunkPromises.push(dbGet(`${path}__chunk_${i}`, STORE_FILES));
        }
        const chunks = await Promise.all(chunkPromises);

        if (meta.dataType === "string") {
            return chunks.join("");
        }
        return new Blob(chunks, { type: meta.mimeType || "" });
    }

    return meta;
}

export async function saveFS(fs) {
    saveChain = saveChain.then(async () => {
        if (navigator.storage && navigator.storage.estimate) {
            const { usage, quota } = await navigator.storage.estimate();
            if (usage >= quota * 0.95) {
                const quotaGB = (quota / 1024 / 1024 / 1024).toFixed(2);
                console.error(`[FS-DB] Save aborted: Storage limit reached (${(usage / 1024 / 1024 / 1024).toFixed(2)}GB / ${quotaGB}GB)`);

                import("./window.js").then(m => {
                    m.alertWindow?.(`ディスク領域不足: ブラウザの制限 (${quotaGB}GB) に達したため、保存できません。`, { title: "システム エラー" });
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

        return new Promise((resolve, reject) => {
            tx.oncomplete = () => {
                console.log("[FS-DB] Chunked atomic save completed.");
                resolve();
            };
            tx.onerror = (event) => reject(tx.error || event?.target?.error || new Error("Save transaction error"));
            tx.onabort = (event) => reject(tx.error || event?.target?.error || new Error("Save transaction aborted"));

            try {
                const largeFiles = new Map();
                const cleanFS = extractAndStrip(fs, "", largeFiles);

                if (!cleanFS?.System) throw new Error("FS corruption detected.");

                const activePaths = new Set();
                function collectActivePaths(node, currentPath = "") {
                    if (!node || typeof node !== "object") return;
                    for (const key in node) {
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

                // ① 大容量データの分割（チャンク）書き込み
                largeFiles.forEach((data, path) => {
                    const isBlob = data instanceof Blob;
                    const isString = typeof data === "string";
                    const dataSize = isBlob ? data.size : (isString ? data.length : 0);

                    if (dataSize > CHUNK_SIZE) {
                        const totalChunks = Math.ceil(dataSize / CHUNK_SIZE);
                        for (let i = 0; i < totalChunks; i++) {
                            const start = i * CHUNK_SIZE;
                            const end = Math.min(start + CHUNK_SIZE, dataSize);
                            const chunk = isBlob ? data.slice(start, end) : data.slice(start, end);
                            fileStore.put(chunk, `${path}__chunk_${i}`);
                        }

                        // メタデータを元のキーに保存
                        fileStore.put({
                            __IS_CHUNKED__: true,
                            totalChunks,
                            dataType: isString ? "string" : "blob",
                            mimeType: isBlob ? data.type : ""
                        }, path);
                    } else {
                        // 10MB以下の場合はそのまま保存
                        fileStore.put(data, path);
                    }
                });

                // ② システムツリーの書き込み
                kvStore.put(cleanFS, FS_KEY);

                // ③ GC処理（孤立ファイル・孤立チャンクの削除）
                const keysReq = fileStore.getAllKeys();
                keysReq.onsuccess = () => {
                    const allSavedPaths = keysReq.result || [];
                    for (let i = 0; i < allSavedPaths.length; i++) {
                        const savedPath = allSavedPaths[i];
                        const basePath = savedPath.includes("__chunk_") ? savedPath.split("__chunk_")[0] : savedPath;

                        if (largeFiles.has(basePath) || activePaths.has(basePath)) continue;

                        fileStore.delete(savedPath);
                        console.log(`[FS-DB] GC: Deleted orphaned file or chunk at ${savedPath}`);
                    }
                };
            } catch (err) {
                try { tx.abort(); } catch (_) { }
                reject(err || new Error("Unknown error during FS save"));
            }
        });
    }).catch(err => {
        const errorMsg = err?.message || String(err) || "Critical save error";
        console.error("[FS-DB] Save chain failed critically:", errorMsg);
        throw (err instanceof Error ? err : new Error(errorMsg));
    });

    return saveChain;
}

export async function loadFS() {
    try {
        const data = await dbGet(FS_KEY, STORE_KV);
        return data || null;
    } catch (err) {
        console.error("[FS-DB] Load failed:", err?.message || err);
        return null;
    }
}