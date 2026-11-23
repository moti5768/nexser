// format-utils.js
// HTMLエスケープ・座標変換・数値/日付書式変換・セル基本描画ユーティリティ

import {
    EXCEL_ERROR_RE,
    parseExcelDate,
    parseJapaneseDateInput,
    formatDateByPattern
} from "./formula-functions.js";

// =========================================================
// 最新版 Microsoft Excel（日本語ロケール・100%表示）基準メトリクス定数
// =========================================================
export const DEFAULT_COL_WIDTH = 84;          // 標準列幅 (日本語11pt基準・約8.38文字相当)
export const DEFAULT_ROW_HEIGHT = 25;         // 標準行高さ (18.75pt = 25px)
export const DEFAULT_HEADER_HEIGHT = 22;      // 列見出し高さ
export const DEFAULT_ROW_HEADER_WIDTH = 42;   // 行番号見出し幅
export const DEFAULT_FONT_FAMILY = "'Yu Gothic', '游ゴシック', 'Meiryo', 'MS PGothic', sans-serif";
export const DEFAULT_FONT_SIZE_PT = 11;       // 標準フォントサイズ (11pt)
export const DEFAULT_FONT_SIZE_CSS = "11pt";
export const DEFAULT_FONT_SIZE_PX = (DEFAULT_FONT_SIZE_PT * 96) / 72; // 14.6667px

export function cssFontSizeToPx(sizeStr, fallbackPx = DEFAULT_FONT_SIZE_PX) {
    if (typeof sizeStr === "number" && Number.isFinite(sizeStr)) return sizeStr;
    const s = String(sizeStr ?? "").trim().toLowerCase();
    if (!s) return fallbackPx;
    const num = parseFloat(s);
    if (!Number.isFinite(num) || num <= 0) return fallbackPx;
    if (s.endsWith("pt")) return (num * 96) / 72;
    return num;
}

export function cssFontSizeToPt(sizeStr, fallbackPt = DEFAULT_FONT_SIZE_PT) {
    if (typeof sizeStr === "number" && Number.isFinite(sizeStr)) return sizeStr;
    const s = String(sizeStr ?? "").trim().toLowerCase();
    if (!s) return fallbackPt;
    const num = parseFloat(s);
    if (!Number.isFinite(num) || num <= 0) return fallbackPt;
    if (s.endsWith("pt")) return Math.round(num * 2) / 2;
    if (s.endsWith("px")) return Math.round(((num * 72) / 96) * 2) / 2;
    return Math.round(num * 2) / 2;
}

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
const NAMED_DATE_FORMATS = {
    "date-ymd": { pattern: "yyyy/m/d", preferGannen: false },
    "date-ymd-pad": { pattern: "yyyy/mm/dd", preferGannen: false },
    "date-jp": { pattern: 'yyyy"年"m"月"d"日"', preferGannen: false },
    "date-jp-week": { pattern: 'yyyy"年"m"月"d"日"(aaa)', preferGannen: false },
    "date-md": { pattern: "m/d", preferGannen: false },
    "date-md-jp": { pattern: 'm"月"d"日"', preferGannen: false },
    "date-ym-jp": { pattern: 'yyyy"年"m"月"', preferGannen: false },
    "wareki-jp": { pattern: 'ggge"年"m"月"d"日"', preferGannen: true },
    "wareki-jp-week": { pattern: 'ggge"年"m"月"d"日"(aaa)', preferGannen: true },
    "wareki-ym": { pattern: 'ggge"年"m"月"', preferGannen: true },
    "wareki-short": { pattern: "ge/m/d", preferGannen: false },
    "wareki-dot": { pattern: "ge.m.d", preferGannen: false },
    "wareki-kanji-short": { pattern: "gge.m.d", preferGannen: false },
    "datetime": { pattern: "yyyy/m/d h:mm", preferGannen: false },
    "time-hm": { pattern: "h:mm", preferGannen: false },
    "time-hms": { pattern: "h:mm:ss", preferGannen: false },
    "time-jp": { pattern: 'h"時"mm"分"', preferGannen: false }
};

export function isTimeNumFormat(fmt) {
    return fmt === "time-hm" || fmt === "time-hms" || fmt === "time-jp";
}

