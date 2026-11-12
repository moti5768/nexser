// taskbarproperties.js
import { loadSetting, saveSetting } from "./settings.js";
import { refreshMaximizedWindows } from "../window.js";

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
        taskbarSize: await loadSetting("taskbarSize") || 40,
        taskbarPosition: await loadSetting("taskbarPosition") || "bottom",
        showClock: (await loadSetting("showClock")) !== false,
        smallIcons: Boolean(await loadSetting("smallIcons")),
        autoHide: await loadSetting("autoHide") || false,
        taskbarWindowMode: await loadSetting("taskbarWindowMode") || false
    };

    let isSaved = false;

    const handleTaskbarStyleChanged = (e) => {
        if (e.detail) {
            if (e.detail.taskbarPosition) tempSettings.taskbarPosition = e.detail.taskbarPosition;
            if (e.detail.taskbarSize) tempSettings.taskbarSize = e.detail.taskbarSize;
            if (e.detail.autoHide !== undefined) tempSettings.autoHide = e.detail.autoHide;
            if (e.detail.showClock !== undefined) tempSettings.showClock = e.detail.showClock;

            // プロパティ画面が開いている場合は位置選択セレクトボックスの見た目も同期
            const selectPos = content.querySelector("#tp-select-position");
            if (selectPos && e.detail.taskbarPosition) selectPos.value = e.detail.taskbarPosition;
        }
    };
    window.addEventListener("taskbar-style-changed", handleTaskbarStyleChanged);

    /* ---------- タブ定義 ---------- */
    const tabs = [
        { id: "options", label: "Taskbar Options", render: renderOptions },
        { id: "startmenu", label: "Start Menu Programs", render: renderStartMenu }
    ];

    let currentTabId = null;
    let activeCleanup = null; // ★追加: 現在アクティブなタブのクリーンアップ関数を保持

    async function selectTab(id) {
        if (currentTabId === id) return;
        currentTabId = id;

        // タブボタンのアクティブ状態の切り替え
        [...tabsEl.children].forEach(btn => {
            const active = btn.dataset.id === id;
            btn.classList.toggle("active", active);
            btn.classList.toggle("inactive", !active);
        });

        if (activeCleanup) {
            activeCleanup();
            activeCleanup = null;
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
        btn.onmousedown = () => selectTab(t.id);
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
                        <div id="tp-preview-bar" style="width: 100%; height: ${tempSettings.taskbarSize / 4}px; background: #c0c0c0; border-top: 1px solid #fff; display: flex; align-items: center; padding: 0 2px; transform: ${tempSettings.autoHide ? 'translateY(80%)' : 'translateY(0)'}">
                            <div style="width: 15px; height: 70%; background: #c0c0c0; border: 1px solid #808080;"></div>
                            <div style="flex: 1;"></div>
                            <div id="tp-preview-clock" style="width: 25px; height: 70%; border: 1px inset #fff; font-size: 6px; display: ${tempSettings.showClock ? 'flex' : 'none'}; align-items: center; justify-content: center;">12:00</div>
                        </div>
                    </div>
                    <div style="flex: 1;">
                        <fieldset style="padding: 10px; border: 2px groove #fff; margin: 0;">
                            <legend style="margin-left: 10px;">Taskbar properties</legend>
                            <label style="display: flex; align-items: center; margin-bottom: 6px; gap: 4px; cursor: pointer;">
                                <input type="checkbox" id="tp-check-windowmode" ${tempSettings.taskbarWindowMode ? 'checked' : ''}> Window mode
                            </label>
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
                    <legend style="margin-left: 10px;" id="tp-size-legend">Taskbar Size (Current: ${tempSettings.taskbarSize}px)</legend>
                    <input type="range" id="tp-size-slider" min="40" max="320" step="40" value="${tempSettings.taskbarSize}" style="width: 100%; cursor: pointer;">
                    <div style="display: flex; justify-content: space-between; margin-top: 4px; color: #444;"><span>Thin</span><span>Thick</span></div>
                </fieldset>
                <div style="margin-top: 8px;">
    <label style="display: block; margin-bottom: 4px;">Taskbar location on screen:</label>
    <select id="tp-select-position" class="win95-select" style="width: 100%; padding: 2px;">
        <option value="bottom" ${tempSettings.taskbarPosition === 'bottom' ? 'selected' : ''}>Bottom</option>
        <option value="top" ${tempSettings.taskbarPosition === 'top' ? 'selected' : ''}>Top</option>
        <option value="left" ${tempSettings.taskbarPosition === 'left' ? 'selected' : ''}>Left</option>
        <option value="right" ${tempSettings.taskbarPosition === 'right' ? 'selected' : ''}>Right</option>
    </select>
</div>
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

        root.querySelector("#tp-check-windowmode").onchange = (e) => {
            tempSettings.taskbarWindowMode = e.target.checked;
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

        root.querySelector("#tp-select-position").onchange = (e) => {
            tempSettings.taskbarPosition = e.target.value;
            onSettingModified();
        };

        // UIと内部数値を同期する関数
        const updateSizeUI = (val) => {
            tempSettings.taskbarSize = val;
            slider.value = val;
            sizeLegend.textContent = `Taskbar Size (Current: ${val}px)`;
            if (previewBar) previewBar.style.height = (val / 4) + "px";
        };

        slider.oninput = (e) => {
            const val = parseInt(e.target.value);
            updateSizeUI(val);
            onSettingModified();
        };
        const handleExternalSizeChange = (e) => {
            const newSize = e.detail.size || e.detail.height;
            if (newSize) updateSizeUI(newSize);
        };
        window.addEventListener("taskbar-size-external-change", handleExternalSizeChange);
        return () => {
            window.removeEventListener("taskbar-size-external-change", handleExternalSizeChange);
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
            try {
                if (confirm("Are you sure you want to clear the list of recently used documents?")) {
                    const { clearRecent } = await import("./recent.js");
                    await clearRecent();
                    window.dispatchEvent(new Event("recent-updated"));
                    nexser.windowAPI.alertWindow("Documents menu cleared.");
                }
            } catch (e) {
                console.warn("履歴のクリアに失敗しました", e);
            }
        };

        root.querySelector("#tp-sm-advanced").onclick = async () => {
            try {
                await window.nexser?.kernelAPI?.launch("C:/Windows/Start Menu/Programs");
            } catch (e) {
                console.warn("エクスプローラーの起動に失敗しました", e);
            }
        };
    }

    function onSettingModified() {
        isSaved = false;
        applyBtn.classList.remove("pointer_none");
        notifyStyleChange();
    }

    function notifyStyleChange() {
        window.dispatchEvent(new CustomEvent("taskbar-style-changed", {
            detail: {
                showClock: tempSettings.showClock,
                taskbarSize: tempSettings.taskbarWindowMode ? undefined : tempSettings.taskbarSize,
                taskbarPosition: tempSettings.taskbarPosition,
                autoHide: tempSettings.autoHide,
                smallIcons: tempSettings.smallIcons,
                taskbarWindowMode: tempSettings.taskbarWindowMode
            }
        }));
        window.dispatchEvent(new Event("desktop-resize"));
        refreshMaximizedWindows();
    }

    async function saveAll() {
        await saveSetting("taskbarSize", tempSettings.taskbarSize);
        await saveSetting("taskbarPosition", tempSettings.taskbarPosition);
        await saveSetting("showClock", tempSettings.showClock);
        await saveSetting("smallIcons", tempSettings.smallIcons);
        await saveSetting("autoHide", tempSettings.autoHide);
        await saveSetting("taskbarWindowMode", tempSettings.taskbarWindowMode);
        isSaved = true;
        applyBtn.classList.add("pointer_none");
    }

    content.querySelector("#tp-ok").onclick = async () => {
        try {
            await saveAll();
            notifyStyleChange();
            refreshMaximizedWindows();
            isSaved = true;
            closeWindow();
        } catch (e) {
            console.warn("設定の保存に失敗しました", e);
        }
    };

    content.querySelector("#tp-apply").onclick = async () => {
        try {
            await saveAll();
            notifyStyleChange();
            refreshMaximizedWindows();
            isSaved = true;
        } catch (e) {
            console.warn("設定の適用に失敗しました", e);
        }
    };


    async function handleCancel() {
        try {
            const sVal = await loadSetting("taskbarSize") || 40;
            const p = await loadSetting("taskbarPosition") || "bottom";
            const c = (await loadSetting("showClock")) !== false;
            const a = await loadSetting("autoHide") || false;
            const s = Boolean(await loadSetting("smallIcons"));
            const w = await loadSetting("taskbarWindowMode") || false;

            tempSettings.taskbarSize = sVal;
            tempSettings.taskbarPosition = p;
            tempSettings.showClock = c;
            tempSettings.autoHide = a;
            tempSettings.smallIcons = s;
            tempSettings.taskbarWindowMode = w;

            const checkWindowMode = content.querySelector("#tp-check-windowmode");
            const checkAutoHide = content.querySelector("#tp-check-autohide");
            const checkClock = content.querySelector("#tp-check-clock");
            const checkSmall = content.querySelector("#tp-check-small");
            const selectPos = content.querySelector("#tp-select-position"); // ⭕ 追加: 位置選択セレクトボックス
            const slider = content.querySelector("#tp-size-slider");
            const sizeLegend = content.querySelector("#tp-size-legend");
            const previewBar = content.querySelector("#tp-preview-bar");
            const previewClock = content.querySelector("#tp-preview-clock");

            if (checkWindowMode) checkWindowMode.checked = w;
            if (checkAutoHide) checkAutoHide.checked = a;
            if (checkClock) checkClock.checked = c;
            if (checkSmall) checkSmall.checked = s;
            if (selectPos) selectPos.value = p; // ⭕ 追加: セレクトボックスの選択を復元
            if (slider) slider.value = sVal; // ⭕ sVal を使う
            if (sizeLegend) sizeLegend.textContent = `Taskbar Size (Current: ${sVal}px)`; // ⭕ sVal
            if (previewBar) {
                previewBar.style.height = (sVal / 4) + "px"; // ⭕ sVal
                previewBar.style.transform = a ? 'translateY(80%)' : 'translateY(0)';
            }
            if (previewClock) {
                previewClock.style.display = c ? 'flex' : 'none';
            }
            window.dispatchEvent(new CustomEvent("taskbar-style-changed", {
                detail: {
                    taskbarSize: w ? undefined : sVal, // ⭕ taskbarSize に修正
                    taskbarPosition: p,
                    showClock: c,
                    autoHide: a,
                    smallIcons: s,
                    taskbarWindowMode: w
                }
            }));
            window.dispatchEvent(new Event("desktop-resize"));
            refreshMaximizedWindows();
        } catch (e) {
            console.warn("設定の復元に失敗しました", e);
        }
    }

    content.querySelector("#tp-cancel").onclick = async () => {
        await handleCancel();
        isSaved = true; // 追加: キャンセル終了なので自動キャンセルを発動させない[cite: 2]
        closeWindow();
    };

    function closeWindow() {
        const win = content.closest(".window");
        if (win) win.querySelector(".title-bar-button.close")?.click();
    }

    const winEl = content.closest(".window");
    if (winEl) {
        const observer = new MutationObserver((mutations) => {
            if (!document.body.contains(winEl)) {
                observer.disconnect();
                if (!isSaved) {
                    handleCancel();
                }
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
    return {
        dispose: () => {
            window.removeEventListener("taskbar-style-changed", handleTaskbarStyleChanged);
            if (activeCleanup) {
                activeCleanup();
                activeCleanup = null;
            }
        }
    };
}