// registry.worker.js
import { openDB } from "../../db.js";

function dataURLToBlob(dataURL) {
    const parts = dataURL.split(',');
    const mime = parts[0].match(/:(.*?);/)[1];
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}

// 【追加】gzip圧縮ヘルパー
async function compressObject(obj) {
    const jsonStr = JSON.stringify(obj);
    const stream = new Blob([jsonStr]).stream().pipeThrough(new CompressionStream('gzip'));
    return await new Response(stream).blob();
}

// 【追加】gzip解凍ヘルパー
async function decompressBlob(blob) {
    try {
        // まず gzip 解凍を試みる
        const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
        const text = await new Response(stream).text();
        return JSON.parse(text);
    } catch (err) {
        // 解凍に失敗した場合（以前の非圧縮 .json ファイルなどの場合）、テキストとして読み込む
        try {
            const text = await blob.text();
            return JSON.parse(text);
        } catch (jsonErr) {
            throw new Error("ファイルの解凍およびJSON解析に失敗しました。正しいバックアップファイルか確認してください。");
        }
    }
}

// ストアデータの取得とBlobシリアライズを行う内部関数
async function getStoreEntries(db, storeName) {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const entries = {};
    await new Promise((resolve, reject) => {
        const request = store.openCursor();
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                let val = cursor.value;
                if (val instanceof Blob) {
                    try {
                        const reader = new FileReaderSync();
                        const dataUrl = reader.readAsDataURL(val);
                        val = { __type: "Blob", data: dataUrl };
                    } catch (err) {
                        console.error("Failed to serialize Blob:", err);
                    }
                }
                entries[String(cursor.key)] = val;
                cursor.continue();
            } else {
                resolve();
            }
        };
        request.onerror = (err) => reject(err);
    });
    return entries;
}

// ストアへのデータ書き込み（インポート）を行う内部関数
async function importStoreEntries(db, storeName, importData) {
    const entries = Object.entries(importData);
    const BATCH_SIZE = 500;
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const chunk = entries.slice(i, i + BATCH_SIZE);
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);

        for (let [k, v] of chunk) {
            if (v && typeof v === 'object' && v.__type === 'Blob' && typeof v.data === 'string') {
                try {
                    v = dataURLToBlob(v.data);
                } catch (err) {
                    console.error(`Failed to deserialize Blob for key ${k}:`, err);
                }
            }
            store.put(v, k);
        }
        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    }
}

self.onmessage = async (e) => {
    const { action = 'fetch', storeName, storeNames, searchTerm, maxVisibleItems, importPayloads } = e.data;
    try {
        const db = await openDB();

        // --- 1. 個別エクスポート (圧縮形式 .json.gz) ---
        if (action === 'export') {
            const entries = await getStoreEntries(db, storeName);
            const compressedBlob = await compressObject(entries);
            self.postMessage({ success: true, action: 'export', storeName, blob: compressedBlob });
            return;
        }

        // --- 2. 全てのエクスポート (ストアごとに分割して圧縮) ---
        if (action === 'exportAll') {
            const results = {};
            for (const sName of storeNames) {
                const entries = await getStoreEntries(db, sName);
                const compressedBlob = await compressObject(entries);
                // Worker間転送のため、BlobをArrayBufferに変換またはそのまま送る
                results[sName] = compressedBlob;
            }
            self.postMessage({ success: true, action: 'exportAll', results });
            return;
        }

        // --- 3. インポート（単数または複数ファイルの同時復元対応） ---
        if (action === 'import') {
            // payloads は [{ storeName, blob }] の配列
            for (const payload of importPayloads) {
                const rawData = await decompressBlob(payload.blob);
                if (!rawData || typeof rawData !== 'object') {
                    throw new Error(`インポートデータのフォーマットが不正です (${payload.storeName})。`);
                }
                await importStoreEntries(db, payload.storeName, rawData);
            }
            self.postMessage({ success: true, action: 'import' });
            return;
        }

        // --- 4. デフォルト: 検索・表示用データの取得 ---
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);

        const items = [];
        const dbKeys = [];
        let count = 0;

        await new Promise((resolve, reject) => {
            const request = store.openCursor();
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const keyStr = String(cursor.key);
                    dbKeys.push(keyStr);

                    const isMatch = !searchTerm || keyStr.toLowerCase().includes(searchTerm.toLowerCase());
                    if (isMatch && count < maxVisibleItems) {
                        let val = cursor.value;
                        if (typeof val === 'string' && val.length > 5000) {
                            val = val.substring(0, 5000) + " ... (truncated due to large size)";
                        }
                        items.push({ key: cursor.key, keyStr: keyStr, value: val });
                        count++;
                    }
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            request.onerror = (err) => reject(err);
        });

        self.postMessage({ success: true, action: 'fetch', storeName, items, dbKeys });
    } catch (err) {
        self.postMessage({ success: false, action: e.data.action || 'fetch', error: err.message });
    }
};