// desktop.js
import { FS, forceSave, markDefaultDeleted, unmarkDefaultDeleted, setBulkUpdating, reorderNodeKeys } from "./fs.js";
import {
    resolveFS,
    validateName,
    importFileSmart,
    getUniqueName,
    isDescendantOrSelf,
    isSystemMetaKey,
    cloneFSNode,
    resolveLinkTarget,
    clearSystemProtection,
    processStorageRecursively,
    createUrlShortcutNode,
    renameFSItem,
    setFSClipboard,
    getFSClipboard,
    clearFSClipboard,
    isPathCutInClipboard
} from "./fs-utils.js";
import { addRecent } from "./recent.js";
import { attachContextMenu } from "./context-menu.js";
import { resolveAppByPath, getIcon, getDisplayFileName } from "./file-associations.js";
import { openWithDialog as explorerOpenWithDialog, showProperties, emptyTrash } from "./apps/explorer.js";
import { dbGet, dbSet, moveFileContent, copyFileContent, deleteFileContentRecursive } from "./fs-db.js";
import { applyDesktopBackground } from "./apps/settings.js";

// 選択状態管理 (複数選択・範囲選択対応)
let globalSelected = { items: new Set(), window: null, lastSelected: null };
let autoArrange = true; // 自動整列フラグ
let iconPositions = {}; // 自動整列OFF時のアイコン座標データ
let showFileExtensions = true; // 拡張子表示設定

(async () => {
    try {
        const savedAutoArrange = await dbGet("desktop_autoArrange", "settings");
        if (savedAutoArrange !== undefined) autoArrange = savedAutoArrange;

        const savedPositions = await dbGet("desktop_iconsPositions", "settings");
        if (savedPositions) iconPositions = savedPositions;

        // エクスプローラーと共通の拡張子表示設定をロード
        const savedShowExt = await dbGet("explorerShowFileExtensions", "settings");
        if (savedShowExt !== undefined) {
            showFileExtensions = savedShowExt === true || savedShowExt === "true";
        }

        const desktop = document.getElementById("desktop");
        if (desktop && !window.nexser?.isBooting) buildDesktop();
    } catch (e) {
        console.warn("デスクトップ設定の読み込みに失敗しました:", e);
    }
})();

// --------------------
// 共通: アイテム移動・コピー処理（デスクトップ背景・フォルダアイコン共通）
// --------------------
async function transferItemsToTarget(data, targetPath, targetNode, isCopy) {
    if (!data || !targetNode || targetNode.type !== "folder") return false;

    const isDroppingToTrash = targetPath.toLowerCase() === "c:/trash";
    const effectiveIsCopy = isDroppingToTrash ? false : isCopy;

    let itemEntries = [];
    let sourcePath = "";

    if (data.type === "explorer-icons") {
        sourcePath = (data.sourcePath || "C:/Desktop").replace(/\\/g, "/").replace(/\/+$/, "");
        itemEntries = (data.draggedItems || []).map(info => info.name);
    } else if (data.type === "desktop-icons") {
        sourcePath = "C:/Desktop";
        itemEntries = data.names || [];
    } else {
        return false;
    }

    const sourceFolder = resolveFS(sourcePath);
    if (!sourceFolder) return false;

    const normalizedSourcePath = sourcePath.toLowerCase();
    const isTakingOutFromTrash = (normalizedSourcePath === "c:/trash" || normalizedSourcePath === "trash") && !isDroppingToTrash;

    let hasModified = false;
    setBulkUpdating(true);
    try {
        for (const itemName of itemEntries) {
            const rawItem = sourceFolder[itemName];
            if (!rawItem) continue;

            const sourceFullPath = sourcePath ? `${sourcePath}/${itemName}` : itemName;

            // 自分自身や子孫フォルダへの移動・コピーを防止
            if (isDescendantOrSelf(sourceFullPath, targetPath)) continue;

            // 移動の場合、同じフォルダへのドロップはスキップ
            if (!effectiveIsCopy && sourcePath === targetPath) continue;

            // ゴミ箱への移動時はシステム保護アイテムをスキップ
            if (isDroppingToTrash && rawItem.system === true) continue;

            const cleanBaseName = isTakingOutFromTrash ? itemName.replace(/^\d+_/, "") : itemName;
            let uniqueTargetName = getUniqueName(targetNode, cleanBaseName);

            if (isDroppingToTrash && targetNode[itemName]) {
                let counter = 1;
                const baseName = `${Date.now()}_${itemName}`;
                uniqueTargetName = baseName;
                while (targetNode[uniqueTargetName]) {
                    uniqueTargetName = `${baseName}_${counter++}`;
                }
            }

            const clonedNode = cloneFSNode(rawItem);
            if (isDroppingToTrash) {
                clonedNode.originalPath = sourcePath;
                await markDefaultDeleted(sourceFullPath);
            } else if (isTakingOutFromTrash) {
                delete clonedNode.originalPath;
            }

            const newTargetFullPath = `${targetPath}/${uniqueTargetName}`;
            if (isTakingOutFromTrash) {
                await unmarkDefaultDeleted(newTargetFullPath);
            }

            if (effectiveIsCopy) {
                clearSystemProtection(clonedNode);
                if (clonedNode.type === "file" || clonedNode.type === "app") {
                    await copyFileContent(sourceFullPath, newTargetFullPath);
                } else if (clonedNode.type === "folder") {
                    await processStorageRecursively(clonedNode, sourceFullPath, newTargetFullPath, true);
                }
                targetNode[uniqueTargetName] = clonedNode;
                hasModified = true;
            } else {
                if (clonedNode.type === "file" || clonedNode.type === "app") {
                    await moveFileContent(sourceFullPath, newTargetFullPath);
                } else if (clonedNode.type === "folder") {
                    await processStorageRecursively(clonedNode, sourceFullPath, newTargetFullPath, false);
                }

                let moved = false;
                try {
                    moved = delete sourceFolder[itemName];
                } catch (_) {
                    moved = false;
                }

                if (moved) {
                    targetNode[uniqueTargetName] = clonedNode;
                } else {
                    if (clonedNode.type === "file" || clonedNode.type === "app") {
                        await moveFileContent(newTargetFullPath, sourceFullPath).catch(() => deleteFileContentRecursive(newTargetFullPath));
                    } else if (clonedNode.type === "folder") {
                        await processStorageRecursively(clonedNode, newTargetFullPath, sourceFullPath, false).catch(() => deleteFileContentRecursive(newTargetFullPath));
                    }

                    targetNode[uniqueTargetName] = {
                        type: "link",
                        target: clonedNode.type === "link" ? clonedNode.target : sourceFullPath,
                        lastModified: Date.now()
                    };
                }
                hasModified = true;
            }
        }

        if (hasModified) {
            await forceSave();
        }
    } finally {
        setBulkUpdating(false);
    }

    if (hasModified) {
        window.dispatchEvent(new Event("fs-updated"));
        buildDesktop();
    }
    return hasModified;
}

