// file-associations.js
// 拡張子 → 起動アプリ対応表
export const FILE_ASSOCIATIONS = {
    // text
    ".txt": "Programs/Applications/TextEditor.app",
    ".md": "Programs/Applications/TextEditor.app",

    // code
    ".js": "Programs/Applications/CodeEditor.app",
    ".ts": "Programs/Applications/CodeEditor.app",
    ".json": "Programs/Applications/CodeEditor.app",
    ".css": "Programs/Applications/CodeEditor.app",
    ".scss": "Programs/Applications/CodeEditor.app",
    ".vue": "Programs/Applications/CodeEditor.app",
    ".html": "Programs/Applications/CodeEditor.app",
    ".htm": "Programs/Applications/CodeEditor.app",

    // images
    ".png": "Programs/Applications/ImageViewer.app",
    ".jpg": "Programs/Applications/ImageViewer.app",
    ".jpeg": "Programs/Applications/ImageViewer.app",
    ".gif": "Programs/Applications/ImageViewer.app",
    ".webp": "Programs/Applications/ImageViewer.app",

    // paint
    ".bmp": "Programs/Applications/Paint.app",

    // video
    ".mp4": "Programs/Applications/VideoPlayer.app",
    ".webm": "Programs/Applications/VideoPlayer.app",
    ".ogg": "Programs/Applications/VideoPlayer.app",
    ".mov": "Programs/Applications/VideoPlayer.app",
    ".mkv": "Programs/Applications/VideoPlayer.app",

    // audio
    ".mp3": "Programs/Applications/AudioPlayer.app",
    ".wav": "Programs/Applications/AudioPlayer.app",
    ".m4a": "Programs/Applications/AudioPlayer.app",
    ".flac": "Programs/Applications/AudioPlayer.app",
    ".aac": "Programs/Applications/AudioPlayer.app",

    // pdf
    ".pdf": "Programs/Applications/PDFViewer.app"
};

/**
 * 拡張子ごとのアイコンマップ (O(1)検索用)
 */
const EXTENSION_ICONS = {
    ".txt": "📄", ".md": "📄",
    ".js": "📜", ".ts": "📜", ".json": "📜", ".css": "📜", ".scss": "📜", ".vue": "📜", ".html": "📜", ".htm": "📜",
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
export function getIcon(name, node) {
    const lowerName = name.toLowerCase();

    // 1. 特殊・基本フォルダ
    if (lowerName === "trash") return "🗑️";
    if (node.type === "folder") return "📁";
    if (node.type === "link") return "🔗";

    // 2. アプリケーションの判定
    if (node.type === "app") {
        const entryPath = (node.entry || "").toLowerCase();
        for (const item of APP_KEYWORDS) {
            if (lowerName.includes(item.key) || entryPath.includes(item.key)) {
                return item.icon;
            }
        }
        return "⚙️"; // アプリのデフォルト
    }

    // 3. 拡張子による判定（ファイルの場合）
    const ext = getExtension(name);
    return EXTENSION_ICONS[ext] || "📄"; // 未知のファイルのデフォルト
}