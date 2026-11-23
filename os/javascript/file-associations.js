// file-associations.js
import { resolveFS, isSystemMetaKey } from "./fs-utils.js";

// 現在開いているファイルのパスを保持するSet
export const openedFilePaths = new Set();

// 拡張子 → 起動アプリ対応表 (C: ドライブの絶対パス構造に対応)
export const FILE_ASSOCIATIONS = {
    // Text
    ".txt": "C:/Programs/Applications/TextEditor.app",
    ".md": "C:/Programs/Applications/TextEditor.app",

    // Code
    ".js": "C:/Programs/Applications/CodeEditor.app",
    ".ts": "C:/Programs/Applications/CodeEditor.app",
    ".json": "C:/Programs/Applications/CodeEditor.app",
    ".css": "C:/Programs/Applications/CodeEditor.app",
    ".scss": "C:/Programs/Applications/CodeEditor.app",
    ".vue": "C:/Programs/Applications/CodeEditor.app",
    ".html": "C:/Programs/Applications/CodeEditor.app",
    ".htm": "C:/Programs/Applications/CodeEditor.app",

    // Images
    ".png": "C:/Programs/Applications/ImageViewer.app",
    ".jpg": "C:/Programs/Applications/ImageViewer.app",
    ".jpeg": "C:/Programs/Applications/ImageViewer.app",
    ".gif": "C:/Programs/Applications/ImageViewer.app",
    ".webp": "C:/Programs/Applications/ImageViewer.app",

    // Paint
    ".bmp": "C:/Programs/Applications/Paint.app",

    // Video
    ".mp4": "C:/Programs/Applications/VideoPlayer.app",
    ".webm": "C:/Programs/Applications/VideoPlayer.app",
    ".ogg": "C:/Programs/Applications/VideoPlayer.app",
    ".mov": "C:/Programs/Applications/VideoPlayer.app",
    ".mkv": "C:/Programs/Applications/VideoPlayer.app",

    // Audio
    ".mp3": "C:/Programs/Applications/AudioPlayer.app",
    ".wav": "C:/Programs/Applications/AudioPlayer.app",
    ".m4a": "C:/Programs/Applications/AudioPlayer.app",
    ".flac": "C:/Programs/Applications/AudioPlayer.app",
    ".aac": "C:/Programs/Applications/AudioPlayer.app",

    // PDF
    ".pdf": "C:/Programs/Applications/PDFViewer.app",

    //.spreadsheet
    ".nxs": "C:/Programs/Applications/Spreadsheet.app",
    ".csv": "C:/Programs/Applications/Spreadsheet.app",

    // URL
    ".url": "C:/Programs/Applications/Browser.app"
};

/**
 * システム共通アイコンパス定義
 */
export const SYSTEM_ICONS = {
    folderEmpty: "./icons/folder_empty.png",
    folderFull: "./icons/folder_full.png",
    folderOpen: "./icons/folder_open.png",
    trashEmpty: "./icons/trash_empty.png",
    trashFull: "./icons/trash_full.png",
    pc: "./icons/pc.png",
    shortcut: "./icons/shortcut.png",
    fileDefault: "./icons/file_default.png",
    appDefault: "./icons/settings.png"
};

/**
 * 拡張子ごとのデフォルトアイコンマップ (O(1)検索用)
 */
