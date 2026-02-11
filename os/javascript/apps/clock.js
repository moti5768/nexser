// ClockApp.js
import { saveSetting, loadSetting } from "./settings.js";

// グローバル時刻（アプリ起動していなくても進む）
export let clockDate = new Date();

// ==================== 裏でカウントアップ ====================
if (!window._ClockAppInterval) {
    (async () => {
        const saved = await loadSetting("ClockAppDate");
        window._ClockIsManual = false; // 手動設定フラグをグローバルに

        if (saved) {
            clockDate = new Date(saved);
            window._ClockIsManual = true; // 保存があれば手動設定扱い
        }

        window._ClockAppInterval = setInterval(() => {
            if (!window._ClockIsManual) {
                // 手動設定してない場合はリアルタイム
                clockDate = new Date();
            } else {
                // 手動設定済みなら1秒ずつ進める
                clockDate.setSeconds(clockDate.getSeconds() + 1);
            }
            window.dispatchEvent(new CustomEvent("ClockAppTimeChange", { detail: clockDate }));
        }, 1000);

        // window.setDateTime で手動設定フラグを立てる
        const originalSetDateTime = window.setDateTime;
        window.setDateTime = (date) => {
            window._ClockIsManual = true;
            clockDate = new Date(date);
            saveSetting("ClockAppDate", clockDate.toISOString());
            window.dispatchEvent(new CustomEvent("ClockAppTimeChange", { detail: clockDate }));
        };
    })();
}

