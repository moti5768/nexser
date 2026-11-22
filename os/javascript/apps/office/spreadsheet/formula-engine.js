// formula-engine.js
// 数式評価エンジン・配列演算・LET/LAMBDA/INDIRECT/OFFSET・スピル展開・依存トポロジカルソート・一括再計算

import {
    getColumnName,
    columnLettersToIndex,
    isDateFormat,
    formatDate,
    preprocessAllNestedIFs,
    parseCellNumericLiteral
} from "./format-utils.js";
import {
    serialToDate,
    tryParseDateToSerial,
    EXCEL_BLANK_CELL,
    unwrapBlank,
    isBlankVal,
    excelUnaryOp,
    excelBinaryOp,
    FORMULA_FN_NAMES,
    FORMULA_FN_VALUES
} from "./formula-functions.js";
import { parseCellReference } from "./formula-ref-overlay.js";

const RANGE_REF_REGEX = /(?<![A-Za-z0-9_])(\$?[A-Za-z]+\$?\d+:\$?[A-Za-z]+\$?\d+)/g;
const SINGLE_REF_REGEX = /(?<![A-Za-z0-9_])(\$?)([A-Za-z]+)(\$?)(\d+)(?!\s*\()/g;
const CROSS_SHEET_RANGE_REGEX = /(?:'([^']+)'|([A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+))!(\$?[A-Za-z]+\$?\d+):(\$?[A-Za-z]+\$?\d+)/g;
const CROSS_SHEET_CELL_REGEX = /(?:'([^']+)'|([A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+))!(\$?[A-Za-z]+\$?\d+)/g;

export function toJSValueLiteral(val, blankAsZero = false, stringLiterals = null) {
    const pushStr = (quotedStr) => {
        if (!stringLiterals) return quotedStr;
        const token = `__STR_LIT_${stringLiterals.length}__`;
        stringLiterals.push(quotedStr);
        return token;
    };
    if (isBlankVal(val)) return blankAsZero ? "EXCEL_BLANK_CELL" : pushStr('""');
    if (typeof val === "boolean") return val ? "true" : "false";
    if (typeof val === "number") return isFinite(val) ? String(val) : "0";
    return pushStr(JSON.stringify(String(val)));
}

