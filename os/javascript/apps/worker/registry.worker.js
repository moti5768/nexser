// registry.worker.js
import { openDB } from "../../db.js";

function dataURLToBlob(dataURL) {
    const parts = dataURL.split(',');
    const mime = parts[0].match(/:(.*?);/)[1];
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}

async function compressObject(obj) {
    const jsonStr = JSON.stringify(obj);
    const stream = new Blob([jsonStr]).stream().pipeThrough(new CompressionStream('gzip'));
    return await new Response(stream).blob();
}

async function decompressBlob(blob) {
    try {
        const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
        const text = await new Response(stream).text();
        return JSON.parse(text);
    } catch (err) {
        try {
            const text = await blob.text();
            return JSON.parse(text);
        } catch (jsonErr) {
            throw new Error("ファイルの解凍およびJSON解析に失敗しました。正しいバックアップファイルか確認してください。");
        }
    }
}

async function getStoreEntries(db, storeName) {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const entries = {};
    await new Promise((resolve, reject) => {
        const request = store.openCursor();
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                let val = cursor.value;
                if (val instanceof Blob) {
                    try {
                        const reader = new FileReaderSync();
                        const dataUrl = reader.readAsDataURL(val);
                        val = { __type: "Blob", data: dataUrl };
                    } catch (err) {
                        console.error("Failed to serialize Blob:", err);
                    }
                }
                entries[String(cursor.key)] = val;
                cursor.continue();
            } else {
                resolve();
            }
        };
        request.onerror = (err) => reject(err);
    });
    return entries;
}

async function importStoreEntries(db, storeName, importData) {
    const entries = Object.entries(importData);
    const BATCH_SIZE = 500;
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const chunk = entries.slice(i, i + BATCH_SIZE);
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);

        for (let [k, v] of chunk) {
            if (v && typeof v === 'object' && v.__type === 'Blob' && typeof v.data === 'string') {
                try {
                    v = dataURLToBlob(v.data);
                } catch (err) {
                    console.error(`Failed to deserialize Blob for key ${k}:`, err);
                }
            }
            store.put(v, k);
        }
        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    }
}

function getNestedNodeByPath(rootNode, pathArr) {
    let current = rootNode;
    if (!current || typeof current !== "object") return null;

    for (const p of pathArr) {
        if (current[p] !== undefined && current[p] !== null && typeof current[p] === "object") {
            current = current[p];
        } else {
            return null;
        }
    }
    return current;
}

