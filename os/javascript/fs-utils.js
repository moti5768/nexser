// fs-utils.js
import { FS } from "./fs.js";

/**
 * FS のパスを再帰的に解決（リンクも自動解決）
 */
export function resolveFS(path) {
    if (typeof path !== "string") return null;
    const parts = path.split("/").filter(Boolean);
    let cur = FS;
    for (const p of parts) {
        cur = cur[p];
        if (!cur) return null;
        if (cur.type === "link") cur = resolveFS(cur.target);
        if (!cur) return null;
    }
    return cur;
}

/**
 * パス正規化
 * Terminal, Explorer, Desktop で共通
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