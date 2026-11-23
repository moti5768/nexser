// Network_Monitor.js (Windows 95 MDI 対応版)
export default async function NetworkMonitorApp(content, options = {}) {
    const syscall = options?.syscall || null;
    const api = options?.windowAPI || syscall?.windowAPI || window.nexser?.windowAPI;
    const win = content.closest(".window");
    const parentStatusBar = win?._statusBar;

    // 2つの子ウィンドウを快適に並べて監視できる初期サイズを確保（未拡大時のみ）
    if (win && !win.classList.contains("maximized")) {
        const curW = parseInt(win.style.width, 10) || win.offsetWidth || 650;
        const curH = parseInt(win.style.height, 10) || win.offsetHeight || 350;
        if (curW < 760) win.style.width = `${Math.min(780, Math.max(650, window.innerWidth - 60))}px`;
        if (curH < 440) win.style.height = `${Math.min(480, Math.max(380, window.innerHeight - 90))}px`;
    }

    // 親コンテンツをクリアして Windows 95 準拠の MDI フレームを有効化
    content.innerHTML = "";
    const mdi = api?.enableMDI ? api.enableMDI(win) : null;
    if (!mdi) {
        content.innerHTML = `<div style="padding:12px; color:#800000;">MDI エンジンの初期化に失敗しました。</div>`;
        return { dispose: () => { } };
    }

    // カーネル管理タイマーがあれば優先利用し、なければ標準タイマーを利用
    const scheduleInterval = (fn, ms) => (syscall?.setInterval ? syscall.setInterval(fn, ms) : setInterval(fn, ms));
    const cancelInterval = (id) => {
        if (id == null) return;
        if (syscall?.clearInterval) syscall.clearInterval(id);
        else clearInterval(id);
    };

    // 子ウィンドウごとの状態・クリーンアップ管理
    const childCleanups = new Map();
    let networkInfoChildEl = null;
    let latencyChildSeq = 0;

    function updateParentStatusBar() {
        if (!parentStatusBar || !win?.isConnected) return;
        const list = mdi.getChildren();
        const active = mdi.getActiveChild();
        const activeTitle = active?.dataset?.title || "なし";
        parentStatusBar.style.display = "flex";
        parentStatusBar.innerHTML = `
            <div class="win95-status-cell" style="margin-right:8px;">MDI Windows: ${list.length}</div>
            <div class="win95-status-cell">Active: ${activeTitle}</div>
        `;
    }

    // 親ウィンドウ配下の MDI イベントを購読して親ステータスバーを自動同期
    const unsubs = [];
    const parentWinId = win?.dataset?.windowId;
    if (api?.onWindowEvent) {
        ["mdiChildCreated", "mdiChildActivated", "mdiChildDestroyed"].forEach(evName => {
            unsubs.push(api.onWindowEvent(evName, (detail) => {
                if (!detail || detail.parentId === parentWinId) {
                    updateParentStatusBar();
                }
            }));
        });
    }

    // 子ウィンドウ生成の共通ファクトリ
    async function openNetworkInfoChild() {
        if (networkInfoChildEl && networkInfoChildEl.isConnected) {
            mdi.activateChild(networkInfoChildEl);
            return networkInfoChildEl;
        }

        const childContent = api.createMDIChild(win, "Network Info", {
            icon: "📊",
            width: "370px",
            height: "360px",
            showStatus: true,
            onClose: (childId) => {
                const cleanup = childCleanups.get(childId);
                if (cleanup) {
                    try { cleanup(); } catch (_) { }
                    childCleanups.delete(childId);
                }
                if (networkInfoChildEl?.dataset?.windowId === childId) {
                    networkInfoChildEl = null;
                }
                updateParentStatusBar();
            }
        });

        const childWin = childContent?._mdiChild || childContent?.closest(".mdi-child-window");
        if (!childWin) return null;
        networkInfoChildEl = childWin;

        await renderNetworkInfo(childContent, childWin._statusBar);
        if (typeof childContent._cleanup === "function") {
            childCleanups.set(childWin.dataset.windowId, childContent._cleanup);
        }
        updateParentStatusBar();
        return childWin;
    }

    async function openLatencyTestChild(allowMultiple = false) {
        if (!allowMultiple) {
            const existing = mdi.getChildren().find(c => c.title.startsWith("Latency Test"));
            if (existing?.el?.isConnected) {
                mdi.activateChild(existing.el);
                return existing.el;
            }
        }

        latencyChildSeq += 1;
        const childTitle = latencyChildSeq === 1 ? "Latency Test" : `Latency Test #${latencyChildSeq}`;

        const childContent = api.createMDIChild(win, childTitle, {
            icon: "⚡",
            width: "380px",
            height: "360px",
            showStatus: true,
            onClose: (childId) => {
                const cleanup = childCleanups.get(childId);
                if (cleanup) {
                    try { cleanup(); } catch (_) { }
                    childCleanups.delete(childId);
                }
                updateParentStatusBar();
            }
        });

        const childWin = childContent?._mdiChild || childContent?.closest(".mdi-child-window");
        if (!childWin) return null;

        await renderLatencyTest(childContent, childWin._statusBar);
        if (typeof childContent._cleanup === "function") {
            childCleanups.set(childWin.dataset.windowId, childContent._cleanup);
        }
        updateParentStatusBar();
        return childWin;
    }

    // 親リボンに「Monitor」メニューを追加（Window メニューの整列＆子一覧は ribbon.js が自動生成）
    if (api?.setRibbonMenus) {
        api.setRibbonMenus(win, [
            {
                title: "Monitor",
                items: [
                    {
                        label: "Network Info を開く",
                        action: () => { openNetworkInfoChild(); }
                    },
                    {
                        label: "Latency Test を開く",
                        action: () => { openLatencyTestChild(false); }
                    },
                    {
                        label: "新しい Latency Test ウィンドウを追加",
                        action: () => { openLatencyTestChild(true); }
                    },
                    { label: "---" },
                    {
                        label: "標準レイアウト（左右に並べて監視）",
                        action: async () => {
                            await openNetworkInfoChild();
                            await openLatencyTestChild(false);
                            mdi.tileVertical();
                        }
                    }
                ]
            }
        ]);
    }

    // =================== MDI Child 1: Network Info & Throughput ===================
    async function renderNetworkInfo(root, childStatusBar) {
        root.style.display = "flex";
        root.style.flexDirection = "column";
        root.style.background = "#C3C7CB";

        root.innerHTML = `
            <div style="flex:1; display:flex; flex-direction:column; gap:6px; padding:6px; min-height:0;">
                <div style="background:#000080; color:#FFF; font-weight:bold; padding:4px 8px; font-size:12px; display:flex; justify-content:space-between; align-items:center;">
                    <span>📊 Network Adapter & Throughput Monitor</span>
                    <span id="adapterStatus" style="font-weight:normal; font-size:11px;">Status: Active</span>
                </div>

                <!-- スループット実測グラフエリア -->
                <div class="win95-panel" style="padding:4px; display:flex; flex-direction:column; gap:4px;">
                    <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:10px; gap:6px;">
                        <span>Throughput (Measured Actual Mbps)</span>
                        <span id="throughputText" style="color:#008000;">Waiting for measurement...</span>
                    </div>
                    <canvas id="throughputCanvas" class="border" style="display:block; width:100%; height:90px; background:#000;"></canvas>
                </div>

                <!-- 詳細プロパティテーブル -->
                <div class="border" style="flex:1; min-height:80px; overflow:auto; background:#FFF;">
                    <table style="width:100%; border-collapse:collapse; font-size:11px;">
                        <thead>
                            <tr style="background:#C0C0C0; text-align:left;">
                                <th style="padding:2px 4px;">Property</th>
                                <th style="padding:2px 4px;">Value</th>
                            </tr>
                        </thead>
                        <tbody id="adapterPropBody">
                            <tr><td style="padding:2px 4px;">Connection State</td><td style="padding:2px 4px; font-family:monospace; color:green;">Connected</td></tr>
                            <tr><td style="padding:2px 4px;">Estimated Speed (Downlink)</td><td id="propDownlink" style="padding:2px 4px; font-family:monospace;">-- Mbps</td></tr>
                            <tr><td style="padding:2px 4px;">Estimated Latency (RTT)</td><td id="propRtt" style="padding:2px 4px; font-family:monospace;">-- ms</td></tr>
                            <tr><td style="padding:2px 4px;">Effective Connection Type</td><td id="propEffectiveType" style="padding:2px 4px; font-family:monospace;">--</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        if (childStatusBar) {
            childStatusBar.style.display = "flex";
            childStatusBar.textContent = "Throughput: Waiting...";
        }

        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        const propDownlink = root.querySelector("#propDownlink");
        const propRtt = root.querySelector("#propRtt");
        const propEffectiveType = root.querySelector("#propEffectiveType");
        const throughputText = root.querySelector("#throughputText");
        const canvas = root.querySelector("#throughputCanvas");
        const ctx = canvas.getContext("2d");

        function updateData() {
            if (conn) {
                if (propDownlink) propDownlink.textContent = conn.downlink ? `${conn.downlink} Mbps` : "Unknown";
                if (propRtt) propRtt.textContent = conn.rtt ? `${conn.rtt} ms` : "Unknown";
                if (propEffectiveType) propEffectiveType.textContent = conn.effectiveType ? conn.effectiveType.toUpperCase() : "Unknown";
            }
        }

        updateData();

        // 実測値（実際のデータ転送速度）に基づくグラフ描画
        let throughputHistory = [];
        let isMeasuringThroughput = false;
        let throughputInterval = null;
        let disposed = false;

        async function measureThroughput() {
            // 非表示・破棄後は無駄な通信を防止
            if (disposed || !root.isConnected || document.hidden || isMeasuringThroughput) return;
            isMeasuringThroughput = true;

            const startTime = performance.now();
            try {
                const targetUrl = `${window.location.pathname}?_=${Date.now()}`;
                const response = await fetch(targetUrl, { cache: "no-store" });
                const buffer = await response.arrayBuffer();
                if (disposed || !root.isConnected) return;
                const endTime = performance.now();

                const durationSec = (endTime - startTime) / 1000;
                const bits = buffer.byteLength * 8;
                const instantMbps = durationSec > 0 ? Number((bits / durationSec / 1_000_000).toFixed(2)) : 0;

                throughputHistory.push(instantMbps);
                if (throughputHistory.length > 50) throughputHistory.shift();

                // 直近3回分の移動平均でグラフの急激なブレを抑えて滑らかにする
                const recentValues = throughputHistory.slice(-3);
                const avgMbps = Number((recentValues.reduce((a, b) => a + b, 0) / recentValues.length).toFixed(2));

                if (throughputText) throughputText.textContent = `Throughput: ${avgMbps} Mbps (Instant: ${instantMbps} Mbps)`;
                if (propDownlink) propDownlink.textContent = `${avgMbps} Mbps`;
                if (childStatusBar) childStatusBar.textContent = `Avg: ${avgMbps} Mbps | Instant: ${instantMbps} Mbps`;
            } catch (err) {
                if (disposed) return;
                throughputHistory.push(0);
                if (throughputHistory.length > 50) throughputHistory.shift();
                if (childStatusBar) childStatusBar.textContent = "Measurement failed";
            } finally {
                isMeasuringThroughput = false;
                if (!disposed && root.isConnected) {
                    drawThroughputChart();
                }
            }
        }

        function drawThroughputChart() {
            if (disposed || !canvas.isConnected) return;
            const rect = canvas.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;

            const dpr = window.devicePixelRatio || 1;
            canvas.width = Math.floor(rect.width * dpr);
            canvas.height = Math.floor(rect.height * dpr);

            ctx.save();
            ctx.scale(dpr, dpr);
            const logicalW = rect.width;
            const logicalH = rect.height;

            ctx.fillStyle = "#001100";
            ctx.fillRect(0, 0, logicalW, logicalH);

            // グリッドの描画
            ctx.strokeStyle = "#003300";
            ctx.lineWidth = 1;
            for (let x = 0; x < logicalW; x += 20) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, logicalH); ctx.stroke();
            }
            for (let y = 0; y < logicalH; y += 15) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(logicalW, y); ctx.stroke();
            }

            if (throughputHistory.length < 2) {
                ctx.restore();
                return;
            }

            const maxVal = Math.max(...throughputHistory, 10);
            const stepX = logicalW / (throughputHistory.length - 1);

            ctx.beginPath();
            ctx.strokeStyle = "#00FF00";
            ctx.lineWidth = 1.5;

            throughputHistory.forEach((val, i) => {
                const x = i * stepX;
                const y = logicalH - (val / maxVal) * (logicalH - 10) - 5;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
            ctx.restore();
        }

        // 初回実行と2秒間隔の定期計測
        measureThroughput();
        throughputInterval = scheduleInterval(measureThroughput, 2000);

        // タブの表示状態が変わったときのハンドリング（バックグラウンド時は停止）
        const handleVisibilityChange = () => {
            if (disposed) return;
            if (document.hidden && throughputInterval) {
                cancelInterval(throughputInterval);
                throughputInterval = null;
            } else if (!document.hidden && !throughputInterval) {
                measureThroughput();
                throughputInterval = scheduleInterval(measureThroughput, 2000);
            }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);

        const resizeObserver = new ResizeObserver(() => requestAnimationFrame(drawThroughputChart));
        resizeObserver.observe(root);

        root._cleanup = () => {
            disposed = true;
            if (throughputInterval) {
                cancelInterval(throughputInterval);
                throughputInterval = null;
            }
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            resizeObserver.disconnect();
        };
    }

    // =================== MDI Child 2: Latency Test ===================
    async function renderLatencyTest(root, childStatusBar) {
        root.style.display = "flex";
        root.style.flexDirection = "column";
        root.style.background = "#C3C7CB";

        root.innerHTML = `
            <div style="flex:1; display:flex; flex-direction:column; gap:6px; padding:6px; min-height:0;">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <button class="button ping-btn">⚡ Send Ping</button>
                    <label style="display:flex; align-items:center; gap:4px; cursor:pointer; font-size:12px;">
                        <input type="checkbox" class="auto-ping-check"> Auto Loop (2s)
                    </label>
                    <button class="button clear-btn" style="margin-left:auto;">Clear Data</button>
                </div>

                <div class="win95-panel" style="padding:4px; display:flex; flex-direction:column; gap:4px;">
                    <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:10px; gap:6px;">
                        <span>RTT Latency Chart (ms)</span>
                        <span class="latest-latency-text" style="color:#008000;">Last Ping: -- ms</span>
                    </div>
                    <canvas class="border latency-canvas" style="display:block; width:100%; height:110px; background:#000;"></canvas>
                </div>

                <div style="flex:1; display:flex; flex-direction:column; min-height:80px;">
                    <div style="font-weight:bold; margin-bottom:2px; font-size:11px;">Ping History Log:</div>
                    <div class="border" style="flex:1; min-height:60px; overflow-y:auto; background:#FFF; padding:2px;">
                        <ul class="log-list" style="list-style:none; margin:0; padding:0; font-family:monospace; font-size:10px;"></ul>
                    </div>
                </div>
            </div>
        `;

        if (childStatusBar) {
            childStatusBar.style.display = "flex";
            childStatusBar.style.gap = "8px";
            childStatusBar.innerHTML = `
                <div class="win95-status-cell stat-avg">Avg: -- ms</div>
                <div class="win95-status-cell stat-min">Min: -- ms</div>
                <div class="win95-status-cell stat-max">Max: -- ms</div>
                <div class="win95-status-cell stat-loss">Loss: 0%</div>
                <div class="win95-status-cell stat-pings">Count: 0</div>
            `;
        }

        const pingBtn = root.querySelector(".ping-btn");
        const autoPingCheck = root.querySelector(".auto-ping-check");
        const clearBtn = root.querySelector(".clear-btn");
        const canvas = root.querySelector(".latency-canvas");
        const ctx = canvas.getContext("2d");
        const logList = root.querySelector(".log-list");
        const latestLatencyText = root.querySelector(".latest-latency-text");

        const statAvg = childStatusBar?.querySelector(".stat-avg");
        const statMin = childStatusBar?.querySelector(".stat-min");
        const statMax = childStatusBar?.querySelector(".stat-max");
        const statLoss = childStatusBar?.querySelector(".stat-loss");
        const statPings = childStatusBar?.querySelector(".stat-pings");

        let pingData = []; // { time: Date, rtt: number }
        let autoPingInterval = null;
        let isMeasuring = false;
        let disposed = false;

        async function doPing() {
            if (disposed || !root.isConnected || isMeasuring) return;
            isMeasuring = true;
            pingBtn.disabled = true;

            const startTime = performance.now();
            let latency = 0;
            let success = false;

            try {
                const targetUrl = `${window.location.pathname}?_=${Date.now()}`;
                await fetch(targetUrl, {
                    method: "HEAD",
                    cache: "no-store"
                });
                const endTime = performance.now();
                latency = Math.round(endTime - startTime);
                success = true;
            } catch (err) {
                latency = -1;
                success = false;
            } finally {
                isMeasuring = false;
                if (!disposed && pingBtn.isConnected) {
                    pingBtn.disabled = false;
                }
            }

            if (disposed || !root.isConnected) return;

            const timestamp = new Date();
            if (success) {
                pingData.push({ time: timestamp, rtt: latency });
                if (pingData.length > 50) pingData.shift();

                latestLatencyText.textContent = `Last Ping: ${latency} ms`;
                latestLatencyText.style.color = latency < 100 ? "#008000" : (latency < 250 ? "#B8860B" : "#FF0000");

                const li = document.createElement("li");
                li.textContent = `[${timestamp.toLocaleTimeString()}] Reply from test endpoint: time=${latency}ms`;
                logList.appendChild(li);
            } else {
                latestLatencyText.textContent = `Last Ping: Request Failed`;
                latestLatencyText.style.color = "#FF0000";

                const li = document.createElement("li");
                li.style.color = "red";
                li.textContent = `[${timestamp.toLocaleTimeString()}] Request timed out / network error.`;
                logList.appendChild(li);
            }

            logList.parentElement.scrollTop = logList.parentElement.scrollHeight;
            updateStats();
            drawChart();
        }

        function updateStats() {
            const totalCount = pingData.length;
            const validData = pingData.filter(d => d.rtt >= 0);
            const failCount = totalCount - validData.length;
            const lossRate = totalCount > 0 ? Math.round((failCount / totalCount) * 100) : 0;

            if (statLoss) statLoss.textContent = `Loss: ${lossRate}%`;

            if (validData.length === 0) {
                if (statAvg) statAvg.textContent = "Avg: -- ms";
                if (statMin) statMin.textContent = "Min: -- ms";
                if (statMax) statMax.textContent = "Max: -- ms";
                if (statPings) statPings.textContent = `Count: ${totalCount}`;
                return;
            }

            const rtts = validData.map(d => d.rtt);
            const min = Math.min(...rtts);
            const max = Math.max(...rtts);
            const avg = Math.round(rtts.reduce((a, b) => a + b, 0) / rtts.length);

            if (statAvg) statAvg.textContent = `Avg: ${avg} ms`;
            if (statMin) statMin.textContent = `Min: ${min} ms`;
            if (statMax) statMax.textContent = `Max: ${max} ms`;
            if (statPings) statPings.textContent = `Count: ${totalCount} (Valid: ${validData.length})`;
        }

        function drawChart() {
            if (disposed || !canvas.isConnected) return;
            const rect = canvas.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;

            const dpr = window.devicePixelRatio || 1;
            canvas.width = Math.floor(rect.width * dpr);
            canvas.height = Math.floor(rect.height * dpr);

            ctx.save();
            ctx.scale(dpr, dpr);
            const logicalW = rect.width;
            const logicalH = rect.height;

            ctx.fillStyle = "#001100";
            ctx.fillRect(0, 0, logicalW, logicalH);

            ctx.strokeStyle = "#003300";
            ctx.lineWidth = 1;
            for (let x = 0; x < logicalW; x += 20) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, logicalH); ctx.stroke();
            }
            for (let y = 0; y < logicalH; y += 15) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(logicalW, y); ctx.stroke();
            }

            if (pingData.length < 2) {
                ctx.restore();
                return;
            }

            const maxRtt = Math.max(...pingData.map(d => d.rtt >= 0 ? d.rtt : 0), 150);
            const stepX = logicalW / (pingData.length - 1);

            ctx.beginPath();
            ctx.strokeStyle = "#00FF00";
            ctx.lineWidth = 2;

            pingData.forEach((pt, i) => {
                if (pt.rtt < 0) return;
                const x = i * stepX;
                const y = logicalH - (pt.rtt / maxRtt) * (logicalH - 10) - 5;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
            ctx.restore();
        }

        pingBtn.onclick = () => doPing();

        autoPingCheck.onchange = (e) => {
            if (e.target.checked) {
                doPing();
                autoPingInterval = scheduleInterval(doPing, 2000);
            } else {
                if (autoPingInterval) cancelInterval(autoPingInterval);
                autoPingInterval = null;
            }
        };

        clearBtn.onclick = () => {
            pingData = [];
            logList.innerHTML = "";
            latestLatencyText.textContent = "Last Ping: -- ms";
            latestLatencyText.style.color = "#008000";
            updateStats();
            drawChart();
        };

        const resizeObserver = new ResizeObserver(() => requestAnimationFrame(drawChart));
        resizeObserver.observe(root);

        root._cleanup = () => {
            disposed = true;
            if (autoPingInterval) {
                cancelInterval(autoPingInterval);
                autoPingInterval = null;
            }
            resizeObserver.disconnect();
        };

        drawChart();
    }

    // 初期表示：2つのMDI子ウィンドウを両方開いて左右に並べて同時監視
    const infoWin = await openNetworkInfoChild();
    await openLatencyTestChild(false);
    requestAnimationFrame(() => {
        if (!win?.isConnected) return;
        mdi.tileVertical();
        if (infoWin?.isConnected) mdi.activateChild(infoWin);
        updateParentStatusBar();
    });

    return {
        dispose: () => {
            unsubs.forEach(fn => { try { fn(); } catch (_) { } });
            unsubs.length = 0;
            childCleanups.forEach(fn => { try { fn(); } catch (_) { } });
            childCleanups.clear();
            try { mdi.closeAll(true); } catch (_) { }
            if (parentStatusBar) {
                parentStatusBar.style.display = "";
                parentStatusBar.innerHTML = "";
            }
        }
    };
}