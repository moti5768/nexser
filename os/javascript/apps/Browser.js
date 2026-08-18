// Browser.js
import { resolveFS } from "../fs-utils.js";
import { createWindow, bringToFront, showModalWindow, alertWindow, centerWindowOptions, taskbarButtons, updateWindowTitle } from "../window.js";
import { setupRibbon } from "../ribbon.js";
import { getFileContent } from "../fs-db.js";

export default async function BrowserApp(root, options = {}) {
    const { path, url } = options;
    const win = root.closest(".window");
    const titleEl = win?.querySelector(".title-text");

    let filePath = path || null;
    let fileNode = filePath ? resolveFS(filePath) : null;

    // --- 外部データ・ファイル実体の非同期取得処理 ---
    if (fileNode && fileNode.content === "__EXTERNAL_DATA__") {
        try {
            fileNode.content = await getFileContent(filePath);
        } catch (e) {
            console.error("Failed to load file content:", e);
            fileNode.content = "URL=https://www.google.com/webhp?igu=1";
        }
    }

    // --- Base64デコード用ヘルパー関数 (Explorer.jsより移植) ---
    const getDecodedContent = (content) => {
        if (typeof content !== "string") return "";
        if (content.startsWith("data:")) {
            try {
                const base64Index = content.indexOf(";base64,");
                if (base64Index !== -1) {
                    const base64 = content.substring(base64Index + 8);
                    const binary = atob(base64);
                    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
                    return new TextDecoder().decode(bytes);
                }
            } catch (e) {
                console.error("Base64 decode error:", e);
            }
        }
        return content;
    };

    // --- YouTubeのURLを埋め込み用(embed)に変換するヘルパー関数 ---
    const convertYouTubeUrl = (urlStr) => {
        try {
            let testUrl = urlStr;
            if (!testUrl.startsWith("http://") && !testUrl.startsWith("https://")) {
                testUrl = "https://" + testUrl;
            }
            const parsed = new URL(testUrl);

            if (parsed.hostname.includes("youtube.com") && parsed.pathname === "/watch") {
                const videoId = parsed.searchParams.get("v");
                if (videoId) {
                    return `https://www.youtube.com/embed/${videoId}`;
                }
            }

            if (parsed.hostname === "youtu.be") {
                const videoId = parsed.pathname.slice(1);
                if (videoId) {
                    return `https://www.youtube.com/embed/${videoId}`;
                }
            }
        } catch (e) {
            // URLパースエラー時はそのまま返す
        }
        return urlStr;
    };

    let rawContent = getDecodedContent(fileNode?.content) || url || "https://www.google.com/webhp?igu=1";
    let currentUrl = rawContent;

    // .url ショートカットファイル形式（[InternetShortcut] URL=...）の高度なパース対応
    if (rawContent.includes("URL=")) {
        const match = rawContent.match(/URL=(.+)/i);
        currentUrl = match ? match[1].trim() : rawContent.trim();
    }

    if (!currentUrl.startsWith("http://") && !currentUrl.startsWith("https://") && !currentUrl.startsWith("about:")) {
        currentUrl = "https://" + currentUrl;
    }

    // YouTubeのURL形式をembed用に変換
    currentUrl = convertYouTubeUrl(currentUrl);

    let baseTitle = filePath?.split("/").pop()?.trim() || "Browser";

    // コンテンツエリアのオーバーフロー制御
    const contentEl = win?.querySelector(".content");
    if (contentEl) contentEl.style.overflow = "hidden";

    /* =========================
       UI 構築
    ========================== */
    root.innerHTML = `
        <div class="browser-toolbar" style="display: flex; padding: 4px; background: #C3C7CB; border-bottom: 1px solid #808080; align-items: center; gap: 4px; user-select: none;">
            <button class="browser-back button" style="padding: 2px 8px; font-size: 11px;" title="戻る">◀</button>
            <button class="browser-forward button" style="padding: 2px 8px; font-size: 11px;" title="進む">▶</button>
            <button class="browser-reload button" style="padding: 2px 8px; font-size: 11px;" title="再読み込み">🔄</button>
            <span style="font-size: 12px; font-family: 'MS Sans Serif', sans-serif;">URL:</span>
            <input type="text" class="border browser-address" value="${currentUrl.replace(/"/g, '&quot;')}" style="flex: 1; padding: 2px 4px; font-size: 12px; background: white; color: black;" />
            <button class="browser-go button" style="padding: 2px 10px; font-size: 12px;">Go</button>
        </div>
        <div class="browser-dropzone" style="flex: 1; position: relative; width: 100%; height: calc(100% - 32px);">
            <iframe src="${currentUrl.replace(/"/g, '&quot;')}" class="browser-frame" style="width: 100%; height: 100%; border: none; background: #fff;" sandbox="allow-same-origin allow-scripts allow-popups allow-forms"></iframe>
        </div>
    `;

    root.style.display = "flex";
    root.style.flexDirection = "column";
    root.style.height = "100%";

    const addressInput = root.querySelector(".browser-address");
    const goBtn = root.querySelector(".browser-go");
    const backBtn = root.querySelector(".browser-back");
    const forwardBtn = root.querySelector(".browser-forward");
    const reloadBtn = root.querySelector(".browser-reload");
    const frame = root.querySelector(".browser-frame");
    const dropZone = root.querySelector(".browser-dropzone");

    function updateTitle() {
        updateWindowTitle(win, `${baseTitle} - ${addressInput.value}`, false);
    }
    updateTitle();

    function updateStatusBar() {
        if (!win?._statusBar) return;
        win._statusBar.textContent = `表示中: ${addressInput.value}`;
    }
    updateStatusBar();

    // --- 履歴管理用変数 (各ウィンドウ/iframeごとに独立) ---
    let historyList = [currentUrl];
    let historyIndex = 0;

    // ナビゲーション実行関数
    function navigate(targetUrl, isHistoryNav = false) {
        let url = targetUrl.trim();
        if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("about:")) {
            url = "https://" + url;
        }

        // YouTubeのURL形式をembed用に変換
        url = convertYouTubeUrl(url);

        // アドレスバーなどからの新規移動の場合、履歴を更新する
        if (!isHistoryNav && url !== historyList[historyIndex]) {
            // 現在のインデックスより先の履歴を削除し、新しいURLを追加
            historyList = historyList.slice(0, historyIndex + 1);
            historyList.push(url);
            historyIndex++;
        }

        addressInput.value = url;
        frame.src = url;
        updateTitle();
        updateStatusBar();
    }

    // イベントリスナー
    goBtn.addEventListener("click", () => navigate(addressInput.value));
    addressInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") navigate(addressInput.value);
    });

    reloadBtn.addEventListener("click", () => {
        try {
            frame.contentWindow.location.reload();
        } catch (e) {
            frame.src = frame.src;
        }
    });

    backBtn.addEventListener("click", () => {
        if (historyIndex > 0) {
            historyIndex--;
            navigate(historyList[historyIndex], true);
        } else {
            console.log("これ以上戻れません");
        }
    });

    forwardBtn.addEventListener("click", () => {
        if (historyIndex < historyList.length - 1) {
            historyIndex++;
            navigate(historyList[historyIndex], true);
        } else {
            console.log("これ以上進めません");
        }
    });

    // --- ⭐ 追加: ブラウザへのドラッグ＆ドロップによるURL抽出・オープン対応 ---
    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.stopPropagation();
    });

    dropZone.addEventListener("drop", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        // 1. テキストやuri-listとしてのドロップをチェック
        const uriList = e.dataTransfer.getData("text/uri-list");
        const textPlain = e.dataTransfer.getData("text/plain");
        let droppedUrl = uriList || textPlain;

        // 2. ファイルがドロップされた場合 (.url ファイルなど) の処理
        if (!droppedUrl && e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            const item = e.dataTransfer.items[0];
            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) {
                    try {
                        const text = await file.text();
                        const decoded = getDecodedContent(text);
                        if (decoded.includes("URL=")) {
                            const match = decoded.match(/URL=(.+)/i);
                            droppedUrl = match ? match[1].trim() : decoded.trim();
                        } else {
                            droppedUrl = decoded.trim();
                        }
                    } catch (err) {
                        console.error("Failed to read dropped file:", err);
                    }
                }
            }
        }

        if (droppedUrl) {
            if (droppedUrl.includes("URL=")) {
                const match = droppedUrl.match(/URL=(.+)/i);
                droppedUrl = match ? match[1].trim() : droppedUrl;
            }
            navigate(droppedUrl);
        }
    });

    /* =========================
       リボンUI
    ========================== */
    if (win) {
        const ribbonMenus = [
            {
                title: "File",
                items: [
                    {
                        label: "Save Shortcut",
                        action: () => {
                            const desktop = resolveFS("Desktop");
                            if (!desktop) {
                                alertWindow("Desktop が見つかりません", { parentWin: win });
                                return;
                            }
                            let finalName = `${baseTitle.replace(/\.[^/.]+$/, "")}.url`;
                            let idx = 1;
                            while (desktop[finalName]) finalName = `Shortcut (${idx++}).url`;

                            desktop[finalName] = {
                                type: "file",
                                content: `[InternetShortcut]\nURL=${addressInput.value}`
                            };
                            window.dispatchEvent(new Event("fs-updated"));
                            alertWindow("デスクトップにショートカットを保存しました", { parentWin: win });
                        }
                    }
                ]
            },
            {
                title: "Navigation",
                items: [
                    { label: "Google", action: () => navigate("https://www.google.com/webhp?igu=1") },
                    { label: "Blank", action: () => navigate("about:blank") }
                ]
            }
        ];

        setupRibbon(win, () => filePath, null, ribbonMenus);
    }
    return {
        dispose: () => {
            // iframeの読み込みを停止してメモリリークやバックグラウンド通信を防止
            if (frame) {
                try {
                    frame.src = "about:blank";
                } catch (e) {
                    // ignore
                }
            }
            console.log("Browser app resources released.");
        }
    };
}