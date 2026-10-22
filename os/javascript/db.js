// db.js
const DB_NAME = "nexser-os";
const DB_VERSION = 2;

let dbPromise = null;

export function openDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = e => {
            const db = e.target.result;
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
                dbPromise = null; // ★ 接続変更時はキャッシュをクリア
                console.warn("[DB] Version changed in another tab. Connection closed.");
            };

            // ★ 追加: 接続が閉じられた時にもキャッシュを確実に破棄する
            db.onclose = () => {
                dbPromise = null;
                console.warn("[DB] Database connection closed.");
            };

            resolve(db);
        };

        req.onerror = () => {
            dbPromise = null; // 失敗時はキャッシュをクリア
            reject(req.error);
        };

        req.onblocked = () => {
            // 他のタブが古い接続を維持しているために、このタブの open が待たされている状態
            console.warn("[DB] Version upgrade blocked by other tabs.");

            // confirmが何度も出ないように1度だけ実行する工夫
            if (!window._dbBlockedAlertShown) {
                window._dbBlockedAlertShown = true;
                if (confirm("システムの新しいバージョンを適用するために、ページをリロードする必要があります。\n今すぐリロードしますか？")) {
                    location.reload();
                }
            }
        };
    });

    return dbPromise;
}