// --------------------
// デスクトップ描画
// --------------------
export function buildDesktop() {
    globalSelected = { items: new Set(), window: null, lastSelected: null, item: null };

    const desktop = document.getElementById("desktop");
    if (!desktop) return;

    desktop.tabIndex = 0;
    applyDesktopBackground();

    let iconsContainer = document.getElementById("desktop-icons");
    if (!iconsContainer) {
        iconsContainer = document.createElement("div");
        iconsContainer.id = "desktop-icons";
        desktop.appendChild(iconsContainer);
    }

    const desktopFS = FS["C:"]?.Desktop;
    if (!desktopFS) return;

    const validNames = Object.keys(desktopFS).filter(k => !isSystemMetaKey(k));
    const validNameSet = new Set(validNames);

    // 既存DOM要素を再利用するためのマップを作成し、削除済みアイコンのみ除去
    const existingIconsMap = new Map();
    iconsContainer.querySelectorAll(".icon").forEach(el => {
        const iconName = el.dataset.name;
        if (!validNameSet.has(iconName)) {
            el.remove();
        } else {
            existingIconsMap.set(iconName, el);
        }
    });

    const fragment = document.createDocumentFragment();

    // 自動整列OFF時の初期グリッド計算用パラメータをループ外で1回だけ算出
    const taskbar = document.getElementById("taskbar");
    let availableHeight = window.innerHeight;
    if (taskbar && !taskbar.closest(".window") && !taskbar.classList.contains("vertical")) {
        availableHeight -= (taskbar.offsetHeight || 40);
    }
    const rowHeight = 90;
    const colWidth = 90;
    const maxRows = Math.max(1, Math.floor((availableHeight - 40) / rowHeight));

    function syncIconElement(name, node, iconIndex) {
        let item = existingIconsMap.get(name);
        const isNew = !item;

        if (isNew) {
            item = document.createElement("div");
            item.className = "icon";
            item.dataset.name = name;

            const iconGraphic = document.createElement("div");
            iconGraphic.className = "icon-graphic";

            const iconLabel = document.createElement("div");
            iconLabel.className = "icon-label";

            item.appendChild(iconGraphic);
            item.appendChild(iconLabel);
        }

        item.classList.remove("selected");
        item.style.opacity = isPathCutInClipboard("C:/Desktop", name) ? "0.5" : "1";

        // グラフィックとラベルを最新状態に同期
        const iconGraphic = item.querySelector(".icon-graphic");
        const iconLabel = item.querySelector(".icon-label");
        const expectedIcon = getIcon(name, node);
        if (iconGraphic && iconGraphic.textContent !== expectedIcon) {
            iconGraphic.textContent = expectedIcon;
        }
        const isFolder = node && node.type === "folder";
        const expectedLabel = isFolder ? name : getDisplayFileName(name, showFileExtensions);
        if (iconLabel && iconLabel.textContent !== expectedLabel) {
            iconLabel.textContent = expectedLabel;
        }

        // 配置スタイルの適用
        if (!autoArrange) {
            item.style.position = "absolute";
            if (iconPositions[name]) {
                item.style.left = `${iconPositions[name].x}px`;
                item.style.top = `${iconPositions[name].y}px`;
            } else {
                const col = Math.floor(iconIndex / maxRows);
                const row = iconIndex % maxRows;
                item.style.left = `${10 + col * colWidth}px`;
                item.style.top = `${10 + row * rowHeight}px`;
            }
        } else {
            item.style.position = "";
            item.style.left = "";
            item.style.top = "";
        }

        // イベントリスナーは新規生成時のみバインド（実行時に最新の desktopFS[name] を参照）
        if (isNew) {
            const fullPath = `C:/Desktop/${name}`;

            item.addEventListener("click", e => {
                if (selState.wasDragging) return;
                e.stopPropagation();
                selectIconUI(item, e);
            });

            item.addEventListener("mousedown", e => {
                if (e.button === 2 && !globalSelected.items.has(item)) {
                    selectIconUI(item, e);
                }
            });

            item.draggable = true;
            item.addEventListener("dragstart", (e) => {
                if (!globalSelected.items.has(item)) {
                    selectIconUI(item, e);
                }

                const draggedItemsInfo = Array.from(globalSelected.items).map(i => {
                    const rect = i.getBoundingClientRect();
                    return {
                        name: i.dataset.name,
                        offsetX: e.clientX - rect.left,
                        offsetY: e.clientY - rect.top
                    };
                });

                e.dataTransfer.setData("text/plain", JSON.stringify({
                    type: "desktop-icons",
                    names: draggedItemsInfo.map(i => i.name),
                    draggedItems: draggedItemsInfo
                }));
                e.dataTransfer.effectAllowed = "copyMove";
            });

            item.addEventListener("dragover", (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = e.ctrlKey ? "copy" : "move";
                if (!item.classList.contains("drag-target")) {
                    item.classList.add("drag-target");
                }
            });

            item.addEventListener("dragleave", () => {
                item.classList.remove("drag-target");
            });

            item.addEventListener("drop", async (e) => {
                item.classList.remove("drag-target");
                const currentNode = FS["C:"]?.Desktop?.[name];
                if (!currentNode) return;

                const dataStr = e.dataTransfer.getData("text/plain");
                let data = null;
                try {
                    data = dataStr ? JSON.parse(dataStr) : null;
                } catch (_) {
                    return;
                }
                if (!data) return;

                const resolved = resolveLinkTarget(currentNode, fullPath);
                if (resolved.node && resolved.node.type === "folder") {
                    e.preventDefault();
                    e.stopPropagation();
                    await transferItemsToTarget(data, resolved.path, resolved.node, e.ctrlKey);
                    return;
                }

                // フォルダ以外へのドロップ：自動整列ONなら並び替え、OFFなら背景ドロップへバブルアップして自由配置
                if (data.type === "desktop-icons" && autoArrange) {
                    e.preventDefault();
                    e.stopPropagation();
                    reorderDesktopIcons(data.names, name);
                }
            });

            item.addEventListener("dblclick", () => {
                const currentNode = FS["C:"]?.Desktop?.[name];
                if (currentNode) openFSItem(name, currentNode, "C:/Desktop");
            });

            attachContextMenu(item, () => {
                const currentNode = FS["C:"]?.Desktop?.[name];
                if (!currentNode) return [];

                const isTrash = (name === "C:/Trash") ||
                    (currentNode.type === "link" && typeof currentNode.target === "string" && currentNode.target.toLowerCase() === "c:/trash");

                return [
                    {
                        label: "開く",
                        action: () => openFSItem(name, currentNode, "C:/Desktop")
                    },
                    ...(isTrash ? [
                        {
                            label: "ゴミ箱を空にする",
                            action: () => emptyTrash(() => buildDesktop())
                        },
                        { label: "---" }
                    ] : []),
                    {
                        label: "切り取り",
                        disabled: currentNode.system === true,
                        action: () => {
                            const names = getSelectedDesktopNames(item);
                            setFSClipboard("cut", "C:/Desktop", names);
                        }
                    },
                    {
                        label: "コピー",
                        action: () => {
                            const names = getSelectedDesktopNames(item);
                            setFSClipboard("copy", "C:/Desktop", names);
                        }
                    },
                    { label: "---" },
                    {
                        label: "ショートカットの作成",
                        action: async () => {
                            const baseName = `${name} のショートカット`;
                            const uniqueName = getUniqueName(FS["C:"].Desktop, baseName);
                            const realTargetPath = currentNode.type === "link" ? currentNode.target : fullPath;

                            FS["C:"].Desktop[uniqueName] = {
                                type: "link",
                                target: realTargetPath,
                                lastModified: Date.now()
                            };
                            window.dispatchEvent(new Event("fs-updated"));
                        }
                    },
                    {
                        label: "名前の変更",
                        disabled: currentNode.system === true,
                        action: () => startDesktopInlineRename(item, name)
                    },
                    {
                        label: "選択アイテムを削除",
                        disabled: globalSelected.items.size === 0,
                        action: async () => {
                            if (!globalSelected.items.has(item)) {
                                selectIconUI(item);
                            }
                            if (globalSelected.items.size > 0) {
                                const itemsToDelete = Array.from(globalSelected.items).map(i => i.dataset.name);
                                globalSelected.items.clear();
                                globalSelected.item = null;

                                setBulkUpdating(true);
                                try {
                                    for (const targetName of itemsToDelete) {
                                        await deleteFSItem("C:/Desktop", targetName, false);
                                    }
                                    await forceSave();
                                } finally {
                                    setBulkUpdating(false);
                                }
                                window.dispatchEvent(new Event("fs-updated"));
                            }
                        }
                    },
                    {
                        label: "削除",
                        action: async () => {
                            await deleteFSItem("C:/Desktop", name);
                        }
                    },
                    {
                        label: "プログラムから開く",
                        disabled: currentNode.type !== "file",
                        action: () => {
                            if (currentNode.type === "file") {
                                explorerOpenWithDialog(fullPath, currentNode);
                            } else {
                                window.nexser?.windowAPI.alertWindow("ファイル以外は開けません", { width: 350, height: 110 });
                            }
                        }
                    },
                    {
                        label: "プロパティ",
                        action: () => showProperties(name, currentNode, fullPath)
                    }
                ];
            });
        }

        return item;
    }

    validNames.forEach((name, idx) => {
        fragment.appendChild(syncIconElement(name, desktopFS[name], idx));
    });

    iconsContainer.appendChild(fragment);

    // --------------------
    // 右クリックメニュー（デスクトップ：多重登録防止）
    // --------------------
    if (!desktop._contextMenuInstalled) {
        desktop._contextMenuInstalled = true;

        attachContextMenu(desktop, (e) => {
            if (e.target.closest(".window")) return [];
            const desktopNode = FS["C:"]?.Desktop;
            if (!desktopNode) return [];

            const items = [];

            if (globalSelected.item) {
                const name = globalSelected.item.dataset.name;
                const node = desktopNode[name];

                if (node) {
                    items.push({
                        label: "開く",
                        action: () => openFSItem(name, node, "C:/Desktop")
                    });
                }
            }

            const clip = getFSClipboard();
            items.push({
                label: "貼り付け",
                disabled: !clip || clip.names.length === 0,
                action: () => pasteClipboardToDesktop()
            });

            items.push({ label: "---" });

            items.push({
                label: "並べ替え: 名前",
                action: () => sortDesktopIcons("name")
            });
            items.push({
                label: "並べ替え: 種類",
                action: () => sortDesktopIcons("type")
            });
            items.push({
                label: "並べ替え: サイズ",
                action: () => sortDesktopIcons("size")
            });
            items.push({
                label: "並べ替え: 更新日時",
                action: () => sortDesktopIcons("date")
            });

            items.push({ label: "---" });

            items.push({
                label: "新規フォルダ",
                action: () => createNewItem("C:/Desktop", document.getElementById("desktop-icons"), "folder")
            });

            items.push({
                label: "新規テキストファイル",
                action: () => createNewItem("C:/Desktop", document.getElementById("desktop-icons"), "file")
            });

            items.push({
                label: "アイコンを等間隔に整列",
                disabled: autoArrange,
                action: () => snapDesktopIconsToGrid()
            });

            items.push({
                label: `ファイル名拡張子 ${showFileExtensions ? "✓" : ""}`,
                action: async () => {
                    showFileExtensions = !showFileExtensions;
                    await dbSet("explorerShowFileExtensions", showFileExtensions, "settings");
                    window.dispatchEvent(new Event("fs-updated"));
                    buildDesktop();
                }
            });

            items.push({
                label: `自動整列 ${autoArrange ? "✓" : ""}`,
                action: () => {
                    const nextAutoArrange = !autoArrange;

                    if (autoArrange && !nextAutoArrange) {
                        const currentIconsContainer = document.getElementById("desktop-icons");
                        if (currentIconsContainer) {
                            const containerRect = currentIconsContainer.getBoundingClientRect();
                            const icons = currentIconsContainer.querySelectorAll(".icon");
                            iconPositions = {};
                            icons.forEach(icon => {
                                const name = icon.dataset.name;
                                const rect = icon.getBoundingClientRect();
                                iconPositions[name] = {
                                    x: rect.left - containerRect.left,
                                    y: rect.top - containerRect.top
                                };
                            });
                            dbSet("desktop_iconsPositions", iconPositions, "settings").catch(err => console.error(err));
                        }
                    }

                    autoArrange = nextAutoArrange;
                    dbSet("desktop_autoArrange", autoArrange, "settings").catch(err => console.error(err));

                    if (autoArrange) {
                        iconPositions = {};
                        dbSet("desktop_iconsPositions", {}, "settings").catch(err => console.error(err));
                    }

                    autoArrangeIcons();
                    buildDesktop();
                }
            });

            items.push({
                label: "選択アイテムを削除",
                disabled: globalSelected.items.size === 0,
                action: async () => {
                    if (globalSelected.items.size > 0) {
                        const itemsToDelete = Array.from(globalSelected.items).map(item => item.dataset.name);
                        globalSelected.items.clear();
                        globalSelected.item = null;

                        setBulkUpdating(true);
                        try {
                            for (const name of itemsToDelete) {
                                await deleteFSItem("C:/Desktop", name, false);
                            }
                            await forceSave();
                        } finally {
                            setBulkUpdating(false);
                        }

                        window.dispatchEvent(new Event("fs-updated"));
                    }
                }
            });

            if (globalSelected.item) {
                const name = globalSelected.item.dataset.name;
                const node = desktopNode[name];
                const fullPath = `C:/Desktop/${name}`;

                if (node) {
                    items.push({
                        label: "プログラムから開く",
                        disabled: node.type !== "file",
                        action: () => {
                            if (node.type === "file") {
                                explorerOpenWithDialog(fullPath, node);
                            } else {
                                window.nexser?.windowAPI.alertWindow("ファイル以外は開けません", { width: 300, height: 110 });
                            }
                        }
                    });

                    items.push({
                        label: "プロパティ",
                        action: () => showProperties(name, node, fullPath)
                    });
                }
            }

            return items;
        });
    }

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

    if (!desktop._mousedownInstalled) {
        desktop._mousedownInstalled = true;
        desktop.addEventListener("mousedown", (e) => {
            if (e.button !== 0 || e.target.closest(".window")) return;
            if (e.target.closest(".icon")) return;

            desktop.focus();

            selState.startX = e.clientX;
            selState.startY = e.clientY;
            selState.isSelecting = false;
            selState.wasDragging = false;
        });
    }

    // ────────────────────────────────────────────────────────
    // 外部およびエクスプローラーからのファイルドロップ受付機能
    // ────────────────────────────────────────────────────────
    if (!desktop._dndInstalled) {
        desktop._dndInstalled = true;

        desktop.addEventListener("dragover", (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = e.ctrlKey ? "copy" : "move";
            if (!desktop.classList.contains("drag-over")) {
                desktop.classList.add("drag-over");
            }
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

            const folderNode = FS["C:"]?.Desktop;
            if (!folderNode) return;

            const dataStr = e.dataTransfer.getData("text/plain");
            let parsedData = null;
            try {
                parsedData = dataStr ? JSON.parse(dataStr) : null;
            } catch (_) { }

            // 1. エクスプローラーからの移動・コピー、またはデスクトップ内別フォルダからの移動・コピー
            if (parsedData && parsedData.type === "explorer-icons") {
                await transferItemsToTarget(parsedData, "C:/Desktop", folderNode, e.ctrlKey);
                return;
            }

            // 2. デスクトップ内アイコンの自由配置（自動整列OFF時）
            if (parsedData && parsedData.type === "desktop-icons") {
                if (!autoArrange) {
                    const currentIconsContainer = document.getElementById("desktop-icons");
                    const containerRect = currentIconsContainer ? currentIconsContainer.getBoundingClientRect() : { left: 0, top: 0 };
                    const scrollLeft = currentIconsContainer?.scrollLeft || 0;
                    const scrollTop = currentIconsContainer?.scrollTop || 0;

                    if (parsedData.draggedItems) {
                        parsedData.draggedItems.forEach((itemData) => {
                            const newX = Math.max(0, e.clientX - itemData.offsetX - containerRect.left + scrollLeft);
                            const newY = Math.max(0, e.clientY - itemData.offsetY - containerRect.top + scrollTop);
                            iconPositions[itemData.name] = { x: newX, y: newY };
                        });
                    } else {
                        const newX = Math.max(0, e.clientX - (parsedData.offsetX || 0) - containerRect.left + scrollLeft);
                        const newY = Math.max(0, e.clientY - (parsedData.offsetY || 0) - containerRect.top + scrollTop);
                        parsedData.names.forEach((name, index) => {
                            iconPositions[name] = { x: newX + (index * 30), y: newY + (index * 30) };
                        });
                    }

                    await dbSet("desktop_iconsPositions", iconPositions, "settings");
                    buildDesktop();
                }
                return;
            }

            // 3. 外部ファイル・フォルダのドロップ受付
            const initialEntries = [];
            let hasFiles = false;
            if (e.dataTransfer.items) {
                for (let i = 0; i < e.dataTransfer.items.length; i++) {
                    const item = e.dataTransfer.items[i];
                    if (item.kind === "file") {
                        hasFiles = true;
                        const entry = item.webkitGetAsEntry();
                        if (entry) initialEntries.push(entry);
                    }
                }
            } else {
                if (e.dataTransfer.files.length > 0) hasFiles = true;
                initialEntries.push(...Array.from(e.dataTransfer.files));
            }

            // 4. URLドロップ時の .url ショートカット生成
            const uriList = e.dataTransfer.getData("text/uri-list");
            const textPlain = e.dataTransfer.getData("text/plain");
            const urlToSave = uriList || textPlain;

            if (!hasFiles && urlToSave && createUrlShortcutNode(urlToSave, folderNode)) {
                await forceSave();
                window.dispatchEvent(new Event("fs-updated"));
                buildDesktop();
                return;
            }

            if (initialEntries.length === 0) return;

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

            const pg = window.nexser?.windowAPI.progressWindow("コピー中...", "コピーの準備をしています...", {
                width: 380,
                height: 250,
                autoClose: true
            });

            desktop.style.opacity = "0.5";
            let processedCount = 0;

            const addFileToNode = async (file, targetNode) => {
                pg.update(processedCount, totalFiles, `${file.name} をコピーしています...`);
                const targetName = getUniqueName(targetNode, file.name);

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
                    const dirName = getUniqueName(targetNode, entry.name);
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
                pg.update(totalFiles, totalFiles, "すべての項目のコピーが完了しました。");
                await forceSave();
            } catch (err) {
                console.error("Drop processing failed:", err);
                if (pg && typeof pg.close === "function") pg.close();
            } finally {
                setBulkUpdating(false);
                desktop.style.opacity = "1";
                initialEntries.length = 0;

                if (e.dataTransfer) {
                    if (typeof e.dataTransfer.clearData === "function") {
                        e.dataTransfer.clearData();
                    }
                    if (e.dataTransfer.items && typeof e.dataTransfer.items.clear === "function") {
                        try { e.dataTransfer.items.clear(); } catch (_) { }
                    }
                }

                window.dispatchEvent(new Event("fs-updated"));
                buildDesktop();

                const closeProgress = (progressWindowObj) => {
                    if (progressWindowObj && typeof progressWindowObj.close === "function") {
                        progressWindowObj.close();
                    }
                };
                setTimeout(closeProgress, 500, pg);
            }
        });
    }

    if (window.nexser?.isBooting) {
        iconsContainer.style.display = "none";
    } else {
        requestAnimationFrame(adjustDesktopIconArea);
    }

    window.dispatchEvent(new Event("desktop-ready"));
}

