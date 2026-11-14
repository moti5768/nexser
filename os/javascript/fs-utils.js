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
    return "C:/" + stack.join("/");
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





// ========================================================
// 以下、Desktop / Explorer 共通FS操作ユーティリティ
// ========================================================

const META_KEYS = new Set(["type", "system", "originalPath", "lastModified"]);

/**
 * フォルダ内のメタデータキー（子ノード以外）かどうかを判定
 */
export function isSystemMetaKey(key) {
    return META_KEYS.has(key);
}

/**
 * ProxyラップされたFSノードを、DataCloneErrorやBlob破壊を起こさずに安全にディープクローンする
 */
export function cloneFSNode(node, visited = new WeakMap()) {
    if (node === null || typeof node !== "object") return node;
    if (node instanceof Blob || node instanceof ArrayBuffer || ArrayBuffer.isView(node)) {
        return node;
    }
    if (visited.has(node)) return visited.get(node);

    const copy = Array.isArray(node) ? [] : {};
    visited.set(node, copy);

    for (const key of Object.keys(node)) {
        copy[key] = cloneFSNode(node[key], visited);
    }
    return copy;
}

/**
 * ショートカット（link）を循環参照ガード付きで最終的な実体パス・ノードまで解決する
 */
export function resolveLinkTarget(pathOrNode, initialPath = "", maxDepth = 10) {
    let currentPath = typeof pathOrNode === "string" ? pathOrNode : initialPath;
    let currentNode = typeof pathOrNode === "string" ? resolveFS(pathOrNode) : pathOrNode;
    const visited = new Set();

    for (let i = 0; i < maxDepth; i++) {
        if (!currentNode || currentNode.type !== "link" || typeof currentNode.target !== "string") {
            break;
        }
        if (visited.has(currentNode.target)) {
            return { node: null, path: currentNode.target }; // 循環リンク検知
        }
        visited.add(currentNode.target);
        currentPath = currentNode.target;
        currentNode = resolveFS(currentPath);
    }

    return { node: currentNode, path: currentPath };
}

/**
 * コピー時にノードおよび配下のシステム保護フラグ（system）を再帰的に解除する
 */
export function clearSystemProtection(node, visited = new WeakSet()) {
    if (!node || typeof node !== "object" || visited.has(node)) return;
    visited.add(node);

    if ("system" in node) {
        delete node.system;
    }

    for (const key of Object.keys(node)) {
        if (isSystemMetaKey(key)) continue;
        const child = node[key];
        if (child && typeof child === "object") {
            clearSystemProtection(child, visited);
        }
    }
}

/**
 * IndexedDB（STORE_FILES）上の実データを再帰的にコピーまたは移動する
 */
export async function processStorageRecursively(node, oldBasePath, newBasePath, isCopyMode, visited = new WeakSet(), depth = 0) {
    if (!node || typeof node !== "object" || depth > 50 || visited.has(node)) return;
    visited.add(node);

    const { copyFileContent, moveFileContent } = await import("./fs-db.js");

    try {
        for (const key of Object.keys(node)) {
            if (isSystemMetaKey(key)) continue;
            const child = node[key];
            if (!child || typeof child !== "object") continue;

            const oldSubPath = `${oldBasePath}/${key}`;
            const newSubPath = `${newBasePath}/${key}`;

            if (child.type === "file" || child.type === "app") {
                if (isCopyMode) {
                    await copyFileContent(oldSubPath, newSubPath);
                } else {
                    await moveFileContent(oldSubPath, newSubPath);
                }
            } else if (child.type === "folder") {
                await processStorageRecursively(child, oldSubPath, newSubPath, isCopyMode, visited, depth + 1);
            }
        }
    } finally {
        visited.delete(node);
    }
}

/**
 * ドロップされたURL文字列から .url ショートカットファイルを生成する
 */