self.onmessage = async (e) => {
    const { action = 'fetch', storeName, storeNames, searchTerm, maxVisibleItems = 500, importPayloads, currentPath = [], requestId } = e.data;
    try {
        const db = await openDB();

        if (action === 'export') {
            const entries = await getStoreEntries(db, storeName);
            const compressedBlob = await compressObject(entries);
            self.postMessage({ success: true, action: 'export', requestId, storeName, blob: compressedBlob });
            return;
        }

        if (action === 'exportAll') {
            const results = {};
            for (const sName of storeNames) {
                const entries = await getStoreEntries(db, sName);
                const compressedBlob = await compressObject(entries);
                results[sName] = compressedBlob;
            }
            self.postMessage({ success: true, action: 'exportAll', requestId, results });
            return;
        }

        if (action === 'import') {
            for (const payload of importPayloads) {
                const rawData = await decompressBlob(payload.blob);
                if (!rawData || typeof rawData !== 'object') {
                    throw new Error(`インポートデータのフォーマットが不正です (${payload.storeName})。`);
                }
                await importStoreEntries(db, payload.storeName, rawData);
            }
            self.postMessage({ success: true, action: 'import', requestId });
            return;
        }

        if (action === 'getSubTree') {
            console.log("[Worker] getSubTree called with storeName:", storeName, "currentPath:", currentPath); // ⭐ 追加
            let subFolders = [];
            if (storeName === "kv") {
                const tx = db.transaction(storeName, "readonly");
                const store = tx.objectStore(storeName);

                const rawFs = await new Promise((resolve) => {
                    const req = store.get("fs_C:");
                    req.onsuccess = (e) => {
                        if (e.target.result) {
                            resolve(e.target.result);
                        } else {
                            const req2 = store.get("fs");
                            req2.onsuccess = (e2) => resolve(e2.target.result || null);
                            req2.onerror = () => resolve(null);
                        }
                    };
                    req.onerror = () => {
                        const req2 = store.get("fs");
                        req2.onsuccess = (e2) => resolve(e2.target.result || null);
                        req2.onerror = () => resolve(null);
                    };
                });

                const targetNode = getNestedNodeByPath(rawFs, currentPath);
                console.log("[Worker Debug] rawFs:", rawFs); // ⭐ 追加
                console.log("[Worker Debug] targetNode:", targetNode);

                if (targetNode && typeof targetNode === "object") {
                    for (const [k, v] of Object.entries(targetNode)) {
                        if (["type", "system", "content", "target", "entry", "shell", "singleton", "lastModified", "hidden", "size"].includes(k)) continue;

                        if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Blob)) {
                            const type = v.type;
                            if (type !== "file" && type !== "app" && type !== "link") {
                                subFolders.push(k);
                            }
                        }
                    }
                }
            }
            console.log("[Worker] resolved subFolders:", subFolders); // ⭐ 追加
            self.postMessage({ success: true, action: 'getSubTree', requestId, storeName, subFolders });
            return;
        }

        // --- データ取得の最適化 ---
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);

        const items = [];
        const dbKeys = [];
        let count = 0;

        if (storeName === "kv") {
            const rawFs = await new Promise((resolve) => {
                const req = store.get("fs_C:");
                req.onsuccess = (e) => {
                    if (e.target.result) {
                        resolve(e.target.result);
                    } else {
                        const req2 = store.get("fs");
                        req2.onsuccess = (e2) => resolve(e2.target.result || null);
                        req2.onerror = () => resolve(null);
                    }
                };
                req.onerror = () => {
                    const req2 = store.get("fs");
                    req2.onsuccess = (e2) => resolve(e2.target.result || null);
                    req2.onerror = () => resolve(null);
                };
            });

            const targetNode = getNestedNodeByPath(rawFs, currentPath);

            if (targetNode && typeof targetNode === "object") {
                for (const [k, v] of Object.entries(targetNode)) {
                    if (["type", "system", "content", "target", "entry", "shell", "singleton", "lastModified", "hidden", "size"].includes(k)) continue;

                    dbKeys.push(k);

                    const isMatch = !searchTerm || k.toLowerCase().includes(searchTerm.toLowerCase());
                    if (isMatch && count < maxVisibleItems) {
                        let val = v;
                        if (val && typeof val === 'object' && val.type === "file") {
                            val = {
                                type: "file",
                                size: val.size || (typeof val.content === "string" ? val.content.length : 0),
                                content: typeof val.content === "string" && val.content.length > 1000
                                    ? val.content.substring(0, 1000) + " ... (truncated)"
                                    : val.content
                            };
                        } else if (typeof val === 'string' && val.length > 5000) {
                            val = val.substring(0, 5000) + " ... (truncated due to large size)";
                        }

                        items.push({ key: k, keyStr: k, value: val });
                        count++;
                    }
                }
            }
        } else {
            // ⭐ 修正: filesストア（HKEY_CLASSES_ROOT）の場合はパス区切りが "/"、それ以外は "."
            const delimiter = storeName === "files" ? "/" : ".";
            const prefix = currentPath.join(delimiter);

            await new Promise((resolve) => {
                const req = store.openCursor();
                req.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        const keyStr = String(cursor.key);

                        let displayKey = keyStr;
                        if (prefix) {
                            const checkPrefix = prefix + delimiter;
                            if (!keyStr.startsWith(checkPrefix)) {
                                cursor.continue();
                                return;
                            }
                            displayKey = keyStr.substring(checkPrefix.length);
                        }

                        if (displayKey && !displayKey.includes(".") && !displayKey.includes("/")) {
                            dbKeys.push(displayKey);

                            const isMatch = !searchTerm || displayKey.toLowerCase().includes(searchTerm.toLowerCase());
                            if (isMatch && count < maxVisibleItems) {
                                let val = cursor.value;
                                if (typeof val === 'string' && val.length > 5000) {
                                    val = val.substring(0, 5000) + " ... (truncated)";
                                }
                                items.push({ key: cursor.key, keyStr: displayKey, value: val });
                                count++;
                            }
                        }
                        cursor.continue();
                    } else {
                        resolve();
                    }
                };
                req.onerror = () => resolve();
            });
        }

        self.postMessage({ success: true, action: 'fetch', requestId, storeName, items, dbKeys });
    } catch (err) {
        self.postMessage({ success: false, action: e.data.action || 'fetch', requestId, error: err.message });
    }
};