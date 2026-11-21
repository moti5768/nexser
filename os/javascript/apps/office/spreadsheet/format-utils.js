// format-utils.js
// HTMLエスケープ・座標変換・数値/日付書式変換・セル基本描画ユーティリティ

import { EXCEL_ERROR_RE, parseExcelDate } from "./formula-functions.js";

export function escapeHtml(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// =========================================================
// 列名・座標変換ヘルパー
// =========================================================
const colNameCache = [];
export function getColumnName(index) {
    if (colNameCache[index] !== undefined) return colNameCache[index];
    let n = index;
    let name = "";
    while (n >= 0) {
        name = String.fromCharCode((n % 26) + 65) + name;
        n = Math.floor(n / 26) - 1;
    }
    return (colNameCache[index] = name);
}

const colIndexCache = new Map();
export function columnLettersToIndex(letters) {
    const upper = letters.toUpperCase();
    if (colIndexCache.has(upper)) return colIndexCache.get(upper);
    let index = 0;
    for (let i = 0; i < upper.length; i++) {
        index = index * 26 + (upper.charCodeAt(i) - 64);
    }
    const res = index - 1;
    colIndexCache.set(upper, res);
    return res;
}

export function getCellReference(cell) {
    if (!cell || !cell.dataset) return "";
    return getColumnName(parseInt(cell.dataset.col, 10)) + cell.dataset.row;
}

export function getCellReferenceByCoord(row, col) {
    return getColumnName(col) + row;
}

// =========================================================
// 日付・数値書式変換 ＆ 数式前処理ヘルパー
// =========================================================
export function isDateFormat(str) {
    return /^\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?$/.test(str) || /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(str);
}

export function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}/${m}/${d}`;
}

export function preprocessAllNestedIFs(expr) {
    const lits = [];
    const masked = expr.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, (m) => {
        const tok = `__IFSTR_${lits.length}__`;
        lits.push(m);
        return tok;
    });

    const transform = (src) => {
        let result = "";
        let i = 0;
        while (i < src.length) {
            const rest = src.slice(i);
            const match = rest.match(/^(IF|IFS|AND|OR|XOR|NOT)\s*\(/i);
            if (match && (i === 0 || !/[A-Za-z0-9_]/.test(src[i - 1]))) {
                const fnName = match[1].toUpperCase();
                let pos = i + match[0].length;
                let depth = 0;
                const args = [];
                let currentArg = "";
                for (; pos < src.length; pos++) {
                    const ch = src[pos];
                    if (ch === "(") depth++;
                    else if (ch === ")") {
                        if (depth === 0) break;
                        depth--;
                    } else if (ch === "," && depth === 0) {
                        args.push(currentArg);
                        currentArg = "";
                        continue;
                    }
                    currentArg += ch;
                }
                args.push(currentArg);

                const convertedArgs = args.map((arg, idx) => {
                    const sub = transform(arg);
                    const isCondArg =
                        (fnName === "IF" && idx === 0) ||
                        (fnName === "IFS" && idx % 2 === 0) ||
                        fnName === "AND" || fnName === "OR" || fnName === "XOR" || fnName === "NOT";
                    return isCondArg ? sub.replace(/(?<![<>=!])=(?![=])/g, "==") : sub;
                });
                result += `${match[1]}(${convertedArgs.join(",")})`;
                i = pos < src.length ? pos + 1 : pos;
            } else {
                result += src[i];
                i++;
            }
        }
        return result;
    };

    return transform(masked).replace(/__IFSTR_(\d+)__/g, (_, idx) => lits[Number(idx)]);
}

const COMMA_GROUPED_NUM_RE = /^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/;

export function parseCellNumericLiteral(rawStr) {
    const str = String(rawStr ?? "").trim();
    if (str === "") return NaN;
    if (str.includes(",")) {
        if (!COMMA_GROUPED_NUM_RE.test(str)) return NaN;
        return Number(str.replace(/,/g, ""));
    }
    return Number(str);
}

export function parseFormattedNumber(rawStr) {
    let cleaned = String(rawStr ?? "").trim();
    if (cleaned === "") return NaN;

    let isPct = false;
    if (cleaned.endsWith("%")) {
        isPct = true;
        cleaned = cleaned.slice(0, -1).trim();
    }

    cleaned = cleaned.replace(/^([+-]?)\s*[¥￥]\s*/, "$1").replace(/\s*円$/, "").trim();
    if (cleaned === "") return NaN;

    if (cleaned.includes(",")) {
        if (!COMMA_GROUPED_NUM_RE.test(cleaned)) return NaN;
        cleaned = cleaned.replace(/,/g, "");
    }

    const num = Number(cleaned);
    if (isNaN(num)) return NaN;
    return isPct ? num / 100 : num;
}

export function formatByCustomPattern(rawVal, pattern) {
    const str = String(rawVal ?? "");
    if (!pattern) return str;

    // セミコロン区切り（正;負;ゼロ）を引用符外で分割
    const sections = [];
    let buf = "";
    let inQ = false;
    for (let i = 0; i < pattern.length; i++) {
        const ch = pattern[i];
        if (ch === '"') inQ = !inQ;
        if (ch === ";" && !inQ) {
            sections.push(buf);
            buf = "";
        } else {
            buf += ch;
        }
    }
    sections.push(buf);

    const num = parseFormattedNumber(str);
    const dateObj = parseExcelDate(str);

    // 日付カスタム書式（例: yyyy"年"m"月"d"日"(aaa)）
    const firstClean = sections[0].replace(/"[^"]*"/g, "");
    if (dateObj && /[ymda]/i.test(firstClean) && !/[#0]/.test(firstClean)) {
        const lits = [];
        const masked = sections[0].replace(/"([^"]*)"/g, (_, inner) => {
            const tok = `\uE000${lits.length}\uE001`;
            lits.push(inner);
            return tok;
        });
        const daysJp = ["日", "月", "火", "水", "木", "金", "土"];
        const formatted = masked
            .replace(/yyyy/gi, String(dateObj.getFullYear()))
            .replace(/yy/gi, String(dateObj.getFullYear()).slice(-2))
            .replace(/mm/gi, String(dateObj.getMonth() + 1).padStart(2, "0"))
            .replace(/m/gi, String(dateObj.getMonth() + 1))
            .replace(/dd/gi, String(dateObj.getDate()).padStart(2, "0"))
            .replace(/d/gi, String(dateObj.getDate()))
            .replace(/aaaa/g, `${daysJp[dateObj.getDay()]}曜日`)
            .replace(/aaa/g, daysJp[dateObj.getDay()]);
        return formatted.replace(/\uE000(\d+)\uE001/g, (_, idx) => lits[Number(idx)]);
    }

    if (isNaN(num)) return str;

    let activeSec = sections[0];
    let useAbs = false;
    if (num < 0 && sections[1]) {
        activeSec = sections[1];
        useAbs = true;
    } else if (num === 0 && sections[2]) {
        activeSec = sections[2];
        useAbs = true;
    }

    // [赤] などの色タグは表示文字列から除去
    activeSec = activeSec.replace(/^\[(赤|青|緑|黄|黒|白|Red|Blue|Green|Yellow|Black|White)\]/i, "");

    const lits = [];
    const masked = activeSec.replace(/"([^"]*)"/g, (_, inner) => {
        const tok = `\uE000${lits.length}\uE001`;
        lits.push(inner);
        return tok;
    });

    const coreMatch = masked.match(/[#0,.]+%?/);
    if (!coreMatch) {
        return masked.replace(/\uE000(\d+)\uE001/g, (_, idx) => lits[Number(idx)]);
    }

    const core = coreMatch[0];
    const isPct = core.endsWith("%");
    const val = (useAbs ? Math.abs(num) : num) * (isPct ? 100 : 1);
    const [intPart = "", decPart = ""] = core.replace(/%$/, "").split(".");
    const useComma = intPart.includes(",");
    const minInt = Math.max(1, (intPart.match(/0/g) || []).length);
    const minDec = (decPart.match(/0/g) || []).length;
    const maxDec = (decPart.match(/[0#]/g) || []).length;

    let formattedNum;
    if (useComma) {
        formattedNum = val.toLocaleString("ja-JP", {
            minimumIntegerDigits: minInt,
            minimumFractionDigits: minDec,
            maximumFractionDigits: maxDec
        });
    } else {
        const sign = val < 0 ? "-" : "";
        const fixed = Math.abs(val).toFixed(maxDec);
        const [fi, fd = ""] = fixed.split(".");
        const paddedInt = fi.padStart(minInt, "0");
        const trimmedDec = fd.length > minDec ? fd.replace(/0+$/, "") : fd;
        const finalDec = trimmedDec.length < minDec ? trimmedDec.padEnd(minDec, "0") : trimmedDec;
        formattedNum = sign + paddedInt + (finalDec ? `.${finalDec}` : "");
    }
    if (isPct) formattedNum += "%";

    const replaced = masked.slice(0, coreMatch.index) + formattedNum + masked.slice(coreMatch.index + core.length);
    return replaced.replace(/\uE000(\d+)\uE001/g, (_, idx) => lits[Number(idx)]);
}

export function formatDisplayByNumFmt(rawVal, fmt, cell = null) {
    const str = String(rawVal ?? "");
    const hasDecimals = cell?.dataset?.decimalPlaces !== undefined && cell?.dataset?.decimalPlaces !== "";
    const dec = hasDecimals ? Math.max(0, Math.min(10, Number(cell.dataset.decimalPlaces))) : null;

    if ((!fmt || fmt === "general") && !hasDecimals) return str;
    if (str.trim() === "" || str.startsWith("#")) return str;

    if (fmt && fmt.startsWith("custom:")) {
        return formatByCustomPattern(str, fmt.slice(7));
    }

    if (fmt === "date-jp" || fmt === "date-md") {
        const m = str.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
        if (m) {
            return fmt === "date-jp"
                ? `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日`
                : `${Number(m[2])}/${Number(m[3])}`;
        }
        return str;
    }
    const num = parseFormattedNumber(str);
    if (isNaN(num)) return str;

    if (fmt === "comma") {
        return num.toLocaleString("ja-JP", {
            minimumFractionDigits: dec ?? 0,
            maximumFractionDigits: dec ?? 4
        });
    }
    if (fmt === "currency") {
        const digits = dec ?? 0;
        return "¥" + num.toLocaleString("ja-JP", {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits
        });
    }
    if (fmt === "percent") {
        const pct = num * 100;
        return dec !== null ? `${pct.toFixed(dec)}%` : `${pct.toFixed(1).replace(/\.0$/, "")}%`;
    }
    if (dec !== null) {
        return num.toFixed(dec);
    }
    return str;
}

export function updateCellAutoAlignment(cell, rawStr) {
    cell.classList.remove("ss-auto-align-right", "ss-auto-align-center");
    const trimmed = String(rawStr ?? "").trim();
    if (trimmed === "") return;

    const upper = trimmed.toUpperCase();
    if (
        upper === "TRUE" ||
        upper === "FALSE" ||
        EXCEL_ERROR_RE.test(upper)
    ) {
        cell.classList.add("ss-auto-align-center");
        return;
    }

    const isNumeric = !isNaN(parseFormattedNumber(trimmed));
    const isDate = cell.dataset.valueType === "date" || isDateFormat(trimmed);
    if (isNumeric || isDate) {
        cell.classList.add("ss-auto-align-right");
    }
}

export function setCellTextPreservingControls(cell, text) {
    const filterBtn = cell.querySelector(".ss-filter-arrow");
    const fillHandleEl = cell.querySelector(":scope > .fill-handle");
    const annoMarkEl = cell.querySelector(":scope > .ss-anno-mark");
    const strText = String(text ?? "");
    const isJustify = cell.style.textAlign === "justify" && strText !== "";

    const applyRunStyleToEl = (el, st) => {
        if (!st) return;
        if (st.color) el.style.color = st.color;
        if (st.bold) el.style.fontWeight = "bold";
        if (st.italic) el.style.fontStyle = "italic";
        const decos = [];
        if (st.underline) decos.push("underline");
        if (st.strike) decos.push("line-through");
        if (decos.length) el.style.textDecoration = decos.join(" ");
    };

    if (cell.dataset.richRuns && !cell.dataset.formula) {
        try {
            const runs = JSON.parse(cell.dataset.richRuns);
            if (Array.isArray(runs) && runs.map(r => r.text).join("") === strText) {
                cell.textContent = "";
                const frag = document.createDocumentFragment();
                if (isJustify) {
                    const styledLines = [[]];
                    for (const run of runs) {
                        const st = run.style || {};
                        for (const ch of Array.from(run.text)) {
                            if (ch === "\n") {
                                styledLines.push([]);
                            } else {
                                styledLines[styledLines.length - 1].push({ ch, st });
                            }
                        }
                    }
                    for (const chars of styledLines) {
                        const lineEl = document.createElement("span");
                        lineEl.className = "ss-justify-line" + (chars.length <= 1 ? " ss-justify-single" : "");
                        if (chars.length === 0) {
                            lineEl.textContent = "\u00A0";
                        } else {
                            for (const item of chars) {
                                const chEl = document.createElement("span");
                                chEl.className = "ss-justify-char";
                                chEl.textContent = item.ch;
                                applyRunStyleToEl(chEl, item.st);
                                lineEl.appendChild(chEl);
                            }
                        }
                        frag.appendChild(lineEl);
                    }
                } else {
                    for (const run of runs) {
                        const st = run.style || {};
                        const hasStyle = st.color || st.bold || st.italic || st.underline || st.strike;
                        if (!hasStyle) {
                            frag.appendChild(document.createTextNode(run.text));
                        } else {
                            const span = document.createElement("span");
                            span.textContent = run.text;
                            applyRunStyleToEl(span, st);
                            frag.appendChild(span);
                        }
                    }
                }
                cell.appendChild(frag);
                if (filterBtn) cell.appendChild(filterBtn);
                if (fillHandleEl) cell.appendChild(fillHandleEl);
                if (annoMarkEl) cell.appendChild(annoMarkEl);
                return;
            }
        } catch { /* ignore */ }
        delete cell.dataset.richRuns;
    }

    if (isJustify) {
        cell.textContent = "";
        const frag = document.createDocumentFragment();
        const lines = strText.split("\n");
        for (const line of lines) {
            const chars = Array.from(line);
            const lineEl = document.createElement("span");
            lineEl.className = "ss-justify-line" + (chars.length <= 1 ? " ss-justify-single" : "");
            if (chars.length === 0) {
                lineEl.textContent = "\u00A0";
            } else {
                for (const ch of chars) {
                    const chEl = document.createElement("span");
                    chEl.className = "ss-justify-char";
                    chEl.textContent = ch;
                    lineEl.appendChild(chEl);
                }
            }
            frag.appendChild(lineEl);
        }
        cell.appendChild(frag);
        if (filterBtn) cell.appendChild(filterBtn);
        if (fillHandleEl) cell.appendChild(fillHandleEl);
        if (annoMarkEl) cell.appendChild(annoMarkEl);
        return;
    }

    const rotDeg = Number(cell.dataset.textRotation || "0");
    if (rotDeg && strText !== "" && cell.style.writingMode !== "vertical-rl") {
        cell.textContent = "";
        const rotSpan = document.createElement("span");
        rotSpan.className = "ss-rotated-text";
        rotSpan.style.transform = `rotate(${-rotDeg}deg)`;
        rotSpan.textContent = strText;
        cell.appendChild(rotSpan);
    } else {
        cell.textContent = strText;
    }
    if (filterBtn) cell.appendChild(filterBtn);
    if (fillHandleEl) cell.appendChild(fillHandleEl);
    if (annoMarkEl) cell.appendChild(annoMarkEl);
}