// autofill.js
// Excel準拠 オートフィルエンジン ＆ オートフィルオプション（コピー／連続データ／書式のみ／書式なし／日・週日・月・年単位／=TODAY()等数式連続展開）

import {
    isDateNumFormat,
    isTimeNumFormat,
    formatDate,
    resolveDateFromRawValue,
    parseFormattedNumber
} from "./format-utils.js";
import {
    dateToSerial,
    serialToDate,
    parseJapaneseDateInput
} from "./formula-functions.js";
import { clearAppliedConditionalStyle } from "./conditional-format.js";

const JP_DAYS_SHORT = ["日", "月", "火", "水", "木", "金", "土"];
const JP_DAYS_LONG = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"];
const EN_DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EN_DAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const JP_MONTHS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
const EN_MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const EN_MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const CYCLIC_LISTS = [
    JP_DAYS_SHORT,
    JP_DAYS_LONG,
    EN_DAYS_SHORT,
    EN_DAYS_LONG,
    JP_MONTHS,
    EN_MONTHS_SHORT,
    EN_MONTHS_LONG,
    ["Q1", "Q2", "Q3", "Q4"],
    ["第1四半期", "第2四半期", "第3四半期", "第4四半期"]
];

function addMonthsClamped(baseDate, monthOffset) {
    const baseYear = baseDate.getFullYear();
    const baseMonth = baseDate.getMonth();
    const baseDay = baseDate.getDate();
    const totalMonths = baseYear * 12 + baseMonth + monthOffset;
    const targetYear = Math.floor(totalMonths / 12);
    const targetMonth = ((totalMonths % 12) + 12) % 12;
    const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
    return new Date(targetYear, targetMonth, Math.min(baseDay, lastDay));
}

function addWeekdays(baseDate, weekdayOffset) {
    const dt = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
    if (weekdayOffset === 0) return dt;
    const dir = weekdayOffset > 0 ? 1 : -1;
    let remaining = Math.abs(weekdayOffset);
    while (remaining > 0) {
        dt.setDate(dt.getDate() + dir);
        const dow = dt.getDay();
        if (dow !== 0 && dow !== 6) remaining--;
    }
    return dt;
}

