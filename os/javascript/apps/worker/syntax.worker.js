// syntax.worker.js

const JS_KEYWORDS = new Set([
    "const", "let", "var", "function", "return", "if", "else", "for", "while", "do",
    "import", "export", "from", "as", "default", "class", "extends", "constructor",
    "static", "get", "set", "async", "await", "new", "this", "super", "try", "catch",
    "finally", "throw", "break", "continue", "switch", "case", "of", "in", "yield",
    "delete", "typeof", "instanceof", "void", "null", "undefined", "true", "false",
    "interface", "type", "enum", "implements", "public", "private", "protected",
    "readonly", "abstract", "namespace", "declare", "keyof", "infer", "satisfies"
]);

const JS_BUILTINS = new Set([
    "console", "window", "document", "Math", "Object", "Array", "String", "Number",
    "Boolean", "Promise", "JSON", "Map", "Set", "WeakMap", "WeakSet", "Symbol",
    "Error", "Proxy", "Reflect", "setTimeout", "setInterval", "clearTimeout",
    "clearInterval", "requestAnimationFrame", "fetch", "URL", "Blob", "File",
    "Uint8Array", "ArrayBuffer", "nexser", "API", "syscall", "Record", "Partial", "Omit"
]);

const PYTHON_KEYWORDS = new Set([
    "def", "class", "return", "if", "elif", "else", "for", "while", "break", "continue",
    "pass", "import", "from", "as", "with", "try", "except", "finally", "raise", "yield",
    "lambda", "global", "nonlocal", "assert", "del", "in", "is", "not", "and", "or",
    "async", "await", "match", "case", "True", "False", "None"
]);

const PYTHON_BUILTINS = new Set([
    "print", "len", "range", "int", "str", "float", "bool", "list", "dict", "set", "tuple",
    "open", "enumerate", "zip", "map", "filter", "sorted", "sum", "min", "max", "abs",
    "type", "isinstance", "super", "self", "cls", "Exception", "ValueError", "KeyError"
]);

const CLANG_KEYWORDS = new Set([
    "auto", "break", "case", "char", "const", "continue", "default", "do", "double", "else",
    "enum", "extern", "float", "for", "goto", "if", "inline", "int", "long", "register",
    "return", "short", "signed", "sizeof", "static", "struct", "switch", "typedef", "union",
    "unsigned", "void", "volatile", "while", "class", "public", "private", "protected",
    "virtual", "override", "namespace", "using", "template", "typename", "new", "delete",
    "try", "catch", "throw", "bool", "true", "false", "nullptr", "null", "package", "import",
    "extends", "implements", "interface", "final", "abstract", "synchronized", "fn", "let",
    "mut", "pub", "impl", "trait", "mod", "use", "match", "func", "go", "defer", "chan",
    "select", "range", "var", "string", "byte", "rune", "async", "await", "echo", "foreach"
]);

const SQL_KEYWORDS = new Set([
    "SELECT", "FROM", "WHERE", "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE",
    "CREATE", "TABLE", "DATABASE", "INDEX", "VIEW", "DROP", "ALTER", "ADD", "COLUMN",
    "JOIN", "INNER", "LEFT", "RIGHT", "FULL", "OUTER", "ON", "AS", "GROUP", "BY", "ORDER",
    "ASC", "DESC", "HAVING", "LIMIT", "OFFSET", "UNION", "ALL", "DISTINCT", "AND", "OR",
    "NOT", "IN", "IS", "NULL", "LIKE", "BETWEEN", "EXISTS", "CASE", "WHEN", "THEN", "ELSE",
    "END", "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "DEFAULT", "CONSTRAINT", "BEGIN",
    "COMMIT", "ROLLBACK", "COUNT", "SUM", "AVG", "MIN", "MAX"
]);

const SHELL_KEYWORDS = new Set([
    "if", "then", "else", "elif", "fi", "for", "while", "until", "do", "done", "case",
    "esac", "in", "function", "return", "exit", "export", "local", "readonly", "set",
    "unset", "echo", "printf", "cd", "pwd", "ls", "cp", "mv", "rm", "mkdir", "cat",
    "grep", "sed", "awk", "curl", "wget", "npm", "node", "git", "python", "sudo",
    "rem", "call", "goto", "pause", "cls"
]);

