// styles.js
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
    font-size: small;
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
    font-size: small;
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
    height: 74px;
    min-height: 74px;
    max-height: 74px;
    display: flex;
    align-items: stretch;
    overflow: visible;
}
.nexser-spreadsheet-app .ss-ribbon-shell.collapsed .ss-ribbon-panels {
    display: none;
}

.nexser-spreadsheet-app .ss-ribbon-panel {
    display: none;
    flex-wrap: nowrap;
    align-items: stretch;
    gap: 1px;
    width: 100%;
    height: 100%;
    transform-origin: left center;
}
.nexser-spreadsheet-app .ss-ribbon-panel.active {
    display: flex;
}

.nexser-spreadsheet-app .ss-ribbon-group {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    flex-shrink: 0;
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
    align-items: stretch;
    flex: 0 0 54px;
    height: 54px;
    gap: 2px;
}

.nexser-spreadsheet-app .ss-ribbon-col {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
}

.nexser-spreadsheet-app .ss-ribbon-row {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: 2px;
}

.nexser-spreadsheet-app .ss-ribbon-vsep {
    width: 1px;
    align-self: stretch;
    background-color: #8c9094;
    box-shadow: 1px 0 0 #e6e8ea;
    margin: 2px 1px;
    flex-shrink: 0;
}

.nexser-spreadsheet-app .ss-ribbon-group-body > .pulldown_menu_parent {
    justify-content: center;
    height: 100%;
}

.nexser-spreadsheet-app .ss-ribbon-group-title {
    font-size: 10px;
    color: #333;
    text-align: center;
    line-height: 12px;
    height: 12px;
    white-space: nowrap;
}

.nexser-spreadsheet-app .ss-ribbon-group-body label {
    margin-right: 0;
    font-size: 11px;
    display: inline-flex;
    align-items: center;
}

/* リボン内の通常ボタン・セレクト */
.nexser-spreadsheet-app .ss-ribbon-panels .button:not(th) {
    padding: 1px 4px;
    min-height: 22px;
    height: 22px;
    font-size: 11px;
}

.nexser-spreadsheet-app .ss-ribbon-panels .pulldown_menu .button:not(th) {
    height: auto;
    min-height: 22px;
}

/* 縦3段積み用のコンパクトボタン（切り取り・コピー・書式コピー等） */
.nexser-spreadsheet-app .ss-ribbon-panels .ss-ribbon-col-stack {
    gap: 1px;
}
.nexser-spreadsheet-app .ss-ribbon-panels .ss-ribbon-col-stack .button:not(th) {
    justify-content: flex-start;
    min-height: 17px;
    height: 17px;
    padding: 0 4px;
    font-size: 10px;
    width: 100%;
}

/* Excel準拠：縦型の大アイコンボタン（2行ラベル対応でスリム化） */
.nexser-spreadsheet-app .ss-ribbon-panels .button.ss-btn-large:not(th) {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-height: 52px;
    height: 52px;
    padding: 2px 4px;
    line-height: 1.05;
    text-align: center;
}

.nexser-spreadsheet-app .ss-btn-large .ss-btn-ico-lg {
    font-size: 15px;
    line-height: 1;
    pointer-events: none;
}

.nexser-spreadsheet-app .ss-btn-large .ss-btn-lbl {
    font-size: 10px;
    line-height: 1.05;
    white-space: nowrap;
    pointer-events: none;
}

/* 配置・フォント装飾用正方形アイコンボタン */
.nexser-spreadsheet-app .ss-ribbon-panels .button.ss-icon-btn:not(th) {
    width: 21px;
    height: 22px;
    min-height: 22px;
    padding: 0;
}

.nexser-spreadsheet-app .ss-ico {
    width: 14px;
    height: 14px;
    display: block;
    pointer-events: none;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
}

.nexser-spreadsheet-app .ss-ribbon-panels select.ss-font-size,
.nexser-spreadsheet-app .ss-ribbon-panels select.ss-font-family {
    height: 22px;
    font-size: 11px;
}

/* 均等割り付け（文字の間隔をセル幅に合わせて均等に揃える） */
.nexser-spreadsheet-app .ss-table td .ss-justify-line {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
}

.nexser-spreadsheet-app .ss-table td .ss-justify-line.ss-justify-single {
    justify-content: center;
}

.nexser-spreadsheet-app .ss-table td .ss-justify-char {
    display: inline-block;
    line-height: inherit;
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
    align-items: flex-start;
    width: 100%;
    padding: 2px 3px;
    background-color: #C3C7CB;
    border-bottom: 1px solid #808080;
    flex-shrink: 0;
    gap: 3px;
}

.nexser-spreadsheet-app .ss-selected-cells-display {
    font-weight: bold;
    width: 100px;
    height: 24px;
    line-height: 20px;
    text-align: center;
    padding: 1px 4px;
    background-color: #fff;
    color: #000;
    font-size: small;
    outline: none;
    flex-shrink: 0;
}
    
.nexser-spreadsheet-app .ss-selected-cells-display:focus {
    outline: 2px solid #107c41;
    outline-offset: -2px;
}

/* オートフィルターボタン＆ポップアップ（文字ノードを持たせず ::before で描画） */
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
.nexser-spreadsheet-app .ss-filter-arrow::before {
    content: "▼";
}

