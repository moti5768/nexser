// window.js
import { nextZ } from "./zindex.js";
import { saveWindowSize, loadWindowSize } from "./window-size-db.js";
import { themeColor } from "./apps/settings.js"; // これを使う
import { attachContextMenu } from "./context-menu.js";

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
        // ウィンドウ外かつ context-menu 外なら色リセット
        if (!e.target.closest(".window") && !e.target.closest(".context-menu")) {
            const titles = document.getElementsByClassName("title-bar");
            for (const tb of titles) {
                tb.style.background = DEFAULT_COLOR;
            }
            taskbarButtons.forEach(btn => btn.classList.remove("selected"));
        }
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
    w.style.zIndex = nextZ();

    w.innerHTML = `
        <div class="title-bar">
            <span class="title-text">${title}</span>
            <div class="window-controls">
                <button class="min-btn"></button>
                <button class="max-btn"></button>
                <button class="close-btn"></button>
            </div>
        </div>
        <div class="content"></div>
    `;

    const desktop = document.getElementById("desktop");
    desktop.appendChild(w);
    const content = w.querySelector(".content");

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
        w.style.zIndex = nextZ();
        if (w.dataset.minimized === "true") restoreWindow();
        scheduleRefreshTopWindow();
    };

    w.addEventListener("mousedown", focus);

    /* ===== タスクバー ===== */

    const taskbar = document.getElementById("taskbar");
    let taskbarBtn;

    if (taskbar && options.taskbar !== false) {
        w.dataset.taskbar = "true";

        taskbarBtn = document.createElement("button");
        taskbarBtn.textContent = title;
        taskbarBtn.className = "taskbar-window-btn button";
        taskbarBtn.dataset.title = title;

        // 相互リンク
        taskbarBtn._window = w;
        w._taskbarBtn = taskbarBtn;

        taskbarBtn.onclick = focus;

        taskbar.appendChild(taskbarBtn);
        taskbarButtons.push(taskbarBtn);
    } else {
        w.dataset.taskbar = "false";
    }

    /* ===== ウィンドウボタン ===== */

    const closeBtn = w.querySelector(".close-btn");
    const minBtn = w.querySelector(".min-btn");
    const maxBtn = w.querySelector(".max-btn");

    if (options.disableControls) {
        [minBtn, maxBtn].forEach(btn => btn.classList.add("pointer_none"));
    }

    closeBtn.addEventListener("click", () => {
        w.remove();

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

        const clone = createTitleClone(w, titleBar, titleText); // ★ 共通関数化
        w.style.pointerEvents = "none";

        animateTitleClone(clone,
            { left: taskbarBtnRect.left, top: taskbarBtnRect.top, width: taskbarBtnRect.width },
            250,
            () => {
                w.style.visibility = "hidden";
                w.style.pointerEvents = "none";
                w.dataset.minimized = "true";
                clone.remove();
                minimizing = false;  // 安全にフラグ解除
                scheduleRefreshTopWindow();
            }
        );
    });

    /* ===== タスクバークリックで復元 ===== */

    if (taskbarBtn) {
        taskbarBtn.onclick = () => {

            w.style.zIndex = nextZ();
            taskbarButtons.forEach(btn => btn.classList.remove("selected"));
            taskbarBtn.classList.add("selected");

            if (w.dataset.minimized === "true") {
                w.dataset.minimized = "false";
                minimizing = false;

                const titleBar = w.querySelector(".title-bar");
                const titleText = titleBar?.querySelector(".title-text");
                if (!titleText) return;

                const rect = taskbarBtn.getBoundingClientRect();

                const clone = document.createElement("div");
                clone.style.position = "absolute";
                clone.style.left = rect.left + "px";
                clone.style.top = rect.top + "px";
                clone.style.width = rect.width + "px";
                clone.style.height = titleBar.offsetHeight + "px";
                clone.style.background = getComputedStyle(titleBar).backgroundColor;
                clone.style.color = getComputedStyle(titleText).color;
                clone.style.display = "flex";
                clone.style.alignItems = "center";
                clone.style.padding = "0 5px";
                clone.style.font = getComputedStyle(titleText).font;
                clone.textContent = titleText.textContent;
                clone.style.zIndex = parseInt(w.style.zIndex) + 1;
                clone.style.pointerEvents = "none";
                w.style.pointerEvents = "none";

                document.body.appendChild(clone);

                animateTitleClone(
                    clone,
                    { left: w.offsetLeft, top: w.offsetTop, width: w.offsetWidth },
                    250,
                    () => {
                        w.style.visibility = "visible";
                        w.style.pointerEvents = "auto";
                        clone.remove();
                        w.style.zIndex = nextZ();
                        scheduleRefreshTopWindow();
                    }
                );
            } else {
                focus();
            }
        };
    }

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
        focus();

        downX = e.clientX;      // ★ 修正
        downY = e.clientY;      // ★ 修正

        const rect = w.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;

        document.body.style.userSelect = "none";

        document.querySelectorAll(".window").forEach(win => {
            if (win !== w) win.style.pointerEvents = "none";
        });
    });

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
    });

    /* ===== リサイズ ===== */

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
        if ((dragging || resizing) && preview) {
            w.style.left = preview.style.left;
            w.style.top = preview.style.top;
            w.style.width = preview.style.width;
            w.style.height = preview.style.height;
            if (dragStarted) didMove = true;
            preview.remove();
            preview = null;
        }

        document.querySelectorAll(".window")
            .forEach(win => win.style.pointerEvents = "auto");

        dragging = false;
        dragStarted = false;
        resizing = false;
        currentHandle = null;

        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        resizeCursor = "";

        // ===== サイズ・位置保存 =====
        if ((didResize || didMove) && !maximized && !w.classList.contains("maximized")) {
            const data = {
                w: w.offsetWidth,
                h: w.offsetHeight,
                x: Math.round(parseFloat(w.style.left)),
                y: Math.round(parseFloat(w.style.top))
            };

            await saveWindowSize(sizeKey, data);
            console.log("SAVE WINDOW", sizeKey, data);
        }

        didResize = false;
        didMove = false;

    });

    scheduleRefreshTopWindow();

    installWindowContextMenu(w);

    return content;
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

