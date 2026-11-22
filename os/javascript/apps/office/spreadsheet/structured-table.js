// structured-table.js
// 構造化テーブル（Ctrl+T / Ctrl+L / 作成ダイアログ / 12種テーマ / 集計行 / 範囲に変換 / 自動範囲拡張 / 構造化参照解決）

import { escapeHtml, getColumnName } from "./format-utils.js";
import { parseRangeReference, parseCellReference } from "./formula-ref-overlay.js";

export const TABLE_THEMES = {
    blue: { label: "青 (標準)", headerBg: "#1f4e78", headerFg: "#ffffff", stripeBg: "#d9e1f2", evenBg: "#ffffff", bodyFg: "#000000", border: "1px solid #8ea9db" },
    orange: { label: "オレンジ", headerBg: "#c65911", headerFg: "#ffffff", stripeBg: "#fce4d6", evenBg: "#ffffff", bodyFg: "#000000", border: "1px solid #f4b084" },
    gray: { label: "グレー", headerBg: "#595959", headerFg: "#ffffff", stripeBg: "#ededed", evenBg: "#ffffff", bodyFg: "#000000", border: "1px solid #a6a6a6" },
    gold: { label: "ゴールド", headerBg: "#bf8f00", headerFg: "#ffffff", stripeBg: "#fff2cc", evenBg: "#ffffff", bodyFg: "#000000", border: "1px solid #ffd966" },
    sky: { label: "スカイブルー", headerBg: "#2f75b5", headerFg: "#ffffff", stripeBg: "#ddebf7", evenBg: "#ffffff", bodyFg: "#000000", border: "1px solid #9bc2e6" },
    green: { label: "グリーン", headerBg: "#375623", headerFg: "#ffffff", stripeBg: "#e2efda", evenBg: "#ffffff", bodyFg: "#000000", border: "1px solid #a9d08e" },
    purple: { label: "パープル", headerBg: "#7030a0", headerFg: "#ffffff", stripeBg: "#e9d8f4", evenBg: "#ffffff", bodyFg: "#000000", border: "1px solid #b88ce0" },
    teal: { label: "ティール", headerBg: "#008080", headerFg: "#ffffff", stripeBg: "#d9f2f2", evenBg: "#ffffff", bodyFg: "#000000", border: "1px solid #80cccc" },
    lightBlue: { label: "淡色・青", headerBg: "#d9e1f2", headerFg: "#1f4e78", stripeBg: "#f2f5fb", evenBg: "#ffffff", bodyFg: "#000000", border: "1px solid #b4c6e7" },
    lightGreen: { label: "淡色・緑", headerBg: "#e2efda", headerFg: "#375623", stripeBg: "#f4f9f0", evenBg: "#ffffff", bodyFg: "#000000", border: "1px solid #c6e0b4" },
    darkNavy: { label: "濃色・ネイビー", headerBg: "#0f243e", headerFg: "#ffffff", stripeBg: "#244062", evenBg: "#17375e", bodyFg: "#ffffff", border: "1px solid #4f81bd" },
    darkRed: { label: "濃色・エンジ", headerBg: "#632523", headerFg: "#ffffff", stripeBg: "#963634", evenBg: "#7c2d2b", bodyFg: "#ffffff", border: "1px solid #c0504d" }
};

