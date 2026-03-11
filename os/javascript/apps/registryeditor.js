import { openDB } from "../db.js";
import { attachContextMenu } from "../context-menu.js";
import { setupRibbon } from "../ribbon.js";

export default function RegistryEditor(root) {
    const STORE_NAMES = ["settings", "files", "kv", "recent"];
    let currentStore = STORE_NAMES[0];
    let dbPromise = null;
    let isProcessing = false;
    let searchTerm = "";
    const MAX_VISIBLE_ITEMS = 100;

    const win = root.closest(".window");

    async function getDB() {
        if (!dbPromise) dbPromise = openDB();
        return dbPromise;
    }

    // UI初期化 (デザイン維持)
    root.innerHTML = `
        <div class="registry-editor" style="display:flex; flex-direction:column; height:100%; font-size:12px; font-family: 'MS Sans Serif', sans-serif; background:#c0c0c0; user-select:none; position:relative;">
            <div style="padding:4px; display:flex; gap:5px; border-bottom:1px solid #808080; background:#eee; align-items:center;">
                <span>Find:</span>
                <input type="text" class="border"; id="reg-search" style="flex:1; outline:none; padding:1px 3px; background:#fff;" placeholder="Search keys...">
            </div>
            <div style="display:flex; flex:1; overflow:hidden;">
                <div class="reg-left border" style="width:160px; background:#fff; overflow-y:auto; padding:4px;">
                    <div style="font-weight:bold; margin-bottom:4px;">💻 My Computer</div>
                    <ul style="list-style:none; padding-left:15px; margin:0;" id="reg-tree"></ul>
                </div>
                <div class="reg-right border" id="reg-main-view" style="flex:1; background:#fff; overflow-y:auto;" tabindex="0">
                    <table style="width:100%; border-collapse:collapse; table-layout: fixed;">
                        <thead>
                            <tr style="background:#eee; text-align:left; position:sticky; top:0; z-index:10; box-shadow: 0 1px #808080;">
                                <th style="width:30%; border-right:1px solid #ccc; padding:2px;">Name</th>
                                <th style="width:20%; border-right:1px solid #ccc; padding:2px;">Type</th>
                                <th style="width:50%; padding:2px;">Data</th>
                            </tr>
                        </thead>
                        <tbody id="reg-body"></tbody>
                    </table>
                </div>
            </div>
            <div id="reg-status" style="border:2px inset #fff; padding:2px 5px; font-size:11px; height:18px; background:#c0c0c0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;">
                My Computer\\${currentStore}
            </div>
        </div>
    `;

    const treeEl = root.querySelector("#reg-tree");
    const bodyEl = root.querySelector("#reg-body");
    const mainView = root.querySelector("#reg-main-view");
    const searchInput = root.querySelector("#reg-search");
    const statusEl = root.querySelector("#reg-status");
    const rowMap = new Map();
    let selectedKey = null;
    let timer = null;

    // --- リボンメニューのセットアップ ---
    if (win) {
        setupRibbon(
            win,
            () => `My Computer\\${currentStore}`,
            () => refresh(true),
            [
                {
                    title: "File",
                    items: [
                        { label: "Import...", action: () => importRegistry() },
                        { label: "Export...", action: () => exportRegistry() },
                        { label: "Exit", action: () => win.remove() }
                    ]
                },
                {
                    title: "Edit",
                    items: [
                        { label: "New Value", action: () => createNew() },
                        { label: "Modify", action: () => { if (selectedKey) editItem(selectedKey, rowMap.get(selectedKey)._val); } },
                        { label: "Rename", action: () => { if (selectedKey) renameItem(selectedKey); } },
                        { label: "Delete", action: () => { if (selectedKey) deleteItem(selectedKey); } },
                        { label: "Refresh", action: () => refresh(true) }
                    ]
                },
                {
                    title: "Help",
                    items: [
                        { label: "About Registry Editor", action: () => alert("Registry Editor v1.1\nIndexedDB Management Tool") }
                    ]
                }
            ]
        );
    }

    // --- データ操作ロジック ---

    async function saveItem(key, rawVal) {
        try {
            let val = rawVal;
            if (typeof rawVal === 'string') {
                if ((rawVal.startsWith('{') || rawVal.startsWith('['))) {
                    try { val = JSON.parse(rawVal); } catch (e) { }
                } else if (rawVal !== "" && !isNaN(rawVal)) {
                    val = Number(rawVal);
                }
            }
            const db = await getDB();
            const tx = db.transaction(currentStore, "readwrite");
            await tx.objectStore(currentStore).put(val, key);
            refresh(true);
        } catch (e) { console.error(e); }
    }

    async function deleteItem(key) {
        if (!confirm(`Are you sure you want to delete "${key}"?`)) return;
        try {
            const db = await getDB();
            const tx = db.transaction(currentStore, "readwrite");
            await tx.objectStore(currentStore).delete(key);
            selectedKey = null;
            refresh(true);
        } catch (e) { console.error(e); }
    }

    async function editItem(key, oldVal) {
        if (oldVal instanceof Blob) return alert("Binary data (REG_BINARY) editing is not supported.");
        const promptVal = (typeof oldVal === 'object') ? JSON.stringify(oldVal) : oldVal;
        const newVal = prompt(`Edit "${key}":`, promptVal);
        if (newVal !== null) await saveItem(key, newVal);
    }

    async function renameItem(oldKey) {
        const newKey = prompt(`Rename "${oldKey}" to:`, oldKey);
        if (!newKey || newKey === oldKey) return;

        try {
            const db = await getDB();
            const tx = db.transaction(currentStore, "readwrite");
            const store = tx.objectStore(currentStore);
            const val = await store.get(oldKey);
            await store.put(val, newKey);
            await store.delete(oldKey);
            selectedKey = newKey;
            refresh(true);
        } catch (e) { alert("Rename failed."); }
    }

    async function createNew() {
        const key = prompt("Enter new value name:");
        if (!key) return;
        if (rowMap.has(key)) return alert("Key already exists.");
        await saveItem(key, "");
    }

    // --- インポート / エクスポート ---
    async function exportRegistry() {
        try {
            const db = await getDB();
            const tx = db.transaction(currentStore, "readonly");
            const store = tx.objectStore(currentStore);
            const data = {};

            store.openCursor().onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    if (!(cursor.value instanceof Blob)) data[cursor.key] = cursor.value;
                    cursor.continue();
                } else {
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `registry_${currentStore}.json`;
                    a.click();
                }
            };
        } catch (e) { alert("Export failed."); }
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
                    for (const [k, v] of Object.entries(data)) {
                        await store.put(v, k);
                    }
                    refresh(true);
                } catch (err) { alert("Invalid JSON file."); }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    // --- UI更新 ---
    async function refresh(forceReset = false) {
        if (!document.body.contains(root) || isProcessing) return;
        isProcessing = true;

        try {
            const db = await getDB();
            const tx = db.transaction(currentStore, "readonly");
            const store = tx.objectStore(currentStore);
            if (forceReset) { bodyEl.innerHTML = ""; rowMap.clear(); }

            const activeKeys = new Set();
            let count = 0;

            const request = store.openCursor();
            request.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor && count < MAX_VISIBLE_ITEMS) {
                    const key = cursor.key;
                    const keyStr = String(key);
                    const val = cursor.value;

                    if (!searchTerm || keyStr.toLowerCase().includes(searchTerm.toLowerCase())) {
                        activeKeys.add(keyStr);
                        updateRow(key, keyStr, val);
                        count++;
                    }
                    cursor.continue();
                } else {
                    for (const [k, tr] of rowMap) {
                        if (!activeKeys.has(k)) { tr.remove(); rowMap.delete(k); }
                    }
                    isProcessing = false;
                    statusEl.textContent = `My Computer\\${currentStore}`;
                }
            };
        } catch (e) { isProcessing = false; }
    }

    function updateRow(key, keyStr, val) {
        let tr = rowMap.get(keyStr);
        if (!tr) {
            tr = document.createElement("tr");
            tr.innerHTML = `<td style="border-right:1px solid #eee; padding:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"></td>
                            <td style="border-right:1px solid #eee; padding:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#666;"></td>
                            <td style="padding:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"></td>`;

            attachContextMenu(tr, () => [
                { label: "Modify", action: () => editItem(key, tr._val) },
                { label: "Rename", action: () => renameItem(keyStr) },
                { label: "Delete", action: () => deleteItem(key) }
            ]);

            tr.ondblclick = () => editItem(key, tr._val);
            tr.onclick = () => selectRow(keyStr);
            bodyEl.appendChild(tr);
            rowMap.set(keyStr, tr);
        }

        tr._val = val; // 最新の値を保持
        let typeStr = (typeof val === 'number') ? "REG_DWORD" : (val instanceof Blob) ? "REG_BINARY" : (typeof val === 'object') ? "REG_JSON" : "REG_SZ";
        let displayVal = (val instanceof Blob) ? `[Blob: ${val.size} bytes]` : (typeof val === 'object') ? JSON.stringify(val) : String(val);

        tr.children[0].textContent = keyStr;
        tr.children[1].textContent = typeStr;
        tr.children[2].textContent = displayVal.substring(0, 100);

        if (selectedKey === keyStr) {
            tr.style.background = "#000080";
            tr.style.color = "#fff";
        }
    }

    function selectRow(keyStr) {
        selectedKey = keyStr;
        [...bodyEl.children].forEach(r => {
            const isSelected = r.children[0].textContent === keyStr;
            r.style.background = isSelected ? "#000080" : "";
            r.style.color = isSelected ? "#fff" : "";
        });
    }

    // キーボード操作の追加
    mainView.onkeydown = (e) => {
        if (!selectedKey) return;
        if (e.key === "Delete") deleteItem(selectedKey);
        if (e.key === "Enter") editItem(selectedKey, rowMap.get(selectedKey)._val);
    };

    attachContextMenu(mainView, () => [
        { label: "New Value", action: () => createNew() },
        { label: "Refresh", action: () => refresh(true) },
        { label: "Export Store...", action: () => exportRegistry() }
    ]);

    function buildTree() {
        treeEl.innerHTML = "";
        STORE_NAMES.forEach(name => {
            const li = document.createElement("li");
            li.style.cssText = "cursor:pointer; padding:2px; white-space:nowrap;";
            li.innerHTML = `📂 ${name}`;
            li.onclick = () => {
                currentStore = name;
                selectedKey = null;
                [...treeEl.children].forEach(el => { el.style.background = ""; el.style.color = ""; });
                li.style.background = "#000080"; li.style.color = "#fff";
                refresh(true);
            };
            if (name === currentStore) { li.style.background = "#000080"; li.style.color = "#fff"; }
            treeEl.appendChild(li);
        });
    }

    searchInput.oninput = (e) => { searchTerm = e.target.value; refresh(true); };

    buildTree();
    refresh();
    timer = setInterval(() => refresh(false), 3000);

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