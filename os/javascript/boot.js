// boot.js
import { FS, initFS } from './fs.js';
import { buildDesktop } from './desktop.js';
import { showBSOD } from './bsod.js';

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
    const line = document.createElement('div');
    line.id = 'input-line';
    line.innerHTML = `${cwd}> <input id="cmd" autocomplete="off">`;
    screen.appendChild(line);
    scrollToBottom();
    const input = line.querySelector('#cmd');
    input.focus();

    input.onkeydown = e => {
        if (e.key === 'Enter') { const cmd = input.value.trim(); history.push(cmd); hIndex = history.length; screen.removeChild(line); print(`${cwd}> ${cmd}`); exec(cmd); }
        if (e.key === 'ArrowUp') { hIndex = Math.max(0, hIndex - 1); input.value = history[hIndex] || ''; }
        if (e.key === 'ArrowDown') { hIndex = Math.min(history.length, hIndex + 1); input.value = history[hIndex] || ''; }
        if (e.key === 'Tab') { e.preventDefault(); const value = input.value.trim().toLowerCase(); if (!value) return; const hits = Object.keys(commands).filter(c => c.startsWith(value)); if (hits.length === 1) input.value = hits[0] + ' '; else if (hits.length > 1) { const prefix = commonPrefix(hits); if (prefix.length > value.length) input.value = prefix; } }
    };
}

// ===== Command Executor =====
async function exec(cmdLine) {
    if (!cmdLine) return prompt();
    const tokens = cmdLine.match(/"[^"]+"|\S+/g) || [];
    const name = (tokens.shift() || '').toLowerCase();
    const args = tokens.map(t => t.replace(/^"|"$/g, ''));
    const cmd = commands[name];
    if (!cmd) { print(`Command not found: ${name}`); return prompt(); }
    try { await cmd.run(args); } catch (err) { print(`Error: ${err.message}`); }
    prompt();
}

// ===== Boot Sequence =====
export async function bootOS() {
    try {
        print("Boot sequence started...\n");

        // Kernel 初期化（FSは既にロード済み）
        const kernel = await import('./kernel.js');
        await kernel.initKernelAsync(msg => print(`[Kernel] ${msg}`));

        // StartMenu 初期化
        const sm = await import('./startmenu.js');
        if (sm.startMenuReady) await sm.startMenuReady(msg => print(`[StartMenu] ${msg}`));
        print('[StartMenu] Ready');

        // CLI非表示（デスクトップ表示）
        screen.style.display = 'none';

        print("\nBoot sequence complete!");
    } catch (e) {
        print('Boot failed: ' + e.message);
        console.error(e);
    }
}

// ===== BIOS (ページロード時) =====
(async function initBIOS() {
    try {
        await initFS();          // FS一回だけ復元
        console.log("FS restored from DB");
        buildDesktop();          // デスクトップ描画（アイコンだけ）
    } catch (e) { console.warn("FS load failed", e); }

    const lines = [document.title];
    lines.forEach((line, i) => setTimeout(() => print(line), i * 300));
    setTimeout(prompt, lines.length * 300);
})();

// ===== Screen Control =====
export function showPromptScreen(logoffMessage = '') {
    screen.style.display = 'block';
    const root = document.getElementById('os-root');
    if (root) root.innerHTML = '';
    document.querySelectorAll('.window').forEach(w => w.remove());
    if (logoffMessage) screen.textContent += logoffMessage + '\n';
    prompt();
}

function bindScreenFocus() {
    if (!screen) return;
    screen.addEventListener('click', () => { const input = document.getElementById('cmd'); if (input) input.focus(); });
}

// ===== Startup =====
bindScreenFocus();