// TextEditor.js
import { resolveFS } from "../fs-utils.js";
import { createWindow, bringToFront, showModalWindow, alertWindow, centerWindowOptions } from "../window.js";
import { taskbarButtons } from "../window.js";
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

/* =========================
   TextEditor
========================= */
export default function TextEditor(root, options = {}) {
    const { path } = options;
    const win = root.closest(".window");
    const ribbon = win?._ribbon;
    const titleEl = win?.querySelector(".title-text");

    let filePath = path || null;
    let fileNode = filePath ? resolveFS(filePath) : null;
    let isNewFile = !fileNode;

    const untitledId = Date.now().toString(36);
    let baseTitle = filePath?.split("/").pop()?.trim() || `Untitled-${untitledId}`;

    let dirty = false;

    const styleState = Object.assign({
        fontSize: 16,
        fontFamily: "monospace",
        fontWeight: "normal",
        fontStyle: "normal"
    }, fileNode?.style || {});

    /* =========================
       UI
    ========================== */
    root.innerHTML = `
        <textarea class="texteditor" wrap="off" style="
            width:100%;
            height:100%;
            resize:none;
            box-sizing:border-box;
            border:none;
            outline:none;
            padding:8px;
            background:white;
            color:black;
            overflow:auto;
            white-space:pre;
            word-break:normal;
            overflow-wrap:normal;
        "></textarea>
    `;

    const textarea = root.querySelector(".texteditor");
    textarea.value = fileNode?.content || "";

    const contentEl = win?.querySelector(".content");
    if (contentEl) contentEl.style.overflow = "hidden";

    function applyStyle() {
        textarea.style.fontSize = styleState.fontSize + "px";
        textarea.style.fontFamily = styleState.fontFamily;
        textarea.style.fontWeight = styleState.fontWeight;
        textarea.style.fontStyle = styleState.fontStyle;
        textarea.style.textDecoration = styleState.textDecoration || "none";
        textarea.style.color = styleState.color || "black";
        textarea.style.backgroundColor = styleState.backgroundColor || "white";
    }
    applyStyle();

    function updateTitle() {
        const title = dirty ? `${baseTitle} *` : baseTitle;
        if (typeof win?.setTitle === "function") win.setTitle(title);
        else if (titleEl) titleEl.textContent = title;
    }
    updateTitle();

    async function save() {
        const desktop = resolveFS("Desktop");
        if (!desktop) { showWarning(root, "Desktop が見つかりません"); return; }

        const treatAsNew = !fileNode || (filePath && filePath.toLowerCase().endsWith("texteditor.app"));

        if (!treatAsNew) {
            fileNode.content = textarea.value;
            fileNode.style = { ...styleState };
            dirty = false;
            updateTitle();
            buildDesktop();
            window.dispatchEvent(new Event("fs-updated"));
            return;
        }

        // 新規ファイル名入力
        let finalName = baseTitle;
        async function askFileName(defaultName) {
            return new Promise(resolve => {
                const content = showModalWindow("新規保存", "ファイル名を入力してください", {
                    parentWin: win,
                    silent: true,
                    buttons: [
                        {
                            label: "OK", onClick: () => {
                                // OK時に現在の input の値を取得
                                const currentInput = content.querySelector(".modal-prompt-input");
                                resolve(currentInput ? currentInput.value : defaultName);
                            }
                        },
                        { label: "キャンセル", onClick: () => resolve(null) }
                    ]
                });

                if (!content) {
                    console.error("showModalWindow が要素を返しませんでした。");
                    return;
                }

                // 1. すでに input が存在するかチェック（重複防止）
                let promptInput = content.querySelector(".modal-prompt-input");

                // 2. 存在しない場合のみ新規作成
                if (!promptInput) {
                    promptInput = document.createElement("input");
                    promptInput.className = "modal-prompt-input"; // 識別用クラス
                    promptInput.type = "text";
                    promptInput.value = defaultName;
                    promptInput.style.width = "100%";
                    promptInput.style.boxSizing = "border-box";
                    promptInput.style.padding = "4px";
                    promptInput.style.marginTop = "10px";

                    // ボタンコンテナを探してその前に挿入
                    const btnContainer = content.querySelector(".button-container") || content.querySelector(".modal-button-container") || content.lastElementChild;
                    if (btnContainer) {
                        content.insertBefore(promptInput, btnContainer);
                    } else {
                        content.appendChild(promptInput);
                    }
                } else {
                    // 3. すでに存在する場合は値を最新にする
                    promptInput.value = defaultName;
                }

                setTimeout(() => promptInput.focus(), 10);
            });
        }
        let idx = 1;
        while (desktop[finalName]) finalName = `${baseTitle} (${idx++})`;
        const name = await askFileName(finalName);
        if (!name) return;
        finalName = name;
        if (desktop[finalName]) { showWarning(root, "同名のファイルが存在します"); return; }

        // Desktop に新規ファイルを作成
        const newNode = { type: "file", content: textarea.value, style: { ...styleState } };
        desktop[finalName] = newNode;
        fileNode = newNode;
        filePath = `Desktop/${finalName}`;
        baseTitle = finalName;
        dirty = false;

        buildDesktop();
        window.dispatchEvent(new Event("fs-updated"));
        // -------------------------------
        // 元の TextEditor.app ウィンドウを置き換え
        // -------------------------------
        if (win) {
            const oldWin = win;
            const oldRoot = root;
            const oldBtn = oldWin._taskbarBtn; // 元のタスクバーのボタン

            // 新しいウィンドウを作る
            const newRoot = createWindow(finalName, { width: 600, height: 400 });
            oldWin.parentElement.replaceChild(newRoot.parentElement, oldRoot.parentElement);

            // 新規ファイル用 TextEditor 初期化
            TextEditor(newRoot, { path: filePath, fromApp: false });

            // ----------------------------
            // 古いタスクバーボタンの完全削除
            // ----------------------------
            if (oldBtn && Array.isArray(taskbarButtons)) {
                oldBtn.remove();

                const idx = taskbarButtons.indexOf(oldBtn);
                if (idx !== -1) taskbarButtons.splice(idx, 1);

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
                title: "Edit",
                items: [
                    { label: "検索", action: searchText }
                ]
            },
            {
                title: "Font",
                items: [
                    { label: "Monospace", action: () => { styleState.fontFamily = "monospace"; dirty = true; applyStyle(); updateTitle(); } },
                    { label: "Sans", action: () => { styleState.fontFamily = "sans-serif"; dirty = true; applyStyle(); updateTitle(); } },
                    { label: "Serif", action: () => { styleState.fontFamily = "serif"; dirty = true; applyStyle(); updateTitle(); } }
                ]
            },
            {
                title: "Size",
                items: [8, 12, 16, 20, 24, 32, 48, 64, 128].map(sz => ({
                    label: sz + "px",
                    action: () => { styleState.fontSize = sz; dirty = true; applyStyle(); updateTitle(); }
                }))
            },
            {
                title: "Style",
                items: [
                    {
                        label: "B", action: () => {
                            styleState.fontWeight = styleState.fontWeight === "bold" ? "normal" : "bold";
                            dirty = true; applyStyle(); updateTitle();
                        }
                    },
                    {
                        label: "I", action: () => {
                            styleState.fontStyle = styleState.fontStyle === "italic" ? "normal" : "italic";
                            dirty = true; applyStyle(); updateTitle();
                        }
                    },
                    {
                        label: "U", action: () => {
                            styleState.textDecoration = styleState.textDecoration === "underline" ? "none" : "underline";
                            dirty = true; applyStyle(); updateTitle();
                        }
                    },
                    {
                        label: "S", action: () => {
                            styleState.textDecoration = styleState.textDecoration === "line-through" ? "none" : "line-through";
                            dirty = true; applyStyle(); updateTitle();
                        }
                    },
                    {
                        label: "Color", action: () => showColorPicker("文字色", styleState.color || "#000000", val => {
                            styleState.color = val; dirty = true; applyStyle(); updateTitle();
                        }, win)
                    },
                    {
                        label: "BG", action: () => showColorPicker("背景色", styleState.backgroundColor || "#ffffff", val => {
                            styleState.backgroundColor = val; dirty = true; applyStyle(); updateTitle();
                        }, win)
                    }
                ]
            },
            {
                title: "File",
                items: [
                    { label: "Save", action: save },
                    {
                        label: "Reset", action: () => {
                            Object.assign(styleState, { fontSize: 16, fontFamily: "monospace", fontWeight: "normal", fontStyle: "normal" });
                            dirty = true; applyStyle(); updateTitle();
                        }
                    }
                ]
            }
        ];

        setupRibbon(win, () => filePath, null, ribbonMenus);
    }

    // ステータスバー更新関数を追加
    function updateStatusBar() {
        if (!win?._statusBar) return;

        const text = textarea.value;
        const lines = text.split("\n");
        const totalLines = lines.length;
        const totalChars = text.length;

        // カーソル位置
        const cursorPos = textarea.selectionStart;
        let row = 1, col = 1;
        let count = 0;

        for (let i = 0; i < lines.length; i++) {
            const lineLength = lines[i].length + 1; // +1 は改行分
            if (cursorPos < count + lineLength) {
                row = i + 1;
                col = cursorPos - count + 1;
                break;
            }
            count += lineLength;
        }

        win._statusBar.textContent = `行: ${row}/${totalLines} 列: ${col} 文字: ${totalChars}`;
    }

    // 初期ステータスバー更新
    updateStatusBar();

    // 文字入力時、カーソル移動時にタイトルとステータスバーを更新
    textarea.addEventListener("input", () => {
        dirty = true;
        updateTitle();
        updateStatusBar();
    });

    textarea.addEventListener("click", updateStatusBar);
    textarea.addEventListener("keyup", updateStatusBar);
    textarea.addEventListener("mouseup", updateStatusBar);


    win?.addEventListener("keydown", e => {
        if (e.ctrlKey && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
    });

    const closeBtn = win?.querySelector(".close-btn");
    function closeWindow() { closeBtn?.click(); }

    function requestClose() {
        if (!dirty) {
            closeWindow();
            return;
        }
        // 編集中ダイアログ用に modal-dialog を付与
        if (win && !win.classList.contains("modal-dialog")) {
            win.classList.add("modal-dialog");
        }
        showConfirm(root, "編集中の内容があります。\n保存しますか？",
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
        e.preventDefault(); e.stopImmediatePropagation();
        requestClose();
    }, true);

    win?.addEventListener("keydown", e => {
        if (e.altKey && e.key === "F4") { e.preventDefault(); requestClose(); }
    });

    function searchText() {
        if (!win) return;

        // 1. parentWin を null にして、エディタ本体のロックを解除（モードレス化）
        const content = showModalWindow("検索", "検索文字列を入力してください", {
            parentWin: null,
            buttons: [
                {
                    label: "検索",
                    onClick: () => performSearch(input.value)
                },
                {
                    label: "閉じる",
                    onClick: () => closeSearch() // 自前のクローズ処理を呼ぶ
                }
            ]
        });

        const searchWin = content.parentElement;

        // 2. 位置をエディタの中央に合わせる
        const opts = centerWindowOptions(320, 150, win);
        searchWin.style.left = opts.left;
        searchWin.style.top = opts.top;

        // input要素の作成と挿入
        const input = document.createElement("input");
        input.type = "text";
        input.style.width = "100%";
        input.style.marginTop = "10px";
        input.style.boxSizing = "border-box";
        input.style.padding = "4px";

        const btnContainer = content.querySelector(".modal-button-container") || content.lastElementChild;
        if (btnContainer) {
            content.insertBefore(input, btnContainer);
        } else {
            content.appendChild(input);
        }

        setTimeout(() => input.focus(), 10);

        // 3. 【重要】親ウィンドウが消えたら自分も消えるように監視
        let observer = new MutationObserver(() => {
            if (!document.body.contains(win)) {
                closeSearch();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // 4. クローズ用ヘルパー関数（監視の解除を忘れないようにする）
        function closeSearch() {
            if (observer) observer.disconnect();
            searchWin.remove();
        }

        function performSearch(query) {
            if (!query) return;
            const val = textarea.value;
            const index = val.indexOf(query);
            if (index === -1) {
                showWarning(win, `"${query}" は見つかりません`);
                return;
            }
            textarea.focus();
            textarea.setSelectionRange(index, index + query.length);

            const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20;
            const linesBefore = val.substring(0, index).split("\n").length;
            textarea.scrollTop = (linesBefore - 1) * lineHeight;
        }
    }
}

/* =========================
   ユーティリティ
========================= */
function button(label) { const b = document.createElement("button"); b.textContent = label; b.style.marginRight = "4px"; b.style.height = "20px"; return b; }
function label(text) { const s = document.createElement("span"); s.textContent = text + ":"; s.style.margin = "0 4px"; s.style.fontSize = "12px"; return s; }
function number(value, min, max, width) { const i = document.createElement("input"); i.type = "number"; i.value = value; i.min = min; i.max = max; i.style.width = width + "px"; return i; }
function select(map, value) { const s = document.createElement("select"); for (const k in map) { const o = document.createElement("option"); o.value = k; o.textContent = map[k]; if (k === value) o.selected = true; s.appendChild(o); } return s; }

let activeColorPicker = null;

export function showColorPicker(title, initialColor = "#ffffff", onSelect, parentWin) {
    // 1. 既存チェック（変数名を整理）
    if (activeColorPicker && document.body.contains(activeColorPicker)) {
        bringToFront(activeColorPicker);
        return activeColorPicker.querySelector(".content");
    }

    const content = showModalWindow(title || "Color Picker", "色を選択してください", {
        parentWin: null,
        width: 320,
        height: 200,
        silent: true,
        buttons: []
    });

    const win = content.parentElement;
    win.classList.add("modal-dialog", "color-picker");
    win.style.position = "absolute";
    win.style.zIndex = 10000;

    const opts = centerWindowOptions(320, 200, parentWin instanceof HTMLElement ? parentWin : null);
    win.style.left = opts.left;
    win.style.top = opts.top;

    // min/maxボタン操作不可
    const minBtn = win.querySelector(".min-btn");
    const maxBtn = win.querySelector(".max-btn");
    if (minBtn) minBtn.classList.add("pointer_none");
    if (maxBtn) maxBtn.classList.add("pointer_none");

    // コンテンツ
    content.innerHTML = `
        <div style="padding:12px;text-align:center;">
            <input type="color" value="${initialColor}" style="width:80px;height:50px;margin-bottom:12px;">
            <div style="margin-bottom:12px;" class="color-buttons"></div>
            <div style="margin-top:8px;"></div>
        </div>
    `;

    const colorInput = content.querySelector("input[type=color]");
    colorInput.className = "button";
    const buttonContainer = content.querySelector(".color-buttons");
    const actionContainer = content.querySelector("div div");

    // プリセット色ボタン
    const presetColors = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff", "#ffffff", "#000000"];
    presetColors.forEach(c => {
        const btn = document.createElement("button");
        btn.style.background = c;
        btn.style.width = "24px";
        btn.style.height = "24px";
        btn.style.margin = "0 2px";
        btn.addEventListener("click", () => colorInput.value = c);
        buttonContainer.appendChild(btn);
    });

    // OKボタン
    const okBtn = document.createElement("button");
    okBtn.textContent = "OK";
    okBtn.style.margin = "0 4px";
    okBtn.addEventListener("click", () => {
        onSelect?.(colorInput.value);
        closePicker();
    });
    actionContainer.appendChild(okBtn);

    // キャンセルボタン
    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "キャンセル";
    cancelBtn.style.margin = "0 4px";
    cancelBtn.addEventListener("click", closePicker);
    actionContainer.appendChild(cancelBtn);

    document.body.appendChild(win);
    activeColorPicker = win;
    bringToFront(win);

    // 親ウィンドウが消えたらカラーピッカーも閉じる
    let observer = null;
    if (parentWin instanceof HTMLElement) {
        observer = new MutationObserver(() => {
            if (!document.body.contains(parentWin)) closePicker();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function closePicker() {
        if (!activeColorPicker) return;
        activeColorPicker.remove();
        activeColorPicker = null;
        if (observer) observer.disconnect();
    }

    return content;
}