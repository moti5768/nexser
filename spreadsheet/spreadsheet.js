let supportsPassive = false;
try {
    const opts = { passive: false, get passive() { supportsPassive = true; return false; } };
    window.addEventListener("testPassive", null, opts);
    window.removeEventListener("testPassive", null, opts);
} catch (e) { }

document.addEventListener('wheel', function (e) {
    if (e.ctrlKey) {
        e.preventDefault();
    }
}, { passive: false });
document.addEventListener('touchmove', function (e) {
    if (e.touches.length > 1) {
        e.preventDefault();
    }
}, { passive: false });

let currentPressedButton = null;

// ボタン上でマウスダウンがあった場合
document.addEventListener("mousedown", (e) => {
    const btn = e.target.closest(".button");
    if (btn) {
        btn.classList.add("pressed");
        currentPressedButton = btn; // 現在操作中のボタンを記録
    }
});

// ボタン上または画面上のどこかでマウスアップがあった場合
document.addEventListener("mouseup", () => {
    if (currentPressedButton) {
        currentPressedButton.classList.remove("pressed");
        currentPressedButton = null;
    }
});

// カーソル移動でボタン上かどうかをチェック
document.addEventListener("mousemove", (e) => {
    if (currentPressedButton) {
        const rect = currentPressedButton.getBoundingClientRect();
        // カーソルがボタン領域外にあるかチェック
        if (e.clientX < rect.left || e.clientX > rect.right ||
            e.clientY < rect.top || e.clientY > rect.bottom) {
            // たとえマウスは押されていても、カーソルが外れたら pressed を除去
            currentPressedButton.classList.remove("pressed");
        } else {
            // カーソルがボタン内に戻り、なおかつマウスボタンが押されている場合は pressed を復元
            if (e.buttons) {
                currentPressedButton.classList.add("pressed");
            }
        }
    }
});

function printPage() {
    window.print();
}
// 動的に@pageルールのサイズを変更する関数
function changePageSize(sizeValue) {
    let styleTag = document.getElementById("dynamicPageStyle");
    if (!styleTag) {
        styleTag = document.createElement("style");
        styleTag.id = "dynamicPageStyle";
        document.head.appendChild(styleTag);
    }
    // sizeValue は "A4", "A3", "B5", "B4" などを指定可能
    styleTag.textContent = '@page { size: ' + sizeValue + '; margin: 1cm; }';
    // ユーザーに選択中のサイズを分かりやすく表示する例
    document.getElementById("selectedSize").textContent = sizeValue;
}

// =======================
// Block 1: 設定関連
// =======================
const INITIAL_ROWS = 80;
const ROW_BATCH = 10;
const INITIAL_COLUMNS = 80;  // 初期列数
const COLUMN_BATCH = 10;

const container = document.getElementById("spreadsheet-container");
const spreadsheetContent = document.getElementById("spreadsheet-content");
const table = document.getElementById("spreadsheet");
const theadRow = table.querySelector("thead tr");
const tbody = table.querySelector("tbody");
const formulaBarInput = document.getElementById("formula-bar");
const loadingstate = document.getElementById("loadingstate");

let currentColumns = 0; // 現在の列数 (0-index)
let rowCount = 1;       // 次に生成する行番号 (1-index)
let activeCell = null;  // 現在選択中（または編集中）のセル
// =======================
// Block 2: 範囲選択用の変数
// =======================
let isSelecting = false;
let selectionStart = null;
let selectionEnd = null;
// =======================
// Block 3: ヘルパー関数群
// =======================

// 3-1. 0-index の列番号を Excel 風のアルファベット (A, B, …) に変換
function getColumnName(index) {
    let dividend = index + 1;
    let columnName = '';
    while (dividend > 0) {
        let modulo = (dividend - 1) % 26;
        columnName = String.fromCharCode(65 + modulo) + columnName;
        dividend = Math.floor((dividend - modulo) / 26);
    }
    return columnName;
}

// 3-2. 指定セルから「A1」形式の参照文字列を返す
function getCellReference(cell) {
    if (!cell || !cell.dataset) return "";
    const row = cell.dataset.row;
    const col = parseInt(cell.dataset.col, 10);
    return getColumnName(col) + row;
}

// 3-3. 座標 (row, col) からセル参照を返す（rowは1-index, colは0-index）
function getCellReferenceByCoord(row, col) {
    return getColumnName(col) + row;
}

// 3-4. 現在、数式編集中かどうかを判定
function isInFormulaEdit() {
    if (document.activeElement === formulaBarInput && formulaBarInput.value.trim().startsWith("="))
        return true;
    if (activeCell && activeCell.isContentEditable && activeCell.textContent.trim().startsWith("="))
        return true;
    return false;
}

// 3-5. 現在編集中のフィールドにセル参照文字列を「カーソル位置を保持して」挿入
function insertCellReference(ref) {
    if (!ref) return;
    const input = formulaBarInput;
    if (document.activeElement === input) {
        // 現在のカーソル位置
        const start = input.selectionStart;
        const end = input.selectionEnd;
        // カーソル位置に挿入
        input.value = input.value.slice(0, start) + ref + input.value.slice(end);
        // 挿入後カーソルを ref の末尾に移動
        const newPos = start + ref.length;
        input.setSelectionRange(newPos, newPos);
        input.focus();
    } else if (activeCell && activeCell.isContentEditable) {
        document.execCommand('insertText', false, ref);
    } else if (activeCell) {
        activeCell.textContent += ref;
    }
}

// =======================
// Block 4: 行／列生成 および セル作成
// =======================

function initializeColumns(count) {
    loadColumns(count);
}

// ------------------------------------------------------
// 最適化版 loadColumns 関数
// ・新規のヘッダーセル（<th>）を生成して一括追加
// ・既存の tbody 内各行に対し、新規列分のセル（<td>）を一括追加
// ------------------------------------------------------
const COLUMN_BATCH_SIZE = 30, ROW_BATCH_SIZE = 30;
function loadColumns(count, batchSize = COLUMN_BATCH_SIZE, callback) {
    let s = currentColumns, e = s + count;
    (function batchAdd(start) {
        let end = Math.min(start + batchSize, e);
        const headerFrag = document.createDocumentFragment();
        for (let c = start; c < end; c++) {
            const th = document.createElement('th');
            th.className = "col_number button";
            th.textContent = getColumnName(c);
            headerFrag.appendChild(th);
        }
        theadRow.appendChild(headerFrag);
        for (const row of tbody.rows) {
            const r = row.cells[0].textContent, frag = document.createDocumentFragment();
            for (let c = start; c < end; c++) {
                const td = document.createElement('td');
                td.contentEditable = "false";
                td.dataset.row = r;
                td.dataset.col = c;
                frag.appendChild(td);
            }
            row.appendChild(frag);
        }
        currentColumns = end;
        if (end < e) setTimeout(() => batchAdd(end), 0);
        else if (callback) callback();
    })(s);
}
// ------------------------------------------------------
// 最適化版 loadRows 関数
// ・新規の行（<tr>）を、行番号セル <th> と各 <td> を HTML 文字列で組み立て、一括で tbody に挿入
// ------------------------------------------------------
function loadRows(count, batchSize = ROW_BATCH_SIZE, callback) {
    let added = 0;
    (function batchAdd() {
        const batch = Math.min(batchSize, count - added);
        if (!batch) return callback && callback();
        const frag = document.createDocumentFragment();
        for (let i = 0; i < batch; i++, rowCount++) {
            const tr = document.createElement('tr');
            const th = document.createElement('th');
            th.className = "row_number button";
            th.textContent = rowCount;
            tr.appendChild(th);
            for (let c = 0; c < currentColumns; c++) {
                const td = document.createElement('td');
                td.contentEditable = "false";
                td.dataset.row = rowCount;
                td.dataset.col = c;
                tr.appendChild(td);
            }
            frag.appendChild(tr);
        }
        tbody.appendChild(frag);
        added += batch;
        if (added < count) setTimeout(batchAdd, 0);
        else if (callback) callback();
    })();
}
// ------------------------------------------------------
// 最適化されたセル生成用関数：HTML文字列を出力
// 各セルに対して contentEditable="false" と、 
// data 属性で行番号（row）と列番号（col）を指定
// ------------------------------------------------------
const createCellHTML = (r, c) => `<td contenteditable="false" data-row="${r}" data-col="${c}"></td>`;

// 以下、イベントデリゲーションを用いた処理例
// ここではテーブル全体に対してイベントを一括で設定します
const spreadsheetElem = document.getElementById("spreadsheet");

// クリックイベントのデリゲーション
spreadsheetElem.addEventListener("click", function (e) {
    // もしクリック対象の上位に<td>があれば取得する
    const cell = e.target.closest("td");
    if (cell && spreadsheetElem.contains(cell)) {
        handleCellClick(e);
    }
});

// ダブルクリックイベントのデリゲーション
spreadsheetElem.addEventListener("dblclick", function (e) {
    const cell = e.target.closest("td");
    if (cell && spreadsheetElem.contains(cell)) {
        handleCellDblClick(e);
        updateFillHandle();
    }
});

// マウスダウンイベントのデリゲーション
spreadsheetElem.addEventListener("mousedown", function (e) {
    const cell = e.target.closest("td");
    if (cell && spreadsheetElem.contains(cell)) {
        handleCellMouseDown(e);
    }
});

// キーダウンイベントのデリゲーション
spreadsheetElem.addEventListener("keydown", function (e) {
    // キーボードイベントはフォーカスが当たっている要素でしか発生しないので、ここでは
    // 適切にフォーカスが移るようにしておく必要があります
    const cell = e.target.closest("td");
    if (cell && spreadsheetElem.contains(cell)) {
        handleCellKeyDown(e);
    }
});

// 「blur」はバブルしないため、代わりに focusout イベントを使う
spreadsheetElem.addEventListener("focusout", function (e) {
    const cell = e.target.closest("td");
    if (cell && spreadsheetElem.contains(cell)) {
        handleCellBlur(e);
    }
});

// =======================
// Block 5: セル編集／イベント処理
// =======================

let caretTimer = null;  // グローバル変数として、タイマーIDを保持

function revertSelectedCellsText() {
    const selectedCells = document.querySelectorAll("td.selected");
    let formulaForBar = "";
    selectedCells.forEach(cell => {
        // 保存済みのデータがある場合に復元する
        if (cell.dataset.originalText) {
            // もし元の数式も保存しているなら、そちらを復元する
            if (cell.dataset.originalFormula) {
                cell.dataset.formula = cell.dataset.originalFormula;
                cell.innerHTML = cell.dataset.originalFormula;
                formulaForBar = cell.dataset.originalFormula;
            } else {
                cell.innerHTML = cell.dataset.originalText;
                // 数式属性があれば解除。もしくはそのままでもよい
                delete cell.dataset.formula;
                formulaForBar = cell.textContent.trim();
            }
        }
    });
    // 数式バーの更新
    if (formulaForBar) {
        formulaBarInput.value = formulaForBar;
    }
    clearCalculationRangeHighlights();
    updateAllFormulas();
}

function handleCellDblClick(e, skipFocus = false) {
    const cell = e.target;
    cell.contentEditable = "true";
    // ダブルクリックで編集モードに入ったことを示すフラグをセットする
    cell.dataset.editBy = "dblclick";
    // もともとの内容を保存
    cell.dataset.originalText = cell.innerHTML;
    // 数式が設定されている場合は、完全な数式（例："=SUM(N4:N16)"）も保存しておく
    if (cell.dataset.formula) {
        cell.dataset.originalFormula = cell.dataset.formula;
        // 編集時はセル内に数式を表示する（または必要なら値に置き換える）
        cell.textContent = cell.dataset.formula;
        highlightCalculationRange(cell.dataset.formula);
    }
    if (!skipFocus) {
        cell.focus();
        setTimeout(() => {
            setCaretToEnd(cell);
        }, 0);
    }
    activeCell = cell;
    formulaBarInput.value = cell.dataset.formula ? cell.dataset.formula : cell.textContent;
}

function handleCellBlur(e) {
    const cell = e.target;
    // textContent で取得すれば、挿入された "\n" がそのまま残ります
    const newText = cell.textContent.trim();
    if (newText.startsWith("=")) {
        // 数式の場合は数式情報を保持し、評価結果をセット
        cell.dataset.formula = newText;
        cell.textContent = evaluateFormula(newText);
    } else {
        // 日付形式（例："1/2" や "1/2/2020"）の場合の自動変換
        if (isDateFormat(newText)) {
            const parts = newText.split("/");
            let date;
            if (parts.length === 2) {
                const currentYear = new Date().getFullYear();
                date = new Date(currentYear, parseInt(parts[0], 10) - 1, parseInt(parts[1], 10));
            } else if (parts.length === 3) {
                date = new Date(parseInt(parts[2], 10), parseInt(parts[0], 10) - 1, parseInt(parts[1], 10));
            }
            if (date && !isNaN(date.getTime())) {
                cell.dataset.valueType = "date";
                cell.dataset.dateValue = date.getTime();  // タイムスタンプを保存
                cell.textContent = formatDate(date);        // formatDate はテキストを返すものとします
            } else {
                cell.textContent = newText;
            }
        } else {
            // 数式でも日付形式でもない場合は、既存の数式情報を削除しそのまま表示
            if (cell.dataset.formula) {
                delete cell.dataset.formula;
            }
            cell.textContent = newText;
        }
        updateAllFormulas();
    }
    // 編集モード解除
    cell.contentEditable = "false";
    delete cell.dataset.editBy;
    clearCalculationRangeHighlights();
    updateAllFormulas();
}

function handleF2Key(e) {
    let targetCell = activeCell;
    if (!targetCell) {
        const selectedCells = document.querySelectorAll("#spreadsheet tbody td.selected");
        if (selectedCells.length > 0) {
            targetCell = selectedCells[0];
        }
    }
    if (targetCell) {
        // F2 でも、ダブルクリックと同様の処理を実行し、フラグを設定する
        targetCell.dataset.editBy = "F2";
        handleCellDblClick({ target: targetCell });
    }
    e.preventDefault();
}

// === 日本語入力中制御用 ===
let isComposing = false;
document.addEventListener("compositionstart", () => isComposing = true);
document.addEventListener("compositionend", () => isComposing = false);

function handleCellKeyDown(e) {
    // ←追加: 日本語変換中はEnterを無視しない
    if (isComposing) return;

    if (e.key === "Enter" && e.target.isContentEditable) {
        if (e.altKey) {
            e.preventDefault();
            document.execCommand('insertText', false, "\n");
            return;
        }
        e.preventDefault();
        const row = parseInt(e.target.dataset.row, 10);
        const col = parseInt(e.target.dataset.col, 10);
        e.target.blur();
        setTimeout(() => {
            navigateToCell(row + 1, col, e);
        }, 0);
    }
}

// ※ 自身のセル（数式セルの場合）をクリックした場合は、セル参照挿入せずにデフォルト動作（caret操作）を許容する
function handleCellClick(e) {
    if (activeCell && activeCell === e.target) {
        return; // 同じセルなら何もせず、通常の caret 操作を許す
    }
    if (activeCell && activeCell !== e.target && activeCell.isContentEditable) {
        const currentText = activeCell.textContent.trim();
        if (!currentText.startsWith("=")) {
            activeCell.blur();
        }
    }
    if (isInFormulaEdit()) {
        const ref = getCellReference(e.target);
        // 自セルクリックした場合は挿入しない
        if (!(activeCell && activeCell === e.target)) {
            insertCellReference(ref);
        }
    } else {
        activeCell = e.target;
        formulaBarInput.value = activeCell.dataset.formula ? activeCell.dataset.formula : activeCell.textContent;
    }
}

function navigateToCell(row, col, event) {
    if (col < 0) return;
    // 列が足りなければ列を追加
    if (col >= currentColumns) {
        loadColumns(col - currentColumns + 1);
    }
    // 行が足りなければ行を追加
    if (row >= rowCount) {
        loadRows(row - rowCount + 1);
    }
    const targetCell = getCell(row, col);
    if (targetCell) {
        event.preventDefault();
        // すべてのセルから selected クラスを除去
        const allCells = document.querySelectorAll("#spreadsheet tbody td");
        allCells.forEach(cell => cell.classList.remove("selected"));
        // 移動先のセルをフォーカスし、selected クラスを追加
        targetCell.focus();
        activeCell = targetCell;
        activeCell.classList.add("selected");
        // 数式バーも更新
        formulaBarInput.value = activeCell.dataset.formula ? activeCell.dataset.formula : activeCell.textContent;
    }
}

/**
 * 指定された行番号と列番号に対応するセル (td 要素) を取得する
 * ※ tbody 内の各行では、cells[0] が行番号セルなので、実データは cells[col+1]
 * @param {number} row - 1始まりの行番号
 * @param {number} col - 0始まりの列番号
 * @returns {HTMLElement|null} 対象セルが存在すればその要素、なければ null
 */
function getCell(row, col) {
    if (col >= currentColumns) loadColumns(col - currentColumns + 1);
    if (row > rowCount) loadRows(row - rowCount);
    const r = row - 1;
    if (r < 0 || r >= tbody.rows.length) return null;
    const cells = tbody.rows[r].cells;
    if (col < 0 || col + 1 >= cells.length) return null; // cells[col+1] の存在チェック
    return cells[col + 1];
}

// =======================
// Block 6: 数式評価および自動再計算
// =======================

/*********************
* 数式で利用できるグローバル関数群（ほぼExcel互換版）
*********************/

// -----------------------
// ヘルパー関数
// -----------------------
function flattenArray(arr) {
    return arr.reduce((acc, val) => acc.concat(Array.isArray(val) ? flattenArray(val) : val), []);
}

