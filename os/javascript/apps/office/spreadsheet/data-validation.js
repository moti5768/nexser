// data-validation.js
// セル内ドロップダウンリスト・データの入力規則（検証/ツールチップ/設定モーダル）・ハイパーリンク管理

import {
    escapeHtml,
    columnLettersToIndex,
    parseFormattedNumber,
    formatDisplayByNumFmt,
    setCellTextPreservingControls
} from "./format-utils.js";
import {
    parseExcelDate,
    FORMULA_FUNCTIONS
} from "./formula-functions.js";
import { parseRangeReference } from "./formula-ref-overlay.js";

export function compareValidationValues(op, val, v1, v2) {
    if (op === "between") return val >= Math.min(v1, v2) && val <= Math.max(v1, v2);
    if (op === "notBetween") return val < Math.min(v1, v2) || val > Math.max(v1, v2);
    if (op === "=") return val === v1;
    if (op === "<>") return val !== v1;
    if (op === ">") return val > v1;
    if (op === "<") return val < v1;
    if (op === ">=") return val >= v1;
    if (op === "<=") return val <= v1;
    return true;
}

export function extractHyperlinkTarget(cell) {
    if (!cell) return "";
    if (cell.dataset.hyperlink) return cell.dataset.hyperlink;
    const f = cell.dataset.formula || "";
    const m = f.match(/^=\s*HYPERLINK\s*\(\s*"([^"]+)"/i);
    if (m) return m[1].trim();
    const txt = (cell.dataset.rawValue ?? cell.textContent).trim();
    if (/^https?:\/\/\S+$/i.test(txt)) return txt;
    return "";
}

