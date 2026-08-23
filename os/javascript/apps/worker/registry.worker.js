// registry.worker.js
import { openDB } from "../../db.js";

self.onmessage = async (e) => {
    const { storeName, searchTerm, maxVisibleItems } = e.data;
    try {
        const db = await openDB();
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
                        items.push({
                            key: cursor.key,
                            keyStr: keyStr,
                            value: cursor.value
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

        self.postMessage({ success: true, storeName, items, dbKeys });
    } catch (err) {
        self.postMessage({ success: false, error: err.message });
    }
};