// タスクバー高さ・配置に応じてアイコン領域を調整
function adjustDesktopIconArea() {
    const desktop = document.getElementById("desktop");
    const iconsContainer = document.getElementById("desktop-icons");
    const taskbar = document.getElementById("taskbar");
    if (!desktop || !iconsContainer || !taskbar) return;

    if (window.nexser?.isBooting) {
        iconsContainer.style.display = "none";
        return;
    }

    const isWindowMode = taskbar.closest(".window") !== null;
    const rect = taskbar.getBoundingClientRect();

    let t = 0, b = 0, l = 0, r = 0;

    if (!isWindowMode) {
        // タスクバーの配置（垂直か水平か、画面のどちら側にあるか）を判定して余白を割り当て
        if (taskbar.classList.contains("vertical")) {
            const taskbarWidth = rect.width || taskbar.offsetWidth || 40;
            if (rect.left < window.innerWidth / 2) {
                l = taskbarWidth; // 左配置
            } else {
                r = taskbarWidth; // 右配置
            }
        } else {
            const taskbarHeight = rect.height || taskbar.offsetHeight || 40;
            if (rect.top < window.innerHeight / 2) {
                t = taskbarHeight; // 上配置
            } else {
                b = taskbarHeight; // 下配置
            }
        }
    }

    iconsContainer.style.position = "absolute";
    iconsContainer.style.top = `${t}px`;
    iconsContainer.style.bottom = `${b}px`;
    iconsContainer.style.left = `${l}px`;
    iconsContainer.style.right = `${r}px`;

    // 自動整列ON/OFFに応じて表示方式を切り替え、自由配置を維持する
    if (autoArrange) {
        iconsContainer.style.display = "flex";
        iconsContainer.style.flexDirection = "column";
        iconsContainer.style.flexWrap = "wrap";
        iconsContainer.style.alignContent = "flex-start";
        iconsContainer.style.overflow = "auto";
    } else {
        iconsContainer.style.display = "block";
        iconsContainer.style.overflow = "visible"; // 自由配置時ははみ出しを考慮
    }

    iconsContainer.style.padding = "10px"; // 内側余白
}

