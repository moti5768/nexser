//spreadsheet.js
import { FS, forceSave, lockFile, unlockFile, setBulkUpdating } from "../fs.js";
import { getFileContent } from "../fs-db.js";
import { resolveFS, normalizePath, basename, validateName, isSystemMetaKey } from "../fs-utils.js";
import { attachContextMenu, hideContextMenu } from "../context-menu.js";

const STYLE_ELEMENT_ID = "nexser-spreadsheet-scoped-styles";

const SCOPED_CSS = `
.nexser-spreadsheet-app {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    touch-action: none;
    overscroll-behavior: contain;
    font-family: 'MS PGothic', 'MS Gothic', sans-serif;
    background-color: #C3C7CB;
    color: #000;
    position: relative;
    box-sizing: border-box;
    outline: none;
}
.nexser-spreadsheet-app *,
.nexser-spreadsheet-app *::before,
.nexser-spreadsheet-app *::after {
    box-sizing: border-box;
}

/* ----- クイックアクセスツールバー & Excel準拠リボン（スリム版） ----- */
.nexser-spreadsheet-app .ss-ribbon-shell {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    background-color: #C3C7CB;
    border-bottom: 1px solid #808080;
    user-select: none;
}

.nexser-spreadsheet-app .ss-qat-and-tabs {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    padding: 1px 4px 0 4px;
    background-color: #107c41;
    color: #fff;
    min-height: 22px;
}

.nexser-spreadsheet-app .ss-qat-bar {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding-bottom: 1px;
    flex-shrink: 0;
}

.nexser-spreadsheet-app .ss-qat-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 18px;
    padding: 0 5px;
    font-size: 11px;
    font-weight: bold;
    color: #fff;
    background: rgba(255, 255, 255, 0.14);
    border: 1px solid rgba(255, 255, 255, 0.28);
    cursor: pointer;
    white-space: nowrap;
}
.nexser-spreadsheet-app .ss-qat-btn:hover {
    background: rgba(255, 255, 255, 0.26);
}
.nexser-spreadsheet-app .ss-qat-btn.disabled {
    opacity: 0.45;
    pointer-events: none;
}

.nexser-spreadsheet-app .ss-ribbon-tabs {
    display: inline-flex;
    align-items: flex-end;
    gap: 1px;
    flex-wrap: nowrap;
}

.nexser-spreadsheet-app .ss-ribbon-tab {
    padding: 2px 9px;
    font-size: 11px;
    font-weight: bold;
    color: #fff;
    background: transparent;
    border: 1px solid transparent;
    border-bottom: none;
    cursor: pointer;
    white-space: nowrap;
}
.nexser-spreadsheet-app .ss-ribbon-tab:hover:not(.active) {
    background: rgba(255, 255, 255, 0.16);
}
.nexser-spreadsheet-app .ss-ribbon-tab.active {
    background-color: #C3C7CB;
    color: #107c41;
    border-color: #fff #404040 #C3C7CB #fff;
    position: relative;
    top: 1px;
}

.nexser-spreadsheet-app .ss-ribbon-panels {
    padding: 2px 4px;
    background-color: #C3C7CB;
    min-height: 36px;
    display: flex;
    align-items: stretch;
}
.nexser-spreadsheet-app .ss-ribbon-shell.collapsed .ss-ribbon-panels {
    display: none;
}

.nexser-spreadsheet-app .ss-ribbon-panel {
    display: none;
    flex-wrap: wrap;
    align-items: stretch;
    gap: 2px;
    width: 100%;
}
.nexser-spreadsheet-app .ss-ribbon-panel.active {
    display: flex;
}

.nexser-spreadsheet-app .ss-ribbon-group {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 1px 4px;
    border-right: 1px solid #808080;
    box-shadow: 1px 0 0 #fff;
    gap: 1px;
}
.nexser-spreadsheet-app .ss-ribbon-group:last-child {
    border-right: none;
    box-shadow: none;
}

.nexser-spreadsheet-app .ss-ribbon-group-body {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: 2px;
    min-height: 22px;
}

.nexser-spreadsheet-app .ss-ribbon-group-title {
    font-size: 9px;
    color: #444;
    text-align: center;
    line-height: 1;
}

.nexser-spreadsheet-app .ss-ribbon-group-body label {
    margin-right: 1px;
    font-size: 11px;
    display: inline-flex;
    align-items: center;
}

/* リボン内のボタン・セレクトをスリム化 */
.nexser-spreadsheet-app .ss-ribbon-panels .button:not(th) {
    padding: 1px 4px;
    min-height: 20px;
    font-size: 11px;
}
.nexser-spreadsheet-app .ss-ribbon-panels select.ss-font-size {
    height: 20px;
    font-size: 11px;
}

/* スウォッチコンテナ：横8個のグリッド */
.nexser-spreadsheet-app .swatch-container {
    display: grid;
    grid-template-columns: repeat(8, 22px);
    gap: 3px;
    padding: 4px;
}

.nexser-spreadsheet-app .color-swatch:not(.button) {
    width: 22px;
    height: 22px;
    cursor: pointer;
    border: solid 1px;
    border-color: #eee #333 #333 #eee;
}

.nexser-spreadsheet-app .color-swatch.button {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 4px;
    height: 24px;
    width: 100%;
}

.nexser-spreadsheet-app .ss-color-picker label {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-top: 5px;
    font-size: 12px;
}

/* ----- 下段：数式バー ----- */
.nexser-spreadsheet-app .ss-formula-bar-container {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 1px 3px;
    background-color: #C3C7CB;
    border-bottom: 1px solid #808080;
    flex-shrink: 0;
    gap: 3px;
}

.nexser-spreadsheet-app .ss-selected-cells-display {
    font-weight: bold;
    width: 100px;
    height: 22px;
    line-height: 18px;
    text-align: center;
    padding: 1px 4px;
    background-color: #fff;
    color: #000;
    font-size: 11px;
    outline: none;
    flex-shrink: 0;
}
.nexser-spreadsheet-app .ss-selected-cells-display:focus {
    outline: 2px solid #107c41;
    outline-offset: -2px;
}

/* オートフィルターボタン＆ポップアップ */
.nexser-spreadsheet-app .ss-filter-arrow {
    position: absolute;
    right: 2px;
    bottom: 2px;
    width: 15px;
    height: 15px;
    line-height: 13px;
    text-align: center;
    font-size: 9px;
    background: #e1e4e8;
    border: 1px solid #808080;
    color: #222;
    cursor: pointer;
    z-index: 9;
    user-select: none;
}
.nexser-spreadsheet-app .ss-filter-arrow.filtered {
    background: #107c41;
    color: #fff;
    border-color: #0b5a2f;
}
.nexser-spreadsheet-app .ss-filter-dropdown {
    position: fixed;
    width: 220px;
    background: #C3C7CB;
    border: 1px solid;
    border-color: #fff #404040 #404040 #fff;
    box-shadow: 2px 2px 6px rgba(0, 0, 0, 0.35);
    padding: 6px;
    font-size: 12px;
    z-index: 99995;
    display: flex;
    flex-direction: column;
    gap: 5px;
}
.nexser-spreadsheet-app .ss-filter-values-list {
    max-height: 160px;
    overflow-y: auto;
    background: #fff;
    border: 1px solid #808080;
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 3px;
}
.nexser-spreadsheet-app .ss-formula-bar {
    flex: 1;
    min-width: 0;
    width: 100%;
    height: 22px;
    font-size: 13px;
    padding: 1px 6px;
    outline: none;
    background: #fff;
    color: #000;
}

/* ----- スプレッドシート本体（横スクロールバーは下部タブバーへ分離） ----- */
.nexser-spreadsheet-app .ss-spreadsheet-container {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    width: 100%;
    border-left: 1px solid #808080;
    border-right: 1px solid #808080;
    background-color: #fff;
    overflow-y: auto;
    overflow-x: hidden;
    position: relative;
}

.nexser-spreadsheet-app .ss-spreadsheet-content {
    transform-origin: top left;
    display: block;
    width: fit-content;
    position: relative;
}

.nexser-spreadsheet-app .ss-table {
    border-collapse: collapse;
    table-layout: fixed;
    background-color: #fff;
}

.nexser-spreadsheet-app .ss-table tr {
    height: 30px;
}

.nexser-spreadsheet-app .ss-table th,
.nexser-spreadsheet-app .ss-table td {
    height: inherit;
    padding: 0 4px;
    text-align: left;
    white-space: pre;
    position: relative;
    font-size: 14px;
    user-select: none;
    -webkit-user-select: none;
}

.nexser-spreadsheet-app .ss-table td[contenteditable="true"] {
    user-select: text;
    -webkit-user-select: text;
}

.nexser-spreadsheet-app .ss-table th {
    overflow: visible;
    vertical-align: middle;
}

.nexser-spreadsheet-app .ss-table td {
    overflow: hidden;
    text-overflow: clip;
    cursor: cell;
    border: 1px solid #d0d0d0;
    color: #000;
    background-color: #fff;
    outline: none;
}

.nexser-spreadsheet-app .ss-table td.ss-text-overflow {
    overflow: visible;
    z-index: 2;
}

.nexser-spreadsheet-app .ss-table td.ss-has-content {
    z-index: 3;
}

.nexser-spreadsheet-app .ss-table td.ss-auto-align-right {
    text-align: right;
}

.nexser-spreadsheet-app .ss-table td.ss-auto-align-center {
    text-align: center;
}

.nexser-spreadsheet-app .ss-table td {
    contain: layout style;
}

.nexser-spreadsheet-app .ss-table thead th {
    font-weight: bold;
    position: sticky;
    top: 0;
    z-index: 13;
    box-shadow: inset 0 0 0 1px dimgray;
    text-align: center;
    font-size: 13px;
    background-color: #C3C7CB;
    will-change: transform;
}

.nexser-spreadsheet-app .ss-table thead th.ss-corner {
    left: 0;
    z-index: 17;
    cursor: cell;
    text-align: center;
}

.nexser-spreadsheet-app .ss-table tbody th.row_number {
    position: sticky;
    left: 0;
    z-index: 13;
    box-shadow: inset 0 0 0 1px dimgray;
    text-align: right;
    padding-right: 6px;
    font-size: 13px;
    background-color: #C3C7CB;
    cursor: e-resize;
    will-change: transform;
}

.nexser-spreadsheet-app .ss-table thead th.col_number {
    cursor: s-resize;
}

/* 選択状態のオーバーレイ（罫線と干渉しないインセット描画） */
.nexser-spreadsheet-app .ss-table td.selected {
    z-index: 4;
}

.nexser-spreadsheet-app .ss-table td.selected::after {
    content: "";
    position: absolute;
    inset: 0;
    background-color: rgba(70, 130, 180, 0.18);
    pointer-events: none;
    z-index: 3;
}

.nexser-spreadsheet-app .ss-table td.active-cell {
    z-index: 5;
}

.nexser-spreadsheet-app .ss-table td.active-cell::after {
    background-color: rgba(70, 130, 180, 0.06);
}

.nexser-spreadsheet-app .ss-cell-dropdown-btn {
    position: absolute;
    right: -18px;
    top: 50%;
    transform: translateY(-50%);
    width: 17px;
    height: 18px;
    line-height: 16px;
    text-align: center;
    font-size: 9px;
    background: #e1e4e8;
    border: 1px solid #606060;
    color: #000;
    cursor: pointer;
    z-index: 20;
    user-select: none;
}
.nexser-spreadsheet-app .ss-cell-dropdown-btn:hover {
    background: #d0d7de;
}
.nexser-spreadsheet-app .ss-cell-dropdown-list {
    position: fixed;
    min-width: 130px;
    max-height: 200px;
    overflow-y: auto;
    background: #fff;
    border: 1px solid #404040;
    box-shadow: 2px 2px 6px rgba(0, 0, 0, 0.3);
    z-index: 99996;
    font-size: 12px;
}
.nexser-spreadsheet-app .ss-cell-dropdown-item {
    padding: 4px 8px;
    cursor: pointer;
    white-space: nowrap;
}
.nexser-spreadsheet-app .ss-cell-dropdown-item:hover {
    background: #005a9e;
    color: #fff;
}

/* 選択範囲の外周ボーダー */
.nexser-spreadsheet-app .ss-table td.sel-edge-top::before,
.nexser-spreadsheet-app .ss-table td.sel-edge-bottom::before,
.nexser-spreadsheet-app .ss-table td.sel-edge-left::before,
.nexser-spreadsheet-app .ss-table td.sel-edge-right::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 6;
}

.nexser-spreadsheet-app .ss-table td.sel-edge-top::before {
    border-top: 2px solid #005a9e;
}
.nexser-spreadsheet-app .ss-table td.sel-edge-bottom::before {
    border-bottom: 2px solid #005a9e;
}
.nexser-spreadsheet-app .ss-table td.sel-edge-left::before {
    border-left: 2px solid #005a9e;
}
.nexser-spreadsheet-app .ss-table td.sel-edge-right::before {
    border-right: 2px solid #005a9e;
}

/* セル範囲移動時のドロップ先プレビュー枠 */
.nexser-spreadsheet-app .ss-table td.move-target-preview {
    outline: 2px dashed #107c41 !important;
    outline-offset: -2px;
    background-color: rgba(16, 124, 65, 0.08) !important;
}

.nexser-spreadsheet-app .ss-table td.move-target-invalid {
    outline: 2px dashed #d13438 !important;
    outline-offset: -2px;
    background-color: rgba(209, 52, 56, 0.12) !important;
}

.nexser-spreadsheet-app .ss-table td[contenteditable="true"] {
    white-space: pre-wrap;
    overflow: visible;
    cursor: text;
    background: #fff !important;
    z-index: 6;
    outline: 2px solid #005a9e !important;
    outline-offset: -2px;
}

.nexser-spreadsheet-app .ss-table td[contenteditable="true"]::after {
    display: none;
}

/* リサイズハンドル */
.nexser-spreadsheet-app .row-resize-handle {
    position: absolute;
    height: 6px;
    left: 0;
    right: 0;
    bottom: -3px;
    cursor: row-resize;
    background: transparent;
    z-index: 17;
}

.nexser-spreadsheet-app .col-resize-handle {
    position: absolute;
    width: 6px;
    top: 0;
    bottom: 0;
    right: -3px;
    cursor: col-resize;
    background: transparent;
    z-index: 17;
}

/* フィルハンドル */
.nexser-spreadsheet-app .fill-handle {
    position: absolute;
    width: 8px;
    height: 8px;
    background-color: steelblue;
    border: 1px solid #fff;
    bottom: 0;
    right: 0;
    cursor: crosshair;
    z-index: 7;
}

.nexser-spreadsheet-app td.fill-selected { background-color: rgba(0, 90, 158, 0.08); }
.nexser-spreadsheet-app td.fill-edge-top { border-top: 3px dashed #005a9e !important; }
.nexser-spreadsheet-app td.fill-edge-bottom { border-bottom: 3px dashed #005a9e !important; }
.nexser-spreadsheet-app td.fill-edge-left { border-left: 3px dashed #005a9e !important; }
.nexser-spreadsheet-app td.fill-edge-right { border-right: 3px dashed #005a9e !important; }

.nexser-spreadsheet-app .merge-highlight {
    outline: 3.5px dashed red !important;
    outline-offset: -2px;
}

/* プルダウンメニュー（style.css の .start-menu / .submenu に準拠） */
.nexser-spreadsheet-app .pulldown_menu_parent {
    position: relative;
    display: inline-flex;
    flex-direction: column;
    align-items: flex-start;
}

.nexser-spreadsheet-app .pulldown_menu {
    display: none;
    flex-direction: column;
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 2px;
    border: 1px solid;
    border-color: #fff #404040 #404040 #fff;
    box-shadow: 1px 1px black;
    padding: 2px;
    font-size: 12px;
    z-index: 60;
    background-color: #C3C7CB;
    max-height: 340px;
    min-width: 135px;
    overflow-y: auto;
    list-style: none;
}

.nexser-spreadsheet-app .pulldown_menu .button {
    display: block;
    width: 100%;
    text-align: left;
    margin-bottom: 2px;
}

.nexser-spreadsheet-app .pulldown_menu li.button:hover {
    background: #000080;
    color: #fff;
}

/* style.css 共通の .button に対するレイアウト補正（th の table-cell 維持） */
.nexser-spreadsheet-app th.button {
    display: table-cell;
}

.nexser-spreadsheet-app .button:not(th) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 2px 6px;
    min-height: 24px;
    cursor: pointer;
    font-weight: bold;
    font-size: 12px;
    white-space: nowrap;
}

.nexser-spreadsheet-app .button:not(th).selected {
    background-color: #d6e4f0;
    color: #003a70;
    border: 1px solid;
    border-color: #404040 #fff #fff #404040;
    box-shadow: inset 1px 1px 2px rgba(0, 0, 0, 0.25);
}

/* style.css 共通の select に対するサイズ調整 */
.nexser-spreadsheet-app select.ss-font-size {
    height: 24px;
    font-family: 'MS PGothic', 'MS Gothic', sans-serif;
    font-size: 12px;
    cursor: pointer;
}

.nexser-spreadsheet-app .mark_btn {
    position: relative;
    width: 26px;
    height: 26px;
    padding: 0;
    flex-shrink: 0;
}

.nexser-spreadsheet-app .cross::before,
.nexser-spreadsheet-app .cross::after {
    content: "";
    position: absolute;
    left: 11px;
    top: 4px;
    height: 16px;
    width: 2.5px;
    background-color: red;
    transform-origin: center;
}
.nexser-spreadsheet-app .cross::before { transform: rotate(45deg); }
.nexser-spreadsheet-app .cross::after { transform: rotate(-45deg); }

.nexser-spreadsheet-app .checkmark::after {
    content: "";
    position: absolute;
    left: 9px;
    top: 3px;
    width: 5px;
    height: 13px;
    border: solid forestgreen;
    border-width: 0 3px 3px 0;
    transform: rotate(45deg);
}

/* ズーム＆ステータスバー */
.nexser-spreadsheet-app .ss-zoom-toolbar {
    padding: 3px 8px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    background-color: #C3C7CB;
    border-top: 1px solid #808080;
    font-size: 12px;
    flex-shrink: 0;
    user-select: none;
}

.nexser-spreadsheet-app .ss-zoom-slider {
    appearance: none;
    height: 8px;
    width: 110px;
    background: #ddd;
    border: 1.5px solid;
    border-color: #eee #333 #333 #eee;
}

.nexser-spreadsheet-app .ss-zoom-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 16px;
    background: silver;
    border: 1.5px solid;
    border-color: #eee #333 #333 #eee;
    cursor: pointer;
}

/* フローティングテキストボックス */
.nexser-spreadsheet-app .floating-textbox {
    position: absolute;
    min-width: 80px;
    min-height: 32px;
    border: 1px solid #555;
    background: rgba(255, 255, 255, 0.96);
    padding: 6px;
    cursor: move;
    z-index: 11;
    box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.25);
    resize: both;
    overflow: auto;
    color: #000;
    font-size: 14px;
}

.nexser-spreadsheet-app .floating-textbox:focus {
    outline: 2px solid dodgerblue;
    cursor: text;
    z-index: 12;
}

.nexser-spreadsheet-app .floating-textbox-delete {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 16px;
    height: 16px;
    line-height: 14px;
    text-align: center;
    font-size: 12px;
    font-weight: bold;
    background: #c3c7cb;
    color: #000;
    border: 1px solid #555;
    cursor: pointer;
    user-select: none;
    display: none;
    z-index: 25;
}

.nexser-spreadsheet-app .floating-textbox:hover .floating-textbox-delete,
.nexser-spreadsheet-app .floating-textbox:focus .floating-textbox-delete {
    display: block;
}

/* Excel風コピー選択アニメーション */
.nexser-spreadsheet-app .copy-marching-ants {
    background-image:
        linear-gradient(90deg, #107c41 50%, transparent 50%),
        linear-gradient(90deg, #107c41 50%, transparent 50%),
        linear-gradient(0deg, #107c41 50%, transparent 50%),
        linear-gradient(0deg, #107c41 50%, transparent 50%);
    background-repeat: repeat-x, repeat-x, repeat-y, repeat-y;
    background-size: 8px 2px, 8px 2px, 2px 8px, 2px 8px;
    background-position: 0 0, 0 100%, 0 0, 100% 0;
    animation: ss-marching-ants 0.4s linear infinite;
}

@keyframes ss-marching-ants {
    to {
        background-position: 8px 0, -8px 100%, 0 -8px, 100% 8px;
    }
}

/* ----- Excel準拠：シートタブバー＆横スクロールバー同一エリア配置 ----- */
.nexser-spreadsheet-app .ss-bottom-bar {
    display: flex;
    align-items: center;
    width: 100%;
    height: 26px;
    background-color: #B4B8BC;
    border-top: 1px solid #808080;
    font-size: 12px;
    flex-shrink: 0;
    user-select: none;
    overflow: hidden;
}

.nexser-spreadsheet-app .ss-tabs-region {
    display: flex;
    align-items: center;
    flex: 0 1 55%;
    min-width: 150px;
    max-width: 82%;
    height: 100%;
    padding-left: 4px;
    gap: 2px;
    overflow: hidden;
}

.nexser-spreadsheet-app .ss-tab-nav-btns {
    display: inline-flex;
    align-items: center;
    gap: 1px;
    flex-shrink: 0;
}

.nexser-spreadsheet-app .ss-tab-nav-btn {
    padding: 0 5px;
    min-height: 20px;
    height: 20px;
    font-size: 10px;
    line-height: 18px;
}

.nexser-spreadsheet-app .ss-sheet-tabs-scroll {
    display: flex;
    align-items: flex-end;
    flex: 1 1 auto;
    min-width: 0;
    height: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
}
.nexser-spreadsheet-app .ss-sheet-tabs-scroll::-webkit-scrollbar {
    display: none;
}

.nexser-spreadsheet-app .ss-sheet-tabs-list {
    display: inline-flex;
    align-items: flex-end;
    gap: 2px;
}

.nexser-spreadsheet-app .ss-sheet-tab {
    padding: 3px 12px;
    background-color: #C3C7CB;
    color: #222;
    border: 1px solid;
    border-color: #fff #404040 #808080 #fff;
    border-bottom: none;
    cursor: pointer;
    white-space: nowrap;
    font-size: 12px;
    line-height: 1.2;
}

.nexser-spreadsheet-app .ss-sheet-tab:hover {
    background-color: #D4D8DC;
}

.nexser-spreadsheet-app .ss-sheet-tab.active,
.nexser-spreadsheet-app .ss-sheet-tab.multi-selected {
    background-color: #fff;
    color: #107c41;
    font-weight: bold;
    padding-top: 4px;
    padding-bottom: 4px;
    border-color: #fff #404040 #fff #fff;
    position: relative;
    z-index: 2;
}

.nexser-spreadsheet-app .ss-sheet-tab.multi-selected:not(.active) {
    background-color: #eef5fc;
    color: #005a9e;
    border-bottom: 2px solid #005a9e;
}

.nexser-spreadsheet-app .ss-sheet-tab.drag-over {
    border-left: 3px solid #107c41;
}

.nexser-spreadsheet-app .ss-sheet-add-btn {
    padding: 0 7px;
    min-height: 20px;
    height: 20px;
    margin: 0 4px;
    font-weight: bold;
    flex-shrink: 0;
}

.nexser-spreadsheet-app .ss-bottom-splitter {
    width: 6px;
    height: 100%;
    cursor: ew-resize;
    background-color: #A6AAAE;
    border-left: 1px solid #fff;
    border-right: 1px solid #606060;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    color: #444;
}

.nexser-spreadsheet-app .ss-h-scrollbar-track {
    flex: 1 1 45%;
    min-width: 90px;
    height: 18px;
    overflow-x: auto;
    overflow-y: hidden;
    background-color: #C3C7CB;
}

.nexser-spreadsheet-app .ss-h-scrollbar-spacer {
    height: 1px;
    pointer-events: none;
}

/* ウィンドウ枠の固定 */
.nexser-spreadsheet-app .ss-table td.ss-frozen-row,
.nexser-spreadsheet-app .ss-table td.ss-frozen-col {
    position: sticky;
    z-index: 8;
}

.nexser-spreadsheet-app .ss-table td.ss-frozen-row.ss-frozen-col {
    z-index: 9;
}

.nexser-spreadsheet-app .ss-table td.ss-frozen-row.active-cell,
.nexser-spreadsheet-app .ss-table td.ss-frozen-col.active-cell {
    z-index: 10;
}

.nexser-spreadsheet-app .ss-table tbody th.row_number.ss-frozen-row {
    z-index: 14;
}

.nexser-spreadsheet-app .ss-table thead th.col_number.ss-frozen-col {
    z-index: 15;
}

.nexser-spreadsheet-app .ss-table thead th.ss-corner {
    z-index: 17;
}

.nexser-spreadsheet-app .ss-table .ss-freeze-edge-bottom {
    box-shadow: inset 0 -2px 0 #404040;
}

.nexser-spreadsheet-app .ss-table .ss-freeze-edge-right {
    box-shadow: inset -2px 0 0 #404040;
}

@media print {
    body * {
        visibility: hidden !important;
    }
    .nexser-spreadsheet-app .ss-spreadsheet-content,
    .nexser-spreadsheet-app .ss-spreadsheet-content * {
        visibility: visible !important;
    }
    .nexser-spreadsheet-app .ss-spreadsheet-content {
        position: fixed !important;
        left: 0 !important;
        top: 0 !important;
        z-index: 999999 !important;
        background: #fff !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
    .nexser-spreadsheet-app .row_number,
    .nexser-spreadsheet-app .ss-table thead,
    .nexser-spreadsheet-app .fill-handle,
    .nexser-spreadsheet-app .floating-textbox-delete {
        display: none !important;
    }
    .nexser-spreadsheet-app .selected::after,
    .nexser-spreadsheet-app .active-cell::after {
        display: none !important;
    }
    .nexser-spreadsheet-app .active-cell {
        outline: none !important;
    }
}
`;

function injectScopedStyles() {
    let style = document.getElementById(STYLE_ELEMENT_ID);
    if (!style) {
        style = document.createElement("style");
        style.id = STYLE_ELEMENT_ID;
        document.head.appendChild(style);
    }
    style.textContent = SCOPED_CSS;
}

// =========================================================
// 数式関数ライブラリ
// =========================================================
function flattenArray(arr) {
    return arr.reduce((acc, val) => acc.concat(Array.isArray(val) ? flattenArray(val) : val), []);
}

function buildConditionMatcher(condition) {
    const condStr = String(condition ?? "").trim();
    const match = condStr.match(/^(>=|<=|<>|!=|>|<|=)(.*)$/);
    if (match) {
        const op = match[1];
        const rawTarget = match[2].trim();
        const numTarget = Number(rawTarget);
        const isNum = rawTarget !== "" && !isNaN(numTarget);
        return (v) => {
            const val = isNum && v !== "" && !isNaN(Number(v)) ? Number(v) : String(v ?? "");
            const tgt = isNum ? numTarget : rawTarget;
            if (op === ">") return val > tgt;
            if (op === ">=") return val >= tgt;
            if (op === "<") return val < tgt;
            if (op === "<=") return val <= tgt;
            if (op === "<>" || op === "!=") return val != tgt;
            if (op === "=") return val == tgt;
            return false;
        };
    }
    if (/[*?]/.test(condStr)) {
        const escaped = condStr
            .replace(/[.+^${}()|[\]\\]/g, "\\$&")
            .replace(/\*/g, ".*")
            .replace(/\?/g, ".");
        const regex = new RegExp(`^${escaped}$`, "i");
        return (v) => regex.test(String(v ?? ""));
    }
    const numTarget = Number(condStr);
    const isNum = condStr !== "" && !isNaN(numTarget);
    return (v) => (isNum && v !== "" && !isNaN(Number(v))) ? Number(v) === numTarget : String(v ?? "") === condStr;
}

