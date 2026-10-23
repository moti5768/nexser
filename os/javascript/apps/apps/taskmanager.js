// TaskManager.js
import { getProcessList, killProcess, restartProcess } from "../kernel.js";

export default function TaskManager(content) {
    // タブコンテナ構造を採用
    content.innerHTML = `
        <div class="win95-tab-container" style="height:100%; display:flex; flex-direction:column;">
            <div id="tabs" class="win95-tabs"></div>
            <div id="tab-body" style="flex:1; overflow:auto; padding:4px;"></div>
        </div>
    `;

    const tabsEl = content.querySelector("#tabs");
    const bodyEl = content.querySelector("#tab-body");

    const tabs = [
        { id: "processes", label: "Processes", render: renderProcessesTab },
        { id: "performance", label: "Performance", render: renderPerformanceTab }
    ];

    async function selectTab(id) {
        [...tabsEl.children].forEach(btn => {
            const active = btn.dataset.id === id;
            btn.classList.toggle("active", active);
            btn.classList.toggle("inactive", !active);
        });

        // 前タブのクリーンアップを実行してメモリリークを防止
        bodyEl._cleanup?.();
        bodyEl._cleanup = null;
        bodyEl.innerHTML = "";

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

    // =================== Processes タブ ===================
    async function renderProcessesTab(root) {
        root.innerHTML = `
            <div style="margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
                <span id="process-count" style="font-size:12px;">実行中のプロセス: 0</span>
                <div>
                    <button id="btn-kill" style="padding: 2px 8px; font-size:12px; cursor: pointer;">タスクの終了</button>
                </div>
            </div>
            <div style="flex: 1; overflow-y: auto; background: #fff; border: 2px inset #fff;">
                <table class="task-table" style="width: 100%; border-collapse: collapse; text-align: left; font-size:12px;">
                    <thead>
                        <tr style="background: #C0C0C0; border-bottom: 1px solid #808080; position: sticky; top: 0;">
                            <th style="padding: 4px; border: 1px solid #808080; width: 45px;">PID</th>
                            <th style="padding: 4px; border: 1px solid #808080;">名前</th>
                            <th style="padding: 4px; border: 1px solid #808080; width: 50px;">CPU%</th>
                            <th style="padding: 4px; border: 1px solid #808080; width: 60px;">メモリ</th>
                            <th style="padding: 4px; border: 1px solid #808080; width: 65px;">状態</th>
                            <th style="padding: 4px; border: 1px solid #808080; width: 60px;">稼働時間</th>
                            <th style="padding: 4px; border: 1px solid #808080; width: 35px; text-align:center;">Z</th>
                            <th style="padding: 4px; border: 1px solid #808080;">パス</th>
                            <th style="padding: 4px; border: 1px solid #808080; width: 100px; text-align: center;">操作</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
        `;

        const tbody = root.querySelector("tbody");
        const processCountElem = root.querySelector("#process-count");
        const btnKillMaster = root.querySelector("#btn-kill");
        if (!tbody) return;

        const rowMap = new Map();
        let timer = null;
        let selectedKey = null;

        function refresh() {
            if (!document.body.contains(root)) {
                stopTimer();
                return;
            }

            const list = getProcessList();
            processCountElem.textContent = `実行中のプロセス: ${list.length}`;
            const activeKeys = new Set(list.map(p => p.key));

            for (const [key, tr] of rowMap) {
                if (!activeKeys.has(key)) {
                    tr.remove();
                    rowMap.delete(key);
                }
            }

            for (const p of list) {
                let tr = rowMap.get(p.key);

                if (!tr) {
                    tr = document.createElement("tr");
                    tr.style.cursor = "pointer";

                    for (let i = 0; i < 9; i++) {
                        const td = document.createElement("td");
                        td.style.padding = "4px";
                        td.style.border = "1px solid #dfdfdf";
                        tr.appendChild(td);
                    }

                    tr.onclick = () => {
                        root.querySelectorAll("tbody tr").forEach(row => {
                            row.style.background = "";
                            row.style.color = "";
                        });
                        tr.style.background = "#000080";
                        tr.style.color = "#fff";
                        selectedKey = p.key;
                    };

                    const actionTd = tr.children[8];
                    actionTd.style.textAlign = "center";

                    const btnKill = document.createElement("button");
                    btnKill.textContent = "終了";
                    btnKill.style.cssText = "margin-right: 2px; padding: 1px 4px; font-size: 11px; cursor: pointer;";
                    btnKill.onclick = (e) => {
                        e.stopPropagation();
                        killProcess(p.key);
                    };

                    const btnRestart = document.createElement("button");
                    btnRestart.textContent = "再起動";
                    btnRestart.style.cssText = "padding: 1px 4px; font-size: 11px; cursor: pointer;";
                    btnRestart.onclick = (e) => {
                        e.stopPropagation();
                        restartProcess(p.key);
                    };

                    actionTd.appendChild(btnKill);
                    actionTd.appendChild(btnRestart);

                    tbody.appendChild(tr);
                    rowMap.set(p.key, tr);
                }

                const cells = tr.children;
                cells[0].textContent = p.pid;
                cells[1].textContent = p.name;
                cells[2].textContent = `${p.cpu}%`;
                cells[3].textContent = `${p.memory} MB`;
                cells[4].textContent = p.state;
                cells[5].textContent = `${p.uptime}s`;
                cells[6].textContent = p.zIndex ?? "";
                cells[7].textContent = p.path;
            }
        }

        btnKillMaster.onclick = () => {
            if (selectedKey) {
                killProcess(selectedKey);
                selectedKey = null;
            } else {
                alert("終了するプロセスを選択してください。");
            }
        };

        refresh();
        timer = setInterval(refresh, 1000);

        function stopTimer() {
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
        }

        root._cleanup = () => {
            stopTimer();
        };
    }

    // =================== Performance タブ ===================
    async function renderPerformanceTab(root) {
        root.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div style="padding: 8px; background: #C0C0C0;" class="border">
                    <div style="font-weight: bold; margin-bottom: 4px; font-size:12px;">CPU 使用状況</div>
                    <div id="perf-cpu-val" style="font-size: 20px; font-weight: bold; color: #000;">0%</div>
                    <div style="font-size: 11px; color: #404040; margin-top: 2px;">カーネル非同期イベントループ計測</div>
                </div>
                <div style="padding: 8px; background: #C0C0C0;" class="border">
                    <div style="font-weight: bold; margin-bottom: 4px; font-size:12px;">メモリ 使用量</div>
                    <div id="perf-mem-val" style="font-size: 20px; font-weight: bold; color: #000;">0 MB</div>
                    <div style="font-size: 11px; color: #404040; margin-top: 2px;">JS Heap Memory</div>
                </div>
            </div>
        `;

        const perfCpuVal = root.querySelector("#perf-cpu-val");
        const perfMemVal = root.querySelector("#perf-mem-val");
        let timer = null;

        function updatePerf() {
            if (!document.body.contains(root)) {
                stopTimer();
                return;
            }
            const list = getProcessList();
            const totalCpu = list.reduce((acc, p) => acc + (p.cpu || 0), 0);
            const totalMem = list.reduce((acc, p) => Math.max(acc, p.memory || 0), 0);
            perfCpuVal.textContent = `${totalCpu}%`;
            perfMemVal.textContent = `${totalMem} MB`;
        }

        updatePerf();
        timer = setInterval(updatePerf, 1000);

        function stopTimer() {
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
        }

        root._cleanup = () => {
            stopTimer();
        };
    }

    // =================== 堅牢なクリーンアップ & 監視機構 ===================
    let observer = null;
    const win = content.closest(".window");

    const cleanup = () => {
        bodyEl._cleanup?.();
        if (observer) {
            observer.disconnect();
            observer = null;
        }
    };

    // 初期版の優れた MutationObserver によるウィンドウ破棄監視を復活
    if (win) {
        observer = new MutationObserver(() => {
            if (!document.body.contains(win)) {
                cleanup();
            }
        });
        observer.observe(document.body, { childList: true });
    }

    content._cleanup = cleanup;

    // 初期タブとして Processes を表示
    selectTab("processes");

    return {
        isTabApp: false,
        dispose: cleanup
    };
}