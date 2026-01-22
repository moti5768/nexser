// VideoPlayer.js
import { resolveFS } from "../fs-utils.js";

export default function VideoPlayer(root, options = {}) {
    const { path } = options;
    const node = resolveFS(path);

    root.innerHTML = `
        <video controls style="width:100%;height:100%;background:black;"></video>
    `;

    const video = root.querySelector("video");

    if (node?.content) {
        video.src = node.content;
    } else {
        video.textContent = "No video data";
    }
}
