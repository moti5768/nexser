// taskbarproperties.js
import { loadSetting, saveSetting } from "./settings.js";

export default async function TaskbarProperties(content) {
    // SystemProperties.js と共通のベース構造
    content.innerHTML = `
    <div class="win95-tab-container" style="height: 100%; display: flex; flex-direction: column; font-family: 'MS Sans Serif', Arial, sans-serif; font-size: 11px; color: #000; box-sizing: border-box; overflow: hidden;">
        <div id="tp-tabs" class="win95-tabs" style="flex-shrink: 0;"></div>
        <div id="tp-tab-body" class="win95-tab-body" style="flex: 1; padding: 12px; background: #c0c0c0; border: 2px solid; border-color: #fff #808080 #808080 #fff; overflow-y: auto; box-sizing: border-box;"></div>
        
        <div style="display: flex; justify-content: flex-end; gap: 6px; padding: 10px 0 0 0; flex-shrink: 0;">
            <button class="win95-btn" id="tp-ok" style="width: 75px; padding: 4px; min-height: 23px;">OK</button>
            <button class="win95-btn" id="tp-cancel" style="width: 75px; padding: 4px; min-height: 23px;">Cancel</button>
            <button class="win95-btn pointer_none" id="tp-apply" style="width: 75px; padding: 4px; min-height: 23px;">Apply</button>
        </div>
    </div>
    `;

    const tabsEl = content.querySelector("#tp-tabs");
    const bodyEl = content.querySelector("#tp-tab-body");
    const applyBtn = content.querySelector("#tp-apply");

    let tempSettings = {
        taskbarHeight: await loadSetting("taskbarHeight") || 40,
        showClock: (await loadSetting("showClock")) !== false,
        smallIcons: await loadSetting("smallIcons") || false,
        autoHide: await loadSetting("autoHide") || false
    };

    /* ---------- タブ定義 ---------- */
    const tabs = [
        { id: "options", label: "Taskbar Options", render: renderOptions },
        { id: "startmenu", label: "Start Menu Programs", render: renderStartMenu }
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

        // クリーンアップ
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
    selectTab("options");

    /* ---------- Taskbar Options タブ描画 ---------- */
    async function renderOptions(root) {
        root.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 15px;">
                <div style="display: flex; gap: 10px;">
                    <div style="width: 140px; height: 100px; background: #008080; border: 2px inset #fff; position: relative; display: flex; align-items: flex-end; overflow: hidden;">
                        <div id="tp-preview-bar" style="width: 100%; height: ${tempSettings.taskbarHeight / 4}px; background: #c0c0c0; border-top: 1px solid #fff; display: flex; align-items: center; padding: 0 2px; transform: ${tempSettings.autoHide ? 'translateY(80%)' : 'translateY(0)'}">
                            <div style="width: 15px; height: 70%; background: #c0c0c0; border: 1px solid #808080;"></div>
                            <div style="flex: 1;"></div>
                            <div id="tp-preview-clock" style="width: 25px; height: 70%; border: 1px inset #fff; font-size: 6px; display: ${tempSettings.showClock ? 'flex' : 'none'}; align-items: center; justify-content: center;">12:00</div>
                        </div>
                    </div>
                    <div style="flex: 1;">
                        <fieldset style="padding: 10px; border: 2px groove #fff; margin: 0;">
                            <legend style="margin-left: 10px;">Taskbar properties</legend>
                            <label style="display: flex; align-items: center; margin-bottom: 6px; gap: 4px; cursor: pointer;">
                                <input type="checkbox" id="tp-check-autohide" ${tempSettings.autoHide ? 'checked' : ''}> Auto hide
                            </label>
                            <label style="display: flex; align-items: center; margin-bottom: 6px; gap: 4px; cursor: pointer;">
                                <input type="checkbox" id="tp-check-clock" ${tempSettings.showClock ? 'checked' : ''}> Show Clock
                            </label>
                            <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
                                <input type="checkbox" id="tp-check-small" ${tempSettings.smallIcons ? 'checked' : ''}> Small icons in Start menu
                            </label>
                        </fieldset>
                    </div>
                </div>
                <fieldset style="padding: 10px; border: 2px groove #fff;">
                    <legend style="margin-left: 10px;" id="tp-size-legend">Taskbar Size (Current: ${tempSettings.taskbarHeight}px)</legend>
                    <input type="range" id="tp-size-slider" min="40" max="320" step="40" value="${tempSettings.taskbarHeight}" style="width: 100%; cursor: pointer;">
                    <div style="display: flex; justify-content: space-between; margin-top: 4px; color: #444;"><span>Thin</span><span>Thick</span></div>
                </fieldset>
            </div>
        `;

        const previewBar = root.querySelector("#tp-preview-bar");
        const previewClock = root.querySelector("#tp-preview-clock");
        const slider = root.querySelector("#tp-size-slider");
        const sizeLegend = root.querySelector("#tp-size-legend");

        root.querySelector("#tp-check-autohide").onchange = (e) => {
            tempSettings.autoHide = e.target.checked;
            previewBar.style.transform = tempSettings.autoHide ? 'translateY(80%)' : 'translateY(0)';
            onSettingModified();
        };

        root.querySelector("#tp-check-clock").onchange = (e) => {
            tempSettings.showClock = e.target.checked;
            previewClock.style.display = tempSettings.showClock ? 'flex' : 'none';
            onSettingModified();
        };

        root.querySelector("#tp-check-small").onchange = (e) => {
            tempSettings.smallIcons = e.target.checked;
            onSettingModified();
        };

        // UIと内部数値を同期する関数
        const updateHeightUI = (val) => {
            tempSettings.taskbarHeight = val;
            slider.value = val;
            sizeLegend.textContent = `Taskbar Size (Current: ${val}px)`;
            if (previewBar) previewBar.style.height = (val / 4) + "px";
        };

        slider.oninput = (e) => {
            const val = parseInt(e.target.value);
            updateHeightUI(val);
            onSettingModified(); // ここで notifyStyleChange が呼ばれ本体に即反映される
        };

        // 【同期機能】タスクバー本体が直接リサイズされた時にスライダーを動かす
        const handleExternalHeightChange = (e) => {
            const newHeight = e.detail.height;
            updateHeightUI(newHeight);
            // 直接リサイズ時は既に保存されているため Apply は無効のままで良い
        };

        window.addEventListener("taskbar-height-external-change", handleExternalHeightChange);

        // タブ切り替え時のクリーンアップに登録
        root._cleanup = () => {
            window.removeEventListener("taskbar-height-external-change", handleExternalHeightChange);
        };
    }

    /* ---------- Start Menu タブ描画 ---------- */
    async function renderStartMenu(root) {
        root.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 12px;">
                <fieldset style="padding: 12px; border: 2px groove #fff;">
                    <legend style="margin-left: 10px;">Customize Start Menu</legend>
                    <p style="margin: 0 0 10px 0;">You can customize the programs on your Start menu.</p>
                    <div style="display: flex; gap: 8px;">
                        <button class="win95-btn" disabled style="padding: 4px 12px;">Add...</button>
                        <button class="win95-btn" disabled style="padding: 4px 12px;">Remove...</button>
                        <button class="win95-btn" id="tp-sm-advanced" style="padding: 4px 12px;">Advanced...</button>
                    </div>
                </fieldset>

                <fieldset style="padding: 12px; border: 2px groove #fff;">
                    <legend style="margin-left: 10px;">Documents Menu</legend>
                    <p style="margin: 0 0 10px 0;">Click Clear to remove the contents of the Documents menu.</p>
                    <button class="win95-btn" id="tp-sm-clear" style="padding: 4px 12px;">Clear</button>
                </fieldset>
            </div>
        `;

        root.querySelector("#tp-sm-clear").onclick = async () => {
            if (confirm("Are you sure you want to clear the list of recently used documents?")) {
                const { clearRecent } = await import("./recent.js");
                await clearRecent();
                window.dispatchEvent(new Event("recent-updated"));
                alert("Documents menu cleared.");
            }
        };
        root.querySelector("#tp-sm-advanced").onclick = async () => {
            const { launch } = await import("./kernel.js");
            launch("explorer", { initialPath: "C:/Windows/Start Menu/Programs" });
        };
    }

    function onSettingModified() {
        applyBtn.classList.remove("pointer_none");
        notifyStyleChange();
    }

    function notifyStyleChange() {
        window.dispatchEvent(new CustomEvent("taskbar-style-changed", {
            detail: {
                showClock: tempSettings.showClock,
                taskbarHeight: tempSettings.taskbarHeight,
                autoHide: tempSettings.autoHide,
                smallIcons: tempSettings.smallIcons
            }
        }));
        window.dispatchEvent(new Event("desktop-resize"));
    }

    async function saveAll() {
        await saveSetting("taskbarHeight", tempSettings.taskbarHeight);
        await saveSetting("showClock", tempSettings.showClock);
        await saveSetting("smallIcons", tempSettings.smallIcons);
        await saveSetting("autoHide", tempSettings.autoHide);
        applyBtn.classList.add("pointer_none");
    }

    content.querySelector("#tp-ok").onclick = async () => { await saveAll(); notifyStyleChange(); closeWindow(); };
    content.querySelector("#tp-apply").onclick = async () => { await saveAll(); notifyStyleChange(); };
    content.querySelector("#tp-cancel").onclick = async () => {
        const h = await loadSetting("taskbarHeight") || 40;
        const c = (await loadSetting("showClock")) !== false;
        const a = await loadSetting("autoHide") || false;
        const s = await loadSetting("smallIcons") || false;

        // 設定を戻す
        tempSettings.taskbarHeight = h;
        tempSettings.showClock = c;
        tempSettings.autoHide = a;
        tempSettings.smallIcons = s;

        window.dispatchEvent(new CustomEvent("taskbar-style-changed", { detail: { taskbarHeight: h, showClock: c, autoHide: a, smallIcons: s } }));
        closeWindow();
    };

    function closeWindow() {
        const win = content.closest(".window");
        if (win) win.querySelector(".title-bar-button.close")?.click();
    }
}