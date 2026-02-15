// boot.js
import { FS, initFS } from './fs.js';
import { buildDesktop } from './desktop.js';
import { showBSOD } from './bsod.js';
import { playSystemEventSound } from './kernel.js'

// ===== Global Error Handlers =====
window.onerror = (msg, src, line, col, err) => showBSOD(String(msg), err);
window.addEventListener("unhandledrejection", e => showBSOD(String(e.reason), e.reason instanceof Error ? e.reason : null));

// ===== Passive Event / Touch Defaults =====
let supportsPassive = false;
try {
    const opts = { passive: false, get passive() { supportsPassive = true; return false; } };
    window.addEventListener("testPassive", null, opts);
    window.removeEventListener("testPassive", null, opts);
} catch { }

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

// ===== Virtual File System Helpers =====
function normalizePath(path) {
    if (!path || path === '.') return cwd;
    if (path.startsWith('C:/')) return path;
    if (path.startsWith('/')) return 'C:/' + path.slice(1);
    return (cwd.replace(/\/$/, '') + '/' + path).replace(/\/+/g, '/');
}

function getNodeByPath(path) {
    const full = normalizePath(path).replace(/^C:\//i, '');
    if (!full) return FS;
    const parts = full.split('/').filter(Boolean);
    let node = FS;
    for (const part of parts) { if (!node || !node[part]) return null; node = node[part]; }
    return node;
}

// ===== Commands =====
const commands = {
    help: { desc: 'Show available commands', run() { Object.entries(commands).forEach(([n, c]) => print(`${n.padEnd(12)} - ${c.desc}`)); } },
    cls: { desc: 'Clear screen', run() { screen.textContent = ''; } },
    boot: { desc: 'Boot OS', async run() { await bootOS(); } },
    version: { desc: 'Show version', run() { print('NEXSER CLI v0.1.0'); } },
    time: { desc: 'Show time', run() { print(new Date().toLocaleString()); } },
    whoami: { desc: 'Current user', run() { print('user'); } },
    mem: { desc: 'System memory info', run() { print(`Approx. Memory: ${navigator.deviceMemory || 'unknown'} GB`); print(`Logical Cores: ${navigator.hardwareConcurrency || 'unknown'}`); } },
    devices: { desc: 'Device info', run() { print(`Platform: ${navigator.platform}`); print(`User Agent: ${navigator.userAgent}`); } },
    pwd: { desc: 'Show current directory', run() { print(cwd); } },
    cd: { desc: 'Change directory', run(args) { if (!args[0]) return; const node = getNodeByPath(args[0]); if (!node || node.type === 'file') return print('Not a directory'); cwd = normalizePath(args[0]).replace(/\/$/, ''); } },
    cat: { desc: 'Show file content', run(args) { const node = getNodeByPath(args[0]); if (!node) return print('File not found'); if (node.type !== 'file') return print('Not a file'); print(node.content); } },
    tree: { desc: 'Show directory tree', run(args) { const root = getNodeByPath(args[0]); if (!root) return print('Path not found'); function walk(n, depth = 0, ind = '') { Object.entries(n).forEach(([name, val]) => { if (['type', 'entry', 'singleton', 'target'].includes(name)) return; print(ind + '├─ ' + name); if (typeof val === 'object' && val.type !== 'file') walk(val, depth + 1, ind + '│  '); }); } print(cwd); walk(root); } },
    echo: { desc: 'Print text', run(args) { print(args.join(' ')); } },
    history: { desc: 'Show command history', run() { history.forEach((h, i) => print(`${i}: ${h}`)); } },
    calc: { desc: 'Calculate expression', run(args) { try { const result = Function(`return (${args.join(' ')})`)(); print(result); } catch { print('Invalid expression'); } } },
    sleep: { desc: 'Wait ms', async run(args) { const ms = Number(args[0]) || 1000; print(`Sleeping ${ms}ms...`); await new Promise(r => setTimeout(r, ms)); } }
};

// ===== Prompt =====
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
            history.push(cmd);
            hIndex = history.length;
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

// ===== Command Executor =====
async function runSilent(cmdLine) {
    if (!cmdLine || cmdLine.startsWith('//')) return;
    const tokens = cmdLine.match(/"[^"]+"|\S+/g) || [];
    const name = (tokens.shift() || '').toLowerCase();
    const args = tokens.map(t => t.replace(/^"|"$/g, ''));
    const cmd = commands[name];
    if (cmd) { try { await cmd.run(args); } catch (err) { print(`Error: ${err.message}`); } }
    else { print(`Command not found: ${name}`); }
}

async function exec(cmdLine) {
    await runSilent(cmdLine);
    if (screen.style.display !== 'none') { prompt(); }
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
        print("\nBoot sequence complete!");
    } catch (e) {
        print('Boot failed: ' + e.message);
        console.error(e);
    }
}

// ===== BIOS (ページロード時) =====
(async function initBIOS() {
    // 1. データ復元とUI準備を並行して開始
    const fsPromise = initFS().catch(e => console.warn("FS load failed", e));

    // 2. ロゴと著作権表示（ディレイを 300ms -> 50ms に短縮）
    const lines = [document.title, "Copyright (C) 2026 Nexser Corp.", ""];
    for (const line of lines) {
        print(line);
        await new Promise(r => setTimeout(r, 50)); // 読みやすい速さで流す
    }

    // 3. FSのロード完了を待ってデスクトップ構築
    await fsPromise;
    console.log("FS restored from DB");
    buildDesktop();

    // 4. AUTOBOOT.CFG の実行
    const config = getNodeByPath("C:/System/AUTOBOOT.CFG");
    if (config && config.type === 'file' && config.content.trim()) {
        print("Reading System Configuration...");

        const script = config.content.split('\n').map(s => s.trim()).filter(Boolean);
        for (const line of script) {
            // コマンド実行前に一瞬だけ待機（演出）
            await new Promise(r => setTimeout(r, 30));

            print(`${cwd}> ${line}`);
            await runSilent(line);

            // bootコマンドでGUIに切り替わったら即座に終了
            if (screen.style.display === 'none') return;
        }
    }

    // すべて終わったらプロンプトへ
    prompt();
})();

// ===== Screen Control =====
export function showPromptScreen(logoffMessage = '') {
    screen.style.display = 'block';
    const root = document.getElementById('os-root');
    if (root) {
        root.style.display = 'none';
        root.innerHTML = '';
    }
    document.querySelectorAll('.window').forEach(w => w.remove());
    if (logoffMessage) screen.textContent += logoffMessage + '\n';
    prompt();
}

function bindScreenFocus() {
    if (!screen) return;
    screen.addEventListener('click', () => {
        const input = document.getElementById('cmd');
        if (input) input.focus();
    });
}

// ===== Startup =====
bindScreenFocus();