// --------------------
// 起動完了時やリサイズ時に確実に再計算させる仕組み
// --------------------
if (!window._desktopResizeObserver) {
    window._desktopResizeObserver = new ResizeObserver(() => {
        adjustDesktopIconArea();
    });
    window._desktopResizeObserver.observe(document.body);
}

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

    // 初期表示名の設定
    let baseName = itemType === "folder" ? "新規フォルダ" : "新しいテキスト.txt";
    let defaultName = getUniqueName(folderNode, baseName);

    const iconDiv = document.createElement("div");
    iconDiv.className = "icon";

    // 作成中もフォルダ/ファイルのアイコン（グラフィック）を表示する
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

    const finishEditing = async () => {
        if (isShowingError || isCommitting) return;
        isCommitting = true;

        let newName = input.value.trim() || defaultName;

        // バリデーション (fs-utils.js)
        const error = validateName(newName);
        if (error) {
            isCommitting = false;
            isShowingError = true;
            window.nexser?.windowAPI.alertWindow(error, { width: 360, height: 160, taskbar: false });
            setTimeout(() => {
                isShowingError = false;
                input.focus();
            }, 0);
            return;
        }

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

    // blur 時に入力を確定させる
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

    const normalizedParent = parentPath.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
    const isTrash =
        normalizedParent === "c:/trash" ||
        normalizedParent === "trash" ||
        normalizedParent.startsWith("c:/trash/") ||
        normalizedParent.startsWith("trash/");

    // --- ゴミ箱内からの完全消去の場合 ---
    if (isTrash) {
        try {
            const rawItem = parentNode[itemName];
            if (rawItem?.system === true) {
                throw new Error("Protected system item");
            }

            const cleanName = itemName.replace(/^\d+_/, "");
            const originalPath = rawItem.originalPath ? `${rawItem.originalPath}/${cleanName}` : cleanName;

            const success = delete parentNode[itemName];
            if (!success) throw new Error("Blocked by Proxy");

            const trashItemPath = `${parentPath.replace(/\/+$/, "")}/${itemName}`;
            await deleteFileContentRecursive(trashItemPath);
            await markDefaultDeleted(originalPath);

            if (dispatchEvent) {
                await forceSave();
                window.dispatchEvent(new Event("fs-updated"));
            }
            return true;
        } catch (e) {
            console.warn(`[Desktop Guard] 完全削除拒否: ${itemName}`);
            window.nexser?.windowAPI.alertWindow(`「${itemName}」は保護されているため削除できません。`, {
                title: "システム保護",
                width: 350,
                height: 160
            });
            return false;
        }
    }

    // --- 通常フォルダからゴミ箱への移動の場合 ---
    try {
        const rawItem = parentNode[itemName];
        if (!rawItem) return false;

        // システム保護アイテムは実データ退避前にブロック
        if (rawItem.system === true) {
            throw new Error("Protected system item");
        }

        const cleanParentPath = parentPath.replace(/\/+$/, "");
        const sourceFullPath = `${cleanParentPath}/${itemName}`;

        const targetItemData = cloneFSNode(rawItem);
        targetItemData.originalPath = cleanParentPath;

        const trashNode = resolveFS("C:/Trash");
        if (!trashNode) {
            const success = delete parentNode[itemName];
            if (!success) throw new Error("Blocked by Proxy");
            await markDefaultDeleted(sourceFullPath);
            if (dispatchEvent) {
                await forceSave();
                window.dispatchEvent(new Event("fs-updated"));
            }
            return true;
        }

        let targetName = itemName;
        if (trashNode[itemName]) {
            let counter = 1;
            const baseName = `${Date.now()}_${itemName}`;
            targetName = baseName;
            while (trashNode[targetName]) {
                targetName = `${baseName}_${counter++}`;
            }
        }

        const trashFullPath = `C:/Trash/${targetName}`;

        if (targetItemData.type === "file" || targetItemData.type === "app") {
            await moveFileContent(sourceFullPath, trashFullPath);
        } else if (targetItemData.type === "folder") {
            await processStorageRecursively(rawItem, sourceFullPath, trashFullPath, false);
        }

        // 仮想FSツリーから削除（排他ロック等で拒否された場合は実データを元のパスへロールバック）
        const success = delete parentNode[itemName];
        if (!success) {
            if (targetItemData.type === "file" || targetItemData.type === "app") {
                await moveFileContent(trashFullPath, sourceFullPath).catch(() => deleteFileContentRecursive(trashFullPath));
            } else if (targetItemData.type === "folder") {
                await processStorageRecursively(rawItem, trashFullPath, sourceFullPath, false).catch(() => deleteFileContentRecursive(trashFullPath));
            }
            throw new Error("Blocked by Proxy or File Lock");
        }

        trashNode[targetName] = targetItemData;
        await markDefaultDeleted(sourceFullPath);

        if (dispatchEvent) {
            await forceSave();
            window.dispatchEvent(new Event("fs-updated"));
        }
        return true;
    } catch (e) {
        console.warn(`[Desktop Guard] 削除拒否: ${itemName}`);
        window.nexser?.windowAPI.alertWindow(`「${itemName}」は保護されているため削除できません。`, {
            title: "システム保護",
            width: 350,
            height: 160
        });
        return false;
    }
}

