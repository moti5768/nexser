// desktop.js
import { FS } from "./fs.js";
import { launch } from "./kernel.js";
import { alertWindow } from "./window.js";
import { resolveFS, validateName } from "./fs-utils.js";
import { addRecent } from "./recent.js";
import { attachContextMenu } from "./context-menu.js";
import { resolveAppByPath, getIcon } from "./file-associations.js";
import { openWithDialog as explorerOpenWithDialog, hasExtension } from "./apps/explorer.js";

// 選択状態管理
let globalSelected = { item: null, window: null };

// --------------------
// デスクトップ描画
// --------------------
export function buildDesktop() {
    globalSelected = { item: null, window: null };
    const desktop = document.getElementById("desktop");
    if (!desktop) return;

    let iconsContainer = document.getElementById("desktop-icons");
    if (!iconsContainer) {
        iconsContainer = document.createElement("div");
        iconsContainer.id = "desktop-icons";
        desktop.appendChild(iconsContainer);
    }
    iconsContainer.innerHTML = ""; // 初期化

    function createIcon(name, node) {
        const item = document.createElement("div");
        item.className = "icon";
        item.dataset.name = name;

        // 上記の関数、または同様のロジックでアイコンを決定
        const iconChar = getIcon(name, node);

        const iconGraphic = document.createElement("div");
        iconGraphic.className = "icon-graphic";
        iconGraphic.textContent = iconChar;

        const iconLabel = document.createElement("div");
        iconLabel.className = "icon-label";
        iconLabel.textContent = name;

        item.appendChild(iconGraphic);
        item.appendChild(iconLabel);

        iconsContainer.appendChild(item);

        const fullPath = `Desktop/${name}`;

        // 選択
        item.addEventListener("click", e => {
            e.stopPropagation();
            if (globalSelected.item) globalSelected.item.classList.remove("selected");
            item.classList.add("selected");
            globalSelected.item = item;
            globalSelected.window = desktop;
        });

        // ダブルクリックで開く
        item.addEventListener("dblclick", () => openFSItem(name, node, "Desktop"));

        // 右クリックメニュー（アイコン個別）
        attachContextMenu(item, () => {
            const isFolder = node?.type === "folder";
            return [
                {
                    label: "削除",
                    action: () => deleteFSItem("Desktop", name)
                },
                {
                    label: "プログラムから開く",
                    // ⭐ 対策: type が "file" の場合のみ実行を許可する
                    action: () => {
                        if (node.type === "file") {
                            explorerOpenWithDialog(fullPath, node);
                        } else {
                            // ファイル以外（folder, app, link）を無理やり開こうとした場合
                            alertWindow("システムエラー防止のため、この項目はアプリで開くことができません。", { width: 350, height: 120 });
                        }
                    },
                    // UI上のヒントとして、ファイル以外ではメニューを半透明/無効に見せる（実装依存）
                    disabled: () => node.type !== "file"
                },
            ];
        });
    }

    // デスクトップ直下のアイコンを生成
    for (const name in FS.Desktop) {
        if (name === "type") continue;
        createIcon(name, FS.Desktop[name]);
    }

    // --------------------
    // デスクトップ空白部分右クリック
    // --------------------
    attachContextMenu(desktop, (e) => {
        if (e.target.closest(".window")) return [];
        const desktopNode = resolveFS("Desktop");
        if (!desktopNode) return [];

        const items = [];

        if (globalSelected.item) {
            const name = globalSelected.item.dataset.name;
            const node = desktopNode[name];
            if (node) {
                items.push({
                    label: "開く",
                    action: () => openFSItem(name, node, "Desktop")
                });
            }
        }

        // 新規フォルダ
        items.push({
            label: "新規フォルダ/ファイル作成",
            action: () => createNewFolder("Desktop", iconsContainer)
        });

        // 選択アイテム削除
        items.push({
            label: "選択アイテムを削除",
            disabled: !globalSelected.item,
            action: () => {
                if (globalSelected.item) {
                    const name = globalSelected.item.dataset.name;
                    deleteFSItem("Desktop", name);
                    globalSelected.item = null;
                }
            }
        });

        // 選択アイテムがあれば「プログラムから開く」
        if (globalSelected.item) {
            const name = globalSelected.item.dataset.name;
            const node = desktopNode[name];
            const isFolder = node?.type === "folder";
            items.push({
                label: "プログラムから開く",
                disabled: node.type !== "file",
                action: () => {
                    if (node.type === "file") {
                        explorerOpenWithDialog(`Desktop/${name}`, node);
                    } else {
                        alertWindow("ファイル以外はアプリで開けません。", { width: 300, height: 120 });
                    }
                }
            });
        }

        return items;
    });

    desktop.addEventListener("click", (e) => {
        desktop.focus();
        // クリックされた要素がアイコン自体（またはその子要素）でないか確認
        if (!e.target.closest(".icon")) {
            if (globalSelected.item) {
                globalSelected.item.classList.remove("selected");
                globalSelected.item = null;
                globalSelected.window = null;
            }
        }
    });
    requestAnimationFrame(() => {
        adjustDesktopIconArea();
    });
    window.dispatchEvent(new Event("desktop-ready"));
}

