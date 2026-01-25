// window.js
import { saveWindowSize, loadWindowSize } from "./window-size-db.js";
import { themeColor } from "./apps/settings.js"; // これを使う
import { attachContextMenu } from "./context-menu.js";
import { setupRibbon } from "./apps/explorer.js"; // ここに setupRibbon が定義されている
import { killProcess } from "./kernel.js";

export const taskbarButtons = []; // 作られたボタンを全部保存
let resizeCursor = "";
let maximizing = false;
const DEFAULT_COLOR = "gray";
export let TOP_COLOR = "darkblue";

let refreshQueued = false;

/* =========================
   Global Event Guards
========================= */

let globalMouseInstalled = false;

function installGlobalMouseHandler() {
    if (globalMouseInstalled) return;
    globalMouseInstalled = true;

    document.addEventListener("mousedown", e => {
        const win = e.target.closest(".window");
        if (
            e.target.closest(".modal-overlay") ||
            (win && win._modal) ||
            e.target.closest(".context-menu")
        ) return;

        // ウィンドウ外なら色リセット
        const titles = document.getElementsByClassName("title-bar");
        for (const tb of titles) {
            tb.style.background = DEFAULT_COLOR;
        }
        taskbarButtons.forEach(btn => btn.classList.remove("selected"));
    });


}

