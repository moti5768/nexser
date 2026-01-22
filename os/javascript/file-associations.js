// file-associations.js
// 拡張子 → 起動アプリ対応表

export const FILE_ASSOCIATIONS = {
    // text
    ".txt": "Programs/TextEditor.app",
    ".md": "Programs/TextEditor.app",

    // images
    ".png": "Programs/ImageViewer.app",
    ".jpg": "Programs/ImageViewer.app",
    ".jpeg": "Programs/ImageViewer.app",
    ".gif": "Programs/ImageViewer.app",

    // video
    ".mp4": "Programs/VideoPlayer.app",
    ".webm": "Programs/VideoPlayer.app",
    ".ogg": "Programs/VideoPlayer.app",
    ".mov": "Programs/VideoPlayer.app",
    ".mkv": "Programs/VideoPlayer.app",
};

/**
 * パスから拡張子を取得
 */
export function getExtension(path) {
    const i = path.lastIndexOf(".");
    if (i === -1) return "";
    return path.slice(i).toLowerCase();
}

/**
 * 拡張子から起動アプリを取得
 */
export function resolveAppByPath(path) {
    const ext = getExtension(path);
    return FILE_ASSOCIATIONS[ext] || null;
}
