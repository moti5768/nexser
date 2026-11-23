//spreadsheet.js
import { resolveFS, basename } from "../../../fs-utils.js";
import { hideContextMenu } from "../../../context-menu.js";
import { injectScopedStyles } from "./styles.js";
import { SPREADSHEET_TEMPLATE_HTML } from "./template.js";
import {
    EXCEL_EPOCH_MS,
    dateToSerial,
    serialToDate,
    tryParseDateToSerial,
    parseJapaneseDateInput,
    EXCEL_BLANK_CELL,
    unwrapBlank,
    isBlankVal,
    excelEquals,
    excelOpEquals,
    parseExcelDate,
    flattenArray,
    to2DArray,
    coerceExcelNum,
    excelUnaryOp,
    excelBinaryOp,
    buildWildcardRegex,
    buildConditionMatcher,
    EXCEL_ERROR_RE,
    collectNumericValues,
    collectLogicalValues,
    FORMULA_FUNCTIONS,
    FORMULA_FN_NAMES,
    FORMULA_FN_VALUES
} from "./formula-functions.js";
import {
    DEFAULT_COL_WIDTH,
    DEFAULT_ROW_HEIGHT,
    DEFAULT_HEADER_HEIGHT,
    DEFAULT_ROW_HEADER_WIDTH,
    DEFAULT_FONT_FAMILY,
    DEFAULT_FONT_SIZE_PT,
    DEFAULT_FONT_SIZE_CSS,
    cssFontSizeToPx,
    cssFontSizeToPt,
    escapeHtml,
    getColumnName,
    columnLettersToIndex,
    getCellReference,
    getCellReferenceByCoord,
    isDateNumFormat,
    isTimeNumFormat,
    parseTimeInput,
    formatTimeFromSerial,
    isDateFormat,
    formatDate,
    resolveDateFromRawValue,
    resolveCustomPatternColor,
    preprocessAllNestedIFs,
    parseCellNumericLiteral,
    parseFormattedNumber,
    formatByCustomPattern,
    formatDisplayByNumFmt,
    updateCellAutoAlignment,
    setCellTextPreservingControls
} from "./format-utils.js";
import {
    EXCEL_CF_PRESET_STYLES,
    describeConditionalRule,
    matchDatePeriod,
    clearAppliedConditionalStyle,
    createConditionalFormattingModule
} from "./conditional-format.js";
import {
    unwrapOverflowSpan,
    wrapOverflowSpan,
    createTextOverflowModule
} from "./text-overflow.js";
import { createFormatDialogsModule } from "./format-dialogs.js";
import {
    splitTextWithDelimiters,
    createDataToolsModule
} from "./data-tools.js";
import { createChartsModule } from "./charts.js";
import { createFindReplaceModule } from "./find-replace.js";
import {
    parseCellReference,
    parseRangeReference,
    createFormulaRefOverlayModule
} from "./formula-ref-overlay.js";
import { createPrintManagerModule } from "./print-manager.js";
import { createTouchScrollModule } from "./touch-scroll.js";
import { registerContextMenus } from "./context-menus.js";
import { createAutoFilterModule } from "./auto-filter.js";
import { createStructuredTableModule } from "./structured-table.js";
import { createRowColOpsModule } from "./row-col-ops.js";
import { createDataValidationModule } from "./data-validation.js";
import { createClipboardModule } from "./clipboard.js";
import { createRangeMoveModule } from "./range-move.js";
import { createFormulaEngineModule } from "./formula-engine.js";
import { createFileIOModule } from "./file-io.js";
import { createAutoFillModule } from "./autofill.js";
import { createSlicerModule } from "./slicer.js";

// =========================================================
// メインアプリケーション エントリーポイント
// =========================================================
export default async function initSpreadsheetApp(content, options = {}) {
    injectScopedStyles();

    const win = content.closest(".window");
    const windowAPI = window.nexser?.windowAPI;
    const syscall = options.syscall || null;
    const lockOwnerPid = syscall?.pid ? `pid:${syscall.pid}` : `ss_${Date.now()}_${Math.random()}`;

    if (win && !win.dataset.maximizedInitialized) {
        win.style.width = options.width || "920px";
        win.style.height = options.height || "620px";
        win.dataset.maximizedInitialized = "true";
    }

    const abortController = new AbortController();
    const { signal } = abortController;

    content.style.padding = "0";
    content.style.overflow = "hidden";
    content.style.display = "flex";
    content.style.flexDirection = "column";
    content.style.flex = "1 1 auto";
    content.style.width = "100%";
    content.style.height = "100%";
    content.style.minWidth = "0";
    content.style.minHeight = "0";

    content.innerHTML = SPREADSHEET_TEMPLATE_HTML;

    // =========================================================
    // スコープ内要素参照と状態変数
    // =========================================================
    const appRoot = content.querySelector(".nexser-spreadsheet-app");
    const container = appRoot.querySelector(".ss-spreadsheet-container");
    const spreadsheetContent = appRoot.querySelector(".ss-spreadsheet-content");
    const table = appRoot.querySelector(".ss-table");
    const colgroup = table.querySelector("colgroup");
    const theadRow = table.querySelector("thead tr");
    const tbody = table.querySelector("tbody");
    const formulaBarInput = appRoot.querySelector(".ss-formula-bar");
    const selectedCellsDisplay = appRoot.querySelector(".ss-selected-cells-display");

    const statusBarState = {
        stateText: "準備完了",
        selectionText: "Ready",
        storageText: ""
    };

    function renderWindowStatusBar() {
        if (!win?._statusBar) return;
        const curPath = getCurrentFilePath();
        const fileName = curPath ? basename(curPath) : "無題.nxs";
        const dirtyMark = isDirty ? " *" : "";
        const parts = [
            `状態: ${statusBarState.stateText}`,
            statusBarState.selectionText,
            `ファイル: ${fileName}${dirtyMark}`,
            `用紙: ${getPageSize()}`
        ];
        if (statusBarState.storageText) {
            parts.push(statusBarState.storageText);
        }
        win._statusBar.textContent = parts.join("  |  ");
    }
    const zoomSlider = appRoot.querySelector(".ss-zoom-slider");
    const zoomDisplay = appRoot.querySelector(".ss-zoom-display");

    // ウィンドウ幅が狭いときのみアクティブなリボンを自動フィット（高さ固定＆プルダウン切れ防止）
    const ribbonPanelsEl = appRoot.querySelector(".ss-ribbon-panels");
    function fitActiveRibbonPanel() {
        if (!ribbonPanelsEl) return;
        const activePanel = ribbonPanelsEl.querySelector(".ss-ribbon-panel.active");
        if (!activePanel) return;
        activePanel.style.zoom = "";
        const availW = ribbonPanelsEl.clientWidth - 8;
        const naturalW = activePanel.scrollWidth;
        if (availW > 0 && naturalW > availW) {
            activePanel.style.zoom = String(Math.max(0.7, availW / naturalW));
        }
    }
    if (ribbonPanelsEl && typeof ResizeObserver !== "undefined") {
        const ribbonResizeObserver = new ResizeObserver(() => fitActiveRibbonPanel());
        ribbonResizeObserver.observe(ribbonPanelsEl);
        signal.addEventListener("abort", () => ribbonResizeObserver.disconnect(), { once: true });
    }
    appRoot.querySelectorAll(".ss-ribbon-tab[data-ribbon-tab]").forEach(tab => {
        tab.addEventListener("click", () => requestAnimationFrame(fitActiveRibbonPanel), { signal });
    });
    requestAnimationFrame(fitActiveRibbonPanel);

    const INITIAL_ROWS = 100;
    const ROW_BATCH = 40;
    const INITIAL_COLUMNS = 40;
    const COLUMN_BATCH = 15;

    let currentColumns = 0;
    let rowCount = 1;
    let activeCell = null;
    let isSelecting = false;
    let selectionStart = null;
    let selectionEnd = null;
    let isCtrlMultiSelecting = false;
    let multiSelectionBaseCells = null;
    let ctrlDeselectCandidate = null;
    let isComposing = false;
    let formatPainterSnapshot = null;

    // 状態フラグ
    let isDirty = false;
    let freezeRows = 0;
    let freezeCols = 0;
    let showFormulasMode = false;

    const timers = new Set();
    function managedTimeout(fn, delay) {
        const id = setTimeout(() => {
            timers.delete(id);
            fn();
        }, delay);
        timers.add(id);
        return id;
    }

    function clearManagedTimeout(id) {
        if (id != null) {
            clearTimeout(id);
            timers.delete(id);
        }
    }

    function setDirtyState(dirty) {
        isDirty = Boolean(dirty);
        const curPath = getCurrentFilePath();
        const titleBase = curPath ? basename(curPath) : "無題.nxs";
        if (win && windowAPI?.updateWindowTitle) {
            windowAPI.updateWindowTitle(win, titleBase, isDirty);
        }
        renderWindowStatusBar();
    }

    function setWindowBusyLock(isBusy, statusLabel = "") {
        if (statusLabel) {
            statusBarState.stateText = statusLabel;
            renderWindowStatusBar();
        }
        if (win && windowAPI?.toggleWindowControl) {
            windowAPI.toggleWindowControl(win, "close", !isBusy);
        }
        if (!isBusy) {
            windowAPI?.refreshTopWindow?.();
        }
    }

    function updateOSStatusBar(text) {
        statusBarState.selectionText = text;
        renderWindowStatusBar();
    }

    const {
        openFindReplaceDialog,
        isFindDialogFocused,
        syncFindDialogVisibility,
        destroyFindDialog
    } = createFindReplaceModule({
        win,
        windowAPI,
        signal,
        tbody,
        getActiveCell: () => activeCell,
        isCurrentSheetProtected: () => isCurrentSheetProtected(),
        isCellLockedForEdit: (cell) => isCellLockedForEdit(cell),
        hasAutoFilters: () => hasAutoFilters(),
        applyAutoFilterRows: () => applyAutoFilterRows(),
        showAlert: (...args) => showAlert(...args),
        openAppModal: (...args) => openAppModal(...args),
        restoreMainWindowFocus: () => restoreMainWindowFocus(),
        flushPendingEdits: () => flushPendingEdits(),
        setCellFormattedValue: (cell, val) => setCellFormattedValue(cell, val),
        clearSelection: () => clearSelection(),
        setActiveCell: (cell, shouldFocus) => setActiveCell(cell, shouldFocus),
        updateAllFormulas: () => updateAllFormulas(),
        updateFillHandle: () => updateFillHandle(),
        updateSelectedCellsDisplay: () => updateSelectedCellsDisplay(),
        setDirtyState: (flag) => setDirtyState(flag),
        debouncedSaveState: (delay) => debouncedSaveState(delay)
    });

    function isAppFocused() {
        const overlays = Array.from(document.querySelectorAll(".modal-overlay"));
        const hasBlockingOverlay = overlays.some(ov =>
            ov.style.display !== "none" &&
            ov.style.visibility !== "hidden" &&
            ov.style.pointerEvents !== "none"
        );
        if (hasBlockingOverlay) return false;

        if (Array.from(document.querySelectorAll(".window")).some(w =>
            w._modal &&
            w.dataset.ssToolWindow !== "true" &&
            w.style.visibility !== "hidden" &&
            w.dataset.minimized !== "true" &&
            w.dataset.backgroundClickable !== "true"
        )) {
            return false;
        }
        if (!win) return true;
        if (isFindDialogFocused()) return false;
        if (win.contains(document.activeElement)) return true;
        if (win.classList.contains("inactive-window")) return false;
        return true;
    }

    // =========================================================
    // 複数タブ（ワークシート）管理
    // =========================================================
    const sheetTabsListEl = appRoot.querySelector(".ss-sheet-tabs-list");
    const sheetAddBtn = appRoot.querySelector(".ss-sheet-add-btn");
    let sheetIdCounter = 0;
    let sheets = [];
    let activeSheetIndex = 0;

    function generateUniqueSheetName(basePrefix = "Sheet") {
        let num = sheets.length + 1;
        while (sheets.some(s => s.name === `${basePrefix}${num}`)) {
            num++;
        }
        return `${basePrefix}${num}`;
    }

    function createBlankSheetModel(name = null) {
        return {
            id: `sheet_${++sheetIdCounter}`,
            name: name || generateUniqueSheetName("Sheet"),
            cells: [],
            rows: [],
            columns: [],
            zoom: 100,
            pageSize: "A4",
            printOptions: { orientation: "portrait", fitToWidth: true, showGridlines: false },
            freezeRows: 0,
            freezeCols: 0,
            textboxes: [],
            slicers: [],
            conditionalFormats: [],
            protected: false,
            activeCoord: { row: 1, col: 0 },
            scrollTop: 0,
            scrollLeft: 0
        };
    }

    function isCurrentSheetProtected() {
        return Boolean(sheets[activeSheetIndex]?.protected);
    }

    function isCellLockedForEdit(cell) {
        if (!isCurrentSheetProtected() || !cell) return false;
        return cell.dataset.locked !== "0";
    }

    function syncSheetProtectionUI() {
        const prot = isCurrentSheetProtected();
        const btn = appRoot.querySelector(".ss-protect-sheet-btn");
        if (btn) {
            btn.classList.toggle("selected", prot);
            const lbl = btn.querySelector(".ss-btn-lbl");
            if (lbl) lbl.innerHTML = prot ? "保護<br>解除" : "シート<br>保護";
        }
        const menuItem = appRoot.querySelector(".ss-protect-sheet-menu-item");
        if (menuItem) {
            menuItem.textContent = prot ? "🔓 シート保護の解除" : "🔒 シートの保護...";
        }
    }

    function toggleCurrentSheetProtection() {
        if (!sheets[activeSheetIndex]) return;
        flushPendingEdits();
        sheets[activeSheetIndex].protected = !sheets[activeSheetIndex].protected;
        syncSheetProtectionUI();
        if (activeCell) setActiveCell(activeCell, false);
        statusBarState.stateText = sheets[activeSheetIndex].protected
            ? "シートを保護しました（ロックされたセルは編集不可）"
            : "シート保護を解除しました";
        renderWindowStatusBar();
        setDirtyState(true);
        debouncedSaveState();
    }

    function renameSheetDialog(index) {
        const target = sheets[index];
        if (!target) return;
        const bodyHtml = `
            <div style="width:100%; display:flex; flex-direction:column; gap:8px;">
                <div>新しいシート名を入力してください:</div>
                <input type="text" class="ss-sheet-rename-input border" value="${escapeHtml(target.name)}" maxlength="31" style="width:100%; padding:4px 6px; font-size:12px; background:#fff; color:#000; box-sizing:border-box;">
            </div>
        `;
        const modalContent = openAppModal("シート名の変更", bodyHtml, {
            width: 340,
            isHtml: true,
            buttons: [
                {
                    label: "OK",
                    onClick: () => {
                        const nextName = modalContent.querySelector(".ss-sheet-rename-input")?.value.trim();
                        if (!nextName || nextName === target.name) return;
                        if (nextName.length > 31 || /[\\/?*[\]:]/.test(nextName) || nextName.startsWith("'") || nextName.endsWith("'")) {
                            showAlert("シート名は31文字以内で、\\ / ? * [ ] : および先頭・末尾の「'」は使用できません。", "名前の変更");
                            return;
                        }
                        if (sheets.some((s, i) => i !== index && s.name.toLowerCase() === nextName.toLowerCase())) {
                            showAlert(`「${nextName}」という名前のシートは既に存在します。`, "名前の変更");
                            return;
                        }
                        const oldName = target.name;
                        target.name = nextName;
                        const escapedOld = oldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                        const sheetRefPattern = new RegExp(`(?:'${escapedOld}'|(?<![A-Za-z0-9_\\u3040-\\u30FF\\u4E00-\\u9FAF])${escapedOld})!`, "g");
                        const formattedNewPrefix = /^[A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+$/.test(nextName)
                            ? `${nextName}!`
                            : `'${nextName}'!`;

                        // 1. アクティブシートの数式・入力規則の参照を更新
                        tbody.querySelectorAll("td[data-formula], td[data-dropdown-list], td[data-dv-rule]").forEach(td => {
                            if (td.dataset.formula) {
                                td.dataset.formula = td.dataset.formula.replace(sheetRefPattern, formattedNewPrefix);
                            }
                            if (td.dataset.dropdownList) {
                                td.dataset.dropdownList = td.dataset.dropdownList.replace(sheetRefPattern, formattedNewPrefix);
                            }
                            if (td.dataset.dvRule) {
                                try {
                                    const r = JSON.parse(td.dataset.dvRule);
                                    if (r.listSpec) r.listSpec = r.listSpec.replace(sheetRefPattern, formattedNewPrefix);
                                    if (r.formula) r.formula = r.formula.replace(sheetRefPattern, formattedNewPrefix);
                                    td.dataset.dvRule = JSON.stringify(r);
                                } catch { /* ignore */ }
                            }
                        });

                        // 2. 全シートの条件付き書式および非アクティブシートのセル参照を更新
                        sheets.forEach((s, idx) => {
                            if (Array.isArray(s.conditionalFormats)) {
                                s.conditionalFormats.forEach(rule => {
                                    if (rule.formula) rule.formula = rule.formula.replace(sheetRefPattern, formattedNewPrefix);
                                    if (typeof rule.val1 === "string" && rule.val1.startsWith("=")) {
                                        rule.val1 = rule.val1.replace(sheetRefPattern, formattedNewPrefix);
                                    }
                                    if (typeof rule.val2 === "string" && rule.val2.startsWith("=")) {
                                        rule.val2 = rule.val2.replace(sheetRefPattern, formattedNewPrefix);
                                    }
                                });
                            }
                            if (idx === activeSheetIndex || !Array.isArray(s.cells)) return;
                            s.cells.forEach(entry => {
                                if (entry.f) entry.f = entry.f.replace(sheetRefPattern, formattedNewPrefix);
                                if (entry.dl) entry.dl = entry.dl.replace(sheetRefPattern, formattedNewPrefix);
                                if (entry.dvr) {
                                    try {
                                        const rule = JSON.parse(entry.dvr);
                                        let changed = false;
                                        if (rule.listSpec) {
                                            rule.listSpec = rule.listSpec.replace(sheetRefPattern, formattedNewPrefix);
                                            changed = true;
                                        }
                                        if (rule.formula) {
                                            rule.formula = rule.formula.replace(sheetRefPattern, formattedNewPrefix);
                                            changed = true;
                                        }
                                        if (changed) entry.dvr = JSON.stringify(rule);
                                    } catch { /* ignore */ }
                                }
                            });
                            invalidateBackgroundSheetCache(s);
                        });

                        renderSheetTabs();
                        updateAllFormulas();
                        setDirtyState(true);
                        debouncedSaveState();
                    }
                },
                { label: "キャンセル" }
            ]
        });
        const inp = modalContent?.querySelector(".ss-sheet-rename-input");
        if (inp) {
            inp.focus();
            inp.select();
            inp.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    (modalContent.closest(".window") || modalContent).querySelector(".button-container button")?.click();
                }
            });
        }
    }

    async function switchToSheet(targetIndex) {
        if (targetIndex < 0 || targetIndex >= sheets.length || targetIndex === activeSheetIndex) return;
        hideAutoFillOptions();
        clearAuditArrows();
        invalidateDependencyGraph();
        captureCurrentSheetDOM({ flush: true });
        activeSheetIndex = targetIndex;
        await applySingleSheetToDOM(sheets[activeSheetIndex], { isUndoRedo: true });
        renderSheetTabs();
    }

    async function addNewSheet(insertAfterIndex = sheets.length - 1) {
        captureCurrentSheetDOM({ flush: true });
        const newSheet = createBlankSheetModel();
        const insertPos = Math.min(sheets.length, Math.max(0, insertAfterIndex + 1));
        sheets.splice(insertPos, 0, newSheet);
        activeSheetIndex = insertPos;
        await applySingleSheetToDOM(newSheet, { isUndoRedo: true });
        renderSheetTabs();
        setDirtyState(true);
        debouncedSaveState();
    }

    async function duplicateSheet(index) {
        const src = sheets[index];
        if (!src) return;
        captureCurrentSheetDOM({ flush: true });
        const copy = JSON.parse(JSON.stringify(sheets[index]));
        copy.id = `sheet_${++sheetIdCounter}`;
        copy.name = generateUniqueSheetName(`${src.name}_`);
        sheets.splice(index + 1, 0, copy);
        activeSheetIndex = index + 1;
        await applySingleSheetToDOM(copy, { isUndoRedo: true });
        renderSheetTabs();
        setDirtyState(true);
        debouncedSaveState();
    }

    function deleteSheet(index) {
        if (sheets.length <= 1) {
            showAlert("ブックには少なくとも1つのシートが必要です。", "シートの削除");
            return;
        }
        const target = sheets[index];
        const executeDelete = async () => {
            sheets.splice(index, 1);
            if (activeSheetIndex >= sheets.length) {
                activeSheetIndex = sheets.length - 1;
            }
            await applySingleSheetToDOM(sheets[activeSheetIndex], { isUndoRedo: true });
            renderSheetTabs();
            setDirtyState(true);
            debouncedSaveState();
        };
        if (windowAPI?.confirmWindow) {
            windowAPI.confirmWindow(`シート「${target.name}」を削除しますか？\nこの操作は元に戻せない場合があります。`, (ok) => {
                if (ok) void executeDelete();
            }, { title: "シートの削除", parentWin: win });
        } else {
            void executeDelete();
        }
    }

    function moveSheet(index, delta) {
        const nextIdx = index + delta;
        if (nextIdx < 0 || nextIdx >= sheets.length) return;
        captureCurrentSheetDOM({ flush: true });
        const [moved] = sheets.splice(index, 1);
        sheets.splice(nextIdx, 0, moved);
        if (activeSheetIndex === index) activeSheetIndex = nextIdx;
        else if (activeSheetIndex === nextIdx) activeSheetIndex = index;
        renderSheetTabs();
        setDirtyState(true);
        debouncedSaveState();
    }

    let selectedSheetIndices = new Set([0]);
    let draggedSheetIndex = null;

    function renderSheetTabs() {
        if (!sheetTabsListEl) return;
        selectedSheetIndices = new Set(
            Array.from(selectedSheetIndices).filter(i => i >= 0 && i < sheets.length)
        );
        if (!selectedSheetIndices.has(activeSheetIndex)) {
            selectedSheetIndices.add(activeSheetIndex);
        }
        sheetTabsListEl.innerHTML = "";
        sheets.forEach((sheet, idx) => {
            const tab = document.createElement("div");
            const isActive = idx === activeSheetIndex;
            const isMulti = selectedSheetIndices.has(idx);
            tab.className = "ss-sheet-tab" + (isActive ? " active" : "") + (isMulti ? " multi-selected" : "");
            tab.textContent = sheet.name;
            tab.dataset.sheetIndex = String(idx);
            tab.draggable = true;
            tab.title = `${sheet.name}（ドラッグで移動 / Ctrl・Shiftで複数選択 / ダブルクリックで名前変更）`;

            tab.addEventListener("click", (e) => {
                if (e.ctrlKey || e.metaKey) {
                    if (selectedSheetIndices.has(idx) && selectedSheetIndices.size > 1) {
                        selectedSheetIndices.delete(idx);
                    } else {
                        selectedSheetIndices.add(idx);
                    }
                    renderSheetTabs();
                    return;
                }
                if (e.shiftKey) {
                    const start = Math.min(activeSheetIndex, idx);
                    const end = Math.max(activeSheetIndex, idx);
                    selectedSheetIndices = new Set();
                    for (let i = start; i <= end; i++) selectedSheetIndices.add(i);
                    renderSheetTabs();
                    return;
                }
                selectedSheetIndices = new Set([idx]);
                void switchToSheet(idx);
            });

            tab.addEventListener("dragstart", (e) => {
                draggedSheetIndex = idx;
                e.dataTransfer.effectAllowed = "move";
            });

            tab.addEventListener("dragover", (e) => {
                e.preventDefault();
                tab.classList.add("drag-over");
            });

            tab.addEventListener("dragleave", () => {
                tab.classList.remove("drag-over");
            });

            tab.addEventListener("drop", (e) => {
                e.preventDefault();
                tab.classList.remove("drag-over");
                if (draggedSheetIndex === null || draggedSheetIndex === idx) return;
                captureCurrentSheetDOM({ flush: true });
                const activeSheetObj = sheets[activeSheetIndex];
                const [moved] = sheets.splice(draggedSheetIndex, 1);
                sheets.splice(idx, 0, moved);
                activeSheetIndex = sheets.indexOf(activeSheetObj);
                selectedSheetIndices = new Set([activeSheetIndex]);
                draggedSheetIndex = null;
                renderSheetTabs();
                setDirtyState(true);
                debouncedSaveState();
            });

            tab.addEventListener("dblclick", (e) => {
                e.stopPropagation();
                renameSheetDialog(idx);
            });
            sheetTabsListEl.appendChild(tab);
        });
    }

    sheetAddBtn?.addEventListener("click", () => {
        void addNewSheet(sheets.length - 1);
    }, { signal });

    // リサイズ用ツールチップ
    const resizeTooltip = document.createElement("div");
    Object.assign(resizeTooltip.style, {
        position: "fixed",
        background: "rgba(0, 0, 0, 0.82)",
        color: "#fff",
        padding: "3px 8px",
        borderRadius: "3px",
        fontSize: "12px",
        display: "none",
        pointerEvents: "none",
        zIndex: "99998"
    });
    document.body.appendChild(resizeTooltip);
    signal.addEventListener("abort", () => {
        cancelTextOverflowUpdate();
        cancelDebouncedSaveState();
        resizeTooltip.remove();
        inlineMiniToolbar?.remove?.();
        document.querySelectorAll(".ss-filter-dropdown").forEach(el => el.remove());
        closeCellDropdownList();
        closeAutocompletePopup();
        hideDataValidationTooltip();
        timers.forEach(id => clearTimeout(id));
        timers.clear();
        destroyFindDialog();
        releaseFileLockIfHeld();
    }, { once: true });

    function updateResizeTooltip(x, y, text) {
        resizeTooltip.textContent = text;
        resizeTooltip.style.left = `${x + 12}px`;
        resizeTooltip.style.top = `${y - 28}px`;
        resizeTooltip.style.display = "block";
    }
    function hideResizeTooltip() {
        resizeTooltip.style.display = "none";
    }

    // =========================================================
    // OS標準モーダルダイアログ（window.js 連携）
    // =========================================================
    function showAlert(message, title = "お知らせ") {
        if (windowAPI?.alertWindow) {
            windowAPI.alertWindow(message, { title, parentWin: win });
        } else {
            alert(`${title}\n\n${message}`);
        }
    }

    function showError(message, title = "エラー") {
        if (windowAPI?.errorWindow) {
            windowAPI.errorWindow(message, { title, parentWin: win });
        } else {
            alert(`${title}\n\n${message}`);
        }
    }

    function showDataValidationDialog({ style = "stop", title, message, onConfirm = null }) {
        const styleConfig = {
            stop: {
                defaultTitle: "入力エラー",
                iconClass: "error_icon",
                buttons: [{ label: "OK" }]
            },
            warning: {
                defaultTitle: "入力の確認",
                iconClass: "warning_icon",
                buttons: [
                    { label: "はい", onClick: () => onConfirm?.(true) },
                    { label: "いいえ", onClick: () => onConfirm?.(false) }
                ]
            },
            info: {
                defaultTitle: "入力情報",
                iconClass: "info_icon",
                buttons: [{ label: "OK" }]
            }
        };

        const cfg = styleConfig[style] || styleConfig.stop;
        const resolvedTitle = title || cfg.defaultTitle;

        if (windowAPI?.showModalWindow) {
            return openAppModal(resolvedTitle, message, {
                iconClass: cfg.iconClass,
                buttons: cfg.buttons
            });
        }

        // フォールバック
        if (style === "warning") {
            const ok = window.confirm(`${resolvedTitle}\n\n${message}`);
            onConfirm?.(ok);
        } else {
            alert(`${resolvedTitle}\n\n${message}`);
        }
    }

    function openAppModal(title, bodyHtml, opts = {}) {
        if (!windowAPI?.showModalWindow) return null;
        const { onClose, parentWin = win, ...restOpts } = opts;
        const modalContent = windowAPI.showModalWindow(title, bodyHtml, {
            ...(parentWin ? { parentWin } : {}),
            ...restOpts,
            onClose: (...args) => {
                onClose?.(...args);
                if (parentWin) restoreMainWindowFocus();
            }
        });
        const modalWin = modalContent?.closest?.(".window");
        if (modalWin && windowAPI?.toggleWindowControl) {
            windowAPI.toggleWindowControl(modalWin, "minimize", false);
            windowAPI.toggleWindowControl(modalWin, "maximize", false);
        }
        return modalContent;
    }

    function restoreMainWindowFocus() {
        if (!win) return;
        windowAPI?.bringToFront?.(win);
        windowAPI?.refreshTopWindow?.();
        if (activeCell && !isCellEditing()) {
            activeCell.focus({ preventScroll: true });
        }
    }

    // =========================================================
    // 結合セル解決・セル取得ヘルパー
    // =========================================================
    function peekCell(row, col) {
        if (row < 1 || col < 0) return null;
        const r = row - 1;
        if (r < 0 || r >= tbody.rows.length) return null;
        const cells = tbody.rows[r].cells;
        if (col + 1 >= cells.length) return null;
        return cells[col + 1];
    }

    function getCell(row, col) {
        if (row < 1 || col < 0) return null;
        if (col >= currentColumns) loadColumnsSync(Math.min(200, col - currentColumns + 1));
        if (row >= rowCount) loadRowsSync(Math.min(500, row - rowCount + 1));
        return peekCell(row, col);
    }

    function getVisibleCell(row, col) {
        let cell = getCell(row, col);
        let guard = 0;
        while (
            cell &&
            cell.style.display === "none" &&
            cell.dataset.mergeAnchorRow &&
            cell.dataset.mergeAnchorCol &&
            guard++ < 10
        ) {
            row = parseInt(cell.dataset.mergeAnchorRow, 10);
            col = parseInt(cell.dataset.mergeAnchorCol, 10);
            cell = getCell(row, col);
        }
        return cell;
    }

    function getRow(rowNumber) {
        return tbody.rows[rowNumber - 1] || null;
    }

    // =========================================================
    // 行・列の生成とリサイズハンドル（<colgroup> + 明示的テーブル幅）
    // =========================================================
    let cachedTableWidth = 0;

    function syncTableWidth() {
        let total = 0;
        for (const col of colgroup.children) {
            const w = parseInt(col.style.width, 10);
            total += Number.isNaN(w) ? DEFAULT_COL_WIDTH : w;
        }
        cachedTableWidth = total;
        table.style.width = `${total}px`;
        spreadsheetContent.style.width = `${total}px`;
    }

    function setColumnWidth(colIndex, widthPx) {
        const colEl = colgroup.children[colIndex + 1];
        const thEl = theadRow.children[colIndex + 1];
        if (colEl) {
            colEl.style.width = `${widthPx}px`;
            if (thEl) thEl.style.width = `${widthPx}px`;
            syncTableWidth();
            if (freezeCols > 0) {
                applyFreezePanes();
            } else {
                refreshVisibleRows();
            }
            scheduleTextOverflowUpdate();
            syncCellDropdownButtonPosition();
            syncCopyAntsBoxPosition();
            if (typeof refreshFormulaRefOverlay === "function") refreshFormulaRefOverlay();
        }
    }

    function applyFreezePanes() {
        table.querySelectorAll(".ss-frozen-row, .ss-frozen-col, .ss-freeze-edge-bottom, .ss-freeze-edge-right").forEach(el => {
            el.classList.remove("ss-frozen-row", "ss-frozen-col", "ss-freeze-edge-bottom", "ss-freeze-edge-right");
            if (el.tagName === "TD") {
                el.style.top = "";
                el.style.left = "";
            } else if (el.classList.contains("row_number")) {
                el.style.top = "";
            } else if (el.classList.contains("col_number")) {
                el.style.left = "";
            }
        });

        if (freezeRows <= 0 && freezeCols <= 0) {
            refreshVisibleRows();
            syncCellDropdownButtonPosition();
            return;
        }

        const theadHeight = theadRow.offsetHeight || DEFAULT_HEADER_HEIGHT;
        const rowHeaderWidth = parseInt(colgroup.children[0]?.style.width, 10) || DEFAULT_ROW_HEADER_WIDTH;

        const rowTopOffsets = [];
        let accTop = theadHeight;
        for (let r = 1; r <= freezeRows; r++) {
            rowTopOffsets[r] = accTop;
            const tr = getRow(r);
            if (!tr || tr.style.display === "none") continue;
            accTop += parseInt(tr.style.height, 10) || tr.offsetHeight || DEFAULT_ROW_HEIGHT;
        }

        const colLeftOffsets = [];
        let accLeft = rowHeaderWidth;
        for (let c = 0; c < freezeCols; c++) {
            colLeftOffsets[c] = accLeft;
            accLeft += getColumnWidth(c);
        }

        // 固定列の列ヘッダー（A, B, ...）に left 座標を設定
        for (let c = 0; c < freezeCols; c++) {
            const th = theadRow.children[c + 1];
            if (!th) continue;
            th.classList.add("ss-frozen-col");
            th.style.left = `${colLeftOffsets[c]}px`;
            if (c === freezeCols - 1) th.classList.add("ss-freeze-edge-right");
        }

        // 各行・各セルに sticky 座標と境界線を適用
        for (let r = 1; r <= tbody.rows.length; r++) {
            const tr = tbody.rows[r - 1];
            if (!tr) continue;
            const isRowFrozen = r <= freezeRows;
            const isBottomEdge = r === freezeRows;

            if (isRowFrozen) {
                const rowTh = tr.cells[0];
                if (rowTh) {
                    rowTh.classList.add("ss-frozen-row");
                    rowTh.style.top = `${rowTopOffsets[r]}px`;
                    if (isBottomEdge) rowTh.classList.add("ss-freeze-edge-bottom");
                }
            }

            const maxColToVisit = isRowFrozen ? tr.cells.length - 1 : Math.min(freezeCols, tr.cells.length - 1);
            for (let c = 0; c < maxColToVisit; c++) {
                const td = tr.cells[c + 1];
                if (!td) continue;
                const isColFrozen = c < freezeCols;
                if (isRowFrozen) {
                    td.classList.add("ss-frozen-row");
                    td.style.top = `${rowTopOffsets[r]}px`;
                    if (isBottomEdge) td.classList.add("ss-freeze-edge-bottom");
                }
                if (isColFrozen) {
                    td.classList.add("ss-frozen-col");
                    td.style.left = `${colLeftOffsets[c]}px`;
                    if (c === freezeCols - 1) td.classList.add("ss-freeze-edge-right");
                }
            }
        }

        refreshVisibleRows();
        syncCellDropdownButtonPosition();
    }

    function setFreezePanes(rows, cols, { silent = false } = {}) {
        freezeRows = Math.max(0, Number(rows) || 0);
        freezeCols = Math.max(0, Number(cols) || 0);
        applyFreezePanes();
        if (!silent) {
            setDirtyState(true);
            debouncedSaveState();
        }
    }

    function freezeAtActiveCell() {
        const base = activeCell || getVisibleCell(1, 0);
        if (!base) return;
        const r = parseInt(base.dataset.row, 10);
        const c = parseInt(base.dataset.col, 10);
        if (r === 1 && c === 0) {
            setFreezePanes(1, 1);
        } else {
            setFreezePanes(r - 1, c);
        }
    }

    function getColumnWidth(colIndex) {
        const thEl = theadRow.children[colIndex + 1];
        if (thEl?.classList.contains("ss-col-hidden")) return 0;
        const colEl = colgroup.children[colIndex + 1];
        if (!colEl) return DEFAULT_COL_WIDTH;
        const w = parseInt(colEl.style.width, 10);
        return Number.isNaN(w) ? DEFAULT_COL_WIDTH : w;
    }

    const measureCtx = document.createElement("canvas").getContext("2d");

    function autoFitColumn(colIndex) {
        let maxWidth = 0;
        let hasContent = false;
        for (const row of tbody.rows) {
            const cell = row.cells[colIndex + 1];
            if (!cell || cell.style.display === "none") continue;
            if (parseInt(cell.getAttribute("colspan") || "1", 10) > 1) continue;
            const text = cell.textContent;
            if (!text) continue;
            hasContent = true;

            const fStyle = cell.style.fontStyle || "normal";
            const fWeight = cell.style.fontWeight || "normal";
            const fSizeCss = cell.style.fontSize || DEFAULT_FONT_SIZE_CSS;
            const fSizePx = cssFontSizeToPx(fSizeCss);
            const fFamily = cell.style.fontFamily || DEFAULT_FONT_FAMILY;
            const isVertical = cell.style.writingMode === "vertical-rl" || cell.style.writingMode === "vertical-lr";
            const lines = text.split("\n");

            if (isVertical) {
                const colW = lines.length * Math.ceil(fSizePx * 1.35) + 14;
                maxWidth = Math.max(maxWidth, colW);
                continue;
            }
            if (measureCtx) {
                measureCtx.font = `${fStyle} ${fWeight} ${fSizePx}px ${fFamily}`;
            }
            const extraFilterPad = cell.querySelector(".ss-filter-arrow") ? 20 : 0;
            for (const line of lines) {
                const textW = measureCtx
                    ? measureCtx.measureText(line).width
                    : line.length * fSizePx;
                maxWidth = Math.max(maxWidth, Math.ceil(textW) + 14 + extraFilterPad);
            }
        }
        const finalWidth = hasContent ? Math.min(600, Math.max(32, maxWidth)) : DEFAULT_COL_WIDTH;
        setColumnWidth(colIndex, finalWidth);
    }

    function autoFitRow(tr) {
        if (!tr) return;
        let maxHeight = DEFAULT_ROW_HEIGHT;
        for (let i = 1; i < tr.cells.length; i++) {
            const cell = tr.cells[i];
            if (!cell || cell.style.display === "none") continue;
            if (parseInt(cell.getAttribute("rowspan") || "1", 10) > 1) continue;

            const fStyle = cell.style.fontStyle || "normal";
            const fWeight = cell.style.fontWeight || "normal";
            const fSizeCss = cell.style.fontSize || DEFAULT_FONT_SIZE_CSS;
            const fSizePx = cssFontSizeToPx(fSizeCss);
            const fFamily = cell.style.fontFamily || DEFAULT_FONT_FAMILY;
            const lineHeight = Math.ceil(fSizePx * 1.28);
            const text = cell.textContent || "";
            const lines = text.split("\n");
            const isVertical = cell.style.writingMode === "vertical-rl" || cell.style.writingMode === "vertical-lr";

            if (isVertical && text !== "") {
                const maxChars = Math.max(1, ...lines.map(l => Array.from(l).length));
                const vertH = maxChars * Math.ceil(fSizePx * 1.15) + 12;
                maxHeight = Math.max(maxHeight, Math.min(600, vertH));
                continue;
            }

            let totalLines = lines.length;
            if (cell.style.whiteSpace === "pre-wrap" && text !== "") {
                if (measureCtx) {
                    measureCtx.font = `${fStyle} ${fWeight} ${fSizePx}px ${fFamily}`;
                }
                const colW = Math.max(20, getColumnWidth(i - 1) - 8);
                totalLines = 0;
                for (const line of lines) {
                    const lineW = measureCtx ? measureCtx.measureText(line).width : line.length * fSizePx;
                    totalLines += Math.max(1, Math.ceil(lineW / colW));
                }
            }
            maxHeight = Math.max(maxHeight, totalLines * lineHeight + 6);
        }
        tr.style.height = maxHeight <= DEFAULT_ROW_HEIGHT ? "" : `${maxHeight}px`;
        if (freezeRows > 0) {
            applyFreezePanes();
        } else {
            refreshVisibleRows();
        }
        scheduleTextOverflowUpdate();
        syncCellDropdownButtonPosition();
        syncCopyAntsBoxPosition();
        if (typeof refreshFormulaRefOverlay === "function") refreshFormulaRefOverlay();
    }

    const baseColResizeHandle = document.createElement("div");
    baseColResizeHandle.className = "col-resize-handle";
    baseColResizeHandle.title = "ドラッグで幅変更 / ダブルクリックで自動調整";

    const baseRowResizeHandle = document.createElement("div");
    baseRowResizeHandle.className = "row-resize-handle";
    baseRowResizeHandle.title = "ドラッグで高さ変更 / ダブルクリックで自動調整";

    function attachColResizeHandle(th, colIndex) {
        th.setAttribute("data-col", String(colIndex));
        if (!th.querySelector(".col-resize-handle")) {
            th.appendChild(baseColResizeHandle.cloneNode(false));
        }
    }

    function attachRowResizeHandle(th, _tr) {
        if (!th.querySelector(".row-resize-handle")) {
            th.appendChild(baseRowResizeHandle.cloneNode(false));
        }
    }

    function getSelectedWholeColumns() {
        const cols = [];
        const totalRows = tbody.rows.length;
        if (totalRows === 0) return cols;
        for (let c = 0; c < currentColumns; c++) {
            const th = theadRow.children[c + 1];
            if (!th || th.classList.contains("ss-col-hidden")) continue;
            let visibleCount = 0;
            let selectedCount = 0;
            for (let r = 0; r < totalRows; r++) {
                const tr = tbody.rows[r];
                if (tr.style.display === "none") continue;
                const td = tr.cells[c + 1];
                if (!td || td.style.display === "none") continue;
                visibleCount++;
                if (td.classList.contains("selected")) selectedCount++;
            }
            if (visibleCount > 0 && selectedCount === visibleCount) {
                cols.push(c);
            }
        }
        return cols;
    }

    function getSelectedWholeRows() {
        const rows = [];
        for (let r = 0; r < tbody.rows.length; r++) {
            const tr = tbody.rows[r];
            if (!tr || tr.style.display === "none") continue;
            let visibleCount = 0;
            let selectedCount = 0;
            for (let c = 0; c < currentColumns; c++) {
                const td = tr.cells[c + 1];
                if (!td || td.style.display === "none" || td.classList.contains("ss-col-hidden")) continue;
                visibleCount++;
                if (td.classList.contains("selected")) selectedCount++;
            }
            if (visibleCount > 0 && selectedCount === visibleCount) {
                rows.push(r + 1);
            }
        }
        return rows;
    }

    function setBulkColumnsWidth(colIndices, widthPx) {
        const w = Math.max(20, Math.min(800, Math.round(widthPx)));
        colIndices.forEach(c => {
            const colEl = colgroup.children[c + 1];
            const thEl = theadRow.children[c + 1];
            if (colEl) colEl.style.width = `${w}px`;
            if (thEl) thEl.style.width = `${w}px`;
        });
        syncTableWidth();
        if (freezeCols > 0) applyFreezePanes();
        else refreshVisibleRows();
        scheduleTextOverflowUpdate();
        syncCellDropdownButtonPosition();
        syncCopyAntsBoxPosition();
        if (typeof refreshFormulaRefOverlay === "function") refreshFormulaRefOverlay();
    }

    function setBulkRowsHeight(rowNumbers, heightPx) {
        const h = Math.max(16, Math.min(600, Math.round(heightPx)));
        rowNumbers.forEach(r => {
            const tr = getRow(r);
            if (tr) tr.style.height = `${h}px`;
        });
        if (freezeRows > 0) applyFreezePanes();
        else refreshVisibleRows();
        scheduleTextOverflowUpdate();
        syncCellDropdownButtonPosition();
        syncCopyAntsBoxPosition();
        if (typeof refreshFormulaRefOverlay === "function") refreshFormulaRefOverlay();
    }

    function updateHiddenHeaderIndicators() {
        for (let c = 0; c < currentColumns; c++) {
            const th = theadRow.children[c + 1];
            const nextTh = theadRow.children[c + 2];
            if (th) th.classList.toggle("ss-has-hidden-next", Boolean(nextTh?.classList.contains("ss-col-hidden")));
        }
        for (let r = 0; r < tbody.rows.length; r++) {
            const th = tbody.rows[r].cells[0];
            const nextTr = tbody.rows[r + 1];
            if (th) th.classList.toggle("ss-has-hidden-next", Boolean(nextTr?.dataset.userHidden === "1"));
        }
    }

    function setColumnsVisibility(colIndices, visible) {
        colIndices.forEach(c => {
            const colEl = colgroup.children[c + 1];
            const thEl = theadRow.children[c + 1];
            if (!colEl || !thEl) return;
            if (!visible) {
                if (!thEl.classList.contains("ss-col-hidden")) {
                    colEl.dataset.prevWidth = colEl.style.width || `${DEFAULT_COL_WIDTH}px`;
                }
                colEl.style.width = "0px";
                thEl.classList.add("ss-col-hidden");
                for (const tr of tbody.rows) tr.cells[c + 1]?.classList.add("ss-col-hidden");
            } else {
                colEl.style.width = colEl.dataset.prevWidth || `${DEFAULT_COL_WIDTH}px`;
                thEl.classList.remove("ss-col-hidden");
                for (const tr of tbody.rows) tr.cells[c + 1]?.classList.remove("ss-col-hidden");
            }
        });
        syncTableWidth();
        updateHiddenHeaderIndicators();
        if (freezeCols > 0) applyFreezePanes();
        syncCellDropdownButtonPosition();
        syncCopyAntsBoxPosition();
        if (typeof refreshFormulaRefOverlay === "function") refreshFormulaRefOverlay();
        setDirtyState(true);
        debouncedSaveState();
    }

    function setRowsVisibility(rowNumbers, visible) {
        rowNumbers.forEach(r => {
            const tr = getRow(r);
            if (!tr) return;
            if (!visible) {
                tr.dataset.userHidden = "1";
                tr.style.display = "none";
            } else {
                delete tr.dataset.userHidden;
                if (tr.dataset.filterHidden !== "1") tr.style.display = "";
            }
        });
        updateHiddenHeaderIndicators();
        if (freezeRows > 0) applyFreezePanes();
        syncCellDropdownButtonPosition();
        syncCopyAntsBoxPosition();
        if (typeof refreshFormulaRefOverlay === "function") refreshFormulaRefOverlay();
        setDirtyState(true);
        debouncedSaveState();
    }

    function openDimensionInputDialog(type, targets) {
        if (!targets || !targets.length) return;
        const isCol = type === "col";
        const curVal = isCol
            ? getColumnWidth(targets[0])
            : (getRow(targets[0])?.offsetHeight || DEFAULT_ROW_HEIGHT);

        const bodyHtml = `
            <div style="display:flex; flex-direction:column; gap:8px; font-size:12px;">
                <div>選択中の ${targets.length} ${isCol ? "列の幅" : "行の高さ"} (px):</div>
                <input type="number" class="ss-dim-input border" min="16" max="800" value="${curVal}" style="width:100%; height:24px; padding:2px 6px; background:#fff; color:#000;">
            </div>
        `;
        const modal = openAppModal(isCol ? "列の幅" : "行の高さ", bodyHtml, {
            width: 280,
            isHtml: true,
            buttons: [
                {
                    label: "OK",
                    onClick: () => {
                        const val = Number(modal.querySelector(".ss-dim-input")?.value);
                        if (!isFinite(val) || val < 16) return;
                        if (isCol) setBulkColumnsWidth(targets, val);
                        else setBulkRowsHeight(targets, val);
                        setDirtyState(true);
                        debouncedSaveState();
                    }
                },
                { label: "キャンセル" }
            ]
        });
        const inp = modal?.querySelector(".ss-dim-input");
        if (inp) {
            inp.focus();
            inp.select();
        }
    }

    table.addEventListener("mousedown", (e) => {
        const colHandle = e.target.closest(".col-resize-handle");
        if (colHandle) {
            const th = colHandle.closest("th");
            if (!th) return;
            const colIndex = Number(th.dataset.col);
            e.stopPropagation();
            e.stopImmediatePropagation();
            e.preventDefault();
            const startX = e.clientX;
            const startWidth = th.offsetWidth || getColumnWidth(colIndex);
            const selectedCols = getSelectedWholeColumns();
            const targetCols = selectedCols.includes(colIndex) ? selectedCols : [colIndex];
            let moved = false;

            const onMove = (eMove) => {
                moved = true;
                const newWidth = Math.max(20, startWidth + (eMove.clientX - startX));
                setBulkColumnsWidth(targetCols, newWidth);
                const label = targetCols.length > 1 ? `${newWidth}px (${targetCols.length}列一括)` : `${newWidth}px`;
                updateResizeTooltip(eMove.clientX, eMove.clientY, label);
            };
            const onUp = () => {
                document.removeEventListener("mousemove", onMove);
                document.removeEventListener("mouseup", onUp);
                hideResizeTooltip();
                if (moved) {
                    setDirtyState(true);
                    debouncedSaveState();
                }
            };
            document.addEventListener("mousemove", onMove, { signal });
            document.addEventListener("mouseup", onUp, { signal });
            return;
        }

        const rowHandle = e.target.closest(".row-resize-handle");
        if (rowHandle) {
            const tr = rowHandle.closest("tr");
            if (!tr) return;
            const rowNum = Number(tr.dataset.row);
            e.stopPropagation();
            e.stopImmediatePropagation();
            e.preventDefault();
            const startY = e.clientY;
            const startHeight = tr.offsetHeight || DEFAULT_ROW_HEIGHT;
            const selectedRows = getSelectedWholeRows();
            const targetRows = selectedRows.includes(rowNum) ? selectedRows : [rowNum];
            let moved = false;

            const onMove = (eMove) => {
                moved = true;
                const newHeight = Math.max(16, startHeight + (eMove.clientY - startY));
                setBulkRowsHeight(targetRows, newHeight);
                const label = targetRows.length > 1 ? `${newHeight}px (${targetRows.length}行一括)` : `${newHeight}px`;
                updateResizeTooltip(eMove.clientX, eMove.clientY, label);
            };
            const onUp = () => {
                document.removeEventListener("mousemove", onMove);
                document.removeEventListener("mouseup", onUp);
                hideResizeTooltip();
                if (moved) {
                    if (freezeRows > 0) applyFreezePanes();
                    setDirtyState(true);
                    debouncedSaveState();
                }
            };
            document.addEventListener("mousemove", onMove, { signal });
            document.addEventListener("mouseup", onUp, { signal });
        }
    }, { capture: true, signal });

    table.addEventListener("dblclick", (e) => {
        const colHandle = e.target.closest(".col-resize-handle");
        if (colHandle) {
            const th = colHandle.closest("th");
            if (!th) return;
            const colIndex = Number(th.dataset.col);
            e.stopPropagation();
            e.stopImmediatePropagation();
            e.preventDefault();
            const selectedCols = getSelectedWholeColumns();
            const targetCols = selectedCols.includes(colIndex) ? selectedCols : [colIndex];
            targetCols.forEach(c => autoFitColumn(c));
            setDirtyState(true);
            debouncedSaveState();
            return;
        }

        const rowHandle = e.target.closest(".row-resize-handle");
        if (rowHandle) {
            const tr = rowHandle.closest("tr");
            if (!tr) return;
            e.stopPropagation();
            e.stopImmediatePropagation();
            e.preventDefault();
            const rowNum = Number(tr.dataset.row);
            const selectedRows = getSelectedWholeRows();
            const targetRows = selectedRows.includes(rowNum) ? selectedRows : [rowNum];
            targetRows.forEach(r => autoFitRow(getRow(r)));
            setDirtyState(true);
            debouncedSaveState();
        }
    }, { capture: true, signal });

    const baseTdTemplate = document.createElement("td");
    baseTdTemplate.tabIndex = -1;
    baseTdTemplate.contentEditable = "false";

    let cachedRowTemplate = null;
    let cachedRowTemplateCols = -1;

    function getRowTemplate(colLen) {
        if (cachedRowTemplate && cachedRowTemplateCols === colLen) {
            return cachedRowTemplate;
        }
        const tr = document.createElement("tr");
        const th = document.createElement("th");
        th.className = "row_number button";
        th.appendChild(document.createTextNode(""));
        th.appendChild(baseRowResizeHandle.cloneNode(false));
        tr.appendChild(th);
        for (let c = 0; c < colLen; c++) {
            const td = baseTdTemplate.cloneNode(false);
            td.dataset.col = String(c);
            tr.appendChild(td);
        }
        cachedRowTemplate = tr;
        cachedRowTemplateCols = colLen;
        return tr;
    }

    function loadColumnsSync(count) {
        if (count <= 0) return;
        const start = currentColumns;
        const end = start + count;
        const headerFrag = document.createDocumentFragment();
        const colFrag = document.createDocumentFragment();

        for (let c = start; c < end; c++) {
            const colEl = document.createElement("col");
            colEl.style.width = `${DEFAULT_COL_WIDTH}px`;
            colFrag.appendChild(colEl);

            const th = document.createElement("th");
            th.className = "col_number button";
            th.textContent = getColumnName(c);
            attachColResizeHandle(th, c);
            headerFrag.appendChild(th);
        }
        colgroup.appendChild(colFrag);
        theadRow.appendChild(headerFrag);

        for (const row of tbody.rows) {
            const rStr = row.dataset.row || row.cells[0].textContent;
            const rowFrag = document.createDocumentFragment();
            for (let c = start; c < end; c++) {
                const td = baseTdTemplate.cloneNode(false);
                td.dataset.row = rStr;
                td.dataset.col = String(c);
                rowFrag.appendChild(td);
            }
            row.appendChild(rowFrag);
        }
        currentColumns = end;
        cachedRowTemplate = null;
        if (cachedTableWidth > 0) {
            cachedTableWidth += count * DEFAULT_COL_WIDTH;
            table.style.width = `${cachedTableWidth}px`;
            spreadsheetContent.style.width = `${cachedTableWidth}px`;
        } else {
            syncTableWidth();
        }
        if (freezeRows > 0) {
            const theadHeight = theadRow.offsetHeight || DEFAULT_HEADER_HEIGHT;
            let accTop = theadHeight;
            for (let r = 1; r <= freezeRows; r++) {
                const tr = getRow(r);
                if (!tr) break;
                const isBottomEdge = r === freezeRows;
                for (let c = start; c < end; c++) {
                    const td = tr.cells[c + 1];
                    if (!td) continue;
                    td.classList.add("ss-frozen-row");
                    td.style.top = `${accTop}px`;
                    if (isBottomEdge) td.classList.add("ss-freeze-edge-bottom");
                }
                accTop += parseInt(tr.style.height, 10) || tr.offsetHeight || DEFAULT_ROW_HEIGHT;
            }
        }
    }

    function applyFreezeToRowsRange(startRowIndex) {
        if (freezeCols <= 0) return;
        const rowHeaderWidth = parseInt(colgroup.children[0]?.style.width, 10) || DEFAULT_ROW_HEADER_WIDTH;
        const colLeftOffsets = [];
        let accLeft = rowHeaderWidth;
        for (let c = 0; c < freezeCols; c++) {
            colLeftOffsets[c] = accLeft;
            accLeft += getColumnWidth(c);
        }
        for (let i = startRowIndex; i < tbody.rows.length; i++) {
            const tr = tbody.rows[i];
            const limit = Math.min(freezeCols, tr.cells.length - 1);
            for (let c = 0; c < limit; c++) {
                const td = tr.cells[c + 1];
                if (!td) continue;
                td.classList.add("ss-frozen-col");
                td.style.left = `${colLeftOffsets[c]}px`;
                if (c === freezeCols - 1) td.classList.add("ss-freeze-edge-right");
            }
        }
    }

    function loadRowsSync(count) {
        if (count <= 0) return;
        const frag = document.createDocumentFragment();
        const template = getRowTemplate(currentColumns);

        for (let i = 0; i < count; i++, rowCount++) {
            const rStr = String(rowCount);
            const tr = template.cloneNode(true);
            tr.dataset.row = rStr;
            const cells = tr.children;
            cells[0].firstChild.nodeValue = rStr;
            for (let c = 1; c < cells.length; c++) {
                cells[c].dataset.row = rStr;
            }
            frag.appendChild(tr);
        }
        const addedStartIdx = tbody.rows.length;
        tbody.appendChild(frag);
        if (freezeCols > 0) {
            applyFreezeToRowsRange(addedStartIdx);
        }
    }

    // =========================================================
    // 数式評価エンジン・スピル展開・一括再計算（formula-engine.js）
    // =========================================================

    const {
        clearFormulaEvalCache,
        invalidateBackgroundSheetCache,
        invalidateDependencyGraph,
        getBackgroundSheetCellMap,
        evaluateFormula,
        clearSpillCellsFromAnchor,
        recalculateBackgroundSheets,
        recalculateCells,
        updateAllFormulas
    } = createFormulaEngineModule({
        tbody,
        getSheets: () => sheets,
        getActiveSheetIndex: () => activeSheetIndex,
        getRowCount: () => rowCount,
        getCurrentColumns: () => currentColumns,
        getDefinedNames: () => definedNames,
        peekCell,
        getCell,
        getRow,
        isCellEditing: (cell) => isCellEditing(cell),
        resolveStructuredReferences: (expr, sIdx) => resolveStructuredReferences(expr, sIdx),
        setCellFormattedValue: (cell, val) => setCellFormattedValue(cell, val),
        applyConditionalFormats: (dirtyCoords) => applyConditionalFormats(dirtyCoords),
        updateTextOverflowDisplay: (rows) => updateTextOverflowDisplay(rows),
        updateAllFloatingCharts: (dirtyCoords) => {
            updateAllFloatingCharts(dirtyCoords);
            refreshAllSlicers?.();
        }
    });

    function syncCellHyperlinkVisual(cell) {
        if (!cell) return;
        const target = extractHyperlinkTarget(cell);
        if (target) {
            cell.classList.add("ss-hyperlink");
            const extra = [];
            if (cell.dataset.comment) extra.push(`[コメント] ${cell.dataset.comment}`);
            if (cell.dataset.note) extra.push(`[メモ] ${cell.dataset.note}`);
            extra.push(`${target}（Ctrl+クリックで開く）`);
            cell.title = extra.join("\n");
        } else if (cell.classList.contains("ss-hyperlink")) {
            cell.classList.remove("ss-hyperlink");
            if (cell.dataset.comment || cell.dataset.note) {
                if (typeof syncCellAnnotationMark === "function") syncCellAnnotationMark(cell);
            } else {
                cell.removeAttribute("title");
            }
        }
    }

    function syncNumFmtColorClass(cell, rawVal, fmt) {
        const color = resolveCustomPatternColor(rawVal, fmt);
        if (color) {
            cell.style.setProperty("--ss-numfmt-color", color);
            cell.classList.add("ss-has-numfmt-color");
        } else {
            cell.style.removeProperty("--ss-numfmt-color");
            cell.classList.remove("ss-has-numfmt-color");
        }
    }

    function setCellFormattedValue(cell, rawVal) {
        const rawStr = typeof rawVal === "boolean"
            ? (rawVal ? "TRUE" : "FALSE")
            : String(rawVal ?? "");
        if (rawStr === "") {
            delete cell.dataset.rawValue;
            delete cell.dataset.valueType;
            delete cell.dataset.dateValue;
            setCellTextPreservingControls(cell, "");
            cell.classList.remove("ss-auto-align-right", "ss-auto-align-center");
            syncNumFmtColorClass(cell, "", "");
            syncCellHyperlinkVisual(cell);
            return;
        }
        if (cell.dataset.quotePrefix === "1" || (cell.dataset.numFormat === "text" && !cell.dataset.formula)) {
            cell.dataset.rawValue = rawStr;
            setCellTextPreservingControls(cell, rawStr);
            cell.classList.remove("ss-auto-align-right", "ss-auto-align-center");
            syncNumFmtColorClass(cell, "", "");
            syncCellHyperlinkVisual(cell);
            return;
        }
        const fmt = cell.dataset.numFormat;
        if (fmt && fmt !== "general" && fmt !== "text" && !rawStr.startsWith("#")) {
            const parsed = parseFormattedNumber(rawStr);
            cell.dataset.rawValue = !isNaN(parsed) ? String(parsed) : rawStr;
        } else {
            cell.dataset.rawValue = rawStr;
        }
        if (showFormulasMode && cell.dataset.formula) {
            setCellTextPreservingControls(cell, cell.dataset.formula);
            cell.classList.remove("ss-auto-align-right", "ss-auto-align-center");
            syncNumFmtColorClass(cell, "", "");
        } else {
            setCellTextPreservingControls(cell, formatDisplayByNumFmt(cell.dataset.rawValue, fmt, cell));
            updateCellAutoAlignment(cell, cell.dataset.rawValue);
            syncNumFmtColorClass(cell, cell.dataset.rawValue, fmt);
        }
        syncCellHyperlinkVisual(cell);
    }

    const {
        cancelTextOverflowUpdate,
        scheduleTextOverflowUpdate,
        updateTextOverflowDisplay
    } = createTextOverflowModule({
        tbody,
        container,
        measureCtx,
        getColumnWidth,
        isCellEditing: (td) => isCellEditing(td)
    });

    function openSheetRangePicker({ modalContent, targetInput, label = "範囲を選択:", allowCrossSheet = true, onPicked = null }) {
        if (!modalContent || !targetInput) return;
        const modalWin = modalContent.closest(".window");
        const originSheetIdx = activeSheetIndex;
        const prevValue = targetInput.value;

        if (modalWin) {
            modalWin.dataset.backgroundClickable = "true";
            modalWin.style.visibility = "hidden";
        }
        windowAPI?.setModalBackgroundClickable?.(modalContent, true);
        if (win) {
            windowAPI?.bringToFront?.(win);
            windowAPI?.refreshTopWindow?.();
        }

        const pickerBar = document.createElement("div");
        pickerBar.style.cssText = `
            position: fixed; top: 14px; left: 50%; transform: translateX(-50%);
            z-index: 2147483647; background: #c3c7cb; border: 2px solid;
            border-color: #fff #404040 #404040 #fff; box-shadow: 2px 3px 8px rgba(0,0,0,0.4);
            padding: 6px 10px; display: flex; align-items: center; gap: 6px; font-size: 12px;
        `;
        pickerBar.innerHTML = `
            <span style="font-weight:bold; color:#107c41;">${label}</span>
            <input type="text" class="ss-range-picker-preview border" value="${prevValue.replace(/"/g, "&quot;")}" style="width:200px; height:24px; padding:2px 6px; background:#fff; color:#000;">
            <button type="button" class="button ss-range-picker-ok" style="height:24px; padding:0 10px;">確定</button>
            <button type="button" class="button ss-range-picker-cancel" style="height:24px; padding:0 8px;">戻る</button>
        `;
        document.body.appendChild(pickerBar);
        const previewInput = pickerBar.querySelector(".ss-range-picker-preview");

        let picking = false;
        let pickStart = null;

        const buildAbsRangeInfo = (s, e) => {
            const r0 = Math.min(s.row, e.row);
            const r1 = Math.max(s.row, e.row);
            const c0 = Math.min(s.col, e.col);
            const c1 = Math.max(s.col, e.col);
            const startRef = `$${getColumnName(c0)}$${r0}`;
            const endRef = `$${getColumnName(c1)}$${r1}`;
            const refBody = (r0 === r1 && c0 === c1) ? startRef : `${startRef}:${endRef}`;
            if (allowCrossSheet && activeSheetIndex !== originSheetIdx) {
                const sName = sheets[activeSheetIndex]?.name || "";
                const prefix = /^[A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+$/.test(sName)
                    ? `${sName}!`
                    : `'${sName.replace(/'/g, "''")}'!`;
                return { fullRef: `=${prefix}${refBody}`, localRef: refBody };
            }
            return { fullRef: `=${refBody}`, localRef: refBody };
        };

        const resolvePickTd = (ev) => {
            const el = document.elementFromPoint(ev.clientX, ev.clientY);
            return el?.closest("td") || null;
        };

        const applyPickerHighlight = (s, e) => {
            const { fullRef, localRef } = buildAbsRangeInfo(s, e);
            highlightCalculationRange(localRef, { interactive: false });
            previewInput.value = fullRef;
        };

        const onPickDown = (ev) => {
            if (pickerBar.contains(ev.target)) return;
            const td = resolvePickTd(ev);
            if (!td || !tbody.contains(td)) return;
            ev.preventDefault();
            ev.stopPropagation();
            ev.stopImmediatePropagation();
            picking = true;
            pickStart = { row: +td.dataset.row, col: +td.dataset.col };
            applyPickerHighlight(pickStart, pickStart);
        };

        const onPickMove = (ev) => {
            if (!picking || !pickStart) return;
            const td = resolvePickTd(ev);
            if (!td || !tbody.contains(td)) return;
            applyPickerHighlight(pickStart, { row: +td.dataset.row, col: +td.dataset.col });
        };

        const onPickUp = () => {
            picking = false;
        };

        let pickerClosed = false;

        const onPickKeydown = (ev) => {
            if (ev.key === "Enter") {
                ev.preventDefault();
                ev.stopPropagation();
                void cleanupPicker(previewInput.value.trim());
            } else if (ev.key === "Escape") {
                ev.preventDefault();
                ev.stopPropagation();
                void cleanupPicker(null);
            }
        };

        const cleanupPicker = async (applyVal) => {
            if (pickerClosed) return;
            pickerClosed = true;
            signal.removeEventListener("abort", onAppAbort);
            document.removeEventListener("mousedown", onPickDown, true);
            document.removeEventListener("mousemove", onPickMove, true);
            document.removeEventListener("mouseup", onPickUp, true);
            document.removeEventListener("keydown", onPickKeydown, true);
            clearCalculationRangeHighlights();
            pickerBar.remove();
            if (activeSheetIndex !== originSheetIdx) {
                await switchToSheet(originSheetIdx);
            }
            windowAPI?.setModalBackgroundClickable?.(modalContent, false);
            if (modalWin) {
                delete modalWin.dataset.backgroundClickable;
                modalWin.style.visibility = "";
                windowAPI?.bringToFront?.(modalWin);
                windowAPI?.refreshTopWindow?.();
            }
            if (applyVal !== null) {
                targetInput.value = applyVal;
                targetInput.dispatchEvent(new Event("change"));
                onPicked?.(applyVal);
            }
            targetInput.focus();
        };

        const onAppAbort = () => {
            void cleanupPicker(null);
        };
        signal.addEventListener("abort", onAppAbort, { once: true });

        document.addEventListener("mousedown", onPickDown, { capture: true, signal });
        document.addEventListener("mousemove", onPickMove, { capture: true, signal });
        document.addEventListener("mouseup", onPickUp, { capture: true, signal });
        document.addEventListener("keydown", onPickKeydown, { capture: true, signal });

        pickerBar.querySelector(".ss-range-picker-ok").addEventListener("click", () => {
            void cleanupPicker(previewInput.value.trim());
        });
        pickerBar.querySelector(".ss-range-picker-cancel").addEventListener("click", () => {
            void cleanupPicker(null);
        });
    }

    const {
        matchConditionalRule,
        applyConditionalFormats,
        resetConditionalFormatCache,
        openConditionalFormatPresetDialog,
        openConditionalFormatModal,
        openConditionalFormatManager
    } = createConditionalFormattingModule({
        tbody,
        win,
        windowAPI,
        getActiveSheet: () => sheets[activeSheetIndex],
        getActiveSheetIndex: () => activeSheetIndex,
        getCurrentColumns: () => currentColumns,
        peekCell,
        getCellPureText: (td) => getCellPureText(td),
        adjustFormula: (f, dr, dc) => adjustFormula(f, dr, dc),
        evaluateFormula,
        getSelectedRangeBounds: () => getSelectedRangeBounds(),
        syncCellGridlinesForCells: (cells) => syncCellGridlinesForCells(cells),
        openAppModal,
        openSheetRangePicker,
        parseRangeReference: (s) => parseRangeReference(s),
        parseCellReference: (s) => parseCellReference(s),
        setDirtyState,
        debouncedSaveState: () => debouncedSaveState()
    });

    // =========================================================
    // ハイライト・数式参照オーバーレイ・1セル精度ドラッグ編集
    // =========================================================
    const {
        formulaRefLayer,
        isRefDragging,
        clearCalculationRangeHighlights,
        highlightCalculationRange,
        refreshFormulaRefOverlay,
        tracePrecedentsForCell,
        traceDependentsForCell,
        clearAuditArrows,
        syncFormulaInputsAndCaret,
        hitTestGridCoord
    } = createFormulaRefOverlayModule({
        signal,
        container,
        spreadsheetContent,
        theadRow,
        colgroup,
        tbody,
        formulaBarInput,
        ROW_BATCH,
        COLUMN_BATCH,
        getCurrentColumns: () => currentColumns,
        getRowCount: () => rowCount,
        getFreezeRows: () => freezeRows,
        getFreezeCols: () => freezeCols,
        getColumnWidth,
        loadRowsSync,
        loadColumnsSync,
        isCellEditing: (cell) => isCellEditing(cell),
        getCellEditor: () => cellEditor,
        getEditingCell: () => editingCell,
        syncCellEditorLayout: (cell) => syncCellEditorLayout(cell),
        markFormulaBarDirty: () => { isFormulaBarDirty = true; },
        syncFormulaBarToCellEditor: () => syncFormulaBarToCellEditor(),
        setLastPointRefRange: (range) => { lastPointRefRange = range; }
    });

    function updateToolbarState() {
        const target = activeCell || tbody.querySelector("td.selected");
        if (!target) return;

        const computed = getComputedStyle(target);
        const fontSelect = appRoot.querySelector(".ss-font-family");
        if (fontSelect) {
            const curFont = (target.style.fontFamily || computed.fontFamily || "").toLowerCase().replace(/["']/g, "");
            let matched = false;
            for (const opt of fontSelect.options) {
                const primary = opt.value.split(",")[0].trim().toLowerCase().replace(/["']/g, "");
                const isMatch = curFont.includes(primary);
                opt.selected = isMatch;
                if (isMatch) matched = true;
            }
            if (!matched && fontSelect.options.length) fontSelect.options[0].selected = true;
        }

        const select = appRoot.querySelector(".ss-font-size");
        if (select) {
            const curPt = Math.round(cssFontSizeToPt(target.dataset.origFontSize || target.style.fontSize || computed.fontSize, DEFAULT_FONT_SIZE_PT));
            let matched = false;
            for (const opt of select.options) {
                const optPt = Math.round(cssFontSizeToPt(opt.value, DEFAULT_FONT_SIZE_PT));
                const isMatch = optPt === curPt;
                opt.selected = isMatch;
                if (isMatch) matched = true;
            }
            if (!matched) {
                for (const opt of select.options) {
                    opt.selected = opt.value === DEFAULT_FONT_SIZE_CSS;
                }
            }
        }

        const isBold = target.style.fontWeight === "bold" || Number(computed.fontWeight) >= 600;
        const deco = target.style.textDecoration || "";
        appRoot.querySelector(".ss-toggle-bold")?.classList.toggle("selected", isBold);
        appRoot.querySelector(".ss-toggle-italic")?.classList.toggle("selected", target.style.fontStyle === "italic");
        appRoot.querySelector(".ss-toggle-underline")?.classList.toggle("selected", deco.includes("underline"));
        appRoot.querySelector(".ss-toggle-strike")?.classList.toggle("selected", deco.includes("line-through"));
        appRoot.querySelector(".ss-toggle-textshadow")?.classList.toggle("selected", Boolean(target.style.textShadow && target.style.textShadow !== "none"));

        // Excel準拠：明示的に設定された水平配置のみリボンボタンを強調（標準配置の自動右寄せ等は未選択扱い）
        const explicitAlign = target.style.textAlign || "";
        appRoot.querySelectorAll("[data-align]").forEach(btn => {
            btn.classList.toggle("selected", explicitAlign !== "" && btn.dataset.align === explicitAlign);
        });

        const valign = target.style.verticalAlign || "middle";
        appRoot.querySelector(".ss-valign-top")?.classList.toggle("selected", valign === "top");
        appRoot.querySelector(".ss-valign-middle")?.classList.toggle("selected", valign === "middle");
        appRoot.querySelector(".ss-valign-bottom")?.classList.toggle("selected", valign === "bottom");

        appRoot.querySelector(".ss-toggle-vertical")?.classList.toggle("selected", target.style.writingMode === "vertical-rl");
        appRoot.querySelector(".ss-toggle-wrap")?.classList.toggle("selected", target.style.whiteSpace === "pre-wrap");

        const numFmt = target.dataset.numFormat || "general";
        appRoot.querySelectorAll("[data-numfmt]").forEach(btn => {
            btn.classList.toggle("selected", btn.dataset.numfmt === numFmt);
        });
        syncFilterButtonState(target);
    }

    function updateSelectedCellsDisplay(preQueriedSelected = null) {
        const selected = preQueriedSelected || [...tbody.querySelectorAll("td.selected")];
        if (!selected.length) {
            if (document.activeElement !== selectedCellsDisplay) {
                selectedCellsDisplay.value = activeCell ? getCellReference(activeCell) : "";
            }
            updateOSStatusBar("Ready");
            return;
        }
        let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
        let numSum = 0, numCount = 0, nonEmptyCount = 0;
        let numMin = Infinity, numMax = -Infinity;
        let coveredCount = 0;

        const coords = selected.map(c => {
            const r0 = +c.dataset.row, col0 = +c.dataset.col;
            const rs = +c.getAttribute("rowspan") || 1;
            const cs = +c.getAttribute("colspan") || 1;
            const r1 = r0 + rs - 1;
            const col1 = col0 + cs - 1;
            coveredCount += rs * cs;

            if (r0 < minR) minR = r0;
            if (r1 > maxR) maxR = r1;
            if (col0 < minC) minC = col0;
            if (col1 > maxC) maxC = col1;

            const displayStr = (c.textContent ?? "").trim();
            if (displayStr !== "") nonEmptyCount++;

            const isDateCell = c.dataset.valueType === "date" || isDateNumFormat(c.dataset.numFormat);
            const rawVal = (c.dataset.rawValue ?? c.textContent).trim().replace(/[¥￥,、\s]/g, "");
            if (!isDateCell && rawVal !== "" && !isNaN(Number(rawVal))) {
                const n = Number(rawVal);
                numSum += n;
                numCount++;
                if (n < numMin) numMin = n;
                if (n > numMax) numMax = n;
            }
            return getColumnName(col0) + r0;
        });

        const expected = (maxR - minR + 1) * (maxC - minC + 1);
        const text = selected.length === 1
            ? coords[0]
            : coveredCount === expected
                ? `${getColumnName(minC)}${minR}:${getColumnName(maxC)}${maxR}`
                : `${selected.length} セル選択`;

        if (document.activeElement !== selectedCellsDisplay) {
            selectedCellsDisplay.value = text;
        }
        updateSelectionEdges(selected);
        updateToolbarState();

        if (selected.length > 1 && numCount > 0) {
            const avg = (numSum / numCount).toLocaleString("ja-JP", { maximumFractionDigits: 2 });
            const sumStr = numSum.toLocaleString("ja-JP", { maximumFractionDigits: 4 });
            updateOSStatusBar(`平均: ${avg} | データの個数: ${nonEmptyCount} | 数値の個数: ${numCount} | 最小値: ${numMin} | 最大値: ${numMax} | 合計: ${sumStr}`);
        } else if (selected.length > 1) {
            updateOSStatusBar(`データの個数: ${nonEmptyCount} | 選択セル数: ${selected.length}`);
        } else {
            updateOSStatusBar(`選択セル: ${text}`);
        }
    }

    // 名前ボックス（A1 / Z100 / B2:F20）からのダイレクトジャンプ＆範囲選択
    selectedCellsDisplay.addEventListener("focus", () => {
        selectedCellsDisplay.select();
    }, { signal });

    selectedCellsDisplay.addEventListener("keydown", async (e) => {
        if (e.key === "Escape") {
            e.preventDefault();
            selectedCellsDisplay.blur();
            updateSelectedCellsDisplay();
            if (activeCell) activeCell.focus({ preventScroll: true });
            return;
        }
        if (e.key !== "Enter") return;
        e.preventDefault();
        const rawInput = selectedCellsDisplay.value.trim();
        let resolvedSpec = rawInput;

        // 登録済みの「名前の定義」に一致する場合は参照先（他シート含む）へ解決
        if (definedNames && Object.prototype.hasOwnProperty.call(definedNames, rawInput)) {
            resolvedSpec = String(definedNames[rawInput]).replace(/^=/, "").trim();
            const sheetSplit = resolvedSpec.match(/^(?:(?:'([^']+)'|([A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+))!)?(.+)$/);
            if (sheetSplit) {
                const targetSheetName = sheetSplit[1] ?? sheetSplit[2];
                if (targetSheetName) {
                    const sIdx = sheets.findIndex(s => s.name === targetSheetName);
                    if (sIdx !== -1 && sIdx !== activeSheetIndex) {
                        await switchToSheet(sIdx);
                    }
                }
                resolvedSpec = sheetSplit[3].trim();
            }
        }

        const MAX_NAV_ROW = 5000;
        const MAX_NAV_COL = 200;
        const inputRef = resolvedSpec.toUpperCase();
        if (inputRef.includes(":")) {
            const range = parseRangeReference(inputRef);
            if (range) {
                const minR = Math.min(range.start.row, range.end.row);
                const maxR = Math.max(range.start.row, range.end.row);
                const minC = Math.min(range.start.col, range.end.col);
                const maxC = Math.max(range.start.col, range.end.col);
                if (maxR > MAX_NAV_ROW || maxC >= MAX_NAV_COL) {
                    showAlert(`移動できる上限は ${MAX_NAV_ROW} 行・${MAX_NAV_COL} 列までです。`, "名前ボックス");
                    updateSelectedCellsDisplay();
                    return;
                }
                const topLeft = getVisibleCell(minR, minC);
                getCell(maxR, maxC);
                if (topLeft) {
                    selectedCellsDisplay.blur();
                    clearSelection();
                    setActiveCell(topLeft, true);
                    selectionStart = { row: minR, col: minC };
                    selectionEnd = { row: maxR, col: maxC };
                    updateSelection();
                    updateFillHandle();
                    topLeft.scrollIntoView({ block: "nearest", inline: "nearest" });
                }
                return;
            }
        } else {
            const pos = parseCellReference(inputRef);
            if (pos && pos.row >= 1 && pos.col >= 0) {
                if (pos.row > MAX_NAV_ROW || pos.col >= MAX_NAV_COL) {
                    showAlert(`移動できる上限は ${MAX_NAV_ROW} 行・${MAX_NAV_COL} 列までです。`, "名前ボックス");
                    updateSelectedCellsDisplay();
                    return;
                }
                selectedCellsDisplay.blur();
                navigateToCell(pos.row, pos.col, e);
                return;
            }
        }
        showAlert("有効なセル番地または範囲（例: B5 または A1:D10）を入力してください。", "名前ボックス");
        updateSelectedCellsDisplay();
    }, { signal });

    // =========================================================
    // セル選択・アクティブ管理・編集遷移
    // =========================================================
    function getCellPureText(cell) {
        if (!cell) return "";
        if (cell.dataset.rawValue !== undefined) return cell.dataset.rawValue;
        let txt = "";
        cell.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                txt += node.nodeValue;
            } else if (
                node.nodeType === Node.ELEMENT_NODE &&
                !node.classList.contains("ss-filter-arrow") &&
                !node.classList.contains("fill-handle")
            ) {
                txt += node.textContent;
            }
        });
        return txt;
    }

    // =========================================================
    // セル内プルダウン・データの入力規則・ハイパーリンク（data-validation.js）
    // =========================================================
    const {
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
    } = createDataValidationModule({
        win,
        signal,
        container,
        spreadsheetContent,
        table,
        theadRow,
        tbody,
        formulaBarInput,
        getActiveCell: () => activeCell,
        getSheets: () => sheets,
        getActiveSheetIndex: () => activeSheetIndex,
        getCurrentColumns: () => currentColumns,
        getRowCount: () => rowCount,
        getCachedTableWidth: () => cachedTableWidth,
        isCurrentSheetProtected: () => isCurrentSheetProtected(),
        isCellLockedForEdit: (cell) => isCellLockedForEdit(cell),
        isCellEditing: (cell) => isCellEditing(cell),
        loadColumnsSync,
        loadRowsSync,
        peekCell,
        getVisibleCell,
        getCellPureText: (cell) => getCellPureText(cell),
        getBackgroundSheetCellMap: (sheetObj) => getBackgroundSheetCellMap(sheetObj),
        evaluateFormula: (...args) => evaluateFormula(...args),
        adjustFormula: (f, dr, dc) => adjustFormula(f, dr, dc),
        clearFormulaEvalCache: () => clearFormulaEvalCache(),
        commitCellValue: (cell, val) => commitCellValue(cell, val),
        setCellFormattedValue: (cell, val) => setCellFormattedValue(cell, val),
        setActiveCell: (cell, shouldFocus) => setActiveCell(cell, shouldFocus),
        updateSelectedCellsDisplay: () => updateSelectedCellsDisplay(),
        switchToSheet: (idx) => switchToSheet(idx),
        navigateToCell: (r, c, e) => navigateToCell(r, c, e),
        flushPendingEdits: () => flushPendingEdits(),
        openAppModal: (...args) => openAppModal(...args),
        openSheetRangePicker: (opts) => openSheetRangePicker(opts),
        showAlert: (...args) => showAlert(...args),
        showDataValidationDialog: (opts) => showDataValidationDialog(opts),
        setDirtyState: (flag) => setDirtyState(flag),
        debouncedSaveState: (delay) => debouncedSaveState(delay)
    });

    function getCellEditableValue(cell) {
        if (!cell) return "";
        if (cell.dataset.formula) return cell.dataset.formula;
        const quotePrefix = cell.dataset.quotePrefix === "1" ? "'" : "";
        const raw = cell.dataset.rawValue !== undefined ? cell.dataset.rawValue : getCellPureText(cell);
        if (!quotePrefix && isTimeNumFormat(cell.dataset.numFormat)) {
            const n = parseFormattedNumber(raw);
            if (!isNaN(n)) return formatTimeFromSerial(n, true);
        }
        if (!quotePrefix && (cell.dataset.valueType === "date" || isDateNumFormat(cell.dataset.numFormat))) {
            const dt = resolveDateFromRawValue(raw);
            if (dt) return formatDate(dt);
        }
        return quotePrefix + raw;
    }

    function setActiveCell(cell, shouldFocus = true, { skipHeaderSync = false } = {}) {
        if (!cell) return;
        closeCellDropdownList();
        if (activeCell && activeCell !== cell) {
            activeCell.classList.remove("active-cell");
        }
        activeCell = cell;
        activeCell.classList.add("active-cell");
        if (!activeCell.classList.contains("selected")) {
            activeCell.classList.add("selected");
        }
        attachCellDropdownButton(activeCell);
        if (shouldFocus && !isCellEditing(activeCell)) {
            const curFocused = document.activeElement;
            if (curFocused && curFocused !== activeCell && (curFocused === formulaBarInput || curFocused.closest(".floating-textbox"))) {
                curFocused.blur();
            }
            activeCell.focus({ preventScroll: true });
        }
        showDataValidationTooltip(activeCell);
        if (isCurrentSheetProtected() && activeCell.dataset.formulaHidden === "1" && activeCell.dataset.formula) {
            formulaBarInput.value = "";
        } else if (activeCell.dataset.formula) {
            formulaBarInput.value = activeCell.dataset.formula;
        } else if (activeCell.dataset.spillOrigin) {
            const [sr, sc] = activeCell.dataset.spillOrigin.split(",").map(Number);
            const originCell = peekCell(sr, sc);
            formulaBarInput.value = originCell?.dataset.formula || getCellEditableValue(activeCell);
        } else {
            formulaBarInput.value = getCellEditableValue(activeCell);
        }
        delete formulaBarInput.dataset.manualHeight;
        autoResizeFormulaBar();
        if (!skipHeaderSync) {
            updateHeaderSelectionHighlights(Array.from(tbody.querySelectorAll("td.selected")));
        }
        syncFilterButtonState(activeCell);
    }

    const SEL_EDGE_CLASSES = ["sel-edge-top", "sel-edge-bottom", "sel-edge-left", "sel-edge-right"];
    const selectionBox = document.createElement("div");
    selectionBox.className = "ss-selection-box";
    spreadsheetContent.appendChild(selectionBox);
    let selectionBoxBounds = null;
    let highlightedHeaderEls = [];

    function hasCellBackgroundFill(td) {
        if (!td || td.style.display === "none") return false;
        const bg = td.style.backgroundColor;
        return Boolean(bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)");
    }

    function hasCellExplicitBorder(td, sideProp) {
        if (!td || td.style.display === "none") return false;
        const val = td.style[sideProp];
        return Boolean(val && val !== "none" && !val.startsWith("0px"));
    }

    function syncSingleCellGridlines(td) {
        if (!td || td.tagName !== "TD" || !td.isConnected || td.style.display === "none") return;

        const r0 = parseInt(td.dataset.row, 10);
        const c0 = parseInt(td.dataset.col, 10);
        const rs = parseInt(td.getAttribute("rowspan") || "1", 10);
        const cs = parseInt(td.getAttribute("colspan") || "1", 10);

        const hasFill = hasCellBackgroundFill(td);
        td.classList.toggle("ss-has-fill", hasFill);

        if (hasFill) {
            const bg = td.style.backgroundColor;
            td.style.setProperty("--ss-fill-bg", bg);
            td.classList.remove("ss-no-gl-r", "ss-no-gl-b");

            // 同色塗りつぶしが右に隣接し、双方に明示罫線がない場合のみシーム埋め
            let seamRight = false;
            if (!hasCellExplicitBorder(td, "borderRight") && c0 + cs < currentColumns) {
                seamRight = true;
                for (let rr = r0; rr < r0 + rs; rr++) {
                    const rawRight = peekCell(rr, c0 + cs);
                    const rightTd = rawRight && rawRight.style.display === "none"
                        ? getVisibleCell(rr, c0 + cs)
                        : rawRight;
                    if (
                        !rightTd ||
                        rightTd.style.backgroundColor !== bg ||
                        hasCellExplicitBorder(rightTd, "borderLeft")
                    ) {
                        seamRight = false;
                        break;
                    }
                }
            }

            // 同色塗りつぶしが下に隣接し、双方に明示罫線がない場合のみシーム埋め
            let seamBottom = false;
            if (!hasCellExplicitBorder(td, "borderBottom") && r0 + rs <= tbody.rows.length) {
                seamBottom = true;
                for (let cc = c0; cc < c0 + cs; cc++) {
                    const rawBelow = peekCell(r0 + rs, cc);
                    const belowTd = rawBelow && rawBelow.style.display === "none"
                        ? getVisibleCell(r0 + rs, cc)
                        : rawBelow;
                    if (
                        !belowTd ||
                        belowTd.style.backgroundColor !== bg ||
                        hasCellExplicitBorder(belowTd, "borderTop")
                    ) {
                        seamBottom = false;
                        break;
                    }
                }
            }

            td.classList.toggle("ss-fill-seam-r", seamRight);
            td.classList.toggle("ss-fill-seam-b", seamBottom);
            return;
        }

        td.classList.remove("ss-fill-seam-r", "ss-fill-seam-b");
        td.style.removeProperty("--ss-fill-bg");

        let hideRight = hasCellExplicitBorder(td, "borderRight");
        if (!hideRight && c0 + cs < currentColumns) {
            let allRightFilled = true;
            for (let rr = r0; rr < r0 + rs; rr++) {
                const rawRight = peekCell(rr, c0 + cs);
                const rightTd = rawRight && rawRight.style.display === "none"
                    ? getVisibleCell(rr, c0 + cs)
                    : rawRight;
                if (hasCellExplicitBorder(rightTd, "borderLeft")) {
                    hideRight = true;
                    break;
                }
                if (!hasCellBackgroundFill(rightTd)) {
                    allRightFilled = false;
                }
            }
            if (!hideRight && allRightFilled) hideRight = true;
        }

        let hideBottom = hasCellExplicitBorder(td, "borderBottom");
        if (!hideBottom && r0 + rs <= tbody.rows.length) {
            let allBelowFilled = true;
            for (let cc = c0; cc < c0 + cs; cc++) {
                const rawBelow = peekCell(r0 + rs, cc);
                const belowTd = rawBelow && rawBelow.style.display === "none"
                    ? getVisibleCell(r0 + rs, cc)
                    : rawBelow;
                if (hasCellExplicitBorder(belowTd, "borderTop")) {
                    hideBottom = true;
                    break;
                }
                if (!hasCellBackgroundFill(belowTd)) {
                    allBelowFilled = false;
                }
            }
            if (!hideBottom && allBelowFilled) hideBottom = true;
        }

        td.classList.toggle("ss-no-gl-r", hideRight);
        td.classList.toggle("ss-no-gl-b", hideBottom);
    }

    function syncCellGridlinesForCells(cells) {
        if (!cells) return;
        const list = Array.isArray(cells) ? cells : Array.from(cells);
        if (!list.length) return;

        const toSync = new Set();
        for (let i = 0; i < list.length; i++) {
            const raw = list[i];
            if (!raw || raw.tagName !== "TD" || !raw.isConnected) continue;
            const r0 = parseInt(raw.dataset.row, 10);
            const c0 = parseInt(raw.dataset.col, 10);
            const td = raw.style.display === "none" ? getVisibleCell(r0, c0) : raw;
            if (!td || td.style.display === "none") continue;

            toSync.add(td);
            const aR = parseInt(td.dataset.row, 10);
            const aC = parseInt(td.dataset.col, 10);
            const rs = parseInt(td.getAttribute("rowspan") || "1", 10);
            const cs = parseInt(td.getAttribute("colspan") || "1", 10);

            if (aC > 0) {
                for (let rr = aR; rr < aR + rs; rr++) {
                    const leftRaw = peekCell(rr, aC - 1);
                    const leftTd = leftRaw && leftRaw.style.display === "none" ? getVisibleCell(rr, aC - 1) : leftRaw;
                    if (leftTd && leftTd.style.display !== "none") toSync.add(leftTd);
                }
            }
            if (aR > 1) {
                for (let cc = aC; cc < aC + cs; cc++) {
                    const topRaw = peekCell(aR - 1, cc);
                    const topTd = topRaw && topRaw.style.display === "none" ? getVisibleCell(aR - 1, cc) : topRaw;
                    if (topTd && topTd.style.display !== "none") toSync.add(topTd);
                }
            }
        }
        toSync.forEach(syncSingleCellGridlines);
    }

    function syncCellGridlinesForBounds(bounds) {
        if (!bounds) return;
        const minR = Math.max(1, bounds.minRow);
        const maxR = Math.min(tbody.rows.length, bounds.maxRow);
        const minC = Math.max(0, bounds.minCol);
        const maxC = Math.min(currentColumns - 1, bounds.maxCol);
        const cells = [];
        for (let r = minR; r <= maxR; r++) {
            for (let c = minC; c <= maxC; c++) {
                const td = peekCell(r, c);
                if (td && td.style.display !== "none") cells.push(td);
            }
        }
        syncCellGridlinesForCells(cells);
    }

    function syncSelectionBoxPosition() {
        if (!selectionBoxBounds) {
            selectionBox.style.display = "none";
            return;
        }
        const { minRow, maxRow, minCol, maxCol } = selectionBoxBounds;
        const contentRect = spreadsheetContent.getBoundingClientRect();
        if (contentRect.width === 0 || contentRect.height === 0) {
            selectionBox.style.display = "none";
            return;
        }

        let firstVisR = minRow;
        while (firstVisR <= maxRow && getRow(firstVisR)?.style.display === "none") firstVisR++;
        let lastVisR = maxRow;
        while (lastVisR >= firstVisR && getRow(lastVisR)?.style.display === "none") lastVisR--;

        let firstVisC = minCol;
        while (firstVisC <= maxCol && theadRow.children[firstVisC + 1]?.classList.contains("ss-col-hidden")) firstVisC++;
        let lastVisC = maxCol;
        while (lastVisC >= firstVisC && theadRow.children[lastVisC + 1]?.classList.contains("ss-col-hidden")) lastVisC--;

        if (firstVisR > lastVisR || firstVisC > lastVisC) {
            selectionBox.style.display = "none";
            return;
        }

        const tlCell = getVisibleCell(firstVisR, firstVisC);
        const brCell = getVisibleCell(lastVisR, lastVisC);
        if (!tlCell || !brCell) {
            selectionBox.style.display = "none";
            return;
        }

        const zoom = parseFloat(spreadsheetContent.style.zoom || "1") || 1;
        const tlRect = tlCell.getBoundingClientRect();
        const brRect = brCell.getBoundingClientRect();
        const left = (tlRect.left - contentRect.left) / zoom;
        const top = (tlRect.top - contentRect.top) / zoom;
        const right = (brRect.right - contentRect.left) / zoom;
        const bottom = (brRect.bottom - contentRect.top) / zoom;

        if (right <= left || bottom <= top) {
            selectionBox.style.display = "none";
            return;
        }

        const isFrozenSelection =
            (freezeRows > 0 && lastVisR <= freezeRows) ||
            (freezeCols > 0 && lastVisC < freezeCols);

        selectionBox.classList.toggle("is-frozen", isFrozenSelection);
        selectionBox.style.left = `${left}px`;
        selectionBox.style.top = `${top}px`;
        selectionBox.style.width = `${Math.max(4, right - left)}px`;
        selectionBox.style.height = `${Math.max(4, bottom - top)}px`;
        selectionBox.style.display = "block";
    }

    function clearHeaderSelectionHighlights() {
        for (let i = 0; i < highlightedHeaderEls.length; i++) {
            highlightedHeaderEls[i].classList.remove("header-selected", "header-full-selected");
        }
        highlightedHeaderEls = [];
    }

    function updateHeaderSelectionHighlights(selectedCells = null) {
        clearHeaderSelectionHighlights();
        const targets = selectedCells && selectedCells.length
            ? selectedCells
            : (activeCell ? [activeCell] : []);
        if (!targets.length) return;

        const rowSet = new Set();
        const colSet = new Set();
        for (let i = 0; i < targets.length; i++) {
            const cell = targets[i];
            const r0 = +cell.dataset.row;
            const c0 = +cell.dataset.col;
            const r1 = r0 + (+cell.getAttribute("rowspan") || 1) - 1;
            const c1 = c0 + (+cell.getAttribute("colspan") || 1) - 1;
            for (let r = r0; r <= r1; r++) rowSet.add(r);
            for (let c = c0; c <= c1; c++) colSet.add(c);
        }

        let visibleRowCount = 0;
        for (let r = 0; r < tbody.rows.length; r++) {
            if (tbody.rows[r].style.display !== "none") visibleRowCount++;
        }
        let visibleColCount = 0;
        for (let c = 0; c < currentColumns; c++) {
            if (!theadRow.children[c + 1]?.classList.contains("ss-col-hidden")) visibleColCount++;
        }
        const isFullCol = visibleRowCount > 0 && rowSet.size >= visibleRowCount;
        const isFullRow = visibleColCount > 0 && colSet.size >= visibleColCount;

        colSet.forEach(c => {
            const th = theadRow.children[c + 1];
            if (!th) return;
            th.classList.add("header-selected");
            if (isFullCol) th.classList.add("header-full-selected");
            highlightedHeaderEls.push(th);
        });

        rowSet.forEach(r => {
            const tr = tbody.rows[r - 1];
            const th = tr?.cells?.[0];
            if (!th) return;
            th.classList.add("header-selected");
            if (isFullRow) th.classList.add("header-full-selected");
            highlightedHeaderEls.push(th);
        });
    }

    let selectionEdgeEls = [];

    function clearSelectionEdges() {
        for (let i = 0; i < selectionEdgeEls.length; i++) {
            selectionEdgeEls[i].classList.remove(...SEL_EDGE_CLASSES);
        }
        selectionEdgeEls = [];
        selectionBoxBounds = null;
        selectionBox.style.display = "none";
        table.classList.remove("ss-sel-multi");
    }

    function buildSelectedCoordsSet(selected) {
        const coords = new Set();
        for (let i = 0; i < selected.length; i++) {
            const c = selected[i];
            const r0 = +c.dataset.row;
            const c0 = +c.dataset.col;
            const r1 = r0 + (+c.getAttribute("rowspan") || 1) - 1;
            const c1 = c0 + (+c.getAttribute("colspan") || 1) - 1;
            for (let r = r0; r <= r1; r++) {
                for (let col = c0; col <= c1; col++) {
                    coords.add(`${r},${col}`);
                }
            }
        }
        return coords;
    }

    function updateSelectionEdges(preQueriedSelected = null) {
        clearSelectionEdges();
        const selected = preQueriedSelected || Array.from(tbody.querySelectorAll("td.selected"));
        updateHeaderSelectionHighlights(selected);
        if (!selected.length) return;

        // 連続矩形かどうかを O(N) の数値比較のみで判定（文字列アロケーションなし）
        let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
        let coveredCount = 0;
        for (let i = 0; i < selected.length; i++) {
            const c = selected[i];
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

        const isSingleRect = coveredCount === (maxR - minR + 1) * (maxC - minC + 1);
        if (isSingleRect) {
            table.classList.remove("ss-sel-multi");
            for (let i = 0; i < selected.length; i++) {
                const c = selected[i];
                const r0 = +c.dataset.row;
                const c0 = +c.dataset.col;
                const r1 = r0 + (+c.getAttribute("rowspan") || 1) - 1;
                const c1 = c0 + (+c.getAttribute("colspan") || 1) - 1;
                const edgeT = r0 === minR;
                const edgeB = r1 === maxR;
                const edgeL = c0 === minC;
                const edgeR = c1 === maxC;
                if (!edgeT && !edgeB && !edgeL && !edgeR) continue;
                if (edgeT) c.classList.add("sel-edge-top");
                if (edgeB) c.classList.add("sel-edge-bottom");
                if (edgeL) c.classList.add("sel-edge-left");
                if (edgeR) c.classList.add("sel-edge-right");
                selectionEdgeEls.push(c);
            }
            selectionBoxBounds = { minRow: minR, maxRow: maxR, minCol: minC, maxCol: maxC };
            syncSelectionBoxPosition();
            return;
        }

        // 非連続（Ctrl 複数範囲）選択時のみ隣接座標 Set で各範囲の4辺枠を描画
        table.classList.add("ss-sel-multi");
        const covered = buildSelectedCoordsSet(selected);
        for (let i = 0; i < selected.length; i++) {
            const c = selected[i];
            const r0 = +c.dataset.row;
            const c0 = +c.dataset.col;
            const r1 = r0 + (+c.getAttribute("rowspan") || 1) - 1;
            const c1 = c0 + (+c.getAttribute("colspan") || 1) - 1;

            let edgeT = false, edgeB = false, edgeL = false, edgeR = false;
            for (let col = c0; col <= c1; col++) {
                if (!covered.has(`${r0 - 1},${col}`)) edgeT = true;
                if (!covered.has(`${r1 + 1},${col}`)) edgeB = true;
            }
            for (let row = r0; row <= r1; row++) {
                if (!covered.has(`${row},${c0 - 1}`)) edgeL = true;
                if (!covered.has(`${row},${c1 + 1}`)) edgeR = true;
            }

            if (edgeT) c.classList.add("sel-edge-top");
            if (edgeB) c.classList.add("sel-edge-bottom");
            if (edgeL) c.classList.add("sel-edge-left");
            if (edgeR) c.classList.add("sel-edge-right");
            if (edgeT || edgeB || edgeL || edgeR) selectionEdgeEls.push(c);
        }
    }

    function clearSelection() {
        clearHeaderSelectionHighlights();
        clearSelectionEdges();
        tbody.querySelectorAll("td.selected, td.active-cell, td.transparent").forEach(c => {
            c.classList.remove("selected", "active-cell", "transparent", ...SEL_EDGE_CLASSES);
        });
    }

    let isFormulaBarDirty = false;

    const cellEditor = document.createElement("textarea");
    cellEditor.className = "ss-cell-editor";
    cellEditor.spellcheck = false;
    cellEditor.setAttribute("autocomplete", "off");
    spreadsheetContent.appendChild(cellEditor);

    let editingCell = null;
    let editingRichRuns = null;
    let savedEditorSelection = { start: 0, end: 0 };

    // ----- セル編集中テキスト選択ミニツールバー -----
    const inlineMiniToolbar = document.createElement("div");
    inlineMiniToolbar.className = "ss-inline-mini-toolbar";
    inlineMiniToolbar.innerHTML = `
        <span class="ss-mt-btn" data-mt-style="bold" title="選択文字を太字">B</span>
        <span class="ss-mt-btn" data-mt-style="italic" style="font-style:italic;" title="選択文字を斜体">i</span>
        <span class="ss-mt-btn" data-mt-style="underline" style="text-decoration:underline;" title="選択文字に下線">U</span>
        <span class="ss-mt-btn" data-mt-style="strike" style="text-decoration:line-through;" title="選択文字に取り消し線">S</span>
        <span class="ss-mt-sep"></span>
        <span class="ss-mt-swatch" data-mt-color="#000000" style="background:#000000;" title="黒"></span>
        <span class="ss-mt-swatch" data-mt-color="#FF0000" style="background:#FF0000;" title="赤"></span>
        <span class="ss-mt-swatch" data-mt-color="#0000FF" style="background:#0000FF;" title="青"></span>
        <span class="ss-mt-swatch" data-mt-color="#008000" style="background:#008000;" title="緑"></span>
        <span class="ss-mt-swatch" data-mt-color="#FF8C00" style="background:#FF8C00;" title="オレンジ"></span>
        <span class="ss-mt-swatch" data-mt-color="#800080" style="background:#800080;" title="紫"></span>
        <input type="color" class="ss-mt-color-input" value="#ff0000" title="詳細色を選択">
        <span class="ss-mt-btn" data-mt-clear="1" title="選択文字の書式をクリア" style="font-weight:normal;">戻</span>
    `;
    document.body.appendChild(inlineMiniToolbar);
    signal.addEventListener("abort", () => inlineMiniToolbar.remove(), { once: true });

    function normalizeRichRuns(runs) {
        const merged = [];
        for (const r of runs) {
            if (!r.text) continue;
            const st = r.style || {};
            const key = JSON.stringify(st);
            if (merged.length && JSON.stringify(merged[merged.length - 1].style || {}) === key) {
                merged[merged.length - 1].text += r.text;
            } else {
                merged.push({ text: r.text, style: { ...st } });
            }
        }
        return merged;
    }

    function syncRichRunsWithText(runs, newText) {
        const str = String(newText ?? "");
        if (!runs || !runs.length) return [{ text: str, style: {} }];
        const oldText = runs.map(r => r.text).join("");
        if (oldText === str) return runs;

        // 先頭と末尾の共通部分を維持して、変更された中央部分だけ置き換える
        let p = 0;
        while (p < oldText.length && p < str.length && oldText[p] === str[p]) p++;
        let s = 0;
        while (s < oldText.length - p && s < str.length - p && oldText[oldText.length - 1 - s] === str[str.length - 1 - s]) s++;

        const charStyles = [];
        for (const r of runs) {
            for (let i = 0; i < r.text.length; i++) charStyles.push(r.style || {});
        }
        const insertedStyle = p > 0 ? { ...(charStyles[p - 1] || {}) } : {};
        const nextChars = [];
        for (let i = 0; i < p; i++) nextChars.push({ text: str[i], style: charStyles[i] || {} });
        for (let i = p; i < str.length - s; i++) nextChars.push({ text: str[i], style: insertedStyle });
        for (let i = 0; i < s; i++) {
            const oldIdx = oldText.length - s + i;
            nextChars.push({ text: str[str.length - s + i], style: charStyles[oldIdx] || {} });
        }
        return normalizeRichRuns(nextChars);
    }

    function applyPartialStyleToEditor(patch) {
        if (!editingCell || !isCellEditing(editingCell)) return;
        const text = cellEditor.value;
        if (!text || text.trimStart().startsWith("=")) return;

        let start = cellEditor.selectionStart;
        let end = cellEditor.selectionEnd;
        if (start === end) {
            start = savedEditorSelection.start;
            end = savedEditorSelection.end;
        }
        if (start === end || start < 0 || end > text.length) return;

        const baseRuns = syncRichRunsWithText(editingRichRuns, text);
        const chars = [];
        for (const r of baseRuns) {
            for (let i = 0; i < r.text.length; i++) {
                chars.push({ text: r.text[i], style: { ...(r.style || {}) } });
            }
        }

        const slice = chars.slice(start, end);
        for (const ch of slice) {
            if (patch.clear) {
                ch.style = {};
            } else {
                if (patch.color !== undefined) {
                    if (patch.color) ch.style.color = patch.color;
                    else delete ch.style.color;
                }
                for (const flag of ["bold", "italic", "underline", "strike"]) {
                    if (patch[flag] === "toggle") {
                        const allOn = slice.every(c => Boolean(c.style[flag]));
                        if (allOn) delete ch.style[flag];
                        else ch.style[flag] = true;
                    }
                }
            }
        }

        editingRichRuns = normalizeRichRuns(chars);
        // フォーカスと選択範囲を復元
        cellEditor.focus();
        cellEditor.setSelectionRange(start, end);
        savedEditorSelection = { start, end };
    }

    function hideInlineMiniToolbar() {
        inlineMiniToolbar.style.display = "none";
    }

    function updateInlineMiniToolbar() {
        if (!editingCell || !isCellEditing(editingCell)) {
            hideInlineMiniToolbar();
            return;
        }
        const val = cellEditor.value;
        const start = cellEditor.selectionStart ?? 0;
        const end = cellEditor.selectionEnd ?? 0;
        if (start === end || val.trimStart().startsWith("=")) {
            hideInlineMiniToolbar();
            return;
        }
        savedEditorSelection = { start, end };
        const rect = cellEditor.getBoundingClientRect();
        inlineMiniToolbar.style.display = "flex";
        const tbW = inlineMiniToolbar.offsetWidth || 260;
        const tbH = inlineMiniToolbar.offsetHeight || 30;
        const left = Math.min(window.innerWidth - tbW - 8, Math.max(8, rect.left));
        const top = rect.top - tbH - 6 >= 8 ? rect.top - tbH - 6 : rect.bottom + 6;
        inlineMiniToolbar.style.left = `${left}px`;
        inlineMiniToolbar.style.top = `${top}px`;
    }

    // mousedownでフォーカス移動を抑止（color inputのみネイティブUIを開くため除外）
    inlineMiniToolbar.addEventListener("mousedown", (e) => {
        if (e.target.classList.contains("ss-mt-color-input")) {
            savedEditorSelection = {
                start: cellEditor.selectionStart ?? savedEditorSelection.start,
                end: cellEditor.selectionEnd ?? savedEditorSelection.end
            };
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        const styleBtn = e.target.closest("[data-mt-style]");
        if (styleBtn) {
            applyPartialStyleToEditor({ [styleBtn.dataset.mtStyle]: "toggle" });
            return;
        }
        const swatch = e.target.closest("[data-mt-color]");
        if (swatch) {
            applyPartialStyleToEditor({ color: swatch.dataset.mtColor });
            return;
        }
        if (e.target.closest("[data-mt-clear]")) {
            applyPartialStyleToEditor({ clear: true });
        }
    }, { signal });

    inlineMiniToolbar.querySelector(".ss-mt-color-input").addEventListener("change", (e) => {
        applyPartialStyleToEditor({ color: e.target.value });
    }, { signal });

    function isCellEditing(cell = activeCell) {
        return Boolean(cell && editingCell === cell && cellEditor.style.display !== "none");
    }

    let editorMetricsCache = null;

    function computeCellEditorMetrics(cell) {
        let left = 0;
        let top = 0;
        let el = cell;
        while (el && el !== spreadsheetContent) {
            left += el.offsetLeft;
            top += el.offsetTop;
            el = el.offsetParent;
        }
        const cellW = cell.offsetWidth || DEFAULT_COL_WIDTH;
        const cellH = cell.offsetHeight || DEFAULT_ROW_HEIGHT;
        const computed = getComputedStyle(cell);
        const fStyle = cell.style.fontStyle || computed.fontStyle || "normal";
        const fWeight = cell.style.fontWeight || computed.fontWeight || "normal";
        const fSize = cell.style.fontSize || DEFAULT_FONT_SIZE_CSS;
        const fFamily = cell.style.fontFamily || computed.fontFamily || DEFAULT_FONT_FAMILY;
        const fSizeNum = cssFontSizeToPx(fSize);
        const computedLH = parseFloat(computed.lineHeight);
        const lineHeightPx = !Number.isNaN(computedLH) ? computedLH : Math.round(fSizeNum * 1.25);
        const valign = cell.style.verticalAlign || computed.verticalAlign || "middle";
        const writingMode = cell.style.writingMode || computed.writingMode || "horizontal-tb";
        const textOrientation = cell.style.textOrientation || computed.textOrientation || "mixed";
        const isVertical = writingMode === "vertical-rl" || writingMode === "vertical-lr";

        return {
            cell, left, top, cellW, cellH, minH: Math.max(cellH, DEFAULT_ROW_HEIGHT),
            computed, fStyle, fWeight, fSize, fSizeNum, fFamily, lineHeightPx, valign,
            writingMode, textOrientation, isVertical
        };
    }

    function resolveEditorAutoAlign(cell, rawInput) {
        const trimmed = String(rawInput ?? "").trim();
        // 数式(=始まり)の編集中は、セルの明示的な配置指定にかかわらず左揃え（Excel準拠）
        if (trimmed.startsWith("=")) {
            return "left";
        }
        // ユーザーが明示的に水平配置を設定しているセルのみ、その配置を維持（均等割り付けは編集時左揃え）
        if (cell.style.textAlign) {
            return cell.style.textAlign === "justify" ? "left" : cell.style.textAlign;
        }
        // 標準配置（未指定）のセルは、数値・日付・論理値の入力／再編集中も常に左揃え（確定後に自動配置へ切替）
        return "left";
    }

    function syncCellEditorLayout(cell, forceMeasure = false) {
        if (!cell) return;
        const editorAlign = resolveEditorAutoAlign(cell, cellEditor.value);

        if (forceMeasure || !editorMetricsCache || editorMetricsCache.cell !== cell) {
            editorMetricsCache = computeCellEditorMetrics(cell);
            const m = editorMetricsCache;
            const c = m.computed;
            cellEditor.style.left = `${m.left}px`;
            cellEditor.style.top = `${m.top}px`;
            cellEditor.style.minHeight = `${m.minH}px`;
            cellEditor.style.scrollbarWidth = "none";
            cellEditor.style.msOverflowStyle = "none";
            cellEditor.style.fontFamily = m.fFamily;
            cellEditor.style.fontSize = m.fSize;
            cellEditor.style.fontWeight = m.fWeight;
            cellEditor.style.fontStyle = m.fStyle;
            cellEditor.style.writingMode = m.isVertical ? m.writingMode : "horizontal-tb";
            cellEditor.style.textOrientation = m.isVertical ? m.textOrientation : "";
            cellEditor.style.textDecoration = cell.style.textDecoration || c.textDecoration || "none";
            cellEditor.style.textShadow = cell.style.textShadow || c.textShadow || "none";
            cellEditor.style.letterSpacing = cell.style.letterSpacing || c.letterSpacing || "normal";
            cellEditor.style.wordSpacing = cell.style.wordSpacing || c.wordSpacing || "normal";
            cellEditor.style.fontKerning = c.fontKerning || "auto";
            cellEditor.style.fontFeatureSettings = c.fontFeatureSettings || "normal";
            cellEditor.style.fontVariantLigatures = c.fontVariantLigatures || "normal";
            cellEditor.style.textRendering = c.textRendering || "auto";
            cellEditor.style.webkitFontSmoothing = c.webkitFontSmoothing || "antialiased";
            cellEditor.style.backgroundColor = cell.style.backgroundColor || c.backgroundColor || "#fff";
            cellEditor.style.color = cell.style.color || c.color || "#000";
            cellEditor.style.lineHeight = `${m.lineHeightPx}px`;
        }
        cellEditor.style.textAlign = editorAlign;

        const m = editorMetricsCache;
        const text = cellEditor.value ?? "";
        const lines = text.split("\n");
        const isWrapped = cell.style.whiteSpace === "pre-wrap";

        // 縦書きセル（writing-mode: vertical-rl / vertical-lr）専用レイアウト計算
        if (m.isVertical) {
            const vAlign = cell.style.verticalAlign === "bottom"
                ? "bottom"
                : (cell.style.verticalAlign === "middle" ? "middle" : "top");
            const hAlign = cell.style.textAlign === "center"
                ? "center"
                : (cell.style.textAlign === "left" ? "left" : "right");

            // 縦書きでは text-align が上下（インライン方向）を制御する
            cellEditor.style.textAlign = vAlign === "bottom"
                ? "end"
                : (vAlign === "middle" ? "center" : "start");

            const theadHeight = theadRow.offsetHeight || DEFAULT_HEADER_HEIGHT;
            const rowHeaderWidth = parseInt(colgroup.children[0]?.style.width, 10) || DEFAULT_ROW_HEADER_WIDTH;
            const tableRight = Math.max(table.offsetWidth, cachedTableWidth, m.left + m.cellW);
            const tableBottom = Math.max(table.offsetHeight, m.top + m.cellH);
            const charAdvance = Math.ceil(m.fSizeNum * 1.15);

            let targetTop = m.top;
            let targetH = m.minH;

            if (!isWrapped) {
                const maxCharsInLine = Math.max(1, ...lines.map(l => Array.from(l).length));
                const neededH = Math.max(m.minH, maxCharsInLine * charAdvance + 14);
                if (vAlign === "bottom") {
                    const maxH = Math.max(m.minH, (m.top + m.cellH) - theadHeight);
                    targetH = Math.min(neededH, maxH);
                    targetTop = (m.top + m.cellH) - targetH;
                } else if (vAlign === "middle") {
                    const maxH = Math.max(m.minH, tableBottom - theadHeight);
                    targetH = Math.min(neededH, maxH);
                    const centerY = m.top + m.cellH / 2;
                    targetTop = Math.round(centerY - targetH / 2);
                    if (targetTop < theadHeight) targetTop = theadHeight;
                    if (targetTop + targetH > tableBottom) targetTop = Math.max(theadHeight, tableBottom - targetH);
                } else {
                    const maxH = Math.max(m.minH, tableBottom - m.top);
                    targetH = Math.min(neededH, maxH);
                    targetTop = m.top;
                }
            }

            let visualCols = lines.length;
            if (isWrapped) {
                const innerH = Math.max(16, targetH - 12);
                const charsPerCol = Math.max(1, Math.floor(innerH / charAdvance));
                visualCols = 0;
                for (let i = 0; i < lines.length; i++) {
                    const len = Array.from(lines[i]).length;
                    visualCols += Math.max(1, Math.ceil((len || 1) / charsPerCol));
                }
            }

            const textBlockW = visualCols * m.lineHeightPx;
            const neededW = Math.max(m.cellW, textBlockW + 14);
            let targetW = m.cellW;
            let targetLeft = m.left;

            if (m.writingMode === "vertical-lr") {
                const maxW = Math.max(m.cellW, tableRight - m.left);
                targetW = Math.min(neededW, maxW);
                targetLeft = m.left;
            } else {
                // vertical-rl は右から左へ列が増えるため、セル右端を基準に左方向へ拡張
                const maxW = Math.max(m.cellW, (m.left + m.cellW) - rowHeaderWidth);
                targetW = Math.min(neededW, maxW);
                targetLeft = (m.left + m.cellW) - targetW;
            }

            const padY = 4;
            const innerBoxW = Math.max(0, targetW - 4);
            let padRight = 4;
            let padLeft = 4;
            if (!isWrapped && textBlockW < innerBoxW - 8) {
                if (hAlign === "center") {
                    const offsetPad = Math.max(4, Math.floor((innerBoxW - textBlockW) / 2));
                    if (m.writingMode === "vertical-lr") padLeft = offsetPad;
                    else padRight = offsetPad;
                } else if (hAlign === "left" && m.writingMode !== "vertical-lr") {
                    padRight = Math.max(4, innerBoxW - textBlockW - 4);
                } else if (hAlign === "right" && m.writingMode === "vertical-lr") {
                    padLeft = Math.max(4, innerBoxW - textBlockW - 4);
                }
            }

            cellEditor.style.left = `${targetLeft}px`;
            cellEditor.style.top = `${targetTop}px`;
            cellEditor.style.width = `${targetW}px`;
            cellEditor.style.height = `${targetH}px`;
            cellEditor.style.whiteSpace = isWrapped ? "pre-wrap" : "pre";
            cellEditor.style.padding = `${padY}px ${padRight}px ${padY}px ${padLeft}px`;
            return;
        }
        if (measureCtx) {
            measureCtx.font = `${m.fStyle} ${m.fWeight} ${m.fSizeNum}px ${m.fFamily}`;
        }
        let maxTextWidth = 0;
        for (let i = 0; i < lines.length; i++) {
            const w = measureCtx ? measureCtx.measureText(lines[i]).width : lines[i].length * m.fSizeNum;
            if (w > maxTextWidth) maxTextWidth = w;
        }

        const rowHeaderWidth = parseInt(colgroup.children[0]?.style.width, 10) || DEFAULT_ROW_HEADER_WIDTH;
        const tableRight = Math.max(table.offsetWidth, cachedTableWidth, m.left + m.cellW);
        let targetW = m.cellW;
        let targetLeft = m.left;

        if (!isWrapped) {
            const neededW = Math.max(m.cellW, Math.ceil(maxTextWidth) + 20);
            if (editorAlign === "right") {
                const maxW = Math.max(m.cellW, (m.left + m.cellW) - rowHeaderWidth);
                targetW = Math.min(neededW, maxW);
                targetLeft = (m.left + m.cellW) - targetW;
            } else if (editorAlign === "center") {
                const maxW = Math.max(m.cellW, tableRight - rowHeaderWidth);
                targetW = Math.min(neededW, maxW);
                const centerX = m.left + m.cellW / 2;
                targetLeft = Math.round(centerX - targetW / 2);
                if (targetLeft < rowHeaderWidth) targetLeft = rowHeaderWidth;
                if (targetLeft + targetW > tableRight) targetLeft = Math.max(rowHeaderWidth, tableRight - targetW);
            } else {
                const maxW = Math.max(m.cellW, tableRight - m.left);
                targetW = Math.min(neededW, maxW);
                targetLeft = m.left;
            }
        }

        cellEditor.style.left = `${targetLeft}px`;
        cellEditor.style.width = `${targetW}px`;
        cellEditor.style.whiteSpace = (isWrapped || lines.length > 1 || text.includes("\n")) ? "pre-wrap" : "pre";

        const padX = 3;
        let visualLines = 0;
        const innerW = Math.max(16, targetW - (padX * 2 + 4));
        for (let i = 0; i < lines.length; i++) {
            const w = measureCtx ? measureCtx.measureText(lines[i]).width : lines[i].length * m.fSizeNum;
            visualLines += Math.max(1, Math.ceil((w || 1) / innerW));
        }
        const textBlockH = visualLines * m.lineHeightPx;
        const innerBoxH = Math.max(0, m.minH - 4);
        let padTop = 0;
        if (textBlockH < innerBoxH) {
            if (m.valign === "middle") padTop = Math.floor((innerBoxH - textBlockH) / 2);
            else if (m.valign === "bottom") padTop = Math.max(0, innerBoxH - textBlockH);
        }
        cellEditor.style.padding = `${padTop}px ${padX}px 0 ${padX}px`;
        cellEditor.style.height = `${Math.max(m.minH, textBlockH + padTop + 4)}px`;
    }

    window.addEventListener("resize", () => {
        if (isCellEditing() && editingCell) {
            syncCellEditorLayout(editingCell, true);
        }
        closeCellDropdownList();
        closeAutocompletePopup();
        hideDataValidationTooltip();
        syncCellDropdownButtonPosition();
    }, { signal });

    function isInFormulaEdit() {
        if (document.activeElement === formulaBarInput && formulaBarInput.value.trim().startsWith("=")) return true;
        if (isCellEditing() && cellEditor.value.trim().startsWith("=")) return true;
        return false;
    }

    let lastPointRefRange = null; // { start, end }

    function cycleAbsoluteReference(text, caretPos) {
        const cycleOne = (absC, col, absR, row) => {
            const c = col.toUpperCase();
            if (!absC && !absR) return `$${c}$${row}`;
            if (absC && absR) return `${c}$${row}`;
            if (!absC && absR) return `$${c}${row}`;
            return `${c}${row}`;
        };

        // 範囲参照（A1:B2）の末尾または範囲内にキャレットがある場合は両端を一括切替（Excel準拠）
        const rangeRe = /(\$?)([A-Z]+)(\$?)(\d+):(\$?)([A-Z]+)(\$?)(\d+)/gi;
        let rm;
        while ((rm = rangeRe.exec(text)) !== null) {
            const start = rm.index;
            const end = start + rm[0].length;
            if (caretPos >= start && caretPos <= end) {
                const next = `${cycleOne(rm[1], rm[2], rm[3], rm[4])}:${cycleOne(rm[5], rm[6], rm[7], rm[8])}`;
                return {
                    text: text.slice(0, start) + next + text.slice(end),
                    caret: start + next.length
                };
            }
        }

        const regex = /(\$?)([A-Z]+)(\$?)(\d+)/gi;
        let match;
        while ((match = regex.exec(text)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            if (caretPos >= start && caretPos <= end) {
                const next = cycleOne(match[1], match[2], match[3], match[4]);
                return {
                    text: text.slice(0, start) + next + text.slice(end),
                    caret: start + next.length
                };
            }
        }
        return null;
    }

    function handleF4ReferenceToggle(e) {
        if (e.key !== "F4") return false;
        const targetInput = (document.activeElement === formulaBarInput)
            ? formulaBarInput
            : (isCellEditing() ? cellEditor : null);

        if (targetInput && targetInput.value.trim().startsWith("=")) {
            e.preventDefault();
            e.stopPropagation();
            const pos = targetInput.selectionStart ?? targetInput.value.length;
            const toggled = cycleAbsoluteReference(targetInput.value, pos);
            if (toggled) {
                targetInput.value = toggled.text;
                targetInput.setSelectionRange(toggled.caret, toggled.caret);
                if (targetInput === cellEditor) {
                    formulaBarInput.value = toggled.text;
                } else if (targetInput === formulaBarInput) {
                    isFormulaBarDirty = true;
                    syncFormulaBarToCellEditor();
                }
                highlightCalculationRange(toggled.text.trim());
            }
            return true;
        }
        return false;
    }

    const FUNCTION_CATALOG = [
        { name: "SUM", sig: "SUM(数値1, [数値2], ...)", desc: "合計を計算" },
        { name: "SUMIF", sig: "SUMIF(範囲, 検索条件, [合計範囲])", desc: "条件一致の合計" },
        { name: "SUMIFS", sig: "SUMIFS(合計範囲, 条件範囲1, 条件1, ...)", desc: "複数条件の合計" },
        { name: "SUMPRODUCT", sig: "SUMPRODUCT(配列1, [配列2], ...)", desc: "積の合計" },
        { name: "AVERAGE", sig: "AVERAGE(数値1, [数値2], ...)", desc: "平均を計算" },
        { name: "AVERAGEIF", sig: "AVERAGEIF(範囲, 条件, [平均範囲])", desc: "条件一致の平均" },
        { name: "AVERAGEIFS", sig: "AVERAGEIFS(平均範囲, 条件範囲1, 条件1, ...)", desc: "複数条件の平均" },
        { name: "COUNT", sig: "COUNT(値1, [値2], ...)", desc: "数値セルの個数" },
        { name: "COUNTA", sig: "COUNTA(値1, [値2], ...)", desc: "空白以外の個数" },
        { name: "COUNTBLANK", sig: "COUNTBLANK(範囲)", desc: "空白セルの個数" },
        { name: "COUNTIF", sig: "COUNTIF(範囲, 検索条件)", desc: "条件一致の件数" },
        { name: "COUNTIFS", sig: "COUNTIFS(条件範囲1, 条件1, ...)", desc: "複数条件の件数" },
        { name: "IF", sig: "IF(論理式, 真の場合, [偽の場合])", desc: "条件分岐" },
        { name: "IFS", sig: "IFS(論理式1, 値1, [論理式2, 値2], ...)", desc: "複数条件分岐" },
        { name: "IFERROR", sig: "IFERROR(値, エラー時の値)", desc: "エラー時置換" },
        { name: "SWITCH", sig: "SWITCH(式, 値1, 結果1, ..., [既定値])", desc: "値一致分岐" },
        { name: "AND", sig: "AND(論理式1, [論理式2], ...)", desc: "すべて真ならTRUE" },
        { name: "OR", sig: "OR(論理式1, [論理式2], ...)", desc: "いずれか真ならTRUE" },
        { name: "XLOOKUP", sig: "XLOOKUP(検索値, 検索範囲, 戻り範囲, [見つからない場合])", desc: "モダン範囲検索" },
        { name: "XMATCH", sig: "XMATCH(検索値, 検索範囲)", desc: "相対位置を検索" },
        { name: "VLOOKUP", sig: "VLOOKUP(検索値, 範囲, 列番号, [検索方法])", desc: "垂直方向検索" },
        { name: "HLOOKUP", sig: "HLOOKUP(検索値, 範囲, 行番号, [検索方法])", desc: "水平方向検索" },
        { name: "INDEX", sig: "INDEX(配列, 行番号, [列番号])", desc: "行列位置から取得" },
        { name: "MATCH", sig: "MATCH(検査値, 検査範囲, [照合の型])", desc: "一致位置を検索" },
        { name: "FILTER", sig: "FILTER(配列, 含む, [空の場合])", desc: "条件で動的抽出" },
        { name: "UNIQUE", sig: "UNIQUE(配列)", desc: "重複を除いて抽出" },
        { name: "SORT", sig: "SORT(配列, [並べ替えインデックス], [順序])", desc: "動的並べ替え" },
        { name: "SORTBY", sig: "SORTBY(配列, 基準配列, [順序])", desc: "別列基準並べ替え" },
        { name: "TEXT", sig: "TEXT(値, 表示形式)", desc: "書式付き文字列に変換" },
        { name: "TEXTJOIN", sig: "TEXTJOIN(区切り文字, 空のセルを無視, テキスト1, ...)", desc: "区切り文字で結合" },
        { name: "TEXTSPLIT", sig: "TEXTSPLIT(文字列, 列区切り記号)", desc: "区切り文字で分割" },
        { name: "LEFT", sig: "LEFT(文字列, [文字数])", desc: "左端から抽出" },
        { name: "RIGHT", sig: "RIGHT(文字列, [文字数])", desc: "右端から抽出" },
        { name: "MID", sig: "MID(文字列, 開始位置, 文字数)", desc: "指定位置から抽出" },
        { name: "SUBSTITUTE", sig: "SUBSTITUTE(文字列, 検索文字列, 置換文字列)", desc: "文字列置換" },
        { name: "ROUND", sig: "ROUND(数値, 桁数)", desc: "四捨五入" },
        { name: "ROUNDUP", sig: "ROUNDUP(数値, 桁数)", desc: "切り上げ" },
        { name: "ROUNDDOWN", sig: "ROUNDDOWN(数値, 桁数)", desc: "切り捨て" },
        { name: "TODAY", sig: "TODAY()", desc: "今日の日付" },
        { name: "NOW", sig: "NOW()", desc: "現在の日時" },
        { name: "DATE", sig: "DATE(年, 月, 日)", desc: "日付を作成" },
        { name: "DATEDIF", sig: "DATEDIF(開始日, 終了日, 単位)", desc: "期間（Y/M/D）計算" },
        { name: "EOMONTH", sig: "EOMONTH(開始日, 月数)", desc: "月末日を取得" },
        { name: "NETWORKDAYS", sig: "NETWORKDAYS(開始日, 終了日)", desc: "稼働日数を計算" },
        { name: "HYPERLINK", sig: "HYPERLINK(リンク先, [別名])", desc: "ハイパーリンクを作成" },
        { name: "LET", sig: "LET(名前1, 値1, 計算式)", desc: "変数定義計算" },
        { name: "LAMBDA", sig: "LAMBDA(引数, 計算式)", desc: "カスタム関数" }
    ];

    let acPopupEl = null;
    let acItems = [];
    let acSelectedIndex = 0;

    function closeAutocompletePopup() {
        if (acPopupEl) {
            acPopupEl.remove();
            acPopupEl = null;
        }
        acItems = [];
        acSelectedIndex = 0;
    }

    function autoResizeFormulaBar() {
        formulaBarInput.style.height = "24px";
    }

    function showAutocompletePopup(targetEl, rawText, caretPos) {
        const textBeforeCaret = rawText.slice(0, caretPos);
        let candidates = [];
        let tokenStart = 0;

        // 数式入力時（=から始まる場合）の関数サジェストのみを残す
        if (rawText.trimStart().startsWith("=")) {
            const match = textBeforeCaret.match(/(?:^|[=+\-*/(,;&<>!\s])([A-Za-z_][A-Za-z0-9_]*)$/);
            if (!match) {
                closeAutocompletePopup();
                return;
            }
            const prefix = match[1].toUpperCase();
            tokenStart = caretPos - match[1].length;
            candidates = FUNCTION_CATALOG
                .filter(f => f.name.startsWith(prefix))
                .slice(0, 12)
                .map(f => ({
                    label: f.name,
                    sub: f.sig,
                    title: f.desc,
                    insertText: `${f.name}(`,
                    tokenStart,
                    tokenEnd: caretPos
                }));
        } else {
            // 通常入力時の同列履歴サジェストは完全に廃止する
            closeAutocompletePopup();
            return;
        }

        if (!candidates.length) {
            closeAutocompletePopup();
            return;
        }

        acItems = candidates;
        acSelectedIndex = 0;
        if (!acPopupEl) {
            acPopupEl = document.createElement("div");
            acPopupEl.className = "ss-autocomplete-popup";
            document.body.appendChild(acPopupEl);
        }

        const rect = targetEl.getBoundingClientRect();
        acPopupEl.style.left = `${Math.min(window.innerWidth - 360, Math.max(4, rect.left))}px`;
        acPopupEl.style.top = `${Math.min(window.innerHeight - 220, rect.bottom + 2)}px`;

        const applyChoice = (item) => {
            if (targetEl === formulaBarInput) {
                const cur = formulaBarInput.value;
                formulaBarInput.value = cur.slice(0, item.tokenStart) + item.insertText + cur.slice(item.tokenEnd);
                const nextPos = item.tokenStart + item.insertText.length;
                formulaBarInput.setSelectionRange(nextPos, nextPos);
                isFormulaBarDirty = true;
                syncFormulaBarToCellEditor();
                autoResizeFormulaBar();
            } else if (isCellEditing() && editingCell) {
                const cur = cellEditor.value;
                const nextVal = cur.slice(0, item.tokenStart) + item.insertText + cur.slice(item.tokenEnd);
                cellEditor.value = nextVal;
                const nextPos = item.tokenStart + item.insertText.length;
                cellEditor.setSelectionRange(nextPos, nextPos);
                formulaBarInput.value = nextVal;
                syncCellEditorLayout(editingCell);
            }
            closeAutocompletePopup();
        };

        acPopupEl.innerHTML = candidates.map((c, idx) => `
            <div class="ss-autocomplete-item ${idx === 0 ? "active" : ""}" data-ac-idx="${idx}" title="${c.title || ""}">
                <b>${c.label}</b>
                <span style="font-size:11px; opacity:0.85; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${c.sub}</span>
            </div>
        `).join("");

        acPopupEl.querySelectorAll(".ss-autocomplete-item").forEach(row => {
            row.addEventListener("mousedown", (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                const item = acItems[Number(row.dataset.acIdx)];
                if (item) applyChoice(item);
            });
        });
        acPopupEl._applySelected = () => {
            const item = acItems[acSelectedIndex];
            if (item) applyChoice(item);
        };
    }

    function handleAutocompleteKeydown(e) {
        if (isComposing || e.isComposing || e.keyCode === 229) return false;
        if (!acPopupEl || !acItems.length) return false;

        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            e.stopPropagation();
            const dir = e.key === "ArrowDown" ? 1 : -1;
            acSelectedIndex = (acSelectedIndex + dir + acItems.length) % acItems.length;
            acPopupEl.querySelectorAll(".ss-autocomplete-item").forEach((el, i) => {
                el.classList.toggle("active", i === acSelectedIndex);
            });
            return true;
        }
        if (e.key === "Tab" || (e.key === "Enter" && acItems.length > 0)) {
            e.preventDefault();
            e.stopPropagation();
            acPopupEl._applySelected?.();
            return true;
        }
        if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            closeAutocompletePopup();
            return true;
        }
        return false;
    }

    // 数式バー ⇔ セル内エディタ即時同期ヘルパー
    function syncFormulaBarToCellEditor() {
        if (!activeCell) return;
        if (!isCellEditing(activeCell)) {
            enterCellEditMode(activeCell, true, "formulabar");
        }
        if (editingCell === activeCell) {
            cellEditor.value = formulaBarInput.value;
            syncCellEditorLayout(editingCell);
        }
    }

    formulaBarInput.addEventListener("focus", () => {
        if (!isFormulaBarDirty) lastPointRefRange = null;
        if (!activeCell) return;
        const initialVal = getCellEditableValue(activeCell);
        if (!isFormulaBarDirty && formulaBarInput.value !== initialVal) {
            formulaBarInput.value = initialVal;
        }
        // クリック（focus）した瞬間にセル側エディタを起動して数式文字列を即時表示
        syncFormulaBarToCellEditor();
        const trimmed = formulaBarInput.value.trim();
        if (trimmed.startsWith("=")) highlightCalculationRange(trimmed);
        else clearCalculationRangeHighlights();
        updateFillHandle();
    }, { signal });

    formulaBarInput.addEventListener("click", () => {
        if (!activeCell) return;
        syncFormulaBarToCellEditor();
        const trimmed = formulaBarInput.value.trim();
        if (trimmed.startsWith("=")) highlightCalculationRange(trimmed);
        else clearCalculationRangeHighlights();
    }, { signal });

    formulaBarInput.addEventListener("blur", (e) => {
        // セル内エディタ・テーブル・数式参照ハンドル操作中のフォーカス移動時は維持する
        const nextFocus = e.relatedTarget;
        if (isRefDragging() || isSelecting) return;
        if (nextFocus && (nextFocus === cellEditor || table.contains(nextFocus) || formulaRefLayer.contains(nextFocus))) return;
        if (!isFormulaBarDirty && isCellEditing(activeCell)) {
            closeCellEditor();
        }
        if (!isCellEditing()) {
            clearCalculationRangeHighlights();
        }
    }, { signal });

    formulaBarInput.addEventListener("input", () => {
        isFormulaBarDirty = true;
        const val = formulaBarInput.value;
        const trimmed = val.trim();
        syncFormulaBarToCellEditor();
        autoResizeFormulaBar();
        showAutocompletePopup(formulaBarInput, val, formulaBarInput.selectionStart ?? val.length);

        if (trimmed.startsWith("=")) highlightCalculationRange(trimmed);
        else clearCalculationRangeHighlights();

        if (trimmed === '{"mergecell"}') highlightMergedCells();
        else removeMergedCellsHighlight();
    }, { signal });

    formulaBarInput.addEventListener("keydown", (e) => {
        if (isImeActive(e)) return;
        if (handleAutocompleteKeydown(e)) return;
        if (handleF4ReferenceToggle(e)) return;

        if (e.key === "Enter" && e.altKey) {
            e.preventDefault();
            e.stopPropagation();
            const pos = formulaBarInput.selectionStart ?? formulaBarInput.value.length;
            formulaBarInput.value = formulaBarInput.value.slice(0, pos) + "\n" + formulaBarInput.value.slice(pos);
            formulaBarInput.setSelectionRange(pos + 1, pos + 1);
            isFormulaBarDirty = true;
            syncFormulaBarToCellEditor();
            autoResizeFormulaBar();
            return;
        }
        if (e.key === "Enter") {
            e.preventDefault();
            if (activeCell) {
                const isBulk = e.ctrlKey || e.metaKey;
                const ok = commitValueToTargets(activeCell, getTargetCells(), formulaBarInput.value, isBulk);
                formulaBarInput.blur();
                if (!ok) {
                    activeCell.focus({ preventScroll: true });
                    return;
                }
                if (isBulk) {
                    activeCell.focus({ preventScroll: true });
                    updateSelectedCellsDisplay();
                    updateFillHandle();
                } else {
                    moveActiveInSelectionOrStep(activeCell, "vertical", e.shiftKey);
                }
            }
        } else if (e.key === "Escape") {
            e.preventDefault();
            revertSelectedCellsText();
            formulaBarInput.blur();
            if (activeCell) activeCell.focus({ preventScroll: true });
        }
    }, { signal });

    function insertCellReference(ref) {
        if (!ref) return;
        const targetInput = (document.activeElement === formulaBarInput)
            ? formulaBarInput
            : (isCellEditing() ? cellEditor : null);
        if (!targetInput) return;

        let start = targetInput.selectionStart ?? targetInput.value.length;
        let end = targetInput.selectionEnd ?? targetInput.value.length;
        if (lastPointRefRange && start === lastPointRefRange.end && end === lastPointRefRange.end) {
            start = lastPointRefRange.start;
        }
        targetInput.value = targetInput.value.slice(0, start) + ref + targetInput.value.slice(end);
        const newPos = start + ref.length;
        lastPointRefRange = { start, end: newPos };
        targetInput.setSelectionRange(newPos, newPos);
        targetInput.focus();

        if (targetInput === cellEditor) {
            formulaBarInput.value = cellEditor.value;
            syncCellEditorLayout(editingCell);
        } else if (targetInput === formulaBarInput) {
            isFormulaBarDirty = true;
            syncFormulaBarToCellEditor();
        }
        highlightCalculationRange(targetInput.value.trim());
    }

    function closeCellEditor() {
        const prevEditing = editingCell;
        editingCell = null;
        editingRichRuns = null;
        editorMetricsCache = null;
        hideInlineMiniToolbar();
        cellEditor.style.display = "none";
        cellEditor.style.writingMode = "";
        cellEditor.style.textOrientation = "";
        cellEditor.value = "";
        isComposing = false;
        if (prevEditing) scheduleTextOverflowUpdate();
        if (activeCell) attachCellDropdownButton(activeCell);
    }

    function enterCellEditMode(cell, skipFocus = false, editBy = "dblclick", _clickEvent = null) {
        if (!cell) return false;
        if (isCellLockedForEdit(cell)) {
            showAlert("変更しようとしているセルは保護されたシート上にあります。\n編集するには「表示」または「ホーム → 書式」からシート保護を解除してください。", "シートの保護");
            return false;
        }
        hideAutoFillOptions();
        closeCellDropdownList();
        hideCellDropdownButton();
        const alreadyEditingThis = isCellEditing(cell);
        if (!alreadyEditingThis) {
            lastPointRefRange = null;
            cell.dataset.originalText = cell.dataset.rawValue ?? getCellPureText(cell);
            cell.dataset.originalQuotePrefix = cell.dataset.quotePrefix || "";
            cell.dataset.originalRichRuns = cell.dataset.richRuns || "";
            cell.dataset.originalValueType = cell.dataset.valueType || "";
            cell.dataset.originalDateValue = cell.dataset.dateValue || "";
            cell.dataset.originalNumFormat = cell.dataset.numFormat || "";
            if (cell.dataset.formula) {
                cell.dataset.originalFormula = cell.dataset.formula;
                cellEditor.value = cell.dataset.formula;
                editingRichRuns = null;
            } else {
                delete cell.dataset.originalFormula;
                cellEditor.value = getCellEditableValue(cell);
                if (cell.dataset.richRuns) {
                    try { editingRichRuns = JSON.parse(cell.dataset.richRuns); } catch { editingRichRuns = null; }
                } else {
                    editingRichRuns = null;
                }
            }
        }
        unwrapOverflowSpan(cell);
        cell.classList.remove("ss-text-overflow");
        editingCell = cell;
        cell.dataset.editBy = editBy;
        updateOSStatusBar(["type", "ime", "backspace"].includes(editBy) ? "入力" : "編集");
        cellEditor.style.display = "block";
        syncCellEditorLayout(cell, true);

        const currentFormula = cellEditor.value.trim();
        if (currentFormula.startsWith("=")) {
            highlightCalculationRange(currentFormula);
        }
        if (!skipFocus) {
            cellEditor.focus();
            if (!alreadyEditingThis) {
                const len = cellEditor.value.length;
                cellEditor.setSelectionRange(len, len);
            }
        }
        activeCell = cell;
        if (editBy !== "formulabar" && formulaBarInput.value !== cellEditor.value) {
            formulaBarInput.value = cellEditor.value;
        }
        return true;
    }
    cellEditor.addEventListener("compositionstart", () => {
        isComposing = true;
    }, { signal });

    cellEditor.addEventListener("compositionend", () => {
        isComposing = false;
        formulaBarInput.value = cellEditor.value;
        syncCellEditorLayout(editingCell);
    }, { signal });

    cellEditor.addEventListener("input", () => {
        if (editingRichRuns) {
            editingRichRuns = syncRichRunsWithText(editingRichRuns, cellEditor.value);
        }
        formulaBarInput.value = cellEditor.value;
        syncCellEditorLayout(editingCell);
        showAutocompletePopup(cellEditor, cellEditor.value, cellEditor.selectionStart ?? cellEditor.value.length);
        if (cellEditor.value.trim().startsWith("=")) {
            highlightCalculationRange(cellEditor.value.trim());
            hideInlineMiniToolbar();
        } else {
            clearCalculationRangeHighlights();
        }
    }, { signal });

    ["mouseup", "keyup", "select"].forEach(evName => {
        cellEditor.addEventListener(evName, () => {
            updateInlineMiniToolbar();
        }, { signal });
    });

    cellEditor.addEventListener("mousedown", () => {
        if (editingCell && ["type", "ime", "backspace"].includes(editingCell.dataset.editBy)) {
            editingCell.dataset.editBy = "dblclick";
            updateOSStatusBar("編集");
        }
    }, { signal });

    cellEditor.addEventListener("keydown", (e) => {
        if (isComposing || e.isComposing || e.keyCode === 229) return;
        if (handleAutocompleteKeydown(e)) return;
        if (handleF4ReferenceToggle(e)) return;

        // 入力モード（シングルクリックからの直接入力）中に F2 を押したら編集モードへ切り替え
        if (e.key === "F2" && editingCell) {
            e.preventDefault();
            e.stopPropagation();
            const isDirectInput = ["type", "ime", "backspace"].includes(editingCell.dataset.editBy);
            editingCell.dataset.editBy = isDirectInput ? "f2" : "type";
            updateOSStatusBar(editingCell.dataset.editBy === "f2" ? "編集" : "入力");
            return;
        }

        // シングルクリックからの直接入力モード時は、矢印キーで入力を確定して隣接セルへ移動
        if (
            editingCell &&
            ["type", "ime", "backspace"].includes(editingCell.dataset.editBy) &&
            !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey &&
            !cellEditor.value.trimStart().startsWith("=") &&
            ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
        ) {
            e.preventDefault();
            e.stopPropagation();
            const target = editingCell;
            const r = parseInt(target.dataset.row, 10);
            const c = parseInt(target.dataset.col, 10);
            const rs = parseInt(target.getAttribute("rowspan") || "1", 10);
            const cs = parseInt(target.getAttribute("colspan") || "1", 10);

            if (!commitCellValue(target, cellEditor.value)) {
                target.focus({ preventScroll: true });
                return;
            }

            if (e.key === "ArrowUp") navigateToCell(Math.max(1, r - 1), c);
            else if (e.key === "ArrowDown") navigateToCell(r + rs, c);
            else if (e.key === "ArrowLeft") navigateToCell(r, Math.max(0, c - 1));
            else if (e.key === "ArrowRight") navigateToCell(r, c + cs);
            return;
        }

        if (e.key === "Enter" && e.altKey) {
            e.preventDefault();
            e.stopPropagation();
            const pos = cellEditor.selectionStart ?? cellEditor.value.length;
            cellEditor.value = cellEditor.value.slice(0, pos) + "\n" + cellEditor.value.slice(pos);
            cellEditor.setSelectionRange(pos + 1, pos + 1);
            formulaBarInput.value = cellEditor.value;
            syncCellEditorLayout(editingCell);
            return;
        }

        if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            const target = editingCell;
            if (!target) return;
            const isBulk = e.ctrlKey || e.metaKey;
            if (!commitValueToTargets(target, getTargetCells(), cellEditor.value, isBulk)) {
                target.focus({ preventScroll: true });
                return;
            }
            if (isBulk) {
                target.focus({ preventScroll: true });
                updateSelectedCellsDisplay();
                updateFillHandle();
            } else {
                moveActiveInSelectionOrStep(target, "vertical", e.shiftKey);
            }
            return;
        }

        if (e.key === "Tab") {
            e.preventDefault();
            e.stopPropagation();
            const target = editingCell;
            if (!target) return;
            if (!commitCellValue(target, cellEditor.value)) {
                target.focus({ preventScroll: true });
                return;
            }
            moveActiveInSelectionOrStep(target, "horizontal", e.shiftKey);
            return;
        }

        if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            const target = editingCell;
            revertSelectedCellsText();
            if (target) target.focus({ preventScroll: true });
        }
    }, { signal });

    function commitCellValue(cell, rawValue, { deferRecalc = false, skipValidation = false } = {}) {
        if (!cell) return true;
        if (isCellLockedForEdit(cell)) {
            closeCellEditor();
            showAlert("変更しようとしているセルは保護されたシート上にあります。", "シートの保護");
            return false;
        }
        const pendingRichRuns = (editingCell === cell && editingRichRuns)
            ? syncRichRunsWithText(editingRichRuns, String(rawValue ?? ""))
            : null;
        closeAutocompletePopup();
        closeCellEditor();
        isFormulaBarDirty = false;
        const rawStr = String(rawValue ?? "");
        const trimmedStr = rawStr.trim();
        const newText = trimmedStr.startsWith("=") ? trimmedStr : rawStr;
        if (!skipValidation && !validateCellInputByRule(cell, newText)) {
            revertSelectedCellsText();
            return false;
        }
        if (
            !trimmedStr.startsWith("=") &&
            pendingRichRuns &&
            pendingRichRuns.some(r => r.style && Object.keys(r.style).length > 0)
        ) {
            cell.dataset.richRuns = JSON.stringify(pendingRichRuns);
        } else {
            delete cell.dataset.richRuns;
        }
        const cellRow = parseInt(cell.dataset.row, 10);
        const cellCol = parseInt(cell.dataset.col, 10);
        delete cell.dataset.spillOrigin;
        clearSpillCellsFromAnchor(cellRow, cellCol);
        const prevText = cell.dataset.originalText ?? "";
        const prevFormula = cell.dataset.originalFormula ?? "";
        const prevQuotePrefix = cell.dataset.originalQuotePrefix ?? "";
        const prevRichRuns = cell.dataset.originalRichRuns ?? "";
        const hasCellChanged = () => {
            const curRaw = cell.dataset.rawValue ?? getCellPureText(cell);
            const curFormula = cell.dataset.formula || "";
            const curQuote = cell.dataset.quotePrefix || "";
            const curRich = cell.dataset.richRuns || "";
            return (
                prevText !== curRaw ||
                prevFormula !== curFormula ||
                prevQuotePrefix !== curQuote ||
                prevRichRuns !== curRich
            );
        };

        if (rawStr.startsWith("'")) {
            delete cell.dataset.formula;
            delete cell.dataset.valueType;
            delete cell.dataset.dateValue;
            cell.dataset.quotePrefix = "1";
            setCellFormattedValue(cell, rawStr.slice(1));
            delete cell.dataset.editBy;
            if (deferRecalc) return true;
            clearCalculationRangeHighlights();
            recalculateCells([{ row: cellRow, col: cellCol }], { formulaChanged: prevFormula !== "" });
            if (hasCellChanged()) {
                setDirtyState(true);
                debouncedSaveState();
            }
            return true;
        }
        delete cell.dataset.quotePrefix;

        if (trimmedStr.startsWith("=")) {
            // Excel仕様: 文字列リテラル外で閉じ括弧 ')' が不足している場合は末尾に自動補完
            let balancedFormula = trimmedStr;
            let openParens = 0;
            let inStr = false;
            for (let i = 1; i < balancedFormula.length; i++) {
                const ch = balancedFormula[i];
                if (ch === '"') inStr = !inStr;
                else if (!inStr) {
                    if (ch === "(") openParens++;
                    else if (ch === ")" && openParens > 0) openParens--;
                }
            }
            if (!inStr && openParens > 0) {
                balancedFormula += ")".repeat(openParens);
            }
            // キャッシュ有効・座標コンテキスト付き・スピル対応の recalculateCells() で1回だけ評価する
            cell.dataset.formula = balancedFormula;
            delete cell.dataset.valueType;
            delete cell.dataset.dateValue;
        } else if (cell.dataset.numFormat === "text") {
            // 表示形式「文字列」のセルは日付・数値への自動変換を行わずそのまま保持（Excel準拠）
            delete cell.dataset.formula;
            delete cell.dataset.valueType;
            delete cell.dataset.dateValue;
            setCellFormattedValue(cell, newText);
        } else if (parseJapaneseDateInput(trimmedStr, { allowShortMD: true })) {
            const parsedDate = parseJapaneseDateInput(trimmedStr, { allowShortMD: true });
            delete cell.dataset.formula;
            delete cell.dataset.decimalPlaces;
            cell.dataset.valueType = "date";
            cell.dataset.dateValue = String(parsedDate.date.getTime());
            // 既に日付・和暦書式が設定済みなら維持し、未設定（標準）のときだけ入力形式に応じた書式を自動設定
            if (!isDateNumFormat(cell.dataset.numFormat)) {
                cell.dataset.numFormat = parsedDate.autoNumFormat;
            }
            setCellFormattedValue(cell, String(parsedDate.serial));
        } else if (parseTimeInput(trimmedStr)) {
            const parsedTime = parseTimeInput(trimmedStr);
            delete cell.dataset.formula;
            delete cell.dataset.decimalPlaces;
            delete cell.dataset.valueType;
            delete cell.dataset.dateValue;
            if (!isTimeNumFormat(cell.dataset.numFormat)) {
                cell.dataset.numFormat = parsedTime.autoNumFormat;
            }
            setCellFormattedValue(cell, String(parsedTime.serial));
        } else {
            delete cell.dataset.formula;
            delete cell.dataset.valueType;
            delete cell.dataset.dateValue;

            const trimmedInput = newText.trim();
            if (/^(?:[¥￥]\s*-?|-?\s*[¥￥]\s*)[\d,]+(?:\.\d+)?$/.test(trimmedInput)) {
                cell.dataset.numFormat = "currency";
                setCellFormattedValue(cell, parseFormattedNumber(trimmedInput));
            } else if (/^-?[\d,]+(?:\.\d+)?\s*%$/.test(trimmedInput)) {
                cell.dataset.numFormat = "percent";
                setCellFormattedValue(cell, parseFormattedNumber(trimmedInput));
            } else if (/^-?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(trimmedInput)) {
                if (!cell.dataset.numFormat || cell.dataset.numFormat === "general") {
                    cell.dataset.numFormat = "comma";
                }
                setCellFormattedValue(cell, parseFormattedNumber(trimmedInput));
            } else if (/^(true|false)$/i.test(trimmedInput)) {
                setCellFormattedValue(cell, trimmedInput.toUpperCase());
            } else if (EXCEL_ERROR_RE.test(trimmedInput.toUpperCase())) {
                setCellFormattedValue(cell, trimmedInput.toUpperCase());
            } else {
                setCellFormattedValue(cell, newText);
                if (/^https?:\/\/\S+$/i.test(trimmedInput)) {
                    cell.dataset.hyperlink = trimmedInput;
                    cell.classList.add("ss-hyperlink");
                    cell.title = `${trimmedInput}（Ctrl+クリックで開く）`;
                } else if (trimmedInput === "" && cell.dataset.hyperlink) {
                    delete cell.dataset.hyperlink;
                    cell.classList.remove("ss-hyperlink");
                    cell.removeAttribute("title");
                }
            }
        }

        delete cell.dataset.editBy;
        if (deferRecalc) {
            return true;
        }
        clearCalculationRangeHighlights();
        tryAutoExpandStructuredTable(cellRow, cellCol);
        const nextFormulaStr = cell.dataset.formula || "";
        recalculateCells([{ row: cellRow, col: cellCol }], { formulaChanged: prevFormula !== nextFormulaStr });
        if (cell.dataset.shrinkToFit === "1") {
            applyShrinkToFit(cell);
        }
        if (newText.includes("\n") || prevText.includes("\n") || cell.style.whiteSpace === "pre-wrap") {
            autoFitRow(cell.closest("tr"));
        }

        if (hasCellChanged()) {
            setDirtyState(true);
            debouncedSaveState();
        }
        return true;
    }

    function revertSelectedCellsText() {
        closeCellEditor();
        isFormulaBarDirty = false;
        if (activeCell) {
            if (activeCell.dataset.originalQuotePrefix === "1") activeCell.dataset.quotePrefix = "1";
            else delete activeCell.dataset.quotePrefix;
            if (activeCell.dataset.originalRichRuns) activeCell.dataset.richRuns = activeCell.dataset.originalRichRuns;
            else delete activeCell.dataset.richRuns;

            if (activeCell.dataset.originalValueType) activeCell.dataset.valueType = activeCell.dataset.originalValueType;
            else delete activeCell.dataset.valueType;
            if (activeCell.dataset.originalDateValue) activeCell.dataset.dateValue = activeCell.dataset.originalDateValue;
            else delete activeCell.dataset.dateValue;
            if (activeCell.dataset.originalNumFormat) activeCell.dataset.numFormat = activeCell.dataset.originalNumFormat;
            else delete activeCell.dataset.numFormat;

            if (activeCell.dataset.originalFormula) {
                activeCell.dataset.formula = activeCell.dataset.originalFormula;
                setCellFormattedValue(activeCell, evaluateFormula(activeCell.dataset.originalFormula));
                formulaBarInput.value = activeCell.dataset.originalFormula;
            } else if (activeCell.dataset.originalText !== undefined) {
                delete activeCell.dataset.formula;
                setCellFormattedValue(activeCell, activeCell.dataset.originalText);
                formulaBarInput.value = getCellEditableValue(activeCell);
            }
            delete activeCell.dataset.editBy;
        }
        delete formulaBarInput.dataset.manualHeight;
        autoResizeFormulaBar();
        clearCalculationRangeHighlights();
        updateAllFormulas();
        updateFillHandle();
    }

    function moveActiveInSelectionOrStep(currentCell, direction = "vertical", reverse = false) {
        const selected = Array.from(tbody.querySelectorAll("td.selected"));
        const r = parseInt(currentCell.dataset.row, 10);
        const c = parseInt(currentCell.dataset.col, 10);
        const rs = parseInt(currentCell.getAttribute("rowspan") || "1", 10);
        const cs = parseInt(currentCell.getAttribute("colspan") || "1", 10);

        if (selected.length > 1) {
            const bounds = getSelectedRangeBounds();
            if (bounds) {
                let nr = r;
                let nc = c;
                const total = (bounds.maxRow - bounds.minRow + 1) * (bounds.maxCol - bounds.minCol + 1);
                for (let step = 0; step < total; step++) {
                    if (direction === "vertical") {
                        if (!reverse) {
                            nr++;
                            if (nr > bounds.maxRow) { nr = bounds.minRow; nc++; }
                            if (nc > bounds.maxCol) { nc = bounds.minCol; }
                        } else {
                            nr--;
                            if (nr < bounds.minRow) { nr = bounds.maxRow; nc--; }
                            if (nc < bounds.minCol) { nc = bounds.maxCol; }
                        }
                    } else {
                        if (!reverse) {
                            nc++;
                            if (nc > bounds.maxCol) { nc = bounds.minCol; nr++; }
                            if (nr > bounds.maxRow) { nr = bounds.minRow; }
                        } else {
                            nc--;
                            if (nc < bounds.minCol) { nc = bounds.maxCol; nr--; }
                            if (nr < bounds.minRow) { nr = bounds.maxRow; }
                        }
                    }
                    const candidate = peekCell(nr, nc);
                    if (candidate && candidate.style.display !== "none" && candidate !== currentCell) {
                        setActiveCell(candidate, true);
                        updateSelectedCellsDisplay();
                        updateFillHandle();
                        candidate.scrollIntoView({ block: "nearest", inline: "nearest" });
                        return;
                    }
                }
            }
        }

        if (direction === "vertical") {
            navigateToCell(reverse ? Math.max(1, r - 1) : r + rs, c);
        } else {
            navigateToCell(r, reverse ? Math.max(0, c - 1) : c + cs);
        }
    }

    function navigateToCell(row, col, event) {
        if (col < 0 || row < 1) return;
        const targetCell = getVisibleCell(row, col);
        if (!targetCell) return;
        if (event) event.preventDefault();

        clearSelection();
        setActiveCell(targetCell, true);
        targetCell.scrollIntoView({ block: "nearest", inline: "nearest" });
        updateSelectedCellsDisplay();
        updateFillHandle();
    }

    function findDataEdgeCoord(startRow, startCol, dRow, dCol) {
        const maxR = Math.max(1, rowCount - 1);
        const maxC = Math.max(0, currentColumns - 1);
        const isCellFilled = (r, c) => {
            const cell = peekCell(r, c);
            if (!cell) return false;
            const visible = cell.style.display === "none" ? getVisibleCell(r, c) : cell;
            if (!visible) return false;
            return Boolean(visible.dataset.formula || (visible.dataset.rawValue ?? visible.textContent).trim() !== "");
        };

        let r = startRow;
        let c = startCol;
        const nextR = r + dRow;
        const nextC = c + dCol;
        if (nextR < 1 || nextR > maxR || nextC < 0 || nextC > maxC) {
            return { row: r, col: c };
        }

        const curFilled = isCellFilled(r, c);
        const nextFilled = isCellFilled(nextR, nextC);

        if (curFilled && nextFilled) {
            while (r + dRow >= 1 && r + dRow <= maxR && c + dCol >= 0 && c + dCol <= maxC && isCellFilled(r + dRow, c + dCol)) {
                r += dRow;
                c += dCol;
            }
        } else {
            r = nextR;
            c = nextC;
            while (r + dRow >= 1 && r + dRow <= maxR && c + dCol >= 0 && c + dCol <= maxC && !isCellFilled(r, c)) {
                r += dRow;
                c += dCol;
            }
        }
        return { row: r, col: c };
    }

    appRoot.addEventListener("keydown", (e) => {
        if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
        if (isCellEditing() || document.activeElement === cellEditor || document.activeElement === formulaBarInput || document.activeElement === selectedCellsDisplay) return;
        if (document.activeElement?.closest(".floating-textbox")) return;

        const dirMap = {
            ArrowUp: [-1, 0],
            ArrowDown: [1, 0],
            ArrowLeft: [0, -1],
            ArrowRight: [0, 1]
        };
        const delta = dirMap[e.key];
        if (!delta || !activeCell) return;

        e.preventDefault();
        e.stopPropagation();

        const baseR = parseInt(activeCell.dataset.row, 10);
        const baseC = parseInt(activeCell.dataset.col, 10);
        const anchor = (e.shiftKey && selectionEnd) ? selectionEnd : { row: baseR, col: baseC };
        const dest = findDataEdgeCoord(anchor.row, anchor.col, delta[0], delta[1]);

        if (e.shiftKey) {
            selectionStart = { row: baseR, col: baseC };
            selectionEnd = dest;
            updateSelection();
            updateFillHandle();
            getVisibleCell(dest.row, dest.col)?.scrollIntoView({ block: "nearest", inline: "nearest" });
        } else {
            selectionStart = dest;
            selectionEnd = dest;
            navigateToCell(dest.row, dest.col);
        }
    }, { capture: true, signal });

    // Excel定番ショートカット：Ctrl+D（下へコピー）/ Ctrl+R（右へコピー）/ Ctrl+;（今日の日付）/ Ctrl+:（現在時刻）
    appRoot.addEventListener("keydown", (e) => {
        if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
        if (isCellEditing() || document.activeElement === cellEditor || document.activeElement === formulaBarInput || document.activeElement === selectedCellsDisplay) return;
        if (document.activeElement?.closest(".floating-textbox")) return;

        const key = e.key.toLowerCase();

        // Ctrl + ; （今日の日付） / Ctrl + : （現在時刻）
        if ((e.key === ";" || e.key === ":") && activeCell) {
            e.preventDefault();
            e.stopPropagation();
            const now = new Date();
            const val = e.key === ";"
                ? formatDate(now)
                : `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
            activeCell.dataset.originalText = activeCell.dataset.rawValue ?? activeCell.textContent;
            commitCellValue(activeCell, val);
            formulaBarInput.value = getCellEditableValue(activeCell);
            updateSelectedCellsDisplay();
            return;
        }

        // Ctrl + D / Ctrl + R
        if (key === "d" || key === "r") {
            const bounds = getSelectedRangeBounds();
            if (!bounds) return;
            e.preventDefault();
            e.stopPropagation();
            if (isCurrentSheetProtected()) {
                showAlert("シートが保護されているため、コピー貼り付けはできません。", "シートの保護");
                return;
            }

            if (key === "d") {
                const srcRow = bounds.minRow === bounds.maxRow ? Math.max(1, bounds.minRow - 1) : bounds.minRow;
                const startDst = bounds.minRow === bounds.maxRow ? bounds.minRow : bounds.minRow + 1;
                for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
                    const src = getVisibleCell(srcRow, c);
                    for (let r = startDst; r <= bounds.maxRow; r++) {
                        const dst = getVisibleCell(r, c);
                        if (src && dst && src !== dst) cloneCellProperties(src, dst);
                    }
                }
            } else {
                const srcCol = bounds.minCol === bounds.maxCol ? Math.max(0, bounds.minCol - 1) : bounds.minCol;
                const startDst = bounds.minCol === bounds.maxCol ? bounds.minCol : bounds.minCol + 1;
                for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
                    const src = getVisibleCell(r, srcCol);
                    for (let c = startDst; c <= bounds.maxCol; c++) {
                        const dst = getVisibleCell(r, c);
                        if (src && dst && src !== dst) cloneCellProperties(src, dst);
                    }
                }
            }
            updateAllFormulas();
            updateSelectedCellsDisplay();
            setDirtyState(true);
            debouncedSaveState();
        }
    }, { capture: true, signal });

    // =========================================================
    // 範囲選択・フィルハンドル
    // =========================================================
    function getSelectedRangeBounds() {
        const selected = Array.from(tbody.querySelectorAll("td.selected")).filter(
            td => td.style.display !== "none" && td.closest("tr")?.style.display !== "none"
        );
        const targets = selected.length ? selected : (activeCell ? [activeCell] : []);
        if (!targets.length) return null;

        let minRow = Infinity, maxRow = -Infinity, minCol = Infinity, maxCol = -Infinity;
        targets.forEach(c => {
            const r0 = +c.dataset.row, c0 = +c.dataset.col;
            const r1 = r0 + (+c.getAttribute("rowspan") || 1) - 1;
            const c1 = c0 + (+c.getAttribute("colspan") || 1) - 1;
            minRow = Math.min(minRow, r0);
            maxRow = Math.max(maxRow, r1);
            minCol = Math.min(minCol, c0);
            maxCol = Math.max(maxCol, c1);
        });
        return expandBoundsForMergedCells({ minRow, maxRow, minCol, maxCol });
    }

    function expandBoundsForMergedCells(bounds) {
        let { minRow, maxRow, minCol, maxCol } = bounds;
        let expanded = true;
        while (expanded) {
            expanded = false;
            for (let r = minRow; r <= maxRow; r++) {
                for (let c = minCol; c <= maxCol; c++) {
                    const anchor = getVisibleCell(r, c);
                    if (!anchor) continue;
                    const aMinR = parseInt(anchor.dataset.mergeMinRow || anchor.dataset.row, 10);
                    const aMinC = parseInt(anchor.dataset.mergeMinCol || anchor.dataset.col, 10);
                    const rs = parseInt(anchor.getAttribute("rowspan") || "1", 10);
                    const cs = parseInt(anchor.getAttribute("colspan") || "1", 10);
                    const aMaxR = parseInt(anchor.dataset.mergeMaxRow || String(aMinR + rs - 1), 10);
                    const aMaxC = parseInt(anchor.dataset.mergeMaxCol || String(aMinC + cs - 1), 10);

                    if (aMinR < minRow) { minRow = aMinR; expanded = true; }
                    if (aMaxR > maxRow) { maxRow = aMaxR; expanded = true; }
                    if (aMinC < minCol) { minCol = aMinC; expanded = true; }
                    if (aMaxC > maxCol) { maxCol = aMaxC; expanded = true; }
                }
            }
        }
        return { minRow, maxRow, minCol, maxCol };
    }

    function updateSelection() {
        if (!selectionStart || !selectionEnd) return;

        if (isInFormulaEdit()) {
            // 数式編集中は結合セルへ強制拡張せず、1セル単位でリアルタイム挿入＆全参照カラー更新
            const minRow = Math.min(selectionStart.row, selectionEnd.row);
            const maxRow = Math.max(selectionStart.row, selectionEnd.row);
            const minCol = Math.min(selectionStart.col, selectionEnd.col);
            const maxCol = Math.max(selectionStart.col, selectionEnd.col);
            const rangeRef = (minRow === maxRow && minCol === maxCol)
                ? getCellReferenceByCoord(minRow, minCol)
                : `${getCellReferenceByCoord(minRow, minCol)}:${getCellReferenceByCoord(maxRow, maxCol)}`;
            insertCellReference(rangeRef);
            return;
        }

        const { minRow, maxRow, minCol, maxCol } = expandBoundsForMergedCells({
            minRow: Math.min(selectionStart.row, selectionEnd.row),
            maxRow: Math.max(selectionStart.row, selectionEnd.row),
            minCol: Math.min(selectionStart.col, selectionEnd.col),
            maxCol: Math.max(selectionStart.col, selectionEnd.col)
        });

        const nextSelectedSet = new Set(
            isCtrlMultiSelecting && multiSelectionBaseCells ? multiSelectionBaseCells : []
        );
        const previouslySelected = new Set(tbody.querySelectorAll("td.selected"));
        nextSelectedSet.forEach(cell => {
            cell.classList.add("selected");
            previouslySelected.delete(cell);
        });

        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                const cell = getVisibleCell(r, c);
                if (cell && cell.style.display !== "none") {
                    cell.classList.add("selected");
                    nextSelectedSet.add(cell);
                    previouslySelected.delete(cell);
                }
            }
        }
        previouslySelected.forEach(c => c.classList.remove("selected"));
        if (activeCell) {
            activeCell.classList.add("active-cell", "selected");
            nextSelectedSet.add(activeCell);
        }
        updateSelectedCellsDisplay(Array.from(nextSelectedSet));
    }

    function adjustFormula(formula, rowOffset, colOffset) {
        const protectedTokens = [];
        const maskToken = (m) => {
            const token = `__ADJ_TOK_${protectedTokens.length}__`;
            protectedTokens.push(m);
            return token;
        };

        const maskSheetPrefix = (m) => {
            const token = `__ADJ_SH_${protectedTokens.length}__!`;
            protectedTokens.push(m);
            return token;
        };

        // 文字列リテラルと「シート名!」プレフィックスのみを退避し、直後のセル番地は $ 指定に従って相対移動させる
        const maskedBody = formula.substring(1)
            .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'(?!\s*!)/g, maskToken)
            .replace(/(?:'[^']+'|[A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+)!/g, maskSheetPrefix);

        const adjustedBody = maskedBody
            .replace(/(?<![A-Za-z0-9_$])(\$?)([A-Za-z]+)(\$?)(\d+)(?![A-Za-z0-9_]|\s*\()/g, (_, absCol, colLetters, absRow, rowStr) => {
                const nextCol = absCol ? columnLettersToIndex(colLetters) : Math.max(0, columnLettersToIndex(colLetters) + colOffset);
                const nextRow = absRow ? parseInt(rowStr, 10) : Math.max(1, parseInt(rowStr, 10) + rowOffset);
                return `${absCol}${getColumnName(nextCol)}${absRow}${nextRow}`;
            })
            .replace(/__ADJ_SH_(\d+)__!/g, (_, idx) => protectedTokens[Number(idx)])
            .replace(/__ADJ_TOK_(\d+)__/g, (_, idx) => protectedTokens[Number(idx)]);

        return "=" + adjustedBody;
    }

    const {
        isFillDragging,
        cloneCellProperties,
        updateFillHandle,
        hideAutoFillOptions,
        syncAutoFillOptionButtonPosition
    } = createAutoFillModule({
        signal,
        spreadsheetContent,
        tbody,
        getActiveCell: () => activeCell,
        getSheets: () => sheets,
        getActiveSheetIndex: () => activeSheetIndex,
        getRowCount: () => rowCount,
        getCurrentColumns: () => currentColumns,
        isCurrentSheetProtected: () => isCurrentSheetProtected(),
        isCellLockedForEdit: (cell) => isCellLockedForEdit(cell),
        peekCell,
        getCell,
        getVisibleCell,
        getCellPureText: (cell) => getCellPureText(cell),
        getSelectedRangeBounds: () => getSelectedRangeBounds(),
        getRangeLocalRect: (bounds) => getRangeLocalRect(bounds),
        extractCellStyleObject: (cell) => extractCellStyleObject(cell),
        applyCellStyleData: (cell, styleData) => applyCellStyleData(cell, styleData),
        applyShrinkToFit: (cell) => applyShrinkToFit(cell),
        syncCellAnnotationMark: (cell) => syncCellAnnotationMark(cell),
        clearSpillCellsFromAnchor: (r, c) => clearSpillCellsFromAnchor(r, c),
        adjustFormula: (f, dr, dc) => adjustFormula(f, dr, dc),
        setCellFormattedValue: (cell, val) => setCellFormattedValue(cell, val),
        clearSelection: () => clearSelection(),
        setSelectionBounds: (start, end) => {
            selectionStart = start;
            selectionEnd = end;
        },
        updateSelection: () => updateSelection(),
        updateAllFormulas: () => updateAllFormulas(),
        applyConditionalFormats: () => applyConditionalFormats(),
        syncCellGridlinesForBounds: (bounds) => syncCellGridlinesForBounds(bounds),
        updateSelectedCellsDisplay: () => updateSelectedCellsDisplay(),
        showAlert: (...args) => showAlert(...args),
        setDirtyState: (flag) => setDirtyState(flag),
        debouncedSaveState: (delay) => debouncedSaveState(delay)
    });

    // =========================================================
    // セル結合・解除
    // =========================================================
    function mergeSelectedCells() {
        if (isCurrentSheetProtected()) {
            showAlert("シートが保護されているため、セルを結合できません。", "シートの保護");
            return;
        }
        const selectedCells = tbody.querySelectorAll("td.selected");
        if (!selectedCells.length) return;

        let minRow = Infinity, maxRow = -Infinity, minCol = Infinity, maxCol = -Infinity;
        let coveredCount = 0;
        selectedCells.forEach(cell => {
            const r0 = +cell.dataset.row, c0 = +cell.dataset.col;
            const rs = parseInt(cell.getAttribute("rowspan") || "1", 10);
            const cs = parseInt(cell.getAttribute("colspan") || "1", 10);
            minRow = Math.min(minRow, r0);
            maxRow = Math.max(maxRow, r0 + rs - 1);
            minCol = Math.min(minCol, c0);
            maxCol = Math.max(maxCol, c0 + cs - 1);
            coveredCount += rs * cs;
        });

        const expectedCount = (maxRow - minRow + 1) * (maxCol - minCol + 1);
        if (expectedCount === 1) {
            showAlert("単体セルでは結合できません。", "セル結合");
            return;
        }
        if (coveredCount !== expectedCount) {
            showAlert("連続した矩形状のセルを選択してください。", "セル結合");
            return;
        }

        // 混在範囲内の既存結合セルをすべて正規化（事前解除）してマトリクス整合性を保つ
        const expanded = expandBoundsForMergedCells({ minRow, maxRow, minCol, maxCol });
        minRow = expanded.minRow;
        maxRow = expanded.maxRow;
        minCol = expanded.minCol;
        maxCol = expanded.maxCol;

        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                const cell = getCell(r, c);
                if (!cell) continue;
                cell.removeAttribute("rowspan");
                cell.removeAttribute("colspan");
                cell.classList.remove("merged");
                cell.style.display = "";
                delete cell.dataset.mergeMinRow;
                delete cell.dataset.mergeMaxRow;
                delete cell.dataset.mergeMinCol;
                delete cell.dataset.mergeMaxCol;
                delete cell.dataset.mergeAnchorRow;
                delete cell.dataset.mergeAnchorCol;
            }
        }

        let anchorValue = "";
        let anchorFormula = "";
        let anchorNumFmt = "";
        let anchorDecPlaces = "";
        let anchorRichRuns = "";
        let anchorHyperlink = "";
        for (let r = minRow; r <= maxRow; r++) {
            let found = false;
            for (let c = minCol; c <= maxCol; c++) {
                const cell = getCell(r, c);
                const raw = cell ? (cell.dataset.rawValue ?? getCellPureText(cell)) : "";
                if (cell && (cell.dataset.formula || raw.trim() !== "")) {
                    anchorNumFmt = cell.dataset.numFormat || "";
                    anchorDecPlaces = cell.dataset.decimalPlaces || "";
                    anchorRichRuns = cell.dataset.richRuns || "";
                    anchorHyperlink = cell.dataset.hyperlink || "";
                    if (cell.dataset.formula) {
                        anchorFormula = cell.dataset.formula;
                        anchorValue = evaluateFormula(anchorFormula);
                    } else {
                        anchorValue = raw;
                    }
                    found = true;
                    break;
                }
            }
            if (found) break;
        }

        const anchor = getCell(minRow, minCol);
        if (anchorNumFmt) anchor.dataset.numFormat = anchorNumFmt;
        if (anchorDecPlaces) anchor.dataset.decimalPlaces = anchorDecPlaces;
        if (anchorRichRuns && !anchorFormula) anchor.dataset.richRuns = anchorRichRuns;
        else delete anchor.dataset.richRuns;
        if (anchorHyperlink) {
            anchor.dataset.hyperlink = anchorHyperlink;
            anchor.classList.add("ss-hyperlink");
            anchor.title = `${anchorHyperlink}（Ctrl+クリックで開く）`;
        } else {
            delete anchor.dataset.hyperlink;
            anchor.classList.remove("ss-hyperlink");
            anchor.removeAttribute("title");
        }
        if (anchorFormula) {
            anchor.dataset.formula = anchorFormula;
            setCellFormattedValue(anchor, anchorValue);
        } else {
            delete anchor.dataset.formula;
            setCellFormattedValue(anchor, anchorValue);
        }
        if (!anchor.style.textAlign) {
            anchor.style.textAlign = "center";
        }
        anchor.setAttribute("rowspan", String(maxRow - minRow + 1));
        anchor.setAttribute("colspan", String(maxCol - minCol + 1));
        anchor.classList.add("merged");
        anchor.dataset.mergeMinRow = String(minRow);
        anchor.dataset.mergeMaxRow = String(maxRow);
        anchor.dataset.mergeMinCol = String(minCol);
        anchor.dataset.mergeMaxCol = String(maxCol);

        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                if (r === minRow && c === minCol) continue;
                const cell = getCell(r, c);
                if (cell) {
                    cell.innerHTML = "";
                    Object.keys(cell.dataset).forEach(k => {
                        if (k !== "row" && k !== "col") delete cell.dataset[k];
                    });
                    cell.removeAttribute("style");
                    cell.style.display = "none";
                    cell.className = "";
                    cell.dataset.mergeAnchorRow = String(minRow);
                    cell.dataset.mergeAnchorCol = String(minCol);
                }
            }
        }
        syncCellGridlinesForBounds({ minRow, maxRow, minCol, maxCol });
        clearSelection();
        setActiveCell(anchor, true);
        selectionStart = { row: minRow, col: minCol };
        selectionEnd = { row: maxRow, col: maxCol };
        updateSelectionEdges();
        updateSelectedCellsDisplay();
        updateAllFormulas();
        updateFillHandle();
        setDirtyState(true);
        debouncedSaveState();
    }

    function unmergeSelectedCells() {
        if (isCurrentSheetProtected()) {
            showAlert("シートが保護されているため、セル結合を解除できません。", "シートの保護");
            return;
        }
        const selectedCells = Array.from(tbody.querySelectorAll("td.selected"));
        if (!selectedCells.length) return;
        const processed = new Set();
        const restoredCells = [];

        selectedCells.forEach(cell => {
            const rowSpan = parseInt(cell.getAttribute("rowspan") || "1", 10);
            const colSpan = parseInt(cell.getAttribute("colspan") || "1", 10);
            const isMerged = (rowSpan > 1 || colSpan > 1) || Boolean(cell.dataset.mergeMinRow);
            if (!isMerged) {
                restoredCells.push(cell);
                return;
            }

            const anchorKey = `${cell.dataset.row},${cell.dataset.col}`;
            if (processed.has(anchorKey)) return;
            processed.add(anchorKey);

            const minRow = parseInt(cell.dataset.mergeMinRow || cell.dataset.row, 10);
            const minCol = parseInt(cell.dataset.mergeMinCol || cell.dataset.col, 10);
            const maxRow = parseInt(cell.dataset.mergeMaxRow || String(minRow + rowSpan - 1), 10);
            const maxCol = parseInt(cell.dataset.mergeMaxCol || String(minCol + colSpan - 1), 10);

            cell.removeAttribute("rowspan");
            cell.removeAttribute("colspan");
            cell.classList.remove("merged");
            delete cell.dataset.mergeMinRow;
            delete cell.dataset.mergeMaxRow;
            delete cell.dataset.mergeMinCol;
            delete cell.dataset.mergeMaxCol;

            for (let r = minRow; r <= maxRow; r++) {
                for (let c = minCol; c <= maxCol; c++) {
                    const other = getCell(r, c);
                    if (other) {
                        other.style.display = "";
                        delete other.dataset.mergeAnchorRow;
                        delete other.dataset.mergeAnchorCol;
                        restoredCells.push(other);
                    }
                }
            }
        });

        syncCellGridlinesForCells(restoredCells);
        clearSelection();
        restoredCells.forEach(c => c.classList.add("selected"));
        if (restoredCells[0]) setActiveCell(restoredCells[0], true);
        updateSelectionEdges();
        updateSelectedCellsDisplay();
        updateAllFormulas();
        updateFillHandle();
        setDirtyState(true);
        debouncedSaveState();
    }

    // =========================================================
    // コピー・切り取り＆貼り付け（clipboard.js）
    // =========================================================
    const {
        hasClipboardData,
        isCopyAnimationActive,
        syncCopyAntsBoxPosition,
        clearCopyAnimation,
        copySelectedCells,
        pasteClipboardData,
        openPasteSpecialDialog
    } = createClipboardModule({
        win,
        spreadsheetContent,
        tbody,
        getActiveCell: () => activeCell,
        getSheets: () => sheets,
        getActiveSheetIndex: () => activeSheetIndex,
        getFreezeRows: () => freezeRows,
        getFreezeCols: () => freezeCols,
        isCurrentSheetProtected: () => isCurrentSheetProtected(),
        isCellLockedForEdit: (cell) => isCellLockedForEdit(cell),
        getCell,
        getVisibleCell,
        peekCell,
        getRow,
        getCellPureText: (cell) => getCellPureText(cell),
        getSelectedRangeBounds: () => getSelectedRangeBounds(),
        getMovePreviewLocalRect: (bounds) => getMovePreviewLocalRect(bounds),
        hasMergeConflictOnDestination: (bounds, ignoreBounds) => hasMergeConflictOnDestination(bounds, ignoreBounds),
        extractCellStyleObject: (cell) => extractCellStyleObject(cell),
        applyCellStyleData: (cell, styleData) => applyCellStyleData(cell, styleData),
        syncCellGridlinesForCells: (cells) => syncCellGridlinesForCells(cells),
        evaluateFormula: (...args) => evaluateFormula(...args),
        adjustFormula: (f, dr, dc) => adjustFormula(f, dr, dc),
        adjustMovedFormulaSelf: (f, srcBounds, dr, dc) => adjustMovedFormulaSelf(f, srcBounds, dr, dc),
        clearSpillCellsFromAnchor: (r, c) => clearSpillCellsFromAnchor(r, c),
        commitCellValue: (cell, val, opts) => commitCellValue(cell, val, opts),
        setCellFormattedValue: (cell, val) => setCellFormattedValue(cell, val),
        syncCellAnnotationMark: (cell) => syncCellAnnotationMark(cell),
        applyShrinkToFit: (cell) => applyShrinkToFit(cell),
        getRangeLocalRect: (bounds) => getRangeLocalRect(bounds),
        getFloatingObjectsInBounds: (bounds) => getFloatingObjectsInBounds(bounds),
        snapshotFloatingObject: (box, rect) => snapshotFloatingObject(box, rect),
        spawnFloatingObjectFromSnapshot: (snap, rect, dr, dc) => spawnFloatingObjectFromSnapshot(snap, rect, dr, dc),
        removeFloatingObject: (box) => removeFloatingObject(box),
        shiftConditionalFormatsForMoveOrCopy: (srcBounds, dr, dc, opts) => shiftConditionalFormatsForMoveOrCopy(srcBounds, dr, dc, opts),
        redirectFormulasForMovedRange: (srcBounds, dr, dc, destBounds) => redirectFormulasForMovedRange(srcBounds, dr, dc, destBounds),
        shiftTablesAndAutoFilterForMove: (srcBounds, dr, dc) => shiftTablesAndAutoFilterForMove(srcBounds, dr, dc),
        clearSelection: () => clearSelection(),
        setActiveCell: (cell, shouldFocus) => setActiveCell(cell, shouldFocus),
        autoFitRow: (tr) => autoFitRow(tr),
        applyFreezePanes: () => applyFreezePanes(),
        hasAutoFilters: () => hasAutoFilters(),
        applyAutoFilterRows: () => applyAutoFilterRows(),
        updateAllFormulas: () => updateAllFormulas(),
        refreshVisibleFloatingObjects: () => refreshVisibleFloatingObjects(),
        updateFillHandle: () => updateFillHandle(),
        updateSelectedCellsDisplay: () => updateSelectedCellsDisplay(),
        openAppModal: (...args) => openAppModal(...args),
        showAlert: (...args) => showAlert(...args),
        setDirtyState: (flag) => setDirtyState(flag),
        debouncedSaveState: (delay) => debouncedSaveState(delay)
    });

    // =========================================================
    // ユーザー設定スタイルのみを構造化して抽出・復元するヘルパー
    // =========================================================
    const PERSISTED_STYLE_PROPS = [
        "fontFamily",
        "fontSize",
        "fontWeight",
        "fontStyle",
        "textDecoration",
        "textShadow",
        "color",
        "backgroundColor",
        "textAlign",
        "verticalAlign",
        "writingMode",
        "textOrientation",
        "whiteSpace",
        "wordBreak",
        "borderTop",
        "borderRight",
        "borderBottom",
        "borderLeft",
        "paddingLeft",
        "paddingRight"
    ];

    function sanitizeCellStyleText(rawStyle) {
        if (!rawStyle) return "";
        return String(rawStyle)
            .split(";")
            .map(part => part.trim())
            .filter(part => {
                if (!part) return false;
                if (/^(outline(-offset)?|visibility|height)\s*:/i.test(part)) return false;
                return true;
            })
            .join("; ");
    }

    function extractCellStyleObject(cell) {
        const styleObj = {};
        let hasStyle = false;
        const hasCF = Boolean(cell.dataset.cfApplied);
        for (const prop of PERSISTED_STYLE_PROPS) {
            let val = cell.style[prop];
            if (prop === "fontSize" && cell.dataset.shrinkToFit === "1" && cell.dataset.origFontSize) {
                val = cell.dataset.origFontSize;
            }
            if (hasCF) {
                if (prop === "backgroundColor") val = cell.dataset.cfOrigBg || "";
                else if (prop === "color") val = cell.dataset.cfOrigColor || "";
                else if (prop === "fontWeight") val = cell.dataset.cfOrigWeight || "";
                else if (prop === "fontStyle") val = cell.dataset.cfOrigItalic || "";
                else if (prop === "textDecoration") val = cell.dataset.cfOrigDeco || "";
            }
            if (val && val !== "") {
                styleObj[prop] = val;
                hasStyle = true;
            }
        }
        return hasStyle ? styleObj : null;
    }

    function applyCellStyleData(cell, styleData) {
        const hadJustifyDom = Boolean(cell.querySelector(".ss-justify-line"));
        clearAppliedConditionalStyle(cell);
        cell.removeAttribute("style");
        if (styleData) {
            if (typeof styleData === "string") {
                const cleanStyle = sanitizeCellStyleText(styleData);
                if (cleanStyle) cell.style.cssText = cleanStyle;
            } else if (typeof styleData === "object") {
                for (const prop of PERSISTED_STYLE_PROPS) {
                    if (styleData[prop]) {
                        cell.style[prop] = styleData[prop];
                    }
                }
            }
        }
        if (cell.tagName === "TD") {
            syncCellGridlinesForCells([cell]);
            const isNowJustify = cell.style.textAlign === "justify";
            if (isNowJustify || hadJustifyDom) {
                const displayText = formatDisplayByNumFmt(
                    cell.dataset.rawValue ?? cell.textContent,
                    cell.dataset.numFormat,
                    cell
                );
                setCellTextPreservingControls(cell, displayText);
            }
        }
    }

    // =========================================================
    // フローティングテキストボックス＆グラフ（charts.js）
    // =========================================================
    const {
        selectFloatingObject,
        applyObjectRotation,
        attachObjectHandles,
        removeFloatingObject,
        enableTextboxDragging,
        insertTextBox,
        renderChartBoxSVG,
        openChartSettingsDialog,
        attachChartControls,
        updateAllFloatingCharts,
        insertFloatingChart,
        getRangeLocalRect,
        getFloatingObjectsInBounds,
        snapshotFloatingObject,
        spawnFloatingObjectFromSnapshot
    } = createChartsModule({
        win,
        signal,
        container,
        spreadsheetContent,
        tbody,
        theadRow,
        colgroup,
        getVisibleCell,
        getRow,
        getColumnWidth,
        getSelectedRangeBounds: () => getSelectedRangeBounds(),
        parseRangeReference: (s) => parseRangeReference(s),
        adjustFormula: (f, dr, dc) => adjustFormula(f, dr, dc),
        updateResizeTooltip,
        hideResizeTooltip,
        refreshVisibleFloatingObjects: () => refreshVisibleFloatingObjects(),
        openAppModal: (...args) => openAppModal(...args),
        showAlert: (...args) => showAlert(...args),
        setDirtyState: (flag) => setDirtyState(flag),
        debouncedSaveState: (delay) => debouncedSaveState(delay)
    });

    // =========================================================
    // 仮想FS（Nexser OS）保存・読込・CSV入出力・Undo/Redo（file-io.js）
    // =========================================================
    function flushPendingEdits() {
        if (isCellEditing() && editingCell) {
            commitCellValue(editingCell, cellEditor.value);
        } else if (document.activeElement === formulaBarInput && activeCell) {
            commitCellValue(activeCell, formulaBarInput.value);
            formulaBarInput.blur();
        }
        clearCalculationRangeHighlights();
    }

    const activeSheetObservers = new Set();

    const {
        getCurrentFilePath,
        setCurrentFilePath,
        releaseFileLockIfHeld,
        handleFileRenamed,
        persistCrashRecoveryBackup,
        clearCrashRecoveryBackup,
        readCrashRecoveryRaw,
        saveState,
        cancelDebouncedSaveState,
        debouncedSaveState,
        markCurrentSnapshotAsSaved,
        resetUndoRedoHistoryOnly,
        undo,
        redo,
        getUndoLength,
        getRedoLength,
        clearSheetToBlank,
        captureCurrentSheetDOM,
        serializeSheetSnapshot,
        applySingleSheetToDOM,
        applyDeserializedPayload,
        openFileFromFS,
        writeToFSPath,
        exportLocalFile,
        importLocalFile,
        promptSaveAsDialog,
        promptOpenFileDialog,
        updateStorageUsageDisplay,
        disposeFileIO
    } = createFileIOModule({
        win,
        windowAPI,
        lockOwnerPid,
        container,
        spreadsheetContent,
        colgroup,
        theadRow,
        tbody,
        zoomSlider,
        statusBarState,
        activeSheetObservers,
        getActiveCell: () => activeCell,
        getSheets: () => sheets,
        setSheets: (next) => { sheets = next; },
        getActiveSheetIndex: () => activeSheetIndex,
        setActiveSheetIndex: (idx) => { activeSheetIndex = idx; },
        getDefinedNames: () => definedNames,
        setDefinedNames: (next) => { definedNames = next; },
        createBlankSheetModel,
        getRowCount: () => rowCount,
        getCurrentColumns: () => currentColumns,
        loadRowsSync,
        loadColumnsSync,
        setColumnWidth,
        syncTableWidth,
        updateHiddenHeaderIndicators,
        getPageSize: () => getPageSize(),
        getPrintOptions: () => getPrintOptions(),
        getFreezeRows: () => freezeRows,
        getFreezeCols: () => freezeCols,
        setFreezePanes,
        getCell,
        getVisibleCell,
        getRow,
        extractCellStyleObject,
        applyCellStyleData,
        applyShrinkToFit: (cell) => applyShrinkToFit(cell),
        syncCellAnnotationMark: (cell) => syncCellAnnotationMark(cell),
        insertTextBox: (opts, flags) => insertTextBox(opts, flags),
        renderChartBoxSVG: (box) => renderChartBoxSVG(box),
        attachChartControls: (box) => attachChartControls(box),
        enableTextboxDragging: (box) => enableTextboxDragging(box),
        removeFloatingObject: (box) => removeFloatingObject(box),
        closeCellDropdownList: () => closeCellDropdownList(),
        hideCellDropdownButton: () => hideCellDropdownButton(),
        clearCopyAnimation: () => clearCopyAnimation(),
        clearAllAutoFilters: (opts) => clearAllAutoFilters(opts),
        serializeAutoFilters: () => serializeAutoFilters(),
        restoreAutoFilters: (sheetData, opts) => restoreAutoFilters(sheetData, opts),
        clearAllSlicers: () => clearAllSlicers(),
        serializeSlicers: () => serializeSlicers(),
        restoreSlicers: (sheetData) => restoreSlicers(sheetData),
        getSheetTables: (sIdx) => getSheetTables(sIdx),
        applyStructuredTableVisuals: (tbl) => applyStructuredTableVisuals(tbl),
        renderSheetTabs,
        syncSheetProtectionUI,
        invalidateBackgroundSheetCache: (s) => invalidateBackgroundSheetCache(s),
        invalidateDependencyGraph: () => invalidateDependencyGraph(),
        clearFormulaEvalCache: () => clearFormulaEvalCache(),
        resetConditionalFormatCache: () => resetConditionalFormatCache(),
        recalculateBackgroundSheets: () => recalculateBackgroundSheets(),
        evaluateFormula: (...args) => evaluateFormula(...args),
        setCellFormattedValue,
        updateAllFormulas: () => updateAllFormulas(),
        applyConditionalFormats: () => applyConditionalFormats(),
        syncCellGridlinesForBounds: (bounds) => syncCellGridlinesForBounds(bounds),
        refreshVisibleRows: () => refreshVisibleRows(),
        refreshVisibleFloatingObjects: () => refreshVisibleFloatingObjects(),
        syncCellDropdownButtonPosition: () => syncCellDropdownButtonPosition(),
        setZoom: (z, opts) => setZoom(z, opts),
        setPageSize: (sz, opts) => setPageSize(sz, opts),
        setPrintOptions: (opts, flags) => setPrintOptions(opts, flags),
        clearSelection,
        setActiveCell,
        updateSelectedCellsDisplay,
        updateFillHandle,
        updateToolbarState,
        flushPendingEdits,
        openAppModal,
        showAlert,
        showError,
        renderWindowStatusBar,
        setDirtyState,
        getIsDirty: () => isDirty,
        updateQATButtonsState: () => updateQATButtonsState(),
        managedTimeout,
        clearManagedTimeout,
        destroyFindDialog: () => destroyFindDialog(),
        stopTouchInertia: () => stopTouchInertia(),
        stopDragAutoScroll: () => stopDragAutoScroll(),
        cleanupPrintStyles: () => cleanupPrintStyles()
    });

    // =========================================================
    // ページ設定・印刷制御（print-manager.js）
    // =========================================================
    const {
        getPageSize,
        getPrintOptions,
        setPrintOptions,
        setPageSize,
        togglePrintOrientation,
        togglePrintFit,
        togglePrintGrid,
        printSpreadsheet,
        cleanupPrintStyles
    } = createPrintManagerModule({
        appRoot,
        table,
        tbody,
        lockOwnerPid,
        getActiveCell: () => activeCell,
        getCurrentColumns: () => currentColumns,
        getRow,
        getCell,
        getColumnWidth,
        flushPendingEdits: () => flushPendingEdits(),
        clearSelection: () => clearSelection(),
        clearCalculationRangeHighlights: () => clearCalculationRangeHighlights(),
        setActiveCell: (cell, shouldFocus) => setActiveCell(cell, shouldFocus),
        updateSelectedCellsDisplay: () => updateSelectedCellsDisplay(),
        updateFillHandle: () => updateFillHandle(),
        refreshVisibleRows: () => refreshVisibleRows(),
        renderWindowStatusBar: () => renderWindowStatusBar(),
        setDirtyState: (flag) => setDirtyState(flag),
        debouncedSaveState: (delay) => debouncedSaveState(delay)
    });

    const recentUsedFunctions = [
        { tpl: "=SUM()", label: "SUM - 合計" },
        { tpl: "=AVERAGE()", label: "AVERAGE - 平均" },
        { tpl: "=IF(, , )", label: "IF - 条件分岐" },
        { tpl: "=XLOOKUP(, , )", label: "XLOOKUP - モダン範囲検索" },
        { tpl: "=FILTER(, )", label: "FILTER - 条件抽出" },
        { tpl: "=SUMIFS(, , )", label: "SUMIFS - 複数条件合計" }
    ];

    function renderRecentFunctionsMenu() {
        const menuEl = appRoot.querySelector(".ss-recent-fn-menu");
        if (!menuEl) return;
        menuEl.innerHTML = recentUsedFunctions
            .map(item => `<li class="button" data-fn-tpl="${item.tpl.replace(/"/g, "&quot;")}">${item.label}</li>`)
            .join("");
    }
    renderRecentFunctionsMenu();

    function renderTableStylePresets() {
        const gridEl = appRoot.querySelector(".ss-table-presets-grid");
        if (!gridEl) return;
        const useHeader = appRoot.querySelector(".ss-tbl-opt-header")?.checked ?? true;
        const useStripe = appRoot.querySelector(".ss-tbl-opt-stripe")?.checked ?? true;

        const presetList = [
            { key: "blue", name: "青", headerBg: "#1f4e78", stripeBg: "#d9e1f2", evenBg: "#ffffff", border: "#8ea9db" },
            { key: "orange", name: "オレンジ", headerBg: "#c65911", stripeBg: "#fce4d6", evenBg: "#ffffff", border: "#f4b084" },
            { key: "gray", name: "グレー", headerBg: "#595959", stripeBg: "#ededed", evenBg: "#ffffff", border: "#a6a6a6" },
            { key: "gold", name: "ゴールド", headerBg: "#bf8f00", stripeBg: "#fff2cc", evenBg: "#ffffff", border: "#ffd966" },
            { key: "sky", name: "スカイブルー", headerBg: "#2f75b5", stripeBg: "#ddebf7", evenBg: "#ffffff", border: "#9bc2e6" },
            { key: "green", name: "グリーン", headerBg: "#375623", stripeBg: "#e2efda", evenBg: "#ffffff", border: "#a9d08e" },
            { key: "purple", name: "パープル", headerBg: "#7030a0", stripeBg: "#e9d8f4", evenBg: "#ffffff", border: "#b88ce0" },
            { key: "teal", name: "ティール", headerBg: "#008080", stripeBg: "#d9f2f2", evenBg: "#ffffff", border: "#80cccc" },
            { key: "lightBlue", name: "淡色・青", headerBg: "#d9e1f2", stripeBg: "#f2f5fb", evenBg: "#ffffff", border: "#b4c6e7" },
            { key: "lightGreen", name: "淡色・緑", headerBg: "#e2efda", stripeBg: "#f4f9f0", evenBg: "#ffffff", border: "#c6e0b4" },
            { key: "darkNavy", name: "濃色・ネイビー", headerBg: "#0f243e", stripeBg: "#244062", evenBg: "#17375e", border: "#4f81bd" },
            { key: "darkRed", name: "濃色・エンジ", headerBg: "#632523", stripeBg: "#963634", evenBg: "#7c2d2b", border: "#c0504d" }
        ];

        gridEl.innerHTML = presetList.map(p => {
            const r1 = useHeader ? p.headerBg : p.evenBg;
            const r2 = useStripe ? p.stripeBg : p.evenBg;
            const r3 = p.evenBg;
            return `
                <div class="button" data-table-preset="${p.key}" title="${p.name}" style="padding:3px; flex-direction:column; gap:1px; background:#fff; border:1px solid ${p.border};">
                    <div style="width:100%; height:6px; background:${r1}; border-bottom:1px solid ${p.border};"></div>
                    <div style="width:100%; height:5px; background:${r2}; border-bottom:1px solid ${p.border};"></div>
                    <div style="width:100%; height:5px; background:${r3};"></div>
                </div>
            `;
        }).join("");
    }
    renderTableStylePresets();
    appRoot.querySelector(".ss-tbl-opt-header")?.addEventListener("change", renderTableStylePresets, { signal });
    appRoot.querySelector(".ss-tbl-opt-stripe")?.addEventListener("change", renderTableStylePresets, { signal });

    function switchRibbonTab(tabName) {
        appRoot.querySelectorAll(".ss-ribbon-tab[data-ribbon-tab]").forEach(t => {
            t.classList.toggle("active", t.dataset.ribbonTab === tabName);
        });
        appRoot.querySelectorAll(".ss-ribbon-panel[data-ribbon-panel]").forEach(p => {
            p.classList.toggle("active", p.dataset.ribbonPanel === tabName);
        });
        requestAnimationFrame(fitActiveRibbonPanel);
    }

    function updateQATButtonsState() {
        const undoBtn = appRoot.querySelector(".ss-qat-undo");
        const redoBtn = appRoot.querySelector(".ss-qat-redo");
        if (undoBtn) undoBtn.classList.toggle("disabled", getUndoLength() <= 1);
        if (redoBtn) redoBtn.classList.toggle("disabled", getRedoLength() === 0);
    }

    function insertFormulaTemplate(tpl, labelText = null) {
        const fnNameMatch = tpl.match(/^=([A-Z0-9_]+)\(/i);
        if (fnNameMatch) {
            const label = labelText || `${fnNameMatch[1].toUpperCase()}`;
            const existIdx = recentUsedFunctions.findIndex(x => x.tpl === tpl);
            if (existIdx !== -1) recentUsedFunctions.splice(existIdx, 1);
            recentUsedFunctions.unshift({ tpl, label });
            if (recentUsedFunctions.length > 10) recentUsedFunctions.pop();
            renderRecentFunctionsMenu();
        }

        const targets = tbody.querySelectorAll("td.selected");
        (targets.length ? targets : (activeCell ? [activeCell] : [])).forEach(cell => {
            cell.dataset.formula = tpl;
            setCellFormattedValue(cell, evaluateFormula(tpl));
            formulaBarInput.value = tpl;
        });
        updateAllFormulas();
        if (activeCell) {
            formulaBarInput.focus();
            const parenIdx = tpl.indexOf("(");
            if (parenIdx !== -1) {
                formulaBarInput.setSelectionRange(parenIdx + 1, parenIdx + 1);
            }
        }
        setDirtyState(true);
        debouncedSaveState();
    }

    function insertAutoSum() {
        // すでに =SUM(...) を編集中に再度 Σ を押した場合は即確定
        if (isInFormulaEdit() && activeCell) {
            commitCellValue(activeCell, formulaBarInput.value);
            if (document.activeElement === formulaBarInput) formulaBarInput.blur();
            activeCell.focus({ preventScroll: true });
            updateSelectedCellsDisplay();
            updateFillHandle();
            return;
        }

        const isCellEmpty = (cell) => {
            if (!cell) return true;
            const raw = (cell.dataset.rawValue ?? cell.textContent).trim();
            return raw === "" && !cell.dataset.formula;
        };

        const isNumericCell = (cell) => {
            if (!cell || cell.style.display === "none") return false;
            if (cell.dataset.formula) return true;
            const raw = (cell.dataset.rawValue ?? cell.textContent).trim().replace(/,/g, "");
            return raw !== "" && !isNaN(Number(raw));
        };

        const selected = Array.from(tbody.querySelectorAll("td.selected"));
        if (selected.length > 1) {
            const bounds = getSelectedRangeBounds();
            if (!bounds) return;
            const { minRow: minR, maxRow: maxR, minCol: minC, maxCol: maxC } = bounds;

            // ケース1: 複数行選択で最下行が空白 → 最下行に各列の縦合計を挿入
            if (maxR > minR) {
                const bottomEmpty = Array.from({ length: maxC - minC + 1 }, (_, i) => getCell(maxR, minC + i)).every(isCellEmpty);
                if (bottomEmpty) {
                    for (let c = minC; c <= maxC; c++) {
                        const dest = getVisibleCell(maxR, c);
                        if (!dest) continue;
                        const colName = getColumnName(c);
                        const formula = `=SUM(${colName}${minR}:${colName}${maxR - 1})`;
                        dest.dataset.formula = formula;
                        setCellFormattedValue(dest, evaluateFormula(formula));
                    }
                    updateAllFormulas();
                    setDirtyState(true);
                    debouncedSaveState();
                    return;
                }
            }

            // ケース2: 複数列選択で最右列が空白 → 最右列に各行の横合計を挿入
            if (maxC > minC) {
                const rightEmpty = Array.from({ length: maxR - minR + 1 }, (_, i) => getCell(minR + i, maxC)).every(isCellEmpty);
                if (rightEmpty) {
                    const startCol = getColumnName(minC);
                    const endCol = getColumnName(maxC - 1);
                    for (let r = minR; r <= maxR; r++) {
                        const dest = getVisibleCell(r, maxC);
                        if (!dest) continue;
                        const formula = `=SUM(${startCol}${r}:${endCol}${r})`;
                        dest.dataset.formula = formula;
                        setCellFormattedValue(dest, evaluateFormula(formula));
                    }
                    updateAllFormulas();
                    setDirtyState(true);
                    debouncedSaveState();
                    return;
                }
            }

            // ケース3: データ範囲だけを選択 → 1つ下の行（横1行なら1つ右の列）に合計を挿入
            if (minR === maxR && maxC > minC) {
                const dest = getVisibleCell(minR, maxC + 1);
                if (dest) {
                    const formula = `=SUM(${getColumnName(minC)}${minR}:${getColumnName(maxC)}${minR})`;
                    dest.dataset.formula = formula;
                    setCellFormattedValue(dest, evaluateFormula(formula));
                    clearSelection();
                    setActiveCell(dest, true);
                    updateSelectedCellsDisplay();
                    updateFillHandle();
                    updateAllFormulas();
                    setDirtyState(true);
                    debouncedSaveState();
                }
            } else {
                for (let c = minC; c <= maxC; c++) {
                    const dest = getVisibleCell(maxR + 1, c);
                    if (!dest) continue;
                    const colName = getColumnName(c);
                    const formula = `=SUM(${colName}${minR}:${colName}${maxR})`;
                    dest.dataset.formula = formula;
                    setCellFormattedValue(dest, evaluateFormula(formula));
                }
                updateAllFormulas();
                setDirtyState(true);
                debouncedSaveState();
            }
            return;
        }

        // 単一セル選択時：真上（直上1セル空白まで許容）→ 左隣の順で連続する数値範囲を自動検出
        const target = activeCell || getVisibleCell(1, 0);
        if (!target) return;
        const r = parseInt(target.dataset.row, 10);
        const c = parseInt(target.dataset.col, 10);
        let rangeRef = "";

        let upEnd = r - 1;
        if (upEnd >= 2 && !isNumericCell(getVisibleCell(upEnd, c)) && isNumericCell(getVisibleCell(upEnd - 1, c))) {
            upEnd--;
        }
        if (upEnd >= 1 && isNumericCell(getVisibleCell(upEnd, c))) {
            let topR = upEnd;
            while (topR > 1 && isNumericCell(getVisibleCell(topR - 1, c))) {
                topR--;
            }
            const colName = getColumnName(c);
            rangeRef = `${colName}${topR}:${colName}${upEnd}`;
        } else if (c > 0 && isNumericCell(getVisibleCell(r, c - 1))) {
            let leftC = c - 1;
            while (leftC > 0 && isNumericCell(getVisibleCell(r, leftC - 1))) {
                leftC--;
            }
            rangeRef = `${getColumnName(leftC)}${r}:${getColumnName(c - 1)}${r}`;
        }

        const formula = `=SUM(${rangeRef})`;
        // セル内エディタへ直接投入し、数式バーと完全同期させる
        enterCellEditMode(target, false, "f2");
        cellEditor.value = formula;
        formulaBarInput.value = formula;
        isFormulaBarDirty = true;
        syncCellEditorLayout(target, true);
        lastPointRefRange = { start: 5, end: 5 + rangeRef.length };
        cellEditor.focus();
        cellEditor.setSelectionRange(5, 5 + rangeRef.length);
        if (rangeRef) {
            highlightCalculationRange(formula);
        }
        setDirtyState(true);
    }

    // =========================================================
    // 行列の挿入・削除 ＆ 並べ替え（row-col-ops.js）
    // =========================================================
    const {
        modifySheetRowCol,
        sortSelectedRange,
        openCustomSortDialog
    } = createRowColOpsModule({
        win,
        tbody,
        getActiveCell: () => activeCell,
        getRowCount: () => rowCount,
        getCurrentColumns: () => currentColumns,
        getSheets: () => sheets,
        getActiveSheetIndex: () => activeSheetIndex,
        getDefinedNames: () => definedNames,
        isCurrentSheetProtected: () => isCurrentSheetProtected(),
        getSelectedWholeRows: () => getSelectedWholeRows(),
        getSelectedWholeColumns: () => getSelectedWholeColumns(),
        getSelectedRangeBounds: () => getSelectedRangeBounds(),
        detectDataBlockBounds: (cell) => detectDataBlockBounds(cell),
        getCell,
        getVisibleCell,
        getRow,
        getCellPureText: (cell) => getCellPureText(cell),
        getAutoFilterStates: () => getAutoFilterStates(),
        hasAutoFilters: () => hasAutoFilters(),
        applyAutoFilterRows: () => applyAutoFilterRows(),
        captureCurrentSheetDOM: (opts) => captureCurrentSheetDOM(opts),
        applySingleSheetToDOM: (sheetData, opts) => applySingleSheetToDOM(sheetData, opts),
        flushPendingEdits: () => flushPendingEdits(),
        extractCellStyleObject: (cell) => extractCellStyleObject(cell),
        applyCellStyleData: (cell, styleData) => applyCellStyleData(cell, styleData),
        syncCellAnnotationMark: (cell) => syncCellAnnotationMark(cell),
        applyShrinkToFit: (cell) => applyShrinkToFit(cell),
        adjustFormula: (f, dr, dc) => adjustFormula(f, dr, dc),
        evaluateFormula: (...args) => evaluateFormula(...args),
        setCellFormattedValue: (cell, val) => setCellFormattedValue(cell, val),
        updateAllFormulas: () => updateAllFormulas(),
        applyConditionalFormats: () => applyConditionalFormats(),
        syncCellGridlinesForBounds: (bounds) => syncCellGridlinesForBounds(bounds),
        updateFillHandle: () => updateFillHandle(),
        updateSelectedCellsDisplay: () => updateSelectedCellsDisplay(),
        openAppModal: (...args) => openAppModal(...args),
        showAlert: (...args) => showAlert(...args),
        setDirtyState: (flag) => setDirtyState(flag),
        saveState: () => saveState(),
        debouncedSaveState: (delay) => debouncedSaveState(delay)
    });

    // =========================================================
    // データツール（重複の削除・区切り位置・ピボットテーブル）
    // =========================================================
    const {
        detectDataBlockBounds,
        openRemoveDuplicatesDialog,
        executeRemoveDuplicates,
        openTextToColumnsDialog,
        executeTextToColumns,
        openPivotTableDialog,
        buildPivotTable,
        executeFlashFill
    } = createDataToolsModule({
        tbody,
        win,
        windowAPI,
        statusBarState,
        activeSheetObservers,
        getActiveCell: () => activeCell,
        getRowCount: () => rowCount,
        getCurrentColumns: () => currentColumns,
        getSheets: () => sheets,
        getActiveSheetIndex: () => activeSheetIndex,
        isCurrentSheetProtected: () => isCurrentSheetProtected(),
        getCell,
        getVisibleCell,
        getRow,
        getSelectedRangeBounds: () => getSelectedRangeBounds(),
        loadRowsSync,
        loadColumnsSync,
        addNewSheet: (idx) => addNewSheet(idx),
        renderSheetTabs: () => renderSheetTabs(),
        extractCellStyleObject: (cell) => extractCellStyleObject(cell),
        applyCellStyleData: (cell, styleData) => applyCellStyleData(cell, styleData),
        syncCellAnnotationMark: (cell) => syncCellAnnotationMark(cell),
        applyShrinkToFit: (cell) => applyShrinkToFit(cell),
        clearSpillCellsFromAnchor: (r, c) => clearSpillCellsFromAnchor(r, c),
        adjustFormula: (f, dr, dc) => adjustFormula(f, dr, dc),
        evaluateFormula: (...args) => evaluateFormula(...args),
        setCellFormattedValue: (cell, val) => setCellFormattedValue(cell, val),
        autoFitColumn: (c) => autoFitColumn(c),
        updateAllFormulas: () => updateAllFormulas(),
        applyConditionalFormats: () => applyConditionalFormats(),
        syncCellGridlinesForBounds: (bounds) => syncCellGridlinesForBounds(bounds),
        hasAutoFilters: () => hasAutoFilters(),
        applyAutoFilterRows: () => applyAutoFilterRows(),
        clearSelection: () => clearSelection(),
        setActiveCell: (cell, shouldFocus) => setActiveCell(cell, shouldFocus),
        updateFillHandle: () => updateFillHandle(),
        updateSelectedCellsDisplay: () => updateSelectedCellsDisplay(),
        flushPendingEdits: () => flushPendingEdits(),
        openAppModal: (...args) => openAppModal(...args),
        showAlert: (...args) => showAlert(...args),
        setDirtyState: (flag) => setDirtyState(flag),
        debouncedSaveState: (delay) => debouncedSaveState(delay),
        renderWindowStatusBar: () => renderWindowStatusBar()
    });

    // =========================================================
    // 表のデザイン：オートフォーマット ＆ セルの書式設定ダイアログ
    // =========================================================
    const {
        applyAutoFormatToBounds,
        applyShrinkToFit,
        openFormatCellsModal,
        openAutoFormatDialog
    } = createFormatDialogsModule({
        win,
        measureCtx,
        statusBarState,
        getActiveCell: () => activeCell,
        getVisibleCell,
        getRow,
        getColumnWidth,
        getCellPureText: (cell) => getCellPureText(cell),
        getTargetCells: () => getTargetCells(),
        getSelectedRangeBounds: () => getSelectedRangeBounds(),
        detectDataBlockBounds: (cell) => detectDataBlockBounds(cell),
        evaluateFormula: (...args) => evaluateFormula(...args),
        setCellFormattedValue: (cell, val) => setCellFormattedValue(cell, val),
        autoFitColumn: (c) => autoFitColumn(c),
        autoFitRow: (tr) => autoFitRow(tr),
        applyConditionalFormats: () => applyConditionalFormats(),
        syncCellGridlinesForCells: (cells) => syncCellGridlinesForCells(cells),
        syncCellGridlinesForBounds: (bounds) => syncCellGridlinesForBounds(bounds),
        syncActiveFormulaBar: () => {
            if (!activeCell) return;
            if (isCurrentSheetProtected() && activeCell.dataset.formulaHidden === "1" && activeCell.dataset.formula) {
                formulaBarInput.value = "";
            } else {
                formulaBarInput.value = getCellEditableValue(activeCell);
            }
        },
        scheduleTextOverflowUpdate: () => scheduleTextOverflowUpdate(),
        updateToolbarState: () => updateToolbarState(),
        flushPendingEdits: () => flushPendingEdits(),
        openAppModal: (...args) => openAppModal(...args),
        openConditionalFormatManager: () => openConditionalFormatManager(),
        showAlert: (...args) => showAlert(...args),
        setDirtyState: (flag) => setDirtyState(flag),
        debouncedSaveState: (delay) => debouncedSaveState(delay),
        renderWindowStatusBar: () => renderWindowStatusBar()
    });

    // =========================================================
    // 構造化テーブル（structured-table.js）
    // =========================================================
    const {
        getSheetTables,
        findTableAtCoord,
        applyStructuredTableVisuals,
        convertRangeToStructuredTable,
        openCreateTableDialog,
        convertTableToNormalRange,
        toggleStructuredTableTotalRow,
        tryAutoExpandStructuredTable,
        resolveStructuredReferences
    } = createStructuredTableModule({
        win,
        appRoot,
        statusBarState,
        getSheets: () => sheets,
        getActiveSheetIndex: () => activeSheetIndex,
        getActiveCell: () => activeCell,
        getRowCount: () => rowCount,
        getVisibleCell,
        loadRowsSync,
        isCurrentSheetProtected: () => isCurrentSheetProtected(),
        detectDataBlockBounds: (cell) => detectDataBlockBounds(cell),
        getSelectedRangeBounds: () => getSelectedRangeBounds(),
        flushPendingEdits: () => flushPendingEdits(),
        setCellFormattedValue: (cell, val) => setCellFormattedValue(cell, val),
        evaluateFormula: (...args) => evaluateFormula(...args),
        adjustFormula: (f, dr, dc) => adjustFormula(f, dr, dc),
        addAutoFilterForRange: (opts) => addAutoFilterForRange(opts),
        getAutoFilterByTableId: (id) => getAutoFilterByTableId(id),
        removeAutoFilterById: (id) => removeAutoFilterById(id),
        removeAutoFiltersInBounds: (b) => removeAutoFiltersInBounds(b),
        hasAutoFilters: () => hasAutoFilters(),
        applyAutoFilterRows: () => applyAutoFilterRows(),
        updateAllFormulas: () => updateAllFormulas(),
        applyConditionalFormats: () => applyConditionalFormats(),
        syncCellGridlinesForBounds: (bounds) => syncCellGridlinesForBounds(bounds),
        getBackgroundSheetCellMap: (sheetObj) => getBackgroundSheetCellMap(sheetObj),
        openAppModal: (...args) => openAppModal(...args),
        openSheetRangePicker: (opts) => openSheetRangePicker(opts),
        showAlert: (...args) => showAlert(...args),
        renderWindowStatusBar: () => renderWindowStatusBar(),
        setDirtyState: (flag) => setDirtyState(flag),
        debouncedSaveState: (delay) => debouncedSaveState(delay)
    });

    // =========================================================
    // Excel 365準拠 オートフィルター機能（auto-filter.js）
    // =========================================================
    const {
        getAutoFilterStates,
        hasAutoFilters,
        closeFilterDropdown,
        getAutoFilterById,
        getAutoFilterByTableId,
        getAutoFilterAtCoord,
        findActiveAutoFilterForCell,
        isRowMatchingOtherFilters,
        syncFilterButtonState,
        addAutoFilterForRange,
        removeAutoFilterById,
        removeAutoFiltersInBounds,
        shiftAutoFiltersForMove,
        serializeAutoFilters,
        restoreAutoFilters,
        applyAutoFilterRows,
        clearAllAutoFilters,
        toggleAutoFilter
    } = createAutoFilterModule({
        appRoot,
        tbody,
        signal,
        getActiveCell: () => activeCell,
        getRowCount: () => rowCount,
        getCurrentColumns: () => currentColumns,
        getVisibleCell,
        getRow,
        getSelectedRangeBounds: () => getSelectedRangeBounds(),
        findTableAtCoord: (r, c, sIdx) => findTableAtCoord(r, c, sIdx),
        clearSelection: () => clearSelection(),
        setActiveCell: (cell, shouldFocus) => setActiveCell(cell, shouldFocus),
        sortSelectedRange: (asc) => sortSelectedRange(asc),
        refreshVisibleRows: () => refreshVisibleRows(),
        syncCopyAntsBoxPosition: () => syncCopyAntsBoxPosition(),
        syncSelectionBoxPosition: () => syncSelectionBoxPosition(),
        syncCellDropdownButtonPosition: () => syncCellDropdownButtonPosition(),
        refreshFormulaRefOverlay: () => refreshFormulaRefOverlay(),
        onAutoFilterChanged: () => refreshAllSlicers(),
        updateAllFormulas: () => updateAllFormulas(),
        showAlert: (...args) => showAlert(...args),
        setDirtyState: (flag) => setDirtyState(flag),
        debouncedSaveState: (delay) => debouncedSaveState(delay)
    });

    const {
        hasSlicers,
        openInsertSlicerDialog,
        refreshAllSlicers,
        shiftSlicersForMove,
        serializeSlicers,
        restoreSlicers,
        clearAllSlicers
    } = createSlicerModule({
        win,
        signal,
        container,
        spreadsheetContent,
        tbody,
        statusBarState,
        getActiveCell: () => activeCell,
        getVisibleCell,
        getSelectedRangeBounds: () => getSelectedRangeBounds(),
        detectDataBlockBounds: (cell) => detectDataBlockBounds(cell),
        findTableAtCoord: (r, c, sIdx) => findTableAtCoord(r, c, sIdx),
        getAutoFilterById: (id) => getAutoFilterById(id),
        getAutoFilterByTableId: (id) => getAutoFilterByTableId(id),
        getAutoFilterAtCoord: (r, c) => getAutoFilterAtCoord(r, c),
        findActiveAutoFilterForCell: (cell) => findActiveAutoFilterForCell(cell),
        addAutoFilterForRange: (opts) => addAutoFilterForRange(opts),
        applyAutoFilterRows: (opts) => applyAutoFilterRows(opts),
        isRowMatchingOtherFilters: (af, r, exCol) => isRowMatchingOtherFilters(af, r, exCol),
        openAppModal: (...args) => openAppModal(...args),
        showAlert: (...args) => showAlert(...args),
        updateResizeTooltip,
        hideResizeTooltip,
        renderWindowStatusBar: () => renderWindowStatusBar(),
        setDirtyState: (flag) => setDirtyState(flag),
        debouncedSaveState: (delay) => debouncedSaveState(delay)
    });

    async function handleAppAction(action) {
        switch (action) {
            case "new":
                releaseFileLockIfHeld();
                setCurrentFilePath(null);
                setDirtyState(false);
                clearCrashRecoveryBackup();
                clearSheetToBlank();
                markCurrentSnapshotAsSaved();
                statusBarState.stateText = "新規シート";
                renderWindowStatusBar();
                break;
            case "open":
                promptOpenFileDialog();
                break;
            case "save": {
                const curPath = getCurrentFilePath();
                if (curPath) await writeToFSPath(curPath);
                else promptSaveAsDialog(".nxs");
                break;
            }
            case "save-as":
                promptSaveAsDialog(".nxs");
                break;
            case "export-nxs":
                exportLocalFile(".nxs");
                break;
            case "export-csv":
                promptSaveAsDialog(".csv");
                break;
            case "export-csv-local":
                exportLocalFile(".csv");
                break;
            case "import-local":
                importLocalFile();
                break;
            case "undo":
                await undo();
                break;
            case "redo":
                await redo();
                break;
            case "cut":
                copySelectedCells(true);
                break;
            case "copy":
                copySelectedCells(false);
                break;
            case "paste":
                await pasteClipboardData("all");
                break;
            case "paste-values":
                await pasteClipboardData("values");
                break;
            case "paste-formats":
                await pasteClipboardData("formats");
                break;
            case "paste-transpose":
                await pasteClipboardData("transpose");
                break;
            case "paste-special":
                openPasteSpecialDialog();
                break;
            case "format-painter": {
                const btn = appRoot.querySelector(".ss-format-painter-btn");
                if (formatPainterSnapshot) {
                    formatPainterSnapshot = null;
                    btn?.classList.remove("selected");
                    statusBarState.stateText = "準備完了";
                } else if (activeCell) {
                    formatPainterSnapshot = {
                        persistent: false,
                        styleObj: extractCellStyleObject(activeCell),
                        numFormat: activeCell.dataset.numFormat || "",
                        decimalPlaces: activeCell.dataset.decimalPlaces || "",
                        indent: activeCell.dataset.indent || "",
                        shrinkToFit: activeCell.dataset.shrinkToFit || "",
                        textRotation: activeCell.dataset.textRotation || "",
                        locked: activeCell.dataset.locked || "",
                        formulaHidden: activeCell.dataset.formulaHidden || ""
                    };
                    btn?.classList.add("selected");
                    statusBarState.stateText = "書式コピー待機中（ダブルクリックで連続適用 / Escで解除）";
                }
                renderWindowStatusBar();
                break;
            }
            case "clear-cells":
                clearTargetCellsContent();
                break;
            case "clear-formats": {
                const fmtTargets = getTargetCells();
                const affectedRows = new Set();
                fmtTargets.forEach(c => {
                    clearAppliedConditionalStyle(c);
                    c.removeAttribute("style");
                    c.classList.remove("ss-has-numfmt-color");
                    if (c.dataset.valueType === "date" && !c.dataset.formula) {
                        const dt = resolveDateFromRawValue(c.dataset.rawValue ?? getCellPureText(c));
                        if (dt) c.dataset.rawValue = String(dateToSerial(dt));
                    }
                    delete c.dataset.numFormat;
                    delete c.dataset.decimalPlaces;
                    delete c.dataset.richRuns;
                    delete c.dataset.indent;
                    delete c.dataset.shrinkToFit;
                    delete c.dataset.origFontSize;
                    delete c.dataset.textRotation;
                    delete c.dataset.quotePrefix;
                    delete c.dataset.valueType;
                    delete c.dataset.dateValue;
                    const raw = c.dataset.formula ? (c.dataset.rawValue ?? "") : (c.dataset.rawValue ?? getCellPureText(c));
                    setCellFormattedValue(c, raw);
                    const tr = c.closest("tr");
                    if (tr) affectedRows.add(tr);
                });
                affectedRows.forEach(tr => autoFitRow(tr));
                syncCellGridlinesForCells(fmtTargets);
                applyConditionalFormats();
                if (activeCell) formulaBarInput.value = getCellEditableValue(activeCell);
                scheduleTextOverflowUpdate();
                updateToolbarState();
                setDirtyState(true);
                debouncedSaveState();
                break;
            }
            case "clear-all": {
                const clearBounds = getSelectedRangeBounds();
                const allTargets = getTargetCells();
                allTargets.forEach(c => {
                    clearAppliedConditionalStyle(c);
                    delete c.dataset.cfIcon;
                    c.style.removeProperty("--cf-icon-color");
                    c.removeAttribute("style");
                    delete c.dataset.numFormat;
                    delete c.dataset.decimalPlaces;
                    delete c.dataset.dropdownList;
                    delete c.dataset.dvRule;
                    delete c.dataset.hyperlink;
                    delete c.dataset.tableId;
                    delete c.dataset.note;
                    delete c.dataset.comment;
                    delete c.dataset.indent;
                    delete c.dataset.shrinkToFit;
                    delete c.dataset.origFontSize;
                    delete c.dataset.textRotation;
                    delete c.dataset.locked;
                    delete c.dataset.formulaHidden;
                    c.querySelector(":scope > .ss-anno-mark")?.remove();
                    c.style.removeProperty("--ss-numfmt-color");
                    c.style.removeProperty("--ss-fill-bg");
                    c.classList.remove("ss-hyperlink", "ss-has-numfmt-color", "ss-has-fill", "ss-fill-seam-r", "ss-fill-seam-b", "ss-no-gl-r", "ss-no-gl-b");
                    c.removeAttribute("title");
                });
                syncCellGridlinesForCells(allTargets);
                if (clearBounds) {
                    // 選択範囲内に完全に含まれる構造化テーブル定義を削除
                    if (sheets[activeSheetIndex] && Array.isArray(sheets[activeSheetIndex].tables)) {
                        sheets[activeSheetIndex].tables = sheets[activeSheetIndex].tables.filter(tbl => !(
                            tbl.minRow >= clearBounds.minRow && tbl.maxRow <= clearBounds.maxRow &&
                            tbl.minCol >= clearBounds.minCol && tbl.maxCol <= clearBounds.maxCol
                        ));
                    }
                    // 選択範囲内に完全に含まれる条件付き書式ルールを削除
                    if (sheets[activeSheetIndex] && Array.isArray(sheets[activeSheetIndex].conditionalFormats)) {
                        sheets[activeSheetIndex].conditionalFormats = sheets[activeSheetIndex].conditionalFormats.filter(rule => !(
                            rule.minRow >= clearBounds.minRow && rule.maxRow <= clearBounds.maxRow &&
                            rule.minCol >= clearBounds.minCol && rule.maxCol <= clearBounds.maxCol
                        ));
                    }
                    // 選択範囲と重なるオートフィルターのみ解除（他テーブルのフィルターは保持）
                    removeAutoFiltersInBounds(clearBounds);
                }
                clearTargetCellsContent();
                hideCellDropdownButton();
                hideDataValidationTooltip();
                break;
            }
            case "add-sheet":
                await addNewSheet(activeSheetIndex);
                break;
            case "delete-sheet":
                deleteSheet(activeSheetIndex);
                break;
            case "rename-sheet":
                renameSheetDialog(activeSheetIndex);
                break;
            case "autofit-row":
                if (activeCell) autoFitRow(activeCell.closest("tr"));
                setDirtyState(true);
                debouncedSaveState();
                break;
            case "autofit-col":
                if (activeCell) autoFitColumn(parseInt(activeCell.dataset.col, 10));
                setDirtyState(true);
                debouncedSaveState();
                break;
            case "insert-chart-bar":
                insertFloatingChart("bar");
                break;
            case "insert-chart-stacked":
                insertFloatingChart("stacked");
                break;
            case "insert-chart-line":
                insertFloatingChart("line");
                break;
            case "insert-chart-pie":
                insertFloatingChart("pie");
                break;
            case "insert-chart-scatter":
                insertFloatingChart("scatter");
                break;
            case "custom-numfmt": {
                const target = activeCell || tbody.querySelector("td.selected");
                const curFmt = target?.dataset.numFormat?.startsWith("custom:") ? target.dataset.numFormat.slice(7) : '#,##0"円"';
                const sampleRaw = target ? (target.dataset.formula ? evaluateFormula(target.dataset.formula) : (target.dataset.rawValue ?? target.textContent)) : "12345";
                const sampleVal = String(sampleRaw ?? "").trim() !== "" ? sampleRaw : "12345";

                const presets = [
                    { fmt: '#,##0"円"', desc: '金額 (12,345円)' },
                    { fmt: '"¥"#,##0;-"¥"#,##0;"¥"0', desc: '通貨・正負ゼロ指定' },
                    { fmt: '#,##0"個"', desc: '数量 (12,345個)' },
                    { fmt: '0.0%', desc: 'パーセント小数1桁' },
                    { fmt: '"No."0000', desc: 'ゼロ埋め連番 (No.0001)' },
                    { fmt: 'yyyy"年"m"月"d"日"(aaa)', desc: '曜日付き日付' }
                ];

                const bodyHtml = `
                    <div style="width:100%; display:flex; flex-direction:column; gap:8px; font-size:12px;">
                        <div>ユーザー定義の表示形式を入力または選択してください:</div>
                        <input type="text" class="ss-cnfmt-input border" value="${escapeHtml(curFmt)}" style="width:100%; height:24px; padding:2px 6px; background:#fff; color:#000; font-family:monospace;">
                        <div style="background:#f5f5f5; border:1px solid #999; padding:5px 8px;">
                            プレビュー: <strong class="ss-cnfmt-preview">${escapeHtml(formatByCustomPattern(sampleVal, curFmt))}</strong>
                        </div>
                        <div style="font-size:11px; color:#333;">よく使う書式プリセット:</div>
                        <select class="ss-cnfmt-preset border" size="6" style="width:100%; background:#fff; color:#000; font-size:12px;">
                            ${presets.map(p => `<option value="${escapeHtml(p.fmt)}">${escapeHtml(p.fmt)} — ${p.desc}</option>`).join("")}
                        </select>
                    </div>
                `;
                const modalContent = openAppModal("セルの表示形式（ユーザー定義）", bodyHtml, {
                    width: 420,
                    isHtml: true,
                    buttons: [
                        {
                            label: "OK",
                            onClick: () => {
                                const pat = modalContent.querySelector(".ss-cnfmt-input")?.value.trim();
                                const targets = getTargetCells();
                                targets.forEach(c => {
                                    if (!pat) {
                                        delete c.dataset.numFormat;
                                    } else {
                                        c.dataset.numFormat = `custom:${pat}`;
                                        delete c.dataset.decimalPlaces;
                                    }
                                    const raw = c.dataset.formula ? (c.dataset.rawValue ?? "") : (c.dataset.rawValue ?? getCellPureText(c));
                                    setCellFormattedValue(c, raw);
                                });
                                scheduleTextOverflowUpdate();
                                updateToolbarState();
                                setDirtyState(true);
                                debouncedSaveState();
                            }
                        },
                        { label: "キャンセル" }
                    ]
                });
                const inp = modalContent?.querySelector(".ss-cnfmt-input");
                const prev = modalContent?.querySelector(".ss-cnfmt-preview");
                const presetSel = modalContent?.querySelector(".ss-cnfmt-preset");
                const updatePrev = () => {
                    if (prev && inp) prev.textContent = formatByCustomPattern(sampleVal, inp.value.trim());
                };
                inp?.addEventListener("input", updatePrev);
                presetSel?.addEventListener("change", () => {
                    if (inp) {
                        inp.value = presetSel.value;
                        updatePrev();
                    }
                });
                break;
            }
            case "trace-precedents": {
                if (!activeCell) break;
                const count = tracePrecedentsForCell(activeCell);
                if (count === 0) {
                    showAlert("選択中のセルには、同じシート内の参照元数式がありません。", "参照元のトレース");
                } else {
                    statusBarState.stateText = `${getCellReference(activeCell)} の参照元を ${count} 件トレースしました`;
                    renderWindowStatusBar();
                }
                break;
            }
            case "trace-dependents": {
                if (!activeCell) break;
                const count = traceDependentsForCell(activeCell);
                if (count === 0) {
                    showAlert("このセルを参照している数式は同じシート内に見つかりませんでした。", "参照先のトレース");
                } else {
                    statusBarState.stateText = `${getCellReference(activeCell)} の参照先を ${count} 件トレースしました`;
                    renderWindowStatusBar();
                }
                break;
            }
            case "clear-trace-arrows":
                clearAuditArrows();
                statusBarState.stateText = "トレース矢印を削除しました";
                renderWindowStatusBar();
                break;
            case "toggle-show-formulas":
                toggleShowFormulasMode();
                break;
            case "error-check":
                openErrorCheckDialog();
                break;
            case "recalc-all":
                updateAllFormulas();
                statusBarState.stateText = "再計算完了";
                renderWindowStatusBar();
                break;
            case "zoom-100":
                setZoom(100);
                break;
            case "focus-formulas-tab":
                appRoot.querySelector(".ss-ribbon-shell")?.classList.remove("collapsed");
                switchRibbonTab("formulas");
                break;
            case "toggle-ribbon": {
                const shell = appRoot.querySelector(".ss-ribbon-shell");
                const btn = appRoot.querySelector(".ss-ribbon-collapse-btn");
                if (shell) {
                    const collapsed = shell.classList.toggle("collapsed");
                    if (btn) btn.textContent = collapsed ? "▼" : "▲";
                    if (!collapsed) requestAnimationFrame(fitActiveRibbonPanel);
                }
                break;
            }
            case "toggle-print-orientation":
                togglePrintOrientation();
                break;
            case "toggle-print-fit":
                togglePrintFit();
                break;
            case "toggle-print-grid":
                togglePrintGrid();
                break;
            case "print":
                printSpreadsheet();
                break;
            case "insert-textbox":
                insertTextBox();
                break;
            case "auto-sum":
                insertAutoSum();
                break;
            case "toggle-autofilter":
                toggleAutoFilter();
                break;
            case "clear-autofilter":
                clearAllAutoFilters();
                break;
            case "insert-slicer":
                openInsertSlicerDialog();
                break;
            case "custom-sort":
                openCustomSortDialog();
                break;
            case "data-validation":
                openDataValidationDialog();
                break;
            case "find-replace":
                openFindReplaceDialog(false);
                break;
            case "open-replace":
                openFindReplaceDialog(true);
                break;
            case "go-to":
                openGoToDialog();
                break;
            case "go-to-special":
                openGoToSpecialDialog();
                break;
            case "select-formulas":
                selectCellsBySpecialMode("formulas");
                break;
            case "select-blanks":
                selectCellsBySpecialMode("blanks");
                break;
            case "select-visible":
                selectCellsBySpecialMode("visible");
                break;
            case "select-cf":
                selectCellsBySpecialMode("conditionalFormats");
                break;
            case "select-dv":
                selectCellsBySpecialMode("dataValidation");
                break;
            case "remove-duplicates":
                openRemoveDuplicatesDialog();
                break;
            case "text-to-columns":
                openTextToColumnsDialog();
                break;
            case "flash-fill":
                executeFlashFill();
                break;
            case "auto-format":
                openAutoFormatDialog();
                break;
            case "create-table":
                openCreateTableDialog("blue");
                break;
            case "toggle-table-total":
                toggleStructuredTableTotalRow();
                break;
            case "pivot-table":
                openPivotTableDialog();
                break;
            case "format-cells":
                openFormatCellsModal("number");
                break;
            case "define-name":
                openDefineNameModal();
                break;
            case "insert-hyperlink":
                openHyperlinkDialog();
                break;
            case "insert-comment":
                if (activeCell) openCellAnnotationModal(activeCell, "comment");
                break;
            case "insert-note":
                if (activeCell) openCellAnnotationModal(activeCell, "note");
                break;
            case "indent-inc":
            case "indent-dec": {
                const delta = action === "indent-inc" ? 1 : -1;
                const cells = getTargetCells().filter(el => el.tagName === "TD");
                cells.forEach(td => {
                    const next = Math.max(0, Math.min(15, (Number(td.dataset.indent || "0") || 0) + delta));
                    if (next > 0) td.dataset.indent = String(next);
                    else delete td.dataset.indent;
                    const align = td.style.textAlign || "left";
                    td.style.paddingLeft = (align !== "right" && next > 0) ? `${4 + next * 10}px` : "";
                    td.style.paddingRight = (align === "right" && next > 0) ? `${4 + next * 10}px` : "";
                });
                scheduleTextOverflowUpdate();
                setDirtyState(true);
                debouncedSaveState();
                break;
            }
            case "row-height": {
                const wholeRows = getSelectedWholeRows();
                const bounds = getSelectedRangeBounds();
                const targets = wholeRows.length
                    ? wholeRows
                    : (bounds ? Array.from({ length: bounds.maxRow - bounds.minRow + 1 }, (_, i) => bounds.minRow + i) : (activeCell ? [+activeCell.dataset.row] : []));
                if (targets.length) openDimensionInputDialog("row", targets);
                break;
            }
            case "col-width": {
                const wholeCols = getSelectedWholeColumns();
                const bounds = getSelectedRangeBounds();
                const targets = wholeCols.length
                    ? wholeCols
                    : (bounds ? Array.from({ length: bounds.maxCol - bounds.minCol + 1 }, (_, i) => bounds.minCol + i) : (activeCell ? [+activeCell.dataset.col] : []));
                if (targets.length) openDimensionInputDialog("col", targets);
                break;
            }
            case "hide-rows": {
                const wholeRows = getSelectedWholeRows();
                const bounds = getSelectedRangeBounds();
                const targets = wholeRows.length
                    ? wholeRows
                    : (bounds ? Array.from({ length: bounds.maxRow - bounds.minRow + 1 }, (_, i) => bounds.minRow + i) : []);
                if (targets.length) setRowsVisibility(targets, false);
                break;
            }
            case "unhide-rows": {
                const bounds = getSelectedRangeBounds();
                if (bounds) {
                    const rows = [];
                    for (let r = Math.max(1, bounds.minRow - 1); r <= Math.min(tbody.rows.length, bounds.maxRow + 1); r++) rows.push(r);
                    setRowsVisibility(rows, true);
                }
                break;
            }
            case "hide-cols": {
                const wholeCols = getSelectedWholeColumns();
                const bounds = getSelectedRangeBounds();
                const targets = wholeCols.length
                    ? wholeCols
                    : (bounds ? Array.from({ length: bounds.maxCol - bounds.minCol + 1 }, (_, i) => bounds.minCol + i) : []);
                if (targets.length) setColumnsVisibility(targets, false);
                break;
            }
            case "unhide-cols": {
                const bounds = getSelectedRangeBounds();
                if (bounds) {
                    const cols = [];
                    for (let c = Math.max(0, bounds.minCol - 1); c <= Math.min(currentColumns - 1, bounds.maxCol + 1); c++) cols.push(c);
                    setColumnsVisibility(cols, true);
                }
                break;
            }
            case "toggle-gridlines": {
                const hidden = appRoot.classList.toggle("ss-hide-gridlines");
                const btn = appRoot.querySelector(".ss-view-gridlines-btn");
                if (btn) {
                    btn.classList.toggle("selected", !hidden);
                    btn.textContent = `${hidden ? "☐" : "☑"} 枠線`;
                }
                break;
            }
            case "toggle-headers": {
                const hidden = appRoot.classList.toggle("ss-hide-headers");
                const btn = appRoot.querySelector(".ss-view-headers-btn");
                if (btn) {
                    btn.classList.toggle("selected", !hidden);
                    btn.textContent = `${hidden ? "☐" : "☑"} 見出し`;
                }
                refreshFormulaRefOverlay();
                break;
            }
            case "toggle-formulabar": {
                const hidden = appRoot.classList.toggle("ss-hide-formulabar");
                const btn = appRoot.querySelector(".ss-view-formulabar-btn");
                if (btn) {
                    btn.classList.toggle("selected", !hidden);
                    btn.textContent = `${hidden ? "☐" : "☑"} 数式バー`;
                }
                break;
            }
            case "toggle-sheet-protect": {
                toggleCurrentSheetProtection();
                break;
            }
            case "revert-formula":
                isFormulaBarDirty = false;
                revertSelectedCellsText();
                if (document.activeElement === formulaBarInput) formulaBarInput.blur();
                if (activeCell) activeCell.focus({ preventScroll: true });
                break;
            case "commit-formula": {
                isFormulaBarDirty = false;
                const targets = isInFormulaEdit()
                    ? (activeCell ? [activeCell] : [])
                    : getTargetCells();
                if (targets.length) {
                    commitValueToTargets(activeCell || targets[0], targets, formulaBarInput.value, targets.length > 1);
                }
                if (document.activeElement === formulaBarInput) formulaBarInput.blur();
                if (activeCell) {
                    activeCell.focus({ preventScroll: true });
                    formulaBarInput.value = activeCell.dataset.formula
                        ? activeCell.dataset.formula
                        : (activeCell.dataset.rawValue ?? activeCell.textContent);
                }
                updateSelectedCellsDisplay();
                updateFillHandle();
                break;
            }
        }
    }

    // window標準リボンは非表示にし、統合リボンUIへ一本化
    if (win?._ribbon) {
        win._ribbon.style.display = "none";
    }

    appRoot.addEventListener("click", async (e) => {
        const ribbonTabBtn = e.target.closest(".ss-ribbon-tab[data-ribbon-tab]");
        if (ribbonTabBtn) {
            switchRibbonTab(ribbonTabBtn.dataset.ribbonTab);
            return;
        }

        const fnBtn = e.target.closest("[data-fn-tpl]");
        if (fnBtn) {
            insertFormulaTemplate(fnBtn.dataset.fnTpl, fnBtn.textContent.trim());
            appRoot.querySelectorAll(".pulldown_menu").forEach(m => { m.style.display = "none"; });
            return;
        }

        const rowColOpBtn = e.target.closest("[data-rowcol-op]");
        if (rowColOpBtn) {
            await modifySheetRowCol(rowColOpBtn.dataset.rowcolOp);
            appRoot.querySelectorAll(".pulldown_menu").forEach(m => { m.style.display = "none"; });
            return;
        }

        const sortBtn = e.target.closest("[data-sort]");
        if (sortBtn) {
            sortSelectedRange(sortBtn.dataset.sort === "asc");
            appRoot.querySelectorAll(".pulldown_menu").forEach(m => { m.style.display = "none"; });
            return;
        }

        const pageSizeBtn = e.target.closest("[data-pagesize]");
        if (pageSizeBtn) {
            setPageSize(pageSizeBtn.dataset.pagesize);
            appRoot.querySelectorAll(".pulldown_menu").forEach(m => { m.style.display = "none"; });
            return;
        }

        const freezeBtn = e.target.closest("[data-freeze]");
        if (freezeBtn) {
            const mode = freezeBtn.dataset.freeze;
            if (mode === "active") freezeAtActiveCell();
            else if (mode === "top-row") setFreezePanes(1, 0);
            else if (mode === "first-col") setFreezePanes(0, 1);
            else if (mode === "unfreeze") setFreezePanes(0, 0);
            appRoot.querySelectorAll(".pulldown_menu").forEach(m => { m.style.display = "none"; });
            return;
        }

        const cfBtn = e.target.closest("[data-cf-preset]");
        if (cfBtn) {
            const preset = cfBtn.dataset.cfPreset;
            appRoot.querySelectorAll(".pulldown_menu").forEach(m => { m.style.display = "none"; });
            if (preset === "custom") {
                openConditionalFormatModal(null);
                return;
            }
            if (preset === "manage") {
                openConditionalFormatManager();
                return;
            }
            if (
                preset.startsWith("highlight-") ||
                ["top-n", "top-pct", "bottom-n", "bottom-pct", "above-avg", "below-avg"].includes(preset)
            ) {
                openConditionalFormatPresetDialog(preset);
                return;
            }

            const b = getSelectedRangeBounds();
            if (!b) return;

            if (preset === "clear-sheet") {
                sheets[activeSheetIndex].conditionalFormats = [];
            } else if (preset === "clear-selection") {
                sheets[activeSheetIndex].conditionalFormats = (sheets[activeSheetIndex].conditionalFormats || []).filter(
                    r => r.maxRow < b.minRow || r.minRow > b.maxRow || r.maxCol < b.minCol || r.minCol > b.maxCol
                );
            } else {
                const presetMap = {
                    "databar-grad-blue": { op: "databar", barColor: "#638ec6", solid: false },
                    "databar-solid-blue": { op: "databar", barColor: "#638ec6", solid: true },
                    "databar-grad-green": { op: "databar", barColor: "#63be7b", solid: false },
                    "databar-solid-green": { op: "databar", barColor: "#63be7b", solid: true },
                    "databar-grad-red": { op: "databar", barColor: "#ff555a", solid: false },
                    "databar-solid-red": { op: "databar", barColor: "#ff555a", solid: true },
                    "databar-grad-orange": { op: "databar", barColor: "#ffb628", solid: false },
                    "databar-solid-orange": { op: "databar", barColor: "#ffb628", solid: true },
                    "scale-gyr": { op: "colorscale", cLow: [248, 105, 107], cMid: [255, 235, 132], cHigh: [99, 190, 123] },
                    "scale-ryg": { op: "colorscale", cLow: [99, 190, 123], cMid: [255, 235, 132], cHigh: [248, 105, 107] },
                    "scale-gwr": { op: "colorscale", cLow: [248, 105, 107], cMid: [255, 255, 255], cHigh: [99, 190, 123] },
                    "scale-rwg": { op: "colorscale", cLow: [99, 190, 123], cMid: [255, 255, 255], cHigh: [248, 105, 107] },
                    "scale-bwr": { op: "colorscale", cLow: [248, 105, 107], cMid: [255, 255, 255], cHigh: [90, 138, 198] },
                    "scale-rwb": { op: "colorscale", cLow: [90, 138, 198], cMid: [255, 255, 255], cHigh: [248, 105, 107] },
                    "scale-wr": { op: "colorscale", twoColor: true, cLow: [248, 105, 107], cHigh: [255, 255, 255] },
                    "scale-rw": { op: "colorscale", twoColor: true, cLow: [255, 255, 255], cHigh: [248, 105, 107] },
                    "scale-gw": { op: "colorscale", twoColor: true, cLow: [255, 255, 255], cHigh: [99, 190, 123] },
                    "scale-wg": { op: "colorscale", twoColor: true, cLow: [99, 190, 123], cHigh: [255, 255, 255] },
                    "icon-arrows3": { op: "iconset", iconSet: "arrows3" },
                    "icon-traffic3": { op: "iconset", iconSet: "traffic3" },
                    "icon-signs3": { op: "iconset", iconSet: "signs3" },
                    "icon-stars3": { op: "iconset", iconSet: "stars3" }
                };
                if (presetMap[preset]) {
                    sheets[activeSheetIndex].conditionalFormats.unshift({ ...b, ...presetMap[preset], stopIfTrue: false });
                }
            }
            applyConditionalFormats();
            setDirtyState(true);
            debouncedSaveState();
            return;
        }

        const presetBtn = e.target.closest("[data-table-preset]");
        if (presetBtn) {
            convertRangeToStructuredTable(presetBtn.dataset.tablePreset);
            appRoot.querySelectorAll(".pulldown_menu").forEach(m => { m.style.display = "none"; });
            return;
        }

        const actionBtn = e.target.closest("[data-action]");
        if (actionBtn) {
            if (actionBtn.closest(".pulldown_menu")) {
                appRoot.querySelectorAll(".pulldown_menu").forEach(m => { m.style.display = "none"; });
            }
            await handleAppAction(actionBtn.dataset.action);
            return;
        }
        // 水平配置・数値表示形式
        const numFmtBtn = e.target.closest("[data-numfmt]");
        if (numFmtBtn) {
            const fmt = numFmtBtn.dataset.numfmt;
            const targets = tbody.querySelectorAll("td.selected");
            (targets.length ? targets : (activeCell ? [activeCell] : [])).forEach(c => {
                let raw = c.dataset.formula ? (c.dataset.rawValue ?? "") : (c.dataset.rawValue ?? getCellPureText(c));
                if (fmt === "general") {
                    // Excel準拠：日付セルを「標準」へ戻すと内部シリアル値をそのまま数値表示
                    if (c.dataset.valueType === "date" && !c.dataset.formula) {
                        const dt = resolveDateFromRawValue(raw);
                        if (dt) raw = String(dateToSerial(dt));
                    }
                    delete c.dataset.numFormat;
                    delete c.dataset.decimalPlaces;
                    delete c.dataset.valueType;
                    delete c.dataset.dateValue;
                } else {
                    c.dataset.numFormat = fmt;
                    if (isDateNumFormat(fmt) && !c.dataset.formula) {
                        const dt = resolveDateFromRawValue(raw);
                        if (dt) {
                            c.dataset.valueType = "date";
                            c.dataset.dateValue = String(dt.getTime());
                            raw = String(dateToSerial(dt));
                        }
                    }
                }
                setCellFormattedValue(c, raw);
            });
            if (activeCell) formulaBarInput.value = getCellEditableValue(activeCell);
            scheduleTextOverflowUpdate();
            updateToolbarState();
            setDirtyState(true);
            debouncedSaveState();
            return;
        }

        const decStepBtn = e.target.closest("[data-decimal-step]");
        if (decStepBtn) {
            const step = Number(decStepBtn.dataset.decimalStep);
            getTargetCells().forEach(c => {
                const raw = c.dataset.formula ? (c.dataset.rawValue ?? "") : (c.dataset.rawValue ?? getCellPureText(c));
                const num = parseFormattedNumber(raw);
                if (isNaN(num)) return;
                let curDec = c.dataset.decimalPlaces !== undefined ? Number(c.dataset.decimalPlaces) : null;
                if (curDec === null) {
                    const m = String(c.dataset.numFormat === "percent" ? num * 100 : num).match(/\.(\d+)/);
                    curDec = m ? m[1].length : 0;
                }
                c.dataset.decimalPlaces = String(Math.max(0, Math.min(10, curDec + step)));
                setCellFormattedValue(c, raw);
            });
            updateTextOverflowDisplay();
            setDirtyState(true);
            debouncedSaveState();
            return;
        }

        const alignBtn = e.target.closest("[data-align]");
        if (alignBtn) {
            const align = alignBtn.dataset.align;
            const targets = getTargetCells();
            if (!targets.length) return;
            // Excel準拠：選択セルすべてに同じ配置が明示設定済みなら解除して「標準」に戻す
            const allSameAlign = targets.every(c => c.style.textAlign === align);
            const nextAlign = allSameAlign ? "" : align;

            targets.forEach(c => {
                c.style.textAlign = nextAlign;
                if (c.tagName === "TD") {
                    const raw = c.dataset.rawValue ?? getCellPureText(c);
                    const displayText = formatDisplayByNumFmt(raw, c.dataset.numFormat, c);
                    setCellTextPreservingControls(c, displayText);
                    if (nextAlign === "") {
                        updateCellAutoAlignment(c, raw);
                    }
                }
            });
            updateToolbarState();
            updateTextOverflowDisplay();
            setDirtyState(true);
            debouncedSaveState();
            return;
        }

        // 枠線適用（線種・色・結合セルの端座標に対応）
        const borderBtn = e.target.closest("[data-border]");
        if (borderBtn) {
            const type = borderBtn.dataset.border;
            const bStyleSpec = appRoot.querySelector(".ss-border-style-select")?.value || "2px solid";
            const bColor = appRoot.querySelector(".ss-border-color-input")?.value || "#000000";
            const borderCss = `${bStyleSpec} ${bColor}`;
            const selected = Array.from(tbody.querySelectorAll("td.selected"));
            if (selected.length) {
                const covered = buildSelectedCoordsSet(selected);
                const gridlineSyncTargets = new Set(selected);
                selected.forEach(c => {
                    const r0 = +c.dataset.row;
                    const c0 = +c.dataset.col;
                    const r1 = r0 + (+c.getAttribute("rowspan") || 1) - 1;
                    const c1 = c0 + (+c.getAttribute("colspan") || 1) - 1;

                    let isTop = false, isBottom = false, isLeft = false, isRight = false;
                    for (let col = c0; col <= c1; col++) {
                        if (!covered.has(`${r0 - 1},${col}`)) isTop = true;
                        if (!covered.has(`${r1 + 1},${col}`)) isBottom = true;
                    }
                    for (let row = r0; row <= r1; row++) {
                        if (!covered.has(`${row},${c0 - 1}`)) isLeft = true;
                        if (!covered.has(`${row},${c1 + 1}`)) isRight = true;
                    }

                    if (type === "top" && isTop) c.style.borderTop = borderCss;
                    if (type === "bottom" && isBottom) c.style.borderBottom = borderCss;
                    if (type === "bottom-double" && isBottom) c.style.borderBottom = `4px double ${bColor}`;
                    if (type === "left" && isLeft) c.style.borderLeft = borderCss;
                    if (type === "right" && isRight) c.style.borderRight = borderCss;
                    if (type === "outer" || type === "outer-bold") {
                        const outerCss = type === "outer-bold" ? `4px solid ${bColor}` : borderCss;
                        if (isTop) c.style.borderTop = outerCss;
                        if (isBottom) c.style.borderBottom = outerCss;
                        if (isLeft) c.style.borderLeft = outerCss;
                        if (isRight) c.style.borderRight = outerCss;
                    }
                    if (type === "cell") {
                        c.style.borderTop = borderCss;
                        c.style.borderBottom = borderCss;
                        c.style.borderLeft = borderCss;
                        c.style.borderRight = borderCss;
                    }
                    if (type === "none") {
                        c.style.borderTop = "";
                        c.style.borderBottom = "";
                        c.style.borderLeft = "";
                        c.style.borderRight = "";
                        if (isTop && r0 > 1) {
                            for (let col = c0; col <= c1; col++) {
                                const above = getVisibleCell(r0 - 1, col);
                                if (above) { above.style.borderBottom = ""; gridlineSyncTargets.add(above); }
                            }
                        }
                        if (isBottom) {
                            for (let col = c0; col <= c1; col++) {
                                const below = getVisibleCell(r1 + 1, col);
                                if (below) { below.style.borderTop = ""; gridlineSyncTargets.add(below); }
                            }
                        }
                        if (isLeft && c0 > 0) {
                            for (let row = r0; row <= r1; row++) {
                                const left = getVisibleCell(row, c0 - 1);
                                if (left) { left.style.borderRight = ""; gridlineSyncTargets.add(left); }
                            }
                        }
                        if (isRight) {
                            for (let row = r0; row <= r1; row++) {
                                const right = getVisibleCell(row, c1 + 1);
                                if (right) { right.style.borderLeft = ""; gridlineSyncTargets.add(right); }
                            }
                        }
                    }
                });
                syncCellGridlinesForCells(gridlineSyncTargets);
                setDirtyState(true);
                debouncedSaveState();
            }
            appRoot.querySelectorAll(".pulldown_menu").forEach(m => { m.style.display = "none"; });
            return;
        }

    }, { signal });

    // 文字装飾・垂直配置・結合（テキストボックス編集時はテキストボックスへ優先適用）
    const getActiveTextbox = () => document.activeElement?.closest(".floating-textbox") || null;

    const getTargetCells = () => {
        const tb = getActiveTextbox();
        if (tb) return [tb];
        const sel = Array.from(tbody.querySelectorAll("td.selected")).filter(
            td => td.style.display !== "none" && td.closest("tr")?.style.display !== "none"
        );
        return sel.length ? sel : (activeCell ? [activeCell] : []);
    };

    const restoreCellFocusAfterToolbar = () => {
        if (getActiveTextbox()) return;
        if (activeCell && !isCellEditing(activeCell)) {
            activeCell.focus({ preventScroll: true });
        }
    };

    // 書式コピーボタンのダブルクリックで連続書式コピーモード（Excel準拠）
    appRoot.querySelector(".ss-format-painter-btn")?.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        if (!activeCell) return;
        formatPainterSnapshot = {
            persistent: true,
            styleObj: extractCellStyleObject(activeCell),
            numFormat: activeCell.dataset.numFormat || "",
            decimalPlaces: activeCell.dataset.decimalPlaces || "",
            indent: activeCell.dataset.indent || "",
            shrinkToFit: activeCell.dataset.shrinkToFit || "",
            textRotation: activeCell.dataset.textRotation || "",
            locked: activeCell.dataset.locked || "",
            formulaHidden: activeCell.dataset.formulaHidden || ""
        };
        appRoot.querySelector(".ss-format-painter-btn")?.classList.add("selected");
        statusBarState.stateText = "連続書式コピー中（Esc または書式ボタンで終了）";
        renderWindowStatusBar();
    }, { signal });

    appRoot.querySelector(".ss-font-family")?.addEventListener("change", (e) => {
        getTargetCells().forEach(c => {
            c.style.fontFamily = e.target.value;
            if (c.dataset?.shrinkToFit === "1") applyShrinkToFit(c);
        });
        scheduleTextOverflowUpdate();
        updateToolbarState();
        setDirtyState(true);
        debouncedSaveState();
        restoreCellFocusAfterToolbar();
    }, { signal });

    appRoot.querySelector(".ss-font-size").addEventListener("change", (e) => {
        const affectedRows = new Set();
        getTargetCells().forEach(c => {
            c.style.fontSize = e.target.value;
            delete c.dataset?.origFontSize;
            if (c.dataset?.shrinkToFit === "1") applyShrinkToFit(c);
            const tr = c.closest("tr");
            if (tr) affectedRows.add(tr);
        });
        affectedRows.forEach(tr => autoFitRow(tr));
        scheduleTextOverflowUpdate();
        setDirtyState(true);
        debouncedSaveState();
        restoreCellFocusAfterToolbar();
    }, { signal });

    appRoot.querySelector(".ss-toggle-bold").addEventListener("click", () => {
        const targets = getTargetCells();
        const getBaseWeight = (c) => (c.dataset?.cfApplied ? (c.dataset.cfOrigWeight || "") : c.style.fontWeight);
        const allBold = targets.length > 0 && targets.every(c => getBaseWeight(c) === "bold");
        const nextVal = allBold ? "" : "bold";
        targets.forEach(c => {
            c.style.fontWeight = nextVal;
            if (c.dataset?.cfApplied) c.dataset.cfOrigWeight = nextVal;
        });
        applyConditionalFormats();
        scheduleTextOverflowUpdate();
        updateToolbarState();
        setDirtyState(true);
        debouncedSaveState();
    }, { signal });

    appRoot.querySelector(".ss-toggle-italic").addEventListener("click", () => {
        const targets = getTargetCells();
        const getBaseItalic = (c) => (c.dataset?.cfApplied ? (c.dataset.cfOrigItalic || "") : c.style.fontStyle);
        const allItalic = targets.length > 0 && targets.every(c => getBaseItalic(c) === "italic");
        const nextVal = allItalic ? "" : "italic";
        targets.forEach(c => {
            c.style.fontStyle = nextVal;
            if (c.dataset?.cfApplied) c.dataset.cfOrigItalic = nextVal;
        });
        applyConditionalFormats();
        scheduleTextOverflowUpdate();
        updateToolbarState();
        setDirtyState(true);
        debouncedSaveState();
    }, { signal });

    const toggleTextDecorationToken = (token) => {
        const targets = getTargetCells();
        const getBaseDeco = (c) => (c.dataset?.cfApplied ? (c.dataset.cfOrigDeco || "") : (c.style.textDecoration || ""));
        const allHave = targets.length > 0 && targets.every(c => getBaseDeco(c).includes(token));
        targets.forEach(c => {
            const parts = new Set(getBaseDeco(c).split(/\s+/).filter(t => t === "underline" || t === "line-through"));
            if (allHave) parts.delete(token);
            else parts.add(token);
            const nextVal = Array.from(parts).join(" ");
            c.style.textDecoration = nextVal;
            if (c.dataset?.cfApplied) c.dataset.cfOrigDeco = nextVal;
        });
        applyConditionalFormats();
        updateToolbarState();
        setDirtyState(true);
        debouncedSaveState();
    };

    appRoot.querySelector(".ss-toggle-underline").addEventListener("click", () => {
        toggleTextDecorationToken("underline");
    }, { signal });

    appRoot.querySelector(".ss-toggle-strike")?.addEventListener("click", () => {
        toggleTextDecorationToken("line-through");
    }, { signal });

    appRoot.querySelector(".ss-toggle-vertical")?.addEventListener("click", () => {
        const targets = getTargetCells();
        const allVertical = targets.length > 0 && targets.every(c => c.style.writingMode === "vertical-rl");
        const affectedRows = new Set();
        targets.forEach(c => {
            if (allVertical) {
                c.style.writingMode = "";
                c.style.textOrientation = "";
            } else {
                c.style.writingMode = "vertical-rl";
                c.style.textOrientation = "upright";
                const tr = c.closest("tr");
                if (tr && (!tr.style.height || parseInt(tr.style.height, 10) < 90)) {
                    tr.style.height = "90px";
                }
            }
            const tr = c.closest("tr");
            if (tr) affectedRows.add(tr);
        });
        if (allVertical) affectedRows.forEach(tr => autoFitRow(tr));
        else if (freezeRows > 0) applyFreezePanes();
        scheduleTextOverflowUpdate();
        updateToolbarState();
        setDirtyState(true);
        debouncedSaveState();
    }, { signal });

    appRoot.querySelector(".ss-toggle-textshadow").addEventListener("click", () => {
        const targets = getTargetCells();
        const allShadow = targets.length > 0 && targets.every(c => c.style.textShadow === "black 3px 3px");
        targets.forEach(c => { c.style.textShadow = allShadow ? "" : "black 3px 3px"; });
        updateToolbarState();
        setDirtyState(true);
        debouncedSaveState();
    }, { signal });

    appRoot.querySelector(".ss-valign-top").addEventListener("click", () => {
        getTargetCells().forEach(c => { c.style.verticalAlign = c.style.verticalAlign === "top" ? "" : "top"; });
        scheduleTextOverflowUpdate();
        updateToolbarState();
        setDirtyState(true);
        debouncedSaveState();
    }, { signal });
    appRoot.querySelector(".ss-valign-middle").addEventListener("click", () => {
        getTargetCells().forEach(c => { c.style.verticalAlign = c.style.verticalAlign === "middle" ? "" : "middle"; });
        scheduleTextOverflowUpdate();
        updateToolbarState();
        setDirtyState(true);
        debouncedSaveState();
    }, { signal });
    appRoot.querySelector(".ss-valign-bottom").addEventListener("click", () => {
        getTargetCells().forEach(c => { c.style.verticalAlign = c.style.verticalAlign === "bottom" ? "" : "bottom"; });
        scheduleTextOverflowUpdate();
        updateToolbarState();
        setDirtyState(true);
        debouncedSaveState();
    }, { signal });

    appRoot.querySelector(".ss-toggle-wrap").addEventListener("click", () => {
        const targets = getTargetCells();
        const allWrapped = targets.length > 0 && targets.every(c => c.style.whiteSpace === "pre-wrap");
        const affectedRows = new Set();
        targets.forEach(c => {
            if (allWrapped) {
                c.style.whiteSpace = "";
                c.style.wordBreak = "";
            } else {
                c.style.whiteSpace = "pre-wrap";
                c.style.wordBreak = "break-all";
                if (c.dataset?.shrinkToFit === "1") {
                    delete c.dataset.shrinkToFit;
                    applyShrinkToFit(c);
                }
            }
            const tr = c.closest("tr");
            if (tr) affectedRows.add(tr);
        });
        affectedRows.forEach(tr => autoFitRow(tr));
        updateTextOverflowDisplay();
        updateToolbarState();
        setDirtyState(true);
        debouncedSaveState();
    }, { signal });

    appRoot.querySelector(".ss-merge-cells").addEventListener("click", mergeSelectedCells, { signal });
    appRoot.querySelector(".ss-unmerge-cells").addEventListener("click", unmergeSelectedCells, { signal });

    // カラーパレット
    const applyManualTextColor = (colorVal) => {
        getTargetCells().forEach(c => {
            c.style.color = colorVal;
            if (c.dataset.cfApplied) c.dataset.cfOrigColor = colorVal;
        });
        applyConditionalFormats();
    };

    const applyManualCellColor = (colorVal) => {
        const targets = getTargetCells();
        targets.forEach(c => {
            c.style.backgroundColor = colorVal;
            if (c.dataset.cfApplied) c.dataset.cfOrigBg = colorVal;
        });
        syncCellGridlinesForCells(targets);
        applyConditionalFormats();
    };

    appRoot.querySelectorAll(".ss-text-color-palette .color-swatch").forEach(sw => {
        sw.addEventListener("click", () => {
            const color = sw.dataset.color;
            applyManualTextColor(color === "none" ? "" : color);
            appRoot.querySelectorAll(".pulldown_menu").forEach(m => { m.style.display = "none"; });
            setDirtyState(true);
            debouncedSaveState();
        }, { signal });
    });

    const textColorCustom = appRoot.querySelector(".ss-text-color-custom");
    textColorCustom.addEventListener("input", (e) => {
        applyManualTextColor(e.target.value);
        setDirtyState(true);
    }, { signal });
    textColorCustom.addEventListener("change", () => debouncedSaveState(), { signal });

    appRoot.querySelectorAll(".ss-cell-color-palette .color-swatch").forEach(sw => {
        sw.addEventListener("click", () => {
            const color = sw.dataset.color;
            applyManualCellColor(color === "none" ? "" : color);
            appRoot.querySelectorAll(".pulldown_menu").forEach(m => { m.style.display = "none"; });
            setDirtyState(true);
            debouncedSaveState();
        }, { signal });
    });
    const cellColorCustom = appRoot.querySelector(".ss-cell-color-custom");
    cellColorCustom.addEventListener("input", (e) => {
        applyManualCellColor(e.target.value);
        setDirtyState(true);
    }, { signal });
    cellColorCustom.addEventListener("change", () => debouncedSaveState(), { signal });

    // ボタン押し込み（.pressed）のドラッグアウト解除・復元
    let currentPressedButton = null;
    appRoot.addEventListener("mousedown", (e) => {
        const btn = e.target.closest(".button");
        if (btn) {
            if (["revert-formula", "commit-formula", "auto-sum"].includes(btn.dataset.action)) {
                e.preventDefault();
            }
            btn.classList.add("pressed");
            currentPressedButton = btn;
        }
    }, { signal });

    document.addEventListener("mouseup", () => {
        if (currentPressedButton) {
            currentPressedButton.classList.remove("pressed");
            currentPressedButton = null;
        }
    }, { signal });

    document.addEventListener("mousemove", (e) => {
        if (!currentPressedButton) return;
        const rect = currentPressedButton.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
            currentPressedButton.classList.remove("pressed");
        } else if (e.buttons) {
            currentPressedButton.classList.add("pressed");
        }
    }, { signal });

    // プルダウンメニュー開閉
    appRoot.querySelectorAll(".pulldown_btn").forEach(btn => {
        btn.addEventListener("mousedown", (e) => {
            e.stopPropagation();
            const menu = btn.closest(".pulldown_menu_parent")?.querySelector(".pulldown_menu");
            const wasOpen = menu && menu.style.display === "block";
            appRoot.querySelectorAll(".pulldown_menu").forEach(m => { m.style.display = "none"; });
            if (menu && !wasOpen) {
                menu.style.display = "block";
            }
        }, { signal });
    });

    appRoot.addEventListener("mousedown", (e) => {
        if (!e.target.closest(".pulldown_btn") && !e.target.closest(".pulldown_menu")) {
            appRoot.querySelectorAll(".pulldown_menu").forEach(m => { m.style.display = "none"; });
        }
    }, { signal });

    // =========================================================
    // テーブルセル操作（選択・範囲移動・クリック・ダブルクリック・キー入力）
    // =========================================================
    let isRowSelecting = false, rowSelectionStart = null, lastRowSelectHover = null;
    let isColSelecting = false, colSelectionStart = null, lastColSelectHover = null;
    let isRangeMoving = false;
    let moveSourceBounds = null;
    let moveGrabOffset = { row: 0, col: 0 };
    let moveTargetTopLeft = null;

    let dragAutoScrollRaf = null;
    let dragPointerState = { x: 0, y: 0, ctrlKey: false };

    function stopDragAutoScroll() {
        if (dragAutoScrollRaf !== null) {
            cancelAnimationFrame(dragAutoScrollRaf);
            dragAutoScrollRaf = null;
        }
    }

    function stepDragAutoScroll() {
        if (!isRangeMoving && !isSelecting) {
            dragAutoScrollRaf = null;
            return;
        }
        const rect = container.getBoundingClientRect();
        const edge = 36;
        const maxSpeed = 22;
        let dx = 0;
        let dy = 0;

        if (dragPointerState.x < rect.left + edge) {
            dx = -Math.ceil(((rect.left + edge - dragPointerState.x) / edge) * maxSpeed);
        } else if (dragPointerState.x > rect.right - edge) {
            dx = Math.ceil(((dragPointerState.x - (rect.right - edge)) / edge) * maxSpeed);
        }

        if (dragPointerState.y < rect.top + edge) {
            dy = -Math.ceil(((rect.top + edge - dragPointerState.y) / edge) * maxSpeed);
        } else if (dragPointerState.y > rect.bottom - edge) {
            dy = Math.ceil(((dragPointerState.y - (rect.bottom - edge)) / edge) * maxSpeed);
        }

        if (dx === 0 && dy === 0) {
            dragAutoScrollRaf = null;
            return;
        }

        const prevLeft = container.scrollLeft;
        const prevTop = container.scrollTop;
        container.scrollLeft = Math.max(0, prevLeft + dx);
        container.scrollTop = Math.max(0, prevTop + dy);

        if (container.scrollLeft !== prevLeft || container.scrollTop !== prevTop) {
            const clampedX = Math.min(rect.right - 6, Math.max(rect.left + 6, dragPointerState.x));
            const clampedY = Math.min(rect.bottom - 6, Math.max(rect.top + 6, dragPointerState.y));
            const coord = resolveGridCoordFromClientPoint(clampedX, clampedY);
            if (coord) {
                if (isRangeMoving && moveSourceBounds) {
                    const destRow = Math.max(1, coord.row - moveGrabOffset.row);
                    const destCol = Math.max(0, coord.col - moveGrabOffset.col);
                    moveTargetTopLeft = { row: destRow, col: destCol };
                    const h = moveSourceBounds.maxRow - moveSourceBounds.minRow + 1;
                    const w = moveSourceBounds.maxCol - moveSourceBounds.minCol + 1;
                    const destBounds = {
                        minRow: destRow,
                        maxRow: destRow + h - 1,
                        minCol: destCol,
                        maxCol: destCol + w - 1
                    };
                    const isInvalid = hasMergeConflictOnDestination(
                        destBounds,
                        dragPointerState.ctrlKey ? null : moveSourceBounds
                    );
                    document.body.style.cursor = isInvalid ? "not-allowed" : "move";
                    showMoveTargetPreview(destBounds, isInvalid);
                } else if (isSelecting) {
                    selectionEnd = coord;
                    updateSelection();
                }
            }
        }

        dragAutoScrollRaf = requestAnimationFrame(stepDragAutoScroll);
    }

    function updateDragAutoScroll(e) {
        dragPointerState.x = e.clientX;
        dragPointerState.y = e.clientY;
        dragPointerState.ctrlKey = Boolean(e.ctrlKey || e.metaKey);
        if (dragAutoScrollRaf === null) {
            dragAutoScrollRaf = requestAnimationFrame(stepDragAutoScroll);
        }
    }

    function resolveCellFromPoint(e) {
        const rawCell = e.target?.closest?.("td");
        if (!rawCell || !tbody.contains(rawCell)) return null;
        if (rawCell.classList.contains("ss-text-overflow")) {
            const rect = rawCell.getBoundingClientRect();
            if (e.clientX > rect.right || e.clientX < rect.left || e.clientY > rect.bottom || e.clientY < rect.top) {
                const prevPointerEvents = rawCell.style.pointerEvents;
                rawCell.style.pointerEvents = "none";
                const underneath = document.elementFromPoint(e.clientX, e.clientY)?.closest("td");
                rawCell.style.pointerEvents = prevPointerEvents;
                if (underneath && tbody.contains(underneath)) {
                    return underneath;
                }
            }
        }
        return rawCell;
    }

    function isPointerOnSelectionEdge(e, cell) {
        if (!cell || isCellEditing(cell)) return false;
        if (e.target.closest(".fill-handle")) return false;
        const rect = cell.getBoundingClientRect();
        const edgeThreshold = 5;

        if (cell.classList.contains("selected")) {
            const nearTop = cell.classList.contains("sel-edge-top") && (e.clientY - rect.top <= edgeThreshold);
            const nearBottom = cell.classList.contains("sel-edge-bottom") && (rect.bottom - e.clientY <= edgeThreshold);
            const nearLeft = cell.classList.contains("sel-edge-left") && (e.clientX - rect.left <= edgeThreshold);
            const nearRight = cell.classList.contains("sel-edge-right") && (rect.right - e.clientX <= edgeThreshold);
            return nearTop || nearBottom || nearLeft || nearRight;
        }

        // Ctrl押下中に未選択セルをクリックした場合は複数選択を優先し、境界はみ出しでの誤ドラッグを防止
        if (e.ctrlKey || e.metaKey) return false;

        // border-collapse により境界線の下半分が直下の行へはみ出す場合の補完
        const r = parseInt(cell.dataset.row, 10);
        const c = parseInt(cell.dataset.col, 10);
        if (r > 1 && e.clientY - rect.top <= 3) {
            const above = getVisibleCell(r - 1, c);
            if (above && above.classList.contains("selected") && above.classList.contains("sel-edge-bottom")) {
                return true;
            }
        }
        if (c > 0 && e.clientX - rect.left <= 3) {
            const left = getVisibleCell(r, c - 1);
            if (left && left.classList.contains("selected") && left.classList.contains("sel-edge-right")) {
                return true;
            }
        }
        return false;
    }

    // =========================================================
    // セル範囲移動・複製・参照追従（range-move.js）
    // =========================================================
    const {
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
    } = createRangeMoveModule({
        spreadsheetContent,
        theadRow,
        colgroup,
        tbody,
        formulaBarInput,
        getActiveCell: () => activeCell,
        getSheets: () => sheets,
        getActiveSheetIndex: () => activeSheetIndex,
        isCurrentSheetProtected: () => isCurrentSheetProtected(),
        isCellLockedForEdit: (cell) => isCellLockedForEdit(cell),
        getCell,
        getVisibleCell,
        getRow,
        getColumnWidth,
        extractCellStyleObject: (cell) => extractCellStyleObject(cell),
        applyCellStyleData: (cell, styleData) => applyCellStyleData(cell, styleData),
        evaluateFormula: (...args) => evaluateFormula(...args),
        adjustFormula: (f, dr, dc) => adjustFormula(f, dr, dc),
        clearSpillCellsFromAnchor: (r, c) => clearSpillCellsFromAnchor(r, c),
        setCellFormattedValue: (cell, val) => setCellFormattedValue(cell, val),
        syncCellAnnotationMark: (cell) => syncCellAnnotationMark(cell),
        applyShrinkToFit: (cell) => applyShrinkToFit(cell),
        clearSelection: () => clearSelection(),
        setActiveCell: (cell, shouldFocus) => setActiveCell(cell, shouldFocus),
        getFloatingObjectsInBounds: (bounds) => getFloatingObjectsInBounds(bounds),
        getRangeLocalRect: (bounds) => getRangeLocalRect(bounds),
        snapshotFloatingObject: (box, rect) => snapshotFloatingObject(box, rect),
        spawnFloatingObjectFromSnapshot: (snap, rect, dr, dc) => spawnFloatingObjectFromSnapshot(snap, rect, dr, dc),
        renderChartBoxSVG: (box) => renderChartBoxSVG(box),
        getSheetTables: (sIdx) => getSheetTables(sIdx),
        applyStructuredTableVisuals: (tbl) => applyStructuredTableVisuals(tbl),
        shiftAutoFiltersForMove: (srcBounds, dr, dc) => shiftAutoFiltersForMove(srcBounds, dr, dc),
        shiftSlicersForMove: (srcBounds, dr, dc) => shiftSlicersForMove(srcBounds, dr, dc),
        hasAutoFilters: () => hasAutoFilters(),
        applyAutoFilterRows: () => applyAutoFilterRows(),
        updateAllFormulas: () => updateAllFormulas(),
        applyConditionalFormats: () => applyConditionalFormats(),
        syncCellGridlinesForBounds: (bounds) => syncCellGridlinesForBounds(bounds),
        refreshVisibleFloatingObjects: () => refreshVisibleFloatingObjects(),
        updateSelectedCellsDisplay: () => updateSelectedCellsDisplay(),
        updateFillHandle: () => updateFillHandle(),
        showAlert: (...args) => showAlert(...args),
        setDirtyState: (flag) => setDirtyState(flag),
        debouncedSaveState: (delay) => debouncedSaveState(delay)
    });

    table.addEventListener("mousedown", (e) => {
        if (e.target.closest(".floating-textbox")) return;

        // 全選択コーナー
        if (e.target.closest(".ss-corner")) {
            e.preventDefault();
            flushPendingEdits();
            const allCells = tbody.querySelectorAll("td");
            allCells.forEach(c => {
                if (c.style.display !== "none" && c.closest("tr")?.style.display !== "none") {
                    c.classList.add("selected");
                }
            });
            setActiveCell(getVisibleCell(1, 0), true);
            updateSelectedCellsDisplay();
            updateFillHandle();
            return;
        }

        // 行ヘッダー選択（右クリック時は既存の複数選択を維持 / Shift・Ctrl対応）
        const rowHeader = e.target.closest("th.row_number");
        if (rowHeader) {
            const clickedRow = parseInt(rowHeader.textContent.trim(), 10);
            if (e.button === 2) {
                const curWholeRows = getSelectedWholeRows();
                if (!curWholeRows.includes(clickedRow)) {
                    clearSelection();
                    for (let c = 0; c < currentColumns; c++) {
                        const vis = getVisibleCell(clickedRow, c);
                        if (vis && vis.style.display !== "none" && !vis.classList.contains("ss-col-hidden")) {
                            vis.classList.add("selected");
                        }
                    }
                    setActiveCell(getVisibleCell(clickedRow, 0), true);
                    updateSelectedCellsDisplay();
                    updateFillHandle();
                }
                return;
            }
            if (e.button !== 0) return;
            e.preventDefault();
            flushPendingEdits();

            const selectRowCells = (r) => {
                for (let c = 0; c < currentColumns; c++) {
                    const vis = getVisibleCell(r, c);
                    if (vis && vis.style.display !== "none" && !vis.classList.contains("ss-col-hidden")) {
                        vis.classList.add("selected");
                    }
                }
            };

            if (e.shiftKey && rowSelectionStart != null) {
                clearSelection();
                const rMin = Math.min(rowSelectionStart, clickedRow);
                const rMax = Math.max(rowSelectionStart, clickedRow);
                for (let r = rMin; r <= rMax; r++) selectRowCells(r);
                setActiveCell(getVisibleCell(rowSelectionStart, 0), true);
            } else if (e.ctrlKey || e.metaKey) {
                rowSelectionStart = clickedRow;
                selectRowCells(clickedRow);
                setActiveCell(getVisibleCell(clickedRow, 0), true);
            } else {
                isRowSelecting = true;
                rowSelectionStart = clickedRow;
                clearSelection();
                selectRowCells(clickedRow);
                setActiveCell(getVisibleCell(clickedRow, 0), true);
            }
            updateSelectedCellsDisplay();
            updateFillHandle();
            return;
        }

        // 列ヘッダー選択（右クリック時は既存の複数選択を維持 / Shift・Ctrl対応）
        const colHeader = e.target.closest("th.col_number");
        if (colHeader) {
            const clickedCol = columnLettersToIndex(colHeader.textContent.trim());
            if (e.button === 2) {
                const curWholeCols = getSelectedWholeColumns();
                if (!curWholeCols.includes(clickedCol)) {
                    clearSelection();
                    for (let r = 1; r < rowCount; r++) {
                        const vis = getVisibleCell(r, clickedCol);
                        if (vis && vis.style.display !== "none" && !vis.classList.contains("ss-col-hidden")) {
                            vis.classList.add("selected");
                        }
                    }
                    setActiveCell(getVisibleCell(1, clickedCol), true);
                    updateSelectedCellsDisplay();
                    updateFillHandle();
                }
                return;
            }
            if (e.button !== 0) return;
            e.preventDefault();
            flushPendingEdits();

            const selectColCells = (c) => {
                for (let r = 1; r < rowCount; r++) {
                    const vis = getVisibleCell(r, c);
                    if (vis && vis.style.display !== "none" && !vis.classList.contains("ss-col-hidden")) {
                        vis.classList.add("selected");
                    }
                }
            };

            if (e.shiftKey && colSelectionStart != null) {
                clearSelection();
                const cMin = Math.min(colSelectionStart, clickedCol);
                const cMax = Math.max(colSelectionStart, clickedCol);
                for (let c = cMin; c <= cMax; c++) selectColCells(c);
                setActiveCell(getVisibleCell(1, colSelectionStart), true);
            } else if (e.ctrlKey || e.metaKey) {
                colSelectionStart = clickedCol;
                selectColCells(clickedCol);
                setActiveCell(getVisibleCell(1, clickedCol), true);
            } else {
                isColSelecting = true;
                colSelectionStart = clickedCol;
                clearSelection();
                selectColCells(clickedCol);
                setActiveCell(getVisibleCell(1, clickedCol), true);
            }
            updateSelectedCellsDisplay();
            updateFillHandle();
            return;
        }

        // セル選択・範囲移動
        const cell = resolveCellFromPoint(e);
        if (!cell || !tbody.contains(cell)) return;
        if (isCellEditing(cell)) return;
        if (e.button !== 0) return;
        hideAutoFillOptions();

        // 選択範囲の外周エッジを掴んだ場合は範囲移動を開始
        if (!isInFormulaEdit() && isPointerOnSelectionEdge(e, cell)) {
            const bounds = getSelectedRangeBounds();
            if (bounds) {
                const ptCoord = resolveGridCoordFromClientPoint(e.clientX, e.clientY) || {
                    row: parseInt(cell.dataset.row, 10),
                    col: parseInt(cell.dataset.col, 10)
                };
                const grabRow = Math.min(bounds.maxRow, Math.max(bounds.minRow, ptCoord.row));
                const grabCol = Math.min(bounds.maxCol, Math.max(bounds.minCol, ptCoord.col));
                isRangeMoving = true;
                moveSourceBounds = bounds;
                moveGrabOffset = {
                    row: grabRow - bounds.minRow,
                    col: grabCol - bounds.minCol
                };
                moveTargetTopLeft = { row: bounds.minRow, col: bounds.minCol };
                showMoveTargetPreview(bounds, false);
                e.preventDefault();
                return;
            }
        }

        // 数式編集中なら結合セル上でも1セル単位の座標でリアルタイム参照選択を開始
        if (isInFormulaEdit()) {
            e.preventDefault();
            e.stopPropagation();
            const exactCoord = hitTestGridCoord(e.clientX, e.clientY);
            const clickedTd = getCell(exactCoord.row, exactCoord.col);
            if (clickedTd === activeCell && activeCell) return;
            isSelecting = true;
            selectionStart = { ...exactCoord };
            selectionEnd = { ...exactCoord };
            updateSelection();
            return;
        }

        const curFocused = document.activeElement;
        if (curFocused && curFocused.closest(".floating-textbox")) {
            curFocused.blur();
        }
        if (curFocused === formulaBarInput && activeCell) {
            commitCellValue(activeCell, formulaBarInput.value);
            formulaBarInput.blur();
        }
        if (isCellEditing() && editingCell) {
            commitCellValue(editingCell, cellEditor.value);
        }

        const clickedPos = {
            row: parseInt(cell.dataset.row, 10),
            col: parseInt(cell.dataset.col, 10)
        };

        if (e.shiftKey && activeCell) {
            isSelecting = true;
            selectionStart = {
                row: parseInt(activeCell.dataset.row, 10),
                col: parseInt(activeCell.dataset.col, 10)
            };
            selectionEnd = clickedPos;
            updateSelection();
            updateFillHandle();
            e.preventDefault();
            return;
        }

        if ((e.ctrlKey || e.metaKey) && !isInFormulaEdit()) {
            if (extractHyperlinkTarget(cell) && !e.shiftKey) {
                e.preventDefault();
                void activateCellHyperlink(cell);
                return;
            }

            // Excel準拠：Ctrl+クリック / Ctrl+ドラッグで非連続の複数範囲を追加選択（既選択セルの単体クリックは選択解除）
            const currentSelected = Array.from(tbody.querySelectorAll("td.selected"));
            isCtrlMultiSelecting = true;
            multiSelectionBaseCells = new Set(currentSelected);
            ctrlDeselectCandidate = (cell.classList.contains("selected") && currentSelected.length > 1)
                ? cell
                : null;

            isSelecting = true;
            selectionStart = clickedPos;
            selectionEnd = { ...selectionStart };
            setActiveCell(cell, true);
            updateSelection();
            updateFillHandle();
            removeMergedCellsHighlight();
            e.preventDefault();
            return;
        }

        isCtrlMultiSelecting = false;
        multiSelectionBaseCells = null;
        ctrlDeselectCandidate = null;
        isSelecting = true;
        clearSelection();
        selectionStart = clickedPos;
        selectionEnd = { ...selectionStart };
        setActiveCell(cell, true);
        updateSelection();
        updateFillHandle();
        removeMergedCellsHighlight();
        e.preventDefault();
    }, { signal });

    container.addEventListener("mousemove", (e) => {
        if (isRangeMoving && moveSourceBounds) {
            const hoverCoord = resolveGridCoordFromClientPoint(e.clientX, e.clientY);
            if (hoverCoord) {
                const destRow = Math.max(1, hoverCoord.row - moveGrabOffset.row);
                const destCol = Math.max(0, hoverCoord.col - moveGrabOffset.col);
                moveTargetTopLeft = { row: destRow, col: destCol };

                const h = moveSourceBounds.maxRow - moveSourceBounds.minRow + 1;
                const w = moveSourceBounds.maxCol - moveSourceBounds.minCol + 1;
                const destBounds = {
                    minRow: destRow,
                    maxRow: destRow + h - 1,
                    minCol: destCol,
                    maxCol: destCol + w - 1
                };
                const isInvalid = hasMergeConflictOnDestination(
                    destBounds,
                    (e.ctrlKey || e.metaKey) ? null : moveSourceBounds
                );
                document.body.style.cursor = isInvalid ? "not-allowed" : "move";
                showMoveTargetPreview(destBounds, isInvalid);
            }
            return;
        }

        if (!isScrollingNow && !isSelecting && !isRowSelecting && !isColSelecting && !isFillDragging()) {
            const hoverCell = resolveCellFromPoint(e);
            if (hoverCell && tbody.contains(hoverCell)) {
                const nextCursor = isPointerOnSelectionEdge(e, hoverCell) ? "move" : "";
                if (hoverCell.style.cursor !== nextCursor) {
                    hoverCell.style.cursor = nextCursor;
                }
            }
        }

        if (isSelecting) {
            if (isInFormulaEdit()) {
                const exactCoord = hitTestGridCoord(e.clientX, e.clientY);
                if (!selectionEnd || selectionEnd.row !== exactCoord.row || selectionEnd.col !== exactCoord.col) {
                    selectionEnd = exactCoord;
                    updateSelection();
                }
            } else {
                const cell = resolveCellFromPoint(e);
                if (cell && tbody.contains(cell)) {
                    const nextRow = parseInt(cell.dataset.row, 10);
                    const nextCol = parseInt(cell.dataset.col, 10);
                    if (!selectionEnd || selectionEnd.row !== nextRow || selectionEnd.col !== nextCol) {
                        selectionEnd = { row: nextRow, col: nextCol };
                        updateSelection();
                    }
                }
            }
        } else if (isRowSelecting) {
            const th = e.target.closest("th.row_number");
            if (th) {
                const cur = parseInt(th.textContent.trim(), 10);
                if (cur === lastRowSelectHover) return;
                lastRowSelectHover = cur;
                clearSelection();
                const rMin = Math.min(rowSelectionStart, cur);
                const rMax = Math.max(rowSelectionStart, cur);
                const nextSelected = [];
                for (let r = rMin; r <= rMax; r++) {
                    const tr = tbody.rows[r - 1];
                    if (!tr || tr.style.display === "none") continue;
                    for (let c = 1; c < tr.cells.length; c++) {
                        const td = tr.cells[c];
                        if (td.style.display !== "none" && !td.classList.contains("ss-col-hidden")) {
                            td.classList.add("selected");
                            nextSelected.push(td);
                        }
                    }
                }
                updateSelectedCellsDisplay(nextSelected);
            }
        } else if (isColSelecting) {
            const th = e.target.closest("th.col_number");
            if (th) {
                const cur = columnLettersToIndex(th.textContent.trim());
                if (cur === lastColSelectHover) return;
                lastColSelectHover = cur;
                clearSelection();
                const cMin = Math.min(colSelectionStart, cur);
                const cMax = Math.max(colSelectionStart, cur);
                const nextSelected = [];
                for (let r = 0; r < tbody.rows.length; r++) {
                    const tr = tbody.rows[r];
                    if (!tr || tr.style.display === "none") continue;
                    const cells = tr.cells;
                    for (let c = cMin; c <= cMax; c++) {
                        const td = cells[c + 1];
                        if (td && td.style.display !== "none" && !td.classList.contains("ss-col-hidden")) {
                            td.classList.add("selected");
                            nextSelected.push(td);
                        }
                    }
                }
                updateSelectedCellsDisplay(nextSelected);
            }
        }
    }, { signal });

    document.addEventListener("mousemove", (e) => {
        if (isRangeMoving || isSelecting) {
            updateDragAutoScroll(e);
        }
    }, { signal });

    document.addEventListener("mouseup", (e) => {
        stopDragAutoScroll();
        if (isRangeMoving) {
            document.body.style.cursor = "";
            clearMoveTargetPreview();
            if (moveSourceBounds && moveTargetTopLeft) {
                executeRangeMove(moveSourceBounds, moveTargetTopLeft, e.ctrlKey || e.metaKey);
            }
            isRangeMoving = false;
            moveSourceBounds = null;
            moveTargetTopLeft = null;
            return;
        }

        if (isSelecting) {
            isSelecting = false;
            if (
                isCtrlMultiSelecting &&
                ctrlDeselectCandidate &&
                selectionStart &&
                selectionEnd &&
                selectionStart.row === selectionEnd.row &&
                selectionStart.col === selectionEnd.col
            ) {
                ctrlDeselectCandidate.classList.remove("selected", "active-cell");
                const remaining = Array.from(tbody.querySelectorAll("td.selected"));
                if (activeCell === ctrlDeselectCandidate && remaining.length > 0) {
                    setActiveCell(remaining[remaining.length - 1], true);
                }
                updateSelectedCellsDisplay(remaining);
            }
            isCtrlMultiSelecting = false;
            multiSelectionBaseCells = null;
            ctrlDeselectCandidate = null;

            if (formatPainterSnapshot && !isInFormulaEdit()) {
                const targets = Array.from(tbody.querySelectorAll("td.selected"));
                const affectedRows = new Set();
                targets.forEach(td => {
                    applyCellStyleData(td, formatPainterSnapshot.styleObj);
                    if (formatPainterSnapshot.numFormat) td.dataset.numFormat = formatPainterSnapshot.numFormat;
                    else delete td.dataset.numFormat;
                    if (formatPainterSnapshot.decimalPlaces) td.dataset.decimalPlaces = formatPainterSnapshot.decimalPlaces;
                    else delete td.dataset.decimalPlaces;
                    if (formatPainterSnapshot.indent) td.dataset.indent = formatPainterSnapshot.indent;
                    else delete td.dataset.indent;
                    if (formatPainterSnapshot.shrinkToFit === "1") td.dataset.shrinkToFit = "1";
                    else {
                        delete td.dataset.shrinkToFit;
                        delete td.dataset.origFontSize;
                    }
                    if (formatPainterSnapshot.textRotation) td.dataset.textRotation = formatPainterSnapshot.textRotation;
                    else delete td.dataset.textRotation;
                    if (formatPainterSnapshot.locked === "0") td.dataset.locked = "0";
                    else delete td.dataset.locked;
                    if (formatPainterSnapshot.formulaHidden === "1") td.dataset.formulaHidden = "1";
                    else delete td.dataset.formulaHidden;

                    const raw = td.dataset.formula ? (td.dataset.rawValue ?? "") : (td.dataset.rawValue ?? getCellPureText(td));
                    setCellFormattedValue(td, raw);
                    if (formatPainterSnapshot.shrinkToFit === "1") applyShrinkToFit(td);
                    const tr = td.closest("tr");
                    if (tr && (td.style.whiteSpace === "pre-wrap" || td.style.fontSize)) affectedRows.add(tr);
                });
                affectedRows.forEach(tr => autoFitRow(tr));
                if (!formatPainterSnapshot.persistent) {
                    formatPainterSnapshot = null;
                    appRoot.querySelector(".ss-format-painter-btn")?.classList.remove("selected");
                    statusBarState.stateText = "書式を適用しました";
                }
                applyConditionalFormats();
                scheduleTextOverflowUpdate();
                updateToolbarState();
                renderWindowStatusBar();
                setDirtyState(true);
                debouncedSaveState();
            }
            if (selectionStart && selectionEnd && isInFormulaEdit()) {
                // ドラッグ中にリアルタイム反映済みのため、確定時はキャレットを参照末尾へ維持するだけ
                const targetInput = (document.activeElement === formulaBarInput)
                    ? formulaBarInput
                    : (isCellEditing() ? cellEditor : formulaBarInput);
                if (targetInput && lastPointRefRange) {
                    syncFormulaInputsAndCaret(targetInput.value, lastPointRefRange.end, lastPointRefRange.end, targetInput);
                    highlightCalculationRange(targetInput.value);
                }
            }
            updateFillHandle();
        }
        if (formatPainterSnapshot && !formatPainterSnapshot.persistent && !e.target.closest(".ss-format-painter-btn")) {
            formatPainterSnapshot = null;
            appRoot.querySelector(".ss-format-painter-btn")?.classList.remove("selected");
            statusBarState.stateText = "準備完了";
            renderWindowStatusBar();
        }
        isRowSelecting = false;
        isColSelecting = false;
        lastRowSelectHover = null;
        lastColSelectHover = null;
    }, { signal });

    table.addEventListener("selectstart", (e) => {
        if (e.target !== cellEditor && !e.target.closest('[contenteditable="true"]')) {
            e.preventDefault();
        }
    }, { signal });

    table.addEventListener("dblclick", (e) => {
        const cell = resolveCellFromPoint(e);
        if (cell && tbody.contains(cell)) {
            enterCellEditMode(cell, false, "dblclick", e);
            updateFillHandle();
        }
    }, { signal });

    function highlightMergedCells() {
        tbody.querySelectorAll("td").forEach(cell => {
            const rowSpan = parseInt(cell.getAttribute("rowspan") || "1", 10);
            const colSpan = parseInt(cell.getAttribute("colspan") || "1", 10);
            if (rowSpan > 1 || colSpan > 1 || (cell.dataset.mergeMinRow && cell.dataset.mergeMinCol)) {
                cell.classList.add("merge-highlight");
            }
        });
    }

    function removeMergedCellsHighlight() {
        tbody.querySelectorAll("td.merge-highlight").forEach(cell => {
            cell.classList.remove("merge-highlight");
        });
    }

    function commitValueToTargets(baseCell, targets, rawVal, applyToAll = false) {
        if (!baseCell) return false;
        const strVal = String(rawVal ?? "");
        const trimmed = strVal.trim().startsWith("=") ? strVal.trim() : strVal;
        if (!applyToAll || targets.length <= 1) {
            return commitCellValue(baseCell, trimmed);
        }
        const baseR = parseInt(baseCell.dataset.row, 10);
        const baseC = parseInt(baseCell.dataset.col, 10);
        let allOk = true;
        const changedCoords = [];
        const shrinkTargets = [];
        const autoFitRows = new Set();
        let anyFormulaChanged = false;

        for (let i = 0; i < targets.length; i++) {
            const cell = targets[i];
            const prevFormula = cell.dataset.formula || "";
            const valueToWrite = (cell === baseCell || !trimmed.startsWith("="))
                ? trimmed
                : adjustFormula(trimmed, parseInt(cell.dataset.row, 10) - baseR, parseInt(cell.dataset.col, 10) - baseC);

            if (!commitCellValue(cell, valueToWrite, { deferRecalc: true })) {
                allOk = false;
                continue;
            }
            const r = parseInt(cell.dataset.row, 10);
            const c = parseInt(cell.dataset.col, 10);
            changedCoords.push({ row: r, col: c });
            if (prevFormula !== (cell.dataset.formula || "")) {
                anyFormulaChanged = true;
            }
            if (cell.dataset.shrinkToFit === "1") shrinkTargets.push(cell);
            if (valueToWrite.includes("\n") || cell.style.whiteSpace === "pre-wrap") {
                const tr = cell.closest("tr");
                if (tr) autoFitRows.add(tr);
            }
        }

        clearCalculationRangeHighlights();
        if (changedCoords.length > 0) {
            recalculateCells(changedCoords, { formulaChanged: anyFormulaChanged });
            shrinkTargets.forEach(c => applyShrinkToFit(c));
            autoFitRows.forEach(tr => autoFitRow(tr));
            setDirtyState(true);
            debouncedSaveState();
        }
        return allOk;
    }

    let justEndedComposition = false;
    function isImeActive(e) {
        return (
            isComposing ||
            justEndedComposition ||
            Boolean(e?.isComposing) ||
            e?.key === "Process" ||
            e?.keyCode === 229
        );
    }

    // キーボードショートカット・IME直接入力対応
    document.addEventListener("compositionstart", (e) => {
        isComposing = true;
        justEndedComposition = false;
        if (!isAppFocused()) return;
        if (
            e.target === cellEditor ||
            e.target?.closest?.(".floating-textbox, .ss-find-win-body, .ss-find-dialog") ||
            document.activeElement === formulaBarInput
        ) return;
        if (activeCell && !isCellEditing()) {
            clearCopyAnimation();
            if (!enterCellEditMode(activeCell, false, "ime")) return;
            cellEditor.value = "";
            formulaBarInput.value = "";
            syncCellEditorLayout(activeCell);
        }
    }, { signal });

    document.addEventListener("compositionend", () => {
        isComposing = false;
        justEndedComposition = true;
        managedTimeout(() => {
            justEndedComposition = false;
        }, 0);
        if (isCellEditing()) {
            formulaBarInput.value = cellEditor.value;
        }
    }, { signal });

    // Excel準拠：Alt順次押しアクセスキー（例: Alt → O → A でオートフォーマット）
    let altKeySequence = "";
    let altSequenceTimer = null;
    let altKeyPressedAlone = false;

    const ALT_ACCESS_SEQUENCES = {
        oa: () => openAutoFormatDialog(),
        nt: () => openCreateTableDialog("blue")
    };

    // 全画面（Fullscreen API）中は Keyboard Lock API でブラウザ予約の Ctrl+T をアプリ側へロック（Chrome/Edge・HTTPS/localhost対応）
    function syncKeyboardLockForTableShortcut() {
        if (!navigator.keyboard?.lock) return;
        if (document.fullscreenElement) {
            navigator.keyboard.lock(["KeyT"]).catch(() => { });
        } else {
            navigator.keyboard.unlock?.();
        }
    }
    document.addEventListener("fullscreenchange", syncKeyboardLockForTableShortcut, { signal });
    syncKeyboardLockForTableShortcut();
    signal.addEventListener("abort", () => {
        navigator.keyboard?.unlock?.();
    }, { once: true });

    // Ctrl+T（PWA / Fullscreen+KeyboardLock時）、Ctrl+L（Excel公式・通常タブ対応）、Ctrl+Alt+T（全ブラウザ無競合）を最優先捕捉
    window.addEventListener("keydown", (e) => {
        if (!(e.ctrlKey || e.metaKey) || e.shiftKey) return;
        const code = e.code;
        const key = e.key.toLowerCase();
        const isCtrlT = !e.altKey && (code === "KeyT" || key === "t");
        const isCtrlL = !e.altKey && (code === "KeyL" || key === "l");
        const isCtrlAltT = e.altKey && (code === "KeyT" || key === "t");
        if (!isCtrlT && !isCtrlL && !isCtrlAltT) return;

        if (!isAppFocused() || isCellEditing() || document.activeElement === cellEditor || document.activeElement === formulaBarInput) return;
        if (e.target?.closest?.(".floating-textbox, .ss-find-win-body, .ss-find-dialog")) return;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        openCreateTableDialog("blue");
    }, { capture: true, signal });

    // Ctrl+G / F5（ジャンプダイアログ）：ブラウザのリロード・次を検索を確実に抑止して捕捉
    window.addEventListener("keydown", (e) => {
        const isF5 = !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && e.key === "F5";
        const isCtrlG = (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.code === "KeyG" || e.key.toLowerCase() === "g");
        if (!isF5 && !isCtrlG) return;
        if (!isAppFocused() || isCellEditing() || document.activeElement === cellEditor || document.activeElement === formulaBarInput) return;
        if (e.target?.closest?.(".floating-textbox, .ss-find-win-body, .ss-find-dialog")) return;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        openGoToDialog();
    }, { capture: true, signal });

    // Ctrl+E（フラッシュフィル）＆ Ctrl+Alt+V（形式を選択して貼り付け）：ブラウザ既定挙動を抑止して捕捉
    window.addEventListener("keydown", (e) => {
        if (!(e.ctrlKey || e.metaKey) || e.shiftKey) return;
        const isCtrlE = !e.altKey && (e.code === "KeyE" || e.key.toLowerCase() === "e");
        const isCtrlAltV = e.altKey && (e.code === "KeyV" || e.key.toLowerCase() === "v");
        if (!isCtrlE && !isCtrlAltV) return;
        if (!isAppFocused() || isCellEditing() || document.activeElement === cellEditor || document.activeElement === formulaBarInput) return;
        if (e.target?.closest?.(".floating-textbox, .ss-find-win-body, .ss-find-dialog")) return;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (isCtrlE) executeFlashFill();
        else openPasteSpecialDialog();
    }, { capture: true, signal });

    // Ctrl+S（上書き保存）：セル編集中でもブラウザ保存を抑止し、キーリピートによる多重保存競合を防止
    window.addEventListener("keydown", (e) => {
        if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
        if (e.code !== "KeyS" && e.key.toLowerCase() !== "s") return;
        if (!isAppFocused()) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (e.repeat) return;
        const curPath = getCurrentFilePath();
        if (curPath) void writeToFSPath(curPath);
        else promptSaveAsDialog(".nxs");
    }, { capture: true, signal });

    function resetAltSequence(restoreStatus = false) {
        altKeySequence = "";
        if (altSequenceTimer) {
            clearTimeout(altSequenceTimer);
            timers.delete(altSequenceTimer);
            altSequenceTimer = null;
        }
        if (restoreStatus && statusBarState.stateText.startsWith("アクセスキー:")) {
            statusBarState.stateText = "準備完了";
            renderWindowStatusBar();
        }
    }

    function armAltSequence(seq) {
        altKeySequence = seq;
        if (altSequenceTimer) {
            clearTimeout(altSequenceTimer);
            timers.delete(altSequenceTimer);
        }
        altSequenceTimer = managedTimeout(() => resetAltSequence(true), 2500);
        const displaySeq = seq === "_" ? "Alt" : `Alt → ${seq.toUpperCase().split("").join(" → ")}`;
        statusBarState.stateText = `アクセスキー: ${displaySeq} ...`;
        renderWindowStatusBar();
    }

    document.addEventListener("keyup", (e) => {
        if (e.key !== "Alt") return;
        if (!isAppFocused() || isCellEditing() || document.activeElement === formulaBarInput) {
            altKeyPressedAlone = false;
            return;
        }
        if (altKeyPressedAlone) {
            altKeyPressedAlone = false;
            e.preventDefault();
            if (altKeySequence) resetAltSequence(true);
            else armAltSequence("_");
        }
    }, { signal });

    document.addEventListener("mousedown", () => {
        if (altKeySequence) resetAltSequence(true);
    }, { signal });

    document.addEventListener("keydown", (e) => {
        if (!isAppFocused()) return;
        if (e.target.closest(".floating-textbox, .floating-slicer, .ss-find-win-body, .ss-find-dialog")) return;
        if (isCellEditing() || document.activeElement === cellEditor) return;

        // Alt単押し待機フラグ制御
        if (e.key === "Alt") {
            if (!e.repeat && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
                altKeyPressedAlone = true;
            }
            return;
        }
        altKeyPressedAlone = false;

        // Alt順次押しシーケンス（Alt→O→A / Alt+O→A）の処理
        if (document.activeElement !== formulaBarInput && !e.ctrlKey && !e.metaKey) {
            const lowerKey = e.key.length === 1 ? e.key.toLowerCase() : "";

            if (e.altKey && lowerKey && /^[a-z]$/.test(lowerKey)) {
                const hasPrefix = Object.keys(ALT_ACCESS_SEQUENCES).some(k => k.startsWith(lowerKey));
                if (hasPrefix) {
                    e.preventDefault();
                    e.stopPropagation();
                    armAltSequence(lowerKey);
                    return;
                }
            }

            if (altKeySequence) {
                if (e.key === "Escape") {
                    e.preventDefault();
                    resetAltSequence(true);
                    return;
                }
                if (lowerKey && /^[a-z]$/.test(lowerKey)) {
                    const nextSeq = (altKeySequence === "_" ? "" : altKeySequence) + lowerKey;
                    if (ALT_ACCESS_SEQUENCES[nextSeq]) {
                        e.preventDefault();
                        e.stopPropagation();
                        resetAltSequence(true);
                        ALT_ACCESS_SEQUENCES[nextSeq]();
                        return;
                    }
                    if (Object.keys(ALT_ACCESS_SEQUENCES).some(k => k.startsWith(nextSeq))) {
                        e.preventDefault();
                        e.stopPropagation();
                        armAltSequence(nextSeq);
                        return;
                    }
                }
                resetAltSequence(true);
            }
        }

        if ((e.key === "Process" || e.keyCode === 229) && activeCell && !isCellEditing() && document.activeElement !== formulaBarInput) {
            clearCopyAnimation();
            if (!enterCellEditMode(activeCell, false, "ime")) return;
            cellEditor.value = "";
            formulaBarInput.value = "";
            syncCellEditorLayout(activeCell);
            return;
        }
        if (isImeActive(e)) return;

        if (e.ctrlKey || e.metaKey) {
            if (e.key === "Enter" && activeCell) {
                e.preventDefault();
                const val = activeCell.dataset.formula || activeCell.dataset.rawValue || activeCell.textContent;
                commitValueToTargets(activeCell, getTargetCells(), val, true);
                activeCell.focus({ preventScroll: true });
                updateSelectedCellsDisplay();
                updateFillHandle();
                return;
            }
            const key = e.key.toLowerCase();
            if (key === "z" && !e.shiftKey) {
                e.preventDefault();
                void undo();
                return;
            }
            if (key === "y" || (key === "z" && e.shiftKey)) {
                e.preventDefault();
                void redo();
                return;
            }
            if (key === "f") {
                e.preventDefault();
                openFindReplaceDialog(false);
                return;
            }
            if (key === "h") {
                e.preventDefault();
                openFindReplaceDialog(true);
                return;
            }
            if (document.activeElement !== formulaBarInput) {
                if (key === "c") {
                    e.preventDefault();
                    copySelectedCells(false);
                    return;
                }
                if (key === "x") {
                    e.preventDefault();
                    copySelectedCells(true);
                    return;
                }
                if (key === "v") {
                    e.preventDefault();
                    void pasteClipboardData(e.shiftKey ? "values" : "all");
                    return;
                }
                if (key === "a") {
                    e.preventDefault();
                    const base = activeCell || getVisibleCell(1, 0);
                    if (!base) return;

                    const r0 = parseInt(base.dataset.row, 10);
                    const c0 = parseInt(base.dataset.col, 10);
                    const maxR = tbody.rows.length;
                    const maxC = currentColumns - 1;
                    const cur = getSelectedRangeBounds();
                    const sameBounds = (a, b) => Boolean(
                        a && b &&
                        a.minRow === b.minRow && a.maxRow === b.maxRow &&
                        a.minCol === b.minCol && a.maxCol === b.maxCol
                    );

                    // 1. 構造化テーブル内なら Excel 準拠の3段階選択（データ本体 → テーブル全体 → シート全体）
                    const activeTable = findTableAtCoord(r0, c0);
                    if (activeTable) {
                        const dataBodyBounds = {
                            minRow: activeTable.hasHeader ? Math.min(activeTable.maxRow, activeTable.minRow + 1) : activeTable.minRow,
                            maxRow: activeTable.hasTotalRow ? Math.max(activeTable.minRow, activeTable.maxRow - 1) : activeTable.maxRow,
                            minCol: activeTable.minCol,
                            maxCol: activeTable.maxCol
                        };
                        const fullTableBounds = {
                            minRow: activeTable.minRow,
                            maxRow: activeTable.maxRow,
                            minCol: activeTable.minCol,
                            maxCol: activeTable.maxCol
                        };

                        let nextTarget = null;
                        if (r0 >= dataBodyBounds.minRow && r0 <= dataBodyBounds.maxRow && !sameBounds(cur, dataBodyBounds) && !sameBounds(cur, fullTableBounds)) {
                            nextTarget = dataBodyBounds;
                        } else if (!sameBounds(cur, fullTableBounds)) {
                            nextTarget = fullTableBounds;
                        }

                        if (nextTarget) {
                            clearSelection();
                            selectionStart = { row: nextTarget.minRow, col: nextTarget.minCol };
                            selectionEnd = { row: nextTarget.maxRow, col: nextTarget.maxCol };
                            updateSelection();
                            setActiveCell(base, true);
                            updateSelectedCellsDisplay();
                            updateFillHandle();
                            return;
                        }
                    }

                    // 2. フィルター非表示行を含めて連続データ領域（CurrentRegion）を正確に検出
                    const isFilledAt = (r, c) => {
                        const td = peekCell(r, c);
                        if (!td) return false;
                        const vis = td.style.display === "none" ? getVisibleCell(r, c) : td;
                        return Boolean(vis && (vis.dataset.formula || (vis.dataset.rawValue ?? getCellPureText(vis)).trim() !== ""));
                    };

                    let seed = isFilledAt(r0, c0) ? { r: r0, c: c0 } : null;
                    if (!seed) {
                        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]]) {
                            const nr = r0 + dr, nc = c0 + dc;
                            if (nr >= 1 && nr <= maxR && nc >= 0 && nc <= maxC && isFilledAt(nr, nc)) {
                                seed = { r: nr, c: nc };
                                break;
                            }
                        }
                    }

                    let region = null;
                    if (seed) {
                        let minRow = seed.r, maxRow = seed.r, minCol = seed.c, maxCol = seed.c;
                        let expanded = true;
                        while (expanded) {
                            expanded = false;
                            if (minRow > 1) {
                                for (let c = Math.max(0, minCol - 1); c <= Math.min(maxC, maxCol + 1); c++) {
                                    if (isFilledAt(minRow - 1, c)) { minRow--; expanded = true; break; }
                                }
                            }
                            if (maxRow < maxR) {
                                for (let c = Math.max(0, minCol - 1); c <= Math.min(maxC, maxCol + 1); c++) {
                                    if (isFilledAt(maxRow + 1, c)) { maxRow++; expanded = true; break; }
                                }
                            }
                            if (minCol > 0) {
                                for (let r = Math.max(1, minRow - 1); r <= Math.min(maxR, maxRow + 1); r++) {
                                    if (isFilledAt(r, minCol - 1)) { minCol--; expanded = true; break; }
                                }
                            }
                            if (maxCol < maxC) {
                                for (let r = Math.max(1, minRow - 1); r <= Math.min(maxR, maxRow + 1); r++) {
                                    if (isFilledAt(r, maxCol + 1)) { maxCol++; expanded = true; break; }
                                }
                            }
                        }
                        region = expandBoundsForMergedCells({ minRow, maxRow, minCol, maxCol });
                    }

                    clearSelection();
                    if (region && !activeTable && !sameBounds(cur, region)) {
                        selectionStart = { row: region.minRow, col: region.minCol };
                        selectionEnd = { row: region.maxRow, col: region.maxCol };
                        updateSelection();
                        setActiveCell(base, true);
                    } else {
                        selectionStart = { row: 1, col: 0 };
                        selectionEnd = { row: maxR, col: maxC };
                        for (let r = 0; r < tbody.rows.length; r++) {
                            const tr = tbody.rows[r];
                            if (tr.style.display === "none") continue;
                            for (let c = 1; c < tr.cells.length; c++) {
                                const td = tr.cells[c];
                                if (td.style.display !== "none") td.classList.add("selected");
                            }
                        }
                        setActiveCell(base, true);
                    }
                    updateSelectedCellsDisplay();
                    updateFillHandle();
                    return;
                }
            }

            if (e.key === "Home" && activeCell) {
                e.preventDefault();
                navigateToCell(1, 0, e);
                return;
            }

            if (e.key === "End" && activeCell) {
                e.preventDefault();
                let maxDataR = 1, maxDataC = 0;
                tbody.querySelectorAll("td").forEach(td => {
                    if (td.dataset.formula || (td.dataset.rawValue ?? td.textContent).trim() !== "") {
                        maxDataR = Math.max(maxDataR, Number(td.dataset.row));
                        maxDataC = Math.max(maxDataC, Number(td.dataset.col));
                    }
                });
                navigateToCell(maxDataR, maxDataC, e);
                return;
            }

            if (
                (e.code === "Backquote" && !e.shiftKey) ||
                (e.shiftKey && (e.key === "@" || e.key === "`" || e.code === "BracketLeft"))
            ) {
                e.preventDefault();
                toggleShowFormulasMode();
                return;
            }

            if (e.shiftKey && key === "l") {
                e.preventDefault();
                toggleAutoFilter();
                return;
            }
            if ((key === "t" || key === "l") && !e.shiftKey && document.activeElement !== formulaBarInput) {
                e.preventDefault();
                openCreateTableDialog("blue");
                return;
            }
            if (key === "k" && !e.shiftKey && document.activeElement !== formulaBarInput) {
                e.preventDefault();
                openHyperlinkDialog();
                return;
            }
            if (key === "p" && !e.shiftKey) {
                e.preventDefault();
                printSpreadsheet();
                return;
            }
            if (document.activeElement !== formulaBarInput) {
                if (key === "b" && !e.shiftKey) {
                    e.preventDefault();
                    appRoot.querySelector(".ss-toggle-bold")?.click();
                    return;
                }
                if (key === "i" && !e.shiftKey) {
                    e.preventDefault();
                    appRoot.querySelector(".ss-toggle-italic")?.click();
                    return;
                }
                if (key === "u" && !e.shiftKey) {
                    e.preventDefault();
                    appRoot.querySelector(".ss-toggle-underline")?.click();
                    return;
                }
                if (e.key === "1" && !e.shiftKey) {
                    e.preventDefault();
                    openFormatCellsModal("number");
                    return;
                }
                if (e.key === "5" && !e.shiftKey) {
                    e.preventDefault();
                    appRoot.querySelector(".ss-toggle-strike")?.click();
                    return;
                }
                if (e.shiftKey && (e.code === "Digit1" || e.code === "Digit3" || e.code === "Digit4" || e.code === "Digit5" || e.code === "Backquote")) {
                    e.preventDefault();
                    const fmtMap = {
                        Backquote: "general",
                        Digit1: "comma",
                        Digit3: "date-jp",
                        Digit4: "currency",
                        Digit5: "percent"
                    };
                    appRoot.querySelector(`[data-numfmt="${fmtMap[e.code]}"]`)?.click();
                    return;
                }
                if (e.key === " " && !e.shiftKey && activeCell) {
                    // Ctrl + Space: 列全体選択
                    e.preventDefault();
                    const b = getSelectedRangeBounds();
                    const cStart = b ? b.minCol : parseInt(activeCell.dataset.col, 10);
                    const cEnd = b ? b.maxCol : cStart;
                    clearSelection();
                    selectionStart = { row: 1, col: cStart };
                    selectionEnd = { row: tbody.rows.length, col: cEnd };
                    updateSelection();
                    setActiveCell(activeCell, true);
                    updateFillHandle();
                    return;
                }
                if (e.key === "PageUp") {
                    e.preventDefault();
                    void switchToSheet(activeSheetIndex - 1);
                    return;
                }
                if (e.key === "PageDown") {
                    e.preventDefault();
                    void switchToSheet(activeSheetIndex + 1);
                    return;
                }
            }
            return;
        }


        if (document.activeElement === formulaBarInput) return;

        // Alt + ↓ : データ入力規則のドロップダウンを展開
        if (e.altKey && e.key === "ArrowDown" && activeCell?.dataset.dropdownList) {
            e.preventDefault();
            openCellDropdownList(activeCell);
            return;
        }

        // Alt + ; : 可視セルのみ選択（Excel公式ショートカット・Shift押下時や+キーとの誤認を防止）
        if (e.altKey && !e.shiftKey && e.key === ";") {
            e.preventDefault();
            selectCellsBySpecialMode("visible");
            return;
        }

        // Alt + = / Alt + Shift + = : オートSUM（JIS配列の Shift+- と US配列の = の両対応）
        if (
            e.altKey &&
            (
                e.key === "=" ||
                (e.shiftKey && e.code === "Minus") ||
                (!e.shiftKey && e.code === "Equal")
            )
        ) {
            e.preventDefault();
            insertAutoSum();
            return;
        }

        // Shift + Space : 行全体選択
        if (e.shiftKey && !e.altKey && e.key === " " && activeCell) {
            e.preventDefault();
            const b = getSelectedRangeBounds();
            const rStart = b ? b.minRow : parseInt(activeCell.dataset.row, 10);
            const rEnd = b ? b.maxRow : rStart;
            clearSelection();
            selectionStart = { row: rStart, col: 0 };
            selectionEnd = { row: rEnd, col: currentColumns - 1 };
            updateSelection();
            setActiveCell(activeCell, true);
            updateFillHandle();
            return;
        }

        // F2でセル編集開始
        if (e.key === "F2" && activeCell) {
            e.preventDefault();
            enterCellEditMode(activeCell, false, "F2");
            updateFillHandle();
            return;
        }

        // Escapeでコピーアニメ・書式コピーモード・オートフィルオプション解除
        if (e.key === "Escape") {
            hideAutoFillOptions();
            clearCopyAnimation();
            if (formatPainterSnapshot) {
                formatPainterSnapshot = null;
                appRoot.querySelector(".ss-format-painter-btn")?.classList.remove("selected");
                statusBarState.stateText = "準備完了";
                renderWindowStatusBar();
            }
            return;
        }

        // Enter処理（コピー中なら貼り付け、通常時は選択範囲内ループ／上下移動）
        if (e.key === "Enter" && activeCell) {
            e.preventDefault();
            if (hasClipboardData() && isCopyAnimationActive()) {
                void pasteClipboardData("all");
                return;
            }
            moveActiveInSelectionOrStep(activeCell, "vertical", e.shiftKey);
            return;
        }

        // Tab処理（選択範囲内ループ／左右移動）
        if (e.key === "Tab" && activeCell) {
            e.preventDefault();
            moveActiveInSelectionOrStep(activeCell, "horizontal", e.shiftKey);
            return;
        }

        // Backspace / Delete でのセル内容クリア（単一セルのBackspaceはExcel同様に即編集モードへ移行）
        if (e.key === "Backspace" || e.key === "Delete") {
            e.preventDefault();
            const targets = getTargetCells();
            if (e.key === "Backspace" && targets.length === 1 && activeCell) {
                if (!enterCellEditMode(activeCell, false, "backspace")) return;
                cellEditor.value = "";
                formulaBarInput.value = "";
                syncCellEditorLayout(activeCell);
                return;
            }
            clearTargetCellsContent();
            return;
        }

        // Home（行頭A列へ移動）・PageUp / PageDown（1画面分スクロール移動）
        if (e.key === "Home" && activeCell) {
            e.preventDefault();
            const r = parseInt(activeCell.dataset.row, 10);
            navigateToCell(r, 0, e);
            return;
        }

        if ((e.key === "PageUp" || e.key === "PageDown") && activeCell) {
            e.preventDefault();
            const zoom = parseFloat(spreadsheetContent.style.zoom || "1") || 1;
            const visibleH = Math.max(DEFAULT_ROW_HEIGHT, container.clientHeight / zoom - DEFAULT_HEADER_HEIGHT);
            const pageRows = Math.max(1, Math.floor(visibleH / DEFAULT_ROW_HEIGHT));
            const curR = parseInt(activeCell.dataset.row, 10);
            const curC = parseInt(activeCell.dataset.col, 10);
            const nextR = e.key === "PageDown" ? curR + pageRows : Math.max(1, curR - pageRows);
            navigateToCell(nextR, curC, e);
            return;
        }

        // 矢印キー移動
        const arrowKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
        if (arrowKeys.includes(e.key) && activeCell) {
            e.preventDefault();
            const doMoveStep = () => {
                if (!activeCell) return;
                let curR = parseInt(activeCell.dataset.row, 10);
                let curC = parseInt(activeCell.dataset.col, 10);
                let rs = parseInt(activeCell.getAttribute("rowspan") || "1", 10);
                let cs = parseInt(activeCell.getAttribute("colspan") || "1", 10);
                if (activeCell.dataset.mergeMinRow) {
                    curR = parseInt(activeCell.dataset.mergeMinRow, 10);
                    curC = parseInt(activeCell.dataset.mergeMinCol, 10);
                    rs = parseInt(activeCell.dataset.mergeMaxRow, 10) - curR + 1;
                    cs = parseInt(activeCell.dataset.mergeMaxCol, 10) - curC + 1;
                }
                let nextR = curR, nextC = curC;
                if (e.key === "ArrowUp") {
                    nextR = Math.max(1, curR - 1);
                    while (nextR > 1 && getRow(nextR)?.style.display === "none") nextR--;
                }
                if (e.key === "ArrowDown") {
                    nextR = curR + rs;
                    while (nextR < rowCount - 1 && getRow(nextR)?.style.display === "none") nextR++;
                }
                if (e.key === "ArrowLeft") {
                    nextC = Math.max(0, curC - 1);
                    while (nextC > 0 && theadRow.children[nextC + 1]?.classList.contains("ss-col-hidden")) nextC--;
                    if (theadRow.children[nextC + 1]?.classList.contains("ss-col-hidden")) nextC = curC;
                }
                if (e.key === "ArrowRight") {
                    nextC = curC + cs;
                    while (nextC < currentColumns - 1 && theadRow.children[nextC + 1]?.classList.contains("ss-col-hidden")) nextC++;
                }

                if (e.shiftKey) {
                    if (!selectionStart) {
                        selectionStart = {
                            row: parseInt(activeCell.dataset.row, 10),
                            col: parseInt(activeCell.dataset.col, 10)
                        };
                    }
                    const baseEnd = selectionEnd || { ...selectionStart };
                    let extR = baseEnd.row;
                    let extC = baseEnd.col;
                    if (e.key === "ArrowUp") {
                        extR = Math.max(1, extR - 1);
                        while (extR > 1 && getRow(extR)?.style.display === "none") extR--;
                    }
                    if (e.key === "ArrowDown") {
                        extR = extR + 1;
                        while (extR < rowCount - 1 && getRow(extR)?.style.display === "none") extR++;
                    }
                    if (e.key === "ArrowLeft") {
                        extC = Math.max(0, extC - 1);
                        while (extC > 0 && theadRow.children[extC + 1]?.classList.contains("ss-col-hidden")) extC--;
                    }
                    if (e.key === "ArrowRight") {
                        extC = extC + 1;
                        while (extC < currentColumns - 1 && theadRow.children[extC + 1]?.classList.contains("ss-col-hidden")) extC++;
                    }

                    const extCell = getVisibleCell(extR, extC);
                    if (extCell) {
                        selectionEnd = {
                            row: parseInt(extCell.dataset.row, 10),
                            col: parseInt(extCell.dataset.col, 10)
                        };
                        updateSelection();
                        updateFillHandle();
                        extCell.scrollIntoView({ block: "nearest", inline: "nearest" });
                    }
                    return;
                }

                const visibleTarget = getVisibleCell(nextR, nextC);
                if (!visibleTarget) return;
                selectionStart = {
                    row: parseInt(visibleTarget.dataset.row, 10),
                    col: parseInt(visibleTarget.dataset.col, 10)
                };
                selectionEnd = { ...selectionStart };
                navigateToCell(parseInt(visibleTarget.dataset.row, 10), parseInt(visibleTarget.dataset.col, 10), e);

                // 隣接セル1つ先読みスクロール補正
                const contRect = container.getBoundingClientRect();
                const tr = parseInt(visibleTarget.dataset.row, 10);
                const tc = parseInt(visibleTarget.dataset.col, 10);
                if (e.key === "ArrowLeft") {
                    const leftCell = getCell(tr, tc - 1);
                    if (leftCell && leftCell.getBoundingClientRect().left < contRect.left) {
                        container.scrollBy({ left: -leftCell.offsetWidth, behavior: "auto" });
                    }
                } else if (e.key === "ArrowRight") {
                    const rightCell = getCell(tr, tc + 1);
                    if (rightCell && rightCell.getBoundingClientRect().right > contRect.right) {
                        container.scrollBy({ left: rightCell.offsetWidth, behavior: "auto" });
                    }
                } else if (e.key === "ArrowUp") {
                    const aboveCell = getCell(tr - 1, tc);
                    if (aboveCell && aboveCell.getBoundingClientRect().top < contRect.top) {
                        container.scrollBy({ top: -aboveCell.offsetHeight, behavior: "auto" });
                    }
                } else if (e.key === "ArrowDown") {
                    const belowCell = getCell(tr + 1, tc);
                    if (belowCell && belowCell.getBoundingClientRect().bottom > contRect.bottom) {
                        container.scrollBy({ top: belowCell.offsetHeight, behavior: "auto" });
                    }
                }
                tbody.querySelectorAll("td.transparent").forEach(td => td.classList.remove("transparent"));
            };

            doMoveStep();
            return;
        }

        // 印字可能文字の直接入力で編集モード移行（Shift+Spaceは除外）
        if (activeCell && !isCellEditing() && e.key.length === 1 && !e.altKey && !(e.shiftKey && e.key === " ")) {
            e.preventDefault();
            clearCopyAnimation();
            if (!enterCellEditMode(activeCell, false, "type")) return;
            cellEditor.value = e.key;
            cellEditor.setSelectionRange(1, 1);
            formulaBarInput.value = e.key;
            syncCellEditorLayout(activeCell);
            showAutocompletePopup(cellEditor, e.key, 1);
            if (e.key === "=") {
                highlightCalculationRange("=");
            }
        }
    }, { signal });

    function clearTargetCellsContent() {
        const targets = getTargetCells();
        if (!targets.length) return;
        if (targets.some(c => isCellLockedForEdit(c))) {
            showAlert("保護されたシート上のロックされたセルはクリアできません。", "シートの保護");
            return;
        }
        const clearedCoords = [];
        let hadAnyFormula = false;
        targets.forEach(c => {
            if (c.dataset.spillOrigin) return; // Excel準拠：スピル先単体のDeleteは無視（元セル消去で消える）
            const r = parseInt(c.dataset.row, 10);
            const col = parseInt(c.dataset.col, 10);
            if (c.dataset.formula) hadAnyFormula = true;
            clearSpillCellsFromAnchor(r, col);
            delete c.dataset.formula;
            delete c.dataset.quotePrefix;
            delete c.dataset.valueType;
            delete c.dataset.dateValue;
            delete c.dataset.richRuns;
            setCellFormattedValue(c, "");
            clearedCoords.push({ row: r, col });
        });
        if (activeCell) {
            formulaBarInput.value = activeCell.dataset.formula || (activeCell.dataset.rawValue ?? activeCell.textContent);
        }
        recalculateCells(clearedCoords, { formulaChanged: hadAnyFormula });
        updateSelectedCellsDisplay();
        updateFillHandle();
        setDirtyState(true);
        debouncedSaveState();
    }

    let definedNames = {}; // ブック共通の名前定義 { name: "Sheet1!$A$1:$B$5" }

    function syncCellAnnotationMark(cell) {
        if (!cell) return;
        const existing = cell.querySelector(":scope > .ss-anno-mark");
        const hasComment = Boolean(cell.dataset.comment);
        const hasNote = Boolean(cell.dataset.note);
        if (!hasComment && !hasNote) {
            existing?.remove();
            if (!extractHyperlinkTarget(cell)) cell.removeAttribute("title");
            return;
        }
        const mark = existing || document.createElement("span");
        mark.className = "ss-anno-mark" + (hasComment ? " is-comment" : "");
        if (!existing) cell.appendChild(mark);
        const parts = [];
        if (hasComment) parts.push(`[コメント] ${cell.dataset.comment}`);
        if (hasNote) parts.push(`[メモ] ${cell.dataset.note}`);
        cell.title = parts.join("\n");
    }

    function openCellAnnotationModal(cell, kind = "note") {
        if (!cell) return;
        const isComment = kind === "comment";
        const key = isComment ? "comment" : "note";
        const curVal = cell.dataset[key] || "";
        const bodyHtml = `
            <div style="width:100%; display:flex; flex-direction:column; gap:8px; font-size:12px;">
                <div>${getCellReference(cell)} の${isComment ? "コメント" : "メモ"}:</div>
                <textarea class="ss-anno-text border" rows="5" style="width:100%; padding:6px; background:${isComment ? "#f7f3ff" : "#ffffe1"}; color:#000; resize:none;">${escapeHtml(curVal)}</textarea>
            </div>
        `;
        const modal = openAppModal(isComment ? "コメントの編集" : "メモの編集", bodyHtml, {
            width: 350,
            isHtml: true,
            buttons: [
                {
                    label: "保存",
                    onClick: () => {
                        const txt = modal.querySelector(".ss-anno-text").value.trim();
                        if (txt) cell.dataset[key] = txt;
                        else delete cell.dataset[key];
                        syncCellAnnotationMark(cell);
                        setDirtyState(true);
                        debouncedSaveState();
                    }
                },
                {
                    label: "削除",
                    onClick: () => {
                        delete cell.dataset[key];
                        syncCellAnnotationMark(cell);
                        setDirtyState(true);
                        debouncedSaveState();
                    }
                },
                { label: "キャンセル" }
            ]
        });
        modal?.querySelector(".ss-anno-text")?.focus();
    }

    function openDefineNameModal() {
        const bounds = getSelectedRangeBounds();
        if (!bounds) return;
        const sName = sheets[activeSheetIndex]?.name || "Sheet1";
        const prefix = /^[A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+$/.test(sName) ? `${sName}!` : `'${sName.replace(/'/g, "''")}'!`;
        const refBody = (bounds.minRow === bounds.maxRow && bounds.minCol === bounds.maxCol)
            ? `$${getColumnName(bounds.minCol)}$${bounds.minRow}`
            : `$${getColumnName(bounds.minCol)}$${bounds.minRow}:$${getColumnName(bounds.maxCol)}$${bounds.maxRow}`;
        const defaultRef = `=${prefix}${refBody}`;
        const existingList = Object.entries(definedNames)
            .map(([k, v]) => `<option value="${escapeHtml(k)}">${escapeHtml(k)} = ${escapeHtml(v)}</option>`)
            .join("");

        const bodyHtml = `
            <div style="width:100%; display:flex; flex-direction:column; gap:8px; font-size:12px;">
                <label>名前:
                    <input type="text" class="ss-dn-name border" placeholder="例: 消費税率" style="width:100%; height:24px; margin-top:2px; padding:2px 6px; background:#fff; color:#000;">
                </label>
                <label>参照範囲:
                    <input type="text" class="ss-dn-ref border" value="${escapeHtml(defaultRef)}" style="width:100%; height:24px; margin-top:2px; padding:2px 6px; background:#fff; color:#000;">
                </label>
                <div style="font-size:11px; color:#444;">登録済みの名前（クリックで編集・削除）:</div>
                <select class="ss-dn-list border" size="4" style="width:100%; background:#fff; color:#000; font-size:11px;">
                    ${existingList || `<option value="">(登録なし)</option>`}
                </select>
            </div>
        `;
        const modal = openAppModal("名前の定義・管理", bodyHtml, {
            width: 390,
            isHtml: true,
            buttons: [
                {
                    label: "保存",
                    onClick: () => {
                        const name = modal.querySelector(".ss-dn-name").value.trim();
                        const ref = modal.querySelector(".ss-dn-ref").value.trim().replace(/^=/, "");
                        if (!name || /^\d/.test(name) || /[\s!+\-*/=<>()[\]{},;:'"]/.test(name)) {
                            showAlert("先頭が数字、または空白・記号を含む名前は使用できません。", "名前の定義");
                            return;
                        }
                        if (!ref) return;
                        definedNames[name] = ref;
                        updateAllFormulas();
                        setDirtyState(true);
                        debouncedSaveState();
                    }
                },
                {
                    label: "選択を削除",
                    onClick: () => {
                        const selName = modal.querySelector(".ss-dn-list").value;
                        if (selName && definedNames[selName]) {
                            delete definedNames[selName];
                            updateAllFormulas();
                            setDirtyState(true);
                            debouncedSaveState();
                        }
                    }
                },
                { label: "キャンセル" }
            ]
        });
        modal.querySelector(".ss-dn-list")?.addEventListener("change", (ev) => {
            const k = ev.target.value;
            if (k && definedNames[k]) {
                modal.querySelector(".ss-dn-name").value = k;
                modal.querySelector(".ss-dn-ref").value = `=${definedNames[k]}`;
            }
        });
        modal?.querySelector(".ss-dn-name")?.focus();
    }

    // =========================================================
    // ジャンプ（Ctrl+G / F5）＆ 選択オプション（Go To Special）
    // =========================================================
    const goToHistory = [];

    function recordGoToHistory(refStr) {
        const clean = String(refStr || "").trim();
        if (!clean) return;
        const existIdx = goToHistory.indexOf(clean);
        if (existIdx !== -1) goToHistory.splice(existIdx, 1);
        goToHistory.unshift(clean);
        if (goToHistory.length > 10) goToHistory.pop();
    }

    function getSheetUsedRangeBounds() {
        let maxR = 1;
        let maxC = 0;
        let hasAny = false;
        const rowsList = tbody.rows;
        for (let r = 0; r < rowsList.length; r++) {
            const cells = rowsList[r].cells;
            for (let c = 1; c < cells.length; c++) {
                const td = cells[c];
                const hasVal = Boolean(
                    td.dataset.formula ||
                    (td.dataset.rawValue ?? getCellPureText(td)).trim() !== "" ||
                    td.dataset.comment ||
                    td.dataset.note ||
                    td.dataset.dvRule ||
                    td.dataset.dropdownList ||
                    td.style.backgroundColor ||
                    td.style.borderTop ||
                    td.style.borderBottom ||
                    td.style.borderLeft ||
                    td.style.borderRight
                );
                if (hasVal) {
                    hasAny = true;
                    const rEnd = (r + 1) + (parseInt(td.getAttribute("rowspan") || "1", 10) - 1);
                    const cEnd = (c - 1) + (parseInt(td.getAttribute("colspan") || "1", 10) - 1);
                    if (rEnd > maxR) maxR = rEnd;
                    if (cEnd > maxC) maxC = cEnd;
                }
            }
        }
        return hasAny ? { minRow: 1, maxRow: maxR, minCol: 0, maxCol: maxC } : null;
    }

    function applySpecialSelectionResult(matchedCells, label = "") {
        if (!matchedCells.length) {
            showAlert("該当するセルが見つかりません。", "選択オプション");
            return false;
        }
        clearSelection();
        matchedCells.forEach(td => td.classList.add("selected"));
        setActiveCell(matchedCells[0], true);
        matchedCells[0].scrollIntoView({ block: "nearest", inline: "nearest" });
        updateSelectedCellsDisplay(matchedCells);
        updateFillHandle();
        if (label) {
            statusBarState.stateText = `${label}: ${matchedCells.length} セルを選択しました`;
            renderWindowStatusBar();
        }
        return true;
    }

    function selectCellsBySpecialMode(mode, subTypes = { numbers: true, text: true, logicals: true, errors: true }) {
        flushPendingEdits();
        const curSelected = Array.from(tbody.querySelectorAll("td.selected")).filter(td => td.style.display !== "none");
        const useSelectionScope = curSelected.length > 1;

        if (mode === "lastCell") {
            const used = getSheetUsedRangeBounds();
            const target = used ? getVisibleCell(used.maxRow, used.maxCol) : getVisibleCell(1, 0);
            if (!target) return false;
            return applySpecialSelectionResult([target], "最後のセル");
        }

        if (mode === "currentRegion") {
            const base = activeCell || getVisibleCell(1, 0);
            if (!base) return false;
            const r0 = parseInt(base.dataset.row, 10);
            const c0 = parseInt(base.dataset.col, 10);
            const maxR = tbody.rows.length;
            const maxC = currentColumns - 1;
            const isFilledAt = (r, c) => {
                const td = peekCell(r, c);
                if (!td) return false;
                const vis = td.style.display === "none" ? getVisibleCell(r, c) : td;
                return Boolean(vis && (vis.dataset.formula || (vis.dataset.rawValue ?? getCellPureText(vis)).trim() !== ""));
            };
            let minRow = r0, maxRow = r0, minCol = c0, maxCol = c0;
            let expanded = true;
            while (expanded) {
                expanded = false;
                if (minRow > 1) {
                    for (let c = Math.max(0, minCol - 1); c <= Math.min(maxC, maxCol + 1); c++) {
                        if (isFilledAt(minRow - 1, c)) { minRow--; expanded = true; break; }
                    }
                }
                if (maxRow < maxR) {
                    for (let c = Math.max(0, minCol - 1); c <= Math.min(maxC, maxCol + 1); c++) {
                        if (isFilledAt(maxRow + 1, c)) { maxRow++; expanded = true; break; }
                    }
                }
                if (minCol > 0) {
                    for (let r = Math.max(1, minRow - 1); r <= Math.min(maxR, maxRow + 1); r++) {
                        if (isFilledAt(r, minCol - 1)) { minCol--; expanded = true; break; }
                    }
                }
                if (maxCol < maxC) {
                    for (let r = Math.max(1, minRow - 1); r <= Math.min(maxR, maxRow + 1); r++) {
                        if (isFilledAt(r, maxCol + 1)) { maxCol++; expanded = true; break; }
                    }
                }
            }
            const region = expandBoundsForMergedCells({ minRow, maxRow, minCol, maxCol });
            const cells = [];
            for (let r = region.minRow; r <= region.maxRow; r++) {
                const tr = getRow(r);
                if (tr && tr.style.display === "none") continue;
                for (let c = region.minCol; c <= region.maxCol; c++) {
                    const td = getVisibleCell(r, c);
                    if (td && td.style.display !== "none" && !td.classList.contains("ss-col-hidden") && !cells.includes(td)) {
                        cells.push(td);
                    }
                }
            }
            return applySpecialSelectionResult(cells, "アクティブセル領域");
        }

        // 探索対象セル集合（複数選択時は選択範囲内、単一セル時はシート使用範囲全体）
        let candidates = [];
        if (useSelectionScope) {
            candidates = curSelected;
        } else {
            const used = getSheetUsedRangeBounds();
            if (!used) {
                if (mode === "visible" && activeCell) {
                    candidates = [activeCell];
                } else {
                    showAlert("該当するセルが見つかりません。", "選択オプション");
                    return false;
                }
            } else {
                const seen = new Set();
                for (let r = used.minRow; r <= used.maxRow; r++) {
                    for (let c = used.minCol; c <= used.maxCol; c++) {
                        const td = peekCell(r, c);
                        if (!td || td.style.display === "none" || seen.has(td)) continue;
                        seen.add(td);
                        candidates.push(td);
                    }
                }
            }
        }

        const isVisibleCell = (td) => {
            const tr = td.closest("tr");
            return Boolean(
                td &&
                td.style.display !== "none" &&
                !td.classList.contains("ss-col-hidden") &&
                (!tr || tr.style.display !== "none")
            );
        };

        const matchValueSubType = (td) => {
            const rawVal = String(td.dataset.rawValue ?? getCellPureText(td)).trim();
            const upper = rawVal.toUpperCase();
            if (EXCEL_ERROR_RE.test(upper)) return Boolean(subTypes.errors);
            if (upper === "TRUE" || upper === "FALSE") return Boolean(subTypes.logicals);
            const isNum = td.dataset.quotePrefix !== "1" && (
                !isNaN(parseFormattedNumber(rawVal)) ||
                td.dataset.valueType === "date" ||
                isDateFormat(rawVal)
            );
            if (isNum) return Boolean(subTypes.numbers);
            return Boolean(subTypes.text);
        };

        const cfRules = sheets[activeSheetIndex]?.conditionalFormats || [];
        let matched = [];
        let label = "";

        if (mode === "visible") {
            label = "可視セル";
            matched = candidates.filter(isVisibleCell);
        } else if (mode === "blanks") {
            label = "空白セル";
            matched = candidates.filter(td =>
                isVisibleCell(td) &&
                !td.dataset.formula &&
                (td.dataset.rawValue ?? getCellPureText(td)).trim() === ""
            );
        } else if (mode === "formulas") {
            label = "数式";
            matched = candidates.filter(td => isVisibleCell(td) && Boolean(td.dataset.formula) && matchValueSubType(td));
        } else if (mode === "constants") {
            label = "定数";
            matched = candidates.filter(td => {
                if (!isVisibleCell(td) || td.dataset.formula) return false;
                const raw = (td.dataset.rawValue ?? getCellPureText(td)).trim();
                return raw !== "" && matchValueSubType(td);
            });
        } else if (mode === "comments") {
            label = "コメント/メモ";
            matched = candidates.filter(td => isVisibleCell(td) && Boolean(td.dataset.comment || td.dataset.note));
        } else if (mode === "conditionalFormats") {
            label = "条件付き書式";
            matched = candidates.filter(td => {
                if (!isVisibleCell(td)) return false;
                const r = parseInt(td.dataset.row, 10);
                const c = parseInt(td.dataset.col, 10);
                return cfRules.some(rule => r >= rule.minRow && r <= rule.maxRow && c >= rule.minCol && c <= rule.maxCol);
            });
        } else if (mode === "dataValidation") {
            label = "データの入力規則";
            matched = candidates.filter(td => isVisibleCell(td) && Boolean(td.dataset.dvRule || td.dataset.dropdownList));
        }

        return applySpecialSelectionResult(matched, label);
    }

    async function executeGoToReference(rawInput) {
        const input = String(rawInput || "").trim().replace(/^=/, "");
        if (!input) return false;

        // 移動前の現在位置を履歴へ記録（Excel同様すぐ元の位置へ戻れる）
        if (activeCell) {
            const curSheetName = sheets[activeSheetIndex]?.name || "Sheet1";
            const curPrefix = /^[A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+$/.test(curSheetName)
                ? `${curSheetName}!`
                : `'${curSheetName.replace(/'/g, "''")}'!`;
            const curBounds = getSelectedRangeBounds();
            const curRef = curBounds && (curBounds.minRow !== curBounds.maxRow || curBounds.minCol !== curBounds.maxCol)
                ? `${getCellReferenceByCoord(curBounds.minRow, curBounds.minCol)}:${getCellReferenceByCoord(curBounds.maxRow, curBounds.maxCol)}`
                : getCellReference(activeCell);
            recordGoToHistory(`${curPrefix}${curRef}`);
        }

        let resolvedSpec = input;

        // 1. 定義済みの名前（definedNames）
        if (definedNames && Object.prototype.hasOwnProperty.call(definedNames, input)) {
            resolvedSpec = String(definedNames[input]).replace(/^=/, "").trim();
        } else {
            // 2. 全シートの構造化テーブル名
            for (let sIdx = 0; sIdx < sheets.length; sIdx++) {
                const tbl = getSheetTables(sIdx).find(t => t.name === input);
                if (tbl) {
                    const sName = sheets[sIdx].name;
                    const prefix = /^[A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+$/.test(sName)
                        ? `${sName}!`
                        : `'${sName.replace(/'/g, "''")}'!`;
                    resolvedSpec = `${prefix}${getCellReferenceByCoord(tbl.minRow, tbl.minCol)}:${getCellReferenceByCoord(tbl.maxRow, tbl.maxCol)}`;
                    break;
                }
            }
        }

        const sheetSplit = resolvedSpec.match(/^(?:(?:'((?:''|[^'])+)'|([A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+))!)?(.+)$/);
        if (sheetSplit) {
            const rawSheetName = sheetSplit[1] ? sheetSplit[1].replace(/''/g, "'") : sheetSplit[2];
            if (rawSheetName) {
                const sIdx = sheets.findIndex(s => s.name === rawSheetName);
                if (sIdx === -1) {
                    showAlert(`シート「${rawSheetName}」が見つかりません。`, "ジャンプ");
                    return false;
                }
                if (sIdx !== activeSheetIndex) {
                    await switchToSheet(sIdx);
                }
            }
            resolvedSpec = sheetSplit[3].trim();
        }

        const MAX_NAV_ROW = 5000;
        const MAX_NAV_COL = 200;
        const upperRef = resolvedSpec.toUpperCase();
        if (upperRef.includes(":")) {
            const range = parseRangeReference(upperRef);
            if (range) {
                const minR = Math.min(range.start.row, range.end.row);
                const maxR = Math.max(range.start.row, range.end.row);
                const minC = Math.min(range.start.col, range.end.col);
                const maxC = Math.max(range.start.col, range.end.col);
                if (maxR > MAX_NAV_ROW || maxC >= MAX_NAV_COL) {
                    showAlert(`ジャンプできる上限は ${MAX_NAV_ROW} 行・${MAX_NAV_COL} 列までです。`, "ジャンプ");
                    return false;
                }
                const topLeft = getVisibleCell(minR, minC);
                getCell(maxR, maxC);
                if (topLeft) {
                    clearSelection();
                    setActiveCell(topLeft, true);
                    selectionStart = { row: minR, col: minC };
                    selectionEnd = { row: maxR, col: maxC };
                    updateSelection();
                    updateFillHandle();
                    topLeft.scrollIntoView({ block: "nearest", inline: "nearest" });
                    recordGoToHistory(input);
                    return true;
                }
            }
        } else {
            const pos = parseCellReference(upperRef);
            if (pos && pos.row >= 1 && pos.col >= 0) {
                if (pos.row > MAX_NAV_ROW || pos.col >= MAX_NAV_COL) {
                    showAlert(`ジャンプできる上限は ${MAX_NAV_ROW} 行・${MAX_NAV_COL} 列までです。`, "ジャンプ");
                    return false;
                }
                navigateToCell(pos.row, pos.col);
                recordGoToHistory(input);
                return true;
            }
        }

        showAlert("有効なセル番地、範囲、または定義された名前を入力してください。", "ジャンプ");
        return false;
    }

    function openGoToSpecialDialog() {
        flushPendingEdits();
        const bodyHtml = `
            <div style="width:100%; display:flex; flex-direction:column; gap:8px; font-size:12px;">
                <div style="font-weight:bold;">選択対象:</div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px 12px; padding:6px 8px; background:#f4f4f4; border:1px solid #808080;">
                    <label style="cursor:pointer;"><input type="radio" name="ss-gts-mode" value="comments"> コメント / メモ(C)</label>
                    <label style="cursor:pointer;"><input type="radio" name="ss-gts-mode" value="currentRegion"> アクティブセル領域(R)</label>
                    <label style="cursor:pointer;"><input type="radio" name="ss-gts-mode" value="constants"> 定数(O)</label>
                    <label style="cursor:pointer;"><input type="radio" name="ss-gts-mode" value="lastCell"> 最後のセル(S)</label>
                    <label style="cursor:pointer;"><input type="radio" name="ss-gts-mode" value="formulas"> 数式(F)</label>
                    <label style="cursor:pointer;"><input type="radio" name="ss-gts-mode" value="visible"> 可視セル(Y)</label>
                    <label style="cursor:pointer;"><input type="radio" name="ss-gts-mode" value="blanks" checked> 空白セル(K)</label>
                    <label style="cursor:pointer;"><input type="radio" name="ss-gts-mode" value="conditionalFormats"> 条件付き書式(T)</label>
                    <label style="cursor:pointer; grid-column:2;"><input type="radio" name="ss-gts-mode" value="dataValidation"> データの入力規則(V)</label>
                </div>
                <fieldset class="ss-gts-subbox" style="border:1px solid #808080; padding:6px 8px; margin:0; opacity:0.55;">
                    <legend style="padding:0 4px; font-size:11px;">定数・数式のデータ型（絞り込み）</legend>
                    <div style="display:flex; gap:12px; flex-wrap:wrap;">
                        <label style="cursor:pointer;"><input type="checkbox" class="ss-gts-sub-num" checked disabled> 数値(U)</label>
                        <label style="cursor:pointer;"><input type="checkbox" class="ss-gts-sub-txt" checked disabled> 文字(X)</label>
                        <label style="cursor:pointer;"><input type="checkbox" class="ss-gts-sub-log" checked disabled> 論理値(G)</label>
                        <label style="cursor:pointer;"><input type="checkbox" class="ss-gts-sub-err" checked disabled> エラー値(E)</label>
                    </div>
                </fieldset>
            </div>
        `;

        const modal = openAppModal("選択オプション", bodyHtml, {
            width: 420,
            isHtml: true,
            buttons: [
                {
                    label: "OK",
                    onClick: () => {
                        const mode = modal.querySelector('input[name="ss-gts-mode"]:checked')?.value || "blanks";
                        const subTypes = {
                            numbers: Boolean(modal.querySelector(".ss-gts-sub-num")?.checked),
                            text: Boolean(modal.querySelector(".ss-gts-sub-txt")?.checked),
                            logicals: Boolean(modal.querySelector(".ss-gts-sub-log")?.checked),
                            errors: Boolean(modal.querySelector(".ss-gts-sub-err")?.checked)
                        };
                        selectCellsBySpecialMode(mode, subTypes);
                    }
                },
                { label: "キャンセル" }
            ]
        });

        const subBox = modal?.querySelector(".ss-gts-subbox");
        const subChks = modal ? Array.from(modal.querySelectorAll(".ss-gts-subbox input[type='checkbox']")) : [];
        const syncSubState = () => {
            const mode = modal.querySelector('input[name="ss-gts-mode"]:checked')?.value;
            const enabled = mode === "constants" || mode === "formulas";
            if (subBox) subBox.style.opacity = enabled ? "1" : "0.55";
            subChks.forEach(chk => { chk.disabled = !enabled; });
        };
        modal?.querySelectorAll('input[name="ss-gts-mode"]').forEach(r => {
            r.addEventListener("change", syncSubState);
        });
    }

    function openGoToDialog() {
        flushPendingEdits();
        const entries = [];
        Object.keys(definedNames || {}).forEach(name => entries.push({ label: `${name}（名前）`, value: name }));
        sheets.forEach(s => {
            (s.tables || []).forEach(t => entries.push({ label: `${t.name}（テーブル / ${s.name}）`, value: t.name }));
        });
        goToHistory.forEach(h => entries.push({ label: h, value: h }));

        const optionsHtml = entries.length
            ? entries.map(e => `<option value="${escapeHtml(e.value)}">${escapeHtml(e.label)}</option>`).join("")
            : `<option value="" disabled>(移動先履歴・名前定義はまだありません)</option>`;

        const bodyHtml = `
            <div style="width:100%; display:flex; flex-direction:column; gap:8px; font-size:12px;">
                <label>指定先(G):
                    <select class="ss-goto-list border" size="6" style="width:100%; margin-top:2px; background:#fff; color:#000; font-size:12px;">
                        ${optionsHtml}
                    </select>
                </label>
                <label>参照先(R):
                    <input type="text" class="ss-goto-ref border" value="${escapeHtml(goToHistory[0] || "")}" placeholder="例: A1 / B2:F20 / Sheet2!A1 / 名前" style="width:100%; height:24px; margin-top:2px; padding:2px 6px; background:#fff; color:#000;">
                </label>
            </div>
        `;

        const modal = openAppModal("ジャンプ", bodyHtml, {
            width: 380,
            isHtml: true,
            buttons: [
                {
                    label: "セル選択(S)...",
                    onClick: () => openGoToSpecialDialog()
                },
                {
                    label: "OK",
                    onClick: () => {
                        const refVal = modal.querySelector(".ss-goto-ref")?.value.trim();
                        if (refVal) void executeGoToReference(refVal);
                    }
                },
                { label: "キャンセル" }
            ]
        });

        const listEl = modal?.querySelector(".ss-goto-list");
        const refInp = modal?.querySelector(".ss-goto-ref");
        listEl?.addEventListener("change", () => {
            if (listEl.value && refInp) refInp.value = listEl.value;
        });
        listEl?.addEventListener("dblclick", () => {
            if (listEl.value) {
                if (refInp) refInp.value = listEl.value;
                const btns = (modal.closest(".window") || modal).querySelectorAll(".button-container button");
                btns[1]?.click();
            }
        });
        if (refInp) {
            refInp.focus();
            refInp.select();
            refInp.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    const btns = (modal.closest(".window") || modal).querySelectorAll(".button-container button");
                    btns[1]?.click();
                }
            });
        }
    }

    function toggleShowFormulasMode() {
        flushPendingEdits();
        showFormulasMode = !showFormulasMode;
        appRoot.classList.toggle("ss-show-formulas", showFormulasMode);
        appRoot.querySelector(".ss-show-formulas-btn")?.classList.toggle("selected", showFormulasMode);
        tbody.querySelectorAll("td[data-formula]").forEach(td => {
            const raw = td.dataset.rawValue ?? "";
            setCellFormattedValue(td, raw);
            if (td.dataset.shrinkToFit === "1") applyShrinkToFit(td);
        });
        updateTextOverflowDisplay();
        syncSelectionBoxPosition();
        statusBarState.stateText = showFormulasMode ? "数式の表示モード: ON" : "数式の表示モード: OFF";
        renderWindowStatusBar();
    }

    function openErrorCheckDialog() {
        flushPendingEdits();
        const errorCells = [];
        tbody.querySelectorAll("td").forEach(td => {
            if (td.style.display === "none") return;
            const val = String(td.dataset.rawValue ?? getCellPureText(td)).trim();
            if (EXCEL_ERROR_RE.test(val)) {
                errorCells.push({
                    cell: td,
                    ref: getCellReference(td),
                    err: val,
                    formula: td.dataset.formula || val
                });
            }
        });

        if (!errorCells.length) {
            showAlert("シート全体のエラー チェックが完了しました。\nエラーは見つかりませんでした。", "エラー チェック");
            return;
        }

        let currentIdx = 0;
        const focusErrorCell = (idx) => {
            const item = errorCells[idx];
            if (!item) return;
            navigateToCell(parseInt(item.cell.dataset.row, 10), parseInt(item.cell.dataset.col, 10));
        };

        const bodyHtml = `
            <div style="width:100%; display:flex; flex-direction:column; gap:8px; font-size:12px;">
                <div>検出されたエラー: <strong>${errorCells.length} 件</strong>（項目をクリックするとセルへ移動します）</div>
                <select class="ss-err-list border" size="6" style="width:100%; background:#fff; color:#000; font-family:monospace; font-size:11px;">
                    ${errorCells.map((item, i) => `<option value="${i}" ${i === 0 ? "selected" : ""}>${escapeHtml(item.ref)} : ${escapeHtml(item.err)}   ${escapeHtml(item.formula)}</option>`).join("")}
                </select>
                <div class="ss-err-detail" style="padding:6px 8px; background:#fff6f6; border:1px solid #d13438; font-size:11px;"></div>
            </div>
        `;

        const modal = openAppModal("エラー チェック", bodyHtml, {
            width: 450,
            isHtml: true,
            parentWin: win,
            buttons: [
                {
                    label: "参照元をトレース",
                    closeOnClick: false,
                    onClick: () => {
                        const item = errorCells[currentIdx];
                        if (item) {
                            clearAuditArrows();
                            tracePrecedentsForCell(item.cell);
                        }
                    }
                },
                {
                    label: "数式を編集",
                    onClick: () => {
                        const item = errorCells[currentIdx];
                        if (item) {
                            focusErrorCell(currentIdx);
                            enterCellEditMode(item.cell, false, "f2");
                        }
                    }
                },
                { label: "閉じる" }
            ]
        });

        const listEl = modal?.querySelector(".ss-err-list");
        const detailEl = modal?.querySelector(".ss-err-detail");
        const syncDetail = () => {
            const item = errorCells[currentIdx];
            if (!item || !detailEl) return;
            detailEl.innerHTML = `<strong>セル ${escapeHtml(item.ref)}</strong> — エラー値: <strong style="color:#d13438;">${escapeHtml(item.err)}</strong><br>数式: <code>${escapeHtml(item.formula)}</code>`;
            focusErrorCell(currentIdx);
        };
        listEl?.addEventListener("change", () => {
            currentIdx = Number(listEl.value) || 0;
            syncDetail();
        });
        syncDetail();
    }

    registerContextMenus({
        sheetTabsListEl,
        table,
        tbody,
        getActiveSheetIndex: () => activeSheetIndex,
        getSheetsLength: () => sheets.length,
        addNewSheet: (idx) => addNewSheet(idx),
        renameSheetDialog: (idx) => renameSheetDialog(idx),
        duplicateSheet: (idx) => duplicateSheet(idx),
        moveSheet: (idx, delta) => moveSheet(idx, delta),
        deleteSheet: (idx) => deleteSheet(idx),
        isCellEditing: (cell) => isCellEditing(cell),
        getSelectedWholeRows: () => getSelectedWholeRows(),
        getSelectedWholeColumns: () => getSelectedWholeColumns(),
        getCurrentColumns: () => currentColumns,
        getRowCount: () => rowCount,
        getVisibleCell,
        getRow,
        clearSelection: () => clearSelection(),
        setActiveCell: (cell, shouldFocus) => setActiveCell(cell, shouldFocus),
        updateSelectedCellsDisplay: () => updateSelectedCellsDisplay(),
        updateFillHandle: () => updateFillHandle(),
        copySelectedCells: (isCut) => copySelectedCells(isCut),
        pasteClipboardData: (mode) => pasteClipboardData(mode),
        openPasteSpecialDialog: () => openPasteSpecialDialog(),
        modifySheetRowCol: (mode) => modifySheetRowCol(mode),
        clearTargetCellsContent: () => clearTargetCellsContent(),
        openFormatCellsModal: (tab) => openFormatCellsModal(tab),
        openDimensionInputDialog: (type, targets) => openDimensionInputDialog(type, targets),
        autoFitRow: (tr) => autoFitRow(tr),
        autoFitColumn: (c) => autoFitColumn(c),
        setDirtyState: (flag) => setDirtyState(flag),
        debouncedSaveState: (delay) => debouncedSaveState(delay),
        setRowsVisibility: (rows, visible) => setRowsVisibility(rows, visible),
        setColumnsVisibility: (cols, visible) => setColumnsVisibility(cols, visible),
        getFreezeRows: () => freezeRows,
        getFreezeCols: () => freezeCols,
        setFreezePanes: (r, c, opts) => setFreezePanes(r, c, opts),
        sortSelectedRange: (asc) => sortSelectedRange(asc),
        openCustomSortDialog: () => openCustomSortDialog(),
        resolveCellFromPoint: (e) => resolveCellFromPoint(e),
        handleAppAction: (action) => handleAppAction(action),
        openConditionalFormatManager: () => openConditionalFormatManager(),
        openDataValidationDialog: () => openDataValidationDialog(),
        toggleAutoFilter: () => toggleAutoFilter(),
        mergeSelectedCells: () => mergeSelectedCells(),
        unmergeSelectedCells: () => unmergeSelectedCells(),
        openCellAnnotationModal: (cell, kind) => openCellAnnotationModal(cell, kind),
        openDefineNameModal: () => openDefineNameModal(),
        extractHyperlinkTarget: (cell) => extractHyperlinkTarget(cell),
        activateCellHyperlink: (cell) => activateCellHyperlink(cell),
        openHyperlinkDialog: () => openHyperlinkDialog()
    });

    // =========================================================
    // スクロール時の動的行・列追加 ＋ 行/列の可視範囲最適化
    // =========================================================
    let rowObserver = null;
    let scrollPending = false;
    let isLoadingRows = false;
    let isLoadingCols = false;
    let isScrollingNow = false;
    let scrollIdleTimer = null;

    function computeVisibleColumns() {
        // GPU標準クリッピングに任せるため処理不要（互換維持）
    }

    function isWindowMinimizedOrHidden() {
        if (!win) return false;
        return win.dataset.minimized === "true" || win.style.visibility === "hidden" || win.hidden;
    }

    function refreshVisibleFloatingObjects() {
        const boxes = spreadsheetContent.querySelectorAll(".floating-textbox, .floating-slicer");
        if (!boxes.length) return;

        if (isWindowMinimizedOrHidden()) {
            for (let i = 0; i < boxes.length; i++) {
                boxes[i].classList.remove("ss-obj-offscreen");
            }
            return;
        }

        const zoom = parseFloat(spreadsheetContent.style.zoom || "1") || 1;
        const headerH = theadRow.offsetHeight || DEFAULT_HEADER_HEIGHT;
        const rowHeaderW = parseInt(colgroup.children[0]?.style.width, 10) || DEFAULT_ROW_HEADER_WIDTH;
        const viewTop = (container.scrollTop + headerH) / zoom;
        const viewBottom = (container.scrollTop + container.clientHeight) / zoom;
        const viewLeft = (container.scrollLeft + rowHeaderW) / zoom;
        const viewRight = (container.scrollLeft + container.clientWidth) / zoom;
        const active = document.activeElement;

        for (let i = 0; i < boxes.length; i++) {
            const box = boxes[i];
            const isEditingBox = Boolean(active && box.contains(active));
            const left = parseFloat(box.dataset.initialLeft || box.style.left) || 0;
            const top = parseFloat(box.dataset.initialTop || box.style.top) || 0;
            const w = parseFloat(box.style.width) || 260;
            const h = parseFloat(box.style.height) || 120;

            const inView = !(
                top + h <= viewTop ||
                top >= viewBottom ||
                left + w <= viewLeft ||
                left >= viewRight
            );
            const shouldHide = !inView && !isEditingBox;
            const isHidden = box.classList.contains("ss-obj-offscreen");
            if (shouldHide !== isHidden) {
                box.classList.toggle("ss-obj-offscreen", shouldHide);
            }
        }
    }

    function setupRowVisibilityObserver() {
        // GPUスクロールへ一本化したため監視不要（互換維持）
    }

    function refreshVisibleRows() {
        if (isWindowMinimizedOrHidden()) return;
        refreshVisibleFloatingObjects();
        syncSelectionBoxPosition();
        syncAutoFillOptionButtonPosition();
    }

    // ウィンドウ最小化・復元とコンテンツエリアの表示・オーバーフロー隠蔽を連動
    let windowStateObserver = null;
    function syncWindowMinimizeState() {
        const minimized = isWindowMinimizedOrHidden();
        syncFindDialogVisibility(minimized);
        if (minimized) {
            appRoot.style.display = "none";
            appRoot.style.visibility = "hidden";
            container.style.overflowY = "hidden";
            container.style.overflowX = "hidden";
            spreadsheetContent.querySelectorAll(".floating-textbox, .floating-slicer").forEach(box => {
                box.classList.remove("ss-obj-offscreen");
            });
        } else {
            appRoot.style.display = "flex";
            appRoot.style.visibility = "";
            container.style.overflowY = "auto";
            container.style.overflowX = "scroll";
            requestAnimationFrame(() => {
                refreshVisibleRows();
            });
        }
    }

    let containerResizeObserver = null;
    if (typeof ResizeObserver !== "undefined") {
        containerResizeObserver = new ResizeObserver(() => {
            if (!isWindowMinimizedOrHidden()) {
                refreshVisibleRows();
            }
        });
        containerResizeObserver.observe(container);
    }

    if (win) {
        windowStateObserver = new MutationObserver(() => {
            syncWindowMinimizeState();
        });
        windowStateObserver.observe(win, {
            attributes: true,
            attributeFilter: ["data-minimized", "style", "hidden"]
        });
    }

    // シートタブの左右ナビゲーションボタン
    const tabsScrollArea = appRoot.querySelector(".ss-sheet-tabs-scroll");
    appRoot.querySelectorAll(".ss-tab-nav-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            tabsScrollArea?.scrollBy({ left: btn.dataset.tabScroll === "left" ? -120 : 120, behavior: "smooth" });
        }, { signal });
    });

    container.addEventListener("scroll", () => {
        if (!isScrollingNow) {
            isScrollingNow = true;
            // スクロール開始時に浮遊プルダウンボタンだけ一時退避（毎フレームの座標計測を回避）
            temporarilyHideDropdownButtonOnScroll();
        }
        if (scrollIdleTimer) { clearTimeout(scrollIdleTimer); timers.delete(scrollIdleTimer); }
        scrollIdleTimer = managedTimeout(() => {
            isScrollingNow = false;
            scrollIdleTimer = null;
            restoreDropdownButtonAfterScroll();
            if (tbody.rows.length > 120) scheduleTextOverflowUpdate();
        }, 120);

        closeCellDropdownList();
        closeFilterDropdown();
        hideDataValidationTooltip();

        if (scrollPending || isWindowMinimizedOrHidden()) return;
        scrollPending = true;
        requestAnimationFrame(() => {
            scrollPending = false;
            if (isWindowMinimizedOrHidden()) return;

            const sTop = container.scrollTop;
            const sLeft = container.scrollLeft;
            const cH = container.clientHeight;
            const cW = container.clientWidth;
            const sH = container.scrollHeight;
            const sW = container.scrollWidth;

            if (!isLoadingRows && sTop + cH >= sH - 400) {
                isLoadingRows = true;
                loadRowsSync(ROW_BATCH);
                isLoadingRows = false;
            }
            if (!isLoadingCols && sLeft + cW >= sW - 400) {
                isLoadingCols = true;
                loadColumnsSync(COLUMN_BATCH);
                isLoadingCols = false;
            }
            refreshVisibleFloatingObjects();
            if (freezeRows > 0 || freezeCols > 0) {
                refreshFormulaRefOverlay();
                syncSelectionBoxPosition();
            }
        });
    }, { passive: true, signal });

    // =========================================================
    // ズーム・トラックパッド横スクロール・タッチパン＆慣性スクロール制御（touch-scroll.js）
    // =========================================================
    const {
        setZoom,
        stopTouchInertia
    } = createTouchScrollModule({
        appRoot,
        container,
        spreadsheetContent,
        zoomSlider,
        zoomDisplay,
        signal,
        refreshVisibleRows: () => refreshVisibleRows(),
        syncCellDropdownButtonPosition: () => syncCellDropdownButtonPosition(),
        syncCopyAntsBoxPosition: () => syncCopyAntsBoxPosition(),
        scheduleTextOverflowUpdate: () => scheduleTextOverflowUpdate(),
        refreshFormulaRefOverlay: () => refreshFormulaRefOverlay(),
        setDirtyState: (flag) => setDirtyState(flag),
        debouncedSaveState: (delay) => debouncedSaveState(delay)
    });

    // =========================================================
    // 初期グリッド構築および起動時ファイルロード
    // =========================================================
    loadColumnsSync(INITIAL_COLUMNS);
    loadRowsSync(INITIAL_ROWS);
    computeVisibleColumns();
    setupRowVisibilityObserver();

    sheets = [createBlankSheetModel("Sheet1")];
    activeSheetIndex = 0;
    renderSheetTabs();

    const targetNode = options.path ? resolveFS(options.path) : null;
    if (targetNode && targetNode.type === "file") {
        await openFileFromFS(options.path);
    } else {
        // saveState() で上書きされる前に、前回の未保存バックアップを先に読み出しておく
        const rawRecovery = readCrashRecoveryRaw();

        setDirtyState(false);
        saveState();
        markCurrentSnapshotAsSaved();
        await updateStorageUsageDisplay();

        const a1Cell = getVisibleCell(1, 0);
        if (a1Cell) {
            setActiveCell(a1Cell, true);
            updateSelectedCellsDisplay();
            updateFillHandle();
        }

        // 前回の強制終了時の未保存バックアップがあれば復元を提案
        try {
            if (rawRecovery) {
                const parsed = JSON.parse(rawRecovery);
                const ageMs = Date.now() - (Number(parsed?.timestamp) || 0);
                if (parsed?.snapshot && ageMs >= 0 && ageMs < 24 * 60 * 60 * 1000 && windowAPI?.confirmWindow) {
                    const dtStr = new Date(parsed.timestamp).toLocaleString("ja-JP");
                    const label = parsed.filePath ? basename(parsed.filePath) : "無題.nxs";
                    windowAPI.confirmWindow(
                        `前回の未保存データが見つかりました。\nファイル: ${label}\n自動保存日時: ${dtStr}\n\n復元しますか？`,
                        async (ok) => {
                            if (ok) {
                                try {
                                    await applyDeserializedPayload(parsed.snapshot, { isUndoRedo: false });
                                    setDirtyState(true);
                                    resetUndoRedoHistoryOnly();
                                    statusBarState.stateText = "自動保存データから復元しました";
                                    renderWindowStatusBar();
                                } catch (err) {
                                    showError(`復元に失敗しました:\n${err.message}`, "復元エラー");
                                    clearCrashRecoveryBackup();
                                }
                            } else {
                                clearCrashRecoveryBackup();
                            }
                        },
                        { title: "ドキュメントの回復", parentWin: win }
                    );
                }
            }
        } catch {
            clearCrashRecoveryBackup();
        }
    }

    // =========================================================
    // Windows標準：未保存変更がある場合の閉じる確認
    // =========================================================
    const closeBtn = win?.querySelector(".close-btn, .window-close");
    let bypassCloseConfirm = false;
    let isCloseConfirmOpen = false;
    if (closeBtn && windowAPI?.showModalWindow) {
        closeBtn.addEventListener("click", (e) => {
            if (!isDirty || bypassCloseConfirm) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            if (isCloseConfirmOpen) return;
            isCloseConfirmOpen = true;

            const curPath = getCurrentFilePath();
            const fileName = curPath ? basename(curPath) : "無題.nxs";
            openAppModal(
                "Nexser スプレッドシート",
                `${fileName} への変更内容を保存しますか？`,
                {
                    width: 380,
                    onClose: () => {
                        isCloseConfirmOpen = false;
                    },
                    buttons: [
                        {
                            label: "保存する",
                            onClick: async () => {
                                isCloseConfirmOpen = false;
                                const latestPath = getCurrentFilePath();
                                if (latestPath) {
                                    const ok = await writeToFSPath(latestPath);
                                    if (ok) {
                                        isDirty = false;
                                        bypassCloseConfirm = true;
                                        closeBtn.click();
                                    }
                                } else {
                                    promptSaveAsDialog(".nxs", () => {
                                        isDirty = false;
                                        bypassCloseConfirm = true;
                                        closeBtn.click();
                                    });
                                }
                            }
                        },
                        {
                            label: "保存しない",
                            onClick: () => {
                                isCloseConfirmOpen = false;
                                clearCrashRecoveryBackup();
                                isDirty = false;
                                bypassCloseConfirm = true;
                                closeBtn.click();
                            }
                        },
                        {
                            label: "キャンセル",
                            onClick: () => {
                                isCloseConfirmOpen = false;
                            }
                        }
                    ]
                }
            );
        }, { capture: true, signal });
    }

    window.addEventListener("beforeunload", () => {
        if (!isDirty) return;
        try {
            const serialized = serializeSheetSnapshot({ flush: true, recalcBackground: false });
            persistCrashRecoveryBackup(serialized, { immediate: true });
        } catch { /* ignore */ }
    }, { signal });

    // =========================================================
    // カーネル連携用ハンドル
    // =========================================================
    const appHandle = {
        onRename({ oldPath, newPath }) {
            handleFileRenamed(oldPath, newPath);
        },
        onMessage({ data }) {
            if (data?.type === "open-file" && data.path) {
                openFileFromFS(data.path);
            }
        },
        dispose() {
            hideContextMenu();
            closeFilterDropdown();
            closeCellDropdownList();
            closeAutocompletePopup();
            cancelDebouncedSaveState();
            disposeFileIO();
            if (appRoot._navInterval) {
                clearInterval(appRoot._navInterval);
                appRoot._navInterval = null;
            }
            rowObserver?.disconnect();
            containerResizeObserver?.disconnect();
            windowStateObserver?.disconnect();
            abortController.abort();
            timers.forEach(id => clearTimeout(id));
            timers.clear();
            if (resizeTooltip.isConnected) {
                resizeTooltip.remove();
            }
        }
    };

    if (syscall) {
        syscall.onMessage = appHandle.onMessage;
    }

    return appHandle;
}