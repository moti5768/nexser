// file-associations.js
// 拡張子 → 起動アプリ対応表

export const FILE_ASSOCIATIONS = {
    // text
    ".txt": "Programs/Accessories/TextEditor.app",
    ".md": "Programs/Accessories/TextEditor.app",

    // code
    ".js": "Programs/Accessories/Multimedia/CodeEditor.app",
    ".ts": "Programs/Accessories/Multimedia/CodeEditor.app",
    ".json": "Programs/Accessories/Multimedia/CodeEditor.app",
    ".css": "Programs/Accessories/Multimedia/CodeEditor.app",
    ".scss": "Programs/Accessories/Multimedia/CodeEditor.app",
    ".vue": "Programs/Accessories/Multimedia/CodeEditor.app",

    // images
    ".png": "Programs/Accessories/Multimedia/ImageViewer.app",
    ".jpg": "Programs/Accessories/Multimedia/ImageViewer.app",
    ".jpeg": "Programs/Accessories/Multimedia/ImageViewer.app",
    ".gif": "Programs/Accessories/Multimedia/ImageViewer.app",

    // video
    ".mp4": "Programs/Accessories/Multimedia/VideoPlayer.app",
    ".webm": "Programs/Accessories/Multimedia/VideoPlayer.app",
    ".ogg": "Programs/Accessories/Multimedia/VideoPlayer.app",
    ".mov": "Programs/Accessories/Multimedia/VideoPlayer.app",
    ".mkv": "Programs/Accessories/Multimedia/VideoPlayer.app"
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