.nexser-spreadsheet-app .ss-filter-arrow.filtered {
    background: #107c41;
    color: #fff;
    border-color: #0b5a2f;
}
.ss-filter-dropdown {
    position: fixed;
    box-sizing: border-box;
    width: 220px;
    background: #C3C7CB;
    color: #000;
    border: 1px solid;
    border-color: #fff #404040 #404040 #fff;
    box-shadow: 2px 2px 6px rgba(0, 0, 0, 0.35);
    padding: 6px;
    font-family: 'MS PGothic', 'MS Gothic', sans-serif;
    font-size: 12px;
    z-index: 2147483647;
    display: flex;
    flex-direction: column;
    gap: 5px;
}
.ss-filter-values-list {
    box-sizing: border-box;
    max-height: 160px;
    overflow-y: auto;
    background: #fff;
    color: #000;
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
    height: 24px;
    min-height: 24px;
    max-height: 24px;
    font-family: 'MS PGothic', 'MS Gothic', monospace;
    font-size: 13px;
    line-height: 18px;
    padding: 2px 6px;
    outline: none;
    background: #fff;
    color: #000;
    resize: none;
    overflow-x: auto;
    overflow-y: hidden;
    white-space: pre;
    word-break: normal;
}

.ss-autocomplete-popup {
    position: fixed;
    box-sizing: border-box;
    min-width: 240px;
    max-width: 380px;
    max-height: 210px;
    overflow-y: auto;
    background: #fff;
    color: #000;
    border: 1px solid #404040;
    box-shadow: 2px 3px 8px rgba(0, 0, 0, 0.3);
    z-index: 2147483647;
    font-family: 'MS PGothic', 'MS Gothic', sans-serif;
    font-size: 12px;
}

.ss-autocomplete-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    cursor: pointer;
    border-bottom: 1px solid #f0f0f0;
}

.ss-autocomplete-item.active,
.ss-autocomplete-item:hover {
    background: #107c41;
    color: #fff;
}

.ss-dv-tooltip {
    position: fixed;
    box-sizing: border-box;
    max-width: 260px;
    background: #ffffe1;
    color: #000;
    border: 1px solid #606060;
    box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.25);
    padding: 5px 8px;
    font-family: 'MS PGothic', 'MS Gothic', sans-serif;
    font-size: 11px;
    z-index: 2147483646;
    pointer-events: none;
}
    
/* ----- スプレッドシート本体（ブラウザ標準の縦・横スクロールバー） ----- */
.nexser-spreadsheet-app .ss-spreadsheet-container {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    width: 100%;
    border-left: 1px solid #808080;
    border-right: 1px solid #808080;
    background-color: #fff;
    overflow-x: scroll;
    overflow-y: auto;
    scrollbar-width: auto;
    position: relative;
    contain: layout paint style;
    will-change: scroll-position;
}

/* 共通CSSのスクロールバー非表示ルールを上書き */
.nexser-spreadsheet-app .ss-spreadsheet-container::-webkit-scrollbar {
    display: block;
    width: 14px;
    height: 14px;
}
.nexser-spreadsheet-app .ss-spreadsheet-container::-webkit-scrollbar-track {
    background: #dfdfdf;
    border: 1px solid #a0a0a0;
}
.nexser-spreadsheet-app .ss-spreadsheet-container::-webkit-scrollbar-thumb {
    background: #c3c7cb;
    border: 1px solid;
    border-color: #fff #404040 #404040 #fff;
}
.nexser-spreadsheet-app .ss-spreadsheet-container::-webkit-scrollbar-corner {
    background: #c3c7cb;
}

.nexser-spreadsheet-app .ss-spreadsheet-content {
    transform-origin: top left;
    display: inline-block;
    width: max-content;
    min-width: max-content;
    position: relative;
}

.nexser-spreadsheet-app .ss-table {
    border-collapse: collapse;
    table-layout: fixed;
    background-color: #fff;
    border: none !important;
}

.nexser-spreadsheet-app .ss-table thead,
.nexser-spreadsheet-app .ss-table tbody,
.nexser-spreadsheet-app .ss-table tr {
    border: none !important;
}

.nexser-spreadsheet-app .ss-table thead tr {
    height: 22px;
}

.nexser-spreadsheet-app .ss-table tbody tr {
    height: 25px;
}

.nexser-spreadsheet-app .ss-table th,
.nexser-spreadsheet-app .ss-table td {
    height: inherit;
    padding: 0 3px;
    text-align: left;
    vertical-align: middle;
    white-space: pre;
    position: relative;
    font-family: 'Yu Gothic', '游ゴシック', 'Meiryo', 'MS PGothic', sans-serif;
    font-size: 11pt;
    line-height: 1.25;
    letter-spacing: normal;
    font-kerning: auto;
    text-rendering: auto;
    -webkit-font-smoothing: antialiased;
    user-select: none;
    -webkit-user-select: none;
}

.nexser-spreadsheet-app .ss-cell-editor {
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
    border: none;
    color: #000;
    background-color: #fff;
    outline: none;
    --ss-sel-t: 0 0 0 0 transparent;
    --ss-sel-b: 0 0 0 0 transparent;
    --ss-sel-l: 0 0 0 0 transparent;
    --ss-sel-r: 0 0 0 0 transparent;
    --ss-frz-r: 0 0 0 0 transparent;
    --ss-frz-b: 0 0 0 0 transparent;
    --ss-gl-r: inset -1px 0 0 #d4d4d4;
    --ss-gl-b: inset 0 -1px 0 #d4d4d4;
    box-shadow:
        var(--ss-sel-t),
        var(--ss-sel-b),
        var(--ss-sel-l),
        var(--ss-sel-r),
        var(--ss-frz-r),
        var(--ss-frz-b),
        var(--ss-gl-r),
        var(--ss-gl-b);
}

