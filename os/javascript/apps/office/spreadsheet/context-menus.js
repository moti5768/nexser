// context-menus.js
// シートタブ・行ヘッダー・列ヘッダー・セルの右クリックコンテキストメニュー登録

import { attachContextMenu } from "../../../context-menu.js";
import { getColumnName, columnLettersToIndex } from "./format-utils.js";

export function registerContextMenus(ctx) {
    const {
        sheetTabsListEl,
        table,
        tbody,
        getActiveSheetIndex,
        getSheetsLength,
        addNewSheet,
        renameSheetDialog,
        duplicateSheet,
        moveSheet,
        deleteSheet,
        isCellEditing,
        getSelectedWholeRows,
        getSelectedWholeColumns,
        getCurrentColumns,
        getRowCount,
        getVisibleCell,
        getRow,
        clearSelection,
        setActiveCell,
        updateSelectedCellsDisplay,
        updateFillHandle,
        copySelectedCells,
        pasteClipboardData,
        openPasteSpecialDialog,
        modifySheetRowCol,
        clearTargetCellsContent,
        openFormatCellsModal,
        openDimensionInputDialog,
        autoFitRow,
        autoFitColumn,
        setDirtyState,
        debouncedSaveState,
        setRowsVisibility,
        setColumnsVisibility,
        getFreezeRows,
        getFreezeCols,
        setFreezePanes,
        sortSelectedRange,
        openCustomSortDialog,
        resolveCellFromPoint,
        handleAppAction,
        openConditionalFormatManager,
        openDataValidationDialog,
        toggleAutoFilter,
        mergeSelectedCells,
        unmergeSelectedCells,
        openCellAnnotationModal,
        openDefineNameModal,
        extractHyperlinkTarget,
        activateCellHyperlink,
        openHyperlinkDialog
    } = ctx;

    // シートタブ右クリックメニュー
    if (sheetTabsListEl) {
        attachContextMenu(sheetTabsListEl, (e) => {
            const tabEl = e.target.closest(".ss-sheet-tab");
            const idx = tabEl ? parseInt(tabEl.dataset.sheetIndex, 10) : getActiveSheetIndex();
            const sheetsLen = getSheetsLength();
            return [
                { label: "新しいシートを挿入", action: () => void addNewSheet(idx) },
                { label: "名前の変更...", action: () => renameSheetDialog(idx) },
                { label: "シートを複製", action: () => void duplicateSheet(idx) },
                { label: "---" },
                { label: "左へ移動", action: () => moveSheet(idx, -1), disabled: idx <= 0 },
                { label: "右へ移動", action: () => moveSheet(idx, 1), disabled: idx >= sheetsLen - 1 },
                { label: "---" },
                { label: "シートを削除", action: () => deleteSheet(idx), disabled: sheetsLen <= 1 }
            ];
        });
    }

    // テーブル（行ヘッダー・列ヘッダー・通常セル）右クリックメニュー
    attachContextMenu(table, (e) => {
        if (e.target.closest(".floating-textbox")) return null;
        if (isCellEditing()) return null;

        const colCount = getCurrentColumns();
        const curRowCount = getRowCount();
        const curFreezeRows = getFreezeRows();
        const curFreezeCols = getFreezeCols();

        // 1. 行ヘッダー右クリック（複数行選択を維持して一括操作）
        const rowHeader = e.target.closest("th.row_number");
        if (rowHeader) {
            const rowNum = parseInt(rowHeader.textContent.trim(), 10);
            const wholeRows = getSelectedWholeRows();
            const targetRows = wholeRows.includes(rowNum) && wholeRows.length > 0 ? wholeRows : [rowNum];
            if (!wholeRows.includes(rowNum)) {
                clearSelection();
                for (let c = 0; c < colCount; c++) {
                    const vis = getVisibleCell(rowNum, c);
                    if (vis && vis.style.display !== "none" && !vis.classList.contains("ss-col-hidden")) {
                        vis.classList.add("selected");
                    }
                }
                setActiveCell(getVisibleCell(rowNum, 0), true);
                updateSelectedCellsDisplay();
                updateFillHandle();
            }
            const minR = targetRows[0];
            const maxR = targetRows[targetRows.length - 1];
            const unhideRows = [];
            for (let r = Math.max(1, minR - 1); r <= Math.min(tbody.rows.length, maxR + 1); r++) unhideRows.push(r);

            return [
                { label: "切り取り (Ctrl+X)", action: () => copySelectedCells(true) },
                { label: "コピー (Ctrl+C)", action: () => copySelectedCells(false) },
                { label: "貼り付け (Ctrl+V)", action: () => void pasteClipboardData("all") },
                { label: "値のみ貼り付け", action: () => void pasteClipboardData("values") },
                { label: "書式のみ貼り付け", action: () => void pasteClipboardData("formats") },
                { label: "---" },
                { label: `行の挿入 (${targetRows.length}行)`, action: () => void modifySheetRowCol("insert-row") },
                { label: `行の削除 (${targetRows.length}行)`, action: () => void modifySheetRowCol("delete-row") },
                { label: "数式と値のクリア", action: clearTargetCellsContent },
                { label: "---" },
                { label: "セルの書式設定(F)... (Ctrl+1)", action: () => openFormatCellsModal("number") },
                { label: `行の高さ(R)... (${targetRows.length}行一括)`, action: () => openDimensionInputDialog("row", targetRows) },
                {
                    label: "行の高さの自動調整", action: () => {
                        targetRows.forEach(r => autoFitRow(getRow(r)));
                        setDirtyState(true);
                        debouncedSaveState();
                    }
                },
                { label: "---" },
                { label: `非表示 (${targetRows.length}行)`, action: () => setRowsVisibility(targetRows, false) },
                { label: "再表示", action: () => setRowsVisibility(unhideRows, true) },
                { label: "---" },
                {
                    label: curFreezeRows > 0 ? "行の固定を解除" : `${Math.max(1, minR - 1)}行目まで固定`,
                    action: () => setFreezePanes(curFreezeRows > 0 ? 0 : Math.max(1, minR - 1), curFreezeCols)
                }
            ];
        }

        // 2. 列ヘッダー右クリック（複数列選択を維持して一括操作）
        const colHeader = e.target.closest("th.col_number");
        if (colHeader) {
            const colIdx = columnLettersToIndex(colHeader.textContent.trim());
            const wholeCols = getSelectedWholeColumns();
            const targetCols = wholeCols.includes(colIdx) && wholeCols.length > 0 ? wholeCols : [colIdx];
            if (!wholeCols.includes(colIdx)) {
                clearSelection();
                for (let r = 1; r < curRowCount; r++) {
                    const vis = getVisibleCell(r, colIdx);
                    if (vis && vis.style.display !== "none" && !vis.classList.contains("ss-col-hidden")) {
                        vis.classList.add("selected");
                    }
                }
                setActiveCell(getVisibleCell(1, colIdx), true);
                updateSelectedCellsDisplay();
                updateFillHandle();
            }
            const minC = targetCols[0];
            const maxC = targetCols[targetCols.length - 1];
            const unhideCols = [];
            for (let c = Math.max(0, minC - 1); c <= Math.min(colCount - 1, maxC + 1); c++) unhideCols.push(c);

            return [
                { label: "切り取り (Ctrl+X)", action: () => copySelectedCells(true) },
                { label: "コピー (Ctrl+C)", action: () => copySelectedCells(false) },
                { label: "貼り付け (Ctrl+V)", action: () => void pasteClipboardData("all") },
                { label: "値のみ貼り付け", action: () => void pasteClipboardData("values") },
                { label: "書式のみ貼り付け", action: () => void pasteClipboardData("formats") },
                { label: "---" },
                { label: `列の挿入 (${targetCols.length}列)`, action: () => void modifySheetRowCol("insert-col") },
                { label: `列の削除 (${targetCols.length}列)`, action: () => void modifySheetRowCol("delete-col") },
                { label: "数式と値のクリア", action: clearTargetCellsContent },
                { label: "---" },
                { label: "セルの書式設定(F)... (Ctrl+1)", action: () => openFormatCellsModal("number") },
                { label: `列の幅(W)... (${targetCols.length}列一括)`, action: () => openDimensionInputDialog("col", targetCols) },
                {
                    label: "列幅の自動調整", action: () => {
                        targetCols.forEach(c => autoFitColumn(c));
                        setDirtyState(true);
                        debouncedSaveState();
                    }
                },
                { label: "---" },
                { label: `非表示 (${targetCols.length}列)`, action: () => setColumnsVisibility(targetCols, false) },
                { label: "再表示", action: () => setColumnsVisibility(unhideCols, true) },
                { label: "---" },
                { label: "昇順で並べ替え (A→Z)", action: () => sortSelectedRange(true) },
                { label: "降順で並べ替え (Z→A)", action: () => sortSelectedRange(false) },
                { label: "---" },
                {
                    label: curFreezeCols > 0 ? "列の固定を解除" : `${getColumnName(Math.max(0, minC - 1))}列まで固定`,
                    action: () => setFreezePanes(curFreezeRows, curFreezeCols > 0 ? 0 : Math.max(1, minC))
                }
            ];
        }

        // 3. 通常セル右クリック（Excel同等フルメニュー）
        const cell = resolveCellFromPoint(e);
        if (!cell || !tbody.contains(cell)) return null;

        if (!cell.classList.contains("selected")) {
            clearSelection();
            setActiveCell(cell, true);
            updateSelectedCellsDisplay();
            updateFillHandle();
        }

        const selectedList = Array.from(tbody.querySelectorAll("td.selected"));
        const canMerge = selectedList.length > 1;
        const canUnmerge = selectedList.some(td =>
            parseInt(td.getAttribute("rowspan") || "1", 10) > 1 ||
            parseInt(td.getAttribute("colspan") || "1", 10) > 1 ||
            Boolean(td.dataset.mergeMinRow)
        );
        const curR = parseInt(cell.dataset.row, 10);
        const curC = parseInt(cell.dataset.col, 10);

        return [
            { label: "切り取り (Ctrl+X)", action: () => copySelectedCells(true) },
            { label: "コピー (Ctrl+C)", action: () => copySelectedCells(false) },
            { label: "貼り付け (Ctrl+V)", action: () => void pasteClipboardData("all") },
            { label: "値のみ貼り付け (Ctrl+Shift+V)", action: () => void pasteClipboardData("values") },
            { label: "書式のみ貼り付け", action: () => void pasteClipboardData("formats") },
            { label: "行列を入れ替えて貼り付け", action: () => void pasteClipboardData("transpose") },
            { label: "形式を選択して貼り付け... (Ctrl+Alt+V)", action: () => openPasteSpecialDialog?.() },
            { label: "---" },
            { label: "行を上に挿入", action: () => void modifySheetRowCol("insert-row") },
            { label: "列を左に挿入", action: () => void modifySheetRowCol("insert-col") },
            { label: "行を削除", action: () => void modifySheetRowCol("delete-row") },
            { label: "列を削除", action: () => void modifySheetRowCol("delete-col") },
            { label: "数式と値のクリア (Delete)", action: clearTargetCellsContent },
            { label: "書式のクリア", action: () => void handleAppAction("clear-formats") },
            { label: "---" },
            { label: "セルの書式設定(F)... (Ctrl+1)", action: () => openFormatCellsModal("number") },
            { label: "条件付き書式の管理...", action: openConditionalFormatManager },
            { label: "データの入力規則...", action: openDataValidationDialog },
            { label: "行の高さを指定...", action: () => openDimensionInputDialog("row", [curR]) },
            { label: "列の幅を指定...", action: () => openDimensionInputDialog("col", [curC]) },
            { label: "---" },
            { label: "オートフィルターの切替 (Ctrl+Shift+L)", action: toggleAutoFilter },
            { label: "昇順で並べ替え (A→Z)", action: () => sortSelectedRange(true) },
            { label: "降順で並べ替え (Z→A)", action: () => sortSelectedRange(false) },
            { label: "ユーザー設定の並べ替え...", action: () => openCustomSortDialog?.() },
            { label: "---" },
            { label: "セル結合", action: mergeSelectedCells, disabled: !canMerge },
            { label: "結合解除", action: unmergeSelectedCells, disabled: !canUnmerge },
            { label: "---" },
            { label: cell.dataset.comment ? "コメントの編集/削除..." : "新しいコメント...", action: () => openCellAnnotationModal(cell, "comment") },
            { label: cell.dataset.note ? "メモの編集/削除..." : "新しいメモ...", action: () => openCellAnnotationModal(cell, "note") },
            { label: "名前の定義(N)...", action: openDefineNameModal },
            ...(extractHyperlinkTarget(cell) ? [{ label: "ハイパーリンクを開く", action: () => void activateCellHyperlink(cell) }] : []),
            { label: "ハイパーリンクの挿入/編集 (Ctrl+K)...", action: openHyperlinkDialog }
        ];
    });
}