/* ===== 全ウィンドウ色リセット ===== */
export function resetAllTitleBars() {
    document.querySelectorAll(".window .title-bar")
        .forEach(tb => tb.style.background = DEFAULT_COLOR);
}
export function scheduleRefreshTopWindow() {
    if (refreshQueued) return;
    refreshQueued = true;

    requestAnimationFrame(() => {
        refreshQueued = false;
        refreshTopWindow();
    });
}
export function createWindow(title, options = {}) {

    // ★ グローバルイベントは1回だけ登録
    installGlobalMouseHandler();

    const startMenu = document.getElementById("start-menu");
    const startBtn = document.getElementById("start-btn");
    if (startMenu) startMenu.style.display = "none";
    if (startBtn) startBtn.classList.remove("pressed");

    const w = document.createElement("div");
    w.className = "window";
    w.dataset.title = title;
    w.style.position = "absolute";
    w.style.left = options.left || "100px";
    w.style.top = options.top || "100px";
    w.style.width = options.width || "650px";
    w.style.height = options.height || "350px";
    bringToFront(w);

    w.innerHTML = `
<div class="title-bar">
    <span class="title-text">${title}</span>
    <div class="window-controls">
        <button class="min-btn"></button>
        <button class="max-btn"></button>
        <button class="close-btn"></button>
    </div>
</div>

${!options.hideRibbon ? `
<div class="window-ribbon" style="
    height:26px;
    background:#C3C7CB;
    display:flex;
    align-items:center;
    font-size: 12px;
">
</div>` : ""}

<div class="content" style="
    overflow:auto;
    height: calc(100% - 26px ${!options.hideRibbon ? "- 26px" : ""} - 20px);
"></div>

${!options.hideStatus ? `
<div class="window-statusbar" style="
    height:20px;
    background:#C3C7CB;
    font-size:12px;
    padding:0 4px;
    display:flex;
    align-items:center;
">
    Ready
</div>` : ""}
`;

    // リボン要素を確実に取得
    const content = w.querySelector(".content");
    w._ribbon = w.querySelector(".window-ribbon");
    w._statusBar = w.querySelector(".window-statusbar");

    // 一度だけ初期化
    if (w._ribbon && !options.hideRibbon) {
        w._ribbon.innerHTML = ""; // 古い内容をクリア

        const isExplorer = w.dataset.type === "explorer";
        const ribbonMenus = isExplorer
            ? (options.ribbonMenus || [])
            : [
                {
                    title: "Window",
                    items: [
                        { label: "最小化", action: () => w.querySelector(".min-btn")?.click() },
                        { label: "最大化 / 元のサイズに戻す", action: () => w.querySelector(".max-btn")?.click() },
                        { label: "閉じる", action: () => w.querySelector(".close-btn")?.click() }
                    ]
                }
            ];

        setupRibbon(
            w,
            options.getCurrentPath || (() => null),
            options.renderCallback || null,
            ribbonMenus
        );
    }

    const desktop = document.getElementById("desktop");
    desktop.appendChild(w);
    w._statusBar = w.querySelector(".window-statusbar");
    /* ===== サイズ復元 ===== */

    const sizeKey = title;   // 今回は title をキーにする（簡単）

    (async () => {
        const size = await loadWindowSize(sizeKey);  // ✅ await で確実に取得
        if (!size) return;

        if (size.w) w.style.width = size.w + "px";
        if (size.h) w.style.height = size.h + "px";
        if (size.x !== undefined) w.style.left = size.x + "px";
        if (size.y !== undefined) w.style.top = size.y + "px";
    })();

    /* ===== フォーカス & 復元 ===== */

    const restoreWindow = () => {
        w.style.visibility = "visible";
        w.style.pointerEvents = "auto";
        w.dataset.minimized = "false";

        const input = w.querySelector("input, textarea");
        if (input) input.focus();

        const screen = w.querySelector(".terminal-screen");
        if (screen) screen.scrollTop = screen.scrollHeight;
    };

    const focus = () => {
        if (w._modal) return; // モーダルは絶対に focus させない

        bringToFront(w);

        if (w.dataset.minimized === "true") restoreWindow();
    };

    w.addEventListener("mousedown", focus);


    // 右クリックメニューもモーダルなら無効化
    if (!options._modal && !options.disableContextMenu) {
        installWindowContextMenu(w);
    }


    /* ===== タスクバー ===== */

    const taskbar = document.getElementById("taskbar");
    let taskbarBtn = null; // 初期値は null

    if (taskbar && options.taskbar !== false) {
        w.dataset.taskbar = "true";

        taskbarBtn = document.createElement("button");
        taskbarBtn.textContent = title;
        taskbarBtn.className = "taskbar-window-btn button";
        taskbarBtn.dataset.title = title;

        taskbarBtn._window = w;
        w._taskbarBtn = taskbarBtn;

        taskbar.appendChild(taskbarBtn);
        taskbarButtons.push(taskbarBtn);
    } else {
        w.dataset.taskbar = "false";
        taskbarBtn = null; // 明示的に null
    }

    /* ===== ウィンドウボタン ===== */

    const closeBtn = w.querySelector(".close-btn");
    const minBtn = w.querySelector(".min-btn");
    const maxBtn = w.querySelector(".max-btn");

    if (options.disableControls) {
        [minBtn, maxBtn].forEach(btn => btn.classList.add("pointer_none"));
    }

    closeBtn.addEventListener("click", () => {
        if (w._modalOverlay) {
            w._modalOverlay.remove();
        }
        if (w.dataset.processKey) {
            killProcess(w.dataset.processKey);
        } else {
            // 念のためフォールバック
            w.remove();
        }

        if (taskbarBtn) {
            taskbarBtn._window = null;
            taskbarBtn.remove();

            const idx = taskbarButtons.indexOf(taskbarBtn);
            if (idx !== -1) taskbarButtons.splice(idx, 1);
        }

        scheduleRefreshTopWindow();
    });

    /* ===== 最小化アニメーション ===== */

    let minimizing = false;

    minBtn.addEventListener("click", () => {
        if (w.dataset.minimized === "true" || minimizing) return;
        minimizing = true;

        const titleBar = w.querySelector(".title-bar");
        const titleText = titleBar?.querySelector(".title-text");
        if (!titleText) { minimizing = false; return; }

        const taskbarBtnRect = taskbarBtn?.getBoundingClientRect() ||
            { left: w.offsetLeft, top: w.offsetTop, width: 0 };

        // アニメ中は display:block のまま
        w.style.display = "block";
        w.style.pointerEvents = "none";

        const clone = createTitleClone(w, titleBar, titleText);

        animateTitleClone(clone,
            { left: taskbarBtnRect.left, top: taskbarBtnRect.top, width: taskbarBtnRect.width },
            250,
            () => {
                clone.remove();
                w.dataset.minimized = "true";
                minimizing = false;
                scheduleRefreshTopWindow();

                // アニメ完了後に display:none にする
                w.style.display = "none";
            }
        );
    });

    /* ===== タスクバークリックで復元 ===== */

    if (taskbarBtn) {
        if (taskbarBtn) {
            taskbarBtn.onclick = () => {
                // タスクバー選択状態を即時反映
                taskbarButtons.forEach(btn => btn.classList.remove("selected"));
                taskbarBtn.classList.add("selected");

                if (w.dataset.minimized === "true") {
                    minimizing = false;

                    const titleBar = w.querySelector(".title-bar");
                    const titleText = titleBar?.querySelector(".title-text");
                    if (!titleText) return;

                    // まず display:block にして可視化準備
                    w.style.display = "block";
                    w.style.visibility = "hidden";  // アニメ中は非表示
                    w.style.pointerEvents = "none";

                    const rect = taskbarBtn.getBoundingClientRect();
                    const clone = document.createElement("div");

                    Object.assign(clone.style, {
                        position: "absolute",
                        left: rect.left + "px",
                        top: rect.top + "px",
                        width: rect.width + "px",
                        height: titleBar.offsetHeight + "px",
                        background: getComputedStyle(titleBar).backgroundColor,
                        color: getComputedStyle(titleText).color,
                        display: "flex",
                        alignItems: "center",
                        padding: "0 5px",
                        font: getComputedStyle(titleText).font,
                        zIndex: parseInt(w.style.zIndex) + 1,
                        pointerEvents: "none"
                    });
                    clone.textContent = titleText.textContent;
                    document.body.appendChild(clone);

                    // 元ウィンドウはアニメ中非表示
                    w.dataset.minimized = "true";

                    animateTitleClone(clone,
                        { left: w.offsetLeft, top: w.offsetTop, width: w.offsetWidth },
                        250,
                        () => {
                            // アニメ終了時に元ウィンドウを復帰
                            w.style.visibility = "visible";
                            w.style.pointerEvents = "auto";
                            w.dataset.minimized = "false";
                            clone.remove();
                            bringToFront(w);
                            scheduleRefreshTopWindow();
                        }
                    );

                } else {
                    bringToFront(w);
                    scheduleRefreshTopWindow();
                }
            }
        }
    };


    /* ===== 最大化 ===== */

    let maximized = false;

    function toggleMaximize() {
        if (maximizing) return; // アニメ中は何もしない
        maximizing = true;

        const desktop = document.getElementById("desktop");
        const rect = desktop.getBoundingClientRect();
        const titleBar = w.querySelector(".title-bar");
        const titleText = titleBar?.querySelector(".title-text");
        if (!titleText) { maximizing = false; return; }

        w.style.pointerEvents = "none";

        if (!maximized) {
            // 最大化前のサイズを保存
            ["Left", "Top", "Width", "Height"].forEach(prop =>
                w.dataset[`prev${prop}`] = w.style[prop.toLowerCase()]
            );

            const targetRect = { left: 0, top: 0, width: rect.width };
            const clone = createTitleClone(w, titleBar, titleText);

            animateTitleClone(clone, targetRect, 250, () => {
                w.style.left = "0px";
                w.style.top = "0px";
                w.style.width = "100%";
                w.style.height = `calc(100% - 40px)`;
                clone.remove();
                w.style.pointerEvents = "auto";
                w.classList.add("maximized");
                maximizing = false; // ← アニメ終了でフラグ解除
            });

            maximized = true;
            w.classList.remove("maximized"); // アニメ中は border 残す
        } else {
            const clone = createTitleClone(w, titleBar, titleText);
            const targetRect = {
                left: parseInt(w.dataset.prevLeft),
                top: parseInt(w.dataset.prevTop),
                width: parseInt(w.dataset.prevWidth)
            };

            animateTitleClone(clone, targetRect, 250, () => {
                w.style.left = w.dataset.prevLeft;
                w.style.top = w.dataset.prevTop;
                w.style.width = w.dataset.prevWidth;
                w.style.height = w.dataset.prevHeight;
                clone.remove();
                w.style.pointerEvents = "auto";
                w.classList.remove("maximized");
                maximizing = false; // ← アニメ終了でフラグ解除
            });

            maximized = false;
        }

        scheduleRefreshTopWindow();
    }

    maxBtn.addEventListener("click", toggleMaximize);

    /* ===== 共通プレビュー ===== */

    let preview = null;

    function createPreview() {
        if (preview) preview.remove();

        preview = document.createElement("div");
        preview.style.position = "absolute";
        preview.style.border = "2px solid white";
        preview.style.background = "transparent";
        preview.style.pointerEvents = "none";
        preview.style.zIndex = parseInt(w.style.zIndex) + 1;
        preview.style.mixBlendMode = "difference";
        preview.style.boxSizing = "border-box";

        const rect = w.getBoundingClientRect();
        preview.style.left = rect.left + "px";
        preview.style.top = rect.top + "px";
        preview.style.width = rect.width + "px";
        preview.style.height = rect.height + "px";

        desktop.appendChild(preview);
    }

    /* ===== ドラッグ ===== */

    const titleBar = w.querySelector(".title-bar");
    let dragging = false, dragStarted = false;
    let didMove = false;
    let offsetX = 0, offsetY = 0, downX = 0, downY = 0;
    const DRAG_THRESHOLD = 3;

    titleBar.addEventListener("dblclick", e => {
        if (e.target.closest(".window-controls")) return;
        e.stopPropagation();
        if (!options.disableControls) toggleMaximize();
    });

    titleBar.addEventListener("mousedown", e => {
        if (e.target.closest(".window-controls")) return;
        if (maximized) return;

        dragging = true;
        dragStarted = false;
        didMove = false; // 移動フラグを初期化
        focus();

        downX = e.clientX;
        downY = e.clientY;

        const rect = w.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;

        document.body.style.userSelect = "none";

        // 他のウィンドウ操作無効化
        document.querySelectorAll(".window").forEach(win => {
            if (win !== w) win.style.pointerEvents = "none";
        });
    });

    // document 全体の mousemove
    document.addEventListener("mousemove", e => {
        if (!dragging) return;

        const dx = Math.abs(e.clientX - downX);
        const dy = Math.abs(e.clientY - downY);

        if (!dragStarted && (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD)) {
            dragStarted = true;
            createPreview();
        }

        if (!dragStarted || !preview) return;

        preview.style.left = `${e.clientX - offsetX}px`;
        preview.style.top = `${e.clientY - offsetY}px`;
        didMove = true;
    });

    // document 全体の mouseup
    document.addEventListener("mouseup", async () => {
        if (dragging && preview) {
            // preview をウィンドウに反映
            w.style.left = preview.style.left;
            w.style.top = preview.style.top;

            // 保存処理
            if (!options.skipSave && !maximized && !w.classList.contains("maximized")) {
                const data = {
                    w: w.offsetWidth,
                    h: w.offsetHeight,
                    x: Math.round(parseFloat(w.style.left)),
                    y: Math.round(parseFloat(w.style.top))
                };
                await saveWindowSize(sizeKey, data);
            }

            preview.remove();
            preview = null;
        }

        // フラグやスタイルをリセット
        dragging = false;
        dragStarted = false;
        didMove = false;

        document.querySelectorAll(".window").forEach(win => win.style.pointerEvents = "auto");
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        resizeCursor = "";
    });

    /* ===== リサイズ ===== */
    if (!options.disableResize) {
        const minWidth = 200, minHeight = 120;
        const directions = ["top", "bottom", "left", "right", "topLeft", "topRight", "bottomLeft", "bottomRight"];
        const handles = {};

        directions.forEach(dir => {
            const h = document.createElement("div");
            h.className = "resize-handle " + dir;
            h.style.position = "absolute";
            h.style.background = "transparent";
            w.appendChild(h);
            handles[dir] = h;
        });

        const setHandle = (h, pos) => Object.assign(h.style, pos);

        setHandle(handles.top, { top: "0", left: "6px", right: "6px", height: "6px", cursor: "ns-resize" });
        setHandle(handles.bottom, { bottom: "0", left: "6px", right: "6px", height: "6px", cursor: "ns-resize" });
        setHandle(handles.left, { left: "0", top: "6px", bottom: "6px", width: "6px", cursor: "ew-resize" });
        setHandle(handles.right, { right: "0", top: "6px", bottom: "6px", width: "6px", cursor: "ew-resize" });
        setHandle(handles.topLeft, { left: "0", top: "0", width: "12px", height: "12px", cursor: "nwse-resize" });
        setHandle(handles.topRight, { right: "0", top: "0", width: "12px", height: "12px", cursor: "nesw-resize" });
        setHandle(handles.bottomLeft, { left: "0", bottom: "0", width: "12px", height: "12px", cursor: "nesw-resize" });
        setHandle(handles.bottomRight, { right: "0", bottom: "0", width: "12px", height: "12px", cursor: "nwse-resize" });

        let resizing = false, currentHandle, startX, startY, startRect;
        let didResize = false;

        function startResize(e, handle) {
            if (maximized) return;
            e.stopPropagation();

            resizing = true;
            currentHandle = handle;
            focus();
            didResize = true;

            const rect = w.getBoundingClientRect();
            startRect = {
                left: Math.round(rect.left),
                top: Math.round(rect.top),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
            };

            startX = e.clientX;
            startY = e.clientY;

            createPreview();
            preview.style.left = startRect.left + "px";
            preview.style.top = startRect.top + "px";
            preview.style.width = startRect.width + "px";
            preview.style.height = startRect.height + "px";

            document.body.style.userSelect = "none";

            const cursors = {
                top: "ns-resize", bottom: "ns-resize",
                left: "ew-resize", right: "ew-resize",
                topLeft: "nwse-resize", bottomRight: "nwse-resize",
                topRight: "nesw-resize", bottomLeft: "nesw-resize"
            };
            resizeCursor = cursors[handle] || "default";
            document.body.style.cursor = resizeCursor;

            document.querySelectorAll(".window").forEach(win => {
                if (win !== w) win.style.pointerEvents = "none";
            });
        }

        directions.forEach(dir =>
            handles[dir].addEventListener("mousedown", e => startResize(e, dir))
        );

        document.addEventListener("mousemove", e => {
            if (!resizing || !preview) return;

            let dx = e.clientX - startX;
            let dy = e.clientY - startY;

            let newLeft = startRect.left;
            let newTop = startRect.top;
            let newWidth = startRect.width;
            let newHeight = startRect.height;

            switch (currentHandle) {
                case "topLeft":
                    newWidth = Math.max(minWidth, startRect.width - dx);
                    newHeight = Math.max(minHeight, startRect.height - dy);
                    newLeft = startRect.left + (startRect.width - newWidth);
                    newTop = startRect.top + (startRect.height - newHeight);
                    break;
                case "topRight":
                    newWidth = Math.max(minWidth, startRect.width + dx);
                    newHeight = Math.max(minHeight, startRect.height - dy);
                    newTop = startRect.top + (startRect.height - newHeight);
                    break;
                case "bottomLeft":
                    newWidth = Math.max(minWidth, startRect.width - dx);
                    newHeight = Math.max(minHeight, startRect.height + dy);
                    newLeft = startRect.left + (startRect.width - newWidth);
                    break;
                case "bottomRight":
                    newWidth = Math.max(minWidth, startRect.width + dx);
                    newHeight = Math.max(minHeight, startRect.height + dy);
                    break;
                case "top":
                    newHeight = Math.max(minHeight, startRect.height - dy);
                    newTop = startRect.top + (startRect.height - newHeight);
                    break;
                case "bottom":
                    newHeight = Math.max(minHeight, startRect.height + dy);
                    break;
                case "left":
                    newWidth = Math.max(minWidth, startRect.width - dx);
                    newLeft = startRect.left + (startRect.width - newWidth);
                    break;
                case "right":
                    newWidth = Math.max(minWidth, startRect.width + dx);
                    break;
            }

            preview.style.left = newLeft + "px";
            preview.style.top = newTop + "px";
            preview.style.width = newWidth + "px";
            preview.style.height = newHeight + "px";
        });

        document.addEventListener("mouseup", async () => {
            // preview がなくてもフラグ解除
            dragging = false;
            dragStarted = false;
            resizing = false;
            currentHandle = null;

            // pointerEvents や cursor を戻す
            document.querySelectorAll(".window").forEach(win => win.style.pointerEvents = "auto");
            document.body.style.userSelect = "";
            document.body.style.cursor = "";
            resizeCursor = "";

            // preview があればサイズ・位置を反映
            if (preview) {
                w.style.left = preview.style.left;
                w.style.top = preview.style.top;
                w.style.width = preview.style.width;
                w.style.height = preview.style.height;
                preview.remove();
                preview = null;
            }

            // サイズ保存
            if ((didResize || didMove) && !maximized && !w.classList.contains("maximized")) {
                if (!options.skipSave) {
                    const data = {
                        w: w.offsetWidth,
                        h: w.offsetHeight,
                        x: Math.round(parseFloat(w.style.left)),
                        y: Math.round(parseFloat(w.style.top))
                    };
                    await saveWindowSize(sizeKey, data);
                }
            }

            didResize = false;
            didMove = false;
        });


        scheduleRefreshTopWindow();
        if (!options._modal && !options.disableContextMenu) {
            installWindowContextMenu(w);
        }

        return content;
    }
    // リサイズが無効でも content を返す
    return w.querySelector(".content");
}

