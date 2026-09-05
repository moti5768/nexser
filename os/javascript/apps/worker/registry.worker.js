// registry.worker.js
import { openDB } from "../../db.js";

// Helper: Data URL から Blob を復元する関数
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

self.onmessage = async (e) => {
    const { action = 'fetch', storeName, searchTerm, maxVisibleItems, importData } = e.data;
    try {
        const db = await openDB();

        // --- 1. エクスポート処理 (Blobも含めて安全にシリアライズ) ---
        if (action === 'export') {
            const tx = db.transaction(storeName, "readonly");
            const store = tx.objectStore(storeName);

            const entries = {};
            await new Promise((resolve, reject) => {
                const request = store.openCursor();
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        let val = cursor.value;
                        // Blobの場合はBase64(Data URL)に変換して保持する
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

            const jsonStr = JSON.stringify(entries, null, 2);
            const blob = new Blob([jsonStr], { type: "application/json" });
            self.postMessage({ success: true, action: 'export', blob });
            return;
        }

        // --- 2. インポート処理 (Blobの復元とバッチ分割による安定化) ---
        if (action === 'import') {
            if (!importData || typeof importData !== 'object') {
                throw new Error("インポートデータのフォーマットが不正です。");
            }

            const entries = Object.entries(importData);
            const BATCH_SIZE = 500; // 500件ごとにトランザクションを分割

            for (let i = 0; i < entries.length; i += BATCH_SIZE) {
                const chunk = entries.slice(i, i + BATCH_SIZE);
                const tx = db.transaction(storeName, "readwrite");
                const store = tx.objectStore(storeName);

                for (let [k, v] of chunk) {
                    // シリアライズされていたBlobデータを元に戻す
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

            self.postMessage({ success: true, action: 'import' });
            return;
        }

        // --- 3. デフォルト: 検索・表示用データの取得 ---
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

                        items.push({
                            key: cursor.key,
                            keyStr: keyStr,
                            value: val
                        });
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