// CodeEditor.js
import { resolveFS } from "../fs-utils.js";
import { setupRibbon } from "../ribbon.js";

/* =========================
   Preview Virtual FS Utils
========================= */
// ファイルパス（ディレクトリパス）ごとのタブとサイドバー状態のみを共有保持
const editorStateMap = new Map();
const openedFolders = new Set();

function createBlobURL(content, type) {
    return URL.createObjectURL(new Blob([content], { type }));
}

function getMimeType(name) {
    const n = name.toLowerCase();
    if (n.endsWith(".html") || n.endsWith(".htm")) return "text/html";
    if (n.endsWith(".css")) return "text/css";
    if (n.endsWith(".js")) return "text/javascript";
    if (n.endsWith(".json")) return "application/json";
    if (n.endsWith(".png")) return "image/png";
    if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
    if (n.endsWith(".gif")) return "image/gif";
    if (n.endsWith(".svg")) return "image/svg+xml";
    if (n.endsWith(".webp")) return "image/webp";
    if (n.endsWith(".avif")) return "image/avif";
    if (n.endsWith(".mp4")) return "video/mp4";
    if (n.endsWith(".webm")) return "video/webm";
    if (n.endsWith(".ogg") || n.endsWith(".ogv")) return "video/ogg";
    if (n.endsWith(".mp3")) return "audio/mpeg";
    if (n.endsWith(".wav")) return "audio/wav";
    return "text/plain";
}

// 改善後（差し替え用）
const previewCache = new Map();

function collectFilesRecursive(basePath) {
    let targetPath = basePath ? basePath.replace(/^\/+/, "") : "";
    if (targetPath && !targetPath.startsWith("C:") && !targetPath.startsWith("c:")) {
        targetPath = `C:/${targetPath.replace(/^[\/\\]+/, "")}`;
    }

    const result = new Map();
    const visitedPaths = new Set();
    const visitedNodes = new WeakSet();

    function walk(path, depth = 0) {
        if (depth > 12 || visitedPaths.has(path)) return;
        visitedPaths.add(path);

        let node = resolveFS(path);
        if (!node || typeof node !== "object") return;

        // 🔗 リンク（ショートカット）の場合は実体ノードを安全に解決
        if (node.type === "link" && typeof node.target === "string") {
            const targetNode = resolveFS(node.target);
            if (targetNode) node = targetNode;
        }

        if (visitedNodes.has(node)) return;
        visitedNodes.add(node);

        try {
            for (const [name, child] of Object.entries(node)) {
                if (name === "type" || !child || typeof child !== "object") continue;
                const fullPath = path ? `${path}/${name}` : name;

                if (child.type === "folder") {
                    walk(fullPath, depth + 1);
                } else if (child.type === "file" || child.type === "app") {
                    // バイナリやDataURLをそのまま保持するため String() で囲まない
                    result.set(fullPath, child.content ?? "");
                } else if (child.type === "link" && typeof child.target === "string") {
                    const resolvedTargetNode = resolveFS(child.target);
                    if (resolvedTargetNode && resolvedTargetNode.type === "file") {
                        result.set(fullPath, resolvedTargetNode.content ?? "");
                    }
                }
            }
        } finally {
            visitedNodes.delete(node); // 探索完了後に確実に解放
        }
    }

    walk(targetPath);

    if (result.size === 0 && targetPath !== "") {
        walk("");
    }
    return result;
}

