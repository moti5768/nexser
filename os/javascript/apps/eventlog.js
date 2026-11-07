// event_log.js
import { dbGet, dbSet } from "../fs-db.js";

const LOG_STORAGE_KEY = "nexser_system_logs_v1";

export default async function EventLogApp(content) {
    content.innerHTML = `
        <div class="win95-tab-container" style="height:100%; display:flex; flex-direction:column;">
            <div id="tabs" class="win95-tabs"></div>
            <div id="tab-body" class="win95-panel" style="flex:1; overflow:auto; display:flex; flex-direction:column;"></div>
        </div>
    `;

    const tabsEl = content.querySelector("#tabs");
    const bodyEl = content.querySelector("#tab-body");

    const win = content.closest(".window");
    const statusBar = win?._statusBar;

    let allLogs = {
        System: [],
        Application: [],
        Security: []
    };

    try {
        const saved = await dbGet(LOG_STORAGE_KEY, "kv");
        if (saved) {
            allLogs = saved;
        } else {
            allLogs = {
                System: generateMockLogs("System"),
                Application: generateMockLogs("Application"),
                Security: generateMockLogs("Security")
            };
            await saveLogs();
        }
    } catch (e) {
        console.warn("[EventLog] Failed to load logs from DB:", e);
    }

    async function saveLogs() {
        try {
            await dbSet(LOG_STORAGE_KEY, allLogs, "kv");
        } catch (e) {
            console.error("[EventLog] Failed to save logs:", e);
        }
    }

    let isAutoRefreshEnabled = true;

    const logListener = async (e) => {
        const { category = "System", level = "Information", source = "Unknown", eventId = 1000, taskCategory = "General", description = "" } = e.detail || {};
        if (!allLogs[category]) allLogs[category] = [];

        allLogs[category].unshift({
            level,
            time: new Date().toLocaleTimeString(),
            timestamp: Date.now(),
            source,
            eventId,
            category: taskCategory,
            description
        });

        if (allLogs[category].length > 500) allLogs[category].pop();

        // ★ 3. 確実にストレージへ書き込みが完了してから次へ進むようにする
        await saveLogs();

        const activeTabBtn = tabsEl.querySelector(".win95-tab.active");
        if (activeTabBtn && activeTabBtn.dataset.id.toLowerCase() === category.toLowerCase() && isAutoRefreshEnabled) {
            refreshCurrentView();
        }
    };

    window.addEventListener("nexser-system-log", logListener);

    const tabs = [
        { id: "system", label: "System", icon: "💻", categoryName: "System" },
        { id: "application", label: "Application", icon: "📦", categoryName: "Application" },
        { id: "security", label: "Security", icon: "🔒", categoryName: "Security" }
    ];

    let currentCategory = "System";
    let refreshCurrentView = () => { };

    async function selectTab(id) {
        [...tabsEl.children].forEach(btn => {
            const active = btn.dataset.id === id;
            btn.classList.toggle("active", active);
            btn.classList.toggle("inactive", !active);
        });

        bodyEl._cleanup?.();
        bodyEl._cleanup = null;
        bodyEl.innerHTML = "";

        if (statusBar) {
            statusBar.style.display = "";
            statusBar.innerHTML = "";
        }

        const tab = tabs.find(t => t.id === id);
        if (tab) {
            currentCategory = tab.categoryName;
            refreshCurrentView = await renderLogTable(bodyEl, currentCategory);
        }
    }

    tabs.forEach(t => {
        const btn = document.createElement("button");
        btn.textContent = `${t.icon} ${t.label}`;
        btn.dataset.id = t.id;
        btn.className = "win95-tab inactive";
        btn.onmousedown = () => selectTab(t.id);
        tabsEl.appendChild(btn);
    });

    async function renderLogTable(root, category) {
        root.innerHTML = `
            <div style="flex:1; display:flex; flex-direction:column; gap:6px; padding:6px; height:100%;">
                <!-- ツールバー & 拡張フィルター -->
                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                    <button id="refreshLogBtn" class="button">🔄 更新</button>
                    <button id="clearLogBtn" class="button">🗑️ クリア</button>
                    <button id="exportLogBtn" class="button">💾 エクスポート</button>
                    
                    <div style="display:flex; align-items:center; gap:4px; font-size:11px;">
                        <span>レベル:</span>
                        <select id="levelFilter" class="button" style="padding:2px;">
                            <option value="ALL">すべて</option>
                            <option value="Information">情報</option>
                            <option value="Warning">警告</option>
                            <option value="Error">エラー</option>
                        </select>
                    </div>

                    <div style="display:flex; align-items:center; gap:4px; font-size:11px;">
                        <span>検索:</span>
                        <input type="text" id="searchInput" class="button" placeholder="キーワード・ソース..." style="padding:2px 4px; width:110px; background:#FFF;" />
                    </div>

                    <label style="display:flex; align-items:center; gap:3px; font-size:11px; cursor:pointer; user-select:none;">
                        <input type="checkbox" id="autoRefreshCheck" checked /> リアルタイム更新
                    </label>

                    <span id="logCountText" style="margin-left:auto; font-size:11px; color:#404040;">Total: 0 items</span>
                </div>

                <!-- ログ一覧テーブル -->
                <div class="border" style="flex:2; overflow:auto; background:#FFF; min-height:120px;">
                    <table style="width:100%; border-collapse:collapse; font-size:11px; cursor:default;">
                        <thead>
                            <tr style="background:#C0C0C0; text-align:left; position:sticky; top:0; z-index:1;">
                                <th style="padding:3px 6px; border-right:1px solid #808080; width:70px;">レベル</th>
                                <th style="padding:3px 6px; border-right:1px solid #808080; width:80px;">日時</th>
                                <th style="padding:3px 6px; border-right:1px solid #808080; width:110px;">ソース</th>
                                <th style="padding:3px 6px; border-right:1px solid #808080; width:70px;">ID</th>
                                <th style="padding:3px 6px; border-right:1px solid #808080; width:100px;">カテゴリ</th>
                                <th style="padding:3px 6px;">説明 (概要)</th>
                            </tr>
                        </thead>
                        <tbody id="logTableBody"></tbody>
                    </table>
                </div>

                <!-- ログ詳細表示エリア -->
                <div class="win95-panel" style="flex:1; display:flex; flex-direction:column; padding:4px; min-height:80px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
                        <span style="font-weight:bold; font-size:11px;">説明 (ダブルクリックで詳細プロパティ表示):</span>
                    </div>
                    <div id="logDetailDesc" class="border" style="flex:1; background:#FFF; padding:4px; font-family:monospace; font-size:11px; overflow:auto;">
                        上のリストからログを選択してください。
                    </div>
                </div>
            </div>
        `;

        if (statusBar) {
            statusBar.style.display = "flex";
            statusBar.innerHTML = `
                <div class="win95-status-cell">Category: ${category}</div>
                <div class="win95-status-cell" id="statStatus">Status: Normal</div>
                <div class="win95-status-cell">Logging: Active (Persistent)</div>
            `;
        }

        const tbody = root.querySelector("#logTableBody");
        const descArea = root.querySelector("#logDetailDesc");
        const refreshBtn = root.querySelector("#refreshLogBtn");
        const clearBtn = root.querySelector("#clearLogBtn");
        const exportBtn = root.querySelector("#exportLogBtn");
        const levelFilter = root.querySelector("#levelFilter");
        const searchInput = root.querySelector("#searchInput");
        const autoRefreshCheck = root.querySelector("#autoRefreshCheck");
        const logCountText = root.querySelector("#logCountText");

        autoRefreshCheck.onchange = () => {
            isAutoRefreshEnabled = autoRefreshCheck.checked;
        };

        // 詳細プロパティウィンドウを開く関数
        function openLogPropertyModal(log) {
            const winAPI = window.nexser?.windowAPI;
            const modalTitle = `イベント プロパティ (${category} - ID: ${log.eventId})`;

            const detailHtml = `
                <div style="padding: 12px; font-size: 11px; font-family: 'MS Sans Serif', Tahoma, sans-serif; display: flex; flex-direction: column; gap: 8px; height: 100%;">
                    <div style="display: grid; grid-template-columns: 100px 1fr; gap: 4px; background: #C0C0C0; padding: 6px; border: 1px solid #808080;">
                        <strong>ログの種類:</strong> <span>${log.level}</span>
                        <strong>日時:</strong> <span>${log.time}</span>
                        <strong>ソース:</strong> <span>${log.source}</span>
                        <strong>イベント ID:</strong> <span style="font-family:monospace;">${log.eventId}</span>
                        <strong>カテゴリ:</strong> <span>${log.category}</span>
                    </div>
                    <div style="font-weight: bold; margin-top: 4px;">説明:</div>
                    <div style="flex: 1; background: #FFF; border: 1px solid #808080; padding: 6px; font-family: monospace; white-space: pre-wrap; overflow: auto; min-height: 80px;">
                        ${log.description}
                    </div>
                </div>
            `;

            if (winAPI && typeof winAPI.createWindow === "function") {
                const modalContent = winAPI.createWindow(modalTitle, {
                    width: 450,
                    height: 300,
                    taskbar: false,
                    skipSave: true
                });
                modalContent.innerHTML = detailHtml;
            } else {
                alert(`[${log.level}] ${log.source} (ID: ${log.eventId})\n\n${log.description}`);
            }
        }

        function populateTable() {
            tbody.innerHTML = "";
            const logs = allLogs[category] || [];
            const filterVal = levelFilter.value;
            const searchVal = (searchInput.value || "").toLowerCase();

            const filteredLogs = logs.filter(l => {
                if (filterVal !== "ALL" && l.level !== filterVal) return false;
                if (searchVal) {
                    const matchText = `${l.source} ${l.category} ${l.description} ${l.eventId}`.toLowerCase();
                    if (!matchText.includes(searchVal)) return false;
                }
                return true;
            });

            if (filteredLogs.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:15px; color:#808080;">該当するログはありません</td></tr>`;
                logCountText.textContent = `Total: 0 / ${logs.length} items`;
                descArea.textContent = "";
                return;
            }

            filteredLogs.forEach((log) => {
                const tr = document.createElement("tr");
                tr.style.borderBottom = "1px solid #E0E0E0";

                let levelIcon = "ℹ️";
                if (log.level === "Warning") levelIcon = "⚠️";
                if (log.level === "Error") levelIcon = "❌";

                const shortDesc = log.description.length > 50 ? log.description.substring(0, 50) + "..." : log.description;

                tr.innerHTML = `
                    <td style="padding:2px 6px; border-right:1px solid #E0E0E0;">${levelIcon} ${log.level}</td>
                    <td style="padding:2px 6px; border-right:1px solid #E0E0E0; white-space:nowrap;">${log.time}</td>
                    <td style="padding:2px 6px; border-right:1px solid #E0E0E0; overflow:hidden; text-overflow:ellipsis;" title="${log.source}">${log.source}</td>
                    <td style="padding:2px 6px; border-right:1px solid #E0E0E0; font-family:monospace;">${log.eventId}</td>
                    <td style="padding:2px 6px; border-right:1px solid #E0E0E0; overflow:hidden; text-overflow:ellipsis;" title="${log.category}">${log.category}</td>
                    <td style="padding:2px 6px; overflow:hidden; text-overflow:ellipsis;" title="${log.description}">${shortDesc}</td>
                `;

                tr.onclick = () => {
                    [...tbody.children].forEach(r => {
                        r.style.background = "";
                        r.style.color = "";
                    });
                    tr.style.background = "#000080";
                    tr.style.color = "#FFF";
                    descArea.textContent = log.description;
                };

                tr.ondblclick = () => {
                    openLogPropertyModal(log);
                };

                tbody.appendChild(tr);
            });

            logCountText.textContent = `Total: ${filteredLogs.length} / ${logs.length} items`;
        }

        refreshBtn.onclick = () => {
            populateTable();
        };

        clearBtn.onclick = () => {
            const clearLog = {
                level: "Information",
                time: new Date().toLocaleTimeString(),
                timestamp: Date.now(),
                source: "EventLogManager",
                eventId: 104,
                category: "Log Management",
                description: `The ${category} event log was cleared by the user.`
            };
            allLogs[category] = [clearLog];
            saveLogs();
            populateTable();
            descArea.textContent = clearLog.description;
        };

        exportBtn.onclick = () => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allLogs[category], null, 2));
            const downloadAnchor = document.createElement("a");
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", `Nexser_${category}_Logs_${Date.now()}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
        };

        levelFilter.onchange = () => {
            populateTable();
        };

        searchInput.oninput = () => {
            populateTable();
        };

        populateTable();

        const updater = () => populateTable();
        return updater;
    }

    function generateMockLogs(category) {
        const now = Date.now();
        return [
            {
                level: "Information",
                time: new Date(now - 15000).toLocaleTimeString(),
                timestamp: now - 15000,
                source: `Nexser${category}Daemon`,
                eventId: 1001,
                category: "Initialization",
                description: `The ${category} subsystem was successfully initialized and verified.`
            },
            {
                level: "Warning",
                time: new Date(now - 45000).toLocaleTimeString(),
                timestamp: now - 45000,
                source: "MemoryManager",
                eventId: 2042,
                category: "Performance",
                description: "Virtual memory warning: allocated heap space reached nominal threshold."
            }
        ];
    }

    selectTab("system");

    return {
        dispose: () => {
            window.removeEventListener("nexser-system-log", logListener);
            bodyEl._cleanup?.();
            if (statusBar) {
                statusBar.style.display = "";
                statusBar.innerHTML = "";
            }
        }
    };
}