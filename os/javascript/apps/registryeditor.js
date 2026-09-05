// RegistryEditor.js
import { openDB } from "../db.js";
import { attachContextMenu } from "../context-menu.js";
import { setupRibbon } from "../ribbon.js";
import { taskbarButtons, alertWindow, errorWindow, confirmWindow } from "../window.js";

// 【追加】Workerの管理用
let worker = null;
function getWorker() {
    if (!worker) {
        worker = new Worker(new URL('./worker/registry.worker.js', import.meta.url), { type: 'module' });
    }
    return worker;
}

export default function RegistryEditor(root) {
    const STORE_NAMES = ["settings", "files", "kv", "recent"];
    let currentStore = STORE_NAMES[0];
    let dbPromise = null;
    let isProcessing = false;
    let searchTerm = "";
    const MAX_VISIBLE_ITEMS = 500;

    let currentRequestId = 0;

    const win = root.closest(".window");
    let editingKey = null; // インライン編集中のキーを保持

    // --- システム保護用ヘルパー ---
    function isProtected(store, key) {
        return store === "kv" && key === "fs";
    }
    function notifySystemChange(store, key) {
        if (store === "settings") {
            window.dispatchEvent(new CustomEvent("setting-changed", { detail: { key } }));
        } else if (store === "recent") {
            window.dispatchEvent(new Event("recent-updated"));
        } else if (store === "files") {
            window.dispatchEvent(new Event("fs-updated"));
        }
    }

    async function getDB() {
        if (!dbPromise) dbPromise = openDB();
        return dbPromise;
    }

    // --- UI初期化 ---
    root.innerHTML = `
        <div class="registry-editor" style="display:flex; flex-direction:column; height:100%; font-size:12px; font-family: 'MS Sans Serif', sans-serif; background:#c0c0c0; user-select:none;">
            <div style="padding:4px; display:flex; gap:5px; border-bottom:1px solid #808080; background:#eee; align-items:center;">
                <span>Find:</span>
                <input type="text" class="border" id="reg-search" style="flex:1; outline:none; padding:1px 3px; background:#fff;" placeholder="Search keys...">
            </div>
            <div style="display:flex; flex:1; overflow:hidden;">
                <div class="reg-left border" id="reg-tree-container" tabindex="0" style="width:160px; background:#fff; overflow-y:auto; padding:4px; border-right: 1px solid #808080;">
                    <div style="font-weight:bold; margin-bottom:4px;">💻 My Computer</div>
                    <ul style="list-style:none; padding-left:15px; margin:0;" id="reg-tree"></ul>
                </div>
                
                <!-- ▼ 右側エリアを position: relative にし、ここに Loading を内包 -->
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

    // スクロールバーの幅を動的に取得してヘッダーを補正する処理を追加
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

    // --- データ操作ロジック ---

    async function saveItem(key, rawVal, forcedType = null) {
        if (isProtected(currentStore, key)) {
            confirmWindow("警告: ファイルシステムの構造を直接編集すると、OSが起動しなくなる恐れがあります。本当に続行しますか？", async (result) => {
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
                catch (e) { return errorWindow("Invalid JSON format.", { parentWin: win }); }
            } else if (forcedType === "REG_DWORD") {
                val = Number(rawVal);
            } else {
                if (typeof rawVal === 'string') {
                    const trimmed = rawVal.trim();
                    const lower = trimmed.toLowerCase();

                    // 1. 真偽値 (Boolean) のチェックを追加
                    if (lower === "true") {
                        val = true;
                    } else if (lower === "false") {
                        val = false;
                    }
                    // 2. JSON (Object/Array) のチェック
                    else if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                        try { val = JSON.parse(trimmed); } catch (e) { val = trimmed; }
                    }
                    // 3. 数値 (Number) のチェック
                    else if (trimmed !== "" && !isNaN(Number(trimmed))) {
                        val = trimmed.includes('.') ? parseFloat(trimmed) : parseInt(trimmed, 10);
                    }
                }
            }

            const db = await getDB();
            const tx = db.transaction(currentStore, "readwrite");
            await tx.objectStore(currentStore).put(val, key);
            await tx.done;

            notifySystemChange(currentStore, key);

            updateRow(key, String(key), val);
        } catch (e) {
            errorWindow("保存に失敗しました: " + e.message, { parentWin: win });
        }
    }

    async function deleteItem(key) {
        if (isProtected(currentStore, key)) {
            return errorWindow(`'${key}' はシステムに必須のコンポーネントであるため、削除できません。`, { parentWin: win });
        }

        confirmWindow(`このアイテムを削除してもよろしいですか? "${key}"`, async (result) => {
            if (!result) return;
            try {
                const db = await getDB();
                const tx = db.transaction(currentStore, "readwrite");
                await tx.objectStore(currentStore).delete(key);
                notifySystemChange(currentStore, key);
                await tx.done;

                const tr = rowMap.get(String(key));
                if (tr) {
                    tr.remove();
                    rowMap.delete(String(key));
                }
                if (selectedKey === String(key)) selectedKey = null;
                refresh(false);
            } catch (e) {
                console.error("[Registry] Delete failed:", e);
                errorWindow("削除に失敗しました。", { parentWin: win });
            }
        }, { parentWin: win });
    }

    async function renameItem(oldKey, newKey) {
        if (!newKey || oldKey === newKey) return refresh(false);

        if (isProtected(currentStore, oldKey)) {
            return errorWindow(`'${oldKey}' はシステム保護された項目のため、名前を変更できません。`, { parentWin: win });
        }

        if (isProtected(currentStore, newKey)) {
            return errorWindow(`'${newKey}' はシステム予約済みの名前です。この名前に変更することはできません。`, { parentWin: win });
        }

        try {
            const db = await getDB();
            const tx = db.transaction(currentStore, "readwrite");
            const store = tx.objectStore(currentStore);

            const existing = await store.count(newKey);
            if (existing > 0) {
                errorWindow(`Error: "${newKey}" already exists.`, { parentWin: win });
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
            notifySystemChange(currentStore, oldKey);
            notifySystemChange(currentStore, newKey);
            selectedKey = newKey;
            refresh(true);
        } catch (e) {
            console.error("Rename failed:", e);
            errorWindow("Rename failed: " + e.message, { parentWin: win });
            refresh(false);
        }
    }

    // --- インライン編集モード ---
    function enterEditMode(keyStr, targetCol) {
        if (editingKey) return;

        const tr = rowMap.get(keyStr);
        if (!tr) return;

        const val = tr._val;
        if (targetCol === "data" && val instanceof Blob) {
            return alertWindow("Binary data (REG_BINARY) editing is not supported.", { parentWin: win });
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
                    await renameItem(keyStr, newValue);
                } else {
                    await saveItem(keyStr, newValue);
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
        let newKeyBase = "New Value";
        let newKey = newKeyBase;
        let counter = 1;

        try {
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

            const targetKey = String(newKey);

            let initialValue = "";
            if (type === "REG_DWORD") initialValue = 0;
            if (type === "REG_JSON") initialValue = {};

            const txWrite = db.transaction(currentStore, "readwrite");
            await txWrite.objectStore(currentStore).put(initialValue, targetKey);
            await txWrite.done;

            await refresh(true);

            requestAnimationFrame(() => {
                selectRow(targetKey);
                enterEditMode(targetKey, "name");
            });

        } catch (e) {
            console.error("Create failed:", e);
            errorWindow("作成に失敗しました: " + e.message, { parentWin: win });
        }
    }

    // --- インポート / エクスポート（Workerオフロード対応） ---
    async function exportRegistry() {
        const loadingEl = root.querySelector("#reg-loading");
        if (loadingEl) {
            loadingEl.textContent = "Exporting data...";
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
            a.download = `nexser_${currentStore}_backup.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error("[Registry] Export failed:", e);
            errorWindow("Export failed: " + e.message, { parentWin: win });
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
        input.accept = ".json";
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const loadingEl = root.querySelector("#reg-loading");
            if (loadingEl) {
                loadingEl.textContent = "Importing data...";
                loadingEl.style.display = "flex";
            }

            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const importData = JSON.parse(ev.target.result);
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
                            storeName: currentStore,
                            importData: importData
                        });
                    });

                    if (!result.success) throw new Error(result.error);

                    await refresh(true);
                    alertWindow("Import successful.", { parentWin: win });
                } catch (err) {
                    console.error("[Registry] Import failed:", err);
                    errorWindow("Invalid backup file or import failed: " + err.message, { parentWin: win });
                } finally {
                    if (loadingEl) {
                        loadingEl.textContent = "Loading...";
                        loadingEl.style.display = "none";
                    }
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    async function refresh(forceReset = false) {
        if (!document.body.contains(root)) return;

        const requestId = ++currentRequestId;
        const snapshotStore = currentStore;
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
                    // デフォルトのfetchアクションまたはアクション指定なしのメッセージを待つ
                    if (!e.data.action || e.data.action === 'fetch') {
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
                    storeName: currentStore,
                    searchTerm: searchTerm,
                    maxVisibleItems: MAX_VISIBLE_ITEMS
                });
            });

            if (requestId !== currentRequestId || currentStore !== snapshotStore) return;
            if (!result.success) throw new Error(result.error);

            const dbKeys = new Set(result.dbKeys);
            const visibleKeys = new Set();

            const fragment = document.createDocumentFragment();

            result.items.forEach(item => {
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
                win._statusBar.textContent = `My Computer\\${currentStore} (${dbKeys.size} items)`;
            }

        } catch (e) {
            console.error("[Registry] Refresh error:", e);
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
            tr.innerHTML = `
                <td style="border-right:1px solid gray; padding:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; position:relative;"></td>
                <td style="border-right:1px solid gray; padding:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#666;"></td>
                <td style="padding:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; position:relative;"></td>
            `;

            attachContextMenu(tr, (e) => {
                if (selectedKey !== keyStr) {
                    selectRow(keyStr);
                }
                return [
                    { label: "Modify", action: () => enterEditMode(keyStr, "data") },
                    { label: "Rename", action: () => enterEditMode(keyStr, "name") },
                    { label: "Delete", action: () => deleteItem(keyStr) }
                ];
            });

            tr.ondblclick = () => enterEditMode(keyStr, "data");
            tr.onclick = () => selectRow(keyStr);

            if (fragment) {
                fragment.appendChild(tr);
            } else if (!tr.parentElement) {
                bodyEl.appendChild(tr);
            }
            rowMap.set(keyStr, tr);
        }

        tr._val = val;
        if (editingKey !== keyStr) {
            let typeStr = (typeof val === 'number') ? "REG_DWORD" : (val instanceof Blob) ? "REG_BINARY" : (typeof val === 'object') ? "REG_JSON" : "REG_SZ";
            let displayVal = (val instanceof Blob) ? `[Blob: ${val.size} bytes]` : (typeof val === 'object') ? JSON.stringify(val) : String(val);

            tr.children[0].textContent = keyStr;
            tr.children[1].textContent = typeStr;
            tr.children[2].textContent = displayVal.substring(0, 100);
        }

        const isSelected = (selectedKey === keyStr);
        tr.style.background = isSelected ? "#000080" : "";
        tr.style.color = isSelected ? "#fff" : "";
    }

    function selectRow(keyStr) {
        selectedKey = keyStr;
        for (const [k, tr] of rowMap) {
            const isSelected = (k === keyStr);
            tr.style.background = isSelected ? "#000080" : "";
            tr.style.color = isSelected ? "#fff" : "";
        }
    }

    // --- イベント・リボン設定 ---
    if (win) {
        setupRibbon(win, () => `My Computer\\${currentStore}`, () => refresh(true), [
            {
                title: "File",
                items: [
                    { label: "Import...", action: () => importRegistry() },
                    { label: "Export...", action: () => exportRegistry() },
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
                selectedKey = null;
                for (const [k, tr] of rowMap) {
                    tr.style.background = "";
                    tr.style.color = "";
                }
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

    function buildTree() {
        treeEl.innerHTML = "";
        STORE_NAMES.forEach(name => {
            const li = document.createElement("li");
            li.style.cssText = "cursor:pointer; padding:2px; white-space:nowrap;";
            li.innerHTML = `📂 ${name}`;
            li.onclick = () => {
                currentStore = name;
                selectedKey = null;
                editingKey = null;
                [...treeEl.children].forEach(el => { el.style.background = ""; el.style.color = ""; });
                li.style.background = "#000080"; li.style.color = "#fff";
                refresh(true);
            };
            if (name === currentStore) { li.style.background = "#000080"; li.style.color = "#fff"; }
            treeEl.appendChild(li);
        });
    }

    const treeContainer = root.querySelector("#reg-tree-container");

    treeContainer.onkeydown = (e) => {
        const currentIndex = STORE_NAMES.indexOf(currentStore);
        let nextIndex = currentIndex;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            nextIndex = Math.min(STORE_NAMES.length - 1, currentIndex + 1);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            nextIndex = Math.max(0, currentIndex - 1);
        } else if (e.key === "Enter" || e.key === "ArrowRight") {
            e.preventDefault();
            mainView.focus();
            const visibleKeys = Array.from(rowMap.keys());
            if (visibleKeys.length > 0) {
                selectRow(visibleKeys[0]);
                rowMap.get(visibleKeys[0])?.scrollIntoView({ block: "nearest" });
            }
            return;
        } else {
            return;
        }

        if (nextIndex !== currentIndex) {
            const targetLi = treeEl.children[nextIndex];
            if (targetLi) targetLi.click();
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
}