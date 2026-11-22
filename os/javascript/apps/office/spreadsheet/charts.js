// charts.js
// フローティングテキストボックス・8方向リサイズ/回転ハンドル・SVGグラフ描画・設定モーダル・範囲連動スナップショット

import {
    getCellReferenceByCoord,
    parseFormattedNumber
} from "./format-utils.js";

export function escapeSvgText(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

export function computeNiceAxisMax(rawMax) {
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

export const CHART_COLOR_THEMES = {
    office: ["#1f4e78", "#c65911", "#375623", "#7030a0", "#bf8f00", "#008080", "#2f75b5", "#a61c1c"],
    warm: ["#c0392b", "#e67e22", "#f1c40f", "#d35400", "#a93226", "#f39c12", "#8e44ad", "#b7950b"],
    vivid: ["#0078d4", "#107c10", "#d13438", "#ff8c00", "#8764b8", "#00b7c3", "#e3008c", "#498205"],
    mono: ["#222222", "#555555", "#7f7f7f", "#a6a6a6", "#3b3b3b", "#6e6e6e", "#949494", "#bdbdbd"]
};

export function drawLinearTrendlineSvg(points, color) {
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

export function createChartsModule(ctx) {
    const {
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
        getSelectedRangeBounds,
        parseRangeReference,
        adjustFormula,
        updateResizeTooltip,
        hideResizeTooltip,
        refreshVisibleFloatingObjects,
        openAppModal,
        showAlert,
        setDirtyState,
        debouncedSaveState
    } = ctx;

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
        const handleSignal = box._abortController?.signal || signal;
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
            document.addEventListener("mousemove", onRotateMove, { signal: handleSignal });
            document.addEventListener("mouseup", onRotateUp, { signal: handleSignal });
        }, { signal: handleSignal });

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

                document.addEventListener("mousemove", onResizeMove, { signal: handleSignal });
                document.addEventListener("mouseup", onResizeUp, { signal: handleSignal });
            }, { signal: handleSignal });
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
        const onAppAbort = () => boxAbort.abort();
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
        }, { signal: boxSignal });

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
                removeFloatingObject(box);
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
        }, { signal: boxSignal });

        box.addEventListener("input", () => {
            setDirtyState(true);
            debouncedSaveState();
        }, { signal: boxSignal });
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
            removeFloatingObject(box);
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
            // Excel準拠：フィルターや手動操作で非表示の行はグラフから除外
            const tr = getRow(r);
            if (tr && tr.style.display === "none") continue;
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
        const ctrlSignal = chartBox._abortController?.signal || signal;
        chartBox.querySelectorAll(".floating-textbox-delete, .floating-chart-settings").forEach(el => el.remove());

        const setBtn = document.createElement("span");
        setBtn.className = "floating-chart-settings";
        setBtn.textContent = "⚙";
        setBtn.title = "グラフの種類・タイトル・範囲を設定";
        setBtn.addEventListener("mousedown", (e) => {
            e.stopPropagation();
            e.preventDefault();
            openChartSettingsDialog(chartBox);
        }, { signal: ctrlSignal });
        chartBox.appendChild(setBtn);

        const delBtn = document.createElement("span");
        delBtn.className = "floating-textbox-delete";
        delBtn.textContent = "×";
        delBtn.title = "グラフを削除";
        delBtn.addEventListener("mousedown", (e) => {
            e.stopPropagation();
            e.preventDefault();
            removeFloatingObject(chartBox);
            setDirtyState(true);
            debouncedSaveState();
        }, { signal: ctrlSignal });
        chartBox.appendChild(delBtn);

        if (!chartBox._chartDblClickBound) {
            chartBox._chartDblClickBound = true;
            chartBox.addEventListener("dblclick", (e) => {
                e.stopPropagation();
                openChartSettingsDialog(chartBox);
            }, { signal: ctrlSignal });
        }
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

    return {
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
    };
}