export function centerWindowOptions(width = 300, height = 150) {
    const desktop = document.getElementById("desktop");
    const rect = desktop.getBoundingClientRect();

    return {
        width: width + "px",
        height: height + "px",
        left: rect.left + rect.width / 2 - width / 2 + "px",
        top: rect.top + rect.height / 2 - height / 2 + "px"
    };
}

export function alertWindow(message, options = {}) {
    const content = createWindow("Alert", {
        ...centerWindowOptions(300, 150),
        taskbar: options.taskbar,
        disableControls: true
    });
    content.innerHTML = `<p>${message}</p>`;
    return content;
}

export function errorWindow(message, options = {}) {
    const content = createWindow("Error", {
        ...centerWindowOptions(300, 150),
        taskbar: options.taskbar,
        disableControls: true
    });
    content.innerHTML = `<p style="color:red">${message}</p>`;
    return content;
}

export function confirmWindow(message, callback, options = {}) {
    const content = createWindow("Confirm", {
        ...centerWindowOptions(350, 150),
        taskbar: options.taskbar,
        disableControls: true
    });

    content.innerHTML = `
        <p>${message}</p>
        <div style="text-align:center; margin-top:10px;">
            <button id="okBtn">OK</button>
            <button id="cancelBtn">Cancel</button>
        </div>
    `;

    content.querySelector("#okBtn").onclick = () => {
        callback(true);
        content.parentElement.remove();
        scheduleRefreshTopWindow();
    };

    content.querySelector("#cancelBtn").onclick = () => {
        callback(false);
        content.parentElement.remove();
        scheduleRefreshTopWindow();
    };
}

/* ===== 手前ウィンドウ管理 ===== */

export function refreshTopWindow() {
    const visibleWindows = Array.from(document.querySelectorAll(".window"))
        .filter(win => win.style.visibility !== "hidden" && win.dataset.minimized !== "true");
    let topWindow = null;
    if (visibleWindows.length) {
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
        if (topWindow && btn._window === topWindow) {
            btn.classList.add("selected");
        } else {
            btn.classList.remove("selected");
        }
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

export function minimizeWindowById(id) {
    const list = getWindows();
    const win = list[id];
    if (!win) return false;

    win.el.style.visibility = "hidden";
    win.el.style.pointerEvents = "none";
    win.el.dataset.minimized = "true";

    scheduleRefreshTopWindow();
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
                w.style.zIndex = nextZ();

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