const DEFAULT_EXTENSION_ICONS = {
    ".txt": "./icons/file_txt.png",
    ".md": "./icons/file_md.png",
    ".js": "./icons/file_js.png",
    ".ts": "./icons/file_ts.png",
    ".json": "./icons/file_json.png",
    ".css": "./icons/file_css.png",
    ".scss": "./icons/file_css.png",
    ".vue": "./icons/file_vue.png",
    ".html": "./icons/file_html.png",
    ".htm": "./icons/file_html.png",
    ".url": "./icons/file_url.png",
    ".png": "./icons/file_image.png",
    ".jpg": "./icons/file_image.png",
    ".jpeg": "./icons/file_image.png",
    ".gif": "./icons/file_image.png",
    ".webp": "./icons/file_image.png",
    ".bmp": "./icons/file_bmp.png",
    ".mp4": "./icons/file_video.png",
    ".webm": "./icons/file_video.png",
    ".ogg": "./icons/file_video.png",
    ".mov": "./icons/file_video.png",
    ".mkv": "./icons/file_video.png",
    ".mp3": "./icons/file_audio.png",
    ".wav": "./icons/file_audio.png",
    ".m4a": "./icons/file_audio.png",
    ".flac": "./icons/file_audio.png",
    ".aac": "./icons/file_audio.png",
    ".pdf": "./icons/file_pdf.png",
    ".nxs": "./icons/file_spreadsheet.png",
    ".csv": "./icons/file_spreadsheet.png",
    ".cfg": "./icons/file_cfg.png"
};

// 外部アプリ・ユーザーによる動的登録レジストリ
const customAssociations = new Map();   // ext -> appPath
const customExtensionIcons = new Map(); // ext -> icon

/**
 * アプリ名・パスに含まれるキーワードによるアイコン判定（全組み込みアプリ対応）
 */
const APP_KEYWORDS = [
    { key: "taskbarproperties", icon: "./icons/taskbarproperties.png" },
    { key: "taskbar", icon: "./icons/taskbarproperties.png" },
    { key: "systemproperties", icon: "./icons/systemproperties.png" },
    { key: "taskmanager", icon: "./icons/taskmanager.png" },
    { key: "task manager", icon: "./icons/taskmanager.png" },
    { key: "registryeditor", icon: "./icons/registryeditor.png" },
    { key: "networkmonitor", icon: "./icons/network_monitor.png" },
    { key: "network_monitor", icon: "./icons/network_monitor.png" },
    { key: "eventlog", icon: "./icons/eventlog.png" },
    { key: "startmenu", icon: "./icons/startmenu.png" },
    { key: "toolbar", icon: "./icons/toolbar.png" },
    { key: "minesweeper", icon: "./icons/minesweeper.png" },
    { key: "tetris", icon: "./icons/tetris.png" },
    { key: "browser", icon: "./icons/browser.png" },
    { key: "explorer", icon: "./icons/explorer.png" },
    { key: "paint", icon: "./icons/paint.png" },
    { key: "texteditor", icon: "./icons/texteditor.png" },
    { key: "notepad", icon: "./icons/texteditor.png" },
    { key: "codeeditor", icon: "./icons/codeeditor.png" },
    { key: "code", icon: "./icons/codeeditor.png" },
    { key: "imageviewer", icon: "./icons/imageviewer.png" },
    { key: "image", icon: "./icons/imageviewer.png" },
    { key: "pdfviewer", icon: "./icons/pdfviewer.png" },
    { key: "pdf", icon: "./icons/pdfviewer.png" },
    { key: "audioplayer", icon: "./icons/audioplayer.png" },
    { key: "audio", icon: "./icons/audioplayer.png" },
    { key: "soundsplayer", icon: "./icons/soundplayer.png" },
    { key: "soundplayer", icon: "./icons/soundplayer.png" },
    { key: "sound", icon: "./icons/soundplayer.png" },
    { key: "videoplayer", icon: "./icons/videoplayer.png" },
    { key: "video", icon: "./icons/videoplayer.png" },
    { key: "calc", icon: "./icons/calc.png" },
    { key: "settings", icon: "./icons/settings.png" },
    { key: "terminal", icon: "./icons/terminal.png" },
    { key: "spreadsheet", icon: "./icons/spreadsheet.png" },
    { key: "clock", icon: "./icons/clock.png" }
];

const LOCAL_IMAGE_PATH_REGEX = /^(\.\/|\/)?[a-zA-Z0-9_\-./]+\.(png|jpe?g|gif|webp|svg|ico)(\?[a-zA-Z0-9_=&.-]+)?$/i;

