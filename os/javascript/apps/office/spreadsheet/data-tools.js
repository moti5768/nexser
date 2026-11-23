// data-tools.js
// データブロック検出・重複の削除・区切り位置ウィザード・ピボットテーブルクロス集計

import {
    getColumnName,
    getCellReferenceByCoord,
    parseFormattedNumber
} from "./format-utils.js";
import { clearAppliedConditionalStyle } from "./conditional-format.js";

export function splitTextWithDelimiters(text, delimiters, { treatConsecutiveAsOne = false, respectQuotes = true } = {}) {
    const src = String(text ?? "");
    if (!delimiters.length || src === "") return [src];

    const delimSet = new Set(delimiters);
    const result = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < src.length; i++) {
        const ch = src[i];
        if (respectQuotes && ch === '"') {
            if (inQuotes && src[i + 1] === '"') {
                cur += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }
        if (!inQuotes && delimSet.has(ch)) {
            result.push(cur);
            cur = "";
            if (treatConsecutiveAsOne) {
                while (i + 1 < src.length && delimSet.has(src[i + 1])) {
                    i++;
                }
            }
            continue;
        }
        cur += ch;
    }
    result.push(cur);
    return result;
}

export function createDataToolsModule(ctx) {
    const {
        tbody,
        win,
        windowAPI,
        statusBarState,
        activeSheetObservers,
        getActiveCell,
        getRowCount,
        getCurrentColumns,
        getSheets,
        getActiveSheetIndex,
        isCurrentSheetProtected,
        getCell,
        getVisibleCell,
        getRow,
        getSelectedRangeBounds,
        loadRowsSync,
        loadColumnsSync,
        addNewSheet,
        renderSheetTabs,
        extractCellStyleObject,
        applyCellStyleData,
        syncCellAnnotationMark,
        applyShrinkToFit,
        clearSpillCellsFromAnchor,
        adjustFormula,
        evaluateFormula,
        setCellFormattedValue,
        autoFitColumn,
        updateAllFormulas,
        applyConditionalFormats,
        syncCellGridlinesForBounds,
        hasAutoFilters,
        applyAutoFilterRows,
        clearSelection,
        setActiveCell,
        updateFillHandle,
        updateSelectedCellsDisplay,
        flushPendingEdits,
        openAppModal,
        showAlert,
        setDirtyState,
        debouncedSaveState,
        renderWindowStatusBar
    } = ctx;

    // =========================================================
    // 重複の削除（Remove Duplicates）
    // =========================================================
    function detectDataBlockBounds(baseCell) {
        const selected = Array.from(tbody.querySelectorAll("td.selected")).filter(td => td.style.display !== "none");
        const isFilled = (r, c) => {
            const cell = getCell(r, c);
            return Boolean(cell && (cell.dataset.formula || (cell.dataset.rawValue ?? cell.textContent).trim() !== ""));
        };

        if (selected.length > 1) {
            return getSelectedRangeBounds();
        }
        if (!baseCell) return null;

        const startR = parseInt(baseCell.dataset.row, 10);
        const startC = parseInt(baseCell.dataset.col, 10);
        if (!isFilled(startR, startC)) return null;

        const curRowCount = getRowCount();
        const curCols = getCurrentColumns();
        let minRow = startR, maxRow = startR, minCol = startC, maxCol = startC;
        while (minRow > 1 && isFilled(minRow - 1, startC)) minRow--;
        while (maxRow < curRowCount - 1 && isFilled(maxRow + 1, startC)) maxRow++;
        while (minCol > 0 && isFilled(startR, minCol - 1)) minCol--;
        while (maxCol < curCols - 1 && isFilled(startR, maxCol + 1)) maxCol++;

        let expanded = true;
        while (expanded) {
            expanded = false;
            for (let r = minRow; r <= maxRow; r++) {
                if (minCol > 0 && isFilled(r, minCol - 1)) { minCol--; expanded = true; }
                if (maxCol < curCols - 1 && isFilled(r, maxCol + 1)) { maxCol++; expanded = true; }
            }
        }
        return { minRow, maxRow, minCol, maxCol };
    }

    function openRemoveDuplicatesDialog() {
        if (isCurrentSheetProtected?.()) {
            showAlert("シートが保護されているため、重複の削除は実行できません。", "シートの保護");
            return;
        }
        flushPendingEdits();
        const bounds = detectDataBlockBounds(getActiveCell());
        if (!bounds || bounds.maxRow <= bounds.minRow) {
            showAlert("重複を削除する2行以上のデータ範囲を選択してください。", "重複の削除");
            return;
        }

        // 結合セルチェック
        for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
            for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
                const cell = getCell(r, c);
                if (cell && (cell.style.display === "none" || cell.classList.contains("merged") || cell.dataset.mergeMinRow || cell.dataset.mergeAnchorRow)) {
                    showAlert("結合されたセルを含む範囲では重複の削除を実行できません。", "重複の削除");
                    return;
                }
            }
        }

        const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        const cols = [];
        for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
            const headerText = (getCell(bounds.minRow, c)?.textContent ?? "").trim();
            cols.push({
                col: c,
                colName: getColumnName(c),
                headerLabel: headerText || `(列 ${getColumnName(c)})`
            });
        }

        const bodyHtml = `
            <div style="width:100%; display:flex; flex-direction:column; gap:8px; font-size:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; gap:6px;">
                        <button type="button" class="ss-rd-select-all" style="padding:2px 8px; font-size:11px;">すべて選択</button>
                        <button type="button" class="ss-rd-unselect-all" style="padding:2px 8px; font-size:11px;">すべて解除</button>
                    </div>
                    <label style="display:inline-flex; align-items:center; gap:4px; cursor:pointer;">
                        <input type="checkbox" class="ss-rd-has-header" checked> 先頭行をデータの見出しとして使用する
                    </label>
                </div>
                <div style="font-size:11px; color:#333;">重複の判定基準にする列を選択してください:</div>
                <div class="ss-rd-cols-list border" style="max-height:190px; overflow-y:auto; background:#fff; padding:6px; display:flex; flex-direction:column; gap:4px;">
                    ${cols.map(item => `
                        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                            <input type="checkbox" class="ss-rd-col-chk" value="${item.col}" checked>
                            <span class="ss-rd-col-label" data-header="${esc(item.headerLabel)}" data-colname="列 ${item.colName}">${esc(item.headerLabel)}</span>
                        </label>
                    `).join("")}
                </div>
            </div>
        `;

        const modalContent = openAppModal("重複の削除", bodyHtml, {
            width: 420,
            isHtml: true,
            parentWin: win,
            buttons: [
                {
                    label: "OK",
                    onClick: () => {
                        const hasHeader = Boolean(modalContent.querySelector(".ss-rd-has-header")?.checked);
                        const selectedCols = Array.from(modalContent.querySelectorAll(".ss-rd-col-chk:checked")).map(el => Number(el.value));
                        if (selectedCols.length === 0) {
                            showAlert("判定基準にする列を1つ以上選択してください。", "重複の削除");
                            return;
                        }
                        executeRemoveDuplicates(bounds, selectedCols, hasHeader);
                    }
                },
                { label: "キャンセル" }
            ]
        });

        const headerChk = modalContent?.querySelector(".ss-rd-has-header");
        headerChk?.addEventListener("change", () => {
            const useHeader = headerChk.checked;
            modalContent.querySelectorAll(".ss-rd-col-label").forEach(span => {
                span.textContent = useHeader ? span.dataset.header : span.dataset.colname;
            });
        });

        modalContent?.querySelector(".ss-rd-select-all")?.addEventListener("click", () => {
            modalContent.querySelectorAll(".ss-rd-col-chk").forEach(c => { c.checked = true; });
        });
        modalContent?.querySelector(".ss-rd-unselect-all")?.addEventListener("click", () => {
            modalContent.querySelectorAll(".ss-rd-col-chk").forEach(c => { c.checked = false; });
        });
    }

    function executeRemoveDuplicates(bounds, keyCols, hasHeader) {
        const startDataRow = hasHeader ? bounds.minRow + 1 : bounds.minRow;
        if (startDataRow > bounds.maxRow) return;

        const seenKeys = new Set();
        const uniqueRows = [];
        let removedCount = 0;

        for (let r = startDataRow; r <= bounds.maxRow; r++) {
            const keyParts = keyCols.map(c => {
                const cell = getCell(r, c);
                const val = (cell?.textContent ?? "").trim();
                return val;
            });
            const compositeKey = JSON.stringify(keyParts);

            if (seenKeys.has(compositeKey)) {
                removedCount++;
                continue;
            }
            seenKeys.add(compositeKey);

            const rowCells = [];
            for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
                const cell = getCell(r, c);
                rowCells.push({
                    value: cell?.dataset.rawValue ?? cell?.textContent ?? "",
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
            uniqueRows.push({ origRow: r, cells: rowCells });
        }

        if (removedCount === 0) {
            showAlert("重複する値は見つかりませんでした。", "重複の削除");
            return;
        }

        // 一意な行を上詰め再配置
        uniqueRows.forEach((rowItem, idx) => {
            const destRow = startDataRow + idx;
            const rowDelta = destRow - rowItem.origRow;
            rowItem.cells.forEach((item, cIdx) => {
                const dest = getCell(destRow, bounds.minCol + cIdx);
                if (!dest) return;

                if (item.quotePrefix === "1") dest.dataset.quotePrefix = "1";
                else delete dest.dataset.quotePrefix;
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
                if (item.note) dest.dataset.note = item.note;
                else delete dest.dataset.note;
                if (item.comment) dest.dataset.comment = item.comment;
                else delete dest.dataset.comment;
                if (item.indent) dest.dataset.indent = item.indent;
                else delete dest.dataset.indent;
                if (item.shrinkToFit === "1") dest.dataset.shrinkToFit = "1";
                else delete dest.dataset.shrinkToFit;
                if (item.textRotation) dest.dataset.textRotation = item.textRotation;
                else delete dest.dataset.textRotation;
                if (item.locked === "0") dest.dataset.locked = "0";
                else delete dest.dataset.locked;
                if (item.formulaHidden === "1") dest.dataset.formulaHidden = "1";
                else delete dest.dataset.formulaHidden;
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
                    dest.dataset.formula = adjustFormula(item.formula, rowDelta, 0);
                } else {
                    delete dest.dataset.formula;
                    setCellFormattedValue(dest, item.value);
                }
                applyCellStyleData(dest, item.styleObj);
                syncCellAnnotationMark?.(dest);
                if (item.shrinkToFit === "1") applyShrinkToFit?.(dest);
            });
        });

        // 削除されて余った下端行をクリア
        for (let r = startDataRow + uniqueRows.length; r <= bounds.maxRow; r++) {
            for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
                const cell = getCell(r, c);
                if (!cell) continue;
                clearSpillCellsFromAnchor?.(r, c);
                clearAppliedConditionalStyle(cell);
                cell.textContent = "";
                cell.removeAttribute("style");
                cell.removeAttribute("title");
                cell.classList.remove("ss-hyperlink", "ss-auto-align-right", "ss-auto-align-center", "ss-text-overflow", "ss-has-content");
                Object.keys(cell.dataset).forEach(k => {
                    if (k !== "row" && k !== "col") delete cell.dataset[k];
                });
            }
        }

        syncCellGridlinesForBounds?.(bounds);
        updateAllFormulas();
        if (hasAutoFilters()) applyAutoFilterRows();
        updateFillHandle();
        updateSelectedCellsDisplay();
        setDirtyState(true);
        debouncedSaveState();

        showAlert(
            `${removedCount} 件の重複する値が見つかり、削除されました。\n${uniqueRows.length} 件の一意の値が残っています。`,
            "重複の削除"
        );
    }

    // =========================================================
    // 区切り位置（Text to Columns）
    // =========================================================
    function openTextToColumnsDialog() {
        if (isCurrentSheetProtected?.()) {
            showAlert("シートが保護されているため、区切り位置は実行できません。", "シートの保護");
            return;
        }
        flushPendingEdits();
        const bounds = getSelectedRangeBounds();
        if (!bounds) return;

        if (bounds.minCol !== bounds.maxCol) {
            showAlert("選択できるのは1列のみです。分割したい1列分のセルを選択してください。", "区切り位置");
            return;
        }

        const targetCol = bounds.minCol;
        const sampleTexts = [];
        for (let r = bounds.minRow; r <= Math.min(bounds.maxRow, bounds.minRow + 5); r++) {
            const val = (getCell(r, targetCol)?.textContent ?? "");
            if (val !== "") sampleTexts.push(val);
        }
        if (sampleTexts.length === 0) {
            showAlert("選択範囲に分割対象のデータがありません。", "区切り位置");
            return;
        }

        const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        const bodyHtml = `
            <div style="width:100%; display:flex; flex-direction:column; gap:8px; font-size:12px;">
                <div style="font-weight:bold;">区切り文字を選択してください:</div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px 12px; padding:4px; background:#f8f8f8; border:1px solid #bbb;">
                    <label style="display:flex; align-items:center; gap:5px; cursor:pointer;"><input type="checkbox" class="ss-ttc-delim" value="," checked> カンマ (,)</label>
                    <label style="display:flex; align-items:center; gap:5px; cursor:pointer;"><input type="checkbox" class="ss-ttc-delim" value="\t"> タブ (Tab)</label>
                    <label style="display:flex; align-items:center; gap:5px; cursor:pointer;"><input type="checkbox" class="ss-ttc-delim" value=";"> セミコロン (;)</label>
                    <label style="display:flex; align-items:center; gap:5px; cursor:pointer;"><input type="checkbox" class="ss-ttc-delim" value=" "> スペース (空白)</label>
                    <label style="display:flex; align-items:center; gap:5px; cursor:pointer; grid-column:1 / -1;">
                        <input type="checkbox" class="ss-ttc-other-chk"> その他:
                        <input type="text" class="ss-ttc-other-val border" maxlength="1" style="width:32px; height:20px; text-align:center; background:#fff; color:#000;">
                    </label>
                </div>
                <div style="display:flex; flex-direction:column; gap:3px;">
                    <label style="display:flex; align-items:center; gap:5px; cursor:pointer;">
                        <input type="checkbox" class="ss-ttc-consecutive"> 連続した区切り文字は1つとして扱う
                    </label>
                    <label style="display:flex; align-items:center; gap:5px; cursor:pointer;">
                        <input type="checkbox" class="ss-ttc-quotes" checked> 文字列の引用符 (") を考慮する
                    </label>
                </div>
                <div style="font-size:11px; color:#333;">データのプレビュー (先頭サンプル):</div>
                <div class="ss-ttc-preview border" style="max-height:130px; overflow:auto; background:#fff; padding:4px;"></div>
            </div>
        `;

        const modalContent = openAppModal("区切り位置指定ウィザード", bodyHtml, {
            width: 440,
            isHtml: true,
            parentWin: win,
            buttons: [
                {
                    label: "完了",
                    onClick: () => {
                        const opts = readOptions();
                        if (opts.delimiters.length === 0) {
                            showAlert("区切り文字を1つ以上指定してください。", "区切り位置");
                            return;
                        }
                        executeTextToColumns(bounds, opts);
                    }
                },
                { label: "キャンセル" }
            ]
        });

        const readOptions = () => {
            const delims = Array.from(modalContent.querySelectorAll(".ss-ttc-delim:checked")).map(el => el.value);
            if (modalContent.querySelector(".ss-ttc-other-chk")?.checked) {
                const otherCh = modalContent.querySelector(".ss-ttc-other-val")?.value || "";
                if (otherCh) delims.push(otherCh);
            }
            return {
                delimiters: delims,
                treatConsecutiveAsOne: Boolean(modalContent.querySelector(".ss-ttc-consecutive")?.checked),
                respectQuotes: Boolean(modalContent.querySelector(".ss-ttc-quotes")?.checked)
            };
        };

        const renderPreview = () => {
            const previewEl = modalContent?.querySelector(".ss-ttc-preview");
            if (!previewEl) return;
            const opts = readOptions();
            const splitRows = sampleTexts.map(t => splitTextWithDelimiters(t, opts.delimiters, opts));
            const maxCols = Math.max(1, ...splitRows.map(r => r.length));
            previewEl.innerHTML = `
                <table style="border-collapse:collapse; width:100%; font-size:11px;">
                    <tbody>
                        ${splitRows.map(cols => `
                            <tr>
                                ${Array.from({ length: maxCols }, (_, i) => `
                                    <td style="border:1px solid #ccc; padding:2px 6px; white-space:nowrap;">${esc(cols[i] ?? "")}</td>
                                `).join("")}
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            `;
        };

        modalContent?.querySelectorAll("input").forEach(inp => {
            inp.addEventListener("change", renderPreview);
            inp.addEventListener("input", renderPreview);
        });
        renderPreview();
    }

    function executeTextToColumns(bounds, opts) {
        const targetCol = bounds.minCol;
        const rowsSplit = [];
        let maxSplitCols = 1;

        for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
            const cell = getCell(r, targetCol);
            const raw = (cell?.textContent ?? "");
            const parts = splitTextWithDelimiters(raw, opts.delimiters, opts);
            maxSplitCols = Math.max(maxSplitCols, parts.length);
            rowsSplit.push({ r, parts });
        }

        if (maxSplitCols <= 1) return;

        // 必要列数を自動確保
        const neededEndCol = targetCol + maxSplitCols - 1;
        const curCols = getCurrentColumns();
        if (neededEndCol >= curCols) {
            loadColumnsSync(neededEndCol - curCols + 2);
        }

        // 右隣列に既存データがある場合は上書き確認
        let hasExistingRightData = false;
        for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
            for (let c = targetCol + 1; c <= neededEndCol; c++) {
                const td = getCell(r, c);
                if (td && (td.dataset.formula || (td.dataset.rawValue ?? td.textContent).trim() !== "")) {
                    hasExistingRightData = true;
                    break;
                }
            }
            if (hasExistingRightData) break;
        }

        const applySplit = () => {
            rowsSplit.forEach(({ r, parts }) => {
                for (let i = 0; i < maxSplitCols; i++) {
                    const dest = getCell(r, targetCol + i);
                    if (!dest) continue;
                    delete dest.dataset.formula;
                    delete dest.dataset.numFormat;
                    delete dest.dataset.decimalPlaces;
                    delete dest.dataset.dropdownList;
                    delete dest.dataset.dvRule;
                    delete dest.dataset.valueType;
                    delete dest.dataset.dateValue;
                    delete dest.dataset.richRuns;
                    delete dest.dataset.hyperlink;
                    dest.classList.remove("ss-hyperlink");
                    dest.removeAttribute("title");
                    setCellFormattedValue(dest, parts[i] ?? "");
                }
            });
            updateAllFormulas();
            applyConditionalFormats();
            updateFillHandle();
            updateSelectedCellsDisplay();
            setDirtyState(true);
            debouncedSaveState();
        };

        if (hasExistingRightData && windowAPI?.confirmWindow) {
            windowAPI.confirmWindow(
                "展開先の右側のセルに既にデータが存在します。\nデータを置き換えますか？",
                (ok) => { if (ok) applySplit(); },
                { title: "区切り位置", parentWin: win }
            );
        } else {
            applySplit();
        }
    }

    // =========================================================
    // ピボットテーブル（Pivot Table）クロス集計エンジン
    // =========================================================
    function openPivotTableDialog() {
        flushPendingEdits();
        const bounds = detectDataBlockBounds(getActiveCell());
        if (!bounds || bounds.maxRow <= bounds.minRow) {
            showAlert("ピボットテーブルを作成する元データ範囲（見出し行＋1行以上のデータ）を選択してください。", "ピボットテーブルの作成");
            return;
        }

        const fields = [];
        for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
            const label = (getCell(bounds.minRow, c)?.textContent ?? "").trim() || `列${getColumnName(c)}`;
            fields.push({ col: c, label });
        }

        const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        const sheets = getSheets();
        const activeIdx = getActiveSheetIndex();
        const rangeText = `'${sheets[activeIdx].name}'!${getCellReferenceByCoord(bounds.minRow, bounds.minCol)}:${getCellReferenceByCoord(bounds.maxRow, bounds.maxCol)}`;
        const fieldOptions = fields.map(f => `<option value="${f.col}">${esc(f.label)}</option>`).join("");

        const bodyHtml = `
            <div style="width:100%; display:flex; flex-direction:column; gap:8px; font-size:12px;">
                <div style="background:#f4f6f9; border:1px solid #bbb; padding:5px 8px;">
                    <strong>テーブル/範囲:</strong> ${esc(rangeText)}
                </div>
                <div style="display:grid; grid-template-columns:110px 1fr; gap:6px 8px; align-items:center;">
                    <label style="font-weight:bold;">フィルター (任意):</label>
                    <select class="ss-pv-filter border" style="height:24px; background:#fff; color:#000;">
                        <option value="-1">(なし)</option>
                        ${fieldOptions}
                    </select>

                    <label style="font-weight:bold;">行 (Rows):</label>
                    <select class="ss-pv-row border" style="height:24px; background:#fff; color:#000;">
                        ${fieldOptions}
                    </select>

                    <label style="font-weight:bold;">列 (Columns):</label>
                    <select class="ss-pv-col border" style="height:24px; background:#fff; color:#000;">
                        <option value="-1">(なし - 1次元集計)</option>
                        ${fieldOptions}
                    </select>

                    <label style="font-weight:bold;">値 (Values):</label>
                    <div style="display:flex; gap:4px;">
                        <select class="ss-pv-val border" style="flex:1; height:24px; background:#fff; color:#000;">
                            ${fieldOptions}
                        </select>
                        <select class="ss-pv-agg border" style="width:105px; height:24px; background:#fff; color:#000;">
                            <option value="SUM">合計 (SUM)</option>
                            <option value="COUNTA">個数 (COUNT)</option>
                            <option value="AVERAGE">平均 (AVG)</option>
                            <option value="MAX">最大 (MAX)</option>
                            <option value="MIN">最小 (MIN)</option>
                        </select>
                    </div>

                    <label style="font-weight:bold;">配置先:</label>
                    <div style="display:flex; flex-direction:column; gap:3px;">
                        <label style="display:flex; align-items:center; gap:4px; cursor:pointer;">
                            <input type="radio" name="ss-pv-dest" value="new" checked> 新規ワークシート
                        </label>
                        <label style="display:flex; align-items:center; gap:4px; cursor:pointer;">
                            <input type="radio" name="ss-pv-dest" value="existing"> 既存ワークシートの右隣空き領域
                        </label>
                    </div>
                </div>
            </div>
        `;

        const modalContent = openAppModal("ピボットテーブルの作成", bodyHtml, {
            width: 450,
            isHtml: true,
            parentWin: win,
            buttons: [
                {
                    label: "作成",
                    onClick: async () => {
                        const rowCol = Number(modalContent.querySelector(".ss-pv-row")?.value);
                        const colCol = Number(modalContent.querySelector(".ss-pv-col")?.value);
                        const valCol = Number(modalContent.querySelector(".ss-pv-val")?.value);
                        const filterCol = Number(modalContent.querySelector(".ss-pv-filter")?.value);
                        const aggType = modalContent.querySelector(".ss-pv-agg")?.value || "SUM";
                        const destMode = modalContent.querySelector('input[name="ss-pv-dest"]:checked')?.value || "new";

                        await buildPivotTable({
                            sourceSheetIndex: getActiveSheetIndex(),
                            bounds,
                            fields,
                            rowCol,
                            colCol,
                            valCol,
                            filterCol,
                            aggType,
                            destMode
                        });
                    }
                },
                { label: "キャンセル" }
            ]
        });

        // デフォルトで「列」に2番目、「値」に最後の数値列を自動選択して手間を省く
        if (fields.length >= 2 && modalContent) {
            const colSel = modalContent.querySelector(".ss-pv-col");
            const valSel = modalContent.querySelector(".ss-pv-val");
            if (colSel && fields.length >= 3) colSel.value = String(fields[1].col);
            if (valSel) valSel.value = String(fields[fields.length - 1].col);
        }
    }

    async function buildPivotTable(cfg) {
        const { bounds, fields, rowCol, colCol, valCol, filterCol, aggType, destMode } = cfg;
        const fieldMap = new Map(fields.map(f => [f.col, f.label]));

        // 1. 元データレコードの抽出
        const records = [];
        for (let r = bounds.minRow + 1; r <= bounds.maxRow; r++) {
            const tr = getRow(r);
            if (tr && tr.style.display === "none") continue;
            const rowKey = (getCell(r, rowCol)?.textContent ?? "").trim() || "(空白)";
            const colKey = colCol >= 0 ? ((getCell(r, colCol)?.textContent ?? "").trim() || "(空白)") : "値";
            const filterKey = filterCol >= 0 ? ((getCell(r, filterCol)?.textContent ?? "").trim() || "(空白)") : "";
            const rawValCell = getCell(r, valCol);
            const rawText = (rawValCell?.dataset.rawValue ?? rawValCell?.textContent ?? "").trim();
            const numVal = parseFormattedNumber(rawText);

            records.push({ rowKey, colKey, filterKey, rawText, numVal });
        }

        if (records.length === 0) {
            showAlert("集計対象のデータ行が見つかりませんでした。", "ピボットテーブル");
            return;
        }

        // 2. クロス集計バケットの構築（フィルター条件に応じて再集計可能にする）
        const collator = new Intl.Collator("ja", { numeric: true, sensitivity: "base" });
        const hasColDim = colCol >= 0;

        const buildFilteredBuckets = (activeFilterVal = "(すべて)") => {
            const targetRecords = (filterCol >= 0 && activeFilterVal && activeFilterVal !== "(すべて)")
                ? records.filter(r => r.filterKey === activeFilterVal)
                : records;

            const rKeys = Array.from(new Set(targetRecords.map(r => r.rowKey))).sort(collator.compare);
            const cKeys = hasColDim
                ? Array.from(new Set(targetRecords.map(r => r.colKey))).sort(collator.compare)
                : ["値"];

            const bMap = new Map(); // `${rKey}\0${cKey}` -> number[]
            targetRecords.forEach(rec => {
                const k = `${rec.rowKey}\0${rec.colKey}`;
                if (!bMap.has(k)) bMap.set(k, []);
                if (aggType === "COUNTA") {
                    if (rec.rawText !== "") bMap.get(k).push(1);
                } else if (!isNaN(rec.numVal)) {
                    bMap.get(k).push(rec.numVal);
                }
            });

            return { rowKeys: rKeys, colKeys: cKeys, buckets: bMap };
        };

        const computeAgg = (arr) => {
            if (!arr || arr.length === 0) return "";
            switch (aggType) {
                case "SUM":
                case "COUNTA":
                    return arr.reduce((a, b) => a + b, 0);
                case "AVERAGE":
                    return arr.reduce((a, b) => a + b, 0) / arr.length;
                case "MAX":
                    return Math.max(...arr);
                case "MIN":
                    return Math.min(...arr);
                default:
                    return "";
            }
        };

        const applyAggFormat = (cell, val) => {
            if (val === "") return;
            cell.dataset.numFormat = "comma";
            if (aggType === "AVERAGE") cell.dataset.decimalPlaces = "2";
            else delete cell.dataset.decimalPlaces;
            setCellFormattedValue(cell, val);
        };

        // 3. 出力先の決定（新規シート or 既存シートの右側）
        let startR = 2;
        let startC = 1;
        if (destMode === "new") {
            await addNewSheet(getActiveSheetIndex());
            const sheets = getSheets();
            const pvNum = sheets.filter(s => s.name.startsWith("ピボット")).length + 1;
            sheets[getActiveSheetIndex()].name = `ピボット${pvNum}`;
            renderSheetTabs();
        } else {
            startR = bounds.minRow;
            startC = bounds.maxCol + 2;
        }

        const initialData = buildFilteredBuckets("(すべて)");
        const aggLabelMap = { SUM: "合計", COUNTA: "個数", AVERAGE: "平均", MAX: "最大", MIN: "最小" };
        const titleText = `${aggLabelMap[aggType] || aggType} / ${fieldMap.get(valCol) || ""}`;

        const neededR = startR + initialData.rowKeys.length + 6;
        const neededC = startC + initialData.colKeys.length + 3;
        const curRowCount = getRowCount();
        const curCols = getCurrentColumns();
        if (neededR >= curRowCount) loadRowsSync(neededR - curRowCount + 5);
        if (neededC >= curCols) loadColumnsSync(neededC - curCols + 3);

        // 4. 固定見出し（フィルター・タイトル・列ラベル見出し）の配置
        let curR = startR;
        let fValCell = null;
        if (filterCol >= 0) {
            const fLabelCell = getVisibleCell(curR, startC);
            fValCell = getVisibleCell(curR, startC + 1);
            if (fLabelCell && fValCell) {
                setCellFormattedValue(fLabelCell, fieldMap.get(filterCol) || "フィルター");
                fLabelCell.style.fontWeight = "bold";
                fLabelCell.style.backgroundColor = "#d9e1f2";
                const fVals = Array.from(new Set(records.map(r => r.filterKey))).sort(collator.compare);
                setCellFormattedValue(fValCell, "(すべて)");
                fValCell.dataset.dropdownList = ["(すべて)", ...fVals].join(",");
                fValCell.style.backgroundColor = "#fff";
                fValCell.style.border = "1px solid #8ea9db";
            }
            curR += 2;
        }

        const titleCell = getVisibleCell(curR, startC);
        if (titleCell) {
            setCellFormattedValue(titleCell, titleText);
            titleCell.style.fontWeight = "bold";
            titleCell.style.color = "#1f4e78";
        }
        curR += 1;

        if (hasColDim) {
            const colTitleCell = getVisibleCell(curR, startC + 1);
            if (colTitleCell) {
                setCellFormattedValue(colTitleCell, fieldMap.get(colCol) || "列ラベル");
                colTitleCell.style.fontWeight = "bold";
                colTitleCell.style.backgroundColor = "#d9e1f2";
                colTitleCell.style.color = "#1f4e78";
            }
            curR += 1;
        }

        // 5. 集計グリッド本体の描画関数（初回・フィルター変更時で共用）
        const headerR = curR;
        let renderedRows = 0;
        let renderedCols = 0;

        const renderPivotGrid = (filterValue) => {
            // 前回描画した領域をクリア（行・列数が減った場合のゴミ残り防止）
            if (renderedRows > 0 || renderedCols > 0) {
                for (let r = headerR; r <= headerR + renderedRows + 1; r++) {
                    for (let c = startC; c <= startC + renderedCols; c++) {
                        const cell = getVisibleCell(r, c);
                        if (!cell) continue;
                        cell.textContent = "";
                        cell.removeAttribute("style");
                        delete cell.dataset.rawValue;
                        delete cell.dataset.numFormat;
                        delete cell.dataset.decimalPlaces;
                        delete cell.dataset.valueType;
                    }
                }
            }

            const { rowKeys, colKeys, buckets } = buildFilteredBuckets(filterValue);
            const totalColsCount = hasColDim ? (colKeys.length + 1) : 1;

            // テーブルヘッダー行（行ラベル ＋ 各列値 ＋ 総計）
            const rowHeaderCell = getVisibleCell(headerR, startC);
            if (rowHeaderCell) {
                setCellFormattedValue(rowHeaderCell, fieldMap.get(rowCol) || "行ラベル");
                Object.assign(rowHeaderCell.style, {
                    fontWeight: "bold",
                    backgroundColor: "#1f4e78",
                    color: "#ffffff",
                    borderBottom: "2px solid #1f4e78"
                });
            }

            colKeys.forEach((ck, cIdx) => {
                const hCell = getVisibleCell(headerR, startC + 1 + cIdx);
                if (!hCell) return;
                setCellFormattedValue(hCell, hasColDim ? ck : titleText);
                Object.assign(hCell.style, {
                    fontWeight: "bold",
                    textAlign: "right",
                    backgroundColor: "#1f4e78",
                    color: "#ffffff",
                    borderBottom: "2px solid #1f4e78"
                });
            });

            if (hasColDim) {
                const grandColH = getVisibleCell(headerR, startC + 1 + colKeys.length);
                if (grandColH) {
                    setCellFormattedValue(grandColH, "総計");
                    Object.assign(grandColH.style, {
                        fontWeight: "bold",
                        textAlign: "right",
                        backgroundColor: "#1f4e78",
                        color: "#ffffff",
                        borderBottom: "2px solid #1f4e78"
                    });
                }
            }

            // データ本体行の書き込み
            const firstBodyR = headerR + 1;
            rowKeys.forEach((rk, rIdx) => {
                const r = firstBodyR + rIdx;
                const rowBg = rIdx % 2 === 1 ? "#f2f5fb" : "#ffffff";
                const rLabelCell = getVisibleCell(r, startC);
                if (rLabelCell) {
                    setCellFormattedValue(rLabelCell, rk);
                    rLabelCell.style.backgroundColor = rowBg;
                    rLabelCell.style.borderBottom = "1px solid #d9e1f2";
                }

                const rowAllValues = [];
                colKeys.forEach((ck, cIdx) => {
                    const rawArr = buckets.get(`${rk}\0${ck}`) || [];
                    rowAllValues.push(...rawArr);
                    const cell = getVisibleCell(r, startC + 1 + cIdx);
                    if (!cell) return;
                    cell.style.backgroundColor = rowBg;
                    cell.style.borderBottom = "1px solid #d9e1f2";
                    applyAggFormat(cell, computeAgg(rawArr));
                });

                if (hasColDim) {
                    const rowGrandCell = getVisibleCell(r, startC + 1 + colKeys.length);
                    if (rowGrandCell) {
                        rowGrandCell.style.fontWeight = "bold";
                        rowGrandCell.style.backgroundColor = rowBg;
                        rowGrandCell.style.borderBottom = "1px solid #d9e1f2";
                        applyAggFormat(rowGrandCell, computeAgg(rowAllValues));
                    }
                }
            });

            // 総計行（Grand Total）の書き込み
            const grandR = firstBodyR + rowKeys.length;
            const totalRowStyle = {
                fontWeight: "bold",
                backgroundColor: "#d9e1f2",
                borderTop: "2px solid #1f4e78",
                borderBottom: "4px double #1f4e78"
            };

            const grandLabelCell = getVisibleCell(grandR, startC);
            if (grandLabelCell) {
                setCellFormattedValue(grandLabelCell, "総計");
                Object.assign(grandLabelCell.style, totalRowStyle);
            }

            const allRecordsValues = [];
            colKeys.forEach((ck, cIdx) => {
                const colAllValues = [];
                rowKeys.forEach(rk => {
                    const arr = buckets.get(`${rk}\0${ck}`) || [];
                    colAllValues.push(...arr);
                    allRecordsValues.push(...arr);
                });
                const cell = getVisibleCell(grandR, startC + 1 + cIdx);
                if (!cell) return;
                Object.assign(cell.style, totalRowStyle);
                applyAggFormat(cell, computeAgg(colAllValues));
            });

            if (hasColDim) {
                const bottomRightCell = getVisibleCell(grandR, startC + 1 + colKeys.length);
                if (bottomRightCell) {
                    Object.assign(bottomRightCell.style, totalRowStyle);
                    applyAggFormat(bottomRightCell, computeAgg(allRecordsValues));
                }
            }

            renderedRows = rowKeys.length;
            renderedCols = totalColsCount;

            syncCellGridlinesForBounds?.({
                minRow: startR,
                maxRow: Math.max(grandR + 1, headerR + renderedRows + 1),
                minCol: startC,
                maxCol: startC + totalColsCount
            });

            // 列幅を自動調整して見切れを防止
            for (let c = startC; c <= startC + totalColsCount; c++) {
                autoFitColumn(c);
            }
        };

        // 初回描画
        renderPivotGrid("(すべて)");

        // フィルターセルの選択変更時に自動再集計
        if (filterCol >= 0 && fValCell) {
            let prevFilterVal = "(すべて)";
            const filterObserver = new MutationObserver(() => {
                const curVal = (fValCell.textContent ?? "").trim() || "(すべて)";
                if (curVal === prevFilterVal) return;
                prevFilterVal = curVal;
                renderPivotGrid(curVal);
                setDirtyState(true);
                debouncedSaveState();
            });
            filterObserver.observe(fValCell, { childList: true, characterData: true, subtree: true });
            activeSheetObservers.add(filterObserver);
        }

        const focusTarget = getVisibleCell(headerR, startC);
        if (focusTarget) {
            clearSelection();
            setActiveCell(focusTarget, true);
            updateSelectedCellsDisplay();
            updateFillHandle();
        }

        statusBarState.stateText = "ピボットテーブルを生成しました";
        renderWindowStatusBar();
        setDirtyState(true);
        debouncedSaveState();
    }

    // =========================================================
    // フラッシュフィル（Ctrl+E / パターン自動学習＆一括展開）
    // =========================================================
    function inferFlashFillTransform(examples) {
        if (!examples.length) return null;
        const first = examples[0];
        const colCount = first.srcs.length;
        const verifyAll = (fn) => examples.every(ex => {
            try {
                return fn(ex.srcs) === ex.target;
            } catch {
                return false;
            }
        });

        const toProperCase = (s) => String(s).replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());

        // 1. 単一列の直接変換（大文字・小文字・タイトルケース・空白除去）
        for (let ci = 0; ci < colCount; ci++) {
            const directCandidates = [
                (srcs) => srcs[ci].toUpperCase(),
                (srcs) => srcs[ci].toLowerCase(),
                (srcs) => toProperCase(srcs[ci]),
                (srcs) => srcs[ci].replace(/\s+/g, "")
            ];
            for (const fn of directCandidates) {
                if (verifyAll(fn)) return fn;
            }
        }

        // 2. 複数列結合・前後リテラル付加テンプレート（例: A列 + " " + B列, "[" + A列 + "] " + B列, A列 + "様"）
        {
            const tgt = first.target;
            const matches = [];
            const usedIntervals = [];
            const orderCols = Array.from({ length: colCount }, (_, i) => i)
                .filter(i => first.srcs[i] !== "")
                .sort((a, b) => first.srcs[b].length - first.srcs[a].length);

            for (const ci of orderCols) {
                const needle = first.srcs[ci];
                let pos = tgt.indexOf(needle);
                while (pos !== -1) {
                    const end = pos + needle.length;
                    const overlaps = usedIntervals.some(([s, e]) => !(end <= s || pos >= e));
                    if (!overlaps) {
                        usedIntervals.push([pos, end]);
                        matches.push({ start: pos, end, colIdx: ci });
                        break;
                    }
                    pos = tgt.indexOf(needle, pos + 1);
                }
            }

            if (matches.length > 0) {
                matches.sort((a, b) => a.start - b.start);
                const segments = [];
                let cursor = 0;
                for (const m of matches) {
                    if (m.start > cursor) segments.push({ type: "lit", val: tgt.slice(cursor, m.start) });
                    segments.push({ type: "col", colIdx: m.colIdx });
                    cursor = m.end;
                }
                if (cursor < tgt.length) segments.push({ type: "lit", val: tgt.slice(cursor) });

                const templateFn = (srcs) => segments.map(seg => (seg.type === "lit" ? seg.val : (srcs[seg.colIdx] ?? ""))).join("");
                if (verifyAll(templateFn)) return templateFn;
            }
        }

        // 3. 区切り文字による分割・トークン抽出（前後文字付き含む）
        const delimiters = [" ", " ", ",", "、", "-", "_", "/", "@", ":", ".", "|", "（", "）", "(", ")"];
        for (let ci = 0; ci < colCount; ci++) {
            const src0 = first.srcs[ci];
            if (!src0) continue;

            for (const d of delimiters) {
                if (!src0.includes(d)) continue;
                const parts0 = src0.split(d).filter(p => p !== "");
                if (parts0.length < 2) continue;

                // 先頭からのインデックス・末尾からのインデックスで一致するトークンを探索
                for (let pi = 0; pi < parts0.length; pi++) {
                    const tok = parts0[pi];
                    const idxInTgt = first.target.indexOf(tok);
                    if (idxInTgt === -1) continue;
                    const pre = first.target.slice(0, idxInTgt);
                    const post = first.target.slice(idxInTgt + tok.length);

                    const fromStartFn = (srcs) => {
                        const arr = (srcs[ci] || "").split(d).filter(p => p !== "");
                        return pre + (arr[pi] ?? "") + post;
                    };
                    if (verifyAll(fromStartFn)) return fromStartFn;

                    const fromEndOffset = parts0.length - pi;
                    const fromEndFn = (srcs) => {
                        const arr = (srcs[ci] || "").split(d).filter(p => p !== "");
                        return pre + (arr[arr.length - fromEndOffset] ?? "") + post;
                    };
                    if (verifyAll(fromEndFn)) return fromEndFn;
                }
            }
        }

        // 4. 括弧内抽出・数字のみ／英字のみ抽出
        for (let ci = 0; ci < colCount; ci++) {
            const regexExtractors = [
                (srcs) => (srcs[ci].match(/\d+/g) || []).join(""),
                (srcs) => (srcs[ci].match(/\d+/) || [""])[0],
                (srcs) => {
                    const all = srcs[ci].match(/\d+/g) || [];
                    return all[all.length - 1] ?? "";
                },
                (srcs) => (srcs[ci].match(/[A-Za-z]+/g) || []).join(""),
                (srcs) => (srcs[ci].match(/[（(]([^）)]+)[）)]/) || ["", ""])[1],
                (srcs) => (srcs[ci].match(/\[([^\]]+)\]/) || ["", ""])[1],
                (srcs) => (srcs[ci].match(/【([^】]+)】/) || ["", ""])[1]
            ];
            for (const fn of regexExtractors) {
                if (verifyAll(fn)) return fn;
            }
        }

        // 5. 先頭・末尾・固定位置スライス（例: 先頭3文字 / 末尾4文字 / 部分文字列）
        for (let ci = 0; ci < colCount; ci++) {
            const src0 = first.srcs[ci];
            const tgt0 = first.target;
            if (!src0 || !tgt0) continue;

            if (src0.startsWith(tgt0)) {
                const len = tgt0.length;
                const fn = (srcs) => (srcs[ci] || "").slice(0, len);
                if (verifyAll(fn)) return fn;
            }
            if (src0.endsWith(tgt0)) {
                const len = tgt0.length;
                const fn = (srcs) => (srcs[ci] || "").slice(-len);
                if (verifyAll(fn)) return fn;
            }
            const pos = src0.indexOf(tgt0);
            if (pos > 0) {
                const len = tgt0.length;
                const fn = (srcs) => (srcs[ci] || "").slice(pos, pos + len);
                if (verifyAll(fn)) return fn;
            }
        }

        return null;
    }

    function executeFlashFill() {
        if (isCurrentSheetProtected?.()) {
            showAlert("シートが保護されているため、フラッシュフィルは実行できません。", "シートの保護");
            return;
        }
        flushPendingEdits();
        const activeCell = getActiveCell();
        if (!activeCell) return;

        const targetCol = parseInt(activeCell.dataset.col, 10);
        const activeRow = parseInt(activeCell.dataset.row, 10);
        const curRowCount = getRowCount();
        const curCols = getCurrentColumns();

        const getCellText = (r, c) => (getCell(r, c)?.textContent ?? "").trim();

        // 隣接するソース列群（左側に連続する非空列、なければ右側）を特定
        const hasAnyDataInColNear = (c) => {
            if (c < 0 || c >= curCols) return false;
            return getCellText(activeRow, c) !== "" ||
                (activeRow > 1 && getCellText(activeRow - 1, c) !== "") ||
                (activeRow + 1 < curRowCount && getCellText(activeRow + 1, c) !== "");
        };

        const sourceCols = [];
        if (hasAnyDataInColNear(targetCol - 1)) {
            let c = targetCol - 1;
            while (c >= 0 && hasAnyDataInColNear(c)) {
                sourceCols.unshift(c);
                c--;
            }
        } else if (hasAnyDataInColNear(targetCol + 1)) {
            let c = targetCol + 1;
            while (c < curCols && hasAnyDataInColNear(c)) {
                sourceCols.push(c);
                c++;
            }
        }

        if (!sourceCols.length) {
            showAlert("フラッシュフィルの参照元となる隣接データ列が見つかりません。", "フラッシュフィル");
            return;
        }

        const isRowSourceFilled = (r) => sourceCols.some(c => getCellText(r, c) !== "");
        let anchorRow = activeRow;
        if (!isRowSourceFilled(anchorRow)) {
            if (anchorRow > 1 && isRowSourceFilled(anchorRow - 1)) anchorRow--;
            else if (anchorRow + 1 < curRowCount && isRowSourceFilled(anchorRow + 1)) anchorRow++;
        }
        if (!isRowSourceFilled(anchorRow)) {
            showAlert("フラッシュフィルを実行するデータ範囲が見つかりません。", "フラッシュフィル");
            return;
        }

        let minRow = anchorRow;
        let maxRow = anchorRow;
        while (minRow > 1 && isRowSourceFilled(minRow - 1)) minRow--;
        while (maxRow < curRowCount - 1 && isRowSourceFilled(maxRow + 1)) maxRow++;

        // 先頭行が見出し行かどうかを推定（太字/背景色あり、または例示が2行目以降にも存在する場合は見出し行を除外）
        let dataStartRow = minRow;
        const firstRowTarget = getCellText(minRow, targetCol);
        const hasExampleBelowHeader = (() => {
            for (let r = minRow + 1; r <= maxRow; r++) {
                if (getCellText(r, targetCol) !== "") return true;
            }
            return false;
        })();
        const firstSrcCell = getCell(minRow, sourceCols[0]);
        const looksLikeHeader = Boolean(
            firstSrcCell && (firstSrcCell.style.fontWeight === "bold" || firstSrcCell.style.backgroundColor)
        );
        if (maxRow > minRow && hasExampleBelowHeader && (looksLikeHeader || firstRowTarget !== "")) {
            dataStartRow = minRow + 1;
        }

        const examples = [];
        for (let r = dataStartRow; r <= maxRow; r++) {
            const tgtVal = getCellText(r, targetCol);
            if (tgtVal === "") continue;
            const srcs = sourceCols.map(c => getCellText(r, c));
            examples.push({ row: r, srcs, target: tgtVal });
        }

        if (!examples.length) {
            showAlert("フラッシュフィルの手本となる入力例を、対象列に1〜2件入力してから実行してください。", "フラッシュフィル");
            return;
        }

        const transformFn = inferFlashFillTransform(examples);
        if (!transformFn) {
            showAlert("データのパターンを検出できませんでした。\n入力例を2件以上入力して再度お試しください。", "フラッシュフィル");
            return;
        }

        let filledCount = 0;
        for (let r = dataStartRow; r <= maxRow; r++) {
            const dest = getCell(r, targetCol);
            if (!dest || dest.style.display === "none") continue;
            if (getCellText(r, targetCol) !== "" || dest.dataset.formula) continue;
            const srcs = sourceCols.map(c => getCellText(r, c));
            const nextVal = transformFn(srcs);
            delete dest.dataset.formula;
            delete dest.dataset.richRuns;
            setCellFormattedValue(dest, nextVal);
            filledCount++;
        }

        if (filledCount === 0) {
            showAlert("フラッシュフィルで埋める空白セルがありませんでした。", "フラッシュフィル");
            return;
        }

        updateAllFormulas();
        applyConditionalFormats();
        if (hasAutoFilters()) applyAutoFilterRows();
        updateFillHandle();
        updateSelectedCellsDisplay();
        statusBarState.stateText = `フラッシュフィルで ${filledCount} 件を自動入力しました`;
        renderWindowStatusBar();
        setDirtyState(true);
        debouncedSaveState();
    }

    return {
        detectDataBlockBounds,
        openRemoveDuplicatesDialog,
        executeRemoveDuplicates,
        openTextToColumnsDialog,
        executeTextToColumns,
        openPivotTableDialog,
        buildPivotTable,
        executeFlashFill
    };
}