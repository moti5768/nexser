const sound_play_button = document.getElementsByClassName('sound_play_button');
const sound_stop_button = document.getElementsByClassName('sound_stop_button');

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