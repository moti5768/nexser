// Terminal.js
import { launch, logOff, resetUI } from "../kernel.js";
import {
    getWindows,
    closeWindowById,
    focusWindowById,
    minimizeWindowById,
    maximizeWindowById,
    createWindow
} from "../window.js";
import { resolveFS, normalizePath } from "../fs-utils.js";

export default function TerminalApp(content) {
    content.classList.add("terminal-window");
    /* =========================
       UI Setup
    ========================= */

    content.style.background = "black";
    content.style.color = "#0f0";
    content.style.fontFamily = "Consolas, monospace";
    content.style.fontSize = "14px";

    // terminal.js の修正部分
    content.innerHTML = `
    <div class="terminal-screen">
        <div class="terminal-input">
            <span class="prompt">C:/></span>
            <input type="text" autocomplete="off" />
        </div>
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

    let isScrolling = false;
    function scrollToBottom() {
        if (!isScrolling) {
            isScrolling = true;
            requestAnimationFrame(() => {
                screen.scrollTop = screen.scrollHeight;
                isScrolling = false;
            });
        }
    }

    // terminal.js の print 関数内を修正（描画した行DOMを返却＆スタイル追加）
    function print(text = "", color = null, bg = null, size = null, opts = {}) {
        const line = document.createElement("div");
        line.textContent = text;
        line.style.whiteSpace = "pre-wrap"; // 空白や連続スペースを保持
        if (color) line.style.color = color;
        if (bg) line.style.backgroundColor = bg;
        if (size) line.style.fontSize = size;

        // 追加の文字プロパティ設定
        if (opts.bold || opts.weight) line.style.fontWeight = opts.bold ? "bold" : opts.weight;
        if (opts.italic || opts.style) line.style.fontStyle = opts.italic ? "italic" : opts.style;
        if (opts.shadow || opts.glow) line.style.textShadow = (opts.shadow || opts.glow).replace(/_/g, " ");

        // input の「前」に挿入することで、入力欄が常に一番下になる
        screen.insertBefore(line, input.parentElement);

        while (screen.children.length > MAX_LINES + 1) { // 入力欄分を考慮
            screen.removeChild(screen.firstChild);
        }
        scrollToBottom();

        // 後から1行を書き換えるためにDOM要素を返す
        return line;
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

        cls: {
            desc: "Clear screen",
            run() {
                // 1. 入力欄の親要素を退避
                const inputContainer = input.parentElement;

                // 2. 画面を一度空にする
                screen.innerHTML = "";

                // 3. 入力欄を再挿入
                screen.appendChild(inputContainer);

                // 4. 入力欄にフォーカスを戻す（便利！）
                input.focus();
            }
        },

        logoff: { desc: "Log off OS", async run() { await logOff(); input.blur(); } },

        pwd: { desc: "Show current directory", run() { print(cwd); } },
        exit: {
            desc: "Close terminal",
            run() {
                const wins = getWindows();

                // 1. content の参照一致、または DOM の包含関係で自分を探す
                const myWin = wins.find(w =>
                    w.content === content ||
                    w.content?.contains(content)
                );

                if (myWin) {
                    closeWindowById(myWin.id);
                } else {
                    // 2. 万が一見つからない場合は、タイトルが "Terminal" のものを探す（予備策）
                    const terminalWin = wins.find(w => w.title?.includes("Terminal"));
                    if (terminalWin) {
                        closeWindowById(terminalWin.id);
                    } else {
                        print("Error: Could not find terminal window instance.", "#f00");
                    }
                }
            }
        },



        pc: {
            desc: "Display PC animation with typing text and auto-run",
            async run(args) {
                // 1. 引数の前処理
                const hasRun = args ? args.includes("run") : false;
                let displayArgs = args ? args.filter(a => a !== "run") : [];
                let targetText = displayArgs.join(" ");

                // 文字列を25文字に制限
                if (targetText.length > 25) {
                    targetText = targetText.substring(0, 25);
                }

                const frames = ["\\_", " /_", "  <", " /_"];
                const duration = 5000;
                const interval = 150;
                const maxSpaces = 20;

                const line = document.createElement("div");
                line.style.color = "#0f0";
                line.style.fontWeight = "bold";
                line.style.fontFamily = "Consolas, Monaco, 'Courier New', monospace";
                line.style.whiteSpace = "pre";

                // input の前に挿入
                screen.insertBefore(line, input.parentElement);

                const startTime = Date.now();

                // 2. 移動アニメーション
                await new Promise((resolve) => {
                    const timer = setInterval(() => {
                        const elapsed = Date.now() - startTime;

                        if (elapsed > duration) {
                            clearInterval(timer);
                            resolve();
                            return;
                        }

                        const progress = elapsed / duration;
                        const spaceCount = Math.floor(progress * maxSpaces);
                        const padding = " ".repeat(spaceCount);
                        const frameIndex = Math.floor(elapsed / interval) % frames.length;

                        line.textContent = padding + frames[frameIndex];
                        screen.scrollTop = screen.scrollHeight;
                    }, interval);
                });

                // 3. タイピングアニメーション（位置固定版）
                const finalPadding = " ".repeat(maxSpaces);
                const fixedSpacing = " "; // PC本体と文字の間のスペースを常に1つ入れる

                for (let i = 0; i <= targetText.length; i++) {
                    const currentText = targetText.substring(0, i);

                    // fixedSpacing を使うことで、0文字目からPCの位置が固定される
                    line.textContent = finalPadding + "\\_" + fixedSpacing + currentText;

                    await new Promise(r => setTimeout(r, 250));
                    screen.scrollTop = screen.scrollHeight;
                }

                // 4. "run" 引数があった場合にコマンド実行
                if (hasRun && targetText.trim()) {
                    await new Promise(r => setTimeout(r, 500));
                    await exec(targetText.trim());
                }
            }
        },





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

                // 1. パスの正規化
                let newPath = normalizePath(args[0], cwd);

                // 2. ルートディレクトリ (C:/) かどうかの判定
                const isRoot = (newPath === "C:/" || newPath === "C:");

                // 3. ファイルシステム上のノードを取得
                // ルートの場合は空文字を渡し、それ以外は C:/ を除いた相対パスを渡す
                const fsSearchPath = isRoot ? "" : newPath.replace(/^C:\//, "");
                const node = resolveFS(fsSearchPath);

                if (!node || node.type === "file") return print("Not a directory");

                // 4. cwd の更新 (ルート以外は末尾のスラッシュを除く)
                if (isRoot) {
                    cwd = "C:/";
                } else {
                    cwd = newPath.replace(/\/$/, "");
                }

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
            desc: "Show directory tree (Usage: tree [path] [/d: folders only])",
            run(args) {
                // /d または -d オプションが含まれているかを判定し、パスの引数から除外する
                const hasDirFlag = args.includes('/d') || args.includes('-d');
                const cleanArgs = args.filter(arg => arg !== '/d' && arg !== '-d');

                const targetPath = normalizePath(cleanArgs[0] || ".", cwd);
                const fsSearchPath = targetPath === "C:/" ? "" : targetPath.replace(/^C:\//, "");
                const root = resolveFS(fsSearchPath);

                if (!root) return print("Path not found");
                if (root.type === 'file') return print(cleanArgs[0]);

                function walk(n, indent = "") {
                    // 除外すべきシステムプロパティ
                    const skipKeys = new Set(['type', 'entry', 'singleton', 'target', 'content', 'system', 'name', 'originalPath', 'hidden', 'lastModified']);

                    Object.entries(n).forEach(([name, val]) => {
                        if (skipKeys.has(name)) return;

                        // フォルダであるかの判定（type が 'folder' または明示的なタイプがないオブジェクト）
                        const isFolder = typeof val === 'object' && val && (val.type === 'folder' || !val.type);

                        // フォルダのみ表示フラグが有効な場合で、かつフォルダでない場合はスキップ
                        if (hasDirFlag && !isFolder) return;

                        print(indent + "├─ " + name);

                        // 子要素がフォルダの場合のみ再帰的に走査
                        if (isFolder) {
                            walk(val, indent + "│  ");
                        }
                    });
                }

                print(targetPath);
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
                        launch("Programs/Applications/Explorer.app", { path, parentCwd: cwd });
                        break;

                    default:
                        print(`Cannot open: unknown type ${node.type}`);
                }
            }
        },

        window: {
            desc: "Manage windows (create, list, close, focus, min, max)",
            async run(args) {
                const sub = (args[0] || "list").toLowerCase();
                const subArgs = args.slice(1);

                // ★ 入力されたID（"1" や "win_1"）を柔軟にマッチさせるヘルパー
                const getTargetWin = (arg) => {
                    if (!arg) return null;
                    const wins = getWindows();
                    return wins.find(w => w.id === arg || w.id === `win_${arg}` || w.id.replace("win_", "") === arg);
                };

                switch (sub) {
                    case "create":
                    case "new": {
                        const title = subArgs.join(" ") || "New Window";
                        const contentEl = createWindow(title, {
                            width: "450px",
                            height: "280px"
                        });
                        contentEl.innerHTML = `
                            <div style="padding: 20px; color: #000; font-family: sans-serif;">
                                <h3>${title}</h3>
                                <p>Terminalから作成されたウィンドウです。</p>
                            </div>
                        `;
                        print(`Window created: ${title}`);
                        break;
                    }
                    case "list":
                    case "ls": {
                        const wins = getWindows();
                        if (!wins.length) return print("No windows");
                        wins.forEach(w => print(`${w.id.toString().padEnd(6)} : ${w.title} (${w.minimized ? "minimized" : "active"})`));
                        break;
                    }
                    case "close":
                    case "kill": {
                        const targetWin = getTargetWin(subArgs[0]);
                        if (!targetWin) return print("Usage: window close <id>");

                        const closeBtn = targetWin.el.querySelector(".close-btn");
                        if (closeBtn && closeBtn.classList.contains("pointer_none")) {
                            return print(`Error: Window ${targetWin.id} (${targetWin.title}) is protected.`, "#f00");
                        }

                        try {
                            closeWindowById(targetWin.id);
                            print(`Window ${targetWin.id} closed`);
                        } catch (e) {
                            print(`Failed to close window: ${e.message}`, "#f00");
                        }
                        break;
                    }
                    case "focus": {
                        const targetWin = getTargetWin(subArgs[0]);
                        if (!targetWin) return print("Usage: window focus <id>");

                        if (focusWindowById(targetWin.id)) {
                            print(`Focused window ${targetWin.id}`);
                        } else {
                            print("Failed to focus window", "#f00");
                        }
                        break;
                    }
                    case "min":
                    case "minimize": {
                        const targetWin = getTargetWin(subArgs[0]);
                        if (!targetWin) return print("Usage: window minimize <id>");

                        const minBtn = targetWin.el.querySelector(".min-btn");
                        if (minBtn && minBtn.classList.contains("pointer_none")) {
                            return print(`Error: Window ${targetWin.id} is protected.`, "#f00");
                        }

                        await minimizeWindowById(targetWin.id);
                        print(`Minimized window ${targetWin.id}`);
                        break;
                    }
                    case "max":
                    case "maximize": {
                        const targetWin = getTargetWin(subArgs[0]);
                        if (!targetWin) return print("Usage: window maximize <id>");

                        const maxBtn = targetWin.el.querySelector(".max-btn");
                        if (maxBtn && maxBtn.classList.contains("pointer_none")) {
                            return print(`Error: Window ${targetWin.id} is protected.`, "#f00");
                        }

                        await maximizeWindowById(targetWin.id);
                        print(`Maximized window ${targetWin.id}`);
                        break;
                    }
                    default:
                        print("Usage: window [create|list|close|focus|min|max] [id/title]");
                }
            }
        },

        resetui: {
            desc: "Reset all windows and UI",
            run() {
                const wins = getWindows();
                let protectedCount = 0;

                // 開いている全ウィンドウを個別にチェック
                wins.forEach(w => {
                    const closeBtn = w.el.querySelector(".close-btn");
                    if (closeBtn && closeBtn.classList.contains("pointer_none")) {
                        // 保護されているウィンドウはカウントだけしてスキップ
                        protectedCount++;
                    } else {
                        // 保護されていないウィンドウは個別に閉じる
                        try {
                            closeWindowById(w.id);
                        } catch (e) {
                            // エラーは無視して続行
                        }
                    }
                });

                if (protectedCount > 0) {
                    // 強制全リセット関数(resetUI)は呼ばず、結果だけを出力
                    print(`UI partial reset: ${wins.length - protectedCount} windows closed, ${protectedCount} protected windows kept.`, "#ff0");
                } else {
                    // 保護されたウィンドウが1つもない場合は、本来の完全リセット処理を実行
                    resetUI();
                    print("UI has been reset.");
                }
            }
        },

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
            desc: "Run script (start with #!js for pure JavaScript API mode)",
            async run(args) {
                const file = args[0];
                if (!file) return print("Usage: run <file>");
                const node = getNodeByPath(file);
                if (!node || node.type !== "file") return print("Script not found");

                const rawContent = node.content.trim();

                // ==========================================
                // 究極拡張: 純粋な JS モード (ファイルの1行目が #!js の場合)
                // ==========================================
                if (rawContent.startsWith("#!js")) {
                    const jsCode = rawContent.replace(/^#!js\n?/, "");

                    // リアルタイムのキー入力を監視するリスナー
                    const activeKeys = {};
                    const keyHandler = (e) => {
                        // 矢印キー等のデフォルトスクロールを防ぐ
                        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
                            e.preventDefault();
                            e.stopPropagation();
                        }
                        activeKeys[e.key.toLowerCase()] = e.type === "keydown";
                    };
                    window.addEventListener("keydown", keyHandler, { passive: false });
                    window.addEventListener("keyup", keyHandler);

                    // ユーザーの自作スクリプトに提供するターミナル専用API
                    const api = {
                        print: (text, color, bg, size, opts) => print(text, color, bg, size, opts || {}),
                        sleep: (ms) => new Promise(r => setTimeout(r, ms)),
                        clear: () => {
                            const inputContainer = input.parentElement;
                            screen.innerHTML = "";
                            screen.appendChild(inputContainer);
                        },
                        createBlock: (rowCount, opts = {}) => {
                            const rows = [];
                            for (let i = 0; i < rowCount; i++) {
                                rows.push(print("", opts.color, opts.bg, opts.size, opts));
                            }
                            return rows;
                        },
                        isKeyDown: (key) => !!activeKeys[key.toLowerCase()],
                        args: args.slice(1)
                    };

                    try {
                        input.blur(); // 入力カーソルを一時的に外す

                        // 文字列から非同期関数を動的生成して実行
                        const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
                        const func = new AsyncFunction(...Object.keys(api), jsCode);
                        await func(...Object.values(api));

                    } catch (err) {
                        print(`JS Error: ${err.message}`, "#f00");
                    } finally {
                        // 実行終了後にキー監視を解除し、入力を復元
                        window.removeEventListener("keydown", keyHandler);
                        window.removeEventListener("keyup", keyHandler);
                        input.focus();
                    }
                    return; // JSモード終了
                }

                // ==========================================
                // 従来の行ベース簡易スクリプトモード (元コード準拠)
                // ==========================================
                const lines = rawContent.split("\n").map(l => l.trim()).filter(Boolean);

                // 変数コンテキスト
                const context = {};

                for (const line of lines) {
                    const match = line.match(/^(\w+)\s*(.*)$/);
                    if (match) {
                        const cmd = match[1];
                        const rest = match[2];

                        const args = [];
                        let color = null, bg = null, size = null;
                        const opts = {};

                        rest.split(/\s+/).forEach(token => {
                            const cMatch = token.match(/^color=(.+)$/i);
                            const bgMatch = token.match(/^bg=(.+)$/i);
                            const sizeMatch = token.match(/^size=(.+)$/i);
                            const wMatch = token.match(/^weight=(.+)$/i);
                            const shMatch = token.match(/^(?:shadow|glow)=(.+)$/i);

                            if (cMatch) color = cMatch[1];
                            else if (bgMatch) bg = bgMatch[1];
                            else if (sizeMatch) size = sizeMatch[1];
                            else if (wMatch) opts.weight = wMatch[1];
                            else if (shMatch) opts.shadow = shMatch[1];
                            else if (token.toLowerCase() === "bold") opts.bold = true;
                            else if (token.toLowerCase() === "italic") opts.italic = true;
                            else args.push(token.replace(/^"|"$/g, ""));
                        });

                        // 昔のパソコン風 1行テキスト書き換えアニメーションコマンド群
                        if (cmd === "print") {
                            print(args.join(" "), color, bg, size, opts);
                            continue;
                        } else if (cmd === "sleep") {
                            await new Promise(r => setTimeout(r, Number(args[0]) || 300));
                            continue;
                        } else if (cmd === "cls") {
                            const inputContainer = input.parentElement;
                            screen.innerHTML = "";
                            screen.appendChild(inputContainer);
                            continue;
                        } else if (cmd === "type") {
                            const text = args.join(" ");
                            const lineEl = print("", color, bg, size, opts);
                            const delay = Number(opts.speed) || 40;
                            for (let i = 0; i <= text.length; i++) {
                                lineEl.textContent = text.substring(0, i);
                                scrollToBottom();
                                await new Promise(r => setTimeout(r, delay));
                            }
                            continue;
                        } else if (cmd === "spinner") {
                            const duration = Number(args[0]) || 2000;
                            const text = args.slice(1).join(" ");
                            const frames = ["|", "/", "-", "\\"];
                            const lineEl = print("", color, bg, size, opts);
                            const startTime = Date.now();
                            let idx = 0;
                            while (Date.now() - startTime < duration) {
                                lineEl.textContent = `${frames[idx % frames.length]} ${text}`;
                                idx++;
                                scrollToBottom();
                                await new Promise(r => setTimeout(r, 100));
                            }
                            lineEl.textContent = `[OK] ${text}`;
                            continue;
                        } else if (cmd === "progress") {
                            const duration = Number(args[0]) || 3000;
                            const text = args.slice(1).join(" ");
                            const lineEl = print("", color, bg, size, opts);
                            const totalBlocks = 20;
                            const startTime = Date.now();
                            while (true) {
                                const elapsed = Date.now() - startTime;
                                const progress = Math.min(1, elapsed / duration);
                                const filled = Math.floor(progress * totalBlocks);
                                const bar = "=".repeat(filled) + (filled < totalBlocks ? ">" : "") + " ".repeat(Math.max(0, totalBlocks - filled - 1));
                                const percent = Math.floor(progress * 100);
                                lineEl.textContent = `[${bar}] ${percent}% ${text}`;
                                scrollToBottom();
                                if (progress >= 1) break;
                                await new Promise(r => setTimeout(r, 80));
                            }
                            continue;
                        } else if (cmd === "anim") {
                            const rawFrames = args[0] ? args[0].split(",") : ["-", "\\", "|", "/"];
                            const duration = Number(args[1]) || 2000;
                            const text = args.slice(2).join(" ");
                            const lineEl = print("", color, bg, size, opts);
                            const startTime = Date.now();
                            let idx = 0;
                            while (Date.now() - startTime < duration) {
                                lineEl.textContent = `${rawFrames[idx % rawFrames.length]} ${text}`;
                                idx++;
                                scrollToBottom();
                                await new Promise(r => setTimeout(r, 150));
                            }
                            continue;
                        }
                    }

                    // 上記に該当しなければ JS 式として評価
                    try {
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
                        const keys = Object.keys(context);
                        const values = Object.values(context);
                        const func = new Function(...keys, `return ${jsLine}`);
                        const result = func(...values);

                        if (jsLine.includes("=")) {
                            const [key, expr] = jsLine.split("=").map(s => s.trim());
                            context[key] = result;
                        }

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
        },

        game: {
            desc: "Start a retro ASCII dodge game",
            async run() {
                print("=== ASCII DODGER ===", "#0f0", null, "16px", { bold: true });
                print("Controls: Left/Right Arrow Keys (or A/D) to Move. Press Q to Quit.", "#888");

                const width = 20;
                const height = 10;
                let playerX = Math.floor(width / 2);
                let obstacles = [];
                let score = 0;
                let gameOver = false;

                const displayLine = print("", "#0f0", "black", "14px", { bold: true });
                input.blur();

                const keyHandler = (e) => {
                    const k = e.key.toLowerCase();
                    if (e.key === "ArrowLeft" || k === "a") { if (playerX > 0) playerX--; e.preventDefault(); e.stopPropagation(); }
                    if (e.key === "ArrowRight" || k === "d") { if (playerX < width - 1) playerX++; e.preventDefault(); e.stopPropagation(); }
                    if (k === "q" || e.key === "Escape") { gameOver = true; e.stopPropagation(); }
                };

                window.addEventListener("keydown", keyHandler);

                while (!gameOver) {
                    // 障害物の生成と落下
                    if (Math.random() < 0.4) {
                        obstacles.push({ x: Math.floor(Math.random() * width), y: 0 });
                    }

                    // 位置更新
                    for (let obs of obstacles) {
                        obs.y++;
                    }

                    // 衝突判定
                    if (obstacles.some(o => o.x === playerX && o.y === height - 1)) {
                        gameOver = true;
                        break;
                    }

                    // 画面外の障害物を削除
                    obstacles = obstacles.filter(o => o.y < height);
                    score++;

                    // 画面描画（文字列を作成して一括で書き換え）
                    let screenText = `SCORE: ${score}\n+${"-".repeat(width)}+\n`;
                    for (let y = 0; y < height; y++) {
                        screenText += "|";
                        for (let x = 0; x < width; x++) {
                            if (y === height - 1 && x === playerX) {
                                screenText += "A"; // 自機
                            } else if (obstacles.some(o => o.x === x && o.y === y)) {
                                screenText += "*"; // 障害物
                            } else {
                                screenText += " ";
                            }
                        }
                        screenText += "|\n";
                    }
                    screenText += `+${"-".repeat(width)}+`;

                    displayLine.textContent = screenText;
                    scrollToBottom();

                    await new Promise(r => setTimeout(r, 100)); // 描画速度
                }

                window.removeEventListener("keydown", keyHandler);
                print(`\nGAME OVER! Final Score: ${score}`, "#f00", null, "16px", { bold: true });
                input.focus();
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

    input.addEventListener("paste", async (e) => {
        if (editorActive) return;

        const pasteData = e.clipboardData.getData("text");
        // 改行が含まれている場合のみ処理
        if (pasteData && (pasteData.includes("\n") || pasteData.includes("\r"))) {
            e.preventDefault(); // デフォルトの貼り付け動作を阻止

            // 改行で分割し、空行や前後の空白を整理
            const lines = pasteData.split(/\r?\n/);
            input.value = ""; // 入力欄をクリア

            for (const rawLine of lines) {
                const cmd = rawLine.trim();
                if (!cmd) continue; // 空行はスキップ

                history.push(cmd);
                hIndex = history.length;
                print(cwd + "> " + cmd);
                await exec(cmd); // 1行ずつ実行を待機
                scrollToBottom();
            }
        }
    });

    input.addEventListener("keydown", async e => {
        if (editorActive) {
            if (["Tab", "ArrowUp", "ArrowDown"].includes(e.key)) {
                e.preventDefault(); e.stopImmediatePropagation();
            }
            return;
        }

        if (e.key === "Enter") {
            const cmd = input.value.trim();
            history.push(cmd);
            hIndex = history.length;
            print(cwd + "> " + cmd);
            await exec(cmd);
            input.value = "";
            scrollToBottom();
        }

        if (e.key === "ArrowUp") {
            hIndex = Math.max(0, hIndex - 1);
            input.value = history[hIndex] || "";
        }
        if (e.key === "ArrowDown") {
            hIndex = Math.min(history.length, hIndex + 1);
            input.value = history[hIndex] || "";
        }

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