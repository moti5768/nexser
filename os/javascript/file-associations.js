// file-associations.js

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
 * 拡張子ごとのデフォルトアイコンマップ (O(1)検索用)
 */
const DEFAULT_EXTENSION_ICONS = {
    ".txt": "📄", ".md": "📄",
    ".js": "📜", ".ts": "📜", ".json": "📜", ".css": "📜", ".scss": "📜", ".vue": "📜", ".html": "📜", ".htm": "📜",
    ".url": "🌐",
    ".png": "🖼️", ".jpg": "🖼️", ".jpeg": "🖼️", ".gif": "🖼️", ".webp": "🖼️",
    ".bmp": "🎨",
    ".mp4": "📽️", ".webm": "📽️", ".ogg": "📽️", ".mov": "📽️", ".mkv": "📽️",
    ".mp3": "🎵", ".wav": "🎵", ".m4a": "🎵", ".flac": "🎵", ".aac": "🎵",
    ".pdf": "📕",
    ".nxs": "📊", ".csv": "📊",
    ".cfg": "🛠️"
};

// 外部アプリ・ユーザーによる動的登録レジストリ
const customAssociations = new Map();   // ext -> appPath
const customExtensionIcons = new Map(); // ext -> icon

/**
 * アプリ名・パスに含まれるキーワードによるアイコン判定
 */
const APP_KEYWORDS = [
    { key: "browser", icon: "🌐" },
    { key: "explorer", icon: "🔍" },
    { key: "paint", icon: "🎨" },
    { key: "texteditor", icon: "📝" },
    { key: "notepad", icon: "📝" },
    { key: "code", icon: "💻" },
    { key: "image", icon: "🖼️" },
    { key: "pdf", icon: "📕" },
    { key: "audio", icon: "🎵" },
    { key: "sound", icon: "🎵" },
    { key: "video", icon: "🎬" },
    { key: "calc", icon: "🧮" },
    { key: "settings", icon: "⚙️" },
    { key: "terminal", icon: "📟" },
    { key: "taskmanager", icon: "📊" },
    { key: "spreadsheet", icon: "📊" },
    { key: "clock", icon: "🕒" }
];

/**
 * アイコン文字列のサニタイズ（絵文字 または 安全な画像DataURLのみ許可）
 */
export function sanitizeIcon(icon) {
    if (typeof icon !== "string") return null;
    const trimmed = icon.trim();
    if (!trimmed) return null;

    // 1. 安全な画像DataURL（PNG/JPEG/GIF/WebP/SVG）
    if (/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,[a-zA-Z0-9+/=]+$/i.test(trimmed)) {
        return trimmed.length <= 131072 ? trimmed : null; // 最大128KB制限
    }

    // 2. 絵文字・テキストアイコン（HTMLタグやスクリプト文字を除外し16文字以内）
    if (trimmed.length <= 16 && !/[<>'"`]/.test(trimmed) && !/^javascript:/i.test(trimmed)) {
        return trimmed;
    }

    return null;
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

/**
 * ファイルやアプリのアイコンを判定する関数
 */
export function getIcon(name, node, fullPath = "", currentPath = "") {
    const lowerName = name.toLowerCase();

    // 0. ノード個別のカスタムアイコン（node.icon）が指定されていれば最優先
    if (node && typeof node.icon === "string") {
        const customNodeIcon = sanitizeIcon(node.icon);
        if (customNodeIcon) return customNodeIcon;
    }

    // 1. 特殊・基本フォルダ名
    if (lowerName === "trash") return "🗑️";

    // リンク（ショートカット）の場合の判定
    if (node && node.type === "link" && node.target) {
        const targetLower = node.target.toLowerCase();
        if (targetLower.includes("trash")) {
            return "🗑️"; // ゴミ箱へのショートカット
        }
        return "🔗"; // 一般的なショートカット
    }

    // Windows風フォルダのアイコン判定
    if (node && node.type === "folder") {
        if (fullPath && fullPath === currentPath) {
            return "📂";
        }
        const hasChildren = Object.keys(node).some(k =>
            k !== "type" && k !== "system" && k !== "originalPath" && k !== "lastModified" && k !== "hidden" && k !== "icon"
        );
        if (hasChildren) {
            return "🗂️"; // 中身があるフォルダ
        }
        return "📁";
    }

    if (node && node.type === "link") return "🔗";

    // 2. アプリケーションの判定
    if (node && node.type === "app") {
        const entryPath = (node.entry || "").toLowerCase();
        const matched = APP_KEYWORDS.find(
            item => lowerName.includes(item.key) || entryPath.includes(item.key)
        );
        return matched ? matched.icon : "⚙️";
    }

    // 3. 拡張子による判定（カスタム拡張子アイコン → 標準アイコン → デフォルト）
    const ext = getExtension(name);
    return customExtensionIcons.get(ext) || DEFAULT_EXTENSION_ICONS[ext] || "📄";
}