/* ===== ウィンドウ前面化 ===== */
export function bringToFront(win) {
    if (!win) return;
    const visibleWindows = Array.from(document.querySelectorAll(".window"))
        .filter(w => w.style.visibility !== "hidden" && w.dataset.minimized !== "true");

    const maxZ = visibleWindows.reduce((acc, w) => Math.max(acc, parseInt(w.style.zIndex) || 0), 0);
    win.style.zIndex = maxZ + 1;

    scheduleRefreshTopWindow();
}

/* =========================
   Utilities
========================= */

function createTitleClone(w, titleBar, titleText) {
    const clone = document.createElement("div");
    Object.assign(clone.style, {
        position: "absolute",
        left: w.offsetLeft + "px",
        top: w.offsetTop + "px",
        width: w.offsetWidth + "px",
        height: titleBar.offsetHeight + "px",
        background: getComputedStyle(titleBar).backgroundColor,
        color: getComputedStyle(titleText).color,
        display: "flex",
        alignItems: "center",
        padding: "0 5px",
        font: getComputedStyle(titleText).font,
        zIndex: parseInt(w.style.zIndex) + 1,
        pointerEvents: "none"
    });
    clone.textContent = titleText.textContent;
    document.body.appendChild(clone);
    return clone;
}

function animateTitleClone(clone, targetRect, duration = 250, callback) {
    const startLeft = clone.offsetLeft;
    const startTop = clone.offsetTop;
    const startWidth = clone.offsetWidth;

    const deltaLeft = targetRect.left - startLeft;
    const deltaTop = targetRect.top - startTop;
    const deltaWidth = targetRect.width - startWidth;

    const startTime = performance.now();

    function step(time) {
        const t = Math.min((time - startTime) / duration, 1);

        clone.style.left = startLeft + t * deltaLeft + "px";
        clone.style.top = startTop + t * deltaTop + "px";
        clone.style.width = startWidth + t * deltaWidth + "px";

        if (t < 1) {
            requestAnimationFrame(step);
        } else {
            callback?.();
        }
    }

    requestAnimationFrame(step);
}

