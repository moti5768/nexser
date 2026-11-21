// VideoPlayer.js
import { resolveFS, basename } from "../fs-utils.js";
import { setupRibbon } from "../ribbon.js";

function showWarning(root, message) {
    const win = root.closest(".window");
    window.nexser?.windowAPI.alertWindow(message, { title: "videoplayer", parentWin: win });
}

function showConfirm(root, message, onYes, onNo) {
    const win = root.closest(".window");
    window.nexser?.windowAPI.showModalWindow("videoplayer", message, {
        parentWin: win,
        iconClass: "warning_icon",
        buttons: [
            { label: "はい", onClick: onYes },
            { label: "いいえ", onClick: onNo }
        ]
    });
}

export default function VideoPlayer(root, options = {}) {
    let isDisposed = false;
    const { path, syscall } = options;
    const win = root.closest(".window");
    const titleEl = win?.querySelector(".title-text");

    let filePath = path || null;
    let fileNode = filePath ? resolveFS(filePath) : null;

    let baseTitle;
    if (filePath) {
        baseTitle = basename(filePath);
    } else if (options.fileObject instanceof File) {
        baseTitle = options.fileObject.name;
    } else {
        const untitledId = Date.now().toString(36);
        baseTitle = `Untitled-${untitledId}.mp4`;
    }

    let dirty = false;
    let draftVideo = options.fileObject || null;
    let loadedContent = null;

    /* =========================
       UI構築 (フリーズ対策用オーバーレイ維持)
    ========================== */
    root.innerHTML = `
    <div class="video-root-container" style="width:100%;height:100%;display:flex;flex-direction:column;background:#000;overflow:hidden;position:relative; transition: outline 0.2s;">
        <div class="video-container" style="flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;z-index:0;">
            <video controls style="max-width:100%;max-height:100%;outline:none;background:#000;"></video>
        </div>
        <div class="save-overlay" style="display:none; position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); color:#fff; z-index:10; flex-direction:column; align-items:center; justify-content:center; font-family:sans-serif;">
            <div style="margin-bottom:10px;">💾 保存中...</div>
            <div style="font-size:12px; color:#ccc;">大きなファイルの場合は数秒かかることがあります</div>
        </div>
    </div>
    `;

    const video = root.querySelector("video");
    const container = root.querySelector(".video-root-container");
    const saveOverlay = root.querySelector(".save-overlay");

    /* =========================
        表示更新 (メモリ分離・多形式対応)
     ========================== */
    function refresh() {
        if (video.src && video.src.startsWith("blob:")) {
            URL.revokeObjectURL(video.src);
            video.src = "";
        }

        // 表示するコンテンツの選定（FSノードの外部マーカーを直接参照しない）
        const content = (dirty && draftVideo) ? draftVideo : loadedContent;

        if (!content || content === "__EXTERNAL_DATA__") return;

        // 型チェックを行い、適切な方法でビデオソースを設定
        if (content instanceof Blob || content instanceof File) {
            video.src = URL.createObjectURL(content);
        } else if (content instanceof Uint8Array || content instanceof ArrayBuffer) {
            const blob = new Blob([content], { type: "video/mp4" });
            video.src = URL.createObjectURL(blob);
        } else if (typeof content === "string") {
            if (content.startsWith("data:") || content.startsWith("blob:") || /^(https?|file):\/\//i.test(content)) {
                video.src = content;
            } else {
                // 生の文字列データの場合はBlob化
                const blob = new Blob([content], { type: "video/mp4" });
                video.src = URL.createObjectURL(blob);
            }
        }

        if (video.src) video.load();
    }
    refresh();

    function updateTitle() {
        window.nexser?.windowAPI.updateWindowTitle(win, baseTitle, dirty);
    }
    updateTitle();

    /* =========================
       操作系
    ========================== */
    function openVideoFile() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "video/*";
        input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;
            draftVideo = file;
            dirty = true;
            baseTitle = file.name;
            refresh();
            updateTitle();
        };
        input.click();
    }

    container.addEventListener("dragover", e => {
        e.preventDefault();
        container.style.outline = "2px dashed #aaa";
        container.style.outlineOffset = "-4px";
    });
    container.addEventListener("dragleave", () => {
        container.style.outline = "none";
    });
    container.addEventListener("drop", e => {
        e.preventDefault();
        container.style.outline = "none";
        const file = e.dataTransfer.files[0];
        if (!file) return;
        if (!file.type.startsWith("video/")) {
            showWarning(root, "ビデオファイルをドロップしてください");
            return;
        }
        draftVideo = file;
        dirty = true;
        baseTitle = file.name;
        refresh();
        updateTitle();
    });

    /* =========================
        保存ロジック (syscall経由・Blob直接チャンク保存版)
     ========================== */
    async function save() {
        if (!syscall?.writeFile) {
            return showWarning(root, "システムコール (syscall.writeFile) が利用できません");
        }

        const targetDir = resolveFS("C:/Programs/Movie");
        if (!targetDir) return showWarning(root, "C:/Programs/Movie が見つかりません");

        const treatAsNew = !filePath || filePath.toLowerCase().endsWith("videoplayer.app");

        try {
            const dataToSave = treatAsNew ? draftVideo : (draftVideo || loadedContent);
            if (!dataToSave) throw new Error("保存するデータがありません");

            /* --- 1. 上書き保存 --- */
            if (!treatAsNew) {
                if (!dirty) {
                    updateTitle();
                    return;
                }

                saveOverlay.style.display = "flex";
                await new Promise(r => setTimeout(r, 50)); // 描画待ち

                // Blob/Fileのまま渡すことで Base64 変換を回避し、FS側で10MBチャンク保存を実行
                await syscall.writeFile(filePath, dataToSave);

                loadedContent = dataToSave;
                dirty = false;
                draftVideo = null;
                updateTitle();
                refresh();
                return;
            }

            /* --- 2. 新規保存 --- */
            let finalName = baseTitle;
            let idx = 1;
            while (targetDir[finalName]) {
                finalName = baseTitle.replace(/\.(mp4|webm|ogg)$/i, "") + ` (${idx++}).mp4`;
            }

            const name = await askFileName(finalName);
            if (!name) {
                updateTitle();
                return;
            }
            finalName = name.trim();

            if (targetDir[finalName]) {
                showWarning(root, "同名のファイルが存在します");
                return;
            }

            saveOverlay.style.display = "flex";
            await new Promise(r => setTimeout(r, 50));

            const newFilePath = `C:/Programs/Movie/${finalName}`;
            await syscall.writeFile(newFilePath, dataToSave);

            // DOM差し替えを行わず、既存インスタンスの状態だけ更新
            filePath = newFilePath;
            fileNode = resolveFS(newFilePath);
            loadedContent = dataToSave;
            baseTitle = finalName;
            dirty = false;
            draftVideo = null;

            updateTitle();
            refresh();
        } catch (err) {
            console.error("[VideoPlayer] Save failed:", err);
            showWarning(root, `保存中にエラーが発生しました: ${err.message}`);
        } finally {
            if (saveOverlay) saveOverlay.style.display = "none";
            updateTitle();
        }
    }

    async function askFileName(defaultName) {
        return new Promise(resolve => {
            const content = window.nexser?.windowAPI.showModalWindow("新規保存", "ファイル名を入力してください", {
                parentWin: win,
                silent: true,
                buttons: [
                    {
                        label: "OK",
                        onClick: () => {
                            const currentInput = content.querySelector(".modal-prompt-input");
                            resolve(currentInput ? currentInput.value : defaultName);
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
                promptInput.style = "width:100%; margin-top:10px; padding:4px; box-sizing:border-box;";
                const btnContainer = content.querySelector(".modal-button-container") || content.lastElementChild;
                content.insertBefore(promptInput, btnContainer);
            }
            promptInput.value = defaultName;
            setTimeout(() => promptInput.focus(), 10);
        });
    }

    if (win) {
        const ribbonMenus = [{
            title: "File",
            items: [
                { label: "ビデオを開く...", action: openVideoFile },
                { label: "保存", action: save }
            ]
        }];
        setupRibbon(win, () => filePath, null, ribbonMenus);
    }

    const closeBtn = win?.querySelector(".close-btn");

    const cleanup = () => {
        if (isDisposed) return;
        isDisposed = true;
        if (video.src && video.src.startsWith('blob:')) {
            URL.revokeObjectURL(video.src);
            video.src = "";
        }
        video.load();
        root.innerHTML = "";
    };

    function closeWindow() {
        cleanup(); // ★ 重複コードをまとめ、ここで一括呼び出し
        if (win) {
            win.remove();
        }
    }

    function requestClose() {
        if (!dirty) { closeWindow(); return; }
        showConfirm(root, "変更されたビデオが保存されていません。\n保存しますか？",
            async () => {
                await save();
                // save() の中で新しいウィンドウに差し替わらない場合のみ閉じる
                if (document.body.contains(win)) closeWindow();
            },
            () => {
                dirty = false; // フラグを落とす
                updateTitle();
                closeWindow(); // これでタスクバーも一緒に消える
            }
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
        if (!filePath || filePath.toLowerCase().endsWith("videoplayer.app")) return;
        if (!syscall?.readFile) return;

        try {
            const content = await syscall.readFile(filePath);
            if (isDisposed) return; // 既に破棄されている場合は処理を中断

            loadedContent = content;
            refresh();
        } catch (err) {
            console.error("[VideoPlayer] Read failed:", err);
            showWarning(root, `ビデオの読み込みに失敗しました: ${err.message}`);
        }
    }
    init();

    return {
        isTabApp: false,
        dispose: cleanup
    };
}