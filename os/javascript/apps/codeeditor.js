// CodeEditor.js
import { resolveFS } from "../fs-utils.js";
import { createWindow, bringToFront, showModalWindow, updateWindowTitle } from "../window.js";
import { setupRibbon } from "../ribbon.js";
import { getFileContent } from "../fs-db.js";

/* =========================
   Preview Virtual FS Utils
========================= */
const previewBlobMap = new Map();
// ファイルパス（ディレクトリパス）ごとのタブとサイドバー状態を保持
const editorStateMap = new Map();
const openedFolders = new Set();
let searchQuery = "";
let searchIndex = -1;
let searchStatus = null; // ← 追加: findNext/findPrevious から参照可能

function createBlobURL(content, type) {
    return URL.createObjectURL(new Blob([content], { type }));
}

function getMimeType(name) {
    const n = name.toLowerCase();
    if (n.endsWith(".html")) return "text/html";
    if (n.endsWith(".css")) return "text/css";
    if (n.endsWith(".js")) return "text/javascript";
    if (n.endsWith(".json")) return "application/json";
    if (n.endsWith(".png")) return "image/png";
    if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
    if (n.endsWith(".gif")) return "image/gif";
    if (n.endsWith(".svg")) return "image/svg+xml";
    return "text/plain";
}

function collectFilesRecursive(basePath) {
    const result = new Map();
    function walk(path) {
        const node = resolveFS(path);
        if (!node) return;
        for (const [name, child] of Object.entries(node)) {
            if (name === "type") continue;
            const fullPath = path ? `${path}/${name}` : name;
            if (child.type === "folder") walk(fullPath);
            else if (child.type === "file") result.set(fullPath, String(child.content ?? ""));
        }
    }
    walk(basePath);
    return result;
}

function resolveRelativePath(fromPath, relative) {
    if (!relative || relative.startsWith("blob:") || relative.startsWith("http") || relative.startsWith("data:")) return null;
    const stack = fromPath.split("/").slice(0, -1);
    const parts = relative.split("/");
    for (const part of parts) {
        if (!part || part === ".") continue;
        if (part === "..") {
            if (stack.length) stack.pop();
        }
        else stack.push(part);
    }
    return stack.join("/");
}

