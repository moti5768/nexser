// taskbar.js
import { resetAllTitleBars, taskbarButtons } from "./window.js";
import { hideContextMenu } from "./context-menu.js";
import { clockDate } from "./apps/clock.js";  // ClockApp の currentDate を参照
import { saveSetting, loadSetting } from "./apps/settings.js"; // 保存読み込み
import { updateStartMenuPosition } from "./startmenu.js";

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

    if (!trayArea) {
        trayArea = document.createElement("div");
        trayArea.className = "taskbar-tray";
        taskbar.appendChild(trayArea);
    }

    return { startArea, buttonArea, trayArea };
}

export function initTaskbar() {
    const taskbar = document.getElementById("taskbar");
    if (!taskbar) return;

    const startBtn = document.getElementById("start-btn");
    const startMenu = document.getElementById("start-menu");

    const { startArea, buttonArea, trayArea } = ensureTaskbarAreas(taskbar);

    // 内部状態管理
    let isAutoHide = false;
    let isTaskbarHidden = false;

    // タスクバー基本スタイル
    Object.assign(taskbar.style, {
        display: "flex",
        alignItems: "flex-start",
        transition: "none" // アニメーションはいらない
    });

    // 各エリアのスタイル
    Object.assign(startArea.style, {
        display: "flex",
        alignItems: "flex-start",
        gap: "6px",
        marginTop: "5px"
    });

    Object.assign(buttonArea.style, {
        flex: "1 1 auto",
        minWidth: "0",
        display: "flex",
        alignItems: "flex-start",
        overflowX: "hidden",
        overflowY: "hidden",
        marginTop: "5px"
    });

    Object.assign(trayArea.style, {
        display: "flex",
        alignItems: "flex-start",
        gap: "6px",
        flexShrink: "0",
        marginLeft: "10px",
        marginRight: "0px",
        border: "1.5px solid",
        borderColor: "#7a7a7a #fff #fff #7a7a7a",
        boxShadow: "0.5px 0.5px 0 #000 inset",
        transform: "translate(0.5px, 0.5px)",
        marginTop: "5px"
    });

    // Startボタン配置
    if (startBtn && startBtn.parentElement !== startArea) startArea.appendChild(startBtn);

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
    window.addEventListener("resize", updateVersionPosition);

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

    // マウス位置による出し入れ判定
    document.addEventListener("mousemove", (e) => {
        if (!isAutoHide) return;

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
            padding: "3px",
            whiteSpace: "nowrap",
            color: "black",
            pointerEvents: "none",
            userSelect: "none",
        });
        trayArea.appendChild(clockLabel);
    }

    function updateClockLabel(date) {
        let hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, "0");
        const ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12;
        if (hours === 0) hours = 12;
        const hoursStr = hours.toString().padStart(2, "0");
        clockLabel.textContent = `${hoursStr}:${minutes} ${ampm}`;
    }

    // 初期化: 設定の読み込みと時計の同期
    (async () => {
        try {

            const showClock = await loadSetting("showClock");
            if (showClock === false) {
                trayArea.style.display = "none";
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
            updateClockLabel(new Date());
        }
    })();

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
            hideContextMenu();
            closeAllRibbonsGlobal();
            document.querySelectorAll(".tree-panel").forEach(tp => tp.style.display = "none");

            const open = startMenu.style.display === "block";
            startMenu.style.display = open ? "none" : "block";

            if (!open) updateStartMenuPosition();

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
    // タスクバー上端リサイズ
    // ============================
    (async function enableTaskbarResize() {
        const savedHeight = await loadSetting("taskbarHeight");
        if (savedHeight) taskbar.style.height = savedHeight + "px";

        window.dispatchEvent(new Event("desktop-resize"));

        const handle = document.createElement("div");
        Object.assign(handle.style, {
            position: "absolute",
            top: "0", left: "0", right: "0", height: "6px",
            cursor: "ns-resize", zIndex: "1000", background: "transparent"
        });
        taskbar.appendChild(handle);

        let resizing = false, startY = 0, startHeight = 0;
        let preview = null, shield = null;

        const MIN_HEIGHT = 40;
        const MAX_HEIGHT = 320;

        handle.addEventListener("mousedown", e => {
            if (!e.target.closest("#start-btn") && !e.target.closest("#start-menu")) {
                startBtn.classList.remove("pressed");
                startMenu.style.display = "none";
            }
            e.preventDefault();
            e.stopPropagation();
            resizing = true;
            startY = e.clientY;
            startHeight = taskbar.offsetHeight;

            shield = document.createElement("div");
            Object.assign(shield.style, {
                position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
                zIndex: 9998, background: "transparent", cursor: "ns-resize"
            });
            document.body.appendChild(shield);

            preview = document.createElement("div");
            Object.assign(preview.style, {
                position: "fixed",
                left: taskbar.getBoundingClientRect().left + "px",
                width: taskbar.offsetWidth + "px",
                height: startHeight + "px",
                border: "2px solid white",
                background: "transparent",
                pointerEvents: "none",
                zIndex: 9999,
                top: taskbar.getBoundingClientRect().top + "px",
                mixBlendMode: "difference",
            });
            document.body.appendChild(preview);
            document.body.style.userSelect = "none";
            document.body.style.cursor = "ns-resize";
        });

        document.addEventListener("mousemove", e => {
            if (!resizing || !preview) return;
            let dy = startY - e.clientY;
            let newHeight = Math.round((startHeight + dy) / 40) * 40;
            newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, newHeight));

            const rect = taskbar.getBoundingClientRect();
            preview.style.height = newHeight + "px";
            preview.style.top = rect.bottom - newHeight + "px";
        });

        document.addEventListener("mouseup", async () => {
            if (!resizing) return;
            resizing = false;
            document.body.style.userSelect = "";
            document.body.style.cursor = "";

            if (shield) { shield.remove(); shield = null; }

            if (preview) {
                let finalHeight = parseInt(preview.style.height);
                finalHeight = Math.round(finalHeight / 40) * 40;
                finalHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, finalHeight));

                if (finalHeight !== taskbar.offsetHeight) {
                    taskbar.style.height = finalHeight + "px";
                    if (versionLabel) versionLabel.style.bottom = `${finalHeight}px`;

                    await saveSetting("taskbarHeight", finalHeight);

                    // --- ここから追加 ---
                    // 設定画面側がこの変更を検知できるようにイベントを発行する
                    window.dispatchEvent(new CustomEvent("taskbar-height-external-change", {
                        detail: { height: finalHeight }
                    }));
                    // --- ここまで追加 ---

                    document.querySelectorAll(".window.maximized").forEach(win => {
                        win.style.height = `calc(100% - ${finalHeight}px)`;
                    });
                }
                preview.remove();
                preview = null;
                updateAutoHideEffect(); // 高さ変更に合わせて隠し位置も更新
                window.dispatchEvent(new Event("desktop-resize"));
            }
        });
    })();

    // ウィンドウリサイズ時のスタートメニュー位置補正
    window.addEventListener("resize", () => {
        updateStartMenuPosition();
    });

    // ============================
    // 設定変更イベントのハンドリング
    // ============================
    window.addEventListener("taskbar-style-changed", (e) => {
        const { showClock, taskbarHeight, autoHide, smallIcons } = e.detail;
        // Auto-hide 設定の反映
        if (autoHide !== undefined) {
            isAutoHide = autoHide;
            isTaskbarHidden = autoHide; // 有効化した瞬間に隠す
            updateAutoHideEffect();
        }

        // 時計の表示/非表示切り替え
        if (showClock !== undefined) {
            const tray = taskbar.querySelector(".taskbar-tray");
            if (tray) tray.style.display = showClock ? "flex" : "none";
        }

        // 高さ変更の即時反映
        if (taskbarHeight !== undefined) {
            taskbar.style.height = taskbarHeight + "px";
            if (versionLabel) versionLabel.style.bottom = `${taskbarHeight}px`;

            document.querySelectorAll(".window.maximized").forEach(win => {
                win.style.height = `calc(100% - ${taskbarHeight}px)`;
            });
            updateAutoHideEffect(); // 隠し位置の再計算
            window.dispatchEvent(new Event("desktop-resize"));
        }

        // スモールアイコン設定 (startmenu.jsへの伝達)
        if (smallIcons !== undefined) {
            // startmenu.js 側でこのイベントを listen して再描画することを想定
            // もしくはグローバル変数 window.smallIcons を更新
            window.smallIcons = smallIcons;
            const { buildStartMenu } = require("./startmenu.js"); // 動的ロードまたは既存関数の実行
            if (typeof buildStartMenu === "function") buildStartMenu();
        }
    });
}