// -----------------------
// 数値系関数
// -----------------------
function SUM() {
    const flat = flattenArray(Array.from(arguments));
    return flat.map(Number).filter(v => !isNaN(v)).reduce((a, b) => a + b, 0);
}

function AVERAGE() {
    const flat = flattenArray(Array.from(arguments));
    const nums = flat.map(Number).filter(v => !isNaN(v));
    if (nums.length === 0) return "#DIV/0!";
    return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function MIN() {
    const flat = flattenArray(Array.from(arguments)).map(Number).filter(v => !isNaN(v));
    return Math.min(...flat);
}

function MAX() {
    const flat = flattenArray(Array.from(arguments)).map(Number).filter(v => !isNaN(v));
    return Math.max(...flat);
}

function COUNT() {
    const flat = flattenArray(Array.from(arguments));
    return flat.filter(x => !isNaN(Number(x))).length;
}

function PRODUCT() {
    const flat = flattenArray(Array.from(arguments));
    return flat.reduce((acc, v) => acc * Number(v), 1);
}

function ADD(a, b) { return Number(a) + Number(b); }
function SUBTRACT(a, b) { return Number(a) - Number(b); }
function DIVIDE(a, b) { return Number(b) !== 0 ? Number(a) / Number(b) : "#DIV/0!"; }
function POWER(a, b) { return Math.pow(Number(a), Number(b)); }
function SQRT(a) { return Math.sqrt(Number(a)); }
function MOD(a, b) { return Number(a) % Number(b); }

// -----------------------
// 条件付き集計系
// -----------------------
function SUMIF(range, condition) {
    const arr = flattenArray(range);
    const condFunc = new Function("v", "return v " + condition);
    return arr.filter(v => condFunc(v)).reduce((a, b) => a + Number(b || 0), 0);
}

function AVERAGEIF(range, condition) {
    const arr = flattenArray(range);
    const condFunc = new Function("v", "return v " + condition);
    const filtered = arr.filter(v => condFunc(v));
    if (filtered.length === 0) return "#DIV/0!";
    return filtered.reduce((a, b) => a + Number(b || 0), 0) / filtered.length;
}

function COUNTIF(range, condition) {
    const arr = flattenArray(range);
    const condFunc = new Function("v", "return v " + condition);
    return arr.filter(v => condFunc(v)).length;
}

// -----------------------
// 文字列系
// -----------------------
function CONCAT() { return Array.from(arguments).join(""); }
function UPPER(text) { return String(text).toUpperCase(); }
function LOWER(text) { return String(text).toLowerCase(); }
function LEFT(text, count) { return String(text).substring(0, Number(count)); }
function RIGHT(text, count) { return String(text).slice(-Number(count)); }
function MID(text, start, count) { return String(text).substr(Number(start) - 1, Number(count)); }
function TRIM(text) { return String(text).trim(); }
function LEN(text) { return String(text).length; }
function FIND(findText, withinText) { return String(withinText).indexOf(String(findText)) + 1; }
function REPLACE(text, start, count, newText) {
    const before = String(text).substring(0, Number(start) - 1);
    const after = String(text).substring(Number(start) - 1 + Number(count));
    return before + newText + after;
}

// -----------------------
// 論理系
// -----------------------
function IF(condition, trueValue, falseValue) {
    if (typeof condition === "string") {
        condition = condition.trim().toUpperCase() === "TRUE";
    }
    return condition ? trueValue : falseValue;
}
function AND() {
    return Array.from(arguments).every(v => Boolean(v));
}
function OR() {
    return Array.from(arguments).some(v => Boolean(v));
}
function NOT(value) {
    return !Boolean(value);
}

// -----------------------
// 参照系（配列対応）
// -----------------------
function INDEX(array, row, col = 0) {
    if (!Array.isArray(array)) return array;
    const r = row - 1;
    if (Array.isArray(array[0])) {
        const c = col - 1;
        return (array[r] && array[r][c] != null) ? array[r][c] : 0;
    }
    return array[r] != null ? array[r] : 0;
}

function MATCH(lookupValue, array, matchType = 0) {
    const flat = flattenArray(array);
    if (matchType === 0) { // 完全一致
        return flat.findIndex(v => v == lookupValue) + 1 || "#N/A";
    } else if (matchType === 1) { // 小さい方で最大
        let idx = -1;
        flat.forEach((v, i) => { if (v <= lookupValue) idx = i; });
        return idx + 1 || "#N/A";
    } else if (matchType === -1) { // 大きい方で最小
        let idx = -1;
        flat.forEach((v, i) => { if (v >= lookupValue && idx === -1) idx = i; });
        return idx + 1 || "#N/A";
    }
}

function VLOOKUP(lookupValue, tableArray, colIndex, rangeLookup = true) {
    for (let row of tableArray) {
        if (!Array.isArray(row)) continue;
        if (rangeLookup) {
            if (row[0] <= lookupValue) return row[colIndex - 1] != null ? row[colIndex - 1] : "#N/A";
        } else {
            if (row[0] == lookupValue) return row[colIndex - 1] != null ? row[colIndex - 1] : "#N/A";
        }
    }
    return "#N/A";
}

// -----------------------
// 日付系
// -----------------------
function DATE(year, month, day) { return new Date(year, month - 1, day); }
function TODAY() { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), now.getDate()); }
function NOW() { return new Date(); }
function YEAR(dateInput) { return new Date(dateInput).getFullYear(); }
function MONTH(dateInput) { return new Date(dateInput).getMonth() + 1; }
function DAY(dateInput) { return new Date(dateInput).getDate(); }
function HOUR(dateInput) { return new Date(dateInput).getHours(); }
function MINUTE(dateInput) { return new Date(dateInput).getMinutes(); }
function SECOND(dateInput) { return new Date(dateInput).getSeconds(); }
function WEEKDAY(dateInput) { return new Date(dateInput).getDay() + 1; }
function EDATE(dateInput, months) { const date = new Date(dateInput); date.setMonth(date.getMonth() + Number(months)); return date; }
function DATEDIF(startDate, endDate, unit) {
    const d1 = new Date(startDate); const d2 = new Date(endDate); const diff = d2.getTime() - d1.getTime();
    switch (String(unit).toLowerCase()) {
        case "d": case "day": return diff / (1000 * 60 * 60 * 24);
        case "m": case "month": return diff / (1000 * 60 * 60 * 24 * 30.436875);
        case "y": case "year": return diff / (1000 * 60 * 60 * 24 * 365.2425);
        default: return diff;
    }
}
function TIME(hour, minute, second) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, second);
}
function TIMEVALUE(timeStr) {
    const parts = timeStr.split(":");
    if (parts.length === 2 || parts.length === 3) {
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const s = parts.length === 3 ? parseInt(parts[2], 10) : 0;
        return (h * 3600 + m * 60 + s) / 86400;
    }
    return "#VALUE!";
}
function DATEVALUE(dateString) {
    const parts = dateString.split("/");
    if (parts.length === 2) {
        const now = new Date();
        return new Date(now.getFullYear(), parseInt(parts[0], 10) - 1, parseInt(parts[1], 10)).getTime();
    } else if (parts.length === 3) {
        return new Date(parseInt(parts[2], 10), parseInt(parts[0], 10) - 1, parseInt(parts[1], 10)).getTime();
    }
    return "#VALUE!";
}
function isDateFormat(str) { return /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(str); }
function formatDate(date) { const y = date.getFullYear(), m = (date.getMonth() + 1).toString().padStart(2, '0'), d = date.getDate().toString().padStart(2, '0'); return `${y}/${m}/${d}`; }


/*********************
 * 数式の評価エンジン
 *********************/

// ───── 数式評価関数 ─────
// セル内のテキストが数式の場合は再評価して数値リテラルとして返すヘルパー関数
function getCellEvaluatedValue(cell, visited = new Set()) {
    const content = cell.textContent.trim();
    if (content.charAt(0) === "=") {
        const evaluated = evaluateFormula(content, visited);
        const num = Number(evaluated);
        return isNaN(num) ? evaluated : num;
    } else {
        return parseFloat(content);
    }
}

