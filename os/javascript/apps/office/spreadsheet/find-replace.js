// find-replace.js
// 検索と置換ツールウィンドウ（検索・置換・すべて置換・最小化連動・破棄管理）

import { getCellReference } from "./format-utils.js";

export function createFindReplaceModule(ctx) {
    const {
        win,
        windowAPI,
        signal,
        tbody,
        getActiveCell,
        openAppModal,
        restoreMainWindowFocus,
        flushPendingEdits,
        evaluateFormula,
        setCellFormattedValue,
        clearSelection,
        setActiveCell,
        updateAllFormulas,
        updateFillHandle,
        updateSelectedCellsDisplay,
        setDirtyState,
        debouncedSaveState
    } = ctx;

    let findWin = null;
    let findDialogOpen = false;

    function isFindDialogFocused() {
        return Boolean(findWin && findWin.contains(document.activeElement));
    }

    function syncFindDialogVisibility(minimized) {
        if (!findWin || !findWin.isConnected) return;
        if (minimized) {
            findWin.style.visibility = "hidden";
        } else if (findDialogOpen) {
            findWin.style.visibility = "visible";
        }
    }

    function destroyFindDialog() {
        if (findWin) {
            if (windowAPI?.destroyWindow) {
                windowAPI.destroyWindow(findWin);
            } else if (windowAPI?.closeWindow) {
                windowAPI.closeWindow(findWin);
            } else {
                findWin.remove();
            }
            findWin = null;
            findDialogOpen = false;
        }
    }

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

                const curActive = getActiveCell();
                let startIdx = curActive ? cells.indexOf(curActive) : -1;
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
                const curActive = getActiveCell();
                if (curActive && applyReplacementToCell(curActive, opts)) {
                    setActiveCell(curActive, false);
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

            const curActive = getActiveCell();
            if (findInput && !findInput.value && curActive && curActive.textContent.trim() !== "") {
                findInput.value = curActive.textContent.trim();
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

    return {
        openFindReplaceDialog,
        isFindDialogFocused,
        syncFindDialogVisibility,
        destroyFindDialog
    };
}