/* ===== 中央表示 & ダイアログ ===== */
export function centerWindowOptions(width = 300, height = 150, parentWin = null) {
    let rect;

    if (parentWin instanceof HTMLElement) {
        rect = parentWin.getBoundingClientRect();
    } else {
        const desktop = document.getElementById("desktop");
        rect = desktop.getBoundingClientRect();
    }

    return {
        width: width + "px",
        height: height + "px",
        left: rect.left + rect.width / 2 - width / 2 + "px",
        top: rect.top + rect.height / 2 - height / 2 + "px"
    };
}

/* ===== モーダル用ウィンドウ ===== */
export function showModalWindow(title, message, options = {}) {
    // 既存のモーダルチェック
    const existing = Array.from(document.querySelectorAll(".window"))
        .find(w => w._modal && w.dataset.title === title);
    if (existing) return existing.querySelector(".content");

    // オーバーレイ作成
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    Object.assign(overlay.style, {
        position: "fixed",
        left: 0, top: 0,
        width: "100vw", height: "100vh",
        background: "rgba(0,0,0,0.4)",
        zIndex: 9999
    });
    document.body.appendChild(overlay); // ← 先に append

    // モーダルウィンドウ作成
    const content = createWindow(title, {
        ...centerWindowOptions(options.width || 320, options.height || 150),
        taskbar: options.taskbar,
        disableControls: true,
        hideRibbon: true,
        hideStatus: true,
        skipSave: true,
        _modal: true,
        disableResize: true
    });

    const win = content.parentElement;
    win._modalOverlay = overlay; // ← ここ
    win.style.zIndex = 10000;  // オーバーレイより上
    win.classList.add("modal-dialog");
    document.body.appendChild(win); // ← desktop.appendChild より上に置く

    // 内容設定
    content.innerHTML = `<p>${message}</p><div style="text-align:center; margin-top:12px;"></div>`;
    const container = content.querySelector("div");

    (options.buttons || [{ label: "OK", onClick: null }]).forEach(btn => {
        const b = document.createElement("button");
        b.textContent = btn.label;
        b.onclick = () => { win.remove(); overlay.remove(); btn.onClick?.(); };
        b.style.margin = "0 6px";
        container.appendChild(b);
    });

    return content;
}


