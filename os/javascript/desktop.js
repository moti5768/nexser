// desktop.js
import { FS, forceSave, markDefaultDeleted, setBulkUpdating } from "./fs.js";
import { launch } from "./kernel.js";
import { alertWindow, progressWindow } from "./window.js";
import { resolveFS, validateName, importFileSmart, getUniqueName } from "./fs-utils.js";
import { addRecent } from "./recent.js";
import { attachContextMenu } from "./context-menu.js";
import { resolveAppByPath, getIcon } from "./file-associations.js";
import { openWithDialog as explorerOpenWithDialog, showProperties } from "./apps/explorer.js";
import { dbGet, dbSet } from "./fs-db.js";

// 選択状態管理 (複数選択・範囲選択対応)
let globalSelected = { items: new Set(), window: null, lastSelected: null };
let autoArrange = true; // 自動整列フラグ
let iconPositions = {}; // ★ 追加: 自動整列OFF時のアイコン座標データ

(async () => {
    try {
        const savedAutoArrange = await dbGet("desktop_autoArrange", "settings");
        if (savedAutoArrange !== undefined) autoArrange = savedAutoArrange;

        const savedPositions = await dbGet("desktop_iconsPositions", "settings");
        if (savedPositions) iconPositions = savedPositions;

        // 読み込み完了後に再描画（既に構築済みの場合は新しい設定で上書き）
        const desktop = document.getElementById("desktop");
        if (desktop) buildDesktop();
    } catch (e) {
        console.warn("デスクトップ設定の読み込みに失敗しました:", e);
    }
})();

