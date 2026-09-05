// ui.js
let isGlobalMouseUpRegistered = false;
let pressedEl = null;
let globalTooltip = null;
let tooltipTimer = null;
let currentClientX = 0;
let currentClientY = 0;

const createTooltip = () => {
    if (globalTooltip) return globalTooltip;
    globalTooltip = document.createElement("div");
    Object.assign(globalTooltip.style, {
        position: "fixed",
        backgroundColor: "#FFFFE1",
        color: "#000000",
        padding: "4px 8px",
        fontSize: "11px",
        borderRadius: "0px",
        whiteSpace: "nowrap",
        pointerEvents: "none",
        display: "none",
        zIndex: "99999",
        border: "1px solid black"
    });
    document.body.appendChild(globalTooltip);
    return globalTooltip;
};

const getTargetButton = (el) => {
    if (!el || el === document || el === document.body) return null;
    const target = el.closest('button, .button, .button2');
    if (!target || target.classList.contains('win95-tab')) return null;
    return target;
};

export function installDynamicButtonEffect() {
    const root = document.body;

    if (root._uiObserver) {
        root._uiObserver.disconnect();
        root._uiEffectInstalled = false;
    }

    if (root._uiEffectInstalled) return;
    root._uiEffectInstalled = true;

    const tooltip = createTooltip();

    // 追加: マウス移動時に常に最新の座標を更新
    root.addEventListener("mousemove", e => {
        currentClientX = e.clientX;
        currentClientY = e.clientY;
    });

    root.addEventListener("mousedown", e => {
        clearTimeout(tooltipTimer);
        tooltip.style.display = "none";

        const el = getTargetButton(e.target);
        if (!el) return;
        pressedEl = el;
        el.classList.add("pressed");
    });

    root.addEventListener("mouseover", e => {
        const el = getTargetButton(e.target);
        if (el && el === pressedEl) {
            el.classList.add("pressed");
        }

        const tooltipTarget = e.target.closest("[data-tooltip]");
        if (tooltipTarget) {
            const text = tooltipTarget.getAttribute("data-tooltip");
            if (text) {
                clearTimeout(tooltipTimer);

                // mouseover時の座標も念のため更新
                currentClientX = e.clientX;
                currentClientY = e.clientY;

                tooltipTimer = setTimeout(() => {
                    // 改善: タイマー発火時に要素がDOMから削除されていたら表示しない
                    if (!tooltipTarget.isConnected) return;

                    tooltip.textContent = text;
                    tooltip.style.visibility = "hidden";
                    tooltip.style.display = "block";

                    // 最新の座標を使用
                    let left = currentClientX + 12;
                    let top = currentClientY + 20;

                    if (left + tooltip.offsetWidth > window.innerWidth) {
                        left = currentClientX - tooltip.offsetWidth - 12;
                    }
                    if (top + tooltip.offsetHeight > window.innerHeight) {
                        top = currentClientY - tooltip.offsetHeight - 10;
                    }

                    tooltip.style.left = `${left}px`;
                    tooltip.style.top = `${top}px`;
                    tooltip.style.visibility = "visible";
                }, 500);
            }
        } else {
            // 改善: ツールチップ対象外の要素へマウスが移動した場合も確実に消去
            clearTimeout(tooltipTimer);
            tooltip.style.display = "none";
        }
    });

    root.addEventListener("mouseout", e => {
        const el = getTargetButton(e.target);
        if (el && el === pressedEl) {
            el.classList.remove("pressed");
        }

        const tooltipTarget = e.target.closest("[data-tooltip]");
        if (tooltipTarget) {
            const related = e.relatedTarget;
            if (related && tooltipTarget.contains(related)) return;
            clearTimeout(tooltipTimer);
            tooltip.style.display = "none";
        }
    });

    if (!isGlobalMouseUpRegistered) {
        document.addEventListener("mouseup", () => {
            if (pressedEl) {
                pressedEl.classList.remove("pressed");
                pressedEl = null;
            }
        });
        isGlobalMouseUpRegistered = true;
    }

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