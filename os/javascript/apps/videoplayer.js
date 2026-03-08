// VideoPlayer.js
import { resolveFS } from "../fs-utils.js";
import { createWindow, bringToFront, showModalWindow, alertWindow, taskbarButtons, updateWindowTitle } from "../window.js";
import { setupRibbon } from "../ribbon.js";
import { getFileContent } from "../fs-db.js";
import { basename, loadFileAsDataURL } from "../fs-utils.js";

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
        baseTitle = basename(filePath);
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
       表示更新 (エラー対策修正)
    ========================== */
    function refresh() {
        if (video.src && video.src.startsWith('blob:')) {
            URL.revokeObjectURL(video.src);
            video.src = "";
        }

        // 表示するコンテンツの選定
        const content = (dirty && draftVideo) ? draftVideo : fileNode?.content;

        if (!content) return;

        // 型チェックを行い、適切な方法でビデオソースを設定
        if (content instanceof Blob || content instanceof File) {
            video.src = URL.createObjectURL(content);
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
        updateWindowTitle(win, baseTitle, dirty);
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
        // 1. 保存先を Desktop から Programs/Movie に変更
        const targetDir = resolveFS("Programs/Movie");
        if (!targetDir) return showWarning(root, "Programs/Movieが見つかりません");

        const treatAsNew = !fileNode || (filePath && filePath.toLowerCase().endsWith("videoplayer.app"));

        saveOverlay.style.display = "flex";
        await new Promise(r => setTimeout(r, 100)); // 描画待ち

        try {
            /* --- 1. 保存する実データの準備とサイズ計算 --- */
            const dataToSave = treatAsNew ? draftVideo : (draftVideo || fileNode?.content);
            if (!dataToSave) throw new Error("保存するデータがありません");

            // Blob/FileならDataURLに変換
            const encodedContent = (dataToSave instanceof File || dataToSave instanceof Blob)
                ? await loadFileAsDataURL(dataToSave)
                : dataToSave;

            // Base64(DataURL)から実際のバイト数を計算
            let actualSize = 0;
            if (typeof encodedContent === "string" && encodedContent.startsWith("data:")) {
                const base64Part = encodedContent.split(",")[1] || "";
                actualSize = Math.floor((base64Part.length * 3) / 4) - (base64Part.endsWith("==") ? 2 : base64Part.endsWith("=") ? 1 : 0);
            } else if (typeof encodedContent === "string") {
                actualSize = new TextEncoder().encode(encodedContent).length;
            }

            /* --- 2. 上書き保存 --- */
            if (!treatAsNew) {
                if (!dirty) {
                    saveOverlay.style.display = "none";
                    updateTitle();
                    return;
                }

                // contentとsizeを同時に更新
                fileNode.content = encodedContent;
                fileNode.size = actualSize;

                dirty = false;
                draftVideo = null;
                updateTitle();
                window.dispatchEvent(new Event("fs-updated"));
                refresh();
                saveOverlay.style.display = "none";
                return;
            }

            /* --- 3. 新規保存 --- */
            let finalName = baseTitle;
            let idx = 1;
            // targetDir (Programs/Movie) 内で重複チェック
            while (targetDir[finalName]) {
                finalName = baseTitle.replace(/\.(mp4|webm|ogg)$/i, "") + ` (${idx++}).mp4`;
            }

            saveOverlay.style.display = "none";
            const name = await askFileName(finalName);
            if (!name) {
                updateTitle();
                return;
            }
            finalName = name;

            if (targetDir[finalName]) {
                showWarning(root, "同名のファイルが存在します");
                return;
            }

            saveOverlay.style.display = "flex";
            await new Promise(r => setTimeout(r, 50));

            // targetDir (Programs/Movie) に新規作成
            targetDir[finalName] = {
                type: "file",
                content: encodedContent,
                size: actualSize
            };

            // 新しいパスを Programs/Movie に設定
            const newFilePath = `Programs/Movie/${finalName}`;
            window.dispatchEvent(new Event("fs-updated"));

            /* ウィンドウ差し替えロジック */
            if (win) {
                const oldWin = win;
                const oldRoot = root;
                const oldBtn = oldWin._taskbarBtn;

                // 新しいタイトルでウィンドウを作成
                const newRoot = createWindow(finalName, { width: 600, height: 450 });

                oldWin.parentElement.replaceChild(newRoot.parentElement, oldRoot.parentElement);

                // 新しいパスで VideoPlayer を初期化
                VideoPlayer(newRoot, { path: newFilePath });

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
    function closeWindow() {
        if (closeBtn) {
            // すでに dirty は false になっているので、再入防止のため
            // そのまま標準の閉じる処理が実行されます
            closeBtn.click();
        } else {
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
       ユーティリティ & 初期化
    ========================== */

    async function init() {
        if (filePath && fileNode) {
            // もしデータが外部にあるなら事前に読み込んでおく
            fileNode.content = await getFileContent(filePath);
            // 実際のビデオ設定ロジックは refresh が持っているので、それを呼ぶだけでOK
            refresh();
        }
    }
    init();
}