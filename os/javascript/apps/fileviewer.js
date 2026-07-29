// FileViewer.js
export default function FileViewer(root, options = {}) {
    // 1. kernel/Explorer から渡される options (または直接の node) を安全に解決
    const node = options.node || options;
    const path = options.path || "";

    // 2. パスからファイル名を抽出する（なければ node.name やデフォルト名）
    const fileName = path ? path.split("/").pop() : (node.name || "無題のファイル");
    const fileContent = node.content || "";

    root.innerHTML = `
        <div style="display: flex; flex-direction: column; height: 100%; box-sizing: border-box; padding: 8px;">
            <h3 style="margin: 0 0 8px 0; font-size: 14px;">${fileName}</h3>
            <pre class="file-content" style="flex: 1; overflow: auto; margin: 0; background: #fff; border: 1px solid #ccc; padding: 8px; font-family: Consolas, monospace; font-size: 12px;">${fileContent}</pre>
        </div>
    `;
}