function openFSItem(name, node, parentPath) {
    const resolved = resolveLinkTarget(node, `${parentPath}/${name}`);
    const targetNode = resolved.node;
    const targetPath = resolved.path;

    if (!targetNode) {
        window.nexser?.windowAPI.alertWindow("リンク先が見つかりません。");
        return;
    }

    // 実行タイプの特定
    const type = targetNode.type;
    const associatedApp = resolveAppByPath(targetPath);

    // アプリケーションの実行
    if (type === "app") {
        window.nexser?.kernelAPI.launch(targetPath, { path: targetPath, uniqueKey: targetPath });
        addRecent({ type: "app", path: targetPath });
    }
    // フォルダの展開
    else if (type === "folder") {
        window.nexser?.kernelAPI.launch("C:/Programs/Applications/Explorer.app", {
            path: targetPath,
            uniqueKey: targetPath,
            showFullPath: true
        });
        addRecent({ type: "folder", path: targetPath });
    }
    // ファイルの実行
    else if (type === "file") {
        if (associatedApp) {
            window.nexser?.kernelAPI.launch(associatedApp, { path: targetPath, node: targetNode, uniqueKey: targetPath });
        } else {
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
    window.addEventListener("fs-updated", async () => {
        // ログオフ中であれば一切再描画を行わない
        if (window.nexser?.isLoggingOff) return;

        // デスクトップのアイコンコンテナが非表示にされている場合は再描画をスキップ
        const iconsContainer = document.getElementById("desktop-icons");
        if (iconsContainer && iconsContainer.style.display === "none") return;

        // 更新時に拡張子設定も再取得して同期する
        try {
            const savedShowExt = await dbGet("explorerShowFileExtensions", "settings");
            if (savedShowExt !== undefined) {
                showFileExtensions = savedShowExt === true || savedShowExt === "true";
            }
        } catch (e) { }
        buildDesktop();
    });
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
        if (!active) return;

        // 1. 入力欄（リネーム中など）にフォーカスがある場合は即座に終了
        if (active.tagName === "INPUT" || active.tagName === "TEXTAREA") return;

        // 2. ウィンドウ（アプリ）内の要素にフォーカスがある場合は無視
        if (active.closest(".window")) return;

        // 3. デスクトップ要素の存在確認
        const desktop = document.getElementById("desktop");
        const iconsContainer = document.getElementById("desktop-icons");
        if (!desktop || !iconsContainer) return;

        // 4. デスクトップがアクティブな場合のみ処理
        const isDesktopFocused = (active === desktop);
        if (!isDesktopFocused) return;

        // --- 移動ロジック開始 ---
        const icons = Array.from(iconsContainer.querySelectorAll(".icon"));
        if (icons.length === 0) return;

        let currentIndex = icons.findIndex(el => el.classList.contains("selected"));

        const selectIcon = (targetEl) => {
            if (!targetEl) return;
            icons.forEach(el => el.classList.remove("selected"));

            targetEl.classList.add("selected");
            globalSelected.items.clear();
            globalSelected.items.add(targetEl);
            globalSelected.lastSelected = targetEl;
            globalSelected.item = targetEl;
            globalSelected.window = desktop;

            targetEl.scrollIntoView({ block: "nearest", inline: "nearest" });
        };

        // 物理的な距離で最適なアイコンを探す
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
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
            e.preventDefault();
            globalSelected.items.clear();
            icons.forEach(item => {
                item.classList.add("selected");
                globalSelected.items.add(item);
            });
            if (icons.length > 0) {
                globalSelected.lastSelected = icons[icons.length - 1];
            }
            globalSelected.item = globalSelected.items.size === 1 ? Array.from(globalSelected.items)[0] : null;
            return;
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
            if (globalSelected.items.size > 0) {
                e.preventDefault();
                const names = Array.from(globalSelected.items).map(el => el.dataset.name);
                setFSClipboard("copy", "C:/Desktop", names);
            }
            return;
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "x") {
            if (globalSelected.items.size > 0) {
                e.preventDefault();
                const desktopNode = FS["C:"]?.Desktop;
                const names = Array.from(globalSelected.items)
                    .map(el => el.dataset.name)
                    .filter(n => desktopNode?.[n]?.system !== true);
                if (names.length > 0) setFSClipboard("cut", "C:/Desktop", names);
            }
            return;
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
            e.preventDefault();
            await pasteClipboardToDesktop();
            return;
        }

        if (e.key === "F2" && globalSelected.items.size === 1) {
            e.preventDefault();
            const targetEl = Array.from(globalSelected.items)[0];
            startDesktopInlineRename(targetEl, targetEl.dataset.name);
            return;
        }

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
                if (globalSelected.items.size > 0) {
                    e.preventDefault();
                    const desktopNode = resolveFS("C:/Desktop");
                    if (desktopNode) {
                        globalSelected.items.forEach(selectedEl => {
                            const name = selectedEl.dataset.name;
                            const node = desktopNode[name];
                            if (node) openFSItem(name, node, "C:/Desktop");
                        });
                    }
                }
                break;
            case "Delete":
                if (globalSelected.items.size > 0) {
                    e.preventDefault();
                    const itemsToDelete = Array.from(globalSelected.items).map(item => item.dataset.name);
                    globalSelected.items.clear();
                    globalSelected.item = null;

                    setBulkUpdating(true);
                    try {
                        for (const name of itemsToDelete) {
                            await deleteFSItem("C:/Desktop", name, false);
                        }
                        await forceSave();
                    } finally {
                        setBulkUpdating(false);
                    }

                    window.dispatchEvent(new Event("fs-updated"));
                }
                break;
        }
    });

    isDesktopKeyHandlerAttached = true;
}