// --------------------
// デスクトップ描画
// --------------------
export function buildDesktop() {
    globalSelected = { items: new Set(), window: null, lastSelected: null, item: null };

    const desktop = document.getElementById("desktop");
    if (!desktop) return;

    // ★ 追加：デスクトップ自身がキーボードフォーカスを受け取れるようにする
    desktop.tabIndex = 0;

    let iconsContainer = document.getElementById("desktop-icons");
    if (!iconsContainer) {
        iconsContainer = document.createElement("div");
        iconsContainer.id = "desktop-icons";
        desktop.appendChild(iconsContainer);
    }

    // 🔥 追加：Fragmentでまとめて描画
    const fragment = document.createDocumentFragment();

    function createIcon(name, node) {
        const item = document.createElement("div");
        item.className = "icon";
        item.dataset.name = name;

        const iconGraphic = document.createElement("div");
        iconGraphic.className = "icon-graphic";
        iconGraphic.textContent = getIcon(name, node);

        const iconLabel = document.createElement("div");
        iconLabel.className = "icon-label";
        iconLabel.textContent = name;

        item.appendChild(iconGraphic);
        item.appendChild(iconLabel);

        const fullPath = `Desktop/${name}`;

        // 選択
        // 選択処理 (単一 / Ctrl / Shift 選択対応)
        item.addEventListener("click", e => {
            if (selState.wasDragging) return;
            e.stopPropagation();
            selectIconUI(item, e);
        });

        // ★ 追加: 未選択のアイコンを右クリックした際、Windows同様にそのアイコンを選択状態にする（バグ防止）
        item.addEventListener("mousedown", e => {
            if (e.button === 2) { // 右クリック
                if (!globalSelected.items.has(item)) {
                    selectIconUI(item, e);
                }
            }
        });

        // 複数アイコンのドラッグ＆ドロップ移動機能
        item.draggable = true;
        item.addEventListener("dragstart", (e) => {
            if (!globalSelected.items.has(item)) {
                selectIconUI(item, e);
            }

            // ★ 修正: 複数選択されたすべてのアイコンのオフセット情報を計算して保持
            const draggedItemsInfo = Array.from(globalSelected.items).map(i => {
                const rect = i.getBoundingClientRect();
                return {
                    name: i.dataset.name,
                    offsetX: e.clientX - rect.left,
                    offsetY: e.clientY - rect.top
                };
            });
            const draggedNames = draggedItemsInfo.map(i => i.name);

            e.dataTransfer.setData("text/plain", JSON.stringify({
                type: "desktop-icons",
                names: draggedNames,
                draggedItems: draggedItemsInfo // 各アイコン個別のオフセット情報を追加
            }));
            e.dataTransfer.effectAllowed = "move";
        });
        item.addEventListener("dragover", (e) => {
            e.preventDefault();
            item.classList.add("drag-target");
        });

        item.addEventListener("dragleave", () => {
            item.classList.remove("drag-target");
        });

        item.addEventListener("drop", (e) => {
            e.preventDefault();
            item.classList.remove("drag-target");

            const dataStr = e.dataTransfer.getData("text/plain");
            try {
                const data = JSON.parse(dataStr);
                if (data && data.type === "desktop-icons") {
                    // ★ 追加: 自動整列ONの場合のみ順序の入れ替えを行う
                    // OFFの時はイベントの伝播を止めず、デスクトップ背景のDropイベント（座標移動）に処理を任せる
                    if (autoArrange) {
                        e.stopPropagation();
                        reorderDesktopIcons(data.names, name);
                    }
                }
            } catch (err) { }
        });

        // ダブルクリック
        item.addEventListener("dblclick", () => {
            openFSItem(name, node, "Desktop");
        });

        // 右クリック
        attachContextMenu(item, () => [
            {
                label: "削除",
                action: () => deleteFSItem("Desktop", name)
            },
            {
                label: "プログラムから開く",
                disabled: () => node.type !== "file",
                action: () => {
                    if (node.type === "file") {
                        explorerOpenWithDialog(fullPath, node);
                    } else {
                        alertWindow("システムエラー防止のため開けません", { width: 350, height: 110 });
                    }
                }
            },
            {
                label: "プロパティ",
                action: () => showProperties(name, node, fullPath)
            }
        ]);

        // ★ 追加: 自動整列OFFの時、メモリ上の座標データがあればスタイルに適用
        if (!autoArrange) {
            item.style.position = "absolute";
            if (iconPositions[name]) {
                item.style.left = `${iconPositions[name].x}px`;
                item.style.top = `${iconPositions[name].y}px`;
            } else {
                // ドラッグ歴がないアイコンや新規作成アイコンを標準グリッド（縦並び）に配置
                const iconNames = Object.keys(FS.Desktop).filter(k => k !== "type" && k !== "system");
                const iconIndex = iconNames.indexOf(name);
                const rowHeight = 90;
                const colWidth = 90;
                const maxRows = Math.max(1, Math.floor(((window.innerHeight || 600) - 60) / rowHeight));

                const col = Math.floor(iconIndex / maxRows);
                const row = iconIndex % maxRows;

                item.style.left = `${10 + col * colWidth}px`;
                item.style.top = `${10 + row * rowHeight}px`;
            }
        }

        return item; // ← appendしない
    }

    // 🔥 ここでまとめて作る
    for (const name in FS.Desktop) {
        if (name === "type" || name === "system" || name === "lastModified") continue;
        fragment.appendChild(createIcon(name, FS.Desktop[name]));
    }

    // 🔥 一括反映
    iconsContainer.innerHTML = "";
    iconsContainer.appendChild(fragment);

    // --------------------
    // 右クリックメニュー（デスクトップ）
    // --------------------
    const desktopNode = FS.Desktop; // ← resolveFS削減

    attachContextMenu(desktop, (e) => {
        if (e.target.closest(".window")) return [];

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

        items.push({
            label: "新規フォルダ",
            action: () => createNewItem("Desktop", iconsContainer, "folder")
        });

        items.push({
            label: "新規テキストファイル",
            action: () => createNewItem("Desktop", iconsContainer, "file")
        });

        items.push({
            label: `自動整列 ${autoArrange ? "✓" : ""}`,
            action: () => {
                const nextAutoArrange = !autoArrange;

                // ★ 改善: 自動整列ONからOFFに切り替える際、現在のFlexbox上の表示位置を座標データとして保存する
                if (autoArrange && !nextAutoArrange) {
                    const iconsContainer = document.getElementById("desktop-icons");
                    if (iconsContainer) {
                        const containerRect = iconsContainer.getBoundingClientRect();
                        const icons = iconsContainer.querySelectorAll(".icon");
                        iconPositions = {};
                        icons.forEach(icon => {
                            const name = icon.dataset.name;
                            const rect = icon.getBoundingClientRect();
                            iconPositions[name] = {
                                x: rect.left - containerRect.left,
                                y: rect.top - containerRect.top
                            };
                        });
                        dbSet("desktop_iconsPositions", iconPositions, "settings").catch(e => console.error(e));
                    }
                }

                autoArrange = nextAutoArrange;
                // 状態をDBの settings ストアへ保存
                dbSet("desktop_autoArrange", autoArrange, "settings").catch(e => console.error(e));

                // 自動整列がONになったら、保存されているアイコンの自由配置データを消去する
                if (autoArrange) {
                    iconPositions = {};
                    dbSet("desktop_iconsPositions", {}, "settings").catch(e => console.error(e));
                }

                autoArrangeIcons();
                buildDesktop(); // 配置方法が変わるため強制再描画
            }
        });

        items.push({
            label: "選択アイテムを削除",
            disabled: globalSelected.items.size === 0,
            action: async () => {
                if (globalSelected.items.size > 0) {
                    const itemsToDelete = Array.from(globalSelected.items).map(item => item.dataset.name);
                    globalSelected.items.clear();

                    // 順番に確実に削除を処理
                    for (const name of itemsToDelete) {
                        await deleteFSItem("Desktop", name, false);
                        // ★ デフォルト項目の場合は削除されたことを記録
                        await markDefaultDeleted(`Desktop/${name}`);
                    }

                    await forceSave(); // ★ 確実に保存を待つ
                    window.dispatchEvent(new Event("fs-updated"));
                }
            }
        });

        if (globalSelected.item) {
            const name = globalSelected.item.dataset.name;
            const node = desktopNode[name];
            const fullPath = `Desktop/${name}`;

            items.push({
                label: "プログラムから開く",
                disabled: node.type !== "file",
                action: () => {
                    if (node.type === "file") {
                        explorerOpenWithDialog(fullPath, node);
                    } else {
                        alertWindow("ファイル以外は開けません", { width: 300, height: 110 });
                    }
                }
            });

            items.push({
                label: "プロパティ",
                action: () => showProperties(name, node, fullPath)
            });
        }

        return items;
    });

    // --------------------
    // 選択UI共通関数 (Ctrl/Shift/単一選択対応)
    // --------------------
    const selectIconUI = (targetItem, e) => {
        globalSelected.window = desktop;
        const iconsArray = Array.from(iconsContainer.querySelectorAll(".icon"));

        if (e && e.ctrlKey) {
            if (globalSelected.items.has(targetItem)) {
                globalSelected.items.delete(targetItem);
                targetItem.classList.remove("selected");
            } else {
                globalSelected.items.add(targetItem);
                targetItem.classList.add("selected");
            }
            globalSelected.lastSelected = targetItem;
        } else if (e && e.shiftKey && globalSelected.lastSelected) {
            const startIdx = iconsArray.indexOf(globalSelected.lastSelected);
            const endIdx = iconsArray.indexOf(targetItem);
            const [min, max] = [Math.min(startIdx, endIdx), Math.max(startIdx, endIdx)];

            globalSelected.items.forEach(i => i.classList.remove("selected"));
            globalSelected.items.clear();

            for (let i = min; i <= max; i++) {
                globalSelected.items.add(iconsArray[i]);
                iconsArray[i].classList.add("selected");
            }
        } else {
            globalSelected.items.forEach(i => i.classList.remove("selected"));
            globalSelected.items.clear();
            globalSelected.items.add(targetItem);
            targetItem.classList.add("selected");
            globalSelected.lastSelected = targetItem;
        }

        // 単一選択メニュー（開く・プロパティ等）との互換性を保持
        globalSelected.item = globalSelected.items.size === 1 ? Array.from(globalSelected.items)[0] : null;
    };

    // --------------------
    // マウスドラッグによる範囲選択処理
    // --------------------
    if (!window._desktopSelectionState) {
        window._desktopSelectionState = {
            isSelecting: false,
            selectionBox: null,
            startX: undefined,
            startY: undefined,
            wasDragging: false
        };
    }
    const selState = window._desktopSelectionState;

    if (!window._desktopSelectionGuard) {
        window._desktopSelectionGuard = true;

        // 1. デスクトップ以外の場所をクリックした時の選択解除
        document.addEventListener("mousedown", (e) => {
            if (e.button !== 0) return;
            if (e.target.closest(".icon") || e.target.closest(".context-menu")) return;

            if (!e.ctrlKey && !e.shiftKey) {
                if (globalSelected.items) {
                    globalSelected.items.forEach(i => i.classList.remove("selected"));
                    globalSelected.items.clear();
                }
                globalSelected.lastSelected = null;
                globalSelected.item = null;
            }
        });

        // 2. マウス移動時の範囲選択ボックスの描画とアイコン判定
        document.addEventListener("mousemove", (e) => {
            if (selState.startX === undefined || selState.startY === undefined) return;
            const dx = Math.abs(e.clientX - selState.startX);
            const dy = Math.abs(e.clientY - selState.startY);

            if (!selState.isSelecting && (dx > 3 || dy > 3)) {
                selState.isSelecting = true;
                selState.wasDragging = true;
                if (!e.ctrlKey) {
                    globalSelected.items.forEach(i => i.classList.remove("selected"));
                    globalSelected.items.clear();
                    globalSelected.lastSelected = null;
                }
                selState.selectionBox = document.createElement("div");
                selState.selectionBox.style.cssText = "position:fixed; border:1px solid #0078D7; background-color:rgba(0, 120, 215, 0.2); z-index:1000; pointer-events:none;";
                document.body.appendChild(selState.selectionBox);
            }

            if (selState.isSelecting && selState.selectionBox) {
                e.preventDefault();
                const currentX = e.clientX;
                const currentY = e.clientY;
                selState.selectionBox.style.left = Math.min(selState.startX, currentX) + "px";
                selState.selectionBox.style.top = Math.min(selState.startY, currentY) + "px";
                selState.selectionBox.style.width = Math.abs(selState.startX - currentX) + "px";
                selState.selectionBox.style.height = Math.abs(selState.startY - currentY) + "px";

                const boxRect = selState.selectionBox.getBoundingClientRect();
                const iconsContainerCurrent = document.getElementById("desktop-icons");
                if (!iconsContainerCurrent) return;
                const icons = iconsContainerCurrent.querySelectorAll(".icon");

                icons.forEach(item => {
                    const itemRect = item.getBoundingClientRect();
                    const isIntersecting = !(
                        itemRect.right < boxRect.left || itemRect.left > boxRect.right ||
                        itemRect.bottom < boxRect.top || itemRect.top > boxRect.bottom
                    );
                    if (isIntersecting) {
                        item.classList.add("selected");
                        globalSelected.items.add(item);
                    } else if (!e.ctrlKey) {
                        item.classList.remove("selected");
                        globalSelected.items.delete(item);
                    }
                });
            }
        });

        // 3. マウスを離した時の処理
        document.addEventListener("mouseup", () => {
            selState.startX = undefined;
            selState.startY = undefined;
            if (selState.isSelecting) {
                selState.isSelecting = false;
                if (selState.selectionBox) selState.selectionBox.remove();
                selState.selectionBox = null;
                setTimeout(() => { selState.wasDragging = false; }, 50);
            }
        });
    }

    // デスクトップ上の mousedown（範囲選択の起点 ＆ フォーカス用）
    if (!desktop._mousedownInstalled) {
        desktop._mousedownInstalled = true;
        desktop.addEventListener("mousedown", (e) => {
            if (e.button !== 0 || e.target.closest(".window")) return;
            if (e.target.closest(".icon")) return;

            desktop.focus(); // キーボード操作のためにフォーカスを当てる

            selState.startX = e.clientX;
            selState.startY = e.clientY;
            selState.isSelecting = false;
            selState.wasDragging = false;
        });
    }

    // ────────────────────────────────────────────────────────
    // 🔥 追加：外部からのファイルドロップ受付機能
    // ────────────────────────────────────────────────────────
    // ⭐ 修正：イベントリスナーの多重登録を防ぐガードを追加
    if (!desktop._dndInstalled) {
        desktop._dndInstalled = true;

        desktop.addEventListener("dragover", (e) => {
            e.preventDefault();
            e.stopPropagation();
            desktop.classList.add("drag-over"); // 視覚効果用のCSSクラス
        });

        desktop.addEventListener("dragleave", (e) => {
            e.preventDefault();
            e.stopPropagation();
            desktop.classList.remove("drag-over");
        });

        desktop.addEventListener("drop", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            desktop.classList.remove("drag-over");

            // ★ 追加: 内部アイコンのドラッグ移動（自動整列OFF時）
            const dataStr = e.dataTransfer.getData("text/plain");
            try {
                const data = JSON.parse(dataStr);
                if (data && data.type === "desktop-icons" && !autoArrange) {
                    // ★ 修正: 個別のオフセット情報がある場合はそれを使用し、フォーメーションを維持する
                    if (data.draggedItems) {
                        data.draggedItems.forEach((itemData) => {
                            let newX = e.clientX - itemData.offsetX;
                            let newY = e.clientY - itemData.offsetY;
                            iconPositions[itemData.name] = { x: newX, y: newY };
                        });
                    } else {
                        // 古い形式のデータが来た場合のフォールバック処理
                        let newX = e.clientX - (data.offsetX || 0);
                        let newY = e.clientY - (data.offsetY || 0);
                        data.names.forEach((name, index) => {
                            iconPositions[name] = { x: newX + (index * 30), y: newY + (index * 30) };
                        });
                    }

                    // メモリの座標を更新し、DBの settings ストアに非同期で保存
                    await dbSet("desktop_iconsPositions", iconPositions, "settings");
                    buildDesktop(); // 再描画して新しい位置を反映
                    return; // ここで処理を終了し、外部ファイルドロップの処理は行わない
                }
            } catch (err) { /* JSONパースエラー時は無視して通常のファイルドロップ処理へ */ }

            const folderNode = FS.Desktop; // デスクトップの仮想FSノードを参照
            if (!folderNode) return;

            // ドロップされた直後のエントリを取得
            const initialEntries = [];
            let hasFiles = false;
            if (e.dataTransfer.items) {
                for (let i = 0; i < e.dataTransfer.items.length; i++) {
                    const item = e.dataTransfer.items[i];
                    if (item.kind === 'file') {
                        hasFiles = true;
                        const entry = item.webkitGetAsEntry();
                        if (entry) initialEntries.push(entry);
                    }
                }
            } else {
                if (e.dataTransfer.files.length > 0) hasFiles = true;
                initialEntries.push(...Array.from(e.dataTransfer.files));
            }

            // ⭐ 追加: URLがドロップされた場合の処理
            const uriList = e.dataTransfer.getData("text/uri-list");
            const textPlain = e.dataTransfer.getData("text/plain");
            const urlToSave = uriList || textPlain;

            if (!hasFiles && urlToSave && urlToSave.startsWith("http")) {
                let urlName = "新しいショートカット.url";
                try {
                    const urlObj = new URL(urlToSave);
                    urlName = (urlObj.hostname).replace(/[\/\\?%*:|"<>]/g, "_") + ".url";
                } catch (err) { }

                // 重複回避
                const dotIdx = urlName.lastIndexOf(".");
                const base = dotIdx !== -1 ? urlName.substring(0, dotIdx) : urlName;
                const ext = dotIdx !== -1 ? urlName.substring(dotIdx) : "";
                let idx = 1;
                let finalName = urlName;
                while (folderNode[finalName]) {
                    finalName = `${base} (${idx++})${ext}`;
                }

                // Windows仕様のURLファイルとして保存
                folderNode[finalName] = {
                    type: "file",
                    content: `[InternetShortcut]\nURL=${urlToSave}`,
                    size: urlToSave.length + 21,
                    lastModified: Date.now()
                };

                await forceSave();
                window.dispatchEvent(new Event("fs-updated"));
                buildDesktop();
                return;
            }

            if (initialEntries.length === 0) return;

            // 総項目数をカウント（プログレスバー用）
            let totalFiles = 0;
            const countEntries = async (entry) => {
                totalFiles++;
                if (entry.isDirectory) {
                    const reader = entry.createReader();
                    const getEntries = () => new Promise(res => reader.readEntries(res));
                    let batch;
                    do {
                        batch = await getEntries();
                        if (batch) {
                            for (const sub of batch) await countEntries(sub);
                        }
                    } while (batch && batch.length > 0);
                }
            };

            for (const ent of initialEntries) {
                if (ent instanceof File) totalFiles++;
                else await countEntries(ent);
            }

            // プログレスウィンドウの生成
            const pg = progressWindow("コピー中...", "コピーの準備をしています...", {
                width: 380,
                height: 250,
                autoClose: true
            });

            desktop.style.opacity = "0.5";
            let processedCount = 0;

            const addFileToNode = async (file, targetNode) => {
                pg.update(processedCount, totalFiles, `${file.name} をコピーしています...`);
                let targetName = getUniqueName(targetNode, file.name);

                try {
                    const content = await importFileSmart(file);
                    targetNode[targetName] = {
                        type: "file",
                        content,
                        size: file.size,
                        lastModified: file.lastModified || Date.now()
                    };
                } catch (err) {
                    console.error(`Failed to read file: ${file.name}`, err);
                }
                processedCount++;
            };

            const processEntry = async (entry, targetNode) => {
                if (entry.isFile) {
                    const file = await new Promise(res => entry.file(res));
                    await addFileToNode(file, targetNode);
                } else if (entry.isDirectory) {
                    let dirName = getUniqueName(targetNode, entry.name);
                    targetNode[dirName] = {
                        type: "folder",
                        lastModified: Date.now()
                    };
                    const newDirNode = targetNode[dirName];

                    processedCount++;
                    pg.update(processedCount, totalFiles, `${dirName} を作成しています...`);

                    const reader = entry.createReader();
                    const getEntries = () => new Promise(res => reader.readEntries(res));
                    let batch;
                    do {
                        batch = await getEntries();
                        if (batch) {
                            for (const subEntry of batch) {
                                await processEntry(subEntry, newDirNode);
                            }
                        }
                    } while (batch && batch.length > 0);
                }
            };

            setBulkUpdating(true);
            try {
                for (const item of initialEntries) {
                    if (item instanceof File) {
                        await addFileToNode(item, folderNode);
                    } else {
                        await processEntry(item, folderNode);
                    }
                }
                folderNode.lastModified = Date.now();
                // 最終更新
                pg.update(totalFiles, totalFiles, "すべての項目のコピーが完了しました。");
                await forceSave();

            } catch (err) {
                console.error("Drop processing failed:", err);
                if (pg && typeof pg.close === "function") pg.close();
            } finally {
                setBulkUpdating(false);
                // 【修正】desktop.jsの正しいDOM要素を参照させる
                desktop.style.opacity = "1";

                // ==========================================
                // ⭐ メモリ解放 (GCの促進)
                // ==========================================
                // 1. 巨大なオブジェクトツリーの参照を切断
                initialEntries.length = 0;

                // 2. ブラウザ側のD&Dキャッシュを強力にクリア
                if (e.dataTransfer) {
                    if (typeof e.dataTransfer.clearData === 'function') {
                        e.dataTransfer.clearData();
                    }
                    if (e.dataTransfer.items && typeof e.dataTransfer.items.clear === 'function') {
                        try { e.dataTransfer.items.clear(); } catch (err) { }
                    }
                }

                window.dispatchEvent(new Event("fs-updated"));
                // 【修正】desktop.jsの正しい再描画関数を呼ぶ
                buildDesktop();

                // 3. クロージャによるFileオブジェクト等のメモリ拘束（リーク）を防ぐため、
                // setTimeoutには必要な参照(pg)のみを引数として渡す
                const closeProgress = (progressWindowObj) => {
                    if (progressWindowObj && typeof progressWindowObj.close === "function") {
                        progressWindowObj.close();
                    }
                };
                setTimeout(closeProgress, 500, pg);
            }
        });
    } // ⭐ ガード処理はここまで

    requestAnimationFrame(adjustDesktopIconArea);
    window.dispatchEvent(new Event("desktop-ready"));
}

// タスクバー高さに応じてアイコン領域を調整
function adjustDesktopIconArea() {
    const desktop = document.getElementById("desktop");
    const iconsContainer = document.getElementById("desktop-icons");
    const taskbar = document.getElementById("taskbar");
    if (!desktop || !iconsContainer || !taskbar) return;

    // 🔥 修正: タスクバーがウィンドウモードの場合はタスクバーの高さを考慮せず 0 にする
    const isWindowMode = taskbar.closest(".window") !== null;
    const taskbarHeight = isWindowMode ? 0 : (taskbar.offsetHeight > 0 ? taskbar.offsetHeight : 40);

    iconsContainer.style.position = "absolute";
    iconsContainer.style.top = "0";
    iconsContainer.style.left = "0";
    iconsContainer.style.right = "0";
    iconsContainer.style.bottom = `${taskbarHeight}px`; // タスクバー分の余白 (ウィンドウモード時は 0px)
    iconsContainer.style.display = "flex";

    // アイコンを「上から下」へ並べ、画面下まで到達したら「右」へ折り返す (Windows標準の挙動)
    iconsContainer.style.flexDirection = "column";
    iconsContainer.style.flexWrap = "wrap";

    iconsContainer.style.alignContent = "flex-start";
    iconsContainer.style.padding = "10px"; // 内側余白
    iconsContainer.style.overflow = "auto";
}

// --------------------
// 起動完了時やリサイズ時に確実に再計算させる仕組み
// --------------------
// 🔥 修正点3: 画面が非表示から表示に切り替わった瞬間を検知してレイアウトを直す
if (!window._desktopResizeObserver) {
    window._desktopResizeObserver = new ResizeObserver(() => {
        adjustDesktopIconArea();
    });
    // 画面全体(body)のサイズや表示状態の変化を監視
    window._desktopResizeObserver.observe(document.body);
}

// 既存のイベントリスナー（これは残しておいてOKです）
window.addEventListener("desktop-resize", adjustDesktopIconArea);

// --------------------
// 新規フォルダ/ファイル作成
// --------------------
function createNewItem(currentPath, container, itemType = "folder") {
    const folderNode = resolveFS(currentPath);
    if (!folderNode || !container) return;

    // 二重作成防止（フラグ管理）
    if (createNewItem.isCreating) return;
    createNewItem.isCreating = true;

    // 初期表示名の設定（getUniqueName を利用して重複をスマートに回避）
    let baseName = itemType === "folder" ? "新規フォルダ" : "新しいテキスト.txt";
    let defaultName = getUniqueName(folderNode, baseName);

    const iconDiv = document.createElement("div");
    iconDiv.className = "icon";

    // ✨ 改善点①: 作成中もフォルダ/ファイルのアイコン（グラフィック）を表示する
    const iconGraphic = document.createElement("div");
    iconGraphic.className = "icon-graphic";
    iconGraphic.textContent = itemType === "folder" ? "📁" : "📄";
    iconDiv.appendChild(iconGraphic);

    const input = document.createElement("input");
    input.type = "text";
    input.value = defaultName;
    input.style.cssText = "font-size:13px; text-align:left; width:auto; min-width:100px; z-index:10;";
    iconDiv.appendChild(input);

    container.appendChild(iconDiv);
    input.focus();

    // ファイルの場合は拡張子の手前までを選択、フォルダは全選択
    const dotIndex = defaultName.lastIndexOf(".");
    if (itemType === "file" && dotIndex > 0) {
        input.setSelectionRange(0, dotIndex);
    } else {
        input.select();
    }

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

        // バリデーション (fs-utils.js)
        const error = validateName(newName);
        if (error) {
            isCommitting = false;
            isShowingError = true;
            alertWindow(error, { width: 360, height: 160, taskbar: false });
            setTimeout(() => {
                isShowingError = false;
                input.focus();
            }, 0);
            return;
        }

        // ✨ 改善点②: 独自の while ループの代わりに getUniqueName を使用して統一感を持たせる
        let finalName = getUniqueName(folderNode, newName);

        // 指定されたタイプで作成
        const now = Date.now();
        if (itemType === "folder") {
            folderNode[finalName] = { type: "folder", lastModified: now };
        } else {
            folderNode[finalName] = { type: "file", content: "", lastModified: now };
        }

        iconDiv.remove();
        createNewItem.isCreating = false;
        window.dispatchEvent(new Event("fs-updated"));
    };

    input.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            e.preventDefault();
            finishEditing();
        } else if (e.key === "Escape") {
            isCommitting = true;
            iconDiv.remove();
            createNewItem.isCreating = false;
        }
    });

    // 💡 修正点: blur 時に入力をキャンセルして消すのではなく、finishEditing() を呼んで確定させる
    input.addEventListener("blur", () => {
        if (isShowingError || isCommitting) return;
        finishEditing();
    });
}