// ────────── 前処理関数 ──────────
// IF 関数の条件部（第1引数）の中の単独の "=" を "==" に変換する
function preprocessIFFormula(expr) {
    // expr は先頭の "=" を除いた後の文字列、例: "IF(A1 = B1, '〇', '')"
    // ここでは IF( の直後から最初のカンマまでを条件部とみなす
    let pos = 3; // "IF(" の後ろから開始
    let parenCount = 0;
    let inQuote = false;
    let conditionPart = "";
    for (; pos < expr.length; pos++) {
        let ch = expr[pos];
        if (ch === '"') {
            inQuote = !inQuote;
        } else if (!inQuote) {
            if (ch === '(') {
                parenCount++;
            } else if (ch === ')') {
                if (parenCount > 0) {
                    parenCount--;
                }
            } else if (ch === ',' && parenCount === 0) {
                break; // 条件部の終わり
            }
        }
        conditionPart += ch;
    }
    let newCondition = conditionPart.replace(/(?<![<>=!])=(?![="=])/g, "==");
    // 結果の式を再構築: "IF(" + 修正済みの条件 + その後の部分
    let newExpr = "IF(" + newCondition + expr.substring(pos);
    return newExpr;
}

/**
 * 数式（文字列）が "=" から始まっている場合の評価関数
 * ・範囲参照 (例: "A1:B3") → 範囲内セルの数値の合計に置換
 * ・単一セル参照 (例: "A10") → そのセルの内容（数値）があれば置換、なければ 0
 * ・評価には eval を利用（グローバルに定義された関数が呼ばれる）
 */
// ---------------------------------------------
// 1. 正規表現のプリコンパイル
// ---------------------------------------------
const RANGE_REF_REGEX = /([A-Z]+\d+:[A-Z]+\d+)/g; // 例："A1:B2"
const SINGLE_REF_REGEX = /([A-Z]+)(\d+)/g;         // 例："A1", "B10", etc.

// ---------------------------------------------
// 2. 列変換のキャッシュ用 Map
// ---------------------------------------------
const colCache = new Map();
function columnLettersToIndex(letters) {
    // すでにキャッシュされているなら即返す
    if (colCache.has(letters)) {
        return colCache.get(letters);
    }
    let index = 0;
    for (let i = 0; i < letters.length; i++) {
        index = index * 26 + (letters.charCodeAt(i) - 64);
    }
    // 0始まりにする
    let result = index - 1;
    colCache.set(letters, result);
    return result;
}

// ---------------------------------------------
// 3. 数式評価関数
// ---------------------------------------------
function evaluateFormula(formula, visited = new Set()) {
    if (!formula) return formula;
    if (formula === "=") return "=";
    if (formula[0] !== "=") return formula;

    let expr = formula.substring(1).trim();
    if (!expr) return "=";

    // 循環参照チェック (セル単位で管理)
    const cellKey = formula;
    if (visited.has(cellKey)) return "#CIRCULAR!";
    visited.add(cellKey);

    try {
        if (/^IF\(/i.test(expr)) {
            expr = preprocessIFFormula(expr);
        }

        // 範囲参照置換 → 配列に変換
        expr = expr.replace(RANGE_REF_REGEX, match => {
            const [startRef, endRef] = match.split(":");
            if (!startRef || !endRef) return "[]";

            const startMatch = startRef.match(/([A-Z]+)(\d+)/);
            const endMatch = endRef.match(/([A-Z]+)(\d+)/);
            if (!startMatch || !endMatch) return "[]";

            const startCol = columnLettersToIndex(startMatch[1]);
            const startRow = parseInt(startMatch[2], 10);
            const endCol = columnLettersToIndex(endMatch[1]);
            const endRow = parseInt(endMatch[2], 10);

            const values = [];
            for (let r = startRow; r <= endRow; r++) {
                for (let c = startCol; c <= endCol; c++) {
                    const cell = getCell(r, c);
                    if (cell) {
                        const val = getCellEvaluatedValue(cell, visited);
                        values.push(val && !isNaN(val) ? Number(val) : 0);
                    }
                }
            }
            return `[${values.join(",")}]`;
        });

        // 単一セル参照置換
        expr = expr.replace(SINGLE_REF_REGEX, (_, colLetters, rowStr) => {
            const colIndex = columnLettersToIndex(colLetters);
            const rowNumber = parseInt(rowStr, 10);
            const cell = getCell(rowNumber, colIndex);
            if (cell) {
                const val = getCellEvaluatedValue(cell, visited);
                return val && !isNaN(val) ? Number(val) : 0;
            }
            return 0;
        });

        const result = eval(expr);
        return typeof result === "function" ? "" : result;

    } catch (e) {
        return "Error: " + e.message;
    } finally {
        visited.delete(cellKey);
    }
}

function updateAllFormulas() {
    const formulaCells = Array.from(document.querySelectorAll("#spreadsheet tbody td[data-formula]"));
    const batchSize = 100;
    let index = 0;
    function updateBatch() {
        const batch = formulaCells.slice(index, index + batchSize);
        batch.forEach(cell => {
            // 編集中セルと数式バー編集中は更新しない
            if (document.activeElement === cell || document.activeElement === formulaBarInput) return;
            cell.textContent = evaluateFormula(cell.dataset.formula);
        });
        index += batchSize;
        if (index < formulaCells.length) requestAnimationFrame(updateBatch);
    }
    updateBatch();
}

// =======================
// Block 7: 範囲選択機能および数式への反映
// =======================

function handleCellMouseDown(e) {
    // もし対象が既に編集モードなら、何もしない（ネイティブなキャレット配置を許容）
    if (e.target && e.target.isContentEditable) {
        return;
    }
    // 通常の選択処理（例：選択の開始、activeCell の更新など）
    if (e.button !== 0) return;
    isSelecting = true;
    clearSelection();
    selectionStart = {
        row: parseInt(e.target.dataset.row, 10),
        col: parseInt(e.target.dataset.col, 10)
    };
    selectionEnd = { ...selectionStart };
    updateSelection();
    e.preventDefault();
    if (document.activeElement === formulaBarInput) {
        return;
    }
    if (isSelecting === true) {
        const cell = e.target;
        formulaBarInput.value = cell.dataset.formula ? cell.dataset.formula : cell.textContent;
    }
    if (document.activeElement === formulaBarInput) {
        return;
    }
    const currentText = activeCell.textContent.trim();
    if (currentText.startsWith("=")) {
        return;
    }
    activeCell = e.target;
    removeMergedCellsHighlight();
}

container.addEventListener("mousemove", function (e) {
    if (!isSelecting) return;
    if (e.target && e.target.tagName && e.target.tagName.toLowerCase() === "td") {
        selectionEnd = {
            row: parseInt(e.target.dataset.row, 10),
            col: parseInt(e.target.dataset.col, 10)
        };
        updateSelection();
    }
});

function updateSelection() {
    if (!selectionStart || !selectionEnd) return;
    const minRow = Math.min(selectionStart.row, selectionEnd.row),
        maxRow = Math.max(selectionStart.row, selectionEnd.row),
        minCol = Math.min(selectionStart.col, selectionEnd.col),
        maxCol = Math.max(selectionStart.col, selectionEnd.col);
    const cells = document.querySelectorAll("#spreadsheet tbody td");
    if (isInFormulaEdit()) {
        clearCalculationRangeHighlights();
        const rangeRef = (minRow === maxRow && minCol === maxCol)
            ? getCellReferenceByCoord(minRow, minCol)
            : getCellReferenceByCoord(minRow, minCol) + ":" + getCellReferenceByCoord(maxRow, maxCol);
        highlightCalculationRange(rangeRef);
        cells.forEach(cell => cell.classList.contains("selected") && cell.classList.remove("selected"));
        if (activeCell && !activeCell.classList.contains("selected")) activeCell.classList.add("selected");
    } else {
        let anySelected = false;
        cells.forEach(cell => {
            const r = +cell.dataset.row, c = +cell.dataset.col;
            const shouldSelect = r >= minRow && r <= maxRow && c >= minCol && c <= maxCol;
            const isSelected = cell.classList.contains("selected");

            if (shouldSelect !== isSelected) cell.classList[shouldSelect ? "add" : "remove"]("selected");
            if (shouldSelect) anySelected = true;
        });
        if (activeCell) activeCell.contentEditable = anySelected ? "false" : "true";
    }
}

function clearSelection() {
    const cells = document.querySelectorAll("#spreadsheet tbody td");
    cells.forEach(cell => cell.classList.remove("selected"));
    cells.forEach(cell => cell.classList.remove("transparent"));
}

document.addEventListener("mouseup", function (e) {
    if (isSelecting) {
        isSelecting = false;
        if (selectionStart && selectionEnd) {
            if (selectionStart.row !== selectionEnd.row || selectionStart.col !== selectionEnd.col) {
                if (isInFormulaEdit()) {
                    const minRow = Math.min(selectionStart.row, selectionEnd.row);
                    const maxRow = Math.max(selectionStart.row, selectionEnd.row);
                    const minCol = Math.min(selectionStart.col, selectionEnd.col);
                    const maxCol = Math.max(selectionStart.col, selectionEnd.col);
                    let rangeRef = "";
                    if (minRow === maxRow && minCol === maxCol) {
                        rangeRef = getCellReferenceByCoord(minRow, minCol);
                    } else {
                        rangeRef = getCellReferenceByCoord(minRow, minCol) + ":" + getCellReferenceByCoord(maxRow, maxCol);
                    }
                    insertCellReference(rangeRef);
                }
            }
        }
        // 選択状態はそのまま保持する
    }
});

// =======================
// Block 8: 数式バーのイベント処理 および 複数セルへの反映
// =======================

function applyValueToCells(value) {
    // 数式編集中の場合は activeCell のみ更新
    if (isInFormulaEdit()) {
        if (activeCell) {
            if (value.startsWith("=")) {
                activeCell.dataset.formula = value;
                activeCell.textContent = evaluateFormula(value);
            } else {
                activeCell.textContent = value;
                delete activeCell.dataset.formula;
            }
        }
    } else {
        // 数式編集中でない場合は、selected クラスが付いたセルを対象に更新
        let targetCells = document.querySelectorAll("#spreadsheet tbody td.selected");
        if (!targetCells || targetCells.length === 0) {
            if (activeCell) targetCells = [activeCell];
        }
        targetCells.forEach(cell => {
            if (value.startsWith("=")) {
                cell.dataset.formula = value;
                cell.textContent = evaluateFormula(value);
            } else {
                cell.textContent = value;
                delete cell.dataset.formula;
            }
        });
    }
    updateAllFormulas();
}

formulaBarInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
        const value = formulaBarInput.value.trim();
        applyValueToCells(value);
        formulaBarInput.blur();
        e.preventDefault();
        activeCell.contentEditable = "false";
    }
});

formulaBarInput.addEventListener("blur", function (e) {
    if (activeCell) {
        const value = formulaBarInput.value.trim();
        applyValueToCells(value);
    }
});
// =======================
// Block 9: スクロール時の動的行／列追加（安全・軽量版）
// =======================
let scrollPending = false;
let isLoadingRows = false;
let isLoadingCols = false;
container.addEventListener("scroll", () => {
    if (scrollPending) return;
    scrollPending = true;
    requestAnimationFrame(() => {
        scrollPending = false;
        // --- 端までスクロールで追加 ---
        if (!isLoadingRows && container.scrollTop + container.clientHeight >= container.scrollHeight - 50) {
            isLoadingRows = true;
            loadRows(ROW_BATCH, undefined, () => (isLoadingRows = false));
        }
        if (!isLoadingCols && container.scrollLeft + container.clientWidth >= container.scrollWidth - 50) {
            isLoadingCols = true;
            loadColumns(COLUMN_BATCH, undefined, () => (isLoadingCols = false));
        }
        // --- 可視範囲の再評価（1回だけ）---
        computeVisibleColumns();
        markInitialRowVisibility();
    });
});

// =======================
// Block 10: フォーマットツールバーのイベント処理
// =======================

// 10-1. Text Alignment
// 10-1. Text Alignment (ボタン版)
const textAlignmentButtons = document.querySelectorAll('#text-alignment-buttons .button');

textAlignmentButtons.forEach(button => {
    button.addEventListener("click", function () {
        // すべてのボタンから選択状態を解除
        textAlignmentButtons.forEach(btn => btn.classList.remove("selected"));
        // クリックされたボタンに選択状態クラスを付与
        this.classList.add("selected");
        const value = this.getAttribute("data-align");
        if (activeCell) {
            const cells = document.querySelectorAll("#spreadsheet tbody td.selected");
            if (cells.length > 0) {
                cells.forEach(cell => cell.style.textAlign = value);
            } else {
                activeCell.style.textAlign = value;
            }
        }
    });
});

// 10-2. Font Size
let fontSizeSelect = document.getElementById("font-size");
fontSizeSelect.addEventListener("change", function (e) {
    if (activeCell) {
        let cells = document.querySelectorAll("#spreadsheet tbody td.selected");
        if (cells.length > 0) {
            cells.forEach(cell => cell.style.fontSize = fontSizeSelect.value);
        } else {
            activeCell.style.fontSize = fontSizeSelect.value;
        }
    }
});

// 10-3. Bold Toggle
let toggleBoldButton = document.getElementById("toggle-bold");
toggleBoldButton.addEventListener("click", function (e) {
    if (activeCell) {
        let cells = document.querySelectorAll("#spreadsheet tbody td.selected");
        if (cells.length > 0) {
            cells.forEach(cell => {
                cell.style.fontWeight = (cell.style.fontWeight === "bold") ? "normal" : "bold";
            });
        } else {
            activeCell.style.fontWeight = (activeCell.style.fontWeight === "bold") ? "normal" : "bold";
        }
    }
});

let toggleBoldButton2 = document.getElementById("toggle-italic");
toggleBoldButton2.addEventListener("click", function (e) {
    if (activeCell) {
        let cells = document.querySelectorAll("#spreadsheet tbody td.selected");
        if (cells.length > 0) {
            cells.forEach(cell => {
                cell.style.fontStyle = (cell.style.fontStyle === "italic") ? "normal" : "italic";
            });
        } else {
            activeCell.style.fontStyle = (activeCell.style.fontStyle === "italic") ? "normal" : "italic";
        }
    }
});

let toggleUnderlineButton = document.getElementById("toggle-underline");
toggleUnderlineButton.addEventListener("click", function (e) {
    if (activeCell) {
        let cells = document.querySelectorAll("#spreadsheet tbody td.selected");
        if (cells.length > 0) {
            const allUnderlined = Array.from(cells).every(cell => cell.style.textDecoration === "underline");
            const newDecoration = allUnderlined ? "none" : "underline";
            cells.forEach(cell => {
                cell.style.textDecoration = newDecoration;
            });
        } else {
            activeCell.style.textDecoration = (activeCell.style.textDecoration === "underline") ? "none" : "underline";
        }
    }
});


let toggletextshadowButton = document.getElementById("toggle-textshadow");
toggletextshadowButton.addEventListener("click", function (e) {
    if (activeCell) {
        let cells = document.querySelectorAll("#spreadsheet tbody td.selected");
        if (cells.length > 0) {
            const alltextshadow = Array.from(cells).every(cell => cell.style.textShadow === "black 3px 3px");
            const newDecoration = alltextshadow ? "" : "black 3px 3px";
            cells.forEach(cell => {
                cell.style.textShadow = newDecoration;
            });
        } else {
            activeCell.style.textShadow = (activeCell.style.textShadow === "black 3px 3px") ? "" : "black 3px 3px";
        }
    }
});

// 10-4. Text Color palette (固定カラー)
let textColorSwatches = document.querySelectorAll("#text-color-palette .color-swatch");
textColorSwatches.forEach(swatch => {
    swatch.addEventListener("click", function (e) {
        let color = swatch.dataset.color;
        let cells = document.querySelectorAll("#spreadsheet tbody td.selected");
        if (cells.length > 0) {
            cells.forEach(cell => {
                cell.style.color = (color === "none") ? "" : color;
            });
        } else if (activeCell) {
            activeCell.style.color = (color === "none") ? "" : color;
        }
    });
});

// 10-5. Custom Text Color picker
let textColorCustom = document.getElementById("text-color-custom");
textColorCustom.addEventListener("input", function (e) {
    let color = textColorCustom.value;
    let cells = document.querySelectorAll("#spreadsheet tbody td.selected");
    if (cells.length > 0) {
        cells.forEach(cell => {
            cell.style.color = color;
        });
    } else if (activeCell) {
        activeCell.style.color = color;
    }
});

// 10-6. Cell Background Color palette (固定カラー)
// ※ 背景色パレットの色は、テキストカラーと同じ濃さの色を使用する
let cellColorSwatches = document.querySelectorAll("#cell-color-palette .color-swatch");
cellColorSwatches.forEach(swatch => {
    swatch.addEventListener("click", function (e) {
        let color = swatch.dataset.color;
        let cells = document.querySelectorAll("#spreadsheet tbody td.selected");
        if (cells.length > 0) {
            cells.forEach(cell => {
                cell.style.backgroundColor = (color === "none") ? "" : color;
            });
        } else if (activeCell) {
            activeCell.style.backgroundColor = (color === "none") ? "" : color;
        }
    });
});

// 10-7. Custom Cell Background Color picker
let cellColorCustom = document.getElementById("cell-color-custom");
cellColorCustom.addEventListener("input", function (e) {
    let color = cellColorCustom.value;
    let cells = document.querySelectorAll("#spreadsheet tbody td.selected");
    if (cells.length > 0) {
        cells.forEach(cell => {
            cell.style.backgroundColor = color;
            cell.classList.add('transparent');
        });
    } else if (activeCell) {
        activeCell.style.backgroundColor = color;
        activeCell.classList.add('transparent');
    }
});

// =======================
// Block 11: セル自動編集モード切替 (キーダウンイベント)
// =======================

document.addEventListener("keydown", function (e) {
    // 既に他の入力フィールド (INPUT, TEXTAREA など) にフォーカスがある場合は無視
    const activeTag = document.activeElement.tagName;
    if (activeTag === "INPUT" || activeTag === "TEXTAREA") {
        return;
    }

    // Ctrl キーが押されている場合は、セルへの自動編集モードの切替を行わない
    if (e.ctrlKey) {
        return;
    }

    // もし activeCell が存在し、かつまだ編集モードになっていない場合
    // なお、e.key が 1 文字の場合（印字可能なキー）にのみ反応
    if (activeCell && !activeCell.isContentEditable && e.key.length === 1) {
        // 自動的に編集モードにする
        activeCell.contentEditable = "true";
        // 編集モードに切替えたらフォーカスを当てる
        activeCell.focus();
        // 既存の内容を削除したい場合は（Excel では初回入力で置換されることが多い）
        activeCell.textContent = "";
        // 入力されたキーを現在のカーソル位置に挿入する
        document.execCommand('insertText', false, e.key);
        e.preventDefault();
    }
});

// 連続移動用タイマー（グローバル変数）
let navigationInterval = null;

document.addEventListener("keydown", function (e) {
    // 数式バーにフォーカスされていたら何もしない
    if (document.activeElement === formulaBarInput) return;

    // Tabキー判定（Shift+Tab含む）
    if (e.key === "Tab") {
        let currentCell = activeCell;
        if (!currentCell) return;

        // 編集中のセルを解除（Excelと同じ挙動）
        if (currentCell.isContentEditable) {
            currentCell.contentEditable = "false";
            delete currentCell.dataset.editBy;
        }

        let row = parseInt(currentCell.dataset.row, 10);
        let col = parseInt(currentCell.dataset.col, 10);

        // 左右移動
        let targetCol = e.shiftKey ? col - 1 : col + 1;
        let targetRow = row;

        // 列が足りなければ追加
        if (targetCol >= currentColumns) {
            loadColumns(targetCol - currentColumns + 1);
        }

        // 左端で Shift+Tab した場合は上の行の最後列に移動
        if (targetCol < 0) {
            targetRow = row - 1;
            if (targetRow < 1) targetRow = 1;
            targetCol = currentColumns - 1;
        }

        const targetCell = getCell(targetRow, targetCol);
        if (targetCell) {
            navigateToCell(targetRow, targetCol, e);
            updateFillHandle();
        }

        e.preventDefault();
        return; // Tab処理完了で他の処理をスキップ
    }

    // 既存の矢印キー / Enter 判定
    const arrowKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
    const navigationKeys = [...arrowKeys, "Enter"];
    if (!navigationKeys.includes(e.key)) return;

    // 編集中 (contentEditable) のセルならキャレット操作を優先
    if (document.activeElement && document.activeElement.isContentEditable) {
        const cellText = document.activeElement.textContent.trim();
        if (
            cellText.startsWith("=") ||
            document.activeElement.dataset.editBy === "dblclick" ||
            document.activeElement.dataset.editBy === "F2"
        ) {
            return;
        }
    }

    let currentCell2 = activeCell;
    if (!currentCell2 && document.activeElement && document.activeElement.tagName === "TD") {
        currentCell2 = document.activeElement;
        activeCell = currentCell2;
    }
    if (!currentCell2) return;

    if (document.activeElement.isContentEditable) {
        document.activeElement.blur();
    }

    doMove(e);

    if (arrowKeys.includes(e.key)) {
        if (!navigationInterval) {
            navigationInterval = setInterval(() => {
                doMove(e);
            }, 100);
        }
    }

    e.preventDefault();
});

document.addEventListener("keyup", function (e) {
    const arrowKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
    if (arrowKeys.includes(e.key)) {
        if (navigationInterval) {
            clearInterval(navigationInterval);
            navigationInterval = null;
        }
    }
});

/**
 * doMove(e)
 *
 * 現在の activeCell（結合セルの場合はアンカー情報も考慮）から移動先セルの座標を計算し、
 * getVisibleCell() で表示されているセル（アンカーセル）を取得した上で、navigateToCell() と
 * updateFillHandle() を実行します。さらに、スクロールコンテナ（#spreadsheet-container）内で
 * 隣接セルの位置をチェックし、見切れていれば即時更新（behavior:"auto"）でスクロール補正します。
 */
function doMove(e) {
    let currentCell = activeCell;
    if (!currentCell) return;

    // 現在のセルの座標（data-row, data-col）を取得
    let currentRow = parseInt(currentCell.dataset.row, 10);
    let currentCol = parseInt(currentCell.dataset.col, 10);

    // 結合セルの場合、merge関連情報（mergeMin～mergeMax）があればアンカーを使用
    let rs = parseInt(currentCell.getAttribute("rowspan")) || 1;
    let cs = parseInt(currentCell.getAttribute("colspan")) || 1;
    if (currentCell.dataset.mergeMinRow) {
        currentRow = parseInt(currentCell.dataset.mergeMinRow, 10);
        currentCol = parseInt(currentCell.dataset.mergeMinCol, 10);
        rs = parseInt(currentCell.dataset.mergeMaxRow, 10) - currentRow + 1;
        cs = parseInt(currentCell.dataset.mergeMaxCol, 10) - currentCol + 1;
    }

    // 移動先セルの座標を計算
    let targetRow = currentRow;
    let targetCol = currentCol;
    if (e.key === "Enter" || e.key === "ArrowDown") {
        targetRow = currentRow + rs;
    } else if (e.key === "ArrowRight") {
        targetCol = currentCol + cs;
    } else if (e.key === "ArrowLeft") {
        targetCol = currentCol - 1;
    } else if (e.key === "ArrowUp") {
        targetRow = currentRow - 1;
    }

    // Helper: 指定された (row, col) のセルが非表示なら、mergeAnchor情報を辿って見えるセル（アンカー）を返す
    function getVisibleCell(row, col) {
        let cell = getCell(row, col);
        while (
            cell &&
            cell.style.display === "none" &&
            cell.dataset.mergeAnchorRow &&
            cell.dataset.mergeAnchorCol
        ) {
            row = parseInt(cell.dataset.mergeAnchorRow, 10);
            col = parseInt(cell.dataset.mergeAnchorCol, 10);
            cell = getCell(row, col);
        }
        return cell;
    }

    let visibleTarget = getVisibleCell(targetRow, targetCol);
    if (!visibleTarget) return;

    // セル移動（navigateToCell() は不足行・列があれば自動生成する既存の機能とする）
    navigateToCell(
        parseInt(visibleTarget.dataset.row, 10),
        parseInt(visibleTarget.dataset.col, 10),
        e
    );
    updateFillHandle();

    // スクロール補正
    if (container) {
        const contRect = container.getBoundingClientRect();
        const cellRect = visibleTarget.getBoundingClientRect();

        // 横方向
        if (e.key === "ArrowLeft") {
            let leftCell = getCell(
                parseInt(visibleTarget.dataset.row, 10),
                parseInt(visibleTarget.dataset.col, 10) - 1
            );
            if (leftCell) {
                let leftRect = leftCell.getBoundingClientRect();
                if (leftRect.left < contRect.left) {
                    container.scrollBy({ left: -leftCell.offsetWidth, behavior: "auto" });
                }
            }
        } else if (e.key === "ArrowRight") {
            let rightCell = getCell(
                parseInt(visibleTarget.dataset.row, 10),
                parseInt(visibleTarget.dataset.col, 10) + 1
            );
            if (rightCell) {
                let rightRect = rightCell.getBoundingClientRect();
                if (rightRect.right > contRect.right) {
                    container.scrollBy({ left: rightCell.offsetWidth, behavior: "auto" });
                }
            }
        }

        // 縦方向は、隣接する「もう1つ上／下のセル」をチェックして補正
        if (e.key === "ArrowUp") {
            let aboveCell = getCell(
                parseInt(visibleTarget.dataset.row, 10) - 1,
                parseInt(visibleTarget.dataset.col, 10)
            );
            if (aboveCell) {
                let aboveRect = aboveCell.getBoundingClientRect();
                if (aboveRect.top < contRect.top) {
                    container.scrollBy({ top: -aboveCell.offsetHeight, behavior: "auto" });
                }
            }
        } else if (e.key === "ArrowDown" || e.key === "Enter") {
            let belowCell = getCell(
                parseInt(visibleTarget.dataset.row, 10) + 1,
                parseInt(visibleTarget.dataset.col, 10)
            );
            if (belowCell) {
                let belowRect = belowCell.getBoundingClientRect();
                if (belowRect.bottom > contRect.bottom) {
                    container.scrollBy({ top: belowCell.offsetHeight, behavior: "auto" });
                }
            }
        }
    }

    document.querySelectorAll('#spreadsheet tbody td').forEach(td => {
        td.classList.remove('transparent');
    });

}





document.addEventListener("keydown", function (e) {
    if (e.key === "F2") {

        let targetCell = activeCell;
        if (!targetCell) {
            const selectedCells = document.querySelectorAll("#spreadsheet tbody td.selected");
            if (selectedCells.length > 0) {
                targetCell = selectedCells[0];
            }
        }
        if (targetCell) {
            // ダブルクリック時と同じ編集モードに入る処理を実行
            handleCellDblClick({ target: targetCell });
            updateFillHandle();
        }
        e.preventDefault();
        handleF2Key(e);
        return;
    }

    // ESC キーを判別（e.key が "Escape" または e.keyCode が 27）
    if (e.key === "Escape" || e.keyCode === 27) {
        // 編集中のセルを取得（contenteditable が true のもの）
        const editingCell = document.querySelector("td[contenteditable='true']");
        if (editingCell) {
            // 編集モード解除
            editingCell.contentEditable = "false";
            updateFillHandle();
            e.preventDefault();
        }
    }
});




function setCaretToEnd(el) {
    if (typeof window.getSelection !== "undefined" && typeof document.createRange !== "undefined") {
        var range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false); // false にすることで、カーソルを末尾へ
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    } else if (typeof document.body.createTextRange !== "undefined") {
        var textRange = document.body.createTextRange();
        textRange.moveToElementText(el);
        textRange.collapse(false);
        textRange.select();
    }
}


