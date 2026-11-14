// fs-db.js
import { openDB } from "./db.js";

const STORE_KV = "kv";
const STORE_FILES = "files";
const NODE_PREFIX = "fs_node:";

export const LARGE_FILE_THRESHOLD = 100 * 1024; // 100KB以上を外部保存
const CHUNK_SIZE = 10 * 1024 * 1024;            // 10MBごとに分割

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
            if (req && typeof req.onsuccess !== "undefined") {
                req.onsuccess = () => {
                    requestResult = req.result;
                };
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
   階層ノード分割・シリアライズユーティリティ
========================= */

function resolveNodeByPath(rootFS, path) {
    const parts = path.split("/").filter(Boolean);
    let cur = rootFS;
    for (const part of parts) {
        if (!cur || typeof cur !== "object") return null;
        cur = cur[part];
    }
    return cur || null;
}

function isChildNodeObject(val) {
    return (
        val !== null &&
        typeof val === "object" &&
        !(val instanceof Blob) &&
        !(val instanceof ArrayBuffer) &&
        !ArrayBuffer.isView(val) &&
        typeof val.type === "string"
    );
}

/**
 * 1つの階層ノードを { meta, children } 形式へ変換
 * 100KB超またはBlob/Bufferの content は抽出し、メモリ上も "__EXTERNAL_DATA__" に置換して解放する
 */
function serializeSingleNode(node, path, largeFiles) {
    const meta = {};
    const children = [];

    for (const key of Object.keys(node)) {
        const val = node[key];

        if (isChildNodeObject(val)) {
            children.push(key);
        } else if (key === "content") {
            const isBlobOrBuffer =
                val instanceof Blob ||
                val instanceof ArrayBuffer ||
                ArrayBuffer.isView(val);
            const isLargeString =
                typeof val === "string" && val.length > LARGE_FILE_THRESHOLD;

            if ((isBlobOrBuffer || isLargeString) && val !== "__EXTERNAL_DATA__") {
                const byteSize = isBlobOrBuffer ? (val.size || val.byteLength || 0) : val.length;
                largeFiles.set(path, val);
                meta.content = "__EXTERNAL_DATA__";
                meta.size = byteSize;

                // メモリ上の生データも外部参照マーカーへ置換してメモリ肥大化を防止
                node.content = "__EXTERNAL_DATA__";
                node.size = byteSize;
            } else {
                meta.content = val;
            }
        } else {
            meta[key] = val;
        }
    }

    return { meta, children };
}

/**
 * 指定階層とその配下階層を再帰的に収集（新規フォルダ一括代入にも対応）
 */
function collectSubtreeRecords(node, path, recordsMap, largeFiles, visited = new WeakSet()) {
    if (!node || typeof node !== "object" || visited.has(node)) return;
    visited.add(node);

    const record = serializeSingleNode(node, path, largeFiles);
    recordsMap.set(path, record);

    for (const childName of record.children) {
        const childPath = path ? `${path}/${childName}` : childName;
        collectSubtreeRecords(node[childName], childPath, recordsMap, largeFiles, visited);
    }
}

function writeLargeFilesToStore(fileStore, largeFiles) {
    largeFiles.forEach((data, path) => {
        if (data === "__EXTERNAL_DATA__") return;

        const isBlob = data instanceof Blob;
        const isString = typeof data === "string";
        const dataSize = isBlob ? data.size : (isString ? data.length : (data.byteLength || 0));

        if (dataSize > CHUNK_SIZE) {
            const totalChunks = Math.ceil(dataSize / CHUNK_SIZE);
            for (let i = 0; i < totalChunks; i++) {
                const start = i * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, dataSize);
                const chunk = data.slice(start, end);
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
}

function deletePrefixFromStore(store, prefix, protectedKeys = null) {
    return new Promise((resolve, reject) => {
        if (!protectedKeys || !protectedKeys.has(prefix)) {
            store.delete(prefix);
        }
        const range = IDBKeyRange.bound(`${prefix}/`, `${prefix}/\uffff`, false, false);
        const req = store.openCursor(range);
        req.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
                const key = cursor.primaryKey;
                if (!protectedKeys || !protectedKeys.has(key)) {
                    store.delete(key);
                }
                cursor.continue();
            } else {
                resolve();
            }
        };
        req.onerror = () => reject(req.error || new Error(`Cursor delete failed for prefix: ${prefix}`));
    });
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
    if (oldPath === newPath) return;
    const meta = await dbGet(oldPath, STORE_FILES);
    if (!meta) return;

    if (typeof meta === "object" && meta.__IS_CHUNKED__) {
        const chunkPromises = [];
        for (let i = 0; i < meta.totalChunks; i++) {
            chunkPromises.push(dbGet(`${oldPath}/__chunk_${i}`, STORE_FILES));
        }
        const chunks = await Promise.all(chunkPromises);

        if (chunks.some(chunk => chunk === undefined || chunk === null)) {
            throw new Error(`Chunk data corrupted or missing while copying: ${oldPath}`);
        }

        await withStore(STORE_FILES, "readwrite", store => {
            store.put(meta, newPath);
            chunks.forEach((chunk, i) => {
                store.put(chunk, `${newPath}/__chunk_${i}`);
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

        deletePrefixFromStore(store, path);

        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e?.target?.error || tx.error || new Error("Transaction error during file deletion"));
        tx.onabort = (e) => reject(e?.target?.error || tx.error || new Error("Transaction aborted during file deletion"));
    });
}

/**
 * 【ピンポイント差分保存】変更・削除された階層レコードだけをアトミックにコミット
 */
export async function saveNodeDiff(rootFS, dirtyPaths = [], deletedPaths = [], metaOnlyPaths = []) {
    saveChain = saveChain.then(async () => {
        if (dirtyPaths.length === 0 && deletedPaths.length === 0 && metaOnlyPaths.length === 0) return;

        if (navigator.storage && navigator.storage.estimate) {
            const { usage, quota } = await navigator.storage.estimate();
            if (usage >= quota * 0.95) {
                const quotaGB = (quota / 1024 / 1024 / 1024).toFixed(2);
                console.error(`[FS-DB] Save aborted: Storage limit reached (${(usage / 1024 / 1024 / 1024).toFixed(2)}GB / ${quotaGB}GB)`);
                if (typeof nexser !== "undefined" && nexser.windowAPI?.alertWindow) {
                    nexser.windowAPI.alertWindow(`ディスク領域不足: ブラウザの制限 (${quotaGB}GB) に達したため、保存できません。`, { title: "システム エラー" });
                }
                return;
            }
        }

        const db = await openDB();

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
                try {
                    await dbDelete("fs_journal", STORE_KV);
                } catch (_) { }
                resolve();
            };
            tx.onerror = (event) => reject(tx.error || event?.target?.error || new Error("Diff save transaction error"));
            tx.onabort = (event) => reject(tx.error || event?.target?.error || new Error("Diff save transaction aborted"));

            (async () => {
                try {
                    // 1. 先に更新対象レコードを収集し、保護すべきキー集合を確定する
                    const recordsMap = new Map();
                    const largeFiles = new Map();

                    for (const dPath of dirtyPaths) {
                        const targetNode = resolveNodeByPath(rootFS, dPath);
                        if (!targetNode) continue;
                        collectSubtreeRecords(targetNode, dPath, recordsMap, largeFiles);
                    }

                    // 並び替えなど親フォルダ自身のメタデータ・children順序のみの変更は単一レコードだけ収集
                    for (const mPath of metaOnlyPaths) {
                        if (recordsMap.has(mPath)) continue;
                        const targetNode = resolveNodeByPath(rootFS, mPath);
                        if (!targetNode) continue;
                        const record = serializeSingleNode(targetNode, mPath, largeFiles);
                        recordsMap.set(mPath, record);
                    }

                    const protectedKvKeys = new Set(
                        Array.from(recordsMap.keys()).map(p => `${NODE_PREFIX}${p}`)
                    );
                    // 新規に書き込む大容量ファイルに加え、既に外部保存済み（"__EXTERNAL_DATA__"）のパスも保護対象に含める
                    const protectedFileKeys = new Set(largeFiles.keys());
                    recordsMap.forEach((record, nodePath) => {
                        if (record.meta && record.meta.content === "__EXTERNAL_DATA__") {
                            protectedFileKeys.add(nodePath);
                        }
                    });

                    // 2. 削除カーソルをすべて完了させてから書き込みフェーズへ進む（順序逆転防止）
                    if (deletedPaths.length > 0) {
                        const deleteTasks = [];
                        for (const delPath of deletedPaths) {
                            deleteTasks.push(deletePrefixFromStore(kvStore, `${NODE_PREFIX}${delPath}`, protectedKvKeys));
                            deleteTasks.push(deletePrefixFromStore(fileStore, delPath, protectedFileKeys));
                        }
                        await Promise.all(deleteTasks);
                    }

                    // 3. 変更された階層レコードと大容量データをピンポイント書き込み
                    writeLargeFilesToStore(fileStore, largeFiles);

                    const cleanupTasks = [];
                    recordsMap.forEach((record, nodePath) => {
                        kvStore.put(record, `${NODE_PREFIX}${nodePath}`);

                        // 100KB以下に縮小されたファイルがあれば旧外部ストアデータを掃除
                        if (record.meta.type === "file" && record.meta.content !== "__EXTERNAL_DATA__") {
                            cleanupTasks.push(deletePrefixFromStore(fileStore, nodePath));
                        }
                    });
                    if (cleanupTasks.length > 0) {
                        await Promise.all(cleanupTasks);
                    }
                } catch (err) {
                    try { tx.abort(); } catch (_) { }
                    reject(err || new Error("Unknown error during diff save"));
                }
            })();
        });
    }).catch(async err => {
        await handleCriticalSaveError(err);
        throw err;
    });

    return saveChain;
}

/**
 * 【全体同期保存】初回起動・システム修復・旧形式からのマイグレーション用
 */
export async function saveFS(fs) {
    saveChain = saveChain.then(async () => {
        if (navigator.storage && navigator.storage.estimate) {
            const { usage, quota } = await navigator.storage.estimate();
            if (usage >= quota * 0.95) {
                const quotaGB = (quota / 1024 / 1024 / 1024).toFixed(2);
                console.error(`[FS-DB] Save aborted: Storage limit reached (${(usage / 1024 / 1024 / 1024).toFixed(2)}GB / ${quotaGB}GB)`);
                if (typeof nexser !== "undefined" && nexser.windowAPI?.alertWindow) {
                    nexser.windowAPI.alertWindow(`ディスク領域不足: ブラウザの制限 (${quotaGB}GB) に達したため、保存できません。`, { title: "システム エラー" });
                }
                return;
            }
        }

        const db = await openDB();

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
                try {
                    await dbDelete("fs_journal", STORE_KV);
                } catch (_) { }
                console.log("[FS-DB] Hierarchical full sync and Journal committed successfully.");
                resolve();
            };
            tx.onerror = (event) => reject(tx.error || event?.target?.error || new Error("Save transaction error"));
            tx.onabort = (event) => reject(tx.error || event?.target?.error || new Error("Save transaction aborted"));

            try {
                if (!fs?.["C:"]?.System) throw new Error("FS corruption detected.");

                const recordsMap = new Map();
                const largeFiles = new Map();

                for (const topKey of Object.keys(fs)) {
                    collectSubtreeRecords(fs[topKey], topKey, recordsMap, largeFiles);
                }

                // 不要な旧階層レコード（fs_node:）を掃除
                const kvCursor = kvStore.openCursor(IDBKeyRange.bound(NODE_PREFIX, `${NODE_PREFIX}\uffff`));
                kvCursor.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor) {
                        const nodePath = cursor.primaryKey.slice(NODE_PREFIX.length);
                        if (!recordsMap.has(nodePath)) {
                            kvStore.delete(cursor.primaryKey);
                        }
                        cursor.continue();
                    }
                };

                // 不要な外部ファイル・チャンクを掃除
                const fileCursor = fileStore.openCursor();
                fileCursor.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor) {
                        const key = cursor.primaryKey;
                        const chunkIndex = key.indexOf("/__chunk_");
                        const basePath = chunkIndex !== -1 ? key.substring(0, chunkIndex) : key;
                        const rec = recordsMap.get(basePath);

                        if (!rec || rec.meta.content !== "__EXTERNAL_DATA__") {
                            fileStore.delete(key);
                        }
                        cursor.continue();
                    }
                };

                writeLargeFilesToStore(fileStore, largeFiles);

                recordsMap.forEach((record, nodePath) => {
                    kvStore.put(record, `${NODE_PREFIX}${nodePath}`);
                });

                // 旧モノリシック形式のキーが存在すれば削除して移行完了
                kvStore.delete("fs_C:");
                kvStore.delete("fs");
            } catch (err) {
                try { tx.abort(); } catch (_) { }
                reject(err || new Error("Unknown error during FS save"));
            }
        });
    }).catch(async err => {
        await handleCriticalSaveError(err);
        throw err;
    });

    return saveChain;
}

