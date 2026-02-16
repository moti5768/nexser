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

    // タスクバー
    Object.assign(taskbar.style, { display: "flex", alignItems: "flex-start" });

    // startArea
    Object.assign(startArea.style, {
        display: "flex",
        alignItems: "flex-start",
        gap: "6px",
        marginTop: "5px"   // 上に少し余白
    });

    // buttonArea
    Object.assign(buttonArea.style, {
        flex: "1 1 auto",
        minWidth: "0",
        display: "flex",
        alignItems: "flex-start",
        overflowX: "hidden",
        overflowY: "hidden",
        marginTop: "5px"
    });

    // trayArea
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
    // 時計表示（右エリア）
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

    // 時刻の表示更新用フォーマット関数
    function updateClockLabel(date) {
        let hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, "0");
        const ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12;
        if (hours === 0) hours = 12;
        const hoursStr = hours.toString().padStart(2, "0");
        clockLabel.textContent = `${hoursStr}:${minutes} ${ampm}`;
    }

    // 【重要】ClockAppOffset (ミリ秒差分) を読み込んで初期表示を計算
    (async () => {
        try {
            const savedOffset = await loadSetting("ClockAppOffset");
            if (savedOffset !== null && savedOffset !== undefined) {
                const offset = parseInt(savedOffset, 10);
                // OSの現在時刻に差分を足した時刻を表示
                updateClockLabel(new Date(Date.now() + offset));
            } else {
                updateClockLabel(clockDate); // ClockApp の初期状態
            }
        } catch (err) {
            updateClockLabel(new Date());
        }
    })();

    // ClockApp で時間変更イベントが発生したときに即座に更新
    window.addEventListener("ClockAppTimeChange", e => {
        // e.detail には計算済みの Date オブジェクトが含まれる
        updateClockLabel(new Date(e.detail));
    });

    // ------------------------
    // 全ウィンドウのリボンドロップダウンを閉じ、selected を解除
    // ------------------------
    function closeAllRibbonsGlobal() {
        document.querySelectorAll(".ribbon-dropdown").forEach(dd => dd.style.display = "none");
        document.querySelectorAll(".ribbon-menu").forEach(m => m.classList.remove("selected"));
    }

    // ============================
    // Startボタン制御
    // ============================
    if (startBtn && startMenu) {
        startBtn.addEventListener("mousedown", e => {
            e.stopPropagation();
            hideContextMenu();
            closeAllRibbonsGlobal();
            const open = startMenu.style.display === "block";
            startMenu.style.display = open ? "none" : "block";

            if (!open) {
                updateStartMenuPosition();
            }

            resetAllTitleBars();
            taskbarButtons.forEach(btn => btn.classList.remove("selected"));
        });

        document.addEventListener("mousedown", e => {
            if (!e.target.closest("#start-btn") && !e.target.closest("#start-menu")) {
                startBtn.classList.remove("pressed");
                startMenu.style.display = "none";
            }
        });
    }

    // ============================
    // タスクバー上端リサイズ
    // ============================
    (async function enableTaskbarResize() {
        // 初期高さを復元
        const savedHeight = await loadSetting("taskbarHeight");
        if (savedHeight) taskbar.style.height = savedHeight + "px";

        window.dispatchEvent(new Event("desktop-resize"));

        const handle = document.createElement("div");
        Object.assign(handle.style, {
            position: "absolute",
            top: "0",
            left: "0",
            right: "0",
            height: "6px",
            cursor: "ns-resize",
            zIndex: "1000",
            background: "transparent",
        });
        taskbar.appendChild(handle);

        let resizing = false, startY = 0, startHeight = 0;
        let preview = null;

        const MIN_HEIGHT = 40;
        const MAX_HEIGHT = 320; // 上限

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

            // プレビュー枠作成（反転色）
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
            let newHeight = startHeight + dy;

            // 40px刻みに丸める
            newHeight = Math.round(newHeight / 40) * 40;
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

            if (preview) {
                let finalHeight = parseInt(preview.style.height);
                finalHeight = Math.round(finalHeight / 40) * 40;
                finalHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, finalHeight));

                if (finalHeight !== taskbar.offsetHeight) {
                    taskbar.style.height = finalHeight + "px";

                    const versionLabel = taskbar.querySelector(".os-version-label");
                    if (versionLabel) versionLabel.style.bottom = `${finalHeight}px`;

                    await saveSetting("taskbarHeight", finalHeight);

                    document.querySelectorAll(".window.maximized").forEach(win => {
                        win.style.height = `calc(100% - ${finalHeight}px)`;
                    });
                }

                preview.remove();
                preview = null;
                window.dispatchEvent(new Event("desktop-resize"));
            }
        });
    })();

    window.addEventListener("resize", () => {
        updateStartMenuPosition();
    });
}