// print-manager.js
// ページ設定（用紙サイズ・向き・縮小印刷・枠線印刷）・@page/@media print動的制御・印刷実行

export function createPrintManagerModule(ctx) {
    const {
        appRoot,
        table,
        tbody,
        lockOwnerPid,
        getActiveCell,
        getCurrentColumns,
        getRow,
        getCell,
        getColumnWidth,
        flushPendingEdits,
        clearSelection,
        clearCalculationRangeHighlights,
        setActiveCell,
        updateSelectedCellsDisplay,
        updateFillHandle,
        refreshVisibleRows,
        renderWindowStatusBar,
        setDirtyState,
        debouncedSaveState
    } = ctx;

    const pageStyleId = `ss-page-style-${lockOwnerPid}`;
    const printStyleId = `ss-print-style-${lockOwnerPid}`;

    let currentPageSize = "A4";
    let printOrientation = "portrait"; // "portrait" | "landscape"
    let printFitToWidth = true;
    let printShowGridlines = false;

    function getPageSize() {
        return currentPageSize;
    }

    function getPrintOptions() {
        return {
            orientation: printOrientation,
            fitToWidth: printFitToWidth,
            showGridlines: printShowGridlines
        };
    }

    function syncPrintButtonsUI() {
        const btn = appRoot.querySelector(".ss-print-orient-btn");
        const lbl = btn?.querySelector(".ss-btn-lbl") || btn;
        if (lbl) lbl.textContent = `向き: ${printOrientation === "landscape" ? "横" : "縦"}`;
        appRoot.querySelector(".ss-print-fit-btn")?.classList.toggle("selected", printFitToWidth);
        appRoot.querySelector(".ss-print-grid-btn")?.classList.toggle("selected", printShowGridlines);
    }

    function updatePageStyleRule() {
        let styleTag = document.getElementById(pageStyleId);
        if (!styleTag) {
            styleTag = document.createElement("style");
            styleTag.id = pageStyleId;
            document.head.appendChild(styleTag);
        }
        styleTag.textContent = `@page { size: ${currentPageSize} ${printOrientation}; margin: 1cm; }`;
    }

    function setPrintOptions(opts = {}, { silent = false } = {}) {
        const nextOrientation = opts?.orientation === "landscape" ? "landscape" : "portrait";
        const nextFit = opts?.fitToWidth !== undefined ? Boolean(opts.fitToWidth) : true;
        const nextGrid = opts?.showGridlines !== undefined ? Boolean(opts.showGridlines) : false;
        const changed =
            printOrientation !== nextOrientation ||
            printFitToWidth !== nextFit ||
            printShowGridlines !== nextGrid;

        printOrientation = nextOrientation;
        printFitToWidth = nextFit;
        printShowGridlines = nextGrid;
        syncPrintButtonsUI();
        updatePageStyleRule();
        if (changed && !silent) {
            setDirtyState(true);
            debouncedSaveState();
        }
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

    function togglePrintOrientation() {
        setPrintOptions({
            orientation: printOrientation === "portrait" ? "landscape" : "portrait",
            fitToWidth: printFitToWidth,
            showGridlines: printShowGridlines
        });
    }

    function togglePrintFit() {
        setPrintOptions({
            orientation: printOrientation,
            fitToWidth: !printFitToWidth,
            showGridlines: printShowGridlines
        });
    }

    function togglePrintGrid() {
        setPrintOptions({
            orientation: printOrientation,
            fitToWidth: printFitToWidth,
            showGridlines: !printShowGridlines
        });
    }

    function cleanupPrintStyles() {
        document.getElementById(pageStyleId)?.remove();
        document.getElementById(printStyleId)?.remove();
    }

    function printSpreadsheet() {
        const prevActiveCell = getActiveCell();
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
        const colCount = getCurrentColumns();
        const headerRow = table.querySelector("thead tr");
        for (let c = maxDataC + 1; c < colCount; c++) {
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
            : `.ss-printing-active .ss-table td { --ss-gl-r: 0 0 0 0 transparent !important; --ss-gl-b: 0 0 0 0 transparent !important; }`;

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
                .ss-printing-active .ss-autofill-opt-btn,
                .ss-printing-active .ss-selection-box,
                .ss-printing-active .ss-filter-arrow,
                .ss-printing-active .ss-cell-dropdown-btn,
                .ss-printing-active .floating-textbox-delete,
                .ss-printing-active .floating-chart-settings,
                .ss-printing-active .ss-obj-handle,
                .ss-printing-active .ss-obj-rotate-line,
                .ss-printing-active .ss-obj-rotate-handle,
                .ss-printing-active .ss-slicer-ctrls,
                .ss-printing-active .ss-slicer-resizer {
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

    return {
        getPageSize,
        getPrintOptions,
        setPrintOptions,
        updatePageStyleRule,
        setPageSize,
        togglePrintOrientation,
        togglePrintFit,
        togglePrintGrid,
        printSpreadsheet,
        cleanupPrintStyles
    };
}