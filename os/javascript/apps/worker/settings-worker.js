// settings-worker.js
import { openDB } from "../../db.js";

const encoder = new TextEncoder();
const NODE_PREFIX = "fs_node:";

function calculateItemSize(storeName, item) {
    if (!item) return 0;
    if (storeName === "files") {
        if (item instanceof Blob) return item.size;
        if (item instanceof ArrayBuffer) return item.byteLength;
        if (typeof item === "string") return encoder.encode(item).length;
        // 分割チャンクのヘッダメタデータ（実データは __chunk_* 側で加算）
        if (typeof item === "object" && item.__IS_CHUNKED__) {
            try {
                return encoder.encode(JSON.stringify(item)).length;
            } catch {
                return 0;
            }
        }
        return 0;
    }
    try {
        const jsonString = JSON.stringify(item);
        return jsonString ? encoder.encode(jsonString).length : 0;
    } catch {
        return 0;
    }
}

self.onmessage = async (e) => {
    if (e.data.type === "GET_STORE_SIZES") {
        try {
            self.postMessage({
                type: "PROGRESS",
                percent: 2,
                detail: "IndexedDB データベースへ接続中..."
            });

            const db = await openDB();
            const storeNames = Array.from(db.objectStoreNames);

            // 1. 全ストアの総レコード数を事前カウントして正確な進捗率を算出
            const countTx = db.transaction(storeNames, "readonly");
            const counts = await Promise.all(
                storeNames.map(name => new Promise((resolve) => {
                    const req = countTx.objectStore(name).count();
                    req.onsuccess = () => resolve(req.result || 0);
                    req.onerror = () => resolve(0);
                }))
            );
            const totalRecords = counts.reduce((sum, c) => sum + c, 0);
            let processedRecords = 0;

            self.postMessage({
                type: "PROGRESS",
                percent: 8,
                detail: `全 ${storeNames.length} ストア（計 ${totalRecords} 件）のスキャンを開始...`
            });

            const breakdown = {
                kvNodes: 0,
                kvNodeBytes: 0,
                kvSystemBytes: 0,
                externalFileCount: 0,
                chunkCount: 0
            };

            const sizes = {};
            const notifyStep = Math.max(15, Math.floor(totalRecords / 25));

            // 2. 各ストアを順次走査し、新DB形式（fs_node:* / __IS_CHUNKED__）を解析しながら進捗通知
            for (let sIdx = 0; sIdx < storeNames.length; sIdx++) {
                const storeName = storeNames[sIdx];
                let bytes = 0;

                const tx = db.transaction(storeName, "readonly");
                const store = tx.objectStore(storeName);

                await new Promise((resolve, reject) => {
                    const request = store.openCursor();
                    request.onsuccess = (event) => {
                        const cursor = event.target.result;
                        if (cursor) {
                            const key = cursor.primaryKey;
                            const val = cursor.value;
                            const itemBytes = calculateItemSize(storeName, val);
                            bytes += itemBytes;

                            // 新DB形式のメタ内訳カウント
                            if (storeName === "kv" && typeof key === "string") {
                                if (key.startsWith(NODE_PREFIX)) {
                                    breakdown.kvNodes++;
                                    breakdown.kvNodeBytes += itemBytes;
                                } else {
                                    breakdown.kvSystemBytes += itemBytes;
                                }
                            } else if (storeName === "files" && typeof key === "string") {
                                if (key.includes("/__chunk_")) {
                                    breakdown.chunkCount++;
                                } else {
                                    breakdown.externalFileCount++;
                                }
                            }

                            processedRecords++;
                            if (processedRecords % notifyStep === 0 || processedRecords === totalRecords) {
                                const pct = totalRecords > 0
                                    ? 10 + Math.round((processedRecords / totalRecords) * 85)
                                    : 95;
                                self.postMessage({
                                    type: "PROGRESS",
                                    percent: pct,
                                    storeName,
                                    detail: `[${storeName}] スキャン中... (${processedRecords} / ${totalRecords} 件)`
                                });
                            }

                            cursor.continue();
                        } else {
                            resolve();
                        }
                    };
                    request.onerror = () => reject(request.error);
                    tx.onabort = () => reject(new Error("Transaction aborted"));
                });

                sizes[storeName] = bytes;
            }

            self.postMessage({
                type: "PROGRESS",
                percent: 100,
                detail: "ストレージ解析が完了しました。"
            });

            self.postMessage({
                type: "RESULT",
                success: true,
                sizes,
                breakdown
            });
        } catch (err) {
            self.postMessage({
                type: "RESULT",
                success: false,
                error: err.message
            });
        }
    }
};