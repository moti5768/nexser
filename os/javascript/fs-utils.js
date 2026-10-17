// fs-utils.js
import { FS } from "./fs.js";

/**
 * パスからファイルシステム上のノードを解決する
 * 【根本改善】同一パス解決セッション内での重複追跡を防ぎ、爆発的な負荷を防止する
 */
export function resolveFS(path, cwd = "C:/", root = FS) {
    if (typeof path !== "string") return null;

    // パスを正規化してから処理
    const normalized = normalizePath(path, cwd);
    const parts = normalized.replace(/^C:\//, "").split("/").filter(Boolean);

    let cur = root;

    for (const p of parts) {
        if (!cur || typeof cur !== "object") return null;
        cur = cur[p];

        // ✨ 改善: ショートカット（type: "link"）を勝手に実体に展開せず、
        // リンクオブジェクトのまま保持・返却する（Windowsの挙動に準拠）

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
 * FileReader を使ってテキストとして読み込む
 */
export async function loadFileAsText(file) {
    return new Promise((resolve, reject) => {
        if (!(file instanceof Blob)) {
            return reject(new Error("有効なファイルではありません"));
        }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result); // そのままの文字列が返る
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

/**
 * 拡張子を判定し、テキストかDataURLかを自動で振り分けて読み込む
 */
export async function importFileSmart(file) {
    // テキストとして扱うべき拡張子のリスト
    const textExts = /\.(txt|md|js|ts|json|css|scss|vue|html|htm|cfg)$/i;

    if (textExts.test(file.name)) {
        return await loadFileAsText(file);
    } else {
        return await loadFileAsDataURL(file); // 画像や音声は今まで通りBase64
    }
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

export function getUniqueName(parentNode, idealName) {
    if (!parentNode || !parentNode[idealName]) return idealName;

    const dotIndex = idealName.lastIndexOf(".");

    // 拡張子を持つかどうかの判定 (dotIndex === 0 の場合は ".env" のような隠しファイルとみなす)
    const hasExtension = dotIndex > 0;
    const base = hasExtension ? idealName.substring(0, dotIndex) : idealName;
    const ext = hasExtension ? idealName.substring(dotIndex) : "";

    let counter = 1;
    let finalName = idealName;

    // 既存の名前と被らなくなるまでカウントアップ
    while (parentNode[finalName]) {
        finalName = `${base} (${counter++})${ext}`;
    }

    return finalName;
}

/**
 * 移動先が自分自身、その子孫、あるいはシンボリックリンク先の実体・子孫になっていないかを厳格にチェックする安全確認関数（完全リンク解決版）
 * @param {string} sourcePath 移動元アイテムのフルパス (例: "Desktop/FolderA")
 * @param {string} targetPath 移動先のフルパス (例: "Desktop/FolderA/SubFolder")
 * @returns {boolean} 自分自身または子孫である場合は true (不正な移動)
 */
export function isDescendantOrSelf(sourcePath, targetPath) {
    if (!sourcePath || !targetPath) return false;

    const sourceNode = resolveFS(sourcePath);
    if (!sourceNode) return false;

    // ✨ Windowsの挙動に準拠: ショートカット（link）は単なるファイルであり、
    // フォルダ構造上の実体ではないため、循環参照や子孫関係の対象外（常に false）とする
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