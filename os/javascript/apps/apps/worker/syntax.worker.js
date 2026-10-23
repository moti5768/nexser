// syntax.worker.js

// --- 共通のトークナイザー ---
function tokenize(line) {
    return line.split(/(\/\/.+|\/\*[\s\S]*?\*\/|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|`[\s\S]*?`|<\/?[a-zA-Z0-9!.-]+|[\w$-]+|[{}().,;+\-*/&|=<>!\[\]:]|[\s]+)/).filter(Boolean);
}

// --- トークンタイプ判定 ---
function getTokenType(token, filePath, index = 0, tokens = []) {
    const t = token.trim();
    if (!t) return null;
    const ext = filePath ? filePath.split('.').pop().toLowerCase() : '';

    const next = tokens[index + 1]?.trim();
    const prev = tokens[index - 1]?.trim();

    if (t.startsWith("//") || t.startsWith("/*")) return "comment";
    if (/^["'`]/.test(t)) return "string";
    if (/^[0-9]+(\.[0-9]+)?(px|rem|em|%|vh|vw|s|ms|deg)?$/.test(t)) return "number";
    if (/^[{}()\[\]]$/.test(t)) return "bracket";
    if (t === "." || t === "," || t === ";" || t === ":") return null;

    if (ext === 'html' || ext === 'htm') {
        if (t.startsWith('<')) return "tag";
        if (t === '>') return "angle";
        if (t.startsWith('!')) return "doctype";
        if (next === '=' && /^[a-zA-Z-]+$/.test(t)) return "attr";
    }

    if (ext === 'css') {
        if (t.startsWith('.') || t.startsWith('#') || /^(html|body|div|span|a|h[1-6]|p|ul|li|section|header|footer|nav|main)$/.test(t)) {
            return "selector";
        }
        if (next === ':' && /^[a-z-]+$/.test(t)) return "property";
    }

    if (ext === 'js') {
        const keywords = /^(const|let|var|function|return|if|else|for|while|import|export|from|as|default|class|extends|constructor|static|get|set|async|await|new|this|super|try|catch|finally|throw|break|continue|switch|case|of|in|yield|delete|typeof|instanceof|void|null|undefined|true|false)$/;
        if (keywords.test(t)) return "keyword";

        const builtins = /^(console|window|document|Math|Object|Array|String|Number|Boolean|Promise|JSON|Map|Set|Symbol|Error|Proxy|Reflect|setTimeout|setInterval|fetch)$/;
        if (builtins.test(t)) return "builtin";

        if (next === '(' && /^[a-zA-Z_$][\w$]*$/.test(t)) return "func";
        if (prev === '.' && /^[a-zA-Z_$][\w$]*$/.test(t)) return "property_js";

        if (/^[a-zA-Z_$][\w$]*$/.test(t)) return "variable";
        if (/^[+\-*/&|=<>!%^]+$/.test(t)) return "operator";
    }

    return null;
}

// --- メイン処理（軽量化・最適化版） ---
self.onmessage = (e) => {
    const { text, currentPath } = e.data;
    const len = text.length;
    let html = "";
    let lineStart = 0;

    // split('\n'）を使わず、インデックスを直接走査してメモリ消費を激減させる
    for (let i = 0; i <= len; i++) {
        if (i === len || text.charCodeAt(i) === 10) { // 10 = 改行文字('\n')
            const line = text.substring(lineStart, i);
            const tokens = tokenize(line);

            for (let j = 0; j < tokens.length; j++) {
                const token = tokens[j];
                if (!token) continue;

                const type = getTokenType(token, currentPath, j, tokens);
                const escaped = token.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

                html += type ? `<span class="hl-${type}">${escaped}</span>` : escaped;
            }
            if (i < len) html += "\n";
            lineStart = i + 1;
        }
    }

    self.postMessage({ html: html + (text.endsWith('\n') ? ' ' : '') });
};