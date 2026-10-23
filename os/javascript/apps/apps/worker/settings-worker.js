// settings-worker.js (Web Worker側)
// 注意: 外部の db.js から openDB がインポートできる環境であればそれを利用するか、直接 openDB を定義します
import { openDB } from "../../db.js";

const encoder = new TextEncoder();

function calculateItemSize(storeName, item) {
    if (!item) return 0;
    if (storeName === "files") {
        if (item instanceof Blob) return item.size;
        if (item instanceof ArrayBuffer) return item.byteLength;
        if (typeof item === 'string') return encoder.encode(item).length;
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
            // Worker内独自のDBコネクションまたは処理
            const db = await openDB();
            const storeNames = Array.from(db.objectStoreNames);

            const results = await Promise.all(storeNames.map(async (storeName) => {
                let bytes = 0;
                const tx = db.transaction(storeName, "readonly");
                const store = tx.objectStore(storeName);

                await new Promise((resolve, reject) => {
                    const request = store.openCursor();
                    request.onsuccess = (event) => {
                        const cursor = event.target.result;
                        if (cursor) {
                            bytes += calculateItemSize(storeName, cursor.value);
                            cursor.continue();
                        } else {
                            resolve();
                        }
                    };
                    request.onerror = () => reject(request.error);
                    tx.onabort = () => reject(new Error("Transaction aborted"));
                });

                return [storeName, bytes];
            }));

            const sizes = Object.fromEntries(results);
            self.postMessage({ success: true, sizes });
        } catch (err) {
            self.postMessage({ success: false, error: err.message });
        }
    }
};