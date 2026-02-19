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

    // images
    ".png": "Programs/Applications/ImageViewer.app",
    ".jpg": "Programs/Applications/ImageViewer.app",
    ".jpeg": "Programs/Applications/ImageViewer.app",
    ".gif": "Programs/Applications/ImageViewer.app",

    // video
    ".mp4": "Programs/Applications/VideoPlayer.app",
    ".webm": "Programs/Applications/VideoPlayer.app",
    ".ogg": "Programs/Applications/VideoPlayer.app",
    ".mov": "Programs/Applications/VideoPlayer.app",
    ".mkv": "Programs/Applications/VideoPlayer.app"
};


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
    if (typeof path !== "string") return null;   // 安全対策
    const ext = getExtension(path);
    return FILE_ASSOCIATIONS[ext] || null;
}

// file-ui-utils.js (新規作成 または file-associations.js に追記)

export function getIcon(name, node) {
    // 1. 基本型による判定
    if (node.type === "folder") return "📁";
    if (node.type === "link") return "🔗";

    // 2. アプリケーション固有の判定
    if (node.type === "app") {
        if (name.includes("Explorer")) return "🔍";
        if (name.includes("Paint")) return "🎨";
        if (name.includes("TextEditor") || name.includes("Notepad")) return "📝";
        if (name.includes("CodeEditor")) return "💻";
        if (name.includes("ImageViewer")) return "🖼️";
        if (name.includes("VideoPlayer")) return "🎬";
        return "⚙️"; // デフォルトのアプリアイコン
    }

    // 3. 拡張子によるカテゴリ判定
    const ext = "." + name.split('.').pop().toLowerCase();

    const categories = {
        text: [".txt", ".md"],
        code: [".js", ".ts", ".json", ".css", ".scss", ".vue"],
        image: [".png", ".jpg", ".jpeg", ".gif"],
        video: [".mp4", ".webm", ".ogg", ".mov", ".mkv"]
    };

    if (categories.text.includes(ext)) return "📄";
    if (categories.code.includes(ext)) return "📜";
    if (categories.image.includes(ext)) return "🖼️";
    if (categories.video.includes(ext)) return "📽️";

    return "📄"; // 最終的なデフォルト
}