// =======================
// Block X: 枠線適用機能 (Border Application Functions)
// =======================

// 【外枠適用】
function applyOuterBorderWithWidth(borderWidth) {
    const selectedCells = document.querySelectorAll("#spreadsheet tbody td.selected");
    if (!selectedCells.length) return;
    let minRow = Infinity, maxRow = -Infinity, minCol = Infinity, maxCol = -Infinity;
    selectedCells.forEach(cell => {
        const row = +cell.dataset.row;
        const col = +cell.dataset.col;
        minRow = Math.min(minRow, row);
        maxRow = Math.max(maxRow, row);
        minCol = Math.min(minCol, col);
        maxCol = Math.max(maxCol, col);
    });
    selectedCells.forEach(cell => {
        const row = +cell.dataset.row;
        const col = +cell.dataset.col;
        if (row === minRow) cell.style.borderTop = `${borderWidth}px solid black`;
        if (row === maxRow) cell.style.borderBottom = `${borderWidth}px solid black`;
        if (col === minCol) cell.style.borderLeft = `${borderWidth}px solid black`;
        if (col === maxCol) cell.style.borderRight = `${borderWidth}px solid black`;
    });
}
// 通常枠
function applyOuterBorder() {
    applyOuterBorderWithWidth(3.5);
}
// 太枠
function applyOuterBorder_bold() {
    applyOuterBorderWithWidth(8);
}

// 選択範囲の上側（最小行側）のセルに各掛線を適用
function applyBorderOnEdge(direction, borderWidth = 3.5) {
    const selectedCells = document.querySelectorAll("#spreadsheet tbody td.selected");
    if (!selectedCells.length) return;
    let edgeValue = direction === 'top' || direction === 'left' ? Infinity : -Infinity;
    selectedCells.forEach(cell => {
        const value = +(direction === 'top' || direction === 'bottom' ? cell.dataset.row : cell.dataset.col);
        if (direction === 'top' || direction === 'left') {
            edgeValue = Math.min(edgeValue, value);
        } else {
            edgeValue = Math.max(edgeValue, value);
        }
    });
    selectedCells.forEach(cell => {
        const value = +(direction === 'top' || direction === 'bottom' ? cell.dataset.row : cell.dataset.col);
        if (value === edgeValue) {
            const styleProp = `border${direction[0].toUpperCase()}${direction.slice(1)}`;
            cell.style[styleProp] = `${borderWidth}px solid black`;
        }
    });
}
const applyTopBorder = () => applyBorderOnEdge('top');
const applyBottomBorder = () => applyBorderOnEdge('bottom');
const applyLeftBorder = () => applyBorderOnEdge('left');
const applyRightBorder = () => applyBorderOnEdge('right');

// 【各セル枠適用】
function applyCellBorder() {
    const selectedCells = document.querySelectorAll("#spreadsheet tbody td.selected");
    if (selectedCells.length === 0) return;
    selectedCells.forEach(cell => {
        cell.style.borderTop = "3.5px solid black";
        cell.style.borderBottom = "3.5px solid black";
        cell.style.borderLeft = "3.5px solid black";
        cell.style.borderRight = "3.5px solid black";
    });
}

// =======================
// Block X: 枠線適用ボタン用のイベントリスナー
// =======================

let applyOuterBorderButton = document.getElementById("apply-outer-border");
applyOuterBorderButton.addEventListener("click", function (e) {
    applyOuterBorder();
});

let applyOuterBorderButton2 = document.getElementById("apply-outer-border-bold");
applyOuterBorderButton2.addEventListener("click", function (e) {
    applyOuterBorder_bold();
});

let applyCellBorderButton = document.getElementById("apply-cell-border");
applyCellBorderButton.addEventListener("click", function (e) {
    applyCellBorder();
});
// =======================
// Block X: 枠線解除機能 (Combined Border Removal Function)
// =======================

function removeAllBorders() {
    const selectedCells = document.querySelectorAll("#spreadsheet tbody td.selected");
    if (selectedCells.length === 0) return;
    selectedCells.forEach(cell => {
        cell.style.borderTop = "";
        cell.style.borderBottom = "";
        cell.style.borderLeft = "";
        cell.style.borderRight = "";
    });
}

// =======================
// Block X: 枠線解除ボタン用のイベントリスナー（統合版）
// =======================

let removeAllBordersButton = document.getElementById("remove-all-borders");
removeAllBordersButton.addEventListener("click", function (e) {
    removeAllBorders();
});


document.addEventListener("keydown", function (e) {
    if (document.activeElement === formulaBarInput) {
        return;
    }
    // もし現在フォーカスされている要素が編集モードの場合は、通常の一文字削除（デフォルト動作）を行うため何もしない
    if (document.activeElement && document.activeElement.isContentEditable) {
        return;
    }
    // Backspace または Delete キーが押された場合の処理（編集モードでないとき）
    if (e.key === "Backspace" || e.key === "Delete") {
        // 複数セルが選択されている場合（selected クラスが付いているセル群）を優先して対象とする
        const selectedCells = document.querySelectorAll("#spreadsheet tbody td.selected");

        if (selectedCells.length > 0) {
            // 選択されている複数のセルすべての内容と、保持している数式データなどをクリアする
            selectedCells.forEach(cell => {
                cell.textContent = "";
                if (cell.dataset.formula) {
                    delete cell.dataset.formula;
                }
                // 編集モードでなくても念のため contentEditable を false に設定
                cell.contentEditable = "false";
            });
        } else if (activeCell) {
            // 複数選択がなければ、activeCell に対して同様の処理を行う
            activeCell.textContent = "";
            if (activeCell.dataset.formula) {
                delete activeCell.dataset.formula;
            }
            activeCell.contentEditable = "false";
        }
        updateFillHandle();
        // 標準の Backspace / Delete のブラウザ動作（ページ戻り等）を防止
        e.preventDefault();
        formulaBarInput.value = "";
    }
});

// 例：セル参照（例 "A1"）を { row, col } に変換する（0-index と想定）
function parseCellReference(ref) {
    const match = ref.match(/^([A-Z]+)(\d+)$/);
    if (!match) return null;

    // 修正ここ: すでに定義済みの columnLettersToIndex 関数を使用して、
    // 複数文字の列番号も正しく変換する
    const col = columnLettersToIndex(match[1]);
    const row = parseInt(match[2], 10);
    return { row, col };
}

// 例：範囲指定（例 "A1:B3"）を { start: {row, col}, end: {row, col} } に変換する
function parseRangeReference(rangeRef) {
    const parts = rangeRef.split(":");
    if (parts.length !== 2) return null;
    const start = parseCellReference(parts[0]);
    const end = parseCellReference(parts[1]);
    if (!start || !end) return null;
    return { start, end };
}

// セルの DOM 要素を取得する（data-row と data-col 属性で識別する例）
function getCellElement(row, col) {
    return document.querySelector(`#spreadsheet td[data-row="${row}"][data-col="${col}"]`);
}

// 既存のクリア処理（背景色クリア）を、以下のように outline のクリアに変更
function clearCalculationRangeHighlights() {
    const cells = document.querySelectorAll("#spreadsheet td");
    cells.forEach(cell => {
        cell.style.outline = "";
    });
}

// 数式内の計算対象グループごとにセルの背景色を設定する関数
function highlightCalculationRange(formula) {
    clearCalculationRangeHighlights();

    const palette = ["blue", "red", "yellowgreen", "purple", "yellow", "blueviolet", "mediumvioletred"];
    let groups = formula.includes(",")
        ? formula.split(",").map(s => s.trim()).filter(Boolean)
        : [...new Set((formula.match(/[A-Z]+\d+(?::[A-Z]+\d+)?/g) || []))];

    for (let i = 0; i < groups.length; i++) {
        const color = palette[i % palette.length];
        const refs = groups[i].match(/[A-Z]+\d+(?::[A-Z]+\d+)?/g) || [];
        for (let ref of refs) {
            if (ref.includes(":")) {
                const range = parseRangeReference(ref);
                if (!range) continue;
                for (let r = range.start.row; r <= range.end.row; r++) {
                    for (let c = range.start.col; c <= range.end.col; c++) {
                        const cell = getCellElement(r, c);
                        if (cell) cell.style.outline = `5px solid ${color}`;
                    }
                }
            } else {
                const pos = parseCellReference(ref);
                if (!pos) continue;
                const cell = getCellElement(pos.row, pos.col);
                if (cell) cell.style.outline = `5px solid ${color}`;
            }
        }
    }
}

// 数式バーをクリック（またはフォーカス）した際に、バーに数式があれば計算対象セル範囲をハイライト
formulaBarInput.addEventListener("click", function () {
    const formulaText = formulaBarInput.value.trim();
    if (formulaText && formulaText.startsWith("=")) {
        highlightCalculationRange(formulaText);
    } else {
        clearCalculationRangeHighlights();
    }
    activeCell.style.outline = "solid 3.5px steelblue";
});

formulaBarInput.addEventListener("focus", function () {
    handleCellDblClick({ target: activeCell }, true); // フォーカスはセルに当てない
    updateFillHandle();
});

formulaBarInput.addEventListener("input", function () {
    const formulaText = formulaBarInput.value.trim();
    if (formulaText && formulaText.startsWith("=")) {
        highlightCalculationRange(formulaText);
    } else {
        clearCalculationRangeHighlights();
    }
    if (formulaText === '{"mergecell"}') {
        highlightMergedCells();
    } else {
        removeMergedCellsHighlight();
    }
    const formulaText2 = formulaBarInput.value;
    const selectedCells = document.querySelectorAll("#spreadsheet tbody td.selected");

    selectedCells.forEach(cell => {
        cell.textContent = formulaText2;
        cell.style.outline = "solid 2px steelblue";
    });
});

function highlightMergedCells() {
    // シート内の全セルを取得
    const cells = document.querySelectorAll("#spreadsheet tbody td");
    cells.forEach(cell => {
        // rowspan, colspan 属性の値を数値で取得（属性が無ければ 1 とする）
        const rowSpan = cell.getAttribute("rowspan") ? parseInt(cell.getAttribute("rowspan"), 10) : 1;
        const colSpan = cell.getAttribute("colspan") ? parseInt(cell.getAttribute("colspan"), 10) : 1;
        // 結合セルとみなす条件
        const isMerged = (rowSpan > 1 || colSpan > 1) || (cell.dataset.mergeMinRow && cell.dataset.mergeMinCol);
        if (isMerged) {
            cell.classList.add("merge-highlight");
        }
    });
}

function removeMergedCellsHighlight() {
    const highlighted = document.querySelectorAll("#spreadsheet tbody td.merge-highlight");
    highlighted.forEach(cell => cell.classList.remove("merge-highlight"));
}

document.addEventListener("input", e => {
    const t = e.target;
    if (t?.matches("td[contenteditable='true']")) {
        const val = t.textContent.trim();
        val.startsWith("=") ? highlightCalculationRange(val) : clearCalculationRangeHighlights();
        formulaBarInput.value = t.textContent;
    }
    debouncedSaveState();
});

// 数式バーにフォーカスが入ったタイミングでも同様の処理を行う場合はこちらも追加（任意）
formulaBarInput.addEventListener("focus", function () {
    const formulaText = formulaBarInput.value.trim();
    if (formulaText && formulaText.startsWith("=")) {
        highlightCalculationRange(formulaText);
    }
});

// 数式バーからフォーカスが外れたら、ハイライトをクリア
formulaBarInput.addEventListener("blur", function () {
    clearCalculationRangeHighlights();
});

// keydown イベント：この段階で先に抑制する（キャプチャフェーズでの実行）
document.addEventListener(
    "keydown",
    function (e) {
        if (e.ctrlKey && e.key.toLowerCase() === "a") {
            if (document.activeElement === formulaBarInput) {
                return;
            }
            // 編集モード中（contentEditable）のセル内なら、
            // デフォルトのテキスト選択（セル内全選択）に任せ、セル全体の選択は行わない
            if (document.activeElement && document.activeElement.isContentEditable) {
                return;
            }
            // 早期にキャンセル
            e.preventDefault();
            e.stopImmediatePropagation();

            // 編集中ならまず blur() で解除
            if (document.activeElement && document.activeElement.isContentEditable) {
                document.activeElement.blur();
            }

            // 全セル選択の処理
            const previouslySelected = document.querySelectorAll("#spreadsheet tbody td.selected");
            previouslySelected.forEach((cell) => {
                cell.classList.remove("selected");
            });
            const allCells = document.querySelectorAll("#spreadsheet tbody td");
            allCells.forEach((cell) => {
                cell.classList.add("selected");
            });
            updateFillHandle();
            if (allCells.length > 0) {
                activeCell = allCells[0];
            }

            return;
        }
    },
    true // キャプチャフェーズで登録
);

// keypress イベントもキャプチャフェーズで抑止（万が一 keydown だけで防げない場合）
document.addEventListener(
    "keypress",
    function (e) {
        if (e.ctrlKey && e.key.toLowerCase() === "a") {
            e.preventDefault();
            e.stopImmediatePropagation();
        }
    },
    true
);

// beforeinput イベントをリッスンして、入力前に "a" が挿入されないようにする
document.addEventListener(
    "beforeinput",
    function (e) {
        if (e.ctrlKey && e.data && e.data.toLowerCase() === "a") {
            e.preventDefault();
            e.stopImmediatePropagation();
        }
    },
    true
);

// 行番号と列番号の間の空白（corner エリア）をクリックしたら全セル選択する
document.getElementById("corner").addEventListener("click", e => {
    e.preventDefault();
    if (document.activeElement?.isContentEditable) return;
    // 既存選択解除と全選択をまとめて行う
    const allCells = document.querySelectorAll("#spreadsheet tbody td");
    allCells.forEach(cell => cell.classList.toggle("selected", true));
    updateFillHandle();
    activeCell = allCells[0] ?? activeCell;
});