function resolveRelativePath(fromPath, relative, rootDir = "C:") {
    if (!relative || /^(https?|data|blob|#):/i.test(relative)) return null;

    // ルートからの絶対パス（例: "/images/video.mp4"）に対応
    if (relative.startsWith("/")) {
        return `${rootDir}${relative}`;
    }

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
    const { path, syscall } = options;
    const win = root.closest(".window");
    const titleEl = win?.querySelector(".title-text");

    async function readFileSafe(targetPath) {
        if (!syscall?.readFile) {
            throw new Error("syscall.readFile が利用できません");
        }
        return await syscall.readFile(targetPath);
    }

    async function writeFileSafe(targetPath, data) {
        if (!syscall?.writeFile) {
            throw new Error("syscall.writeFile が利用できません");
        }
        return await syscall.writeFile(targetPath, data);
    }

    let filePath = path || null;
    let fileNode = filePath ? resolveFS(filePath) : null;
    let dirty = false;
    const untitledId = Date.now().toString(36);
    let baseTitle = filePath?.split("/").pop()?.trim() || `Untitled-${untitledId}`;
    let isDestroyed = false;
    let previewWin = null;
    let previewIframe = null;
    let minimapUpdatePending = false;

    // インスタンス固有の状態（複数ウィンドウ同時起動時の衝突を防止）
    const previewBlobMap = new Map();
    let searchQuery = "";
    let searchIndex = -1;
    let searchStatus = null;
    let searchResultsList = null;
    let selectedSearchLine = -1;
    let searchMatchCase = false;
    let currentDiagnostics = [];
    let currentLang = "plain";
    let currentFoldRanges = {}; // { [visualStartLine]: visualEndLine }
    let foldIdSeq = 1;
    let cachedLineMap = [1];    // visualLineIndex -> realFileLine (1-based)

    const LINE_HEIGHT = 20;
    const PADDING_TOP = 10;
    const FOLD_TOKEN_GLOBAL_RE = / \.\.\.\[\+(\d+):#(\d+)\]/g;
    const FOLD_TOKEN_SINGLE_RE = / \.\.\.\[\+(\d+):#(\d+)\]/;

    /* =========================
       Tabs State
    ========================== */
    const tabs = [];
    let activeTab = null;

    /* =========================
       Helpers (VS Code互換 多形式対応 & バイナリ保護)
    ========================== */
    const CODE_FILE_EXT_RE = /\.(html|htm|xhtml|xml|svg|css|scss|sass|less|js|mjs|cjs|jsx|ts|tsx|vue|svelte|json|jsonc|md|markdown|txt|log|csv|tsv|py|pyw|c|h|cpp|hpp|cc|cxx|cs|java|go|rs|rb|php|swift|kt|kts|lua|dart|sql|sh|bash|zsh|bat|cmd|ps1|yml|yaml|toml|ini|cfg|conf|env|properties|gitignore|url)$/i;
    const SPECIAL_TEXT_NAMES = new Set(["dockerfile", "makefile", "license", "readme", ".gitignore", ".env"]);
    const BINARY_EXT_RE = /\.(png|jpe?g|gif|webp|avif|bmp|ico|mp4|webm|ogv|mov|avi|mkv|mp3|wav|ogg|m4a|flac|aac|pdf|zip|gz|tar|7z|rar|woff2?|ttf|otf|exe|dll)$/i;

    function isCodeFile(name) {
        if (!name || typeof name !== "string") return false;
        const lower = name.toLowerCase();
        return CODE_FILE_EXT_RE.test(lower) || SPECIAL_TEXT_NAMES.has(lower);
    }

    function isKnownBinaryFile(name) {
        return typeof name === "string" && BINARY_EXT_RE.test(name.toLowerCase());
    }

    async function decodeFileDataToText(rawData, fileName = "") {
        if (isKnownBinaryFile(fileName)) {
            return { text: "", isBinary: true };
        }
        if (rawData === null || rawData === undefined) {
            return { text: "", isBinary: false };
        }

        let text = "";
        if (rawData instanceof Blob) {
            if (rawData.type && /^(image|video|audio)\/|application\/(pdf|zip|octet-stream)/i.test(rawData.type) && !/svg/i.test(rawData.type)) {
                return { text: "", isBinary: true };
            }
            text = await rawData.text();
        } else if (rawData instanceof ArrayBuffer || ArrayBuffer.isView(rawData)) {
            text = new TextDecoder("utf-8", { fatal: false }).decode(rawData);
        } else {
            text = String(rawData);
            if (/^data:(image|video|audio|application\/pdf)/i.test(text) && !/^data:image\/svg/i.test(text)) {
                return { text: "", isBinary: true };
            }
        }

        // 先頭4KBにNUL文字が含まれる場合はバイナリとして保護
        if (text.slice(0, 4096).includes("\u0000")) {
            return { text: "", isBinary: true };
        }
        return { text, isBinary: false };
    }

    function ensureTabFoldStore(tab) {
        if (!tab) return null;
        if (!tab.foldStore) tab.foldStore = new Map();
        return tab.foldStore;
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
       UI (VS Code風レイアウト + フローティング検索置換 + ステータスバー)
    ========================== */
    root.innerHTML = `
<div class="editor-shell" style="display:flex;flex-direction:column;width:100%;height:100%;overflow:hidden;background:#1e1e1e;">
<div class="tabbar scrollbar-none" style="display:flex;background:#1b1b1b;border-bottom:1px solid #333;user-select:none;overflow-x:auto;overflow-y:hidden;flex-shrink:0;white-space:nowrap;"></div>
<div class="main-layout" style="display:flex;width:100%;flex:1;min-height:0;overflow:hidden;background:#1e1e1e;">
    <div class="activity-bar" style="width:48px;background:#1a1a1a;display:flex;flex-direction:column;align-items:center;padding-top:5px;border-right:1px solid #111;flex-shrink:0;">
        <div class="activity-icon search-trigger" title="Explorer / Search" style="cursor:pointer;width:100%;height:48px;display:flex;align-items:center;justify-content:center;transition:all 0.2s;border-left:2px solid transparent;">
            <svg class="search-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
        </div>
    </div>
    
    <div class="sidebar" style="width:250px;background:#1a1a1a;color:#ccc;overflow:auto;display:none;border-right:1px solid #222;padding:0;box-sizing:border-box;flex-shrink:0;"></div>
    
    <div class="linenumbers" style="position:relative; width:68px; box-sizing:border-box; color:#858585; background:#1e1e1e; border-right:1px solid #2d2d2d; user-select:none; overflow:hidden; flex-shrink:0;">
        <div class="linenumbers-content" style="position:absolute; top:0; left:0; right:0; will-change:transform;"></div>
    </div>
    
    <div class="codecontainer" style="position:relative;flex:1;display:flex;min-width:0;overflow:hidden;background:#1e1e1e;">
        <div class="active-line-layer" style="position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:0;overflow:hidden;">
            <div class="active-line-bg" style="position:absolute;left:0;width:100%;background:rgba(255,255,255,0.06);display:none;"></div>
        </div>
        
        <pre class="syntax-highlight" aria-hidden="true" style="z-index: 1;"></pre>
        <textarea class="codeeditor" spellcheck="false" wrap="off"></textarea>
        <!-- 対応括弧ハイライト用レイヤー -->
        <div class="bracket-overlay" style="position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:1;overflow:hidden;"></div>
        <!-- 検索ハイライト用レイヤー -->
        <div class="highlight-overlay" style="position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:2;"></div>
        <!-- エラー赤波線用レイヤー -->
        <div class="error-overlay" style="position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:3;"></div>

        <!-- VS Code風 フローティング検索・置換ウィジェット (Ctrl+F / Ctrl+H) -->
        <div class="find-widget" style="display:none;position:absolute;top:8px;right:14px;z-index:20;background:#252526;border:1px solid #454545;box-shadow:0 4px 12px rgba(0,0,0,0.5);padding:6px 8px;border-radius:3px;color:#ccc;font-family:'Segoe UI',sans-serif;font-size:12px;min-width:300px;">
            <div style="display:flex;align-items:center;gap:4px;">
                <input type="text" class="find-input" placeholder="検索 (Enter: 次 / Shift+Enter: 前)" style="flex:1;background:#3c3c3c;color:#fff;border:1px solid #555;padding:3px 6px;outline:none;font-size:12px;">
                <button type="button" class="find-case-btn" title="大文字と小文字を区別" style="background:#333;color:#aaa;border:1px solid #555;padding:2px 5px;cursor:pointer;font-size:11px;">Aa</button>
                <span class="find-count" style="min-width:44px;text-align:center;font-size:11px;color:#999;">0/0</span>
                <button type="button" class="find-prev-btn" title="前を検索 (Shift+Enter)" style="background:transparent;color:#ccc;border:none;cursor:pointer;padding:2px 4px;">↑</button>
                <button type="button" class="find-next-btn" title="次を検索 (Enter)" style="background:transparent;color:#ccc;border:none;cursor:pointer;padding:2px 4px;">↓</button>
                <button type="button" class="find-close-btn" title="閉じる (Esc)" style="background:transparent;color:#ccc;border:none;cursor:pointer;padding:2px 4px;">✕</button>
            </div>
            <div class="replace-row" style="display:none;align-items:center;gap:4px;margin-top:5px;">
                <input type="text" class="replace-input" placeholder="置換後の文字列..." style="flex:1;background:#3c3c3c;color:#fff;border:1px solid #555;padding:3px 6px;outline:none;font-size:12px;">
                <button type="button" class="replace-one-btn" title="1件置換" style="background:#333;color:#ddd;border:1px solid #555;padding:2px 6px;cursor:pointer;font-size:11px;">置換</button>
                <button type="button" class="replace-all-btn" title="すべて置換" style="background:#0e639c;color:#fff;border:1px solid #1177bb;padding:2px 6px;cursor:pointer;font-size:11px;">全置換</button>
            </div>
        </div>
    </div>

    <div class="minimap-container" style="width:60px; background:#1a1a1a; border-left:1px solid #252526; position:relative; flex-shrink:0; cursor:pointer; user-select:none;">
        <canvas class="minimap-canvas" style="width:100%; height:100%; pointer-events:none;"></canvas>
        <div class="minimap-slider" style="position:absolute; top:0; left:0; width:100%; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12); pointer-events:none; box-sizing:border-box; z-index:3;"></div>
    </div>
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
    overflow-anchor: none !important;
}

/* 仮想スクロール行番号＆折りたたみガター */
.gutter-row {
    position: absolute;
    left: 0;
    right: 0;
    height: 20px;
    line-height: 20px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 4px;
    box-sizing: border-box;
    white-space: nowrap;
}
.gutter-row.is-active {
    color: #e0e0e0;
    font-weight: bold;
}
.gutter-num {
    flex: 1;
    text-align: right;
    padding-right: 4px;
}
.fold-toggle {
    width: 16px;
    height: 20px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    color: #858585;
    cursor: pointer;
    border-radius: 2px;
    flex-shrink: 0;
    opacity: 0.7;
}
.fold-toggle:hover {
    background: rgba(255, 255, 255, 0.14);
    color: #ffffff;
    opacity: 1;
}
.fold-toggle.is-folded {
    color: #4fc1ff;
    opacity: 1;
}
.fold-spacer {
    width: 16px;
    flex-shrink: 0;
}

.codeeditor, .syntax-highlight {
    padding: 10px !important; 
    margin: 0 !important;
    border: none !important;
    box-sizing: border-box !important;
    white-space: pre !important; /* 絶対に折り返さない */
    word-break: normal !important;
    overflow-wrap: normal !important;
    width: 100% !important;
    height: 100% !important;
    overflow-anchor: none !important;
}

/* 実際の入力用 textarea */
.codeeditor {
    position: absolute;
    top: 0; left: 0;
    z-index: 2;
    background: transparent !important;
    color: transparent !important; /* 文字自体は下のレイヤーで見せる */
    caret-color: #fff; /* カーソルだけ表示 */
    outline: none;
    resize: none;
    overflow: auto;
    
    /* 【根本修正1】ブラウザが勝手にスクロール位置を調整するのを防ぐ */
    overflow-anchor: none !important;
    
    /* スクロールバーを隠す（同期のズレを防ぐため） */
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE/Edge */
}

.codeeditor::-webkit-scrollbar {
    display: none; /* Chrome/Safari */
}

/* シンタックスハイライト表示層 */
.syntax-highlight {
    position: absolute;
    top: 0; left: 0;
    z-index: 1;
    color: #eaeaea;
    background: transparent !important;
    
    /* 【根本修正2】中身の高さに関わらず、コンテナのサイズに固定してJSでスクロール制御 */
    overflow: hidden !important; 
    pointer-events: none; /* マウス操作を透過させてtextareaに届かせる */
    
    /* transformボケ防止 */
    will-change: transform, scroll-position;
}

/* 検索マッチ等のハイライト層がある場合も同様の設定にする */
.highlight-layer {
    position: absolute;
    top: 0; left: 0;
    z-index: 0;
    width: 100% !important;
    height: 100% !important;
    overflow: hidden !important;
    pointer-events: none;
    white-space: pre !important;
    padding: 10px !important;
    box-sizing: border-box !important;
}

/* 共通項目 */
.hl-keyword   { color: #569cd6; font-weight: bold; }
.hl-string    { color: #ce9178; }
.hl-comment   { color: #6a9955; font-style: italic; }
.hl-number    { color: #b5cea8; }
.hl-bracket   { color: #ffd700; }
.hl-operator  { color: #d4d4d4; }
.hl-angle     { color: #808080; }

/* JavaScript */
.hl-func        { color: #dcdcaa; } /* 関数名 */
.hl-variable    { color: #9cdcfe; } /* 変数名 */
.hl-property_js { color: #9cdcfe; } /* JSプロパティ */
.hl-builtin     { color: #4fc1ff; } /* console等 */

/* HTML */
.hl-tag      { color: #569cd6; }
.hl-attr     { color: #9cdcfe; }
.hl-doctype  { color: #569cd6; font-weight: bold; }

/* CSS */
.hl-selector { color: #d7ba7d; }
.hl-property { color: #9cdcfe; }
.hl-unit     { color: #b5cea8; } /* 単位 (10pxなど) */
.hl-value    { color: #ce9178; } /* CSSの値 */

/* Markdown / INI / プリプロセッサ / 折りたたみバッジ */
.hl-heading    { color: #569cd6; font-weight: bold; }
.hl-meta       { color: #c586c0; }
.hl-fold-badge {
    background: #37373d;
    color: #cccccc;
    border-radius: 3px;
    outline: 1px solid #555555;
}
</style>
`;

    const tabbar = root.querySelector(".tabbar");
    const textarea = root.querySelector(".codeeditor");
    const lineNumbers = root.querySelector(".linenumbers");
    const lineNumbersContent = root.querySelector(".linenumbers-content");
    const errorOverlay = root.querySelector(".error-overlay");
    const highlightOverlay = root.querySelector(".highlight-overlay");
    const sidebar = root.querySelector(".sidebar");
    const syntaxLayer = root.querySelector(".syntax-highlight");

    const activeLineLayer = root.querySelector(".active-line-layer");
    const activeLineBg = root.querySelector(".active-line-bg");

    // フローティング検索・置換ウィジェット & ステータスバー要素
    const findWidget = root.querySelector(".find-widget");
    const findInput = root.querySelector(".find-input");
    const findCaseBtn = root.querySelector(".find-case-btn");
    const findCountEl = root.querySelector(".find-count");
    const findPrevBtn = root.querySelector(".find-prev-btn");
    const findNextBtn = root.querySelector(".find-next-btn");
    const findCloseBtn = root.querySelector(".find-close-btn");
    const replaceRow = root.querySelector(".replace-row");
    const replaceInput = root.querySelector(".replace-input");
    const replaceOneBtn = root.querySelector(".replace-one-btn");
    const replaceAllBtn = root.querySelector(".replace-all-btn");
    const bracketOverlay = root.querySelector(".bracket-overlay");

    // window.js 標準の win._statusBar (.window-statusbar) を使用してステータス項目を構築
    const statusbarEl = win?._statusBar || null;
    let statusDiagEl = null;
    let statusCursorEl = null;
    let statusLangEl = null;

    if (statusbarEl) {
        Object.assign(statusbarEl.style, {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            padding: "0 20px 0 8px", // 右側20pxは window.js の .resize_icon グリップ領域を保護
            boxSizing: "border-box",
            overflow: "hidden",
            userSelect: "none"
        });
        statusbarEl.innerHTML = `
            <span class="ce-status-diag" title="クリックで最初のエラー行へ移動" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;cursor:pointer;">✓ 問題なし</span>
            <span style="display:inline-flex;align-items:center;gap:12px;flex-shrink:0;">
                <span class="ce-status-cursor" title="クリックで行番号ジャンプ (Ctrl+G)" style="cursor:pointer;">Ln 1, Col 1</span>
                <span class="ce-status-indent">Tab: 4</span>
                <span class="ce-status-encoding">UTF-8</span>
                <span class="ce-status-lang" title="クリックで言語モードを切り替え" style="cursor:pointer;text-decoration:underline dotted;">Plain Text</span>
            </span>
        `;
        statusDiagEl = statusbarEl.querySelector(".ce-status-diag");
        statusCursorEl = statusbarEl.querySelector(".ce-status-cursor");
        statusLangEl = statusbarEl.querySelector(".ce-status-lang");
    }

    const LANG_LABELS = {
        js: "JavaScript",
        ts: "TypeScript",
        html: "HTML",
        xml: "XML / SVG",
        css: "CSS",
        json: "JSON",
        python: "Python",
        c: "C / C++ / Java / Go / Rust",
        sql: "SQL",
        shell: "Shell / Script",
        markdown: "Markdown",
        yaml: "YAML",
        ini: "INI / Config",
        plain: "Plain Text"
    };
    const LANG_ORDER = Object.keys(LANG_LABELS);

    /* =========================
       非破壊 折りたたみ（Code Folding）エンジン
    ========================== */
    function expandFoldTokens(text, foldStore, depth = 0) {
        if (!text || !foldStore || foldStore.size === 0 || depth > 20) return text;
        let changed = false;
        const expanded = text.replace(FOLD_TOKEN_GLOBAL_RE, (match, _count, idStr) => {
            const entry = foldStore.get(Number(idStr));
            if (!entry) return match;
            changed = true;
            return "\n" + entry.hiddenLines.join("\n");
        });
        return changed ? expandFoldTokens(expanded, foldStore, depth + 1) : expanded;
    }

    function getFullText(tab = activeTab) {
        if (!tab) return "";
        const raw = (tab === activeTab) ? textarea.value : String(tab.content ?? "");
        return expandFoldTokens(raw, tab.foldStore);
    }

    function countHiddenRealLines(entry, foldStore, depth = 0) {
        if (!entry || depth > 20) return 0;
        let total = entry.hiddenLines.length;
        for (const hl of entry.hiddenLines) {
            const m = hl.match(FOLD_TOKEN_SINGLE_RE);
            if (m && foldStore) {
                const nested = foldStore.get(Number(m[2]));
                if (nested) total += countHiddenRealLines(nested, foldStore, depth + 1);
            }
        }
        return total;
    }

    function rebuildLineMap() {
        const foldStore = activeTab?.foldStore;
        const map = new Array(visualLines.length);
        let realLine = 1;

        for (let i = 0; i < visualLines.length; i++) {
            map[i] = realLine;
            realLine += 1;
            if (foldStore && foldStore.size > 0) {
                const m = visualLines[i].match(FOLD_TOKEN_SINGLE_RE);
                if (m) {
                    const entry = foldStore.get(Number(m[2]));
                    if (entry) realLine += countHiddenRealLines(entry, foldStore);
                }
            }
        }
        cachedLineMap = map;
        return map;
    }

    function realLineToVisualLine(realLineNum) {
        if (!cachedLineMap.length) return 1;
        for (let i = cachedLineMap.length - 1; i >= 0; i--) {
            if (cachedLineMap[i] <= realLineNum) return i + 1;
        }
        return 1;
    }

    function foldBlockAtLine(visualLineIdx) {
        if (!activeTab || activeTab.isBinary) return false;
        const endLine = currentFoldRanges[visualLineIdx];
        if (endLine === undefined || endLine <= visualLineIdx) return false;

        const lines = textarea.value.split("\n");
        if (visualLineIdx < 0 || endLine >= lines.length) return false;
        if (FOLD_TOKEN_SINGLE_RE.test(lines[visualLineIdx])) return false;

        const foldStore = ensureTabFoldStore(activeTab);
        const hiddenLines = lines.slice(visualLineIdx + 1, endLine + 1);
        const id = foldIdSeq++;
        const entry = { id, hiddenLines };
        foldStore.set(id, entry);

        const realHiddenCount = countHiddenRealLines(entry, foldStore);
        const prevScrollTop = textarea.scrollTop;
        const prevScrollLeft = textarea.scrollLeft;

        lines[visualLineIdx] = `${lines[visualLineIdx]} ...[+${realHiddenCount}:#${id}]`;
        lines.splice(visualLineIdx + 1, hiddenLines.length);

        textarea.value = lines.join("\n");
        activeTab.content = textarea.value;
        textarea.scrollTop = prevScrollTop;
        textarea.scrollLeft = prevScrollLeft;

        updateLineNumbers();
        applySyntaxHighlight(true);
        updateActiveLine();
        return true;
    }

    function unfoldBlockAtLine(visualLineIdx) {
        if (!activeTab?.foldStore) return false;
        const lines = textarea.value.split("\n");
        if (visualLineIdx < 0 || visualLineIdx >= lines.length) return false;

        const match = lines[visualLineIdx].match(FOLD_TOKEN_SINGLE_RE);
        if (!match) return false;

        const id = Number(match[2]);
        const entry = activeTab.foldStore.get(id);
        if (!entry) return false;

        const prevScrollTop = textarea.scrollTop;
        const prevScrollLeft = textarea.scrollLeft;

        lines[visualLineIdx] = lines[visualLineIdx].replace(FOLD_TOKEN_SINGLE_RE, "");
        lines.splice(visualLineIdx + 1, 0, ...entry.hiddenLines);
        activeTab.foldStore.delete(id);

        textarea.value = lines.join("\n");
        activeTab.content = textarea.value;
        textarea.scrollTop = prevScrollTop;
        textarea.scrollLeft = prevScrollLeft;

        updateLineNumbers();
        applySyntaxHighlight(true);
        updateActiveLine();
        return true;
    }

    function toggleFoldAtLine(visualLineIdx) {
        const lines = textarea.value.split("\n");
        if (visualLineIdx < 0 || visualLineIdx >= lines.length) return;
        if (FOLD_TOKEN_SINGLE_RE.test(lines[visualLineIdx])) {
            unfoldBlockAtLine(visualLineIdx);
        } else if (currentFoldRanges[visualLineIdx] !== undefined) {
            foldBlockAtLine(visualLineIdx);
        }
    }

    function foldAll() {
        if (!activeTab || activeTab.isBinary) return;
        const ranges = Object.entries(currentFoldRanges)
            .map(([s, e]) => ({ start: Number(s), end: Number(e) }))
            .sort((a, b) => a.start - b.start);

        // トップレベル領域のみを重複なく抽出し、後ろから折りたたむ
        const topLevel = [];
        let coveredEnd = -1;
        for (const r of ranges) {
            if (r.start > coveredEnd) {
                topLevel.push(r);
                coveredEnd = r.end;
            }
        }
        for (let i = topLevel.length - 1; i >= 0; i--) {
            foldBlockAtLine(topLevel[i].start);
        }
    }

    function unfoldAll() {
        if (!activeTab?.foldStore || activeTab.foldStore.size === 0) return;
        const prevScrollTop = textarea.scrollTop;
        const prevScrollLeft = textarea.scrollLeft;

        textarea.value = getFullText(activeTab);
        activeTab.content = textarea.value;
        activeTab.foldStore.clear();

        textarea.scrollTop = prevScrollTop;
        textarea.scrollLeft = prevScrollLeft;

        updateLineNumbers();
        applySyntaxHighlight(true);
        updateActiveLine();
    }

    // ステータスバーの言語名クリックで言語モードを手動切替（VS Code互換）
    statusLangEl?.addEventListener("click", () => {
        if (!activeTab) return;
        const idx = LANG_ORDER.indexOf(currentLang);
        const nextLang = LANG_ORDER[(idx + 1) % LANG_ORDER.length];
        activeTab.forcedLang = nextLang;
        applySyntaxHighlight(true);
    });

    // ステータスバーのエラー表示クリックで最初のエラー行へジャンプ
    statusDiagEl?.addEventListener("click", () => {
        if (!currentDiagnostics.length) return;
        const first = currentDiagnostics[0];
        const visualLine = Math.max(0, realLineToVisualLine(first.line) - 1);
        const lines = textarea.value.split("\n");
        let pos = 0;
        for (let i = 0; i < Math.min(visualLine, lines.length); i++) {
            pos += lines[i].length + 1;
        }
        textarea.focus();
        textarea.setSelectionRange(pos, pos);
        textarea.scrollTop = Math.max(0, visualLine * LINE_HEIGHT - 40);
        updateActiveLine();
    });
    if (statusDiagEl) statusDiagEl.style.cursor = "pointer";

    function updateStatusBar() {
        if (!statusbarEl) return;
        const start = textarea.selectionStart || 0;
        const end = textarea.selectionEnd || 0;
        const val = textarea.value;
        const lastNl = val.lastIndexOf("\n", start - 1);
        const realLineNum = cachedLineMap[currentActiveVisualLine] || (currentActiveVisualLine + 1);
        const colNum = start - lastNl;

        if (statusCursorEl) {
            const selLen = Math.abs(end - start);
            const foldCount = activeTab?.foldStore?.size || 0;
            const foldInfo = foldCount > 0 ? ` [${foldCount} folded]` : "";
            statusCursorEl.textContent = selLen > 0
                ? `Ln ${realLineNum}, Col ${colNum} (${selLen} selected)${foldInfo}`
                : `Ln ${realLineNum}, Col ${colNum}${foldInfo}`;
        }
        if (statusLangEl) {
            statusLangEl.textContent = LANG_LABELS[currentLang] || "Plain Text";
        }
        if (statusDiagEl) {
            if (currentDiagnostics.length > 0) {
                const first = currentDiagnostics[0];
                statusDiagEl.textContent = `✕ ${currentDiagnostics.length} エラー (Ln ${first.line}: ${first.message})`;
                statusDiagEl.style.color = "#b71c1c";
                statusDiagEl.style.fontWeight = "bold";
            } else {
                statusDiagEl.textContent = "✓ 問題なし";
                statusDiagEl.style.color = "";
                statusDiagEl.style.fontWeight = "normal";
            }
        }
    }

    // パフォーマンス用キャッシュ群（スクロール時の split / regex / canvas 生成を完全排除）
    let visualLines = [""];
    let linesVersion = 0;
    let cachedCharWidth = 0;
    let cachedPaddingLeft = 10;
    let minimapRunsCache = [];
    let minimapRunsVersion = -1;
    let minimapRunsLang = "";
    let lastGutterStart = -1;
    let lastGutterEnd = -1;
    let lastGutterActive = -1;
    let lastGutterVersion = -1;
    let lastGutterFoldSig = "";
    let bracketLayer = null;

    function syncVisualLinesCache() {
        visualLines = textarea.value.split("\n");
        linesVersion++;
        rebuildLineMap();
    }

    function getCharMetrics() {
        if (cachedCharWidth > 0) {
            return { charWidth: cachedCharWidth, paddingLeft: cachedPaddingLeft };
        }
        const computed = getComputedStyle(textarea);
        cachedPaddingLeft = parseFloat(computed.paddingLeft) || 10;
        const measureCanvas = document.createElement("canvas");
        const measureCtx = measureCanvas.getContext("2d");
        measureCtx.font = `${computed.fontWeight} ${computed.fontSize} ${computed.fontFamily}`;
        cachedCharWidth = measureCtx.measureText("M").width || 8.4;
        return { charWidth: cachedCharWidth, paddingLeft: cachedPaddingLeft };
    }

    function countNewlinesBefore(str, pos) {
        let count = 0;
        const limit = Math.min(pos, str.length);
        for (let i = 0; i < limit; i++) {
            if (str.charCodeAt(i) === 10) count++;
        }
        return count;
    }

    function getVisualColumnOffset(line, colIndex) {
        let cols = 0;
        const limit = Math.min(colIndex, line.length);
        for (let i = 0; i < limit; i++) {
            cols += line.charCodeAt(i) === 9 ? 4 : 1;
        }
        return cols;
    }

    /* =========================
       対応括弧ハイライト（VS Code互換）
    ========================== */
    const BRACKET_OPEN_TO_CLOSE = { "(": ")", "[": "]", "{": "}" };
    const BRACKET_CLOSE_TO_OPEN = { ")": "(", "]": "[", "}": "{" };

    function updateBracketMatch() {
        if (!bracketOverlay) return;
        bracketOverlay.innerHTML = "";
        bracketLayer = null;

        if (!activeTab || textarea.selectionStart !== textarea.selectionEnd) return;

        const text = textarea.value;
        const pos = textarea.selectionStart;
        let idx = -1;

        if (BRACKET_OPEN_TO_CLOSE[text[pos]] || BRACKET_CLOSE_TO_OPEN[text[pos]]) {
            idx = pos;
        } else if (pos > 0 && (BRACKET_OPEN_TO_CLOSE[text[pos - 1]] || BRACKET_CLOSE_TO_OPEN[text[pos - 1]])) {
            idx = pos - 1;
        }
        if (idx === -1) return;

        const ch = text[idx];
        const isOpen = Boolean(BRACKET_OPEN_TO_CLOSE[ch]);
        const target = isOpen ? BRACKET_OPEN_TO_CLOSE[ch] : BRACKET_CLOSE_TO_OPEN[ch];
        const step = isOpen ? 1 : -1;
        const maxScan = 6000;
        let depth = 0;
        let matchIdx = -1;

        for (let i = idx, steps = 0; i >= 0 && i < text.length && steps < maxScan; i += step, steps++) {
            const c = text[i];
            if (c === ch) depth++;
            else if (c === target) {
                depth--;
                if (depth === 0) {
                    matchIdx = i;
                    break;
                }
            }
        }
        if (matchIdx === -1) return;

        const { charWidth, paddingLeft } = getCharMetrics();
        const inner = document.createElement("div");
        bracketLayer = inner;
        Object.assign(inner.style, {
            position: "absolute",
            top: "0",
            left: "0",
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            willChange: "transform",
            transform: `translate3d(-${textarea.scrollLeft}px, -${textarea.scrollTop}px, 0)`
        });

        for (const p of [idx, matchIdx]) {
            const lineIdx = countNewlinesBefore(text, p);
            const lineStart = text.lastIndexOf("\n", p - 1) + 1;
            const lineStr = visualLines[lineIdx] || "";
            const visualCol = getVisualColumnOffset(lineStr, p - lineStart);
            const box = document.createElement("div");
            Object.assign(box.style, {
                position: "absolute",
                left: `${Math.round(paddingLeft + visualCol * charWidth)}px`,
                top: `${PADDING_TOP + lineIdx * LINE_HEIGHT}px`,
                width: `${Math.ceil(charWidth)}px`,
                height: `${LINE_HEIGHT}px`,
                background: "rgba(0, 122, 204, 0.28)",
                outline: "1px solid rgba(136, 192, 208, 0.7)",
                boxSizing: "border-box"
            });
            inner.appendChild(box);
        }
        bracketOverlay.appendChild(inner);
    }

    let currentActiveVisualLine = 0;

    function updateActiveLine(isScrollOnly = false) {
        if (!activeTab || !activeLineBg) return;

        if (!isScrollOnly) {
            const currentLine = countNewlinesBefore(textarea.value, textarea.selectionStart);
            const lineChanged = currentActiveVisualLine !== currentLine;
            currentActiveVisualLine = currentLine;
            selectedSearchLine = currentLine;

            if (lineChanged) {
                renderGutter(false);
            }
            updateBracketMatch();
            updateStatusBar();
        }

        const topPos = Math.round((currentActiveVisualLine * LINE_HEIGHT) + PADDING_TOP - textarea.scrollTop);
        activeLineBg.style.top = topPos + "px";
        activeLineBg.style.height = LINE_HEIGHT + "px";
        activeLineBg.style.border = "1px solid rgba(255, 255, 255, 0.08)";
        activeLineBg.style.boxSizing = "border-box";
        activeLineBg.style.display = "block";
    }

    // ★追加: サイドバーの検索結果リストの選択状態を更新する関数
    function updateSidebarSelection() {
        if (!searchResultsList) return;
        Array.from(searchResultsList.children).forEach(child => {
            const lineStr = child.textContent.split(":")[0];
            if (!lineStr) return;
            const lineNum = parseInt(lineStr) - 1;
            const isSelected = lineNum === selectedSearchLine;

            child.style.backgroundColor = isSelected ? "#333" : "transparent";
            child.setAttribute("data-selected", isSelected ? "true" : "false");
        });
    }

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

    /* =========================
   Tokenizer & Syntax Utils (CodeEditor用に追加)
========================= */
    function tokenize(line) {
        return line.split(/(\/\/.+|\/\*[\s\S]*?\*\/|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|`[\s\S]*?`|<\/?[a-zA-Z0-9!.-]+|[\w$-]+|[{}().,;+\-*/&|=<>!\[\]:]|[\s]+)/).filter(Boolean);
    }

    function getTokenType(token, filePath, index = 0, tokens = []) {
        const t = token.trim();
        if (!t) return null;
        const ext = filePath ? filePath.split('.').pop().toLowerCase() : '';

        const next = tokens[index + 1]?.trim();
        const prev = tokens[index - 1]?.trim();

        if (t.startsWith("//") || t.startsWith("/*")) return "comment";
        if (/^["'`]/.test(t)) return "string";
        if (/^[0-9]+(\.[0-9]+)?(px|rem|em|%|vh|vw|s|ms|deg)?$/.test(t)) return "number";
        if (/^[{}()\[\]]$/.test(t)) return "bracket";
        if (t === "." || t === "," || t === ";" || t === ":") return null;

        if (ext === 'html' || ext === 'htm') {
            if (t.startsWith('<')) return "tag";
            if (t === '>') return "angle";
            if (t.startsWith('!')) return "doctype";
            if (next === '=' && /^[a-zA-Z-]+$/.test(t)) return "attr";
        }

        if (ext === 'css') {
            if (t.startsWith('.') || t.startsWith('#') || /^(html|body|div|span|a|h[1-6]|p|ul|li|section|header|footer|nav|main)$/.test(t)) {
                return "selector";
            }
            if (next === ':' && /^[a-z-]+$/.test(t)) return "property";
        }

        if (ext === 'js') {
            const keywords = /^(const|let|var|function|return|if|else|for|while|import|export|from|as|default|class|extends|constructor|static|get|set|async|await|new|this|super|try|catch|finally|throw|break|continue|switch|case|of|in|yield|delete|typeof|instanceof|void|null|undefined|true|false)$/;
            if (keywords.test(t)) return "keyword";

            // nexserやAPIを組み込みオブジェクト（builtin）として認識させる
            const builtins = /^(console|window|document|Math|Object|Array|String|Number|Boolean|Promise|JSON|Map|Set|Symbol|Error|Proxy|Reflect|setTimeout|setInterval|fetch|nexser|API)$/;
            if (builtins.test(t)) return "builtin";

            if (next === '(' && /^[a-zA-Z_$][\w$]*$/.test(t)) return "func";
            if (prev === '.' && /^[a-zA-Z_$][\w$]*$/.test(t)) return "property_js";

            if (/^[a-zA-Z_$][\w$]*$/.test(t)) return "variable";
            if (/^[+\-*/&|=<>!%^]+$/.test(t)) return "operator";
        }

        return null;
    }


    // --- シンタックスハイライト・折りたたみ範囲・非同期診断 Worker 連携 ---
    let highlightTask = null;
    let syntaxRequestSeq = 0;

    const syntaxWorker = new Worker(new URL('./worker/syntax.worker.js', import.meta.url), { type: 'module' });

    syntaxWorker.onmessage = (e) => {
        if (isDestroyed) return;
        const { requestId, html, errors, lang, foldRanges } = e.data || {};

        // 古いリクエストの遅延レスポンスは無視して画面の巻き戻りを防止
        if (requestId !== syntaxRequestSeq) return;

        currentLang = lang || "plain";
        currentFoldRanges = foldRanges || {};
        currentDiagnostics = Array.isArray(errors) ? errors : [];

        syntaxLayer.innerHTML = html || "";
        syntaxLayer.scrollTop = textarea.scrollTop;
        syntaxLayer.scrollLeft = textarea.scrollLeft;

        // 折りたたみ可能アイコンを含めてガターを即時再描画
        renderGutter();

        if (currentDiagnostics.length > 0) {
            const mappedErrors = currentDiagnostics.map(err => ({
                ...err,
                line: realLineToVisualLine(err.line || 1)
            }));
            showErrors(mappedErrors);
        } else {
            clearErrorHighlights();
        }
        updateStatusBar();

        if (!minimapUpdatePending) {
            minimapUpdatePending = true;
            requestAnimationFrame(() => {
                updateMinimap();
                minimapUpdatePending = false;
            });
        }
    };

    syntaxWorker.onerror = (err) => {
        console.error("[CodeEditor] syntaxWorker error:", err);
    };

    function applySyntaxHighlight(runDiagnostics = true) {
        if (isDestroyed) return;
        const requestId = ++syntaxRequestSeq;
        const text = textarea.value;
        const fullText = getFullText(activeTab);
        const currentPath = activeTab ? activeTab.path : "";
        const forcedLang = activeTab?.forcedLang || null;

        syntaxWorker.postMessage({ requestId, text, fullText, currentPath, forcedLang, runDiagnostics });
    }

    // 互換用の呼び出し口（診断は Worker 側で並列実行）
    function runErrorCheck() {
        applySyntaxHighlight(true);
    }

    /* =========================
         仮想スクロール・ガター描画（0px誤差・差分スキップでスクロール時DOM生成ゼロ）
      ========================== */
    function renderGutter(force = false) {
        if (!lineNumbersContent || !textarea) return;

        const scrollTop = textarea.scrollTop;
        // GPU コンポジットで textarea の scrollTop と 0px 誤差同期
        lineNumbersContent.style.transform = `translate3d(0, ${-scrollTop}px, 0)`;

        const lineCount = visualLines.length;
        const viewHeight = textarea.clientHeight || 400;

        // 画面に見えている範囲（上下12行バッファ）
        const startLine = Math.max(0, Math.floor((scrollTop - PADDING_TOP) / LINE_HEIGHT) - 12);
        const endLine = Math.min(lineCount - 1, Math.ceil((scrollTop + viewHeight - PADDING_TOP) / LINE_HEIGHT) + 12);
        const foldSig = `${Object.keys(currentFoldRanges).length}:${activeTab?.foldStore?.size || 0}`;

        // 表示範囲・テキスト・アクティブ行・折りたたみ状態に変化がなければDOM操作を完全スキップ
        if (
            !force &&
            startLine === lastGutterStart &&
            endLine === lastGutterEnd &&
            currentActiveVisualLine === lastGutterActive &&
            linesVersion === lastGutterVersion &&
            foldSig === lastGutterFoldSig
        ) {
            return;
        }

        lastGutterStart = startLine;
        lastGutterEnd = endLine;
        lastGutterActive = currentActiveVisualLine;
        lastGutterVersion = linesVersion;
        lastGutterFoldSig = foldSig;

        const frag = document.createDocumentFragment();
        for (let i = startLine; i <= endLine; i++) {
            const row = document.createElement("div");
            row.className = (i === currentActiveVisualLine) ? "gutter-row is-active" : "gutter-row";
            row.style.top = `${PADDING_TOP + i * LINE_HEIGHT}px`;

            const numSpan = document.createElement("span");
            numSpan.className = "gutter-num";
            numSpan.textContent = String(cachedLineMap[i] ?? (i + 1));
            row.appendChild(numSpan);

            const isFolded = FOLD_TOKEN_SINGLE_RE.test(visualLines[i] || "");
            const canFold = currentFoldRanges[i] !== undefined;

            if (isFolded || canFold) {
                const toggle = document.createElement("span");
                toggle.className = isFolded ? "fold-toggle is-folded" : "fold-toggle";
                toggle.dataset.foldLine = String(i);
                toggle.title = isFolded ? "展開 (クリック)" : "折りたたむ (クリック)";
                toggle.textContent = isFolded ? "›" : "⌄";
                row.appendChild(toggle);
            } else {
                const spacer = document.createElement("span");
                spacer.className = "fold-spacer";
                row.appendChild(spacer);
            }

            frag.appendChild(row);
        }

        lineNumbersContent.replaceChildren(frag);
    }

    // ガター上の折りたたみボタンクリックをイベント委譲で処理
    lineNumbers?.addEventListener("click", (e) => {
        const btn = e.target.closest(".fold-toggle");
        if (!btn) return;
        const lineIdx = Number(btn.dataset.foldLine);
        if (!Number.isNaN(lineIdx)) {
            toggleFoldAtLine(lineIdx);
        }
    });

    function updateLineNumbers() {
        syncVisualLinesCache();
        renderGutter(true);
    }

    let highlightLayer = null;

    textarea.addEventListener("scroll", () => {
        const top = textarea.scrollTop;
        const left = textarea.scrollLeft;

        // 1. 仮想ガターは差分スキップ付きで 0px 同期
        renderGutter(false);

        if (syntaxLayer) {
            syntaxLayer.scrollTop = top;
            syntaxLayer.scrollLeft = left;
        }

        // 2. 検索・エラー・対応括弧レイヤーをすべて translate3d で 0px 誤差同期
        if (highlightLayer) {
            highlightLayer.style.transform = `translate3d(-${left}px, -${top}px, 0)`;
        }
        if (errorLayer) {
            errorLayer.style.transform = `translate3d(-${left}px, -${top}px, 0)`;
        }
        if (bracketLayer) {
            bracketLayer.style.transform = `translate3d(-${left}px, -${top}px, 0)`;
        }

        // スクロール時は行番号再計算せず activeLineBg のY座標だけ O(1) 更新
        updateActiveLine(true);

        // 3. ミニマップは1フレームに1回だけ更新
        if (!minimapUpdatePending) {
            minimapUpdatePending = true;
            requestAnimationFrame(() => {
                updateMinimap();
                minimapUpdatePending = false;
            });
        }
    }, { passive: true });
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

    function getMinimapLineRuns(lineIndex) {
        if (minimapRunsVersion !== linesVersion || minimapRunsLang !== currentLang) {
            minimapRunsCache = new Array(visualLines.length);
            minimapRunsVersion = linesVersion;
            minimapRunsLang = currentLang;
        }
        if (minimapRunsCache[lineIndex]) return minimapRunsCache[lineIndex];

        const line = visualLines[lineIndex] || "";
        const runs = [];
        let x = 4;
        const tokens = tokenize(line);

        for (let j = 0; j < tokens.length; j++) {
            const token = tokens[j];
            if (!token) continue;
            if (token.trim() === "") {
                for (let k = 0; k < token.length; k++) {
                    x += (token.charCodeAt(k) === 9 ? 4 : 1) * CHAR_W_PX;
                }
            } else {
                const type = getTokenType(token, activeTab?.path, j, tokens);
                const w = token.length * CHAR_W_PX;
                runs.push([x, w, COLORS[type] || "#6db3d9"]);
                x += w;
            }
        }
        minimapRunsCache[lineIndex] = runs;
        return runs;
    }

    function updateMinimap() {
        if (!textarea || isDestroyed) return;

        const lineCount = visualLines.length || 1;
        const containerW = minimapContainer.clientWidth;
        const containerH = minimapContainer.clientHeight;
        if (containerW === 0 || containerH === 0) return;

        const dpr = window.devicePixelRatio || 1;
        if (minimapCanvas.width !== containerW * dpr || minimapCanvas.height !== containerH * dpr) {
            minimapCanvas.width = containerW * dpr;
            minimapCanvas.height = containerH * dpr;
        }

        minimapCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        minimapCtx.clearRect(0, 0, containerW, containerH);

        const scrollHeight = textarea.scrollHeight || 1;
        const clientHeight = textarea.clientHeight || 1;
        const scrollTop = textarea.scrollTop;
        const maxScrollTop = Math.max(0, scrollHeight - clientHeight);
        const scrollRatio = maxScrollTop > 0 ? scrollTop / maxScrollTop : 0;

        const totalMinimapContentHeight = lineCount * LINE_H_PX;
        let drawOffsetY = 0;
        if (totalMinimapContentHeight > containerH) {
            drawOffsetY = scrollRatio * (totalMinimapContentHeight - containerH);
        }

        const startIndex = Math.max(0, Math.floor(drawOffsetY / LINE_H_PX));
        const endIndex = Math.min(lineCount, Math.ceil((drawOffsetY + containerH) / LINE_H_PX));

        // スクロール時はキャッシュ済みスパンから fillRect のみ実行（正規表現ゼロ）
        for (let i = startIndex; i < endIndex; i++) {
            const y = (i * LINE_H_PX) - drawOffsetY;
            const runs = getMinimapLineRuns(i);
            for (let r = 0; r < runs.length; r++) {
                const run = runs[r];
                minimapCtx.fillStyle = run[2];
                minimapCtx.fillRect(run[0], y, run[1], LINE_H_PX - 0.5);
            }
        }

        const sliderHeight = Math.max(20, (clientHeight / scrollHeight) * containerH);
        const sliderTop = scrollRatio * Math.max(0, containerH - sliderHeight);
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

    // リサイズ監視（ウィンドウサイズ変更時にガター行番号とミニマップを同時再計算）
    const ro = new ResizeObserver(() => {
        requestAnimationFrame(() => {
            renderGutter(true);
            updateMinimap();
        });
    });
    ro.observe(minimapContainer);
    ro.observe(textarea); // エディタ側のサイズ変更も監視

    // ドラッグ操作
    let minimapMouseMoveHandler = null;
    let minimapMouseUpHandler = null;

    minimapContainer.addEventListener("mousedown", (e) => {
        isDraggingMinimap = true;
        handleMinimapInput(e);

        minimapMouseMoveHandler = (ev) => isDraggingMinimap && handleMinimapInput(ev);
        minimapMouseUpHandler = () => {
            isDraggingMinimap = false;
            if (minimapMouseMoveHandler) window.removeEventListener("mousemove", minimapMouseMoveHandler);
            if (minimapMouseUpHandler) window.removeEventListener("mouseup", minimapMouseUpHandler);
            minimapMouseMoveHandler = null;
            minimapMouseUpHandler = null;
        };

        window.addEventListener("mousemove", minimapMouseMoveHandler);
        window.addEventListener("mouseup", minimapMouseUpHandler);
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
        window.nexser?.windowAPI.updateWindowTitle(win, displayName, activeTab.dirty);
    }

    function renderTabs() {
        // 既存の構造を維持：一度リセットして全描画
        tabbar.innerHTML = "";
        tabs.forEach((tab, idx) => {
            const el = document.createElement("div");
            const isActive = tab === activeTab;
            Object.assign(el.style, {
                padding: "8px 12px", // 少し余白を広げる
                cursor: "pointer",
                borderRight: "1px solid #252526",
                borderTop: isActive ? "2px solid #007acc" : "1px solid transparent", // アクティブ時の青ライン
                background: isActive ? "#1e1e1e" : "#2d2d2d", // エディタ背景(#1e1e1e)と統一
                color: isActive ? "#ffffff" : "#969696",
                userSelect: "none",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                minWidth: "120px",
                maxWidth: "200px",
                overflow: "hidden",
                flexShrink: "0"
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
            el.addEventListener("mousedown", e => {
                if (e.button === 1) { // 1 はホイールクリック
                    e.preventDefault();
                    requestCloseTab(tab);
                }
            });
            tabbar.appendChild(el);
        });
    }

    function requestCloseTab(tab) {
        if (tab.dirty) {
            showConfirm(root,
                `"${tab.name}" は未保存です。\n保存して閉じますか？`,
                async () => {
                    try {
                        if (tab === activeTab) {
                            tab.content = textarea.value;
                        }
                        if (!tab.path) {
                            const saved = await saveAs(tab);
                            if (saved) closeTab(tab);
                            return;
                        }
                        isSyncingFS = true;
                        try {
                            await writeFileSafe(tab.path, getFullText(tab));
                        } finally {
                            setTimeout(() => { isSyncingFS = false; }, 50);
                        }
                        tab.dirty = false;
                        closeTab(tab);
                    } catch (err) {
                        console.error("[CodeEditor] Save on close failed:", err);
                        window.nexser?.windowAPI.alertWindow(`保存に失敗しました: ${err.message}`, { title: "CodeEditor", parentWin: win });
                    }
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

            currentFoldRanges = {};
            if (activeTab) {
                textarea.readOnly = Boolean(activeTab.isBinary);
                textarea.value = activeTab.content;
                baseTitle = activeTab.name;
                filePath = activeTab.path;
                fileNode = activeTab.node;
            } else {
                textarea.readOnly = false;
                textarea.value = "";
                baseTitle = "CodeEditor";
                filePath = null;
                fileNode = null;
            }
            updateLineNumbers();
            updateActiveLine();
            applySyntaxHighlight(true);
            if (searchQuery) highlightSearchMatches(searchQuery);
            requestAnimationFrame(updateMinimap);
        }

        dirty = tabs.some(t => t.dirty);

        renderTabs();
        updateTitle();
        renderPreview();
    }

    function switchTab(tab) {
        if (activeTab === tab) return;

        // 1. 現在の状態を保存
        if (activeTab) {
            activeTab.content = textarea.value;
            activeTab.scrollPos = {
                top: textarea.scrollTop,
                left: textarea.scrollLeft
            };
        }

        // 進行中のハイライト処理を完全に止める
        if (highlightTask) {
            cancelAnimationFrame(highlightTask);
            highlightTask = null;
        }
        clearTimeout(highlightTimer);

        // 2. タブ切り替え時は表示レイヤーのみクリア
        if (syntaxLayer) syntaxLayer.innerHTML = "";
        if (lineNumbersContent) lineNumbersContent.replaceChildren();
        currentFoldRanges = {};

        activeTab = tab;
        filePath = tab.path;
        fileNode = tab.node;
        const pos = tab.scrollPos || { top: 0, left: 0 };

        // 3. 内容とスクロール位置の更新
        textarea.readOnly = Boolean(tab.isBinary);
        textarea.value = tab.content;
        textarea.scrollTop = pos.top;
        textarea.scrollLeft = pos.left;

        // 4. UI状態の更新
        dirty = tabs.some(t => t.dirty);
        renderTabs();
        updateTitle();
        updateLineNumbers();
        updateActiveLine();

        // 5. ハイライト＋折りたたみ範囲＋構文診断を Worker へ1回だけ送信
        applySyntaxHighlight(true);

        // 6. スクロール位置の最終同期と表示の調整
        requestAnimationFrame(() => {
            textarea.scrollTop = pos.top;
            textarea.scrollLeft = pos.left;

            if (syntaxLayer) {
                syntaxLayer.scrollTop = pos.top;
                syntaxLayer.scrollLeft = pos.left;
            }
            renderGutter();

            if (typeof updateMinimap === "function") updateMinimap();
        });

        if (searchQuery) highlightSearchMatches(searchQuery);
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

    function askModalInput(title, message, defaultValue = "") {
        return new Promise(resolve => {
            const content = window.nexser?.windowAPI.showModalWindow(title, message, {
                parentWin: win,
                silent: true,
                buttons: [
                    {
                        label: "OK",
                        onClick: () => {
                            const inp = content?.querySelector(".modal-prompt-input");
                            resolve(inp ? inp.value : defaultValue);
                        }
                    },
                    { label: "キャンセル", onClick: () => resolve(null) }
                ]
            });
            if (!content) { resolve(null); return; }

            let promptInput = content.querySelector(".modal-prompt-input");
            if (!promptInput) {
                promptInput = document.createElement("input");
                promptInput.className = "modal-prompt-input";
                promptInput.type = "text";
                promptInput.style.cssText = "width:100%;margin-top:8px;padding:4px;box-sizing:border-box;";
                const btnContainer = content.querySelector(".button-container") || content.querySelector(".modal-button-container") || content.lastElementChild;
                if (btnContainer) content.insertBefore(promptInput, btnContainer);
                else content.appendChild(promptInput);
            }
            promptInput.value = defaultValue;
            promptInput.onkeydown = (ev) => {
                if (ev.key === "Enter") {
                    ev.preventDefault();
                    content.querySelector("button")?.click();
                }
            };
            setTimeout(() => { promptInput.focus(); promptInput.select(); }, 10);
        });
    }

    function createNewFileTab() {
        const newTab = {
            name: `Untitled-${Date.now().toString(36)}.txt`,
            path: null,
            node: null,
            content: "",
            isBinary: false,
            foldStore: new Map(),
            dirty: false
        };
        tabs.push(newTab);
        switchTab(newTab);
        textarea.focus();
    }

    async function goToLine() {
        if (!activeTab) return;
        const maxRealLine = cachedLineMap[cachedLineMap.length - 1] || visualLines.length;
        const input = await askModalInput("行へ移動 (Ctrl+G)", `移動先の行番号を入力してください (1 〜 ${maxRealLine}):`, String(cachedLineMap[currentActiveVisualLine] || 1));
        if (!input) return;

        const targetReal = Math.max(1, Math.min(maxRealLine, parseInt(input.trim(), 10) || 1));
        const visualIdx = Math.max(0, realLineToVisualLine(targetReal) - 1);
        let pos = 0;
        for (let i = 0; i < Math.min(visualIdx, visualLines.length); i++) {
            pos += visualLines[i].length + 1;
        }
        textarea.focus();
        textarea.setSelectionRange(pos, pos);
        textarea.scrollTop = Math.max(0, visualIdx * LINE_HEIGHT - Math.floor((textarea.clientHeight || 300) / 3));
        updateActiveLine(false);
    }

    statusCursorEl?.addEventListener("click", () => goToLine());

    /* =========================
           Format Document (折りたたみ自動展開＋JSON本格整形＋自動整形)
        ========================== */
    function formatDocument() {
        if (!activeTab || activeTab.isBinary) return;
        if (activeTab.foldStore?.size > 0) {
            unfoldAll();
        }
        const text = textarea.value;
        const ext = activeTab.path ? activeTab.path.split('.').pop().toLowerCase() : '';
        let formatted = text;

        if (ext === "json" || currentLang === "json") {
            try {
                formatted = JSON.stringify(JSON.parse(text), null, "\t");
            } catch (_) {
                // 構文エラー時は下のインデント整形へフォールバック
            }
        }

        if (formatted === text && (ext === 'js' || ext === 'ts' || ext === 'css' || ext === 'json' || currentLang === 'js' || currentLang === 'css')) {
            const lines = text.split("\n");
            let indentLevel = 0;
            formatted = lines.map(line => {
                let trimmed = line.trim();
                if (trimmed.startsWith("}") || trimmed.startsWith("]") || trimmed.startsWith("?>")) {
                    indentLevel = Math.max(0, indentLevel - 1);
                }
                const indented = "\t".repeat(indentLevel) + trimmed;
                const openMatches = (trimmed.match(/[{[\(]/g) || []).length;
                const closeMatches = (trimmed.match(/[}\)]/g) || []).length;
                indentLevel += openMatches - closeMatches;
                indentLevel = Math.max(0, indentLevel);
                return indented;
            }).join("\n");
        } else if (ext === 'html' || ext === 'htm' || currentLang === 'html') {
            // コメントやタグの構造を考慮して安全に分割・整形するロジック
            let cleaned = text
                .replace(/<!--[\s\S]*?-->/g, match => match) // コメントを保護
                .replace(/>\s*</g, ">\n<");

            const lines = cleaned.split("\n");
            let indentLevel = 0;

            // 終了タグを必要としないHTMLの空要素（Void Elements）のリスト
            const voidElementsRegex = /^<\s*(area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)\b/i;

            formatted = lines.map(line => {
                let trimmed = line.trim();
                if (!trimmed) return "";

                // 1. 終了タグで始まる場合は、出力前にインデントを1段下げる
                if (trimmed.startsWith("</")) {
                    indentLevel = Math.max(0, indentLevel - 1);
                }

                // インデントを適用（タブ文字）
                const indented = "\t".repeat(indentLevel) + trimmed;

                // 2. タグの種類を判定（空要素やコメント、ドープタイプ、自己閉じタグは除外）
                const isStart = /^<[a-zA-Z0-9-]+[^>]*>/.test(trimmed) &&
                    !trimmed.startsWith("</") &&
                    !trimmed.endsWith("/>") &&
                    !trimmed.startsWith("<!") &&
                    !trimmed.startsWith("<!--") &&
                    !voidElementsRegex.test(trimmed); // ★ meta や link などの空要素を除外！

                const isEnd = /<\/[a-zA-Z0-9-]+>/.test(trimmed);

                // 3. 開始タグで、かつ同一行に終了タグがない場合のみ、次の行からインデントを増やす
                if (isStart && !isEnd) {
                    indentLevel++;
                }

                return indented;
            }).join("\n");
        }

        textarea.value = formatted;
        textarea.dispatchEvent(new Event("input"));
    }

    /* =========================
        Save As / Save (syscall経由・新規保存＆折りたたみ展開保存対応)
     ========================== */
    async function saveAs(targetTab = activeTab) {
        if (!targetTab || targetTab.isBinary) return false;
        if (targetTab === activeTab) {
            targetTab.content = textarea.value;
        }

        const defaultDir = (targetTab.path && getDirPath(targetTab.path))
            || (sidebarRootDir && resolveFS(sidebarRootDir) ? sidebarRootDir : null)
            || (resolveFS("C:/Programs/Documents") ? "C:/Programs/Documents" : "C:/Desktop");

        const defaultFullPath = `${defaultDir.replace(/\/+$/, "")}/${targetTab.name || "untitled.txt"}`;
        const inputPath = await askModalInput("名前を付けて保存", "保存先のパス（例: C:/Desktop/app.js）を入力してください:", defaultFullPath);
        if (!inputPath || !inputPath.trim()) return false;

        const cleanPath = inputPath.trim().replace(/\\/g, "/");
        isSyncingFS = true;
        try {
            const fullSource = getFullText(targetTab);
            await writeFileSafe(cleanPath, fullSource);

            targetTab.path = cleanPath;
            targetTab.name = cleanPath.split("/").pop();
            targetTab.node = resolveFS(cleanPath);
            targetTab.dirty = false;

            if (targetTab === activeTab) {
                filePath = targetTab.path;
                fileNode = targetTab.node;
                baseTitle = targetTab.name;
                if (!sidebarRootDir) sidebarRootDir = getDirPath(cleanPath);
            }

            dirty = tabs.some(t => t.dirty);
            renderTabs();
            updateTitle();
            applySyntaxHighlight(true);

            if (previewWin && document.body.contains(previewWin)) {
                await renderPreview();
            }
            return true;
        } catch (err) {
            console.error("[CodeEditor] Save As failed:", err);
            window.nexser?.windowAPI.alertWindow(`保存に失敗しました: ${err.message}`, { title: "CodeEditor", parentWin: win });
            return false;
        } finally {
            setTimeout(() => { isSyncingFS = false; }, 50);
        }
    }

    async function save() {
        if (activeTab) {
            if (activeTab.isBinary) return true;
            activeTab.content = textarea.value;

            // 新規タブ（path未設定）の場合は「名前を付けて保存」へ誘導
            if (!activeTab.path) {
                return await saveAs(activeTab);
            }
        }

        // 他に未保存の新規タブがあれば順次「名前を付けて保存」を実行
        const dirtyUntitledTabs = tabs.filter(tab => !tab.path && !tab.isBinary && tab.dirty);
        for (const uTab of dirtyUntitledTabs) {
            const saved = await saveAs(uTab);
            if (!saved) return false;
        }

        const dirtyTabs = tabs.filter(tab => tab.path && !tab.isBinary && tab.dirty);
        if (dirtyTabs.length === 0 && activeTab?.path && !activeTab.isBinary) {
            dirtyTabs.push(activeTab);
        }

        isSyncingFS = true;
        try {
            for (const tab of dirtyTabs) {
                const fullSource = getFullText(tab);
                await writeFileSafe(tab.path, fullSource);
                tab.node = resolveFS(tab.path);
                tab.dirty = false;
            }

            dirty = tabs.some(t => t.dirty);
            renderTabs();
            updateTitle();

            if (previewWin && document.body.contains(previewWin)) {
                await renderPreview();
            }
            return true;
        } catch (err) {
            console.error("[CodeEditor] Save failed:", err);
            window.nexser?.windowAPI.alertWindow(`保存に失敗しました: ${err.message}`, { title: "CodeEditor", parentWin: win });
            return false;
        } finally {
            setTimeout(() => {
                isSyncingFS = false;
            }, 50);
        }
    }

    function highlightSearchMatches(query) {
        // 1. 既存のハイライトと検索リストを完全にクリア (errorOverlay ではなく highlightOverlay を操作)
        highlightOverlay.innerHTML = "";
        if (searchResultsList) {
            searchResultsList.innerHTML = "";
            searchResultsList.style.display = "none";
        }

        if (!query || query.trim() === "") {
            if (searchStatus) searchStatus.textContent = "";
            highlightLayer = null;
            selectedSearchLine = -1;
            return;
        }

        const lines = visualLines;
        const { charWidth, paddingLeft } = getCharMetrics();
        const tabSize = 4;

        const innerContainer = document.createElement("div");
        highlightLayer = innerContainer;

        Object.assign(innerContainer.style, {
            position: "absolute",
            top: "0", left: "0", height: "100%", width: "100%",
            overflow: "visible", pointerEvents: "none", willChange: "transform"
        });

        const targetQuery = searchMatchCase ? query : query.toLowerCase();
        const matchWidth = query.length * charWidth;

        let matchCount = 0;
        const MAX_HIGHLIGHT_DOMS = 500;
        const MAX_LIST_ITEMS = 100;

        let absoluteOffset = 0;

        const highlightFragment = document.createDocumentFragment();
        const listFragment = document.createDocumentFragment();

        const highlightStyleTpl = {
            position: "absolute",
            width: Math.round(matchWidth) + "px",
            height: `${LINE_HEIGHT}px`,
            backgroundColor: "rgba(255, 255, 0, 0.4)",
            borderRadius: "2px"
        };

        lines.forEach((line, i) => {
            let start = 0;
            let idx;
            const targetLine = searchMatchCase ? line : line.toLowerCase();
            const lineTop = Math.round((i * LINE_HEIGHT) + PADDING_TOP);

            while ((idx = targetLine.indexOf(targetQuery, start)) !== -1) {
                matchCount++;
                const absoluteIdx = absoluteOffset + idx;

                if (matchCount <= MAX_HIGHLIGHT_DOMS) {
                    const beforeText = line.substring(0, idx);
                    const visualCharCount = beforeText.replace(/\t/g, ' '.repeat(tabSize)).length;
                    const leftOffset = Math.round(paddingLeft + (visualCharCount * charWidth)); // ★ 正しく * に修正

                    const div = document.createElement("div");
                    Object.assign(div.style, highlightStyleTpl, {
                        left: leftOffset + "px",
                        top: lineTop + "px" // ★ 正しく * で計算されたY座標を適用
                    });
                    highlightFragment.appendChild(div);
                }

                if (searchResultsList && matchCount <= MAX_LIST_ITEMS) {
                    const item = document.createElement("div");
                    const isSelected = i === selectedSearchLine;

                    Object.assign(item.style, {
                        padding: "4px 6px",
                        cursor: "pointer",
                        borderBottom: "1px solid #222",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        fontSize: "12px",
                        backgroundColor: isSelected ? "#333" : "transparent"
                    });
                    item.setAttribute("data-selected", isSelected ? "true" : "false");
                    item.textContent = `${i + 1}: ${line.trim()}`;

                    item.onmouseenter = () => { if (item.getAttribute("data-selected") !== "true") item.style.backgroundColor = "#2a2a2a"; };
                    item.onmouseleave = () => { if (item.getAttribute("data-selected") !== "true") item.style.backgroundColor = "transparent"; };

                    item.onclick = () => {
                        textarea.focus();
                        textarea.setSelectionRange(absoluteIdx, absoluteIdx + query.length);
                        scrollToIndex(absoluteIdx);
                        searchIndex = absoluteIdx;
                        updateActiveLine();
                        updateSidebarSelection();
                    };

                    listFragment.appendChild(item);
                }
                start = idx + query.length;
            }
            absoluteOffset += line.length + 1;
        });

        innerContainer.appendChild(highlightFragment);

        if (searchResultsList && matchCount > 0) {
            searchResultsList.appendChild(listFragment);
            searchResultsList.style.display = "block";
        }

        if (searchStatus) {
            if (matchCount > 0) {
                searchStatus.style.color = "#aaa";
                searchStatus.textContent = `${matchCount} 件見つかりました` + (matchCount > MAX_HIGHLIGHT_DOMS ? " (一部のみ強調)" : "");
            } else {
                searchStatus.style.color = "#f66";
                searchStatus.textContent = `"${query}" は見つかりません`;
            }
        }

        highlightOverlay.style.overflow = "hidden";
        highlightOverlay.appendChild(innerContainer);

        if (highlightLayer) {
            highlightLayer.style.transform = `translate3d(-${textarea.scrollLeft}px, -${textarea.scrollTop}px, 0)`;
        }
    }


    function scrollToIndex(index) {
        const textUpToIndex = textarea.value.slice(0, index);
        const lineNumber = textUpToIndex.split("\n").length - 1;
        const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 18;
        const paddingTop = parseFloat(getComputedStyle(textarea).paddingTop) || 0;

        textarea.scrollTop = lineNumber * lineHeight - paddingTop;
    }
    function getMatchPositions(text, query) {
        if (!query) return [];
        const haystack = searchMatchCase ? text : text.toLowerCase();
        const needle = searchMatchCase ? query : query.toLowerCase();
        const positions = [];
        let pos = 0;
        while ((pos = haystack.indexOf(needle, pos)) !== -1) {
            positions.push(pos);
            pos += Math.max(1, needle.length);
        }
        return positions;
    }

    function updateFindCounter(positions = null) {
        if (!findCountEl) return;
        if (!searchQuery) {
            findCountEl.textContent = "0/0";
            return;
        }
        const list = positions || getMatchPositions(textarea.value, searchQuery);
        if (list.length === 0) {
            findCountEl.textContent = "0/0";
            return;
        }
        const currentIdx = list.indexOf(searchIndex);
        findCountEl.textContent = `${currentIdx === -1 ? 1 : currentIdx + 1}/${list.length}`;
    }

    function openFindWidget(showReplace = false) {
        if (!findWidget || !findInput) return;
        findWidget.style.display = "block";
        if (replaceRow) replaceRow.style.display = showReplace ? "flex" : "none";

        const selectedText = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);
        if (selectedText && !selectedText.includes("\n")) {
            findInput.value = selectedText;
            searchQuery = selectedText;
            highlightSearchMatches(searchQuery);
        } else if (searchQuery) {
            findInput.value = searchQuery;
        }
        updateFindCounter();
        findInput.focus();
        findInput.select();
    }

    function closeFindWidget() {
        if (!findWidget) return;
        findWidget.style.display = "none";
        textarea.focus();
    }

    function replaceCurrentMatch() {
        if (!searchQuery || !activeTab || activeTab.isBinary) return;
        const replacement = replaceInput ? replaceInput.value : "";
        const selStart = textarea.selectionStart;
        const selEnd = textarea.selectionEnd;
        const selected = textarea.value.slice(selStart, selEnd);
        const isMatched = searchMatchCase
            ? selected === searchQuery
            : selected.toLowerCase() === searchQuery.toLowerCase();

        if (isMatched) {
            if (FOLD_TOKEN_SINGLE_RE.test(selected)) {
                unfoldAll();
            }
            textarea.setRangeText(replacement, selStart, selEnd, "end");
            searchIndex = selStart + replacement.length - 1;
            textarea.dispatchEvent(new Event("input"));
        }
        findNext();
    }

    function replaceAllMatches() {
        if (!searchQuery || !activeTab || activeTab.isBinary) return;
        if (activeTab.foldStore?.size > 0) {
            unfoldAll();
        }
        const replacement = replaceInput ? replaceInput.value : "";
        const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(escaped, searchMatchCase ? "g" : "gi");
        const nextVal = textarea.value.replace(regex, replacement);
        if (nextVal !== textarea.value) {
            textarea.value = nextVal;
            searchIndex = -1;
            textarea.dispatchEvent(new Event("input"));
        }
        updateFindCounter();
    }

    findInput?.addEventListener("input", () => {
        searchQuery = findInput.value;
        searchIndex = -1;
        highlightSearchMatches(searchQuery);
        updateFindCounter();
    });
    findInput?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            searchQuery = findInput.value;
            if (e.shiftKey) findPrevious();
            else findNext();
        } else if (e.key === "Escape") {
            e.preventDefault();
            closeFindWidget();
        }
    });
    replaceInput?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            replaceCurrentMatch();
        } else if (e.key === "Escape") {
            e.preventDefault();
            closeFindWidget();
        }
    });
    findCaseBtn?.addEventListener("click", () => {
        searchMatchCase = !searchMatchCase;
        findCaseBtn.style.background = searchMatchCase ? "#0e639c" : "#333";
        findCaseBtn.style.color = searchMatchCase ? "#fff" : "#aaa";
        if (searchQuery) highlightSearchMatches(searchQuery);
        updateFindCounter();
    });
    findPrevBtn?.addEventListener("click", () => findPrevious());
    findNextBtn?.addEventListener("click", () => findNext());
    findCloseBtn?.addEventListener("click", () => closeFindWidget());
    replaceOneBtn?.addEventListener("click", () => replaceCurrentMatch());
    replaceAllBtn?.addEventListener("click", () => replaceAllMatches());

    function findNext() {
        if (!searchQuery || !activeTab) return;

        const text = textarea.value;
        const positions = getMatchPositions(text, searchQuery);

        if (positions.length === 0) {
            searchIndex = -1;
            if (searchStatus) searchStatus.textContent = `"${searchQuery}" は見つかりません`;
            updateFindCounter(positions);
            return;
        }

        const nextPos = positions.find(p => p > searchIndex) ?? positions[0];
        textarea.focus();
        textarea.setSelectionRange(nextPos, nextPos + searchQuery.length);
        scrollToIndex(nextPos);
        searchIndex = nextPos;

        if (searchStatus) searchStatus.textContent = "";
        updateFindCounter(positions);
        updateActiveLine();
        updateSidebarSelection();
    }

    function findPrevious() {
        if (!searchQuery || !activeTab) return;

        const text = textarea.value;
        const positions = getMatchPositions(text, searchQuery);

        if (positions.length === 0) {
            searchIndex = -1;
            if (searchStatus) searchStatus.textContent = `"${searchQuery}" は見つかりません`;
            updateFindCounter(positions);
            return;
        }

        let prevPos = positions[positions.length - 1];
        for (let i = positions.length - 1; i >= 0; i--) {
            if (positions[i] < searchIndex) {
                prevPos = positions[i];
                break;
            }
        }

        textarea.focus();
        textarea.setSelectionRange(prevPos, prevPos + searchQuery.length);
        scrollToIndex(prevPos);
        searchIndex = prevPos;

        if (searchStatus) searchStatus.textContent = "";
        updateFindCounter(positions);
        updateActiveLine();
        updateSidebarSelection();
    }

    /* =========================
           Error Highlight (根本修正版)
        ========================== */
    let errorLayer = null;

    function clearErrorHighlights() {
        errorOverlay.innerHTML = "";
        errorLayer = null;
    }

    function showErrors(errors = []) {
        clearErrorHighlights();
        const { charWidth, paddingLeft } = getCharMetrics();

        const inner = document.createElement("div");
        errorLayer = inner;
        Object.assign(inner.style, {
            position: "absolute",
            top: "0", left: "0", width: "100%", height: "100%",
            pointerEvents: "none",
            willChange: "transform"
        });

        const allLines = visualLines;
        errors.forEach(err => {
            const lineIdx = Math.max(0, (err.line || 1) - 1);
            const lineText = allLines[lineIdx] || "";
            const col = err.column ? err.column - 1 : 0;
            const length = err.length || Math.max(1, lineText.trim().length - col);

            const leftOffset = paddingLeft + (col * charWidth);
            const width = length * charWidth;
            const topPos = (lineIdx * LINE_HEIGHT) + PADDING_TOP + LINE_HEIGHT - 4;

            const svgWave = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            const safeWidth = Math.max(10, width);
            svgWave.setAttribute("viewBox", `0 0 ${safeWidth} 4`);
            Object.assign(svgWave.style, {
                position: "absolute",
                left: `${leftOffset}px`,
                top: `${topPos}px`,
                width: `${safeWidth}px`,
                height: "4px",
                overflow: "visible",
                pointerEvents: "none"
            });

            const waveWidth = 8;
            let pathD = "M 0 3";
            for (let x = 0; x < safeWidth; x += waveWidth) {
                pathD += ` Q ${x + 2} 0, ${x + 4} 3 T ${x + waveWidth} 3`;
            }

            svgWave.innerHTML = `<path d="${pathD}" fill="none" stroke="#f44336" stroke-width="1.5"/>`;
            inner.appendChild(svgWave);
        });

        errorOverlay.appendChild(inner);

        // スクロール位置と完全に同期させる
        if (errorLayer) {
            errorLayer.style.transform = `translate3d(-${textarea.scrollLeft}px, -${textarea.scrollTop}px, 0)`;
        }
    }

    // CodeEditor関数内の上部（変数定義エリア）にタイマー変数を追加
    let highlightTimer = null;

    // --- 最適化後の input イベント（Worker一括実行 + デバウンス） ---
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
        updateActiveLine();

        clearTimeout(highlightTimer);
        highlightTimer = setTimeout(() => {
            // 1. シンタックスハイライト + 構文診断を Worker へ1回だけ送信
            applySyntaxHighlight(true);

            // 2. 検索ヒットのハイライト
            if (searchQuery && searchQuery.trim() !== "") {
                highlightSearchMatches(searchQuery);
                updateFindCounter();
            } else {
                if (highlightOverlay) highlightOverlay.innerHTML = "";
                highlightLayer = null;
            }
        }, 24);
    });

    textarea.addEventListener("click", () => {
        updateActiveLine();
        updateSidebarSelection();
    });

    // マウスドラッグでの選択範囲変更もステータスバー・括弧ハイライトへ即座に反映
    textarea.addEventListener("mouseup", () => {
        updateActiveLine();
    });

    textarea.addEventListener("select", () => {
        updateActiveLine();
    });

    textarea.addEventListener("keyup", (e) => {
        if (e.isComposing || e.keyCode === 229) return;
        // 十字キーなどのカーソル移動で行が変わった場合
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(e.key)) {
            updateActiveLine();
            updateSidebarSelection();
        }
    });

    textarea.addEventListener("focus", updateActiveLine);

    const AUTO_PAIRS = { "(": ")", "[": "]", "{": "}", '"': '"', "'": "'", "`": "`" };
    const CLOSING_CHARS = new Set([")", "]", "}", '"', "'", "`"]);

    // 折りたたみブロックを含む範囲をコピーした際、元の展開済みテキストをクリップボードへ渡す
    textarea.addEventListener("copy", (e) => {
        if (!activeTab?.foldStore || activeTab.foldStore.size === 0) return;
        const sel = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);
        if (sel && FOLD_TOKEN_SINGLE_RE.test(sel) && e.clipboardData) {
            e.preventDefault();
            e.clipboardData.setData("text/plain", expandFoldTokens(sel, activeTab.foldStore));
        }
    });

    textarea.addEventListener("keydown", (e) => {
        // 日本語 IME 変換確定中（Enter 等）はブラウザの標準動作に任せる
        if (e.isComposing || e.keyCode === 229) return;

        // プレビュー起動 (Ctrl+Enter) は改行させず即座にプレビューのみ実行
        if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            openPreview();
            return;
        }

        // VS Code風 フローティング検索 (Ctrl+F) / 置換 (Ctrl+H) / Esc / F3 は読み取り専用でも許可
        if (e.ctrlKey && e.key.toLowerCase() === "f") {
            e.preventDefault();
            e.stopPropagation();
            openFindWidget(false);
            return;
        }
        if (e.ctrlKey && e.key.toLowerCase() === "h") {
            e.preventDefault();
            e.stopPropagation();
            openFindWidget(true);
            return;
        }
        if (e.key === "Escape" && findWidget && findWidget.style.display !== "none") {
            e.preventDefault();
            e.stopPropagation();
            closeFindWidget();
            return;
        }
        if (e.key === "F3") {
            e.preventDefault();
            if (e.shiftKey) findPrevious();
            else findNext();
            return;
        }

        // バイナリ表示中はすべての編集系ショートカットを遮断
        if (activeTab?.isBinary) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;

        // VS Code互換 折りたたみショートカット (Ctrl+Shift+[ で折りたたむ / Ctrl+Shift+] で展開)
        if (e.ctrlKey && e.shiftKey && (e.key === "[" || e.key === "{")) {
            e.preventDefault();
            const curLine = countNewlinesBefore(text, start);
            foldBlockAtLine(curLine);
            return;
        }
        if (e.ctrlKey && e.shiftKey && (e.key === "]" || e.key === "}")) {
            e.preventDefault();
            const curLine = countNewlinesBefore(text, start);
            unfoldBlockAtLine(curLine);
            return;
        }

        // 折りたたみトークン上にカーソルがある状態で編集キーを押した場合は自動展開してデータ破損を防止
        if (activeTab?.foldStore?.size > 0 && !e.ctrlKey && !e.altKey && !e.metaKey && (e.key.length === 1 || e.key === "Backspace" || e.key === "Delete" || e.key === "Enter")) {
            const curLineIdx = countNewlinesBefore(text, start);
            const lineStartPos = text.lastIndexOf("\n", start - 1) + 1;
            const lineEndIdx = text.indexOf("\n", start);
            const curLineText = text.slice(lineStartPos, lineEndIdx === -1 ? text.length : lineEndIdx);
            const tokenMatch = curLineText.match(FOLD_TOKEN_SINGLE_RE);
            if (tokenMatch) {
                const tokenStartAbs = lineStartPos + tokenMatch.index;
                if (end >= tokenStartAbs) {
                    unfoldBlockAtLine(curLineIdx);
                    return;
                }
            }
        }

        // 1. Tab / Shift+Tab（単一行・複数行一括インデント & アンインデント）
        if (e.key === "Tab" && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            const hasMultiLineSelection = text.slice(start, end).includes("\n");

            if (e.shiftKey || hasMultiLineSelection) {
                const lineStart = text.lastIndexOf("\n", start - 1) + 1;
                const lineEndIdx = text.indexOf("\n", end);
                const lineEnd = lineEndIdx === -1 ? text.length : lineEndIdx;
                const block = text.slice(lineStart, lineEnd);
                const lines = block.split("\n");

                let firstLineDelta = 0;
                const updated = lines.map((line, i) => {
                    if (e.shiftKey) {
                        if (line.startsWith("\t")) {
                            if (i === 0) firstLineDelta = -1;
                            return line.slice(1);
                        }
                        const spaces = line.match(/^ {1,4}/);
                        if (spaces) {
                            if (i === 0) firstLineDelta = -spaces[0].length;
                            return line.slice(spaces[0].length);
                        }
                        return line;
                    } else {
                        if (i === 0) firstLineDelta = 1;
                        return "\t" + line;
                    }
                }).join("\n");

                const totalDelta = updated.length - block.length;
                textarea.setRangeText(updated, lineStart, lineEnd, "preserve");
                textarea.setSelectionRange(
                    Math.max(lineStart, start + firstLineDelta),
                    Math.max(lineStart, end + totalDelta)
                );
            } else {
                textarea.setRangeText("\t", start, end, "end");
            }
            textarea.dispatchEvent(new Event("input"));
            return;
        }

        // 2. 自動括弧・クォート補完 / 選択テキストの囲み / 閉じ文字スキップ
        if (!e.ctrlKey && !e.altKey && !e.metaKey) {
            if (AUTO_PAIRS[e.key]) {
                const closeChar = AUTO_PAIRS[e.key];
                const nextChar = text[end] || "";

                // 同一クォートの直前なら上書きスキップ（Overtype）
                if (start === end && e.key === closeChar && nextChar === closeChar) {
                    e.preventDefault();
                    textarea.setSelectionRange(start + 1, start + 1);
                    updateActiveLine();
                    return;
                }

                // 選択範囲がある場合は選択文字列を括弧で囲む
                if (start !== end) {
                    e.preventDefault();
                    const selected = text.slice(start, end);
                    textarea.setRangeText(e.key + selected + closeChar, start, end, "preserve");
                    textarea.setSelectionRange(start + 1, end + 1);
                    textarea.dispatchEvent(new Event("input"));
                    return;
                }

                // 単語の直前でない場合のみ自動閉じを挿入
                if (!/[\w$]/.test(nextChar)) {
                    e.preventDefault();
                    textarea.setRangeText(e.key + closeChar, start, end, "preserve");
                    textarea.setSelectionRange(start + 1, start + 1);
                    textarea.dispatchEvent(new Event("input"));
                    return;
                }
            } else if (CLOSING_CHARS.has(e.key) && start === end && text[start] === e.key) {
                e.preventDefault();
                textarea.setSelectionRange(start + 1, start + 1);
                updateActiveLine();
                return;
            }
        }

        // 3. 空ペアの Backspace 同時削除（例: `(|)` -> Backspace で両方消す）
        if (e.key === "Backspace" && !e.ctrlKey && !e.altKey && !e.metaKey && start === end && start > 0) {
            const prevChar = text[start - 1];
            const nextChar = text[start];
            if (AUTO_PAIRS[prevChar] === nextChar) {
                e.preventDefault();
                textarea.setRangeText("", start - 1, start + 1, "end");
                textarea.dispatchEvent(new Event("input"));
                return;
            }
        }

        // 4. Smart Enter（括弧展開 `{|}` と自動インデント増加 — 修飾キーなしのみ反応）
        if (e.key === "Enter" && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            const textUpToCursor = text.slice(0, start);
            const currentLineStart = textUpToCursor.lastIndexOf("\n") + 1;
            const currentLine = text.slice(currentLineStart, start);
            const indentMatch = currentLine.match(/^[\t ]*/);
            const indent = indentMatch ? indentMatch[0] : "";

            const prevNonSpace = currentLine.trimEnd().slice(-1);
            const nextChar = text[end] || "";
            const isBracketExpand =
                (prevNonSpace === "{" && nextChar === "}") ||
                (prevNonSpace === "[" && nextChar === "]") ||
                (prevNonSpace === "(" && nextChar === ")");

            if (isBracketExpand) {
                const insertText = `\n${indent}\t\n${indent}`;
                textarea.setRangeText(insertText, start, end, "preserve");
                const newPos = start + 1 + indent.length + 1;
                textarea.setSelectionRange(newPos, newPos);
            } else {
                const extraIndent = /[\{\[\(:]$/.test(currentLine.trimEnd()) ? "\t" : "";
                const insertText = "\n" + indent + extraIndent;
                textarea.setRangeText(insertText, start, end, "end");
            }

            textarea.dispatchEvent(new Event("input"));
            requestAnimationFrame(() => {
                updateActiveLine();
                updateSidebarSelection();
            });
            return;
        }

        // 5. 行の上下移動 (Alt + ↑/↓) & 行複製 (Shift + Alt + ↑/↓)
        if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
            e.preventDefault();
            const lines = text.split("\n");
            const startLine = text.slice(0, start).split("\n").length - 1;
            const endLine = text.slice(0, end).split("\n").length - 1;

            if (e.shiftKey) {
                // 行の複製
                const block = lines.slice(startLine, endLine + 1);
                const insertAt = e.key === "ArrowUp" ? startLine : endLine + 1;
                lines.splice(insertAt, 0, ...block);
                textarea.value = lines.join("\n");
                const offset = e.key === "ArrowDown" ? block.join("\n").length + 1 : 0;
                textarea.setSelectionRange(start + offset, end + offset);
                textarea.dispatchEvent(new Event("input"));
                return;
            }

            // 行の移動
            if (e.key === "ArrowUp" && startLine > 0) {
                const moving = lines.splice(startLine, endLine - startLine + 1);
                const swappedLineLen = lines[startLine - 1].length + 1;
                lines.splice(startLine - 1, 0, ...moving);
                textarea.value = lines.join("\n");
                textarea.setSelectionRange(Math.max(0, start - swappedLineLen), Math.max(0, end - swappedLineLen));
                textarea.dispatchEvent(new Event("input"));
            } else if (e.key === "ArrowDown" && endLine < lines.length - 1) {
                const moving = lines.splice(startLine, endLine - startLine + 1);
                const swappedLineLen = lines[startLine].length + 1;
                lines.splice(startLine + 1, 0, ...moving);
                textarea.value = lines.join("\n");
                textarea.setSelectionRange(start + swappedLineLen, end + swappedLineLen);
                textarea.dispatchEvent(new Event("input"));
            }
            return;
        }

        // 6. 現在行の削除 (Ctrl + Shift + K)
        if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "k") {
            e.preventDefault();
            const lines = text.split("\n");
            const startLine = text.slice(0, start).split("\n").length - 1;
            const endLine = text.slice(0, end).split("\n").length - 1;
            lines.splice(startLine, endLine - startLine + 1);
            const nextVal = lines.join("\n");
            const lineStartPos = lines.slice(0, Math.min(startLine, lines.length)).join("\n").length;
            textarea.value = nextVal;
            const caret = Math.min(nextVal.length, startLine > 0 ? lineStartPos + 1 : 0);
            textarea.setSelectionRange(caret, caret);
            textarea.dispatchEvent(new Event("input"));
            return;
        }

        if (e.key === "Backspace" || e.key === "Delete") {
            requestAnimationFrame(() => {
                updateActiveLine();
                updateSidebarSelection();
            });
        }

        if (e.shiftKey && e.altKey && e.key.toLowerCase() === "f") {
            e.preventDefault();
            formatDocument();
            return;
        }

        // 多言語コメントアウト機能 (Ctrl + /)
        if (e.ctrlKey && e.key === "/") {
            e.preventDefault();
            const lines = text.split("\n");
            const startLine = countNewlinesBefore(text, start);
            const endLine = countNewlinesBefore(text, end);

            const isBlockHtml = currentLang === "html" || currentLang === "xml";
            const isBlockCss = currentLang === "css";
            const linePrefix = (currentLang === "python" || currentLang === "shell" || currentLang === "yaml" || currentLang === "ini")
                ? "#"
                : (currentLang === "sql" ? "--" : "//");

            let allCommented = true;
            for (let i = startLine; i <= endLine; i++) {
                const trimmed = lines[i].trim();
                if (isBlockHtml) {
                    if (!trimmed.startsWith("<!--") || !trimmed.endsWith("-->")) { allCommented = false; break; }
                } else if (isBlockCss) {
                    if (!trimmed.startsWith("/*") || !trimmed.endsWith("*/")) { allCommented = false; break; }
                } else {
                    if (!trimmed.startsWith(linePrefix)) { allCommented = false; break; }
                }
            }

            const escapedPrefix = linePrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const removeLineRe = new RegExp(`^([\\t ]*)${escapedPrefix} ?`);

            for (let i = startLine; i <= endLine; i++) {
                const indentMatch = lines[i].match(/^[\t ]*/);
                const indent = indentMatch ? indentMatch[0] : "";
                const body = lines[i].slice(indent.length);

                if (isBlockHtml) {
                    lines[i] = allCommented
                        ? lines[i].replace(/^([\t ]*)<!--\s?/, "$1").replace(/\s?-->\s*$/, "")
                        : `${indent}<!-- ${body} -->`;
                } else if (isBlockCss) {
                    lines[i] = allCommented
                        ? lines[i].replace(/^([\t ]*)\/\*\s?/, "$1").replace(/\s?\*\/\s*$/, "")
                        : `${indent}/* ${body} */`;
                } else {
                    lines[i] = allCommented
                        ? lines[i].replace(removeLineRe, "$1")
                        : (body ? `${indent}${linePrefix} ${body}` : `${indent}${linePrefix}`);
                }
            }

            textarea.value = lines.join("\n");
            textarea.setSelectionRange(start, end);
            textarea.dispatchEvent(new Event("input"));
            return;
        }
    });


    /* =========================
       Preview
    ========================== */
    function openPreview() {
        if (previewWin && document.body.contains(previewWin)) { renderPreview(); window.nexser?.windowAPI.bringToFront(previewWin); return; }
        const content = window.nexser?.windowAPI.createWindow("Preview", {
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
    }

    /* =========================
    Preview (最新版: img src & バイナリ対応)
 ========================= */
    // CodeEditor関数の上部（他の変数宣言のあたり）に配置してください
    let previewHtmlPath = null;
    let lastHtmlBlobUrl = null;

    async function renderPreview() {
        if (!previewIframe || !filePath || isDestroyed) return;

        const oldBlobs = new Map(previewBlobMap);
        const baseDir = getDirPath(filePath);
        const fsFiles = collectFilesRecursive(baseDir);
        if (!fsFiles.size) return;

        // エディタのタブにある最新の内容（折りたたみ展開済み）を最優先で反映
        tabs.forEach(t => {
            if (!t.isBinary && fsFiles.has(t.path)) {
                fsFiles.set(t.path, getFullText(t));
            }
        });

        previewBlobMap.clear();

        // 外部データ(__EXTERNAL_DATA__)の非同期ロード（syscall経由・FSメモリへ書き戻さない）
        const loadPromises = [];
        for (const [fullPath, content] of fsFiles.entries()) {
            if (content === "__EXTERNAL_DATA__") {
                loadPromises.push(
                    readFileSafe(fullPath).then(realContent => {
                        if (isDestroyed) return;
                        fsFiles.set(fullPath, realContent ?? "");
                    }).catch(e => {
                        console.error(`Preview load error: ${fullPath}`, e);
                        fsFiles.set(fullPath, "");
                    })
                );
            }
        }

        try {
            await Promise.all(loadPromises);
        } catch (err) {
            console.error("Preview external data load failed:", err);
        }

        if (isDestroyed || !previewIframe) return;

        // Data URLをバイナリ（Blob）に変換するヘルパー関数
        function dataURLToBlob(dataurl) {
            try {
                const arr = dataurl.split(',');
                const mime = arr[0].match(/:(.*?);/)[1];
                const bstr = atob(arr[1]);
                let n = bstr.length;
                const u8arr = new Uint8Array(n);
                while (n--) {
                    u8arr[n] = bstr.charCodeAt(n);
                }
                return new Blob([u8arr], { type: mime });
            } catch (e) {
                return new Blob([dataurl], { type: "text/plain" });
            }
        }

        // すべてのファイルの Blob URL を生成
        for (let [fullPath, content] of fsFiles.entries()) {
            const name = fullPath.split("/").pop();
            const mime = getMimeType(name);

            let blob;
            if (content instanceof Uint8Array || content instanceof ArrayBuffer || content instanceof Blob) {
                blob = new Blob([content], { type: mime });
            } else if (typeof content === "string" && content.startsWith("data:")) {
                // ★ Data URLの場合は正しくバイナリBlobに変換する
                blob = dataURLToBlob(content);
            } else {
                blob = new Blob([String(content ?? "")], { type: mime });
            }

            const url = URL.createObjectURL(blob);
            previewBlobMap.set(fullPath, url);
        }

        // アクティブなタブが HTML の場合はそれを優先し、違えば「直前にプレビューしていた HTML」を維持する
        if (activeTab?.path && /\.(html|htm)$/i.test(activeTab.path)) {
            previewHtmlPath = activeTab.path;
        } else if (!previewHtmlPath || !fsFiles.has(previewHtmlPath)) {
            previewHtmlPath = [...previewBlobMap.keys()].find(p => /\.(html|htm)$/i.test(p));
        }

        if (!previewHtmlPath) return;

        let html = fsFiles.get(previewHtmlPath);
        if (typeof html !== "string") {
            if (html instanceof Uint8Array) {
                html = new TextDecoder().decode(html);
            } else {
                return;
            }
        }

        // ★追加: iframe内から親ウィンドウのOS APIを直接呼び出せるようにブリッジを自動注入
        const bridgeScript = `
        <script>
            try {
                if (window.parent && window.parent.nexser) {
                    window.nexser = window.parent.nexser;
                    window.API = window.parent.nexser.windowAPI;
                }
            } catch (e) {
                console.warn("Failed to bridge nexser API:", e);
            }
        </script>
        `;

        if (/<head>/i.test(html)) {
            html = html.replace(/<head>/i, `<head>${bridgeScript}`);
        } else if (/<html>/i.test(html)) {
            html = html.replace(/<html>/i, `<html><head>${bridgeScript}</head>`);
        } else {
            html = bridgeScript + html;
        }

        // ウィンドウタイトルの更新
        const titleMatch = html.match(/<title>(.*?)<\/title>/i);
        const winTitleEl = previewWin?.querySelector(".title-text");
        if (winTitleEl) {
            winTitleEl.textContent = (titleMatch && titleMatch[1])
                ? titleMatch[1]
                : `Preview - ${previewHtmlPath.split("/").pop()}`;
        }

        // HTML内の相対パス（src, href, poster）を Blob URL に置換
        html = html.replace(/(src|href|poster)=["']([^"']+)["']/gi, (match, attr, relPath) => {
            if (/^(https?|data|blob):/i.test(relPath)) return match;
            const resolved = resolveRelativePath(previewHtmlPath, relPath);
            const blobUrl = resolved ? previewBlobMap.get(resolved) : null;
            return blobUrl ? `${attr}="${blobUrl}"` : match;
        });

        // CSS内の url() の相対パスを置換
        html = html.replace(/url\(["']?([^"'\)]+)["']?\)/gi, (match, relPath) => {
            if (/^(https?|data):/i.test(relPath)) return match;
            const resolved = resolveRelativePath(previewHtmlPath, relPath);
            const blobUrl = resolved ? previewBlobMap.get(resolved) : null;
            return blobUrl ? `url("${blobUrl}")` : match;
        });

        const htmlBlobUrl = URL.createObjectURL(new Blob([html], { type: "text/html" }));

        if (!previewIframe || isDestroyed) {
            URL.revokeObjectURL(htmlBlobUrl);
            return;
        }

        previewIframe.src = htmlBlobUrl;

        // 読み込み完了後に古い Blob をすべて確実に解放（メモリリーク完全防止）
        previewIframe.onload = () => {
            for (const url of oldBlobs.values()) {
                try { URL.revokeObjectURL(url); } catch { }
            }
            if (lastHtmlBlobUrl) {
                try { URL.revokeObjectURL(lastHtmlBlobUrl); } catch { }
            }
            lastHtmlBlobUrl = htmlBlobUrl;
        };
    }

    /* =========================
       Sidebar
    ========================== */
    let sidebarRootDir = (filePath ? (getDirPath(filePath) || filePath.split("/")[0]) : null) || "C:/Programs/Documents";

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

        const resultsDiv = document.createElement("div");
        Object.assign(resultsDiv.style, {
            maxHeight: "300px", // 必要に応じて調整
            overflowY: "auto",
            marginTop: "8px",
            fontSize: "12px",
            color: "#ccc",
            display: "none", // 初期は非表示
            borderBottom: "1px solid #333"
        });
        searchResultsList = resultsDiv;

        searchDiv.appendChild(searchInput);
        searchDiv.appendChild(statusDiv);
        searchDiv.appendChild(searchResultsList);
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
            selectedSearchLine = -1;

            // 入力欄が空になったら、検索ハイライトのみ消去（構文エラー波線は維持）
            if (!searchQuery || searchQuery.trim() === "") {
                if (highlightOverlay) highlightOverlay.innerHTML = "";
                if (searchStatus) searchStatus.textContent = "";
                if (searchResultsList) {
                    searchResultsList.innerHTML = "";
                    searchResultsList.style.display = "none";
                }
                highlightLayer = null;
                updateFindCounter();
            } else {
                highlightSearchMatches(searchQuery);
                updateFindCounter();
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
                li.onclick = async e => {
                    e.stopPropagation();
                    let tab = tabs.find(t => t.path === treeNode.path);
                    if (!tab) {
                        const node = resolveFS(treeNode.path);
                        if (!node) return;

                        let decoded = { text: "", isBinary: false };
                        try {
                            const raw = await readFileSafe(treeNode.path);
                            decoded = await decodeFileDataToText(raw, treeNode.name);
                        } catch (err) {
                            console.error("[CodeEditor] Sidebar load error:", err);
                            decoded = { text: "Error loading file.", isBinary: false };
                        }
                        if (isDestroyed) return;

                        tab = {
                            name: treeNode.name,
                            path: treeNode.path,
                            node,
                            content: decoded.isBinary
                                ? `// [Binary File] '${treeNode.name}' はバイナリ形式のためテキスト編集できません。`
                                : decoded.text,
                            isBinary: decoded.isBinary,
                            foldStore: new Map(),
                            dirty: false
                        };
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
                window.nexser?.windowAPI.bringToFront(previewWin);
            } else {
                openPreview(); // なければ新規で開く
            }
        };
        setupRibbon(win, () => filePath, null, [
            {
                title: "File", items: [
                    { label: "New File (Ctrl+N)", action: createNewFileTab },
                    { label: "Save (Ctrl+S)", action: save },
                    { label: "Save As... (Ctrl+Shift+S)", action: () => saveAs(activeTab) },
                    { label: "Preview (Ctrl+Enter)", action: openPreview },
                    { label: "Reload Preview", action: reloadPreview }
                ]
            },
            {
                title: "Edit", items: [
                    { label: "Find (Ctrl+F)", action: () => openFindWidget(false) },
                    { label: "Replace (Ctrl+H)", action: () => openFindWidget(true) },
                    { label: "Go to Line... (Ctrl+G)", action: goToLine },
                    { label: "Format Document (Shift+Alt+F)", action: formatDocument }
                ]
            },
            {
                title: "View", items: [
                    { label: "Toggle Sidebar (Search)", action: toggleSidebarWithSearch },
                    { label: "Fold All", action: foldAll },
                    { label: "Unfold All", action: unfoldAll }
                ]
            }
        ]);
    }

    sidebar.style.display = "none";

    /* =========================
           FS変更 → タブ自動同期（無限ループ防止ガード付き・修正版）
        ========================== */
    let isSyncingFS = false;

    function syncTabsWithFS() {
        // すでに同期処理中の場合はイベントの連鎖ループを防ぐため即座にリターン
        if (isSyncingFS) return;
        isSyncingFS = true;

        try {
            let activeTabWasUpdated = false;

            for (let i = tabs.length - 1; i >= 0; i--) {
                const tab = tabs[i];
                // 未保存の新規タブ (path === null) は FS 同期で削除しない
                if (!tab.path) continue;

                const node = resolveFS(tab.path);

                if (node) {
                    tab.node = node;

                    // 外部保存マーカー・バイナリ・編集中（dirty）タブは上書きしない
                    if (node.content === "__EXTERNAL_DATA__" || tab.dirty || tab.isBinary) {
                        continue;
                    }

                    const nextContent = String(node.content ?? "");
                    // 折りたたみ展開後の完全テキストと比較し、本当に外部変更があった場合のみ反映
                    if (getFullText(tab) !== nextContent) {
                        tab.foldStore?.clear();
                        tab.content = nextContent;
                        if (activeTab && tab.path === activeTab.path) {
                            textarea.value = nextContent;
                            updateLineNumbers();
                            activeTabWasUpdated = true;
                        }
                    }
                } else {
                    if (activeTab === tab) activeTab = null;
                    tabs.splice(i, 1);
                    activeTabWasUpdated = true;
                }
            }

            if (!activeTab && tabs.length) {
                activeTab = tabs[0];
                textarea.readOnly = Boolean(activeTab.isBinary);
                textarea.value = activeTab.content;
                updateLineNumbers();
                baseTitle = activeTab.name;
                activeTabWasUpdated = true;
            }

            renderTabs();
            updateTitle();

            // ハイライトと検索のみ更新（構文エラー波線は Worker の診断に任せる）
            if (activeTabWasUpdated) {
                updateActiveLine();
                applySyntaxHighlight(true);

                if (searchQuery && searchQuery.trim() !== "") {
                    highlightSearchMatches(searchQuery);
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
        } finally {
            // 一定時間ロックを保持し、連続で発火するイベントループを遮断
            setTimeout(() => {
                isSyncingFS = false;
            }, 50);
        }
    }

    // イベントリスナーの登録
    window.addEventListener("fs-updated", syncTabsWithFS);

    /* =========================
       Close & Cleanup
    ========================== */
    function requestClose() {
        if (!dirty) { closeWin(); return; }
        window.nexser?.windowAPI.showModalWindow("Save Changes", "編集中の内容があります。\n保存しますか？", {
            parentWin: win,
            buttons: [
                {
                    label: "保存",
                    onClick: async () => {
                        const saved = await save();
                        if (saved) closeWin();
                    }
                },
                {
                    label: "保存しない",
                    onClick: () => {
                        tabs.forEach(t => { t.dirty = false; });
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
        if (previewWin && document.body.contains(previewWin)) {
            if (previewIframe) {
                previewIframe.src = "about:blank"; // JSコンテキストを強制破棄
                previewIframe = null;
            }
            previewWin.remove();
            previewWin = null;
        }
        win?.querySelector(".close-btn")?.click();
    }
    const closeBtn = win?.querySelector(".close-btn");
    closeBtn?.addEventListener("click", e => {
        if (!dirty) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        requestClose();
    }, true);

    const handleWinKeyDown = (e) => {
        const lowerKey = e.key.toLowerCase();
        if (e.altKey && e.key === "F4") { e.preventDefault(); requestClose(); return; }
        if (e.ctrlKey && e.shiftKey && lowerKey === "s") { e.preventDefault(); saveAs(activeTab); return; }
        if (e.ctrlKey && lowerKey === "s") { e.preventDefault(); save(); return; }
        if (e.ctrlKey && lowerKey === "n") { e.preventDefault(); createNewFileTab(); return; }
        if (e.ctrlKey && lowerKey === "g") { e.preventDefault(); goToLine(); return; }
        if (e.ctrlKey && lowerKey === "f") { e.preventDefault(); openFindWidget(false); return; }
        if (e.ctrlKey && lowerKey === "h") { e.preventDefault(); openFindWidget(true); return; }
        if (e.ctrlKey && e.key === "Enter") { e.preventDefault(); openPreview(); return; }
        if (e.ctrlKey && lowerKey === "r") {
            e.preventDefault();
            if (previewWin && document.body.contains(previewWin)) {
                renderPreview();
            }
        }
    };
    win?.addEventListener("keydown", handleWinKeyDown);

    // クリーンアップ処理を関数化（kernelの killProcess から呼び出されます）
    const cleanup = () => {
        if (isDestroyed) return;
        isDestroyed = true;

        win?.removeEventListener("keydown", handleWinKeyDown);

        // 1. Web Worker を確実に終了（開閉ごとのゾンビWorkerリークを防止）
        try {
            syntaxWorker.terminate();
        } catch (_) { }

        // 2. cleanup (dispose) 時にドラッグ中であれば強制解除
        if (minimapMouseMoveHandler) window.removeEventListener("mousemove", minimapMouseMoveHandler);
        if (minimapMouseUpHandler) window.removeEventListener("mouseup", minimapMouseUpHandler);

        if (highlightTask) cancelAnimationFrame(highlightTask);
        if (highlightTimer) clearTimeout(highlightTimer);

        for (const url of previewBlobMap.values()) {
            try { URL.revokeObjectURL(url); } catch { }
        }
        previewBlobMap.clear();

        if (lastHtmlBlobUrl) {
            try { URL.revokeObjectURL(lastHtmlBlobUrl); } catch { }
            lastHtmlBlobUrl = null;
        }

        tabs.length = 0;
        activeTab = null;

        window.removeEventListener("fs-updated", syncTabsWithFS);
        ro.disconnect();

        if (previewWin) {
            if (previewIframe) {
                previewIframe.src = "about:blank";
                previewIframe = null;
            }
            previewWin.remove();
            previewWin = null;
        }
    };

    /* =========================
             実体取得を含む初期化処理 (syscall.readFile経由・多形式対応)
          ========================== */
    async function init() {
        const isAppLaunch = !filePath || !fileNode || fileNode.type === "app" || filePath.toLowerCase().endsWith("codeeditor.app");

        if (isAppLaunch) {
            if (tabs.length === 0) {
                const untitledTab = {
                    name: `Untitled-${untitledId}.txt`,
                    path: null,
                    node: null,
                    content: "",
                    isBinary: false,
                    foldStore: new Map(),
                    dirty: false
                };
                tabs.push(untitledTab);
                activeTab = untitledTab;
                textarea.value = "";
            }
            renderTabs();
            updateTitle();
            updateLineNumbers();
            updateActiveLine();
            applySyntaxHighlight(true);
            requestAnimationFrame(updateMinimap);
            return;
        }

        // 開いた対象ファイルが拡張子フィルタ外であっても必ずタブに含める（任意形式対応）
        if (!tabs.some(t => t.path === filePath)) {
            const openedTab = {
                name: filePath.split("/").pop(),
                path: filePath,
                node: fileNode,
                content: "",
                isBinary: false,
                foldStore: new Map(),
                dirty: false
            };
            tabs.unshift(openedTab);
            activeTab = openedTab;
        }

        // 1. メインファイルの実体を syscall 経由で透過的に取得
        let mainContent = "";
        try {
            const rawContent = await readFileSafe(filePath);
            if (isDestroyed) return;

            const decoded = await decodeFileDataToText(rawContent, filePath.split("/").pop());
            if (isDestroyed) return;

            mainContent = decoded.isBinary
                ? `// [Binary File] '${filePath.split("/").pop()}' はバイナリ形式のためテキスト編集できません。`
                : decoded.text;

            if (activeTab && activeTab.path === filePath) {
                activeTab.content = mainContent;
                activeTab.isBinary = decoded.isBinary;
                activeTab.foldStore = activeTab.foldStore || new Map();
                textarea.readOnly = decoded.isBinary;
                textarea.value = mainContent;
                updateLineNumbers();
                updateActiveLine();
                applySyntaxHighlight(true);
                requestAnimationFrame(updateMinimap);
            }
        } catch (e) {
            console.error("[CodeEditor] Load error:", e);
        }

        // 2. リンクされているファイルを再帰的に検索して tabs に追加
        if (!activeTab?.isBinary) {
            const dirPath = getDirPath(filePath);
            addLinkedFilesToTabs(dirPath, mainContent);
        }

        // 3. 全てのタブをチェックし、__EXTERNAL_DATA__ が残っていれば syscall 経由で取得
        await Promise.all(tabs.map(async (tab) => {
            tab.foldStore = tab.foldStore || new Map();
            if (tab.content === "__EXTERNAL_DATA__" || tab.node?.content === "__EXTERNAL_DATA__") {
                try {
                    const raw = await readFileSafe(tab.path);
                    if (isDestroyed) return;

                    const decoded = await decodeFileDataToText(raw, tab.name);
                    if (isDestroyed) return;

                    tab.isBinary = decoded.isBinary;
                    tab.content = decoded.isBinary
                        ? `// [Binary File] '${tab.name}' はバイナリ形式のためテキスト編集できません。`
                        : decoded.text;

                    if (activeTab === tab) {
                        textarea.readOnly = decoded.isBinary;
                        textarea.value = tab.content;
                        updateLineNumbers();
                    }
                } catch (e) {
                    console.error(`[CodeEditor] Failed to load: ${tab.path}`, e);
                }
            }
        }));

        if (isDestroyed) return;

        renderTabs();
        updateTitle();
        updateLineNumbers();
        updateActiveLine();
        renderPreview();
        applySyntaxHighlight(true);
        requestAnimationFrame(updateMinimap);
    }

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

            const existingTab = tabs.find(t => t.path === newFilePath);
            if (existingTab) {
                switchTab(existingTab);
                window.nexser?.windowAPI.bringToFront(win);
                return;
            }

            const fileName = newFilePath.split("/").pop();
            let decoded = { text: "", isBinary: false };
            try {
                const raw = await readFileSafe(newFilePath);
                decoded = await decodeFileDataToText(raw, fileName);
            } catch (e) {
                console.error("[CodeEditor] Failed to load data for new tab:", e);
            }
            if (isDestroyed) return;

            const newTab = {
                name: fileName,
                path: newFilePath,
                content: decoded.isBinary
                    ? `// [Binary File] '${fileName}' はバイナリ形式のためテキスト編集できません。`
                    : decoded.text,
                isBinary: decoded.isBinary,
                node: newNode,
                foldStore: new Map(),
                dirty: false
            };

            tabs.push(newTab);
            switchTab(newTab);
            window.nexser?.windowAPI.bringToFront(win);
        },
        /**
         * エクスプローラー等でのファイル/フォルダ改名をタブ状態へ安全同期
         */
        onRename: ({ oldPath, newPath }) => {
            if (!oldPath || !newPath) return;
            const replacePrefix = (p) => (p === oldPath ? newPath : (p?.startsWith(oldPath + "/") ? newPath + p.slice(oldPath.length) : p));

            tabs.forEach(tab => {
                if (tab.path && (tab.path === oldPath || tab.path.startsWith(oldPath + "/"))) {
                    tab.path = replacePrefix(tab.path);
                    tab.name = tab.path.split("/").pop();
                    tab.node = resolveFS(tab.path);
                }
            });
            if (filePath && (filePath === oldPath || filePath.startsWith(oldPath + "/"))) {
                filePath = replacePrefix(filePath);
                fileNode = resolveFS(filePath);
            }
            renderTabs();
            updateTitle();
            applySyntaxHighlight(true);
        },
        dispose: cleanup
    }
}

export function showConfirm(root, message, onYes, onNo) {
    const parent = root.closest ? root.closest(".window") : null;
    window.nexser?.windowAPI.showModalWindow("codeeditor", message, {
        parentWin: parent,
        buttons: [
            { label: "はい", onClick: onYes },
            { label: "いいえ", onClick: onNo }
        ]
    });
}