// fs-db.js
import { openDB } from "./db.js";

const STORE = "kv";

/* =========================
   Low level API
========================= */

export async function dbSet(key, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        const store = tx.objectStore(STORE);
        store.put(structuredClone(value), key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function dbGet(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const store = tx.objectStore(STORE);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

/* =========================
   FS API
========================= */

const FS_KEY = "fs";

// Proxy を除去して純粋なオブジェクトにする関数
function stripProxy(obj) {
    if (!obj || typeof obj !== "object") return obj;
    const copy = Array.isArray(obj) ? [] : {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            copy[key] = stripProxy(obj[key]);
        }
    }
    return copy;
}

export async function saveFS(fs) {
    const cleanFS = stripProxy(fs); // <- Proxy を除去
    return dbSet(FS_KEY, cleanFS);
}

export async function loadFS() {
    return dbGet(FS_KEY);
}
