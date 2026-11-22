// spreadsheet.worker.js
// 大容量スナップショットのJSONシリアライズ・CSVパース/生成をバックグラウンド実行するWeb Worker

function parseCSVRowsInWorker(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    const normalized = String(text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    for (let i = 0; i < normalized.length; i++) {
        const ch = normalized[i];
        if (inQuotes) {
            if (ch === '"' && normalized[i + 1] === '"') {
                field += '"';
                i++;
            } else if (ch === '"') {
                inQuotes = false;
            } else {
                field += ch;
            }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === ",") {
            row.push(field);
            field = "";
        } else if (ch === "\n") {
            row.push(field);
            rows.push(row);
            row = [];
            field = "";
        } else {
            field += ch;
        }
    }
    if (field !== "" || row.length > 0) {
        row.push(field);
        rows.push(row);
    }
    return rows;
}

function generateCSVTextInWorker(matrix) {
    const lines = new Array(matrix.length);
    for (let r = 0; r < matrix.length; r++) {
        const cols = matrix[r];
        const outCols = new Array(cols.length);
        for (let c = 0; c < cols.length; c++) {
            const rawText = String(cols[c] ?? "");
            if (/[",\r\n]/.test(rawText)) {
                outCols[c] = `"${rawText.replace(/"/g, '""')}"`;
            } else {
                outCols[c] = rawText;
            }
        }
        lines[r] = outCols.join(",");
    }
    return lines.join("\n");
}

self.addEventListener("message", (e) => {
    const { id, type, payload } = e.data || {};
    try {
        if (type === "stringify-snapshot") {
            const serialized = JSON.stringify(payload);
            self.postMessage({ id, ok: true, result: serialized });
            return;
        }
        if (type === "parse-csv") {
            const rows = parseCSVRowsInWorker(payload);
            self.postMessage({ id, ok: true, result: rows });
            return;
        }
        if (type === "generate-csv") {
            const csv = generateCSVTextInWorker(payload);
            self.postMessage({ id, ok: true, result: csv });
            return;
        }
        self.postMessage({ id, ok: false, error: `Unknown worker task: ${type}` });
    } catch (err) {
        self.postMessage({ id, ok: false, error: err?.message || String(err) });
    }
});