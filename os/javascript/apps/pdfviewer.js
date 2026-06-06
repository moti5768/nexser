// PDFViewer.js
import { resolveFS } from "../fs-utils.js";
import { createWindow, bringToFront, showModalWindow, alertWindow, taskbarButtons, updateWindowTitle } from "../window.js";
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
   PDFViewer
========================= */
export default function PDFViewer(root, options = {}) {
    const { path } = options;
    const win = root.closest(".window");

    let filePath = path || null;
    let fileNode = filePath ? resolveFS(filePath) : null;

    let baseTitle;
    if (filePath) {
        baseTitle = filePath.split("/").pop().trim();
    } else if (options.fileObject instanceof File) {
        baseTitle = options.fileObject.name;
    } else {
        const untitledId = Date.now().toString(36);
        baseTitle = `Untitled-${untitledId}.pdf`;
    }

    let dirty = false;
    let draftBlob = null;

    /* =========================
       UI
    ========================== */
    root.innerHTML = `
    <div style="width:100%;height:100%;background:#525659;display:flex;flex-direction:column;overflow:hidden;">
        <embed class="pdf-render" type="application/pdf" style="width:100%;height:100%;border:none;" />
    </div>
    `;

    const viewer = root.querySelector(".pdf-render");

    /* =========================
       表示更新
    ========================== */
    function refresh() {
        if (viewer.src.startsWith('blob:')) {
            URL.revokeObjectURL(viewer.src);
        }

        let content = null;
        if (dirty && draftBlob) {
            content = draftBlob;
        } else if (fileNode?.content) {
            content = fileNode.content;
        }

        if (content) {
            if (content instanceof Blob || content instanceof File) {
                viewer.src = URL.createObjectURL(content);
            } else if (typeof content === "string") {
                viewer.src = content;
            } else if (content instanceof Uint8Array || content instanceof ArrayBuffer) {
                const blob = new Blob([content], { type: "application/pdf" });
                viewer.src = URL.createObjectURL(blob);
            }
        } else {
            viewer.removeAttribute("src");
        }
    }

    function updateTitle() {
        updateWindowTitle(win, baseTitle, dirty);
    }

    /* =========================
       ファイル操作
    ========================== */
    function openPDFFile() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/pdf";
        input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;
            handleFileLoading(file);
        };
        input.click();
    }

    function handleFileLoading(file) {
        if (!file.type.includes("pdf")) {
            showWarning(root, "PDFファイルを選択してください");
            return;
        }
        draftBlob = file;
        dirty = true;
        baseTitle = file.name;
        refresh();
        updateTitle();
    }

    root.addEventListener("dragover", e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        root.style.outline = "2px dashed #4A90E2";
    });

    root.addEventListener("dragleave", () => {
        root.style.outline = "none";
    });

    root.addEventListener("drop", e => {
        e.preventDefault();
        root.style.outline = "none";
        const file = e.dataTransfer.files[0];
        if (file) handleFileLoading(file);
    });

    /* =========================
       保存処理 (ImageViewer互換)
    ========================== */
    async function save() {
        const targetDir = resolveFS("Programs/Documents") || resolveFS("Programs");
        if (!targetDir) {
            showWarning(root, "保存先ディレクトリが見つかりません");
            return;
        }

        const treatAsNew = !fileNode || (filePath && filePath.toLowerCase().endsWith("pdfviewer.app"));

        /* 上書き保存 */
        if (!treatAsNew) {
            if (!dirty) return;
            const dataToSave = draftBlob || fileNode?.content;
            if (!dataToSave) return;

            if (dataToSave instanceof File || dataToSave instanceof Blob) {
                fileNode.content = await blobToDataURL(dataToSave);
            } else {
                fileNode.content = dataToSave;
            }
            fileNode.type = "file";

            dirty = false;
            draftBlob = null;

            refresh();
            updateTitle();
            window.dispatchEvent(new Event("fs-updated"));
            return;
        }

        /* 新規保存プロンプト (★ここを修正しました) */
        async function askFileName(defaultName) {
            return new Promise(resolve => {
                const content = showModalWindow("新規保存", "PDFのファイル名を入力してください", {
                    parentWin: win,
                    silent: true,
                    buttons: [
                        {
                            label: "OK",
                            onClick: () => {
                                const input = content.querySelector(".modal-prompt-input");
                                resolve(input ? input.value : defaultName);
                            }
                        },
                        { label: "キャンセル", onClick: () => resolve(null) }
                    ]
                });

                let promptInput = content.querySelector(".modal-prompt-input");
                if (!promptInput) {
                    promptInput = document.createElement("input");
                    promptInput.className = "modal-prompt-input";
                    promptInput.type = "text";
                    promptInput.style.cssText = "width:100%; margin-top:10px; box-sizing:border-box; padding:4px;";

                    // ImageViewer.jsと同様の安全な挿入ロジック
                    const btnContainer = content.querySelector(".modal-button-container") || content.lastElementChild;
                    if (btnContainer && btnContainer.parentNode === content) {
                        content.insertBefore(promptInput, btnContainer);
                    } else {
                        content.appendChild(promptInput);
                    }
                }
                promptInput.value = defaultName;
                setTimeout(() => promptInput.focus(), 10);
            });
        }

        let finalName = baseTitle;
        let idx = 1;
        while (targetDir[finalName]) {
            finalName = baseTitle.replace(/\.pdf$/i, "") + ` (${idx++}).pdf`;
        }

        const name = await askFileName(finalName);
        if (!name) return;
        finalName = name;

        const newNode = {
            type: "file",
            content: draftBlob instanceof File ? await blobToDataURL(draftBlob) : draftBlob
        };

        targetDir[finalName] = newNode;
        const newFilePath = `Programs/Documents/${finalName}`;
        window.dispatchEvent(new Event("fs-updated"));

        /* ウィンドウの再生成 (ImageViewer同様) */
        if (win) {
            const oldWin = win;
            const oldBtn = oldWin._taskbarBtn;

            const newRoot = createWindow(finalName, { width: 700, height: 500 });

            oldWin.parentElement.replaceChild(newRoot.parentElement, root.parentElement);
            PDFViewer(newRoot, { path: newFilePath });

            // タスクバー管理のクリーンアップ (ImageViewer準拠)
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
        const menus = [
            {
                title: "File",
                items: [
                    { label: "PDFを開く...", action: openPDFFile },
                    { label: "保存", action: save }
                ]
            }
        ];
        setupRibbon(win, () => filePath, null, menus);
    }

    /* =========================
       終了確認
    ========================== */
    const closeBtn = win?.querySelector(".close-btn");
    function closeWindow() { closeBtn?.click(); }

    function requestClose() {
        if (!dirty) { closeWindow(); return; }

        showConfirm(
            root,
            "変更が保存されていません。\n保存しますか？",
            async () => { await save(); closeWindow(); },
            () => { dirty = false; updateTitle(); closeWindow(); }
        );
    }

    closeBtn?.addEventListener("click", e => {
        if (!dirty) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        requestClose();
    }, true);

    /* =========================
       ユーティリティ & 初期化
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
            if (fileNode.content === "__EXTERNAL_DATA__") {
                fileNode.content = await getFileContent(filePath);
            }
        }
        refresh();
        updateTitle();
    }

    window.addEventListener("keydown", e => {
        if (e.ctrlKey && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
    });

    init();
}