// --------------------
// アイテム削除 (ゴミ箱対応版)
// --------------------
async function deleteFSItem(parentPath, itemName, dispatchEvent = true) {
    const parentNode = resolveFS(parentPath);
    if (!parentNode || !parentNode[itemName]) return false;

    // --- ゴミ箱内からの完全消去の場合 ---
    const isTrash = parentPath === "Trash" || parentPath.startsWith("Trash/");
    if (isTrash) {
        delete parentNode[itemName];
        if (dispatchEvent) {
            await forceSave(); // ★ 確実に保存を待つ
            window.dispatchEvent(new Event("fs-updated"));
        }
        return true;
    }

    try {
        const targetItemData = JSON.parse(JSON.stringify(parentNode[itemName]));
        targetItemData.originalPath = parentPath;

        const trashNode = resolveFS("Trash");
        if (!trashNode) {
            delete parentNode[itemName];
            if (dispatchEvent) {
                await forceSave(); // ★ 確実に保存を待つ
                window.dispatchEvent(new Event("fs-updated"));
            }
            return true;
        }

        const success = delete parentNode[itemName];
        if (!success) throw new Error("Blocked by Proxy");

        let targetName = itemName;
        if (trashNode[itemName]) {
            let counter = 1;
            let baseName = `${Date.now()}_${itemName}`;
            targetName = baseName;
            while (trashNode[targetName]) {
                targetName = `${baseName}_${counter++}`;
            }
        }

        trashNode[targetName] = targetItemData;

        if (dispatchEvent) {
            await forceSave(); // ★ 確実に保存を待つ
            window.dispatchEvent(new Event("fs-updated"));
        }
        return true;
    } catch (e) {
        console.warn(`[Desktop Guard] 削除拒否: ${itemName}`);
        alertWindow(`「${itemName}」は保護されているため削除できません。`, {
            title: "システム保護",
            width: 350,
            height: 160
        });
        return false;
    }
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

    document.addEventListener("keydown", async (e) => {
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
            case "Delete":
                if (globalSelected.items.size > 0) {
                    e.preventDefault();
                    const itemsToDelete = Array.from(globalSelected.items).map(item => item.dataset.name);
                    globalSelected.items.clear();

                    for (const name of itemsToDelete) {
                        await deleteFSItem("Desktop", name, false);
                        // ★ デフォルト項目の場合は削除されたことを記録
                        await markDefaultDeleted(`Desktop/${name}`);
                    }

                    await forceSave(); // ★ 確実に保存を待つ
                    window.dispatchEvent(new Event("fs-updated"));
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


// --------------------
// 自動整列処理
// --------------------
export function autoArrangeIcons() {
    const iconsContainer = document.getElementById("desktop-icons");
    if (!iconsContainer) return;

    if (autoArrange) {
        // 自動整列ON: Flexboxレイアウトで整列
        iconsContainer.style.display = "flex";
        iconsContainer.style.flexDirection = "column";
        iconsContainer.style.flexWrap = "wrap";
        iconsContainer.style.alignContent = "flex-start";
    } else {
        // ★ 追加: 自動整列OFF時は自由配置にするためFlexを解除
        iconsContainer.style.display = "block";
    }
}

// --------------------
// ドラッグ移動によるデスクトップアイコン並び替え
// --------------------
function reorderDesktopIcons(draggedNames, targetName) {
    const desktopFS = FS.Desktop;
    if (!desktopFS) return;

    const keys = Object.keys(desktopFS).filter(k => k !== "type" && k !== "system" && k !== "lastModified");
    const draggedSet = new Set(draggedNames);

    // 移動先の位置を特定して順番を差し替え
    const remainingKeys = keys.filter(k => !draggedSet.has(k));
    const targetIdx = remainingKeys.indexOf(targetName);

    if (targetIdx !== -1) {
        remainingKeys.splice(targetIdx, 0, ...draggedNames);
    } else {
        remainingKeys.push(...draggedNames);
    }

    // FSオブジェクトのプロパティ順序を再構築
    const newDesktop = { type: desktopFS.type, system: desktopFS.system };
    remainingKeys.forEach(k => {
        if (desktopFS[k]) newDesktop[k] = desktopFS[k];
    });

    FS.Desktop = newDesktop;
    window.dispatchEvent(new Event("fs-updated"));
}