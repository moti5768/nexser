// calc.js
export default function CalcApp(content, options) {
    if (!content) return;

    const win = content.parentElement;
    if (win) {
        win.style.width = "300px";
        win.style.height = "365px";
    }

    content.classList.add("scrollbar_none");

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
        if (error) {
            clear();
            return;
        }
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

        // 小数点重複防止
        if (val === ".") {
            const parts = current.split(/[\+\-\*\/]/);
            const lastNum = parts[parts.length - 1];
            if (lastNum.includes(".")) return;
        }

        current += val;
        update();
    }


    function calculate() {
        if (!current) return;
        try {
            // 数字と演算子以外を削除
            let expr = current.replace(/[^0-9+\-*/.]/g, "");

            // 先頭の演算子を削除（- は残す）
            expr = expr.replace(/^[+*/]+/, "");

            // 演算子の連続を1つにまとめる
            expr = expr.replace(/([+\-*/]){2,}/g, "$1");

            // 末尾の演算子は削除
            expr = expr.replace(/[*+\-/.]$/, "");

            const result = Function('"use strict"; return (' + expr + ')')();
            current = result.toString();
            error = false;
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
        btn.style.width = "100%";
        btn.style.height = "100%";
        btn.style.fontSize = "1rem";
        btn.style.flex = "1 1 auto"; // グリッド内で均等に拡張

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
        const key = e.key;

        // 数字
        if (key.length === 1 && /[0-9]/.test(key)) input(key);

        // 小数点
        if (key === ".") input(".");

        // 演算子（Shift組み合わせも考慮）
        if (["+", "-", "*", "/"].includes(key)) input(key);

        if (key === "Enter") calculate();
        if (key === "Backspace") backspace();
        if (key === "Escape") clear();
    });



    update();
}