export default async function ClockApp(content) {
    content.innerHTML = `
        <div class="win95-tab-container" style="height:100%; display:flex; flex-direction:column;">
            <div id="tabs" class="win95-tabs"></div>
            <div id="tab-body" style="flex:1; overflow:auto; padding:4px;"></div>
        </div>
    `;

    const tabsEl = content.querySelector("#tabs");
    const bodyEl = content.querySelector("#tab-body");

    const tabs = [
        { id: "analog", label: "Clock", render: renderAnalog },
        { id: "calendar", label: "Calendar", render: renderCalendar }
    ];

    async function selectTab(id) {
        [...tabsEl.children].forEach(btn => {
            const active = btn.dataset.id === id;
            btn.classList.toggle("active", active);
            btn.classList.toggle("inactive", !active);
        });

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
        btn.onclick = () => selectTab(t.id);
        tabsEl.appendChild(btn);
    });

    // ==================== 共通関数 ====================
    function setDateTime(date) {
        clockDate = new Date(date);
        window._ClockIsManual = true; // ←裏のカウント用フラグをグローバルに
        saveSetting("ClockAppDate", clockDate.toISOString());
        window.dispatchEvent(new CustomEvent("ClockAppTimeChange", { detail: clockDate }));
    }

    // ==================== ウィンドウ閉じる時 & ページ unload 時に保存 ====================
    if (!window._clockBeforeUnloadHooked) {
        window._clockBeforeUnloadHooked = true;
        window.addEventListener("beforeunload", () => {
            saveSetting("ClockAppDate", clockDate.toISOString());
        });
    }

    const win = content.closest(".window");
    if (win && !win._clockSaveHooked) {
        win._clockSaveHooked = true;
        const closeBtn = win.querySelector(".close-btn");
        if (closeBtn) {
            const originalClose = closeBtn.onclick?.bind(closeBtn);
            closeBtn.onclick = (e) => {
                saveSetting("ClockAppDate", clockDate.toISOString());
                if (originalClose) originalClose(e);
            };
        }
    }

    // =================== Clock タブ ===================
    async function renderAnalog(root) {
        root.innerHTML = `
            <canvas id="clockCanvas" style="display:block; margin:auto; background:#C0C0C0; border:2px inset #fff;"></canvas>
            <div style="text-align:center; margin-top:6px;">
                <label>Hour: <input id="hourInput" type="number" min="0" max="23" style="width:40px;"></label>
                <label>Min: <input id="minuteInput" type="number" min="0" max="59" style="width:40px;"></label>
                <label>Sec: <input id="secondInput" type="number" min="0" max="59" style="width:40px;"></label>
                <button id="setBtn">Set</button>
            </div>
        `;

        const canvas = root.querySelector("#clockCanvas");
        const ctx = canvas.getContext("2d");
        const hourInput = root.querySelector("#hourInput");
        const minuteInput = root.querySelector("#minuteInput");
        const secondInput = root.querySelector("#secondInput");
        const setBtn = root.querySelector("#setBtn");

        function updateInputs() {
            hourInput.value = clockDate.getHours();
            minuteInput.value = clockDate.getMinutes();
            secondInput.value = clockDate.getSeconds();
        }
        updateInputs();

        let isEditing = false;
        [hourInput, minuteInput, secondInput].forEach(input => {
            input.addEventListener("focus", () => isEditing = true);
            input.addEventListener("blur", () => isEditing = false);
        });

        function drawClock(date) {
            const rect = root.getBoundingClientRect();
            const width = rect.width - 20;
            const height = rect.height - 80;
            if (width < 20 || height < 20) return;
            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
            }

            const radius = Math.max(Math.min(width, height) / 2 - 2, 10);
            ctx.resetTransform();
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.translate(width / 2, height / 2);

            drawFace(ctx, radius);
            drawNumbers(ctx, radius);
            drawTime(ctx, radius, date);
        }

        function drawFace(ctx, radius) {
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, 2 * Math.PI);
            ctx.fillStyle = "#C0C0C0";
            ctx.fill();
            ctx.beginPath();
            ctx.arc(0, 0, 4, 0, 2 * Math.PI);
            ctx.fillStyle = "#000";
            ctx.fill();
        }

        function drawNumbers(ctx, radius) {
            ctx.font = `${radius * 0.18}px 'MS Sans Serif'`;
            ctx.textBaseline = "middle";
            ctx.textAlign = "center";
            ctx.fillStyle = "#000";
            const numRadius = radius - radius * 0.15;
            for (let num = 1; num <= 12; num++) {
                const ang = num * Math.PI / 6;
                const x = numRadius * Math.sin(ang);
                const y = -numRadius * Math.cos(ang);
                ctx.fillText(num.toString(), x, y);
            }
        }

        function drawTime(ctx, radius, date) {
            const hour = date.getHours() % 12;
            const minute = date.getMinutes();
            const second = date.getSeconds();
            drawHand(ctx, hour * Math.PI / 6 + minute * Math.PI / 360, radius * 0.6, 6, "#008080");
            drawHand(ctx, minute * Math.PI / 30, radius * 0.9, 4, "#008080");
            drawHand(ctx, second * Math.PI / 30, radius * 0.98, 1, "#000");
        }

        function drawHand(ctx, pos, length, width, color = "#000") {
            ctx.beginPath();
            ctx.lineWidth = width;
            ctx.strokeStyle = color;
            ctx.lineCap = "square";
            ctx.moveTo(0, 0);
            ctx.rotate(pos);
            ctx.lineTo(0, -length);
            ctx.stroke();
            ctx.rotate(-pos);
        }

        function drawClockTab() {
            drawClock(clockDate);
            if (!isEditing) updateInputs();
        }

        setBtn.onclick = () => {
            const h = parseInt(hourInput.value) || 0;
            const m = parseInt(minuteInput.value) || 0;
            const s = parseInt(secondInput.value) || 0;
            clockDate.setHours(h, m, s);
            setDateTime(clockDate);
            drawClockTab();
        };

        const resizeObserver = new ResizeObserver(() => requestAnimationFrame(drawClockTab));
        resizeObserver.observe(root);

        const clockUpdateHandler = () => requestAnimationFrame(drawClockTab);
        window.addEventListener("ClockAppTimeChange", clockUpdateHandler);

        root._cleanup = () => {
            window.removeEventListener("ClockAppTimeChange", clockUpdateHandler);
            resizeObserver.disconnect();
        };

        drawClockTab();
    }

    // =================== Calendar タブ ===================
    async function renderCalendar(root) {
        root.innerHTML = `
            <div style="text-align:center; margin-bottom:6px;">
                <label>Year: <input id="yearInput" type="number" min="1900" max="2100" style="width:60px;"></label>
                <label>Month: <input id="monthInput" type="number" min="1" max="12" style="width:40px;"></label>
                <label>Day: <input id="dayInput" type="number" min="1" max="31" style="width:40px;"></label>
                <button id="setBtn">Set</button>
            </div>
            <div id="calendarTable"></div>
        `;

        const yearInput = root.querySelector("#yearInput");
        const monthInput = root.querySelector("#monthInput");
        const dayInput = root.querySelector("#dayInput");
        const setBtn = root.querySelector("#setBtn");
        const tableContainer = root.querySelector("#calendarTable");

        function updateInputs() {
            yearInput.value = clockDate.getFullYear();
            monthInput.value = clockDate.getMonth() + 1;
            dayInput.value = clockDate.getDate();
        }
        updateInputs();

        function renderMonth(date) {
            const year = date.getFullYear();
            const month = date.getMonth();
            const firstDay = new Date(year, month, 1).getDay();
            const lastDate = new Date(year, month + 1, 0).getDate();

            let html = `<table style="width:100%; border-collapse:collapse;">
                <tr>${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => `<th style="padding:2px;" class="border">${d}</th>`).join("")}</tr>
                <tr>`;

            for (let i = 0; i < firstDay; i++) html += "<td></td>";
            for (let d = 1; d <= lastDate; d++) {
                const dow = (firstDay + d - 1) % 7;
                html += `<td style="text-align:center; padding:2px; cursor:pointer;" class="border" data-day="${d}">${d}</td>`;
                if (dow === 6 && d !== lastDate) html += "</tr><tr>";
            }
            html += "</tr></table>";
            tableContainer.innerHTML = html;

            tableContainer.querySelectorAll("td[data-day]").forEach(td => {
                const day = parseInt(td.dataset.day);
                td.onclick = () => {
                    clockDate.setDate(day);
                    setDateTime(clockDate);
                    updateInputs();
                    renderMonth(clockDate);
                };
                if (day === date.getDate()) {
                    td.style.backgroundColor = "red";
                    td.style.color = "white";
                } else {
                    td.style.backgroundColor = "";
                    td.style.color = "";
                }
            });
        }

        setBtn.onclick = () => {
            const y = parseInt(yearInput.value);
            const m = parseInt(monthInput.value) - 1;
            const d = parseInt(dayInput.value);
            clockDate.setFullYear(y, m, d);
            setDateTime(clockDate);
            renderMonth(clockDate);
        };

        renderMonth(clockDate);
    }

    selectTab("analog");
}
