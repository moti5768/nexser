// RegistryEditor.js
import { openDB } from "../db.js";
import { attachContextMenu } from "../context-menu.js";
import { setupRibbon } from "../ribbon.js";
import { taskbarButtons } from "../window.js";
import { getIcon } from "../file-associations.js";
import { resolveFS } from "../fs-utils.js";
import { getFileContent } from "../fs-db.js";

let worker = null;
function getWorker() {
    // ⭐ ワーカーのキャッシュを防ぐために一意のクエリを付与
    if (!worker) {
        const workerUrl = new URL('./worker/registry.worker.js', import.meta.url);
        workerUrl.searchParams.append('v', Date.now());
        worker = new Worker(workerUrl, { type: 'module' });
    }
    return worker;
}

export default function RegistryEditor(root) {
    const STORE_NAMES = ["settings", "files", "kv", "recent", "window-size"];
    let currentStore = STORE_NAMES[0];
    let currentPath = [];
    let dbPromise = null;
    let isProcessing = false;
    let searchTerm = "";
    const MAX_VISIBLE_ITEMS = 500;

    let currentRequestId = 0;
    let treeRequestId = 0

    const win = root.closest(".window");
    let editingKey = null;

    function isProtected(store, key, val = null) {
        if (store !== "kv") return false;
        if (currentPath.length === 0) {
            return key === "C:" || key === "deleted_defaults" || key === "fs_journal" ||
                (typeof key === "string" && (key === "fs" || key.startsWith("fs_")));
        }
        // 階層内の場合は system: true のノードを保護対象とする
        const tr = rowMap.get(String(key));
        const targetVal = val || tr?._val;
        return Boolean(targetVal && typeof targetVal === "object" && targetVal.system === true);
    }

    function notifySystemChange(store, key) {
        if (store === "settings") {
            window.dispatchEvent(new CustomEvent("setting-changed", { detail: { key } }));
        } else if (store === "recent") {
            window.dispatchEvent(new Event("recent-updated"));
        } else if (store === "files" || store === "kv") {
            window.dispatchEvent(new Event("fs-updated"));
        }
    }

    // Worker への汎用リクエスト送信ヘルパー
    function sendWorkerRequest(payload) {
        const workerInstance = getWorker();
        const reqId = ++currentRequestId;
        return new Promise((resolve, reject) => {
            const handleMessage = (e) => {
                if (e.data.action === payload.action && e.data.requestId === reqId) {
                    workerInstance.removeEventListener("message", handleMessage);
                    resolve(e.data);
                }
            };
            const handleError = (err) => {
                workerInstance.removeEventListener("error", handleError);
                reject(err);
            };
            workerInstance.addEventListener("message", handleMessage);
            workerInstance.addEventListener("error", handleError);
            workerInstance.postMessage({ ...payload, requestId: reqId });
        });
    }

    // kv ストア（fs_node:*）変更時にメモリ上の FS ツリーも同期
    function syncMemoryFS(op, key, extra = {}) {
        if (currentStore !== "kv" || currentPath.length === 0) return;
        const parentPath = currentPath.join("/");
        const parentNode = resolveFS(parentPath);
        if (!parentNode || typeof parentNode !== "object") return;

        if (op === "save" && extra.value && typeof extra.value === "object") {
            parentNode[key] = structuredClone(extra.value);
        } else if (op === "create" && extra.value && typeof extra.value === "object") {
            parentNode[key] = structuredClone(extra.value);
        } else if (op === "delete") {
            delete parentNode[key];
        } else if (op === "rename" && extra.newKey && parentNode[key]) {
            parentNode[extra.newKey] = parentNode[key];
            delete parentNode[key];
        }
    }

    async function getDB() {
        if (!dbPromise) dbPromise = openDB();
        return dbPromise;
    }

    root.innerHTML = `
        <div class="registry-editor" style="display:flex; flex-direction:column; height:100%; font-size:12px; font-family: 'MS Sans Serif', sans-serif; background:#c0c0c0; user-select:none;">
            <div style="padding:4px; display:flex; gap:5px; border-bottom:1px solid #808080; background:#eee; align-items:center;">
                <span>Find:</span>
                <input type="text" class="border" id="reg-search" style="flex:1; outline:none; padding:1px 3px; background:#fff;" placeholder="Search keys...">
            </div>
            <div style="display:flex; flex:1; overflow:hidden;">
                <div class="reg-left border" id="reg-tree-container" tabindex="0" style="width:160px; background:#fff; overflow-y:auto; overflow-x:auto; padding:4px; border-right: 1px solid #808080;">
                    <div style="font-weight:bold; margin-bottom:4px;">💻 My Computer</div>
                    <ul style="list-style:none; padding-left:15px; margin:0;" id="reg-tree"></ul>
                </div>
                
                <div style="flex:1; display:flex; flex-direction:column; overflow:hidden; position:relative;">
                    <div id="reg-loading" style="display:none; position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(192,192,192,0.6); z-index:100; justify-content:center; align-items:center; font-weight:bold;">
                        Loading...
                    </div>
                    
                    <div style="background:#c0c0c0; flex-shrink:0; border-bottom:1px solid #808080;">
                        <div style="display: grid; grid-template-columns: 30% 20% 1fr; width: 100%; box-sizing: border-box; padding-right: var(--sb-width, 16px);">
                            <div style="background-color: #C3C7CB; border: 1.5px solid #808080; border-color: #fff #808080 #808080 #fff; box-shadow: 0.5px 0.5px black; padding:2px;">Name</div>
                            <div style="background-color: #C3C7CB; border: 1.5px solid #808080; border-color: #fff #808080 #808080 #fff; box-shadow: 0.5px 0.5px black; padding:2px;">Type</div>
                            <div style="background-color: #C3C7CB; border: 1.5px solid #808080; border-color: #fff #808080 #808080 #fff; box-shadow: 0.5px 0.5px black; padding:2px;">Data</div>
                        </div>
                    </div>
                    
                    <div class="reg-right border" id="reg-main-view" style="flex:1; overflow-y:scroll; outline:none; background:#fff;" tabindex="0">
                        <table style="width:100%; border-collapse:collapse; table-layout: fixed;">
                            <thead style="visibility:collapse;">
                                <tr>
                                    <th style="width:30%;"></th>
                                    <th style="width:20%;"></th>
                                    <th style="width:50%;"></th>
                                </tr>
                            </thead>
                            <tbody id="reg-body"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;

    setTimeout(() => {
        const view = root.querySelector("#reg-main-view");
        if (view) {
            const sbWidth = view.offsetWidth - view.clientWidth;
            root.style.setProperty('--sb-width', sbWidth + "px");
        }
    }, 0);

    const treeEl = root.querySelector("#reg-tree");
    const bodyEl = root.querySelector("#reg-body");
    const mainView = root.querySelector("#reg-main-view");
    const searchInput = root.querySelector("#reg-search");
    const rowMap = new Map();
    let selectedKey = null;

    async function saveItem(key, rawVal, forcedType = null) {
        if (isProtected(currentStore, key)) {
            window.nexser?.windowAPI.confirmWindow("警告: ファイルシステムの構造を直接編集すると、OSが起動しなくなる恐れがあります。本当に続行しますか？", async (result) => {
                if (result) await performSave(key, rawVal, forcedType);
            }, { parentWin: win });
            return;
        }
        await performSave(key, rawVal, forcedType);
    }

    async function performSave(key, rawVal, forcedType) {
        try {
            let val = rawVal;
            if (forcedType === "REG_JSON") {
                try { val = JSON.parse(rawVal); }
                catch (e) { return window.nexser?.windowAPI.errorWindow("Invalid JSON format.", { parentWin: win }); }
            } else if (forcedType === "REG_DWORD") {
                val = Number(rawVal);
            } else {
                if (typeof rawVal === 'string') {
                    const trimmed = rawVal.trim();
                    const lower = trimmed.toLowerCase();

                    if (lower === "true") {
                        val = true;
                    } else if (lower === "false") {
                        val = false;
                    } else if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                        try { val = JSON.parse(trimmed); } catch (e) { val = trimmed; }
                    } else if (trimmed !== "" && !isNaN(Number(trimmed))) {
                        val = trimmed.includes('.') ? parseFloat(trimmed) : parseInt(trimmed, 10);
                    }
                }
            }

            let normalizedVal = val;
            if (currentStore === "kv") {
                const res = await sendWorkerRequest({
                    action: "kvSaveNode",
                    currentPath: [...currentPath],
                    key,
                    value: val
                });
                if (!res.success) throw new Error(res.error);

                if (currentPath.length > 0 || key === "C:") {
                    normalizedVal = (val && typeof val === "object" && !Array.isArray(val))
                        ? { ...val, lastModified: Date.now() }
                        : { type: "file", content: String(val ?? ""), lastModified: Date.now() };
                }
                syncMemoryFS("save", key, { value: normalizedVal });
            } else {
                const db = await getDB();
                const tx = db.transaction(currentStore, "readwrite");
                await tx.objectStore(currentStore).put(val, key);
                await tx.done;
            }

            notifySystemChange(currentStore, key);
            updateRow(key, String(key), normalizedVal);
        } catch (e) {
            window.nexser?.windowAPI.errorWindow("保存に失敗しました: " + e.message, { parentWin: win });
        }
    }

    async function deleteItem(key) {
        if (isProtected(currentStore, key)) {
            return window.nexser?.windowAPI.errorWindow(`'${key}' はシステム保護されたコンポーネントであるため、削除できません。`, { parentWin: win });
        }

        window.nexser?.windowAPI.confirmWindow(`このアイテムを削除してもよろしいですか? "${key}"`, async (result) => {
            if (!result) return;
            try {
                if (currentStore === "kv") {
                    const res = await sendWorkerRequest({
                        action: "kvDeleteNode",
                        currentPath: [...currentPath],
                        key
                    });
                    if (!res.success) throw new Error(res.error);
                    syncMemoryFS("delete", key);
                } else if (currentStore === "files") {
                    const { deleteFileContentRecursive } = await import("../fs-db.js");
                    await deleteFileContentRecursive(String(key));
                } else {
                    const db = await getDB();
                    const tx = db.transaction(currentStore, "readwrite");
                    await tx.objectStore(currentStore).delete(key);
                    await tx.done;
                }

                notifySystemChange(currentStore, key);

                const tr = rowMap.get(String(key));
                if (tr) {
                    tr.remove();
                    rowMap.delete(String(key));
                }
                if (selectedKey === String(key)) selectedKey = null;
                refresh(false);
            } catch (e) {
                console.error("[Registry] Delete failed:", e);
                window.nexser?.windowAPI.errorWindow("削除に失敗しました: " + e.message, { parentWin: win });
            }
        }, { parentWin: win });
    }

    async function renameItem(oldKey, newKey) {
        if (!newKey || oldKey === newKey) return refresh(false);

        if (isProtected(currentStore, oldKey)) {
            return window.nexser?.windowAPI.errorWindow(`'${oldKey}' はシステム保護された項目のため、名前を変更できません。`, { parentWin: win });
        }

        if (isProtected(currentStore, newKey)) {
            return window.nexser?.windowAPI.errorWindow(`'${newKey}' はシステム予約済みの名前です。この名前に変更することはできません。`, { parentWin: win });
        }

        try {
            if (currentStore === "kv") {
                const res = await sendWorkerRequest({
                    action: "kvRenameNode",
                    currentPath: [...currentPath],
                    oldKey,
                    newKey
                });
                if (!res.success) throw new Error(res.error);
                syncMemoryFS("rename", oldKey, { newKey });
            } else {
                const db = await getDB();
                const tx = db.transaction(currentStore, "readwrite");
                const store = tx.objectStore(currentStore);

                const existing = await store.count(newKey);
                if (existing > 0) {
                    window.nexser?.windowAPI.errorWindow(`Error: "${newKey}" already exists.`, { parentWin: win });
                    return refresh(false);
                }

                const val = await new Promise((resolve, reject) => {
                    const req = store.get(oldKey);
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => reject(req.error);
                });

                await store.put(val, newKey);
                await store.delete(oldKey);

                await new Promise((resolve) => {
                    tx.oncomplete = resolve;
                    tx.onerror = () => { throw tx.error; };
                });
            }

            notifySystemChange(currentStore, oldKey);
            notifySystemChange(currentStore, newKey);
            selectedKey = newKey;
            refresh(true);
        } catch (e) {
            console.error("Rename failed:", e);
            window.nexser?.windowAPI.errorWindow("Rename failed: " + e.message, { parentWin: win });
            refresh(false);
        }
    }

    function enterEditMode(keyStr, targetCol) {
        if (editingKey) return;

        const tr = rowMap.get(keyStr);
        if (!tr) return;

        const val = tr._val;
        if (targetCol === "data") {
            if (val instanceof Blob || val?.__IS_CHUNKED__ || val?.content === "__EXTERNAL_DATA__") {
                return window.nexser?.windowAPI.alertWindow("外部保存・バイナリデータ (REG_BINARY / EXTERNAL) の直接編集はサポートされていません。", { parentWin: win });
            }
            if (val?._truncated) {
                return window.nexser?.windowAPI.alertWindow("データサイズが大きいため省略表示されています。破損防止のため直接編集は無効化されています。", { parentWin: win });
            }
        }

        editingKey = keyStr;
        const td = targetCol === "name" ? tr.children[0] : tr.children[2];
        const originalText = targetCol === "name" ? keyStr : (typeof val === 'object' ? JSON.stringify(val) : String(val));

        td.innerHTML = "";
        const input = document.createElement("input");
        input.type = "text";
        input.value = originalText;
        input.style.cssText = "width:100%; height:100%; border:1px solid #000; outline:none; font-size:12px; font-family:inherit; position:absolute; left:0; top:0; z-index:20; background:#fff; color:#000; padding:1px 2px;";
        td.appendChild(input);
        input.focus();
        input.select();

        let isDone = false;
        const finish = async (apply) => {
            if (isDone) return;
            isDone = true;
            const newValue = input.value.trim();
            input.remove();
            editingKey = null;

            if (apply && newValue !== originalText) {
                if (targetCol === "name") {
                    await renameItem(tr._key, newValue);
                } else {
                    await saveItem(tr._key, newValue);
                }
            } else {
                refresh(false);
            }
            mainView.focus();
        };

        input.onblur = () => finish(true);
        input.onkeydown = (e) => {
            if (e.key === "Enter") { e.preventDefault(); finish(true); }
            if (e.key === "Escape") { e.preventDefault(); finish(false); }
        };
    }

    async function createNew(type = "REG_SZ") {
        try {
            let targetKey = "New Value";

            if (currentStore === "kv") {
                const res = await sendWorkerRequest({
                    action: "kvCreateNode",
                    currentPath: [...currentPath],
                    valueType: type
                });
                if (!res.success) throw new Error(res.error);
                targetKey = res.createdKey;

                if (currentPath.length > 0) {
                    const initMeta = type === "REG_FOLDER"
                        ? { type: "folder", lastModified: Date.now() }
                        : { type: "file", content: "", size: 0, lastModified: Date.now() };
                    syncMemoryFS("create", targetKey, { value: initMeta });
                }
            } else {
                let newKeyBase = "New Value";
                let newKey = newKeyBase;
                let counter = 1;

                const db = await getDB();
                const txRead = db.transaction(currentStore, "readonly");
                const store = txRead.objectStore(currentStore);

                const allKeysArray = await new Promise((resolve, reject) => {
                    const request = store.getAllKeys();
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });

                const existingKeys = new Set(allKeysArray.map(String));

                while (existingKeys.has(newKey) || isProtected(currentStore, newKey)) {
                    newKey = `${newKeyBase} #${counter++}`;
                }

                targetKey = String(newKey);
                let initialValue = "";
                if (type === "REG_DWORD") initialValue = 0;
                if (type === "REG_JSON") initialValue = {};

                const txWrite = db.transaction(currentStore, "readwrite");
                await txWrite.objectStore(currentStore).put(initialValue, targetKey);
                await txWrite.done;
            }

            notifySystemChange(currentStore, targetKey);
            await refresh(true);

            requestAnimationFrame(() => {
                selectRow(targetKey);
                enterEditMode(targetKey, "name");
            });

        } catch (e) {
            console.error("Create failed:", e);
            window.nexser?.windowAPI.errorWindow("作成に失敗しました: " + e.message, { parentWin: win });
        }
    }

    async function exportRegistry() {
        const loadingEl = root.querySelector("#reg-loading");
        if (loadingEl) {
            loadingEl.textContent = `Exporting ${currentStore}...`;
            loadingEl.style.display = "flex";
        }

        const workerInstance = getWorker();

        try {
            const result = await new Promise((resolve, reject) => {
                const handleMessage = (e) => {
                    if (e.data.action === 'export') {
                        workerInstance.removeEventListener('message', handleMessage);
                        resolve(e.data);
                    }
                };
                const handleError = (err) => {
                    workerInstance.removeEventListener('error', handleError);
                    reject(err);
                };

                workerInstance.addEventListener('message', handleMessage);
                workerInstance.addEventListener('error', handleError);

                workerInstance.postMessage({
                    action: 'export',
                    storeName: currentStore
                });
            });

            if (!result.success) throw new Error(result.error);

            const url = URL.createObjectURL(result.blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `nexser_${currentStore}_backup.json.gz`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error("[Registry] Export failed:", e);
            window.nexser?.windowAPI.errorWindow("Export failed: " + e.message, { parentWin: win });
        } finally {
            if (loadingEl) {
                loadingEl.textContent = "Loading...";
                loadingEl.style.display = "none";
            }
        }
    }

    async function exportAllRegistry() {
        const loadingEl = root.querySelector("#reg-loading");
        if (loadingEl) {
            loadingEl.textContent = "Exporting all stores (split & compressed)...";
            loadingEl.style.display = "flex";
        }

        const workerInstance = getWorker();

        try {
            const result = await new Promise((resolve, reject) => {
                const handleMessage = (e) => {
                    if (e.data.action === 'exportAll') {
                        workerInstance.removeEventListener('message', handleMessage);
                        resolve(e.data);
                    }
                };
                const handleError = (err) => {
                    workerInstance.removeEventListener('error', handleError);
                    reject(err);
                };

                workerInstance.addEventListener('message', handleMessage);
                workerInstance.addEventListener('error', handleError);

                workerInstance.postMessage({
                    action: 'exportAll',
                    storeNames: STORE_NAMES
                });
            });

            if (!result.success) throw new Error(result.error);

            for (const [sName, blob] of Object.entries(result.results)) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `nexser_${sName}_backup.json.gz`;
                a.click();
                URL.revokeObjectURL(url);
                await new Promise(r => setTimeout(r, 300));
            }
            window.nexser?.windowAPI.alertWindow("すべての日付ストアの分割エクスポートが完了しました。", { parentWin: win });
        } catch (e) {
            console.error("[Registry] Export All failed:", e);
            window.nexser?.windowAPI.errorWindow("Export All failed: " + e.message, { parentWin: win });
        } finally {
            if (loadingEl) {
                loadingEl.textContent = "Loading...";
                loadingEl.style.display = "none";
            }
        }
    }

    async function importRegistry() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json.gz,.json";
        input.multiple = true;

        input.onchange = async (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;

            const loadingEl = root.querySelector("#reg-loading");
            if (loadingEl) {
                loadingEl.textContent = "Importing data...";
                loadingEl.style.display = "flex";
            }

            try {
                const importPayloads = [];

                for (const file of files) {
                    let targetStore = currentStore;
                    for (const name of STORE_NAMES) {
                        if (file.name.includes(name)) {
                            targetStore = name;
                            break;
                        }
                    }

                    const arrayBuffer = await file.arrayBuffer();
                    const blob = new Blob([arrayBuffer]);
                    importPayloads.push({ storeName: targetStore, blob });
                }

                const workerInstance = getWorker();
                const result = await new Promise((resolve, reject) => {
                    const handleMessage = (e) => {
                        if (e.data.action === 'import') {
                            workerInstance.removeEventListener('message', handleMessage);
                            resolve(e.data);
                        }
                    };
                    const handleError = (err) => {
                        workerInstance.removeEventListener('error', handleError);
                        reject(err);
                    };

                    workerInstance.addEventListener('message', handleMessage);
                    workerInstance.addEventListener('error', handleError);

                    workerInstance.postMessage({
                        action: 'import',
                        importPayloads: importPayloads
                    });
                });

                if (!result.success) throw new Error(result.error);

                await refresh(true);
                window.nexser?.windowAPI.alertWindow("すべてのファイルのインポートが正常に完了しました。", { parentWin: win });
            } catch (err) {
                console.error("[Registry] Import failed:", err);
                window.nexser?.windowAPI.errorWindow("バックアップファイルのインポートに失敗しました: " + err.message, { parentWin: win });
            } finally {
                if (loadingEl) {
                    loadingEl.textContent = "Loading...";
                    loadingEl.style.display = "none";
                }
            }
        };
        input.click();
    }

    async function refresh(forceReset = false) {
        if (!document.body.contains(root)) return;

        const requestId = ++currentRequestId;
        const snapshotStore = currentStore;
        const snapshotPath = [...currentPath];
        isProcessing = true;

        const loadingEl = root.querySelector("#reg-loading");
        if (loadingEl) loadingEl.style.display = "flex";

        if (forceReset) {
            bodyEl.innerHTML = "";
            rowMap.clear();
        }

        const workerInstance = getWorker();

        try {
            const result = await new Promise((resolve, reject) => {
                const handleMessage = (e) => {
                    // ⭐ リクエストID（requestId）が完全に一致するものだけを受け取る（他の処理との混信を防止）
                    if (e.data.action === 'fetch' && e.data.requestId === requestId) {
                        workerInstance.removeEventListener('message', handleMessage);
                        resolve(e.data);
                    }
                };
                const handleError = (err) => {
                    workerInstance.removeEventListener('error', handleError);
                    reject(err);
                };

                workerInstance.addEventListener('message', handleMessage);
                workerInstance.addEventListener('error', handleError);

                workerInstance.postMessage({
                    action: 'fetch',
                    requestId: requestId, // ⭐ ワーカーへリクエストIDを送信
                    storeName: currentStore,
                    currentPath: snapshotPath,
                    searchTerm: searchTerm,
                    maxVisibleItems: MAX_VISIBLE_ITEMS
                });
            });

            if (!result.success) throw new Error(result.error);
            // 途中で別のフォルダに移動していたり、リクエストが古くなっている場合は描画を破棄
            if (requestId !== currentRequestId || currentStore !== snapshotStore) return;

            const items = result.items || [];
            const dbKeys = new Set(items.map(i => i.keyStr));
            const visibleKeys = new Set();
            const fragment = document.createDocumentFragment();

            items.forEach(item => {
                visibleKeys.add(item.keyStr);
                updateRow(item.key, item.keyStr, item.value, fragment);
            });

            if (fragment.children.length > 0) {
                bodyEl.appendChild(fragment);
            }

            for (const [k, tr] of rowMap) {
                if (!dbKeys.has(k) || !visibleKeys.has(k)) {
                    if (editingKey !== k) {
                        tr.remove();
                        rowMap.delete(k);
                    }
                }
            }

            if (win && win._statusBar) {
                const hkeyName = Object.keys(HKEY_MAPPING).find(k => HKEY_MAPPING[k] === currentStore) || currentStore;
                const pathStr = snapshotPath.length > 0 ? `\\${snapshotPath.join("\\")}` : "";
                win._statusBar.textContent = `コンピューター\\${hkeyName}${pathStr}`;
            }

        } catch (err) {
            console.error("[Registry Debug] refresh error caught:", err);
        } finally {
            if (requestId === currentRequestId) {
                isProcessing = false;
                if (loadingEl) loadingEl.style.display = "none";
            }
        }
    }

    function updateRow(key, keyStr, val, fragment = null) {
        let tr = rowMap.get(keyStr);
        if (!tr) {
            tr = document.createElement("tr");
            tr.style.cursor = "default";
            // ⭐ 修正: td自体には overflow: hidden を持たせず、中に div を挟む
            tr.innerHTML = `
            <td style="border-right:1px solid gray; padding:0; position:relative;">
                <div style="padding:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%; box-sizing:border-box;"></div>
            </td>
            <td style="border-right:1px solid gray; padding:0; position:relative;">
                <div style="padding:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%; box-sizing:border-box; color:#666;"></div>
            </td>
            <td style="padding:0; position:relative;">
                <div style="padding:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%; box-sizing:border-box;"></div>
            </td>
        `;

            attachContextMenu(tr, (e) => {
                if (selectedKey !== keyStr) {
                    selectRow(keyStr);
                }
                const isFsNode = tr._val && typeof tr._val === "object" && ["app", "file", "folder"].includes(tr._val.type);
                const menuItems = [];

                if (isFsNode) {
                    menuItems.push({ label: "Open / 実行", action: () => openRegistryItem(tr._key, tr._val) });
                }

                menuItems.push(
                    { label: "Modify", action: () => enterEditMode(tr._key, "data") },
                    { label: "Rename", action: () => enterEditMode(tr._key, "name") },
                    { label: "Delete", action: () => deleteItem(tr._key) }
                );
                return menuItems;
            });

            tr.ondblclick = () => openRegistryItem(tr._key, tr._val);
            tr.onclick = () => selectRow(keyStr);

            if (fragment) {
                fragment.appendChild(tr);
            } else if (!tr.parentElement) {
                bodyEl.appendChild(tr);
            }
            rowMap.set(keyStr, tr);
        }

        tr._key = key;
        tr._val = val;
        if (editingKey !== keyStr) {
            let typeStr = "REG_SZ";
            let displayVal = "";

            if (typeof val === 'number') {
                typeStr = "REG_DWORD";
                const hex = "0x" + val.toString(16).padStart(8, '0');
                displayVal = `${hex} (${val})`;
            } else if (val instanceof Blob) {
                typeStr = "REG_BINARY";
                displayVal = `バイナリ データ (${val.size} バイト)`;
            } else if (Array.isArray(val)) {
                typeStr = "REG_MULTI_SZ";
                displayVal = val.join(" ");
            } else if (typeof val === 'object' && val !== null) {
                if (val.__IS_CHUNKED__) {
                    typeStr = "REG_CHUNKED";
                    displayVal = `[分割データ] ${val.totalChunks} チャンク (${val.dataType || "binary"})`;
                } else if (val.type === "file") {
                    typeStr = "REG_FILE";
                    displayVal = `[ファイル] ${val.content ? String(val.content).substring(0, 60) + "..." : "(空)"}`;
                } else if (val.type === "app") {
                    typeStr = "REG_APP";
                    displayVal = `[アプリ] エントリ: ${val.entry}`;
                } else if (val.type === "folder") {
                    typeStr = "REG_FOLDER";
                    displayVal = `[フォルダ]`;
                } else if (val.type === "link") {
                    typeStr = "REG_LINK";
                    displayVal = `[ショートカット] -> ${val.target || ""}`;
                } else {
                    typeStr = "REG_JSON";
                    displayVal = JSON.stringify(val);
                }
            } else {
                typeStr = "REG_SZ";
                displayVal = String(val ?? "(値の設定なし)");
            }

            const displayName = (keyStr === "" || keyStr === "(Default)") ? "(既定)" : keyStr;

            // 編集モード（enterEditMode）で内部のdivが消去されていた場合は再生成する
            const cellStyles = [
                "padding:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%; box-sizing:border-box;",
                "padding:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%; box-sizing:border-box; color:#666;",
                "padding:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%; box-sizing:border-box;"
            ];
            const cellTexts = [displayName, typeStr, displayVal.substring(0, 120)];

            Array.from(tr.children).forEach((td, idx) => {
                let innerDiv = td.firstElementChild;
                if (!innerDiv || innerDiv.tagName !== "DIV") {
                    td.innerHTML = "";
                    innerDiv = document.createElement("div");
                    innerDiv.style.cssText = cellStyles[idx];
                    td.appendChild(innerDiv);
                }
                innerDiv.textContent = cellTexts[idx];
            });
        }

        applyRowSelectionStyle(tr, selectedKey === keyStr);
    }

    function applyRowSelectionStyle(tr, isSelected) {
        tr.style.background = isSelected ? "#000080" : "";
        tr.style.color = isSelected ? "#fff" : "";

        Array.from(tr.children).forEach((td, idx) => {
            td.style.background = isSelected ? "#000080" : "";
            const innerDiv = td.firstElementChild;
            if (innerDiv) {
                innerDiv.style.color = isSelected ? "#fff" : (idx === 1 ? "#666" : "");
            }
        });
    }

    function selectRow(keyStr) {
        selectedKey = keyStr;
        for (const [k, tr] of rowMap) {
            applyRowSelectionStyle(tr, k === keyStr);
        }
    }

    if (win) {
        setupRibbon(win, () => `My Computer\\${currentStore}`, () => refresh(true), [
            {
                title: "File",
                items: [
                    { label: "Import...", action: () => importRegistry() },
                    { label: "Export (Current)...", action: () => exportRegistry() },
                    { label: "Export All (Split)...", action: () => exportAllRegistry() },
                    {
                        label: "Exit",
                        action: () => {
                            if (win) {
                                if (win._destroy) {
                                    win._destroy();
                                } else {
                                    win.remove();
                                    const btn = win._taskbarBtn;
                                    if (btn) {
                                        btn.remove();
                                        const idx = taskbarButtons.indexOf(btn);
                                        if (idx !== -1) taskbarButtons.splice(idx, 1);
                                    }
                                }
                            }
                        }
                    }
                ]
            },
            {
                title: "Edit",
                items: [
                    { label: "New Folder (Key)", action: () => createNew("REG_FOLDER") },
                    { label: "New String Value", action: () => createNew("REG_SZ") },
                    { label: "New DWORD Value", action: () => createNew("REG_DWORD") },
                    { label: "New JSON Value", action: () => createNew("REG_JSON") },
                    { label: "Modify", action: () => { if (selectedKey) enterEditMode(selectedKey, "data"); } },
                    { label: "Rename", action: () => { if (selectedKey) enterEditMode(selectedKey, "name"); } },
                    { label: "Delete", action: () => { if (selectedKey) deleteItem(selectedKey); } },
                    { label: "Refresh", action: () => refresh(true) }
                ]
            }
        ]);
    }

    mainView.onkeydown = (e) => {
        if (editingKey) return;

        const visibleKeys = Array.from(rowMap.keys());
        if (visibleKeys.length === 0) return;

        let currentIndex = visibleKeys.indexOf(selectedKey);

        switch (e.key) {
            case "F5":
                e.preventDefault();
                refresh(true);
                break;
            case "ArrowDown":
            case "ArrowUp": {
                e.preventDefault();
                const isDown = e.key === "ArrowDown";
                const targetIdx = isDown
                    ? Math.min(currentIndex + 1, visibleKeys.length - 1)
                    : Math.max(currentIndex - 1, 0);

                const targetKey = visibleKeys[targetIdx];
                if (targetKey) {
                    selectRow(targetKey);
                    rowMap.get(targetKey)?.scrollIntoView({ block: "nearest" });
                }
                break;
            }
            case "ArrowLeft":
                e.preventDefault();
                selectRow(null);
                treeContainer.focus();
                break;
            case "Delete":
                if (selectedKey) deleteItem(selectedKey);
                break;
            case "Enter":
                if (selectedKey) enterEditMode(selectedKey, "data");
                break;
        }
    };

    const HKEY_MAPPING = {
        "HKEY_CLASSES_ROOT": "files",
        "HKEY_CURRENT_USER": "settings",
        "HKEY_LOCAL_MACHINE": "kv",
        "HKEY_USERS": "recent",
        "HKEY_CURRENT_CONFIG": "window-size"
    };


    async function loadSubTree(storeName, currentPathArr, parentUl) {
        parentUl.innerHTML = '<li style="color:#666; padding-left:10px;">Loading...</li>';
        const reqId = ++treeRequestId; // ⭐ 追加：一意のリクエストIDを生成

        const subFolders = new Set();
        const db = await getDB();
        const workerInstance = getWorker();

        try {
            if (storeName === "kv") {
                // --- 1. kvストア（ファイルシステム）の場合：ワーカー経由で安全にノードを取得 ---
                const result = await new Promise((resolve, reject) => {
                    const handleMessage = (e) => {
                        if (e.data.action === 'getSubTree' && e.data.storeName === storeName && e.data.requestId === reqId) {
                            workerInstance.removeEventListener('message', handleMessage);
                            console.log("[MainThread] getSubTree response received:", e.data); // ⭐ 追加
                            resolve(e.data);
                        }
                    };
                    workerInstance.addEventListener('message', handleMessage);
                    workerInstance.postMessage({
                        action: 'getSubTree',
                        requestId: reqId,
                        storeName: storeName,
                        currentPath: currentPathArr
                    });
                });

                if (result.success && result.subFolders) {
                    result.subFolders.forEach(folderName => subFolders.add(folderName));
                }
            } else {
                // --- 2. その他のストア（settings, files等）の場合：getAllKeys() を使用 ---
                const tx = db.transaction(storeName, "readonly");
                const store = tx.objectStore(storeName);

                const keys = await new Promise((resolve) => {
                    const req = store.getAllKeys();
                    req.onsuccess = () => resolve(req.result || []);
                    req.onerror = () => resolve([]);
                });

                // ⭐ 修正: filesストア（HKEY_CLASSES_ROOT）はパス区切りが "/" なので、ストアに応じて切り替える
                const delimiter = storeName === "files" ? "/" : ".";
                const prefix = currentPathArr.join(delimiter);

                const isFilesStore = storeName === "files";
                for (const k of keys) {
                    const keyStr = String(k);
                    if (isFilesStore && keyStr.includes("/__chunk_")) continue;

                    let relativePath = keyStr;

                    if (prefix) {
                        const checkPrefix = prefix + delimiter;
                        if (!keyStr.startsWith(checkPrefix)) continue;
                        relativePath = keyStr.substring(checkPrefix.length);
                    }

                    if (relativePath) {
                        const parts = isFilesStore ? relativePath.split("/") : relativePath.split(/[\.\/]/);
                        // files ストアはファイル葉ノードをツリーフォルダとして展開しない
                        if (isFilesStore && parts.length <= 1) continue;

                        const folderName = parts[0];
                        if (folderName) {
                            subFolders.add(folderName);
                        }
                    }
                }
            }
        } catch (err) {
            console.error("[Registry] loadSubTree error:", err);
        }

        parentUl.innerHTML = "";

        if (subFolders.size === 0) {
            parentUl.innerHTML = '<li style="color:#808080; padding-left:10px;">(空)</li>';
            return;
        }

        for (const folderName of subFolders) {
            const li = document.createElement("li");
            li.tabIndex = 0;
            li.style.cssText = "cursor:pointer; padding:1px 0; white-space:nowrap; outline:none; display:inline-block; min-width:100%;";

            const nextPathArr = [...currentPathArr, folderName];
            li.innerHTML = `<span class="toggle" style="display:inline-block; width:12px; text-align:center;">▶</span> ${getIcon(folderName, { type: "folder" })} ${folderName}`;

            const subUl = document.createElement("ul");
            subUl.style.cssText = "list-style:none; padding-left:15px; display:none; margin:0;";

            li.onclick = async (e) => {
                e.stopPropagation();
                currentStore = storeName;
                currentPath = nextPathArr;
                selectedKey = null;
                editingKey = null;

                const isExpanded = subUl.style.display === "block";
                if (!isExpanded && subUl.children.length === 0) {
                    // ⭐ フォルダが展開されたタイミングでのみ子階層を動的ロード
                    await loadSubTree(storeName, nextPathArr, subUl);
                }

                subUl.style.display = isExpanded ? "none" : "block";
                li.children[0].textContent = isExpanded ? "▶" : "▼";

                highlightTreeItem(li);
                refresh(true);
            };

            li.appendChild(subUl);
            parentUl.appendChild(li);
        }
    }

    async function buildTree() {
        treeEl.innerHTML = "";
        const db = await getDB();

        const computerLi = document.createElement("li");
        computerLi.innerHTML = `<span class="toggle">▼</span> ${getIcon("Computer", { type: "folder" })} コンピューター`;
        const rootUl = document.createElement("ul");
        rootUl.style.cssText = "list-style:none; padding-left:15px; display:block; margin:0;";

        for (const [hkeyName, storeName] of Object.entries(HKEY_MAPPING)) {
            const storeLi = document.createElement("li");
            storeLi.tabIndex = 0;
            storeLi.style.cssText = "cursor:pointer; padding:2px 0; white-space:nowrap; outline:none; display:inline-block; min-width:100%;";

            storeLi.innerHTML = `<span class="toggle" style="display:inline-block; width:12px; text-align:center;">▶</span> ${getIcon(hkeyName, { type: "folder" })} ${hkeyName}`;

            const ul = document.createElement("ul");
            ul.style.cssText = "list-style:none; padding-left:15px; display:none; margin:0;";

            storeLi.onclick = async (e) => {
                e.stopPropagation();
                currentStore = storeName;
                currentPath = [];
                selectedKey = null;
                editingKey = null;

                const isExpanded = ul.style.display === "block";
                if (!isExpanded && ul.children.length === 0) {
                    // ⭐ HKEYがクリックされたときのみトップレベルをロード
                    await loadSubTree(storeName, [], ul);
                }

                ul.style.display = isExpanded ? "none" : "block";
                storeLi.children[0].textContent = isExpanded ? "▶" : "▼";

                highlightTreeItem(storeLi);
                refresh(true);
            };

            storeLi.appendChild(ul);
            rootUl.appendChild(storeLi);
        }
        computerLi.appendChild(rootUl);
        treeEl.appendChild(computerLi);
    }

    function highlightTreeItem(targetLi) {
        treeEl.querySelectorAll("li").forEach(li => {
            li.style.background = "";
            li.style.color = "";
        });
        targetLi.style.background = "#000080";
        targetLi.style.color = "#fff";
    }

    const treeContainer = root.querySelector("#reg-tree-container");

    treeContainer.onkeydown = (e) => {
        const activeEl = document.activeElement;
        if (e.key === "ArrowRight") {
            e.preventDefault();
            const toggle = activeEl?.querySelector(".toggle");
            const subUl = activeEl?.querySelector("ul");
            if (subUl && subUl.style.display === "none") {
                subUl.style.display = "block";
                if (toggle) toggle.textContent = "▼";
            } else if (subUl && subUl.children.length > 0) {
                subUl.children[0].focus?.();
            } else {
                mainView.focus();
                const visibleKeys = Array.from(rowMap.keys());
                if (visibleKeys.length > 0) selectRow(visibleKeys[0]);
            }
        } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            const subUl = activeEl?.querySelector("ul");
            const toggle = activeEl?.querySelector(".toggle");
            if (subUl && subUl.style.display === "block") {
                subUl.style.display = "none";
                if (toggle) toggle.textContent = "▶";
            } else {
                activeEl?.parentElement?.closest("li")?.focus?.();
            }
        }
    };

    let searchTimeout;
    searchInput.oninput = (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            searchTerm = e.target.value;
            refresh(true);
        }, 250);
    };

    buildTree();
    refresh();

    async function openRegistryItem(key, val) {
        if (!val) return enterEditMode(key, "data");

        if (val instanceof Blob) {
            const url = URL.createObjectURL(val);
            window.nexser?.windowAPI.alertWindow(`<div style="text-align:center;"><img src="${url}" style="max-width:100%; max-height:250px; object-fit:contain;"/><p style="margin-top:8px;">サイズ: ${val.size} バイト</p></div>`, { title: `プレビュー: ${key}`, parentWin: win });
            return;
        }

        if (typeof val === "object" && val !== null && !val.type) {
            const jsonStr = JSON.stringify(val, null, 2);
            window.nexser?.windowAPI.alertWindow(`<pre style="max-height:300px; overflow:auto; font-family:monospace; margin:0; background:#fff; padding:4px;">${jsonStr}</pre>`, { title: `JSONビュー: ${key}`, parentWin: win });
            return;
        }

        if (typeof val !== "object") {
            enterEditMode(key, "data");
            return;
        }

        switch (val.type) {
            case "app": {
                try {
                    const appModule = await import(val.entry);
                    appModule.default?.();
                } catch (err) {
                    window.nexser?.windowAPI.errorWindow(`Failed to launch app: ${err.message}`, { parentWin: win });
                }
                break;
            }
            case "file": {
                let contentToShow = val.content;
                if (contentToShow === "__EXTERNAL_DATA__") {
                    try {
                        const rawFullPath = [...currentPath, key].join("/");
                        const fullPath = rawFullPath.startsWith("C:") ? rawFullPath : `C:/${rawFullPath}`;
                        // getFileContent を使用して分割チャンク（__IS_CHUNKED__）も自動結合して取得
                        const fileData = await getFileContent(fullPath);

                        if (fileData instanceof Blob) {
                            const url = URL.createObjectURL(fileData);
                            window.nexser?.windowAPI.alertWindow(`<div style="text-align:center;"><img src="${url}" style="max-width:100%; max-height:250px; object-fit:contain;"/><p style="margin-top:8px;">サイズ: ${fileData.size} バイト</p></div>`, { title: `ファイル: ${key}`, parentWin: win });
                            return;
                        } else if (typeof fileData === "string") {
                            contentToShow = fileData;
                        } else {
                            contentToShow = "(外部バイナリデータまたは読み込み不可)";
                        }
                    } catch (e) {
                        contentToShow = "(外部データの読み込みに失敗しました)";
                    }
                }

                window.nexser?.windowAPI.alertWindow(`[File Content: ${key}]\n\n${contentToShow || "(空のファイルです)"}`, { parentWin: win });
                break;
            }
            case "folder": {
                const rawFolderPath = [...currentPath, key].join("/");
                const targetFolderPath = rawFolderPath.startsWith("C:") ? rawFolderPath : `C:/${rawFolderPath}`;
                window.nexser?.kernelAPI.launch("C:/Programs/Applications/Explorer.app", { path: targetFolderPath, parentCwd: "C:/" });
                break;
            }
            default: {
                enterEditMode(key, "data");
                break;
            }
        }
    }
}