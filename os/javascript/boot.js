// boot.js
import { initFS } from './fs.js';
import { playSystemEventSound } from './sounds.js';
import { resolveFS, normalizePath as fsNormalizePath } from './fs-utils.js';
import { loadSetting } from "./apps/settings.js";
import { initScreensaver } from "./screensaver.js";
import { showBSOD } from "./bsod.js";
import { resetWindowIdCounter } from './window.js';
import { logSystemEvent } from './kernel.js';

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
            isSystemVerified = true;
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
        desc: 'Install one or more .nexser or .js packages (Usage: add Programs)',
        async run(args) {
            if (args[0] !== "Programs") {
                return print("Usage: add Programs");
            }

            return new Promise((resolve) => {
                const input = document.createElement("input");
                input.type = "file";
                input.multiple = true; // ★ 複数ファイルの選択を有効化
                // 1. スマホでカスタム拡張子がグレーアウトするのを防ぎ、あらゆるファイルを許容
                input.accept = ".nexser,.js,.json,text/plain,application/json,*/*";

                // 2. iOS Safari対策: 一度DOMに非表示で追加する
                input.style.display = 'none';
                document.body.appendChild(input);

                let isResolved = false;
                const cleanup = () => {
                    if (input.parentNode) {
                        input.parentNode.removeChild(input);
                    }
                    window.removeEventListener('focus', handleFocus);
                };

                const finish = () => {
                    if (!isResolved) {
                        isResolved = true;
                        cleanup();
                        resolve();
                    }
                };

                // 3. スマホでキャンセルした際、onchangeが発火しない対策（フォーカス復帰時に未選択なら終了）
                const handleFocus = () => {
                    setTimeout(() => {
                        if (!input.files || input.files.length === 0) {
                            print("Installation cancelled.");
                            finish();
                        }
                    }, 300);
                };
                window.addEventListener('focus', handleFocus);

                input.onchange = async (e) => {
                    const files = Array.from(e.target.files);
                    if (files.length === 0) {
                        print("Installation cancelled.");
                        finish();
                        return;
                    }

                    print(`Starting installation of ${files.length} file(s)...`);
                    let successCount = 0;

                    // ★ 選択されたファイルを1つずつ順番に処理
                    for (const file of files) {
                        try {
                            print(`Reading package: ${file.name}...`);

                            // FileReaderをPromiseでラップして同期的に処理
                            const textContent = await new Promise((res, rej) => {
                                const reader = new FileReader();
                                reader.onload = (ev) => res(ev.target.result);
                                reader.onerror = (err) => rej(err);
                                reader.readAsText(file);
                            });

                            let nexserData;
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
                                print(`  [App] Installed: ${appNodeName}`);
                                successCount++;
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
                                    print(`  [System] Global settings updated from ${file.name}.`);
                                }
                            }

                        } catch (err) {
                            print(`  [Error] Failed to install ${file.name} (${err.message})`);
                        }
                    }

                    // 全ファイルのループ終了後にまとめて保存とイベント発火を行う
                    if (successCount > 0) {
                        window.dispatchEvent(new Event("fs-updated"));
                        try {
                            const { forceSave } = await import('./fs.js');
                            await forceSave();
                            print(`\nInstallation complete. Successfully installed ${successCount}/${files.length} file(s). You can now launch them from the Start Menu or Explorer.`);
                        } catch (e) {
                            console.warn("Failed to auto-save after multi-install:", e);
                        }
                    } else {
                        print("\nInstallation finished with no files successfully installed.");
                    }

                    finish();
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
        desc: 'Check the file system & DB key structure for errors (Usage: scanfilesystem [path])',
        async run(args) {
            print("Nexser Corp for Nexser OS v0.2.0 - Fast Structure Scanner");

            const targetPathArg = args[0] || "C:/";
            const targetPath = normalizePath(targetPathArg);
            const targetPrefix = targetPath === "C:/" ? "C:" : targetPath.replace(/\/$/, "");
            const fsSearchPath = targetPath === "C:/" ? "" : targetPath.replace(/^C:\//, "");
            const targetNode = resolveFS(fsSearchPath);

            if (!targetNode) {
                return print(`Error: The system cannot find the path specified: ${targetPathArg}`);
            }

            print(`Target: ${targetPath}\n`);

            // 全工程を統合表示するテキスト進捗バーノード
            const progressNode = document.createTextNode('');
            screen.appendChild(progressNode);
            scrollToBottom();

            const BAR_WIDTH = 24;
            const updateProgress = (percent, statusText) => {
                const clamped = Math.max(0, Math.min(100, Math.round(percent)));
                const filled = Math.round((clamped / 100) * BAR_WIDTH);
                const bar = '█'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled);
                progressNode.nodeValue = `[${bar}] ${String(clamped).padStart(3)}% | ${statusText}\n`;
                scrollToBottom();
            };

            const repairLogs = [];
            let errorCount = 0;
            let fixedCount = 0;
            let needsFullSync = false;

            // 1. コアディレクトリ構造チェック (0% -> 15%)
            updateProgress(5, "Checking core directory structure...");
            const { FS, forceSave } = await import('./fs.js');
            const { openDB } = await import('./db.js');

            if (!FS["C:"] || FS["C:"].type !== "folder") {
                FS["C:"] = { type: "folder", system: true };
                errorCount++;
                fixedCount++;
                needsFullSync = true;
                repairLogs.push("[Repaired] Recreated root drive C:");
            }
            for (const dir of ["System", "Desktop", "Programs", "StartMenu", "Trash"]) {
                if (!FS["C:"][dir] || FS["C:"][dir].type !== "folder") {
                    FS["C:"][dir] = { type: "folder", system: true };
                    errorCount++;
                    fixedCount++;
                    needsFullSync = true;
                    repairLogs.push(`[Repaired] Recreated missing system folder: C:/${dir}`);
                }
            }
            updateProgress(15, "Core directory structure verified.");

            // 2. IndexedDB キー一覧の取得・実データは一切読み込まない (15% -> 35%)
            updateProgress(20, "Reading IndexedDB key index (kv / files)...");
            const db = await openDB();
            const { kvKeys, fileKeys } = await new Promise((resolve, reject) => {
                const tx = db.transaction(["kv", "files"], "readonly");
                const kvReq = tx.objectStore("kv").getAllKeys();
                const fileReq = tx.objectStore("files").getAllKeys();
                let k = [], f = [];
                kvReq.onsuccess = () => { k = kvReq.result; };
                fileReq.onsuccess = () => { f = fileReq.result; };
                tx.oncomplete = () => resolve({ kvKeys: k, fileKeys: f });
                tx.onerror = () => reject(tx.error);
            });

            const kvNodeSet = new Set(
                kvKeys
                    .filter(k => typeof k === "string" && k.startsWith("fs_node:"))
                    .map(k => k.slice("fs_node:".length))
            );
            const fileKeySet = new Set(fileKeys.filter(k => typeof k === "string"));
            updateProgress(35, `IndexedDB keys loaded (kv: ${kvNodeSet.size}, files: ${fileKeySet.size})`);

            // 3. 対象ノード一覧の収集 (35% -> 45%)
            updateProgress(40, `Collecting nodes under ${targetPath}...`);
            const items = [];
            const stats = { folders: 0, files: 0, externalFiles: 0, apps: 0, links: 0, brokenLinks: 0, unsyncedKv: 0 };

            const collectItems = (node, currentPath, visited = new WeakSet()) => {
                if (!node || typeof node !== "object" || visited.has(node)) return;
                visited.add(node);

                if (!kvNodeSet.has(currentPath)) {
                    stats.unsyncedKv++;
                }

                for (const [name, val] of Object.entries(node)) {
                    if (!val || typeof val !== "object" || Array.isArray(val) || val instanceof Blob || val instanceof ArrayBuffer) continue;
                    if (typeof val.type !== "string") continue;

                    const itemPath = `${currentPath}/${name}`;
                    items.push({ path: itemPath, node: val });
                    if (val.type === "folder") {
                        collectItems(val, itemPath, visited);
                    } else if (!kvNodeSet.has(itemPath)) {
                        stats.unsyncedKv++;
                    }
                }
            };

            if (targetNode.type && targetNode.type !== "folder") {
                items.push({ path: targetPrefix, node: targetNode });
                if (!kvNodeSet.has(targetPrefix)) stats.unsyncedKv++;
            } else {
                collectItems(targetNode, targetPrefix);
            }

            // 4. ノード構造・リンク整合性スキャン (45% -> 90%)
            const totalItems = items.length;
            const yieldInterval = Math.max(50, Math.floor(totalItems / 20));

            for (let i = 0; i < totalItems; i++) {
                const { path: itemPath, node: item } = items[i];

                if (item.type === "folder") {
                    stats.folders++;
                } else if (item.type === "file") {
                    stats.files++;
                    if (item.content === "__EXTERNAL_DATA__") {
                        stats.externalFiles++;
                        if (!fileKeySet.has(itemPath)) {
                            errorCount++;
                            item.content = "";
                            item.size = 0;
                            fixedCount++;
                            repairLogs.push(`[Repaired] Missing DB key for external file: ${itemPath}`);
                        }
                    } else if (typeof item.content !== "string") {
                        item.content = "";
                        item.size = 0;
                        fixedCount++;
                        repairLogs.push(`[Repaired] Normalized invalid content: ${itemPath}`);
                    }
                } else if (item.type === "app") {
                    stats.apps++;
                    if (item.content === "__EXTERNAL_DATA__") {
                        stats.externalFiles++;
                        if (!fileKeySet.has(itemPath)) {
                            errorCount++;
                            item.content = "";
                            item.size = 0;
                            fixedCount++;
                            repairLogs.push(`[Repaired] Missing DB key for external app: ${itemPath}`);
                        }
                    }
                    if (!item.code && !item.entry) {
                        errorCount++;
                        repairLogs.push(`[Error] Missing entry/code in app: ${itemPath}`);
                    }
                } else if (item.type === "link") {
                    stats.links++;
                    const linkTarget = typeof item.target === "string" ? item.target.replace(/^C:\//, "") : "";
                    if (!item.target || !resolveFS(linkTarget)) {
                        stats.brokenLinks++;
                        repairLogs.push(`[Notice] Broken link: ${itemPath} -> ${item.target || "(none)"}`);
                    }
                }

                if (i % yieldInterval === 0 || i === totalItems - 1) {
                    const scanPct = 45 + Math.round(((i + 1) / Math.max(1, totalItems)) * 45);
                    updateProgress(scanPct, `Scanning nodes (${i + 1}/${totalItems}): ${itemPath}`);
                    await new Promise(r => requestAnimationFrame(r));
                }
            }

            if (stats.unsyncedKv > 0) {
                needsFullSync = true;
                fixedCount += stats.unsyncedKv;
                repairLogs.push(`[Repaired] Re-queued ${stats.unsyncedKv} unsynced KV node(s).`);
            }

            // 5. 修復内容のDB保存 (90% -> 100%)
            if (fixedCount > 0 || needsFullSync) {
                updateProgress(95, "Committing structure repairs to IndexedDB...");
                window.dispatchEvent(new Event("fs-updated"));
                try {
                    await forceSave(needsFullSync);
                    repairLogs.push("[System] Structure changes saved to IndexedDB.");
                } catch (e) {
                    console.warn("Failed to auto-save after scanfilesystem:", e);
                    repairLogs.push(`[Error] Auto-save failed: ${e.message}`);
                }
            }

            updateProgress(100, `Completed (${totalItems}/${totalItems} nodes checked)`);

            if (repairLogs.length > 0) {
                print("");
                repairLogs.forEach(log => print(`  ${log}`));
            }

            print("\n----------------------------------------");
            print(`Scan completed on ${targetPath}:`);
            print(`Folders       : ${stats.folders}`);
            print(`Files         : ${stats.files} (External DB: ${stats.externalFiles})`);
            print(`Apps / Links  : ${stats.apps} apps / ${stats.links} links${stats.brokenLinks > 0 ? ` (Broken: ${stats.brokenLinks})` : ""}`);
            print(`DB Keys       : kv=${kvNodeSet.size} nodes / files=${fileKeySet.size} keys`);
            print(`Total Checked : ${totalItems} nodes`);
            print(`Errors Found  : ${errorCount}`);
            print(`Repaired      : ${fixedCount}`);
            print(`Target status : ${errorCount === 0 ? "Healthy" : (fixedCount >= errorCount ? "Repaired" : "Needs Attention")}`);
            print("----------------------------------------\n");
        }
    }

};

// ===== Prompt & Executor =====
// ===== Prompt & Executor =====
function focusCmdInput() {
    if (!screen || screen.style.display === 'none') return;
    const input = screen.querySelector('#cmd');
    if (input) {
        input.disabled = false;
        input.readOnly = false;
        input.focus();
    }
}

export function prompt() {
    if (!screen || screen.style.display === 'none') return;
    // 古い入力行やID重複を完全に除去
    screen.querySelectorAll('#input-line').forEach(el => el.remove());

    const line = document.createElement('div');
    line.id = 'input-line';
    line.innerHTML = `${cwd}> <input id="cmd" autocomplete="off" spellcheck="false" style="background:transparent; color:inherit; border:none; outline:none; font:inherit; width:calc(100% - 80px); min-width:120px;">`;
    screen.appendChild(line);
    scrollToBottom();
    const input = line.querySelector('#cmd');
    focusCmdInput();
    requestAnimationFrame(focusCmdInput);

    input.onkeydown = e => {
        if (e.key === 'Enter') {
            const cmd = input.value.trim();
            if (cmd) { history.push(cmd); hIndex = history.length; }
            if (line.parentNode === screen) screen.removeChild(line);
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
    if (screen && screen.style.display !== 'none') prompt();
}

// ===== Screen Control =====
export function showPromptScreen(logoffMessage = '') {
    document.getElementById('boot-input-shield')?.remove();
    screen.style.display = 'block';
    const root = document.getElementById('os-root');
    if (root) {
        root.style.display = 'none';
        root.innerHTML = '';
    }
    document.querySelectorAll('.window').forEach(w => w.remove());
    resetWindowIdCounter();
    window.nexser = window.nexser || {};
    window.nexser.isLoggingOff = false;
    window.nexser.isBooting = false;
    if (logoffMessage) print(logoffMessage);
    prompt();
    setTimeout(focusCmdInput, 50);
}

// ===== Boot Sequence =====
export async function bootOS() {
    try {
        print("\nBoot sequence started...\n");
        const kernel = await import('./kernel.js');
        await kernel.bootKernelSequenceAsync({
            screen,
            initFS,
            loadSetting,
            initScreensaver,
            print
        });
    } catch (e) {
        if (screen) screen.style.display = 'block';
        const root = document.getElementById('os-root');
        if (root) root.style.display = 'none';
        throw new Error(`BOOT_SELECTION_FAILED: ${e.message}`);
    }
}

// ===== BIOS (ページロード時) =====
(async function initBIOS() {
    // 1. BIOS起動メッセージ表示
    const lines = [document.title, "Copyright (C) 2026 Nexser Corp.", ""];
    for (const line of lines) {
        print(line);
    }

    // 2. 全DBロード(initFS)より先に AUTOBOOT.CFG の1キーだけを最優先チェック
    const { fastCheckAutoBoot } = await import('./fs-db.js');
    const autoBootContent = await fastCheckAutoBoot();
    const script = autoBootContent
        ? autoBootContent
            .split('\n')
            .map(s => s.trim())
            .filter(line => line && !line.startsWith('//') && !line.startsWith('#'))
        : [];
    const hasBoot = script.some(line => {
        const trimmed = line.toLowerCase();
        return trimmed === 'boot' || trimmed.startsWith('boot ');
    });

    if (hasBoot) {
        print("Booting Nexser OS...");
        try {
            const preBootCommands = script.filter(line => line.toLowerCase() !== 'boot');
            if (preBootCommands.length > 0) {
                await initFS();
                for (const line of preBootCommands) {
                    if (line.toLowerCase().includes('crash')) {
                        print(`[Security] Blocked suspicious command in AUTOBOOT.CFG: ${line}`);
                        continue;
                    }
                    print(`${cwd}> ${line}`);
                    await runSilent(line);
                }
            }

            // boot を最優先実行し、残りのDB読み込みと初期化はプログレスバーウィンドウ内で進行
            isSystemVerified = true;
            await bootOS();
            return;
        } catch (e) {
            screen.style.display = 'block';
            const root = document.getElementById('os-root');
            if (root) root.style.display = 'none';
            print(`\n[Boot Error] Failed to start: ${e.message}`);
            print("Type 'scanfilesystem' to repair, or 'boot' to retry.\n");
            prompt();
        }
    } else {
        // bootがない場合はバックグラウンドでFS読み込みを開始しつつ即座にプロンプト表示
        initFS().catch(e => console.warn("FS load failed", e));
        prompt();
    }
})();

function bindScreenFocus() {
    if (!screen) return;

    // #screen だけでなく、CUI表示中の画面全体のクリック・タップで #cmd へフォーカスを復元する
    document.addEventListener('click', () => {
        if (screen.style.display === 'none') return;
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) return;
        focusCmdInput();
    });

    // フォーカスが外れた状態でキーが押された場合も自動フォーカスして入力を取りこぼさない
    document.addEventListener('keydown', (e) => {
        if (screen.style.display === 'none') return;
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        focusCmdInput();
    });
}
bindScreenFocus();

export function resetSystemVerification() {
    isSystemVerified = false;
}