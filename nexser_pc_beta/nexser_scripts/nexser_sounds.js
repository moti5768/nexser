const sound_play_button = document.getElementsByClassName('sound_play_button');
const sound_stop_button = document.getElementsByClassName('sound_stop_button');

const soundFiles = [
    "nexser_sounds/The-Microsoft-Sound.mp3",
    "nexser_sounds/tada.mp3",
    "nexser_sounds/chord.mp3",
    "nexser_sounds/chimes.mp3",
    "nexser_sounds/ding.mp3",
    "nexser_sounds/utopia.mp3",
    "nexser_sounds/welcome.mp3",
    "nexser_sounds/windows98.start.mp3",
    "nexser_sounds/windows98.logoff.mp3",
    "nexser_sounds/windows2000_startup.mp3",
    "nexser_sounds/windows2000_shutdown.mp3",
    "nexser_sounds/windowsxp_startup.mp3",
    "nexser_sounds/windowsxp_shutdown.mp3",
    "nexser_sounds/windowsxp_criticalstop.mp3",
    "nexser_sounds/windowsNT_logon.mp3",
    "nexser_sounds/windowsNT_logoff.mp3"
];

const sounds = soundFiles.map(file => {
    let audio = new Audio(file);
    audio.preload = 'auto';
    audio.load();
    return audio;
});

let firstLoad = true;
function sound(index) {
    if (localStorage.getItem('driver_sound')) {
        sounds[index].currentTime = 0;
        if (!firstLoad) {
            sounds[index].play();
            sounds[index].onended = () => {
                sound_stop();
                firstLoad = false;
            };
        }
    }
}


function sound_stop() {
    sounds.forEach(sound => {
        sound.pause();
        sound.currentTime = 0;
    });
    [...sound_play_button].forEach(button => button.textContent = "▶");
}

[...sound_play_button].forEach(button => button.textContent = "▶");
[...sound_play_button].forEach(button => {
    button.addEventListener('mousedown', () => {
        sound_stop();
        [...sound_play_button].forEach(btn => btn.textContent = "▶");
    });
    button.addEventListener('click', () => {
        if (!localStorage.getItem('driver_sound')) {
            button.textContent = "▶";
            noticewindow_create("error", "サウンドドライバーがインストールされていません!");
        } else {
            button.textContent = "||";
        }
    });
});

[...sound_stop_button].forEach(button => {
    button.addEventListener('mousedown', () => {
        sound_stop();
        [...sound_play_button].forEach(btn => btn.textContent = "▶");
    });
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
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    oscillator.type = 'sine';
    gain.gain.value = 0.1;
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    oscillator.frequency.setValueAtTime(550.00, audioCtx.currentTime);
    setTimeout(() => {
        oscillator.frequency.setValueAtTime(525.00, audioCtx.currentTime);
    }, 500);
    setTimeout(() => {
        oscillator.frequency.setValueAtTime(500.00, audioCtx.currentTime);
    }, 1000);
    setTimeout(() => {
        oscillator.stop();
    }, 2000);
}