/**
 * アイコン文字列のサニタイズ（絵文字 / 画像DataURL / 組み込みアプリ用ローカル画像パスを許可）
 */
export function sanitizeIcon(icon) {
    if (typeof icon !== "string") return null;
    const trimmed = icon.trim();
    if (!trimmed) return null;

    // 1. 安全な画像DataURL（PNG/JPEG/GIF/WebP/SVG/ICO）
    if (/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml|x-icon|vnd\.microsoft\.icon)(?:;charset=utf-8)?;base64,[a-zA-Z0-9+/=\r\n]+$/i.test(trimmed)) {
        const compact = trimmed.replace(/[\r\n]+/g, "");
        return compact.length <= 524288 ? compact : null; // 最大512KB制限
    }

    // 2. 組み込みアプリ用ローカル画像パス（例: ./icons/calc.png, /assets/icons/calc.svg）
    //    ディレクトリトラバーサル(..)・プロトコル相対(//)・外部スキーム(:)を遮断
    if (
        trimmed.length <= 256 &&
        !trimmed.includes("..") &&
        !trimmed.startsWith("//") &&
        !trimmed.includes(":") &&
        LOCAL_IMAGE_PATH_REGEX.test(trimmed)
    ) {
        return trimmed;
    }

    // 3. 絵文字・テキストアイコン（HTMLタグやスクリプト文字を除外し16文字以内）
    if (trimmed.length <= 16 && !/[<>'"`]/.test(trimmed) && !/^javascript:/i.test(trimmed)) {
        return trimmed;
    }

    return null;
}

/**
 * アイコン値が画像（DataURL または ローカル画像パス）かどうかを判定
 */
export function isImageIcon(icon) {
    if (typeof icon !== "string") return false;
    return icon.startsWith("data:image/") || LOCAL_IMAGE_PATH_REGEX.test(icon);
}

function getSafeFallbackEmoji(fallback, defaultEmoji = "📄") {
    if (typeof fallback === "string") {
        const clean = sanitizeIcon(fallback);
        if (clean && !isImageIcon(clean)) return clean;
    }
    return defaultEmoji;
}

/**
 * テンプレートHTML内でアイコンを安全に描画するためのHTML文字列を返す
 * 画像読み込み失敗時は fallback 絵文字へ自動切替
 */
export function renderIconHTML(icon, size = "1em", fallback = "📄") {
    const safeFallback = getSafeFallbackEmoji(fallback, "📄");
    const safe = sanitizeIcon(icon) || safeFallback;
    if (isImageIcon(safe)) {
        return `<img class="nexser-custom-icon" src="${safe}" alt="" draggable="false" onerror="this.replaceWith(document.createTextNode('${safeFallback}'))" style="width:${size}; height:${size}; object-fit:contain; display:block; flex-shrink:0; pointer-events:none; user-select:none;">`;
    }
    return safe;
}

/**
 * 任意のDOM要素へアイコン（絵文字または画像）を差分更新で適用する
 */
export function applyIconToElement(el, icon, size = "1em", fallback = "📄") {
    if (!el) return;
    const safeFallback = getSafeFallbackEmoji(fallback, "📄");
    const safe = sanitizeIcon(icon) || safeFallback;
    const cacheKey = `${safe}|${size}`;
    if (el.dataset.iconValue === cacheKey) return;
    el.dataset.iconValue = cacheKey;

    if (isImageIcon(safe)) {
        el.textContent = "";
        const img = el.ownerDocument.createElement("img");
        img.className = "nexser-custom-icon";
        img.src = safe;
        img.alt = "";
        img.draggable = false;
        Object.assign(img.style, {
            width: size,
            height: size,
            objectFit: "contain",
            display: "block",
            flexShrink: "0",
            pointerEvents: "none",
            userSelect: "none"
        });
        img.onerror = () => {
            if (img.parentNode === el) {
                el.dataset.iconValue = `${safeFallback}|${size}`;
                el.textContent = safeFallback;
            }
        };
        el.appendChild(img);
    } else {
        el.textContent = safe;
    }
}

