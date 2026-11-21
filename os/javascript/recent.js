// recent.js
import { openDB } from "./db.js";
import { basename } from "./fs-utils.js";
import { getStorageHalted } from "./fs-db.js";

const STORE = "recent";
const KEY = "items";
const MAX = 10;

let cache = [];
let isLoaded = false;
let loadPromise = null;
let writeChain = Promise.resolve();
let isSelfDispatching = false;

function isWriteBlocked() {
    if (typeof getStorageHalted === "function" && getStorageHalted()) return true;
    const state = window.nexser?.kernelAPI?.getSystemState?.();
    if (state?.isSystemDead) return true;
    return false;
}

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
                    cache = Array.isArray(req.result) ? req.result : [];
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
    if (isWriteBlocked()) return;
    try {
        const db = await openDB();
        const tx = db.transaction(STORE, "readwrite");
        const store = tx.objectStore(STORE);
        store.put([...cache], KEY);

        await new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(new Error("Transaction aborted"));
        });
    } catch (e) {
        console.error("recent.js save failed:", e);
    }
}

function enqueueWrite(task) {
    const run = writeChain.then(task);
    writeChain = run.catch(() => { });
    return run;
}

function dispatchRecentUpdated() {
    isSelfDispatching = true;
    try {
        window.dispatchEvent(new Event("recent-updated"));
    } finally {
        isSelfDispatching = false;
    }
}

export async function getRecent() {
    if (!isLoaded) await load();
    return [...cache];
}

export async function addRecent(item) {
    if (!item?.path || !item?.type || isWriteBlocked()) return;

    return enqueueWrite(async () => {
        if (isWriteBlocked()) return;
        // 未ロード状態で追加するとDB上の過去履歴が消えるため、必ず先にロードする
        if (!isLoaded) await load();

        cache = cache.filter(i => i.path !== item.path);
        cache.unshift({
            path: item.path,
            type: item.type,
            display: item.display ?? basename(item.path),
            time: Date.now()
        });
        cache = cache.slice(0, MAX);

        await save();
        dispatchRecentUpdated();
    });
}

export async function clearRecent() {
    if (isWriteBlocked()) return;

    return enqueueWrite(async () => {
        if (isWriteBlocked()) return;
        cache = [];
        isLoaded = true;
        await save();
        dispatchRecentUpdated();
    });
}

export async function removeRecent(path) {
    if (!path || isWriteBlocked()) return;

    return enqueueWrite(async () => {
        if (isWriteBlocked()) return;
        if (!isLoaded) await load();

        cache = cache.filter(i => i.path !== path);
        await save();
        dispatchRecentUpdated();
    });
}

// 外部からの recent-updated 通知時のみキャッシュを再読込対象に戻す
window.addEventListener("recent-updated", () => {
    if (isSelfDispatching) return;
    isLoaded = false;
    loadPromise = null;
});

window.addEventListener("nexser-logoff", () => {
    isLoaded = false;
    loadPromise = null;
});