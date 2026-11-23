// conditional-format.js
// 条件付き書式（プリセット定義・ルール判定・適用エンジン・設定/管理モーダル）

import { parseExcelDate, buildConditionMatcher } from "./formula-functions.js";
import { escapeHtml, getColumnName, parseFormattedNumber } from "./format-utils.js";

export const EXCEL_CF_PRESET_STYLES = {
    redFillDarkRedText: { label: "濃い赤の文字、明るい赤の背景", bgColor: "#ffc7ce", textColor: "#9c0006", bold: false, italic: false, borderColor: "" },
    yellowFillDarkYellowText: { label: "濃い黄色の文字、濃い黄色の背景", bgColor: "#ffeb9c", textColor: "#9c6500", bold: false, italic: false, borderColor: "" },
    greenFillDarkGreenText: { label: "濃い緑の文字、緑の背景", bgColor: "#c6efce", textColor: "#006100", bold: false, italic: false, borderColor: "" },
    lightRedFill: { label: "明るい赤の背景", bgColor: "#ffc7ce", textColor: "", bold: false, italic: false, borderColor: "" },
    redText: { label: "赤の文字", bgColor: "", textColor: "#ff0000", bold: false, italic: false, borderColor: "" },
    redBorder: { label: "赤の枠線", bgColor: "", textColor: "", bold: false, italic: false, borderColor: "#ff0000" }
};

export function describeConditionalRule(rule) {
    const opLabels = {
        ">": `セルの値 > ${rule.val1}`,
        ">=": `セルの値 >= ${rule.val1}`,
        "<": `セルの値 < ${rule.val1}`,
        "<=": `セルの値 <= ${rule.val1}`,
        "=": `セルの値 = ${rule.val1}`,
        "<>": `セルの値 <> ${rule.val1}`,
        "between": `セルの値: ${rule.val1} 〜 ${rule.val2}`,
        "notBetween": `セルの値: ${rule.val1} 〜 ${rule.val2} の範囲外`,
        "contains": `指定の文字列を含む: "${rule.val1}"`,
        "notContains": `指定の文字列を含まない: "${rule.val1}"`,
        "blank": "空白セル",
        "notBlank": "空白以外のセル",
        "error": "エラー値",
        "notError": "エラー値以外",
        "duplicate": "重複する値",
        "unique": "一意の値",
        "topN": `上位 ${rule.rank || 10} 項目`,
        "topPercent": `上位 ${rule.rank || 10} %`,
        "bottomN": `下位 ${rule.rank || 10} 項目`,
        "bottomPercent": `下位 ${rule.rank || 10} %`,
        "aboveAvg": "平均より上",
        "belowAvg": "平均より下",
        "aboveEqAvg": "平均以上",
        "belowEqAvg": "平均以下",
        "formula": `数式: ${rule.formula || ""}`,
        "databar": "データ バー",
        "colorscale": "カラー スケール",
        "iconset": "アイコン セット",
        "date": `日付 (${rule.datePeriod || "today"})`
    };
    return rule.label || opLabels[rule.op] || rule.condition || rule.op;
}

