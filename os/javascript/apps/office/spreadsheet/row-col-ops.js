// row-col-ops.js
// 行列の挿入・削除（結合・数式・フィルター・条件付き書式・テーブル・グラフ追従）＆単一/複数キー並べ替え

import {
    escapeHtml,
    getColumnName,
    columnLettersToIndex
} from "./format-utils.js";

export function shiftFormulaForRowCol(formula, mode, targetRow, targetCol, isSameSheet = true, targetSheetName = "") {
    if (!formula || !String(formula).startsWith("=")) return formula;

    const strings = [];
    let body = String(formula).substring(1).replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'(?!\s*!)/g, (m) => {
        const token = `__FSTR_${strings.length}__`;
        strings.push(m);
        return token;
    });

    const shiftRangeCoords = (c1, r1, c2, r2) => {
        if (mode === "insert-row") {
            if (r1 >= targetRow) r1 += 1;
            if (r2 >= targetRow) r2 += 1;
        } else if (mode === "delete-row") {
            let minR = Math.min(r1, r2);
            let maxR = Math.max(r1, r2);
            if (minR === targetRow && maxR === targetRow) return null;
            if (targetRow >= minR && targetRow <= maxR) maxR -= 1;
            else if (targetRow < minR) { minR -= 1; maxR -= 1; }
            if (r1 <= r2) { r1 = minR; r2 = maxR; }
            else { r1 = maxR; r2 = minR; }
        } else if (mode === "insert-col") {
            if (c1 >= targetCol) c1 += 1;
            if (c2 >= targetCol) c2 += 1;
        } else if (mode === "delete-col") {
            let minC = Math.min(c1, c2);
            let maxC = Math.max(c1, c2);
            if (minC === targetCol && maxC === targetCol) return null;
            if (targetCol >= minC && targetCol <= maxC) maxC -= 1;
            else if (targetCol < minC) { minC -= 1; maxC -= 1; }
            if (c1 <= c2) { c1 = minC; c2 = maxC; }
            else { c1 = maxC; c2 = minC; }
        }
        return { c1, r1, c2, r2 };
    };

    const shiftSingleCoord = (c, r) => {
        if (mode === "insert-row") {
            if (r >= targetRow) r += 1;
        } else if (mode === "delete-row") {
            if (r === targetRow) return null;
            if (r > targetRow) r -= 1;
        } else if (mode === "insert-col") {
            if (c >= targetCol) c += 1;
        } else if (mode === "delete-col") {
            if (c === targetCol) return null;
            if (c > targetCol) c -= 1;
        }
        return { c, r };
    };

    // 1パスで「シート接頭辞付き／なしのセル範囲・単一セル」を統一処理し、2重シフト・他シート終点誤認・関数名破壊を防止
    const unifiedRefPattern = /((?:'(?:''|[^'])+'|[A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+)!)?(?<![A-Za-z0-9_$])(\$?)([A-Za-z]+)(\$?)(\d+)(?::(\$?)([A-Za-z]+)(\$?)(\d+))?(?![A-Za-z0-9_!(]|\s*\()/g;

    body = body.replace(unifiedRefPattern, (match, sheetPrefix, aC1, col1, aR1, row1, aC2, col2, aR2, row2) => {
        if (sheetPrefix) {
            const rawSheet = sheetPrefix.slice(0, -1);
            const unquoted = (rawSheet.startsWith("'") && rawSheet.endsWith("'"))
                ? rawSheet.slice(1, -1).replace(/''/g, "'")
                : rawSheet;
            if (!targetSheetName || unquoted !== targetSheetName) {
                return match;
            }
        } else if (!isSameSheet) {
            return match;
        }

        const prefix = sheetPrefix || "";
        const c1 = columnLettersToIndex(col1);
        const r1 = parseInt(row1, 10);

        if (col2 !== undefined) {
            const c2 = columnLettersToIndex(col2);
            const r2 = parseInt(row2, 10);
            const shifted = shiftRangeCoords(c1, r1, c2, r2);
            if (!shifted) return `${prefix}#REF!`;
            return `${prefix}${aC1}${getColumnName(shifted.c1)}${aR1}${shifted.r1}:${aC2}${getColumnName(shifted.c2)}${aR2}${shifted.r2}`;
        }

        const shifted = shiftSingleCoord(c1, r1);
        if (!shifted) return `${prefix}#REF!`;
        return `${prefix}${aC1}${getColumnName(shifted.c)}${aR1}${shifted.r}`;
    });

    body = body.replace(/__FSTR_(\d+)__/g, (_, idx) => strings[Number(idx)]);
    return "=" + body;
}