// タスクバー高さに応じてアイコン領域を調整
function adjustDesktopIconArea() {
    const desktop = document.getElementById("desktop");
    const iconsContainer = document.getElementById("desktop-icons");
    const taskbar = document.getElementById("taskbar");
    if (!desktop || !iconsContainer || !taskbar) return;

    const taskbarHeight = taskbar.offsetHeight;

    iconsContainer.style.position = "absolute";
    iconsContainer.style.top = "0";
    iconsContainer.style.left = "0";
    iconsContainer.style.right = "0";
    iconsContainer.style.bottom = `${taskbarHeight}px`; // タスクバー分の余白
    iconsContainer.style.display = "flex";
    iconsContainer.style.flexWrap = "wrap";
    iconsContainer.style.alignContent = "flex-start";
    iconsContainer.style.padding = "10px"; // 内側余白
    iconsContainer.style.overflow = "auto";
}

// --------------------
// 新規フォルダ/ファイル作成
// --------------------
function createNewFolder(currentPath, container) {
    const folderNode = resolveFS(currentPath);
    if (!folderNode || !container) return;

    // 二重作成防止（フラグ管理）
    if (createNewFolder.isCreating) return;
    createNewFolder.isCreating = true;

    // 初期表示名
    let defaultName = "新しいフォルダ";
    let counter = 1;
    while (folderNode[defaultName]) {
        defaultName = `新しいフォルダ (${counter++})`;
    }

    const iconDiv = document.createElement("div");
    iconDiv.className = "icon";
    container.appendChild(iconDiv);

    const input = document.createElement("input");
    input.type = "text";
    input.value = defaultName;
    input.style.cssText = "font-size:13px; text-align:left; width:auto; min-width:100px; z-index:10;";
    iconDiv.appendChild(input);

    input.focus();
    input.select();

    // 幅を文字数に応じて自動調整
    const adjustWidth = () => {
        input.style.width = `${Math.max(input.value.length * 8, 100)}px`;
    };
    adjustWidth();
    input.addEventListener("input", adjustWidth);

    let isShowingError = false;
    let isCommitting = false;

    const finishEditing = () => {
        if (isShowingError || isCommitting) return;
        isCommitting = true;

        let newName = input.value.trim() || defaultName;

        // 1. バリデーション (fs-utils.js)
        const error = validateName(newName);
        if (error) {
            isCommitting = false;
            isShowingError = true;
            alertWindow(error, { width: 360, height: 160, taskbar: false });
            setTimeout(() => {
                isShowingError = false;
                input.focus();
                input.select();
            }, 0);
            return;
        }

        // 2. 名前の重複回避
        let finalName = newName;
        let idx = 1;
        while (folderNode[finalName]) {
            finalName = `${newName} (${idx++})`;
        }

        // --- Explorer.js の起動ロジックを適用 ---
        // 3. 拡張子による型判定
        // インポート済みの hasExtension を使用して判定を共通化
        const fileExt = hasExtension(finalName)
            ? "." + finalName.split('.').pop().toLowerCase()
            : null;

        if (fileExt === ".app") {
            folderNode[finalName] = { type: "app", entry: "" };
        } else if (fileExt) {
            folderNode[finalName] = { type: "file", content: "" };
        } else {
            folderNode[finalName] = { type: "folder" };
        }
        // ---------------------------------------

        // 4. UI更新
        iconDiv.remove();
        createNewFolder.isCreating = false; // フラグ解除
        buildDesktop();
        window.dispatchEvent(new Event("fs-updated"));
    };

    input.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            e.preventDefault();
            finishEditing();
        } else if (e.key === "Escape") {
            isCommitting = true;
            iconDiv.remove();
            createNewFolder.isCreating = false;
        }
    });

    input.addEventListener("blur", () => {
        if (isShowingError || isCommitting) return;
        // デスクトップ版の挙動に合わせてキャンセル
        iconDiv.remove();
        createNewFolder.isCreating = false;
    });
}

