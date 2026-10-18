// window-size-db.js
import { openDB } from "./db.js";

const STORE = "window-size";

/**
 * IndexedDBのストア操作を共通化するヘルパー
 * @param {"readonly" | "readwrite"} mode - トランザクションモード
 * @param {(store: IDBObjectStore, tx: IDBTransaction) => void} callback - ストア操作コールバック
 */
async function withStore(mode, callback) {
    const db = await openDB();
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);

    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(new Error("Transaction aborted"));

        try {
            callback(store, tx);
        } catch (err) {
            reject(err);
        }
    });
}

export async function saveWindowSize(key, size) {
    try {
        await withStore("readwrite", (store) => {
            store.put(size, key);
        });
        console.log(`Window size saved: ${key}`);
        return true;
    } catch (e) {
        console.error("saveWindowSize failed:", e);
        return false;
    }
}

export async function loadWindowSize(key) {
    try {
        let result = null;
        await withStore("readonly", (store) => {
            const req = store.get(key);
            req.onsuccess = () => {
                result = req.result ?? null;
            };
            req.onerror = () => {
                throw req.error;
            };
        });
        return result;
    } catch (e) {
        console.error("loadWindowSize failed:", e);
        return null;
    }
}