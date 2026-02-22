// db.js
const DB_NAME = "nexser-os";
// バージョンを上げないと onupgradeneeded が実行されません
const DB_VERSION = 2;

let dbPromise = null;

export function openDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = e => {
            const db = e.target.result;
            // 作成したいストアのリスト
            const stores = ["recent", "window-size", "kv", "settings", "files"];

            stores.forEach(name => {
                if (!db.objectStoreNames.contains(name)) {
                    db.createObjectStore(name);
                    console.log(`[DB] Store created: ${name}`);
                }
            });
        };

        req.onsuccess = () => {
            const db = req.result;
            db.onversionchange = () => {
                db.close();
                console.warn("[DB] Version changed. Connection closed.");
            };
            resolve(db);
        };

        req.onerror = () => {
            dbPromise = null;
            reject(req.error);
        };

        req.onblocked = () => {
            alert("システムの更新がブロックされました。他のタブを閉じてください。");
        };
    });

    return dbPromise;
}