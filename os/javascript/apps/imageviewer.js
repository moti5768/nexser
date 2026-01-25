// ImageViewer.js
import { resolveFS } from "../fs-utils.js";
import { createWindow, bringToFront, taskbarButtons } from "../window.js";
import { buildDesktop } from "../desktop.js";
import { setupRibbon } from "./explorer.js";

/* =========================
   警告・確認ダイアログ管理（TextEditor流用）
========================= */
function showModalDialog(root, title, message, buttons = []) {
    const win = root.closest(".window");
    if (!win) return;

    bringToFront(win);

    if (!win._activeDialogs) win._activeDialogs = new Set();
    if (win._activeDialogs.has(message)) return;
    win._activeDialogs.add(message);

    win.style.pointerEvents = "none";

    const content = createWindow(title, {
        width: 320,
        height: 150,
        disableControls: true,
        hideRibbon: true,
        hideStatus: true,
        taskbar: false,
        skipSave: true,
        skipFocus: true
    });

    const dialogWin = content.parentElement;
    dialogWin.classList.add("modal-dialog");
    dialogWin.style.zIndex = parseInt(win.style.zIndex || 1) + 1000;
    dialogWin.style.pointerEvents = "all";
    dialogWin.style.position = "absolute";

    const rect = win.getBoundingClientRect();
    dialogWin.style.left = rect.left + rect.width / 2 - 160 + "px";
    dialogWin.style.top = rect.top + rect.height / 2 - 75 + "px";

    document.body.appendChild(dialogWin);

    content.innerHTML = `
        <p>${message}</p>
        <div style="text-align:center;margin-top:12px;"></div>
    `;
    const container = content.querySelector("div");

    function closeDialog(callback) {
        dialogWin.remove();
        win._activeDialogs.delete(message);
        win.style.pointerEvents = "auto";
        if (typeof callback === "function") callback();
    }

    buttons.forEach(btn => {
        const b = document.createElement("button");
        b.textContent = btn.label;
        b.style.margin = "0 4px";
        b.onclick = () => closeDialog(btn.onClick);
        container.appendChild(b);
    });

    const closeBtn = dialogWin.querySelector(".close-btn");
    if (closeBtn) closeBtn.onclick = () => closeDialog();

    const observer = new MutationObserver(() => {
        if (!document.body.contains(win)) {
            closeDialog();
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return content;
}

function showWarning(root, message) {
    showModalDialog(root, "Warning", message, [
        { label: "OK", onClick: null }
    ]);
}

function showConfirm(root, message, onYes, onNo) {
    showModalDialog(root, "Confirm", message, [
        { label: "はい", onClick: onYes },
        { label: "いいえ", onClick: onNo }
    ]);
}

/* =========================
   ImageViewer
========================= */
export default function ImageViewer(root, options = {}) {
    const { path } = options;
    const win = root.closest(".window");
    const titleEl = win?.querySelector(".title-text");

    let filePath = path || null;
    let fileNode = filePath ? resolveFS(filePath) : null;

    const untitledId = Date.now().toString(36);
    let baseTitle =
        filePath?.split("/").pop()?.trim() ||
        `Untitled-${untitledId}.png`;

    let dirty = false;
    let draftImage = null;

    /* =========================
       UI
    ========================== */
    root.innerHTML = `
        <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#222;">
            <img style="max-width:100%;max-height:100%;object-fit:contain;" />
        </div>
    `;

    const img = root.querySelector("img");

    function refresh() {
        if (dirty && draftImage) {
            img.src = draftImage;
        } else if (fileNode?.content) {
            img.src = fileNode.content;
        } else {
            img.removeAttribute("src");
        }
    }
    refresh();

    function updateTitle() {
        const title = dirty ? `${baseTitle} *` : baseTitle;
        if (typeof win?.setTitle === "function") win.setTitle(title);
        else if (titleEl) titleEl.textContent = title;
    }
    updateTitle();

    /* =========================
       画像読み込み（まだ保存しない）
    ========================== */
    function openImageFile() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";

        input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = () => {
                draftImage = reader.result;
                dirty = true;
                refresh();
                updateTitle();
            };
            reader.readAsDataURL(file);
        };
        input.click();
    }

    /* =========================
       保存処理（TextEditor互換）
    ========================== */
    async function save() {
        const desktop = resolveFS("Desktop");
        if (!desktop) {
            showWarning(root, "Desktop が見つかりません");
            return;
        }

        // TextEditor と同じ思想
        const treatAsNew =
            !fileNode ||
            (filePath && filePath.toLowerCase().endsWith("imageviewer.app"));

        /* ===== 上書き保存 ===== */
        if (!treatAsNew) {
            if (!dirty) return;

            // draftImage が無い場合は、現在表示されている内容を保存対象にする
            const dataToSave = draftImage || fileNode?.content;
            if (!dataToSave) return;

            fileNode.type = "file";
            fileNode.content = dataToSave;

            dirty = false;
            draftImage = null;

            refresh();
            updateTitle();
            buildDesktop();
            window.dispatchEvent(new Event("fs-updated"));
            return;
        }

        /* ===== 新規保存 ===== */
        let finalName = baseTitle;

        async function askFileName(defaultName) {
            return new Promise(resolve => {
                const dialogContent = showModalDialog(
                    root,
                    "新規ファイル名",
                    "ファイル名を入力してください",
                    [
                        { label: "OK", onClick: () => resolve(promptInput.value) },
                        { label: "キャンセル", onClick: () => resolve(null) }
                    ]
                );

                const promptInput = document.createElement("input");
                promptInput.type = "text";
                promptInput.value = defaultName;
                promptInput.style.width = "95%";

                const container = dialogContent.querySelector("div");
                container.prepend(promptInput);
                promptInput.focus();
            });
        }

        let idx = 1;
        while (desktop[finalName]) {
            finalName =
                baseTitle.replace(/\.(png|jpg|jpeg)$/i, "") +
                ` (${idx++}).png`;
        }

        const name = await askFileName(finalName);
        if (!name) return;
        finalName = name;

        if (desktop[finalName]) {
            showWarning(root, "同名のファイルが存在します");
            return;
        }

        const newNode = {
            type: "file",
            content: draftImage
        };

        desktop[finalName] = newNode;

        const newFilePath = `Desktop/${finalName}`;

        buildDesktop();
        window.dispatchEvent(new Event("fs-updated"));

        /* ===== ウィンドウ置き換え ===== */
        if (win) {
            const oldWin = win;
            const oldRoot = root;
            const oldBtn = oldWin._taskbarBtn;

            const newRoot = createWindow(finalName, {
                width: 600,
                height: 400
            });

            oldWin.parentElement.replaceChild(
                newRoot.parentElement,
                oldRoot.parentElement
            );

            ImageViewer(newRoot, { path: newFilePath });

            if (oldBtn && Array.isArray(taskbarButtons)) {
                oldBtn.remove();
                const i = taskbarButtons.indexOf(oldBtn);
                if (i !== -1) taskbarButtons.splice(i, 1);
                oldBtn._window = null;
                oldWin._taskbarBtn = null;
            }

            bringToFront(newRoot.closest(".window"));
        }
    }

    /* =========================
       リボンUI
    ========================== */
    if (win) {
        const ribbonMenus = [
            {
                title: "Window", items: [
                    { label: "最小化", action: () => win.querySelector(".min-btn")?.click() },
                    { label: "最大化 / 元のサイズに戻す", action: () => win.querySelector(".max-btn")?.click() },
                    { label: "閉じる", action: () => win.querySelector(".close-btn")?.click() }
                ]
            },
            {
                title: "File",
                items: [
                    { label: "画像を開く...", action: openImageFile },
                    { label: "保存", action: save }
                ]
            }
        ];
        setupRibbon(win, () => filePath, null, ribbonMenus);
    }

    /* =========================
       未保存クローズ確認
    ========================== */
    const closeBtn = win?.querySelector(".close-btn");

    function closeWindow() {
        closeBtn?.click();
    }

    function requestClose() {
        if (!dirty) {
            closeWindow();
            return;
        }

        if (win && !win.classList.contains("modal-dialog")) {
            win.classList.add("modal-dialog");
        }

        showConfirm(
            root,
            "変更された画像が保存されていません。\n保存しますか？",
            async () => {
                await save();
                closeWindow();
            },
            () => {
                dirty = false;
                updateTitle();
                closeWindow();
            }
        );
    }

    closeBtn?.addEventListener(
        "click",
        e => {
            if (!dirty) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            requestClose();
        },
        true
    );

    window.addEventListener("keydown", e => {
        if (e.ctrlKey && e.key.toLowerCase() === "s") {
            e.preventDefault();
            save();
        }
        if (e.altKey && e.key === "F4") {
            e.preventDefault();
            requestClose();
        }
    });
}
