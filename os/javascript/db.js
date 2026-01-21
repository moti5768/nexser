// db.js
const DB_NAME = "nexser-os";
const DB_VERSION = 1;
let dbPromise = null;

export function openDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = e => {
            const db = e.target.result;

            if (!db.objectStoreNames.contains("recent")) {
                db.createObjectStore("recent");
            }
            if (!db.objectStoreNames.contains("window-size")) {
                db.createObjectStore("window-size");
            }
            if (!db.objectStoreNames.contains("kv")) {
                db.createObjectStore("kv");
            }
            if (!db.objectStoreNames.contains("settings")) {
                db.createObjectStore("settings");
            }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });

    return dbPromise;
}