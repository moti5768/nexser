// CodeEditor.js
import { resolveFS } from "../fs-utils.js";
import { createWindow, bringToFront, showModalWindow } from "../window.js";
import { buildDesktop } from "../desktop.js";
import { setupRibbon } from "../ribbon.js";

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
       連携ファイルを tabs に追加 (改善前は同期されなかった)
    ========================== */
    function addLinkedFilesToTabs(basePath, content) {
        const regex = /(src|href)=["']([^"']+)["']/gi;
        let match;
        while (match = regex.exec(content)) {
            const relPath = match[2];
            const resolved = resolveRelativePath(basePath, relPath);
            if (!resolved) continue;
            if (tabs.some(t => t.path === resolved)) continue;

            const node = resolveFS(resolved);
            if (!node) continue;
            if (!isCodeFile(resolved.split("/").pop())) continue;

            tabs.push({
                name: resolved.split("/").pop(),
                path: resolved,
                node,
                content: String(node.content ?? ""),
                dirty: false
            });

            // 改善後: 再帰的にリンクファイルも追加
            if (node.type === "file") addLinkedFilesToTabs(getDirPath(resolved), node.content);
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
<div class="editor-wrap" style="display:flex;width:100%;height:calc(100% - 32px);overflow:hidden;background:#111;">
    <div class="sidebar" style="width:200px;background:#1a1a1a;color:#ccc;overflow:auto;display:none;border-right:1px solid #222;padding:6px;box-sizing:border-box;"></div>
    <div class="linenumbers" style="width:52px;padding:10px 6px;box-sizing:border-box;text-align:right;font-family:monospace;font-size:14px;line-height:1.4;color:#777;background:#0d0d0d;border-right:1px solid #222;user-select:none;overflow:hidden;white-space:pre;"></div>
    <div class="codecontainer" style="position:relative;flex:1;display:flex;flex-direction:column;">
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

    function updateLineNumbers() {
        let lines = 1;
        for (let i = 0; i < textarea.value.length; i++) {
            if (textarea.value[i] === "\n") lines++;
        }
        lineNumbers.textContent = Array.from({ length: lines }, (_, i) => i + 1).join("\n");
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
    const APP_TITLE = "CodeEditor";
    function updateTitle() {
        const mark = dirty ? " *" : "";
        const title = `${APP_TITLE} - ${baseTitle}${mark}`;
        if (typeof win?.setTitle === "function") win.setTitle(title);
        else if (titleEl) titleEl.textContent = title;
        if (win?._taskbarBtn) win._taskbarBtn.textContent = title;
    }

    function renderTabs() {
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
                gap: "6px"
            });

            const label = document.createElement("span");
            label.textContent = tab.name + (tab.dirty ? " *" : "");

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

            // ドラッグ並び替え（既存）
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
       Save
    ========================== */
    async function save() {
        tabs.forEach(tab => {
            if (tab.node) {
                tab.node.content = tab.content;
                tab.dirty = false;
            }
        });
        dirty = false;
        renderTabs();
        updateTitle();
        buildDesktop();
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
        activeTab.content = textarea.value;
        activeTab.dirty = true;
        dirty = true;
        updateLineNumbers();
        renderTabs();
        updateTitle();
        clearErrorHighlights();
    });
    textarea.addEventListener("keydown", (e) => {
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

    function renderPreview() {
        if (!previewIframe || !filePath) return;

        // 以前のBlob URLを保存
        const oldBlobs = new Map(previewBlobMap);

        // すぐ解放
        for (const url of previewBlobMap.values()) {
            try { URL.revokeObjectURL(url); } catch { }
        }
        previewBlobMap.clear();

        const baseDir = getDirPath(filePath);
        const fsFiles = collectFilesRecursive(baseDir);
        if (!fsFiles.size) return;

        for (const [fullPath, content] of fsFiles.entries()) {
            const name = fullPath.split("/").pop();
            const mime = getMimeType(name);
            const url = createBlobURL(String(content ?? ""), mime);
            previewBlobMap.set(fullPath, url);
        }

        const htmlPath = activeTab?.name?.toLowerCase().endsWith(".html")
            ? `${baseDir}/${activeTab.name}`
            : [...previewBlobMap.keys()].find(p => p.toLowerCase().endsWith(".html"));
        if (!htmlPath) return;

        let html = fsFiles.get(htmlPath);
        if (!html) return;

        html = html.replace(/(src|href)=["']([^"']+)["']/gi, (match, attr, relPath) => {
            const resolved = resolveRelativePath(htmlPath, relPath);
            const blobUrl = resolved ? previewBlobMap.get(resolved) : null;
            return blobUrl ? `${attr}="${blobUrl}"` : match;
        });

        const htmlBlobUrl = createBlobURL(html, "text/html");
        previewBlobMap.set("__html__", htmlBlobUrl);
        previewIframe.src = htmlBlobUrl;

        previewIframe.onload = () => {
            for (const url of oldBlobs.values()) {
                try { URL.revokeObjectURL(url); } catch { }
            }
        };
    }

    /* =========================
       Sidebar
    ========================== */
    function toggleSidebar() {
        sidebar.style.display = sidebar.style.display === "none" ? "block" : "none";
        if (sidebar.style.display === "block") renderSidebar();
    }

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
                li.onclick = e => {
                    e.stopPropagation();
                    let tab = tabs.find(t => t.path === treeNode.path);
                    if (!tab) {
                        const node = resolveFS(treeNode.path);
                        if (!node) return;
                        tab = { name: treeNode.name, path: treeNode.path, node, content: String(node.content ?? ""), dirty: false };
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
       Ribbon
    ========================== */
    if (win) {
        setupRibbon(win, () => filePath, null, [
            {
                title: "Window", items: [
                    { label: "最小化", action: () => win.querySelector(".min-btn")?.click() },
                    { label: "最大化 / 元のサイズに戻す", action: () => win.querySelector(".max-btn")?.click() },
                    { label: "閉じる", action: () => win.querySelector(".close-btn")?.click() }
                ]
            },
            {
                title: "File", items: [
                    { label: "Save", action: save },
                    { label: "Preview", action: openPreview }
                ]
            },
            {
                title: "View", items: [
                    { label: "Toggle Sidebar", action: toggleSidebar }
                ]
            }
        ]);
    }

    sidebar.style.display = "none";

    /* =========================
       FS変更 → タブ自動同期
    ========================== */
    function syncTabsWithFS() {
        // タブ自体の node を更新するだけ
        for (let i = tabs.length - 1; i >= 0; i--) {
            const tab = tabs[i];
            const node = resolveFS(tab.path);

            if (node) {
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
        }

        renderTabs();
        updateTitle();
        renderPreview();
        if (sidebar.style.display !== "none") renderSidebar();
    }

    window.addEventListener("fs-updated", syncTabsWithFS);

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
}

export function showConfirm(root, message, onYes, onNo) {
    showModalWindow(root, "Confirm", message, [
        { label: "はい", onClick: onYes },
        { label: "いいえ", onClick: onNo }
    ]);
}