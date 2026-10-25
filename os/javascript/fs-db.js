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

function extractAndStrip(obj, path = "", largeFiles = new Map(), visited = new WeakSet()) {
    if (!obj || typeof obj !== "object") return obj;

    // 【安全性向上】循環参照を検知して無限ループ（スタックオーバーフロー）を防止
    if (visited.has(obj)) {
        console.warn(`[FS-DB] Circular reference ignored at ${path}`);
        return null;
    }
    visited.add(obj);

    if (obj instanceof Blob || obj instanceof ArrayBuffer || ArrayBuffer.isView(obj)) {
        return obj;
    }

    const isArr = Array.isArray(obj);
    const copy = isArr ? [] : {};
    const keys = Object.keys(obj);

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];

        // ⭐ 【パフォーマンス向上】ファクトリー出荷時のシステムアプリなど、
        // ユーザーが書き換えない不変領域は深い走査や二重クローンを避ける
        if (key === "system" && obj.system === true && path.startsWith("Programs/Applications")) {
            copy[key] = true;
            continue;
        }

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
            copy[key] = extractAndStrip(value, nextPath, largeFiles, visited);
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

    if (typeof meta === "object" && meta.__IS_CHUNKED__) {
        const chunkPromises = [];
        for (let i = 0; i < meta.totalChunks; i++) {
            chunkPromises.push(dbGet(`${path}/__chunk_${i}`, STORE_FILES));
        }
        const chunks = await Promise.all(chunkPromises);

        if (meta.dataType === "string") {
            return chunks.join("");
        }
        return new Blob(chunks, { type: meta.mimeType || "" });
    }

    return meta;
}

/**
 * ファイル実データを別のパスにコピーする
 */
export async function copyFileContent(oldPath, newPath) {
    const meta = await dbGet(oldPath, STORE_FILES);
    if (!meta) return;

    if (typeof meta === "object" && meta.__IS_CHUNKED__) {
        const chunkPromises = [];
        for (let i = 0; i < meta.totalChunks; i++) {
            chunkPromises.push(dbGet(`${oldPath}/__chunk_${i}`, STORE_FILES));
        }
        const chunks = await Promise.all(chunkPromises);

        await withStore(STORE_FILES, "readwrite", store => {
            store.put(meta, newPath);
            chunks.forEach((chunk, i) => {
                if (chunk !== undefined) {
                    store.put(chunk, `${newPath}/__chunk_${i}`);
                }
            });
        });
    } else {
        await withStore(STORE_FILES, "readwrite", store => {
            store.put(meta, newPath);
        });
    }
}

/**
 * ファイル実データを安全に別のパスに移動（リネーム）する
 */
export async function moveFileContent(oldPath, newPath) {
    if (oldPath === newPath) return;

    const db = await openDB();

    try {
        await copyFileContent(oldPath, newPath);
    } catch (err) {
        throw new Error(`Move failed during copy phase: ${err.message}`);
    }

    try {
        const verifyMeta = await db.transaction(STORE_FILES, "readonly").objectStore(STORE_FILES).get(newPath);
        if (verifyMeta !== undefined) {
            await deleteFileContentRecursive(oldPath);
        } else {
            throw new Error("Copy verification failed. Aborting source deletion.");
        }
    } catch (err) {
        console.error("[FS-DB] Safe move failed, attempting rollback of new path:", err);
        try {
            await deleteFileContentRecursive(newPath);
        } catch (rollbackErr) {
            console.error("[FS-DB] Rollback cleanup failed:", rollbackErr);
        }
        throw err;
    }
}

/**
 * 指定パスおよび関連するチャンクデータを完全に削除する
 */
export async function deleteFileContentRecursive(path) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_FILES], "readwrite");
        const store = tx.objectStore(STORE_FILES);

        store.delete(path);

        const range = IDBKeyRange.bound(`${path}/__chunk_0`, `${path}/__chunk_\uffff`, false, false);
        const req = store.openCursor(range);

        req.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
                if (typeof cursor.primaryKey === "string" && cursor.primaryKey.startsWith(`${path}/__chunk_`)) {
                    store.delete(cursor.primaryKey);
                }
                cursor.continue();
            }
        };

        req.onerror = (e) => {
            console.error(`[FS-DB] Cursor error during chunk deletion for ${path}:`, e.target.error);
        };

        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e?.target?.error || tx.error || new Error("Transaction error during file deletion"));
        tx.onabort = (e) => reject(e?.target?.error || tx.error || new Error("Transaction aborted during file deletion"));
    });
}

function collectValidFilePaths(obj, path = "", validPaths = new Set()) {
    if (!obj || typeof obj !== "object") return validPaths;
    for (const key of Object.keys(obj)) {
        if (key === "type" || key === "system" || key === "originalPath" || key === "lastModified" || key === "hidden" || key === "target") continue;
        const child = obj[key];
        const currentPath = path ? `${path}/${key}` : key;
        if (child && typeof child === "object") {
            if (child.type === "file" || child.type === "app") {
                validPaths.add(currentPath);
            } else if (child.type === "folder") {
                collectValidFilePaths(child, currentPath, validPaths);
            }
        }
    }
    return validPaths;
}

