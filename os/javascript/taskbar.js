// taskbar.js
import { launch } from "./kernel.js";
import { resetAllTitleBars, taskbarButtons, updateAllTaskbarButtonModes } from "./window.js";
import { hideContextMenu, attachContextMenu } from "./context-menu.js";
import { clockDate } from "./apps/clock.js";
import { saveSetting, loadSetting } from "./apps/settings.js";

export let ENABLE_TASKBAR_PREVIEW = true;
export function setTaskbarPreviewEnabled(v) {
    ENABLE_TASKBAR_PREVIEW = v;
}
if (typeof window !== "undefined") {
    window.setTaskbarPreviewEnabled = setTaskbarPreviewEnabled;
}

/* ============================
   Taskbar Layout Containers
============================ */
function ensureTaskbarAreas(taskbar) {
    let startArea = taskbar.querySelector(".taskbar-start");
    let buttonArea = taskbar.querySelector(".taskbar-buttons");
    let trayArea = taskbar.querySelector(".taskbar-tray");

    if (!startArea) {
        startArea = document.createElement("div");
        startArea.className = "taskbar-start";
        taskbar.appendChild(startArea);
    }

    if (!buttonArea) {
        buttonArea = document.createElement("div");
        buttonArea.className = "taskbar-buttons";
        taskbar.appendChild(buttonArea);
    }

    // ===== スクロールボタンと連動ロジックの追加 =====
    let scrollPrevBtn = taskbar.querySelector(".taskbar-scroll-prev");
    let scrollNextBtn = taskbar.querySelector(".taskbar-scroll-next");

    if (!scrollPrevBtn) {
        scrollPrevBtn = document.createElement("button");
        scrollPrevBtn.className = "taskbar-scroll-btn taskbar-scroll-prev";
        scrollPrevBtn.innerHTML = "◄";
        taskbar.insertBefore(scrollPrevBtn, buttonArea);
    }
    if (!scrollNextBtn) {
        scrollNextBtn = document.createElement("button");
        scrollNextBtn.className = "taskbar-scroll-btn taskbar-scroll-next";
        scrollNextBtn.innerHTML = "►";
        taskbar.insertBefore(scrollNextBtn, buttonArea.nextSibling);
    }

    // スクロール状態（表示・非表示）の更新関数
    function updateScrollButtonStates() {
        const isVert = taskbar.classList.contains("vertical");
        let hasOverflow = false;

        if (isVert) {
            hasOverflow = buttonArea.scrollHeight > buttonArea.clientHeight;
            scrollPrevBtn.innerHTML = "▲";
            scrollNextBtn.innerHTML = "▼";
        } else {
            hasOverflow = buttonArea.scrollWidth > buttonArea.clientWidth;
            scrollPrevBtn.innerHTML = "◄";
            scrollNextBtn.innerHTML = "►"
        }

        if (hasOverflow) {
            scrollPrevBtn.classList.add("active");
            scrollNextBtn.classList.add("active");
        } else {
            scrollPrevBtn.classList.remove("active");
            scrollNextBtn.classList.remove("active");
        }
    }

    // 1. ウィンドウのリサイズ時にスクロールボタンの状態を更新
    window.addEventListener("resize", updateScrollButtonStates);

    // 2. ボタンの追加・削除（子要素の増減）を検知して状態を更新
    const mutationObserver = new MutationObserver(() => {
        updateScrollButtonStates();
    });
    mutationObserver.observe(buttonArea, { childList: true });

    // ★3. タスクバー自体の向き（verticalクラスの付与/削除）の変更を検知して更新
    const taskbarClassObserver = new MutationObserver(() => {
        updateScrollButtonStates();
    });
    taskbarClassObserver.observe(taskbar, { attributes: true, attributeFilter: ["class"] });

    // 初期化時にも一度状態を反映
    updateScrollButtonStates();

    // 長押しによる連続スクロールの処理
    let scrollInterval = null;

    function startScrolling(direction) {
        const isVert = taskbar.classList.contains("vertical");
        const scrollAmount = 40; // 1回あたりのスクロールピクセル数

        const doScroll = () => {
            if (isVert) {
                buttonArea.scrollTop += direction * scrollAmount;
            } else {
                buttonArea.scrollLeft += direction * scrollAmount;
            }
        };

        doScroll();
        scrollInterval = setInterval(doScroll, 80); // 80ms間隔で連続スクロール
    }

    function stopScrolling() {
        if (scrollInterval) {
            clearInterval(scrollInterval);
            scrollInterval = null;
        }
    }

    // スクロールボタンへのイベントリスナー登録（マウス＆タッチ対応）
    [
        { btn: scrollPrevBtn, dir: -1 },
        { btn: scrollNextBtn, dir: 1 }
    ].forEach(({ btn, dir }) => {
        const handleStart = (e) => {
            e.preventDefault();
            startScrolling(dir);
            btn.classList.add("pressed");
        };
        const handleEnd = () => {
            stopScrolling();
            btn.classList.remove("pressed");
        };

        btn.addEventListener("mousedown", handleStart);
        btn.addEventListener("mouseup", handleEnd);
        btn.addEventListener("mouseleave", handleEnd);
        btn.addEventListener("touchstart", handleStart, { passive: false });
        btn.addEventListener("touchend", handleEnd);
    });

    if (!trayArea) {
        trayArea = document.createElement("div");
        trayArea.className = "taskbar-tray";
        taskbar.appendChild(trayArea);
    }

    return { startArea, buttonArea, trayArea };
}

