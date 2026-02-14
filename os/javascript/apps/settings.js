// Settings.js
import { openDB } from "../db.js";
import { clearRecent } from "../recent.js";
import { bringToFront, createWindow, setWindowAnimationEnabled } from "../window.js";

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
   Theme / Desktop Background
========================= */
export let themeColor = "darkblue";
export let desktopColor = null;

const DEFAULT_COLOR = "darkblue";

/**
 * 壁紙の表示形式を考慮して背景を適用する
 */
async function applyDesktopBackground() {
    const desk = document.querySelector("#desktop");
    if (!desk) return;

    const color = await loadSetting("desktopColor");
    const wpUrl = await loadSetting("wallpaperUrl");
    const wpStyle = await loadSetting("wallpaperStyle") || "fill"; // デフォルトは「画面に合わせる」

    // 初期化
    desk.style.backgroundImage = wpUrl ? `url(${wpUrl})` : "none";
    desk.style.backgroundColor = color || "";

    // スタイルに応じたCSSの切り替え
    switch (wpStyle) {
        case "center": // 中央に表示
            desk.style.backgroundSize = "auto";
            desk.style.backgroundRepeat = "no-repeat";
            desk.style.backgroundPosition = "center";
            break;
        case "tile": // 並べて表示
            desk.style.backgroundSize = "auto";
            desk.style.backgroundRepeat = "repeat";
            desk.style.backgroundPosition = "0 0";
            break;
        case "stretch": // 拡大して表示（比率無視）
            desk.style.backgroundSize = "100% 100%";
            desk.style.backgroundRepeat = "no-repeat";
            desk.style.backgroundPosition = "center";
            break;
        case "fit": // 全体を表示（比率維持・余白あり）
            desk.style.backgroundSize = "contain";
            desk.style.backgroundRepeat = "no-repeat";
            desk.style.backgroundPosition = "center";
            break;
        case "fill": // 画面いっぱいに広げる（比率維持・現在のcover）
        default:
            desk.style.backgroundSize = "cover";
            desk.style.backgroundRepeat = "no-repeat";
            desk.style.backgroundPosition = "center";
            break;
    }
}

/**
 * imageviewer.js 流用のユーティリティ
 */
async function blobToDataURL(blob) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });
}

/* --- load on boot --- */
loadSetting("titlebarColor").then(color => {
    if (color) {
        themeColor = color;
        refreshTopWindow();
    }
});

loadSetting("showRecentItems").then(val => {
    window.showRecent = val ?? true;
});

