// Settings.js
import { openDB } from "../db.js";
import { clearRecent } from "../recent.js";
import { bringToFront, createWindow } from "../window.js";

const STORE = "settings";

/* =========================
   Modal Dialog
========================= */
function showModalDialog(root, title, message, buttons = []) {
    const win = root.closest(".window");
    if (!win) return;

    bringToFront(win);

    if (!win._activeDialogs) win._activeDialogs = new Set();
    if (win._activeDialogs.has(message)) return;
    win._activeDialogs.add(message);

    win.style.pointerEvents = "none";

    const content = createWindow(title, {
        width: 320,
        height: 150,
        disableControls: true,
        hideRibbon: true,
        hideStatus: true,
        taskbar: false,
        skipSave: true,
        skipFocus: true
    });

    const dialogWin = content.parentElement;
    dialogWin.classList.add("modal-dialog");
    dialogWin.style.zIndex = parseInt(win.style.zIndex || 1) + 1000;
    dialogWin.style.pointerEvents = "all";
    dialogWin.style.position = "absolute";

    const rect = win.getBoundingClientRect();
    dialogWin.style.left = rect.left + rect.width / 2 - 160 + "px";
    dialogWin.style.top = rect.top + rect.height / 2 - 75 + "px";

    document.body.appendChild(dialogWin);

    content.innerHTML = `
        <p>${message}</p>
        <div style="text-align:center;margin-top:12px;"></div>
    `;
    const container = content.querySelector("div");

    function closeDialog(callback) {
        dialogWin.remove();
        win._activeDialogs.delete(message);
        win.style.pointerEvents = "auto";
        if (typeof callback === "function") callback();
    }

    buttons.forEach(btn => {
        const b = document.createElement("button");
        b.textContent = btn.label;
        b.style.margin = "0 4px";
        b.onclick = () => closeDialog(btn.onClick);
        container.appendChild(b);
    });

    const closeBtn = dialogWin.querySelector(".close-btn");
    if (closeBtn) closeBtn.onclick = () => closeDialog();

    const observer = new MutationObserver(() => {
        if (!document.body.contains(win)) {
            closeDialog();
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return content;
}

function showConfirm(root, message, onYes, onNo) {
    showModalDialog(root, "Confirm", message, [
        { label: "はい", onClick: onYes },
        { label: "いいえ", onClick: onNo }
    ]);
}

function showAlert(root, message) {
    showModalDialog(root, "Alert", message, [
        { label: "OK", onClick: null }
    ]);
}

/* =========================
   DB
========================= */
let dbPromise = null;
async function getDB() {
    if (!dbPromise) dbPromise = openDB();
    return dbPromise;
}

export async function saveSetting(key, value) {
    try {
        const db = await getDB();
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(structuredClone(value), key);
        await tx.complete;
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
    } catch {
        return null;
    }
}

/* =========================
   Theme / Desktop Color
========================= */
export let themeColor = "darkblue";
export let desktopColor = null;   // 未設定がデフォルト

const DEFAULT_COLOR = "darkblue";

function applyDesktopColor(color) {
    desktopColor = color;

    function tryApply() {
        const desk = document.querySelector("#desktop");
        if (!desk) {
            requestAnimationFrame(tryApply);
            return;
        }

        if (!color) {
            // 未設定 → CSSデフォルトに戻す
            desk.style.background = "";
            desk.style.backgroundImage = "";
            return;
        }

        desk.style.background = color;
        desk.style.backgroundImage = "none";
    }

    tryApply();
}

/* --- load on boot --- */
loadSetting("titlebarColor").then(color => {
    if (color) {
        themeColor = color;
        refreshTopWindow();
    }
});

loadSetting("desktopColor").then(c => {
    applyDesktopColor(c);   // nullでも呼ぶ
});

loadSetting("showRecentItems").then(val => {
    window.showRecent = val ?? true;
});

export function refreshTopWindow() {
    const visibleWindows = Array.from(document.querySelectorAll(".window"))
        .filter(win => win.style.display !== "none" && win.dataset.minimized !== "true");

    let topWindow = null;
    if (visibleWindows.length) {
        visibleWindows.sort((a, b) => parseInt(b.style.zIndex) - parseInt(a.style.zIndex));
        topWindow = visibleWindows[0];
    }

    document.querySelectorAll(".window .title-bar").forEach(tb => {
        tb.style.background =
            tb.parentElement === topWindow ? themeColor : "gray";
    });
}

/* =========================
   Utils
========================= */
async function getStoreSizes() {
    const result = {};
    try {
        const db = await getDB();

        for (const storeName of db.objectStoreNames) {
            let bytes = 0;
            const tx = db.transaction(storeName, "readonly");
            const store = tx.objectStore(storeName);

            const all = await new Promise(res => {
                const r = store.getAll();
                r.onsuccess = () => res(r.result || []);
                r.onerror = () => res([]);
            });

            for (const item of all) {
                bytes += JSON.stringify(item)?.length || 0;
            }

            result[storeName] = bytes;
        }
    } catch { }

    return result;
}

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/* =========================
   Settings App (Tabs)
========================= */
export default async function SettingsApp(content) {
    content.innerHTML = `
    <div class="win95-tab-container">
        <div id="tabs" class="win95-tabs"></div>
        <div id="tab-body" class="win95-tab-body"></div>
    </div>
`;

    const tabsEl = content.querySelector("#tabs");
    const bodyEl = content.querySelector("#tab-body");

    /* ---------- Tabs ---------- */
    const tabs = [
        { id: "appearance", label: "Appearance", render: renderAppearance },
        { id: "general", label: "General", render: renderGeneral },
        { id: "system", label: "System", render: renderSystem }
    ];

    function selectTab(id) {
        [...tabsEl.children].forEach(btn => {
            const active = btn.dataset.id === id;
            btn.classList.toggle("active", active);
            btn.classList.toggle("inactive", !active);
        });

        bodyEl._cleanup?.();
        bodyEl._cleanup = null;

        bodyEl.innerHTML = "";

        const tab = tabs.find(t => t.id === id);
        tab?.render(bodyEl);
    }

    tabs.forEach(t => {
        const btn = document.createElement("button");
        btn.textContent = t.label;
        btn.dataset.id = t.id;
        btn.className = "win95-tab inactive";   // ← 追加
        btn.onclick = () => selectTab(t.id);
        tabsEl.appendChild(btn);
    });

    selectTab("appearance");

    /* ---------- Appearance ---------- */
    function renderAppearance(root) {
        root.innerHTML = "";

        /* ---- Titlebar Color ---- */
        const block1 = document.createElement("div");
        block1.style.marginBottom = "12px";

        const label = document.createElement("div");
        label.textContent = "Top Window Titlebar Color";

        const colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.value = themeColor;
        colorInput.oninput = async () => {
            themeColor = colorInput.value;
            await saveSetting("titlebarColor", themeColor);
            refreshTopWindow();
        };

        block1.append(label, colorInput);

        const colors = ["#1E90FF", "#FF4500", "#32CD32", "#FFD700", "#8A2BE2",
            "#FF1493", "#00CED1", "#FF8C00", "#A52A2A", "#2F4F4F"];

        const palette = document.createElement("div");
        palette.style.display = "flex";
        palette.style.flexWrap = "wrap";
        palette.style.gap = "4px";

        colors.forEach(c => {
            const btn = document.createElement("button");
            btn.style.background = c;
            btn.style.width = "24px";
            btn.style.height = "24px";
            btn.onclick = async () => {
                themeColor = c;
                colorInput.value = c;
                await saveSetting("titlebarColor", themeColor);
                refreshTopWindow();
            };
            palette.appendChild(btn);
        });

        const resetBtn = document.createElement("button");
        resetBtn.textContent = "Reset Default";
        resetBtn.onclick = async () => {
            themeColor = DEFAULT_COLOR;
            colorInput.value = DEFAULT_COLOR;
            await saveSetting("titlebarColor", themeColor);
            refreshTopWindow();
        };

        block1.append(palette, resetBtn);

        /* ---- Desktop Background Color ---- */
        const block2 = document.createElement("div");
        block2.style.marginTop = "12px";

        const deskLabel = document.createElement("div");
        deskLabel.textContent = "Desktop Background Color";

        /* --- 共通処理 --- */
        const deskInput = document.createElement("input");
        deskInput.type = "color";
        deskInput.value = desktopColor || "#000000";
        deskInput.style.marginRight = "6px";

        async function setDesktopColor(color) {
            applyDesktopColor(color);
            deskInput.value = color || "#000000";
            await saveSetting("desktopColor", color);
        }

        /* --- Color Picker --- */
        deskInput.oninput = () => {
            setDesktopColor(deskInput.value);
        };

        /* --- Preset Buttons --- */
        const presetColors = [
            "#101820", // iD Desktop
            "#1E1E1E",
            "#2C2F33",
            "#003366",
            "#004400",
            "#3B2F2F",
            "#2F4F4F",
            "#4B0082",
            "#222222",
            "#000000"
        ];

        const deskPalette = document.createElement("div");
        deskPalette.style.display = "flex";
        deskPalette.style.flexWrap = "wrap";
        deskPalette.style.gap = "4px";

        presetColors.forEach(color => {
            const btn = document.createElement("button");
            btn.title = color;
            btn.style.background = color;
            btn.style.width = "24px";
            btn.style.height = "24px";
            btn.style.cursor = "pointer";

            btn.onclick = () => {
                setDesktopColor(color);
            };

            deskPalette.appendChild(btn);
        });

        /* --- Reset Button --- */
        const deskReset = document.createElement("button");
        deskReset.textContent = "Reset Desktop Color";
        deskReset.style.marginTop = "6px";
        deskReset.onclick = () => {
            setDesktopColor(null);   // CSSデフォルトに戻す
        };

        block2.append(
            deskLabel,
            deskInput,
            deskPalette,
            deskReset
        );

        root.append(block1, block2);
    }

    /* ---------- General ---------- */
    async function renderGeneral(root) {
        root.innerHTML = "";

        const resetAll = document.createElement("button");
        resetAll.textContent = "Reset All Settings";
        resetAll.style.background = "#933";
        resetAll.style.color = "#fff";

        resetAll.onclick = () => {
            showConfirm(content, "全ての設定を初期化しますか？", async () => {
                try {
                    const db = await getDB();
                    const tx = db.transaction(STORE, "readwrite");
                    tx.objectStore(STORE).clear();

                    themeColor = DEFAULT_COLOR;
                    applyDesktopColor(null);
                    await saveSetting("desktopColor", null);
                    window.showRecent = true;
                    refreshTopWindow();
                    window.dispatchEvent(new Event("recent-updated"));
                    showAlert(content, "設定を初期化しました");
                } catch {
                    showAlert(content, "初期化に失敗しました");
                }
            });
        };

        root.appendChild(resetAll);

        const toggle = document.createElement("input");
        toggle.type = "checkbox";
        toggle.checked = (await loadSetting("showRecentItems")) ?? true;

        toggle.onchange = async () => {
            window.showRecent = toggle.checked;
            await saveSetting("showRecentItems", toggle.checked);
            window.dispatchEvent(new Event("recent-updated"));
        };

        const label = document.createElement("label");
        label.append(toggle, document.createTextNode(" Show Recent in Start Menu"));

        const clearBtn = document.createElement("button");
        clearBtn.textContent = "Clear Recent History";
        clearBtn.onclick = () => {
            showConfirm(content, "最近使った項目を削除しますか？", () => {
                clearRecent();
                showAlert(content, "最近の履歴を削除しました");
            });
        };

        root.append(label, clearBtn);
    }

    /* ---------- System ---------- */
    /* ---------- System ---------- */
    function renderSystem(root) {
        root.innerHTML = "";

        const info = document.createElement("div");
        const storageBox = document.createElement("div");
        storageBox.style.marginTop = "10px";
        storageBox.style.borderTop = "1px solid #666";
        storageBox.style.paddingTop = "6px";

        root.append(info, storageBox);

        async function renderStorage() {
            storageBox.innerHTML = "<b>Storage Usage</b><br>";

            const sizes = await getStoreSizes();
            let total = 0;

            for (const [name, bytes] of Object.entries(sizes)) {
                total += bytes;

                const row = document.createElement("div");
                row.style.display = "flex";
                row.style.justifyContent = "space-between";
                row.style.alignItems = "center";

                const label = document.createElement("span");
                label.textContent = `${name}: ${formatBytes(bytes)}`;

                const clear = document.createElement("button");
                clear.textContent = "Clear";
                clear.onclick = () => {
                    showConfirm(root, `${name} を削除しますか？`, async () => {
                        const db = await getDB();
                        const tx = db.transaction(name, "readwrite");
                        tx.objectStore(name).clear();
                        renderStorage();
                    });
                };

                row.append(label, clear);
                storageBox.appendChild(row);
            }

            // 全ストアクリアボタン
            const clearAllBtn = document.createElement("button");
            clearAllBtn.textContent = "Clear All Stores";
            clearAllBtn.style.marginTop = "6px";
            clearAllBtn.style.background = "#933";
            clearAllBtn.style.color = "#fff";
            clearAllBtn.onclick = () => {
                showConfirm(root, "全てのストアを削除しますか？", async () => {
                    const db = await getDB();
                    for (const name of db.objectStoreNames) {
                        const tx = db.transaction(name, "readwrite");
                        tx.objectStore(name).clear();
                    }
                    renderStorage();
                });
            };
            storageBox.appendChild(clearAllBtn);

            // 総容量とブラウザ上限
            let quotaMB = "unknown";
            try {
                if (navigator.storage?.estimate) {
                    const est = await navigator.storage.estimate();
                    let estQuotaMB = est.quota / 1024 / 1024;
                    if (estQuotaMB > 6 * 1024) estQuotaMB = 6 * 1024; // 上限6GB固定
                    quotaMB = estQuotaMB.toFixed(1);
                }
            } catch { }

            const totalRow = document.createElement("div");
            totalRow.style.marginTop = "6px";
            totalRow.innerHTML = `<b>Total: ${formatBytes(total)} / Max approx ${quotaMB} MB</b>`;
            storageBox.appendChild(totalRow);
        }

        async function updateInfo() {
            info.innerHTML = `
            Nexser OS Version: v0.1.0<br>
            Build Date: 2026-01-21<br>
            Uptime: ${((Date.now() - (window.bootTime || Date.now())) / 1000).toFixed(1)} s<br>
            Open Windows: ${document.querySelectorAll(".window").length}<br>
        `;

            if (performance.memory) {
                info.innerHTML += `JS Heap: ${(performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1)} MB<br>`;
            }
        }

        updateInfo();
        renderStorage();

        // ✅ interval を保持
        const timer = setInterval(() => {
            updateInfo();
            renderStorage();  // 容量も定期更新
        }, 2000);

        // ✅ 後片付け関数を登録
        root._cleanup = () => {
            clearInterval(timer);
        };
    }
}