const CSS_TAGS = new Set([
    "html", "body", "div", "span", "a", "h1", "h2", "h3", "h4", "h5", "h6", "p",
    "ul", "ol", "li", "section", "header", "footer", "nav", "main", "button",
    "input", "textarea", "select", "canvas", "video", "audio", "img", "pre", "code",
    "table", "thead", "tbody", "tr", "td", "th", "form", "label", "svg", "path"
]);

const HTML_VOID_TAGS = new Set([
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta",
    "param", "source", "track", "wbr"
]);

const FOLD_TOKEN_TEST = /^\.\.\.\[\+\d+:#\d+\]$/;

const TOKEN_REGEX = /(\.\.\.\[\+\d+:#\d+\]|\/\/[^\n]*|\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->|--[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|<\/|<!|\/>|[<>]|#[0-9a-fA-F]{3,8}\b|[0-9]+(?:\.[0-9]+)?(?:px|rem|em|%|vh|vw|s|ms|deg)?\b|[\w$-]+|[{}().,;+\-*/&|=!\[\]:@#?~]|[\s]+)/;

function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function getNextNonSpace(tokens, index) {
    for (let i = index + 1; i < tokens.length; i++) {
        const trimmed = tokens[i].trim();
        if (trimmed) return trimmed;
    }
    return "";
}

function getPrevNonSpace(tokens, index) {
    for (let i = index - 1; i >= 0; i--) {
        const trimmed = tokens[i].trim();
        if (trimmed) return trimmed;
    }
    return "";
}

function getTokenType(token, lang, index, tokens, tagState = null) {
    const t = token.trim();
    if (!t) return null;

    // 折りたたみバッジトークン (...[+12:#1])
    if (FOLD_TOKEN_TEST.test(t)) return "fold-badge";

    if (t.startsWith("/*") || t.startsWith("<!--")) return "comment";
    if (t.startsWith("//") && (lang === "js" || lang === "ts" || lang === "css" || lang === "c" || lang === "json")) {
        return "comment";
    }
    if (t.startsWith("--") && lang === "sql") return "comment";

    if (lang === "json") {
        if (/^"/.test(t)) {
            return getNextNonSpace(tokens, index) === ":" ? "property" : "string";
        }
        if (/^(true|false|null)$/.test(t)) return "keyword";
        if (/^-?[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/.test(t)) return "number";
        if (/^[{}()\[\]]$/.test(t)) return "bracket";
        return null;
    }

    if (lang === "html" || lang === "xml") {
        if (t === "<" || t === "</" || t === "<!" || t === ">" || t === "/>") {
            if (tagState) {
                if (t === "<!") {
                    tagState.inTag = true;
                    tagState.inDoctype = true;
                    tagState.expectTagName = true;
                } else if (t === "<" || t === "</") {
                    tagState.inTag = true;
                    tagState.inDoctype = false;
                    tagState.expectTagName = true;
                } else {
                    tagState.inTag = false;
                    tagState.inDoctype = false;
                    tagState.expectTagName = false;
                }
            }
            return "angle";
        }

        if (tagState && tagState.inTag) {
            if (tagState.expectTagName) {
                tagState.expectTagName = false;
                if (tagState.inDoctype) return "doctype";
                return "tag";
            }
            if (/^["']/.test(t)) return "string";
            if (t === "=") return "operator";
            if (tagState.inDoctype) return "attr";
            if (getNextNonSpace(tokens, index) === "=" && /^[a-zA-Z0-9:@._-]+$/.test(t)) return "attr";
            if (/^[a-zA-Z0-9:@._-]+$/.test(t)) return "attr";
            return null;
        }

        // タグ外のテキストでは数値や文字列を勝手に着色しない
        return null;
    }

    if (/^["'`]/.test(t)) return "string";
    if (/^[0-9]+(\.[0-9]+)?(px|rem|em|%|vh|vw|s|ms|deg)?$/.test(t)) return "number";
    if (/^[{}()\[\]]$/.test(t)) return "bracket";
    if (t === "." || t === "," || t === ";" || t === ":") return null;

    if (lang === "css") {
        if (t.startsWith("#") && /^#[0-9a-fA-F]{3,8}$/.test(t)) return "value";
        if (t.startsWith(".") || t.startsWith("#") || CSS_TAGS.has(t.toLowerCase())) {
            return getNextNonSpace(tokens, index) === ":" ? "property" : "selector";
        }
        if (getNextNonSpace(tokens, index) === ":" && /^[a-z-]+$/i.test(t)) return "property";
        if (t.startsWith("@")) return "meta";
        return null;
    }

    if (lang === "js" || lang === "ts") {
        if (JS_KEYWORDS.has(t)) return "keyword";
        if (JS_BUILTINS.has(t)) return "builtin";

        const next = getNextNonSpace(tokens, index);
        const prev = getPrevNonSpace(tokens, index);

        if (next === "(" && /^[a-zA-Z_$][\w$]*$/.test(t)) return "func";
        if (prev === "." && /^[a-zA-Z_$][\w$]*$/.test(t)) return "property_js";
        if (/^[a-zA-Z_$][\w$]*$/.test(t)) return "variable";
        if (/^[+\-*/&|=<>!%^?]+$/.test(t)) return "operator";
        return null;
    }

    if (lang === "python") {
        if (PYTHON_KEYWORDS.has(t)) return "keyword";
        if (PYTHON_BUILTINS.has(t)) return "builtin";
        if (t.startsWith("@")) return "meta";

        const next = getNextNonSpace(tokens, index);
        const prev = getPrevNonSpace(tokens, index);
        if (next === "(" && /^[a-zA-Z_][\w]*$/.test(t)) return "func";
        if (prev === "." && /^[a-zA-Z_][\w]*$/.test(t)) return "property_js";
        if (/^[a-zA-Z_][\w]*$/.test(t)) return "variable";
        if (/^[+\-*/&|=<>!%^@]+$/.test(t)) return "operator";
        return null;
    }

    if (lang === "c") {
        if (CLANG_KEYWORDS.has(t)) return "keyword";
        const next = getNextNonSpace(tokens, index);
        const prev = getPrevNonSpace(tokens, index);
        if (next === "(" && /^[a-zA-Z_][\w]*$/.test(t)) return "func";
        if (prev === "." && /^[a-zA-Z_][\w]*$/.test(t)) return "property_js";
        if (/^[a-zA-Z_][\w]*$/.test(t)) return "variable";
        if (/^[+\-*/&|=<>!%^~]+$/.test(t)) return "operator";
        return null;
    }

    if (lang === "sql") {
        if (SQL_KEYWORDS.has(t.toUpperCase())) return "keyword";
        if (/^[a-zA-Z_][\w]*$/.test(t)) return "variable";
        if (/^[+\-*/=<>!]+$/.test(t)) return "operator";
        return null;
    }

    if (lang === "shell") {
        if (SHELL_KEYWORDS.has(t.toLowerCase())) return "keyword";
        if (t.startsWith("$")) return "variable";
        if (/^[|&><;=]+$/.test(t)) return "operator";
        return null;
    }

    if (lang === "yaml" || lang === "ini") {
        if (getNextNonSpace(tokens, index) === ":" || getNextNonSpace(tokens, index) === "=") {
            return "property";
        }
        if (/^(true|false|null|yes|no|on|off)$/i.test(t)) return "keyword";
        return null;
    }

    return null;
}

function detectLanguage(filePath, text, forcedLang = null) {
    if (forcedLang && forcedLang !== "auto") return forcedLang;

    const fileName = filePath ? filePath.split("/").pop().toLowerCase() : "";
    const ext = fileName.includes(".") ? fileName.split(".").pop() : "";

    if (fileName === "dockerfile") return "shell";
    if (fileName === "makefile") return "shell";

    if (["js", "mjs", "cjs", "jsx"].includes(ext)) return "js";
    if (["ts", "tsx"].includes(ext)) return "ts";
    if (["html", "htm", "xhtml", "vue", "svelte"].includes(ext)) return "html";
    if (["xml", "svg", "plist", "xaml"].includes(ext)) return "xml";
    if (["css", "scss", "sass", "less"].includes(ext)) return "css";
    if (["json", "jsonc"].includes(ext)) return "json";
    if (["py", "pyw"].includes(ext)) return "python";
    if (["c", "h", "cpp", "hpp", "cc", "cxx", "cs", "java", "go", "rs", "php", "swift", "kt", "kts", "dart"].includes(ext)) return "c";
    if (["sql"].includes(ext)) return "sql";
    if (["sh", "bash", "zsh", "bat", "cmd", "ps1"].includes(ext)) return "shell";
    if (["md", "markdown"].includes(ext)) return "markdown";
    if (["yml", "yaml"].includes(ext)) return "yaml";
    if (["ini", "cfg", "conf", "toml", "env", "properties", "url"].includes(ext)) return "ini";

    const trimmed = (text || "").trim();
    if (/^<!doctype\s|^<html[\s>]/i.test(trimmed)) return "html";
    if (/^<\?xml[\s?]/i.test(trimmed)) return "xml";
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "json";
    if (/^#!\/.*\b(bash|sh|zsh)\b/.test(trimmed)) return "shell";
    if (/^#!\/.*\bpython/.test(trimmed)) return "python";
    return "plain";
}

function highlightLineSegment(segment, lang, parts, tagState = null) {
    if (!segment) return;

    // 行単位の特殊構文（Markdown・INIセクション・#コメント・Cプリプロセッサ）
    if (lang === "markdown") {
        const trimmed = segment.trimStart();
        if (/^#{1,6}\s/.test(trimmed)) {
            parts.push(`<span class="hl-heading">${escapeHtml(segment)}</span>`);
            return;
        }
        if (/^```/.test(trimmed)) {
            parts.push(`<span class="hl-meta">${escapeHtml(segment)}</span>`);
            return;
        }
        if (/^>\s?/.test(trimmed)) {
            parts.push(`<span class="hl-comment">${escapeHtml(segment)}</span>`);
            return;
        }
    }

    if (lang === "ini" && /^\s*\[[^\]]+\]\s*$/.test(segment)) {
        parts.push(`<span class="hl-heading">${escapeHtml(segment)}</span>`);
        return;
    }

    if (lang === "c" && /^\s*#\s*[a-zA-Z]+/.test(segment)) {
        parts.push(`<span class="hl-meta">${escapeHtml(segment)}</span>`);
        return;
    }

    // # / ; による行コメント（Python / Shell / YAML / INI）
    if (lang === "python" || lang === "shell" || lang === "yaml" || lang === "ini") {
        const commentChar = lang === "ini" ? ";" : "#";
        let inSingle = false;
        let inDouble = false;
        let commentIdx = -1;
        for (let k = 0; k < segment.length; k++) {
            const ch = segment[k];
            if (ch === "\\") { k++; continue; }
            if (ch === "'" && !inDouble) inSingle = !inSingle;
            else if (ch === '"' && !inSingle) inDouble = !inDouble;
            else if (!inSingle && !inDouble && (ch === commentChar || (lang === "ini" && ch === "#"))) {
                commentIdx = k;
                break;
            }
        }
        if (commentIdx !== -1) {
            if (commentIdx > 0) highlightLineSegment(segment.slice(0, commentIdx), lang, parts, tagState);
            parts.push(`<span class="hl-comment">${escapeHtml(segment.slice(commentIdx))}</span>`);
            return;
        }
    }

    const tokens = segment.split(TOKEN_REGEX).filter(Boolean);
    for (let j = 0; j < tokens.length; j++) {
        const token = tokens[j];
        const type = getTokenType(token, lang, j, tokens, tagState);
        const escaped = escapeHtml(token);
        parts.push(type ? `<span class="hl-${type}">${escaped}</span>` : escaped);
    }
}

function buildHighlightedHtml(text, baseLang) {
    const len = text.length;
    const parts = [];
    let lineStart = 0;

    // 複数行ステート管理
    let inBlockComment = false;
    let inHtmlComment = false;
    let inTemplateString = false;
    let inMarkdownFence = false;
    let embeddedLang = null; // HTML内の <script> / <style> 切り替え用
    const tagState = { inTag: false, inDoctype: false, expectTagName: false };

    for (let i = 0; i <= len; i++) {
        if (i === len || text.charCodeAt(i) === 10) {
            const line = text.substring(lineStart, i);
            let activeLang = embeddedLang || baseLang;

            // Markdown コードフェンス処理
            if (baseLang === "markdown") {
                if (/^\s*```/.test(line)) {
                    inMarkdownFence = !inMarkdownFence;
                    parts.push(`<span class="hl-meta">${escapeHtml(line)}</span>`);
                    if (i < len) parts.push("\n");
                    lineStart = i + 1;
                    continue;
                }
                if (inMarkdownFence) {
                    parts.push(`<span class="hl-string">${escapeHtml(line)}</span>`);
                    if (i < len) parts.push("\n");
                    lineStart = i + 1;
                    continue;
                }
            }

            // HTML の埋め込みタグ開始・終了判定
            if (baseLang === "html") {
                if (embeddedLang === "js" && /<\/script\s*>/i.test(line)) {
                    embeddedLang = null;
                    activeLang = "html";
                } else if (embeddedLang === "css" && /<\/style\s*>/i.test(line)) {
                    embeddedLang = null;
                    activeLang = "html";
                }
            }

            let pos = 0;
            while (pos < line.length) {
                if (inBlockComment) {
                    const endIdx = line.indexOf("*/", pos);
                    if (endIdx === -1) {
                        parts.push(`<span class="hl-comment">${escapeHtml(line.slice(pos))}</span>`);
                        pos = line.length;
                    } else {
                        parts.push(`<span class="hl-comment">${escapeHtml(line.slice(pos, endIdx + 2))}</span>`);
                        pos = endIdx + 2;
                        inBlockComment = false;
                    }
                    continue;
                }

                if (inHtmlComment) {
                    const endIdx = line.indexOf("-->", pos);
                    if (endIdx === -1) {
                        parts.push(`<span class="hl-comment">${escapeHtml(line.slice(pos))}</span>`);
                        pos = line.length;
                    } else {
                        parts.push(`<span class="hl-comment">${escapeHtml(line.slice(pos, endIdx + 3))}</span>`);
                        pos = endIdx + 3;
                        inHtmlComment = false;
                    }
                    continue;
                }

                if (inTemplateString) {
                    let endIdx = -1;
                    for (let k = pos; k < line.length; k++) {
                        if (line[k] === "\\") { k++; continue; }
                        if (line[k] === "`") { endIdx = k; break; }
                    }
                    if (endIdx === -1) {
                        parts.push(`<span class="hl-string">${escapeHtml(line.slice(pos))}</span>`);
                        pos = line.length;
                    } else {
                        parts.push(`<span class="hl-string">${escapeHtml(line.slice(pos, endIdx + 1))}</span>`);
                        pos = endIdx + 1;
                        inTemplateString = false;
                    }
                    continue;
                }

                // 通常モード: 複数行へ突入する開始記号を検出
                const rest = line.slice(pos);

                if (activeLang === "html" || activeLang === "xml") {
                    const htmlCmtStart = rest.indexOf("<!--");
                    if (htmlCmtStart !== -1 && rest.indexOf("-->", htmlCmtStart + 4) === -1) {
                        highlightLineSegment(rest.slice(0, htmlCmtStart), activeLang, parts, tagState);
                        parts.push(`<span class="hl-comment">${escapeHtml(rest.slice(htmlCmtStart))}</span>`);
                        inHtmlComment = true;
                        pos = line.length;
                        continue;
                    }
                } else if (activeLang === "js" || activeLang === "ts" || activeLang === "css" || activeLang === "c") {
                    const lineCmtIdx = activeLang === "css" ? -1 : rest.indexOf("//");
                    const blockCmtIdx = rest.indexOf("/*");
                    const tplIdx = (activeLang === "js" || activeLang === "ts") ? rest.indexOf("`") : -1;

                    // 未閉じブロックコメントの判定
                    if (
                        blockCmtIdx !== -1 &&
                        (lineCmtIdx === -1 || blockCmtIdx < lineCmtIdx) &&
                        (tplIdx === -1 || blockCmtIdx < tplIdx) &&
                        rest.indexOf("*/", blockCmtIdx + 2) === -1
                    ) {
                        highlightLineSegment(rest.slice(0, blockCmtIdx), activeLang, parts);
                        parts.push(`<span class="hl-comment">${escapeHtml(rest.slice(blockCmtIdx))}</span>`);
                        inBlockComment = true;
                        pos = line.length;
                        continue;
                    }

                    // 未閉じテンプレート文字列の判定
                    if (
                        tplIdx !== -1 &&
                        (lineCmtIdx === -1 || tplIdx < lineCmtIdx) &&
                        (blockCmtIdx === -1 || tplIdx < blockCmtIdx)
                    ) {
                        let closed = false;
                        for (let k = tplIdx + 1; k < rest.length; k++) {
                            if (rest[k] === "\\") { k++; continue; }
                            if (rest[k] === "`") { closed = true; break; }
                        }
                        if (!closed) {
                            highlightLineSegment(rest.slice(0, tplIdx), activeLang, parts);
                            parts.push(`<span class="hl-string">${escapeHtml(rest.slice(tplIdx))}</span>`);
                            inTemplateString = true;
                            pos = line.length;
                            continue;
                        }
                    }
                }

                highlightLineSegment(rest, activeLang, parts, tagState);
                pos = line.length;
            }

            // 次行から埋め込み言語へ移行
            if (baseLang === "html" && !inHtmlComment) {
                if (/<script\b[^>]*>/i.test(line) && !/<\/script\s*>/i.test(line) && !/\.\.\.\[\+\d+:#\d+\]/.test(line)) {
                    embeddedLang = "js";
                } else if (/<style\b[^>]*>/i.test(line) && !/<\/style\s*>/i.test(line) && !/\.\.\.\[\+\d+:#\d+\]/.test(line)) {
                    embeddedLang = "css";
                }
            }

            if (i < len) parts.push("\n");
            lineStart = i + 1;
        }
    }

    if (text.endsWith("\n")) parts.push(" ");
    return parts.join("");
}

/**
 * 折りたたみ可能範囲（0-based: { [startLine]: endLine }）を言語別に O(N) で解析
 */
function computeFoldRanges(text, lang) {
    const lines = text.split("\n");
    const ranges = {};
    const recordRange = (start, end) => {
        if (end > start && (!ranges[start] || end > ranges[start])) {
            ranges[start] = end;
        }
    };

    // 1. Markdown 見出しベース
    if (lang === "markdown") {
        const headingStack = [];
        for (let i = 0; i < lines.length; i++) {
            const m = lines[i].match(/^(#{1,6})\s/);
            if (m) {
                const level = m[1].length;
                while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= level) {
                    const prev = headingStack.pop();
                    recordRange(prev.line, i - 1);
                }
                headingStack.push({ level, line: i });
            }
        }
        while (headingStack.length > 0) {
            const prev = headingStack.pop();
            recordRange(prev.line, lines.length - 1);
        }
        return ranges;
    }

    // 2. インデントベース（Python / YAML / INI / Plain）— スタックによる O(N) 解析
    if (lang === "python" || lang === "yaml" || lang === "ini" || lang === "plain") {
        const getIndent = (line) => {
            let count = 0;
            for (let i = 0; i < line.length; i++) {
                if (line[i] === " ") count += 1;
                else if (line[i] === "\t") count += 4;
                else break;
            }
            return count;
        };

        const stack = [];
        let lastNonEmptyLine = -1;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!line.trim()) continue;

            const indent = getIndent(line);
            while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
                const prev = stack.pop();
                if (lastNonEmptyLine > prev.line) {
                    recordRange(prev.line, lastNonEmptyLine);
                }
            }

            if (!/\.\.\.\[\+\d+:#\d+\]/.test(line)) {
                stack.push({ line: i, indent });
            }
            lastNonEmptyLine = i;
        }

        while (stack.length > 0) {
            const prev = stack.pop();
            if (lastNonEmptyLine > prev.line) {
                recordRange(prev.line, lastNonEmptyLine);
            }
        }
        return ranges;
    }

    // 3. HTML / XML タグベース（埋め込み JS/CSS の { } も同時に解析）
    if (lang === "html" || lang === "xml") {
        const tagStack = [];
        const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9:-]*)(?:\s[^>]*)?\/?>/g;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (/\.\.\.\[\+\d+:#\d+\]/.test(line)) continue;
            tagRegex.lastIndex = 0;
            let match;
            while ((match = tagRegex.exec(line))) {
                const full = match[0];
                const tagName = match[1].toLowerCase();
                if (full.endsWith("/>") || (lang === "html" && HTML_VOID_TAGS.has(tagName))) continue;
                if (full.startsWith("</")) {
                    for (let s = tagStack.length - 1; s >= 0; s--) {
                        if (tagStack[s].name === tagName) {
                            const opened = tagStack[s];
                            tagStack.length = s;
                            recordRange(opened.line, i);
                            break;
                        }
                    }
                } else {
                    tagStack.push({ name: tagName, line: i });
                }
            }
        }
    }

    // 4. ブレース {} / 角括弧 [] ベース（JS / TS / CSS / JSON / C系 / HTML内script・style）
    const braceStack = [];
    let inBlockCmt = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/\.\.\.\[\+\d+:#\d+\]/.test(line)) continue;
        let inSingle = false;
        let inDouble = false;
        let inTpl = false;

        for (let c = 0; c < line.length; c++) {
            const ch = line[c];
            const next = line[c + 1];

            if (inBlockCmt) {
                if (ch === "*" && next === "/") { inBlockCmt = false; c++; }
                continue;
            }
            if (!inSingle && !inDouble && !inTpl) {
                if (ch === "/" && next === "/") break;
                if (ch === "/" && next === "*") { inBlockCmt = true; c++; continue; }
            }
            if (ch === "\\") { c++; continue; }
            if (ch === "'" && !inDouble && !inTpl) { inSingle = !inSingle; continue; }
            if (ch === '"' && !inSingle && !inTpl) { inDouble = !inDouble; continue; }
            if (ch === "`" && !inSingle && !inDouble) { inTpl = !inTpl; continue; }
            if (inSingle || inDouble || inTpl) continue;

            if (ch === "{" || ch === "[") {
                braceStack.push({ ch, line: i });
            } else if (ch === "}" || ch === "]") {
                const openCh = ch === "}" ? "{" : "[";
                for (let s = braceStack.length - 1; s >= 0; s--) {
                    if (braceStack[s].ch === openCh) {
                        const opened = braceStack[s];
                        braceStack.length = s;
                        recordRange(opened.line, i);
                        break;
                    }
                }
            }
        }
    }

    return ranges;
}

function diagnoseSyntax(text, lang) {
    const trimmed = text.trim();
    if (!trimmed) return [];

    if (lang === "json") {
        try {
            JSON.parse(text);
            return [];
        } catch (e) {
            const msg = e.message || "JSON Syntax Error";
            const lineColMatch = msg.match(/line\s(\d+)\scolumn\s(\d+)/i);
            const posMatch = msg.match(/position\s(\d+)/i);

            if (lineColMatch) {
                return [{
                    line: parseInt(lineColMatch[1], 10),
                    column: parseInt(lineColMatch[2], 10),
                    length: 1,
                    message: msg
                }];
            }
            if (posMatch) {
                const pos = parseInt(posMatch[1], 10);
                const before = text.slice(0, pos);
                const split = before.split("\n");
                return [{
                    line: split.length,
                    column: split[split.length - 1].length + 1,
                    length: 1,
                    message: msg
                }];
            }
            return [{ line: 1, column: 1, length: 1, message: msg }];
        }
    }

    if (lang === "js") {
        try {
            const cleanText = text
                .replace(/^\s*import\b[^;\n]*;?/gm, "")
                .replace(/^\s*export\s+default\b/gm, "const __default_export__ =")
                .replace(/^\s*export\s+(async\s+function|function|class|const|let|var)\b/gm, "$1")
                .replace(/^\s*export\s*\{[^}]*\};?/gm, "");

            new Function(cleanText);
            return [];
        } catch (e) {
            let line = 1;
            let column = 1;
            if (e.stack) {
                const match = e.stack.match(/:(\d+):(\d+)/);
                if (match) {
                    line = Math.max(1, parseInt(match[1], 10) - 2);
                    column = Math.max(1, parseInt(match[2], 10));
                }
            }
            const lines = text.split("\n");
            const safeLine = Math.min(Math.max(1, line), lines.length);
            const targetLineText = lines[safeLine - 1] || "";
            return [{
                line: safeLine,
                column,
                length: Math.max(1, targetLineText.trim().length),
                message: e.message || "JavaScript Syntax Error"
            }];
        }
    }

    return [];
}

self.onmessage = (e) => {
    const {
        requestId,
        text = "",
        fullText = null,
        currentPath = "",
        forcedLang = null,
        runDiagnostics = true
    } = e.data || {};

    const diagSource = typeof fullText === "string" ? fullText : text;
    const lang = detectLanguage(currentPath, diagSource, forcedLang);
    const html = buildHighlightedHtml(text, lang);
    const foldRanges = computeFoldRanges(text, lang);
    const errors = runDiagnostics ? diagnoseSyntax(diagSource, lang) : [];

    self.postMessage({
        requestId,
        lang,
        html,
        foldRanges,
        errors
    });
};