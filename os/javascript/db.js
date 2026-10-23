// db.js
const DB_NAME = "nexser-os";
const DB_VERSION = 2;

let dbPromise = null;

/**
 * データベース接続を取得する（Promiseをキャッシュして効率化）
 */
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

            // メインスレッド（windowが存在する環境）のみフラグをリセット
            if (typeof window !== "undefined") {
                window._dbBlockedAlertShown = false;
            }

            // 別タブでのバージョン変更時に接続を閉じる
            db.onversionchange = () => {
                db.close();
                dbPromise = null;
                console.warn("[DB] Version changed in another tab. Connection closed.");
            };

            // 接続が閉じられた時にキャッシュを破棄
            db.onclose = () => {
                dbPromise = null;
                console.warn("[DB] Database connection closed.");
            };

            resolve(db);
        };

        req.onerror = () => {
            dbPromise = null;
            reject(req.error);
        };

        req.onblocked = () => {
            console.warn("[DB] Version upgrade blocked by other tabs.");

            // メインスレッドでのみリロード確認ダイアログを表示
            if (typeof window !== "undefined" && !window._dbBlockedAlertShown) {
                window._dbBlockedAlertShown = true;
                if (confirm("システムの新しいバージョンを適用するために、ページをリロードする必要があります。\n今すぐリロードしますか？")) {
                    location.reload();
                }
            }
        };
    });

    return dbPromise;
}