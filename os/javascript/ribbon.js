// ribbon.js
import { bringToFront } from "./window.js";

export function setupRibbon(win, getCurrentPath, renderCallback, menus) {
    if (!win?._ribbon) return;
    const ribbon = win._ribbon;
    ribbon.innerHTML = "";

    // --- ここから共通メニューの挿入 ---
    const w = win; // 渡されたウィンドウを参照
    const systemMenus = [
        {
            title: "Window",
            items: [
                {
                    label: "最小化",
                    action: () => w.querySelector(".min-btn")?.click(),
                    disabled: () => w.querySelector(".min-btn")?.classList.contains("pointer_none")
                },
                {
                    label: "最大化 / 元のサイズに戻す",
                    action: () => w.querySelector(".max-btn")?.click(),
                    disabled: () => w.querySelector(".max-btn")?.classList.contains("pointer_none") || w.dataset.minimized === "true"
                },
                {
                    label: "閉じる",
                    action: () => w.querySelector(".close-btn")?.click(),
                    disabled: () => w.querySelector(".close-btn")?.classList.contains("pointer_none")
                }
            ]
        }
    ];

    // システムメニューとアプリ固有のメニューを結合
    const finalMenus = [...systemMenus, ...(menus || [])];
    // --- ここまで ---

    finalMenus.forEach(menu => addRibbonMenu(ribbon, menu.title, menu.items));
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

    // アイテムを作成し、後で状態更新するために要素とデータを紐付けて保持
    const itemEntries = items.map(it => {
        const div = addRibbonItem(dropdown, it);
        return { el: div, data: it };
    });

    menu.appendChild(dropdown);
    ribbon.appendChild(menu);

    // 状態を最新に更新する関数
    const refreshItemsStatus = () => {
        itemEntries.forEach(entry => {
            const isDisabled = typeof entry.data.disabled === "function"
                ? entry.data.disabled()
                : entry.data.disabled;

            if (isDisabled) {
                entry.el.classList.add("pointer_none");
            } else {
                entry.el.classList.remove("pointer_none");
            }
        });
    };

    // ------------------------
    // mousedown で開く（押した瞬間に開く）
    // ------------------------
    menu.addEventListener("mousedown", e => {
        e.stopPropagation();

        const win = ribbon.closest(".window");
        if (win) bringToFront(win);

        // 全ウィンドウのドロップダウンを閉じ、selected も解除
        closeAllRibbonDropdownsAndSelectedGlobal();

        // ★追加: 開く直前に disabled 状態を判定して反映
        refreshItemsStatus();

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

            // ★追加: 切り替わる直前に disabled 状態を判定して反映
            refreshItemsStatus();

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

    // 初回の状態設定
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
    return div; // 要素を返して refreshItemsStatus で使えるようにする
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