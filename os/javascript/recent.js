// recent.js
import { openDB } from "./db.js";
import { basename } from "./kernel.js";

const STORE = "recent";
const KEY = "items";
const MAX = 10;

let cache = [];

async function load() {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE, "readonly");
        const store = tx.objectStore(STORE);
        const req = store.get(KEY);

        return new Promise(resolve => {
            req.onsuccess = () => {
                cache = req.result || [];
                resolve(cache);
            };
            req.onerror = () => {
                cache = [];
                resolve(cache);
            };
        });
    } catch {
        cache = [];
        return cache;
    }
}

async function save() {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(cache, KEY);
    } catch { }
}

export async function getRecent() {
    if (!cache.length) await load();
    return [...cache];
}

// ★ async にする
export async function addRecent(item) {
    if (!item?.path || !item?.type) return;

    // 同一パスは1つにまとめる
    cache = cache.filter(i => i.path !== item.path);
    cache.unshift({
        path: item.path,
        type: item.type,
        display: item.display ?? basename(item.path), // ←追加
        time: Date.now()
    });
    cache = cache.slice(0, MAX);

    await save();

    // UI に更新を通知
    window.dispatchEvent(new Event("recent-updated"));
}

export async function clearRecent() {
    cache = [];
    try {
        const db = await openDB();
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put([], KEY);
    } catch { }

    window.dispatchEvent(new Event("recent-updated"));
}
