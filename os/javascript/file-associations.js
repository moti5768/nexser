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

    // URL
    ".url": "C:/Programs/Applications/Browser.app"
};

/**
 * 拡張子ごとのアイコンマップ (O(1)検索用)
 */
const EXTENSION_ICONS = {
    ".txt": "📄", ".md": "📄",
    ".js": "📜", ".ts": "📜", ".json": "📜", ".css": "📜", ".scss": "📜", ".vue": "📜", ".html": "📜", ".htm": "📜",
    ".url": "🌐",
    ".png": "🖼️", ".jpg": "🖼️", ".jpeg": "🖼️", ".gif": "🖼️", ".webp": "🖼️",
    ".bmp": "🎨",
    ".mp4": "📽️", ".webm": "📽️", ".ogg": "📽️", ".mov": "📽️", ".mkv": "📽️",
    ".mp3": "🎵", ".wav": "🎵", ".m4a": "🎵", ".flac": "🎵", ".aac": "🎵",
    ".pdf": "📕",
    ".cfg": "🛠️"
};

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
    { key: "clock", icon: "🕒" }
];

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
 * 拡張子から起動アプリを取得
 */
export function resolveAppByPath(path) {
    if (typeof path !== "string") return null;
    const ext = getExtension(path);
    return FILE_ASSOCIATIONS[ext] || null;
}

/**
 * ファイルやアプリのアイコンを判定する関数
 */
export function getIcon(name, node, fullPath = "", currentPath = "") {
    const lowerName = name.toLowerCase();

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
        // ① 現在開いているフォルダの場合
        if (fullPath && fullPath === currentPath) {
            return "📂";
        }

        // ② 中身がある場合（メタデータ以外のキーが1つ以上あるか）
        const hasChildren = Object.keys(node).some(k =>
            k !== "type" && k !== "system" && k !== "originalPath" && k !== "lastModified" && k !== "hidden"
        );
        if (hasChildren) {
            return "🗂️"; // 中身があるフォルダ
        }

        // ③ 空の場合
        return "📁";
    }

    if (node && node.type === "link") return "🔗";

    // 2. アプリケーションの判定
    if (node && node.type === "app") {
        const entryPath = (node.entry || "").toLowerCase();
        const matched = APP_KEYWORDS.find(
            item => lowerName.includes(item.key) || entryPath.includes(item.key)
        );
        return matched ? matched.icon : "⚙️"; // アプリのデフォルト
    }

    // 3. 拡張子による判定（ファイルの場合）
    const ext = getExtension(name);
    return EXTENSION_ICONS[ext] || "📄"; // 未知のファイルのデフォルト
}