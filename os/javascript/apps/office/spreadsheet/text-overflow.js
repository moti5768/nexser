// text-overflow.js
// セル内テキストの横書き・縦書きはみ出し描画＆隣接セル境界クリップ制御

import {
    DEFAULT_ROW_HEIGHT,
    DEFAULT_FONT_FAMILY,
    DEFAULT_FONT_SIZE_CSS,
    cssFontSizeToPx
} from "./format-utils.js";

export function unwrapOverflowSpan(td) {
    const wrap = td.querySelector(":scope > .ss-overflow-wrap");
    if (!wrap) return;
    const inner = wrap.querySelector(":scope > .ss-overflow-text");
    if (inner) {
        while (inner.firstChild) {
            td.insertBefore(inner.firstChild, wrap);
        }
    }
    wrap.remove();
}

export function wrapOverflowSpan(td, align, leftSpace, rightSpace, opts = {}) {
    let wrap = td.querySelector(":scope > .ss-overflow-wrap");
    if (!wrap) {
        wrap = document.createElement("span");
        const inner = document.createElement("span");
        inner.className = "ss-overflow-text";
        const contentNodes = [];
        for (const node of Array.from(td.childNodes)) {
            if (
                node.nodeType === Node.ELEMENT_NODE &&
                (
                    node.classList.contains("ss-filter-arrow") ||
                    node.classList.contains("fill-handle") ||
                    node.classList.contains("ss-anno-mark")
                )
            ) {
                continue;
            }
            contentNodes.push(node);
        }
        contentNodes.forEach(node => inner.appendChild(node));
        wrap.appendChild(inner);
        td.insertBefore(wrap, td.firstChild);
    }

    if (opts.vertical) {
        const vAlign = opts.vAlign || "top";
        const hAlign = opts.hAlign || "right";
        wrap.className = `ss-overflow-wrap ss-ov-vertical ss-ov-v-${vAlign} ss-ov-vh-${hAlign}`;
        wrap.style.setProperty("--ov-top", `${Math.max(0, Math.round(opts.topSpace || 0))}px`);
        wrap.style.setProperty("--ov-bottom", `${Math.max(0, Math.round(opts.bottomSpace || 0))}px`);
        wrap.style.setProperty("--ov-left", `${Math.max(0, Math.round(leftSpace || 0))}px`);
        wrap.style.setProperty("--ov-right", `${Math.max(0, Math.round(rightSpace || 0))}px`);
    } else {
        wrap.className = `ss-overflow-wrap ss-ov-${align}`;
        wrap.style.setProperty("--ov-top", "4px");
        wrap.style.setProperty("--ov-bottom", "4px");
        wrap.style.setProperty("--ov-left", `${Math.max(0, Math.round(leftSpace || 0))}px`);
        wrap.style.setProperty("--ov-right", `${Math.max(0, Math.round(rightSpace || 0))}px`);
    }
}

