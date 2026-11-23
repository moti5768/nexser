// formula-ref-overlay.js
// 数式参照トークン解析・色枠オーバーレイ描画・1セル精度4辺移動/4隅リサイズドラッグ

import {
    DEFAULT_ROW_HEIGHT,
    DEFAULT_HEADER_HEIGHT,
    DEFAULT_ROW_HEADER_WIDTH,
    getColumnName,
    columnLettersToIndex
} from "./format-utils.js";

export const FREF_PALETTE = [
    { hex: "#0070C0", rgb: "0, 112, 192" },
    { hex: "#C00000", rgb: "192, 0, 0" },
    { hex: "#7030A0", rgb: "112, 48, 160" },
    { hex: "#008000", rgb: "0, 128, 0" },
    { hex: "#E46C0A", rgb: "228, 108, 10" },
    { hex: "#008287", rgb: "0, 130, 135" },
    { hex: "#A61C50", rgb: "166, 28, 80" }
];

export function parseCellReference(ref) {
    const match = String(ref || "").match(/^\$?([A-Za-z]+)\$?(\d+)$/);
    if (!match) return null;
    return {
        col: columnLettersToIndex(match[1]),
        row: parseInt(match[2], 10)
    };
}

export function parseRangeReference(rangeRef) {
    const parts = String(rangeRef || "").split(":");
    if (parts.length !== 2) return null;
    const start = parseCellReference(parts[0]);
    const end = parseCellReference(parts[1]);
    if (!start || !end) return null;
    return { start, end };
}

/**
 * 数式内の全参照トークンを文字オフセット・$絶対フラグ・配色インデックス付きで抽出
 */