// taskbar.js のコンテキストメニュー部分を共通関数化して使い回す
function setupTaskbarContextMenu(targetElement) {
    attachContextMenu(targetElement, () => {
        return [
            {
                label: "タスクバーのプロパティ",
                action: () => {
                    // エクスプローラーやデスクトップと同じ launch を使用する
                    launch("C:/Programs/Applications/TaskbarProperties.app", {
                        path: "C:/Programs/Applications/TaskbarProperties.app",
                        uniqueKey: "C:/Programs/Applications/TaskbarProperties.app"
                    });
                }
            }
        ];
    });
}

export async function initTaskbar() {
    const taskbar = document.getElementById("taskbar");
    if (!taskbar) return;
    taskbar.style.visibility = "hidden";
    const startBtn = document.getElementById("start-btn");
    const startMenu = document.getElementById("start-menu");

    const { startArea, buttonArea, trayArea } = ensureTaskbarAreas(taskbar);

    // 内部状態管理
    let isAutoHide = false;
    let isTaskbarHidden = false;
    let isTaskbarWindowMode = false;
    let taskbarFloatingWindow = null;
    let isApplyingWindowMode = false;

    async function applyTaskbarWindowMode() {
        if (isApplyingWindowMode) return; // 処理中なら弾く
        isApplyingWindowMode = true;

        try {
            if (isTaskbarWindowMode) {
                // すでにウィンドウ化されていれば何もしない（実体が残っているかも確認）
                if (taskbarFloatingWindow && document.body.contains(taskbarFloatingWindow)) return;
                taskbarFloatingWindow = null;

                // 事前に保存されたタスクバーの高さ（または現在の高さ）を確実に取得する
                const savedHeight = await loadSetting("taskbarSize");
                const heightVal = savedHeight || taskbar.offsetHeight || 40;
                const targetHeight = `${heightVal}px`;
                const targetTop = `calc(100vh - ${targetHeight})`;

                // 1. window.js の機能を使って本物のウィンドウを作成
                const content = window.nexser?.windowAPI.createWindow("Taskbar", {
                    width: "100%",
                    height: targetHeight,
                    left: "0px",
                    top: targetTop,
                    taskbar: false,    // タスクバー自身のボタンがタスクバーに登録されるのを防ぐ
                    hideRibbon: true,   // リボンメニューを非表示
                    hideStatus: true,
                    disableMinimize: true,
                    disableClose: true
                });

                taskbarFloatingWindow = content.parentElement;

                // ウィンドウ要素を一番下に固定する
                if (taskbarFloatingWindow) {
                    taskbarFloatingWindow.style.top = "auto";
                    taskbarFloatingWindow.style.bottom = "0px";
                    taskbarFloatingWindow.style.height = targetHeight; // ウィンドウ枠の高さを確実に指定
                }

                // 2. ウィンドウ側のコンテンツエリア（content）のレイアウトを整え、高さを追随させる
                content.style.position = "relative";
                content.style.width = "100%";
                content.style.height = "100%";
                content.style.display = "flex";
                content.style.flexDirection = "column";

                // 3. タスクバーを生成したウィンドウの content 内に移動
                content.appendChild(taskbar);

                // 4. タスクバー自体の固定スタイルを解除し、ウィンドウ枠内にフィットさせる
                Object.assign(taskbar.style, {
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    left: "0",
                    bottom: "0",
                    borderRadius: "0",
                    border: "none",
                    boxShadow: "none"
                });

            } else {
                // ウィンドウモード解除時の処理
                if (taskbarFloatingWindow) {

                    // 1. タスクバーを元のos-root(またはbody)に戻す
                    const desktop = document.getElementById("os-root") || document.body;
                    desktop.appendChild(taskbar);

                    // 2. ウィンドウモードで上書きされたスタイルをクリアし、画面下部固定のスタイルを完全に再適用する
                    taskbar.style.position = "absolute";
                    taskbar.style.left = "0px";
                    taskbar.style.bottom = "0px";
                    taskbar.style.width = "100%";
                    taskbar.style.height = ""; // 保存されている高さ（style.height）に戻るようにクリア
                    taskbar.style.borderRadius = "";
                    taskbar.style.border = "";
                    taskbar.style.boxShadow = "";

                    // 保存された高さがある場合は復元
                    loadSetting("taskbarSize").then(savedHeight => {
                        if (savedHeight) {
                            taskbar.style.height = savedHeight + "px";
                            if (versionLabel) versionLabel.style.bottom = `${savedHeight}px`;
                        }
                    });

                    const closeBtn = taskbarFloatingWindow.querySelector(".close-btn");
                    if (closeBtn) {
                        closeBtn.classList.remove("pointer_none");
                    }

                    // 3. ウィンドウを正しく破棄する
                    if (typeof taskbarFloatingWindow._destroy === "function") {
                        taskbarFloatingWindow._destroy();
                    } else {
                        taskbarFloatingWindow.remove();
                    }
                    taskbarFloatingWindow = null;

                    setupTaskbarContextMenu(taskbar);
                    taskbar.addEventListener("contextmenu", (e) => {
                        e.stopPropagation();
                    });
                }
            }
            window.dispatchEvent(new Event("desktop-resize"));
        } finally {
            isApplyingWindowMode = false; // 処理完了後にフラグを解放
        }
    }

    // タスクバー基本スタイル
    Object.assign(taskbar.style, {
        display: "flex",
        alignItems: "center",
        transition: "none"
    });

    // 各エリアのスタイル（中央揃えにし、縦横切り替えに対応）
    Object.assign(startArea.style, {
        display: "flex",
        alignItems: "center",
        gap: "4px"
    });

    Object.assign(buttonArea.style, {
        flex: "1 1 auto",
        minWidth: "0",
        display: "flex",
        alignItems: "center",
        overflowX: "hidden",
        overflowY: "hidden"
    });

    Object.assign(trayArea.style, {
        display: "flex",
        alignItems: "center",
        gap: "4px",
        flexShrink: "0",
        border: "1.5px solid",
        borderColor: "#7a7a7a #fff #fff #7a7a7a",
        boxShadow: "0.5px 0.5px 0 #000 inset",
        padding: "2px"
    });

    // Startボタン配置
    if (startBtn) {
        if (startBtn.parentElement !== startArea) startArea.appendChild(startBtn);
        startBtn.style.fontWeight = "bold";
    }

    // バージョン表示
    let versionLabel = taskbar.querySelector(".os-version-label");
    if (!versionLabel) {
        versionLabel = document.createElement("div");
        versionLabel.className = "os-version-label";
        versionLabel.textContent = document.title;
        Object.assign(versionLabel.style, {
            position: "absolute",
            fontSize: "11px",
            color: "white",
            right: "25px",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            userSelect: "none"
        });
        taskbar.appendChild(versionLabel);
    }

    function updateVersionPosition() {
        const h = taskbar.offsetHeight;
        versionLabel.style.bottom = `${h}px`;
    }
    updateVersionPosition();

    // ============================
    // Auto-hide ロジック
    // ============================
    function updateAutoHideEffect() {
        if (!isAutoHide) {
            taskbar.style.transform = "translateY(0)";
            return;
        }
        // 隠れている時は下端に2pxだけ残して沈める
        taskbar.style.transform = isTaskbarHidden
            ? `translateY(${taskbar.offsetHeight - 2}px)`
            : "translateY(0)";
        const currentVisibleHeight = isAutoHide && isTaskbarHidden ? 2 : taskbar.offsetHeight;

        document.querySelectorAll(".window.maximized").forEach(win => {
            // 隠れている時はほぼ全画面、出ている時はタスクバーを除いた高さにする
            win.style.height = `calc(100% - ${currentVisibleHeight}px)`;
        });
    }

    // マウス位置による出し入れ判定（軽量化版）
    let isAutoHidingTicking = false;
    document.addEventListener("mousemove", (e) => {
        if (!isAutoHide || isAutoHidingTicking) return;
        isAutoHidingTicking = true;

        requestAnimationFrame(() => {
            const threshold = window.innerHeight - 10;
            if (e.clientY > threshold) {
                // 画面下端にマウスが来たら表示
                if (isTaskbarHidden) {
                    isTaskbarHidden = false;
                    updateAutoHideEffect();
                }
            } else if (e.clientY < (window.innerHeight - taskbar.offsetHeight)) {
                // タスクバーの領域からマウスが外れたら隠す
                if (!isTaskbarHidden) {
                    isTaskbarHidden = true;
                    updateAutoHideEffect();
                }
            }
            isAutoHidingTicking = false;
        });
    });

    // ============================
    // 時計表示（トレイエリア）
    // ============================
    let clockLabel = trayArea.querySelector(".taskbar-clock");
    if (!clockLabel) {
        clockLabel = document.createElement("div");
        clockLabel.className = "taskbar-clock";
        Object.assign(clockLabel.style, {
            fontSize: "medium",
            padding: "1.5px",
            whiteSpace: "nowrap",
            color: "black",
            userSelect: "none",
            cursor: "pointer"
        });
        trayArea.appendChild(clockLabel);
    }

    clockLabel.addEventListener("dblclick", () => {
        launch("Programs/Applications/Clock.app", {
            path: "Programs/Applications/Clock.app",
            uniqueKey: "Programs/Applications/Clock.app"
        });
    });

    function updateClockLabel(date) {
        let hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, "0");
        const ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12;
        if (hours === 0) hours = 12;
        const hoursStr = hours.toString().padStart(2, "0");
        clockLabel.textContent = `${hoursStr}:${minutes} ${ampm}`;
    }

    // ⭕ タスクバーの配置状態とレイアウト適用関数を【初期化より上】に定義する
    let currentPosition = "bottom"; // "bottom" | "top" | "left" | "right"
    let taskbarSize = 40; // 横配置時は height、縦配置時は width
    let currentHandle = null;
    let resizing = false;
    let startX = 0, startY = 0, startSize = 0;
    let resizePreview = null, resizeShield = null;
    const MIN_SIZE = 40, MAX_SIZE = 320;

    // リサイズハンドルの更新・生成
    function setupResizeHandle() {
        if (currentHandle) currentHandle.remove();

        const handle = document.createElement("div");
        const isVert = currentPosition === "left" || currentPosition === "right";

        const handleStyle = {
            position: "absolute",
            zIndex: "1001",
            background: "transparent",
            cursor: isVert ? "ew-resize" : "ns-resize"
        };

        if (currentPosition === "bottom") Object.assign(handleStyle, { top: "0", left: "0", right: "0", height: "6px" });
        if (currentPosition === "top") Object.assign(handleStyle, { bottom: "0", left: "0", right: "0", height: "6px" });
        if (currentPosition === "left") Object.assign(handleStyle, { right: "0", top: "0", bottom: "0", width: "6px" });
        if (currentPosition === "right") Object.assign(handleStyle, { left: "0", top: "0", bottom: "0", width: "6px" });

        Object.assign(handle.style, handleStyle);
        taskbar.appendChild(handle);
        currentHandle = handle;

        // ハンドルを押したときの開始処理のみを登録
        handle.addEventListener("mousedown", e => {
            if (isTaskbarWindowMode) return;
            e.preventDefault();
            e.stopPropagation();

            resizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startSize = taskbarSize;

            resizeShield = document.createElement("div");
            Object.assign(resizeShield.style, {
                position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
                zIndex: 9998, background: "transparent",
                cursor: (currentPosition === "left" || currentPosition === "right") ? "ew-resize" : "ns-resize"
            });
            document.body.appendChild(resizeShield);

            if (ENABLE_TASKBAR_PREVIEW) {
                resizePreview = document.createElement("div");
                const rect = taskbar.getBoundingClientRect();
                Object.assign(resizePreview.style, {
                    position: "fixed",
                    left: `${rect.left}px`,
                    top: `${rect.top}px`,
                    width: `${rect.width}px`,
                    height: `${rect.height}px`,
                    border: "2px solid white",
                    background: "transparent",
                    pointerEvents: "none",
                    zIndex: 9999,
                    mixBlendMode: "difference"
                });
                document.body.appendChild(resizePreview);
            }
        });
    }

    async function applyTaskbarLayout(pos, size) {
        currentPosition = pos || await loadSetting("taskbarPosition") || "bottom";
        taskbarSize = size || await loadSetting("taskbarSize") || 40;

        const isVert = currentPosition === "left" || currentPosition === "right";

        // クラス設定と内部コンテナの向き・マージンの動的切り替え
        if (isVert) {
            taskbar.classList.add("vertical");
            startArea.style.flexDirection = "column";
            buttonArea.style.flexDirection = "column";
            trayArea.style.flexDirection = "column";
            trayArea.style.marginLeft = "0px";
            trayArea.style.marginTop = "2px";
        } else {
            taskbar.classList.remove("vertical");
            startArea.style.flexDirection = "row";
            buttonArea.style.flexDirection = "row";
            trayArea.style.flexDirection = "row";
            trayArea.style.marginLeft = "10px";
            trayArea.style.marginTop = "0px";
        }

        // 位置とサイズの適用
        Object.assign(taskbar.style, {
            top: (currentPosition === "bottom") ? "auto" : "0px",
            bottom: (currentPosition === "top") ? "auto" : "0px",
            left: (currentPosition === "right") ? "auto" : "0px",
            right: (currentPosition === "left") ? "auto" : "0px",
            width: isVert ? `${taskbarSize}px` : "100%",
            height: isVert ? "100%" : `${taskbarSize}px`,
            alignItems: isVert ? "stretch" : "flex-start"
        });

        // タスクバーの配置・サイズ変更に連動して最大化ウィンドウの大きさと位置を更新
        document.querySelectorAll(".window.maximized").forEach(win => {
            if (currentPosition === "bottom") {
                Object.assign(win.style, { top: "0px", left: "0px", width: "100%", height: `calc(100% - ${taskbarSize}px)` });
            } else if (currentPosition === "top") {
                Object.assign(win.style, { top: `${taskbarSize}px`, left: "0px", width: "100%", height: `calc(100% - ${taskbarSize}px)` });
            } else if (currentPosition === "left") {
                Object.assign(win.style, { top: "0px", left: `${taskbarSize}px`, width: `calc(100% - ${taskbarSize}px)`, height: "100%" });
            } else if (currentPosition === "right") {
                Object.assign(win.style, { top: "0px", left: "0px", width: `calc(100% - ${taskbarSize}px)`, height: "100%" });
            }
        });

        setupResizeHandle();
        updateAutoHideEffect();
        updateAllTaskbarButtonModes();
        window.dispatchEvent(new Event("desktop-resize"));
    }

    // 初期化: 設定の読み込みと時計の同期
    try {
        const showClock = await loadSetting("showClock");
        if (showClock === false) {
            trayArea.style.display = "none";
        }
        const savedSmallIcons = await loadSetting("smallIcons");
        if (savedSmallIcons) {
            window.smallIcons = true;
            const startMenu = document.getElementById("start-menu");
            if (startMenu) {
                startMenu.classList.add("small-icons");
            }
        }

        // 🔍 デバッグ用ログ：実際にどんな値が保存されているか確認
        const rawPos = await loadSetting("taskbarPosition");
        const rawSize = await loadSetting("taskbarSize");
        console.log("[Taskbar Debug] Loaded settings -> position:", rawPos, "size:", rawSize);

        // ウィンドウモードの設定を先に読み込む
        isTaskbarWindowMode = await loadSetting("taskbarWindowMode") || false;

        if (!isTaskbarWindowMode) {
            // ウィンドウモードが無効な場合のみ、保存されたタスクバーの配置とサイズを適用
            const savedPos = rawPos || "bottom";
            const savedSize = rawSize || 40;
            await applyTaskbarLayout(savedPos, savedSize);
        } else {
            // ウィンドウモード有効時はウィンドウモード側を適用
            await applyTaskbarWindowMode();
        }

        // Auto-hide 初期状態
        isAutoHide = await loadSetting("autoHide") || false;
        isTaskbarHidden = isAutoHide;
        updateAutoHideEffect();

        // 時刻オフセットの読み込み
        const savedOffset = await loadSetting("ClockAppOffset");
        if (savedOffset !== null && savedOffset !== undefined) {
            const offset = parseInt(savedOffset, 10);
            updateClockLabel(new Date(Date.now() + offset));
        } else {
            updateClockLabel(clockDate);
        }
    } catch (err) {
        console.error("[Taskbar] Initialization error:", err);
        updateClockLabel(new Date());
    } finally {
        // すべてのレイアウト・位置の適用が完了したら表示する
        taskbar.style.visibility = "visible";
    }

    // ClockApp からの即時更新イベント
    window.addEventListener("ClockAppTimeChange", e => {
        updateClockLabel(new Date(e.detail));
    });

    function closeAllRibbonsGlobal() {
        document.querySelectorAll(".ribbon-dropdown").forEach(dd => dd.style.display = "none");
        document.querySelectorAll(".ribbon-menu").forEach(m => m.classList.remove("selected"));
    }

    // ============================
    // Startボタン & グローバルクリック制御
    // ============================
    if (startBtn && startMenu) {
        startBtn.addEventListener("mousedown", e => {
            e.stopPropagation();
            if (!startMenu.children || startMenu.children.length === 0) {
                return;
            }
            hideContextMenu();
            closeAllRibbonsGlobal();
            document.querySelectorAll(".tree-panel").forEach(tp => tp.style.display = "none");

            const open = startMenu.style.display === "block";
            startMenu.style.display = open ? "none" : "block";

            if (!open) {
                // ✨ イベント経由でスタートメニュー側に位置更新を通知する
                window.dispatchEvent(new CustomEvent("request-start-menu-position-update"));
            }

            resetAllTitleBars();
            taskbarButtons.forEach(btn => btn.classList.remove("selected"));
        });

        document.addEventListener("mousedown", e => {
            if (!e.target.closest("#start-btn") && !e.target.closest("#start-menu")) {
                startBtn.classList.remove("pressed");
                startMenu.style.display = "none";
            }
            if (!e.target.closest(".ribbon-menu") && !e.target.closest(".ribbon-dropdown")) {
                closeAllRibbonsGlobal();
            }
        });
    }

    // ============================
    // リサイズ関連の状態とグローバルリスナー（1度だけ登録）
    // ============================

    // リサイズ中のマウス移動イベント
    document.addEventListener("mousemove", e => {
        if (!resizing) return;

        let delta = 0;
        if (currentPosition === "bottom") delta = startY - e.clientY;
        if (currentPosition === "top") delta = e.clientY - startY;
        if (currentPosition === "left") delta = e.clientX - startX;
        if (currentPosition === "right") delta = startX - e.clientX;

        let newSize = Math.round((startSize + delta) / 40) * 40;
        newSize = Math.min(MAX_SIZE, Math.max(MIN_SIZE, newSize));

        if (resizePreview) {
            const rect = taskbar.getBoundingClientRect();
            if (currentPosition === "bottom") Object.assign(resizePreview.style, { left: `${rect.left}px`, top: `${rect.bottom - newSize}px`, width: `${rect.width}px`, height: `${newSize}px` });
            if (currentPosition === "top") Object.assign(resizePreview.style, { left: `${rect.left}px`, top: "0px", width: `${rect.width}px`, height: `${newSize}px` });
            if (currentPosition === "left") Object.assign(resizePreview.style, { left: "0px", top: `${rect.top}px`, width: `${newSize}px`, height: `${rect.height}px` });
            if (currentPosition === "right") Object.assign(resizePreview.style, { left: `${rect.right - newSize}px`, top: `${rect.top}px`, width: `${newSize}px`, height: `${rect.height}px` });
        } else {
            applyTaskbarLayout(currentPosition, newSize);
        }
    });

    // リサイズの終了イベント
    document.addEventListener("mouseup", async () => {
        if (!resizing) return;
        resizing = false;

        if (resizeShield) { resizeShield.remove(); resizeShield = null; }

        let finalSize = taskbarSize;
        if (resizePreview) {
            const isVert = currentPosition === "left" || currentPosition === "right";
            finalSize = parseInt(isVert ? resizePreview.style.width : resizePreview.style.height);
            resizePreview.remove();
            resizePreview = null;
        }

        await saveSetting("taskbarSize", finalSize);
        applyTaskbarLayout(currentPosition, finalSize);
    });

    // ドラッグによる上下左右配置移動（ドッキング）
    (function enableTaskbarDragPosition() {
        let isDragging = false;
        let dragPreview = null;
        let targetPos = currentPosition;

        taskbar.addEventListener("mousedown", e => {
            if (e.target.closest("#start-btn") || e.target.closest(".taskbar-window-btn") || e.target.closest(".taskbar-ime-toolbar") || e.target === currentHandle || isTaskbarWindowMode) return;
            isDragging = true;
            targetPos = currentPosition;

            if (ENABLE_TASKBAR_PREVIEW) {
                dragPreview = document.createElement("div");
                Object.assign(dragPreview.style, {
                    position: "fixed",
                    border: "2px solid white",
                    background: "transparent",
                    pointerEvents: "none",
                    zIndex: 9999,
                    mixBlendMode: "difference",
                    transition: "none"
                });
                document.body.appendChild(dragPreview);
            }
        });

        document.addEventListener("mousemove", e => {
            if (!isDragging) return;

            const w = window.innerWidth;
            const h = window.innerHeight;
            const x = e.clientX;
            const y = e.clientY;

            // マウスの位置から上下左右どの画面端に近いか計算
            const dists = {
                top: y,
                bottom: h - y,
                left: x,
                right: w - x
            };
            const newTargetPos = Object.keys(dists).reduce((a, b) => dists[a] < dists[b] ? a : b);

            if (ENABLE_TASKBAR_PREVIEW && dragPreview) {
                targetPos = newTargetPos;
                const previewRect = {
                    top: { top: 0, left: 0, width: "100%", height: `${taskbarSize}px` },
                    bottom: { top: `${h - taskbarSize}px`, left: 0, width: "100%", height: `${taskbarSize}px` },
                    left: { top: 0, left: 0, width: `${taskbarSize}px`, height: "100%" },
                    right: { top: 0, left: `${w - taskbarSize}px`, width: `${taskbarSize}px`, height: "100%" }
                };
                Object.assign(dragPreview.style, previewRect[targetPos]);
            } else {
                if (newTargetPos !== targetPos) {
                    targetPos = newTargetPos;
                    const isVert = targetPos === "left" || targetPos === "right";
                    Object.assign(taskbar.style, {
                        top: (targetPos === "bottom") ? "auto" : "0px",
                        bottom: (targetPos === "top") ? "auto" : "0px",
                        left: (targetPos === "right") ? "auto" : "0px",
                        right: (targetPos === "left") ? "auto" : "0px",
                        width: isVert ? `${taskbarSize}px` : "100%",
                        height: isVert ? "100%" : `${taskbarSize}px`
                    });
                }
            }
        });

        document.addEventListener("mouseup", async () => {
            if (!isDragging) return;
            isDragging = false;

            if (dragPreview) {
                dragPreview.remove();
                dragPreview = null;
            }

            if (targetPos !== currentPosition) {
                await saveSetting("taskbarPosition", targetPos);
                applyTaskbarLayout(targetPos, taskbarSize);
            }
        });
    })();

    // ウィンドウリサイズ時の各種位置補正（複数あった処理を統合＆軽量化）
    let resizeTicking = false;
    window.addEventListener("resize", () => {
        updateAllTaskbarButtonModes();
        if (!resizeTicking) {
            requestAnimationFrame(() => {
                updateVersionPosition();
                // ✨ イベント経由で位置更新を指示
                window.dispatchEvent(new CustomEvent("request-start-menu-position-update"));
                resizeTicking = false;
            });
            resizeTicking = true;
        }
    });

    // ============================
    // 設定変更イベントのハンドリング
    // ============================
    window.addEventListener("taskbar-style-changed", (e) => {
        const { showClock, taskbarSize, taskbarPosition, autoHide, smallIcons, taskbarWindowMode } = e.detail;

        // ⭕ タスクバーの位置変更の即時反映
        if (taskbarPosition !== undefined && taskbarPosition !== currentPosition) {
            applyTaskbarLayout(taskbarPosition, taskbarSize);
        }

        // Auto-hide 設定の反映
        if (autoHide !== undefined) {
            isAutoHide = autoHide;
            isTaskbarHidden = autoHide; // 有効化した瞬間に隠す
            updateAutoHideEffect();
        }

        if (taskbarWindowMode !== undefined) {
            isTaskbarWindowMode = taskbarWindowMode;
            applyTaskbarWindowMode();
        }

        // 時計の表示/非表示切り替え
        if (showClock !== undefined) {
            const tray = taskbar.querySelector(".taskbar-tray");
            if (tray) tray.style.display = showClock ? "flex" : "none";
        }

        if (taskbarSize !== undefined) {
            applyTaskbarLayout(currentPosition, taskbarSize);
        }

        // スモールアイコン設定 (startmenu.jsへの伝達)
        if (smallIcons !== undefined) {
            window.smallIcons = Boolean(smallIcons);

            const startMenu = document.getElementById("start-menu");
            if (startMenu) {
                startMenu.classList.toggle("small-icons", window.smallIcons);
            }

            // ✨ 直接関数を呼ばず、イベント経由でスタートメニュー側に再構築を指示する
            window.dispatchEvent(new CustomEvent("request-refresh-start-menu"));
        }
    });

    setupTaskbarContextMenu(taskbar);

}