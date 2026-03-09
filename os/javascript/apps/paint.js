// Paint.js
import { resolveFS } from "../fs-utils.js";
import { createWindow, bringToFront, showModalWindow, alertWindow, updateWindowTitle, taskbarButtons } from "../window.js";
import { setupRibbon } from "../ribbon.js";
import { getFileContent } from "../fs-db.js";
import { showColorPicker } from "./texteditor.js";

export default async function Paint(root, options = {}) {
    const { path } = options;
    const win = root.closest(".window");

    let filePath = path || null;
    let fileNode = filePath ? resolveFS(filePath) : null;
    let dirty = false;

    // 描画状態
    let currentColor = "#000000";
    let bgColor = "#ffffff";
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    let startX = 0; // 矩形などの始点用
    let startY = 0;
    let tool = "pencil"; // pencil, eraser, bucket, rect
    let brushSize = 2;

    // Undo用スタック
    let undoStack = [];
    const MAX_UNDO = 10;
    let previewData = null; // 矩形プレビュー用の一時データ

    const baseName = filePath?.split("/").pop() || "Untitled.png";

    /* =========================
       ユーティリティ
    ========================== */
    function updateTitle() {
        updateWindowTitle(win, filePath?.split("/").pop() || "Untitled.png", dirty);
    }

    function showWarning(message) {
        alertWindow(message, { parentWin: win });
    }

    function updateStatus(x, y) {
        if (!win?._statusBar) return;
        const coord = (x !== undefined && y !== undefined) ? `${Math.round(x)}, ${Math.round(y)}px` : "";
        const size = `${canvas.width}x${canvas.height}px`;
        win._statusBar.textContent = coord ? `${coord}  |  ${size}` : size;
    }

    function saveUndoState() {
        undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        if (undoStack.length > MAX_UNDO) undoStack.shift();
    }

    function undo() {
        if (undoStack.length === 0) return;
        const previousState = undoStack.pop();
        ctx.putImageData(previousState, 0, 0);
        dirty = true;
        updateTitle();
    }

    /* =========================
       アルゴリズム: 塗りつぶし (Flood Fill)
    ========================== */
    function floodFill(startX, startY, fillRGB) {
        saveUndoState();
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const targetPos = (startY * canvas.width + startX) * 4;

        const targetR = data[targetPos];
        const targetG = data[targetPos + 1];
        const targetB = data[targetPos + 2];
        const targetA = data[targetPos + 3];

        if (targetR === fillRGB[0] && targetG === fillRGB[1] && targetB === fillRGB[2]) return;

        const stack = [[startX, startY]];
        while (stack.length > 0) {
            const [x, y] = stack.pop();
            const pos = (y * canvas.width + x) * 4;

            if (data[pos] === targetR && data[pos + 1] === targetG && data[pos + 2] === targetB && data[pos + 3] === targetA) {
                data[pos] = fillRGB[0];
                data[pos + 1] = fillRGB[1];
                data[pos + 2] = fillRGB[2];
                data[pos + 3] = 255;

                if (x > 0) stack.push([x - 1, y]);
                if (x < canvas.width - 1) stack.push([x + 1, y]);
                if (y > 0) stack.push([x, y - 1]);
                if (y < canvas.height - 1) stack.push([x, y + 1]);
            }
        }
        ctx.putImageData(imageData, 0, 0);
    }

    function hexToRgb(hex) {
        const bigint = parseInt(hex.replace('#', ''), 16);
        return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
    }

    /* =========================
       UI構築
    ========================== */
    root.innerHTML = `
        <div class="paint-container" style="display:flex; flex-direction:column; height:100%; background:#c0c0c0; user-select:none;">
            <div style="display:flex; flex:1; overflow:hidden;">
                <div class="paint-toolbar" style="width:32px; background:#c0c0c0; border:2px solid #dfdfdf; display:flex; flex-direction:column; align-items:center; padding:2px; gap:2px; border-right-color:#808080; border-bottom-color:#808080;">
                    <button class="tool-btn active" data-tool="pencil" title="鉛筆" style="width:24px; height:24px; padding:0; cursor:pointer;">✎</button>
                    <button class="tool-btn" data-tool="eraser" title="消しゴム" style="width:24px; height:24px; padding:0; cursor:pointer;">□</button>
                    <button class="tool-btn" data-tool="bucket" title="塗りつぶし" style="width:24px; height:24px; padding:0; cursor:pointer;">🪣</button>
                    <button class="tool-btn" data-tool="rect" title="矩形" style="width:24px; height:24px; padding:0; cursor:pointer;">▭</button>
                    <div style="width:100%; height:2px; background:#808080; margin:4px 0;"></div>
                    <div class="size-btn" data-size="2" title="細" style="width:20px; height:20px; display:flex; align-items:center; justify-content:center; cursor:pointer; border:1px solid #000;"><div style="width:2px; height:2px; background:black;"></div></div>
                    <div class="size-btn" data-size="5" title="中" style="width:20px; height:20px; display:flex; align-items:center; justify-content:center; cursor:pointer; border:1px solid transparent;"><div style="width:5px; height:5px; background:black;"></div></div>
                    <div class="size-btn" data-size="10" title="太" style="width:20px; height:20px; display:flex; align-items:center; justify-content:center; cursor:pointer; border:1px solid transparent;"><div style="width:10px; height:10px; background:black;"></div></div>
                </div>
                <div class="canvas-viewport" style="flex:1; overflow:auto; padding:16px; background:#808080; display:flex; justify-content:center; align-items:flex-start;">
                    <div style="position:relative; flex-shrink:0;">
                        <canvas class="paint-canvas" style="background:white; box-shadow: 2px 2px 5px rgba(0,0,0,0.5); cursor:crosshair; display:block;"></canvas>
                    </div>
                </div>
            </div>
            <div class="paint-palette" style="height:40px; background:#c0c0c0; border-top:2px solid #dfdfdf; display:flex; align-items:center; padding:0 4px; gap:8px;">
                <div style="position:relative; width:30px; height:30px; border:2px inset #fff; flex-shrink:0;">
                    <div class="bg-color-preview" style="position:absolute; bottom:2px; right:2px; width:18px; height:18px; border:1px solid #808080; background:${bgColor}; z-index:1;"></div>
                    <div class="current-color-preview" style="position:absolute; top:2px; left:2px; width:18px; height:18px; border:1px solid #808080; background:${currentColor}; z-index:2;"></div>
                </div>
                <div class="color-grid" style="display:flex; flex-wrap:wrap; gap:1px; width:260px;">
                    ${["#000000", "#808080", "#800000", "#808000", "#008000", "#008080", "#000080", "#800080", "#808040", "#004040", "#0080ff", "#004080", "#4000ff", "#804000",
            "#ffffff", "#c0c0c0", "#ff0000", "#ffff00", "#00ff00", "#00ffff", "#0000ff", "#ff00ff", "#ffff80", "#00ff80", "#80ffff", "#8080ff", "#ff0080", "#ff8040"].map(c =>
                `<div class="palette-color color-grid border" data-color="${c}" style="width:14px; height:14px; background:${c}; cursor:pointer;"></div>`
            ).join('')}
                </div>
            </div>
        </div>
    `;

    const canvas = root.querySelector(".paint-canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const preview = root.querySelector(".current-color-preview");
    const bgPreview = root.querySelector(".bg-color-preview");

    canvas.width = 640;
    canvas.height = 480;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (fileNode && fileNode.content) {
        if (fileNode.content === "__EXTERNAL_DATA__") {
            try { fileNode.content = await getFileContent(filePath); } catch (e) { console.error(e); }
        }
        const img = new Image();
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            updateStatus();
        };
        img.src = fileNode.content;
    }

    updateTitle();
    updateStatus();

    /* =========================
       描画ロジック
    ========================== */
    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        return { x: (e.clientX - rect.left), y: (e.clientY - rect.top) };
    }

    function startDrawing(e) {
        const pos = getPos(e);
        if (tool === "bucket") {
            const fillCol = (e.button === 2) ? bgColor : currentColor;
            floodFill(Math.floor(pos.x), Math.floor(pos.y), hexToRgb(fillCol));
            dirty = true;
            updateTitle();
            return;
        }

        saveUndoState();
        isDrawing = true;
        [lastX, lastY] = [pos.x, pos.y];
        [startX, startY] = [pos.x, pos.y];

        if (tool === "rect") {
            previewData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        }
    }

    function draw(e) {
        const pos = getPos(e);
        updateStatus(pos.x, pos.y);
        if (!isDrawing) return;

        const activeStroke = (e.buttons === 2) ? bgColor : (tool === "eraser" ? bgColor : currentColor);
        ctx.strokeStyle = activeStroke;
        ctx.lineWidth = tool === "eraser" ? brushSize * 5 : brushSize;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        if (tool === "rect") {
            ctx.putImageData(previewData, 0, 0);
            ctx.beginPath();
            ctx.rect(startX, startY, pos.x - startX, pos.y - startY);
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
            [lastX, lastY] = [pos.x, pos.y];
        }

        if (!dirty) { dirty = true; updateTitle(); }
    }

    canvas.addEventListener("mousedown", startDrawing);
    canvas.addEventListener("mousemove", draw);
    window.addEventListener("mouseup", () => {
        isDrawing = false;
        previewData = null;
    });
    canvas.addEventListener("contextmenu", e => e.preventDefault());

    /* =========================
       保存ロジック
    ========================== */
    async function save() {
        const desktop = resolveFS("Desktop");
        if (!desktop) { showWarning("Desktop が見つかりません"); return; }
        const dataUrl = canvas.toDataURL("image/png");
        const treatAsNew = !fileNode || (filePath && filePath.toLowerCase().endsWith(".app"));

        if (!treatAsNew) {
            fileNode.content = dataUrl;
            dirty = false;
            updateTitle();
            window.dispatchEvent(new Event("fs-updated"));
            return;
        }

        const finalName = await new Promise(resolve => {
            const content = showModalWindow("新規保存", "ファイル名を入力してください", {
                parentWin: win, silent: true,
                buttons: [
                    { label: "OK", onClick: () => resolve(content.querySelector(".modal-prompt-input")?.value) },
                    { label: "キャンセル", onClick: () => resolve(null) }
                ]
            });
            const promptInput = document.createElement("input");
            promptInput.className = "modal-prompt-input";
            promptInput.type = "text";
            promptInput.value = baseName;
            promptInput.style.cssText = "width:100%; margin-top:10px;";
            content.insertBefore(promptInput, content.querySelector(".button-container") || content.lastElementChild);
            setTimeout(() => promptInput.focus(), 10);
        });

        if (!finalName) return;
        if (desktop[finalName]) { showWarning("同名のファイルが存在します"); return; }

        const newNode = { type: "file", content: dataUrl };
        desktop[finalName] = newNode;
        fileNode = newNode;
        filePath = `Desktop/${finalName}`;
        dirty = false;
        updateTitle();
        window.dispatchEvent(new Event("fs-updated"));
    }

    /* =========================
       イベント・メニュー
    ========================== */
    root.querySelectorAll(".tool-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            root.querySelectorAll(".tool-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            tool = btn.dataset.tool;
        });
    });

    root.querySelectorAll(".size-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            root.querySelectorAll(".size-btn").forEach(b => b.style.borderColor = "transparent");
            btn.style.borderColor = "black";
            brushSize = parseInt(btn.dataset.size);
        });
    });

    root.querySelectorAll(".palette-color").forEach(p => {
        p.addEventListener("mousedown", e => {
            if (e.button === 2) {
                bgColor = p.dataset.color;
                bgPreview.style.background = bgColor;
            } else {
                currentColor = p.dataset.color;
                preview.style.background = currentColor;
            }
        });
        p.addEventListener("contextmenu", e => e.preventDefault());
    });

    if (win) {
        setupRibbon(win, () => filePath, null, [
            {
                title: "File",
                items: [
                    { label: "Save", action: save },
                    { label: "Undo", action: undo },
                    {
                        label: "Clear",
                        action: () => {
                            showModalWindow("キャンバスのクリア", "キャンバスを白紙に戻しますか？", {
                                parentWin: win, iconClass: "warning_icon",
                                buttons: [
                                    {
                                        label: "はい", onClick: () => {
                                            saveUndoState();
                                            ctx.fillStyle = "#ffffff";
                                            ctx.fillRect(0, 0, canvas.width, canvas.height);
                                            dirty = true; updateTitle();
                                        }
                                    },
                                    { label: "いいえ" }
                                ]
                            });
                        }
                    }
                ]
            },
            {
                title: "Colors",
                items: [
                    {
                        label: "Edit Colors...", action: () => showColorPicker("色の編集", currentColor, val => {
                            currentColor = val;
                            preview.style.background = val;
                        }, win)
                    }
                ]
            }
        ]);

        win.addEventListener("keydown", e => {
            if (e.ctrlKey && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
            if (e.ctrlKey && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
        });

        const closeBtn = win.querySelector(".close-btn");
        closeBtn?.addEventListener("click", e => {
            if (!dirty) return;
            e.preventDefault(); e.stopImmediatePropagation();
            showModalWindow("Confirm", "変更内容を保存しますか？", {
                parentWin: win, iconClass: "warning_icon",
                buttons: [
                    { label: "はい", onClick: async () => { await save(); closeBtn.click(); } },
                    { label: "いいえ", onClick: () => { dirty = false; closeBtn.click(); } },
                    { label: "キャンセル" }
                ]
            });
        }, true);
    }
}