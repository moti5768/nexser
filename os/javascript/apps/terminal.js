// Terminal.js
import { launch, logOff, resetUI } from "../kernel.js";
import {
    getWindows,
    closeWindowById,
    focusWindowById,
    minimizeWindowById,
    maximizeWindowById
} from "../window.js";
import { resolveFS, normalizePath } from "../fs-utils.js";

export default function TerminalApp(content) {

    /* =========================
       UI Setup
    ========================= */

    content.style.background = "black";
    content.style.color = "#0f0";
    content.style.fontFamily = "Consolas, monospace";
    content.style.fontSize = "14px";

    content.innerHTML = `
        <div class="terminal-screen"></div>
        <div class="terminal-input">
            <span class="prompt">C:/></span>
            <input type="text" autocomplete="off" />
        </div>
    `;

    const screen = content.querySelector(".terminal-screen");
    const input = content.querySelector("input");
    const promptSpan = content.querySelector(".prompt");

    let cwd = "C:/";
    let editorActive = false;
    let editorBuffer = [];
    let editorNode = null;
    let editorResolve = null;

    let history = [];
    let hIndex = 0;
    const createdFiles = [];
    const MAX_LINES = 500;

    screen.style.overflowY = "auto";

    /* =========================
       Utilities
    ========================= */

    function scrollToBottom() {
        requestAnimationFrame(() => {
            setTimeout(() => {
                screen.scrollTop = screen.scrollHeight;
            }, 50);
        });
    }

    function print(text = "", color = null, bg = null, size = null) {
        const line = document.createElement("div");
        line.textContent = text;
        if (color) line.style.color = color;
        if (bg) line.style.backgroundColor = bg;
        if (size) line.style.fontSize = size;
        screen.appendChild(line);
        while (screen.children.length > MAX_LINES) {
            screen.removeChild(screen.firstChild);
        }
        scrollToBottom();
    }

    function commonPrefix(arr) {
        if (!arr.length) return "";
        let prefix = arr[0];
        for (let i = 1; i < arr.length; i++) {
            while (!arr[i].startsWith(prefix)) {
                prefix = prefix.slice(0, -1);
                if (!prefix) return "";
            }
        }
        return prefix;
    }

    function getNodeByPath(path) {
        // normalizePath で cwd 基準の絶対パスに変換
        const fullPath = normalizePath(path, cwd);
        // FS のルートから探索
        const node = resolveFS(fullPath.replace(/^C:\//, ""));
        if (!node) return null;
        return node;
    }

    // フォルダ内も探索する helper
    function findNodeRecursively(baseNode, targetName) {
        if (!baseNode || typeof baseNode !== "object") return null;
        if (baseNode[targetName]) return baseNode[targetName];
        for (const key of Object.keys(baseNode)) {
            if (["type", "entry", "singleton"].includes(key)) continue;
            const found = findNodeRecursively(baseNode[key], targetName);
            if (found) return found;
        }
        return null;
    }

    function fsPathToURL(fsPath) {
        if (!fsPath) return null;
        const parts = fsPath.replace(/^C:\//, "").split("/");
        const fileName = parts.pop();
        if (!fileName.toLowerCase().endsWith(".app")) return null;
        return `/javascript/apps/${fileName.replace(/\.app$/i, "").toLowerCase()}.js`;
    }

    /* =========================
       Command Registry
    ========================= */

    const commands = {

        help: {
            desc: "Show available commands", run() {
                Object.entries(commands).forEach(([name, cmd]) => {
                    print(`${name.padEnd(12)} - ${cmd.desc}`);
                });
            }
        },

        cls: { desc: "Clear screen", run() { screen.innerHTML = ""; } },

        logoff: { desc: "Log off OS", async run() { await logOff(); input.blur(); } },

        pwd: { desc: "Show current directory", run() { print(cwd); } },

        ls: {
            desc: "List directory contents", run(args) {
                const node = getNodeByPath(args[0]);
                if (!node) return print("Path not found");
                Object.keys(node)
                    .filter(k => !["type", "entry", "singleton"].includes(k))
                    .forEach(name => print(name));
            }
        },

        cd: {
            desc: "Change directory",
            run(args) {
                if (!args[0]) return;
                const node = getNodeByPath(args[0]);
                if (!node || node.type === "file") return print("Not a directory");
                let newPath = normalizePath(args[0], cwd);
                if (newPath !== "C:/") {
                    newPath = newPath.replace(/\/$/, "");
                }
                cwd = newPath;
                promptSpan.textContent = cwd + ">";
            }
        },

        cat: {
            desc: "Show file content", run(args) {
                const node = getNodeByPath(args[0]);
                if (!node) return print("File not found");
                if (node.type !== "file") return print("Not a file");
                print(node.content);
            }
        },

        tree: {
            desc: "Show directory tree", run(args) {
                const root = getNodeByPath(args[0]);
                if (!root) return print("Path not found");
                function walk(node, indent = "") {
                    Object.entries(node).forEach(([name, value]) => {
                        if (["type", "entry", "singleton", "target"].includes(name)) return;
                        print(indent + "├─ " + name);
                        if (typeof value === "object" && value.type !== "file") walk(value, indent + "│  ");
                    });
                }
                print(cwd);
                walk(root);
            }
        },

        launch: {
            desc: "Launch application or open file/folder",
            run(args) {
                if (!args[0]) return print("Usage: launch <path>");

                let path = normalizePath(args[0], cwd);
                const fsPath = path.replace(/^C:\//, "");
                const node = resolveFS(fsPath);

                if (!node) return print(`対象が見つかりません: ${path}`);

                // リンク解決
                const finalNode = node.type === "link" ? resolveFS(node.target) : node;
                const finalPath = node.type === "link" ? node.target : fsPath;

                if (!finalNode) return print(`リンク先が見つかりません: ${args[0]}`);

                switch (finalNode.type) {
                    case "app":
                    case "file":
                    case "folder":
                        launch(finalPath, { parentCwd: cwd });
                        break;
                    default:
                        print(`不明なタイプ: ${finalNode.type}`);
                }
            }
        },

        open: {
            desc: "Open file or app",
            async run(args) {
                if (!args[0]) return print("Usage: open <path>");

                let path = normalizePath(args[0], cwd);
                let node = resolveFS(path.replace(/^C:\//, ""));
                if (!node) return print(`File/app not found: ${args[0]}`);

                // リンク解決
                if (node.type === "link") {
                    path = node.target;
                    node = resolveFS(node.target);
                    if (!node) return print(`Target not found: ${args[0]}`);
                }

                switch (node.type) {
                    case "app":
                        {
                            try {
                                const appModule = await import(node.entry);
                                appModule.default?.();
                                print(`App launched: ${args[0]}`);
                            } catch (err) {
                                print(`Failed to launch app: ${err.message}`, "#f00");
                            }
                        }
                        break;

                    case "file":
                        print(node.content);
                        break;

                    case "folder":
                        launch("Programs/Explorer.app", { path, parentCwd: cwd });
                        break;

                    default:
                        print(`Cannot open: unknown type ${node.type}`);
                }
            }
        },

        ps: {
            desc: "List windows", run() {
                const wins = getWindows();
                if (!wins.length) return print("No windows");
                wins.forEach(w => print(`${w.id.toString().padEnd(3)} : ${w.title}`));
            }
        },

        kill: {
            desc: "Close window by id", run(args) {
                const id = Number(args[0]);
                if (Number.isNaN(id)) return print("Usage: kill <id>");
                try { closeWindowById(id); print(`Window ${id} closed`); } catch { print("Invalid window id"); }
            }
        },

        focus: { desc: "Focus window by id", run(args) { focusWindowById(Number(args[0])); } },
        minimize: { desc: "Minimize window by id", async run(args) { await minimizeWindowById(Number(args[0])); } },
        maximize: { desc: "Maximize window by id", async run(args) { await maximizeWindowById(Number(args[0])); } },
        resetui: { desc: "Reset all windows and UI", run() { resetUI(); print("UI has been reset."); } },

        touch: {
            desc: "Create empty file", run(args) {
                if (!args[0]) return print("Usage: touch <file>");
                const fullPath = normalizePath(args[0], cwd);
                const pathWithoutDrive = fullPath.replace(/^C:\//, "");
                const parts = pathWithoutDrive.split("/");
                const name = parts.pop();
                const parentPath = parts.join("/");
                const parent = resolveFS(parentPath);
                if (!parent || parent.type === "file") return print("Invalid parent path");
                if (parent[name]) return print("Already exists");
                parent[name] = { type: "file", content: "" };
                createdFiles.push(fullPath);
                print(`File created: ${name}`);
                window.dispatchEvent(new Event("fs-updated"));
            }
        },

        edit: {
            desc: "Edit text file (:wq to save, :e <line> <text> to edit)",
            async run(args) {
                const file = args[0];
                if (!file) return print("Usage: edit <file>");

                let node = getNodeByPath(file);

                // --- ファイルが存在しない場合の作成処理を修正 ---
                if (!node) {
                    print("File not found, creating...");
                    const fullPath = normalizePath(file, cwd); // 絶対パスを取得 (例: C:/Desktop/Programs/Documents/b.txt)

                    // C:/ を除いたパスを分割
                    const pathWithoutDrive = fullPath.replace(/^C:\//, "");
                    const parts = pathWithoutDrive.split("/");
                    const fileName = parts.pop();      // "b.txt"
                    const parentPath = parts.join("/"); // "Desktop/Programs/Documents"

                    // resolveFS を使って親ディレクトリを確実に取得
                    const parent = resolveFS(parentPath);

                    if (!parent || parent.type === "file") {
                        return print(`Error: Directory 'C:/${parentPath}' not found.`, "#f00");
                    }

                    // ファイル作成
                    parent[fileName] = { type: "file", content: "" };
                    node = parent[fileName];
                    createdFiles.push(fullPath);

                    // 作成した瞬間にエクスプローラーに反映させる
                    window.dispatchEvent(new Event("fs-updated"));
                }
                // ----------------------------------------------

                if (node.type !== "file") return print("Not a file");

                print("---- Editor (type :wq to save, :e <line> <text> to edit) ----");
                editorActive = true;
                editorNode = node;
                editorBuffer = node.content ? node.content.split("\n") : [];
                editorBuffer.forEach(line => print(line));
                input.value = "";

                await new Promise(resolve => {
                    editorResolve = resolve;

                    const handler = e => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        e.stopImmediatePropagation();

                        const line = input.value;
                        input.value = "";

                        // 保存
                        if (line === ":wq") {
                            input.removeEventListener("keydown", handler, true);
                            editorNode.content = editorBuffer.join("\n");
                            editorActive = false;
                            editorBuffer = [];
                            editorNode = null;
                            editorResolve?.();
                            editorResolve = null;
                            print("Saved.");

                            // 保存時にも通知（内容更新のため）
                            window.dispatchEvent(new Event("fs-updated"));
                            return;
                        }

                        // 行訂正
                        const editMatch = line.match(/^:e\s+(\d+)\s+(.+)$/);
                        if (editMatch) {
                            const num = Number(editMatch[1]) - 1;
                            const newText = editMatch[2];
                            if (num < 0 || num >= editorBuffer.length) return print("Invalid line number");
                            editorBuffer[num] = newText;
                            print(`Line ${num + 1} updated: ${newText}`);
                            return;
                        }

                        // 通常追記
                        editorBuffer.push(line);
                        print(line);
                    };

                    input.addEventListener("keydown", handler, true);
                });
            }
        },

        run: {
            desc: "Run script file",
            async run(args) {
                const file = args[0];
                if (!file) return print("Usage: run <file>");
                const node = getNodeByPath(file);
                if (!node || node.type !== "file") return print("Script not found");

                const lines = node.content.split("\n").map(l => l.trim()).filter(Boolean);

                // 変数コンテキスト
                const context = {};

                for (const line of lines) {
                    // print / sleep / cls は従来通り
                    const match = line.match(/^(\w+)\s*(.*)$/);
                    if (match) {
                        const cmd = match[1];
                        const rest = match[2];

                        const args = [];
                        let color = null, bg = null, size = null;

                        rest.split(/\s+/).forEach(token => {
                            const cMatch = token.match(/^color=(.+)$/i);
                            const bgMatch = token.match(/^bg=(.+)$/i);
                            const sizeMatch = token.match(/^size=(.+)$/i);
                            if (cMatch) color = cMatch[1];
                            else if (bgMatch) bg = bgMatch[1];
                            else if (sizeMatch) size = sizeMatch[1];
                            else args.push(token.replace(/^"|"$/g, ""));
                        });

                        switch (cmd) {
                            case "print":
                                print(args.join(" "), color, bg, size);
                                continue;
                            case "sleep":
                                await new Promise(r => setTimeout(r, Number(args[0]) || 300));
                                continue;
                            case "cls":
                                screen.innerHTML = "";
                                continue;
                        }
                    }

                    // 上記に該当しなければ JS 式として評価
                    try {
                        // トークン分割
                        const tokens = line.split(/\s+/);
                        let jsTokens = [];
                        let color = null, bg = null, size = null;

                        tokens.forEach(token => {
                            const cMatch = token.match(/^color=(.+)$/i);
                            const bgMatch = token.match(/^bg=(.+)$/i);
                            const sizeMatch = token.match(/^size=(.+)$/i);
                            if (cMatch) color = cMatch[1];
                            else if (bgMatch) bg = bgMatch[1];
                            else if (sizeMatch) size = sizeMatch[1];
                            else jsTokens.push(token);
                        });

                        const jsLine = jsTokens.join(" ");

                        // context 内で eval
                        const keys = Object.keys(context);
                        const values = Object.values(context);
                        const func = new Function(...keys, `return ${jsLine}`);
                        const result = func(...values);

                        // 代入式なら context に保存
                        if (jsLine.includes("=")) {
                            const [key, expr] = jsLine.split("=").map(s => s.trim());
                            context[key] = result;
                        }

                        // 結果を print
                        print(result !== undefined ? result.toString() : "", color, bg, size);

                    } catch (err) {
                        print(`Error: ${err.message}`, "#f00");
                    }
                }
            }
        },

        truncate: {
            desc: "Clear file content",
            run(args) {
                if (!args[0]) return print("Usage: truncate <file>");
                const node = getNodeByPath(args[0]);
                if (!node) return print("File not found");
                if (node.type !== "file") return print("Not a file");
                node.content = "";
                print(`File ${args[0]} cleared.`);
                window.dispatchEvent(new Event("fs-updated"));
            }
        },

        newfiles: {
            desc: "Show files created in this session",
            run() {
                if (!createdFiles.length) return print("No files created in this session.");
                createdFiles.forEach(f => print(f));
            }
        },

        deletefile: {
            desc: "Delete a file created in this session",
            run(args) {
                if (!args[0]) return print("Usage: deletefile <file>");
                const fullPath = normalizePath(args[0], cwd);
                const idx = createdFiles.indexOf(fullPath);
                if (idx === -1) return print("File not found or not created in this session.");
                const pathWithoutDrive = fullPath.replace(/^C:\//, "");
                const parts = pathWithoutDrive.split("/");
                const name = parts.pop();
                const parentPath = parts.join("/");
                const parent = resolveFS(parentPath);
                if (!parent || !parent[name]) return print("File not found in FS.");
                delete parent[name];
                createdFiles.splice(idx, 1);
                print(`Deleted file: ${fullPath}`);
                window.dispatchEvent(new Event("fs-updated"));
            }
        }

    };

    /* =========================
       Command Executor
    ========================= */

    async function exec(cmdLine) {
        if (!cmdLine) return;
        const tokens = cmdLine.match(/"[^"]+"|\S+/g) || [];
        const name = (tokens.shift() || "").toLowerCase();
        const args = tokens.map(t => t.replace(/^"|"$/g, ""));
        const cmd = commands[name];
        if (!cmd) return print(`Command not found: ${name}`);
        try { await cmd.run(args); } catch (err) { print(`Error: ${err.message}`); }
    }

    /* =========================
       Input Handling
    ========================= */

    input.addEventListener("keydown", async e => {
        if (editorActive) {
            if (["Tab", "ArrowUp", "ArrowDown"].includes(e.key)) {
                e.preventDefault(); e.stopImmediatePropagation();
            }
            return;
        }

        if (e.key === "Enter") {
            const cmd = input.value.trim();
            if (!cmd) return;
            history.push(cmd);
            hIndex = history.length;
            print(cwd + "> " + cmd);
            await exec(cmd);
            input.value = "";
            scrollToBottom();
        }

        if (e.key === "ArrowUp") { hIndex = Math.max(0, hIndex - 1); input.value = history[hIndex] || ""; }
        if (e.key === "ArrowDown") { hIndex = Math.min(history.length, hIndex + 1); input.value = history[hIndex] || ""; }

        if (e.key === "Tab") {
            e.preventDefault();
            const value = input.value.trim().toLowerCase();
            if (!value) return;
            const hits = Object.keys(commands).filter(c => c.startsWith(value));
            if (hits.length === 1) input.value = hits[0] + " ";
            else if (hits.length > 1) {
                const prefix = commonPrefix(hits);
                if (prefix.length > value.length) input.value = prefix;
            }
        }
    });

    input.focus();
    content.addEventListener("click", e => { if (e.target.tagName !== "INPUT") input.focus(); });

}