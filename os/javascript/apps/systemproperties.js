// SystemProperties.js
import { openDB } from "../db.js";
import { FILE_ASSOCIATIONS } from "../file-associations.js";
import { loadSetting } from "./settings.js"; // ユーザー名読み込みのために追加

const STORE = "settings";

export default async function SystemProperties(content) {
    // Settings.js と共通のベース構造
    content.innerHTML = `
    <div class="win95-tab-container" style="height: 100%; display: flex; flex-direction: column;">
        <div id="tabs" class="win95-tabs"></div>
        <div id="tab-body" class="win95-tab-body" style="flex: 1; padding: 10px; background: #c0c0c0; border: 2px solid; border-color: #fff #808080 #808080 #fff;"></div>
    </div>
    `;

    const tabsEl = content.querySelector("#tabs");
    const bodyEl = content.querySelector("#tab-body");

    /* ---------- タブ定義 ---------- */
    const tabs = [
        { id: "general", label: "General", render: renderGeneral },
        { id: "performance", label: "Performance", render: renderPerformance }
    ];

    let currentTabId = null;

    async function selectTab(id) {
        if (currentTabId === id) return;
        currentTabId = id;

        // タブボタンのアクティブ状態の切り替え
        [...tabsEl.children].forEach(btn => {
            const active = btn.dataset.id === id;
            btn.classList.toggle("active", active);
            btn.classList.toggle("inactive", !active);
        });

        // 以前のタブのクリーンアップ（タイマー停止、イベントリスナー解除など）
        if (bodyEl._cleanup) {
            bodyEl._cleanup();
            bodyEl._cleanup = null;
        }
        bodyEl.innerHTML = "";

        const tab = tabs.find(t => t.id === id);
        if (tab && typeof tab.render === "function") {
            try {
                await tab.render(bodyEl);
            } catch (e) {
                console.error("Render failed:", e);
            }
        }
    }

    // タブボタンの動的生成
    tabs.forEach(t => {
        const btn = document.createElement("button");
        btn.textContent = t.label;
        btn.dataset.id = t.id;
        btn.className = "win95-tab inactive";
        btn.onclick = () => selectTab(t.id);
        tabsEl.appendChild(btn);
    });

    // 初期起動
    selectTab("general");

    /* ---------- General タブ描画 ---------- */
    async function renderGeneral(root) {
        // 分析に基づいた動的データ
        const registeredAppsCount = Object.keys(FILE_ASSOCIATIONS).length;
        const db = await openDB();
        const dbVersion = db.version;

        // settings.js の設定からユーザー名を取得
        const userName = (await loadSetting("userName")) || "Local User";

        root.innerHTML = `
            <div style="display: flex; gap: 15px; align-items: flex-start;">
                <div style="font-size: 40px; filter: drop-shadow(1px 1px 0 #fff);">💻</div>
                <div style="flex: 1; font-family: 'MS Sans Serif', Arial, sans-serif; font-size: 11px;">
                    <div style="font-weight: bold; margin-bottom: 4px; border-bottom: 1px solid #808080;">System:</div>
                    <div style="margin-left: 10px; margin-bottom: 15px; line-height: 1.4;">
                        NEXSER OS v0.1.0<br>
                        Kernel: Virtual Process Manager (PID-based)<br>
                        VFS Version: 2.0 (IndexedDB Layer)<br>
                        Database Architecture: v${dbVersion}
                    </div>
                    <div style="font-weight: bold; margin-bottom: 4px; border-bottom: 1px solid #808080;">Registered to:</div>
                    <div style="margin-left: 10px; margin-bottom: 15px; line-height: 1.4;">
                        <span id="sys-prop-user-name">${userName}</span><br>
                        NEXSER-NODE-01
                    </div>
                    <div style="font-weight: bold; margin-bottom: 4px; border-bottom: 1px solid #808080;">Components:</div>
                    <div style="margin-left: 10px; line-height: 1.4;">
                        File Associations: ${registeredAppsCount} types registered<br>
                        Shell: Classic Desktop Environment<br>
                        Persistence: Enabled (Atomic Save)
                    </div>
                </div>
            </div>
        `;

        // ユーザー名更新イベントの監視
        const onUserUpdate = (e) => {
            const nameEl = root.querySelector("#sys-prop-user-name");
            if (nameEl) nameEl.textContent = e.detail;
        };
        window.addEventListener("user-profile-updated", onUserUpdate);

        // クリーンアップ処理を登録
        root._cleanup = () => {
            window.removeEventListener("user-profile-updated", onUserUpdate);
        };
    }

    /* ---------- Performance タブ描画 ---------- */
    async function renderPerformance(root) {
        root.innerHTML = "";

        // ストレージセクション
        const storageField = document.createElement("fieldset");
        storageField.style.margin = "0 0 12px 0";
        storageField.style.padding = "10px";
        storageField.innerHTML = `<legend>Storage (IndexedDB Persistence)</legend>`;

        const storageInfo = document.createElement("div");
        storageInfo.style.fontSize = "11px";
        storageInfo.textContent = "Calculating storage usage...";

        const barContainer = document.createElement("div");
        barContainer.style.cssText = "width: 100%; height: 16px; background: #fff; margin-top: 5px; position: relative; overflow: hidden; border: 1px solid #808080;";

        const bar = document.createElement("div");
        bar.style.cssText = "width: 0%; height: 100%; background: #000080; transition: width 0.3s;";

        barContainer.appendChild(bar);
        storageField.append(storageInfo, barContainer);

        // リソースセクション
        const resourceField = document.createElement("fieldset");
        resourceField.style.padding = "10px";
        resourceField.innerHTML = `<legend>System Resources</legend>`;

        const cpuInfo = document.createElement("div");
        cpuInfo.style.cssText = "margin-bottom: 6px; font-size: 11px;";

        const memInfo = document.createElement("div");
        memInfo.style.cssText = "margin-bottom: 6px; font-size: 11px;";

        const fsInfo = document.createElement("div");
        fsInfo.style.fontSize = "11px";
        fsInfo.innerHTML = `VFS Large File Threshold: 100 KB`;

        resourceField.append(cpuInfo, memInfo, fsInfo);
        root.append(storageField, resourceField);

        // 動的更新ロジック
        async function updateStats() {
            if (currentTabId !== "performance") return;

            let usage = 0, quota = 0;
            if (navigator.storage && navigator.storage.estimate) {
                const estimate = await navigator.storage.estimate();
                usage = estimate.usage || 0;
                quota = estimate.quota || 1;
            }

            const usedMB = (usage / (1024 * 1024)).toFixed(2);
            const totalMB = (quota / (1024 * 1024)).toFixed(0);
            const percent = (usage / quota * 100).toFixed(1);

            storageInfo.textContent = `Used: ${usedMB} MB / Total: ${totalMB} MB (${percent}%)`;
            bar.style.width = `${percent}%`;

            // kernel.js で計算されている cpuLoad を参照
            const load = window.cpuLoad !== undefined ? window.cpuLoad : 0;
            cpuInfo.textContent = `CPU Load (Event Loop Lag): ${load.toFixed(1)}%`;

            if (performance.memory) {
                const usedMem = (performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(1);
                const totalMem = (performance.memory.jsHeapSizeLimit / (1024 * 1024)).toFixed(0);
                memInfo.textContent = `Memory Usage: ${usedMem} MB / ${totalMem} MB`;
            } else {
                memInfo.textContent = `Memory Usage: Not available in this browser`;
            }
        }

        const timer = setInterval(updateStats, 2000);
        updateStats();

        // タブ切り替え時のクリーンアップ
        root._cleanup = () => {
            clearInterval(timer);
        };
    }
}