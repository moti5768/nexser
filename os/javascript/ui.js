// ui.js
import { bringToFront } from "./window.js";
import { hideContextMenu } from "./context-menu.js";

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

// グローバルでリボンとツリーを閉じる関数
export function closeAllRibbonDropdownsAndSelectedGlobal() {
    document.querySelectorAll(".ribbon-dropdown").forEach(dd => dd.style.display = "none");
    document.querySelectorAll(".ribbon-menu").forEach(m => m.classList.remove("selected"));
    document.querySelectorAll(".tree-panel").forEach(tp => tp.style.display = "none");
}

export function installDynamicButtonEffect() {
    const root = document.body;

    if (root._uiObserver) {
        root._uiObserver.disconnect();
        root._uiEffectInstalled = false;
    }

    if (root._uiEffectInstalled) return;
    root._uiEffectInstalled = true;

    const tooltip = createTooltip();

    // マウス移動時に常に最新の座標を更新
    root.addEventListener("mousemove", e => {
        currentClientX = e.clientX;
        currentClientY = e.clientY;
    });

    root.addEventListener("mousedown", e => {
        clearTimeout(tooltipTimer);
        tooltip.style.display = "none";

        // ====== リボンのクリック開閉およびトグル処理 ======
        const ribbonMenu = e.target.closest(".ribbon-menu");
        const isInsideRibbon = ribbonMenu || e.target.closest(".ribbon-dropdown") || e.target.closest(".ribbon-item");
        const isInsideTree = e.target.closest(".tree-container") || e.target.closest(".tree-panel");
        const isInsideContextMenu = e.target.closest(".context-menu");

        // ツリーや右クリックメニュー内のクリックは無視する
        if (!isInsideTree && !isInsideContextMenu) {
            // 追加: ドロップダウン内のメニュー項目をクリックした時は mousedown では何もせず、click イベント(ribbon.js)に処理を任せる
            if (e.target.closest(".ribbon-dropdown")) {
                // 何もしない
            } else if (ribbonMenu) {
                const dropdown = ribbonMenu.querySelector(".ribbon-dropdown");
                // 既に開いているか状態を記録（トグル動作のため）
                const isOpen = dropdown && dropdown.style.display === "block";

                // 一旦すべて閉じる
                closeAllRibbonDropdownsAndSelectedGlobal();

                // 閉じていた場合のみ開く処理を実行（開いていた場合は閉じるだけになる）
                if (!isOpen) {
                    const startMenu = document.getElementById("start-menu");
                    if (startMenu) startMenu.style.display = "none";

                    const win = ribbonMenu.closest(".window");
                    if (win) {
                        bringToFront(win);
                        if (win._treePanel) win._treePanel.style.display = "none";
                    }
                    hideContextMenu();

                    // ribbon.js で要素に紐付けた状態更新関数を呼び出す
                    if (typeof ribbonMenu._refreshStatus === "function") {
                        ribbonMenu._refreshStatus();
                    }

                    if (dropdown) dropdown.style.display = "block";
                    ribbonMenu.classList.add("selected");
                }
            } else if (!isInsideRibbon) {
                // リボンの外側をクリックした場合はすべて閉じる
                closeAllRibbonDropdownsAndSelectedGlobal();
            }
        }
        // =================================================

        const el = getTargetButton(e.target);
        if (!el) return;
        pressedEl = el;
        el.classList.add("pressed");
    });

    root.addEventListener("mouseover", e => {
        // ====== リボンメニューのホバー切り替え処理 ======
        const ribbonMenu = e.target.closest(".ribbon-menu");
        if (ribbonMenu) {
            const dropdown = ribbonMenu.querySelector(".ribbon-dropdown");
            // 対象のドロップダウンがまだ開いていない場合のみ実行
            if (dropdown && dropdown.style.display !== "block") {
                // 改善: parentElementを使用し、同じリボンコンテナ内の兄弟要素を確実に参照する
                const ribbonContainer = ribbonMenu.parentElement;
                if (ribbonContainer) {
                    // 同一リボン内で「selected」クラスを持つメニュー（開いているメニュー）があるか判定
                    const anyOpen = ribbonContainer.querySelector('.ribbon-menu.selected');
                    if (anyOpen) {
                        hideContextMenu();
                        closeAllRibbonDropdownsAndSelectedGlobal();

                        if (typeof ribbonMenu._refreshStatus === "function") {
                            ribbonMenu._refreshStatus();
                        }

                        dropdown.style.display = "block";
                        ribbonMenu.classList.add("selected");
                    }
                }
            }
        }
        // ===============================================

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
                    // タイマー発火時に要素がDOMから削除されていたら表示しない
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
            // ツールチップ対象外の要素へマウスが移動した場合も確実に消去
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