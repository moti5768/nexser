// ui.js
let isGlobalMouseUpRegistered = false;
let pressedEl = null;

export function installDynamicButtonEffect() {
    // 常に body を対象にする[cite: 1]
    const root = document.body;

    // 再起動・再実行時のクリーンアップ[cite: 1]
    if (root._uiObserver) {
        root._uiObserver.disconnect();
        root._uiEffectInstalled = false;
    }

    if (root._uiEffectInstalled) return;
    root._uiEffectInstalled = true;

    // ボタン判定ロジック：標準のbuttonタグ、または特定のクラスを持つ要素（win95-tabは除外）
    const getTargetButton = (el) => {
        if (!el || el === document || el === document.body) return null;
        const target = el.closest('button, .button, .button2');
        // win95-tab クラスを持つ要素は除外する
        if (!target || target.classList.contains('win95-tab')) {
            return null;
        }
        return target;
    };

    // --- マウスイベント (bodyで一括受信) ---[cite: 1]
    root.addEventListener("mousedown", e => {
        const el = getTargetButton(e.target);
        if (!el) return;
        pressedEl = el;
        el.classList.add("pressed");
    });

    root.addEventListener("mouseover", e => {
        const el = getTargetButton(e.target);
        if (!el) return;
        if (el === pressedEl) {
            el.classList.add("pressed");
        }
    });

    root.addEventListener("mouseout", e => {
        const el = getTargetButton(e.target);
        if (!el) return;
        if (el === pressedEl) {
            el.classList.remove("pressed");
        }
    });

    // --- グローバル mouseup (一生に一度だけ登録) ---[cite: 1]
    if (!isGlobalMouseUpRegistered) {
        document.addEventListener("mouseup", () => {
            if (pressedEl) {
                pressedEl.classList.remove("pressed");
                pressedEl = null;
            }
        });
        isGlobalMouseUpRegistered = true;
    }

    // --- 特殊制御（スタートメニュー等） ---[cite: 1]
    const startMenu = document.getElementById("start-menu");
    const startBtn = document.getElementById("start-btn");

    if (startMenu && startBtn) {
        const observer = new MutationObserver(() => {
            const isVisible = getComputedStyle(startMenu).display !== "none";
            if (isVisible) {
                startBtn.classList.add("pressed");
            } else if (pressedEl !== startBtn) {
                startBtn.classList.remove("pressed");
            }
        });
        observer.observe(startMenu, { attributes: true, attributeFilter: ['style', 'class'] });
        root._uiObserver = observer;
    }
}