// ui.js
export function installDynamicButtonEffect(root = document.body) {
    const isTarget = el =>
        el instanceof HTMLButtonElement ||
        el.classList.contains("button") ||
        el.classList.contains("button2");

    let pressedEl = null; // 現在押しているボタン

    // --- 通常ボタン用 ---
    root.addEventListener("mousedown", e => {
        const el = e.target;
        if (!isTarget(el)) return;
        pressedEl = el;
        el.classList.add("pressed");
    });

    document.addEventListener("mouseup", e => {
        if (pressedEl) {
            pressedEl.classList.remove("pressed");
            pressedEl = null;
        }
    });

    root.addEventListener("mouseleave", e => {
        const el = e.target;
        if (!isTarget(el)) return;
        if (el === pressedEl) el.classList.remove("pressed");
    }, true);

    root.addEventListener("mouseenter", e => {
        const el = e.target;
        if (!isTarget(el)) return;
        if (el === pressedEl) el.classList.add("pressed");
    }, true);

    // --- start-btn 用トグル ---
    const startBtn = document.getElementById("start-btn");
    const startMenu = document.getElementById("start-menu");

    if (startBtn) {
        startBtn.addEventListener("mousedown", e => {
            startBtn.classList.toggle("pressed");
        });

        // start-menu がクリックで閉じられたら pressed を戻す
        if (startMenu) {
            startMenu.addEventListener("click", e => {
                if (getComputedStyle(startMenu).display === "none") {
                    startBtn.classList.remove("pressed");
                }
            });
        }
    }
}
