// window.js
import { saveWindowSize, loadWindowSize } from "./window-size-db.js";
import { themeColor, themeColor2, inactiveThemeColor, inactiveThemeColor2 } from "./apps/settings.js";
import { attachContextMenu } from "./context-menu.js";
import { setupRibbon } from "./ribbon.js";
import { killProcess } from "./kernel.js";
import { playSystemEventSound } from './sounds.js';
import { getIcon } from "./file-associations.js";

export const taskbarButtons = []; // 作られたボタンを全部保存
let resizeCursor = "";
const DEFAULT_COLOR = "gray";
export let TOP_COLOR = "darkblue";
let windowIdCounter = 0;
const windowSizeCache = new Map();
/* ===== ウィンドウの斜め配置（カスケード）設定 ===== */
let windowCascadeCount = 0;
const CASCADE_STEP = 28;         // ずらすピクセル幅
const MAX_CASCADE_OFFSET = 350;  // 画面端（最大オフセット）に達したら折り返す限界値
/* ===== Animation Settings ===== */
export const WINDOW_ANIMATION_DURATION = 250;
export let ENABLE_WINDOW_ANIMATION = true;
export let ENABLE_WINDOW_PREVIEW = true;

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
            e.target.closest(".context-menu") ||
            e.target.closest(".taskbar-window-btn")
        ) return;

        // ★ ウィンドウ外（デスクトップなど）をクリックしたときのみ非アクティブ化（ただし背景ブロック中のモーダルがあれば維持）
        if (!win) {
            const hasVisibleModal = Array.from(document.querySelectorAll(".window"))
                .some(w => w._modal && !w._allowBackgroundClick && w.style.visibility !== "hidden" && w.dataset.minimized !== "true");
            if (hasVisibleModal) {
                scheduleRefreshTopWindow();
            } else {
                resetAllTitleBars();
            }
        }
    });

    // ★ 追加: iframe（クロスオリジン含む）クリック時の手前表示対応
    window.addEventListener("blur", () => {
        // フォーカスの切り替わりが完了するまでイベントループを1つ回す
        setTimeout(() => {
            const active = document.activeElement;

            // 現在フォーカスされているのが iframe 要素だった場合
            if (active && active.tagName === "IFRAME") {
                const win = active.closest(".window");
                // その iframe が属するウィンドウがあれば、最前面に移動させる
                if (win && !win._modal) {
                    bringToFront(win);
                }
            }
        }, 0);
    });

    window.addEventListener("resize", () => {
        refreshMaximizedWindows();
    });
}

let lastFocusedWindow = null;

