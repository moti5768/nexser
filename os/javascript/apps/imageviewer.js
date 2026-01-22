// ImageViewer.js
import { resolveFS } from "../fs-utils.js";

export default function ImageViewer(root, options = {}) {
    const { path } = options;
    const node = resolveFS(path);

    root.innerHTML = `
        <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
            <img style="max-width:100%;max-height:100%;" />
        </div>
    `;

    const img = root.querySelector("img");

    if (node?.content) {
        img.src = node.content;   // base64 or dataURL想定
    } else {
        img.alt = "No image data";
    }
}
