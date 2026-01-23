// Settings.js
import { openDB } from "../db.js";
import { clearRecent } from "../recent.js";

const STORE = "settings";

// =========================
// DB接続の使い回し
// =========================
let dbPromise = null;
async function getDB() {
    if (!dbPromise) dbPromise = openDB();
    return dbPromise;
}

// =========================
// DB操作
// =========================
export async function saveSetting(key, value) {
    try {
        const db = await getDB();
        const tx = db.transaction(STORE, "readwrite");
        const store = tx.objectStore(STORE);

        // structuredClone で安全に保存
        store.put(structuredClone(value), key);

        // 完了を待つ
        await tx.complete;

        console.log(`Setting saved: ${key}`);
        return true;
    } catch (e) {
        console.error("saveSetting failed:", e);
        alert(`設定の保存に失敗しました: ${key}`);
        return false;
    }
}

export async function loadSetting(key) {
    try {
        const db = await getDB();
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(key);
        return await new Promise(resolve => {
            req.onsuccess = () => resolve(req.result ?? null);
            req.onerror = () => resolve(null);
        });
    } catch (e) {
        console.warn("loadSetting failed:", e);
        return null;
    }
}

// =========================
// Global Theme State
// =========================
export let themeColor = "darkblue";
const DEFAULT_COLOR = "darkblue";

loadSetting("titlebarColor").then(color => {
    if (color) {
        themeColor = color;
        refreshTopWindow();
    }
});

loadSetting("showRecentItems").then(val => {
    window.showRecent = val ?? true;
});

// =========================
// refreshTopWindow
// =========================
export function refreshTopWindow() {
    const visibleWindows = Array.from(document.querySelectorAll(".window"))
        .filter(win => win.style.visibility !== "hidden" && win.dataset.minimized !== "true");

    let topWindow = null;
    if (visibleWindows.length) {
        visibleWindows.sort((a, b) => parseInt(b.style.zIndex) - parseInt(a.style.zIndex));
        topWindow = visibleWindows[0];
    }

    document.querySelectorAll(".window .title-bar").forEach(tb => {
        tb.style.background = tb.parentElement === topWindow ? themeColor : "gray";
    });
}

// =========================
// IndexedDB 正確サイズ計算
// =========================
async function getIndexedDBSize() {
    let totalBytes = 0;
    try {
        const db = await getDB(); // 使い回し
        for (const storeName of db.objectStoreNames) {
            try {
                const tx = db.transaction(storeName, "readonly");
                const store = tx.objectStore(storeName);
                const allData = await new Promise(res => {
                    const r = store.getAll();
                    r.onsuccess = () => res(r.result || []);
                    r.onerror = () => res([]);
                });
                for (const item of allData) {
                    totalBytes += new Blob([JSON.stringify(item)]).size;
                }
            } catch (e) {
                console.warn("Object store read failed:", e);
            }
        }
    } catch (e) {
        console.warn("IndexedDB size calc failed:", e);
    }
    return totalBytes;
}

