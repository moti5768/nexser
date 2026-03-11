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
    
    <div class="linenumbers" style="width:52px;padding:10px 6px;box-sizing:border-box;text-align:right;font-family:monospace;font-size:14px;line-height:1.4;color:#777;background:#0d0d0d;border-right:1px solid #222;user-select:none;overflow:hidden;white-space:pre;"></div>
    <div class="codecontainer" style="position:relative;flex:1;display:flex;flex-direction:column;min-width:0;">
        <textarea class="codeeditor" spellcheck="false" wrap="off" style="flex:1;width:100%;resize:none;box-sizing:border-box;border:none;outline:none;padding:10px;background:#111;color:#eaeaea;overflow:auto;white-space:pre;font-family:monospace;font-size:14px;line-height:1.4;position:relative;z-index:1;"></textarea>
        <div class="error-overlay" style="position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:2;"></div>
    </div>
</div>
`;

    const tabbar = root.querySelector(".tabbar");
    const textarea = root.querySelector(".codeeditor");
    const lineNumbers = root.querySelector(".linenumbers");
    const errorOverlay = root.querySelector(".error-overlay");
    const sidebar = root.querySelector(".sidebar");

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
    textarea.addEventListener("scroll", () => {
        lineNumbers.scrollTop = textarea.scrollTop;
        errorOverlay.scrollTop = textarea.scrollTop;
        sidebar.scrollTop = textarea.scrollTop;

        // 検索ハイライトも同期
        if (searchQuery) highlightSearchMatches(searchQuery);
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
        }

        // ★ 追加
        dirty = activeTab?.dirty ?? false;

        renderTabs();
        updateTitle();
        renderPreview();
    }

    function switchTab(tab) {
        if (activeTab === tab) return;
        if (activeTab) {
            activeTab.content = textarea.value;
            activeTab.dirty = dirty;
        }
        activeTab = tab;
        textarea.value = tab.content;
        dirty = tab.dirty;
        baseTitle = tab.name;
        filePath = tab.path;
        fileNode = tab.node;
        updateLineNumbers();
        renderTabs();
        updateTitle();
        clearErrorHighlights();
        if (sidebar.style.display !== "none") renderSidebar();
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
        errorOverlay.innerHTML = "";
        if (!query) return;

        const text = textarea.value;
        const lines = text.split("\n");
        const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 18;
        const paddingTop = parseFloat(getComputedStyle(textarea).paddingTop) || 0;
        const scrollTop = textarea.scrollTop; // スクロール補正

        lines.forEach((line, i) => {
            let start = 0;
            let idx;
            const lowerLine = line.toLowerCase();
            const lowerQuery = query.toLowerCase();

            while ((idx = lowerLine.indexOf(lowerQuery, start)) !== -1) {
                const div = document.createElement("div");
                div.style.position = "absolute";
                div.style.left = "0";
                div.style.right = "0";
                div.style.top = i * lineHeight + paddingTop - scrollTop + "px"; // スクロール補正追加
                div.style.height = lineHeight + "px";
                div.style.backgroundColor = "rgba(255,255,0,0.3)";
                div.style.pointerEvents = "none";
                errorOverlay.appendChild(div);

                start = idx + query.length;
            }
        });
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
    textarea.addEventListener("input", () => {
        if (!activeTab) return;
        // 1. メモリ上のテキストデータを同期
        activeTab.content = textarea.value;
        // 2. 未保存状態 (dirty) への遷移処理
        if (!activeTab.dirty) {
            activeTab.dirty = true;
            dirty = true; // エディタ全体の変更フラグも同期
            renderTabs();
        }
        // 3. ウィンドウタイトルバーの更新
        // dirty フラグが立っていることを反映し、タイトルに "*" を付与します
        updateTitle();
        // 4. 表示の更新（行番号・エラー消去）
        updateLineNumbers();
        clearErrorHighlights();
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
            color: "#f66",
            marginTop: "2px",
            minHeight: "16px"
        });
        searchStatus = statusDiv; // ← グローバル変数にセット

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
        let activeTabWasUpdated = false; // アクティブなタブが更新されたかどうかのフラグ

        for (let i = tabs.length - 1; i >= 0; i--) {
            const tab = tabs[i];
            const node = resolveFS(tab.path);

            if (node) {
                // 更新されたノードが現在のアクティブタブと同じパスならフラグを立てる
                if (activeTab && tab.path === activeTab.path) {
                    activeTabWasUpdated = true;
                }
                tab.node = node;
            } else {
                if (activeTab === tab) activeTab = null;
                tabs.splice(i, 1);
            }
        }

        if (!activeTab && tabs.length) {
            activeTab = tabs[0];
            textarea.value = activeTab.content;
            updateLineNumbers();
            baseTitle = activeTab.name;
            activeTabWasUpdated = true; // タブが切り替わった場合も更新対象とする
        }

        renderTabs();
        updateTitle();

        // 修正ポイント：プレビューウィンドウが存在し、かつアクティブタブに更新があった場合のみ実行
        if (previewWin && document.body.contains(previewWin) && activeTabWasUpdated) {
            renderPreview();
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
                }
            } catch (e) { console.error("Load error:", e); }
        }

        // 2. リンクされているファイルを再帰的に検索して tabs に追加
        // (ここで tabs 配列が拡張される)
        const dirPath = getDirPath(filePath);
        addLinkedFilesToTabs(dirPath, fileNode.content);

        // 3. 全てのタブをチェックし、__EXTERNAL_DATA__ が残っていれば取得
        // Parallel（並列）で実行することで高速化
        await Promise.all(tabs.map(async (tab) => {
            if (tab.node && tab.node.content === "__EXTERNAL_DATA__") {
                try {
                    const content = await getFileContent(tab.path);
                    tab.node.content = content;
                    tab.content = content;

                    // もし取得中にユーザーがこのタブに切り替えていたら表示を更新
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
        renderPreview(); // 全データが揃った状態でプレビュー
    }

    // 実行
    init();
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