// calc.js
export default function CalcApp(content, options) {
    if (!content) return;

    const win = content.parentElement;
    if (win) {
        win.style.width = "300px";
        win.style.height = "365px";
    }

    content.innerHTML = `
        <div style="display:flex; flex-direction:column; height:100%;">
            <input id="calc-display" readonly
                style="height:40px; font-size:20px; text-align:right; margin:3px; padding:5px; background-color: white;">
            <div id="calc-buttons"
                style="flex:1; display:grid; grid-template-columns: repeat(4, 1fr); gap:5px;">
            </div>
        </div>
    `;

    const buttons = [
        "C", "⌫", "", "/",
        "7", "8", "9", "*",
        "4", "5", "6", "-",
        "1", "2", "3", "+",
        "0", ".", "=", ""
    ];

    const btnContainer = content.querySelector("#calc-buttons");
    const display = content.querySelector("#calc-display");

    let current = "";
    let error = false;

    function update() {
        display.value = current || "0";
    }

    function clear() {
        current = "";
        error = false;
        update();
    }

    function backspace() {
        current = current.slice(0, -1);
        update();
    }

    function isOperator(ch) {
        return /[+\-*/]/.test(ch);
    }

    function input(val) {
        if (error) clear();

        const last = current.slice(-1);

        // 演算子の連続入力防止
        if (isOperator(val) && isOperator(last)) return;

        current += val;
        update();
    }

    function calculate() {
        try {
            if (!current) return;
            const result = eval(current);
            current = result.toString();
        } catch {
            current = "Error";
            error = true;
        }
        update();
    }

    // ボタン生成
    buttons.forEach(label => {
        const btn = document.createElement("button");

        if (!label) {
            btn.disabled = true;
            btn.style.visibility = "hidden";
            btnContainer.appendChild(btn);
            return;
        }

        btn.textContent = label;
        btn.style.height = "40px";
        btn.style.fontSize = "16px";

        btn.onclick = () => {
            if (label === "C") return clear();
            if (label === "⌫") return backspace();
            if (label === "=") return calculate();
            input(label);
        };

        btnContainer.appendChild(btn);
    });

    // キーボード対応
    content.tabIndex = 0;
    content.focus();

    content.addEventListener("keydown", e => {
        if (/[0-9]/.test(e.key)) input(e.key);
        if ("+-*/.".includes(e.key)) input(e.key);
        if (e.key === "Enter") calculate();
        if (e.key === "Backspace") backspace();
        if (e.key === "Escape") clear();
    });

    update();
}