// --------------------
// アイテム削除
// --------------------
function deleteFSItem(parentPath, name) {
    const node = resolveFS(parentPath);
    if (!node || !node[name]) return;
    delete node[name];
    buildDesktop();
    window.dispatchEvent(new Event("fs-updated"));
}

// 修正後の openFSItem
function openFSItem(name, node, parentPath) {
    let targetNode = node;
    let targetPath = `${parentPath}/${name}`;

    // 1. ショートカットの解決 (Windowsは常にリンク先を追う)
    if (targetNode.type === "link") {
        targetPath = targetNode.target;
        targetNode = resolveFS(targetPath);
        if (!targetNode) {
            alertWindow("リンク先が見つかりません。");
            return;
        }
    }

    // 2. 実行タイプの特定
    const type = targetNode.type;
    const associatedApp = resolveAppByPath(targetPath);

    // 3. アプリケーションの実行
    if (type === "app") {
        launch(targetPath, { path: targetPath, uniqueKey: targetPath });
        addRecent({ type: "app", path: targetPath });
    }
    // 4. フォルダの展開
    else if (type === "folder") {
        // Windowsは常に共通のエクスプローラーを起動
        launch("Programs/Applications/Explorer.app", {
            path: targetPath,
            uniqueKey: targetPath,
            showFullPath: true // Windowsらしくパスを表示
        });
        addRecent({ type: "folder", path: targetPath });
    }
    // 5. ファイルの実行
    else if (type === "file") {
        if (associatedApp) {
            // 関連付けがあればそのアプリで起動
            launch(associatedApp, { path: targetPath, node: targetNode, uniqueKey: targetPath });
        } else {
            // ⭐ 簡易ビューアではなく、Explorerと同じ「アプリ選択ダイアログ」を出す
            explorerOpenWithDialog(targetPath, targetNode);
        }
        addRecent({ type: "file", path: targetPath });
    }
}


// --------------------
// FS更新監視
// --------------------
let desktopInitialized = false;
function installDesktopWatcher() {
    if (desktopInitialized) return;
    desktopInitialized = true;
    window.addEventListener("fs-updated", () => buildDesktop());
}
installDesktopWatcher();

// --------------------
// キーボードナビゲーションの実装
// --------------------
let isDesktopKeyHandlerAttached = false;

