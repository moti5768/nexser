// TaskManager
import { getProcessList, killProcess } from "../kernel.js";

export default function TaskManager(root) {
    root.innerHTML = `
        <div style="font-size:12px;">
            <table class="task-table">
                <thead>
                    <tr>
                        <th>PID</th>
                        <th>Name</th>
                        <th>State</th>
                        <th>Path</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>
    `;

    const tbody = root.querySelector("tbody");

    function refresh() {
        const list = getProcessList();
        tbody.innerHTML = "";

        for (const p of list) {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${p.pid}</td>
                <td>${p.name}</td>
                <td>${p.state}</td>
                <td style="max-width:160px; overflow:hidden; text-overflow:ellipsis;">${p.path}</td>
                <td><button>終了</button></td>
            `;

            tr.querySelector("button").onclick = () => {
                killProcess(p.key);
                refresh();
            };

            tbody.appendChild(tr);
        }
    }

    refresh();
    const timer = setInterval(refresh, 1000);

    const win = root.closest(".window");
    if (win) {
        const observer = new MutationObserver(() => {
            if (!document.body.contains(win)) {
                clearInterval(timer);
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
}