export function isDateNumFormat(fmt) {
    if (!fmt) return false;
    if (Object.prototype.hasOwnProperty.call(NAMED_DATE_FORMATS, fmt)) return true;
    if (fmt.startsWith("custom:")) {
        const clean = fmt.slice(7).split(";")[0].replace(/"[^"]*"/g, "").replace(/\[[^\]]*\]/g, "").trim();
        return clean.toLowerCase() !== "general" && /[ymdaghe]/i.test(clean) && !/[#0]/.test(clean);
    }
    return false;
}

export function parseTimeInput(rawStr) {
    const str = String(rawStr ?? "")
        .trim()
        .replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
        .replace(/：/g, ":");
    const m = str.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
    if (!m) return null;
    const h = parseInt(m[1], 10);
    const mi = parseInt(m[2], 10);
    const s = m[3] !== undefined ? parseInt(m[3], 10) : 0;
    if (h > 23 || mi > 59 || s > 59) return null;
    const serial = (h * 3600 + mi * 60 + s) / 86400;
    return {
        serial,
        autoNumFormat: m[3] !== undefined ? "time-hms" : "time-hm"
    };
}

export function formatTimeFromSerial(serial, withSeconds = true) {
    const n = Number(serial);
    if (!Number.isFinite(n)) return "";
    const frac = ((n % 1) + 1) % 1;
    let totalSec = Math.round(frac * 86400);
    if (totalSec >= 86400) totalSec = 0;
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    return withSeconds ? `${h}:${mm}:${ss}` : `${h}:${mm}`;
}

export function isDateFormat(str) {
    return parseJapaneseDateInput(String(str ?? ""), { allowShortMD: true }) !== null;
}

export function formatDate(date) {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const h = date.getHours();
    const mi = date.getMinutes();
    const s = date.getSeconds();
    if (h !== 0 || mi !== 0 || s !== 0) {
        const hh = String(h);
        const mm = String(mi).padStart(2, "0");
        const ss = s !== 0 ? `:${String(s).padStart(2, "0")}` : "";
        return `${y}/${m}/${d} ${hh}:${mm}${ss}`;
    }
    return `${y}/${m}/${d}`;
}

export function resolveDateFromRawValue(rawVal) {
    const str = String(rawVal ?? "").trim();
    if (!str || str.startsWith("#")) return null;
    const num = parseFormattedNumber(str);
    if (!isNaN(num) && num >= -11500 && num <= 2958465) {
        return parseExcelDate(num);
    }
    return parseExcelDate(str);
}

const EXCEL_NUMFMT_COLOR_MAP = {
    赤: "#d13438", red: "#d13438",
    青: "#005a9e", blue: "#005a9e",
    緑: "#107c41", green: "#107c41",
    黄: "#b8860b", yellow: "#b8860b",
    黒: "#000000", black: "#000000",
    白: "#ffffff", white: "#ffffff",
    マゼンタ: "#a61c50", magenta: "#a61c50",
    シアン: "#008287", cyan: "#008287"
};

function splitCustomFormatSections(pattern) {
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
    return sections;
}

export function resolveCustomPatternColor(rawVal, fmt) {
    if (!fmt || !fmt.startsWith("custom:")) return "";
    const str = String(rawVal ?? "").trim();
    if (!str || str.startsWith("#")) return "";
    const num = parseFormattedNumber(str);
    if (isNaN(num)) return "";

    const sections = splitCustomFormatSections(fmt.slice(7));
    let activeSec = sections[0] || "";
    if (num < 0 && sections[1]) activeSec = sections[1];
    else if (num === 0 && sections[2]) activeSec = sections[2];

    const m = activeSec.match(/\[(赤|青|緑|黄|黒|白|マゼンタ|シアン|Red|Blue|Green|Yellow|Black|White|Magenta|Cyan)\]/i);
    if (!m) return "";
    return EXCEL_NUMFMT_COLOR_MAP[m[1].toLowerCase()] || "";
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
        const n = Number(str.replace(/,/g, ""));
        return Number.isFinite(n) ? n : NaN;
    }
    const n = Number(str);
    return Number.isFinite(n) ? n : NaN;
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
    if (!Number.isFinite(num)) return NaN;
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

    // 日付・和暦カスタム書式（例: yyyy"年"m"月"d"日"(aaa), ggge"年"m"月"d"日", [$-ja-JP]ggge"年"m"月"d"日", ge.m.d）
    const firstClean = sections[0].replace(/"[^"]*"/g, "").replace(/\[[^\]]*\]/g, "").trim();
    if (firstClean.toLowerCase() !== "general" && /[ymdaghe]/i.test(firstClean) && !/[#0]/.test(firstClean)) {
        const dateObj = resolveDateFromRawValue(str);
        if (dateObj) {
            return formatDateByPattern(dateObj, sections[0]);
        }
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

    // [赤] などの色タグ・ロケールタグは表示文字列から除去
    activeSec = activeSec
        .replace(/\[(赤|青|緑|黄|黒|白|マゼンタ|シアン|Red|Blue|Green|Yellow|Black|White|Magenta|Cyan)\]/gi, "")
        .replace(/\[\$-[^\]]*\]/g, "");

    const lits = [];
    const masked = activeSec.replace(/"([^"]*)"/g, (_, inner) => {
        const tok = `\uE000${lits.length}\uE001`;
        lits.push(inner);
        return tok;
    });

    const coreMatch = masked.match(/[#0,.]+(?:E[+-]0+|%)?/i);
    if (!coreMatch) {
        return masked.replace(/\uE000(\d+)\uE001/g, (_, idx) => lits[Number(idx)]);
    }

    const core = coreMatch[0];
    if (/E[+-]0+$/i.test(core)) {
        const decPart = (core.split(".")[1] || "").replace(/E[+-]0+$/i, "");
        const digits = (decPart.match(/[0#]/g) || []).length;
        const val = useAbs ? Math.abs(num) : num;
        const sci = val.toExponential(digits).toUpperCase().replace(/E([+-])(\d)$/, "E$10$2");
        const replaced = masked.slice(0, coreMatch.index) + sci + masked.slice(coreMatch.index + core.length);
        return replaced.replace(/\uE000(\d+)\uE001/g, (_, idx) => lits[Number(idx)]);
    }

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

    if (str.trim() === "" || str.startsWith("#")) return str;

    if ((!fmt || fmt === "general") && !hasDecimals) {
        if (cell?.dataset?.valueType === "date") {
            const dt = resolveDateFromRawValue(str);
            if (dt) return formatDate(dt);
        }
        return str;
    }

    if (fmt && fmt.startsWith("custom:")) {
        return formatByCustomPattern(str, fmt.slice(7));
    }

    if (fmt && Object.prototype.hasOwnProperty.call(NAMED_DATE_FORMATS, fmt)) {
        const dt = resolveDateFromRawValue(str);
        if (dt) {
            const spec = NAMED_DATE_FORMATS[fmt];
            return formatDateByPattern(dt, spec.pattern, { preferGannen: spec.preferGannen });
        }
        return str;
    }
    const num = parseFormattedNumber(str);
    if (isNaN(num)) return str;

    if (fmt === "number") {
        const digits = dec ?? 0;
        return num.toFixed(digits);
    }
    if (fmt === "comma") {
        return num.toLocaleString("ja-JP", {
            minimumFractionDigits: dec ?? 0,
            maximumFractionDigits: dec ?? 4
        });
    }
    if (fmt === "currency") {
        const digits = dec ?? 0;
        const absStr = Math.abs(num).toLocaleString("ja-JP", {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits
        });
        return num < 0 ? `-¥${absStr}` : `¥${absStr}`;
    }
    if (fmt === "accounting") {
        const digits = dec ?? 0;
        if (num === 0) return "¥ -";
        const absStr = Math.abs(num).toLocaleString("ja-JP", {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits
        });
        return num < 0 ? `¥ -${absStr}` : `¥ ${absStr}`;
    }
    if (fmt === "percent") {
        const pct = num * 100;
        return dec !== null ? `${pct.toFixed(dec)}%` : `${pct.toFixed(1).replace(/\.0$/, "")}%`;
    }
    if (fmt === "scientific") {
        const digits = dec ?? 2;
        return num.toExponential(digits).toUpperCase().replace(/E([+-])(\d)$/, "E$10$2");
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

    // 文字列プレフィックス(')または表示形式「文字列」は数値・日付に見えても常に左揃え（Excel準拠）
    if (cell.dataset.quotePrefix === "1" || cell.dataset.numFormat === "text") {
        return;
    }

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
        // 差分スキップ：子コントロールがなく既に同一テキストならDOM再生成を回避
        if (!filterBtn && !fillHandleEl && !annoMarkEl) {
            if (strText === "" && cell.firstChild === null) return;
            if (
                cell.childNodes.length === 1 &&
                cell.firstChild.nodeType === Node.TEXT_NODE &&
                cell.firstChild.nodeValue === strText
            ) {
                return;
            }
        }
        cell.textContent = strText;
    }
    if (filterBtn) cell.appendChild(filterBtn);
    if (fillHandleEl) cell.appendChild(fillHandleEl);
    if (annoMarkEl) cell.appendChild(annoMarkEl);
}