export function createFormulaEngineModule(ctx) {
    const {
        tbody,
        getSheets,
        getActiveSheetIndex,
        getRowCount,
        getCurrentColumns,
        getDefinedNames,
        peekCell,
        getCell,
        getRow,
        isCellEditing,
        resolveStructuredReferences,
        setCellFormattedValue,
        applyConditionalFormats,
        updateTextOverflowDisplay,
        updateAllFloatingCharts
    } = ctx;

    const backgroundSheetIndexCache = new WeakMap();
    const compiledFormulaCache = new Map();
    const formulaEvalCache = new Map();
    let isBatchRecalculating = false;

    function clearFormulaEvalCache() {
        formulaEvalCache.clear();
    }

    function invalidateBackgroundSheetCache(sheetObj) {
        if (sheetObj) backgroundSheetIndexCache.delete(sheetObj);
    }

    function getBackgroundSheetCellMap(sheetObj) {
        let map = backgroundSheetIndexCache.get(sheetObj);
        if (!map) {
            map = new Map();
            if (Array.isArray(sheetObj?.cells)) {
                for (let i = 0; i < sheetObj.cells.length; i++) {
                    const item = sheetObj.cells[i];
                    map.set(`${Number(item.r)},${Number(item.c)}`, item);
                }
            }
            backgroundSheetIndexCache.set(sheetObj, map);
        }
        return map;
    }

    function getSheetCellValue(sheetIdx, row, col, visited = new Set()) {
        const cellKey = `${sheetIdx}:${row},${col}`;
        if (isBatchRecalculating && formulaEvalCache.has(cellKey)) {
            return formulaEvalCache.get(cellKey);
        }

        const sheets = getSheets();
        const activeSheetIndex = getActiveSheetIndex();

        if (sheetIdx === activeSheetIndex || !sheets[sheetIdx]) {
            const cell = peekCell(row, col);
            if (!cell) return "";
            if (cell.dataset.formula) {
                if (visited.has(cellKey)) return "#CIRCULAR!";
                visited.add(cellKey);
                try {
                    const evaluated = evaluateFormula(cell.dataset.formula, visited, sheetIdx, { row, col });
                    if (evaluated === "#CIRCULAR!") return "#CIRCULAR!";
                    if (Array.isArray(evaluated) || typeof evaluated === "boolean") {
                        if (isBatchRecalculating) formulaEvalCache.set(cellKey, evaluated);
                        return evaluated;
                    }
                    const dateSerial = tryParseDateToSerial(evaluated);
                    const finalVal = dateSerial !== null
                        ? dateSerial
                        : ((evaluated !== "" && !isNaN(Number(evaluated))) ? Number(evaluated) : evaluated);
                    if (isBatchRecalculating) formulaEvalCache.set(cellKey, finalVal);
                    return finalVal;
                } finally {
                    visited.delete(cellKey);
                }
            }
            const contentStr = (cell.dataset.rawValue ?? cell.textContent).trim();
            if (contentStr === "") return "";
            if (cell.dataset.quotePrefix === "1") return cell.dataset.rawValue ?? cell.textContent;
            const upperStr = contentStr.toUpperCase();
            if (upperStr === "TRUE") return true;
            if (upperStr === "FALSE") return false;
            const dateSerial = tryParseDateToSerial(contentStr);
            if (dateSerial !== null) return dateSerial;
            const num = parseCellNumericLiteral(contentStr);
            return isNaN(num) ? contentStr : num;
        }

        const targetSheet = sheets[sheetIdx];
        const entry = getBackgroundSheetCellMap(targetSheet).get(`${row},${col}`);
        if (!entry) return "";
        if (entry.f) {
            if (visited.has(cellKey)) return "#CIRCULAR!";
            visited.add(cellKey);
            try {
                const evaluated = evaluateFormula(entry.f, visited, sheetIdx, { row, col });
                if (evaluated === "#CIRCULAR!") return "#CIRCULAR!";
                if (Array.isArray(evaluated) || typeof evaluated === "boolean") {
                    if (isBatchRecalculating) formulaEvalCache.set(cellKey, evaluated);
                    return evaluated;
                }
                const dateSerial = tryParseDateToSerial(evaluated);
                const finalVal = dateSerial !== null
                    ? dateSerial
                    : ((evaluated !== "" && !isNaN(Number(evaluated))) ? Number(evaluated) : evaluated);
                if (isBatchRecalculating) formulaEvalCache.set(cellKey, finalVal);
                return finalVal;
            } finally {
                visited.delete(cellKey);
            }
        }
        const raw = String(entry.v ?? "").trim();
        if (raw === "") return "";
        if (entry.qp) return String(entry.v ?? "");
        const upperRaw = raw.toUpperCase();
        if (upperRaw === "TRUE") return true;
        if (upperRaw === "FALSE") return false;
        const dateSerial = tryParseDateToSerial(raw);
        if (dateSerial !== null) return dateSerial;
        const num = parseCellNumericLiteral(raw);
        return isNaN(num) ? raw : num;
    }

    function getCellEvaluatedValue(cell, visited = new Set()) {
        if (!cell) return "";
        return getSheetCellValue(getActiveSheetIndex(), parseInt(cell.dataset.row, 10), parseInt(cell.dataset.col, 10), visited);
    }

    // hiddenModeCode: 0 = すべて含む, 1 = フィルター非表示のみ除外, 2 = すべての非表示行を除外
    function readRange2DValues(sheetIdx, startRow, startCol, endRow, endCol, visited, hiddenModeCode = 0) {
        const sheets = getSheets();
        const activeSheetIndex = getActiveSheetIndex();
        if (sheetIdx < 0 || !sheets[sheetIdx]) return [["#REF!"]];

        let maxR = getRowCount() - 1;
        let maxC = getCurrentColumns() - 1;
        if (sheetIdx !== activeSheetIndex && Array.isArray(sheets[sheetIdx]?.cells)) {
            for (const item of sheets[sheetIdx].cells) {
                const ir = Number(item.r) || 0;
                const ic = Number(item.c) || 0;
                if (ir > maxR) maxR = ir;
                if (ic > maxC) maxC = ic;
            }
        }

        const rStart = Math.max(1, Math.min(startRow, endRow));
        const rEnd = Math.min(Math.max(startRow, endRow), maxR);
        const cStart = Math.max(0, Math.min(startCol, endCol));
        const cEnd = Math.min(Math.max(startCol, endCol), maxC);
        const matrix = [];

        for (let r = rStart; r <= rEnd; r++) {
            if (hiddenModeCode !== 0 && sheetIdx === activeSheetIndex) {
                const tr = getRow(r);
                if (tr) {
                    if (hiddenModeCode === 2 && tr.style.display === "none") continue;
                    if (hiddenModeCode === 1 && tr.dataset.filterHidden === "1") continue;
                }
            }
            const rowVals = [];
            for (let c = cStart; c <= cEnd; c++) {
                const val = getSheetCellValue(sheetIdx, r, c, visited);
                rowVals.push(isBlankVal(val) ? "" : val);
            }
            matrix.push(rowVals);
        }
        return matrix;
    }

    const ALLOWED_IDENTIFIERS = new Set([
        "EXCEL_BLANK_CELL", "__XL_EQ", "__XL_OP", "__XL_U", "__XL_REF",
        "__XL_CELL", "__XL_XCELL", "__XL_RNG", "__XL_XRNG",
        "__XL_COLRNG", "__XL_ROWRNG", "__XL_ROW", "__XL_COL",
        "INDIRECT", "OFFSET", "true", "false", "undefined", ...FORMULA_FN_NAMES
    ]);
    const BUILTIN_FN_SET = new Set(["INDIRECT", "OFFSET", ...FORMULA_FN_NAMES]);

    function compileFormulaTemplate(resolvedExpr, rawFormula) {
        const cached = compiledFormulaCache.get(resolvedExpr);
        if (cached) return cached;

        try {
            let expr = resolvedExpr;
            const stringLiterals = [];
            const pushLiteral = (quotedStr) => {
                const token = `__STR_LIT_${stringLiterals.length}__`;
                stringLiterals.push(quotedStr);
                return token;
            };

            expr = expr.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'(?!\s*!)/g, (m) => pushLiteral(m));
            expr = preprocessAllNestedIFs(expr);

            // Excelの演算子優先順位（比較 < & < 四則）と等価比較への変換
            const convertExcelConcat = (src) => {
                let resolved = "";
                for (let i = 0; i < src.length; i++) {
                    if (src[i] === "(") {
                        let depth = 1;
                        let j = i + 1;
                        while (j < src.length && depth > 0) {
                            if (src[j] === "(") depth++;
                            else if (src[j] === ")") depth--;
                            j++;
                        }
                        const inner = src.slice(i + 1, j - 1);
                        const args = [];
                        let argBuf = "";
                        let d = 0;
                        for (let k = 0; k < inner.length; k++) {
                            const c = inner[k];
                            if (c === "(") d++;
                            else if (c === ")") d = Math.max(0, d - 1);
                            if (c === "," && d === 0) {
                                args.push(convertExcelConcat(argBuf));
                                argBuf = "";
                            } else {
                                argBuf += c;
                            }
                        }
                        args.push(convertExcelConcat(argBuf));
                        resolved += `(${args.join(",")})`;
                        i = j - 1;
                    } else {
                        resolved += src[i];
                    }
                }

                const cmpSegments = [];
                let seg = "";
                let depth = 0;
                for (let i = 0; i < resolved.length; i++) {
                    const ch = resolved[i];
                    if (ch === "(") depth++;
                    else if (ch === ")") depth = Math.max(0, depth - 1);
                    if (depth === 0) {
                        const two = resolved.slice(i, i + 2);
                        if (two === ">=" || two === "<=" || two === "<>" || two === "==" || two === "!=") {
                            cmpSegments.push({ text: seg, op: two });
                            seg = "";
                            i++;
                            continue;
                        }
                        if (ch === "=" || ch === "<" || ch === ">") {
                            cmpSegments.push({ text: seg, op: ch });
                            seg = "";
                            continue;
                        }
                    }
                    seg += ch;
                }
                cmpSegments.push({ text: seg, op: "" });

                const convertAmp = (exprPart) => {
                    const parts = [];
                    let buf = "";
                    let d = 0;
                    for (let i = 0; i < exprPart.length; i++) {
                        const c = exprPart[i];
                        if (c === "(") d++;
                        else if (c === ")") d = Math.max(0, d - 1);
                        if (c === "&" && exprPart[i + 1] !== "&" && exprPart[i - 1] !== "&" && d === 0) {
                            parts.push(buf.trim());
                            buf = "";
                        } else {
                            buf += c;
                        }
                    }
                    parts.push(buf.trim());
                    return parts.length > 1 ? `CONCAT(${parts.join(", ")})` : exprPart;
                };

                if (cmpSegments.length === 2) {
                    const op = cmpSegments[0].op;
                    const lhs = convertAmp(cmpSegments[0].text).trim();
                    const rhs = convertAmp(cmpSegments[1].text).trim();
                    if (lhs !== "" && rhs !== "") {
                        if (op === "=" || op === "==") return `__XL_OP("==", ${lhs}, ${rhs})`;
                        if (op === "<>" || op === "!=") return `__XL_OP("!=", ${lhs}, ${rhs})`;
                    }
                }
                return cmpSegments.map(s => convertAmp(s.text) + s.op).join("");
            };

            // Excel仕様: 単項マイナスはべき乗(^)より高優先 (-2^2 === 4)
            const normalizeExcelPower = (src) => {
                return src
                    .replace(/(^|[(\[,+\-*/=<>!&])\s*(-\s*(?:\d+(?:\.\d+)?|\$?[A-Za-z]+\$?\d+|\([^()]+\)))\s*\^/g, "$1($2)**")
                    .replace(/\^/g, "**");
            };

            expr = convertExcelConcat(expr);
            expr = normalizeExcelPower(expr)
                .replace(/<>/g, "!=")
                .replace(/(?<![<>!=])=(?!=)/g, "==")
                .replace(/\bTRUE\b/gi, "true")
                .replace(/\bFALSE\b/gi, "false")
                .replace(/\b([A-Za-z_][A-Za-z0-9_.]*)\s*(?=\()/g, (_, fn) => fn.toUpperCase().replace(/\./g, "_"));

            // SUBTOTAL(1-11:1 / 101-111:2)・AGGREGATE(1/3/5/7:2) 判定ヘルパー
            const getSubtotalHiddenCode = (src, offset) => {
                let depth = 0;
                for (let i = offset - 1; i >= 0; i--) {
                    const ch = src[i];
                    if (ch === ")") depth++;
                    else if (ch === "(") {
                        if (depth === 0) {
                            const before = src.slice(Math.max(0, i - 16), i);
                            const fnMatch = before.match(/\b(SUBTOTAL|AGGREGATE)\s*$/i);
                            if (!fnMatch) return 0;
                            const fnName = fnMatch[1].toUpperCase();
                            const afterOpen = src.slice(i + 1, offset);
                            if (fnName === "SUBTOTAL") {
                                const m = afterOpen.match(/^\s*(\d+)\s*,/);
                                const code = m ? Number(m[1]) : 9;
                                return code >= 101 ? 2 : 1;
                            }
                            const aggMatch = afterOpen.match(/^\s*\d+\s*,\s*(\d+)\s*,/);
                            const opt = aggMatch ? Number(aggMatch[1]) : 5;
                            return [1, 3, 5, 7].includes(opt) ? 2 : 1;
                        }
                        depth--;
                    }
                }
                return 0;
            };

            // ROW() / COLUMN() をランタイム呼び出し or 固定値へ変換
            expr = expr
                .replace(/\bROW\s*\(\s*\)/g, "__XL_ROW()")
                .replace(/\bCOLUMN\s*\(\s*\)/g, "__XL_COL()")
                .replace(/\bROW\s*\(\s*(?:(?:'[^']+'|[A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+)!)?\$?[A-Za-z]+\$?(\d+)(?::\$?[A-Za-z]+\$?\d+)?\s*\)/g, (_, r) => String(parseInt(r, 10)))
                .replace(/\bCOLUMN\s*\(\s*(?:(?:'[^']+'|[A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+)!)?\$?([A-Za-z]+)\$?\d+(?::\$?[A-Za-z]+\$?\d+)?\s*\)/g, (_, colL) => String(columnLettersToIndex(colL) + 1));

            // OFFSET の第1引数をランタイム座標オブジェクト __XL_REF(...) へ変換（シート名も動的解決）
            const rewriteOffsetFirstArg = (src) => {
                let out = "";
                let i = 0;
                while (i < src.length) {
                    const rest = src.slice(i);
                    const m = rest.match(/^OFFSET\s*\(/);
                    if (m && (i === 0 || !/[A-Za-z0-9_$]/.test(src[i - 1]))) {
                        const openEnd = i + m[0].length;
                        let pos = openEnd;
                        let depth = 1;
                        let firstComma = -1;
                        while (pos < src.length && depth > 0) {
                            const ch = src[pos];
                            if (ch === "(") depth++;
                            else if (ch === ")") depth--;
                            else if (ch === "," && depth === 1 && firstComma === -1) firstComma = pos;
                            pos++;
                        }
                        if (depth !== 0) {
                            out += src[i++];
                            continue;
                        }
                        const argEnd = firstComma !== -1 ? firstComma : pos - 1;
                        const firstArg = src.slice(openEnd, argEnd).trim();
                        const tail = src.slice(argEnd, pos);

                        const refMatch = firstArg.match(
                            /^(?:(?:'([^']+)'|([A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+))!)?\$?([A-Za-z]+)\$?(\d+)(?::\$?([A-Za-z]+)\$?(\d+))?$/
                        );
                        if (refMatch) {
                            const sName = refMatch[1] ?? refMatch[2];
                            const sTok = sName ? pushLiteral(JSON.stringify(sName)) : "undefined";
                            const c1 = columnLettersToIndex(refMatch[3]);
                            const r1 = parseInt(refMatch[4], 10);
                            const c2 = refMatch[5] ? columnLettersToIndex(refMatch[5]) : c1;
                            const r2 = refMatch[6] ? parseInt(refMatch[6], 10) : r1;
                            const minR = Math.min(r1, r2), maxR = Math.max(r1, r2);
                            const minC = Math.min(c1, c2), maxC = Math.max(c1, c2);
                            out += `OFFSET(__XL_REF(${sTok},${minR},${minC},${maxR},${maxC})${rewriteOffsetFirstArg(tail)}`;
                        } else {
                            out += `OFFSET(${rewriteOffsetFirstArg(firstArg)}${rewriteOffsetFirstArg(tail)}`;
                        }
                        i = pos;
                    } else {
                        out += src[i++];
                    }
                }
                return out;
            };
            if (/\bOFFSET\s*\(/.test(expr)) {
                expr = rewriteOffsetFirstArg(expr);
            }

            // 列全体参照 ($A:$C)・行全体参照 ($1:$5) をランタイム関数へ変換（シート拡張時もキャッシュ有効）
            expr = expr.replace(/(?<![A-Za-z0-9_:])(\$?[A-Za-z]+):(\$?[A-Za-z]+)(?![A-Za-z0-9_(])/g, (m, c1, c2, offset, fullStr) => {
                const i1 = columnLettersToIndex(c1.replace(/^\$/, ""));
                const i2 = columnLettersToIndex(c2.replace(/^\$/, ""));
                const hCode = getSubtotalHiddenCode(fullStr, offset);
                return `__XL_COLRNG(${i1},${i2},${hCode})`;
            });
            expr = expr.replace(/(?<![A-Za-z0-9_:])(\$?\d+):(\$?\d+)(?![A-Za-z0-9_])/g, (m, r1, r2, offset, fullStr) => {
                const n1 = parseInt(r1.replace(/^\$/, ""), 10);
                const n2 = parseInt(r2.replace(/^\$/, ""), 10);
                const hCode = getSubtotalHiddenCode(fullStr, offset);
                return `__XL_ROWRNG(${n1},${n2},${hCode})`;
            });

            // 他シート範囲参照 → __XL_XRNG("Sheet2", r1, c1, r2, c2, 0)
            expr = expr.replace(CROSS_SHEET_RANGE_REGEX, (_, qName, plainName, sRef, eRef) => {
                const sName = qName ?? plainName;
                const sm = sRef.match(/^\$?([A-Za-z]+)\$?(\d+)$/);
                const em = eRef.match(/^\$?([A-Za-z]+)\$?(\d+)$/);
                if (!sm || !em) return "[]";
                const sTok = pushLiteral(JSON.stringify(sName));
                return `__XL_XRNG(${sTok},${parseInt(sm[2], 10)},${columnLettersToIndex(sm[1])},${parseInt(em[2], 10)},${columnLettersToIndex(em[1])},0)`;
            });

            // 他シート単一セル参照 → __XL_XCELL("Sheet2", r, c)
            expr = expr.replace(CROSS_SHEET_CELL_REGEX, (_, qName, plainName, cellRef) => {
                const sName = qName ?? plainName;
                const m = cellRef.match(/^\$?([A-Za-z]+)\$?(\d+)$/);
                if (!m) return pushLiteral('"#REF!"');
                const sTok = pushLiteral(JSON.stringify(sName));
                return `__XL_XCELL(${sTok},${parseInt(m[2], 10)},${columnLettersToIndex(m[1])})`;
            });

            // 自シート範囲参照 → __XL_RNG(r1, c1, r2, c2, hiddenCode)
            expr = expr.replace(RANGE_REF_REGEX, (match, _g1, offset, fullStr) => {
                const [sRef, eRef] = match.split(":");
                const sm = sRef.match(/^\$?([A-Za-z]+)\$?(\d+)$/);
                const em = eRef.match(/^\$?([A-Za-z]+)\$?(\d+)$/);
                if (!sm || !em) return "[]";
                const hCode = getSubtotalHiddenCode(fullStr, offset);
                return `__XL_RNG(${parseInt(sm[2], 10)},${columnLettersToIndex(sm[1])},${parseInt(em[2], 10)},${columnLettersToIndex(em[1])},${hCode})`;
            });

            // 自シート単一セル参照 → __XL_CELL(r, c)
            expr = expr.replace(SINGLE_REF_REGEX, (_, _absC, colLetters, _absR, rowStr) => {
                return `__XL_CELL(${parseInt(rowStr, 10)},${columnLettersToIndex(colLetters)})`;
            });

            // 配列・スカラー演算の統一 AST 書き換え（後置%含む）
            const rewriteArrayOps = (src) => {
                const tokens = [];
                const tokenRe = /\s*(?:(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)|([A-Za-z_$][A-Za-z0-9_$]*)|("(?:\\.|[^"\\])*")|(\*\*|<=|>=|==|!=|[()[\],+\-*/%<>!]))/y;
                let lastIdx = 0;
                while (lastIdx < src.length) {
                    if (/^\s+$/.test(src.slice(lastIdx))) break;
                    tokenRe.lastIndex = lastIdx;
                    const m = tokenRe.exec(src);
                    if (!m) return src;
                    if (m[1] !== undefined) tokens.push({ type: "num", val: m[1] });
                    else if (m[2] !== undefined) tokens.push({ type: "id", val: m[2] });
                    else if (m[3] !== undefined) tokens.push({ type: "str", val: m[3] });
                    else tokens.push({ type: "op", val: m[4] });
                    lastIdx = tokenRe.lastIndex;
                }
                if (!tokens.length) return src;

                let idx = 0;
                let failed = false;
                const peek = () => tokens[idx] || null;
                const consume = () => tokens[idx++];

                const parseExpr = () => parseComparison();
                const parseComparison = () => {
                    let left = parseAdditive();
                    while (peek() && peek().type === "op" && ["==", "!=", "<", "<=", ">", ">="].includes(peek().val)) {
                        const op = consume().val;
                        const right = parseAdditive();
                        left = `__XL_OP("${op}",${left},${right})`;
                    }
                    return left;
                };
                const parseAdditive = () => {
                    let left = parseMultiplicative();
                    while (peek() && peek().type === "op" && (peek().val === "+" || peek().val === "-")) {
                        const op = consume().val;
                        const right = parseMultiplicative();
                        left = `__XL_OP("${op}",${left},${right})`;
                    }
                    return left;
                };
                const parseMultiplicative = () => {
                    let left = parsePower();
                    while (peek() && peek().type === "op" && (peek().val === "*" || peek().val === "/")) {
                        const op = consume().val;
                        const right = parsePower();
                        left = `__XL_OP("${op}",${left},${right})`;
                    }
                    return left;
                };
                const parsePower = () => {
                    let left = parseUnary();
                    if (peek() && peek().type === "op" && peek().val === "**") {
                        consume();
                        const right = parsePower();
                        return `__XL_OP("**",${left},${right})`;
                    }
                    return left;
                };
                const parseUnary = () => {
                    if (peek() && peek().type === "op" && (peek().val === "-" || peek().val === "+" || peek().val === "!")) {
                        const op = consume().val;
                        const operand = parseUnary();
                        return `__XL_U("${op}",${operand})`;
                    }
                    return parsePrimary();
                };
                const parsePrimary = () => {
                    const tok = peek();
                    if (!tok) { failed = true; return ""; }
                    let node = "";
                    if (tok.type === "num" || tok.type === "id" || tok.type === "str") {
                        node = consume().val;
                    } else if (tok.type === "op" && tok.val === "(") {
                        consume();
                        const inner = parseExpr();
                        if (!peek() || peek().val !== ")") { failed = true; return ""; }
                        consume();
                        node = `(${inner})`;
                    } else if (tok.type === "op" && tok.val === "[") {
                        consume();
                        const elems = [];
                        if (peek() && peek().val !== "]") {
                            while (true) {
                                elems.push(parseExpr());
                                if (peek() && peek().val === ",") { consume(); continue; }
                                break;
                            }
                        }
                        if (!peek() || peek().val !== "]") { failed = true; return ""; }
                        consume();
                        node = `[${elems.join(",")}]`;
                    } else {
                        failed = true;
                        return "";
                    }

                    while (peek() && peek().type === "op" && peek().val === "(") {
                        consume();
                        const args = [];
                        if (peek() && peek().val !== ")") {
                            while (true) {
                                if (peek() && (peek().val === "," || peek().val === ")")) {
                                    args.push("undefined");
                                } else {
                                    args.push(parseExpr());
                                }
                                if (peek() && peek().val === ",") { consume(); continue; }
                                break;
                            }
                        }
                        if (!peek() || peek().val !== ")") { failed = true; return ""; }
                        consume();
                        node = `${node}(${args.join(",")})`;
                    }

                    while (peek() && peek().type === "op" && peek().val === "%") {
                        consume();
                        node = `__XL_OP("/",${node},100)`;
                    }
                    return node;
                };

                const parsed = parseExpr();
                if (failed || idx !== tokens.length) return src;
                return parsed;
            };
            expr = rewriteArrayOps(expr);

            // LET / LAMBDA 変換
            const splitTopLevelArgs = (inner) => {
                const args = [];
                let buf = "";
                let depth = 0, sqDepth = 0;
                for (let k = 0; k < inner.length; k++) {
                    const ch = inner[k];
                    if (ch === "(") depth++;
                    else if (ch === ")") depth = Math.max(0, depth - 1);
                    else if (ch === "[") sqDepth++;
                    else if (ch === "]") sqDepth = Math.max(0, sqDepth - 1);
                    if (ch === "," && depth === 0 && sqDepth === 0) {
                        args.push(buf.trim());
                        buf = "";
                    } else {
                        buf += ch;
                    }
                }
                args.push(buf.trim());
                return args;
            };
            const replaceLocalVar = (code, rawName, safeName) => {
                const escaped = rawName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                const re = new RegExp(`(?<![A-Za-z0-9_$.])${escaped}(?![A-Za-z0-9_])`, "gi");
                return code.replace(re, (m, offset, full) => {
                    const after = full.slice(offset + m.length).trimStart();
                    if (after.startsWith("(") && BUILTIN_FN_SET.has(m.toUpperCase())) return m;
                    return safeName;
                });
            };
            const transformLetAndLambda = (src) => {
                let out = "";
                let i = 0;
                while (i < src.length) {
                    const rest = src.slice(i);
                    const fnMatch = rest.match(/^(LET|LAMBDA)\s*\(/);
                    if (fnMatch && (i === 0 || !/[A-Za-z0-9_$]/.test(src[i - 1]))) {
                        const fnName = fnMatch[1];
                        let pos = i + fnMatch[0].length;
                        let depth = 1;
                        while (pos < src.length && depth > 0) {
                            if (src[pos] === "(") depth++;
                            else if (src[pos] === ")") depth--;
                            pos++;
                        }
                        if (depth !== 0) return src;
                        const inner = src.slice(i + fnMatch[0].length, pos - 1);
                        const rawArgs = splitTopLevelArgs(inner);

                        if (fnName === "LET") {
                            if (rawArgs.length < 3 || rawArgs.length % 2 === 0) return '"#VALUE!"';
                            const pairs = [];
                            for (let p = 0; p < rawArgs.length - 1; p += 2) {
                                const varName = rawArgs[p].trim();
                                if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(varName)) return '"#NAME?"';
                                pairs.push({ name: varName, safe: `__LV_${varName.toUpperCase()}`, val: transformLetAndLambda(rawArgs[p + 1]) });
                            }
                            let bodyExpr = transformLetAndLambda(rawArgs[rawArgs.length - 1]);
                            for (let p = pairs.length - 1; p >= 0; p--) {
                                const { name, safe, val } = pairs[p];
                                bodyExpr = `((${safe}) => (${replaceLocalVar(bodyExpr, name, safe)}))(${val})`;
                            }
                            out += bodyExpr;
                        } else {
                            if (rawArgs.length < 2) return '"#VALUE!"';
                            const params = rawArgs.slice(0, -1).map(p => p.trim());
                            if (params.some(p => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(p))) return '"#NAME?"';
                            let bodyExpr = transformLetAndLambda(rawArgs[rawArgs.length - 1]);
                            const safeParams = params.map(p => {
                                const safe = `__LV_${p.toUpperCase()}`;
                                bodyExpr = replaceLocalVar(bodyExpr, p, safe);
                                return safe;
                            });
                            out += `((${safeParams.join(", ")}) => (${bodyExpr}))`;
                        }
                        i = pos;
                    } else {
                        out += src[i++];
                    }
                }
                return out;
            };
            if (/\b(LET|LAMBDA)\s*\(/.test(expr)) {
                expr = transformLetAndLambda(expr);
            }

            // 許可識別子のみに制限（任意JS実行防止 & #NAME? 判定）
            const unsafeIdentMatch = expr.match(/\b[A-Za-z_$][A-Za-z0-9_$]*\b/g);
            if (unsafeIdentMatch) {
                for (const ident of unsafeIdentMatch) {
                    if (/^__STR_LIT_\d+__$/.test(ident) || /^__LV_[A-Z0-9_]+$/.test(ident)) continue;
                    if (!ALLOWED_IDENTIFIERS.has(ident)) {
                        const errEntry = { error: "#NAME?" };
                        compiledFormulaCache.set(resolvedExpr, errEntry);
                        return errEntry;
                    }
                }
            }

            const finalJsExpr = expr.replace(/__STR_LIT_(\d+)__/g, (_, idx) => stringLiterals[Number(idx)]);

            const fn = new Function(
                "EXCEL_BLANK_CELL",
                "__XL_EQ",
                "__XL_OP",
                "__XL_U",
                "__XL_REF",
                "__XL_CELL",
                "__XL_XCELL",
                "__XL_RNG",
                "__XL_XRNG",
                "__XL_COLRNG",
                "__XL_ROWRNG",
                "__XL_ROW",
                "__XL_COL",
                "INDIRECT",
                "OFFSET",
                ...FORMULA_FN_NAMES,
                `"use strict"; return (${finalJsExpr});`
            );

            // 日付判定メタ情報も1回だけ解析してキャッシュ
            const singleRefMatch = resolvedExpr.match(/^(?:(?:'([^']+)'|([A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+))!)?\$?([A-Za-z]+)\$?(\d+)$/);
            const directRef = singleRefMatch
                ? { sheetName: singleRefMatch[1] ?? singleRefMatch[2] ?? null, row: parseInt(singleRefMatch[4], 10), col: columnLettersToIndex(singleRefMatch[3]) }
                : null;

            const strippedForRefs = resolvedExpr.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'(?!\s*!)/g, "");
            const hasPlusMinus = /[+-]/.test(strippedForRefs);
            const dateCandidateRefs = [];
            if (!directRef && hasPlusMinus) {
                const allRefRegex = /(?:(?:'([^']+)'|([A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+))!)?(?<![A-Za-z0-9_])\$?([A-Za-z]+)\$?(\d+)(?!\s*\()/g;
                let m;
                while ((m = allRefRegex.exec(strippedForRefs)) !== null) {
                    dateCandidateRefs.push({
                        sheetName: m[1] ?? m[2] ?? null,
                        row: parseInt(m[4], 10),
                        col: columnLettersToIndex(m[3])
                    });
                }
            }

            const returnsNumericDateInfo = /^\s*=\s*(YEAR|MONTH|DAY|HOUR|MINUTE|SECOND|WEEKDAY|DAYS|DATEDIF|NETWORKDAYS|DATEVALUE|TIMEVALUE)\s*\(/i.test(rawFormula);
            const hasDateFunc = !returnsNumericDateInfo && /\b(TODAY|NOW|DATE|EDATE|EOMONTH|WORKDAY)\s*\(/i.test(rawFormula);

            const entry = {
                fn,
                directRef,
                hasPlusMinus,
                dateCandidateRefs,
                hasDateFunc
            };

            if (compiledFormulaCache.size > 3000) compiledFormulaCache.clear();
            compiledFormulaCache.set(resolvedExpr, entry);
            return entry;
        } catch {
            return { error: "#ERROR!" };
        }
    }

    function evaluateFormula(formula, visited = new Set(), contextSheetIdx = getActiveSheetIndex(), evalCoord = null) {
        if (!formula) return formula;
        if (formula === "=") return "=";
        if (formula[0] !== "=") return formula;

        let resolvedExpr = formula.substring(1).trim();
        if (!resolvedExpr) return "=";

        const sheets = getSheets();
        const activeSheetIndex = getActiveSheetIndex();
        const definedNames = getDefinedNames();

        // 構造化参照や定義済み名前を含む場合のみ事前解決（通常数式はオーバーヘッドゼロでキャッシュ直行）
        if (resolvedExpr.includes("[")) {
            resolvedExpr = resolveStructuredReferences(resolvedExpr, contextSheetIdx);
        }
        if (definedNames && typeof definedNames === "object") {
            const nameKeys = Object.keys(definedNames);
            if (nameKeys.length > 0) {
                const nameEntries = nameKeys.sort((a, b) => b.length - a.length);
                const lits = [];
                const masked = resolvedExpr.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'(?!\s*!)/g, (m) => {
                    const tok = `__DNSTR_${lits.length}__`;
                    lits.push(m);
                    return tok;
                });
                let replaced = masked;
                for (const dName of nameEntries) {
                    const escaped = dName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                    const re = new RegExp(`(?<![A-Za-z0-9_\\u3040-\\u30FF\\u4E00-\\u9FAF$!])${escaped}(?![A-Za-z0-9_\\u3040-\\u30FF\\u4E00-\\u9FAF(])`, "g");
                    replaced = replaced.replace(re, definedNames[dName]);
                }
                resolvedExpr = replaced.replace(/__DNSTR_(\d+)__/g, (_, i) => lits[Number(i)]);
            }
        }

        const compiled = compileFormulaTemplate(resolvedExpr, formula);
        if (!compiled || compiled.error) return compiled?.error || "#ERROR!";

        try {
            const findSheetIdx = (sName) => {
                if (!sName) return contextSheetIdx;
                return sheets.findIndex(s => s.name === sName);
            };

            const runtimeCell = (r, c) => {
                const v = getSheetCellValue(contextSheetIdx, r, c, visited);
                return isBlankVal(v) ? EXCEL_BLANK_CELL : v;
            };
            const runtimeXCell = (sName, r, c) => {
                const sIdx = findSheetIdx(sName);
                if (sIdx === -1) return "#REF!";
                const v = getSheetCellValue(sIdx, r, c, visited);
                return isBlankVal(v) ? EXCEL_BLANK_CELL : v;
            };
            const runtimeRange = (r1, c1, r2, c2, hCode) => readRange2DValues(contextSheetIdx, r1, c1, r2, c2, visited, hCode);
            const runtimeXRange = (sName, r1, c1, r2, c2, hCode) => readRange2DValues(findSheetIdx(sName), r1, c1, r2, c2, visited, hCode);
            const runtimeColRange = (c1, c2, hCode) => readRange2DValues(contextSheetIdx, 1, c1, Math.max(1, tbody.rows.length), c2, visited, hCode);
            const runtimeRowRange = (r1, r2, hCode) => readRange2DValues(contextSheetIdx, r1, 0, r2, Math.max(0, getCurrentColumns() - 1), visited, hCode);
            const runtimeRow = () => evalCoord?.row ?? 1;
            const runtimeCol = () => (evalCoord?.col ?? 0) + 1;

            const makeXlRef = (sName, r1, c1, r2, c2) => ({
                __isXlRef: true,
                sheetIdx: findSheetIdx(sName),
                r1, c1, r2, c2
            });

            const runtimeIndirect = (refText, a1 = true) => {
                const raw = String(unwrapBlank(refText) ?? "").trim();
                if (!raw) return "#REF!";
                const isA1 = typeof a1 === "string"
                    ? !["FALSE", "0"].includes(a1.trim().toUpperCase())
                    : Boolean(a1);
                if (!isA1) return "#REF!";

                const sheetSplit = raw.match(/^(?:(?:'([^']+)'|([A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+))!)?(.+)$/);
                if (!sheetSplit) return "#REF!";
                const sName = sheetSplit[1] ?? sheetSplit[2];
                const targetSIdx = sName ? findSheetIdx(sName) : contextSheetIdx;
                if (targetSIdx < 0 || !sheets[targetSIdx]) return "#REF!";

                const body = sheetSplit[3].trim();
                const rangeM = body.match(/^\$?([A-Za-z]+)\$?(\d+):\$?([A-Za-z]+)\$?(\d+)$/);
                if (rangeM) {
                    return readRange2DValues(
                        targetSIdx,
                        parseInt(rangeM[2], 10),
                        columnLettersToIndex(rangeM[1]),
                        parseInt(rangeM[4], 10),
                        columnLettersToIndex(rangeM[3]),
                        visited,
                        0
                    );
                }

                const colRangeM = body.match(/^\$?([A-Za-z]+):\$?([A-Za-z]+)$/);
                if (colRangeM) {
                    return readRange2DValues(
                        targetSIdx,
                        1,
                        columnLettersToIndex(colRangeM[1]),
                        Math.max(1, getRowCount() - 1),
                        columnLettersToIndex(colRangeM[2]),
                        visited,
                        0
                    );
                }

                const rowRangeM = body.match(/^\$?(\d+):\$?(\d+)$/);
                if (rowRangeM) {
                    return readRange2DValues(
                        targetSIdx,
                        parseInt(rowRangeM[1], 10),
                        0,
                        parseInt(rowRangeM[2], 10),
                        Math.max(0, getCurrentColumns() - 1),
                        visited,
                        0
                    );
                }

                const cellM = body.match(/^\$?([A-Za-z]+)\$?(\d+)$/);
                if (cellM) {
                    const v = getSheetCellValue(targetSIdx, parseInt(cellM[2], 10), columnLettersToIndex(cellM[1]), visited);
                    return isBlankVal(v) ? EXCEL_BLANK_CELL : v;
                }
                return "#REF!";
            };

            const runtimeOffset = (refObj, rowOff, colOff, height = null, width = null) => {
                if (!refObj || !refObj.__isXlRef) return "#VALUE!";
                if (refObj.sheetIdx < 0 || !sheets[refObj.sheetIdx]) return "#REF!";
                const dr = Math.trunc(Number(unwrapBlank(rowOff)));
                const dc = Math.trunc(Number(unwrapBlank(colOff)));
                if (Number.isNaN(dr) || Number.isNaN(dc)) return "#VALUE!";

                const baseH = refObj.r2 - refObj.r1 + 1;
                const baseW = refObj.c2 - refObj.c1 + 1;
                const h = (height == null || isBlankVal(height)) ? baseH : Math.trunc(Number(unwrapBlank(height)));
                const w = (width == null || isBlankVal(width)) ? baseW : Math.trunc(Number(unwrapBlank(width)));
                if (Number.isNaN(h) || Number.isNaN(w)) return "#VALUE!";
                if (h === 0 || w === 0) return "#REF!";

                const anchorR = refObj.r1 + dr;
                const anchorC = refObj.c1 + dc;
                const rStart = h > 0 ? anchorR : anchorR + h + 1;
                const rEnd = h > 0 ? anchorR + h - 1 : anchorR;
                const cStart = w > 0 ? anchorC : anchorC + w + 1;
                const cEnd = w > 0 ? anchorC + w - 1 : anchorC;
                if (rStart < 1 || cStart < 0) return "#REF!";

                if (rStart === rEnd && cStart === cEnd) {
                    const v = getSheetCellValue(refObj.sheetIdx, rStart, cStart, visited);
                    return isBlankVal(v) ? EXCEL_BLANK_CELL : v;
                }
                return readRange2DValues(refObj.sheetIdx, rStart, cStart, rEnd, cEnd, visited, 0);
            };

            const rawEval = compiled.fn(
                EXCEL_BLANK_CELL,
                (a, b) => excelBinaryOp("==", a, b),
                excelBinaryOp,
                excelUnaryOp,
                makeXlRef,
                runtimeCell,
                runtimeXCell,
                runtimeRange,
                runtimeXRange,
                runtimeColRange,
                runtimeRowRange,
                runtimeRow,
                runtimeCol,
                runtimeIndirect,
                runtimeOffset,
                ...FORMULA_FN_VALUES
            );

            let result = unwrapBlank(rawEval);
            if (typeof result === "number") {
                if (Number.isNaN(result)) return "#VALUE!";
                if (!Number.isFinite(result)) return "#DIV/0!";
                result = Number(result.toPrecision(15));
                if (Object.is(result, -0)) result = 0;
            }
            if (result instanceof Date && !isNaN(result.getTime())) {
                return formatDate(result);
            }
            if (Array.isArray(result)) {
                return result;
            }

            const isDateCellAt = (sIdx, rNum, cIdx) => {
                if (sIdx === activeSheetIndex) {
                    const refCell = peekCell(rNum, cIdx);
                    return refCell?.dataset.valueType === "date" || isDateFormat((refCell?.dataset.rawValue ?? refCell?.textContent ?? "").trim());
                }
                if (sheets[sIdx]) {
                    const entry = getBackgroundSheetCellMap(sheets[sIdx]).get(`${rNum},${cIdx}`);
                    return entry?.vt === "date" || isDateFormat(String(entry?.v ?? "").trim());
                }
                return false;
            };

            let isDirectDateRef = false;
            if (compiled.directRef) {
                const targetSIdx = findSheetIdx(compiled.directRef.sheetName);
                if (targetSIdx >= 0) {
                    isDirectDateRef = isDateCellAt(targetSIdx, compiled.directRef.row, compiled.directRef.col);
                }
            }

            let hasDateCellRef = isDirectDateRef;
            if (!hasDateCellRef && typeof result === "number" && result >= 36526 && result <= 73050 && compiled.hasPlusMinus) {
                for (const ref of compiled.dateCandidateRefs) {
                    const sIdx = findSheetIdx(ref.sheetName);
                    if (sIdx >= 0 && isDateCellAt(sIdx, ref.row, ref.col)) {
                        hasDateCellRef = true;
                        break;
                    }
                }
            }

            if ((isDirectDateRef || compiled.hasDateFunc || hasDateCellRef) && typeof result === "number" && isFinite(result)) {
                return formatDate(serialToDate(result));
            }
            return typeof result === "function" ? "" : result;
        } catch {
            return "#ERROR!";
        }
    }

    function clearSpillCellsFromAnchor(anchorRow, anchorCol) {
        const originKey = `${anchorRow},${anchorCol}`;
        tbody.querySelectorAll(`td[data-spill-origin="${originKey}"]`).forEach(td => {
            delete td.dataset.spillOrigin;
            setCellFormattedValue(td, "");
        });
    }

    function applySpillMatrix(anchorCell, r0, c0, rawArray) {
        const matrix = Array.isArray(rawArray[0]) ? rawArray : rawArray.map(v => [v]);
        const rows = matrix.length;
        const cols = Math.max(1, ...matrix.map(r => (Array.isArray(r) ? r.length : 1)));
        const originKey = `${r0},${c0}`;

        // 展開先に既存データがある場合は #SPILL! エラー
        for (let dr = 0; dr < rows; dr++) {
            for (let dc = 0; dc < cols; dc++) {
                if (dr === 0 && dc === 0) continue;
                const target = getCell(r0 + dr, c0 + dc);
                if (!target) continue;
                const hasOtherVal = Boolean(target.dataset.formula) ||
                    (target.dataset.spillOrigin !== originKey && (target.dataset.rawValue ?? target.textContent).trim() !== "");
                if (hasOtherVal || target.style.display === "none") {
                    setCellFormattedValue(anchorCell, "#SPILL!");
                    return "#SPILL!";
                }
            }
        }

        for (let dr = 0; dr < rows; dr++) {
            for (let dc = 0; dc < cols; dc++) {
                const target = getCell(r0 + dr, c0 + dc);
                if (!target) continue;
                const val = Array.isArray(matrix[dr]) ? (matrix[dr][dc] ?? "") : (dc === 0 ? matrix[dr] : "");
                if (dr > 0 || dc > 0) {
                    target.dataset.spillOrigin = originKey;
                }
                setCellFormattedValue(target, val);
            }
        }
        return matrix[0]?.[0] ?? "";
    }

    // =========================================================
    // Excel準拠 依存関係グラフ（Dependency Graph）＆ 差分再計算エンジン
    // =========================================================
    const VOLATILE_FN_RE = /\b(NOW|TODAY|RAND|RANDBETWEEN|RANDARRAY|INDIRECT|OFFSET)\s*\(/i;
    const COL_AXIS_REF_RE = /(?<![A-Za-z0-9_:])(\$?[A-Za-z]+):(\$?[A-Za-z]+)(?![A-Za-z0-9_(])/g;
    const ROW_AXIS_REF_RE = /(?<![A-Za-z0-9_:])(\$?\d+):(\$?\d+)(?![A-Za-z0-9_])/g;

    let depGraphBuilt = false;
    let depGraphSheetIndex = -1;
    const formulaDepsByFormula = new Map(); // formulaKey -> { cell, cells: Set<string>, ranges: Array<{r0,r1,c0,c1}>, isVolatile: boolean }
    const dependentsByCell = new Map();     // cellKey -> Set<formulaKey>
    const rangeDependents = new Set();      // Set<{ formulaKey, r0, r1, c0, c1 }>
    const volatileFormulaKeys = new Set();  // Set<formulaKey>

    function invalidateDependencyGraph() {
        depGraphBuilt = false;
        depGraphSheetIndex = -1;
        formulaDepsByFormula.clear();
        dependentsByCell.clear();
        rangeDependents.clear();
        volatileFormulaKeys.clear();
    }

    function parseFormulaDependencies(formula) {
        const cells = new Set();
        const ranges = [];
        if (!formula || formula[0] !== "=") {
            return { cells, ranges, isVolatile: false };
        }

        const definedNames = getDefinedNames();
        const hasDefinedNames = Boolean(definedNames && Object.keys(definedNames).length > 0);

        // 文字列リテラルを除外
        const noStrings = formula
            .substring(1)
            .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'(?!\s*!)/g, " ");

        // 揮発性関数・構造化参照・名前定義を含む数式は常に再計算対象として追跡
        const isVolatile =
            VOLATILE_FN_RE.test(noStrings) ||
            noStrings.includes("[") ||
            (hasDefinedNames && Object.keys(definedNames).some(name => noStrings.includes(name)));

        // 他シート参照を除外して自シート依存を抽出
        const cleaned = noStrings.replace(
            /(?:'(?:''|[^'])+'|[A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+)!\$?[A-Za-z0-9]+(?::\$?[A-Za-z0-9]+)?/g,
            " "
        );

        // 1. 通常範囲参照（A1:B5）
        let rest = cleaned.replace(RANGE_REF_REGEX, (match) => {
            const [sRef, eRef] = match.split(":");
            const s = parseCellReference(sRef.toUpperCase());
            const e = parseCellReference(eRef.toUpperCase());
            if (s && e) {
                ranges.push({
                    r0: Math.min(s.row, e.row),
                    r1: Math.max(s.row, e.row),
                    c0: Math.min(s.col, e.col),
                    c1: Math.max(s.col, e.col)
                });
            }
            return " ";
        });

        // 2. 列全体参照（A:C）
        rest = rest.replace(COL_AXIS_REF_RE, (_, c1, c2) => {
            const i1 = columnLettersToIndex(c1.replace(/^\$/, ""));
            const i2 = columnLettersToIndex(c2.replace(/^\$/, ""));
            ranges.push({ r0: 1, r1: Infinity, c0: Math.min(i1, i2), c1: Math.max(i1, i2) });
            return " ";
        });

        // 3. 行全体参照（1:5）
        rest = rest.replace(ROW_AXIS_REF_RE, (_, r1, r2) => {
            const n1 = parseInt(r1.replace(/^\$/, ""), 10);
            const n2 = parseInt(r2.replace(/^\$/, ""), 10);
            ranges.push({ r0: Math.min(n1, n2), r1: Math.max(n1, n2), c0: 0, c1: Infinity });
            return " ";
        });

        // 4. 単一セル参照（A1）
        rest.replace(SINGLE_REF_REGEX, (_, _absC, colLetters, _absR, rowStr) => {
            cells.add(`${parseInt(rowStr, 10)},${columnLettersToIndex(colLetters)}`);
            return " ";
        });

        return { cells, ranges, isVolatile };
    }

    function unregisterFormulaInGraph(formulaKey) {
        const prev = formulaDepsByFormula.get(formulaKey);
        if (!prev) return;
        for (const depCellKey of prev.cells) {
            const set = dependentsByCell.get(depCellKey);
            if (set) {
                set.delete(formulaKey);
                if (set.size === 0) dependentsByCell.delete(depCellKey);
            }
        }
        for (const rngObj of prev.rangeEntries) {
            rangeDependents.delete(rngObj);
        }
        volatileFormulaKeys.delete(formulaKey);
        formulaDepsByFormula.delete(formulaKey);
    }

    function registerFormulaInGraph(cell) {
        const formulaKey = `${cell.dataset.row},${cell.dataset.col}`;
        unregisterFormulaInGraph(formulaKey);
        const formula = cell.dataset.formula;
        if (!formula || formula[0] !== "=") return;

        const { cells, ranges, isVolatile } = parseFormulaDependencies(formula);
        const rangeEntries = [];
        for (const depCellKey of cells) {
            let set = dependentsByCell.get(depCellKey);
            if (!set) {
                set = new Set();
                dependentsByCell.set(depCellKey, set);
            }
            set.add(formulaKey);
        }
        for (const r of ranges) {
            const entry = { formulaKey, r0: r.r0, r1: r.r1, c0: r.c0, c1: r.c1 };
            rangeDependents.add(entry);
            rangeEntries.push(entry);
        }
        if (isVolatile) {
            volatileFormulaKeys.add(formulaKey);
        }
        formulaDepsByFormula.set(formulaKey, {
            cell,
            row: parseInt(cell.dataset.row, 10),
            col: parseInt(cell.dataset.col, 10),
            cells,
            ranges,
            rangeEntries,
            isVolatile
        });
    }

    function rebuildDependencyGraph(preQueriedFormulaCells = null) {
        invalidateDependencyGraph();
        const formulaCells = preQueriedFormulaCells || Array.from(tbody.querySelectorAll("td[data-formula]"));
        for (let i = 0; i < formulaCells.length; i++) {
            registerFormulaInGraph(formulaCells[i]);
        }
        depGraphBuilt = true;
        depGraphSheetIndex = getActiveSheetIndex();
        return formulaCells;
    }

    function ensureDependencyGraph() {
        if (!depGraphBuilt || depGraphSheetIndex !== getActiveSheetIndex()) {
            rebuildDependencyGraph();
        }
    }

    function sortFormulaKeysTopologically(targetKeys) {
        const targetSet = new Set(targetKeys);
        const visited = new Set();
        const visiting = new Set();
        const sortedCells = [];

        // 行ごとの数式バケットを事前構築し、O(N^2) の全数式総当たりを回避
        const targetByRow = new Map();
        for (const key of targetSet) {
            const info = formulaDepsByFormula.get(key);
            if (!info || !info.cell?.isConnected) continue;
            let rowList = targetByRow.get(info.row);
            if (!rowList) {
                rowList = [];
                targetByRow.set(info.row, rowList);
            }
            rowList.push({ key, col: info.col });
        }
        const sortedRowNums = Array.from(targetByRow.keys()).sort((a, b) => a - b);

        const lowerBoundRow = (targetRow) => {
            let lo = 0, hi = sortedRowNums.length;
            while (lo < hi) {
                const mid = (lo + hi) >> 1;
                if (sortedRowNums[mid] < targetRow) lo = mid + 1;
                else hi = mid;
            }
            return lo;
        };

        const visit = (key) => {
            if (visited.has(key) || visiting.has(key)) return;
            const info = formulaDepsByFormula.get(key);
            if (!info || !info.cell?.isConnected) return;

            visiting.add(key);
            // 1. 直接セル依存
            for (const depKey of info.cells) {
                if (targetSet.has(depKey)) visit(depKey);
            }
            // 2. 範囲依存（二分探索で該当行のみ走査：SUM(A1:A10) 等の広範囲コピーでもほぼ O(N)）
            if (info.ranges.length > 0 && sortedRowNums.length > 0) {
                for (let i = 0; i < info.ranges.length; i++) {
                    const rng = info.ranges[i];
                    for (let ri = lowerBoundRow(rng.r0); ri < sortedRowNums.length; ri++) {
                        const rNum = sortedRowNums[ri];
                        if (rNum > rng.r1) break;
                        const rowList = targetByRow.get(rNum);
                        for (let j = 0; j < rowList.length; j++) {
                            const item = rowList[j];
                            if (item.col >= rng.c0 && item.col <= rng.c1 && item.key !== key) {
                                visit(item.key);
                            }
                        }
                    }
                }
            }
            visiting.delete(key);
            visited.add(key);
            sortedCells.push(info.cell);
        };

        const staticKeys = [];
        const dynamicKeys = [];
        for (const key of targetSet) {
            const info = formulaDepsByFormula.get(key);
            if (!info) continue;
            if (info.isVolatile) dynamicKeys.push(key);
            else staticKeys.push(key);
        }
        for (const key of staticKeys) visit(key);
        for (const key of dynamicKeys) visit(key);
        return sortedCells;
    }

    function hasBackgroundCrossSheetReference() {
        const sheets = getSheets();
        if (!Array.isArray(sheets) || sheets.length <= 1) return false;
        const activeIdx = getActiveSheetIndex();
        const activeName = sheets[activeIdx]?.name || "";
        if (!activeName) return true;
        for (let sIdx = 0; sIdx < sheets.length; sIdx++) {
            if (sIdx === activeIdx || !Array.isArray(sheets[sIdx]?.cells)) continue;
            const cells = sheets[sIdx].cells;
            for (let i = 0; i < cells.length; i++) {
                const f = cells[i].f;
                if (f && (f.includes(`${activeName}!`) || f.includes(`'${activeName}'!`) || f.includes("["))) {
                    return true;
                }
            }
        }
        return false;
    }

    function recalculateBackgroundSheets() {
        const sheets = getSheets();
        const activeSheetIndex = getActiveSheetIndex();
        sheets.forEach((sheet, sIdx) => {
            if (sIdx === activeSheetIndex || !Array.isArray(sheet.cells)) return;
            sheet.cells.forEach(entry => {
                if (entry.f && String(entry.f).startsWith("=")) {
                    const res = evaluateFormula(entry.f, new Set(), sIdx, {
                        row: Number(entry.r) || 1,
                        col: Number(entry.c) || 0
                    });
                    entry.v = res != null ? String(res) : "";
                }
            });
        });
    }

    function evaluateOrderedFormulaCells(orderedCells, activeSheetIndex, affectedRowsSet = null) {
        const spilledCoords = [];
        for (let i = 0; i < orderedCells.length; i++) {
            const cell = orderedCells[i];
            if (!cell || !cell.isConnected || isCellEditing(cell)) continue;
            const r = parseInt(cell.dataset.row, 10);
            const c = parseInt(cell.dataset.col, 10);
            clearSpillCellsFromAnchor(r, c);

            const cellKey = `${activeSheetIndex}:${r},${c}`;
            const visited = new Set([cellKey]);
            const rawResult = evaluateFormula(cell.dataset.formula, visited, activeSheetIndex, { row: r, col: c });

            if (Array.isArray(rawResult)) {
                const topVal = applySpillMatrix(cell, r, c, rawResult);
                formulaEvalCache.set(cellKey, topVal);
                const mat = Array.isArray(rawResult[0]) ? rawResult : rawResult.map(v => [v]);
                const rLen = mat.length;
                const cLen = Math.max(1, ...mat.map(row => (Array.isArray(row) ? row.length : 1)));
                for (let dr = 0; dr < rLen; dr++) {
                    const tr = getRow(r + dr);
                    if (affectedRowsSet && tr) affectedRowsSet.add(tr);
                    for (let dc = 0; dc < cLen; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        spilledCoords.push({ row: r + dr, col: c + dc });
                    }
                }
            } else {
                const dateSerial = tryParseDateToSerial(rawResult);
                const cachedVal = dateSerial !== null
                    ? dateSerial
                    : ((rawResult !== "" && !isNaN(Number(rawResult))) ? Number(rawResult) : rawResult);
                formulaEvalCache.set(cellKey, cachedVal);
                setCellFormattedValue(cell, rawResult);
                const tr = cell.closest("tr");
                if (affectedRowsSet && tr) affectedRowsSet.add(tr);
            }
        }
        return spilledCoords;
    }

    /**
     * Excel Smart Recalculation:
     * 変更されたセル座標の依存先（直接・範囲・連鎖）と揮発性関数のみを差分再計算する
     */
    function recalculateCells(changedCoords, { formulaChanged = false } = {}) {
        const list = Array.isArray(changedCoords) ? changedCoords : (changedCoords ? [changedCoords] : []);
        if (!list.length) return;

        ensureDependencyGraph();

        const affectedRows = new Set();
        const queue = [];
        const queuedCoords = new Set();
        const affectedFormulaKeys = new Set();

        const enqueueCoord = (r, c) => {
            const k = `${r},${c}`;
            if (queuedCoords.has(k)) return;
            queuedCoords.add(k);
            queue.push({ r, c, k });
        };

        for (let i = 0; i < list.length; i++) {
            const { row, col } = list[i];
            const td = peekCell(row, col);
            const tr = getRow(row);
            if (tr) affectedRows.add(tr);

            if (formulaChanged) {
                if (td && td.dataset.formula) registerFormulaInGraph(td);
                else unregisterFormulaInGraph(`${row},${col}`);
            }
            if (td && td.dataset.formula) {
                affectedFormulaKeys.add(`${row},${col}`);
            }
            enqueueCoord(row, col);
        }

        // 揮発性関数（TODAY / NOW / RAND / INDIRECT / OFFSET / 構造化参照 / 名前定義）も必ず再計算対象へ追加
        for (const vKey of volatileFormulaKeys) {
            if (!affectedFormulaKeys.has(vKey)) {
                affectedFormulaKeys.add(vKey);
                const [vr, vc] = vKey.split(",").map(Number);
                enqueueCoord(vr, vc);
            }
        }

        const collectDownstreamFromQueue = () => {
            let head = 0;
            while (head < queue.length) {
                const { r, c, k } = queue[head++];

                const directDeps = dependentsByCell.get(k);
                if (directDeps) {
                    for (const fKey of directDeps) {
                        if (!affectedFormulaKeys.has(fKey)) {
                            affectedFormulaKeys.add(fKey);
                            const [fr, fc] = fKey.split(",").map(Number);
                            enqueueCoord(fr, fc);
                        }
                    }
                }

                for (const rng of rangeDependents) {
                    if (r >= rng.r0 && r <= rng.r1 && c >= rng.c0 && c <= rng.c1) {
                        if (!affectedFormulaKeys.has(rng.formulaKey)) {
                            affectedFormulaKeys.add(rng.formulaKey);
                            const [fr, fc] = rng.formulaKey.split(",").map(Number);
                            enqueueCoord(fr, fc);
                        }
                    }
                }
            }
        };

        collectDownstreamFromQueue();

        const activeSheetIndex = getActiveSheetIndex();
        if (affectedFormulaKeys.size > 0) {
            formulaEvalCache.clear();
            isBatchRecalculating = true;
            try {
                const ordered = sortFormulaKeysTopologically(affectedFormulaKeys);
                const spilledCoords = evaluateOrderedFormulaCells(ordered, activeSheetIndex, affectedRows);

                // スピル先を参照している下流数式があれば追加で1パス再計算
                if (spilledCoords.length > 0) {
                    const prevCount = affectedFormulaKeys.size;
                    queue.length = 0;
                    for (let i = 0; i < spilledCoords.length; i++) {
                        enqueueCoord(spilledCoords[i].row, spilledCoords[i].col);
                    }
                    collectDownstreamFromQueue();
                    if (affectedFormulaKeys.size > prevCount) {
                        const extraKeys = [];
                        for (const fKey of affectedFormulaKeys) {
                            const info = formulaDepsByFormula.get(fKey);
                            if (info && !ordered.includes(info.cell)) extraKeys.push(fKey);
                        }
                        if (extraKeys.length > 0) {
                            const extraOrdered = sortFormulaKeysTopologically(extraKeys);
                            evaluateOrderedFormulaCells(extraOrdered, activeSheetIndex, affectedRows);
                        }
                    }
                }

                if (hasBackgroundCrossSheetReference()) {
                    recalculateBackgroundSheets();
                }
            } finally {
                isBatchRecalculating = false;
                formulaEvalCache.clear();
            }
        } else if (hasBackgroundCrossSheetReference()) {
            recalculateBackgroundSheets();
        }

        applyConditionalFormats();
        updateTextOverflowDisplay(affectedRows.size > 0 ? Array.from(affectedRows) : null);
        updateAllFloatingCharts();
    }

    function updateAllFormulas() {
        formulaEvalCache.clear();
        isBatchRecalculating = true;
        const activeSheetIndex = getActiveSheetIndex();
        try {
            const rawFormulaCells = rebuildDependencyGraph();
            const allKeys = rawFormulaCells.map(cell => `${cell.dataset.row},${cell.dataset.col}`);
            const orderedCells = sortFormulaKeysTopologically(allKeys);
            evaluateOrderedFormulaCells(orderedCells, activeSheetIndex, null);
            if (hasBackgroundCrossSheetReference()) {
                recalculateBackgroundSheets();
            }
        } finally {
            isBatchRecalculating = false;
            formulaEvalCache.clear();
        }
        applyConditionalFormats();
        updateTextOverflowDisplay();
        updateAllFloatingCharts();
    }

    return {
        clearFormulaEvalCache,
        invalidateBackgroundSheetCache,
        invalidateDependencyGraph,
        getBackgroundSheetCellMap,
        getSheetCellValue,
        getCellEvaluatedValue,
        evaluateFormula,
        clearSpillCellsFromAnchor,
        recalculateBackgroundSheets,
        recalculateCells,
        updateAllFormulas
    };
}