// explorer.worker.js
const IGNORED_METADATA_KEYS = new Set(["type", "name", "size", "content", "entry", "singleton", "target"]);

function calcNodeSizeWorker(node, path = "") {
    if (!node) return 0;
    try {
        if (node.type === "file") {
            if (typeof node.size === "number") return node.size;
            if (node.content && typeof node.content === "string") {
                return node.content.length;
            }
            return 0;
        }
        if (node.type === "folder") {
            let total = 0;
            for (const key of Object.keys(node)) {
                if (IGNORED_METADATA_KEYS.has(key)) continue;
                const childNode = node[key];
                if (childNode) {
                    total += calcNodeSizeWorker(childNode, path ? `${path}/${key}` : key);
                }
            }
            return total;
        }
    } catch (e) {
        return node?.size || 0;
    }
    return 0;
}

self.onmessage = (e) => {
    const { type, payload, id } = e.data;
    if (type === "CALC_SIZE") {
        const size = calcNodeSizeWorker(payload.node, payload.path);
        self.postMessage({ id, size });
    }
};