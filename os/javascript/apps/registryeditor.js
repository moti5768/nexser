// RegistryEditor.js
import { openDB } from "../db.js";
import { attachContextMenu } from "../context-menu.js";
import { setupRibbon } from "../ribbon.js";
import { taskbarButtons, alertWindow, errorWindow, confirmWindow } from "../window.js";

export default function RegistryEditor(root) {
    const STORE_NAMES = ["settings", "files", "kv", "recent"];
    let currentStore = STORE_NAMES[0];
    let dbPromise = null;
    let isProcessing = false;
    let searchTerm = "";
    const MAX_VISIBLE_ITEMS = 1000;

    const win = root.closest(".window");
    let editingKey = null; // インライン編集中のキーを保持

    // --- システム保護用ヘルパー ---
    function isProtected(store, key) {
        return store === "kv" && key === "fs";
    }

    async function getDB() {
        if (!dbPromise) dbPromise = openDB();
        return dbPromise;
    }

    // --- UI初期化 ---
    root.innerHTML = `
        <div class="registry-editor" style="display:flex; flex-direction:column; height:100%; font-size:12px; font-family: 'MS Sans Serif', sans-serif; background:#c0c0c0; user-select:none; position:relative;">
            <div style="padding:4px; display:flex; gap:5px; border-bottom:1px solid #808080; background:#eee; align-items:center;">
                <span>Find:</span>
                <input type="text" class="border" id="reg-search" style="flex:1; outline:none; padding:1px 3px; background:#fff;" placeholder="Search keys...">
            </div>
            <div style="display:flex; flex:1; overflow:hidden;">
                <div class="reg-left border" style="width:160px; background:#fff; overflow-y:auto; padding:4px; border-right: 1px solid #808080;">
                    <div style="font-weight:bold; margin-bottom:4px;">💻 My Computer</div>
                    <ul style="list-style:none; padding-left:15px; margin:0;" id="reg-tree"></ul>
                </div>
                
                <div style="flex:1; display:flex; flex-direction:column; overflow:hidden;">
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
    let timer = null;

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
                    if (rawVal.startsWith('{') || rawVal.startsWith('[')) {
                        try { val = JSON.parse(rawVal); } catch (e) { val = rawVal; }
                    } else if (typeof rawVal === 'string' && rawVal.trim() !== "" && !isNaN(Number(rawVal))) {
                        // 整数として扱うべきか、浮動小数点か、OSの仕様に合わせて厳密に変換
                        val = rawVal.includes('.') ? parseFloat(rawVal) : parseInt(rawVal, 10);
                    }
                }
            }

            const db = await getDB();
            const tx = db.transaction(currentStore, "readwrite");
            await tx.objectStore(currentStore).put(val, key);
            await tx.done;

            updateRow(key, String(key), val);
            setTimeout(() => refresh(false), 500);
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

        // --- 【完全ブロック】ここから ---
        // 1. 変更元が fs なら拒否
        if (isProtected(currentStore, oldKey)) {
            return errorWindow(`'${oldKey}' はシステム保護された項目のため、名前を変更できません。`, { parentWin: win });
        }

        // 2. 変更先を fs にしようとしても拒否（上書き・偽装防止）
        if (isProtected(currentStore, newKey)) {
            return errorWindow(`'${newKey}' はシステム予約済みの名前です。この名前に変更することはできません。`, { parentWin: win });
        }
        // --- 【完全ブロック】ここまで ---

        try {
            const db = await getDB();
            const tx = db.transaction(currentStore, "readwrite");
            const store = tx.objectStore(currentStore);

            // 重複チェック（既存の fs 以外のデータへの上書きも防止）
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
        };

        input.onblur = () => finish(true);
        input.onkeydown = (e) => {
            if (e.key === "Enter") { e.preventDefault(); finish(true); }
            if (e.key === "Escape") { e.preventDefault(); finish(false); } // 解除
        };
    }

    async function createNew() {
        let newKeyBase = "New Value";
        let newKey = newKeyBase;
        let counter = 1;

        try {
            const db = await getDB();

            // 1. DB全体での重複チェック（rowMapに依存しない）
            // IDBObjectStore.count() を使うと効率的です
            const checkExists = async (k) => {
                const tx = db.transaction(currentStore, "readonly");
                const count = await tx.objectStore(currentStore).count(k);
                return count > 0;
            };

            while ((await checkExists(newKey)) || isProtected(currentStore, newKey)) {
                newKey = `${newKeyBase} #${counter++}`;
            }

            const targetKey = String(newKey);

            // 2. DBへ保存
            const tx = db.transaction(currentStore, "readwrite");
            await tx.objectStore(currentStore).put("", targetKey);
            await tx.done;

            // 3. UIリフレッシュ
            // refreshがPromiseを返すなら、awaitで描画完了を確実に待てる
            await refresh(true);

            // 4. 描画完了直後に実行（setTimeout 0 または直呼び出し）
            // DOMのレンダリングを確実に待つなら requestAnimationFrame も有効
            requestAnimationFrame(() => {
                selectRow(targetKey);
                enterEditMode(targetKey, "name");
            });

        } catch (e) {
            console.error("Create failed:", e);
            errorWindow("作成に失敗しました: " + e.message, { parentWin: win });
        }
    }

    // --- インポート / エクスポート ---
    async function exportRegistry() {
        try {
            const db = await getDB();
            const tx = db.transaction(currentStore, "readonly");
            const store = tx.objectStore(currentStore);
            const allData = {};
            const request = store.openCursor();
            request.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    if (!(cursor.value instanceof Blob)) allData[cursor.key] = cursor.value;
                    cursor.continue();
                } else {
                    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `nexser_${currentStore}_backup.json`;
                    a.click();
                }
            };
        } catch (e) {
            errorWindow("Export failed.", { parentWin: win });
        }
    }

    async function importRegistry() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";
        input.onchange = async (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const data = JSON.parse(ev.target.result);
                    const db = await getDB();
                    const tx = db.transaction(currentStore, "readwrite");
                    const store = tx.objectStore(currentStore);
                    for (const [k, v] of Object.entries(data)) await store.put(v, k);
                    await tx.done;
                    refresh(true);
                    alertWindow("Import successful.", { parentWin: win });
                } catch (err) {
                    errorWindow("Invalid backup file.", { parentWin: win });
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    async function refresh(forceReset = false) {
        // 1. Promiseを返して、外部から await できるようにする
        return new Promise(async (resolve, reject) => {
            if (!document.body.contains(root) || isProcessing) return resolve();

            const snapshotStore = currentStore;
            isProcessing = true;

            try {
                const db = await getDB();
                const tx = db.transaction(currentStore, "readonly");
                const store = tx.objectStore(currentStore);

                if (forceReset) {
                    bodyEl.innerHTML = "";
                    rowMap.clear();
                }

                const dbKeys = new Set();
                const visibleKeys = new Set();
                let count = 0;

                const request = store.openCursor();
                request.onsuccess = (e) => {
                    if (currentStore !== snapshotStore) {
                        isProcessing = false;
                        return resolve();
                    }

                    const cursor = e.target.result;
                    if (cursor) {
                        const keyStr = String(cursor.key);
                        dbKeys.add(keyStr);

                        if (count < MAX_VISIBLE_ITEMS) {
                            const isMatch = !searchTerm || keyStr.toLowerCase().includes(searchTerm.toLowerCase());
                            if (isMatch) {
                                visibleKeys.add(keyStr);
                                updateRow(cursor.key, keyStr, cursor.value);
                                count++;
                            }
                        }
                        cursor.continue();
                    } else {
                        // カーソルが最後まで到達
                        for (const [k, tr] of rowMap) {
                            if (!dbKeys.has(k) || !visibleKeys.has(k)) {
                                if (editingKey !== k) {
                                    tr.remove();
                                    rowMap.delete(k);
                                }
                            }
                        }
                        isProcessing = false;
                        if (win && win._statusBar) {
                            win._statusBar.textContent = `My Computer\\${currentStore} (${dbKeys.size} items)`;
                        }
                        resolve(); // ここで完了を通知！
                    }
                };
                request.onerror = (e) => {
                    isProcessing = false;
                    reject(e);
                };
            } catch (e) {
                isProcessing = false;
                console.error("[Registry] Refresh error:", e);
                reject(e);
            }
        });
    }

    function updateRow(key, keyStr, val) {
        let tr = rowMap.get(keyStr);
        if (!tr) {
            tr = document.createElement("tr");
            tr.style.cursor = "default";
            tr.innerHTML = `
                <td style="border-right:1px solid gray; padding:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; position:relative;"></td>
                <td style="border-right:1px solid gray; padding:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#666;"></td>
                <td style="padding:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; position:relative;"></td>
            `;

            attachContextMenu(tr, () => [
                { label: "Modify", action: () => enterEditMode(keyStr, "data") },
                { label: "Rename", action: () => enterEditMode(keyStr, "name") },
                { label: "Delete", action: () => deleteItem(keyStr) }
            ]);

            tr.ondblclick = () => enterEditMode(keyStr, "data");
            tr.onclick = () => selectRow(keyStr);
            bodyEl.appendChild(tr);
            rowMap.set(keyStr, tr);
        }

        tr._val = val;
        // 編集中の場合はテキスト更新をスキップ
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
                    { label: "New Value", action: () => createNew() },
                    { label: "Modify", action: () => { if (selectedKey) enterEditMode(selectedKey, "data"); } },
                    { label: "Rename", action: () => { if (selectedKey) enterEditMode(selectedKey, "name"); } },
                    { label: "Delete", action: () => { if (selectedKey) deleteItem(selectedKey); } },
                    { label: "Refresh", action: () => refresh(true) }
                ]
            }
        ]);
    }

    mainView.onkeydown = (e) => {
        if (!selectedKey || editingKey) return;
        if (e.key === "Delete") deleteItem(selectedKey);
        if (e.key === "Enter") enterEditMode(selectedKey, "data");
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

    function startSafeTimer() {
        timer = setTimeout(async () => {
            // コンテキストメニューが開いている場合もスキップ対象に加える
            const isMenuOpen = document.querySelector('.context-menu');
            if (!editingKey && !isMenuOpen && document.visibilityState === 'visible') {
                await refresh(false);
            }
            startSafeTimer(); // 重なりを防ぐため処理完了後に再セット
        }, 5000);
    }
    startSafeTimer();

    if (win) {
        const obs = new MutationObserver(() => {
            if (!document.body.contains(win)) {
                clearInterval(timer);
                obs.disconnect();
            }
        });
        obs.observe(document.body, { childList: true });
    }
}