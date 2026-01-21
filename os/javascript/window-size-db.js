// window-size-db.js
import { openDB } from "./db.js";

const STORE = "window-size";

export async function saveWindowSize(key, size) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE, "readwrite");
        const store = tx.objectStore(STORE);

        store.put(size, key);

        // 書き込み完了を待つ
        await tx.complete;

        console.log(`Window size saved: ${key}`);
        return true;
    } catch (e) {
        console.error("saveWindowSize failed:", e);
        alert(`ウィンドウサイズの保存に失敗しました: ${key}`);
        return false;
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