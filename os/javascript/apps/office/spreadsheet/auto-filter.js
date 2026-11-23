// auto-filter.js
// Excel 365準拠 オートフィルター機能（複数テーブル／複数範囲・数値/テキスト条件フィルター・▼矢印描画・絞り込みポップアップ）

import { escapeHtml, parseFormattedNumber } from "./format-utils.js";

export function createAutoFilterModule(ctx) {
    const {
        appRoot,
        tbody,
        signal,
        getActiveCell,
        getRowCount,
        getCurrentColumns,
        getVisibleCell,
        getRow,
        getSelectedRangeBounds,
        findTableAtCoord,
        clearSelection,
        setActiveCell,
        sortSelectedRange,
        refreshVisibleRows,
        syncCopyAntsBoxPosition,
        syncSelectionBoxPosition,
        syncCellDropdownButtonPosition,
        refreshFormulaRefOverlay,
        onAutoFilterChanged,
        updateAllFormulas,
        showAlert,
        setDirtyState,
        debouncedSaveState
    } = ctx;

    let autoFilterStates = []; // Array<{ id, tableId, headerRow, minCol, maxCol, maxRow, filters: Map<col, Set<string>> }>
    let activeFilterDropdownEl = null;

    function getAutoFilterStates() {
        return autoFilterStates;
    }

    function hasAutoFilters() {
        return autoFilterStates.length > 0;
    }

    function closeFilterDropdown() {
        if (!activeFilterDropdownEl) return;
        activeFilterDropdownEl.remove();
        activeFilterDropdownEl = null;
    }

    function getAutoFilterById(filterId) {
        return autoFilterStates.find(af => af.id === filterId) || null;
    }

    function getAutoFilterByTableId(tableId) {
        if (!tableId) return null;
        return autoFilterStates.find(af => af.tableId === tableId) || null;
    }

    function getAutoFilterAtCoord(row, col) {
        return autoFilterStates.find(
            af => row >= af.headerRow && row <= af.maxRow && col >= af.minCol && col <= af.maxCol
        ) || null;
    }

    function findActiveAutoFilterForCell(cell = null) {
        const target = cell || getActiveCell() || tbody.querySelector("td.selected");
        if (!target || !target.dataset) return null;
        const r = parseInt(target.dataset.row, 10);
        const c = parseInt(target.dataset.col, 10);
        if (Number.isNaN(r) || Number.isNaN(c)) return null;
        const direct = getAutoFilterAtCoord(r, c);
        if (direct) return direct;
        const tbl = findTableAtCoord(r, c);
        return tbl ? getAutoFilterByTableId(tbl.id) : null;
    }

    function syncFilterButtonState(cell = null) {
        const isInFilteredArea = Boolean(findActiveAutoFilterForCell(cell));
        appRoot.querySelector(".ss-toggle-filter-btn")?.classList.toggle("selected", isInFilteredArea);
    }

    function isColumnFiltered(af, colIdx) {
        return Boolean(af && (af.filters.has(colIdx) || af.conditions?.has(colIdx)));
    }

    function renderAutoFilterArrows() {
        tbody.querySelectorAll(".ss-filter-arrow").forEach(el => el.remove());
        autoFilterStates.forEach(af => {
            for (let c = af.minCol; c <= af.maxCol; c++) {
                const headerCell = getVisibleCell(af.headerRow, c);
                if (!headerCell) continue;
                headerCell.querySelectorAll(".ss-filter-arrow").forEach(el => el.remove());
                const arrow = document.createElement("span");
                arrow.className = "ss-filter-arrow";
                arrow.dataset.filterId = af.id;
                arrow.dataset.filterCol = String(c);
                arrow.textContent = "";
                arrow.title = "フィルターと並べ替え";
                arrow.classList.toggle("filtered", isColumnFiltered(af, c));
                arrow.addEventListener("mousedown", (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    openFilterDropdownMenu(af.id, c, arrow);
                }, { signal });
                headerCell.appendChild(arrow);
            }
        });
        syncFilterButtonState();
    }

    function addAutoFilterForRange({ headerRow, minCol, maxCol, maxRow, tableId = null, filters = null, conditions = null }) {
        // 同じ見出し行・列帯に重なる既存フィルターがあれば置き換え（別テーブルのフィルターは保持）
        autoFilterStates = autoFilterStates.filter(af => {
            if (tableId && af.tableId === tableId) return false;
            const overlapsHeader = af.headerRow === headerRow && !(af.maxCol < minCol || af.minCol > maxCol);
            return !overlapsHeader;
        });

        const af = {
            id: `af_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            tableId,
            headerRow,
            minCol,
            maxCol,
            maxRow,
            filters: filters instanceof Map ? filters : new Map(),
            conditions: conditions instanceof Map ? conditions : new Map()
        };
        autoFilterStates.push(af);
        renderAutoFilterArrows();
        applyAutoFilterRows();
        return af;
    }

    function removeAutoFilterById(filterId) {
        const beforeLen = autoFilterStates.length;
        autoFilterStates = autoFilterStates.filter(af => af.id !== filterId);
        if (autoFilterStates.length === beforeLen) return false;
        closeFilterDropdown();
        renderAutoFilterArrows();
        applyAutoFilterRows();
        return true;
    }

    function removeAutoFiltersInBounds(bounds) {
        if (!bounds || autoFilterStates.length === 0) return false;
        const prevLen = autoFilterStates.length;
        autoFilterStates = autoFilterStates.filter(af => !(
            af.headerRow >= bounds.minRow &&
            af.headerRow <= bounds.maxRow &&
            af.maxCol >= bounds.minCol &&
            af.minCol <= bounds.maxCol
        ));
        if (autoFilterStates.length !== prevLen) {
            closeFilterDropdown();
            renderAutoFilterArrows();
            applyAutoFilterRows();
            return true;
        }
        return false;
    }

    function shiftAutoFiltersForMove(srcBounds, rowDelta, colDelta) {
        if (!srcBounds || autoFilterStates.length === 0) return false;
        let filterMoved = false;
        autoFilterStates.forEach(af => {
            const isFilterHeaderMoved =
                af.headerRow >= srcBounds.minRow && af.headerRow <= srcBounds.maxRow &&
                af.minCol >= srcBounds.minCol && af.maxCol <= srcBounds.maxCol;
            if (!isFilterHeaderMoved) return;

            filterMoved = true;
            af.headerRow = Math.max(1, af.headerRow + rowDelta);
            af.maxRow = Math.max(af.headerRow, af.maxRow + rowDelta);
            af.minCol = Math.max(0, af.minCol + colDelta);
            af.maxCol = Math.max(af.minCol, af.maxCol + colDelta);

            const shiftedFilters = new Map();
            af.filters.forEach((vals, colIdx) => {
                shiftedFilters.set(Math.max(0, colIdx + colDelta), vals);
            });
            af.filters = shiftedFilters;

            const shiftedConditions = new Map();
            (af.conditions || new Map()).forEach((cond, colIdx) => {
                shiftedConditions.set(Math.max(0, colIdx + colDelta), cond);
            });
            af.conditions = shiftedConditions;
        });

        if (filterMoved) {
            renderAutoFilterArrows();
            applyAutoFilterRows();
        }
        return filterMoved;
    }

    function serializeAutoFilters() {
        return autoFilterStates.map(af => ({
            id: af.id,
            tableId: af.tableId || null,
            headerRow: af.headerRow,
            minCol: af.minCol,
            maxCol: af.maxCol,
            maxRow: af.maxRow,
            filters: Array.from(af.filters.entries()).map(([col, set]) => [col, Array.from(set)]),
            conditions: Array.from((af.conditions || new Map()).entries()).map(([col, cond]) => [col, { ...cond }])
        }));
    }

    function restoreAutoFilters(sheetData, { skipRecalc = false } = {}) {
        const rawAutoFilters = Array.isArray(sheetData?.autoFilters)
            ? sheetData.autoFilters
            : (sheetData?.autoFilter ? [sheetData.autoFilter] : []);
        if (rawAutoFilters.length > 0) {
            autoFilterStates = rawAutoFilters.map((af, idx) => ({
                id: af.id || `af_restored_${Date.now()}_${idx}`,
                tableId: af.tableId || null,
                headerRow: af.headerRow,
                minCol: af.minCol,
                maxCol: af.maxCol,
                maxRow: af.maxRow,
                filters: new Map((af.filters || []).map(([col, vals]) => [Number(col), new Set(vals)])),
                conditions: new Map((af.conditions || []).map(([col, cond]) => [Number(col), { ...cond }]))
            }));
            renderAutoFilterArrows();
            applyAutoFilterRows({ skipRecalc });
        }
    }

    function matchAutoFilterCondition(rawText, cond, stats) {
        const op = cond?.op || "";
        if (!op) return true;
        const text = String(rawText ?? "").trim();
        const lowerText = text.toLowerCase();
        const v1Str = String(cond.val1 ?? "").trim();
        const v2Str = String(cond.val2 ?? "").trim();
        const lowerV1 = v1Str.toLowerCase();

        if (op === "contains") return v1Str === "" || lowerText.includes(lowerV1);
        if (op === "notContains") return v1Str === "" || !lowerText.includes(lowerV1);
        if (op === "startsWith") return v1Str === "" || lowerText.startsWith(lowerV1);
        if (op === "endsWith") return v1Str === "" || lowerText.endsWith(lowerV1);

        const num = parseFormattedNumber(text);
        if (op === "aboveAvg") return !isNaN(num) && stats && num > stats.avg;
        if (op === "belowAvg") return !isNaN(num) && stats && num < stats.avg;
        if (op === "topN") return !isNaN(num) && stats && num >= stats.topCut;
        if (op === "bottomN") return !isNaN(num) && stats && num <= stats.bottomCut;

        const n1 = parseFormattedNumber(v1Str);
        const n2 = parseFormattedNumber(v2Str);
        if (op === "eq") {
            if (!isNaN(num) && !isNaN(n1)) return num === n1;
            return lowerText === lowerV1;
        }
        if (op === "neq") {
            if (!isNaN(num) && !isNaN(n1)) return num !== n1;
            return lowerText !== lowerV1;
        }
        if (isNaN(num) || isNaN(n1)) return false;
        if (op === "gt") return num > n1;
        if (op === "gte") return num >= n1;
        if (op === "lt") return num < n1;
        if (op === "lte") return num <= n1;
        if (op === "between") return !isNaN(n2) && num >= Math.min(n1, n2) && num <= Math.max(n1, n2);
        return true;
    }

    function isRowMatchingOtherFilters(af, rowNum, excludeColIdx) {
        if (!af) return true;
        if (af.filters && af.filters.size > 0) {
            for (const [colIdx, allowedSet] of af.filters.entries()) {
                if (colIdx === excludeColIdx) continue;
                const cell = getVisibleCell(rowNum, colIdx);
                const val = (cell?.textContent ?? "").trim();
                if (!allowedSet.has(val)) return false;
            }
        }
        if (af.conditions && af.conditions.size > 0) {
            const startR = af.headerRow + 1;
            const endR = Math.min(af.maxRow, tbody.rows.length);
            for (const [colIdx, cond] of af.conditions.entries()) {
                if (colIdx === excludeColIdx) continue;
                let stats = null;
                if (["aboveAvg", "belowAvg", "topN", "bottomN"].includes(cond.op)) {
                    const nums = [];
                    for (let r = startR; r <= endR; r++) {
                        const c = getVisibleCell(r, colIdx);
                        const n = parseFormattedNumber(c?.dataset.rawValue ?? c?.textContent ?? "");
                        if (!isNaN(n)) nums.push(n);
                    }
                    const sum = nums.reduce((a, b) => a + b, 0);
                    const avg = nums.length ? sum / nums.length : 0;
                    const rank = Math.max(1, Math.trunc(Number(cond.val1) || 10));
                    const desc = [...nums].sort((a, b) => b - a);
                    const asc = [...nums].sort((a, b) => a - b);
                    stats = {
                        avg,
                        topCut: desc[Math.min(desc.length - 1, rank - 1)] ?? Infinity,
                        bottomCut: asc[Math.min(asc.length - 1, rank - 1)] ?? -Infinity
                    };
                }
                const cell = getVisibleCell(rowNum, colIdx);
                const rawVal = (cell?.dataset.rawValue ?? cell?.textContent ?? "").trim();
                if (!matchAutoFilterCondition(rawVal, cond, stats)) return false;
            }
        }
        return true;
    }

    function applyAutoFilterRows({ skipRecalc = false } = {}) {
        const totalRows = tbody.rows.length;
        let visibilityChanged = false;
        if (!autoFilterStates.length) {
            for (let i = 0; i < totalRows; i++) {
                const tr = tbody.rows[i];
                const nextDisplay = tr.dataset.userHidden === "1" ? "none" : "";
                if (tr.dataset.filterHidden === "1" || tr.style.display !== nextDisplay) {
                    visibilityChanged = true;
                }
                delete tr.dataset.filterHidden;
                tr.style.display = nextDisplay;
            }
            syncFilterButtonState();
            refreshVisibleRows();
            syncCopyAntsBoxPosition();
            syncSelectionBoxPosition?.();
            syncCellDropdownButtonPosition?.();
            refreshFormulaRefOverlay?.();
            onAutoFilterChanged?.();
            if (!skipRecalc && visibilityChanged) updateAllFormulas();
            return;
        }

        const hiddenRows = new Set();
        for (const af of autoFilterStates) {
            const hasValFilters = Boolean(af.filters && af.filters.size > 0);
            const hasCondFilters = Boolean(af.conditions && af.conditions.size > 0);
            if (!hasValFilters && !hasCondFilters) continue;

            const startR = af.headerRow + 1;
            const endR = Math.min(af.maxRow, totalRows);

            // 上位N件・下位N件・平均用の統計値を列ごとに事前計算
            const colStatsMap = new Map();
            if (hasCondFilters) {
                for (const [colIdx, cond] of af.conditions.entries()) {
                    if (!["aboveAvg", "belowAvg", "topN", "bottomN"].includes(cond.op)) continue;
                    const nums = [];
                    for (let r = startR; r <= endR; r++) {
                        const cell = getVisibleCell(r, colIdx);
                        const n = parseFormattedNumber(cell?.dataset.rawValue ?? cell?.textContent ?? "");
                        if (!isNaN(n)) nums.push(n);
                    }
                    const sum = nums.reduce((a, b) => a + b, 0);
                    const avg = nums.length ? sum / nums.length : 0;
                    const rank = Math.max(1, Math.trunc(Number(cond.val1) || 10));
                    const desc = [...nums].sort((a, b) => b - a);
                    const asc = [...nums].sort((a, b) => a - b);
                    colStatsMap.set(colIdx, {
                        avg,
                        topCut: desc[Math.min(desc.length - 1, rank - 1)] ?? Infinity,
                        bottomCut: asc[Math.min(asc.length - 1, rank - 1)] ?? -Infinity
                    });
                }
            }

            for (let r = startR; r <= endR; r++) {
                if (hiddenRows.has(r)) continue;

                if (hasValFilters) {
                    let excluded = false;
                    for (const [colIdx, allowedSet] of af.filters.entries()) {
                        const cell = getVisibleCell(r, colIdx);
                        const val = (cell?.textContent ?? "").trim();
                        if (!allowedSet.has(val)) {
                            hiddenRows.add(r);
                            excluded = true;
                            break;
                        }
                    }
                    if (excluded) continue;
                }

                if (hasCondFilters) {
                    for (const [colIdx, cond] of af.conditions.entries()) {
                        const cell = getVisibleCell(r, colIdx);
                        const rawVal = (cell?.dataset.rawValue ?? cell?.textContent ?? "").trim();
                        if (!matchAutoFilterCondition(rawVal, cond, colStatsMap.get(colIdx))) {
                            hiddenRows.add(r);
                            break;
                        }
                    }
                }
            }
        }

        for (let r = 1; r <= totalRows; r++) {
            const tr = getRow(r);
            if (!tr) continue;
            if (hiddenRows.has(r)) {
                if (tr.dataset.filterHidden !== "1" || tr.style.display !== "none") {
                    visibilityChanged = true;
                }
                tr.dataset.filterHidden = "1";
                tr.style.display = "none";
            } else {
                const nextDisplay = tr.dataset.userHidden === "1" ? "none" : "";
                if (tr.dataset.filterHidden === "1" || tr.style.display !== nextDisplay) {
                    visibilityChanged = true;
                }
                delete tr.dataset.filterHidden;
                tr.style.display = nextDisplay;
            }
        }

        tbody.querySelectorAll(".ss-filter-arrow").forEach(arrow => {
            const af = getAutoFilterById(arrow.dataset.filterId);
            const c = Number(arrow.dataset.filterCol);
            arrow.classList.toggle("filtered", isColumnFiltered(af, c));
        });
        syncFilterButtonState();
        refreshVisibleRows();
        syncCopyAntsBoxPosition();
        syncSelectionBoxPosition?.();
        syncCellDropdownButtonPosition?.();
        refreshFormulaRefOverlay?.();
        onAutoFilterChanged?.();
        if (!skipRecalc && visibilityChanged) updateAllFormulas();
    }

    function openFilterDropdownMenu(filterId, colIdx, anchorEl) {
        const existing = document.querySelector(".ss-filter-dropdown");
        if (existing && existing.dataset.filterId === filterId && existing.dataset.filterCol === String(colIdx)) {
            closeFilterDropdown();
            return;
        }
        closeFilterDropdown();
        const af = getAutoFilterById(filterId);
        if (!af) return;
        if (!af.conditions) af.conditions = new Map();
        const { headerRow, maxRow, filters, conditions } = af;

        const uniqueValues = new Set();
        for (let r = headerRow + 1; r <= maxRow; r++) {
            const cell = getVisibleCell(r, colIdx);
            uniqueValues.add((cell?.textContent ?? "").trim());
        }
        const sortedVals = Array.from(uniqueValues).sort((a, b) => a.localeCompare(b, "ja", { numeric: true }));
        const currentAllowed = filters.get(colIdx) || new Set(sortedVals);
        const curCond = conditions.get(colIdx) || { op: "", val1: "", val2: "" };

        const rect = anchorEl.getBoundingClientRect();
        const dropdown = document.createElement("div");
        dropdown.className = "ss-filter-dropdown";
        dropdown.dataset.filterId = filterId;
        dropdown.dataset.filterCol = String(colIdx);
        dropdown.style.width = "255px";
        dropdown.style.left = `${Math.min(window.innerWidth - 265, Math.max(8, rect.left - 210))}px`;
        dropdown.style.top = `${Math.min(window.innerHeight - 380, rect.bottom + 2)}px`;

        const noInputOps = new Set(["", "aboveAvg", "belowAvg"]);
        dropdown.innerHTML = `
            <div style="display:flex; gap:4px;">
                <button type="button" class="ss-flt-sort-asc" style="flex:1; font-size:11px; padding:2px;">A↓Z 昇順</button>
                <button type="button" class="ss-flt-sort-desc" style="flex:1; font-size:11px; padding:2px;">Z↓A 降順</button>
            </div>
            <div style="border-top:1px solid #808080; border-bottom:1px solid #808080; padding:4px 0; display:flex; flex-direction:column; gap:4px;">
                <div style="font-size:11px; font-weight:bold;">条件フィルター (数値 / テキスト):</div>
                <select class="ss-flt-cond-op border" style="width:100%; height:22px; font-size:11px; background:#fff; color:#000;">
                    <option value="" ${curCond.op === "" ? "selected" : ""}>(条件指定なし)</option>
                    <option value="gt" ${curCond.op === "gt" ? "selected" : ""}>数値: 指定の値より大きい (&gt;)</option>
                    <option value="gte" ${curCond.op === "gte" ? "selected" : ""}>数値: 指定の値以上 (&gt;=)</option>
                    <option value="lt" ${curCond.op === "lt" ? "selected" : ""}>数値: 指定の値より小さい (&lt;)</option>
                    <option value="lte" ${curCond.op === "lte" ? "selected" : ""}>数値: 指定の値以下 (&lt;=)</option>
                    <option value="between" ${curCond.op === "between" ? "selected" : ""}>数値: 指定の範囲内</option>
                    <option value="eq" ${curCond.op === "eq" ? "selected" : ""}>指定の値に等しい (=)</option>
                    <option value="neq" ${curCond.op === "neq" ? "selected" : ""}>指定の値に等しくない (&lt;&gt;)</option>
                    <option value="contains" ${curCond.op === "contains" ? "selected" : ""}>テキスト: 指定の文字を含む</option>
                    <option value="notContains" ${curCond.op === "notContains" ? "selected" : ""}>テキスト: 指定の文字を含まない</option>
                    <option value="startsWith" ${curCond.op === "startsWith" ? "selected" : ""}>テキスト: 指定の文字で始まる</option>
                    <option value="endsWith" ${curCond.op === "endsWith" ? "selected" : ""}>テキスト: 指定の文字で終わる</option>
                    <option value="topN" ${curCond.op === "topN" ? "selected" : ""}>トップテン: 上位 N 件</option>
                    <option value="bottomN" ${curCond.op === "bottomN" ? "selected" : ""}>トップテン: 下位 N 件</option>
                    <option value="aboveAvg" ${curCond.op === "aboveAvg" ? "selected" : ""}>数値: 平均より上</option>
                    <option value="belowAvg" ${curCond.op === "belowAvg" ? "selected" : ""}>数値: 平均より下</option>
                </select>
                <div class="ss-flt-cond-inputs" style="display:${noInputOps.has(curCond.op) ? "none" : "flex"}; gap:4px;">
                    <input type="text" class="ss-flt-cond-v1 border" value="${escapeHtml(curCond.val1 || "")}" placeholder="${curCond.op === "topN" || curCond.op === "bottomN" ? "件数 (例: 5)" : "条件値"}" style="flex:1; min-width:0; height:22px; padding:1px 4px; font-size:11px; background:#fff; color:#000;">
                    <input type="text" class="ss-flt-cond-v2 border" value="${escapeHtml(curCond.val2 || "")}" placeholder="最大値" style="display:${curCond.op === "between" ? "block" : "none"}; flex:1; min-width:0; height:22px; padding:1px 4px; font-size:11px; background:#fff; color:#000;">
                </div>
            </div>
            <input type="text" class="ss-flt-search border" placeholder="値リストを検索..." style="width:100%; height:22px; padding:2px 4px; font-size:11px; background:#fff; color:#000;">
            <label style="display:flex; align-items:center; gap:4px; font-weight:bold; cursor:pointer;">
                <input type="checkbox" class="ss-flt-all" ${currentAllowed.size === sortedVals.length ? "checked" : ""}> (すべて選択)
            </label>
            <div class="ss-filter-values-list" style="max-height:130px;">
                ${sortedVals.map(v => `
                    <label class="ss-flt-item" data-val="${escapeHtml(v)}" style="display:flex; align-items:center; gap:4px; cursor:pointer; white-space:nowrap;">
                        <input type="checkbox" value="${escapeHtml(v)}" ${currentAllowed.has(v) ? "checked" : ""}>
                        <span>${v === "" ? "(空白セル)" : escapeHtml(v)}</span>
                    </label>
                `).join("")}
            </div>
            <div style="display:flex; justify-content:space-between; gap:4px;">
                <button type="button" class="ss-flt-clear-col" style="padding:2px 6px; font-size:11px;">列クリア</button>
                <div style="display:flex; gap:4px;">
                    <button type="button" class="ss-flt-ok" style="padding:2px 10px; font-size:11px;">OK</button>
                    <button type="button" class="ss-flt-cancel" style="padding:2px 8px; font-size:11px;">キャンセル</button>
                </div>
            </div>
        `;
        document.body.appendChild(dropdown);
        activeFilterDropdownEl = dropdown;

        const condOpSel = dropdown.querySelector(".ss-flt-cond-op");
        const condInputsWrap = dropdown.querySelector(".ss-flt-cond-inputs");
        const condV1 = dropdown.querySelector(".ss-flt-cond-v1");
        const condV2 = dropdown.querySelector(".ss-flt-cond-v2");

        condOpSel.addEventListener("change", () => {
            const op = condOpSel.value;
            condInputsWrap.style.display = noInputOps.has(op) ? "none" : "flex";
            condV2.style.display = op === "between" ? "block" : "none";
            condV1.placeholder = (op === "topN" || op === "bottomN") ? "件数 (例: 5)" : "条件値";
            if ((op === "topN" || op === "bottomN") && !condV1.value) condV1.value = "10";
        });

        const allChk = dropdown.querySelector(".ss-flt-all");
        const itemChks = Array.from(dropdown.querySelectorAll(".ss-flt-item input[type='checkbox']"));
        const searchInp = dropdown.querySelector(".ss-flt-search");

        allChk.addEventListener("change", () => {
            itemChks.forEach(chk => {
                if (chk.closest(".ss-flt-item").style.display !== "none") {
                    chk.checked = allChk.checked;
                }
            });
        });

        searchInp.addEventListener("input", () => {
            const q = searchInp.value.toLowerCase();
            dropdown.querySelectorAll(".ss-flt-item").forEach(lbl => {
                const txt = lbl.dataset.val.toLowerCase();
                lbl.style.display = txt.includes(q) ? "flex" : "none";
            });
        });

        const sortThisFilterRange = (asc) => {
            closeFilterDropdown();
            const dataStartR = af.headerRow + 1;
            const dataEndR = af.maxRow;
            if (dataEndR < dataStartR) return;
            clearSelection();
            for (let r = dataStartR; r <= dataEndR; r++) {
                for (let c = af.minCol; c <= af.maxCol; c++) {
                    const cell = getVisibleCell(r, c);
                    if (cell && cell.style.display !== "none") cell.classList.add("selected");
                }
            }
            const targetCell = getVisibleCell(dataStartR, colIdx);
            if (targetCell) {
                setActiveCell(targetCell, false);
                sortSelectedRange(asc);
            }
        };

        dropdown.querySelector(".ss-flt-sort-asc").addEventListener("click", () => sortThisFilterRange(true));
        dropdown.querySelector(".ss-flt-sort-desc").addEventListener("click", () => sortThisFilterRange(false));

        dropdown.querySelector(".ss-flt-clear-col").addEventListener("click", () => {
            filters.delete(colIdx);
            conditions.delete(colIdx);
            applyAutoFilterRows();
            closeFilterDropdown();
            setDirtyState(true);
            debouncedSaveState();
        });

        dropdown.querySelector(".ss-flt-ok").addEventListener("click", () => {
            const checkedVals = new Set(itemChks.filter(c => c.checked).map(c => c.value));
            if (checkedVals.size === sortedVals.length) {
                filters.delete(colIdx);
            } else {
                filters.set(colIdx, checkedVals);
            }

            const op = condOpSel.value;
            const val1 = condV1.value.trim();
            const val2 = condV2.value.trim();
            if (!op || (!noInputOps.has(op) && val1 === "")) {
                conditions.delete(colIdx);
            } else {
                conditions.set(colIdx, { op, val1, val2 });
            }

            applyAutoFilterRows();
            closeFilterDropdown();
            setDirtyState(true);
            debouncedSaveState();
        });

        dropdown.querySelector(".ss-flt-cancel").addEventListener("click", closeFilterDropdown);
        searchInp.focus();
    }

    function clearAllAutoFilters({ skipRecalc = false } = {}) {
        closeFilterDropdown();
        tbody.querySelectorAll(".ss-filter-arrow").forEach(el => el.remove());
        autoFilterStates = [];
        Array.from(tbody.rows).forEach(tr => {
            delete tr.dataset.filterHidden;
            tr.style.display = tr.dataset.userHidden === "1" ? "none" : "";
        });
        syncFilterButtonState();
        refreshVisibleRows();
        syncCopyAntsBoxPosition();
        syncSelectionBoxPosition?.();
        syncCellDropdownButtonPosition?.();
        refreshFormulaRefOverlay?.();
        onAutoFilterChanged?.();
        if (!skipRecalc) {
            updateAllFormulas();
        }
    }

    function toggleAutoFilter() {
        const bounds = getSelectedRangeBounds();
        if (!bounds) return;

        // 選択中のセルが既存のフィルター範囲内（テーブルの集計行含む）にある場合は、そのフィルターだけを解除する
        const activeFilter = findActiveAutoFilterForCell(getActiveCell()) || getAutoFilterAtCoord(bounds.minRow, bounds.minCol);
        if (activeFilter) {
            removeAutoFilterById(activeFilter.id);
            setDirtyState(true);
            debouncedSaveState();
            return;
        }

        let { minRow, maxRow, minCol, maxCol } = bounds;
        const isFilled = (r, c) => {
            const cell = getVisibleCell(r, c);
            return Boolean(cell && (cell.dataset.formula || (cell.dataset.rawValue ?? cell.textContent).trim() !== ""));
        };

        // 構造化テーブル内ならテーブル範囲に合わせてフィルターを付与（集計行は除外）
        const tbl = findTableAtCoord(minRow, minCol);
        if (tbl && tbl.hasHeader) {
            addAutoFilterForRange({
                headerRow: tbl.minRow,
                minCol: tbl.minCol,
                maxCol: tbl.maxCol,
                maxRow: tbl.hasTotalRow ? tbl.maxRow - 1 : tbl.maxRow,
                tableId: tbl.id
            });
            setDirtyState(true);
            debouncedSaveState();
            return;
        }

        // 単一セル選択時は連続するデータテーブル範囲を自動検出
        const curRowCount = getRowCount();
        const colCount = getCurrentColumns();
        if (minRow === maxRow && minCol === maxCol) {
            if (!isFilled(minRow, minCol)) {
                showAlert("フィルターを設定するデータ範囲を選択してください。", "オートフィルター");
                return;
            }
            while (minRow > 1 && isFilled(minRow - 1, minCol)) minRow--;
            while (maxRow < curRowCount - 1 && isFilled(maxRow + 1, minCol)) maxRow++;
            while (minCol > 0 && isFilled(minRow, minCol - 1)) minCol--;
            while (maxCol < colCount - 1 && isFilled(minRow, maxCol + 1)) maxCol++;
        }

        addAutoFilterForRange({
            headerRow: minRow,
            minCol,
            maxCol,
            maxRow,
            tableId: null
        });
        setDirtyState(true);
        debouncedSaveState();
    }

    document.addEventListener("mousedown", (e) => {
        if (!e.target.closest(".ss-filter-dropdown, .ss-filter-arrow")) {
            closeFilterDropdown();
        }
    }, { signal });

    return {
        getAutoFilterStates,
        hasAutoFilters,
        closeFilterDropdown,
        getAutoFilterById,
        getAutoFilterByTableId,
        getAutoFilterAtCoord,
        findActiveAutoFilterForCell,
        isRowMatchingOtherFilters,
        syncFilterButtonState,
        renderAutoFilterArrows,
        addAutoFilterForRange,
        removeAutoFilterById,
        removeAutoFiltersInBounds,
        shiftAutoFiltersForMove,
        serializeAutoFilters,
        restoreAutoFilters,
        applyAutoFilterRows,
        clearAllAutoFilters,
        toggleAutoFilter
    };
}