// ribbon.js
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

            entry.el.classList.toggle("pointer_none", !!isDisabled);
        });
    };

    // ui.js のグローバルイベント側から開く直前に呼び出せるよう、要素に紐付け
    menu._refreshStatus = refreshItemsStatus;
}

// ------------------------
// Ribbon アイテム作成
// ------------------------
function addRibbonItem(dropdown, item) {
    const div = createElementWithClass("div", "ribbon-item", item.label);

    // 初回の状態設定
    const isDisabled = typeof item.disabled === "function" ? item.disabled() : item.disabled;
    if (isDisabled) div.classList.add("pointer_none");

    // クリック時の処理（アクション実行とメニュー閉じる処理のみここで担保）
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
    return div;
}