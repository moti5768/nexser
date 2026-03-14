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

    // audio (再生バー付きの新しい AudioPlayer.app に対応)
    ".mp3": "Programs/Applications/AudioPlayer.app",
    ".wav": "Programs/Applications/AudioPlayer.app",
    ".m4a": "Programs/Applications/AudioPlayer.app",
    ".flac": "Programs/Applications/AudioPlayer.app",
    ".aac": "Programs/Applications/AudioPlayer.app"
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

/**
 * ファイルやアプリのアイコンを判定する関数
 */
export function getIcon(name, node) {
    if (name.toLowerCase() === "trash") return "🗑️";
    if (node.type === "folder") return "📁";
    if (node.type === "link") return "🔗";

    if (node.type === "app") {
        const lowerName = name.toLowerCase();
        const entryPath = (node.entry || "").toLowerCase();

        if (lowerName.includes("explorer") || entryPath.includes("explorer")) return "🔍";
        if (lowerName.includes("paint") || entryPath.includes("paint")) return "🎨";
        if (lowerName.includes("texteditor") || lowerName.includes("notepad") || entryPath.includes("texteditor")) return "📝";
        if (lowerName.includes("code") || entryPath.includes("codeeditor")) return "💻";
        if (lowerName.includes("image") || entryPath.includes("imageviewer")) return "🖼️";

        // --- 修正ポイント：audio を video より先に判定するか、条件を厳密にする ---
        if (lowerName.includes("audio") || lowerName.includes("sound") || entryPath.includes("audioplayer") || entryPath.includes("soundplayer")) return "🎵";

        // video の判定
        if (lowerName.includes("video") || entryPath.includes("videoplayer")) return "🎬";

        if (lowerName.includes("calc") || entryPath.includes("calc")) return "🧮";
        if (lowerName.includes("settings") || entryPath.includes("settings")) return "⚙️";
        if (lowerName.includes("terminal") || entryPath.includes("terminal")) return "📟";
        if (lowerName.includes("taskmanager") || entryPath.includes("taskmanager")) return "📊";
        if (lowerName.includes("clock") || entryPath.includes("clock")) return "🕒";

        return "⚙️";
    }

    // 3. 拡張子による判定（ファイルの場合）
    const ext = getExtension(name);

    // カテゴリ定義
    const categories = {
        text: [".txt", ".md"],
        code: [".js", ".ts", ".json", ".css", ".scss", ".vue", ".html"],
        image: [".png", ".jpg", ".jpeg", ".gif", ".webp"],
        paint: [".bmp"],
        video: [".mp4", ".webm", ".ogg", ".mov", ".mkv"],
        audio: [".mp3", ".wav", ".m4a", ".flac", ".aac"],
        system: [".cfg"] // AUTOBOOT.CFG 等
    };

    if (categories.text.includes(ext)) return "📄";
    if (categories.code.includes(ext)) return "📜";
    if (categories.image.includes(ext)) return "🖼️";
    if (categories.paint.includes(ext)) return "🎨";
    if (categories.video.includes(ext)) return "📽️";
    if (categories.audio.includes(ext)) return "🎵";
    if (categories.system.includes(ext)) return "🛠️";

    return "📄"; // 未知のファイルのデフォルト
}