export function matchDatePeriod(rawVal, period) {
    const d = parseExcelDate(rawVal);
    if (!d) return false;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diffDays = Math.round((target - today) / 86400000);
    if (period === "yesterday") return diffDays === -1;
    if (period === "today") return diffDays === 0;
    if (period === "tomorrow") return diffDays === 1;
    if (period === "last7days") return diffDays >= -6 && diffDays <= 0;
    if (period === "lastMonth") {
        const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return d.getFullYear() === lm.getFullYear() && d.getMonth() === lm.getMonth();
    }
    if (period === "thisMonth") {
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    if (period === "nextMonth") {
        const nm = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return d.getFullYear() === nm.getFullYear() && d.getMonth() === nm.getMonth();
    }
    return false;
}

export function clearAppliedConditionalStyle(td) {
    if (!td || !td.dataset.cfApplied) return;
    td.style.backgroundColor = td.dataset.cfOrigBg || "";
    td.style.backgroundImage = td.dataset.cfOrigBgImg || "";
    td.style.color = td.dataset.cfOrigColor || "";
    td.style.fontWeight = td.dataset.cfOrigWeight || "";
    td.style.fontStyle = td.dataset.cfOrigItalic || "";
    td.style.textDecoration = td.dataset.cfOrigDeco || "";
    td.style.outline = td.dataset.cfOrigOutline || "";
    td.style.outlineOffset = td.dataset.cfOrigOutlineOffset || "";

    delete td.dataset.cfOrigBg;
    delete td.dataset.cfOrigBgImg;
    delete td.dataset.cfOrigColor;
    delete td.dataset.cfOrigWeight;
    delete td.dataset.cfOrigItalic;
    delete td.dataset.cfOrigDeco;
    delete td.dataset.cfOrigOutline;
    delete td.dataset.cfOrigOutlineOffset;
    delete td.dataset.cfApplied;
}

export function createConditionalFormattingModule(ctx) {
    const {
        tbody,
        win,
        windowAPI,
        getActiveSheet,
        getActiveSheetIndex,
        getCurrentColumns,
        peekCell,
        getCellPureText,
        adjustFormula,
        evaluateFormula,
        getSelectedRangeBounds,
        syncCellGridlinesForCells,
        openAppModal,
        openSheetRangePicker,
        parseRangeReference,
        parseCellReference,
        setDirtyState,
        debouncedSaveState
    } = ctx;

    function matchConditionalRule(rule, rawVal, valueCountMap = null, cellRow = 1, cellCol = 0) {
        const str = String(rawVal ?? "").trim();
        const op = rule.op || "expr";

        // セル参照や数式（例: =$E$1）が条件値に入っている場合、Excel同様に評価して比較値を得る
        const resolveOperand = (rawOp) => {
            const s = String(rawOp ?? "").trim();
            if (!s.startsWith("=")) return s;
            const shifted = adjustFormula(s, cellRow - rule.minRow, cellCol - rule.minCol);
            const evaluated = evaluateFormula(shifted, new Set(), getActiveSheetIndex(), { row: cellRow, col: cellCol });
            return Array.isArray(evaluated) ? String(evaluated[0]?.[0] ?? "") : String(evaluated ?? "");
        };

        const resolvedVal1 = resolveOperand(rule.val1);
        const resolvedVal2 = resolveOperand(rule.val2);

        if (op === "expr") return buildConditionMatcher(rule.condition)(rawVal);
        if (op === "blank") return str === "";
        if (op === "notBlank") return str !== "";
        if (op === "error") return /^#(ERROR!|DIV\/0!|N\/A|VALUE!|CIRCULAR!|REF!|NAME\?|NUM!|CALC!|SPILL!)$/.test(str);
        if (op === "notError") return !/^#(ERROR!|DIV\/0!|N\/A|VALUE!|CIRCULAR!|REF!|NAME\?|NUM!|CALC!|SPILL!)$/.test(str);
        if (op === "contains") return str !== "" && resolvedVal1 !== "" && str.toLowerCase().includes(resolvedVal1.toLowerCase());
        if (op === "notContains") return resolvedVal1 !== "" && !str.toLowerCase().includes(resolvedVal1.toLowerCase());
        if (op === "duplicate") return str !== "" && (valueCountMap?.get(str) || 0) > 1;
        if (op === "unique") return str !== "" && (valueCountMap?.get(str) || 0) === 1;
        if (op === "date") return matchDatePeriod(str, rule.datePeriod || "today");
        if (op === "formula") {
            if (!rule.formula) return false;
            const f = rule.formula.trim().startsWith("=") ? rule.formula.trim() : `=${rule.formula.trim()}`;
            const shifted = adjustFormula(f, cellRow - rule.minRow, cellCol - rule.minCol);
            const res = evaluateFormula(shifted, new Set(), getActiveSheetIndex(), { row: cellRow, col: cellCol });
            if (typeof res === "boolean") return res;
            if (typeof res === "number") return res !== 0;
            return String(res ?? "").trim().toUpperCase() === "TRUE";
        }

        // 空白セルや未入力条件に対する誤一致を防止
        if (str === "" || resolvedVal1 === "") return false;

        // 数値比較（カンマ・¥・%付きも正しく数値として評価）
        const num = parseFormattedNumber(str);
        const v1 = parseFormattedNumber(resolvedVal1);
        const v2 = parseFormattedNumber(resolvedVal2);
        if (!isNaN(num) && !isNaN(v1)) {
            if (op === "between") return !isNaN(v2) && num >= Math.min(v1, v2) && num <= Math.max(v1, v2);
            if (op === "notBetween") return !isNaN(v2) && (num < Math.min(v1, v2) || num > Math.max(v1, v2));
            if (op === ">") return num > v1;
            if (op === ">=") return num >= v1;
            if (op === "<") return num < v1;
            if (op === "<=") return num <= v1;
            if (op === "=") return num === v1;
            if (op === "<>") return num !== v1;
        }

        // 日付比較（2026/11/20 など）
        const dCell = parseExcelDate(str);
        const d1 = parseExcelDate(resolvedVal1);
        const d2 = parseExcelDate(resolvedVal2);
        if (dCell && d1) {
            const t = dCell.getTime(), t1 = d1.getTime(), t2 = d2 ? d2.getTime() : NaN;
            if (op === "between") return !isNaN(t2) && t >= Math.min(t1, t2) && t <= Math.max(t1, t2);
            if (op === "notBetween") return !isNaN(t2) && (t < Math.min(t1, t2) || t > Math.max(t1, t2));
            if (op === ">") return t > t1;
            if (op === ">=") return t >= t1;
            if (op === "<") return t < t1;
            if (op === "<=") return t <= t1;
            if (op === "=") return t === t1;
            if (op === "<>") return t !== t1;
        }

        // 文字列フォールバック
        if (op === "between" || op === "notBetween") return false;
        return buildConditionMatcher(`${op}${resolvedVal1}`)(str);
    }

    // 前回適用したセルのみを保持し、リセット時の tbody 全走査（querySelectorAll）を廃止
    const appliedCfCells = new Set();
    const appliedCfIconCells = new Set();

    function resetConditionalFormatCache() {
        appliedCfCells.clear();
        appliedCfIconCells.clear();
    }

    const CF_ICON_SETS = {
        arrows3: [
            { char: "▼", color: "#d13438" },
            { char: "▶", color: "#e39c00" },
            { char: "▲", color: "#107c41" }
        ],
        traffic3: [
            { char: "●", color: "#d13438" },
            { char: "●", color: "#e39c00" },
            { char: "●", color: "#107c41" }
        ],
        signs3: [
            { char: "✖", color: "#d13438" },
            { char: "❗", color: "#e39c00" },
            { char: "✔", color: "#107c41" }
        ],
        stars3: [
            { char: "☆", color: "#b8860b" },
            { char: "⯪", color: "#daa520" },
            { char: "★", color: "#daa520" }
        ]
    };

    const CF_NEEDS_NUMERIC_STATS = new Set([
        "databar", "colorscale", "iconset",
        "topN", "topPercent", "bottomN", "bottomPercent",
        "aboveAvg", "belowAvg", "aboveEqAvg", "belowEqAvg"
    ]);
    const CF_NEEDS_RANK_SORT = new Set(["topN", "topPercent", "bottomN", "bottomPercent"]);
    const CF_NEEDS_VALUE_COUNT = new Set(["duplicate", "unique"]);

    function ruleHasExternalFormula(rule) {
        if (!rule) return false;
        if (rule.op === "formula") return true;
        if (typeof rule.val1 === "string" && rule.val1.trim().startsWith("=")) return true;
        if (typeof rule.val2 === "string" && rule.val2.trim().startsWith("=")) return true;
        return false;
    }

    function rulesOverlap(a, b) {
        return !(a.maxRow < b.minRow || a.minRow > b.maxRow || a.maxCol < b.minCol || a.minCol > b.maxCol);
    }

    function applyConditionalFormats(dirtyCoords = null) {
        const rules = getActiveSheet()?.conditionalFormats || [];
        const gridlineTouchedCells = new Set();

        // ルール0件時のみ既存適用を完全クリアして終了
        if (!rules.length) {
            if (appliedCfIconCells.size > 0) {
                appliedCfIconCells.forEach(td => {
                    delete td.dataset.cfIcon;
                    td.style.removeProperty("--cf-icon-color");
                });
                appliedCfIconCells.clear();
            }
            if (appliedCfCells.size > 0) {
                appliedCfCells.forEach(td => {
                    clearAppliedConditionalStyle(td);
                    gridlineTouchedCells.add(td);
                });
                appliedCfCells.clear();
            }
            if (gridlineTouchedCells.size > 0) {
                syncCellGridlinesForCells?.(gridlineTouchedCells);
            }
            return;
        }

        // 差分更新モード：変更座標の影響を受けるルール群（重なり連鎖含む）だけを特定
        let targetRules = rules;
        if (Array.isArray(dirtyCoords)) {
            if (dirtyCoords.length === 0) return;

            const affectedIndices = new Set();
            for (let i = 0; i < rules.length; i++) {
                const rule = rules[i];
                if (ruleHasExternalFormula(rule)) {
                    affectedIndices.add(i);
                    continue;
                }
                for (let j = 0; j < dirtyCoords.length; j++) {
                    const p = dirtyCoords[j];
                    if (p.row >= rule.minRow && p.row <= rule.maxRow && p.col >= rule.minCol && p.col <= rule.maxCol) {
                        affectedIndices.add(i);
                        break;
                    }
                }
            }

            // どのルールにも影響しないセルの編集なら DOM に一切触れず即終了
            if (affectedIndices.size === 0) return;

            // 優先順位・stopIfTrue 整合性のため、対象ルールと範囲が重なるルールを閉包展開
            let expanded = true;
            while (expanded && affectedIndices.size < rules.length) {
                expanded = false;
                for (let i = 0; i < rules.length; i++) {
                    if (affectedIndices.has(i)) continue;
                    for (const idx of affectedIndices) {
                        if (rulesOverlap(rules[i], rules[idx])) {
                            affectedIndices.add(i);
                            expanded = true;
                            break;
                        }
                    }
                }
            }

            if (affectedIndices.size < rules.length) {
                targetRules = rules.filter((_, idx) => affectedIndices.has(idx));
            }
        }

        const isPartialUpdate = targetRules.length < rules.length;
        const isCellInTargetRules = (td) => {
            const r = parseInt(td.dataset.row, 10);
            const c = parseInt(td.dataset.col, 10);
            for (let i = 0; i < targetRules.length; i++) {
                const rule = targetRules[i];
                if (r >= rule.minRow && r <= rule.maxRow && c >= rule.minCol && c <= rule.maxCol) {
                    return true;
                }
            }
            return false;
        };

        // 対象ルール群の適用セルのみリセット（部分更新時は無関係なルールのセルを温存）
        if (appliedCfIconCells.size > 0) {
            if (!isPartialUpdate) {
                appliedCfIconCells.forEach(td => {
                    delete td.dataset.cfIcon;
                    td.style.removeProperty("--cf-icon-color");
                });
                appliedCfIconCells.clear();
            } else {
                appliedCfIconCells.forEach(td => {
                    if (!td.isConnected || isCellInTargetRules(td)) {
                        delete td.dataset.cfIcon;
                        td.style.removeProperty("--cf-icon-color");
                        appliedCfIconCells.delete(td);
                    }
                });
            }
        }
        if (appliedCfCells.size > 0) {
            if (!isPartialUpdate) {
                appliedCfCells.forEach(td => {
                    clearAppliedConditionalStyle(td);
                    gridlineTouchedCells.add(td);
                });
                appliedCfCells.clear();
            } else {
                appliedCfCells.forEach(td => {
                    if (!td.isConnected || isCellInTargetRules(td)) {
                        clearAppliedConditionalStyle(td);
                        if (td.isConnected) gridlineTouchedCells.add(td);
                        appliedCfCells.delete(td);
                    }
                });
            }
        }

        const stoppedCells = new Set();
        // Excel準拠：上位ルールが設定済みのスタイル属性は下位ルールで上書きしない
        const lockedPropsByCell = new Map();
        const getLockedSet = (cellKey) => {
            let s = lockedPropsByCell.get(cellKey);
            if (!s) {
                s = new Set();
                lockedPropsByCell.set(cellKey, s);
            }
            return s;
        };

        const saveOrig = (td) => {
            if (!td.dataset.cfApplied) {
                td.dataset.cfOrigBg = td.style.backgroundColor || "";
                td.dataset.cfOrigBgImg = td.style.backgroundImage || "";
                td.dataset.cfOrigColor = td.style.color || "";
                td.dataset.cfOrigWeight = td.style.fontWeight || "";
                td.dataset.cfOrigItalic = td.style.fontStyle || "";
                td.dataset.cfOrigDeco = td.style.textDecoration || "";
                td.dataset.cfOrigOutline = td.style.outline || "";
                td.dataset.cfOrigOutlineOffset = td.style.outlineOffset || "";
                td.dataset.cfApplied = "1";
                appliedCfCells.add(td);
            }
        };

        const totalRows = tbody.rows.length;
        const maxColIdx = getCurrentColumns() - 1;

        for (const rule of targetRules) {
            const ruleOp = String(rule.op || "expr");
            const maxExistingRow = Math.min(rule.maxRow, totalRows);
            const maxExistingCol = Math.min(rule.maxCol, maxColIdx);
            if (maxExistingRow < rule.minRow || maxExistingCol < rule.minCol) continue;

            const needsNumStats = CF_NEEDS_NUMERIC_STATS.has(ruleOp);
            const needsRankSort = CF_NEEDS_RANK_SORT.has(ruleOp);
            const needsValCount = CF_NEEDS_VALUE_COUNT.has(ruleOp);

            let minNum = 0;
            let maxNum = 1;
            let avgNum = 0;
            let topCut = Infinity;
            let bottomCut = -Infinity;
            let valueCountMap = null;

            // 統計・重複カウントが必要なルールだけ事前走査（通常の数値比較・文字列・数式ルールは事前走査0回）
            if (needsNumStats || needsValCount) {
                const rangeNums = needsNumStats ? [] : null;
                if (needsValCount) valueCountMap = new Map();

                for (let r = rule.minRow; r <= maxExistingRow; r++) {
                    for (let c = rule.minCol; c <= maxExistingCol; c++) {
                        const rawTd = peekCell(r, c);
                        if (!rawTd || rawTd.style.display === "none") continue;
                        const rawStr = getCellPureText(rawTd).trim();
                        if (needsValCount && rawStr !== "") {
                            valueCountMap.set(rawStr, (valueCountMap.get(rawStr) || 0) + 1);
                        }
                        if (needsNumStats) {
                            const v = parseFormattedNumber(rawStr);
                            if (!isNaN(v)) rangeNums.push(v);
                        }
                    }
                }

                if (needsNumStats && rangeNums.length > 0) {
                    minNum = Infinity;
                    maxNum = -Infinity;
                    let sumNum = 0;
                    for (let i = 0; i < rangeNums.length; i++) {
                        const v = rangeNums[i];
                        if (v < minNum) minNum = v;
                        if (v > maxNum) maxNum = v;
                        sumNum += v;
                    }
                    avgNum = sumNum / rangeNums.length;

                    if (needsRankSort) {
                        // ソートは昇順1回だけ行い、上位・下位どちらもインデックス計算で取得
                        rangeNums.sort((a, b) => a - b);
                        const rankVal = Math.max(1, Number(rule.rank) || 10);
                        const nCount = ruleOp.endsWith("Percent")
                            ? Math.max(1, Math.floor((rangeNums.length * rankVal) / 100))
                            : rankVal;
                        const clampedN = Math.min(rangeNums.length, nCount);
                        bottomCut = rangeNums[clampedN - 1] ?? -Infinity;
                        topCut = rangeNums[rangeNums.length - clampedN] ?? Infinity;
                    }
                }
            }

            for (let r = rule.minRow; r <= maxExistingRow; r++) {
                for (let c = rule.minCol; c <= maxExistingCol; c++) {
                    const cellKey = `${r},${c}`;
                    if (stoppedCells.has(cellKey)) continue;
                    const td = peekCell(r, c);
                    if (!td || td.style.display === "none") continue;
                    const rawVal = getCellPureText(td);
                    const num = needsNumStats ? parseFormattedNumber(rawVal) : NaN;

                    if (ruleOp === "databar" && !isNaN(num)) {
                        const locked = getLockedSet(cellKey);
                        if (!locked.has("bgImg")) {
                            saveOrig(td);
                            const base = Math.min(0, minNum);
                            const span = maxNum - base;
                            const pct = span > 0
                                ? Math.max(2, Math.min(100, Math.round(((num - base) / span) * 100)))
                                : (num !== 0 ? 100 : 0);
                            if (pct > 0) {
                                const barColor = rule.barColor || "#638ec6";
                                td.style.backgroundImage = rule.solid
                                    ? `linear-gradient(90deg, ${barColor} ${pct}%, transparent ${pct}%)`
                                    : `linear-gradient(90deg, ${barColor} 0%, rgba(255,255,255,0.85) ${pct}%, transparent ${pct}%)`;
                                locked.add("bgImg");
                            }
                        }
                        if (rule.stopIfTrue) stoppedCells.add(cellKey);
                        continue;
                    }

                    if (ruleOp === "colorscale" && !isNaN(num)) {
                        const locked = getLockedSet(cellKey);
                        if (!locked.has("bg")) {
                            saveOrig(td);
                            const ratio = maxNum > minNum ? (num - minNum) / (maxNum - minNum) : 0.5;
                            const t = rule.reverse ? 1 - ratio : ratio;
                            const cLow = rule.cLow || [248, 105, 107];
                            const cMid = rule.cMid || [255, 235, 132];
                            const cHigh = rule.cHigh || [99, 190, 123];
                            let rgb;
                            if (rule.twoColor) {
                                rgb = cLow.map((v, i) => Math.round(v + t * (cHigh[i] - v)));
                            } else if (t < 0.5) {
                                rgb = cLow.map((v, i) => Math.round(v + (t * 2) * (cMid[i] - v)));
                            } else {
                                rgb = cMid.map((v, i) => Math.round(v + ((t - 0.5) * 2) * (cHigh[i] - v)));
                            }
                            td.style.backgroundColor = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
                            locked.add("bg");
                        }
                        if (rule.stopIfTrue) stoppedCells.add(cellKey);
                        continue;
                    }

                    if (ruleOp === "iconset" && !isNaN(num) && maxNum >= minNum) {
                        const locked = getLockedSet(cellKey);
                        if (!locked.has("icon")) {
                            saveOrig(td);
                            const pct = maxNum === minNum ? 100 : ((num - minNum) / (maxNum - minNum)) * 100;
                            const palette = CF_ICON_SETS[rule.iconSet || "arrows3"] || CF_ICON_SETS.arrows3;
                            const icon = pct >= 67 ? palette[2] : (pct >= 33 ? palette[1] : palette[0]);
                            td.dataset.cfIcon = icon.char;
                            td.style.setProperty("--cf-icon-color", icon.color);
                            appliedCfIconCells.add(td);
                            locked.add("icon");
                        }
                        if (rule.stopIfTrue) stoppedCells.add(cellKey);
                        continue;
                    }

                    let matched = false;
                    if (ruleOp === "topN" || ruleOp === "topPercent") matched = !isNaN(num) && num >= topCut;
                    else if (ruleOp === "bottomN" || ruleOp === "bottomPercent") matched = !isNaN(num) && num <= bottomCut;
                    else if (ruleOp === "aboveAvg") matched = !isNaN(num) && num > avgNum;
                    else if (ruleOp === "belowAvg") matched = !isNaN(num) && num < avgNum;
                    else if (ruleOp === "aboveEqAvg") matched = !isNaN(num) && num >= avgNum;
                    else if (ruleOp === "belowEqAvg") matched = !isNaN(num) && num <= avgNum;
                    else matched = matchConditionalRule(rule, rawVal, valueCountMap, r, c);

                    if (matched) {
                        saveOrig(td);
                        const locked = getLockedSet(cellKey);
                        if (rule.bgColor && !locked.has("bg")) {
                            td.style.backgroundColor = rule.bgColor;
                            locked.add("bg");
                        }
                        if (rule.textColor && !locked.has("color")) {
                            td.style.color = rule.textColor;
                            locked.add("color");
                        }
                        if (rule.bold && !locked.has("bold")) {
                            td.style.fontWeight = "bold";
                            locked.add("bold");
                        }
                        if (rule.italic && !locked.has("italic")) {
                            td.style.fontStyle = "italic";
                            locked.add("italic");
                        }
                        if (rule.underline && !locked.has("underline")) {
                            td.style.textDecoration = "underline";
                            locked.add("underline");
                        }
                        if (rule.borderColor && !locked.has("border")) {
                            td.style.outline = `2px solid ${rule.borderColor}`;
                            td.style.outlineOffset = "-2px";
                            locked.add("border");
                        }
                        if (rule.stopIfTrue) stoppedCells.add(cellKey);
                    }
                }
            }
        }

        appliedCfCells.forEach(td => {
            if (td.isConnected) gridlineTouchedCells.add(td);
        });
        if (gridlineTouchedCells.size > 0) {
            syncCellGridlinesForCells?.(gridlineTouchedCells);
        }
    }

    function openConditionalFormatPresetDialog(presetKey) {
        const bounds = getSelectedRangeBounds();
        if (!bounds) return;

        const configs = {
            "highlight-gt": { title: "指定の値より大きい", label: "次の値より大きいセルを書式設定:", op: ">", defaultVal: "100", mode: "single" },
            "highlight-lt": { title: "指定の値より小さい", label: "次の値より小さいセルを書式設定:", op: "<", defaultVal: "0", mode: "single" },
            "highlight-between": { title: "指定の範囲内", label: "次の値の間にあるセルを書式設定:", op: "between", defaultVal: "10", defaultVal2: "100", mode: "between" },
            "highlight-eq": { title: "指定の値に等しい", label: "次の値に等しいセルを書式設定:", op: "=", defaultVal: "", mode: "single" },
            "highlight-text": { title: "指定の文字列を含む", label: "次の文字列を含むセルを書式設定:", op: "contains", defaultVal: "", mode: "single" },
            "highlight-date": { title: "日付", label: "次の期間の日付を含むセルを書式設定:", op: "date", mode: "date" },
            "highlight-dup": { title: "重複する値", label: "選択範囲内の次の値を含むセルを書式設定:", op: "duplicate", mode: "dup" },
            "top-n": { title: "上位 10 項目", label: "上位に入るセルを書式設定:", op: "topN", defaultVal: "10", mode: "rank" },
            "top-pct": { title: "上位 10 %", label: "上位 (%) に入るセルを書式設定:", op: "topPercent", defaultVal: "10", mode: "rank" },
            "bottom-n": { title: "下位 10 項目", label: "下位に入るセルを書式設定:", op: "bottomN", defaultVal: "10", mode: "rank" },
            "bottom-pct": { title: "下位 10 %", label: "下位 (%) に入るセルを書式設定:", op: "bottomPercent", defaultVal: "10", mode: "rank" },
            "above-avg": { title: "平均より上", label: "選択範囲の平均より上のセルを書式設定:", op: "aboveAvg", mode: "none" },
            "below-avg": { title: "平均より下", label: "選択範囲の平均より下のセルを書式設定:", op: "belowAvg", mode: "none" }
        };
        const cfg = configs[presetKey];
        if (!cfg) return;

        let inputHtml = "";
        if (cfg.mode === "single") {
            inputHtml = `
                <div style="display:inline-flex; gap:3px; align-items:center;">
                    <input type="text" class="ss-cfp-v1 border" value="${cfg.defaultVal ?? ""}" style="width:125px; height:24px; padding:2px 5px; background:#fff; color:#000;">
                    <button type="button" class="button ss-cfp-pick" data-pick-target=".ss-cfp-v1" title="シートからセルを選択" style="height:24px; padding:0 6px;">📍</button>
                </div>
            `;
        } else if (cfg.mode === "rank") {
            inputHtml = `<input type="number" min="1" class="ss-cfp-v1 border" value="${cfg.defaultVal ?? "10"}" style="width:90px; height:24px; padding:2px 5px; background:#fff; color:#000;">`;
        } else if (cfg.mode === "between") {
            inputHtml = `
                <div style="display:inline-flex; gap:3px; align-items:center;">
                    <input type="text" class="ss-cfp-v1 border" value="${cfg.defaultVal}" style="width:82px; height:24px; padding:2px 5px; background:#fff; color:#000;">
                    <button type="button" class="button ss-cfp-pick" data-pick-target=".ss-cfp-v1" title="シートからセルを選択" style="height:24px; padding:0 5px;">📍</button>
                    <span>と</span>
                    <input type="text" class="ss-cfp-v2 border" value="${cfg.defaultVal2}" style="width:82px; height:24px; padding:2px 5px; background:#fff; color:#000;">
                    <button type="button" class="button ss-cfp-pick" data-pick-target=".ss-cfp-v2" title="シートからセルを選択" style="height:24px; padding:0 5px;">📍</button>
                </div>
            `;
        } else if (cfg.mode === "date") {
            inputHtml = `
                <select class="ss-cfp-date border" style="width:150px; height:24px; background:#fff; color:#000;">
                    <option value="yesterday">昨日</option>
                    <option value="today" selected>今日</option>
                    <option value="tomorrow">明日</option>
                    <option value="last7days">過去 7 日間</option>
                    <option value="lastMonth">先月</option>
                    <option value="thisMonth">今月</option>
                    <option value="nextMonth">来月</option>
                </select>
            `;
        } else if (cfg.mode === "dup") {
            inputHtml = `
                <select class="ss-cfp-dup border" style="width:120px; height:24px; background:#fff; color:#000;">
                    <option value="duplicate" selected>重複</option>
                    <option value="unique">一意</option>
                </select>
            `;
        }

        const styleOpts = Object.entries(EXCEL_CF_PRESET_STYLES)
            .map(([k, s]) => `<option value="${k}">${s.label}</option>`)
            .join("");

        const bodyHtml = `
            <div style="width:100%; display:flex; flex-direction:column; gap:8px; font-size:12px;">
                <div>${cfg.label}</div>
                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                    ${inputHtml}
                    <span>書式:</span>
                    <select class="ss-cfp-style border" style="flex:1; min-width:170px; height:24px; background:#fff; color:#000;">
                        ${styleOpts}
                    </select>
                </div>
            </div>
        `;

        const modalContent = openAppModal(cfg.title, bodyHtml, {
            width: 440,
            isHtml: true,
            parentWin: win,
            buttons: [
                {
                    label: "OK",
                    onClick: () => {
                        const styleKey = modalContent.querySelector(".ss-cfp-style").value;
                        const st = EXCEL_CF_PRESET_STYLES[styleKey] || EXCEL_CF_PRESET_STYLES.redFillDarkRedText;
                        const rule = {
                            ...bounds,
                            op: cfg.op,
                            bgColor: st.bgColor,
                            textColor: st.textColor,
                            bold: st.bold,
                            italic: st.italic,
                            borderColor: st.borderColor,
                            stopIfTrue: false
                        };
                        if (cfg.mode === "single") rule.val1 = modalContent.querySelector(".ss-cfp-v1").value.trim();
                        if (cfg.mode === "rank") rule.rank = Number(modalContent.querySelector(".ss-cfp-v1").value) || 10;
                        if (cfg.mode === "between") {
                            rule.val1 = modalContent.querySelector(".ss-cfp-v1").value.trim();
                            rule.val2 = modalContent.querySelector(".ss-cfp-v2").value.trim();
                        }
                        if (cfg.mode === "date") rule.datePeriod = modalContent.querySelector(".ss-cfp-date").value;
                        if (cfg.mode === "dup") rule.op = modalContent.querySelector(".ss-cfp-dup").value;

                        getActiveSheet().conditionalFormats.unshift(rule);
                        applyConditionalFormats();
                        setDirtyState(true);
                        debouncedSaveState();
                    }
                },
                { label: "キャンセル" }
            ]
        });

        modalContent?.querySelectorAll(".ss-cfp-pick").forEach(btn => {
            btn.addEventListener("click", () => {
                const targetInput = modalContent.querySelector(btn.dataset.pickTarget);
                openSheetRangePicker({ modalContent, targetInput, label: "条件に使うセルを選択:" });
            });
        });
    }

    function openConditionalFormatModal(editIndex = null) {
        const existing = editIndex !== null ? getActiveSheet()?.conditionalFormats?.[editIndex] : null;
        const bounds = getSelectedRangeBounds();
        if (!bounds && !existing) return;
        const targetBounds = existing
            ? { minRow: existing.minRow, maxRow: existing.maxRow, minCol: existing.minCol, maxCol: existing.maxCol }
            : bounds;

        let initType = "cellValue";
        if (existing) {
            if (existing.op === "formula") initType = "formula";
            else if (["topN", "topPercent", "bottomN", "bottomPercent"].includes(existing.op)) initType = "topBottom";
            else if (["aboveAvg", "belowAvg", "aboveEqAvg", "belowEqAvg"].includes(existing.op)) initType = "average";
            else if (["duplicate", "unique"].includes(existing.op)) initType = "dupUnique";
            else if (["databar", "colorscale", "iconset"].includes(existing.op)) initType = "scaleBar";
        }

        const initRangeStr = `=$${getColumnName(targetBounds.minCol)}$${targetBounds.minRow}:$${getColumnName(targetBounds.maxCol)}$${targetBounds.maxRow}`;

        const bodyHtml = `
            <div style="width:100%; display:flex; flex-direction:column; gap:8px; font-size:12px;">
                <div style="display:flex; align-items:center; gap:6px;">
                    <label style="font-weight:bold; white-space:nowrap;">適用先範囲:</label>
                    <input type="text" class="ss-cf-apply-range border" value="${initRangeStr}" style="flex:1; height:24px; padding:2px 6px; background:#fff; color:#000;">
                    <button type="button" class="button ss-cf-pick" data-pick-target=".ss-cf-apply-range" data-pick-label="書式の適用先を選択:" data-cross-sheet="0" style="height:24px; padding:0 7px;">📍範囲選択</button>
                </div>
                <div style="font-weight:bold;">ルールの種類を選択してください(S):</div>
                <select class="ss-cf-ruletype border" size="6" style="width:100%; background:#fff; color:#000; font-size:12px; padding:2px;">
                    <option value="scaleBar" ${initType === "scaleBar" ? "selected" : ""}>・ セルの値に基づいてすべてのセルを書式設定</option>
                    <option value="cellValue" ${initType === "cellValue" ? "selected" : ""}>・ 指定の値を含むセルだけを書式設定</option>
                    <option value="topBottom" ${initType === "topBottom" ? "selected" : ""}>・ 上位または下位に入る値だけを書式設定</option>
                    <option value="average" ${initType === "average" ? "selected" : ""}>・ 平均より上または下の値だけを書式設定</option>
                    <option value="dupUnique" ${initType === "dupUnique" ? "selected" : ""}>・ 一意の値または重複する値だけを書式設定</option>
                    <option value="formula" ${initType === "formula" ? "selected" : ""}>・ 数式を使用して、書式設定するセルを決定</option>
                </select>

                <div style="border:1px solid #808080; padding:8px; background:#f4f4f4; display:flex; flex-direction:column; gap:6px;">
                    <div style="font-weight:bold;">ルールの内容を編集してください(E):</div>

                    <!-- 1. scaleBar -->
                    <div class="ss-cf-pane" data-pane="scaleBar" style="display:${initType === "scaleBar" ? "flex" : "none"}; flex-direction:column; gap:6px;">
                        <div style="display:flex; gap:6px; align-items:center;">
                            <label style="width:95px;">書式スタイル:</label>
                            <select class="ss-cf-sb-mode border" style="flex:1; height:24px; background:#fff; color:#000;">
                                <option value="databar" ${existing?.op === "databar" ? "selected" : ""}>データ バー</option>
                                <option value="colorscale" ${existing?.op === "colorscale" ? "selected" : ""}>3 色スケール（緑 - 黄 - 赤）</option>
                                <option value="iconset" ${existing?.op === "iconset" ? "selected" : ""}>アイコン セット（3方向矢印）</option>
                            </select>
                        </div>
                        <div style="display:flex; gap:8px; align-items:center;">
                            <label>バーの色: <input type="color" class="ss-cf-barcolor" value="${existing?.barColor || "#638ec6"}"></label>
                        </div>
                    </div>

                    <!-- 2. cellValue -->
                    <div class="ss-cf-pane" data-pane="cellValue" style="display:${initType === "cellValue" ? "flex" : "none"}; flex-direction:column; gap:6px;">
                        <div>次のセルのみを書式設定:</div>
                        <div style="display:flex; gap:6px; align-items:center;">
                            <select class="ss-cf-op border" style="width:155px; height:24px; background:#fff; color:#000;">
                                <option value="between" ${existing?.op === "between" ? "selected" : ""}>次の値の間</option>
                                <option value="notBetween" ${existing?.op === "notBetween" ? "selected" : ""}>次の値の間以外</option>
                                <option value="=" ${existing?.op === "=" ? "selected" : ""}>次の値に等しい</option>
                                <option value="<>" ${existing?.op === "<>" ? "selected" : ""}>次の値に等しくない</option>
                                <option value=">" ${!existing || existing?.op === ">" ? "selected" : ""}>次の値より大きい</option>
                                <option value="<" ${existing?.op === "<" ? "selected" : ""}>次の値より小さい</option>
                                <option value=">=" ${existing?.op === ">=" ? "selected" : ""}>次の値以上</option>
                                <option value="<=" ${existing?.op === "<=" ? "selected" : ""}>次の値以下</option>
                                <option value="contains" ${existing?.op === "contains" ? "selected" : ""}>特定の文字列を含む</option>
                                <option value="date" ${existing?.op === "date" ? "selected" : ""}>日付 (期間指定)</option>
                                <option value="blank" ${existing?.op === "blank" ? "selected" : ""}>空白</option>
                                <option value="notBlank" ${existing?.op === "notBlank" ? "selected" : ""}>空白以外</option>
                                <option value="error" ${existing?.op === "error" ? "selected" : ""}>エラー</option>
                                <option value="notError" ${existing?.op === "notError" ? "selected" : ""}>エラー以外</option>
                            </select>
                       <div style="flex:1; display:${["blank", "notBlank", "error", "notError"].includes(existing?.op) ? "none" : "flex"}; gap:3px; align-items:center;" class="ss-cf-v1-wrap">
                                <input type="text" class="ss-cf-v1 border" value="${escapeHtml(existing?.val1 ?? "")}" placeholder="値 1" style="flex:1; min-width:0; height:24px; padding:2px 5px; background:#fff; color:#000;">
                                <button type="button" class="button ss-cf-pick" data-pick-target=".ss-cf-v1" data-pick-label="値 1 のセルを選択:" style="height:24px; padding:0 5px;">📍</button>
                            </div>
                            <div style="display:${["between", "notBetween"].includes(existing?.op) ? "flex" : "none"}; flex:1; gap:3px; align-items:center;" class="ss-cf-v2-wrap">
                                <input type="text" class="ss-cf-v2 border" value="${escapeHtml(existing?.val2 ?? "")}" placeholder="値 2" style="flex:1; min-width:0; height:24px; padding:2px 5px; background:#fff; color:#000;">
                                <button type="button" class="button ss-cf-pick" data-pick-target=".ss-cf-v2" data-pick-label="値 2 のセルを選択:" style="height:24px; padding:0 5px;">📍</button>
                            </div>
                        </div>
                    </div>

                    <!-- 3. topBottom -->
                    <div class="ss-cf-pane" data-pane="topBottom" style="display:${initType === "topBottom" ? "flex" : "none"}; gap:6px; align-items:center;">
                        <select class="ss-cf-tb-dir border" style="width:100px; height:24px; background:#fff; color:#000;">
                            <option value="top" ${existing?.op?.startsWith("bottom") ? "" : "selected"}>上位</option>
                            <option value="bottom" ${existing?.op?.startsWith("bottom") ? "selected" : ""}>下位</option>
                        </select>
                        <input type="number" class="ss-cf-tb-rank border" value="${existing?.rank || 10}" min="1" style="width:75px; height:24px; padding:2px 5px; background:#fff; color:#000;">
                        <label style="display:inline-flex; align-items:center; gap:3px;">
                            <input type="checkbox" class="ss-cf-tb-pct" ${existing?.op?.endsWith("Percent") ? "checked" : ""}> 選択範囲に対する %
                        </label>
                    </div>

                    <!-- 4. average -->
                    <div class="ss-cf-pane" data-pane="average" style="display:${initType === "average" ? "flex" : "none"}; gap:6px; align-items:center;">
                        <span>選択範囲の平均:</span>
                        <select class="ss-cf-avg-op border" style="width:160px; height:24px; background:#fff; color:#000;">
                            <option value="aboveAvg" ${existing?.op === "aboveAvg" ? "selected" : ""}>より上</option>
                            <option value="belowAvg" ${existing?.op === "belowAvg" ? "selected" : ""}>より下</option>
                            <option value="aboveEqAvg" ${existing?.op === "aboveEqAvg" ? "selected" : ""}>以上</option>
                            <option value="belowEqAvg" ${existing?.op === "belowEqAvg" ? "selected" : ""}>以下</option>
                        </select>
                    </div>

                    <!-- 5. dupUnique -->
                    <div class="ss-cf-pane" data-pane="dupUnique" style="display:${initType === "dupUnique" ? "flex" : "none"}; gap:6px; align-items:center;">
                        <span>選択範囲内の次の値をすべて書式設定:</span>
                        <select class="ss-cf-du-op border" style="width:130px; height:24px; background:#fff; color:#000;">
                            <option value="duplicate" ${existing?.op !== "unique" ? "selected" : ""}>重複</option>
                            <option value="unique" ${existing?.op === "unique" ? "selected" : ""}>一意</option>
                        </select>
                    </div>

                    <!-- 6. formula -->
                    <div class="ss-cf-pane" data-pane="formula" style="display:${initType === "formula" ? "flex" : "none"}; flex-direction:column; gap:4px;">
                        <div>次の数式を満たす場合に値を書式設定(O):</div>
                        <div style="display:flex; gap:4px; align-items:center;">
                            <input type="text" class="ss-cf-formula border" value="${(existing?.formula || "").replace(/"/g, "&quot;")}" placeholder="例: =$B2>1000" style="flex:1; min-width:0; height:24px; padding:2px 6px; background:#fff; color:#000;">
                            <button type="button" class="button ss-cf-pick" data-pick-target=".ss-cf-formula" data-pick-label="数式に使うセル範囲を選択:" style="height:24px; padding:0 7px;">📍範囲選択</button>
                        </div>
                    </div>

                    <!-- 書式プレビュー＆設定 -->
                    <div class="ss-cf-fmt-area" style="display:${initType === "scaleBar" ? "none" : "flex"}; flex-direction:column; gap:6px; border-top:1px solid #ccc; padding-top:6px; margin-top:2px;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span>プレビュー:</span>
                            <div class="ss-cf-preview border" style="flex:1; height:26px; line-height:24px; text-align:center; background:${existing && !existing.bgColor ? "#ffffff" : (existing?.bgColor || "#ffc7ce")}; color:${existing && !existing.textColor ? "#000000" : (existing?.textColor || "#9c0006")}; font-weight:${!existing || existing.bold ? "bold" : "normal"}; font-style:${existing?.italic ? "italic" : "normal"};">AaBbCcYyZz</div>
                        </div>
                        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                            <label>塗りつぶし: <input type="color" class="ss-cf-bg" value="${existing?.bgColor || "#ffc7ce"}"></label>
                            <label><input type="checkbox" class="ss-cf-nobg" ${existing && !existing.bgColor ? "checked" : ""}> 塗りつぶしなし</label>
                            <label>文字色: <input type="color" class="ss-cf-fg" value="${existing?.textColor || "#9c0006"}"></label>
                            <label><input type="checkbox" class="ss-cf-nofg" ${existing && !existing.textColor ? "checked" : ""}> 文字色自動</label>
                            <label><input type="checkbox" class="ss-cf-bold" ${!existing || existing.bold ? "checked" : ""}> 太字</label>
                            <label><input type="checkbox" class="ss-cf-italic" ${existing?.italic ? "checked" : ""}> 斜体</label>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const modalContent = openAppModal(existing ? "書式ルールの編集" : "新しい書式ルール", bodyHtml, {
            width: 470,
            isHtml: true,
            parentWin: win,
            buttons: [
                {
                    label: "OK",
                    onClick: () => {
                        const rType = modalContent.querySelector(".ss-cf-ruletype").value;
                        const noBg = modalContent.querySelector(".ss-cf-nobg").checked;
                        const noFg = modalContent.querySelector(".ss-cf-nofg").checked;
                        const bgColor = noBg ? "" : modalContent.querySelector(".ss-cf-bg").value;
                        const textColor = noFg ? "" : modalContent.querySelector(".ss-cf-fg").value;
                        const bold = modalContent.querySelector(".ss-cf-bold").checked;
                        const italic = modalContent.querySelector(".ss-cf-italic").checked;

                        const rawRangeText = (modalContent.querySelector(".ss-cf-apply-range")?.value || "")
                            .replace(/^=/, "")
                            .replace(/^.*!/, "")
                            .trim()
                            .toUpperCase();
                        let finalBounds = { ...targetBounds };
                        if (rawRangeText.includes(":")) {
                            const parsedRng = parseRangeReference(rawRangeText);
                            if (parsedRng) {
                                finalBounds = {
                                    minRow: Math.min(parsedRng.start.row, parsedRng.end.row),
                                    maxRow: Math.max(parsedRng.start.row, parsedRng.end.row),
                                    minCol: Math.min(parsedRng.start.col, parsedRng.end.col),
                                    maxCol: Math.max(parsedRng.start.col, parsedRng.end.col)
                                };
                            }
                        } else if (rawRangeText) {
                            const parsedCell = parseCellReference(rawRangeText);
                            if (parsedCell) {
                                finalBounds = {
                                    minRow: parsedCell.row,
                                    maxRow: parsedCell.row,
                                    minCol: parsedCell.col,
                                    maxCol: parsedCell.col
                                };
                            }
                        }

                        let rule = {
                            ...(existing || {}),
                            ...finalBounds,
                            bgColor,
                            textColor,
                            bold,
                            italic,
                            stopIfTrue: existing?.stopIfTrue || false
                        };

                        if (rType === "scaleBar") {
                            const sbMode = modalContent.querySelector(".ss-cf-sb-mode").value;
                            rule.op = sbMode;
                            if (sbMode === "databar") rule.barColor = modalContent.querySelector(".ss-cf-barcolor").value;
                            if (sbMode === "iconset") rule.iconSet = existing?.iconSet || "arrows3";
                        } else if (rType === "cellValue") {
                            const selectedOp = modalContent.querySelector(".ss-cf-op").value;
                            rule.op = selectedOp;
                            if (selectedOp === "date") {
                                rule.datePeriod = existing?.datePeriod || "today";
                            }
                            rule.val1 = modalContent.querySelector(".ss-cf-v1").value.trim();
                            rule.val2 = modalContent.querySelector(".ss-cf-v2").value.trim();
                        } else if (rType === "topBottom") {
                            const dir = modalContent.querySelector(".ss-cf-tb-dir").value;
                            const isPct = modalContent.querySelector(".ss-cf-tb-pct").checked;
                            rule.op = `${dir}${isPct ? "Percent" : "N"}`;
                            rule.rank = Number(modalContent.querySelector(".ss-cf-tb-rank").value) || 10;
                        } else if (rType === "average") {
                            rule.op = modalContent.querySelector(".ss-cf-avg-op").value;
                        } else if (rType === "dupUnique") {
                            rule.op = modalContent.querySelector(".ss-cf-du-op").value;
                        } else if (rType === "formula") {
                            rule.op = "formula";
                            rule.formula = modalContent.querySelector(".ss-cf-formula").value
                                .trim()
                                .replace(/[“”″]/g, '"');
                        }

                        if (existing && editIndex !== null) {
                            getActiveSheet().conditionalFormats[editIndex] = rule;
                        } else {
                            getActiveSheet().conditionalFormats.unshift(rule);
                        }
                        applyConditionalFormats();
                        setDirtyState(true);
                        debouncedSaveState();
                    }
                },
                { label: "キャンセル" }
            ]
        });

        const typeSel = modalContent.querySelector(".ss-cf-ruletype");
        const opSel = modalContent.querySelector(".ss-cf-op");
        const fmtArea = modalContent.querySelector(".ss-cf-fmt-area");
        const previewEl = modalContent.querySelector(".ss-cf-preview");
        const bgInp = modalContent.querySelector(".ss-cf-bg");
        const noBgChk = modalContent.querySelector(".ss-cf-nobg");
        const fgInp = modalContent.querySelector(".ss-cf-fg");
        const noFgChk = modalContent.querySelector(".ss-cf-nofg");
        const boldChk = modalContent.querySelector(".ss-cf-bold");
        const italicChk = modalContent.querySelector(".ss-cf-italic");

        const syncPreview = () => {
            previewEl.style.backgroundColor = noBgChk.checked ? "#ffffff" : bgInp.value;
            previewEl.style.color = noFgChk.checked ? "#000000" : fgInp.value;
            previewEl.style.fontWeight = boldChk.checked ? "bold" : "normal";
            previewEl.style.fontStyle = italicChk.checked ? "italic" : "normal";
        };
        bgInp.addEventListener("input", () => { noBgChk.checked = false; syncPreview(); });
        fgInp.addEventListener("input", () => { noFgChk.checked = false; syncPreview(); });
        [bgInp, noBgChk, fgInp, noFgChk, boldChk, italicChk].forEach(el => el.addEventListener("change", syncPreview));
        syncPreview();

        typeSel.addEventListener("change", () => {
            const val = typeSel.value;
            modalContent.querySelectorAll(".ss-cf-pane").forEach(p => {
                p.style.display = p.dataset.pane === val ? "flex" : "none";
            });
            fmtArea.style.display = val === "scaleBar" ? "none" : "flex";
        });

        const v1Wrap = modalContent.querySelector(".ss-cf-v1-wrap");
        const v2Wrap = modalContent.querySelector(".ss-cf-v2-wrap");
        opSel.addEventListener("change", () => {
            const val = opSel.value;
            if (v2Wrap) v2Wrap.style.display = ["between", "notBetween"].includes(val) ? "flex" : "none";
            if (v1Wrap) v1Wrap.style.display = ["blank", "notBlank", "error", "notError"].includes(val) ? "none" : "flex";
        });

        modalContent.querySelectorAll(".ss-cf-pick").forEach(btn => {
            btn.addEventListener("click", () => {
                const targetInput = modalContent.querySelector(btn.dataset.pickTarget);
                openSheetRangePicker({
                    modalContent,
                    targetInput,
                    label: btn.dataset.pickLabel || "範囲を選択:",
                    allowCrossSheet: btn.dataset.crossSheet !== "0"
                });
            });
        });
    }

    function openConditionalFormatManager() {
        const curBounds = getSelectedRangeBounds();
        let draftRules = JSON.parse(JSON.stringify(getActiveSheet()?.conditionalFormats || []));
        let selectedIdx = draftRules.length > 0 ? 0 : -1;
        let scope = "sheet";

        const bodyHtml = `
            <div style="width:100%; display:flex; flex-direction:column; gap:8px; font-size:12px;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <label>書式ルールの表示(S):</label>
                    <select class="ss-cfm-scope border" style="width:200px; height:24px; background:#fff; color:#000;">
                        <option value="sheet" selected>このワークシート</option>
                        <option value="selection">現在の選択範囲</option>
                    </select>
                </div>
                <div style="display:flex; gap:5px; align-items:center;">
                    <button type="button" class="button ss-cfm-new">新規ルール(N)...</button>
                    <button type="button" class="button ss-cfm-edit">ルールの編集(E)...</button>
                    <button type="button" class="button ss-cfm-del">ルールの削除(D)</button>
                    <button type="button" class="button ss-cfm-up" title="優先順位を上げる">▲</button>
                    <button type="button" class="button ss-cfm-down" title="優先順位を下げる">▼</button>
                </div>
                <div style="border:1px solid #808080; background:#fff; height:210px; overflow-y:auto;">
                    <table style="width:100%; border-collapse:collapse; font-size:11px;">
                        <thead>
                            <tr style="background:#d4d8dc; border-bottom:1px solid #808080;">
                                <th style="padding:4px; text-align:left;">ルール（表示順）</th>
                                <th style="padding:4px; text-align:center; width:75px;">書式</th>
                                <th style="padding:4px; text-align:left; width:125px;">適用先</th>
                                <th style="padding:4px; text-align:center; width:70px;">条件を満たす場合は停止</th>
                            </tr>
                        </thead>
                        <tbody class="ss-cfm-tbody"></tbody>
                    </table>
                </div>
            </div>
        `;

        const modalContent = openAppModal("条件付き書式ルールの管理", bodyHtml, {
            width: 560,
            isHtml: true,
            parentWin: win,
            buttons: [
                {
                    label: "OK",
                    onClick: () => {
                        getActiveSheet().conditionalFormats = draftRules;
                        applyConditionalFormats();
                        setDirtyState(true);
                        debouncedSaveState();
                    }
                },
                { label: "キャンセル" },
                {
                    label: "適用(A)",
                    closeOnClick: false,
                    onClick: () => {
                        getActiveSheet().conditionalFormats = JSON.parse(JSON.stringify(draftRules));
                        applyConditionalFormats();
                        setDirtyState(true);
                        debouncedSaveState();
                    }
                }
            ]
        });

        const tbodyEl = modalContent.querySelector(".ss-cfm-tbody");
        const scopeSel = modalContent.querySelector(".ss-cfm-scope");

        const renderRows = () => {
            tbodyEl.innerHTML = "";
            const visibleEntries = draftRules
                .map((r, realIdx) => ({ r, realIdx }))
                .filter(({ r }) => {
                    if (scope === "sheet" || !curBounds) return true;
                    return !(r.maxRow < curBounds.minRow || r.minRow > curBounds.maxRow || r.maxCol < curBounds.minCol || r.minCol > curBounds.maxCol);
                });

            if (!visibleEntries.length) {
                tbodyEl.innerHTML = `<tr><td colspan="4" style="padding:14px; text-align:center; color:#666;">表示するルールがありません。</td></tr>`;
                return;
            }

            visibleEntries.forEach(({ r, realIdx }) => {
                const tr = document.createElement("tr");
                tr.style.borderBottom = "1px solid #e0e0e0";
                tr.style.backgroundColor = realIdx === selectedIdx ? "#cce4f7" : "#fff";
                tr.style.cursor = "pointer";

                const rngStr = `=$${getColumnName(r.minCol)}$${r.minRow}:$${getColumnName(r.maxCol)}$${r.maxRow}`;
                const previewStyle = r.op === "databar"
                    ? `background:${r.barColor || "#638ec6"}; color:#fff;`
                    : r.op === "colorscale"
                        ? "background:linear-gradient(90deg,#f8696b,#ffeb84,#63be7b); color:#000;"
                        : `background:${r.bgColor || "#fff"}; color:${r.textColor || "#000"}; font-weight:${r.bold ? "bold" : "normal"}; font-style:${r.italic ? "italic" : "normal"};`;

                tr.innerHTML = `
                    <td style="padding:4px 6px;">${escapeHtml(describeConditionalRule(r))}</td>
                    <td style="padding:4px; text-align:center;"><span style="display:inline-block; width:56px; border:1px solid #999; ${previewStyle}">AaBbCc</span></td>
                    <td style="padding:3px;">
                        <div style="display:flex; gap:2px; align-items:center;">
                            <input type="text" class="ss-cfm-range border" value="${rngStr}" style="flex:1; min-width:0; font-size:11px; padding:1px 3px; background:#fff; color:#000;">
                            <button type="button" class="button ss-cfm-pick-range" title="シート上をドラッグして適用先を選択" style="height:20px; min-height:20px; padding:0 4px; font-size:11px;">📍</button>
                        </div>
                    </td>
                    <td style="padding:4px; text-align:center;"><input type="checkbox" class="ss-cfm-stop" ${r.stopIfTrue ? "checked" : ""}></td>
                `;

                tr.addEventListener("click", (ev) => {
                    if (ev.target.closest("input, button")) return;
                    selectedIdx = realIdx;
                    renderRows();
                });

                const rngInp = tr.querySelector(".ss-cfm-range");
                const applyRangeTextToRule = (rawVal) => {
                    const cleaned = String(rawVal || "").replace(/^=/, "").trim().toUpperCase();
                    if (cleaned.includes(":")) {
                        const parsed = parseRangeReference(cleaned);
                        if (parsed) {
                            r.minRow = Math.min(parsed.start.row, parsed.end.row);
                            r.maxRow = Math.max(parsed.start.row, parsed.end.row);
                            r.minCol = Math.min(parsed.start.col, parsed.end.col);
                            r.maxCol = Math.max(parsed.start.col, parsed.end.col);
                        }
                    } else if (cleaned) {
                        const single = parseCellReference(cleaned);
                        if (single) {
                            r.minRow = single.row;
                            r.maxRow = single.row;
                            r.minCol = single.col;
                            r.maxCol = single.col;
                        }
                    }
                    renderRows();
                };

                rngInp.addEventListener("change", () => applyRangeTextToRule(rngInp.value));

                tr.querySelector(".ss-cfm-pick-range").addEventListener("click", (ev) => {
                    ev.stopPropagation();
                    selectedIdx = realIdx;
                    openSheetRangePicker({
                        modalContent,
                        targetInput: rngInp,
                        label: "ルールの適用先を選択:",
                        allowCrossSheet: false,
                        onPicked: (val) => applyRangeTextToRule(val)
                    });
                });

                tr.querySelector(".ss-cfm-stop").addEventListener("change", (ev) => {
                    r.stopIfTrue = ev.target.checked;
                });

                tbodyEl.appendChild(tr);
            });
        };

        scopeSel.addEventListener("change", () => {
            scope = scopeSel.value;
            renderRows();
        });

        const closeManagerAndOpenEditor = (editIdx) => {
            getActiveSheet().conditionalFormats = draftRules;
            const modalWin = modalContent?.closest?.(".window");
            if (modalWin) {
                if (windowAPI?.closeWindow) {
                    windowAPI.closeWindow(modalWin);
                }
                if (modalWin.isConnected && windowAPI?.destroyWindow) {
                    windowAPI.destroyWindow(modalWin);
                }
                if (modalWin.isConnected) {
                    modalWin.querySelector(".close-btn, .window-close")?.click();
                }
            }
            openConditionalFormatModal(editIdx);
        };

        modalContent.querySelector(".ss-cfm-new").addEventListener("click", () => {
            closeManagerAndOpenEditor(null);
        });

        modalContent.querySelector(".ss-cfm-edit").addEventListener("click", () => {
            if (selectedIdx < 0 || !draftRules[selectedIdx]) return;
            closeManagerAndOpenEditor(selectedIdx);
        });

        modalContent.querySelector(".ss-cfm-del").addEventListener("click", () => {
            if (selectedIdx < 0 || !draftRules[selectedIdx]) return;
            draftRules.splice(selectedIdx, 1);
            selectedIdx = Math.min(draftRules.length - 1, selectedIdx);
            renderRows();
        });

        modalContent.querySelector(".ss-cfm-up").addEventListener("click", () => {
            if (selectedIdx <= 0) return;
            const [item] = draftRules.splice(selectedIdx, 1);
            draftRules.splice(selectedIdx - 1, 0, item);
            selectedIdx--;
            renderRows();
        });

        modalContent.querySelector(".ss-cfm-down").addEventListener("click", () => {
            if (selectedIdx < 0 || selectedIdx >= draftRules.length - 1) return;
            const [item] = draftRules.splice(selectedIdx, 1);
            draftRules.splice(selectedIdx + 1, 0, item);
            selectedIdx++;
            renderRows();
        });

        renderRows();
    }

    return {
        matchConditionalRule,
        applyConditionalFormats,
        resetConditionalFormatCache,
        openConditionalFormatPresetDialog,
        openConditionalFormatModal,
        openConditionalFormatManager
    };
}