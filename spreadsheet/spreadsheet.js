// =======================
// Block 1: 設定関連
// =======================
const INITIAL_ROWS = 30;
const ROW_BATCH = 5;
const INITIAL_COLUMNS = 30;  // 初期列数
const COLUMN_BATCH = 5;

const container = document.getElementById("spreadsheet-container");
const table = document.getElementById("spreadsheet");
const theadRow = table.querySelector("thead tr");
const tbody = table.querySelector("tbody");
const formulaBarInput = document.getElementById("formula-bar");
const loadingstate = document.getElementById("loadingstate")

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
    if (document.activeElement === formulaBarInput) {
        formulaBarInput.value += ref;
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

// 改善版 loadColumns(count)
// ヘッダー行（thead）の更新と tbody の各行へのセル追加を DocumentFragment で一括追加
function loadColumns(count) {
    // ヘッダー領域に新規の<th>（列番号）を一括追加
    const headerFragment = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
        const colIndex = currentColumns;
        const th = document.createElement("th");
        th.textContent = getColumnName(colIndex);
        th.className = "col_number";
        headerFragment.appendChild(th);
        currentColumns++;
    }
    theadRow.appendChild(headerFragment);

    // tbody の各行（既存の行）に対して、新規セル（td）を一括追加
    // ※ tbody.rows はライブコレクションなので Array.from() で固定した配列に変換
    const rows = Array.from(tbody.rows);
    rows.forEach((row) => {
        // 行番号は先頭セル（th）に記載されているとする
        const rowNumber = parseInt(row.cells[0].textContent, 10);
        const cellFragment = document.createDocumentFragment();
        // 今回追加すべきセルの列番号は currentColumns - count ～ currentColumns - 1
        for (let j = 0; j < count; j++) {
            const colIndex = currentColumns - count + j;
            const td = createCell(rowNumber, colIndex);
            cellFragment.appendChild(td);
        }
        row.appendChild(cellFragment);
    });
}


// 改善版 loadRows(count)
// 新規行（tr）の生成も DocumentFragment を利用して一括で tbody に追加
function loadRows(count) {
    const rowFragment = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
        const tr = document.createElement("tr");
        // 先頭セルとして行番号を示す th を作成
        const th = document.createElement("th");
        th.textContent = rowCount;
        th.className = "row_number";
        tr.appendChild(th);
        // 現在の列数 (currentColumns) 分、各セル (td) を作成して追加
        for (let col = 0; col < currentColumns; col++) {
            const td = createCell(rowCount, col);
            tr.appendChild(td);
        }
        rowFragment.appendChild(tr);
        rowCount++;
    }
    tbody.appendChild(rowFragment);
}


// 既存の createCell 関数（イベント登録部分は削除）
function createCell(row, col) {
    const td = document.createElement("td");
    td.contentEditable = "false";
    td.dataset.row = row;
    td.dataset.col = col;
    // 各セルへの個別イベント登録は削除
    return td;
}

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

