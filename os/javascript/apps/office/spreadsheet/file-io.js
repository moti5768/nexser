// file-io.js
// 仮想FS保存・読込・CSV入出力・ローカル入出力・クラッシュリカバリ・Undo/Redo履歴管理

import { forceSave, lockFile, unlockFile, setBulkUpdating } from "../../../fs.js";
import { getFileContent } from "../../../fs-db.js";
import { resolveFS, normalizePath, basename, validateName, isSystemMetaKey } from "../../../fs-utils.js";
import { escapeHtml } from "./format-utils.js";

export function parseCSVRows(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    const normalized = String(text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

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

export function createFileIOModule(ctx) {
    const {
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
        getActiveCell,
        getSheets,
        setSheets,
        getActiveSheetIndex,
        setActiveSheetIndex,
        getDefinedNames,
        setDefinedNames,
        createBlankSheetModel,
        getRowCount,
        getCurrentColumns,
        loadRowsSync,
        loadColumnsSync,
        setColumnWidth,
        syncTableWidth,
        updateHiddenHeaderIndicators,
        getPageSize,
        getFreezeRows,
        getFreezeCols,
        setFreezePanes,
        getCell,
        getVisibleCell,
        getRow,
        extractCellStyleObject,
        applyCellStyleData,
        applyShrinkToFit,
        syncCellAnnotationMark,
        insertTextBox,
        renderChartBoxSVG,
        attachChartControls,
        enableTextboxDragging,
        removeFloatingObject,
        closeCellDropdownList,
        hideCellDropdownButton,
        clearCopyAnimation,
        clearAllAutoFilters,
        serializeAutoFilters,
        restoreAutoFilters,
        getSheetTables,
        applyStructuredTableVisuals,
        renderSheetTabs,
        syncSheetProtectionUI,
        invalidateBackgroundSheetCache,
        recalculateBackgroundSheets,
        evaluateFormula,
        setCellFormattedValue,
        updateAllFormulas,
        applyConditionalFormats,
        refreshVisibleRows,
        refreshVisibleFloatingObjects,
        syncCellDropdownButtonPosition,
        setZoom,
        setPageSize,
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
        getIsDirty,
        updateQATButtonsState,
        managedTimeout,
        clearManagedTimeout,
        destroyFindDialog,
        stopTouchInertia,
        stopDragAutoScroll,
        cleanupPrintStyles
    } = ctx;

    const RECOVERY_STORAGE_KEY = "nexser_ss_autosave_recovery_v1";
    const WORKER_CSV_MIN_CHARS = 16_000;
    const WORKER_SNAPSHOT_MIN_CELLS = 250;

    let undoHistory = [];
    let redoHistory = [];
    let saveStateTimeout = null;
    let savedSnapshotJSON = null;
    let asyncSaveSeq = 0;

    let currentFilePath = null;
    let lockedFilePath = null;

    // 遅延起動 Web Worker ブリッジ（起動失敗時は自動的にメインスレッドへフォールバック）
    let ioWorker = null;
    let ioWorkerUnavailable = false;
    let workerReqSeq = 0;
    const workerPending = new Map();

    function getIOWorker() {
        if (ioWorkerUnavailable || typeof Worker === "undefined") return null;
        if (ioWorker) return ioWorker;
        try {
            ioWorker = new Worker(new URL("./spreadsheet.worker.js", import.meta.url), { type: "module" });
            ioWorker.addEventListener("message", (e) => {
                const { id, ok, result, error } = e.data || {};
                const pending = workerPending.get(id);
                if (!pending) return;
                workerPending.delete(id);
                if (ok) pending.resolve(result);
                else pending.reject(new Error(error || "Worker task failed"));
            });
            ioWorker.addEventListener("error", () => {
                terminateIOWorker(true);
            });
            return ioWorker;
        } catch {
            ioWorkerUnavailable = true;
            return null;
        }
    }

    function terminateIOWorker(markUnavailable = false) {
        if (ioWorker) {
            try { ioWorker.terminate(); } catch { /* ignore */ }
            ioWorker = null;
        }
        if (markUnavailable) ioWorkerUnavailable = true;
        workerPending.forEach(({ reject }) => reject(new Error("Worker terminated")));
        workerPending.clear();
    }

    function runWorkerTask(type, payload) {
        const worker = getIOWorker();
        if (!worker) return Promise.resolve(null);
        return new Promise((resolve, reject) => {
            const id = ++workerReqSeq;
            workerPending.set(id, { resolve, reject });
            try {
                worker.postMessage({ id, type, payload });
            } catch (err) {
                workerPending.delete(id);
                reject(err);
            }
        }).catch(() => null);
    }

    function getCurrentFilePath() {
        return currentFilePath;
    }

    function setCurrentFilePath(path) {
        currentFilePath = path;
    }

    function getLockedFilePath() {
        return lockedFilePath;
    }

    function clearLockedFilePath() {
        lockedFilePath = null;
    }

    function releaseFileLockIfHeld(targetPath = null) {
        if (lockedFilePath && (!targetPath || lockedFilePath !== targetPath)) {
            unlockFile(lockedFilePath, lockOwnerPid);
            lockedFilePath = null;
        }
    }

    function handleFileRenamed(oldPath, newPath) {
        if (currentFilePath !== oldPath) return;
        if (lockedFilePath === oldPath) {
            unlockFile(oldPath, lockOwnerPid);
            lockedFilePath = lockFile(newPath, "exclusive", lockOwnerPid) ? newPath : null;
        }
        currentFilePath = newPath;
        setDirtyState(getIsDirty());
    }

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
            try { localStorage.removeItem(RECOVERY_STORAGE_KEY); } catch { /* ignore */ }
        }
    }

    function clearCrashRecoveryBackup() {
        try { localStorage.removeItem(RECOVERY_STORAGE_KEY); } catch { /* ignore */ }
    }

    function readCrashRecoveryRaw() {
        try {
            return localStorage.getItem(RECOVERY_STORAGE_KEY);
        } catch {
            return null;
        }
    }

    function pushSerializedSnapshot(serialized) {
        if (!serialized) return;
        if (undoHistory.length > 0 && undoHistory[undoHistory.length - 1] === serialized) return;
        redoHistory = [];
        undoHistory.push(serialized);
        if (undoHistory.length > 50) undoHistory.shift();
        updateQATButtonsState();
        if (getIsDirty()) persistCrashRecoveryBackup(serialized);
    }

    function buildSnapshotObject({ flush = true, recalcBackground = true } = {}) {
        captureCurrentSheetDOM({ flush });
        if (recalcBackground) {
            recalculateBackgroundSheets();
        }
        return {
            format: "nexser-spreadsheet",
            version: 4,
            activeSheetIndex: getActiveSheetIndex(),
            definedNames: getDefinedNames(),
            sheets: getSheets()
        };
    }

    function countTotalCellsInSheets(sheetsArr) {
        let total = 0;
        if (!Array.isArray(sheetsArr)) return 0;
        for (let i = 0; i < sheetsArr.length; i++) {
            total += Array.isArray(sheetsArr[i]?.cells) ? sheetsArr[i].cells.length : 0;
        }
        return total;
    }

    function saveState() {
        asyncSaveSeq++;
        try {
            const serialized = serializeSheetSnapshot({ flush: false, recalcBackground: false });
            pushSerializedSnapshot(serialized);
        } catch (err) {
            console.warn("[Spreadsheet] スナップショット保存中にエラーが発生しました:", err);
        }
    }

    async function saveStateInBackground() {
        const mySeq = ++asyncSaveSeq;
        try {
            const snapshotObj = buildSnapshotObject({ flush: false, recalcBackground: false });
            const totalCells = countTotalCellsInSheets(snapshotObj.sheets);

            let serialized = null;
            if (totalCells >= WORKER_SNAPSHOT_MIN_CELLS) {
                serialized = await runWorkerTask("stringify-snapshot", snapshotObj);
            }
            // 非同期処理中に別の操作（Undo/Redo/新規作成/即時保存等）が入った場合は破棄
            if (mySeq !== asyncSaveSeq) return;
            if (serialized === null) {
                serialized = JSON.stringify(snapshotObj);
            }
            pushSerializedSnapshot(serialized);
        } catch (err) {
            console.warn("[Spreadsheet] バックグラウンドスナップショット保存中にエラーが発生しました:", err);
        }
    }

    function cancelDebouncedSaveState() {
        asyncSaveSeq++;
        if (saveStateTimeout) {
            clearManagedTimeout(saveStateTimeout);
            saveStateTimeout = null;
        }
    }

    function debouncedSaveState(delay = 300) {
        cancelDebouncedSaveState();
        saveStateTimeout = managedTimeout(() => {
            saveStateTimeout = null;
            void saveStateInBackground();
        }, delay);
    }

    function flushDebouncedSaveState() {
        if (saveStateTimeout) {
            cancelDebouncedSaveState();
            saveState();
        }
    }

    function markCurrentSnapshotAsSaved() {
        savedSnapshotJSON = undoHistory[undoHistory.length - 1] || null;
    }

    function resetUndoRedoBaseline() {
        asyncSaveSeq++;
        undoHistory = [];
        redoHistory = [];
        saveState();
        markCurrentSnapshotAsSaved();
    }

    function resetUndoRedoHistoryOnly() {
        asyncSaveSeq++;
        undoHistory = [];
        redoHistory = [];
        saveState();
    }

    async function loadState(stateJSON) {
        asyncSaveSeq++;
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

    function disconnectActiveSheetObservers() {
        activeSheetObservers.forEach(obs => obs.disconnect());
        activeSheetObservers.clear();
    }

    function clearSheetToBlank({ resetHistory = true } = {}) {
        disconnectActiveSheetObservers();
        const curCols = getCurrentColumns();
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
        for (let c = 0; c < curCols; c++) {
            setColumnWidth(c, 120);
        }
        for (let c = 0; c < curCols; c++) {
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
        spreadsheetContent.querySelectorAll(".floating-textbox").forEach(b => removeFloatingObject(b));
        closeCellDropdownList();
        hideCellDropdownButton();
        clearCopyAnimation();
        clearAllAutoFilters();
        setFreezePanes(0, 0, { silent: true });
        if (resetHistory) {
            setDefinedNames({});
            const blankSheets = [createBlankSheetModel("Sheet1")];
            setSheets(blankSheets);
            setActiveSheetIndex(0);
            renderSheetTabs();
            undoHistory = [];
            redoHistory = [];
            saveState();
        }
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

        const curCols = getCurrentColumns();
        const savedColumns = [];
        for (let c = 0; c < curCols; c++) {
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
        const sheets = getSheets();
        const activeSheetIndex = getActiveSheetIndex();
        if (!sheets[activeSheetIndex]) {
            sheets[activeSheetIndex] = createBlankSheetModel("Sheet1");
        }

        const activeCell = getActiveCell();
        const target = sheets[activeSheetIndex];
        target.cells = savedCells;
        invalidateBackgroundSheetCache(target);
        target.rows = savedRows;
        target.columns = savedColumns;
        target.zoom = zoom;
        target.pageSize = getPageSize();
        target.freezeRows = getFreezeRows();
        target.freezeCols = getFreezeCols();
        target.textboxes = textboxes;
        target.autoFilters = serializeAutoFilters();
        target.autoFilter = null;
        target.activeCoord = activeCell
            ? { row: parseInt(activeCell.dataset.row, 10), col: parseInt(activeCell.dataset.col, 10) }
            : { row: 1, col: 0 };
        target.scrollTop = container.scrollTop;
        target.scrollLeft = container.scrollLeft;
        target.tables = JSON.parse(JSON.stringify(getSheetTables()));
        return target;
    }

    function serializeSheetSnapshot({ flush = true, recalcBackground = true } = {}) {
        return JSON.stringify(buildSnapshotObject({ flush, recalcBackground }));
    }

    function serializeSpreadsheetPayload() {
        return serializeSheetSnapshot({ flush: true, recalcBackground: true });
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
        const sheets = getSheets();
        const activeSheetIndex = getActiveSheetIndex();
        if (sheets[activeSheetIndex]) {
            sheets[activeSheetIndex].tables = Array.isArray(sheetData.tables)
                ? JSON.parse(JSON.stringify(sheetData.tables))
                : [];
            sheets[activeSheetIndex].conditionalFormats = condFormats;
        }

        const z = parseInt(String(zoomVal).replace("%", ""), 10) || 100;
        setZoom(z, { silent: true });
        setPageSize(sheetData.pageSize || "A4", { silent: true });

        const curRowCount = getRowCount();
        const curCols = getCurrentColumns();
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
        if (maxRow >= curRowCount) loadRowsSync(maxRow - curRowCount + 1);
        if (maxCol >= curCols) loadColumnsSync(maxCol - curCols + 1);

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

        (getSheets()[getActiveSheetIndex()]?.tables || []).forEach(tbl => applyStructuredTableVisuals(tbl));
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

        restoreAutoFilters(sheetData);

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

            const neededRows = Math.ceil((targetTop + container.clientHeight) / 30) + 5;
            const neededCols = Math.ceil((targetLeft + container.clientWidth) / 120) + 2;
            if (neededRows >= getRowCount()) loadRowsSync(Math.min(500, neededRows - getRowCount() + 1));
            if (neededCols >= getCurrentColumns()) loadColumnsSync(Math.min(200, neededCols - getCurrentColumns() + 1));

            container.scrollTop = targetTop;
            container.scrollLeft = targetLeft;
            refreshVisibleRows();
            syncCellDropdownButtonPosition();
        }

        const latestSheets = getSheets();
        const latestIdx = getActiveSheetIndex();
        if (latestSheets[latestIdx]) {
            latestSheets[latestIdx].protected = Boolean(sheetData.protected);
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

        const nextDefinedNames = (parsed && typeof parsed === "object" && parsed.definedNames && typeof parsed.definedNames === "object")
            ? { ...parsed.definedNames }
            : {};
        setDefinedNames(nextDefinedNames);

        let nextSheets;
        let nextActiveIdx = 0;

        if (parsed && typeof parsed === "object" && Array.isArray(parsed.sheets) && parsed.sheets.length > 0) {
            nextSheets = parsed.sheets.map((s, idx) => ({
                ...createBlankSheetModel(s.name || `Sheet${idx + 1}`),
                ...s
            }));
            nextActiveIdx = Math.min(nextSheets.length - 1, Math.max(0, Number(parsed.activeSheetIndex) || 0));
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
            nextSheets = [{
                ...createBlankSheetModel("Sheet1"),
                cells,
                rows: rawRows.map(([r, h]) => ({ r: Number(r), h })),
                columns: rawCols.map(([c, w]) => ({ c: Number(c), w })),
                zoom: rawZoom,
                textboxes: rawBoxes
            }];
            nextActiveIdx = 0;
        } else if (parsed && typeof parsed === "object" && Array.isArray(parsed.cells)) {
            nextSheets = [{
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
            nextActiveIdx = 0;
        } else {
            throw new Error("サポートされていないスプレッドシートデータ構造です。");
        }

        setSheets(nextSheets);
        setActiveSheetIndex(nextActiveIdx);
        renderSheetTabs();
        await applySingleSheetToDOM(nextSheets[nextActiveIdx], {
            isUndoRedo,
            restoreScroll: !isUndoRedo
        });
    }

    async function parseAndLoadCSV(csvText) {
        clearSheetToBlank();
        const rawText = String(csvText ?? "");
        let parsedRows = null;
        if (rawText.length >= WORKER_CSV_MIN_CHARS) {
            parsedRows = await runWorkerTask("parse-csv", rawText);
        }
        if (!Array.isArray(parsedRows)) {
            parsedRows = parseCSVRows(rawText);
        }

        const neededRows = parsedRows.length;
        const neededCols = parsedRows.reduce((m, cols) => Math.max(m, cols.length), 0);
        const curRowCount = getRowCount();
        const curCols = getCurrentColumns();
        if (neededRows >= curRowCount) loadRowsSync(neededRows - curRowCount + 5);
        if (neededCols >= curCols) loadColumnsSync(neededCols - curCols + 2);

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
                await parseAndLoadCSV(contentData);
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
            resetUndoRedoBaseline();

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
            let payload;
            if (normalized.toLowerCase().endsWith(".csv")) {
                payload = await generateCSVTextAsync();
            } else {
                const snapObj = buildSnapshotObject({ flush: true, recalcBackground: true });
                const totalCells = countTotalCellsInSheets(snapObj.sheets);
                payload = totalCells >= WORKER_SNAPSHOT_MIN_CELLS
                    ? ((await runWorkerTask("stringify-snapshot", snapObj)) ?? JSON.stringify(snapObj))
                    : JSON.stringify(snapObj);
            }

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
            if (wasLockedBySelf && lockFile(normalized, "exclusive", lockOwnerPid)) {
                lockedFilePath = normalized;
            }
            console.error("[Spreadsheet] Save failed:", err);
            statusBarState.stateText = "保存エラー";
            renderWindowStatusBar();
            showAlert(`保存に失敗しました:\n${err.message}`, "保存エラー");
            return false;
        }
    }

    function extractCSVDisplayMatrix() {
        flushPendingEdits();
        const getCleanCellDisplay = (cell) => {
            if (!cell) return "";
            // cloneNode(true) を廃止し、textContent の直接取得で DOM 複製コストを大幅削減
            if (!cell.querySelector(".ss-filter-arrow, .ss-cell-dropdown-btn, .fill-handle, .ss-anno-mark")) {
                return cell.textContent || "";
            }
            let txt = "";
            cell.childNodes.forEach(node => {
                if (node.nodeType === Node.TEXT_NODE) {
                    txt += node.nodeValue;
                } else if (
                    node.nodeType === Node.ELEMENT_NODE &&
                    !node.classList.contains("ss-filter-arrow") &&
                    !node.classList.contains("ss-cell-dropdown-btn") &&
                    !node.classList.contains("fill-handle") &&
                    !node.classList.contains("ss-anno-mark")
                ) {
                    txt += node.textContent;
                }
            });
            return txt;
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
        const matrix = [];
        for (let r = 1; r <= maxR; r++) {
            const row = new Array(maxC + 1);
            for (let c = 0; c <= maxC; c++) {
                row[c] = getCleanCellDisplay(getCell(r, c));
            }
            matrix.push(row);
        }
        return matrix;
    }

    function generateCSVText() {
        const matrix = extractCSVDisplayMatrix();
        return matrix.map(cols => cols.map(rawText => {
            const needsQuote = /[",\r\n]/.test(rawText);
            return needsQuote ? `"${rawText.replace(/"/g, '""')}"` : rawText;
        }).join(",")).join("\n");
    }

    async function generateCSVTextAsync() {
        const matrix = extractCSVDisplayMatrix();
        const totalCells = matrix.length * (matrix[0]?.length || 0);
        if (totalCells >= WORKER_SNAPSHOT_MIN_CELLS) {
            const workerCsv = await runWorkerTask("generate-csv", matrix);
            if (typeof workerCsv === "string") return workerCsv;
        }
        return matrix.map(cols => cols.map(rawText => {
            const needsQuote = /[",\r\n]/.test(rawText);
            return needsQuote ? `"${rawText.replace(/"/g, '""')}"` : rawText;
        }).join(",")).join("\n");
    }

    async function exportLocalFile(ext = ".nxs") {
        try {
            const baseTitle = (currentFilePath ? basename(currentFilePath) : "無題.nxs")
                .replace(/\.(nxs|csv|json)$/i, "");
            const fileName = `${baseTitle}${ext}`;
            const isCSV = ext.toLowerCase() === ".csv";
            let contentStr;
            if (isCSV) {
                contentStr = "\uFEFF" + (await generateCSVTextAsync());
            } else {
                const snapObj = buildSnapshotObject({ flush: true, recalcBackground: true });
                const totalCells = countTotalCellsInSheets(snapObj.sheets);
                contentStr = totalCells >= WORKER_SNAPSHOT_MIN_CELLS
                    ? ((await runWorkerTask("stringify-snapshot", snapObj)) ?? JSON.stringify(snapObj))
                    : JSON.stringify(snapObj);
            }
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
                    await parseAndLoadCSV(text);
                } else {
                    await applyDeserializedPayload(text);
                }
                if (lockedFilePath) {
                    unlockFile(lockedFilePath, lockOwnerPid);
                    lockedFilePath = null;
                }
                currentFilePath = null;
                setDirtyState(true);
                if (win && windowAPI?.updateWindowTitle) {
                    windowAPI.updateWindowTitle(win, file.name, true);
                }
                resetUndoRedoHistoryOnly();
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

    function promptSaveAsDialog(defaultExt = ".nxs", onSaved = null) {
        const defaultDir = getDefaultSaveDirectory();
        const defaultPath = currentFilePath || `${defaultDir}/無題${defaultExt}`;

        const bodyHtml = `
            <div style="width:100%; display:flex; flex-direction:column; gap:8px;">
                <div>仮想ドライブ上の保存先パスを指定してください:</div>
                <input type="text" class="ss-save-path-input border" value="${escapeHtml(defaultPath)}" style="width:100%; padding:4px 6px; font-size:12px; background:#fff; color:#000; box-sizing:border-box;">
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
            ? candidates.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("")
            : `<option value="">(保存済みシートが見つかりません)</option>`;
        const initialInputPath = candidates[0] || `${getDefaultSaveDirectory()}/`;

        const bodyHtml = `
            <div style="width:100%; display:flex; flex-direction:column; gap:8px;">
                <div>ファイルを選択するか、仮想ドライブのパスを入力してください:</div>
                <select class="ss-open-select border" style="width:100%; padding:4px; font-size:12px; background:#fff; color:#000;">
                    ${optionsHtml}
                </select>
                <input type="text" class="ss-open-path-input border" value="${escapeHtml(initialInputPath)}" style="width:100%; padding:4px 6px; font-size:12px; background:#fff; color:#000; box-sizing:border-box;">
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

    function disposeFileIO({ destroyDialog = true, stopInertia = true, stopAutoScroll = true, removePrint = true } = {}) {
        flushDebouncedSaveState();
        terminateIOWorker(false);
        if (stopInertia) stopTouchInertia();
        if (stopAutoScroll) stopDragAutoScroll();
        if (destroyDialog) destroyFindDialog();
        if (removePrint) cleanupPrintStyles();
        disconnectActiveSheetObservers();
        if (lockedFilePath) {
            unlockFile(lockedFilePath, lockOwnerPid);
            lockedFilePath = null;
        }
    }

    return {
        getCurrentFilePath,
        setCurrentFilePath,
        getLockedFilePath,
        clearLockedFilePath,
        releaseFileLockIfHeld,
        handleFileRenamed,
        persistCrashRecoveryBackup,
        clearCrashRecoveryBackup,
        readCrashRecoveryRaw,
        saveState,
        cancelDebouncedSaveState,
        debouncedSaveState,
        flushDebouncedSaveState,
        markCurrentSnapshotAsSaved,
        resetUndoRedoBaseline,
        resetUndoRedoHistoryOnly,
        undo,
        redo,
        getUndoLength: () => undoHistory.length,
        getRedoLength: () => redoHistory.length,
        clearSheetToBlank,
        captureCurrentSheetDOM,
        serializeSheetSnapshot,
        serializeSpreadsheetPayload,
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
    };
}