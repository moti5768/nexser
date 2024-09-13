const error_windows = document.querySelector('.error_windows');
const warning_windows = document.querySelector('.warning_windows');

const sound_play_button = document.getElementsByClassName('sound_play_button');
const sound_stop_button = document.getElementsByClassName('sound_stop_button');

let sound_1 = new Audio("nexser_sounds/The-Microsoft-Sound.mp3");
let sound_2 = new Audio("nexser_sounds/tada.mp3");
let sound_3 = new Audio("nexser_sounds/chord.mp3");
let sound_4 = new Audio("nexser_sounds/chimes.mp3");
let sound_5 = new Audio("nexser_sounds/ding.mp3");
let sound_6 = new Audio("nexser_sounds/utopia.mp3");
let sound_7 = new Audio("nexser_sounds/welcome.mp3");
let sound_8 = new Audio("nexser_sounds/windows98.start.mp3");
let sound_9 = new Audio("nexser_sounds/windows98.logoff.mp3");
let sound_10 = new Audio("nexser_sounds/windows2000_startup.mp3");
let sound_11 = new Audio("nexser_sounds/windows2000_shutdown.mp3");
let sound_12 = new Audio("nexser_sounds/windowsxp_startup.mp3");
let sound_13 = new Audio("nexser_sounds/windowsxp_shutdown.mp3");
let sound_14 = new Audio("nexser_sounds/windowsxp_criticalstop.mp3");
sound_1.preload = 'auto';
sound_2.preload = 'auto';
sound_3.preload = 'auto';
sound_4.preload = 'auto';
sound_5.preload = 'auto';
sound_6.preload = 'auto';
sound_7.preload = 'auto';
sound_8.preload = 'auto';
sound_9.preload = 'auto';
sound_10.preload = 'auto';
sound_11.preload = 'auto';
sound_12.preload = 'auto';
sound_13.preload = 'auto';
sound_14.preload = 'auto';

function sound() {
    if (localStorage.getItem('driver_sound')) {
        sound_1.play();
    }
}
function sound2() {
    if (localStorage.getItem('driver_sound')) {
        sound_2.play();
    }
}
function sound3() {
    if (localStorage.getItem('driver_sound')) {
        sound_3.play();
    }
}
function sound4() {
    if (localStorage.getItem('driver_sound')) {
        sound_4.play();
    }
}
function sound5() {
    if (localStorage.getItem('driver_sound')) {
        sound_5.play();
    }
}
function sound6() {
    if (localStorage.getItem('driver_sound')) {
        sound_6.play();
    }
}
function sound7() {
    if (localStorage.getItem('driver_sound')) {
        sound_7.play();
    }
}
function sound8() {
    if (localStorage.getItem('driver_sound')) {
        sound_8.play();
    }
}
function sound9() {
    if (localStorage.getItem('driver_sound')) {
        sound_9.play();
    }
}
function sound10() {
    if (localStorage.getItem('driver_sound')) {
        sound_10.play();
    }
}
function sound11() {
    if (localStorage.getItem('driver_sound')) {
        sound_11.play();
    }
}
function sound12() {
    if (localStorage.getItem('driver_sound')) {
        sound_12.play();
    }
}
function sound13() {
    if (localStorage.getItem('driver_sound')) {
        sound_13.play();
    }
}
function sound14() {
    if (localStorage.getItem('driver_sound')) {
        sound_14.play();
    }
}

function sound_stop() {
    sound_1.pause();
    sound_2.pause();
    sound_3.pause();
    sound_4.pause();
    sound_5.pause();
    sound_6.pause();
    sound_7.pause();
    sound_8.pause();
    sound_9.pause();
    sound_10.pause();
    sound_11.pause();
    sound_12.pause();
    sound_13.pause();
    sound_14.pause();
    sound_1.currentTime = 0;
    sound_2.currentTime = 0;
    sound_3.currentTime = 0;
    sound_4.currentTime = 0;
    sound_5.currentTime = 0;
    sound_6.currentTime = 0;
    sound_7.currentTime = 0;
    sound_8.currentTime = 0;
    sound_9.currentTime = 0;
    sound_10.currentTime = 0;
    sound_11.currentTime = 0;
    sound_12.currentTime = 0;
    sound_13.currentTime = 0;
    sound_14.currentTime = 0;

    Array.from(sound_play_button).forEach((sound_play_buttons) => {
        sound_play_buttons.textContent = "▶"
    })
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
            document.querySelector('.window_error_text').textContent = "サウンドドライバー がインストールされていません!"
            error_windows.classList.remove('active')
            document.querySelector('.test_allwindow').style.display = "block";
            sound3()
            sound_play_buttons.textContent = "▶"
        } else {
            sound_play_buttons.textContent = "||"
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