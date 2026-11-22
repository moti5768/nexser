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

    function buildRange2DLiteral(sheetIdx, startRef, endRef, visited, hiddenMode = "none", stringLiterals = null) {
        const startMatch = startRef?.match(/^\$?([A-Za-z]+)\$?(\d+)$/);
        const endMatch = endRef?.match(/^\$?([A-Za-z]+)\$?(\d+)$/);
        if (!startMatch || !endMatch) return "[]";

        const startCol = columnLettersToIndex(startMatch[1]);
        const startRow = parseInt(startMatch[2], 10);
        const endCol = columnLettersToIndex(endMatch[1]);
        const endRow = parseInt(endMatch[2], 10);

        const sheets = getSheets();
        const activeSheetIndex = getActiveSheetIndex();
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
        const rStart = Math.min(startRow, endRow);
        const rEnd = Math.min(Math.max(startRow, endRow), maxR);
        const cStart = Math.min(startCol, endCol);
        const cEnd = Math.min(Math.max(startCol, endCol), maxC);
        const matrix = [];
        for (let r = rStart; r <= rEnd; r++) {
            if (hiddenMode !== "none" && sheetIdx === activeSheetIndex) {
                const tr = getRow(r);
                if (tr) {
                    if (hiddenMode === "all" && tr.style.display === "none") continue;
                    if (hiddenMode === "filterOnly" && tr.dataset.filterHidden === "1") continue;
                }
            }
            const rowVals = [];
            for (let c = cStart; c <= cEnd; c++) {
                const val = getSheetCellValue(sheetIdx, r, c, visited);
                rowVals.push(toJSValueLiteral(val, false, stringLiterals));
            }
            matrix.push(`[${rowVals.join(",")}]`);
        }
        return `[${matrix.join(",")}]`;
    }

    function evaluateFormula(formula, visited = new Set(), contextSheetIdx = getActiveSheetIndex(), evalCoord = null) {
        if (!formula) return formula;
        if (formula === "=") return "=";
        if (formula[0] !== "=") return formula;

        let expr = formula.substring(1).trim();
        if (!expr) return "=";

        const sheets = getSheets();
        const activeSheetIndex = getActiveSheetIndex();
        const definedNames = getDefinedNames();

        try {
            // 1. 最優先で文字列リテラルを退避し、内部の "=", "<>", "%" 等が破壊されるのを防ぐ
            const stringLiterals = [];
            expr = expr.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'(?!\s*!)/g, (m) => {
                const token = `__STR_LIT_${stringLiterals.length}__`;
                stringLiterals.push(m);
                return token;
            });

            expr = preprocessAllNestedIFs(expr);

            expr = resolveStructuredReferences(expr, contextSheetIdx);
            if (typeof definedNames === "object" && definedNames) {
                const nameEntries = Object.entries(definedNames).sort((a, b) => b[0].length - a[0].length);
                for (const [dName, dRef] of nameEntries) {
                    const escaped = dName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                    const re = new RegExp(`(?<![A-Za-z0-9_\\u3040-\\u30FF\\u4E00-\\u9FAF$!])${escaped}(?![A-Za-z0-9_\\u3040-\\u30FF\\u4E00-\\u9FAF(])`, "g");
                    expr = expr.replace(re, dRef);
                }
            }

            // Excelの演算子優先順位（比較 < & < 四則）と等価比較（__XL_EQ）への変換
            const convertExcelConcat = (src) => {
                // 1. まず括弧 (...) 内部を再帰変換（関数引数のカンマ境界を破壊しない）
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
                        // カンマ区切り（関数引数）ごとに独立して変換
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

                // 2. トップレベルの比較演算子で分割し、各辺ごとに & を CONCAT(...) に変換
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

            // 列全体参照 ($A:$C)・行全体参照 ($1:$5) をシート使用範囲へ展開する補助関数
            const expandWholeAxisRefs = (src) => {
                const maxUsedRow = Math.max(1, tbody.rows.length);
                const maxUsedCol = Math.max(0, getCurrentColumns() - 1);
                const maxColName = getColumnName(maxUsedCol);
                // 列全体参照（例: A:C, $B:$B）
                let out = src.replace(/(?<![A-Za-z0-9_:])(\$?[A-Za-z]+):(\$?[A-Za-z]+)(?![A-Za-z0-9_(])/g, (_, c1, c2) => {
                    return `${c1}1:${c2}${maxUsedRow}`;
                });
                // 行全体参照（例: 1:3, $2:$2）
                out = out.replace(/(?<![A-Za-z0-9_:])(\$?\d+):(\$?\d+)(?![A-Za-z0-9_])/g, (_, r1, r2) => {
                    return `A${r1}:${maxColName}${r2}`;
                });
                return out;
            };

            // Excel仕様: 単項マイナスはべき乗(^)より高優先 (-2^2 === 4)
            const normalizeExcelPower = (src) => {
                return src
                    .replace(/(^|[(\[,+\-*/=<>!&])\s*(-\s*(?:\d+(?:\.\d+)?|\$?[A-Za-z]+\$?\d+|\([^()]+\)))\s*\^/g, "$1($2)**")
                    .replace(/\^/g, "**");
            };

            // Excel演算子・リテラル・関数名の大文字正規化（後置%はrewriteArrayOpsでネスト括弧・関数・配列まで統一処理）
            expr = expandWholeAxisRefs(convertExcelConcat(expr));
            expr = normalizeExcelPower(expr)
                .replace(/<>/g, "!=")
                .replace(/(?<![<>!=])=(?!=)/g, "==")
                .replace(/\bTRUE\b/gi, "true")
                .replace(/\bFALSE\b/gi, "false")
                .replace(/\b([A-Za-z_][A-Za-z0-9_.]*)\s*(?=\()/g, (_, fn) => fn.toUpperCase().replace(/\./g, "_"));

            // ROW() / COLUMN() の座標解決（セル参照の値展開より先に処理）
            expr = expr
                .replace(/\bROW\s*\(\s*\)/g, () => String(evalCoord?.row ?? 1))
                .replace(/\bCOLUMN\s*\(\s*\)/g, () => String((evalCoord?.col ?? 0) + 1))
                .replace(/\bROW\s*\(\s*(?:(?:'[^']+'|[A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+)!)?\$?[A-Za-z]+\$?(\d+)(?::\$?[A-Za-z]+\$?\d+)?\s*\)/g, (_, r) => String(parseInt(r, 10)))
                .replace(/\bCOLUMN\s*\(\s*(?:(?:'[^']+'|[A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+)!)?\$?([A-Za-z]+)\$?\d+(?::\$?[A-Za-z]+\$?\d+)?\s*\)/g, (_, colL) => String(columnLettersToIndex(colL) + 1));

            // OFFSET の第1引数がセル/範囲参照の場合、値展開される前に座標オブジェクト __XL_REF(...) へ変換
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
                            const sIdx = sName ? sheets.findIndex(s => s.name === sName) : contextSheetIdx;
                            const c1 = columnLettersToIndex(refMatch[3]);
                            const r1 = parseInt(refMatch[4], 10);
                            const c2 = refMatch[5] ? columnLettersToIndex(refMatch[5]) : c1;
                            const r2 = refMatch[6] ? parseInt(refMatch[6], 10) : r1;
                            const minR = Math.min(r1, r2), maxR = Math.max(r1, r2);
                            const minC = Math.min(c1, c2), maxC = Math.max(c1, c2);
                            out += `OFFSET(__XL_REF(${sIdx},${minR},${minC},${maxR},${maxC})${rewriteOffsetFirstArg(tail)}`;
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

            // 他シート範囲参照（例: Sheet2!A1:C5 / '売上表'!A1:C5）
            expr = expr.replace(CROSS_SHEET_RANGE_REGEX, (_, qName, plainName, sRef, eRef) => {
                const sName = qName ?? plainName;
                const sIdx = sheets.findIndex(s => s.name === sName);
                if (sIdx === -1) return `[[${toJSValueLiteral("#REF!", false, stringLiterals)}]]`;
                return buildRange2DLiteral(sIdx, sRef, eRef, visited, "none", stringLiterals);
            });

            // 他シート単一セル参照（例: Sheet2!B3）
            expr = expr.replace(CROSS_SHEET_CELL_REGEX, (_, qName, plainName, cellRef) => {
                const sName = qName ?? plainName;
                const sIdx = sheets.findIndex(s => s.name === sName);
                if (sIdx === -1) return toJSValueLiteral("#REF!", false, stringLiterals);
                const m = cellRef.match(/^\$?([A-Za-z]+)\$?(\d+)$/);
                if (!m) return toJSValueLiteral("#REF!", false, stringLiterals);
                const val = getSheetCellValue(sIdx, parseInt(m[2], 10), columnLettersToIndex(m[1]), visited);
                return toJSValueLiteral(val, true, stringLiterals);
            });

            // 自シート範囲参照：SUBTOTAL(1-11:フィルター除外 / 101-111:全非表示除外)・AGGREGATEオプションを厳密判定
            const getSubtotalHiddenMode = (src, offset) => {
                let depth = 0;
                for (let i = offset - 1; i >= 0; i--) {
                    const ch = src[i];
                    if (ch === ")") depth++;
                    else if (ch === "(") {
                        if (depth === 0) {
                            const before = src.slice(Math.max(0, i - 16), i);
                            const fnMatch = before.match(/\b(SUBTOTAL|AGGREGATE)\s*$/i);
                            if (!fnMatch) return "none";
                            const fnName = fnMatch[1].toUpperCase();
                            const afterOpen = src.slice(i + 1, offset);
                            if (fnName === "SUBTOTAL") {
                                const m = afterOpen.match(/^\s*(\d+)\s*,/);
                                const code = m ? Number(m[1]) : 9;
                                return code >= 101 ? "all" : "filterOnly";
                            }
                            const aggMatch = afterOpen.match(/^\s*\d+\s*,\s*(\d+)\s*,/);
                            const opt = aggMatch ? Number(aggMatch[1]) : 5;
                            return [1, 3, 5, 7].includes(opt) ? "all" : "filterOnly";
                        }
                        depth--;
                    }
                }
                return "none";
            };
            expr = expr.replace(RANGE_REF_REGEX, (match, _g1, offset, fullStr) => {
                const [startRef, endRef] = match.split(":");
                const hiddenMode = getSubtotalHiddenMode(fullStr, offset);
                return buildRange2DLiteral(contextSheetIdx, startRef, endRef, visited, hiddenMode, stringLiterals);
            });

            // 自シート単一セル参照
            expr = expr.replace(SINGLE_REF_REGEX, (_, _absC, colLetters, _absR, rowStr) => {
                const colIndex = columnLettersToIndex(colLetters);
                const rowNumber = parseInt(rowStr, 10);
                const val = getSheetCellValue(contextSheetIdx, rowNumber, colIndex, visited);
                return toJSValueLiteral(val, true, stringLiterals);
            });

            // 配列同士・配列とスカラーの四則/比較/単項演算を要素ごと演算 (__XL_OP / __XL_U) に書き換え
            const rewriteArrayOps = (src) => {
                const tokens = [];
                const tokenRe = /\s*(?:(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)|([A-Za-z_$][A-Za-z0-9_$]*)|("(?:\\.|[^"\\])*")|(\*\*|<=|>=|==|!=|[()[\],+\-*/%<>!]))/y;
                let lastIdx = 0;
                while (lastIdx < src.length) {
                    const restWs = src.slice(lastIdx).match(/^\s+$/);
                    if (restWs) break;
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
                    if (!tok) {
                        failed = true;
                        return "";
                    }
                    let node = "";
                    if (tok.type === "num" || tok.type === "id" || tok.type === "str") {
                        node = consume().val;
                    } else if (tok.type === "op" && tok.val === "(") {
                        consume();
                        const inner = parseExpr();
                        if (!peek() || peek().val !== ")") {
                            failed = true;
                            return "";
                        }
                        consume();
                        node = `(${inner})`;
                    } else if (tok.type === "op" && tok.val === "[") {
                        consume();
                        const elems = [];
                        if (peek() && peek().val !== "]") {
                            while (true) {
                                elems.push(parseExpr());
                                if (peek() && peek().val === ",") {
                                    consume();
                                    continue;
                                }
                                break;
                            }
                        }
                        if (!peek() || peek().val !== "]") {
                            failed = true;
                            return "";
                        }
                        consume();
                        node = `[${elems.join(",")}]`;
                    } else {
                        failed = true;
                        return "";
                    }

                    // 関数呼び出し（LAMBDA(...)(10, 25) のような連続呼び出しにも対応）
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
                                if (peek() && peek().val === ",") {
                                    consume();
                                    continue;
                                }
                                break;
                            }
                        }
                        if (!peek() || peek().val !== ")") {
                            failed = true;
                            return "";
                        }
                        consume();
                        node = `${node}(${args.join(",")})`;
                    }

                    // 後置パーセント演算子（数値・セル・ネスト括弧・関数結果・配列すべてに対応）
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

            // LET / LAMBDA を安全なネスト式へ展開（Excel準拠：変数名の大文字小文字非区別）
            const BUILTIN_FN_SET = new Set(["INDIRECT", "OFFSET", ...FORMULA_FN_NAMES]);
            const splitTopLevelArgs = (inner) => {
                const args = [];
                let buf = "";
                let depth = 0;
                let sqDepth = 0;
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
                    if (after.startsWith("(") && BUILTIN_FN_SET.has(m.toUpperCase())) {
                        return m;
                    }
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
                            // LAMBDA(param1, [param2, ...], calculation)
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
                        out += src[i];
                        i++;
                    }
                }
                return out;
            };

            if (/\b(LET|LAMBDA)\s*\(/.test(expr)) {
                expr = transformLetAndLambda(expr);
            }

            // 文字列リテラル復元前に、許可された識別子のみであることを検証（任意JS実行防止 & #NAME? 判定）
            const ALLOWED_IDENTIFIERS = new Set([
                "EXCEL_BLANK_CELL", "__XL_EQ", "__XL_OP", "__XL_U", "__XL_REF",
                "INDIRECT", "OFFSET", "true", "false", "undefined", ...FORMULA_FN_NAMES
            ]);
            const unsafeIdentMatch = expr.match(/\b[A-Za-z_$][A-Za-z0-9_$]*\b/g);
            if (unsafeIdentMatch) {
                for (const ident of unsafeIdentMatch) {
                    if (/^__STR_LIT_\d+__$/.test(ident) || /^__LV_[A-Z0-9_]+$/.test(ident)) continue;
                    if (!ALLOWED_IDENTIFIERS.has(ident)) {
                        return "#NAME?";
                    }
                }
            }

            expr = expr.replace(/__STR_LIT_(\d+)__/g, (_, idx) => stringLiterals[Number(idx)]);

            const makeXlRef = (sheetIdx, r1, c1, r2, c2) => ({ __isXlRef: true, sheetIdx, r1, c1, r2, c2 });

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
                const targetSIdx = sName ? sheets.findIndex(s => s.name === sName) : contextSheetIdx;
                if (targetSIdx < 0 || !sheets[targetSIdx]) return "#REF!";

                const body = sheetSplit[3].trim();
                let maxR = getRowCount() - 1;
                let maxC = getCurrentColumns() - 1;
                if (targetSIdx !== activeSheetIndex && Array.isArray(sheets[targetSIdx]?.cells)) {
                    for (const item of sheets[targetSIdx].cells) {
                        const ir = Number(item.r) || 0;
                        const ic = Number(item.c) || 0;
                        if (ir > maxR) maxR = ir;
                        if (ic > maxC) maxC = ic;
                    }
                }

                const buildMat = (r1, c1, r2, c2) => {
                    const rs = Math.min(r1, r2), re = Math.min(Math.max(r1, r2), maxR);
                    const cs = Math.min(c1, c2), ce = Math.min(Math.max(c1, c2), maxC);
                    const mat = [];
                    for (let r = rs; r <= re; r++) {
                        const rowVals = [];
                        for (let c = cs; c <= ce; c++) {
                            rowVals.push(getSheetCellValue(targetSIdx, r, c, visited));
                        }
                        mat.push(rowVals);
                    }
                    return mat;
                };

                const rangeM = body.match(/^\$?([A-Za-z]+)\$?(\d+):\$?([A-Za-z]+)\$?(\d+)$/);
                if (rangeM) {
                    return buildMat(
                        parseInt(rangeM[2], 10),
                        columnLettersToIndex(rangeM[1]),
                        parseInt(rangeM[4], 10),
                        columnLettersToIndex(rangeM[3])
                    );
                }

                const colRangeM = body.match(/^\$?([A-Za-z]+):\$?([A-Za-z]+)$/);
                if (colRangeM) {
                    return buildMat(1, columnLettersToIndex(colRangeM[1]), maxR, columnLettersToIndex(colRangeM[2]));
                }

                const rowRangeM = body.match(/^\$?(\d+):\$?(\d+)$/);
                if (rowRangeM) {
                    return buildMat(parseInt(rowRangeM[1], 10), 0, parseInt(rowRangeM[2], 10), maxC);
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
                const out = [];
                for (let r = rStart; r <= rEnd; r++) {
                    const rowVals = [];
                    for (let c = cStart; c <= cEnd; c++) {
                        rowVals.push(getSheetCellValue(refObj.sheetIdx, r, c, visited));
                    }
                    out.push(rowVals);
                }
                return out;
            };

            let evaluator = compiledFormulaCache.get(expr);
            if (!evaluator) {
                evaluator = new Function(
                    "EXCEL_BLANK_CELL",
                    "__XL_EQ",
                    "__XL_OP",
                    "__XL_U",
                    "__XL_REF",
                    "INDIRECT",
                    "OFFSET",
                    ...FORMULA_FN_NAMES,
                    `"use strict"; return (${expr});`
                );
                if (compiledFormulaCache.size > 2000) compiledFormulaCache.clear();
                compiledFormulaCache.set(expr, evaluator);
            }
            const rawEval = evaluator(
                EXCEL_BLANK_CELL,
                (a, b) => excelBinaryOp("==", a, b),
                excelBinaryOp,
                excelUnaryOp,
                makeXlRef,
                runtimeIndirect,
                runtimeOffset,
                ...FORMULA_FN_VALUES
            );
            let result = unwrapBlank(rawEval);
            if (typeof result === "number") {
                if (Number.isNaN(result)) return "#VALUE!";
                if (!Number.isFinite(result)) return "#DIV/0!";
                // Excel準拠：15桁有効数字で浮動小数点誤差（例: 1650.0000000000002 → 1650）を正規化
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

            const singleRefMatch = formula.trim().match(/^=(?:(?:'([^']+)'|([A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+))!)?\$?([A-Za-z]+)\$?(\d+)$/);
            let isDirectDateRef = false;
            if (singleRefMatch) {
                const refSheetName = singleRefMatch[1] ?? singleRefMatch[2];
                const targetSIdx = refSheetName ? sheets.findIndex(s => s.name === refSheetName) : contextSheetIdx;
                isDirectDateRef = isDateCellAt(targetSIdx, parseInt(singleRefMatch[4], 10), columnLettersToIndex(singleRefMatch[3]));
            }

            // 加減算結果が日付シリアル範囲のときは、実際に日付セルを参照している場合のみ日付化
            let hasDateCellRef = isDirectDateRef;
            if (!hasDateCellRef && typeof result === "number" && result >= 36526 && result <= 73050 && /[+-]/.test(expr)) {
                const stripped = formula.substring(1).replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'(?!\s*!)/g, "");
                const allRefRegex = /(?:(?:'([^']+)'|([A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+))!)?(?<![A-Za-z0-9_])\$?([A-Za-z]+)\$?(\d+)(?!\s*\()/g;
                let m;
                while ((m = allRefRegex.exec(stripped)) !== null) {
                    const sName = m[1] ?? m[2];
                    const sIdx = sName ? sheets.findIndex(s => s.name === sName) : contextSheetIdx;
                    if (sIdx >= 0 && isDateCellAt(sIdx, parseInt(m[4], 10), columnLettersToIndex(m[3]))) {
                        hasDateCellRef = true;
                        break;
                    }
                }
            }

            const returnsNumericDateInfo = /^\s*=\s*(YEAR|MONTH|DAY|HOUR|MINUTE|SECOND|WEEKDAY|DAYS|DATEDIF|NETWORKDAYS|DATEVALUE|TIMEVALUE)\s*\(/i.test(formula);
            const hasDateFunc = !returnsNumericDateInfo && /\b(TODAY|NOW|DATE|EDATE|EOMONTH|WORKDAY)\s*\(/i.test(formula);
            const hasDateOp = isDirectDateRef || hasDateFunc || hasDateCellRef;
            if (hasDateOp && typeof result === "number" && isFinite(result)) {
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

    function extractLocalFormulaDependencies(formula) {
        const deps = new Set();
        if (!formula || formula[0] !== "=") return deps;

        // 文字列リテラルと他シート参照（Sheet2!A1等）を除外して自シート参照のみ抽出
        const cleaned = formula
            .substring(1)
            .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'(?!\s*!)/g, "")
            .replace(/(?:'[^']+'|[A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+)!\$?[A-Za-z]+\$?\d+(?::\$?[A-Za-z]+\$?\d+)?/g, "");

        // 範囲参照（A1:B5）の展開
        const withoutRanges = cleaned.replace(RANGE_REF_REGEX, (match) => {
            const [sRef, eRef] = match.split(":");
            const s = parseCellReference(sRef.toUpperCase());
            const e = parseCellReference(eRef.toUpperCase());
            if (s && e) {
                const r0 = Math.min(s.row, e.row), r1 = Math.max(s.row, e.row);
                const c0 = Math.min(s.col, e.col), c1 = Math.max(s.col, e.col);
                if ((r1 - r0 + 1) * (c1 - c0 + 1) <= 2000) {
                    for (let r = r0; r <= r1; r++) {
                        for (let c = c0; c <= c1; c++) {
                            deps.add(`${r},${c}`);
                        }
                    }
                }
            }
            return " ";
        });

        // 単一セル参照（A1）の抽出
        withoutRanges.replace(SINGLE_REF_REGEX, (_, _absC, colLetters, _absR, rowStr) => {
            deps.add(`${parseInt(rowStr, 10)},${columnLettersToIndex(colLetters)}`);
            return "";
        });

        return deps;
    }

    function sortFormulaCellsTopologically(formulaCells) {
        const cellMap = new Map();
        for (const cell of formulaCells) {
            cellMap.set(`${cell.dataset.row},${cell.dataset.col}`, cell);
        }

        const visited = new Set();
        const visiting = new Set();
        const sorted = [];

        const visit = (key) => {
            if (visited.has(key) || visiting.has(key)) return;
            const cell = cellMap.get(key);
            if (!cell) return;

            visiting.add(key);
            const deps = extractLocalFormulaDependencies(cell.dataset.formula);
            for (const depKey of deps) {
                if (cellMap.has(depKey)) {
                    visit(depKey);
                }
            }
            visiting.delete(key);
            visited.add(key);
            sorted.push(cell);
        };

        // 静的依存先を先に評価し、INDIRECT/OFFSET/構造化参照など動的参照を含む数式を後段で評価
        const staticKeys = [];
        const dynamicKeys = [];
        for (const [key, cell] of cellMap.entries()) {
            const f = cell.dataset.formula || "";
            if (/\b(INDIRECT|OFFSET)\s*\(/i.test(f) || f.includes("[")) {
                dynamicKeys.push(key);
            } else {
                staticKeys.push(key);
            }
        }
        for (const key of staticKeys) visit(key);
        for (const key of dynamicKeys) visit(key);
        return sorted;
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

    function updateAllFormulas() {
        formulaEvalCache.clear();
        isBatchRecalculating = true;
        const activeSheetIndex = getActiveSheetIndex();
        try {
            const rawFormulaCells = Array.from(tbody.querySelectorAll("td[data-formula]"));
            const orderedCells = sortFormulaCellsTopologically(rawFormulaCells);

            orderedCells.forEach(cell => {
                if (isCellEditing(cell)) return;
                const r = parseInt(cell.dataset.row, 10);
                const c = parseInt(cell.dataset.col, 10);
                clearSpillCellsFromAnchor(r, c);

                const cellKey = `${activeSheetIndex}:${r},${c}`;
                const visited = new Set([cellKey]);
                const rawResult = evaluateFormula(cell.dataset.formula, visited, activeSheetIndex, { row: r, col: c });

                if (Array.isArray(rawResult)) {
                    const topVal = applySpillMatrix(cell, r, c, rawResult);
                    formulaEvalCache.set(cellKey, topVal);
                } else {
                    const dateSerial = tryParseDateToSerial(rawResult);
                    const cachedVal = dateSerial !== null
                        ? dateSerial
                        : ((rawResult !== "" && !isNaN(Number(rawResult))) ? Number(rawResult) : rawResult);
                    formulaEvalCache.set(cellKey, cachedVal);
                    setCellFormattedValue(cell, rawResult);
                }
            });

            recalculateBackgroundSheets();
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
        getBackgroundSheetCellMap,
        getSheetCellValue,
        getCellEvaluatedValue,
        evaluateFormula,
        clearSpillCellsFromAnchor,
        recalculateBackgroundSheets,
        updateAllFormulas
    };
}