setupDesktopKeyboardNavigation();

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
        // 自動整列OFF時は自由配置にするためFlexを解除
        iconsContainer.style.display = "block";
    }
}

// --------------------
// ドラッグ移動によるデスクトップアイコン並び替え
// --------------------
function reorderDesktopIcons(draggedNames, targetName) {
    const desktopFS = FS["C:"].Desktop;
    if (!desktopFS) return;

    const keys = Object.keys(desktopFS).filter(k => !isSystemMetaKey(k));
    const draggedSet = new Set(draggedNames);

    // 移動先の位置を特定して順番を差し替え
    const remainingKeys = keys.filter(k => !draggedSet.has(k));
    const targetIdx = remainingKeys.indexOf(targetName);

    if (targetIdx !== -1) {
        remainingKeys.splice(targetIdx, 0, ...draggedNames);
    } else {
        remainingKeys.push(...draggedNames);
    }

    // C:/Desktop のメタデータ（children順序）のみをピンポイント差分保存
    reorderNodeKeys("C:/Desktop", remainingKeys);
}

// --------------------
// デスクトップ用 補助関数（リネーム・貼り付け・並べ替え・グリッド整列）
// --------------------
function getSelectedDesktopNames(fallbackItem) {
    if (globalSelected.items.size > 0 && globalSelected.items.has(fallbackItem)) {
        return Array.from(globalSelected.items).map(el => el.dataset.name);
    }
    return [fallbackItem.dataset.name];
}

