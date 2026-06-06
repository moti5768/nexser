// window-size-db.js
import { openDB } from "./db.js";

const STORE = "window-size";

export async function saveWindowSize(key, size) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, "readwrite");
            const store = tx.objectStore(STORE);

            store.put(size, key);

            // 標準の IndexedDB API では tx.oncomplete を使用します
            tx.oncomplete = () => {
                console.log(`Window size saved: ${key}`);
                resolve(true);
            };
            tx.onerror = () => {
                console.error("saveWindowSize failed:", tx.error);
                reject(tx.error);
            };
        });
    } catch (e) {
        console.error("saveWindowSize catch error:", e);
        // alert(`ウィンドウサイズの保存に失敗しました: ${key}`);
        return false;
    }
}

export async function loadWindowSize(key) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, "readonly");
            const store = tx.objectStore(STORE);
            const req = store.get(key);

            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.error("loadWindowSize failed:", e);
        return null;
    }
}