// minesweeper.js
export default function MinesweeperApp(content, options) {
    if (!content) return;

    // ウィンドウサイズの設定（マインスイーパーのUIに合わせて調整）[cite: 1]
    const win = content.parentElement;
    if (win) {
        win.style.width = "480px";
        win.style.height = "640px";
        win.style.backgroundColor = "silver";
    }

    content.classList.add("scrollbar_none"); //[cite: 1]
    content.style.overflow = "hidden"; //[cite: 1]
    content.tabIndex = 0; //[cite: 1]

    // --- HTML & CSS の生成 --- //[cite: 1]
    content.innerHTML = `
        <style>
            .ms-wrapper { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                height: 100%; 
                background-color: #c0c0c0; 
                color: black; 
                display: flex; 
                flex-direction: column; 
                touch-action: manipulation; 
                user-select: none;
            }
            .ms-wrapper p, .ms-wrapper h2 { margin: 0; padding: 0; text-align: center; }
            
            /* メニュー1（難易度選択） */ /*[cite: 1] */
            .ms-menu1 { 
                display: flex; 
                flex-direction: column; 
                gap: 15px; 
                padding: 20px; 
                align-items: center; 
                justify-content: center; 
                height: 100%; 
            }
            .difficulty-btn { width: 75%; height: 50px; } /*[cite: 1] */
            
            /* メニュー2（ゲーム画面） */ /*[cite: 1] */
            .ms-menu2 { 
                display: none; 
                flex-direction: column;
                padding: 15px; 
                height: 100%; 
                box-sizing: border-box; 
            }
            
            /* ヘッダーパネル（地雷数、顔、タイマー） */
            .ms-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px;
                margin-bottom: 15px;
            }
            .led-display {
                background: black;
                color: #ff0000;
                font-family: monospace;
                font-size: 2rem;
                padding: 2px 5px;
                width: 60px;
                text-align: right;
                line-height: 1;
            }
            #reset-btn {
                font-size: 1.5rem;
                width: 45px;
                height: 45px;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0;
            }

            /* ボードエリア */
            .board-container {
                flex: 1;
                display: flex;
                justify-content: center;
                align-items: flex-start;
                overflow: auto; /* 大きなボード用にスクロールを許可 */
                background: #7b7b7b;
                padding: 2px;
            }
            .board {
                display: grid;
                background: #7b7b7b;
                gap: 1px; /* セル間の区切り線用 */
            }
            .cell {
               width: 24px;
                height: 24px;
                background: #c0c0c0;
                border: 1.5px solid;
                border-color: #ffffff #7b7b7b #7b7b7b #ffffff;
                box-sizing: border-box;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 900;
                font-size: 14px;
                cursor: pointer;
            }
            .cell.revealed {
                border: 1.5px solid;
                border-color: #7b7b7b #ffffff #ffffff #7b7b7b;
                box-sizing: border-box;
            }
            
            /* 数字の色分け */
            .c-1 { color: blue; }
            .c-2 { color: green; }
            .c-3 { color: red; }
            .c-4 { color: darkblue; }
            .c-5 { color: darkred; }
            .c-6 { color: teal; }
            .c-7 { color: black; }
            .c-8 { color: dimgray; }

            /* 下部アクション */ /*[cite: 1] */
            .bottom-actions {
                display: flex; 
                justify-content: space-between; 
                margin-top: 15px; 
                gap: 10px;
            }
            .bottom-actions button { flex: 1; }
        </style>

        <div class="ms-wrapper">
            <!-- 難易度選択 -->
            <div class="ms-menu1">
                <h2 style="margin-bottom: 20px;">マインスイーパー</h2>
                <button class="difficulty-btn" data-rows="9" data-cols="9" data-mines="10">初級 (9x9, 10個)</button>
                <button class="difficulty-btn" data-rows="16" data-cols="16" data-mines="40">中級 (16x16, 40個)</button>
                <button class="difficulty-btn" data-rows="16" data-cols="30" data-mines="99">上級 (16x30, 99個)</button>
            </div>

            <!-- ゲーム画面 -->
            <div class="ms-menu2">
                <div class="ms-header">
                    <div class="led-display border" id="mine-count">010</div>
                    <button id="reset-btn">🙂</button>
                    <div class="led-display border" id="timer">000</div>
                </div>
                
                <div class="board-container">
                    <div class="board border" id="board"></div>
                </div>

                <div class="bottom-actions">
                    <button id="toggle-mode-btn" style="color: blue;">モード: ⛏️ 掘る</button>
                    <button id="btn-menu">メニューへ</button>
                </div>
            </div>
        </div>
    `;

    // --- DOM要素の取得 --- //[cite: 1]
    const menu1 = content.querySelector('.ms-menu1');
    const menu2 = content.querySelector('.ms-menu2');
    const boardElem = content.querySelector('#board');
    const mineCountElem = content.querySelector('#mine-count');
    const timerElem = content.querySelector('#timer');
    const resetBtn = content.querySelector('#reset-btn');
    const toggleModeBtn = content.querySelector('#toggle-mode-btn');
    const btnMenu = content.querySelector('#btn-menu');

    // --- ゲーム状態管理 ---
    let rows = 9, cols = 9, totalMines = 10;
    let grid = [];
    let isFirstClick = true;
    let isGameOver = false;
    let revealedCount = 0;
    let flagsCount = 0;

    let timerID = null; //[cite: 1]
    let timeElapsed = 0;

    // タッチデバイス・モバイル向けのアクションモード (dig | flag)
    let actionMode = 'dig';

    // --- 関数定義 ---

    // UI 切り替え[cite: 1]
    function showMenu1() {
        menu1.style.display = "flex";
        menu2.style.display = "none";
        stopTimer();
    }

    function showMenu2() {
        menu1.style.display = "none";
        menu2.style.display = "flex";
    }

    // タイマー管理
    function startTimer() {
        if (timerID) clearInterval(timerID);
        timeElapsed = 0;
        updateTimerDisplay();
        timerID = setInterval(() => {
            if (!isGameOver) {
                timeElapsed = Math.min(timeElapsed + 1, 999);
                updateTimerDisplay();
            }
        }, 1000);
    }

    function stopTimer() {
        if (timerID) {
            clearInterval(timerID);
            timerID = null;
        }
    }

    function updateTimerDisplay() {
        timerElem.textContent = String(timeElapsed).padStart(3, '0');
    }

    function updateMineCountDisplay() {
        let displayNum = totalMines - flagsCount;
        // マイナス表示にも対応
        if (displayNum < -99) displayNum = -99;
        let str = String(Math.abs(displayNum)).padStart(displayNum < 0 ? 2 : 3, '0');
        mineCountElem.textContent = displayNum < 0 ? `-${str}` : str;
    }

    // ゲームの初期化
    function initGame(r, c, m) {
        rows = r; cols = c; totalMines = m;
        isFirstClick = true;
        isGameOver = false;
        revealedCount = 0;
        flagsCount = 0;
        resetBtn.textContent = '🙂';
        stopTimer();
        timeElapsed = 0;
        updateTimerDisplay();
        updateMineCountDisplay();

        // グリッドデータの生成
        grid = Array.from({ length: rows }, () =>
            Array.from({ length: cols }, () => ({
                isMine: false,
                isRevealed: false,
                isFlagged: false,
                neighborMines: 0
            }))
        );

        renderBoardHTML();
    }

    // DOMの構築 (初回のみ)
    function renderBoardHTML() {
        boardElem.innerHTML = '';
        boardElem.style.gridTemplateColumns = `repeat(${cols}, 24px)`;
        boardElem.style.gridTemplateRows = `repeat(${rows}, 24px)`;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.r = r;
                cell.dataset.c = c;
                boardElem.appendChild(cell);
            }
        }
    }

    // セルの表示更新
    function updateCellDOM(r, c) {
        const cellState = grid[r][c];
        const cellElem = boardElem.children[r * cols + c];

        if (cellState.isRevealed) {
            cellElem.classList.add('revealed');
            if (cellState.isMine) {
                cellElem.textContent = '💣';
                cellElem.style.backgroundColor = 'red';
            } else if (cellState.neighborMines > 0) {
                cellElem.textContent = cellState.neighborMines;
                cellElem.className = `cell revealed c-${cellState.neighborMines}`;
            } else {
                cellElem.textContent = '';
            }
        } else {
            cellElem.classList.remove('revealed');
            cellElem.className = 'cell';
            if (cellState.isFlagged) {
                cellElem.textContent = '🚩';
            } else {
                cellElem.textContent = '';
            }
        }
    }

    // 初回クリック時に地雷を配置する処理（初手セーフ機能）
    function placeMines(firstR, firstC) {
        let placed = 0;
        while (placed < totalMines) {
            let r = Math.floor(Math.random() * rows);
            let c = Math.floor(Math.random() * cols);

            // 最初のクリック地点とその周囲8マスには地雷を置かないよう緩和しても良いが、
            // 最低限「クリックしたその場所」には置かない。
            if (!grid[r][c].isMine && !(r === firstR && c === firstC)) {
                grid[r][c].isMine = true;
                placed++;
            }
        }

        // 周囲の地雷数を計算
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (!grid[r][c].isMine) {
                    let count = 0;
                    for (let dr = -1; dr <= 1; dr++) {
                        for (let dc = -1; dc <= 1; dc++) {
                            let nr = r + dr, nc = c + dc;
                            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc].isMine) {
                                count++;
                            }
                        }
                    }
                    grid[r][c].neighborMines = count;
                }
            }
        }
    }

    // セルを開くロジック
    function revealCell(r, c) {
        if (isGameOver) return;
        const cell = grid[r][c];

        if (cell.isRevealed || cell.isFlagged) return;

        if (isFirstClick) {
            isFirstClick = false;
            placeMines(r, c);
            startTimer();
        }

        cell.isRevealed = true;
        revealedCount++;
        updateCellDOM(r, c);

        if (cell.isMine) {
            triggerGameOver(false);
            return;
        }

        // 連鎖オープン (フラッドフィル)
        if (cell.neighborMines === 0) {
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    let nr = r + dr, nc = c + dc;
                    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                        if (!grid[nr][nc].isRevealed && !grid[nr][nc].isFlagged) {
                            revealCell(nr, nc);
                        }
                    }
                }
            }
        }

        // クリア判定
        if (revealedCount === (rows * cols) - totalMines) {
            triggerGameOver(true);
        }
    }

    // 旗の切り替え
    function toggleFlag(r, c) {
        if (isGameOver || isFirstClick) return; // 最初のクリックは必ず「掘る」になるべき
        const cell = grid[r][c];

        if (cell.isRevealed) return;

        cell.isFlagged = !cell.isFlagged;
        flagsCount += cell.isFlagged ? 1 : -1;

        updateCellDOM(r, c);
        updateMineCountDisplay();
    }

    // コード操作（すでに開かれている数字セルをクリックした時、周囲の旗の数が合っていれば残りを一括オープン）
    function chordCell(r, c) {
        const cell = grid[r][c];
        if (!cell.isRevealed || cell.neighborMines === 0) return;

        let flagsAround = 0;
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                let nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc].isFlagged) {
                    flagsAround++;
                }
            }
        }

        // 周囲の旗の数が一致していれば、旗がないマスを開く
        if (flagsAround === cell.neighborMines) {
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    let nr = r + dr, nc = c + dc;
                    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                        if (!grid[nr][nc].isRevealed && !grid[nr][nc].isFlagged) {
                            revealCell(nr, nc);
                        }
                    }
                }
            }
        }
    }

    // ゲーム終了処理 (win: boolean)
    function triggerGameOver(win) {
        isGameOver = true;
        stopTimer();
        resetBtn.textContent = win ? '😎' : '😵';

        // 地雷を全て表示
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = grid[r][c];
                if (win) {
                    // 勝利時は地雷に全て旗を立てる
                    if (cell.isMine && !cell.isFlagged) {
                        cell.isFlagged = true;
                        flagsCount++;
                        updateCellDOM(r, c);
                    }
                } else {
                    // 敗北時は地雷を表示、間違った旗にはバツをつけるなどの拡張も可能
                    if (cell.isMine && !cell.isFlagged) {
                        cell.isRevealed = true;
                        updateCellDOM(r, c);
                    }
                }
            }
        }
        if (win) updateMineCountDisplay();
    }

    // --- イベントバインディング --- //[cite: 1]

    // 難易度ボタンのクリック
    content.querySelectorAll(".difficulty-btn").forEach(btn => {
        btn.onclick = () => {
            const r = parseInt(btn.getAttribute("data-rows"));
            const c = parseInt(btn.getAttribute("data-cols"));
            const m = parseInt(btn.getAttribute("data-mines"));
            initGame(r, c, m);
            showMenu2();
        };
    });

    // メニューへ戻るボタン
    btnMenu.onclick = showMenu1;

    // リセット（顔）ボタン
    resetBtn.onclick = () => {
        initGame(rows, cols, totalMines);
    };

    // モード切替ボタン (モバイル用)
    toggleModeBtn.onclick = () => {
        if (actionMode === 'dig') {
            actionMode = 'flag';
            toggleModeBtn.textContent = 'モード: 🚩 旗';
            toggleModeBtn.style.color = 'darkred';
        } else {
            actionMode = 'dig';
            toggleModeBtn.textContent = 'モード: ⛏️ 掘る';
            toggleModeBtn.style.color = 'blue';
        }
    };

    // ボードのクリック制御（イベントデリゲーション）
    boardElem.addEventListener('contextmenu', (e) => {
        e.preventDefault(); // 右クリックメニューを禁止
        const cellElem = e.target.closest('.cell');
        if (cellElem && !isGameOver) {
            let r = parseInt(cellElem.dataset.r);
            let c = parseInt(cellElem.dataset.c);
            toggleFlag(r, c);
        }
    });

    boardElem.addEventListener('pointerdown', (e) => {
        if (e.button === 2) return; // 右クリックはcontextmenuに任せる
        const cellElem = e.target.closest('.cell');

        if (cellElem && !isGameOver) {
            let r = parseInt(cellElem.dataset.r);
            let c = parseInt(cellElem.dataset.c);

            // すでに開いているマスの場合はコード操作を試みる
            if (grid[r][c].isRevealed) {
                chordCell(r, c);
                return;
            }

            // 未開のマスの場合、モードに応じて処理
            if (actionMode === 'flag') {
                toggleFlag(r, c);
            } else {
                revealCell(r, c);
            }
        }
    });

    // 初期化時はメニュー1を表示
    showMenu1();

    // ★ kernel.js からの killProcess(key) 呼び出しと連携するdisposeオブジェクトを返却[cite: 1]
    return {
        dispose: () => {
            // タイマーを完全に停止してゾンビ処理を防止[cite: 1]
            if (timerID) {
                clearTimeout(timerID);
                timerID = null;
            }
        }
    };
}