async function handleCriticalSaveError(err) {
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
}

/**
 * 各階層レコード（fs_node:*）からメモリツリーを再構築（旧形式からの自動マイグレーション付き）
 */
export async function loadFS() {
    try {
        const journal = await dbGet("fs_journal", STORE_KV);
        if (journal) {
            console.warn("[FS-DB] Recovery: Uncommitted journal detected from previous session. Performing integrity check.");
            await dbDelete("fs_journal", STORE_KV);
        }

        const db = await openDB();

        // 1. 新形式（各階層ごとの fs_node:* レコード）の読み込み
        const nodeEntries = await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_KV, "readonly");
            const store = tx.objectStore(STORE_KV);
            const entries = [];
            const req = store.openCursor(IDBKeyRange.bound(NODE_PREFIX, `${NODE_PREFIX}\uffff`));
            req.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    entries.push([cursor.primaryKey.slice(NODE_PREFIX.length), cursor.value]);
                    cursor.continue();
                } else {
                    resolve(entries);
                }
            };
            req.onerror = () => reject(req.error);
        });

        if (nodeEntries.length > 0) {
            const nodeMap = new Map(nodeEntries);
            const buildTree = (path) => {
                const rec = nodeMap.get(path);
                if (!rec || !rec.meta) return null;

                const obj = { ...rec.meta };
                if (Array.isArray(rec.children)) {
                    for (const childName of rec.children) {
                        const childPath = `${path}/${childName}`;
                        const childObj = buildTree(childPath);
                        if (childObj) {
                            obj[childName] = childObj;
                        }
                    }
                }
                return obj;
            };

            const rootC = buildTree("C:");
            if (rootC) {
                return { "C:": rootC };
            }
        }

        // 2. フォールバック：旧モノリシック形式（fs / fs_*）が検出された場合は新形式へ安全に移行
        const legacyData = await dbGet("fs", STORE_KV);
        if (legacyData) {
            const normalized = legacyData["C:"] ? legacyData : { "C:": legacyData };
            console.info("[FS-DB] Migrating legacy 'fs' key to per-node hierarchical records...");
            await saveFS(normalized);
            return normalized;
        }

        const keys = await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_KV, "readonly");
            const store = tx.objectStore(STORE_KV);
            const req = store.getAllKeys();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });

        const loadedFS = {};
        let hasLegacySplitData = false;

        for (const key of keys) {
            if (typeof key === "string" && key.startsWith("fs_") && !key.startsWith(NODE_PREFIX) && key !== "fs_journal") {
                const topKey = key.substring(3);
                const subData = await dbGet(key, STORE_KV);
                if (subData) {
                    loadedFS[topKey] = subData;
                    hasLegacySplitData = true;
                }
            }
        }

        if (hasLegacySplitData) {
            if (!loadedFS["C:"] && (loadedFS["System"] || loadedFS["Programs"] || loadedFS["Desktop"])) {
                const cDriveContent = {};
                for (const k of Object.keys(loadedFS)) {
                    if (k === "journal" || k === "fs_journal") continue;
                    cDriveContent[k] = loadedFS[k];
                    delete loadedFS[k];
                }
                loadedFS["C:"] = cDriveContent;
            }
            console.info("[FS-DB] Migrating legacy split-key FS to per-node hierarchical records...");
            await saveFS(loadedFS);
            return loadedFS;
        }

        return null;
    } catch (err) {
        console.error("[FS-DB] Load failed:", err?.message || err);
        return null;
    }
}

/**
 * 単体ファイルの実データ保存（直列キュー統合版）
 */
export async function saveSingleFile(path, data) {
    saveChain = saveChain.then(async () => {
        const db = await openDB();
        const tx = db.transaction([STORE_FILES], "readwrite");
        const fileStore = tx.objectStore(STORE_FILES);

        writeLargeFilesToStore(fileStore, new Map([[path, data]]));

        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e?.target?.error || new Error("Single file save error"));
            tx.onabort = (e) => reject(e?.target?.error || new Error("Single file save aborted"));
        });
    });

    return saveChain;
}

export async function saveFolderNode(topKey, folderData) {
    console.warn(`[FS-DB] saveFolderNode('${topKey}') is deprecated. Redirecting to hierarchical diff save.`);
    return saveNodeDiff({ [topKey]: folderData }, [topKey], []);
}

/**
 * 全DBロード前に AUTOBOOT.CFG の内容だけを高速取得する
 */
export async function fastCheckAutoBoot() {
    try {
        const rec = await dbGet(`${NODE_PREFIX}C:/System/AUTOBOOT.CFG`, STORE_KV);
        if (rec && rec.meta && typeof rec.meta.content === "string") {
            return rec.meta.content;
        }
        return null;
    } catch {
        return null;
    }
}