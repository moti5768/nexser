// fs-utils.js
import { FS } from "./fs.js";

/**
 * パスからファイルシステム上のノードを解決する
 * 【完全修正版】C: ドライブのルート構造を正しく経由するように対応
 */
export function resolveFS(path, cwd = "C:/", root = FS) {
    if (typeof path !== "string") return null;
    const normalized = normalizePath(path, cwd);
    const parts = normalized.split("/").filter(Boolean);
    let cur = root;
    for (const p of parts) {
        if (!cur || typeof cur !== "object") return null;
        cur = cur[p];
        if (!cur) return null;
    }
    return cur;
}

/**
 * パス正規化
 * 堅牢性向上: ".." や "." の相対パス計算に対応し、ディレクトリトラバーサルを防止
 */
export function normalizePath(path, cwd = "C:/") {
    if (!path || path === ".") return cwd;

    // 「C:」や「C」単体、または「C:/」で始まる場合の判定
    let fullPath;
    if (path === "C:" || path === "C" || path.startsWith("C:/")) {
        // "C" や "C:" が来たら強制的に "C:/" に補正する
        fullPath = (path === "C" || path === "C:") ? "C:/" : path;
    } else if (path.startsWith("/")) {
        fullPath = "C:/" + path.slice(1);
    } else {
        fullPath = cwd.replace(/\/$/, "") + "/" + path;
    }

    // スラッシュの統一と分割
    const normalizedPath = fullPath.includes("\\") ? fullPath.replace(/\\/g, "/") : fullPath;
    const parts = normalizedPath.split("/").filter(Boolean);
    const stack = [];

    for (const part of parts) {
        if (part === ".") continue;
        if (part === "..") {
            if (stack.length > 1) stack.pop(); // "C:" より上には戻さない
            continue;
        }
        stack.push(part);
    }

    // ⭐ 修正: ドライブレターのみ（例: "C:" のみ）の場合は "C:/" を返すようにする
    if (stack[0] && stack[0].endsWith(":")) {
        if (stack.length === 1) {
            return stack[0] + "/"; // "C:" -> "C:/" に正規化
        }
        return stack[0] + "/" + stack.slice(1).join("/");
    }
    return "C:/" + result;
}

/**
 * FSパス → アプリモジュールパス
 */
export function fsPathToModulePath(fsPath) {
    if (!fsPath) return "";
    const cleanPath = fsPath.replace(/\.js$/, "");
    return `./apps/${cleanPath}.js`;
}

/**
 * FileReader を Promise 化
 */
export async function loadFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        if (!(file instanceof Blob)) {
            return reject(new Error("有効なファイルではありません"));
        }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

/**
 * FileReader を使ってテキストとして読み込む
 */
export async function loadFileAsText(file) {
    return new Promise((resolve, reject) => {
        if (!(file instanceof Blob)) {
            return reject(new Error("有効なファイルではありません"));
        }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

/**
 * 拡張子を判定し、テキストかDataURLかを自動で振り分けて読み込む
 */
export async function importFileSmart(file) {
    const textExts = /\.(txt|md|js|ts|json|css|scss|vue|html|htm|cfg)$/i;

    if (textExts.test(file.name)) {
        return await loadFileAsText(file);
    } else {
        return await loadFileAsDataURL(file);
    }
}

/**
 * ファイル/フォルダ名のバリデーション
 */
export function validateName(name) {
    if (!name) return "名前が空です";

    const trimmedName = name.trim();
    if (!trimmedName) return "空白のみの名前は使用できません";

    if (trimmedName.length > 255) return "名前が長すぎます";

    const invalidChars = /[\\\/:*?"<>|]/;
    if (invalidChars.test(trimmedName)) {
        return '次の文字は使えません: \\ / : * ? " < > |';
    }

    if (/[\. ]$/.test(trimmedName)) {
        return "名前の末尾に「.」や空白は使えません";
    }

    const reserved = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i;
    if (reserved.test(trimmedName)) {
        return `システム予約名「${trimmedName}」は使用できません`;
    }

    return null;
}

/**
 * パスからファイル名（末尾の要素）を取得する
 */
export function basename(path) {
    if (typeof path !== "string" || !path) return "";

    const cleanPath = path.replace(/[\\/]+$/, "");
    const lastSlashIndex = Math.max(cleanPath.lastIndexOf("/"), cleanPath.lastIndexOf("\\"));

    if (lastSlashIndex === -1) {
        return cleanPath.endsWith(":") ? "" : cleanPath;
    }

    const result = cleanPath.substring(lastSlashIndex + 1);
    return result.endsWith(":") ? "" : result;
}

export function getUniqueName(parentNode, idealName) {
    if (!parentNode || !parentNode[idealName]) return idealName;

    const dotIndex = idealName.lastIndexOf(".");
    const hasExtension = dotIndex > 0;
    const base = hasExtension ? idealName.substring(0, dotIndex) : idealName;
    const ext = hasExtension ? idealName.substring(dotIndex) : "";

    let counter = 1;
    let finalName = idealName;

    while (parentNode[finalName]) {
        finalName = `${base} (${counter++})${ext}`;
    }

    return finalName;
}

/**
 * 移動先が自分自身、その子孫になっていないかを厳格にチェックする安全確認関数
 */
export function isDescendantOrSelf(sourcePath, targetPath) {
    if (!sourcePath || !targetPath) return false;

    const sourceNode = resolveFS(sourcePath);
    if (!sourceNode) return false;

    if (sourceNode.type === "link") {
        return false;
    }

    if (sourceNode.type !== "folder") {
        return false;
    }

    const sourceNorm = normalizePath(sourcePath);
    const targetNorm = normalizePath(targetPath);

    if (sourceNorm === targetNorm) return true;

    let current = targetNorm;
    let steps = 0;
    while (current && steps < 100) {
        if (current === sourceNorm) return true;
        const lastSlash = current.lastIndexOf("/");
        if (lastSlash === -1 || lastSlash <= 2) break;
        current = current.substring(0, lastSlash);
        steps++;
    }

    return false;
}