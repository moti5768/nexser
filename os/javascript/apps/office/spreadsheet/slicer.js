// slicer.js
// Excel準拠 スライサー機能（挿入ダイアログ・単一/複数/範囲選択・クロスフィルター減光・移動/リサイズ・デザイン設定・永続化）

import { escapeHtml, getColumnName } from "./format-utils.js";

export const SLICER_THEMES = {
    blue: { label: "ブルー (標準)", accent: "#1f4e78", border: "#8ea9db", activeBg: "#4472c4", activeFg: "#ffffff", idleBg: "#d9e1f2", idleFg: "#1a1a1a" },
    green: { label: "グリーン", accent: "#107c41", border: "#a9d08e", activeBg: "#217346", activeFg: "#ffffff", idleBg: "#e2efda", idleFg: "#1a1a1a" },
    orange: { label: "オレンジ", accent: "#c65911", border: "#f4b084", activeBg: "#ed7d31", activeFg: "#ffffff", idleBg: "#fce4d6", idleFg: "#1a1a1a" },
    purple: { label: "パープル", accent: "#7030a0", border: "#c5a3e0", activeBg: "#7030a0", activeFg: "#ffffff", idleBg: "#efe5f7", idleFg: "#1a1a1a" },
    gray: { label: "グレー", accent: "#595959", border: "#a6a6a6", activeBg: "#767171", activeFg: "#ffffff", idleBg: "#ededed", idleFg: "#1a1a1a" },
    dark: { label: "ダーク", accent: "#1f2937", border: "#4b5563", activeBg: "#374151", activeFg: "#ffffff", idleBg: "#e5e7eb", idleFg: "#111827" }
};