const FORMULA_FUNCTIONS = {
    SUM(...args) {
        const flat = flattenArray(args);
        return flat.map(Number).filter(v => !isNaN(v)).reduce((a, b) => a + b, 0);
    },
    AVERAGE(...args) {
        const flat = flattenArray(args);
        const nums = flat.filter(v => v !== "" && v != null && !isNaN(Number(v))).map(Number);
        if (nums.length === 0) return "#DIV/0!";
        return nums.reduce((a, b) => a + b, 0) / nums.length;
    },
    MIN(...args) {
        const flat = flattenArray(args).filter(v => v !== "" && v != null && !isNaN(Number(v))).map(Number);
        return flat.length ? Math.min(...flat) : 0;
    },
    MAX(...args) {
        const flat = flattenArray(args).filter(v => v !== "" && v != null && !isNaN(Number(v))).map(Number);
        return flat.length ? Math.max(...flat) : 0;
    },
    COUNT(...args) {
        const flat = flattenArray(args);
        return flat.filter(x => typeof x !== "boolean" && String(x ?? "").trim() !== "" && !isNaN(Number(String(x).trim()))).length;
    },
    COUNTA(...args) {
        const flat = flattenArray(args);
        return flat.filter(x => String(x ?? "").trim() !== "").length;
    },
    PRODUCT(...args) {
        const flat = flattenArray(args).filter(v => String(v ?? "").trim() !== "" && !isNaN(Number(v))).map(Number);
        return flat.reduce((acc, v) => acc * v, 1);
    },
    ADD(a, b) { return Number(a) + Number(b); },
    SUBTRACT(a, b) { return Number(a) - Number(b); },
    DIVIDE(a, b) { return Number(b) !== 0 ? Number(a) / Number(b) : "#DIV/0!"; },
    POWER(a, b) { return Math.pow(Number(a), Number(b)); },
    SQRT(a) { return Math.sqrt(Number(a)); },
    MOD(a, b) { return Number(a) % Number(b); },
    ABS(a) { return Math.abs(Number(a)); },
    ROUND(num, digits = 0) {
        const n = Number(num), d = Math.trunc(Number(digits));
        return Number(`${Math.round(Number(`${n}e${d}`))}e-${d}`);
    },
    ROUNDUP(num, digits = 0) {
        const n = Number(num), d = Math.trunc(Number(digits));
        const shifted = Number(`${n}e${d}`);
        return Number(`${n >= 0 ? Math.ceil(shifted) : Math.floor(shifted)}e-${d}`);
    },
    ROUNDDOWN(num, digits = 0) {
        const n = Number(num), d = Math.trunc(Number(digits));
        return Number(`${Math.trunc(Number(`${n}e${d}`))}e-${d}`);
    },

    SUMIF(range, condition, sumRange = null) {
        const arr = flattenArray(range);
        const targets = sumRange != null ? flattenArray(sumRange) : arr;
        const matchFn = buildConditionMatcher(condition);
        return arr.reduce((sum, v, idx) => (matchFn(v) ? sum + Number(targets[idx] || 0) : sum), 0);
    },
    AVERAGEIF(range, condition, avgRange = null) {
        const arr = flattenArray(range);
        const targets = avgRange != null ? flattenArray(avgRange) : arr;
        const matchFn = buildConditionMatcher(condition);
        const filtered = [];
        arr.forEach((v, idx) => {
            if (matchFn(v)) filtered.push(Number(targets[idx] || 0));
        });
        if (filtered.length === 0) return "#DIV/0!";
        return filtered.reduce((a, b) => a + b, 0) / filtered.length;
    },
    COUNTIF(range, condition) {
        const arr = flattenArray(range);
        const matchFn = buildConditionMatcher(condition);
        return arr.filter(v => matchFn(v)).length;
    },

    CONCAT(...args) { return args.join(""); },
    UPPER(text) { return String(text).toUpperCase(); },
    LOWER(text) { return String(text).toLowerCase(); },
    LEFT(text, count) { return String(text).substring(0, Number(count)); },
    RIGHT(text, count) { return String(text).slice(-Number(count)); },
    MID(text, start, count) { return String(text).substr(Number(start) - 1, Number(count)); },
    TRIM(text) { return String(text).trim(); },
    LEN(text) { return String(text).length; },
    FIND(findText, withinText) { return String(withinText).indexOf(String(findText)) + 1; },
    REPLACE(text, start, count, newText) {
        const s = String(text);
        const st = Number(start) - 1;
        const cnt = Number(count);
        return s.substring(0, st) + newText + s.substring(st + cnt);
    },

    IF(condition, trueValue, falseValue = "") {
        if (typeof condition === "string") {
            condition = condition.trim().toUpperCase() === "TRUE";
        }
        return condition ? trueValue : falseValue;
    },
    IFERROR(value, valueIfError = "") {
        if (typeof value === "string" && /^#(ERROR!|DIV\/0!|N\/A|VALUE!|CIRCULAR!|REF!|NAME\?)$/.test(value.trim())) {
            return valueIfError;
        }
        if (typeof value === "number" && (!isFinite(value) || isNaN(value))) {
            return valueIfError;
        }
        return value;
    },
    AND(...args) { return args.every(v => Boolean(v)); },
    OR(...args) { return args.some(v => Boolean(v)); },
    NOT(value) { return !Boolean(value); },

    INDEX(array, row, col = 0) {
        if (!Array.isArray(array)) return array;
        const r = row - 1;
        if (Array.isArray(array[0])) {
            const c = col - 1;
            return (array[r] && array[r][c] != null) ? array[r][c] : 0;
        }
        return array[r] != null ? array[r] : 0;
    },
    MATCH(lookupValue, array, matchType = 0) {
        const flat = flattenArray(array);
        if (matchType === 0) {
            return flat.findIndex(v => v == lookupValue) + 1 || "#N/A";
        } else if (matchType === 1) {
            let idx = -1;
            flat.forEach((v, i) => { if (v <= lookupValue) idx = i; });
            return idx + 1 || "#N/A";
        } else if (matchType === -1) {
            let idx = -1;
            flat.forEach((v, i) => { if (v >= lookupValue && idx === -1) idx = i; });
            return idx + 1 || "#N/A";
        }
        return "#N/A";
    },
    VLOOKUP(lookupValue, tableArray, colIndex, rangeLookup = true) {
        const isRangeLookup = typeof rangeLookup === "string"
            ? !["FALSE", "0"].includes(rangeLookup.trim().toUpperCase())
            : Boolean(rangeLookup);
        let bestMatch = null;
        for (const row of tableArray) {
            if (!Array.isArray(row)) continue;
            if (isRangeLookup) {
                if (row[0] <= lookupValue) {
                    bestMatch = row[colIndex - 1] != null ? row[colIndex - 1] : "#N/A";
                }
            } else {
                if (row[0] == lookupValue) return row[colIndex - 1] != null ? row[colIndex - 1] : "#N/A";
            }
        }
        return bestMatch !== null ? bestMatch : "#N/A";
    },
    HLOOKUP(lookupValue, tableArray, rowIndex, rangeLookup = true) {
        if (!Array.isArray(tableArray) || !Array.isArray(tableArray[0])) return "#N/A";
        const isRangeLookup = typeof rangeLookup === "string"
            ? !["FALSE", "0"].includes(rangeLookup.trim().toUpperCase())
            : Boolean(rangeLookup);
        const headerRow = tableArray[0];
        let bestMatch = null;
        for (let c = 0; c < headerRow.length; c++) {
            if (isRangeLookup) {
                if (headerRow[c] <= lookupValue) {
                    bestMatch = tableArray[rowIndex - 1]?.[c] ?? "#N/A";
                }
            } else {
                if (headerRow[c] == lookupValue) return tableArray[rowIndex - 1]?.[c] ?? "#N/A";
            }
        }
        return bestMatch !== null ? bestMatch : "#N/A";
    },
    XLOOKUP(lookupValue, lookupArray, returnArray, ifNotFound = "#N/A") {
        const keys = flattenArray(lookupArray);
        const vals = flattenArray(returnArray);
        const idx = keys.findIndex(v => v == lookupValue);
        return idx !== -1 ? (vals[idx] ?? ifNotFound) : ifNotFound;
    },
    SUMIFS(sumRange, ...criteriaPairs) {
        const targets = flattenArray(sumRange);
        const matchers = [];
        for (let i = 0; i < criteriaPairs.length; i += 2) {
            matchers.push({ arr: flattenArray(criteriaPairs[i]), fn: buildConditionMatcher(criteriaPairs[i + 1]) });
        }
        return targets.reduce((sum, val, idx) => {
            const ok = matchers.every(m => m.fn(m.arr[idx]));
            return ok ? sum + Number(val || 0) : sum;
        }, 0);
    },
    COUNTIFS(...criteriaPairs) {
        if (criteriaPairs.length < 2) return 0;
        const matchers = [];
        for (let i = 0; i < criteriaPairs.length; i += 2) {
            matchers.push({ arr: flattenArray(criteriaPairs[i]), fn: buildConditionMatcher(criteriaPairs[i + 1]) });
        }
        const len = matchers[0].arr.length;
        let count = 0;
        for (let idx = 0; idx < len; idx++) {
            if (matchers.every(m => m.fn(m.arr[idx]))) count++;
        }
        return count;
    },
    INT(num) { return Math.floor(Number(num)); },
    SUBSTITUTE(text, oldText, newText) { return String(text).split(String(oldText)).join(String(newText)); },
    ISBLANK(val) { return val === "" || val == null; },
    ISNUMBER(val) { return val !== "" && val != null && !isNaN(Number(val)); },
    EOMONTH(startDate, months) {
        const d = new Date(startDate);
        return new Date(d.getFullYear(), d.getMonth() + Number(months) + 1, 0);
    },

    DATE(year, month, day) { return new Date(year, month - 1, day); },
    TODAY() { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), now.getDate()); },
    NOW() { return new Date(); },
    YEAR(dateInput) { return new Date(dateInput).getFullYear(); },
    MONTH(dateInput) { return new Date(dateInput).getMonth() + 1; },
    DAY(dateInput) { return new Date(dateInput).getDate(); },
    HOUR(dateInput) { return new Date(dateInput).getHours(); },
    MINUTE(dateInput) { return new Date(dateInput).getMinutes(); },
    SECOND(dateInput) { return new Date(dateInput).getSeconds(); },
    WEEKDAY(dateInput) { return new Date(dateInput).getDay() + 1; },
    EDATE(dateInput, months) { const d = new Date(dateInput); d.setMonth(d.getMonth() + Number(months)); return d; },
    DATEDIF(startDate, endDate, unit) {
        const d1 = new Date(startDate);
        const d2 = new Date(endDate);
        const diff = d2.getTime() - d1.getTime();
        switch (String(unit).toLowerCase()) {
            case "d": case "day": return diff / (1000 * 60 * 60 * 24);
            case "m": case "month": return diff / (1000 * 60 * 60 * 24 * 30.436875);
            case "y": case "year": return diff / (1000 * 60 * 60 * 24 * 365.2425);
            default: return diff;
        }
    },
    TIME(hour, minute, second) {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, second);
    },
    TIMEVALUE(timeStr) {
        const parts = String(timeStr).split(":");
        if (parts.length === 2 || parts.length === 3) {
            const h = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            const s = parts.length === 3 ? parseInt(parts[2], 10) : 0;
            return (h * 3600 + m * 60 + s) / 86400;
        }
        return "#VALUE!";
    },
    DATEVALUE(dateString) {
        const parts = String(dateString).split("/");
        if (parts.length === 2) {
            const now = new Date();
            return new Date(now.getFullYear(), parseInt(parts[0], 10) - 1, parseInt(parts[1], 10)).getTime();
        } else if (parts.length === 3) {
            return new Date(parseInt(parts[2], 10), parseInt(parts[0], 10) - 1, parseInt(parts[1], 10)).getTime();
        }
        return "#VALUE!";
    },
    IFS(...pairs) {
        for (let i = 0; i < pairs.length - 1; i += 2) {
            const cond = typeof pairs[i] === "string" ? pairs[i].trim().toUpperCase() === "TRUE" : Boolean(pairs[i]);
            if (cond) return pairs[i + 1];
        }
        return "#N/A";
    },
    SWITCH(expr, ...args) {
        for (let i = 0; i < args.length - 1; i += 2) {
            if (expr == args[i]) return args[i + 1];
        }
        return args.length % 2 === 1 ? args[args.length - 1] : "#N/A";
    },
    XOR(...args) {
        return args.filter(Boolean).length % 2 === 1;
    },
    TEXTJOIN(delimiter, ignoreEmpty, ...texts) {
        const flat = flattenArray(texts).map(v => String(v ?? ""));
        const list = ignoreEmpty ? flat.filter(s => s.trim() !== "") : flat;
        return list.join(String(delimiter ?? ""));
    },
    TEXTSPLIT(text, colDelimiter = ",") {
        return String(text ?? "").split(String(colDelimiter));
    },
    CLEAN(text) {
        return String(text ?? "").replace(/[\x00-\x1F\x7F]/g, "");
    },
    NETWORKDAYS(startDate, endDate) {
        const s = typeof startDate === "number" ? new Date(Date.UTC(1899, 11, 30) + startDate * 86400000) : new Date(startDate);
        const e = typeof endDate === "number" ? new Date(Date.UTC(1899, 11, 30) + endDate * 86400000) : new Date(endDate);
        if (isNaN(s) || isNaN(e)) return "#VALUE!";
        const step = s <= e ? 1 : -1;
        let count = 0;
        const cur = new Date(s.getFullYear(), s.getMonth(), s.getDate());
        const end = new Date(e.getFullYear(), e.getMonth(), e.getDate());
        while ((step > 0 && cur <= end) || (step < 0 && cur >= end)) {
            const day = cur.getDay();
            if (day !== 0 && day !== 6) count += step;
            cur.setDate(cur.getDate() + step);
        }
        return count;
    },
    WORKDAY(startDate, days) {
        const base = typeof startDate === "number" ? new Date(Date.UTC(1899, 11, 30) + startDate * 86400000) : new Date(startDate);
        if (isNaN(base)) return "#VALUE!";
        const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
        let rem = Math.trunc(Number(days) || 0);
        const step = rem >= 0 ? 1 : -1;
        while (rem !== 0) {
            d.setDate(d.getDate() + step);
            if (d.getDay() !== 0 && d.getDay() !== 6) rem -= step;
        }
        return d;
    },
    XMATCH(lookupValue, lookupArray) {
        const idx = flattenArray(lookupArray).findIndex(v => v == lookupValue);
        return idx !== -1 ? idx + 1 : "#N/A";
    },
    FILTER(array, include, ifEmpty = "#CALC!") {
        const rows = Array.isArray(array) ? array : [[array]];
        const flags = flattenArray(include);
        const out = rows.filter((_, i) => Boolean(flags[i]));
        return out.length ? out : ifEmpty;
    },
    UNIQUE(array) {
        return Array.from(new Set(flattenArray(array)));
    },
    CHOOSECOLS(array, ...colNums) {
        if (!Array.isArray(array)) return array;
        return array.map(r => Array.isArray(r) ? colNums.map(c => r[Number(c) - 1] ?? "") : r);
    },
    CHOOSEROWS(array, ...rowNums) {
        if (!Array.isArray(array)) return array;
        return rowNums.map(r => array[Number(r) - 1] ?? []);
    },
    AVERAGEIFS(avgRange, ...criteriaPairs) {
        const targets = flattenArray(avgRange);
        const matchers = [];
        for (let i = 0; i < criteriaPairs.length; i += 2) {
            matchers.push({ arr: flattenArray(criteriaPairs[i]), fn: buildConditionMatcher(criteriaPairs[i + 1]) });
        }
        const vals = targets.filter((_, idx) => matchers.every(m => m.fn(m.arr[idx]))).map(Number);
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : "#DIV/0!";
    },
    MEDIAN(...args) {
        const nums = flattenArray(args).filter(v => v !== "" && v != null && !isNaN(Number(v))).map(Number).sort((a, b) => a - b);
        if (!nums.length) return "#NUM!";
        const mid = Math.floor(nums.length / 2);
        return nums.length % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid];
    },
    STDEV(...args) {
        const nums = flattenArray(args).filter(v => v !== "" && v != null && !isNaN(Number(v))).map(Number);
        if (nums.length < 2) return "#DIV/0!";
        const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
        const variance = nums.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (nums.length - 1);
        return Math.sqrt(variance);
    },
    SUBTOTAL(funcNum, ...refs) {
        const code = Number(funcNum) % 100;
        if (code === 1) return FORMULA_FUNCTIONS.AVERAGE(...refs);
        if (code === 2) return FORMULA_FUNCTIONS.COUNT(...refs);
        if (code === 3) return FORMULA_FUNCTIONS.COUNTA(...refs);
        if (code === 4) return FORMULA_FUNCTIONS.MAX(...refs);
        if (code === 5) return FORMULA_FUNCTIONS.MIN(...refs);
        if (code === 6) return FORMULA_FUNCTIONS.PRODUCT(...refs);
        if (code === 9) return FORMULA_FUNCTIONS.SUM(...refs);
        return "#VALUE!";
    },
    AGGREGATE(funcNum, _options, ...refs) {
        const clean = flattenArray(refs).filter(v => !(typeof v === "string" && v.startsWith("#")));
        return FORMULA_FUNCTIONS.SUBTOTAL(funcNum, clean);
    },
    SEQUENCE(rows = 1, cols = 1, start = 1, step = 1) {
        const out = [];
        let cur = Number(start);
        for (let r = 0; r < Number(rows); r++) {
            const row = [];
            for (let c = 0; c < Number(cols); c++) {
                row.push(cur);
                cur += Number(step);
            }
            out.push(row);
        }
        return out;
    },
    RANDARRAY(rows = 1, cols = 1, min = 0, max = 1, wholeNumber = false) {
        const out = [];
        for (let r = 0; r < Number(rows); r++) {
            const row = [];
            for (let c = 0; c < Number(cols); c++) {
                const v = Number(min) + Math.random() * (Number(max) - Number(min));
                row.push(wholeNumber ? Math.floor(v) : v);
            }
            out.push(row);
        }
        return out;
    },
    ISTEXT(val) { return typeof val === "string" && val !== "" && !val.startsWith("#") && isNaN(Number(val)); },
    ISERROR(val) { return typeof val === "string" && /^#(ERROR!|DIV\/0!|N\/A|VALUE!|CIRCULAR!|REF!|NAME\?|NUM!|CALC!)$/.test(val.trim()); },
    ISNA(val) { return String(val ?? "").trim() === "#N/A"; },
    TYPE(val) {
        if (FORMULA_FUNCTIONS.ISERROR(val)) return 16;
        if (Array.isArray(val)) return 64;
        if (typeof val === "boolean") return 4;
        if (val !== "" && !isNaN(Number(val))) return 1;
        return 2;
    },
    N(val) {
        if (typeof val === "boolean") return val ? 1 : 0;
        const n = Number(val);
        return isNaN(n) ? 0 : n;
    },
    NA() { return "#N/A"; },
    PMT(rate, nper, pv, fv = 0, type = 0) {
        const r = Number(rate), n = Number(nper), p = Number(pv), f = Number(fv), t = Number(type);
        if (r === 0) return -(p + f) / n;
        const pvif = Math.pow(1 + r, n);
        return (-r * (p * pvif + f)) / ((1 + r * t) * (pvif - 1));
    },
    FV(rate, nper, pmt, pv = 0, type = 0) {
        const r = Number(rate), n = Number(nper), m = Number(pmt), p = Number(pv), t = Number(type);
        if (r === 0) return -(p + m * n);
        return -(p * Math.pow(1 + r, n) + m * (1 + r * t) * ((Math.pow(1 + r, n) - 1) / r));
    },
    PV(rate, nper, pmt, fv = 0, type = 0) {
        const r = Number(rate), n = Number(nper), m = Number(pmt), f = Number(fv), t = Number(type);
        if (r === 0) return -(f + m * n);
        return -(f + m * (1 + r * t) * ((Math.pow(1 + r, n) - 1) / r)) / Math.pow(1 + r, n);
    },
    NPV(rate, ...values) {
        const r = Number(rate);
        return flattenArray(values).map(Number).reduce((acc, v, i) => acc + v / Math.pow(1 + r, i + 1), 0);
    },
    IRR(values, guess = 0.1) {
        const flows = flattenArray(values).map(Number);
        let rate = Number(guess);
        for (let iter = 0; iter < 50; iter++) {
            let npv = 0, dNpv = 0;
            flows.forEach((cf, t) => {
                npv += cf / Math.pow(1 + rate, t);
                if (t > 0) dNpv -= (t * cf) / Math.pow(1 + rate, t + 1);
            });
            if (Math.abs(npv) < 1e-7) return rate;
            if (dNpv === 0) return "#NUM!";
            rate -= npv / dNpv;
        }
        return rate;
    },
    SORT(array, sortIndex = 1, sortOrder = 1) {
        if (!Array.isArray(array)) return array;
        const idx = Number(sortIndex) - 1;
        const dir = Number(sortOrder) >= 0 ? 1 : -1;
        return [...array].sort((a, b) => {
            const va = Array.isArray(a) ? a[idx] : a;
            const vb = Array.isArray(b) ? b[idx] : b;
            return va == vb ? 0 : (va > vb ? dir : -dir);
        });
    },
    SORTBY(array, byArray, sortOrder = 1) {
        if (!Array.isArray(array)) return array;
        const keys = flattenArray(byArray);
        const dir = Number(sortOrder) >= 0 ? 1 : -1;
        return array.map((row, i) => ({ row, key: keys[i] }))
            .sort((a, b) => a.key == b.key ? 0 : (a.key > b.key ? dir : -dir))
            .map(x => x.row);
    },
    TAKE(array, rows, cols = null) {
        if (!Array.isArray(array)) return array;
        const rSliced = Number(rows) >= 0 ? array.slice(0, Number(rows)) : array.slice(Number(rows));
        if (cols == null) return rSliced;
        return rSliced.map(r => Array.isArray(r) ? (Number(cols) >= 0 ? r.slice(0, Number(cols)) : r.slice(Number(cols))) : r);
    },
    DROP(array, rows, cols = null) {
        if (!Array.isArray(array)) return array;
        const rSliced = Number(rows) >= 0 ? array.slice(Number(rows)) : array.slice(0, array.length + Number(rows));
        if (cols == null) return rSliced;
        return rSliced.map(r => Array.isArray(r) ? (Number(cols) >= 0 ? r.slice(Number(cols)) : r.slice(0, r.length + Number(cols))) : r);
    },
    EXPAND(array, rows, cols, padWith = "") {
        const src = Array.isArray(array) ? array : [[array]];
        const out = [];
        for (let r = 0; r < Number(rows); r++) {
            const row = [];
            for (let c = 0; c < Number(cols); c++) {
                row.push(src[r]?.[c] ?? padWith);
            }
            out.push(row);
        }
        return out;
    },
    LET(...args) { return args[args.length - 1]; },
    LAMBDA(...args) { return args[args.length - 1]; },
    MAP(array, fn) { return typeof fn === "function" ? flattenArray(array).map(fn) : array; },
    REDUCE(init, array, fn) { return typeof fn === "function" ? flattenArray(array).reduce(fn, init) : init; },
    SCAN(init, array, fn) {
        if (typeof fn !== "function") return [init];
        let acc = init;
        return flattenArray(array).map(v => (acc = fn(acc, v)));
    },
    BYROW(array, fn) { return Array.isArray(array) && typeof fn === "function" ? array.map(fn) : array; },
    BYCOL(array, fn) {
        if (!Array.isArray(array) || !Array.isArray(array[0]) || typeof fn !== "function") return array;
        return array[0].map((_, c) => fn(array.map(r => r[c])));
    }
};