loadSetting("windowAnimationEnabled").then(v => {
    setWindowAnimationEnabled(v ?? true);
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
    // 改善点: Userタブを追加
    const tabs = [
        { id: "appearance", label: "Appearance", render: renderAppearance },
        { id: "user", label: "User", render: renderUser },
        { id: "general", label: "General", render: renderGeneral },
        { id: "system", label: "System", render: renderSystem }
    ];

    async function selectTab(id) {
        [...tabsEl.children].forEach(btn => {
            const active = btn.dataset.id === id;
            btn.classList.toggle("active", active);
            btn.classList.toggle("inactive", !active);
        });

        bodyEl._cleanup?.();
        bodyEl._cleanup = null;
        bodyEl.innerHTML = "";

        const tab = tabs.find(t => t.id === id);
        await tab?.render(bodyEl);
    }

    tabs.forEach(t => {
        const btn = document.createElement("button");
        btn.textContent = t.label;
        btn.dataset.id = t.id;
        btn.className = "win95-tab inactive";
        btn.onclick = () => selectTab(t.id);
        tabsEl.appendChild(btn);
    });

    selectTab("appearance");

    /* ---------- Appearance ---------- */
    async function renderAppearance(root) {
        root.innerHTML = "";

        /* ---- Titlebar Color ---- */
        const block1 = document.createElement("div");
        block1.style.marginBottom = "12px";
        block1.innerHTML = `<div>Top Window Titlebar Color</div>`;

        const colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.value = themeColor;
        colorInput.oninput = async () => {
            themeColor = colorInput.value;
            await saveSetting("titlebarColor", themeColor);
            refreshTopWindow();
        };

        const colors = ["#1E90FF", "#FF4500", "#32CD32", "#FFD700", "#8A2BE2",
            "#FF1493", "#00CED1", "#FF8C00", "#A52A2A", "#2F4F4F"];

        const palette = document.createElement("div");
        palette.style.display = "flex";
        palette.style.flexWrap = "wrap";
        palette.style.gap = "4px";
        palette.style.margin = "8px 0";

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

        block1.append(colorInput, palette, resetBtn);

        /* ---- Desktop Background (Color & Image) ---- */
        const block2 = document.createElement("div");
        block2.style.marginTop = "12px";
        block2.innerHTML = `<div>Desktop Background</div>`;

        // 背景色
        const deskInput = document.createElement("input");
        deskInput.type = "color";
        deskInput.value = (await loadSetting("desktopColor")) || "#000000";
        deskInput.style.marginRight = "6px";
        deskInput.style.verticalAlign = "middle";
        deskInput.oninput = async () => {
            await saveSetting("desktopColor", deskInput.value);
            applyDesktopBackground();
        };

        // ★追加: 表示形式ドロップダウン
        const styleSelect = document.createElement("select");
        styleSelect.style.verticalAlign = "middle";
        const styles = [
            { id: "fill", label: "Fill (拡大して全体)" },
            { id: "fit", label: "Fit (全体を表示)" },
            { id: "stretch", label: "Stretch (引き伸ばし)" },
            { id: "tile", label: "Tile (並べて表示)" },
            { id: "center", label: "Center (中央)" }
        ];

        const currentStyle = await loadSetting("wallpaperStyle") || "fill";
        styles.forEach(s => {
            const opt = document.createElement("option");
            opt.value = s.id;
            opt.textContent = s.label;
            if (s.id === currentStyle) opt.selected = true;
            styleSelect.appendChild(opt);
        });

        styleSelect.onchange = async () => {
            await saveSetting("wallpaperStyle", styleSelect.value);
            applyDesktopBackground();
        };

        const wpBlock = document.createElement("div");
        wpBlock.style.marginTop = "8px";

        const wpBtn = document.createElement("button");
        wpBtn.textContent = "Select Wallpaper Image...";
        wpBtn.onclick = () => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/*";
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const dataUrl = await blobToDataURL(file);
                await saveSetting("wallpaperUrl", dataUrl);
                applyDesktopBackground();
                showAlert(content, "Wallpaper updated.");
            };
            input.click();
        };

        const wpReset = document.createElement("button");
        wpReset.textContent = "Clear Image";
        wpReset.style.marginLeft = "4px";
        wpReset.onclick = async () => {
            await saveSetting("wallpaperUrl", null);
            applyDesktopBackground();
        };

        wpBlock.append(wpBtn, wpReset);
        // 背景色入力の横にセレクトボックスを並べる
        block2.append(deskInput, styleSelect, wpBlock);

        /* ---- Window Animation ---- */
        const animBlock = document.createElement("div");
        animBlock.style.marginTop = "12px";

        const animToggle = document.createElement("input");
        animToggle.type = "checkbox";
        animToggle.checked = (await loadSetting("windowAnimationEnabled")) ?? true;
        animToggle.onchange = async () => {
            setWindowAnimationEnabled(animToggle.checked);
            await saveSetting("windowAnimationEnabled", animToggle.checked);
        };

        const animLabel = document.createElement("label");
        animLabel.append(animToggle, document.createTextNode(" Enable Window Animations"));

        animBlock.appendChild(animLabel);
        root.append(block1, block2, animBlock);
    }

    /* ---------- User (New) ---------- */
    async function renderUser(root) {
        root.innerHTML = "<b>User Profile</b><hr>";

        const label = document.createElement("div");
        label.textContent = "Owner Name:";
        label.style.marginBottom = "4px";

        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.style.width = "100%";
        nameInput.style.boxSizing = "border-box";
        nameInput.value = (await loadSetting("userName")) || "Admin";

        const saveBtn = document.createElement("button");
        saveBtn.textContent = "Save Changes";
        saveBtn.style.marginTop = "8px";
        saveBtn.onclick = async () => {
            await saveSetting("userName", nameInput.value);
            window.dispatchEvent(new CustomEvent("user-profile-updated", { detail: nameInput.value }));
            showAlert(root, "User profile saved.");
        };

        root.append(label, nameInput, saveBtn);
    }

    /* ---------- General ---------- */
    async function renderGeneral(root) {
        root.innerHTML = "";

        const resetAll = document.createElement("button");
        resetAll.textContent = "Reset All Settings";
        resetAll.style.background = "#933";
        resetAll.style.color = "#fff";
        resetAll.style.marginBottom = "12px";

        resetAll.onclick = () => {
            showConfirm(content, "全ての設定を初期化しますか？", async () => {
                try {
                    const db = await getDB();
                    const tx = db.transaction(STORE, "readwrite");
                    tx.objectStore(STORE).clear();

                    themeColor = DEFAULT_COLOR;
                    await saveSetting("desktopColor", null);
                    await saveSetting("wallpaperUrl", null);
                    applyDesktopBackground();
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
        label.style.display = "block";
        label.append(toggle, document.createTextNode(" Show Recent in Start Menu"));

        const clearBtn = document.createElement("button");
        clearBtn.textContent = "Clear Recent History";
        clearBtn.style.marginTop = "8px";
        clearBtn.onclick = () => {
            showConfirm(content, "最近使った項目を削除しますか？", () => {
                clearRecent();
                showAlert(content, "最近の履歴を削除しました");
            });
        };

        root.append(label, clearBtn);
    }

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
                row.innerHTML = `<span>${name}: ${formatBytes(bytes)}</span>`;

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
                row.append(clear);
                storageBox.appendChild(row);
            }

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

            let quotaMB = "unknown";
            try {
                if (navigator.storage?.estimate) {
                    const est = await navigator.storage.estimate();
                    let estQuotaMB = est.quota / 1024 / 1024;
                    if (estQuotaMB > 6 * 1024) estQuotaMB = 6 * 1024;
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

        const timer = setInterval(() => {
            updateInfo();
            renderStorage();
        }, 2000);

        root._cleanup = () => {
            clearInterval(timer);
        };
    }
}

// 起動時および再構築時の背景適用
applyDesktopBackground();
window.addEventListener("desktop-ready", applyDesktopBackground);