/* ===== 全ウィンドウ色リセット ===== */
export function resetAllTitleBars() {
    lastFocusedWindow = null;
    const inactiveBg = inactiveThemeColor2
        ? `linear-gradient(90deg, ${inactiveThemeColor || DEFAULT_COLOR}, ${inactiveThemeColor2})`
        : (inactiveThemeColor || DEFAULT_COLOR);

    document.querySelectorAll(".window").forEach(win => {
        const tb = win.querySelector(".title-bar");
        if (tb) tb.style.background = inactiveBg;
        win.classList.add("inactive-window");
    });
    taskbarButtons.forEach(btn => btn.classList.remove("selected"));
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
    const windowId = `win_${++windowIdCounter}`;
    // ★ グローバルイベントは1回だけ登録
    installGlobalMouseHandler();

    const startMenu = document.getElementById("start-menu");
    const startBtn = document.getElementById("start-btn");
    if (startMenu) startMenu.style.display = "none";
    if (startBtn) startBtn.classList.remove("pressed");

    const w = document.createElement("div");
    w.className = "window";
    w.dataset.windowId = windowId;
    w.dataset.title = title;
    w._modal = Boolean(options._modal);
    w.style.position = "absolute";

    const isFrameless = options.frameless === true;
    if (isFrameless) {
        w.classList.add("frameless-window");
        w.style.border = "none";
        w.style.background = "transparent";
        w.style.boxShadow = "none";
        // 💡 改善: 他の復元ロジック等で外枠が auto に書き換わるのを徹底防衛
        w.style.setProperty("pointer-events", "none", "important");
    }

    // ▼ 改善後：斜め配置 ＆ 端に達したときの折り返しロジック
    if (windowCascadeCount * CASCADE_STEP > MAX_CASCADE_OFFSET) {
        windowCascadeCount = 0;
    }
    const defaultOffset = windowCascadeCount++ * CASCADE_STEP;

    w.style.left = options.left || `${100 + defaultOffset}px`;
    w.style.top = options.top || `${100 + defaultOffset}px`;
    if (isFrameless) {
        w.style.width = options.width || "auto";
        w.style.height = options.height || "auto";
    } else {
        w.style.width = options.width || "650px";
        w.style.height = options.height || "350px";
    }
    bringToFront(w);

    const initialIcon = "📄";
    const finalIcon = getIcon(title, options.node || { type: "app" });
    if (isFrameless) {
        // 💡 改善: 内部コンテンツは pointer-events: auto を強固に保障
        w.innerHTML = `<div class="content" style="width:100%; height:100%; padding:0; border:none; background:transparent; position:relative; overflow:hidden; pointer-events: auto !important;"></div>`;
    } else {
        w.innerHTML = `
<div class="title-bar" style="display: flex; align-items: center; padding: 0 5px;">
    <span class="window-icon" style="margin-right: 6px; font-size: 14px;"></span>
    <span class="title-text" style="flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></span>
    <div class="window-controls" style="display: flex; flex-shrink: 0;">
        <button class="min-btn" data-tooltip = "最小化"></button>
        <button class="max-btn" data-tooltip = "最大化 / 元のサイズに戻す"></button>
        <button class="close-btn" data-tooltip = "閉じる"></button>
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
<div class="window-statusbar resize_icon">
    Ready
</div>` : ""}
`;
    }

    const iconEl = w.querySelector(".window-icon");
    if (iconEl) iconEl.textContent = initialIcon;

    const titleTextEl = w.querySelector(".title-text");
    if (titleTextEl) titleTextEl.textContent = title;

    w._applyRealIcon = (newTitle = null, newNode = null) => {
        if (!w.isConnected) return; // すでに閉じられていたら何もしない
        const resolvedIcon = (newTitle || newNode)
            ? getIcon(newTitle || w.dataset.title || title, newNode || options.node || { type: "file" })
            : finalIcon;
        const iconEl = w.querySelector(".window-icon");
        if (iconEl) iconEl.textContent = resolvedIcon;
        if (w._taskbarBtn && w._taskbarBtn.isConnected) {
            const tbIcon = w._taskbarBtn.querySelector(".taskbar-icon");
            if (tbIcon) tbIcon.textContent = resolvedIcon;
        }
    };

    // リボン要素を確実に取得
    const content = w.querySelector(".content");
    w._ribbon = w.querySelector(".window-ribbon");

    // ウィンドウ作成時にリボンを初期化する
    if (w._ribbon && !options.hideRibbon) {
        const appMenus = options.ribbonMenus || [];

        setupRibbon(
            w,
            options.getCurrentPath || (() => null),
            options.renderCallback || null,
            appMenus // そのまま渡す。Windowメニューはribbon.jsが勝手に足してくれる。
        );
    }

    const desktop = document.getElementById("desktop");
    if (desktop) {
        desktop.appendChild(w);
    } else {
        // desktopが見つからない場合はbodyに追加（これでエラーを回避）
        document.body.appendChild(w);
    }
    w._statusBar = w.querySelector(".window-statusbar");
    w._applyRealIcon();
    emit("windowCreated", { windowId, title, element: w, options });

    /* ===== サイズ復元（メモリキャッシュから即時適用 ＆ 一意なキー化） ===== */
    const sizeKey = options.sizeKey || options.processKey || title;

    w._abortController = abortController;
    const applyClampedBounds = (size) => {
        const maxW = Math.max(200, window.innerWidth);
        const maxH = Math.max(110, window.innerHeight);
        if (size.w) w.style.width = Math.min(size.w, maxW) + "px";
        if (size.h) w.style.height = Math.min(size.h, maxH) + "px";
        if (size.x !== undefined) {
            const clampedX = Math.max(0, Math.min(size.x, Math.max(0, window.innerWidth - 80)));
            w.style.left = clampedX + "px";
        }
        if (size.y !== undefined) {
            const clampedY = Math.max(0, Math.min(size.y, Math.max(0, window.innerHeight - 40)));
            w.style.top = clampedY + "px";
        }
    };

    // 1. まずメモリキャッシュから即座に（同期的に）サイズを適用（タイムラグなし）
    const cachedSize = windowSizeCache.get(sizeKey);
    if (cachedSize) {
        applyClampedBounds(cachedSize);
    }

    // 2. バックグラウンド（または初回起動時）のためにDBからもロードしてキャッシュを初期化
    loadWindowSize(sizeKey).then(size => {
        if (!size) return;
        windowSizeCache.set(sizeKey, size);
        if (!cachedSize && w.isConnected) {
            applyClampedBounds(size);
        }
    }).catch(err => {
        console.warn(`Failed to load window size for key "${sizeKey}":`, err);
    });

    /* ===== フォーカス & 復元 ===== */

    const restoreWindow = () => {
        w.style.visibility = "visible";
        // 💡 改善: フレームレスウィンドウの場合は外枠の pointer-events を auto に戻さない
        if (!isFrameless) {
            w.style.pointerEvents = "auto";
        }
        w.dataset.minimized = "false";

        const input = w.querySelector("input, textarea");
        if (input) input.focus();

        const screen = w.querySelector(".terminal-screen");
        if (screen) screen.scrollTop = screen.scrollHeight;
    };

    const focus = () => {
        bringToFront(w);
        if (w._modal) {
            refreshTopWindow(w);
            return;
        }

        if (w.dataset.minimized === "true") restoreWindow();
    };

    w.addEventListener("mousedown", focus, { signal });

    /* ===== 操作有効/無効の初期状態 ===== */
    const controlState = {
        minimize: options.disableMinimize !== undefined
            ? !options.disableMinimize
            : (options.minimizable !== undefined ? Boolean(options.minimizable) : !options.disableControls),
        maximize: options.disableMaximize !== undefined
            ? !options.disableMaximize
            : (options.maximizable !== undefined ? Boolean(options.maximizable) : !options.disableControls),
        close: options.disableClose !== undefined
            ? !options.disableClose
            : (options.closable !== undefined ? Boolean(options.closable) : true),
        resize: options.disableResize !== undefined
            ? !options.disableResize
            : (options.resizable !== undefined ? Boolean(options.resizable) : true)
    };
    w._controlState = controlState;
    w._resizeHandles = [];

    /* ===== タスクバー ===== */

    const taskbar = document.getElementById("taskbar");
    let taskbarBtn = null; // 初期値は null
    const shouldCreateTaskbarBtn = options.taskbar !== false && !isFrameless;

    const bindTaskbarBtnEvents = (btn) => {
        btn.onclick = () => {
            if (w.dataset.minimized === "true") {
                if (w._animating) return;
                w._animating = true;
                playSystemEventSound('restore');
                const titleBar = w.querySelector(".title-bar");
                const titleText = titleBar?.querySelector(".title-text");
                if (!titleText) { w._animating = false; return; }

                const rect = btn.getBoundingClientRect();

                // 1. 【重要】チラつきを防ぐため、真っ先に本体を隠す
                w.style.visibility = "hidden";
                w.style.pointerEvents = "none";
                w.dataset.minimized = "false";

                if (w._modalOverlay) {
                    w._modalOverlay.style.display = "";
                }

                // 2. 本体をアクティブ状態（青色）にする
                bringToFront(w);
                refreshTopWindow(w);

                taskbarButtons.forEach(b => b.classList.remove("selected"));
                btn.classList.add("selected");

                // 3. アクティブ色になった状態でクローンを作る
                const clone = createTitleClone(w, titleBar, titleText);
                Object.assign(clone.style, {
                    left: rect.left + "px",
                    top: rect.top + "px",
                    width: rect.width + "px"
                });

                const winStyle = window.getComputedStyle(w);
                const borderLeft = parseFloat(winStyle.borderLeftWidth) || 0;
                const borderTop = parseFloat(winStyle.borderTopWidth) || 0;

                // 4. アニメーション実行
                animateTitleClone(clone,
                    {
                        left: w.offsetLeft + borderLeft,
                        top: w.offsetTop + borderTop,
                        width: w.offsetWidth - (borderLeft * 2)
                    },
                    undefined,
                    () => {
                        w.style.visibility = "visible";
                        if (!isFrameless) {
                            w.style.pointerEvents = "auto";
                        }
                        clone.remove();
                        w._animating = false;

                        // モーダル等で一時的に作成されたタスクバーボタンは復元後に整理
                        if (btn._isTemporaryForMinimize) {
                            btn._window = null;
                            if (btn.isConnected) btn.remove();
                            const idx = taskbarButtons.indexOf(btn);
                            if (idx !== -1) taskbarButtons.splice(idx, 1);
                            if (taskbarBtn === btn) taskbarBtn = null;
                            if (w._taskbarBtn === btn) w._taskbarBtn = null;
                        }

                        if (!w.contains(document.activeElement)) {
                            w.setAttribute("tabindex", "-1");
                            w.focus();
                        }

                        scheduleRefreshTopWindow();
                    }
                );
            } else {
                const isActive = !w.classList.contains("inactive-window");

                if (isActive) {
                    const minBtn = w.querySelector(".min-btn");
                    if (minBtn && !minBtn.classList.contains("pointer_none")) {
                        minBtn.click();
                    }
                } else {
                    bringToFront(w);
                    refreshTopWindow(w);
                }
            }
        };
    };

    const ensureTaskbarButton = (isTemporary = false) => {
        if (taskbarBtn && taskbarBtn.isConnected) return taskbarBtn;
        const tb = document.getElementById("taskbar");
        if (!tb || isFrameless) return null;

        const currentTitle = w.dataset.title || title;
        const currentIcon = w.querySelector(".window-icon")?.textContent || initialIcon;

        const btn = document.createElement("button");
        btn.className = "taskbar-window-btn button";
        btn.dataset.tooltip = currentTitle;
        btn.dataset.title = currentTitle;
        btn._isTemporaryForMinimize = isTemporary;

        const tbIconSpan = document.createElement("span");
        tbIconSpan.className = "taskbar-icon";
        tbIconSpan.textContent = currentIcon;

        const tbTextSpan = document.createElement("span");
        tbTextSpan.className = "taskbar-text";
        tbTextSpan.textContent = currentTitle;

        btn.appendChild(tbIconSpan);
        btn.appendChild(tbTextSpan);

        btn._window = w;
        w._taskbarBtn = btn;
        taskbarBtn = btn;

        const buttonArea = tb.querySelector(".taskbar-buttons") || tb;
        buttonArea.appendChild(btn);
        taskbarButtons.push(btn);

        bindTaskbarBtnEvents(btn);
        if (!isTemporary) {
            installWindowContextMenu(w);
        }
        return btn;
    };

    if (taskbar && shouldCreateTaskbarBtn) {
        w.dataset.taskbar = "true";
        ensureTaskbarButton(false);
    } else {
        w.dataset.taskbar = "false";
        taskbarBtn = null;
    }

    // モーダルウィンドウでは右クリックメニューを出さない
    if (!options._modal && !options.disableContextMenu) {
        installWindowContextMenu(w);
    } else if (options._modal) {
        w.addEventListener("contextmenu", (e) => {
            if (e.target.closest("input, textarea")) return;
            e.preventDefault();
            e.stopPropagation();
        }, { signal });
    }

    /* ===== ウィンドウボタン・破棄処理 ===== */

    const closeBtn = w.querySelector(".close-btn");
    const minBtn = w.querySelector(".min-btn");
    const maxBtn = w.querySelector(".max-btn");

    const applyControlStates = () => {
        if (minBtn) {
            minBtn.classList.toggle("pointer_none", !controlState.minimize);
            minBtn.setAttribute("aria-disabled", String(!controlState.minimize));
        }
        if (maxBtn) {
            maxBtn.classList.toggle("pointer_none", !controlState.maximize);
            maxBtn.setAttribute("aria-disabled", String(!controlState.maximize));
        }
        if (closeBtn) {
            closeBtn.classList.toggle("pointer_none", !controlState.close);
            closeBtn.setAttribute("aria-disabled", String(!controlState.close));
        }
        if (Array.isArray(w._resizeHandles)) {
            w._resizeHandles.forEach(h => {
                h.style.display = controlState.resize ? "" : "none";
                h.style.pointerEvents = controlState.resize ? "auto" : "none";
            });
        }
        if (w._statusBar) {
            w._statusBar.classList.toggle("resize_icon", Boolean(controlState.resize));
        }
    };

    w._setControls = (next = {}) => {
        if (typeof next.all === "boolean") {
            controlState.minimize = next.all;
            controlState.maximize = next.all;
            controlState.close = next.all;
            controlState.resize = next.all;
        }
        if (next.minimize !== undefined) controlState.minimize = Boolean(next.minimize);
        if (next.maximize !== undefined) controlState.maximize = Boolean(next.maximize);
        if (next.close !== undefined) controlState.close = Boolean(next.close);
        if (next.resize !== undefined) controlState.resize = Boolean(next.resize);
        applyControlStates();
        return { ...controlState };
    };

    w._getControls = () => ({ ...controlState });

    // 初期状態をDOMへ反映
    applyControlStates();

    // 【改善後】オブザーバーを廃止し、destroy に後始末を集約して軽量化
    const destroy = () => {
        if (!controlState.close) {
            return;
        }

        // 1. 共通の後始末（イベントリスナー全解除、サウンド、オーバーレイ削除など）
        abortController.abort(); // メモリリーク防止

        if (!options._modal && !options.silent) {
            playSystemEventSound('close');
        }

        if (w._modalOverlay) w._modalOverlay.remove();

        if (taskbarBtn) {
            taskbarBtn._window = null;
            if (taskbarBtn.isConnected) taskbarBtn.remove();
            const idx = taskbarButtons.indexOf(taskbarBtn);
            if (idx !== -1) taskbarButtons.splice(idx, 1); // ゾンビボタンを完全に排除
        }
        w._taskbarBtn = null;

        // 2. プロセス管理されている場合はカーネルに委譲、それ以外は直接削除
        if (w.dataset.processKey) {
            killProcess(w.dataset.processKey);
        } else {
            if (w.isConnected) {
                w.remove();
            }
        }
        emit("windowDestroyed", { windowId: w.dataset.windowId, title: w.dataset.title, element: w });
        scheduleRefreshTopWindow();
    };

    // 外部から呼べるように要素に参照を持たせる
    w._destroy = destroy;
    closeBtn?.addEventListener("click", destroy, { signal });

    /* ===== 最小化アニメーション ===== */

    w._animating = false; // 共通フラグ
    w._ensureTaskbarButton = ensureTaskbarButton;

    minBtn?.addEventListener("click", () => {
        if (!controlState.minimize) return;
        if (w.dataset.minimized === "true" || w._animating) return;
        w._animating = true;
        playSystemEventSound('minimize');
        const titleBar = w.querySelector(".title-bar");
        const titleText = titleBar?.querySelector(".title-text");
        if (!titleText) { w._animating = false; return; }

        // タスクバー非表示設定のモーダル等でも復元できるよう一時ボタンを確保
        const activeTbBtn = ensureTaskbarButton(true);
        const taskbarBtnRect = activeTbBtn?.getBoundingClientRect() ||
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
                if (w._modalOverlay) {
                    w._modalOverlay.style.display = "none";
                }
                if (!isFrameless) {
                    w.style.pointerEvents = "auto";
                }
                w._animating = false;
                scheduleRefreshTopWindow();
            }
        );
    });

    /* ===== 最大化 ===== */

    let maximized = false;

    function toggleMaximize() {
        if (!controlState.maximize) return;
        if (w._animating) return;
        w._animating = true;

        const desktop = document.getElementById("desktop");
        const rect = desktop.getBoundingClientRect();

        const taskbar = document.getElementById("taskbar");

        // デフォルトの最大化領域（画面全体）
        let targetLeft = 0;
        let targetTop = 0;
        let targetWidth = rect.width;
        let targetHeight = rect.height;

        // タスクバーの位置とサイズを動的に取得して最大化領域を計算する
        if (taskbar) {
            const isWindowMode = taskbar.closest(".window") !== null;

            if (!isWindowMode) {
                const tbRect = taskbar.getBoundingClientRect();
                const style = window.getComputedStyle(taskbar);
                const matrix = new WebKitCSSMatrix(style.transform);
                const translateY = matrix.m42;
                const translateX = matrix.m41;

                // 上下左右のどこにタスクバーがあるかを判定して領域を調整
                if (tbRect.top <= 0 && tbRect.height < tbRect.width) {
                    // 上部配置 (Top)
                    const visibleH = Math.max(0, taskbar.offsetHeight - Math.abs(translateY));
                    targetTop = visibleH;
                    targetHeight -= visibleH;
                } else if (tbRect.bottom >= window.innerHeight && tbRect.height < tbRect.width) {
                    // 下部配置 (Bottom)
                    const visibleH = Math.max(0, taskbar.offsetHeight - Math.abs(translateY));
                    targetHeight -= visibleH;
                } else if (tbRect.left <= 0 && tbRect.width < tbRect.height) {
                    // 左側配置 (Left)
                    const visibleW = Math.max(0, taskbar.offsetWidth - Math.abs(translateX));
                    targetLeft = visibleW;
                    targetWidth -= visibleW;
                } else if (tbRect.right >= window.innerWidth && tbRect.width < tbRect.height) {
                    // 右側配置 (Right)
                    const visibleW = Math.max(0, taskbar.offsetWidth - Math.abs(translateX));
                    targetWidth -= visibleW;
                }
            }
        }

        const titleBar = w.querySelector(".title-bar");
        const titleText = titleBar?.querySelector(".title-text");
        if (!titleText) { w._animating = false; return; }

        w.style.pointerEvents = "none";

        const clone = createTitleClone(w, titleBar, titleText);
        let targetRect;

        if (!maximized) {
            playSystemEventSound('maximize');
            const currentRect = w.getBoundingClientRect();
            w.dataset.prevLeft = w.style.left || `${Math.round(currentRect.left)}px`;
            w.dataset.prevTop = w.style.top || `${Math.round(currentRect.top)}px`;
            w.dataset.prevWidth = (w.style.width && w.style.width !== "auto") ? w.style.width : `${Math.round(currentRect.width)}px`;
            w.dataset.prevHeight = (w.style.height && w.style.height !== "auto") ? w.style.height : `${Math.round(currentRect.height)}px`;
            w.dataset.prevMaxHeight = w.style.maxHeight || "";
            w.dataset.prevContentHeight = content ? (content.style.height || "") : "";

            targetRect = {
                left: targetLeft,
                top: targetTop,
                width: targetWidth,
                height: targetHeight
            };
        } else {
            playSystemEventSound('restore');
            targetRect = {
                left: parseInt(w.dataset.prevLeft) || 0,
                top: parseInt(w.dataset.prevTop) || 0,
                width: parseInt(w.dataset.prevWidth) || 340,
                height: parseInt(w.dataset.prevHeight) || 160
            };
        }

        animateTitleClone(clone, targetRect, undefined, () => {
            if (!maximized) {
                w.style.maxHeight = "none";
                w.style.left = `${targetRect.left}px`;
                w.style.top = `${targetRect.top}px`;
                w.style.width = `${targetRect.width}px`;
                w.style.height = `${targetRect.height}px`;
                if (w._modal && content) {
                    const tbH = titleBar ? titleBar.offsetHeight : 0;
                    content.style.height = `calc(100% - ${tbH}px)`;
                }
                w.classList.add("maximized");
            } else {
                w.style.left = w.dataset.prevLeft;
                w.style.top = w.dataset.prevTop;
                w.style.width = w.dataset.prevWidth;
                w.style.height = w.dataset.prevHeight;
                w.style.maxHeight = w.dataset.prevMaxHeight || "";
                if (w._modal && content) {
                    content.style.height = w.dataset.prevContentHeight || "auto";
                }
                w.classList.remove("maximized");
            }

            clone.remove();
            if (!isFrameless) {
                w.style.pointerEvents = "auto";
            }
            w._animating = false;
            maximized = !maximized;
            scheduleRefreshTopWindow();
        });
    }

    maxBtn?.addEventListener("click", toggleMaximize);

    /* ===== 共通プレビュー ===== */

    let preview = null;

    function createPreview() {
        if (!ENABLE_WINDOW_PREVIEW) return; // ★ 追加: 無効時はプレビューを作成しない
        if (preview) preview.remove();

        const winZ = parseInt(w.style.zIndex) || 1;
        let previewZ = winZ + 1;

        if (w._modal) {
            // モーダル自身のプレビューは他のモーダルより手前に配置する
            const allModals = Array.from(document.querySelectorAll(".window")).filter(winEl => winEl._modal);
            const maxModalZ = allModals.reduce((max, winEl) => Math.max(max, parseInt(winEl.style.zIndex) || 10000), 10000);
            previewZ = Math.max(winZ + 1, maxModalZ + 1);
        } else {
            // 通常ウィンドウのプレビューはタスクバーおよびモーダルより必ず後ろに制限する
            const taskbarEl = document.getElementById("taskbar");
            const isTaskbarDocked = taskbarEl && !taskbarEl.closest(".window");
            const taskbarZ = isTaskbarDocked ? parseInt(window.getComputedStyle(taskbarEl).zIndex, 10) : NaN;

            const maxAllowedZ = !Number.isNaN(taskbarZ)
                ? Math.min(taskbarZ - 1, 9997)
                : 9997;

            previewZ = Math.min(winZ + 1, Math.max(1, maxAllowedZ));
        }

        preview = document.createElement("div");
        preview.style.position = "fixed";
        preview.style.border = "2px solid white";
        preview.style.background = "transparent";
        preview.style.pointerEvents = "none";
        preview.style.zIndex = previewZ;
        preview.style.mixBlendMode = "difference";
        preview.style.boxSizing = "border-box";

        const rect = w.getBoundingClientRect();
        preview.style.left = rect.left + "px";
        preview.style.top = rect.top + "px";
        preview.style.width = rect.width + "px";
        preview.style.height = rect.height + "px";

        document.body.appendChild(preview);
    }

    /* ===== ドラッグ ===== */

    const titleBar = w.querySelector(".title-bar");
    let dragging = false, dragStarted = false;
    let didMove = false;
    let offsetX = 0, offsetY = 0, downX = 0, downY = 0;
    const DRAG_THRESHOLD = 3;
    let lastTap = 0;
    let rafId = null;
    let latestClientX = 0;
    let latestClientY = 0;

    if (titleBar) {
        titleBar.addEventListener("pointerdown", e => {
            // マウスの場合は左クリック(0)のみ反応させる。タッチは常に通す
            if (e.pointerType === "mouse" && e.button !== 0) return;

            // --- ダブルタップ / ダブルクリック 判定 ---
            const now = Date.now();
            const DOUBLE_TAP_DELAY = 300; // 300ms 以内ならダブルとみなす

            if (now - lastTap < DOUBLE_TAP_DELAY) {
                // ダブル操作確定時の処理
                if (e.target.closest(".window-controls")) return;
                e.stopPropagation();

                if (controlState.maximize) {
                    toggleMaximize();
                }

                // ダブルタップ成功時は lastTap をリセットして3連タップを防止
                lastTap = 0;
                return;
            }
            lastTap = now;

            if (e.target.closest(".window-controls") || e.target.closest(".resize-handle") || maximized) return;

            dragging = true;
            dragStarted = false;
            didMove = false;
            focus();

            const dragShield = document.createElement("div");
            Object.assign(dragShield.style, {
                position: "fixed",
                top: 0, left: 0,
                width: "100vw", height: "100vh",
                zIndex: 9998,
                background: "transparent"
            });
            document.body.appendChild(dragShield);

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

            // ドラッグ中のみ動く関数 (pointermove) - rAFで最適化
            const onPointerMove = (moveEv) => {
                if (!dragging) return;

                latestClientX = moveEv.clientX;
                latestClientY = moveEv.clientY;

                // すでに次のフレーム描画が予約されている場合は重複して予約しない
                if (rafId) return;

                rafId = requestAnimationFrame(() => {
                    rafId = null;
                    if (!dragging) return;

                    let clientX = latestClientX;
                    let clientY = latestClientY;

                    // ★ タスクバー自身のウィンドウモードでなければ、マウスカーソルがタスクバーに乗ったときの制限をかける
                    if (w.dataset.title !== "Taskbar") {
                        const taskbar = document.getElementById("taskbar");
                        // タスクバーがウィンドウモードの場合は制限を無視する
                        const isTaskbarWindowMode = taskbar && taskbar.closest(".window") !== null;

                        if (taskbar && !isTaskbarWindowMode) {
                            const tbRect = taskbar.getBoundingClientRect();

                            // マウスカーソルが上下左右のタスクバー領域に入った場合の制限
                            if (tbRect.top <= 0 && tbRect.height < tbRect.width) {
                                // 上部タスクバー
                                if (clientY < tbRect.bottom) clientY = tbRect.bottom;
                            } else if (tbRect.bottom >= window.innerHeight && tbRect.height < tbRect.width) {
                                // 下部タスクバー
                                if (clientY > tbRect.top) clientY = tbRect.top;
                            }

                            if (tbRect.left <= 0 && tbRect.width < tbRect.height) {
                                // 左側タスクバー
                                if (clientX < tbRect.right) clientX = tbRect.right;
                            } else if (tbRect.right >= window.innerWidth && tbRect.width < tbRect.height) {
                                // 右側タスクバー
                                if (clientX > tbRect.left) clientX = tbRect.left;
                            }
                        }
                    }

                    const dx = clientX - downX;
                    const dy = clientY - downY;

                    // 閾値を超えたらプレビュー枠を作成
                    if (!dragStarted && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
                        dragStarted = true;
                        createPreview();
                    }

                    if (!dragStarted) return;

                    // 制限された clientX, clientY を基にウィンドウ（またはプレビュー）の座標を計算
                    let newLeft = clientX - offsetX;
                    let newTop = clientY - offsetY;

                    if (newTop < 0) {
                        newTop = 0;
                    }

                    // プレビューがあればプレビューを動かし、なければウィンドウを直接動かす
                    if (preview) {
                        preview.style.left = `${newLeft}px`;
                        preview.style.top = `${newTop}px`;
                    } else {
                        w.style.left = `${newLeft}px`;
                        w.style.top = `${newTop}px`;
                    }
                    didMove = true;
                });
            };

            // 解除処理 (pointerup / pointercancel)
            const endDrag = async () => {
                document.removeEventListener("pointermove", onPointerMove);
                window.removeEventListener("blur", endDrag);

                // 予約されていた rAF が残っていれば確実にキャンセルする
                if (rafId) {
                    cancelAnimationFrame(rafId);
                    rafId = null;
                }

                if (!dragging) return;

                // 操作制限の解除（ブロック中モーダルを持つ親ウィンドウは維持）
                document.querySelectorAll(".window").forEach(win => {
                    if (!win.classList.contains("frameless-window") && (!win._blockingDialogs || win._blockingDialogs.size === 0)) {
                        win.style.pointerEvents = "auto";
                    }
                });
                document.body.style.userSelect = "";

                if (preview) {
                    if (preview.parentElement) {
                        w.style.left = preview.style.left;
                        w.style.top = preview.style.top;
                    }
                    preview.remove();
                    preview = null;
                }
                dragShield.remove();
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
                        // メモリキャッシュを即座に更新
                        windowSizeCache.set(sizeKey, data);
                        // バックグラウンドでDBにも保存
                        await saveWindowSize(sizeKey, data);
                    }
                }
                didMove = false;
                scheduleRefreshTopWindow();
            };

            // リスナーを pointer 系に変更
            document.addEventListener("pointermove", onPointerMove);
            document.addEventListener("pointerup", endDrag, { capture: true, once: true });
            document.addEventListener("pointercancel", endDrag, { capture: true, once: true }); // タッチ中断用
            window.addEventListener("blur", endDrag, { once: true });
        });
    }

    /* ===== リサイズ（後から有効化できるようハンドル自体は常に生成） ===== */
    if (!isFrameless) {
        const minWidth = 200, minHeight = 110;
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

        w._resizeHandles = Object.values(handles);
        applyControlStates();

        const setHandle = (h, pos) => Object.assign(h.style, pos);

        setHandle(handles.top, { top: "-6px", left: "0", right: "0", height: "10px", cursor: "ns-resize" });
        setHandle(handles.bottom, { bottom: "-6px", left: "0", right: "0", height: "10px", cursor: "ns-resize" });
        setHandle(handles.left, { left: "-6px", top: "0", bottom: "0", width: "10px", cursor: "ew-resize" });
        setHandle(handles.right, { right: "-6px", top: "0", bottom: "0", width: "10px", cursor: "ew-resize" });
        setHandle(handles.topLeft, { left: "-6px", top: "-6px", width: "14px", height: "14px", cursor: "nwse-resize" });
        setHandle(handles.topRight, { right: "-6px", top: "-6px", width: "14px", height: "14px", cursor: "nesw-resize" });
        setHandle(handles.bottomLeft, { left: "-6px", bottom: "-6px", width: "14px", height: "14px", cursor: "nesw-resize" });
        setHandle(handles.bottomRight, { right: "-6px", bottom: "-6px", width: "20px", height: "20px", cursor: "nwse-resize" });

        let resizing = false, currentHandle, startX, startY, startRect;
        let didResize = false;

        // ★追加: requestAnimationFrame とキャッシュ用の変数
        let resizeRafId = null;
        let latestClientX = 0;
        let latestClientY = 0;

        function startResize(e, handle) {
            if (maximized || !controlState.resize) return;

            // マウスの場合は左クリック(0)のみ反応させる。タッチ(pointerType === 'touch')は常に通す
            if (e.pointerType === "mouse" && e.button !== 0) return;

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

            const resizeShield = document.createElement("div");
            Object.assign(resizeShield.style, {
                position: "fixed",
                top: 0, left: 0,
                width: "100vw", height: "100vh",
                zIndex: 9998,
                background: "transparent",
            });
            const cursors = {
                top: "ns-resize", bottom: "ns-resize",
                left: "ew-resize", right: "ew-resize",
                topLeft: "nwse-resize", bottomRight: "nwse-resize",
                topRight: "nesw-resize", bottomLeft: "nesw-resize"
            };
            resizeShield.style.cursor = cursors[handle] || "default";
            document.body.appendChild(resizeShield);
            resizeCursor = cursors[handle] || "default";
            document.body.style.cursor = resizeCursor;

            document.querySelectorAll(".window").forEach(win => {
                if (win !== w) win.style.pointerEvents = "none";
            });

            // ★追加: リサイズ開始時にタスクバーの情報を1度だけキャッシュ（毎フレームのDOM検索・再計算を排除）
            const taskbar = document.getElementById("taskbar");
            const isTaskbarWindowMode = taskbar ? taskbar.closest(".window") !== null : false;
            let tbRect = null, translateY = 0, translateX = 0, taskbarOffsetH = 0, taskbarOffsetW = 0;

            if (taskbar && !isTaskbarWindowMode) {
                tbRect = taskbar.getBoundingClientRect();
                const style = window.getComputedStyle(taskbar);
                const matrix = new WebKitCSSMatrix(style.transform);
                translateY = matrix.m42;
                translateX = matrix.m41;
                taskbarOffsetH = taskbar.offsetHeight;
                taskbarOffsetW = taskbar.offsetWidth;
            }

            const onResizeMove = (moveEv) => {
                if (!resizing) return;

                latestClientX = moveEv.clientX;
                latestClientY = moveEv.clientY;

                if (resizeRafId) return; // すでにフレーム描画が予約されていればスキップ

                resizeRafId = requestAnimationFrame(() => {
                    resizeRafId = null;
                    if (!resizing) return;

                    let dx = latestClientX - startX;
                    let dy = latestClientY - startY;

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

                    if (w.dataset.title === "Taskbar" || isTaskbarWindowMode) {
                        if (newTop < 0) {
                            newTop = 0;
                        }
                    } else if (tbRect) {
                        // キャッシュされた変数を利用してタスクバー配置に応じたリサイズ制限を計算
                        if (tbRect.top <= 0 && tbRect.height < tbRect.width) {
                            // Top配置
                            const visibleH = Math.max(0, taskbarOffsetH - Math.abs(translateY));
                            if (newTop < visibleH) {
                                newHeight -= (visibleH - newTop);
                                newTop = visibleH;
                            }
                        } else if (tbRect.bottom >= window.innerHeight && tbRect.height < tbRect.width) {
                            // Bottom配置
                            const visibleH = Math.max(0, taskbarOffsetH - Math.abs(translateY));
                            const maxBottom = window.innerHeight - visibleH;
                            if (newTop + newHeight > maxBottom) {
                                newHeight = maxBottom - newTop;
                            }
                        }

                        if (tbRect.left <= 0 && tbRect.width < tbRect.height) {
                            // Left配置
                            const visibleW = Math.max(0, taskbarOffsetW - Math.abs(translateX));
                            if (newLeft < visibleW) {
                                newWidth -= (visibleW - newLeft);
                                newLeft = visibleW;
                            }
                        } else if (tbRect.right >= window.innerWidth && tbRect.width < tbRect.height) {
                            // Right配置
                            const visibleW = Math.max(0, taskbarOffsetW - Math.abs(translateX));
                            const maxRight = window.innerWidth - visibleW;
                            if (newLeft + newWidth > maxRight) {
                                newWidth = maxRight - newLeft;
                            }
                        }
                    }

                    if (newTop < 0) newTop = 0;
                    if (newLeft < 0) newLeft = 0;

                    // プレビューがあればプレビューを更新し、なければウィンドウを直接リサイズ
                    if (preview) {
                        preview.style.left = newLeft + "px";
                        preview.style.top = newTop + "px";
                        preview.style.width = newWidth + "px";
                        preview.style.height = newHeight + "px";
                    } else {
                        w.style.left = newLeft + "px";
                        w.style.top = newTop + "px";
                        w.style.width = newWidth + "px";
                        w.style.height = newHeight + "px";
                    }
                });
            };

            const endResize = async () => {
                // Pointerイベントの解除
                document.removeEventListener("pointermove", onResizeMove);
                document.removeEventListener("pointerup", endResize, { capture: true });
                document.removeEventListener("pointercancel", endResize, { capture: true });

                // 未処理の rAF があればクリア
                if (resizeRafId) {
                    cancelAnimationFrame(resizeRafId);
                    resizeRafId = null;
                }

                if (!resizing) return;

                document.querySelectorAll(".window").forEach(win => {
                    if (!win.classList.contains("frameless-window") && (!win._blockingDialogs || win._blockingDialogs.size === 0)) {
                        win.style.pointerEvents = "auto";
                    }
                });
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
                if (w._modal) {
                    w.style.maxHeight = "none";
                    if (content) {
                        const tbH = titleBar ? titleBar.offsetHeight : 0;
                        content.style.height = `calc(100% - ${tbH}px)`;
                    }
                }
                resizeShield.remove();
                resizing = false;
                currentHandle = null;

                if (didResize && !maximized && !w.classList.contains("maximized")) {
                    playSystemEventSound('resize');
                    if (!options.skipSave) {
                        const data = {
                            w: w.offsetWidth,
                            h: w.offsetHeight,
                            x: Math.round(parseFloat(w.style.left) || 0),
                            y: Math.round(parseFloat(w.style.top) || 0)
                        };
                        // メモリキャッシュを即座に更新
                        windowSizeCache.set(sizeKey, data);
                        // バックグラウンドでDBにも保存
                        await saveWindowSize(sizeKey, data);
                    }
                }
                didResize = false;
                scheduleRefreshTopWindow();
            };

            // 最新版：Pointer Events を使用
            document.addEventListener("pointermove", onResizeMove);
            document.addEventListener("pointerup", endResize, { capture: true, once: true });
            document.addEventListener("pointercancel", endResize, { capture: true, once: true });
            window.addEventListener("blur", endResize, { once: true });
        }

        directions.forEach(dir =>
            handles[dir].addEventListener("pointerdown", e => {
                // マウスの場合は左クリック(0)のみ反応させる。タッチは常に通す
                if (e.pointerType === "mouse" && e.button !== 0) return;
                startResize(e, dir);
            })
        );
    }

    scheduleRefreshTopWindow();

    if (!options._modal && !options.silent) {
        playSystemEventSound('open');
    }

    // ★ リサイズの有無に関わらず、生成した content を確実に返却
    return content;
}

export function resetWindowIdCounter() {
    windowIdCounter = 0;
}

/* ===== ウィンドウ前面化 ===== */
export function bringToFront(win) {
    if (!win || win.classList.contains("ime-toolbar-window")) return; // ⭐ ツールバーならスルー
    lastFocusedWindow = win;
    const wins = Array.from(document.querySelectorAll(".window:not(.ime-toolbar-window)")); // ⭐ ツールバーを除外

    if (win._modal) {
        // モーダルは常に 10000 以上の専用レイヤーで最前面へ配置
        const maxModalZ = wins
            .filter(w => w._modal && w !== win)
            .reduce((max, w) => Math.max(max, parseInt(w.style.zIndex) || 10000), 10000);
        win.style.zIndex = maxModalZ + 1;
        if (win._modalOverlay) {
            win._modalOverlay.style.zIndex = maxModalZ;
        }
    } else {
        // 通常ウィンドウはモーダル(10000以上)より下のレイヤーに制限
        const normalWins = wins.filter(w => !w._modal);
        let maxNormalZ = normalWins.reduce((max, w) => Math.max(max, parseInt(w.style.zIndex) || 0), 0);
        if (maxNormalZ >= 9900) {
            normalWins
                .sort((a, b) => (parseInt(a.style.zIndex) || 0) - (parseInt(b.style.zIndex) || 0))
                .forEach((w, idx) => { w.style.zIndex = idx + 1; });
            maxNormalZ = normalWins.length;
        }
        win.style.zIndex = maxNormalZ + 1;
    }

    scheduleRefreshTopWindow();
    emit("windowActivated", { windowId: win.dataset.windowId, title: win.dataset.title, element: win });
    if (win.dataset && win.dataset.processKey) {
        window.dispatchEvent(new CustomEvent("window-activated", {
            detail: { processKey: win.dataset.processKey }
        }));
    }

    if (!win.contains(document.activeElement) && win.style.visibility !== "hidden") {
        win.setAttribute("tabindex", "-1");
        win.focus();
    }
}

/* =========================
   Utilities
========================= */

function createTitleClone(w, titleBar, titleText) {
    const titleRect = titleBar.getBoundingClientRect(); // ★ タイトルバー自体の正確な座標を取得
    const clone = document.createElement("div");

    const titleBarStyles = getComputedStyle(titleBar);
    const titleTextStyles = getComputedStyle(titleText);

    Object.assign(clone.style, {
        position: "fixed",
        left: titleRect.left + "px",   // ★ タイトルバーの正確な左座標
        top: titleRect.top + "px",     // ★ タイトルバーの正確な上座標
        width: titleRect.width + "px", // ★ タイトルバーの正確な幅
        height: titleRect.height + "px",
        background: titleBarStyles.background,
        color: titleBarStyles.color,
        display: "flex",
        alignItems: "center",
        padding: titleBarStyles.padding,
        zIndex: Math.max(parseInt(w.style.zIndex) + 1, 10002),
        pointerEvents: "none",
        overflow: "hidden",
        boxSizing: "border-box"
    });

    // 2. 内容をコピー
    clone.innerHTML = titleBar.innerHTML;

    // 3. 複製されたテキスト要素に元のフォントを強制適用
    const clonedText = clone.querySelector(".title-text");
    if (clonedText) {
        Object.assign(clonedText.style, {
            font: titleTextStyles.font,
            letterSpacing: titleTextStyles.letterSpacing,
            lineHeight: titleTextStyles.lineHeight,
            flex: "1",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
        });
    }

    const controls = clone.querySelector(".window-controls");
    if (controls) {
        controls.style.display = "none";
    }

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
        if (desktop) {
            rect = desktop.getBoundingClientRect();
        } else {
            // ★ desktop要素が見つからない場合はブラウザの表示領域を基準にする
            rect = {
                left: 0,
                top: 0,
                width: window.innerWidth,
                height: window.innerHeight
            };
        }
    }

    return {
        width: width + "px",
        height: height + "px",
        // rect が取得できていれば、ここでの計算はエラーになりません
        left: rect.left + rect.width / 2 - width / 2 + "px",
        top: rect.top + rect.height / 2 - height / 2 + "px"
    };
}

/* ===== モーダル用ウィンドウ ===== */
export function showModalWindow(title, message, options = {}) {
    const modalTitle = options.title != null ? String(options.title) : title;
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

    // --- 2. 重複表示の防止（タイトル + メッセージの完全一致のみ再利用） ---
    const msgKey = typeof message === "string" ? message : "";
    const dialogKey = `${modalTitle}\0${msgKey}`;

    if (options.allowDuplicate !== true) {
        const existing = Array.from(document.querySelectorAll(".window")).find(w =>
            w._modal &&
            w.dataset.title === modalTitle &&
            (w.dataset.modalMessage ?? "") === msgKey
        );
        if (existing) {
            bringToFront(existing);
            refreshTopWindow(existing);
            return existing.querySelector(".content");
        }
    }

    if (parentWin) {
        if (!parentWin._activeDialogs) parentWin._activeDialogs = new Set();
        parentWin._activeDialogs.add(dialogKey);
    }

    // すでに表示中のモーダルがある場合、完全に重ならないよう少しずつ右下にずらす
    const activeModalCount = Array.from(document.querySelectorAll(".window"))
        .filter(w => w._modal && w.style.visibility !== "hidden" && w.dataset.minimized !== "true")
        .length;
    const stackOffset = (activeModalCount % 6) * 24;

    let allowBackgroundClick = options.allowBackgroundClick === true || options.blockBackground === false;

    // --- 3. オーバーレイ作成 ---
    let overlay = null;
    if (options.overlay === true) {
        overlay = document.createElement("div");
        overlay.className = "modal-overlay";
        Object.assign(overlay.style, {
            position: "fixed",
            left: 0, top: 0,
            width: "100vw", height: "100vh",
            background: allowBackgroundClick ? "transparent" : "rgba(0,0,0,0.4)",
            pointerEvents: allowBackgroundClick ? "none" : "auto",
            zIndex: 9999
        });
        document.body.appendChild(overlay);
    }

    // --- 4. ウィンドウ本体の作成 ---
    const winWidth = options.width || 340;
    const winHeight = options.height || 160;

    // ★ 変更点: options.cascade が true の場合は中央配置オプションをバイパスし、
    // createWindow 側のカスケード（斜め配置）位置を活かす
    const positionOpts = options.cascade === true
        ? { width: winWidth + "px", height: winHeight + "px" }
        : centerWindowOptions(winWidth, winHeight, parentWin);

    if (options.cascade !== true && stackOffset > 0) {
        positionOpts.left = `${parseFloat(positionOpts.left) + stackOffset}px`;
        positionOpts.top = `${parseFloat(positionOpts.top) + stackOffset}px`;
    }

    const modalDisableResize = options.disableResize !== undefined
        ? options.disableResize
        : (options.resizable !== undefined ? !options.resizable : true);

    // 既存の createWindow 関数を利用
    const content = createWindow(modalTitle, {
        ...positionOpts,
        taskbar: (options.taskbar !== undefined) ? options.taskbar : false,
        disableControls: options.disableControls !== undefined ? options.disableControls : false,
        disableMinimize: options.disableMinimize,
        disableMaximize: options.disableMaximize,
        disableClose: options.disableClose,
        minimizable: options.minimizable,
        maximizable: options.maximizable,
        closable: options.closable,
        hideRibbon: true,
        hideStatus: true,
        skipSave: true,
        _modal: true,
        disableResize: modalDisableResize
    });

    const win = content.parentElement;

    // ★ 高さの自動調整ロジック
    if (!options.height) {
        win.style.height = "auto";
        win.style.minHeight = "110px";
        win.style.maxHeight = "85vh"; // 画面を突き抜けないように制限
        content.style.height = "auto";
        content.style.overflowY = "auto"; // 内容が多すぎる場合はスクロール
    }

    win._modal = true;
    win._allowBackgroundClick = allowBackgroundClick;
    win.dataset.modalMessage = msgKey;
    win._modalOverlay = overlay;
    win.classList.add("modal-dialog");
    win.style.position = "absolute";
    document.body.appendChild(win);

    const syncParentLock = () => {
        if (!parentWin) return;
        if (!parentWin._blockingDialogs) parentWin._blockingDialogs = new Set();
        if (allowBackgroundClick) {
            parentWin._blockingDialogs.delete(win);
        } else {
            parentWin._blockingDialogs.add(win);
        }
        if (parentWin._blockingDialogs.size === 0) {
            if (!parentWin.classList.contains("frameless-window")) {
                parentWin.style.pointerEvents = "auto";
            }
        } else {
            parentWin.style.pointerEvents = "none";
        }
    };

    win._setBackgroundClickable = (clickable) => {
        allowBackgroundClick = Boolean(clickable);
        win._allowBackgroundClick = allowBackgroundClick;
        if (overlay) {
            overlay.style.pointerEvents = allowBackgroundClick ? "none" : "auto";
            overlay.style.background = allowBackgroundClick ? "transparent" : "rgba(0,0,0,0.4)";
        }
        syncParentLock();
        scheduleRefreshTopWindow();
        return allowBackgroundClick;
    };

    // モーダル専用レイヤーで最前面化し、即座にタイトルバーをアクティブ色にする
    bringToFront(win);
    refreshTopWindow(win);

    // --- 5. 配置（ポジショニング）の最適化 ---
    // ★ 変更点: cascade が true の場合は中央寄せの上書き処理をスキップ
    if (options.cascade === true) {
        // createWindow が計算したカスケード位置をそのまま維持
    } else if (parentWin) {
        syncParentLock(); // allowBackgroundClick が false の場合のみ親をロック

        const rect = parentWin.getBoundingClientRect();
        const left = rect.left + (rect.width - winWidth) / 2 + stackOffset;
        const top = rect.top + (rect.height / 2) + stackOffset;

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
        // 親がない場合、画面の中央に配置（複数時は stackOffset 分ずらす）
        win.style.left = `calc(50% + ${stackOffset}px)`;
        win.style.top = `calc(50% + ${stackOffset}px)`;
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
            parentWin._activeDialogs?.delete(dialogKey);
            parentWin._blockingDialogs?.delete(win);
            if ((!parentWin._blockingDialogs || parentWin._blockingDialogs.size === 0) &&
                (!parentWin._activeDialogs || parentWin._activeDialogs.size === 0)) {
                if (!parentWin.classList.contains("frameless-window")) {
                    parentWin.style.pointerEvents = "auto"; // ロック中のモーダルがなくなった時のみロック解除
                }
            }
        }
        if (win._taskbarBtn) {
            const tbBtn = win._taskbarBtn;
            tbBtn._window = null;
            if (tbBtn.isConnected) tbBtn.remove();
            const idx = taskbarButtons.indexOf(tbBtn);
            if (idx !== -1) taskbarButtons.splice(idx, 1);
            win._taskbarBtn = null;
        }
        if (win._abortController) win._abortController.abort();
        if (win._observer) win._observer.disconnect();
        win.remove();
        if (overlay) overlay.remove();
        scheduleRefreshTopWindow();
        if (typeof callback === "function") callback();
    };
    win._closeDialog = closeDialog;

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
        let iconChar = "";
        if (options.iconClass === "warning_icon") iconChar = "!";
        else if (options.iconClass === "info_icon") iconChar = "i";
        else if (options.iconClass === "question_icon") iconChar = "?";

        iconHtml = `<div class="${options.iconClass}" style="top: 20px;">${iconChar}</div>`;
    }

    const textMargin = options.iconClass ? "margin-left: 45px;" : "";
    content.innerHTML = `
        <div style="flex: 1; padding: 20px 15px; display: flex; align-items: flex-start;">
            ${iconHtml}
            <div class="modal-message-container" style="${textMargin} line-height: 1.4; word-break: break-all;"></div>
        </div>
        <div class="button-container" style="text-align:center; padding-bottom:10px; padding-top:5px;"></div>
    `;

    const msgContainer = content.querySelector(".modal-message-container");
    if (msgContainer) {
        // ✅ options.isHtml が明示的に true の場合のみ innerHTML を許可
        if (typeof message === "string" && options.isHtml === true) {
            msgContainer.innerHTML = message; // プロパティ画面などのHTMLレイアウトを通す
        } else {
            msgContainer.textContent = message; // 通常のテキストは安全にテキストとして代入
        }
    }

    const container = content.querySelector(".button-container");
    (options.buttons || [{ label: "OK", onClick: null }]).forEach(btn => {
        const b = document.createElement("button");
        b.textContent = btn.label;
        b.onclick = () => closeDialog(btn.onClick || btn.action);
        b.style.margin = "0 6px";
        b.style.minWidth = "70px";
        b.style.padding = "4px 10px";
        container.appendChild(b);
    });

    // 生成直後にモーダル内のボタン（または本体）へ確実にフォーカスを当てる
    const firstBtn = container.querySelector("button");
    if (firstBtn) {
        firstBtn.focus();
    } else if (!win.contains(document.activeElement)) {
        win.setAttribute("tabindex", "-1");
        win.focus();
    }

    // 右上の [x] ボタン等がある場合のハンドリング（createWindow側のdestroyとの二重実行を防止）
    const closeBtn = win.querySelector(".close-btn");
    if (closeBtn) {
        closeBtn.addEventListener("click", (e) => {
            e.stopImmediatePropagation();
            const canClose = win._controlState ? win._controlState.close : !options.disableClose;
            // ⭐ ログオフ中、または閉じる操作が無効化されている場合は閉じさせない
            if (window.nexser?.isLoggingOff || !canClose) {
                return;
            }
            closeDialog(options.onClose);
        }, { capture: true });
    }

    return content;
}

/* ===== 便利ラッパーの更新 ===== */

export function alertWindow(message, options = {}) {
    // options.silent が true でない場合のみ音を鳴らす
    if (options.silent !== true) {
        playSystemEventSound('notify');
    }

    return showModalWindow(options.title ?? "Alert", message, {
        taskbar: false,
        disableMinimize: options.minimizable === undefined,
        disableMaximize: options.maximizable === undefined,
        ...options,
        iconClass: "warning_icon", // 黄色の警告アイコンを適用
        silent: true
    });
}

export function errorWindow(message, options = {}) {
    return showModalWindow(options.title ?? "Error", message, {
        ...options,
        iconClass: "error_icon", // 赤色のエラーアイコンを適用
        buttons: [{ label: "OK", onClick: null }]
    });
}

/* ===== 新規追加：情報ウィンドウ (iマーク) ===== */
export function infoWindow(message, options = {}) {
    if (options.silent !== true) {
        playSystemEventSound('notify');
    }

    return showModalWindow(options.title ?? "Information", message, {
        ...options,
        iconClass: "info_icon", // 青色の情報アイコンを適用
        silent: true
    });
}

/* ===== 新規追加：質問ウィンドウ (?マーク) ===== */
export function questionWindow(message, callback, options = {}) {
    if (options.silent !== true) {
        playSystemEventSound('notify');
    }

    return showModalWindow(options.title ?? "Question", message, {
        ...options,
        iconClass: "question_icon", // 緑色の質問アイコンを適用
        buttons: [
            { label: "はい", onClick: () => { if (typeof callback === "function") callback(true); } },
            { label: "いいえ", onClick: () => { if (typeof callback === "function") callback(false); } }
        ],
        silent: true
    });
}

export function confirmWindow(message, callback, options = {}) {
    return showModalWindow(options.title ?? "Confirm", message, {
        ...options,
        iconClass: "warning_icon", // 確認ダイアログも警告アイコンを使用
        buttons: [
            { label: "はい", onClick: () => { if (typeof callback === "function") callback(true); } },
            { label: "いいえ", onClick: () => { if (typeof callback === "function") callback(false); } }
        ]
    });
}

export function progressWindow(title, itemName, options = {}) {
    const winWidth = options.width || 420;
    const startTime = performance.now(); // 残り時間計算の開始点

    // height 未指定時は showModalWindow 側の自動高さ調整（height: auto）を有効にする
    const content = showModalWindow(title, "", {
        ...options,
        width: winWidth,
        height: options.height || undefined,
        silent: true,
        disableControls: options.disableControls !== undefined ? options.disableControls : false,
        disableMinimize: options.disableMinimize,
        disableMaximize: options.disableMaximize,
        disableClose: options.disableClose,
        buttons: options.allowCancel ? [{ label: "キャンセル", onClick: options.onCancel || null }] : (options.buttons || []),
    });

    const win = content.parentElement;

    content.innerHTML = `
        <div style="padding: 15px; font-size: 12px; font-family: 'MS Sans Serif', Tahoma, sans-serif; color: #000; user-select: none;">
            <div class="pg-item-name" style="margin-bottom: 10px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></div>
            
            <div style="height: 24px; border: 1px solid #808080; background: #fff; box-shadow: inset 1px 1px #000; margin-bottom: 10px; position: relative;">
                <div class="pg-bar" style="height: 100%; width: 0%; background: #000080; transition: width 0.15s;"></div>
            </div>

            <div style="display: grid; grid-template-columns: 76px 1fr; gap: 6px 4px; color: #303030; line-height: 1.45; align-items: start;">
                <span>進捗率:</span>   <span class="pg-percent" style="font-weight: bold;">0%</span>
                <span>詳細:</span>     <span class="pg-detail" style="white-space: pre-line; word-break: break-word;">準備中...</span>
                <span>残り時間:</span> <span class="pg-time">計算中...</span>
            </div>
        </div>
    `;

    const itemNameEl = content.querySelector(".pg-item-name");
    if (itemNameEl) itemNameEl.textContent = itemName;

    const bar = content.querySelector(".pg-bar");
    const percentText = content.querySelector(".pg-percent");
    const detailText = content.querySelector(".pg-detail");
    const timeText = content.querySelector(".pg-time");

    // disableClose: true でも確実にイベント・オーバーレイ・DOMを破棄するクローズ処理
    const forceClose = () => {
        if (!win) return;
        if (win._controlState) win._controlState.close = true;
        const closeBtn = win.querySelector(".close-btn");
        if (closeBtn) closeBtn.classList.remove("pointer_none");

        if (typeof win._closeDialog === "function") {
            win._closeDialog();
        }
        if (typeof win._destroy === "function") {
            win._destroy();
        }
        if (win._modalOverlay && win._modalOverlay.isConnected) {
            win._modalOverlay.remove();
        }
        if (win.isConnected) {
            win.remove();
        }
        scheduleRefreshTopWindow();
    };

    return {
        win,
        setItemName: (text) => {
            if (itemNameEl && win?.isConnected) {
                itemNameEl.textContent = text;
            }
        },
        update: (current, total = 100, detail = "", newItemName = null) => {
            if (!win || !win.isConnected) return;

            if (newItemName && itemNameEl) {
                itemNameEl.textContent = newItemName;
            }

            const p = Math.max(0, Math.min(100, (current / total) * 100));
            bar.style.width = `${p}%`;
            percentText.textContent = `${Math.round(p)}%`;
            if (detail) detailText.textContent = detail;

            const elapsed = (performance.now() - startTime) / 1000;
            if (p > 5) {
                const remaining = (elapsed / (p / 100)) - elapsed;
                if (remaining > 60) {
                    timeText.textContent = `約 ${Math.floor(remaining / 60)}分 ${Math.round(remaining % 60)}秒`;
                } else {
                    timeText.textContent = `約 ${Math.max(1, Math.round(remaining))}秒`;
                }
            }

            if (p >= 100) {
                timeText.textContent = "完了しました";
                if (options.autoClose !== false) {
                    setTimeout(forceClose, 800);
                }
            }
        },
        close: forceClose
    };
}

export function updateAllTaskbarButtonModes() {
    taskbarButtons.forEach(btn => {
        if (btn.clientWidth < 35) {
            btn.classList.add("icon-only");
        } else {
            btn.classList.remove("icon-only");
        }
    });
}

/* ===== refreshTopWindow 更新 (修正版) ===== */
export function refreshTopWindow(forcedTopWindow = null) {
    const allWindows = Array.from(document.querySelectorAll(".window:not(.ime-toolbar-window)"));

    // 表示されているウィンドウを抽出
    const visibleWindows = allWindows.filter(win =>
        (win === forcedTopWindow) || (
            win.style.visibility !== "hidden" &&
            win.dataset.minimized !== "true"
        ) || (
            // ★追加: 最小化が解除されている（復元アニメーション中）ならアニメーション中でも含める
            win.dataset.minimized === "false" && !win.hidden
        )
    );

    // 背景クリックをブロックしている表示中のモーダルがあれば、zIndex が最大のモーダルを最優先する
    const visibleModals = visibleWindows.filter(w => w._modal && !w._allowBackgroundClick);
    const topModal = visibleModals.length > 0
        ? visibleModals.reduce((maxWin, currentWin) =>
            (parseInt(currentWin.style.zIndex) || 0) >= (parseInt(maxWin.style.zIndex) || 0) ? currentWin : maxWin
        )
        : null;

    let topWindow = (forcedTopWindow && (!topModal || forcedTopWindow._modal))
        ? forcedTopWindow
        : topModal;

    if (!topWindow && lastFocusedWindow && visibleWindows.includes(lastFocusedWindow)) {
        topWindow = lastFocusedWindow;
    }

    if (!topWindow && visibleWindows.length > 0) {
        topWindow = visibleWindows.reduce((maxWin, currentWin) => {
            const maxZ = parseInt(maxWin.style.zIndex) || 0;
            const currentZ = parseInt(currentWin.style.zIndex) || 0;
            return currentZ > maxZ ? currentWin : maxWin;
        });
    }

    if (visibleWindows.length === 0 && !forcedTopWindow) {
        topWindow = undefined;
    }

    // タイトルバーの背景色とinactive状態を更新
    allWindows.forEach(win => {
        const tb = win.querySelector(".title-bar");
        if (!tb) return;

        const isTop = (topWindow && win === topWindow);

        // ★ アクティブ時と同様に、非アクティブ時もグラデーション（または非アクティブ用カラー）を適用する
        tb.style.background = isTop
            ? (themeColor2 ? `linear-gradient(90deg, ${themeColor || DEFAULT_COLOR}, ${themeColor2})` : (themeColor || DEFAULT_COLOR))
            : (inactiveThemeColor2
                ? `linear-gradient(90deg, ${inactiveThemeColor || DEFAULT_COLOR}, ${inactiveThemeColor2})`
                : (inactiveThemeColor || DEFAULT_COLOR));

        win.classList.toggle("inactive-window", !isTop);
    });

    // タスクバーボタンの選択状態を同期
    taskbarButtons.forEach(btn => {
        const isSelected = Boolean(topWindow && btn._window === topWindow);
        btn.classList.toggle("selected", isSelected);
    });
    updateAllTaskbarButtonModes();
}

/* =========================
   Window Control API
========================= */
/**
 * ウィンドウとタスクバーのタイトルを同期して更新する
 */
export function updateWindowTitle(win, baseTitle, isDirty, newNode = null) {
    if (!win) return;

    const titleText = isDirty ? `${baseTitle} *` : baseTitle;
    win.dataset.title = titleText;

    // 1. ウィンドウ本体のタイトルバーを更新
    const titleEl = win.querySelector(".title-text");
    if (titleEl) {
        titleEl.textContent = titleText;
    }

    // 2. タスクバーのボタン（表示テキスト・ツールチップ・データ属性）を更新
    const btn = taskbarButtons.find(b => b._window === win) || win._taskbarBtn;
    if (btn) {
        btn.dataset.tooltip = titleText;
        btn.dataset.title = titleText;
        const textEl = btn.querySelector(".taskbar-text");
        if (textEl) {
            textEl.textContent = titleText;
        }
    }

    // 3. リネーム等でノード情報が渡された場合はアイコンも再評価して同期
    if (newNode && typeof win._applyRealIcon === "function") {
        win._applyRealIcon(baseTitle, newNode);
    }

    updateAllTaskbarButtonModes();
}

export function getWindows() {
    return Array.from(document.querySelectorAll(".window")).map((w) => ({
        id: w.dataset.windowId, // ★ 一意のIDを使う
        title: w.dataset.title || "Untitled",
        minimized: w.dataset.minimized === "true",
        zIndex: Number(w.style.zIndex || 0),
        el: w
    }));
}

/**
 * タスクバーのモード変更や位置変更に伴い、
 * 最大化中のウィンドウの位置とサイズを再計算して適用する
 */
export function refreshMaximizedWindows() {
    const maximizedWindows = document.querySelectorAll(".window.maximized");

    maximizedWindows.forEach(w => {
        const taskbar = document.getElementById("taskbar");
        if (!taskbar) {
            Object.assign(w.style, { top: "0px", left: "0px", width: "100%", height: "100%" });
            return;
        }

        const isWindowMode = taskbar.closest(".window") !== null || taskbar.dataset.windowMode === "true";
        if (isWindowMode) {
            Object.assign(w.style, { top: "0px", left: "0px", width: "100%", height: "100%" });
            return;
        }

        const tbRect = taskbar.getBoundingClientRect();
        const style = window.getComputedStyle(taskbar);
        const matrix = new WebKitCSSMatrix(style.transform);
        const translateY = matrix.m42;
        const translateX = matrix.m41;

        // タスクバーの上下左右の配置を判定して最大化領域を正しく再計算
        if (tbRect.top <= 0 && tbRect.height < tbRect.width) {
            // 上部配置 (Top)
            const visibleH = Math.max(0, taskbar.offsetHeight - Math.abs(translateY));
            Object.assign(w.style, { top: `${visibleH}px`, left: "0px", width: "100%", height: `calc(100% - ${visibleH}px)` });
        } else if (tbRect.bottom >= window.innerHeight && tbRect.height < tbRect.width) {
            // 下部配置 (Bottom)
            const visibleH = Math.max(0, taskbar.offsetHeight - Math.abs(translateY));
            Object.assign(w.style, { top: "0px", left: "0px", width: "100%", height: `calc(100% - ${visibleH}px)` });
        } else if (tbRect.left <= 0 && tbRect.width < tbRect.height) {
            // 左側配置 (Left)
            const visibleW = Math.max(0, taskbar.offsetWidth - Math.abs(translateX));
            Object.assign(w.style, { top: "0px", left: `${visibleW}px`, width: `calc(100% - ${visibleW}px)`, height: "100%" });
        } else if (tbRect.right >= window.innerWidth && tbRect.width < tbRect.height) {
            // 右側配置 (Right)
            const visibleW = Math.max(0, taskbar.offsetWidth - Math.abs(translateX));
            Object.assign(w.style, { top: "0px", left: "0px", width: `calc(100% - ${visibleW}px)`, height: "100%" });
        } else {
            // フォールバック（下部配置扱い）
            const visibleH = Math.max(0, taskbar.offsetHeight - Math.abs(translateY));
            Object.assign(w.style, { top: "0px", left: "0px", width: "100%", height: `calc(100% - ${visibleH}px)` });
        }
    });
}
export function removeAllTaskbarButtons() {
    taskbarButtons.forEach(btn => btn.remove());
    taskbarButtons.length = 0;
}

export function focusWindowById(id) {
    if (typeof id !== "string" && typeof id !== "number") return false;
    const list = getWindows();
    const win = list.find(w => w.id === String(id)); // ★ IDで正しく検索
    if (!win || !win.el) return false;
    win.el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    return true;
}

export async function minimizeWindowById(id) {
    const list = getWindows();
    const win = list.find(w => w.id === id); // ★ IDで正しく検索
    if (!win) return false;

    const w = win.el;
    if (w._controlState && !w._controlState.minimize) return false;
    // ★ 修正1: すでに最小化中、またはアニメーション中であれば処理を中断
    if (w.dataset.minimized === "true" || w._animating) return true;
    w._animating = true; // ★ フラグを立てる

    playSystemEventSound('minimize');
    const taskbarBtn = w._ensureTaskbarButton ? w._ensureTaskbarButton(true) : w._taskbarBtn;

    if (!taskbarBtn) {
        // タスクバーがない場合は即時非表示
        w.style.visibility = "hidden";
        w.dataset.minimized = "true";
        w._animating = false; // ★ 忘れずにフラグを戻す
        scheduleRefreshTopWindow();
        return true;
    }

    const titleBar = w.querySelector(".title-bar");
    const titleText = titleBar?.querySelector(".title-text");
    if (!titleText) {
        w._animating = false; // ★ 途中で抜ける場合もフラグを戻す
        return false;
    }

    const rect = taskbarBtn.getBoundingClientRect();
    const clone = createTitleClone(w, titleBar, titleText);

    // 元ウィンドウはアニメ中非表示
    w.style.pointerEvents = "none";
    w.style.visibility = "hidden";

    animateTitleClone(clone, { left: rect.left, top: rect.top, width: rect.width }, undefined, () => {
        clone.remove();
        w.dataset.minimized = "true";
        if (w._modalOverlay) {
            w._modalOverlay.style.display = "none";
        }
        if (!w.classList.contains("frameless-window")) {
            w.style.pointerEvents = "auto";
        }
        w._animating = false; // ★ アニメーション終了後にフラグを解除
        scheduleRefreshTopWindow();
    });

    return true;
}

export function maximizeWindowById(id) {
    const list = getWindows();
    const win = list.find(w => w.id === id); // ★ IDで正しく検索
    if (!win) return false;
    if (win.el._controlState && !win.el._controlState.maximize) return false;

    const btn = win.el.querySelector(".max-btn");
    if (btn) btn.click();
    return true;
}

export function closeWindowById(id) {
    // ★ ID一致で確実に特定する
    const target = document.querySelector(`.window[data-window-id="${id}"]`);
    if (!target) throw new Error(`Invalid window id: ${id}`);

    if (target._controlState && !target._controlState.close) return false;

    if (typeof target._closeDialog === "function") {
        target._closeDialog();
    } else if (typeof target._destroy === "function") {
        target._destroy();
    } else {
        target.remove();
    }
    return true;
}

export function installWindowContextMenu(w) {
    if (w._modal || w.dataset.disableContextMenu === "true") return;
    const titleBar = w.querySelector(".title-bar");
    const taskbarBtn = w._taskbarBtn;

    const minBtn = w.querySelector(".min-btn");
    const maxBtn = w.querySelector(".max-btn");
    const closeBtn = w.querySelector(".close-btn");

    // タイトルバー右クリック
    if (titleBar) {
        attachContextMenu(titleBar, () => {
            // ★ メニューが開かれるたびに最新の状態を再評価する
            const minDisabled = minBtn && minBtn.classList.contains("pointer_none");
            const maxDisabled = maxBtn && maxBtn.classList.contains("pointer_none");
            const closeDisabled = closeBtn && closeBtn.classList.contains("pointer_none");

            return [
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
            ];
        });
    }

    // タスクバー右クリック
    if (taskbarBtn) {
        taskbarBtn.addEventListener("contextmenu", (e) => {
            e.stopPropagation();
        });
        attachContextMenu(taskbarBtn, () => {
            // ★ メニューが開かれるたびに最新の状態を再評価する
            const minDisabled = minBtn && minBtn.classList.contains("pointer_none");
            const maxDisabled = maxBtn && maxBtn.classList.contains("pointer_none");
            const closeDisabled = closeBtn && closeBtn.classList.contains("pointer_none");

            const minimized = w.dataset.minimized === "true";

            if (!minimized) {
                bringToFront(w);
                scheduleRefreshTopWindow();
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

export function setWindowPreviewEnabled(v) {
    ENABLE_WINDOW_PREVIEW = v;
}

if (typeof window !== "undefined") {
    window.setWindowPreviewEnabled = setWindowPreviewEnabled;
    window.setWindowAnimationEnabled = setWindowAnimationEnabled; // 必要であればアニメーション設定も同様に
}

export function destroyWindow(win) {
    if (!win) return;

    if (typeof win._closeDialog === "function") {
        win._closeDialog();
        return;
    }

    // createWindow で定義された共通破棄処理（リスナー解除・タスクバーボタン削除・プロセス終了）を実行
    if (typeof win._destroy === "function") {
        win._destroy();
        return;
    }

    if (win.dataset && win.dataset.processKey) {
        killProcess(win.dataset.processKey);
        return;
    }

    if (win.isConnected) {
        win.remove();
    }
}

/* =========================
   Window Controls Toggle API
========================= */
function resolveTargetWindowElement(target) {
    if (!target) return null;
    if (target instanceof HTMLElement) {
        return target.classList.contains("window") ? target : target.closest(".window");
    }
    if (typeof target === "string" || typeof target === "number") {
        const idStr = String(target);
        return document.querySelector(`.window[data-window-id="${idStr}"]`)
            || document.querySelector(`.window[data-window-id="win_${idStr}"]`);
    }
    return null;
}

/**
 * 任意のウィンドウ（アラート等のモーダル含む）の操作有効/無効を切り替える
 * @param {HTMLElement|string} target - .window要素 / .content要素 / windowId
 * @param {Object} controls - { resize, maximize, minimize, close, all }
 */
export function setWindowControls(target, controls = {}) {
    const win = resolveTargetWindowElement(target);
    if (!win || typeof win._setControls !== "function") return null;
    return win._setControls(controls);
}

/**
 * 現在の操作有効/無効状態を取得する
 */
export function getWindowControls(target) {
    const win = resolveTargetWindowElement(target);
    if (!win || typeof win._getControls !== "function") return null;
    return win._getControls();
}

/**
 * 指定した1項目（"resize" | "maximize" | "minimize" | "close"）の有効/無効を反転する
 */
export function toggleWindowControl(target, controlName, forceState = undefined) {
    const current = getWindowControls(target);
    if (!current || !(controlName in current)) return null;
    const nextValue = forceState !== undefined ? Boolean(forceState) : !current[controlName];
    return setWindowControls(target, { [controlName]: nextValue });
}

/**
 * モーダル表示中の背景クリック有効/無効を切り替える
 * @param {HTMLElement|string} target - .window要素 / .content要素 / windowId
 * @param {boolean} clickable - true で背景クリック許可、false でブロック
 */
export function setModalBackgroundClickable(target, clickable) {
    const win = resolveTargetWindowElement(target);
    if (!win || typeof win._setBackgroundClickable !== "function") return null;
    return win._setBackgroundClickable(clickable);
}

/**
 * モーダル表示中の背景クリック有効/無効を反転する
 */
export function toggleModalBackgroundClickable(target, forceState = undefined) {
    const win = resolveTargetWindowElement(target);
    if (!win || typeof win._setBackgroundClickable !== "function") return null;
    const nextValue = forceState !== undefined ? Boolean(forceState) : !win._allowBackgroundClick;
    return win._setBackgroundClickable(nextValue);
}

/* =========================
   Event & Extension System
========================= */
const eventListeners = new Map();
const customExtensions = {};

export function on(event, callback) {
    if (!eventListeners.has(event)) eventListeners.set(event, new Set());
    eventListeners.get(event).add(callback);
    return () => off(event, callback);
}

export function off(event, callback) {
    eventListeners.get(event)?.delete(callback);
}

export function emit(event, detail) {
    eventListeners.get(event)?.forEach(cb => {
        try { cb(detail); } catch (e) { console.error(`Error in event listener (${event}):`, e); }
    });
}

export function extendAPI(name, fn) {
    if (customExtensions[name]) {
        console.warn(`Extension "${name}" is already registered. Overwriting.`);
    }
    customExtensions[name] = fn;
}

/* =========================
   Kernel Integration Hook
========================= */
let kernelWindowCreator = null;

/**
 * カーネル側からウィンドウ生成の仲介関数を注入する
 * （循環参照を回避しつつ、カーネル経由での作成を強制するため）
 */
export function setKernelWindowCreator(fn) {
    kernelWindowCreator = fn;
}

export function initWindowAPI() {
    if (typeof window === "undefined") return;

    // 1. 外部に公開しても安全な機能だけをまとめたオブジェクトを作成
    const secureWindowAPI = {
        // ★ カーネル経由のクリエイターが登録されている場合はそちらを経由し、
        // 未登録の場合のみ window.js 内の元の createWindow を直接呼び出す
        createWindow: (title, options) => {
            if (kernelWindowCreator) {
                return kernelWindowCreator(title, options);
            }
            return createWindow(title, options);
        },
        closeWindowById: (id) => closeWindowById(id),
        minimizeWindowById: (id) => minimizeWindowById(id),
        maximizeWindowById: (id) => maximizeWindowById(id),
        focusWindowById: (id) => focusWindowById(id),
        bringToFront: (win) => bringToFront(win),
        destroyWindow: (win) => destroyWindow(win),
        removeAllTaskbarButtons: () => removeAllTaskbarButtons(),
        updateWindowTitle: (win, title, isDirty, newNode) => updateWindowTitle(win, title, isDirty, newNode),
        getWindows: () => getWindows().map(({ el, ...rest }) => rest),

        refreshTopWindow: (forcedTopWindow) => refreshTopWindow(forcedTopWindow),
        scheduleRefreshTopWindow: () => scheduleRefreshTopWindow(),

        // ダイアログ・通知系ウィンドウ
        showModalWindow: (title, message, options) => showModalWindow(title, message, options),
        alertWindow: (message, options) => alertWindow(message, options),
        errorWindow: (message, options) => errorWindow(message, options),
        infoWindow: (message, options) => infoWindow(message, options),
        questionWindow: (message, callback, options) => questionWindow(message, callback, options),
        confirmWindow: (message, callback, options) => confirmWindow(message, callback, options),
        progressWindow: (title, itemName, options) => progressWindow(title, itemName, options),

        // ウィンドウ操作の有効/無効切り替え（全ウィンドウ・モーダル対応）
        setWindowControls: (target, controls) => setWindowControls(target, controls),
        getWindowControls: (target) => getWindowControls(target),
        toggleWindowControl: (target, controlName, forceState) => toggleWindowControl(target, controlName, forceState),
        setModalBackgroundClickable: (target, clickable) => setModalBackgroundClickable(target, clickable),
        toggleModalBackgroundClickable: (target, forceState) => toggleModalBackgroundClickable(target, forceState),

        // 設定系
        setAnimationEnabled: (v) => setWindowAnimationEnabled(v),
        setPreviewEnabled: (v) => setWindowPreviewEnabled(v),

        // イベント購読と拡張のためのメソッドを公開
        on: (event, cb) => on(event, cb),
        off: (event, cb) => off(event, cb),
        registerExtension: (name, fn) => extendAPI(name, fn),

        // 追加された独自拡張メソッド群にアクセスするためのプロキシ
        get extra() {
            return { ...customExtensions };
        }
    };

    // 2. Object.freeze() でプロパティの追加・削除・書き換えを完全に防止
    Object.freeze(secureWindowAPI);

    // 3. window.nexser 名前空間を安全に定義（すでに存在する場合は上書きされないよう配慮）
    window.nexser = window.nexser || {};

    // 4. Object.defineProperty を使って再定義・削除不可の安全なプロパティとして登録
    Object.defineProperty(window.nexser, "windowAPI", {
        value: secureWindowAPI,
        writable: false,     // 書き換え不可
        configurable: false, // 削除・再定義不可
        enumerable: true     // 列挙可能
    });
}
initWindowAPI();