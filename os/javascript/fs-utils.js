// fs-utils.js
import { FS } from "./fs.js";

/**
 * パスからファイルシステム上のノードを解決する
 * 【修正】visited を第4引数として引き継ぐことで、シンボリックリンクの循環参照による無限再帰（フリーズ）を完全に防止
 */
export function resolveFS(path, cwd = "C:/", root = FS, visited = new Set()) {
    if (typeof path !== "string") return null;

    // パスを正規化してから処理
    const normalized = normalizePath(path, cwd);
    const parts = normalized.replace(/^C:\//, "").split("/").filter(Boolean);

    let cur = root; // インポートした FS ではなく、引数の root を起点にする

    for (const p of parts) {
        if (!cur || typeof cur !== "object") return null;
        cur = cur[p];

        // リンク解決のループ
        let linkSteps = 0;
        while (cur && cur.type === "link") {
            // target が文字列でない場合、または既に解決済みのリンクオブジェクト（循環参照）、または単一コンテキストで深すぎる場合はリンク切れ(null)とする
            if (typeof cur.target !== "string" || visited.has(cur) || linkSteps > 50) {
                return null;
            }

            // 現在のリンクオブジェクトを訪問済みリストに登録
            visited.add(cur);

            // 【修正の要】共有された巡回履歴（visited）を第4引数に渡して再帰し、システム全体でループを検知できるようにする
            cur = resolveFS(cur.target, "C:/", root, visited);
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

    // ドライブレターがスタックにない場合のガード（通常は [0] が "C:"）
    const result = stack.join("/");
    // stack[0] が "C:" であることを前提に、常にドライブ直下にスラッシュを入れる
    if (stack[0] && stack[0].endsWith(":")) {
        return stack[0] + "/" + stack.slice(1).join("/");
    }
    return "C:/" + result;
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
    if (typeof path !== "string" || !path) return "";

    // 1. 末尾のスラッシュ（複数可）をすべて除去
    const cleanPath = path.replace(/[\\/]+$/, "");

    // 2. 最後の区切り文字の位置を探す
    const lastSlashIndex = Math.max(cleanPath.lastIndexOf("/"), cleanPath.lastIndexOf("\\"));

    // 3. 区切り文字が見つからない場合
    if (lastSlashIndex === -1) {
        // "C:" のようなドライブレターのみの場合は空文字を返す（OSの慣習に合わせる場合）
        return cleanPath.endsWith(":") ? "" : cleanPath;
    }

    // 4. 最後がドライブレター（例: "C:/Windows" の "/" が最後の場合など）への配慮
    const result = cleanPath.substring(lastSlashIndex + 1);
    return result.endsWith(":") ? "" : result;
}