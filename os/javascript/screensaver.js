// Screensaver.js
import { loadSetting } from "./apps/settings.js";

let idleTimer = null;
let isScreensaverActive = false;
let screensaverLayer = null;

// 設定値のキャッシュ
let currentType = "none";
let waitTimeMs = 10 * 60 * 1000; // デフォルト10分
let currentTextColor = "#ff0000"; // ★追加: テキスト色のキャッシュ
let currentMazeWallColor = "#008080";
let currentMazeFloorColor = "#333333";
let currentMazeCeilingColor = "#555555";
let currentMystifyLines = 5; // ★追加: Mystifyの線の数（デフォルト5）
let currentMystifyColor1 = "#00ff00"; // ★追加: Mystifyオブジェクト1の色
let currentMystifyColor2 = "#00ffff"; // ★追加: Mystifyオブジェクト2の色

// ★追加: Starfieldの設定キャッシュ
let currentStarfieldCount = 200;
let currentStarfieldSpeed = 4;
let currentStarfieldColor = "#ffffff";

// ★追加: 伝言板 (Marquee) の設定キャッシュ
let currentMarqueeText = "伝言板";
let currentMarqueeTextColor = "#ffffff";
let currentMarqueeBgColor = "#000000";
let currentMarqueeSpeed = 5;

let currentPreviewCleanup = null;
let currentFullscreenCleanup = null;

/**
 * 設定を読み込み、タイマーをリセットする
 */
async function refreshSettings() {
    currentType = (await loadSetting("screensaverType")) || "none";
    const waitMinutes = parseInt(await loadSetting("screensaverWait"), 10) || 10;
    waitTimeMs = waitMinutes * 60 * 1000;

    currentTextColor = (await loadSetting("screensaverColor_text")) || "#ff0000";

    currentMazeWallColor = (await loadSetting("screensaverColor_maze_wall")) || "#008080";
    currentMazeFloorColor = (await loadSetting("screensaverColor_maze_floor")) || "#333333";
    currentMazeCeilingColor = (await loadSetting("screensaverColor_maze_ceiling")) || "#555555";

    // ★修正: Mystifyの設定を確実に最新化
    const rawLines = parseInt(await loadSetting("screensaverMystifyLines"), 10) || 5;
    currentMystifyLines = Math.min(15, Math.max(1, rawLines));
    currentMystifyColor1 = (await loadSetting("screensaverColor_mystify_1")) || "#00ff00";
    currentMystifyColor2 = (await loadSetting("screensaverColor_mystify_2")) || "#00ffff";

    const rawStarCount = parseInt(await loadSetting("screensaverStarfieldCount"), 10) || 200;
    currentStarfieldCount = Math.min(1000, Math.max(10, rawStarCount));
    const rawStarSpeed = parseInt(await loadSetting("screensaverStarfieldSpeed"), 10) || 4;
    currentStarfieldSpeed = Math.min(20, Math.max(1, rawStarSpeed));
    currentStarfieldColor = (await loadSetting("screensaverColor_starfield")) || "#ffffff";

    // ★追加: 伝言板の設定読み込み
    currentMarqueeText = (await loadSetting("screensaverMarqueeText")) ?? "伝言板";
    currentMarqueeTextColor = (await loadSetting("screensaverColor_marquee_text")) || "#ffffff";
    currentMarqueeBgColor = (await loadSetting("screensaverColor_marquee_bg")) || "#000000";
    const rawMarqueeSpeed = parseInt(await loadSetting("screensaverMarqueeSpeed"), 10) || 5;
    currentMarqueeSpeed = Math.min(10, Math.max(1, rawMarqueeSpeed));

    resetIdleTimer();
}

/**
 * タイマーをリセットする（ユーザー操作時に呼ばれる）
 */
function resetIdleTimer() {
    if (isScreensaverActive) {
        stopScreensaver();
    }
    if (idleTimer) clearTimeout(idleTimer);

    if (currentType !== "none") {
        idleTimer = setTimeout(startScreensaver, waitTimeMs);
    }
}

/**
 * スクリーンセーバーを起動する
 */
