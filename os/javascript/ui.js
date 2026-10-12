// ui.js
import { bringToFront } from "./window.js";
import { hideContextMenu } from "./context-menu.js";

let isGlobalMouseUpRegistered = false;
let isBodyListenersRegistered = false;
let pressedEl = null;
let globalTooltip = null;
let tooltipTimer = null;
let currentClientX = 0;
let currentClientY = 0;

/**
 * ツールチップ要素の生成・取得
 */
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

/**
 * 対象要素がボタン系か判定する
 */
const getTargetButton = (el) => {
    if (!el || el === document || el === document.body) return null;
    const target = el.closest('button, .button, .button2');
    if (!target || target.classList.contains('win95-tab')) return null;
    return target;
};

/**
 * すべてのリボンメニューのドロップダウンとツリーパネルを閉じる
 */
export function closeAllRibbonDropdownsAndSelectedGlobal() {
    document.querySelectorAll(".ribbon-dropdown").forEach(dd => dd.style.display = "none");
    document.querySelectorAll(".ribbon-menu").forEach(m => m.classList.remove("selected"));
    document.querySelectorAll(".tree-panel").forEach(tp => tp.style.display = "none");
}

/**
 * 動的なボタン効果およびリボン・ツールチップのインタラクションを初期化する
 */
export function installDynamicButtonEffect() {
    const root = document.body;

    // 前回のオブザーバーがあれば破棄
    if (root._uiObserver) {
        root._uiObserver.disconnect();
        root._uiObserver = null;
    }

    const tooltip = createTooltip();

    // ==========================================================
    // イベントリスナーの重複登録を防ぐためのガード（再起動・ログオフ対策）
    // ==========================================================
    if (!isBodyListenersRegistered) {
        // マウス移動座標の追跡
        root.addEventListener("mousemove", e => {
            currentClientX = e.clientX;
            currentClientY = e.clientY;
        });

        // マウスダウン時の処理（リボン開閉、ボタン押下状態）
        root.addEventListener("mousedown", e => {
            clearTimeout(tooltipTimer);
            tooltip.style.display = "none";

            const ribbonMenu = e.target.closest(".ribbon-menu");
            const isInsideTree = e.target.closest(".tree-container") || e.target.closest(".tree-panel");
            const isInsideContextMenu = e.target.closest(".context-menu");

            // ツリーや右クリックメニュー内以外の場合の処理
            if (!isInsideTree && !isInsideContextMenu) {
                if (e.target.closest(".ribbon-dropdown")) {
                    // ドロップダウン内の項目クリック時は ribbon.js 側のクリックイベントに任せる
                } else if (ribbonMenu) {
                    const dropdown = ribbonMenu.querySelector(".ribbon-dropdown");
                    const isOpen = dropdown && (dropdown.style.display === "block" || getComputedStyle(dropdown).display === "block");

                    closeAllRibbonDropdownsAndSelectedGlobal();

                    if (!isOpen) {
                        const startMenu = document.getElementById("start-menu");
                        if (startMenu) startMenu.style.display = "none";

                        const win = ribbonMenu.closest(".window");
                        if (win) {
                            bringToFront(win);
                            if (win._treePanel) win._treePanel.style.display = "none";
                        }
                        hideContextMenu();

                        if (typeof ribbonMenu._refreshStatus === "function") {
                            ribbonMenu._refreshStatus();
                        }

                        if (dropdown) dropdown.style.display = "block";
                        ribbonMenu.classList.add("selected");
                    }

                    e.preventDefault();
                } else {
                    // リボンの外側をクリックした場合はすべて閉じる
                    closeAllRibbonDropdownsAndSelectedGlobal();
                }
            }

            const el = getTargetButton(e.target);
            if (!el) return;
            pressedEl = el;
            el.classList.add("pressed");
        });

        // マウスオーバー時の処理（リボンホバー切り替え、ツールチップ）
        root.addEventListener("mouseover", e => {
            // リボンメニューのホバー時自動切り替え
            const ribbonMenu = e.target.closest(".ribbon-menu");
            if (ribbonMenu) {
                const dropdown = ribbonMenu.querySelector(".ribbon-dropdown");
                if (dropdown && dropdown.style.display !== "block") {
                    const ribbonContainer = ribbonMenu.parentElement;
                    if (ribbonContainer) {
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

            const el = getTargetButton(e.target);
            if (el && el === pressedEl) {
                el.classList.add("pressed");
            }

            // ツールチップ表示処理
            const tooltipTarget = e.target.closest("[data-tooltip]");
            if (tooltipTarget) {
                const text = tooltipTarget.getAttribute("data-tooltip");
                if (text) {
                    clearTimeout(tooltipTimer);
                    currentClientX = e.clientX;
                    currentClientY = e.clientY;

                    tooltipTimer = setTimeout(() => {
                        if (!tooltipTarget.isConnected) return;

                        tooltip.textContent = text;
                        tooltip.style.visibility = "hidden";
                        tooltip.style.display = "block";

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
                clearTimeout(tooltipTimer);
                tooltip.style.display = "none";
            }
        });

        // マウスアウト時の処理
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

        isBodyListenersRegistered = true;
    }

    // グローバルなマウスアップ処理（一度だけ登録）
    if (!isGlobalMouseUpRegistered) {
        document.addEventListener("mouseup", () => {
            if (pressedEl) {
                pressedEl.classList.remove("pressed");
                pressedEl = null;
            }
        });
        isGlobalMouseUpRegistered = true;
    }

    // スタートメニューの表示状態に応じたスタートボタンの見た目制御
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