const FORMULA_FN_NAMES = Object.keys(FORMULA_FUNCTIONS);
const FORMULA_FN_VALUES = Object.values(FORMULA_FUNCTIONS);

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
    content.style.width = "100%";
    content.style.height = "100%";

    content.innerHTML = `
    <div class="nexser-spreadsheet-app" tabindex="-1">
        <!-- Excel準拠 クイックアクセスツールバー ＆ リボンUI -->
        <div class="ss-ribbon-shell">
            <div class="ss-qat-and-tabs">
                <div class="ss-ribbon-tabs">
                    <div class="pulldown_menu_parent">
                        <span class="ss-ribbon-tab pulldown_btn" style="background:#0b5a2f;">ファイル</span>
                        <ul class="pulldown_menu" style="min-width:210px;">
                            <li class="button" data-action="new">新規作成</li>
                            <li class="button" data-action="open">開く...</li>
                            <li class="button" data-action="import-local">ローカルファイルから開く (.nxs / .csv)...</li>
                            <li class="ss-menu-sep"></li>
                           <li class="button" data-action="save">上書き保存 (Ctrl+S)</li>
                            <li class="button" data-action="save-as">名前を付けて保存 (仮想ドライブ)...</li>
                            <li class="button" data-action="export-nxs">NXS形式でエクスポート (PCへダウンロード)</li>
                            <li class="button" data-action="export-csv">CSV形式でエクスポート (仮想ドライブ)</li>
                            <li class="button" data-action="export-csv-local">CSV形式でエクスポート (PCへダウンロード)</li>
                            <li class="ss-menu-sep"></li>
                            <li class="button" data-action="print">印刷</li>
                        </ul>
                    </div>
                    <span class="ss-ribbon-tab active" data-ribbon-tab="home">ホーム</span>
                    <span class="ss-ribbon-tab" data-ribbon-tab="insert">挿入</span>
                    <span class="ss-ribbon-tab" data-ribbon-tab="pagelayout">ページレイアウト</span>
                    <span class="ss-ribbon-tab" data-ribbon-tab="formulas">数式</span>
                    <span class="ss-ribbon-tab" data-ribbon-tab="data">データ</span>
                    <span class="ss-ribbon-tab" data-ribbon-tab="view">表示</span>
                </div>
                <!-- クイックアクセスツールバー -->
                <div class="ss-qat-bar" title="クイックアクセスツールバー">
                    <span class="ss-qat-btn" data-action="save" title="上書き保存 (Ctrl+S)">💾 保存</span>
                    <span class="ss-qat-btn ss-qat-undo" data-action="undo" title="元に戻す (Ctrl+Z)">↶ 戻す</span>
                    <span class="ss-qat-btn ss-qat-redo" data-action="redo" title="やり直し (Ctrl+Y)">↷ やり直し</span>
                    <span class="ss-qat-btn ss-ribbon-collapse-btn" data-action="toggle-ribbon" title="リボンの折りたたみ/展開">▲</span>
                </div>
            </div>

            <div class="ss-ribbon-panels">
                <!-- ==================== [ホーム] タブ（7グループ構成） ==================== -->
                <div class="ss-ribbon-panel active" data-ribbon-panel="home">
                    <!-- 1. クリップボード -->
                    <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <div class="pulldown_menu_parent">
                                <span class="button pulldown_btn" title="貼り付けオプション">📋 貼り付け ▼</span>
                                <ul class="pulldown_menu" style="min-width:165px;">
                                    <li class="button" data-action="paste">貼り付け (Ctrl+V)</li>
                                    <li class="button" data-action="paste-values">値のみ貼り付け (Ctrl+Shift+V)</li>
                                </ul>
                            </div>
                            <span class="button" data-action="cut" title="切り取り (Ctrl+X)">✂ 切り取り</span>
                            <span class="button" data-action="copy" title="コピー (Ctrl+C)">📄 コピー</span>
                            <span class="button ss-format-painter-btn" data-action="format-painter" title="書式のコピー/貼り付け">🖌 書式コピー</span>
                        </div>
                        <div class="ss-ribbon-group-title">クリップボード</div>
                    </div>

                    <!-- 2. フォント -->
                    <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <label>
                                <select class="ss-font-size" style="outline:none;" title="フォントサイズ">
                                    <option value="8px">8</option>
                                    <option value="9px">9</option>
                                    <option value="10px">10</option>
                                    <option value="11px">11</option>
                                    <option value="12px">12</option>
                                    <option value="14px" selected>14</option>
                                    <option value="16px">16</option>
                                    <option value="18px">18</option>
                                    <option value="20px">20</option>
                                    <option value="24px">24</option>
                                    <option value="26px">26</option>
                                    <option value="28px">28</option>
                                    <option value="36px">36</option>
                                    <option value="48px">48</option>
                                    <option value="72px">72</option>
                                    <option value="96px">96</option>
                                    <option value="120px">120</option>
                                    <option value="144px">144</option>
                                </select>
                            </label>
                            <span class="button ss-toggle-bold" title="太字">&nbsp;B&nbsp;</span>
                            <span class="button ss-toggle-italic" style="font-style:italic; font-weight:bold;" title="斜体">&nbsp;i&nbsp;</span>
                            <span class="button ss-toggle-underline" title="下線">&nbsp;<span style="text-decoration:underline;">U</span>&nbsp;</span>
                            <span class="button ss-toggle-textshadow" title="影付き">&nbsp;<span style="text-shadow:2px 2px #555;">A</span>&nbsp;</span>

                            <div class="pulldown_menu_parent">
                                <span class="button pulldown_btn" title="罫線">&nbsp;罫線 ▼&nbsp;</span>
                                <ul class="pulldown_menu">
                                    <li class="button" data-border="top">上罫線</li>
                                    <li class="button" data-border="bottom">下罫線</li>
                                    <li class="button" data-border="left">左罫線</li>
                                    <li class="button" data-border="right">右罫線</li>
                                    <li class="button" data-border="outer">外枠</li>
                                    <li class="button" data-border="outer-bold">太い外枠</li>
                                    <li class="button" data-border="cell">格子（セル枠）</li>
                                    <li class="button" data-border="none">枠線なし</li>
                                </ul>
                            </div>

                            <div class="ss-cell-color-palette pulldown_menu_parent">
                                <span class="button pulldown_btn" style="background-color:#222; color:#fff;" title="塗りつぶしの色">&nbsp;塗潰 ▼&nbsp;</span>
                                <div class="pulldown_menu">
                                    <div class="swatch-container">
                                        <div class="color-swatch" data-color="#000000" style="background-color:#000000;"></div>
                                        <div class="color-swatch" data-color="#FF0000" style="background-color:#FF0000;"></div>
                                        <div class="color-swatch" data-color="#00FF00" style="background-color:#00FF00;"></div>
                                        <div class="color-swatch" data-color="#0000FF" style="background-color:#0000FF;"></div>
                                        <div class="color-swatch" data-color="#FFFF00" style="background-color:#FFFF00;"></div>
                                        <div class="color-swatch" data-color="#FF00FF" style="background-color:#FF00FF;"></div>
                                        <div class="color-swatch" data-color="#00FFFF" style="background-color:#00FFFF;"></div>
                                        <div class="color-swatch" data-color="#808080" style="background-color:#808080;"></div>
                                        <div class="color-swatch" data-color="#800000" style="background-color:#800000;"></div>
                                        <div class="color-swatch" data-color="#008000" style="background-color:#008000;"></div>
                                        <div class="color-swatch" data-color="#000080" style="background-color:#000080;"></div>
                                        <div class="color-swatch" data-color="#808000" style="background-color:#808000;"></div>
                                        <div class="color-swatch" data-color="#800080" style="background-color:#800080;"></div>
                                        <div class="color-swatch" data-color="#008080" style="background-color:#008080;"></div>
                                        <div class="color-swatch" data-color="#C0C0C0" style="background-color:#C0C0C0;"></div>
                                        <div class="color-swatch" data-color="#FFFFFF" style="background-color:#FFFFFF;"></div>
                                    </div>
                                    <div class="color-swatch button" data-color="none">塗りつぶしなし</div>
                                    <div class="ss-color-picker">
                                        <label>詳細: <input type="color" class="ss-cell-color-custom"></label>
                                    </div>
                                </div>
                            </div>

                            <div class="ss-text-color-palette pulldown_menu_parent">
                                <span class="button pulldown_btn" style="color:#d00;" title="フォントの色">&nbsp;A ▼&nbsp;</span>
                                <div class="pulldown_menu">
                                    <div class="swatch-container">
                                        <div class="color-swatch" data-color="#000000" style="background-color:#000000;"></div>
                                        <div class="color-swatch" data-color="#FF0000" style="background-color:#FF0000;"></div>
                                        <div class="color-swatch" data-color="#00FF00" style="background-color:#00FF00;"></div>
                                        <div class="color-swatch" data-color="#0000FF" style="background-color:#0000FF;"></div>
                                        <div class="color-swatch" data-color="#FFFF00" style="background-color:#FFFF00;"></div>
                                        <div class="color-swatch" data-color="#FF00FF" style="background-color:#FF00FF;"></div>
                                        <div class="color-swatch" data-color="#00FFFF" style="background-color:#00FFFF;"></div>
                                        <div class="color-swatch" data-color="#808080" style="background-color:#808080;"></div>
                                        <div class="color-swatch" data-color="#800000" style="background-color:#800000;"></div>
                                        <div class="color-swatch" data-color="#008000" style="background-color:#008000;"></div>
                                        <div class="color-swatch" data-color="#000080" style="background-color:#000080;"></div>
                                        <div class="color-swatch" data-color="#808000" style="background-color:#808000;"></div>
                                        <div class="color-swatch" data-color="#800080" style="background-color:#800080;"></div>
                                        <div class="color-swatch" data-color="#008080" style="background-color:#008080;"></div>
                                        <div class="color-swatch" data-color="#C0C0C0" style="background-color:#C0C0C0;"></div>
                                        <div class="color-swatch" data-color="#FFFFFF" style="background-color:#FFFFFF;"></div>
                                    </div>
                                    <div class="color-swatch button" data-color="none">自動</div>
                                    <div class="ss-color-picker">
                                        <label>詳細: <input type="color" class="ss-text-color-custom"></label>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="ss-ribbon-group-title">フォント</div>
                    </div>

                    <!-- 3. 配置 -->
                    <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <span class="button ss-valign-top" title="上揃え">上</span>
                            <span class="button ss-valign-middle" title="上下中央揃え">中</span>
                            <span class="button ss-valign-bottom" title="下揃え">下</span>
                            <div class="ss-text-alignment-buttons" style="display:inline-flex; gap:2px;">
                                <span class="button" data-align="left" title="左揃え">=&nbsp;&nbsp;</span>
                                <span class="button" data-align="center" title="中央揃え">&nbsp;=&nbsp;</span>
                                <span class="button" data-align="right" title="右揃え">&nbsp;&nbsp;=</span>
                            </div>
                            <span class="button ss-toggle-wrap" title="折り返して全体を表示する">折り返し</span>
                            <span class="button ss-merge-cells" title="セルを結合して中央揃え">セル結合</span>
                            <span class="button ss-unmerge-cells" title="セル結合の解除">解除</span>
                        </div>
                        <div class="ss-ribbon-group-title">配置</div>
                    </div>

                    <!-- 4. 数値 -->
                    <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <span class="button" data-numfmt="general" title="標準表示">標準</span>
                            <span class="button" data-numfmt="currency" title="通貨表示形式 (¥1,000)">&nbsp;¥&nbsp;</span>
                            <span class="button" data-numfmt="percent" title="パーセントスタイル (10%)">&nbsp;%&nbsp;</span>
                            <span class="button" data-numfmt="comma" title="桁区切りスタイル (1,000)">&nbsp;,&nbsp;</span>
                            <span class="button" data-numfmt="date-jp" title="日付表示 (2025年7月8日)">年月日</span>
                            <span class="button" data-numfmt="date-md" title="短い日付 (7/8)">M/D</span>
                            <span class="button" data-decimal-step="1" title="小数点以下の表示桁数を増やす">.00→.0</span>
                            <span class="button" data-decimal-step="-1" title="小数点以下の表示桁数を減らす">.0→.00</span>
                        </div>
                        <div class="ss-ribbon-group-title">数値</div>
                    </div>

                    <!-- 5. スタイル -->
                    <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <div class="pulldown_menu_parent">
                                <span class="button pulldown_btn">条件付き書式 ▼</span>
                                <ul class="pulldown_menu" style="min-width:210px;">
                                    <li class="button" data-cf-preset="custom">新しいルール（詳細設定）...</li>
                                    <li class="button" data-cf-preset="manage">ルールの管理・一覧削除...</li>
                                    <li class="button" data-cf-preset="gt100">指定の値より大きい (100超・赤)</li>
                                    <li class="button" data-cf-preset="lt0">負の数 (0未満・赤)</li>
                                    <li class="button" data-cf-preset="duplicate">重複する値を強調表示</li>
                                    <li class="button" data-cf-preset="clear">シート全体のルールをクリア</li>
                                </ul>
                            </div>
                          <div class="pulldown_menu_parent">
                                <span class="button pulldown_btn">テーブル書式 ▼</span>
                                <div class="pulldown_menu ss-table-style-menu" style="min-width:265px; padding:6px;">
                                    <div style="display:flex; gap:10px; margin-bottom:5px; padding-bottom:4px; border-bottom:1px solid #808080; font-size:11px;">
                                        <label style="cursor:pointer;"><input type="checkbox" class="ss-tbl-opt-header" checked> 先頭行を見出しにする</label>
                                        <label style="cursor:pointer;"><input type="checkbox" class="ss-tbl-opt-stripe" checked> 縞模様</label>
                                    </div>
                                    <div style="font-size:10px; color:#333; margin-bottom:2px;">淡色・中間・濃色スタイル（12種）</div>
                                    <div class="ss-table-presets-grid" style="display:grid; grid-template-columns:repeat(4, 1fr); gap:4px;"></div>
                                </div>
                            </div>
                        </div>
                        <div class="ss-ribbon-group-title">スタイル</div>
                    </div>

                    <!-- 6. セル -->
                    <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <div class="pulldown_menu_parent">
                                <span class="button pulldown_btn">挿入 ▼</span>
                                <ul class="pulldown_menu" style="min-width:155px;">
                                    <li class="button" data-rowcol-op="insert-row">シートの行を挿入</li>
                                    <li class="button" data-rowcol-op="insert-col">シートの列を挿入</li>
                                    <li class="button" data-action="add-sheet">シートの挿入</li>
                                </ul>
                            </div>
                            <div class="pulldown_menu_parent">
                                <span class="button pulldown_btn">削除 ▼</span>
                                <ul class="pulldown_menu" style="min-width:155px;">
                                    <li class="button" data-rowcol-op="delete-row">シートの行を削除</li>
                                    <li class="button" data-rowcol-op="delete-col">シートの列を削除</li>
                                    <li class="button" data-action="delete-sheet">シートの削除</li>
                                </ul>
                            </div>
                            <div class="pulldown_menu_parent">
                                <span class="button pulldown_btn">書式 ▼</span>
                                <ul class="pulldown_menu" style="min-width:170px;">
                                    <li class="button" data-action="autofit-row">行の高さの自動調整</li>
                                    <li class="button" data-action="autofit-col">列幅の自動調整</li>
                                    <li class="button" data-action="rename-sheet">シート名の変更...</li>
                                </ul>
                            </div>
                        </div>
                        <div class="ss-ribbon-group-title">セル</div>
                    </div>

                   <!-- 7. 編集 -->
                    <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <span class="button" data-action="auto-sum" title="オートSUM">&nbsp;Σ オートSUM&nbsp;</span>
                            <div class="pulldown_menu_parent">
                                <span class="button pulldown_btn" title="選択範囲をクリア">クリア ▼</span>
                                <ul class="pulldown_menu" style="min-width:175px;">
                                    <li class="button" data-action="clear-all">すべてクリア</li>
                                    <li class="button" data-action="clear-formats">書式のクリア</li>
                                    <li class="button" data-action="clear-cells">数式と値のクリア</li>
                                </ul>
                            </div>
                            <div class="pulldown_menu_parent">
                                <span class="button pulldown_btn">並べ替え ▼</span>
                                <ul class="pulldown_menu" style="min-width:165px;">
                                    <li class="button" data-sort="asc">昇順 (A→Z / 小→大)</li>
                                    <li class="button" data-sort="desc">降順 (Z→A / 大→小)</li>
                                </ul>
                            </div>
                            <span class="button" data-action="find-replace" title="検索と置換 (Ctrl+F)">🔍 検索と選択</span>
                        </div>
                        <div class="ss-ribbon-group-title">編集</div>
                    </div>
                </div>

                <!-- ==================== [挿入] タブ ==================== -->
                <div class="ss-ribbon-panel" data-ribbon-panel="insert">
                   <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <span class="button" data-action="insert-chart-bar">📊 縦棒</span>
                            <span class="button" data-action="insert-chart-line">📈 折れ線</span>
                            <span class="button" data-action="insert-chart-pie">🥧 円グラフ</span>
                        </div>
                        <div class="ss-ribbon-group-title">グラフ</div>
                    </div>
                    <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <span class="button" data-action="insert-textbox">📝 テキストボックス</span>
                        </div>
                        <div class="ss-ribbon-group-title">テキスト</div>
                    </div>
                </div>

                <!-- ==================== [ページレイアウト] タブ ==================== -->
                <div class="ss-ribbon-panel" data-ribbon-panel="pagelayout">
                    <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <div class="pulldown_menu_parent">
                                <span class="button pulldown_btn">用紙サイズ ▼</span>
                                <ul class="pulldown_menu" style="min-width:130px;">
                                    <li class="button" data-pagesize="A4">A4 (標準)</li>
                                    <li class="button" data-pagesize="A3">A3</li>
                                    <li class="button" data-pagesize="B5">B5</li>
                                    <li class="button" data-pagesize="B4">B4</li>
                                </ul>
                            </div>
                            <span class="button" data-action="print">🖨 印刷実行</span>
                        </div>
                        <div class="ss-ribbon-group-title">ページ設定</div>
                    </div>
                </div>

                <!-- ==================== [数式] タブ（旧関数メニューを統合） ==================== -->
                <div class="ss-ribbon-panel" data-ribbon-panel="formulas">
                    <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <span class="button" data-action="auto-sum">Σ オートSUM</span>

                            <div class="pulldown_menu_parent">
                                <span class="button pulldown_btn">最近使用した関数 ▼</span>
                                <ul class="pulldown_menu ss-recent-fn-menu" style="min-width:210px;"></ul>
                            </div>

                            <div class="pulldown_menu_parent">
                                <span class="button pulldown_btn">財務 ▼</span>
                                <ul class="pulldown_menu" style="min-width:220px;">
                                    <li class="button" data-fn-tpl="=PMT(, , )">PMT - 定期支払額</li>
                                    <li class="button" data-fn-tpl="=FV(, , )">FV - 将来価値</li>
                                    <li class="button" data-fn-tpl="=PV(, , )">PV - 現在価値</li>
                                    <li class="button" data-fn-tpl="=NPV(, )">NPV - 正味現在価値</li>
                                    <li class="button" data-fn-tpl="=IRR()">IRR - 内部利益率</li>
                                </ul>
                            </div>

                            <div class="pulldown_menu_parent">
                                <span class="button pulldown_btn">論理 ▼</span>
                                <ul class="pulldown_menu" style="min-width:220px;">
                                    <li class="button" data-fn-tpl="=IF(, , )">IF - 条件分岐</li>
                                    <li class="button" data-fn-tpl="=IFS(, , , )">IFS - 複数条件分岐</li>
                                    <li class="button" data-fn-tpl="=SWITCH(, , , )">SWITCH - 値一致分岐</li>
                                    <li class="button" data-fn-tpl="=IFERROR(, 0)">IFERROR - エラー時置換</li>
                                    <li class="button" data-fn-tpl="=AND(, )">AND - 論理積</li>
                                    <li class="button" data-fn-tpl="=OR(, )">OR - 論理和</li>
                                    <li class="button" data-fn-tpl="=XOR(, )">XOR - 排他的論理和</li>
                                    <li class="button" data-fn-tpl="=NOT()">NOT - 論理否定</li>
                                </ul>
                            </div>

                            <div class="pulldown_menu_parent">
                                <span class="button pulldown_btn">文字列操作 ▼</span>
                                <ul class="pulldown_menu" style="min-width:230px;">
                                    <li class="button" data-fn-tpl="=TEXTJOIN(&quot;,&quot;, TRUE, )">TEXTJOIN - 区切り文字結合</li>
                                    <li class="button" data-fn-tpl="=TEXTSPLIT(, &quot;,&quot;)">TEXTSPLIT - 文字列分割</li>
                                    <li class="button" data-fn-tpl="=CONCAT(, )">CONCAT - 文字列結合</li>
                                    <li class="button" data-fn-tpl="=SUBSTITUTE(, , )">SUBSTITUTE - 文字列置換</li>
                                    <li class="button" data-fn-tpl="=TRIM()">TRIM - 余分な空白削除</li>
                                    <li class="button" data-fn-tpl="=CLEAN()">CLEAN - 制御文字削除</li>
                                    <li class="button" data-fn-tpl="=LEFT(, 1)">LEFT - 左端から抽出</li>
                                    <li class="button" data-fn-tpl="=RIGHT(, 1)">RIGHT - 右端から抽出</li>
                                    <li class="button" data-fn-tpl="=MID(, 1, 1)">MID - 指定位置から抽出</li>
                                    <li class="button" data-fn-tpl="=LEN()">LEN - 文字数</li>
                                    <li class="button" data-fn-tpl="=UPPER()">UPPER - 大文字変換</li>
                                    <li class="button" data-fn-tpl="=LOWER()">LOWER - 小文字変換</li>
                                </ul>
                            </div>

                            <div class="pulldown_menu_parent">
                                <span class="button pulldown_btn">日付と時刻 ▼</span>
                                <ul class="pulldown_menu" style="min-width:230px;">
                                    <li class="button" data-fn-tpl="=TODAY()">TODAY - 今日の日付</li>
                                    <li class="button" data-fn-tpl="=NOW()">NOW - 現在日時</li>
                                    <li class="button" data-fn-tpl="=DATE(2026, 11, 17)">DATE - 日付作成</li>
                                    <li class="button" data-fn-tpl="=EDATE(, 1)">EDATE - 指定月数前後</li>
                                    <li class="button" data-fn-tpl="=EOMONTH(, 0)">EOMONTH - 月末日</li>
                                    <li class="button" data-fn-tpl="=NETWORKDAYS(, )">NETWORKDAYS - 稼働日数</li>
                                    <li class="button" data-fn-tpl="=WORKDAY(, 1)">WORKDAY - 稼働日後日付</li>
                                    <li class="button" data-fn-tpl="=DATEDIF(, , &quot;D&quot;)">DATEDIF - 期間計算</li>
                                    <li class="button" data-fn-tpl="=YEAR()">YEAR - 年</li>
                                    <li class="button" data-fn-tpl="=MONTH()">MONTH - 月</li>
                                    <li class="button" data-fn-tpl="=DAY()">DAY - 日</li>
                                </ul>
                            </div>

                            <div class="pulldown_menu_parent">
                                <span class="button pulldown_btn">検索と参照 ▼</span>
                                <ul class="pulldown_menu" style="min-width:240px;">
                                    <li class="button" data-fn-tpl="=XLOOKUP(, , )">XLOOKUP - モダン範囲検索</li>
                                    <li class="button" data-fn-tpl="=XMATCH(, )">XMATCH - モダン位置検索</li>
                                    <li class="button" data-fn-tpl="=VLOOKUP(, , 2, FALSE)">VLOOKUP - 垂直検索</li>
                                    <li class="button" data-fn-tpl="=HLOOKUP(, , 2, FALSE)">HLOOKUP - 水平検索</li>
                                    <li class="button" data-fn-tpl="=INDEX(, 1, 1)">INDEX - 行列位置指定取得</li>
                                    <li class="button" data-fn-tpl="=MATCH(, , 0)">MATCH - 相対位置検索</li>
                                    <li class="button" data-fn-tpl="=FILTER(, )">FILTER - 条件抽出（動的配列）</li>
                                    <li class="button" data-fn-tpl="=UNIQUE()">UNIQUE - 重複除外（動的配列）</li>
                                    <li class="button" data-fn-tpl="=CHOOSECOLS(, 1)">CHOOSECOLS - 指定列抽出</li>
                                    <li class="button" data-fn-tpl="=CHOOSEROWS(, 1)">CHOOSEROWS - 指定行抽出</li>
                                </ul>
                            </div>

                            <div class="pulldown_menu_parent">
                                <span class="button pulldown_btn">統計 ▼</span>
                                <ul class="pulldown_menu" style="min-width:230px;">
                                    <li class="button" data-fn-tpl="=AVERAGE()">AVERAGE - 平均</li>
                                    <li class="button" data-fn-tpl="=AVERAGEIF(, )">AVERAGEIF - 条件付き平均</li>
                                    <li class="button" data-fn-tpl="=AVERAGEIFS(, , )">AVERAGEIFS - 複数条件平均</li>
                                    <li class="button" data-fn-tpl="=COUNT()">COUNT - 数値の個数</li>
                                    <li class="button" data-fn-tpl="=COUNTA()">COUNTA - 空白以外の個数</li>
                                    <li class="button" data-fn-tpl="=COUNTIF(, )">COUNTIF - 条件付き件数</li>
                                    <li class="button" data-fn-tpl="=COUNTIFS(, )">COUNTIFS - 複数条件件数</li>
                                    <li class="button" data-fn-tpl="=MAX()">MAX - 最大値</li>
                                    <li class="button" data-fn-tpl="=MIN()">MIN - 最小値</li>
                                    <li class="button" data-fn-tpl="=MEDIAN()">MEDIAN - 中央値</li>
                                    <li class="button" data-fn-tpl="=STDEV()">STDEV - 標準偏差</li>
                                </ul>
                            </div>

                            <div class="pulldown_menu_parent">
                                <span class="button pulldown_btn">数学・三角 ▼</span>
                                <ul class="pulldown_menu" style="min-width:240px;">
                                    <li class="button" data-fn-tpl="=SUM()">SUM - 合計</li>
                                    <li class="button" data-fn-tpl="=SUMIF(, )">SUMIF - 条件付き合計</li>
                                    <li class="button" data-fn-tpl="=SUMIFS(, , )">SUMIFS - 複数条件合計</li>
                                    <li class="button" data-fn-tpl="=SUBTOTAL(9, )">SUBTOTAL - 集計（9=SUM）</li>
                                    <li class="button" data-fn-tpl="=AGGREGATE(9, 6, )">AGGREGATE - エラー無視集計</li>
                                    <li class="button" data-fn-tpl="=ROUND(, 0)">ROUND - 四捨五入</li>
                                    <li class="button" data-fn-tpl="=ROUNDUP(, 0)">ROUNDUP - 切り上げ</li>
                                    <li class="button" data-fn-tpl="=ROUNDDOWN(, 0)">ROUNDDOWN - 切り捨て</li>
                                    <li class="button" data-fn-tpl="=ABS()">ABS - 絶対値</li>
                                    <li class="button" data-fn-tpl="=POWER(, 2)">POWER - べき乗</li>
                                    <li class="button" data-fn-tpl="=SQRT()">SQRT - 平方根</li>
                                    <li class="button" data-fn-tpl="=MOD(, )">MOD - 剰余</li>
                                    <li class="button" data-fn-tpl="=SEQUENCE(5, 1, 1, 1)">SEQUENCE - 連続数値配列</li>
                                    <li class="button" data-fn-tpl="=RANDARRAY(3, 3, 1, 100, TRUE)">RANDARRAY - 乱数配列</li>
                                </ul>
                            </div>

                            <div class="pulldown_menu_parent">
                                <span class="button pulldown_btn">情報関数 ▼</span>
                                <ul class="pulldown_menu" style="min-width:210px;">
                                    <li class="button" data-fn-tpl="=ISBLANK()">ISBLANK - 空白判定</li>
                                    <li class="button" data-fn-tpl="=ISNUMBER()">ISNUMBER - 数値判定</li>
                                    <li class="button" data-fn-tpl="=ISTEXT()">ISTEXT - 文字列判定</li>
                                    <li class="button" data-fn-tpl="=ISERROR()">ISERROR - エラー判定</li>
                                    <li class="button" data-fn-tpl="=ISNA()">ISNA - #N/A判定</li>
                                    <li class="button" data-fn-tpl="=TYPE()">TYPE - データ型番号</li>
                                    <li class="button" data-fn-tpl="=N()">N - 数値変換</li>
                                    <li class="button" data-fn-tpl="=NA()">NA - #N/A生成</li>
                                </ul>
                            </div>

                            <div class="pulldown_menu_parent">
                                <span class="button pulldown_btn">配列・LAMBDA ▼</span>
                                <ul class="pulldown_menu" style="min-width:240px;">
                                    <li class="button" data-fn-tpl="=SORT(, 1, 1)">SORT - 範囲並べ替え</li>
                                    <li class="button" data-fn-tpl="=SORTBY(, , 1)">SORTBY - 別列基準並べ替え</li>
                                    <li class="button" data-fn-tpl="=TAKE(, 3)">TAKE - 先頭/末尾の行列取得</li>
                                    <li class="button" data-fn-tpl="=DROP(, 1)">DROP - 先頭/末尾の行列除外</li>
                                    <li class="button" data-fn-tpl="=EXPAND(, 5, 5, &quot;&quot;)">EXPAND - 配列サイズ拡張</li>
                                    <li class="button" data-fn-tpl="=LET(x, 10, x * 2)">LET - 変数定義計算</li>
                                    <li class="button" data-fn-tpl="=LAMBDA(x, x + 1)(5)">LAMBDA - カスタム関数</li>
                                    <li class="button" data-fn-tpl="=MAP(, LAMBDA(x, x * 2))">MAP - 各要素変換</li>
                                    <li class="button" data-fn-tpl="=REDUCE(0, , LAMBDA(a, b, a + b))">REDUCE - 累積畳み込み</li>
                                    <li class="button" data-fn-tpl="=SCAN(0, , LAMBDA(a, b, a + b))">SCAN - 累積中間結果配列</li>
                                    <li class="button" data-fn-tpl="=BYROW(, LAMBDA(r, SUM(r)))">BYROW - 行単位計算</li>
                                    <li class="button" data-fn-tpl="=BYCOL(, LAMBDA(c, SUM(c)))">BYCOL - 列単位計算</li>
                                </ul>
                            </div>
                        </div>
                        <div class="ss-ribbon-group-title">関数ライブラリ</div>
                    </div>

                    <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <span class="button" data-action="recalc-all" title="ブック全体の数式を再計算">🔄 再計算</span>
                        </div>
                        <div class="ss-ribbon-group-title">計算方法</div>
                    </div>
                </div>

                <!-- ==================== [データ] タブ ==================== -->
                <div class="ss-ribbon-panel" data-ribbon-panel="data">
                    <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <span class="button" data-sort="asc">A↓Z 昇順</span>
                            <span class="button" data-sort="desc">Z↓A 降順</span>
                            <span class="button ss-toggle-filter-btn" data-action="toggle-autofilter" title="オートフィルターの切り替え (Ctrl+Shift+L)">🔽 フィルター</span>
                            <span class="button" data-action="clear-autofilter" title="フィルター条件をすべてクリア">クリア</span>
                        </div>
                        <div class="ss-ribbon-group-title">並べ替えとフィルター</div>
                    </div>
                    <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <span class="button" data-action="data-validation" title="セルにドロップダウンリストを設定">📋 データの入力規則</span>
                        </div>
                        <div class="ss-ribbon-group-title">データツール</div>
                    </div>
                    <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <span class="button" data-action="import-local">CSV/NXS 読込</span>
                            <span class="button" data-action="export-nxs">NXS 出力</span>
                            <span class="button" data-action="export-csv-local">CSV 出力</span>
                        </div>
                        <div class="ss-ribbon-group-title">データの取得と変換</div>
                    </div>
                </div>

                <!-- ==================== [表示] タブ ==================== -->
                <div class="ss-ribbon-panel" data-ribbon-panel="view">
                    <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <div class="pulldown_menu_parent">
                                <span class="button pulldown_btn">ウィンドウ枠の固定 ▼</span>
                                <ul class="pulldown_menu" style="min-width:210px;">
                                    <li class="button" data-freeze="active">ウィンドウ枠の固定（選択セル基準）</li>
                                    <li class="button" data-freeze="top-row">先頭行の固定</li>
                                    <li class="button" data-freeze="first-col">先頭列の固定</li>
                                    <li class="ss-menu-sep"></li>
                                    <li class="button" data-freeze="unfreeze">ウィンドウ枠固定の解除</li>
                                </ul>
                            </div>
                        </div>
                        <div class="ss-ribbon-group-title">ウィンドウ</div>
                    </div>
                    <div class="ss-ribbon-group">
                        <div class="ss-ribbon-group-body">
                            <span class="button" data-action="zoom-100">100% に戻す</span>
                        </div>
                        <div class="ss-ribbon-group-title">ズーム</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 数式バー -->
        <div class="ss-formula-bar-container">
            <input type="text" class="border ss-selected-cells-display" value="A1" autocomplete="off" title="名前ボックス（セル番地や範囲を入力してEnterで移動）" />
            <span class="button mark_btn cross" data-action="revert-formula" title="キャンセル"></span>
            <span class="button mark_btn checkmark" data-action="commit-formula" title="確定"></span>
            <span class="button" data-action="focus-formulas-tab" style="height:26px; padding:0 8px; font-style:italic;" title="数式タブを開く">fx</span>
            <input type="text" class="ss-formula-bar border" autocomplete="off" placeholder="値または数式 (=XLOOKUP(...) / =FILTER(...) など) を入力..." />
        </div>

        <!-- スプレッドシート本体 -->
        <div class="ss-spreadsheet-container">
            <div class="ss-spreadsheet-content">
                <table class="ss-table">
                    <colgroup>
                        <col style="width: 54px;">
                    </colgroup>
                    <thead>
                        <tr>
                            <th class="ss-corner button" title="全セル選択">全選択</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
        </div>

        <!-- Excel準拠：シートタブ一覧 ＆ 横スクロールバー 同一エリア配置 -->
        <div class="ss-bottom-bar">
            <div class="ss-tabs-region">
                <div class="ss-tab-nav-btns">
                    <span class="button ss-tab-nav-btn" data-tab-scroll="left" title="前のシートタブへスクロール">◀</span>
                    <span class="button ss-tab-nav-btn" data-tab-scroll="right" title="次のシートタブへスクロール">▶</span>
                </div>
                <div class="ss-sheet-tabs-scroll">
                    <div class="ss-sheet-tabs-list"></div>
                </div>
                <span class="button ss-sheet-add-btn" title="新しいシートを追加">＋</span>
            </div>
            <div class="ss-bottom-splitter" title="ドラッグでシートタブと横スクロールバーの幅を調整">⋮</div>
            <div class="ss-h-scrollbar-track">
                <div class="ss-h-scrollbar-spacer"></div>
            </div>
        </div>

        <!-- フッターズーム＆ステータスバー -->
        <div class="ss-zoom-toolbar">
            <label class="border" style="padding:1px 4px;">拡大率:</label>
            <input type="range" class="ss-zoom-slider" min="20" max="200" value="100" step="5">
            <span class="ss-zoom-display" style="min-width:38px;">100%</span>
            <span class="border" style="padding:1px 6px;">状態: <span class="ss-loadingstate">準備完了</span></span>
            <div class="ss-progress-container" style="display:inline-block; width:100px; height:14px; border:1px solid #808080; background:#f0f0f0;">
                <div class="ss-progress-bar" style="height:100%; width:0%; background:#107c41;"></div>
            </div>
            <span class="border" style="padding:1px 6px;">ファイル: <span class="ss-current-file">無題.nxs</span></span>
            <span class="ss-storage-info" style="color:#222;"></span>
            <span class="border" style="padding:1px 6px;">用紙: <span class="ss-selected-size">A4</span></span>
        </div>
    </div>
    `;

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
    const loadingstate = appRoot.querySelector(".ss-loadingstate");
    const progressBar = appRoot.querySelector(".ss-progress-bar");
    const currentFileEl = appRoot.querySelector(".ss-current-file");
    const storageInfoEl = appRoot.querySelector(".ss-storage-info");
    const selectedCellsDisplay = appRoot.querySelector(".ss-selected-cells-display");
    const zoomSlider = appRoot.querySelector(".ss-zoom-slider");
    const zoomDisplay = appRoot.querySelector(".ss-zoom-display");

    const INITIAL_ROWS = 80;
    const ROW_BATCH = 10;
    const INITIAL_COLUMNS = 80;
    const COLUMN_BATCH = 10;

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
        if (currentFileEl) {
            currentFileEl.textContent = isDirty ? `${titleBase} *` : titleBase;
        }
        if (win && windowAPI?.updateWindowTitle) {
            windowAPI.updateWindowTitle(win, titleBase, isDirty);
        }
    }

    function updateOSStatusBar(text) {
        if (win?._statusBar) {
            win._statusBar.textContent = text;
        }
    }

    let findWin = null;
    let findDialogOpen = false;

    function isAppFocused() {
        if (document.querySelector(".modal-overlay")) return false;
        if (Array.from(document.querySelectorAll(".window")).some(w =>
            w._modal &&
            w.dataset.ssToolWindow !== "true" &&
            w.style.visibility !== "hidden" &&
            w.dataset.minimized !== "true"
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
            activeCoord: { row: 1, col: 0 },
            scrollTop: 0,
            scrollLeft: 0
        };
    }

    function renameSheetDialog(index) {
        const target = sheets[index];
        if (!target) return;
        const bodyHtml = `
            <div style="width:100%; display:flex; flex-direction:column; gap:8px;">
                <div>新しいシート名を入力してください:</div>
                <input type="text" class="ss-sheet-rename-input border" value="${target.name}" style="width:100%; padding:4px 6px; font-size:12px; background:#fff; color:#000; box-sizing:border-box;">
            </div>
        `;
        const modalContent = windowAPI.showModalWindow("シート名の変更", bodyHtml, {
            width: 340,
            isHtml: true,
            parentWin: win,
            buttons: [
                {
                    label: "OK",
                    onClick: () => {
                        const nextName = modalContent.querySelector(".ss-sheet-rename-input")?.value.trim();
                        if (!nextName || nextName === target.name) return;
                        if (sheets.some((s, i) => i !== index && s.name === nextName)) {
                            showAlert(`「${nextName}」という名前のシートは既に存在します。`, "名前の変更");
                            return;
                        }
                        const oldName = target.name;
                        target.name = nextName;
                        const escapedOld = oldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                        const sheetRefPattern = new RegExp(`(?:'${escapedOld}'|\\b${escapedOld})!`, "g");
                        const formattedNewPrefix = /^[A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+$/.test(nextName)
                            ? `${nextName}!`
                            : `'${nextName}'!`;

                        tbody.querySelectorAll("td[data-formula]").forEach(td => {
                            td.dataset.formula = td.dataset.formula.replace(sheetRefPattern, formattedNewPrefix);
                        });
                        sheets.forEach((s, idx) => {
                            if (idx === activeSheetIndex || !Array.isArray(s.cells)) return;
                            s.cells.forEach(entry => {
                                if (entry.f) entry.f = entry.f.replace(sheetRefPattern, formattedNewPrefix);
                            });
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
                    modalContent.querySelector(".button-container button")?.click();
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

    attachContextMenu(theadRow, (e) => {
        const colTh = e.target.closest("th.col_number");
        if (!colTh) return [];
        const c = parseInt(colTh.dataset.col, 10);
        const target = getVisibleCell(1, c);
        if (target) setActiveCell(target, false);
        return [
            { label: "列を左に挿入", action: () => void modifySheetRowCol("insert-col") },
            { label: "列を削除", action: () => void modifySheetRowCol("delete-col") },
            { label: "---" },
            { label: "列幅の自動調整", action: () => { autoFitColumn(c); setDirtyState(true); debouncedSaveState(); } }
        ];
    });

    attachContextMenu(tbody, (e) => {
        const rowTh = e.target.closest("th.row_number");
        if (!rowTh) return [];
        const r = parseInt(rowTh.textContent, 10);
        const target = getVisibleCell(r, 0);
        if (target) setActiveCell(target, false);
        return [
            { label: "行を上に挿入", action: () => void modifySheetRowCol("insert-row") },
            { label: "行を削除", action: () => void modifySheetRowCol("delete-row") },
            { label: "---" },
            { label: "行の高さの自動調整", action: () => { autoFitRow(getRow(r)); setDirtyState(true); debouncedSaveState(); } }
        ];
    });

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

    // =========================================================
    // 列名・座標変換・結合セル解決ヘルパー
    // =========================================================
    const colNameCache = [];
    function getColumnName(index) {
        if (colNameCache[index] !== undefined) return colNameCache[index];
        let n = index;
        let name = "";
        while (n >= 0) {
            name = String.fromCharCode((n % 26) + 65) + name;
            n = Math.floor(n / 26) - 1;
        }
        return (colNameCache[index] = name);
    }

    const colIndexCache = new Map();
    function columnLettersToIndex(letters) {
        const upper = letters.toUpperCase();
        if (colIndexCache.has(upper)) return colIndexCache.get(upper);
        let index = 0;
        for (let i = 0; i < upper.length; i++) {
            index = index * 26 + (upper.charCodeAt(i) - 64);
        }
        const res = index - 1;
        colIndexCache.set(upper, res);
        return res;
    }

    function getCellReference(cell) {
        if (!cell || !cell.dataset) return "";
        return getColumnName(parseInt(cell.dataset.col, 10)) + cell.dataset.row;
    }

    function getCellReferenceByCoord(row, col) {
        return getColumnName(col) + row;
    }

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
    const hScrollTrack = appRoot.querySelector(".ss-h-scrollbar-track");
    const hScrollSpacer = appRoot.querySelector(".ss-h-scrollbar-spacer");
    let syncingHScroll = false;

    let cachedTableWidth = 0;

    function syncHorizontalScrollbar() {
        if (!hScrollTrack || !hScrollSpacer) return;
        const zoom = parseFloat(spreadsheetContent.style.zoom || "1") || 1;
        const rawW = cachedTableWidth || table.offsetWidth;
        const contentW = Math.round(rawW * zoom);
        const viewW = container.clientWidth;
        const overflowW = Math.max(0, contentW - viewW);
        hScrollSpacer.style.width = `${hScrollTrack.clientWidth + overflowW}px`;
    }

    if (hScrollTrack) {
        let hScrollRaf = null;
        hScrollTrack.addEventListener("scroll", () => {
            if (syncingHScroll) return;
            if (hScrollRaf) cancelAnimationFrame(hScrollRaf);
            hScrollRaf = requestAnimationFrame(() => {
                syncingHScroll = true;
                container.scrollLeft = hScrollTrack.scrollLeft;
                syncingHScroll = false;
                hScrollRaf = null;
            });
        }, { passive: true, signal });

        container.addEventListener("scroll", () => {
            if (syncingHScroll) return;
            if (hScrollTrack.scrollLeft !== container.scrollLeft) {
                syncingHScroll = true;
                hScrollTrack.scrollLeft = container.scrollLeft;
                syncingHScroll = false;
            }
        }, { passive: true, signal });

        container.addEventListener("wheel", (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const cur = parseInt(zoomSlider?.value || "100", 10) || 100;
                const next = Math.max(20, Math.min(200, cur + (e.deltaY < 0 ? 10 : -10)));
                setZoom(next);
                return;
            }
            const deltaX = e.deltaX !== 0 ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
            if (deltaX === 0) return;
            e.preventDefault();
            hScrollTrack.scrollLeft += deltaX;
        }, { passive: false, signal });
    }

    function syncTableWidth() {
        let total = 0;
        for (const col of colgroup.children) {
            total += parseInt(col.style.width, 10) || 120;
        }
        cachedTableWidth = total;
        table.style.width = `${total}px`;
        syncHorizontalScrollbar();
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
            return;
        }

        const theadHeight = theadRow.offsetHeight || 30;
        const rowHeaderWidth = parseInt(colgroup.children[0]?.style.width, 10) || 54;

        const rowTopOffsets = [];
        let accTop = theadHeight;
        for (let r = 1; r <= freezeRows; r++) {
            rowTopOffsets[r] = accTop;
            const tr = getRow(r);
            accTop += tr ? (parseInt(tr.style.height, 10) || tr.offsetHeight || 30) : 30;
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
        const colEl = colgroup.children[colIndex + 1];
        return colEl ? (parseInt(colEl.style.width, 10) || 120) : 120;
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
            if (measureCtx) {
                measureCtx.font = `${fStyle} ${fWeight} ${fSize} 'MS PGothic', 'MS Gothic', sans-serif`;
            }
            for (const line of text.split("\n")) {
                const textW = measureCtx
                    ? measureCtx.measureText(line).width
                    : line.length * (parseInt(fSize, 10) || 14);
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
            const lineHeight = Math.ceil(fSize * 1.35);
            const text = cell.textContent || "";
            const lines = text.split("\n");
            let totalLines = lines.length;

            if (cell.style.whiteSpace === "pre-wrap" && text !== "") {
                if (measureCtx) {
                    measureCtx.font = `${fStyle} ${fWeight} ${fSize}px 'MS PGothic', 'MS Gothic', sans-serif`;
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
    }

    function attachColResizeHandle(th, colIndex) {
        if (th.querySelector(".col-resize-handle")) return;
        th.setAttribute("data-col", String(colIndex));
        const handle = document.createElement("div");
        handle.className = "col-resize-handle";
        handle.title = "ドラッグで幅変更 / ダブルクリックで自動調整";
        th.appendChild(handle);

        handle.addEventListener("mousedown", (e) => {
            e.stopPropagation();
            e.preventDefault();
            const startX = e.clientX;
            const startWidth = th.offsetWidth || getColumnWidth(colIndex);
            let moved = false;

            const onMove = (eMove) => {
                moved = true;
                const newWidth = Math.max(30, startWidth + (eMove.clientX - startX));
                setColumnWidth(colIndex, newWidth);
                updateResizeTooltip(eMove.clientX, eMove.clientY, `${newWidth}px`);
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
        }, { signal });

        handle.addEventListener("dblclick", (e) => {
            e.stopPropagation();
            e.preventDefault();
            const isWholeColSelected = (c) =>
                tbody.rows.length > 0 &&
                tbody.querySelectorAll(`td.selected[data-col="${c}"]`).length >= Math.min(tbody.rows.length, 10);

            if (isWholeColSelected(colIndex)) {
                const targetCols = new Set([colIndex]);
                tbody.querySelectorAll("td.selected").forEach(td => {
                    const c = Number(td.dataset.col);
                    if (isWholeColSelected(c)) targetCols.add(c);
                });
                targetCols.forEach(c => autoFitColumn(c));
            } else {
                autoFitColumn(colIndex);
            }
            setDirtyState(true);
            debouncedSaveState();
        }, { signal });
    }

    function attachRowResizeHandle(th, tr) {
        if (th.querySelector(".row-resize-handle")) return;
        const handle = document.createElement("div");
        handle.className = "row-resize-handle";
        handle.title = "ドラッグで高さ変更 / ダブルクリックで自動調整";
        th.appendChild(handle);

        handle.addEventListener("mousedown", (e) => {
            e.stopPropagation();
            e.preventDefault();
            const startY = e.clientY;
            const startHeight = tr.offsetHeight || 30;
            let moved = false;

            const onMove = (eMove) => {
                moved = true;
                const newHeight = Math.max(20, startHeight + (eMove.clientY - startY));
                tr.style.height = `${newHeight}px`;
                refreshVisibleRows();
                updateResizeTooltip(eMove.clientX, eMove.clientY, `${newHeight}px`);
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
        }, { signal });

        handle.addEventListener("dblclick", (e) => {
            e.stopPropagation();
            e.preventDefault();
            const rowNum = Number(tr.dataset.row);
            const isWholeRowSelected = (r) =>
                currentColumns > 0 &&
                tbody.querySelectorAll(`td.selected[data-row="${r}"]`).length >= Math.min(currentColumns, 10);

            if (isWholeRowSelected(rowNum)) {
                const targetRows = new Set([rowNum]);
                tbody.querySelectorAll("td.selected").forEach(td => {
                    const r = Number(td.dataset.row);
                    if (isWholeRowSelected(r)) targetRows.add(r);
                });
                targetRows.forEach(r => autoFitRow(getRow(r)));
            } else {
                autoFitRow(tr);
            }
            setDirtyState(true);
            debouncedSaveState();
        }, { signal });
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
            const r = row.cells[0].textContent;
            let newColsHTML = "";
            for (let c = start; c < end; c++) {
                newColsHTML += `<td tabindex="-1" contenteditable="false" data-row="${r}" data-col="${c}"></td>`;
            }
            row.insertAdjacentHTML("beforeend", newColsHTML);
        }
        currentColumns = end;
        syncTableWidth();
        if (freezeRows > 0 || freezeCols > 0) applyFreezePanes();
    }

    function loadRowsSync(count) {
        if (count <= 0) return;
        const frag = document.createDocumentFragment();
        for (let i = 0; i < count; i++, rowCount++) {
            const tr = document.createElement("tr");
            tr.dataset.row = String(rowCount);
            let cellsHTML = `<th class="row_number button">${rowCount}</th>`;
            for (let c = 0; c < currentColumns; c++) {
                cellsHTML += `<td tabindex="-1" contenteditable="false" data-row="${rowCount}" data-col="${c}"></td>`;
            }
            tr.innerHTML = cellsHTML;
            attachRowResizeHandle(tr.cells[0], tr);
            frag.appendChild(tr);
        }
        tbody.appendChild(frag);
        if (freezeRows > 0 || freezeCols > 0) applyFreezePanes();
    }

    // =========================================================
    // 数式評価エンジン（$絶対参照・複合参照・大小文字対応）
    // =========================================================
    const RANGE_REF_REGEX = /(?<![A-Za-z0-9_])(\$?[A-Za-z]+\$?\d+:\$?[A-Za-z]+\$?\d+)/g;
    const SINGLE_REF_REGEX = /(?<![A-Za-z0-9_])(\$?)([A-Za-z]+)(\$?)(\d+)/g;

    function isDateFormat(str) {
        return /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(str) || /^\d{4}\/\d{1,2}\/\d{1,2}$/.test(str);
    }
    function formatDate(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        return `${y}/${m}/${d}`;
    }

    function preprocessAllNestedIFs(expr) {
        const lits = [];
        const masked = expr.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, (m) => {
            const tok = `__IFSTR_${lits.length}__`;
            lits.push(m);
            return tok;
        });

        const transform = (src) => {
            let result = "";
            let i = 0;
            while (i < src.length) {
                const rest = src.slice(i);
                const match = rest.match(/^(IF|IFS|AND|OR|XOR|NOT)\s*\(/i);
                if (match && (i === 0 || !/[A-Za-z0-9_]/.test(src[i - 1]))) {
                    const fnName = match[1].toUpperCase();
                    let pos = i + match[0].length;
                    let depth = 0;
                    const args = [];
                    let currentArg = "";
                    for (; pos < src.length; pos++) {
                        const ch = src[pos];
                        if (ch === "(") depth++;
                        else if (ch === ")") {
                            if (depth === 0) break;
                            depth--;
                        } else if (ch === "," && depth === 0) {
                            args.push(currentArg);
                            currentArg = "";
                            continue;
                        }
                        currentArg += ch;
                    }
                    args.push(currentArg);

                    const convertedArgs = args.map((arg, idx) => {
                        const sub = transform(arg);
                        const isCondArg =
                            (fnName === "IF" && idx === 0) ||
                            (fnName === "IFS" && idx % 2 === 0) ||
                            fnName === "AND" || fnName === "OR" || fnName === "XOR" || fnName === "NOT";
                        return isCondArg ? sub.replace(/(?<![<>=!])=(?![=])/g, "==") : sub;
                    });
                    result += `${match[1]}(${convertedArgs.join(",")})`;
                    i = pos < src.length ? pos + 1 : pos;
                } else {
                    result += src[i];
                    i++;
                }
            }
            return result;
        };

        return transform(masked).replace(/__IFSTR_(\d+)__/g, (_, idx) => lits[Number(idx)]);
    }

    function parseFormattedNumber(rawStr) {
        const cleaned = String(rawStr ?? "")
            .trim()
            .replace(/[¥￥,、円\s]/g, "");
        if (cleaned === "") return NaN;
        if (cleaned.endsWith("%")) {
            const pct = Number(cleaned.slice(0, -1));
            return isNaN(pct) ? NaN : pct / 100;
        }
        return Number(cleaned);
    }

    function formatDisplayByNumFmt(rawVal, fmt, cell = null) {
        const str = String(rawVal ?? "");
        const hasDecimals = cell?.dataset?.decimalPlaces !== undefined && cell?.dataset?.decimalPlaces !== "";
        const dec = hasDecimals ? Math.max(0, Math.min(10, Number(cell.dataset.decimalPlaces))) : null;

        if ((!fmt || fmt === "general") && !hasDecimals) return str;
        if (str.trim() === "" || str.startsWith("#")) return str;
        if (fmt === "date-jp" || fmt === "date-md") {
            const m = str.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
            if (m) {
                return fmt === "date-jp"
                    ? `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日`
                    : `${Number(m[2])}/${Number(m[3])}`;
            }
            return str;
        }
        const num = parseFormattedNumber(str);
        if (isNaN(num)) return str;

        if (fmt === "comma") {
            return num.toLocaleString("ja-JP", {
                minimumFractionDigits: dec ?? 0,
                maximumFractionDigits: dec ?? 4
            });
        }
        if (fmt === "currency") {
            const digits = dec ?? 0;
            return "¥" + num.toLocaleString("ja-JP", {
                minimumFractionDigits: digits,
                maximumFractionDigits: digits
            });
        }
        if (fmt === "percent") {
            const pct = num * 100;
            return dec !== null ? `${pct.toFixed(dec)}%` : `${pct.toFixed(1).replace(/\.0$/, "")}%`;
        }
        if (dec !== null) {
            return num.toFixed(dec);
        }
        return str;
    }

    function updateCellAutoAlignment(cell, rawStr) {
        cell.classList.remove("ss-auto-align-right", "ss-auto-align-center");
        const trimmed = String(rawStr ?? "").trim();
        if (trimmed === "") return;

        const upper = trimmed.toUpperCase();
        if (
            upper === "TRUE" ||
            upper === "FALSE" ||
            /^#(ERROR!|DIV\/0!|N\/A|VALUE!|CIRCULAR!|REF!|NAME\?|NUM!|CALC!)$/.test(upper)
        ) {
            cell.classList.add("ss-auto-align-center");
            return;
        }

        const isNumeric = !isNaN(parseFormattedNumber(trimmed));
        const isDate = cell.dataset.valueType === "date" || isDateFormat(trimmed);
        if (isNumeric || isDate) {
            cell.classList.add("ss-auto-align-right");
        }
    }

    function setCellFormattedValue(cell, rawVal) {
        const rawStr = String(rawVal ?? "");
        if (rawStr === "") {
            delete cell.dataset.rawValue;
            delete cell.dataset.valueType;
            delete cell.dataset.dateValue;
            cell.textContent = "";
            cell.classList.remove("ss-auto-align-right", "ss-auto-align-center");
            return;
        }
        const fmt = cell.dataset.numFormat;
        if (fmt && fmt !== "general" && !rawStr.startsWith("#")) {
            const parsed = parseFormattedNumber(rawStr);
            cell.dataset.rawValue = !isNaN(parsed) ? String(parsed) : rawStr;
        } else {
            cell.dataset.rawValue = rawStr;
        }
        cell.textContent = formatDisplayByNumFmt(cell.dataset.rawValue, fmt, cell);
        updateCellAutoAlignment(cell, cell.dataset.rawValue);
    }

    function toJSValueLiteral(val, blankAsZero = false) {
        if (val === "" || val == null) return blankAsZero ? "0" : '""';
        if (typeof val === "number") return isFinite(val) ? String(val) : "0";
        return JSON.stringify(String(val));
    }

    const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
    function dateToSerial(dateObj) {
        const utc = Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
        return Math.round((utc - EXCEL_EPOCH_MS) / 86400000);
    }
    function serialToDate(serial) {
        const d = new Date(EXCEL_EPOCH_MS + Math.round(Number(serial)) * 86400000);
        return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    }
    function tryParseDateToSerial(str) {
        const m = String(str ?? "").trim().match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
        if (!m) return null;
        const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        return isNaN(dt.getTime()) ? null : dateToSerial(dt);
    }

    const compiledFormulaCache = new Map();
    const formulaEvalCache = new Map();
    let isBatchRecalculating = false;

    function getSheetCellValue(sheetIdx, row, col, visited = new Set()) {
        const cellKey = `${sheetIdx}:${row},${col}`;
        if (formulaEvalCache.has(cellKey)) {
            return formulaEvalCache.get(cellKey);
        }

        if (sheetIdx === activeSheetIndex || !sheets[sheetIdx]) {
            const cell = peekCell(row, col);
            if (!cell) return "";
            if (cell.dataset.formula) {
                if (visited.has(cellKey)) return "#CIRCULAR!";
                visited.add(cellKey);
                try {
                    const evaluated = evaluateFormula(cell.dataset.formula, visited, sheetIdx);
                    if (evaluated === "#CIRCULAR!") return "#CIRCULAR!";
                    const dateSerial = tryParseDateToSerial(evaluated);
                    const finalVal = dateSerial !== null
                        ? dateSerial
                        : ((evaluated !== "" && !isNaN(Number(evaluated))) ? Number(evaluated) : evaluated);
                    formulaEvalCache.set(cellKey, finalVal);
                    return finalVal;
                } finally {
                    visited.delete(cellKey);
                }
            }
            const contentStr = (cell.dataset.rawValue ?? cell.textContent).trim();
            if (contentStr === "") return "";
            const dateSerial = tryParseDateToSerial(contentStr);
            if (dateSerial !== null) return dateSerial;
            const num = Number(contentStr.replace(/,/g, ""));
            return isNaN(num) ? contentStr : num;
        }

        const targetSheet = sheets[sheetIdx];
        const entry = targetSheet.cells.find(item => Number(item.r) === row && Number(item.c) === col);
        if (!entry) return "";
        if (entry.f) {
            const cellKey = `${sheetIdx}:${row},${col}`;
            if (visited.has(cellKey)) return "#CIRCULAR!";
            visited.add(cellKey);
            try {
                const evaluated = evaluateFormula(entry.f, visited, sheetIdx);
                const num = Number(evaluated);
                return (evaluated !== "" && !isNaN(num)) ? num : evaluated;
            } finally {
                visited.delete(cellKey);
            }
        }
        const raw = String(entry.v ?? "").trim();
        if (raw === "") return "";
        const dateSerial = tryParseDateToSerial(raw);
        if (dateSerial !== null) return dateSerial;
        const num = Number(raw.replace(/,/g, ""));
        return isNaN(num) ? raw : num;
    }

    function getCellEvaluatedValue(cell, visited = new Set()) {
        if (!cell) return "";
        return getSheetCellValue(activeSheetIndex, parseInt(cell.dataset.row, 10), parseInt(cell.dataset.col, 10), visited);
    }

    function buildRange2DLiteral(sheetIdx, startRef, endRef, visited) {
        const startMatch = startRef?.match(/^\$?([A-Za-z]+)\$?(\d+)$/);
        const endMatch = endRef?.match(/^\$?([A-Za-z]+)\$?(\d+)$/);
        if (!startMatch || !endMatch) return "[]";

        const startCol = columnLettersToIndex(startMatch[1]);
        const startRow = parseInt(startMatch[2], 10);
        const endCol = columnLettersToIndex(endMatch[1]);
        const endRow = parseInt(endMatch[2], 10);

        const rStart = Math.min(startRow, endRow);
        const rEnd = Math.min(Math.max(startRow, endRow), rowCount - 1);
        const cStart = Math.min(startCol, endCol);
        const cEnd = Math.min(Math.max(startCol, endCol), currentColumns - 1);
        const matrix = [];
        for (let r = rStart; r <= rEnd; r++) {
            const rowVals = [];
            for (let c = cStart; c <= cEnd; c++) {
                const val = getSheetCellValue(sheetIdx, r, c, visited);
                rowVals.push(toJSValueLiteral(val, false));
            }
            matrix.push(`[${rowVals.join(",")}]`);
        }
        return `[${matrix.join(",")}]`;
    }

    const CROSS_SHEET_RANGE_REGEX = /(?:'([^']+)'|([A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+))!(\$?[A-Z]+\$?\d+):(\$?[A-Z]+\$?\d+)/g;
    const CROSS_SHEET_CELL_REGEX = /(?:'([^']+)'|([A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+))!(\$?[A-Z]+\$?\d+)/g;

    function evaluateFormula(formula, visited = new Set(), contextSheetIdx = activeSheetIndex) {
        if (!formula) return formula;
        if (formula === "=") return "=";
        if (formula[0] !== "=") return formula;

        let expr = formula.substring(1).trim();
        if (!expr) return "=";

        try {
            expr = preprocessAllNestedIFs(expr);

            // シート名クォート('Sheet 2'!)を壊さないよう文字列リテラルを退避
            const stringLiterals = [];
            expr = expr.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'(?!\s*!)/g, (m) => {
                const token = `__STR_LIT_${stringLiterals.length}__`;
                stringLiterals.push(m);
                return token;
            });

            // Excel演算子・リテラル・関数名の大文字正規化（<>, &, 単独=, %, TRUE/FALSE, sum( -> SUM(）
            expr = expr
                .replace(/<>/g, "!==")
                .replace(/(?<![<>!=])=(?!=)/g, "==")
                .replace(/(?<!&)&(?!&)/g, "+")
                .replace(/(\d+(?:\.\d+)?)%/g, "($1/100)")
                .replace(/\bTRUE\b/gi, "true")
                .replace(/\bFALSE\b/gi, "false")
                .replace(/\b([A-Za-z_][A-Za-z0-9_]*)\s*(?=\()/g, (_, fn) => fn.toUpperCase());

            // 他シート範囲参照（例: Sheet2!A1:C5 / '売上表'!A1:C5）
            expr = expr.replace(CROSS_SHEET_RANGE_REGEX, (_, qName, plainName, sRef, eRef) => {
                const sName = qName ?? plainName;
                const sIdx = sheets.findIndex(s => s.name === sName);
                if (sIdx === -1) return "[]";
                return buildRange2DLiteral(sIdx, sRef, eRef, visited);
            });

            // 他シート単一セル参照（例: Sheet2!B3）
            expr = expr.replace(CROSS_SHEET_CELL_REGEX, (_, qName, plainName, cellRef) => {
                const sName = qName ?? plainName;
                const sIdx = sheets.findIndex(s => s.name === sName);
                if (sIdx === -1) return "0";
                const m = cellRef.match(/^\$?([A-Z]+)\$?(\d+)$/);
                if (!m) return "0";
                const val = getSheetCellValue(sIdx, parseInt(m[2], 10), columnLettersToIndex(m[1]), visited);
                return toJSValueLiteral(val, true);
            });

            // 自シート範囲参照（2次元配列として展開）
            expr = expr.replace(RANGE_REF_REGEX, (match) => {
                const [startRef, endRef] = match.split(":");
                return buildRange2DLiteral(contextSheetIdx, startRef, endRef, visited);
            });

            // 自シート単一セル参照
            expr = expr.replace(SINGLE_REF_REGEX, (_, _absC, colLetters, _absR, rowStr) => {
                const colIndex = columnLettersToIndex(colLetters);
                const rowNumber = parseInt(rowStr, 10);
                const val = getSheetCellValue(contextSheetIdx, rowNumber, colIndex, visited);
                return toJSValueLiteral(val, true);
            });

            expr = expr.replace(/__STR_LIT_(\d+)__/g, (_, idx) => stringLiterals[Number(idx)]);

            let evaluator = compiledFormulaCache.get(expr);
            if (!evaluator) {
                evaluator = new Function(...FORMULA_FN_NAMES, `"use strict"; return (${expr});`);
                if (compiledFormulaCache.size > 2000) compiledFormulaCache.clear();
                compiledFormulaCache.set(expr, evaluator);
            }
            const result = evaluator(...FORMULA_FN_VALUES);
            if (result instanceof Date && !isNaN(result.getTime())) {
                return formatDate(result);
            }
            if (Array.isArray(result)) {
                return result;
            }
            const singleRefMatch = formula.trim().match(/^=(?:(?:'([^']+)'|([A-Za-z0-9_\u3040-\u30FF\u4E00-\u9FAF]+))!)?\$?([A-Z]+)\$?(\d+)$/);
            let isDirectDateRef = false;
            if (singleRefMatch) {
                const refSheetName = singleRefMatch[1] ?? singleRefMatch[2];
                const targetSIdx = refSheetName ? sheets.findIndex(s => s.name === refSheetName) : contextSheetIdx;
                const refCol = columnLettersToIndex(singleRefMatch[3]);
                const refRow = parseInt(singleRefMatch[4], 10);
                if (targetSIdx === activeSheetIndex) {
                    const refCell = peekCell(refRow, refCol);
                    isDirectDateRef = refCell?.dataset.valueType === "date" || isDateFormat((refCell?.dataset.rawValue ?? refCell?.textContent ?? "").trim());
                } else if (sheets[targetSIdx]) {
                    const entry = sheets[targetSIdx].cells.find(item => Number(item.r) === refRow && Number(item.c) === refCol);
                    isDirectDateRef = entry?.vt === "date" || isDateFormat(String(entry?.v ?? "").trim());
                }
            }
            const hasDateOp = isDirectDateRef ||
                /\b(TODAY|NOW|DATE|EDATE|EOMONTH|WORKDAY)\s*\(/i.test(formula) ||
                (typeof result === "number" && result >= 36526 && result <= 73050 && /[+-]/.test(expr));
            if (hasDateOp && typeof result === "number" && isFinite(result)) {
                return formatDate(serialToDate(result));
            }
            return typeof result === "function" ? "" : result;
        } catch {
            return "#ERROR!";
        } finally {
            visited.delete(formula);
        }
    }

    function updateTextOverflowDisplay() {
        for (const tr of tbody.rows) {
            const cells = tr.cells;
            for (let c = 0; c < cells.length - 1; c++) {
                const td = cells[c + 1];
                if (!td || td.style.display === "none") continue;
                td.classList.remove("ss-text-overflow", "ss-has-content");

                const text = td.textContent;
                if (!text || text.trim() === "") continue;
                td.classList.add("ss-has-content");

                if (td.style.whiteSpace === "pre-wrap" || td.isContentEditable) continue;
                const align = td.style.textAlign || (
                    td.classList.contains("ss-auto-align-right") ? "right" :
                        td.classList.contains("ss-auto-align-center") ? "center" : "left"
                );
                if (align !== "left") continue;

                const colSpan = parseInt(td.getAttribute("colspan") || "1", 10);
                const nextTd = cells[c + colSpan + 1];
                const isNextEmpty = nextTd && nextTd.style.display !== "none" && nextTd.textContent === "";
                if (isNextEmpty) {
                    td.classList.add("ss-text-overflow");
                }
            }
        }
    }

    function matchConditionalRule(rule, rawVal, duplicateSet = null) {
        const str = String(rawVal ?? "").trim();
        const op = rule.op || "expr";
        if (op === "expr") return buildConditionMatcher(rule.condition)(rawVal);
        if (op === "blank") return str === "";
        if (op === "notBlank") return str !== "";
        if (op === "contains") return str !== "" && str.toLowerCase().includes(String(rule.val1 ?? "").toLowerCase());
        if (op === "notContains") return !str.toLowerCase().includes(String(rule.val1 ?? "").toLowerCase());
        if (op === "duplicate") return str !== "" && duplicateSet?.has(str);

        const num = parseFormattedNumber(str);
        const v1 = Number(rule.val1);
        const v2 = Number(rule.val2);
        if (op === "between") return !isNaN(num) && !isNaN(v1) && !isNaN(v2) && num >= Math.min(v1, v2) && num <= Math.max(v1, v2);
        return buildConditionMatcher(`${op}${rule.val1 ?? ""}`)(rawVal);
    }

    function applyConditionalFormats() {
        const rules = sheets[activeSheetIndex]?.conditionalFormats || [];
        tbody.querySelectorAll("td[data-cf-applied]").forEach(td => {
            td.style.backgroundColor = td.dataset.cfOrigBg || "";
            td.style.color = td.dataset.cfOrigColor || "";
            td.style.fontWeight = td.dataset.cfOrigWeight || "";
            delete td.dataset.cfApplied;
        });
        if (!rules.length) return;

        for (const rule of rules) {
            let duplicateSet = null;
            if (rule.op === "duplicate") {
                const counts = new Map();
                for (let r = rule.minRow; r <= rule.maxRow; r++) {
                    for (let c = rule.minCol; c <= rule.maxCol; c++) {
                        const v = String(getVisibleCell(r, c)?.dataset.rawValue ?? getVisibleCell(r, c)?.textContent ?? "").trim();
                        if (v !== "") counts.set(v, (counts.get(v) || 0) + 1);
                    }
                }
                duplicateSet = new Set(Array.from(counts.entries()).filter(([, cnt]) => cnt > 1).map(([k]) => k));
            }

            for (let r = rule.minRow; r <= rule.maxRow; r++) {
                for (let c = rule.minCol; c <= rule.maxCol; c++) {
                    const td = getVisibleCell(r, c);
                    if (!td) continue;
                    const rawVal = td.dataset.rawValue ?? td.textContent;
                    if (matchConditionalRule(rule, rawVal, duplicateSet)) {
                        if (!td.dataset.cfApplied) {
                            td.dataset.cfOrigBg = td.style.backgroundColor || "";
                            td.dataset.cfOrigColor = td.style.color || "";
                            td.dataset.cfOrigWeight = td.style.fontWeight || "";
                            td.dataset.cfApplied = "1";
                        }
                        if (rule.bgColor) td.style.backgroundColor = rule.bgColor;
                        if (rule.textColor) td.style.color = rule.textColor;
                        if (rule.bold) td.style.fontWeight = "bold";
                    }
                }
            }
        }
    }

    function openConditionalFormatModal() {
        const bounds = getSelectedRangeBounds();
        if (!bounds) return;
        const rangeLabel = `${getColumnName(bounds.minCol)}${bounds.minRow}:${getColumnName(bounds.maxCol)}${bounds.maxRow}`;
        const bodyHtml = `
            <div style="width:100%; display:flex; flex-direction:column; gap:8px; font-size:12px;">
                <div>適用範囲: <b>${rangeLabel}</b></div>
                <div style="display:flex; gap:6px; align-items:center;">
                    <label style="width:72px;">条件:</label>
                    <select class="ss-cf-op border" style="flex:1; height:24px; background:#fff; color:#000;">
                        <option value=">">次の値より大きい (&gt;)</option>
                        <option value=">=">次の値以上 (&gt;=)</option>
                        <option value="<">次の値より小さい (&lt;)</option>
                        <option value="<=">次の値以下 (&lt;=)</option>
                        <option value="=">次の値に等しい (=)</option>
                        <option value="<>">次の値に等しくない (&lt;&gt;)</option>
                        <option value="between">次の値の間</option>
                        <option value="contains">次の文字列を含む</option>
                        <option value="duplicate">重複する値</option>
                        <option value="blank">空白セル</option>
                    </select>
                </div>
                <div class="ss-cf-vals-row" style="display:flex; gap:6px; align-items:center;">
                    <label style="width:72px;">値:</label>
                    <input type="text" class="ss-cf-v1 border" placeholder="基準値" style="flex:1; height:24px; padding:2px 4px; background:#fff; color:#000;">
                    <input type="text" class="ss-cf-v2 border" placeholder="上限値" style="display:none; flex:1; height:24px; padding:2px 4px; background:#fff; color:#000;">
                </div>
                <div style="display:flex; gap:8px; align-items:center;">
                    <label>背景色: <input type="color" class="ss-cf-bg" value="#ffc7ce"></label>
                    <label>文字色: <input type="color" class="ss-cf-fg" value="#9c0006"></label>
                    <label style="display:inline-flex; align-items:center; gap:3px;"><input type="checkbox" class="ss-cf-bold" checked> 太字</label>
                </div>
            </div>
        `;
        const modalContent = windowAPI.showModalWindow("新しい条件付き書式ルール", bodyHtml, {
            width: 390,
            isHtml: true,
            parentWin: win,
            buttons: [
                {
                    label: "適用",
                    onClick: () => {
                        const op = modalContent.querySelector(".ss-cf-op").value;
                        const val1 = modalContent.querySelector(".ss-cf-v1").value.trim();
                        const val2 = modalContent.querySelector(".ss-cf-v2").value.trim();
                        const bgColor = modalContent.querySelector(".ss-cf-bg").value;
                        const textColor = modalContent.querySelector(".ss-cf-fg").value;
                        const bold = modalContent.querySelector(".ss-cf-bold").checked;
                        sheets[activeSheetIndex].conditionalFormats.push({
                            ...bounds, op, val1, val2, bgColor, textColor, bold
                        });
                        applyConditionalFormats();
                        setDirtyState(true);
                        debouncedSaveState();
                    }
                },
                { label: "キャンセル" }
            ]
        });
        const opSel = modalContent.querySelector(".ss-cf-op");
        const v2Inp = modalContent.querySelector(".ss-cf-v2");
        const valsRow = modalContent.querySelector(".ss-cf-vals-row");
        opSel.addEventListener("change", () => {
            v2Inp.style.display = opSel.value === "between" ? "block" : "none";
            valsRow.style.display = ["duplicate", "blank"].includes(opSel.value) ? "none" : "flex";
        });
    }

    function openConditionalFormatManager() {
        const rules = sheets[activeSheetIndex]?.conditionalFormats || [];
        const listHtml = rules.length === 0
            ? `<div style="padding:12px; color:#555;">設定されているルールはありません。</div>`
            : rules.map((r, idx) => {
                const rng = `${getColumnName(r.minCol)}${r.minRow}:${getColumnName(r.maxCol)}${r.maxRow}`;
                const desc = r.condition || `${r.op} ${r.val1 || ""} ${r.val2 ? "〜 " + r.val2 : ""}`;
                return `<div style="display:flex; justify-content:space-between; align-items:center; padding:4px 6px; border-bottom:1px solid #ccc;">
                    <span><b>${rng}</b> : ${desc} <span style="display:inline-block; padding:0 4px; background:${r.bgColor}; color:${r.textColor};">書式</span></span>
                    <button type="button" data-del-cf="${idx}" style="font-size:11px;">削除</button>
                </div>`;
            }).join("");

        const modalContent = windowAPI.showModalWindow("条件付き書式ルールの管理", `
            <div style="width:100%; max-height:240px; overflow-y:auto; background:#fff; border:1px solid #808080;">${listHtml}</div>
        `, {
            width: 420,
            isHtml: true,
            parentWin: win,
            buttons: [{ label: "閉じる" }]
        });
        modalContent.querySelectorAll("[data-del-cf]").forEach(btn => {
            btn.addEventListener("click", () => {
                const idx = Number(btn.dataset.delCf);
                sheets[activeSheetIndex].conditionalFormats.splice(idx, 1);
                btn.parentElement.remove();
                applyConditionalFormats();
                setDirtyState(true);
                debouncedSaveState();
            });
        });
    }

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

    function updateAllFormulas() {
        formulaEvalCache.clear();
        isBatchRecalculating = true;
        try {
            recalculateBackgroundSheets();
            const formulaCells = Array.from(tbody.querySelectorAll("td[data-formula]"));
            formulaCells.forEach(cell => {
                if (cell.isContentEditable) return;
                const r = parseInt(cell.dataset.row, 10);
                const c = parseInt(cell.dataset.col, 10);
                clearSpillCellsFromAnchor(r, c);

                const cellKey = `${activeSheetIndex}:${r},${c}`;
                const visited = new Set([cellKey]);
                const rawResult = evaluateFormula(cell.dataset.formula, visited, activeSheetIndex);

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
        } finally {
            isBatchRecalculating = false;
            formulaEvalCache.clear();
        }
        applyConditionalFormats();
        updateTextOverflowDisplay();
        updateAllFloatingCharts();
    }

    // =========================================================
    // ハイライト・選択範囲表示・統計
    // =========================================================
    function clearCalculationRangeHighlights() {
        tbody.querySelectorAll("td[data-calc-highlight]").forEach(cell => {
            cell.style.boxShadow = "";
            cell.style.backgroundColor = cell.dataset.origBg ?? cell.style.backgroundColor;
            delete cell.dataset.origBg;
            delete cell.dataset.calcHighlight;
        });
    }

    function parseCellReference(ref) {
        const match = ref.match(/^\$?([A-Z]+)\$?(\d+)$/);
        if (!match) return null;
        return {
            col: columnLettersToIndex(match[1]),
            row: parseInt(match[2], 10)
        };
    }

    function parseRangeReference(rangeRef) {
        const parts = rangeRef.split(":");
        if (parts.length !== 2) return null;
        const start = parseCellReference(parts[0]);
        const end = parseCellReference(parts[1]);
        if (!start || !end) return null;
        return { start, end };
    }

    function highlightCalculationRange(formula) {
        clearCalculationRangeHighlights();
        const palette = ["blue", "red", "yellowgreen", "purple", "yellow", "blueviolet", "mediumvioletred"];
        const groups = formula.includes(",")
            ? formula.split(",").map(s => s.trim()).filter(Boolean)
            : [...new Set((formula.match(/\$?[A-Z]+\$?\d+(?::\$?[A-Z]+\$?\d+)?/g) || []))];

        for (let i = 0; i < groups.length; i++) {
            const color = palette[i % palette.length];
            const refs = groups[i].match(/\$?[A-Z]+\$?\d+(?::\$?[A-Z]+\$?\d+)?/g) || [];
            for (const ref of refs) {
                if (ref.includes(":")) {
                    const range = parseRangeReference(ref);
                    if (!range) continue;
                    const minR = Math.max(1, Math.min(range.start.row, range.end.row));
                    const maxR = Math.min(rowCount - 1, Math.max(range.start.row, range.end.row));
                    const minC = Math.max(0, Math.min(range.start.col, range.end.col));
                    const maxC = Math.min(currentColumns - 1, Math.max(range.start.col, range.end.col));
                    for (let r = minR; r <= maxR; r++) {
                        for (let c = minC; c <= maxC; c++) {
                            const cell = peekCell(r, c);
                            if (!cell) continue;
                            const shadows = [];
                            if (r === minR) shadows.push(`inset 0 2px 0 0 ${color}`);
                            if (r === maxR) shadows.push(`inset 0 -2px 0 0 ${color}`);
                            if (c === minC) shadows.push(`inset 2px 0 0 0 ${color}`);
                            if (c === maxC) shadows.push(`inset -2px 0 0 0 ${color}`);
                            if (shadows.length) cell.style.boxShadow = shadows.join(", ");
                            cell.dataset.calcHighlight = "1";
                        }
                    }
                } else {
                    const pos = parseCellReference(ref);
                    if (!pos) continue;
                    const cell = peekCell(pos.row, pos.col);
                    if (cell) {
                        cell.style.boxShadow = `inset 0 2px 0 0 ${color}, inset 0 -2px 0 0 ${color}, inset 2px 0 0 0 ${color}, inset -2px 0 0 0 ${color}`;
                        cell.dataset.calcHighlight = "1";
                    }
                }
            }
        }
    }

    function updateToolbarState() {
        const target = activeCell || tbody.querySelector("td.selected");
        if (!target) return;

        const computed = getComputedStyle(target);
        const select = appRoot.querySelector(".ss-font-size");
        if (select) {
            const currentSize = target.style.fontSize || computed.fontSize;
            for (const opt of select.options) opt.selected = opt.value === currentSize;
        }

        const isBold = target.style.fontWeight === "bold" || Number(computed.fontWeight) >= 600;
        appRoot.querySelector(".ss-toggle-bold")?.classList.toggle("selected", isBold);
        appRoot.querySelector(".ss-toggle-italic")?.classList.toggle("selected", target.style.fontStyle === "italic");
        appRoot.querySelector(".ss-toggle-underline")?.classList.toggle("selected", (target.style.textDecoration || "").includes("underline"));
        appRoot.querySelector(".ss-toggle-textshadow")?.classList.toggle("selected", Boolean(target.style.textShadow && target.style.textShadow !== "none"));

        const align = target.style.textAlign || "left";
        appRoot.querySelectorAll("[data-align]").forEach(btn => {
            btn.classList.toggle("selected", btn.dataset.align === align);
        });

        const valign = target.style.verticalAlign || "middle";
        appRoot.querySelector(".ss-valign-top")?.classList.toggle("selected", valign === "top");
        appRoot.querySelector(".ss-valign-middle")?.classList.toggle("selected", valign === "middle");
        appRoot.querySelector(".ss-valign-bottom")?.classList.toggle("selected", valign === "bottom");

        appRoot.querySelector(".ss-toggle-wrap")?.classList.toggle("selected", target.style.whiteSpace === "pre-wrap");

        const numFmt = target.dataset.numFormat || "general";
        appRoot.querySelectorAll("[data-numfmt]").forEach(btn => {
            btn.classList.toggle("selected", btn.dataset.numfmt === numFmt);
        });
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
        updateSelectionEdges();
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

    selectedCellsDisplay.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            e.preventDefault();
            selectedCellsDisplay.blur();
            updateSelectedCellsDisplay();
            if (activeCell) activeCell.focus({ preventScroll: true });
            return;
        }
        if (e.key !== "Enter") return;
        e.preventDefault();
        const inputRef = selectedCellsDisplay.value.trim().toUpperCase();
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
    function closeCellDropdownList() {
        document.querySelectorAll(".ss-cell-dropdown-list").forEach(el => el.remove());
    }

    function resolveCellDropdownItems(spec) {
        const raw = String(spec ?? "").trim();
        if (!raw) return [];
        if (raw.startsWith("=")) {
            const range = parseRangeReference(raw.slice(1).trim().toUpperCase());
            if (!range) return [];
            const items = [];
            for (let r = Math.min(range.start.row, range.end.row); r <= Math.max(range.start.row, range.end.row); r++) {
                for (let c = Math.min(range.start.col, range.end.col); c <= Math.max(range.start.col, range.end.col); c++) {
                    const v = (getVisibleCell(r, c)?.textContent ?? "").trim();
                    if (v !== "" && !items.includes(v)) items.push(v);
                }
            }
            return items;
        }
        return raw.split(/[,、]/).map(s => s.trim()).filter(Boolean);
    }

    function openCellDropdownList(cell, anchorBtn) {
        closeCellDropdownList();
        const items = resolveCellDropdownItems(cell.dataset.dropdownList);
        if (!items.length) return;

        const rect = (anchorBtn || cell).getBoundingClientRect();
        const menu = document.createElement("div");
        menu.className = "ss-cell-dropdown-list";
        menu.style.left = `${Math.min(window.innerWidth - 150, Math.max(4, cell.getBoundingClientRect().left))}px`;
        menu.style.top = `${Math.min(window.innerHeight - 210, rect.bottom + 1)}px`;
        menu.style.minWidth = `${Math.max(110, cell.offsetWidth)}px`;

        items.forEach(itemText => {
            const row = document.createElement("div");
            row.className = "ss-cell-dropdown-item";
            row.textContent = itemText;
            row.addEventListener("mousedown", (e) => {
                e.preventDefault();
                e.stopPropagation();
                commitCellValue(cell, itemText);
                formulaBarInput.value = itemText;
                updateSelectedCellsDisplay();
                closeCellDropdownList();
                cell.focus({ preventScroll: true });
            });
            menu.appendChild(row);
        });
        document.body.appendChild(menu);
    }

    function openDataValidationDialog() {
        const targets = getTargetCells();
        if (!targets.length) return;
        const currentSpec = targets[0].dataset.dropdownList || "";
        const bodyHtml = `
            <div style="width:100%; display:flex; flex-direction:column; gap:8px; font-size:12px;">
                <div>入力値の種類: <b>リスト（ドロップダウン）</b></div>
                <div>元の値（カンマ区切り、または <code>=A1:A5</code> の範囲参照）:</div>
                <input type="text" class="ss-dv-list-input border" value="${currentSpec.replace(/"/g, "&quot;")}" placeholder="例: 未着手,進行中,完了 または =D1:D5" style="width:100%; padding:4px 6px; font-size:12px; background:#fff; color:#000;">
                <div style="font-size:11px; color:#444;">※空欄にしてOKを押すとプルダウン設定を解除します。</div>
            </div>
        `;
        const modalContent = windowAPI.showModalWindow("データの入力規則", bodyHtml, {
            width: 390,
            isHtml: true,
            parentWin: win,
            buttons: [
                {
                    label: "OK",
                    onClick: () => {
                        const val = modalContent.querySelector(".ss-dv-list-input")?.value.trim() || "";
                        targets.forEach(td => {
                            if (val) td.dataset.dropdownList = val;
                            else delete td.dataset.dropdownList;
                        });
                        if (activeCell) setActiveCell(activeCell, true);
                        setDirtyState(true);
                        debouncedSaveState();
                    }
                },
                { label: "キャンセル" }
            ]
        });
        const inp = modalContent?.querySelector(".ss-dv-list-input");
        if (inp) { inp.focus(); inp.select(); }
    }

    function setActiveCell(cell, shouldFocus = true) {
        if (!cell) return;
        closeCellDropdownList();
        tbody.querySelectorAll(".ss-cell-dropdown-btn").forEach(b => b.remove());
        tbody.querySelectorAll("td.active-cell").forEach(c => c.classList.remove("active-cell"));
        activeCell = cell;
        activeCell.classList.add("active-cell");
        if (!activeCell.classList.contains("selected")) {
            activeCell.classList.add("selected");
        }
        if (activeCell.dataset.dropdownList && !activeCell.isContentEditable) {
            const ddBtn = document.createElement("span");
            ddBtn.className = "ss-cell-dropdown-btn";
            ddBtn.textContent = "▼";
            ddBtn.title = "リストから選択 (Alt+↓)";
            ddBtn.addEventListener("mousedown", (e) => {
                e.preventDefault();
                e.stopPropagation();
                openCellDropdownList(activeCell, ddBtn);
            });
            activeCell.appendChild(ddBtn);
        }
        if (shouldFocus && !activeCell.isContentEditable) {
            const curFocused = document.activeElement;
            if (curFocused && curFocused !== activeCell && (curFocused === formulaBarInput || curFocused.closest(".floating-textbox"))) {
                curFocused.blur();
            }
            activeCell.focus({ preventScroll: true });
        }
        if (activeCell.dataset.formula) {
            formulaBarInput.value = activeCell.dataset.formula;
        } else if (activeCell.dataset.spillOrigin) {
            const [sr, sc] = activeCell.dataset.spillOrigin.split(",").map(Number);
            const originCell = peekCell(sr, sc);
            formulaBarInput.value = originCell?.dataset.formula || (activeCell.dataset.rawValue ?? activeCell.textContent);
        } else {
            formulaBarInput.value = activeCell.dataset.rawValue ?? activeCell.textContent;
        }
    }

    const SEL_EDGE_CLASSES = ["sel-edge-top", "sel-edge-bottom", "sel-edge-left", "sel-edge-right"];

    function clearSelectionEdges() {
        tbody.querySelectorAll("td.sel-edge-top, td.sel-edge-bottom, td.sel-edge-left, td.sel-edge-right").forEach(c => {
            c.classList.remove(...SEL_EDGE_CLASSES);
        });
    }

    function updateSelectionEdges() {
        clearSelectionEdges();
        const selected = Array.from(tbody.querySelectorAll("td.selected"));
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
        tbody.querySelectorAll("td.selected, td.active-cell, td.transparent").forEach(c => {
            c.classList.remove("selected", "active-cell", "transparent", ...SEL_EDGE_CLASSES);
        });
    }

    let isFormulaBarDirty = false;

    function isInFormulaEdit() {
        if (document.activeElement === formulaBarInput && formulaBarInput.value.trim().startsWith("=")) return true;
        if (activeCell && activeCell.isContentEditable && activeCell.textContent.trim().startsWith("=")) return true;
        return false;
    }

    let lastPointRefRange = null; // { start, end }

    function cycleAbsoluteReference(text, caretPos) {
        const regex = /(\$?)([A-Z]+)(\$?)(\d+)/gi;
        let match;
        while ((match = regex.exec(text)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            if (caretPos >= start && caretPos <= end) {
                const [, absC, col, absR, row] = match;
                let next;
                if (!absC && !absR) next = `$${col.toUpperCase()}$${row}`;
                else if (absC && absR) next = `${col.toUpperCase()}$${row}`;
                else if (!absC && absR) next = `$${col.toUpperCase()}${row}`;
                else next = `${col.toUpperCase()}${row}`;
                return {
                    text: text.slice(0, start) + next + text.slice(end),
                    caret: start + next.length
                };
            }
        }
        return null;
    }

    function insertCellReference(ref) {
        if (!ref) return;
        if (document.activeElement === formulaBarInput) {
            let start = formulaBarInput.selectionStart ?? formulaBarInput.value.length;
            let end = formulaBarInput.selectionEnd ?? formulaBarInput.value.length;
            if (lastPointRefRange && start === lastPointRefRange.end && end === lastPointRefRange.end) {
                start = lastPointRefRange.start;
            }
            formulaBarInput.value = formulaBarInput.value.slice(0, start) + ref + formulaBarInput.value.slice(end);
            const newPos = start + ref.length;
            lastPointRefRange = { start, end: newPos };
            formulaBarInput.setSelectionRange(newPos, newPos);
            formulaBarInput.focus();
            if (activeCell) {
                activeCell.textContent = formulaBarInput.value;
            }
            highlightCalculationRange(formulaBarInput.value.trim());
        } else if (activeCell && activeCell.isContentEditable) {
            const fullText = activeCell.textContent;
            if (lastPointRefRange && fullText.endsWith(lastPointRefRange.text)) {
                activeCell.textContent = fullText.slice(0, fullText.length - lastPointRefRange.text.length) + ref;
            } else {
                activeCell.textContent = fullText + ref;
            }
            lastPointRefRange = { text: ref };
            setCaretToEnd(activeCell);
            formulaBarInput.value = activeCell.textContent;
            highlightCalculationRange(activeCell.textContent.trim());
        }
    }

    function setCaretToEnd(el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }

    function setCaretAtPoint(el, clientX, clientY) {
        const sel = window.getSelection();
        if (!sel) return;
        const textNode = el.firstChild;
        if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
            setCaretToEnd(el);
            return;
        }

        const fullRange = document.createRange();
        fullRange.selectNodeContents(textNode);
        const textRect = fullRange.getBoundingClientRect();
        if (clientX >= textRect.right - 2) {
            setCaretToEnd(el);
            return;
        }

        let range = null;
        if (document.caretRangeFromPoint) {
            range = document.caretRangeFromPoint(clientX, clientY);
        } else if (document.caretPositionFromPoint) {
            const pos = document.caretPositionFromPoint(clientX, clientY);
            if (pos) {
                range = document.createRange();
                range.setStart(pos.offsetNode, pos.offset);
                range.collapse(true);
            }
        }
        if (range && range.startContainer === textNode) {
            sel.removeAllRanges();
            sel.addRange(range);
        } else {
            setCaretToEnd(el);
        }
    }

    function enterCellEditMode(cell, skipFocus = false, editBy = "dblclick", clickEvent = null) {
        if (!cell) return;
        const wasEditable = cell.isContentEditable;
        if (!wasEditable) {
            lastPointRefRange = null;
            cell.dataset.originalText = cell.dataset.rawValue ?? cell.textContent;
            if (cell.dataset.formula) {
                cell.dataset.originalFormula = cell.dataset.formula;
                cell.textContent = cell.dataset.formula;
            } else {
                delete cell.dataset.originalFormula;
                if (cell.dataset.rawValue !== undefined) {
                    cell.textContent = cell.dataset.rawValue;
                }
            }
        }
        cell.contentEditable = "true";
        cell.dataset.editBy = editBy;

        const currentFormula = cell.dataset.formula || cell.textContent.trim();
        if (currentFormula.startsWith("=")) {
            highlightCalculationRange(currentFormula);
        }
        if (!skipFocus) {
            cell.focus();
            if (clickEvent && typeof clickEvent.clientX === "number") {
                const cx = clickEvent.clientX;
                const cy = clickEvent.clientY;
                requestAnimationFrame(() => setCaretAtPoint(cell, cx, cy));
            } else if (!wasEditable) {
                managedTimeout(() => setCaretToEnd(cell), 0);
            }
        }
        activeCell = cell;
        if (formulaBarInput.value !== cell.textContent) {
            formulaBarInput.value = cell.textContent;
        }
    }

    function commitCellValue(cell, rawValue) {
        if (!cell) return;
        delete cell.dataset.spillOrigin;
        const newText = String(rawValue ?? "").trim();
        const prevText = cell.dataset.originalText ?? "";
        const prevFormula = cell.dataset.originalFormula ?? "";

        if (newText.startsWith("=")) {
            cell.dataset.formula = newText;
            setCellFormattedValue(cell, evaluateFormula(newText));
        } else if (isDateFormat(newText)) {
            const parts = newText.split("/");
            let year, month, day;
            if (parts.length === 2) {
                year = new Date().getFullYear();
                month = parseInt(parts[0], 10);
                day = parseInt(parts[1], 10);
            } else if (parts[0].length === 4) {
                // 日本式 YYYY/M/D (例: 2025/7/8)
                year = parseInt(parts[0], 10);
                month = parseInt(parts[1], 10);
                day = parseInt(parts[2], 10);
            } else if (parts[2].length === 4) {
                // 米国式 M/D/YYYY (例: 7/8/2025)
                year = parseInt(parts[2], 10);
                month = parseInt(parts[0], 10);
                day = parseInt(parts[1], 10);
            } else {
                // 2桁年 YY/M/D (例: 25/7/8 -> 2025/7/8)
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
            if (/^[¥￥]\s*-?[\d,]+(?:\.\d+)?$/.test(trimmedInput)) {
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
            }
        }

        cell.contentEditable = "false";
        delete cell.dataset.editBy;
        clearCalculationRangeHighlights();
        updateAllFormulas();
        if (newText.includes("\n")) {
            autoFitRow(cell.closest("tr"));
        }

        if (prevText !== cell.textContent || prevFormula !== (cell.dataset.formula || "")) {
            setDirtyState(true);
            debouncedSaveState();
        }
    }

    function revertSelectedCellsText() {
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
            activeCell.contentEditable = "false";
            delete activeCell.dataset.editBy;
        }
        clearCalculationRangeHighlights();
        updateAllFormulas();
        updateFillHandle();
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

    // =========================================================
    // 範囲選択・フィルハンドル
    // =========================================================
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
        const { minRow, maxRow, minCol, maxCol } = expandBoundsForMergedCells({
            minRow: Math.min(selectionStart.row, selectionEnd.row),
            maxRow: Math.max(selectionStart.row, selectionEnd.row),
            minCol: Math.min(selectionStart.col, selectionEnd.col),
            maxCol: Math.max(selectionStart.col, selectionEnd.col)
        });

        if (isInFormulaEdit()) {
            clearCalculationRangeHighlights();
            const rangeRef = (minRow === maxRow && minCol === maxCol)
                ? getCellReferenceByCoord(minRow, minCol)
                : `${getCellReferenceByCoord(minRow, minCol)}:${getCellReferenceByCoord(maxRow, maxCol)}`;
            highlightCalculationRange(rangeRef);
        } else {
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
        const stringLiterals = [];
        const maskedBody = formula.substring(1).replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'(?!\s*!)/g, (m) => {
            const token = `__ADJ_STR_${stringLiterals.length}__`;
            stringLiterals.push(m);
            return token;
        });

        const adjustedBody = maskedBody
            .replace(/(\$?)([A-Z]+)(\$?)(\d+)/g, (_, absCol, colLetters, absRow, rowStr) => {
                const nextCol = absCol ? columnLettersToIndex(colLetters) : Math.max(0, columnLettersToIndex(colLetters) + colOffset);
                const nextRow = absRow ? parseInt(rowStr, 10) : Math.max(1, parseInt(rowStr, 10) + rowOffset);
                return `${absCol}${getColumnName(nextCol)}${absRow}${nextRow}`;
            })
            .replace(/__ADJ_STR_(\d+)__/g, (_, idx) => stringLiterals[Number(idx)]);

        return "=" + adjustedBody;
    }

    const JP_DAYS_SHORT = ["日", "月", "火", "水", "木", "金", "土"];
    const JP_DAYS_LONG = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"];
    const EN_DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    function generateSeriesStep(seedValues, stepIndex) {
        const n = seedValues.length;
        const base = seedValues[stepIndex % n];
        const cycle = Math.floor(stepIndex / n);
        if (cycle === 0) return base;

        const first = String(seedValues[0] ?? "").trim();
        const last = String(seedValues[n - 1] ?? "").trim();

        // 1. 数値の連続（1セル選択なら+1、2セル以上なら等差数列）
        const nums = seedValues.map(v => Number(String(v).trim()));
        if (nums.every(v => v !== "" && !isNaN(v)) && seedValues.every(v => String(v).trim() !== "")) {
            if (n === 1) {
                return String(nums[0] + stepIndex);
            }
            const stepDiff = (nums[n - 1] - nums[0]) / (n - 1);
            return String(nums[0] + stepDiff * stepIndex);
        }

        // 2. 日付の連続（YYYY/MM/DD）
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

        // 3. 曜日リスト（月→火→水...）
        for (const list of [JP_DAYS_SHORT, JP_DAYS_LONG, EN_DAYS_SHORT]) {
            const idx = list.indexOf(first);
            if (idx !== -1) {
                return list[(idx + stepIndex) % list.length];
            }
        }

        // 4. 文字列＋末尾数字（項目1→項目2、No.001→No.002）
        const suffixMatch = first.match(/^(.*?)(\d+)$/);
        if (suffixMatch) {
            const prefix = suffixMatch[1];
            const numPart = suffixMatch[2];
            const nextNum = parseInt(numPart, 10) + stepIndex;
            return prefix + String(nextNum).padStart(numPart.length, "0");
        }

        return base;
    }

    function cloneCellProperties(sourceCell, targetCell, overrideValue = null) {
        if (!sourceCell || !targetCell || sourceCell === targetCell) return;

        if (sourceCell.dataset.numFormat) targetCell.dataset.numFormat = sourceCell.dataset.numFormat;
        else delete targetCell.dataset.numFormat;

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
            target.appendChild(fh);
            fh.addEventListener("mousedown", (e) => {
                if (activeCell && activeCell.isContentEditable) return;
                e.stopPropagation();
                e.preventDefault();
                isFillDragging = true;
                fillDragStartCell = activeCell;

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
                    const deltaR = Math.max(0, hoverRow - initialFillRange.maxRow);
                    const deltaC = Math.max(0, hoverCol - initialFillRange.maxCol);

                    if (deltaR >= deltaC) {
                        currentFillRange = {
                            minRow: initialFillRange.minRow,
                            minCol: initialFillRange.minCol,
                            maxRow: Math.max(initialFillRange.maxRow, hoverRow),
                            maxCol: initialFillRange.maxCol
                        };
                    } else {
                        currentFillRange = {
                            minRow: initialFillRange.minRow,
                            minCol: initialFillRange.minCol,
                            maxRow: initialFillRange.maxRow,
                            maxCol: Math.max(initialFillRange.maxCol, hoverCol)
                        };
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

                const onUp = () => {
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
                            const tplR = rOffset % initRCount;
                            const tplC = cOffset % initCCount;
                            const tpl = templateGrid[tplR][tplC];

                            // 結合セル内の非表示サブセルはアンカー側で一括処理するためスキップ
                            if (tpl.isHiddenSub) continue;

                            const srcCell = tpl.cell || fillSource;
                            let seriesVal = null;

                            if (rOffset >= initRCount && cOffset < initCCount) {
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
                                    seriesVal = generateSeriesStep(validSeeds, cycle * validSeeds.length + seedPos);
                                }
                            } else if (cOffset >= initCCount && rOffset < initRCount) {
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
                                    seriesVal = generateSeriesStep(validSeeds, cycle * validSeeds.length + seedPos);
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
                    for (let r = currentFillRange.minRow; r <= currentFillRange.maxRow; r++) {
                        for (let c = currentFillRange.minCol; c <= currentFillRange.maxCol; c++) {
                            const vis = getVisibleCell(r, c);
                            if (vis && vis.style.display !== "none") {
                                vis.classList.add("selected");
                            }
                        }
                    }
                    if (fillSource) fillSource.classList.add("active-cell");

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
        selectedCells.forEach(cell => {
            const r = +cell.dataset.row, c = +cell.dataset.col;
            minRow = Math.min(minRow, r);
            maxRow = Math.max(maxRow, r);
            minCol = Math.min(minCol, c);
            maxCol = Math.max(maxCol, c);
        });

        const expectedCount = (maxRow - minRow + 1) * (maxCol - minCol + 1);
        if (expectedCount === 1) {
            showAlert("単体セルでは結合できません。", "セル結合");
            return;
        }
        if (selectedCells.length !== expectedCount) {
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
        for (let r = minRow; r <= maxRow; r++) {
            let found = false;
            for (let c = minCol; c <= maxCol; c++) {
                const cell = getCell(r, c);
                if (cell && cell.textContent.trim() !== "") {
                    if (cell.dataset.formula) {
                        anchorFormula = cell.dataset.formula;
                        anchorValue = evaluateFormula(anchorFormula);
                    } else {
                        anchorValue = cell.textContent;
                    }
                    found = true;
                    break;
                }
            }
            if (found) break;
        }

        const anchor = getCell(minRow, minCol);
        anchor.textContent = anchorValue;
        if (anchorFormula) anchor.dataset.formula = anchorFormula;
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
    function clearCopyAnimation() {
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
        selectedCells.forEach(c => c.classList.add("copy-marching-ants"));

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
        const tsvText = buildTSVFromRange(minRow, maxRow, minCol, maxCol);

        const snapshotCell = (cell) => ({
            row: +cell.dataset.row,
            col: +cell.dataset.col,
            value: cell.dataset.rawValue ?? cell.textContent,
            formula: cell.dataset.formula || "",
            numFormat: cell.dataset.numFormat || "",
            decimalPlaces: cell.dataset.decimalPlaces ?? "",
            styleObj: extractCellStyleObject(cell),
            rowspan: parseInt(cell.getAttribute("rowspan") || "1", 10),
            colspan: parseInt(cell.getAttribute("colspan") || "1", 10),
            isMergedSub: cell.style.display === "none" && Boolean(cell.dataset.mergeAnchorRow)
        });

        clipboardData = {
            isCut,
            tsvText,
            sourceCoords: selectedCells.map(c => ({ row: +c.dataset.row, col: +c.dataset.col })),
            startRow: minRow,
            startCol: minCol,
            data: isContiguous ? [] : selectedCells.map(snapshotCell)
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

    async function pasteClipboardData(valuesOnly = false) {
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
                pasteExternalTSVMatrix(parseTSVToMatrix(externalText), selected, targetRow, targetCol);
                return;
            }
        }

        if (!clipboardData) return;

        const rowDelta = targetRow - clipboardData.startRow;
        const colDelta = targetCol - clipboardData.startCol;

        // 貼り付け先に結合セルが重なる場合は本物のExcel同様に中止
        const pasteHeight = Array.isArray(clipboardData.data[0])
            ? (clipboardData.data.length === 1 && clipboardData.data[0].length === 1 && selected.length > 1
                ? 1
                : clipboardData.data.length)
            : Math.max(...clipboardData.data.map(i => i.row - clipboardData.startRow + 1));
        const pasteWidth = Array.isArray(clipboardData.data[0])
            ? (clipboardData.data.length === 1 && clipboardData.data[0].length === 1 && selected.length > 1
                ? 1
                : clipboardData.data[0].length)
            : Math.max(...clipboardData.data.map(i => i.col - clipboardData.startCol + 1));

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

        const applyCellData = (dest, item, rOff, cOff) => {
            if (!dest || item.isMergedSub) return;
            if (valuesOnly) {
                delete dest.dataset.formula;
                const resolvedVal = item.formula ? evaluateFormula(item.formula) : item.value;
                setCellFormattedValue(dest, resolvedVal);
                return;
            }
            const newFormula = item.formula ? adjustFormula(item.formula, clipboardData.isCut ? 0 : rOff, clipboardData.isCut ? 0 : cOff) : "";
            if (item.numFormat) dest.dataset.numFormat = item.numFormat;
            else delete dest.dataset.numFormat;
            if (item.decimalPlaces !== undefined && item.decimalPlaces !== "") dest.dataset.decimalPlaces = item.decimalPlaces;
            else delete dest.dataset.decimalPlaces;

            if (newFormula) {
                dest.dataset.formula = newFormula;
                setCellFormattedValue(dest, evaluateFormula(newFormula));
            } else {
                delete dest.dataset.formula;
                setCellFormattedValue(dest, item.value);
            }
            applyCellStyleData(dest, item.styleObj);

            const rs = item.rowspan || 1;
            const cs = item.colspan || 1;
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

        if (Array.isArray(clipboardData.data[0])) {
            if (clipboardData.data.length === 1 && clipboardData.data[0].length === 1 && selected.length > 1) {
                const item = clipboardData.data[0][0];
                selected.forEach(dest => {
                    applyCellData(dest, item, (+dest.dataset.row) - clipboardData.startRow, (+dest.dataset.col) - clipboardData.startCol);
                });
            } else {
                clipboardData.data.forEach((rowArr, r) => {
                    rowArr.forEach((item, c) => {
                        applyCellData(getCell(targetRow + r, targetCol + c), item, rowDelta, colDelta);
                    });
                });
            }
        } else {
            clipboardData.data.forEach(item => {
                const dest = getCell(targetRow + (item.row - clipboardData.startRow), targetCol + (item.col - clipboardData.startCol));
                applyCellData(dest, item, rowDelta, colDelta);
            });
        }

        if (clipboardData.isCut && Array.isArray(clipboardData.sourceCoords)) {
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
                    src.textContent = "";
                    delete src.dataset.formula;
                    delete src.dataset.rawValue;
                    delete src.dataset.numFormat;
                    if (!valuesOnly) src.removeAttribute("style");
                }

                if (!valuesOnly && (rs > 1 || cs > 1)) {
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
            if (!valuesOnly && srcMinR <= srcMaxR) {
                redirectFormulasForMovedRange(
                    { minRow: srcMinR, maxRow: srcMaxR, minCol: srcMinC, maxCol: srcMaxC },
                    rowDelta,
                    colDelta,
                    { minRow: targetRow, maxRow: targetRow + pasteHeight - 1, minCol: targetCol, maxCol: targetCol + pasteWidth - 1 }
                );
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

        updateAllFormulas();
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
        "fontSize",
        "fontWeight",
        "fontStyle",
        "textDecoration",
        "textShadow",
        "color",
        "backgroundColor",
        "textAlign",
        "verticalAlign",
        "whiteSpace",
        "wordBreak",
        "borderTop",
        "borderRight",
        "borderBottom",
        "borderLeft"
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
        for (const prop of PERSISTED_STYLE_PROPS) {
            const val = cell.style[prop];
            if (val && val !== "") {
                styleObj[prop] = val;
                hasStyle = true;
            }
        }
        return hasStyle ? styleObj : null;
    }

    function applyCellStyleData(cell, styleData) {
        cell.removeAttribute("style");
        if (!styleData) return;
        if (typeof styleData === "string") {
            const cleanStyle = sanitizeCellStyleText(styleData);
            if (cleanStyle) cell.style.cssText = cleanStyle;
            return;
        }
        if (typeof styleData === "object") {
            for (const prop of PERSISTED_STYLE_PROPS) {
                if (styleData[prop]) {
                    cell.style[prop] = styleData[prop];
                }
            }
        }
    }

    // =========================================================
    // Undo / Redo 履歴管理（全状態スナップショット統合版）
    // =========================================================
    function saveState() {
        const serialized = JSON.stringify(buildSheetSnapshot({ flush: false }));
        if (undoHistory.length > 0 && undoHistory[undoHistory.length - 1] === serialized) return;
        redoHistory = [];
        undoHistory.push(serialized);
        if (undoHistory.length > 50) undoHistory.shift();
        updateQATButtonsState();
    }

    function debouncedSaveState(delay = 300) {
        if (saveStateTimeout) clearTimeout(saveStateTimeout);
        saveStateTimeout = managedTimeout(saveState, delay);
    }

    async function loadState(stateJSON) {
        const prevTop = container.scrollTop;
        const prevLeft = container.scrollLeft;
        await applyDeserializedPayload(stateJSON, { isUndoRedo: true });
        container.scrollTop = prevTop;
        container.scrollLeft = prevLeft;
        updateSelectedCellsDisplay();
        updateFillHandle();
        setDirtyState(true);
    }

    async function undo() {
        if (undoHistory.length <= 1) return;
        redoHistory.push(undoHistory.pop());
        await loadState(undoHistory[undoHistory.length - 1]);
    }

    async function redo() {
        if (!redoHistory.length) return;
        const next = redoHistory.pop();
        undoHistory.push(next);
        await loadState(next);
    }

    // =========================================================
    // フローティングテキストボックス
    // =========================================================
    function enableTextboxDragging(box) {
        let isDragging = false;
        let startX = 0, startY = 0;
        let mouseX = 0, mouseY = 0;
        let lastRecordedW = box.style.width;
        let lastRecordedH = box.style.height;

        box.dataset.initialLeft = String(parseFloat(box.style.left) || 0);
        box.dataset.initialTop = String(parseFloat(box.style.top) || 0);

        box.addEventListener("mouseup", () => {
            const curW = box.style.width;
            const curH = box.style.height;
            if ((curW && curW !== lastRecordedW) || (curH && curH !== lastRecordedH)) {
                lastRecordedW = curW;
                lastRecordedH = curH;
                setDirtyState(true);
                debouncedSaveState();
            }
        }, { signal });

        let isPendingDrag = false;
        let downX = 0, downY = 0;

        box.addEventListener("mousedown", (e) => {
            if (e.button !== 0) return;
            const rect = box.getBoundingClientRect();
            // 現在のレンダリングサイズを明示保持し、クリック時のサイズリセットを防止
            if (!box.style.width) box.style.width = `${box.offsetWidth}px`;
            if (!box.style.height) box.style.height = `${box.offsetHeight}px`;

            // 右下リサイズハンドル領域はブラウザ標準のリサイズ操作に委ねる
            if (e.clientX > rect.right - 16 && e.clientY > rect.bottom - 16) return;

            // すでにテキスト編集フォーカス中の場合、外周エッジ(8px以内)以外は文字選択を優先する
            if (document.activeElement === box) {
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
        }, { signal });

        const onMouseMoveBox = (e) => {
            if (isPendingDrag && !isDragging) {
                if (Math.hypot(e.clientX - downX, e.clientY - downY) < 3) return;
                isDragging = true;
                box.style.userSelect = "none";
            }
            if (!isDragging) return;
            updatePosition(e.clientX, e.clientY);
        };

        const onMouseUpBox = () => {
            isPendingDrag = false;
            if (isDragging) {
                isDragging = false;
                box.style.userSelect = "auto";
                debouncedSaveState();
            }
        };

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

        document.addEventListener("mousemove", onMouseMoveBox, { signal });

        container.addEventListener("scroll", () => {
            if (!isDragging) return;
            updatePosition(mouseX, mouseY);
        }, { passive: true, signal });

        document.addEventListener("mouseup", onMouseUpBox, { signal });

        box.addEventListener("input", () => {
            setDirtyState(true);
            debouncedSaveState();
        }, { signal });
    }

    function insertTextBox(opts = {}, { silent = false } = {}) {
        const zoom = parseFloat(spreadsheetContent.style.zoom || "1") || 1;
        const defaultLeft = `${Math.round(container.scrollLeft / zoom + 120)}px`;
        const defaultTop = `${Math.round(container.scrollTop / zoom + 90)}px`;

        const box = document.createElement("div");
        box.tabIndex = 0;
        box.className = "floating-textbox";
        Object.assign(box.style, {
            left: opts.left || defaultLeft,
            top: opts.top || defaultTop,
            width: opts.width || "260px",
            height: opts.height || "120px",
            border: "1px solid gray",
            background: "white",
            padding: "4px 20px 4px 6px"
        });

        const editor = document.createElement("div");
        editor.className = "floating-textbox-editor";
        editor.contentEditable = "true";
        editor.innerHTML = opts.content ?? "テキスト";
        Object.assign(editor.style, {
            width: "100%",
            height: "100%",
            outline: "none",
            cursor: "inherit"
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
            box.remove();
            setDirtyState(true);
            debouncedSaveState();
        }, { signal });
        box.appendChild(delBtn);

        spreadsheetContent.appendChild(box);
        enableTextboxDragging(box);
        if (!silent) {
            setDirtyState(true);
            debouncedSaveState();
        }
    }

    function renderChartBoxSVG(chartBox) {
        const rangeStr = chartBox.dataset.sourceRange;
        const chartType = chartBox.dataset.chartType || "bar";
        const bounds = rangeStr ? parseRangeReference(rangeStr) : null;
        if (!bounds) return false;

        const minR = Math.min(bounds.start.row, bounds.end.row);
        const maxR = Math.max(bounds.start.row, bounds.end.row);
        const minC = Math.min(bounds.start.col, bounds.end.col);
        const maxC = Math.max(bounds.start.col, bounds.end.col);

        const labels = [];
        const values = [];
        for (let r = minR; r <= maxR; r++) {
            const labelCell = getVisibleCell(r, minC);
            const valCell = getVisibleCell(r, maxC);
            const num = parseFormattedNumber(valCell?.dataset.rawValue ?? valCell?.textContent ?? "");
            if (!isNaN(num)) {
                labels.push((labelCell?.textContent || `項目${r}`).trim());
                values.push(num);
            }
        }
        if (!values.length) return false;

        const w = 320, h = 200, pad = 28;
        const plotW = w - pad * 2, plotH = h - pad * 2;
        const maxVal = Math.max(...values, 1);
        const colors = ["#1f4e78", "#c65911", "#375623", "#7030a0", "#bf8f00", "#008080", "#2f75b5"];
        let innerSvg = "";

        if (chartType === "pie") {
            const total = values.reduce((a, b) => a + Math.max(0, b), 0) || 1;
            const cx = 105, cy = 100, radius = 72;
            let startAngle = -Math.PI / 2;
            values.forEach((v, i) => {
                const ratio = Math.max(0, v) / total;
                const endAngle = startAngle + ratio * Math.PI * 2;
                const x1 = cx + radius * Math.cos(startAngle);
                const y1 = cy + radius * Math.sin(startAngle);
                const x2 = cx + radius * Math.cos(endAngle);
                const y2 = cy + radius * Math.sin(endAngle);
                const largeArc = ratio > 0.5 ? 1 : 0;
                const color = colors[i % colors.length];
                innerSvg += `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${color}" stroke="#fff" stroke-width="1.5" />`;
                if (i < 7) {
                    const ly = 24 + i * 22;
                    innerSvg += `<rect x="195" y="${ly - 8}" width="10" height="10" fill="${color}" />
                                 <text x="209" y="${ly}" font-size="10">${labels[i].slice(0, 7)} (${Math.round(ratio * 100)}%)</text>`;
                }
                startAngle = endAngle;
            });
        } else if (chartType === "line") {
            const stepX = values.length > 1 ? plotW / (values.length - 1) : plotW / 2;
            const pts = values.map((v, i) => {
                const x = pad + (values.length > 1 ? i * stepX : plotW / 2);
                const y = pad + plotH - (Math.max(0, v) / maxVal) * plotH;
                return { x, y, label: labels[i] };
            });
            const poly = pts.map(p => `${p.x},${p.y}`).join(" ");
            innerSvg = `
                <line x1="${pad}" y1="${pad + plotH}" x2="${w - pad}" y2="${pad + plotH}" stroke="#333" />
                <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${pad + plotH}" stroke="#333" />
                <polyline fill="none" stroke="#1f4e78" stroke-width="2.5" points="${poly}" />
                ${pts.map(p => `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="#c65911" />
                                <text x="${p.x}" y="${h - 8}" font-size="10" text-anchor="middle">${p.label.slice(0, 6)}</text>`).join("")}
            `;
        } else {
            const barsSvg = values.map((v, i) => {
                const bw = Math.max(12, plotW / values.length - 8);
                const bh = (Math.max(0, v) / maxVal) * plotH;
                const x = pad + i * (plotW / values.length) + 4;
                const y = pad + plotH - bh;
                return `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" fill="#1f4e78" />
                        <text x="${x + bw / 2}" y="${h - 8}" font-size="10" text-anchor="middle">${labels[i].slice(0, 6)}</text>`;
            }).join("");
            innerSvg = `
                <line x1="${pad}" y1="${pad + plotH}" x2="${w - pad}" y2="${pad + plotH}" stroke="#333" />
                <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${pad + plotH}" stroke="#333" />
                ${barsSvg}
            `;
        }

        const oldSvg = chartBox.querySelector("svg");
        if (oldSvg) oldSvg.remove();
        chartBox.insertAdjacentHTML("afterbegin", `<svg width="100%" height="100%" viewBox="0 0 ${w} ${h}">${innerSvg}</svg>`);
        return true;
    }

    function updateAllFloatingCharts() {
        spreadsheetContent.querySelectorAll(".floating-chart[data-source-range]").forEach(box => {
            renderChartBoxSVG(box);
        });
    }

    function insertFloatingChart(chartType = "bar") {
        const bounds = getSelectedRangeBounds();
        if (!bounds || (bounds.minRow === bounds.maxRow && bounds.minCol === bounds.maxCol)) {
            showAlert("グラフ化するデータ範囲（2セル以上）を選択してください。", "グラフ挿入");
            return;
        }

        const rangeStr = `${getCellReferenceByCoord(bounds.minRow, bounds.minCol)}:${getCellReferenceByCoord(bounds.maxRow, bounds.maxCol)}`;
        const chartBox = document.createElement("div");
        chartBox.className = "floating-textbox floating-chart";
        chartBox.dataset.chartType = chartType;
        chartBox.dataset.sourceRange = rangeStr;
        Object.assign(chartBox.style, {
            left: "140px",
            top: "100px",
            width: "336px",
            height: "224px",
            background: "#fff",
            padding: "8px"
        });

        if (!renderChartBoxSVG(chartBox)) {
            showAlert("選択範囲の右端に数値データが見つかりません。", "グラフ挿入");
            return;
        }

        const delBtn = document.createElement("span");
        delBtn.className = "floating-textbox-delete";
        delBtn.textContent = "×";
        delBtn.addEventListener("mousedown", (e) => {
            e.stopPropagation();
            chartBox.remove();
            setDirtyState(true);
            debouncedSaveState();
        }, { signal });
        chartBox.appendChild(delBtn);

        spreadsheetContent.appendChild(chartBox);
        enableTextboxDragging(chartBox);
        setDirtyState(true);
        debouncedSaveState();
    }

    // =========================================================
    // 仮想FS（Nexser OS）保存・読込・CSV出力エンジン（非圧縮JSON）
    // =========================================================
    function flushPendingEdits() {
        if (activeCell && activeCell.isContentEditable) {
            commitCellValue(activeCell, activeCell.textContent);
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

        tbody.querySelectorAll("td").forEach(cell => {
            const r = parseInt(cell.dataset.row, 10);
            const c = parseInt(cell.dataset.col, 10);
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
            if (cell.dataset.spillOrigin) return;
            if (v === "" && !f && !nf && !dl && !st && cs === 1 && rs === 1 && !hasMergeMeta) {
                return;
            }

            const entry = { r, c };
            if (v !== "") entry.v = v;
            if (f !== "") entry.f = f;
            if (nf !== "") entry.nf = nf;
            if (dp !== "") entry.dp = dp;
            if (dl !== "") entry.dl = dl;
            if (st) entry.st = st;
            if (cs > 1) entry.cs = cs;
            if (rs > 1) entry.rs = rs;
            if (hasMergeMeta) entry.merge = merge;
            if (cell.dataset.valueType) entry.vt = cell.dataset.valueType;
            if (cell.dataset.dateValue) entry.dv = cell.dataset.dateValue;

            savedCells.push(entry);
        });

        const savedRows = Array.from(tbody.querySelectorAll("tr"))
            .map(tr => (tr.style.height ? { r: parseInt(tr.dataset.row, 10), h: tr.style.height } : null))
            .filter(Boolean);

        const savedColumns = [];
        for (let c = 0; c < currentColumns; c++) {
            const colEl = colgroup.children[c + 1];
            if (colEl && colEl.style.width && colEl.style.width !== "120px") {
                savedColumns.push({ c, w: colEl.style.width });
            }
        }

        const textboxes = Array.from(spreadsheetContent.querySelectorAll(".floating-textbox")).map(box => {
            const isChart = box.classList.contains("floating-chart");
            const editor = box.querySelector(".floating-textbox-editor");
            const clone = box.cloneNode(true);
            clone.querySelectorAll(".floating-textbox-delete").forEach(btn => btn.remove());
            return {
                type: isChart ? "chart" : "textbox",
                chartType: box.dataset.chartType || "bar",
                sourceRange: box.dataset.sourceRange || "",
                left: `${box.dataset.initialLeft || parseFloat(box.style.left) || 0}px`,
                top: `${box.dataset.initialTop || parseFloat(box.style.top) || 0}px`,
                width: box.style.width || `${box.offsetWidth}px`,
                height: box.style.height || `${box.offsetHeight}px`,
                content: editor ? editor.innerHTML : clone.innerHTML
            };
        });

        const zoom = parseInt(zoomSlider?.value || String(zoomValue), 10) || 100;
        if (!sheets[activeSheetIndex]) {
            sheets[activeSheetIndex] = createBlankSheetModel("Sheet1");
        }

        const target = sheets[activeSheetIndex];
        target.cells = savedCells;
        target.rows = savedRows;
        target.columns = savedColumns;
        target.zoom = zoom;
        target.pageSize = currentPageSize;
        target.freezeRows = freezeRows;
        target.freezeCols = freezeCols;
        target.textboxes = textboxes;
        target.autoFilter = autoFilterState
            ? {
                headerRow: autoFilterState.headerRow,
                minCol: autoFilterState.minCol,
                maxCol: autoFilterState.maxCol,
                maxRow: autoFilterState.maxRow,
                filters: Array.from(autoFilterState.filters.entries()).map(([col, set]) => [col, Array.from(set)])
            }
            : null;
        target.activeCoord = activeCell
            ? { row: parseInt(activeCell.dataset.row, 10), col: parseInt(activeCell.dataset.col, 10) }
            : { row: 1, col: 0 };
        target.scrollTop = container.scrollTop;
        target.scrollLeft = container.scrollLeft;
        return target;
    }

    function recalculateBackgroundSheets() {
        sheets.forEach((sheet, sIdx) => {
            if (sIdx === activeSheetIndex || !Array.isArray(sheet.cells)) return;
            sheet.cells.forEach(entry => {
                if (entry.f && String(entry.f).startsWith("=")) {
                    const res = evaluateFormula(entry.f, new Set(), sIdx);
                    entry.v = res != null ? String(res) : "";
                }
            });
        });
    }

    function buildSheetSnapshot({ flush = true } = {}) {
        captureCurrentSheetDOM({ flush });
        recalculateBackgroundSheets();
        return {
            format: "nexser-spreadsheet",
            version: 4,
            activeSheetIndex,
            sheets: JSON.parse(JSON.stringify(sheets))
        };
    }

    function serializeSpreadsheetPayload() {
        return JSON.stringify(buildSheetSnapshot({ flush: true }));
    }

    function clearSheetToBlank({ resetHistory = true } = {}) {
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
        Array.from(tbody.rows).forEach(tr => {
            tr.style.height = "";
        });
        spreadsheetContent.querySelectorAll(".floating-textbox").forEach(b => b.remove());
        clearAllAutoFilters();
        setFreezePanes(0, 0, { silent: true });
        if (resetHistory) {
            sheets = [createBlankSheetModel("Sheet1")];
            activeSheetIndex = 0;
            renderSheetTabs();
            undoHistory = [];
            redoHistory = [];
            saveState();
        }
    }

    async function applySingleSheetToDOM(sheetData, { isUndoRedo = false } = {}) {
        const cells = Array.isArray(sheetData.cells) ? sheetData.cells : [];
        const rows = Array.isArray(sheetData.rows) ? sheetData.rows : [];
        const columns = Array.isArray(sheetData.columns) ? sheetData.columns : [];
        const zoomVal = sheetData.zoom ?? 100;
        const textboxes = Array.isArray(sheetData.textboxes) ? sheetData.textboxes : [];

        clearSheetToBlank({ resetHistory: false });

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

        rows.forEach(({ r, h }) => {
            const tr = getRow(Number(r));
            if (tr && h) tr.style.height = h;
        });

        columns.forEach(({ c, w }) => {
            if (w) {
                const px = parseInt(w, 10);
                if (!isNaN(px)) setColumnWidth(Number(c), px);
            }
        });

        const total = cells.length;
        cells.forEach((item, idx) => {
            const cell = getCell(Number(item.r), Number(item.c));
            if (!cell) return;

            if (item.nf) cell.dataset.numFormat = String(item.nf);
            if (item.dp !== undefined && item.dp !== "") cell.dataset.decimalPlaces = String(item.dp);
            if (item.dl) cell.dataset.dropdownList = String(item.dl);

            if (item.f) {
                cell.dataset.formula = String(item.f);
                setCellFormattedValue(cell, item.v != null ? String(item.v) : "");
            } else if (item.v != null) {
                setCellFormattedValue(cell, String(item.v));
            }
            if (item.vt) cell.dataset.valueType = String(item.vt);
            if (item.dv) cell.dataset.dateValue = String(item.dv);

            applyCellStyleData(cell, item.st || item.s);

            if (item.merge && typeof item.merge === "object") {
                Object.entries(item.merge).forEach(([k, val]) => {
                    if (val != null) cell.dataset[k] = String(val);
                });
            }

            if (progressBar && total > 0 && !isUndoRedo) {
                progressBar.style.width = `${Math.round(((idx + 1) / total) * 100)}%`;
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

        updateAllFormulas();

        if (Array.isArray(textboxes)) {
            textboxes.forEach(tb => {
                if (tb.type === "chart") {
                    const chartBox = document.createElement("div");
                    chartBox.className = "floating-textbox floating-chart";
                    chartBox.dataset.chartType = tb.chartType || "bar";
                    if (tb.sourceRange) chartBox.dataset.sourceRange = tb.sourceRange;
                    Object.assign(chartBox.style, {
                        left: tb.left || "140px",
                        top: tb.top || "100px",
                        width: tb.width || "336px",
                        height: tb.height || "224px",
                        background: "#fff",
                        padding: "8px"
                    });
                    chartBox.innerHTML = tb.content || "";
                    const delBtn = document.createElement("span");
                    delBtn.className = "floating-textbox-delete";
                    delBtn.textContent = "×";
                    delBtn.addEventListener("mousedown", (e) => {
                        e.stopPropagation();
                        chartBox.remove();
                        setDirtyState(true);
                    }, { signal });
                    chartBox.appendChild(delBtn);
                    spreadsheetContent.appendChild(chartBox);
                    enableTextboxDragging(chartBox);
                } else {
                    insertTextBox(tb, { silent: true });
                }
            });
        }

        if (sheetData.autoFilter) {
            const af = sheetData.autoFilter;
            autoFilterState = {
                headerRow: af.headerRow,
                minCol: af.minCol,
                maxCol: af.maxCol,
                maxRow: af.maxRow,
                filters: new Map((af.filters || []).map(([col, vals]) => [Number(col), new Set(vals)]))
            };
            for (let c = af.minCol; c <= af.maxCol; c++) {
                const headerCell = getVisibleCell(af.headerRow, c);
                if (!headerCell) continue;
                const arrow = document.createElement("span");
                arrow.className = "ss-filter-arrow";
                arrow.dataset.filterCol = String(c);
                arrow.textContent = "▼";
                arrow.title = "フィルターと並べ替え";
                arrow.addEventListener("mousedown", (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    openFilterDropdownMenu(c, arrow);
                }, { signal });
                headerCell.appendChild(arrow);
            }
            appRoot.querySelector(".ss-toggle-filter-btn")?.classList.add("selected");
            applyAutoFilterRows();
        }

        setFreezePanes(sheetData.freezeRows || 0, sheetData.freezeCols || 0, { silent: true });
        if (!isUndoRedo) {
            container.scrollTop = sheetData.scrollTop || 0;
            container.scrollLeft = sheetData.scrollLeft || 0;
        }

        const coord = sheetData.activeCoord || { row: 1, col: 0 };
        const targetActive = getVisibleCell(coord.row, coord.col) || getVisibleCell(1, 0);
        if (targetActive) {
            clearSelection();
            setActiveCell(targetActive, true);
        }
        updateSelectedCellsDisplay();
        updateFillHandle();
        updateToolbarState();

        if (!isUndoRedo) {
            managedTimeout(() => {
                if (progressBar) progressBar.style.width = "0%";
            }, 250);
        }
    }

    async function applyDeserializedPayload(rawStr, { isUndoRedo = false } = {}) {
        let parsed;
        try {
            parsed = JSON.parse(rawStr);
        } catch (err) {
            console.error("[Spreadsheet] JSON parse error:", err);
            throw new Error("ファイルのデータ形式が破損しています（JSON構文エラー）。");
        }

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
        await applySingleSheetToDOM(sheets[activeSheetIndex], { isUndoRedo });
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

        loadingstate.textContent = "読み込み中...";
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

            const a1 = getVisibleCell(1, 0);
            if (a1) {
                clearSelection();
                setActiveCell(a1, true);
                updateSelectedCellsDisplay();
                updateFillHandle();
            }

            loadingstate.textContent = "読み込み完了";
            await updateStorageUsageDisplay();
            return true;
        } catch (err) {
            console.error("[Spreadsheet] Load failed:", err);
            loadingstate.textContent = "読込エラー";
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

        loadingstate.textContent = "保存中...";
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
            setDirtyState(false);
            loadingstate.textContent = "保存しました";
            await updateStorageUsageDisplay();
            return true;
        } catch (err) {
            // 保存失敗時に元のロックを復元
            if (wasLockedBySelf && lockFile(normalized, "exclusive", lockOwnerPid)) {
                lockedFilePath = normalized;
            }
            console.error("[Spreadsheet] Save failed:", err);
            loadingstate.textContent = "保存エラー";
            showAlert(`保存に失敗しました:\n${err.message}`, "保存エラー");
            return false;
        }
    }

    function generateCSVText() {
        flushPendingEdits();
        let maxR = 0, maxC = 0;
        tbody.querySelectorAll("td").forEach(cell => {
            if (cell.textContent.trim() !== "") {
                maxR = Math.max(maxR, +cell.dataset.row);
                maxC = Math.max(maxC, +cell.dataset.col);
            }
        });
        const rows = [];
        for (let r = 1; r <= maxR; r++) {
            const cols = [];
            for (let c = 0; c <= maxC; c++) {
                const val = (getCell(r, c)?.textContent || "").replace(/"/g, '""');
                cols.push(val.includes(",") || val.includes("\n") ? `"${val}"` : val);
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
            loadingstate.textContent = `${fileName} をエクスポートしました`;
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
            loadingstate.textContent = "読み込み中...";
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
                if (currentFileEl) currentFileEl.textContent = file.name;
                if (win && windowAPI?.updateWindowTitle) {
                    windowAPI.updateWindowTitle(win, file.name, true);
                }
                isDirty = true;
                undoHistory = [];
                redoHistory = [];
                saveState();
                loadingstate.textContent = `${file.name} を読み込みました`;
            } catch (err) {
                console.error("[Spreadsheet] Import failed:", err);
                loadingstate.textContent = "読込エラー";
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
                <input type="text" class="ss-save-path-input border" value="${defaultPath}" style="width:100%; padding:4px 6px; font-size:12px; background:#fff; color:#000; box-sizing:border-box;">
            </div>
        `;

        const modalContent = windowAPI.showModalWindow("名前を付けて保存", bodyHtml, {
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
                    modalContent.querySelector(".button-container button")?.click();
                }
            });
        }
    }

    function promptOpenFileDialog() {
        const candidates = collectSpreadsheetFiles();
        const optionsHtml = candidates.length > 0
            ? candidates.map(p => `<option value="${p}">${p}</option>`).join("")
            : `<option value="">(保存済みシートが見つかりません)</option>`;

        const bodyHtml = `
            <div style="width:100%; display:flex; flex-direction:column; gap:8px;">
                <div>ファイルを選択するか、仮想ドライブのパスを入力してください:</div>
                <select class="ss-open-select border" style="width:100%; padding:4px; font-size:12px; background:#fff; color:#000;">
                    ${optionsHtml}
                </select>
                <input type="text" class="ss-open-path-input border" value="${candidates[0] || `${getDefaultSaveDirectory()}/`}" style="width:100%; padding:4px 6px; font-size:12px; background:#fff; color:#000; box-sizing:border-box;">
            </div>
        `;

        const modalContent = windowAPI.showModalWindow("スプレッドシートを開く", bodyHtml, {
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
                    modalContent.querySelector(".button-container button")?.click();
                }
            });
        }
    }

    async function updateStorageUsageDisplay() {
        if (!storageInfoEl) return;
        try {
            if (navigator.storage?.estimate) {
                const { usage, quota } = await navigator.storage.estimate();
                const usedMB = ((usage || 0) / (1024 * 1024)).toFixed(2);
                const quotaGB = ((quota || 0) / (1024 * 1024 * 1024)).toFixed(1);
                storageInfoEl.textContent = `OSストレージ: ${usedMB}MB / ${quotaGB}GB`;
            }
        } catch {
            storageInfoEl.textContent = "";
        }
    }

    // =========================================================
    // イベントリスナー登録（すべてスコープ＆AbortSignal管理）
    // =========================================================
    function setPageSize(sizeVal, { silent = false } = {}) {
        const nextSize = sizeVal || "A4";
        const changed = currentPageSize !== nextSize;
        currentPageSize = nextSize;
        let styleTag = document.getElementById("dynamicPageStyle");
        if (!styleTag) {
            styleTag = document.createElement("style");
            styleTag.id = "dynamicPageStyle";
            document.head.appendChild(styleTag);
        }
        styleTag.textContent = `@page { size: ${currentPageSize}; margin: 1cm; }`;
        const sizeEl = appRoot.querySelector(".ss-selected-size");
        if (sizeEl) sizeEl.textContent = currentPageSize;
        if (changed && !silent) {
            setDirtyState(true);
            debouncedSaveState();
        }
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
            let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
            selected.forEach(c => {
                const r0 = +c.dataset.row, col0 = +c.dataset.col;
                const r1 = r0 + (+c.getAttribute("rowspan") || 1) - 1;
                const col1 = col0 + (+c.getAttribute("colspan") || 1) - 1;
                minR = Math.min(minR, r0);
                maxR = Math.max(maxR, r1);
                minC = Math.min(minC, col0);
                maxC = Math.max(maxC, col1);
            });

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

        // 単一セル選択時：真上 → 左隣の順で連続する数値範囲を自動検出
        const target = activeCell || getVisibleCell(1, 0);
        if (!target) return;
        const r = parseInt(target.dataset.row, 10);
        const c = parseInt(target.dataset.col, 10);
        let rangeRef = "";

        if (r > 1 && isNumericCell(getVisibleCell(r - 1, c))) {
            let topR = r - 1;
            while (topR > 1 && isNumericCell(getVisibleCell(topR - 1, c))) {
                topR--;
            }
            const colName = getColumnName(c);
            rangeRef = `${colName}${topR}:${colName}${r - 1}`;
        } else if (c > 0 && isNumericCell(getVisibleCell(r, c - 1))) {
            let leftC = c - 1;
            while (leftC > 0 && isNumericCell(getVisibleCell(r, leftC - 1))) {
                leftC--;
            }
            rangeRef = `${getColumnName(leftC)}${r}:${getColumnName(c - 1)}${r}`;
        }

        const formula = `=SUM(${rangeRef})`;
        target.dataset.originalText = target.dataset.rawValue ?? target.textContent;
        if (target.dataset.formula) target.dataset.originalFormula = target.dataset.formula;
        else delete target.dataset.originalFormula;
        target.textContent = formula;
        formulaBarInput.value = formula;
        isFormulaBarDirty = true;
        formulaBarInput.focus();
        formulaBarInput.setSelectionRange(5, 5 + rangeRef.length);
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
        const prefixRegex = isSameSheet
            ? /(^|[^A-Za-z0-9_'\u3040-\u30FF\u4E00-\u9FAF!])/
            : new RegExp(`((?:^|[^A-Za-z0-9_'\\u3040-\\u30FF\\u4E00-\\u9FAF])(?:'${escapedSheet}'|${escapedSheet})!)`);

        const rangePattern = new RegExp(
            `${prefixRegex.source}(\\$?)([A-Z]+)(\\$?)(\\d+):(\\$?)([A-Z]+)(\\$?)(\\d+)`,
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
            `${prefixRegex.source}(\\$?)([A-Z]+)(\\$?)(\\d+)`,
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
        const targetRow = parseInt(activeCell.dataset.row, 10);
        const targetCol = parseInt(activeCell.dataset.col, 10);
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
        });

        // オートフィルターの座標・対象列番号も行列の挿入・削除に追従
        if (snap.autoFilter) {
            const af = snap.autoFilter;
            if (mode === "insert-row") {
                if (af.headerRow >= targetRow) af.headerRow += 1;
                if (af.maxRow >= targetRow) af.maxRow += 1;
            } else if (mode === "delete-row") {
                if (af.headerRow === targetRow) {
                    snap.autoFilter = null;
                } else {
                    if (af.headerRow > targetRow) af.headerRow -= 1;
                    if (af.maxRow >= targetRow) af.maxRow -= 1;
                }
            } else if (mode === "insert-col") {
                if (af.minCol >= targetCol) af.minCol += 1;
                if (af.maxCol >= targetCol) af.maxCol += 1;
                af.filters = af.filters.map(([col, vals]) => [col >= targetCol ? col + 1 : col, vals]);
            } else if (mode === "delete-col") {
                if (targetCol >= af.minCol && targetCol <= af.maxCol) {
                    af.maxCol -= 1;
                    af.filters = af.filters
                        .filter(([col]) => col !== targetCol)
                        .map(([col, vals]) => [col > targetCol ? col - 1 : col, vals]);
                    if (af.maxCol < af.minCol) snap.autoFilter = null;
                } else if (targetCol < af.minCol) {
                    af.minCol -= 1;
                    af.maxCol -= 1;
                    af.filters = af.filters.map(([col, vals]) => [col - 1, vals]);
                }
            }
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
                return r;
            }).filter(r => r.maxRow >= r.minRow && r.maxCol >= r.minCol);
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

        await applySingleSheetToDOM(snap, { isUndoRedo: true });
        setDirtyState(true);
        saveState();
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

        // 自動検出時、1行目が見出し行（太字/背景色あり、または1行目が文字列で2行目が数値）なら除外
        if (autoDetectedTable && maxR - minR >= 1) {
            const firstRowCells = [];
            for (let c = minC; c <= maxC; c++) firstRowCells.push(getCell(minR, c));
            const hasHeaderStyle = firstRowCells.some(c => c && (c.style.fontWeight === "bold" || c.style.backgroundColor));
            const firstKeyVal = (getCell(minR, keyCol)?.dataset.rawValue ?? getCell(minR, keyCol)?.textContent ?? "").trim().replace(/,/g, "");
            const secondKeyVal = (getCell(minR + 1, keyCol)?.dataset.rawValue ?? getCell(minR + 1, keyCol)?.textContent ?? "").trim().replace(/,/g, "");
            const firstIsTextSecondIsNum = firstKeyVal !== "" && isNaN(Number(firstKeyVal)) && secondKeyVal !== "" && !isNaN(Number(secondKeyVal));
            if (hasHeaderStyle || firstIsTextSecondIsNum) {
                minR += 1;
            }
        }

        if (maxR <= minR) return;

        // 結合セルが含まれる場合は中止
        for (let r = minR; r <= maxR; r++) {
            for (let c = minC; c <= maxC; c++) {
                const cell = getCell(r, c);
                if (cell && (cell.style.display === "none" || cell.classList.contains("merged") || cell.dataset.mergeMinRow || cell.dataset.mergeAnchorRow)) {
                    showAlert("結合されたセルを含む範囲は並べ替えできません。", "並べ替えエラー");
                    return;
                }
            }
        }

        const sortKeyCol = (keyCol >= minC && keyCol <= maxC) ? keyCol : minC;
        const rowsData = [];

        for (let r = minR; r <= maxR; r++) {
            const rowCells = [];
            for (let c = minC; c <= maxC; c++) {
                const cell = getCell(r, c);
                rowCells.push({
                    value: cell?.dataset.rawValue ?? cell?.textContent ?? "",
                    formula: cell?.dataset.formula || "",
                    numFormat: cell?.dataset.numFormat || "",
                    valueType: cell?.dataset.valueType || "",
                    dateValue: cell?.dataset.dateValue || "",
                    styleObj: cell ? extractCellStyleObject(cell) : null
                });
            }
            const keyCell = getCell(r, sortKeyCol);
            const rawKey = (keyCell?.dataset.formula ? keyCell.textContent : (keyCell?.dataset.rawValue ?? keyCell?.textContent ?? "")).trim();
            rowsData.push({ origRow: r, rawKey, cells: rowCells });
        }

        const collator = new Intl.Collator("ja", { numeric: true, sensitivity: "base" });
        rowsData.sort((a, b) => {
            const aEmpty = a.rawKey === "";
            const bEmpty = b.rawKey === "";
            // 空白行は昇順・降順にかかわらず常に末尾へ配置（Excel準拠）
            if (aEmpty && bEmpty) return 0;
            if (aEmpty) return 1;
            if (bEmpty) return -1;

            const aNum = Number(a.rawKey.replace(/,/g, ""));
            const bNum = Number(b.rawKey.replace(/,/g, ""));
            let cmp = 0;
            if (!isNaN(aNum) && !isNaN(bNum)) {
                cmp = aNum - bNum;
            } else {
                cmp = collator.compare(a.rawKey, b.rawKey);
            }
            return ascending ? cmp : -cmp;
        });

        rowsData.forEach((rowItem, idx) => {
            const destRow = minR + idx;
            const rowDelta = destRow - rowItem.origRow;
            rowItem.cells.forEach((item, cIdx) => {
                const dest = getCell(destRow, minC + cIdx);
                if (!dest) return;

                if (item.numFormat) dest.dataset.numFormat = item.numFormat;
                else delete dest.dataset.numFormat;

                if (item.valueType) dest.dataset.valueType = item.valueType;
                else delete dest.dataset.valueType;

                if (item.dateValue) dest.dataset.dateValue = item.dateValue;
                else delete dest.dataset.dateValue;

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
        updateFillHandle();
        updateSelectedCellsDisplay();
        setDirtyState(true);
        debouncedSaveState();
    }

    // =========================================================
    // Excel 365準拠 オートフィルター機能
    // =========================================================
    let autoFilterState = null; // { headerRow, minCol, maxCol, maxRow, filters: Map<col, Set<string>> }

    function closeFilterDropdown() {
        document.querySelectorAll(".ss-filter-dropdown").forEach(el => el.remove());
    }

    function applyAutoFilterRows() {
        if (!autoFilterState) {
            Array.from(tbody.rows).forEach(tr => { tr.style.display = ""; });
            return;
        }
        const { headerRow, maxRow, filters } = autoFilterState;
        for (let r = headerRow + 1; r <= maxRow; r++) {
            const tr = getRow(r);
            if (!tr) continue;
            let visible = true;
            for (const [colIdx, allowedSet] of filters.entries()) {
                const cell = getVisibleCell(r, colIdx);
                const val = (cell?.textContent ?? "").trim();
                if (!allowedSet.has(val)) {
                    visible = false;
                    break;
                }
            }
            tr.style.display = visible ? "" : "none";
        }
        tbody.querySelectorAll(".ss-filter-arrow").forEach(arrow => {
            const c = Number(arrow.dataset.filterCol);
            arrow.classList.toggle("filtered", autoFilterState.filters.has(c));
        });
        refreshVisibleRows();
    }

    function openFilterDropdownMenu(colIdx, anchorEl) {
        closeFilterDropdown();
        if (!autoFilterState) return;
        const { headerRow, maxRow, filters } = autoFilterState;

        const uniqueValues = new Set();
        for (let r = headerRow + 1; r <= maxRow; r++) {
            const cell = getVisibleCell(r, colIdx);
            uniqueValues.add((cell?.textContent ?? "").trim());
        }
        const sortedVals = Array.from(uniqueValues).sort((a, b) => a.localeCompare(b, "ja", { numeric: true }));
        const currentAllowed = filters.get(colIdx) || new Set(sortedVals);

        const rect = anchorEl.getBoundingClientRect();
        const dropdown = document.createElement("div");
        dropdown.className = "ss-filter-dropdown";
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
                    <label class="ss-flt-item" data-val="${v.replace(/"/g, "&quot;")}" style="display:flex; align-items:center; gap:4px; cursor:pointer; white-space:nowrap;">
                        <input type="checkbox" value="${v.replace(/"/g, "&quot;")}" ${currentAllowed.has(v) ? "checked" : ""}>
                        <span>${v === "" ? "(空白セル)" : v}</span>
                    </label>
                `).join("")}
            </div>
            <div style="display:flex; justify-content:flex-end; gap:4px;">
                <button type="button" class="ss-flt-ok" style="padding:2px 10px; font-size:11px;">OK</button>
                <button type="button" class="ss-flt-cancel" style="padding:2px 8px; font-size:11px;">キャンセル</button>
            </div>
        `;
        document.body.appendChild(dropdown);

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

        dropdown.querySelector(".ss-flt-sort-asc").addEventListener("click", () => {
            closeFilterDropdown();
            const targetCell = getVisibleCell(headerRow + 1, colIdx);
            if (targetCell) {
                clearSelection();
                setActiveCell(targetCell, false);
                sortSelectedRange(true);
            }
        });

        dropdown.querySelector(".ss-flt-sort-desc").addEventListener("click", () => {
            closeFilterDropdown();
            const targetCell = getVisibleCell(headerRow + 1, colIdx);
            if (targetCell) {
                clearSelection();
                setActiveCell(targetCell, false);
                sortSelectedRange(false);
            }
        });

        dropdown.querySelector(".ss-flt-ok").addEventListener("click", () => {
            const checkedVals = new Set(itemChks.filter(c => c.checked).map(c => c.value));
            if (checkedVals.size === sortedVals.length) {
                filters.delete(colIdx);
            } else {
                filters.set(colIdx, checkedVals);
            }
            applyAutoFilterRows();
            closeFilterDropdown();
        });

        dropdown.querySelector(".ss-flt-cancel").addEventListener("click", closeFilterDropdown);
        searchInp.focus();
    }

    function clearAllAutoFilters() {
        closeFilterDropdown();
        tbody.querySelectorAll(".ss-filter-arrow").forEach(el => el.remove());
        autoFilterState = null;
        Array.from(tbody.rows).forEach(tr => { tr.style.display = ""; });
        appRoot.querySelector(".ss-toggle-filter-btn")?.classList.remove("selected");
        refreshVisibleRows();
    }

    function toggleAutoFilter() {
        if (autoFilterState) {
            clearAllAutoFilters();
            return;
        }
        const bounds = getSelectedRangeBounds();
        if (!bounds) return;

        let { minRow, maxRow, minCol, maxCol } = bounds;
        const isFilled = (r, c) => {
            const cell = getVisibleCell(r, c);
            return Boolean(cell && (cell.dataset.formula || (cell.dataset.rawValue ?? cell.textContent).trim() !== ""));
        };

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

        autoFilterState = {
            headerRow: minRow,
            minCol,
            maxCol,
            maxRow,
            filters: new Map()
        };

        for (let c = minCol; c <= maxCol; c++) {
            const headerCell = getVisibleCell(minRow, c);
            if (!headerCell) continue;
            const arrow = document.createElement("span");
            arrow.className = "ss-filter-arrow";
            arrow.dataset.filterCol = String(c);
            arrow.textContent = "▼";
            arrow.title = "フィルターと並べ替え";
            arrow.addEventListener("mousedown", (e) => {
                e.stopPropagation();
                e.preventDefault();
                openFilterDropdownMenu(c, arrow);
            }, { signal });
            headerCell.appendChild(arrow);
        }
        appRoot.querySelector(".ss-toggle-filter-btn")?.classList.add("selected");
    }

    document.addEventListener("mousedown", (e) => {
        if (!e.target.closest(".ss-filter-dropdown") && !e.target.closest(".ss-filter-arrow")) {
            closeFilterDropdown();
        }
        if (!e.target.closest(".ss-cell-dropdown-list") && !e.target.closest(".ss-cell-dropdown-btn")) {
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

            // parentWin を渡さないことで背面シートのクリック操作を維持しつつ window.js の窓として生成
            const modalContent = windowAPI.showModalWindow("検索と置換", bodyHtml, {
                width: 370,
                isHtml: true,
                allowDuplicate: true,
                disableMinimize: true,
                disableMaximize: true,
                buttons: [],
                onClose: () => {
                    findDialogOpen = false;
                    findWin = null;
                    if (activeCell) activeCell.focus({ preventScroll: true });
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
                if (activeCell) activeCell.focus({ preventScroll: true });
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
                setDirtyState(false);
                loadingstate.textContent = "新規シート";
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
                await pasteClipboardData(false);
                break;
            case "paste-values":
                await pasteClipboardData(true);
                break;
            case "format-painter": {
                const btn = appRoot.querySelector(".ss-format-painter-btn");
                if (formatPainterSnapshot) {
                    formatPainterSnapshot = null;
                    btn?.classList.remove("selected");
                } else if (activeCell) {
                    formatPainterSnapshot = {
                        styleObj: extractCellStyleObject(activeCell),
                        numFormat: activeCell.dataset.numFormat || "",
                        decimalPlaces: activeCell.dataset.decimalPlaces || ""
                    };
                    btn?.classList.add("selected");
                    loadingstate.textContent = "書式コピー待機中（貼り付け先セルを選択）";
                }
                break;
            }
            case "clear-cells":
                clearTargetCellsContent();
                break;
            case "clear-formats":
                getTargetCells().forEach(c => {
                    c.removeAttribute("style");
                    delete c.dataset.numFormat;
                    delete c.dataset.decimalPlaces;
                    delete c.dataset.cfApplied;
                    const raw = c.dataset.formula ? evaluateFormula(c.dataset.formula) : (c.dataset.rawValue ?? c.textContent);
                    setCellFormattedValue(c, raw);
                });
                setDirtyState(true);
                debouncedSaveState();
                break;
            case "clear-all":
                getTargetCells().forEach(c => {
                    c.removeAttribute("style");
                    delete c.dataset.numFormat;
                    delete c.dataset.decimalPlaces;
                    delete c.dataset.dropdownList;
                    delete c.dataset.cfApplied;
                });
                clearTargetCellsContent();
                break;
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
            case "insert-chart-line":
                insertFloatingChart("line");
                break;
            case "insert-chart-pie":
                insertFloatingChart("pie");
                break;
            case "recalc-all":
                updateAllFormulas();
                loadingstate.textContent = "再計算完了";
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
                }
                break;
            }
            case "print":
                window.print();
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
            case "find-replace":
                openFindReplaceDialog(false);
                break;
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
                openConditionalFormatModal();
                return;
            }
            if (preset === "manage") {
                openConditionalFormatManager();
                return;
            }
            const b = getSelectedRangeBounds();
            if (b) {
                if (preset === "clear") {
                    sheets[activeSheetIndex].conditionalFormats = [];
                } else if (preset === "duplicate") {
                    sheets[activeSheetIndex].conditionalFormats.push({
                        ...b, op: "duplicate", bgColor: "#ffc7ce", textColor: "#9c0006", bold: false
                    });
                } else {
                    sheets[activeSheetIndex].conditionalFormats.push({
                        ...b,
                        condition: preset === "lt0" ? "<0" : ">100",
                        bgColor: "#ffc7ce",
                        textColor: "#9c0006"
                    });
                }
                applyConditionalFormats();
                setDirtyState(true);
                debouncedSaveState();
            }
            return;
        }

        const presetBtn = e.target.closest("[data-table-preset]");
        if (presetBtn) {
            const themes = {
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
            const theme = themes[presetBtn.dataset.tablePreset];
            const useHeader = appRoot.querySelector(".ss-tbl-opt-header")?.checked ?? true;
            const useStripe = appRoot.querySelector(".ss-tbl-opt-stripe")?.checked ?? true;
            const bounds = getSelectedRangeBounds();
            if (theme && bounds) {
                for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
                    const isHeader = useHeader && r === bounds.minRow;
                    const dataRowIdx = useHeader ? (r - bounds.minRow - 1) : (r - bounds.minRow);
                    const isStripe = !isHeader && useStripe && (dataRowIdx % 2 === 1);
                    for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
                        const cell = getVisibleCell(r, c);
                        if (!cell) continue;
                        cell.style.borderTop = theme.border;
                        cell.style.borderBottom = theme.border;
                        cell.style.borderLeft = theme.border;
                        cell.style.borderRight = theme.border;
                        if (isHeader) {
                            cell.style.backgroundColor = theme.headerBg;
                            cell.style.color = theme.headerFg;
                            cell.style.fontWeight = "bold";
                        } else {
                            cell.style.backgroundColor = isStripe ? theme.stripeBg : theme.evenBg;
                            cell.style.color = theme.bodyFg;
                            cell.style.fontWeight = "";
                        }
                    }
                }
                setDirtyState(true);
                debouncedSaveState();
            }
            appRoot.querySelectorAll(".pulldown_menu").forEach(m => { m.style.display = "none"; });
            return;
        }

        const actionBtn = e.target.closest("[data-action]");
        if (actionBtn) {
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
            });
            setDirtyState(true);
            debouncedSaveState();
            return;
        }

        // 枠線適用（結合セルの端座標も考慮）
        const borderBtn = e.target.closest("[data-border]");
        if (borderBtn) {
            const type = borderBtn.dataset.border;
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
                    if (type === "top" && r0 === minR) c.style.borderTop = "4px solid #000";
                    if (type === "bottom" && r1 === maxR) c.style.borderBottom = "4px solid #000";
                    if (type === "left" && c0 === minC) c.style.borderLeft = "4px solid #000";
                    if (type === "right" && c1 === maxC) c.style.borderRight = "4px solid #000";
                    if (type === "outer" || type === "outer-bold") {
                        const w = type === "outer-bold" ? "6px" : "4px";
                        if (r0 === minR) c.style.borderTop = `${w} solid #000`;
                        if (r1 === maxR) c.style.borderBottom = `${w} solid #000`;
                        if (c0 === minC) c.style.borderLeft = `${w} solid #000`;
                        if (c1 === maxC) c.style.borderRight = `${w} solid #000`;
                    }
                    if (type === "cell") {
                        c.style.borderTop = "4px solid #000";
                        c.style.borderBottom = "4px solid #000";
                        c.style.borderLeft = "4px solid #000";
                        c.style.borderRight = "4px solid #000";
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
        if (activeCell && !activeCell.isContentEditable) {
            activeCell.focus({ preventScroll: true });
        }
    };

    appRoot.querySelector(".ss-font-size").addEventListener("change", (e) => {
        const affectedRows = new Set();
        getTargetCells().forEach(c => {
            c.style.fontSize = e.target.value;
            const tr = c.closest("tr");
            if (tr) affectedRows.add(tr);
        });
        affectedRows.forEach(tr => autoFitRow(tr));
        setDirtyState(true);
        debouncedSaveState();
        restoreCellFocusAfterToolbar();
    }, { signal });

    appRoot.querySelector(".ss-toggle-bold").addEventListener("click", () => {
        const targets = getTargetCells();
        const allBold = targets.length > 0 && targets.every(c => c.style.fontWeight === "bold");
        targets.forEach(c => { c.style.fontWeight = allBold ? "" : "bold"; });
        updateToolbarState();
        setDirtyState(true);
        debouncedSaveState();
    }, { signal });

    appRoot.querySelector(".ss-toggle-italic").addEventListener("click", () => {
        const targets = getTargetCells();
        const allItalic = targets.length > 0 && targets.every(c => c.style.fontStyle === "italic");
        targets.forEach(c => { c.style.fontStyle = allItalic ? "" : "italic"; });
        updateToolbarState();
        setDirtyState(true);
        debouncedSaveState();
    }, { signal });

    appRoot.querySelector(".ss-toggle-underline").addEventListener("click", () => {
        const targets = getTargetCells();
        const allUnderlined = targets.length > 0 && targets.every(c => c.style.textDecoration === "underline");
        targets.forEach(c => { c.style.textDecoration = allUnderlined ? "" : "underline"; });
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
        updateToolbarState();
        setDirtyState(true);
        debouncedSaveState();
    }, { signal });
    appRoot.querySelector(".ss-valign-middle").addEventListener("click", () => {
        getTargetCells().forEach(c => { c.style.verticalAlign = c.style.verticalAlign === "middle" ? "" : "middle"; });
        updateToolbarState();
        setDirtyState(true);
        debouncedSaveState();
    }, { signal });
    appRoot.querySelector(".ss-valign-bottom").addEventListener("click", () => {
        getTargetCells().forEach(c => { c.style.verticalAlign = c.style.verticalAlign === "bottom" ? "" : "bottom"; });
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

    document.addEventListener("mouseup", (e) => {
        if (currentPressedButton) {
            currentPressedButton.classList.remove("pressed");
            currentPressedButton = null;
        }
        if (formatPainterSnapshot && e.target.closest("td") && tbody.contains(e.target)) {
            const snap = formatPainterSnapshot;
            formatPainterSnapshot = null;
            appRoot.querySelector(".ss-format-painter-btn")?.classList.remove("selected");
            getTargetCells().forEach(cell => {
                applyCellStyleData(cell, snap.styleObj);
                if (snap.numFormat) cell.dataset.numFormat = snap.numFormat;
                else delete cell.dataset.numFormat;
                if (snap.decimalPlaces) cell.dataset.decimalPlaces = snap.decimalPlaces;
                else delete cell.dataset.decimalPlaces;
                const raw = cell.dataset.formula ? evaluateFormula(cell.dataset.formula) : (cell.dataset.rawValue ?? cell.textContent);
                setCellFormattedValue(cell, raw);
            });
            loadingstate.textContent = "書式を適用しました";
            setDirtyState(true);
            debouncedSaveState();
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

    function getSelectedRangeBounds() {
        const selected = Array.from(tbody.querySelectorAll("td.selected"));
        if (!selected.length) return null;
        let minRow = Infinity, maxRow = -Infinity, minCol = Infinity, maxCol = -Infinity;
        selected.forEach(c => {
            const r0 = +c.dataset.row;
            const c0 = +c.dataset.col;
            const r1 = r0 + (+c.getAttribute("rowspan") || 1) - 1;
            const c1 = c0 + (+c.getAttribute("colspan") || 1) - 1;
            minRow = Math.min(minRow, r0);
            maxRow = Math.max(maxRow, r1);
            minCol = Math.min(minCol, c0);
            maxCol = Math.max(maxCol, c1);
        });
        return { minRow, maxRow, minCol, maxCol };
    }

    function resolveCellFromPoint(e) {
        const rawCell = e.target?.closest?.("td");
        if (!rawCell || !tbody.contains(rawCell)) return null;
        if (rawCell.classList.contains("ss-text-overflow")) {
            const rect = rawCell.getBoundingClientRect();
            if (e.clientX > rect.right) {
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
        if (!cell || cell.isContentEditable) return false;
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

    function clearMoveTargetPreview() {
        tbody.querySelectorAll("td.move-target-preview, td.move-target-invalid").forEach(c => {
            c.classList.remove("move-target-preview", "move-target-invalid");
        });
    }

    function hasMergeConflictOnDestination(destBounds, movingSrcBounds = null) {
        for (let r = destBounds.minRow; r <= destBounds.maxRow; r++) {
            for (let c = destBounds.minCol; c <= destBounds.maxCol; c++) {
                // 通常移動（複製でない）で移動元自身の領域内にあるセルは移動時にクリアされるため除外
                if (
                    movingSrcBounds &&
                    r >= movingSrcBounds.minRow && r <= movingSrcBounds.maxRow &&
                    c >= movingSrcBounds.minCol && c <= movingSrcBounds.maxCol
                ) {
                    continue;
                }
                const cell = getCell(r, c);
                if (!cell) continue;
                const isMergedPart =
                    cell.style.display === "none" ||
                    cell.classList.contains("merged") ||
                    Boolean(cell.dataset.mergeMinRow) ||
                    Boolean(cell.dataset.mergeAnchorRow) ||
                    parseInt(cell.getAttribute("rowspan") || "1", 10) > 1 ||
                    parseInt(cell.getAttribute("colspan") || "1", 10) > 1;
                if (isMergedPart) return true;
            }
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

        // 本物のExcel準拠：移動先（複製時は移動元含む）に結合セルが重なる場合は移動不可
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
                    valueType: cell.dataset.valueType || "",
                    dateValue: cell.dataset.dateValue || "",
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

        // 移動先へデータ・スタイル・結合を配置
        items.forEach(item => {
            const tr = destTopLeft.row + item.relR;
            const tc = destTopLeft.col + item.relC;
            const dest = getCell(tr, tc);
            if (!dest) return;

            if (item.numFormat) dest.dataset.numFormat = item.numFormat;
            else delete dest.dataset.numFormat;

            if (item.valueType) dest.dataset.valueType = item.valueType;
            else delete dest.dataset.valueType;

            if (item.dateValue) dest.dataset.dateValue = item.dateValue;
            else delete dest.dataset.dateValue;

            if (item.formula) {
                const nextFormula = copyMode ? adjustFormula(item.formula, rowDelta, colDelta) : item.formula;
                dest.dataset.formula = nextFormula;
                setCellFormattedValue(dest, evaluateFormula(nextFormula));
            } else {
                delete dest.dataset.formula;
                setCellFormattedValue(dest, item.value);
            }

            applyCellStyleData(dest, item.styleObj);

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
        // Excel準拠：複製ではなく「移動」のとき、移動元セルを参照していた別数式を移動先へ自動追従させる
        if (!copyMode) {
            redirectFormulasForMovedRange(srcBounds, rowDelta, colDelta);
        }

        const newActive = getVisibleCell(destTopLeft.row, destTopLeft.col);
        if (newActive) setActiveCell(newActive, true);

        updateAllFormulas();
        updateSelectedCellsDisplay();
        updateFillHandle();
        setDirtyState(true);
        debouncedSaveState();
    }

    function redirectFormulasForMovedRange(srcBounds, rowDelta, colDelta, excludeBounds = null) {
        const isInMovedBox = (r, c) =>
            r >= srcBounds.minRow && r <= srcBounds.maxRow &&
            c >= srcBounds.minCol && c <= srcBounds.maxCol;

        tbody.querySelectorAll("td[data-formula]").forEach(td => {
            if (excludeBounds) {
                const tr = parseInt(td.dataset.row, 10);
                const tc = parseInt(td.dataset.col, 10);
                if (tr >= excludeBounds.minRow && tr <= excludeBounds.maxRow && tc >= excludeBounds.minCol && tc <= excludeBounds.maxCol) {
                    return;
                }
            }
            const f = td.dataset.formula;
            if (!f || !f.startsWith("=")) return;

            let updated = f.substring(1).replace(/(\$?)([A-Z]+)(\$?)(\d+):(\$?)([A-Z]+)(\$?)(\d+)/g, (m, aC1, col1, aR1, row1, aC2, col2, aR2, row2) => {
                const c1 = columnLettersToIndex(col1), r1 = parseInt(row1, 10);
                const c2 = columnLettersToIndex(col2), r2 = parseInt(row2, 10);
                if (isInMovedBox(r1, c1) && isInMovedBox(r2, c2)) {
                    return `${aC1}${getColumnName(c1 + colDelta)}${aR1}${r1 + rowDelta}:${aC2}${getColumnName(c2 + colDelta)}${aR2}${r2 + rowDelta}`;
                }
                return m;
            });

            updated = updated.replace(/(\$?)([A-Z]+)(\$?)(\d+)/g, (m, aC, col, aR, row) => {
                const c = columnLettersToIndex(col), r = parseInt(row, 10);
                if (isInMovedBox(r, c)) {
                    return `${aC}${getColumnName(c + colDelta)}${aR}${r + rowDelta}`;
                }
                return m;
            });

            td.dataset.formula = "=" + updated;
        });
    }

    table.addEventListener("mousedown", (e) => {
        if (e.target.closest(".floating-textbox")) return;

        // 全選択コーナー
        if (e.target.closest(".ss-corner")) {
            e.preventDefault();
            if (document.activeElement?.isContentEditable) document.activeElement.blur();
            const allCells = tbody.querySelectorAll("td");
            allCells.forEach(c => {
                if (c.style.display !== "none") c.classList.add("selected");
            });
            setActiveCell(getVisibleCell(1, 0), true);
            updateSelectedCellsDisplay();
            updateFillHandle();
            return;
        }

        // 行ヘッダー選択
        const rowHeader = e.target.closest("th.row_number");
        if (rowHeader) {
            e.preventDefault();
            if (document.activeElement?.isContentEditable) document.activeElement.blur();
            isRowSelecting = true;
            rowSelectionStart = parseInt(rowHeader.textContent.trim(), 10);
            clearSelection();
            for (let c = 0; c < currentColumns; c++) {
                const vis = getVisibleCell(rowSelectionStart, c);
                if (vis && vis.style.display !== "none") vis.classList.add("selected");
            }
            setActiveCell(getVisibleCell(rowSelectionStart, 0), true);
            updateSelectedCellsDisplay();
            return;
        }

        // 列ヘッダー選択
        const colHeader = e.target.closest("th.col_number");
        if (colHeader) {
            e.preventDefault();
            if (document.activeElement?.isContentEditable) document.activeElement.blur();
            isColSelecting = true;
            colSelectionStart = columnLettersToIndex(colHeader.textContent.trim());
            clearSelection();
            for (let r = 1; r < rowCount; r++) {
                const vis = getVisibleCell(r, colSelectionStart);
                if (vis && vis.style.display !== "none") vis.classList.add("selected");
            }
            setActiveCell(getVisibleCell(1, colSelectionStart), true);
            updateSelectedCellsDisplay();
            return;
        }

        // セル選択・範囲移動
        const cell = resolveCellFromPoint(e);
        if (!cell || !tbody.contains(cell)) return;
        if (cell.isContentEditable) return;
        if (e.button !== 0) return;

        // 選択範囲の外周エッジを掴んだ場合は範囲移動を開始
        if (!isInFormulaEdit() && isPointerOnSelectionEdge(e, cell)) {
            const bounds = getSelectedRangeBounds();
            if (bounds) {
                const grabRow = Math.min(bounds.maxRow, Math.max(bounds.minRow, parseInt(cell.dataset.row, 10)));
                const grabCol = Math.min(bounds.maxCol, Math.max(bounds.minCol, parseInt(cell.dataset.col, 10)));
                isRangeMoving = true;
                moveSourceBounds = bounds;
                moveGrabOffset = {
                    row: grabRow - bounds.minRow,
                    col: grabCol - bounds.minCol
                };
                moveTargetTopLeft = { row: bounds.minRow, col: bounds.minCol };
                e.preventDefault();
                return;
            }
        }

        // 数式編集中ならセル参照の選択を開始（挿入は mouseup で1回だけ確定）
        if (isInFormulaEdit()) {
            e.preventDefault();
            isSelecting = true;
            selectionStart = {
                row: parseInt(cell.dataset.row, 10),
                col: parseInt(cell.dataset.col, 10)
            };
            selectionEnd = { ...selectionStart };
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
        if (activeCell && activeCell.isContentEditable) {
            commitCellValue(activeCell, activeCell.textContent);
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
            const hoverCell = e.target.closest("td");
            if (hoverCell && tbody.contains(hoverCell)) {
                const destRow = Math.max(1, parseInt(hoverCell.dataset.row, 10) - moveGrabOffset.row);
                const destCol = Math.max(0, parseInt(hoverCell.dataset.col, 10) - moveGrabOffset.col);
                moveTargetTopLeft = { row: destRow, col: destCol };

                clearMoveTargetPreview();
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
                const previewClass = isInvalid ? "move-target-invalid" : "move-target-preview";
                for (let r = destRow; r < destRow + h; r++) {
                    for (let c = destCol; c < destCol + w; c++) {
                        getCell(r, c)?.classList.add(previewClass);
                    }
                }
            }
            return;
        }

        if (!isSelecting && !isRowSelecting && !isColSelecting && !isFillDragging) {
            const hoverCell = resolveCellFromPoint(e);
            if (hoverCell && tbody.contains(hoverCell)) {
                hoverCell.style.cursor = isPointerOnSelectionEdge(e, hoverCell) ? "move" : "";
            }
        }

        if (isSelecting) {
            const cell = resolveCellFromPoint(e);
            if (cell && tbody.contains(cell)) {
                selectionEnd = {
                    row: parseInt(cell.dataset.row, 10),
                    col: parseInt(cell.dataset.col, 10)
                };
                updateSelection();
            }
        } else if (isRowSelecting) {
            const th = e.target.closest("th.row_number");
            if (th) {
                const cur = parseInt(th.textContent.trim(), 10);
                clearSelection();
                for (let r = Math.min(rowSelectionStart, cur); r <= Math.max(rowSelectionStart, cur); r++) {
                    tbody.querySelectorAll(`td[data-row="${r}"]`).forEach(c => {
                        if (c.style.display !== "none") c.classList.add("selected");
                    });
                }
                updateSelectedCellsDisplay();
            }
        } else if (isColSelecting) {
            const th = e.target.closest("th.col_number");
            if (th) {
                const cur = columnLettersToIndex(th.textContent.trim());
                clearSelection();
                for (let c = Math.min(colSelectionStart, cur); c <= Math.max(colSelectionStart, cur); c++) {
                    tbody.querySelectorAll(`td[data-col="${c}"]`).forEach(td => {
                        if (td.style.display !== "none") td.classList.add("selected");
                    });
                }
                updateSelectedCellsDisplay();
            }
        }
    }, { signal });

    document.addEventListener("mouseup", (e) => {
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
                loadingstate.textContent = "書式を適用しました";
                setDirtyState(true);
                debouncedSaveState();
            }
            if (selectionStart && selectionEnd && isInFormulaEdit()) {
                const minRow = Math.min(selectionStart.row, selectionEnd.row);
                const maxRow = Math.max(selectionStart.row, selectionEnd.row);
                const minCol = Math.min(selectionStart.col, selectionEnd.col);
                const maxCol = Math.max(selectionStart.col, selectionEnd.col);
                if (minRow === maxRow && minCol === maxCol) {
                    const clickedCell = getCell(minRow, minCol);
                    if (clickedCell && clickedCell !== activeCell) {
                        insertCellReference(getCellReferenceByCoord(minRow, minCol));
                    }
                } else {
                    const rangeStr = `${getCellReferenceByCoord(minRow, minCol)}:${getCellReferenceByCoord(maxRow, maxCol)}`;
                    insertCellReference(rangeStr);
                }
            }
            updateFillHandle();
        }
        isRowSelecting = false;
        isColSelecting = false;
    }, { signal });

    table.addEventListener("selectstart", (e) => {
        if (!e.target.closest('[contenteditable="true"]')) {
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

    table.addEventListener("focusout", (e) => {
        const cell = e.target.closest("td");
        if (!cell || !tbody.contains(cell) || !cell.isContentEditable) return;
        managedTimeout(() => {
            if (document.activeElement === formulaBarInput) return;
            if (isInFormulaEdit()) return;
            if (cell.isContentEditable) {
                commitCellValue(cell, cell.textContent);
                updateFillHandle();
            }
        }, 0);
    }, { signal });

    table.addEventListener("input", (e) => {
        const cell = e.target.closest("td[contenteditable='true']");
        if (!cell) return;
        const val = cell.textContent.trim();
        if (val.startsWith("=")) highlightCalculationRange(val);
        else clearCalculationRangeHighlights();
        formulaBarInput.value = cell.textContent;
        setDirtyState(true);
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

    // 数式バーイベント
    formulaBarInput.addEventListener("click", () => {
        const formulaText = formulaBarInput.value.trim();
        if (formulaText && formulaText.startsWith("=")) highlightCalculationRange(formulaText);
        else clearCalculationRangeHighlights();
        if (activeCell) activeCell.style.outline = "solid 3.5px steelblue";
    }, { signal });

    formulaBarInput.addEventListener("focus", () => {
        lastPointRefRange = null;
        if (activeCell) {
            activeCell.dataset.originalText = activeCell.dataset.rawValue ?? activeCell.textContent;
            if (activeCell.dataset.formula) {
                activeCell.dataset.originalFormula = activeCell.dataset.formula;
                if (formulaBarInput.value !== activeCell.dataset.formula) {
                    formulaBarInput.value = activeCell.dataset.formula;
                }
                highlightCalculationRange(activeCell.dataset.formula);
            } else {
                delete activeCell.dataset.originalFormula;
                const nextText = activeCell.dataset.rawValue ?? activeCell.textContent;
                if (formulaBarInput.value !== nextText) {
                    formulaBarInput.value = nextText;
                }
            }
            updateFillHandle();
        }
    }, { signal });

    formulaBarInput.addEventListener("blur", () => {
        isFormulaBarDirty = false;
        clearCalculationRangeHighlights();
        tbody.querySelectorAll("td.selected").forEach(c => { c.style.outline = ""; });
        if (activeCell) activeCell.style.outline = "";
    }, { signal });

    function commitValueToTargets(baseCell, targets, rawVal, applyToAll = false) {
        if (!baseCell) return;
        const trimmed = String(rawVal ?? "").trim();
        if (!applyToAll || targets.length <= 1) {
            commitCellValue(baseCell, trimmed);
            return;
        }
        const baseR = parseInt(baseCell.dataset.row, 10);
        const baseC = parseInt(baseCell.dataset.col, 10);
        targets.forEach(cell => {
            if (cell === baseCell) {
                commitCellValue(cell, trimmed);
            } else if (trimmed.startsWith("=")) {
                const rOff = parseInt(cell.dataset.row, 10) - baseR;
                const cOff = parseInt(cell.dataset.col, 10) - baseC;
                commitCellValue(cell, adjustFormula(trimmed, rOff, cOff));
            } else {
                commitCellValue(cell, trimmed);
            }
        });
    }

    formulaBarInput.addEventListener("input", () => {
        isFormulaBarDirty = true;
        const val = formulaBarInput.value;
        const trimmed = val.trim();
        if (trimmed && trimmed.startsWith("=")) highlightCalculationRange(trimmed);
        else clearCalculationRangeHighlights();

        if (trimmed === '{"mergecell"}') highlightMergedCells();
        else removeMergedCellsHighlight();

        if (activeCell) {
            activeCell.textContent = val;
            activeCell.style.outline = "solid 2px steelblue";
        }
        setDirtyState(true);
    }, { signal });

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

    function toggleAbsoluteReferenceInInput(inputEl) {
        const val = inputEl.value;
        if (!val.trim().startsWith("=")) return false;
        const pos = inputEl.selectionStart ?? val.length;
        const before = val.slice(0, pos);
        const after = val.slice(pos);
        const leftMatch = before.match(/(\$?[A-Za-z]+\$?\d+)$/);
        const rightMatch = !leftMatch ? after.match(/^(\$?[A-Za-z]+\$?\d+)/) : null;
        if (!leftMatch && !rightMatch) return false;

        const targetRef = leftMatch ? leftMatch[1] : rightMatch[1];
        const startIdx = leftMatch ? pos - targetRef.length : pos;
        const m = targetRef.match(/^(\$?)([A-Za-z]+)(\$?)(\d+)$/);
        if (!m) return false;

        const [, absC, col, absR, row] = m;
        let nextRef;
        if (!absC && !absR) nextRef = `$${col}$${row}`;
        else if (absC && absR) nextRef = `${col}$${row}`;
        else if (!absC && absR) nextRef = `$${col}${row}`;
        else nextRef = `${col}${row}`;

        inputEl.value = val.slice(0, startIdx) + nextRef + val.slice(startIdx + targetRef.length);
        inputEl.setSelectionRange(startIdx, startIdx + nextRef.length);
        inputEl.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
    }

    formulaBarInput.addEventListener("keydown", (e) => {
        if (isImeActive(e)) return;
        if (e.key === "F4") {
            if (toggleAbsoluteReferenceInInput(formulaBarInput)) {
                e.preventDefault();
                return;
            }
        }
        if (e.key === "Enter") {
            e.preventDefault();
            if (activeCell) {
                const r = parseInt(activeCell.dataset.row, 10);
                const c = parseInt(activeCell.dataset.col, 10);
                const isBulk = e.ctrlKey || e.metaKey;
                commitValueToTargets(activeCell, getTargetCells(), formulaBarInput.value, isBulk);
                formulaBarInput.blur();
                if (isBulk) {
                    activeCell.focus({ preventScroll: true });
                    updateSelectedCellsDisplay();
                    updateFillHandle();
                } else {
                    navigateToCell(r + 1, c, e);
                }
            }
        } else if (e.key === "Escape") {
            e.preventDefault();
            revertSelectedCellsText();
            formulaBarInput.blur();
            if (activeCell) activeCell.focus({ preventScroll: true });
        }
    }, { signal });

    // キーボードショートカット・IME直接入力対応
    document.addEventListener("compositionstart", (e) => {
        isComposing = true;
        justEndedComposition = false;
        if (!isAppFocused()) return;
        if (e.target?.closest?.(".floating-textbox, .ss-find-win-body, .ss-find-dialog") || document.activeElement === formulaBarInput) return;
        if (activeCell && !activeCell.isContentEditable) {
            activeCell.dataset.originalText = activeCell.dataset.rawValue ?? activeCell.textContent;
            if (activeCell.dataset.formula) {
                activeCell.dataset.originalFormula = activeCell.dataset.formula;
            } else {
                delete activeCell.dataset.originalFormula;
            }
            activeCell.textContent = "";
            activeCell.contentEditable = "true";
            activeCell.dataset.editBy = "typing";
            if (document.activeElement !== activeCell) {
                activeCell.focus();
            }
            formulaBarInput.value = "";
            clearCopyAnimation();
            setDirtyState(true);
        }
    }, { signal });

    document.addEventListener("compositionend", () => {
        isComposing = false;
        justEndedComposition = true;
        managedTimeout(() => {
            justEndedComposition = false;
        }, 0);
        if (activeCell && activeCell.isContentEditable) {
            formulaBarInput.value = activeCell.textContent;
        }
    }, { signal });

    document.addEventListener("keydown", (e) => {
        if (!isAppFocused()) return;
        if (e.target.closest(".floating-textbox, .ss-find-win-body, .ss-find-dialog")) return;
        if ((e.key === "Process" || e.keyCode === 229) && activeCell && !activeCell.isContentEditable && document.activeElement !== formulaBarInput) {
            activeCell.dataset.originalText = activeCell.dataset.rawValue ?? activeCell.textContent;
            if (activeCell.dataset.formula) {
                activeCell.dataset.originalFormula = activeCell.dataset.formula;
            } else {
                delete activeCell.dataset.originalFormula;
            }
            activeCell.textContent = "";
            activeCell.contentEditable = "true";
            activeCell.dataset.editBy = "typing";
            formulaBarInput.value = "";
            clearCopyAnimation();
            setDirtyState(true);
            return;
        }
        if (isImeActive(e)) return;

        if (e.ctrlKey || e.metaKey) {
            if (e.key === "Enter" && activeCell) {
                e.preventDefault();
                const val = activeCell.isContentEditable
                    ? activeCell.textContent
                    : (activeCell.dataset.formula || activeCell.dataset.rawValue || activeCell.textContent);
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
            if (document.activeElement !== formulaBarInput && !document.activeElement?.isContentEditable) {
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
                    void pasteClipboardData(e.shiftKey);
                    return;
                }
                if (key === "a") {
                    e.preventDefault();
                    const allCells = tbody.querySelectorAll("td");
                    allCells.forEach(c => {
                        if (c.style.display !== "none") c.classList.add("selected");
                    });
                    setActiveCell(getVisibleCell(1, 0), true);
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

            if (e.key === ";" && activeCell && !activeCell.isContentEditable) {
                e.preventDefault();
                commitCellValue(activeCell, formatDate(new Date()));
                updateSelectedCellsDisplay();
                return;
            }

            if ((key === "d" || key === "r") && activeCell && !activeCell.isContentEditable && document.activeElement !== formulaBarInput) {
                e.preventDefault();
                const b = getSelectedRangeBounds();
                if (!b) return;
                if (key === "d") {
                    const targetMaxR = b.maxRow > b.minRow ? b.maxRow : b.minRow + 1;
                    const srcMinR = b.maxRow > b.minRow ? b.minRow : Math.max(1, b.minRow - 1);
                    for (let c = b.minCol; c <= b.maxCol; c++) {
                        const src = getVisibleCell(srcMinR, c);
                        for (let r = srcMinR + 1; r <= targetMaxR; r++) {
                            const dst = getVisibleCell(r, c);
                            if (src && dst) cloneCellProperties(src, dst);
                        }
                    }
                } else {
                    const targetMaxC = b.maxCol > b.minCol ? b.maxCol : b.minCol + 1;
                    const srcMinC = b.maxCol > b.minCol ? b.minCol : Math.max(0, b.minCol - 1);
                    for (let r = b.minRow; r <= b.maxRow; r++) {
                        const src = getVisibleCell(r, srcMinC);
                        for (let c = srcMinC + 1; c <= targetMaxC; c++) {
                            const dst = getVisibleCell(r, c);
                            if (src && dst) cloneCellProperties(src, dst);
                        }
                    }
                }
                updateAllFormulas();
                updateFillHandle();
                setDirtyState(true);
                debouncedSaveState();
                return;
            }

            const ctrlArrows = {
                ArrowUp: [-1, 0],
                ArrowDown: [1, 0],
                ArrowLeft: [0, -1],
                ArrowRight: [0, 1]
            };
            if (ctrlArrows[e.key] && activeCell && !activeCell.isContentEditable && document.activeElement !== formulaBarInput) {
                e.preventDefault();
                const [dR, dC] = ctrlArrows[e.key];
                const basePos = (e.shiftKey && selectionEnd) ? selectionEnd : {
                    row: parseInt(activeCell.dataset.row, 10),
                    col: parseInt(activeCell.dataset.col, 10)
                };
                const isFilled = (r, c) => {
                    const cell = getVisibleCell(r, c);
                    return Boolean(cell && (cell.dataset.formula || (cell.dataset.rawValue ?? cell.textContent).trim() !== ""));
                };
                let r = basePos.row;
                let c = basePos.col;
                const maxR = rowCount - 1;
                const maxC = currentColumns - 1;
                const startAnchor = getVisibleCell(r, c);
                while (r + dR >= 1 && r + dR <= maxR && c + dC >= 0 && c + dC <= maxC && getVisibleCell(r + dR, c + dC) === startAnchor) {
                    r += dR;
                    c += dC;
                }
                const startFilled = isFilled(r, c);
                const nextFilled = isFilled(r + dR, c + dC);

                if (startFilled && nextFilled) {
                    while (r + dR >= 1 && r + dR <= maxR && c + dC >= 0 && c + dC <= maxC && isFilled(r + dR, c + dC)) {
                        r += dR;
                        c += dC;
                    }
                } else {
                    while (r + dR >= 1 && r + dR <= maxR && c + dC >= 0 && c + dC <= maxC) {
                        r += dR;
                        c += dC;
                        if (isFilled(r, c)) break;
                    }
                }

                const landed = getVisibleCell(r, c);
                if (landed) {
                    if (e.shiftKey) {
                        if (!selectionStart) {
                            selectionStart = { row: parseInt(activeCell.dataset.row, 10), col: parseInt(activeCell.dataset.col, 10) };
                        }
                        selectionEnd = { row: parseInt(landed.dataset.row, 10), col: parseInt(landed.dataset.col, 10) };
                        updateSelection();
                        updateFillHandle();
                        landed.scrollIntoView({ block: "nearest", inline: "nearest" });
                    } else {
                        selectionStart = { row: parseInt(landed.dataset.row, 10), col: parseInt(landed.dataset.col, 10) };
                        selectionEnd = { ...selectionStart };
                        navigateToCell(selectionStart.row, selectionStart.col, e);
                    }
                }
                return;
            }
            return;
        }

        if (document.activeElement === formulaBarInput) return;

        // F2でセル編集開始
        if (e.key === "F2" && activeCell) {
            e.preventDefault();
            enterCellEditMode(activeCell, false, "F2");
            updateFillHandle();
            return;
        }

        // Escapeで編集キャンセル・コピーアニメ解除
        if (e.key === "Escape") {
            clearCopyAnimation();
            if (activeCell && activeCell.isContentEditable) {
                revertSelectedCellsText();
                activeCell.focus({ preventScroll: true });
                e.preventDefault();
            }
            return;
        }

        // Enter処理
        if (e.key === "Enter" && activeCell) {
            if (activeCell.isContentEditable && e.altKey) {
                e.preventDefault();
                document.execCommand("insertText", false, "\n");
                formulaBarInput.value = activeCell.textContent;
                autoFitRow(activeCell.closest("tr"));
                setDirtyState(true);
                return;
            }
            e.preventDefault();
            const r = parseInt(activeCell.dataset.row, 10);
            const c = parseInt(activeCell.dataset.col, 10);
            const rs = parseInt(activeCell.getAttribute("rowspan") || "1", 10);
            if (activeCell.isContentEditable) {
                commitCellValue(activeCell, activeCell.textContent);
            }
            navigateToCell(r + rs, c, e);
            return;
        }

        // Tab処理（Shift+Tab左端折り返し対応）
        if (e.key === "Tab" && activeCell) {
            e.preventDefault();
            let r = parseInt(activeCell.dataset.row, 10);
            const c = parseInt(activeCell.dataset.col, 10);
            const cs = parseInt(activeCell.getAttribute("colspan") || "1", 10);
            if (activeCell.isContentEditable) {
                commitCellValue(activeCell, activeCell.textContent);
            }
            let targetCol = e.shiftKey ? c - 1 : c + cs;
            let targetRow = r;
            if (targetCol >= currentColumns) {
                loadColumnsSync(targetCol - currentColumns + 1);
            }
            if (targetCol < 0) {
                targetRow = Math.max(1, r - 1);
                targetCol = currentColumns - 1;
            }
            navigateToCell(targetRow, targetCol, e);
            return;
        }

        // Backspace / Delete でのセル内容クリア（単一セルのBackspaceはExcel同様に即編集モードへ移行）
        if ((e.key === "Backspace" || e.key === "Delete") && !document.activeElement?.isContentEditable) {
            e.preventDefault();
            const targets = getTargetCells();
            if (e.key === "Backspace" && targets.length === 1 && activeCell) {
                enterCellEditMode(activeCell, false, "typing");
                activeCell.textContent = "";
                delete activeCell.dataset.formula;
                delete activeCell.dataset.rawValue;
                formulaBarInput.value = "";
                setDirtyState(true);
                return;
            }
            targets.forEach(c => {
                c.textContent = "";
                delete c.dataset.formula;
                delete c.dataset.rawValue;
            });
            formulaBarInput.value = "";
            updateAllFormulas();
            updateFillHandle();
            setDirtyState(true);
            debouncedSaveState();
            return;
        }

        // Home（行頭A列へ移動）・PageUp / PageDown（1画面分スクロール移動）
        if (e.key === "Home" && activeCell && !activeCell.isContentEditable) {
            e.preventDefault();
            const r = parseInt(activeCell.dataset.row, 10);
            navigateToCell(r, 0, e);
            return;
        }

        if ((e.key === "PageUp" || e.key === "PageDown") && activeCell && !activeCell.isContentEditable) {
            e.preventDefault();
            const pageRows = Math.max(1, Math.floor((container.clientHeight - 30) / 30));
            const curR = parseInt(activeCell.dataset.row, 10);
            const curC = parseInt(activeCell.dataset.col, 10);
            const nextR = e.key === "PageDown" ? curR + pageRows : Math.max(1, curR - pageRows);
            navigateToCell(nextR, curC, e);
            return;
        }

        // 矢印キー移動（直接タイピング中は確定して即移動、dblclick/F2/数式中のみキャレット優先）
        const arrowKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
        if (arrowKeys.includes(e.key) && activeCell) {
            if (document.activeElement && document.activeElement.isContentEditable) {
                const cellText = document.activeElement.textContent.trim();
                if (
                    cellText.startsWith("=") ||
                    document.activeElement.dataset.editBy === "dblclick" ||
                    document.activeElement.dataset.editBy === "F2"
                ) {
                    return;
                }
                commitCellValue(document.activeElement, document.activeElement.textContent);
            }

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
                if (e.key === "ArrowLeft") nextC = Math.max(0, curC - 1);
                if (e.key === "ArrowRight") nextC = curC + cs;

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
                    if (e.key === "ArrowUp") extR = Math.max(1, extR - 1);
                    if (e.key === "ArrowDown") extR = extR + 1;
                    if (e.key === "ArrowLeft") extC = Math.max(0, extC - 1);
                    if (e.key === "ArrowRight") extC = extC + 1;

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
            if (!appRoot._navInterval) {
                appRoot._navInterval = setInterval(doMoveStep, 100);
            }
            return;
        }

        // 印字可能文字の直接入力で編集モード移行（Shift+Spaceは除外）
        if (activeCell && !activeCell.isContentEditable && e.key.length === 1 && !e.altKey && !(e.shiftKey && e.key === " ")) {
            e.preventDefault();
            clearCopyAnimation();
            activeCell.dataset.originalText = activeCell.dataset.rawValue ?? activeCell.textContent;
            if (activeCell.dataset.formula) {
                activeCell.dataset.originalFormula = activeCell.dataset.formula;
            } else {
                delete activeCell.dataset.originalFormula;
            }
            activeCell.contentEditable = "true";
            activeCell.dataset.editBy = "typing";
            activeCell.textContent = e.key;
            activeCell.focus();
            setCaretToEnd(activeCell);
            formulaBarInput.value = e.key;
            if (e.key === "=") {
                highlightCalculationRange("=");
            }
            setDirtyState(true);
        }
    }, { signal });

    const stopNavInterval = () => {
        if (appRoot._navInterval) {
            clearInterval(appRoot._navInterval);
            appRoot._navInterval = null;
        }
    };
    document.addEventListener("keyup", (e) => {
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
            stopNavInterval();
        }
    }, { signal });
    window.addEventListener("blur", stopNavInterval, { signal });

    function clearTargetCellsContent() {
        const targets = getTargetCells();
        if (!targets.length) return;
        targets.forEach(c => {
            c.textContent = "";
            delete c.dataset.formula;
            delete c.dataset.rawValue;
        });
        formulaBarInput.value = "";
        updateAllFormulas();
        updateFillHandle();
        setDirtyState(true);
        debouncedSaveState();
    }

    attachContextMenu(table, (e) => {
        if (e.target.closest(".floating-textbox")) return null;
        if (activeCell && activeCell.isContentEditable) return null;

        // 1. 行ヘッダー右クリック
        const rowHeader = e.target.closest("th.row_number");
        if (rowHeader) {
            const rowNum = parseInt(rowHeader.textContent.trim(), 10);
            const rowTds = Array.from(tbody.querySelectorAll(`td[data-row="${rowNum}"]`)).filter(td => td.style.display !== "none");
            const isAlreadyRowSelected = rowTds.length > 0 && rowTds.every(td => td.classList.contains("selected"));
            if (!isAlreadyRowSelected) {
                clearSelection();
                rowTds.forEach(td => td.classList.add("selected"));
                setActiveCell(getVisibleCell(rowNum, 0), true);
                updateSelectedCellsDisplay();
                updateFillHandle();
            }
            return [
                { label: "切り取り (Ctrl+X)", action: () => copySelectedCells(true) },
                { label: "コピー (Ctrl+C)", action: () => copySelectedCells(false) },
                { label: "貼り付け (Ctrl+V)", action: () => void pasteClipboardData(false) },
                { label: "---" },
                { label: "行を上に挿入", action: () => modifySheetRowCol("insert-row") },
                { label: "行を削除", action: () => modifySheetRowCol("delete-row") },
                {
                    label: "行の高さを自動調整", action: () => {
                        const selectedRows = new Set([rowNum]);
                        tbody.querySelectorAll("td.selected").forEach(td => selectedRows.add(Number(td.dataset.row)));
                        selectedRows.forEach(r => autoFitRow(getRow(r)));
                        setDirtyState(true);
                        debouncedSaveState();
                    }
                },
                { label: "---" },
                { label: "行の内容をクリア", action: clearTargetCellsContent }
            ];
        }

        // 2. 列ヘッダー右クリック
        const colHeader = e.target.closest("th.col_number");
        if (colHeader) {
            const colIdx = columnLettersToIndex(colHeader.textContent.trim());
            const colTds = Array.from(tbody.querySelectorAll(`td[data-col="${colIdx}"]`)).filter(td => td.style.display !== "none");
            const isAlreadyColSelected = colTds.length > 0 && colTds.every(td => td.classList.contains("selected"));
            if (!isAlreadyColSelected) {
                clearSelection();
                colTds.forEach(td => td.classList.add("selected"));
                setActiveCell(getVisibleCell(1, colIdx), true);
                updateSelectedCellsDisplay();
                updateFillHandle();
            }
            return [
                { label: "切り取り (Ctrl+X)", action: () => copySelectedCells(true) },
                { label: "コピー (Ctrl+C)", action: () => copySelectedCells(false) },
                { label: "貼り付け (Ctrl+V)", action: () => void pasteClipboardData(false) },
                { label: "---" },
                { label: "列を左に挿入", action: () => modifySheetRowCol("insert-col") },
                { label: "列を削除", action: () => modifySheetRowCol("delete-col") },
                {
                    label: "列幅を自動調整", action: () => {
                        const selectedCols = new Set([colIdx]);
                        tbody.querySelectorAll("td.selected").forEach(td => selectedCols.add(Number(td.dataset.col)));
                        selectedCols.forEach(c => autoFitColumn(c));
                        setDirtyState(true);
                        debouncedSaveState();
                    }
                },
                { label: "---" },
                { label: "昇順で並べ替え", action: () => sortSelectedRange(true) },
                { label: "降順で並べ替え", action: () => sortSelectedRange(false) },
                { label: "---" },
                { label: "列の内容をクリア", action: clearTargetCellsContent }
            ];
        }

        // 3. 通常セル右クリック
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

        return [
            { label: "切り取り (Ctrl+X)", action: () => copySelectedCells(true) },
            { label: "コピー (Ctrl+C)", action: () => copySelectedCells(false) },
            { label: "貼り付け (Ctrl+V)", action: () => void pasteClipboardData(false) },
            { label: "値のみ貼り付け (Ctrl+Shift+V)", action: () => void pasteClipboardData(true) },
            { label: "---" },
            { label: "行を上に挿入", action: () => modifySheetRowCol("insert-row") },
            { label: "行を削除", action: () => modifySheetRowCol("delete-row") },
            { label: "列を左に挿入", action: () => modifySheetRowCol("insert-col") },
            { label: "列を削除", action: () => modifySheetRowCol("delete-col") },
            { label: "---" },
            { label: "昇順で並べ替え", action: () => sortSelectedRange(true) },
            { label: "降順で並べ替え", action: () => sortSelectedRange(false) },
            { label: "---" },
            { label: "セル結合", action: mergeSelectedCells, disabled: !canMerge },
            { label: "結合解除", action: unmergeSelectedCells, disabled: !canUnmerge },
            { label: "内容をクリア (Delete)", action: clearTargetCellsContent }
        ];
    });

    // =========================================================
    // スクロール時の動的行・列追加 ＋ 行/列の可視範囲最適化
    // =========================================================
    let rowObserver = null;
    let visibleCols = [];
    let scrollPending = false;
    let isLoadingRows = false;
    let isLoadingCols = false;

    function computeVisibleColumns() {
        const contRect = container.getBoundingClientRect();
        const headerRow = table.querySelector("thead tr");
        if (!headerRow) return;
        const cells = headerRow.children;
        const rowHeaderWidth = cells[0]?.offsetWidth || 54;
        const effectiveLeft = contRect.left + rowHeaderWidth;
        if (visibleCols.length !== cells.length) visibleCols = new Array(cells.length);
        for (let i = 0; i < cells.length; i++) {
            if (i === 0 || i <= freezeCols) {
                visibleCols[i] = true;
                continue;
            }
            const r = cells[i].getBoundingClientRect();
            visibleCols[i] = !(r.right < effectiveLeft || r.left > contRect.right);
        }
    }

    function isWindowMinimizedOrHidden() {
        if (!win) return false;
        return win.dataset.minimized === "true" || win.style.visibility === "hidden" || win.hidden;
    }

    function hasVisibleMergedSpanInRow(row) {
        const mergedCells = row.querySelectorAll("td.merged[rowspan]");
        if (!mergedCells.length) return false;
        const contRect = container.getBoundingClientRect();
        for (const td of mergedCells) {
            const rect = td.getBoundingClientRect();
            if (rect.bottom >= contRect.top && rect.top <= contRect.bottom) return true;
        }
        return false;
    }

    function applyRowVisibility(row, vis) {
        if (isWindowMinimizedOrHidden()) {
            if (row.style.visibility !== "") row.style.visibility = "";
            const cells = row.children;
            for (let i = 0; i < cells.length; i++) {
                if (cells[i].style.visibility !== "") cells[i].style.visibility = "";
            }
            return;
        }

        const active = document.activeElement;
        const v = vis || row.contains(active) || hasVisibleMergedSpanInRow(row);
        // "visible" を明示すると親の visibility: hidden を貫通するため、表示時は空文字で継承させる
        const rowVis = v ? "" : "hidden";
        if (row.style.visibility !== rowVis) row.style.visibility = rowVis;

        const cells = row.children;
        for (let i = 0; i < cells.length; i++) {
            const cell = cells[i];
            let colVis = visibleCols[i] ?? true;
            if (!colVis && i > 0 && cell.classList.contains("merged")) {
                const colspan = parseInt(cell.getAttribute("colspan") || "1", 10);
                if (colspan > 1) {
                    const maxIdx = Math.min(visibleCols.length - 1, i + colspan - 1);
                    for (let k = i + 1; k <= maxIdx; k++) {
                        if (visibleCols[k]) {
                            colVis = true;
                            break;
                        }
                    }
                }
            }
            const show = (colVis && v) || cell.contains(active);
            const s = show ? "" : "hidden";
            if (cell.style.visibility !== s) cell.style.visibility = s;
        }
    }

    function refreshVisibleRows() {
        if (isWindowMinimizedOrHidden()) return;
        computeVisibleColumns();
        const contRect = container.getBoundingClientRect();
        const active = document.activeElement;
        for (const row of tbody.rows) {
            const rowNum = Number(row.dataset.row);
            const rect = row.getBoundingClientRect();
            const vis = rowNum <= freezeRows || !(rect.bottom < contRect.top || rect.top > contRect.bottom) || row.contains(active);
            row.dataset.visible = String(vis);
            applyRowVisibility(row, vis);
        }
    }

    function setupRowVisibilityObserver() {
        rowObserver?.disconnect();
        rowObserver = new IntersectionObserver(entries => {
            if (isWindowMinimizedOrHidden()) return;
            computeVisibleColumns();
            for (const e of entries) {
                const r = e.target;
                const rowNum = Number(r.dataset.row);
                const v = rowNum <= freezeRows || e.isIntersecting || r.contains(document.activeElement);
                if (r.dataset.visible !== String(v)) {
                    r.dataset.visible = String(v);
                    applyRowVisibility(r, v);
                }
            }
        }, { root: container, threshold: 0 });
        tbody.querySelectorAll("tr").forEach(tr => rowObserver.observe(tr));
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
            for (const row of tbody.rows) {
                row.style.visibility = "";
                for (let i = 0; i < row.children.length; i++) {
                    row.children[i].style.visibility = "";
                }
            }
        } else {
            if (findWin && findWin.isConnected && findDialogOpen) {
                findWin.style.visibility = "visible";
            }
            appRoot.style.display = "flex";
            appRoot.style.visibility = "";
            container.style.overflowY = "auto";
            container.style.overflowX = "hidden";
            requestAnimationFrame(() => {
                refreshVisibleRows();
                syncHorizontalScrollbar();
            });
        }
    }

    let containerResizeObserver = null;
    if (typeof ResizeObserver !== "undefined") {
        containerResizeObserver = new ResizeObserver(() => {
            if (!isWindowMinimizedOrHidden()) {
                refreshVisibleRows();
                syncHorizontalScrollbar();
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

    // 下部横スクロールバーとシート本体の双方向同期
    if (hScrollTrack) {
        hScrollTrack.addEventListener("scroll", () => {
            if (syncingHScroll) return;
            syncingHScroll = true;
            const maxTrack = Math.max(1, hScrollTrack.scrollWidth - hScrollTrack.clientWidth);
            const maxCont = Math.max(0, container.scrollWidth - container.clientWidth);
            container.scrollLeft = Math.round((hScrollTrack.scrollLeft / maxTrack) * maxCont);

            if (!isLoadingCols && hScrollTrack.scrollLeft + hScrollTrack.clientWidth >= hScrollTrack.scrollWidth - 30) {
                isLoadingCols = true;
                loadColumnsSync(COLUMN_BATCH);
                isLoadingCols = false;
            }
            refreshVisibleRows();
            syncingHScroll = false;
        }, { passive: true, signal });
    }

    // シートタブの左右ナビゲーションボタン
    const tabsScrollArea = appRoot.querySelector(".ss-sheet-tabs-scroll");
    appRoot.querySelectorAll(".ss-tab-nav-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            if (!tabsScrollArea) return;
            const dir = btn.dataset.tabScroll === "left" ? -120 : 120;
            tabsScrollArea.scrollBy({ left: dir, behavior: "smooth" });
        }, { signal });
    });

    // シートタブ領域と横スクロール領域のスプリッタードラッグ調整
    const bottomSplitter = appRoot.querySelector(".ss-bottom-splitter");
    const tabsRegion = appRoot.querySelector(".ss-tabs-region");
    if (bottomSplitter && tabsRegion) {
        bottomSplitter.addEventListener("mousedown", (e) => {
            e.preventDefault();
            const barRect = bottomSplitter.parentElement.getBoundingClientRect();
            const onMove = (ev) => {
                const relX = ev.clientX - barRect.left;
                const pct = Math.min(82, Math.max(18, (relX / barRect.width) * 100));
                tabsRegion.style.flexBasis = `${pct}%`;
                syncHorizontalScrollbar();
            };
            const onUp = () => {
                document.removeEventListener("mousemove", onMove);
                document.removeEventListener("mouseup", onUp);
            };
            document.addEventListener("mousemove", onMove, { signal });
            document.addEventListener("mouseup", onUp, { signal });
        }, { signal });
    }

    container.addEventListener("scroll", () => {
        if (!syncingHScroll && hScrollTrack) {
            syncingHScroll = true;
            const maxCont = Math.max(1, container.scrollWidth - container.clientWidth);
            const maxTrack = Math.max(0, hScrollTrack.scrollWidth - hScrollTrack.clientWidth);
            hScrollTrack.scrollLeft = Math.round((container.scrollLeft / maxCont) * maxTrack);
            syncingHScroll = false;
        }
        if (scrollPending || isWindowMinimizedOrHidden()) return;
        scrollPending = true;
        requestAnimationFrame(() => {
            scrollPending = false;
            if (isWindowMinimizedOrHidden()) return;
            if (!isLoadingRows && container.scrollTop + container.clientHeight >= container.scrollHeight - 50) {
                isLoadingRows = true;
                loadRowsSync(ROW_BATCH);
                setupRowVisibilityObserver();
                isLoadingRows = false;
            }
            if (!isLoadingCols && container.scrollLeft + container.clientWidth >= container.scrollWidth - 50) {
                isLoadingCols = true;
                loadColumnsSync(COLUMN_BATCH);
                isLoadingCols = false;
            }
            refreshVisibleRows();
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
        syncHorizontalScrollbar();
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
        const prevLeft = container.scrollLeft;
        container.scrollLeft = Math.max(0, prevLeft + deltaX);
        if (!isLoadingCols && container.scrollLeft + container.clientWidth >= container.scrollWidth - 50) {
            isLoadingCols = true;
            loadColumnsSync(COLUMN_BATCH);
            isLoadingCols = false;
        }
        refreshVisibleRows();
    }

    // トラックパッド2本指横スワイプ（deltaX）および Shift+ホイール横スクロール対応
    appRoot.addEventListener("wheel", (e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setZoom(zoomValue + (e.deltaY < 0 ? 5 : -5));
            return;
        }
        if (e.target.closest(".pulldown_menu, .ss-sheet-tabs-scroll")) return;

        let dx = e.deltaX || 0;
        if (dx === 0 && e.shiftKey && e.deltaY !== 0) {
            dx = e.deltaY;
            e.preventDefault();
        }
        if (dx !== 0) {
            if (Math.abs(dx) > Math.abs(e.deltaY || 0)) {
                e.preventDefault();
            }
            applyHorizontalScrollDelta(dx);
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
        setDirtyState(false);
        saveState();
        await updateStorageUsageDisplay();

        const a1Cell = getVisibleCell(1, 0);
        if (a1Cell) {
            setActiveCell(a1Cell, true);
            updateSelectedCellsDisplay();
            updateFillHandle();
        }
    }

    // =========================================================
    // Windows標準：未保存変更がある場合の閉じる確認
    // =========================================================
    const closeBtn = win?.querySelector(".close-btn, .window-close");
    let bypassCloseConfirm = false;
    if (closeBtn && windowAPI?.showModalWindow) {
        closeBtn.addEventListener("click", (e) => {
            if (!isDirty || bypassCloseConfirm) return;
            e.preventDefault();
            e.stopImmediatePropagation();

            const fileName = currentFilePath ? basename(currentFilePath) : "無題.nxs";
            windowAPI.showModalWindow(
                "Nexser スプレッドシート",
                `${fileName} への変更内容を保存しますか？`,
                {
                    width: 380,
                    parentWin: win,
                    buttons: [
                        {
                            label: "保存する",
                            onClick: async () => {
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
                                isDirty = false;
                                bypassCloseConfirm = true;
                                closeBtn.click();
                            }
                        },
                        { label: "キャンセル" }
                    ]
                }
            );
        }, { capture: true, signal });
    }

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
            if (findWin) {
                if (typeof findWin._closeDialog === "function") findWin._closeDialog();
                else if (findWin.isConnected) findWin.remove();
                findWin = null;
            }
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