/* =========================
   CodeEditor with Tabs + Sidebar
========================= */
export default function CodeEditor(root, options = {}) {
    const { path } = options;
    const win = root.closest(".window");
    const titleEl = win?.querySelector(".title-text");

    let filePath = path || null;
    let fileNode = filePath ? resolveFS(filePath) : null;
    let dirty = false;
    const untitledId = Date.now().toString(36);
    let baseTitle = filePath?.split("/").pop()?.trim() || `Untitled-${untitledId}`;

    let previewWin = null;
    let previewIframe = null;

    /* =========================
       Tabs State
    ========================== */
    const tabs = [];
    let activeTab = null;

    /* =========================
       Helpers
    ========================== */
    function isCodeFile(name) {
        return /\.(html|css|js|txt|json)$/i.test(name); // 拡張
    }

    function getDirPath(p) {
        if (!p) return null;
        const parts = p.split("/");
        parts.pop();
        return parts.join("/");
    }

    /* =========================
        連携ファイルを tabs に追加 (最新安定版)
    ========================== */
    function addLinkedFilesToTabs(basePath, content, visited = new Set(), depth = 0) {
        // 安全策：深すぎる再帰や中身がない場合は即終了
        if (depth > 10 || !content || content === "__EXTERNAL_DATA__") return;

        const currentDirPath = basePath || "";
        const regex = /(src|href)=["']([^"']+)["']/gi;
        let match;

        while ((match = regex.exec(content))) {
            const relPath = match[2];
            const resolved = resolveRelativePath(currentDirPath, relPath);

            // 無効なパス、または既に今回のスキャンで確認済みのパスはスキップ
            if (!resolved || visited.has(resolved)) continue;

            // 探索を開始する前に「訪問済み」として登録（循環参照対策）
            visited.add(resolved);

            const node = resolveFS(resolved);
            if (!node || node.type !== "file") continue;

            const fileName = resolved.split("/").pop();
            if (!isCodeFile(fileName)) continue;

            // タブに存在しない場合のみ追加
            if (!tabs.some(t => t.path === resolved)) {
                tabs.push({
                    name: fileName,
                    path: resolved,
                    node,
                    content: String(node.content ?? ""),
                    dirty: false
                });
                // タブが増えたのでUI更新が必要であることをマーク（後でまとめて実行）
            }

            // 次の階層へ（再帰呼び出し）
            const nextContent = String(node.content ?? "");
            addLinkedFilesToTabs(getDirPath(resolved), nextContent, visited, depth + 1);
        }
    }

    /* =========================
       Load Sibling Files + Restore Tab Order
    ========================== */
    function loadSiblingFiles() {
        if (!filePath) return;
        const dirPath = getDirPath(filePath);
        const dirNode = resolveFS(dirPath);
        if (!dirNode) return;

        const fileNames = Object.keys(dirNode)
            .filter(k => k !== "type")
            .filter(isCodeFile);
        const savedState = editorStateMap.get(dirPath);
        const order = savedState?.tabOrder || fileNames;

        tabs.length = 0;
        order.forEach(name => {
            if (!fileNames.includes(name)) return;
            const fullPath = `${dirPath}/${name}`;
            const node = resolveFS(fullPath);
            tabs.push({ name, path: fullPath, node, content: String(node?.content ?? ""), dirty: false });
        });

        activeTab = tabs.find(t => t.path === filePath) || tabs[0];

        // サイドバー状態も復元 (改善前は毎回閉じていた)
        if (savedState?.sidebarOpen) sidebar.style.display = "block";
    }

    /* =========================
       UI
    ========================== */
    root.innerHTML = `
<div class="tabbar" style="display:flex;background:#1b1b1b;border-bottom:1px solid #333;user-select:none;"></div>
<div class="main-layout" style="display:flex;width:100%;height:calc(100% - 32px);overflow:hidden;background:#111;">
    <div class="activity-bar" style="width:48px;background:#1a1a1a;display:flex;flex-direction:column;align-items:center;padding-top:5px;border-right:1px solid #111;flex-shrink:0;">
        <div class="activity-icon search-trigger" title="Search" style="cursor:pointer;width:100%;height:48px;display:flex;align-items:center;justify-content:center;transition:all 0.2s;border-left:2px solid transparent;">
            <svg class="search-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
        </div>
    </div>
    
    <div class="sidebar" style="width:250px;background:#1a1a1a;color:#ccc;overflow:auto;display:none;border-right:1px solid #222;padding:0;box-sizing:border-box;flex-shrink:0;"></div>
    
    <div class="linenumbers" style="width:52px;padding:10px 6px;box-sizing:border-box;text-align:right;color:#777;background:#0d0d0d;border-right:1px solid #222;user-select:none;overflow:hidden;white-space:pre;"></div>
    
    <div class="codecontainer" style="position:relative;flex:1;display:flex;min-width:0;overflow:hidden;background:#111;">
        <pre class="syntax-highlight" aria-hidden="true"></pre>
        
        <textarea class="codeeditor" spellcheck="false" wrap="off"></textarea>
        
        <div class="error-overlay" style="position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:2;"></div>
    </div>

    <div class="minimap-container" style="width:60px; background:#0d0d0d; border-left:1px solid #222; position:relative; flex-shrink:0; cursor:pointer; user-select:none;">
        <canvas class="minimap-canvas" style="width:100%; height:100%; pointer-events:none;"></canvas>
        <div class="minimap-slider" style="position:absolute; top:0; left:0; width:100%; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); pointer-events:none; box-sizing:border-box; z-index:3;"></div>
    </div>
</div>

<style>
/* 共通のフォント・レイアウト設定（極めて重要） */
.codeeditor, .syntax-highlight, .linenumbers {
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
    font-size: 14px !important;
    line-height: 20px !important;
    tab-size: 4 !important;
    letter-spacing: 0px !important;
    font-variant-ligatures: none !important;
    -webkit-font-smoothing: antialiased;
}

.codeeditor, .syntax-highlight {
    padding: 10px !important; 
    margin: 0 !important;
    border: none !important;
    box-sizing: border-box !important;
    white-space: pre !important; /* 絶対に折り返さない */
    word-break: normal !important;
    overflow-wrap: normal !important;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
    font-size: 14px !important;
    line-height: 20px !important;
    tab-size: 4 !important;
    letter-spacing: 0px !important;
    width: 100% !important;
    height: 100% !important;
}

/* textareaは透明にして、カーソルだけ見せる */
.codeeditor {
    color: transparent !important;
    caret-color: #fff; /* カーソルは白 */
    background: transparent !important;
}

.codeeditor {
    position: absolute;
    top: 0; left: 0;
    z-index: 2;
    background: transparent !important;
    color: transparent !important;
    caret-color: #fff;
    outline: none;
    resize: none;
    overflow: auto;
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE/Edge */
}

.codeeditor::-webkit-scrollbar {
    display: none; /* Chrome/Safari */
}

.syntax-highlight {
    position: absolute;
    top: 0; left: 0;
    z-index: 1;
    color: #eaeaea;
    overflow: hidden; 
    pointer-events: none;
    background: #111;
    /* transformを適用した際のボケを防止 */
    will-change: transform;
}

/* ハイライト配色 */
.hl-keyword  { color: #569cd6; font-weight: bold; }
.hl-string   { color: #ce9178; }
.hl-comment  { color: #6a9955; font-style: italic; }
.hl-number   { color: #b5cea8; }
.hl-bracket  { color: #ffd700; }
.hl-tag      { color: #569cd6; }
.hl-angle    { color: #808080; }
.hl-attr     { color: #9cdcfe; }
.hl-doctype  { color: #808080; }
.hl-selector { color: #d7ba7d; }
.hl-property { color: #9cdcfe; }
.hl-builtin  { color: #4fc1ff; }
.hl-variable { color: #9cdcfe; }
.hl-operator { color: #d4d4d4; }
</style>
`;

    const tabbar = root.querySelector(".tabbar");
    const textarea = root.querySelector(".codeeditor");
    const lineNumbers = root.querySelector(".linenumbers");
    const errorOverlay = root.querySelector(".error-overlay");
    const sidebar = root.querySelector(".sidebar");
    const syntaxLayer = root.querySelector(".syntax-highlight");


    const COLORS = {
        // 共通
        keyword: "#569cd6",   // 制御構文 (if, function, class)
        string: "#ce9178",    // 文字列
        comment: "#6a9955",   // コメント
        number: "#b5cea8",    // 数値
        bracket: "#ffd700",   // 括弧類
        operator: "#d4d4d4",  // 演算子 (+, -, =, &)

        // JavaScript
        func: "#dcdcaa",      // 関数名・メソッド名
        variable: "#9cdcfe",  // 変数名 (def)
        builtin: "#4fc1ff",   // 組み込みオブジェクト (console, Math)
        property_js: "#9cdcfe", // オブジェクトのプロパティ

        // HTML
        tag: "#569cd6",       // タグ名 (div, html)
        angle: "#808080",     // <, >
        attr: "#9cdcfe",      // 属性名 (class, src)
        doctype: "#808080",   // <!DOCTYPE>

        // CSS
        selector: "#d7ba7d",  // セレクタ (.class, #id, tag)
        property: "#9cdcfe",  // プロパティ (color, margin)
        unit: "#b5cea8",      // 単位 (px, rem)
        value: "#ce9178",     // プロパティの値 (文字列に近い扱い)
    };
    // 共通のトークナイザー
    function tokenize(line) {
        // 演算子、括弧、文字列、コメント、単語を細かく分割
        return line.split(/(\/\/.+|\/\*[\s\S]*?\*\/|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|`[\s\S]*?`|<\/?[a-zA-Z0-9!.-]+|[\w$-]+|[{}().,;+\-*/&|=<>!\[\]]|[\s]+)/).filter(Boolean);
    }

    function getTokenType(token, filePath) {
        const t = token.trim();
        if (!t) return null;
        const ext = filePath ? filePath.split('.').pop().toLowerCase() : '';

        // --- 共通 (最優先) ---
        if (t.startsWith("//") || t.startsWith("/*")) return "comment";
        if (/^["'`]/.test(t)) return "string";
        if (/^[0-9]+(\.[0-9]+)?(px|rem|em|%|vh|vw|s|ms|deg)?$/.test(t)) return "number";
        if (/^[{}()\[\]]$/.test(t)) return "bracket";
        if (/^[.,;]$/.test(t)) return null; // 句読点は通常色

        // --- HTML ---
        if (ext === 'html') {
            if (t.startsWith('<')) return "tag";
            if (t === '>') return "angle";
            // タグ内の属性判定 (簡易的に = の前にある英単語)
            if (/^[a-zA-Z-]+$/.test(t)) return "attr";
            if (t.startsWith('!')) return "doctype";
        }

        // --- CSS ---
        if (ext === 'css') {
            if (t.startsWith('.') || t.startsWith('#') || /^(html|body|div|span|a|h[1-6]|p|ul|li|section|header|footer|nav|main)$/.test(t)) {
                return "selector";
            }
            if (t.endsWith(':') || /^[a-z-]+$/.test(t)) {
                // プロパティか値かの判定は本来文脈が必要だが、簡易的にプロパティとして色付け
                return "property";
            }
        }

        // --- JavaScript ---
        if (ext === 'js') {
            // キーワード
            const keywords = /^(const|let|var|function|return|if|else|for|while|import|export|from|as|default|class|extends|constructor|static|get|set|async|await|new|this|super|try|catch|finally|throw|break|continue|switch|case|of|in|yield|delete|typeof|instanceof|void|null|undefined|true|false)$/;
            if (keywords.test(t)) return "keyword";

            // 組み込みオブジェクト
            const builtins = /^(console|window|document|Math|Object|Array|String|Number|Boolean|Promise|JSON|Map|Set|Symbol|Error|Proxy|Reflect|setTimeout|setInterval|fetch)$/;
            if (builtins.test(t)) return "builtin";

            // 関数呼び出し (トークンの次が '(' なら関数だが、単体判定では英単語を def に)
            if (/^[a-zA-Z_$][\w$]*$/.test(t)) {
                return "variable";
            }

            // 演算子
            if (/^[+\-*/&|=<>!%^]+$/.test(t)) return "operator";
        }

        return null;
    }

    // シンタックスハイライト適用関数
    function applySyntaxHighlight() {
        const lines = textarea.value.split('\n');
        let htmlResult = "";

        lines.forEach((line, i) => {
            const tokens = tokenize(line);
            tokens.forEach(token => {
                if (!token) return;
                const type = getTokenType(token, activeTab?.path);
                const escaped = token.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

                if (type) {
                    const className = `hl-${type}`;
                    htmlResult += `<span class="${className}">${escaped}</span>`;
                } else {
                    htmlResult += escaped;
                }
            });
            if (i < lines.length - 1) htmlResult += "\n";
        });

        syntaxLayer.innerHTML = htmlResult + (textarea.value.endsWith('\n') ? ' ' : '');
    }

    // 行数を記録するための変数を関数の外側（CodeEditor関数内）に定義
    let lastLineCount = 0;

    function updateLineNumbers() {
        const text = textarea.value;
        // splitを使用して高速に行数を取得
        const lines = text.split('\n').length;

        // 行数に変化がなければ、重いDOM操作をスキップする
        if (lastLineCount === lines) return;
        lastLineCount = lines;

        // 行番号文字列の生成
        let res = "";
        for (let i = 1; i <= lines; i++) {
            res += i + "\n";
        }
        lineNumbers.textContent = res;
    }
    let highlightLayer = null;

    textarea.addEventListener("scroll", () => {
        // 1. 行番号の同期
        lineNumbers.scrollTop = textarea.scrollTop;

        // 2. シンタックスハイライト層（preタグ）の同期
        // ここが抜けていたため、スクロールしても色だけ置いていかれていました
        if (syntaxLayer) {
            syntaxLayer.scrollTop = textarea.scrollTop;
            syntaxLayer.scrollLeft = textarea.scrollLeft;
        }

        // 3. 検索ヒット用レイヤー（canvas/div群）の同期
        if (highlightLayer) { // 変数名が highlightLayer になっている箇所を確認してください
            const sx = Math.round(textarea.scrollLeft);
            const sy = Math.round(textarea.scrollTop);
            highlightLayer.style.transform = `translate(${-sx}px, ${-sy}px)`;
        }
    });
    /* =========================
         Minimap Logic (Fixed for Sync & Resize)
      ========================== */
    const minimapCanvas = root.querySelector(".minimap-canvas");
    const minimapCtx = minimapCanvas.getContext("2d");
    const minimapSlider = root.querySelector(".minimap-slider");
    const minimapContainer = root.querySelector(".minimap-container");

    const LINE_H_PX = 2; // ミニマップ上の1行の高さ
    const CHAR_W_PX = 1;
    let isDraggingMinimap = false;

    function updateMinimap() {
        const text = textarea.value;
        const lines = text.split("\n");
        const lineCount = lines.length;

        const containerW = minimapContainer.clientWidth;
        const containerH = minimapContainer.clientHeight;
        if (containerW === 0 || containerH === 0) return;

        const dpr = window.devicePixelRatio || 1;
        if (minimapCanvas.width !== containerW * dpr || minimapCanvas.height !== containerH * dpr) {
            minimapCanvas.width = containerW * dpr;
            minimapCanvas.height = containerH * dpr;
            minimapCanvas.style.width = containerW + 'px';
            minimapCanvas.style.height = containerH + 'px';
        }

        minimapCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        minimapCtx.clearRect(0, 0, containerW, containerH);

        const scrollHeight = textarea.scrollHeight || 1;
        const clientHeight = textarea.clientHeight || 1;
        const scrollTop = textarea.scrollTop;
        const maxScrollTop = scrollHeight - clientHeight;
        const scrollRatio = maxScrollTop > 0 ? scrollTop / maxScrollTop : 0;

        const totalMinimapContentHeight = lineCount * LINE_H_PX;
        let drawOffsetY = 0;
        if (totalMinimapContentHeight > containerH) {
            drawOffsetY = scrollRatio * (totalMinimapContentHeight - containerH);
        }

        lines.forEach((line, i) => {
            const y = (i * LINE_H_PX) - drawOffsetY;
            if (y + LINE_H_PX < 0) return;
            if (y > containerH) return;

            let x = 4;
            const tokens = tokenize(line);

            tokens.forEach(token => {
                if (!token) return;
                const type = getTokenType(token, activeTab?.path);

                if (token.trim() === "") {
                    x += token.length * CHAR_W_PX;
                } else {
                    minimapCtx.fillStyle = COLORS[type] || "#6db3d9"; // デフォルトは水色
                    const tokenWidth = token.length * CHAR_W_PX;
                    minimapCtx.fillRect(x, y, tokenWidth, LINE_H_PX - 0.5);
                    x += tokenWidth;
                }
            });
        });

        const sliderHeight = Math.max(20, (clientHeight / scrollHeight) * containerH);
        const sliderTop = scrollRatio * (containerH - sliderHeight);
        minimapSlider.style.height = `${sliderHeight}px`;
        minimapSlider.style.top = `${sliderTop}px`;
    }

    // --- イベント周りの修正 ---

    const handleMinimapInput = (ev) => {
        const rect = minimapContainer.getBoundingClientRect();
        const containerH = minimapContainer.clientHeight;

        // クリック位置（y）を取得し、コンテナ内での相対位置にする
        let clickY = ev.clientY - rect.top;

        // スライダーの現在の高さを取得
        const sliderHeight = parseFloat(minimapSlider.style.height) || 20;

        // スライダーの中心をクリック位置に持ってくるためのオフセット調整
        let targetTop = clickY - (sliderHeight / 2);

        // 境界チェック（0 ～ コンテナ高 - スライダー高）
        const maxSliderTop = containerH - sliderHeight;
        targetTop = Math.max(0, Math.min(targetTop, maxSliderTop));

        // スライダーが動ける範囲の中での位置割合を計算
        const scrollPercent = maxSliderTop > 0 ? targetTop / maxSliderTop : 0;

        // エディタの最大スクロール距離にその割合を適用
        const maxEditorScroll = textarea.scrollHeight - textarea.clientHeight;
        textarea.scrollTop = scrollPercent * maxEditorScroll;
    };

    // リサイズ監視（ウィンドウサイズが変わっても見切れないようにする）
    const ro = new ResizeObserver(() => {
        requestAnimationFrame(updateMinimap);
    });
    ro.observe(minimapContainer);
    ro.observe(textarea); // エディタ側のサイズ変更も監視

    // スクロールと入力への反応
    textarea.addEventListener("scroll", () => requestAnimationFrame(updateMinimap));
    textarea.addEventListener("input", () => requestAnimationFrame(updateMinimap));

    // ドラッグ操作
    minimapContainer.addEventListener("mousedown", (e) => {
        isDraggingMinimap = true;
        handleMinimapInput(e);
        const onMouseMove = (ev) => isDraggingMinimap && handleMinimapInput(ev);
        const onMouseUp = () => {
            isDraggingMinimap = false;
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
    });

    /* =========================
       Tabs & Title
    ========================== */
    function updateTitle() {
        // 1. アクティブなタブがない場合は実行しない
        if (!activeTab) return;

        // 2. 表示する名前を確定（名前がない場合は "Untitled"）
        const displayName = activeTab.name || "Untitled";

        // 3. window.js の共通関数を呼び出し、変更フラグ (dirty) を渡す
        // これにより、タイトルバーに自動で "*" が付与されます
        updateWindowTitle(win, displayName, activeTab.dirty);
    }

    function renderTabs() {
        // 既存の構造を維持：一度リセットして全描画
        tabbar.innerHTML = "";
        tabs.forEach((tab, idx) => {
            const el = document.createElement("div");
            Object.assign(el.style, {
                padding: "6px 8px",
                cursor: "pointer",
                borderRight: "1px solid #333",
                background: tab === activeTab ? "#111" : "#1b1b1b",
                color: tab === activeTab ? "#fff" : "#aaa",
                userSelect: "none",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                maxWidth: "160px",  // タブ全体の最大幅
                minWidth: "40px",   // 極端に小さくならないように
                overflow: "hidden"
            });

            const label = document.createElement("span");
            label.textContent = tab.name + (tab.dirty ? " *" : "");
            label.title = tab.name;
            Object.assign(label.style, {
                whiteSpace: "nowrap",      // 折り返さない
                overflow: "hidden",        // はみ出た分を隠す
                textOverflow: "ellipsis",  // 三点リーダーを表示
                maxWidth: "120px"          // 省略を開始する最大幅（お好みで調整してください）
            });

            const closeBtn = document.createElement("span");
            closeBtn.textContent = "✕";
            Object.assign(closeBtn.style, {
                fontSize: "12px",
                opacity: 0.6,
                cursor: "pointer"
            });

            closeBtn.onmouseenter = () => closeBtn.style.opacity = 1;
            closeBtn.onmouseleave = () => closeBtn.style.opacity = 0.6;

            closeBtn.onclick = e => {
                e.stopPropagation();
                requestCloseTab(tab);
            };

            el.append(label, closeBtn);

            // ドラッグ並び替え
            el.draggable = true;
            el.addEventListener("dragstart", e =>
                e.dataTransfer.setData("text/tabIndex", idx)
            );
            el.addEventListener("dragover", e => e.preventDefault());
            el.addEventListener("drop", e => {
                const fromIdx = parseInt(e.dataTransfer.getData("text/tabIndex"));
                const toIdx = idx;
                if (fromIdx !== toIdx) {
                    const t = tabs.splice(fromIdx, 1)[0];
                    tabs.splice(toIdx, 0, t);
                    renderTabs();
                }
            });

            el.onclick = () => switchTab(tab);
            tabbar.appendChild(el);
        });
    }

    function requestCloseTab(tab) {
        if (tab.dirty) {
            showConfirm(root,
                `"${tab.name}" は未保存です。\n保存して閉じますか？`,
                async () => {
                    tab.node.content = tab.content;
                    tab.dirty = false;
                    closeTab(tab);
                },
                () => closeTab(tab)
            );
        } else {
            closeTab(tab);
        }
    }

    function closeTab(tab) {
        const index = tabs.indexOf(tab);
        if (index === -1) return;

        const wasActive = tab === activeTab;
        tabs.splice(index, 1);

        if (wasActive) {
            activeTab =
                tabs[index] ||
                tabs[index - 1] ||
                null;

            if (activeTab) {
                textarea.value = activeTab.content;
                baseTitle = activeTab.name;
                filePath = activeTab.path;
                fileNode = activeTab.node;
            } else {
                textarea.value = "";
                baseTitle = "CodeEditor";
                filePath = null;
                fileNode = null;
            }
            updateLineNumbers();
            applySyntaxHighlight(); // 閉じ終わった後の内容をハイライト
            if (searchQuery) highlightSearchMatches(searchQuery);
            requestAnimationFrame(updateMinimap);
        }

        // ★ 追加
        dirty = activeTab?.dirty ?? false;

        renderTabs();
        updateTitle();
        renderPreview();
    }

    function switchTab(tab) {
        if (activeTab === tab) return;

        // 1. 現在のタブの状態を保存
        if (activeTab) {
            activeTab.content = textarea.value;
            activeTab.dirty = dirty;
        }

        // 2. アクティブタブの切り替え
        activeTab = tab;
        textarea.value = tab.content;
        dirty = tab.dirty;
        baseTitle = tab.name;
        filePath = tab.path;
        fileNode = tab.node;

        // 3. 基本UIの更新
        updateLineNumbers();
        renderTabs();
        updateTitle();

        // 4. ハイライトの再適用
        // シンタックスハイライト（背景の色付け）
        applySyntaxHighlight();

        // 検索ヒットのハイライト（黄色のマーカー）
        if (searchQuery && searchQuery.trim() !== "") {
            // 前のタブの残像を消してから新しく描画
            clearErrorHighlights();
            highlightSearchMatches(searchQuery);
        } else {
            clearErrorHighlights();
            highlightLayer = null;
        }

        // 5. スクロール位置の同期（重要：ハイライトレイヤーのズレ防止）
        if (highlightLayer) {
            const sx = Math.round(textarea.scrollLeft);
            const sy = Math.round(textarea.scrollTop);
            highlightLayer.style.transform = `translate(${-sx}px, ${-sy}px)`;
        }

        // 6. 周辺コンポーネントの更新
        if (sidebar.style.display !== "none") renderSidebar();
        requestAnimationFrame(updateMinimap);
    }

    /* =========================
       初期ロード
    ========================== */
    loadSiblingFiles();
    if (activeTab) {
        const dirPath = getDirPath(activeTab.path);
        addLinkedFilesToTabs(dirPath, activeTab.content);
        renderTabs();
        if (sidebar.style.display !== "none") renderSidebar();
        renderPreview();
    }
    if (activeTab) textarea.value = activeTab.content;
    updateLineNumbers();
    renderTabs();
    updateTitle();

    /* =========================
       Save (修正)
    ========================== */
    async function save() {
        if (activeTab) {
            // 1. エディタの現在の値をタブのコンテンツに反映
            activeTab.content = textarea.value;

            // 2. タブのノード（仮想FSのメモリ実体）にも反映
            if (activeTab.node) {
                activeTab.node.content = activeTab.content;
            }
        }

        // 全てのタブの状態をクリーンにする
        tabs.forEach(tab => {
            if (tab.node) {
                // 他のタブも一応同期
                tab.node.content = tab.content;
                tab.dirty = false;
            }
        });

        dirty = false;
        renderTabs();
        updateTitle();

        // 3. プレビューを即時実行
        if (previewWin && document.body.contains(previewWin)) {
            await renderPreview();
        }

        // 他のウィンドウ（ファイルマネージャー等）への通知
        window.dispatchEvent(new Event("fs-updated"));
    }

    function highlightSearchMatches(query) {
        // 1. 既存のハイライトをクリア
        errorOverlay.innerHTML = "";

        // ★ 修正点: クエリが空（またはスペースのみ）の場合、件数表示も即座に消去する
        if (!query || query.trim() === "") {
            highlightLayer = null;
            if (searchStatus) {
                searchStatus.textContent = "";
            }
            return;
        }

        const text = textarea.value;
        const lines = text.split("\n");
        const computed = getComputedStyle(textarea);

        const lineHeight = parseFloat(computed.lineHeight);
        const paddingTop = parseFloat(computed.paddingTop);
        const paddingLeft = parseFloat(computed.paddingLeft);
        const tabSize = 8;

        const innerContainer = document.createElement("div");
        highlightLayer = innerContainer;

        Object.assign(innerContainer.style, {
            position: "absolute",
            top: "0",
            left: "0",
            height: Math.ceil(textarea.scrollHeight) + "px",
            width: Math.ceil(textarea.scrollWidth) + "px",
            pointerEvents: "none"
        });

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        ctx.font = `${computed.fontWeight} ${computed.fontSize} ${computed.fontFamily}`;

        let matchCount = 0; // ヒット数カウント用

        lines.forEach((line, i) => {
            let start = 0;
            let idx;
            const lowerLine = line.toLowerCase();
            const lowerQuery = query.toLowerCase();

            while ((idx = lowerLine.indexOf(lowerQuery, start)) !== -1) {
                matchCount++;

                const beforeText = line.substring(0, idx);
                const measuredBeforeText = beforeText.replace(/\t/g, ' '.repeat(tabSize));
                const leftOffset = ctx.measureText(measuredBeforeText).width;

                const matchText = line.substring(idx, idx + query.length);
                const measuredMatchText = matchText.replace(/\t/g, ' '.repeat(tabSize));
                const matchWidth = ctx.measureText(measuredMatchText).width;

                const div = document.createElement("div");
                Object.assign(div.style, {
                    position: "absolute",
                    left: Math.round(paddingLeft + leftOffset) + "px",
                    top: Math.round((i * lineHeight) + paddingTop) + "px",
                    width: Math.round(matchWidth) + "px",
                    height: Math.round(lineHeight) + "px",
                    backgroundColor: "rgba(255, 255, 0, 0.4)",
                    borderRadius: "2px"
                });

                innerContainer.appendChild(div);
                start = idx + query.length;
            }
        });

        // 3. サイドバーのステータス表示を更新
        if (searchStatus) {
            if (matchCount > 0) {
                searchStatus.style.color = "#aaa";
                searchStatus.textContent = `${matchCount} 件見つかりました`;
            } else {
                // 文字が入っているがヒットしない場合
                searchStatus.style.color = "#f66";
                searchStatus.textContent = `"${query}" は見つかりません`;
            }
        }

        errorOverlay.appendChild(innerContainer);

        if (highlightLayer) {
            const sx = Math.round(textarea.scrollLeft);
            const sy = Math.round(textarea.scrollTop);
            highlightLayer.style.transform = `translate(${-sx}px, ${-sy}px)`;
        }
    }


    function scrollToIndex(index) {
        const textUpToIndex = textarea.value.slice(0, index);
        const lineNumber = textUpToIndex.split("\n").length - 1;
        const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 18;
        const paddingTop = parseFloat(getComputedStyle(textarea).paddingTop) || 0;

        textarea.scrollTop = lineNumber * lineHeight - paddingTop;
    }
    function findNext() {
        if (!searchQuery || !activeTab) return;

        const text = textarea.value;
        let startPos = searchIndex + 1;
        if (startPos >= text.length) startPos = 0;

        let index = text.toLowerCase().indexOf(searchQuery.toLowerCase(), startPos);

        if (index === -1) {
            index = text.toLowerCase().indexOf(searchQuery.toLowerCase(), 0);
        }

        if (index !== -1) {
            textarea.setSelectionRange(index, index + searchQuery.length);
            scrollToIndex(index);
            searchIndex = index;
            if (searchStatus) searchStatus.textContent = ""; // 見つかったのでクリア
        } else {
            searchIndex = -1;
            if (searchStatus) searchStatus.textContent = `"${searchQuery}" は見つかりません`; // 見つからない場合
        }

        highlightSearchMatches(searchQuery);
    }

    function findPrevious() {
        if (!searchQuery || !activeTab) return;

        const text = textarea.value;
        let startPos = searchIndex - 1;
        if (startPos < 0) startPos = text.length - 1;

        let index = text.toLowerCase().lastIndexOf(searchQuery.toLowerCase(), startPos);

        if (index === -1) {
            index = text.toLowerCase().lastIndexOf(searchQuery.toLowerCase(), text.length);
        }

        if (index !== -1) {
            textarea.setSelectionRange(index, index + searchQuery.length);
            scrollToIndex(index);
            searchIndex = index;
            if (searchStatus) searchStatus.textContent = "";
        } else {
            searchIndex = -1;
            if (searchStatus) searchStatus.textContent = `"${searchQuery}" は見つかりません`;
        }

        highlightSearchMatches(searchQuery);
    }

    /* =========================
       Error Highlight
    ========================== */
    function clearErrorHighlights() { errorOverlay.innerHTML = ""; }
    function showErrors(errors = []) {
        clearErrorHighlights();
        const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 18;
        errors.forEach(err => {
            const div = document.createElement("div");
            div.style.position = "absolute";
            div.style.left = "0";
            div.style.right = "0";
            div.style.top = (err.line - 1) * lineHeight + "px";
            div.style.height = lineHeight + "px";
            div.style.backgroundColor = "rgba(255,0,0,0.3)";
            errorOverlay.appendChild(div);
        });
    }
    // --- 改善後 ---
    textarea.addEventListener("input", () => {
        if (!activeTab) return;
        activeTab.content = textarea.value;

        if (!activeTab.dirty) {
            activeTab.dirty = true;
            dirty = true;
            renderTabs();
        }
        updateTitle();
        updateLineNumbers();
        applySyntaxHighlight();
        // ★ 変更点: 入力があったら、新しいテキストに基づいて「巨大な板」を作り直す
        if (searchQuery && searchQuery.trim() !== "") {
            highlightSearchMatches(searchQuery);
        } else {
            clearErrorHighlights();
            highlightLayer = null; // レイヤーの参照もクリア
        }
    });

    textarea.addEventListener("keydown", (e) => {
        if (e.key === "Tab") {
            e.preventDefault();
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;

            // 選択範囲にタブ文字を挿入
            textarea.setRangeText("\t", start, end, "end");

            // 内容が変わったので input イベントを手動で発生させて dirty フラグを更新
            textarea.dispatchEvent(new Event("input"));
        }
        if (e.ctrlKey && e.key === "f") {
            e.preventDefault();

            const q = prompt("検索");
            if (!q) return;

            searchQuery = q;
            searchIndex = -1;
            findNext();
        }

        if (e.key === "F3") {
            e.preventDefault();
            findNext();
        }
    });


    /* =========================
       Preview
    ========================== */
    function openPreview() {
        if (previewWin && document.body.contains(previewWin)) { renderPreview(); bringToFront(previewWin); return; }
        const content = createWindow("Preview", {
            width: 800,
            height: 520,
            taskbar: false,
            disableMinimize: true
        });
        previewWin = content.parentElement;
        previewIframe = document.createElement("iframe");
        Object.assign(previewIframe.style, { width: "100%", height: "100%", border: "none", background: "white", display: "block" });
        content.appendChild(previewIframe);
        renderPreview();

        const observer = new MutationObserver(() => {
            if (!document.body.contains(win)) {
                previewWin?.remove();
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    /* =========================
    Preview (修正版)
 ========================= */
    async function renderPreview() {
        if (!previewIframe || !filePath) return;

        // 1. 古いURLを一時保存（解放は後で行う）
        const oldBlobs = new Map(previewBlobMap);

        const baseDir = getDirPath(filePath);
        const fsFiles = collectFilesRecursive(baseDir);
        if (!fsFiles.size) return;

        // 2. ★最重要：エディタのタブにある最新の内容を最優先で反映する
        tabs.forEach(t => {
            if (fsFiles.has(t.path)) {
                fsFiles.set(t.path, t.content);
            }
        });

        // プレビュー用マップをクリア
        previewBlobMap.clear();

        // 3. 各ファイルの中身を確定させ Blob URL を生成
        for (let [fullPath, content] of fsFiles.entries()) {
            if (content === "__EXTERNAL_DATA__") {
                try {
                    content = await getFileContent(fullPath);
                    const node = resolveFS(fullPath);
                    if (node) node.content = content;
                } catch (e) {
                    console.error(`Preview load error: ${fullPath}`, e);
                    content = "/* Error loading file */";
                }
            }

            const name = fullPath.split("/").pop();
            const mime = getMimeType(name);
            const url = createBlobURL(String(content ?? ""), mime);
            previewBlobMap.set(fullPath, url);
            fsFiles.set(fullPath, content); // 置換用に中身を保存
        }

        // 4. プレビュー対象のHTMLパスを決定
        const htmlPath = (activeTab?.path && activeTab.path.toLowerCase().endsWith(".html"))
            ? activeTab.path
            : [...previewBlobMap.keys()].find(p => p.toLowerCase().endsWith(".html"));

        if (!htmlPath) return;

        let html = fsFiles.get(htmlPath);
        if (!html) return;

        // タイトル更新処理 (既存のまま)
        const titleMatch = html.match(/<title>(.*?)<\/title>/i);
        const winTitleEl = previewWin?.querySelector(".title-text");
        if (winTitleEl) {
            winTitleEl.textContent = (titleMatch && titleMatch[1])
                ? titleMatch[1]
                : `Preview - ${activeTab?.name || "Untitled"}`;
        }

        // 5. 相対パスを Blob URL に置換
        html = html.replace(/(src|href)=["']([^"']+)["']/gi, (match, attr, relPath) => {
            const resolved = resolveRelativePath(htmlPath, relPath);
            const blobUrl = resolved ? previewBlobMap.get(resolved) : null;
            return blobUrl ? `${attr}="${blobUrl}"` : match;
        });

        const htmlBlobUrl = createBlobURL(html, "text/html");
        previewBlobMap.set("__html__", htmlBlobUrl);

        // 6. 反映と後片付け
        previewIframe.src = htmlBlobUrl;
        previewIframe.onload = () => {
            // 新しい内容が表示された後に古い URL を解放する
            for (const url of oldBlobs.values()) {
                try { URL.revokeObjectURL(url); } catch { }
            }
        };
    }

    /* =========================
       Sidebar
    ========================== */
    let sidebarRootDir = getDirPath(filePath) || filePath.split("/")[0];

    function renderSidebar() {
        sidebar.innerHTML = "";

        // ===== VSCode風検索バー =====
        const searchDiv = document.createElement("div");
        searchDiv.style.padding = "4px 6px";
        searchDiv.style.borderBottom = "1px solid #333";

        const searchInput = document.createElement("input");
        searchInput.type = "text";
        searchInput.placeholder = "検索...";
        Object.assign(searchInput.style, {
            width: "100%",
            padding: "4px",
            boxSizing: "border-box",
            background: "#222",
            color: "#eee",
            border: "1px solid #444",
            borderRadius: "2px"
        });

        // 検索ステータス用
        const statusDiv = document.createElement("div");
        statusDiv.className = "search-status";
        Object.assign(statusDiv.style, {
            fontSize: "12px",
            color: "#888", // 通常時はグレー
            marginTop: "4px",
            minHeight: "16px",
            display: "flex",
            justifyContent: "space-between" // 右側に件数を出すため
        });
        searchStatus = statusDiv;

        searchDiv.appendChild(searchInput);
        searchDiv.appendChild(statusDiv);
        sidebar.appendChild(searchDiv);

        // Enter / Shift+Enter 検索
        searchInput.addEventListener("keydown", (e) => {
            if (!activeTab) return;
            if (e.key === "Enter") {
                e.preventDefault();
                searchQuery = searchInput.value;
                if (e.shiftKey) findPrevious();
                else findNext();
            }
        });
        // sidebar内のsearchInputのイベント
        searchInput.addEventListener("input", () => {
            searchQuery = searchInput.value;

            // 入力欄が空になったら、表示もハイライトも即座に消す
            if (!searchQuery || searchQuery.trim() === "") {
                clearErrorHighlights();
                if (searchStatus) searchStatus.textContent = "";
                highlightLayer = null;
            } else {
                highlightSearchMatches(searchQuery);
            }
        });
        if (!sidebarRootDir) return;

        function buildTree(path, visited = new Set(), depth = 0) {
            if (!path || visited.has(path) || depth > 20) return null;
            visited.add(path);
            const node = resolveFS(path);
            if (!node) return null;
            const treeNode = { name: path.split("/").pop(), path, type: node.type, children: [] };
            if (node.type === "folder") {
                for (const key of Object.keys(node)) {
                    if (key === "type") continue;
                    const childPath = path ? `${path}/${key}` : key;
                    const childTree = buildTree(childPath, visited, depth + 1);
                    if (childTree) treeNode.children.push(childTree);
                }
            }
            return treeNode;
        }

        const treeRoot = buildTree(sidebarRootDir);
        if (!treeRoot) return;

        function createList(treeNode) {
            const li = document.createElement("li");
            li.textContent = treeNode.name;
            li.style.cursor = treeNode.type === "file" ? "pointer" : "default";

            if (treeNode.type === "file") {
                li.onclick = async e => { // asyncを追加
                    e.stopPropagation();
                    let tab = tabs.find(t => t.path === treeNode.path);
                    if (!tab) {
                        const node = resolveFS(treeNode.path);
                        if (!node) return;

                        // ★ ここで実体を取得
                        let content = node.content;
                        if (content === "__EXTERNAL_DATA__") {
                            try {
                                content = await getFileContent(treeNode.path);
                                node.content = content; // キャッシュに書き戻す
                            } catch (err) {
                                content = "Error loading file.";
                            }
                        }

                        tab = { name: treeNode.name, path: treeNode.path, node, content: String(content ?? ""), dirty: false };
                        tabs.push(tab);
                    }
                    switchTab(tab);
                    renderTabs();
                };
            }

            if (treeNode.children.length) {
                const ul = document.createElement("ul");
                ul.style.listStyle = "none";
                ul.style.paddingLeft = "12px";
                treeNode.children.forEach(child => ul.appendChild(createList(child)));
                li.appendChild(ul);

                if (treeNode.type === "folder") {
                    li.style.cursor = "pointer";
                    ul.style.display = openedFolders.has(treeNode.path) ? "block" : "none";
                    li.onclick = e => {
                        e.stopPropagation();
                        const isOpen = ul.style.display !== "none";
                        ul.style.display = isOpen ? "none" : "block";
                        if (!isOpen) openedFolders.add(treeNode.path);
                        else openedFolders.delete(treeNode.path);
                    };
                }
            }
            return li;
        }

        const ulRoot = document.createElement("ul");
        ulRoot.style.listStyle = "none";
        ulRoot.style.paddingLeft = "6px";
        ulRoot.appendChild(createList(treeRoot));
        sidebar.appendChild(ulRoot);
    }
    /* =========================
           Activity Bar Logic
        ========================== */
    /* =========================
           Activity Bar & Sidebar Logic
        ========================== */
    const searchTrigger = root.querySelector(".search-trigger");
    const searchSvg = root.querySelector(".search-svg");

    function toggleSidebarWithSearch() {
        const isHidden = sidebar.style.display === "none";

        if (isHidden) {
            // サイドバーを開く
            sidebar.style.display = "block";
            searchTrigger.style.borderLeft = "2px solid #fff";
            searchSvg.setAttribute("stroke", "#fff"); // アイコンを白に
            renderSidebar();
            // 検索窓へのフォーカス
            setTimeout(() => sidebar.querySelector("input")?.focus(), 10);
        } else {
            // サイドバーを閉じる
            sidebar.style.display = "none";
            searchTrigger.style.borderLeft = "2px solid transparent";
            searchSvg.setAttribute("stroke", "#888"); // アイコンをグレーに
        }
    }

    // アイコンクリック
    searchTrigger.addEventListener("click", toggleSidebarWithSearch);

    // ホバーエフェクト（サイドバーが閉じている時だけ少し明るくする）
    searchTrigger.onmouseenter = () => {
        if (sidebar.style.display === "none") searchSvg.setAttribute("stroke", "#ccc");
    };
    searchTrigger.onmouseleave = () => {
        if (sidebar.style.display === "none") searchSvg.setAttribute("stroke", "#888");
    };
    /* =========================
       Ribbon
    ========================== */
    if (win) {
        const reloadPreview = () => {
            if (previewWin && document.body.contains(previewWin)) {
                renderPreview(); // 既存のプレビューがあれば中身を更新
                bringToFront(previewWin);
            } else {
                openPreview(); // なければ新規で開く
            }
        };
        setupRibbon(win, () => filePath, null, [
            {
                title: "File", items: [
                    { label: "Save", action: save },
                    { label: "Preview", action: openPreview },
                    { label: "Reload Preview", action: reloadPreview }
                ]
            },
            {
                title: "View", items: [
                    { label: "Toggle Sidebar (Search)", action: toggleSidebarWithSearch }
                ]
            }
        ]);
    }

    sidebar.style.display = "none";

    /* =========================
       FS変更 → タブ自動同期（修正版）
    ========================== */
    function syncTabsWithFS() {
        let activeTabWasUpdated = false;

        for (let i = tabs.length - 1; i >= 0; i--) {
            const tab = tabs[i];
            const node = resolveFS(tab.path);

            if (node) {
                if (activeTab && tab.path === activeTab.path) {
                    // nodeの内容がメモリ上のタブ内容と異なる場合、同期してフラグを立てる
                    if (activeTab.content !== node.content) {
                        activeTab.content = String(node.content ?? "");
                        textarea.value = activeTab.content;
                        activeTabWasUpdated = true;
                    }
                }
                tab.node = node;
                tab.content = String(node.content ?? "");
            } else {
                if (activeTab === tab) activeTab = null;
                tabs.splice(i, 1);
                activeTabWasUpdated = true; // タブが消滅した場合もUI更新が必要
            }
        }

        if (!activeTab && tabs.length) {
            activeTab = tabs[0];
            textarea.value = activeTab.content;
            updateLineNumbers();
            baseTitle = activeTab.name;
            activeTabWasUpdated = true;
        }

        renderTabs();
        updateTitle();

        // ★ ハイライトの更新
        if (activeTabWasUpdated) {
            // シンタックスハイライトの再適用
            applySyntaxHighlight();

            // 検索中のワードがあれば、新しい内容に対してハイライトを再描画
            if (searchQuery && searchQuery.trim() !== "") {
                highlightSearchMatches(searchQuery);
            } else {
                clearErrorHighlights();
            }

            // プレビューの更新
            if (previewWin && document.body.contains(previewWin)) {
                renderPreview();
            }

            // ミニマップも更新
            requestAnimationFrame(updateMinimap);
        }

        if (sidebar.style.display !== "none") {
            renderSidebar();
        }
    }

    /* =========================
       Close & Cleanup
    ========================== */
    function requestClose() {
        if (!dirty) { closeWin(); return; }
        showModalWindow("Save Changes", "編集中の内容があります。\n保存しますか？", {
            parentWin: win,
            buttons: [
                {
                    label: "保存",
                    onClick: async () => {
                        await save();
                        closeWin();
                    }
                },
                {
                    label: "保存しない",
                    onClick: () => {
                        dirty = false; // 破棄フラグ
                        renderTabs();
                        updateTitle();
                        closeWin();
                    }
                },
                {
                    label: "キャンセル",
                    onClick: () => {
                        // 何もしない（ダイアログが閉じるだけ）
                    }
                }
            ]
        });
    }
    function closeWin() {
        if (previewWin && document.body.contains(previewWin)) previewWin.remove();
        win?.querySelector(".close-btn")?.click();
    }
    const closeBtn = win?.querySelector(".close-btn");
    closeBtn?.addEventListener("click", e => {
        if (!dirty) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        requestClose();
    }, true);

    win?.addEventListener("keydown", e => {
        if (e.altKey && e.key === "F4") { e.preventDefault(); requestClose(); }
        if (e.ctrlKey && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
        if (e.ctrlKey && e.key === "Enter") { e.preventDefault(); openPreview(); }
        if (e.ctrlKey && e.key.toLowerCase() === "r") {
            e.preventDefault();
            if (previewWin && document.body.contains(previewWin)) {
                renderPreview();
            }
        }
    });

    if (win) {
        const observer = new MutationObserver(() => {
            if (!document.body.contains(win)) {
                window.removeEventListener("fs-updated", syncTabsWithFS);
                observer.disconnect();
                previewWin?.remove();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    /* =========================
          実体取得を含む初期化処理
       ========================== */
    async function init() {
        if (!filePath || !fileNode) return;

        // 1. メインファイルの実体を取得
        if (fileNode.content === "__EXTERNAL_DATA__") {
            try {
                fileNode.content = await getFileContent(filePath);
                if (activeTab && activeTab.path === filePath) {
                    activeTab.content = fileNode.content;
                    textarea.value = fileNode.content;
                    // ★追加: メインファイルの読み込みが完了した瞬間に更新
                    updateLineNumbers();
                    applySyntaxHighlight();
                }
            } catch (e) { console.error("Load error:", e); }
        }

        // 2. リンクされているファイルを再帰的に検索して tabs に追加
        const dirPath = getDirPath(filePath);
        addLinkedFilesToTabs(dirPath, fileNode.content);

        // 3. 全てのタブをチェックし、__EXTERNAL_DATA__ が残っていれば取得
        await Promise.all(tabs.map(async (tab) => {
            if (tab.node && tab.node.content === "__EXTERNAL_DATA__") {
                try {
                    const content = await getFileContent(tab.path);
                    tab.node.content = content;
                    tab.content = content;

                    if (activeTab === tab) {
                        textarea.value = content;
                        updateLineNumbers();
                    }
                } catch (e) {
                    console.error(`Failed to load: ${tab.path}`, e);
                }
            }
        }));

        renderTabs();
        updateTitle();
        // ★追加: すべての初期化処理が終わった後、確実に行番号を最新にする
        updateLineNumbers();
        renderPreview();
        applySyntaxHighlight();
        requestAnimationFrame(updateMinimap);
    }

    // 実行
    init();
    requestAnimationFrame(() => {
        updateMinimap();
    });
    return {
        isTabApp: true,
        /**
         * 外部（kernel）から新しいファイルを開くよう要求された時の処理
         * @param {string} newFilePath - 開きたいファイルのフルパス
         */
        openNewTab: async (newFilePath) => {
            const newNode = resolveFS(newFilePath);
            if (!newNode || newNode.type !== "file") return;

            // すでにタブが開いているか確認
            const existingTab = tabs.find(t => t.path === newFilePath);
            if (existingTab) {
                // すでに開いていればそのタブを選択
                activeTab = existingTab;
            } else {
                // 新しいタブとして追加
                const newTab = {
                    name: newFilePath.split("/").pop(),
                    path: newFilePath,
                    content: newNode.content,
                    node: newNode,
                    isModified: false
                };

                // もし content が "__EXTERNAL_DATA__" なら実体を取得
                if (newNode.content === "__EXTERNAL_DATA__") {
                    try {
                        const realContent = await getFileContent(newFilePath);
                        newTab.content = realContent;
                        newNode.content = realContent;
                    } catch (e) {
                        console.error("Failed to load external data for new tab:", e);
                    }
                }

                tabs.push(newTab);
                activeTab = newTab;
            }

            // UIを更新
            textarea.value = activeTab.content;
            renderTabs();
            updateTitle();
            updateLineNumbers();
            renderPreview();
            applySyntaxHighlight();
            requestAnimationFrame(updateMinimap);
            applySyntaxHighlight();
            // ウィンドウを前面に持ってくる（kernel側でも行っていますが念のため）
            bringToFront(win);
        }
    }
}

export function showConfirm(root, message, onYes, onNo) {
    showModalWindow(root, "Confirm", message, [
        { label: "はい", onClick: onYes },
        { label: "いいえ", onClick: onNo }
    ]);
}