/* Excel準拠：塗りつぶし適用セル・明示罫線隣接辺ではグリッド線を非表示 */
.nexser-spreadsheet-app .ss-table td.ss-has-fill {
    --ss-gl-r: 0 0 0 0 transparent;
    --ss-gl-b: 0 0 0 0 transparent;
}
/* 同色塗りつぶし隣接辺の border-collapse 行・列トラックおよびズーム時サブピクセル隙間を完全解消（明示罫線時はインラインが優先） */
.nexser-spreadsheet-app .ss-table td.ss-has-fill.ss-fill-seam-b {
    border-bottom: 1px solid var(--ss-fill-bg);
}
.nexser-spreadsheet-app .ss-table td.ss-has-fill.ss-fill-seam-r {
    border-right: 1px solid var(--ss-fill-bg);
}
.nexser-spreadsheet-app .ss-table td.ss-no-gl-r {
    --ss-gl-r: 0 0 0 0 transparent;
}
.nexser-spreadsheet-app .ss-table td.ss-no-gl-b {
    --ss-gl-b: 0 0 0 0 transparent;
}

.nexser-spreadsheet-app .ss-table td.ss-text-overflow {
    overflow: visible;
}

/* 左・中央・右揃えおよび縦書きのはみ出し描画（tdにz-indexを持たせず子ラッパー側で重なり制御） */
.nexser-spreadsheet-app .ss-table td .ss-overflow-wrap {
    position: relative;
    z-index: 2;
    display: flex;
    width: 100%;
    pointer-events: none;
    clip-path: inset(
        calc(-1 * var(--ov-top, 4px))
        calc(-1 * var(--ov-right, 0px))
        calc(-1 * var(--ov-bottom, 4px))
        calc(-1 * var(--ov-left, 0px))
    );
}

.nexser-spreadsheet-app .ss-table td .ss-overflow-wrap.ss-ov-left {
    justify-content: flex-start;
}
.nexser-spreadsheet-app .ss-table td .ss-overflow-wrap.ss-ov-center {
    justify-content: center;
}
.nexser-spreadsheet-app .ss-table td .ss-overflow-wrap.ss-ov-right {
    justify-content: flex-end;
}
.nexser-spreadsheet-app .ss-table td .ss-overflow-wrap.ss-ov-vertical {
    position: absolute;
    inset: 0;
    width: auto;
    height: auto;
    padding: 2px 4px;
}
.nexser-spreadsheet-app .ss-table td .ss-overflow-wrap.ss-ov-v-top {
    justify-content: flex-start;
}
.nexser-spreadsheet-app .ss-table td .ss-overflow-wrap.ss-ov-v-middle {
    justify-content: center;
}
.nexser-spreadsheet-app .ss-table td .ss-overflow-wrap.ss-ov-v-bottom {
    justify-content: flex-end;
}
.nexser-spreadsheet-app .ss-table td .ss-overflow-wrap.ss-ov-vh-right {
    align-items: flex-start;
}
.nexser-spreadsheet-app .ss-table td .ss-overflow-wrap.ss-ov-vh-center {
    align-items: center;
}
.nexser-spreadsheet-app .ss-table td .ss-overflow-wrap.ss-ov-vh-left {
    align-items: flex-end;
}
.nexser-spreadsheet-app .ss-table td .ss-overflow-text {
    flex: 0 0 auto;
    white-space: pre;
    text-align: inherit;
    line-height: inherit;
}

.nexser-spreadsheet-app .ss-table td.ss-auto-align-right {
    text-align: right;
}

.nexser-spreadsheet-app .ss-table td.ss-auto-align-center {
    text-align: center;
}

/* ユーザー定義表示形式の色タグ（[赤]・[青]等）：インライン文字色や条件付き書式を汚染せず適用 */
.nexser-spreadsheet-app .ss-table td.ss-has-numfmt-color {
    color: var(--ss-numfmt-color);
}

.nexser-spreadsheet-app .ss-table td.ss-hyperlink {
    color: #0563c1;
    text-decoration: underline;
    cursor: pointer;
}

.nexser-spreadsheet-app .ss-table thead th,
.nexser-spreadsheet-app .ss-table tbody th.row_number {
    border: none !important;
    --ss-th-r: inset -1px 0 0 #a8acb0;
    --ss-th-b: inset 0 -1px 0 #a8acb0;
    box-shadow: var(--ss-th-r), var(--ss-th-b);
}

.nexser-spreadsheet-app .ss-table thead th {
    font-weight: normal;
    position: sticky;
    top: 0;
    z-index: 13;
    text-align: center;
    font-size: 11px;
    color: #333;
    background-color: #e6e6e6;
}

.nexser-spreadsheet-app .ss-table thead th.ss-corner {
    left: 0;
    z-index: 17;
    cursor: cell;
    text-align: center;
    padding: 0;
    font-size: 10px;
}

.nexser-spreadsheet-app .ss-table tbody th.row_number {
    font-weight: normal;
    position: sticky;
    left: 0;
    z-index: 13;
    text-align: center;
    padding: 0 3px;
    font-size: 11px;
    color: #333;
    background-color: #e6e6e6;
    cursor: e-resize;
}

.nexser-spreadsheet-app .ss-table thead th.col_number {
    cursor: s-resize;
}

/* Excel準拠：選択中セルに対応する列見出し・行番号ヘッダの強調表示 */
.nexser-spreadsheet-app .ss-table thead th.col_number.header-selected {
    background-color: #d2e7db;
    color: #107c41;
    --ss-th-b: inset 0 -2px 0 0 #107c41;
}
.nexser-spreadsheet-app .ss-table tbody th.row_number.header-selected {
    background-color: #d2e7db;
    color: #107c41;
    --ss-th-r: inset -2px 0 0 0 #107c41;
}
.nexser-spreadsheet-app .ss-table thead th.col_number.header-full-selected,
.nexser-spreadsheet-app .ss-table tbody th.row_number.header-full-selected {
    background-color: #107c41;
    color: #ffffff;
}

/* 選択状態のオーバーレイ（td自体にz-indexを付けずborder-collapse共有罫線との競合を防止） */
.nexser-spreadsheet-app .ss-table td.selected:not(.active-cell)::after {
    content: "";
    position: absolute;
    inset: 0;
    background-color: rgba(128, 128, 128, 0.16);
    pointer-events: none;
    z-index: 1;
}

