// tetris.js
export default function TetrisApp(content, options) {
    if (!content) return;

    // ウィンドウサイズの設定（テトリスのUIに合わせて調整）
    const win = content.parentElement;
    if (win) {
        win.style.width = "420px";
        win.style.height = "600px";
        win.style.backgroundColor = "dimgray";
    }

    content.classList.add("scrollbar_none");
    content.style.overflow = "hidden";
    content.tabIndex = 0; // キーボードイベントをここで受け付けるため

    // --- HTML & CSS の生成 ---
    content.innerHTML = `
        <style>
            .tetris-wrapper { 
                font-family: sans-serif; 
                height: 100%; 
                color: white; 
                background-color: dimgray; 
                display: flex; 
                flex-direction: column; 
                touch-action: manipulation; 
            }
            .tetris-wrapper p { margin: 0; padding: 0; }
            .tetris-wrapper button { 
                cursor: pointer; 
                border: 1px solid #aaa; 
                font-weight: bold; 
                border-radius: 4px; 
            }
            
            /* メニュー1（難易度選択） */
            .tetris_menu1 { 
                display: flex; 
                flex-direction: column; 
                gap: 15px; 
                padding: 20px; 
                align-items: center; 
                justify-content: center; 
                height: 100%; 
            }
            .difficulty-btn { 
                width: 70%; 
                height: 50px; 
                font-size: 1.2rem; 
                box-shadow: 1.8px 1.8px #333, -1.8px -1.8px whitesmoke;
            }
            .difficulty-btn:active { box-shadow: none; transform: translateY(2px); }
            
            /* メニュー2（ゲーム画面） */
            .tetris_menu2 { 
                display: none; 
                padding: 15px; 
                height: 100%; 
                box-sizing: border-box; 
                background-color: #333;
            }
            .game-container { display: flex; gap: 15px; justify-content: center; }
            .panel-container { display: flex; flex-direction: column; gap: 10px; }
            
            canvas { background-color: black; border: 1px solid dimgray; }
            
            /* 操作ボタン類 */
            .controls { 
                display: grid; 
                grid-template-columns: repeat(3, 1fr); 
                gap: 5px; 
                margin-top: 20px; 
            }
            .tetbtn { 
                height: 60px; 
                background: linear-gradient(0deg, #222, #555); 
                color: white; 
                font-size: 1.2rem; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                user-select: none; 
            }
            .tetbtn:active { background: #444; }
            
            .bottom-actions { 
                display: flex; 
                justify-content: space-between; 
                margin-top: 20px; 
            }
            .bottom-actions button { 
                padding: 10px; 
                font-size: 0.9rem; 
                background: #ddd; 
                color: black; 
                flex: 1;
                margin: 0 5px;
            }
        </style>

        <div class="tetris-wrapper">
            <div class="tetris_menu1">
                <h2 style="margin-bottom: 20px;">テトリス(改)</h2>
                <button class="difficulty-btn" data-mode="1" style="background-color: yellow; color: black;">イージー</button>
                <button class="difficulty-btn" data-mode="2" style="background-color: yellowgreen; color: black;">ノーマル</button>
                <button class="difficulty-btn" data-mode="3" style="background-color: red; color: white;">ハード</button>
                <button class="difficulty-btn" data-mode="4" style="background-color: purple; color: white;">エクストラ</button>
                <button class="difficulty-btn" data-mode="5" style="background-color: green; color: white;">鬼畜</button>
                <p style="margin-top: 30px; font-size: 0.8rem; color: #ffa8a8; text-align: center;">
                    ※注意<br>ブラウザーの履歴を削除した場合、<br>保存されているデータが消える可能性があります。
                </p>
            </div>

            <div class="tetris_menu2">
                <div class="game-container">
                    <canvas id="stage" width="250" height="500"></canvas>
                    <div class="panel-container">
                        <div>
                            <p style="font-size: 0.9rem;">Next</p>
                            <canvas id="next" width="110" height="80"></canvas>
                        </div>
                        <div>
                            <p style="font-size: 0.9rem;">HOLD</p>
                            <canvas id="hold" width="110" height="80"></canvas>
                        </div>
                        <div style="font-size: 0.8rem;">
                            <p>スコア: <span id="lines">0</span></p>
                            <p>最高: <span id="lines2">0</span></p>
                            <p id="message" style="color: #ff5555; font-weight: bold; margin-top: 5px; height: 1em;"></p>
                            <p><span id="stop_text" style="color: orange; font-weight: bold; font-size: 1rem;"></span></p>
                        </div>
                    </div>
                </div>
                
                <div class="controls">
                    <button id="btn-hold" class="tetbtn" style="font-size: 0.9rem;">HOLD</button>
                    <button id="btn-rotate" class="tetbtn">↻</button>
                    <button id="btn-fall-hard" class="tetbtn">⇓</button>
                    
                    <button id="btn-left" class="tetbtn">←</button>
                    <button id="btn-fall" class="tetbtn">↓</button>
                    <button id="btn-right" class="tetbtn">→</button>
                </div>

                <div class="bottom-actions">
                    <button id="btn-pause">一時停止 / 再開</button>
                    <button id="btn-menu">難易度選択</button>
                </div>
            </div>
        </div>
    `;

    // --- DOM要素の取得 ---
    const menu1 = content.querySelector('.tetris_menu1');
    const menu2 = content.querySelector('.tetris_menu2');
    const stageCanvas = content.querySelector('#stage');
    const nextCanvas = content.querySelector('#next');
    const holdCanvas = content.querySelector('#hold');
    const linesElem = content.querySelector('#lines');
    const linesElem2 = content.querySelector('#lines2');
    const messageElem = content.querySelector('#message');
    const stopText = content.querySelector('#stop_text');

    // 状態管理フラグ
    let tetris_loop = false;

    // ハイスコア初期化
    const storedHighScore = localStorage.getItem('tetris_score');
    if (storedHighScore) linesElem2.textContent = storedHighScore;

    // --- ゲームロジック (統合) ---
    class Tetris {
        constructor() {
            this.stageWidth = 10;
            this.stageHeight = 20;
            this.stageCanvas = stageCanvas; // HTMLから取得したものを割り当て
            this.nextCanvas = nextCanvas;
            this.holdCanvas = holdCanvas;

            let cellWidth = this.stageCanvas.width / this.stageWidth;
            let cellHeight = this.stageCanvas.height / this.stageHeight;
            this.cellSize = cellWidth < cellHeight ? cellWidth : cellHeight;
            this.stageLeftPadding = (this.stageCanvas.width - this.cellSize * this.stageWidth) / 2;
            this.stageTopPadding = (this.stageCanvas.height - this.cellSize * this.stageHeight) / 2;
            this.blocks = this.createBlocks();
            this.deletedLines = 0;

            this.holdBlock = null;
            this.holdUsed = false;
            this.lastBlock = null;
            this.timerID = null;
        }

        createBlocks() {
            return [
                { shape: [[[-1, 0], [0, 0], [1, 0], [2, 0]], [[0, -1], [0, 0], [0, 1], [0, 2]], [[-1, 0], [0, 0], [1, 0], [2, 0]], [[0, -1], [0, 0], [0, 1], [0, 2]]], color: "rgb(0, 255, 255)", highlight: "rgb(255, 255, 255)", shadow: "rgb(0, 128, 128)" },
                { shape: [[[0, 0], [1, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [0, 1], [1, 1]]], color: "rgb(255, 255, 0)", highlight: "rgb(255, 255, 255)", shadow: "rgb(128, 128, 0)" },
                { shape: [[[0, 0], [1, 0], [-1, 1], [0, 1]], [[-1, -1], [-1, 0], [0, 0], [0, 1]], [[0, 0], [1, 0], [-1, 1], [0, 1]], [[-1, -1], [-1, 0], [0, 0], [0, 1]]], color: "rgb(0, 255, 0)", highlight: "rgb(255, 255, 255)", shadow: "rgb(0, 128, 0)" },
                { shape: [[[-1, 0], [0, 0], [0, 1], [1, 1]], [[0, -1], [-1, 0], [0, 0], [-1, 1]], [[-1, 0], [0, 0], [0, 1], [1, 1]], [[0, -1], [-1, 0], [0, 0], [-1, 1]]], color: "rgb(255, 0, 0)", highlight: "rgb(255, 255, 255)", shadow: "rgb(128, 0, 0)" },
                { shape: [[[-1, -1], [-1, 0], [0, 0], [1, 0]], [[0, -1], [1, -1], [0, 0], [0, 1]], [[-1, 0], [0, 0], [1, 0], [1, 1]], [[0, -1], [0, 0], [-1, 1], [0, 1]]], color: "rgb(0, 0, 255)", highlight: "rgb(255, 255, 255)", shadow: "rgb(0, 0, 128)" },
                { shape: [[[1, -1], [-1, 0], [0, 0], [1, 0]], [[0, -1], [0, 0], [0, 1], [1, 1]], [[-1, 0], [0, 0], [1, 0], [-1, 1]], [[-1, -1], [0, -1], [0, 0], [0, 1]]], color: "rgb(255, 165, 0)", highlight: "rgb(255, 255, 255)", shadow: "rgb(128, 82, 0)" },
                { shape: [[[0, -1], [-1, 0], [0, 0], [1, 0]], [[0, -1], [0, 0], [1, 0], [0, 1]], [[-1, 0], [0, 0], [1, 0], [0, 1]], [[0, -1], [-1, 0], [0, 0], [0, 1]]], color: "rgb(255, 0, 255)", highlight: "rgb(255, 255, 255)", shadow: "rgb(128, 0, 128)" },
                { shape: [[[0, 0], [0, 0], [0, 0], [0, 0]], [[0, 1], [-1, 0], [-1, 1], [0, 1]], [[-1, 1], [-1, 0], [0, 0], [0, 1]], [[0, 0], [0, 0], [0, 1], [0, -1]]], color: "rgb(100, 100, 100)", highlight: "rgb(255, 255, 255)", shadow: "rgb(128, 128, 128)" }
            ];
        }

        hold() {
            if (this.holdUsed) return;
            this.clear(this.stageCanvas);
            if (this.holdBlock == null) {
                this.holdBlock = this.currentBlock;
                this.createNewBlock();
            } else {
                let temp = this.currentBlock;
                this.currentBlock = this.holdBlock;
                this.holdBlock = temp;
                this.blockX = Math.floor(this.stageWidth / 2 - 2);
                this.blockY = 0;
                this.blockAngle = 0;
            }
            this.holdUsed = true;
            this.refreshStage();
            this.drawHoldBlock();
        }

        drawHoldBlock() {
            this.clear(this.holdCanvas);
            if (this.holdBlock != null) {
                this.drawBlock(this.cellSize * 1.25, this.cellSize, this.holdBlock, 0, this.holdCanvas);
            }
        }

        drawGhostBlock(x, y, type, angle, canvas) {
            let ghostY = y;
            while (this.checkBlockMove(x, ghostY + 1, type, angle)) ghostY++;
            let context = canvas.getContext("2d");
            context.strokeStyle = "rgba(255, 255, 255, 1)";
            context.lineWidth = 2.5;

            for (let i = 0; i < this.blocks[type].shape[angle].length; i++) {
                let cellX = x + this.blocks[type].shape[angle][i][0];
                let cellY = ghostY + this.blocks[type].shape[angle][i][1];
                let drawX = this.stageLeftPadding + cellX * this.cellSize + 0.5;
                let drawY = this.stageTopPadding + cellY * this.cellSize + 0.5;
                let size = this.cellSize - 1;
                context.strokeRect(drawX, drawY, size, size);
            }
        }

        drawBlock(x, y, type, angle, canvas) {
            let context = canvas.getContext("2d");
            let block = this.blocks[type];
            for (let i = 0; i < block.shape[angle].length; i++) {
                this.drawCell(context, x + (block.shape[angle][i][0] * this.cellSize), y + (block.shape[angle][i][1] * this.cellSize), this.cellSize, type);
            }
        }

        drawCell(context, cellX, cellY, cellSize, type) {
            let block = this.blocks[type];
            let adjustedX = cellX + 0.5;
            let adjustedY = cellY + 0.5;
            let adjustedSize = cellSize - 1;
            context.fillStyle = block.color;
            context.fillRect(adjustedX, adjustedY, adjustedSize, adjustedSize);

            context.strokeStyle = block.highlight;
            context.beginPath();
            context.moveTo(adjustedX, adjustedY + adjustedSize);
            context.lineTo(adjustedX, adjustedY);
            context.lineTo(adjustedX + adjustedSize, adjustedY);
            context.stroke();

            context.strokeStyle = block.shadow;
            context.beginPath();
            context.moveTo(adjustedX, adjustedY + adjustedSize);
            context.lineTo(adjustedX + adjustedSize, adjustedY + adjustedSize);
            context.lineTo(adjustedX + adjustedSize, adjustedY);
            context.stroke();
        }

        drawStageGrid() {
            let context = this.stageCanvas.getContext("2d");
            context.beginPath();
            for (let i = 0; i <= this.stageWidth; i++) {
                context.moveTo(i * this.cellSize, 0);
                context.lineTo(i * this.cellSize, this.stageCanvas.height);
            }
            for (let j = 0; j <= this.stageCanvas.height / this.cellSize; j++) {
                context.moveTo(0, j * this.cellSize);
                context.lineTo(this.stageCanvas.width, j * this.cellSize);
            }
            context.strokeStyle = "rgba(255, 255, 255, 0.5)";
            context.lineWidth = 1;
            context.stroke();
        }

        initGameSession() {
            tetris_loop = false;
            clearTimeout(this.timerID);
            this.timerID = null;
            let virtualStage = new Array(this.stageWidth);
            for (let i = 0; i < this.stageWidth; i++) {
                virtualStage[i] = new Array(this.stageHeight).fill(null);
            }
            this.virtualStage = virtualStage;
            this.currentBlock = null;
            this.nextBlock = this.getRandomBlock();
            this.clearHoldBlock();
            this.deletedLines = 0;
            linesElem.innerText = "0";
            messageElem.innerText = "";
        }

        startGame() { this.initGameSession(); this.mainLoop(800); }
        startGame2() { this.initGameSession(); this.mainLoop(500); }
        startGame3() { this.initGameSession(); this.mainLoop(250); }
        startGame4() { this.initGameSession(); this.mainLoop(100); }
        startGame5() { this.initGameSession(); this.mainLoop(50); }

        mainLoop(speed) {
            if (!tetris_loop) {
                if (this.currentBlock == null) {
                    if (!this.createNewBlock()) return;
                } else {
                    this.fallBlock();
                }
                this.refreshStage();
            }
            this.timerID = setTimeout(() => this.mainLoop(speed), speed);
        }

        createNewBlock() {
            this.currentBlock = this.nextBlock;
            this.nextBlock = this.getRandomBlock();
            this.blockX = Math.floor(this.stageWidth / 2 - 2);
            this.blockY = 0;
            this.blockAngle = 0;
            this.drawNextBlock();
            this.holdUsed = false;
            if (!this.checkBlockMove(this.blockX, this.blockY, this.currentBlock, this.blockAngle)) {
                messageElem.innerText = "GAME OVER";
                return false;
            }
            return true;
        }

        drawNextBlock() {
            this.clear(this.nextCanvas);
            this.drawBlock(this.cellSize * 1.2, this.cellSize, this.nextBlock, 0, this.nextCanvas);
        }

        getRandomBlock() {
            let newBlock;
            if (this.lastBlock === null) {
                newBlock = Math.floor(Math.random() * 8);
            } else {
                do { newBlock = Math.floor(Math.random() * 8); } while (newBlock === this.lastBlock);
            }
            this.lastBlock = newBlock;
            return newBlock;
        }

        fallBlock() {
            if (this.checkBlockMove(this.blockX, this.blockY + 1, this.currentBlock, this.blockAngle)) {
                this.blockY++;
            } else {
                this.fixBlock(this.blockX, this.blockY, this.currentBlock, this.blockAngle);
                this.currentBlock = null;
            }
        }

        checkBlockMove(x, y, type, angle) {
            for (let i = 0; i < this.blocks[type].shape[angle].length; i++) {
                let cellX = x + this.blocks[type].shape[angle][i][0];
                let cellY = y + this.blocks[type].shape[angle][i][1];
                if (cellX < 0 || cellX > this.stageWidth - 1) return false;
                if (cellY > this.stageHeight - 1) return false;
                if (this.virtualStage[cellX][cellY] != null) return false;
            }
            return true;
        }

        fixBlock(x, y, type, angle) {
            for (let i = 0; i < this.blocks[type].shape[angle].length; i++) {
                let cellX = x + this.blocks[type].shape[angle][i][0];
                let cellY = y + this.blocks[type].shape[angle][i][1];
                if (cellY >= 0) this.virtualStage[cellX][cellY] = type;
            }
            for (let yLine = this.stageHeight - 1; yLine >= 0;) {
                let filled = true;
                for (let xCheck = 0; xCheck < this.stageWidth; xCheck++) {
                    if (this.virtualStage[xCheck][yLine] == null) { filled = false; break; }
                }
                if (filled) {
                    for (let y2 = yLine; y2 > 0; y2--) {
                        for (let xShift = 0; xShift < this.stageWidth; xShift++) {
                            this.virtualStage[xShift][y2] = this.virtualStage[xShift][y2 - 1];
                        }
                    }
                    for (let xClear = 0; xClear < this.stageWidth; xClear++) {
                        this.virtualStage[xClear][0] = null;
                    }
                    this.deletedLines++;
                    linesElem.innerText = "" + this.deletedLines;

                    let highScore = localStorage.getItem('tetris_score');
                    if (highScore === null || this.deletedLines > parseInt(highScore)) {
                        localStorage.setItem('tetris_score', this.deletedLines);
                        linesElem2.innerText = this.deletedLines;
                    }
                } else {
                    yLine--;
                }
            }
        }

        drawStage() {
            this.drawStageGrid();
            let context = this.stageCanvas.getContext("2d");
            for (let x = 0; x < this.virtualStage.length; x++) {
                for (let y = 0; y < this.virtualStage[x].length; y++) {
                    if (this.virtualStage[x][y] != null) {
                        this.drawCell(context, this.stageLeftPadding + (x * this.cellSize), this.stageTopPadding + (y * this.cellSize), this.cellSize, this.virtualStage[x][y]);
                    }
                }
            }
        }

        moveLeft() { if (this.checkBlockMove(this.blockX - 1, this.blockY, this.currentBlock, this.blockAngle)) { this.blockX--; this.refreshStage(); } }
        moveRight() { if (this.checkBlockMove(this.blockX + 1, this.blockY, this.currentBlock, this.blockAngle)) { this.blockX++; this.refreshStage(); } }
        rotate() {
            let newAngle = this.blockAngle < 3 ? this.blockAngle + 1 : 0;
            if (this.checkBlockMove(this.blockX, this.blockY, this.currentBlock, newAngle)) { this.blockAngle = newAngle; this.refreshStage(); }
        }
        fall() { if (this.checkBlockMove(this.blockX, this.blockY + 1, this.currentBlock, this.blockAngle)) { this.blockY++; this.refreshStage(); } }
        fall2() { while (this.checkBlockMove(this.blockX, this.blockY + 1, this.currentBlock, this.blockAngle)) { this.blockY++; this.refreshStage(); } }

        refreshStage() {
            this.clear(this.stageCanvas);
            this.drawStage();
            if (this.currentBlock != null) {
                this.drawGhostBlock(this.blockX, this.blockY, this.currentBlock, this.blockAngle, this.stageCanvas);
                this.drawBlock(this.stageLeftPadding + this.blockX * this.cellSize, this.stageTopPadding + this.blockY * this.cellSize, this.currentBlock, this.blockAngle, this.stageCanvas);
            }
        }

        clearHoldBlock() { this.holdBlock = null; this.clear(this.holdCanvas); }
        clear(canvas) {
            let context = canvas.getContext("2d");
            context.fillStyle = "rgb(0, 0, 0)";
            context.fillRect(0, 0, canvas.width, canvas.height);
        }
    }

    const game = new Tetris();

    // --- イベントバインディング ---

    // 画面切り替え機能
    function showMenu1() {
        menu1.style.display = "flex";
        menu2.style.display = "none";
        tetris_loop = true; // メニュー画面に戻ったら一時停止
        stopText.textContent = "";
    }

    function showMenu2() {
        menu1.style.display = "none";
        menu2.style.display = "block";
        content.focus(); // キーボード入力を受け付けるためにフォーカス
    }

    // 難易度ボタン
    content.querySelectorAll(".difficulty-btn").forEach(btn => {
        btn.onclick = () => {
            const mode = btn.getAttribute("data-mode");
            stopText.textContent = "";
            showMenu2();
            if (mode === "1") game.startGame();
            if (mode === "2") game.startGame2();
            if (mode === "3") game.startGame3();
            if (mode === "4") game.startGame4();
            if (mode === "5") game.startGame5();
        };
    });

    // メニューへ戻る・ポーズボタン
    content.querySelector("#btn-pause").onclick = () => {
        tetris_loop = !tetris_loop;
        stopText.textContent = tetris_loop ? "停止中" : "";
        content.focus();
    };
    content.querySelector("#btn-menu").onclick = showMenu1;

    // タッチ/マウス押しっぱなし対応ハンドラー
    function addContinuousHandler(btn, action, intervalTime) {
        if (!btn) return;
        let intervalId;
        const startAction = (e) => {
            if (e.type === "touchstart") e.preventDefault();
            if (!tetris_loop) {
                action();
                intervalId = setInterval(() => {
                    if (!tetris_loop) action();
                }, intervalTime);
            }
        };
        const stopAction = () => clearInterval(intervalId);

        btn.addEventListener("mousedown", startAction);
        btn.addEventListener("mouseup", stopAction);
        btn.addEventListener("mouseleave", stopAction);
        btn.addEventListener("touchstart", startAction, { passive: false });
        btn.addEventListener("touchend", stopAction);
        btn.addEventListener("touchcancel", stopAction);
    }

    // 各ボタンのアクション紐付け
    addContinuousHandler(content.querySelector("#btn-left"), () => game.moveLeft(), 150);
    addContinuousHandler(content.querySelector("#btn-rotate"), () => game.rotate(), 150);
    addContinuousHandler(content.querySelector("#btn-right"), () => game.moveRight(), 150);
    addContinuousHandler(content.querySelector("#btn-fall"), () => game.fall(), 150);
    addContinuousHandler(content.querySelector("#btn-fall-hard"), () => game.fall2(), 150);
    addContinuousHandler(content.querySelector("#btn-hold"), () => game.hold(), 150);

    // キーボード操作
    content.addEventListener("keydown", (e) => {
        if (tetris_loop) return;
        // 矢印キーなどでの画面スクロールを防ぐ
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
            e.preventDefault();
        }
        if (e.keyCode === 37) game.moveLeft();
        else if (e.keyCode === 38) game.rotate();
        else if (e.keyCode === 39) game.moveRight();
        else if (e.keyCode === 40) game.fall();
        else if (e.keyCode === 67) game.hold(); // 'C' キー
        else if (e.keyCode === 13) game.fall2(); // 'Enter' キー
    });
}