// PDFViewer.js
import { resolveFS } from "../fs-utils.js";
import { setupRibbon } from "../ribbon.js";

function showWarning(root, message) {
    const win = root.closest(".window");
    window.nexser?.windowAPI.alertWindow(message, { title: "pdfviewer", parentWin: win });
}

function showConfirm(root, message, onYes, onNo) {
    const win = root.closest(".window");
    window.nexser?.windowAPI.showModalWindow("pdfviewer", message, {
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
    const { path, syscall } = options;
    const win = root.closest(".window");

    let isDisposed = false;
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
    let draftBlob = options.fileObject || null;
    let loadedContent = null;

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
       表示更新 (メモリ分離・Blob対応)
    ========================== */
    function refresh() {
        if (viewer.src.startsWith("blob:")) {
            URL.revokeObjectURL(viewer.src);
        }

        const content = (dirty && draftBlob) ? draftBlob : loadedContent;

        if (!content || content === "__EXTERNAL_DATA__") {
            viewer.removeAttribute("src");
            return;
        }

        if (content instanceof Blob || content instanceof File) {
            viewer.src = URL.createObjectURL(content);
        } else if (typeof content === "string") {
            viewer.src = content;
        } else if (content instanceof Uint8Array || content instanceof ArrayBuffer) {
            const blob = new Blob([content], { type: "application/pdf" });
            viewer.src = URL.createObjectURL(blob);
        } else {
            viewer.removeAttribute("src");
        }
    }

    function updateTitle() {
        window.nexser?.windowAPI.updateWindowTitle(win, baseTitle, dirty);
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
        保存処理 (syscall経由・Blob直接保存)
     ========================== */
    async function save() {
        if (!syscall?.writeFile) {
            showWarning(root, "システムコール (syscall.writeFile) が利用できません");
            return;
        }

        const dirPath = resolveFS("C:/Programs/Documents") ? "C:/Programs/Documents" : "C:/Programs";
        const targetDir = resolveFS(dirPath);
        if (!targetDir) {
            showWarning(root, "保存先ディレクトリが見つかりません");
            return;
        }

        const treatAsNew = !filePath || filePath.toLowerCase().endsWith("pdfviewer.app");
        const dataToSave = draftBlob || loadedContent;

        /* 上書き保存 */
        if (!treatAsNew) {
            if (!dirty || !dataToSave) return;

            try {
                await syscall.writeFile(filePath, dataToSave);
                loadedContent = dataToSave;
                dirty = false;
                draftBlob = null;

                refresh();
                updateTitle();
            } catch (err) {
                console.error("[PDFViewer] Save failed:", err);
                showWarning(root, `保存に失敗しました: ${err.message}`);
            }
            return;
        }

        if (!dataToSave) {
            showWarning(root, "保存するPDFデータがありません");
            return;
        }

        async function askFileName(defaultName) {
            return new Promise(resolve => {
                const content = window.nexser?.windowAPI.showModalWindow("新規保存", "PDFのファイル名を入力してください", {
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
        finalName = name.trim();

        if (targetDir[finalName]) {
            showWarning(root, "同名のファイルが存在します");
            return;
        }

        const newFilePath = `${dirPath}/${finalName}`;
        try {
            await syscall.writeFile(newFilePath, dataToSave);

            /* 内部状態の更新（既存ウィンドウとカーネルプロセス管理を維持） */
            filePath = newFilePath;
            fileNode = resolveFS(newFilePath);
            loadedContent = dataToSave;
            baseTitle = finalName;
            dirty = false;
            draftBlob = null;

            refresh();
            updateTitle();
        } catch (err) {
            console.error("[PDFViewer] Save as new failed:", err);
            showWarning(root, `保存に失敗しました: ${err.message}`);
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
        初期化 (syscall.readFile経由)
     ========================== */
    async function init() {
        if (filePath && !filePath.toLowerCase().endsWith("pdfviewer.app") && syscall?.readFile) {
            try {
                const content = await syscall.readFile(filePath);
                if (isDisposed) return;
                loadedContent = content;
            } catch (err) {
                console.error("[PDFViewer] Read failed:", err);
                showWarning(root, `PDFの読み込みに失敗しました: ${err.message}`);
            }
        }
        refresh();
        updateTitle();
    }

    // ハンドル関数として定義
    function handleKeyDown(e) {
        if (e.ctrlKey && e.key.toLowerCase() === "s") {
            e.preventDefault();
            save();
        }
    }
    window.addEventListener("keydown", handleKeyDown);

    init();

    function dispose() {
        isDisposed = true;

        // 1. キーイベントの解約（メモリリーク防止）
        window.removeEventListener("keydown", handleKeyDown);

        // 現在のsrc文字列を退避
        const currentSrc = viewer.src;

        // 2. DOMから切り離し
        viewer.removeAttribute("src");
        if (viewer.parentNode) {
            viewer.parentNode.removeChild(viewer);
        }

        // 3. Blob URL解放
        if (currentSrc && currentSrc.startsWith("blob:")) {
            URL.revokeObjectURL(currentSrc);
        }
    }

    return {
        dispose
    };
}