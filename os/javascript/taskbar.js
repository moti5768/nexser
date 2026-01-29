// taskbar.js
import { resetAllTitleBars, taskbarButtons } from "./window.js";
import { hideContextMenu } from "./context-menu.js";

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

    /* ============================
       エリア初期化
    ============================ */
    const { startArea, buttonArea, trayArea } = ensureTaskbarAreas(taskbar);

    /* ============================
       タスクバー全体レイアウト
    ============================ */
    Object.assign(taskbar.style, {
        display: "flex",
        alignItems: "center",
    });

    Object.assign(startArea.style, {
        display: "flex",
        alignItems: "center",
        gap: "6px",
    });

    Object.assign(buttonArea.style, {
        flex: "1 1 auto",   // ← auto にする
        minWidth: "0",      // ← flex のはみ出し対策
        display: "flex",
        alignItems: "center",
        overflowX: "hidden",
        overflowY: "hidden",
    });

    Object.assign(trayArea.style, {
        display: "flex",
        alignItems: "center",
        gap: "6px",
        flexShrink: "0",
        marginLeft: "10px",    // ← 左も少し詰める（バランス）
        marginRight: "20px",    // ← 左も少し詰める（バランス）
        border: "1.5px solid",
        borderColor: "#7a7a7a #fff #fff #7a7a7a",
        boxShadow: "0.5px 0.5px 0 #000 inset",
        transform: "translate(0.5px, 0.5px)",
    });


    /* ============================
       Startボタンを左エリアへ
    ============================ */
    if (startBtn && startBtn.parentElement !== startArea) {
        startArea.appendChild(startBtn);
    }

    /* ============================
       バージョン表示（従来どおり）
    ============================ */
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

    /* ============================
       時計表示（右エリア）
    ============================ */
    let clockLabel = trayArea.querySelector(".taskbar-clock");
    if (!clockLabel) {
        clockLabel = document.createElement("div");
        clockLabel.className = "taskbar-clock";

        Object.assign(clockLabel.style, {
            fontSize: "medium",
            padding: "2px 4px",    // ← 文字の上下に余白を作る
            whiteSpace: "nowrap", // ← 折り返し防止
            color: "black",
            pointerEvents: "none",
            userSelect: "none",
        });

        trayArea.appendChild(clockLabel);
    }

    function updateClock() {
        const now = new Date();
        let hours = now.getHours();
        const minutes = now.getMinutes().toString().padStart(2, "0");

        const ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12;
        if (hours === 0) hours = 12;

        const hoursStr = hours.toString().padStart(2, "0");
        clockLabel.textContent = `${hoursStr}:${minutes} ${ampm}`;
    }

    updateClock();
    setInterval(updateClock, 1000);

    /* ============================
       Startボタン制御（そのまま）
    ============================ */
    if (startBtn && startMenu) {
        startBtn.addEventListener("mousedown", e => {
            e.stopPropagation();
            hideContextMenu();

            const open = startMenu.style.display === "block";
            startMenu.style.display = open ? "none" : "block";

            resetAllTitleBars();
            taskbarButtons.forEach(btn => btn.classList.remove("selected"));
        });

        document.addEventListener("mousedown", e => {
            if (
                !e.target.closest("#start-btn") &&
                !e.target.closest("#start-menu")
            ) {
                startBtn.classList.remove("pressed");
                startMenu.style.display = "none";
            }
        });
    }
}
