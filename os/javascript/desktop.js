// desktop.js
import { FS } from "./fs.js";
import { launch } from "./kernel.js";
import { createWindow, alertWindow } from "./window.js";
import { resolveFS, validateName } from "./fs-utils.js";
import { addRecent } from "./recent.js";
import { attachContextMenu } from "./context-menu.js";
import { resolveAppByPath } from "./file-associations.js";
import { openWithDialog as explorerOpenWithDialog } from "./apps/explorer.js";

// 選択状態管理
let globalSelected = { item: null, window: null };

// --------------------
// デスクトップ描画
// --------------------
export function buildDesktop() {
    const desktop = document.getElementById("desktop");
    if (!desktop) return;

    let iconsContainer = document.getElementById("desktop-icons");
    if (!iconsContainer) {
        iconsContainer = document.createElement("div");
        iconsContainer.id = "desktop-icons";
        desktop.appendChild(iconsContainer);
    }
    iconsContainer.innerHTML = ""; // 初期化

    // --------------------
    // アイコン作成
    // --------------------
    function createIcon(name, node) {
        const item = document.createElement("div");
        item.className = "icon";
        item.textContent = name;
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
                    disabled: isFolder,
                    action: () => { if (!isFolder) explorerOpenWithDialog(fullPath, node); }
                }
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
                    const name = globalSelected.item.textContent;
                    deleteFSItem("Desktop", name);
                    globalSelected.item = null;
                }
            }
        });

        // 選択アイテムがあれば「プログラムから開く」
        if (globalSelected.item) {
            const name = globalSelected.item.textContent;
            const node = desktopNode[name];
            const isFolder = node?.type === "folder";
            items.push({
                label: "プログラムから開く",
                disabled: isFolder,
                action: () => { if (!isFolder) explorerOpenWithDialog(`Desktop/${name}`, node); }
            });
        }

        return items;
    });
    adjustDesktopIconArea();
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
// 新規フォルダ作成
// --------------------
function createNewFolder(currentPath, container) {
    const folderNode = resolveFS(currentPath);
    if (!folderNode || !container) return;

    let folderName = "新しいフォルダ";
    let counter = 1;
    while (folderNode[folderName]) folderName = `新しいフォルダ (${counter++})`;

    const iconDiv = document.createElement("div");
    iconDiv.className = "icon";
    container.appendChild(iconDiv);

    const input = document.createElement("input");
    input.type = "text";
    input.value = folderName;
    input.style.fontSize = "13px";
    input.style.textAlign = "left"; // ← 左寄せ
    input.style.width = "auto";
    input.style.minWidth = "100px";
    iconDiv.appendChild(input);
    input.focus();
    input.select();

    // 幅を文字数に応じて自動調整
    const adjustWidth = () => {
        input.style.width = `${Math.max(input.value.length * 8, 100)}px`;
    };

    // 初期幅調整
    adjustWidth();

    // 入力中も幅を自動更新
    input.addEventListener("input", adjustWidth);

    let isShowingError = false;
    let isCommitting = false;

    const finishEditing = () => {

        if (isShowingError || isCommitting) return;
        isCommitting = true;   // 👈 blurを無効化する

        let newName = input.value.trim() || folderName;
        const error = validateName(newName);

        if (error) {
            isCommitting = false;   // 👈 エラー時は解除
            isShowingError = true;

            alertWindow(error, { width: 360, height: 160, taskbar: false });

            setTimeout(() => {
                isShowingError = false;
                input.focus();
                input.select();
            }, 0);

            return;
        }

        // --- 正常処理 ---
        iconDiv.remove();
        let finalName = newName;
        let idx = 1;
        while (folderNode[finalName]) finalName = `${newName} (${idx++})`;

        const tempPath = `${currentPath}/${finalName}`;
        const isFile = !!resolveAppByPath(tempPath);
        folderNode[finalName] = isFile
            ? { type: "file", content: "" }
            : { type: "folder" };

        buildDesktop();
        window.dispatchEvent(new Event("fs-updated"));
    };


    input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); finishEditing(); } });
    input.addEventListener("blur", () => {
        if (isShowingError || isCommitting) return;    // アラート中は無視
        iconDiv.remove();            // 編集UIだけ消す
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

// --------------------
// ファイル/フォルダ開く（ダブルクリック用）
// --------------------
function openFSItem(name, node, parentPath) {
    let targetNode = node;
    let targetPath = `${parentPath}/${name}`;
    let type = targetNode.type;

    if (type === "link") {
        targetPath = targetNode.target;
        targetNode = resolveFS(targetPath);
        if (!targetNode) return;
        type = targetNode.type;
    }

    if (targetNode.shell) return;

    const associatedApp = resolveAppByPath(targetPath);
    if (type === "folder" && associatedApp) type = "file";

    switch (type) {
        case "app":
            launch(targetPath, { path: targetPath, uniqueKey: targetPath });
            addRecent({ type: "app", path: targetPath });
            break;
        case "file":
            if (associatedApp) launch(associatedApp, { path: targetPath, node: targetNode, uniqueKey: targetPath });
            else import("./apps/fileviewer.js").then(mod => {
                const content = createWindow(name);
                mod.default(content, { name, content: targetNode.content });
            });
            addRecent({ type: "file", path: targetPath });
            break;
        case "folder":
            launch("Programs/Explorer.app", { path: targetPath, uniqueKey: targetPath, showFullPath: false });
            addRecent({ type: "folder", path: targetPath });
            break;
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

// タスクバーの高さが変わったらアイコン領域を再調整
window.addEventListener("desktop-resize", adjustDesktopIconArea);
