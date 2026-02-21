// VideoPlayer.js
import { resolveFS } from "../fs-utils.js";
import { createWindow, bringToFront, showModalWindow, alertWindow, taskbarButtons } from "../window.js";
import { buildDesktop } from "../desktop.js";
import { setupRibbon } from "../ribbon.js";

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

export default function VideoPlayer(root, options = {}) {
    const { path } = options;
    const win = root.closest(".window");
    const titleEl = win?.querySelector(".title-text");

    let filePath = path || null;
    let fileNode = filePath ? resolveFS(filePath) : null;

    let baseTitle;
    if (filePath) {
        baseTitle = filePath.split("/").pop().trim();
    } else if (options.fileObject instanceof File) {
        baseTitle = options.fileObject.name;
    } else {
        const untitledId = Date.now().toString(36);
        baseTitle = `Untitled-${untitledId}.mp4`;
    }

    let dirty = false;
    let draftVideo = options.fileObject || null;

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
       表示更新
    ========================== */
    function refresh() {
        if (video.src.startsWith('blob:')) {
            URL.revokeObjectURL(video.src);
        }

        if (dirty && draftVideo) {
            video.src = URL.createObjectURL(draftVideo);
        } else if (fileNode?.content) {
            const content = fileNode.content;
            if (typeof content === "string") {
                if (content.startsWith("data:") || /^(https?|file):\/\//i.test(content)) {
                    video.src = content;
                } else {
                    const blob = new Blob([content], { type: "video/mp4" });
                    video.src = URL.createObjectURL(blob);
                }
            } else if (content instanceof File || content instanceof Blob) {
                video.src = URL.createObjectURL(content);
            }
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
       保存ロジック (統合版)
    ========================== */
    async function save() {
        const desktop = resolveFS("Desktop");
        if (!desktop) return showWarning(root, "Desktopが見つかりません");

        const treatAsNew = !fileNode || (filePath && filePath.toLowerCase().endsWith("videoplayer.app"));

        // 保存開始時のUIフィードバック
        saveOverlay.style.display = "flex";
        await new Promise(r => setTimeout(r, 100)); // 描画待ち

        try {
            /* 上書き保存 */
            if (!treatAsNew) {
                if (!dirty) {
                    saveOverlay.style.display = "none";
                    updateTitle();
                    return;
                }
                const dataToSave = draftVideo || fileNode?.content;
                if (!dataToSave) throw new Error("保存するデータがありません");

                fileNode.content = (dataToSave instanceof File || dataToSave instanceof Blob)
                    ? await blobToDataURL(dataToSave)
                    : dataToSave;

                dirty = false;
                draftVideo = null;
                updateTitle();
                buildDesktop();
                window.dispatchEvent(new Event("fs-updated"));
                saveOverlay.style.display = "none";
                return;
            }

            /* 新規保存 (ImageViewerスタイルのプロンプト) */
            let finalName = baseTitle;
            let idx = 1;
            while (desktop[finalName]) {
                finalName = baseTitle.replace(/\.(mp4|webm|ogg)$/i, "") + ` (${idx++}).mp4`;
            }

            saveOverlay.style.display = "none"; // ダイアログ表示前に隠す
            const name = await askFileName(finalName);
            if (!name) {
                updateTitle();
                return;
            }
            finalName = name;

            if (desktop[finalName]) {
                showWarning(root, "同名のファイルが存在します");
                return;
            }

            saveOverlay.style.display = "flex"; // エンコード開始前に再表示
            await new Promise(r => setTimeout(r, 50));

            const encodedContent = (draftVideo instanceof Blob) ? await blobToDataURL(draftVideo) : draftVideo;

            desktop[finalName] = {
                type: "file",
                content: encodedContent
            };

            const newFilePath = `Desktop/${finalName}`;
            buildDesktop();
            window.dispatchEvent(new Event("fs-updated"));

            /* ウィンドウ差し替えと後始末 (ImageViewer完全互換) */
            if (win) {
                const oldWin = win;
                const oldRoot = root;
                const oldBtn = oldWin._taskbarBtn;

                const newRoot = createWindow(finalName, { width: 600, height: 450 });

                // DOMの直接置換
                oldWin.parentElement.replaceChild(newRoot.parentElement, oldRoot.parentElement);

                // 新しいインスタンスの初期化
                VideoPlayer(newRoot, { path: newFilePath });

                // タスクバーの整合性維持
                if (oldBtn && Array.isArray(taskbarButtons)) {
                    oldBtn.remove();
                    const i = taskbarButtons.indexOf(oldBtn);
                    if (i !== -1) taskbarButtons.splice(i, 1);
                    oldBtn._window = null;
                    oldWin._taskbarBtn = null;
                }
                bringToFront(newRoot.closest(".window"));
            }
        } catch (err) {
            console.error(err);
            showWarning(root, "保存中にエラーが発生しました。");
        } finally {
            if (saveOverlay) saveOverlay.style.display = "none";
            updateTitle();
        }
    }

    async function askFileName(defaultName) {
        return new Promise(resolve => {
            const content = showModalWindow("新規保存", "ファイル名を入力してください", {
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

            // クラス名ベースの要素取得・生成ロジック
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

    /* =========================
       メニュー・終了処理
    ========================== */
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

    function closeWindow() {
        win.remove();
    }

    function requestClose() {
        if (!dirty) {
            closeWindow();
            return;
        }

        // 閉じる前に確認。ImageViewerと同じくstopImmediatePropagationのためにキャプチャで呼ぶ
        showConfirm(root, "変更されたビデオが保存されていません。\n保存しますか？",
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

    closeBtn?.addEventListener("click", e => {
        if (!dirty) return;
        e.preventDefault();
        e.stopImmediatePropagation(); // 他の終了イベントを遮断
        requestClose();
    }, true); // キャプチャフェーズ指定

    /* =========================
       ユーティリティ
    ========================== */
    async function blobToDataURL(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error("読み込み失敗"));
            reader.readAsDataURL(blob);
        });
    }
}