function handleCellDblClick(e) {
    const cell = e.target;
    cell.contentEditable = "true";

    // ダブルクリックで編集モードに入ったことを示すフラグをセットする
    cell.dataset.editBy = "dblclick";

    // 数式が設定されている場合は、セル内に元の数式を表示し、計算対象範囲をハイライトする
    if (cell.dataset.formula) {
        cell.textContent = cell.dataset.formula;
        highlightCalculationRange(cell.dataset.formula);
    }

    cell.focus();
    activeCell = cell;
    formulaBarInput.value = cell.dataset.formula ? cell.dataset.formula : cell.textContent;

    // 必要に応じてキャレット位置の調整
    setTimeout(() => {
        setCaretToEnd(cell);
    }, 0);
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



function handleCellKeyDown(e) {
    if (e.key === "Enter" && e.target.isContentEditable) {
        if (e.altKey) {
            e.preventDefault();
            // 改行文字 "\n" をテキストとして挿入する
            document.execCommand('insertText', false, "\n");
            return;
        }
        // Alt なしの Enter キーの場合は編集終了して次のセルに移動
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


function getCell(row, col) {
    if (col >= currentColumns) {
        loadColumns(col - currentColumns + 1);
    }
    if (row > rowCount) {
        loadRows(row - rowCount);
    }
    const rowIndex = row - 1;
    if (rowIndex < 0 || rowIndex >= tbody.rows.length) return null;
    const cells = tbody.rows[rowIndex].cells;
    if (col < 0 || col >= currentColumns) return null;
    // cells[0] はヘッダーなので、実データセルは cells[col+1]
    return cells[col + 1];
}

// =======================
// Block 6: 数式評価および自動再計算
// =======================

/*********************
* 数式で利用できるグローバル関数群
*********************/

// 以下の関数は、eval() 内で呼ばれるためグローバル関数（またはwindowオブジェクト上にある）として定義します。

function flattenArray(arr) {
    return arr.reduce((acc, val) => {
        return acc.concat(Array.isArray(val) ? flattenArray(val) : val);
    }, []);
}

function SUM() {
    let args = Array.from(arguments);
    if (args.length === 1 && Array.isArray(args[0])) {
        args = args[0];
    }
    const flat = flattenArray(args);
    const nums = flat.map(v => Number(v)).filter(v => !isNaN(v));
    return nums.reduce((a, b) => a + b, 0);
}
function AVERAGE() {
    const flat = flattenArray(Array.from(arguments));
    const nums = flat.map(v => parseFloat(v)).filter(v => !isNaN(v));
    if (nums.length === 0) return "#DIV/0!";
    return nums.reduce((a, b) => a + b, 0) / nums.length;
}
function MIN() {
    const flat = flattenArray(Array.from(arguments));
    const nums = flat.map(v => parseFloat(v)).filter(v => !isNaN(v));
    return Math.min(...nums);
}
function MAX() {
    const flat = flattenArray(Array.from(arguments));
    const nums = flat.map(v => parseFloat(v)).filter(v => !isNaN(v));
    return Math.max(...nums);
}
function IF(condition, trueValue, falseValue) {
    if (typeof condition === "string") {
        condition = condition.trim().toUpperCase() === "TRUE";
    }
    return condition ? trueValue : falseValue;
}
function COUNT() {
    const flat = flattenArray(Array.from(arguments));
    return flat.filter(x => !isNaN(Number(x))).length;
}
function PRODUCT() {
    const flat = flattenArray(Array.from(arguments));
    return flat.reduce((acc, v) => acc * Number(v), 1);
}
function SUBTRACT(a, b) { return Number(a) - Number(b); }
function ADD(a, b) { return Number(a) + Number(b); }
function DIVIDE(a, b) { return Number(b) !== 0 ? Number(a) / Number(b) : "#DIV/0!"; }
function POWER(a, b) { return Math.pow(Number(a), Number(b)); }
function SQRT(a) { return Math.sqrt(Number(a)); }
function MOD(a, b) { return Number(a) % Number(b); }
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
// 日付関連のグローバル関数
// -----------------------

// 指定した年、月、日のDateオブジェクトを返す（ExcelのDATE関数のように）
function DATE(year, month, day) {
    return new Date(year, month - 1, day);
}

// 現在の日付（時刻は切り捨てられる）
function TODAY() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// Dateオブジェクトまたは日付文字列から「年」を抽出
function YEAR(dateInput) {
    return new Date(dateInput).getFullYear();
}

// Dateオブジェクトまたは日付文字列から「月」を抽出（1～12）
function MONTH(dateInput) {
    return new Date(dateInput).getMonth() + 1;
}

// Dateオブジェクトまたは日付文字列から「日」を抽出
function DAY(dateInput) {
    return new Date(dateInput).getDate();
}

// 日付文字列（例："1/2" または "1/2/2020"）をタイムスタンプに変換する
function DATEVALUE(dateString) {
    const parts = dateString.split("/");
    if (parts.length === 2) {
        const now = new Date();
        const year = now.getFullYear();
        const month = parseInt(parts[0], 10);
        const day = parseInt(parts[1], 10);
        return new Date(year, month - 1, day).getTime();
    } else if (parts.length === 3) {
        const month = parseInt(parts[0], 10);
        const day = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        return new Date(year, month - 1, day).getTime();
    }
    return "#VALUE!";
}

// 入力が "1/2" や "1/2/2020" のような日付形式かを判定する関数
function isDateFormat(str) {
    return /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(str);
}

// Dateオブジェクトを "yyyy/mm/dd" 形式に整形して返す関数
function formatDate(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}/${month}/${day}`;
}

/*********************
 * 追加の日付関連グローバル関数
 *********************/

// 現在の日時を返す (NOW: 日付と時刻)
function NOW() {
    return new Date();
}

// Dateオブジェクトまたは日付文字列から「時」を抽出 (0～23)
function HOUR(dateInput) {
    return new Date(dateInput).getHours();
}

// Dateオブジェクトまたは日付文字列から「分」を抽出 (0～59)
function MINUTE(dateInput) {
    return new Date(dateInput).getMinutes();
}

// Dateオブジェクトまたは日付文字列から「秒」を抽出 (0～59)
function SECOND(dateInput) {
    return new Date(dateInput).getSeconds();
}

// 指定した日付の曜日を返す (1＝日曜日 ～ 7＝土曜日)
// Excelの場合、WEEKDAY はオプションで開始曜日を変更可能ですが、ここでは日曜始まりとしています。
function WEEKDAY(dateInput) {
    return new Date(dateInput).getDay() + 1;
}

// 指定した日付から、指定された月数を加算した日付を返す (EDATE)
function EDATE(dateInput, months) {
    const date = new Date(dateInput);
    date.setMonth(date.getMonth() + Number(months));
    return date;
}

// 指定した2つの日付の間の日数、月数、または年数の差を返す (DATEDIF)
// unit: "D"/"DAY" で日数、「M"/"MONTH" で月数、「Y"/"YEAR" で年数をそれぞれ返します。
// ※ 月数や年数は平均値での概算となります
function DATEDIF(startDate, endDate, unit) {
    const d1 = new Date(startDate);
    const d2 = new Date(endDate);
    const diff = d2.getTime() - d1.getTime();
    switch (String(unit).toLowerCase()) {
        case "d":
        case "day":
        case "days":
            return diff / (1000 * 60 * 60 * 24);
        case "m":
        case "month":
        case "months":
            return diff / (1000 * 60 * 60 * 24 * 30.436875); // 平均月の日数
        case "y":
        case "year":
        case "years":
            return diff / (1000 * 60 * 60 * 24 * 365.2425); // 平均年の日数
        default:
            return diff; // 単位未指定の場合、ミリ秒単位で返す
    }
}

// 指定された時、分、秒からその日の時刻を表す Dateを返す (TIME)
// ※ 現在の日付に対して指定した時刻で Dateオブジェクトを生成します。
function TIME(hour, minute, second) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, second);
}

// 時刻文字列 (例: "14:30" や "09:15:30") を、1日の中での経過日数（0～1の小数値）に変換する関数 (TIMEVALUE)
// Excel では、TIMEVALUE は 1日の比率として扱われます。
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



/*********************
 * 数式の評価エンジン
 *********************/

// ───── 数式評価関数 ─────
// セル内のテキストが数式の場合は再評価して数値リテラルとして返すヘルパー関数
function getCellEvaluatedValue(cell) {
    let content = cell.textContent.trim();
    if (content.charAt(0) === "=") {
        // 再帰的に評価（無限再帰に注意。循環参照対策は別途必要）
        let evaluated = evaluateFormula(content);
        return Number(evaluated);
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
    // ここで conditionPart 内の、単独の "="（比較用）を "==" に変換します。
    // できるだけ既に >=,<=,!=,== といった演算子には影響しないようにするため、正規表現で処理します。
    // ※ 環境によっては negative lookbehind が使えない場合もあるので、ここでは modern な JS と仮定します。
    let newCondition = conditionPart.replace(/(?<![<>=!])=(?![=])/g, "==");
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
function evaluateFormula(formula) {
    if (!formula) return formula;
    // 単体の "=" の場合は、そのまま "=" を返す
    if (formula === "=") return "=";
    // 数式は "=" で始まる必要がある
    if (formula[0] !== "=") return formula;

    // 先頭の "=" を除去
    let expr = formula.substring(1).trim();
    if (expr === "") return "=";

    // IF 関数の場合、条件部の "=" を "==" に変換する前処理を行う
    if (expr.toUpperCase().startsWith("IF(")) {
        expr = preprocessIFFormula(expr);
    }

    // ① 範囲参照の置換（例："A1:B2" → 配列リテラル "[10,20,...]"）
    expr = expr.replace(/([A-Z]+\d+:[A-Z]+\d+)/g, function (match) {
        const parts = match.split(":");
        if (parts.length === 2) {
            const startMatch = parts[0].match(/([A-Z]+)(\d+)/);
            const endMatch = parts[1].match(/([A-Z]+)(\d+)/);
            if (startMatch && endMatch) {
                const startCol = columnLettersToIndex(startMatch[1]);
                const startRow = parseInt(startMatch[2], 10);
                const endCol = columnLettersToIndex(endMatch[1]);
                const endRow = parseInt(endMatch[2], 10);
                let values = [];
                for (let r = startRow; r <= endRow; r++) {
                    for (let c = startCol; c <= endCol; c++) {
                        const cell = getCell(r, c);
                        if (cell) {
                            let cellVal = getCellEvaluatedValue(cell);
                            if (!isNaN(cellVal)) {
                                values.push(cellVal);
                            }
                        }
                    }
                }
                return "[" + values.join(",") + "]";
            }
        }
        return match;
    });

    // ② 単一セル参照の置換（例："A1" → 数値リテラル）
    expr = expr.replace(/([A-Z]+)(\d+)/g, function (match, colLetters, rowStr) {
        const colIndex = columnLettersToIndex(colLetters);
        const rowNumber = parseInt(rowStr, 10);
        const refCell = getCell(rowNumber, colIndex);
        if (refCell) {
            let cellVal = getCellEvaluatedValue(refCell);
            return (!isNaN(cellVal)) ? cellVal : 0;
        }
        return 0;
    });

    try {
        let result = eval(expr);
        // 結果が関数オブジェクトの場合、ソースコードが表示されないよう空文字を返す
        if (typeof result === "function") {
            return "";
        }
        return result;
    } catch (e) {
        return "Error: " + e.message;
    }
}



function columnLettersToIndex(letters) {
    let index = 0;
    for (let i = 0; i < letters.length; i++) {
        index = index * 26 + (letters.charCodeAt(i) - 64);
    }
    return index - 1;
}

function updateAllFormulas() {
    const formulaCells = document.querySelectorAll("#spreadsheet tbody td[data-formula]");
    formulaCells.forEach(cell => {
        // 編集中のセルは更新しない
        if (document.activeElement !== cell) {
            const formula = cell.dataset.formula;
            cell.textContent = evaluateFormula(formula);
        }
    });
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

    const minRow = Math.min(selectionStart.row, selectionEnd.row);
    const maxRow = Math.max(selectionStart.row, selectionEnd.row);
    const minCol = Math.min(selectionStart.col, selectionEnd.col);
    const maxCol = Math.max(selectionStart.col, selectionEnd.col);

    if (isInFormulaEdit()) {
        // 数式編集中の場合は、アウトラインで範囲をハイライトする
        let rangeRef = "";
        if (minRow === maxRow && minCol === maxCol) {
            rangeRef = getCellReferenceByCoord(minRow, minCol);
        } else {
            rangeRef = getCellReferenceByCoord(minRow, minCol) + ":" + getCellReferenceByCoord(maxRow, maxCol);
        }
        // 既存の計算範囲ハイライトをクリアして、新たに適用
        clearCalculationRangeHighlights();
        highlightCalculationRange(rangeRef);

        // 通常の選択用の selected クラスはすべて外すが、
        // 値を求めたいセル（activeCell）は常に selected 状態にする
        const cells = document.querySelectorAll("#spreadsheet tbody td");
        cells.forEach(cell => cell.classList.remove("selected"));
        if (activeCell) {
            activeCell.classList.add("selected");
        }
    } else {
        // 非数式編集時は、通常のようにドラッグで選択したセルに selected クラスを付与
        const cells = document.querySelectorAll("#spreadsheet tbody td");
        cells.forEach(cell => {
            const r = parseInt(cell.dataset.row, 10);
            const c = parseInt(cell.dataset.col, 10);
            if (r >= minRow && r <= maxRow && c >= minCol && c <= maxCol) {
                cell.classList.add("selected");
                activeCell.contentEditable = "false";
            } else {
                cell.classList.remove("selected");
            }
        });
    }
}


function clearSelection() {
    const cells = document.querySelectorAll("#spreadsheet tbody td");
    cells.forEach(cell => cell.classList.remove("selected"));
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
    }
});

formulaBarInput.addEventListener("blur", function (e) {
    if (activeCell) {
        const value = formulaBarInput.value.trim();
        applyValueToCells(value);
    }
});
// =======================
// Block 9: スクロール時の動的行／列追加
// =======================

container.addEventListener("scroll", function () {
    if (container.scrollTop + container.clientHeight >= container.scrollHeight - 50) {
        loadRows(ROW_BATCH);
    }
    if (container.scrollLeft + container.clientWidth >= container.scrollWidth - 50) {
        loadColumns(COLUMN_BATCH);
    }
});
// =======================
// Block 10: フォーマットツールバーのイベント処理
// =======================

// 10-1. Text Alignment
// 10-1. Text Alignment (ボタン版)
const textAlignmentButtons = document.querySelectorAll('#text-alignment-buttons button');

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

    // activeCell が未設定なら、document.activeElement が <TD> なら設定する
    let currentCell = activeCell;
    if (!currentCell && document.activeElement && document.activeElement.tagName === "TD") {
        currentCell = document.activeElement;
        activeCell = currentCell;
    }
    if (!currentCell) return;

    // 編集中ならフォーカス解除
    if (document.activeElement.isContentEditable) {
        document.activeElement.blur();
    }

    // 初回 keydown 時にすぐ移動処理を実行
    doMove(e);

    // 矢印キーについては、キー長押し時に連続移動・スクロールを実行
    if (arrowKeys.includes(e.key)) {
        if (!navigationInterval) {
            navigationInterval = setInterval(() => {
                doMove(e);
            }, 100);  // 100ms毎に処理（この数値は固定。矢印キーリピートはそのままで調整不要）
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
    const container = document.getElementById("spreadsheet-container");
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
// 選択されたセルの中から、選択範囲の最小／最大の行・列を算出し、
// その外側にのみ「2px solid black」の枠線を適用します。
function applyOuterBorder() {
    const selectedCells = document.querySelectorAll("#spreadsheet tbody td.selected");
    if (selectedCells.length === 0) return;

    let minRow = Infinity, maxRow = -Infinity, minCol = Infinity, maxCol = -Infinity;
    selectedCells.forEach(cell => {
        const row = parseInt(cell.dataset.row, 10);
        const col = parseInt(cell.dataset.col, 10);
        if (row < minRow) minRow = row;
        if (row > maxRow) maxRow = row;
        if (col < minCol) minCol = col;
        if (col > maxCol) maxCol = col;
    });

    selectedCells.forEach(cell => {
        const row = parseInt(cell.dataset.row, 10);
        const col = parseInt(cell.dataset.col, 10);
        if (row === minRow) {
            cell.style.borderTop = "3.5px solid black";
        }
        if (row === maxRow) {
            cell.style.borderBottom = "3.5px solid black";
        }
        if (col === minCol) {
            cell.style.borderLeft = "3.5px solid black";
        }
        if (col === maxCol) {
            cell.style.borderRight = "3.5px solid black";
        }
    });
}

// 選択範囲の上側（最小行側）のセルに上掛線を適用
function applyTopBorder() {
    const selectedCells = document.querySelectorAll("#spreadsheet tbody td.selected");
    if (selectedCells.length === 0) return;

    let minRow = Infinity;
    selectedCells.forEach(cell => {
        const row = parseInt(cell.dataset.row, 10);
        if (row < minRow) {
            minRow = row;
        }
    });
    selectedCells.forEach(cell => {
        const row = parseInt(cell.dataset.row, 10);
        if (row === minRow) {
            cell.style.borderTop = "3.5px solid black";
        }
    });
}

// 選択範囲の下側（最大行側）のセルに下掛線を適用
function applyBottomBorder() {
    const selectedCells = document.querySelectorAll("#spreadsheet tbody td.selected");
    if (selectedCells.length === 0) return;

    let maxRow = -Infinity;
    selectedCells.forEach(cell => {
        const row = parseInt(cell.dataset.row, 10);
        if (row > maxRow) {
            maxRow = row;
        }
    });
    selectedCells.forEach(cell => {
        const row = parseInt(cell.dataset.row, 10);
        if (row === maxRow) {
            cell.style.borderBottom = "3.5px solid black";
        }
    });
}

// 選択範囲の左側（最小列側）のセルに左掛線を適用
function applyLeftBorder() {
    const selectedCells = document.querySelectorAll("#spreadsheet tbody td.selected");
    if (selectedCells.length === 0) return;

    let minCol = Infinity;
    selectedCells.forEach(cell => {
        const col = parseInt(cell.dataset.col, 10);
        if (col < minCol) {
            minCol = col;
        }
    });
    selectedCells.forEach(cell => {
        const col = parseInt(cell.dataset.col, 10);
        if (col === minCol) {
            cell.style.borderLeft = "3.5px solid black";
        }
    });
}

// 選択範囲の右側（最大列側）のセルに右掛線を適用
function applyRightBorder() {
    const selectedCells = document.querySelectorAll("#spreadsheet tbody td.selected");
    if (selectedCells.length === 0) return;

    let maxCol = -Infinity;
    selectedCells.forEach(cell => {
        const col = parseInt(cell.dataset.col, 10);
        if (col > maxCol) {
            maxCol = col;
        }
    });
    selectedCells.forEach(cell => {
        const col = parseInt(cell.dataset.col, 10);
        if (col === maxCol) {
            cell.style.borderRight = "3.5px solid black";
        }
    });
}

// 【各セル枠適用】
// 選択されたセルすべてに対して、各セルの4辺に「2px solid black」の枠線を適用します。
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




// A:0, B:1, ...
function colLetterToIndex(letter) {
    return letter.charCodeAt(0) - "A".charCodeAt(0);
}

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
    // まず前回のハイライトをクリア
    clearCalculationRangeHighlights();

    // カラーパレットの定義（お好みの色に変更してください）
    const palette = [
        "blue",           // 青
        "red",            // 赤
        "yellowgreen",    // 黄緑
        "purple",         // 紫
        "yellow",         // 黄色
        "blueviolet",     // 青紫
        "mediumvioletred" // 赤紫
    ];

    // 数式全体をグループ分けする処理
    let groups = [];
    if (formula.indexOf(",") !== -1) {
        // カンマがある場合は、カンマで分割してグループとみなす
        groups = formula.split(",").map(s => s.trim()).filter(s => s.length > 0);
    } else {
        // カンマが無い場合は、正規表現でユニークなセル参照／範囲指定を抽出して、それぞれをグループとみなす
        const regex = /([A-Z]+\d+(?::[A-Z]+\d+)?)/g;
        let match;
        const uniqueTargets = [];
        while ((match = regex.exec(formula)) !== null) {
            const ref = match[1];
            if (uniqueTargets.indexOf(ref) === -1) {
                uniqueTargets.push(ref);
            }
        }
        groups = uniqueTargets;
    }

    // 各グループごとに色を割り当ててハイライト
    groups.forEach((groupStr, groupIndex) => {
        // グループごとに色を決定（グループ数がパレット数を超える場合はループする）
        const assignedColor = palette[groupIndex % palette.length];

        // 正規表現でセル参照またはセル範囲（例："A1" or "A1:B3"）を抽出
        const regex = /([A-Z]+\d+(?::[A-Z]+\d+)?)/g;
        let match;
        while ((match = regex.exec(groupStr)) !== null) {
            const ref = match[1];
            if (ref.indexOf(":") !== -1) {
                // 範囲指定の場合
                const range = parseRangeReference(ref);
                if (range) {
                    for (let r = range.start.row; r <= range.end.row; r++) {
                        for (let c = range.start.col; c <= range.end.col; c++) {
                            const cell = getCellElement(r, c);
                            if (cell) {
                                cell.style.outline = "2.5px solid " + assignedColor;
                            }
                        }
                    }
                }
            } else {
                // 単体のセルの場合
                const pos = parseCellReference(ref);
                if (pos) {
                    const cell = getCellElement(pos.row, pos.col);
                    if (cell) {
                        cell.style.outline = "2.5px solid " + assignedColor;
                    }
                }
            }
        }
    });
}


// 数式バーをクリック（またはフォーカス）した際に、バーに数式があれば計算対象セル範囲をハイライト
formulaBarInput.addEventListener("click", function () {
    const formulaText = formulaBarInput.value.trim();
    if (formulaText && formulaText.startsWith("=")) {
        highlightCalculationRange(formulaText);
    } else {
        clearCalculationRangeHighlights();
    }
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

document.addEventListener("input", function (e) {
    // 編集モードのセル（contenteditable が true の td 要素）で発生した input イベントを確認
    if (e.target && e.target.matches("td[contenteditable='true']")) {
        const formulaText = e.target.textContent.trim();
        if (formulaText && formulaText.startsWith("=")) {
            highlightCalculationRange(formulaText);
        } else {
            clearCalculationRangeHighlights();
        }
        const cell45 = e.target;
        formulaBarInput.value = cell45.textContent;
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
document.getElementById("corner").addEventListener("click", function (e) {
    e.preventDefault(); // ブラウザのデフォルト動作をキャンセル

    // もし編集中の状態なら（たとえば contentEditable が true の場合）、全選択はしない
    if (document.activeElement && document.activeElement.isContentEditable) {
        return;
    }

    // 既存の全選択状態を一旦解除する
    const previouslySelected = document.querySelectorAll("#spreadsheet tbody td.selected");
    previouslySelected.forEach(cell => cell.classList.remove("selected"));

    // シート内のすべてのセルをまとめて全選択状態にする
    const allCells = document.querySelectorAll("#spreadsheet tbody td");
    allCells.forEach(cell => cell.classList.add("selected"));
    updateFillHandle();

    // 任意：activeCell を全セルの先頭に更新
    if (allCells.length > 0) {
        activeCell = allCells[0];
    }
});


window.onload = function () {
    //==============================
    // 行番号ドラッグ（横の行番号）による複数行選択
    //==============================
    let isRowSelecting = false;
    let rowSelectionStart = null;
    let rowSelectionCurrent = null;

    // 各行番号ヘッダー (th.row_number) に mousedown イベントを登録
    const rowNumbers = document.querySelectorAll("th.row_number");
    rowNumbers.forEach(th => {
        th.addEventListener("mousedown", function (e) {
            e.preventDefault();
            if (document.activeElement && document.activeElement.isContentEditable) return; // 編集中は無視
            isRowSelecting = true;
            rowSelectionStart = parseInt(th.textContent.trim());
            rowSelectionCurrent = rowSelectionStart;
            // 選択状態を一旦クリアし、初期の1行だけ選択
            clearSelected();
            selectRows(rowSelectionStart, rowSelectionStart);
        });
    });

    //==============================
    // 列番号ドラッグ（縦の列番号）による複数列選択
    //==============================
    let isColSelecting = false;
    let colSelectionStart = null;
    let colSelectionCurrent = null;

    // 各列番号ヘッダー (th.col_number) に mousedown イベントを登録
    const colNumbers = document.querySelectorAll("th.col_number");
    colNumbers.forEach(th => {
        th.addEventListener("mousedown", function (e) {
            e.preventDefault();
            if (document.activeElement && document.activeElement.isContentEditable) return;
            isColSelecting = true;
            colSelectionStart = colLabelToIndex(th.textContent.trim());
            colSelectionCurrent = colSelectionStart;
            clearSelected();
            selectColumns(colSelectionStart, colSelectionStart);
        });
    });

    //==============================
    // ドラッグ中（mousemove）に対象の行／列を更新する
    //==============================
    document.addEventListener("mousemove", function (e) {
        // 行選択の場合
        if (isRowSelecting) {
            let th = e.target.closest("th.row_number");
            if (th) {
                const hoveredRow = parseInt(th.textContent.trim());
                if (hoveredRow !== rowSelectionCurrent) {
                    rowSelectionCurrent = hoveredRow;
                    let from = Math.min(rowSelectionStart, rowSelectionCurrent);
                    let to = Math.max(rowSelectionStart, rowSelectionCurrent);
                    clearSelected();
                    selectRows(from, to);
                }
            }
        }
        // 列選択の場合
        if (isColSelecting) {
            let th = e.target.closest("th.col_number");
            if (th) {
                const hoveredCol = colLabelToIndex(th.textContent.trim());
                if (hoveredCol !== colSelectionCurrent) {
                    colSelectionCurrent = hoveredCol;
                    let from = Math.min(colSelectionStart, colSelectionCurrent);
                    let to = Math.max(colSelectionStart, colSelectionCurrent);
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
        for (let r = from; r <= to; r++) {
            const rowCells = document.querySelectorAll(`#spreadsheet td[data-row="${r}"]`);
            rowCells.forEach(cell => cell.classList.add("selected"));
        }
        // 必要なら activeCell の更新など
    }

    // 列番号 (data-col 属性に一致) の範囲を選択
    function selectColumns(from, to) {
        for (let c = from; c <= to; c++) {
            const colCells = document.querySelectorAll(`#spreadsheet td[data-col="${c}"]`);
            colCells.forEach(cell => cell.classList.add("selected"));
        }
        // 必要なら activeCell の更新など
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











// 「selected」クラスが付いているセル群について、
// ・選択セルが 0 個の場合は何も表示しない。
// ・セルが 1 つの場合はそのセル参照 (例："A1") を表示。
// ・複数セルの場合、連続範囲なら「A1:B3」の形式、連続していなければ個別リスト (例："A1, B2, C3") を表示する関数
function updateSelectedCellsDisplay() {
    const selectedCells = Array.from(document.querySelectorAll("td.selected"));
    let displayText = "";

    // 先ほど定義した関数を利用して変換
    if (selectedCells.length === 0) {
        displayText = "";
    } else if (selectedCells.length === 1) {
        // 単一セルの場合はそのセル参照を生成 (例："A1", "AA1" など)
        const cell = selectedCells[0];
        const row = cell.dataset.row;
        const col = parseInt(cell.dataset.col, 10);
        displayText = toColumnName(col) + row;
    } else {
        // 複数セルの場合、まず各セルの行番号・列番号を抽出
        const rows = selectedCells.map(cell => parseInt(cell.dataset.row, 10));
        const cols = selectedCells.map(cell => parseInt(cell.dataset.col, 10));
        const minRow = Math.min(...rows);
        const maxRow = Math.max(...rows);
        const minCol = Math.min(...cols);
        const maxCol = Math.max(...cols);

        // 選択セルの数が矩形状（連続範囲）のセル数と一致すれば連続範囲とみなす
        const expectedCount = (maxRow - minRow + 1) * (maxCol - minCol + 1);
        if (selectedCells.length === expectedCount) {
            const topLeft = toColumnName(minCol) + minRow;
            const bottomRight = toColumnName(maxCol) + maxRow;
            displayText = topLeft + ":" + bottomRight;
        } else {
            displayText = selectedCells
                .map(cell => {
                    const row = cell.dataset.row;
                    const col = parseInt(cell.dataset.col, 10);
                    return toColumnName(col) + row;
                })
                .join(", ");
        }
    }

    const displayElement = document.getElementById("selected-cells-display");
    if (displayElement) {
        displayElement.textContent = displayText;
    }
    updateFontSizeSelect();
}

// 0-indexedの列番号を Excel 表記（"A", "B", ..., "Z", "AA", ...）に変換する関数
function toColumnName(colIndex) {
    let result = "";
    while (colIndex >= 0) {
        result = String.fromCharCode((colIndex % 26) + 65) + result;
        colIndex = Math.floor(colIndex / 26) - 1;
    }
    return result;
}


function updateFontSizeSelect() {
    // 選択状態のセル群を取得
    const selectedCells = document.querySelectorAll("#spreadsheet tbody td.selected");
    if (selectedCells.length === 0) {
        return; // 選択セルがなければ何もしない
    }

    // 各選択セルから computedStyle で font-size を取得し、ユニークな値リストを作成
    const fontSizes = new Set();
    selectedCells.forEach(cell => {
        const computedFontSize = window.getComputedStyle(cell).fontSize;
        fontSizes.add(computedFontSize);
    });

    // 複数のフォントサイズが混在している場合は、ここでは更新しません（必要なら別処理）
    if (fontSizes.size !== 1) {
        console.log("選択セルには複数の font-size が設定されています。");
        return;
    }

    // 共通のフォントサイズを取得（例："16px"）
    const commonFontSize = [...fontSizes][0];

    // font-size セレクト要素を取得
    const fontSizeSelect = document.getElementById("font-size");
    if (!fontSizeSelect) {
        console.error("font-size セレクト要素が見つかりません。");
        return;
    }

    let optionMatched = false;
    // セレクト内の各 option をチェックし、一致するものを↑に selected 状態にセット
    Array.from(fontSizeSelect.options).forEach(option => {
        if (option.value === commonFontSize) {
            option.selected = true;
            optionMatched = true;
        } else {
            option.selected = false;
        }
    });

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
    // すべてのフィルハンドルを削除して重複表示を防ぐ
    document.querySelectorAll(".fill-handle").forEach(handle => handle.remove());

    // 選択されているセル群を取得
    const selectedCells = document.querySelectorAll("#spreadsheet tbody td.selected");
    if (!selectedCells || selectedCells.length === 0) return;

    let targetCell = null;

    if (selectedCells.length === 1) {
        // 単一セルの場合は、アクティブセル（または選択されているセル）にフィルハンドルを表示
        targetCell = activeCell;
    } else {
        // 複数セルの場合、選択範囲の最小／最大の行・列を計算
        let minRow = Infinity, maxRow = -Infinity, minCol = Infinity, maxCol = -Infinity;
        selectedCells.forEach(cell => {
            const r = parseInt(cell.dataset.row, 10);
            const c = parseInt(cell.dataset.col, 10);
            if (r < minRow) minRow = r;
            if (r > maxRow) maxRow = r;
            if (c < minCol) minCol = c;
            if (c > maxCol) maxCol = c;
        });
        // 通常、Excel のような動作では右下隅（最大行・最大列）のセルにフィルハンドルを表示します
        targetCell = getCell(maxRow, maxCol);
    }

    // 編集モード中ならフィルハンドルは表示しない
    if (targetCell && !targetCell.isContentEditable) {
        // 子要素の絶対配置が有効になるように relative を設定
        targetCell.style.position = "relative";
        // フィルハンドル要素を作成し、targetCell の内部に追加
        const fillHandle = document.createElement("div");
        fillHandle.className = "fill-handle";
        targetCell.appendChild(fillHandle);
        // フィルハンドルのマウスイベント（ドラッグ開始処理）を登録
        fillHandle.addEventListener("mousedown", fillHandleMouseDown);
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
    for (let r = currentFillRange.minRow; r <= currentFillRange.maxRow; r++) {
        for (let c = currentFillRange.minCol; c <= currentFillRange.maxCol; c++) {
            const targetCell = getCell(r, c); // 既存の getCell(row, col) 関数
            if (targetCell) {
                // 完全な情報を複製する
                cloneCellProperties(fillSource, targetCell);
                // 複製先セルには改めて selected クラスを付与
                targetCell.classList.add("selected");
            }
        }
    }

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
    // 1. テキスト内容をコピー
    targetCell.textContent = sourceCell.textContent;

    // 2. data-* 属性のコピー（コピー元の merge 関連の属性はコピーせず、row/col も除外）
    Object.keys(sourceCell.dataset).forEach(key => {
        // コピー元のデータを、'row', 'col'、および merge 関連（"merge" で始まる）のキーは除外する
        if (key !== 'row' && key !== 'col' && !key.startsWith("merge")) {
            targetCell.dataset[key] = sourceCell.dataset[key];
        }
    });
    // ※ここでは、もしコピー先が既に merge の情報を持っている場合は、何も上書きしないのでそのまま維持される

    // 3. 数式データのコピーと調整
    if (sourceCell.dataset.formula && sourceCell.dataset.formula[0] === "=") {
        const srcRow = parseInt(sourceCell.dataset.row, 10);
        const srcCol = parseInt(sourceCell.dataset.col, 10);
        const tgtRow = parseInt(targetCell.dataset.row, 10);
        const tgtCol = parseInt(targetCell.dataset.col, 10);
        const rowOffset = tgtRow - srcRow;
        const colOffset = tgtCol - srcCol;
        targetCell.dataset.formula = adjustFormula(sourceCell.dataset.formula, rowOffset, colOffset);
    } else {
        // 数式データがない場合、コピー先に formula 情報があれば削除する
        if (targetCell.dataset.formula) {
            delete targetCell.dataset.formula;
        }
    }

    // 4. スタイル情報のコピー
    const computed = window.getComputedStyle(sourceCell);
    const bgColor = computed.backgroundColor;
    targetCell.style.backgroundColor =
        (bgColor === "rgba(0, 0, 0, 0)" || bgColor === "transparent") ? "" : bgColor;
    targetCell.style.color = computed.color;
    targetCell.style.textAlign = computed.textAlign;
    targetCell.style.border = computed.border;
    targetCell.style.fontSize = computed.fontSize;
    targetCell.style.fontFamily = computed.fontFamily;
    targetCell.style.fontStyle = computed.fontStyle;
    targetCell.style.fontWeight = computed.fontWeight;
    targetCell.style.verticalAlign = computed.verticalAlign;
    targetCell.style.textDecoration = computed.textDecoration;

    // 5. contenteditable など、選択状態に関する属性・クラスはコピーしない
    targetCell.removeAttribute("contenteditable");
    targetCell.classList.remove("selected", "fill-selected");

    updateAllFormulas();
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
    // 選択されたセルを取得
    const selectedCells = Array.from(document.querySelectorAll("#spreadsheet tbody td.selected"));
    if (selectedCells.length === 0) {
        console.log("コピー対象のセルがありません。");
        return;
    }

    // 各セルの行・列番号を取得
    const rows = selectedCells.map(cell => parseInt(cell.dataset.row, 10));
    const cols = selectedCells.map(cell => parseInt(cell.dataset.col, 10));
    const minRow = Math.min(...rows);
    const maxRow = Math.max(...rows);
    const minCol = Math.min(...cols);
    const maxCol = Math.max(...cols);

    // 連続選択か判定（矩形のセル数と実際の選択セルの数が一致すれば連続）
    const expectedCount = (maxRow - minRow + 1) * (maxCol - minCol + 1);
    const isContiguous = (selectedCells.length === expectedCount);

    // どちらの場合も、基準セルとして左上（minRow, minCol）を記録
    let baselineRow = minRow, baselineCol = minCol;

    // clipboardData というグローバル変数に保存
    clipboardData = {
        startRow: baselineRow,
        startCol: baselineCol,
        data: null  // ここから下で内容を作成
    };

    if (isContiguous) {
        // 連続の場合は、2次元配列形式にまとめる
        clipboardData.data = [];
        for (let r = minRow; r <= maxRow; r++) {
            let rowData = [];
            for (let c = minCol; c <= maxCol; c++) {
                const cell = getCell(r, c);
                if (cell) {
                    rowData.push({
                        value: cell.textContent,
                        formula: cell.dataset.formula || "",
                        cssText: cell.getAttribute("style") || ""
                    });
                } else {
                    rowData.push({ value: "", formula: "", cssText: "" });
                }
            }
            clipboardData.data.push(rowData);
        }
    } else {
        // 非連続の場合でも、左上を基準として保存する（貼り付け時に相対位置で処理できるように）
        clipboardData.data = [];
        selectedCells.forEach(cell => {
            clipboardData.data.push({
                row: parseInt(cell.dataset.row, 10),
                col: parseInt(cell.dataset.col, 10),
                value: cell.textContent,
                formula: cell.dataset.formula || "",
                cssText: cell.getAttribute("style") || ""
            });
        });
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
    if (!clipboardData) {
        console.log("貼り付け対象のデータがありません。");
        return;
    }
    // 複数セルが選択されているなら、選択範囲の左上セルを基準セルとして利用
    let targetCell = activeCell;
    const selectedDest = Array.from(document.querySelectorAll("#spreadsheet tbody td.selected"));
    if (selectedDest.length > 0) {
        let minRow = Infinity, minCol = Infinity;
        selectedDest.forEach(cell => {
            const r = parseInt(cell.dataset.row, 10);
            const c = parseInt(cell.dataset.col, 10);
            if (r < minRow) minRow = r;
            if (c < minCol) minCol = c;
        });
        const newTarget = getCell(minRow, minCol);
        if (newTarget) {
            targetCell = newTarget;
        }
    }

    const targetRow = parseInt(targetCell.dataset.row, 10);
    const targetCol = parseInt(targetCell.dataset.col, 10);

    // 貼り付け先オフセット：コピー時の基準セルからのずれ
    const rowDelta = targetRow - clipboardData.startRow;
    const colDelta = targetCol - clipboardData.startCol;

    // 単一セルコピーかつ複数セル選択時は、すべてへ同じ値を埋め尽くす処理
    if (clipboardData.startRow !== null &&
        clipboardData.data.length === 1 &&
        clipboardData.data[0].length === 1 &&
        selectedDest.length > 1) {
        const cellData = clipboardData.data[0][0];
        // 数式がある場合は相対調整
        let newFormula = "";
        if (cellData.formula && cellData.formula.trim() !== "") {
            newFormula = adjustFormulaReferences(cellData.formula, rowDelta, colDelta);
        }
        selectedDest.forEach(destCell => {
            destCell.textContent = cellData.value;
            if (newFormula !== "") {
                destCell.dataset.formula = newFormula;
                destCell.textContent = evaluateFormula(newFormula);
            } else {
                delete destCell.dataset.formula;
            }
            destCell.style.cssText = cellData.cssText;
        });
        updateAllFormulas();
        updateFillHandle();
        updateSelectedCellsDisplay();
        return;
    }

    // 連続範囲の場合
    if (clipboardData.startRow !== null && Array.isArray(clipboardData.data[0])) {
        const numRows = clipboardData.data.length;
        const numCols = clipboardData.data[0].length;
        for (let r = 0; r < numRows; r++) {
            for (let c = 0; c < numCols; c++) {
                const destRow = targetRow + r;
                const destCol = targetCol + c;
                const destCell = getCell(destRow, destCol);
                if (destCell) {
                    const cellData = clipboardData.data[r][c];
                    destCell.textContent = cellData.value;
                    if (cellData.formula && cellData.formula.trim() !== "") {
                        // 調整した数式を作成
                        let newFormula = adjustFormulaReferences(cellData.formula, rowDelta, colDelta);
                        destCell.dataset.formula = newFormula;
                        destCell.textContent = evaluateFormula(newFormula);
                    } else {
                        delete destCell.dataset.formula;
                    }
                    destCell.style.cssText = cellData.cssText;
                }
            }
        }
    } else {
        // 非連続の場合：各セルごとの絶対位置から、基準セルを用いた相対貼り付けに変更
        clipboardData.data.forEach(item => {
            // item.row, item.col はコピー時の元セル位置
            const adjustedRow = targetRow + (item.row - clipboardData.startRow);
            const adjustedCol = targetCol + (item.col - clipboardData.startCol);
            const destCell = getCell(adjustedRow, adjustedCol);
            if (destCell) {
                destCell.textContent = item.value;
                if (item.formula && item.formula.trim() !== "") {
                    let newFormula = adjustFormulaReferences(item.formula, rowDelta, colDelta);
                    destCell.dataset.formula = newFormula;
                    destCell.textContent = evaluateFormula(newFormula);
                } else {
                    delete destCell.dataset.formula;
                }
                destCell.style.cssText = item.cssText;
            }
        });
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

/**
 * 指定の状態データ（JSON文字列）からセルデータを復元する関数です。
 * getCell(row, col) という関数で対象セルの DOM 要素を取得する前提です。
 */
function loadState(stateJSON) {
    const stateData = JSON.parse(stateJSON);
    stateData.cells.forEach(cellData => {
        let targetCell = getCell(cellData.row, cellData.col);
        if (targetCell) {
            // まずは保存された値を反映します
            targetCell.textContent = cellData.value;

            // 値が空の場合は、セルの数式情報もクリアする
            if (cellData.value.trim() === "") {
                delete targetCell.dataset.formula;
            }
            // もし値が空でなく、なおかつ数式情報があれば、数式を再評価して表示する
            else if (cellData.formula && cellData.formula.trim() !== "") {
                targetCell.dataset.formula = cellData.formula;
                targetCell.textContent = evaluateFormula(cellData.formula);
            }

            // セルの style を適用
            targetCell.style.cssText = cellData.style;

            // colspan, rowspan の反映（数値が1より大きければ属性をセット、そうでなければ属性を除去）
            if (cellData.colspan && parseInt(cellData.colspan, 10) > 1) {
                targetCell.setAttribute("colspan", cellData.colspan);
            } else {
                targetCell.removeAttribute("colspan");
            }
            if (cellData.rowspan && parseInt(cellData.rowspan, 10) > 1) {
                targetCell.setAttribute("rowspan", cellData.rowspan);
            } else {
                targetCell.removeAttribute("rowspan");
            }
        }
    });
}

/**
 * Undo (戻る) の処理：
 * 現在の状態を redoHistory に移し、直前の状態を復元します。
 */
function undo() {
    if (undoHistory.length > 1) {
        // 現在の状態を pop して redo に保存
        const currentState = undoHistory.pop();
        redoHistory.push(currentState);
        // 直前の状態（undoHistory の先頭）を復元
        const previousState = undoHistory[undoHistory.length - 1];
        loadState(previousState);
    } else {
        console.log("これ以上戻れません。");
    }
}

/**
 * Redo (ひとつ前に進む) の処理：
 * redoHistory から状態を取り出して復元し、undoHistory に戻します。
 */
function redo() {
    if (redoHistory.length > 0) {
        const nextState = redoHistory.pop();
        undoHistory.push(nextState);
        loadState(nextState);
    } else {
        console.log("これ以上進めません。");
    }
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

// また、貼り付けやフォーマット変更など、操作終了時にも debouncedSaveState() を呼ぶようにしてください


// --- シートデータ保存／再読み込み用の関数 ---
// シート状態を localStorage に保存する関数
// 保存時：テーブル全体の状態をクローンして選択状態だけを除去した上で localStorage に保存
function saveSpreadsheetData() {
    loadingstate.textContent = "保存中...";
    setTimeout(() => {
        const savedCells = [];
        // 定義：セルのスタイル・結合は、変更があった場合のみ保存する
        const DEFAULT_CELL_STYLE = "";      // インラインスタイルが存在しなければ空文字
        const DEFAULT_COLSPAN = "1";
        const DEFAULT_ROWSPAN = "1";

        // すべてのセルのうち、実際に値や数式、スタイル（非デフォルト）が設定されているセルを保存対象とする
        document.querySelectorAll("#spreadsheet tbody td").forEach(cell => {
            // セルの内容取得
            const value = cell.hidden ? (cell.dataset.originalValue || "") : cell.textContent;
            const formula = cell.dataset.formula || "";
            // inline style が設定されていなければ空文字を返す
            const styleStr = cell.getAttribute("style") || "";
            // カスタムなスタイルがあるか判定（空文字またはデフォルトなら false）
            const hasCustomStyle = styleStr.trim() !== "" && styleStr.trim() !== DEFAULT_CELL_STYLE;

            // セルの値、数式、またはカスタムなスタイルがある場合のみ保存する
            if (value !== "" || formula.trim() !== "" || hasCustomStyle) {
                let computedValue = "";
                if (formula.trim() !== "") {
                    computedValue = evaluateFormula(formula);
                }

                // セルデータ作成の基本情報
                let cellData = {
                    row: parseInt(cell.dataset.row, 10),
                    col: parseInt(cell.dataset.col, 10),
                    value: value,
                    computedValue: computedValue,
                    formula: formula
                };

                // カスタムなスタイルがある場合のみ style を保存
                if (hasCustomStyle) {
                    cellData.style = styleStr;
                }
                // colspan, rowspan はデフォルト値 ("1") なら保存しない
                const colspan = cell.getAttribute("colspan") || DEFAULT_COLSPAN;
                if (colspan !== DEFAULT_COLSPAN) {
                    cellData.colspan = colspan;
                }
                const rowspan = cell.getAttribute("rowspan") || DEFAULT_ROWSPAN;
                if (rowspan !== DEFAULT_ROWSPAN) {
                    cellData.rowspan = rowspan;
                }

                // 結合セルの場合、mergeAnchor や merge 範囲情報が設定されていれば保存
                if (cell.dataset.mergeAnchorRow) {
                    cellData.mergeAnchorRow = cell.dataset.mergeAnchorRow;
                    cellData.mergeAnchorCol = cell.dataset.mergeAnchorCol;
                }
                if (cell.dataset.mergeMinRow) {
                    cellData.mergeMinRow = cell.dataset.mergeMinRow;
                    cellData.mergeMinCol = cell.dataset.mergeMinCol;
                }
                if (cell.dataset.mergeMaxRow) {
                    cellData.mergeMaxRow = cell.dataset.mergeMaxRow;
                    cellData.mergeMaxCol = cell.dataset.mergeMaxCol;
                }

                savedCells.push(cellData);
            }
        });

        // 行（tr）のリサイズ情報の保存
        const savedRows = [];
        document.querySelectorAll("#spreadsheet tbody tr").forEach(tr => {
            const rowNum = tr.getAttribute("data-row");
            const computedHeight = window.getComputedStyle(tr).getPropertyValue("height");
            savedRows.push({
                row: parseInt(rowNum, 10),
                height: computedHeight
            });
        });

        // 列（th）のリサイズ情報の保存
        const savedColumns = [];
        document.querySelectorAll("#spreadsheet thead th").forEach((th, index) => {
            const computedWidth = window.getComputedStyle(th).getPropertyValue("width");
            savedColumns.push({
                col: index,
                width: computedWidth
            });
        });

        // ズーム情報の取得
        const zoomSlider = document.getElementById("zoom-slider");
        const zoomValue = zoomSlider ? zoomSlider.value : "100";

        // 保存するデータオブジェクトの構築
        const dataToSave = {
            cells: savedCells,
            rows: savedRows,
            columns: savedColumns,
            zoom: zoomValue
        };

        // localStorage に JSON 形式で保存
        localStorage.setItem("spreadsheetData", JSON.stringify(dataToSave));
        loadingstate.textContent = "保存しました。";
        updateLocalStorageUsage();
    }, 300);
}






// 読み込み時：保存されたテーブル全体の状態を localStorage から復元し、リサイズハンドルやイベントリスナーを再登録
function loadSpreadsheetData() {
    // 保存データの取得とパース
    const savedDataJson = localStorage.getItem("spreadsheetData");
    let savedData = null;
    if (savedDataJson) {
        try {
            savedData = JSON.parse(savedDataJson);
            loadingstate.textContent = "読み込み中..."
        } catch (err) {
            console.error("保存データのパースエラー:", err);
        }
    }
    if (!savedData) {
        loadingstate.textContent = "保存済みのスプレッドシートデータがありません。"
        return;
    }

    // 1. 保存されたセルデータの中で最大の行番号を求め、足りなければ行を追加
    if (savedData.cells && savedData.cells.length > 0) {
        const maxSavedRow = Math.max(...savedData.cells.map(cellData => parseInt(cellData.row, 10)));
        if (maxSavedRow >= rowCount) {
            loadRows(maxSavedRow - rowCount + 1);
        }
    }

    // 2. まず拡大率（ズーム）と行・列のリサイズ情報を反映する
    // 行のリサイズ情報の反映
    if (savedData.rows && savedData.rows.length > 0) {
        savedData.rows.forEach(rowData => {
            let targetRow = getRow(rowData.row);
            if (targetRow) {
                targetRow.style.height = rowData.height;
            }
        });
    }
    // 列のリサイズ情報の反映（ヘッダー部分）
    if (savedData.columns && savedData.columns.length > 0) {
        savedData.columns.forEach(colData => {
            let headerCells = document.querySelectorAll("#spreadsheet thead th");
            if (headerCells[colData.col]) {
                headerCells[colData.col].style.width = colData.width;
            }
        });
    }
    // 拡大率（ズーム）の反映
    if (savedData.zoom !== undefined) {
        const zoomSlider = document.getElementById("zoom-slider");
        const zoomDisplay = document.getElementById("zoom-display");
        const spreadsheetContainer = document.getElementById("spreadsheet-container");
        zoomSlider.value = savedData.zoom;
        zoomDisplay.textContent = savedData.zoom + "%";
        const zoomFactor = Number(savedData.zoom) / 100;
        spreadsheetContainer.style.zoom = zoomFactor;
    }

    // 3. 保存されたセルデータの反映（非同期バッチ処理）
    if (savedData.cells && savedData.cells.length > 0) {
        const cells = savedData.cells;
        const batchSize = 500; // 一度に処理するセル数（環境に合わせて調整可能）
        let index = 0;

        function processCellBatch() {
            const end = Math.min(index + batchSize, cells.length);
            for (let i = index; i < end; i++) {
                const cellData = cells[i];
                // getCell() は、行／列が不足していれば自動生成する前提
                let targetCell = getCell(cellData.row, cellData.col);
                if (targetCell) {
                    // セル結合（colspan, rowspan）の反映
                    if (cellData.colspan && parseInt(cellData.colspan, 10) > 1) {
                        targetCell.setAttribute("colspan", cellData.colspan);
                    } else {
                        targetCell.removeAttribute("colspan");
                    }
                    if (cellData.rowspan && parseInt(cellData.rowspan, 10) > 1) {
                        targetCell.setAttribute("rowspan", cellData.rowspan);
                    } else {
                        targetCell.removeAttribute("rowspan");
                    }

                    // 数式またはセル値の反映
                    if (cellData.formula && cellData.formula.trim() !== "") {
                        targetCell.dataset.formula = cellData.formula;
                        if (cellData.computedValue !== undefined && cellData.computedValue !== "") {
                            targetCell.textContent = cellData.computedValue;
                        } else {
                            targetCell.textContent = evaluateFormula(cellData.formula);
                        }
                    } else if (cellData.value !== undefined) {
                        targetCell.textContent = cellData.value;
                    }

                    // style の反映
                    targetCell.style.cssText = cellData.style;

                    // 結合セル情報の復元
                    if (cellData.mergeAnchorRow) {
                        targetCell.dataset.mergeAnchorRow = cellData.mergeAnchorRow;
                        targetCell.dataset.mergeAnchorCol = cellData.mergeAnchorCol;
                    }
                    if (cellData.mergeMinRow) {
                        targetCell.dataset.mergeMinRow = cellData.mergeMinRow;
                        targetCell.dataset.mergeMinCol = cellData.mergeMinCol;
                    }
                    if (cellData.mergeMaxRow) {
                        targetCell.dataset.mergeMaxRow = cellData.mergeMaxRow;
                        targetCell.dataset.mergeMaxCol = cellData.mergeMaxCol;
                    }

                    // hidden 状態の復元
                    if (cellData.hidden !== undefined) {
                        targetCell.hidden = (cellData.hidden === true || cellData.hidden === "true");
                    } else {
                        targetCell.hidden = false;
                    }
                }
            }
            index += batchSize;
            if (index < cells.length) {
                requestAnimationFrame(processCellBatch);
            } else {
                // すべてのセル反映完了後、必要な更新処理を行う
                setupRowVisibilityObserver();
                loadingstate.textContent = "読み込み完了";
            }
        }
        processCellBatch();
    } else {
        loadingstate.textContent = "読み込み完了";
    }

    // ヘルパー関数：指定された行番号を持つ行要素を取得
    function getRow(rowNumber) {
        return document.querySelector(`#spreadsheet tbody tr[data-row='${rowNumber}']`);
    }

    setupRowVisibilityObserver();
}



// 事前に container がグローバルで取得されている前提です
// 例: const container = document.getElementById("spreadsheet-container");

// debounce 用の関数
function debounce(func, delay) {
    let timer;
    return function (...args) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => func.apply(this, args), delay);
    };
}

/**
 * ・スクロールコンテナのビューポートを取得し、各行・セルの位置から可視性を設定する
 * ・ただし、現在フォーカス中（編集中）のセルは更新をスキップして、編集状態を維持する
 */
// まずは、行ごとに表示状態を監視するための observer を設定する関数
// ----- IntersectionObserver 部分：行の縦方向の監視とセルの横方向チェック ----- //
// グローバル変数として observer インスタンスを保持
// まず、全体の監視対象（スクロールコンテナ）を取得
// IntersectionObserver を使って各行の縦方向の表示状態を監視する
let rowObserver = null;

function setupRowVisibilityObserver() {
    // 古い observer が存在している場合は解放
    if (rowObserver) {
        rowObserver.disconnect();
    }

    const options = {
        root: container,  // コンテナをルートとして使用
        threshold: 0      // 少しでも交差すれば反応
    };

    rowObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const row = entry.target;
            if (entry.isIntersecting) {
                // 行レベルの表示状態を更新し、横方向もチェック
                row.style.visibility = "visible";
                updateRowCellsVisibility(row);
            } else {
                row.style.visibility = "hidden";
                row.querySelectorAll("td, th").forEach(cell => {
                    cell.style.visibility = "hidden";
                });
            }
        });
    }, options);

    // tbody のすべての行を監視
    document.querySelectorAll("#spreadsheet tbody tr").forEach(row => {
        rowObserver.observe(row);
    });
}

// 各行内のセルについて、コンテナの矩形と比較して横方向の表示状態をチェックする関数
function updateRowCellsVisibility(row) {
    const containerRect = container.getBoundingClientRect();
    row.querySelectorAll("td, th").forEach(cell => {
        // 編集中のセルは常に表示
        if (cell === document.activeElement) {
            cell.style.visibility = "visible";
            return;
        }
        const cellRect = cell.getBoundingClientRect();
        // セルがコンテナ内に「横方向」で重なっているかチェック
        if (cellRect.right >= containerRect.left && cellRect.left <= containerRect.right) {
            cell.style.visibility = "visible";
        } else {
            cell.style.visibility = "hidden";
        }
    });
}
// throttle 関数：scroll イベントの頻度制御用
function throttle(callback, delay) {
    let lastCall = 0;
    return function (...args) {
        const now = Date.now();
        if (now - lastCall >= delay) {
            lastCall = now;
            callback.apply(this, args);
        }
    };
}
// 横方向のスクロール時も、各行の横方向の表示状態を再評価する
container.addEventListener("scroll", throttle(() => {
    // ここでは、既に visibility が "visible" とされている各行について横方向の再チェックを実行
    document.querySelectorAll("#spreadsheet tbody tr").forEach(row => {
        if (row.style.visibility === "visible") {
            updateRowCellsVisibility(row);
        }
    });
}, 100));
// 初期設定：シートロード後やレイアウト変更時に observer をセットアップ
setupRowVisibilityObserver();


// 拡大縮小バーの要素取得
const zoomSlider = document.getElementById("zoom-slider");
const zoomDisplay = document.getElementById("zoom-display");
const spreadsheetContainer = document.getElementById("spreadsheet-container");

// 拡大縮小イベント
zoomSlider.addEventListener("input", function () {
    const zoomValue = Number(this.value);
    const zoomFactor = zoomValue / 100;
    // CSS zoom を設定
    spreadsheetContainer.style.zoom = zoomFactor;
    // 表示テキスト更新
    zoomDisplay.textContent = zoomValue + "%";

    // 拡大縮小操作中は頻繁な observer 再設定を避けるためにデバウンス
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
        setupRowVisibilityObserver();
    }, 500);
});









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
    const MAX_BYTES = 5 * 1024 * 1024; // 総容量 5MB (5 * 1024 * 1024 バイト)
    const usedBytes = getLocalStorageUsage();
    const remainingBytes = MAX_BYTES - usedBytes;

    // 総容量（固定値）の表示
    const totalElem = document.getElementById("localStorageTotal");
    if (totalElem) {
        totalElem.textContent = "全体容量: " + formatBytes(MAX_BYTES);
    }

    // 使用量の表示
    const usedElem = document.getElementById("localStorageUsed");
    if (usedElem) {
        usedElem.textContent = "使用量: " + formatBytes(usedBytes);
    }

    // 残り容量の表示
    const remainingElem = document.getElementById("localStorageRemaining");
    if (remainingElem) {
        remainingElem.textContent = "残り容量: " + formatBytes(remainingBytes);
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