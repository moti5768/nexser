// format-dialogs.js
// オートフォーマット（表の自動書式設定）・セルの書式設定ダイアログ（6タブ）・縮小表示

import {
    escapeHtml,
    getCellReferenceByCoord,
    parseFormattedNumber,
    formatDisplayByNumFmt
} from "./format-utils.js";
import { clearAppliedConditionalStyle } from "./conditional-format.js";

// =========================================================
// 表のデザイン：オートフォーマット（サンプルイメージ付き）
// =========================================================
export const AUTO_FORMAT_STYLES = [
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

export function rgbToHexColor(val, fallback = "#000000") {
    if (!val) return fallback;
    const s = String(val).trim();
    if (/^#[0-9a-f]{6}$/i.test(s)) return s;
    const m = s.match(/^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/i);
    if (!m) return fallback;
    return "#" + [m[1], m[2], m[3]].map(n => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, "0")).join("");
}

export function buildAutoFormatSampleHtml(styleDef, opts) {
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

export function createFormatDialogsModule(ctx) {
    const {
        win,
        measureCtx,
        statusBarState,
        getActiveCell,
        getVisibleCell,
        getRow,
        getColumnWidth,
        getCellPureText,
        getTargetCells,
        getSelectedRangeBounds,
        detectDataBlockBounds,
        evaluateFormula,
        setCellFormattedValue,
        autoFitColumn,
        autoFitRow,
        applyConditionalFormats,
        scheduleTextOverflowUpdate,
        updateToolbarState,
        flushPendingEdits,
        openAppModal,
        openConditionalFormatManager,
        showAlert,
        setDirtyState,
        debouncedSaveState,
        renderWindowStatusBar
    } = ctx;

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
        const curActive = getActiveCell();
        const ref = (curActive && curActive.tagName === "TD") ? curActive : targetCells[0];

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
        const bounds = detectDataBlockBounds(getActiveCell()) || getSelectedRangeBounds();
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

    return {
        applyAutoFormatToBounds,
        applyShrinkToFit,
        openFormatCellsModal,
        openAutoFormatDialog
    };
}