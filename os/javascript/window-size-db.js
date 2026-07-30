// window-size-db.js
import { openDB } from "./db.js";

const STORE = "window-size";

export async function saveWindowSize(key, size) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE, "readwrite");
        const store = tx.objectStore(STORE);

        store.put(size, key);

        await new Promise((resolve, reject) => {
            tx.oncomplete = () => {
                console.log(`Window size saved: ${key}`);
                resolve();
            };
            tx.onerror = () => reject(tx.error);
        });
        return true;
    } catch (e) {
        console.error("saveWindowSize failed:", e);
        return false;
    }
}

export async function loadWindowSize(key) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE, "readonly");
        const store = tx.objectStore(STORE);

        return await new Promise((resolve, reject) => {
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result ?? null);
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.error("loadWindowSize failed:", e);
        return null;
    }
}