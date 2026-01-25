// context-menu.js
let currentMenu = null;

export function attachContextMenu(target, getMenuItems) {
    target.addEventListener("contextmenu", e => {
        e.preventDefault();
        const items = getMenuItems(e); // ← イベントを渡す
        if (!items || !items.length) return;
        showContextMenu(e.clientX, e.clientY, items);
    });
}

export function showContextMenu(x, y, items) {
    hideContextMenu();

    const menu = document.createElement("div");
    menu.className = "context-menu";
    Object.assign(menu.style, {
        position: "fixed",
        left: x + "px",
        top: y + "px",
        color: "black",
        background: "#C3C7CB",
        border: "1px solid",
        borderColor: "#fff #404040 #404040 #fff",
        zIndex: 9999,
        minWidth: "120px",
        fontSize: "13px",
        userSelect: "none"
    });

    items.forEach(item => {
        const row = document.createElement("div");
        row.textContent = item.label;
        row.style.padding = "4px 12px";
        row.style.cursor = item.disabled ? "default" : "pointer";
        row.style.opacity = item.disabled ? "0.5" : "1";

        row.addEventListener("click", () => {
            if (!item.disabled) {
                item.action?.();
                hideContextMenu();
            }
        });

        row.addEventListener("mouseenter", () => {
            if (!item.disabled) {
                row.style.background = "#000080"; // 背景色
                row.style.color = "#ffffff";      // テキスト色を白に
            }
        });
        row.addEventListener("mouseleave", () => {
            row.style.background = "transparent"; // 背景色元に戻す
            row.style.color = "black";            // テキスト色元に戻す
        });

        menu.appendChild(row);
    });

    document.body.appendChild(menu);
    currentMenu = menu;

    // ===== 画面端補正 =====
    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (rect.right > viewportWidth) menu.style.left = Math.max(0, viewportWidth - rect.width) + "px";
    if (rect.bottom > viewportHeight) menu.style.top = Math.max(0, viewportHeight - rect.height) + "px";
}

// メニューを消す
export function hideContextMenu() {
    if (currentMenu) {
        currentMenu.remove();
        currentMenu = null;
    }
}

// クリック・スクロール・ESCで閉じる
document.addEventListener("mousedown", e => {
    if (!currentMenu) return;
    // もしクリック対象がメニューの中なら閉じない
    if (!currentMenu.contains(e.target)) {
        hideContextMenu();
    }
});

document.addEventListener("scroll", hideContextMenu);
document.addEventListener("keydown", e => { if (e.key === "Escape") hideContextMenu(); });