.nexser-spreadsheet-app .ss-table td.active-cell::after {
    display: none;
}

/* Excel準拠：セルの右外側に独立配置するプルダウンボタン（<td>の子要素にしない） */
.nexser-spreadsheet-app .ss-cell-dropdown-btn {
    position: absolute;
    display: none;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 20px;
    padding: 0;
    margin: 0;
    font-size: 9px;
    line-height: 1;
    background: #e1e4e8;
    border: 1px solid #606060;
    box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);
    color: #000;
    cursor: pointer;
    z-index: 24;
    pointer-events: auto;
    user-select: none;
}
.nexser-spreadsheet-app .ss-cell-dropdown-btn:hover {
    background: #c8d1da;
}
.nexser-spreadsheet-app .ss-cell-dropdown-btn.open {
    background: #b8c4d0;
    border-color: #005a9e;
}

.ss-cell-dropdown-list {
    position: fixed;
    box-sizing: border-box;
    min-width: 130px;
    max-height: 200px;
    overflow-y: auto;
    background: #fff;
    color: #000;
    border: 1px solid #404040;
    box-shadow: 2px 2px 6px rgba(0, 0, 0, 0.3);
    z-index: 2147483647;
    font-family: 'MS PGothic', 'MS Gothic', sans-serif;
    font-size: 12px;
}
.ss-cell-dropdown-item {
    box-sizing: border-box;
    padding: 4px 8px;
    cursor: pointer;
    white-space: nowrap;
    min-height: 22px;
    color: #000;
}
.ss-cell-dropdown-item:hover {
    background: #005a9e;
    color: #fff;
}

/* サブメニュー（条件付き書式階層メニュー用） */
.nexser-spreadsheet-app .ss-submenu-parent {
    position: relative;
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.nexser-spreadsheet-app .ss-submenu-parent > .ss-submenu {
    display: none;
    flex-direction: column;
    position: absolute;
    left: 100%;
    top: -2px;
    min-width: 220px;
    background-color: #C3C7CB;
    border: 1px solid;
    border-color: #fff #404040 #404040 #fff;
    box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.35);
    padding: 2px;
    z-index: 70;
    list-style: none;
}
.nexser-spreadsheet-app .ss-submenu-parent:hover > .ss-submenu {
    display: flex;
}

/* Excel準拠ダイアログ共通タブ＆リスト */
.ss-xl-tabs {
    display: flex;
    border-bottom: 1px solid #808080;
    margin-bottom: 8px;
    gap: 2px;
}
.ss-xl-tab {
    padding: 4px 10px;
    background: #d4d8dc;
    border: 1px solid #808080;
    border-bottom: none;
    cursor: pointer;
    font-size: 12px;
}
.ss-xl-tab.active {
    background: #f0f0f0;
    font-weight: bold;
    position: relative;
    top: 1px;
    border-bottom: 1px solid #f0f0f0;
}
.ss-xl-tabpanel {
    display: none;
    flex-direction: column;
    gap: 8px;
}
.ss-xl-tabpanel.active {
    display: flex;
}

/* オートフォーマット（表の自動書式設定）プレビューギャラリー */
.ss-af-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    max-height: 290px;
    overflow-y: auto;
    padding: 6px;
    background: #ffffff;
    border: 1px solid #808080;
}
.ss-af-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px;
    background: #f8f9fa;
    border: 2px solid #c0c4c8;
    cursor: pointer;
    user-select: none;
}
.ss-af-card:hover {
    border-color: #5b9bd5;
    background: #eef5fc;
}
.ss-af-card.selected {
    border-color: #107c41;
    background: #e6f4ec;
    box-shadow: 0 0 0 1px #107c41 inset;
}
.ss-af-card-title {
    font-size: 11px;
    font-weight: bold;
    color: #222;
}
.ss-af-mini-tbl {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 10px;
    line-height: 1.25;
    background: #fff;
}
.ss-af-mini-tbl td {
    padding: 2px 3px;
    overflow: hidden;
    white-space: nowrap;
}
/* 条件付き書式アイコンを擬似要素で描画し、cell.textContent への混入を完全に防止 */
.nexser-spreadsheet-app .ss-table td[data-cf-icon]::before {
    content: attr(data-cf-icon);
    display: inline-block;
    margin-right: 4px;
    font-size: 11px;
    font-weight: bold;
    line-height: 1;
    color: var(--cf-icon-color, #107c41);
    pointer-events: none;
}

/* 連続選択範囲の外周ボーダー（セル罫線・背景色と独立したオーバーレイ層） */
.nexser-spreadsheet-app .ss-selection-box {
    position: absolute;
    display: none;
    pointer-events: none;
    z-index: 6;
    border: 2px solid #107c41;
    box-sizing: border-box;
}
.nexser-spreadsheet-app .ss-selection-box.is-frozen {
    z-index: 10;
}

/* 非連続（Ctrl複数範囲）選択時のみセル側変数で各島の外周を描画（グリッド線・固定枠線と非競合） */
.nexser-spreadsheet-app .ss-table.ss-sel-multi td.sel-edge-top {
    --ss-sel-t: inset 0 2px 0 0 #107c41;
}
.nexser-spreadsheet-app .ss-table.ss-sel-multi td.sel-edge-bottom {
    --ss-sel-b: inset 0 -2px 0 0 #107c41;
}
.nexser-spreadsheet-app .ss-table.ss-sel-multi td.sel-edge-left {
    --ss-sel-l: inset 2px 0 0 0 #107c41;
}
.nexser-spreadsheet-app .ss-table.ss-sel-multi td.sel-edge-right {
    --ss-sel-r: inset -2px 0 0 0 #107c41;
}

/* セル範囲移動時のドロップ先プレビュー枠（範囲全体を囲む1枚の外周枠） */
.nexser-spreadsheet-app .ss-move-preview-box {
    position: absolute;
    display: none;
    pointer-events: none;
    z-index: 26;
    border: 2.5px solid #107c41;
    background-color: rgba(16, 124, 65, 0.10);
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.75) inset;
    box-sizing: border-box;
}

