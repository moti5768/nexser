// ui.js
// document 全体で一度だけ登録すればよい mouseup のための管理フラグ
let isGlobalMouseUpRegistered = false;
let pressedEl = null; // 現在押しているボタン（モジュールレベルで共有）

export function installDynamicButtonEffect(root = document.body) {
    // 1. root要素ごとの二重初期化防止
    if (root._uiEffectInstalled) return;
    root._uiEffectInstalled = true;

    const isTarget = el =>
        el instanceof HTMLButtonElement ||
        el.classList.contains("button") ||
        el.classList.contains("button2");

    // --- 通常ボタン用 (mousedown/mouseenter/mouseleave) ---
    root.addEventListener("mousedown", e => {
        const el = e.target.closest('button, .button, .button2'); // 子要素（アイコン等）をクリックしても反応するように
        if (!el || !isTarget(el)) return;
        pressedEl = el;
        el.classList.add("pressed");
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

    // --- グローバル mouseup (一生に一度だけ登録) ---
    if (!isGlobalMouseUpRegistered) {
        document.addEventListener("mouseup", () => {
            if (pressedEl) {
                pressedEl.classList.remove("pressed");
                pressedEl = null;
            }
        });
        isGlobalMouseUpRegistered = true;
    }

    // --- スタートメニュー専用の制御 ---
    const startBtn = document.getElementById("start-btn");
    const startMenu = document.getElementById("start-menu");

    if (startBtn && startMenu) {
        // スタートメニューの表示状態を監視して、ボタンの凹凸を同期させる
        const observer = new MutationObserver(() => {
            const isVisible = getComputedStyle(startMenu).display !== "none";
            if (isVisible) {
                startBtn.classList.add("pressed");
            } else {
                startBtn.classList.remove("pressed");
            }
        });

        observer.observe(startMenu, { attributes: true, attributeFilter: ['style', 'class'] });
    }
}