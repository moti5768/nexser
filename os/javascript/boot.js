// boot.js
import { initFS } from './fs.js';
import { buildDesktop } from './desktop.js';
import { showBSOD } from './bsod.js';
import { playSystemEventSound } from './kernel.js';
import { resolveFS, normalizePath as fsNormalizePath } from './fs-utils.js';
import { loadSetting } from "./apps/settings.js";

// ===== Global Error Handlers =====
const CRITICAL_PREFIXES = ["BOOT_", "KERNEL_", "FS_", "0x"]; // 深刻とみなすエラーコード
function isCriticalError(msg) {
    // 深刻なエラーコードが含まれているか、または特定のスタックトレースを持つ場合のみTrue
    return CRITICAL_PREFIXES.some(prefix => String(msg).includes(prefix));
}
window.addEventListener("unhandledrejection", (e) => {
    const error = e.reason;
    const msg = error?.message || String(error);
    // 非同期エラーは予期せぬ場所で起きやすいため、原則BSODで保護
    showBSOD(`UNHANDLED_REJECTION: ${msg}`, error);
});
window.addEventListener("error", (e) => {
    const msg = e.error ? e.error.message : e.message;
    if (isCriticalError(msg)) {
        showBSOD(msg, e.error);
    } else {
        // 軽微なエラーはコンソールログのみ、またはアプリ内ウィンドウにエラー表示
        console.warn("[System Notice] Non-critical error:", msg);
        // ここで必要なら「警告ウィンドウ」を表示するUI関数を呼ぶ
    }
});

// ===== Passive Event / Touch Defaults =====
document.addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

let lastTouchEnd = 0;
document.addEventListener("touchend", e => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
}, { passive: false });

// ===== Screen / CLI State =====
const screen = document.getElementById('screen');
let cwd = 'C:/';
let history = [];
let hIndex = 0;

// ===== Utility Functions =====
function scrollToBottom() { requestAnimationFrame(() => screen.scrollTop = screen.scrollHeight); }
export function print(text = '') { screen.textContent += text + '\n'; scrollToBottom(); }
function commonPrefix(arr) { if (!arr.length) return ''; let prefix = arr[0]; for (let i = 1; i < arr.length; i++) { while (!arr[i].startsWith(prefix)) { prefix = prefix.slice(0, -1); if (!prefix) return ''; } } return prefix; }

// ===== Virtual File System Helpers (Integrated with fs-utils) =====
function normalizePath(path) {
    return fsNormalizePath(path, cwd);
}