window.onload = function () {
    //==============================
    // ドラッグ操作用の共通変数
    //==============================
    let isRowSelecting = false;
    let rowSelectionStart = null;
    let rowSelectionCurrent = null;

    let isColSelecting = false;
    let colSelectionStart = null;
    let colSelectionCurrent = null;

    //==============================
    // mousedown イベントをイベント委譲で処理
    //==============================
    document.addEventListener("mousedown", function (e) {
        // 行番号 (row_number) の場合
        const rowHeader = e.target.closest("th.row_number");
        if (rowHeader) {
            e.preventDefault();
            if (document.activeElement && document.activeElement.isContentEditable) {
                document.activeElement.blur();
            }
            isRowSelecting = true;
            rowSelectionStart = parseInt(rowHeader.textContent.trim());
            rowSelectionCurrent = rowSelectionStart;
            clearSelected();
            selectRows(rowSelectionStart, rowSelectionStart);
            // 行番号が優先なら、ここで処理を終了する場合:
            return;
        }

        // 列番号 (col_number) の場合
        const colHeader = e.target.closest("th.col_number");
        if (colHeader) {
            e.preventDefault();
            if (document.activeElement && document.activeElement.isContentEditable) {
                document.activeElement.blur();
            }
            isColSelecting = true;
            colSelectionStart = colLabelToIndex(colHeader.textContent.trim());
            colSelectionCurrent = colSelectionStart;
            clearSelected();
            selectColumns(colSelectionStart, colSelectionStart);
        }
    });

    //==============================
    // ドラッグ中（mousemove）に対象の行／列を更新する
    //==============================
    document.addEventListener("mousemove", function (e) {
        // 行選択の場合の処理
        if (isRowSelecting) {
            const th = e.target.closest("th.row_number");
            if (th) {
                const hoveredRow = parseInt(th.textContent.trim());
                if (hoveredRow !== rowSelectionCurrent) {
                    rowSelectionCurrent = hoveredRow;
                    const from = Math.min(rowSelectionStart, rowSelectionCurrent);
                    const to = Math.max(rowSelectionStart, rowSelectionCurrent);
                    clearSelected();
                    selectRows(from, to);
                }
            }
        }
        // 列選択の場合の処理
        if (isColSelecting) {
            const th = e.target.closest("th.col_number");
            if (th) {
                const hoveredCol = colLabelToIndex(th.textContent.trim());
                if (hoveredCol !== colSelectionCurrent) {
                    colSelectionCurrent = hoveredCol;
                    const from = Math.min(colSelectionStart, colSelectionCurrent);
                    const to = Math.max(colSelectionStart, colSelectionCurrent);
                    clearSelected();
                    selectColumns(from, to);
                }
            }
        }
    });

    //==============================
    // マウスアップでドラッグ選択終了
    //==============================
    document.addEventListener("mouseup", function (e) {
        if (isRowSelecting) {
            isRowSelecting = false;
            rowSelectionStart = null;
            rowSelectionCurrent = null;
        }
        if (isColSelecting) {
            isColSelecting = false;
            colSelectionStart = null;
            colSelectionCurrent = null;
        }
    });


    //==============================
    // ヘルパー関数
    //==============================

    // 選択状態をクリア（#spreadsheet 内の td から selected クラスを削除）
    function clearSelected() {
        const selectedCells = document.querySelectorAll("#spreadsheet td.selected");
        selectedCells.forEach(cell => cell.classList.remove("selected"));
    }

    // 行番号 (data-row 属性に一致) の範囲を選択
    function selectRows(from, to) {
        const selectors = [];
        for (let r = from; r <= to; r++) {
            selectors.push(`td[data-row="${r}"]`);
        }
        const cells = document.querySelectorAll("#spreadsheet " + selectors.join(","));
        cells.forEach(cell => cell.classList.add("selected"));
    }

    // 列番号 (data-col 属性に一致) の範囲を選択
    function selectColumns(from, to) {
        const selectors = [];
        for (let c = from; c <= to; c++) {
            selectors.push(`td[data-col="${c}"]`);
        }
        const cells = document.querySelectorAll("#spreadsheet " + selectors.join(","));
        cells.forEach(cell => cell.classList.add("selected"));
    }

    // 例：列番号ラベル "A" -> 0, "B" -> 1, "AA" -> 26 などに変換する関数
    function colLabelToIndex(label) {
        let index = 0;
        label = label.toUpperCase();
        for (let i = 0; i < label.length; i++) {
            index = index * 26 + ((label.charCodeAt(i) - 65) + 1);
        }
        return index - 1; // 0-index に調整
    }








    const spreadsheet = document.getElementById("spreadsheet");
    if (!spreadsheet) {
        console.error("Spreadsheet element not found.");
        return;
    }

    // =========================
    // ツールチップの生成と制御
    // =========================
    const resizeTooltip = (() => {
        let tooltip = document.createElement("div");
        tooltip.id = "resize-tooltip";
        tooltip.style.position = "fixed";
        tooltip.style.background = "rgba(0, 0, 0, 0.7)";
        tooltip.style.color = "#fff";
        tooltip.style.padding = "4px 8px";
        tooltip.style.borderRadius = "4px";
        tooltip.style.fontSize = "12px";
        tooltip.style.display = "none";
        tooltip.style.pointerEvents = "none"; // ツールチップがマウス操作を妨げないように
        tooltip.style.zIndex = "10000";
        document.body.appendChild(tooltip);
        return tooltip;
    })();

    function updateResizeTooltip(x, y, text) {
        resizeTooltip.textContent = text;
        // マウスポインターの右上側に表示（必要に応じてオフセットを調整してください）
        resizeTooltip.style.left = (x + 10) + "px";
        resizeTooltip.style.top = (y - 30) + "px";
        resizeTooltip.style.display = "block";
    }

    function hideResizeTooltip() {
        resizeTooltip.style.display = "none";
    }

    // =========================
    // 初回のリサイズハンドル追加
    // =========================
    addRowResizeHandles();
    addColumnResizeHandles();

    // =========================
    // 動的に追加された要素にも対応する MutationObserver の設定
    // =========================
    const observer = new MutationObserver((mutationsList, observer) => {
        for (const mutation of mutationsList) {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // 新規追加されたノード自身が、またはその子孫に行番号ヘッダーが含まれていたら
                    if (node.matches("th.row_number") || node.querySelector("th.row_number")) {
                        addRowResizeHandles();
                    }
                    // 同様に、列番号ヘッダーが含まれていたら
                    if (node.matches("th.col_number") || node.querySelector("th.col_number")) {
                        addColumnResizeHandles();
                    }
                }
            });
        }
    });
    observer.observe(spreadsheet, { childList: true, subtree: true });

    // =========================
    // 関数定義
    // =========================

    // 行番号ヘッダーにリサイズハンドルを追加する
    function addRowResizeHandles() {
        // th.row_number と td.row_number の両方に対応
        const rowHeaders = document.querySelectorAll("th.row_number, td.row_number");
        rowHeaders.forEach(cell => {
            // 既にハンドルが追加されていない場合のみ追加
            if (!cell.querySelector(".row-resize-handle")) {
                const handle = document.createElement("div");
                handle.className = "row-resize-handle";
                // 以下のスタイルでハンドルをセルの下端の中央に配置
                handle.style.position = "absolute";
                handle.style.left = "0";
                handle.style.right = "0";
                // セルの下端に配置し、中央に来るように調整（すなわち「1」と「2」などの間になる）
                handle.style.top = "100%";
                handle.style.transform = "translateY(-50%)";
                // ハンドルの高さは細いバーとして指定（必要に応じて調整）
                handle.style.height = "6px";
                // カーソルは縦方向リサイズとする
                handle.style.cursor = "row-resize";
                // オーバーレイが邪魔にならないようにしておく（オプション）
                // handle.style.background = "rgba(0, 0, 0, 0.3)";
                // 親要素（セル）を相対位置に
                cell.style.position = "sticky";
                cell.style.textAlign = "right";
                cell.style.fontSize = "large";
                cell.appendChild(handle);
                // mousedown イベントで行リサイズハンドラーへ
                handle.addEventListener("mousedown", rowResizeHandler);
            }
        });
    }


    // 列番号ヘッダーにリサイズハンドルを追加する
    function addColumnResizeHandles() {
        const colHeaders = document.querySelectorAll("th.col_number");
        colHeaders.forEach(th => {
            // 既にハンドルが追加されていないかチェック
            if (!th.querySelector(".col-resize-handle")) {
                const handle = document.createElement("div");
                handle.className = "col-resize-handle";
                // スタイル調整（右端に配置する形）
                handle.style.position = "absolute";
                handle.style.right = "0";
                handle.style.top = "0";
                handle.style.width = "6px";
                handle.style.height = "100%";
                handle.style.cursor = "col-resize";
                th.style.textAlign = "center";
                th.style.fontSize = "large";
                th.appendChild(handle);
                handle.addEventListener("mousedown", colResizeHandler);
            }
            // ヘッダーに data-col 属性が無ければ、列番号テキストから追加（例："A" → 0）
            if (!th.hasAttribute("data-col")) {
                const colLabel = th.textContent.trim();
                const colIndex = colLabelToIndex(colLabel);
                th.setAttribute("data-col", colIndex);
            }
        });
    }

    // ----- 行のリサイズ処理（ドラッグ中に行全体の高さを調整） -----
    function rowResizeHandler(e) {
        e.stopPropagation();
        e.preventDefault();

        // 現在の行を取得 (行番号ヘッダーは <th>、親行は <tr>)
        const th = e.target.parentElement;
        const tr = th.parentElement;
        const startY = e.clientY;
        const startHeight = tr.offsetHeight;

        const onMouseMove = function (eMove) {
            const dy = eMove.clientY - startY;
            let newHeight = startHeight + dy;
            if (newHeight < 20) newHeight = 20; // 最低高さを設定

            // 行内のすべてのセル (th と td) に新しい高さを設定
            Array.from(tr.children).forEach(cell => {
                cell.style.height = newHeight + "px";
            });
            tr.style.height = newHeight + "px";
            // ツールチップに現在の高さ (px) を表示（マウス座標から表示）
            updateResizeTooltip(eMove.clientX, eMove.clientY, newHeight + "px");
            setTimeout(() => {
                setupRowVisibilityObserver();
            }, 500);
        };

        const onMouseUp = function () {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
            hideResizeTooltip();
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    }

    // ----- 列のリサイズ処理（ドラッグ中に同じ data-col の列の幅を調整） -----
    function colResizeHandler(e) {
        e.stopPropagation();
        e.preventDefault();

        const th = e.target.parentElement;
        const startX = e.clientX;
        const startWidth = th.offsetWidth;
        const colIndex = th.getAttribute("data-col");

        const onMouseMove = function (eMove) {
            const dx = eMove.clientX - startX;
            let newWidth = startWidth + dx;
            if (newWidth < 30) newWidth = 30; // 最小幅

            // ヘッダー自身の幅を更新
            th.style.width = newWidth + "px";
            // 同じ data-col を持つ全ての td セルの幅を更新
            const colCells = document.querySelectorAll(`#spreadsheet td[data-col="${colIndex}"]`);
            colCells.forEach(td => {
                td.style.width = newWidth + "px";
            });
            // ツールチップに現在の幅 (px) を表示
            updateResizeTooltip(eMove.clientX, eMove.clientY, newWidth + "px");
            setTimeout(() => {
                setupRowVisibilityObserver();
            }, 500);
        };

        const onMouseUp = function () {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
            hideResizeTooltip();
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    }

    // ----- 補助関数 -----
    // A, B, C... AA, AB... -> 0, 1, 2, ... （例としてアルファベット→数値に変換する関数）
    function colLabelToIndex(label) {
        let index = 0;
        for (let i = 0; i < label.length; i++) {
            index *= 26;
            index += label.charCodeAt(i) - 64;  // 'A' は 65 なので
        }
        return index - 1;  // 0-indexed にするため 1 を引く
    }


    // 列番号ラベル ("A", "B", "AA", …) を 0-index に変換する関数
    function colLabelToIndex(label) {
        let index = 0;
        label = label.toUpperCase();
        for (let i = 0; i < label.length; i++) {
            index = index * 26 + (label.charCodeAt(i) - 65 + 1);
        }
        return index - 1;
    }












    // A1 セルを取得（getCellは 1-index, 0-index の引数をとります）
    const a1Cell = getCell(1, 0);
    if (a1Cell) {
        // 既存の選択状態を解除
        const previouslySelected = document.querySelectorAll("#spreadsheet tbody td.selected");
        previouslySelected.forEach(cell => cell.classList.remove("selected"));

        // A1 セルを選択状態にする
        a1Cell.classList.add("selected");
        updateSelectedCellsDisplay();

        // アクティブセルを更新
        activeCell = a1Cell;
        updateFillHandle();

        // セルにフォーカスを当てる（エディタとして編集操作ができるように）
        a1Cell.focus();


        // 数式バーの内容も更新（セルの数式があればそれを、そうでなければテキスト内容を設定）
        formulaBarInput.value = a1Cell.dataset.formula ? a1Cell.dataset.formula : a1Cell.textContent;
    }



};





// 上揃えボタン
let verticalAlignTopButton = document.getElementById("vertical-align-top");
verticalAlignTopButton.addEventListener("click", function (e) {
    let cells = document.querySelectorAll("#spreadsheet tbody td.selected");
    if (cells.length > 0) {
        cells.forEach(cell => {
            if (cell.style.verticalAlign === "top") {
                cell.style.verticalAlign = "";
            } else {
                cell.style.verticalAlign = "top";
            }
        });
    } else if (activeCell) {
        if (activeCell.style.verticalAlign === "top") {
            activeCell.style.verticalAlign = "";
        } else {
            activeCell.style.verticalAlign = "top";
        }
    }
});
// 中央揃えボタン
let verticalAlignMiddleButton = document.getElementById("vertical-align-middle");
verticalAlignMiddleButton.addEventListener("click", function (e) {
    let cells = document.querySelectorAll("#spreadsheet tbody td.selected");
    if (cells.length > 0) {
        cells.forEach(cell => {
            if (cell.style.verticalAlign === "middle") {
                cell.style.verticalAlign = "";
            } else {
                cell.style.verticalAlign = "middle";
            }
        });
    } else if (activeCell) {
        if (activeCell.style.verticalAlign === "middle") {
            activeCell.style.verticalAlign = "";
        } else {
            activeCell.style.verticalAlign = "middle";
        }
    }
});
// 下揃えボタン
let verticalAlignBottomButton = document.getElementById("vertical-align-bottom");
verticalAlignBottomButton.addEventListener("click", function (e) {
    let cells = document.querySelectorAll("#spreadsheet tbody td.selected");
    if (cells.length > 0) {
        cells.forEach(cell => {
            if (cell.style.verticalAlign === "bottom") {
                cell.style.verticalAlign = "";
            } else {
                cell.style.verticalAlign = "bottom";
            }
        });
    } else if (activeCell) {
        if (activeCell.style.verticalAlign === "bottom") {
            activeCell.style.verticalAlign = "";
        } else {
            activeCell.style.verticalAlign = "bottom";
        }
    }
});
let toggleTextWrapButton = document.getElementById("toggle-text-wrap");
toggleTextWrapButton.addEventListener("click", function (e) {
    let cells = document.querySelectorAll("#spreadsheet tbody td.selected");
    if (cells.length > 0) {
        cells.forEach(cell => {
            // 初期状態は "pre"（折り返しOFF）
            if (cell.style.whiteSpace === "pre") {
                // 折り返しONに：改行はそのまま表示しつつ自動折り返し
                cell.style.whiteSpace = "pre-wrap";
                cell.style.wordBreak = "break-all";
            } else {
                // 折り返しOFFに：改行は保持されるが自動折り返しは行わない
                cell.style.whiteSpace = "pre";
                cell.style.wordBreak = "";
            }
        });
    } else if (activeCell) {
        if (activeCell.style.whiteSpace === "pre") {
            activeCell.style.whiteSpace = "pre-wrap";
            activeCell.style.wordBreak = "break-all";
        } else {
            activeCell.style.whiteSpace = "pre";
            activeCell.style.wordBreak = "";
        }
    }
});

function updateSelectedCellsDisplay() {
    const selected = [...document.querySelectorAll("td.selected")];
    if (!selected.length) {
        const el = document.getElementById("selected-cells-display");
        if (el) el.textContent = "";
        updateFontSizeSelect();
        return;
    }
    let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
    const coords = selected.map(c => {
        const r = +c.dataset.row, c_ = +c.dataset.col;
        if (r < minR) minR = r; if (r > maxR) maxR = r;
        if (c_ < minC) minC = c_; if (c_ > maxC) maxC = c_;
        return toColumnName(c_) + r;
    });
    const expected = (maxR - minR + 1) * (maxC - minC + 1);
    const text = selected.length === 1 ? coords[0]
        : selected.length === expected ? `${toColumnName(minC)}${minR}:${toColumnName(maxC)}${maxR}`
            : coords.join(", ");
    const el = document.getElementById("selected-cells-display");
    if (el) el.textContent = text;
    updateFontSizeSelect();
}

// 0-indexedの列番号を Excel 表記（"A", "B", ..., "Z", "AA", ...）に変換する関数
function toColumnName(n) {
    let s = "";
    for (; n >= 0; n = Math.floor(n / 26) - 1)
        s = String.fromCharCode((n % 26) + 65) + s;
    return s;
}

function updateFontSizeSelect() {
    const selected = document.querySelectorAll("#spreadsheet tbody td.selected");
    if (!selected.length) return;
    let common = null;
    for (const cell of selected) {
        const size = getComputedStyle(cell).fontSize;
        if (common === null) common = size;
        else if (common !== size) return console.log("選択セルには複数の font-size が設定されています。");
    }
    const select = document.getElementById("font-size");
    if (!select) return console.error("font-size セレクト要素が見つかりません。");
    if (select.value === common) return;
    for (const opt of select.options) opt.selected = opt.value === common;
}

// マウスダウン：新規選択開始時に、既存の選択をクリアしてクリックしたセルを選択
document.addEventListener("mousedown", function (e) {
    if (e.target.tagName.toUpperCase() === "TD") {
        updateSelectedCellsDisplay();
    }
    var isClickInsideStartButton = Array.from(document.querySelectorAll('.pulldown_btn,.pulldown_menu')).some(button => button.contains(e.target));
    if (!isClickInsideStartButton) {
        document.querySelectorAll(".pulldown_menu").forEach(pulldown_menu => {
            pulldown_menu.style.display = "none";
        })
    }
});

// マウス移動：左ボタン押下中 (e.buttons === 1) の場合、ドラッグでセルを選択
document.addEventListener("mousemove", function (e) {
    if (e.buttons === 1 && e.target && e.target.tagName.toUpperCase() === "TD") {
        updateSelectedCellsDisplay();
    }
});

// クリック：単体クリックの場合は、前回の選択をクリアして新たに選択
document.addEventListener("click", function (e) {
    if (e.target.tagName.toUpperCase() === "TD") {
        updateSelectedCellsDisplay();
    }
    debouncedSaveState();
});

// キーダウン：矢印キーなどで選択が変更された場合も表示を更新
document.addEventListener("keydown", function (e) {
    const arrowKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"];
    if (arrowKeys.includes(e.key)) {
        updateSelectedCellsDisplay();
    }
});

// アクティブセルにフィルハンドルを追加／更新する関数
function updateFillHandle() {
    document.querySelectorAll(".fill-handle").forEach(h => h.remove());
    const selected = [...document.querySelectorAll("#spreadsheet tbody td.selected")];
    if (!selected.length) return;
    let target;
    if (selected.length === 1) {
        target = activeCell;
    } else {
        let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
        for (const c of selected) {
            const r = +c.dataset.row, col = +c.dataset.col;
            if (r < minR) minR = r; if (r > maxR) maxR = r;
            if (col < minC) minC = col; if (col > maxC) maxC = col;
        }
        target = getCell(maxR, maxC);
    }
    if (target && !target.isContentEditable) {
        target.style.position = "relative";
        const fh = document.createElement("div");
        fh.className = "fill-handle";
        target.appendChild(fh);
        fh.addEventListener("mousedown", fillHandleMouseDown);
    }
}

// 【selected】セルブロックの境界を計算する関数
// フィル操作管理用グローバル変数
let isFillDragging = false;
let fillDragStartCell = null;          // マウスダウン時のアンカー（通常 activeCell）
let fillDragStartCoord = { x: 0, y: 0 }; // マウスダウン時の座標（window座標）
let currentFillRange = null;           // 現在のフィル範囲 { minRow, maxRow, minCol, maxCol }
let initialFillRange = null;           // マウスダウン時に記録した、もともとの【selected】セルの境界
let initialBottomRight = null;           // initialFillRange の右下（アンカー）セルの情報

// 【selected】セルブロックの境界を計算する関数
function computeInitialFillRange() {
    const selectedCells = document.querySelectorAll("#spreadsheet tbody td.selected");
    let minRow = Infinity, maxRow = -Infinity, minCol = Infinity, maxCol = -Infinity;
    selectedCells.forEach(cell => {
        const r = parseInt(cell.dataset.row, 10);
        const c = parseInt(cell.dataset.col, 10);
        if (r < minRow) minRow = r;
        if (r > maxRow) maxRow = r;
        if (c < minCol) minCol = c;
        if (c > maxCol) maxCol = c;
    });
    return { minRow, maxRow, minCol, maxCol };
}


// フィルハンドルのマウスダウン時の処理
function fillHandleMouseDown(e) {
    // 編集モード中なら無視する
    if (activeCell && activeCell.isContentEditable) return;
    e.stopPropagation();
    e.preventDefault();
    isFillDragging = true;
    fillDragStartCell = activeCell;
    fillDragStartCoord = { x: e.clientX, y: e.clientY };
    // もともと【selected】になっているセルのブロックの境界を記録
    initialFillRange = computeInitialFillRange();
    // アンカーとして、初期選択ブロックの右下のセル（initialFillRange.maxRow, maxCol）を記録
    initialBottomRight = { row: initialFillRange.maxRow, col: initialFillRange.maxCol };
    document.addEventListener("mousemove", fillHandleMouseMove);
    document.addEventListener("mouseup", fillHandleMouseUp);
}

// ドラッグ中のmousemoveで範囲を更新（デルタ計算方式）
function fillHandleMouseMove(e) {
    if (!isFillDragging) return;

    // セルのサイズ（環境に合わせて調整または動的取得してください）
    const cellWidth = 120;  // px
    const cellHeight = 40;  // px

    // ① マウス下のセル要素を取得
    let targetElem = document.elementFromPoint(e.clientX, e.clientY);
    while (targetElem && targetElem.tagName !== "TD") {
        targetElem = targetElem.parentElement;
    }
    if (!targetElem) return;

    const targetRow = parseInt(targetElem.dataset.row, 10);
    const targetCol = parseInt(targetElem.dataset.col, 10);

    let newRange = null;

    // ② どちらのモードか判定：
    // 拡大モード：マウス下のセルの行・列が初期アンカー（initialBottomRight）のそれ以上なら拡大
    if (targetRow >= initialBottomRight.row && targetCol >= initialBottomRight.col) {
        newRange = {
            minRow: initialFillRange.minRow,
            minCol: initialFillRange.minCol,
            maxRow: targetRow,
            maxCol: targetCol
        };
    } else {
        // 縮小モード：マウス下のセルが初期アンカーの内側にあるとき
        // ここでは、フィルハンドルのDOM要素（初期アンカー）のウィンドウ上の位置から、
        // 現在のマウス位置との差分を計算し、それをセル数に変換して縮小分を求める。

        // フィルハンドル要素（アンカー）がある前提で、activeCell（あるいは初期アンカー側）のfill-handleを取得
        let fillHandleElem = fillDragStartCell.querySelector(".fill-handle");
        if (fillHandleElem) {
            let rect = fillHandleElem.getBoundingClientRect();

            // 横方向の縮小量
            let diffX = rect.right - e.clientX;  // マウスが左にどれだけ移動したか
            let shrinkCols = Math.round(diffX / cellWidth);
            // 新しい maxCol は、初期アンカーから縮小分だけ減算
            let newMaxCol = initialBottomRight.col - shrinkCols;
            if (newMaxCol < initialFillRange.minCol) newMaxCol = initialFillRange.minCol;

            // 縦方向の縮小量
            let diffY = rect.bottom - e.clientY; // マウスが上にどれだけ移動したか
            let shrinkRows = Math.round(diffY / cellHeight);
            let newMaxRow = initialBottomRight.row - shrinkRows;
            if (newMaxRow < initialFillRange.minRow) newMaxRow = initialFillRange.minRow;

            newRange = {
                minRow: initialFillRange.minRow,
                minCol: initialFillRange.minCol,
                maxRow: newMaxRow,
                maxCol: newMaxCol
            };
        } else {
            // 万が一フィルハンドルが取得できない場合は、単純に目標セルを基準にする
            newRange = {
                minRow: initialFillRange.minRow,
                minCol: initialFillRange.minCol,
                maxRow: targetRow,
                maxCol: targetCol
            };
        }
    }

    currentFillRange = newRange;

    // ③ 既存の一時ハイライト（fill-selected）の解除
    document.querySelectorAll("#spreadsheet tbody td.fill-selected").forEach(cell => {
        cell.classList.remove("fill-selected");
    });

    // ④ currentFillRange 内のセルに一時ハイライト（fill-selected）を付与
    for (let r = currentFillRange.minRow; r <= currentFillRange.maxRow; r++) {
        for (let c = currentFillRange.minCol; c <= currentFillRange.maxCol; c++) {
            const cell = getCell(r, c); // 既存の getCell(row, col) 関数を利用
            if (cell) {
                cell.classList.add("fill-selected");
            }
        }
    }
}

// ドラッグ終了時の処理：選択されたセルに値を反映＆selectedクラスを付与
function fillHandleMouseUp(e) {
    if (!isFillDragging) return;

    document.removeEventListener("mousemove", fillHandleMouseMove);
    document.removeEventListener("mouseup", fillHandleMouseUp);

    // 複製元の情報：ここでは activeCell（またはアンカーセルとしての fillDragStartCell ）の情報を取得
    // 表示テキストや数式情報、スタイルなどを含む
    const fillSource = activeCell; // もしくは fillDragStartCell

    // ① シート全体の既存の selected クラスを一旦解除してリセットする
    document.querySelectorAll("#spreadsheet tbody td.selected").forEach(cell => {
        cell.classList.remove("selected");
    });

    // ② currentFillRange (例: { minRow, maxRow, minCol, maxCol } ) 内の各セルを処理
    // ドラッグ終了時などでセルコピー処理を実行（例）
    for (let r = currentFillRange.minRow; r <= currentFillRange.maxRow; r++) {
        for (let c = currentFillRange.minCol; c <= currentFillRange.maxCol; c++) {
            const targetCell = getCell(r, c);
            if (targetCell) {
                cloneCellProperties(fillSource, targetCell);
                targetCell.classList.add("selected");
            }
        }
    }

    // すべてのセルへのコピーが完了した後に、数式の再計算を一括で実行
    updateAllFormulas();

    // ③ 一時ハイライト（fill-selected）の解除
    document.querySelectorAll("#spreadsheet tbody td.fill-selected").forEach(cell => {
        cell.classList.remove("fill-selected");
    });

    isFillDragging = false;
    currentFillRange = null;

    // 必要なら、選択セルの表示を更新する関数を呼ぶなど
    updateSelectedCellsDisplay();
}

/**
 * 数式内のすべてのセル参照をコピー元とコピー先のオフセットに合わせて変更する関数
 * (例：コピー元セルが A1 で、コピー先セルが B2 なら、参照 "A1" は "B2" に変換される)
 *
 * @param {string} formula - コピー元セルの数式。先頭は "=" がついている前提。
 * @param {number} rowOffset - コピー先セルとコピー元セルの行の差分（targetRow - sourceRow）
 * @param {number} colOffset - コピー先セルとコピー元セルの列の差分（targetCol - sourceCol）
 * @returns {string} 調整済みの数式文字列
 */
function adjustFormula(formula, rowOffset, colOffset) {
    const adjustedBody = formula.substring(1).replace(/([A-Z]+)(\d+)/g, function (match, colLetters, rowStr) {
        const origRow = parseInt(rowStr, 10);
        const origCol = columnLettersToIndex(colLetters); // 複数文字にも対応する関数
        const newRow = origRow + rowOffset;
        const newCol = origCol + colOffset;
        return getCellReferenceByCoord(newRow, newCol);
    });
    return "=" + adjustedBody;
}

/**
 * セルからセルへプロパティをクローンする関数。
 * ※ 数式が存在する場合、コピー先セルの位置に合わせてセル参照を調整します。
 * 　ユーザーが上書きした場合はハンドル側（handleCellBlur など）で dataset.formula を削除するため、
 * 　ここでは、コピー元に dataset.formula が存在し先頭が "=" なら常にコピー・調整することにします。
 */
function cloneCellProperties(sourceCell, targetCell) {
    targetCell.textContent = sourceCell.textContent;
    Object.entries(sourceCell.dataset).forEach(([key, val]) => {
        if (key !== 'row' && key !== 'col' && !key.startsWith("merge")) {
            targetCell.dataset[key] = val;
        }
    });
    if (sourceCell.dataset.formula?.startsWith("=")) {
        const srcRow = +sourceCell.dataset.row;
        const srcCol = +sourceCell.dataset.col;
        const tgtRow = +targetCell.dataset.row;
        const tgtCol = +targetCell.dataset.col;
        const rowOffset = tgtRow - srcRow;
        const colOffset = tgtCol - srcCol;
        targetCell.dataset.formula = adjustFormula(sourceCell.dataset.formula, rowOffset, colOffset);
    } else {
        delete targetCell.dataset.formula;
    }
    ["Top", "Right", "Bottom", "Left"].forEach(side => {
        const width = sourceCell.style[`border${side}Width`];
        const style = sourceCell.style[`border${side}Style`];
        const color = sourceCell.style[`border${side}Color`];
        if (width) targetCell.style[`border${side}Width`] = width;
        if (style) targetCell.style[`border${side}Style`] = style;
        if (color) targetCell.style[`border${side}Color`] = color;
    });
    const computed = window.getComputedStyle(sourceCell);
    const bgColor = computed.backgroundColor;
    targetCell.style.backgroundColor = (bgColor === "rgba(0, 0, 0, 0)" || bgColor === "transparent") ? "" : bgColor;
    [
        "color",
        "textAlign",
        "fontSize",
        "fontFamily",
        "fontStyle",
        "fontWeight",
        "verticalAlign",
        "textDecoration",
        "textShadow"
    ].forEach(prop => {
        targetCell.style[prop] = computed[prop];
    });
    targetCell.removeAttribute("contenteditable");
    targetCell.classList.remove("selected", "fill-selected");
}

// セルクリック時にアクティブセルを更新後、フィルハンドルの状態を更新
document.querySelector("#spreadsheet tbody").addEventListener("click", function (e) {
    if (e.target.tagName.toUpperCase() === "TD") {
        updateFillHandle();
    }
});
document.querySelector("#spreadsheet tbody").addEventListener("dblclick", function (e) {
    if (e.target.tagName.toUpperCase() === "TD") {
        updateFillHandle();
    }
});

document.addEventListener("mousemove", function (e) {
    // 範囲選択が終了したタイミング
    updateFillHandle();
});




/*********************
 * 数式の挿入機能
 *********************/

/**
 * 選択中 (selected クラスが付与された) のセルに対して、数式を挿入し、評価結果を表示する
 */
function insertFunctionIntoSelectedCells(formula) {
    if (formula[0] !== "=") {
        console.error("挿入する数式は '=' から始まる必要があります");
        return;
    }
    const selectedCells = document.querySelectorAll("td.selected");
    selectedCells.forEach(cell => {
        // セルに数式として保持（再評価時に利用できるよう dataset に記録）
        cell.dataset.formula = formula;
        // 数式を評価して表示
        const result = evaluateFormula(formula);
        cell.textContent = result;
        document.getElementById('formula-bar').value = formula;
    });
}

/**
 * ボタン押下時に呼ばれる関数
 * 渡された数式テンプレートをそのまま選択セルに挿入する
 */
function applyFormula(formula) {
    insertFunctionIntoSelectedCells(formula);
}


document.getElementById("merge-cells").addEventListener("click", mergeSelectedCells);
document.getElementById("unmerge-cells").addEventListener("click", unmergeSelectedCells);

/**
 * 選択状態のセルを結合する関数
 * ※ 選択セルは連続した矩形状でなければならない
 */
// 
function mergeSelectedCells() {
    const selectedCells = document.querySelectorAll("#spreadsheet tbody td.selected");
    if (selectedCells.length === 0) return;

    let rows = [];
    let cols = [];
    selectedCells.forEach(cell => {
        rows.push(parseInt(cell.dataset.row, 10));
        cols.push(parseInt(cell.dataset.col, 10));
    });
    const minRow = Math.min(...rows);
    const maxRow = Math.max(...rows);
    const minCol = Math.min(...cols);
    const maxCol = Math.max(...cols);

    const expectedCount = (maxRow - minRow + 1) * (maxCol - minCol + 1);

    // 単体セルの場合は結合しない
    if (expectedCount === 1) {
        alert("単体セルでは結合できません。");
        return;
    }

    if (selectedCells.length !== expectedCount) {
        alert("連続した矩形状のセルを選択してください。");
        return;
    } else {
        setTimeout(() => {
            updateAllFormulas();
        }, 0);
    }

    // 結合済みのセルが範囲内に存在していないか確認する
    for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
            const cell = getCell(r, c);
            if (cell && (cell.classList.contains("merged") ||
                cell.dataset.mergeMinRow ||
                cell.dataset.mergeAnchorRow)) {
                alert("既に結合されているセルが範囲内に含まれているため、結合できません。");
                return;
            }
        }
    }

    // 範囲内を行優先、列優先で走査して、値が入力されているセル（空でないセル）の最初の内容を取得する
    let anchorValue = "";
    let anchorFormula = ""; // 数式があれば保持するための変数
    let found = false;
    for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
            const cell = getCell(r, c);
            if (cell && cell.innerHTML.trim() !== "") {
                if (cell.dataset.formula && cell.dataset.formula.trim() !== "") {
                    // 数式が登録されている場合は、評価結果とともに数式そのものも保存する
                    anchorValue = evaluateFormula(cell.dataset.formula);
                    anchorFormula = cell.dataset.formula;
                } else {
                    anchorValue = cell.innerHTML;
                }
                found = true;
                break;
            }
        }
        if (found) break;
    }

    // アンカーセルは常に範囲の左上（minRow, minCol）とする
    const anchor = getCell(minRow, minCol);
    // 取得した値をアンカーにセットする
    anchor.innerHTML = anchorValue;
    // 数式が存在していた場合は、数式情報も保持する
    if (anchorFormula) {
        anchor.dataset.formula = anchorFormula;
    }
    anchor.setAttribute("rowspan", maxRow - minRow + 1);
    anchor.setAttribute("colspan", maxCol - minCol + 1);
    anchor.classList.add("merged");
    // 結合情報をアンカーに保持する
    anchor.dataset.mergeMinRow = minRow;
    anchor.dataset.mergeMaxRow = maxRow;
    anchor.dataset.mergeMinCol = minCol;
    anchor.dataset.mergeMaxCol = maxCol;

    // 結合範囲内のアンカー以外のセルは表示を解除し、内部データをクリアする
    for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
            // アンカーセルは除外
            if (r === minRow && c === minCol) continue;
            const cell = getCell(r, c);
            if (cell) {
                // セルの内容を削除
                cell.innerHTML = "";
                // dataset のうち data-row, data-col 以外すべて削除
                Object.keys(cell.dataset).forEach(key => {
                    if (key !== "row" && key !== "col") {
                        delete cell.dataset[key];
                    }
                });
                // スタイル属性をクリアし、非表示に設定
                cell.removeAttribute("style");
                cell.style.display = "none";
                // クラスもクリア
                cell.className = "";
                // 結合時のアンカー情報を付与
                cell.dataset.mergeAnchorRow = minRow;
                cell.dataset.mergeAnchorCol = minCol;
            }
        }
    }
}