/* ===== 便利ラッパー ===== */
export function alertWindow(message, options = {}) {
    return showModalWindow("Alert", message, options);
}

export function errorWindow(message, options = {}) {
    return showModalWindow("Error", message, { ...options, buttons: [{ label: "OK", onClick: null }] });
}

export function confirmWindow(message, callback, options = {}) {
    return showModalWindow("Confirm", message, {
        ...options,
        buttons: [
            { label: "はい", onClick: () => callback(true) },
            { label: "いいえ", onClick: () => callback(false) }
        ]
    });
}

/* ===== refreshTopWindow 更新 ===== */
export function refreshTopWindow() {
    const visibleWindows = Array.from(document.querySelectorAll(".window"))
        .filter(win => win.style.visibility !== "hidden" && win.dataset.minimized !== "true");

    let topWindow = null;

    // モーダルがあれば最優先
    const modalWin = visibleWindows.find(w => w._modal);
    if (modalWin) topWindow = modalWin;
    else if (visibleWindows.length) {
        visibleWindows.sort((a, b) =>
            parseInt(b.style.zIndex) - parseInt(a.style.zIndex)
        );
        topWindow = visibleWindows[0];
    }

    document.querySelectorAll(".window .title-bar").forEach(tb => {
        const win = tb.parentElement;
        tb.style.background = (win === topWindow) ? themeColor : DEFAULT_COLOR;
    });

    taskbarButtons.forEach(btn => {
        if (topWindow && btn._window === topWindow) btn.classList.add("selected");
        else btn.classList.remove("selected");
    });
}