export function createStructuredTableModule(ctx) {
    const {
        win,
        appRoot,
        statusBarState,
        getSheets,
        getActiveSheetIndex,
        getActiveCell,
        getRowCount,
        getVisibleCell,
        loadRowsSync,
        isCurrentSheetProtected,
        detectDataBlockBounds,
        getSelectedRangeBounds,
        flushPendingEdits,
        setCellFormattedValue,
        evaluateFormula,
        adjustFormula,
        addAutoFilterForRange,
        getAutoFilterByTableId,
        removeAutoFiltersInBounds,
        updateAllFormulas,
        applyConditionalFormats,
        getBackgroundSheetCellMap,
        openAppModal,
        openSheetRangePicker,
        showAlert,
        renderWindowStatusBar,
        setDirtyState,
        debouncedSaveState
    } = ctx;

    function getSheetTables(sheetIdx = getActiveSheetIndex()) {
        const sheets = getSheets();
        if (!sheets[sheetIdx]) return [];
        if (!Array.isArray(sheets[sheetIdx].tables)) sheets[sheetIdx].tables = [];
        return sheets[sheetIdx].tables;
    }

    function findTableAtCoord(row, col, sheetIdx = getActiveSheetIndex()) {
        return getSheetTables(sheetIdx).find(
            t => row >= t.minRow && row <= t.maxRow && col >= t.minCol && col <= t.maxCol
        ) || null;
    }

    function applyStructuredTableVisuals(tbl) {
        const theme = TABLE_THEMES[tbl.themeKey] || TABLE_THEMES.blue;
        const totalRowIdx = tbl.hasTotalRow ? tbl.maxRow : -1;

        for (let r = tbl.minRow; r <= tbl.maxRow; r++) {
            const isHeader = tbl.hasHeader && r === tbl.minRow;
            const isTotal = r === totalRowIdx;
            const dataIdx = tbl.hasHeader ? (r - tbl.minRow - 1) : (r - tbl.minRow);
            const isStripe = !isHeader && !isTotal && tbl.useStripe !== false && (dataIdx % 2 === 1);

            for (let c = tbl.minCol; c <= tbl.maxCol; c++) {
                const cell = getVisibleCell(r, c);
                if (!cell) continue;
                cell.dataset.tableId = tbl.id;
                cell.style.borderTop = isTotal ? "2px solid #000" : theme.border;
                cell.style.borderBottom = isTotal ? "4px double #000" : theme.border;
                cell.style.borderLeft = theme.border;
                cell.style.borderRight = theme.border;

                if (isHeader) {
                    cell.style.backgroundColor = theme.headerBg;
                    cell.style.color = theme.headerFg;
                    cell.style.fontWeight = "bold";
                } else if (isTotal) {
                    cell.style.backgroundColor = "#f2f2f2";
                    cell.style.color = "#000000";
                    cell.style.fontWeight = "bold";
                } else {
                    cell.style.backgroundColor = isStripe ? theme.stripeBg : theme.evenBg;
                    cell.style.color = theme.bodyFg;
                    cell.style.fontWeight = "";
                }
            }
        }
    }

    function generateNextTableName() {
        const tables = getSheetTables();
        let num = tables.length + 1;
        while (tables.some(t => t.name === `テーブル${num}`)) num++;
        return `テーブル${num}`;
    }

    function convertTableToNormalRange(targetTbl = null) {
        if (isCurrentSheetProtected?.()) {
            showAlert("シートが保護されているため、テーブルを解除できません。", "シートの保護");
            return;
        }
        const activeCell = getActiveCell();
        const tbl = targetTbl || (activeCell
            ? findTableAtCoord(parseInt(activeCell.dataset.row, 10), parseInt(activeCell.dataset.col, 10))
            : null);
        if (!tbl) {
            showAlert("解除するテーブル内のセルを選択してください。", "範囲に変換");
            return;
        }

        const tables = getSheetTables();
        const idx = tables.findIndex(t => t.id === tbl.id);
        if (idx !== -1) tables.splice(idx, 1);

        for (let r = tbl.minRow; r <= tbl.maxRow; r++) {
            for (let c = tbl.minCol; c <= tbl.maxCol; c++) {
                const cell = getVisibleCell(r, c);
                if (cell && cell.dataset.tableId === tbl.id) {
                    delete cell.dataset.tableId;
                }
            }
        }

        removeAutoFiltersInBounds?.({
            minRow: tbl.minRow,
            maxRow: tbl.minRow,
            minCol: tbl.minCol,
            maxCol: tbl.maxCol
        });

        updateAllFormulas();
        applyConditionalFormats();
        statusBarState.stateText = `${tbl.name} を通常のセル範囲へ変換しました`;
        renderWindowStatusBar();
        setDirtyState(true);
        debouncedSaveState();
    }

    function convertRangeToStructuredTable(themeKey = "blue", customOpts = null) {
        if (isCurrentSheetProtected?.()) {
            showAlert("シートが保護されているため、テーブルを作成・変更できません。", "シートの保護");
            return;
        }
        flushPendingEdits();
        const bounds = customOpts?.bounds || detectDataBlockBounds(getActiveCell()) || getSelectedRangeBounds();
        if (!bounds) {
            showAlert("テーブルに変換するセル範囲を選択してください。", "テーブルの作成");
            return;
        }

        const useHeader = customOpts?.hasHeader ?? (appRoot.querySelector(".ss-tbl-opt-header")?.checked ?? true);
        const useStripe = customOpts?.useStripe ?? (appRoot.querySelector(".ss-tbl-opt-stripe")?.checked ?? true);

        // 既存テーブルと重複する場合はテーマ・名前・オプションを更新
        const existing = findTableAtCoord(bounds.minRow, bounds.minCol);
        if (existing) {
            if (customOpts?.name && customOpts.name.trim()) {
                existing.name = customOpts.name.trim();
            }
            existing.themeKey = themeKey;
            existing.useStripe = useStripe;
            applyStructuredTableVisuals(existing);
            statusBarState.stateText = `${existing.name} のスタイルを更新しました`;
            renderWindowStatusBar();
            setDirtyState(true);
            debouncedSaveState();
            return;
        }

        const tables = getSheetTables();
        const requestedName = customOpts?.name?.trim();
        const tableName = (requestedName && !tables.some(t => t.name === requestedName))
            ? requestedName
            : generateNextTableName();

        const minRow = bounds.minRow;
        const maxRow = Math.max(bounds.maxRow, useHeader ? minRow + 1 : minRow);
        const minCol = bounds.minCol;
        const maxCol = bounds.maxCol;

        // 見出し行が空の列にはデフォルト列名「列1」「列2」...を補完
        if (useHeader) {
            for (let c = minCol; c <= maxCol; c++) {
                const hCell = getVisibleCell(minRow, c);
                if (hCell && (hCell.textContent ?? "").trim() === "") {
                    setCellFormattedValue(hCell, `列${c - minCol + 1}`);
                }
            }
        }

        const tbl = {
            id: `tbl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: tableName,
            minRow,
            maxRow,
            minCol,
            maxCol,
            hasHeader: useHeader,
            hasTotalRow: false,
            useStripe,
            themeKey
        };
        tables.push(tbl);
        applyStructuredTableVisuals(tbl);

        // 各テーブルごとに独立したオートフィルターを自動付与
        if (useHeader) {
            addAutoFilterForRange({
                headerRow: minRow,
                minCol,
                maxCol,
                maxRow,
                tableId: tbl.id
            });
        }

        statusBarState.stateText = `${tableName} を作成しました（構造化参照: ${tableName}[列名] 対応）`;
        renderWindowStatusBar();
        setDirtyState(true);
        debouncedSaveState();
    }

    function openCreateTableDialog(defaultTheme = "blue") {
        if (isCurrentSheetProtected?.()) {
            showAlert("シートが保護されているため、テーブルを作成できません。", "シートの保護");
            return;
        }
        flushPendingEdits();
        const bounds = detectDataBlockBounds(getActiveCell()) || getSelectedRangeBounds();
        if (!bounds) {
            showAlert("テーブルに変換するセル範囲を選択してください。", "テーブルの作成");
            return;
        }

        const existing = findTableAtCoord(bounds.minRow, bounds.minCol);
        const initBounds = existing
            ? { minRow: existing.minRow, maxRow: existing.maxRow, minCol: existing.minCol, maxCol: existing.maxCol }
            : bounds;
        const initRangeStr = `=$${getColumnName(initBounds.minCol)}$${initBounds.minRow}:$${getColumnName(initBounds.maxCol)}$${initBounds.maxRow}`;
        const initName = existing ? existing.name : generateNextTableName();
        const initTheme = existing ? existing.themeKey : defaultTheme;
        const initHeader = existing ? existing.hasHeader : (appRoot.querySelector(".ss-tbl-opt-header")?.checked ?? true);
        const initStripe = existing ? existing.useStripe !== false : (appRoot.querySelector(".ss-tbl-opt-stripe")?.checked ?? true);

        const themeOptions = Object.entries(TABLE_THEMES)
            .map(([k, v]) => `<option value="${k}" ${k === initTheme ? "selected" : ""}>${escapeHtml(v.label || k)}</option>`)
            .join("");

        const bodyHtml = `
            <div style="width:100%; display:flex; flex-direction:column; gap:8px; font-size:12px;">
                <div>テーブルに変換するデータの範囲を指定してください:</div>
                <div style="display:flex; gap:4px; align-items:center;">
                    <input type="text" class="ss-ct-range border" value="${escapeHtml(initRangeStr)}" ${existing ? "readonly" : ""} style="flex:1; min-width:0; height:24px; padding:2px 6px; background:${existing ? "#eee" : "#fff"}; color:#000;">
                    ${existing ? "" : `<button type="button" class="button ss-ct-pick" title="シート上から範囲を選択" style="height:24px; padding:0 7px;">📍選択</button>`}
                </div>
                <div style="display:flex; align-items:center; gap:6px;">
                    <label style="width:86px; flex-shrink:0;">テーブル名:</label>
                    <input type="text" class="ss-ct-name border" value="${escapeHtml(initName)}" style="flex:1; height:24px; padding:2px 6px; background:#fff; color:#000;">
                </div>
                <div style="display:flex; align-items:center; gap:6px;">
                    <label style="width:86px; flex-shrink:0;">デザイン:</label>
                    <select class="ss-ct-theme border" style="flex:1; height:24px; background:#fff; color:#000;">
                        ${themeOptions}
                    </select>
                </div>
                <label style="display:inline-flex; align-items:center; gap:5px; cursor:pointer;">
                    <input type="checkbox" class="ss-ct-header" ${initHeader ? "checked" : ""} ${existing ? "disabled" : ""}> 先頭行をテーブルの見出しとして使用する(M)
                </label>
                <label style="display:inline-flex; align-items:center; gap:5px; cursor:pointer;">
                    <input type="checkbox" class="ss-ct-stripe" ${initStripe ? "checked" : ""}> 縞模様（行）を適用する
                </label>
            </div>
        `;

        const buttons = [
            {
                label: existing ? "更新" : "OK",
                onClick: () => {
                    const rawRange = (modalContent.querySelector(".ss-ct-range")?.value || "")
                        .replace(/^=/, "")
                        .replace(/^.*!/, "")
                        .trim()
                        .toUpperCase();
                    let finalBounds = initBounds;
                    if (!existing && rawRange) {
                        if (rawRange.includes(":")) {
                            const parsed = parseRangeReference(rawRange);
                            if (parsed) {
                                finalBounds = {
                                    minRow: Math.min(parsed.start.row, parsed.end.row),
                                    maxRow: Math.max(parsed.start.row, parsed.end.row),
                                    minCol: Math.min(parsed.start.col, parsed.end.col),
                                    maxCol: Math.max(parsed.start.col, parsed.end.col)
                                };
                            }
                        } else {
                            const single = parseCellReference(rawRange);
                            if (single) {
                                finalBounds = { minRow: single.row, maxRow: single.row, minCol: single.col, maxCol: single.col };
                            }
                        }
                    }
                    const nextName = modalContent.querySelector(".ss-ct-name")?.value.trim() || initName;
                    const nextTheme = modalContent.querySelector(".ss-ct-theme")?.value || defaultTheme;
                    const nextHeader = Boolean(modalContent.querySelector(".ss-ct-header")?.checked);
                    const nextStripe = Boolean(modalContent.querySelector(".ss-ct-stripe")?.checked);
                    convertRangeToStructuredTable(nextTheme, {
                        bounds: finalBounds,
                        hasHeader: nextHeader,
                        useStripe: nextStripe,
                        name: nextName
                    });
                }
            }
        ];

        if (existing) {
            buttons.push({
                label: "範囲に変換(解除)",
                onClick: () => convertTableToNormalRange(existing)
            });
        }
        buttons.push({ label: "キャンセル" });

        const modalContent = openAppModal(existing ? "テーブルの設定" : "テーブルの作成", bodyHtml, {
            width: 400,
            isHtml: true,
            parentWin: win,
            buttons
        });

        const rangeInput = modalContent?.querySelector(".ss-ct-range");
        modalContent?.querySelector(".ss-ct-pick")?.addEventListener("click", () => {
            openSheetRangePicker({
                modalContent,
                targetInput: rangeInput,
                label: "テーブルの範囲を選択:",
                allowCrossSheet: false
            });
        });

        if (rangeInput && !existing) {
            rangeInput.focus();
            rangeInput.select();
        }
    }

    function toggleStructuredTableTotalRow() {
        const activeCell = getActiveCell();
        if (!activeCell) return;
        const r = parseInt(activeCell.dataset.row, 10);
        const c = parseInt(activeCell.dataset.col, 10);
        const tbl = findTableAtCoord(r, c);
        if (!tbl) {
            showAlert("テーブル内のセルを選択してから「集計行」を実行してください。", "テーブルツール");
            return;
        }

        if (tbl.hasTotalRow) {
            // 集計行を解除して最下行をクリア
            const oldTotalR = tbl.maxRow;
            for (let col = tbl.minCol; col <= tbl.maxCol; col++) {
                const cell = getVisibleCell(oldTotalR, col);
                if (!cell) continue;
                cell.textContent = "";
                cell.removeAttribute("style");
                delete cell.dataset.formula;
                delete cell.dataset.rawValue;
                delete cell.dataset.dropdownList;
                delete cell.dataset.tableId;
            }
            tbl.maxRow -= 1;
            tbl.hasTotalRow = false;
            const tblFilter = getAutoFilterByTableId(tbl.id);
            if (tblFilter) tblFilter.maxRow = tbl.maxRow;
            applyStructuredTableVisuals(tbl);
        } else {
            // 集計行を1行下に追加
            const newTotalR = tbl.maxRow + 1;
            if (newTotalR >= getRowCount()) loadRowsSync(5);
            tbl.maxRow = newTotalR;
            tbl.hasTotalRow = true;

            const dataStartR = tbl.hasHeader ? tbl.minRow + 1 : tbl.minRow;
            const dataEndR = newTotalR - 1;

            for (let col = tbl.minCol; col <= tbl.maxCol; col++) {
                const cell = getVisibleCell(newTotalR, col);
                if (!cell) continue;
                const colLetter = getColumnName(col);
                if (col === tbl.minCol) {
                    setCellFormattedValue(cell, "集計");
                } else {
                    // 集計関数選択ドロップダウンを付与し、右端列は自動合計
                    cell.dataset.dropdownList = `=SUBTOTAL(109,${colLetter}${dataStartR}:${colLetter}${dataEndR}),=SUBTOTAL(101,${colLetter}${dataStartR}:${colLetter}${dataEndR}),=SUBTOTAL(103,${colLetter}${dataStartR}:${colLetter}${dataEndR}),=SUBTOTAL(104,${colLetter}${dataStartR}:${colLetter}${dataEndR}),=SUBTOTAL(105,${colLetter}${dataStartR}:${colLetter}${dataEndR})`;
                    if (col === tbl.maxCol) {
                        const f = `=SUBTOTAL(109,${colLetter}${dataStartR}:${colLetter}${dataEndR})`;
                        cell.dataset.formula = f;
                        setCellFormattedValue(cell, evaluateFormula(f));
                    }
                }
            }
            const tblFilter = getAutoFilterByTableId(tbl.id);
            if (tblFilter) tblFilter.maxRow = dataEndR;
            applyStructuredTableVisuals(tbl);
        }

        updateAllFormulas();
        applyConditionalFormats();
        setDirtyState(true);
        debouncedSaveState();
    }

    // テーブル末尾直下への入力時にテーブル範囲・スタイル・数式を自動拡張（Excel準拠：集計行あり時は集計行を保護し自動拡張しない）
    function tryAutoExpandStructuredTable(row, col) {
        const tables = getSheetTables();
        for (const tbl of tables) {
            if (tbl.hasTotalRow) continue;
            if (col < tbl.minCol || col > tbl.maxCol) continue;
            if (row !== tbl.maxRow + 1) continue;

            tbl.maxRow = row;

            // 1行上の数式列・表示形式を自動継承
            const prevDataRow = row - 1;
            if (prevDataRow >= (tbl.hasHeader ? tbl.minRow + 1 : tbl.minRow)) {
                for (let c = tbl.minCol; c <= tbl.maxCol; c++) {
                    const prevCell = getVisibleCell(prevDataRow, c);
                    const curCell = getVisibleCell(row, c);
                    if (!prevCell || !curCell) continue;
                    if (prevCell.dataset.numFormat && !curCell.dataset.numFormat) {
                        curCell.dataset.numFormat = prevCell.dataset.numFormat;
                        if (prevCell.dataset.decimalPlaces !== undefined && prevCell.dataset.decimalPlaces !== "") {
                            curCell.dataset.decimalPlaces = prevCell.dataset.decimalPlaces;
                        }
                    }
                    if (c !== col && prevCell.dataset.formula && !curCell.dataset.formula) {
                        const inheritedF = adjustFormula(prevCell.dataset.formula, 1, 0);
                        curCell.dataset.formula = inheritedF;
                        setCellFormattedValue(curCell, evaluateFormula(inheritedF));
                    }
                }
            }

            const tblFilter = getAutoFilterByTableId(tbl.id);
            if (tblFilter) {
                tblFilter.maxRow = tbl.maxRow;
            }
            applyStructuredTableVisuals(tbl);
            break;
        }
    }

    // 構造化参照（テーブル1[売上] / テーブル1[[#すべて],[売上]] 等）を通常のセル範囲へ解決
    function resolveStructuredReferences(formulaExpr, sheetIdx = getActiveSheetIndex()) {
        if (!formulaExpr || !formulaExpr.includes("[")) return formulaExpr;
        const sheets = getSheets();
        const activeIdx = getActiveSheetIndex();

        const formatWithSheet = (sIdx, rangeStr) => {
            if (sIdx === sheetIdx) return rangeStr;
            const sName = sheets[sIdx].name;
            const prefix = /[^A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]/.test(sName)
                ? `'${sName.replace(/'/g, "''")}'!`
                : `${sName}!`;
            return `${prefix}${rangeStr}`;
        };

        const resolveTableColRange = (tblName, sectionSpec, colName) => {
            const cleanCol = String(colName || "").trim();
            const sec = String(sectionSpec || "#データ").trim().toLowerCase();
            for (let sIdx = 0; sIdx < sheets.length; sIdx++) {
                const tbl = getSheetTables(sIdx).find(t => t.name === tblName);
                if (!tbl) continue;

                const dataStartR = tbl.hasHeader ? tbl.minRow + 1 : tbl.minRow;
                const dataEndR = tbl.hasTotalRow ? tbl.maxRow - 1 : tbl.maxRow;
                let rStart = dataStartR;
                let rEnd = dataEndR;

                if (sec === "#all" || sec === "#すべて") {
                    rStart = tbl.minRow;
                    rEnd = tbl.maxRow;
                } else if (sec === "#headers" || sec === "#見出し") {
                    if (!tbl.hasHeader) return "#REF!";
                    rStart = tbl.minRow;
                    rEnd = tbl.minRow;
                } else if (sec === "#totals" || sec === "#集計") {
                    if (!tbl.hasTotalRow) return "#REF!";
                    rStart = tbl.maxRow;
                    rEnd = tbl.maxRow;
                } else if (rEnd < rStart) {
                    return "#REF!";
                }

                if (!cleanCol) {
                    return formatWithSheet(sIdx, `${getColumnName(tbl.minCol)}${rStart}:${getColumnName(tbl.maxCol)}${rEnd}`);
                }
                if (!tbl.hasHeader) return "#REF!";

                let matchedCol = -1;
                for (let c = tbl.minCol; c <= tbl.maxCol; c++) {
                    const headerText = sIdx === activeIdx
                        ? (getVisibleCell(tbl.minRow, c)?.textContent ?? "").trim()
                        : String(getBackgroundSheetCellMap(sheets[sIdx]).get(`${tbl.minRow},${c}`)?.v ?? "").trim();
                    if (headerText === cleanCol) {
                        matchedCol = c;
                        break;
                    }
                }
                if (matchedCol === -1) return "#REF!";
                const colLetter = getColumnName(matchedCol);
                return formatWithSheet(sIdx, `${colLetter}${rStart}:${colLetter}${rEnd}`);
            }
            return null;
        };

        // 1. 修飾子付き形式: テーブル1[[#すべて],[売上]]
        let out = formulaExpr.replace(
            /([A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+)\[\[(#[^\[\]]+)\]\s*,\s*\[([^\[\]]+)\]\]/g,
            (match, tblName, secSpec, colName) => resolveTableColRange(tblName, secSpec, colName) ?? match
        );

        // 2. 単独形式: テーブル1[売上] または テーブル1[#データ]
        out = out.replace(
            /([A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+)\[([^\[\]]+)\]/g,
            (match, tblName, inner) => {
                const trimmed = inner.trim();
                if (trimmed.startsWith("#")) {
                    return resolveTableColRange(tblName, trimmed, "") ?? match;
                }
                return resolveTableColRange(tblName, "#データ", trimmed) ?? match;
            }
        );
        return out;
    }

    return {
        getSheetTables,
        findTableAtCoord,
        applyStructuredTableVisuals,
        convertRangeToStructuredTable,
        openCreateTableDialog,
        convertTableToNormalRange,
        toggleStructuredTableTotalRow,
        tryAutoExpandStructuredTable,
        resolveStructuredReferences
    };
}