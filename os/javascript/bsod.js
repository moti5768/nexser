// bsod.js
let isDead = false;
window.addEventListener('contextmenu', e => e.preventDefault(), { capture: true });

// ★ ERROR_MAP をモジュール名のABC順に整理
const ERROR_MAP = {
    'BOOT.JS': '0x0000007B (INACCESSIBLE_BOOT_DEVICE)',
    'EXPLORER.JS': '0x000000F4 (CRITICAL_OBJECT_TERMINATION)',
    'FS-DB.JS': '0x000000ED (UNMOUNTABLE_BOOT_VOLUME)',
    'FS.JS': '0x00000024 (NTFS_FILE_SYSTEM)',
    'KERNEL.JS': '0x0000003B (SYSTEM_SERVICE_EXCEPTION)',
    'SOUNDS.JS': '0x000000EA (THREAD_STUCK_IN_DEVICE_DRIVER)',
    'STARTMENU.JS': '0x00000021 (QUOTA_UNDERFLOW)',
    'WINDOW.JS': '0x0000001E (KMODE_EXCEPTION_NOT_HANDLED)',
    'DEFAULT': '0x0000007E (SYSTEM_THREAD_EXCEPTION_NOT_HANDLED)'
};

export function showBSOD(message, error = null) {
    if (isDead) return;
    isDead = true;

    window.onerror = null;
    window.onunhandledrejection = null;

    let faultingModule = "SYSTEM_CORE";
    let stack = "";

    if (error?.stack) {
        const lines = error.stack.split("\n");
        // ★ 監視対象ファイルもABC順に整理
        const osFiles = [
            "boot.js",
            "desktop.js",
            "explorer.js",
            "fs-db.js",
            "fs.js",
            "kernel.js",
            "sounds.js",
            "startmenu.js",
            "taskbar.js",
            "window.js"
        ];

        const foundLine = lines.find(l => osFiles.some(file => l.toLowerCase().includes(file.toLowerCase())));

        if (foundLine) {
            const match = foundLine.match(/([a-z_-]+\.js)/i);
            if (match) faultingModule = match[1].toUpperCase();
        }
        stack = lines.slice(0, 3).join("\n");
    }

    const stopCodeStr = ERROR_MAP[faultingModule] || ERROR_MAP['DEFAULT'];

    const fullMessage = `A problem has been detected and the system has been shut down.

The problem seems to be caused by the following file: ${faultingModule}

${message || "CRITICAL_PROCESS_DIED"}

If this is the first time you've seen this error screen, restart your computer. 
If this screen appears again, follow these steps:

Check to be sure any software is properly configured. If problems continue, 
disable or remove any newly installed apps or drivers.

Technical information:

*** STOP: ${stopCodeStr}

*** ${faultingModule} - Address 0xFFFFF80002E55ED1 base at 0xFFFFF80002E00000

STACK_TRACE:
${stack}

Beginning dump of physical memory...
Physical memory dump complete.
Contact your administrator for further assistance.

*** Press any key to restart _`;

    const host = document.createElement("div");
    host.style.cssText = "position:fixed;inset:0;z-index:2147483647;cursor:none;user-select:none;touch-action:none;";
    const shadow = host.attachShadow({ mode: "closed" });

    const styleTag = document.createElement("style");
    styleTag.textContent = `div::-webkit-scrollbar { display: none !important; }`;
    shadow.appendChild(styleTag);

    const container = document.createElement("div");
    Object.assign(container.style, {
        height: "100vh",
        background: "#0000AA",
        color: "white",
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: "min(1.8vw, 17px)",
        lineHeight: "1.3em",
        padding: "4vh 5vw",
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
        overflow: "hidden",
        boxSizing: "border-box",
        webkitFontSmoothing: "none",
        msOverflowStyle: "none",
        scrollbarWidth: "none",
    });
    shadow.appendChild(container);

    let i = 0;
    const mount = () => {
        (document.body || document.documentElement).appendChild(host);
        const CHARS_PER_FRAME = 12;
        function typeChar() {
            if (i < fullMessage.length) {
                container.textContent += fullMessage.slice(i, i + CHARS_PER_FRAME);
                i += CHARS_PER_FRAME;
                container.scrollTop = container.scrollHeight;
                requestAnimationFrame(typeChar);
            } else {
                container.style.overflowY = "auto";
            }
        }
        typeChar();
    };

    if (document.readyState === "loading") {
        window.addEventListener("DOMContentLoaded", mount);
    } else {
        mount();
    }

    const reboot = (e) => {
        if (i < fullMessage.length) return;
        const allowedKeys = ["Enter", " ", "Escape"];
        if (e.type.startsWith("key") && !allowedKeys.includes(e.key)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        location.reload();
    };

    ["keydown", "mousedown", "touchstart"].forEach(evt => {
        window.addEventListener(evt, reboot, false);
    });
}