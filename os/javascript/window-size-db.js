// window-size-db.js
import { openDB } from "./db.js";

const STORE = "window-size";

export async function saveWindowSize(key, size) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(size, key);
    } catch (e) {
        console.warn("saveWindowSize failed:", e);
    }
}

export async function loadWindowSize(key) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(key);

        return await new Promise(resolve => {
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        });
    } catch {
        return null;
    }
}