/**
 * 選択状態（または activeCell が結合セル）のセルの結合を解除する関数
 * ※ 結合セルのアンカーとなっているセルを対象にします
 */
function unmergeSelectedCells() {
    // 選択セル全体を取得
    const selectedCells = Array.from(document.querySelectorAll("#spreadsheet tbody td.selected"));
    if (selectedCells.length === 0) {
        alert("結合解除するセルを選択してください。");
        return;
    }

    // 結合グループのアンカーを重複処理しないため、各アンカーの “row,col” キーを保持する Set
    const processedAnchorKeys = new Set();

    selectedCells.forEach(cell => {
        // まず、セルが結合状態か判定
        const rowSpanAttr = cell.getAttribute("rowspan");
        const colSpanAttr = cell.getAttribute("colspan");
        const rowSpan = rowSpanAttr ? parseInt(rowSpanAttr, 10) : 1;
        const colSpan = colSpanAttr ? parseInt(colSpanAttr, 10) : 1;
        const isMerged = (rowSpan > 1 || colSpan > 1) || (cell.dataset.mergeMinRow && cell.dataset.mergeMinCol);

        if (!isMerged) {
            // 結合状態でなければスキップ
            return;
        }

        // 結合セルの場合、まずアンカーセルを決定する。
        // 通常はアンカーには merged クラスが付いている（または mergeAnchor* 属性が無い）ので、
        // もし cell に mergeAnchorRow/mergeAnchorCol があれば、それはアンカー以外とみなしてアンカーを取得する
        let anchorCell = cell;
        if (!cell.classList.contains("merged") && cell.dataset.mergeAnchorRow && cell.dataset.mergeAnchorCol) {
            anchorCell = getCell(
                parseInt(cell.dataset.mergeAnchorRow, 10),
                parseInt(cell.dataset.mergeAnchorCol, 10)
            );
        }
        if (!anchorCell) return;

        // 重複処理を避けるため、キー（例: "5,3"）を使ってこのアンカーを一意に識別
        const anchorKey = anchorCell.dataset.row + "," + anchorCell.dataset.col;
        if (processedAnchorKeys.has(anchorKey)) {
            return;
        }
        processedAnchorKeys.add(anchorKey);

        // 結合範囲を取得する
        let minRow, maxRow, minCol, maxCol;
        if (
            anchorCell.dataset.mergeMinRow &&
            anchorCell.dataset.mergeMinCol &&
            anchorCell.dataset.mergeMaxRow &&
            anchorCell.dataset.mergeMaxCol
        ) {
            minRow = parseInt(anchorCell.dataset.mergeMinRow, 10);
            maxRow = parseInt(anchorCell.dataset.mergeMaxRow, 10);
            minCol = parseInt(anchorCell.dataset.mergeMinCol, 10);
            maxCol = parseInt(anchorCell.dataset.mergeMaxCol, 10);
        } else {
            // もし merge 情報が無い場合は、HTML 属性の rowspan/colspan から計算
            const baseRow = parseInt(anchorCell.dataset.row, 10);
            const baseCol = parseInt(anchorCell.dataset.col, 10);
            minRow = baseRow;
            minCol = baseCol;
            maxRow = baseRow + (rowSpan - 1);
            maxCol = baseCol + (colSpan - 1);
        }

        // アンカーセルの結合属性・データ・クラスを解除する
        anchorCell.removeAttribute("rowspan");
        anchorCell.removeAttribute("colspan");
        anchorCell.classList.remove("merged");
        delete anchorCell.dataset.mergeMinRow;
        delete anchorCell.dataset.mergeMaxRow;
        delete anchorCell.dataset.mergeMinCol;
        delete anchorCell.dataset.mergeMaxCol;
        delete anchorCell.dataset.mergeAnchorRow;
        delete anchorCell.dataset.mergeAnchorCol;

        // 結合範囲内の、アンカーセル以外のセルに対しても解除処理を実施
        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                // アンカーセルは除外
                if (r === minRow && c === minCol) continue;
                const otherCell = getCell(r, c);
                if (otherCell) {
                    otherCell.style.display = ""; // 元の表示状態に戻す
                    otherCell.classList.remove("merged-hidden");
                    // merge 関連のすべての data 属性を削除
                    delete otherCell.dataset.mergeAnchorRow;
                    delete otherCell.dataset.mergeAnchorCol;
                    delete otherCell.dataset.mergeMinRow;
                    delete otherCell.dataset.mergeMinCol;
                    delete otherCell.dataset.mergeMaxRow;
                    delete otherCell.dataset.mergeMaxCol;
                }
            }
        }
    });
    updateSelectedCellsDisplay();
    setupRowVisibilityObserver();
}