function buildDateFormulaStep(baseFormula, stepIndex, dateUnit = "days", dayStep = 1) {
    const trimmed = String(baseFormula || "").trim();
    if (!trimmed.startsWith("=")) return null;
    if (stepIndex === 0) return trimmed;

    const body = trimmed.slice(1).trim();
    // =TODAY() / =TODAY()+N / =TODAY()-N の正規化
    const todayMatch = body.match(/^TODAY\s*\(\s*\)(?:\s*([+-])\s*(\d+))?$/i);
    if (todayMatch) {
        const baseOffset = todayMatch[2] ? (todayMatch[1] === "-" ? -Number(todayMatch[2]) : Number(todayMatch[2])) : 0;
        if (dateUnit === "days") {
            const total = baseOffset + stepIndex * dayStep;
            if (total === 0) return "=TODAY()";
            return total > 0 ? `=TODAY()+${total}` : `=TODAY()${total}`;
        }
        const baseExpr = baseOffset === 0 ? "TODAY()" : (baseOffset > 0 ? `TODAY()+${baseOffset}` : `TODAY()${baseOffset}`);
        if (dateUnit === "weekdays") return `=WORKDAY(${baseExpr}, ${stepIndex})`;
        if (dateUnit === "months") return `=EDATE(${baseExpr}, ${stepIndex})`;
        if (dateUnit === "years") return `=EDATE(${baseExpr}, ${stepIndex * 12})`;
    }

    // その他の日付関数セル（=DATE(...), =EDATE(...), =EOMONTH(...), =WORKDAY(...) 等）
    if (/^(DATE|EDATE|EOMONTH|WORKDAY|TODAY|NOW)\s*\(/i.test(body)) {
        if (dateUnit === "days") {
            const delta = stepIndex * dayStep;
            return delta > 0 ? `=(${body})+${delta}` : `=(${body})${delta}`;
        }
        if (dateUnit === "weekdays") return `=WORKDAY(${body}, ${stepIndex})`;
        if (dateUnit === "months") return `=EDATE(${body}, ${stepIndex})`;
        if (dateUnit === "years") return `=EDATE(${body}, ${stepIndex * 12})`;
    }
    return null;
}

export function createAutoFillModule(ctx) {
    const {
        signal,
        spreadsheetContent,
        tbody,
        getActiveCell,
        getSheets,
        getActiveSheetIndex,
        getRowCount,
        getCurrentColumns,
        isCurrentSheetProtected,
        isCellLockedForEdit,
        peekCell,
        getCell,
        getVisibleCell,
        getCellPureText,
        getSelectedRangeBounds,
        getRangeLocalRect,
        extractCellStyleObject,
        applyCellStyleData,
        applyShrinkToFit,
        syncCellAnnotationMark,
        clearSpillCellsFromAnchor,
        adjustFormula,
        setCellFormattedValue,
        clearSelection,
        setSelectionBounds,
        updateSelection,
        updateAllFormulas,
        applyConditionalFormats,
        syncCellGridlinesForBounds,
        updateSelectedCellsDisplay,
        showAlert,
        setDirtyState,
        debouncedSaveState
    } = ctx;

    let isFillDragging = false;
    let fillDragStartCell = null;
    let currentFillRange = null;
    let initialFillRange = null;

    // フィル直後のオプション再適用用コンテキスト
    let activeAutoFillContext = null;
    let activeMenuEl = null;

    const optionBtn = document.createElement("button");
    optionBtn.type = "button";
    optionBtn.tabIndex = -1;
    optionBtn.className = "ss-autofill-opt-btn";
    optionBtn.title = "オートフィル オプション";
    optionBtn.innerHTML = `<span class="ss-afo-icon">⊞</span><span class="ss-afo-caret">▼</span>`;
    spreadsheetContent.appendChild(optionBtn);

    function closeAutoFillOptionMenu() {
        if (activeMenuEl) {
            activeMenuEl.remove();
            activeMenuEl = null;
        }
        optionBtn.classList.remove("open");
    }

    function hideAutoFillOptions() {
        closeAutoFillOptionMenu();
        optionBtn.style.display = "none";
        activeAutoFillContext = null;
    }

    function syncAutoFillOptionButtonPosition() {
        if (!activeAutoFillContext) {
            optionBtn.style.display = "none";
            return;
        }
        const rect = getRangeLocalRect(activeAutoFillContext.fillRange);
        if (!rect) {
            optionBtn.style.display = "none";
            return;
        }
        optionBtn.style.left = `${Math.max(4, Math.round(rect.right + 4))}px`;
        optionBtn.style.top = `${Math.max(4, Math.round(rect.bottom + 2))}px`;
        optionBtn.style.display = "inline-flex";
    }

    function isCellDateValue(cell) {
        if (!cell) return false;
        if (cell.dataset.valueType === "date") return true;
        if (isDateNumFormat(cell.dataset.numFormat) && !isTimeNumFormat(cell.dataset.numFormat)) {
            const raw = cell.dataset.rawValue ?? getCellPureText(cell);
            return resolveDateFromRawValue(raw) !== null;
        }
        return false;
    }

    function snapshotFullCell(cell) {
        if (!cell) return null;
        return {
            row: parseInt(cell.dataset.row, 10),
            col: parseInt(cell.dataset.col, 10),
            value: cell.dataset.rawValue ?? getCellPureText(cell),
            formula: cell.dataset.formula || "",
            quotePrefix: cell.dataset.quotePrefix || "",
            valueType: cell.dataset.valueType || "",
            dateValue: cell.dataset.dateValue || "",
            numFormat: cell.dataset.numFormat || "",
            decimalPlaces: cell.dataset.decimalPlaces ?? "",
            dropdownList: cell.dataset.dropdownList || "",
            dvRule: cell.dataset.dvRule || "",
            richRuns: cell.dataset.richRuns || "",
            hyperlink: cell.dataset.hyperlink || "",
            note: cell.dataset.note || "",
            comment: cell.dataset.comment || "",
            indent: cell.dataset.indent || "",
            shrinkToFit: cell.dataset.shrinkToFit || "",
            textRotation: cell.dataset.textRotation || "",
            locked: cell.dataset.locked || "",
            formulaHidden: cell.dataset.formulaHidden || "",
            styleObj: extractCellStyleObject(cell),
            rowspan: parseInt(cell.getAttribute("rowspan") || "1", 10),
            colspan: parseInt(cell.getAttribute("colspan") || "1", 10),
            isHiddenSub: cell.style.display === "none" && Boolean(cell.dataset.mergeAnchorRow),
            mergeAnchorRow: cell.dataset.mergeAnchorRow || "",
            mergeAnchorCol: cell.dataset.mergeAnchorCol || ""
        };
    }

    function restoreFullCellSnapshot(cell, snap) {
        if (!cell || !snap) return;
        clearSpillCellsFromAnchor?.(snap.row, snap.col);
        clearAppliedConditionalStyle(cell);
        delete cell.dataset.cfIcon;
        cell.style.removeProperty("--cf-icon-color");
        cell.removeAttribute("rowspan");
        cell.removeAttribute("colspan");
        cell.className = "";
        cell.removeAttribute("title");
        Object.keys(cell.dataset).forEach(k => {
            if (k !== "row" && k !== "col") delete cell.dataset[k];
        });

        if (snap.isHiddenSub) {
            cell.textContent = "";
            cell.removeAttribute("style");
            cell.style.display = "none";
            if (snap.mergeAnchorRow) cell.dataset.mergeAnchorRow = snap.mergeAnchorRow;
            if (snap.mergeAnchorCol) cell.dataset.mergeAnchorCol = snap.mergeAnchorCol;
            return;
        }

        if (snap.quotePrefix === "1") cell.dataset.quotePrefix = "1";
        if (snap.numFormat) cell.dataset.numFormat = snap.numFormat;
        if (snap.decimalPlaces !== "") cell.dataset.decimalPlaces = snap.decimalPlaces;
        if (snap.dropdownList) cell.dataset.dropdownList = snap.dropdownList;
        if (snap.dvRule) cell.dataset.dvRule = snap.dvRule;
        if (snap.valueType) cell.dataset.valueType = snap.valueType;
        if (snap.dateValue) cell.dataset.dateValue = snap.dateValue;
        if (snap.richRuns && !snap.formula) cell.dataset.richRuns = snap.richRuns;
        if (snap.note) cell.dataset.note = snap.note;
        if (snap.comment) cell.dataset.comment = snap.comment;
        if (snap.indent) cell.dataset.indent = snap.indent;
        if (snap.shrinkToFit === "1") cell.dataset.shrinkToFit = "1";
        if (snap.textRotation) cell.dataset.textRotation = snap.textRotation;
        if (snap.locked === "0") cell.dataset.locked = "0";
        if (snap.formulaHidden === "1") cell.dataset.formulaHidden = "1";
        if (snap.hyperlink) {
            cell.dataset.hyperlink = snap.hyperlink;
            cell.classList.add("ss-hyperlink");
            cell.title = `${snap.hyperlink}（Ctrl+クリックで開く）`;
        }

        applyCellStyleData(cell, snap.styleObj);
        if (snap.formula) {
            cell.dataset.formula = snap.formula;
        }
        setCellFormattedValue(cell, snap.value);
        syncCellAnnotationMark?.(cell);
        if (snap.shrinkToFit === "1") applyShrinkToFit?.(cell);

        if (snap.rowspan > 1 || snap.colspan > 1) {
            const maxR = snap.row + snap.rowspan - 1;
            const maxC = snap.col + snap.colspan - 1;
            cell.setAttribute("rowspan", String(snap.rowspan));
            cell.setAttribute("colspan", String(snap.colspan));
            cell.classList.add("merged");
            cell.dataset.mergeMinRow = String(snap.row);
            cell.dataset.mergeMaxRow = String(maxR);
            cell.dataset.mergeMinCol = String(snap.col);
            cell.dataset.mergeMaxCol = String(maxC);
        }
    }

    function applyFormatOnlyFromSnap(srcSnap, targetCell) {
        if (!srcSnap || !targetCell) return;
        if (srcSnap.numFormat) targetCell.dataset.numFormat = srcSnap.numFormat;
        else delete targetCell.dataset.numFormat;
        if (srcSnap.decimalPlaces !== "") targetCell.dataset.decimalPlaces = srcSnap.decimalPlaces;
        else delete targetCell.dataset.decimalPlaces;
        if (srcSnap.indent) targetCell.dataset.indent = srcSnap.indent;
        else delete targetCell.dataset.indent;
        if (srcSnap.shrinkToFit === "1") targetCell.dataset.shrinkToFit = "1";
        else {
            delete targetCell.dataset.shrinkToFit;
            delete targetCell.dataset.origFontSize;
        }
        if (srcSnap.textRotation) targetCell.dataset.textRotation = srcSnap.textRotation;
        else delete targetCell.dataset.textRotation;
        if (srcSnap.locked === "0") targetCell.dataset.locked = "0";
        else delete targetCell.dataset.locked;
        if (srcSnap.formulaHidden === "1") targetCell.dataset.formulaHidden = "1";
        else delete targetCell.dataset.formulaHidden;

        applyCellStyleData(targetCell, srcSnap.styleObj);
        const curRaw = targetCell.dataset.formula
            ? (targetCell.dataset.rawValue ?? "")
            : (targetCell.dataset.rawValue ?? getCellPureText(targetCell));
        setCellFormattedValue(targetCell, curRaw);
        if (srcSnap.shrinkToFit === "1") applyShrinkToFit?.(targetCell);
    }

    function generateSeriesStep(seedValues, stepIndex, opts = {}) {
        const {
            forceSeries = false,
            isDateSeries = false,
            mode = "auto" // "auto" | "copy" | "series" | "days" | "weekdays" | "months" | "years"
        } = opts;
        const n = seedValues.length;
        if (n === 0) return "";
        const modIdx = ((stepIndex % n) + n) % n;
        const base = seedValues[modIdx];
        if (mode === "copy") return base;
        if (stepIndex >= 0 && stepIndex < n) return base;

        const first = String(seedValues[0] ?? "").trim();
        const last = String(seedValues[n - 1] ?? "").trim();

        // 1. 日付シリアル／日付文字列の連続（日・週日・月・年単位）
        if (isDateSeries || ["days", "weekdays", "months", "years"].includes(mode)) {
            const d0 = resolveDateFromRawValue(first);
            if (d0) {
                const s0 = dateToSerial(d0);
                if (mode === "auto" && forceSeries && n === 1) return String(s0);

                if (mode === "weekdays") {
                    const dt = addWeekdays(d0, stepIndex);
                    return String(dateToSerial(dt));
                }
                if (mode === "months") {
                    let monthStep = 1;
                    if (n >= 2) {
                        const dLast = resolveDateFromRawValue(last);
                        if (dLast) {
                            const diffM = (dLast.getFullYear() - d0.getFullYear()) * 12 + (dLast.getMonth() - d0.getMonth());
                            const avgM = diffM / (n - 1);
                            if (Number.isInteger(avgM) && avgM !== 0) monthStep = avgM;
                        }
                    }
                    const dt = addMonthsClamped(d0, monthStep * stepIndex);
                    return String(dateToSerial(dt));
                }
                if (mode === "years") {
                    let yearStep = 1;
                    if (n >= 2) {
                        const dLast = resolveDateFromRawValue(last);
                        if (dLast) {
                            const avgY = (dLast.getFullYear() - d0.getFullYear()) / (n - 1);
                            if (Number.isInteger(avgY) && avgY !== 0) yearStep = avgY;
                        }
                    }
                    const dt = addMonthsClamped(d0, yearStep * 12 * stepIndex);
                    return String(dateToSerial(dt));
                }

                let dayStep = 1;
                if (n >= 2) {
                    const dLast = resolveDateFromRawValue(last);
                    if (dLast) {
                        dayStep = Math.round((dateToSerial(dLast) - s0) / (n - 1));
                    }
                }
                return String(s0 + dayStep * stepIndex);
            }
        }

        // 2. 数値（auto: 1セルはコピー、Ctrlまたは明示series指定時は+1、2セル以上は等差数列）
        const nums = seedValues.map(v => parseFormattedNumber(v));
        if (nums.every(v => !isNaN(v)) && seedValues.every(v => String(v).trim() !== "")) {
            if (n === 1) {
                const shouldInc = mode === "series" || (mode === "auto" && forceSeries);
                return shouldInc ? String(nums[0] + stepIndex) : String(nums[0]);
            }
            const stepDiff = (nums[n - 1] - nums[0]) / (n - 1);
            const val = nums[0] + stepDiff * stepIndex;
            return String(Number(val.toPrecision(15)));
        }

        // 3. 文字列形式の日付連続フォールバック
        const parsedFirstDate = parseJapaneseDateInput(first, { allowShortMD: false });
        if (parsedFirstDate) {
            let dayStep = 1;
            const parsedLastDate = n >= 2 ? parseJapaneseDateInput(last, { allowShortMD: false }) : null;
            if (parsedLastDate) {
                dayStep = Math.round((parsedLastDate.serial - parsedFirstDate.serial) / (n - 1)) || 1;
            }
            return formatDate(serialToDate(parsedFirstDate.serial + dayStep * stepIndex));
        }

        // 4. 曜日・月名・四半期リスト（逆方向対応）
        for (const list of CYCLIC_LISTS) {
            const idx = list.indexOf(first);
            if (idx !== -1) {
                let listStep = 1;
                if (n >= 2) {
                    const lastIdx = list.indexOf(last);
                    if (lastIdx !== -1) {
                        const rawDiff = ((lastIdx - idx) + list.length) % list.length;
                        if (rawDiff > 0 && rawDiff % (n - 1) === 0) {
                            listStep = rawDiff / (n - 1);
                        }
                    }
                }
                const nextIdx = ((idx + stepIndex * listStep) % list.length + list.length) % list.length;
                return list[nextIdx];
            }
        }

        // 5. 文字列＋末尾数字（単一セルは+1、複数セルは増分ステップを計算）
        const suffixMatch = first.match(/^(.*?)(\d+)$/);
        if (suffixMatch) {
            const prefix = suffixMatch[1];
            const numPart = suffixMatch[2];
            const startNum = parseInt(numPart, 10);
            let numStep = 1;
            if (n >= 2) {
                const lastMatch = last.match(/^(.*?)(\d+)$/);
                if (lastMatch && lastMatch[1] === prefix) {
                    const diff = (parseInt(lastMatch[2], 10) - startNum) / (n - 1);
                    if (Number.isInteger(diff)) numStep = diff;
                }
            }
            const nextNum = Math.max(0, startNum + numStep * stepIndex);
            return prefix + String(nextNum).padStart(numPart.length, "0");
        }

        return base;
    }

    function cloneCellProperties(sourceCell, targetCell, overrideValue = null) {
        if (!sourceCell || !targetCell || sourceCell === targetCell) return;

        if (sourceCell.dataset.numFormat) targetCell.dataset.numFormat = sourceCell.dataset.numFormat;
        else delete targetCell.dataset.numFormat;

        if (sourceCell.dataset.decimalPlaces !== undefined && sourceCell.dataset.decimalPlaces !== "") {
            targetCell.dataset.decimalPlaces = sourceCell.dataset.decimalPlaces;
        } else {
            delete targetCell.dataset.decimalPlaces;
        }

        if (sourceCell.dataset.dropdownList) targetCell.dataset.dropdownList = sourceCell.dataset.dropdownList;
        else delete targetCell.dataset.dropdownList;

        if (sourceCell.dataset.dvRule) targetCell.dataset.dvRule = sourceCell.dataset.dvRule;
        else delete targetCell.dataset.dvRule;

        if (sourceCell.dataset.quotePrefix === "1") targetCell.dataset.quotePrefix = "1";
        else delete targetCell.dataset.quotePrefix;

        if (sourceCell.dataset.indent) targetCell.dataset.indent = sourceCell.dataset.indent;
        else delete targetCell.dataset.indent;

        if (sourceCell.dataset.shrinkToFit === "1") targetCell.dataset.shrinkToFit = "1";
        else {
            delete targetCell.dataset.shrinkToFit;
            delete targetCell.dataset.origFontSize;
        }

        if (sourceCell.dataset.textRotation) targetCell.dataset.textRotation = sourceCell.dataset.textRotation;
        else delete targetCell.dataset.textRotation;

        if (sourceCell.dataset.locked === "0") targetCell.dataset.locked = "0";
        else delete targetCell.dataset.locked;

        if (sourceCell.dataset.formulaHidden === "1") targetCell.dataset.formulaHidden = "1";
        else delete targetCell.dataset.formulaHidden;

        if (sourceCell.dataset.richRuns && overrideValue === null) {
            targetCell.dataset.richRuns = sourceCell.dataset.richRuns;
        } else {
            delete targetCell.dataset.richRuns;
        }

        if (sourceCell.dataset.hyperlink) {
            targetCell.dataset.hyperlink = sourceCell.dataset.hyperlink;
            targetCell.classList.add("ss-hyperlink");
            targetCell.title = sourceCell.title;
        } else {
            delete targetCell.dataset.hyperlink;
            targetCell.classList.remove("ss-hyperlink");
            targetCell.removeAttribute("title");
        }

        if (sourceCell.dataset.formula?.startsWith("=")) {
            const rowOffset = (+targetCell.dataset.row) - (+sourceCell.dataset.row);
            const colOffset = (+targetCell.dataset.col) - (+sourceCell.dataset.col);
            const nextFormula = overrideValue !== null && String(overrideValue).startsWith("=")
                ? overrideValue
                : adjustFormula(sourceCell.dataset.formula, rowOffset, colOffset);
            targetCell.dataset.formula = nextFormula;
            delete targetCell.dataset.valueType;
            delete targetCell.dataset.dateValue;
        } else {
            delete targetCell.dataset.formula;
            const nextVal = overrideValue !== null ? overrideValue : (sourceCell.dataset.rawValue ?? sourceCell.textContent);
            if (isCellDateValue(sourceCell)) {
                const dt = resolveDateFromRawValue(nextVal);
                if (dt) {
                    targetCell.dataset.valueType = "date";
                    targetCell.dataset.dateValue = String(dt.getTime());
                    setCellFormattedValue(targetCell, String(dateToSerial(dt)));
                } else {
                    delete targetCell.dataset.valueType;
                    delete targetCell.dataset.dateValue;
                    setCellFormattedValue(targetCell, nextVal);
                }
            } else {
                delete targetCell.dataset.valueType;
                delete targetCell.dataset.dateValue;
                setCellFormattedValue(targetCell, nextVal);
            }
        }

        applyCellStyleData(targetCell, extractCellStyleObject(sourceCell));
        if (sourceCell.dataset.shrinkToFit === "1") applyShrinkToFit?.(targetCell);
        targetCell.removeAttribute("contenteditable");
        targetCell.classList.remove("selected", "fill-selected", "active-cell");
    }

    function applyValueOnlyFromSnap(srcSnap, targetCell, valueOrFormula) {
        if (!srcSnap || !targetCell) return;
        clearSpillCellsFromAnchor?.(parseInt(targetCell.dataset.row, 10), parseInt(targetCell.dataset.col, 10));
        delete targetCell.dataset.spillOrigin;
        delete targetCell.dataset.richRuns;

        if (srcSnap.quotePrefix === "1") targetCell.dataset.quotePrefix = "1";
        else delete targetCell.dataset.quotePrefix;

        if (srcSnap.formula?.startsWith("=")) {
            const rowOffset = parseInt(targetCell.dataset.row, 10) - srcSnap.row;
            const colOffset = parseInt(targetCell.dataset.col, 10) - srcSnap.col;
            const nextFormula = valueOrFormula !== null && String(valueOrFormula).startsWith("=")
                ? valueOrFormula
                : adjustFormula(srcSnap.formula, rowOffset, colOffset);
            targetCell.dataset.formula = nextFormula;
            delete targetCell.dataset.valueType;
            delete targetCell.dataset.dateValue;
        } else {
            delete targetCell.dataset.formula;
            const nextVal = valueOrFormula !== null ? valueOrFormula : srcSnap.value;
            const srcIsDate = srcSnap.valueType === "date" || (isDateNumFormat(srcSnap.numFormat) && !isTimeNumFormat(srcSnap.numFormat));
            if (srcIsDate) {
                const dt = resolveDateFromRawValue(nextVal);
                if (dt) {
                    targetCell.dataset.valueType = "date";
                    targetCell.dataset.dateValue = String(dt.getTime());
                    setCellFormattedValue(targetCell, String(dateToSerial(dt)));
                    return;
                }
            }
            delete targetCell.dataset.valueType;
            delete targetCell.dataset.dateValue;
            setCellFormattedValue(targetCell, nextVal);
        }
    }

    function extendConditionalFormatsForFill(srcRange, dstRange) {
        const rules = getSheets()[getActiveSheetIndex()]?.conditionalFormats;
        if (!Array.isArray(rules) || !rules.length || !srcRange || !dstRange) return;

        const isVerticalFill = dstRange.minCol === srcRange.minCol && dstRange.maxCol === srcRange.maxCol;
        const isHorizontalFill = dstRange.minRow === srcRange.minRow && dstRange.maxRow === srcRange.maxRow;

        rules.forEach(rule => {
            const overlapsSrc = !(
                rule.maxRow < srcRange.minRow || rule.minRow > srcRange.maxRow ||
                rule.maxCol < srcRange.minCol || rule.minCol > srcRange.maxCol
            );
            if (!overlapsSrc) return;

            if (isVerticalFill) {
                if (dstRange.maxRow > rule.maxRow) rule.maxRow = dstRange.maxRow;
                if (dstRange.minRow < rule.minRow) {
                    const rowShift = dstRange.minRow - rule.minRow;
                    if (rule.formula && String(rule.formula).trim().startsWith("=")) {
                        rule.formula = adjustFormula(rule.formula, rowShift, 0);
                    }
                    if (typeof rule.val1 === "string" && rule.val1.trim().startsWith("=")) {
                        rule.val1 = adjustFormula(rule.val1, rowShift, 0);
                    }
                    if (typeof rule.val2 === "string" && rule.val2.trim().startsWith("=")) {
                        rule.val2 = adjustFormula(rule.val2, rowShift, 0);
                    }
                    rule.minRow = dstRange.minRow;
                }
            } else if (isHorizontalFill && rule.minRow >= srcRange.minRow && rule.maxRow <= srcRange.maxRow) {
                if (dstRange.maxCol > rule.maxCol) rule.maxCol = dstRange.maxCol;
                if (dstRange.minCol < rule.minCol) {
                    const colShift = dstRange.minCol - rule.minCol;
                    if (rule.formula && String(rule.formula).trim().startsWith("=")) {
                        rule.formula = adjustFormula(rule.formula, 0, colShift);
                    }
                    if (typeof rule.val1 === "string" && rule.val1.trim().startsWith("=")) {
                        rule.val1 = adjustFormula(rule.val1, 0, colShift);
                    }
                    if (typeof rule.val2 === "string" && rule.val2.trim().startsWith("=")) {
                        rule.val2 = adjustFormula(rule.val2, 0, colShift);
                    }
                    rule.minCol = dstRange.minCol;
                }
            }
        });
    }

    function detectInitialFillMode(srcRange, templateGrid, forceSeries) {
        const initRCount = templateGrid.length;
        const initCCount = templateGrid[0]?.length || 0;
        let hasDate = false;
        let hasDateFormula = false;
        let hasSeriesCapable = false;
        let hasFormula = false;

        for (let rr = 0; rr < initRCount; rr++) {
            for (let cc = 0; cc < initCCount; cc++) {
                const entry = templateGrid[rr][cc];
                if (!entry || entry.isHiddenSub || !entry.snap) continue;
                const snap = entry.snap;
                const isDate = snap.valueType === "date" || (isDateNumFormat(snap.numFormat) && !isTimeNumFormat(snap.numFormat));
                if (snap.formula?.startsWith("=")) {
                    hasFormula = true;
                    if (isDate) hasDateFormula = true;
                } else {
                    if (isDate) {
                        hasDate = true;
                        hasSeriesCapable = true;
                    } else {
                        const s = String(snap.value ?? "").trim();
                        if (s !== "") {
                            if (!isNaN(parseFormattedNumber(s))) {
                                if (initRCount > 1 || initCCount > 1 || forceSeries) hasSeriesCapable = true;
                            } else if (CYCLIC_LISTS.some(list => list.includes(s)) || /^(.*?)(\d+)$/.test(s)) {
                                hasSeriesCapable = true;
                            }
                        }
                    }
                }
            }
        }

        let defaultMode = "copy";
        if (hasDate) {
            defaultMode = forceSeries ? "copy" : "series";
        } else if (hasDateFormula) {
            defaultMode = forceSeries ? "days" : "copy";
        } else if (hasSeriesCapable && !hasFormula) {
            defaultMode = "series";
        } else if (!hasFormula && forceSeries) {
            defaultMode = "series";
        }

        return {
            defaultMode,
            hasDate: hasDate || hasDateFormula,
            hasDateFormula
        };
    }

    function applyAutoFillMode(context, mode) {
        const {
            srcRange,
            fillRange,
            templateGrid,
            beforeDestSnapshots,
            beforeConditionalFormats,
            fillSourceCell,
            forceSeries,
            defaultValueMode
        } = context;

        const isInInitial = (r, c) =>
            r >= srcRange.minRow && r <= srcRange.maxRow &&
            c >= srcRange.minCol && c <= srcRange.maxCol;

        // 1. 条件付き書式・フィル先セルをフィル直前の状態へ完全復元
        const sheet = getSheets()[getActiveSheetIndex()];
        if (sheet) {
            sheet.conditionalFormats = JSON.parse(JSON.stringify(beforeConditionalFormats));
        }
        beforeDestSnapshots.forEach((snap) => {
            const cell = getCell(snap.row, snap.col);
            if (cell) restoreFullCellSnapshot(cell, snap);
        });

        const initRCount = srcRange.maxRow - srcRange.minRow + 1;
        const initCCount = srcRange.maxCol - srcRange.minCol + 1;

        const effectiveValueMode = mode === "values" ? defaultValueMode : mode;
        const copyStyles = mode !== "values";
        const copyValues = mode !== "formats";

        const isSnapDate = (snap) => Boolean(
            snap && (snap.valueType === "date" || (isDateNumFormat(snap.numFormat) && !isTimeNumFormat(snap.numFormat)))
        );

        // 2. 選択されたオプションモードでフィル先へ再適用
        for (let r = fillRange.minRow; r <= fillRange.maxRow; r++) {
            for (let c = fillRange.minCol; c <= fillRange.maxCol; c++) {
                if (isInInitial(r, c)) continue;
                const tgt = getCell(r, c);
                if (!tgt) continue;

                const rOffset = r - srcRange.minRow;
                const cOffset = c - srcRange.minCol;
                const tplR = ((rOffset % initRCount) + initRCount) % initRCount;
                const tplC = ((cOffset % initCCount) + initCCount) % initCCount;
                const tpl = templateGrid[tplR][tplC];
                if (!tpl || tpl.isHiddenSub) continue;

                const srcCell = tpl.cell || fillSourceCell;
                const srcSnap = tpl.snap;

                if (!copyValues && copyStyles) {
                    applyFormatOnlyFromSnap(srcSnap, tgt);
                    continue;
                }

                // 方向と連続インデックスを算出
                let stepIdx = 0;
                let seedEntries = [];
                if (r > srcRange.maxRow && cOffset >= 0 && cOffset < initCCount) {
                    let seedPos = 0;
                    for (let rr = 0; rr < initRCount; rr++) {
                        const entry = templateGrid[rr][tplC];
                        if (entry && !entry.isHiddenSub) {
                            if (rr === tplR) seedPos = seedEntries.length;
                            seedEntries.push(entry);
                        }
                    }
                    const cycle = Math.floor(rOffset / initRCount);
                    stepIdx = cycle * seedEntries.length + seedPos;
                } else if (r < srcRange.minRow && cOffset >= 0 && cOffset < initCCount) {
                    for (let rr = 0; rr < initRCount; rr++) {
                        const entry = templateGrid[rr][tplC];
                        if (entry && !entry.isHiddenSub) seedEntries.push(entry);
                    }
                    stepIdx = r - srcRange.minRow;
                } else if (c > srcRange.maxCol && rOffset >= 0 && rOffset < initRCount) {
                    let seedPos = 0;
                    for (let cc = 0; cc < initCCount; cc++) {
                        const entry = templateGrid[tplR][cc];
                        if (entry && !entry.isHiddenSub) {
                            if (cc === tplC) seedPos = seedEntries.length;
                            seedEntries.push(entry);
                        }
                    }
                    const cycle = Math.floor(cOffset / initCCount);
                    stepIdx = cycle * seedEntries.length + seedPos;
                } else if (c < srcRange.minCol && rOffset >= 0 && rOffset < initRCount) {
                    for (let cc = 0; cc < initCCount; cc++) {
                        const entry = templateGrid[tplR][cc];
                        if (entry && !entry.isHiddenSub) seedEntries.push(entry);
                    }
                    stepIdx = c - srcRange.minCol;
                }

                let computedOverride = null;
                if (srcSnap.formula?.startsWith("=")) {
                    // =TODAY() 等の日付結果数式セルで連続系オプション選択時は数式のまま連続展開
                    if (isSnapDate(srcSnap) && ["series", "days", "weekdays", "months", "years"].includes(effectiveValueMode)) {
                        const unit = effectiveValueMode === "series" ? "days" : effectiveValueMode;
                        let dayStep = 1;
                        if (seedEntries.length >= 2) {
                            const d0 = resolveDateFromRawValue(seedEntries[0].snap?.value);
                            const dLast = resolveDateFromRawValue(seedEntries[seedEntries.length - 1].snap?.value);
                            if (d0 && dLast) {
                                dayStep = Math.round((dateToSerial(dLast) - dateToSerial(d0)) / (seedEntries.length - 1)) || 1;
                            }
                        }
                        const formulaBase = seedEntries[0]?.snap?.formula || srcSnap.formula;
                        computedOverride = buildDateFormulaStep(formulaBase, stepIdx, unit, dayStep);
                    }
                } else if (seedEntries.length > 0) {
                    const seedValues = seedEntries.map(e => e.snap?.value ?? "");
                    const allDate = seedEntries.every(e => isSnapDate(e.snap));
                    computedOverride = generateSeriesStep(seedValues, stepIdx, {
                        forceSeries,
                        isDateSeries: allDate,
                        mode: effectiveValueMode
                    });
                }

                if (copyStyles) {
                    if (tgt !== srcCell) {
                        cloneCellProperties(srcCell, tgt, computedOverride);
                    }
                    // コピー元が結合セルの場合、コピー先にも同じ結合サイズと非表示サブセルを構築
                    const spanR = Math.min(tpl.rs, fillRange.maxRow - r + 1);
                    const spanC = Math.min(tpl.cs, fillRange.maxCol - c + 1);
                    if (spanR > 1 || spanC > 1) {
                        const maxMR = r + spanR - 1;
                        const maxMC = c + spanC - 1;
                        tgt.setAttribute("rowspan", String(spanR));
                        tgt.setAttribute("colspan", String(spanC));
                        tgt.classList.add("merged");
                        tgt.dataset.mergeMinRow = String(r);
                        tgt.dataset.mergeMaxRow = String(maxMR);
                        tgt.dataset.mergeMinCol = String(c);
                        tgt.dataset.mergeMaxCol = String(maxMC);

                        for (let mr = r; mr <= maxMR; mr++) {
                            for (let mc = c; mc <= maxMC; mc++) {
                                if (mr === r && mc === c) continue;
                                const sub = getCell(mr, mc);
                                if (sub) {
                                    sub.textContent = "";
                                    sub.removeAttribute("style");
                                    sub.removeAttribute("rowspan");
                                    sub.removeAttribute("colspan");
                                    sub.style.display = "none";
                                    sub.className = "";
                                    sub.dataset.mergeAnchorRow = String(r);
                                    sub.dataset.mergeAnchorCol = String(c);
                                }
                            }
                        }
                    }
                } else {
                    applyValueOnlyFromSnap(srcSnap, tgt, computedOverride);
                }
            }
        }

        if (copyStyles) {
            extendConditionalFormatsForFill(srcRange, fillRange);
        }

        // フィル後の範囲を選択状態に揃える
        clearSelection();
        setSelectionBounds(
            { row: fillRange.minRow, col: fillRange.minCol },
            { row: fillRange.maxRow, col: fillRange.maxCol }
        );
        for (let r = fillRange.minRow; r <= fillRange.maxRow; r++) {
            for (let c = fillRange.minCol; c <= fillRange.maxCol; c++) {
                const vis = getVisibleCell(r, c);
                if (vis && vis.style.display !== "none") {
                    vis.classList.add("selected");
                }
            }
        }
        if (fillSourceCell) fillSourceCell.classList.add("active-cell");

        context.currentMode = mode;
        syncCellGridlinesForBounds?.(fillRange);
        updateAllFormulas();
        applyConditionalFormats();
        updateSelectedCellsDisplay();
        updateFillHandle();
        syncAutoFillOptionButtonPosition();
        setDirtyState(true);
        debouncedSaveState();
    }

    function executeFillOperation(srcRange, fillRange, { forceSeries = false, sourceCell = null } = {}) {
        const isInInitial = (r, c) =>
            r >= srcRange.minRow && r <= srcRange.maxRow &&
            c >= srcRange.minCol && c <= srcRange.maxCol;

        // シート保護・結合衝突チェック
        for (let r = fillRange.minRow; r <= fillRange.maxRow; r++) {
            for (let c = fillRange.minCol; c <= fillRange.maxCol; c++) {
                if (isInInitial(r, c)) continue;
                const cell = getCell(r, c);
                if (!cell) continue;
                if (isCurrentSheetProtected?.() && isCellLockedForEdit?.(cell)) {
                    showAlert("保護されたシート上のロックされたセルにはオートフィルできません。", "シートの保護");
                    return false;
                }
                const isMergedPart =
                    cell.style.display === "none" ||
                    cell.classList.contains("merged") ||
                    Boolean(cell.dataset.mergeMinRow) ||
                    Boolean(cell.dataset.mergeAnchorRow) ||
                    parseInt(cell.getAttribute("rowspan") || "1", 10) > 1 ||
                    parseInt(cell.getAttribute("colspan") || "1", 10) > 1;
                if (isMergedPart) {
                    showAlert("結合されたセルの一部を変更することはできません。", "オートフィルエラー");
                    return false;
                }
            }
        }

        const initRCount = srcRange.maxRow - srcRange.minRow + 1;
        const initCCount = srcRange.maxCol - srcRange.minCol + 1;
        const templateGrid = [];
        for (let rr = 0; rr < initRCount; rr++) {
            const rowTemplates = [];
            for (let cc = 0; cc < initCCount; cc++) {
                const sc = getCell(srcRange.minRow + rr, srcRange.minCol + cc);
                const rs = parseInt(sc?.getAttribute("rowspan") || "1", 10);
                const cs = parseInt(sc?.getAttribute("colspan") || "1", 10);
                const isHiddenSub = sc?.style.display === "none" && Boolean(sc?.dataset.mergeAnchorRow);
                rowTemplates.push({ cell: sc, snap: snapshotFullCell(sc), rs, cs, isHiddenSub });
            }
            templateGrid.push(rowTemplates);
        }

        const beforeDestSnapshots = [];
        for (let r = fillRange.minRow; r <= fillRange.maxRow; r++) {
            for (let c = fillRange.minCol; c <= fillRange.maxCol; c++) {
                if (isInInitial(r, c)) continue;
                const td = getCell(r, c);
                if (td) beforeDestSnapshots.push(snapshotFullCell(td));
            }
        }
        const beforeConditionalFormats = JSON.parse(
            JSON.stringify(getSheets()[getActiveSheetIndex()]?.conditionalFormats || [])
        );

        const { defaultMode, hasDate } = detectInitialFillMode(srcRange, templateGrid, forceSeries);
        const context = {
            srcRange: { ...srcRange },
            fillRange: { ...fillRange },
            templateGrid,
            beforeDestSnapshots,
            beforeConditionalFormats,
            fillSourceCell: sourceCell || getActiveCell(),
            forceSeries,
            hasDate,
            defaultValueMode: defaultMode,
            currentMode: defaultMode
        };
        activeAutoFillContext = context;
        applyAutoFillMode(context, defaultMode);
        return true;
    }

    function openAutoFillOptionMenu() {
        if (!activeAutoFillContext) return;
        if (activeMenuEl) {
            closeAutoFillOptionMenu();
            return;
        }
        const ctxData = activeAutoFillContext;
        const options = [
            { id: "copy", label: "セルのコピー(C)" },
            { id: "series", label: "連続データ(S)" },
            { id: "formats", label: "書式のみコピー(F)" },
            { id: "values", label: "書式なしコピー(O)" }
        ];
        if (ctxData.hasDate) {
            options.push(
                { sep: true },
                { id: "days", label: "日単位(D)" },
                { id: "weekdays", label: "週日単位(W)" },
                { id: "months", label: "月単位(M)" },
                { id: "years", label: "年単位(Y)" }
            );
        }

        const menu = document.createElement("div");
        menu.className = "ss-autofill-opt-menu";
        menu.innerHTML = options.map(opt => {
            if (opt.sep) return `<div class="ss-afo-sep"></div>`;
            const active = ctxData.currentMode === opt.id;
            return `
                <div class="ss-afo-item ${active ? "active" : ""}" data-afo-mode="${opt.id}">
                    <span class="ss-afo-radio">${active ? "●" : "○"}</span>
                    <span>${opt.label}</span>
                </div>
            `;
        }).join("");

        document.body.appendChild(menu);
        activeMenuEl = menu;
        optionBtn.classList.add("open");

        const btnRect = optionBtn.getBoundingClientRect();
        const menuW = menu.offsetWidth || 175;
        const menuH = menu.offsetHeight || 180;
        const left = Math.min(window.innerWidth - menuW - 8, Math.max(8, btnRect.left));
        const top = (btnRect.bottom + menuH + 8 <= window.innerHeight)
            ? btnRect.bottom + 2
            : Math.max(8, btnRect.top - menuH - 2);
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;

        menu.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const item = e.target.closest("[data-afo-mode]");
            if (!item || !activeAutoFillContext) return;
            const mode = item.dataset.afoMode;
            applyAutoFillMode(activeAutoFillContext, mode);
            closeAutoFillOptionMenu();
        });
    }

    optionBtn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        openAutoFillOptionMenu();
    }, { signal });

    document.addEventListener("mousedown", (e) => {
        if (e.target.closest(".ss-autofill-opt-btn, .ss-autofill-opt-menu")) return;
        closeAutoFillOptionMenu();
    }, { signal });

    function updateFillHandle() {
        tbody.querySelectorAll(".fill-handle").forEach(h => h.remove());
        const selected = [...tbody.querySelectorAll("td.selected")];
        if (!selected.length) return;

        let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
        let coveredCount = 0;
        for (const c of selected) {
            const r0 = +c.dataset.row;
            const c0 = +c.dataset.col;
            const rs = +c.getAttribute("rowspan") || 1;
            const cs = +c.getAttribute("colspan") || 1;
            if (r0 < minR) minR = r0;
            if (r0 + rs - 1 > maxR) maxR = r0 + rs - 1;
            if (c0 < minC) minC = c0;
            if (c0 + cs - 1 > maxC) maxC = c0 + cs - 1;
            coveredCount += rs * cs;
        }
        // 非連続（複数範囲）選択時は Excel 同様にフィルハンドルを非表示にする
        if (coveredCount !== (maxR - minR + 1) * (maxC - minC + 1)) return;

        const target = getVisibleCell(maxR, maxC);
        if (!target || target.isContentEditable || target.style.display === "none") return;

        const fh = document.createElement("div");
        fh.className = "fill-handle";
        fh.title = "ドラッグで連続コピー / ダブルクリックで下端まで一括コピー";
        target.appendChild(fh);

        fh.addEventListener("dblclick", (e) => {
            e.stopPropagation();
            e.preventDefault();
            const bounds = getSelectedRangeBounds();
            if (!bounds) return;

            const hasDataAt = (r, c) => {
                const cell = peekCell(r, c);
                if (!cell || cell.style.display === "none") return false;
                return Boolean(cell.dataset.formula || (cell.dataset.rawValue ?? cell.textContent).trim() !== "");
            };

            const curRowCount = getRowCount();
            const curCols = getCurrentColumns();
            const refCol = bounds.minCol > 0 && hasDataAt(bounds.maxRow, bounds.minCol - 1)
                ? bounds.minCol - 1
                : (bounds.maxCol + 1 < curCols && hasDataAt(bounds.maxRow, bounds.maxCol + 1) ? bounds.maxCol + 1 : -1);
            if (refCol === -1) return;

            let endRow = bounds.maxRow;
            while (endRow + 1 < curRowCount && hasDataAt(endRow + 1, refCol)) {
                endRow++;
            }
            if (endRow <= bounds.maxRow) return;

            executeFillOperation(bounds, {
                minRow: bounds.minRow,
                maxRow: endRow,
                minCol: bounds.minCol,
                maxCol: bounds.maxCol
            }, { forceSeries: false, sourceCell: getActiveCell() });
        }, { signal });

        fh.addEventListener("mousedown", (e) => {
            const activeCell = getActiveCell();
            if (activeCell && activeCell.isContentEditable) return;
            e.stopPropagation();
            e.preventDefault();
            hideAutoFillOptions();
            isFillDragging = true;
            fillDragStartCell = activeCell;
            const startClientX = e.clientX;
            const startClientY = e.clientY;

            let minRow = Infinity, maxRow = -Infinity, minCol = Infinity, maxCol = -Infinity;
            tbody.querySelectorAll("td.selected").forEach(c => {
                const r0 = +c.dataset.row, col0 = +c.dataset.col;
                const r1 = r0 + (+c.getAttribute("rowspan") || 1) - 1;
                const col1 = col0 + (+c.getAttribute("colspan") || 1) - 1;
                minRow = Math.min(minRow, r0);
                maxRow = Math.max(maxRow, r1);
                minCol = Math.min(minCol, col0);
                maxCol = Math.max(maxCol, col1);
            });
            initialFillRange = { minRow, maxRow, minCol, maxCol };

            const clearFillPreview = () => {
                const fillEdgeClasses = ["fill-selected", "fill-edge-top", "fill-edge-bottom", "fill-edge-left", "fill-edge-right"];
                tbody.querySelectorAll("td.fill-selected").forEach(c => c.classList.remove(...fillEdgeClasses));
            };

            const onMove = (moveEv) => {
                if (!isFillDragging) return;
                const elem = document.elementFromPoint(moveEv.clientX, moveEv.clientY)?.closest("td");
                if (!elem || !tbody.contains(elem)) return;

                const rs = parseInt(elem.getAttribute("rowspan") || "1", 10);
                const cs = parseInt(elem.getAttribute("colspan") || "1", 10);
                const rect = elem.getBoundingClientRect();
                const subR = rs > 1 ? Math.min(rs - 1, Math.max(0, Math.floor(((moveEv.clientY - rect.top) / rect.height) * rs))) : 0;
                const subC = cs > 1 ? Math.min(cs - 1, Math.max(0, Math.floor(((moveEv.clientX - rect.left) / rect.width) * cs))) : 0;

                const hoverRow = (+elem.dataset.row) + subR;
                const hoverCol = (+elem.dataset.col) + subC;

                const upDist = Math.max(0, initialFillRange.minRow - hoverRow);
                const downDist = Math.max(0, hoverRow - initialFillRange.maxRow);
                const leftDist = Math.max(0, initialFillRange.minCol - hoverCol);
                const rightDist = Math.max(0, hoverCol - initialFillRange.maxCol);

                const vCellDist = Math.max(upDist, downDist);
                const hCellDist = Math.max(leftDist, rightDist);

                if (vCellDist === 0 && hCellDist === 0) {
                    currentFillRange = null;
                    clearFillPreview();
                    return;
                }

                const movePxX = Math.abs(moveEv.clientX - startClientX);
                const movePxY = Math.abs(moveEv.clientY - startClientY);
                const isHorizontal = hCellDist > 0 && (vCellDist === 0 || movePxX >= movePxY);

                if (!isHorizontal) {
                    if (downDist >= upDist) {
                        currentFillRange = {
                            minRow: initialFillRange.minRow,
                            minCol: initialFillRange.minCol,
                            maxRow: hoverRow,
                            maxCol: initialFillRange.maxCol
                        };
                    } else {
                        currentFillRange = {
                            minRow: hoverRow,
                            minCol: initialFillRange.minCol,
                            maxRow: initialFillRange.maxRow,
                            maxCol: initialFillRange.maxCol
                        };
                    }
                } else {
                    if (rightDist >= leftDist) {
                        currentFillRange = {
                            minRow: initialFillRange.minRow,
                            minCol: initialFillRange.minCol,
                            maxRow: initialFillRange.maxRow,
                            maxCol: hoverCol
                        };
                    } else {
                        currentFillRange = {
                            minRow: initialFillRange.minRow,
                            minCol: hoverCol,
                            maxRow: initialFillRange.maxRow,
                            maxCol: initialFillRange.maxCol
                        };
                    }
                }

                clearFillPreview();
                for (let r = currentFillRange.minRow; r <= currentFillRange.maxRow; r++) {
                    for (let c = currentFillRange.minCol; c <= currentFillRange.maxCol; c++) {
                        const td = getVisibleCell(r, c) || getCell(r, c);
                        if (!td) continue;
                        td.classList.add("fill-selected");
                        if (r === currentFillRange.minRow) td.classList.add("fill-edge-top");
                        if (r === currentFillRange.maxRow) td.classList.add("fill-edge-bottom");
                        if (c === currentFillRange.minCol) td.classList.add("fill-edge-left");
                        if (c === currentFillRange.maxCol) td.classList.add("fill-edge-right");
                    }
                }
            };

            const onUp = (upEv) => {
                const forceSeries = Boolean(upEv?.ctrlKey || upEv?.metaKey);
                document.removeEventListener("mousemove", onMove);
                document.removeEventListener("mouseup", onUp);
                clearFillPreview();

                if (!isFillDragging || !currentFillRange) {
                    isFillDragging = false;
                    return;
                }
                const targetRange = currentFillRange;
                isFillDragging = false;
                currentFillRange = null;

                executeFillOperation(initialFillRange, targetRange, {
                    forceSeries,
                    sourceCell: fillDragStartCell || getActiveCell()
                });
            };

            document.addEventListener("mousemove", onMove, { signal });
            document.addEventListener("mouseup", onUp, { signal });
        }, { signal });
    }

    signal.addEventListener("abort", () => {
        hideAutoFillOptions();
        optionBtn.remove();
    }, { once: true });

    return {
        isFillDragging: () => isFillDragging,
        cloneCellProperties,
        updateFillHandle,
        hideAutoFillOptions,
        syncAutoFillOptionButtonPosition
    };
}