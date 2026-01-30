// bsod.js
export function showBSOD(message, error = null) {
    const div = document.createElement("div");
    Object.assign(div.style, {
        position: "fixed",
        inset: 0,
        background: "#0000AA",
        color: "white",
        fontFamily: "Courier New, monospace",
        fontSize: "16px",
        lineHeight: "1.3em",
        padding: "20px",
        zIndex: 999999,
        whiteSpace: "pre-wrap",
        overflowY: "auto",
    });

    // 関連スタックだけ抽出
    let stack = "";
    if (error?.stack) {
        const lines = error.stack.split("\n");
        stack = lines.filter(l =>
            l.includes("/boot.js") || l.includes("/kernel.js") || l.includes("/fs.js") || l.includes("/startmenu.js")
        ).join("\n");
        if (!stack) stack = lines[0];
    }

    // エラーメッセージ作成
    let fullMessage = `
A fatal exception has occurred and Windows has been shut down to prevent damage to your computer.

ERROR:
${message || "Unknown error"}
`;

    if (stack) {
        fullMessage += `

STACK TRACE:
${stack}`;
    }

    document.body.innerHTML = "";
    document.body.appendChild(div);

    // 高速タイプライター表示（1フレームで複数文字）
    let i = 0;
    const CHARS_PER_FRAME = 8; // 1フレームで表示する文字数
    function typeChar() {
        if (i < fullMessage.length) {
            div.textContent += fullMessage.slice(i, i + CHARS_PER_FRAME);
            i += CHARS_PER_FRAME;
            requestAnimationFrame(typeChar);
        }
    }
    typeChar();

    // 任意のキーでページリロード
    function keyHandler() {
        window.removeEventListener("keydown", keyHandler);
        location.reload();
    }
    window.addEventListener("keydown", keyHandler);
}
