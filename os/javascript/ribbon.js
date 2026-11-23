// ribbon.js
export function setupRibbon(win, getCurrentPath, renderCallback, menus) {
    if (!win?._ribbon) return;
    const ribbon = win._ribbon;

    // ★ 再構築時でも MDI 最大化用の左端アイコンと右上操作ボタンを消失させないよう退避
    const existingMergedIcon = ribbon.querySelector(":scope > .mdi-merged-icon");
    const existingMergedControls = ribbon.querySelector(":scope > .mdi-merged-controls");

    ribbon.innerHTML = "";
    ribbon.classList.add("ribbon-bar");

    if (existingMergedIcon) {
        ribbon.appendChild(existingMergedIcon);
    }
    if (existingMergedControls) {
        ribbon.appendChild(existingMergedControls);
    }

    const w = win;
    const getParentBtn = (selector) => w.querySelector(`:scope > .title-bar ${selector}`);

    const systemMenus = [
        {
            title: "Window",
            items: [
                {
                    label: "最小化",
                    action: () => getParentBtn(".min-btn")?.click(),
                    disabled: () => getParentBtn(".min-btn")?.classList.contains("pointer_none")
                },
                {
                    label: "最大化 / 元のサイズに戻す",
                    action: () => getParentBtn(".max-btn")?.click(),
                    disabled: () => getParentBtn(".max-btn")?.classList.contains("pointer_none") || w.dataset.minimized === "true"
                },
                {
                    label: "閉じる",
                    action: () => getParentBtn(".close-btn")?.click(),
                    disabled: () => getParentBtn(".close-btn")?.classList.contains("pointer_none")
                }
            ],
            // ★ MDI親ウィンドウの場合のみ、メニュー展開時に整列コマンドと開いている子ウィンドウ一覧を動的追加
            dynamicItems: () => {
                const mdi = w._mdiController;
                if (!mdi) return [];

                const children = mdi.getChildren();
                const activeChild = mdi.getActiveChild();
                const hasRestorable = children.some(c => !c.minimized);
                const hasMinimized = children.some(c => c.minimized);

                const mdiMenuItems = [
                    { label: "---" },
                    {
                        label: "重ねて表示",
                        action: () => mdi.cascade(),
                        disabled: !hasRestorable
                    },
                    {
                        label: "上下に並べて表示",
                        action: () => mdi.tileHorizontal(),
                        disabled: !hasRestorable
                    },
                    {
                        label: "左右に並べて表示",
                        action: () => mdi.tileVertical(),
                        disabled: !hasRestorable
                    },
                    {
                        label: "アイコンの整列",
                        action: () => mdi.arrangeIcons(),
                        disabled: !hasMinimized
                    },
                    {
                        label: "すべて閉じる",
                        action: () => mdi.closeAll(false),
                        disabled: children.length === 0
                    }
                ];

                if (children.length > 0) {
                    mdiMenuItems.push({ label: "---" });
                    children.forEach((child, idx) => {
                        mdiMenuItems.push({
                            label: `${idx + 1} ${child.title}`,
                            checked: Boolean(activeChild && activeChild === child.el),
                            action: () => mdi.activateChild(child.el)
                        });
                    });
                }

                return mdiMenuItems;
            }
        }
    ];
    const finalMenus = [...systemMenus, ...(menus || [])];
    finalMenus.forEach(menu => addRibbonMenu(ribbon, menu.title, menu.items, menu.dynamicItems));
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
            if (submenu.isConnected) {
                submenu.style.display = "none";
            }
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
function addRibbonMenu(ribbon, title, items, dynamicItems = null) {
    const menu = createElementWithClass("div", "ribbon-menu");
    const span = createElementWithClass("span", "ribbon-title", title);
    menu.appendChild(span);

    const dropdown = createElementWithClass("div", "ribbon-dropdown");
    const refreshers = [];

    (items || []).forEach(it => {
        addRibbonItem(dropdown, it, refreshers);
    });

    let dynamicContainer = null;
    if (typeof dynamicItems === "function") {
        dynamicContainer = createElementWithClass("div", "ribbon-dynamic-group");
        dropdown.appendChild(dynamicContainer);
    }

    menu.appendChild(dropdown);

    // ★ 右上の MDI 結合コントロールが存在する場合は必ずその手前に挿入してレイアウトを守る
    const mergedControls = ribbon.querySelector(":scope > .mdi-merged-controls");
    if (mergedControls) {
        ribbon.insertBefore(menu, mergedControls);
    } else {
        ribbon.appendChild(menu);
    }

    menu._refreshStatus = () => {
        refreshers.forEach(fn => fn());

        if (dynamicContainer && typeof dynamicItems === "function") {
            dynamicContainer.innerHTML = "";
            const dynList = dynamicItems() || [];
            const dynamicRefreshers = [];
            dynList.forEach(it => {
                addRibbonItem(dynamicContainer, it, dynamicRefreshers);
            });
            dynamicRefreshers.forEach(fn => fn());
        }

        dropdown.querySelectorAll(".ribbon-submenu").forEach(sub => {
            sub.style.display = "none";
        });
    };

    // ★ 外部の開閉処理が _refreshStatus を呼ばないケースでも確実に最新一覧へ同期する
    menu.addEventListener("mousedown", (e) => {
        if (e.target.closest(".ribbon-dropdown")) return;
        menu._refreshStatus();
    });
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

    const labelWrap = document.createElement("span");
    labelWrap.className = "ribbon-item-label-wrap";
    Object.assign(labelWrap.style, {
        display: "inline-flex",
        alignItems: "center",
        minWidth: "0"
    });

    let checkSpan = null;
    if (item.checked !== undefined) {
        checkSpan = document.createElement("span");
        checkSpan.className = "ribbon-check";
        labelWrap.appendChild(checkSpan);
    }

    const labelSpan = document.createElement("span");
    labelSpan.textContent = item.label;
    labelWrap.appendChild(labelSpan);
    div.appendChild(labelWrap);

    const subItems = Array.isArray(item.items) ? item.items : (Array.isArray(item.children) ? item.children : null);

    const updateStatus = () => {
        const isDisabled = typeof item.disabled === "function" ? item.disabled() : item.disabled;
        div.classList.toggle("pointer_none", !!isDisabled);
        if (checkSpan) {
            const isChecked = typeof item.checked === "function" ? item.checked() : item.checked;
            checkSpan.textContent = isChecked ? "✓" : "";
        }
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
            const sysState = window.nexser?.kernelAPI?.getSystemState?.();
            if (sysState && (sysState.isSystemDead || sysState.isLoggingOff || !sysState.isGuiActive)) {
                return;
            }
            if (!div.classList.contains("pointer_none")) {
                try {
                    if (typeof item.action === "function") item.action();
                } catch (err) {
                    console.error("[Ribbon] Menu action failed:", err);
                } finally {
                    const rootDropdown = div.closest(".ribbon-menu")?.querySelector(".ribbon-dropdown");
                    if (rootDropdown) {
                        rootDropdown.querySelectorAll(".ribbon-submenu").forEach(s => { s.style.display = "none"; });
                        rootDropdown.style.display = "none";
                    }
                    const parentMenu = div.closest(".ribbon-menu");
                    if (parentMenu) parentMenu.classList.remove("selected");
                }
            }
        });
    }

    container.appendChild(div);
    return div;
}