// Network_Monitor.js

export default async function NetworkMonitorApp(content) {
    content.innerHTML = `
        <div class="win95-tab-container" style="height:100%; display:flex; flex-direction:column;">
            <div id="tabs" class="win95-tabs"></div>
            <div id="tab-body" class="win95-panel" style="flex:1; overflow:auto; display:flex; flex-direction:column;"></div>
        </div>
    `;

    const tabsEl = content.querySelector("#tabs");
    const bodyEl = content.querySelector("#tab-body");

    // window.js が生成したウィンドウの標準ステータスバーを取得
    const win = content.closest(".window");
    const statusBar = win?._statusBar;

    // タブを「Network Info」と「Latency Test」の2つに整理・統合
    const tabs = [
        { id: "network", label: "Network Info", icon: "📊", render: renderNetworkInfo },
        { id: "latency", label: "Latency Test", icon: "⚡", render: renderLatencyTest }
    ];

    async function selectTab(id) {
        [...tabsEl.children].forEach(btn => {
            const active = btn.dataset.id === id;
            btn.classList.toggle("active", active);
            btn.classList.toggle("inactive", !active);
        });

        // クリーンアップ処理の実行
        bodyEl._cleanup?.();
        bodyEl._cleanup = null;
        bodyEl.innerHTML = "";

        if (statusBar) {
            statusBar.style.display = "";
            statusBar.innerHTML = "";
        }

        const tab = tabs.find(t => t.id === id);
        await tab?.render(bodyEl);
    }

    tabs.forEach(t => {
        const btn = document.createElement("button");
        btn.textContent = t.label;
        btn.dataset.id = t.id;
        btn.className = "win95-tab inactive";
        btn.onmousedown = () => selectTab(t.id);
        tabsEl.appendChild(btn);
    });

    // =================== Tab 1: Network Info & Throughput ===================
    async function renderNetworkInfo(root) {
        root.innerHTML = `
            <div style="flex:1; display:flex; flex-direction:column; gap:6px; padding:4px;">
                <div style="background:#000080; color:#FFF; font-weight:bold; padding:4px 8px; font-size:12px; display:flex; justify-content:space-between;">
                    <span>📊 Network Adapter & Throughput Monitor</span>
                    <span id="adapterStatus" style="font-weight:normal; font-size:11px;">Status: Active</span>
                </div>

                <!-- スループット実測グラフエリア -->
                <div class="win95-panel" style="padding:4px; display:flex; flex-direction:column; gap:4px;">
                    <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:10px;">
                        <span>Throughput (Measured Actual Mbps)</span>
                        <span id="throughputText" style="color:#008000;">Waiting for measurement...</span>
                    </div>
                    <canvas id="throughputCanvas" class="border" style="display:block; width:100%; height:90px; background:#000;"></canvas>
                </div>

                <!-- 詳細プロパティテーブル -->
                <div class="border" style="flex:1; overflow:auto; background:#FFF;">
                    <table style="width:100%; border-collapse:collapse; font-size:11px;">
                        <thead>
                            <tr style="background:#C0C0C0; text-align:left;">
                                <th style="padding:2px 4px;">Property</th>
                                <th style="padding:2px 4px;">Value</th>
                            </tr>
                        </thead>
                        <tbody id="adapterPropBody">
                            <tr><td>Connection State</td><td style="font-family:monospace; color:green;">Connected</td></tr>
                            <tr><td>Estimated Speed (Downlink)</td><td id="propDownlink" style="font-family:monospace;">-- Mbps</td></tr>
                            <tr><td>Estimated Latency (RTT)</td><td id="propRtt" style="font-family:monospace;">-- ms</td></tr>
                            <tr><td>Effective Connection Type</td><td id="propEffectiveType" style="font-family:monospace;">--</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;

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

        async function measureThroughput() {
            // タブが非表示のときは無駄な通信を防止
            if (document.hidden || isMeasuringThroughput) return;
            isMeasuringThroughput = true;

            const startTime = performance.now();
            try {
                const targetUrl = `${window.location.pathname}?_=${Date.now()}`;
                const response = await fetch(targetUrl, { cache: "no-store" });
                const buffer = await response.arrayBuffer();
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
            } catch (err) {
                throughputHistory.push(0);
                if (throughputHistory.length > 50) throughputHistory.shift();
            } finally {
                isMeasuringThroughput = false;
                drawThroughputChart();
            }
        }

        function drawThroughputChart() {
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
        throughputInterval = setInterval(measureThroughput, 2000);

        // タブの表示状態が変わったときのハンドリング（バックグラウンド時は停止）
        const handleVisibilityChange = () => {
            if (document.hidden && throughputInterval) {
                clearInterval(throughputInterval);
                throughputInterval = null;
            } else if (!document.hidden && !throughputInterval) {
                measureThroughput();
                throughputInterval = setInterval(measureThroughput, 2000);
            }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);

        const resizeObserver = new ResizeObserver(() => requestAnimationFrame(drawThroughputChart));
        resizeObserver.observe(root);

        root._cleanup = () => {
            if (throughputInterval) clearInterval(throughputInterval);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            resizeObserver.disconnect();
        };
    }

    // =================== Tab 2: Latency Test ===================
    async function renderLatencyTest(root) {
        root.innerHTML = `
            <div style="flex:1; display:flex; flex-direction:column; gap:6px; padding:4px;">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <button id="pingBtn" class="button">⚡ Send Ping</button>
                    <label style="display:flex; align-items:center; cursor:pointer; font-size:12px;">
                        <input type="checkbox" id="autoPingCheck"> Auto Loop (2s)
                    </label>
                    <button id="clearBtn" class="button" style="margin-left:auto;">Clear Data</button>
                </div>

                <div class="win95-panel" style="padding:4px; display:flex; flex-direction:column; gap:4px;">
                    <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:10px;">
                        <span>RTT Latency Chart (ms)</span>
                        <span id="latestLatencyText" style="color:#008000;">Last Ping: -- ms</span>
                    </div>
                    <canvas id="latencyCanvas" class="border" style="display:block; width:100%; height:110px; background:#000;"></canvas>
                </div>

                <div style="flex:1; display:flex; flex-direction:column;">
                    <div style="font-weight:bold; margin-bottom:2px;">Ping History Log:</div>
                    <div class="border" style="flex:1; min-height:80px; overflow-y:auto; background:#FFF; padding:2px;">
                        <ul id="logList" style="list-style:none; margin:0; padding:0; font-family:monospace; font-size:10px;"></ul>
                    </div>
                </div>
            </div>
        `;

        if (statusBar) {
            statusBar.style.display = "flex";
            statusBar.innerHTML = `
                <div class="win95-status-cell" id="statAvg">Avg: -- ms</div>
                <div class="win95-status-cell" id="statMin">Min: -- ms</div>
                <div class="win95-status-cell" id="statMax">Max: -- ms</div>
                <div class="win95-status-cell" id="statLoss">Loss: 0%</div>
                <div class="win95-status-cell" id="statPings">Count: 0</div>
            `;
        }

        const pingBtn = root.querySelector("#pingBtn");
        const autoPingCheck = root.querySelector("#autoPingCheck");
        const clearBtn = root.querySelector("#clearBtn");
        const canvas = root.querySelector("#latencyCanvas");
        const ctx = canvas.getContext("2d");
        const logList = root.querySelector("#logList");
        const latestLatencyText = root.querySelector("#latestLatencyText");

        const statAvg = statusBar?.querySelector("#statAvg");
        const statMin = statusBar?.querySelector("#statMin");
        const statMax = statusBar?.querySelector("#statMax");
        const statLoss = statusBar?.querySelector("#statLoss");
        const statPings = statusBar?.querySelector("#statPings");

        let pingData = []; // { time: Date, rtt: number }
        let autoPingInterval = null;
        let isMeasuring = false;

        async function doPing() {
            if (isMeasuring) return;
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
                pingBtn.disabled = false;
            }

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
                autoPingInterval = setInterval(doPing, 2000);
            } else {
                if (autoPingInterval) clearInterval(autoPingInterval);
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
            if (autoPingInterval) clearInterval(autoPingInterval);
            resizeObserver.disconnect();
            if (statusBar) {
                statusBar.style.display = "";
                statusBar.innerHTML = "";
            }
        };

        drawChart();
    }

    // Default Tab
    selectTab("network");

    return {
        dispose: () => {
            bodyEl._cleanup?.();
            if (statusBar) {
                statusBar.style.display = "";
                statusBar.innerHTML = "";
            }
        }
    };
}