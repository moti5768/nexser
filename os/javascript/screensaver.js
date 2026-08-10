import { loadSetting } from "./apps/settings.js";

let idleTimer = null;
let isScreensaverActive = false;
let screensaverLayer = null;

// 設定値のキャッシュ
let currentType = "none";
let waitTimeMs = 10 * 60 * 1000; // デフォルト10分

let currentPreviewCleanup = null;
let currentFullscreenCleanup = null; // ★ フルスクリーン用のクリーンアップ保持変数

/**
 * 設定を読み込み、タイマーをリセットする
 */
async function refreshSettings() {
    currentType = (await loadSetting("screensaverType")) || "none";
    const waitMinutes = parseInt(await loadSetting("screensaverWait"), 10) || 10;
    waitTimeMs = waitMinutes * 60 * 1000;

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
    container.style.background = "black"; // ★ コメントアウトを解除して背景を黒に設定
    container.style.overflow = "hidden";

    let animationFrameId = null;

    if (type === "blank") {
        // 何もしない（背景が黒のままになる）
    } else if (type === "text") {
        const textEl = document.createElement("div");
        textEl.textContent = "Nexser";
        textEl.style.cssText = `
            position: absolute;
            color: #fff;
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

        // ★ フルスクリーン時は実画面サイズ、プレビュー時はコンテナサイズ（最低保証付き）を安全に取得
        const width = isFullscreen ? window.innerWidth : (container.clientWidth || 132);
        const height = isFullscreen ? window.innerHeight : (container.clientHeight || 90);

        canvas.width = width;
        canvas.height = height;
        canvas.style.cssText = "position: absolute; top: 0; left: 0; width: 100%; height: 100%;";
        container.appendChild(canvas);

        const ctx = canvas.getContext("2d");

        function createShape() {
            const points = [];
            for (let i = 0; i < 4; i++) {
                points.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    vx: (Math.random() - 0.5) * (isFullscreen ? 8 : 3),
                    vy: (Math.random() - 0.5) * (isFullscreen ? 8 : 3)
                });
            }
            return { points, color: `hsl(${Math.random() * 360}, 100%, 50%)` };
        }

        const shape1 = createShape();
        const shape2 = createShape();

        function updateAndDraw(shape) {
            ctx.beginPath();
            ctx.moveTo(shape.points[0].x, shape.points[0].y);
            for (let i = 0; i < shape.points.length; i++) {
                const p = shape.points[i];
                p.x += p.vx;
                p.y += p.vy;
                if (p.x <= 0 || p.x >= canvas.width) p.vx *= -1;
                if (p.y <= 0 || p.y >= canvas.height) p.vy *= -1;
                ctx.lineTo(p.x, p.y);
            }
            ctx.closePath();
            ctx.strokeStyle = shape.color;
            ctx.stroke();
        }

        function animateMystify() {
            ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            updateAndDraw(shape1);
            updateAndDraw(shape2);

            animationFrameId = requestAnimationFrame(animateMystify);
        }
        animateMystify();
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