function startScreensaver() {
    if (isScreensaverActive || currentType === "none") return;
    isScreensaverActive = true;

    // オーバーレイとなる全画面の要素を作成
    screensaverLayer = document.createElement("div");
    screensaverLayer.id = "screensaver-layer";
    screensaverLayer.style.cssText = `
        position: fixed;
        top: 0; left: 0; width: 100vw; height: 100vh;
        background: black;
        color: white;
        z-index: 99999; /* 最前面に表示 */
        overflow: hidden;
        cursor: none
    `;

    document.body.appendChild(screensaverLayer);

    // ★ フルスクリーン用のクリーンアップ関数を受け取って保持する
    currentFullscreenCleanup = renderScreensaver(screensaverLayer, currentType, true);
}

/**
 * スクリーンセーバーを終了する
 */
function stopScreensaver() {
    if (!isScreensaverActive) return;
    isScreensaverActive = false;

    // ★ 保持していたフルスクリーン用クリーンアップを実行して確実にアニメーションを止める
    if (currentFullscreenCleanup) {
        currentFullscreenCleanup();
        currentFullscreenCleanup = null;
    }

    if (screensaverLayer && screensaverLayer.parentNode) {
        screensaverLayer.parentNode.removeChild(screensaverLayer);
    }
    screensaverLayer = null;

    // カーソル再描画の強制（ブラウザのバグ対策）
    document.body.style.cursor = "default";
    requestAnimationFrame(() => {
        document.body.style.cursor = "";
    });
}

/**
 * 設定画面から呼び出されるプレビュー用の描画関数
 */
export function startPreview(container, type) {
    if (currentPreviewCleanup) {
        currentPreviewCleanup();
        currentPreviewCleanup = null;
    }

    container.innerHTML = "";
    if (type === "none") {
        container.style.background = "#008080";
        return;
    }

    currentPreviewCleanup = renderScreensaver(container, type, false);
}

/**
 * 設定画面の「Preview」ボタンから強制的に全画面テスト起動する関数
 */
export function testScreensaver() {
    if (currentType === "none") return;
    startScreensaver();
}

/**
 * 実際のスクリーンセーバーの描画・アニメーション処理
 */
