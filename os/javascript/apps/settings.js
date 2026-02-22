// Settings.js
import { openDB } from "../db.js";
import { clearRecent } from "../recent.js";
import { setWindowAnimationEnabled, alertWindow, confirmWindow } from "../window.js";
import { calcNodeSize } from "./explorer.js";

const STORE = "settings";
const MAX_STORAGE_LIMIT = 100 * 1024 * 1024 * 1024; // 100GB

function showConfirm(root, message, onYes, onNo) {
    const win = root.closest(".window");
    confirmWindow(message, (result) => {
        if (result) onYes?.();
        else onNo?.();
    }, { parentWin: win });
}

function showAlert(root, message) {
    const win = root.closest(".window");
    alertWindow(message, { parentWin: win });
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

        // ★ 100GB制限のチェックを追加
        if (navigator.storage && navigator.storage.estimate) {
            const { usage } = await navigator.storage.estimate();
            if (usage >= MAX_STORAGE_LIMIT) {
                console.error("Storage limit reached (100GB). Cannot save.");
                const activeWin = document.querySelector(".window:not([style*='display: none'])");
                alertWindow("ディスク領域不足: 設定を保存できませんでした。不要なファイルを削除してください。", { parentWin: activeWin });
                return false;
            }
        }

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
    let currentTabId = null; // ★追加：現在アクティブなタブを管理

    async function selectTab(id) {
        // ★追加ガード：同じタブを連打した場合は処理を中断
        if (currentTabId === id) return;
        currentTabId = id;

        [...tabsEl.children].forEach(btn => {
            const active = btn.dataset.id === id;
            btn.classList.toggle("active", active);
            btn.classList.toggle("inactive", !active);
        });

        // 以前のタブのクリーンアップ（タイマー停止など）
        if (bodyEl._cleanup) {
            bodyEl._cleanup();
            bodyEl._cleanup = null;
        }
        bodyEl.innerHTML = "";

        const tab = tabs.find(t => t.id === id);
        if (!tab) return;

        // ★重要：この変数に実行時のIDを閉じ込める（クロージャ）
        const thisExecutionTabId = id;

        try {
            // タブの描画（awaitで待機）
            await tab.render(bodyEl);

            // 【チェック】awaitが終わった時点で、まだこのタブが「最新」か確認
            // もしawait中に別のタブがクリックされていたら、中身をこれ以上操作しない
            if (currentTabId !== thisExecutionTabId) {
                console.log("Tab switch detected, cancelling render for:", thisExecutionTabId);
                return;
            }
        } catch (e) {
            console.error("Render failed:", e);
        }
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
            });
        };

        root.append(label, clearBtn);
    }

    /* ---------- System ---------- */
    async function renderSystem(root) {
        root.innerHTML = "";

        const info = document.createElement("div");
        updateInfo();
        const storageBox = document.createElement("div");
        storageBox.style.marginTop = "10px";
        storageBox.style.borderTop = "1px solid #666";
        storageBox.style.paddingTop = "6px";
        storageBox.innerHTML = "<i>Loading storage information...</i>"; // 計算中の仮表示

        root.append(info, storageBox);

        // 単位変換
        function formatBytes(bytes) {
            if (bytes === 0) return "0.00 B"; // 統一感のため

            const k = 1024;
            const dm = 2; // 小数点以下の桁数
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];

            // 単位のインデックスを計算
            const i = Math.floor(Math.log(bytes) / Math.log(k));

            // 計算結果を小数点第2位で固定
            const res = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));

            return `${res.toFixed(dm)} ${sizes[i]}`;
        }

        // ★追加：個別ストアの削除機能
        async function clearStore(storeName) {
            // 設定画面共通の confirmWindow を利用
            showConfirm(root, `${storeName} のデータをすべて削除しますか？`, async () => {
                try {
                    const db = await getDB();
                    const tx = db.transaction(storeName, "readwrite");
                    await tx.objectStore(storeName).clear();
                    showAlert(root, `${storeName} を空にしました。`);
                    renderStorage(); // 削除後にグラフを即時更新
                } catch (e) {
                    showAlert(root, "削除に失敗しました。");
                }
            });
        }

        async function getStoreSizes() {
            const result = {};
            try {
                const db = await getDB();
                const storeNames = Array.from(db.objectStoreNames);

                for (const storeName of storeNames) {
                    let bytes = 0;
                    const tx = db.transaction(storeName, "readonly");
                    const store = tx.objectStore(storeName);

                    await new Promise((resolve) => {
                        const request = store.openCursor();
                        request.onsuccess = async (event) => {
                            const cursor = event.target.result;
                            if (cursor) {
                                const item = cursor.value;

                                // --- 対応箇所 ---
                                if (storeName === "files") {
                                    // files ストアは実体そのものが入っている
                                    bytes += (typeof item === 'string' ? item.length : 0);
                                } else {
                                    // 修正ポイント：await を追加し、計算結果を待機する
                                    // kv ストアなどの場合、item が FS 構造（オブジェクト）であることを確認
                                    let size = 0;
                                    try {
                                        // item がファイルシステムノードの形式であれば計算
                                        size = await calcNodeSize(item, "");
                                    } catch (e) {
                                        size = 0;
                                    }

                                    if (size === 0 && item != null) {
                                        // フォールバック計算
                                        size = JSON.stringify(item).length;
                                    }
                                    bytes += size;
                                }
                                // ----------------

                                cursor.continue();
                            } else resolve();
                        };
                        request.onerror = () => resolve();
                    });
                    result[storeName] = bytes;
                }
            } catch (e) { console.error(e); }
            return result;
        }
        async function renderStorage() {
            // 1. まずデータを先に計算する (この間、storageBoxの中身は古いまま維持されます)
            const sizes = await getStoreSizes();
            if (!document.contains(storageBox) || currentTabId !== "system") return;
            let virtualUsedBytes = 0;

            // 2. メモリ上に一時的なコンテナ(偽の箱)を作成する
            const tempContainer = document.createElement("div");

            // タイトル
            const title = document.createElement("b");
            title.style.cssText = "display:block; font-size:16px; margin-bottom: 5px; padding-bottom: 5px; border-bottom:1px solid #000;";
            title.textContent = "Storage Properties (C:)";
            tempContainer.appendChild(title);

            // 1. 各項目のリスト表示（削除ボタン付き）
            const listTable = document.createElement("div");
            listTable.style.fontSize = "13px";
            listTable.style.marginBottom = "0px";

            for (const [name, bytes] of Object.entries(sizes)) {
                virtualUsedBytes += bytes;
                const row = document.createElement("div");
                row.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:3px 0; border-bottom:1px dashed #ccc;";

                const nameSpan = document.createElement("span");
                nameSpan.textContent = name;

                const rightSide = document.createElement("div");
                rightSide.style.display = "flex";
                rightSide.style.alignItems = "center";
                rightSide.innerHTML = `<span style='font-weight:bold; margin-right:8px;'>${formatBytes(bytes)}</span>`;

                if (name !== "settings") {
                    const delBtn = document.createElement("button");
                    delBtn.textContent = "Clear";
                    delBtn.style.fontSize = "10px";
                    delBtn.style.padding = "0 4px";
                    delBtn.onclick = () => clearStore(name);
                    rightSide.appendChild(delBtn);
                }

                row.append(nameSpan, rightSide);
                listTable.appendChild(row);
            }
            tempContainer.appendChild(listTable);

            const quota = MAX_STORAGE_LIMIT;
            const freeSpace = Math.max(0, quota - virtualUsedBytes);
            const usedRatio = quota > 0 ? (virtualUsedBytes / quota) : 0;
            const finalPercent = (usedRatio * 100).toFixed(4);

            // 3. SVG円グラフ
            const radius = 12.5;
            const circumference = 2 * Math.PI * radius;
            const displayPercentForPie = usedRatio > 0 ? Math.min(100, Math.max(0.5, usedRatio * 100)) : 0;
            const strokeDash = `${(displayPercentForPie / 100) * circumference} ${circumference}`;

            const pieContainer = document.createElement("div");
            pieContainer.style.cssText = "display:flex; justify-content:center; margin: 0px;";
            pieContainer.innerHTML = `
        <svg width="100" height="100" viewBox="0 0 32 32" style="transform: rotate(-90deg);">
            <circle cx="16" cy="16" r="${radius}" fill="#FF00FF" />
            <circle cx="16" cy="16" r="${radius / 2}" fill="none" 
                    stroke="#000080" 
                    stroke-width="${radius}" 
                    stroke-dasharray="${strokeDash}" 
                    stroke-dashoffset="0" />
            <circle cx="16" cy="16" r="${radius}" fill="none" stroke="#000" stroke-width="0.25" />
        </svg>
    `;
            tempContainer.appendChild(pieContainer);

            // 4. 統計数値テキスト
            const statsBox = document.createElement("div");
            statsBox.style.padding = "5px";
            statsBox.style.background = "#fff";
            statsBox.className = "border";
            statsBox.innerHTML = `
        <div style="display:flex; align-items:center; margin-bottom:6px; font-size:14px; color:#000080;">
            <div style="width:12px; height:12px; background:#000080; margin-right:8px; border:1px solid #000;"></div>
            <span style="flex:1;">Used space:</span>
            <span style="font-weight:bold; font-family:monospace;">${formatBytes(virtualUsedBytes)}</span>
        </div>
        <div style="display:flex; align-items:center; margin-bottom:6px; font-size:14px; color:#FF00FF;">
            <div style="width:12px; height:12px; background:#FF00FF; margin-right:8px; border:1px solid #000;"></div>
            <span style="flex:1;">Free space:</span>
            <span style="font-family:monospace;">${formatBytes(freeSpace)}</span>
        </div>
        <div style="border-top:1px solid #000; margin:6px 0;"></div>
        <div style="display:flex; justify-content:space-between; font-size:15px; font-weight:bold;">
            <span>Capacity:</span>
            <span style="font-family:monospace;">${formatBytes(quota)}</span>
        </div>
    `;
            tempContainer.appendChild(statsBox);

            // 5. 棒グラフ
            const barContainer = document.createElement("div");
            barContainer.style.marginTop = "12px";

            const barBg = document.createElement("div");
            barBg.style.cssText = "width:100%; height:20px; background:#eee; position:relative; display:flex; overflow:hidden;";
            barBg.className = "border";

            const colors = ["#000080", "#008080", "#800080", "#008000", "#808000"];
            let colorIdx = 0;

            for (const [name, bytes] of Object.entries(sizes)) {
                if (bytes <= 0) continue;
                const segmentWidth = (bytes / quota) * 100;
                const segment = document.createElement("div");
                segment.style.cssText = `width: ${segmentWidth}%; height: 100%; background-color: ${colors[colorIdx % colors.length]};`;
                segment.title = `${name}: ${formatBytes(bytes)}`;
                barBg.appendChild(segment);
                colorIdx++;
            }

            const gridOverlay = document.createElement("div");
            gridOverlay.style.cssText = `position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-image: linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px); background-size: 5% 100%; pointer-events: none;`;
            barBg.appendChild(gridOverlay);
            barContainer.appendChild(barBg);
            tempContainer.appendChild(barContainer);

            const percentLabel = document.createElement("div");
            percentLabel.style.cssText = "text-align:right; font-size:12px; font-weight:bold; color:#000080; margin-top:2px; font-family:monospace;";
            percentLabel.textContent = `${finalPercent}% Used`;
            barContainer.appendChild(percentLabel);

            // 3. 【重要】最後に一瞬で中身を入れ替える
            // storageBox.innerHTML = "" をここで呼ばず、replaceChildrenを使うのが最も効率的です
            storageBox.replaceChildren(tempContainer);
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
            if (!document.body.contains(root)) {
                clearInterval(timer);
                return;
            }
            updateInfo();
            renderStorage();
        }, 5000);

        root._cleanup = () => {
            clearInterval(timer);
        };
    }
}

// 起動時および再構築時の背景適用
applyDesktopBackground();
if (!window._desktopBackgroundInitialized) {
    window.addEventListener("desktop-ready", applyDesktopBackground);
    window._desktopBackgroundInitialized = true;
}