// グローバル変数：コピーされたセル群の詳細情報を保持
let clipboardData = null;
function copySelectedCells() {
    const selectedCells = Array.from(document.querySelectorAll("#spreadsheet tbody td.selected"));
    if (!selectedCells.length) return console.log("コピー対象のセルがありません。");
    const rows = selectedCells.map(cell => +cell.dataset.row);
    const cols = selectedCells.map(cell => +cell.dataset.col);
    const minRow = Math.min(...rows), maxRow = Math.max(...rows);
    const minCol = Math.min(...cols), maxCol = Math.max(...cols);
    const expectedCount = (maxRow - minRow + 1) * (maxCol - minCol + 1);
    const isContiguous = selectedCells.length === expectedCount;
    clipboardData = {
        startRow: minRow,
        startCol: minCol,
        data: isContiguous ? [] : selectedCells.map(cell => ({
            row: +cell.dataset.row,
            col: +cell.dataset.col,
            value: cell.textContent,
            formula: cell.dataset.formula || "",
            cssText: cell.getAttribute("style") || ""
        }))
    };
    if (isContiguous) {
        for (let r = minRow; r <= maxRow; r++) {
            const rowData = [];
            for (let c = minCol; c <= maxCol; c++) {
                const cell = getCell(r, c);
                rowData.push({
                    value: cell?.textContent || "",
                    formula: cell?.dataset.formula || "",
                    cssText: cell?.getAttribute("style") || ""
                });
            }
            clipboardData.data.push(rowData);
        }
    }
    console.log("コピー完了:", clipboardData);
}

// ===========================
// 詳細貼り付け処理：連続範囲に合わせたコピーの復元
// ===========================
// 新規関数：数式中のセル参照をオフセット分調整する関数
function adjustFormulaReferences(formula, rowDelta, colDelta) {
    // 正規表現で A1 や B2 などの参照を検出
    return formula.replace(/([A-Z]+)(\d+)/g, (match, colLetters, rowStr) => {
        const colIndex = columnLettersToIndex(colLetters);
        const newColIndex = colIndex + colDelta;
        const newColLetters = getColumnName(newColIndex);
        const newRow = parseInt(rowStr, 10) + rowDelta;
        return newColLetters + newRow;
    });
}

// 貼り付け処理の更新：数式中のセル参照を調整して貼り付ける
function pasteClipboardData() {
    if (!clipboardData) return console.log("貼り付け対象のデータがありません。");
    const selected = Array.from(document.querySelectorAll("#spreadsheet tbody td.selected"));
    let targetCell = activeCell;
    if (selected.length) {
        let minRow = Infinity, minCol = Infinity;
        for (const cell of selected) {
            const r = +cell.dataset.row, c = +cell.dataset.col;
            if (r < minRow) minRow = r;
            if (c < minCol) minCol = c;
        }
        targetCell = getCell(minRow, minCol) || activeCell;
    }
    const targetRow = +targetCell.dataset.row;
    const targetCol = +targetCell.dataset.col;
    const rowDelta = targetRow - clipboardData.startRow;
    const colDelta = targetCol - clipboardData.startCol;
    if (
        clipboardData.startRow !== null &&
        clipboardData.data.length === 1 &&
        clipboardData.data[0].length === 1 &&
        selected.length > 1
    ) {
        const cellData = clipboardData.data[0][0];
        const newFormula = cellData.formula ? adjustFormulaReferences(cellData.formula, rowDelta, colDelta) : "";
        for (const destCell of selected) {
            if (newFormula) {
                destCell.dataset.formula = newFormula;
                destCell.textContent = evaluateFormula(newFormula);
            } else {
                delete destCell.dataset.formula;
                destCell.textContent = cellData.value;
            }
            destCell.style.cssText = cellData.cssText;
        }
        updateAllFormulas();
        updateFillHandle();
        updateSelectedCellsDisplay();
        return;
    }
    if (Array.isArray(clipboardData.data[0])) {
        const numRows = clipboardData.data.length;
        const numCols = clipboardData.data[0].length;
        for (let r = 0; r < numRows; r++) {
            for (let c = 0; c < numCols; c++) {
                const destCell = getCell(targetRow + r, targetCol + c);
                if (!destCell) continue;
                const cellData = clipboardData.data[r][c];
                const newFormula = cellData.formula ? adjustFormulaReferences(cellData.formula, rowDelta, colDelta) : "";
                if (newFormula) {
                    destCell.dataset.formula = newFormula;
                    destCell.textContent = evaluateFormula(newFormula);
                } else {
                    delete destCell.dataset.formula;
                    destCell.textContent = cellData.value;
                }
                destCell.style.cssText = cellData.cssText;
            }
        }
    } else {
        for (const item of clipboardData.data) {
            const destRow = targetRow + (item.row - clipboardData.startRow);
            const destCol = targetCol + (item.col - clipboardData.startCol);
            const destCell = getCell(destRow, destCol);
            if (!destCell) continue;
            const newFormula = item.formula ? adjustFormulaReferences(item.formula, rowDelta, colDelta) : "";
            if (newFormula) {
                destCell.dataset.formula = newFormula;
                destCell.textContent = evaluateFormula(newFormula);
            } else {
                delete destCell.dataset.formula;
                destCell.textContent = item.value;
            }
            destCell.style.cssText = item.cssText;
        }
    }
    updateAllFormulas();
    updateFillHandle();
    updateSelectedCellsDisplay();
}

// ===========================
// キーボードイベント（Ctrl+C / Ctrl+V）およびツールバーでのボタン操作
// ===========================
document.addEventListener("keydown", function (e) {
    const cell = e.target;
    // cell.contentEditable が "true" でなければ条件成立する
    if (e.ctrlKey && cell.contentEditable !== "true") {
        if (e.key.toLowerCase() === 'c') {
            copySelectedCells();
            return;
        }
        if (e.key.toLowerCase() === 'v') {
            pasteClipboardData();
            return;
        }
    }
});

// ===== Undo / Redo のためのグローバル変数 =====
let undoHistory = [];
let redoHistory = [];

// ===== 連続操作を抑えるためのデバウンス処理 =====
let saveStateTimeout;

function debouncedSaveState(delay = 250) {  // 250ms 操作がなければ状態保存
    if (saveStateTimeout) {
        clearTimeout(saveStateTimeout);
    }
    saveStateTimeout = setTimeout(() => {
        saveState();
    }, delay);
}

/**
 * 保存状態を「DOM全体」ではなく、セルデータ（値、数式、スタイル、結合情報など）のみを
 * JSON 形式にして保存する関数です。
 */
function saveState() {
    // シート内のすべてのセル（例：tbody内のtd）から、必要な情報を抽出
    const cells = document.querySelectorAll("#spreadsheet tbody td");
    let savedCells = [];
    cells.forEach(cell => {
        // ここでは値があっても空でも保存しますが、条件を付ける場合は適宜調整してください
        savedCells.push({
            row: parseInt(cell.dataset.row, 10),
            col: parseInt(cell.dataset.col, 10),
            value: cell.textContent,
            formula: cell.dataset.formula || "",
            style: cell.getAttribute("style") || "",
            colspan: cell.getAttribute("colspan") || "1",
            rowspan: cell.getAttribute("rowspan") || "1"
        });
    });

    // 必要であれば、行の高さなども追加できますが、ここではセル情報のみ保存しています

    const state = {
        cells: savedCells
    };

    // 新たな操作の場合、Redo 履歴はクリア
    redoHistory = [];
    // JSON.stringify により文字列化して保存（undoHistory は配列として管理）
    undoHistory.push(JSON.stringify(state));

    console.log("State saved. UndoHistory length:", undoHistory.length);
}

function loadState(stateJSON) {
    const cells = JSON.parse(stateJSON).cells;
    for (const { row, col, value, formula, style, colspan, rowspan } of cells) {
        const cell = getCell(row, col);
        if (!cell) continue;
        if (value.trim()) {
            if (formula?.trim()) {
                cell.dataset.formula = formula;
                cell.textContent = evaluateFormula(formula);
            } else {
                delete cell.dataset.formula;
                cell.textContent = value;
            }
        } else {
            delete cell.dataset.formula;
            cell.textContent = "";
        }
        cell.style.cssText = style || "";
        setSpan(cell, "colspan", colspan);
        setSpan(cell, "rowspan", rowspan);
    }
    function setSpan(cell, attr, val) {
        const num = Number(val);
        num > 1 ? cell.setAttribute(attr, num) : cell.removeAttribute(attr);
    }
}

function undo() {
    if (undoHistory.length <= 1) return console.log("これ以上戻れません。");
    redoHistory.push(undoHistory.pop());
    loadState(undoHistory[undoHistory.length - 1]);
}

function redo() {
    if (!redoHistory.length) return console.log("これ以上進めません。");
    const state = redoHistory.pop();
    undoHistory.push(state);
    loadState(state);
}

// ===== キーボードショートカットのバインド =====
document.addEventListener("keydown", function (e) {
    // Ctrl+Zで Undo
    if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.stopImmediatePropagation();
        undo();
        return;
    }
    // Ctrl+Yで Redo
    if (e.ctrlKey && e.key.toLowerCase() === "y") {
        e.preventDefault();
        e.stopImmediatePropagation();
        redo();
        return;
    }

    if (e.ctrlKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        e.stopImmediatePropagation();
        saveSpreadsheetData();
        return;
    }

});

// ===== 状態保存のタイミング =====
// 例えば、セル編集完了（blur イベント）のタイミングで保存する例
document.addEventListener("blur", function (e) {
    if (e.target && e.target.tagName.toLowerCase() === "td") {
        debouncedSaveState();
    }
}, true);

function toPaddedBin(num, length) {
    const bin = num.toString(2);
    return "0".repeat(length - bin.length) + bin;
}

/***************** LZW 圧縮／解凍（コード配列版） *****************/
// 入力文字列を LZW で圧縮し、コードの配列を返す
function lzw_compress_array(uncompressed) {
    const dictionary = {};
    for (let i = 0; i < 256; i++) {
        dictionary[String.fromCharCode(i)] = i;
    }
    let phrase = "";
    const out = [];
    let code = 256;
    for (let i = 0; i < uncompressed.length; i++) {
        const currChar = uncompressed[i];
        const phrasePlusChar = phrase + currChar;
        if (dictionary.hasOwnProperty(phrasePlusChar)) {
            phrase = phrasePlusChar;
        } else {
            out.push(dictionary[phrase]);
            dictionary[phrasePlusChar] = code++;
            phrase = currChar;
        }
    }
    if (phrase !== "") {
        out.push(dictionary[phrase]);
    }
    return out;
}

// コード配列から元の文字列を LZW で復元
function lzw_decompress_array(codes) {
    const dictionary = {};
    for (let i = 0; i < 256; i++) {
        dictionary[i] = String.fromCharCode(i);
    }
    let old = codes[0];
    let phrase = dictionary[old];
    let out = phrase;
    let code = 256;
    for (let i = 1; i < codes.length; i++) {
        const currCode = codes[i];
        let curr;
        if (dictionary.hasOwnProperty(currCode)) {
            curr = dictionary[currCode];
        } else {
            curr = phrase + phrase[0];
        }
        out += curr;
        dictionary[code++] = phrase + curr[0];
        phrase = curr;
    }
    return out;
}

/***************** 高圧縮：LZW ＋ ビットパッキング *****************/
// compressData: 入力文字列（例：JSON）を圧縮し、1 つの文字列として出力する
function compressData(dataStr) {
    // Unicode 対応：入力文字列をまず URL エンコード（unescape/encodeURIComponent）して ASCII 化する
    const safeStr = unescape(encodeURIComponent(dataStr));

    // 1. LZW 圧縮：文字列をコード配列に変換
    const codes = lzw_compress_array(safeStr);

    // 2. 最小必要ビット幅の算出（初期辞書は 8 ビット分とする）
    let maxCode = 0;
    for (let i = 0; i < codes.length; i++) {
        if (codes[i] > maxCode) {
            maxCode = codes[i];
        }
    }
    const bitWidth = Math.max(8, Math.ceil(Math.log2(maxCode + 1)));
    const codeCount = codes.length;

    // 3. ヘッダー作成：先頭 8 ビットに bitWidth、次の 32 ビットにコード数 codeCount を記録
    const header = toPaddedBin(bitWidth, 8) + toPaddedBin(codeCount, 32);

    // 4. 各コードを固定ビット幅（bitWidth 桁）の 2 進数に変換し連結
    let bits = "";
    for (let i = 0; i < codes.length; i++) {
        bits += toPaddedBin(codes[i], bitWidth);
    }

    // 5. ヘッダーとコード部ビット列を連結
    const fullBitString = header + bits;

    // 6. 【16 ビット単位に詰める】：最終ビット列の長さが 16 の倍数になるよう右側を 0 埋め
    const padLength = (16 - (fullBitString.length % 16)) % 16;
    const paddedBitString = fullBitString + "0".repeat(padLength);

    // 7. 16 ビット毎に区切り、各 16 ビットを文字コードに変換して連結
    let compressed = "";
    for (let i = 0; i < paddedBitString.length; i += 16) {
        const chunk = paddedBitString.substring(i, i + 16);
        const charCode = parseInt(chunk, 2);
        compressed += String.fromCharCode(charCode);
    }
    return compressed;
}


// decompressData: 圧縮データ文字列を復元し、元の文字列（例：JSON）を返す
function decompressData(compressedStr) {
    let bitString = "";
    // 1. 16 ビット単位の文字列を 16 ビットの 2 進数文字列に展開
    for (let i = 0; i < compressedStr.length; i++) {
        let bits = compressedStr.charCodeAt(i).toString(2);
        bits = "0".repeat(16 - bits.length) + bits;
        bitString += bits;
    }

    // 2. ヘッダーから bitWidth（最初の 8 ビット）とコード数（次の 32 ビット）を読み出す
    const bitWidth = parseInt(bitString.substring(0, 8), 2);
    const codeCount = parseInt(bitString.substring(8, 40), 2);
    const codes = [];
    let index = 40; // ヘッダー分読み飛ばす
    for (let i = 0; i < codeCount; i++) {
        const codeBits = bitString.substring(index, index + bitWidth);
        const code = parseInt(codeBits, 2);
        codes.push(code);
        index += bitWidth;
    }

    // 3. LZW 復元：コード配列から元データの文字列を復元
    const decompressed = lzw_decompress_array(codes);
    // Unicode 対応：元の文字列に戻すため、escape/decodeURIComponent を適用
    return decodeURIComponent(escape(decompressed));
}

