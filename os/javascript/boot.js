// boot.js
import { initFS } from './fs.js';
import { playSystemEventSound } from './kernel.js';
import { resolveFS, normalizePath as fsNormalizePath } from './fs-utils.js';
import { loadSetting } from "./apps/settings.js";
import { initScreensaver } from "./screensaver.js";
import { showBSOD } from "./bsod.js";
import { resetWindowIdCounter } from './window.js';

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
let isSystemVerified = false;

// ===== Utility Functions =====
let isScrolling = false;
function scrollToBottom() {
    // requestAnimationFrameが大量にキューに積まれるのを防ぐ間引き処理
    if (!isScrolling) {
        isScrolling = true;
        requestAnimationFrame(() => {
            screen.scrollTop = screen.scrollHeight;
            isScrolling = false;
        });
    }
}

const MAX_LOG_LINES = 1000; // 画面に保持する最大ログ数（パフォーマンスに応じて調整してください）

export function print(text = '') {
    // 文字列の再代入（textContent +=）をやめ、新しいテキストノードだけを追加する
    const textNode = document.createTextNode(text + '\n');
    screen.appendChild(textNode);

    // ログが増えすぎた場合、古いノードから削除してメモリを解放する
    while (screen.childNodes.length > MAX_LOG_LINES) {
        screen.firstChild.remove();
    }

    scrollToBottom();
}

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
    system: {
        desc: 'Verify file system integrity and hardware state',
        async run() {
            print("Checking hardware resources...");
            print(`  Logical Cores: ${navigator.hardwareConcurrency || 'unknown'}`);
            print(`  Approx. Memory: ${navigator.deviceMemory || 'unknown'} GB`);

            print("Verifying file system integrity...");
            const { diagnoseAndCleanFS } = await import('./fs.js');
            const report = await diagnoseAndCleanFS(false);

            if (report.corruptionDetected) {
                print("  [ERROR] Core system data is missing or corrupted!");
                report.logs.forEach(log => print(`    ${log}`));
                print("  Run 'scanfilesystem' command to repair before booting.");
                isSystemVerified = false;
                return;
            }

            print(`  FS Status: OK. (Garbage items in Trash: ${report.garbageItems})`);

            const sysFolder = resolveFS("System");
            const hasConfig = sysFolder && sysFolder["Config.json"];
            const hasSound = sysFolder && sysFolder["SoundConfig.json"];
            print(`  Configurations: ${hasConfig ? 'Found' : 'Default'} / Audio: ${hasSound ? 'Found' : 'Default'}`);

            print("System actual data verified. Ready to boot.");
            isSystemVerified = true;
        }
    },

    boot: {
        desc: 'Verify system and boot OS',
        async run() {
            // 未検証の場合は自動でシステム診断・検証を実行する
            if (!isSystemVerified) {
                print("Checking hardware resources...");
                print(`  Logical Cores: ${navigator.hardwareConcurrency || 'unknown'}`);
                print(`  Approx. Memory: ${navigator.deviceMemory || 'unknown'} GB`);

                print("Verifying file system integrity...");
                const { diagnoseAndCleanFS } = await import('./fs.js');
                const report = await diagnoseAndCleanFS(false);

                if (report.corruptionDetected) {
                    print("  [ERROR] Core system data is missing or corrupted!");
                    report.logs.forEach(log => print(`    ${log}`));
                    print(`  Run 'scanfilesystem' command to repair before booting.`);
                    return;
                }

                print(`  FS Status: OK. (Garbage items in Trash: ${report.garbageItems})`);

                const sysFolder = resolveFS("System");
                const hasConfig = sysFolder && sysFolder["Config.json"];
                const hasSound = sysFolder && sysFolder["SoundConfig.json"];
                print(`  Configurations: ${hasConfig ? 'Found' : 'Default'} / Audio: ${hasSound ? 'Found' : 'Default'}`);

                isSystemVerified = true;
            }

            print("Booting OS...");
            await bootOS();
        }
    },
    version: { desc: 'Show version', run() { print('NEXSER CLI v1.0.0 (Stable)'); } },
    time: { desc: 'Show time', run() { print(new Date().toLocaleString()); } },
    whoami: { desc: 'Current user', run() { print('user'); } },
    mem: { desc: 'System memory info', run() { print(`Approx. Memory: ${navigator.deviceMemory || 'unknown'} GB`); print(`Logical Cores: ${navigator.hardwareConcurrency || 'unknown'}`); } },
    pwd: { desc: 'Show current directory', run() { print(cwd); } },

    // --- MS-DOS スタイルのコマンド ---

    dir: {
        desc: 'List directory contents (MS-DOS style)',
        run(args) {
            const targetPath = normalizePath(args[0] || ".");
            const fsSearchPath = targetPath === "C:/" ? "" : targetPath.replace(/^C:\//, "");
            const node = resolveFS(fsSearchPath);

            if (!node) return print('File Not Found');
            if (node.type === 'file') return print(args[0]);

            let fileCount = 0, dirCount = 0, totalSize = 0;
            print(` Directory of ${targetPath}\n`);

            Object.entries(node).forEach(([name, val]) => {
                if (['type', 'entry', 'singleton', 'target', 'system', 'name', 'originalPath'].includes(name)) return;

                if (val.type === 'folder' || !val.type) {
                    print(`<DIR>          ${name}`);
                    dirCount++;
                } else if (val.type === 'file') {
                    const size = val.size || (val.content ? val.content.length : 0);
                    print(`${String(size).padStart(14)} ${name}`);
                    totalSize += size;
                    fileCount++;
                } else if (val.type === 'link') {
                    print(`<SYMLINK>      ${name}`);
                    fileCount++;
                } else if (val.type === 'app') {
                    print(`<APP>          ${name}`);
                    fileCount++;
                }
            });
            print(`${String(fileCount).padStart(14)} File(s) ${String(totalSize).padStart(14)} bytes`);
            print(`${String(dirCount).padStart(14)} Dir(s)`);
        }
    },

    type: {
        desc: 'Displays the contents of a text file (Alias for cat)',
        run(args) { commands.cat.run(args); }
    },

    md: {
        desc: 'Creates a directory (Alias for mkdir)',
        run(args) { commands.mkdir.run(args); }
    },

    rd: {
        desc: 'Removes a directory (MS-DOS style rmdir)',
        run(args) {
            if (!args[0]) return print("Usage: rd <directory>");
            const fullPath = normalizePath(args[0]);
            const parts = fullPath.replace(/^C:\//, "").split("/");
            const name = parts.pop();
            const parentPath = parts.join("/");
            const parent = parentPath === "" ? resolveFS("") : resolveFS(parentPath);

            if (!parent || !parent[name]) return print("The system cannot find the path specified.");
            if (parent[name].type !== 'folder') return print("The directory name is invalid.");

            // 中身が空かどうかの確認
            const isEmpty = Object.keys(parent[name]).filter(k => !['type', 'system', 'name'].includes(k)).length === 0;
            if (!isEmpty) return print("The directory is not empty.");

            delete parent[name];
            print(`Directory removed: ${name}`);
            window.dispatchEvent(new Event("fs-updated"));
        }
    },

    del: {
        desc: 'Deletes one or more files',
        run(args) {
            if (!args[0]) return print("Usage: del <file>");
            const fullPath = normalizePath(args[0]);
            const parts = fullPath.replace(/^C:\//, "").split("/");
            const name = parts.pop();
            const parentPath = parts.join("/");
            const parent = parentPath === "" ? resolveFS("") : resolveFS(parentPath);

            if (!parent || !parent[name]) return print("Could Not Find " + fullPath);
            if (parent[name].type === 'folder') return print("Access is denied. (Use 'rd' to remove directories)");

            delete parent[name];
            window.dispatchEvent(new Event("fs-updated"));
        }
    },

    copy: {
        desc: 'Copy one or more files to another location',
        run(args) {
            if (args.length < 2) return print("Usage: copy <source> <destination>");
            const srcPath = normalizePath(args[0]);
            const srcNode = resolveFS(srcPath === "C:/" ? "" : srcPath.replace(/^C:\//, ""));

            if (!srcNode || srcNode.type !== 'file') return print("The system cannot find the file specified, or it is a directory.");

            let destPath = normalizePath(args[1]);
            let destNode = resolveFS(destPath === "C:/" ? "" : destPath.replace(/^C:\//, ""));
            let destParent, finalName;

            if (destNode && destNode.type === 'folder') {
                destParent = destNode;
                const srcParts = srcPath.replace(/^C:\//, "").split("/");
                finalName = srcParts.pop();
            } else {
                const destParts = destPath.replace(/^C:\//, "").split("/");
                finalName = destParts.pop();
                const parentPath = destParts.join("/");
                destParent = parentPath === "" ? resolveFS("") : resolveFS(parentPath);

                if (!destParent || destParent.type === 'file') return print("Invalid destination path.");
            }

            destParent[finalName] = JSON.parse(JSON.stringify(srcNode));
            print(`        1 file(s) copied.`);
            window.dispatchEvent(new Event("fs-updated"));
        }
    },

    ren: {
        desc: 'Renames a file or files (Alias for rename)',
        run(args) { commands.rename.run(args); }
    },

    echo: {
        desc: 'Displays messages or writes to a file (e.g. echo text > file.txt)',
        run(args) {
            if (args.length === 0) return print("ECHO is on.");

            const redirIdx = args.indexOf(">");
            const appendIdx = args.indexOf(">>");

            if (redirIdx !== -1 || appendIdx !== -1) {
                const isAppend = appendIdx !== -1;
                const splitIdx = isAppend ? appendIdx : redirIdx;
                const text = args.slice(0, splitIdx).join(" ");
                const targetFilePath = args.slice(splitIdx + 1).join(" ");

                if (!targetFilePath) return print("The syntax of the command is incorrect.");

                const fullPath = normalizePath(targetFilePath);
                const parts = fullPath.replace(/^C:\//, "").split("/");
                const name = parts.pop();
                const parentPath = parts.join("/");
                const parent = parentPath === "" ? resolveFS("") : resolveFS(parentPath);

                if (!parent || parent.type === "file") return print("The system cannot find the path specified.");

                if (!parent[name]) {
                    parent[name] = { type: "file", content: text };
                } else if (parent[name].type === "file") {
                    parent[name].content = isAppend ? (parent[name].content + "\n" + text) : text;
                } else {
                    return print("Access is denied.");
                }
                window.dispatchEvent(new Event("fs-updated"));
            } else {
                print(args.join(" "));
            }
        }
    },

    find: {
        desc: 'Searches for a text string in a file',
        run(args) {
            if (args.length < 2) return print("Usage: find <string> <file>");
            const searchStr = args[0];
            const targetPath = normalizePath(args[1]);
            const node = resolveFS(targetPath.replace(/^C:\//, ""));

            if (!node) return print("File not found");
            if (node.type !== 'file') return print("Access denied");

            print(`---------- ${args[1].toUpperCase()}`);
            const lines = (node.content || "").split("\n");
            lines.forEach(line => {
                if (line.includes(searchStr)) print(line);
            });
        }
    },

    // --- UNIX・システム系のコマンド ---

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
            const parent = parentPath === "" ? resolveFS("") : resolveFS(parentPath);
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
            const parent = parentPath === "" ? resolveFS("") : resolveFS(parentPath);
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
            const parent = parentPath === "" ? resolveFS("") : resolveFS(parentPath);
            if (!parent || !parent[name]) return print("File or directory not found");
            delete parent[name];
            print(`Removed: ${name}`);
            window.dispatchEvent(new Event("fs-updated"));
        }
    },

    rename: {
        desc: 'Rename or move a file/directory',
        run(args) {
            if (args.length < 2) return print("Usage: rename <old_path> <new_path>");

            const srcPath = normalizePath(args[0]);
            if (srcPath === "C:/") return print("Cannot rename root directory");

            const srcParts = srcPath.replace(/^C:\//, "").split("/");
            const srcName = srcParts.pop();
            const srcParentPath = srcParts.join("/");
            const srcParent = srcParentPath === "" ? resolveFS("") : resolveFS(srcParentPath);

            if (!srcParent || !srcParent[srcName]) return print("Source not found");

            const destPath = normalizePath(args[1]);
            if (destPath === "C:/") return print("Cannot overwrite root directory");

            const destParts = destPath.replace(/^C:\//, "").split("/");
            const destName = destParts.pop();
            const destParentPath = destParts.join("/");
            const destParent = destParentPath === "" ? resolveFS("") : resolveFS(destParentPath);

            if (!destParent || destParent.type === "file") return print("Invalid destination path");
            if (destParent[destName]) return print("Destination already exists");

            destParent[destName] = srcParent[srcName];
            delete srcParent[srcName];

            print(`Renamed: ${srcName} -> ${destName}`);
            window.dispatchEvent(new Event("fs-updated"));
        }
    },

    mv: {
        desc: 'Move or rename a file/directory (Alias for rename)',
        run(args) { commands.rename.run(args); }
    },

    tree: {
        desc: 'Show directory tree (Usage: tree [path] [/d: folders only])',
        run(args) {
            // /d または -d オプションが含まれているかを判定し、パスの引数から除外する
            const hasDirFlag = args.includes('/d') || args.includes('-d');
            const cleanArgs = args.filter(arg => arg !== '/d' && arg !== '-d');

            const targetPath = normalizePath(cleanArgs[0] || ".");
            const fsSearchPath = targetPath === "C:/" ? "" : targetPath.replace(/^C:\//, "");
            const root = resolveFS(fsSearchPath);
            if (!root) return print('Path not found');

            function walk(n, depth = 0, ind = '') {
                // 除外すべきシステムプロパティ
                const skipKeys = new Set(['type', 'entry', 'singleton', 'target', 'content', 'system', 'name', 'originalPath', 'hidden', 'lastModified']);

                Object.entries(n).forEach(([name, val]) => {
                    if (skipKeys.has(name)) return;

                    // フォルダであるかの判定（type が 'folder' または明示的なタイプがないオブジェクト）
                    const isFolder = typeof val === 'object' && val && (val.type === 'folder' || !val.type);

                    // フォルダのみ表示フラグが有効な場合で、かつフォルダでない場合はスキップ
                    if (hasDirFlag && !isFolder) return;

                    print(ind + '├─ ' + name);

                    // 子要素がフォルダの場合のみ再帰的に走査
                    if (isFolder) {
                        walk(val, depth + 1, ind + '│  ');
                    }
                });
            }

            print(targetPath);
            walk(root);
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

    // --- インストール・エディタ系 ---

    add: {
        desc: 'Install a .nexser or .js package (Usage: add Programs)',
        async run(args) {
            if (args[0] !== "Programs") {
                return print("Usage: add Programs");
            }

            return new Promise((resolve) => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".nexser,.js,.json";

                input.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (!file) {
                        print("Installation cancelled.");
                        resolve();
                        return;
                    }

                    print(`Reading package: ${file.name}...`);
                    const reader = new FileReader();
                    reader.onload = async (ev) => {
                        try {
                            let nexserData;
                            const textContent = ev.target.result;

                            if (file.name.endsWith('.js') || !textContent.trim().startsWith('{')) {
                                nexserData = {
                                    type: "app",
                                    name: file.name.replace(/\.[^/.]+$/, ""),
                                    windowOptions: { width: "300px", height: "400px" },
                                    code: textContent
                                };
                            } else {
                                const sanitizedText = textContent.replace(/"(?:[^"\\]|\\.)*"/g, (match) => {
                                    return match
                                        .replace(/\r?\n/g, "\\n")
                                        .replace(/\t/g, "\\t");
                                });
                                nexserData = JSON.parse(sanitizedText);
                            }

                            if (nexserData.type === "app" && nexserData.name && nexserData.code) {
                                const appNodeName = `${nexserData.name}.app`;
                                let codeContent = nexserData.code;

                                codeContent = codeContent.replace(
                                    /from\s+['"](\.\.?\/[^'"]+)['"]/g,
                                    (match, p1) => {
                                        const cleanPath = p1.replace(/^(\.\.\/)+/, '');
                                        return `from "/${cleanPath}"`;
                                    }
                                );

                                const targetFolder = resolveFS("Programs/Applications");
                                if (!targetFolder) throw new Error("Programs/Applications folder not found");

                                targetFolder[appNodeName] = {
                                    type: "app",
                                    code: codeContent,
                                    windowOptions: nexserData.windowOptions || {}
                                };
                                print(`[App] Installed with dynamic code support: ${appNodeName}`);
                            }

                            if (nexserData.settings) {
                                const systemFolder = resolveFS("System");
                                if (systemFolder) {
                                    if (!systemFolder["Config.json"]) {
                                        systemFolder["Config.json"] = { type: "file", content: "{}" };
                                    }
                                    const currentConfig = JSON.parse(systemFolder["Config.json"].content || "{}");
                                    const mergedConfig = { ...currentConfig, ...nexserData.settings };
                                    systemFolder["Config.json"].content = JSON.stringify(mergedConfig, null, 2);
                                    print("[System] Global settings updated.");
                                }
                            }

                            window.dispatchEvent(new Event("fs-updated"));
                            const { forceSave } = await import('./fs.js');
                            await forceSave();
                            print("Installation complete. You can now launch it from the Start Menu or Explorer.");

                        } catch (err) {
                            print(`Error: Installation failed (${err.message})`);
                        }
                        resolve();
                    };
                    reader.readAsText(file);
                };
                input.click();
            });
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

            if (!node) {
                print("File not found, creating...");
                const parts = fsSearchPath.split("/");
                const fileName = parts.pop();
                const parentPath = parts.join("/");

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

            return new Promise(resolve => {
                function editorPrompt() {
                    const lineDiv = document.createElement('div');
                    lineDiv.innerHTML = `<input class="edit-cmd" autocomplete="off" style="background:transparent; color:inherit; border:none; outline:none; width:90%; font-family:inherit; font-size:inherit;">`;
                    screen.appendChild(lineDiv);
                    scrollToBottom();

                    const input = lineDiv.querySelector('.edit-cmd');
                    input.focus();

                    input.onkeydown = e => {
                        if (e.key === 'Enter') {
                            const line = input.value;
                            screen.removeChild(lineDiv);

                            if (line === ":wq") {
                                node.content = editorBuffer.join("\n");
                                print("Saved.");
                                window.dispatchEvent(new Event("fs-updated"));
                                resolve();
                                return;
                            }

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
                                editorBuffer.push(line);
                                print(line);
                            }
                            editorPrompt();
                        }
                    };

                    lineDiv.onclick = e => {
                        e.stopPropagation();
                        input.focus();
                    };
                }

                editorPrompt();
            });
        }
    },




    scanfilesystem: {
        desc: 'Check the file system for errors and repair (Usage: scanfilesystem [path])',
        async run(args) {
            // 共通のウェイト処理（演出用の遅延）
            const wait = (ms) => new Promise(r => setTimeout(r, ms));

            print("Nexser Corp for Nexser OS v0.1.0");
            print("Initializing scanfilesystem...\n");
            await wait(400);

            // 1. システム整合性とコアディレクトリのチェック
            print("--> Checking system integrity and core directories...");
            const { diagnoseAndCleanFS, forceSave } = await import('./fs.js');
            const systemReport = await diagnoseAndCleanFS(true); // 自動修復を実行

            if (systemReport.logs.length > 0) {
                systemReport.logs.forEach(log => print(`    ${log}`));
            }
            await wait(500);

            print("--> Scanning files and applications...");
            await wait(400);

            // ★ 追加・変更: 引数（args[0]）から対象パスを特定する（未指定の場合は C:/ 全体）
            const targetPathArg = args[0] || "C:/";
            const targetPath = normalizePath(targetPathArg);
            const fsSearchPath = targetPath === "C:/" ? "" : targetPath.replace(/^C:\//, "");
            const targetNode = resolveFS(fsSearchPath);

            if (!targetNode) {
                return print(`Error: The system cannot find the path specified: ${targetPathArg}`);
            }

            // 全ファイル・アプリノードを再帰的に収集
            const files = [];
            const skipKeys = new Set(['type', 'entry', 'singleton', 'target', 'content', 'system', 'name', 'originalPath']);

            function collectNodes(node, path) {
                if (!node || typeof node !== 'object') return;

                for (const [name, val] of Object.entries(node)) {
                    if (skipKeys.has(name)) continue;
                    const currentPath = `${path}/${name}`;
                    if (val && typeof val === 'object') {
                        if (val.type === 'file' || val.type === 'app') {
                            files.push({ path: currentPath, node: val });
                        } else if (val.type === 'folder' || !val.type) {
                            collectNodes(val, currentPath);
                        }
                    }
                }
            }

            // ★ 変更: 指定された対象が単一ファイル、またはフォルダの場合に応じた収集
            if (targetNode.type === 'file' || targetNode.type === 'app') {
                files.push({ path: targetPath, node: targetNode });
            } else {
                const basePath = targetPath === "C:/" ? "C:" : targetPath.replace(/\/$/, "");
                collectNodes(targetNode, basePath);
            }

            const totalFiles = files.length;
            print(`Scanning target ${targetPath} (${totalFiles} items found)...`);

            // 進捗表示用のテキストノードを作成
            const progressNode = document.createTextNode('');
            screen.appendChild(progressNode);
            scrollToBottom();

            let errorCount = systemReport.corruptionDetected ? 1 : 0;
            let fixedCount = systemReport.garbageItems > 0 ? systemReport.garbageItems : 0;

            // 1つずつチェックしながら横棒グラフを更新
            for (let i = 0; i < totalFiles; i++) {
                const item = files[i];

                // 破損チェックと修復
                if (item.node.type === 'file') {
                    if (typeof item.node.content !== 'string') {
                        item.node.content = "";
                        fixedCount++;
                    }
                } else if (item.node.type === 'app') {
                    if (!item.node.code && !item.node.entry) {
                        errorCount++;
                    }
                }

                // 横棒グラフの作成 (幅20文字)
                const progress = i + 1;
                const percentage = Math.floor((progress / Math.max(totalFiles, 1)) * 100);
                const filledCount = Math.floor((progress / Math.max(totalFiles, 1)) * 20);
                const bar = '█'.repeat(filledCount) + '░'.repeat(20 - filledCount);

                progressNode.nodeValue = `${bar} ${percentage}% (${progress}/${totalFiles})\n`;
                scrollToBottom();

                await wait(30);
            }

            print("\n----------------------------------------");
            print(`Scan completed on ${targetPath}:`);
            print(`Total Checked : ${totalFiles}`);
            print(`Errors Found  : ${errorCount}`);
            print(`Repaired      : ${fixedCount}`);
            print("Target status : Healthy.");
            print("----------------------------------------\n");

            // 修復やクリーンアップが発生した場合は自動保存
            if (fixedCount > 0 || systemReport.corruptionDetected) {
                window.dispatchEvent(new Event("fs-updated"));
                try {
                    await forceSave();
                    print("[System] File system changes have been saved.");
                } catch (e) {
                    console.warn("Failed to auto-save after scandisk:", e);
                }
            }
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
    resetWindowIdCounter();
    if (logoffMessage) print(logoffMessage);
    prompt();
}

// ===== Boot Sequence =====
export async function bootOS() {
    try {
        print("\nBoot sequence started...\n");

        const kernel = await import('./kernel.js');

        // 1. カーネル空間の初期化 (DOM・エラーハンドリング)
        await kernel.initKernelSpaceAsync(msg => print(`[Kernel] ${msg}`));

        // カーネル初期化後、シェル構築前にタスクバーの高さを適用
        const savedHeight = await loadSetting("taskbarHeight") || 40;
        document.documentElement.style.setProperty('--taskbar-height', `${savedHeight}px`);

        // 2. 画面をCLIからGUIルート画面へ切替
        screen.style.display = 'none';
        const root = document.getElementById('os-root');
        if (root) root.style.display = 'block';

        // 3. 【Stage 1】システムUIシェル（タスクバー・スタートメニュー）の確立
        await kernel.initShellAsync(msg => print(`[Shell] ${msg}`));

        // 4. 【Stage 2】デスクトップビューの構築
        await kernel.initDesktopAsync(msg => print(`[Desktop] ${msg}`));
        window.dispatchEvent(new Event("desktop-resize"));

        // 5. ユーザースペース（システム診断等）の初期化
        await kernel.initUserSpaceAsync(msg => print(`[UserSpace] ${msg}`));

        // 6. システムサービスの起動 (エラー時のフェイルセーフ対応)
        try {
            await initScreensaver();
            print('[Screensaver] Ready');
        } catch (ssErr) {
            print('[Screensaver] Skipped (Non-critical failure)');
            console.warn("Screensaver failed to initialize, but boot will continue:", ssErr);
        }

        // 7. 起動音再生
        playSystemEventSound('startup');
        print("OS Boot Completed Successfully.");
    } catch (e) {
        throw new Error(`BOOT_SELECTION_FAILED: ${e.message}`);
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

    // 3. AUTOBOOT.CFG の内容をチェックして 'boot' が含まれているか確認
    const config = getNodeByPath("C:/System/AUTOBOOT.CFG");
    const hasBoot = config && config.type === 'file' && config.content.split('\n').some(line => {
        const trimmed = line.trim().toLowerCase();
        return trimmed === 'boot' || trimmed.startsWith('boot ');
    });

    if (hasBoot) {
        print("Reading System Configuration...");
        const script = config.content.split('\n').map(s => s.trim()).filter(Boolean);

        try {
            for (const line of script) {
                if (screen.style.display === 'none') return;
                if (line.toLowerCase().includes('crash')) {
                    print(`[Security] Blocked suspicious command in AUTOBOOT.CFG: ${line}`);
                    continue;
                }

                await new Promise(r => setTimeout(r, 30));
                print(`${cwd}> ${line}`);
                await runSilent(line);
                if (screen.style.display === 'none') return;
            }
        } catch (e) {
            print(`\n[Boot Error] Failed to start: ${e.message}`);
        } finally {
            // エラーやブート失敗によりGUIに切り替わっていない場合はプロンプトを復旧
            if (screen.style.display !== 'none') {
                print("\nSystem boot interrupted or failed.");
                print("Type 'scanfilesystem' to repair, or 'boot' to retry.\n");
                prompt();
            }
        }
    } else {
        // bootがない場合は即座にプロンプトを表示する
        prompt();
    }
})();

function bindScreenFocus() {
    if (!screen) return;
    screen.addEventListener('click', () => {
        const input = document.getElementById('cmd');
        if (input) input.focus();
    });
}
bindScreenFocus();

export function resetSystemVerification() {
    isSystemVerified = false;
}