// recent.js
import { openDB } from "./db.js";
import { basename } from "./fs-utils.js";

const STORE = "recent";
const KEY = "items";
const MAX = 10;

let cache = [];
let isLoaded = false;
let loadPromise = null;

async function load() {
    if (loadPromise) return loadPromise; // 既にロード処理中ならそのPromiseを返す

    loadPromise = (async () => {
        try {
            const db = await openDB();
            const tx = db.transaction(STORE, "readonly");
            const store = tx.objectStore(STORE);
            const req = store.get(KEY);

            return new Promise(resolve => {
                req.onsuccess = () => {
                    cache = req.result || [];
                    isLoaded = true;
                    resolve(cache);
                };
                req.onerror = () => {
                    cache = [];
                    isLoaded = true;
                    resolve(cache);
                };
            });
        } catch (e) {
            console.error("recent.js load failed:", e);
            cache = [];
            isLoaded = true;
            return cache;
        } finally {
            loadPromise = null;
        }
    })();

    return loadPromise;
}

async function save() {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE, "readwrite");
        const store = tx.objectStore(STORE);
        store.put(cache, KEY);

        // ★ 改善: トランザクションの完了を待つことで保存の確実性を向上
        await new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(new Error("Transaction aborted"));
        });
    } catch (e) {
        console.error("recent.js save failed:", e);
    }
}

export async function getRecent() {
    if (!isLoaded) await load();
    return [...cache];
}

export async function addRecent(item) {
    if (!item?.path || !item?.type) return;

    // 同一パスは1つにまとめる
    cache = cache.filter(i => i.path !== item.path);
    cache.unshift({
        path: item.path,
        type: item.type,
        display: item.display ?? basename(item.path),
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
        const store = tx.objectStore(STORE);
        store.put([], KEY);

        await new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.error("recent.js clearRecent failed:", e);
    }

    window.dispatchEvent(new Event("recent-updated"));
}

// ★ 改善: イベント受信時に進行中のロードプロミスも破棄して競合を防ぐ
window.addEventListener("recent-updated", () => {
    isLoaded = false;
    loadPromise = null;
});

export async function removeRecent(path) {
    cache = cache.filter(i => i.path !== path);
    await save();
    // UI(スタートメニューなど)に自動更新を通知
    window.dispatchEvent(new Event("recent-updated"));
}