/***************** 配列形式・完全圧縮版 保存処理 *****************/
function saveSpreadsheetData() {
    loadingstate.textContent = "保存中...";
    setTimeout(() => {
        try {
            const savedCells = [];
            const mergeKeys = ["mergeAnchorRow", "mergeAnchorCol", "mergeMinRow", "mergeMinCol", "mergeMaxRow", "mergeMaxCol"];
            const mkShort = { mergeAnchorRow: 0, mergeAnchorCol: 1, mergeMinRow: 2, mergeMinCol: 3, mergeMaxRow: 4, mergeMaxCol: 5 };
            const DEFAULT_COLSPAN = 1, DEFAULT_ROWSPAN = 1;
            const DEFAULT_ROW_HEIGHT = "24px", DEFAULT_COL_WIDTH = "100px";

            const compressStyle = s => s ? s.replace(/\s*([:;])\s*/g, "$1").replace(/;$/, "") : "";

            document.querySelectorAll("#spreadsheet tbody td").forEach(cell => {
                const r = +cell.dataset.row, c = +cell.dataset.col;
                const arr = [r, c];
                const v = cell.hidden ? (cell.dataset.originalValue || "") : cell.textContent.trim();
                if (v) arr[2] = v;
                const f = (cell.dataset.formula || "").trim();
                if (f) arr[3] = f;
                const s = compressStyle(cell.getAttribute("style") || "");
                if (s) arr[4] = s;
                const cs = +cell.getAttribute("colspan") || DEFAULT_COLSPAN;
                if (cs !== DEFAULT_COLSPAN) arr[5] = cs;
                const rs = +cell.getAttribute("rowspan") || DEFAULT_ROWSPAN;
                if (rs !== DEFAULT_ROWSPAN) arr[6] = rs;
                mergeKeys.forEach((k, i) => { if (cell.dataset[k] != null) arr[7 + i] = cell.dataset[k]; });
                if (arr.length > 2) savedCells.push(arr);
            });

            const savedRows = Array.from(document.querySelectorAll("#spreadsheet tbody tr"))
                .map(tr => { const h = getComputedStyle(tr).height; return h === DEFAULT_ROW_HEIGHT ? null : [+tr.dataset.row, h]; }).filter(Boolean);

            const savedColumns = Array.from(document.querySelectorAll("#spreadsheet thead th"))
                .map((th, c) => { const w = getComputedStyle(th).width; return w === DEFAULT_COL_WIDTH ? null : [c, w]; }).filter(Boolean);

            const zoom = document.getElementById("zoom-slider")?.value || "100";

            const jsonStr = JSON.stringify([savedCells, savedRows, savedColumns, zoom]);
            localStorage.setItem("spreadsheetData", compressData(jsonStr));
            loadingstate.textContent = "保存しました。";
            updateLocalStorageUsage();
        } catch (err) {
            console.error("保存エラー:", err);
            loadingstate.textContent = "保存エラーが発生しました。";
        }
    }, 300);
}

function loadSpreadsheetData() {
    const savedStr = localStorage.getItem("spreadsheetData");
    if (!savedStr) return loadingstate.textContent = "データがありません";
    let data;
    try {
        data = JSON.parse(decompressData(savedStr));
        loadingstate.textContent = "読み込み中...";
    } catch {
        loadingstate.textContent = "データがありません";
        return;
    }
    const [cells, rows, columns, zoomVal] = data;
    const slider = document.getElementById("zoom-slider"),
        display = document.getElementById("zoom-display"),
        bar = document.getElementById("loading-progress-bar");
    if (slider && display && container) {
        const z = +(`${zoomVal}`.replace("%", "")) || 100;
        slider.value = z;
        display.textContent = z + "%";
        spreadsheetContent.style.zoom = z / 100;
    }
    const maxRow = Math.max(0, ...(cells || []).map(c => +c[0]));
    if (maxRow >= rowCount) loadRows(maxRow - rowCount + 1);
    (rows || []).forEach(r => getRow(r[0])?.style && (getRow(r[0]).style.height = r[1]));
    (columns || []).forEach(c => {
        const th = document.querySelector(`#spreadsheet thead th:nth-child(${c[0] + 1})`);
        if (th) th.style.width = c[1];
    });
    const mergeKeys = ["mergeAnchorRow", "mergeAnchorCol", "mergeMinRow", "mergeMinCol", "mergeMaxRow", "mergeMaxCol"];
    const batchSize = 1500;
    let index = 0, total = cells.length;
    // ① 全セル復元（数式は dataset にセットするだけ）
    function restoreCells() {
        const end = Math.min(index + batchSize, total);
        for (; index < end; index++) {
            const d = cells[index];
            const cell = getCell(d[0], d[1]);
            if (!cell) continue;
            if (d[5] > 1) cell.setAttribute("colspan", d[5]); else cell.removeAttribute("colspan");
            if (d[6] > 1) cell.setAttribute("rowspan", d[6]); else cell.removeAttribute("rowspan");
            if (d[3]) cell.dataset.formula = d[3];
            else { if (cell.textContent !== (d[2] ?? "")) cell.textContent = d[2] ?? ""; delete cell.dataset.formula; }
            if (cell.style.cssText !== d[4]) cell.style.cssText = d[4] || "";
            mergeKeys.forEach((k, i) => { if (d[7 + i] != null) cell.dataset[k] = d[7 + i]; else delete cell.dataset[k]; });
        }
        if (bar) bar.style.width = `${Math.min((index / total) * 100, 100)}%`;
        if (index < total) requestAnimationFrame(restoreCells);
        else evaluateAllFormulas();
    }
    // ② 全セル数式評価（依存関係対応）
    function evaluateAllFormulas() {
        setupRowVisibilityObserver();
        loadingstate.textContent = "読み込み完了";
        if (bar) bar.style.width = "0%";
        const all = Array.from(document.querySelectorAll("#spreadsheet tbody td"));
        // 簡易的に複数回評価することで下→上依存にも対応
        const maxPasses = 5;
        for (let pass = 0; pass < maxPasses; pass++) {
            all.forEach(td => {
                if (td.dataset.formula) {
                    try { td.textContent = evaluateFormula(td.dataset.formula); }
                    catch (e) { /* 依存セル未準備の場合は無視 */ }
                }
            });
        }
        all.forEach(td => td.classList.add("borderss"));
        requestAnimationFrame(() => all.forEach(td => td.classList.remove("borderss")));
    }
    if (total) restoreCells();
    else { setupRowVisibilityObserver(); loadingstate.textContent = "読み込み完了"; }
}

/* ----- ヘルパー関数 ----- */
function getRow(rowNumber) {
    return document.querySelector(`#spreadsheet tbody tr[data-row='${rowNumber}']`);
}

function debounce(fn, delay) {
    var timer;
    return function () {
        var args = arguments;
        clearTimeout(timer);
        timer = setTimeout(function () {
            fn.apply(null, args);
        }, delay);
    };
}

function throttle(fn, delay) {
    var last = 0;
    return function () {
        var now = Date.now();
        if (now - last >= delay) {
            last = now;
            fn.apply(null, arguments);
        }
    };
}

/* ----- 行可視化監視（完全即時反映・最軽量・横スクロール対応・初期ロード堅牢） ----- */
let rowObserver = null, visibleCols = [];
if (!container || !table) console.warn("spreadsheet-container または spreadsheet が見つかりません。");

/* 横方向で見えている列を計算（キャッシュ＆最小DOM計測） */
let _lastColCheck = 0, _cachedHeader = null, _cachedContainerRect = null;
const computeVisibleColumns = () => {
    const now = performance.now();
    if (now - _lastColCheck < 20) return; // 余分な再計算を防止
    _lastColCheck = now;

    _cachedContainerRect = container?.getBoundingClientRect?.();
    if (!_cachedContainerRect || !table) return;

    const h = _cachedHeader ||= table.querySelector("thead tr") || table.querySelector("tbody tr");
    if (!h) return (visibleCols = []);

    const cleft = _cachedContainerRect.left;
    const cright = _cachedContainerRect.right;
    const cells = h.children;
    const len = cells.length;
    if (visibleCols.length !== len) visibleCols = new Array(len);

    for (let i = 0; i < len; i++) {
        const r = cells[i].getBoundingClientRect();
        visibleCols[i] = !(r.right < cleft || r.left > cright);
    }
};

/* 行とセルの可視性を即時反映（差分のみ更新） */
const applyRowVisibility = (row, vis) => {
    const active = document.activeElement;
    const v = vis || row.contains(active);
    const rowVis = v ? "visible" : "hidden";
    if (row.style.visibility !== rowVis)
        row.style.visibility = rowVis;

    const cols = visibleCols;
    const cells = row.children;
    for (let i = 0, len = cells.length; i < len; i++) {
        const cell = cells[i];
        const show = ((cols[i] ?? true) && v) || cell.contains(active);
        const s = show ? "visible" : "hidden";
        if (cell.style.visibility !== s)
            cell.style.visibility = s;
    }
};

function setupRowVisibilityObserver() {
    if (!container || !table) return;
    rowObserver?.disconnect();
    rowObserver = new IntersectionObserver(entries => {
        computeVisibleColumns(); // 即時更新
        for (let i = 0; i < entries.length; i++) {
            const e = entries[i];
            const r = e.target;
            const v = e.isIntersecting || r.contains(document.activeElement);
            if (r.dataset.visible !== String(v)) {
                r.dataset.visible = String(v);
                applyRowVisibility(r, v); // 即時反映
            }
        }
    }, { root: container, threshold: 0 });
    const rows = table.querySelectorAll("tbody tr");
    for (let i = 0, len = rows.length; i < len; i++)
        rowObserver.observe(rows[i]);
    // ✅ ここで初期状態を即時反映
    updateVisibilityNow();
}
/* ----- 即時反映トリガ関数（手動実行用） ----- */
function updateVisibilityNow() {
    if (!container || !table) return;
    // 最新の横列可視状態を計算
    computeVisibleColumns();
    const rows = table.querySelectorAll("tbody tr");
    const containerRect = container.getBoundingClientRect();
    const top = containerRect.top;
    const bottom = containerRect.bottom;
    const active = document.activeElement;
    for (let i = 0, len = rows.length; i < len; i++) {
        const row = rows[i];
        const rect = row.getBoundingClientRect();
        // 行の可視判定
        const visible = !(rect.bottom < top || rect.top > bottom) || row.contains(active);
        row.dataset.visible = String(visible);
        // 行＋セルを即時反映
        applyRowVisibility(row, visible);
    }
}

/* 初期描画時に即座に反映 */
const markInitialRowVisibility = () => {
    _cachedContainerRect = container?.getBoundingClientRect?.();
    if (!_cachedContainerRect || !table) return;
    const active = document.activeElement;
    const rows = table.querySelectorAll("tbody tr");
    const top = _cachedContainerRect.top;
    const bottom = _cachedContainerRect.bottom;

    for (let i = 0, len = rows.length; i < len; i++) {
        const r = rows[i];
        const b = r.getBoundingClientRect();
        const v = !(b.bottom < top || b.top > bottom) || r.contains(active);
        r.dataset.visible = String(v);
        applyRowVisibility(r, v);
    }
};

/* 横スクロール時も即時反映 */
const onContainerScroll = () => {
    computeVisibleColumns();
    const rows = document.querySelectorAll("#spreadsheet tbody tr");
    const visCols = visibleCols;
    const active = document.activeElement;

    for (let i = 0, len = rows.length; i < len; i++) {
        const r = rows[i];
        const v = r.dataset.visible === "true" || r.contains(active);
        const cells = r.children;
        for (let j = 0, cLen = cells.length; j < cLen; j++) {
            const cell = cells[j];
            const show = ((visCols[j] ?? true) && v) || cell.contains(active);
            const s = show ? "visible" : "hidden";
            if (cell.style.visibility !== s)
                cell.style.visibility = s;
        }
    }
};

/* 初期化（完全同期・再初期化対応） */
function initVisibilityControllerRobust() {
    if (!container || !table)
        return document.readyState === "loading"
            ? document.addEventListener("DOMContentLoaded", initVisibilityControllerRobust, { once: true })
            : console.warn("initVisibilityControllerRobust: container/table 未検出。");

    computeVisibleColumns();
    markInitialRowVisibility();
    setupRowVisibilityObserver();

    const tbody = table.querySelector("tbody");
    if (tbody) {
        const mo = new MutationObserver(records => {
            for (let i = 0; i < records.length; i++) {
                if (records[i].addedNodes.length) {
                    computeVisibleColumns();
                    markInitialRowVisibility();
                    setupRowVisibilityObserver();
                    break;
                }
            }
        });
        mo.observe(tbody, { childList: true });
    }

    container.addEventListener("scroll", onContainerScroll, { passive: true });
    window.addEventListener("resize", () => {
        computeVisibleColumns();
        const rows = document.querySelectorAll("#spreadsheet tbody tr");
        for (let i = 0, len = rows.length; i < len; i++)
            applyRowVisibility(rows[i], rows[i].dataset.visible === "true");
    });
}

/* 実行 */
initVisibilityControllerRobust();

// =======================
// 高性能ズーム（最適化版・軽量化）
// =======================

const zoomSlider = document.getElementById("zoom-slider");
const zoomDisplay = document.getElementById("zoom-display");

const MIN_ZOOM = 20, MAX_ZOOM = 200;
const ZOOM_STEP = 5; // スライダー・ホイール・ピンチ共通刻み

let savedData = { zoom: "100%" };
let zoomValue = parseInt(savedData.zoom) || 100;       // 内部丸め済み値
let pendingZoomValue = zoomValue;                      // 操作中の連続値

// スライダー初期化
zoomSlider.value = zoomValue;
zoomDisplay.textContent = zoomValue + "%";
spreadsheetContent.style.zoom = zoomValue / 100;

// ---------------- rAF でまとめて DOM 更新 ----------------
let pendingZoomUpdate = false;
let visibilityUpdateTimeout = null;

function applyZoom() {
    if (pendingZoomUpdate) return;
    pendingZoomUpdate = true;

    requestAnimationFrame(() => {
        const displayZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(pendingZoomValue / ZOOM_STEP) * ZOOM_STEP));
        spreadsheetContent.style.zoom = displayZoom / 100;
        zoomDisplay.textContent = displayZoom + "%";
        zoomSlider.value = displayZoom;
        zoomValue = displayZoom;

        // 🔹 ズーム後の可視セル更新はデバウンス
        if (visibilityUpdateTimeout) clearTimeout(visibilityUpdateTimeout);
        visibilityUpdateTimeout = setTimeout(() => {
            document.querySelectorAll("#spreadsheet tbody tr").forEach(setupRowVisibilityObserver);
            visibilityUpdateTimeout = null;
        }, 100); // 100ms ディレイでまとめる

        pendingZoomUpdate = false;
    });
}

// ---------------- スライダー ----------------
zoomSlider.addEventListener("input", () => {
    pendingZoomValue = parseInt(zoomSlider.value);
    applyZoom();
});

// ---------------- Ctrl + ホイール ----------------
document.addEventListener("wheel", (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const step = (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
    pendingZoomValue = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pendingZoomValue + step));
    applyZoom();
}, { passive: false });

// ---------------- ピンチ ----------------
let isPinching = false;
let initialPinchDistance = null;
let initialPinchZoom = null;

const pinchSensitivity = 0.03;
const pinchMinRatioChange = 0.005; // デッドゾーン拡大
const pinchMinPxChange = 2;

document.addEventListener("touchstart", (e) => {
    if (e.touches.length === 2) {
        isPinching = true;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        initialPinchDistance = Math.sqrt(dx * dx + dy * dy);
        initialPinchZoom = pendingZoomValue; // 現在の連続値を基準
    }
}, { passive: true });

document.addEventListener("touchmove", (e) => {
    if (!isPinching || e.touches.length !== 2) return;
    e.preventDefault();

    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (!initialPinchDistance || initialPinchDistance <= 0) return;

    const ratio = distance / initialPinchDistance;
    if (Math.abs(ratio - 1) < pinchMinRatioChange && Math.abs(distance - initialPinchDistance) < pinchMinPxChange) return;

    // 非線形補正（穏やかに拡大縮小）
    pendingZoomValue = initialPinchZoom * Math.pow(ratio, pinchSensitivity);
    applyZoom();
}, { passive: false });

function endPinch() {
    isPinching = false;
    initialPinchDistance = null;
    initialPinchZoom = null;
}
document.addEventListener("touchend", (e) => { if (e.touches.length < 2) endPinch(); }, { passive: true });
document.addEventListener("touchcancel", endPinch, { passive: true });


// localStorage の使用量（バイト単位）を計算する関数（UTF-16：1文字＝2バイトと概算）
function getLocalStorageUsage() {
    let total = 0;
    for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
            total += (key.length + localStorage.getItem(key).length) * 2;
        }
    }
    return total;
}

// バイト数を分かりやすい単位に変換する関数
function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " bytes";
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    else return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

// localStorage の総容量・使用量・残り容量をそれぞれ更新する関数
function updateLocalStorageUsage() {
    const MAX = 5 * 1024 * 1024;
    const used = getLocalStorageUsage();
    const rem = MAX - used;
    const elems = {
        localStorageTotal: `全体容量: ${formatBytes(MAX)}`,
        localStorageUsed: `使用量: ${formatBytes(used)}`,
        localStorageRemaining: `残り容量: ${formatBytes(rem)}`
    };
    for (const id in elems) {
        const el = document.getElementById(id);
        if (el) el.textContent = elems[id];
    }
}

// ページ読み込み時に更新（必要に応じて保存後にも呼び出してください）
document.addEventListener("DOMContentLoaded", updateLocalStorageUsage);

// ページ読み込み時に保存データを自動的に読み込む
window.addEventListener("load", function () {
    loadSpreadsheetData();
});

// -------------------------
// 初期状態の生成：列・行ともに
// -------------------------
initializeColumns(INITIAL_COLUMNS);
loadRows(INITIAL_ROWS);

// プルダウンボタン

document.querySelectorAll(".pulldown_btn").forEach(pulldown => {
    pulldown.addEventListener("mousedown", function (e) {
        document.querySelectorAll(".pulldown_menu").forEach(pulldown_menu => {
            pulldown_menu.style.display = "none";
        })
        const pulldown_menu = pulldown.closest(".pulldown_menu_parent").children[1];
        if (pulldown_menu.style.display == "block") {
            pulldown_menu.style.display = "none";
        } else {
            pulldown_menu.style.display = "block";
        }

    })
});