/**
 * 外部サンドボックス・アプリから拡張子とアイコン・起動アプリを動的登録する
 */
export function registerFileAssociation(ext, appPath = null, icon = null, options = {}) {
    if (typeof ext !== "string" || !ext.trim()) {
        throw new Error("有効な拡張子を指定してください。");
    }
    const normExt = (ext.startsWith(".") ? ext : `.${ext}`).trim().toLowerCase();
    if (!/^\.[a-z0-9_-]{1,15}$/.test(normExt)) {
        throw new Error(`不正な拡張子形式です: ${ext}`);
    }

    // システム標準の関連付けを上書きしようとした場合の保護（allowOverride: true 時のみ許可）
    if (!options.allowOverride && Object.hasOwn(FILE_ASSOCIATIONS, normExt) && appPath && FILE_ASSOCIATIONS[normExt] !== appPath) {
        throw new Error(`拡張子 '${normExt}' はシステム標準アプリに保護されています。`);
    }

    if (typeof appPath === "string" && appPath.trim()) {
        if (!/^C:\/Programs\/Applications\/[^/\\]+\.app$/i.test(appPath.trim())) {
            throw new Error(`起動アプリは C:/Programs/Applications/ 配下の .app のみ指定可能です: ${appPath}`);
        }
        customAssociations.set(normExt, appPath.trim());
    }

    if (icon !== null && icon !== undefined) {
        const cleanIcon = sanitizeIcon(icon);
        if (!cleanIcon) {
            throw new Error("無効または安全でないアイコンデータです（絵文字または128KB以下の画像DataURLのみ許可）。");
        }
        customExtensionIcons.set(normExt, cleanIcon);
    }

    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("file-associations-updated", { detail: { ext: normExt } }));
    }
    return true;
}

/**
 * 動的登録された拡張子設定を解除
 */
export function unregisterFileAssociation(ext) {
    if (typeof ext !== "string") return false;
    const normExt = (ext.startsWith(".") ? ext : `.${ext}`).trim().toLowerCase();
    const removedAssoc = customAssociations.delete(normExt);
    const removedIcon = customExtensionIcons.delete(normExt);
    if ((removedAssoc || removedIcon) && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("file-associations-updated", { detail: { ext: normExt } }));
    }
    return removedAssoc || removedIcon;
}

/**
 * 永続化用のエクスポート / インポート（C:/System/FileAssociations.json 用）
 */
export function exportCustomAssociations() {
    const data = {};
    const allExts = new Set([...customAssociations.keys(), ...customExtensionIcons.keys()]);
    for (const ext of allExts) {
        data[ext] = {
            app: customAssociations.get(ext) || null,
            icon: customExtensionIcons.get(ext) || null
        };
    }
    return data;
}

export function importCustomAssociations(data) {
    if (!data || typeof data !== "object") return;
    customAssociations.clear();
    customExtensionIcons.clear();
    for (const [ext, entry] of Object.entries(data)) {
        if (!entry || typeof entry !== "object") continue;
        try {
            registerFileAssociation(ext, entry.app || null, entry.icon || null, { allowOverride: true });
        } catch (e) {
            console.warn(`[FileAssociations] Skipped invalid entry for ${ext}:`, e.message);
        }
    }
}

/**
 * パスから拡張子を取得
 */
export function getExtension(path) {
    if (typeof path !== "string") return "";
    const i = path.lastIndexOf(".");
    if (i === -1 || i === path.length - 1) return "";
    return path.slice(i).toLowerCase();
}

/**
 * 拡張子を考慮した表示用ファイル名を取得
 */
