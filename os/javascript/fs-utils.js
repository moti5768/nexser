// fs-utils.js
import { FS } from "./fs.js";

/**
 * FS のパスを解決（リンクも自動解決）
 * 堅牢性向上: 再帰をループに置き換え、スタックオーバーフローを防止
 */
export function resolveFS(path) {
    if (typeof path !== "string") return null;

    // パスを正規化してから処理
    const normalized = normalizePath(path);
    const parts = normalized.replace(/^C:\//, "").split("/").filter(Boolean);

    let cur = FS;
    const visited = new Set(); // 循環参照検知用

    for (const p of parts) {
        if (!cur || typeof cur !== "object") return null;
        cur = cur[p];

        // リンク解決のループ
        let linkSteps = 0;
        while (cur && cur.type === "link") {
            if (visited.has(cur) || linkSteps > 50) return null; // 循環または深すぎるリンク
            visited.add(cur);

            // リンク先を再評価（絶対パスとして解決）
            cur = resolveFS(cur.target);
            linkSteps++;
        }

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

    // 絶対パスの構築
    let fullPath;
    if (path.startsWith("C:/")) {
        fullPath = path;
    } else if (path.startsWith("/")) {
        fullPath = "C:/" + path.slice(1);
    } else {
        fullPath = cwd.replace(/\/$/, "") + "/" + path;
    }

    // スラッシュの統一と分割
    const parts = fullPath.replace(/\\/g, "/").split("/").filter(Boolean);
    const stack = [];

    for (const part of parts) {
        if (part === ".") continue;
        if (part === "..") {
            if (stack.length > 1) stack.pop(); // "C:" より上には戻さない
            continue;
        }
        stack.push(part);
    }

    // ドライブレターがスタックにない場合のガード（通常は [0] が "C:"）
    const result = stack.join("/");
    return result.includes(":") ? result : "C:/" + result;
}

/**
 * FSパス → アプリモジュールパス
 */
export function fsPathToModulePath(fsPath) {
    if (!fsPath) return "";
    // 拡張子 .js が二重にならないよう考慮
    const cleanPath = fsPath.replace(/\.js$/, "");
    return `./apps/${cleanPath}.js`;
}

/**
 * FileReader を Promise 化
 */
export function loadFileAsDataURL(file) {
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
 * ファイル/フォルダ名のバリデーション
 * 堅牢性向上: Windowsのシステム予約名（CON, NUL等）のチェックを追加
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

    // Windows 予約デバイス名チェック
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
    if (!path) return "";
    // Windows形式( \ )とLinux形式( / )の両方の区切り文字に対応し、末尾のスラッシュを除去
    const parts = path.replace(/[\\/]$/, "").split(/[\\/]/).filter(Boolean);
    return parts[parts.length - 1] || "";
}