function setupDesktopKeyboardNavigation() {
    if (isDesktopKeyHandlerAttached) return;

    document.addEventListener("keydown", (e) => {
        // --- ガード処理：デスクトップがアクティブか判定 ---
        const active = document.activeElement;

        // 1. 入力欄（リネーム中など）にフォーカスがある場合は即座に終了
        if (active.tagName === "INPUT" || active.tagName === "TEXTAREA") return;

        // 2. ウィンドウ（アプリ）内の要素にフォーカスがある場合は無視
        if (active.closest(".window")) return;

        // 3. デスクトップ要素の存在確認
        const desktop = document.getElementById("desktop");
        const iconsContainer = document.getElementById("desktop-icons");
        if (!desktop || !iconsContainer) return;

        // 4. デスクトップまたはbody（どこも選んでいない状態）以外がアクティブなら無視
        // buildDesktop内で desktop.tabIndex = 0 を設定し、クリック時に .focus() させるのが前提
        const isDesktopFocused = (active === desktop || active === document.body);
        if (!isDesktopFocused) return;

        // --- 移動ロジック開始 ---
        const icons = Array.from(iconsContainer.querySelectorAll(".icon"));
        if (icons.length === 0) return;

        let currentIndex = icons.findIndex(el => el.classList.contains("selected"));

        const selectIcon = (targetEl) => {
            if (!targetEl) return;
            // 全選択解除
            icons.forEach(el => el.classList.remove("selected"));
            // 新規選択
            targetEl.classList.add("selected");
            globalSelected.item = targetEl;
            globalSelected.window = desktop;
            // 視界に入るようスクロール
            targetEl.scrollIntoView({ block: "nearest", inline: "nearest" });
        };

        // 物理的な距離で最適なアイコンを探す（ご提示のロジックを完全維持）
        const getNearestIcon = (currentEl, direction) => {
            const currentRect = currentEl.getBoundingClientRect();
            const currentCenterX = currentRect.left + currentRect.width / 2;
            const currentCenterY = currentRect.top + currentRect.height / 2;

            let bestMatch = null;
            let minDistance = Infinity;

            icons.forEach(target => {
                if (target === currentEl) return;
                const targetRect = target.getBoundingClientRect();
                const targetCenterX = targetRect.left + targetRect.width / 2;
                const targetCenterY = targetRect.top + targetRect.height / 2;

                let isProperDirection = false;
                if (direction === "ArrowDown") isProperDirection = targetRect.top >= currentRect.bottom - 5;
                if (direction === "ArrowUp") isProperDirection = targetRect.bottom <= currentRect.top + 5;

                if (isProperDirection) {
                    const dist = Math.pow(targetCenterX - currentCenterX, 2) + Math.pow(targetCenterY - currentCenterY, 2);
                    if (dist < minDistance) {
                        minDistance = dist;
                        bestMatch = target;
                    }
                }
            });
            return bestMatch;
        };

        // キー分岐
        switch (e.key) {
            case "ArrowRight":
                e.preventDefault();
                selectIcon(icons[currentIndex === -1 ? 0 : (currentIndex + 1) % icons.length]);
                break;
            case "ArrowLeft":
                e.preventDefault();
                selectIcon(icons[currentIndex === -1 ? 0 : (currentIndex - 1 + icons.length) % icons.length]);
                break;
            case "ArrowDown":
                e.preventDefault();
                if (currentIndex === -1) {
                    selectIcon(icons[0]);
                } else {
                    const next = getNearestIcon(icons[currentIndex], "ArrowDown");
                    if (next) selectIcon(next);
                }
                break;
            case "ArrowUp":
                e.preventDefault();
                if (currentIndex === -1) {
                    selectIcon(icons[icons.length - 1]);
                } else {
                    const prev = getNearestIcon(icons[currentIndex], "ArrowUp");
                    if (prev) selectIcon(prev);
                }
                break;
            case "Enter":
                if (globalSelected.item) {
                    e.preventDefault();
                    const name = globalSelected.item.dataset.name;
                    const desktopNode = resolveFS("Desktop");
                    const node = desktopNode ? desktopNode[name] : null;
                    if (node) openFSItem(name, node, "Desktop");
                }
                break;
        }
    });

    isDesktopKeyHandlerAttached = true;
}

// 最後に実行
setupDesktopKeyboardNavigation();

// タスクバーの高さが変わったらアイコン領域を再調整
window.addEventListener("desktop-resize", adjustDesktopIconArea);