export function getDisplayFileName(name, showExtensions = true) {
    if (!name || showExtensions) return name;
    const ext = getExtension(name);
    if (ext) {
        const lastDot = name.lastIndexOf(".");
        if (lastDot > 0) {
            return name.substring(0, lastDot);
        }
    }
    return name;
}

/**
 * 拡張子から起動アプリを取得（カスタム登録を優先）
 */
export function resolveAppByPath(path) {
    if (typeof path !== "string") return null;
    const ext = getExtension(path);
    return customAssociations.get(ext) || FILE_ASSOCIATIONS[ext] || null;
}

function hasFolderChildren(folderNode) {
    if (!folderNode || typeof folderNode !== "object") return false;
    return Object.keys(folderNode).some(k => !isSystemMetaKey(k));
}

function getTrashIcon(trashNode = null) {
    const targetTrash = trashNode || resolveFS("C:/Trash");
    return hasFolderChildren(targetTrash) ? SYSTEM_ICONS.trashFull : SYSTEM_ICONS.trashEmpty;
}

/**
 * ファイルやアプリのアイコンを判定する関数
 */
export function getIcon(name, node, fullPath = "", currentPath = "", depth = 0) {
    const safeName = typeof name === "string" ? name : "";
    const lowerName = safeName.toLowerCase();
    const normFull = typeof fullPath === "string" ? fullPath.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase() : "";
    const normCurrent = typeof currentPath === "string" ? currentPath.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase() : "";

    // 0. ノード個別のカスタムアイコン（node.icon）が指定されていれば最優先
    if (node && typeof node.icon === "string") {
        const customNodeIcon = sanitizeIcon(node.icon);
        if (customNodeIcon) return customNodeIcon;
    }

    // 1. 特殊システム項目（ゴミ箱・PC / マイコンピュータ）
    if (lowerName === "trash" || normFull === "c:/trash") {
        return getTrashIcon(node && node.type === "folder" ? node : null);
    }
    if (lowerName === "pc" || lowerName === "my computer" || lowerName === "c:" || normFull === "c:") {
        return SYSTEM_ICONS.pc;
    }

    // 2. リンク（ショートカット）の場合：リンク先の実体ノードを再帰解決してアイコン継承
    if (node && node.type === "link" && node.target) {
        const targetLower = node.target.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
        if (targetLower === "c:/trash" || targetLower.endsWith("/trash")) {
            return getTrashIcon();
        }
        if (depth < 5) {
            try {
                const targetNode = resolveFS(node.target);
                if (targetNode) {
                    const targetName = node.target.replace(/\/+$/, "").split("/").pop() || safeName;
                    return getIcon(targetName, targetNode, node.target, currentPath, depth + 1);
                }
            } catch (_) { }
        }
        return SYSTEM_ICONS.shortcut;
    }

    // 3. フォルダのアイコン判定（開いている状態 / 中身あり / 空）
    if (node && node.type === "folder") {
        if (normFull && normCurrent && normFull === normCurrent) {
            return SYSTEM_ICONS.folderOpen;
        }
        return hasFolderChildren(node) ? SYSTEM_ICONS.folderFull : SYSTEM_ICONS.folderEmpty;
    }

    if (node && node.type === "link") {
        return SYSTEM_ICONS.shortcut;
    }

    // 4. アプリケーションの判定
    if (node && node.type === "app") {
        const entryPath = (node.entry || "").toLowerCase();
        const matched = APP_KEYWORDS.find(
            item => lowerName.includes(item.key) || entryPath.includes(item.key)
        );
        return matched ? matched.icon : SYSTEM_ICONS.appDefault;
    }

    // 5. 拡張子による判定（カスタム拡張子アイコン → 標準アイコン → デフォルトファイル）
    const ext = getExtension(safeName);
    return customExtensionIcons.get(ext) || DEFAULT_EXTENSION_ICONS[ext] || SYSTEM_ICONS.fileDefault;
}