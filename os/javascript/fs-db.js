// fs-db.js
import { openDB } from "./db.js";

const STORE = "kv";
const FS_KEY = "fs";

/**
 * 堅牢性向上のための保存キュー
 */
let saveChain = Promise.resolve();

/* =========================
   Low level API
========================= */

export async function dbSet(key, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        const store = tx.objectStore(STORE);

        try {
            // structuredClone は呼び出し側かここ、どちらかで1回確実に行う
            store.put(value, key);
        } catch (e) {
            reject(new Error(`Data clone/storage failed: ${e.message}`));
            return;
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(new Error("Transaction aborted"));
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

function stripProxy(obj) {
    if (!obj || typeof obj !== "object") return obj;
    const copy = Array.isArray(obj) ? [] : {};
    const keys = Object.keys(obj);
    for (const key of keys) {
        copy[key] = stripProxy(obj[key]);
    }
    return copy;
}

/**
 * FSをIndexedDBに保存する
 * 安定性向上: Promiseチェーンにより順序を守り、異常な構造の保存を阻止
 */
export async function saveFS(fs) {
    saveChain = saveChain.then(async () => {
        try {
            // 1. Proxyの皮を剥く
            const cleanFS = stripProxy(fs);

            // 2. 整合性チェック (Systemディレクトリがない場合は保存させない)
            if (!cleanFS || typeof cleanFS !== 'object' || !cleanFS.System) {
                throw new Error("Critical error: FS structure corrupted. Save blocked to prevent BSOD.");
            }

            // 3. 内部的に複製して不純物を完全に排除してからDBへ
            const clone = structuredClone(cleanFS);
            await dbSet(FS_KEY, clone);

        } catch (err) {
            console.error("[FS-DB] Save process failed:", err);
            // ここでエラーを throw しないことで、後続の保存プロセスを止めない
        }
    });

    return saveChain;
}

export async function loadFS() {
    try {
        const data = await dbGet(FS_KEY);
        return data || null; // データがない場合は null を返す
    } catch (err) {
        console.error("[FS-DB] Load failed:", err);
        return null;
    }
}