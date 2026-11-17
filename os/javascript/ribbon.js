// ribbon.js
export function setupRibbon(win, getCurrentPath, renderCallback, menus) {
    if (!win?._ribbon) return;
    const ribbon = win._ribbon;
    ribbon.innerHTML = "";
    const w = win;
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
    const finalMenus = [...systemMenus, ...(menus || [])];
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
// サブメニューホバー展開制御
// ------------------------
function setupSubmenuHover(parentItem, submenu) {
    let hideTimer = null;

    const show = () => {
        clearTimeout(hideTimer);
        if (parentItem.classList.contains("pointer_none")) return;

        const siblingContainer = parentItem.parentElement;
        if (siblingContainer) {
            siblingContainer.querySelectorAll(":scope > .ribbon-item > .ribbon-submenu").forEach(el => {
                if (el !== submenu) el.style.display = "none";
            });
        }

        submenu.style.display = "block";
        submenu.style.left = "100%";
        submenu.style.top = "-2px";

        const rect = submenu.getBoundingClientRect();
        const parentRect = parentItem.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        if (rect.right > vw) {
            submenu.style.left = `-${rect.width}px`;
            if (submenu.getBoundingClientRect().left < 0) {
                submenu.style.left = `-${parentRect.left}px`;
            }
        }
        if (rect.bottom > vh) {
            const overflow = rect.bottom - vh;
            const offset = Math.min(overflow + 8, parentRect.top);
            submenu.style.top = `-${offset}px`;
        }
    };

    const scheduleHide = () => {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
            submenu.style.display = "none";
        }, 180);
    };

    const isInside = (el) => el && (parentItem.contains(el) || submenu.contains(el));
    parentItem.addEventListener("mouseenter", show);
    submenu.addEventListener("mouseenter", show);
    parentItem.addEventListener("mouseleave", (e) => {
        if (!isInside(e.relatedTarget)) scheduleHide();
    });
    submenu.addEventListener("mouseleave", (e) => {
        if (!isInside(e.relatedTarget)) scheduleHide();
    });
}

// ------------------------
// Ribbon メニュー作成
// ------------------------
function addRibbonMenu(ribbon, title, items) {
    const menu = createElementWithClass("div", "ribbon-menu");
    const span = createElementWithClass("span", "ribbon-title", title);
    menu.appendChild(span);

    const dropdown = createElementWithClass("div", "ribbon-dropdown");
    const refreshers = [];

    (items || []).forEach(it => {
        addRibbonItem(dropdown, it, refreshers);
    });

    menu.appendChild(dropdown);
    ribbon.appendChild(menu);

    menu._refreshStatus = () => {
        refreshers.forEach(fn => fn());
        dropdown.querySelectorAll(".ribbon-submenu").forEach(sub => {
            sub.style.display = "none";
        });
    };
}

// ------------------------
// Ribbon アイテム作成（多階層サブメニュー対応）
// ------------------------
function addRibbonItem(container, item, refreshers = []) {
    if (item.label === "---") {
        const separator = createElementWithClass("div", "ribbon-separator");
        Object.assign(separator.style, {
            height: "1px",
            borderTop: "1px solid #808080",
            borderBottom: "1px solid #fff",
            margin: "4px 2px"
        });
        container.appendChild(separator);
        return separator;
    }

    const div = createElementWithClass("div", "ribbon-item");
    Object.assign(div.style, {
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px"
    });

    const labelSpan = document.createElement("span");
    labelSpan.textContent = item.label;
    div.appendChild(labelSpan);

    const subItems = Array.isArray(item.items) ? item.items : (Array.isArray(item.children) ? item.children : null);

    const updateStatus = () => {
        const isDisabled = typeof item.disabled === "function" ? item.disabled() : item.disabled;
        div.classList.toggle("pointer_none", !!isDisabled);
    };
    updateStatus();
    refreshers.push(updateStatus);

    if (subItems && subItems.length > 0) {
        div.classList.add("has-children");
        const arrow = document.createElement("span");
        arrow.textContent = "▶";
        arrow.style.fontSize = "9px";
        arrow.style.opacity = "0.85";
        div.appendChild(arrow);

        const submenu = createElementWithClass("div", "ribbon-dropdown ribbon-submenu");
        Object.assign(submenu.style, {
            display: "none",
            position: "absolute",
            top: "-2px",
            left: "100%",
            minWidth: "185px",
            zIndex: "1000"
        });

        subItems.forEach(subIt => addRibbonItem(submenu, subIt, refreshers));
        div.appendChild(submenu);
        setupSubmenuHover(div, submenu);

        div.addEventListener("click", (e) => {
            e.stopPropagation();
            if (!div.classList.contains("pointer_none")) {
                submenu.style.display = submenu.style.display === "block" ? "none" : "block";
            }
        });
    } else {
        div.addEventListener("click", e => {
            e.stopPropagation();
            if (!div.classList.contains("pointer_none")) {
                if (typeof item.action === "function") item.action();

                const rootDropdown = div.closest(".ribbon-menu")?.querySelector(".ribbon-dropdown");
                if (rootDropdown) {
                    rootDropdown.querySelectorAll(".ribbon-submenu").forEach(s => { s.style.display = "none"; });
                    rootDropdown.style.display = "none";
                }
                const parentMenu = div.closest(".ribbon-menu");
                if (parentMenu) parentMenu.classList.remove("selected");
            }
        });
    }

    container.appendChild(div);
    return div;
}