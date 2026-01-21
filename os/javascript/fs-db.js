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

export async function saveFS(fs) {
    return dbSet(FS_KEY, fs);
}

export async function loadFS() {
    return dbGet(FS_KEY);
}