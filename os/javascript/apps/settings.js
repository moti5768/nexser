// Settings.js
import { openDB } from "../db.js";
import { clearRecent } from "../recent.js";
import { setWindowAnimationEnabled, alertWindow, confirmWindow } from "../window.js";

const STORE = "settings";

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
    function renderSystem(root) {
        root.innerHTML = "";

        const info = document.createElement("div");
        const storageBox = document.createElement("div");
        storageBox.style.marginTop = "10px";
        storageBox.style.borderTop = "1px solid #666";
        storageBox.style.paddingTop = "6px";

        root.append(info, storageBox);

        // 単位変換
        function formatBytes(bytes) {
            if (bytes < 1024) return `${bytes} B`;
            if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
            return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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
                for (const storeName of db.objectStoreNames) {
                    let bytes = 0;
                    const tx = db.transaction(storeName, "readonly");
                    const store = tx.objectStore(storeName);
                    await new Promise((resolve) => {
                        const request = store.openCursor();
                        request.onsuccess = (event) => {
                            const cursor = event.target.result;
                            if (cursor) {
                                const item = cursor.value;

                                // --- ロジックを維持しつつ、巨大データによるフリーズを防止 ---
                                if (item instanceof Blob) {
                                    bytes += item.size;
                                } else if (typeof item === 'string') {
                                    // 巨大な文字列（Base64ビデオ等）で TextEncoder を使うとフリーズするため
                                    // 1MBを超える場合は length で代用、小さい場合は元のTextEncoderを使用
                                    if (item.length > 1024 * 1024) {
                                        bytes += item.length;
                                    } else {
                                        bytes += new TextEncoder().encode(item).length;
                                    }
                                } else {
                                    // オブジェクトの場合も、一旦文字列化する前に
                                    // 巨大な content プロパティなどがないかチェック
                                    const jsonStr = JSON.stringify(item) || "";

                                    // 文字列化した結果が巨大な場合のメモリ爆発を防止
                                    if (jsonStr.length > 1024 * 1024) {
                                        bytes += jsonStr.length;
                                    } else {
                                        bytes += new TextEncoder().encode(jsonStr).length;
                                    }
                                }
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
            // タイトル
            storageBox.innerHTML = "<b style='display:block; font-size:16px; margin-bottom: 5px; padding-bottom: 5px; border-bottom:1px solid #000;'>Storage Properties (C:)</b>";
            const sizes = await getStoreSizes();
            let virtualUsedBytes = 0;

            // 1. 各項目のリスト表示（削除ボタン付き）
            const listTable = document.createElement("div");
            listTable.style.fontSize = "13px";
            listTable.style.marginBottom = "10px";
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
            storageBox.appendChild(listTable);

            // 2. システム情報の取得
            let quota = 0;
            if (navigator.storage && navigator.storage.estimate) {
                const est = await navigator.storage.estimate();
                quota = est.quota || 0;
            }

            // 計算：割合(0〜1)とパーセント(0〜100)
            const usedRatio = quota > 0 ? (virtualUsedBytes / quota) : 0;
            const finalPercent = (usedRatio * 100).toFixed(4); // 表示用

            // 3. SVG円グラフ（維持：影なし・はみ出しなし）
            const radius = 10;
            const circumference = 2 * Math.PI * radius;
            const displayPercentForPie = usedRatio > 0 ? Math.max(0.5, usedRatio * 100) : 0;
            const strokeDash = `${(displayPercentForPie / 100) * circumference} ${circumference}`;

            const pieContainer = document.createElement("div");
            pieContainer.style.cssText = "display:flex; justify-content:center; margin:15px 0;";
            pieContainer.innerHTML = `
                <svg width="100" height="100" viewBox="0 0 32 32" style="transform: rotate(-90deg);">
                    <circle cx="16" cy="16" r="${radius}" fill="#FF00FF" />
                    <circle cx="16" cy="16" r="${radius / 2}" fill="none" 
                            stroke="#000080" 
                            stroke-width="${radius}" 
                            stroke-dasharray="${strokeDash}" 
                            stroke-dashoffset="0" />
                    <circle cx="16" cy="16" r="${radius}" fill="none" stroke="#000" stroke-width="0.5" />
                </svg>
            `;
            storageBox.appendChild(pieContainer);

            // 4. 統計数値テキスト（維持）
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
                    <span style="font-family:monospace;">${formatBytes(quota - virtualUsedBytes)}</span>
                </div>
                <div style="border-top:1px solid #000; margin:6px 0;"></div>
                <div style="display:flex; justify-content:space-between; font-size:15px; font-weight:bold;">
                    <span>Capacity:</span>
                    <span style="font-family:monospace;">${formatBytes(quota)}</span>
                </div>
            `;
            storageBox.appendChild(statsBox);

            // 5. 棒グラフ（改善：マルチセグメント・グリッド表示）
            const barContainer = document.createElement("div");
            barContainer.style.marginTop = "12px";

            const barBg = document.createElement("div");
            // Win95風の凹んだ枠線 + フレックスボックス
            barBg.style.cssText = "width:100%; height:20px; background:#eee; position:relative; display:flex; overflow:hidden;";
            barBg.className = "border";
            // ストアごとに色を変えて描画
            const colors = ["#000080", "#008080", "#800080", "#008000", "#808000"];
            let colorIdx = 0;

            for (const [name, bytes] of Object.entries(sizes)) {
                if (bytes <= 0) continue;

                const segmentWidth = (bytes / quota) * 100;
                const segment = document.createElement("div");
                segment.style.cssText = `
                    width: ${segmentWidth}%;
                    height: 100%;
                    background-color: ${colors[colorIdx % colors.length]};
                `;
                segment.title = `${name}: ${formatBytes(bytes)}`; // ホバーで内訳を表示
                barBg.appendChild(segment);
                colorIdx++;
            }

            // 細かな目盛り線（グリッド）をオーバーレイ
            const gridOverlay = document.createElement("div");
            gridOverlay.style.cssText = `
                position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                background-image: linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px);
                background-size: 5% 100%;
                pointer-events: none;
            `;
            barBg.appendChild(gridOverlay);
            barContainer.appendChild(barBg);
            storageBox.appendChild(barContainer);

            // 使用率％表示
            const percentLabel = document.createElement("div");
            percentLabel.style.cssText = "text-align:right; font-size:12px; font-weight:bold; color:#000080; margin-top:2px; font-family:monospace;";
            percentLabel.textContent = `${finalPercent}% Used`;
            barContainer.appendChild(percentLabel);
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
        }, 5000);

        root._cleanup = () => {
            clearInterval(timer);
        };
    }
}

// 起動時および再構築時の背景適用
applyDesktopBackground();
window.addEventListener("desktop-ready", applyDesktopBackground);