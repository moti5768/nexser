// ribbon.js
import { bringToFront } from "./window.js";

export function setupRibbon(win, getCurrentPath, renderCallback, menus) {
    if (!win?._ribbon) return;
    const ribbon = win._ribbon;
    ribbon.innerHTML = "";

    (menus || []).forEach(menu => addRibbonMenu(ribbon, menu.title, menu.items));
}

// ------------------------
// DOM 作成ヘルパー
// ------------------------
function createElementWithClass(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
}

// ------------------------
// Ribbon メニュー作成
// ------------------------
function addRibbonMenu(ribbon, title, items) {
    const menu = createElementWithClass("div", "ribbon-menu");
    const span = createElementWithClass("span", "ribbon-title", title);
    menu.appendChild(span);

    const dropdown = createElementWithClass("div", "ribbon-dropdown");
    items.forEach(it => addRibbonItem(dropdown, it));
    menu.appendChild(dropdown);
    ribbon.appendChild(menu);

    // ------------------------
    // mousedown で開く（押した瞬間に開く）
    // ------------------------
    menu.addEventListener("mousedown", e => {
        e.stopPropagation();

        const win = ribbon.closest(".window");
        if (win) bringToFront(win);

        // 全ウィンドウのドロップダウンを閉じ、selected も解除
        closeAllRibbonDropdownsAndSelectedGlobal();

        // 今回のメニューだけ開く
        dropdown.style.display = "block";

        // 今回の ribbon 内だけ selected を付与
        ribbon.querySelectorAll(".ribbon-menu").forEach(m => m.classList.remove("selected"));
        menu.classList.add("selected");
    });

    // ------------------------
    // ホバーで隣のリボンに移動しても切り替える
    // ------------------------
    menu.addEventListener("mouseenter", () => {
        const anyOpen = Array.from(ribbon.querySelectorAll(".ribbon-dropdown"))
            .some(dd => dd.style.display === "block"); // このウィンドウ内だけ

        if (anyOpen) {
            // 全ウィンドウのドロップダウンを閉じ、selected も解除
            closeAllRibbonDropdownsAndSelectedGlobal();

            // 現在の ribbon 内だけ開く
            dropdown.style.display = "block";
            menu.classList.add("selected");
        }
    });
}

// ------------------------
// Ribbon アイテム作成
// ------------------------
function addRibbonItem(dropdown, item) {
    const div = createElementWithClass("div", "ribbon-item", item.label);

    const isDisabled = typeof item.disabled === "function" ? item.disabled() : item.disabled;
    if (isDisabled) div.classList.add("pointer_none");

    div.addEventListener("mousedown", e => e.stopPropagation());

    div.addEventListener("click", e => {
        e.stopPropagation();
        if (!div.classList.contains("pointer_none")) {
            item.action();

            const parentDropdown = div.closest(".ribbon-dropdown");
            if (parentDropdown) parentDropdown.style.display = "none";

            const parentMenu = div.closest(".ribbon-menu");
            if (parentMenu) parentMenu.classList.remove("selected");
        }
    });

    dropdown.appendChild(div);
}

// ------------------------
// 全ウィンドウのドロップダウンと selected を閉じる
// ------------------------
function closeAllRibbonDropdownsAndSelectedGlobal() {
    document.querySelectorAll(".ribbon-dropdown").forEach(dd => dd.style.display = "none");
    document.querySelectorAll(".ribbon-menu").forEach(m => m.classList.remove("selected"));
}

// ------------------------
// 外側クリックで全て閉じる（グローバル）
// ------------------------
document.addEventListener("mousedown", e => {
    const isInsideRibbon = e.target.closest(".ribbon-menu")
        || e.target.closest(".ribbon-dropdown")
        || e.target.closest(".ribbon-item");

    if (!isInsideRibbon) {
        closeAllRibbonDropdownsAndSelectedGlobal();
    }
});