// =========================
// Settings & System Info UI
// =========================
export default async function SettingsApp(content) {
    content.innerHTML = `
        <h1 style="margin-bottom:10px;">Settings</h1>
        <div id="settings-list" style="overflow-y:auto; border:1px solid #888; padding:5px;"></div>
    `;
    const list = content.querySelector("#settings-list");

    async function renderSettings() {
        list.innerHTML = "";

        // -------------------------
        // Theme Color
        // -------------------------
        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.flexDirection = "column";
        row.style.gap = "6px";

        const label = document.createElement("span");
        label.textContent = "Top Window Titlebar Color";

        const colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.value = themeColor;
        colorInput.className = "button";
        colorInput.style.width = "60px";
        colorInput.oninput = async () => {
            themeColor = colorInput.value;
            await saveSetting("titlebarColor", themeColor);
            refreshTopWindow();
        };

        row.appendChild(label);
        row.appendChild(colorInput);

        const colors = ["#1E90FF", "#FF4500", "#32CD32", "#FFD700", "#8A2BE2", "#FF1493", "#00CED1", "#FF8C00", "#A52A2A", "#2F4F4F"];
        const btnContainer = document.createElement("div");
        btnContainer.style.display = "flex";
        btnContainer.style.flexWrap = "wrap";
        btnContainer.style.gap = "4px";

        colors.forEach(c => {
            const btn = document.createElement("button");
            btn.style.background = c;
            btn.style.width = "24px";
            btn.style.height = "24px";
            btn.style.cursor = "pointer";
            btn.onclick = async () => {
                themeColor = c;
                colorInput.value = c;
                await saveSetting("titlebarColor", themeColor);
                refreshTopWindow();
            };
            btnContainer.appendChild(btn);
        });
        row.appendChild(btnContainer);

        const resetBtn = document.createElement("button");
        resetBtn.textContent = "Reset Default";
        resetBtn.style.marginTop = "6px";
        resetBtn.style.padding = "4px 8px";
        resetBtn.onclick = async () => {
            themeColor = DEFAULT_COLOR;
            colorInput.value = DEFAULT_COLOR;
            await saveSetting("titlebarColor", themeColor);
            refreshTopWindow();
        };
        row.appendChild(resetBtn);

        list.appendChild(row);
        refreshTopWindow();

        // -------------------------
        // Reset All Settings
        // -------------------------
        const resetAll = document.createElement("button");
        resetAll.textContent = "Reset All Settings";
        resetAll.style.marginTop = "12px";
        resetAll.style.padding = "6px 10px";
        resetAll.style.background = "#933";
        resetAll.style.color = "#fff";
        resetAll.style.border = "none";
        resetAll.style.cursor = "pointer";

        resetAll.onclick = async () => {
            if (!confirm("全ての設定を初期化しますか？")) return;
            try {
                const db = await getDB();
                const tx = db.transaction(STORE, "readwrite");
                tx.objectStore(STORE).clear();
                themeColor = DEFAULT_COLOR;
                window.showRecent = true;
                refreshTopWindow();
                alert("設定を初期化しました");
                window.dispatchEvent(new Event("recent-updated"));
            } catch (e) {
                alert("初期化に失敗しました");
                console.warn(e);
            }
        };
        list.appendChild(resetAll);

        // -------------------------
        // Recent Items
        // -------------------------
        const recentRow = document.createElement("div");
        recentRow.style.marginTop = "12px";
        recentRow.style.borderTop = "1px solid #666";
        recentRow.style.paddingTop = "8px";

        const recentLabel = document.createElement("div");
        recentLabel.textContent = "Recent Items";
        recentLabel.style.fontWeight = "bold";
        recentRow.appendChild(recentLabel);

        const toggleLabel = document.createElement("label");
        toggleLabel.style.display = "flex";
        toggleLabel.style.alignItems = "center";
        toggleLabel.style.gap = "6px";

        const toggle = document.createElement("input");
        toggle.type = "checkbox";
        const savedShowRecent = await loadSetting("showRecentItems");
        toggle.checked = savedShowRecent ?? true;
        window.showRecent = toggle.checked;

        toggle.onchange = async () => {
            window.showRecent = toggle.checked;
            await saveSetting("showRecentItems", toggle.checked);
            window.dispatchEvent(new Event("recent-updated"));
        };

        toggleLabel.appendChild(toggle);
        toggleLabel.appendChild(document.createTextNode("Show Recent in Start Menu"));
        recentRow.appendChild(toggleLabel);

        const clearBtn = document.createElement("button");
        clearBtn.textContent = "Clear Recent History";
        clearBtn.style.marginTop = "6px";
        clearBtn.onclick = () => {
            if (confirm("最近使った項目を削除しますか？")) {
                clearRecent();
            }
        };
        recentRow.appendChild(clearBtn);

        list.appendChild(recentRow);

        // -------------------------
        // System Info
        // -------------------------
        const sysRow = document.createElement("div");
        sysRow.style.marginTop = "12px";
        sysRow.style.borderTop = "1px solid #666";
        sysRow.style.paddingTop = "8px";

        const sysLabel = document.createElement("div");
        sysLabel.textContent = "System Info";
        sysLabel.style.fontWeight = "bold";
        sysRow.appendChild(sysLabel);

        const sysList = document.createElement("div");
        sysList.style.display = "flex";
        sysList.style.flexDirection = "column";
        sysList.style.gap = "4px";
        sysRow.appendChild(sysList);

        list.appendChild(sysRow);

        async function renderSystemInfo() {
            sysList.innerHTML = "";

            sysList.innerHTML += `Nexser OS Version: v0.1.0<br>`;
            sysList.innerHTML += `Build Date: 2026-01-21<br>`;

            if (performance.memory) {
                const usedMB = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1);
                const totalMB = (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(1);
                sysList.innerHTML += `JS Heap: ${usedMB} / ${totalMB} MB<br>`;
            } else {
                sysList.innerHTML += `JS Heap: unknown<br>`;
            }

            const upSec = ((Date.now() - (window.bootTime || Date.now())) / 1000).toFixed(1);
            sysList.innerHTML += `Uptime: ${upSec} s<br>`;
            sysList.innerHTML += `Open Windows: ${document.querySelectorAll(".window").length}<br>`;

            const dbBytes = await getIndexedDBSize();
            let quotaMB = "unknown";
            if (navigator.storage?.estimate) {
                const est = await navigator.storage.estimate();
                let estQuotaMB = est.quota / 1024 / 1024;
                if (estQuotaMB > 6 * 1024) estQuotaMB = 6 * 1024;
                quotaMB = estQuotaMB.toFixed(1);
            }
            sysList.innerHTML += `IndexedDB: ${(dbBytes / 1024).toFixed(1)} KB / approx ${quotaMB} MB<br>`;
        }

        renderSystemInfo();
        setInterval(renderSystemInfo, 2000);
    }

    renderSettings();
}
