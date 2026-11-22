// range-move.js
// セル範囲移動・複製・プレビュー枠描画・結合衝突判定・数式/テーブル/フィルター/条件付き書式追従

import {
    getColumnName,
    columnLettersToIndex
} from "./format-utils.js";

export function isCoordInBounds(row, col, bounds) {
    return row >= bounds.minRow && row <= bounds.maxRow &&
        col >= bounds.minCol && col <= bounds.maxCol;
}

export function isRangeWithinBounds(r1, c1, r2, c2, bounds) {
    const minR = Math.min(r1, r2), maxR = Math.max(r1, r2);
    const minC = Math.min(c1, c2), maxC = Math.max(c1, c2);
    return minR >= bounds.minRow && maxR <= bounds.maxRow &&
        minC >= bounds.minCol && maxC <= bounds.maxCol;
}

export function createRangeMoveModule(ctx) {
    const {
        spreadsheetContent,
        theadRow,
        colgroup,
        tbody,
        formulaBarInput,
        getActiveCell,
        getSheets,
        getActiveSheetIndex,
        isCurrentSheetProtected,
        isCellLockedForEdit,
        getCell,
        getVisibleCell,
        getRow,
        getColumnWidth,
        extractCellStyleObject,
        applyCellStyleData,
        evaluateFormula,
        adjustFormula,
        clearSpillCellsFromAnchor,
        setCellFormattedValue,
        syncCellAnnotationMark,
        applyShrinkToFit,
        clearSelection,
        setActiveCell,
        getFloatingObjectsInBounds,
        getRangeLocalRect,
        snapshotFloatingObject,
        spawnFloatingObjectFromSnapshot,
        renderChartBoxSVG,
        getSheetTables,
        applyStructuredTableVisuals,
        shiftAutoFiltersForMove,
        hasAutoFilters,
        applyAutoFilterRows,
        updateAllFormulas,
        applyConditionalFormats,
        refreshVisibleFloatingObjects,
        updateSelectedCellsDisplay,
        updateFillHandle,
        showAlert,
        setDirtyState,
        debouncedSaveState
    } = ctx;

    const movePreviewBox = document.createElement("div");
    movePreviewBox.className = "ss-move-preview-box";
    spreadsheetContent.appendChild(movePreviewBox);

    function clearMoveTargetPreview() {
        movePreviewBox.style.display = "none";
        movePreviewBox.classList.remove("invalid");
    }

    function getMovePreviewLocalRect(bounds) {
        if (!bounds) return null;
        const theadHeight = theadRow.offsetHeight || 30;
        const rowHeaderWidth = theadRow.cells[0]?.offsetWidth || parseInt(colgroup.children[0]?.style.width, 10) || 54;

        let left = rowHeaderWidth;
        for (let c = 0; c < bounds.minCol; c++) {
            left += getColumnWidth(c);
        }
        let right = left;
        for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
            right += getColumnWidth(c);
        }

        const getRowH = (r) => {
            const tr = getRow(r);
            if (!tr) return 30;
            if (tr.style.display === "none") return 0;
            return parseInt(tr.style.height, 10) || tr.offsetHeight || 30;
        };

        let top = theadHeight;
        for (let r = 1; r < bounds.minRow; r++) {
            top += getRowH(r);
        }
        let bottom = top;
        for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
            bottom += getRowH(r);
        }
        return { left, top, right, bottom };
    }

    function showMoveTargetPreview(destBounds, isInvalid) {
        const rect = getMovePreviewLocalRect(destBounds);
        if (!rect) {
            clearMoveTargetPreview();
            return;
        }
        movePreviewBox.style.left = `${rect.left}px`;
        movePreviewBox.style.top = `${rect.top}px`;
        movePreviewBox.style.width = `${Math.max(4, rect.right - rect.left)}px`;
        movePreviewBox.style.height = `${Math.max(4, rect.bottom - rect.top)}px`;
        movePreviewBox.classList.toggle("invalid", Boolean(isInvalid));
        movePreviewBox.style.display = "block";
    }

    function resolveGridCoordFromClientPoint(clientX, clientY) {
        const elem = document.elementFromPoint(clientX, clientY)?.closest("td");
        if (!elem || !tbody.contains(elem)) return null;

        const baseRow = parseInt(elem.dataset.row, 10);
        const baseCol = parseInt(elem.dataset.col, 10);
        const rs = parseInt(elem.getAttribute("rowspan") || "1", 10);
        const cs = parseInt(elem.getAttribute("colspan") || "1", 10);
        if (rs <= 1 && cs <= 1) {
            return { row: baseRow, col: baseCol };
        }

        const rect = elem.getBoundingClientRect();
        let subR = 0;
        if (rs > 1 && rect.height > 0) {
            const rowHeights = [];
            let totalH = 0;
            for (let i = 0; i < rs; i++) {
                const tr = getRow(baseRow + i);
                const h = (tr && tr.style.display !== "none")
                    ? (parseInt(tr.style.height, 10) || tr.offsetHeight || 30)
                    : 0;
                rowHeights.push(h);
                totalH += h;
            }
            const relY = Math.max(0, Math.min(rect.height, clientY - rect.top));
            const scaledY = totalH > 0 ? (relY / rect.height) * totalH : 0;
            let accH = 0;
            subR = rs - 1;
            for (let i = 0; i < rs; i++) {
                accH += rowHeights[i];
                if (scaledY < accH) {
                    subR = i;
                    break;
                }
            }
        }

        let subC = 0;
        if (cs > 1 && rect.width > 0) {
            const colWidths = [];
            let totalW = 0;
            for (let j = 0; j < cs; j++) {
                const w = getColumnWidth(baseCol + j);
                colWidths.push(w);
                totalW += w;
            }
            const relX = Math.max(0, Math.min(rect.width, clientX - rect.left));
            const scaledX = totalW > 0 ? (relX / rect.width) * totalW : 0;
            let accW = 0;
            subC = cs - 1;
            for (let j = 0; j < cs; j++) {
                accW += colWidths[j];
                if (scaledX < accW) {
                    subC = j;
                    break;
                }
            }
        }

        return { row: baseRow + subR, col: baseCol + subC };
    }

    function hasMergeConflictOnDestination(bounds, ignoreBounds = null) {
        if (!bounds) return false;
        const isInsideIgnore = (r, c) => (
            ignoreBounds &&
            r >= ignoreBounds.minRow && r <= ignoreBounds.maxRow &&
            c >= ignoreBounds.minCol && c <= ignoreBounds.maxCol
        );

        const mergedAnchors = new Set();
        for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
            for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
                const cell = getCell(r, c);
                if (!cell) continue;
                let aR = r, aC = c;
                if (cell.dataset.mergeAnchorRow !== undefined) {
                    aR = parseInt(cell.dataset.mergeAnchorRow, 10);
                    aC = parseInt(cell.dataset.mergeAnchorCol, 10);
                } else if (
                    parseInt(cell.getAttribute("rowspan") || "1", 10) === 1 &&
                    parseInt(cell.getAttribute("colspan") || "1", 10) === 1
                ) {
                    continue;
                }
                mergedAnchors.add(`${aR},${aC}`);
            }
        }

        for (const key of mergedAnchors) {
            const [aR, aC] = key.split(",").map(Number);
            const anchor = getCell(aR, aC);
            if (!anchor) continue;
            const mMinR = aR;
            const mMaxR = aR + parseInt(anchor.getAttribute("rowspan") || "1", 10) - 1;
            const mMinC = aC;
            const mMaxC = aC + parseInt(anchor.getAttribute("colspan") || "1", 10) - 1;

            // 移動元自身の結合セルなら衝突とみなさない
            if (isInsideIgnore(mMinR, mMinC) && isInsideIgnore(mMaxR, mMaxC)) {
                continue;
            }
            // 結合セル全体が貼り付け先範囲の内部に完全に収まっているならOK
            if (
                mMinR >= bounds.minRow && mMaxR <= bounds.maxRow &&
                mMinC >= bounds.minCol && mMaxC <= bounds.maxCol
            ) {
                continue;
            }
            return true;
        }
        return false;
    }

    function adjustFormulaRefsInMovedRange(formula, srcBounds, rowDelta, colDelta) {
        if (!formula || formula[0] !== "=" || (rowDelta === 0 && colDelta === 0)) return formula;
        const activeSheetName = getSheets()[getActiveSheetIndex()]?.name || "";
        const stringLiterals = [];
        const masked = formula.substring(1).replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'(?!\s*!)/g, (m) => {
            const token = `__CF_MOV_${stringLiterals.length}__`;
            stringLiterals.push(m);
            return token;
        });

        const tokenRegex = /((?:'(?:''|[^'])+'|[A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+)!)?(?<![A-Za-z0-9_$])(\$?)([A-Za-z]+)(\$?)(\d+)(?::(\$?)([A-Za-z]+)(\$?)(\d+))?(?![A-Za-z0-9_!(]|\s*\()/g;
        const replaced = masked.replace(tokenRegex, (match, sheetPrefix, aC1, col1, aR1, row1, aC2, col2, aR2, row2) => {
            if (sheetPrefix) {
                const rawSheet = sheetPrefix.slice(0, -1);
                const unquoted = (rawSheet.startsWith("'") && rawSheet.endsWith("'"))
                    ? rawSheet.slice(1, -1).replace(/''/g, "'")
                    : rawSheet;
                if (unquoted !== activeSheetName) return match;
            }
            const prefix = sheetPrefix || "";
            const c1 = columnLettersToIndex(col1);
            const r1 = parseInt(row1, 10);

            if (col2 !== undefined) {
                const c2 = columnLettersToIndex(col2);
                const r2 = parseInt(row2, 10);
                if (isRangeWithinBounds(r1, c1, r2, c2, srcBounds)) {
                    const nc1 = Math.max(0, c1 + colDelta);
                    const nr1 = Math.max(1, r1 + rowDelta);
                    const nc2 = Math.max(0, c2 + colDelta);
                    const nr2 = Math.max(1, r2 + rowDelta);
                    return `${prefix}${aC1}${getColumnName(nc1)}${aR1}${nr1}:${aC2}${getColumnName(nc2)}${aR2}${nr2}`;
                }
                return match;
            }
            if (isCoordInBounds(r1, c1, srcBounds)) {
                const nc1 = Math.max(0, c1 + colDelta);
                const nr1 = Math.max(1, r1 + rowDelta);
                return `${prefix}${aC1}${getColumnName(nc1)}${aR1}${nr1}`;
            }
            return match;
        });

        return "=" + replaced.replace(/__CF_MOV_(\d+)__/g, (_, idx) => stringLiterals[Number(idx)]);
    }

    function shiftConditionalFormatsForMoveOrCopy(srcBounds, rowDelta, colDelta, { copyMode = false } = {}) {
        const sheets = getSheets();
        const activeIdx = getActiveSheetIndex();
        const cfRules = sheets[activeIdx]?.conditionalFormats;
        if (!Array.isArray(cfRules) || !cfRules.length || !srcBounds) return;
        if (rowDelta === 0 && colDelta === 0) return;

        const shiftRuleFormulas = (ruleObj, fn) => {
            if (ruleObj.formula && String(ruleObj.formula).trim().startsWith("=")) {
                ruleObj.formula = fn(ruleObj.formula);
            }
            if (typeof ruleObj.val1 === "string" && ruleObj.val1.trim().startsWith("=")) {
                ruleObj.val1 = fn(ruleObj.val1);
            }
            if (typeof ruleObj.val2 === "string" && ruleObj.val2.trim().startsWith("=")) {
                ruleObj.val2 = fn(ruleObj.val2);
            }
        };

        const nextRules = [];
        let changed = false;

        for (const rule of cfRules) {
            const iMinR = Math.max(rule.minRow, srcBounds.minRow);
            const iMaxR = Math.min(rule.maxRow, srcBounds.maxRow);
            const iMinC = Math.max(rule.minCol, srcBounds.minCol);
            const iMaxC = Math.min(rule.maxCol, srcBounds.maxCol);

            // 移動・コピー範囲と重ならないルールはそのまま維持
            if (iMinR > iMaxR || iMinC > iMaxC) {
                nextRules.push(rule);
                continue;
            }

            changed = true;
            const isWholeRuleCovered =
                iMinR === rule.minRow && iMaxR === rule.maxRow &&
                iMinC === rule.minCol && iMaxC === rule.maxCol;

            // 1. 移動先（またはコピー先）のルールを生成
            const movedRule = JSON.parse(JSON.stringify(rule));
            movedRule.minRow = Math.max(1, iMinR + rowDelta);
            movedRule.maxRow = Math.max(movedRule.minRow, iMaxR + rowDelta);
            movedRule.minCol = Math.max(0, iMinC + colDelta);
            movedRule.maxCol = Math.max(movedRule.minCol, iMaxC + colDelta);

            const anchorRowOff = iMinR - rule.minRow;
            const anchorColOff = iMinC - rule.minCol;
            shiftRuleFormulas(movedRule, (f) => {
                // 元ルールの左上から切り出し範囲の左上へ相対位置を合わせる
                let adjusted = (anchorRowOff !== 0 || anchorColOff !== 0)
                    ? adjustFormula(f, anchorRowOff, anchorColOff)
                    : f;
                if (copyMode) {
                    // 複製時は $ 絶対参照を固定し、相対参照だけ移動量シフト
                    return adjustFormula(adjusted, rowDelta, colDelta);
                }
                // 移動時は移動範囲内を指す参照を $ 付きも含めて移動先へ追従
                return adjustFormulaRefsInMovedRange(adjusted, srcBounds, rowDelta, colDelta);
            });

            if (copyMode) {
                nextRules.push(rule);
                nextRules.push(movedRule);
            } else if (isWholeRuleCovered) {
                nextRules.push(movedRule);
            } else {
                // 部分移動：元ルールから移動済み矩形をくり抜いた残り（最大4矩形）を保持
                const remainders = [];
                if (rule.minRow < iMinR) {
                    remainders.push({ minRow: rule.minRow, maxRow: iMinR - 1, minCol: rule.minCol, maxCol: rule.maxCol });
                }
                if (rule.maxRow > iMaxR) {
                    remainders.push({ minRow: iMaxR + 1, maxRow: rule.maxRow, minCol: rule.minCol, maxCol: rule.maxCol });
                }
                if (rule.minCol < iMinC) {
                    remainders.push({ minRow: iMinR, maxRow: iMaxR, minCol: rule.minCol, maxCol: iMinC - 1 });
                }
                if (rule.maxCol > iMaxC) {
                    remainders.push({ minRow: iMinR, maxRow: iMaxR, minCol: iMaxC + 1, maxCol: rule.maxCol });
                }

                remainders.forEach(rem => {
                    const subRule = JSON.parse(JSON.stringify(rule));
                    subRule.minRow = rem.minRow;
                    subRule.maxRow = rem.maxRow;
                    subRule.minCol = rem.minCol;
                    subRule.maxCol = rem.maxCol;
                    const dr = rem.minRow - rule.minRow;
                    const dc = rem.minCol - rule.minCol;
                    if (dr !== 0 || dc !== 0) {
                        shiftRuleFormulas(subRule, (f) => adjustFormula(f, dr, dc));
                    }
                    nextRules.push(subRule);
                });
                nextRules.push(movedRule);
            }
        }

        if (changed) {
            sheets[activeIdx].conditionalFormats = nextRules;
            applyConditionalFormats();
        }
    }

    function shiftTablesAndAutoFilterForMove(srcBounds, rowDelta, colDelta) {
        if (!srcBounds || (rowDelta === 0 && colDelta === 0)) return;

        // 1. 構造化テーブル（Ctrl+T / 表の書式）の座標を移動先へ追従
        const tables = getSheetTables();
        tables.forEach(tbl => {
            const isTableInsideMove =
                tbl.minRow >= srcBounds.minRow && tbl.maxRow <= srcBounds.maxRow &&
                tbl.minCol >= srcBounds.minCol && tbl.maxCol <= srcBounds.maxCol;
            if (!isTableInsideMove) return;

            tbl.minRow = Math.max(1, tbl.minRow + rowDelta);
            tbl.maxRow = Math.max(tbl.minRow, tbl.maxRow + rowDelta);
            tbl.minCol = Math.max(0, tbl.minCol + colDelta);
            tbl.maxCol = Math.max(tbl.minCol, tbl.maxCol + colDelta);
            applyStructuredTableVisuals(tbl);
        });

        // 2. 移動範囲内に含まれるすべてのオートフィルターの座標・対象列・▼ボタンを移動先へ追従
        shiftAutoFiltersForMove(srcBounds, rowDelta, colDelta);

        // 3. 条件付き書式ルールの適用範囲・内部数式を移動先へ追従（部分移動・$絶対参照も対応）
        shiftConditionalFormatsForMoveOrCopy(srcBounds, rowDelta, colDelta, { copyMode: false });
    }

    // 移動したセル「自身」の数式調整（Excel準拠：移動範囲内を指す参照は$付きでも移動先へ追従、範囲外参照は固定）
    function adjustMovedFormulaSelf(formula, srcBounds, rowDelta, colDelta) {
        return adjustFormulaRefsInMovedRange(formula, srcBounds, rowDelta, colDelta);
    }

    // 移動していない「他セル（他シート含む）」の数式参照を移動先へ追従（Excel準拠：$付きも移動先へ追従）
    function redirectFormulasForMovedRange(srcBounds, rowDelta, colDelta, destBounds) {
        if (rowDelta === 0 && colDelta === 0) return;

        const sheets = getSheets();
        const activeIdx = getActiveSheetIndex();
        const activeSheetName = sheets[activeIdx]?.name || "";
        const activeCell = getActiveCell();

        const shiftRefTokens = (expr, allowSheetPrefix = false) => {
            const tokenRegex = /((?:'(?:''|[^'])+'|[A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+)!)?(?<![A-Za-z0-9_$])(\$?)([A-Za-z]+)(\$?)(\d+)(?::(\$?)([A-Za-z]+)(\$?)(\d+))?(?![A-Za-z0-9_!(]|\s*\()/g;
            return expr.replace(tokenRegex, (match, sheetPrefix, aC1, col1, aR1, row1, aC2, col2, aR2, row2) => {
                if (sheetPrefix) {
                    if (!allowSheetPrefix) return match;
                    const rawSheet = sheetPrefix.slice(0, -1);
                    const unquoted = (rawSheet.startsWith("'") && rawSheet.endsWith("'"))
                        ? rawSheet.slice(1, -1).replace(/''/g, "'")
                        : rawSheet;
                    if (unquoted !== activeSheetName) return match;
                }
                const prefix = sheetPrefix || "";
                const c1 = columnLettersToIndex(col1);
                const r1 = parseInt(row1, 10);

                if (col2 !== undefined) {
                    const c2 = columnLettersToIndex(col2);
                    const r2 = parseInt(row2, 10);
                    if (isRangeWithinBounds(r1, c1, r2, c2, srcBounds)) {
                        const nc1 = Math.max(0, c1 + colDelta);
                        const nr1 = Math.max(1, r1 + rowDelta);
                        const nc2 = Math.max(0, c2 + colDelta);
                        const nr2 = Math.max(1, r2 + rowDelta);
                        return `${prefix}${aC1}${getColumnName(nc1)}${aR1}${nr1}:${aC2}${getColumnName(nc2)}${aR2}${nr2}`;
                    }
                    return match;
                } else {
                    if (isCoordInBounds(r1, c1, srcBounds)) {
                        const nc1 = Math.max(0, c1 + colDelta);
                        const nr1 = Math.max(1, r1 + rowDelta);
                        return `${prefix}${aC1}${getColumnName(nc1)}${aR1}${nr1}`;
                    }
                    return match;
                }
            });
        };

        // 1. アクティブシートの「移動先範囲外」にある数式セルを更新
        const rewriteActiveSheetFormula = (formula) => {
            if (!formula || formula[0] !== "=") return formula;
            const stringLiterals = [];
            const masked = formula.substring(1).replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'(?!\s*!)/g, (m) => {
                const token = `__REDIR_STR_${stringLiterals.length}__`;
                stringLiterals.push(m);
                return token;
            });

            const replaced = shiftRefTokens(masked, true);
            return "=" + replaced.replace(/__REDIR_STR_(\d+)__/g, (_, idx) => stringLiterals[Number(idx)]);
        };

        tbody.querySelectorAll("td[data-formula]").forEach(td => {
            const r = parseInt(td.dataset.row, 10);
            const c = parseInt(td.dataset.col, 10);
            if (destBounds && isCoordInBounds(r, c, destBounds)) return;

            const oldFormula = td.dataset.formula;
            const newFormula = rewriteActiveSheetFormula(oldFormula);
            if (newFormula !== oldFormula) {
                td.dataset.formula = newFormula;
                if (td === activeCell && formulaBarInput && document.activeElement !== formulaBarInput) {
                    formulaBarInput.value = newFormula;
                }
            }
        });

        // 1-B. アクティブシートの「移動範囲外」にある条件付き書式の参照も移動先へ追従
        const activeCfRules = sheets[activeIdx]?.conditionalFormats;
        if (Array.isArray(activeCfRules) && activeCfRules.length > 0) {
            activeCfRules.forEach(rule => {
                const overlapsSrc = !(
                    rule.maxRow < srcBounds.minRow || rule.minRow > srcBounds.maxRow ||
                    rule.maxCol < srcBounds.minCol || rule.minCol > srcBounds.maxCol
                );
                if (overlapsSrc) return;
                if (rule.formula && String(rule.formula).trim().startsWith("=")) {
                    rule.formula = adjustFormulaRefsInMovedRange(rule.formula, srcBounds, rowDelta, colDelta);
                }
                if (typeof rule.val1 === "string" && rule.val1.trim().startsWith("=")) {
                    rule.val1 = adjustFormulaRefsInMovedRange(rule.val1, srcBounds, rowDelta, colDelta);
                }
                if (typeof rule.val2 === "string" && rule.val2.trim().startsWith("=")) {
                    rule.val2 = adjustFormulaRefsInMovedRange(rule.val2, srcBounds, rowDelta, colDelta);
                }
            });
        }

        // 2. 他シートからアクティブシートを参照している数式・条件付き書式も追従更新
        if (activeSheetName && Array.isArray(sheets)) {
            const escapedName = activeSheetName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const escapedQuotedName = activeSheetName.replace(/'/g, "''").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const crossSheetRefRegex = new RegExp(
                `((?:'${escapedQuotedName}'|${escapedName})!)` +
                `(\\$?[A-Za-z]+\\$?\\d+(?::\\$?[A-Za-z]+\\$?\\d+)?)`,
                "g"
            );

            const rewriteCrossSheetExpr = (exprStr) => {
                if (!exprStr || exprStr[0] !== "=") return exprStr;
                const stringLiterals = [];
                const masked = exprStr.substring(1).replace(/"(?:\\.|[^"\\])*"/g, (m) => {
                    const token = `__XSHEET_STR_${stringLiterals.length}__`;
                    stringLiterals.push(m);
                    return token;
                });
                const replaced = masked.replace(crossSheetRefRegex, (_, sheetPrefix, refPart) => {
                    return sheetPrefix + shiftRefTokens(refPart);
                });
                return "=" + replaced.replace(/__XSHEET_STR_(\d+)__/g, (_, i) => stringLiterals[Number(i)]);
            };

            sheets.forEach((sheet, idx) => {
                if (idx === activeIdx) return;
                if (Array.isArray(sheet.cells)) {
                    sheet.cells.forEach(entry => {
                        if (entry.f && entry.f[0] === "=") {
                            entry.f = rewriteCrossSheetExpr(entry.f);
                        }
                    });
                }
                if (Array.isArray(sheet.conditionalFormats)) {
                    sheet.conditionalFormats.forEach(rule => {
                        if (rule.formula && String(rule.formula).trim().startsWith("=")) {
                            rule.formula = rewriteCrossSheetExpr(rule.formula);
                        }
                        if (typeof rule.val1 === "string" && rule.val1.trim().startsWith("=")) {
                            rule.val1 = rewriteCrossSheetExpr(rule.val1);
                        }
                        if (typeof rule.val2 === "string" && rule.val2.trim().startsWith("=")) {
                            rule.val2 = rewriteCrossSheetExpr(rule.val2);
                        }
                    });
                }
            });
        }
    }

    function executeRangeMove(srcBounds, destTopLeft, copyMode = false) {
        if (!srcBounds || !destTopLeft) return;
        const rowDelta = destTopLeft.row - srcBounds.minRow;
        const colDelta = destTopLeft.col - srcBounds.minCol;
        if (rowDelta === 0 && colDelta === 0) return;

        const height = srcBounds.maxRow - srcBounds.minRow + 1;
        const width = srcBounds.maxCol - srcBounds.minCol + 1;
        const destBounds = {
            minRow: destTopLeft.row,
            maxRow: destTopLeft.row + height - 1,
            minCol: destTopLeft.col,
            maxCol: destTopLeft.col + width - 1
        };

        // 本物のExcel準拠：移動先（複製時は移動元含む）に結合セルが部分的に重なる場合は移動不可
        if (hasMergeConflictOnDestination(destBounds, copyMode ? null : srcBounds)) {
            showAlert("結合されたセルの一部を変更することはできません。", "移動エラー");
            return;
        }

        // シート保護チェック
        if (isCurrentSheetProtected?.()) {
            const hasLockedInBounds = (b) => {
                for (let r = b.minRow; r <= b.maxRow; r++) {
                    for (let c = b.minCol; c <= b.maxCol; c++) {
                        if (isCellLockedForEdit?.(getVisibleCell(r, c))) return true;
                    }
                }
                return false;
            };
            if (hasLockedInBounds(destBounds) || (!copyMode && hasLockedInBounds(srcBounds))) {
                showAlert("保護されたシート上のロックされたセルは移動・変更できません。", "シートの保護");
                return;
            }
        }

        const items = [];
        for (let r = srcBounds.minRow; r <= srcBounds.maxRow; r++) {
            for (let c = srcBounds.minCol; c <= srcBounds.maxCol; c++) {
                const cell = getCell(r, c);
                if (!cell || cell.style.display === "none") continue;
                items.push({
                    relR: r - srcBounds.minRow,
                    relC: c - srcBounds.minCol,
                    value: cell.dataset.rawValue ?? cell.textContent,
                    formula: cell.dataset.formula || "",
                    quotePrefix: cell.dataset.quotePrefix || "",
                    numFormat: cell.dataset.numFormat || "",
                    decimalPlaces: cell.dataset.decimalPlaces ?? "",
                    dropdownList: cell.dataset.dropdownList || "",
                    dvRule: cell.dataset.dvRule || "",
                    valueType: cell.dataset.valueType || "",
                    dateValue: cell.dataset.dateValue || "",
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
                    colspan: parseInt(cell.getAttribute("colspan") || "1", 10)
                });
            }
        }

        // 複製モードでなければ移動元をクリア（結合・スピル・ツールチップも解除）
        if (!copyMode) {
            for (let r = srcBounds.minRow; r <= srcBounds.maxRow; r++) {
                for (let c = srcBounds.minCol; c <= srcBounds.maxCol; c++) {
                    const srcCell = getCell(r, c);
                    if (!srcCell) continue;
                    clearSpillCellsFromAnchor?.(r, c);
                    srcCell.textContent = "";
                    srcCell.removeAttribute("style");
                    srcCell.removeAttribute("title");
                    srcCell.removeAttribute("rowspan");
                    srcCell.removeAttribute("colspan");
                    srcCell.className = "";
                    Object.keys(srcCell.dataset).forEach(k => {
                        if (k !== "row" && k !== "col") delete srcCell.dataset[k];
                    });
                }
            }
        }

        // 移動先に元々丸ごと含まれていた既存結合セルがあれば先に解除しておく
        for (let r = destBounds.minRow; r <= destBounds.maxRow; r++) {
            for (let c = destBounds.minCol; c <= destBounds.maxCol; c++) {
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

        // 移動先へデータ・スタイル・結合を配置
        items.forEach(item => {
            const tr = destTopLeft.row + item.relR;
            const tc = destTopLeft.col + item.relC;
            const dest = getCell(tr, tc);
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

            clearSpillCellsFromAnchor?.(tr, tc);
            delete dest.dataset.spillOrigin;
            if (item.quotePrefix === "1") dest.dataset.quotePrefix = "1";
            else delete dest.dataset.quotePrefix;

            if (item.formula) {
                const nextFormula = copyMode
                    ? adjustFormula(item.formula, rowDelta, colDelta)
                    : adjustMovedFormulaSelf(item.formula, srcBounds, rowDelta, colDelta);
                dest.dataset.formula = nextFormula;
                setCellFormattedValue(dest, evaluateFormula(nextFormula));
            } else {
                delete dest.dataset.formula;
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

            if (item.rowspan > 1 || item.colspan > 1) {
                const maxR = tr + item.rowspan - 1;
                const maxC = tc + item.colspan - 1;
                dest.setAttribute("rowspan", String(item.rowspan));
                dest.setAttribute("colspan", String(item.colspan));
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
        });

        // 移動先を選択状態にする
        clearSelection();
        for (let r = destTopLeft.row; r < destTopLeft.row + height; r++) {
            for (let c = destTopLeft.col; c < destTopLeft.col + width; c++) {
                const selCell = getVisibleCell(r, c);
                if (selCell && selCell.style.display !== "none") {
                    selCell.classList.add("selected");
                }
            }
        }

        // 範囲内のテキストボックス・グラフも移動／複製に追従させる
        const floatingInRange = getFloatingObjectsInBounds(srcBounds);
        if (floatingInRange.length > 0) {
            const srcRect = getRangeLocalRect(srcBounds);
            const destRect = getRangeLocalRect(destBounds);
            if (srcRect && destRect) {
                if (copyMode) {
                    floatingInRange.forEach(box => {
                        const snap = snapshotFloatingObject(box, srcRect);
                        spawnFloatingObjectFromSnapshot(snap, destRect, rowDelta, colDelta);
                    });
                } else {
                    const dx = destRect.left - srcRect.left;
                    const dy = destRect.top - srcRect.top;
                    floatingInRange.forEach(box => {
                        const curLeft = parseFloat(box.dataset.initialLeft || box.style.left) || 0;
                        const curTop = parseFloat(box.dataset.initialTop || box.style.top) || 0;
                        const nextLeft = Math.max(0, Math.round(curLeft + dx));
                        const nextTop = Math.max(0, Math.round(curTop + dy));
                        box.dataset.initialLeft = String(nextLeft);
                        box.dataset.initialTop = String(nextTop);
                        box.style.left = `${nextLeft}px`;
                        box.style.top = `${nextTop}px`;

                        if (box.classList.contains("floating-chart") && box.dataset.sourceRange) {
                            const shifted = adjustMovedFormulaSelf("=" + box.dataset.sourceRange, srcBounds, rowDelta, colDelta);
                            if (shifted.startsWith("=")) {
                                box.dataset.sourceRange = shifted.slice(1);
                                renderChartBoxSVG(box);
                            }
                        }
                    });
                }
            }
        }

        // Excel準拠：移動時は数式・テーブル・フィルター・条件付き書式を追従、複製時は条件付き書式をコピー
        if (!copyMode) {
            redirectFormulasForMovedRange(srcBounds, rowDelta, colDelta, destBounds);
            shiftTablesAndAutoFilterForMove(srcBounds, rowDelta, colDelta);
        } else {
            shiftConditionalFormatsForMoveOrCopy(srcBounds, rowDelta, colDelta, { copyMode: true });
        }

        const newActive = getVisibleCell(destTopLeft.row, destTopLeft.col);
        if (newActive) setActiveCell(newActive, true);

        updateAllFormulas();
        applyConditionalFormats();
        if (hasAutoFilters()) applyAutoFilterRows();
        refreshVisibleFloatingObjects();
        updateSelectedCellsDisplay();
        updateFillHandle();
        setDirtyState(true);
        debouncedSaveState();
    }

    return {
        clearMoveTargetPreview,
        getMovePreviewLocalRect,
        showMoveTargetPreview,
        resolveGridCoordFromClientPoint,
        hasMergeConflictOnDestination,
        executeRangeMove,
        shiftTablesAndAutoFilterForMove,
        shiftConditionalFormatsForMoveOrCopy,
        adjustMovedFormulaSelf,
        redirectFormulasForMovedRange
    };
}