/* =========================
   Window Control API
========================= */

export function getWindows() {
    return Array.from(document.querySelectorAll(".window")).map((w, index) => ({
        id: index,
        title: w.dataset.title || "Untitled",
        minimized: w.dataset.minimized === "true",
        zIndex: Number(w.style.zIndex || 0),
        el: w
    }));
}

export function removeAllTaskbarButtons() {
    taskbarButtons.forEach(btn => btn.remove());
    taskbarButtons.length = 0;
}

export function focusWindowById(id) {
    const list = getWindows();
    const win = list[id];
    if (!win) return false;
    win.el.dispatchEvent(new MouseEvent("mousedown"));
    return true;
}

export async function minimizeWindowById(id) {
    const list = getWindows();
    const win = list[id];
    if (!win) return false;

    const w = win.el;
    if (w.dataset.minimized === "true") return true;

    const taskbarBtn = w._taskbarBtn;
    if (!taskbarBtn) {
        // タスクバーがない場合は即時非表示
        w.style.display = "none";
        w.dataset.minimized = "true";
        scheduleRefreshTopWindow();
        return true;
    }

    const titleBar = w.querySelector(".title-bar");
    const titleText = titleBar?.querySelector(".title-text");
    if (!titleText) return false;

    const rect = taskbarBtn.getBoundingClientRect();
    const clone = createTitleClone(w, titleBar, titleText);

    // 元ウィンドウを非表示準備
    w.style.display = "block";
    w.style.pointerEvents = "none";
    w.style.visibility = "hidden";

    animateTitleClone(clone, { left: rect.left, top: rect.top, width: rect.width }, 250, () => {
        clone.remove();
        w.dataset.minimized = "true";
        w.style.display = "none";
        w.style.pointerEvents = "auto";
        scheduleRefreshTopWindow();
    });

    return true;
}

