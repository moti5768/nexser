// fs-utils.js
import { FS } from "./fs.js";

/**
 * FS のパスを再帰的に解決（リンクも自動解決）
 */
export function resolveFS(path) {
    if (typeof path !== "string") return null;
    const parts = path.split(/[\\/]/).filter(Boolean);
    let cur = FS;
    const visited = new Set(); // 循環防止

    for (const p of parts) {
        if (!cur) return null;
        cur = cur[p];
        if (!cur) return null;

        // リンク解決
        let steps = 0;
        while (cur && cur.type === "link") {
            if (visited.has(cur)) return null; // 循環検知
            visited.add(cur);
            cur = resolveFS(cur.target);
            if (steps++ > 100) return null; // 安全ガード
        }

        if (!cur) return null;
    }
    return cur;
}


/**
 * パス正規化
 */
export function normalizePath(path, cwd = "C:/") {
    if (!path || path === ".") return cwd;
    if (path.startsWith("C:/")) return path;
    if (path.startsWith("/")) return "C:/" + path.slice(1);
    return (cwd.replace(/\/$/, "") + "/" + path).replace(/\/+/g, "/");
}

/**
 * FSパス → アプリモジュールパス
 */
export function fsPathToModulePath(fsPath) {
    return `./apps/${fsPath}.js`;
}

export function loadFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export function validateName(name) {
    if (!name) return "名前が空です";

    const invalidChars = /[\\\/:*?"<>|]/;
    if (invalidChars.test(name)) {
        return '次の文字は使えません: \\ / : * ? " < > |';
    }

    if (!name.trim()) {
        return "空白のみの名前は使用できません";
    }

    if (/[\. ]$/.test(name)) {
        return "名前の末尾に「.」や空白は使えません";
    }

    return null;
}