// FileViewer.js
export default function FileViewer(root, fileData) {
    root.innerHTML = `
        <h3>${fileData.name}</h3>
        <pre class="file-content">${fileData.content}</pre>
    `;
}