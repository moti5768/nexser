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

const NODE_PREFIX = "fs_node:";
const META_RESERVED_KEYS = new Set([
    "type", "system", "content", "target", "entry",
    "shell", "singleton", "lastModified", "hidden", "size", "name", "frameless", "originalPath"
]);

function reqToPromise(req) {
    return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function txDone(tx) {
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error("Transaction error"));
        tx.onabort = () => reject(tx.error || new Error("Transaction aborted"));
    });
}

self.onmessage = async (e) => {
    const {
        action = 'fetch',
        storeName,
        storeNames,
        searchTerm,
        maxVisibleItems = 500,
        importPayloads,
        currentPath = [],
        requestId,
        key,
        oldKey,
        newKey,
        value,
        valueType
    } = e.data;

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

        // ============================================================
        // 新DB形式（fs_node:* + 親children）対応の階層ノード専用操作
        // ============================================================
        if (action === 'kvSaveNode') {
            const tx = db.transaction("kv", "readwrite");
            const store = tx.objectStore("kv");

            if (currentPath.length === 0 && key !== "C:") {
                // ルートの非階層KVエントリ（deleted_defaults 等）
                await reqToPromise(store.put(value, key));
            } else {
                const nodePath = currentPath.length === 0 ? key : `${currentPath.join("/")}/${key}`;
                const dbKey = `${NODE_PREFIX}${nodePath}`;
                const existing = await reqToPromise(store.get(dbKey));
                const nextMeta = (value && typeof value === "object" && !Array.isArray(value))
                    ? { ...value, lastModified: Date.now() }
                    : { type: "file", content: String(value ?? ""), lastModified: Date.now() };

                const nextRecord = {
                    meta: nextMeta,
                    children: Array.isArray(existing?.children) ? existing.children : []
                };
                await reqToPromise(store.put(nextRecord, dbKey));
            }

            await txDone(tx);
            self.postMessage({ success: true, action: 'kvSaveNode', requestId });
            return;
        }

        if (action === 'kvCreateNode') {
            const tx = db.transaction("kv", "readwrite");
            const store = tx.objectStore("kv");

            if (currentPath.length === 0) {
                // ルート直下への新規KV作成
                let candidate = "New Value";
                let counter = 1;
                const allKeys = new Set((await reqToPromise(store.getAllKeys())).map(String));
                while (allKeys.has(candidate) || candidate.startsWith(NODE_PREFIX) || candidate === "C:") {
                    candidate = `New Value #${counter++}`;
                }
                let initVal = "";
                if (valueType === "REG_DWORD") initVal = 0;
                if (valueType === "REG_JSON") initVal = {};
                await reqToPromise(store.put(initVal, candidate));
                await txDone(tx);
                self.postMessage({ success: true, action: 'kvCreateNode', requestId, createdKey: candidate });
                return;
            }

            const parentPath = currentPath.join("/");
            const parentDbKey = `${NODE_PREFIX}${parentPath}`;
            const parentRec = await reqToPromise(store.get(parentDbKey));
            if (!parentRec || !parentRec.meta) {
                throw new Error(`親階層ノード '${parentPath}' が見つかりません。`);
            }

            const existingChildren = new Set(Array.isArray(parentRec.children) ? parentRec.children : []);
            let candidate = "New Value";
            let counter = 1;
            while (existingChildren.has(candidate) || META_RESERVED_KEYS.has(candidate)) {
                candidate = `New Value #${counter++}`;
            }

            const childPath = `${parentPath}/${candidate}`;
            const childMeta = valueType === "REG_FOLDER"
                ? { type: "folder", lastModified: Date.now() }
                : { type: "file", content: "", size: 0, lastModified: Date.now() };

            await reqToPromise(store.put({ meta: childMeta, children: [] }, `${NODE_PREFIX}${childPath}`));

            parentRec.children = [...existingChildren, candidate];
            parentRec.meta.lastModified = Date.now();
            await reqToPromise(store.put(parentRec, parentDbKey));

            await txDone(tx);
            self.postMessage({ success: true, action: 'kvCreateNode', requestId, createdKey: candidate });
            return;
        }

        if (action === 'kvDeleteNode') {
            const tx = db.transaction(["kv", "files"], "readwrite");
            const kvStore = tx.objectStore("kv");
            const fileStore = tx.objectStore("files");

            if (currentPath.length === 0 && key !== "C:") {
                await reqToPromise(kvStore.delete(key));
                await txDone(tx);
                self.postMessage({ success: true, action: 'kvDeleteNode', requestId });
                return;
            }

            const parentPath = currentPath.join("/");
            const targetPath = `${parentPath}/${key}`;
            const targetDbKey = `${NODE_PREFIX}${targetPath}`;

            const targetRec = await reqToPromise(kvStore.get(targetDbKey));
            if (targetRec?.meta?.system === true) {
                throw new Error(`'${key}' はシステム保護された項目であるため削除できません。`);
            }

            // 自身およびサブツリー配下の fs_node:* をすべて削除
            await reqToPromise(kvStore.delete(targetDbKey));
            await new Promise((resolve, reject) => {
                const range = IDBKeyRange.bound(`${targetDbKey}/`, `${targetDbKey}/\uffff`);
                const req = kvStore.openCursor(range);
                req.onsuccess = (ev) => {
                    const cursor = ev.target.result;
                    if (cursor) {
                        kvStore.delete(cursor.primaryKey);
                        cursor.continue();
                    } else {
                        resolve();
                    }
                };
                req.onerror = () => reject(req.error);
            });

            // 関連する files ストアの外部データ・チャンクも削除
            await reqToPromise(fileStore.delete(targetPath));
            await new Promise((resolve, reject) => {
                const range = IDBKeyRange.bound(`${targetPath}/`, `${targetPath}/\uffff`);
                const req = fileStore.openCursor(range);
                req.onsuccess = (ev) => {
                    const cursor = ev.target.result;
                    if (cursor) {
                        fileStore.delete(cursor.primaryKey);
                        cursor.continue();
                    } else {
                        resolve();
                    }
                };
                req.onerror = () => reject(req.error);
            });

            // 親ノードの children 配列から除去
            const parentDbKey = `${NODE_PREFIX}${parentPath}`;
            const parentRec = await reqToPromise(kvStore.get(parentDbKey));
            if (parentRec && Array.isArray(parentRec.children)) {
                parentRec.children = parentRec.children.filter(c => c !== key);
                if (parentRec.meta) parentRec.meta.lastModified = Date.now();
                await reqToPromise(kvStore.put(parentRec, parentDbKey));
            }

            await txDone(tx);
            self.postMessage({ success: true, action: 'kvDeleteNode', requestId });
            return;
        }

        if (action === 'kvRenameNode') {
            if (!newKey || oldKey === newKey) {
                self.postMessage({ success: true, action: 'kvRenameNode', requestId });
                return;
            }
            if (META_RESERVED_KEYS.has(newKey) || newKey.includes("/")) {
                throw new Error(`'${newKey}' は使用できない名前です。`);
            }

            const tx = db.transaction(["kv", "files"], "readwrite");
            const kvStore = tx.objectStore("kv");
            const fileStore = tx.objectStore("files");

            if (currentPath.length === 0) {
                const existingCount = await reqToPromise(kvStore.count(newKey));
                if (existingCount > 0) throw new Error(`"${newKey}" は既に存在します。`);
                const val = await reqToPromise(kvStore.get(oldKey));
                await reqToPromise(kvStore.put(val, newKey));
                await reqToPromise(kvStore.delete(oldKey));
                await txDone(tx);
                self.postMessage({ success: true, action: 'kvRenameNode', requestId });
                return;
            }

            const parentPath = currentPath.join("/");
            const oldPath = `${parentPath}/${oldKey}`;
            const newPath = `${parentPath}/${newKey}`;
            const oldDbKey = `${NODE_PREFIX}${oldPath}`;
            const newDbKey = `${NODE_PREFIX}${newPath}`;

            const oldRec = await reqToPromise(kvStore.get(oldDbKey));
            if (!oldRec) throw new Error(`対象ノード '${oldKey}' が見つかりません。`);
            if (oldRec.meta?.system === true) {
                throw new Error(`'${oldKey}' はシステム保護された項目であるため名前を変更できません。`);
            }

            const dupCount = await reqToPromise(kvStore.count(newDbKey));
            if (dupCount > 0) throw new Error(`"${newKey}" は既に存在します。`);

            // 1. 自身とサブツリー配下の fs_node:* を新パスへ移行
            if (oldRec.meta) oldRec.meta.lastModified = Date.now();
            await reqToPromise(kvStore.put(oldRec, newDbKey));
            await reqToPromise(kvStore.delete(oldDbKey));

            const subtreeEntries = [];
            await new Promise((resolve, reject) => {
                const range = IDBKeyRange.bound(`${oldDbKey}/`, `${oldDbKey}/\uffff`);
                const req = kvStore.openCursor(range);
                req.onsuccess = (ev) => {
                    const cursor = ev.target.result;
                    if (cursor) {
                        subtreeEntries.push([String(cursor.primaryKey), cursor.value]);
                        kvStore.delete(cursor.primaryKey);
                        cursor.continue();
                    } else {
                        resolve();
                    }
                };
                req.onerror = () => reject(req.error);
            });

            for (const [subKey, subVal] of subtreeEntries) {
                const suffix = subKey.slice(oldDbKey.length);
                await reqToPromise(kvStore.put(subVal, `${newDbKey}${suffix}`));
            }

            // 2. 関連する files ストアの外部データ・チャンクも新パスへ移行
            const directFile = await reqToPromise(fileStore.get(oldPath));
            if (directFile !== undefined) {
                await reqToPromise(fileStore.put(directFile, newPath));
                await reqToPromise(fileStore.delete(oldPath));
            }
            const fileSubEntries = [];
            await new Promise((resolve, reject) => {
                const range = IDBKeyRange.bound(`${oldPath}/`, `${oldPath}/\uffff`);
                const req = fileStore.openCursor(range);
                req.onsuccess = (ev) => {
                    const cursor = ev.target.result;
                    if (cursor) {
                        fileSubEntries.push([String(cursor.primaryKey), cursor.value]);
                        fileStore.delete(cursor.primaryKey);
                        cursor.continue();
                    } else {
                        resolve();
                    }
                };
                req.onerror = () => reject(req.error);
            });
            for (const [fKey, fVal] of fileSubEntries) {
                const suffix = fKey.slice(oldPath.length);
                await reqToPromise(fileStore.put(fVal, `${newPath}${suffix}`));
            }

            // 3. 親ノードの children 配列内の名前を置換
            const parentDbKey = `${NODE_PREFIX}${parentPath}`;
            const parentRec = await reqToPromise(kvStore.get(parentDbKey));
            if (parentRec && Array.isArray(parentRec.children)) {
                parentRec.children = parentRec.children.map(c => (c === oldKey ? newKey : c));
                if (parentRec.meta) parentRec.meta.lastModified = Date.now();
                await reqToPromise(kvStore.put(parentRec, parentDbKey));
            }

            await txDone(tx);
            self.postMessage({ success: true, action: 'kvRenameNode', requestId });
            return;
        }

        // ============================================================
        // ツリー展開（getSubTree）
        // ============================================================
        if (action === 'getSubTree') {
            const subFolders = [];
            if (storeName === "kv") {
                const tx = db.transaction(storeName, "readonly");
                const store = tx.objectStore(storeName);

                if (currentPath.length === 0) {
                    // ルートレベル：ドライブノード（例: fs_node:C:）を検出
                    const rootC = await reqToPromise(store.get(`${NODE_PREFIX}C:`));
                    if (rootC) {
                        subFolders.push("C:");
                    }
                } else {
                    // 指定パス直下の children のうち type === "folder" のものだけをピンポイント取得
                    const nodePath = currentPath.join("/");
                    const rec = await reqToPromise(store.get(`${NODE_PREFIX}${nodePath}`));
                    if (rec && Array.isArray(rec.children)) {
                        const childRecords = await Promise.all(
                            rec.children.map(async (childName) => {
                                const cRec = await reqToPromise(store.get(`${NODE_PREFIX}${nodePath}/${childName}`));
                                return [childName, cRec];
                            })
                        );
                        for (const [childName, cRec] of childRecords) {
                            if (cRec?.meta?.type === "folder") {
                                subFolders.push(childName);
                            }
                        }
                    }
                }
            }
            self.postMessage({ success: true, action: 'getSubTree', requestId, storeName, subFolders });
            return;
        }

        // ============================================================
        // 一覧データ取得（fetch）
        // ============================================================
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);

        const items = [];
        const dbKeys = [];
        let count = 0;

        if (storeName === "kv") {
            if (currentPath.length === 0) {
                // HKEY_LOCAL_MACHINE 直下：C: ドライブノード + 非階層システムキー（deleted_defaults 等）
                const rootC = await reqToPromise(store.get(`${NODE_PREFIX}C:`));
                if (rootC && rootC.meta) {
                    dbKeys.push("C:");
                    if (!searchTerm || "c:".includes(searchTerm.toLowerCase())) {
                        items.push({ key: "C:", keyStr: "C:", value: rootC.meta });
                        count++;
                    }
                }

                await new Promise((resolve) => {
                    const req = store.openCursor();
                    req.onsuccess = (event) => {
                        const cursor = event.target.result;
                        if (cursor) {
                            const keyStr = String(cursor.primaryKey);
                            if (!keyStr.startsWith(NODE_PREFIX)) {
                                dbKeys.push(keyStr);
                                const isMatch = !searchTerm || keyStr.toLowerCase().includes(searchTerm.toLowerCase());
                                if (isMatch && count < maxVisibleItems) {
                                    items.push({ key: cursor.primaryKey, keyStr, value: cursor.value });
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
            } else {
                // 階層フォルダ内（例: C:/System）：該当ノードの children だけをピンポイント取得
                const nodePath = currentPath.join("/");
                const rec = await reqToPromise(store.get(`${NODE_PREFIX}${nodePath}`));

                if (rec && Array.isArray(rec.children)) {
                    for (const childName of rec.children) {
                        dbKeys.push(childName);

                        const isMatch = !searchTerm || childName.toLowerCase().includes(searchTerm.toLowerCase());
                        if (isMatch && count < maxVisibleItems) {
                            const childRec = await reqToPromise(store.get(`${NODE_PREFIX}${nodePath}/${childName}`));
                            if (!childRec || !childRec.meta) continue;

                            let val = { ...childRec.meta };
                            if (val.type === "file") {
                                const isTruncated = typeof val.content === "string" && val.content.length > 1000;
                                val = {
                                    ...val,
                                    _truncated: isTruncated,
                                    size: val.size || (typeof val.content === "string" ? val.content.length : 0),
                                    content: isTruncated
                                        ? val.content.substring(0, 1000) + " ... (truncated)"
                                        : val.content
                                };
                            }
                            items.push({ key: childName, keyStr: childName, value: val });
                            count++;
                        }
                    }
                }
            }
        } else {
            // files ストアは "/"、それ以外は "." で階層分割
            const isFilesStore = storeName === "files";
            const delimiter = isFilesStore ? "/" : ".";
            const prefix = currentPath.join(delimiter);

            await new Promise((resolve) => {
                const req = store.openCursor();
                req.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        const keyStr = String(cursor.key);

                        // 分割チャンクの断片キー（/__chunk_0 等）は一覧から除外
                        if (isFilesStore && keyStr.includes("/__chunk_")) {
                            cursor.continue();
                            return;
                        }

                        let displayKey = keyStr;
                        if (prefix) {
                            const checkPrefix = prefix + delimiter;
                            if (!keyStr.startsWith(checkPrefix)) {
                                cursor.continue();
                                return;
                            }
                            displayKey = keyStr.substring(checkPrefix.length);
                        }

                        const isDirectChild = isFilesStore
                            ? (displayKey && !displayKey.includes("/"))
                            : (displayKey && !displayKey.includes(".") && !displayKey.includes("/"));

                        if (isDirectChild) {
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