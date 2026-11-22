// clipboard.js
// コピー・切り取り・マーチングアンツ・TSV変換・貼り付け（通常/値/数式/書式/コメント/入力規則/演算/空白無視/行列入替）

import { clearAppliedConditionalStyle } from "./conditional-format.js";
import { parseFormattedNumber } from "./format-utils.js";

export function parseTSVToMatrix(rawText) {
    const normalized = String(rawText ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n$/, "");
    if (normalized === "") return [[""]];
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < normalized.length; i++) {
        const ch = normalized[i];
        if (inQuotes) {
            if (ch === '"' && normalized[i + 1] === '"') {
                field += '"';
                i++;
            } else if (ch === '"') {
                inQuotes = false;
            } else {
                field += ch;
            }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === "\t") {
            row.push(field);
            field = "";
        } else if (ch === "\n") {
            row.push(field);
            rows.push(row);
            row = [];
            field = "";
        } else {
            field += ch;
        }
    }
    row.push(field);
    rows.push(row);
    return rows;
}

export function createClipboardModule(ctx) {
    const {
        win,
        spreadsheetContent,
        tbody,
        getActiveCell,
        getSheets,
        getActiveSheetIndex,
        getFreezeRows,
        getFreezeCols,
        isCurrentSheetProtected,
        isCellLockedForEdit,
        getCell,
        getVisibleCell,
        peekCell,
        getRow,
        getCellPureText,
        getSelectedRangeBounds,
        getMovePreviewLocalRect,
        hasMergeConflictOnDestination,
        extractCellStyleObject,
        applyCellStyleData,
        evaluateFormula,
        adjustFormula,
        adjustMovedFormulaSelf,
        clearSpillCellsFromAnchor,
        setCellFormattedValue,
        syncCellAnnotationMark,
        applyShrinkToFit,
        getRangeLocalRect,
        getFloatingObjectsInBounds,
        snapshotFloatingObject,
        spawnFloatingObjectFromSnapshot,
        removeFloatingObject,
        shiftConditionalFormatsForMoveOrCopy,
        redirectFormulasForMovedRange,
        shiftTablesAndAutoFilterForMove,
        clearSelection,
        setActiveCell,
        autoFitRow,
        applyFreezePanes,
        hasAutoFilters,
        applyAutoFilterRows,
        updateAllFormulas,
        refreshVisibleFloatingObjects,
        updateFillHandle,
        updateSelectedCellsDisplay,
        openAppModal,
        showAlert,
        setDirtyState,
        debouncedSaveState
    } = ctx;

    let clipboardData = null;
    let lastConsumedCutTsv = null;

    const copyAntsBox = document.createElement("div");
    copyAntsBox.className = "ss-copy-ants-box";
    spreadsheetContent.appendChild(copyAntsBox);
    let copyAntsBounds = null;

    function hasClipboardData() {
        return Boolean(clipboardData);
    }

    function isCopyAnimationActive() {
        return copyAntsBox.style.display !== "none" || Boolean(tbody.querySelector(".copy-marching-ants"));
    }

    function syncCopyAntsBoxPosition() {
        if (!copyAntsBounds) {
            copyAntsBox.style.display = "none";
            return;
        }
        const rect = getMovePreviewLocalRect(copyAntsBounds);
        if (!rect || rect.right <= rect.left || rect.bottom <= rect.top) {
            copyAntsBox.style.display = "none";
            return;
        }
        copyAntsBox.style.left = `${rect.left}px`;
        copyAntsBox.style.top = `${rect.top}px`;
        copyAntsBox.style.width = `${Math.max(4, rect.right - rect.left)}px`;
        copyAntsBox.style.height = `${Math.max(4, rect.bottom - rect.top)}px`;
        copyAntsBox.style.display = "block";
    }

    function clearCopyAnimation() {
        copyAntsBounds = null;
        copyAntsBox.style.display = "none";
        tbody.querySelectorAll(".copy-marching-ants").forEach(c => c.classList.remove("copy-marching-ants"));
    }

    function buildTSVFromRange(minRow, maxRow, minCol, maxCol) {
        const lines = [];
        for (let r = minRow; r <= maxRow; r++) {
            const cols = [];
            for (let c = minCol; c <= maxCol; c++) {
                const cell = getCell(r, c);
                const val = (cell && cell.style.display !== "none") ? cell.textContent : "";
                if (/[\t\r\n"]/.test(val)) {
                    cols.push(`"${val.replace(/"/g, '""')}"`);
                } else {
                    cols.push(val);
                }
            }
            lines.push(cols.join("\t"));
        }
        return lines.join("\n");
    }

    function copySelectedCells(isCut = false) {
        clearCopyAnimation();
        const selectedCells = Array.from(tbody.querySelectorAll("td.selected"));
        if (!selectedCells.length) return;
        if (isCut && isCurrentSheetProtected?.() && selectedCells.some(c => isCellLockedForEdit?.(c))) {
            showAlert("保護されたシート上のロックされたセルは切り取りできません。", "シートの保護");
            return;
        }
        lastConsumedCutTsv = null;

        let minRow = Infinity, maxRow = -Infinity, minCol = Infinity, maxCol = -Infinity;
        let coveredCount = 0;
        selectedCells.forEach(c => {
            const r0 = +c.dataset.row, c0 = +c.dataset.col;
            const rs = parseInt(c.getAttribute("rowspan") || "1", 10);
            const cs = parseInt(c.getAttribute("colspan") || "1", 10);
            minRow = Math.min(minRow, r0);
            maxRow = Math.max(maxRow, r0 + rs - 1);
            minCol = Math.min(minCol, c0);
            maxCol = Math.max(maxCol, c0 + cs - 1);
            coveredCount += rs * cs;
        });
        const isContiguous = coveredCount === (maxRow - minRow + 1) * (maxCol - minCol + 1);
        if (isContiguous) {
            copyAntsBounds = { minRow, maxRow, minCol, maxCol };
            syncCopyAntsBoxPosition();
        } else {
            selectedCells.forEach(c => c.classList.add("copy-marching-ants"));
        }
        const tsvText = buildTSVFromRange(minRow, maxRow, minCol, maxCol);

        const snapshotCell = (cell) => ({
            row: +cell.dataset.row,
            col: +cell.dataset.col,
            value: cell.dataset.rawValue ?? getCellPureText(cell),
            evaluatedValue: cell.dataset.rawValue ?? getCellPureText(cell),
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
            isMergedSub: cell.style.display === "none" && Boolean(cell.dataset.mergeAnchorRow)
        });

        const copyBounds = { minRow, maxRow, minCol, maxCol };
        const copyRect = getRangeLocalRect(copyBounds);
        const floatingEls = isContiguous ? getFloatingObjectsInBounds(copyBounds) : [];

        clipboardData = {
            isCut,
            tsvText,
            copyBounds: isContiguous ? copyBounds : null,
            sourceCoords: selectedCells.map(c => ({ row: +c.dataset.row, col: +c.dataset.col })),
            startRow: minRow,
            startCol: minCol,
            data: isContiguous ? [] : selectedCells.map(snapshotCell),
            floatingObjects: copyRect ? floatingEls.map(el => snapshotFloatingObject(el, copyRect)) : [],
            sourceFloatingEls: floatingEls
        };

        if (isContiguous) {
            for (let r = minRow; r <= maxRow; r++) {
                const rowData = [];
                for (let c = minCol; c <= maxCol; c++) {
                    const cell = getCell(r, c);
                    rowData.push(cell ? snapshotCell(cell) : { value: "", formula: "", numFormat: "", styleObj: null });
                }
                clipboardData.data.push(rowData);
            }
        }

        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(tsvText).catch(() => { });
        }
    }

    function pasteExternalTSVMatrix(matrix, selected, targetRow, targetCol) {
        const pasteHeight = matrix.length;
        const pasteWidth = Math.max(...matrix.map(r => r.length));
        const isSingleToMulti = pasteHeight === 1 && pasteWidth === 1 && selected.length > 1;
        const pasteBounds = {
            minRow: targetRow,
            maxRow: targetRow + pasteHeight - 1,
            minCol: targetCol,
            maxCol: targetCol + pasteWidth - 1
        };

        if (!isSingleToMulti && hasMergeConflictOnDestination(pasteBounds)) {
            showAlert("結合されたセルの一部を変更することはできません。", "貼り付けエラー");
            return;
        }

        if (isCurrentSheetProtected?.()) {
            const checkCells = isSingleToMulti
                ? selected
                : (() => {
                    const arr = [];
                    for (let r = pasteBounds.minRow; r <= pasteBounds.maxRow; r++) {
                        for (let c = pasteBounds.minCol; c <= pasteBounds.maxCol; c++) {
                            const td = getVisibleCell(r, c);
                            if (td) arr.push(td);
                        }
                    }
                    return arr;
                })();
            if (checkCells.some(td => isCellLockedForEdit?.(td))) {
                showAlert("保護されたシート上のロックされたセルには貼り付けできません。", "シートの保護");
                return;
            }
        }

        const writeTextToCell = (dest, text) => {
            if (!dest || dest.style.display === "none") return;
            clearSpillCellsFromAnchor?.(parseInt(dest.dataset.row, 10), parseInt(dest.dataset.col, 10));
            delete dest.dataset.spillOrigin;
            delete dest.dataset.richRuns;
            delete dest.dataset.quotePrefix;
            delete dest.dataset.valueType;
            delete dest.dataset.dateValue;

            const raw = String(text ?? "");
            const trimmed = raw.trim();
            if (raw.startsWith("'")) {
                delete dest.dataset.formula;
                dest.dataset.quotePrefix = "1";
                setCellFormattedValue(dest, raw.slice(1));
            } else if (trimmed.startsWith("=")) {
                // ループ末尾の updateAllFormulas() で一括キャッシュ評価するため個別評価を省略
                dest.dataset.formula = trimmed;
            } else {
                delete dest.dataset.formula;
                setCellFormattedValue(dest, raw);
            }
        };

        const affectedRows = new Set();
        if (isSingleToMulti) {
            selected.forEach(dest => {
                writeTextToCell(dest, matrix[0][0]);
                if (dest.style.whiteSpace === "pre-wrap" || dest.textContent.includes("\n")) {
                    affectedRows.add(parseInt(dest.dataset.row, 10));
                }
            });
        } else {
            matrix.forEach((rowArr, r) => {
                rowArr.forEach((val, c) => {
                    const dest = getCell(targetRow + r, targetCol + c);
                    writeTextToCell(dest, val);
                    if (dest && (dest.style.whiteSpace === "pre-wrap" || dest.textContent.includes("\n"))) {
                        affectedRows.add(targetRow + r);
                    }
                });
            });

            clearSelection();
            for (let r = pasteBounds.minRow; r <= pasteBounds.maxRow; r++) {
                for (let c = pasteBounds.minCol; c <= pasteBounds.maxCol; c++) {
                    const vis = getVisibleCell(r, c);
                    if (vis && vis.style.display !== "none") {
                        vis.classList.add("selected");
                    }
                }
            }
        }

        const landedActive = getVisibleCell(targetRow, targetCol);
        if (landedActive) setActiveCell(landedActive, true);
        affectedRows.forEach(r => autoFitRow(getRow(r)));

        updateAllFormulas();
        if (hasAutoFilters?.()) applyAutoFilterRows?.();
        updateFillHandle();
        updateSelectedCellsDisplay();
        clearCopyAnimation();
        setDirtyState(true);
        debouncedSaveState();
    }

    async function pasteClipboardData(pasteOption = false) {
        const opts = (pasteOption && typeof pasteOption === "object")
            ? {
                mode: pasteOption.mode || "all",
                operation: pasteOption.operation || "none",
                skipBlanks: Boolean(pasteOption.skipBlanks),
                transpose: Boolean(pasteOption.transpose)
            }
            : {
                mode: typeof pasteOption === "string"
                    ? (pasteOption === "transpose" ? "all" : pasteOption)
                    : (pasteOption ? "values" : "all"),
                operation: "none",
                skipBlanks: false,
                transpose: pasteOption === "transpose"
            };

        const mode = opts.mode;
        const operation = opts.operation;
        const skipBlanks = opts.skipBlanks;
        const valuesOnly = mode === "values";
        const formatsOnly = mode === "formats";
        const formulasOnly = mode === "formulas";
        const commentsOnly = mode === "comments";
        const validationOnly = mode === "validation";
        const isPartialMode = valuesOnly || formatsOnly || formulasOnly || commentsOnly || validationOnly || operation !== "none" || skipBlanks;
        const isTranspose = opts.transpose;

        const selected = Array.from(tbody.querySelectorAll("td.selected"));
        let targetCell = getActiveCell();
        if (selected.length) {
            let minRow = Infinity, minCol = Infinity;
            for (const c of selected) {
                minRow = Math.min(minRow, +c.dataset.row);
                minCol = Math.min(minCol, +c.dataset.col);
            }
            targetCell = getCell(minRow, minCol) || getActiveCell();
        }
        if (!targetCell) return;

        const targetRow = +targetCell.dataset.row;
        const targetCol = +targetCell.dataset.col;

        // OSクリップボードに外部アプリからの新規テキストがある場合はTSVとして優先貼り付け
        let externalText = null;
        if (navigator.clipboard?.readText) {
            try {
                externalText = await navigator.clipboard.readText();
            } catch {
                externalText = null;
            }
        }

        if (externalText !== null && externalText !== "") {
            const normExt = externalText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n$/, "");
            const normInt = (clipboardData?.tsvText ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n$/, "");
            if (!clipboardData) {
                if (lastConsumedCutTsv !== null && normExt === lastConsumedCutTsv) {
                    return;
                }
            }
            if (!clipboardData || normExt !== normInt) {
                lastConsumedCutTsv = null;
                let matrix = parseTSVToMatrix(externalText);
                if (isTranspose && matrix.length > 0) {
                    const maxCols = Math.max(...matrix.map(r => r.length));
                    matrix = Array.from({ length: maxCols }, (_, c) => matrix.map(r => r[c] ?? ""));
                }
                pasteExternalTSVMatrix(matrix, selected, targetRow, targetCol);
                return;
            }
        }

        if (!clipboardData) return;

        // 行列入れ替え時は2次元配列を転置する
        let activeData = clipboardData.data;
        if (isTranspose && Array.isArray(activeData[0])) {
            const srcRows = activeData.length;
            const srcCols = activeData[0].length;
            activeData = Array.from({ length: srcCols }, (_, c) =>
                Array.from({ length: srcRows }, (__, r) => activeData[r][c])
            );
        }

        const rowDelta = targetRow - clipboardData.startRow;
        const colDelta = targetCol - clipboardData.startCol;
        const isSingleToMulti =
            Array.isArray(activeData[0]) &&
            activeData.length === 1 &&
            activeData[0].length === 1 &&
            selected.length > 1;

        const pasteHeight = Array.isArray(activeData[0])
            ? (isSingleToMulti ? 1 : activeData.length)
            : Math.max(...activeData.map(i => (isTranspose ? i.col - clipboardData.startCol : i.row - clipboardData.startRow) + 1));
        const pasteWidth = Array.isArray(activeData[0])
            ? (isSingleToMulti ? 1 : activeData[0].length)
            : Math.max(...activeData.map(i => (isTranspose ? i.row - clipboardData.startRow : i.col - clipboardData.startCol) + 1));

        let cutIgnoreBounds = null;
        if (clipboardData.isCut && Array.isArray(clipboardData.sourceCoords) && clipboardData.sourceCoords.length > 0) {
            let sMinR = Infinity, sMaxR = -Infinity, sMinC = Infinity, sMaxC = -Infinity;
            clipboardData.sourceCoords.forEach(({ row, col }) => {
                const sc = getCell(row, col);
                const rs = parseInt(sc?.getAttribute("rowspan") || "1", 10);
                const cs = parseInt(sc?.getAttribute("colspan") || "1", 10);
                sMinR = Math.min(sMinR, row);
                sMaxR = Math.max(sMaxR, row + rs - 1);
                sMinC = Math.min(sMinC, col);
                sMaxC = Math.max(sMaxC, col + cs - 1);
            });
            cutIgnoreBounds = { minRow: sMinR, maxRow: sMaxR, minCol: sMinC, maxCol: sMaxC };
        }

        const pasteBounds = {
            minRow: targetRow,
            maxRow: targetRow + pasteHeight - 1,
            minCol: targetCol,
            maxCol: targetCol + pasteWidth - 1
        };

        if (!isSingleToMulti && hasMergeConflictOnDestination(pasteBounds, cutIgnoreBounds)) {
            showAlert("結合されたセルの一部を変更することはできません。", "貼り付けエラー");
            return;
        }

        // シート保護チェック（貼り付け先および切り取り元）
        if (isCurrentSheetProtected?.()) {
            const lockedDest = isSingleToMulti
                ? selected.some(td => isCellLockedForEdit?.(td))
                : (() => {
                    for (let r = pasteBounds.minRow; r <= pasteBounds.maxRow; r++) {
                        for (let c = pasteBounds.minCol; c <= pasteBounds.maxCol; c++) {
                            if (isCellLockedForEdit?.(getVisibleCell(r, c))) return true;
                        }
                    }
                    return false;
                })();
            const lockedSrc = clipboardData.isCut && !formatsOnly && Array.isArray(clipboardData.sourceCoords)
                && clipboardData.sourceCoords.some(({ row, col }) => isCellLockedForEdit?.(getCell(row, col)));
            if (lockedDest || lockedSrc) {
                showAlert("保護されたシート上のロックされたセルは変更できません。", "シートの保護");
                return;
            }
        }

        const resetCellCompletely = (cell, clearStyle = true) => {
            if (!cell) return;
            clearSpillCellsFromAnchor?.(parseInt(cell.dataset.row, 10), parseInt(cell.dataset.col, 10));
            clearAppliedConditionalStyle(cell);
            delete cell.dataset.cfIcon;
            cell.style.removeProperty("--cf-icon-color");
            cell.textContent = "";
            cell.removeAttribute("title");
            cell.classList.remove("ss-auto-align-right", "ss-auto-align-center", "ss-hyperlink", "merged");
            if (clearStyle) cell.removeAttribute("style");
            else cell.style.display = "";
            cell.removeAttribute("rowspan");
            cell.removeAttribute("colspan");
            Object.keys(cell.dataset).forEach(k => {
                if (k !== "row" && k !== "col") delete cell.dataset[k];
            });
        };

        // 通常切り取り貼り付け時は、先に切り取り元（結合含む）をクリアしてから書き込むことで重なり移動の破損を防止
        const preClearedCutSource = Boolean(clipboardData.isCut && !isPartialMode && Array.isArray(clipboardData.sourceCoords));
        if (preClearedCutSource) {
            clipboardData.sourceCoords.forEach(({ row, col }) => {
                const src = getCell(row, col);
                if (!src) return;
                const rs = parseInt(src.getAttribute("rowspan") || "1", 10);
                const cs = parseInt(src.getAttribute("colspan") || "1", 10);
                resetCellCompletely(src, true);
                if (rs > 1 || cs > 1) {
                    for (let mr = row; mr < row + rs; mr++) {
                        for (let mc = col; mc < col + cs; mc++) {
                            if (mr === row && mc === col) continue;
                            const sub = getCell(mr, mc);
                            if (sub) {
                                sub.style.display = "";
                                delete sub.dataset.mergeAnchorRow;
                                delete sub.dataset.mergeAnchorCol;
                            }
                        }
                    }
                }
            });
        }

        // 貼り付け先範囲内に丸ごと内包されている既存結合セルを事前解除
        if (!isPartialMode && !isSingleToMulti) {
            for (let r = pasteBounds.minRow; r <= pasteBounds.maxRow; r++) {
                for (let c = pasteBounds.minCol; c <= pasteBounds.maxCol; c++) {
                    const destCell = getCell(r, c);
                    if (!destCell) continue;
                    if (
                        destCell.hasAttribute("rowspan") ||
                        destCell.hasAttribute("colspan") ||
                        destCell.dataset.mergeAnchorRow !== undefined
                    ) {
                        destCell.removeAttribute("rowspan");
                        destCell.removeAttribute("colspan");
                        destCell.classList.remove("merged");
                        destCell.style.display = "";
                        delete destCell.dataset.mergeMinRow;
                        delete destCell.dataset.mergeMaxRow;
                        delete destCell.dataset.mergeMinCol;
                        delete destCell.dataset.mergeMaxCol;
                        delete destCell.dataset.mergeAnchorRow;
                        delete destCell.dataset.mergeAnchorCol;
                    }
                }
            }
        }

        const applyArithmeticPaste = (dest, srcRaw, srcFormulaAdjusted) => {
            const srcStr = String(srcRaw ?? "").trim();
            if (srcStr === "" && !srcFormulaAdjusted) return;
            const opSymMap = { add: "+", subtract: "-", multiply: "*", divide: "/" };
            const opSym = opSymMap[operation];
            if (!opSym) return;

            const destFormula = dest.dataset.formula || "";
            const destRawStr = String(dest.dataset.rawValue ?? getCellPureText(dest)).trim();

            // 数式が絡む場合は Excel 同様に式結合
            if (destFormula || srcFormulaAdjusted) {
                const lhs = destFormula ? `(${destFormula.slice(1)})` : (destRawStr === "" ? "0" : destRawStr);
                const rhs = srcFormulaAdjusted ? `(${srcFormulaAdjusted.slice(1)})` : srcStr;
                const combined = `=${lhs}${opSym}${rhs}`;
                dest.dataset.formula = combined;
                setCellFormattedValue(dest, evaluateFormula(combined));
                return;
            }

            const sNum = parseFormattedNumber(srcStr);
            if (isNaN(sNum)) return;
            const dNum = destRawStr === "" ? 0 : parseFormattedNumber(destRawStr);
            if (isNaN(dNum)) return;

            let res;
            if (operation === "add") res = dNum + sNum;
            else if (operation === "subtract") res = dNum - sNum;
            else if (operation === "multiply") res = dNum * sNum;
            else if (operation === "divide") res = sNum === 0 ? "#DIV/0!" : (dNum / sNum);

            delete dest.dataset.formula;
            delete dest.dataset.richRuns;
            setCellFormattedValue(dest, typeof res === "number" ? Number(res.toPrecision(15)) : res);
        };

        const applyCellData = (dest, item, rOff, cOff) => {
            if (!dest || item.isMergedSub) return;
            const isItemBlank = !item.formula && String(item.value ?? "") === "";
            if (skipBlanks && isItemBlank && !commentsOnly && !validationOnly && !formatsOnly) {
                return;
            }

            if (commentsOnly) {
                if (skipBlanks && !item.note && !item.comment) return;
                if (item.note) dest.dataset.note = item.note; else if (!skipBlanks) delete dest.dataset.note;
                if (item.comment) dest.dataset.comment = item.comment; else if (!skipBlanks) delete dest.dataset.comment;
                syncCellAnnotationMark(dest);
                return;
            }

            if (validationOnly) {
                if (skipBlanks && !item.dropdownList && !item.dvRule) return;
                if (item.dropdownList) dest.dataset.dropdownList = item.dropdownList; else if (!skipBlanks) delete dest.dataset.dropdownList;
                if (item.dvRule) dest.dataset.dvRule = item.dvRule; else if (!skipBlanks) delete dest.dataset.dvRule;
                return;
            }

            if (formatsOnly) {
                if (item.numFormat) dest.dataset.numFormat = item.numFormat;
                else delete dest.dataset.numFormat;
                if (item.decimalPlaces !== undefined && item.decimalPlaces !== "") dest.dataset.decimalPlaces = item.decimalPlaces;
                else delete dest.dataset.decimalPlaces;
                applyCellStyleData(dest, item.styleObj);
                const curRaw = dest.dataset.formula ? (dest.dataset.rawValue ?? "") : (dest.dataset.rawValue ?? getCellPureText(dest));
                setCellFormattedValue(dest, curRaw);
                return;
            }

            const newFormula = item.formula
                ? (clipboardData.isCut && cutIgnoreBounds
                    ? adjustMovedFormulaSelf(item.formula, cutIgnoreBounds, rowDelta, colDelta)
                    : adjustFormula(item.formula, rOff, cOff))
                : "";

            if (valuesOnly) {
                const resolvedVal = item.formula ? (item.evaluatedValue ?? evaluateFormula(item.formula)) : item.value;
                if (operation !== "none") {
                    applyArithmeticPaste(dest, resolvedVal, "");
                    return;
                }
                delete dest.dataset.formula;
                delete dest.dataset.richRuns;
                if (item.quotePrefix === "1") dest.dataset.quotePrefix = "1";
                else delete dest.dataset.quotePrefix;
                if (item.valueType) dest.dataset.valueType = item.valueType;
                else delete dest.dataset.valueType;
                if (item.dateValue) dest.dataset.dateValue = item.dateValue;
                else delete dest.dataset.dateValue;
                setCellFormattedValue(dest, resolvedVal);
                return;
            }

            if (formulasOnly) {
                if (operation !== "none") {
                    applyArithmeticPaste(dest, item.value, newFormula);
                    return;
                }
                delete dest.dataset.richRuns;
                if (newFormula) {
                    // 貼り付けループ後の updateAllFormulas() で一括キャッシュ計算するため、ここでの個別再評価を省略
                    dest.dataset.formula = newFormula;
                } else {
                    delete dest.dataset.formula;
                    if (item.quotePrefix === "1") dest.dataset.quotePrefix = "1";
                    else delete dest.dataset.quotePrefix;
                    setCellFormattedValue(dest, item.value);
                }
                return;
            }

            // 通常貼り付け（mode === "all"）
            if (item.numFormat) dest.dataset.numFormat = item.numFormat;
            else delete dest.dataset.numFormat;
            if (item.decimalPlaces !== undefined && item.decimalPlaces !== "") dest.dataset.decimalPlaces = item.decimalPlaces;
            else delete dest.dataset.decimalPlaces;
            if (item.dropdownList) dest.dataset.dropdownList = item.dropdownList;
            else delete dest.dataset.dropdownList;
            if (item.dvRule) dest.dataset.dvRule = item.dvRule;
            else delete dest.dataset.dvRule;
            if (item.richRuns && !newFormula && operation === "none") dest.dataset.richRuns = item.richRuns;
            else delete dest.dataset.richRuns;
            if (item.hyperlink) {
                dest.dataset.hyperlink = item.hyperlink;
                dest.classList.add("ss-hyperlink");
                dest.title = `${item.hyperlink}（Ctrl+クリックで開く）`;
            } else {
                delete dest.dataset.hyperlink;
                dest.classList.remove("ss-hyperlink");
                dest.removeAttribute("title");
            }

            if (operation !== "none") {
                applyArithmeticPaste(dest, item.value, newFormula);
            } else if (newFormula) {
                dest.dataset.formula = newFormula;
                if (item.quotePrefix === "1") dest.dataset.quotePrefix = "1";
                else delete dest.dataset.quotePrefix;
                if (item.valueType) dest.dataset.valueType = item.valueType;
                else delete dest.dataset.valueType;
                if (item.dateValue) dest.dataset.dateValue = item.dateValue;
                else delete dest.dataset.dateValue;
                // 貼り付けループ後の updateAllFormulas() で一括キャッシュ計算するため、ここでの個別再評価を省略
            } else {
                delete dest.dataset.formula;
                if (item.quotePrefix === "1") dest.dataset.quotePrefix = "1";
                else delete dest.dataset.quotePrefix;
                if (item.valueType) dest.dataset.valueType = item.valueType;
                else delete dest.dataset.valueType;
                if (item.dateValue) dest.dataset.dateValue = item.dateValue;
                else delete dest.dataset.dateValue;
                setCellFormattedValue(dest, item.value);
            }
            if (item.note) dest.dataset.note = item.note; else delete dest.dataset.note;
            if (item.comment) dest.dataset.comment = item.comment; else delete dest.dataset.comment;
            if (item.indent) dest.dataset.indent = item.indent; else delete dest.dataset.indent;
            if (item.shrinkToFit === "1") dest.dataset.shrinkToFit = "1"; else delete dest.dataset.shrinkToFit;
            if (item.textRotation) dest.dataset.textRotation = item.textRotation; else delete dest.dataset.textRotation;
            if (item.locked === "0") dest.dataset.locked = "0"; else delete dest.dataset.locked;
            if (item.formulaHidden === "1") dest.dataset.formulaHidden = "1"; else delete dest.dataset.formulaHidden;
            applyCellStyleData(dest, item.styleObj);
            syncCellAnnotationMark(dest);
            if (item.shrinkToFit === "1") applyShrinkToFit(dest);

            const rs = isTranspose ? (item.colspan || 1) : (item.rowspan || 1);
            const cs = isTranspose ? (item.rowspan || 1) : (item.colspan || 1);
            if (operation === "none" && (rs > 1 || cs > 1)) {
                const tr = +dest.dataset.row;
                const tc = +dest.dataset.col;
                const maxR = tr + rs - 1;
                const maxC = tc + cs - 1;
                dest.setAttribute("rowspan", String(rs));
                dest.setAttribute("colspan", String(cs));
                dest.classList.add("merged");
                dest.dataset.mergeMinRow = String(tr);
                dest.dataset.mergeMaxRow = String(maxR);
                dest.dataset.mergeMinCol = String(tc);
                dest.dataset.mergeMaxCol = String(maxC);

                for (let mr = tr; mr <= maxR; mr++) {
                    for (let mc = tc; mc <= maxC; mc++) {
                        if (mr === tr && mc === tc) continue;
                        const sub = getCell(mr, mc);
                        if (sub) {
                            clearSpillCellsFromAnchor?.(mr, mc);
                            clearAppliedConditionalStyle(sub);
                            sub.textContent = "";
                            sub.removeAttribute("style");
                            sub.removeAttribute("title");
                            sub.removeAttribute("rowspan");
                            sub.removeAttribute("colspan");
                            sub.style.display = "none";
                            sub.className = "";
                            Object.keys(sub.dataset).forEach(k => {
                                if (k !== "row" && k !== "col") delete sub.dataset[k];
                            });
                            sub.dataset.mergeAnchorRow = String(tr);
                            sub.dataset.mergeAnchorCol = String(tc);
                        }
                    }
                }
            }
        };

        if (Array.isArray(activeData[0])) {
            if (activeData.length === 1 && activeData[0].length === 1 && selected.length > 1) {
                const item = activeData[0][0];
                selected.forEach(dest => {
                    applyCellData(dest, item, (+dest.dataset.row) - clipboardData.startRow, (+dest.dataset.col) - clipboardData.startCol);
                });
            } else {
                activeData.forEach((rowArr, r) => {
                    rowArr.forEach((item, c) => {
                        const origR = clipboardData.startRow + (isTranspose ? c : r);
                        const origC = clipboardData.startCol + (isTranspose ? r : c);
                        const destR = targetRow + r;
                        const destC = targetCol + c;
                        applyCellData(getCell(destR, destC), item, destR - origR, destC - origC);
                    });
                });
            }
        } else {
            activeData.forEach(item => {
                const rOff = isTranspose ? (item.col - clipboardData.startCol) : (item.row - clipboardData.startRow);
                const cOff = isTranspose ? (item.row - clipboardData.startRow) : (item.col - clipboardData.startCol);
                const destR = targetRow + rOff;
                const destC = targetCol + cOff;
                applyCellData(getCell(destR, destC), item, destR - item.row, destC - item.col);
            });
        }

        // 通常貼り付け（値のみ・書式のみ以外）では範囲内のテキストボックス・グラフも追従コピー
        if (!valuesOnly && !formatsOnly && Array.isArray(clipboardData.floatingObjects) && clipboardData.floatingObjects.length > 0) {
            const destRect = getRangeLocalRect({
                minRow: targetRow,
                maxRow: targetRow + pasteHeight - 1,
                minCol: targetCol,
                maxCol: targetCol + pasteWidth - 1
            });
            if (destRect) {
                clipboardData.floatingObjects.forEach(objSnap => {
                    spawnFloatingObjectFromSnapshot(objSnap, destRect, rowDelta, colDelta);
                });
            }
        }

        // 通常コピー / 書式のみ貼り付け時に条件付き書式もコピー先へ複製
        if (!clipboardData.isCut && !valuesOnly && !isTranspose && clipboardData.copyBounds) {
            const isSingleToMulti =
                Array.isArray(activeData[0]) &&
                activeData.length === 1 &&
                activeData[0].length === 1 &&
                selected.length > 1;
            if (isSingleToMulti) {
                const destBounds = getSelectedRangeBounds();
                const srcB = clipboardData.copyBounds;
                const cfRules = getSheets()[getActiveSheetIndex()]?.conditionalFormats;
                if (destBounds && Array.isArray(cfRules) && cfRules.length > 0) {
                    const added = [];
                    cfRules.forEach(rule => {
                        if (
                            srcB.minRow < rule.minRow || srcB.minRow > rule.maxRow ||
                            srcB.minCol < rule.minCol || srcB.minCol > rule.maxCol
                        ) return;
                        const cloned = JSON.parse(JSON.stringify(rule));
                        const rOff = destBounds.minRow - rule.minRow;
                        const cOff = destBounds.minCol - rule.minCol;
                        cloned.minRow = destBounds.minRow;
                        cloned.maxRow = destBounds.maxRow;
                        cloned.minCol = destBounds.minCol;
                        cloned.maxCol = destBounds.maxCol;
                        if (cloned.formula && String(cloned.formula).trim().startsWith("=")) {
                            cloned.formula = adjustFormula(cloned.formula, rOff, cOff);
                        }
                        if (typeof cloned.val1 === "string" && cloned.val1.trim().startsWith("=")) {
                            cloned.val1 = adjustFormula(cloned.val1, rOff, cOff);
                        }
                        if (typeof cloned.val2 === "string" && cloned.val2.trim().startsWith("=")) {
                            cloned.val2 = adjustFormula(cloned.val2, rOff, cOff);
                        }
                        added.push(cloned);
                    });
                    if (added.length) {
                        cfRules.push(...added);
                    }
                }
            } else {
                shiftConditionalFormatsForMoveOrCopy(clipboardData.copyBounds, rowDelta, colDelta, { copyMode: true });
            }
        }

        if (clipboardData.isCut && !formatsOnly && Array.isArray(clipboardData.sourceCoords)) {
            const pastedSet = new Set();
            for (let r = targetRow; r < targetRow + pasteHeight; r++) {
                for (let c = targetCol; c < targetCol + pasteWidth; c++) {
                    pastedSet.add(`${r},${c}`);
                }
            }
            let srcMinR = Infinity, srcMaxR = -Infinity, srcMinC = Infinity, srcMaxC = -Infinity;
            clipboardData.sourceCoords.forEach(({ row, col }) => {
                srcMinR = Math.min(srcMinR, row);
                srcMaxR = Math.max(srcMaxR, row);
                srcMinC = Math.min(srcMinC, col);
                srcMaxC = Math.max(srcMaxC, col);
                if (!preClearedCutSource && !pastedSet.has(`${row},${col}`)) {
                    const src = getCell(row, col);
                    if (src) resetCellCompletely(src, false);
                }
            });
            if (!valuesOnly && Array.isArray(clipboardData.sourceFloatingEls)) {
                clipboardData.sourceFloatingEls.forEach(el => {
                    if (el && el.isConnected) removeFloatingObject(el);
                });
            }
            if (!valuesOnly && srcMinR <= srcMaxR) {
                const movedSrcBounds = cutIgnoreBounds || { minRow: srcMinR, maxRow: srcMaxR, minCol: srcMinC, maxCol: srcMaxC };
                redirectFormulasForMovedRange(
                    movedSrcBounds,
                    rowDelta,
                    colDelta,
                    { minRow: targetRow, maxRow: targetRow + pasteHeight - 1, minCol: targetCol, maxCol: targetCol + pasteWidth - 1 }
                );
                if (!isTranspose) {
                    shiftTablesAndAutoFilterForMove(movedSrcBounds, rowDelta, colDelta);
                }
            }
            lastConsumedCutTsv = (clipboardData.tsvText ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n$/, "");
            clipboardData = null;
        }

        clearSelection();
        for (let r = targetRow; r < targetRow + pasteHeight; r++) {
            for (let c = targetCol; c < targetCol + pasteWidth; c++) {
                const vis = getVisibleCell(r, c);
                if (vis && vis.style.display !== "none") {
                    vis.classList.add("selected");
                }
            }
        }
        const landedActive = getVisibleCell(targetRow, targetCol);
        if (landedActive) setActiveCell(landedActive, true);

        updateAllFormulas();
        if (hasAutoFilters?.()) applyAutoFilterRows?.();

        // 貼り付け範囲（数式評価後の結果含む）に改行や折り返し設定が含まれる場合は行の高さを自動調整
        const affectedRows = new Set();
        for (let r = targetRow; r < targetRow + pasteHeight; r++) {
            for (let c = targetCol; c < targetCol + pasteWidth; c++) {
                const td = peekCell(r, c);
                if (td && (td.style.whiteSpace === "pre-wrap" || td.textContent.includes("\n"))) {
                    affectedRows.add(r);
                }
            }
        }
        affectedRows.forEach(r => autoFitRow(getRow(r)));

        if (getFreezeRows() > 0 || getFreezeCols() > 0) applyFreezePanes();
        refreshVisibleFloatingObjects();
        updateFillHandle();
        updateSelectedCellsDisplay();
        clearCopyAnimation();
        setDirtyState(true);
        debouncedSaveState();
    }

    function openPasteSpecialDialog() {
        if (!openAppModal) return;
        const bodyHtml = `
            <div style="width:100%; display:flex; flex-direction:column; gap:8px; font-size:12px;">
                <fieldset style="border:1px solid #808080; padding:6px 8px; margin:0;">
                    <legend style="padding:0 4px;">貼り付け</legend>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:5px 12px;">
                        <label style="cursor:pointer;"><input type="radio" name="ss-ps-mode" value="all" checked> すべて(A)</label>
                        <label style="cursor:pointer;"><input type="radio" name="ss-ps-mode" value="comments"> コメントとメモ(C)</label>
                        <label style="cursor:pointer;"><input type="radio" name="ss-ps-mode" value="formulas"> 数式(F)</label>
                        <label style="cursor:pointer;"><input type="radio" name="ss-ps-mode" value="validation"> 入力規則(N)</label>
                        <label style="cursor:pointer;"><input type="radio" name="ss-ps-mode" value="values"> 値(V)</label>
                        <label style="cursor:pointer;"><input type="radio" name="ss-ps-mode" value="formats"> 書式(T)</label>
                    </div>
                </fieldset>
                <fieldset style="border:1px solid #808080; padding:6px 8px; margin:0;">
                    <legend style="padding:0 4px;">演算</legend>
                    <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:5px 8px;">
                        <label style="cursor:pointer;"><input type="radio" name="ss-ps-op" value="none" checked> しない(O)</label>
                        <label style="cursor:pointer;"><input type="radio" name="ss-ps-op" value="add"> 加算(D)</label>
                        <label style="cursor:pointer;"><input type="radio" name="ss-ps-op" value="subtract"> 減算(S)</label>
                        <label style="cursor:pointer;"><input type="radio" name="ss-ps-op" value="multiply"> 乗算(M)</label>
                        <label style="cursor:pointer;"><input type="radio" name="ss-ps-op" value="divide"> 除算(I)</label>
                    </div>
                </fieldset>
                <div style="display:flex; gap:16px; padding:2px 4px;">
                    <label style="cursor:pointer;"><input type="checkbox" class="ss-ps-skip-blanks"> 空白セルを無視する(B)</label>
                    <label style="cursor:pointer;"><input type="checkbox" class="ss-ps-transpose"> 行列を入れ替える(E)</label>
                </div>
            </div>
        `;

        const modal = openAppModal("形式を選択して貼り付け", bodyHtml, {
            width: 390,
            isHtml: true,
            parentWin: win,
            buttons: [
                {
                    label: "OK",
                    onClick: () => {
                        const mode = modal.querySelector('input[name="ss-ps-mode"]:checked')?.value || "all";
                        const operation = modal.querySelector('input[name="ss-ps-op"]:checked')?.value || "none";
                        const skipBlanks = Boolean(modal.querySelector(".ss-ps-skip-blanks")?.checked);
                        const transpose = Boolean(modal.querySelector(".ss-ps-transpose")?.checked);
                        void pasteClipboardData({ mode, operation, skipBlanks, transpose });
                    }
                },
                { label: "キャンセル" }
            ]
        });
    }

    return {
        hasClipboardData,
        isCopyAnimationActive,
        syncCopyAntsBoxPosition,
        clearCopyAnimation,
        copySelectedCells,
        pasteClipboardData,
        openPasteSpecialDialog
    };
}