export function createRowColOpsModule(ctx) {
    const {
        win,
        tbody,
        getActiveCell,
        getRowCount,
        getCurrentColumns,
        getSheets,
        getActiveSheetIndex,
        getDefinedNames,
        isCurrentSheetProtected,
        getSelectedWholeRows,
        getSelectedWholeColumns,
        getSelectedRangeBounds,
        detectDataBlockBounds,
        getCell,
        getVisibleCell,
        getRow,
        getCellPureText,
        getAutoFilterStates,
        hasAutoFilters,
        applyAutoFilterRows,
        captureCurrentSheetDOM,
        applySingleSheetToDOM,
        flushPendingEdits,
        extractCellStyleObject,
        applyCellStyleData,
        syncCellAnnotationMark,
        applyShrinkToFit,
        adjustFormula,
        evaluateFormula,
        setCellFormattedValue,
        updateAllFormulas,
        applyConditionalFormats,
        updateFillHandle,
        updateSelectedCellsDisplay,
        openAppModal,
        showAlert,
        setDirtyState,
        saveState,
        debouncedSaveState
    } = ctx;

    async function modifySheetRowCol(mode) {
        if (isCurrentSheetProtected?.()) {
            showAlert("シートが保護されているため、行や列の挿入・削除はできません。", "シートの保護");
            return;
        }
        const activeCell = getActiveCell();
        if (!activeCell) return;
        const isRowOp = mode === "insert-row" || mode === "delete-row";
        const isDelete = mode === "delete-row" || mode === "delete-col";

        let indices = isRowOp ? getSelectedWholeRows() : getSelectedWholeColumns();
        if (!indices.length) {
            const bounds = getSelectedRangeBounds();
            if (bounds) {
                const start = isRowOp ? bounds.minRow : bounds.minCol;
                const end = isRowOp ? bounds.maxRow : bounds.maxCol;
                for (let i = start; i <= end; i++) indices.push(i);
            } else {
                indices = [parseInt(isRowOp ? activeCell.dataset.row : activeCell.dataset.col, 10)];
            }
        }
        indices = Array.from(new Set(indices)).sort((a, b) => a - b).slice(0, 50);
        if (!indices.length) return;

        const baseRow = parseInt(activeCell.dataset.row, 10);
        const baseCol = parseInt(activeCell.dataset.col, 10);

        // DOMキャプチャは最初に1回だけ行い、全ステップをメモリ上でバッチ適用してからDOMへ1回で反映
        const snap = captureCurrentSheetDOM({ flush: true });

        if (isDelete) {
            for (let i = indices.length - 1; i >= 0; i--) {
                const idx = indices[i];
                applyRowColShiftToSnap(snap, mode, isRowOp ? idx : baseRow, isRowOp ? baseCol : idx);
            }
        } else {
            const runs = [];
            let runStart = indices[0];
            let runLen = 1;
            for (let i = 1; i < indices.length; i++) {
                if (indices[i] === indices[i - 1] + 1) {
                    runLen++;
                } else {
                    runs.push({ start: runStart, len: runLen });
                    runStart = indices[i];
                    runLen = 1;
                }
            }
            runs.push({ start: runStart, len: runLen });

            for (let r = runs.length - 1; r >= 0; r--) {
                const { start, len } = runs[r];
                for (let k = 0; k < len; k++) {
                    applyRowColShiftToSnap(snap, mode, isRowOp ? start : baseRow, isRowOp ? baseCol : start);
                }
            }
        }

        const landRow = isRowOp ? indices[0] : baseRow;
        const landCol = isRowOp ? baseCol : indices[0];
        snap.activeCoord = {
            row: Math.max(1, Math.min(getRowCount() - 1, landRow)),
            col: Math.max(0, Math.min(getCurrentColumns() - 1, landCol))
        };

        await applySingleSheetToDOM(snap, { isUndoRedo: true, restoreScroll: false });
        setDirtyState(true);
        saveState();
    }

    function applyRowColShiftToSnap(snap, mode, targetRow, targetCol) {
        // 既存の結合グループを抽出し、サブセルを一旦除外してアンカー基準で再構築する
        const mergeAnchors = [];
        snap.cells = snap.cells.filter(c => {
            if (c.merge?.mergeAnchorRow != null) return false;
            if ((c.rs || 1) > 1 || (c.cs || 1) > 1) {
                mergeAnchors.push({
                    item: c,
                    minR: c.r,
                    maxR: c.r + (c.rs || 1) - 1,
                    minC: c.c,
                    maxC: c.c + (c.cs || 1) - 1
                });
            }
            return true;
        });

        if (mode === "insert-row") {
            snap.cells.forEach(c => { if (c.r >= targetRow) c.r += 1; });
            mergeAnchors.forEach(m => {
                if (m.minR >= targetRow) { m.minR += 1; m.maxR += 1; }
                else if (m.maxR >= targetRow) { m.maxR += 1; }
            });
            snap.rows.forEach(r => { if (r.r >= targetRow) r.r += 1; });
            if (snap.freezeRows >= targetRow) snap.freezeRows += 1;
        } else if (mode === "delete-row") {
            mergeAnchors.forEach(m => {
                if (m.minR === targetRow && m.maxR > targetRow) {
                    m.item.r = targetRow + 1;
                }
            });
            snap.cells = snap.cells.filter(c => c.r !== targetRow);
            snap.cells.forEach(c => { if (c.r > targetRow) c.r -= 1; });
            mergeAnchors.forEach(m => {
                if (targetRow < m.minR) { m.minR -= 1; m.maxR -= 1; }
                else if (targetRow <= m.maxR) { m.maxR -= 1; }
            });
            snap.rows = snap.rows.filter(r => r.r !== targetRow);
            snap.rows.forEach(r => { if (r.r > targetRow) r.r -= 1; });
            if (snap.freezeRows >= targetRow) snap.freezeRows = Math.max(0, snap.freezeRows - 1);
        } else if (mode === "insert-col") {
            snap.cells.forEach(c => { if (c.c >= targetCol) c.c += 1; });
            mergeAnchors.forEach(m => {
                if (m.minC >= targetCol) { m.minC += 1; m.maxC += 1; }
                else if (m.maxC >= targetCol) { m.maxC += 1; }
            });
            snap.columns.forEach(col => { if (col.c >= targetCol) col.c += 1; });
            if (snap.freezeCols >= targetCol) snap.freezeCols += 1;
        } else if (mode === "delete-col") {
            mergeAnchors.forEach(m => {
                if (m.minC === targetCol && m.maxC > targetCol) {
                    m.item.c = targetCol + 1;
                }
            });
            snap.cells = snap.cells.filter(c => c.c !== targetCol);
            snap.cells.forEach(c => { if (c.c > targetCol) c.c -= 1; });
            mergeAnchors.forEach(m => {
                if (targetCol < m.minC) { m.minC -= 1; m.maxC -= 1; }
                else if (targetCol <= m.maxC) { m.maxC -= 1; }
            });
            snap.columns = snap.columns.filter(col => col.c !== targetCol);
            snap.columns.forEach(col => { if (col.c > targetCol) col.c -= 1; });
            if (snap.freezeCols >= targetCol) snap.freezeCols = Math.max(0, snap.freezeCols - 1);
        }

        // シフト後の結合セルサイズ・サブセルを再生成
        mergeAnchors.forEach(m => {
            if (m.maxR < m.minR || m.maxC < m.minC) return;
            const newRs = m.maxR - m.minR + 1;
            const newCs = m.maxC - m.minC + 1;
            m.item.r = m.minR;
            m.item.c = m.minC;
            if (newRs > 1 || newCs > 1) {
                m.item.rs = newRs;
                m.item.cs = newCs;
                m.item.merge = {
                    mergeMinRow: String(m.minR),
                    mergeMaxRow: String(m.maxR),
                    mergeMinCol: String(m.minC),
                    mergeMaxCol: String(m.maxC)
                };
                for (let r = m.minR; r <= m.maxR; r++) {
                    for (let c = m.minC; c <= m.maxC; c++) {
                        if (r === m.minR && c === m.minC) continue;
                        snap.cells.push({
                            r,
                            c,
                            merge: { mergeAnchorRow: String(m.minR), mergeAnchorCol: String(m.minC) }
                        });
                    }
                }
            } else {
                delete m.item.rs;
                delete m.item.cs;
                delete m.item.merge;
            }
        });

        // アクティブシート内の数式参照・入力規則の範囲参照を自動追従
        snap.cells.forEach(c => {
            if (c.f) {
                c.f = shiftFormulaForRowCol(c.f, mode, targetRow, targetCol, true, snap.name);
            }
            if (c.dl && String(c.dl).startsWith("=")) {
                c.dl = shiftFormulaForRowCol(c.dl, mode, targetRow, targetCol, true, snap.name);
            }
            if (c.dvr) {
                try {
                    const rule = JSON.parse(c.dvr);
                    let changed = false;
                    if (rule.listSpec && String(rule.listSpec).startsWith("=")) {
                        rule.listSpec = shiftFormulaForRowCol(rule.listSpec, mode, targetRow, targetCol, true, snap.name);
                        changed = true;
                    }
                    if (rule.formula && String(rule.formula).startsWith("=")) {
                        rule.formula = shiftFormulaForRowCol(rule.formula, mode, targetRow, targetCol, true, snap.name);
                        changed = true;
                    }
                    if (changed) c.dvr = JSON.stringify(rule);
                } catch { /* ignore */ }
            }
        });

        // 全オートフィルターの座標・対象列番号（値フィルター＆条件フィルター）を行列の挿入・削除に追従
        if (Array.isArray(snap.autoFilters) && snap.autoFilters.length > 0) {
            snap.autoFilters = snap.autoFilters.map(af => {
                const next = {
                    ...af,
                    filters: Array.isArray(af.filters) ? [...af.filters] : [],
                    conditions: Array.isArray(af.conditions) ? [...af.conditions] : []
                };
                if (mode === "insert-row") {
                    if (next.headerRow >= targetRow) next.headerRow += 1;
                    if (next.maxRow >= targetRow) next.maxRow += 1;
                } else if (mode === "delete-row") {
                    if (next.headerRow === targetRow) return null;
                    if (next.headerRow > targetRow) next.headerRow -= 1;
                    if (next.maxRow >= targetRow) next.maxRow -= 1;
                } else if (mode === "insert-col") {
                    if (next.minCol >= targetCol) next.minCol += 1;
                    if (next.maxCol >= targetCol) next.maxCol += 1;
                    next.filters = next.filters.map(([col, vals]) => [col >= targetCol ? col + 1 : col, vals]);
                    next.conditions = next.conditions.map(([col, cond]) => [col >= targetCol ? col + 1 : col, cond]);
                } else if (mode === "delete-col") {
                    if (targetCol >= next.minCol && targetCol <= next.maxCol) {
                        next.maxCol -= 1;
                        next.filters = next.filters
                            .filter(([col]) => col !== targetCol)
                            .map(([col, vals]) => [col > targetCol ? col - 1 : col, vals]);
                        next.conditions = next.conditions
                            .filter(([col]) => col !== targetCol)
                            .map(([col, cond]) => [col > targetCol ? col - 1 : col, cond]);
                        if (next.maxCol < next.minCol) return null;
                    } else if (targetCol < next.minCol) {
                        next.minCol -= 1;
                        next.maxCol -= 1;
                        next.filters = next.filters.map(([col, vals]) => [col - 1, vals]);
                        next.conditions = next.conditions.map(([col, cond]) => [col - 1, cond]);
                    }
                }
                return next;
            }).filter(Boolean);
        }

        // 条件付き書式の適用範囲も行列の挿入・削除に追従
        if (Array.isArray(snap.conditionalFormats)) {
            snap.conditionalFormats = snap.conditionalFormats.map(rule => {
                const r = { ...rule };
                if (mode === "insert-row") {
                    if (r.minRow >= targetRow) r.minRow += 1;
                    if (r.maxRow >= targetRow) r.maxRow += 1;
                } else if (mode === "delete-row") {
                    if (r.minRow > targetRow) r.minRow -= 1;
                    if (r.maxRow >= targetRow) r.maxRow -= 1;
                } else if (mode === "insert-col") {
                    if (r.minCol >= targetCol) r.minCol += 1;
                    if (r.maxCol >= targetCol) r.maxCol += 1;
                } else if (mode === "delete-col") {
                    if (r.minCol > targetCol) r.minCol -= 1;
                    if (r.maxCol >= targetCol) r.maxCol -= 1;
                }
                if (r.formula && String(r.formula).trim().startsWith("=")) {
                    r.formula = shiftFormulaForRowCol(r.formula, mode, targetRow, targetCol, true, snap.name);
                }
                if (typeof r.val1 === "string" && r.val1.trim().startsWith("=")) {
                    r.val1 = shiftFormulaForRowCol(r.val1, mode, targetRow, targetCol, true, snap.name);
                }
                if (typeof r.val2 === "string" && r.val2.trim().startsWith("=")) {
                    r.val2 = shiftFormulaForRowCol(r.val2, mode, targetRow, targetCol, true, snap.name);
                }
                return r;
            }).filter(r => r.maxRow >= r.minRow && r.maxCol >= r.minCol);
        }

        // 構造化テーブル（Ctrl+T）の範囲も行列の挿入・削除に追従
        if (Array.isArray(snap.tables)) {
            snap.tables = snap.tables.map(tbl => {
                const t = { ...tbl };
                if (mode === "insert-row") {
                    if (t.minRow >= targetRow) { t.minRow += 1; t.maxRow += 1; }
                    else if (targetRow <= t.maxRow) { t.maxRow += 1; }
                } else if (mode === "delete-row") {
                    if (targetRow < t.minRow) {
                        t.minRow -= 1;
                        t.maxRow -= 1;
                    } else if (targetRow >= t.minRow && targetRow <= t.maxRow) {
                        if (t.hasHeader && targetRow === t.minRow) return null;
                        if (t.hasTotalRow && targetRow === t.maxRow) t.hasTotalRow = false;
                        t.maxRow -= 1;
                    }
                } else if (mode === "insert-col") {
                    if (t.minCol >= targetCol) { t.minCol += 1; t.maxCol += 1; }
                    else if (targetCol <= t.maxCol) { t.maxCol += 1; }
                } else if (mode === "delete-col") {
                    if (targetCol < t.minCol) {
                        t.minCol -= 1;
                        t.maxCol -= 1;
                    } else if (targetCol >= t.minCol && targetCol <= t.maxCol) {
                        t.maxCol -= 1;
                    }
                }
                return t;
            }).filter(t => t && t.maxRow >= t.minRow && t.maxCol >= t.minCol);
        }

        // グラフのデータ参照範囲（sourceRange）も行・列の挿入・削除に追従
        if (Array.isArray(snap.textboxes)) {
            snap.textboxes.forEach(tb => {
                if (tb.type === "chart" && tb.sourceRange) {
                    const shiftedRange = shiftFormulaForRowCol("=" + tb.sourceRange, mode, targetRow, targetCol, true, snap.name);
                    if (shiftedRange && shiftedRange.startsWith("=") && !shiftedRange.includes("#REF!")) {
                        tb.sourceRange = shiftedRange.slice(1);
                    }
                }
            });
        }

        // ブック共通の名前定義（definedNames）の参照範囲も追従
        const definedNames = getDefinedNames?.();
        if (definedNames && typeof definedNames === "object") {
            Object.keys(definedNames).forEach(k => {
                const rawRef = String(definedNames[k] || "").trim();
                if (!rawRef) return;
                const shifted = shiftFormulaForRowCol("=" + rawRef, mode, targetRow, targetCol, false, snap.name);
                if (shifted.startsWith("=")) {
                    definedNames[k] = shifted.slice(1);
                }
            });
        }

        // 他シートから当シートを参照している数式・条件付き書式も追従
        const sheets = getSheets();
        const activeIdx = getActiveSheetIndex();
        sheets.forEach((otherSheet, idx) => {
            if (idx === activeIdx) return;
            if (Array.isArray(otherSheet.cells)) {
                otherSheet.cells.forEach(c => {
                    if (c.f) {
                        c.f = shiftFormulaForRowCol(c.f, mode, targetRow, targetCol, false, snap.name);
                    }
                });
            }
            if (Array.isArray(otherSheet.conditionalFormats)) {
                otherSheet.conditionalFormats.forEach(rule => {
                    if (rule.formula && String(rule.formula).trim().startsWith("=")) {
                        rule.formula = shiftFormulaForRowCol(rule.formula, mode, targetRow, targetCol, false, snap.name);
                    }
                    if (typeof rule.val1 === "string" && rule.val1.trim().startsWith("=")) {
                        rule.val1 = shiftFormulaForRowCol(rule.val1, mode, targetRow, targetCol, false, snap.name);
                    }
                    if (typeof rule.val2 === "string" && rule.val2.trim().startsWith("=")) {
                        rule.val2 = shiftFormulaForRowCol(rule.val2, mode, targetRow, targetCol, false, snap.name);
                    }
                });
            }
        });
    }

    function sortSelectedRange(ascending = true) {
        if (isCurrentSheetProtected?.()) {
            showAlert("シートが保護されているため、並べ替えはできません。", "シートの保護");
            return;
        }
        flushPendingEdits();
        const selected = Array.from(tbody.querySelectorAll("td.selected"));
        const baseCell = getActiveCell() || selected[0];
        if (!baseCell) return;

        const keyCol = parseInt(baseCell.dataset.col, 10);
        const isCellFilled = (r, c) => {
            const cell = getCell(r, c);
            if (!cell) return false;
            return Boolean(cell.dataset.formula || (cell.dataset.rawValue ?? cell.textContent).trim() !== "");
        };

        const curRowCount = getRowCount();
        const colCount = getCurrentColumns();
        let minR, maxR, minC, maxC;
        let autoDetectedTable = false;

        if (selected.length <= 1) {
            // 単一セル選択時は隣接する表ブロックを自動検出
            const startR = parseInt(baseCell.dataset.row, 10);
            const startC = keyCol;
            if (!isCellFilled(startR, startC)) return;

            minR = maxR = startR;
            minC = maxC = startC;
            while (minR > 1 && isCellFilled(minR - 1, startC)) minR--;
            while (maxR < curRowCount - 1 && isCellFilled(maxR + 1, startC)) maxR++;
            while (minC > 0 && isCellFilled(startR, minC - 1)) minC--;
            while (maxC < colCount - 1 && isCellFilled(startR, maxC + 1)) maxC++;

            // 隣接行の横幅も取り込む
            let expanded = true;
            while (expanded) {
                expanded = false;
                for (let r = minR; r <= maxR; r++) {
                    if (minC > 0 && isCellFilled(r, minC - 1)) { minC--; expanded = true; }
                    if (maxC < colCount - 1 && isCellFilled(r, maxC + 1)) { maxC++; expanded = true; }
                }
            }
            autoDetectedTable = true;
        } else {
            minR = Infinity; maxR = -Infinity; minC = Infinity; maxC = -Infinity;
            selected.forEach(c => {
                const r = +c.dataset.row, col = +c.dataset.col;
                minR = Math.min(minR, r);
                maxR = Math.max(maxR, r);
                minC = Math.min(minC, col);
                maxC = Math.max(maxC, col);
            });
        }

        if (maxR <= minR) return;

        // オートフィルター適用中は対象範囲に重なる見出し行を自動的にソート対象外へ保護
        const matchedFilter = getAutoFilterStates().find(af =>
            minR <= af.headerRow && maxR > af.headerRow &&
            !(af.maxCol < minC || af.minCol > maxC)
        );
        if (matchedFilter) {
            minR = matchedFilter.headerRow + 1;
        } else if (autoDetectedTable && maxR - minR >= 1) {
            // 自動検出時、1行目が見出し行（太字/背景色あり、または1行目が文字列で2行目が数値）なら除外
            const firstRowCells = [];
            for (let c = minC; c <= maxC; c++) firstRowCells.push(getCell(minR, c));
            const hasHeaderStyle = firstRowCells.some(c => c && (c.style.fontWeight === "bold" || c.style.backgroundColor));
            const firstKeyVal = (getCell(minR, keyCol)?.dataset.rawValue ?? getCell(minR, keyCol)?.textContent ?? "").trim().replace(/[¥$€,%]/g, "");
            const secondKeyVal = (getCell(minR + 1, keyCol)?.dataset.rawValue ?? getCell(minR + 1, keyCol)?.textContent ?? "").trim().replace(/[¥$€,%]/g, "");
            const firstIsTextSecondIsNum = firstKeyVal !== "" && isNaN(Number(firstKeyVal)) && secondKeyVal !== "" && !isNaN(Number(secondKeyVal));
            if (hasHeaderStyle || firstIsTextSecondIsNum) {
                minR += 1;
            }
        }

        if (maxR <= minR) return;

        // 結合セルが含まれる場合は中止（オートフィルターで非表示の行はスキップ）
        const targetRowIndices = [];
        for (let r = minR; r <= maxR; r++) {
            const tr = getRow(r);
            if (tr && tr.style.display === "none") continue;
            for (let c = minC; c <= maxC; c++) {
                const cell = getCell(r, c);
                if (cell && (cell.style.display === "none" || cell.classList.contains("merged") || cell.dataset.mergeMinRow || cell.dataset.mergeAnchorRow)) {
                    showAlert("結合されたセルを含む範囲は並べ替えできません。", "並べ替えエラー");
                    return;
                }
            }
            targetRowIndices.push(r);
        }

        if (targetRowIndices.length <= 1) return;

        const sortKeyCol = (keyCol >= minC && keyCol <= maxC) ? keyCol : minC;
        const rowsData = [];

        const parseSortComparable = (cell, rawStr) => {
            if (!rawStr) return { type: "empty", val: "" };
            if (cell?.dataset.quotePrefix === "1") return { type: "str", val: rawStr };
            if (cell?.dataset.dateValue) {
                const numTs = Number(cell.dataset.dateValue);
                const ts = Number.isFinite(numTs) ? numTs : Date.parse(cell.dataset.dateValue);
                if (!isNaN(ts)) return { type: "num", val: ts };
            }
            if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/.test(rawStr)) {
                const ts = Date.parse(rawStr.replace(/-/g, "/"));
                if (!isNaN(ts)) return { type: "num", val: ts };
            }
            const cleanedNum = rawStr.replace(/^[¥$€]\s*/, "").replace(/,/g, "");
            if (cleanedNum.endsWith("%")) {
                const pct = Number(cleanedNum.slice(0, -1));
                if (!isNaN(pct)) return { type: "num", val: pct / 100 };
            }
            const num = Number(cleanedNum);
            if (!isNaN(num)) return { type: "num", val: num };
            return { type: "str", val: rawStr };
        };

        for (const r of targetRowIndices) {
            const rowCells = [];
            for (let c = minC; c <= maxC; c++) {
                const cell = getCell(r, c);
                rowCells.push({
                    value: cell?.dataset.rawValue ?? getCellPureText(cell),
                    formula: cell?.dataset.formula || "",
                    quotePrefix: cell?.dataset.quotePrefix || "",
                    numFormat: cell?.dataset.numFormat || "",
                    decimalPlaces: cell?.dataset.decimalPlaces ?? "",
                    dropdownList: cell?.dataset.dropdownList || "",
                    dvRule: cell?.dataset.dvRule || "",
                    valueType: cell?.dataset.valueType || "",
                    dateValue: cell?.dataset.dateValue || "",
                    richRuns: cell?.dataset.richRuns || "",
                    hyperlink: cell?.dataset.hyperlink || "",
                    note: cell?.dataset.note || "",
                    comment: cell?.dataset.comment || "",
                    indent: cell?.dataset.indent || "",
                    shrinkToFit: cell?.dataset.shrinkToFit || "",
                    textRotation: cell?.dataset.textRotation || "",
                    locked: cell?.dataset.locked || "",
                    formulaHidden: cell?.dataset.formulaHidden || "",
                    styleObj: cell ? extractCellStyleObject(cell) : null
                });
            }
            const keyCell = getCell(r, sortKeyCol);
            const rawKey = (keyCell?.dataset.rawValue ?? getCellPureText(keyCell)).trim();
            rowsData.push({
                origRow: r,
                rawKey,
                comp: parseSortComparable(keyCell, rawKey),
                cells: rowCells
            });
        }

        const collator = new Intl.Collator("ja", { numeric: true, sensitivity: "base" });
        rowsData.sort((a, b) => {
            if (a.comp.type === "empty" && b.comp.type === "empty") return 0;
            if (a.comp.type === "empty") return 1;
            if (b.comp.type === "empty") return -1;

            let cmp = 0;
            if (a.comp.type === "num" && b.comp.type === "num") {
                cmp = a.comp.val - b.comp.val;
            } else if (a.comp.type !== b.comp.type) {
                // Excel準拠：昇順では「数値 < 文字列」
                cmp = a.comp.type === "num" ? -1 : 1;
            } else {
                cmp = collator.compare(a.comp.val, b.comp.val);
            }
            return ascending ? cmp : -cmp;
        });

        rowsData.forEach((rowItem, idx) => {
            const destRow = targetRowIndices[idx];
            const rowDelta = destRow - rowItem.origRow;
            rowItem.cells.forEach((item, cIdx) => {
                const dest = getCell(destRow, minC + cIdx);
                if (!dest) return;

                if (item.numFormat) dest.dataset.numFormat = item.numFormat;
                else delete dest.dataset.numFormat;

                if (item.decimalPlaces !== "") dest.dataset.decimalPlaces = item.decimalPlaces;
                else delete dest.dataset.decimalPlaces;

                if (item.dropdownList) dest.dataset.dropdownList = item.dropdownList;
                else delete dest.dataset.dropdownList;

                if (item.dvRule) dest.dataset.dvRule = item.dvRule;
                else delete dest.dataset.dvRule;

                if (item.valueType) dest.dataset.valueType = item.valueType;
                else delete dest.dataset.valueType;

                if (item.quotePrefix === "1") dest.dataset.quotePrefix = "1";
                else delete dest.dataset.quotePrefix;

                if (item.dateValue) dest.dataset.dateValue = item.dateValue;
                else delete dest.dataset.dateValue;

                if (item.richRuns && !item.formula) dest.dataset.richRuns = item.richRuns;
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

                if (item.note) dest.dataset.note = item.note; else delete dest.dataset.note;
                if (item.comment) dest.dataset.comment = item.comment; else delete dest.dataset.comment;
                if (item.indent) dest.dataset.indent = item.indent; else delete dest.dataset.indent;
                if (item.shrinkToFit === "1") dest.dataset.shrinkToFit = "1"; else delete dest.dataset.shrinkToFit;
                if (item.textRotation) dest.dataset.textRotation = item.textRotation; else delete dest.dataset.textRotation;
                if (item.locked === "0") dest.dataset.locked = "0"; else delete dest.dataset.locked;
                if (item.formulaHidden === "1") dest.dataset.formulaHidden = "1"; else delete dest.dataset.formulaHidden;

                if (item.formula) {
                    const nextFormula = adjustFormula(item.formula, rowDelta, 0);
                    dest.dataset.formula = nextFormula;
                    setCellFormattedValue(dest, evaluateFormula(nextFormula));
                } else {
                    delete dest.dataset.formula;
                    setCellFormattedValue(dest, item.value);
                }
                applyCellStyleData(dest, item.styleObj);
                syncCellAnnotationMark?.(dest);
                if (item.shrinkToFit === "1") applyShrinkToFit?.(dest);
            });
        });

        updateAllFormulas();
        applyConditionalFormats();
        if (hasAutoFilters()) applyAutoFilterRows();
        updateFillHandle();
        updateSelectedCellsDisplay();
        setDirtyState(true);
        debouncedSaveState();
    }

    function sortRangeByCriteria(bounds, criteriaList, hasHeader = true) {
        if (isCurrentSheetProtected?.()) {
            showAlert("シートが保護されているため、並べ替えはできません。", "シートの保護");
            return false;
        }
        if (!bounds || !Array.isArray(criteriaList) || !criteriaList.length) return false;
        flushPendingEdits();

        const minR = hasHeader ? bounds.minRow + 1 : bounds.minRow;
        const maxR = bounds.maxRow;
        const minC = bounds.minCol;
        const maxC = bounds.maxCol;
        if (maxR <= minR) return false;

        const targetRowIndices = [];
        for (let r = minR; r <= maxR; r++) {
            const tr = getRow(r);
            if (tr && tr.style.display === "none") continue;
            for (let c = minC; c <= maxC; c++) {
                const cell = getCell(r, c);
                if (cell && (cell.style.display === "none" || cell.classList.contains("merged") || cell.dataset.mergeMinRow || cell.dataset.mergeAnchorRow)) {
                    showAlert("結合されたセルを含む範囲は並べ替えできません。", "並べ替えエラー");
                    return false;
                }
            }
            targetRowIndices.push(r);
        }
        if (targetRowIndices.length <= 1) return false;

        const parseSortComparable = (cell, rawStr) => {
            if (!rawStr) return { type: "empty", val: "" };
            if (cell?.dataset.quotePrefix === "1") return { type: "str", val: rawStr };
            if (cell?.dataset.dateValue) {
                const numTs = Number(cell.dataset.dateValue);
                const ts = Number.isFinite(numTs) ? numTs : Date.parse(cell.dataset.dateValue);
                if (!isNaN(ts)) return { type: "num", val: ts };
            }
            if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/.test(rawStr)) {
                const ts = Date.parse(rawStr.replace(/-/g, "/"));
                if (!isNaN(ts)) return { type: "num", val: ts };
            }
            const cleanedNum = rawStr.replace(/^[¥$€]\s*/, "").replace(/,/g, "");
            if (cleanedNum.endsWith("%")) {
                const pct = Number(cleanedNum.slice(0, -1));
                if (!isNaN(pct)) return { type: "num", val: pct / 100 };
            }
            const num = Number(cleanedNum);
            if (!isNaN(num)) return { type: "num", val: num };
            return { type: "str", val: rawStr };
        };

        const rowsData = targetRowIndices.map(r => {
            const cells = [];
            for (let c = minC; c <= maxC; c++) {
                const cell = getCell(r, c);
                cells.push({
                    value: cell?.dataset.rawValue ?? getCellPureText(cell),
                    formula: cell?.dataset.formula || "",
                    quotePrefix: cell?.dataset.quotePrefix || "",
                    numFormat: cell?.dataset.numFormat || "",
                    decimalPlaces: cell?.dataset.decimalPlaces ?? "",
                    dropdownList: cell?.dataset.dropdownList || "",
                    dvRule: cell?.dataset.dvRule || "",
                    valueType: cell?.dataset.valueType || "",
                    dateValue: cell?.dataset.dateValue || "",
                    richRuns: cell?.dataset.richRuns || "",
                    hyperlink: cell?.dataset.hyperlink || "",
                    note: cell?.dataset.note || "",
                    comment: cell?.dataset.comment || "",
                    indent: cell?.dataset.indent || "",
                    shrinkToFit: cell?.dataset.shrinkToFit || "",
                    textRotation: cell?.dataset.textRotation || "",
                    locked: cell?.dataset.locked || "",
                    formulaHidden: cell?.dataset.formulaHidden || "",
                    styleObj: cell ? extractCellStyleObject(cell) : null
                });
            }
            const comps = criteriaList.map(cr => {
                const keyCell = getCell(r, cr.col);
                const rawKey = (keyCell?.dataset.rawValue ?? getCellPureText(keyCell)).trim();
                return parseSortComparable(keyCell, rawKey);
            });
            return { origRow: r, cells, comps };
        });

        const collator = new Intl.Collator("ja", { numeric: true, sensitivity: "base" });
        rowsData.sort((a, b) => {
            for (let i = 0; i < criteriaList.length; i++) {
                const ca = a.comps[i];
                const cb = b.comps[i];
                if (ca.type === "empty" && cb.type === "empty") continue;
                if (ca.type === "empty") return 1;
                if (cb.type === "empty") return -1;

                let cmp = 0;
                if (ca.type === "num" && cb.type === "num") {
                    cmp = ca.val - cb.val;
                } else if (ca.type !== cb.type) {
                    cmp = ca.type === "num" ? -1 : 1;
                } else {
                    cmp = collator.compare(ca.val, cb.val);
                }
                if (cmp !== 0) {
                    return criteriaList[i].asc ? cmp : -cmp;
                }
            }
            return a.origRow - b.origRow;
        });

        rowsData.forEach((rowItem, idx) => {
            const destRow = targetRowIndices[idx];
            const rowDelta = destRow - rowItem.origRow;
            rowItem.cells.forEach((item, cIdx) => {
                const dest = getCell(destRow, minC + cIdx);
                if (!dest) return;

                if (item.numFormat) dest.dataset.numFormat = item.numFormat; else delete dest.dataset.numFormat;
                if (item.decimalPlaces !== "") dest.dataset.decimalPlaces = item.decimalPlaces; else delete dest.dataset.decimalPlaces;
                if (item.dropdownList) dest.dataset.dropdownList = item.dropdownList; else delete dest.dataset.dropdownList;
                if (item.dvRule) dest.dataset.dvRule = item.dvRule; else delete dest.dataset.dvRule;
                if (item.valueType) dest.dataset.valueType = item.valueType; else delete dest.dataset.valueType;
                if (item.quotePrefix === "1") dest.dataset.quotePrefix = "1"; else delete dest.dataset.quotePrefix;
                if (item.dateValue) dest.dataset.dateValue = item.dateValue; else delete dest.dataset.dateValue;
                if (item.richRuns && !item.formula) dest.dataset.richRuns = item.richRuns; else delete dest.dataset.richRuns;
                if (item.note) dest.dataset.note = item.note; else delete dest.dataset.note;
                if (item.comment) dest.dataset.comment = item.comment; else delete dest.dataset.comment;
                if (item.indent) dest.dataset.indent = item.indent; else delete dest.dataset.indent;
                if (item.shrinkToFit === "1") dest.dataset.shrinkToFit = "1"; else delete dest.dataset.shrinkToFit;
                if (item.textRotation) dest.dataset.textRotation = item.textRotation; else delete dest.dataset.textRotation;
                if (item.locked === "0") dest.dataset.locked = "0"; else delete dest.dataset.locked;
                if (item.formulaHidden === "1") dest.dataset.formulaHidden = "1"; else delete dest.dataset.formulaHidden;
                if (item.hyperlink) {
                    dest.dataset.hyperlink = item.hyperlink;
                    dest.classList.add("ss-hyperlink");
                    dest.title = `${item.hyperlink}（Ctrl+クリックで開く）`;
                } else {
                    delete dest.dataset.hyperlink;
                    dest.classList.remove("ss-hyperlink");
                    dest.removeAttribute("title");
                }

                if (item.formula) {
                    const nextFormula = adjustFormula(item.formula, rowDelta, 0);
                    dest.dataset.formula = nextFormula;
                    setCellFormattedValue(dest, evaluateFormula(nextFormula));
                } else {
                    delete dest.dataset.formula;
                    setCellFormattedValue(dest, item.value);
                }
                applyCellStyleData(dest, item.styleObj);
                syncCellAnnotationMark?.(dest);
                if (item.shrinkToFit === "1") applyShrinkToFit?.(dest);
            });
        });

        updateAllFormulas();
        applyConditionalFormats();
        if (hasAutoFilters()) applyAutoFilterRows();
        updateFillHandle();
        updateSelectedCellsDisplay();
        setDirtyState(true);
        debouncedSaveState();
        return true;
    }

    function openCustomSortDialog() {
        if (isCurrentSheetProtected?.()) {
            showAlert("シートが保護されているため、並べ替えはできません。", "シートの保護");
            return;
        }
        flushPendingEdits();
        const bounds = detectDataBlockBounds?.(getActiveCell()) || getSelectedRangeBounds();
        if (!bounds || bounds.maxRow <= bounds.minRow) {
            showAlert("並べ替えを実行する2行以上のデータ範囲を選択してください。", "並べ替え");
            return;
        }

        const cols = [];
        for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
            const hTxt = (getVisibleCell?.(bounds.minRow, c)?.textContent ?? getCell(bounds.minRow, c)?.textContent ?? "").trim();
            cols.push({
                col: c,
                colLabel: `列 ${getColumnName(c)}`,
                headerLabel: hTxt || `(列 ${getColumnName(c)})`
            });
        }

        const activeCol = parseInt(getActiveCell()?.dataset.col ?? String(bounds.minCol), 10);
        const defaultCol = (activeCol >= bounds.minCol && activeCol <= bounds.maxCol) ? activeCol : bounds.minCol;
        let levels = [{ col: defaultCol, asc: true }];
        let hasHeader = true;

        const bodyHtml = `
            <div style="width:100%; display:flex; flex-direction:column; gap:8px; font-size:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
                    <div style="display:flex; gap:5px;">
                        <button type="button" class="button ss-cs-add" style="height:24px; padding:0 8px;">＋ レベルの追加</button>
                        <button type="button" class="button ss-cs-del" style="height:24px; padding:0 8px;">－ レベルの削除</button>
                    </div>
                    <label style="display:inline-flex; align-items:center; gap:4px; cursor:pointer;">
                        <input type="checkbox" class="ss-cs-header" checked> 先頭行をデータの見出しとして使用する(H)
                    </label>
                </div>
                <div style="border:1px solid #808080; background:#fff; min-height:140px; max-height:210px; overflow-y:auto;">
                    <table style="width:100%; border-collapse:collapse; font-size:12px;">
                        <thead>
                            <tr style="background:#d4d8dc; border-bottom:1px solid #808080;">
                                <th style="padding:4px 6px; text-align:left; width:130px;">条件</th>
                                <th style="padding:4px 6px; text-align:left;">列 (最優先されるキー)</th>
                                <th style="padding:4px 6px; text-align:left; width:135px;">順序</th>
                            </tr>
                        </thead>
                        <tbody class="ss-cs-tbody"></tbody>
                    </table>
                </div>
            </div>
        `;

        const modal = openAppModal("並べ替え（複数条件）", bodyHtml, {
            width: 500,
            isHtml: true,
            parentWin: win,
            buttons: [
                {
                    label: "OK",
                    onClick: () => {
                        sortRangeByCriteria(bounds, levels, hasHeader);
                    }
                },
                { label: "キャンセル" }
            ]
        });

        const tbodyEl = modal?.querySelector(".ss-cs-tbody");
        const headerChk = modal?.querySelector(".ss-cs-header");
        let selectedLevel = 0;

        const renderLevels = () => {
            if (!tbodyEl) return;
            tbodyEl.innerHTML = levels.map((lv, idx) => `
                <tr data-lv-idx="${idx}" style="border-bottom:1px solid #e0e0e0; background:${idx === selectedLevel ? "#e6f2ff" : "#fff"};">
                    <td style="padding:4px 6px; font-weight:bold;">${idx === 0 ? "最優先されるキー" : "次に優先されるキー"}</td>
                    <td style="padding:4px 6px;">
                        <select class="ss-cs-col border" data-lv-idx="${idx}" style="width:100%; height:22px; background:#fff; color:#000;">
                            ${cols.map(c => `<option value="${c.col}" ${c.col === lv.col ? "selected" : ""}>${escapeHtml(hasHeader ? c.headerLabel : c.colLabel)}</option>`).join("")}
                        </select>
                    </td>
                    <td style="padding:4px 6px;">
                        <select class="ss-cs-dir border" data-lv-idx="${idx}" style="width:100%; height:22px; background:#fff; color:#000;">
                            <option value="asc" ${lv.asc ? "selected" : ""}>昇順 (A→Z / 小→大)</option>
                            <option value="desc" ${!lv.asc ? "selected" : ""}>降順 (Z→A / 大→小)</option>
                        </select>
                    </td>
                </tr>
            `).join("");

            tbodyEl.querySelectorAll("tr").forEach(tr => {
                tr.addEventListener("click", () => {
                    selectedLevel = Number(tr.dataset.lvIdx) || 0;
                    tbodyEl.querySelectorAll("tr").forEach((r, i) => {
                        r.style.background = i === selectedLevel ? "#e6f2ff" : "#fff";
                    });
                });
            });
            tbodyEl.querySelectorAll(".ss-cs-col").forEach(sel => {
                sel.addEventListener("change", () => {
                    const i = Number(sel.dataset.lvIdx);
                    levels[i].col = Number(sel.value);
                });
            });
            tbodyEl.querySelectorAll(".ss-cs-dir").forEach(sel => {
                sel.addEventListener("change", () => {
                    const i = Number(sel.dataset.lvIdx);
                    levels[i].asc = sel.value === "asc";
                });
            });
        };

        headerChk?.addEventListener("change", () => {
            hasHeader = headerChk.checked;
            renderLevels();
        });
        modal?.querySelector(".ss-cs-add")?.addEventListener("click", () => {
            if (levels.length >= 5) return;
            const nextCol = cols.find(c => !levels.some(l => l.col === c.col))?.col ?? bounds.minCol;
            levels.push({ col: nextCol, asc: true });
            selectedLevel = levels.length - 1;
            renderLevels();
        });
        modal?.querySelector(".ss-cs-del")?.addEventListener("click", () => {
            if (levels.length <= 1) return;
            levels.splice(selectedLevel, 1);
            selectedLevel = Math.max(0, Math.min(selectedLevel, levels.length - 1));
            renderLevels();
        });

        renderLevels();
    }

    return {
        modifySheetRowCol,
        sortSelectedRange,
        sortRangeByCriteria,
        openCustomSortDialog
    };
}