async function pasteClipboardToDesktop() {
    const clip = getFSClipboard();
    const desktopNode = FS["C:"]?.Desktop;
    if (!clip || !desktopNode) return;

    const payload = {
        type: "explorer-icons",
        sourcePath: clip.sourcePath,
        draggedItems: clip.names.map(name => ({ name }))
    };
    const isCopy = clip.mode === "copy";
    const ok = await transferItemsToTarget(payload, "C:/Desktop", desktopNode, isCopy);
    if (ok && !isCopy) {
        clearFSClipboard();
    }
}

function startDesktopInlineRename(iconEl, oldName) {
    const node = FS["C:"]?.Desktop?.[oldName];
    if (!node || node.system === true) {
        window.nexser?.windowAPI?.alertWindow(`「${oldName}」は保護されているため名前を変更できません。`, { width: 350, height: 140 });
        return;
    }

    const labelEl = iconEl.querySelector(".icon-label");
    if (!labelEl || iconEl.querySelector("input")) return;

    const originalText = labelEl.textContent;
    labelEl.style.display = "none";

    const input = document.createElement("input");
    input.type = "text";
    input.value = oldName;
    input.style.cssText = "font-size:12px; text-align:center; width:96px; z-index:20; margin-top:2px;";
    iconEl.appendChild(input);
    input.focus();

    const dotIndex = oldName.lastIndexOf(".");
    if (node.type !== "folder" && dotIndex > 0) {
        input.setSelectionRange(0, dotIndex);
    } else {
        input.select();
    }

    let isDone = false;
    let isAlerting = false;

    const cleanup = () => {
        input.remove();
        labelEl.style.display = "";
    };

    const commit = async () => {
        if (isDone || isAlerting) return;
        const nextName = input.value.trim();
        if (!nextName || nextName === oldName) {
            isDone = true;
            cleanup();
            return;
        }

        const res = await renameFSItem("C:/Desktop", oldName, nextName);
        if (!res.ok) {
            isAlerting = true;
            window.nexser?.windowAPI?.alertWindow(res.error, { width: 360, height: 160, taskbar: false });
            setTimeout(() => {
                isAlerting = false;
                input.focus();
            }, 0);
            return;
        }

        isDone = true;
        cleanup();
    };

    input.addEventListener("mousedown", e => e.stopPropagation());
    input.addEventListener("click", e => e.stopPropagation());
    input.addEventListener("dblclick", e => e.stopPropagation());
    input.addEventListener("keydown", e => {
        e.stopPropagation();
        if (e.key === "Enter") {
            e.preventDefault();
            commit();
        } else if (e.key === "Escape") {
            isDone = true;
            cleanup();
        }
    });
    input.addEventListener("blur", commit);
}