export function createDataValidationModule(ctx) {
    const {
        win,
        signal,
        container,
        spreadsheetContent,
        table,
        theadRow,
        tbody,
        formulaBarInput,
        getActiveCell,
        getSheets,
        getActiveSheetIndex,
        getCurrentColumns,
        getRowCount,
        getCachedTableWidth,
        isCurrentSheetProtected,
        isCellLockedForEdit,
        isCellEditing,
        loadColumnsSync,
        loadRowsSync,
        peekCell,
        getVisibleCell,
        getCellPureText,
        getBackgroundSheetCellMap,
        evaluateFormula,
        adjustFormula,
        clearFormulaEvalCache,
        commitCellValue,
        setCellFormattedValue,
        setActiveCell,
        updateSelectedCellsDisplay,
        switchToSheet,
        navigateToCell,
        flushPendingEdits,
        openAppModal,
        openSheetRangePicker,
        showAlert,
        showDataValidationDialog,
        setDirtyState,
        debouncedSaveState
    } = ctx;

    let activeDropdownCleanup = null;

    // セル（<td>）から完全に分離された独立プルダウンボタン（spreadsheetContent直下に1つだけ配置）
    const floatingDropdownBtn = document.createElement("button");
    floatingDropdownBtn.type = "button";
    floatingDropdownBtn.tabIndex = -1;
    floatingDropdownBtn.className = "ss-cell-dropdown-btn";
    floatingDropdownBtn.textContent = "▼";
    floatingDropdownBtn.title = "リストから選択 (Alt+↓)";
    spreadsheetContent.appendChild(floatingDropdownBtn);

    let dropdownOwnerCell = null;

    // mousedown のみに統一（pointerdown との二重発火による即閉じバグを解消）
    floatingDropdownBtn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const cell = dropdownOwnerCell;
        if (!cell || !cell.dataset.dropdownList) return;
        const existingMenu = document.querySelector(".ss-cell-dropdown-list");
        if (existingMenu && existingMenu.dataset.ownerCell === `${cell.dataset.row},${cell.dataset.col}`) {
            closeCellDropdownList();
        } else {
            openCellDropdownList(cell, floatingDropdownBtn);
        }
    }, { signal });

    floatingDropdownBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
    }, { signal });

    function hideCellDropdownButton() {
        dropdownOwnerCell = null;
        floatingDropdownBtn.style.display = "none";
        floatingDropdownBtn.classList.remove("open");
    }

    function temporarilyHideDropdownButtonOnScroll() {
        if (dropdownOwnerCell && floatingDropdownBtn.style.display !== "none") {
            floatingDropdownBtn.style.display = "none";
        }
    }

    function restoreDropdownButtonAfterScroll() {
        if (dropdownOwnerCell) {
            syncCellDropdownButtonPosition();
        }
    }

    function syncCellDropdownButtonPosition() {
        const cell = dropdownOwnerCell;
        if (!cell || !cell.isConnected || !cell.dataset.dropdownList || isCellEditing(cell) || cell.style.display === "none") {
            hideCellDropdownButton();
            return;
        }
        const tr = cell.closest("tr");
        if (tr && tr.style.display === "none") {
            floatingDropdownBtn.style.display = "none";
            return;
        }

        const zoom = parseFloat(spreadsheetContent.style.zoom || "1") || 1;
        const contRect = container.getBoundingClientRect();
        const contentRect = spreadsheetContent.getBoundingClientRect();
        const cellRect = cell.getBoundingClientRect();

        // ヘッダー裏や表示領域外へスクロールしたときは一時非表示（戻したときに再表示するため owner は保持）
        const cornerEl = theadRow.querySelector(".ss-corner");
        const headerBottom = cornerEl ? cornerEl.getBoundingClientRect().bottom : contRect.top;
        const rowHeaderRight = cornerEl ? cornerEl.getBoundingClientRect().right : contRect.left;
        const isRowFrozen = cell.classList.contains("ss-frozen-row");
        const isColFrozen = cell.classList.contains("ss-frozen-col");

        const outVertical = cellRect.bottom <= (isRowFrozen ? contRect.top : headerBottom) || cellRect.top >= contRect.bottom;
        const outHorizontal = cellRect.right <= (isColFrozen ? contRect.left : rowHeaderRight) || cellRect.left >= contRect.right;
        if (outVertical || outHorizontal) {
            floatingDropdownBtn.style.display = "none";
            return;
        }

        const left = (cellRect.left - contentRect.left) / zoom;
        const top = (cellRect.top - contentRect.top) / zoom;
        const cellW = (cellRect.width / zoom) || 120;
        const cellH = (cellRect.height / zoom) || 30;
        const btnW = 18;
        const btnH = Math.min(cellH, 22);

        // Excel準拠：セルの右外側に隣接配置（テーブル最右端のみセル内右端に収める）
        const rightOutside = left + cellW;
        const maxRight = Math.max(table.offsetWidth, getCachedTableWidth());
        const btnLeft = (rightOutside + btnW <= maxRight + 2)
            ? rightOutside
            : Math.max(0, left + cellW - btnW);
        const btnTop = top + Math.max(0, cellH - btnH);

        floatingDropdownBtn.style.left = `${btnLeft}px`;
        floatingDropdownBtn.style.top = `${btnTop}px`;
        floatingDropdownBtn.style.width = `${btnW}px`;
        floatingDropdownBtn.style.height = `${btnH}px`;
        floatingDropdownBtn.style.display = "inline-flex";
    }

    function closeCellDropdownList() {
        if (!activeDropdownCleanup && !floatingDropdownBtn.classList.contains("open")) return;
        if (activeDropdownCleanup) {
            activeDropdownCleanup();
            activeDropdownCleanup = null;
        }
        floatingDropdownBtn.classList.remove("open");
        document.querySelectorAll(".ss-cell-dropdown-list").forEach(el => el.remove());
    }

    function resolveCellDropdownItems(spec) {
        const raw = String(spec ?? "").trim();
        if (!raw) return [];

        const sheets = getSheets();
        const activeSheetIndex = getActiveSheetIndex();
        const expr = raw.startsWith("=") ? raw.slice(1).trim() : raw;
        const refMatch = expr.match(
            /^(?:(?:'([^']+)'|([A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+))!)?(\$?[A-Za-z]+\$?\d+)(?::(\$?[A-Za-z]+\$?\d+))?$/i
        );

        if (refMatch && (raw.startsWith("=") || refMatch[1] || refMatch[2] || refMatch[4])) {
            const sheetName = refMatch[1] ?? refMatch[2];
            const targetSheetIdx = sheetName
                ? sheets.findIndex(s => s.name === sheetName)
                : activeSheetIndex;
            if (targetSheetIdx < 0) return [];

            const startToken = refMatch[3].toUpperCase();
            const endToken = (refMatch[4] || refMatch[3]).toUpperCase();
            const range = parseRangeReference(`${startToken}:${endToken}`);
            if (!range) return [];

            const r0 = Math.min(range.start.row, range.end.row);
            const r1 = Math.max(range.start.row, range.end.row);
            const c0 = Math.min(range.start.col, range.end.col);
            const c1 = Math.max(range.start.col, range.end.col);
            const items = [];

            if (targetSheetIdx === activeSheetIndex) {
                const curCols = getCurrentColumns();
                const curRows = getRowCount();
                if (c1 >= curCols) loadColumnsSync(c1 - curCols + 1);
                if (r1 >= curRows) loadRowsSync(r1 - curRows + 1);
            }

            for (let r = r0; r <= r1; r++) {
                for (let c = c0; c <= c1; c++) {
                    let v = "";
                    if (targetSheetIdx === activeSheetIndex) {
                        const cell = peekCell(r, c);
                        const vis = (cell && cell.style.display === "none") ? getVisibleCell(r, c) : cell;
                        if (vis) {
                            if (vis.dataset.formula) {
                                const evalVal = evaluateFormula(vis.dataset.formula, new Set(), activeSheetIndex);
                                v = Array.isArray(evalVal) ? "" : String(evalVal ?? "").trim();
                            } else {
                                v = String(getCellPureText(vis) ?? "").trim();
                            }
                        }
                    } else {
                        const entry = getBackgroundSheetCellMap(sheets[targetSheetIdx]).get(`${r},${c}`);
                        if (entry) {
                            if (entry.f) {
                                const evalVal = evaluateFormula(entry.f, new Set(), targetSheetIdx);
                                v = Array.isArray(evalVal) ? "" : String(evalVal ?? "").trim();
                            } else {
                                v = String(entry.v ?? "").trim();
                            }
                        }
                    }
                    if (v !== "" && !items.includes(v)) items.push(v);
                }
            }
            return items;
        }

        const src = (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2)
            ? raw.slice(1, -1)
            : raw;
        const result = [];
        let cur = "";
        let depth = 0;
        for (let i = 0; i < src.length; i++) {
            const ch = src[i];
            if (ch === "(") depth++;
            else if (ch === ")") depth = Math.max(0, depth - 1);
            if (depth === 0 && (ch === "," || ch === "、" || ch === "\r" || ch === "\n")) {
                if (cur.trim()) result.push(cur.trim());
                cur = "";
            } else {
                cur += ch;
            }
        }
        if (cur.trim()) result.push(cur.trim());
        return result;
    }

    function attachCellDropdownButton(cell) {
        if (!cell || !cell.dataset.dropdownList || isCellEditing(cell)) {
            hideCellDropdownButton();
            return;
        }
        dropdownOwnerCell = cell;
        syncCellDropdownButtonPosition();
    }

    function openCellDropdownList(cell, anchorBtn = floatingDropdownBtn) {
        closeCellDropdownList();
        if (isCellLockedForEdit?.(cell)) {
            showAlert("保護されたシート上のロックされたセルは変更できません。", "シートの保護");
            return;
        }
        const items = resolveCellDropdownItems(cell.dataset.dropdownList);
        if (!items.length) {
            showAlert("リストの候補が見つかりません。入力規則の「元の値」を確認してください。", "ドロップダウンリスト");
            return;
        }

        const cellRect = cell.getBoundingClientRect();
        const menu = document.createElement("div");
        menu.className = "ss-cell-dropdown-list";
        menu.dataset.ownerCell = `${cell.dataset.row},${cell.dataset.col}`;
        menu.style.zIndex = "2147483647";
        menu.style.left = `${Math.min(window.innerWidth - 150, Math.max(4, cellRect.left))}px`;
        menu.style.minWidth = `${Math.max(120, cellRect.width + 18)}px`;

        const estHeight = Math.min(200, items.length * 24 + 6);
        const spaceBelow = window.innerHeight - cellRect.bottom;
        const topPos = spaceBelow >= estHeight || spaceBelow >= cellRect.top
            ? Math.min(window.innerHeight - estHeight - 4, cellRect.bottom + 1)
            : Math.max(4, cellRect.top - estHeight - 1);
        menu.style.top = `${topPos}px`;

        menu.addEventListener("mousedown", (e) => e.stopPropagation());

        const currentText = getCellPureText(cell).trim();
        let activeIdx = Math.max(0, items.indexOf(currentText));
        const rowEls = [];

        const commitChoice = (itemText) => {
            cell.dataset.originalText = getCellPureText(cell);
            if (cell.dataset.formula) cell.dataset.originalFormula = cell.dataset.formula;
            else delete cell.dataset.originalFormula;

            commitCellValue(cell, itemText);
            formulaBarInput.value = itemText;
            closeCellDropdownList();
            setActiveCell(cell, true);
            updateSelectedCellsDisplay();
        };

        const highlightRow = (idx) => {
            activeIdx = (idx + rowEls.length) % rowEls.length;
            rowEls.forEach((el, i) => {
                const isSel = i === activeIdx;
                el.style.backgroundColor = isSel ? "#005a9e" : "";
                el.style.color = isSel ? "#fff" : "";
                el.style.fontWeight = items[i] === currentText ? "bold" : "";
            });
            rowEls[activeIdx]?.scrollIntoView({ block: "nearest" });
        };

        items.forEach((itemText, idx) => {
            const row = document.createElement("div");
            row.className = "ss-cell-dropdown-item";
            row.textContent = itemText;
            row.addEventListener("mouseenter", () => highlightRow(idx));
            row.addEventListener("mousedown", (e) => {
                e.preventDefault();
                e.stopPropagation();
                commitChoice(itemText);
            });
            rowEls.push(row);
            menu.appendChild(row);
        });

        document.body.appendChild(menu);
        if (anchorBtn) anchorBtn.classList.add("open");
        highlightRow(activeIdx);

        const onOutsideDown = (ev) => {
            if (!menu.contains(ev.target) && ev.target !== floatingDropdownBtn && !floatingDropdownBtn.contains(ev.target)) {
                closeCellDropdownList();
            }
        };
        const onMenuKeydown = (ev) => {
            if (ev.key === "ArrowDown") {
                ev.preventDefault();
                ev.stopPropagation();
                highlightRow(activeIdx + 1);
            } else if (ev.key === "ArrowUp") {
                ev.preventDefault();
                ev.stopPropagation();
                highlightRow(activeIdx - 1);
            } else if (ev.key === "Enter") {
                ev.preventDefault();
                ev.stopPropagation();
                commitChoice(items[activeIdx]);
            } else if (ev.key === "Escape") {
                ev.preventDefault();
                ev.stopPropagation();
                closeCellDropdownList();
                cell.focus({ preventScroll: true });
            }
        };

        document.addEventListener("mousedown", onOutsideDown, true);
        document.addEventListener("keydown", onMenuKeydown, true);
        activeDropdownCleanup = () => {
            document.removeEventListener("mousedown", onOutsideDown, true);
            document.removeEventListener("keydown", onMenuKeydown, true);
        };
    }

    let dvTooltipEl = null;
    function hideDataValidationTooltip() {
        if (dvTooltipEl) {
            dvTooltipEl.remove();
            dvTooltipEl = null;
        }
    }

    function showDataValidationTooltip(cell) {
        hideDataValidationTooltip();
        if (!cell?.dataset.dvRule) return;
        try {
            const rule = JSON.parse(cell.dataset.dvRule);
            if (rule.showPrompt === false || (!rule.promptTitle && !rule.promptMsg)) return;
            const rect = cell.getBoundingClientRect();
            dvTooltipEl = document.createElement("div");
            dvTooltipEl.className = "ss-dv-tooltip";
            const safeTitle = escapeHtml(rule.promptTitle || "");
            const safeMsg = escapeHtml(rule.promptMsg || "").replace(/\r?\n/g, "<br>");
            dvTooltipEl.innerHTML = `${safeTitle ? `<b>${safeTitle}</b><br>` : ""}${safeMsg}`;
            dvTooltipEl.style.left = `${Math.min(window.innerWidth - 270, Math.max(4, rect.left))}px`;
            dvTooltipEl.style.top = `${Math.min(window.innerHeight - 80, rect.bottom + 4)}px`;
            document.body.appendChild(dvTooltipEl);
        } catch { /* ignore */ }
    }

    function validateCellInputByRule(cell, newText) {
        if (!cell?.dataset.dvRule) return true;
        let rule;
        try { rule = JSON.parse(cell.dataset.dvRule); } catch { return true; }
        if (rule.ignoreBlank !== false && String(newText).trim() === "") return true;
        if (String(newText).trim().startsWith("=")) return true;

        let isValid = true;
        const op = rule.operator || "between";

        if (rule.type === "list") {
            const items = resolveCellDropdownItems(rule.listSpec || cell.dataset.dropdownList || "");
            if (items.length > 0) {
                const candidate = String(newText).trim();
                isValid = items.some(it => String(it).trim() === candidate);
            }
        } else if (rule.type === "integer" || rule.type === "decimal") {
            const num = parseFormattedNumber(newText);
            isValid = !isNaN(num) && (rule.type === "decimal" || Number.isInteger(num));
            if (isValid && String(rule.min ?? "").trim() !== "") {
                const v1 = parseFormattedNumber(rule.min);
                const v2 = String(rule.max ?? "").trim() !== "" ? parseFormattedNumber(rule.max) : v1;
                if (!isNaN(v1)) {
                    isValid = compareValidationValues(op, num, v1, isNaN(v2) ? v1 : v2);
                }
            }
        } else if (rule.type === "textLength") {
            const len = String(newText).length;
            if (String(rule.min ?? "").trim() !== "") {
                const v1 = Number(rule.min);
                const v2 = String(rule.max ?? "").trim() !== "" ? Number(rule.max) : v1;
                if (!isNaN(v1)) {
                    isValid = compareValidationValues(op, len, v1, isNaN(v2) ? v1 : v2);
                }
            }
        } else if (rule.type === "date") {
            const d = parseExcelDate(newText);
            const d1 = parseExcelDate(rule.min);
            const d2 = parseExcelDate(rule.max);
            if (!d) isValid = false;
            else if (d1) {
                isValid = compareValidationValues(op, d.getTime(), d1.getTime(), d2 ? d2.getTime() : d1.getTime());
            }
        } else if (rule.type === "time") {
            const t = FORMULA_FUNCTIONS.TIMEVALUE(newText);
            const t1 = FORMULA_FUNCTIONS.TIMEVALUE(rule.min);
            const t2 = FORMULA_FUNCTIONS.TIMEVALUE(rule.max);
            if (typeof t !== "number" || isNaN(t)) isValid = false;
            else if (typeof t1 === "number" && !isNaN(t1)) {
                isValid = compareValidationValues(op, t, t1, typeof t2 === "number" && !isNaN(t2) ? t2 : t1);
            }
        } else if (rule.type === "custom" && rule.formula) {
            const baseF = rule.formula.trim().startsWith("=") ? rule.formula.trim() : `=${rule.formula.trim()}`;
            const dRow = (parseInt(cell.dataset.row, 10) || 1) - (rule.baseRow || parseInt(cell.dataset.row, 10) || 1);
            const dCol = (parseInt(cell.dataset.col, 10) || 0) - (rule.baseCol ?? parseInt(cell.dataset.col, 10) ?? 0);
            const f = (dRow !== 0 || dCol !== 0) ? adjustFormula(baseF, dRow, dCol) : baseF;

            const hadRaw = Object.prototype.hasOwnProperty.call(cell.dataset, "rawValue");
            const prevRaw = cell.dataset.rawValue;
            const hadFormula = Object.prototype.hasOwnProperty.call(cell.dataset, "formula");
            const prevFormula = cell.dataset.formula;
            const prevDisplayText = getCellPureText(cell);
            const prevRichRuns = cell.dataset.richRuns;
            try {
                delete cell.dataset.formula;
                delete cell.dataset.richRuns;
                cell.dataset.rawValue = String(newText);
                setCellTextPreservingControls(cell, String(newText));
                clearFormulaEvalCache();
                const res = evaluateFormula(f, new Set(), getActiveSheetIndex(), {
                    row: parseInt(cell.dataset.row, 10) || 1,
                    col: parseInt(cell.dataset.col, 10) || 0
                });
                isValid = res === true || res === 1 || String(res ?? "").trim().toUpperCase() === "TRUE";
            } finally {
                if (hadFormula) cell.dataset.formula = prevFormula;
                else delete cell.dataset.formula;
                if (hadRaw) cell.dataset.rawValue = prevRaw;
                else delete cell.dataset.rawValue;
                if (prevRichRuns !== undefined) cell.dataset.richRuns = prevRichRuns;
                else delete cell.dataset.richRuns;
                setCellTextPreservingControls(
                    cell,
                    formatDisplayByNumFmt(prevDisplayText, cell.dataset.numFormat, cell)
                );
                clearFormulaEvalCache();
            }
        }
        if (!isValid && rule.showError !== false) {
            const style = rule.errorStyle || "stop";
            const title = rule.errorTitle || "";
            const msg = rule.errorMsg || "この値は、このセルに定義されているデータ入力規則の制限を満たしていません。";

            if (style === "info") {
                showDataValidationDialog({ style: "info", title, message: msg });
                return true;
            }
            if (style === "warning") {
                showDataValidationDialog({
                    style: "warning",
                    title,
                    message: `${msg}\n\nこの値を入力して続行しますか？`,
                    onConfirm: (ok) => {
                        if (!ok) return;
                        const prevRule = cell.dataset.dvRule;
                        delete cell.dataset.dvRule;
                        try {
                            commitCellValue(cell, newText);
                        } finally {
                            if (prevRule !== undefined) cell.dataset.dvRule = prevRule;
                        }
                        if (getActiveCell() === cell) {
                            formulaBarInput.value = cell.dataset.formula || (cell.dataset.rawValue ?? cell.textContent);
                        }
                        updateSelectedCellsDisplay();
                    }
                });
                return false;
            }
            showDataValidationDialog({ style: "stop", title, message: msg });
            return false;
        }
        return true;
    }

    async function activateCellHyperlink(cell) {
        const target = extractHyperlinkTarget(cell);
        if (!target) return false;

        // シート内・他シートセルへのジャンプ（例: #A1 / #Sheet2!B5 / #'売上'!C3）
        if (target.startsWith("#")) {
            const ref = target.slice(1).trim();
            const m = ref.match(/^(?:(?:'([^']+)'|([A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+))!)?\$?([A-Za-z]+)\$?(\d+)$/);
            if (!m) {
                showAlert(`無効なセル参照リンクです: ${target}`, "ハイパーリンク");
                return true;
            }
            const sheetName = m[1] ?? m[2];
            if (sheetName) {
                const sheets = getSheets();
                const sIdx = sheets.findIndex(s => s.name === sheetName);
                if (sIdx === -1) {
                    showAlert(`シート「${sheetName}」が見つかりません。`, "ハイパーリンク");
                    return true;
                }
                if (sIdx !== getActiveSheetIndex()) await switchToSheet(sIdx);
            }
            navigateToCell(parseInt(m[4], 10), columnLettersToIndex(m[3]));
            return true;
        }

        // 外部URL・メールリンク（安全なスキームのみ許可）
        if (/^(https?:\/\/|mailto:)/i.test(target)) {
            window.open(target, "_blank", "noopener,noreferrer");
            return true;
        }
        showAlert(`サポートされていないリンク形式です:\n${target}\n（https://... または #Sheet1!A1 形式で指定してください）`, "ハイパーリンク");
        return true;
    }

    function openHyperlinkDialog() {
        const activeCell = getActiveCell();
        if (!activeCell) return;
        if (isCellLockedForEdit?.(activeCell)) {
            showAlert("保護されたシート上のロックされたセルにはハイパーリンクを設定できません。", "シートの保護");
            return;
        }
        flushPendingEdits();
        const curLink = activeCell.dataset.hyperlink || "";
        const curLabel = activeCell.dataset.rawValue ?? activeCell.textContent ?? "";

        const bodyHtml = `
            <div style="width:100%; display:flex; flex-direction:column; gap:8px; font-size:12px;">
                <label>表示文字列:
                    <input type="text" class="ss-hl-label border" value="${escapeHtml(curLabel)}" placeholder="セルに表示するテキスト" style="width:100%; height:24px; margin-top:2px; padding:2px 6px; background:#fff; color:#000;">
                </label>
                <label>リンク先（URL または #シート名!セル番地）:
                    <input type="text" class="ss-hl-url border" value="${escapeHtml(curLink)}" placeholder="例: https://example.com または #Sheet2!A1" style="width:100%; height:24px; margin-top:2px; padding:2px 6px; background:#fff; color:#000;">
                </label>
                <div style="font-size:11px; color:#555;">※ 設定したセルは <b>Ctrl + クリック</b> または右クリックメニューから開けます。</div>
            </div>
        `;
        const modalContent = openAppModal("ハイパーリンクの挿入・編集", bodyHtml, {
            width: 420,
            isHtml: true,
            buttons: [
                {
                    label: "OK",
                    onClick: () => {
                        const url = modalContent.querySelector(".ss-hl-url")?.value.trim() || "";
                        const label = modalContent.querySelector(".ss-hl-label")?.value ?? "";
                        if (!url) {
                            delete activeCell.dataset.hyperlink;
                            activeCell.classList.remove("ss-hyperlink");
                            activeCell.removeAttribute("title");
                        } else {
                            activeCell.dataset.hyperlink = url;
                            activeCell.classList.add("ss-hyperlink");
                            activeCell.title = `${url}（Ctrl+クリックで開く）`;
                            if (!activeCell.dataset.formula) {
                                setCellFormattedValue(activeCell, label || url);
                            }
                        }
                        setDirtyState(true);
                        debouncedSaveState();
                    }
                },
                {
                    label: "リンクの解除",
                    onClick: () => {
                        delete activeCell.dataset.hyperlink;
                        activeCell.classList.remove("ss-hyperlink");
                        activeCell.removeAttribute("title");
                        setDirtyState(true);
                        debouncedSaveState();
                    }
                },
                { label: "キャンセル" }
            ]
        });
        modalContent?.querySelector(".ss-hl-url")?.focus();
    }

    function openDataValidationDialog() {
        const activeCell = getActiveCell();
        const selected = Array.from(tbody.querySelectorAll("td.selected")).filter(td => td.style.display !== "none");
        const targets = selected.length ? selected : (activeCell ? [activeCell] : []);
        if (!targets.length) return;
        if (isCurrentSheetProtected?.() && targets.some(td => isCellLockedForEdit?.(td))) {
            showAlert("保護されたシート上のロックされたセルの入力規則は変更できません。", "シートの保護");
            return;
        }
        let cur = {
            type: targets[0].dataset.dropdownList ? "list" : "any",
            operator: "between",
            listSpec: targets[0].dataset.dropdownList || "",
            min: "",
            max: "",
            formula: "",
            ignoreBlank: true,
            inCellDropdown: true,
            showPrompt: true,
            promptTitle: "",
            promptMsg: "",
            showError: true,
            errorStyle: "stop",
            errorTitle: "",
            errorMsg: ""
        };
        if (targets[0].dataset.dvRule) {
            try { cur = { ...cur, ...JSON.parse(targets[0].dataset.dvRule) }; } catch { /* ignore */ }
        }

        const isRangeType = ["integer", "decimal", "date", "time", "textLength"].includes(cur.type);
        const isTwoValOp = ["between", "notBetween"].includes(cur.operator);

        const bodyHtml = `
            <div style="width:100%; display:flex; flex-direction:column; gap:6px; font-size:12px;">
                <div class="ss-xl-tabs">
                    <div class="ss-xl-tab active" data-dv-tab="settings">設定</div>
                    <div class="ss-xl-tab" data-dv-tab="prompt">入力時メッセージ</div>
                    <div class="ss-xl-tab" data-dv-tab="error">エラー メッセージ</div>
                </div>

                <!-- タブ1: 設定 -->
                <div class="ss-xl-tabpanel active" data-dv-panel="settings">
                    <fieldset style="border:1px solid #808080; padding:8px; margin:0; display:flex; flex-direction:column; gap:7px;">
                        <legend style="padding:0 4px;">条件の設定</legend>
                        <div style="display:flex; gap:10px; align-items:flex-start;">
                            <div style="flex:1; display:flex; flex-direction:column; gap:6px;">
                                <label>入力値の種類(A):
                                    <select class="ss-dv-type border" style="width:100%; height:24px; margin-top:2px; background:#fff; color:#000;">
                                        <option value="any" ${cur.type === "any" ? "selected" : ""}>すべての値</option>
                                        <option value="integer" ${cur.type === "integer" ? "selected" : ""}>整数</option>
                                        <option value="decimal" ${cur.type === "decimal" ? "selected" : ""}>小数点数</option>
                                        <option value="list" ${cur.type === "list" ? "selected" : ""}>リスト</option>
                                        <option value="date" ${cur.type === "date" ? "selected" : ""}>日付</option>
                                        <option value="time" ${cur.type === "time" ? "selected" : ""}>時刻</option>
                                        <option value="textLength" ${cur.type === "textLength" ? "selected" : ""}>文字列(長さ指定)</option>
                                        <option value="custom" ${cur.type === "custom" ? "selected" : ""}>ユーザー設定</option>
                                    </select>
                                </label>

                                <label class="ss-dv-op-wrap" style="display:${isRangeType ? "block" : "none"};">データ(D):
                                    <select class="ss-dv-op border" style="width:100%; height:24px; margin-top:2px; background:#fff; color:#000;">
                                        <option value="between" ${cur.operator === "between" ? "selected" : ""}>次の値の間</option>
                                        <option value="notBetween" ${cur.operator === "notBetween" ? "selected" : ""}>次の値の間以外</option>
                                        <option value="=" ${cur.operator === "=" ? "selected" : ""}>次の値に等しい</option>
                                        <option value="<>" ${cur.operator === "<>" ? "selected" : ""}>次の値に等しくない</option>
                                        <option value=">" ${cur.operator === ">" ? "selected" : ""}>次の値より大きい</option>
                                        <option value="<" ${cur.operator === "<" ? "selected" : ""}>次の値より小さい</option>
                                        <option value=">=" ${cur.operator === ">=" ? "selected" : ""}>次の値以上</option>
                                        <option value="<=" ${cur.operator === "<=" ? "selected" : ""}>次の値以下</option>
                                    </select>
                                </label>

                                <div class="ss-dv-list-box" style="display:${cur.type === "list" ? "flex" : "none"}; flex-direction:column; gap:3px;">
                                    <label>元の値(S):</label>
                                    <div style="display:flex; gap:4px; align-items:center;">
                                        <input type="text" class="ss-dv-list-input border" value="${(cur.listSpec || "").replace(/"/g, "&quot;")}" placeholder="例: 未着手,進行中,完了 または =$A$1:$A$5" style="flex:1; min-width:0; height:24px; padding:2px 5px; background:#fff; color:#000;">
                                        <button type="button" class="button ss-dv-pick-range-btn" title="シート上をドラッグしてセル範囲を選択" style="height:24px; padding:0 7px; flex-shrink:0;">📍範囲選択</button>
                                    </div>
                                </div>

                                <div class="ss-dv-minmax-box" style="display:${isRangeType ? "flex" : "none"}; flex-direction:column; gap:5px;">
                                    <label><span class="ss-dv-v1-label">${isTwoValOp ? "最小値(M):" : "値(V):"}</span>
                                        <input type="text" class="ss-dv-min border" value="${escapeHtml(cur.min)}" style="width:100%; height:24px; margin-top:2px; padding:2px 5px; background:#fff; color:#000;">
                                    </label>
                                    <label class="ss-dv-v2-wrap" style="display:${isTwoValOp ? "block" : "none"};">最大値(X):
                                        <input type="text" class="ss-dv-max border" value="${escapeHtml(cur.max)}" style="width:100%; height:24px; margin-top:2px; padding:2px 5px; background:#fff; color:#000;">
                                    </label>
                                </div>

                                <div class="ss-dv-custom-box" style="display:${cur.type === "custom" ? "flex" : "none"}; flex-direction:column; gap:3px;">
                                    <label>数式(F):</label>
                                    <input type="text" class="ss-dv-formula border" value="${(cur.formula || "").replace(/"/g, "&quot;")}" placeholder="例: =A1>0" style="width:100%; height:24px; padding:2px 5px; background:#fff; color:#000;">
                                </div>
                            </div>

                            <div style="display:flex; flex-direction:column; gap:8px; padding-top:16px; min-width:175px;">
                                <label style="display:inline-flex; align-items:center; gap:4px; cursor:pointer;">
                                    <input type="checkbox" class="ss-dv-ignoreblank" ${cur.ignoreBlank !== false ? "checked" : ""}> 空白を無視する(B)
                                </label>
                                <label class="ss-dv-dropdown-chk-wrap" style="display:${cur.type === "list" ? "inline-flex" : "none"}; align-items:center; gap:4px; cursor:pointer;">
                                    <input type="checkbox" class="ss-dv-incell" ${cur.inCellDropdown !== false ? "checked" : ""}> ドロップダウンリストから選択する(I)
                                </label>
                            </div>
                        </div>
                    </fieldset>
                    <label style="display:inline-flex; align-items:center; gap:5px; cursor:pointer;">
                        <input type="checkbox" class="ss-dv-apply-same"> 同じ入力規則が設定されたすべてのセルに変更を適用する(P)
                    </label>
                </div>

                <!-- タブ2: 入力時メッセージ -->
                <div class="ss-xl-tabpanel" data-dv-panel="prompt">
                    <label style="display:inline-flex; align-items:center; gap:5px; cursor:pointer;">
                        <input type="checkbox" class="ss-dv-showprompt" ${cur.showPrompt !== false ? "checked" : ""}> セルの選択時にメッセージを表示する(S)
                    </label>
                    <fieldset style="border:1px solid #808080; padding:8px; margin:0; display:flex; flex-direction:column; gap:6px;">
                        <legend style="padding:0 4px;">セルの選択時に表示するメッセージ</legend>
                        <label>タイトル(T):
                            <input type="text" class="ss-dv-ptitle border" value="${(cur.promptTitle || "").replace(/"/g, "&quot;")}" style="width:100%; height:24px; margin-top:2px; padding:2px 5px; background:#fff; color:#000;">
                        </label>
                        <label>入力時メッセージ(I):
                            <textarea class="ss-dv-pmsg border" rows="4" style="width:100%; margin-top:2px; padding:4px; background:#fff; color:#000; resize:none;">${escapeHtml(cur.promptMsg || "")}</textarea>
                        </label>
                    </fieldset>
                </div>

                <!-- タブ3: エラーメッセージ -->
                <div class="ss-xl-tabpanel" data-dv-panel="error">
                    <label style="display:inline-flex; align-items:center; gap:5px; cursor:pointer;">
                        <input type="checkbox" class="ss-dv-showerror" ${cur.showError !== false ? "checked" : ""}> 無効なデータが入力されたらエラー メッセージを表示する(S)
                    </label>
                    <div style="display:flex; gap:10px; align-items:flex-start;">
                        <div style="width:120px; display:flex; flex-direction:column; gap:6px;">
                            <label>スタイル(Y):
                                <select class="ss-dv-estyle border" style="width:100%; height:24px; margin-top:2px; background:#fff; color:#000;">
                                    <option value="stop" ${cur.errorStyle === "stop" ? "selected" : ""}>停止</option>
                                    <option value="warning" ${cur.errorStyle === "warning" ? "selected" : ""}>注意</option>
                                    <option value="info" ${cur.errorStyle === "info" ? "selected" : ""}>情報</option>
                                </select>
                            </label>
                            <div class="ss-dv-eicon" style="font-size:24px; text-align:center; padding:6px;">${cur.errorStyle === "warning" ? "⚠️" : cur.errorStyle === "info" ? "ℹ️" : "❌"}</div>
                        </div>
                        <div style="flex:1; display:flex; flex-direction:column; gap:6px;">
                            <label>タイトル(T):
                                <input type="text" class="ss-dv-etitle border" value="${(cur.errorTitle || "").replace(/"/g, "&quot;")}" style="width:100%; height:24px; margin-top:2px; padding:2px 5px; background:#fff; color:#000;">
                            </label>
                            <label>エラー メッセージ(E):
                                <textarea class="ss-dv-emsg border" rows="4" style="width:100%; margin-top:2px; padding:4px; background:#fff; color:#000; resize:none;">${escapeHtml(cur.errorMsg || "")}</textarea>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const modalContent = openAppModal("データの入力規則", bodyHtml, {
            width: 460,
            isHtml: true,
            parentWin: win,
            buttons: [
                {
                    label: "すべてクリア(C)",
                    closeOnClick: false,
                    onClick: () => {
                        modalContent.querySelector(".ss-dv-type").value = "any";
                        modalContent.querySelector(".ss-dv-type").dispatchEvent(new Event("change"));
                        modalContent.querySelector(".ss-dv-list-input").value = "";
                        modalContent.querySelector(".ss-dv-min").value = "";
                        modalContent.querySelector(".ss-dv-max").value = "";
                        modalContent.querySelector(".ss-dv-formula").value = "";
                        modalContent.querySelector(".ss-dv-ptitle").value = "";
                        modalContent.querySelector(".ss-dv-pmsg").value = "";
                        modalContent.querySelector(".ss-dv-etitle").value = "";
                        modalContent.querySelector(".ss-dv-emsg").value = "";
                    }
                },
                {
                    label: "OK",
                    onClick: () => {
                        const type = modalContent.querySelector(".ss-dv-type").value;
                        const operator = modalContent.querySelector(".ss-dv-op").value;
                        const listSpec = modalContent.querySelector(".ss-dv-list-input").value.trim();
                        const min = modalContent.querySelector(".ss-dv-min").value.trim();
                        const max = modalContent.querySelector(".ss-dv-max").value.trim();
                        const formula = modalContent.querySelector(".ss-dv-formula").value
                            .trim()
                            .replace(/[“”″]/g, '"');
                        const ignoreBlank = modalContent.querySelector(".ss-dv-ignoreblank").checked;
                        const inCellDropdown = modalContent.querySelector(".ss-dv-incell").checked;
                        const showPrompt = modalContent.querySelector(".ss-dv-showprompt").checked;
                        const promptTitle = modalContent.querySelector(".ss-dv-ptitle").value.trim();
                        const promptMsg = modalContent.querySelector(".ss-dv-pmsg").value.trim();
                        const showError = modalContent.querySelector(".ss-dv-showerror").checked;
                        const errorStyle = modalContent.querySelector(".ss-dv-estyle").value;
                        const errorTitle = modalContent.querySelector(".ss-dv-etitle").value.trim();
                        const errorMsg = modalContent.querySelector(".ss-dv-emsg").value.trim();
                        const applySame = modalContent.querySelector(".ss-dv-apply-same").checked;

                        const origRuleStr = targets[0].dataset.dvRule || "";
                        const applyTargets = new Set(targets);
                        if (applySame && origRuleStr) {
                            tbody.querySelectorAll("td").forEach(td => {
                                if (td.dataset.dvRule === origRuleStr) applyTargets.add(td);
                            });
                        }

                        applyTargets.forEach(td => {
                            if (type === "any" && !promptTitle && !promptMsg) {
                                delete td.dataset.dropdownList;
                                delete td.dataset.dvRule;
                                delete td.dataset.hasDropdown;
                            } else {
                                if (type === "list" && listSpec && inCellDropdown) {
                                    td.dataset.dropdownList = listSpec;
                                } else {
                                    delete td.dataset.dropdownList;
                                    delete td.dataset.hasDropdown;
                                }
                                const baseRow = parseInt(targets[0].dataset.row, 10) || 1;
                                const baseCol = parseInt(targets[0].dataset.col, 10) || 0;
                                td.dataset.dvRule = JSON.stringify({
                                    type, operator, listSpec, min, max, formula,
                                    baseRow, baseCol,
                                    ignoreBlank, inCellDropdown,
                                    showPrompt, promptTitle, promptMsg,
                                    showError, errorStyle, errorTitle, errorMsg
                                });
                            }
                        });

                        const curActive = getActiveCell();
                        if (curActive) setActiveCell(curActive, true);
                        setDirtyState(true);
                        debouncedSaveState();
                    }
                },
                { label: "キャンセル" }
            ]
        });

        // タブ切替
        modalContent.querySelectorAll(".ss-xl-tab").forEach(tab => {
            tab.addEventListener("click", () => {
                const name = tab.dataset.dvTab;
                modalContent.querySelectorAll(".ss-xl-tab").forEach(t => t.classList.toggle("active", t === tab));
                modalContent.querySelectorAll(".ss-xl-tabpanel").forEach(p => p.classList.toggle("active", p.dataset.dvPanel === name));
            });
        });

        // 入力値の種類変更時の動的UI切替
        const typeSel = modalContent.querySelector(".ss-dv-type");
        const opSel = modalContent.querySelector(".ss-dv-op");
        const opWrap = modalContent.querySelector(".ss-dv-op-wrap");
        const listBox = modalContent.querySelector(".ss-dv-list-box");
        const minmaxBox = modalContent.querySelector(".ss-dv-minmax-box");
        const customBox = modalContent.querySelector(".ss-dv-custom-box");
        const ddChkWrap = modalContent.querySelector(".ss-dv-dropdown-chk-wrap");
        const v1Label = modalContent.querySelector(".ss-dv-v1-label");
        const v2Wrap = modalContent.querySelector(".ss-dv-v2-wrap");

        const syncOpFields = () => {
            const two = ["between", "notBetween"].includes(opSel.value);
            v1Label.textContent = two ? "最小値(M):" : "値(V):";
            v2Wrap.style.display = two ? "block" : "none";
        };

        typeSel.addEventListener("change", () => {
            const v = typeSel.value;
            const range = ["integer", "decimal", "date", "time", "textLength"].includes(v);
            opWrap.style.display = range ? "block" : "none";
            minmaxBox.style.display = range ? "flex" : "none";
            listBox.style.display = v === "list" ? "flex" : "none";
            ddChkWrap.style.display = v === "list" ? "inline-flex" : "none";
            customBox.style.display = v === "custom" ? "flex" : "none";
            syncOpFields();
        });
        opSel.addEventListener("change", syncOpFields);

        // エラースタイルアイコン更新
        const estyleSel = modalContent.querySelector(".ss-dv-estyle");
        const eiconEl = modalContent.querySelector(".ss-dv-eicon");
        estyleSel.addEventListener("change", () => {
            eiconEl.textContent = estyleSel.value === "warning" ? "⚠️" : estyleSel.value === "info" ? "ℹ️" : "❌";
        });

        // 共通ピッカーでシート上からセル範囲を選択
        const pickRangeBtn = modalContent.querySelector(".ss-dv-pick-range-btn");
        const listInputEl = modalContent.querySelector(".ss-dv-list-input");
        pickRangeBtn?.addEventListener("click", () => {
            openSheetRangePicker({
                modalContent,
                targetInput: listInputEl,
                label: "元の値の範囲を選択:"
            });
        });
    }

    document.addEventListener("mousedown", (e) => {
        if (!e.target.closest(".ss-cell-dropdown-list, .ss-cell-dropdown-btn")) {
            closeCellDropdownList();
        }
    }, { signal });

    return {
        hideCellDropdownButton,
        temporarilyHideDropdownButtonOnScroll,
        restoreDropdownButtonAfterScroll,
        syncCellDropdownButtonPosition,
        closeCellDropdownList,
        attachCellDropdownButton,
        openCellDropdownList,
        hideDataValidationTooltip,
        showDataValidationTooltip,
        validateCellInputByRule,
        extractHyperlinkTarget,
        activateCellHyperlink,
        openHyperlinkDialog,
        openDataValidationDialog
    };
}