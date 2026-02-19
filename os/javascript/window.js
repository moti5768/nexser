// window.js
import { saveWindowSize, loadWindowSize } from "./window-size-db.js";
import { themeColor } from "./apps/settings.js";
import { attachContextMenu } from "./context-menu.js";
import { setupRibbon } from "./ribbon.js";
import { killProcess } from "./kernel.js";
import { playSystemEventSound } from './kernel.js'

export const taskbarButtons = []; // 作られたボタンを全部保存
let resizeCursor = "";
const DEFAULT_COLOR = "gray";
export let TOP_COLOR = "darkblue";
/* ===== Animation Settings ===== */
export const WINDOW_ANIMATION_DURATION = 250;
export let ENABLE_WINDOW_ANIMATION = true;

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
    const abortController = new AbortController();
    const { signal } = abortController;
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

<div class="content"></div>

${!options.hideStatus ? `
<div class="window-statusbar" style="
    height: 20px;
    background: #C3C7CB;
    font-size: 12px;
    padding: 0 4px;
    display: flex;
    align-items: center;
    white-space: nowrap;      /* 改行を防ぐ */
    overflow: hidden;         /* はみ出た部分を隠す */
    text-overflow: ellipsis;  /* 長い場合に ... を表示 */
    box-sizing: border-box;   /* パディングを含めた高さ計算にする */
    border-top: 1px solid #808080; /* 必要に応じて境界線を追加 */
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

        const buttonArea =
            taskbar.querySelector(".taskbar-buttons") || taskbar;

        buttonArea.appendChild(taskbarBtn);

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

    if (options.disableMinimize) {
        minBtn?.classList.add("pointer_none");
    }

    const destroy = () => {
        abortController.abort(); // 全イベントリスナーを一括解除

        if (w._observer) {
            w._observer.disconnect();
            w._observer = null;
        }

        if (w._modalOverlay) w._modalOverlay.remove();

        if (taskbarBtn) {
            taskbarBtn._window = null;
            taskbarBtn.remove();
            const idx = taskbarButtons.indexOf(taskbarBtn);
            if (idx !== -1) taskbarButtons.splice(idx, 1);
        }
        w._taskbarBtn = null;

        if (w.dataset.processKey) {
            killProcess(w.dataset.processKey);
        }
        w.remove();
        scheduleRefreshTopWindow();
    };

    // 外部から呼べるように要素に参照を持たせる
    w._destroy = destroy;
    closeBtn.addEventListener("click", destroy);

    /* ===== 最小化アニメーション ===== */

    w._animating = false; // 共通フラグ

    minBtn.addEventListener("click", () => {
        if (w.dataset.minimized === "true" || w._animating) return;
        w._animating = true;

        const titleBar = w.querySelector(".title-bar");
        const titleText = titleBar?.querySelector(".title-text");
        if (!titleText) { w._animating = false; return; }

        const taskbarBtnRect = taskbarBtn?.getBoundingClientRect() ||
            { left: w.offsetLeft, top: w.offsetTop, width: 0 };

        w.style.pointerEvents = "none";

        const clone = createTitleClone(w, titleBar, titleText);

        animateTitleClone(clone,
            { left: taskbarBtnRect.left, top: taskbarBtnRect.top, width: taskbarBtnRect.width },
            undefined,
            () => {
                clone.remove();
                w.style.visibility = "hidden";
                w.dataset.minimized = "true";
                w.style.pointerEvents = "auto";
                w._animating = false;
                scheduleRefreshTopWindow();
            }
        );
    });
    if (taskbarBtn) {
        taskbarBtn.onclick = () => {
            taskbarButtons.forEach(btn => btn.classList.remove("selected"));
            taskbarBtn.classList.add("selected");

            if (w.dataset.minimized === "true") {
                if (w._animating) return; // アニメ中は無効化
                w._animating = true;

                const titleBar = w.querySelector(".title-bar");
                const titleText = titleBar?.querySelector(".title-text");
                if (!titleText) { w._animating = false; return; }

                w.style.visibility = "hidden";
                w.style.pointerEvents = "none";

                const rect = taskbarBtn.getBoundingClientRect();
                const clone = createTitleClone(w, titleBar, titleText);
                Object.assign(clone.style, {
                    left: rect.left + "px",
                    top: rect.top + "px",
                    width: rect.width + "px"
                });

                animateTitleClone(clone,
                    { left: w.offsetLeft, top: w.offsetTop, width: w.offsetWidth },
                    undefined,
                    () => {
                        w.style.visibility = "visible";
                        w.style.pointerEvents = "auto";
                        w.dataset.minimized = "false";
                        clone.remove();
                        bringToFront(w);
                        w._animating = false;
                        scheduleRefreshTopWindow();
                    }
                );
            } else {
                bringToFront(w);
                scheduleRefreshTopWindow();
            }
        };
    }

    /* ===== 最大化 ===== */

    let maximized = false;

    function toggleMaximize() {
        if (w._animating) return;
        w._animating = true;

        const desktop = document.getElementById("desktop");
        const rect = desktop.getBoundingClientRect();

        // ★タスクバーの高さを取得
        const taskbar = document.getElementById("taskbar");
        const taskbarHeight = taskbar ? taskbar.offsetHeight : 0;

        const titleBar = w.querySelector(".title-bar");
        const titleText = titleBar?.querySelector(".title-text");
        if (!titleText) { w._animating = false; return; }

        w.style.pointerEvents = "none";

        const clone = createTitleClone(w, titleBar, titleText);
        let targetRect;

        if (!maximized) {
            // 元サイズ保存
            ["Left", "Top", "Width", "Height"].forEach(prop =>
                w.dataset[`prev${prop}`] = w.style[prop.toLowerCase()]
            );

            // 最大化のターゲット位置（幅はデスクトップ全体、高さはタスクバーを除く）
            targetRect = {
                left: 0,
                top: 0,
                width: rect.width
            };
        } else {
            targetRect = {
                left: parseInt(w.dataset.prevLeft),
                top: parseInt(w.dataset.prevTop),
                width: parseInt(w.dataset.prevWidth)
            };
        }

        animateTitleClone(clone, targetRect, undefined, () => {
            if (!maximized) {
                w.style.left = "0px";
                w.style.top = "0px";
                w.style.width = "100%";
                // ★ここをタスクバー高さに応じて調整
                w.style.height = `calc(100% - ${taskbarHeight}px)`;
                w.classList.add("maximized");
            } else {
                w.style.left = w.dataset.prevLeft;
                w.style.top = w.dataset.prevTop;
                w.style.width = w.dataset.prevWidth;
                w.style.height = w.dataset.prevHeight;
                w.classList.remove("maximized");
            }

            clone.remove();
            w.style.pointerEvents = "auto";
            w._animating = false;
            maximized = !maximized;
            scheduleRefreshTopWindow();
        });
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
        preview.style.zIndex = (parseInt(w.style.zIndex) || 1) + 1;
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
        if (e.target.closest(".window-controls") || maximized) return;
        dragging = true;
        dragStarted = false;
        didMove = false;
        focus();
        downX = e.clientX;
        downY = e.clientY;
        const rect = w.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;

        document.body.style.userSelect = "none";
        // 他のウィンドウを操作不能にする
        document.querySelectorAll(".window").forEach(win => {
            if (win !== w) win.style.pointerEvents = "none";
        });

        // ドラッグ中のみ動く関数
        const onMouseMove = (moveEv) => {
            if (!dragging) return;
            const taskbar = document.getElementById("taskbar");
            const taskbarTop = taskbar ? taskbar.getBoundingClientRect().top : Infinity;

            let clientY = moveEv.clientY;
            if (clientY > taskbarTop - offsetY) {
                clientY = taskbarTop - offsetY;
            }

            const dx = moveEv.clientX - downX;
            const dy = clientY - downY;

            if (!dragStarted && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
                dragStarted = true;
                createPreview();
            }

            if (!dragStarted || !preview) return;

            preview.style.left = `${moveEv.clientX - offsetX}px`;
            preview.style.top = `${clientY - offsetY}px`;
            didMove = true;
        };

        // ★改善：マウスを離した時の解除処理をここで定義
        const endDrag = async () => {
            document.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("blur", endDrag);
            if (!dragging) return;

            // 操作制限の解除
            document.querySelectorAll(".window").forEach(win => win.style.pointerEvents = "auto");
            document.body.style.userSelect = "";

            if (preview) {
                if (preview.parentElement) {
                    w.style.left = preview.style.left;
                    w.style.top = preview.style.top;
                }
                preview.remove();
                preview = null;
            }

            dragging = false;
            dragStarted = false;

            // 位置保存
            if (didMove && !maximized && !w.classList.contains("maximized")) {
                if (!options.skipSave) {
                    const data = {
                        w: w.offsetWidth,
                        h: w.offsetHeight,
                        x: Math.round(parseFloat(w.style.left) || 0),
                        y: Math.round(parseFloat(w.style.top) || 0)
                    };
                    await saveWindowSize(sizeKey, data);
                }
            }
            didMove = false;
            window.removeEventListener("blur", endDrag);
            scheduleRefreshTopWindow();
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", endDrag, { capture: true, once: true });
        window.addEventListener("blur", endDrag, { once: true }); // ブラウザ外に逃げた時用
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

            const onResizeMove = (moveEv) => {
                if (!resizing || !preview) return;

                const taskbar = document.getElementById("taskbar");
                const taskbarTop = taskbar ? taskbar.getBoundingClientRect().top : Infinity;

                let dx = moveEv.clientX - startX;
                let dy = moveEv.clientY - startY;

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

                if (newTop + newHeight > taskbarTop) {
                    newHeight = taskbarTop - newTop;
                }

                preview.style.left = newLeft + "px";
                preview.style.top = newTop + "px";
                preview.style.width = newWidth + "px";
                preview.style.height = newHeight + "px";
            };

            // ★改善：リサイズ解除用の処理
            const endResize = async () => {
                document.removeEventListener("mousemove", onResizeMove);
                if (!resizing) return;

                document.querySelectorAll(".window").forEach(win => win.style.pointerEvents = "auto");
                document.body.style.userSelect = "";
                document.body.style.cursor = "";
                resizeCursor = "";

                if (preview) {
                    if (preview.parentElement) {
                        w.style.left = preview.style.left;
                        w.style.top = preview.style.top;
                        w.style.width = preview.style.width;
                        w.style.height = preview.style.height;
                    }
                    preview.remove();
                    preview = null;
                }

                resizing = false;
                currentHandle = null;

                if (didResize && !maximized && !w.classList.contains("maximized")) {
                    if (!options.skipSave) {
                        const data = {
                            w: w.offsetWidth,
                            h: w.offsetHeight,
                            x: Math.round(parseFloat(w.style.left) || 0),
                            y: Math.round(parseFloat(w.style.top) || 0)
                        };
                        await saveWindowSize(sizeKey, data);
                    }
                }
                didResize = false;
                scheduleRefreshTopWindow();
            };

            document.addEventListener("mousemove", onResizeMove);
            document.addEventListener("mouseup", endResize, { capture: true, once: true });
            window.addEventListener("blur", endResize, { once: true });
        }

        directions.forEach(dir =>
            handles[dir].addEventListener("mousedown", e => startResize(e, dir))
        );

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
    const wins = Array.from(document.querySelectorAll(".window"));
    const maxZ = wins.reduce((max, w) => Math.max(max, parseInt(w.style.zIndex) || 100), 100);
    win.style.zIndex = maxZ + 1;
    scheduleRefreshTopWindow();
    if (!win.contains(document.activeElement)) {
        win.setAttribute("tabindex", "-1"); // フォーカス可能にする
        win.focus();
    }
}

/* =========================
   Utilities
========================= */

function createTitleClone(w, titleBar, titleText) {
    const rect = w.getBoundingClientRect();
    const clone = document.createElement("div");

    Object.assign(clone.style, {
        position: "fixed",
        left: rect.left + "px",
        top: rect.top + "px",
        width: rect.width + "px",
        height: titleBar.offsetHeight + "px",
        background: getComputedStyle(titleBar).backgroundColor,
        color: getComputedStyle(titleText).color,
        display: "flex",
        alignItems: "center",
        padding: "0 5px",
        zIndex: parseInt(w.style.zIndex) + 1,
        pointerEvents: "none",
        overflow: "hidden"  // 親でも overflow hidden は必要
    });

    // テキスト用 span を作る
    const span = document.createElement("span");
    span.textContent = titleText.textContent;
    Object.assign(span.style, {
        font: getComputedStyle(titleText).font,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        flexShrink: "1",
        minWidth: "0"
    });

    clone.appendChild(span);
    document.body.appendChild(clone);
    return clone;
}

function animateTitleClone(clone, targetRect, duration = WINDOW_ANIMATION_DURATION, callback) {
    // ★追加：duration=0対応
    if (!ENABLE_WINDOW_ANIMATION || duration <= 0) {
        clone.style.left = targetRect.left + "px";
        clone.style.top = targetRect.top + "px";
        clone.style.width = targetRect.width + "px";
        callback?.();
        return;
    }

    const rect = clone.getBoundingClientRect(); // ←変更

    const startLeft = rect.left;
    const startTop = rect.top;
    const startWidth = rect.width;

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
    const parentWin = options.parentWin;

    // --- 1. システム音の再生 ---
    // options.silent が true の場合は再生をスキップ
    if (typeof playSystemEventSound === "function" && options.silent !== true) {
        if (options.iconClass === "error_icon") {
            playSystemEventSound('error');
        } else {
            playSystemEventSound('notify');
        }
    }

    // --- 2. 重複表示の防止 ---
    if (parentWin) {
        if (!parentWin._activeDialogs) parentWin._activeDialogs = new Set();

        // 同じメッセージのダイアログが既に開いていれば、その要素を探して返す
        if (parentWin._activeDialogs.has(message)) {
            const existingWin = Array.from(document.querySelectorAll(".window"))
                .find(w => w.innerText.includes(message)); // メッセージ内容で検索
            return existingWin ? existingWin.querySelector(".content") : null;
        }
        parentWin._activeDialogs.add(message);
    }

    // 既存の同タイトル・同種モーダルがあれば再利用または防止
    const existing = Array.from(document.querySelectorAll(".window"))
        .find(w => w._modal && w.dataset.title === title);
    if (existing) return existing.querySelector(".content");

    // --- 3. オーバーレイ作成 ---
    let overlay = null;
    if (options.overlay === true) {
        overlay = document.createElement("div");
        overlay.className = "modal-overlay";
        Object.assign(overlay.style, {
            position: "fixed",
            left: 0, top: 0,
            width: "100vw", height: "100vh",
            background: "rgba(0,0,0,0.4)",
            zIndex: 9999
        });
        document.body.appendChild(overlay);
    }

    // --- 4. ウィンドウ本体の作成 ---
    const winWidth = options.width || 340;
    const winHeight = options.height || 160;

    // 既存の createWindow 関数を利用 (外部定義済みと想定)
    const content = createWindow(title, {
        ...centerWindowOptions(winWidth, winHeight, parentWin),
        taskbar: (options.taskbar !== undefined) ? options.taskbar : false,
        disableControls: true,
        hideRibbon: true,
        hideStatus: true,
        skipSave: true,
        _modal: true,
        disableResize: true
    });

    const win = content.parentElement;

    // ★ 高さの自動調整ロジック
    if (!options.height) {
        win.style.height = "auto";
        win.style.minHeight = "120px";
        win.style.maxHeight = "85vh"; // 画面を突き抜けないように制限
        content.style.height = "auto";
        content.style.overflowY = "auto"; // 内容が多すぎる場合はスクロール
    }

    win._modalOverlay = overlay;
    win.style.zIndex = 10000;
    win.classList.add("modal-dialog");
    win.style.position = "absolute";
    document.body.appendChild(win);

    // --- 5. 配置（ポジショニング）の最適化 ---
    if (parentWin) {
        parentWin.style.pointerEvents = "none"; // 親をロック

        const rect = parentWin.getBoundingClientRect();
        const left = rect.left + (rect.width - winWidth) / 2;
        const top = rect.top + (rect.height / 2); // 一旦中央点へ配置

        win.style.left = `${left}px`;
        win.style.top = `${top}px`;

        // 高さが auto の場合、描画後の実サイズを元に transform で中央補正し、その後に px 固定
        if (!options.height) {
            win.style.transform = "translateY(-50%)";
            requestAnimationFrame(() => {
                const finalRect = win.getBoundingClientRect();
                win.style.transform = "none";
                win.style.top = `${finalRect.top}px`;
            });
        }
    } else if (!options.height) {
        // 親がない場合、画面の中央に配置
        win.style.left = "50%";
        win.style.top = "50%";
        win.style.transform = "translate(-50%, -50%)";
        requestAnimationFrame(() => {
            const finalRect = win.getBoundingClientRect();
            win.style.transform = "none";
            win.style.top = `${finalRect.top}px`;
            win.style.left = `${finalRect.left}px`;
        });
    }

    // --- 6. 終了処理の定義 ---
    const closeDialog = (callback) => {
        if (parentWin) {
            parentWin._activeDialogs.delete(message);
            parentWin.style.pointerEvents = "auto"; // ロック解除
        }
        if (win._observer) win._observer.disconnect();
        win.remove();
        if (overlay) overlay.remove();
        if (typeof callback === "function") callback();
    };

    // 親ウィンドウがDOMから削除されたら、モーダルも道連れで消す
    if (parentWin) {
        const observer = new MutationObserver(() => {
            if (!document.body.contains(parentWin)) {
                closeDialog();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        win._observer = observer;
    }

    // --- 7. UI構築 (アイコン・テキスト・ボタン) ---
    content.style.position = "relative";
    content.style.display = "flex";
    content.style.flexDirection = "column";
    content.style.minHeight = "100px";

    let iconHtml = "";
    if (options.iconClass) {
        const iconChar = options.iconClass === "warning_icon" ? "!" : "";
        iconHtml = `<div class="${options.iconClass}" style="top: 20px;">${iconChar}</div>`;
    }

    const textMargin = options.iconClass ? "margin-left: 45px;" : "";
    content.innerHTML = `
        <div style="flex: 1; padding: 20px 15px; display: flex; align-items: flex-start;">
            ${iconHtml}
            <div style="${textMargin} line-height: 1.4; word-break: break-all;">
                ${message}
            </div>
        </div>
        <div class="button-container" style="text-align:center; padding-bottom:10px; padding-top:5px;"></div>
    `;

    const container = content.querySelector(".button-container");
    (options.buttons || [{ label: "OK", onClick: null }]).forEach(btn => {
        const b = document.createElement("button");
        b.textContent = btn.label;
        b.onclick = () => closeDialog(btn.onClick);
        b.style.margin = "0 6px";
        b.style.minWidth = "70px";
        b.style.padding = "4px 10px";
        container.appendChild(b);
    });

    // 右上の [x] ボタン等がある場合のハンドリング
    const closeBtn = win.querySelector(".close-btn");
    if (closeBtn) closeBtn.onclick = () => closeDialog();

    return content;
}

/* ===== 便利ラッパーの更新 ===== */

export function alertWindow(message, options = {}) {
    // options.silent が true でない場合のみ音を鳴らす
    if (options.silent !== true) {
        playSystemEventSound('notify');
    }

    return showModalWindow("Alert", message, {
        ...options,
        iconClass: "warning_icon", // 黄色の警告アイコンを適用
        silent: true
    });
}

export function errorWindow(message, options = {}) {
    return showModalWindow("Error", message, {
        ...options,
        iconClass: "error_icon", // 赤色のエラーアイコンを適用
        buttons: [{ label: "OK", onClick: null }]
    });
}

export function confirmWindow(message, callback, options = {}) {
    return showModalWindow("Confirm", message, {
        ...options,
        iconClass: "warning_icon", // 確認ダイアログも警告アイコンを使用
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
        tb.style.background = (win === topWindow) ? (themeColor || DEFAULT_COLOR) : DEFAULT_COLOR;
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
        // タスクバーがない場合は即時非表示（visibility に統一）
        w.style.visibility = "hidden";
        w.dataset.minimized = "true";
        scheduleRefreshTopWindow();
        return true;
    }

    const titleBar = w.querySelector(".title-bar");
    const titleText = titleBar?.querySelector(".title-text");
    if (!titleText) return false;

    const rect = taskbarBtn.getBoundingClientRect();
    const clone = createTitleClone(w, titleBar, titleText);

    // 元ウィンドウはアニメ中非表示
    w.style.pointerEvents = "none";
    w.style.visibility = "hidden";

    animateTitleClone(clone, { left: rect.left, top: rect.top, width: rect.width }, undefined, () => {
        clone.remove();
        w.dataset.minimized = "true";
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
    if (btn) btn.click();
    return true;
}

export function closeWindowById(id) {
    const wins = Array.from(document.querySelectorAll(".window"));
    const target = wins[id];
    if (!target) throw new Error("Invalid window id");

    // 単なる remove() ではなく、定義したクリーンアップ関数を実行
    if (typeof target._destroy === "function") {
        target._destroy();
    } else {
        // フォールバック
        target.remove();
    }
}

export function installWindowContextMenu(w) {
    const titleBar = w.querySelector(".title-bar");
    const taskbarBtn = w._taskbarBtn;

    // 各ボタンの存在チェックと pointer_none 判定
    const minBtn = w.querySelector(".min-btn");
    const maxBtn = w.querySelector(".max-btn");
    const closeBtn = w.querySelector(".close-btn");

    const minDisabled = minBtn && minBtn.classList.contains("pointer_none");
    const maxDisabled = maxBtn && maxBtn.classList.contains("pointer_none");
    const closeDisabled = closeBtn && closeBtn.classList.contains("pointer_none");

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

export function setWindowAnimationEnabled(v) {
    ENABLE_WINDOW_ANIMATION = v;
}