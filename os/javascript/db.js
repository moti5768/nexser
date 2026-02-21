// db.js
const DB_NAME = "nexser-os";
const DB_VERSION = 1;
let dbPromise = null;

export function openDB() {
    // 既存の接続（Promise）があればそれを返す
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        // データベースの構造定義
        req.onupgradeneeded = e => {
            const db = e.target.result;

            const stores = ["recent", "window-size", "kv", "settings"];
            stores.forEach(name => {
                if (!db.objectStoreNames.contains(name)) {
                    db.createObjectStore(name);
                }
            });
        };

        // 接続成功時の処理
        req.onsuccess = () => {
            const db = req.result;

            // --- 堅牢性向上のためのイベントハンドリング ---

            // 1. 他のタブで DB のバージョンが上がった場合（アプリのアップデート時など）
            db.onversionchange = () => {
                db.close();
                console.warn("[DB] Database version changed in another tab. Closing connection.");
                // 接続を閉じることで、データの不整合やブラウザのフリーズを防ぐ
                // 必要に応じて reload を促す通知を出す
            };

            // 2. 予期せぬエラーで切断された場合
            db.onerror = (e) => {
                console.error("[DB] Unexpected database error:", e.target.error);
            };

            resolve(db);
        };

        // 接続失敗時の処理
        req.onerror = () => {
            dbPromise = null; // 失敗した場合はキャッシュをクリアして再試行可能にする
            reject(req.error);
        };

        // 他のタブが古い接続を維持していて、アップグレードがブロックされた場合
        req.onblocked = () => {
            console.warn("[DB] Connection blocked. Please close other tabs of this app.");
            alert("システムの更新がブロックされました。他のタブを閉じて再読み込みしてください。");
        };
    });

    return dbPromise;
}