const sound_play_button = document.getElementsByClassName('sound_play_button');
const sound_stop_button = document.getElementsByClassName('sound_stop_button');

const sounds = [
    "The Microsoft Sound",
    "Tada",
    "Chord",
    "Chimes",
    "Ding",
    "Utopia",
    "Welcome",
    "Windows98 logon",
    "Windows98 logoff",
    "Windows2000 logon",
    "Windows2000 logoff",
    "WindowsXP logon",
    "WindowsXP logoff",
    "WindowsXP criticalstop",
    "WindowsNT logon",
    "WindowsNT logoff"
];

const list = document.querySelector(".sound_list");
sounds.forEach((name, index) => {
    const li = document.createElement("li");
    li.className = "hover_blue";
    li.textContent = name;
    li.addEventListener("click", () => sound(index));
    list.appendChild(li);
});

// サウンドの数 (リストと合わせて16個)
const soundCount = 16;
const buttonList = document.querySelector(".sound_button_list");
for (let i = 0; i < soundCount; i++) {
    const playBtn = document.createElement("li");
    playBtn.className = "button2 sound_play_button";
    playBtn.onclick = () => sound(i);
    const stopBtn = document.createElement("li");
    stopBtn.className = "button2 sound_stop_button";
    stopBtn.textContent = "stop";
    buttonList.appendChild(playBtn);
    buttonList.appendChild(stopBtn);
    const br = document.createElement("br");
    buttonList.appendChild(br);
}

const soundFiles = [
    "The-Microsoft-Sound", "tada", "chord", "chimes", "ding", "utopia", "welcome",
    "windows98.start", "windows98.logoff", "windows2000_startup", "windows2000_shutdown",
    "windowsxp_startup", "windowsxp_shutdown", "windowsxp_criticalstop",
    "windowsNT_logon", "windowsNT_logoff"
].map(name => {
    const audio = new Audio(`nexser_sounds/${name}.mp3`);
    audio.preload = 'auto';
    audio.load();
    return audio;
});

let currentSound = null;

function sound(index) {
    if (!localStorage.getItem('driver_sound')) return;
    if (currentSound && currentSound !== soundFiles[index]) {
        currentSound.pause();
        currentSound.currentTime = 0;
    }
    currentSound = soundFiles[index];
    if (currentSound.paused) {
        currentSound.play().catch(err => console.error("Sound play error:", err));
        currentSound.onended = sound_stop;
    }
}

function sound_stop() {
    soundFiles.forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
    });
    [...sound_play_button].forEach(btn => btn.textContent = "▶");
}

[...sound_play_button].forEach(btn => {
    btn.textContent = "▶";
    btn.addEventListener('mousedown', sound_stop);
    btn.addEventListener('click', () => {
        if (!localStorage.getItem('driver_sound')) {
            btn.textContent = "▶";
            noticewindow_create("error", "サウンドドライバーがインストールされていません!");
        } else {
            btn.textContent = "||";
        }
    });
});

[...sound_stop_button].forEach(btn => {
    btn.addEventListener('mousedown', sound_stop);
});

function playBeep() {
    sound_stop();
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 900;
    gain.gain.value = 0.1;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
}

function playbluescreen() {
    sound_stop();
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    gain.gain.value = 0.1;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    [550, 525, 500].forEach((freq, i) => {
        setTimeout(() => osc.frequency.setValueAtTime(freq, ctx.currentTime), 500 * (i + 1));
    });
    setTimeout(() => osc.stop(), 2500);
}

const logonSounds = [
    { name: "The Microsoft Sound", id: 0 },
    { name: "Utopia", id: 5 },
    { name: "Windows98 logon", id: 7 },
    { name: "Windows2000 logon", id: 9 },
    { name: "WindowsXP logon", id: 11 },
    { name: "WindowsNT logon", id: 14 },
];
const logoffSounds = [
    { name: "Tada", id: 1, cls: "shutdown_1" },
    { name: "Chimes", id: 3, cls: "shutdown_2" },
    { name: "Windows98 logoff", id: 8, cls: "shutdown_3" },
    { name: "Windows2000 logoff", id: 10, cls: "shutdown_4" },
    { name: "WindowsXP logoff", id: 12, cls: "shutdown_5" },
    { name: "WindowsNT logoff", id: 15, cls: "shutdown_6" }
];