export function createSlicerModule(ctx) {
    const {
        win,
        signal,
        container,
        spreadsheetContent,
        tbody,
        statusBarState,
        getActiveCell,
        getVisibleCell,
        getSelectedRangeBounds,
        detectDataBlockBounds,
        findTableAtCoord,
        getAutoFilterById,
        getAutoFilterByTableId,
        getAutoFilterAtCoord,
        findActiveAutoFilterForCell,
        addAutoFilterForRange,
        applyAutoFilterRows,
        isRowMatchingOtherFilters,
        openAppModal,
        showAlert,
        updateResizeTooltip,
        hideResizeTooltip,
        renderWindowStatusBar,
        setDirtyState,
        debouncedSaveState
    } = ctx;

    let slicers = []; // Array<{ id, filterId, tableId, headerRow, colIdx, caption, left, top, width, height, columns, theme, multiSelect, lastClickedVal }>
    const slicerDomMap = new Map(); // id -> HTMLElement

    function hasSlicers() {
        return slicers.length > 0;
    }

    function selectSlicer(targetEl) {
        spreadsheetContent.querySelectorAll(".floating-slicer.obj-selected").forEach(el => {
            if (el !== targetEl) el.classList.remove("obj-selected");
        });
        if (targetEl) targetEl.classList.add("obj-selected");
    }

    tbody.addEventListener("mousedown", () => {
        selectSlicer(null);
    }, { signal });

    function resolveTargetAutoFilter(slicer) {
        if (!slicer) return null;
        let af = slicer.filterId ? getAutoFilterById?.(slicer.filterId) : null;
        if (!af && slicer.tableId) {
            af = getAutoFilterByTableId?.(slicer.tableId) || null;
        }
        if (!af && Number.isFinite(slicer.headerRow) && Number.isFinite(slicer.colIdx)) {
            af = getAutoFilterAtCoord?.(slicer.headerRow, slicer.colIdx) || null;
        }
        if (af) {
            slicer.filterId = af.id;
            slicer.tableId = af.tableId || null;
            slicer.headerRow = af.headerRow;
        }
        return af;
    }

    function collectSlicerItems(af, colIdx) {
        if (!af) return { items: [], availableSet: new Set() };
        const startR = af.headerRow + 1;
        const endR = Math.min(af.maxRow, tbody.rows.length);
        const uniqueSet = new Set();
        const availableSet = new Set();

        for (let r = startR; r <= endR; r++) {
            const cell = getVisibleCell(r, colIdx);
            const val = (cell?.textContent ?? "").trim();
            uniqueSet.add(val);
            if (!availableSet.has(val) && isRowMatchingOtherFilters(af, r, colIdx)) {
                availableSet.add(val);
            }
        }

        const collator = new Intl.Collator("ja", { numeric: true, sensitivity: "base" });
        const allSorted = Array.from(uniqueSet).sort((a, b) => {
            if (a === "" && b !== "") return 1;
            if (a !== "" && b === "") return -1;
            return collator.compare(a, b);
        });

        // Excel準拠：他フィルター条件下でデータが存在する項目を上位に、該当なし項目を下位へ配置
        const withData = [];
        const noData = [];
        for (const v of allSorted) {
            if (availableSet.has(v)) withData.push(v);
            else noData.push(v);
        }
        return {
            items: [...withData, ...noData],
            availableSet
        };
    }

    function applySlicerThemeVars(box, themeKey) {
        const theme = SLICER_THEMES[themeKey] || SLICER_THEMES.blue;
        box.style.setProperty("--sl-accent", theme.accent);
        box.style.setProperty("--sl-border", theme.border);
        box.style.setProperty("--sl-active-bg", theme.activeBg);
        box.style.setProperty("--sl-active-fg", theme.activeFg);
        box.style.setProperty("--sl-idle-bg", theme.idleBg);
        box.style.setProperty("--sl-idle-fg", theme.idleFg);
    }

    function renderSlicerBody(slicer) {
        const box = slicerDomMap.get(slicer.id);
        if (!box || !box.isConnected) return;

        applySlicerThemeVars(box, slicer.theme);
        const titleEl = box.querySelector(".ss-slicer-title");
        if (titleEl) titleEl.textContent = slicer.caption;

        const multiBtn = box.querySelector(".ss-slicer-multi-btn");
        if (multiBtn) multiBtn.classList.toggle("active", Boolean(slicer.multiSelect));

        const af = resolveTargetAutoFilter(slicer);
        const clearBtn = box.querySelector(".ss-slicer-clear-btn");
        const bodyEl = box.querySelector(".ss-slicer-body");
        if (!bodyEl) return;

        if (!af || slicer.colIdx < af.minCol || slicer.colIdx > af.maxCol) {
            if (clearBtn) clearBtn.classList.add("disabled");
            bodyEl.style.gridTemplateColumns = "1fr";
            bodyEl.innerHTML = `<div class="ss-slicer-empty">対象のテーブル／フィルターが解除されました</div>`;
            return;
        }

        const isColFiltered = af.filters.has(slicer.colIdx) || Boolean(af.conditions?.has(slicer.colIdx));
        if (clearBtn) clearBtn.classList.toggle("disabled", !isColFiltered);

        const { items, availableSet } = collectSlicerItems(af, slicer.colIdx);
        const activeFilterSet = af.filters.get(slicer.colIdx) || null;
        const cols = Math.max(1, Math.min(4, Number(slicer.columns) || 1));
        bodyEl.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;

        if (!items.length) {
            bodyEl.innerHTML = `<div class="ss-slicer-empty">(項目がありません)</div>`;
            return;
        }

        const frag = document.createDocumentFragment();
        items.forEach((val) => {
            const isSelected = activeFilterSet ? activeFilterSet.has(val) : true;
            const hasData = availableSet.has(val);
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "ss-slicer-item" + (isSelected ? " selected" : "") + (!hasData ? " no-data" : "");
            btn.dataset.val = val;
            btn.textContent = val === "" ? "(空白)" : val;
            btn.title = `${btn.textContent}${!hasData ? "（現在の条件では該当データなし）" : ""}`;
            frag.appendChild(btn);
        });
        bodyEl.innerHTML = "";
        bodyEl.appendChild(frag);
    }

    function refreshAllSlicers() {
        if (!slicers.length) return;
        for (let i = 0; i < slicers.length; i++) {
            renderSlicerBody(slicers[i]);
        }
    }

    function handleSlicerItemClick(slicer, val, ev) {
        const af = resolveTargetAutoFilter(slicer);
        if (!af) return;

        const { items } = collectSlicerItems(af, slicer.colIdx);
        if (!items.length) return;
        const curSet = af.filters.get(slicer.colIdx) || null;

        let nextSet;
        if (ev.shiftKey && slicer.lastClickedVal !== null && items.includes(slicer.lastClickedVal)) {
            const i1 = items.indexOf(slicer.lastClickedVal);
            const i2 = items.indexOf(val);
            const slice = items.slice(Math.min(i1, i2), Math.max(i1, i2) + 1);
            nextSet = new Set(slice);
        } else if (slicer.multiSelect || ev.ctrlKey || ev.metaKey) {
            nextSet = curSet ? new Set(curSet) : new Set(items);
            if (nextSet.has(val)) {
                nextSet.delete(val);
            } else {
                nextSet.add(val);
            }
            slicer.lastClickedVal = val;
        } else {
            nextSet = new Set([val]);
            slicer.lastClickedVal = val;
        }

        if (nextSet.size === 0 || nextSet.size >= items.length) {
            af.filters.delete(slicer.colIdx);
        } else {
            af.filters.set(slicer.colIdx, nextSet);
        }

        applyAutoFilterRows();
        setDirtyState(true);
        debouncedSaveState();
    }

    function removeSlicerById(slicerId) {
        const idx = slicers.findIndex(s => s.id === slicerId);
        if (idx !== -1) slicers.splice(idx, 1);
        const box = slicerDomMap.get(slicerId);
        if (box) {
            box._abortController?.abort();
            box._abortController = null;
            box.remove();
            slicerDomMap.delete(slicerId);
        }
    }

    function clearAllSlicers() {
        slicerDomMap.forEach((box) => {
            box._abortController?.abort();
            box._abortController = null;
            box.remove();
        });
        slicerDomMap.clear();
        slicers = [];
    }

    function openSlicerSettingsDialog(slicer) {
        const themeOpts = Object.entries(SLICER_THEMES)
            .map(([k, t]) => `<option value="${k}" ${slicer.theme === k ? "selected" : ""}>${escapeHtml(t.label)}</option>`)
            .join("");

        const bodyHtml = `
            <div style="width:100%; display:flex; flex-direction:column; gap:8px; font-size:12px;">
                <label>見出し（キャプション）:
                    <input type="text" class="ss-sl-cfg-caption border" value="${escapeHtml(slicer.caption)}" style="width:100%; height:24px; margin-top:2px; padding:2px 6px; background:#fff; color:#000;">
                </label>
                <div style="display:flex; gap:8px;">
                    <label style="flex:1;">デザイン テーマ:
                        <select class="ss-sl-cfg-theme border" style="width:100%; height:24px; margin-top:2px; background:#fff; color:#000;">
                            ${themeOpts}
                        </select>
                    </label>
                    <label style="width:95px;">ボタン列数:
                        <input type="number" class="ss-sl-cfg-cols border" min="1" max="4" value="${slicer.columns || 1}" style="width:100%; height:24px; margin-top:2px; padding:2px 5px; background:#fff; color:#000;">
                    </label>
                </div>
            </div>
        `;

        const modal = openAppModal("スライサーの設定", bodyHtml, {
            width: 360,
            isHtml: true,
            parentWin: win,
            buttons: [
                {
                    label: "OK",
                    onClick: () => {
                        const nextCap = modal.querySelector(".ss-sl-cfg-caption")?.value.trim();
                        const nextTheme = modal.querySelector(".ss-sl-cfg-theme")?.value || "blue";
                        const nextCols = Math.max(1, Math.min(4, Math.trunc(Number(modal.querySelector(".ss-sl-cfg-cols")?.value) || 1)));
                        if (nextCap) slicer.caption = nextCap;
                        slicer.theme = nextTheme;
                        slicer.columns = nextCols;
                        renderSlicerBody(slicer);
                        setDirtyState(true);
                        debouncedSaveState();
                    }
                },
                {
                    label: "スライサーを削除",
                    onClick: () => {
                        removeSlicerById(slicer.id);
                        setDirtyState(true);
                        debouncedSaveState();
                    }
                },
                { label: "キャンセル" }
            ]
        });
        modal?.querySelector(".ss-sl-cfg-caption")?.focus();
    }

    function mountSlicerElement(slicer) {
        const box = document.createElement("div");
        box.tabIndex = 0;
        box.className = "floating-slicer";
        box.dataset.slicerId = slicer.id;
        box.dataset.initialLeft = String(Math.round(slicer.left));
        box.dataset.initialTop = String(Math.round(slicer.top));
        Object.assign(box.style, {
            left: `${Math.round(slicer.left)}px`,
            top: `${Math.round(slicer.top)}px`,
            width: `${Math.round(slicer.width)}px`,
            height: `${Math.round(slicer.height)}px`
        });

        box.innerHTML = `
            <div class="ss-slicer-header">
                <span class="ss-slicer-title">${escapeHtml(slicer.caption)}</span>
                <div class="ss-slicer-ctrls">
                    <button type="button" class="ss-slicer-ctrl ss-slicer-multi-btn" title="複数選択モードの切替（または Ctrl+クリック）">☑</button>
                    <button type="button" class="ss-slicer-ctrl ss-slicer-clear-btn" title="この列のフィルターをクリア">✕</button>
                    <button type="button" class="ss-slicer-ctrl ss-slicer-cfg-btn" title="スライサーの設定（色・列数・見出し）">⚙</button>
                    <button type="button" class="ss-slicer-ctrl ss-slicer-del-btn" title="スライサーを削除">×</button>
                </div>
            </div>
            <div class="ss-slicer-body"></div>
            <div class="ss-slicer-resizer" title="ドラッグでサイズ変更"></div>
        `;

        const boxAbort = new AbortController();
        box._abortController = boxAbort;
        const boxSignal = boxAbort.signal;
        const onAppAbort = () => boxAbort.abort();
        signal.addEventListener("abort", onAppAbort, { once: true });
        boxSignal.addEventListener("abort", () => {
            signal.removeEventListener("abort", onAppAbort);
        }, { once: true });

        // ヘッダーボタン制御
        box.querySelector(".ss-slicer-multi-btn").addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            slicer.multiSelect = !slicer.multiSelect;
            renderSlicerBody(slicer);
        }, { signal: boxSignal });

        box.querySelector(".ss-slicer-clear-btn").addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const af = resolveTargetAutoFilter(slicer);
            if (!af) return;
            af.filters.delete(slicer.colIdx);
            af.conditions?.delete(slicer.colIdx);
            slicer.lastClickedVal = null;
            applyAutoFilterRows();
            setDirtyState(true);
            debouncedSaveState();
        }, { signal: boxSignal });

        box.querySelector(".ss-slicer-cfg-btn").addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            openSlicerSettingsDialog(slicer);
        }, { signal: boxSignal });

        box.querySelector(".ss-slicer-del-btn").addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            removeSlicerById(slicer.id);
            setDirtyState(true);
            debouncedSaveState();
        }, { signal: boxSignal });

        // 項目ボタンクリック
        box.querySelector(".ss-slicer-body").addEventListener("mousedown", (e) => {
            const btn = e.target.closest(".ss-slicer-item");
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();
            selectSlicer(box);
            box.focus({ preventScroll: true });
            handleSlicerItemClick(slicer, btn.dataset.val, e);
        }, { signal: boxSignal });

        // ドラッグ移動（ヘッダーおよび枠外周）
        box.addEventListener("mousedown", (e) => {
            if (e.button !== 0) return;
            selectSlicer(box);
            if (e.target.closest(".ss-slicer-ctrl, .ss-slicer-item, .ss-slicer-resizer")) return;
            e.preventDefault();
            e.stopPropagation();
            box.focus({ preventScroll: true });

            const zoom = parseFloat(spreadsheetContent.style.zoom || "1") || 1;
            const startX = e.clientX;
            const startY = e.clientY;
            const origLeft = slicer.left;
            const origTop = slicer.top;
            let moved = false;

            const onMove = (ev) => {
                const dx = (ev.clientX - startX) / zoom;
                const dy = (ev.clientY - startY) / zoom;
                if (!moved && Math.hypot(dx, dy) < 2) return;
                moved = true;
                slicer.left = Math.max(0, Math.round(origLeft + dx));
                slicer.top = Math.max(0, Math.round(origTop + dy));
                box.dataset.initialLeft = String(slicer.left);
                box.dataset.initialTop = String(slicer.top);
                box.style.left = `${slicer.left}px`;
                box.style.top = `${slicer.top}px`;
            };
            const onUp = () => {
                document.removeEventListener("mousemove", onMove);
                document.removeEventListener("mouseup", onUp);
                if (moved) {
                    setDirtyState(true);
                    debouncedSaveState();
                }
            };
            document.addEventListener("mousemove", onMove, { signal: boxSignal });
            document.addEventListener("mouseup", onUp, { signal: boxSignal });
        }, { signal: boxSignal });

        // 右下リサイズハンドル
        box.querySelector(".ss-slicer-resizer").addEventListener("mousedown", (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            selectSlicer(box);
            const zoom = parseFloat(spreadsheetContent.style.zoom || "1") || 1;
            const startX = e.clientX;
            const startY = e.clientY;
            const origW = slicer.width;
            const origH = slicer.height;

            const onMove = (ev) => {
                slicer.width = Math.max(150, Math.round(origW + (ev.clientX - startX) / zoom));
                slicer.height = Math.max(120, Math.round(origH + (ev.clientY - startY) / zoom));
                box.style.width = `${slicer.width}px`;
                box.style.height = `${slicer.height}px`;
                updateResizeTooltip?.(ev.clientX, ev.clientY, `${slicer.width} × ${slicer.height}px`);
            };
            const onUp = () => {
                document.removeEventListener("mousemove", onMove);
                document.removeEventListener("mouseup", onUp);
                hideResizeTooltip?.();
                setDirtyState(true);
                debouncedSaveState();
            };
            document.addEventListener("mousemove", onMove, { signal: boxSignal });
            document.addEventListener("mouseup", onUp, { signal: boxSignal });
        }, { signal: boxSignal });

        // キーボード微調整・削除
        box.addEventListener("keydown", (e) => {
            if (e.key === "Delete" || e.key === "Backspace") {
                e.preventDefault();
                e.stopPropagation();
                removeSlicerById(slicer.id);
                setDirtyState(true);
                debouncedSaveState();
            } else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
                e.preventDefault();
                e.stopPropagation();
                const step = e.shiftKey ? 10 : 2;
                if (e.key === "ArrowLeft") slicer.left = Math.max(0, slicer.left - step);
                if (e.key === "ArrowRight") slicer.left += step;
                if (e.key === "ArrowUp") slicer.top = Math.max(0, slicer.top - step);
                if (e.key === "ArrowDown") slicer.top += step;
                box.dataset.initialLeft = String(slicer.left);
                box.dataset.initialTop = String(slicer.top);
                box.style.left = `${slicer.left}px`;
                box.style.top = `${slicer.top}px`;
                setDirtyState(true);
                debouncedSaveState();
            }
        }, { signal: boxSignal });

        spreadsheetContent.appendChild(box);
        slicerDomMap.set(slicer.id, box);
        renderSlicerBody(slicer);
        return box;
    }

    function openInsertSlicerDialog() {
        const activeCell = getActiveCell();
        let targetAf = findActiveAutoFilterForCell?.(activeCell) || null;

        if (!targetAf) {
            const bounds = detectDataBlockBounds?.(activeCell) || getSelectedRangeBounds?.();
            if (!bounds || bounds.maxRow <= bounds.minRow) {
                showAlert("スライサーを作成する表（見出し行＋1行以上のデータ）内のセルを選択してください。", "スライサーの挿入");
                return;
            }
            const tbl = findTableAtCoord?.(bounds.minRow, bounds.minCol);
            if (tbl && tbl.hasHeader) {
                targetAf = addAutoFilterForRange({
                    headerRow: tbl.minRow,
                    minCol: tbl.minCol,
                    maxCol: tbl.maxCol,
                    maxRow: tbl.hasTotalRow ? tbl.maxRow - 1 : tbl.maxRow,
                    tableId: tbl.id
                });
            } else {
                targetAf = addAutoFilterForRange({
                    headerRow: bounds.minRow,
                    minCol: bounds.minCol,
                    maxCol: bounds.maxCol,
                    maxRow: bounds.maxRow,
                    tableId: null
                });
            }
        }

        if (!targetAf) {
            showAlert("スライサーの対象となるフィルター範囲を作成できませんでした。", "スライサーの挿入");
            return;
        }

        const fields = [];
        for (let c = targetAf.minCol; c <= targetAf.maxCol; c++) {
            const hCell = getVisibleCell(targetAf.headerRow, c);
            const label = (hCell?.textContent ?? "").trim() || `列 ${getColumnName(c)}`;
            fields.push({ col: c, label });
        }

        const themeOpts = Object.entries(SLICER_THEMES)
            .map(([k, t]) => `<option value="${k}">${escapeHtml(t.label)}</option>`)
            .join("");

        const bodyHtml = `
            <div style="width:100%; display:flex; flex-direction:column; gap:8px; font-size:12px;">
                <div>スライサーを作成する列（フィールド）を選択してください:</div>
                <div class="border" style="max-height:180px; overflow-y:auto; background:#fff; padding:6px; display:flex; flex-direction:column; gap:4px;">
                    ${fields.map((f, idx) => `
                        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                            <input type="checkbox" class="ss-ins-sl-chk" value="${f.col}" data-label="${escapeHtml(f.label)}" ${idx === 0 ? "checked" : ""}>
                            <span>${escapeHtml(f.label)}</span>
                        </label>
                    `).join("")}
                </div>
                <div style="display:flex; gap:8px;">
                    <label style="flex:1;">スタイル:
                        <select class="ss-ins-sl-theme border" style="width:100%; height:24px; margin-top:2px; background:#fff; color:#000;">
                            ${themeOpts}
                        </select>
                    </label>
                    <label style="width:95px;">ボタン列数:
                        <input type="number" class="ss-ins-sl-cols border" min="1" max="4" value="1" style="width:100%; height:24px; margin-top:2px; padding:2px 5px; background:#fff; color:#000;">
                    </label>
                </div>
            </div>
        `;

        const modal = openAppModal("スライサーの挿入", bodyHtml, {
            width: 380,
            isHtml: true,
            parentWin: win,
            buttons: [
                {
                    label: "OK",
                    onClick: () => {
                        const checked = Array.from(modal.querySelectorAll(".ss-ins-sl-chk:checked"));
                        if (!checked.length) {
                            showAlert("スライサーを作成する列を1つ以上選択してください。", "スライサーの挿入");
                            return;
                        }
                        const theme = modal.querySelector(".ss-ins-sl-theme")?.value || "blue";
                        const columns = Math.max(1, Math.min(4, Math.trunc(Number(modal.querySelector(".ss-ins-sl-cols")?.value) || 1)));
                        const zoom = parseFloat(spreadsheetContent.style.zoom || "1") || 1;
                        const baseLeft = Math.round(container.scrollLeft / zoom + 140);
                        const baseTop = Math.round(container.scrollTop / zoom + 60);

                        let lastBox = null;
                        checked.forEach((chk, i) => {
                            const colIdx = Number(chk.value);
                            const caption = chk.dataset.label || `列 ${getColumnName(colIdx)}`;
                            const slicer = {
                                id: `sl_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
                                filterId: targetAf.id,
                                tableId: targetAf.tableId || null,
                                headerRow: targetAf.headerRow,
                                colIdx,
                                caption,
                                left: baseLeft + i * 24,
                                top: baseTop + i * 24,
                                width: columns > 1 ? Math.min(340, 120 * columns) : 195,
                                height: 220,
                                columns,
                                theme,
                                multiSelect: false,
                                lastClickedVal: null
                            };
                            slicers.push(slicer);
                            lastBox = mountSlicerElement(slicer);
                        });

                        if (lastBox) selectSlicer(lastBox);
                        statusBarState.stateText = `スライサーを ${checked.length} 件作成しました`;
                        renderWindowStatusBar();
                        setDirtyState(true);
                        debouncedSaveState();
                    }
                },
                { label: "キャンセル" }
            ]
        });
    }

    function shiftSlicersForMove(srcBounds, rowDelta, colDelta) {
        if (!srcBounds || !slicers.length || (rowDelta === 0 && colDelta === 0)) return;
        let changed = false;
        slicers.forEach(s => {
            if (
                s.headerRow >= srcBounds.minRow && s.headerRow <= srcBounds.maxRow &&
                s.colIdx >= srcBounds.minCol && s.colIdx <= srcBounds.maxCol
            ) {
                s.headerRow = Math.max(1, s.headerRow + rowDelta);
                s.colIdx = Math.max(0, s.colIdx + colDelta);
                changed = true;
            }
        });
        if (changed) refreshAllSlicers();
    }

    function serializeSlicers() {
        return slicers.map(s => ({
            id: s.id,
            filterId: s.filterId || null,
            tableId: s.tableId || null,
            headerRow: s.headerRow,
            colIdx: s.colIdx,
            caption: s.caption,
            left: s.left,
            top: s.top,
            width: s.width,
            height: s.height,
            columns: s.columns || 1,
            theme: s.theme || "blue",
            multiSelect: Boolean(s.multiSelect)
        }));
    }

    function restoreSlicers(sheetData) {
        clearAllSlicers();
        const rawList = Array.isArray(sheetData?.slicers) ? sheetData.slicers : [];
        if (!rawList.length) return;
        rawList.forEach((raw, idx) => {
            const slicer = {
                id: raw.id || `sl_restored_${Date.now()}_${idx}`,
                filterId: raw.filterId || null,
                tableId: raw.tableId || null,
                headerRow: Number(raw.headerRow) || 1,
                colIdx: Number(raw.colIdx) || 0,
                caption: String(raw.caption || `列 ${getColumnName(Number(raw.colIdx) || 0)}`),
                left: Number(raw.left) || 140,
                top: Number(raw.top) || 60,
                width: Math.max(150, Number(raw.width) || 195),
                height: Math.max(120, Number(raw.height) || 220),
                columns: Math.max(1, Math.min(4, Number(raw.columns) || 1)),
                theme: SLICER_THEMES[raw.theme] ? raw.theme : "blue",
                multiSelect: Boolean(raw.multiSelect),
                lastClickedVal: null
            };
            slicers.push(slicer);
            mountSlicerElement(slicer);
        });
    }

    signal.addEventListener("abort", () => {
        clearAllSlicers();
    }, { once: true });

    return {
        hasSlicers,
        openInsertSlicerDialog,
        refreshAllSlicers,
        shiftSlicersForMove,
        serializeSlicers,
        restoreSlicers,
        clearAllSlicers
    };
}