function getNodeByPath(path) {
    // terminal.js と統一し、resolveFS には 'C:/' を除外した相対パスを渡す
    const fullPath = normalizePath(path);
    return resolveFS(fullPath.replace(/^C:\//, ""));
}

// ===== Commands =====
const commands = {
    help: { desc: 'Show available commands', run() { Object.entries(commands).forEach(([n, c]) => print(`${n.padEnd(12)} - ${c.desc}`)); } },
    cls: { desc: 'Clear screen', run() { screen.textContent = ''; } },
    boot: { desc: 'Boot OS', async run() { await bootOS(); } },
    version: { desc: 'Show version', run() { print('NEXSER CLI v1.0.0 (Stable)'); } },
    time: { desc: 'Show time', run() { print(new Date().toLocaleString()); } },
    whoami: { desc: 'Current user', run() { print('user'); } },
    mem: { desc: 'System memory info', run() { print(`Approx. Memory: ${navigator.deviceMemory || 'unknown'} GB`); print(`Logical Cores: ${navigator.hardwareConcurrency || 'unknown'}`); } },
    pwd: { desc: 'Show current directory', run() { print(cwd); } },

    ls: {
        desc: 'List directory contents',
        run(args) {
            const targetPath = normalizePath(args[0] || ".");
            const fsSearchPath = targetPath === "C:/" ? "" : targetPath.replace(/^C:\//, "");
            const node = resolveFS(fsSearchPath);
            if (!node) return print('Path not found');
            if (node.type === 'file') return print(args[0]);
            Object.keys(node)
                .filter(k => !['type', 'entry', 'singleton', 'target'].includes(k))
                .forEach(name => print(name));
        }
    },

    cd: {
        desc: 'Change directory',
        run(args) {
            if (!args[0]) return;
            const targetPath = normalizePath(args[0]);
            const fsSearchPath = targetPath === "C:/" ? "" : targetPath.replace(/^C:\//, "");
            const node = resolveFS(fsSearchPath);
            if (!node || node.type === 'file') return print('Not a directory');
            cwd = targetPath === 'C:/' ? 'C:/' : targetPath.replace(/\/$/, '');
        }
    },

    cat: {
        desc: 'Show file content',
        run(args) {
            if (!args[0]) return print('Usage: cat <file>');
            const targetPath = normalizePath(args[0]);
            const fsSearchPath = targetPath.replace(/^C:\//, "");
            const node = resolveFS(fsSearchPath);
            if (!node) return print('File not found');
            if (node.type !== 'file') return print('Not a file');
            print(node.content || "");
        }
    },

    touch: {
        desc: 'Create an empty file',
        run(args) {
            if (!args[0]) return print("Usage: touch <file>");
            const fullPath = normalizePath(args[0]);
            const parts = fullPath.replace(/^C:\//, "").split("/");
            const name = parts.pop();
            const parentPath = parts.join("/");
            const parent = resolveFS(parentPath);
            if (!parent || parent.type === "file") return print("Invalid parent path");
            if (parent[name]) return print("Already exists");
            parent[name] = { type: "file", content: "" };
            print(`File created: ${name}`);
            window.dispatchEvent(new Event("fs-updated"));
        }
    },

    mkdir: {
        desc: 'Create a new directory',
        run(args) {
            if (!args[0]) return print("Usage: mkdir <folder>");
            const fullPath = normalizePath(args[0]);
            const parts = fullPath.replace(/^C:\//, "").split("/");
            const name = parts.pop();
            const parentPath = parts.join("/");
            const parent = resolveFS(parentPath);
            if (!parent || parent.type === "file") return print("Invalid parent path");
            if (parent[name]) return print("Already exists");
            parent[name] = { type: "folder" };
            print(`Directory created: ${name}`);
            window.dispatchEvent(new Event("fs-updated"));
        }
    },

    rm: {
        desc: 'Remove a file or directory',
        run(args) {
            if (!args[0]) return print("Usage: rm <path>");
            const fullPath = normalizePath(args[0]);
            const parts = fullPath.replace(/^C:\//, "").split("/");
            const name = parts.pop();
            const parentPath = parts.join("/");
            const parent = resolveFS(parentPath);
            if (!parent || !parent[name]) return print("File or directory not found");
            delete parent[name];
            print(`Removed: ${name}`);
            window.dispatchEvent(new Event("fs-updated"));
        }
    },

    tree: {
        desc: 'Show directory tree',
        run(args) {
            const targetPath = normalizePath(args[0] || ".");
            const fsSearchPath = targetPath === "C:/" ? "" : targetPath.replace(/^C:\//, "");
            const root = resolveFS(fsSearchPath);
            if (!root) return print('Path not found');
            function walk(n, depth = 0, ind = '') {
                Object.entries(n).forEach(([name, val]) => {
                    if (['type', 'entry', 'singleton', 'target', 'content', 'system', 'name'].includes(name)) return;
                    print(ind + '├─ ' + name);
                    if (typeof val === 'object' && val.type !== 'file' && val.type !== 'link') walk(val, depth + 1, ind + '│  ');
                });
            }
            print(targetPath); walk(root);
        }
    },

    calc: {
        desc: 'Calculate (Safe)',
        run(args) {
            try {
                const expr = args.join('').replace(/[^0-9+\-*/().]/g, '');
                if (!expr) return;
                print(new Function(`return (${expr})`)());
            } catch { print('Invalid expression'); }
        }
    },

    crash: { desc: 'Simulate crash', run() { showBSOD("MANUALLY_INITIATED_CRASH", new Error("User initiated")); } },

    truncate: {
        desc: 'Clear file content',
        run(args) {
            if (!args[0]) return print("Usage: truncate <file>");
            const targetPath = normalizePath(args[0]);
            const fsSearchPath = targetPath.replace(/^C:\//, "");
            const node = resolveFS(fsSearchPath);
            if (!node) return print("File not found");
            if (node.type !== "file") return print("Not a file");
            node.content = "";
            print(`File ${args[0]} cleared.`);
            window.dispatchEvent(new Event("fs-updated"));
        }
    },

    edit: {
        desc: 'Edit text file (:wq to save, :e <line> <text> to edit)',
        async run(args) {
            const file = args[0];
            if (!file) return print("Usage: edit <file>");

            const targetPath = normalizePath(file);
            const fsSearchPath = targetPath.replace(/^C:\//, "");
            let node = resolveFS(fsSearchPath);

            // ファイルが存在しない場合は新規作成
            if (!node) {
                print("File not found, creating...");
                const parts = fsSearchPath.split("/");
                const fileName = parts.pop();
                const parentPath = parts.join("/");

                // ルートディレクトリ (C:/) の場合は resolveFS("") は機能しないかもしれないため対処
                const parent = parentPath === "" ? resolveFS("") : resolveFS(parentPath);

                if (!parent || parent.type === "file") {
                    return print(`Error: Directory not found.`);
                }

                parent[fileName] = { type: "file", content: "" };
                node = parent[fileName];
                window.dispatchEvent(new Event("fs-updated"));
            }

            if (node.type !== "file") return print("Not a file");

            print("---- Editor (type :wq to save, :e <line> <text> to edit) ----");
            let editorBuffer = node.content ? node.content.split("\n") : [];
            editorBuffer.forEach(line => print(line));

            // エディタ用の入力ループを Promise で待機
            return new Promise(resolve => {
                function editorPrompt() {
                    const lineDiv = document.createElement('div');
                    // boot.js の画面に合わせたシンプルな入力欄
                    lineDiv.innerHTML = `<input class="edit-cmd" autocomplete="off" style="background:transparent; color:inherit; border:none; outline:none; width:90%; font-family:inherit; font-size:inherit;">`;
                    screen.appendChild(lineDiv);
                    scrollToBottom();

                    const input = lineDiv.querySelector('.edit-cmd');
                    input.focus();

                    input.onkeydown = e => {
                        if (e.key === 'Enter') {
                            const line = input.value;
                            screen.removeChild(lineDiv); // 入力欄を一旦消す

                            // 保存して終了
                            if (line === ":wq") {
                                node.content = editorBuffer.join("\n");
                                print("Saved.");
                                window.dispatchEvent(new Event("fs-updated"));
                                resolve(); // Promiseを解決して元のCLIに戻る
                                return;
                            }

                            // 特定行の修正
                            const editMatch = line.match(/^:e\s+(\d+)\s+(.+)$/);
                            if (editMatch) {
                                const num = Number(editMatch[1]) - 1;
                                const newText = editMatch[2];
                                if (num < 0 || num >= editorBuffer.length) {
                                    print("Invalid line number");
                                } else {
                                    editorBuffer[num] = newText;
                                    print(`Line ${num + 1} updated: ${newText}`);
                                }
                            } else {
                                // 通常の追記
                                editorBuffer.push(line);
                                print(line);
                            }
                            editorPrompt(); // 次の行の入力へ
                        }
                    };

                    // 画面のどこかをクリックした時に入力欄へフォーカスを戻す
                    lineDiv.onclick = e => {
                        e.stopPropagation();
                        input.focus();
                    };
                }

                editorPrompt();
            });
        }
    }

};

// ===== Prompt & Executor =====
export function prompt() {
    if (screen.style.display === 'none') return;
    const line = document.createElement('div');
    line.id = 'input-line';
    line.innerHTML = `${cwd}> <input id="cmd" autocomplete="off">`;
    screen.appendChild(line);
    scrollToBottom();
    const input = line.querySelector('#cmd');
    input.focus();
    input.onkeydown = e => {
        if (e.key === 'Enter') {
            const cmd = input.value.trim();
            if (cmd) { history.push(cmd); hIndex = history.length; }
            screen.removeChild(line);
            print(`${cwd}> ${cmd}`);
            exec(cmd);
        }
        if (e.key === 'ArrowUp') { hIndex = Math.max(0, hIndex - 1); input.value = history[hIndex] || ''; }
        if (e.key === 'ArrowDown') { hIndex = Math.min(history.length, hIndex + 1); input.value = history[hIndex] || ''; }
        if (e.key === 'Tab') {
            e.preventDefault();
            const value = input.value.trim().toLowerCase();
            if (!value) return;
            const hits = Object.keys(commands).filter(c => c.startsWith(value));
            if (hits.length === 1) input.value = hits[0] + ' ';
            else if (hits.length > 1) { const prefix = commonPrefix(hits); if (prefix.length > value.length) input.value = prefix; }
        }
    };
}

async function runSilent(cmdLine) {
    if (!cmdLine || cmdLine.startsWith('//')) return;
    const tokens = cmdLine.match(/"[^"]+"|\S+/g) || [];
    const name = (tokens.shift() || '').toLowerCase();
    const args = tokens.map(t => t.replace(/^"|"$/g, ''));
    if (commands[name]) {
        try { await commands[name].run(args); } catch (err) { print(`Error: ${err.message}`); }
    } else if (name) { print(`Command not found: ${name}`); }
}

async function exec(cmdLine) {
    await runSilent(cmdLine);
    if (screen.style.display !== 'none') prompt();
}

// ===== Screen Control =====
export function showPromptScreen(logoffMessage = '') {
    screen.style.display = 'block';
    const root = document.getElementById('os-root');
    if (root) {
        root.style.display = 'none';
        root.innerHTML = '';
    }
    document.querySelectorAll('.window').forEach(w => w.remove());
    if (logoffMessage) print(logoffMessage);
    prompt();
}

// ===== Boot Sequence =====
export async function bootOS() {
    try {
        print("\nBoot sequence started...\n");
        const kernel = await import('./kernel.js');
        await kernel.initKernelAsync(msg => print(`[Kernel] ${msg}`));
        const sm = await import('./startmenu.js');
        if (sm.startMenuReady) await sm.startMenuReady(msg => print(`[StartMenu] ${msg}`));
        print('[StartMenu] Ready');
        playSystemEventSound('startup');
        screen.style.display = 'none';
        const root = document.getElementById('os-root');
        if (root) root.style.display = 'block';
    } catch (e) {
        showBSOD("BOOT_SELECTION_FAILED", e);
    }
}

// ===== BIOS (ページロード時) =====
(async function initBIOS() {
    // 1. ファイルシステムの初期化
    const fsPromise = initFS().catch(e => console.warn("FS load failed", e));

    // 2. BIOS起動メッセージ表示
    const lines = [document.title, "Copyright (C) 2026 Nexser Corp.", ""];
    for (const line of lines) {
        print(line);
        await new Promise(r => setTimeout(r, 50));
    }

    await fsPromise;
    console.log("FS restored from DB");

    // 3. 設定のロードと適用
    const savedHeight = await loadSetting("taskbarHeight") || 40;
    document.documentElement.style.setProperty('--taskbar-height', `${savedHeight}px`);

    // 4. デスクトップの構築
    buildDesktop();
    window.dispatchEvent(new Event("desktop-resize"));

    // 5. AUTOBOOT.CFG の安全な実行
    const config = getNodeByPath("C:/System/AUTOBOOT.CFG");
    if (config && config.type === 'file' && config.content.trim()) {
        print("Reading System Configuration...");
        const script = config.content.split('\n').map(s => s.trim()).filter(Boolean);

        for (const line of script) {
            // BSODが既に発生している場合は即座に中断
            if (screen.style.display === 'none') return;

            // コマンドが 'crash' を含む場合は実行せず警告
            if (line.toLowerCase().includes('crash')) {
                print(`[Security] Blocked suspicious command in AUTOBOOT.CFG: ${line}`);
                continue;
            }

            await new Promise(r => setTimeout(r, 30));
            print(`${cwd}> ${line}`);

            // コマンド実行
            await runSilent(line);

            // コマンド実行後に BSOD 発生なら処理を中断
            if (screen.style.display === 'none') return;
        }
    }

    // 6. すべての処理が正常終了した場合のみプロンプトを表示
    prompt();
})();

function bindScreenFocus() {
    if (!screen) return;
    screen.addEventListener('click', () => {
        const input = document.getElementById('cmd');
        if (input) input.focus();
    });
}
bindScreenFocus();