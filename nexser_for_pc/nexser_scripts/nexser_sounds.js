const warning_windows = document.querySelector('.warning_windows');

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
    "nexser_sounds/windowsxp_criticalstop.mp3"
];

const sounds = soundFiles.map(file => {
    let audio = new Audio(file);
    audio.preload = 'auto';
    audio.load();
    return audio;
});

function sound(index) {
    if (localStorage.getItem('driver_sound')) {
        sounds[index].currentTime = 0;
        sounds[index].play();
    }
}

function sound_stop() {
    sounds.forEach(sound => {
        sound.pause();
        sound.currentTime = 0;
    });
    Array.from(sound_play_button).forEach((sound_play_buttons) => {
        sound_play_buttons.textContent = "▶";
    });
}

Array.from(sound_play_button).forEach((sound_play_buttons) => {
    sound_play_buttons.textContent = "▶"
})
Array.from(sound_play_button).forEach((sound_play_buttons) => {
    sound_play_buttons.addEventListener('mousedown', function () {
        sound_stop()
        Array.from(sound_play_button).forEach((sound_play_buttons) => {
            sound_play_buttons.textContent = "▶"
        })
    })
    sound_play_buttons.addEventListener('click', function () {
        if (!localStorage.getItem('driver_sound')) {
            errortitle_text = "サウンドドライバーがインストールされていません!";
            sound_play_buttons.textContent = "▶";
            error_windows_create();
        } else {
            sound_play_buttons.textContent = "||";
        }
    })
})
Array.from(sound_stop_button).forEach((sound_stop_buttons) => {
    sound_stop_buttons.addEventListener('mousedown', function () {
        sound_stop()
        Array.from(sound_play_button).forEach((sound_play_buttons) => {
            sound_play_buttons.textContent = "▶"
        })
    })
})