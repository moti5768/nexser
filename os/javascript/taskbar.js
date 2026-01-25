// taskbar.js
import { resetAllTitleBars } from "./window.js";
import { taskbarButtons } from "./window.js";
import { hideContextMenu } from "./context-menu.js"
export function initTaskbar() {
    const taskbar = document.getElementById("taskbar");
    if (!taskbar) return;

    const startBtn = document.getElementById("start-btn");
    const startMenu = document.getElementById("start-menu");

    /* ============================
       バージョン表示
    ============================ */

    // 既に存在していたら再生成しない（多重生成防止）
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

    // タスクバー高さ分だけ真上に配置
    function updateVersionPosition() {
        const h = taskbar.offsetHeight; // 見た目と一致しやすい
        versionLabel.style.bottom = `${h}px`;
    }

    updateVersionPosition();
    window.addEventListener("resize", updateVersionPosition);

    /* ============================
       Startボタン制御
    ============================ */

    if (startBtn && startMenu) {
        startBtn.addEventListener("mousedown", e => {
            e.stopPropagation();
            hideContextMenu();
            const open = startMenu.style.display === "block";
            startMenu.style.display = open ? "none" : "block";
            // 全ウィンドウのタイトルバー色リセット
            resetAllTitleBars();
            taskbarButtons.forEach(btn => btn.classList.remove("selected"));
        });

        /* 外クリックで閉じる */
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