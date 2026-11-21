//spreadsheet.js
import { FS, forceSave, lockFile, unlockFile, setBulkUpdating } from "../../../fs.js";
import { getFileContent } from "../../../fs-db.js";
import { resolveFS, normalizePath, basename, validateName, isSystemMetaKey } from "../../../fs-utils.js";
import { attachContextMenu, hideContextMenu } from "../../../context-menu.js";

import { injectScopedStyles } from "./styles.js";
import { SPREADSHEET_TEMPLATE_HTML } from "./template.js";
import {
    EXCEL_EPOCH_MS,
    dateToSerial,
    serialToDate,
    tryParseDateToSerial,
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
    escapeHtml,
    getColumnName,
    columnLettersToIndex,
    getCellReference,
    getCellReferenceByCoord,
    isDateFormat,
    formatDate,
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
        const fileName = currentFilePath ? basename(currentFilePath) : "無題.nxs";
        const dirtyMark = isDirty ? " *" : "";
        const parts = [
            `状態: ${statusBarState.stateText}`,
            statusBarState.selectionText,
            `ファイル: ${fileName}${dirtyMark}`,
            `用紙: ${currentPageSize}`
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

    const INITIAL_ROWS = 80;
    const ROW_BATCH = 40;
    const INITIAL_COLUMNS = 40;
    const COLUMN_BATCH = 15;

    let currentColumns = 0;
    let rowCount = 1;
    let activeCell = null;
    let isSelecting = false;
    let selectionStart = null;
    let selectionEnd = null;
    let isComposing = false;
    let clipboardData = null;
    let formatPainterSnapshot = null;
    let undoHistory = [];
    let redoHistory = [];
    let saveStateTimeout = null;

    // FS連携用状態
    let currentFilePath = null;
    let lockedFilePath = null;
    let isDirty = false;
    let currentPageSize = "A4";
    let freezeRows = 0;
    let freezeCols = 0;

    const timers = new Set();
    function managedTimeout(fn, delay) {
        const id = setTimeout(() => {
            timers.delete(id);
            fn();
        }, delay);
        timers.add(id);
        return id;
    }

    function setDirtyState(dirty) {
        isDirty = Boolean(dirty);
        const titleBase = currentFilePath ? basename(currentFilePath) : "無題.nxs";
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

    let findWin = null;
    let findDialogOpen = false;

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
        if (findWin && findWin.contains(document.activeElement)) return false;
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
            freezeRows: 0,
            freezeCols: 0,
            textboxes: [],
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
                            backgroundSheetIndexCache.delete(s);
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
        captureCurrentSheetDOM({ flush: true });
        activeSheetIndex = targetIndex;
        await applySingleSheetToDOM(sheets[activeSheetIndex], { isUndoRedo: true });
        updateAllFormulas();
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

    if (sheetTabsListEl) {
        attachContextMenu(sheetTabsListEl, (e) => {
            const tabEl = e.target.closest(".ss-sheet-tab");
            const idx = tabEl ? parseInt(tabEl.dataset.sheetIndex, 10) : activeSheetIndex;
            return [
                { label: "新しいシートを挿入", action: () => void addNewSheet(idx) },
                { label: "名前の変更...", action: () => renameSheetDialog(idx) },
                { label: "シートを複製", action: () => void duplicateSheet(idx) },
                { label: "---" },
                { label: "左へ移動", action: () => moveSheet(idx, -1), disabled: idx <= 0 },
                { label: "右へ移動", action: () => moveSheet(idx, 1), disabled: idx >= sheets.length - 1 },
                { label: "---" },
                { label: "シートを削除", action: () => deleteSheet(idx), disabled: sheets.length <= 1 }
            ];
        });
    }



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
        if (saveStateTimeout) {
            clearTimeout(saveStateTimeout);
            saveStateTimeout = null;
        }
        resizeTooltip.remove();
        inlineMiniToolbar?.remove?.();
        document.querySelectorAll(".ss-filter-dropdown").forEach(el => el.remove());
        closeCellDropdownList();
        closeAutocompletePopup();
        hideDataValidationTooltip();
        timers.forEach(id => clearTimeout(id));
        timers.clear();
        if (findWin) {
            if (windowAPI?.destroyWindow) {
                windowAPI.destroyWindow(findWin);
            } else {
                findWin.remove();
            }
            findWin = null;
            findDialogOpen = false;
        }
        if (lockedFilePath) {
            unlockFile(lockedFilePath, lockOwnerPid);
            lockedFilePath = null;
        }
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
            total += Number.isNaN(w) ? 120 : w;
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

        const theadHeight = theadRow.offsetHeight || 30;
        const rowHeaderWidth = parseInt(colgroup.children[0]?.style.width, 10) || 54;

        const rowTopOffsets = [];
        let accTop = theadHeight;
        for (let r = 1; r <= freezeRows; r++) {
            rowTopOffsets[r] = accTop;
            const tr = getRow(r);
            if (!tr || tr.style.display === "none") continue;
            accTop += parseInt(tr.style.height, 10) || tr.offsetHeight || 30;
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
        if (!colEl) return 120;
        const w = parseInt(colEl.style.width, 10);
        return Number.isNaN(w) ? 120 : w;
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
            const fSize = cell.style.fontSize || "14px";
            const fSizeNum = parseInt(fSize, 10) || 14;
            const fFamily = cell.style.fontFamily || "'MS PGothic', 'MS Gothic', sans-serif";
            const isVertical = cell.style.writingMode === "vertical-rl" || cell.style.writingMode === "vertical-lr";
            const lines = text.split("\n");

            if (isVertical) {
                const colW = lines.length * Math.ceil(fSizeNum * 1.35) + 18;
                maxWidth = Math.max(maxWidth, colW);
                continue;
            }
            if (measureCtx) {
                measureCtx.font = `${fStyle} ${fWeight} ${fSize} ${fFamily}`;
            }
            for (const line of lines) {
                const textW = measureCtx
                    ? measureCtx.measureText(line).width
                    : line.length * fSizeNum;
                maxWidth = Math.max(maxWidth, Math.ceil(textW) + 18);
            }
        }
        const finalWidth = hasContent ? Math.min(600, Math.max(40, maxWidth)) : 120;
        setColumnWidth(colIndex, finalWidth);
    }

    function autoFitRow(tr) {
        if (!tr) return;
        let maxHeight = 30;
        for (let i = 1; i < tr.cells.length; i++) {
            const cell = tr.cells[i];
            if (!cell || cell.style.display === "none") continue;
            if (parseInt(cell.getAttribute("rowspan") || "1", 10) > 1) continue;

            const fStyle = cell.style.fontStyle || "normal";
            const fWeight = cell.style.fontWeight || "normal";
            const fSize = parseInt(cell.style.fontSize, 10) || 14;
            const fFamily = cell.style.fontFamily || "'MS PGothic', 'MS Gothic', sans-serif";
            const lineHeight = Math.ceil(fSize * 1.35);
            const text = cell.textContent || "";
            const lines = text.split("\n");
            const isVertical = cell.style.writingMode === "vertical-rl" || cell.style.writingMode === "vertical-lr";

            if (isVertical && text !== "") {
                const maxChars = Math.max(1, ...lines.map(l => Array.from(l).length));
                const vertH = maxChars * Math.ceil(fSize * 1.15) + 16;
                maxHeight = Math.max(maxHeight, Math.min(600, vertH));
                continue;
            }

            let totalLines = lines.length;
            if (cell.style.whiteSpace === "pre-wrap" && text !== "") {
                if (measureCtx) {
                    measureCtx.font = `${fStyle} ${fWeight} ${fSize}px ${fFamily}`;
                }
                const colW = Math.max(24, getColumnWidth(i - 1) - 10);
                totalLines = 0;
                for (const line of lines) {
                    const lineW = measureCtx ? measureCtx.measureText(line).width : line.length * fSize;
                    totalLines += Math.max(1, Math.ceil(lineW / colW));
                }
            }
            maxHeight = Math.max(maxHeight, totalLines * lineHeight + 10);
        }
        tr.style.height = maxHeight <= 30 ? "" : `${maxHeight}px`;
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
                    colEl.dataset.prevWidth = colEl.style.width || "120px";
                }
                colEl.style.width = "0px";
                thEl.classList.add("ss-col-hidden");
                for (const tr of tbody.rows) tr.cells[c + 1]?.classList.add("ss-col-hidden");
            } else {
                colEl.style.width = colEl.dataset.prevWidth || "120px";
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
            : (getRow(targets[0])?.offsetHeight || 30);

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
            const startHeight = tr.offsetHeight || 30;
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
            colEl.style.width = "120px";
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
            cachedTableWidth += count * 120;
            table.style.width = `${cachedTableWidth}px`;
            spreadsheetContent.style.width = `${cachedTableWidth}px`;
        } else {
            syncTableWidth();
        }
        if (freezeRows > 0) {
            const theadHeight = theadRow.offsetHeight || 30;
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
                accTop += parseInt(tr.style.height, 10) || tr.offsetHeight || 30;
            }
        }
    }

    function applyFreezeToRowsRange(startRowIndex) {
        if (freezeCols <= 0) return;
        const rowHeaderWidth = parseInt(colgroup.children[0]?.style.width, 10) || 54;
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
    // 数式評価エンジン（$絶対参照・複合参照・大小文字対応）
    // =========================================================
    const RANGE_REF_REGEX = /(?<![A-Za-z0-9_])(\$?[A-Za-z]+\$?\d+:\$?[A-Za-z]+\$?\d+)/g;
    const SINGLE_REF_REGEX = /(?<![A-Za-z0-9_])(\$?)([A-Za-z]+)(\$?)(\d+)(?!\s*\()/g;

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
            syncCellHyperlinkVisual(cell);
            return;
        }
        if (cell.dataset.quotePrefix === "1") {
            cell.dataset.rawValue = rawStr;
            setCellTextPreservingControls(cell, rawStr);
            cell.classList.remove("ss-auto-align-right", "ss-auto-align-center");
            syncCellHyperlinkVisual(cell);
            return;
        }
        const fmt = cell.dataset.numFormat;
        if (fmt && fmt !== "general" && !rawStr.startsWith("#")) {
            const parsed = parseFormattedNumber(rawStr);
            cell.dataset.rawValue = !isNaN(parsed) ? String(parsed) : rawStr;
        } else {
            cell.dataset.rawValue = rawStr;
        }
        setCellTextPreservingControls(cell, formatDisplayByNumFmt(cell.dataset.rawValue, fmt, cell));
        updateCellAutoAlignment(cell, cell.dataset.rawValue);
        syncCellHyperlinkVisual(cell);
    }

    function toJSValueLiteral(val, blankAsZero = false, stringLiterals = null) {
        const pushStr = (quotedStr) => {
            if (!stringLiterals) return quotedStr;
            const token = `__STR_LIT_${stringLiterals.length}__`;
            stringLiterals.push(quotedStr);
            return token;
        };
        if (isBlankVal(val)) return blankAsZero ? "EXCEL_BLANK_CELL" : pushStr('""');
        if (typeof val === "boolean") return val ? "true" : "false";
        if (typeof val === "number") return isFinite(val) ? String(val) : "0";
        return pushStr(JSON.stringify(String(val)));
    }

    const backgroundSheetIndexCache = new WeakMap();

    function getBackgroundSheetCellMap(sheetObj) {
        let map = backgroundSheetIndexCache.get(sheetObj);
        if (!map) {
            map = new Map();
            if (Array.isArray(sheetObj?.cells)) {
                for (let i = 0; i < sheetObj.cells.length; i++) {
                    const item = sheetObj.cells[i];
                    map.set(`${Number(item.r)},${Number(item.c)}`, item);
                }
            }
            backgroundSheetIndexCache.set(sheetObj, map);
        }
        return map;
    }

    const compiledFormulaCache = new Map();
    const formulaEvalCache = new Map();
    let isBatchRecalculating = false;

    function getSheetCellValue(sheetIdx, row, col, visited = new Set()) {
        const cellKey = `${sheetIdx}:${row},${col}`;
        if (isBatchRecalculating && formulaEvalCache.has(cellKey)) {
            return formulaEvalCache.get(cellKey);
        }

        if (sheetIdx === activeSheetIndex || !sheets[sheetIdx]) {
            const cell = peekCell(row, col);
            if (!cell) return "";
            if (cell.dataset.formula) {
                if (visited.has(cellKey)) return "#CIRCULAR!";
                visited.add(cellKey);
                try {
                    const evaluated = evaluateFormula(cell.dataset.formula, visited, sheetIdx, { row, col });
                    if (evaluated === "#CIRCULAR!") return "#CIRCULAR!";
                    if (Array.isArray(evaluated) || typeof evaluated === "boolean") {
                        if (isBatchRecalculating) formulaEvalCache.set(cellKey, evaluated);
                        return evaluated;
                    }
                    const dateSerial = tryParseDateToSerial(evaluated);
                    const finalVal = dateSerial !== null
                        ? dateSerial
                        : ((evaluated !== "" && !isNaN(Number(evaluated))) ? Number(evaluated) : evaluated);
                    if (isBatchRecalculating) formulaEvalCache.set(cellKey, finalVal);
                    return finalVal;
                } finally {
                    visited.delete(cellKey);
                }
            }
            const contentStr = (cell.dataset.rawValue ?? cell.textContent).trim();
            if (contentStr === "") return "";
            if (cell.dataset.quotePrefix === "1") return cell.dataset.rawValue ?? cell.textContent;
            const upperStr = contentStr.toUpperCase();
            if (upperStr === "TRUE") return true;
            if (upperStr === "FALSE") return false;
            const dateSerial = tryParseDateToSerial(contentStr);
            if (dateSerial !== null) return dateSerial;
            const num = parseCellNumericLiteral(contentStr);
            return isNaN(num) ? contentStr : num;
        }

        const targetSheet = sheets[sheetIdx];
        const entry = getBackgroundSheetCellMap(targetSheet).get(`${row},${col}`);
        if (!entry) return "";
        if (entry.f) {
            if (visited.has(cellKey)) return "#CIRCULAR!";
            visited.add(cellKey);
            try {
                const evaluated = evaluateFormula(entry.f, visited, sheetIdx, { row, col });
                if (evaluated === "#CIRCULAR!") return "#CIRCULAR!";
                if (Array.isArray(evaluated) || typeof evaluated === "boolean") {
                    if (isBatchRecalculating) formulaEvalCache.set(cellKey, evaluated);
                    return evaluated;
                }
                const dateSerial = tryParseDateToSerial(evaluated);
                const finalVal = dateSerial !== null
                    ? dateSerial
                    : ((evaluated !== "" && !isNaN(Number(evaluated))) ? Number(evaluated) : evaluated);
                if (isBatchRecalculating) formulaEvalCache.set(cellKey, finalVal);
                return finalVal;
            } finally {
                visited.delete(cellKey);
            }
        }
        const raw = String(entry.v ?? "").trim();
        if (raw === "") return "";
        if (entry.qp) return String(entry.v ?? "");
        const upperRaw = raw.toUpperCase();
        if (upperRaw === "TRUE") return true;
        if (upperRaw === "FALSE") return false;
        const dateSerial = tryParseDateToSerial(raw);
        if (dateSerial !== null) return dateSerial;
        const num = parseCellNumericLiteral(raw);
        return isNaN(num) ? raw : num;
    }

    function getCellEvaluatedValue(cell, visited = new Set()) {
        if (!cell) return "";
        return getSheetCellValue(activeSheetIndex, parseInt(cell.dataset.row, 10), parseInt(cell.dataset.col, 10), visited);
    }

    function buildRange2DLiteral(sheetIdx, startRef, endRef, visited, excludeHiddenRows = false, stringLiterals = null) {
        const startMatch = startRef?.match(/^\$?([A-Za-z]+)\$?(\d+)$/);
        const endMatch = endRef?.match(/^\$?([A-Za-z]+)\$?(\d+)$/);
        if (!startMatch || !endMatch) return "[]";

        const startCol = columnLettersToIndex(startMatch[1]);
        const startRow = parseInt(startMatch[2], 10);
        const endCol = columnLettersToIndex(endMatch[1]);
        const endRow = parseInt(endMatch[2], 10);

        let maxR = rowCount - 1;
        let maxC = currentColumns - 1;
        if (sheetIdx !== activeSheetIndex && Array.isArray(sheets[sheetIdx]?.cells)) {
            for (const item of sheets[sheetIdx].cells) {
                const ir = Number(item.r) || 0;
                const ic = Number(item.c) || 0;
                if (ir > maxR) maxR = ir;
                if (ic > maxC) maxC = ic;
            }
        }
        const rStart = Math.min(startRow, endRow);
        const rEnd = Math.min(Math.max(startRow, endRow), maxR);
        const cStart = Math.min(startCol, endCol);
        const cEnd = Math.min(Math.max(startCol, endCol), maxC);
        const matrix = [];
        for (let r = rStart; r <= rEnd; r++) {
            if (excludeHiddenRows && sheetIdx === activeSheetIndex) {
                const tr = getRow(r);
                if (tr && tr.style.display === "none") continue;
            }
            const rowVals = [];
            for (let c = cStart; c <= cEnd; c++) {
                const val = getSheetCellValue(sheetIdx, r, c, visited);
                rowVals.push(toJSValueLiteral(val, false, stringLiterals));
            }
            matrix.push(`[${rowVals.join(",")}]`);
        }
        return `[${matrix.join(",")}]`;
    }

    const CROSS_SHEET_RANGE_REGEX = /(?:'([^']+)'|([A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+))!(\$?[A-Za-z]+\$?\d+):(\$?[A-Za-z]+\$?\d+)/g;
    const CROSS_SHEET_CELL_REGEX = /(?:'([^']+)'|([A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+))!(\$?[A-Za-z]+\$?\d+)/g;

    function evaluateFormula(formula, visited = new Set(), contextSheetIdx = activeSheetIndex, evalCoord = null) {
        if (!formula) return formula;
        if (formula === "=") return "=";
        if (formula[0] !== "=") return formula;

        let expr = formula.substring(1).trim();
        if (!expr) return "=";

        try {
            // 1. 最優先で文字列リテラルを退避し、内部の "=", "<>", "%" 等が破壊されるのを防ぐ
            const stringLiterals = [];
            expr = expr.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'(?!\s*!)/g, (m) => {
                const token = `__STR_LIT_${stringLiterals.length}__`;
                stringLiterals.push(m);
                return token;
            });

            expr = preprocessAllNestedIFs(expr);

            expr = resolveStructuredReferences(expr, contextSheetIdx);
            if (typeof definedNames === "object" && definedNames) {
                const nameEntries = Object.entries(definedNames).sort((a, b) => b[0].length - a[0].length);
                for (const [dName, dRef] of nameEntries) {
                    const escaped = dName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                    const re = new RegExp(`(?<![A-Za-z0-9_\\u3040-\\u30FF\\u4E00-\\u9FAF$!])${escaped}(?![A-Za-z0-9_\\u3040-\\u30FF\\u4E00-\\u9FAF(])`, "g");
                    expr = expr.replace(re, dRef);
                }
            }

            // Excelの演算子優先順位（比較 < & < 四則）と等価比較（__XL_EQ）への変換
            const convertExcelConcat = (src) => {
                // 1. まず括弧 (...) 内部を再帰変換（関数引数のカンマ境界を破壊しない）
                let resolved = "";
                for (let i = 0; i < src.length; i++) {
                    if (src[i] === "(") {
                        let depth = 1;
                        let j = i + 1;
                        while (j < src.length && depth > 0) {
                            if (src[j] === "(") depth++;
                            else if (src[j] === ")") depth--;
                            j++;
                        }
                        const inner = src.slice(i + 1, j - 1);
                        // カンマ区切り（関数引数）ごとに独立して変換
                        const args = [];
                        let argBuf = "";
                        let d = 0;
                        for (let k = 0; k < inner.length; k++) {
                            const c = inner[k];
                            if (c === "(") d++;
                            else if (c === ")") d = Math.max(0, d - 1);
                            if (c === "," && d === 0) {
                                args.push(convertExcelConcat(argBuf));
                                argBuf = "";
                            } else {
                                argBuf += c;
                            }
                        }
                        args.push(convertExcelConcat(argBuf));
                        resolved += `(${args.join(",")})`;
                        i = j - 1;
                    } else {
                        resolved += src[i];
                    }
                }

                // 2. トップレベルの比較演算子で分割し、各辺ごとに & を CONCAT(...) に変換
                const cmpSegments = [];
                let seg = "";
                let depth = 0;
                for (let i = 0; i < resolved.length; i++) {
                    const ch = resolved[i];
                    if (ch === "(") depth++;
                    else if (ch === ")") depth = Math.max(0, depth - 1);
                    if (depth === 0) {
                        const two = resolved.slice(i, i + 2);
                        if (two === ">=" || two === "<=" || two === "<>" || two === "==" || two === "!=") {
                            cmpSegments.push({ text: seg, op: two });
                            seg = "";
                            i++;
                            continue;
                        }
                        if (ch === "=" || ch === "<" || ch === ">") {
                            cmpSegments.push({ text: seg, op: ch });
                            seg = "";
                            continue;
                        }
                    }
                    seg += ch;
                }
                cmpSegments.push({ text: seg, op: "" });

                const convertAmp = (exprPart) => {
                    const parts = [];
                    let buf = "";
                    let d = 0;
                    for (let i = 0; i < exprPart.length; i++) {
                        const c = exprPart[i];
                        if (c === "(") d++;
                        else if (c === ")") d = Math.max(0, d - 1);
                        if (c === "&" && exprPart[i + 1] !== "&" && exprPart[i - 1] !== "&" && d === 0) {
                            parts.push(buf.trim());
                            buf = "";
                        } else {
                            buf += c;
                        }
                    }
                    parts.push(buf.trim());
                    return parts.length > 1 ? `CONCAT(${parts.join(", ")})` : exprPart;
                };

                if (cmpSegments.length === 2) {
                    const op = cmpSegments[0].op;
                    const lhs = convertAmp(cmpSegments[0].text).trim();
                    const rhs = convertAmp(cmpSegments[1].text).trim();
                    if (lhs !== "" && rhs !== "") {
                        if (op === "=" || op === "==") return `__XL_OP("==", ${lhs}, ${rhs})`;
                        if (op === "<>" || op === "!=") return `__XL_OP("!=", ${lhs}, ${rhs})`;
                    }
                }

                return cmpSegments.map(s => convertAmp(s.text) + s.op).join("");
            };

            // 列全体参照 ($A:$C)・行全体参照 ($1:$5) をシート使用範囲へ展開する補助関数
            const expandWholeAxisRefs = (src) => {
                const maxUsedRow = Math.max(1, tbody.rows.length);
                const maxUsedCol = Math.max(0, currentColumns - 1);
                const maxColName = getColumnName(maxUsedCol);
                // 列全体参照（例: A:C, $B:$B）
                let out = src.replace(/(?<![A-Za-z0-9_:])(\$?[A-Za-z]+):(\$?[A-Za-z]+)(?![A-Za-z0-9_(])/g, (_, c1, c2) => {
                    return `${c1}1:${c2}${maxUsedRow}`;
                });
                // 行全体参照（例: 1:3, $2:$2）
                out = out.replace(/(?<![A-Za-z0-9_:])(\$?\d+):(\$?\d+)(?![A-Za-z0-9_])/g, (_, r1, r2) => {
                    return `A${r1}:${maxColName}${r2}`;
                });
                return out;
            };

            // Excel仕様: 単項マイナスはべき乗(^)より高優先 (-2^2 === 4)
            const normalizeExcelPower = (src) => {
                return src
                    .replace(/(^|[(\[,+\-*/=<>!&])\s*(-\s*(?:\d+(?:\.\d+)?|\$?[A-Za-z]+\$?\d+|\([^()]+\)))\s*\^/g, "$1($2)**")
                    .replace(/\^/g, "**");
            };

            // Excel演算子・リテラル・関数名の大文字正規化
            expr = expandWholeAxisRefs(convertExcelConcat(expr));
            expr = normalizeExcelPower(expr)
                .replace(/<>/g, "!=")
                .replace(/(?<![<>!=])=(?!=)/g, "==")
                .replace(/(\d+(?:\.\d+)?|\$?[A-Za-z]+\$?\d+|\([^()]+\))%/g, "($1/100)")
                .replace(/\bTRUE\b/gi, "true")
                .replace(/\bFALSE\b/gi, "false")
                .replace(/\b([A-Za-z_][A-Za-z0-9_.]*)\s*(?=\()/g, (_, fn) => fn.toUpperCase().replace(/\./g, "_"));

            // ROW() / COLUMN() の座標解決（セル参照の値展開より先に処理）
            expr = expr
                .replace(/\bROW\s*\(\s*\)/g, () => String(evalCoord?.row ?? 1))
                .replace(/\bCOLUMN\s*\(\s*\)/g, () => String((evalCoord?.col ?? 0) + 1))
                .replace(/\bROW\s*\(\s*(?:(?:'[^']+'|[A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+)!)?\$?[A-Za-z]+\$?(\d+)(?::\$?[A-Za-z]+\$?\d+)?\s*\)/g, (_, r) => String(parseInt(r, 10)))
                .replace(/\bCOLUMN\s*\(\s*(?:(?:'[^']+'|[A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+)!)?\$?([A-Za-z]+)\$?\d+(?::\$?[A-Za-z]+\$?\d+)?\s*\)/g, (_, colL) => String(columnLettersToIndex(colL) + 1));

            // OFFSET の第1引数がセル/範囲参照の場合、値展開される前に座標オブジェクト __XL_REF(...) へ変換
            const rewriteOffsetFirstArg = (src) => {
                let out = "";
                let i = 0;
                while (i < src.length) {
                    const rest = src.slice(i);
                    const m = rest.match(/^OFFSET\s*\(/);
                    if (m && (i === 0 || !/[A-Za-z0-9_$]/.test(src[i - 1]))) {
                        const openEnd = i + m[0].length;
                        let pos = openEnd;
                        let depth = 1;
                        let firstComma = -1;
                        while (pos < src.length && depth > 0) {
                            const ch = src[pos];
                            if (ch === "(") depth++;
                            else if (ch === ")") depth--;
                            else if (ch === "," && depth === 1 && firstComma === -1) firstComma = pos;
                            pos++;
                        }
                        if (depth !== 0) {
                            out += src[i++];
                            continue;
                        }
                        const argEnd = firstComma !== -1 ? firstComma : pos - 1;
                        const firstArg = src.slice(openEnd, argEnd).trim();
                        const tail = src.slice(argEnd, pos);

                        const refMatch = firstArg.match(
                            /^(?:(?:'([^']+)'|([A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+))!)?\$?([A-Za-z]+)\$?(\d+)(?::\$?([A-Za-z]+)\$?(\d+))?$/
                        );
                        if (refMatch) {
                            const sName = refMatch[1] ?? refMatch[2];
                            const sIdx = sName ? sheets.findIndex(s => s.name === sName) : contextSheetIdx;
                            const c1 = columnLettersToIndex(refMatch[3]);
                            const r1 = parseInt(refMatch[4], 10);
                            const c2 = refMatch[5] ? columnLettersToIndex(refMatch[5]) : c1;
                            const r2 = refMatch[6] ? parseInt(refMatch[6], 10) : r1;
                            const minR = Math.min(r1, r2), maxR = Math.max(r1, r2);
                            const minC = Math.min(c1, c2), maxC = Math.max(c1, c2);
                            out += `OFFSET(__XL_REF(${sIdx},${minR},${minC},${maxR},${maxC})${rewriteOffsetFirstArg(tail)}`;
                        } else {
                            out += `OFFSET(${rewriteOffsetFirstArg(firstArg)}${rewriteOffsetFirstArg(tail)}`;
                        }
                        i = pos;
                    } else {
                        out += src[i++];
                    }
                }
                return out;
            };
            if (/\bOFFSET\s*\(/.test(expr)) {
                expr = rewriteOffsetFirstArg(expr);
            }

            // 他シート範囲参照（例: Sheet2!A1:C5 / '売上表'!A1:C5）
            expr = expr.replace(CROSS_SHEET_RANGE_REGEX, (_, qName, plainName, sRef, eRef) => {
                const sName = qName ?? plainName;
                const sIdx = sheets.findIndex(s => s.name === sName);
                if (sIdx === -1) return `[[${toJSValueLiteral("#REF!", false, stringLiterals)}]]`;
                return buildRange2DLiteral(sIdx, sRef, eRef, visited, false, stringLiterals);
            });

            // 他シート単一セル参照（例: Sheet2!B3）
            expr = expr.replace(CROSS_SHEET_CELL_REGEX, (_, qName, plainName, cellRef) => {
                const sName = qName ?? plainName;
                const sIdx = sheets.findIndex(s => s.name === sName);
                if (sIdx === -1) return toJSValueLiteral("#REF!", false, stringLiterals);
                const m = cellRef.match(/^\$?([A-Za-z]+)\$?(\d+)$/);
                if (!m) return toJSValueLiteral("#REF!", false, stringLiterals);
                const val = getSheetCellValue(sIdx, parseInt(m[2], 10), columnLettersToIndex(m[1]), visited);
                return toJSValueLiteral(val, true, stringLiterals);
            });

            // 自シート範囲参照：SUBTOTAL/AGGREGATEの引数内にある範囲のみ非表示行を除外
            const isInsideSubtotalCall = (src, offset) => {
                let depth = 0;
                for (let i = offset - 1; i >= 0; i--) {
                    const ch = src[i];
                    if (ch === ")") depth++;
                    else if (ch === "(") {
                        if (depth === 0) {
                            const before = src.slice(Math.max(0, i - 16), i);
                            return /\b(SUBTOTAL|AGGREGATE)\s*$/i.test(before);
                        }
                        depth--;
                    }
                }
                return false;
            };
            expr = expr.replace(RANGE_REF_REGEX, (match, _g1, offset, fullStr) => {
                const [startRef, endRef] = match.split(":");
                const excludeHidden = isInsideSubtotalCall(fullStr, offset);
                return buildRange2DLiteral(contextSheetIdx, startRef, endRef, visited, excludeHidden, stringLiterals);
            });

            // 自シート単一セル参照
            expr = expr.replace(SINGLE_REF_REGEX, (_, _absC, colLetters, _absR, rowStr) => {
                const colIndex = columnLettersToIndex(colLetters);
                const rowNumber = parseInt(rowStr, 10);
                const val = getSheetCellValue(contextSheetIdx, rowNumber, colIndex, visited);
                return toJSValueLiteral(val, true, stringLiterals);
            });

            // 配列同士・配列とスカラーの四則/比較/単項演算を要素ごと演算 (__XL_OP / __XL_U) に書き換え
            const rewriteArrayOps = (src) => {
                const tokens = [];
                const tokenRe = /\s*(?:(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)|([A-Za-z_$][A-Za-z0-9_$]*)|("(?:\\.|[^"\\])*")|(\*\*|<=|>=|==|!=|[()[\],+\-*/<>!]))/y;
                let lastIdx = 0;
                while (lastIdx < src.length) {
                    const restWs = src.slice(lastIdx).match(/^\s+$/);
                    if (restWs) break;
                    tokenRe.lastIndex = lastIdx;
                    const m = tokenRe.exec(src);
                    if (!m) return src;
                    if (m[1] !== undefined) tokens.push({ type: "num", val: m[1] });
                    else if (m[2] !== undefined) tokens.push({ type: "id", val: m[2] });
                    else if (m[3] !== undefined) tokens.push({ type: "str", val: m[3] });
                    else tokens.push({ type: "op", val: m[4] });
                    lastIdx = tokenRe.lastIndex;
                }
                if (!tokens.length) return src;

                let idx = 0;
                let failed = false;
                const peek = () => tokens[idx] || null;
                const consume = () => tokens[idx++];

                const parseExpr = () => parseComparison();

                const parseComparison = () => {
                    let left = parseAdditive();
                    while (peek() && peek().type === "op" && ["==", "!=", "<", "<=", ">", ">="].includes(peek().val)) {
                        const op = consume().val;
                        const right = parseAdditive();
                        left = `__XL_OP("${op}",${left},${right})`;
                    }
                    return left;
                };

                const parseAdditive = () => {
                    let left = parseMultiplicative();
                    while (peek() && peek().type === "op" && (peek().val === "+" || peek().val === "-")) {
                        const op = consume().val;
                        const right = parseMultiplicative();
                        left = `__XL_OP("${op}",${left},${right})`;
                    }
                    return left;
                };

                const parseMultiplicative = () => {
                    let left = parsePower();
                    while (peek() && peek().type === "op" && (peek().val === "*" || peek().val === "/")) {
                        const op = consume().val;
                        const right = parsePower();
                        left = `__XL_OP("${op}",${left},${right})`;
                    }
                    return left;
                };

                const parsePower = () => {
                    let left = parseUnary();
                    if (peek() && peek().type === "op" && peek().val === "**") {
                        consume();
                        const right = parsePower();
                        return `__XL_OP("**",${left},${right})`;
                    }
                    return left;
                };

                const parseUnary = () => {
                    if (peek() && peek().type === "op" && (peek().val === "-" || peek().val === "+" || peek().val === "!")) {
                        const op = consume().val;
                        const operand = parseUnary();
                        return `__XL_U("${op}",${operand})`;
                    }
                    return parsePrimary();
                };

                const parsePrimary = () => {
                    const tok = peek();
                    if (!tok) {
                        failed = true;
                        return "";
                    }
                    let node = "";
                    if (tok.type === "num" || tok.type === "id" || tok.type === "str") {
                        node = consume().val;
                    } else if (tok.type === "op" && tok.val === "(") {
                        consume();
                        const inner = parseExpr();
                        if (!peek() || peek().val !== ")") {
                            failed = true;
                            return "";
                        }
                        consume();
                        node = `(${inner})`;
                    } else if (tok.type === "op" && tok.val === "[") {
                        consume();
                        const elems = [];
                        if (peek() && peek().val !== "]") {
                            while (true) {
                                elems.push(parseExpr());
                                if (peek() && peek().val === ",") {
                                    consume();
                                    continue;
                                }
                                break;
                            }
                        }
                        if (!peek() || peek().val !== "]") {
                            failed = true;
                            return "";
                        }
                        consume();
                        node = `[${elems.join(",")}]`;
                    } else {
                        failed = true;
                        return "";
                    }

                    // 関数呼び出し（LAMBDA(...)(10, 25) のような連続呼び出しにも対応）
                    while (peek() && peek().type === "op" && peek().val === "(") {
                        consume();
                        const args = [];
                        if (peek() && peek().val !== ")") {
                            while (true) {
                                if (peek() && (peek().val === "," || peek().val === ")")) {
                                    args.push("undefined");
                                } else {
                                    args.push(parseExpr());
                                }
                                if (peek() && peek().val === ",") {
                                    consume();
                                    continue;
                                }
                                break;
                            }
                        }
                        if (!peek() || peek().val !== ")") {
                            failed = true;
                            return "";
                        }
                        consume();
                        node = `${node}(${args.join(",")})`;
                    }
                    return node;
                };

                const parsed = parseExpr();
                if (failed || idx !== tokens.length) return src;
                return parsed;
            };
            expr = rewriteArrayOps(expr);

            // LET / LAMBDA を安全なネスト式へ展開（Excel準拠：変数名の大文字小文字非区別）
            const BUILTIN_FN_SET = new Set(["INDIRECT", "OFFSET", ...FORMULA_FN_NAMES]);
            const splitTopLevelArgs = (inner) => {
                const args = [];
                let buf = "";
                let depth = 0;
                let sqDepth = 0;
                for (let k = 0; k < inner.length; k++) {
                    const ch = inner[k];
                    if (ch === "(") depth++;
                    else if (ch === ")") depth = Math.max(0, depth - 1);
                    else if (ch === "[") sqDepth++;
                    else if (ch === "]") sqDepth = Math.max(0, sqDepth - 1);
                    if (ch === "," && depth === 0 && sqDepth === 0) {
                        args.push(buf.trim());
                        buf = "";
                    } else {
                        buf += ch;
                    }
                }
                args.push(buf.trim());
                return args;
            };

            const replaceLocalVar = (code, rawName, safeName) => {
                const escaped = rawName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                const re = new RegExp(`(?<![A-Za-z0-9_$.])${escaped}(?![A-Za-z0-9_])`, "gi");
                return code.replace(re, (m, offset, full) => {
                    const after = full.slice(offset + m.length).trimStart();
                    if (after.startsWith("(") && BUILTIN_FN_SET.has(m.toUpperCase())) {
                        return m;
                    }
                    return safeName;
                });
            };

            const transformLetAndLambda = (src) => {
                let out = "";
                let i = 0;
                while (i < src.length) {
                    const rest = src.slice(i);
                    const fnMatch = rest.match(/^(LET|LAMBDA)\s*\(/);
                    if (fnMatch && (i === 0 || !/[A-Za-z0-9_$]/.test(src[i - 1]))) {
                        const fnName = fnMatch[1];
                        let pos = i + fnMatch[0].length;
                        let depth = 1;
                        while (pos < src.length && depth > 0) {
                            if (src[pos] === "(") depth++;
                            else if (src[pos] === ")") depth--;
                            pos++;
                        }
                        if (depth !== 0) return src;
                        const inner = src.slice(i + fnMatch[0].length, pos - 1);
                        const rawArgs = splitTopLevelArgs(inner);

                        if (fnName === "LET") {
                            if (rawArgs.length < 3 || rawArgs.length % 2 === 0) return '"#VALUE!"';
                            const pairs = [];
                            for (let p = 0; p < rawArgs.length - 1; p += 2) {
                                const varName = rawArgs[p].trim();
                                if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(varName)) return '"#NAME?"';
                                pairs.push({ name: varName, safe: `__LV_${varName.toUpperCase()}`, val: transformLetAndLambda(rawArgs[p + 1]) });
                            }
                            let bodyExpr = transformLetAndLambda(rawArgs[rawArgs.length - 1]);
                            for (let p = pairs.length - 1; p >= 0; p--) {
                                const { name, safe, val } = pairs[p];
                                bodyExpr = `((${safe}) => (${replaceLocalVar(bodyExpr, name, safe)}))(${val})`;
                            }
                            out += bodyExpr;
                        } else {
                            // LAMBDA(param1, [param2, ...], calculation)
                            if (rawArgs.length < 2) return '"#VALUE!"';
                            const params = rawArgs.slice(0, -1).map(p => p.trim());
                            if (params.some(p => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(p))) return '"#NAME?"';
                            let bodyExpr = transformLetAndLambda(rawArgs[rawArgs.length - 1]);
                            const safeParams = params.map(p => {
                                const safe = `__LV_${p.toUpperCase()}`;
                                bodyExpr = replaceLocalVar(bodyExpr, p, safe);
                                return safe;
                            });
                            out += `((${safeParams.join(", ")}) => (${bodyExpr}))`;
                        }
                        i = pos;
                    } else {
                        out += src[i];
                        i++;
                    }
                }
                return out;
            };

            if (/\b(LET|LAMBDA)\s*\(/.test(expr)) {
                expr = transformLetAndLambda(expr);
            }

            // 文字列リテラル復元前に、許可された識別子のみであることを検証（任意JS実行防止 & #NAME? 判定）
            const ALLOWED_IDENTIFIERS = new Set([
                "EXCEL_BLANK_CELL", "__XL_EQ", "__XL_OP", "__XL_U", "__XL_REF",
                "INDIRECT", "OFFSET", "true", "false", "undefined", ...FORMULA_FN_NAMES
            ]);
            const unsafeIdentMatch = expr.match(/\b[A-Za-z_$][A-Za-z0-9_$]*\b/g);
            if (unsafeIdentMatch) {
                for (const ident of unsafeIdentMatch) {
                    if (/^__STR_LIT_\d+__$/.test(ident) || /^__LV_[A-Z0-9_]+$/.test(ident)) continue;
                    if (!ALLOWED_IDENTIFIERS.has(ident)) {
                        return "#NAME?";
                    }
                }
            }

            expr = expr.replace(/__STR_LIT_(\d+)__/g, (_, idx) => stringLiterals[Number(idx)]);

            const makeXlRef = (sheetIdx, r1, c1, r2, c2) => ({ __isXlRef: true, sheetIdx, r1, c1, r2, c2 });

            const runtimeIndirect = (refText, a1 = true) => {
                const raw = String(unwrapBlank(refText) ?? "").trim();
                if (!raw) return "#REF!";
                const isA1 = typeof a1 === "string"
                    ? !["FALSE", "0"].includes(a1.trim().toUpperCase())
                    : Boolean(a1);
                if (!isA1) return "#REF!";

                const sheetSplit = raw.match(/^(?:(?:'([^']+)'|([A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+))!)?(.+)$/);
                if (!sheetSplit) return "#REF!";
                const sName = sheetSplit[1] ?? sheetSplit[2];
                const targetSIdx = sName ? sheets.findIndex(s => s.name === sName) : contextSheetIdx;
                if (targetSIdx < 0 || !sheets[targetSIdx]) return "#REF!";

                const body = sheetSplit[3].trim();
                let maxR = rowCount - 1;
                let maxC = currentColumns - 1;
                if (targetSIdx !== activeSheetIndex && Array.isArray(sheets[targetSIdx]?.cells)) {
                    for (const item of sheets[targetSIdx].cells) {
                        const ir = Number(item.r) || 0;
                        const ic = Number(item.c) || 0;
                        if (ir > maxR) maxR = ir;
                        if (ic > maxC) maxC = ic;
                    }
                }

                const buildMat = (r1, c1, r2, c2) => {
                    const rs = Math.min(r1, r2), re = Math.min(Math.max(r1, r2), maxR);
                    const cs = Math.min(c1, c2), ce = Math.min(Math.max(c1, c2), maxC);
                    const mat = [];
                    for (let r = rs; r <= re; r++) {
                        const rowVals = [];
                        for (let c = cs; c <= ce; c++) {
                            rowVals.push(getSheetCellValue(targetSIdx, r, c, visited));
                        }
                        mat.push(rowVals);
                    }
                    return mat;
                };

                const rangeM = body.match(/^\$?([A-Za-z]+)\$?(\d+):\$?([A-Za-z]+)\$?(\d+)$/);
                if (rangeM) {
                    return buildMat(
                        parseInt(rangeM[2], 10),
                        columnLettersToIndex(rangeM[1]),
                        parseInt(rangeM[4], 10),
                        columnLettersToIndex(rangeM[3])
                    );
                }

                const colRangeM = body.match(/^\$?([A-Za-z]+):\$?([A-Za-z]+)$/);
                if (colRangeM) {
                    return buildMat(1, columnLettersToIndex(colRangeM[1]), maxR, columnLettersToIndex(colRangeM[2]));
                }

                const rowRangeM = body.match(/^\$?(\d+):\$?(\d+)$/);
                if (rowRangeM) {
                    return buildMat(parseInt(rowRangeM[1], 10), 0, parseInt(rowRangeM[2], 10), maxC);
                }

                const cellM = body.match(/^\$?([A-Za-z]+)\$?(\d+)$/);
                if (cellM) {
                    const v = getSheetCellValue(targetSIdx, parseInt(cellM[2], 10), columnLettersToIndex(cellM[1]), visited);
                    return isBlankVal(v) ? EXCEL_BLANK_CELL : v;
                }

                return "#REF!";
            };

            const runtimeOffset = (refObj, rowOff, colOff, height = null, width = null) => {
                if (!refObj || !refObj.__isXlRef) return "#VALUE!";
                if (refObj.sheetIdx < 0 || !sheets[refObj.sheetIdx]) return "#REF!";
                const dr = Math.trunc(Number(unwrapBlank(rowOff)));
                const dc = Math.trunc(Number(unwrapBlank(colOff)));
                if (Number.isNaN(dr) || Number.isNaN(dc)) return "#VALUE!";

                const baseH = refObj.r2 - refObj.r1 + 1;
                const baseW = refObj.c2 - refObj.c1 + 1;
                const h = (height == null || isBlankVal(height)) ? baseH : Math.trunc(Number(unwrapBlank(height)));
                const w = (width == null || isBlankVal(width)) ? baseW : Math.trunc(Number(unwrapBlank(width)));
                if (Number.isNaN(h) || Number.isNaN(w)) return "#VALUE!";
                if (h === 0 || w === 0) return "#REF!";

                const anchorR = refObj.r1 + dr;
                const anchorC = refObj.c1 + dc;
                const rStart = h > 0 ? anchorR : anchorR + h + 1;
                const rEnd = h > 0 ? anchorR + h - 1 : anchorR;
                const cStart = w > 0 ? anchorC : anchorC + w + 1;
                const cEnd = w > 0 ? anchorC + w - 1 : anchorC;
                if (rStart < 1 || cStart < 0) return "#REF!";

                if (rStart === rEnd && cStart === cEnd) {
                    const v = getSheetCellValue(refObj.sheetIdx, rStart, cStart, visited);
                    return isBlankVal(v) ? EXCEL_BLANK_CELL : v;
                }
                const out = [];
                for (let r = rStart; r <= rEnd; r++) {
                    const rowVals = [];
                    for (let c = cStart; c <= cEnd; c++) {
                        rowVals.push(getSheetCellValue(refObj.sheetIdx, r, c, visited));
                    }
                    out.push(rowVals);
                }
                return out;
            };

            let evaluator = compiledFormulaCache.get(expr);
            if (!evaluator) {
                evaluator = new Function(
                    "EXCEL_BLANK_CELL",
                    "__XL_EQ",
                    "__XL_OP",
                    "__XL_U",
                    "__XL_REF",
                    "INDIRECT",
                    "OFFSET",
                    ...FORMULA_FN_NAMES,
                    `"use strict"; return (${expr});`
                );
                if (compiledFormulaCache.size > 2000) compiledFormulaCache.clear();
                compiledFormulaCache.set(expr, evaluator);
            }
            const rawEval = evaluator(
                EXCEL_BLANK_CELL,
                (a, b) => excelBinaryOp("==", a, b),
                excelBinaryOp,
                excelUnaryOp,
                makeXlRef,
                runtimeIndirect,
                runtimeOffset,
                ...FORMULA_FN_VALUES
            );
            let result = unwrapBlank(rawEval);
            if (typeof result === "number") {
                if (Number.isNaN(result)) return "#VALUE!";
                if (!Number.isFinite(result)) return "#DIV/0!";
                // Excel準拠：15桁有効数字で浮動小数点誤差（例: 1650.0000000000002 → 1650）を正規化
                result = Number(result.toPrecision(15));
                if (Object.is(result, -0)) result = 0;
            }
            if (result instanceof Date && !isNaN(result.getTime())) {
                return formatDate(result);
            }
            if (Array.isArray(result)) {
                return result;
            }
            const isDateCellAt = (sIdx, rNum, cIdx) => {
                if (sIdx === activeSheetIndex) {
                    const refCell = peekCell(rNum, cIdx);
                    return refCell?.dataset.valueType === "date" || isDateFormat((refCell?.dataset.rawValue ?? refCell?.textContent ?? "").trim());
                }
                if (sheets[sIdx]) {
                    const entry = getBackgroundSheetCellMap(sheets[sIdx]).get(`${rNum},${cIdx}`);
                    return entry?.vt === "date" || isDateFormat(String(entry?.v ?? "").trim());
                }
                return false;
            };

            const singleRefMatch = formula.trim().match(/^=(?:(?:'([^']+)'|([A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+))!)?\$?([A-Za-z]+)\$?(\d+)$/);
            let isDirectDateRef = false;
            if (singleRefMatch) {
                const refSheetName = singleRefMatch[1] ?? singleRefMatch[2];
                const targetSIdx = refSheetName ? sheets.findIndex(s => s.name === refSheetName) : contextSheetIdx;
                isDirectDateRef = isDateCellAt(targetSIdx, parseInt(singleRefMatch[4], 10), columnLettersToIndex(singleRefMatch[3]));
            }

            // 加減算結果が日付シリアル範囲のときは、実際に日付セルを参照している場合のみ日付化
            let hasDateCellRef = isDirectDateRef;
            if (!hasDateCellRef && typeof result === "number" && result >= 36526 && result <= 73050 && /[+-]/.test(expr)) {
                const stripped = formula.substring(1).replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'(?!\s*!)/g, "");
                const allRefRegex = /(?:(?:'([^']+)'|([A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+))!)?(?<![A-Za-z0-9_])\$?([A-Za-z]+)\$?(\d+)(?!\s*\()/g;
                let m;
                while ((m = allRefRegex.exec(stripped)) !== null) {
                    const sName = m[1] ?? m[2];
                    const sIdx = sName ? sheets.findIndex(s => s.name === sName) : contextSheetIdx;
                    if (sIdx >= 0 && isDateCellAt(sIdx, parseInt(m[4], 10), columnLettersToIndex(m[3]))) {
                        hasDateCellRef = true;
                        break;
                    }
                }
            }

            const returnsNumericDateInfo = /^\s*=\s*(YEAR|MONTH|DAY|HOUR|MINUTE|SECOND|WEEKDAY|DAYS|DATEDIF|NETWORKDAYS|DATEVALUE|TIMEVALUE)\s*\(/i.test(formula);
            const hasDateFunc = !returnsNumericDateInfo && /\b(TODAY|NOW|DATE|EDATE|EOMONTH|WORKDAY)\s*\(/i.test(formula);
            const hasDateOp = isDirectDateRef || hasDateFunc || hasDateCellRef;
            if (hasDateOp && typeof result === "number" && isFinite(result)) {
                return formatDate(serialToDate(result));
            }
            return typeof result === "function" ? "" : result;
        } catch {
            return "#ERROR!";
        }
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

        const formatAbsRange = (s, e) => {
            const r0 = Math.min(s.row, e.row);
            const r1 = Math.max(s.row, e.row);
            const c0 = Math.min(s.col, e.col);
            const c1 = Math.max(s.col, e.col);
            const startRef = `$${getColumnName(c0)}$${r0}`;
            const endRef = `$${getColumnName(c1)}$${r1}`;
            const refBody = (r0 === r1 && c0 === c1) ? startRef : `${startRef}:${endRef}`;
            if (allowCrossSheet && activeSheetIndex !== originSheetIdx) {
                const sName = sheets[activeSheetIndex]?.name || "";
                const prefix = /^[A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+$/.test(sName) ? `${sName}!` : `'${sName}'!`;
                return `=${prefix}${refBody}`;
            }
            return `=${refBody}`;
        };

        const resolvePickTd = (ev) => {
            const el = document.elementFromPoint(ev.clientX, ev.clientY);
            return el?.closest("td") || null;
        };

        const applyPickerHighlight = (s, e) => {
            const fullRef = formatAbsRange(s, e);
            highlightCalculationRange(fullRef.replace(/^=/, ""));
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
        openAppModal,
        openSheetRangePicker,
        parseRangeReference: (s) => parseRangeReference(s),
        parseCellReference: (s) => parseCellReference(s),
        setDirtyState,
        debouncedSaveState: () => debouncedSaveState()
    });

    function clearSpillCellsFromAnchor(anchorRow, anchorCol) {
        const originKey = `${anchorRow},${anchorCol}`;
        tbody.querySelectorAll(`td[data-spill-origin="${originKey}"]`).forEach(td => {
            delete td.dataset.spillOrigin;
            setCellFormattedValue(td, "");
        });
    }

    function applySpillMatrix(anchorCell, r0, c0, rawArray) {
        const matrix = Array.isArray(rawArray[0]) ? rawArray : rawArray.map(v => [v]);
        const rows = matrix.length;
        const cols = Math.max(1, ...matrix.map(r => (Array.isArray(r) ? r.length : 1)));
        const originKey = `${r0},${c0}`;

        // 展開先に既存データがある場合は #SPILL! エラー
        for (let dr = 0; dr < rows; dr++) {
            for (let dc = 0; dc < cols; dc++) {
                if (dr === 0 && dc === 0) continue;
                const target = getCell(r0 + dr, c0 + dc);
                if (!target) continue;
                const hasOtherVal = Boolean(target.dataset.formula) ||
                    (target.dataset.spillOrigin !== originKey && (target.dataset.rawValue ?? target.textContent).trim() !== "");
                if (hasOtherVal || target.style.display === "none") {
                    setCellFormattedValue(anchorCell, "#SPILL!");
                    return "#SPILL!";
                }
            }
        }

        for (let dr = 0; dr < rows; dr++) {
            for (let dc = 0; dc < cols; dc++) {
                const target = getCell(r0 + dr, c0 + dc);
                if (!target) continue;
                const val = Array.isArray(matrix[dr]) ? (matrix[dr][dc] ?? "") : (dc === 0 ? matrix[dr] : "");
                if (dr > 0 || dc > 0) {
                    target.dataset.spillOrigin = originKey;
                }
                setCellFormattedValue(target, val);
            }
        }
        return matrix[0]?.[0] ?? "";
    }

    function extractLocalFormulaDependencies(formula) {
        const deps = new Set();
        if (!formula || formula[0] !== "=") return deps;

        // 文字列リテラルと他シート参照（Sheet2!A1等）を除外して自シート参照のみ抽出
        const cleaned = formula
            .substring(1)
            .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'(?!\s*!)/g, "")
            .replace(/(?:'[^']+'|[A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+)!\$?[A-Za-z]+\$?\d+(?::\$?[A-Za-z]+\$?\d+)?/g, "");

        // 範囲参照（A1:B5）の展開
        const withoutRanges = cleaned.replace(RANGE_REF_REGEX, (match) => {
            const [sRef, eRef] = match.split(":");
            const s = parseCellReference(sRef.toUpperCase());
            const e = parseCellReference(eRef.toUpperCase());
            if (s && e) {
                const r0 = Math.min(s.row, e.row), r1 = Math.max(s.row, e.row);
                const c0 = Math.min(s.col, e.col), c1 = Math.max(s.col, e.col);
                if ((r1 - r0 + 1) * (c1 - c0 + 1) <= 2000) {
                    for (let r = r0; r <= r1; r++) {
                        for (let c = c0; c <= c1; c++) {
                            deps.add(`${r},${c}`);
                        }
                    }
                }
            }
            return " ";
        });

        // 単一セル参照（A1）の抽出
        withoutRanges.replace(SINGLE_REF_REGEX, (_, _absC, colLetters, _absR, rowStr) => {
            deps.add(`${parseInt(rowStr, 10)},${columnLettersToIndex(colLetters)}`);
            return "";
        });

        return deps;
    }

    function sortFormulaCellsTopologically(formulaCells) {
        const cellMap = new Map();
        for (const cell of formulaCells) {
            cellMap.set(`${cell.dataset.row},${cell.dataset.col}`, cell);
        }

        const visited = new Set();
        const visiting = new Set();
        const sorted = [];

        const visit = (key) => {
            if (visited.has(key) || visiting.has(key)) return;
            const cell = cellMap.get(key);
            if (!cell) return;

            visiting.add(key);
            const deps = extractLocalFormulaDependencies(cell.dataset.formula);
            for (const depKey of deps) {
                if (cellMap.has(depKey)) {
                    visit(depKey);
                }
            }
            visiting.delete(key);
            visited.add(key);
            sorted.push(cell);
        };

        for (const key of cellMap.keys()) {
            visit(key);
        }
        return sorted;
    }

    function updateAllFormulas() {
        formulaEvalCache.clear();
        isBatchRecalculating = true;
        try {
            const rawFormulaCells = Array.from(tbody.querySelectorAll("td[data-formula]"));
            const orderedCells = sortFormulaCellsTopologically(rawFormulaCells);

            orderedCells.forEach(cell => {
                if (isCellEditing(cell)) return
                const r = parseInt(cell.dataset.row, 10);
                const c = parseInt(cell.dataset.col, 10);
                clearSpillCellsFromAnchor(r, c);

                const cellKey = `${activeSheetIndex}:${r},${c}`;
                const visited = new Set([cellKey]);
                const rawResult = evaluateFormula(cell.dataset.formula, visited, activeSheetIndex, { row: r, col: c });


                if (Array.isArray(rawResult)) {
                    const topVal = applySpillMatrix(cell, r, c, rawResult);
                    formulaEvalCache.set(cellKey, topVal);
                } else {
                    const dateSerial = tryParseDateToSerial(rawResult);
                    const cachedVal = dateSerial !== null
                        ? dateSerial
                        : ((rawResult !== "" && !isNaN(Number(rawResult))) ? Number(rawResult) : rawResult);
                    formulaEvalCache.set(cellKey, cachedVal);
                    setCellFormattedValue(cell, rawResult);
                }
            });

            recalculateBackgroundSheets();
        } finally {
            isBatchRecalculating = false;
            formulaEvalCache.clear();
        }
        applyConditionalFormats();
        updateTextOverflowDisplay();
        updateAllFloatingCharts();
    }

    // =========================================================
    // ハイライト・数式参照オーバーレイ・1セル精度ドラッグ編集
    // =========================================================
    const FREF_PALETTE = [
        { hex: "#0070C0", rgb: "0, 112, 192" },
        { hex: "#C00000", rgb: "192, 0, 0" },
        { hex: "#7030A0", rgb: "112, 48, 160" },
        { hex: "#008000", rgb: "0, 128, 0" },
        { hex: "#E46C0A", rgb: "228, 108, 10" },
        { hex: "#008287", rgb: "0, 130, 135" },
        { hex: "#A61C50", rgb: "166, 28, 80" }
    ];

    const formulaRefLayer = document.createElement("div");
    formulaRefLayer.className = "ss-formula-ref-layer";
    spreadsheetContent.appendChild(formulaRefLayer);

    let currentFormulaRefTokens = [];
    let activeRefDragState = null;
    let lastHighlightedFormula = "";

    function clearCalculationRangeHighlights() {
        formulaRefLayer.innerHTML = "";
        currentFormulaRefTokens = [];
        lastHighlightedFormula = "";
    }

    function parseCellReference(ref) {
        const match = String(ref || "").match(/^\$?([A-Za-z]+)\$?(\d+)$/);
        if (!match) return null;
        return {
            col: columnLettersToIndex(match[1]),
            row: parseInt(match[2], 10)
        };
    }

    function parseRangeReference(rangeRef) {
        const parts = String(rangeRef || "").split(":");
        if (parts.length !== 2) return null;
        const start = parseCellReference(parts[0]);
        const end = parseCellReference(parts[1]);
        if (!start || !end) return null;
        return { start, end };
    }

    /**
     * 結合セルの有無に一切影響されない「1セル単位のグリッド軸座標」を構築
     */
    function buildGridAxisMetrics() {
        const zoom = parseFloat(spreadsheetContent.style.zoom || "1") || 1;
        const contentRect = spreadsheetContent.getBoundingClientRect();
        const rowHeaderW = theadRow.cells[0]?.offsetWidth || parseInt(colgroup.children[0]?.style.width, 10) || 54;
        const theadH = theadRow.offsetHeight || 30;
        const scrollShiftX = container.scrollLeft / zoom;
        const scrollShiftY = container.scrollTop / zoom;

        const cols = [];
        let accX = rowHeaderW;
        for (let c = 0; c < currentColumns; c++) {
            const th = theadRow.children[c + 1];
            const hidden = !th || th.classList.contains("ss-col-hidden");
            const w = hidden ? 0 : getColumnWidth(c);
            const left = (c < freezeCols) ? accX + scrollShiftX : accX;
            cols.push({ left, width: w, hidden });
            accX += w;
        }

        const rows = [];
        let accY = theadH;
        for (let r = 0; r < tbody.rows.length; r++) {
            const tr = tbody.rows[r];
            const hidden = !tr || tr.style.display === "none";
            const h = hidden ? 0 : (parseInt(tr.style.height, 10) || tr.offsetHeight || 30);
            const top = (r < freezeRows) ? accY + scrollShiftY : accY;
            rows.push({ top, height: h, hidden });
            accY += h;
        }

        return { zoom, contentRect, cols, rows };
    }

    function computeGridRangeRect(minR, minC, maxR, maxC, metrics) {
        if (!metrics.rows.length || !metrics.cols.length) return null;
        const r0 = Math.max(1, Math.min(minR, metrics.rows.length));
        const r1 = Math.max(r0, Math.min(maxR, metrics.rows.length));
        const c0 = Math.max(0, Math.min(minC, metrics.cols.length - 1));
        const c1 = Math.max(c0, Math.min(maxC, metrics.cols.length - 1));

        const sCol = metrics.cols[c0];
        const eCol = metrics.cols[c1];
        const sRow = metrics.rows[r0 - 1];
        const eRow = metrics.rows[r1 - 1];
        if (!sCol || !eCol || !sRow || !eRow) return null;

        return {
            left: sCol.left,
            top: sRow.top,
            width: Math.max(4, (eCol.left + eCol.width) - sCol.left),
            height: Math.max(4, (eRow.top + eRow.height) - sRow.top)
        };
    }

    /**
     * ポインタ位置から1セル単位の座標を逆引き（結合セル上でも1セル単位で精密追従）
     */
    function hitTestGridCoord(clientX, clientY, metrics = null) {
        const m = metrics || buildGridAxisMetrics();
        const x = (clientX - m.contentRect.left) / m.zoom;
        const y = (clientY - m.contentRect.top) / m.zoom;

        let col = m.cols.length - 1;
        for (let c = 0; c < m.cols.length; c++) {
            if (m.cols[c].hidden) continue;
            if (x < m.cols[c].left + m.cols[c].width) {
                col = c;
                break;
            }
            col = c;
        }

        let rowIdx = m.rows.length - 1;
        for (let r = 0; r < m.rows.length; r++) {
            if (m.rows[r].hidden) continue;
            if (y < m.rows[r].top + m.rows[r].height) {
                rowIdx = r;
                break;
            }
            rowIdx = r;
        }

        return { row: Math.max(1, rowIdx + 1), col: Math.max(0, col) };
    }

    /**
     * 数式内の全参照トークンを文字オフセット・$絶対フラグ・配色インデックス付きで抽出
     */
    function extractFormulaRefTokens(formula) {
        const src = String(formula ?? "");
        const trimmed = src.trimStart();
        if (!trimmed) return [];

        // 文字列リテラルを同長のスペースでマスクしてオフセットずれを防止
        let masked = "";
        let inQuote = false;
        for (let i = 0; i < src.length; i++) {
            const ch = src[i];
            if (ch === '"') {
                inQuote = !inQuote;
                masked += " ";
            } else {
                masked += inQuote ? " " : ch;
            }
        }

        const tokens = [];
        const colorMap = new Map();
        const tokenRegex = /(?:(?:'[^']+'|[A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+)!)?(?<![A-Za-z0-9_])(\$?)([A-Za-z]+)(\$?)(\d+)(?::(\$?)([A-Za-z]+)(\$?)(\d+))?(?!\s*\()/g;

        let match;
        while ((match = tokenRegex.exec(masked)) !== null) {
            const full = match[0];
            if (full.includes("!")) continue; // 他シート参照は別シート対象のため除外

            const absC1 = match[1] === "$";
            const c1 = columnLettersToIndex(match[2]);
            const absR1 = match[3] === "$";
            const r1 = parseInt(match[4], 10);
            const isRange = Boolean(match[6]);
            const absC2 = isRange ? match[5] === "$" : absC1;
            const c2 = isRange ? columnLettersToIndex(match[6]) : c1;
            const absR2 = isRange ? match[7] === "$" : absR1;
            const r2 = isRange ? parseInt(match[8], 10) : r1;

            if (r1 < 1 || r2 < 1 || c1 < 0 || c2 < 0) continue;

            const minR = Math.min(r1, r2);
            const maxR = Math.max(r1, r2);
            const minC = Math.min(c1, c2);
            const maxC = Math.max(c1, c2);
            const normKey = `${minR},${minC}:${maxR},${maxC}`;
            if (!colorMap.has(normKey)) {
                colorMap.set(normKey, colorMap.size % FREF_PALETTE.length);
            }

            tokens.push({
                index: tokens.length,
                start: match.index,
                end: match.index + full.length,
                raw: src.slice(match.index, match.index + full.length),
                r1, c1, r2, c2,
                minR, maxR, minC, maxC,
                absC1, absR1, absC2, absR2,
                isRange,
                colorIdx: colorMap.get(normKey)
            });
        }
        return tokens;
    }

    function formatRefTokenText(r1, c1, r2, c2, flags = {}) {
        const p1 = `${flags.absC1 ? "$" : ""}${getColumnName(c1)}${flags.absR1 ? "$" : ""}${r1}`;
        if (r1 === r2 && c1 === c2 && !flags.forceRange) {
            return p1;
        }
        const p2 = `${flags.absC2 ? "$" : ""}${getColumnName(c2)}${flags.absR2 ? "$" : ""}${r2}`;
        return `${p1}:${p2}`;
    }

    function syncFormulaInputsAndCaret(newFormula, selStart, selEnd, primaryInput = null) {
        const isEditing = typeof isCellEditing === "function" && isCellEditing();
        if (formulaBarInput && formulaBarInput.value !== newFormula) {
            formulaBarInput.value = newFormula;
        }
        if (typeof cellEditor !== "undefined" && isEditing && cellEditor.value !== newFormula) {
            cellEditor.value = newFormula;
            if (editingCell) syncCellEditorLayout(editingCell);
        }
        const focusTarget = (primaryInput && primaryInput.isConnected && primaryInput.style.display !== "none")
            ? primaryInput
            : (isEditing ? cellEditor : formulaBarInput);

        if (focusTarget) {
            if (document.activeElement !== focusTarget) {
                focusTarget.focus({ preventScroll: true });
            }
            try {
                focusTarget.setSelectionRange(selStart, selEnd);
            } catch { /* ignore */ }
        }
        if (focusTarget === formulaBarInput) {
            isFormulaBarDirty = true;
            syncFormulaBarToCellEditor();
        }
    }

    function highlightCalculationRange(formula, opts = {}) {
        const rawFormula = String(formula ?? "");
        const activeTokenIdx = opts.activeTokenIdx ?? -1;
        const interactive = opts.interactive !== false && rawFormula.trimStart().startsWith("=");
        const tokens = extractFormulaRefTokens(rawFormula);
        currentFormulaRefTokens = tokens;
        lastHighlightedFormula = rawFormula;
        formulaRefLayer.innerHTML = "";
        if (!tokens.length) return;

        const metrics = buildGridAxisMetrics();
        const frag = document.createDocumentFragment();

        // 面積が大きい範囲を背面、小さい範囲を前面に並べて重なり時の操作性を最適化
        const areaOrder = [...tokens].sort((a, b) => {
            const areaA = (a.maxR - a.minR + 1) * (a.maxC - a.minC + 1);
            const areaB = (b.maxR - b.minR + 1) * (b.maxC - b.minC + 1);
            return areaB - areaA;
        });
        const zRankMap = new Map(areaOrder.map((t, rank) => [t.index, rank]));

        const paintedFillKeys = new Set();
        tokens.forEach((tok) => {
            const rect = computeGridRangeRect(tok.minR, tok.minC, tok.maxR, tok.maxC, metrics);
            if (!rect) return;
            const palette = FREF_PALETTE[tok.colorIdx % FREF_PALETTE.length];
            const normKey = `${tok.minR},${tok.minC}:${tok.maxR},${tok.maxC}`;
            const isDupFill = paintedFillKeys.has(normKey);
            paintedFillKeys.add(normKey);

            const box = document.createElement("div");
            box.className = "ss-fref-box" + (tok.index === activeTokenIdx ? " is-dragging" : "");
            box.dataset.tokenIdx = String(tok.index);
            box.style.left = `${rect.left}px`;
            box.style.top = `${rect.top}px`;
            box.style.width = `${rect.width}px`;
            box.style.height = `${rect.height}px`;
            box.style.zIndex = String(22 + (zRankMap.get(tok.index) || 0));
            box.style.setProperty("--fref-color", palette.hex);
            box.style.setProperty("--fref-fill", isDupFill ? "transparent" : `rgba(${palette.rgb}, 0.11)`);
            box.style.setProperty("--fref-fill-active", `rgba(${palette.rgb}, 0.20)`);

            if (interactive) {
                ["n", "s", "w", "e"].forEach(edge => {
                    const edgeEl = document.createElement("div");
                    edgeEl.className = "ss-fref-edge";
                    edgeEl.dataset.edge = edge;
                    edgeEl.dataset.tokenIdx = String(tok.index);
                    edgeEl.title = "ドラッグして参照範囲を移動";
                    box.appendChild(edgeEl);
                });

                ["nw", "ne", "sw", "se"].forEach(corner => {
                    const handleEl = document.createElement("div");
                    handleEl.className = "ss-fref-handle";
                    handleEl.dataset.corner = corner;
                    handleEl.dataset.tokenIdx = String(tok.index);
                    handleEl.title = "ドラッグして参照範囲のサイズを変更";
                    box.appendChild(handleEl);
                });
            }

            frag.appendChild(box);
        });

        formulaRefLayer.appendChild(frag);
    }

    function refreshFormulaRefOverlay() {
        if (lastHighlightedFormula) {
            highlightCalculationRange(lastHighlightedFormula);
        }
    }

    // 参照範囲の4辺ドラッグ移動 ＆ 4隅ドラッグリサイズ（リアルタイム色更新＆キャレット維持）
    formulaRefLayer.addEventListener("mousedown", (e) => {
        const handleEl = e.target.closest(".ss-fref-handle");
        const edgeEl = e.target.closest(".ss-fref-edge");
        if (!handleEl && !edgeEl) return;

        // preventDefault によりセルエディタ／数式バーのフォーカスとキャレットを喪失させない
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const tokenIdx = Number((handleEl || edgeEl).dataset.tokenIdx);
        const tok = currentFormulaRefTokens[tokenIdx];
        if (!tok) return;

        const primaryInput = (document.activeElement === formulaBarInput)
            ? formulaBarInput
            : (isCellEditing() ? cellEditor : formulaBarInput);
        if (!primaryInput) return;

        const metrics = buildGridAxisMetrics();
        const startCoord = hitTestGridCoord(e.clientX, e.clientY, metrics);

        const origFormulaBeforeDrag = primaryInput.value;
        const origTokEnd = tok.end;

        activeRefDragState = {
            mode: handleEl ? "resize" : "move",
            corner: handleEl?.dataset.corner || null,
            tokenIdx,
            tokStart: tok.start,
            tokEnd: tok.end,
            origFormula: origFormulaBeforeDrag,
            origTokEnd,
            flags: {
                absC1: tok.absC1,
                absR1: tok.absR1,
                absC2: tok.absC2,
                absR2: tok.absR2,
                forceRange: tok.isRange
            },
            origMinR: tok.minR,
            origMaxR: tok.maxR,
            origMinC: tok.minC,
            origMaxC: tok.maxC,
            startRow: startCoord.row,
            startCol: startCoord.col,
            primaryInput,
            metrics
        };

        lastPointRefRange = { start: tok.start, end: tok.end };
        syncFormulaInputsAndCaret(primaryInput.value, tok.start, tok.end, primaryInput);
        highlightCalculationRange(primaryInput.value, { activeTokenIdx: tokenIdx });

        const finishRefDrag = (cancel = false) => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
            document.removeEventListener("keydown", onDragKeydown, true);
            if (!activeRefDragState) return;
            const st = activeRefDragState;
            activeRefDragState = null;
            lastPointRefRange = null;

            if (cancel) {
                syncFormulaInputsAndCaret(st.origFormula, st.origTokEnd, st.origTokEnd, st.primaryInput);
                highlightCalculationRange(st.origFormula);
            } else {
                const finalFormula = st.primaryInput.value;
                syncFormulaInputsAndCaret(finalFormula, st.tokEnd, st.tokEnd, st.primaryInput);
                highlightCalculationRange(finalFormula);
            }
        };

        const onDragKeydown = (ev) => {
            if (ev.key === "Escape") {
                ev.preventDefault();
                ev.stopPropagation();
                ev.stopImmediatePropagation();
                finishRefDrag(true);
            }
        };

        const onMove = (ev) => {
            if (!activeRefDragState) return;
            const st = activeRefDragState;
            const contRect = container.getBoundingClientRect();
            if (ev.clientY > contRect.bottom - 24) container.scrollTop += 26;
            else if (ev.clientY < contRect.top + 36) container.scrollTop -= 26;
            if (ev.clientX > contRect.right - 24) container.scrollLeft += 48;
            else if (ev.clientX < contRect.left + 64) container.scrollLeft -= 48;

            st.metrics = buildGridAxisMetrics();
            const cur = hitTestGridCoord(ev.clientX, ev.clientY, st.metrics);

            let nextR1 = st.origMinR;
            let nextC1 = st.origMinC;
            let nextR2 = st.origMaxR;
            let nextC2 = st.origMaxC;

            if (st.mode === "move") {
                const dR = cur.row - st.startRow;
                const dC = cur.col - st.startCol;
                const h = st.origMaxR - st.origMinR;
                const w = st.origMaxC - st.origMinC;
                nextR1 = Math.max(1, st.origMinR + dR);
                nextC1 = Math.max(0, st.origMinC + dC);
                nextR2 = nextR1 + h;
                nextC2 = nextC1 + w;
            } else {
                const anchorR = st.corner.includes("n") ? st.origMaxR : st.origMinR;
                const anchorC = st.corner.includes("w") ? st.origMaxC : st.origMinC;
                nextR1 = Math.min(anchorR, Math.max(1, cur.row));
                nextR2 = Math.max(anchorR, Math.max(1, cur.row));
                nextC1 = Math.min(anchorC, Math.max(0, cur.col));
                nextC2 = Math.max(anchorC, Math.max(0, cur.col));
                if (nextR1 !== nextR2 || nextC1 !== nextC2) {
                    st.flags.forceRange = true;
                }
            }

            if (nextR2 >= rowCount) {
                loadRowsSync(ROW_BATCH);
                st.metrics = buildGridAxisMetrics();
            }
            if (nextC2 >= currentColumns) {
                loadColumnsSync(COLUMN_BATCH);
                st.metrics = buildGridAxisMetrics();
            }

            const newRefText = formatRefTokenText(nextR1, nextC1, nextR2, nextC2, st.flags);
            const curFormula = st.primaryInput.value;
            const updatedFormula = curFormula.slice(0, st.tokStart) + newRefText + curFormula.slice(st.tokEnd);
            st.tokEnd = st.tokStart + newRefText.length;
            lastPointRefRange = { start: st.tokStart, end: st.tokEnd };

            syncFormulaInputsAndCaret(updatedFormula, st.tokStart, st.tokEnd, st.primaryInput);
            highlightCalculationRange(updatedFormula, { activeTokenIdx: st.tokenIdx });
        };

        const onUp = () => finishRefDrag(false);

        document.addEventListener("mousemove", onMove, { signal });
        document.addEventListener("mouseup", onUp, { signal });
        document.addEventListener("keydown", onDragKeydown, { capture: true, signal });
    }, { capture: true, signal });

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
            const currentSize = target.style.fontSize || computed.fontSize;
            for (const opt of select.options) opt.selected = opt.value === currentSize;
        }

        const isBold = target.style.fontWeight === "bold" || Number(computed.fontWeight) >= 600;
        const deco = target.style.textDecoration || "";
        appRoot.querySelector(".ss-toggle-bold")?.classList.toggle("selected", isBold);
        appRoot.querySelector(".ss-toggle-italic")?.classList.toggle("selected", target.style.fontStyle === "italic");
        appRoot.querySelector(".ss-toggle-underline")?.classList.toggle("selected", deco.includes("underline"));
        appRoot.querySelector(".ss-toggle-strike")?.classList.toggle("selected", deco.includes("line-through"));
        appRoot.querySelector(".ss-toggle-textshadow")?.classList.toggle("selected", Boolean(target.style.textShadow && target.style.textShadow !== "none"));

        const align = target.style.textAlign || (
            target.classList.contains("ss-auto-align-right") ? "right" :
                target.classList.contains("ss-auto-align-center") ? "center" : "left"
        );
        appRoot.querySelectorAll("[data-align]").forEach(btn => {
            btn.classList.toggle("selected", btn.dataset.align === align);
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

    function updateSelectedCellsDisplay() {
        const selected = [...tbody.querySelectorAll("td.selected")];
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

            const rawVal = (c.dataset.rawValue ?? c.textContent).trim().replace(/[¥￥,、\s]/g, "");
            if (rawVal !== "" && !isNaN(Number(rawVal))) {
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

        const inputRef = resolvedSpec.toUpperCase();
        if (inputRef.includes(":")) {
            const range = parseRangeReference(inputRef);
            if (range) {
                const minR = Math.min(range.start.row, range.end.row);
                const maxR = Math.max(range.start.row, range.end.row);
                const minC = Math.min(range.start.col, range.end.col);
                const maxC = Math.max(range.start.col, range.end.col);
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
        const maxRight = Math.max(table.offsetWidth, cachedTableWidth);
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
                if (c1 >= currentColumns) loadColumnsSync(c1 - currentColumns + 1);
                if (r1 >= rowCount) loadRowsSync(r1 - rowCount + 1);
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
        const items = resolveCellDropdownItems(cell.dataset.dropdownList);
        if (!items.length) {
            showAlert("リストの候補が見つかりません。入力規則の「元の値」を確認してください。", "ドロップダウンリスト");
            return;
        }

        const cellRect = cell.getBoundingClientRect();
        const btnRect = (anchorBtn && anchorBtn.style.display !== "none" ? anchorBtn : cell).getBoundingClientRect();
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
        floatingDropdownBtn.classList.add("open");
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

    function compareValidationValues(op, val, v1, v2) {
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
                formulaEvalCache.clear();
                const res = evaluateFormula(f, new Set(), activeSheetIndex, {
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
                formulaEvalCache.clear();
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
                        if (activeCell === cell) {
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

    function extractHyperlinkTarget(cell) {
        if (!cell) return "";
        if (cell.dataset.hyperlink) return cell.dataset.hyperlink;
        const f = cell.dataset.formula || "";
        const m = f.match(/^=\s*HYPERLINK\s*\(\s*"([^"]+)"/i);
        if (m) return m[1].trim();
        const txt = (cell.dataset.rawValue ?? cell.textContent).trim();
        if (/^https?:\/\/\S+$/i.test(txt)) return txt;
        return "";
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
                const sIdx = sheets.findIndex(s => s.name === sheetName);
                if (sIdx === -1) {
                    showAlert(`シート「${sheetName}」が見つかりません。`, "ハイパーリンク");
                    return true;
                }
                if (sIdx !== activeSheetIndex) await switchToSheet(sIdx);
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
        if (!activeCell) return;
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
        const selected = Array.from(tbody.querySelectorAll("td.selected")).filter(td => td.style.display !== "none");
        const targets = selected.length ? selected : (activeCell ? [activeCell] : []);
        if (!targets.length) return;
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

                        if (activeCell) setActiveCell(activeCell, true);
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

    function setActiveCell(cell, shouldFocus = true) {
        if (!cell) return;
        closeCellDropdownList();
        tbody.querySelectorAll("td.active-cell").forEach(c => c.classList.remove("active-cell"));
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
        const quotePrefix = activeCell.dataset.quotePrefix === "1" ? "'" : "";
        if (isCurrentSheetProtected() && activeCell.dataset.formulaHidden === "1" && activeCell.dataset.formula) {
            formulaBarInput.value = "";
        } else if (activeCell.dataset.formula) {
            formulaBarInput.value = activeCell.dataset.formula;
        } else if (activeCell.dataset.spillOrigin) {
            const [sr, sc] = activeCell.dataset.spillOrigin.split(",").map(Number);
            const originCell = peekCell(sr, sc);
            formulaBarInput.value = originCell?.dataset.formula || (activeCell.dataset.rawValue ?? activeCell.textContent);
        } else {
            formulaBarInput.value = quotePrefix + (activeCell.dataset.rawValue ?? activeCell.textContent);
        }
        delete formulaBarInput.dataset.manualHeight;
        autoResizeFormulaBar();
        updateHeaderSelectionHighlights(Array.from(tbody.querySelectorAll("td.selected")));
        syncFilterButtonState(activeCell);
    }

    const SEL_EDGE_CLASSES = ["sel-edge-top", "sel-edge-bottom", "sel-edge-left", "sel-edge-right"];
    let highlightedHeaderEls = [];

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

    function clearSelectionEdges() {
        tbody.querySelectorAll("td.sel-edge-top, td.sel-edge-bottom, td.sel-edge-left, td.sel-edge-right").forEach(c => {
            c.classList.remove(...SEL_EDGE_CLASSES);
        });
    }

    function updateSelectionEdges(preQueriedSelected = null) {
        clearSelectionEdges();
        const selected = preQueriedSelected || Array.from(tbody.querySelectorAll("td.selected"));
        updateHeaderSelectionHighlights(selected);
        if (!selected.length) return;

        let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
        selected.forEach(c => {
            const r0 = +c.dataset.row;
            const c0 = +c.dataset.col;
            const r1 = r0 + (+c.getAttribute("rowspan") || 1) - 1;
            const c1 = c0 + (+c.getAttribute("colspan") || 1) - 1;
            if (r0 < minR) minR = r0;
            if (r1 > maxR) maxR = r1;
            if (c0 < minC) minC = c0;
            if (c1 > maxC) maxC = c1;
        });

        selected.forEach(c => {
            const r0 = +c.dataset.row;
            const c0 = +c.dataset.col;
            const r1 = r0 + (+c.getAttribute("rowspan") || 1) - 1;
            const c1 = c0 + (+c.getAttribute("colspan") || 1) - 1;
            if (r0 === minR) c.classList.add("sel-edge-top");
            if (r1 === maxR) c.classList.add("sel-edge-bottom");
            if (c0 === minC) c.classList.add("sel-edge-left");
            if (c1 === maxC) c.classList.add("sel-edge-right");
        });
    }

    function clearSelection() {
        clearHeaderSelectionHighlights();
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
        const cellW = cell.offsetWidth || 120;
        const cellH = cell.offsetHeight || 30;
        const computed = getComputedStyle(cell);
        const fStyle = cell.style.fontStyle || computed.fontStyle || "normal";
        const fWeight = cell.style.fontWeight || computed.fontWeight || "normal";
        const fSize = cell.style.fontSize || computed.fontSize || "14px";
        const fFamily = cell.style.fontFamily || computed.fontFamily || "'MS PGothic', 'MS Gothic', sans-serif";
        const fSizeNum = parseFloat(fSize) || 14;
        const computedLH = parseFloat(computed.lineHeight);
        const lineHeightPx = !Number.isNaN(computedLH) ? computedLH : Math.round(fSizeNum * 1.3);
        const valign = cell.style.verticalAlign || computed.verticalAlign || "middle";
        const writingMode = cell.style.writingMode || computed.writingMode || "horizontal-tb";
        const textOrientation = cell.style.textOrientation || computed.textOrientation || "mixed";
        const isVertical = writingMode === "vertical-rl" || writingMode === "vertical-lr";

        return {
            cell, left, top, cellW, cellH, minH: Math.max(cellH, 28),
            computed, fStyle, fWeight, fSize, fSizeNum, fFamily, lineHeightPx, valign,
            writingMode, textOrientation, isVertical
        };
    }

    function resolveEditorAutoAlign(cell, rawInput) {
        if (cell.style.textAlign) {
            return cell.style.textAlign === "justify" ? "left" : cell.style.textAlign;
        }
        const str = String(rawInput ?? "");
        const trimmed = str.trim();
        if (trimmed === "") {
            if (cell.classList.contains("ss-auto-align-right")) return "right";
            if (cell.classList.contains("ss-auto-align-center")) return "center";
            return "left";
        }
        // 数式(=始まり)や文字列指定('始まり)は編集中も左揃え
        if (trimmed.startsWith("=") || str.startsWith("'")) return "left";
        const upper = trimmed.toUpperCase();
        if (upper === "TRUE" || upper === "FALSE" || EXCEL_ERROR_RE.test(upper)) {
            return "center";
        }
        if (!isNaN(parseFormattedNumber(trimmed)) || isDateFormat(trimmed)) {
            return "right";
        }
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

            const theadHeight = theadRow.offsetHeight || 30;
            const rowHeaderWidth = parseInt(colgroup.children[0]?.style.width, 10) || 54;
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
            measureCtx.font = `${m.fStyle} ${m.fWeight} ${m.fSize} ${m.fFamily}`;
        }
        let maxTextWidth = 0;
        for (let i = 0; i < lines.length; i++) {
            const w = measureCtx ? measureCtx.measureText(lines[i]).width : lines[i].length * m.fSizeNum;
            if (w > maxTextWidth) maxTextWidth = w;
        }

        const rowHeaderWidth = parseInt(colgroup.children[0]?.style.width, 10) || 54;
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
        const quotePrefix = activeCell.dataset.quotePrefix === "1" ? "'" : "";
        const initialVal = activeCell.dataset.formula
            ? activeCell.dataset.formula
            : quotePrefix + (activeCell.dataset.rawValue ?? activeCell.textContent);
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
        if (activeRefDragState || isSelecting) return;
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

    // シングルクリックで選択したセルからの直接入力・F2編集・F4参照切替を統合
    tbody.addEventListener("keydown", (e) => {
        if (handleAutocompleteKeydown(e)) return;
        if (handleF4ReferenceToggle(e)) return;

        // すでにセル編集中なら cellEditor 側のリスナーに任せる
        if (isCellEditing() || document.activeElement === cellEditor) return;
        if (!activeCell || e.ctrlKey || e.metaKey) return;

        // Alt順次押し（Alt → O → A 等）待機中は文字入力として横取りせず document 側へ通す
        if (altKeySequence) return;

        // Alt + ↓ でデータ入力規則のプルダウンを展開
        if (e.altKey) {
            if (e.key === "ArrowDown" && activeCell.dataset.dropdownList) {
                e.preventDefault();
                e.stopPropagation();
                openCellDropdownList(activeCell, floatingDropdownBtn);
            }
            return;
        }

        // Shift + Space（行全体選択）は文字入力として横取りせず document 側へ通す
        if (e.shiftKey && e.key === " ") return;

        // 非編集時の Enter / Tab（コピー中Enterは貼り付け、通常時は選択範囲内をループ移動）
        if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            e.stopPropagation();
            if (e.key === "Enter" && clipboardData && isCopyAnimationActive()) {
                void pasteClipboardData("all");
                return;
            }
            moveActiveInSelectionOrStep(activeCell, e.key === "Enter" ? "vertical" : "horizontal", e.shiftKey);
            return;
        }

        // 1. F2キー：既存の内容を保持したまま編集モードへ
        if (e.key === "F2") {
            e.preventDefault();
            e.stopPropagation();
            enterCellEditMode(activeCell, false, "f2");
            return;
        }

        // 2. 日本語IME（全角）の1文字目入力：preventDefaultせずにcellEditorへフォーカスを渡す
        if (e.key === "Process" || e.isComposing || e.keyCode === 229) {
            enterCellEditMode(activeCell, false, "ime");
            cellEditor.value = "";
            formulaBarInput.value = "";
            syncCellEditorLayout(activeCell);
            return;
        }

        // 3. 半角英数字・記号の1文字目入力：既存値を上書きして編集モードへ
        if (e.key.length === 1) {
            e.preventDefault();
            e.stopPropagation();
            enterCellEditMode(activeCell, false, "type");
            cellEditor.value = e.key;
            cellEditor.setSelectionRange(1, 1);
            formulaBarInput.value = e.key;
            syncCellEditorLayout(activeCell);
            showAutocompletePopup(cellEditor, e.key, 1);
            return;
        }

        // 4. Backspace：単一セルはクリアして即編集モード、複数セル選択時は一括クリア
        if (e.key === "Backspace") {
            e.preventDefault();
            e.stopPropagation();
            if (getTargetCells().length > 1) {
                clearTargetCellsContent();
                return;
            }
            enterCellEditMode(activeCell, false, "backspace");
            cellEditor.value = "";
            formulaBarInput.value = "";
            syncCellEditorLayout(activeCell);
        }
    }, { capture: true, signal });

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
        if (!cell) return;
        if (isCellLockedForEdit(cell)) {
            showAlert("変更しようとしているセルは保護されたシート上にあります。\n編集するには「表示」または「ホーム → 書式」からシート保護を解除してください。", "シートの保護");
            return;
        }
        closeCellDropdownList();
        hideCellDropdownButton();
        const alreadyEditingThis = isCellEditing(cell);
        if (!alreadyEditingThis) {
            lastPointRefRange = null;
            cell.dataset.originalText = cell.dataset.rawValue ?? cell.textContent;
            const quotePrefix = cell.dataset.quotePrefix === "1" ? "'" : "";
            if (cell.dataset.formula) {
                cell.dataset.originalFormula = cell.dataset.formula;
                cellEditor.value = cell.dataset.formula;
                editingRichRuns = null;
            } else {
                delete cell.dataset.originalFormula;
                cellEditor.value = quotePrefix + (cell.dataset.rawValue !== undefined ? cell.dataset.rawValue : cell.textContent);
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

    function commitCellValue(cell, rawValue) {
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
        if (!validateCellInputByRule(cell, newText)) {
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
        delete cell.dataset.spillOrigin;
        clearSpillCellsFromAnchor(parseInt(cell.dataset.row, 10), parseInt(cell.dataset.col, 10));
        const prevText = cell.dataset.originalText ?? "";
        const prevFormula = cell.dataset.originalFormula ?? "";

        if (rawStr.startsWith("'")) {
            delete cell.dataset.formula;
            delete cell.dataset.valueType;
            delete cell.dataset.dateValue;
            cell.dataset.quotePrefix = "1";
            setCellFormattedValue(cell, rawStr.slice(1));
            delete cell.dataset.editBy;
            clearCalculationRangeHighlights();
            updateAllFormulas();
            if (prevText !== cell.textContent || prevFormula !== "") {
                setDirtyState(true);
                debouncedSaveState();
            }
            return true;
        }
        delete cell.dataset.quotePrefix;

        if (trimmedStr.startsWith("=")) {
            cell.dataset.formula = trimmedStr;
            setCellFormattedValue(cell, evaluateFormula(trimmedStr));
        } else if (isDateFormat(trimmedStr)) {
            const parts = trimmedStr.split(/[\/\-]/);
            let year, month, day;
            if (parts.length === 2) {
                year = new Date().getFullYear();
                month = parseInt(parts[0], 10);
                day = parseInt(parts[1], 10);
            } else if (parts[0].length === 4) {
                year = parseInt(parts[0], 10);
                month = parseInt(parts[1], 10);
                day = parseInt(parts[2], 10);
            } else if (parts[2].length === 4) {
                year = parseInt(parts[2], 10);
                month = parseInt(parts[0], 10);
                day = parseInt(parts[1], 10);
            } else {
                year = 2000 + parseInt(parts[0], 10);
                month = parseInt(parts[1], 10);
                day = parseInt(parts[2], 10);
            }
            const date = new Date(year, month - 1, day);
            const isValidCalendarDate =
                date &&
                !isNaN(date.getTime()) &&
                date.getFullYear() === year &&
                date.getMonth() === month - 1 &&
                date.getDate() === day;

            if (isValidCalendarDate) {
                delete cell.dataset.formula;
                cell.dataset.valueType = "date";
                cell.dataset.dateValue = String(date.getTime());
                setCellFormattedValue(cell, formatDate(date));
            } else {
                delete cell.dataset.formula;
                delete cell.dataset.valueType;
                delete cell.dataset.dateValue;
                setCellFormattedValue(cell, newText);
            }
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
        clearCalculationRangeHighlights();
        tryAutoExpandStructuredTable(parseInt(cell.dataset.row, 10), parseInt(cell.dataset.col, 10));
        updateAllFormulas();
        if (cell.dataset.shrinkToFit === "1") {
            applyShrinkToFit(cell);
        }
        if (newText.includes("\n") || prevText.includes("\n") || cell.style.whiteSpace === "pre-wrap") {
            autoFitRow(cell.closest("tr"));
        }

        if (prevText !== cell.textContent || prevFormula !== (cell.dataset.formula || "")) {
            setDirtyState(true);
            debouncedSaveState();
        }
        return true;
    }

    function revertSelectedCellsText() {
        closeCellEditor();
        isFormulaBarDirty = false;
        if (activeCell) {
            if (activeCell.dataset.originalFormula) {
                activeCell.dataset.formula = activeCell.dataset.originalFormula;
                setCellFormattedValue(activeCell, evaluateFormula(activeCell.dataset.originalFormula));
                formulaBarInput.value = activeCell.dataset.originalFormula;
            } else if (activeCell.dataset.originalText !== undefined) {
                delete activeCell.dataset.formula;
                setCellFormattedValue(activeCell, activeCell.dataset.originalText);
                formulaBarInput.value = activeCell.dataset.rawValue ?? activeCell.textContent;
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
            formulaBarInput.value = val;
            updateSelectedCellsDisplay();
            return;
        }

        // Ctrl + D / Ctrl + R
        if (key === "d" || key === "r") {
            const bounds = getSelectedRangeBounds();
            if (!bounds) return;
            e.preventDefault();
            e.stopPropagation();

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

        {
            const previouslySelected = new Set(tbody.querySelectorAll("td.selected"));
            for (let r = minRow; r <= maxRow; r++) {
                for (let c = minCol; c <= maxCol; c++) {
                    const cell = getVisibleCell(r, c);
                    if (cell && cell.style.display !== "none") {
                        cell.classList.add("selected");
                        previouslySelected.delete(cell);
                    }
                }
            }
            previouslySelected.forEach(c => c.classList.remove("selected"));
            if (activeCell) {
                activeCell.classList.add("active-cell", "selected");
            }
            updateSelectionEdges();
        }
        updateSelectedCellsDisplay();
    }

    let isFillDragging = false;
    let fillDragStartCell = null;
    let currentFillRange = null;
    let initialFillRange = null;

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
            .replace(/(?<![A-Za-z0-9_$])(\$?)([A-Za-z]+)(\$?)(\d+)(?!\s*\()/g, (_, absCol, colLetters, absRow, rowStr) => {
                const nextCol = absCol ? columnLettersToIndex(colLetters) : Math.max(0, columnLettersToIndex(colLetters) + colOffset);
                const nextRow = absRow ? parseInt(rowStr, 10) : Math.max(1, parseInt(rowStr, 10) + rowOffset);
                return `${absCol}${getColumnName(nextCol)}${absRow}${nextRow}`;
            })
            .replace(/__ADJ_SH_(\d+)__!/g, (_, idx) => protectedTokens[Number(idx)])
            .replace(/__ADJ_TOK_(\d+)__/g, (_, idx) => protectedTokens[Number(idx)]);


        return "=" + adjustedBody;
    }

    const JP_DAYS_SHORT = ["日", "月", "火", "水", "木", "金", "土"];
    const JP_DAYS_LONG = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"];
    const EN_DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    function generateSeriesStep(seedValues, stepIndex, { forceSeries = false } = {}) {
        const n = seedValues.length;
        if (n === 0) return "";
        const modIdx = ((stepIndex % n) + n) % n;
        const base = seedValues[modIdx];
        if (stepIndex >= 0 && stepIndex < n) return base;

        const first = String(seedValues[0] ?? "").trim();
        const last = String(seedValues[n - 1] ?? "").trim();

        // 1. 数値：Excel準拠で1セルはコピー（Ctrlドラッグ時のみ+1）、2セル以上は等差数列
        const nums = seedValues.map(v => parseFormattedNumber(v));
        if (nums.every(v => !isNaN(v)) && seedValues.every(v => String(v).trim() !== "")) {
            if (n === 1) {
                return forceSeries ? String(nums[0] + stepIndex) : String(nums[0]);
            }
            const stepDiff = (nums[n - 1] - nums[0]) / (n - 1);
            return String(nums[0] + stepDiff * stepIndex);
        }

        // 2. 日付の連続（YYYY/MM/DD・逆方向対応）
        if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(first)) {
            const [y, m, d] = first.split("/").map(Number);
            const dt = new Date(y, m - 1, d);
            let dayStep = 1;
            if (n >= 2 && /^\d{4}\/\d{1,2}\/\d{1,2}$/.test(last)) {
                const [y2, m2, d2] = last.split("/").map(Number);
                const dt2 = new Date(y2, m2 - 1, d2);
                dayStep = Math.round((dt2 - dt) / 86400000 / (n - 1)) || 1;
            }
            dt.setDate(dt.getDate() + dayStep * stepIndex);
            return formatDate(dt);
        }

        // 3. 曜日リスト（月→火→水 / 逆方向：月→日→土 にも対応）
        for (const list of [JP_DAYS_SHORT, JP_DAYS_LONG, EN_DAYS_SHORT]) {
            const idx = list.indexOf(first);
            if (idx !== -1) {
                const nextIdx = ((idx + stepIndex) % list.length + list.length) % list.length;
                return list[nextIdx];
            }
        }

        // 4. 文字列＋末尾数字（単一セルは+1、複数セルは増分ステップを計算）
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
            const nextFormula = adjustFormula(sourceCell.dataset.formula, rowOffset, colOffset);
            targetCell.dataset.formula = nextFormula;
            setCellFormattedValue(targetCell, evaluateFormula(nextFormula));
        } else {
            delete targetCell.dataset.formula;
            const nextVal = overrideValue !== null ? overrideValue : (sourceCell.dataset.rawValue ?? sourceCell.textContent);
            setCellFormattedValue(targetCell, nextVal);
        }

        applyCellStyleData(targetCell, extractCellStyleObject(sourceCell));
        targetCell.removeAttribute("contenteditable");
        targetCell.classList.remove("selected", "fill-selected", "active-cell");
    }

    function extendConditionalFormatsForFill(srcRange, dstRange) {
        const rules = sheets[activeSheetIndex]?.conditionalFormats;
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
                if (dstRange.maxRow > rule.maxRow) {
                    rule.maxRow = dstRange.maxRow;
                }
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
                if (dstRange.maxCol > rule.maxCol) {
                    rule.maxCol = dstRange.maxCol;
                }
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

    function updateFillHandle() {
        tbody.querySelectorAll(".fill-handle").forEach(h => h.remove());
        const selected = [...tbody.querySelectorAll("td.selected")];
        if (!selected.length) return;

        let maxR = -Infinity, maxC = -Infinity;
        for (const c of selected) {
            const r1 = (+c.dataset.row) + (+c.getAttribute("rowspan") || 1) - 1;
            const c1 = (+c.dataset.col) + (+c.getAttribute("colspan") || 1) - 1;
            if (r1 > maxR) maxR = r1;
            if (c1 > maxC) maxC = c1;
        }
        const target = getVisibleCell(maxR, maxC);

        if (target && !target.isContentEditable && target.style.display !== "none") {
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

                // 左隣列、なければ右隣列の連続データ最終行を検出
                const refCol = bounds.minCol > 0 && hasDataAt(bounds.maxRow, bounds.minCol - 1)
                    ? bounds.minCol - 1
                    : (bounds.maxCol + 1 < currentColumns && hasDataAt(bounds.maxRow, bounds.maxCol + 1) ? bounds.maxCol + 1 : -1);
                if (refCol === -1) return;

                let endRow = bounds.maxRow;
                while (endRow + 1 < rowCount && hasDataAt(endRow + 1, refCol)) {
                    endRow++;
                }
                if (endRow <= bounds.maxRow) return;

                // フィル先に既存の結合セルが含まれている場合は構造破損を防ぐため中止
                for (let r = bounds.maxRow + 1; r <= endRow; r++) {
                    for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
                        const cell = peekCell(r, c);
                        if (!cell) continue;
                        if (
                            cell.style.display === "none" ||
                            cell.classList.contains("merged") ||
                            parseInt(cell.getAttribute("rowspan") || "1", 10) > 1 ||
                            parseInt(cell.getAttribute("colspan") || "1", 10) > 1
                        ) {
                            showAlert("結合されたセルの一部を変更することはできません。", "オートフィルエラー");
                            return;
                        }
                    }
                }

                const srcRows = bounds.maxRow - bounds.minRow + 1;
                for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
                    const seeds = [];
                    for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
                        const sc = getVisibleCell(r, c);
                        seeds.push(sc?.dataset.rawValue ?? sc?.textContent ?? "");
                    }
                    for (let r = bounds.maxRow + 1; r <= endRow; r++) {
                        const offset = r - bounds.minRow;
                        const src = getVisibleCell(bounds.minRow + (offset % srcRows), c);
                        const dst = getVisibleCell(r, c);
                        if (!src || !dst) continue;
                        const nextVal = src.dataset.formula ? null : generateSeriesStep(seeds, offset);
                        cloneCellProperties(src, dst, nextVal);
                    }
                }
                extendConditionalFormatsForFill(bounds, {
                    minRow: bounds.minRow,
                    maxRow: endRow,
                    minCol: bounds.minCol,
                    maxCol: bounds.maxCol
                });
                clearSelection();
                selectionStart = { row: bounds.minRow, col: bounds.minCol };
                selectionEnd = { row: endRow, col: bounds.maxCol };
                updateSelection();
                updateAllFormulas();
                updateFillHandle();
                setDirtyState(true);
                debouncedSaveState();
            }, { signal });

            fh.addEventListener("mousedown", (e) => {
                if (activeCell && activeCell.isContentEditable) return;
                e.stopPropagation();
                e.preventDefault();
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

                    // 結合セル上をドラッグ中でもポインタ位置から正確な行・列座標を算出
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

                    // 右下ハンドルから横へドラッグした際に下へ吸い込まれないよう、ピクセル移動量も加味して縦横を判定
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

                    const isInInitial = (r, c) =>
                        r >= initialFillRange.minRow && r <= initialFillRange.maxRow &&
                        c >= initialFillRange.minCol && c <= initialFillRange.maxCol;

                    // 拡張先に既存の結合セルが重なる場合は中止
                    for (let r = currentFillRange.minRow; r <= currentFillRange.maxRow; r++) {
                        for (let c = currentFillRange.minCol; c <= currentFillRange.maxCol; c++) {
                            if (isInInitial(r, c)) continue;
                            const cell = getCell(r, c);
                            if (!cell) continue;
                            const isMergedPart =
                                cell.style.display === "none" ||
                                cell.classList.contains("merged") ||
                                Boolean(cell.dataset.mergeMinRow) ||
                                Boolean(cell.dataset.mergeAnchorRow) ||
                                parseInt(cell.getAttribute("rowspan") || "1", 10) > 1 ||
                                parseInt(cell.getAttribute("colspan") || "1", 10) > 1;
                            if (isMergedPart) {
                                showAlert("結合されたセルの一部を変更することはできません。", "オートフィルエラー");
                                isFillDragging = false;
                                currentFillRange = null;
                                return;
                            }
                        }
                    }

                    const fillSource = fillDragStartCell || activeCell;
                    const initRCount = initialFillRange.maxRow - initialFillRange.minRow + 1;
                    const initCCount = initialFillRange.maxCol - initialFillRange.minCol + 1;

                    // コピー元パターン（結合情報含む）を事前にスナップショット取得
                    const templateGrid = [];
                    for (let rr = 0; rr < initRCount; rr++) {
                        const rowTemplates = [];
                        for (let cc = 0; cc < initCCount; cc++) {
                            const sc = getCell(initialFillRange.minRow + rr, initialFillRange.minCol + cc);
                            const rs = parseInt(sc?.getAttribute("rowspan") || "1", 10);
                            const cs = parseInt(sc?.getAttribute("colspan") || "1", 10);
                            const isHiddenSub = sc?.style.display === "none" && Boolean(sc?.dataset.mergeAnchorRow);
                            rowTemplates.push({ cell: sc, rs, cs, isHiddenSub });
                        }
                        templateGrid.push(rowTemplates);
                    }

                    for (let r = currentFillRange.minRow; r <= currentFillRange.maxRow; r++) {
                        for (let c = currentFillRange.minCol; c <= currentFillRange.maxCol; c++) {
                            if (isInInitial(r, c)) continue;
                            const tgt = getCell(r, c);
                            if (!tgt) continue;

                            const rOffset = r - initialFillRange.minRow;
                            const cOffset = c - initialFillRange.minCol;
                            // 上・左ドラッグ時（負のオフセット）でも正しく循環するよう正の剰余を使用
                            const tplR = ((rOffset % initRCount) + initRCount) % initRCount;
                            const tplC = ((cOffset % initCCount) + initCCount) % initCCount;
                            const tpl = templateGrid[tplR][tplC];

                            // 結合セル内の非表示サブセルはアンカー側で一括処理するためスキップ
                            if (tpl.isHiddenSub) continue;

                            const srcCell = tpl.cell || fillSource;
                            let seriesVal = null;

                            if (r > initialFillRange.maxRow && cOffset >= 0 && cOffset < initCCount) {
                                // 下方向への連番・コピー
                                const validSeeds = [];
                                let seedPos = 0;
                                for (let rr = 0; rr < initRCount; rr++) {
                                    const entry = templateGrid[rr][tplC];
                                    if (!entry.isHiddenSub) {
                                        if (rr === tplR) seedPos = validSeeds.length;
                                        validSeeds.push(entry.cell?.dataset.rawValue ?? entry.cell?.textContent ?? "");
                                    }
                                }
                                const cycle = Math.floor(rOffset / initRCount);
                                if (validSeeds.length > 0) {
                                    seriesVal = generateSeriesStep(validSeeds, cycle * validSeeds.length + seedPos, { forceSeries });
                                }
                            } else if (r < initialFillRange.minRow && cOffset >= 0 && cOffset < initCCount) {
                                // 上方向への逆方向連番・コピー
                                const validSeeds = [];
                                for (let rr = 0; rr < initRCount; rr++) {
                                    const entry = templateGrid[rr][tplC];
                                    if (!entry.isHiddenSub) {
                                        validSeeds.push(entry.cell?.dataset.rawValue ?? entry.cell?.textContent ?? "");
                                    }
                                }
                                if (validSeeds.length > 0) {
                                    seriesVal = generateSeriesStep(validSeeds, r - initialFillRange.minRow, { forceSeries });
                                }
                            } else if (c > initialFillRange.maxCol && rOffset >= 0 && rOffset < initRCount) {
                                // 右方向への連番・コピー
                                const validSeeds = [];
                                let seedPos = 0;
                                for (let cc = 0; cc < initCCount; cc++) {
                                    const entry = templateGrid[tplR][cc];
                                    if (!entry.isHiddenSub) {
                                        if (cc === tplC) seedPos = validSeeds.length;
                                        validSeeds.push(entry.cell?.dataset.rawValue ?? entry.cell?.textContent ?? "");
                                    }
                                }
                                const cycle = Math.floor(cOffset / initCCount);
                                if (validSeeds.length > 0) {
                                    seriesVal = generateSeriesStep(validSeeds, cycle * validSeeds.length + seedPos, { forceSeries });
                                }
                            } else if (c < initialFillRange.minCol && rOffset >= 0 && rOffset < initRCount) {
                                // 左方向への逆方向連番・コピー
                                const validSeeds = [];
                                for (let cc = 0; cc < initCCount; cc++) {
                                    const entry = templateGrid[tplR][cc];
                                    if (!entry.isHiddenSub) {
                                        validSeeds.push(entry.cell?.dataset.rawValue ?? entry.cell?.textContent ?? "");
                                    }
                                }
                                if (validSeeds.length > 0) {
                                    seriesVal = generateSeriesStep(validSeeds, c - initialFillRange.minCol, { forceSeries });
                                }
                            }

                            if (tgt !== srcCell) {
                                cloneCellProperties(srcCell, tgt, seriesVal);
                            }

                            // コピー元が結合セルの場合、コピー先にも同じ結合サイズと非表示サブセルを構築
                            const spanR = Math.min(tpl.rs, currentFillRange.maxRow - r + 1);
                            const spanC = Math.min(tpl.cs, currentFillRange.maxCol - c + 1);
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
                        }
                    }

                    // フィル後の範囲（結合アンカー）を選択状態に揃える
                    clearSelection();
                    selectionStart = { row: currentFillRange.minRow, col: currentFillRange.minCol };
                    selectionEnd = { row: currentFillRange.maxRow, col: currentFillRange.maxCol };
                    for (let r = currentFillRange.minRow; r <= currentFillRange.maxRow; r++) {
                        for (let c = currentFillRange.minCol; c <= currentFillRange.maxCol; c++) {
                            const vis = getVisibleCell(r, c);
                            if (vis && vis.style.display !== "none") {
                                vis.classList.add("selected");
                            }
                        }
                    }
                    if (fillSource) fillSource.classList.add("active-cell");

                    extendConditionalFormatsForFill(initialFillRange, currentFillRange);
                    updateAllFormulas();
                    updateSelectedCellsDisplay();
                    updateFillHandle();
                    setDirtyState(true);
                    debouncedSaveState();
                    isFillDragging = false;
                    currentFillRange = null;
                };

                document.addEventListener("mousemove", onMove, { signal });
                document.addEventListener("mouseup", onUp, { signal });
            }, { signal });
        }
    }

    // =========================================================
    // セル結合・解除
    // =========================================================
    function mergeSelectedCells() {
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
    // コピー・切り取り＆貼り付け（値のみ貼り付け対応）
    // =========================================================
    const copyAntsBox = document.createElement("div");
    copyAntsBox.className = "ss-copy-ants-box";
    spreadsheetContent.appendChild(copyAntsBox);
    let copyAntsBounds = null;

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

    function parseTSVToMatrix(rawText) {
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

    function copySelectedCells(isCut = false) {
        clearCopyAnimation();
        const selectedCells = Array.from(tbody.querySelectorAll("td.selected"));
        if (!selectedCells.length) return;

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

        if (selected.length <= 1 || pasteHeight > 1 || pasteWidth > 1) {
            const pasteBounds = {
                minRow: targetRow,
                maxRow: targetRow + pasteHeight - 1,
                minCol: targetCol,
                maxCol: targetCol + pasteWidth - 1
            };
            if (hasMergeConflictOnDestination(pasteBounds)) {
                showAlert("結合されたセルの一部を変更することはできません。", "貼り付けエラー");
                return;
            }
        }

        const writeTextToCell = (dest, text) => {
            if (!dest) return;
            const trimmed = String(text ?? "").trim();
            if (trimmed.startsWith("=")) {
                dest.dataset.formula = trimmed;
                setCellFormattedValue(dest, evaluateFormula(trimmed));
            } else {
                delete dest.dataset.formula;
                setCellFormattedValue(dest, text);
            }
        };

        if (pasteHeight === 1 && pasteWidth === 1 && selected.length > 1) {
            selected.forEach(dest => writeTextToCell(dest, matrix[0][0]));
        } else {
            matrix.forEach((rowArr, r) => {
                rowArr.forEach((val, c) => {
                    writeTextToCell(getCell(targetRow + r, targetCol + c), val);
                });
            });
        }

        updateAllFormulas();
        updateFillHandle();
        updateSelectedCellsDisplay();
        clearCopyAnimation();
        setDirtyState(true);
        debouncedSaveState();
    }

    async function pasteClipboardData(pasteOption = false) {
        const mode = typeof pasteOption === "string" ? pasteOption : (pasteOption ? "values" : "all");
        const valuesOnly = mode === "values";
        const formatsOnly = mode === "formats";
        const isTranspose = mode === "transpose";

        const selected = Array.from(tbody.querySelectorAll("td.selected"));
        let targetCell = activeCell;
        if (selected.length) {
            let minRow = Infinity, minCol = Infinity;
            for (const c of selected) {
                minRow = Math.min(minRow, +c.dataset.row);
                minCol = Math.min(minCol, +c.dataset.col);
            }
            targetCell = getCell(minRow, minCol) || activeCell;
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
            if (!clipboardData || normExt !== normInt) {
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

        const pasteHeight = Array.isArray(activeData[0])
            ? (activeData.length === 1 && activeData[0].length === 1 && selected.length > 1
                ? 1
                : activeData.length)
            : Math.max(...activeData.map(i => (isTranspose ? i.col - clipboardData.startCol : i.row - clipboardData.startRow) + 1));
        const pasteWidth = Array.isArray(activeData[0])
            ? (activeData.length === 1 && activeData[0].length === 1 && selected.length > 1
                ? 1
                : activeData[0].length)
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

        if (selected.length <= 1 || pasteHeight > 1 || pasteWidth > 1) {
            const pasteBounds = {
                minRow: targetRow,
                maxRow: targetRow + pasteHeight - 1,
                minCol: targetCol,
                maxCol: targetCol + pasteWidth - 1
            };
            if (hasMergeConflictOnDestination(pasteBounds, cutIgnoreBounds)) {
                showAlert("結合されたセルの一部を変更することはできません。", "貼り付けエラー");
                return;
            }
        }

        const applyCellData = (dest, item, rOff, cOff) => {
            if (!dest || item.isMergedSub) return;
            if (valuesOnly) {
                delete dest.dataset.formula;
                delete dest.dataset.richRuns;
                const resolvedVal = item.formula ? (item.evaluatedValue ?? evaluateFormula(item.formula)) : item.value;
                if (item.quotePrefix === "1") dest.dataset.quotePrefix = "1";
                else delete dest.dataset.quotePrefix;
                if (item.valueType) dest.dataset.valueType = item.valueType;
                else delete dest.dataset.valueType;
                if (item.dateValue) dest.dataset.dateValue = item.dateValue;
                else delete dest.dataset.dateValue;
                setCellFormattedValue(dest, resolvedVal);
                return;
            }
            if (formatsOnly) {
                if (item.numFormat) dest.dataset.numFormat = item.numFormat;
                else delete dest.dataset.numFormat;
                if (item.decimalPlaces !== undefined && item.decimalPlaces !== "") dest.dataset.decimalPlaces = item.decimalPlaces;
                else delete dest.dataset.decimalPlaces;
                applyCellStyleData(dest, item.styleObj);
                const curRaw = dest.dataset.formula ? evaluateFormula(dest.dataset.formula) : (dest.dataset.rawValue ?? dest.textContent);
                setCellFormattedValue(dest, curRaw);
                return;
            }
            const newFormula = item.formula
                ? (clipboardData.isCut && cutIgnoreBounds
                    ? adjustMovedFormulaSelf(item.formula, cutIgnoreBounds, rowDelta, colDelta)
                    : adjustFormula(item.formula, rOff, cOff))
                : "";
            if (item.numFormat) dest.dataset.numFormat = item.numFormat;
            else delete dest.dataset.numFormat;
            if (item.decimalPlaces !== undefined && item.decimalPlaces !== "") dest.dataset.decimalPlaces = item.decimalPlaces;
            else delete dest.dataset.decimalPlaces;
            if (item.dropdownList) dest.dataset.dropdownList = item.dropdownList;
            else delete dest.dataset.dropdownList;
            if (item.dvRule) dest.dataset.dvRule = item.dvRule;
            else delete dest.dataset.dvRule;
            if (item.richRuns && !newFormula) dest.dataset.richRuns = item.richRuns;
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

            if (newFormula) {
                dest.dataset.formula = newFormula;
                if (item.quotePrefix === "1") dest.dataset.quotePrefix = "1";
                else delete dest.dataset.quotePrefix;
                if (item.valueType) dest.dataset.valueType = item.valueType;
                else delete dest.dataset.valueType;
                if (item.dateValue) dest.dataset.dateValue = item.dateValue;
                else delete dest.dataset.dateValue;
                setCellFormattedValue(dest, evaluateFormula(newFormula));
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
            if (rs > 1 || cs > 1) {
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
                            sub.textContent = "";
                            sub.removeAttribute("style");
                            sub.style.display = "none";
                            sub.className = "";
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
                const cfRules = sheets[activeSheetIndex]?.conditionalFormats;
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
                const src = getCell(row, col);
                if (!src) return;
                const rs = parseInt(src.getAttribute("rowspan") || "1", 10);
                const cs = parseInt(src.getAttribute("colspan") || "1", 10);

                if (!pastedSet.has(`${row},${col}`)) {
                    clearAppliedConditionalStyle(src);
                    delete src.dataset.cfIcon;
                    src.style.removeProperty("--cf-icon-color");
                    src.textContent = "";
                    delete src.dataset.formula;
                    delete src.dataset.rawValue;
                    delete src.dataset.numFormat;
                    delete src.dataset.decimalPlaces;
                    delete src.dataset.dropdownList;
                    delete src.dataset.dvRule;
                    delete src.dataset.valueType;
                    delete src.dataset.dateValue;
                    delete src.dataset.spillOrigin;
                    delete src.dataset.richRuns;
                    delete src.dataset.hyperlink;
                    delete src.dataset.tableId;
                    delete src.dataset.note;
                    delete src.dataset.comment;
                    delete src.dataset.indent;
                    delete src.dataset.shrinkToFit;
                    delete src.dataset.textRotation;
                    delete src.dataset.locked;
                    delete src.dataset.formulaHidden;
                    src.querySelector(":scope > .ss-anno-mark")?.remove();
                    src.classList.remove("ss-auto-align-right", "ss-auto-align-center", "ss-hyperlink");
                    src.removeAttribute("title");
                    if (!valuesOnly) src.removeAttribute("style");
                }

                if (!valuesOnly && (rs > 1 || cs > 1) && !pastedSet.has(`${row},${col}`)) {
                    src.removeAttribute("rowspan");
                    src.removeAttribute("colspan");
                    src.classList.remove("merged");
                    delete src.dataset.mergeMinRow;
                    delete src.dataset.mergeMaxRow;
                    delete src.dataset.mergeMinCol;
                    delete src.dataset.mergeMaxCol;

                    for (let mr = row; mr < row + rs; mr++) {
                        for (let mc = col; mc < col + cs; mc++) {
                            if (mr === row && mc === col) continue;
                            const sub = getCell(mr, mc);
                            if (sub && !pastedSet.has(`${mr},${mc}`)) {
                                sub.style.display = "";
                                delete sub.dataset.mergeAnchorRow;
                                delete sub.dataset.mergeAnchorCol;
                            }
                        }
                    }
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

        // 貼り付け範囲に改行や折り返し設定が含まれる場合は行の高さを自動調整
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

        if (freezeRows > 0 || freezeCols > 0) applyFreezePanes();
        updateAllFormulas();
        refreshVisibleFloatingObjects();
        updateFillHandle();
        updateSelectedCellsDisplay();
        clearCopyAnimation();
        setDirtyState(true);
        debouncedSaveState();
    }

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
        const isNowJustify = cell.style.textAlign === "justify";
        if (cell.tagName === "TD" && (isNowJustify || hadJustifyDom)) {
            const displayText = formatDisplayByNumFmt(
                cell.dataset.rawValue ?? cell.textContent,
                cell.dataset.numFormat,
                cell
            );
            setCellTextPreservingControls(cell, displayText);
        }
    }

    // =========================================================
    // Undo / Redo 履歴管理（全状態スナップショット統合版）
    // =========================================================
    const RECOVERY_STORAGE_KEY = "nexser_ss_autosave_recovery_v1";

    function persistCrashRecoveryBackup(serializedSnapshot) {
        try {
            if (!serializedSnapshot || serializedSnapshot.length > 2_500_000) return;
            const payload = JSON.stringify({
                timestamp: Date.now(),
                filePath: currentFilePath || "",
                snapshot: serializedSnapshot
            });
            localStorage.setItem(RECOVERY_STORAGE_KEY, payload);
        } catch {
            // 容量超過時は古いリカバリデータを破棄してアプリ動作を継続
            try { localStorage.removeItem(RECOVERY_STORAGE_KEY); } catch { /* ignore */ }
        }
    }

    function clearCrashRecoveryBackup() {
        try { localStorage.removeItem(RECOVERY_STORAGE_KEY); } catch { /* ignore */ }
    }

    function saveState() {
        try {
            const serialized = serializeSheetSnapshot({ flush: false, recalcBackground: false });
            if (undoHistory.length > 0 && undoHistory[undoHistory.length - 1] === serialized) return;
            redoHistory = [];
            undoHistory.push(serialized);
            if (undoHistory.length > 50) undoHistory.shift();
            updateQATButtonsState();
            if (isDirty) persistCrashRecoveryBackup(serialized);
        } catch (err) {
            console.warn("[Spreadsheet] スナップショット保存中にエラーが発生しました:", err);
        }
    }

    function debouncedSaveState(delay = 300) {
        if (saveStateTimeout) clearTimeout(saveStateTimeout);
        saveStateTimeout = managedTimeout(saveState, delay);
    }

    let savedSnapshotJSON = null;

    function flushDebouncedSaveState() {
        if (saveStateTimeout) {
            clearTimeout(saveStateTimeout);
            timers.delete(saveStateTimeout);
            saveStateTimeout = null;
            saveState();
        }
    }

    async function loadState(stateJSON) {
        const prevTop = container.scrollTop;
        const prevLeft = container.scrollLeft;
        await applyDeserializedPayload(stateJSON, { isUndoRedo: true });
        container.scrollTop = prevTop;
        container.scrollLeft = prevLeft;
        updateSelectedCellsDisplay();
        updateFillHandle();
        updateQATButtonsState();
        const isClean = savedSnapshotJSON !== null && stateJSON === savedSnapshotJSON;
        setDirtyState(!isClean);
    }

    async function undo() {
        flushPendingEdits();
        flushDebouncedSaveState();
        if (undoHistory.length <= 1) return;
        redoHistory.push(undoHistory.pop());
        await loadState(undoHistory[undoHistory.length - 1]);
    }

    async function redo() {
        flushPendingEdits();
        flushDebouncedSaveState();
        if (!redoHistory.length) return;
        const next = redoHistory.pop();
        undoHistory.push(next);
        await loadState(next);
    }

    // =========================================================
    // フローティングテキストボックス＆図形ハンドル（8方向リサイズ・回転対応）
    // =========================================================
    function selectFloatingObject(targetBox) {
        spreadsheetContent.querySelectorAll(".floating-textbox.obj-selected").forEach(el => {
            if (el !== targetBox) el.classList.remove("obj-selected");
        });
        if (targetBox) targetBox.classList.add("obj-selected");
    }

    function applyObjectRotation(box, deg) {
        const normalized = ((Math.round(deg) % 360) + 360) % 360;
        box.dataset.rotation = String(normalized);
        box.style.transform = normalized === 0 ? "" : `rotate(${normalized}deg)`;
    }

    function attachObjectHandles(box) {
        box.querySelectorAll(".ss-obj-handle, .ss-obj-rotate-line, .ss-obj-rotate-handle").forEach(el => el.remove());

        const rotLine = document.createElement("div");
        rotLine.className = "ss-obj-rotate-line";
        box.appendChild(rotLine);

        const rotHandle = document.createElement("div");
        rotHandle.className = "ss-obj-rotate-handle";
        rotHandle.title = "ドラッグで回転（Shiftキーで15°刻み）";
        box.appendChild(rotHandle);

        rotHandle.addEventListener("mousedown", (e) => {
            e.stopPropagation();
            e.preventDefault();
            selectFloatingObject(box);
            const rect = box.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;

            const onRotateMove = (ev) => {
                const rad = Math.atan2(ev.clientY - cy, ev.clientX - cx);
                let deg = (rad * 180) / Math.PI + 90;
                if (ev.shiftKey) deg = Math.round(deg / 15) * 15;
                applyObjectRotation(box, deg);
                updateResizeTooltip(ev.clientX, ev.clientY, `回転: ${box.dataset.rotation}°`);
                setDirtyState(true);
            };
            const onRotateUp = () => {
                document.removeEventListener("mousemove", onRotateMove);
                document.removeEventListener("mouseup", onRotateUp);
                hideResizeTooltip();
                debouncedSaveState();
            };
            document.addEventListener("mousemove", onRotateMove, { signal });
            document.addEventListener("mouseup", onRotateUp, { signal });
        }, { signal });

        const dirs = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
        dirs.forEach(dir => {
            const h = document.createElement("div");
            h.className = "ss-obj-handle";
            h.dataset.dir = dir;
            h.title = "ドラッグでサイズ変更";
            box.appendChild(h);

            h.addEventListener("mousedown", (e) => {
                e.stopPropagation();
                e.preventDefault();
                selectFloatingObject(box);

                const zoom = parseFloat(spreadsheetContent.style.zoom || "1") || 1;
                const startX = e.clientX;
                const startY = e.clientY;
                const initLeft = parseFloat(box.dataset.initialLeft || box.style.left) || 0;
                const initTop = parseFloat(box.dataset.initialTop || box.style.top) || 0;
                const initW = box.offsetWidth;
                const initH = box.offsetHeight;
                const deg = parseFloat(box.dataset.rotation || "0") || 0;
                const rad = (-deg * Math.PI) / 180;
                const cos = Math.cos(rad);
                const sin = Math.sin(rad);

                const onResizeMove = (ev) => {
                    const screenDx = (ev.clientX - startX) / zoom;
                    const screenDy = (ev.clientY - startY) / zoom;
                    // 回転角度を考慮したオブジェクトローカル座標系での変化量
                    const dx = screenDx * cos - screenDy * sin;
                    const dy = screenDx * sin + screenDy * cos;

                    let newW = initW;
                    let newH = initH;
                    let newLeft = initLeft;
                    let newTop = initTop;

                    if (dir.includes("e")) newW = Math.max(60, initW + dx);
                    if (dir.includes("s")) newH = Math.max(28, initH + dy);
                    if (dir.includes("w")) {
                        const actualDx = Math.min(dx, initW - 60);
                        newW = initW - actualDx;
                        newLeft = initLeft + actualDx * Math.cos(-rad);
                        newTop = initTop + actualDx * Math.sin(-rad);
                    }
                    if (dir.includes("n")) {
                        const actualDy = Math.min(dy, initH - 28);
                        newH = initH - actualDy;
                        newLeft -= actualDy * Math.sin(-rad);
                        newTop += actualDy * Math.cos(-rad);
                    }

                    box.style.width = `${Math.round(newW)}px`;
                    box.style.height = `${Math.round(newH)}px`;
                    box.style.left = `${Math.round(newLeft)}px`;
                    box.style.top = `${Math.round(newTop)}px`;
                    box.dataset.initialLeft = String(Math.round(newLeft));
                    box.dataset.initialTop = String(Math.round(newTop));
                    updateResizeTooltip(ev.clientX, ev.clientY, `${Math.round(newW)} × ${Math.round(newH)}px`);
                    setDirtyState(true);
                };

                const onResizeUp = () => {
                    document.removeEventListener("mousemove", onResizeMove);
                    document.removeEventListener("mouseup", onResizeUp);
                    hideResizeTooltip();
                    debouncedSaveState();
                };

                document.addEventListener("mousemove", onResizeMove, { signal });
                document.addEventListener("mouseup", onResizeUp, { signal });
            }, { signal });
        });
    }

    function removeFloatingObject(box) {
        if (!box) return;
        box._abortController?.abort();
        box._abortController = null;
        box.remove();
    }

    function enableTextboxDragging(box) {
        box._abortController?.abort();
        const boxAbort = new AbortController();
        box._abortController = boxAbort;
        const boxSignal = boxAbort.signal;
        const onAppAbort = () => boxAbort.abort(); // ★ここを変更（終了時の自動解除を綺麗に管理）
        signal.addEventListener("abort", onAppAbort, { once: true });
        boxSignal.addEventListener("abort", () => {
            signal.removeEventListener("abort", onAppAbort);
        }, { once: true });

        let isDragging = false;
        let isPendingDrag = false;
        let startX = 0, startY = 0;
        let downX = 0, downY = 0;
        let mouseX = 0, mouseY = 0;

        box.dataset.initialLeft = String(parseFloat(box.style.left) || 0);
        box.dataset.initialTop = String(parseFloat(box.style.top) || 0);
        if (box.dataset.rotation) {
            applyObjectRotation(box, parseFloat(box.dataset.rotation));
        }
        attachObjectHandles(box);

        box.addEventListener("mousedown", (e) => {
            if (e.button !== 0) return;
            selectFloatingObject(box);
            if (e.target.closest(".ss-obj-handle, .ss-obj-rotate-handle, .floating-textbox-delete, .floating-chart-settings")) return;

            const editor = box.querySelector(".floating-textbox-editor");
            if (editor && document.activeElement === editor) {
                const rect = box.getBoundingClientRect();
                const nearEdge =
                    e.clientX - rect.left <= 8 ||
                    rect.right - e.clientX <= 8 ||
                    e.clientY - rect.top <= 8 ||
                    rect.bottom - e.clientY <= 8;
                if (!nearEdge) return;
            }

            isPendingDrag = true;
            downX = e.clientX;
            downY = e.clientY;
            const zoom = parseFloat(spreadsheetContent.style.zoom || "1") || 1;
            startX = e.clientX - (parseFloat(box.dataset.initialLeft) * zoom - container.scrollLeft);
            startY = e.clientY - (parseFloat(box.dataset.initialTop) * zoom - container.scrollTop);
            mouseX = e.clientX;
            mouseY = e.clientY;
        }, { signal: boxSignal }); // ★ここを変更

        const updatePosition = (cx, cy) => {
            const zoom = parseFloat(spreadsheetContent.style.zoom || "1") || 1;
            mouseX = cx;
            mouseY = cy;
            const newLeft = Math.max(0, (mouseX - startX + container.scrollLeft) / zoom);
            const newTop = Math.max(0, (mouseY - startY + container.scrollTop) / zoom);
            box.dataset.initialLeft = String(newLeft);
            box.dataset.initialTop = String(newTop);
            box.style.left = `${newLeft}px`;
            box.style.top = `${newTop}px`;
            setDirtyState(true);
        };

        document.addEventListener("mousemove", (e) => {
            if (isPendingDrag && !isDragging) {
                if (Math.hypot(e.clientX - downX, e.clientY - downY) < 3) return;
                isDragging = true;
                box.style.userSelect = "none";
            }
            if (isDragging) updatePosition(e.clientX, e.clientY);
        }, { signal: boxSignal });

        container.addEventListener("scroll", () => {
            if (isDragging) updatePosition(mouseX, mouseY);
        }, { passive: true, signal: boxSignal });

        document.addEventListener("mouseup", () => {
            isPendingDrag = false;
            if (isDragging) {
                isDragging = false;
                box.style.userSelect = "auto";
                debouncedSaveState();
            }
        }, { signal: boxSignal });

        box.addEventListener("keydown", (e) => {
            const editor = box.querySelector(".floating-textbox-editor");
            if (editor && document.activeElement === editor) return;
            if (e.key === "Delete" || e.key === "Backspace") {
                e.preventDefault();
                removeFloatingObject(box); // ★ここを変更
                setDirtyState(true);
                debouncedSaveState();
            } else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
                e.preventDefault();
                const step = e.shiftKey ? 10 : 1;
                let l = parseFloat(box.dataset.initialLeft || "0");
                let t = parseFloat(box.dataset.initialTop || "0");
                if (e.key === "ArrowLeft") l = Math.max(0, l - step);
                if (e.key === "ArrowRight") l += step;
                if (e.key === "ArrowUp") t = Math.max(0, t - step);
                if (e.key === "ArrowDown") t += step;
                box.dataset.initialLeft = String(l);
                box.dataset.initialTop = String(t);
                box.style.left = `${l}px`;
                box.style.top = `${t}px`;
                setDirtyState(true);
                debouncedSaveState();
            }
        }, { signal: boxSignal }); // ★ここを変更

        box.addEventListener("input", () => {
            setDirtyState(true);
            debouncedSaveState();
        }, { signal: boxSignal }); // ★ここを変更
    }

    // グリッドクリック時にテキストボックス・グラフの選択状態を解除
    tbody.addEventListener("mousedown", () => {
        selectFloatingObject(null);
    }, { signal });

    function insertTextBox(opts = {}, { silent = false } = {}) {
        const zoom = parseFloat(spreadsheetContent.style.zoom || "1") || 1;
        const defaultLeft = `${Math.round(container.scrollLeft / zoom + 120)}px`;
        const defaultTop = `${Math.round(container.scrollTop / zoom + 90)}px`;

        const box = document.createElement("div");
        box.tabIndex = 0;
        box.className = "floating-textbox";
        if (opts.rotation) box.dataset.rotation = String(opts.rotation);
        Object.assign(box.style, {
            left: opts.left || defaultLeft,
            top: opts.top || defaultTop,
            width: opts.width || "260px",
            height: opts.height || "120px",
            border: "1px solid gray",
            background: "white",
            padding: "6px 22px 6px 8px"
        });

        const editor = document.createElement("div");
        editor.className = "floating-textbox-editor";
        editor.contentEditable = "true";
        editor.innerHTML = opts.content ?? "テキスト";
        Object.assign(editor.style, {
            width: "100%",
            height: "100%",
            outline: "none",
            cursor: "text",
            overflow: "hidden"
        });
        box.appendChild(editor);

        const delBtn = document.createElement("span");
        delBtn.className = "floating-textbox-delete";
        delBtn.contentEditable = "false";
        delBtn.textContent = "×";
        delBtn.title = "テキストボックスを削除";
        delBtn.addEventListener("mousedown", (e) => {
            e.stopPropagation();
            e.preventDefault();
            removeFloatingObject(box); // ★ここを変更
            setDirtyState(true);
            debouncedSaveState();
        }, { signal });
        box.appendChild(delBtn);

        spreadsheetContent.appendChild(box);
        enableTextboxDragging(box);
        if (!silent) {
            selectFloatingObject(box);
            setDirtyState(true);
            debouncedSaveState();
        }
    }

    function escapeSvgText(str) {
        return String(str ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function computeNiceAxisMax(rawMax) {
        if (rawMax <= 0) return 10;
        const exp = Math.pow(10, Math.floor(Math.log10(rawMax)));
        const frac = rawMax / exp;
        let niceFrac = 10;
        if (frac <= 1) niceFrac = 1;
        else if (frac <= 2) niceFrac = 2;
        else if (frac <= 2.5) niceFrac = 2.5;
        else if (frac <= 5) niceFrac = 5;
        return niceFrac * exp;
    }

    const CHART_COLOR_THEMES = {
        office: ["#1f4e78", "#c65911", "#375623", "#7030a0", "#bf8f00", "#008080", "#2f75b5", "#a61c1c"],
        warm: ["#c0392b", "#e67e22", "#f1c40f", "#d35400", "#a93226", "#f39c12", "#8e44ad", "#b7950b"],
        vivid: ["#0078d4", "#107c10", "#d13438", "#ff8c00", "#8764b8", "#00b7c3", "#e3008c", "#498205"],
        mono: ["#222222", "#555555", "#7f7f7f", "#a6a6a6", "#3b3b3b", "#6e6e6e", "#949494", "#bdbdbd"]
    };

    function drawLinearTrendlineSvg(points, color) {
        if (!points || points.length < 2) return "";
        const n = points.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        for (let i = 0; i < n; i++) {
            sumX += points[i].x;
            sumY += points[i].y;
            sumXY += points[i].x * points[i].y;
            sumXX += points[i].x * points[i].x;
        }
        const denom = n * sumXX - sumX * sumX;
        if (Math.abs(denom) < 1e-9) return "";
        const slope = (n * sumXY - sumX * sumY) / denom;
        const intercept = (sumY - slope * sumX) / n;
        const minX = Math.min(...points.map(p => p.x));
        const maxX = Math.max(...points.map(p => p.x));
        const y1 = slope * minX + intercept;
        const y2 = slope * maxX + intercept;
        return `<line x1="${minX.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${maxX.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="1.6" stroke-dasharray="5,3" opacity="0.85" />`;
    }

    function renderChartBoxSVG(chartBox) {
        const rangeStr = chartBox.dataset.sourceRange;
        const chartType = chartBox.dataset.chartType || "bar";
        const chartTitle = (chartBox.dataset.chartTitle || "").trim();
        const showLabels = chartBox.dataset.showLabels === "1";
        const showTrendline = chartBox.dataset.trendline === "1";
        const useSecondaryAxis = chartBox.dataset.secondaryAxis === "1";
        const themeKey = chartBox.dataset.colorTheme || "office";
        const xAxisTitle = (chartBox.dataset.xAxisTitle || "").trim();
        const yAxisTitle = (chartBox.dataset.yAxisTitle || "").trim();
        const bounds = rangeStr ? parseRangeReference(rangeStr) : null;
        if (!bounds) return false;

        const minR = Math.min(bounds.start.row, bounds.end.row);
        const maxR = Math.max(bounds.start.row, bounds.end.row);
        const minC = Math.min(bounds.start.col, bounds.end.col);
        const maxC = Math.max(bounds.start.col, bounds.end.col);
        if (maxC <= minC) return false;

        // 1行目が見出し行（数値を含まないテキスト行）かどうかを自動判定
        let dataStartR = minR;
        if (maxR - minR >= 1) {
            const firstRowVals = [];
            for (let c = minC + 1; c <= maxC; c++) {
                const v = parseFormattedNumber(getVisibleCell(minR, c)?.dataset.rawValue ?? getVisibleCell(minR, c)?.textContent ?? "");
                firstRowVals.push(v);
            }
            if (firstRowVals.every(v => isNaN(v))) {
                dataStartR = minR + 1;
            }
        }

        const seriesNames = [];
        for (let c = minC + 1; c <= maxC; c++) {
            const hText = dataStartR > minR ? (getVisibleCell(minR, c)?.textContent || "").trim() : "";
            seriesNames.push(hText || `系列${c - minC}`);
        }

        const categories = [];
        const xNumericVals = [];
        const seriesData = seriesNames.map(() => []);
        for (let r = dataStartR; r <= maxR; r++) {
            const catCell = getVisibleCell(r, minC);
            const catRaw = catCell?.dataset.rawValue ?? catCell?.textContent ?? "";
            const catText = (catCell?.textContent || `項目${r - dataStartR + 1}`).trim();
            const parsedX = parseFormattedNumber(catRaw);
            const rowNums = [];
            let hasAnyNum = false;
            for (let c = minC + 1; c <= maxC; c++) {
                const num = parseFormattedNumber(getVisibleCell(r, c)?.dataset.rawValue ?? getVisibleCell(r, c)?.textContent ?? "");
                if (!isNaN(num)) {
                    hasAnyNum = true;
                    rowNums.push(num);
                } else {
                    rowNums.push(0);
                }
            }
            if (hasAnyNum) {
                categories.push(catText);
                xNumericVals.push(!isNaN(parsedX) ? parsedX : (categories.length));
                rowNums.forEach((n, idx) => seriesData[idx].push(n));
            }
        }
        if (!categories.length) return false;

        const canUseSecondary = useSecondaryAxis && seriesData.length >= 2 && (chartType === "bar" || chartType === "line");
        const w = 400, h = 250;
        const topPad = (chartTitle ? 24 : 10) + (seriesNames.length > 1 && chartType !== "pie" ? 18 : 0);
        const leftPad = (chartType === "hbar" ? 68 : 44) + (yAxisTitle ? 14 : 0);
        const rightPad = canUseSecondary ? 44 : 14;
        const bottomPad = 28 + (xAxisTitle ? 14 : 0);
        const plotW = w - leftPad - rightPad;
        const plotH = h - topPad - bottomPad;
        const colors = CHART_COLOR_THEMES[themeKey] || CHART_COLOR_THEMES.office;
        let innerSvg = "";

        if (chartTitle) {
            innerSvg += `<text x="${w / 2}" y="15" font-size="12" font-weight="bold" text-anchor="middle" fill="#222">${escapeSvgText(chartTitle)}</text>`;
        }

        if (seriesNames.length > 1 && chartType !== "pie") {
            const legendY = chartTitle ? 31 : 13;
            let lx = leftPad;
            seriesNames.forEach((sName, sIdx) => {
                const col = colors[sIdx % colors.length];
                const isSecLine = canUseSecondary && sIdx === seriesData.length - 1;
                innerSvg += isSecLine
                    ? `<line x1="${lx}" y1="${legendY - 4}" x2="${lx + 10}" y2="${legendY - 4}" stroke="${col}" stroke-width="2.5" />`
                    : `<rect x="${lx}" y="${legendY - 8}" width="9" height="9" fill="${col}" />`;
                innerSvg += `<text x="${lx + 12}" y="${legendY}" font-size="10" fill="#333">${escapeSvgText(sName.slice(0, 8))}</text>`;
                lx += Math.min(82, sName.length * 10 + 22);
            });
        }

        if (xAxisTitle && chartType !== "pie") {
            innerSvg += `<text x="${leftPad + plotW / 2}" y="${h - 4}" font-size="10" font-weight="bold" text-anchor="middle" fill="#333">${escapeSvgText(xAxisTitle)}</text>`;
        }
        if (yAxisTitle && chartType !== "pie") {
            const yMid = topPad + plotH / 2;
            innerSvg += `<text x="12" y="${yMid}" font-size="10" font-weight="bold" text-anchor="middle" fill="#333" transform="rotate(-90 12 ${yMid})">${escapeSvgText(yAxisTitle)}</text>`;
        }

        const primarySeries = canUseSecondary ? seriesData.slice(0, -1) : seriesData;
        const secondarySeries = canUseSecondary ? seriesData[seriesData.length - 1] : null;
        const primaryMax = chartType === "stacked"
            ? computeNiceAxisMax(Math.max(...categories.map((_, i) => seriesData.reduce((acc, s) => acc + Math.max(0, s[i]), 0)), 1))
            : computeNiceAxisMax(Math.max(...primarySeries.flat(), 1));
        const secondaryMax = secondarySeries ? computeNiceAxisMax(Math.max(...secondarySeries, 1)) : 1;

        if (chartType === "pie") {
            const vals = seriesData[0];
            const total = vals.reduce((a, b) => a + Math.max(0, b), 0) || 1;
            const cx = 128, cy = topPad + plotH / 2, radius = Math.min(78, plotH / 2 - 4);
            let startAngle = -Math.PI / 2;
            vals.forEach((v, i) => {
                const ratio = Math.max(0, v) / total;
                const endAngle = startAngle + ratio * Math.PI * 2;
                const x1 = cx + radius * Math.cos(startAngle);
                const y1 = cy + radius * Math.sin(startAngle);
                const x2 = cx + radius * Math.cos(endAngle);
                const y2 = cy + radius * Math.sin(endAngle);
                const largeArc = ratio > 0.5 ? 1 : 0;
                const color = colors[i % colors.length];
                innerSvg += `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${color}" stroke="#fff" stroke-width="1.5" />`;
                if (i < 8) {
                    const ly = topPad + 12 + i * 21;
                    const labelSuffix = showLabels ? `${v.toLocaleString()} (${Math.round(ratio * 100)}%)` : `${Math.round(ratio * 100)}%`;
                    innerSvg += `<rect x="228" y="${ly - 8}" width="10" height="10" fill="${color}" />
                                 <text x="242" y="${ly}" font-size="10" fill="#222">${escapeSvgText(categories[i].slice(0, 7))} ${labelSuffix}</text>`;
                }
                startAngle = endAngle;
            });
        } else if (chartType === "scatter") {
            const xMin = Math.min(...xNumericVals);
            const xMaxRaw = Math.max(...xNumericVals);
            const xSpan = Math.max(1e-6, xMaxRaw - xMin);
            const yAxisMax = computeNiceAxisMax(Math.max(...seriesData.flat(), 1));

            for (let t = 0; t <= 4; t++) {
                const yVal = (yAxisMax / 4) * t;
                const y = topPad + plotH - (plotH / 4) * t;
                innerSvg += `<line x1="${leftPad}" y1="${y}" x2="${w - rightPad}" y2="${y}" stroke="${t === 0 ? "#444" : "#e2e5e9"}" />
                             <text x="${leftPad - 5}" y="${y + 3}" font-size="9" text-anchor="end" fill="#555">${Math.round(yVal).toLocaleString()}</text>`;

                const xVal = xMin + (xSpan / 4) * t;
                const x = leftPad + (plotW / 4) * t;
                innerSvg += `<line x1="${x}" y1="${topPad}" x2="${x}" y2="${topPad + plotH}" stroke="${t === 0 ? "#444" : "#eef0f3"}" />
                             <text x="${x}" y="${topPad + plotH + 13}" font-size="9" text-anchor="middle" fill="#555">${Number(xVal.toFixed(1)).toLocaleString()}</text>`;
            }

            seriesData.forEach((sArr, sIdx) => {
                const col = colors[sIdx % colors.length];
                const pts = sArr.map((v, i) => ({
                    x: leftPad + ((xNumericVals[i] - xMin) / xSpan) * plotW,
                    y: topPad + plotH - (Math.max(0, v) / yAxisMax) * plotH,
                    v
                }));
                pts.forEach(p => {
                    innerSvg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.6" fill="${col}" opacity="0.88" />`;
                    if (showLabels) {
                        innerSvg += `<text x="${p.x.toFixed(1)}" y="${(p.y - 6).toFixed(1)}" font-size="8.5" text-anchor="middle" fill="#222">${p.v.toLocaleString()}</text>`;
                    }
                });
                if (showTrendline) {
                    innerSvg += drawLinearTrendlineSvg(pts, col);
                }
            });
        } else if (chartType === "hbar") {
            for (let t = 0; t <= 4; t++) {
                const val = (primaryMax / 4) * t;
                const x = leftPad + (plotW / 4) * t;
                innerSvg += `<line x1="${x}" y1="${topPad}" x2="${x}" y2="${topPad + plotH}" stroke="#e0e0e0" />
                             <text x="${x}" y="${topPad + plotH + 13}" font-size="9" text-anchor="middle" fill="#555">${Math.round(val).toLocaleString()}</text>`;
            }
            const groupH = plotH / categories.length;
            const barH = Math.max(4, (groupH - 6) / seriesData.length);
            categories.forEach((cat, i) => {
                const gy = topPad + i * groupH;
                innerSvg += `<text x="${leftPad - 5}" y="${gy + groupH / 2 + 3}" font-size="10" text-anchor="end" fill="#222">${escapeSvgText(cat.slice(0, 8))}</text>`;
                seriesData.forEach((sArr, sIdx) => {
                    const v = Math.max(0, sArr[i]);
                    const bw = (v / primaryMax) * plotW;
                    const by = gy + 3 + sIdx * barH;
                    innerSvg += `<rect x="${leftPad}" y="${by}" width="${bw}" height="${barH}" fill="${colors[sIdx % colors.length]}" />`;
                    if (showLabels) {
                        innerSvg += `<text x="${leftPad + bw + 3}" y="${by + barH / 2 + 3}" font-size="9" fill="#222">${v.toLocaleString()}</text>`;
                    }
                });
            });
            innerSvg += `<line x1="${leftPad}" y1="${topPad}" x2="${leftPad}" y2="${topPad + plotH}" stroke="#444" />`;
        } else {
            // Y軸目盛り線＆数値（縦棒・積み上げ・折れ線・複合第2軸共通）
            for (let t = 0; t <= 4; t++) {
                const val = (primaryMax / 4) * t;
                const y = topPad + plotH - (plotH / 4) * t;
                innerSvg += `<line x1="${leftPad}" y1="${y}" x2="${w - rightPad}" y2="${y}" stroke="${t === 0 ? "#444" : "#e2e5e9"}" />
                             <text x="${leftPad - 5}" y="${y + 3}" font-size="9" text-anchor="end" fill="#555">${Math.round(val).toLocaleString()}</text>`;
                if (canUseSecondary) {
                    const secVal = (secondaryMax / 4) * t;
                    innerSvg += `<text x="${w - rightPad + 5}" y="${y + 3}" font-size="9" text-anchor="start" fill="${colors[(seriesData.length - 1) % colors.length]}">${Math.round(secVal).toLocaleString()}</text>`;
                }
            }
            innerSvg += `<line x1="${leftPad}" y1="${topPad}" x2="${leftPad}" y2="${topPad + plotH}" stroke="#444" />`;
            if (canUseSecondary) {
                innerSvg += `<line x1="${w - rightPad}" y1="${topPad}" x2="${w - rightPad}" y2="${topPad + plotH}" stroke="${colors[(seriesData.length - 1) % colors.length]}" />`;
            }

            if (chartType === "line") {
                const stepX = categories.length > 1 ? plotW / (categories.length - 1) : plotW / 2;
                categories.forEach((cat, i) => {
                    const x = leftPad + (categories.length > 1 ? i * stepX : plotW / 2);
                    innerSvg += `<text x="${x}" y="${topPad + plotH + 13}" font-size="10" text-anchor="middle" fill="#222">${escapeSvgText(cat.slice(0, 6))}</text>`;
                });
                primarySeries.forEach((sArr, sIdx) => {
                    const col = colors[sIdx % colors.length];
                    const pts = sArr.map((v, i) => ({
                        x: leftPad + (categories.length > 1 ? i * stepX : plotW / 2),
                        y: topPad + plotH - (Math.max(0, v) / primaryMax) * plotH,
                        v
                    }));
                    innerSvg += `<polyline fill="none" stroke="${col}" stroke-width="2.2" points="${pts.map(p => `${p.x},${p.y}`).join(" ")}" />`;
                    pts.forEach(p => {
                        innerSvg += `<circle cx="${p.x}" cy="${p.y}" r="3.2" fill="${col}" />`;
                        if (showLabels) {
                            innerSvg += `<text x="${p.x}" y="${p.y - 6}" font-size="9" text-anchor="middle" fill="#222">${p.v.toLocaleString()}</text>`;
                        }
                    });
                    if (showTrendline) innerSvg += drawLinearTrendlineSvg(pts, col);
                });
            } else if (chartType === "stacked") {
                const groupW = plotW / categories.length;
                const barW = Math.max(8, groupW - 12);
                categories.forEach((cat, i) => {
                    const gx = leftPad + i * groupW;
                    const bx = gx + (groupW - barW) / 2;
                    innerSvg += `<text x="${gx + groupW / 2}" y="${topPad + plotH + 13}" font-size="10" text-anchor="middle" fill="#222">${escapeSvgText(cat.slice(0, 6))}</text>`;
                    let accH = 0;
                    let totalVal = 0;
                    seriesData.forEach((sArr, sIdx) => {
                        const v = Math.max(0, sArr[i]);
                        totalVal += v;
                        const bh = (v / primaryMax) * plotH;
                        const by = topPad + plotH - accH - bh;
                        accH += bh;
                        innerSvg += `<rect x="${bx}" y="${by}" width="${barW}" height="${bh}" fill="${colors[sIdx % colors.length]}" />`;
                    });
                    if (showLabels) {
                        innerSvg += `<text x="${gx + groupW / 2}" y="${topPad + plotH - accH - 3}" font-size="9" text-anchor="middle" fill="#222">${totalVal.toLocaleString()}</text>`;
                    }
                });
            } else {
                // 縦棒グラフ（複数系列並列対応）
                const groupW = plotW / categories.length;
                const barW = Math.max(5, (groupW - 8) / primarySeries.length);
                const trendPoints = primarySeries.map(() => []);
                categories.forEach((cat, i) => {
                    const gx = leftPad + i * groupW;
                    innerSvg += `<text x="${gx + groupW / 2}" y="${topPad + plotH + 13}" font-size="10" text-anchor="middle" fill="#222">${escapeSvgText(cat.slice(0, 6))}</text>`;
                    primarySeries.forEach((sArr, sIdx) => {
                        const v = Math.max(0, sArr[i]);
                        const bh = (v / primaryMax) * plotH;
                        const bx = gx + 4 + sIdx * barW;
                        const by = topPad + plotH - bh;
                        trendPoints[sIdx].push({ x: bx + barW / 2, y: by });
                        innerSvg += `<rect x="${bx}" y="${by}" width="${barW}" height="${bh}" fill="${colors[sIdx % colors.length]}" />`;
                        if (showLabels) {
                            innerSvg += `<text x="${bx + barW / 2}" y="${by - 3}" font-size="9" text-anchor="middle" fill="#222">${v.toLocaleString()}</text>`;
                        }
                    });
                });
                if (showTrendline) {
                    trendPoints.forEach((pts, sIdx) => {
                        innerSvg += drawLinearTrendlineSvg(pts, colors[sIdx % colors.length]);
                    });
                }
            }

            // 第2軸（最終系列を右Y軸基準の折れ線として重ね描き＝Excel複合グラフ）
            if (canUseSecondary && secondarySeries) {
                const secCol = colors[(seriesData.length - 1) % colors.length];
                const groupW = plotW / categories.length;
                const stepX = categories.length > 1 ? plotW / (categories.length - 1) : plotW / 2;
                const pts = secondarySeries.map((v, i) => ({
                    x: chartType === "line"
                        ? (leftPad + (categories.length > 1 ? i * stepX : plotW / 2))
                        : (leftPad + i * groupW + groupW / 2),
                    y: topPad + plotH - (Math.max(0, v) / secondaryMax) * plotH,
                    v
                }));
                innerSvg += `<polyline fill="none" stroke="${secCol}" stroke-width="2.4" points="${pts.map(p => `${p.x},${p.y}`).join(" ")}" />`;
                pts.forEach(p => {
                    innerSvg += `<circle cx="${p.x}" cy="${p.y}" r="3.4" fill="#fff" stroke="${secCol}" stroke-width="2" />`;
                    if (showLabels) {
                        innerSvg += `<text x="${p.x}" y="${p.y - 7}" font-size="9" text-anchor="middle" fill="${secCol}">${p.v.toLocaleString()}</text>`;
                    }
                });
                if (showTrendline) innerSvg += drawLinearTrendlineSvg(pts, secCol);
            }
        }

        const oldSvg = chartBox.querySelector("svg");
        if (oldSvg) oldSvg.remove();
        chartBox.insertAdjacentHTML("afterbegin", `<svg width="100%" height="100%" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${innerSvg}</svg>`);
        return true;
    }

    function openChartSettingsDialog(chartBox) {
        const curType = chartBox.dataset.chartType || "bar";
        const curTitle = chartBox.dataset.chartTitle || "";
        const curRange = chartBox.dataset.sourceRange || "";
        const curLabels = chartBox.dataset.showLabels === "1";
        const curTrend = chartBox.dataset.trendline === "1";
        const curSecAxis = chartBox.dataset.secondaryAxis === "1";
        const curTheme = chartBox.dataset.colorTheme || "office";
        const curXTitle = chartBox.dataset.xAxisTitle || "";
        const curYTitle = chartBox.dataset.yAxisTitle || "";

        const bodyHtml = `
            <div style="width:100%; display:flex; flex-direction:column; gap:7px; font-size:12px;">
                <div style="display:flex; align-items:center; gap:6px;">
                    <label style="width:88px;">グラフ種類:</label>
                    <select class="ss-ch-type border" style="flex:1; height:24px; background:#fff; color:#000;">
                        <option value="bar" ${curType === "bar" ? "selected" : ""}>縦棒グラフ</option>
                        <option value="stacked" ${curType === "stacked" ? "selected" : ""}>積み上げ縦棒グラフ</option>
                        <option value="hbar" ${curType === "hbar" ? "selected" : ""}>横棒グラフ</option>
                        <option value="line" ${curType === "line" ? "selected" : ""}>折れ線グラフ</option>
                        <option value="pie" ${curType === "pie" ? "selected" : ""}>円グラフ</option>
                        <option value="scatter" ${curType === "scatter" ? "selected" : ""}>散布図 (XY)</option>
                    </select>
                </div>
                <div style="display:flex; align-items:center; gap:6px;">
                    <label style="width:88px;">カラーテーマ:</label>
                    <select class="ss-ch-theme border" style="flex:1; height:24px; background:#fff; color:#000;">
                        <option value="office" ${curTheme === "office" ? "selected" : ""}>Office 標準</option>
                        <option value="vivid" ${curTheme === "vivid" ? "selected" : ""}>ビビッド</option>
                        <option value="warm" ${curTheme === "warm" ? "selected" : ""}>暖色系</option>
                        <option value="mono" ${curTheme === "mono" ? "selected" : ""}>モノトーン</option>
                    </select>
                </div>
                <div style="display:flex; align-items:center; gap:6px;">
                    <label style="width:88px;">タイトル:</label>
                    <input type="text" class="ss-ch-title border" value="${escapeSvgText(curTitle)}" placeholder="例: 月別売上推移" style="flex:1; padding:3px 6px; background:#fff; color:#000;">
                </div>
                <div style="display:flex; align-items:center; gap:6px;">
                    <label style="width:88px;">データ範囲:</label>
                    <input type="text" class="ss-ch-range border" value="${escapeSvgText(curRange)}" placeholder="例: A1:D6" style="flex:1; padding:3px 6px; background:#fff; color:#000;">
                </div>
                <div style="display:flex; align-items:center; gap:6px;">
                    <label style="width:88px;">軸タイトル:</label>
                    <input type="text" class="ss-ch-xtitle border" value="${escapeSvgText(curXTitle)}" placeholder="横軸 (X)" style="flex:1; padding:3px 5px; background:#fff; color:#000;">
                    <input type="text" class="ss-ch-ytitle border" value="${escapeSvgText(curYTitle)}" placeholder="縦軸 (Y)" style="flex:1; padding:3px 5px; background:#fff; color:#000;">
                </div>
                <label style="display:inline-flex; align-items:center; gap:5px; cursor:pointer;">
                    <input type="checkbox" class="ss-ch-labels" ${curLabels ? "checked" : ""}> データラベル（数値）を表示する
                </label>
                <label style="display:inline-flex; align-items:center; gap:5px; cursor:pointer;">
                    <input type="checkbox" class="ss-ch-trend" ${curTrend ? "checked" : ""}> 近似曲線（線形トレンドライン）を表示
                </label>
                <label style="display:inline-flex; align-items:center; gap:5px; cursor:pointer;">
                    <input type="checkbox" class="ss-ch-secaxis" ${curSecAxis ? "checked" : ""}> 最終系列を第2軸（右Y軸・折れ線）で複合表示
                </label>
            </div>
        `;
        const modalContent = openAppModal("グラフの設定", bodyHtml, {
            width: 400,
            isHtml: true,
            parentWin: win,
            buttons: [
                {
                    label: "適用",
                    onClick: () => {
                        const nextType = modalContent.querySelector(".ss-ch-type").value;
                        const nextTheme = modalContent.querySelector(".ss-ch-theme").value;
                        const nextTitle = modalContent.querySelector(".ss-ch-title").value.trim();
                        const nextRange = modalContent.querySelector(".ss-ch-range").value.trim().toUpperCase();
                        const nextXTitle = modalContent.querySelector(".ss-ch-xtitle").value.trim();
                        const nextYTitle = modalContent.querySelector(".ss-ch-ytitle").value.trim();
                        const nextLabels = modalContent.querySelector(".ss-ch-labels").checked;
                        const nextTrend = modalContent.querySelector(".ss-ch-trend").checked;
                        const nextSecAxis = modalContent.querySelector(".ss-ch-secaxis").checked;

                        const prevType = chartBox.dataset.chartType;
                        const prevRange = chartBox.dataset.sourceRange;
                        chartBox.dataset.chartType = nextType;
                        chartBox.dataset.colorTheme = nextTheme;
                        chartBox.dataset.chartTitle = nextTitle;
                        chartBox.dataset.sourceRange = nextRange;
                        chartBox.dataset.xAxisTitle = nextXTitle;
                        chartBox.dataset.yAxisTitle = nextYTitle;
                        chartBox.dataset.showLabels = nextLabels ? "1" : "0";
                        chartBox.dataset.trendline = nextTrend ? "1" : "0";
                        chartBox.dataset.secondaryAxis = nextSecAxis ? "1" : "0";

                        if (!renderChartBoxSVG(chartBox)) {
                            chartBox.dataset.chartType = prevType;
                            chartBox.dataset.sourceRange = prevRange;
                            renderChartBoxSVG(chartBox);
                            showAlert("指定されたデータ範囲が正しくないか、数値データがありません。", "グラフ設定");
                            return;
                        }
                        setDirtyState(true);
                        debouncedSaveState();
                    }
                },
                { label: "キャンセル" }
            ]
        });
    }

    function attachChartControls(chartBox) {
        chartBox.querySelectorAll(".floating-textbox-delete, .floating-chart-settings").forEach(el => el.remove());

        const setBtn = document.createElement("span");
        setBtn.className = "floating-chart-settings";
        setBtn.textContent = "⚙";
        setBtn.title = "グラフの種類・タイトル・範囲を設定";
        setBtn.addEventListener("mousedown", (e) => {
            e.stopPropagation();
            e.preventDefault();
            openChartSettingsDialog(chartBox);
        }, { signal });
        chartBox.appendChild(setBtn);

        const delBtn = document.createElement("span");
        delBtn.className = "floating-textbox-delete";
        delBtn.textContent = "×";
        delBtn.title = "グラフを削除";
        delBtn.addEventListener("mousedown", (e) => {
            e.stopPropagation();
            e.preventDefault();
            removeFloatingObject(chartBox); // ★ここを変更
            setDirtyState(true);
            debouncedSaveState();
        }, { signal });
        chartBox.appendChild(delBtn);

        chartBox.addEventListener("dblclick", (e) => {
            e.stopPropagation();
            openChartSettingsDialog(chartBox);
        }, { signal });
    }

    function updateAllFloatingCharts() {
        spreadsheetContent.querySelectorAll(".floating-chart[data-source-range]").forEach(box => {
            renderChartBoxSVG(box);
        });
    }

    function insertFloatingChart(chartType = "bar") {
        const bounds = getSelectedRangeBounds();
        if (!bounds || (bounds.minRow === bounds.maxRow && bounds.minCol === bounds.maxCol)) {
            showAlert("グラフ化するデータ範囲（2列以上）を選択してください。", "グラフ挿入");
            return;
        }

        const rangeStr = `${getCellReferenceByCoord(bounds.minRow, bounds.minCol)}:${getCellReferenceByCoord(bounds.maxRow, bounds.maxCol)}`;
        const chartBox = document.createElement("div");
        chartBox.tabIndex = 0;
        chartBox.className = "floating-textbox floating-chart";
        chartBox.dataset.chartType = chartType;
        chartBox.dataset.sourceRange = rangeStr;
        Object.assign(chartBox.style, {
            left: "140px",
            top: "100px",
            width: "380px",
            height: "240px",
            background: "#fff",
            padding: "6px"
        });

        if (!renderChartBoxSVG(chartBox)) {
            showAlert("選択範囲に数値データが見つかりません。", "グラフ挿入");
            return;
        }

        attachChartControls(chartBox);
        spreadsheetContent.appendChild(chartBox);
        enableTextboxDragging(chartBox);
        selectFloatingObject(chartBox);
        refreshVisibleFloatingObjects();
        setDirtyState(true);
        debouncedSaveState();
    }

    // =========================================================
    // セル範囲とフローティング要素（テキストボックス・グラフ）の連動ヘルパー
    // =========================================================
    function getRangeLocalRect(bounds) {
        if (!bounds) return null;
        const theadHeight = theadRow.offsetHeight || 30;
        const rowHeaderWidth = parseInt(colgroup.children[0]?.style.width, 10) || 54;

        let left = rowHeaderWidth;
        for (let c = 0; c < bounds.minCol; c++) {
            left += getColumnWidth(c);
        }
        let right = left;
        for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
            right += getColumnWidth(c);
        }

        const getRowHeightPx = (r) => {
            const tr = getRow(r);
            if (!tr || tr.style.display === "none") return 0;
            return parseInt(tr.style.height, 10) || tr.offsetHeight || 30;
        };

        let top = theadHeight;
        for (let r = 1; r < bounds.minRow; r++) {
            top += getRowHeightPx(r);
        }
        let bottom = top;
        for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
            bottom += getRowHeightPx(r);
        }
        return { left, top, right, bottom };
    }

    function getFloatingObjectsInBounds(bounds) {
        const rangeRect = getRangeLocalRect(bounds);
        if (!rangeRect) return [];

        const matched = [];
        spreadsheetContent.querySelectorAll(".floating-textbox").forEach(box => {
            const bLeft = parseFloat(box.dataset.initialLeft || box.style.left) || 0;
            const bTop = parseFloat(box.dataset.initialTop || box.style.top) || 0;
            const bW = parseFloat(box.style.width) || box.offsetWidth || 60;
            const bH = parseFloat(box.style.height) || box.offsetHeight || 28;
            const cx = bLeft + bW / 2;
            const cy = bTop + bH / 2;

            const isCenterInside =
                cx >= rangeRect.left && cx <= rangeRect.right &&
                cy >= rangeRect.top && cy <= rangeRect.bottom;
            const isFullyInside =
                bLeft >= rangeRect.left - 2 && bTop >= rangeRect.top - 2 &&
                (bLeft + bW) <= rangeRect.right + 2 && (bTop + bH) <= rangeRect.bottom + 2;

            if (isCenterInside || isFullyInside) {
                matched.push(box);
            }
        });
        return matched;
    }

    function snapshotFloatingObject(box, originRect) {
        const isChart = box.classList.contains("floating-chart");
        const editor = box.querySelector(".floating-textbox-editor");
        const bLeft = parseFloat(box.dataset.initialLeft || box.style.left) || 0;
        const bTop = parseFloat(box.dataset.initialTop || box.style.top) || 0;
        return {
            type: isChart ? "chart" : "textbox",
            relLeft: bLeft - originRect.left,
            relTop: bTop - originRect.top,
            width: box.style.width || `${box.offsetWidth}px`,
            height: box.style.height || `${box.offsetHeight}px`,
            rotation: parseFloat(box.dataset.rotation || "0") || 0,
            content: editor ? editor.innerHTML : "",
            chartType: box.dataset.chartType || "bar",
            chartTitle: box.dataset.chartTitle || "",
            showLabels: box.dataset.showLabels === "1",
            trendline: box.dataset.trendline === "1",
            secondaryAxis: box.dataset.secondaryAxis === "1",
            colorTheme: box.dataset.colorTheme || "office",
            xAxisTitle: box.dataset.xAxisTitle || "",
            yAxisTitle: box.dataset.yAxisTitle || "",
            sourceRange: box.dataset.sourceRange || "",
            textStyle: {
                fontSize: box.style.fontSize || "",
                fontWeight: box.style.fontWeight || "",
                fontStyle: box.style.fontStyle || "",
                textDecoration: box.style.textDecoration || "",
                color: box.style.color || "",
                backgroundColor: box.style.backgroundColor || "",
                textAlign: box.style.textAlign || ""
            }
        };
    }

    function spawnFloatingObjectFromSnapshot(snap, destRect, rowDelta = 0, colDelta = 0) {
        const nextLeft = `${Math.max(0, Math.round(destRect.left + snap.relLeft))}px`;
        const nextTop = `${Math.max(0, Math.round(destRect.top + snap.relTop))}px`;

        if (snap.type === "chart") {
            const chartBox = document.createElement("div");
            chartBox.tabIndex = 0;
            chartBox.className = "floating-textbox floating-chart";
            chartBox.dataset.chartType = snap.chartType || "bar";
            if (snap.chartTitle) chartBox.dataset.chartTitle = snap.chartTitle;
            if (snap.showLabels) chartBox.dataset.showLabels = "1";
            if (snap.trendline) chartBox.dataset.trendline = "1";
            if (snap.secondaryAxis) chartBox.dataset.secondaryAxis = "1";
            if (snap.colorTheme) chartBox.dataset.colorTheme = snap.colorTheme;
            if (snap.xAxisTitle) chartBox.dataset.xAxisTitle = snap.xAxisTitle;
            if (snap.yAxisTitle) chartBox.dataset.yAxisTitle = snap.yAxisTitle;
            if (snap.rotation) chartBox.dataset.rotation = String(snap.rotation);

            let nextRange = snap.sourceRange || "";
            if (nextRange && (rowDelta !== 0 || colDelta !== 0)) {
                const shifted = adjustFormula("=" + nextRange, rowDelta, colDelta);
                if (shifted.startsWith("=")) nextRange = shifted.slice(1);
            }
            if (nextRange) chartBox.dataset.sourceRange = nextRange;

            Object.assign(chartBox.style, {
                left: nextLeft,
                top: nextTop,
                width: snap.width || "380px",
                height: snap.height || "240px",
                background: "#fff",
                padding: "6px"
            });

            if (!renderChartBoxSVG(chartBox) && snap.sourceRange) {
                chartBox.dataset.sourceRange = snap.sourceRange;
                renderChartBoxSVG(chartBox);
            }
            attachChartControls(chartBox);
            spreadsheetContent.appendChild(chartBox);
            enableTextboxDragging(chartBox);
            return chartBox;
        }

        insertTextBox({
            left: nextLeft,
            top: nextTop,
            width: snap.width,
            height: snap.height,
            rotation: snap.rotation,
            content: snap.content
        }, { silent: true });

        const created = spreadsheetContent.lastElementChild;
        if (created && created.classList.contains("floating-textbox") && snap.textStyle) {
            Object.entries(snap.textStyle).forEach(([k, v]) => {
                if (v) created.style[k] = v;
            });
        }
        return created;
    }

    // =========================================================
    // 仮想FS（Nexser OS）保存・読込・CSV出力エンジン（非圧縮JSON）
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

    function captureCurrentSheetDOM({ flush = true } = {}) {
        if (flush) {
            flushPendingEdits();
        }

        const savedCells = [];
        const mergeKeys = ["mergeAnchorRow", "mergeAnchorCol", "mergeMinRow", "mergeMinCol", "mergeMaxRow", "mergeMaxCol"];

        const rowsList = tbody.rows;
        for (let rIdx = 0; rIdx < rowsList.length; rIdx++) {
            const cells = rowsList[rIdx].cells;
            for (let cIdx = 1; cIdx < cells.length; cIdx++) {
                const cell = cells[cIdx];
                const r = rIdx + 1;
                const c = cIdx - 1;
                const v = cell.dataset.rawValue ?? cell.textContent;
                const f = (cell.dataset.formula || "").trim();
                const nf = cell.dataset.numFormat || "";
                const dp = cell.dataset.decimalPlaces ?? "";
                const st = extractCellStyleObject(cell);
                const cs = parseInt(cell.getAttribute("colspan") || "1", 10);
                const rs = parseInt(cell.getAttribute("rowspan") || "1", 10);

                const merge = {};
                let hasMergeMeta = false;
                for (const k of mergeKeys) {
                    if (cell.dataset[k] != null) {
                        merge[k] = cell.dataset[k];
                        hasMergeMeta = true;
                    }
                }

                const dl = cell.dataset.dropdownList || "";
                const dvr = cell.dataset.dvRule || "";
                const rr = cell.dataset.richRuns || "";
                const hl = cell.dataset.hyperlink || "";
                const nt = cell.dataset.note || "";
                const cm = cell.dataset.comment || "";
                const ind = cell.dataset.indent || "";
                const sh = cell.dataset.shrinkToFit === "1";
                const rot = cell.dataset.textRotation || "";
                const lk = cell.dataset.locked === "0" ? "0" : "";
                const fh = cell.dataset.formulaHidden === "1";
                if (cell.dataset.spillOrigin) continue;
                if (
                    v === "" && !f && !nf && !dl && !dvr && !rr && !hl &&
                    !nt && !cm && !ind && !sh && !rot && !lk && !fh &&
                    !st && cs === 1 && rs === 1 && !hasMergeMeta
                ) {
                    continue;
                }

                const entry = { r, c };
                if (v !== "") entry.v = v;
                if (f !== "") entry.f = f;
                if (nf !== "") entry.nf = nf;
                if (dp !== "") entry.dp = dp;
                if (dl !== "") entry.dl = dl;
                if (dvr !== "") entry.dvr = dvr;
                if (rr !== "") entry.rr = rr;
                if (hl !== "") entry.hl = hl;
                if (nt !== "") entry.nt = nt;
                if (cm !== "") entry.cm = cm;
                if (ind !== "") entry.ind = ind;
                if (sh) entry.sh = 1;
                if (rot !== "") entry.rot = rot;
                if (lk !== "") entry.lk = lk;
                if (fh) entry.fh = 1;
                if (st) entry.st = st;
                if (cs > 1) entry.cs = cs;
                if (rs > 1) entry.rs = rs;
                if (hasMergeMeta) entry.merge = merge;
                if (cell.dataset.valueType) entry.vt = cell.dataset.valueType;
                if (cell.dataset.dateValue) entry.dv = cell.dataset.dateValue;
                if (cell.dataset.quotePrefix === "1") entry.qp = 1;

                savedCells.push(entry);
            }
        }

        const savedRows = Array.from(tbody.querySelectorAll("tr"))
            .map(tr => {
                const h = tr.style.height || "";
                const hidden = tr.dataset.userHidden === "1";
                if (!h && !hidden) return null;
                const obj = { r: parseInt(tr.dataset.row, 10) };
                if (h) obj.h = h;
                if (hidden) obj.hidden = 1;
                return obj;
            })
            .filter(Boolean);

        const savedColumns = [];
        for (let c = 0; c < currentColumns; c++) {
            const colEl = colgroup.children[c + 1];
            const thEl = theadRow.children[c + 1];
            const hidden = Boolean(thEl?.classList.contains("ss-col-hidden"));
            const w = hidden ? (colEl?.dataset.prevWidth || "120px") : (colEl?.style.width || "120px");
            if (hidden || w !== "120px") {
                const obj = { c, w };
                if (hidden) obj.hidden = 1;
                savedColumns.push(obj);
            }
        }

        const textboxes = Array.from(spreadsheetContent.querySelectorAll(".floating-textbox")).map(box => {
            const isChart = box.classList.contains("floating-chart");
            const editor = box.querySelector(".floating-textbox-editor");
            const clone = box.cloneNode(true);
            clone.querySelectorAll(".floating-textbox-delete, .floating-chart-settings, .ss-obj-handle, .ss-obj-rotate-line, .ss-obj-rotate-handle").forEach(el => el.remove());
            return {
                type: isChart ? "chart" : "textbox",
                chartType: box.dataset.chartType || "bar",
                chartTitle: box.dataset.chartTitle || "",
                showLabels: box.dataset.showLabels === "1",
                trendline: box.dataset.trendline === "1",
                secondaryAxis: box.dataset.secondaryAxis === "1",
                colorTheme: box.dataset.colorTheme || "office",
                xAxisTitle: box.dataset.xAxisTitle || "",
                yAxisTitle: box.dataset.yAxisTitle || "",
                sourceRange: box.dataset.sourceRange || "",
                rotation: parseFloat(box.dataset.rotation || "0") || 0,
                left: `${box.dataset.initialLeft || parseFloat(box.style.left) || 0}px`,
                top: `${box.dataset.initialTop || parseFloat(box.style.top) || 0}px`,
                width: box.style.width || `${box.offsetWidth}px`,
                height: box.style.height || `${box.offsetHeight}px`,
                content: editor ? editor.innerHTML : clone.innerHTML,
                textStyle: isChart ? null : {
                    fontSize: box.style.fontSize || "",
                    fontWeight: box.style.fontWeight || "",
                    fontStyle: box.style.fontStyle || "",
                    textDecoration: box.style.textDecoration || "",
                    color: box.style.color || "",
                    backgroundColor: box.style.backgroundColor || "",
                    textAlign: box.style.textAlign || ""
                }
            };
        });

        const zoom = parseInt(zoomSlider?.value || "100", 10) || 100;
        if (!sheets[activeSheetIndex]) {
            sheets[activeSheetIndex] = createBlankSheetModel("Sheet1");
        }

        const target = sheets[activeSheetIndex];
        target.cells = savedCells;
        backgroundSheetIndexCache.delete(target);
        target.rows = savedRows;
        target.columns = savedColumns;
        target.zoom = zoom;
        target.pageSize = currentPageSize;
        target.freezeRows = freezeRows;
        target.freezeCols = freezeCols;
        target.textboxes = textboxes;
        target.autoFilters = autoFilterStates.map(af => ({
            id: af.id,
            tableId: af.tableId || null,
            headerRow: af.headerRow,
            minCol: af.minCol,
            maxCol: af.maxCol,
            maxRow: af.maxRow,
            filters: Array.from(af.filters.entries()).map(([col, set]) => [col, Array.from(set)])
        }));
        target.autoFilter = null;
        target.activeCoord = activeCell
            ? { row: parseInt(activeCell.dataset.row, 10), col: parseInt(activeCell.dataset.col, 10) }
            : { row: 1, col: 0 };
        target.scrollTop = container.scrollTop;
        target.scrollLeft = container.scrollLeft;
        target.tables = JSON.parse(JSON.stringify(getSheetTables()));
        return target;
    }

    function recalculateBackgroundSheets() {
        sheets.forEach((sheet, sIdx) => {
            if (sIdx === activeSheetIndex || !Array.isArray(sheet.cells)) return;
            sheet.cells.forEach(entry => {
                if (entry.f && String(entry.f).startsWith("=")) {
                    const res = evaluateFormula(entry.f, new Set(), sIdx, {
                        row: Number(entry.r) || 1,
                        col: Number(entry.c) || 0
                    });
                    entry.v = res != null ? String(res) : "";
                }
            });
        });
    }

    function serializeSheetSnapshot({ flush = true, recalcBackground = true } = {}) {
        captureCurrentSheetDOM({ flush });
        if (recalcBackground) {
            recalculateBackgroundSheets();
        }
        return JSON.stringify({
            format: "nexser-spreadsheet",
            version: 4,
            activeSheetIndex,
            definedNames,
            sheets
        });
    }

    function serializeSpreadsheetPayload() {
        return serializeSheetSnapshot({ flush: true, recalcBackground: true });
    }

    const activeSheetObservers = new Set();
    function disconnectActiveSheetObservers() {
        activeSheetObservers.forEach(obs => obs.disconnect());
        activeSheetObservers.clear();
    }

    function clearSheetToBlank({ resetHistory = true } = {}) {
        disconnectActiveSheetObservers();
        tbody.querySelectorAll("td").forEach(cell => {
            cell.textContent = "";
            cell.removeAttribute("style");
            cell.removeAttribute("colspan");
            cell.removeAttribute("rowspan");
            cell.className = "";
            Object.keys(cell.dataset).forEach(k => {
                if (k !== "row" && k !== "col") delete cell.dataset[k];
            });
        });
        for (let c = 0; c < currentColumns; c++) {
            setColumnWidth(c, 120);
        }
        for (let c = 0; c < currentColumns; c++) {
            theadRow.children[c + 1]?.classList.remove("ss-col-hidden", "ss-has-hidden-next");
            const colEl = colgroup.children[c + 1];
            if (colEl) delete colEl.dataset.prevWidth;
        }
        Array.from(tbody.rows).forEach(tr => {
            tr.style.height = "";
            tr.style.display = "";
            delete tr.dataset.userHidden;
            delete tr.dataset.filterHidden;
            tr.cells[0]?.classList.remove("ss-has-hidden-next");
        });
        spreadsheetContent.querySelectorAll(".floating-textbox").forEach(b => removeFloatingObject(b)); // ★ここを変更
        closeCellDropdownList();
        hideCellDropdownButton();
        clearCopyAnimation();
        clearAllAutoFilters();
        setFreezePanes(0, 0, { silent: true });
        if (resetHistory) {
            definedNames = {};
            sheets = [createBlankSheetModel("Sheet1")];
            activeSheetIndex = 0;
            renderSheetTabs();
            undoHistory = [];
            redoHistory = [];
            saveState();
        }
    }

    async function applySingleSheetToDOM(sheetData, { isUndoRedo = false, restoreScroll = true } = {}) {
        const cells = Array.isArray(sheetData.cells) ? sheetData.cells : [];
        const rows = Array.isArray(sheetData.rows) ? sheetData.rows : [];
        const columns = Array.isArray(sheetData.columns) ? sheetData.columns : [];
        const zoomVal = sheetData.zoom ?? 100;
        const textboxes = Array.isArray(sheetData.textboxes) ? sheetData.textboxes : [];
        const condFormats = Array.isArray(sheetData.conditionalFormats)
            ? JSON.parse(JSON.stringify(sheetData.conditionalFormats))
            : [];

        clearSheetToBlank({ resetHistory: false });
        if (sheets[activeSheetIndex]) {
            sheets[activeSheetIndex].tables = Array.isArray(sheetData.tables)
                ? JSON.parse(JSON.stringify(sheetData.tables))
                : [];
        }

        if (sheets[activeSheetIndex]) {
            sheets[activeSheetIndex].conditionalFormats = condFormats;
        }

        const z = parseInt(String(zoomVal).replace("%", ""), 10) || 100;
        setZoom(z, { silent: true });
        setPageSize(sheetData.pageSize || "A4", { silent: true });

        const maxRow = Math.max(
            0,
            ...cells.map(item => (Number(item.r) || 0) + (Number(item.rs) || 1) - 1),
            ...rows.map(item => Number(item.r) || 0)
        );
        const maxCol = Math.max(
            0,
            ...cells.map(item => (Number(item.c) || 0) + (Number(item.cs) || 1) - 1),
            ...columns.map(item => Number(item.c) || 0)
        );
        if (maxRow >= rowCount) loadRowsSync(maxRow - rowCount + 1);
        if (maxCol >= currentColumns) loadColumnsSync(maxCol - currentColumns + 1);

        const hiddenColsToRestore = [];
        const hiddenRowsToRestore = [];

        rows.forEach(({ r, h, hidden }) => {
            const tr = getRow(Number(r));
            if (!tr) return;
            if (h) tr.style.height = h;
            if (hidden) hiddenRowsToRestore.push(Number(r));
        });

        columns.forEach(({ c, w, hidden }) => {
            const colIdx = Number(c);
            if (w) {
                const px = parseInt(w, 10);
                if (!isNaN(px)) setColumnWidth(colIdx, px);
            }
            if (hidden) hiddenColsToRestore.push(colIdx);
        });

        const total = cells.length;
        cells.forEach((item, idx) => {
            const cell = getCell(Number(item.r), Number(item.c));
            if (!cell) return;

            if (item.qp) cell.dataset.quotePrefix = "1";
            if (item.nf) cell.dataset.numFormat = String(item.nf);
            if (item.dp !== undefined && item.dp !== "") cell.dataset.decimalPlaces = String(item.dp);
            if (item.dl) cell.dataset.dropdownList = String(item.dl);
            if (item.dvr) cell.dataset.dvRule = String(item.dvr);
            if (item.rr) cell.dataset.richRuns = String(item.rr);
            if (item.nt) cell.dataset.note = String(item.nt);
            if (item.cm) cell.dataset.comment = String(item.cm);
            if (item.ind) cell.dataset.indent = String(item.ind);
            if (item.sh) cell.dataset.shrinkToFit = "1";
            if (item.rot) cell.dataset.textRotation = String(item.rot);
            if (item.lk === "0") cell.dataset.locked = "0";
            if (item.fh) cell.dataset.formulaHidden = "1";
            if (item.hl) {
                cell.dataset.hyperlink = String(item.hl);
                cell.classList.add("ss-hyperlink");
                cell.title = `${item.hl}（Ctrl+クリックで開く）`;
            }

            if (item.f) {
                cell.dataset.formula = String(item.f);
                setCellFormattedValue(cell, item.v != null ? String(item.v) : "");
            } else if (item.v != null) {
                setCellFormattedValue(cell, String(item.v));
            }
            if (item.vt) cell.dataset.valueType = String(item.vt);
            if (item.dv) cell.dataset.dateValue = String(item.dv);

            applyCellStyleData(cell, item.st || item.s);
            if (item.nt || item.cm) syncCellAnnotationMark(cell);
            if (item.sh) applyShrinkToFit(cell);

            if (item.merge && typeof item.merge === "object") {
                Object.entries(item.merge).forEach(([k, val]) => {
                    if (val != null) cell.dataset[k] = String(val);
                });
            }

            if (total > 0 && !isUndoRedo && idx % 50 === 0) {
                statusBarState.stateText = `読み込み中... (${Math.round(((idx + 1) / total) * 100)}%)`;
                renderWindowStatusBar();
            }
        });

        // セル結合の再構築パス
        cells.forEach(item => {
            const r0 = Number(item.r);
            const c0 = Number(item.c);
            const cs = Number(item.cs) || 1;
            const rs = Number(item.rs) || 1;
            if (cs > 1 || rs > 1) {
                const anchor = getCell(r0, c0);
                if (!anchor) return;
                const maxR = r0 + rs - 1;
                const maxC = c0 + cs - 1;
                anchor.setAttribute("rowspan", String(rs));
                anchor.setAttribute("colspan", String(cs));
                anchor.classList.add("merged");
                anchor.dataset.mergeMinRow = String(r0);
                anchor.dataset.mergeMaxRow = String(maxR);
                anchor.dataset.mergeMinCol = String(c0);
                anchor.dataset.mergeMaxCol = String(maxC);

                for (let r = r0; r <= maxR; r++) {
                    for (let c = c0; c <= maxC; c++) {
                        if (r === r0 && c === c0) continue;
                        const sub = getCell(r, c);
                        if (sub) {
                            sub.textContent = "";
                            sub.removeAttribute("style");
                            sub.removeAttribute("rowspan");
                            sub.removeAttribute("colspan");
                            sub.style.display = "none";
                            sub.className = "";
                            sub.dataset.mergeAnchorRow = String(r0);
                            sub.dataset.mergeAnchorCol = String(c0);
                        }
                    }
                }
            }
        });

        (sheets[activeSheetIndex]?.tables || []).forEach(tbl => applyStructuredTableVisuals(tbl));
        updateAllFormulas();
        applyConditionalFormats();

        if (Array.isArray(textboxes)) {
            textboxes.forEach(tb => {
                if (tb.type === "chart") {
                    const chartBox = document.createElement("div");
                    chartBox.tabIndex = 0;
                    chartBox.className = "floating-textbox floating-chart";
                    chartBox.dataset.chartType = tb.chartType || "bar";
                    if (tb.chartTitle) chartBox.dataset.chartTitle = tb.chartTitle;
                    if (tb.showLabels) chartBox.dataset.showLabels = "1";
                    if (tb.trendline) chartBox.dataset.trendline = "1";
                    if (tb.secondaryAxis) chartBox.dataset.secondaryAxis = "1";
                    if (tb.colorTheme) chartBox.dataset.colorTheme = tb.colorTheme;
                    if (tb.xAxisTitle) chartBox.dataset.xAxisTitle = tb.xAxisTitle;
                    if (tb.yAxisTitle) chartBox.dataset.yAxisTitle = tb.yAxisTitle;
                    if (tb.sourceRange) chartBox.dataset.sourceRange = tb.sourceRange;
                    if (tb.rotation) chartBox.dataset.rotation = String(tb.rotation);
                    Object.assign(chartBox.style, {
                        left: tb.left || "140px",
                        top: tb.top || "100px",
                        width: tb.width || "380px",
                        height: tb.height || "240px",
                        background: "#fff",
                        padding: "6px"
                    });
                    if (!renderChartBoxSVG(chartBox)) {
                        chartBox.innerHTML = tb.content || "";
                    }
                    attachChartControls(chartBox);
                    spreadsheetContent.appendChild(chartBox);
                    enableTextboxDragging(chartBox);
                } else {
                    insertTextBox(tb, { silent: true });
                    const created = spreadsheetContent.lastElementChild;
                    if (created && created.classList.contains("floating-textbox") && tb.textStyle) {
                        Object.entries(tb.textStyle).forEach(([k, v]) => {
                            if (v) created.style[k] = v;
                        });
                    }
                }
            });
        }

        const rawAutoFilters = Array.isArray(sheetData.autoFilters)
            ? sheetData.autoFilters
            : (sheetData.autoFilter ? [sheetData.autoFilter] : []);
        if (rawAutoFilters.length > 0) {
            autoFilterStates = rawAutoFilters.map((af, idx) => ({
                id: af.id || `af_restored_${Date.now()}_${idx}`,
                tableId: af.tableId || null,
                headerRow: af.headerRow,
                minCol: af.minCol,
                maxCol: af.maxCol,
                maxRow: af.maxRow,
                filters: new Map((af.filters || []).map(([col, vals]) => [Number(col), new Set(vals)]))
            }));
            renderAutoFilterArrows();
            applyAutoFilterRows();
        }

        if (hiddenColsToRestore.length) {
            hiddenColsToRestore.forEach(c => {
                const colEl = colgroup.children[c + 1];
                const thEl = theadRow.children[c + 1];
                if (!colEl || !thEl) return;
                colEl.dataset.prevWidth = colEl.style.width || "120px";
                colEl.style.width = "0px";
                thEl.classList.add("ss-col-hidden");
                for (const tr of tbody.rows) tr.cells[c + 1]?.classList.add("ss-col-hidden");
            });
            syncTableWidth();
        }
        if (hiddenRowsToRestore.length) {
            hiddenRowsToRestore.forEach(r => {
                const tr = getRow(r);
                if (tr) {
                    tr.dataset.userHidden = "1";
                    tr.style.display = "none";
                }
            });
        }
        updateHiddenHeaderIndicators();
        setFreezePanes(sheetData.freezeRows || 0, sheetData.freezeCols || 0, { silent: true });

        const coord = sheetData.activeCoord || { row: 1, col: 0 };
        const targetActive = getVisibleCell(coord.row, coord.col) || getVisibleCell(1, 0);
        if (targetActive) {
            clearSelection();
            setActiveCell(targetActive, true);
        }

        if (restoreScroll) {
            const targetTop = Math.max(0, Number(sheetData.scrollTop) || 0);
            const targetLeft = Math.max(0, Number(sheetData.scrollLeft) || 0);

            // 保存されたスクロール先が現在の行数・列数を超える場合は先に拡張して頭打ちを防止
            const neededRows = Math.ceil((targetTop + container.clientHeight) / 30) + 5;
            const neededCols = Math.ceil((targetLeft + container.clientWidth) / 120) + 2;
            if (neededRows >= rowCount) loadRowsSync(Math.min(500, neededRows - rowCount + 1));
            if (neededCols >= currentColumns) loadColumnsSync(Math.min(200, neededCols - currentColumns + 1));

            container.scrollTop = targetTop;
            container.scrollLeft = targetLeft;
            refreshVisibleRows();
            syncCellDropdownButtonPosition();
        }

        if (sheets[activeSheetIndex]) {
            sheets[activeSheetIndex].protected = Boolean(sheetData.protected);
        }
        syncSheetProtectionUI();
        updateSelectedCellsDisplay();
        updateFillHandle();
        updateToolbarState();
    }

    async function applyDeserializedPayload(rawStr, { isUndoRedo = false } = {}) {
        let parsed;
        try {
            parsed = JSON.parse(rawStr);
        } catch (err) {
            console.error("[Spreadsheet] JSON parse error:", err);
            throw new Error("ファイルのデータ形式が破損しています（JSON構文エラー）。");
        }

        definedNames = (parsed && typeof parsed === "object" && parsed.definedNames && typeof parsed.definedNames === "object")
            ? { ...parsed.definedNames }
            : {};

        if (parsed && typeof parsed === "object" && Array.isArray(parsed.sheets) && parsed.sheets.length > 0) {
            sheets = parsed.sheets.map((s, idx) => ({
                ...createBlankSheetModel(s.name || `Sheet${idx + 1}`),
                ...s
            }));
            activeSheetIndex = Math.min(sheets.length - 1, Math.max(0, Number(parsed.activeSheetIndex) || 0));
        } else if (Array.isArray(parsed)) {
            const [rawCells = [], rawRows = [], rawCols = [], rawZoom = "100", rawBoxes = []] = parsed;
            const mergeKeys = ["mergeAnchorRow", "mergeAnchorCol", "mergeMinRow", "mergeMinCol", "mergeMaxRow", "mergeMaxCol"];
            const cells = rawCells.map(d => {
                const merge = {};
                mergeKeys.forEach((k, i) => {
                    if (d[7 + i] != null) merge[k] = String(d[7 + i]);
                });
                return {
                    r: Number(d[0]),
                    c: Number(d[1]),
                    v: d[2] ?? "",
                    f: d[3] ?? "",
                    s: d[4] ?? "",
                    cs: Number(d[5]) || 1,
                    rs: Number(d[6]) || 1,
                    merge: Object.keys(merge).length ? merge : null
                };
            });
            sheets = [{
                ...createBlankSheetModel("Sheet1"),
                cells,
                rows: rawRows.map(([r, h]) => ({ r: Number(r), h })),
                columns: rawCols.map(([c, w]) => ({ c: Number(c), w })),
                zoom: rawZoom,
                textboxes: rawBoxes
            }];
            activeSheetIndex = 0;
        } else if (parsed && typeof parsed === "object" && Array.isArray(parsed.cells)) {
            sheets = [{
                ...createBlankSheetModel("Sheet1"),
                cells: parsed.cells,
                rows: Array.isArray(parsed.rows) ? parsed.rows : [],
                columns: Array.isArray(parsed.columns) ? parsed.columns : [],
                zoom: parsed.zoom ?? 100,
                pageSize: parsed.pageSize || "A4",
                freezeRows: parsed.freezeRows || 0,
                freezeCols: parsed.freezeCols || 0,
                textboxes: Array.isArray(parsed.textboxes) ? parsed.textboxes : []
            }];
            activeSheetIndex = 0;
        } else {
            throw new Error("サポートされていないスプレッドシートデータ構造です。");
        }

        renderSheetTabs();
        await applySingleSheetToDOM(sheets[activeSheetIndex], {
            isUndoRedo,
            restoreScroll: !isUndoRedo
        });
    }

    function parseCSVRows(text) {
        const rows = [];
        let row = [];
        let field = "";
        let inQuotes = false;
        const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

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
            } else if (ch === ",") {
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
        if (field !== "" || row.length > 0) {
            row.push(field);
            rows.push(row);
        }
        return rows;
    }

    function parseAndLoadCSV(csvText) {
        clearSheetToBlank();
        const parsedRows = parseCSVRows(csvText);
        const neededRows = parsedRows.length;
        const neededCols = parsedRows.reduce((m, cols) => Math.max(m, cols.length), 0);
        if (neededRows >= rowCount) loadRowsSync(neededRows - rowCount + 5);
        if (neededCols >= currentColumns) loadColumnsSync(neededCols - currentColumns + 2);

        parsedRows.forEach((cols, rIdx) => {
            if (cols.length === 1 && cols[0] === "" && rIdx === parsedRows.length - 1) return;
            cols.forEach((val, cIdx) => {
                const cell = getCell(rIdx + 1, cIdx);
                if (!cell) return;
                const trimmed = val.trim();
                if (trimmed.startsWith("=")) {
                    cell.dataset.formula = trimmed;
                    setCellFormattedValue(cell, evaluateFormula(trimmed));
                } else {
                    setCellFormattedValue(cell, trimmed);
                }
            });
        });
        updateAllFormulas();
        captureCurrentSheetDOM({ flush: false });
        renderSheetTabs();
    }

    async function openFileFromFS(targetPath) {
        const normalized = normalizePath(targetPath);
        const node = resolveFS(normalized);
        if (!node || node.type !== "file") {
            showAlert(`ファイルが見つかりません:\n${normalized}`, "読込エラー");
            return false;
        }

        statusBarState.stateText = "読み込み中...";
        renderWindowStatusBar();
        try {
            let contentData = node.content;
            if (contentData === "__EXTERNAL_DATA__") {
                contentData = await getFileContent(normalized);
            }
            if (contentData instanceof Blob) {
                contentData = await contentData.text();
            }
            if (typeof contentData !== "string") {
                throw new Error("対応していないファイル形式です。");
            }

            if (normalized.toLowerCase().endsWith(".csv")) {
                parseAndLoadCSV(contentData);
            } else if (contentData.trim() !== "") {
                await applyDeserializedPayload(contentData);
            } else {
                clearSheetToBlank();
            }

            if (lockedFilePath && lockedFilePath !== normalized) {
                unlockFile(lockedFilePath, lockOwnerPid);
            }
            if (lockFile(normalized, "exclusive", lockOwnerPid)) {
                lockedFilePath = normalized;
            }

            currentFilePath = normalized;
            setDirtyState(false);
            undoHistory = [];
            redoHistory = [];
            saveState();
            savedSnapshotJSON = undoHistory[undoHistory.length - 1] || null;

            if (normalized.toLowerCase().endsWith(".csv") || contentData.trim() === "") {
                const a1 = getVisibleCell(1, 0);
                if (a1) {
                    clearSelection();
                    setActiveCell(a1, true);
                    updateSelectedCellsDisplay();
                    updateFillHandle();
                }
            }

            statusBarState.stateText = "読み込み完了";
            await updateStorageUsageDisplay();
            return true;
        } catch (err) {
            console.error("[Spreadsheet] Load failed:", err);
            statusBarState.stateText = "読込エラー";
            renderWindowStatusBar();
            showAlert(`ファイルの読み込みに失敗しました:\n${err.message}`, "読込エラー");
            return false;
        }
    }

    async function writeToFSPath(targetPath) {
        const normalized = normalizePath(targetPath);
        const lastSlash = normalized.lastIndexOf("/");
        const rawParent = lastSlash > 0 ? normalized.substring(0, lastSlash) : "C:/";
        const parentPath = rawParent === "C:" ? "C:/" : rawParent;
        const fileName = normalized.substring(lastSlash + 1);

        const nameError = validateName(fileName);
        if (nameError) {
            showAlert(nameError, "保存エラー");
            return false;
        }

        const parentNode = resolveFS(parentPath);
        if (!parentNode || parentNode.type !== "folder") {
            showAlert(`保存先フォルダが存在しません:\n${parentPath}`, "保存エラー");
            return false;
        }

        statusBarState.stateText = "保存中...";
        let wasLockedBySelf = false;
        try {
            const payload = normalized.toLowerCase().endsWith(".csv")
                ? generateCSVText()
                : serializeSpreadsheetPayload();

            // 自身が保持している排他ロックを書き込み前に確実に解除する
            if (lockedFilePath === normalized) {
                wasLockedBySelf = unlockFile(normalized, lockOwnerPid);
            }

            setBulkUpdating(true);
            try {
                if (!parentNode[fileName]) {
                    parentNode[fileName] = {
                        type: "file",
                        content: payload,
                        size: payload.length,
                        lastModified: Date.now()
                    };
                } else {
                    const targetFile = parentNode[fileName];
                    if (targetFile.type !== "file") {
                        throw new Error(`同名のフォルダまたは特殊アイテムが既に存在します: ${fileName}`);
                    }
                    targetFile.content = payload;
                    targetFile.size = payload.length;
                    targetFile.lastModified = Date.now();
                }
            } finally {
                setBulkUpdating(false);
            }

            await forceSave();

            // 別ファイルをロックしていた場合は解放して新しい保存先にロックを付け替える
            if (lockedFilePath && lockedFilePath !== normalized) {
                unlockFile(lockedFilePath, lockOwnerPid);
                lockedFilePath = null;
            }
            if (lockFile(normalized, "exclusive", lockOwnerPid)) {
                lockedFilePath = normalized;
            }

            currentFilePath = normalized;
            flushDebouncedSaveState();
            saveState();
            savedSnapshotJSON = undoHistory[undoHistory.length - 1] || null;
            setDirtyState(false);
            clearCrashRecoveryBackup();
            statusBarState.stateText = "保存しました";
            await updateStorageUsageDisplay();
            return true;
        } catch (err) {
            // 保存失敗時に元のロックを復元
            if (wasLockedBySelf && lockFile(normalized, "exclusive", lockOwnerPid)) {
                lockedFilePath = normalized;
            }
            console.error("[Spreadsheet] Save failed:", err);
            statusBarState.stateText = "保存エラー";
            showAlert(`保存に失敗しました:\n${err.message}`, "保存エラー");
            return false;
        }
    }

    function generateCSVText() {
        flushPendingEdits();
        const getCleanCellDisplay = (cell) => {
            if (!cell) return "";
            const clone = cell.cloneNode(true);
            clone.querySelectorAll(".ss-filter-arrow, .ss-cell-dropdown-btn").forEach(el => el.remove());
            return clone.textContent || "";
        };

        let maxR = 0, maxC = 0;
        const rowsList = tbody.rows;
        for (let r = 0; r < rowsList.length; r++) {
            const cells = rowsList[r].cells;
            for (let c = 1; c < cells.length; c++) {
                if (getCleanCellDisplay(cells[c]).trim() !== "") {
                    if (r + 1 > maxR) maxR = r + 1;
                    if (c - 1 > maxC) maxC = c - 1;
                }
            }
        }
        const rows = [];
        for (let r = 1; r <= maxR; r++) {
            const cols = [];
            for (let c = 0; c <= maxC; c++) {
                const rawText = getCleanCellDisplay(getCell(r, c));
                const needsQuote = /[",\r\n]/.test(rawText);
                const escaped = rawText.replace(/"/g, '""');
                cols.push(needsQuote ? `"${escaped}"` : escaped);
            }
            rows.push(cols.join(","));
        }
        return rows.join("\n");
    }

    function exportLocalFile(ext = ".nxs") {
        try {
            const baseTitle = (currentFilePath ? basename(currentFilePath) : "無題.nxs")
                .replace(/\.(nxs|csv|json)$/i, "");
            const fileName = `${baseTitle}${ext}`;
            const isCSV = ext.toLowerCase() === ".csv";
            const contentStr = isCSV ? ("\uFEFF" + generateCSVText()) : serializeSpreadsheetPayload();
            const mimeType = isCSV ? "text/csv;charset=utf-8;" : "application/json;charset=utf-8;";

            const blob = new Blob([contentStr], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            managedTimeout(() => URL.revokeObjectURL(url), 1000);
            statusBarState.stateText = `${fileName} をエクスポートしました`;
            renderWindowStatusBar();
        } catch (err) {
            console.error("[Spreadsheet] Export failed:", err);
            showError(`エクスポートに失敗しました:\n${err.message}`, "エクスポートエラー");
        }
    }

    function importLocalFile() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".nxs,.json,.csv,text/csv,application/json";
        input.addEventListener("change", async () => {
            const file = input.files?.[0];
            if (!file) return;
            statusBarState.stateText = "読み込み中...";
            renderWindowStatusBar();
            try {
                const text = await file.text();
                if (file.name.toLowerCase().endsWith(".csv")) {
                    parseAndLoadCSV(text);
                } else {
                    await applyDeserializedPayload(text);
                }
                if (lockedFilePath) {
                    unlockFile(lockedFilePath, lockOwnerPid);
                    lockedFilePath = null;
                }
                currentFilePath = null;
                if (win && windowAPI?.updateWindowTitle) {
                    windowAPI.updateWindowTitle(win, file.name, true);
                }
                isDirty = true;
                undoHistory = [];
                redoHistory = [];
                saveState();
                statusBarState.stateText = `${file.name} を読み込みました`;
                renderWindowStatusBar();
            } catch (err) {
                console.error("[Spreadsheet] Import failed:", err);
                statusBarState.stateText = "読込エラー";
                renderWindowStatusBar();
                showAlert(`ファイルの読み込みに失敗しました:\n${err.message}`, "読込エラー");
            }
        }, { once: true });
        input.click();
    }

    function getDefaultSaveDirectory() {
        const preferred = ["C:/Programs/Documents", "C:/Documents", "C:/Desktop", "C:/"];
        for (const p of preferred) {
            const node = resolveFS(p);
            if (node && node.type === "folder") return p === "C:/" ? "C:" : p;
        }
        return "C:";
    }

    function collectSpreadsheetFiles() {
        const results = [];
        const root = resolveFS("C:/");
        if (!root) return results;

        const walk = (node, currentPath) => {
            if (!node || typeof node !== "object") return;
            for (const [name, child] of Object.entries(node)) {
                if (isSystemMetaKey(name) || name === "content" || name === "icon" || name === "size") continue;
                const fullPath = `${currentPath}/${name}`;
                if (child && typeof child === "object") {
                    if (child.type === "file" && /\.(nxs|csv|json)$/i.test(name)) {
                        results.push(fullPath);
                    } else if (child.type === "folder") {
                        walk(child, fullPath);
                    }
                }
            }
        };
        walk(root, "C:");
        return results;
    }

    const escHtml = (s) => String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    function promptSaveAsDialog(defaultExt = ".nxs", onSaved = null) {
        const defaultDir = getDefaultSaveDirectory();
        const defaultPath = currentFilePath || `${defaultDir}/無題${defaultExt}`;

        const bodyHtml = `
            <div style="width:100%; display:flex; flex-direction:column; gap:8px;">
                <div>仮想ドライブ上の保存先パスを指定してください:</div>
                <input type="text" class="ss-save-path-input border" value="${escHtml(defaultPath)}" style="width:100%; padding:4px 6px; font-size:12px; background:#fff; color:#000; box-sizing:border-box;">
            </div>
        `;

        const modalContent = openAppModal("名前を付けて保存", bodyHtml, {
            width: 420,
            isHtml: true,
            parentWin: win,
            buttons: [
                {
                    label: "保存",
                    onClick: async () => {
                        const input = modalContent.querySelector(".ss-save-path-input");
                        let val = input?.value.trim() || defaultPath;
                        if (!/\.(nxs|csv|json)$/i.test(val)) val += defaultExt;
                        const ok = await writeToFSPath(val);
                        if (ok && typeof onSaved === "function") {
                            onSaved();
                        }
                    }
                },
                { label: "キャンセル" }
            ]
        });

        const inp = modalContent?.querySelector(".ss-save-path-input");
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

    function promptOpenFileDialog() {
        const candidates = collectSpreadsheetFiles();
        const optionsHtml = candidates.length > 0
            ? candidates.map(p => `<option value="${escHtml(p)}">${escHtml(p)}</option>`).join("")
            : `<option value="">(保存済みシートが見つかりません)</option>`;
        const initialInputPath = candidates[0] || `${getDefaultSaveDirectory()}/`;

        const bodyHtml = `
            <div style="width:100%; display:flex; flex-direction:column; gap:8px;">
                <div>ファイルを選択するか、仮想ドライブのパスを入力してください:</div>
                <select class="ss-open-select border" style="width:100%; padding:4px; font-size:12px; background:#fff; color:#000;">
                    ${optionsHtml}
                </select>
                <input type="text" class="ss-open-path-input border" value="${escHtml(initialInputPath)}" style="width:100%; padding:4px 6px; font-size:12px; background:#fff; color:#000; box-sizing:border-box;">
            </div>
        `;

        const modalContent = openAppModal("スプレッドシートを開く", bodyHtml, {
            width: 440,
            isHtml: true,
            parentWin: win,
            buttons: [
                {
                    label: "開く",
                    onClick: async () => {
                        const target = modalContent.querySelector(".ss-open-path-input")?.value.trim();
                        if (target) await openFileFromFS(target);
                    }
                },
                { label: "キャンセル" }
            ]
        });

        const sel = modalContent?.querySelector(".ss-open-select");
        const inp = modalContent?.querySelector(".ss-open-path-input");
        sel?.addEventListener("change", () => {
            if (sel.value && inp) inp.value = sel.value;
        });
        if (inp) {
            inp.focus();
            inp.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    (modalContent.closest(".window") || modalContent).querySelector(".button-container button")?.click();
                }
            });
        }
    }

    async function updateStorageUsageDisplay() {
        try {
            if (navigator.storage?.estimate) {
                const { usage, quota } = await navigator.storage.estimate();
                const usedMB = ((usage || 0) / (1024 * 1024)).toFixed(2);
                const quotaGB = ((quota || 0) / (1024 * 1024 * 1024)).toFixed(1);
                statusBarState.storageText = `OSストレージ: ${usedMB}MB / ${quotaGB}GB`;
            }
        } catch {
            statusBarState.storageText = "";
        }
        renderWindowStatusBar();
    }

    // =========================================================
    // イベントリスナー登録（すべてスコープ＆AbortSignal管理）
    // =========================================================
    const pageStyleId = `ss-page-style-${lockOwnerPid}`;
    const printStyleId = `ss-print-style-${lockOwnerPid}`;
    let printOrientation = "portrait"; // "portrait" | "landscape"
    let printFitToWidth = true;
    let printShowGridlines = false;

    function updatePageStyleRule() {
        let styleTag = document.getElementById(pageStyleId);
        if (!styleTag) {
            styleTag = document.createElement("style");
            styleTag.id = pageStyleId;
            document.head.appendChild(styleTag);
        }
        styleTag.textContent = `@page { size: ${currentPageSize} ${printOrientation}; margin: 1cm; }`;
    }

    function setPageSize(sizeVal, { silent = false } = {}) {
        const nextSize = sizeVal || "A4";
        const changed = currentPageSize !== nextSize;
        currentPageSize = nextSize;
        updatePageStyleRule();
        renderWindowStatusBar();
        if (changed && !silent) {
            setDirtyState(true);
            debouncedSaveState();
        }
    }

    function printSpreadsheet() {
        const prevActiveCell = activeCell;
        flushPendingEdits();
        clearSelection();
        clearCalculationRangeHighlights();

        // データが存在する最終行・最終列を特定し、不要な空白ページの大量印刷を防ぐ
        let maxDataR = 1;
        let maxDataC = 0;
        const rowsList = tbody.rows;
        for (let r = 0; r < rowsList.length; r++) {
            if (rowsList[r].style.display === "none") continue;
            const cells = rowsList[r].cells;
            for (let c = 1; c < cells.length; c++) {
                const td = cells[c];
                if (td.style.display === "none") continue;
                const hasContent = Boolean(td.dataset.formula || (td.dataset.rawValue ?? td.textContent).trim() !== "");
                const hasStyle = Boolean(td.style.backgroundColor || td.style.borderTop || td.style.borderBottom || td.style.borderLeft || td.style.borderRight);
                if (hasContent || hasStyle) {
                    maxDataR = Math.max(maxDataR, r + 1);
                    maxDataC = Math.max(maxDataC, c - 1);
                }
            }
        }

        const tempHiddenEls = [];
        const hideForPrint = (el) => {
            if (el && el.style.display !== "none") {
                tempHiddenEls.push({ el, prev: el.style.display });
                el.style.display = "none";
            }
        };
        for (let r = maxDataR + 1; r <= rowsList.length; r++) {
            hideForPrint(getRow(r));
        }
        const headerRow = table.querySelector("thead tr");
        for (let c = maxDataC + 1; c < currentColumns; c++) {
            hideForPrint(headerRow?.children[c + 1]);
            for (let r = 1; r <= maxDataR; r++) {
                hideForPrint(getCell(r, c));
            }
        }

        // 用紙の印刷可能幅に合わせて自動縮小率を計算
        const pageWidthsPx = { A4: 718, A3: 1046, B5: 612, B4: 896 };
        const pageHeightsPx = { A4: 1046, A3: 1510, B5: 896, B4: 1300 };
        const printableW = printOrientation === "landscape"
            ? (pageHeightsPx[currentPageSize] || 1046)
            : (pageWidthsPx[currentPageSize] || 718);
        let usedTableW = 0;
        for (let c = 0; c <= maxDataC; c++) usedTableW += getColumnWidth(c);
        const printScale = (printFitToWidth && usedTableW > printableW)
            ? Math.max(0.25, printableW / usedTableW)
            : 1;
        const gridRule = printShowGridlines
            ? ""
            : `.ss-printing-active .ss-table td { border-color: transparent; }`;

        // 印刷時のみOSデスクトップ・ウィンドウ枠・リボン・スクロール制限を解除する専用スタイルを注入
        appRoot.classList.add("ss-printing-active");
        let printStyle = document.getElementById(printStyleId);
        if (!printStyle) {
            printStyle = document.createElement("style");
            printStyle.id = printStyleId;
            document.head.appendChild(printStyle);
        }
        printStyle.textContent = `
            @media print {
                html, body { height: auto !important; overflow: visible !important; margin: 0 !important; padding: 0 !important; }
                body * { visibility: hidden !important; }
                .ss-printing-active .ss-spreadsheet-content { zoom: ${printScale} !important; position: static !important; }
                ${gridRule}
                .ss-printing-active, .ss-printing-active * { visibility: visible !important; }
                .ss-printing-active {
                    position: static !important;
                    width: 100% !important;
                    height: auto !important;
                    overflow: visible !important;
                    background: #fff !important;
                }
                .ss-printing-active .ss-ribbon-shell,
                .ss-printing-active .ss-formula-bar-container,
                .ss-printing-active .ss-bottom-bar,
                .ss-printing-active .fill-handle,
                .ss-printing-active .ss-filter-arrow,
                .ss-printing-active .ss-cell-dropdown-btn,
                .ss-printing-active .floating-textbox-delete,
                .ss-printing-active .floating-chart-settings,
                .ss-printing-active .ss-obj-handle,
                .ss-printing-active .ss-obj-rotate-line,
                .ss-printing-active .ss-obj-rotate-handle {
                    display: none !important;
                }
                .ss-printing-active .ss-spreadsheet-container {
                    position: static !important;
                    overflow: visible !important;
                    height: auto !important;
                    width: 100% !important;
                    border: none !important;
                    contain: none !important;
                }
                .ss-printing-active table {
                    width: auto !important;
                    border-collapse: collapse !important;
                }
                .ss-printing-active tr {
                    break-inside: avoid;
                    page-break-inside: avoid;
                }
                .ss-printing-active tr,
                .ss-printing-active td,
                .ss-printing-active th {
                    visibility: visible !important;
                }
            }
        `;

        let isCleanedUp = false;
        const cleanupAfterPrint = () => {
            if (isCleanedUp) return;
            isCleanedUp = true;
            appRoot.classList.remove("ss-printing-active");
            tempHiddenEls.forEach(({ el, prev }) => {
                el.style.display = prev;
            });
            if (prevActiveCell && prevActiveCell.isConnected) {
                setActiveCell(prevActiveCell, false);
                updateSelectedCellsDisplay();
                updateFillHandle();
            }
            refreshVisibleRows();
        };

        window.addEventListener("afterprint", cleanupAfterPrint, { once: true });
        const printMediaQuery = window.matchMedia?.("print");
        if (printMediaQuery?.addEventListener) {
            const onMediaChange = (e) => {
                if (!e.matches) {
                    printMediaQuery.removeEventListener("change", onMediaChange);
                    cleanupAfterPrint();
                }
            };
            printMediaQuery.addEventListener("change", onMediaChange);
        }
        window.print();
    }

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
        if (undoBtn) undoBtn.classList.toggle("disabled", undoHistory.length <= 1);
        if (redoBtn) redoBtn.classList.toggle("disabled", redoHistory.length === 0);
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

    function shiftFormulaForRowCol(formula, mode, targetRow, targetCol, isSameSheet = true, targetSheetName = "") {
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
                r1 = minR;
                r2 = maxR;
            } else if (mode === "insert-col") {
                if (c1 >= targetCol) c1 += 1;
                if (c2 >= targetCol) c2 += 1;
            } else if (mode === "delete-col") {
                let minC = Math.min(c1, c2);
                let maxC = Math.max(c1, c2);
                if (minC === targetCol && maxC === targetCol) return null;
                if (targetCol >= minC && targetCol <= maxC) maxC -= 1;
                else if (targetCol < minC) { minC -= 1; maxC -= 1; }
                c1 = minC;
                c2 = maxC;
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

        const escapedSheet = targetSheetName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const escapedQuotedSheet = targetSheetName.replace(/'/g, "''").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const prefixRegex = isSameSheet
            ? /(^|[^A-Za-z0-9_'\u3040-\u30FF\u4E00-\u9FAF!])/
            : new RegExp(`((?:^|[^A-Za-z0-9_'\\u3040-\\u30FF\\u4E00-\\u9FAF])(?:'${escapedQuotedSheet}'|${escapedSheet})!)`);

        const rangePattern = new RegExp(
            `${prefixRegex.source}(\\$?)([A-Za-z]+)(\\$?)(\\d+):(\\$?)([A-Za-z]+)(\\$?)(\\d+)`,
            "g"
        );
        body = body.replace(rangePattern, (_, prefix, aC1, col1, aR1, row1, aC2, col2, aR2, row2) => {
            const shifted = shiftRangeCoords(
                columnLettersToIndex(col1),
                parseInt(row1, 10),
                columnLettersToIndex(col2),
                parseInt(row2, 10)
            );
            if (!shifted) return `${prefix}#REF!`;
            return `${prefix}${aC1}${getColumnName(shifted.c1)}${aR1}${shifted.r1}:${aC2}${getColumnName(shifted.c2)}${aR2}${shifted.r2}`;
        });

        const singlePattern = new RegExp(
            `${prefixRegex.source}(\\$?)([A-Za-z]+)(\\$?)(\\d+)`,
            "g"
        );
        body = body.replace(singlePattern, (_, prefix, aC, col, aR, row) => {
            const shifted = shiftSingleCoord(columnLettersToIndex(col), parseInt(row, 10));
            if (!shifted) return `${prefix}#REF!`;
            return `${prefix}${aC}${getColumnName(shifted.c)}${aR}${shifted.r}`;
        });

        body = body.replace(/__FSTR_(\d+)__/g, (_, idx) => strings[Number(idx)]);
        return "=" + body;
    }

    async function modifySheetRowCol(mode) {
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

        if (isDelete) {
            // 削除は大きい番号から降順に実行し、非連続選択でも間の行列を巻き込まない
            for (let i = indices.length - 1; i >= 0; i--) {
                const idx = indices[i];
                await modifySheetRowColSingle(mode, isRowOp ? idx : baseRow, isRowOp ? baseCol : idx);
            }
        } else {
            // 挿入は連続区間ごとにまとめ、大きい区間から各区間の先頭へ区間長分まとめて挿入（Excel準拠）
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
                    await modifySheetRowColSingle(mode, isRowOp ? start : baseRow, isRowOp ? baseCol : start);
                }
            }
        }
        setDirtyState(true);
        saveState();
    }

    async function modifySheetRowColSingle(mode, targetRow, targetCol) {
        const snap = captureCurrentSheetDOM({ flush: true });

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
            // 結合セルの先頭行のみが削除対象の場合、アンカーを次行へ退避して値・書式を保護
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

        // 全オートフィルターの座標・対象列番号を行列の挿入・削除に追従
        if (Array.isArray(snap.autoFilters) && snap.autoFilters.length > 0) {
            snap.autoFilters = snap.autoFilters.map(af => {
                const next = { ...af, filters: Array.isArray(af.filters) ? [...af.filters] : [] };
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
                } else if (mode === "delete-col") {
                    if (targetCol >= next.minCol && targetCol <= next.maxCol) {
                        next.maxCol -= 1;
                        next.filters = next.filters
                            .filter(([col]) => col !== targetCol)
                            .map(([col, vals]) => [col > targetCol ? col - 1 : col, vals]);
                        if (next.maxCol < next.minCol) return null;
                    } else if (targetCol < next.minCol) {
                        next.minCol -= 1;
                        next.maxCol -= 1;
                        next.filters = next.filters.map(([col, vals]) => [col - 1, vals]);
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

        // 挿入・削除後のアクティブセル座標を妥当な範囲に補正
        if (snap.activeCoord) {
            snap.activeCoord = {
                row: Math.max(1, Math.min(rowCount - 1, targetRow)),
                col: Math.max(0, Math.min(currentColumns - 1, targetCol))
            };
        }

        // 他シートから当シートを参照している数式も追従
        sheets.forEach((otherSheet, idx) => {
            if (idx === activeSheetIndex || !Array.isArray(otherSheet.cells)) return;
            otherSheet.cells.forEach(c => {
                if (c.f) {
                    c.f = shiftFormulaForRowCol(c.f, mode, targetRow, targetCol, false, snap.name);
                }
            });
        });

        await applySingleSheetToDOM(snap, { isUndoRedo: true, restoreScroll: false });
    }

    function sortSelectedRange(ascending = true) {
        flushPendingEdits();
        const selected = Array.from(tbody.querySelectorAll("td.selected"));
        const baseCell = activeCell || selected[0];
        if (!baseCell) return;

        const keyCol = parseInt(baseCell.dataset.col, 10);
        const isCellFilled = (r, c) => {
            const cell = getCell(r, c);
            if (!cell) return false;
            return Boolean(cell.dataset.formula || (cell.dataset.rawValue ?? cell.textContent).trim() !== "");
        };

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
            while (maxR < rowCount - 1 && isCellFilled(maxR + 1, startC)) maxR++;
            while (minC > 0 && isCellFilled(startR, minC - 1)) minC--;
            while (maxC < currentColumns - 1 && isCellFilled(startR, maxC + 1)) maxC++;

            // 隣接行の横幅も取り込む
            let expanded = true;
            while (expanded) {
                expanded = false;
                for (let r = minR; r <= maxR; r++) {
                    if (minC > 0 && isCellFilled(r, minC - 1)) { minC--; expanded = true; }
                    if (maxC < currentColumns - 1 && isCellFilled(r, maxC + 1)) { maxC++; expanded = true; }
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
        const matchedFilter = autoFilterStates.find(af =>
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

                if (item.formula) {
                    const nextFormula = adjustFormula(item.formula, rowDelta, 0);
                    dest.dataset.formula = nextFormula;
                    setCellFormattedValue(dest, evaluateFormula(nextFormula));
                } else {
                    delete dest.dataset.formula;
                    setCellFormattedValue(dest, item.value);
                }
                applyCellStyleData(dest, item.styleObj);
            });
        });

        updateAllFormulas();
        applyConditionalFormats();
        if (autoFilterStates.length) applyAutoFilterRows();
        updateFillHandle();
        updateSelectedCellsDisplay();
        setDirtyState(true);
        debouncedSaveState();
    }





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

        let minRow = startR, maxRow = startR, minCol = startC, maxCol = startC;
        while (minRow > 1 && isFilled(minRow - 1, startC)) minRow--;
        while (maxRow < rowCount - 1 && isFilled(maxRow + 1, startC)) maxRow++;
        while (minCol > 0 && isFilled(startR, minCol - 1)) minCol--;
        while (maxCol < currentColumns - 1 && isFilled(startR, maxCol + 1)) maxCol++;

        let expanded = true;
        while (expanded) {
            expanded = false;
            for (let r = minRow; r <= maxRow; r++) {
                if (minCol > 0 && isFilled(r, minCol - 1)) { minCol--; expanded = true; }
                if (maxCol < currentColumns - 1 && isFilled(r, maxCol + 1)) { maxCol++; expanded = true; }
            }
        }
        return { minRow, maxRow, minCol, maxCol };
    }

    function openRemoveDuplicatesDialog() {
        flushPendingEdits();
        const bounds = detectDataBlockBounds(activeCell);
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
                    numFormat: cell?.dataset.numFormat || "",
                    decimalPlaces: cell?.dataset.decimalPlaces ?? "",
                    dropdownList: cell?.dataset.dropdownList || "",
                    dvRule: cell?.dataset.dvRule || "",
                    valueType: cell?.dataset.valueType || "",
                    dateValue: cell?.dataset.dateValue || "",
                    richRuns: cell?.dataset.richRuns || "",
                    hyperlink: cell?.dataset.hyperlink || "",
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

                if (item.formula) {
                    const nextFormula = adjustFormula(item.formula, rowDelta, 0);
                    dest.dataset.formula = nextFormula;
                    setCellFormattedValue(dest, evaluateFormula(nextFormula));
                } else {
                    delete dest.dataset.formula;
                    setCellFormattedValue(dest, item.value);
                }
                applyCellStyleData(dest, item.styleObj);
            });
        });

        // 削除されて余った下端行をクリア
        for (let r = startDataRow + uniqueRows.length; r <= bounds.maxRow; r++) {
            for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
                const cell = getCell(r, c);
                if (!cell) continue;
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

        updateAllFormulas();
        applyConditionalFormats();
        if (autoFilterStates.length) applyAutoFilterRows();
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
    function splitTextWithDelimiters(text, delimiters, { treatConsecutiveAsOne = false, respectQuotes = true } = {}) {
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

    function openTextToColumnsDialog() {
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
        if (neededEndCol >= currentColumns) {
            loadColumnsSync(neededEndCol - currentColumns + 2);
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
    // 表のデザイン：オートフォーマット（サンプルイメージ付き）
    // =========================================================
    const AUTO_FORMAT_STYLES = [
        {
            id: "simple",
            name: "シンプル",
            header: { bg: "#ffffff", fg: "#000000", bold: true, italic: false, align: "center", bt: "2px solid #000000", bb: "1px solid #000000" },
            rowOdd: { bg: "#ffffff", fg: "#000000" },
            rowEven: { bg: "#ffffff", fg: "#000000" },
            total: { bg: "#ffffff", fg: "#000000", bold: true, bt: "1px solid #000000", bb: "4px double #000000" },
            gridBorder: "",
            numFormat: "comma"
        },
        {
            id: "classic1",
            name: "クラシック 1（ビジネス青）",
            header: { bg: "#1f4e78", fg: "#ffffff", bold: true, italic: false, align: "center", bt: "2px solid #1f4e78", bb: "2px solid #1f4e78" },
            rowOdd: { bg: "#ffffff", fg: "#000000" },
            rowEven: { bg: "#d9e1f2", fg: "#000000" },
            total: { bg: "#b4c6e7", fg: "#1f4e78", bold: true, bt: "1px solid #1f4e78", bb: "3px double #1f4e78" },
            gridBorder: "1px solid #8ea9db",
            numFormat: "comma"
        },
        {
            id: "classic2",
            name: "クラシック 2（ネイビー見出し）",
            header: { bg: "#002060", fg: "#ffffff", bold: true, italic: false, align: "center", bt: "2px solid #002060", bb: "2px solid #002060" },
            rowOdd: { bg: "#f2f4f8", fg: "#000000" },
            rowEven: { bg: "#ffffff", fg: "#000000" },
            total: { bg: "#d9e1f2", fg: "#000000", bold: true, bt: "2px solid #002060", bb: "2px solid #002060" },
            gridBorder: "1px solid #bfbfbf",
            numFormat: "comma"
        },
        {
            id: "accounting1",
            name: "会計 1（帳簿・通貨）",
            header: { bg: "#e7e6e6", fg: "#000000", bold: true, italic: true, align: "right", bt: "2px solid #000000", bb: "1px solid #000000" },
            rowOdd: { bg: "#ffffff", fg: "#000000" },
            rowEven: { bg: "#fafafa", fg: "#000000" },
            total: { bg: "#f2f2f2", fg: "#000000", bold: true, bt: "1px solid #000000", bb: "4px double #000000" },
            gridBorder: "",
            numFormat: "currency"
        },
        {
            id: "accounting2",
            name: "会計 2（グリーン明細）",
            header: { bg: "#375623", fg: "#ffffff", bold: true, italic: false, align: "center", bt: "2px solid #375623", bb: "2px solid #375623" },
            rowOdd: { bg: "#ffffff", fg: "#000000" },
            rowEven: { bg: "#e2efda", fg: "#000000" },
            total: { bg: "#c6e0b4", fg: "#1f3811", bold: true, bt: "1px solid #375623", bb: "4px double #375623" },
            gridBorder: "1px solid #a9d08e",
            numFormat: "currency"
        },
        {
            id: "colorful1",
            name: "カラフル 1（暖色オレンジ）",
            header: { bg: "#c65911", fg: "#ffffff", bold: true, italic: false, align: "center", bt: "2px solid #833c0c", bb: "2px solid #833c0c" },
            rowOdd: { bg: "#ffffff", fg: "#000000" },
            rowEven: { bg: "#fce4d6", fg: "#000000" },
            total: { bg: "#f8cbad", fg: "#833c0c", bold: true, bt: "2px solid #c65911", bb: "2px solid #833c0c" },
            gridBorder: "1px solid #f4b084",
            numFormat: "comma"
        },
        {
            id: "colorful2",
            name: "カラフル 2（エレガント紫）",
            header: { bg: "#7030a0", fg: "#ffffff", bold: true, italic: false, align: "center", bt: "2px solid #4c1d70", bb: "2px solid #4c1d70" },
            rowOdd: { bg: "#ffffff", fg: "#000000" },
            rowEven: { bg: "#efe5f7", fg: "#000000" },
            total: { bg: "#dcc4ee", fg: "#3f175e", bold: true, bt: "2px solid #7030a0", bb: "3px double #4c1d70" },
            gridBorder: "1px solid #c5a3e0",
            numFormat: "comma"
        },
        {
            id: "darkModern",
            name: "ダークモダン（プレゼン用）",
            header: { bg: "#1b1f24", fg: "#ffffff", bold: true, italic: false, align: "center", bt: "2px solid #107c41", bb: "2px solid #107c41" },
            rowOdd: { bg: "#2b3138", fg: "#f5f5f5" },
            rowEven: { bg: "#373e47", fg: "#f5f5f5" },
            total: { bg: "#107c41", fg: "#ffffff", bold: true, bt: "2px solid #ffffff", bb: "2px solid #107c41" },
            gridBorder: "1px solid #4e5660",
            numFormat: "comma"
        },
        {
            id: "printMono",
            name: "印刷最適（モノクロ帳票）",
            header: { bg: "#d9d9d9", fg: "#000000", bold: true, italic: false, align: "center", bt: "2px solid #000000", bb: "2px solid #000000" },
            rowOdd: { bg: "#ffffff", fg: "#000000" },
            rowEven: { bg: "#f2f2f2", fg: "#000000" },
            total: { bg: "#e6e6e6", fg: "#000000", bold: true, bt: "1px solid #000000", bb: "4px double #000000" },
            gridBorder: "1px solid #808080",
            numFormat: "comma"
        },
        {
            id: "listMinimal",
            name: "リスト 1（横罫線ミニマル）",
            header: { bg: "#ffffff", fg: "#1f4e78", bold: true, italic: false, align: "left", bt: "2px solid #1f4e78", bb: "2px solid #1f4e78" },
            rowOdd: { bg: "#ffffff", fg: "#000000" },
            rowEven: { bg: "#f8fafc", fg: "#000000" },
            total: { bg: "#edf2f7", fg: "#1f4e78", bold: true, bt: "2px solid #1f4e78", bb: "2px solid #1f4e78" },
            gridBorder: "",
            numFormat: "comma"
        },
        {
            id: "corporateTeal",
            name: "コーポレート・ティール",
            header: { bg: "#006d77", fg: "#ffffff", bold: true, italic: false, align: "center", bt: "2px solid #004e55", bb: "2px solid #004e55" },
            rowOdd: { bg: "#ffffff", fg: "#111111" },
            rowEven: { bg: "#e6f4f5", fg: "#111111" },
            total: { bg: "#bfe3e6", fg: "#004e55", bold: true, bt: "1px solid #006d77", bb: "3px double #004e55" },
            gridBorder: "1px solid #83c5be",
            numFormat: "comma"
        },
        {
            id: "financeGold",
            name: "財務レポート（ゴールド）",
            header: { bg: "#7f6000", fg: "#ffffff", bold: true, italic: false, align: "center", bt: "2px solid #5c4500", bb: "2px solid #5c4500" },
            rowOdd: { bg: "#ffffff", fg: "#000000" },
            rowEven: { bg: "#fff9e6", fg: "#000000" },
            total: { bg: "#ffe699", fg: "#5c4500", bold: true, bt: "1px solid #7f6000", bb: "4px double #5c4500" },
            gridBorder: "1px solid #d9b84a",
            numFormat: "currency"
        },
        {
            id: "crimsonExecutive",
            name: "エグゼクティブ（クリムゾン）",
            header: { bg: "#8b1e24", fg: "#ffffff", bold: true, italic: false, align: "center", bt: "2px solid #5e1116", bb: "2px solid #5e1116" },
            rowOdd: { bg: "#ffffff", fg: "#000000" },
            rowEven: { bg: "#fbeaea", fg: "#000000" },
            total: { bg: "#f4cccc", fg: "#5e1116", bold: true, bt: "2px solid #8b1e24", bb: "3px double #5e1116" },
            gridBorder: "1px solid #d99594",
            numFormat: "currency"
        },
        {
            id: "pastelSky",
            name: "パステル・スカイ（柔らか表示）",
            header: { bg: "#b4d7f5", fg: "#0d3b66", bold: true, italic: false, align: "center", bt: "2px solid #5b9bd5", bb: "2px solid #5b9bd5" },
            rowOdd: { bg: "#ffffff", fg: "#1a1a1a" },
            rowEven: { bg: "#f0f7fd", fg: "#1a1a1a" },
            total: { bg: "#d4e8fa", fg: "#0d3b66", bold: true, bt: "1px solid #5b9bd5", bb: "2px solid #0d3b66" },
            gridBorder: "1px solid #bdd7ee",
            numFormat: "comma"
        },
        {
            id: "pastelMint",
            name: "パステル・ミント（スケジュール用）",
            header: { bg: "#c5e0b4", fg: "#274e13", bold: true, italic: false, align: "center", bt: "2px solid #548235", bb: "2px solid #548235" },
            rowOdd: { bg: "#ffffff", fg: "#1a1a1a" },
            rowEven: { bg: "#f3f9ef", fg: "#1a1a1a" },
            total: { bg: "#d9ead3", fg: "#274e13", bold: true, bt: "1px solid #548235", bb: "2px solid #274e13" },
            gridBorder: "1px solid #a9d08e",
            numFormat: "comma"
        },
        {
            id: "slatePro",
            name: "スレートプロ（濃灰・高コントラスト）",
            header: { bg: "#334155", fg: "#ffffff", bold: true, italic: false, align: "center", bt: "2px solid #0f172a", bb: "2px solid #0f172a" },
            rowOdd: { bg: "#ffffff", fg: "#0f172a" },
            rowEven: { bg: "#f1f5f9", fg: "#0f172a" },
            total: { bg: "#cbd5e1", fg: "#0f172a", bold: true, bt: "2px solid #334155", bb: "4px double #0f172a" },
            gridBorder: "1px solid #94a3b8",
            numFormat: "comma"
        }
    ];

    function buildAutoFormatSampleHtml(styleDef, opts) {
        const fmtNum = (n) => {
            if (!opts.number) return String(n);
            return styleDef.numFormat === "currency" ? `¥${n.toLocaleString("ja-JP")}` : n.toLocaleString("ja-JP");
        };
        const cellCss = (role, isNumCol) => {
            const parts = [];
            if (opts.border) {
                if (styleDef.gridBorder) parts.push(`border:${styleDef.gridBorder}`);
                else parts.push("border:1px solid #ececec");
            } else {
                parts.push("border:1px solid #ececec");
            }
            if (role === "header") {
                if (opts.pattern) parts.push(`background:${styleDef.header.bg}`);
                if (opts.font) {
                    parts.push(`color:${styleDef.header.fg}`);
                    if (styleDef.header.bold) parts.push("font-weight:bold");
                    if (styleDef.header.italic) parts.push("font-style:italic");
                }
                if (opts.align) parts.push(`text-align:${styleDef.header.align}`);
                if (opts.border) {
                    if (styleDef.header.bt) parts.push(`border-top:${styleDef.header.bt}`);
                    if (styleDef.header.bb) parts.push(`border-bottom:${styleDef.header.bb}`);
                }
            } else if (role === "total") {
                if (opts.pattern) parts.push(`background:${styleDef.total.bg}`);
                if (opts.font) {
                    parts.push(`color:${styleDef.total.fg}`);
                    if (styleDef.total.bold) parts.push("font-weight:bold");
                }
                if (opts.align) parts.push(`text-align:${isNumCol ? "right" : "left"}`);
                if (opts.border) {
                    if (styleDef.total.bt) parts.push(`border-top:${styleDef.total.bt}`);
                    if (styleDef.total.bb) parts.push(`border-bottom:${styleDef.total.bb}`);
                }
            } else {
                const rowConf = role === "even" ? styleDef.rowEven : styleDef.rowOdd;
                if (opts.pattern) parts.push(`background:${rowConf.bg}`);
                if (opts.font) parts.push(`color:${rowConf.fg}`);
                if (opts.align) parts.push(`text-align:${isNumCol ? "right" : "left"}`);
            }
            return parts.join(";");
        };

        const headerRole = opts.hasHeader ? "header" : "odd";
        const totalRole = opts.hasTotal ? "total" : "even";
        return `
            <table class="ss-af-mini-tbl">
                <tr>
                    <td style="${cellCss(headerRole, false)}">品目</td>
                    <td style="${cellCss(headerRole, true)}">1月</td>
                    <td style="${cellCss(headerRole, true)}">2月</td>
                </tr>
                <tr>
                    <td style="${cellCss("odd", false)}">商品A</td>
                    <td style="${cellCss("odd", true)}">${fmtNum(1200)}</td>
                    <td style="${cellCss("odd", true)}">${fmtNum(1500)}</td>
                </tr>
                <tr>
                    <td style="${cellCss("even", false)}">商品B</td>
                    <td style="${cellCss("even", true)}">${fmtNum(800)}</td>
                    <td style="${cellCss("even", true)}">${fmtNum(950)}</td>
                </tr>
                <tr>
                    <td style="${cellCss(totalRole, false)}">合計</td>
                    <td style="${cellCss(totalRole, true)}">${fmtNum(2000)}</td>
                    <td style="${cellCss(totalRole, true)}">${fmtNum(2450)}</td>
                </tr>
            </table>
        `;
    }

    function applyAutoFormatToBounds(bounds, styleDef, opts) {
        for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
            const isHeader = opts.hasHeader && r === bounds.minRow;
            const isTotal = opts.hasTotal && r === bounds.maxRow && bounds.maxRow > bounds.minRow;
            const dataIdx = opts.hasHeader ? (r - bounds.minRow - 1) : (r - bounds.minRow);
            const isEven = dataIdx % 2 === 1;

            for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
                const cell = getVisibleCell(r, c);
                if (!cell || cell.style.display === "none") continue;
                clearAppliedConditionalStyle(cell);
                const rawVal = cell.dataset.formula ? evaluateFormula(cell.dataset.formula) : (cell.dataset.rawValue ?? cell.textContent);
                const isNumeric = String(rawVal ?? "").trim() !== "" && !isNaN(parseFormattedNumber(rawVal));

                if (opts.border) {
                    cell.style.borderTop = styleDef.gridBorder || "";
                    cell.style.borderBottom = styleDef.gridBorder || "";
                    cell.style.borderLeft = styleDef.gridBorder || "";
                    cell.style.borderRight = styleDef.gridBorder || "";
                }

                if (isHeader) {
                    if (opts.pattern) {
                        cell.style.backgroundColor = styleDef.header.bg;
                        if (cell.dataset.cfApplied) cell.dataset.cfOrigBg = styleDef.header.bg;
                    }
                    if (opts.font) {
                        cell.style.color = styleDef.header.fg;
                        if (cell.dataset.cfApplied) cell.dataset.cfOrigColor = styleDef.header.fg;
                        cell.style.fontWeight = styleDef.header.bold ? "bold" : "";
                        cell.style.fontStyle = styleDef.header.italic ? "italic" : "";
                    }
                    if (opts.align) cell.style.textAlign = styleDef.header.align;
                    if (opts.border) {
                        if (styleDef.header.bt) cell.style.borderTop = styleDef.header.bt;
                        if (styleDef.header.bb) cell.style.borderBottom = styleDef.header.bb;
                    }
                } else if (isTotal) {
                    if (opts.pattern) {
                        cell.style.backgroundColor = styleDef.total.bg;
                        if (cell.dataset.cfApplied) cell.dataset.cfOrigBg = styleDef.total.bg;
                    }
                    if (opts.font) {
                        cell.style.color = styleDef.total.fg;
                        if (cell.dataset.cfApplied) cell.dataset.cfOrigColor = styleDef.total.fg;
                        cell.style.fontWeight = styleDef.total.bold ? "bold" : "";
                    }
                    if (opts.align) cell.style.textAlign = isNumeric ? "right" : "left";
                    if (opts.border) {
                        if (styleDef.total.bt) cell.style.borderTop = styleDef.total.bt;
                        if (styleDef.total.bb) cell.style.borderBottom = styleDef.total.bb;
                    }
                    if (opts.number && isNumeric) {
                        cell.dataset.numFormat = styleDef.numFormat;
                        setCellFormattedValue(cell, rawVal);
                    }
                } else {
                    const rowConf = isEven ? styleDef.rowEven : styleDef.rowOdd;
                    if (opts.pattern) {
                        cell.style.backgroundColor = rowConf.bg;
                        if (cell.dataset.cfApplied) cell.dataset.cfOrigBg = rowConf.bg;
                    }
                    if (opts.font) {
                        cell.style.color = rowConf.fg;
                        if (cell.dataset.cfApplied) cell.dataset.cfOrigColor = rowConf.fg;
                        cell.style.fontWeight = "";
                        cell.style.fontStyle = "";
                    }
                    if (opts.align) cell.style.textAlign = isNumeric ? "right" : "left";
                    if (opts.number && isNumeric) {
                        cell.dataset.numFormat = styleDef.numFormat;
                        setCellFormattedValue(cell, rawVal);
                    }
                }
            }
        }

        if (opts.autoFit) {
            for (let c = bounds.minCol; c <= bounds.maxCol; c++) autoFitColumn(c);
            for (let r = bounds.minRow; r <= bounds.maxRow; r++) autoFitRow(getRow(r));
        }

        applyConditionalFormats();
        scheduleTextOverflowUpdate();
        updateToolbarState();
        setDirtyState(true);
        debouncedSaveState();
    }


    function rgbToHexColor(val, fallback = "#000000") {
        if (!val) return fallback;
        const s = String(val).trim();
        if (/^#[0-9a-f]{6}$/i.test(s)) return s;
        const m = s.match(/^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/i);
        if (!m) return fallback;
        return "#" + [m[1], m[2], m[3]].map(n => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, "0")).join("");
    }

    function applyShrinkToFit(cell) {
        if (!cell) return;
        if (cell.dataset.shrinkToFit !== "1") {
            if (cell.dataset.origFontSize) {
                cell.style.fontSize = cell.dataset.origFontSize;
                delete cell.dataset.origFontSize;
            }
            return;
        }
        const text = getCellPureText(cell);
        if (!text.trim() || cell.style.whiteSpace === "pre-wrap") return;
        const baseSize = parseFloat(cell.dataset.origFontSize || cell.style.fontSize || "14") || 14;
        if (!cell.dataset.origFontSize) cell.dataset.origFontSize = `${baseSize}px`;

        const colSpan = parseInt(cell.getAttribute("colspan") || "1", 10);
        let totalW = 0;
        const baseCol = parseInt(cell.dataset.col, 10) || 0;
        for (let k = 0; k < colSpan; k++) totalW += getColumnWidth(baseCol + k);
        const availW = Math.max(20, totalW - 10);
        if (!measureCtx) return;

        const fStyle = cell.style.fontStyle || "normal";
        const fWeight = cell.style.fontWeight || "normal";
        const fFamily = cell.style.fontFamily || "'MS PGothic', 'MS Gothic', sans-serif";
        measureCtx.font = `${fStyle} ${fWeight} ${baseSize}px ${fFamily}`;
        const textW = measureCtx.measureText(text).width;
        if (textW > availW) {
            const scaled = Math.max(7, Math.floor((baseSize * availW / textW) * 10) / 10);
            cell.style.fontSize = `${scaled}px`;
        } else {
            cell.style.fontSize = `${baseSize}px`;
        }
    }

    function openFormatCellsModal(initialTab = "number") {
        flushPendingEdits();
        const targetCells = getTargetCells().filter(el => el.tagName === "TD");
        if (!targetCells.length) return;
        const ref = (activeCell && activeCell.tagName === "TD") ? activeCell : targetCells[0];

        const curFmt = ref.dataset.numFormat || "general";
        const curCat = curFmt.startsWith("custom:") ? "custom" : curFmt;
        const curCustomPattern = curFmt.startsWith("custom:") ? curFmt.slice(7) : '#,##0"円"';
        const curDec = ref.dataset.decimalPlaces ?? "0";
        const curAlign = ref.style.textAlign || "general";
        const curValign = ref.style.verticalAlign || "middle";
        const curIndent = Number(ref.dataset.indent || "0");
        const curWrap = ref.style.whiteSpace === "pre-wrap";
        const curShrink = ref.dataset.shrinkToFit === "1";
        const curVertical = ref.style.writingMode === "vertical-rl";
        const curRotation = Number(ref.dataset.textRotation || "0");

        const curFont = ref.style.fontFamily || "'MS PGothic', 'MS Gothic', sans-serif";
        const curSize = parseInt(ref.dataset.origFontSize || ref.style.fontSize, 10) || 14;
        const curBold = ref.style.fontWeight === "bold";
        const curItalic = ref.style.fontStyle === "italic";
        const curDeco = ref.style.textDecoration || "";
        const curFgHex = rgbToHexColor(ref.dataset.cfApplied ? ref.dataset.cfOrigColor : ref.style.color, "#000000");
        const curHasFg = Boolean(ref.dataset.cfApplied ? ref.dataset.cfOrigColor : ref.style.color);
        const curBgRaw = ref.dataset.cfApplied ? ref.dataset.cfOrigBg : ref.style.backgroundColor;
        const curBgHex = rgbToHexColor(curBgRaw, "#ffffff");
        const curLocked = ref.dataset.locked !== "0";
        const curHidden = ref.dataset.formulaHidden === "1";

        const bodyHtml = `
        <div style="width:100%; display:flex; flex-direction:column; gap:6px; font-size:12px;">
            <div class="ss-xl-tabs">
                <div class="ss-xl-tab ${initialTab === "number" ? "active" : ""}" data-fc-tab="number">表示形式</div>
                <div class="ss-xl-tab ${initialTab === "align" ? "active" : ""}" data-fc-tab="align">配置</div>
                <div class="ss-xl-tab ${initialTab === "font" ? "active" : ""}" data-fc-tab="font">フォント</div>
                <div class="ss-xl-tab ${initialTab === "border" ? "active" : ""}" data-fc-tab="border">罫線</div>
                <div class="ss-xl-tab ${initialTab === "fill" ? "active" : ""}" data-fc-tab="fill">塗りつぶし</div>
                <div class="ss-xl-tab ${initialTab === "protect" ? "active" : ""}" data-fc-tab="protect">保護</div>
            </div>

            <!-- 1. 表示形式 -->
            <div class="ss-xl-tabpanel ${initialTab === "number" ? "active" : ""}" data-fc-panel="number">
                <div style="display:flex; gap:10px;">
                    <select class="ss-fc-cat border" size="8" style="width:136px; background:#fff; color:#000;">
                        <option value="general" ${curCat === "general" ? "selected" : ""}>標準</option>
                        <option value="comma" ${curCat === "comma" ? "selected" : ""}>数値 (桁区切り)</option>
                        <option value="currency" ${curCat === "currency" ? "selected" : ""}>通貨 (¥)</option>
                        <option value="percent" ${curCat === "percent" ? "selected" : ""}>パーセンテージ</option>
                        <option value="date-jp" ${curCat === "date-jp" ? "selected" : ""}>日付 (年月日)</option>
                        <option value="date-md" ${curCat === "date-md" ? "selected" : ""}>日付 (M/D)</option>
                        <option value="text" ${curCat === "text" ? "selected" : ""}>文字列</option>
                        <option value="custom" ${curCat === "custom" ? "selected" : ""}>ユーザー定義</option>
                    </select>
                    <div style="flex:1; display:flex; flex-direction:column; gap:7px;">
                        <fieldset class="ss-fmt-fieldset">
                            <legend>サンプル</legend>
                            <div class="ss-fc-sample" style="min-height:20px; font-weight:bold;"></div>
                        </fieldset>
                        <label>小数点以下の桁数:
                            <input type="number" class="ss-fc-dec border" min="0" max="10" value="${curDec}" style="width:65px; height:22px; background:#fff; color:#000;">
                        </label>
                        <div style="display:flex; flex-direction:column; gap:3px;">
                            <label>ユーザー定義書式:</label>
                            <input type="text" class="ss-fc-custom border" value="${escapeHtml(curCustomPattern)}" style="width:100%; height:24px; padding:2px 6px; background:#fff; color:#000; font-family:monospace;">
                            <select class="ss-fc-custom-presets border" size="4" style="width:100%; background:#fff; color:#000; font-size:11px;">
                                <option value='#,##0"円"'>#,##0"円"</option>
                                <option value='yyyy"年"m"月"d"日"(aaa)'>yyyy"年"m"月"d"日"(aaa)</option>
                                <option value='#,##0;[赤]-#,##0;"-"'>#,##0;[赤]-#,##0;"-"</option>
                                <option value='"No."0000'>"No."0000</option>
                                <option value='0.00%'>0.00%</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 2. 配置 -->
            <div class="ss-xl-tabpanel ${initialTab === "align" ? "active" : ""}" data-fc-panel="align">
                <div class="ss-fmt-grid">
                    <fieldset class="ss-fmt-fieldset">
                        <legend>文字の配置</legend>
                        <label>横位置:
                            <select class="ss-fc-halign border" style="width:100%; height:24px; background:#fff; color:#000;">
                                <option value="general" ${curAlign === "general" ? "selected" : ""}>標準</option>
                                <option value="left" ${curAlign === "left" ? "selected" : ""}>左詰め (インデント)</option>
                                <option value="center" ${curAlign === "center" ? "selected" : ""}>中央揃え</option>
                                <option value="right" ${curAlign === "right" ? "selected" : ""}>右詰め (インデント)</option>
                                <option value="justify" ${curAlign === "justify" ? "selected" : ""}>均等割り付け</option>
                            </select>
                        </label>
                        <label>インデント (0〜15):
                            <input type="number" class="ss-fc-indent border" min="0" max="15" value="${curIndent}" style="width:65px; height:22px; background:#fff; color:#000;">
                        </label>
                        <label>縦位置:
                            <select class="ss-fc-valign border" style="width:100%; height:24px; background:#fff; color:#000;">
                                <option value="top" ${curValign === "top" ? "selected" : ""}>上詰め</option>
                                <option value="middle" ${curValign === "middle" ? "selected" : ""}>中央揃え</option>
                                <option value="bottom" ${curValign === "bottom" ? "selected" : ""}>下詰め</option>
                            </select>
                        </label>
                    </fieldset>
                    <fieldset class="ss-fmt-fieldset">
                        <legend>文字の制御・方向</legend>
                        <label style="cursor:pointer;"><input type="checkbox" class="ss-fc-wrap" ${curWrap ? "checked" : ""}> 折り返して全体を表示する</label>
                        <label style="cursor:pointer;"><input type="checkbox" class="ss-fc-shrink" ${curShrink ? "checked" : ""}> 縮小して全体を表示する</label>
                        <label style="cursor:pointer;"><input type="checkbox" class="ss-fc-vertical" ${curVertical ? "checked" : ""}> 縦書き</label>
                        <label>文字角度 (-90〜90°):
                            <input type="number" class="ss-fc-rot border" min="-90" max="90" step="15" value="${curRotation}" style="width:65px; height:22px; background:#fff; color:#000;">
                        </label>
                    </fieldset>
                </div>
            </div>

            <!-- 3. フォント -->
            <div class="ss-xl-tabpanel ${initialTab === "font" ? "active" : ""}" data-fc-panel="font">
                <div class="ss-fmt-grid">
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        <label>フォント名:
                            <select class="ss-fc-font border" style="width:100%; height:24px; background:#fff; color:#000;">
                                <option value="'MS PGothic', 'MS Gothic', sans-serif">MS Pゴシック</option>
                                <option value="'Meiryo', 'メイリオ', sans-serif">メイリオ</option>
                                <option value="'Yu Gothic', '游ゴシック', sans-serif">游ゴシック</option>
                                <option value="'MS PMincho', 'MS Mincho', serif">MS P明朝</option>
                                <option value="'Yu Mincho', '游明朝', serif">游明朝</option>
                                <option value="Arial, Helvetica, sans-serif">Arial</option>
                                <option value="Consolas, 'Courier New', monospace">Consolas</option>
                            </select>
                        </label>
                        <label>サイズ (px):
                            <input type="number" class="ss-fc-size border" min="6" max="144" value="${curSize}" style="width:72px; height:22px; background:#fff; color:#000;">
                        </label>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <label>文字色: <input type="color" class="ss-fc-fg" value="${curFgHex}"></label>
                            <label style="cursor:pointer;"><input type="checkbox" class="ss-fc-fg-auto" ${!curHasFg ? "checked" : ""}> 自動</label>
                        </div>
                    </div>
                    <fieldset class="ss-fmt-fieldset">
                        <legend>スタイル・文字飾り</legend>
                        <label style="cursor:pointer;"><input type="checkbox" class="ss-fc-bold" ${curBold ? "checked" : ""}> 太字</label>
                        <label style="cursor:pointer;"><input type="checkbox" class="ss-fc-italic" ${curItalic ? "checked" : ""}> 斜体</label>
                        <label style="cursor:pointer;"><input type="checkbox" class="ss-fc-underline" ${curDeco.includes("underline") ? "checked" : ""}> 下線</label>
                        <label style="cursor:pointer;"><input type="checkbox" class="ss-fc-strike" ${curDeco.includes("line-through") ? "checked" : ""}> 取り消し線</label>
                    </fieldset>
                </div>
                <div class="ss-fc-font-preview border" style="height:36px; line-height:34px; text-align:center; background:#fff;">AaBbCc 123 日本語</div>
            </div>

            <!-- 4. 罫線 -->
            <div class="ss-xl-tabpanel ${initialTab === "border" ? "active" : ""}" data-fc-panel="border">
                <div class="ss-fmt-grid">
                    <fieldset class="ss-fmt-fieldset">
                        <legend>線の種類と色</legend>
                        <select class="ss-fc-bstyle border" style="width:100%; height:24px; background:#fff; color:#000;">
                            <option value="1px solid">細実線</option>
                            <option value="2px solid" selected>実線 (標準)</option>
                            <option value="4px solid">太実線</option>
                            <option value="3px double">二重線</option>
                            <option value="2px dashed">破線</option>
                            <option value="2px dotted">点線</option>
                        </select>
                        <label>線の色: <input type="color" class="ss-fc-bcolor" value="#000000"></label>
                        <div class="ss-fmt-border-preview">
                            <div class="ss-fc-bp-tl">A1</div>
                            <div class="ss-fc-bp-tr">B1</div>
                            <div class="ss-fc-bp-bl">A2</div>
                            <div class="ss-fc-bp-br">B2</div>
                        </div>
                    </fieldset>
                    <fieldset class="ss-fmt-fieldset">
                        <legend>プリセット・適用辺</legend>
                        <div style="display:flex; gap:4px; flex-wrap:wrap;">
                            <button type="button" class="button ss-fc-bpreset" data-bp="none">なし</button>
                            <button type="button" class="button ss-fc-bpreset" data-bp="outer">外枠</button>
                            <button type="button" class="button ss-fc-bpreset" data-bp="all">格子</button>
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px; margin-top:4px;">
                            <label style="cursor:pointer;"><input type="checkbox" class="ss-fc-b-top"> 上辺</label>
                            <label style="cursor:pointer;"><input type="checkbox" class="ss-fc-b-bottom"> 下辺</label>
                            <label style="cursor:pointer;"><input type="checkbox" class="ss-fc-b-left"> 左辺</label>
                            <label style="cursor:pointer;"><input type="checkbox" class="ss-fc-b-right"> 右辺</label>
                            <label style="cursor:pointer; grid-column:1 / -1;"><input type="checkbox" class="ss-fc-b-inner"> 内側の罫線</label>
                        </div>
                        <label style="margin-top:4px; font-weight:bold; cursor:pointer;">
                            <input type="checkbox" class="ss-fc-b-apply"> 罫線設定を適用する
                        </label>
                    </fieldset>
                </div>
            </div>

            <!-- 5. 塗りつぶし -->
            <div class="ss-xl-tabpanel ${initialTab === "fill" ? "active" : ""}" data-fc-panel="fill">
                <fieldset class="ss-fmt-fieldset">
                    <legend>セルの背景色</legend>
                    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                        <label>背景色: <input type="color" class="ss-fc-bg" value="${curBgHex}"></label>
                        <label style="cursor:pointer;"><input type="checkbox" class="ss-fc-bg-none" ${!curBgRaw ? "checked" : ""}> 塗りつぶしなし</label>
                        <label style="font-weight:bold; cursor:pointer;"><input type="checkbox" class="ss-fc-bg-apply"> 背景色を変更する</label>
                    </div>
                    <div style="display:flex; gap:4px; flex-wrap:wrap; margin-top:4px;">
                        ${["#ffffff", "#f2f2f2", "#d9d9d9", "#d9e1f2", "#bdd7ee", "#fce4d6", "#fff2cc", "#e2efda", "#ffc7ce", "#c6efce", "#ffeb9c", "#e9d8f4"].map(c =>
            `<span class="ss-fc-bg-swatch" data-c="${c}" style="width:22px;height:22px;background:${c};border:1px solid #666;cursor:pointer;display:inline-block;"></span>`
        ).join("")}
                    </div>
                    <div class="ss-fc-bg-preview border" style="height:26px; margin-top:4px; background:${curBgRaw || "#ffffff"};"></div>
                </fieldset>
            </div>

            <!-- 6. 保護・条件付き書式連携 -->
            <div class="ss-xl-tabpanel ${initialTab === "protect" ? "active" : ""}" data-fc-panel="protect">
                <fieldset class="ss-fmt-fieldset">
                    <legend>シート保護時のセル属性</legend>
                    <label style="cursor:pointer;"><input type="checkbox" class="ss-fc-locked" ${curLocked ? "checked" : ""}> ロック</label>
                    <label style="cursor:pointer;"><input type="checkbox" class="ss-fc-hidden" ${curHidden ? "checked" : ""}> 表示しない（数式バーに数式を表示しない）</label>
                </fieldset>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                    <span style="font-size:11px; color:#444;">条件に応じた自動書式は条件付き書式と連携します。</span>
                    <button type="button" class="button ss-fc-open-cf">📊 条件付き書式の管理...</button>
                </div>
            </div>
        </div>`;

        const fcDirty = {
            number: false, hAlign: false, indent: false, vAlign: false,
            wrap: false, shrink: false, vertical: false, rot: false,
            fontFam: false, fontSize: false, bold: false, italic: false,
            deco: false, fg: false, locked: false, hidden: false
        };

        const modal = openAppModal("セルの書式設定", bodyHtml, {
            width: 500,
            isHtml: true,
            buttons: [
                {
                    label: "OK",
                    onClick: () => {
                        const cat = modal.querySelector(".ss-fc-cat").value;
                        const dec = modal.querySelector(".ss-fc-dec").value;
                        const customPat = modal.querySelector(".ss-fc-custom").value.trim();

                        const hAlign = modal.querySelector(".ss-fc-halign").value;
                        const indent = Math.max(0, Math.min(15, Number(modal.querySelector(".ss-fc-indent").value) || 0));
                        const vAlign = modal.querySelector(".ss-fc-valign").value;
                        const wrap = modal.querySelector(".ss-fc-wrap").checked;
                        const shrink = modal.querySelector(".ss-fc-shrink").checked;
                        const vertical = modal.querySelector(".ss-fc-vertical").checked;
                        const rot = Math.max(-90, Math.min(90, Number(modal.querySelector(".ss-fc-rot").value) || 0));

                        const fontFam = modal.querySelector(".ss-fc-font").value;
                        const fontSize = `${Math.max(6, Math.min(144, Number(modal.querySelector(".ss-fc-size").value) || 14))}px`;
                        const bold = modal.querySelector(".ss-fc-bold").checked;
                        const italic = modal.querySelector(".ss-fc-italic").checked;
                        const ul = modal.querySelector(".ss-fc-underline").checked;
                        const st = modal.querySelector(".ss-fc-strike").checked;
                        const fgAuto = modal.querySelector(".ss-fc-fg-auto").checked;
                        const fg = modal.querySelector(".ss-fc-fg").value;

                        const applyBorder = modal.querySelector(".ss-fc-b-apply").checked;
                        const bCss = `${modal.querySelector(".ss-fc-bstyle").value} ${modal.querySelector(".ss-fc-bcolor").value}`;
                        const bTop = modal.querySelector(".ss-fc-b-top").checked;
                        const bBottom = modal.querySelector(".ss-fc-b-bottom").checked;
                        const bLeft = modal.querySelector(".ss-fc-b-left").checked;
                        const bRight = modal.querySelector(".ss-fc-b-right").checked;
                        const bInner = modal.querySelector(".ss-fc-b-inner").checked;

                        const applyBg = modal.querySelector(".ss-fc-bg-apply").checked;
                        const bgNone = modal.querySelector(".ss-fc-bg-none").checked;
                        const bg = modal.querySelector(".ss-fc-bg").value;

                        const locked = modal.querySelector(".ss-fc-locked").checked;
                        const hidden = modal.querySelector(".ss-fc-hidden").checked;

                        const anyChanged = applyBorder || applyBg || Object.values(fcDirty).some(Boolean);
                        if (!anyChanged) return;

                        let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
                        targetCells.forEach(td => {
                            const r0 = +td.dataset.row, c0 = +td.dataset.col;
                            const r1 = r0 + (+td.getAttribute("rowspan") || 1) - 1;
                            const c1 = c0 + (+td.getAttribute("colspan") || 1) - 1;
                            if (r0 < minR) minR = r0;
                            if (r1 > maxR) maxR = r1;
                            if (c0 < minC) minC = c0;
                            if (c1 > maxC) maxC = c1;
                        });

                        const affectedRows = new Set();
                        targetCells.forEach(td => {
                            // 1. 表示形式（変更時のみ）
                            if (fcDirty.number) {
                                if (cat === "custom" && customPat) {
                                    td.dataset.numFormat = `custom:${customPat}`;
                                    delete td.dataset.decimalPlaces;
                                    delete td.dataset.quotePrefix;
                                } else if (cat === "text") {
                                    td.dataset.numFormat = "text";
                                    td.dataset.quotePrefix = "1";
                                    delete td.dataset.decimalPlaces;
                                } else if (cat === "general") {
                                    delete td.dataset.numFormat;
                                    delete td.dataset.decimalPlaces;
                                    delete td.dataset.quotePrefix;
                                } else {
                                    td.dataset.numFormat = cat;
                                    delete td.dataset.quotePrefix;
                                    if (cat === "comma" || cat === "currency" || cat === "percent") {
                                        td.dataset.decimalPlaces = String(dec);
                                    } else {
                                        delete td.dataset.decimalPlaces;
                                    }
                                }
                            }

                            // 2. 配置・インデント・折り返し・縮小・方向（変更項目のみ）
                            if (fcDirty.hAlign) td.style.textAlign = hAlign === "general" ? "" : hAlign;
                            if (fcDirty.vAlign) td.style.verticalAlign = vAlign;
                            if (fcDirty.indent || fcDirty.hAlign) {
                                const effIndent = fcDirty.indent ? indent : Number(td.dataset.indent || "0");
                                const effAlign = td.style.textAlign || "general";
                                if (fcDirty.indent) {
                                    if (effIndent > 0) td.dataset.indent = String(effIndent);
                                    else delete td.dataset.indent;
                                }
                                td.style.paddingLeft = (effAlign === "left" || effAlign === "general") && effIndent > 0 ? `${4 + effIndent * 10}px` : "";
                                td.style.paddingRight = effAlign === "right" && effIndent > 0 ? `${4 + effIndent * 10}px` : "";
                            }
                            if (fcDirty.wrap) {
                                td.style.whiteSpace = wrap ? "pre-wrap" : "";
                                td.style.wordBreak = wrap ? "break-all" : "";
                            }
                            if (fcDirty.shrink) {
                                if (shrink) td.dataset.shrinkToFit = "1";
                                else delete td.dataset.shrinkToFit;
                            }
                            if (fcDirty.vertical) {
                                td.style.writingMode = vertical ? "vertical-rl" : "";
                                td.style.textOrientation = vertical ? "upright" : "";
                            }
                            if (fcDirty.rot) {
                                if (rot !== 0) td.dataset.textRotation = String(rot);
                                else delete td.dataset.textRotation;
                            }

                            // 3. フォント（変更項目のみ）
                            if (fcDirty.fontFam) td.style.fontFamily = fontFam;
                            if (fcDirty.fontSize) {
                                td.style.fontSize = fontSize;
                                delete td.dataset.origFontSize;
                            }
                            if (fcDirty.bold) {
                                td.style.fontWeight = bold ? "bold" : "";
                                if (td.dataset.cfApplied) td.dataset.cfOrigWeight = td.style.fontWeight;
                            }
                            if (fcDirty.italic) {
                                td.style.fontStyle = italic ? "italic" : "";
                                if (td.dataset.cfApplied) td.dataset.cfOrigItalic = td.style.fontStyle;
                            }
                            if (fcDirty.deco) {
                                const decos = [];
                                if (ul) decos.push("underline");
                                if (st) decos.push("line-through");
                                td.style.textDecoration = decos.join(" ");
                                if (td.dataset.cfApplied) td.dataset.cfOrigDeco = td.style.textDecoration;
                            }
                            if (fcDirty.fg) {
                                const nextFg = fgAuto ? "" : fg;
                                td.style.color = nextFg;
                                if (td.dataset.cfApplied) td.dataset.cfOrigColor = nextFg;
                            }

                            // 4. 罫線
                            if (applyBorder) {
                                const r0 = +td.dataset.row, c0 = +td.dataset.col;
                                const r1 = r0 + (+td.getAttribute("rowspan") || 1) - 1;
                                const c1 = c0 + (+td.getAttribute("colspan") || 1) - 1;
                                td.style.borderTop = (r0 === minR ? bTop : bInner) ? bCss : "";
                                td.style.borderBottom = (r1 === maxR ? bBottom : bInner) ? bCss : "";
                                td.style.borderLeft = (c0 === minC ? bLeft : bInner) ? bCss : "";
                                td.style.borderRight = (c1 === maxC ? bRight : bInner) ? bCss : "";
                            }

                            // 5. 塗りつぶし
                            if (applyBg) {
                                const nextBg = bgNone ? "" : bg;
                                td.style.backgroundColor = nextBg;
                                if (td.dataset.cfApplied) td.dataset.cfOrigBg = nextBg;
                            }

                            // 6. 保護（変更項目のみ）
                            if (fcDirty.locked) td.dataset.locked = locked ? "1" : "0";
                            if (fcDirty.hidden) {
                                if (hidden) td.dataset.formulaHidden = "1";
                                else delete td.dataset.formulaHidden;
                            }

                            if (fcDirty.number || fcDirty.hAlign || fcDirty.rot || fcDirty.vertical) {
                                const raw = td.dataset.formula ? evaluateFormula(td.dataset.formula) : (td.dataset.rawValue ?? getCellPureText(td));
                                setCellFormattedValue(td, raw);
                            }
                            if (fcDirty.shrink || fcDirty.fontSize || fcDirty.fontFam || fcDirty.number) {
                                applyShrinkToFit(td);
                            }
                            const tr = td.closest("tr");
                            if (tr && ((fcDirty.wrap && wrap) || (fcDirty.vertical && vertical) || fcDirty.fontSize)) {
                                affectedRows.add(tr);
                            }
                        });

                        affectedRows.forEach(tr => autoFitRow(tr));
                        applyConditionalFormats();
                        updateToolbarState();
                        scheduleTextOverflowUpdate();
                        setDirtyState(true);
                        debouncedSaveState();
                    }
                },
                { label: "キャンセル" }
            ]
        });

        // 実際にユーザーが変更した項目だけ dirty フラグを立てる
        const bindDirty = (sel, key) => {
            const el = modal.querySelector(sel);
            if (!el) return;
            el.addEventListener("change", () => { fcDirty[key] = true; });
            if (el.tagName === "INPUT" && (el.type === "text" || el.type === "number" || el.type === "color")) {
                el.addEventListener("input", () => { fcDirty[key] = true; });
            }
        };
        bindDirty(".ss-fc-cat", "number");
        bindDirty(".ss-fc-dec", "number");
        bindDirty(".ss-fc-custom", "number");
        bindDirty(".ss-fc-custom-presets", "number");
        bindDirty(".ss-fc-halign", "hAlign");
        bindDirty(".ss-fc-indent", "indent");
        bindDirty(".ss-fc-valign", "vAlign");
        bindDirty(".ss-fc-wrap", "wrap");
        bindDirty(".ss-fc-shrink", "shrink");
        bindDirty(".ss-fc-vertical", "vertical");
        bindDirty(".ss-fc-rot", "rot");
        bindDirty(".ss-fc-font", "fontFam");
        bindDirty(".ss-fc-size", "fontSize");
        bindDirty(".ss-fc-bold", "bold");
        bindDirty(".ss-fc-italic", "italic");
        bindDirty(".ss-fc-underline", "deco");
        bindDirty(".ss-fc-strike", "deco");
        bindDirty(".ss-fc-fg", "fg");
        bindDirty(".ss-fc-fg-auto", "fg");
        bindDirty(".ss-fc-locked", "locked");
        bindDirty(".ss-fc-hidden", "hidden");

        // 初期フォント選択一致
        const fontSel = modal.querySelector(".ss-fc-font");
        const normFont = curFont.toLowerCase().replace(/["']/g, "");
        for (const opt of fontSel.options) {
            if (normFont.includes(opt.value.split(",")[0].trim().toLowerCase().replace(/["']/g, ""))) {
                opt.selected = true;
                break;
            }
        }

        // タブ切替
        modal.querySelectorAll(".ss-xl-tab[data-fc-tab]").forEach(tab => {
            tab.addEventListener("click", () => {
                const name = tab.dataset.fcTab;
                modal.querySelectorAll(".ss-xl-tab[data-fc-tab]").forEach(t => t.classList.toggle("active", t === tab));
                modal.querySelectorAll(".ss-xl-tabpanel[data-fc-panel]").forEach(p => p.classList.toggle("active", p.dataset.fcPanel === name));
            });
        });

        // 表示形式サンプル連動
        const catSel = modal.querySelector(".ss-fc-cat");
        const decInp = modal.querySelector(".ss-fc-dec");
        const customInp = modal.querySelector(".ss-fc-custom");
        const sampleEl = modal.querySelector(".ss-fc-sample");
        const rawSample = (ref.dataset.rawValue ?? getCellPureText(ref)).trim() || "12345.67";

        const updateSample = () => {
            const c = catSel.value;
            const fmt = c === "custom" ? `custom:${customInp.value.trim()}` : c;
            sampleEl.textContent = formatDisplayByNumFmt(rawSample, fmt, {
                dataset: { decimalPlaces: (c === "comma" || c === "currency" || c === "percent") ? decInp.value : "" }
            });
        };
        [catSel, decInp, customInp].forEach(el => {
            el.addEventListener("input", updateSample);
            el.addEventListener("change", updateSample);
        });
        modal.querySelector(".ss-fc-custom-presets").addEventListener("change", (ev) => {
            catSel.value = "custom";
            customInp.value = ev.target.value;
            updateSample();
        });
        updateSample();

        // フォントプレビュー連動
        const fontPreview = modal.querySelector(".ss-fc-font-preview");
        const syncFontPreview = () => {
            fontPreview.style.fontFamily = fontSel.value;
            fontPreview.style.fontSize = `${Math.min(26, Number(modal.querySelector(".ss-fc-size").value) || 14)}px`;
            fontPreview.style.fontWeight = modal.querySelector(".ss-fc-bold").checked ? "bold" : "normal";
            fontPreview.style.fontStyle = modal.querySelector(".ss-fc-italic").checked ? "italic" : "normal";
            const ds = [];
            if (modal.querySelector(".ss-fc-underline").checked) ds.push("underline");
            if (modal.querySelector(".ss-fc-strike").checked) ds.push("line-through");
            fontPreview.style.textDecoration = ds.join(" ");
            fontPreview.style.color = modal.querySelector(".ss-fc-fg-auto").checked ? "#000000" : modal.querySelector(".ss-fc-fg").value;
        };
        modal.querySelector(".ss-fc-fg").addEventListener("input", () => {
            modal.querySelector(".ss-fc-fg-auto").checked = false;
            syncFontPreview();
        });
        [".ss-fc-font", ".ss-fc-size", ".ss-fc-bold", ".ss-fc-italic", ".ss-fc-underline", ".ss-fc-strike", ".ss-fc-fg-auto"]
            .forEach(sel => modal.querySelector(sel).addEventListener("change", syncFontPreview));
        syncFontPreview();

        // 罫線プレビュー連動
        const syncBorderPreview = () => {
            const css = `${modal.querySelector(".ss-fc-bstyle").value} ${modal.querySelector(".ss-fc-bcolor").value}`;
            const t = modal.querySelector(".ss-fc-b-top").checked ? css : "none";
            const b = modal.querySelector(".ss-fc-b-bottom").checked ? css : "none";
            const l = modal.querySelector(".ss-fc-b-left").checked ? css : "none";
            const r = modal.querySelector(".ss-fc-b-right").checked ? css : "none";
            const inn = modal.querySelector(".ss-fc-b-inner").checked ? css : "none";
            const tl = modal.querySelector(".ss-fc-bp-tl").style;
            const tr = modal.querySelector(".ss-fc-bp-tr").style;
            const bl = modal.querySelector(".ss-fc-bp-bl").style;
            const br = modal.querySelector(".ss-fc-bp-br").style;
            tl.borderTop = t; tl.borderLeft = l; tl.borderRight = inn; tl.borderBottom = inn;
            tr.borderTop = t; tr.borderRight = r; tr.borderLeft = "none"; tr.borderBottom = inn;
            bl.borderBottom = b; bl.borderLeft = l; bl.borderRight = inn; bl.borderTop = "none";
            br.borderBottom = b; br.borderRight = r; br.borderLeft = "none"; br.borderTop = "none";
        };
        modal.querySelectorAll(".ss-fc-bpreset").forEach(btn => {
            btn.addEventListener("click", () => {
                modal.querySelector(".ss-fc-b-apply").checked = true;
                const bp = btn.dataset.bp;
                const outer = bp === "outer" || bp === "all";
                modal.querySelector(".ss-fc-b-top").checked = outer;
                modal.querySelector(".ss-fc-b-bottom").checked = outer;
                modal.querySelector(".ss-fc-b-left").checked = outer;
                modal.querySelector(".ss-fc-b-right").checked = outer;
                modal.querySelector(".ss-fc-b-inner").checked = bp === "all";
                syncBorderPreview();
            });
        });
        [".ss-fc-bstyle", ".ss-fc-bcolor", ".ss-fc-b-top", ".ss-fc-b-bottom", ".ss-fc-b-left", ".ss-fc-b-right", ".ss-fc-b-inner"].forEach(sel => {
            modal.querySelector(sel).addEventListener("change", () => {
                modal.querySelector(".ss-fc-b-apply").checked = true;
                syncBorderPreview();
            });
        });

        // 背景色プレビュー連動
        const bgInp = modal.querySelector(".ss-fc-bg");
        const bgNoneChk = modal.querySelector(".ss-fc-bg-none");
        const bgApplyChk = modal.querySelector(".ss-fc-bg-apply");
        const bgPrev = modal.querySelector(".ss-fc-bg-preview");
        const syncBgPrev = () => { bgPrev.style.backgroundColor = bgNoneChk.checked ? "#ffffff" : bgInp.value; };
        bgInp.addEventListener("input", () => { bgNoneChk.checked = false; bgApplyChk.checked = true; syncBgPrev(); });
        bgNoneChk.addEventListener("change", () => { bgApplyChk.checked = true; syncBgPrev(); });
        modal.querySelectorAll(".ss-fc-bg-swatch").forEach(sw => {
            sw.addEventListener("click", () => {
                bgInp.value = sw.dataset.c;
                bgNoneChk.checked = false;
                bgApplyChk.checked = true;
                syncBgPrev();
            });
        });

        // 条件付き書式管理への連携
        modal.querySelector(".ss-fc-open-cf").addEventListener("click", () => {
            modal.closest(".window")?.querySelector(".close-btn, .window-close")?.click();
            openConditionalFormatManager();
        });
    }

    function openAutoFormatDialog() {
        flushPendingEdits();
        const bounds = detectDataBlockBounds(activeCell) || getSelectedRangeBounds();
        if (!bounds) {
            showAlert("オートフォーマットを適用する表またはセル範囲を選択してください。", "オートフォーマット");
            return;
        }

        let selectedStyleId = AUTO_FORMAT_STYLES[1].id;
        const rangeLabel = `${getCellReferenceByCoord(bounds.minRow, bounds.minCol)}:${getCellReferenceByCoord(bounds.maxRow, bounds.maxCol)}`;

        const bodyHtml = `
            <div style="width:100%; display:flex; flex-direction:column; gap:8px; font-size:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span>適用先範囲: <b>${escapeHtml(rangeLabel)}</b></span>
                    <div style="display:flex; gap:10px;">
                        <label style="cursor:pointer;"><input type="checkbox" class="ss-af-opt-header" checked> 先頭行を見出しにする</label>
                        <label style="cursor:pointer;"><input type="checkbox" class="ss-af-opt-total" checked> 最終行を合計行にする</label>
                    </div>
                </div>
                <div class="ss-af-grid"></div>
                <fieldset style="border:1px solid #808080; padding:6px 8px; margin:0;">
                    <legend style="padding:0 4px; font-size:11px;">適用する書式（リアルタイムプレビュー連動）</legend>
                    <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:4px 10px; font-size:11px;">
                        <label style="cursor:pointer;"><input type="checkbox" class="ss-af-opt-number" checked> 数値書式</label>
                        <label style="cursor:pointer;"><input type="checkbox" class="ss-af-opt-border" checked> 罫線</label>
                        <label style="cursor:pointer;"><input type="checkbox" class="ss-af-opt-font" checked> フォント</label>
                        <label style="cursor:pointer;"><input type="checkbox" class="ss-af-opt-pattern" checked> パターン（網掛け）</label>
                        <label style="cursor:pointer;"><input type="checkbox" class="ss-af-opt-align" checked> 配置</label>
                        <label style="cursor:pointer;"><input type="checkbox" class="ss-af-opt-autofit" checked> 幅/高さを自動調整</label>
                    </div>
                </fieldset>
            </div>
        `;

        const modalContent = openAppModal("オートフォーマット（表の自動書式設定）", bodyHtml, {
            width: 540,
            isHtml: true,
            parentWin: win,
            buttons: [
                {
                    label: "OK",
                    onClick: () => {
                        const styleDef = AUTO_FORMAT_STYLES.find(s => s.id === selectedStyleId) || AUTO_FORMAT_STYLES[0];
                        applyAutoFormatToBounds(bounds, styleDef, readOpts());
                        statusBarState.stateText = `オートフォーマット「${styleDef.name}」を適用しました`;
                        renderWindowStatusBar();
                    }
                },
                { label: "キャンセル" }
            ]
        });

        const gridEl = modalContent.querySelector(".ss-af-grid");
        const readOpts = () => ({
            hasHeader: Boolean(modalContent.querySelector(".ss-af-opt-header")?.checked),
            hasTotal: Boolean(modalContent.querySelector(".ss-af-opt-total")?.checked),
            number: Boolean(modalContent.querySelector(".ss-af-opt-number")?.checked),
            border: Boolean(modalContent.querySelector(".ss-af-opt-border")?.checked),
            font: Boolean(modalContent.querySelector(".ss-af-opt-font")?.checked),
            pattern: Boolean(modalContent.querySelector(".ss-af-opt-pattern")?.checked),
            align: Boolean(modalContent.querySelector(".ss-af-opt-align")?.checked),
            autoFit: Boolean(modalContent.querySelector(".ss-af-opt-autofit")?.checked)
        });

        const renderCards = () => {
            const opts = readOpts();
            gridEl.innerHTML = AUTO_FORMAT_STYLES.map(st => `
                <div class="ss-af-card ${st.id === selectedStyleId ? "selected" : ""}" data-af-id="${st.id}">
                    <div class="ss-af-card-title">${escapeHtml(st.name)}</div>
                    ${buildAutoFormatSampleHtml(st, opts)}
                </div>
            `).join("");

            gridEl.querySelectorAll(".ss-af-card").forEach(card => {
                card.addEventListener("click", () => {
                    selectedStyleId = card.dataset.afId;
                    gridEl.querySelectorAll(".ss-af-card").forEach(c => c.classList.toggle("selected", c === card));
                });
                card.addEventListener("dblclick", () => {
                    selectedStyleId = card.dataset.afId;
                    (modalContent.closest(".window") || modalContent).querySelector(".button-container button")?.click();
                });
            });
        };

        modalContent.querySelectorAll("input[type='checkbox']").forEach(chk => {
            chk.addEventListener("change", renderCards);
        });
        renderCards();
    }

    // =========================================================
    // 構造化テーブル（Ctrl+T / 集計行 / 自動範囲拡張 / 構造化参照）
    // =========================================================
    const TABLE_THEMES = {
        blue: { headerBg: "#1f4e78", headerFg: "#ffffff", stripeBg: "#d9e1f2", evenBg: "#ffffff", bodyFg: "#000000", border: "1px solid #8ea9db" },
        orange: { headerBg: "#c65911", headerFg: "#ffffff", stripeBg: "#fce4d6", evenBg: "#ffffff", bodyFg: "#000000", border: "1px solid #f4b084" },
        gray: { headerBg: "#595959", headerFg: "#ffffff", stripeBg: "#ededed", evenBg: "#ffffff", bodyFg: "#000000", border: "1px solid #a6a6a6" },
        gold: { headerBg: "#bf8f00", headerFg: "#ffffff", stripeBg: "#fff2cc", evenBg: "#ffffff", bodyFg: "#000000", border: "1px solid #ffd966" },
        sky: { headerBg: "#2f75b5", headerFg: "#ffffff", stripeBg: "#ddebf7", evenBg: "#ffffff", bodyFg: "#000000", border: "1px solid #9bc2e6" },
        green: { headerBg: "#375623", headerFg: "#ffffff", stripeBg: "#e2efda", evenBg: "#ffffff", bodyFg: "#000000", border: "1px solid #a9d08e" },
        purple: { headerBg: "#7030a0", headerFg: "#ffffff", stripeBg: "#e9d8f4", evenBg: "#ffffff", bodyFg: "#000000", border: "1px solid #b88ce0" },
        teal: { headerBg: "#008080", headerFg: "#ffffff", stripeBg: "#d9f2f2", evenBg: "#ffffff", bodyFg: "#000000", border: "1px solid #80cccc" },
        lightBlue: { headerBg: "#d9e1f2", headerFg: "#1f4e78", stripeBg: "#f2f5fb", evenBg: "#ffffff", bodyFg: "#000000", border: "1px solid #b4c6e7" },
        lightGreen: { headerBg: "#e2efda", headerFg: "#375623", stripeBg: "#f4f9f0", evenBg: "#ffffff", bodyFg: "#000000", border: "1px solid #c6e0b4" },
        darkNavy: { headerBg: "#0f243e", headerFg: "#ffffff", stripeBg: "#244062", evenBg: "#17375e", bodyFg: "#ffffff", border: "1px solid #4f81bd" },
        darkRed: { headerBg: "#632523", headerFg: "#ffffff", stripeBg: "#963634", evenBg: "#7c2d2b", bodyFg: "#ffffff", border: "1px solid #c0504d" }
    };

    function getSheetTables(sheetIdx = activeSheetIndex) {
        if (!sheets[sheetIdx]) return [];
        if (!Array.isArray(sheets[sheetIdx].tables)) sheets[sheetIdx].tables = [];
        return sheets[sheetIdx].tables;
    }

    function findTableAtCoord(row, col, sheetIdx = activeSheetIndex) {
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

    function convertRangeToStructuredTable(themeKey = "blue") {
        flushPendingEdits();
        const bounds = detectDataBlockBounds(activeCell) || getSelectedRangeBounds();
        if (!bounds) {
            showAlert("テーブルに変換するセル範囲を選択してください。", "テーブルの作成");
            return;
        }

        const useHeader = appRoot.querySelector(".ss-tbl-opt-header")?.checked ?? true;
        const useStripe = appRoot.querySelector(".ss-tbl-opt-stripe")?.checked ?? true;

        // 既存テーブルと重複する場合はテーマとオプションのみ更新
        const existing = findTableAtCoord(bounds.minRow, bounds.minCol);
        if (existing) {
            existing.themeKey = themeKey;
            existing.useStripe = useStripe;
            applyStructuredTableVisuals(existing);
            setDirtyState(true);
            debouncedSaveState();
            return;
        }

        const tables = getSheetTables();
        let num = tables.length + 1;
        while (tables.some(t => t.name === `テーブル${num}`)) num++;
        const tableName = `テーブル${num}`;

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

    function toggleStructuredTableTotalRow() {
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
            if (newTotalR >= rowCount) loadRowsSync(5);
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

    // テーブル末尾直下への入力時にテーブル範囲・スタイル・数式を自動拡張
    function tryAutoExpandStructuredTable(row, col) {
        const tables = getSheetTables();
        for (const tbl of tables) {
            if (col < tbl.minCol || col > tbl.maxCol) continue;
            const appendTargetRow = tbl.hasTotalRow ? tbl.maxRow : tbl.maxRow + 1;
            if (row !== appendTargetRow) continue;

            if (tbl.hasTotalRow) {
                // 集計行を1行下へ退避してからデータ行を挿入
                const oldTotalR = tbl.maxRow;
                const newTotalR = oldTotalR + 1;
                if (newTotalR >= rowCount) loadRowsSync(5);

                for (let c = tbl.minCol; c <= tbl.maxCol; c++) {
                    const oldTotCell = getVisibleCell(oldTotalR, c);
                    const newTotCell = getVisibleCell(newTotalR, c);
                    if (!oldTotCell || !newTotCell) continue;

                    const colLetter = getColumnName(c);
                    const dataStartR = tbl.hasHeader ? tbl.minRow + 1 : tbl.minRow;
                    if (oldTotCell.dataset.formula) {
                        const updatedF = oldTotCell.dataset.formula.replace(
                            new RegExp(`(\\$?${colLetter}\\$?\\d+:\\$?${colLetter}\\$?)${oldTotalR - 1}\\b`, "gi"),
                            `$1${oldTotalR}`
                        );
                        newTotCell.dataset.formula = updatedF;
                        setCellFormattedValue(newTotCell, evaluateFormula(updatedF));
                        delete oldTotCell.dataset.formula;
                    } else if (c === tbl.minCol && oldTotCell.textContent === "集計") {
                        setCellFormattedValue(newTotCell, "集計");
                        if (c !== col) setCellFormattedValue(oldTotCell, "");
                    }
                    if (oldTotCell.dataset.dropdownList) {
                        newTotCell.dataset.dropdownList = oldTotCell.dataset.dropdownList;
                        delete oldTotCell.dataset.dropdownList;
                    }
                }
                tbl.maxRow = newTotalR;
            } else {
                tbl.maxRow = row;
            }

            // 1行上の数式列・表示形式を自動継承
            const prevDataRow = row - 1;
            if (prevDataRow >= (tbl.hasHeader ? tbl.minRow + 1 : tbl.minRow)) {
                for (let c = tbl.minCol; c <= tbl.maxCol; c++) {
                    const prevCell = getVisibleCell(prevDataRow, c);
                    const curCell = getVisibleCell(row, c);
                    if (!prevCell || !curCell) continue;
                    if (prevCell.dataset.numFormat && !curCell.dataset.numFormat) {
                        curCell.dataset.numFormat = prevCell.dataset.numFormat;
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
                tblFilter.maxRow = tbl.hasTotalRow ? tbl.maxRow - 1 : tbl.maxRow;
            }
            applyStructuredTableVisuals(tbl);
            break;
        }
    }

    // 構造化参照（例: テーブル1[売上]）を通常のセル範囲（例: C2:C10）へ解決
    function resolveStructuredReferences(formulaExpr, sheetIdx = activeSheetIndex) {
        if (!formulaExpr || !formulaExpr.includes("[")) return formulaExpr;
        return formulaExpr.replace(/([A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+)\[([^\[\]]+)\]/g, (match, tblName, colName) => {
            const cleanCol = colName.trim();
            for (let sIdx = 0; sIdx < sheets.length; sIdx++) {
                const tables = getSheetTables(sIdx);
                const tbl = tables.find(t => t.name === tblName);
                if (!tbl || !tbl.hasHeader) continue;

                const dataStartR = tbl.minRow + 1;
                const dataEndR = tbl.hasTotalRow ? tbl.maxRow - 1 : tbl.maxRow;
                if (dataEndR < dataStartR) return "#REF!";

                let matchedCol = -1;
                for (let c = tbl.minCol; c <= tbl.maxCol; c++) {
                    const headerText = sIdx === activeSheetIndex
                        ? (getVisibleCell(tbl.minRow, c)?.textContent ?? "").trim()
                        : String(getBackgroundSheetCellMap(sheets[sIdx]).get(`${tbl.minRow},${c}`)?.v ?? "").trim();
                    if (headerText === cleanCol) {
                        matchedCol = c;
                        break;
                    }
                }
                if (matchedCol === -1) return "#REF!";

                const colLetter = getColumnName(matchedCol);
                const rangeStr = `${colLetter}${dataStartR}:${colLetter}${dataEndR}`;
                if (sIdx !== sheetIdx) {
                    const sName = sheets[sIdx].name;
                    const prefix = /[^A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]/.test(sName)
                        ? `'${sName.replace(/'/g, "''")}'!`
                        : `${sName}!`;
                    return `${prefix}${rangeStr}`;
                }
                return rangeStr;
            }
            return match;
        });
    }


    // =========================================================
    // ピボットテーブル（Pivot Table）クロス集計エンジン
    // =========================================================
    function openPivotTableDialog() {
        flushPendingEdits();
        const bounds = detectDataBlockBounds(activeCell);
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
        const rangeText = `'${sheets[activeSheetIndex].name}'!${getCellReferenceByCoord(bounds.minRow, bounds.minCol)}:${getCellReferenceByCoord(bounds.maxRow, bounds.maxCol)}`;
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
                            sourceSheetIndex: activeSheetIndex,
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
            await addNewSheet(activeSheetIndex);
            const pvNum = sheets.filter(s => s.name.startsWith("ピボット")).length + 1;
            sheets[activeSheetIndex].name = `ピボット${pvNum}`;
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
        if (neededR >= rowCount) loadRowsSync(neededR - rowCount + 5);
        if (neededC >= currentColumns) loadColumnsSync(neededC - currentColumns + 3);

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
    // Excel 365準拠 オートフィルター機能（複数テーブル／複数範囲対応）
    // =========================================================
    let autoFilterStates = []; // Array<{ id, tableId, headerRow, minCol, maxCol, maxRow, filters: Map<col, Set<string>> }>
    let activeFilterDropdownEl = null;

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
        const target = cell || activeCell || tbody.querySelector("td.selected");
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
                arrow.classList.toggle("filtered", af.filters.has(c));
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

    function addAutoFilterForRange({ headerRow, minCol, maxCol, maxRow, tableId = null, filters = null }) {
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
            filters: filters instanceof Map ? filters : new Map()
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

    function applyAutoFilterRows() {
        const totalRows = tbody.rows.length;
        if (!autoFilterStates.length) {
            for (let i = 0; i < totalRows; i++) {
                const tr = tbody.rows[i];
                delete tr.dataset.filterHidden;
                tr.style.display = tr.dataset.userHidden === "1" ? "none" : "";
            }
            syncFilterButtonState();
            refreshVisibleRows();
            syncCopyAntsBoxPosition();
            updateAllFormulas();
            return;
        }

        const hiddenRows = new Set();
        for (const af of autoFilterStates) {
            if (!af.filters || af.filters.size === 0) continue;
            const startR = af.headerRow + 1;
            const endR = Math.min(af.maxRow, totalRows);
            for (let r = startR; r <= endR; r++) {
                if (hiddenRows.has(r)) continue;
                for (const [colIdx, allowedSet] of af.filters.entries()) {
                    const cell = getVisibleCell(r, colIdx);
                    const val = (cell?.textContent ?? "").trim();
                    if (!allowedSet.has(val)) {
                        hiddenRows.add(r);
                        break;
                    }
                }
            }
        }

        for (let r = 1; r <= totalRows; r++) {
            const tr = getRow(r);
            if (!tr) continue;
            if (hiddenRows.has(r)) {
                tr.dataset.filterHidden = "1";
                tr.style.display = "none";
            } else {
                delete tr.dataset.filterHidden;
                tr.style.display = tr.dataset.userHidden === "1" ? "none" : "";
            }
        }

        tbody.querySelectorAll(".ss-filter-arrow").forEach(arrow => {
            const af = getAutoFilterById(arrow.dataset.filterId);
            const c = Number(arrow.dataset.filterCol);
            arrow.classList.toggle("filtered", Boolean(af && af.filters.has(c)));
        });
        syncFilterButtonState();
        refreshVisibleRows();
        syncCopyAntsBoxPosition();
        updateAllFormulas();
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
        const { headerRow, maxRow, filters } = af;

        const uniqueValues = new Set();
        for (let r = headerRow + 1; r <= maxRow; r++) {
            const cell = getVisibleCell(r, colIdx);
            uniqueValues.add((cell?.textContent ?? "").trim());
        }
        const sortedVals = Array.from(uniqueValues).sort((a, b) => a.localeCompare(b, "ja", { numeric: true }));
        const currentAllowed = filters.get(colIdx) || new Set(sortedVals);

        const escHtml = (s) => String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");

        const rect = anchorEl.getBoundingClientRect();
        const dropdown = document.createElement("div");
        dropdown.className = "ss-filter-dropdown";
        dropdown.dataset.filterId = filterId;
        dropdown.dataset.filterCol = String(colIdx);
        dropdown.style.left = `${Math.min(window.innerWidth - 230, Math.max(8, rect.left - 180))}px`;
        dropdown.style.top = `${Math.min(window.innerHeight - 280, rect.bottom + 2)}px`;

        dropdown.innerHTML = `
            <div style="display:flex; gap:4px;">
                <button type="button" class="ss-flt-sort-asc" style="flex:1; font-size:11px; padding:2px;">A↓Z 昇順</button>
                <button type="button" class="ss-flt-sort-desc" style="flex:1; font-size:11px; padding:2px;">Z↓A 降順</button>
            </div>
            <input type="text" class="ss-flt-search border" placeholder="検索..." style="width:100%; height:22px; padding:2px 4px; font-size:11px; background:#fff; color:#000;">
            <label style="display:flex; align-items:center; gap:4px; font-weight:bold; cursor:pointer;">
                <input type="checkbox" class="ss-flt-all" ${currentAllowed.size === sortedVals.length ? "checked" : ""}> (すべて選択)
            </label>
            <div class="ss-filter-values-list">
                ${sortedVals.map(v => `
                    <label class="ss-flt-item" data-val="${escHtml(v)}" style="display:flex; align-items:center; gap:4px; cursor:pointer; white-space:nowrap;">
                        <input type="checkbox" value="${escHtml(v)}" ${currentAllowed.has(v) ? "checked" : ""}>
                        <span>${v === "" ? "(空白セル)" : escHtml(v)}</span>
                    </label>
                `).join("")}
            </div>
            <div style="display:flex; justify-content:flex-end; gap:4px;">
                <button type="button" class="ss-flt-ok" style="padding:2px 10px; font-size:11px;">OK</button>
                <button type="button" class="ss-flt-cancel" style="padding:2px 8px; font-size:11px;">キャンセル</button>
            </div>
        `;
        document.body.appendChild(dropdown);
        activeFilterDropdownEl = dropdown;

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

        dropdown.querySelector(".ss-flt-ok").addEventListener("click", () => {
            const checkedVals = new Set(itemChks.filter(c => c.checked).map(c => c.value));
            if (checkedVals.size === sortedVals.length) {
                filters.delete(colIdx);
            } else {
                filters.set(colIdx, checkedVals);
            }
            applyAutoFilterRows();
            closeFilterDropdown();
            setDirtyState(true);
            debouncedSaveState();
        });

        dropdown.querySelector(".ss-flt-cancel").addEventListener("click", closeFilterDropdown);
        searchInp.focus();
    }

    function clearAllAutoFilters() {
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
        updateAllFormulas();
    }

    function toggleAutoFilter() {
        const bounds = getSelectedRangeBounds();
        if (!bounds) return;

        // 選択中のセルが既存のフィルター範囲内（テーブルの集計行含む）にある場合は、そのフィルターだけを解除する
        const activeFilter = findActiveAutoFilterForCell(activeCell) || getAutoFilterAtCoord(bounds.minRow, bounds.minCol);
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
        if (minRow === maxRow && minCol === maxCol) {
            if (!isFilled(minRow, minCol)) {
                showAlert("フィルターを設定するデータ範囲を選択してください。", "オートフィルター");
                return;
            }
            while (minRow > 1 && isFilled(minRow - 1, minCol)) minRow--;
            while (maxRow < rowCount - 1 && isFilled(maxRow + 1, minCol)) maxRow++;
            while (minCol > 0 && isFilled(minRow, minCol - 1)) minCol--;
            while (maxCol < currentColumns - 1 && isFilled(minRow, maxCol + 1)) maxCol++;
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
        if (!e.target.closest(".ss-cell-dropdown-list, .ss-cell-dropdown-btn")) {
            closeCellDropdownList();
        }
    }, { signal });

    function openFindReplaceDialog(focusReplace = false) {
        flushPendingEdits();
        if (!windowAPI?.showModalWindow) return;

        if (!findWin || !findWin.isConnected) {
            const bodyHtml = `
                <div class="ss-find-win-body" style="width:100%; display:flex; flex-direction:column; gap:7px; font-size:12px; color:#000; user-select:none;">
                    <div style="display:flex; align-items:center; gap:6px;">
                        <label style="width:82px; flex-shrink:0;">検索文字列:</label>
                        <input type="text" class="ss-find-input border" autocomplete="off" style="flex:1; min-width:0; height:24px; padding:2px 5px; font-size:12px; background:#fff; color:#000;" />
                    </div>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <label style="width:82px; flex-shrink:0;">置換後の文字:</label>
                        <input type="text" class="ss-replace-input border" autocomplete="off" style="flex:1; min-width:0; height:24px; padding:2px 5px; font-size:12px; background:#fff; color:#000;" />
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px 8px; padding:2px 0;">
                        <label style="display:inline-flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" class="ss-opt-case"> 大文字/小文字を区別</label>
                        <label style="display:inline-flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" class="ss-opt-whole"> セル内容が完全一致</label>
                        <label style="display:inline-flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" class="ss-opt-formula"> 数式内も対象</label>
                        <label style="display:inline-flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" class="ss-opt-selection"> 選択範囲内のみ</label>
                    </div>
                    <div style="display:flex; flex-wrap:wrap; gap:4px; justify-content:flex-end; margin-top:2px;">
                        <button type="button" class="ss-btn-find-prev" style="padding:3px 8px; font-size:12px;">前を検索</button>
                        <button type="button" class="ss-btn-find-next" style="padding:3px 8px; font-size:12px;">次を検索</button>
                        <button type="button" class="ss-btn-replace" style="padding:3px 8px; font-size:12px;">置換</button>
                        <button type="button" class="ss-btn-replace-all" style="padding:3px 8px; font-size:12px;">すべて置換</button>
                    </div>
                    <div class="ss-find-status" style="min-height:16px; font-size:11px; color:#222; padding-top:4px; border-top:1px solid #808080;">検索する文字列を入力してください。</div>
                </div>
            `;

            // parentWin: null を明示して背面シートのクリック操作を維持しつつ window.js の窓として生成
            const modalContent = openAppModal("検索と置換", bodyHtml, {
                parentWin: null,
                width: 370,
                isHtml: true,
                allowDuplicate: true,
                disableMinimize: true,
                disableMaximize: true,
                buttons: [],
                onClose: () => {
                    findDialogOpen = false;
                    findWin = null;
                    restoreMainWindowFocus();
                }
            });

            findWin = modalContent.closest(".window");
            if (findWin) {
                findWin.dataset.ssToolWindow = "true";
                const btnContainer = findWin.querySelector(".button-container");
                if (btnContainer) btnContainer.style.display = "none";
                const msgWrapper = modalContent.firstElementChild;
                if (msgWrapper) msgWrapper.style.padding = "10px 12px";

                if (win) {
                    const winRect = win.getBoundingClientRect();
                    findWin.style.left = `${Math.max(12, winRect.left + (winRect.width - 370) / 2)}px`;
                    findWin.style.top = `${Math.max(12, winRect.top + (winRect.height - 220) / 2)}px`;
                } else {
                    findWin.style.left = `${Math.max(12, (window.innerWidth - 370) / 2)}px`;
                    findWin.style.top = `${Math.max(12, (window.innerHeight - 220) / 2)}px`;
                }
            }

            const findInput = modalContent.querySelector(".ss-find-input");
            const replaceInput = modalContent.querySelector(".ss-replace-input");
            const optCase = modalContent.querySelector(".ss-opt-case");
            const optWhole = modalContent.querySelector(".ss-opt-whole");
            const optFormula = modalContent.querySelector(".ss-opt-formula");
            const optSelection = modalContent.querySelector(".ss-opt-selection");
            const statusEl = modalContent.querySelector(".ss-find-status");

            const closeDialog = () => {
                findDialogOpen = false;
                if (findWin) {
                    findWin.style.visibility = "hidden";
                }
                restoreMainWindowFocus();
            };
            if (findWin) findWin._closeDialog = closeDialog;

            // タイトルバーの × ボタンは非表示にして次回 Ctrl+F / Ctrl+H で即再表示できるようにする
            const winCloseBtn = findWin?.querySelector(".close-btn");
            if (winCloseBtn) {
                winCloseBtn.addEventListener("click", (e) => {
                    e.stopImmediatePropagation();
                    closeDialog();
                }, { capture: true, signal });
            }

            const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

            const getOptions = () => ({
                query: findInput.value,
                replacement: replaceInput.value,
                matchCase: optCase.checked,
                wholeCell: optWhole.checked,
                searchFormula: optFormula.checked,
                inSelection: optSelection.checked
            });

            const getSearchCells = (inSelection) => {
                if (inSelection) {
                    const sel = Array.from(tbody.querySelectorAll("td.selected")).filter(td => td.style.display !== "none");
                    if (sel.length > 1) {
                        return sel.sort((a, b) => (+a.dataset.row - +b.dataset.row) || (+a.dataset.col - +b.dataset.col));
                    }
                }
                return Array.from(tbody.querySelectorAll("td")).filter(td => td.style.display !== "none");
            };

            const isCellMatched = (cell, opts) => {
                if (!cell || opts.query === "") return false;
                const source = (opts.searchFormula && cell.dataset.formula)
                    ? cell.dataset.formula
                    : cell.textContent;
                const target = opts.matchCase ? source : source.toLowerCase();
                const needle = opts.matchCase ? opts.query : opts.query.toLowerCase();
                return opts.wholeCell ? target === needle : target.includes(needle);
            };

            const applyReplacementToCell = (cell, opts) => {
                if (!isCellMatched(cell, opts)) return false;
                if (cell.dataset.formula && !opts.searchFormula) return false;

                const flags = opts.matchCase ? "g" : "gi";
                const regex = new RegExp(escapeRegExp(opts.query), flags);

                if (cell.dataset.formula && opts.searchFormula) {
                    const nextFormula = opts.wholeCell
                        ? opts.replacement
                        : cell.dataset.formula.replace(regex, () => opts.replacement);
                    if (nextFormula.trim().startsWith("=")) {
                        cell.dataset.formula = nextFormula.trim();
                        setCellFormattedValue(cell, evaluateFormula(cell.dataset.formula));
                    } else {
                        delete cell.dataset.formula;
                        setCellFormattedValue(cell, nextFormula);
                    }
                    return true;
                }

                const raw = cell.dataset.rawValue ?? cell.textContent;
                const nextVal = opts.wholeCell
                    ? opts.replacement
                    : raw.replace(regex, () => opts.replacement);
                setCellFormattedValue(cell, nextVal);
                return true;
            };

            const findNext = (step = 1) => {
                const opts = getOptions();
                if (!opts.query) {
                    statusEl.textContent = "検索する文字列を入力してください。";
                    return false;
                }
                const cells = getSearchCells(opts.inSelection);
                const matchedCells = cells.filter(c => isCellMatched(c, opts));
                if (!matchedCells.length) {
                    statusEl.textContent = "一致するセルが見つかりません。";
                    return false;
                }

                let startIdx = activeCell ? cells.indexOf(activeCell) : -1;
                let found = null;
                for (let i = 1; i <= cells.length; i++) {
                    const idx = (startIdx + step * i + cells.length * 2) % cells.length;
                    if (isCellMatched(cells[idx], opts)) {
                        found = cells[idx];
                        break;
                    }
                }
                if (!found) found = matchedCells[0];

                if (!opts.inSelection) {
                    clearSelection();
                }
                setActiveCell(found, false);
                updateSelectedCellsDisplay();
                updateFillHandle();
                found.scrollIntoView({ block: "nearest", inline: "nearest" });

                const matchIndex = matchedCells.indexOf(found) + 1;
                statusEl.textContent = `一致: ${getCellReference(found)} (${matchIndex} / ${matchedCells.length} 件)`;
                return true;
            };

            const replaceCurrent = () => {
                const opts = getOptions();
                if (!opts.query) {
                    statusEl.textContent = "検索する文字列を入力してください。";
                    return;
                }
                if (activeCell && applyReplacementToCell(activeCell, opts)) {
                    setActiveCell(activeCell, false);
                    updateAllFormulas();
                    updateFillHandle();
                    updateSelectedCellsDisplay();
                    setDirtyState(true);
                    debouncedSaveState();
                    if (!findNext(1)) {
                        statusEl.textContent = "置換しました（他の一致はありません）。";
                    }
                } else {
                    findNext(1);
                }
            };

            const replaceAll = () => {
                const opts = getOptions();
                if (!opts.query) {
                    statusEl.textContent = "検索する文字列を入力してください。";
                    return;
                }
                const cells = getSearchCells(opts.inSelection);
                let count = 0;
                for (const cell of cells) {
                    if (applyReplacementToCell(cell, opts)) {
                        count++;
                    }
                }
                if (count > 0) {
                    updateAllFormulas();
                    updateFillHandle();
                    updateSelectedCellsDisplay();
                    setDirtyState(true);
                    debouncedSaveState();
                    statusEl.textContent = `${count} 件を置換しました。`;
                } else {
                    statusEl.textContent = "置換対象が見つかりませんでした。";
                }
            };

            modalContent.querySelector(".ss-btn-find-prev").addEventListener("click", () => findNext(-1), { signal });
            modalContent.querySelector(".ss-btn-find-next").addEventListener("click", () => findNext(1), { signal });
            modalContent.querySelector(".ss-btn-replace").addEventListener("click", replaceCurrent, { signal });
            modalContent.querySelector(".ss-btn-replace-all").addEventListener("click", replaceAll, { signal });

            findInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    findNext(e.shiftKey ? -1 : 1);
                } else if (e.key === "Escape") {
                    e.preventDefault();
                    closeDialog();
                }
            }, { signal });

            replaceInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    replaceCurrent();
                } else if (e.key === "Escape") {
                    e.preventDefault();
                    closeDialog();
                }
            }, { signal });

            findWin?.addEventListener("keydown", (e) => {
                if (e.key === "Escape") {
                    e.preventDefault();
                    closeDialog();
                }
            }, { signal });
        }

        findDialogOpen = true;
        if (findWin) {
            findWin.style.visibility = "visible";
            windowAPI.bringToFront(findWin);
            const findInput = findWin.querySelector(".ss-find-input");
            const replaceInput = findWin.querySelector(".ss-replace-input");
            const optSelection = findWin.querySelector(".ss-opt-selection");

            const selectedCount = tbody.querySelectorAll("td.selected").length;
            if (optSelection) optSelection.checked = selectedCount > 1;

            if (findInput && !findInput.value && activeCell && activeCell.textContent.trim() !== "") {
                findInput.value = activeCell.textContent.trim();
            }

            if (focusReplace && replaceInput) {
                replaceInput.focus();
                replaceInput.select();
            } else if (findInput) {
                findInput.focus();
                findInput.select();
            }
        }
    }

    async function handleAppAction(action) {
        switch (action) {
            case "new":
                if (lockedFilePath) {
                    unlockFile(lockedFilePath, lockOwnerPid);
                    lockedFilePath = null;
                }
                currentFilePath = null;
                clearSheetToBlank();
                savedSnapshotJSON = undoHistory[undoHistory.length - 1] || null;
                setDirtyState(false);
                statusBarState.stateText = "新規シート";
                break;
            case "open":
                promptOpenFileDialog();
                break;
            case "save":
                if (currentFilePath) await writeToFSPath(currentFilePath);
                else promptSaveAsDialog(".nxs");
                break;
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
                undo();
                break;
            case "redo":
                redo();
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
            case "format-painter": {
                const btn = appRoot.querySelector(".ss-format-painter-btn");
                if (formatPainterSnapshot) {
                    formatPainterSnapshot = null;
                    btn?.classList.remove("selected");
                    statusBarState.stateText = "準備完了";
                } else if (activeCell) {
                    formatPainterSnapshot = {
                        styleObj: extractCellStyleObject(activeCell),
                        numFormat: activeCell.dataset.numFormat || "",
                        decimalPlaces: activeCell.dataset.decimalPlaces || ""
                    };
                    btn?.classList.add("selected");
                    statusBarState.stateText = "書式コピー待機中（貼り付け先セルを選択）";
                }
                renderWindowStatusBar();
                break;
            }
            case "clear-cells":
                clearTargetCellsContent();
                break;
            case "clear-formats":
                getTargetCells().forEach(c => {
                    clearAppliedConditionalStyle(c);
                    c.removeAttribute("style");
                    delete c.dataset.numFormat;
                    delete c.dataset.decimalPlaces;
                    delete c.dataset.richRuns;
                    const raw = c.dataset.formula ? evaluateFormula(c.dataset.formula) : (c.dataset.rawValue ?? c.textContent);
                    setCellFormattedValue(c, raw);
                });
                applyConditionalFormats();
                scheduleTextOverflowUpdate();
                updateToolbarState();
                setDirtyState(true);
                debouncedSaveState();
                break;
            case "clear-all": {
                const clearBounds = getSelectedRangeBounds();
                getTargetCells().forEach(c => {
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
                    c.classList.remove("ss-hyperlink");
                    c.removeAttribute("title");
                });
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
                    if (autoFilterStates.length > 0) {
                        const prevLen = autoFilterStates.length;
                        autoFilterStates = autoFilterStates.filter(af => !(
                            af.headerRow >= clearBounds.minRow &&
                            af.headerRow <= clearBounds.maxRow &&
                            af.maxCol >= clearBounds.minCol &&
                            af.minCol <= clearBounds.maxCol
                        ));
                        if (autoFilterStates.length !== prevLen) {
                            closeFilterDropdown();
                            renderAutoFilterArrows();
                            applyAutoFilterRows();
                        }
                    }
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
                                    const raw = c.dataset.formula ? evaluateFormula(c.dataset.formula) : (c.dataset.rawValue ?? c.textContent);
                                    setCellFormattedValue(c, raw);
                                });
                                updateTextOverflowDisplay();
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
            case "toggle-print-orientation": {
                printOrientation = printOrientation === "portrait" ? "landscape" : "portrait";
                const btn = appRoot.querySelector(".ss-print-orient-btn");
                const lbl = btn?.querySelector(".ss-btn-lbl") || btn;
                if (lbl) lbl.textContent = `向き: ${printOrientation === "landscape" ? "横" : "縦"}`;
                updatePageStyleRule();
                setDirtyState(true);
                debouncedSaveState();
                break;
            }
            case "toggle-print-fit": {
                printFitToWidth = !printFitToWidth;
                appRoot.querySelector(".ss-print-fit-btn")?.classList.toggle("selected", printFitToWidth);
                break;
            }
            case "toggle-print-grid": {
                printShowGridlines = !printShowGridlines;
                appRoot.querySelector(".ss-print-grid-btn")?.classList.toggle("selected", printShowGridlines);
                break;
            }
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
            case "data-validation":
                openDataValidationDialog();
                break;
            case "find-replace":
                openFindReplaceDialog(false);
                break;
            case "remove-duplicates":
                openRemoveDuplicatesDialog();
                break;
            case "text-to-columns":
                openTextToColumnsDialog();
                break;
            case "auto-format":
                openAutoFormatDialog();
                break;
            case "create-table":
                convertRangeToStructuredTable("blue");
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
                targets.forEach(cell => commitCellValue(cell, formulaBarInput.value));
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
                if (fmt === "general") {
                    delete c.dataset.numFormat;
                    delete c.dataset.decimalPlaces;
                } else {
                    c.dataset.numFormat = fmt;
                }
                const raw = c.dataset.formula ? evaluateFormula(c.dataset.formula) : (c.dataset.rawValue ?? c.textContent);
                setCellFormattedValue(c, raw);
            });
            updateTextOverflowDisplay();
            updateToolbarState();
            setDirtyState(true);
            debouncedSaveState();
            return;
        }

        const decStepBtn = e.target.closest("[data-decimal-step]");
        if (decStepBtn) {
            const step = Number(decStepBtn.dataset.decimalStep);
            getTargetCells().forEach(c => {
                const raw = c.dataset.formula ? evaluateFormula(c.dataset.formula) : (c.dataset.rawValue ?? c.textContent);
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
            appRoot.querySelectorAll("[data-align]").forEach(b => b.classList.remove("selected"));
            alignBtn.classList.add("selected");
            const align = alignBtn.dataset.align;
            const targets = tbody.querySelectorAll("td.selected");
            (targets.length ? targets : (activeCell ? [activeCell] : [])).forEach(c => {
                c.style.textAlign = align;
                if (c.tagName === "TD") {
                    const displayText = formatDisplayByNumFmt(
                        c.dataset.rawValue ?? c.textContent,
                        c.dataset.numFormat,
                        c
                    );
                    setCellTextPreservingControls(c, displayText);
                }
            });
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
            const selected = tbody.querySelectorAll("td.selected");
            if (selected.length) {
                let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
                selected.forEach(c => {
                    const r0 = +c.dataset.row;
                    const c0 = +c.dataset.col;
                    const r1 = r0 + (+c.getAttribute("rowspan") || 1) - 1;
                    const c1 = c0 + (+c.getAttribute("colspan") || 1) - 1;
                    minR = Math.min(minR, r0);
                    maxR = Math.max(maxR, r1);
                    minC = Math.min(minC, c0);
                    maxC = Math.max(maxC, c1);
                });
                selected.forEach(c => {
                    const r0 = +c.dataset.row;
                    const c0 = +c.dataset.col;
                    const r1 = r0 + (+c.getAttribute("rowspan") || 1) - 1;
                    const c1 = c0 + (+c.getAttribute("colspan") || 1) - 1;
                    if (type === "top" && r0 === minR) c.style.borderTop = borderCss;
                    if (type === "bottom" && r1 === maxR) c.style.borderBottom = borderCss;
                    if (type === "bottom-double" && r1 === maxR) c.style.borderBottom = `4px double ${bColor}`;
                    if (type === "left" && c0 === minC) c.style.borderLeft = borderCss;
                    if (type === "right" && c1 === maxC) c.style.borderRight = borderCss;
                    if (type === "outer" || type === "outer-bold") {
                        const outerCss = type === "outer-bold" ? `4px solid ${bColor}` : borderCss;
                        if (r0 === minR) c.style.borderTop = outerCss;
                        if (r1 === maxR) c.style.borderBottom = outerCss;
                        if (c0 === minC) c.style.borderLeft = outerCss;
                        if (c1 === maxC) c.style.borderRight = outerCss;
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
                        if (r0 === minR && r0 > 1) {
                            const above = getVisibleCell(r0 - 1, c0);
                            if (above) above.style.borderBottom = "";
                        }
                        if (r1 === maxR) {
                            const below = getVisibleCell(r1 + 1, c0);
                            if (below) below.style.borderTop = "";
                        }
                        if (c0 === minC && c0 > 0) {
                            const left = getVisibleCell(r0, c0 - 1);
                            if (left) left.style.borderRight = "";
                        }
                        if (c1 === maxC) {
                            const right = getVisibleCell(r0, c1 + 1);
                            if (right) right.style.borderLeft = "";
                        }
                    }
                });
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

    appRoot.querySelector(".ss-font-family")?.addEventListener("change", (e) => {
        getTargetCells().forEach(c => {
            c.style.fontFamily = e.target.value;
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
        getTargetCells().forEach(c => {
            if (c.style.whiteSpace === "pre-wrap") {
                c.style.whiteSpace = "";
                c.style.wordBreak = "";
            } else {
                c.style.whiteSpace = "pre-wrap";
                c.style.wordBreak = "break-all";
            }
        });
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
        getTargetCells().forEach(c => {
            c.style.backgroundColor = colorVal;
            if (c.dataset.cfApplied) c.dataset.cfOrigBg = colorVal;
        });
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
    let isRowSelecting = false, rowSelectionStart = null;
    let isColSelecting = false, colSelectionStart = null;
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

        // 複製モードでなければ移動元をクリア（結合も解除）
        if (!copyMode) {
            for (let r = srcBounds.minRow; r <= srcBounds.maxRow; r++) {
                for (let c = srcBounds.minCol; c <= srcBounds.maxCol; c++) {
                    const srcCell = getCell(r, c);
                    if (!srcCell) continue;
                    srcCell.textContent = "";
                    srcCell.removeAttribute("style");
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
                            sub.textContent = "";
                            sub.removeAttribute("style");
                            sub.style.display = "none";
                            sub.className = "";
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
        if (autoFilterStates.length) applyAutoFilterRows();
        refreshVisibleFloatingObjects();
        updateSelectedCellsDisplay();
        updateFillHandle();
        setDirtyState(true);
        debouncedSaveState();
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
        if (autoFilterStates.length > 0) {
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
            });

            if (filterMoved) {
                renderAutoFilterArrows();
                applyAutoFilterRows();
            }
        }

        // 3. 条件付き書式ルールの適用範囲・内部数式を移動先へ追従（部分移動・$絶対参照も対応）
        shiftConditionalFormatsForMoveOrCopy(srcBounds, rowDelta, colDelta, { copyMode: false });
    }

    function adjustFormulaRefsInMovedRange(formula, srcBounds, rowDelta, colDelta) {
        if (!formula || formula[0] !== "=" || (rowDelta === 0 && colDelta === 0)) return formula;
        const activeSheetName = sheets[activeSheetIndex]?.name || "";
        const stringLiterals = [];
        const masked = formula.substring(1).replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'(?!\s*!)/g, (m) => {
            const token = `__CF_MOV_${stringLiterals.length}__`;
            stringLiterals.push(m);
            return token;
        });

        const tokenRegex = /((?:'[^']+'|[A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+)!)?(?<![A-Za-z0-9_$])(\$?)([A-Za-z]+)(\$?)(\d+)(?::(\$?)([A-Za-z]+)(\$?)(\d+))?(?!\s*!)/g;
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
        const cfRules = sheets[activeSheetIndex]?.conditionalFormats;
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
            sheets[activeSheetIndex].conditionalFormats = nextRules;
            applyConditionalFormats();
        }
    }

    function isCoordInBounds(row, col, bounds) {
        return row >= bounds.minRow && row <= bounds.maxRow &&
            col >= bounds.minCol && col <= bounds.maxCol;
    }

    function isRangeWithinBounds(r1, c1, r2, c2, bounds) {
        const minR = Math.min(r1, r2), maxR = Math.max(r1, r2);
        const minC = Math.min(c1, c2), maxC = Math.max(c1, c2);
        return minR >= bounds.minRow && maxR <= bounds.maxRow &&
            minC >= bounds.minCol && maxC <= bounds.maxCol;
    }

    // 移動したセル「自身」の数式調整（相対参照のみ移動量追従、$付き絶対参照と外部参照は完全固定）
    function adjustMovedFormulaSelf(formula, srcBounds, rowDelta, colDelta) {
        if (!formula || formula[0] !== "=") return formula;
        const activeSheetName = sheets[activeSheetIndex]?.name || "";
        const stringLiterals = [];
        const masked = formula.substring(1).replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'(?!\s*!)/g, (m) => {
            const token = `__MOV_SELF_${stringLiterals.length}__`;
            stringLiterals.push(m);
            return token;
        });

        const tokenRegex = /((?:'[^']+'|[A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+)!)?(?<![A-Za-z0-9_$])(\$?)([A-Za-z]+)(\$?)(\d+)(?::(\$?)([A-Za-z]+)(\$?)(\d+))?(?!\s*!)/g;
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
                    const nc1 = aC1 ? c1 : Math.max(0, c1 + colDelta);
                    const nr1 = aR1 ? r1 : Math.max(1, r1 + rowDelta);
                    const nc2 = aC2 ? c2 : Math.max(0, c2 + colDelta);
                    const nr2 = aR2 ? r2 : Math.max(1, r2 + rowDelta);
                    return `${prefix}${aC1}${getColumnName(nc1)}${aR1}${nr1}:${aC2}${getColumnName(nc2)}${aR2}${nr2}`;
                }
                return match;
            } else {
                if (isCoordInBounds(r1, c1, srcBounds)) {
                    const nc1 = aC1 ? c1 : Math.max(0, c1 + colDelta);
                    const nr1 = aR1 ? r1 : Math.max(1, r1 + rowDelta);
                    return `${prefix}${aC1}${getColumnName(nc1)}${aR1}${nr1}`;
                }
                return match;
            }
        });

        return "=" + replaced.replace(/__MOV_SELF_(\d+)__/g, (_, idx) => stringLiterals[Number(idx)]);
    }

    // 移動していない「他セル（他シート含む）」の数式参照を移動先へ追従（$付き絶対参照は固定維持）
    function redirectFormulasForMovedRange(srcBounds, rowDelta, colDelta, destBounds) {
        if (rowDelta === 0 && colDelta === 0) return;

        const activeSheetName = sheets[activeSheetIndex]?.name || "";
        const shiftRefTokens = (expr, allowSheetPrefix = false) => {
            const tokenRegex = /((?:'[^']+'|[A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+)!)?(?<![A-Za-z0-9_$])(\$?)([A-Za-z]+)(\$?)(\d+)(?::(\$?)([A-Za-z]+)(\$?)(\d+))?/g;
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
                        const nc1 = aC1 ? c1 : Math.max(0, c1 + colDelta);
                        const nr1 = aR1 ? r1 : Math.max(1, r1 + rowDelta);
                        const nc2 = aC2 ? c2 : Math.max(0, c2 + colDelta);
                        const nr2 = aR2 ? r2 : Math.max(1, r2 + rowDelta);
                        return `${prefix}${aC1}${getColumnName(nc1)}${aR1}${nr1}:${aC2}${getColumnName(nc2)}${aR2}${nr2}`;
                    }
                    return match;
                } else {
                    if (isCoordInBounds(r1, c1, srcBounds)) {
                        const nc1 = aC1 ? c1 : Math.max(0, c1 + colDelta);
                        const nr1 = aR1 ? r1 : Math.max(1, r1 + rowDelta);
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
        const activeCfRules = sheets[activeSheetIndex]?.conditionalFormats;
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
                if (idx === activeSheetIndex) return;
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

        if ((e.ctrlKey || e.metaKey) && !isInFormulaEdit() && extractHyperlinkTarget(cell)) {
            e.preventDefault();
            void activateCellHyperlink(cell);
            return;
        }

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

        if (!isScrollingNow && !isSelecting && !isRowSelecting && !isColSelecting && !isFillDragging) {
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
                    selectionEnd = {
                        row: parseInt(cell.dataset.row, 10),
                        col: parseInt(cell.dataset.col, 10)
                    };
                    updateSelection();
                }
            }
        } else if (isRowSelecting) {
            const th = e.target.closest("th.row_number");
            if (th) {
                const cur = parseInt(th.textContent.trim(), 10);
                clearSelection();
                const rMin = Math.min(rowSelectionStart, cur);
                const rMax = Math.max(rowSelectionStart, cur);
                for (let r = rMin; r <= rMax; r++) {
                    const tr = tbody.rows[r - 1];
                    if (!tr || tr.style.display === "none") continue;
                    for (let c = 1; c < tr.cells.length; c++) {
                        const td = tr.cells[c];
                        if (td.style.display !== "none" && !td.classList.contains("ss-col-hidden")) {
                            td.classList.add("selected");
                        }
                    }
                }
                updateSelectedCellsDisplay();
            }
        } else if (isColSelecting) {
            const th = e.target.closest("th.col_number");
            if (th) {
                const cur = columnLettersToIndex(th.textContent.trim());
                clearSelection();
                const cMin = Math.min(colSelectionStart, cur);
                const cMax = Math.max(colSelectionStart, cur);
                for (let r = 0; r < tbody.rows.length; r++) {
                    const tr = tbody.rows[r];
                    if (!tr || tr.style.display === "none") continue;
                    const cells = tr.cells;
                    for (let c = cMin; c <= cMax; c++) {
                        const td = cells[c + 1];
                        if (td && td.style.display !== "none" && !td.classList.contains("ss-col-hidden")) {
                            td.classList.add("selected");
                        }
                    }
                }
                updateSelectedCellsDisplay();
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
            if (formatPainterSnapshot && !isInFormulaEdit()) {
                const targets = Array.from(tbody.querySelectorAll("td.selected"));
                targets.forEach(td => {
                    applyCellStyleData(td, formatPainterSnapshot.styleObj);
                    if (formatPainterSnapshot.numFormat) td.dataset.numFormat = formatPainterSnapshot.numFormat;
                    else delete td.dataset.numFormat;
                    if (formatPainterSnapshot.decimalPlaces) td.dataset.decimalPlaces = formatPainterSnapshot.decimalPlaces;
                    else delete td.dataset.decimalPlaces;
                    const raw = td.dataset.formula ? evaluateFormula(td.dataset.formula) : (td.dataset.rawValue ?? td.textContent);
                    setCellFormattedValue(td, raw);
                });
                formatPainterSnapshot = null;
                appRoot.querySelector(".ss-format-painter-btn")?.classList.remove("selected");
                applyConditionalFormats();
                scheduleTextOverflowUpdate();
                updateToolbarState();
                statusBarState.stateText = "書式を適用しました";
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
        if (formatPainterSnapshot && !e.target.closest(".ss-format-painter-btn")) {
            formatPainterSnapshot = null;
            appRoot.querySelector(".ss-format-painter-btn")?.classList.remove("selected");
            statusBarState.stateText = "準備完了";
            renderWindowStatusBar();
        }
        isRowSelecting = false;
        isColSelecting = false;
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
        targets.forEach(cell => {
            if (cell === baseCell) {
                if (!commitCellValue(cell, trimmed)) allOk = false;
            } else if (trimmed.startsWith("=")) {
                const rOff = parseInt(cell.dataset.row, 10) - baseR;
                const cOff = parseInt(cell.dataset.col, 10) - baseC;
                if (!commitCellValue(cell, adjustFormula(trimmed, rOff, cOff))) allOk = false;
            } else {
                if (!commitCellValue(cell, trimmed)) allOk = false;
            }
        });
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
            enterCellEditMode(activeCell, false, "ime");
            cellEditor.value = "";
            formulaBarInput.value = "";
            syncCellEditorLayout(activeCell);
            setDirtyState(true);
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
        oa: () => openAutoFormatDialog()
    };

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
        if (e.target.closest(".floating-textbox, .ss-find-win-body, .ss-find-dialog")) return;
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
            enterCellEditMode(activeCell, false, "ime");
            cellEditor.value = "";
            formulaBarInput.value = "";
            syncCellEditorLayout(activeCell);
            setDirtyState(true);
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
            if (key === "s") {
                e.preventDefault();
                if (currentFilePath) void writeToFSPath(currentFilePath);
                else promptSaveAsDialog(".nxs");
                return;
            }
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

            if (e.shiftKey && key === "l") {
                e.preventDefault();
                toggleAutoFilter();
                return;
            }
            if (key === "t" && !e.shiftKey && document.activeElement !== formulaBarInput) {
                e.preventDefault();
                convertRangeToStructuredTable("blue");
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
                if (e.shiftKey && (e.code === "Digit1" || e.code === "Digit4" || e.code === "Digit5")) {
                    e.preventDefault();
                    const fmtMap = { Digit1: "comma", Digit4: "currency", Digit5: "percent" };
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

        // Alt + = : オートSUM
        if (e.altKey && e.key === "=") {
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

        // Escapeでコピーアニメ解除
        if (e.key === "Escape") {
            clearCopyAnimation();
            return;
        }

        // Enter処理（コピー中なら貼り付け、通常時は選択範囲内ループ／上下移動）
        if (e.key === "Enter" && activeCell) {
            e.preventDefault();
            if (clipboardData && isCopyAnimationActive()) {
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
                enterCellEditMode(activeCell, false, "backspace");
                cellEditor.value = "";
                formulaBarInput.value = "";
                syncCellEditorLayout(activeCell);
                setDirtyState(true);
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
            const pageRows = Math.max(1, Math.floor((container.clientHeight - 30) / 30));
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
            enterCellEditMode(activeCell, false, "type");
            cellEditor.value = e.key;
            cellEditor.setSelectionRange(1, 1);
            formulaBarInput.value = e.key;
            syncCellEditorLayout(activeCell);
            showAutocompletePopup(cellEditor, e.key, 1);
            if (e.key === "=") {
                highlightCalculationRange("=");
            }
            setDirtyState(true);
        }
    }, { signal });

    function clearTargetCellsContent() {
        const targets = getTargetCells();
        if (!targets.length) return;
        if (targets.some(c => isCellLockedForEdit(c))) {
            showAlert("保護されたシート上のロックされたセルはクリアできません。", "シートの保護");
            return;
        }
        targets.forEach(c => {
            if (c.dataset.spillOrigin) return; // Excel準拠：スピル先単体のDeleteは無視（元セル消去で消える）
            clearSpillCellsFromAnchor(parseInt(c.dataset.row, 10), parseInt(c.dataset.col, 10));
            delete c.dataset.formula;
            delete c.dataset.quotePrefix;
            delete c.dataset.valueType;
            delete c.dataset.dateValue;
            delete c.dataset.richRuns;
            setCellFormattedValue(c, "");
        });
        if (activeCell) {
            formulaBarInput.value = activeCell.dataset.formula || (activeCell.dataset.rawValue ?? activeCell.textContent);
        }
        updateAllFormulas();
        applyConditionalFormats();
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

    attachContextMenu(table, (e) => {
        if (e.target.closest(".floating-textbox")) return null;
        if (isCellEditing()) return null;

        // 1. 行ヘッダー右クリック（複数行選択を維持して一括操作）
        const rowHeader = e.target.closest("th.row_number");
        if (rowHeader) {
            const rowNum = parseInt(rowHeader.textContent.trim(), 10);
            const wholeRows = getSelectedWholeRows();
            const targetRows = wholeRows.includes(rowNum) && wholeRows.length > 0 ? wholeRows : [rowNum];
            if (!wholeRows.includes(rowNum)) {
                clearSelection();
                for (let c = 0; c < currentColumns; c++) {
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
                    label: freezeRows > 0 ? "行の固定を解除" : `${Math.max(1, minR - 1)}行目まで固定`,
                    action: () => setFreezePanes(freezeRows > 0 ? 0 : Math.max(1, minR - 1), freezeCols)
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
                for (let r = 1; r < rowCount; r++) {
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
            for (let c = Math.max(0, minC - 1); c <= Math.min(currentColumns - 1, maxC + 1); c++) unhideCols.push(c);

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
                    label: freezeCols > 0 ? "列の固定を解除" : `${getColumnName(Math.max(0, minC - 1))}列まで固定`,
                    action: () => setFreezePanes(freezeRows, freezeCols > 0 ? 0 : Math.max(1, minC))
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
        const boxes = spreadsheetContent.querySelectorAll(".floating-textbox");
        if (!boxes.length) return;

        if (isWindowMinimizedOrHidden()) {
            for (let i = 0; i < boxes.length; i++) {
                boxes[i].classList.remove("ss-obj-offscreen");
            }
            return;
        }

        const zoom = parseFloat(spreadsheetContent.style.zoom || "1") || 1;
        const headerH = 30;
        const rowHeaderW = parseInt(colgroup.children[0]?.style.width, 10) || 54;
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
    }

    // ウィンドウ最小化・復元とコンテンツエリアの表示・オーバーフロー隠蔽を連動
    let windowStateObserver = null;
    function syncWindowMinimizeState() {
        const minimized = isWindowMinimizedOrHidden();
        if (minimized) {
            if (findWin && findWin.isConnected) {
                findWin.style.visibility = "hidden";
            }
            appRoot.style.display = "none";
            appRoot.style.visibility = "hidden";
            container.style.overflowY = "hidden";
            container.style.overflowX = "hidden";
            spreadsheetContent.querySelectorAll(".floating-textbox").forEach(box => {
                box.classList.remove("ss-obj-offscreen");
            });
        } else {
            if (findWin && findWin.isConnected && findDialogOpen) {
                findWin.style.visibility = "visible";
            }
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
            if (dropdownOwnerCell && floatingDropdownBtn.style.display !== "none") {
                floatingDropdownBtn.style.display = "none";
            }
        }
        if (scrollIdleTimer) { clearTimeout(scrollIdleTimer); timers.delete(scrollIdleTimer); }
        scrollIdleTimer = managedTimeout(() => {
            isScrollingNow = false;
            scrollIdleTimer = null;
            if (dropdownOwnerCell) syncCellDropdownButtonPosition();
            if (tbody.rows.length > 120) scheduleTextOverflowUpdate();
        }, 120);

        if (activeDropdownCleanup) closeCellDropdownList();
        if (activeFilterDropdownEl) closeFilterDropdown();
        if (dvTooltipEl) hideDataValidationTooltip();

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
            if ((freezeRows > 0 || freezeCols > 0) && lastHighlightedFormula) {
                refreshFormulaRefOverlay();
            }
        });
    }, { passive: true, signal });

    // =========================================================
    // ズーム・トラックパッド横スクロール・タッチパン＆慣性スクロール制御
    // =========================================================
    let zoomValue = 100;
    function setZoom(nextZoom, { silent = false } = {}) {
        const normalizedZoom = Math.min(200, Math.max(20, Math.round(nextZoom / 5) * 5));
        const changed = zoomValue !== normalizedZoom;
        zoomValue = normalizedZoom;
        spreadsheetContent.style.zoom = String(zoomValue / 100);
        zoomSlider.value = String(zoomValue);
        zoomDisplay.textContent = `${zoomValue}%`;
        refreshVisibleRows();
        syncCellDropdownButtonPosition();
        refreshFormulaRefOverlay();
        if (changed && !silent) {
            setDirtyState(true);
            debouncedSaveState();
        }
    }
    zoomSlider.addEventListener("input", () => {
        setZoom(parseInt(zoomSlider.value, 10));
    }, { signal });

    function applyHorizontalScrollDelta(deltaX) {
        if (!deltaX) return;
        container.scrollLeft = Math.max(0, container.scrollLeft + deltaX);
    }

    // Ctrl+ホイール（ズーム）と Shift+縦ホイール（Windows用横スクロール）だけJS処理し、
    // 通常の2本指横スワイプ（deltaX）はブラウザ標準のGPUスクロールに任せる
    appRoot.addEventListener("wheel", (e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setZoom(zoomValue + (e.deltaY < 0 ? 5 : -5));
            return;
        }
        if (e.shiftKey && e.deltaX === 0 && e.deltaY !== 0) {
            if (e.target.closest(".pulldown_menu, .ss-sheet-tabs-scroll")) return;
            e.preventDefault();
            applyHorizontalScrollDelta(e.deltaY);
        }
    }, { passive: false, signal });

    // タッチ操作（1本指ドラッグによる縦横パン＋慣性スクロール / 2本指ピンチズーム）
    let initialPinchDist = null;
    let initialPinchZoom = 100;
    let pendingPinchZoom = 100;
    const pinchSensitivity = 0.03;
    const pinchMinRatioChange = 0.005;
    const pinchMinPxChange = 2;

    let isTouchPanning = false;
    let touchPanStartX = 0;
    let touchPanStartY = 0;
    let touchLastX = 0;
    let touchLastY = 0;
    let touchLastTime = 0;
    let touchVelocityX = 0;
    let touchVelocityY = 0;
    let inertiaRafId = null;

    function stopTouchInertia() {
        if (inertiaRafId !== null) {
            cancelAnimationFrame(inertiaRafId);
            inertiaRafId = null;
        }
    }

    function startTouchInertia() {
        stopTouchInertia();
        const friction = 0.92;
        const step = () => {
            if (Math.abs(touchVelocityX) < 0.4 && Math.abs(touchVelocityY) < 0.4) {
                inertiaRafId = null;
                return;
            }
            container.scrollTop = Math.max(0, container.scrollTop - touchVelocityY);
            applyHorizontalScrollDelta(-touchVelocityX);
            touchVelocityX *= friction;
            touchVelocityY *= friction;
            inertiaRafId = requestAnimationFrame(step);
        };
        inertiaRafId = requestAnimationFrame(step);
    }

    appRoot.addEventListener("touchstart", (e) => {
        stopTouchInertia();
        if (e.touches.length === 2) {
            isTouchPanning = false;
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            initialPinchDist = Math.hypot(dx, dy);
            initialPinchZoom = zoomValue;
            pendingPinchZoom = zoomValue;
            return;
        }
        if (e.touches.length === 1 && container.contains(e.target)) {
            if (e.target.closest(".fill-handle, .col-resize-handle, .row-resize-handle, .floating-textbox")) return;
            const t = e.touches[0];
            isTouchPanning = true;
            touchPanStartX = touchLastX = t.clientX;
            touchPanStartY = touchLastY = t.clientY;
            touchLastTime = performance.now();
            touchVelocityX = 0;
            touchVelocityY = 0;
        }
    }, { passive: true, signal });

    appRoot.addEventListener("touchmove", (e) => {
        if (e.touches.length === 2 && initialPinchDist && initialPinchDist > 0) {
            e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.hypot(dx, dy);
            const ratio = dist / initialPinchDist;
            if (Math.abs(ratio - 1) < pinchMinRatioChange && Math.abs(dist - initialPinchDist) < pinchMinPxChange) return;
            pendingPinchZoom = initialPinchZoom * Math.pow(ratio, pinchSensitivity);
            setZoom(pendingPinchZoom);
            return;
        }

        if (e.touches.length === 1 && isTouchPanning) {
            const t = e.touches[0];
            const now = performance.now();
            const dt = Math.max(1, now - touchLastTime);
            const moveX = t.clientX - touchLastX;
            const moveY = t.clientY - touchLastY;

            // 微小なタップ揺れはセル選択として通すため閾値判定
            if (Math.hypot(t.clientX - touchPanStartX, t.clientY - touchPanStartY) > 6) {
                e.preventDefault();
                container.scrollTop = Math.max(0, container.scrollTop - moveY);
                applyHorizontalScrollDelta(-moveX);
                touchVelocityX = (moveX / dt) * 16;
                touchVelocityY = (moveY / dt) * 16;
            }
            touchLastX = t.clientX;
            touchLastY = t.clientY;
            touchLastTime = now;
        }
    }, { passive: false, signal });

    appRoot.addEventListener("touchend", (e) => {
        if (e.touches.length < 2) {
            initialPinchDist = null;
        }
        if (e.touches.length === 0 && isTouchPanning) {
            isTouchPanning = false;
            if (Math.hypot(touchVelocityX, touchVelocityY) > 1.2) {
                startTouchInertia();
            }
        }
    }, { passive: true, signal });

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
        let rawRecovery = null;
        try {
            rawRecovery = localStorage.getItem(RECOVERY_STORAGE_KEY);
        } catch {
            rawRecovery = null;
        }

        setDirtyState(false);
        saveState();
        savedSnapshotJSON = undoHistory[undoHistory.length - 1] || null;
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
                                    undoHistory = [];
                                    redoHistory = [];
                                    saveState();
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

            const fileName = currentFilePath ? basename(currentFilePath) : "無題.nxs";
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
                                if (currentFilePath) {
                                    const ok = await writeToFSPath(currentFilePath);
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
            persistCrashRecoveryBackup(serialized);
        } catch { /* ignore */ }
    }, { signal });

    // =========================================================
    // カーネル連携用ハンドル
    // =========================================================
    const appHandle = {
        onRename({ oldPath, newPath }) {
            if (currentFilePath === oldPath) {
                if (lockedFilePath === oldPath) {
                    unlockFile(oldPath, lockOwnerPid);
                    if (lockFile(newPath, "exclusive", lockOwnerPid)) {
                        lockedFilePath = newPath;
                    }
                }
                currentFilePath = newPath;
                setDirtyState(isDirty);
            }
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
            stopTouchInertia();
            stopDragAutoScroll();
            if (findWin) {
                if (windowAPI?.destroyWindow) windowAPI.destroyWindow(findWin);
                else if (windowAPI?.closeWindow) windowAPI.closeWindow(findWin);
                if (findWin.isConnected) findWin.remove();
                findWin = null;
                findDialogOpen = false;
            }
            document.getElementById(pageStyleId)?.remove();
            document.getElementById(printStyleId)?.remove();
            if (appRoot._navInterval) {
                clearInterval(appRoot._navInterval);
                appRoot._navInterval = null;
            }
            disconnectActiveSheetObservers();
            rowObserver?.disconnect();
            containerResizeObserver?.disconnect();
            windowStateObserver?.disconnect();
            abortController.abort();
            timers.forEach(id => clearTimeout(id));
            timers.clear();
            if (resizeTooltip.isConnected) {
                resizeTooltip.remove();
            }
            if (lockedFilePath) {
                unlockFile(lockedFilePath, lockOwnerPid);
                lockedFilePath = null;
            }
        }
    };

    if (syscall) {
        syscall.onMessage = appHandle.onMessage;
    }

    return appHandle;
}