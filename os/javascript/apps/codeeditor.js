// CodeEditor-with-Tabs-and-Sidebar.js
import { resolveFS } from "../fs-utils.js";
import { createWindow, bringToFront } from "../window.js";
import { buildDesktop } from "../desktop.js";
import { setupRibbon } from "./explorer.js";

/* =========================
   Preview Virtual FS Utils
========================= */
const previewBlobMap = new Map();
// ファイルパス（ディレクトリパス）ごとのタブとサイドバー状態を保持
const editorStateMap = new Map();

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
        if (part === "..") stack.pop();
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

    function isCodeFile(name) {
        return /\.(html|css|js)$/i.test(name);
    }

    function getDirPath(p) {
        if (!p) return null;
        const parts = p.split("/");
        parts.pop();
        return parts.join("/");
    }

    /* =========================
       Load Sibling Files + Restore Tab Order
    ========================== */
    function loadSiblingFiles() {
        if (!filePath) return;
        const dirPath = getDirPath(filePath);
        const dirNode = resolveFS(dirPath);
        if (!dirNode) return;

        const fileNames = Object.keys(dirNode).filter(isCodeFile);
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

        // サイドバー状態も復元
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
        const lines = textarea.value.split("\n").length || 1;
        lineNumbers.textContent = Array.from({ length: lines }, (_, i) => i + 1).join("\n");
    }
    textarea.addEventListener("scroll", () => {
        lineNumbers.scrollTop = textarea.scrollTop;
        errorOverlay.scrollTop = textarea.scrollTop;
        sidebar.scrollTop = textarea.scrollTop;
    });

    /* =========================
       Title / Tabs
    ========================== */
    const APP_TITLE = "CodeEditor";
    function updateTitle() {
        const mark = dirty ? " *" : "";
        const title = `${APP_TITLE} - ${baseTitle}${mark}`;
        if (typeof win?.setTitle === "function") win.setTitle(title);
        else if (titleEl) titleEl.textContent = title;
        if (win?._taskbarBtn) win._taskbarBtn.textContent = title;
    }

    /* =========================
       Tabs Rendering + Drag&Drop
    ========================== */
    function renderTabs() {
        tabbar.innerHTML = "";
        tabs.forEach((tab, idx) => {
            const el = document.createElement("div");
            el.textContent = tab.name + (tab.dirty ? " *" : "");
            Object.assign(el.style, {
                padding: "6px 12px",
                cursor: "pointer",
                borderRight: "1px solid #333",
                background: tab === activeTab ? "#111" : "#1b1b1b",
                color: tab === activeTab ? "#fff" : "#aaa",
                userSelect: "none"
            });
            el.draggable = true;
            el.addEventListener("dragstart", e => e.dataTransfer.setData("text/tabIndex", idx));
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

    function switchTab(tab) {
        if (activeTab === tab) return;
        if (activeTab) activeTab.content = textarea.value;
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

    loadSiblingFiles();
    if (activeTab) textarea.value = activeTab.content;
    updateLineNumbers();
    renderTabs();
    updateTitle();

    /* =========================
       Save (Tabs + Sidebar State)
    ========================== */
    async function save() {
        tabs.forEach(tab => {
            if (tab.node) {
                tab.node.content = tab.content; // これはFSの中身だけ更新
                tab.dirty = false;
            }
        });
        dirty = false;
        renderTabs();
        updateTitle();
        buildDesktop(); // FS構造自体の更新だけ反映
        window.dispatchEvent(new Event("fs-updated"));
    }

    /* =========================
       Error Highlight
    ========================== */
    function clearErrorHighlights() {
        errorOverlay.innerHTML = "";
    }
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

    /* =========================
       Preview
    ========================== */
    function openPreview() {
        if (previewWin && document.body.contains(previewWin)) { renderPreview(); bringToFront(previewWin); return; }
        const content = createWindow("Preview", { width: 800, height: 520, taskbar: false });
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

        const oldBlobs = new Map(previewBlobMap);
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
            for (const url of oldBlobs.values()) try { URL.revokeObjectURL(url); } catch { }
        };
    }

    /* =========================
       Sidebar Rendering
    ========================== */
    function toggleSidebar() {
        sidebar.style.display = sidebar.style.display === "none" ? "block" : "none";
        if (sidebar.style.display === "block") renderSidebar();
    }

    function renderSidebar() {
        sidebar.innerHTML = "";
        if (!tabs.length) return;

        const ul = document.createElement("ul");
        ul.style.listStyle = "none";
        ul.style.paddingLeft = "6px";

        tabs.forEach(tab => {
            const li = document.createElement("li");
            li.textContent = tab.name;
            li.style.cursor = "pointer";
            li.onclick = e => {
                e.stopPropagation();
                switchTab(tab);
            };
            ul.appendChild(li);
        });

        sidebar.appendChild(ul);
    }

    /* =========================
       Ribbon
    ========================== */
    if (win) {
        setupRibbon(win, () => filePath, null, [
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
        if (!filePath) return;
        const dirPath = getDirPath(filePath);
        const dirNode = resolveFS(dirPath);
        if (!dirNode) return;

        const fsFiles = Object.keys(dirNode).filter(isCodeFile).map(name => ({
            name, path: `${dirPath}/${name}`, node: resolveFS(`${dirPath}/${name}`)
        }));

        let changed = false;
        for (let i = tabs.length - 1; i >= 0; i--) {
            if (!fsFiles.some(f => f.path === tabs[i].path)) {
                if (activeTab === tabs[i]) activeTab = null;
                tabs.splice(i, 1);
                changed = true;
            }
        }
        fsFiles.forEach(f => {
            if (!tabs.some(t => t.path === f.path)) {
                tabs.push({ name: f.name, path: f.path, node: f.node, content: String(f.node?.content ?? ""), dirty: false });
                changed = true;
            }
        });
        tabs.forEach(tab => tab.node = resolveFS(tab.path));

        if (!activeTab && tabs.length) {
            activeTab = tabs[0];
            textarea.value = activeTab.content;
            updateLineNumbers();
            baseTitle = activeTab.name;
        }
        if (changed) { renderTabs(); updateTitle(); renderPreview(); if (sidebar.style.display !== "none") renderSidebar(); }
    }
    window.addEventListener("fs-updated", syncTabsWithFS);

    /* =========================
       Close & Cleanup
    ========================== */
    function requestClose() {
        if (!dirty) { closeWin(); return; }
        showConfirm(root, "編集中の内容があります。\n保存しますか？",
            async () => { await save(); closeWin(); },
            () => { dirty = false; renderTabs(); updateTitle(); closeWin(); }
        );
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

/* =========================
   Modal Dialogs
========================= */
function showModalDialog(root, title, message, buttons = []) {
    const win = root.closest(".window");
    if (!win) return;
    if (!win._activeDialogs) win._activeDialogs = new Set();
    if (win._activeDialogs.has(message)) return;
    win._activeDialogs.add(message);
    win.style.pointerEvents = "none";

    const content = createWindow(title, {
        width: 320, height: 150,
        disableControls: true,
        hideRibbon: true,
        hideStatus: true,
        taskbar: false,
        skipSave: true,
        skipFocus: true
    });

    const dialogWin = content.parentElement;
    dialogWin.classList.add("modal-dialog");
    dialogWin.style.zIndex = parseInt(win.style.zIndex) + 1000;
    dialogWin.style.pointerEvents = "all";
    dialogWin.style.position = "absolute";

    const rect = win.getBoundingClientRect();
    dialogWin.style.left = rect.left + rect.width / 2 - 160 + "px";
    dialogWin.style.top = rect.top + rect.height / 2 - 75 + "px";

    document.body.appendChild(dialogWin);
    content.innerHTML = `<p>${message}</p><div style="text-align:center;margin-top:12px;"></div>`;
    const container = content.querySelector("div");

    function closeDialog(callback) {
        dialogWin.remove();
        win._activeDialogs.delete(message);
        win.style.pointerEvents = "auto";
        if (typeof callback === "function") callback();
    }

    buttons.forEach(btn => {
        const b = document.createElement("button");
        b.textContent = btn.label;
        b.onclick = () => closeDialog(btn.onClick);
        b.style.margin = "0 4px";
        container.appendChild(b);
    });

    const closeBtn = dialogWin.querySelector(".close-btn");
    if (closeBtn) closeBtn.onclick = () => closeDialog();
    const observer = new MutationObserver(() => { if (!document.body.contains(win)) { closeDialog(); observer.disconnect(); } });
    observer.observe(document.body, { childList: true, subtree: true });

    return content;
}

export function showWarning(root, message) {
    showModalDialog(root, "Warning", message, [{ label: "OK", onClick: null }]);
}

export function showConfirm(root, message, onYes, onNo) {
    showModalDialog(root, "Confirm", message, [
        { label: "はい", onClick: onYes },
        { label: "いいえ", onClick: onNo }
    ]);
}
