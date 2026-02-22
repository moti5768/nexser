// ImageViewer.js
import { resolveFS } from "../fs-utils.js";
import { createWindow, bringToFront, showModalWindow, alertWindow, taskbarButtons } from "../window.js";
import { buildDesktop } from "../desktop.js";
import { setupRibbon } from "../ribbon.js";
import { getFileContent } from "../fs-db.js";

function showWarning(root, message) {
    const win = root.closest(".window");
    alertWindow(message, { parentWin: win });
}

function showConfirm(root, message, onYes, onNo) {
    const win = root.closest(".window");
    showModalWindow("Confirm", message, {
        parentWin: win,
        iconClass: "warning_icon",
        buttons: [
            { label: "はい", onClick: onYes },
            { label: "いいえ", onClick: onNo }
        ]
    });
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

    let baseTitle;

    if (filePath) {
        // 保存済みファイルならファイル名を使う
        baseTitle = filePath.split("/").pop().trim();
    } else if (options.fileObject instanceof File) {
        // 新規でFileオブジェクトを開いた場合、元の名前を使う
        baseTitle = options.fileObject.name;
    } else {
        // 完全新規作成の場合
        const untitledId = Date.now().toString(36);
        baseTitle = `Untitled-${untitledId}.png`;
    }

    let dirty = false;
    let draftImage = null;

    /* =========================
       UI
    ========================== */
    root.innerHTML = `
    <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#222;overflow:hidden;">
        <img style="max-width:100%;max-height:100%;object-fit:contain;transition: transform 0.2s;" />
    </div>
`;

    const img = root.querySelector("img");

    /* =========================
    回転機能 (Canvasを使用してピクセルを操作)
========================== */
    function rotateImage(direction = 90) {
        if (!img.src) return;

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        const source = draftImage instanceof Blob ? URL.createObjectURL(draftImage) : img.src;
        const tempImg = new Image();

        tempImg.onload = () => {
            // 90/270度回転なら縦横入れ替え
            if (Math.abs(direction) % 180 === 90) {
                canvas.width = tempImg.height;
                canvas.height = tempImg.width;
            } else {
                canvas.width = tempImg.width;
                canvas.height = tempImg.height;
            }

            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate((direction * Math.PI) / 180);
            ctx.drawImage(tempImg, -tempImg.width / 2, -tempImg.height / 2);

            canvas.toBlob(blob => {
                const newURL = URL.createObjectURL(blob);
                draftImage = blob;
                dirty = true;

                // 古い URL を revoke は img.onload 後に
                const oldSrc = img.src;
                img.onload = () => {
                    if (draftImage instanceof Blob && oldSrc.startsWith("blob:")) {
                        URL.revokeObjectURL(oldSrc);
                    }
                };
                img.src = newURL;

                updateTitle();
            }, "image/png");

            if (source.startsWith("blob:")) URL.revokeObjectURL(source); // tempImg 用
        };
        tempImg.src = source;
    }

    /* =========================
       表示更新（多形式対応）
    ========================== */
    function refresh() {
        // 前回のBlob URLがあれば解放してメモリリークを防ぐ
        if (img.src.startsWith('blob:')) {
            URL.revokeObjectURL(img.src);
        }

        if (dirty && draftImage) {
            if (draftImage instanceof File) {
                img.src = URL.createObjectURL(draftImage);
            } else {
                img.src = draftImage; // DataURL (回転後はこちらに入る)
            }
        } else if (fileNode?.content) {
            const content = fileNode.content;

            if (typeof content === "string") {
                if (content.startsWith("data:")) {
                    img.src = content;
                } else if (/^(https?|file):\/\//i.test(content)) {
                    img.src = content;
                } else {
                    const blob = new Blob([content], { type: "image/png" });
                    img.src = URL.createObjectURL(blob);
                }
            } else if (content instanceof File || content instanceof Blob) {
                img.src = URL.createObjectURL(content);
            } else if (content instanceof Uint8Array || content instanceof ArrayBuffer) {
                const blob = new Blob([content], { type: "image/png" });
                img.src = URL.createObjectURL(blob);
            }
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
       画像読み込み（Fileオブジェクト直接対応）
    ========================== */
    function openImageFile() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";

        input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;

            draftImage = file; // Fileオブジェクト直接保持
            dirty = true;

            // 新規ファイルの場合は baseTitle を更新
            baseTitle = file.name;

            refresh();
            updateTitle();
        };
        input.click();
    }

    /* =========================
   ドラッグ＆ドロップで画像を開く
========================= */
    root.addEventListener("dragover", e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        root.style.outline = "2px dashed #aaa"; // 視覚的にドロップ領域を表示
    });

    root.addEventListener("dragleave", e => {
        e.preventDefault();
        root.style.outline = "none";
    });

    root.addEventListener("drop", e => {
        e.preventDefault();
        root.style.outline = "none";

        const file = e.dataTransfer.files[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            showWarning(root, "画像ファイルをドロップしてください");
            return;
        }

        draftImage = file; // Fileオブジェクトとして保持
        dirty = true;
        baseTitle = file.name;

        refresh();
        updateTitle();
    });


    /* =========================
       保存処理
    ========================== */
    async function save() {
        const desktop = resolveFS("Desktop");
        if (!desktop) {
            showWarning(root, "Desktop が見つかりません");
            return;
        }

        const treatAsNew = !fileNode || (filePath && filePath.toLowerCase().endsWith("imageviewer.app"));

        /* 上書き保存 */
        if (!treatAsNew) {
            if (!dirty) return;
            const dataToSave = draftImage || fileNode?.content;
            if (!dataToSave) return;

            // 常に DataURL に統一
            if (dataToSave instanceof File || dataToSave instanceof Blob) {
                fileNode.content = await blobToDataURL(dataToSave);
            } else {
                fileNode.content = dataToSave;
            }
            fileNode.type = "file";

            dirty = false;
            draftImage = null;

            refresh();
            updateTitle();
            buildDesktop();
            window.dispatchEvent(new Event("fs-updated"));
            return;
        }

        /* 新規保存 */
        let finalName = baseTitle;

        async function askFileName(defaultName) {
            return new Promise(resolve => {
                const content = showModalWindow("新規保存", "ファイル名を入力してください", {
                    parentWin: win,
                    silent: true,
                    buttons: [
                        {
                            label: "OK",
                            onClick: () => {
                                // resolveを実行する直前に、現在のDOMから最新の入力を取得する
                                const currentInput = content.querySelector(".modal-prompt-input");
                                resolve(currentInput ? currentInput.value : defaultName);
                            }
                        },
                        { label: "キャンセル", onClick: () => resolve(null) }
                    ]
                });

                // 1. 既に存在するかチェック (識別用のクラス名 .modal-prompt-input を使用)
                let promptInput = content.querySelector(".modal-prompt-input");

                // 2. 存在しない場合のみ新しく作る
                if (!promptInput) {
                    promptInput = document.createElement("input");
                    promptInput.className = "modal-prompt-input"; // クラス名を付与して識別可能にする
                    promptInput.type = "text";
                    promptInput.style.width = "100%";
                    promptInput.style.marginTop = "10px";
                    promptInput.style.boxSizing = "border-box";
                    promptInput.style.padding = "4px";

                    const btnContainer = content.querySelector(".modal-button-container") || content.lastElementChild;
                    if (btnContainer) {
                        content.insertBefore(promptInput, btnContainer);
                    } else {
                        content.appendChild(promptInput);
                    }
                }

                // 3. 常に最新のデフォルト値をセットしてフォーカス
                promptInput.value = defaultName;
                setTimeout(() => promptInput.focus(), 10);
            });
        }

        let idx = 1;
        while (desktop[finalName]) {
            finalName = baseTitle.replace(/\.(png|jpg|jpeg)$/i, "") + ` (${idx++}).png`;
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
            content: draftImage instanceof File ? await blobToDataURL(draftImage) : draftImage
        };
        desktop[finalName] = newNode;

        const newFilePath = `Desktop/${finalName}`;

        buildDesktop();
        window.dispatchEvent(new Event("fs-updated"));

        /* ウィンドウ置き換え */
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

            // draftImage を引き継いで再表示
            ImageViewer(newRoot, { path: newFilePath });
            if (draftImage) {
                const newWinImg = newRoot.querySelector("img");
                if (newWinImg) {
                    if (draftImage instanceof File) {
                        newWinImg.src = URL.createObjectURL(draftImage);
                    } else {
                        newWinImg.src = draftImage;
                    }
                }
            }

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
                title: "Edit",
                items: [
                    { label: "右に90度回転", action: () => rotateImage(90) },
                    { label: "左に90度回転", action: () => rotateImage(-90) }
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

    /* =========================
       ユーティリティ
    ========================== */
    async function blobToDataURL(blob) {
        return new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    }
    async function init() {
        if (filePath && fileNode) {
            let content = fileNode.content;

            // ★ ここが重要：外部データなら取得する
            if (content === "__EXTERNAL_DATA__") {
                content = await getFileContent(filePath);
                // メモリ上でも展開しておく
                fileNode.content = content;
            }

            if (content) {
                img.src = content;
            }
        }
    }
    init(); // 実行
}