function sortDesktopIcons(sortBy) {
    const desktopFS = FS["C:"]?.Desktop;
    if (!desktopFS) return;

    const keys = Object.keys(desktopFS).filter(k => !isSystemMetaKey(k));
    keys.sort((a, b) => {
        const nodeA = desktopFS[a];
        const nodeB = desktopFS[b];
        const isFolderA = nodeA?.type === "folder";
        const isFolderB = nodeB?.type === "folder";
        if (isFolderA !== isFolderB) return isFolderA ? -1 : 1;

        if (sortBy === "size") {
            return (nodeA?.size || 0) - (nodeB?.size || 0);
        }
        if (sortBy === "date") {
            return (nodeB?.lastModified || 0) - (nodeA?.lastModified || 0);
        }
        if (sortBy === "type") {
            const cmp = (nodeA?.type || "").localeCompare(nodeB?.type || "", "ja");
            if (cmp !== 0) return cmp;
        }
        return a.localeCompare(b, "ja");
    });

    reorderNodeKeys("C:/Desktop", keys);
    if (!autoArrange) {
        snapDesktopIconsToGrid(keys);
    }
}

async function snapDesktopIconsToGrid(orderedNames = null) {
    const desktopFS = FS["C:"]?.Desktop;
    const iconsContainer = document.getElementById("desktop-icons");
    if (!desktopFS || !iconsContainer) return;

    const names = orderedNames || Object.keys(desktopFS).filter(k => !isSystemMetaKey(k));
    const colWidth = 90;
    const rowHeight = 90;
    const maxRows = Math.max(1, Math.floor((iconsContainer.clientHeight - 20) / rowHeight));
    const occupied = new Set();
    const nextPositions = {};

    names.forEach((name, idx) => {
        const cur = iconPositions[name];
        let col = cur ? Math.max(0, Math.round((cur.x - 10) / colWidth)) : Math.floor(idx / maxRows);
        let row = cur ? Math.max(0, Math.min(maxRows - 1, Math.round((cur.y - 10) / rowHeight))) : (idx % maxRows);

        while (occupied.has(`${col},${row}`)) {
            row++;
            if (row >= maxRows) {
                row = 0;
                col++;
            }
        }
        occupied.add(`${col},${row}`);
        nextPositions[name] = { x: 10 + col * colWidth, y: 10 + row * rowHeight };
    });

    iconPositions = nextPositions;
    await dbSet("desktop_iconsPositions", iconPositions, "settings");
    buildDesktop();
}

window.addEventListener("fs-renamed", async (e) => {
    const { oldPath, oldName, newName } = e.detail || {};
    if (oldPath === `C:/Desktop/${oldName}` && !autoArrange && iconPositions[oldName]) {
        iconPositions[newName] = iconPositions[oldName];
        delete iconPositions[oldName];
        await dbSet("desktop_iconsPositions", iconPositions, "settings");
        buildDesktop();
    }
});

window.addEventListener("clipboard-updated", () => {
    const iconsContainer = document.getElementById("desktop-icons");
    if (!iconsContainer) return;
    iconsContainer.querySelectorAll(".icon").forEach(el => {
        el.style.opacity = isPathCutInClipboard("C:/Desktop", el.dataset.name) ? "0.5" : "1";
    });
});