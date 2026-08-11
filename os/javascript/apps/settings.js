// Settings.js
import { openDB } from "../db.js";
import { clearRecent } from "../recent.js";
import { setWindowAnimationEnabled, alertWindow, confirmWindow } from "../window.js";
import { FS, forceSave } from "../fs.js";
import { resolveFS } from "../fs-utils.js";
import { getFileContent } from "../fs-db.js";

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

async function getStorageInfo() {
    const fallbackQuota = 100 * 1024 * 1024 * 1024; // 100GB
    if (navigator.storage && navigator.storage.estimate) {
        try {
            const { usage = 0, quota = fallbackQuota } = await navigator.storage.estimate();
            return { usage, quota };
        } catch (e) {
            console.warn("Storage estimate failed:", e);
        }
    }
    return { usage: 0, quota: fallbackQuota };
}


export async function saveSetting(key, value) {
    try {
        const db = await getDB();

        const { usage, quota } = await getStorageInfo();
        if (usage >= quota * 0.95) {
            const activeWin = document.querySelector(".window:not([style*='display: none'])");
            alertWindow("ディスク領域不足のため、設定を保存できませんでした。", { parentWin: activeWin });
            return false;
        }

        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(structuredClone(value), key);
        await tx.complete;
        window.dispatchEvent(new CustomEvent("setting-changed", { detail: { key } }));
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
export let themeColor2 = null;
export let desktopColor = null;

const DEFAULT_COLOR = "darkblue";

/**
 * 指定された要素に壁紙の表示形式（wpStyle）に応じたスタイルを適用する
 */
function applyBackgroundStyle(element, wpStyle) {
    switch (wpStyle) {
        case "center":
            element.style.backgroundSize = "auto";
            element.style.backgroundRepeat = "no-repeat";
            element.style.backgroundPosition = "center";
            break;
        case "tile":
            element.style.backgroundSize = "auto";
            element.style.backgroundRepeat = "repeat";
            element.style.backgroundPosition = "0 0";
            break;
        case "stretch":
            element.style.backgroundSize = "100% 100%";
            element.style.backgroundRepeat = "no-repeat";
            element.style.backgroundPosition = "center";
            break;
        case "fit":
            element.style.backgroundSize = "contain";
            element.style.backgroundRepeat = "no-repeat";
            element.style.backgroundPosition = "center";
            break;
        case "fill":
        default:
            element.style.backgroundSize = "cover";
            element.style.backgroundRepeat = "no-repeat";
            element.style.backgroundPosition = "center";
            break;
    }
}

async function applyDesktopBackground() {
    const desk = document.querySelector("#desktop");
    if (!desk) return;

    const color = await loadSetting("desktopColor");
    const wpUrl = await loadSetting("wallpaperUrl");
    const wpStyle = await loadSetting("wallpaperStyle") || "fill";

    desk.style.backgroundImage = wpUrl ? `url(${wpUrl})` : "none";
    desk.style.backgroundColor = color || "";

    // 共通関数を呼び出し
    applyBackgroundStyle(desk, wpStyle);
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
Promise.all([
    loadSetting("titlebarColor"),
    loadSetting("titlebarColor2")
]).then(([color1, color2]) => {
    if (color1) themeColor = color1;
    if (color2) themeColor2 = color2;
    if (color1 || color2) refreshTopWindow();
});

loadSetting("showRecentItems").then(val => {
    window.showRecent = val ?? true;
});

loadSetting("windowAnimationEnabled").then(v => {
    setWindowAnimationEnabled(v ?? true);
});

loadSetting("widgetTool_isPreviewEnabled").then(v => {
    const val = v ?? true;
    if (typeof window.setWindowPreviewEnabled === 'function') {
        window.setWindowPreviewEnabled(val);
    }
});

loadSetting("widgetTool_isTaskbarPreviewEnabled").then(v => {
    const val = v ?? true;
    if (typeof window.setTaskbarPreviewEnabled === 'function') {
        window.setTaskbarPreviewEnabled(val);
    }
});



const settingChangeHandlers = {
    async titlebarColor() {
        themeColor = (await loadSetting("titlebarColor")) || "darkblue";
        themeColor2 = (await loadSetting("titlebarColor2")) || null;
        refreshTopWindow();
    },
    async titlebarColor2() {
        await this.titlebarColor();
    },
    async desktopColor() {
        applyDesktopBackground();
    },
    async wallpaperUrl() {
        applyDesktopBackground();
    },
    async wallpaperStyle() {
        applyDesktopBackground();
    },
    async windowAnimationEnabled() {
        let val = await loadSetting("windowAnimationEnabled");
        // もし過去のバグ等で文字列の "false" が保存されていた場合の保護
        if (val === "false") val = false;
        setWindowAnimationEnabled(val ?? true);
    },
    async showRecentItems() {
        window.showRecent = (await loadSetting("showRecentItems")) ?? true;
        window.dispatchEvent(new Event("recent-updated"));
    },
    async userName() {
        const newName = (await loadSetting("userName")) || "Admin";
        window.dispatchEvent(new CustomEvent("user-profile-updated", { detail: newName }));
    },
    async widgetTool_isPreviewEnabled() {
        const val = await loadSetting("widgetTool_isPreviewEnabled");
        if (typeof window.setWindowPreviewEnabled === 'function') {
            window.setWindowPreviewEnabled(val ?? true);
        }
    },
    async widgetTool_isTaskbarPreviewEnabled() {
        const val = await loadSetting("widgetTool_isTaskbarPreviewEnabled");
        if (typeof window.setTaskbarPreviewEnabled === 'function') {
            window.setTaskbarPreviewEnabled(val ?? true);
        }
    }
};

window.addEventListener("setting-changed", async (e) => {
    const key = e.detail?.key;
    if (key && settingChangeHandlers[key]) {
        await settingChangeHandlers[key]();
    }
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
        if (tb.parentElement === topWindow) {
            // ★ 2つ目の色が設定されていればグラデーションを適用
            tb.style.background = themeColor2
                ? `linear-gradient(90deg, ${themeColor}, ${themeColor2})`
                : themeColor;
        } else {
            tb.style.background = "gray";
        }
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
        { id: "screensaver", label: "Screen Saver", render: renderScreensaver },
        { id: "sound", label: "Sound", render: renderSound },
        { id: "user", label: "User", render: renderUser },
        { id: "general", label: "General", render: renderGeneral },
        { id: "system", label: "System", render: renderSystem }
    ];
    let currentTabId = null; // ★追加：現在アクティブなタブを管理

    async function selectTab(id) {
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
        btn.onmousedown = () => selectTab(t.id);
        tabsEl.appendChild(btn);
    });

    selectTab("appearance");

    /* ---------- Appearance ---------- */
    async function renderAppearance(root) {
        root.innerHTML = "";

        // 共通カラーリスト
        const colors = ["#1E90FF", "#FF4500", "#32CD32", "#FFD700", "#8A2BE2",
            "#FF1493", "#00CED1", "#FF8C00", "#A52A2A", "#2F4F4F"];

        // パレット生成ヘルパー関数
        function createColorPalette(onClickCallback) {
            const container = document.createElement("div");
            container.style.display = "flex";
            container.style.flexWrap = "wrap";
            container.style.gap = "4px";
            container.style.margin = "8px 0";

            colors.forEach(c => {
                const btn = document.createElement("button");
                btn.style.background = c;
                btn.style.width = "24px";
                btn.style.height = "24px";
                btn.onclick = () => onClickCallback(c);
                container.appendChild(btn);
            });
            return container;
        }

        /* ---- Titlebar Color ---- */
        const block1 = document.createElement("div");
        block1.style.marginBottom = "12px";
        block1.innerHTML = `<div>Top Window Titlebar Color</div>`;

        // 1つ目の色（左）
        const colorInput1 = document.createElement("input");
        colorInput1.type = "color";
        colorInput1.value = themeColor.startsWith("#") ? themeColor : "#00008b";

        // グラデーション有効化チェックボックス
        const enableGradient = document.createElement("input");
        enableGradient.type = "checkbox";
        enableGradient.checked = !!themeColor2;
        enableGradient.style.marginLeft = "8px";

        const labelGradient = document.createElement("span");
        labelGradient.textContent = " Gradient: ";
        labelGradient.style.marginLeft = "4px";
        labelGradient.style.fontSize = "13px";

        // 2つ目の色（右）
        const colorInput2 = document.createElement("input");
        colorInput2.type = "color";
        colorInput2.value = (themeColor2 && themeColor2.startsWith("#")) ? themeColor2 : "#00bfff";
        colorInput2.disabled = !enableGradient.checked;

        // 色更新ロジック
        const updateTitlebar = async () => {
            themeColor = colorInput1.value;
            themeColor2 = enableGradient.checked ? colorInput2.value : null;
            await saveSetting("titlebarColor", themeColor);
            await saveSetting("titlebarColor2", themeColor2);
            refreshTopWindow();
        };

        colorInput1.oninput = updateTitlebar;
        colorInput2.oninput = updateTitlebar;
        enableGradient.onchange = () => {
            colorInput2.disabled = !enableGradient.checked;
            updateTitlebar();
        };

        const colorControls = document.createElement("div");
        colorControls.style.margin = "4px 0";
        colorControls.append(colorInput1, enableGradient, labelGradient, colorInput2);

        // パレットの生成 (タイトルバー用)
        const palette = createColorPalette((selectedColor) => {
            enableGradient.checked = false;
            colorInput2.disabled = true;
            colorInput1.value = selectedColor;
            updateTitlebar();
        });

        // グラデーションサンプルパレット
        const gradientSamples = [
            { c1: "#1E90FF", c2: "#00CED1" }, // Blue-Cyan
            { c1: "#FF4500", c2: "#FFD700" }, // Orange-Gold
            { c1: "#8A2BE2", c2: "#FF1493" }, // Purple-Pink
            { c1: "#32CD32", c2: "#00FA9A" }, // Green-SpringGreen
            { c1: "#2F4F4F", c2: "#A9A9A9" }, // Dark-Gray
            { c1: "#02175e", c2: "#a3c1e2" }  //Windows98-theme
        ];

        const gradPalette = document.createElement("div");
        gradPalette.style.display = "flex";
        gradPalette.style.flexWrap = "wrap";
        gradPalette.style.gap = "4px";
        gradPalette.style.marginBottom = "8px";

        gradientSamples.forEach(g => {
            const btn = document.createElement("button");
            btn.style.background = `linear-gradient(90deg, ${g.c1}, ${g.c2})`;
            btn.style.width = "48px";
            btn.style.height = "24px";
            btn.onclick = () => {
                enableGradient.checked = true;
                colorInput2.disabled = false;
                colorInput1.value = g.c1;
                colorInput2.value = g.c2;
                updateTitlebar();
            };
            gradPalette.appendChild(btn);
        });

        // リセットボタン
        const resetBtn = document.createElement("button");
        resetBtn.textContent = "Reset Default";
        resetBtn.onclick = () => {
            colorInput1.value = "#00008b";
            enableGradient.checked = false;
            colorInput2.disabled = true;
            updateTitlebar();
        };

        block1.append(colorControls, palette, gradPalette, resetBtn);

        /* ---- Desktop Background (Color & Image) ---- */
        const block2 = document.createElement("div");
        block2.style.marginTop = "12px";
        block2.innerHTML = `<div>Desktop Background</div>`;

        // 背景色入力 (Titlebar側と同じ挙動)
        const deskInput = document.createElement("input");
        deskInput.type = "color";
        deskInput.value = (await loadSetting("desktopColor")) || "#52adad";
        deskInput.style.marginRight = "6px";
        deskInput.style.verticalAlign = "middle";
        deskInput.oninput = async () => {
            await saveSetting("desktopColor", deskInput.value);
            applyDesktopBackground();
        };

        // 表示形式ドロップダウン (ピッカーの横に配置)
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

        // パレットの生成 (デスクトップ背景用)
        const deskPalette = createColorPalette(async (selectedColor) => {
            deskInput.value = selectedColor;
            await saveSetting("desktopColor", selectedColor);
            applyDesktopBackground();
        });

        // 背景色リセットボタン
        const deskResetBtn = document.createElement("button");
        deskResetBtn.textContent = "Reset Default";
        deskResetBtn.onclick = async () => {
            const defaultDeskColor = "#52adad";
            deskInput.value = defaultDeskColor;
            await saveSetting("desktopColor", defaultDeskColor);
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

        // Block2の組み立て (構成をTitlebar側と統一)
        block2.append(deskInput, styleSelect, deskPalette, deskResetBtn, wpBlock);

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

    /* ---------- Screen Saver (新規タブ) 修正版 ---------- */
    async function renderScreensaver(root) {
        root.innerHTML = "";

        // ★ プレビューのクリーンアップ関数を保持する変数
        let currentPreviewCleanup = null;
        let isDestroyed = false; // タブが破棄されたかどうかのフラグ

        const ssBlock = document.createElement("div");
        ssBlock.style.marginTop = "8px";

        // 1. プレビュー用モニターのCSS構造
        const monitorContainer = document.createElement("div");
        monitorContainer.style.cssText = `
            width: 152px; height: 120px;
            background: #c0c0c0;
            border-top: 2px solid #dfdfdf; border-left: 2px solid #dfdfdf;
            border-bottom: 2px solid #000; border-right: 2px solid #000;
            border-radius: 4px;
            margin: 0 auto 12px auto;
            position: relative;
        `;

        const monitorScreen = document.createElement("div");
        monitorScreen.style.cssText = `
            position: absolute;
            top: 10px; left: 10px; right: 10px; bottom: 20px;
            box-shadow: inset 0 0 4px #000;
            overflow: hidden;
        `;

        const monitorLed = document.createElement("div");
        monitorLed.style.cssText = `
            position: absolute;
            bottom: 6px; right: 12px;
            width: 4px; height: 4px;
            background: #0f0;
            border-radius: 50%;
        `;
        monitorContainer.append(monitorScreen, monitorLed);

        // 2. Win95風のグループ枠(擬似Fieldset)
        const ssControlBlock = document.createElement("div");
        ssControlBlock.style.cssText = `
            position: relative;
            padding: 12px 8px 8px 8px; 
            margin: 10px 0 0 0; 
            border: 1px solid #dfdfdf; 
            box-shadow: -1px -1px #000, inset 1px 1px #fff, inset -1px -1px #808080;
            background: transparent;
        `;

        const ssLegend = document.createElement("div");
        ssLegend.textContent = "Screen Saver";
        // 背景色を親要素の背景色と同じ（#c0c0c0）にすることで、後ろの線を隠して切り抜いて見せる
        ssLegend.style.cssText = `
            position: absolute;
            top: -9px;
            left: 6px;
            background: #c0c0c0; 
            padding: 0 4px;
            font-size: 13px;
        `;

        ssControlBlock.appendChild(ssLegend);

        const ssInner = document.createElement("div");
        ssInner.style.display = "flex";
        ssInner.style.alignItems = "center";
        ssInner.style.flexWrap = "wrap";
        ssInner.style.gap = "8px";

        // セレクトボックス
        const ssSelect = document.createElement("select");
        const ssOptions = [
            { id: "none", label: "(None)" },
            { id: "blank", label: "Blank Screen" },
            { id: "text", label: "3D Text" },
            { id: "mystify", label: "Mystify" },
            { id: "starfield", label: "Starfield (Win 3.1)" },
            { id: "maze", label: "3D Maze (Win 95/98)" }
        ];

        const currentSs = await loadSetting("screensaverType") || "none";

        // もし非同期読み込みの最中にユーザーが別タブに移動していたら処理を中断
        if (isDestroyed) return;

        ssOptions.forEach(o => {
            const opt = document.createElement("option");
            opt.value = o.id;
            opt.textContent = o.label;
            if (o.id === currentSs) opt.selected = true;
            ssSelect.appendChild(opt);
        });

        const previewBtn = document.createElement("button");
        previewBtn.textContent = "Preview";
        previewBtn.style.padding = "2px 8px";

        // ★追加：色設定オプション用コンテナ
        const ssOptionsBlock = document.createElement("div");
        ssOptionsBlock.style.cssText = "width: 100%; margin-top: 8px; padding-top: 8px; border-top: 1px solid #808080;";

        // ★追加：色設定UIの動的描画関数
        const renderColorSettings = async (type) => {
            ssOptionsBlock.innerHTML = ""; // 初期化

            if (type === "text") {
                const colorLabel = document.createElement("label");
                colorLabel.style.cssText = "font-size: 12px; display: flex; align-items: center; gap: 6px;";
                colorLabel.textContent = "テキスト色: ";

                const colorInput = document.createElement("input");
                colorInput.type = "color";
                colorInput.value = (await loadSetting("screensaverColor_text")) || "#ff0000";

                colorInput.onchange = async () => {
                    await saveSetting("screensaverColor_text", colorInput.value);
                    window.dispatchEvent(new Event("screensaver-settings-changed"));
                    updatePreviewMonitor(type);
                };

                colorLabel.appendChild(colorInput);
                ssOptionsBlock.appendChild(colorLabel);

            } else if (type === "maze") {
                // ★追加: 迷路の場合は「壁」「床」「天井」の3つの設定を用意
                const mazeSettings = [
                    { key: "screensaverColor_maze_wall", label: "壁の色: ", defaultVal: "#008080" },
                    { key: "screensaverColor_maze_floor", label: "床の色: ", defaultVal: "#333333" },
                    { key: "screensaverColor_maze_ceiling", label: "天井の色: ", defaultVal: "#555555" }
                ];

                for (const setting of mazeSettings) {
                    const colorLabel = document.createElement("label");
                    colorLabel.style.cssText = "font-size: 12px; display: flex; align-items: center; gap: 6px; margin-bottom: 4px;";
                    colorLabel.textContent = setting.label;

                    const colorInput = document.createElement("input");
                    colorInput.type = "color";
                    colorInput.value = (await loadSetting(setting.key)) || setting.defaultVal;

                    const targetKey = setting.key;
                    colorInput.onchange = async () => {
                        await saveSetting(targetKey, colorInput.value);
                        window.dispatchEvent(new Event("screensaver-settings-changed"));
                        updatePreviewMonitor(type);
                    };

                    colorLabel.appendChild(colorInput);
                    ssOptionsBlock.appendChild(colorLabel);
                }
            }
        };

        // 初期描画時に現在の設定に合わせた色設定を表示
        await renderColorSettings(currentSs);

        // モニター画面にアニメーションを反映するヘルパー関数
        const updatePreviewMonitor = async (type) => {
            if (isDestroyed) return;
            try {
                // 古いプレビューが動いていれば先に停止する
                if (currentPreviewCleanup) {
                    currentPreviewCleanup();
                    currentPreviewCleanup = null;
                }

                // モニターの背景を一旦リセット
                monitorScreen.innerHTML = "";
                monitorScreen.style.backgroundImage = "none";
                monitorScreen.style.backgroundColor = "";

                // noneの場合は実際のデスクトップ背景色・壁紙を適用する
                if (type === "none") {
                    const color = await loadSetting("desktopColor");
                    const wpUrl = await loadSetting("wallpaperUrl");
                    const wpStyle = await loadSetting("wallpaperStyle") || "fill";

                    if (isDestroyed) return;

                    monitorScreen.style.backgroundColor = color || "#52adad";

                    if (wpUrl) {
                        monitorScreen.style.backgroundImage = `url(${wpUrl})`;
                        applyBackgroundStyle(monitorScreen, wpStyle);
                    }
                    return;
                }

                // ★【追加】迷路の場合は保存されている色設定を読み込む
                let options = {};
                if (type === "maze") {
                    options = {
                        wallColor: await loadSetting("screensaverColor_maze_wall") || "#008080",
                        floorColor: await loadSetting("screensaverColor_maze_floor") || "#333333",
                        ceilingColor: await loadSetting("screensaverColor_maze_ceiling") || "#555555"
                    };
                }

                const { startPreview } = await import("../screensaver.js");
                if (isDestroyed) return;

                // ★【修正】第3引数に options を渡すように変更
                currentPreviewCleanup = startPreview(monitorScreen, type, options);
            } catch (e) {
                console.warn("プレビューの読み込みに失敗しました", e);
            }
        };

        // 設定の保存とプレビュー更新
        ssSelect.onchange = async () => {
            const type = ssSelect.value;
            await saveSetting("screensaverType", type);
            await renderColorSettings(type); // ★色設定UIの切り替えを追加
            window.dispatchEvent(new Event("screensaver-settings-changed"));
            updatePreviewMonitor(type);
        };
        // Previewボタンでフルスクリーン起動テスト
        previewBtn.onclick = async () => {
            const type = ssSelect.value;
            if (type === "none") return;
            try {
                const { testScreensaver } = await import("../screensaver.js");
                testScreensaver();
            } catch (e) {
                console.warn(e);
            }
        };

        // 待機時間の入力 UI
        const waitBlock = document.createElement("div");
        waitBlock.style.marginLeft = "auto";

        const ssWaitLabel = document.createElement("span");
        ssWaitLabel.textContent = "Wait: ";

        const ssWaitInput = document.createElement("input");
        ssWaitInput.type = "number";
        ssWaitInput.min = "1";
        ssWaitInput.max = "60";
        ssWaitInput.value = await loadSetting("screensaverWait") || "10";
        ssWaitInput.style.width = "40px";

        if (isDestroyed) return;

        const ssWaitUnit = document.createElement("span");
        ssWaitUnit.textContent = " minutes";

        ssWaitInput.onchange = async () => {
            await saveSetting("screensaverWait", ssWaitInput.value);
            window.dispatchEvent(new Event("screensaver-settings-changed"));
        };

        waitBlock.append(ssWaitLabel, ssWaitInput, ssWaitUnit);
        ssInner.append(ssSelect, previewBtn, waitBlock);

        ssControlBlock.appendChild(ssInner);
        ssControlBlock.appendChild(ssOptionsBlock); // ★色設定ブロックを追加

        ssBlock.append(monitorContainer, ssControlBlock);

        root.append(ssBlock);

        // プレビュー描画を実行
        requestAnimationFrame(() => {
            if (!isDestroyed) {
                updatePreviewMonitor(currentSs);
            }
        });

        // ★ 【超重要】親（selectTab）がタブを切り替えたときに自動で呼ばれるクリーンアップを設定
        root._cleanup = () => {
            isDestroyed = true;
            if (currentPreviewCleanup) {
                currentPreviewCleanup();
                currentPreviewCleanup = null;
            }
        };
    }


    /* ---------- Sound (機能拡張・安定版) ---------- */
    async function renderSound(root) {
        root.innerHTML = "<b>System Event Sounds</b><hr>";

        // FSとConfigの初期化
        if (!FS.System) FS.System = { type: "folder" };
        if (!FS.System["SoundConfig.json"]) {
            FS.System["SoundConfig.json"] = { type: "file", content: "{}" };
        }

        let config = {};
        try {
            config = JSON.parse(FS.System["SoundConfig.json"].content || "{}");
        } catch (e) {
            config = {};
        }

        // 音声ファイル収集ロジック
        const collectAudioFiles = (node, currentPath = "", visited = new Set()) => {
            let files = [];
            if (!node || typeof node !== "object" || visited.has(node)) return files;
            visited.add(node);

            for (const name in node) {
                if (["type", "system", "originalPath", "entry", "singleton", "target"].includes(name)) continue;
                const child = node[name];
                const fullPath = currentPath ? `${currentPath}/${name}` : name;
                if (child && child.type === "folder") {
                    files = files.concat(collectAudioFiles(child, fullPath, visited));
                } else if (child && child.type === "file") {
                    files.push(fullPath);
                }
            }
            return files;
        };

        const musicNode = resolveFS("Programs/Music");
        const files = musicNode ? collectAudioFiles(musicNode) : [];

        // soundplayer.js と完全に一致させた全イベントリスト
        const events = [
            { id: "startup", label: "起動音" },
            { id: "logoff", label: "ログオフ" },
            { id: "error", label: "エラー" },
            { id: "notify", label: "通知" },
            { id: "minimize", label: "最小化" },
            { id: "maximize", label: "最大化" },
            { id: "restore", label: "元に戻す" },
            { id: "resize", label: "サイズ変更" },
            { id: "open", label: "ウィンドウの起動" },
            { id: "close", label: "ウィンドウを閉じる" }
        ];

        let previewAudio = null;

        events.forEach(ev => {
            const row = document.createElement("div");
            row.style.marginBottom = "8px";
            row.innerHTML = `<label style="display:block; font-size:11px; margin-bottom:2px;">${ev.label}</label>`;

            const controlsWrapper = document.createElement("div");
            controlsWrapper.style.display = "flex";
            controlsWrapper.style.gap = "4px";

            const select = document.createElement("select");
            select.style.flex = "1";
            select.style.fontSize = "11px";
            select.innerHTML = `<option value="">(なし)</option>` +
                files.map(f => `<option value="${f}" ${config[ev.id] === f ? 'selected' : ''}>${f}</option>`).join("");

            // 試聴ボタン
            const testBtn = document.createElement("button");
            testBtn.textContent = "試聴";
            testBtn.style.fontSize = "10px";
            testBtn.style.padding = "2px 6px";
            testBtn.style.cursor = "pointer";

            testBtn.onclick = async () => {
                const selectedFile = select.value;
                if (!selectedFile) return;

                // 再生中の音を止める
                if (previewAudio) {
                    previewAudio.pause();
                    previewAudio = null;
                }

                const path = `Programs/Music/${selectedFile}`;
                const fileNode = resolveFS(path);
                if (!fileNode) return;

                // 非同期でのデータ取得 (soundplayer.js と同じロジック)
                let audioData = fileNode.content;
                if (audioData === "__EXTERNAL_DATA__") {
                    audioData = await getFileContent(path);
                }

                if (!audioData) {
                    console.error("Audio data could not be loaded.");
                    return;
                }

                previewAudio = new Audio(audioData);
                previewAudio.play().catch(err => console.error("Playback failed:", err));
            };

            select.onchange = async () => {
                config[ev.id] = select.value || undefined;
                FS.System["SoundConfig.json"].content = JSON.stringify(config, null, 2);
                await forceSave?.();
                window.dispatchEvent(new Event("fs-updated"));
            };

            controlsWrapper.append(select, testBtn);
            row.appendChild(controlsWrapper);
            root.appendChild(row);
        });

        // タブ移動時に確実に停止させる
        root._cleanup = () => {
            if (previewAudio) {
                previewAudio.pause();
                previewAudio = null;
            }
        };
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
            // --- バリデーション追加 ---
            const newName = nameInput.value.trim(); // 前後の空白を削除

            if (newName === "") {
                // 空欄の場合は警告を出して中断
                showAlert(root, "名前を入力してください。空欄にすることはできません。");
                // 入力欄をリセット（任意）
                nameInput.value = (await loadSetting("userName")) || "Admin";
                return;
            }

            if (newName.length > 20) {
                showAlert(root, "名前が長すぎます（20文字以内）。");
                return;
            }
            // ------------------------

            await saveSetting("userName", newName);
            window.dispatchEvent(new CustomEvent("user-profile-updated", { detail: newName }));
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
                    await tx.done;

                    // --- 変数とDBのリセット ---
                    themeColor = DEFAULT_COLOR;
                    themeColor2 = null;
                    window.showRecent = true;

                    await saveSetting("titlebarColor", DEFAULT_COLOR);
                    await saveSetting("titlebarColor2", null);
                    await saveSetting("desktopColor", null);
                    await saveSetting("wallpaperUrl", null);
                    await saveSetting("wallpaperStyle", "fill");
                    await saveSetting("showRecentItems", true);
                    await saveSetting("windowAnimationEnabled", true);
                    await saveSetting("userName", "Admin");

                    // --- UIの更新 ---
                    applyDesktopBackground();
                    setWindowAnimationEnabled(true);
                    refreshTopWindow();
                    window.dispatchEvent(new Event("recent-updated"));

                    // 【修正】renderGeneral(content) を呼ぶとタブ領域ごと消える可能性があるため、
                    // 成功メッセージのみを表示し、必要であればUIの状態を個別に更新する
                    showAlert(content, "全ての設定が初期化されました。");

                    // querySelectorを使わず、すぐ下で定義されている toggle 変数自身を直接操作する
                    // （※ブロックスコープの外の toggle 要素を安全に更新）
                    if (toggle) toggle.checked = true;

                } catch (e) {
                    console.error("Reset failed:", e);
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

    // 単位変換
    function formatBytes(bytes) {
        if (bytes === 0) return "0.00 B";
        const k = 1024;
        const dm = 2;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        const res = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
        return `${res.toFixed(dm)} ${sizes[i]}`;
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
        storageBox.innerHTML = "<i>Loading storage information...</i>";

        root.append(info, storageBox);

        // 個別ストアの削除機能
        async function clearStore(storeName) {
            showConfirm(root, `${storeName} のデータをすべて削除しますか？`, async () => {
                try {
                    const db = await getDB();
                    const tx = db.transaction(storeName, "readwrite");
                    await tx.objectStore(storeName).clear();
                    showAlert(root, `${storeName} を空にしました。`);
                    renderStorage();
                } catch (e) {
                    showAlert(root, "削除に失敗しました。");
                }
            });
        }

        const encoder = new TextEncoder();

        // ★ 改善点: サイズ計算のロジックを独立した関数として外に切り出し
        function calculateItemSize(storeName, item) {
            if (!item) return 0;

            if (storeName === "files") {
                if (item instanceof Blob) return item.size;
                if (item instanceof ArrayBuffer) return item.byteLength;
                if (typeof item === 'string') return encoder.encode(item).length;
                return 0;
            }

            try {
                const jsonString = JSON.stringify(item);
                return jsonString ? encoder.encode(jsonString).length : 0;
            } catch {
                return 0;
            }
        }

        async function getStoreSizes() {
            try {
                const db = await getDB();
                const storeNames = Array.from(db.objectStoreNames);

                const results = await Promise.all(storeNames.map(async (storeName) => {
                    let bytes = 0;
                    const tx = db.transaction(storeName, "readonly");
                    const store = tx.objectStore(storeName);

                    await new Promise((resolve, reject) => {
                        const request = store.openCursor();
                        request.onsuccess = (event) => {
                            const cursor = event.target.result;
                            if (cursor) {
                                // ★ 改善点: 切り出した関数を呼び出すだけになり、ネストが浅くスッキリします
                                bytes += calculateItemSize(storeName, cursor.value);
                                cursor.continue();
                            } else {
                                resolve();
                            }
                        };
                        request.onerror = () => reject(request.error);
                        tx.onabort = () => reject(new Error("Transaction aborted"));
                    });

                    // ★ 改善点: Object.fromEntries 用に [キー, 値] の配列で直接返します
                    return [storeName, bytes];
                }));

                // ★ 改善点: .map() を使わずにそのまま渡せるようになります
                return Object.fromEntries(results);
            } catch (e) {
                console.error("[Settings] getStoreSizes failed:", e);
                return {};
            }
        }

        async function renderStorage() {
            if (!document.body.contains(root) || currentTabId !== "system") return;
            const sizes = await getStoreSizes();

            const { quota } = await getStorageInfo();

            // 非同期処理を待っている間にタブが切り替わったり閉じられたら、処理を中断するガード
            if (!document.body.contains(storageBox) || currentTabId !== "system") return;

            const frag = document.createDocumentFragment();
            let virtualUsedBytes = 0;

            const title = document.createElement("b");
            title.style.cssText = "display:block; font-size:16px; margin-bottom: 5px; padding-bottom: 5px; border-bottom:1px solid #000;";
            title.textContent = "Storage Properties (C:)";
            frag.appendChild(title);

            // リストやグラフで共有するカラーパレットを定義
            const storage_colors = ["#000080", "#008080", "#800080", "#008000", "#808000", "#4682B4", "#D2691E"];

            const listTable = document.createElement("div");
            listTable.style.fontSize = "13px";
            listTable.style.marginBottom = "8px";

            let colorIdx = 0;
            for (const [name, bytes] of Object.entries(sizes)) {
                virtualUsedBytes += bytes;
                const currentColor = storage_colors[colorIdx % storage_colors.length];

                const row = document.createElement("div");
                row.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:4px 0; border-bottom:1px dashed #ccc;";

                // ストア名の左側にカラーチップ（凡例）を表示するコンテナ
                const nameWrapper = document.createElement("div");
                nameWrapper.style.cssText = "display:flex; align-items:center;";

                const colorChip = document.createElement("div");
                colorChip.style.cssText = `width: 10px; height: 10px; background-color: ${currentColor}; margin-right: 6px; border: 1px solid #000; flex-shrink: 0;`;

                const nameSpan = document.createElement("span");
                nameSpan.textContent = name;
                nameSpan.style.fontWeight = "bold";

                nameWrapper.append(colorChip, nameSpan);

                const rightSide = document.createElement("div");
                rightSide.style.display = "flex";
                rightSide.style.alignItems = "center";
                rightSide.innerHTML = `<span style='margin-right:8px; font-size: 12px;'>${formatBytes(bytes)}</span>`;

                if (name !== "settings") {
                    const delBtn = document.createElement("button");
                    delBtn.textContent = "Clear";
                    delBtn.style.fontSize = "12px";
                    delBtn.style.padding = "0 4px";
                    delBtn.onclick = () => clearStore(name);
                    rightSide.appendChild(delBtn);
                }

                row.append(nameWrapper, rightSide);
                listTable.appendChild(row);
                colorIdx++;
            }
            frag.appendChild(listTable);

            const freeSpace = Math.max(0, quota - virtualUsedBytes);
            const usedRatio = quota > 0 ? (virtualUsedBytes / quota) : 0;
            const finalPercent = (usedRatio * 100).toFixed(4);

            const radius = 12.5;
            const strokeWidth = 12.5;
            const innerRadius = radius - (strokeWidth / 2);
            const circumference = 2 * Math.PI * innerRadius;

            // ==========================================
            // 【修正】SVG円グラフの複数セグメント生成
            // ==========================================
            let pieCircles = "";
            let cumulativeRatio = 0;
            let pieColorIdx = 0;

            for (const [name, bytes] of Object.entries(sizes)) {
                if (bytes > 0) {
                    const itemRatio = bytes / quota;
                    const itemLength = itemRatio * circumference;
                    // stroke-dashoffsetを負の値にして開始位置をずらす
                    const offset = -(cumulativeRatio * circumference);

                    pieCircles += `
                    <circle cx="16" cy="16" r="${innerRadius}" fill="none" 
                            stroke="${storage_colors[pieColorIdx % storage_colors.length]}" 
                            stroke-width="${strokeWidth}" 
                            stroke-dasharray="${itemLength} ${circumference}" 
                            stroke-dashoffset="${offset}" />`;

                    cumulativeRatio += itemRatio;
                }
                // 0バイトでもインデックスを進め、リストと色を確実に同期させる
                pieColorIdx++;
            }

            const pieContainer = document.createElement("div");
            pieContainer.style.cssText = "display:flex; justify-content:center; margin: 10px;";

            pieContainer.innerHTML = `
            <svg width="100" height="100" viewBox="0 0 32 32" style="transform: rotate(-90deg);">
                <!-- 空き容量 (マゼンタ背景) -->
                <circle cx="16" cy="16" r="${radius}" fill="#FF00FF" />
                <!-- 使用量 (各ストアごとの色分け) -->
                ${pieCircles}
                <!-- 枠線 -->
                <circle cx="16" cy="16" r="${radius}" fill="none" stroke="#000" stroke-width="0.25" />
            </svg>
        `;
            frag.appendChild(pieContainer);

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
            frag.appendChild(statsBox);

            const barContainer = document.createElement("div");
            barContainer.style.marginTop = "12px";

            const barBg = document.createElement("div");
            barBg.style.cssText = "width:100%; height:20px; background:#eee; position:relative; display:flex; overflow:hidden;";
            barBg.className = "border";

            // ==========================================
            // 【修正】棒グラフの色分けと同期修正
            // ==========================================
            let barColorIdx = 0;
            for (const [name, bytes] of Object.entries(sizes)) {
                if (bytes > 0) {
                    const segmentWidth = (bytes / quota) * 100;
                    const segment = document.createElement("div");
                    segment.style.cssText = `width: ${segmentWidth}%; height: 100%; background-color: ${storage_colors[barColorIdx % storage_colors.length]}; transition: opacity 0.2s;`;
                    segment.title = `${name}: ${formatBytes(bytes)}`;

                    segment.onmouseover = () => segment.style.opacity = "0.8";
                    segment.onmouseout = () => segment.style.opacity = "1";

                    barBg.appendChild(segment);
                }
                // 0バイトでもインデックスを進め、リスト・円グラフと色を完全に同期させる
                barColorIdx++;
            }

            const gridOverlay = document.createElement("div");
            gridOverlay.style.cssText = `position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-image: linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px); background-size: 5% 100%; pointer-events: none;`;
            barBg.appendChild(gridOverlay);
            barContainer.appendChild(barBg);

            const percentLabel = document.createElement("div");
            percentLabel.style.cssText = "text-align:right; font-size:12px; font-weight:bold; color:#000080; margin-top:2px; font-family:monospace;";
            percentLabel.textContent = `${finalPercent}% Used`;
            barContainer.appendChild(percentLabel);
            frag.appendChild(barContainer);

            // ==========================================
            // システム診断・クリーンアップツールUI
            // ==========================================
            const toolsSection = document.createElement("div");
            toolsSection.style.cssText = "margin-top: 15px; border-top: 1px solid #666; padding-top: 10px;";

            toolsSection.innerHTML = `
            <b style="display:block; margin-bottom:6px; font-size:13px;">System Tools</b>
            <div style="display:flex; gap:6px; margin-bottom:8px;">
                <button id="btn-scan" style="padding:4px 10px;">Scan System</button>
                <button id="btn-clean" style="padding:4px 10px; background:#393; color:white;" disabled>Run Cleanup & Repair</button>
            </div>
            <div id="maintenance-console" style="background:#000; color:#0f0; font-family:monospace; font-size:11px; padding:6px; height:70px; overflow-y:auto; border:1px solid #666; border-radius:2px;">
                システムは正常です。スキャンを実行してください。
            </div>
        `;
            frag.appendChild(toolsSection);

            // 動的処理用インポート
            const btnScan = toolsSection.querySelector("#btn-scan");
            const btnClean = toolsSection.querySelector("#btn-clean");
            const consoleBox = toolsSection.querySelector("#maintenance-console");

            let lastReport = null;

            // スキャン処理
            btnScan.onclick = async () => {
                consoleBox.innerHTML = "Scanning system structure and temporary files...";
                const { diagnoseAndCleanFS } = await import("../fs.js");

                // 読み込みフラグを考慮して少しウェイト(演出)
                setTimeout(async () => {
                    lastReport = await diagnoseAndCleanFS(false); // 診断のみ
                    consoleBox.innerHTML = "";

                    if (lastReport.logs.length === 0) {
                        consoleBox.innerHTML = "◇ スキャン完了: 検出された問題や不要なデータはありません。システムは完全にクリーンです。";
                        btnClean.disabled = true;
                    } else {
                        consoleBox.innerHTML = "<b>◇ スキャン結果:</b><br>";
                        lastReport.logs.forEach(log => {
                            // 警告メッセージを目立たせるアレンジ
                            if (log.includes("【警告】")) {
                                const folderName = log.match(/'([^']+)'/)?.[1] || "不明なディレクトリ";
                                consoleBox.innerHTML += `> <span style="color: #ff4d4d; font-weight: bold;">[破損検知] パス: C:/${folderName} が消失または不正です。</span><br>`;
                            } else {
                                consoleBox.innerHTML += `> <span style="color: #ffb300;">${log}</span><br>`;
                            }
                        });
                        if (lastReport.garbageNames && lastReport.garbageNames.length > 0) {
                            consoleBox.innerHTML += `> <span style="color: #aaa;">[詳細] 検出された不要ファイル: ${lastReport.garbageNames.join(", ")}</span><br>`;
                        }
                        consoleBox.innerHTML += `<br><span style="color: #0f0;">[要アクション] 不要ファイル: ${lastReport.garbageItems}件 / システム破損: ${lastReport.corruptionDetected ? "あり (要修復)" : "なし"}</span>`;
                        btnClean.disabled = false;
                    }
                    consoleBox.scrollTop = consoleBox.scrollHeight;
                }, 600);
            };

            // クリーニング＆修復実行
            btnClean.onclick = () => {
                const msg = lastReport?.corruptionDetected
                    ? "データ破損が検出されています。システムファイルを復元し、ゴミ箱を空にしてもよろしいですか？"
                    : "ゴミ箱を空にして一時データをクリーンアップしますか？";

                showConfirm(root, msg, async () => {
                    consoleBox.innerHTML = "Executing system maintenance...";
                    const { diagnoseAndCleanFS } = await import("../fs.js");

                    const finalReport = await diagnoseAndCleanFS(true); // 実際に修復

                    consoleBox.innerHTML = "<b>[メンテナンス完了]</b><br>";
                    finalReport.logs.forEach(log => {
                        consoleBox.innerHTML += `<span style="color:#fff;">> ${log}</span><br>`;
                    });
                    if (finalReport.garbageNames && finalReport.garbageNames.length > 0) {
                        consoleBox.innerHTML += `> <span style="color: #aaa;">[詳細] 削除されたファイル: ${finalReport.garbageNames.join(", ")}</span><br>`;
                    }
                    consoleBox.innerHTML += "システム構造の最適化とクリーンアップが成功しました。";
                    btnClean.disabled = true;

                    // 最近使った項目のクリーンアップも合わせて実行
                    if (finalReport.garbageItems > 0) {
                        renderStorage(); // ストレージグラフを再描画
                    }
                });
            };
            // ==========================================

            storageBox.replaceChildren(frag);
        }

        async function updateInfo() {
            if (!document.body.contains(info)) return;

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

        let storageUpdateTimer = null;

        const onFsUpdated = () => {
            // 【安全策】rootが画面から消えていたら即座にイベントリスナー自体を自爆解除する
            if (!document.body.contains(root)) {
                window.removeEventListener("fs-updated", onFsUpdated);
                if (storageUpdateTimer) clearTimeout(storageUpdateTimer);
                return;
            }

            const win = root.closest(".window");
            if (!win || win.style.display === "none" || win.dataset.minimized === "true") {
                return;
            }

            if (currentTabId !== "system") return;

            if (storageUpdateTimer) clearTimeout(storageUpdateTimer);

            storageUpdateTimer = setTimeout(() => {
                if (document.body.contains(root) && currentTabId === "system") {
                    renderStorage();
                }
                storageUpdateTimer = null;
            }, 500);
        };

        window.addEventListener("fs-updated", onFsUpdated);

        updateInfo();
        renderStorage();

        const infoTimer = setInterval(() => {
            // タブ切り替えや終了時にタイマーを自動停止
            if (!document.body.contains(root) || currentTabId !== "system") {
                clearInterval(infoTimer);
                return;
            }
            updateInfo();
        }, 5000);

        // ★【大修正】root._cleanup ではなく bodyEl._cleanup に書き換える
        bodyEl._cleanup = () => {
            clearInterval(infoTimer);
            if (storageUpdateTimer) clearTimeout(storageUpdateTimer);
            window.removeEventListener("fs-updated", onFsUpdated);
        };

    }

    return {
        isTabApp: true,
        dispose: () => {
            if (bodyEl._cleanup) {
                bodyEl._cleanup();
            }
        }
    };
}

// 起動時および再構築時の背景適用
applyDesktopBackground();
if (!window._desktopBackgroundInitialized) {
    window.addEventListener("desktop-ready", applyDesktopBackground);
    window._desktopBackgroundInitialized = true;
}