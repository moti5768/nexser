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
        } catch {
            cache = [];
            isLoaded = true;
            return cache;
        } finally {
            // ロード完了後にキャッシュをクリア（再ロードに備えるため）
            loadPromise = null;
        }
    })();

    return loadPromise;
}

async function save() {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(cache, KEY);
    } catch { }
}

export async function getRecent() {
    // ★変更: cache.length（配列の長さ）ではなく、ロード済みフラグで判定
    if (!isLoaded) await load();
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
window.addEventListener("recent-updated", () => {
    isLoaded = false;
});

export async function removeRecent(path) {
    cache = cache.filter(i => i.path !== path);
    await save();
    // UI(スタートメニューなど)に自動更新を通知
    window.dispatchEvent(new Event("recent-updated"));
}