.nexser-spreadsheet-app .ss-move-preview-box.invalid {
    border: 2.5px dashed #d13438;
    background-color: rgba(209, 52, 56, 0.14);
}

.nexser-spreadsheet-app .ss-cell-editor {
    position: absolute;
    z-index: 25;
    margin: 0;
    padding: 2px 3px;
    border: 2px solid #107c41;
    background: #fff;
    color: #000;
    font-family: 'Yu Gothic', '游ゴシック', 'Meiryo', 'MS PGothic', sans-serif;
    font-size: 11pt;
    line-height: 1.25;
    resize: none;
    outline: none;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
    box-shadow: 1px 2px 6px rgba(0, 0, 0, 0.25);
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
    background-color: #107c41;
    border: 1px solid #fff;
    bottom: 0;
    right: 0;
    cursor: crosshair;
    z-index: 7;
}

.nexser-spreadsheet-app td.fill-selected { background-color: rgba(16, 124, 65, 0.08); }
.nexser-spreadsheet-app td.fill-edge-top { border-top: 2px dashed #107c41 !important; }
.nexser-spreadsheet-app td.fill-edge-bottom { border-bottom: 2px dashed #107c41 !important; }
.nexser-spreadsheet-app td.fill-edge-left { border-left: 2px dashed #107c41 !important; }
.nexser-spreadsheet-app td.fill-edge-right { border-right: 2px dashed #107c41 !important; }

/* Excel準拠 オートフィルオプションボタン ＆ ポップアップメニュー */
.nexser-spreadsheet-app .ss-autofill-opt-btn {
    position: absolute;
    display: none;
    align-items: center;
    justify-content: center;
    gap: 2px;
    height: 22px;
    padding: 0 5px;
    background: #ffffff;
    color: #107c41;
    border: 1px solid #8a8a8a;
    box-shadow: 1px 2px 5px rgba(0, 0, 0, 0.24);
    cursor: pointer;
    z-index: 26;
    user-select: none;
    font-size: 11px;
    line-height: 1;
}
.nexser-spreadsheet-app .ss-autofill-opt-btn:hover,
.nexser-spreadsheet-app .ss-autofill-opt-btn.open {
    background: #e6f4ec;
    border-color: #107c41;
}
.nexser-spreadsheet-app .ss-autofill-opt-btn .ss-afo-icon {
    font-size: 13px;
    font-weight: bold;
}
.nexser-spreadsheet-app .ss-autofill-opt-btn .ss-afo-caret {
    font-size: 8px;
    color: #333;
}

.ss-autofill-opt-menu {
    position: fixed;
    min-width: 176px;
    padding: 3px 0;
    background: #ffffff;
    color: #000000;
    border: 1px solid #707070;
    box-shadow: 2px 3px 8px rgba(0, 0, 0, 0.28);
    font-family: 'Yu Gothic', '游ゴシック', 'MS PGothic', sans-serif;
    font-size: 12px;
    z-index: 2147483647;
    user-select: none;
}
.ss-autofill-opt-menu .ss-afo-item {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 4px 10px;
    cursor: pointer;
    white-space: nowrap;
}
.ss-autofill-opt-menu .ss-afo-item:hover {
    background: #e6f4ec;
    color: #0b5a2f;
}
.ss-autofill-opt-menu .ss-afo-item.active .ss-afo-radio {
    color: #107c41;
    font-weight: bold;
}
.ss-autofill-opt-menu .ss-afo-radio {
    width: 12px;
    text-align: center;
    font-size: 11px;
    color: #666;
}
.ss-autofill-opt-menu .ss-afo-sep {
    height: 1px;
    margin: 3px 6px;
    background: #d0d0d0;
}

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

.nexser-spreadsheet-app .pulldown_menu li.ss-menu-sep {
    height: 1px;
    margin: 3px 2px;
    background-color: #808080;
    border-bottom: 1px solid #fff;
    pointer-events: none;
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

/* ズームスライダー */
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

.nexser-spreadsheet-app .ss-cell-editor::-webkit-scrollbar {
    display: none;
}

/* フローティングテキストボックス・グラフ共通 */
.nexser-spreadsheet-app .floating-textbox {
    position: absolute;
    min-width: 60px;
    min-height: 28px;
    border: 1px solid #555;
    background: rgba(255, 255, 255, 0.96);
    padding: 6px;
    cursor: move;
    z-index: 11;
    box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.25);
    resize: none;
    overflow: visible;
    transform-origin: center center;
    color: #000;
    font-family: 'Yu Gothic', '游ゴシック', 'Meiryo', 'MS PGothic', sans-serif;
    font-size: 11pt;
}

.nexser-spreadsheet-app .floating-textbox.obj-selected,
.nexser-spreadsheet-app .floating-textbox:focus-within {
    outline: 1.5px solid #107c41;
    z-index: 14;
}

.nexser-spreadsheet-app .floating-textbox-delete,
.nexser-spreadsheet-app .floating-chart-settings {
    position: absolute;
    top: 2px;
    width: 18px;
    height: 18px;
    line-height: 16px;
    text-align: center;
    font-size: 11px;
    font-weight: bold;
    background: #c3c7cb;
    color: #000;
    border: 1px solid #555;
    cursor: pointer;
    user-select: none;
    display: none;
    z-index: 30;
}
.nexser-spreadsheet-app .floating-textbox-delete { right: 2px; }
.nexser-spreadsheet-app .floating-chart-settings { right: 22px; }

.nexser-spreadsheet-app .floating-textbox:hover .floating-textbox-delete,
.nexser-spreadsheet-app .floating-textbox.obj-selected .floating-textbox-delete,
.nexser-spreadsheet-app .floating-textbox:hover .floating-chart-settings,
.nexser-spreadsheet-app .floating-textbox.obj-selected .floating-chart-settings {
    display: block;
}

/* 8方向リサイズハンドル & 回転ハンドル */
.nexser-spreadsheet-app .ss-obj-handle {
    position: absolute;
    width: 8px;
    height: 8px;
    background: #fff;
    border: 1.5px solid #107c41;
    z-index: 28;
    display: none;
    user-select: none;
}
.nexser-spreadsheet-app .floating-textbox.obj-selected .ss-obj-handle,
.nexser-spreadsheet-app .floating-textbox:focus-within .ss-obj-handle {
    display: block;
}
.nexser-spreadsheet-app .ss-obj-handle[data-dir="nw"] { top: -5px; left: -5px; cursor: nwse-resize; }
.nexser-spreadsheet-app .ss-obj-handle[data-dir="n"]  { top: -5px; left: calc(50% - 4px); cursor: ns-resize; }
.nexser-spreadsheet-app .ss-obj-handle[data-dir="ne"] { top: -5px; right: -5px; cursor: nesw-resize; }
.nexser-spreadsheet-app .ss-obj-handle[data-dir="e"]  { top: calc(50% - 4px); right: -5px; cursor: ew-resize; }
.nexser-spreadsheet-app .ss-obj-handle[data-dir="se"] { bottom: -5px; right: -5px; cursor: nwse-resize; }
.nexser-spreadsheet-app .ss-obj-handle[data-dir="s"]  { bottom: -5px; left: calc(50% - 4px); cursor: ns-resize; }
.nexser-spreadsheet-app .ss-obj-handle[data-dir="sw"] { bottom: -5px; left: -5px; cursor: nesw-resize; }
.nexser-spreadsheet-app .ss-obj-handle[data-dir="w"]  { top: calc(50% - 4px); left: -5px; cursor: ew-resize; }

.nexser-spreadsheet-app .ss-obj-rotate-line {
    position: absolute;
    top: -22px;
    left: calc(50% - 0.5px);
    width: 1px;
    height: 18px;
    background: #107c41;
    display: none;
    pointer-events: none;
    z-index: 27;
}
.nexser-spreadsheet-app .ss-obj-rotate-handle {
    position: absolute;
    top: -30px;
    left: calc(50% - 6px);
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #fff;
    border: 2px solid #107c41;
    cursor: grab;
    display: none;
    z-index: 29;
    user-select: none;
}
.nexser-spreadsheet-app .ss-obj-rotate-handle:active {
    cursor: grabbing;
    background: #107c41;
}
.nexser-spreadsheet-app .floating-textbox.obj-selected .ss-obj-rotate-line,
.nexser-spreadsheet-app .floating-textbox.obj-selected .ss-obj-rotate-handle,
.nexser-spreadsheet-app .floating-textbox:focus-within .ss-obj-rotate-line,
.nexser-spreadsheet-app .floating-textbox:focus-within .ss-obj-rotate-handle {
    display: block;
}

/* Excel風コピー選択アニメーション（範囲全体を囲む1枚の外周枠＋非連続時の個別フォールバック） */
.nexser-spreadsheet-app .ss-copy-ants-box {
    position: absolute;
    display: none;
    pointer-events: none;
    z-index: 25;
    box-sizing: border-box;
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

.nexser-spreadsheet-app .ss-table tbody th.row_number.ss-frozen-row {
    z-index: 14;
}

.nexser-spreadsheet-app .ss-table thead th.col_number.ss-frozen-col {
    z-index: 15;
}

.nexser-spreadsheet-app .ss-table thead th.ss-corner {
    z-index: 17;
}

.nexser-spreadsheet-app .ss-table td.ss-freeze-edge-bottom {
    --ss-frz-b: inset 0 -2px 0 #404040;
}

.nexser-spreadsheet-app .ss-table td.ss-freeze-edge-right {
    --ss-frz-r: inset -2px 0 0 #404040;
}

.nexser-spreadsheet-app .ss-table th.ss-freeze-edge-bottom {
    --ss-th-b: inset 0 -2px 0 #404040;
}

.nexser-spreadsheet-app .ss-table th.ss-freeze-edge-right {
    --ss-th-r: inset -2px 0 0 #404040;
}

/* スクロール領域外のテキストボックス・グラフ・スライサー非表示 */
.nexser-spreadsheet-app .floating-textbox.ss-obj-offscreen,
.nexser-spreadsheet-app .floating-slicer.ss-obj-offscreen {
    visibility: hidden !important;
    pointer-events: none !important;
}

/* ===== Excel準拠 スライサー ===== */
.nexser-spreadsheet-app .floating-slicer {
    position: absolute;
    display: flex;
    flex-direction: column;
    min-width: 150px;
    min-height: 120px;
    background: #ffffff;
    border: 1px solid var(--sl-border, #8ea9db);
    box-shadow: 2px 3px 8px rgba(0, 0, 0, 0.22);
    z-index: 12;
    user-select: none;
    outline: none;
    overflow: hidden;
    font-family: 'Yu Gothic', '游ゴシック', 'Meiryo', 'MS PGothic', sans-serif;
}
.nexser-spreadsheet-app .floating-slicer.obj-selected,
.nexser-spreadsheet-app .floating-slicer:focus-within {
    outline: 2px solid var(--sl-accent, #1f4e78);
    z-index: 15;
}
.nexser-spreadsheet-app .ss-slicer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    padding: 4px 6px;
    background: #f5f7fa;
    border-bottom: 1px solid var(--sl-border, #8ea9db);
    cursor: move;
    flex-shrink: 0;
}
.nexser-spreadsheet-app .ss-slicer-title {
    font-size: 12px;
    font-weight: bold;
    color: var(--sl-accent, #1f4e78);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.nexser-spreadsheet-app .ss-slicer-ctrls {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
}
.nexser-spreadsheet-app .ss-slicer-ctrl {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    padding: 0;
    font-size: 11px;
    line-height: 1;
    background: transparent;
    color: #333;
    border: 1px solid transparent;
    cursor: pointer;
}
.nexser-spreadsheet-app .ss-slicer-ctrl:hover {
    background: #e2e8f0;
    border-color: #94a3b8;
}
.nexser-spreadsheet-app .ss-slicer-ctrl.active {
    background: var(--sl-active-bg, #4472c4);
    color: var(--sl-active-fg, #ffffff);
    border-color: var(--sl-accent, #1f4e78);
}
.nexser-spreadsheet-app .ss-slicer-ctrl.disabled {
    opacity: 0.35;
    pointer-events: none;
}
.nexser-spreadsheet-app .ss-slicer-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: 5px;
    display: grid;
    grid-auto-rows: 26px;
    gap: 4px;
    align-content: start;
    background: #ffffff;
}
.nexser-spreadsheet-app .ss-slicer-item {
    display: flex;
    align-items: center;
    padding: 0 7px;
    height: 26px;
    font-size: 11px;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
    border: 1px solid var(--sl-border, #8ea9db);
    background: #f3f4f6;
    color: #444;
    border-radius: 2px;
}
.nexser-spreadsheet-app .ss-slicer-item:hover {
    filter: brightness(0.95);
}
.nexser-spreadsheet-app .ss-slicer-item.selected {
    background: var(--sl-active-bg, #4472c4);
    color: var(--sl-active-fg, #ffffff);
    border-color: var(--sl-accent, #1f4e78);
    font-weight: bold;
}
.nexser-spreadsheet-app .ss-slicer-item.no-data {
    opacity: 0.45;
    border-style: dashed;
}
.nexser-spreadsheet-app .ss-slicer-empty {
    font-size: 11px;
    color: #666;
    text-align: center;
    padding: 12px 4px;
}
.nexser-spreadsheet-app .ss-slicer-resizer {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 12px;
    height: 12px;
    cursor: nwse-resize;
    background: linear-gradient(135deg, transparent 50%, var(--sl-border, #8ea9db) 50%);
}
/* セル編集中テキスト選択ミニツールバー（Excel準拠） */
.ss-inline-mini-toolbar {
    position: fixed;
    display: none;
    align-items: center;
    gap: 3px;
    padding: 3px 5px;
    background: #C3C7CB;
    color: #000;
    border: 1px solid;
    border-color: #fff #404040 #404040 #fff;
    box-shadow: 2px 2px 6px rgba(0, 0, 0, 0.35);
    z-index: 2147483647;
    font-family: 'MS PGothic', 'MS Gothic', sans-serif;
    font-size: 12px;
    user-select: none;
}
.ss-inline-mini-toolbar .ss-mt-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 22px;
    height: 22px;
    padding: 0 4px;
    background: #d4d8dc;
    border: 1px solid;
    border-color: #fff #606060 #606060 #fff;
    cursor: pointer;
    font-weight: bold;
    font-size: 12px;
}
.ss-inline-mini-toolbar .ss-mt-btn:hover {
    background: #e4e8ec;
}
.ss-inline-mini-toolbar .ss-mt-sep {
    width: 1px;
    height: 18px;
    background: #808080;
    margin: 0 2px;
}
.ss-inline-mini-toolbar .ss-mt-swatch {
    width: 16px;
    height: 16px;
    border: 1px solid #404040;
    cursor: pointer;
    flex-shrink: 0;
}
.ss-inline-mini-toolbar .ss-mt-color-input {
    width: 22px;
    height: 22px;
    padding: 0;
    border: 1px solid #606060;
    cursor: pointer;
    background: #fff;
}

/* ===== 数式参照オーバーレイ（4辺移動・4隅リサイズ・半透明内部塗り・重複保護） ===== */
.nexser-spreadsheet-app .ss-formula-ref-layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 22;
}

.nexser-spreadsheet-app .ss-fref-box {
    position: absolute;
    box-sizing: border-box;
    pointer-events: none;
    border: 2px solid var(--fref-color, #0070C0);
    background-color: var(--fref-fill, rgba(0, 112, 192, 0.11));
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.55) inset;
}

.nexser-spreadsheet-app .ss-fref-box.is-dragging {
    border-style: dashed;
    background-color: var(--fref-fill-active, rgba(0, 112, 192, 0.20));
    z-index: 48 !important;
}

.nexser-spreadsheet-app .ss-fref-edge {
    position: absolute;
    pointer-events: auto;
    cursor: move;
    background: transparent;
}
.nexser-spreadsheet-app .ss-fref-edge[data-edge="n"] { top: -4px; left: 6px; right: 6px; height: 8px; }
.nexser-spreadsheet-app .ss-fref-edge[data-edge="s"] { bottom: -4px; left: 6px; right: 6px; height: 8px; }
.nexser-spreadsheet-app .ss-fref-edge[data-edge="w"] { left: -4px; top: 6px; bottom: 6px; width: 8px; }
.nexser-spreadsheet-app .ss-fref-edge[data-edge="e"] { right: -4px; top: 6px; bottom: 6px; width: 8px; }

.nexser-spreadsheet-app .ss-fref-handle {
    position: absolute;
    width: 8px;
    height: 8px;
    background-color: var(--fref-color, #0070C0);
    border: 1px solid #ffffff;
    pointer-events: auto;
    z-index: 50;
    box-sizing: border-box;
}
.nexser-spreadsheet-app .ss-fref-handle[data-corner="nw"] { top: -5px; left: -5px; cursor: nwse-resize; }
.nexser-spreadsheet-app .ss-fref-handle[data-corner="ne"] { top: -5px; right: -5px; cursor: nesw-resize; }
.nexser-spreadsheet-app .ss-fref-handle[data-corner="sw"] { bottom: -5px; left: -5px; cursor: nesw-resize; }
.nexser-spreadsheet-app .ss-fref-handle[data-corner="se"] { bottom: -5px; right: -5px; cursor: nwse-resize; }

/* ===== 非表示行・列インジケーター ===== */
.nexser-spreadsheet-app .ss-table th.ss-col-hidden,
.nexser-spreadsheet-app .ss-table td.ss-col-hidden {
    display: none !important;
}
.nexser-spreadsheet-app .ss-table thead th.col_number.ss-has-hidden-next {
    --ss-th-r: inset -3px 0 0 #107c41;
}
.nexser-spreadsheet-app .ss-table tbody th.row_number.ss-has-hidden-next {
    --ss-th-b: inset 0 -3px 0 #107c41;
}

/* ===== メモ・コメント角マーク（条件付き書式アイコンと非競合の独立マーク） ===== */
.nexser-spreadsheet-app .ss-table td > .ss-anno-mark {
    position: absolute;
    top: 0;
    right: 0;
    width: 0;
    height: 0;
    pointer-events: none;
    z-index: 9;
    border-style: solid;
    border-width: 0 7px 7px 0;
    border-color: transparent #d13438 transparent transparent;
}
.nexser-spreadsheet-app .ss-table td > .ss-anno-mark.is-comment {
    border-width: 0 8px 8px 0;
    border-color: transparent #7030a0 transparent transparent;
}

/* ===== セルの書式設定ダイアログ ===== */
.ss-fmt-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
}
.ss-fmt-fieldset {
    border: 1px solid #808080;
    padding: 8px;
    margin: 0;
    background: #f4f4f4;
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.ss-fmt-fieldset legend {
    font-weight: bold;
    font-size: 11px;
    padding: 0 4px;
}
.ss-fmt-border-preview {
    width: 148px;
    height: 84px;
    background: #ffffff;
    border: 1px dashed #b0b0b0;
    margin: 2px auto;
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
}
.ss-fmt-border-preview > div {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    color: #444;
    box-sizing: border-box;
}

/* ===== 文字角度（-90〜90°）実描画 ===== */
.nexser-spreadsheet-app .ss-table td .ss-rotated-text {
    display: inline-block;
    transform-origin: center center;
    white-space: pre;
    line-height: 1.2;
}

/* ===== 表示タブ：枠線・見出し・数式バー表示切替（明示罫線を残してグリッド線のみ非表示） ===== */
.nexser-spreadsheet-app.ss-hide-gridlines .ss-table td {
    --ss-gl-r: 0 0 0 0 transparent;
    --ss-gl-b: 0 0 0 0 transparent;
}
.nexser-spreadsheet-app.ss-hide-headers .ss-table thead,
.nexser-spreadsheet-app.ss-hide-headers .ss-table tbody th.row_number {
    display: none !important;
}
.nexser-spreadsheet-app.ss-hide-formulabar .ss-formula-bar-container {
    display: none !important;
}

/* ===== 数式監査（トレース矢印SVGレイヤー＆数式表示モード） ===== */
.nexser-spreadsheet-app .ss-audit-svg-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: visible;
    z-index: 23;
}
.nexser-spreadsheet-app.ss-show-formulas .ss-table td[data-formula] {
    font-family: Consolas, 'MS Gothic', monospace;
    text-align: left !important;
    background-image: linear-gradient(transparent calc(100% - 2px), rgba(16, 124, 65, 0.45) 2px);
}

@media print {
    html, body {
        height: auto !important;
        overflow: visible !important;
        margin: 0 !important;
        padding: 0 !important;
    }
    body * {
        visibility: hidden !important;
    }
    .nexser-spreadsheet-app,
    .nexser-spreadsheet-app .ss-spreadsheet-container,
    .nexser-spreadsheet-app .ss-spreadsheet-content {
        position: static !important;
        overflow: visible !important;
        height: auto !important;
        max-height: none !important;
        contain: none !important;
        border: none !important;
    }
    .nexser-spreadsheet-app .ss-ribbon-shell,
    .nexser-spreadsheet-app .ss-formula-bar-container,
    .nexser-spreadsheet-app .ss-bottom-bar {
        display: none !important;
    }
    .nexser-spreadsheet-app .ss-spreadsheet-content,
    .nexser-spreadsheet-app .ss-spreadsheet-content * {
        visibility: visible !important;
    }
    .nexser-spreadsheet-app .ss-spreadsheet-content {
        background: #fff !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
    .nexser-spreadsheet-app .ss-table tr {
        break-inside: avoid;
        page-break-inside: avoid;
    }
    .nexser-spreadsheet-app .row_number,
    .nexser-spreadsheet-app .ss-table thead,
    .nexser-spreadsheet-app .fill-handle,
    .nexser-spreadsheet-app .ss-autofill-opt-btn,
    .nexser-spreadsheet-app .ss-selection-box,
    .nexser-spreadsheet-app .ss-cell-dropdown-btn,
    .nexser-spreadsheet-app .ss-formula-ref-layer,
    .nexser-spreadsheet-app .floating-textbox-delete,
    .nexser-spreadsheet-app .ss-slicer-ctrls,
    .nexser-spreadsheet-app .ss-slicer-resizer {
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

export function injectScopedStyles() {
    let style = document.getElementById(STYLE_ELEMENT_ID);
    if (!style) {
        style = document.createElement("style");
        style.id = STYLE_ELEMENT_ID;
        document.head.appendChild(style);
    }
    style.textContent = SCOPED_CSS;
}