export function createTextOverflowModule(ctx) {
    const {
        tbody,
        container,
        measureCtx,
        getColumnWidth,
        isCellEditing
    } = ctx;

    let overflowUpdateRaf = 0;

    function cancelTextOverflowUpdate() {
        if (overflowUpdateRaf) {
            cancelAnimationFrame(overflowUpdateRaf);
            overflowUpdateRaf = 0;
        }
    }

    function scheduleTextOverflowUpdate() {
        if (overflowUpdateRaf) return;
        overflowUpdateRaf = requestAnimationFrame(() => {
            overflowUpdateRaf = 0;
            updateTextOverflowDisplay();
        });
    }

    function updateTextOverflowDisplay(targetRows = null) {
        let rowsToScan = targetRows;
        if (!rowsToScan) {
            const totalRows = tbody.rows.length;
            if (totalRows <= 120) {
                rowsToScan = tbody.rows;
            } else {
                // 行高さが可変＆ズーム変更時でも正確に可視領域を特定（二分探索）
                const zoom = parseFloat(container.firstElementChild?.style.zoom || "1") || 1;
                const viewTop = Math.max(0, container.scrollTop / zoom - 300);
                const viewBottom = (container.scrollTop + container.clientHeight) / zoom + 450;
                let lo = 0, hi = totalRows - 1, startIdx = 0;
                while (lo <= hi) {
                    const mid = (lo + hi) >> 1;
                    if (tbody.rows[mid].offsetTop + tbody.rows[mid].offsetHeight < viewTop) {
                        lo = mid + 1;
                    } else {
                        startIdx = mid;
                        hi = mid - 1;
                    }
                }
                rowsToScan = [];
                for (let r = startIdx; r < totalRows; r++) {
                    const tr = tbody.rows[r];
                    if (tr.offsetTop > viewBottom) break;
                    rowsToScan.push(tr);
                }
            }
        }

        const allRows = tbody.rows;
        const getRowHeightPx = (rTr) => (rTr ? (parseInt(rTr.style.height, 10) || rTr.offsetHeight || DEFAULT_ROW_HEIGHT) : DEFAULT_ROW_HEIGHT);
        const occupiedVerticalCells = new Set();

        for (const tr of rowsToScan) {
            if (!tr) continue;
            const rowIdx = tr.sectionRowIndex;
            const cells = tr.cells;
            const colCount = cells.length - 1;
            const occupiedCols = new Set();

            for (let c = 0; c < colCount; c++) {
                const td = cells[c + 1];
                if (!td || td.style.display === "none") continue;
                td.classList.remove("ss-text-overflow", "ss-has-content");

                const text = td.textContent;
                if (!text || text.trim() === "") {
                    unwrapOverflowSpan(td);
                    continue;
                }
                td.classList.add("ss-has-content");

                const isVertical = td.style.writingMode === "vertical-rl" || td.style.writingMode === "vertical-lr";
                if (td.style.whiteSpace === "pre-wrap" || isCellEditing(td) || td.dataset.cfIcon || Number(td.dataset.textRotation || "0") !== 0) {
                    unwrapOverflowSpan(td);
                    continue;
                }

                if (isVertical) {
                    const rowSpan = parseInt(td.getAttribute("rowspan") || "1", 10);
                    const colSpan = parseInt(td.getAttribute("colspan") || "1", 10);
                    let cellTotalH = 0;
                    for (let k = 0; k < rowSpan; k++) {
                        const spanTr = allRows[rowIdx + k];
                        if (spanTr && spanTr.style.display !== "none") {
                            cellTotalH += getRowHeightPx(spanTr);
                        }
                    }
                    let cellTotalW = 0;
                    for (let k = 0; k < colSpan; k++) {
                        cellTotalW += getColumnWidth(c + k);
                    }
                    const cellInnerH = Math.max(8, cellTotalH - 4);
                    const cellInnerW = Math.max(8, cellTotalW - 8);

                    const fSizeNum = cssFontSizeToPx(td.style.fontSize || DEFAULT_FONT_SIZE_CSS);
                    const lines = text.split("\n");
                    let maxChars = 0;
                    for (let i = 0; i < lines.length; i++) {
                        const len = Array.from(lines[i]).length;
                        if (len > maxChars) maxChars = len;
                    }
                    const estTextH = Math.ceil(maxChars * fSizeNum * 1.15);
                    const estTextW = Math.ceil(lines.length * fSizeNum * 1.35);

                    if (estTextH <= cellInnerH && estTextW <= cellInnerW) {
                        unwrapOverflowSpan(td);
                        continue;
                    }

                    const vAlign = td.style.verticalAlign === "bottom"
                        ? "bottom"
                        : (td.style.verticalAlign === "middle" ? "middle" : "top");
                    const hAlign = td.style.textAlign === "center"
                        ? "center"
                        : (td.style.textAlign === "left" ? "left" : "right");
                    const isRowFrozen = td.classList.contains("ss-frozen-row");
                    const isColFrozen = td.classList.contains("ss-frozen-col");

                    const isRowSliceEmpty = (targetRowIdx) => {
                        const targetTr = allRows[targetRowIdx];
                        if (!targetTr || targetTr.style.display === "none") return false;
                        for (let k = 0; k < colSpan; k++) {
                            const targetTd = targetTr.cells[c + k + 1];
                            if (!targetTd || targetTd.style.display === "none" || targetTd.textContent !== "") return false;
                            if (occupiedVerticalCells.has(`${targetRowIdx},${c + k}`)) return false;
                            if (isRowFrozen !== targetTd.classList.contains("ss-frozen-row")) return false;
                        }
                        return true;
                    };

                    const overflowH = Math.max(0, estTextH - cellInnerH) + 12;
                    let topSpace = 0;
                    if (estTextH > cellInnerH && (vAlign === "bottom" || vAlign === "middle")) {
                        const needT = vAlign === "middle" ? Math.ceil(overflowH / 2) : overflowH;
                        for (let ur = rowIdx - 1; ur >= 0 && topSpace < needT; ur--) {
                            if (!isRowSliceEmpty(ur)) break;
                            topSpace += getRowHeightPx(allRows[ur]);
                        }
                    }

                    let bottomSpace = 0;
                    const usedBottomRows = [];
                    if (estTextH > cellInnerH && (vAlign === "top" || vAlign === "middle")) {
                        const needB = vAlign === "middle" ? Math.ceil(overflowH / 2) : overflowH;
                        for (let dr = rowIdx + rowSpan; dr < allRows.length && bottomSpace < needB; dr++) {
                            if (!isRowSliceEmpty(dr)) break;
                            bottomSpace += getRowHeightPx(allRows[dr]);
                            usedBottomRows.push(dr);
                        }
                    }

                    // 改行付き縦書き（vertical-rl）が横幅を超えた場合は左隣の空白列へ展開
                    let leftSpace = 0;
                    if (estTextW > cellInnerW) {
                        const needL = Math.ceil(estTextW - cellInnerW) + 8;
                        for (let lc = c - 1; lc >= 0 && leftSpace < needL; lc--) {
                            if (occupiedCols.has(lc)) break;
                            let colClear = true;
                            for (let k = 0; k < rowSpan; k++) {
                                const prevTd = allRows[rowIdx + k]?.cells[lc + 1];
                                if (!prevTd || prevTd.style.display === "none" || prevTd.textContent !== "") {
                                    colClear = false;
                                    break;
                                }
                                if (!isColFrozen && prevTd.classList.contains("ss-frozen-col")) {
                                    colClear = false;
                                    break;
                                }
                            }
                            if (!colClear) break;
                            leftSpace += getColumnWidth(lc);
                        }
                    }

                    if (topSpace > 0 || bottomSpace > 0 || leftSpace > 0) {
                        usedBottomRows.forEach(dr => {
                            for (let k = 0; k < colSpan; k++) {
                                occupiedVerticalCells.add(`${dr},${c + k}`);
                            }
                        });
                        td.classList.add("ss-text-overflow");
                        wrapOverflowSpan(
                            td,
                            "left",
                            leftSpace > 0 ? Math.max(0, leftSpace - 2) : 0,
                            0,
                            {
                                vertical: true,
                                vAlign,
                                hAlign,
                                topSpace: topSpace > 0 ? Math.max(0, topSpace - 2) : 0,
                                bottomSpace: bottomSpace > 0 ? Math.max(0, bottomSpace - 2) : 0
                            }
                        );
                    } else if (vAlign === "bottom" || vAlign === "middle") {
                        wrapOverflowSpan(td, "left", 0, 0, {
                            vertical: true,
                            vAlign,
                            hAlign,
                            topSpace: 0,
                            bottomSpace: 0
                        });
                    } else {
                        unwrapOverflowSpan(td);
                    }
                    continue;
                }

                const align = td.style.textAlign || (
                    td.classList.contains("ss-auto-align-right") ? "right" :
                        td.classList.contains("ss-auto-align-center") ? "center" : "left"
                );
                if (align !== "left" && align !== "center" && align !== "right") {
                    unwrapOverflowSpan(td);
                    continue;
                }

                const colSpan = parseInt(td.getAttribute("colspan") || "1", 10);
                let cellTotalW = 0;
                for (let k = 0; k < colSpan; k++) {
                    cellTotalW += getColumnWidth(c + k);
                }
                const cellInnerW = Math.max(8, cellTotalW - 8);

                // テキスト実幅を計測し、セル内に収まっている場合はラッパー不要
                const fStyle = td.style.fontStyle || "normal";
                const fWeight = td.style.fontWeight || "normal";
                const fSize = td.style.fontSize || DEFAULT_FONT_SIZE_CSS;
                const fSizeNum = cssFontSizeToPx(fSize);
                const fFamily = td.style.fontFamily || DEFAULT_FONT_FAMILY;
                if (measureCtx) {
                    measureCtx.font = `${fStyle} ${fWeight} ${fSizeNum}px ${fFamily}`;
                }
                let maxLineW = 0;
                const lines = text.split("\n");
                for (let i = 0; i < lines.length; i++) {
                    const w = measureCtx ? measureCtx.measureText(lines[i]).width : lines[i].length * fSizeNum;
                    if (w > maxLineW) maxLineW = w;
                }

                if (maxLineW <= cellInnerW) {
                    unwrapOverflowSpan(td);
                    continue;
                }

                const overflowNeeded = Math.ceil(maxLineW - cellInnerW) + 8;
                const isColFrozen = td.classList.contains("ss-frozen-col");

                let leftSpace = 0;
                if (align === "right" || align === "center") {
                    const needL = align === "center" ? Math.ceil(overflowNeeded / 2) : overflowNeeded;
                    for (let lc = c - 1; lc >= 0 && leftSpace < needL; lc--) {
                        if (occupiedCols.has(lc)) break;
                        const prevTd = cells[lc + 1];
                        if (!prevTd || prevTd.style.display === "none" || prevTd.textContent !== "") break;
                        if (!isColFrozen && prevTd.classList.contains("ss-frozen-col")) break;
                        leftSpace += getColumnWidth(lc);
                    }
                }

                let rightSpace = 0;
                const usedRightCols = [];
                if (align === "left" || align === "center") {
                    const needR = align === "center" ? Math.ceil(overflowNeeded / 2) : overflowNeeded;
                    for (let rc = c + colSpan; rc < colCount && rightSpace < needR; rc++) {
                        const nextTd = cells[rc + 1];
                        if (!nextTd || nextTd.style.display === "none" || nextTd.textContent !== "") break;
                        rightSpace += getColumnWidth(rc);
                        usedRightCols.push(rc);
                    }
                }

                if (leftSpace > 0 || rightSpace > 0) {
                    usedRightCols.forEach(rc => occupiedCols.add(rc));
                    td.classList.add("ss-text-overflow");
                    const safeLeft = leftSpace > 0 ? Math.max(0, leftSpace - 2) : 0;
                    const safeRight = rightSpace > 0 ? Math.max(0, rightSpace - 2) : 0;
                    wrapOverflowSpan(td, align, safeLeft, safeRight);
                } else if (align === "right" || align === "center") {
                    // 隣接セルに阻まれてはみ出せない場合も、右揃え・中央揃えの基準位置を崩さず自セル内でクリップ
                    wrapOverflowSpan(td, align, 0, 0);
                } else {
                    unwrapOverflowSpan(td);
                }
            }
        }
    }

    return {
        cancelTextOverflowUpdate,
        scheduleTextOverflowUpdate,
        updateTextOverflowDisplay
    };
}