export function createUrlShortcutNode(urlToSave, targetFolderNode) {
    if (!urlToSave || !targetFolderNode) return false;

    const lines = urlToSave.split(/\r?\n/);
    let validUrl = "";
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#") && /^https?:\/\//i.test(trimmed)) {
            validUrl = trimmed;
            break;
        }
    }
    if (!validUrl) return false;

    let urlName = "新しいショートカット.url";
    try {
        const urlObj = new URL(validUrl);
        urlName = urlObj.hostname.replace(/[\/\\?%*:|"<>]/g, "_") + ".url";
    } catch (_) { }

    const finalName = getUniqueName(targetFolderNode, urlName);
    targetFolderNode[finalName] = {
        type: "file",
        content: `[InternetShortcut]\nURL=${validUrl}`,
        size: validUrl.length + 21,
        lastModified: Date.now()
    };
    return true;
}

// ========================================================
// OS共通 クリップボード管理（Desktop / Explorer 横断）
// ========================================================
let osClipboard = null; // { mode: "copy" | "cut", sourcePath: string, names: string[] }

export function setFSClipboard(mode, sourcePath, names) {
    if (!Array.isArray(names) || names.length === 0) return;
    const cleanPath = (sourcePath || "C:/Desktop").replace(/\\/g, "/").replace(/\/+$/, "");
    osClipboard = {
        mode,
        sourcePath: cleanPath,
        names: [...names]
    };
    window.dispatchEvent(new Event("clipboard-updated"));
}

export function getFSClipboard() {
    return osClipboard;
}

export function clearFSClipboard() {
    if (!osClipboard) return;
    osClipboard = null;
    window.dispatchEvent(new Event("clipboard-updated"));
}

export function isPathCutInClipboard(parentPath, itemName) {
    if (!osClipboard || osClipboard.mode !== "cut") return false;
    const cleanPath = (parentPath || "").replace(/\\/g, "/").replace(/\/+$/, "");
    return osClipboard.sourcePath === cleanPath && osClipboard.names.includes(itemName);
}

// ========================================================
// 共通アイテムリネーム処理（仮想FS + IndexedDB実データ + ウィンドウ連動）
// ========================================================
export async function renameFSItem(parentPath, oldName, rawNewName) {
    const cleanParent = (parentPath || "C:/Desktop").replace(/\\/g, "/").replace(/\/+$/, "");
    const parentNode = resolveFS(cleanParent);
    if (!parentNode || !parentNode[oldName]) {
        return { ok: false, error: "対象アイテムが見つかりません。" };
    }

    const newName = (rawNewName || "").trim();
    if (!newName || newName === oldName) {
        return { ok: true, unchanged: true };
    }

    const validationError = validateName(newName);
    if (validationError) {
        return { ok: false, error: validationError };
    }

    const rawItem = parentNode[oldName];
    if (rawItem.system === true) {
        return { ok: false, error: `「${oldName}」はシステム保護されているため名前を変更できません。` };
    }

    const hasConflict = Object.keys(parentNode).some(
        k => !isSystemMetaKey(k) && k !== oldName && k.toLowerCase() === newName.toLowerCase()
    );
    if (hasConflict) {
        return { ok: false, error: `同じ名前の項目「${newName}」が既に存在します。` };
    }

    const oldFullPath = `${cleanParent}/${oldName}`;
    const newFullPath = `${cleanParent}/${newName}`;

    const { forceSave, markDefaultDeleted, unmarkDefaultDeleted, setBulkUpdating, isFileLocked } = await import("./fs.js");
    const { moveFileContent, deleteFileContentRecursive } = await import("./fs-db.js");

    if (isFileLocked(oldFullPath)) {
        return { ok: false, error: `「${oldName}」または配下のファイルが使用中のため名前を変更できません。` };
    }

    const clonedNode = cloneFSNode(rawItem);
    clonedNode.lastModified = Date.now();

    const updateLinksRecursively = (node, visited = new WeakSet()) => {
        if (!node || typeof node !== "object" || visited.has(node)) return;
        visited.add(node);
        for (const key of Object.keys(node)) {
            if (isSystemMetaKey(key)) continue;
            const child = node[key];
            if (!child || typeof child !== "object") continue;
            if (child.type === "link" && typeof child.target === "string") {
                if (child.target === oldFullPath) {
                    child.target = newFullPath;
                } else if (child.target.startsWith(oldFullPath + "/")) {
                    child.target = newFullPath + child.target.slice(oldFullPath.length);
                }
            } else if (child.type === "folder") {
                updateLinksRecursively(child, visited);
            }
        }
    };

    setBulkUpdating(true);
    try {
        if (clonedNode.type === "file" || clonedNode.type === "app") {
            await moveFileContent(oldFullPath, newFullPath);
        } else if (clonedNode.type === "folder") {
            await processStorageRecursively(rawItem, oldFullPath, newFullPath, false);
        }

        let deleted = false;
        try {
            deleted = delete parentNode[oldName];
        } catch (_) {
            deleted = false;
        }

        if (!deleted) {
            if (clonedNode.type === "file" || clonedNode.type === "app") {
                await moveFileContent(newFullPath, oldFullPath).catch(() => deleteFileContentRecursive(newFullPath));
            } else if (clonedNode.type === "folder") {
                await processStorageRecursively(rawItem, newFullPath, oldFullPath, false).catch(() => deleteFileContentRecursive(newFullPath));
            }
            return { ok: false, error: `「${oldName}」は使用中または保護されているため名前を変更できません。` };
        }

        parentNode[newName] = clonedNode;
        updateLinksRecursively(FS["C:"]);
        await markDefaultDeleted(oldFullPath);
        await unmarkDefaultDeleted(newFullPath);
        await forceSave();
    } catch (err) {
        return { ok: false, error: `名前の変更中にエラーが発生しました: ${err.message}` };
    } finally {
        setBulkUpdating(false);
    }

    window.dispatchEvent(new CustomEvent("fs-renamed", {
        detail: { oldPath: oldFullPath, newPath: newFullPath, oldName, newName }
    }));
    window.dispatchEvent(new Event("fs-updated"));
    return { ok: true, newName };
}