/**
 * 【NTFS風改善】ジャーナリング（WAL）を統合した安全なアトミック保存処理
 */
export async function saveFS(fs) {
    saveChain = saveChain.then(async () => {
        // 容量制限のチェック
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

        // 1. 【ジャーナリング】書き込み開始のログ（DIRTY）を記録
        try {
            await dbSet("fs_journal", { status: "DIRTY", timestamp: Date.now() }, STORE_KV);
        } catch (e) {
            console.warn("[FS-DB] Failed to write journal log:", e);
        }

        const tx = db.transaction([STORE_FILES, STORE_KV], "readwrite");
        const fileStore = tx.objectStore(STORE_FILES);
        const kvStore = tx.objectStore(STORE_KV);

        return new Promise((resolve, reject) => {
            tx.oncomplete = async () => {
                // 2. 【ジャーナリング】書き込み成功時にジャーナルをクリア（COMMIT完了）
                try {
                    await dbDelete("fs_journal", STORE_KV);
                } catch (e) { }

                console.log("[FS-DB] Split-key atomic save and Journal committed successfully.");
                resolve();
            };
            tx.onerror = (event) => reject(tx.error || event?.target?.error || new Error("Save transaction error"));
            tx.onabort = (event) => reject(tx.error || event?.target?.error || new Error("Save transaction aborted"));

            try {
                const largeFiles = new Map();
                const cleanFS = extractAndStrip(fs, "", largeFiles);

                if (!cleanFS?.System) throw new Error("FS corruption detected.");

                const validFilePaths = collectValidFilePaths(cleanFS);

                const cursorReq = fileStore.openCursor();
                cursorReq.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor) {
                        const key = cursor.primaryKey;
                        let basePath = key;
                        const chunkIndex = key.indexOf("/__chunk_");
                        if (chunkIndex !== -1) {
                            basePath = key.substring(0, chunkIndex);
                        }

                        if (!validFilePaths.has(basePath)) {
                            fileStore.delete(key);
                        }
                        cursor.continue();
                    }
                };

                largeFiles.forEach((data, path) => {
                    if (data === "__EXTERNAL_DATA__") {
                        return;
                    }

                    const isBlob = data instanceof Blob;
                    const isString = typeof data === "string";
                    const dataSize = isBlob ? data.size : (isString ? data.length : 0);

                    if (dataSize > CHUNK_SIZE) {
                        const totalChunks = Math.ceil(dataSize / CHUNK_SIZE);
                        for (let i = 0; i < totalChunks; i++) {
                            const start = i * CHUNK_SIZE;
                            const end = Math.min(start + CHUNK_SIZE, dataSize);
                            const chunk = isBlob ? data.slice(start, end) : data.slice(start, end);
                            fileStore.put(chunk, `${path}/__chunk_${i}`);
                        }

                        fileStore.put({
                            __IS_CHUNKED__: true,
                            totalChunks,
                            dataType: isString ? "string" : "blob",
                            mimeType: isBlob ? data.type : ""
                        }, path);
                    } else {
                        fileStore.put(data, path);
                    }
                });

                for (const topKey of Object.keys(cleanFS)) {
                    kvStore.put(cleanFS[topKey], `fs_${topKey}`);
                }

            } catch (err) {
                try { tx.abort(); } catch (_) { }
                reject(err || new Error("Unknown error during FS save"));
            }
        });
    }).catch(async err => {
        const errorMsg = err?.message || String(err) || "Critical save error";
        console.error("[FS-DB] Save chain failed critically (Journal state: DIRTY):", errorMsg);

        if (
            errorMsg.includes("Storage failed") ||
            errorMsg.includes("NotFoundError") ||
            errorMsg.includes("not found") ||
            errorMsg.includes("aborted") ||
            errorMsg.includes("Versionchange")
        ) {
            try {
                const { showBSOD } = await import("./bsod.js");
                showBSOD("UNMOUNTABLE_BOOT_VOLUME", new Error("Runtime boot volume storage has been deleted or corrupted."));
            } catch (bsodErr) {
                console.error("Failed to trigger BSOD:", bsodErr);
            }
        }
    });

    return saveChain;
}

export async function loadFS() {
    try {
        // 起動時に前回のジャーナル（fs_journal）が残っていないかチェック
        const journal = await dbGet("fs_journal", STORE_KV);
        if (journal) {
            console.warn("[FS-DB] Warning: Uncommitted journal detected from previous session. Crash recovery initiated.");
        }

        const legacyData = await dbGet("fs", STORE_KV);
        if (legacyData) {
            return legacyData;
        }

        const db = await openDB();
        const keys = await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_KV, "readonly");
            const store = tx.objectStore(STORE_KV);
            const req = store.getAllKeys();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });

        const loadedFS = {};
        let hasData = false;

        for (const key of keys) {
            if (typeof key === "string" && key.startsWith("fs_") && key !== "fs_journal") {
                const topKey = key.substring(3);
                const subData = await dbGet(key, STORE_KV);
                if (subData) {
                    loadedFS[topKey] = subData;
                    hasData = true;
                }
            }
        }

        return hasData ? loadedFS : null;
    } catch (err) {
        console.error("[FS-DB] Load failed:", err?.message || err);
        return null;
    }
}