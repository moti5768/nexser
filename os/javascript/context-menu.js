// context-menu.js
let currentMenu = null;

/**
 * ターゲット要素にコンテキストメニュー機能を付与
 * @param {HTMLElement} target 
 * @param {Function} getMenuItems (e) => [{label, action, disabled}]
 */
export function attachContextMenu(target, getMenuItems) {
    target.addEventListener("contextmenu", e => {
        e.preventDefault();
        const items = getMenuItems(e); // 元のコード通り、イベントを引数に渡す
        if (!items || !items.length) return;
        showContextMenu(e.clientX, e.clientY, items);
    });
}

/**
 * メニューを表示する
 */
export function showContextMenu(x, y, items) {
    hideContextMenu();

    const menu = document.createElement("div");
    menu.className = "context-menu";

    // スタイル指定（元のカラーコードとクラシックなボーダーを維持）
    Object.assign(menu.style, {
        position: "fixed",
        left: x + "px",
        top: y + "px",
        color: "black",
        background: "#C3C7CB",
        border: "1px solid",
        borderColor: "#fff #404040 #404040 #fff", // クラシックな3D立体ボーダー
        zIndex: 9999,
        minWidth: "120px",
        fontSize: "13px",
        userSelect: "none",
        padding: "2px"
    });

    items.forEach(item => {
        // 区切り線（セパレーター）の隠し機能を追加（互換性は維持）
        if (item.label === "---") {
            const separator = document.createElement("div");
            Object.assign(separator.style, {
                height: "1px",
                borderTop: "1px solid #808080",
                borderBottom: "1px solid #fff",
                margin: "4px 2px"
            });
            menu.appendChild(separator);
            return;
        }

        const row = document.createElement("div");
        row.textContent = item.label;
        row.style.padding = "4px 12px";
        row.style.cursor = item.disabled ? "default" : "pointer";
        row.style.opacity = item.disabled ? "0.5" : "1";

        // クリックイベント
        row.addEventListener("click", (e) => {
            e.stopPropagation(); // メニュー自体へのクリックイベント伝播を防ぐ
            if (!item.disabled) {
                item.action?.();
                hideContextMenu();
            }
        });

        // ホバーエフェクト（元の紺色ハイライトを維持）
        row.addEventListener("mouseenter", () => {
            if (!item.disabled) {
                row.style.background = "#000080"; // Windows Classic Navy
                row.style.color = "#ffffff";
            }
        });
        row.addEventListener("mouseleave", () => {
            row.style.background = "transparent";
            row.style.color = "black";
        });

        menu.appendChild(row);
    });

    document.body.appendChild(menu);
    currentMenu = menu;

    // ===== 画面端補正（元の賢いロジックを維持） =====
    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // 右側にはみ出す場合は左へ寄せる
    if (rect.right > viewportWidth) {
        menu.style.left = Math.max(0, viewportWidth - rect.width) + "px";
    }
    // 下側にはみ出す場合は上へ寄せる
    if (rect.bottom > viewportHeight) {
        menu.style.top = Math.max(0, viewportHeight - rect.height) + "px";
    }
}

/**
 * メニューを消去
 */
export function hideContextMenu() {
    if (currentMenu) {
        currentMenu.remove();
        currentMenu = null;
    }
}

// ===== グローバル制御リスナー（元の構想を維持） =====

// メニューの外をクリックしたら閉じる
document.addEventListener("mousedown", e => {
    if (!currentMenu) return;
    if (!currentMenu.contains(e.target)) {
        hideContextMenu();
    }
});

// スクロールしたら閉じる
document.addEventListener("scroll", hideContextMenu, { passive: true });

// Escapeキーで閉じる
document.addEventListener("keydown", e => {
    if (e.key === "Escape") hideContextMenu();
});