function renderScreensaver(container, type, isFullscreen) {
    container.style.background = "black";
    container.style.overflow = "hidden";

    let animationFrameId = null;

    // 共通のサイズ取得ヘルパー
    const getWidth = () => isFullscreen ? window.innerWidth : (container.clientWidth || 132);
    const getHeight = () => isFullscreen ? window.innerHeight : (container.clientHeight || 90);

    if (type === "blank") {
        // 何もしない（背景が黒のままになる）
    } else if (type === "marquee") {
        // ★追加: Windows 3.1 風 伝言板 (Marquee)
        const canvas = document.createElement("canvas");
        canvas.width = getWidth();
        canvas.height = getHeight();
        canvas.style.cssText = "position: absolute; top: 0; left: 0; width: 100%; height: 100%;";
        container.appendChild(canvas);

        const ctx = canvas.getContext("2d");
        const fontSize = isFullscreen ? 48 : 16;
        let x = canvas.width;
        const speed = isFullscreen ? currentMarqueeSpeed * 2 : Math.max(1, Math.floor(currentMarqueeSpeed / 2));

        function animateMarquee() {
            ctx.fillStyle = currentMarqueeBgColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = currentMarqueeTextColor;
            ctx.font = `bold ${fontSize}px sans-serif`;
            ctx.textBaseline = "middle";

            ctx.fillText(currentMarqueeText, x, canvas.height / 2);

            const textWidth = ctx.measureText(currentMarqueeText).width;
            x -= speed;
            if (x < -textWidth) {
                x = canvas.width;
            }

            animationFrameId = requestAnimationFrame(animateMarquee);
        }
        animateMarquee();

    } else if (type === "text") {
        const textEl = document.createElement("div");
        textEl.textContent = "Nexser";
        textEl.style.cssText = `
            position: absolute;
            color: ${currentTextColor};
            font-size: ${isFullscreen ? '48px' : '20px'};
            font-family: 'Times New Roman', serif;
            font-style: italic;
            font-weight: bold;
            white-space: nowrap;
            left: 0px;
            top: 0px;
        `;
        container.appendChild(textEl);

        let x = 10, y = 10;
        let vx = isFullscreen ? 3 : 1;
        let vy = isFullscreen ? 3 : 1;

        function animateText() {
            const w = container.clientWidth;
            const h = container.clientHeight;

            if (w > 0 && h > 0) {
                const tw = textEl.clientWidth;
                const th = textEl.clientHeight;

                x += vx;
                y += vy;

                let bounced = false;
                if (x + tw >= w || x <= 0) { vx *= -1; bounced = true; x = Math.max(0, Math.min(x, w - tw)); }
                if (y + th >= h || y <= 0) { vy *= -1; bounced = true; y = Math.max(0, Math.min(y, h - th)); }

                if (bounced) {
                    textEl.style.color = `hsl(${Math.random() * 360}, 100%, 50%)`;
                }

                textEl.style.left = `${x}px`;
                textEl.style.top = `${y}px`;
            }

            animationFrameId = requestAnimationFrame(animateText);
        }
        animateText();

    } else if (type === "mystify") {
        const canvas = document.createElement("canvas");
        canvas.width = getWidth();
        canvas.height = getHeight();
        canvas.style.cssText = "position: absolute; top: 0; left: 0; width: 100%; height: 100%;";
        container.appendChild(canvas);

        const ctx = canvas.getContext("2d");

        function createShape(color) {
            const points = [];
            for (let i = 0; i < 4; i++) {
                points.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    // 速度を少し速くして線と線の距離を広げる
                    vx: (Math.random() - 0.5) * (isFullscreen ? 12 : 4),
                    vy: (Math.random() - 0.5) * (isFullscreen ? 12 : 4)
                });
            }
            // 履歴更新のタイミングを調整するためのフレームカウンターを追加
            return { points, color, history: [], frameCount: 0 };
        }

        // ★変更: 2つのオブジェクトにそれぞれ設定された色を適用
        const shape1 = createShape(currentMystifyColor1);
        const shape2 = createShape(currentMystifyColor2);

        function updateAndDraw(shape) {
            for (let i = 0; i < shape.points.length; i++) {
                const p = shape.points[i];
                p.x += p.vx;
                p.y += p.vy;
                if (p.x <= 0 || p.x >= canvas.width) p.vx *= -1;
                if (p.y <= 0 || p.y >= canvas.height) p.vy *= -1;
            }

            // ★ 数フレームに1回だけ履歴を更新する（例: 2フレームに1回に間引く）
            shape.frameCount++;
            if (shape.frameCount % 2 === 0) {
                const currentPoints = shape.points.map(p => ({ x: p.x, y: p.y }));
                shape.history.unshift(currentPoints);
                if (shape.history.length > currentMystifyLines) {
                    shape.history.pop();
                }
            }

            // 履歴にあるすべての図形を描画（古いものほど薄くする）
            for (let hIndex = 0; hIndex < shape.history.length; hIndex++) {
                const pts = shape.history[hIndex];

                const alpha = 1 - (hIndex / shape.history.length);
                ctx.globalAlpha = Math.max(0.05, alpha);

                ctx.strokeStyle = shape.color;
                ctx.beginPath();
                ctx.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length; i++) {
                    ctx.lineTo(pts[i].x, pts[i].y);
                }
                ctx.closePath();
                ctx.stroke();
            }
            ctx.globalAlpha = 1.0;
        }

        function animateMystify() {
            // 背景を黒でクリア（履歴ベースで正確に描画するため）
            ctx.fillStyle = "black";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            updateAndDraw(shape1);
            updateAndDraw(shape2);

            animationFrameId = requestAnimationFrame(animateMystify);
        }
        animateMystify();

    } else if (type === "starfield") {
        // Win 3.1 風 Starfield（星空ワープ）
        const canvas = document.createElement("canvas");
        canvas.width = getWidth();
        canvas.height = getHeight();
        canvas.style.cssText = "position: absolute; top: 0; left: 0; width: 100%; height: 100%;";
        container.appendChild(canvas);

        const ctx = canvas.getContext("2d");

        // ★修正: キャッシュされた設定値を反映（プレビュー時は少なめ・遅めに調整）
        const numStars = isFullscreen ? currentStarfieldCount : Math.max(10, Math.floor(currentStarfieldCount / 4));
        const moveSpeed = isFullscreen ? currentStarfieldSpeed : Math.max(1, Math.floor(currentStarfieldSpeed / 2));

        const stars = [];

        for (let i = 0; i < numStars; i++) {
            stars.push({
                x: (Math.random() - 0.5) * canvas.width * 2,
                y: (Math.random() - 0.5) * canvas.height * 2,
                z: Math.random() * canvas.width
            });
        }

        function animateStarfield() {
            ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const cx = canvas.width / 2;
            const cy = canvas.height / 2;

            // ★修正: 星の色を設定から反映
            ctx.fillStyle = currentStarfieldColor;
            for (let i = 0; i < stars.length; i++) {
                const s = stars[i];
                s.z -= moveSpeed;
                if (s.z <= 0) {
                    s.z = canvas.width;
                    s.x = (Math.random() - 0.5) * canvas.width * 2;
                    s.y = (Math.random() - 0.5) * canvas.height * 2;
                }

                const k = 250 / s.z;
                const px = s.x * k + cx;
                const py = s.y * k + cy;

                if (px >= 0 && px < canvas.width && py >= 0 && py < canvas.height) {
                    const size = Math.max(1, (1 - s.z / canvas.width) * 3);
                    ctx.fillRect(px, py, size, size);
                }
            }

            animationFrameId = requestAnimationFrame(animateStarfield);
        }
        animateStarfield();

    } else if (type === "maze") {
        // Win 95/98 風 3D Maze（3D迷路）の完全再現版
        const canvas = document.createElement("canvas");
        canvas.width = getWidth();
        canvas.height = getHeight();
        canvas.style.cssText = "position: absolute; top: 0; left: 0; width: 100%; height: 100%;";
        container.appendChild(canvas);

        const ctx = canvas.getContext("2d");

        // 迷路のマップデータ (1: 壁, 0: 通路)
        const map = [
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 0, 0, 0, 1, 0, 0, 0, 0, 1],
            [1, 0, 1, 0, 1, 0, 1, 1, 0, 1],
            [1, 0, 1, 0, 0, 0, 0, 1, 0, 1],
            [1, 0, 1, 1, 1, 1, 0, 1, 0, 1],
            [1, 0, 0, 0, 0, 1, 0, 0, 0, 1],
            [1, 1, 1, 0, 1, 1, 1, 1, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 1, 0, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        ];

        let posX = 1.5, posY = 1.5;
        let dirX = 1, dirY = 0;
        let planeX = 0, planeY = 0.66;

        // ★ 直前にいたマスの座標と、Windows 95風の滑らかな旋回用変数
        let lastMapX = -1;
        let lastMapY = -1;
        let turnFramesLeft = 0;
        let turnStepAngle = 0;

        function animateMaze() {
            // 旋回中でなければ前進
            if (turnFramesLeft <= 0) {
                posX += dirX * 0.025;
                posY += dirY * 0.025;

                // 現在いるマスの座標を更新
                const currentMapX = Math.floor(posX);
                const currentMapY = Math.floor(posY);

                // ★ 前方の壁が近づいたら、衝突する前に滑らかな旋回を開始
                const nextX = posX + dirX * 0.2;
                const nextY = posY + dirY * 0.2;
                if (map[Math.floor(nextY)] && map[Math.floor(nextY)][Math.floor(nextX)] === 1) {
                    // 左右の方向ベクトルを計算
                    const leftDirX = -dirY;
                    const leftDirY = dirX;
                    const rightDirX = dirY;
                    const rightDirY = -dirX;

                    // 左右がそれぞれ通路（0）かどうか、かつどのマスかを確認
                    const leftX = Math.floor(posX + leftDirX * 0.5);
                    const leftY = Math.floor(posY + leftDirY * 0.5);
                    const rightX = Math.floor(posX + rightDirX * 0.5);
                    const rightY = Math.floor(posY + rightDirY * 0.5);

                    const canLeft = map[leftY]?.[leftX] === 0;
                    const canRight = map[rightY]?.[rightX] === 0;

                    // 直前にいたマスへの逆戻りを避けるための判定
                    const isLeftBack = (leftX === lastMapX && leftY === lastMapY);
                    const isRightBack = (rightX === lastMapX && rightY === lastMapY);

                    let turnDir = 1;
                    if (canLeft && canRight) {
                        if (isLeftBack && !isRightBack) turnDir = -1;
                        else if (isRightBack && !isLeftBack) turnDir = 1;
                        else turnDir = Math.random() > 0.5 ? 1 : -1;
                    } else if (canLeft) {
                        turnDir = 1;
                    } else if (canRight) {
                        turnDir = -1;
                    } else {
                        turnDir = Math.random() > 0.5 ? 1 : -1;
                    }

                    turnFramesLeft = 30; // 30フレームかけて滑らかに90度回転する
                    turnStepAngle = (Math.PI / 2 * turnDir) / turnFramesLeft;
                }

                // マスが切り替わったら「直前のマス」を更新
                if (currentMapX !== lastMapX || currentMapY !== lastMapY) {
                    lastMapX = currentMapX;
                    lastMapY = currentMapY;
                }
            } else {
                // ★ スムーズに回転（旋回アニメーション）中の処理
                turnFramesLeft--;
                const angle = turnStepAngle;

                const oldDirX = dirX;
                dirX = dirX * Math.cos(angle) - dirY * Math.sin(angle);
                dirY = oldDirX * Math.sin(angle) + dirY * Math.cos(angle);

                const oldPlaneX = planeX;
                planeX = planeX * Math.cos(angle) - planeY * Math.sin(angle);
                planeY = oldPlaneX * Math.sin(angle) + planeY * Math.cos(angle);
            }

            // レイキャスティングによる3D壁面描画（全体の事前ベタ塗りを廃止し、ストライプごとに天井・壁・床を一体で描画）
            const w = canvas.width;
            const h = canvas.height;
            const stripeWidth = isFullscreen ? 2 : 4;

            for (let x = 0; x < w; x += stripeWidth) {
                const cameraX = 2 * x / w - 1;
                const rayDirX = dirX + planeX * cameraX;
                const rayDirY = dirY + planeY * cameraX;

                let mapX = Math.floor(posX);
                let mapY = Math.floor(posY);

                let sideDistX, sideDistY;
                const deltaDistX = Math.abs(1 / rayDirX);
                const deltaDistY = Math.abs(1 / rayDirY);
                let perpWallDist;

                let stepX, stepY;
                let hit = 0, side = 0;

                if (rayDirX < 0) {
                    stepX = -1;
                    sideDistX = (posX - mapX) * deltaDistX;
                } else {
                    stepX = 1;
                    sideDistX = (mapX + 1.0 - posX) * deltaDistX;
                }
                if (rayDirY < 0) {
                    stepY = -1;
                    sideDistY = (posY - mapY) * deltaDistY;
                } else {
                    stepY = 1;
                    sideDistY = (mapY + 1.0 - posY) * deltaDistY;
                }

                while (hit === 0) {
                    if (sideDistX < sideDistY) {
                        sideDistX += deltaDistX;
                        mapX += stepX;
                        side = 0;
                    } else {
                        sideDistY += deltaDistY;
                        mapY += stepY;
                        side = 1;
                    }
                    if (map[mapY] && map[mapY][mapX] > 0) hit = 1;
                }

                if (side === 0) perpWallDist = (mapX - posX + (1 - stepX) / 2) / rayDirX;
                else perpWallDist = (mapY - posY + (1 - stepY) / 2) / rayDirY;

                const lineHeight = Math.floor(h / perpWallDist);
                let drawStart = Math.max(0, -lineHeight / 2 + h / 2);
                let drawEnd = Math.min(h - 1, lineHeight / 2 + h / 2);

                // 1. 天井の描画
                ctx.fillStyle = currentMazeCeilingColor;
                ctx.fillRect(x, 0, stripeWidth, drawStart);

                // 2. 壁の描画
                ctx.fillStyle = currentMazeWallColor;
                ctx.fillRect(x, drawStart, stripeWidth, drawEnd - drawStart);

                // 3. 床の描画
                ctx.fillStyle = currentMazeFloorColor;
                ctx.fillRect(x, drawEnd, stripeWidth, h - drawEnd);
            }

            animationFrameId = requestAnimationFrame(animateMaze);
        }
        animateMaze();
    }

    // クリーンアップ用の関数を返す
    return () => {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    };
}

/**
 * 初期化処理
 */
export async function initScreensaver() {
    await refreshSettings();
    window.addEventListener("mousemove", resetIdleTimer);
    window.addEventListener("mousedown", resetIdleTimer);
    window.addEventListener("keydown", resetIdleTimer);
    window.addEventListener("touchstart", resetIdleTimer);
    window.addEventListener("screensaver-settings-changed", refreshSettings);
}