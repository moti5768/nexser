// TaskManager.js
import { getProcessList, killProcess } from "../kernel.js";

export default function TaskManager(root) {

    root.innerHTML = `
        <div style="font-size:12px;">
            <table class="task-table">
                <thead>
                    <tr>
                        <th style="width:50px;">PID</th>
                        <th style="width:120px;">Name</th>
                        <th style="width:60px;">CPU%</th>
                        <th style="width:80px;">Mem</th>
                        <th style="width:70px;">State</th>
                        <th style="width:60px;">Up</th>
                        <th style="width:40px;">Z</th>
                        <th style="width:140px;">Path</th>
                        <th style="width:60px;"></th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>
    `;

    const tbody = root.querySelector("tbody");
    if (!tbody) return;

    const rowMap = new Map();
    let timer = null;

    function refresh() {

        if (!document.body.contains(root)) {
            stop();
            return;
        }

        const list = getProcessList();
        const activeKeys = new Set(list.map(p => p.key));

        // 削除されたプロセス
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

                for (let i = 0; i < 9; i++) {
                    const td = document.createElement("td");
                    tr.appendChild(td);
                }

                const btn = document.createElement("button");
                btn.textContent = "終了";
                btn.onclick = () => killProcess(p.key);

                tr.children[8].appendChild(btn);

                tbody.appendChild(tr);
                rowMap.set(p.key, tr);
            }

            const cells = tr.children;

            cells[0].textContent = p.pid;
            cells[1].textContent = p.name;
            cells[2].textContent = p.cpu + " %";
            cells[3].textContent = p.memory + " MB";
            cells[4].textContent = p.state;
            cells[5].textContent = p.uptime + " s";
            cells[6].textContent = p.zIndex ?? "";
            cells[7].textContent = p.path;
        }
    }

    function stop() {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
        if (observer) observer.disconnect();
    }

    refresh();
    timer = setInterval(refresh, 1000);

    const win = root.closest(".window");
    let observer = null;

    if (win) {
        observer = new MutationObserver(() => {
            if (!document.body.contains(win)) {
                stop();
            }
        });
        observer.observe(document.body, { childList: true });
    }
}