function createSoundList(containerId, sounds, resetFn, prefix) {
    const container = document.getElementById(containerId);
    const title = document.createElement('span');
    title.textContent = containerId.includes('logon') ? "Login sound" : "Logoff sound";
    title.style.display = 'block';
    title.style.width = '100%';
    title.style.borderBottom = '1px solid black';
    title.style.marginBottom = '5px';
    container.appendChild(title);
    const list = document.createElement('div');
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '5px';
    sounds.forEach((sound, idx) => {
        const item = document.createElement('div');
        item.className = 'hover_blue';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';

        const spanName = document.createElement('span');
        spanName.className = 'sound_title';
        spanName.style.flex = '1';
        spanName.style.whiteSpace = 'nowrap';
        spanName.textContent = sound.name;

        const playBtn = document.createElement('span');
        playBtn.className = `button2 ${prefix}_${idx + 1}`;
        playBtn.style.padding = '2px 5px';
        playBtn.textContent = 'Play';
        playBtn.onclick = () => soundPlay(sound.id);

        const stopBtn = document.createElement('span');
        stopBtn.className = 'button2';
        stopBtn.style.padding = '2px 5px';
        stopBtn.textContent = 'Stop';
        stopBtn.onclick = sound_stop;

        item.append(spanName, playBtn, stopBtn);
        list.appendChild(item);
    });

    const resetDiv = document.createElement('div');
    resetDiv.style.display = 'flex';
    resetDiv.style.gap = '10px';
    const resetBtn = document.createElement('span');
    resetBtn.className = 'button2';
    resetBtn.style.padding = '2px 5px';
    resetBtn.textContent = containerId.includes('logon') ? 'Login sound reset' : 'Logoff sound reset';
    resetBtn.onclick = resetFn;
    resetDiv.appendChild(resetBtn);
    list.appendChild(resetDiv);
    container.appendChild(list);
}

createSoundList('logon_sounds', logonSounds, startupsound_reset, 'startup');
createSoundList('logoff_sounds', logoffSounds, shutdownsound_reset, 'shutdown');
function soundPlay(id) {
    sound(id);
}

function handleStartupClick(startupClass) {
    startupsound_reset();
    const startupElement = document.querySelector(`.${startupClass}`);
    const isSet = localStorage.getItem(startupClass);
    startupElement.textContent = isSet ? "no set" : "set!";
    if (!isSet) {
        localStorage.setItem(startupClass, true);
    }
}
['startup_1', 'startup_2', 'startup_3', 'startup_4', 'startup_5', 'startup_6'].forEach(startup => {
    document.querySelector(`.${startup}`).addEventListener('click', () => handleStartupClick(startup));
});
function startupsound_reset() {
    const keys = ['startup_1', 'startup_2', 'startup_3', 'startup_4', 'startup_5', 'startup_6'];
    keys.forEach(key => {
        if (localStorage.getItem(key)) {
            localStorage.removeItem(key);
            document.querySelector(`.${key}`).textContent = "no set";
        }
    });
}

function handleShutdownClick(shutdownClass) {
    shutdownsound_reset();
    const shutdownElement = document.querySelector(`.${shutdownClass}`);
    const isSet = localStorage.getItem(shutdownClass);
    shutdownElement.textContent = isSet ? "no set" : "set!";
    if (!isSet) {
        localStorage.setItem(shutdownClass, true);
    }
}
['shutdown_1', 'shutdown_2', 'shutdown_3', 'shutdown_4', 'shutdown_5', 'shutdown_6'].forEach(shutdown => {
    document.querySelector(`.${shutdown}`).addEventListener('click', () => handleShutdownClick(shutdown));
});
function shutdownsound_reset() {
    const shutdownKeys = ['shutdown_1', 'shutdown_2', 'shutdown_3', 'shutdown_4', 'shutdown_5', 'shutdown_6'];
    shutdownKeys.forEach(key => {
        if (localStorage.getItem(key)) {
            localStorage.removeItem(key);
            document.querySelector(`.${key}`).textContent = "no set";
        }
    });
}