export function maximizeWindowById(id) {
    const list = getWindows();
    const win = list[id];
    if (!win) return false;

    const btn = win.el.querySelector(".max-btn");
    btn?.click();
    return true;
}

export function closeWindowById(id) {
    const wins = Array.from(document.querySelectorAll(".window"));
    const target = wins[id];
    if (!target) throw new Error("Invalid window id");

    const btn = target._taskbarBtn;

    if (btn) {
        btn.remove();
        const idx = taskbarButtons.indexOf(btn);
        if (idx !== -1) taskbarButtons.splice(idx, 1);
    }

    target.remove();
    scheduleRefreshTopWindow();
}

export function installWindowContextMenu(w) {
    const titleBar = w.querySelector(".title-bar");
    const taskbarBtn = w._taskbarBtn;

    // 各ボタンの存在チェックと pointer_none 判定
    const minBtn = w.querySelector(".min-btn");
    const maxBtn = w.querySelector(".max-btn");
    const closeBtn = w.querySelector(".close-btn");

    const minDisabled = minBtn?.classList.contains("pointer_none") ?? false;
    const maxDisabled = maxBtn?.classList.contains("pointer_none") ?? false;
    const closeDisabled = closeBtn?.classList.contains("pointer_none") ?? false;

    // タイトルバー右クリック
    if (titleBar) {
        attachContextMenu(titleBar, () => [
            {
                label: "最小化",
                action: () => { if (!minDisabled) minBtn?.click(); },
                disabled: minDisabled
            },
            {
                label: "最大化 / 元のサイズに戻す",
                action: () => { if (!maxDisabled) maxBtn?.click(); },
                disabled: maxDisabled || w.dataset.minimized === "true"
            },
            {
                label: "閉じる",
                action: () => { if (!closeDisabled) closeBtn?.click(); },
                disabled: closeDisabled
            }
        ]);
    }

    // タスクバー右クリック
    if (taskbarBtn) {
        attachContextMenu(taskbarBtn, () => {
            const minimized = w.dataset.minimized === "true";

            // ★ 右クリックでメニューを表示する時点でウィンドウを選択・最前面に
            if (!minimized) {
                // ウィンドウ最前面に
                bringToFront(w);

                // タイトルバー色更新
                document.querySelectorAll(".window .title-bar").forEach(tb => {
                    tb.style.background = (tb.parentElement === w) ? themeColor : "gray";
                });

                // タスクバー選択状態更新
                taskbarButtons.forEach(btn => btn.classList.remove("selected"));
                taskbarBtn.classList.add("selected");
            }

            return [
                {
                    label: "元の位置に戻す",
                    action: () => { if (!minDisabled && minimized) taskbarBtn.click(); },
                    disabled: minDisabled || !minimized
                },
                {
                    label: "最小化",
                    action: () => { if (!minDisabled && !minimized) minBtn?.click(); },
                    disabled: minDisabled || minimized
                },
                {
                    label: "最大化 / 元のサイズに戻す",
                    action: () => { if (!maxDisabled) maxBtn?.click(); },
                    disabled: maxDisabled || minimized
                },
                {
                    label: "閉じる",
                    action: () => { if (!closeDisabled) closeBtn?.click(); },
                    disabled: closeDisabled
                }
            ];
        });
    }
}