export function extractFormulaRefTokens(formula) {
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

export function formatRefTokenText(r1, c1, r2, c2, flags = {}) {
    const p1 = `${flags.absC1 ? "$" : ""}${getColumnName(c1)}${flags.absR1 ? "$" : ""}${r1}`;
    if (r1 === r2 && c1 === c2 && !flags.forceRange) {
        return p1;
    }
    const p2 = `${flags.absC2 ? "$" : ""}${getColumnName(c2)}${flags.absR2 ? "$" : ""}${r2}`;
    return `${p1}:${p2}`;
}

export function createFormulaRefOverlayModule(ctx) {
    const {
        signal,
        container,
        spreadsheetContent,
        theadRow,
        colgroup,
        tbody,
        formulaBarInput,
        ROW_BATCH,
        COLUMN_BATCH,
        getCurrentColumns,
        getRowCount,
        getFreezeRows,
        getFreezeCols,
        getColumnWidth,
        loadRowsSync,
        loadColumnsSync,
        isCellEditing,
        getCellEditor,
        getEditingCell,
        syncCellEditorLayout,
        markFormulaBarDirty,
        syncFormulaBarToCellEditor,
        setLastPointRefRange
    } = ctx;

    const formulaRefLayer = document.createElement("div");
    formulaRefLayer.className = "ss-formula-ref-layer";
    spreadsheetContent.appendChild(formulaRefLayer);

    const auditSvgLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    auditSvgLayer.setAttribute("class", "ss-audit-svg-layer");
    spreadsheetContent.appendChild(auditSvgLayer);

    let currentFormulaRefTokens = [];
    let activeRefDragState = null;
    let lastHighlightedFormula = "";
    let auditArrows = [];

    function isRefDragging() {
        return Boolean(activeRefDragState);
    }

    function clearCalculationRangeHighlights() {
        formulaRefLayer.innerHTML = "";
        currentFormulaRefTokens = [];
        lastHighlightedFormula = "";
    }

    /**
     * 結合セルの有無に一切影響されない「1セル単位のグリッド軸座標」を構築
     */
    function buildGridAxisMetrics() {
        const zoom = parseFloat(spreadsheetContent.style.zoom || "1") || 1;
        const contentRect = spreadsheetContent.getBoundingClientRect();
        const rowHeaderW = theadRow.cells[0]?.offsetWidth || parseInt(colgroup.children[0]?.style.width, 10) || DEFAULT_ROW_HEADER_WIDTH;
        const theadH = theadRow.offsetHeight || DEFAULT_HEADER_HEIGHT;
        const scrollShiftX = container.scrollLeft / zoom;
        const scrollShiftY = container.scrollTop / zoom;
        const colCount = getCurrentColumns();
        const freezeCols = getFreezeCols();
        const freezeRows = getFreezeRows();

        const cols = [];
        let accX = rowHeaderW;
        for (let c = 0; c < colCount; c++) {
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
            const h = hidden ? 0 : (parseInt(tr.style.height, 10) || tr.offsetHeight || DEFAULT_ROW_HEIGHT);
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

    function syncFormulaInputsAndCaret(newFormula, selStart, selEnd, primaryInput = null) {
        const isEditing = isCellEditing();
        const cellEditor = getCellEditor();
        const editingCell = getEditingCell();

        if (formulaBarInput && formulaBarInput.value !== newFormula) {
            formulaBarInput.value = newFormula;
        }
        if (cellEditor && isEditing && cellEditor.value !== newFormula) {
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
            markFormulaBarDirty();
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

    function renderAuditArrows() {
        if (!auditArrows.length) {
            auditSvgLayer.innerHTML = "";
            return;
        }
        const metrics = buildGridAxisMetrics();
        const parts = [
            `<defs>
                <marker id="ss-audit-arrow-blue" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#005a9e" />
                </marker>
                <marker id="ss-audit-arrow-red" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#d13438" />
                </marker>
            </defs>`
        ];

        const drawnBoxes = new Set();
        for (const item of auditArrows) {
            const fromRect = computeGridRangeRect(item.from.minR, item.from.minC, item.from.maxR, item.from.maxC, metrics);
            const toRect = computeGridRangeRect(item.to.minR, item.to.minC, item.to.maxR, item.to.maxC, metrics);
            if (!fromRect || !toRect) continue;

            const color = item.isError ? "#d13438" : "#005a9e";
            const marker = item.isError ? "url(#ss-audit-arrow-red)" : "url(#ss-audit-arrow-blue)";
            const isFromRange = item.from.minR !== item.from.maxR || item.from.minC !== item.from.maxC;

            if (isFromRange) {
                const boxKey = `${item.from.minR},${item.from.minC}:${item.from.maxR},${item.from.maxC}`;
                if (!drawnBoxes.has(boxKey)) {
                    drawnBoxes.add(boxKey);
                    parts.push(
                        `<rect x="${fromRect.left.toFixed(1)}" y="${fromRect.top.toFixed(1)}" width="${fromRect.width.toFixed(1)}" height="${fromRect.height.toFixed(1)}" fill="rgba(0,90,158,0.06)" stroke="${color}" stroke-width="1.6" />`
                    );
                }
            }

            // 始点は範囲の左上セル中心（単一セルはその中心）、終点はターゲットセルの左側中央寄り
            const startAnchorRect = computeGridRangeRect(item.from.minR, item.from.minC, item.from.minR, item.from.minC, metrics) || fromRect;
            const x1 = startAnchorRect.left + Math.min(18, startAnchorRect.width * 0.35);
            const y1 = startAnchorRect.top + startAnchorRect.height * 0.5;
            const x2 = toRect.left + Math.min(16, toRect.width * 0.25);
            const y2 = toRect.top + toRect.height * 0.5;

            parts.push(`<circle cx="${x1.toFixed(1)}" cy="${y1.toFixed(1)}" r="3.2" fill="${color}" />`);
            parts.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="1.6" marker-end="${marker}" />`);
        }

        auditSvgLayer.innerHTML = parts.join("");
    }

    function clearAuditArrows() {
        auditArrows = [];
        auditSvgLayer.innerHTML = "";
    }

    function tracePrecedentsForCell(cell) {
        if (!cell || !cell.dataset?.formula) return 0;
        const r = parseInt(cell.dataset.row, 10);
        const c = parseInt(cell.dataset.col, 10);
        const rs = parseInt(cell.getAttribute("rowspan") || "1", 10);
        const cs = parseInt(cell.getAttribute("colspan") || "1", 10);
        const tokens = extractFormulaRefTokens(cell.dataset.formula);
        if (!tokens.length) return 0;

        const rawDisp = String(cell.dataset.rawValue ?? cell.textContent ?? "").trim();
        const isError = /^#(ERROR!|DIV\/0!|N\/A|VALUE!|CIRCULAR!|REF!|NAME\?|NUM!|CALC!|SPILL!)$/.test(rawDisp);

        const seen = new Set(auditArrows.map(a => `P:${a.from.minR},${a.from.minC},${a.from.maxR},${a.from.maxC}->${a.to.minR},${a.to.minC}`));
        let added = 0;
        for (const tok of tokens) {
            const key = `P:${tok.minR},${tok.minC},${tok.maxR},${tok.maxC}->${r},${c}`;
            if (seen.has(key)) continue;
            seen.add(key);
            auditArrows.push({
                kind: "precedent",
                from: { minR: tok.minR, minC: tok.minC, maxR: tok.maxR, maxC: tok.maxC },
                to: { minR: r, minC: c, maxR: r + rs - 1, maxC: c + cs - 1 },
                isError
            });
            added++;
        }
        renderAuditArrows();
        return added;
    }

    function traceDependentsForCell(cell) {
        if (!cell) return 0;
        const r0 = parseInt(cell.dataset.row, 10);
        const c0 = parseInt(cell.dataset.col, 10);
        const r1 = r0 + parseInt(cell.getAttribute("rowspan") || "1", 10) - 1;
        const c1 = c0 + parseInt(cell.getAttribute("colspan") || "1", 10) - 1;

        const seen = new Set(auditArrows.map(a => `D:${a.from.minR},${a.from.minC}->${a.to.minR},${a.to.minC}`));
        let added = 0;

        tbody.querySelectorAll("td[data-formula]").forEach(td => {
            if (td === cell) return;
            const tokens = extractFormulaRefTokens(td.dataset.formula);
            const hits = tokens.some(tok =>
                !(tok.maxR < r0 || tok.minR > r1 || tok.maxC < c0 || tok.minC > c1)
            );
            if (!hits) return;

            const tr = parseInt(td.dataset.row, 10);
            const tc = parseInt(td.dataset.col, 10);
            const trs = parseInt(td.getAttribute("rowspan") || "1", 10);
            const tcs = parseInt(td.getAttribute("colspan") || "1", 10);
            const key = `D:${r0},${c0}->${tr},${tc}`;
            if (seen.has(key)) return;
            seen.add(key);

            const rawDisp = String(td.dataset.rawValue ?? td.textContent ?? "").trim();
            const isError = /^#(ERROR!|DIV\/0!|N\/A|VALUE!|CIRCULAR!|REF!|NAME\?|NUM!|CALC!|SPILL!)$/.test(rawDisp);

            auditArrows.push({
                kind: "dependent",
                from: { minR: r0, minC: c0, maxR: r1, maxC: c1 },
                to: { minR: tr, minC: tc, maxR: tr + trs - 1, maxC: tc + tcs - 1 },
                isError
            });
            added++;
        });

        renderAuditArrows();
        return added;
    }

    function refreshFormulaRefOverlay() {
        if (lastHighlightedFormula) {
            highlightCalculationRange(lastHighlightedFormula);
        }
        if (auditArrows.length) {
            renderAuditArrows();
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

        const cellEditor = getCellEditor();
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

        setLastPointRefRange({ start: tok.start, end: tok.end });
        syncFormulaInputsAndCaret(primaryInput.value, tok.start, tok.end, primaryInput);
        highlightCalculationRange(primaryInput.value, { activeTokenIdx: tokenIdx });

        const finishRefDrag = (cancel = false) => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
            document.removeEventListener("keydown", onDragKeydown, true);
            if (!activeRefDragState) return;
            const st = activeRefDragState;
            activeRefDragState = null;
            setLastPointRefRange(null);

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

            if (nextR2 >= getRowCount()) {
                loadRowsSync(ROW_BATCH);
                st.metrics = buildGridAxisMetrics();
            }
            if (nextC2 >= getCurrentColumns()) {
                loadColumnsSync(COLUMN_BATCH);
                st.metrics = buildGridAxisMetrics();
            }

            const newRefText = formatRefTokenText(nextR1, nextC1, nextR2, nextC2, st.flags);
            const curFormula = st.primaryInput.value;
            const updatedFormula = curFormula.slice(0, st.tokStart) + newRefText + curFormula.slice(st.tokEnd);
            st.tokEnd = st.tokStart + newRefText.length;
            setLastPointRefRange({ start: st.tokStart, end: st.tokEnd });

            syncFormulaInputsAndCaret(updatedFormula, st.tokStart, st.tokEnd, st.primaryInput);
            highlightCalculationRange(updatedFormula, { activeTokenIdx: st.tokenIdx });
        };

        const onUp = () => finishRefDrag(false);

        document.addEventListener("mousemove", onMove, { signal });
        document.addEventListener("mouseup", onUp, { signal });
        document.addEventListener("keydown", onDragKeydown, { capture: true, signal });
    }, { capture: true, signal });

    return {
        formulaRefLayer,
        isRefDragging,
        clearCalculationRangeHighlights,
        highlightCalculationRange,
        refreshFormulaRefOverlay,
        tracePrecedentsForCell,
        traceDependentsForCell,
        clearAuditArrows,
        syncFormulaInputsAndCaret,
        buildGridAxisMetrics,
        computeGridRangeRect,
        hitTestGridCoord
    };
}