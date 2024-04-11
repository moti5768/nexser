const shutdown = document.getElementsByClassName('shutdown');
const restart = document.getElementsByClassName('restart');

const parent_start_menu = document.getElementById('start_menu');
const taskbar = document.getElementById('taskbar');
const toolbar = document.getElementById('toolbar');
const background_text = document.getElementById('background_text');

const screen_saver_group = document.getElementById('screen_saver_group');

const nameText = document.querySelector('.name');
const msg = document.querySelector('.test_name');
const nameText2 = document.querySelector('.name2');
const msg2 = document.querySelector('.test_name2');
const prompt = document.getElementById('prompt');
const prompt_text = document.querySelector('.prompt_text');
const prompt_text2 = document.querySelector('.prompt_text2');
const userelement = document.querySelector('.user');
const nexser = document.getElementById('nexser');
const nexser_program = document.getElementById('nexser_program');
const desktop = document.getElementById('desktop');
const soft_windows = document.getElementById('soft_windows');
const title = document.querySelector('.title');
const z_index = document.querySelector('.z_index');

// soft_windows
const child_windows = document.querySelector('.child_windows');

const main = document.querySelector('.main');
const program = document.querySelector('.program_manager');
const control = document.querySelector('.control_panel');
const color_menu = document.querySelector('.color');
const system_menu = document.querySelector('.system_menu');
const window_prompt = document.querySelector('.window_prompt');
const clock_menu = document.querySelector('.clock_menu');
const sound_menu = document.querySelector('.sound_menu');
const driver_menu = document.querySelector('.driver_menu');
const mouse_menu = document.querySelector('.mouse_menu');
const screen_menu = document.querySelector('.screen_menu');
const note_pad = document.querySelector('.note_pad');
const text_drop_menu = document.querySelector('.text_drop_menu');
const windowmode_menu = document.querySelector('.windowmode_menu');
const accessory_menu = document.querySelector('.accessory_menu');
const calc_menu = document.querySelector('.calc_menu');
const nexser_sound_menu = document.querySelector('.nexser_sound_menu');
const camera_menu = document.querySelector('.camera_menu');
const htmlviewer_edit_menu = document.querySelector('.htmlviewer_edit_menu');
const htmlviewer_run_menu = document.querySelector('.htmlviewer_run_menu');
const uploadvideo_menu = document.querySelector('.uploadvideo_menu');
const font_menu = document.querySelector('.font_menu');
const setting_menu = document.querySelector('.setting_menu');
const debug_menu = document.querySelector('.debug_menu');
const file_download_menu = document.querySelector('.file_download_menu');
const display_menu = document.querySelector('.display_menu');
const stopwatch_menu = document.querySelector('.stopwatch_menu');
const comment_menu = document.querySelector('.comment_menu');

const notice_menu = document.querySelector('.notice_menu');

const error_windows = document.querySelector('.error_windows');
const warning_windows = document.querySelector('.warning_windows');

// sounds
const sound_1 = new Audio("https://github.com/moti5768/nexser/raw/main/nexser_sounds/The-Microsoft-Sound.mp3");
const sound_2 = new Audio("https://github.com/moti5768/nexser/raw/main/nexser_sounds/tada.mp3");
const sound_3 = new Audio("https://github.com/moti5768/nexser/raw/main/nexser_sounds/chord.mp3");
const sound_4 = new Audio("https://github.com/moti5768/nexser/raw/main/nexser_sounds/chimes.mp3");
const sound_5 = new Audio("https://github.com/moti5768/nexser/raw/main/nexser_sounds/ding.mp3");
const sound_6 = new Audio("https://github.com/moti5768/nexser/raw/main/nexser_sounds/utopia.mp3");
const sound_7 = new Audio("https://github.com/moti5768/nexser/raw/main/nexser_sounds/welcome.mp3");
const sound_8 = new Audio("https://github.com/moti5768/nexser/raw/main/nexser_sounds/windows98.start.mp3");
const sound_9 = new Audio("https://github.com/moti5768/nexser/raw/main/nexser_sounds/windows98.logoff.mp3");
const sound_10 = new Audio("https://github.com/moti5768/nexser/raw/main/nexser_sounds/windows2000_startup.mp3");
const sound_11 = new Audio("https://github.com/moti5768/nexser/raw/main/nexser_sounds/windows2000_shutdown.mp3");
const sound_12 = new Audio("https://github.com/moti5768/nexser/raw/main/nexser_sounds/windowsxp_startup.mp3");
const sound_13 = new Audio("https://github.com/moti5768/nexser/raw/main/nexser_sounds/windowsxp_shutdown.mp3");

// *sounds*
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

document.querySelectorAll('.sound_play_button').forEach(function (sound_play_button) {
    sound_play_button.addEventListener('mousedown', function () {
        sound_stop()
    })
})

document.querySelectorAll('.sound_stop_button').forEach(function (sound_stop_button) {
    sound_stop_button.addEventListener('mousedown', function () {
        sound_stop()
    })
})

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
}

document.querySelector('#prompt').addEventListener('click', function () {
    document.querySelector('.focus').focus();
})

document.getElementById('startbtn').addEventListener('touchstart', function () {
    if (start_menu.style.display == "block") {
        // noneで非表示
        start_menu.style.display = "none";
        document.querySelector('.start_button').classList.remove('pressed')
    } else {
        // blockで表示
        start_menu.style.display = "block";
        document.querySelector('.start_button').classList.add('pressed');
        document.querySelector('.battery_menu').style.display = "none";
        document.querySelector('.task_battery').classList.remove('pressed');
    }
})
document.querySelector('.task_battery').addEventListener('click', function () {
    if (document.querySelector('.battery_menu').style.display == "block") {
        // noneで非表示
        document.querySelector('.battery_menu').style.display = "none";
    } else {
        // blockで表示
        document.querySelector('.battery_menu').style.display = "block";
    }
})
soft_windows.addEventListener('mousedown', function () {
    start_menu.style.display = "none";
    document.querySelector('.start_button').classList.remove('pressed');
    document.querySelector('.task_battery').classList.remove('pressed');
    document.querySelector('.battery_menu').style.display = "none";
    helpmenu_close()
});
parent_start_menu.addEventListener('click', function () {
    start_menu.style.display = "none";
    taskbtn_load()
    document.querySelector('.start_button').classList.remove('pressed')
});
document.querySelector('.taskbar_buttons, .child').addEventListener('mousedown', function () {
    start_menu.style.display = "none";
    document.querySelector('.start_button').classList.remove('pressed')
    taskbtn_load()
    getLargestZIndex('.child_windows');
    z_index.textContent = getLargestZIndex('.child_windows');
});

document.querySelectorAll('.button').forEach(function (button) {
    button.addEventListener('click', function () {
        let tscbtn = button.firstChild;
        tscbtn = button.classList.toggle('pressed');
        console.log(tscbtn)
    });
});
document.querySelectorAll('.button2').forEach(function (button2) {
    button2.addEventListener('touchstart', function () {
        button2.classList.add('pressed');
        addEventListener('touchend', function () {
            document.querySelectorAll('.button2').forEach(function (button2) {
                button2.classList.remove('pressed');
            })
        });
    });
});

window.addEventListener('load', load_nexser);
function load_nexser() {
    if (!localStorage.getItem('start_nexser') && localStorage.getItem('prompt_data')) {
        start_check()
    } else if (localStorage.getItem('prompt_data') && localStorage.getItem('start_nexser')) {
        prompt.style.display = "none";
        nexser_program.style.display = "none";
        nexser.style.display = "block";
        desktop.style.display = "block"
        taskbtn_load()
        document.querySelector('.welcome_windows').style.display = "none";
    } else if (localStorage.getItem('prompt_data3')) {
        prompt.style.display = "none";
        nexser_program.style.display = "block";
        nexser.style.display = "none";
        desktop.style.display = "none";
        document.querySelector('html').style.cursor = 'crosshair';
    } else {
        prompt.style.display = "block";
        nexser_program.style.display = "none";
        nexser.style.display = "none";
        desktop.style.display = "none";
        document.querySelector('.focus').focus();
    }
    taskbar_none()
    title_none()
    setColor()
    screen_backtextload()
    all_load()
    notecolor_change()
}

function nexser_program_open() {
    document.querySelector('.prompt_error_text').textContent = "";
    document.querySelector('html').style.cursor = 'crosshair';
    document.querySelector('.test_allwindow').style.display = "none";
    setTimeout(function () {
        prompt.style.display = "none";
        setTimeout(function () {
            taskbar_none();
            nexser_program.style.display = "block";
        }, 100);
    }, 100);
}

function nexser_program_close() {
    document.querySelector('html').style.cursor = '';
    document.querySelector('.test_allwindow').style.display = "none";
    setTimeout(function () {
        localStorage.removeItem('prompt_data3')
        prompt.style.display = "block";
        setTimeout(function () {
            taskbar_none();
            nexser_program.style.display = "none";
            document.querySelector('.focus').focus();
        }, 500);
    }, 500);
}

document.querySelector('.startup_note').addEventListener('click', function () {
    if (localStorage.getItem('startup_note')) {
        localStorage.removeItem('startup_note')
        document.querySelector('.startup_note').textContent = "OFF"
    } else {
        const startup_note = document.querySelector('.startup_note');
        localStorage.setItem('startup_note', startup_note);
        document.querySelector('.startup_note').textContent = "ON"
    }
})
document.querySelector('.startup_program').addEventListener('click', function () {
    if (localStorage.getItem('startup_program')) {
        localStorage.removeItem('startup_program')
        document.querySelector('.startup_program').textContent = "OFF"
    } else {
        const startup_program = document.querySelector('.startup_program');
        localStorage.setItem('startup_program', startup_program);
        document.querySelector('.startup_program').textContent = "ON"
    }
})
document.querySelector('.startup_color').addEventListener('click', function () {
    if (localStorage.getItem('startup_color')) {
        localStorage.removeItem('startup_color')
        document.querySelector('.startup_color').textContent = "OFF"
    } else {
        const startup_color = document.querySelector('.startup_color');
        localStorage.setItem('startup_color', startup_color);
        document.querySelector('.startup_color').textContent = "ON"
    }
})
document.querySelector('.startup_screen').addEventListener('click', function () {
    if (localStorage.getItem('startup_screen')) {
        localStorage.removeItem('startup_screen')
        document.querySelector('.startup_screen').textContent = "OFF"
    } else {
        const startup_screen = document.querySelector('.startup_screen');
        localStorage.setItem('startup_screen', startup_screen);
        document.querySelector('.startup_screen').textContent = "ON"
    }
})

document.querySelector('.startup_htmlviewer_edit').addEventListener('click', function () {
    if (localStorage.getItem('startup_htmlviewer_edit')) {
        localStorage.removeItem('startup_htmlviewer_edit')
        document.querySelector('.startup_htmlviewer_edit').textContent = "OFF"
    } else {
        const startup_htmlviewer_edit = document.querySelector('.startup_htmlviewer_edit');
        localStorage.setItem('startup_htmlviewer_edit', startup_htmlviewer_edit);
        document.querySelector('.startup_htmlviewer_edit').textContent = "ON"
    }
})

document.querySelector('.startup_speed').addEventListener('click', function () {
    if (localStorage.getItem('prompt_data2')) {
        localStorage.removeItem('prompt_data2')
        document.querySelector('.startup_speed').textContent = "LOW"
    } else {
        const prompt_data2 = document.querySelector('.startup_speed');
        localStorage.setItem('prompt_data2', prompt_data2);
        document.querySelector('.startup_speed').textContent = "HIGH"
    }
})

document.querySelector('.startup_sound').addEventListener('click', function () {
    if (localStorage.getItem('driver_sound')) {
        localStorage.removeItem('driver_sound')
        document.querySelector('.startup_sound').textContent = "INSTALL"
        document.querySelector('.installbutton_1').textContent = "install"
    } else {
        const startup_sound = document.querySelector('.startup_sound');
        localStorage.setItem('driver_sound', startup_sound);
        document.querySelector('.startup_sound').textContent = "UN INSTALL"
        document.querySelector('.installbutton_1').textContent = "uninstall"
    }
})

function font_clear() {
    localStorage.removeItem('font_default');
    localStorage.removeItem('font_sans_serif');
    localStorage.removeItem('font_cursive');
    localStorage.removeItem('font_fantasy');
    localStorage.removeItem('font_monospace');
}

document.querySelector('.font_default').addEventListener('click', function () {
    font_clear()
    if (localStorage.getItem('font_default')) {
        localStorage.removeItem('font_default');
    } else {
        const font_default = document.querySelector('.font_default');
        localStorage.setItem('font_default', font_default);
        document.querySelector("body").style.fontFamily = "serif";
    }
})

document.querySelector('.font_sans_serif').addEventListener('click', function () {
    font_clear()
    if (localStorage.getItem('font_sans_serif')) {
        localStorage.removeItem('font_sans_serif');
    } else {
        const font_sans_serif = document.querySelector('.font_sans_serif');
        localStorage.setItem('font_sans_serif', font_sans_serif);
        document.querySelector("body").style.fontFamily = "sans-serif";
    }
})

document.querySelector('.font_cursive').addEventListener('click', function () {
    font_clear()
    if (localStorage.getItem('font_cursive')) {
        localStorage.removeItem('font_cursive');
    } else {
        const font_cursive = document.querySelector('.font_cursive');
        localStorage.setItem('font_cursive', font_cursive);
        document.querySelector("body").style.fontFamily = "cursive";
    }
})

document.querySelector('.font_fantasy').addEventListener('click', function () {
    font_clear()
    if (localStorage.getItem('font_fantasy')) {
        localStorage.removeItem('font_fantasy');
    } else {
        const font_fantasy = document.querySelector('.font_fantasy');
        localStorage.setItem('font_fantasy', font_fantasy);
        document.querySelector("body").style.fontFamily = "fantasy";
    }
})

document.querySelector('.font_monospace').addEventListener('click', function () {
    font_clear()
    if (localStorage.getItem('font_monospace')) {
        localStorage.removeItem('font_monospace');
    } else {
        const font_monospace = document.querySelector('.font_monospace');
        localStorage.setItem('font_monospace', font_monospace);
        document.querySelector("body").style.fontFamily = "monospace";
    }
})

function nexser_start() {
    document.querySelector("#nexser").style.backgroundColor = "";
    document.querySelector('.test_allwindow').style.display = "none";
    document.querySelector('.welcome_windows').style.display = "none";

    document.querySelector('.focus').blur();
    document.querySelector('html').style.cursor = 'none';
    window_none();
    if (localStorage.getItem('prompt_data2')) {
        setTimeout(function () {
            console.log(largestZIndex)
            prompt.style.display = "none";
            setTimeout(function () {
                nexser.style.display = "block";
                setTimeout(function () {
                    start_check()
                    taskbar_none();
                }, 100);
            }, 100);
        }, 100)
    } else {
        setTimeout(function () {
            prompt.style.display = "none";
            setTimeout(function () {
                nexser.style.display = "block";
                setTimeout(function () {
                    start_check()
                    taskbar_none();
                }, 1500);
            }, 1500)
        }, 1500);
    }
}

Array.from(shutdown).forEach(element => {
    element.addEventListener('click', event => {
        setTimeout(() => {
            document.querySelector('.test_allwindow').style.display = "block";
            if (sessionStorage.getItem('start_camera')) {
                document.querySelector('.window_error_text').textContent = "camera no finish no shutdown!"
                error_windows.classList.remove('active')
                sound3()
                document.querySelector('.test_allwindow').style.display = "block";
            } else if (gets == gets2) {
                sound_stop();
                shutdown_sound();
                helpmenu_close();
                document.querySelector('html').style.cursor = 'none';
                if (!localStorage.getItem('noteData')) {
                    document.note_form.note_area.value = "";
                    resetShowLength();
                    document.querySelector('.note_title').textContent = "notepad"
                }
                setTimeout(() => {
                    helpmenu_close()
                    desktop.style.display = "none";
                    localStorage.removeItem('prompt_data');
                    window_reset();
                    timerstop();
                    timerreset();
                    document.querySelector('#codes').style.display = "none";
                    window_none();
                    fileborder_reset();

                    setTimeout(() => {
                        document.querySelectorAll('.button').forEach(function (button) {
                            let tscbtn = button.firstChild;
                            tscbtn = button.classList.remove('pressed');
                        });
                        document.getElementsByClassName('name')[0].value = "";
                        document.querySelector('.prompt_error_text').textContent = "";
                        document.querySelector('.help').textContent = "";
                        msg.innerText = "";
                        prompt_text.style.color = "";
                        nexser.style.display = "none";
                        prompt.style.display = "block";
                        start_menu.style.display = "none";
                        document.querySelector('.focus').focus();
                        document.querySelector('html').style.cursor = '';
                    }, 500);
                }, 1500);
            } else {
                warning_windows.style.display = "block";
                document.querySelector('.close_button3').style.display = "block"
                document.querySelector('.shutdown_button').style.display = "block";
                document.querySelector('.warningclose_button').style.display = "none";
                document.querySelector('.warning_title_text').textContent = "warning"
                document.querySelector('.window_warning_text').textContent = "task window open! shutdown?"
                sound5()
            }
        }, 500);
    })
})

Array.from(restart).forEach(element => {
    element.addEventListener('click', event => {
        setTimeout(() => {
            document.querySelector('.test_allwindow').style.display = "block";
            if (sessionStorage.getItem('start_camera')) {
                document.querySelector('.window_error_text').textContent = "camera no finish no restart!"
                error_windows.classList.remove('active')
                sound3()
                document.querySelector('.test_allwindow').style.display = "block";
            } else if (gets == gets2) {
                sound_stop();
                shutdown_sound();
                helpmenu_close();
                document.querySelector('html').style.cursor = 'none';
                if (!localStorage.getItem('noteData')) {
                    document.note_form.note_area.value = "";
                    resetShowLength();
                    document.querySelector('.note_title').textContent = "notepad"
                }
                setTimeout(() => {
                    helpmenu_close()
                    desktop.style.display = "none";
                    window_reset();
                    timerstop();
                    timerreset();
                    document.querySelector('#codes').style.display = "none";
                    window_none();
                    fileborder_reset();

                    setTimeout(() => {
                        document.querySelectorAll('.button').forEach(function (button) {
                            let tscbtn = button.firstChild;
                            tscbtn = button.classList.remove('pressed');
                        });
                        document.getElementsByClassName('name')[0].value = "";
                        document.querySelector('.prompt_error_text').textContent = "";
                        document.querySelector('.help').textContent = "";
                        msg.innerText = "";
                        prompt_text.style.color = "";
                        nexser.style.display = "none";
                        document.querySelector('.restart').style.display = "block";
                        start_menu.style.display = "none";
                    }, 500);
                    setTimeout(() => {
                        document.querySelector('.restart').style.display = "none";
                    }, 2500);
                    setTimeout(() => {
                        nexser_start()
                    }, 3500);
                }, 1500);
            } else {
                document.querySelector('.window_error_text').textContent = "window open no restart!"
                error_windows.classList.remove('active')
                prompt_text2.style.color = "";
                sound3()
                document.querySelector('.test_allwindow').style.display = "block";
            }
        }, 500);
    })
})

function start_check() {
    document.querySelector('html').style.cursor = 'none';
    if (!localStorage.getItem('start_nexser') || desktop.style.display == "block") {
        prompt.style.display = "none";
        nexser_program.style.display = "none";
        nexser.style.display = "block";
        desktop.style.display = "none"
        document.querySelector('.welcome_windows').style.display = "block";
        welcome_animation()
    } else {
        startup_sound();
        prompt.style.display = "none";
        nexser_program.style.display = "none";
        nexser.style.display = "block";
        document.querySelector('.welcome_windows').style.display = "none";
        setTimeout(() => {
            desktop.style.display = "block"
        }, 1000);
        setTimeout(() => {
            setColor()
            document.querySelector('html').style.cursor = '';
        }, 2000);
        setTimeout(() => {
            startup_window_open()
            taskbtn_load()
        }, 3000);
        taskbtn_load()
    }
}

function nexser_on() {
    setTimeout(() => {
        const start_nexser = document.querySelector('.start_nexser');
        localStorage.setItem('start_nexser', start_nexser);
        document.querySelector('.welcome_windows').style.display = ""
        setTimeout(() => {
            desktop.style.display = "block"
        }, 1000);
        setTimeout(() => {
            setColor()
            document.querySelector('html').style.cursor = '';
        }, 2000);
        setTimeout(() => {
            startup_window_open()
            taskbtn_load()
            // helpmenu_open()
        }, 3000);
    }, 100);
}

document.querySelector('.startnexser_close').addEventListener('mouseup', function () {
    setTimeout(() => {
        document.querySelector('.welcome_windows').style.display = "none"
        setTimeout(() => {
            desktop.style.display = "block"
        }, 500);
        setTimeout(() => {
            setColor()
        }, 2000);
    }, 100);
})

function welcome_animation() {
    document.querySelector('html').style.cursor = 'none';
    sound7()
    document.querySelector('.start_nexser').style.display = "none";
    document.querySelector('.startnexser_close').style.display = "none";
    document.querySelector('.welcome_window_inline').style.display = "none";
    document.querySelector('.welcome_text1').style.position = "absolute";
    document.querySelector('.welcome_text1').style.fontSize = "35px";
    document.querySelector('.welcome_text1').style.marginTop = "125px";
    document.querySelector('.welcome_text1').style.marginLeft = "50px";
    document.querySelector('.welcome_underline').style.right = "0";
    const welunder = document.querySelector('.welcome_underline');
    welunder.style.width = "0%"
    document.querySelector('.welcome_text2').style.display = "none";
    document.querySelector('.welcome_icon').style.display = "none";

    setTimeout(() => {

        setTimeout(() => {
            document.querySelector('.welcome_window_inline').style.display = "block"
            setTimeout(() => {
                document.querySelector('.welcome_text1').style.fontSize = "35px"
                document.querySelector('.welcome_text1').style.marginTop = "80px"
                document.querySelector('.welcome_text1').style.marginLeft = "25px"
            }, 1000);
            setTimeout(() => {
                document.querySelector('.welcome_text1').style.fontSize = "34px"
                document.querySelector('.welcome_text1').style.marginTop = "40px"
                document.querySelector('.welcome_text1').style.marginLeft = "15px"
            }, 1200);
            setTimeout(() => {
                document.querySelector('.welcome_text1').style.fontSize = "33px"
                document.querySelector('.welcome_text1').style.marginTop = "20px"
                document.querySelector('.welcome_text1').style.marginLeft = "10px"
            }, 1400);
            setTimeout(() => {
                document.querySelector('.welcome_text1').style.fontSize = "32px"
                document.querySelector('.welcome_text1').style.marginTop = "10px"
                document.querySelector('.welcome_text1').style.marginLeft = "5px"
            }, 1500);
            setTimeout(() => {
                document.querySelector('.welcome_text1').style.fontSize = "31px"
                document.querySelector('.welcome_text1').style.marginTop = "0px"
                document.querySelector('.welcome_text1').style.marginLeft = "0px"
            }, 1600);

            setTimeout(() => {
                welunder.style.width = "5%"
            }, 2500);
            setTimeout(() => {
                welunder.style.width = "15%"
            }, 2550);
            setTimeout(() => {
                welunder.style.width = "25%"
            }, 2600);
            setTimeout(() => {
                welunder.style.width = "35%"
            }, 2650);
            setTimeout(() => {
                welunder.style.width = "45%"
            }, 2700);
            setTimeout(() => {
                welunder.style.width = "55%"
            }, 2725);
            setTimeout(() => {
                welunder.style.width = "65%"
            }, 2750);
            setTimeout(() => {
                welunder.style.width = "75%"
            }, 2775);
            setTimeout(() => {
                welunder.style.width = "80%"
            }, 2800);
            setTimeout(() => {
                welunder.style.width = "85%"
            }, 2825);
            setTimeout(() => {
                welunder.style.width = "100%"
            }, 2850);

            setTimeout(() => {
                document.querySelector('.welcome_text2').style.display = "block";
            }, 3500);
            setTimeout(() => {
                document.querySelector('.welcome_icon').style.display = "block";
                document.querySelector('html').style.cursor = '';
            }, 4000);

            setTimeout(() => {
                if (!localStorage.getItem('start_nexser')) {
                    document.querySelector('.start_nexser').style.display = "block";
                } else {
                    document.querySelector('.start_nexser').style.display = "none";
                    document.querySelector('.startnexser_close').style.display = "block";
                }
            }, 5000);
        }, 500);

    });

}

function welcome() {
    document.querySelector('.welcome_windows').style.display = "block"
    desktop.style.display = "none";
    welcome_animation()
}

function helpmenu_open() {
    document.querySelector('.help_menu').style.display = "block"
    if (localStorage.getItem('taskbar_position_button')) {
        document.querySelector('.help_menu').style.top = "40px"
    } else if (!localStorage.getItem('taskbar_position_button')) {
        document.querySelector('.help_menu').style.top = "auto"
        document.querySelector('.help_menu').style.bottom = "0px"
    }
}
function helpmenu_close() {
    document.querySelector('.help_menu').style.display = "none"
}

startup_window_open()
function startup_window_open() {
    if (localStorage.getItem('startup_note')) {
        const element = document.querySelector('.note_pad');
        element.closest('.child_windows');
        element.classList.remove('active')
    }
    if (localStorage.getItem('startup_program')) {
        const element = document.querySelector('.program_manager');
        element.closest('.child_windows');
        element.classList.remove('active')
    }
    if (localStorage.getItem('startup_color')) {
        const element = document.querySelector('.color');
        element.closest('.child_windows');
        element.classList.remove('active')
    }
    if (localStorage.getItem('startup_screen')) {
        const element = document.querySelector('.screen_menu');
        element.closest('.child_windows');
        element.classList.remove('active')
    }
    if (localStorage.getItem('startup_htmlviewer_edit')) {
        const element = document.querySelector('.htmlviewer_edit_menu');
        element.closest('.child_windows');
        element.classList.remove('active')
    }
}

document.getElementById('sound_driver').addEventListener('click', function () {
    if (localStorage.getItem('driver_sound')) {
        localStorage.removeItem('driver_sound')
        document.querySelector('.installbutton_1').textContent = "install"
        document.querySelector('.startup_sound').textContent = "INSTALL"
    } else {
        const sound_driver = document.querySelector('#sound_driver');
        localStorage.setItem('driver_sound', sound_driver);
        document.querySelector('.installbutton_1').textContent = "uninstall"
        document.querySelector('.startup_sound').textContent = "UN INSTALL"
    }
})
document.getElementById('color_driver').addEventListener('click', function () {
    if (localStorage.getItem('driver_color')) {
        localStorage.removeItem('driver_color')
        document.querySelector('.installbutton_2').textContent = "install"
        colordata_clear();
    } else {
        const color_driver = document.querySelector('#color_driver');
        localStorage.setItem('driver_color', color_driver);
        document.querySelector('.installbutton_2').textContent = "uninstall"
    }
})

document.querySelector('.startup_1').addEventListener('click', function () {
    startupsound_reset()
    if (localStorage.getItem('startup_1')) {
        document.querySelector('.startup_1').textContent = "no set"
    } else {
        const startup_1 = document.querySelector('.startup_1');
        localStorage.setItem('startup_1', startup_1);
        document.querySelector('.startup_1').textContent = "set!"
    }
})
document.querySelector('.startup_2').addEventListener('click', function () {
    startupsound_reset()
    if (localStorage.getItem('startup_2')) {
        document.querySelector('.startup_2').textContent = "no set"
    } else {
        const startup_2 = document.querySelector('.startup_2');
        localStorage.setItem('startup_2', startup_2);
        document.querySelector('.startup_2').textContent = "set!"
    }
})
document.querySelector('.startup_3').addEventListener('click', function () {
    startupsound_reset()
    if (localStorage.getItem('startup_3')) {
        document.querySelector('.startup_3').textContent = "no set"
    } else {
        const startup_3 = document.querySelector('.startup_3');
        localStorage.setItem('startup_3', startup_3);
        document.querySelector('.startup_3').textContent = "set!"
    }
})
document.querySelector('.startup_4').addEventListener('click', function () {
    startupsound_reset()
    if (localStorage.getItem('startup_4')) {
        document.querySelector('.startup_4').textContent = "no set"
    } else {
        const startup_4 = document.querySelector('.startup_4');
        localStorage.setItem('startup_4', startup_4);
        document.querySelector('.startup_4').textContent = "set!"
    }
})
document.querySelector('.startup_5').addEventListener('click', function () {
    startupsound_reset()
    if (localStorage.getItem('startup_5')) {
        document.querySelector('.startup_5').textContent = "no set"
    } else {
        const startup_5 = document.querySelector('.startup_5');
        localStorage.setItem('startup_5', startup_5);
        document.querySelector('.startup_5').textContent = "set!"
    }
})

function startupsound_reset() {
    if (localStorage.getItem('startup_1')) {
        localStorage.removeItem('startup_1')
        document.querySelector('.startup_1').textContent = "no set"
    }
    if (localStorage.getItem('startup_2')) {
        localStorage.removeItem('startup_2')
        document.querySelector('.startup_2').textContent = "no set"
    }
    if (localStorage.getItem('startup_3')) {
        localStorage.removeItem('startup_3')
        document.querySelector('.startup_3').textContent = "no set"
    }
    if (localStorage.getItem('startup_4')) {
        localStorage.removeItem('startup_4')
        document.querySelector('.startup_4').textContent = "no set"
    }
    if (localStorage.getItem('startup_5')) {
        localStorage.removeItem('startup_5')
        document.querySelector('.startup_5').textContent = "no set"
    }
}

document.querySelector('.shutdown_1').addEventListener('click', function () {
    shutdownsound_reset()
    if (localStorage.getItem('shutdown_1')) {
        document.querySelector('.shutdown_1').textContent = "no set"
    } else {
        const shutdown_1 = document.querySelector('.shutdown_2');
        localStorage.setItem('shutdown_1', shutdown_1);
        document.querySelector('.shutdown_1').textContent = "set!"
    }
})
document.querySelector('.shutdown_2').addEventListener('click', function () {
    shutdownsound_reset()
    if (localStorage.getItem('shutdown_2')) {
        document.querySelector('.shutdown_2').textContent = "no set"
    } else {
        const shutdown_2 = document.querySelector('.shutdown_2');
        localStorage.setItem('shutdown_2', shutdown_2);
        document.querySelector('.shutdown_2').textContent = "set!"
    }
})
document.querySelector('.shutdown_3').addEventListener('click', function () {
    shutdownsound_reset()
    if (localStorage.getItem('shutdown_3')) {
        document.querySelector('.shutdown_3').textContent = "no set"
    } else {
        const shutdown_3 = document.querySelector('.shutdown_3');
        localStorage.setItem('shutdown_3', shutdown_3);
        document.querySelector('.shutdown_3').textContent = "set!"
    }
})
document.querySelector('.shutdown_4').addEventListener('click', function () {
    shutdownsound_reset()
    if (localStorage.getItem('shutdown_4')) {
        document.querySelector('.shutdown_4').textContent = "no set"
    } else {
        const shutdown_4 = document.querySelector('.shutdown_4');
        localStorage.setItem('shutdown_4', shutdown_4);
        document.querySelector('.shutdown_4').textContent = "set!"
    }
})
document.querySelector('.shutdown_5').addEventListener('click', function () {
    shutdownsound_reset()
    if (localStorage.getItem('shutdown_5')) {
        document.querySelector('.shutdown_5').textContent = "no set"
    } else {
        const shutdown_5 = document.querySelector('.shutdown_5');
        localStorage.setItem('shutdown_5', shutdown_5);
        document.querySelector('.shutdown_5').textContent = "set!"
    }
})

function shutdownsound_reset() {
    if (localStorage.getItem('shutdown_1')) {
        localStorage.removeItem('shutdown_1')
        document.querySelector('.shutdown_1').textContent = "no set"
    }
    if (localStorage.getItem('shutdown_2')) {
        localStorage.removeItem('shutdown_2')
        document.querySelector('.shutdown_2').textContent = "no set"
    }
    if (localStorage.getItem('shutdown_3')) {
        localStorage.removeItem('shutdown_3')
        document.querySelector('.shutdown_3').textContent = "no set"
    }
    if (localStorage.getItem('shutdown_4')) {
        localStorage.removeItem('shutdown_4')
        document.querySelector('.shutdown_4').textContent = "no set"
    }
    if (localStorage.getItem('shutdown_5')) {
        localStorage.removeItem('shutdown_5')
        document.querySelector('.shutdown_5').textContent = "no set"
    }
}

function windowmode_reset() {
    localStorage.removeItem('window_invisible');
    localStorage.removeItem('window_borderblack');
    localStorage.removeItem('window_titlebackcolor');
    document.querySelector('.windowmode').textContent = "default"
}

document.getElementById('window_invisible').addEventListener('click', function () {
    if (localStorage.getItem('window_invisible')) {
        localStorage.removeItem('window_invisible')
    } else {
        windowmode_reset()
        const window_invisible = document.querySelector('#window_invisible');
        localStorage.setItem('window_invisible', window_invisible);
        document.querySelector('.windowmode').textContent = "invisible"
    }
})
document.getElementById('window_borderblack').addEventListener('click', function () {
    if (localStorage.getItem('window_borderblack')) {
        localStorage.removeItem('window_borderblack')
    } else {
        windowmode_reset()
        const window_borderblack = document.querySelector('#window_borderblack');
        localStorage.setItem('window_borderblack', window_borderblack);
        document.querySelector('.windowmode').textContent = "border black"
    }
})
document.getElementById('window_titlebackcolor').addEventListener('click', function () {
    if (localStorage.getItem('window_titlebackcolor')) {
        localStorage.removeItem('window_titlebackcolor')
    } else {
        windowmode_reset()
        const window_titlebackcolor = document.querySelector('#window_titlebackcolor');
        localStorage.setItem('window_titlebackcolor', window_titlebackcolor);
        document.querySelector('.windowmode').textContent = "title backgroundcolor"
    }
})

document.getElementById('backtext_on').addEventListener('click', function () {
    const backtext = document.querySelector('#backtext_on');
    localStorage.setItem('backtext', backtext);
    const backtext_data2 = localStorage.getItem('backtext_data');
    document.querySelector('#background_text').textContent = (backtext_data2)
    document.querySelector('#background_text').classList.add('block')
})
document.getElementById('backtext_off').addEventListener('click', function () {
    localStorage.removeItem('backtext');
    document.querySelector('#background_text').classList.remove('block')
})

function all_load() {
    if (localStorage.getItem('driver_sound')) {
        document.querySelector('.installbutton_1').textContent = "uninstall"
    }
    if (localStorage.getItem('driver_color')) {
        document.querySelector('.installbutton_2').textContent = "uninstall"
    }
    if (localStorage.getItem('backtext')) {
        const backtext_data2 = localStorage.getItem('backtext_data');
        document.querySelector('#background_text').textContent = (backtext_data2)
        background_text.classList.add('block')
    }
    if (!localStorage.getItem('backtext')) {
        background_text.classList.remove('block')
    }
    if (localStorage.getItem('noteData')) {
        load()
        document.querySelector('.note_title').textContent = "notepad(save keep)"
    }
    if (localStorage.getItem('textdropdata')) {
        load2()
    }
    if (localStorage.getItem('startup_note')) {
        document.querySelector('.startup_note').textContent = "ON"
    }
    if (localStorage.getItem('startup_program')) {
        document.querySelector('.startup_program').textContent = "ON"
    }
    if (localStorage.getItem('startup_color')) {
        document.querySelector('.startup_color').textContent = "ON"
    }
    if (localStorage.getItem('startup_screen')) {
        document.querySelector('.startup_screen').textContent = "ON"
    }
    if (localStorage.getItem('startup_htmlviewer_edit')) {
        document.querySelector('.startup_htmlviewer_edit').textContent = "ON"
    }
    if (localStorage.getItem('prompt_data2')) {
        document.querySelector('.startup_speed').textContent = "HIGH"
    }
    if (localStorage.getItem('driver_sound')) {
        document.querySelector('.startup_sound').textContent = "UN INSTALL"
    }
    if (localStorage.getItem('startup_1')) {
        document.querySelector('.startup_1').textContent = "set!"
    } else {
        document.querySelector('.startup_1').textContent = "no set"
    }
    if (localStorage.getItem('startup_2')) {
        document.querySelector('.startup_2').textContent = "set!"
    } else {
        document.querySelector('.startup_2').textContent = "no set"
    }
    if (localStorage.getItem('startup_3')) {
        document.querySelector('.startup_3').textContent = "set!"
    } else {
        document.querySelector('.startup_3').textContent = "no set"
    }
    if (localStorage.getItem('startup_4')) {
        document.querySelector('.startup_4').textContent = "set!"
    } else {
        document.querySelector('.startup_4').textContent = "no set"
    }
    if (localStorage.getItem('startup_5')) {
        document.querySelector('.startup_5').textContent = "set!"
    } else {
        document.querySelector('.startup_5').textContent = "no set"
    }


    if (localStorage.getItem('shutdown_1')) {
        document.querySelector('.shutdown_1').textContent = "set!"
    } else {
        document.querySelector('.shutdown_1').textContent = "no set"
    }
    if (localStorage.getItem('shutdown_2')) {
        document.querySelector('.shutdown_2').textContent = "set!"
    } else {
        document.querySelector('.shutdown_2').textContent = "no set"
    }
    if (localStorage.getItem('shutdown_3')) {
        document.querySelector('.shutdown_3').textContent = "set!"
    } else {
        document.querySelector('.shutdown_3').textContent = "no set"
    }
    if (localStorage.getItem('shutdown_4')) {
        document.querySelector('.shutdown_4').textContent = "set!"
    } else {
        document.querySelector('.shutdown_4').textContent = "no set"
    }
    if (localStorage.getItem('shutdown_5')) {
        document.querySelector('.shutdown_5').textContent = "set!"
    } else {
        document.querySelector('.shutdown_5').textContent = "no set"
    }

    if (localStorage.getItem('note_text_bold')) {
        document.querySelector('.note_area').style.fontWeight = "bold";
        document.querySelector('.test_notetext').style.fontWeight = "bold";
    }
    if (localStorage.getItem('note_text_oblique')) {
        document.querySelector('.note_area').style.fontStyle = "oblique";
        document.querySelector('.test_notetext').style.fontStyle = "oblique";
    }
    if (localStorage.getItem('note_text_underline')) {
        document.querySelector('.note_area').style.textDecoration = "underline";
        document.querySelector('.test_notetext').style.textDecoration = "underline";
    }

    if (localStorage.getItem('window_invisible')) {
        document.querySelector('.windowmode').textContent = "invisible"
    }
    if (localStorage.getItem('window_borderblack')) {
        document.querySelector('.windowmode').textContent = "border black"
    }
    if (localStorage.getItem('window_titlebackcolor')) {
        document.querySelector('.windowmode').textContent = "title backgroundcolor"
    }

    if (localStorage.getItem('font_default')) {
        document.querySelector("body").style.fontFamily = "serif";
    }
    if (localStorage.getItem('font_sans_serif')) {
        document.querySelector("body").style.fontFamily = "sans-serif";
    }
    if (localStorage.getItem('font_cursive')) {
        document.querySelector("body").style.fontFamily = "cursive";
    }
    if (localStorage.getItem('font_fantasy')) {
        document.querySelector("body").style.fontFamily = "fantasy";
    }
    if (localStorage.getItem('font_monospace')) {
        document.querySelector("body").style.fontFamily = "monospace";
    }

    if (localStorage.getItem('clock_button')) {
        document.querySelector('.clock_button').textContent = "on"
        document.querySelector('.time').style.display = "none";
        document.querySelector('.taskbar_rightgroup').style.width = "140px"
    }
    if (localStorage.getItem('taskbar_position_button')) {
        document.querySelector('.taskbar_position_button').textContent = "bottom"
        document.getElementById('taskbar').style.top = "0px"
        document.querySelector('.child_start_menu').style.top = "40px"
        document.querySelector('.child_start_menu').style.bottom = "auto"
        document.querySelector('.battery_menu').style.top = "35px"
        document.querySelector('.battery_menu').style.bottom = "auto"
    }
    if (localStorage.getItem('toolbar_on')) {
        toolbar.style.display = "block"
    }

    sessionStorage.removeItem('start_camera')
}

function taskbtn_load() {

    document.querySelectorAll(".taskbar_buttons .test_button").forEach(function (taskbtn) {
        if (main.classList.contains('active')) {
            taskbtn.classList.remove('pressed')
        } else {
            taskbtn.classList.add('pressed')
        }
    })
    document.querySelectorAll(".taskbar_buttons .test_button2").forEach(function (taskbtn) {
        if (program.classList.contains('active')) {
            taskbtn.classList.remove('pressed')
        } else {
            taskbtn.classList.add('pressed')
        }
    })
    document.querySelectorAll(".taskbar_buttons .test_button3").forEach(function (taskbtn) {
        if (control.classList.contains('active')) {
            taskbtn.classList.remove('pressed')
        } else {
            taskbtn.classList.add('pressed')
        }
    })
    document.querySelectorAll(".taskbar_buttons .test_button4").forEach(function (taskbtn) {
        if (color_menu.classList.contains('active')) {
            taskbtn.classList.remove('pressed')
        } else {
            taskbtn.classList.add('pressed')
        }
    })
    document.querySelectorAll(".taskbar_buttons .test_button5").forEach(function (taskbtn) {
        if (system_menu.classList.contains('active')) {
            taskbtn.classList.remove('pressed')
        } else {
            taskbtn.classList.add('pressed')
        }
    })
    document.querySelectorAll(".taskbar_buttons .test_button6").forEach(function (taskbtn) {
        if (window_prompt.classList.contains('active')) {
            taskbtn.classList.remove('pressed')
        } else {
            taskbtn.classList.add('pressed')
        }
    })
    document.querySelectorAll(".taskbar_buttons .test_button7").forEach(function (taskbtn) {
        if (clock_menu.classList.contains('active')) {
            taskbtn.classList.remove('pressed')
        } else {
            taskbtn.classList.add('pressed')
        }
    })
    document.querySelectorAll(".taskbar_buttons .test_button8").forEach(function (taskbtn) {
        if (sound_menu.classList.contains('active')) {
            taskbtn.classList.remove('pressed')
        } else {
            taskbtn.classList.add('pressed')
        }
    })
    document.querySelectorAll(".taskbar_buttons .test_button9").forEach(function (taskbtn) {
        if (driver_menu.classList.contains('active')) {
            taskbtn.classList.remove('pressed')
        } else {
            taskbtn.classList.add('pressed')
        }
    })

    document.querySelectorAll(".taskbar_buttons .test_button10").forEach(function (taskbtn) {
        if (mouse_menu.classList.contains('active')) {
            taskbtn.classList.remove('pressed')
        } else {
            taskbtn.classList.add('pressed')
        }
    })

    document.querySelectorAll(".taskbar_buttons .test_button11").forEach(function (taskbtn) {
        if (screen_menu.classList.contains('active')) {
            taskbtn.classList.remove('pressed')
        } else {
            taskbtn.classList.add('pressed')
        }
    })
    document.querySelectorAll(".taskbar_buttons .test_button12").forEach(function (taskbtn) {
        if (note_pad.classList.contains('active')) {
            taskbtn.classList.remove('pressed')
        } else {
            taskbtn.classList.add('pressed')
        }
    })
    document.querySelectorAll(".taskbar_buttons .test_button13").forEach(function (taskbtn) {
        if (text_drop_menu.classList.contains('active')) {
            taskbtn.classList.remove('pressed')
        } else {
            taskbtn.classList.add('pressed')
        }
    })
}

function window_reset() {
    document.querySelectorAll('.child_windows').forEach(function (allwindow) {
        allwindow.style.left = "";
        allwindow.style.top = "";
        allwindow.style.height = "";
        allwindow.style.width = "";
        document.querySelector('.bigscreen_button').style.visibility = "visible";
        document.querySelector('.minscreen_button').style.visibility = "visible";
        document.querySelector('.minimization_button').style.visibility = "visible";
    });
}
function window_none() {
    document.querySelectorAll('.child_windows').forEach(function (allwindow_none) {
        allwindow_none.classList.add('active');
        allwindow_none.classList.remove('big');
    });
    warning_windows.style.display = "none";
    error_windows.classList.add('active');
}
function window_active() {
    document.querySelectorAll('.child_windows').forEach(function (allwindow_active) {
        allwindow_active.classList.remove('active');
        document.querySelector('.notice_menu').classList.add('active')
    });
}

function title_none() {
    if (localStorage.getItem('data_title_none')) {
        document.querySelectorAll('.title').forEach(function (title) {
            title.style.display = "none"
        })
    }
}
function title_active() {
    document.querySelectorAll('.title').forEach(function (title) {
        title.style.display = "block"
    });
}

function alldata_clear() {
    localStorage.removeItem('data_taskbar_none');
    colordata_clear()
    prompt_data_clear()
}

function localStorage_clear() {
    const locallength = localStorage.length;
    if (locallength > 0) {
        localStorage.clear();

        document.querySelector('.tests').textContent = (locallength);

        document.querySelector('.test_allwindow').style.display = "block";
        warning_windows.style.display = "block";
        document.querySelector('.shutdown_button').style.display = "block";
        document.querySelector('.warningclose_button').style.display = "none";
        document.querySelector('.warning_title_text').textContent = "localstorage"
        document.querySelector('.window_warning_text').textContent = "localstorage allremove!!"
        document.querySelector('.installbutton_1').textContent = "install"
        document.querySelector('.startup_sound').textContent = "INSTALL"
        document.querySelector('.installbutton_2').textContent = "install"

        document.querySelector('.close_button3').style.display = "none"
        document.querySelector('.taskbar_position_button').textContent = "top"
        document.getElementById('taskbar').style.top = ""
        document.querySelector('.child_start_menu').style.top = "auto"
        document.querySelector('.child_start_menu').style.bottom = ""

        document.querySelectorAll('.big').forEach(function (child_win_posi) {
            child_win_posi.style.top = "auto"
        })
    }
}

function colordata_clear() {
    document.querySelector("body").style.color = "";
    document.querySelector("#nexser").style.backgroundColor = "";
    document.querySelector(".mini_desktop").style.backgroundColor = "";
    localStorage.removeItem(KEY_COLOR, color);
    localStorage.removeItem(KEY_BKCOLOR, bkcolor);
    background_text.style.color = ""
    document.getElementById('background_text2').style.color = ""
}

function taskbar_none() {
    if (localStorage.getItem('data_taskbar_none')) {
        taskbar.style.display = "none";
        program.classList.remove('active');
    } else {
    }
}

function help_command() {
    document.querySelector('.focus').value = "nexser/open"
}

function help_command2() {
    document.querySelector('.focus').value = "nexser/program"
}

function help_command_clear() {
    document.querySelector('.focus').value = ""
}

document.addEventListener('DOMContentLoaded', pageLoad)
function pageLoad() {
    let textbox = document.querySelector('.name');
    textbox.addEventListener('keydown', enterKeyPress);

    function enterKeyPress(event) {
        if (event.key === 'Enter') {
            butotnClick()
        }
    }

    let textbox2 = document.querySelector('.name2');
    textbox2.addEventListener('keydown', enterKeyPress2);

    function enterKeyPress2(event) {
        if (event.key === 'Enter') {
            butotnClick2()
        }
    }
}

function butotnClick() {
    msg.innerText = '\b' + nameText.value + '';
    prompt_text_check();
}

function butotnClick2() {
    msg2.innerText = '\b' + nameText2.value + '';
    prompt_text_check2();
}

function prompt_text_check() {
    const prompt_text2 = document.querySelector('.focus');
    const prompt_text3 = prompt_text2.value;
    switch (prompt_text3) {
        case '':
            userelement.textContent = "";
            document.querySelector('.prompt_error_text').textContent = "";
            document.querySelector('.help').textContent = "";
            msg.innerText = "";
            prompt_text.style.color = "";
            break;
        case 'nexser/open':
            const prompt_data = document.prompt_text_form.prompt_text.value;
            localStorage.setItem('prompt_data', prompt_data);
            prompt_text.style.color = "yellow";
            document.getElementsByClassName('name')[0].value = "nexserを起動しています";
            document.querySelector('.prompt_error_text').textContent = "success";
            nexser_start();
            break;
        case 'install/fast_start':
            const prompt_data2 = document.prompt_text_form.prompt_text.value;
            localStorage.setItem('prompt_data2', prompt_data2);
            prompt_text.style.color = "";
            document.querySelector('.prompt_error_text').textContent = "高速起動システムをインストールしました";
            break;
        case 'uninstall/fast_start':
            localStorage.removeItem('prompt_data2');
            prompt_text.style.color = "";
            document.querySelector('.prompt_error_text').textContent = "高速起動システムをアンインストールしました";
            break;
        case 'nexser/program':
            const prompt_data3 = document.prompt_text_form.prompt_text.value;
            localStorage.setItem('prompt_data3', prompt_data3);
            prompt_text.style.color = "";
            document.querySelector('.prompt_error_text').textContent = "success";
            nexser_program_open()
            break;
        case 'debug':
            document.querySelector('.prompt_error_text').textContent = "";
            debug();
            document.querySelector('.help').textContent = "";
            msg.innerText = "";
            prompt_text.style.color = "";
            break;
        case 'help':
            document.querySelector('.prompt_error_text').textContent = "";
            document.querySelector('.help').textContent = "nexser/open\ntaskbar/none\ntaskbar/active";
            msg.innerText = "";
            prompt_text.style.color = "";
            break;
        case 'windows95/sound/start/play':
            document.querySelector('.prompt_error_text').textContent = "";
            sound();
            prompt_text.style.color = "";
            document.querySelector('.prompt_error_text').textContent = "";
            break;
        case 'windows95/sound/shutdown/play':
            document.querySelector('.prompt_error_text').textContent = "";
            sound2();
            prompt_text.style.color = "";
            document.querySelector('.prompt_error_text').textContent = "";
            break;
        case 'screen/full':
            document.querySelector('.prompt_error_text').textContent = "";
            full();
            prompt_text.style.color = "";
            break;
        case 'screen/min':
            document.querySelector('.prompt_error_text').textContent = "";
            min();
            prompt_text.style.color = "";
            break;
        case 'taskbar/none':
            taskbar.style.display = "none";
            document.querySelector('.prompt_error_text').textContent = "タスクバーの表示がオフになりました。";
            const data_taskbar_none = document.prompt_text_form.prompt_text.value;
            localStorage.setItem('data_taskbar_none', data_taskbar_none);
            prompt_text.style.color = "";
            taskbar_none()
            break;
        case 'taskbar/active':
            taskbar.style.display = "block";
            document.querySelector('.prompt_error_text').textContent = "タスクバーの表示がオンになりました。";
            localStorage.removeItem('data_taskbar_none');
            prompt_text.style.color = "";
            break;
        case 'nexser/code':
            document.querySelector('.prompt_error_text').textContent = "connect";
            prompt_text.style.color = "";
            document.querySelector('#codes').style.display = "block";
            break;
        case 'nexser/code/copy':
            // 文字をすべて選択
            // コピー対象をJavaScript上で変数として定義する
            var copyTarget = document.getElementById('codes');
            // コピー対象のテキストを選択する
            copyTarget.select();
            // 選択しているテキストをクリップボードにコピーする
            document.execCommand("Copy");
            document.querySelector('.prompt_error_text').textContent = "";
            document.querySelector('#codes').style.display = "none";
            document.querySelector('.focus').focus();
            break;
        case 'cpu/bench':
            document.querySelector('.prompt_error_text').textContent = "bench connect";
            prompt_text.style.color = "";
            cpubench()
            break;
        case 'windows95/open':
            document.querySelector('.prompt_error_text').textContent = "";
            window.open("https://moti5768.github.io/moti.world/windows95.html");
            prompt_text.style.color = "";
            break;
        case 'windows2000/open':
            document.querySelector('.prompt_error_text').textContent = "";
            window.open("https://moti5768.github.io/moti.world/windows%202000/windows2000_beta.html");
            prompt_text.style.color = "";
            break;
        case 'windowsystem/open':
            document.querySelector('.prompt_error_text').textContent = "";
            window.open("https://moti5768.github.io/moti.world/new%20OS/WindowSystem.html");
            prompt_text.style.color = "";
            break;
        default:
            document.querySelector('.prompt_error_text').textContent = "コマンドが違います!";
            document.querySelector('.help').textContent = "";
            msg.innerText = "";
            prompt_text.style.color = "red";
            break;
    }
}

function prompt_text_check2() {
    const prompt_text4 = document.querySelector('.focus2');
    const prompt_text5 = prompt_text4.value;
    switch (prompt_text5) {
        case '':
            document.querySelector('.prompt_error_text2').textContent = "";
            document.querySelector('.help2').textContent = "";
            msg2.innerText = "";
            prompt_text2.style.color = "";
            break;
        case 'help':
            document.querySelector('.prompt_error_text2').textContent = "";
            document.querySelector('.help2').textContent = "taskbar/none\ntaskbar/active\ntitle/none\ntitle/active";
            msg2.innerText = "";
            prompt_text2.style.color = "";
            break;
        case 'windows95/sound/start/play':
            document.querySelector('.prompt_error_text2').textContent = "";
            sound();
            prompt_text2.style.color = "";
            document.querySelector('.prompt_error_text2').textContent = "";
            break;
        case 'windows95/sound/shutdown/play':
            document.querySelector('.prompt_error_text2').textContent = "";
            sound2();
            prompt_text2.style.color = "";
            document.querySelector('.prompt_error_text2').textContent = "";
            break;
        case 'screen/full':
            document.querySelector('.prompt_error_text2').textContent = "";
            full();
            prompt_text2.style.color = "";
            break;
        case 'screen/min':
            document.querySelector('.prompt_error_text2').textContent = "";
            min();
            prompt_text2.style.color = "";
            break;
        case 'taskbar/none':
            taskbar.style.display = "none";
            document.querySelector('.prompt_error_text2').textContent = "タスクバーの表示がオフになりました。";
            const data_taskbar_none = document.prompt_text_form2.prompt_text2.value;
            localStorage.setItem('data_taskbar_none', data_taskbar_none);
            prompt_text2.style.color = "";
            taskbar_none()
            break;
        case 'taskbar/active':
            taskbar.style.display = "block";
            document.querySelector('.prompt_error_text2').textContent = "タスクバーの表示がオンになりました。";
            localStorage.removeItem('data_taskbar_none');
            prompt_text2.style.color = "";
            break;
        case 'allwindow/reset':
            document.querySelector('.prompt_error_text2').textContent = "";
            prompt_text2.style.color = "";
            window_reset()
            break;
        case 'allwindow/close':
            if (localStorage.getItem('data_taskbar_none')) {
                document.querySelector('.window_error_text').textContent = "taskbar none window close no!"
                error_windows.classList.remove('active')
                prompt_text2.style.color = "";
                sound3()
                document.querySelector('.test_allwindow').style.display = "block";
            } else {
                document.querySelector('.prompt_error_text2').textContent = "";
                prompt_text2.style.color = "";
                window_none()
                taskbtn_load()
            }
            break;
        case 'allwindow/open':
            document.querySelector('.prompt_error_text2').textContent = "";
            prompt_text2.style.color = "";
            window_active()
            taskbtn_load()
            break;
        case 'allwindow/min':
            document.querySelector('.prompt_error_text2').textContent = "";
            prompt_text2.style.color = "";
            allwindow_min()
            break;
        case 'title/none':
            document.querySelector('.prompt_error_text2').textContent = "";
            const data_title_none = document.prompt_text_form2.prompt_text2.value;
            localStorage.setItem('data_title_none', data_title_none);
            prompt_text2.style.color = "";
            title_none()
            break;
        case 'title/active':
            document.querySelector('.prompt_error_text2').textContent = "";
            localStorage.removeItem('data_title_none');
            prompt_text2.style.color = "";
            title_active()
            break;
        case 'window/font/large':
            document.querySelector('.prompt_error_text2').textContent = "";
            prompt_text2.style.color = "";
            let test_window = document.getElementsByClassName('child_windows')
            Array.from(test_window).forEach(element => {
                element.style.fontSize = "20px";
            })
            break;
        case 'window/font/reset':
            document.querySelector('.prompt_error_text2').textContent = "";
            prompt_text2.style.color = "";
            let test_window2 = document.getElementsByClassName('child_windows')
            Array.from(test_window2).forEach(element => {
                element.style.fontSize = "";
            })
            break;
        case 'cpu/bench':
            document.querySelector('.prompt_error_text2').textContent = "bench connect";
            prompt_text2.style.color = "";
            cpubench()
            break;
        case 'localstorage/clear':
            document.querySelector('.prompt_error_text2').textContent = "";
            localStorage_clear()
            prompt_text2.style.color = "";
            break;
        case 'welcome':
            document.querySelector('.prompt_error_text2').textContent = "";
            prompt_text2.style.color = "";
            welcome()
            break;

        case 'windows95/open':
            document.querySelector('.prompt_error_text2').textContent = "";
            window.open("https://moti5768.github.io/moti.world/windows95.html");
            prompt_text2.style.color = "";
            break;
        case 'windows2000/open':
            document.querySelector('.prompt_error_text2').textContent = "";
            window.open("https://moti5768.github.io/moti.world/windows%202000/windows2000_beta.html");
            prompt_text2.style.color = "";
            break;
        case 'windowsystem/open':
            document.querySelector('.prompt_error_text2').textContent = "";
            window.open("https://moti5768.github.io/moti.world/new%20OS/WindowSystem.html");
            prompt_text2.style.color = "";
            break;
        default:
            document.querySelector('.prompt_error_text2').textContent = "コマンドが違います!";
            document.querySelector('.help2').textContent = "";
            msg2.innerText = "";
            prompt_text2.style.color = "red";
            break;
    }
}

function screen_backtextload() {
    const backtext_data2 = localStorage.getItem('backtext_data');
    document.getElementById('back_text_input').textContent = backtext_data2
}

function backtext_check() {
    let backtext_data = document.back_text_form.back_text.value;
    localStorage.setItem('backtext_data', backtext_data);
    let backtext_data2 = localStorage.getItem('backtext_data');
    document.querySelector('#background_text').textContent = (backtext_data2)
}

function debug() {
    userelement.insertAdjacentHTML('afterend', '<p class="white user">BROWSER: ' + navigator.appName + '<br>'
        + 'VERSION: ' + navigator.appVersion + '<br>' + 'USER: ' + navigator.userAgent + '<br>' + 'WIDTH: ' + screen.width + '<br>'
        + 'HEIGHT: ' + screen.height + '<br>' + 'BIT: ' + screen.colorDepth + '</p>');
}
setInterval(() => {
    if (prompt.style.display == "block") {
        navigator.getBattery().then(function (battery) {
            document.querySelector('.level').innerHTML = battery.level;
            document.querySelector('.charging').innerHTML = battery.charging;
            document.querySelector('.chargingTime').innerHTML = battery.chargingTime;
            document.querySelector('.dischargingTime').innerHTML = battery.dischargingTime;
        });
        document.querySelector('.memory').textContent = (`Memory:   ${(performance.memory.usedJSHeapSize / 1024).toFixed(2)}KB`);
        document.querySelector('.memory2').textContent = (`使用可能なメモリ    ${(performance.memory.jsHeapSizeLimit / 1048576).toFixed(2)}MB`);
        document.querySelector('.memory3').textContent = (`割り当てられたメモリ  ${(performance.memory.totalJSHeapSize / 1024).toFixed(2)}KB`);
        document.querySelector('.memory4').textContent = (`現在使用中のメモリ   ${(performance.memory.usedJSHeapSize / 1024).toFixed(2)}KB`);

        const locallength = localStorage.length;
        document.querySelector('.length_localStorage').textContent = (locallength);

    } else {
        const locallength = localStorage.length;
        document.querySelector('.tests').textContent = (locallength);

        const backtext_data2 = localStorage.getItem('backtext_data');
        document.querySelector('#background_text2').textContent = (backtext_data2)

        const get = document.getElementsByClassName('child_windows');
        const get2 = document.getElementsByClassName('active');
        gets = get.length;
        gets2 = get2.length - 1;
        document.querySelector('.child_windows_length').textContent = (gets);
        document.querySelector('.active_length').textContent = (gets2);

        if (localStorage.getItem(KEY_BKCOLOR, bkcolor)) {
            document.querySelector(".mini_desktop").style.backgroundColor = bkcolor;
        }

        if (localStorage.getItem('MemoData_export')) {
            document.querySelector('.inport_icon').style.color = "white"
            document.querySelector('.inport_icon').style.background = "black"
        } else {
            document.querySelector('.inport_icon').style.color = ""
            document.querySelector('.inport_icon').style.background = ""
        }

        navigator.getBattery().then(function (battery) {
            if (battery.level == 1 && battery.charging == true) {
                document.querySelector('.task_battery').style.color = "lime"
                document.querySelector('.task_battery').style.background = "black"
            } else if (battery.charging == false) {
                document.querySelector('.task_battery').style.color = "black"
                document.querySelector('.task_battery').style.background = ""
            } else {
                document.querySelector('.task_battery').style.color = "#FF9900"
                document.querySelector('.task_battery').style.background = "black"
            }
        })
    }
}, 500);

document.querySelectorAll('.window_inline_list').forEach(function (window_inline_list) {
    window_inline_list.addEventListener('click', function () {
        taskbtn_load()
    });
})
document.querySelectorAll('.close_button').forEach(function (close_button) {
    close_button.addEventListener('mouseup', function () {
        setTimeout(() => {
            const closebutton = close_button.closest('.child_windows');
            closebutton.classList.add('active');
            taskbtn_load()
        }, 100);
    });
})
document.querySelectorAll('.close_button2').forEach(function (close_button2) {
    close_button2.addEventListener('mouseup', function () {
        setTimeout(() => {
            const closebutton2 = close_button2.closest('.error_windows');
            closebutton2.classList.add('active');
            document.querySelector('.test_allwindow').style.display = "none";
        }, 100);
    });
})
document.querySelectorAll('.close_button3').forEach(function (close_button3) {
    close_button3.addEventListener('mouseup', function () {
        setTimeout(() => {
            const closebutton3 = close_button3.closest('.warning_windows');
            closebutton3.style.display = "none"
            document.querySelector('.test_allwindow').style.display = "none";
        }, 100);
    });
})

document.querySelectorAll('.minimization_button').forEach(function (minimizationbutton) {
    minimizationbutton.addEventListener('mouseup', function () {
        setTimeout(() => {
            const minimization_button = minimizationbutton.closest('.child_windows');
            minimization_button.classList.add('active');
            taskbtn_load()
        }, 100);
    });
})
document.querySelectorAll('.bigscreen_button').forEach(function (bigscreen_button) {
    bigscreen_button.addEventListener('click', function () {
        const bigscreenbutton = bigscreen_button.closest('.child_windows');

        if (localStorage.getItem('taskbar_position_button')) {
            bigscreenbutton.style.height = ""
            bigscreenbutton.style.width = ""
            bigscreenbutton.style.top = "40px"
            bigscreenbutton.style.left = "0"
            bigscreenbutton.style.transition = "0.05s cubic-bezier(0, 0, 1, 1)"
        } else {
            bigscreenbutton.style.height = ""
            bigscreenbutton.style.width = ""
            bigscreenbutton.style.top = "0"
            bigscreenbutton.style.left = "0"
            bigscreenbutton.style.transition = "0.05s cubic-bezier(0, 0, 1, 1)"
        }
        setTimeout(() => {
            bigscreenbutton.style.transition = ""
        }, 100);
        bigscreenbutton.classList.add('big');
    });
})

document.querySelectorAll('.minscreen_button').forEach(function (minscreen_button) {
    minscreen_button.addEventListener('click', function () {
        const minscreenbutton = minscreen_button.closest('.child_windows');
        minscreenbutton.style.top = "";
        minscreenbutton.style.left = "";
        minscreenbutton.style.transition = "0.05s cubic-bezier(0, 0, 1, 1)"
        setTimeout(() => {
            minscreenbutton.classList.remove('big');
            minscreenbutton.style.transition = ""
        }, 50);
    });
})
function allwindow_min() {
    document.querySelectorAll('.child_windows').forEach(function (alliwindow_min) {
        alliwindow_min.style.top = "";
        alliwindow_min.style.left = "";
        alliwindow_min.style.transition = "0.025s cubic-bezier(0, 0, 1, 1)"
        setTimeout(() => {
            alliwindow_min.classList.remove('big');
            alliwindow_min.style.transition = ""
        }, 30);
    });
}

document.querySelectorAll('.window_left').forEach(function (window_left) {
    window_left.addEventListener('click', function () {
        const windowleft = window_left.closest('.child_windows');
        windowleft.style.left = "auto"
    });
})
document.querySelectorAll('.window_top').forEach(function (window_top) {
    window_top.addEventListener('click', function () {
        const windowtop = window_top.closest('.child_windows');
        windowtop.style.top = "auto"
    });
})

document.querySelectorAll('.window_left').forEach(function (window_left) {
    window_left.addEventListener('click', function () {
        const windowleft = window_left.closest('.child_windows');
        windowleft.style.left = "auto"
    });
})
document.querySelectorAll('.window_top_and_left').forEach(function (window_top_and_left) {
    window_top_and_left.addEventListener('click', function () {
        const windowtopleft = window_top_and_left.closest('.child_windows');
        windowtopleft.style.top = "auto"
        windowtopleft.style.left = "auto"
    });
})

document.querySelectorAll('.window_half_big').forEach(function (window_half_big) {
    window_half_big.addEventListener('click', function () {
        const windowhalfbig = window_half_big.closest('.child_windows');
        windowhalfbig.classList.remove('big')
        windowhalfbig.style.height = "55%"
        windowhalfbig.style.width = "55%"
    })
})

document.querySelectorAll('.windowsize_reset').forEach(function (windowsize_reset) {
    windowsize_reset.addEventListener('click', function () {
        let windowsizereset = windowsize_reset.closest('.child_windows');
        let shiftX = event.clientX - windowsize_reset.getBoundingClientRect().left;
        let shiftY = event.clientY - windowsize_reset.getBoundingClientRect().top;
        let top = document.querySelector('.top');
        moveAt(event.pageX, event.pageY);
        // ボールを（pageX、pageY）座標の中心に置く
        function moveAt(pageX, pageY) {
            windowsize_reset.style.left = pageX - shiftX + 'px';
            windowsize_reset.style.top = pageY - shiftY + 'px';
        }
        function onMouseMove(event) {
            moveAt(event.pageX, event.pageY);
        }
        windowsizereset.style.left = shiftX;
        windowsizereset.style.top = shiftY;
        windowsizereset.style.height = "";
        windowsizereset.style.width = "";
        windowsizereset.classList.remove('big');
    });
})

document.querySelectorAll('.notearea_big').forEach(function (notearea_big) {
    notearea_big.addEventListener('click', function () {
        const notearea = document.querySelector('.note_area');
        notearea.style.height = ""
        notearea.style.width = ""
    });
})
document.querySelectorAll('.notearea_min').forEach(function (notearea_big) {
    notearea_big.addEventListener('click', function () {
        const notearea = document.querySelector('.note_area');
        notearea.style.height = ""
        notearea.style.width = ""
        notearea.style.resize = ""
    });
})
document.querySelectorAll('.note_halfbig').forEach(function (note_halfbig) {
    note_halfbig.addEventListener('click', function () {
        const notearea = document.querySelector('.note_area');
        notearea.style.height = ""
        notearea.style.width = ""
        notearea.style.resize = "none"
    })
})
document.querySelectorAll('.note_sizereset').forEach(function (note_sizereset) {
    note_sizereset.addEventListener('click', function () {
        const notearea = document.querySelector('.note_area');
        notearea.style.resize = ""
    })
})

document.querySelectorAll('.parent_list').forEach(function (parent_list) {
    parent_list.addEventListener('mouseover', function () {
        let parentlist = parent_list.lastElementChild;
        parentlist.style.display = "flex"
        document.querySelectorAll('.parent_list').forEach(function (c_list) {
            c_list.addEventListener('mouseleave', function () {
                document.querySelectorAll('.child_list', '.active').forEach(function (cb_list) {
                    cb_list.style.display = "none";
                })
            })
        })
    })
})

document.querySelectorAll('.window_inline_menus_parent').forEach(function (parent_list) {
    parent_list.addEventListener('click', function () {
        let parentlist = parent_list.lastElementChild;
        parentlist.style.display = "flex"
        document.querySelectorAll('.window_inline_menus_parent').forEach(function (c_list) {
            c_list.addEventListener('mouseup', function () {
                document.querySelectorAll('.window_inline_menus_child', '.active').forEach(function (cb_list) {
                    cb_list.style.display = "none";
                })
            })
        })
    })
})

document.querySelectorAll('.child_windows, .child').forEach(function (z_index_child_windows) {
    z_index_child_windows.addEventListener('touchstart', function () {
        const zindexchildwindows = z_index_child_windows.closest('.child_windows');
        z = largestZIndex++;
        window_z_index = zindexchildwindows.style.zIndex = z;
        getLargestZIndex('.child_windows');
        z_index.textContent = getLargestZIndex('.child_windows');
    });
})

document.querySelectorAll('.test_button').forEach(function (test_button) {
    test_button.addEventListener('click', function () {
        main.classList.toggle('active');
        main.closest('.child_windows');
        z = largestZIndex++;
        unko = main.style.zIndex = z;
    });
});
document.querySelectorAll('.test_button2').forEach(function (test_button2) {
    test_button2.addEventListener('click', function () {
        program.classList.toggle('active');
        program.closest('.child_windows');
        z = largestZIndex++;
        unko2 = program.style.zIndex = z;
    });
});
document.querySelectorAll('.test_button3').forEach(function (test_button3) {
    test_button3.addEventListener('click', function () {
        control.classList.toggle('active');
        control.closest('.child_windows');
        z = largestZIndex++;
        unko3 = control.style.zIndex = z;
    });
});
document.querySelectorAll('.test_button4').forEach(function (test_button4) {
    test_button4.addEventListener('click', function () {
        color_menu.classList.toggle('active');
        color_menu.closest('.child_windows');
        z = largestZIndex++;
        unko4 = color_menu.style.zIndex = z;
    });
});
document.querySelectorAll('.test_button5').forEach(function (test_button5) {
    test_button5.addEventListener('click', function () {
        system_menu.classList.toggle('active');
        system_menu.closest('.child_windows');
        z = largestZIndex++;
        unko5 = system_menu.style.zIndex = z;
    });
});
document.querySelectorAll('.test_button6').forEach(function (test_button6) {
    test_button6.addEventListener('click', function () {
        window_prompt.classList.toggle('active');
        window_prompt.closest('.child_windows');
        z = largestZIndex++;
        unko6 = window_prompt.style.zIndex = z;
    });
});
document.querySelectorAll('.test_button7').forEach(function (test_button7) {
    test_button7.addEventListener('click', function () {
        clock_menu.classList.toggle('active');
        clock_menu.closest('.child_windows');
        z = largestZIndex++;
        unko7 = clock_menu.style.zIndex = z;
    });
});
document.querySelectorAll('.test_button8').forEach(function (test_button8) {
    test_button8.addEventListener('click', function () {
        sound_menu.classList.toggle('active');
        sound_menu.closest('.child_windows');
        z = largestZIndex++;
        unko8 = sound_menu.style.zIndex = z;
    });
});
document.querySelectorAll('.test_button9').forEach(function (test_button9) {
    test_button9.addEventListener('click', function () {
        driver_menu.classList.toggle('active');
        driver_menu.closest('.child_windows');
        z = largestZIndex++;
        unko9 = driver_menu.style.zIndex = z;
    });
});
document.querySelectorAll('.test_button10').forEach(function (test_button10) {
    test_button10.addEventListener('click', function () {
        mouse_menu.classList.toggle('active');
        mouse_menu.closest('.child_windows');
        z = largestZIndex++;
        unko10 = mouse_menu.style.zIndex = z;
    });
});
document.querySelectorAll('.test_button11').forEach(function (test_button11) {
    test_button11.addEventListener('click', function () {
        screen_menu.classList.toggle('active');
        screen_menu.closest('.child_windows');
        z = largestZIndex++;
        unko11 = screen_menu.style.zIndex = z;
    });
});
document.querySelectorAll('.test_button12').forEach(function (test_button12) {
    test_button12.addEventListener('click', function () {
        note_pad.classList.toggle('active');
        note_pad.closest('.child_windows');
        z = largestZIndex++;
        unko12 = note_pad.style.zIndex = z;
    });
});
document.querySelectorAll('.test_button13').forEach(function (test_button13) {
    test_button13.addEventListener('click', function () {
        text_drop_menu.classList.toggle('active');
        text_drop_menu.closest('.child_windows');
        z = largestZIndex++;
        unko13 = text_drop_menu.style.zIndex = z;
    });
});
document.querySelectorAll('.test_button14').forEach(function (test_button14) {
    test_button14.addEventListener('click', function () {
        windowmode_menu.classList.toggle('active');
        windowmode_menu.closest('.child_windows');
        z = largestZIndex++;
        unko14 = windowmode_menu.style.zIndex = z;
    });
});
document.querySelectorAll('.test_button15').forEach(function (test_button15) {
    test_button15.addEventListener('click', function () {
        accessory_menu.classList.toggle('active');
        accessory_menu.closest('.child_windows');
        z = largestZIndex++;
        unko15 = accessory_menu.style.zIndex = z;
    });
});
document.querySelectorAll('.test_button16').forEach(function (test_button16) {
    test_button16.addEventListener('click', function () {
        calc_menu.classList.toggle('active');
        calc_menu.closest('.child_windows');
        z = largestZIndex++;
        unko16 = calc_menu.style.zIndex = z;
    });
});
document.querySelectorAll('.test_button17').forEach(function (test_button17) {
    test_button17.addEventListener('click', function () {
        nexser_sound_menu.classList.toggle('active');
        nexser_sound_menu.closest('.child_windows');
        z = largestZIndex++;
        unko17 = nexser_sound_menu.style.zIndex = z;
    });
});
document.querySelectorAll('.test_button18').forEach(function (test_button18) {
    test_button18.addEventListener('click', function () {
        camera_menu.classList.toggle('active');
        camera_menu.closest('.child_windows');
        z = largestZIndex++;
        unko18 = camera_menu.style.zIndex = z;
    });
});
document.querySelectorAll('.test_button19').forEach(function (test_button19) {
    test_button19.addEventListener('click', function () {
        htmlviewer_edit_menu.classList.toggle('active');
        htmlviewer_edit_menu.closest('.child_windows');
        z = largestZIndex++;
        unko19 = htmlviewer_edit_menu.style.zIndex = z;
    });
});
document.querySelectorAll('.test_button20').forEach(function (test_button20) {
    test_button20.addEventListener('click', function () {
        htmlviewer_run_menu.classList.toggle('active');
        htmlviewer_run_menu.closest('.child_windows');
        z = largestZIndex++;
        unko20 = htmlviewer_run_menu.style.zIndex = z;
    });
});
document.querySelectorAll('.test_button21').forEach(function (test_button21) {
    test_button21.addEventListener('click', function () {
        uploadvideo_menu.classList.toggle('active');
        uploadvideo_menu.closest('.child_windows');
        z = largestZIndex++;
        unko21 = uploadvideo_menu.style.zIndex = z;
    });
});
document.querySelectorAll('.test_button22').forEach(function (test_button22) {
    test_button22.addEventListener('click', function () {
        font_menu.classList.toggle('active');
        font_menu.closest('.child_windows');
        z = largestZIndex++;
        unko22 = font_menu.style.zIndex = z;
    });
});
document.querySelectorAll('.test_button23').forEach(function (test_button23) {
    test_button23.addEventListener('click', function () {
        setting_menu.classList.toggle('active');
        setting_menu.closest('.child_windows');
        z = largestZIndex++;
        unko23 = setting_menu.style.zIndex = z;
    });
});
document.querySelectorAll('.test_button24').forEach(function (test_button24) {
    test_button24.addEventListener('click', function () {
        debug_menu.classList.toggle('active');
        debug_menu.closest('.child_windows');
        z = largestZIndex++;
        unko24 = debug_menu.style.zIndex = z;
    });
});
document.querySelectorAll('.test_button25').forEach(function (test_button25) {
    test_button25.addEventListener('click', function () {
        file_download_menu.classList.toggle('active');
        file_download_menu.closest('.child_windows');
        z = largestZIndex++;
        unko25 = file_download_menu.style.zIndex = z;
    });
});
document.querySelectorAll('.test_button26').forEach(function (test_button26) {
    test_button26.addEventListener('click', function () {
        display_menu.classList.toggle('active');
        display_menu.closest('.child_windows');
        z = largestZIndex++;
        unko26 = display_menu.style.zIndex = z;
    });
});
document.querySelectorAll('.test_button27').forEach(function (test_button27) {
    test_button27.addEventListener('click', function () {
        stopwatch_menu.classList.toggle('active');
        stopwatch_menu.closest('.child_windows');
        z = largestZIndex++;
        unko27 = stopwatch_menu.style.zIndex = z;
    });
});
document.querySelectorAll('.test_button28').forEach(function (test_button28) {
    test_button28.addEventListener('click', function () {
        comment_menu.classList.toggle('active');
        comment_menu.closest('.child_windows');
        z = largestZIndex++;
        unko28 = comment_menu.style.zIndex = z;
    });
});


document.querySelector('.time').addEventListener('click', function () {
    taskbtn_load()
})

window.onload = function () {
    // スクロールを禁止にする関数
    function disableScroll(event) {
        event.preventDefault();
    }

    document.querySelectorAll('.drag_button').forEach(function (title_click) {
        title_click.addEventListener("contextmenu", function (event) {
            event.preventDefault();
        });
    })

    document.querySelectorAll('.drag_button').forEach(function (drag) {

        let drag2 = drag.closest('.child_windows');

        //要素内のクリックされた位置を取得するグローバル（のような）変数
        var x;
        var y;

        //マウスが要素内で押されたとき、又はタッチされたとき発火
        drag.addEventListener("mousedown", mdown, false);
        drag.addEventListener("touchstart", mdown, false);

        //マウスが押された際の関数
        function mdown(e) {

            document.addEventListener('touchmove', disableScroll, { passive: false });
            document.addEventListener('mousewheel', disableScroll, { passive: false });

            //クラス名に .drag を追加
            drag2.classList.add("drag");

            //タッチデイベントとマウスのイベントの差異を吸収
            if (e.type === "mousedown") {
                var event = e;
            } else {
                var event = e.changedTouches[0];
            }

            //要素内の相対座標を取得
            x = event.pageX - drag2.offsetLeft;
            y = event.pageY - drag2.offsetTop;

            //ムーブイベントにコールバック
            document.body.addEventListener("mousemove", mmove, false);
            document.body.addEventListener("touchmove", mmove, false);
        }

        //マウスカーソルが動いたときに発火
        function mmove(e) {

            //ドラッグしている要素を取得
            var drag = document.getElementsByClassName("drag")[0];

            //同様にマウスとタッチの差異を吸収
            if (e.type === "mousemove") {
                var event = e;
            } else {
                var event = e.changedTouches[0];
            }

            //フリックしたときに画面を動かさないようにデフォルト動作を抑制
            e.preventDefault();

            //マウスが動いた場所に要素を動かす
            drag.style.top = event.pageY - y + "px";
            drag.style.left = event.pageX - x + "px";

            //マウスボタンが離されたとき、またはカーソルが外れたとき発火
            drag.addEventListener("mouseup", mup, false);
            document.body.addEventListener("mouseleave", mup, false);
            drag.addEventListener("touchend", mup, false);
            document.body.addEventListener("touchleave", mup, false);

            if (localStorage.getItem('window_titlebackcolor')) {
                document.querySelectorAll('.title').forEach(function (title) {
                    const titlebar = title.style.backgroundColor = bkcolor;
                })
            }

            // 半透明
            if (localStorage.getItem('window_invisible')) {
                document.querySelectorAll('.child_windows,.child').forEach(function (title) {
                    title.style.opacity = "0.5";
                })
            }

            // 移動してる時だけ黒枠のみ
            if (localStorage.getItem('window_borderblack')) {
                document.querySelectorAll('.child_windows').forEach(function (title) {
                    document.querySelector('iframe').style.opacity = "0";
                    title.style.background = bkcolor;
                    title.style.border = "solid 2px black";
                })
                document.querySelectorAll('.title,.title2,.title_buttons,.window_inline_list,.mini_window,button,input,textarea,p,#prompt2,.window_inline_list2').forEach(function (title) {
                    title.style.opacity = "0"
                })
            }

        }

        //マウスボタンが上がったら発火
        function mup(e) {
            var drag = document.getElementsByClassName("drag")[0];

            //ムーブベントハンドラの消去
            document.body.removeEventListener("mousemove", mmove, false);
            drag.removeEventListener("mouseup", mup, false);
            document.body.removeEventListener("touchmove", mmove, false);
            drag.removeEventListener("touchend", mup, false);

            //クラス名 .drag も消す
            drag.classList.remove("drag");
            document.removeEventListener('touchmove', disableScroll, { passive: false });
            document.removeEventListener('mousewheel', disableScroll, { passive: false });

            document.querySelectorAll('.title').forEach(function (title) {
                const titlebar = title.style.backgroundColor = "darkblue";
                window_prompt.style.background = "rgb(51, 51, 184)"
                const bsilver = document.querySelector('.back_silver');
                bsilver.style.background = "silver"
            })

            // 半透明
            document.querySelectorAll('.child_windows').forEach(function (title) {
                title.style.opacity = "";
                window_prompt.style.background = "rgb(51, 51, 184)"
                const bsilver = document.querySelector('.back_silver');
                bsilver.style.background = "silver"
            })

            // 移動してる時だけ黒枠のみ
            document.querySelectorAll('.child_windows').forEach(function (title) {
                title.style.background = "";
                title.style.border = "";
                document.querySelector('iframe').style.opacity = "";
                window_prompt.style.background = "rgb(51, 51, 184)"
                const bsilver = document.querySelector('.back_silver');
                bsilver.style.background = "silver"
            })
            document.querySelectorAll('.title,.title2,.title_buttons,.window_inline_list,.mini_window,button,input,textarea,p,#prompt2,.window_inline_list2').forEach(function (title) {
                title.style.opacity = ""
                const bsilver = document.querySelector('.back_silver');
                bsilver.style.background = "silver"
            })
        }
    })
}


window.onload = function () {
    // スクロールを禁止にする関数
    function disableScroll2(event) {
        event.preventDefault();
    }

    document.querySelectorAll('.drag_button').forEach(function (title_click) {
        title_click.addEventListener("contextmenu", function (event) {
            event.preventDefault();
        });
    })

    document.querySelectorAll('.drag_button2').forEach(function (drag) {
        let drag2 = drag.closest('#toolbar');
        //要素内のクリックされた位置を取得するグローバル（のような）変数
        var x;
        var y;
        //マウスが要素内で押されたとき、又はタッチされたとき発火
        drag.addEventListener("mousedown", mdown, false);
        drag.addEventListener("touchstart", mdown, false);
        //マウスが押された際の関数
        function mdown(e) {
            //クラス名に .drag を追加
            document.addEventListener('touchmove', disableScroll, { passive: false });
            document.addEventListener('mousewheel', disableScroll, { passive: false });

            drag2.classList.add("drag");

            //タッチデイベントとマウスのイベントの差異を吸収
            if (e.type === "mousedown") {
                var event = e;
            } else {
                var event = e.changedTouches[0];
            }
            //要素内の相対座標を取得
            x = event.pageX - drag2.offsetLeft;
            y = event.pageY - drag2.offsetTop;
            //ムーブイベントにコールバック
            document.body.addEventListener("mousemove", mmove, false);
            document.body.addEventListener("touchmove", mmove, false);
        }
        //マウスカーソルが動いたときに発火
        function mmove(e) {
            //ドラッグしている要素を取得
            var drag = document.getElementsByClassName("drag")[0];
            //同様にマウスとタッチの差異を吸収
            if (e.type === "mousemove") {
                var event = e;
            } else {
                var event = e.changedTouches[0];
            }
            //フリックしたときに画面を動かさないようにデフォルト動作を抑制
            e.preventDefault();
            //マウスが動いた場所に要素を動かす
            drag.style.top = event.pageY - y + "px";
            drag.style.left = event.pageX - x + "px";
            //マウスボタンが離されたとき、またはカーソルが外れたとき発火
            drag.addEventListener("mouseup", mup, false);
            document.body.addEventListener("mouseleave", mup, false);
            drag.addEventListener("touchend", mup, false);
            document.body.addEventListener("touchleave", mup, false);
        }
        //マウスボタンが上がったら発火
        function mup(e) {
            var drag = document.getElementsByClassName("drag")[0];
            //ムーブベントハンドラの消去
            document.body.removeEventListener("mousemove", mmove, false);
            drag.removeEventListener("mouseup", mup, false);
            document.body.removeEventListener("touchmove", mmove, false);
            drag.removeEventListener("touchend", mup, false);
            //クラス名 .drag も消す
            document.removeEventListener('touchmove', disableScroll2, { passive: false });
            document.removeEventListener('mousewheel', disableScroll2, { passive: false });
            drag.classList.remove("drag");
        }
    })
}

document.querySelector('.toolbar_on').addEventListener('click', function () {
    const toolbar_on = document.querySelector('.toolbar_on');
    localStorage.setItem('toolbar_on', toolbar_on);
    toolbar.style.display = "block"
})
document.querySelector('.toolbar_off').addEventListener('click', function () {
    localStorage.removeItem('toolbar_on');
    toolbar.style.display = "none"
})

document.querySelector('.saver_on').addEventListener('click', function () {
    const saver_on = document.querySelector('.saver_on');
    localStorage.setItem('saver_on', saver_on);
})
document.querySelector('.saver_off').addEventListener('click', function () {
    localStorage.removeItem('saver_on');
})

const KEY_COLOR = "COLOR";				// 文字色用キー
const KEY_BKCOLOR = "BKCOLOR";			// 背景色用キー

let color = null;						// 文字色
let bkcolor = null;						// 背景色

/*
 * ローカルストレージのデータチェック
 */
function getStorage() {
    // ローカルストレージに保存された内容を取得
    color = localStorage.getItem(KEY_COLOR);
    bkcolor = localStorage.getItem(KEY_BKCOLOR);

    // ローカルストレージに文字色と背景色データが保存されていれば色変更
    if (color !== null && bkcolor != null) {
        setColor();
    }
}

/*
 * ローカルストレージに色名（文字色・背景色）を保存する
 */
function setStorage() {
    localStorage.setItem(KEY_COLOR, color);
    localStorage.setItem(KEY_BKCOLOR, bkcolor);
}

function setStorage2() {
    if (localStorage.getItem('driver_color')) {
        var select = document.getElementById("select_backcolor");
        const select2 = (select.value);
        var select3 = document.getElementById("select_textcolor");
        const select4 = (select3.value);
        localStorage.setItem(KEY_BKCOLOR, select2);
        localStorage.setItem(KEY_COLOR, select4);
        getStorage()
        setColor()
    }
}

/*
 * 文字色と背景色を変更する
 */
function setColor() {
    if (localStorage.getItem('driver_color')) {
        document.querySelector("body").style.color = color;
        document.querySelector("#nexser").style.backgroundColor = bkcolor;
        document.querySelector(".mini_desktop").style.backgroundColor = bkcolor;
        if (bkcolor == "white" || bkcolor == "whitesmoke") {
            background_text.style.color = "black"
            document.getElementById('background_text2').style.color = "black"
        } else {
            background_text.style.color = ""
            document.getElementById('background_text2').style.color = ""
        }
    }
}
/*
 * 起動時にローカルストレージの内容をチェックして色を設定
 */
window.addEventListener("load", () => {
    // ボタンイベント設定
    document.getElementById("changeBtn").addEventListener("click", () => {
        if (localStorage.getItem('driver_color')) {
            // テキストボックスに入力された文字色と背景色を取得
            color = document.getElementById("color").value;
            bkcolor = document.getElementById("bkcolor").value;
            // 文字色・背景色変更
            setColor();
            // 変更した色名をストレージに保存
            setStorage();
        }
    });
    // ローカルストレージの内容をチェック
    getStorage();
});

var largestZIndex = 1;
var defaultView = document.defaultView;
var getLargestZIndex = function () {
    var func = function (queryselectorname) {
        var elems = document.querySelectorAll(queryselectorname), len = elems.length;
        for (var i = 0; i < len; i++) {
            var elem = elems[i];
            var zIndex = elem.style.zIndex;
            if (!zIndex) {
                var css = elem.currentStyle || defaultView.getComputedStyle(elem, null);
                zIndex = css ? css.zIndex : 0;
            }
            zIndex++;
            if (largestZIndex < zIndex) largestZIndex = zIndex;
        }
    };
    if (arguments.length == 0) func('*');
    else for (var i = 0; i < arguments.length; i++) func(arguments[i]);
    return largestZIndex;
};

function startup_sound() {
    if (localStorage.getItem('driver_sound')) {
        if (localStorage.getItem('startup_1')) {
            sound()
        }
        if (localStorage.getItem('startup_2')) {
            sound6()
        }
        if (localStorage.getItem('startup_3')) {
            sound8()
        }
        if (localStorage.getItem('startup_4')) {
            sound10()
        }
        if (localStorage.getItem('startup_5')) {
            sound12()
        }
    }
}

function shutdown_sound() {
    if (localStorage.getItem('driver_sound')) {
        if (localStorage.getItem('shutdown_1')) {
            sound2()
        }
        if (localStorage.getItem('shutdown_2')) {
            sound4()
        }
        if (localStorage.getItem('shutdown_3')) {
            sound9()
        }
        if (localStorage.getItem('shutdown_4')) {
            sound11()
        }
        if (localStorage.getItem('shutdown_5')) {
            sound13()
        }
    }
}

let ele = document.documentElement;
function full() {
    // 全画面表示      
    if (ele.webkitRequestFullscreen) {
        ele.webkitRequestFullscreen() // Chrome, Safari
    } else if (ele.mozRequestFullScreen) {
        ele.mozRequestFullScreen() // firefox
    } else if (ele.requestFullscreen) {
        ele.requestFullscreen() // HTML5 Fullscreen API
    } else {
        alert('未対応')
        return
    }
}
function min() {
    // 全画面表示　終了
    if (ele.webkitRequestFullscreen) {
        document.webkitCancelFullScreen() // Chrome, Safari
    } else if (ele.mozRequestFullScreen) {
        document.mozCancelFullScreen() // firefox
    } else if (ele.requestFullscreen) {
        document.exitFullscreen() // HTML5 Fullscreen API
    }
}

setInterval(() => {
    var date = new Date();
    var year = date.getFullYear();
    var month = date.getMonth() + 1;
    var day = date.getDate();
    document.querySelector('.date_day').textContent = (year + "/" + month + "/" + day + "");
    var date = new Date();
    var hours = date.getHours().toString().padStart(2, '0');
    var minutes = date.getMinutes().toString().padStart(2, '0');
    var seconds = date.getSeconds().toString().padStart(2, '0');
    var clock = document.querySelector('.date_clock');
    clock.textContent = (hours + ":" + minutes + ":" + seconds + "");
    var clock2 = document.querySelector('.date_clock2');
    clock2.textContent = (hours + ":" + minutes + ":" + seconds + "");
}, 100);

// 右クリックイベントの登録
document.getElementById("button1").addEventListener("contextmenu", function (event) {
    event.preventDefault();
    // デフォルトの右クリックメニューを無効化
    setTimeout(() => {
        document.querySelector('.mouse_right').classList.add('active');
    }, 0);
    setTimeout(() => {
        document.querySelector('.mouse_right').classList.remove('active');
    }, 500);
});

// 左クリックイベントの登録
document.getElementById("button1").addEventListener("click", function () {
    setTimeout(() => {
        document.querySelector('.mouse_left').classList.add('active');
    }, 0);
    setTimeout(() => {
        document.querySelector('.mouse_left').classList.remove('active');
    }, 500);
});

function notecolor_change_blue() {
    notecolor_remove()
    const note_textcolor_blue = document.querySelector('.notetext_blue');
    localStorage.setItem('note_textcolor_blue', note_textcolor_blue);
    notecolor_change()
}
function notecolor_change_green() {
    notecolor_remove()
    const note_textcolor_green = document.querySelector('.notetext_green');
    localStorage.setItem('note_textcolor_green', note_textcolor_green);
    notecolor_change()
}
function notecolor_change_red() {
    notecolor_remove()
    const note_textcolor_red = document.querySelector('.notetext_red');
    localStorage.setItem('note_textcolor_red', note_textcolor_red);
    notecolor_change()
}
function notecolor_change_orange() {
    notecolor_remove()
    const note_textcolor_orange = document.querySelector('.notetext_orange');
    localStorage.setItem('note_textcolor_orange', note_textcolor_orange);
    notecolor_change()
}
function notecolor_change_yellow() {
    notecolor_remove()
    const note_textcolor_yellow = document.querySelector('.notetext_yellow');
    localStorage.setItem('note_textcolor_yellow', note_textcolor_yellow);
    notecolor_change()
}

function notecolor_change() {
    if (localStorage.getItem('note_textcolor_blue')) {
        document.querySelector('.note_area').style.color = "blue";
        document.querySelector('.test_notetext').style.color = "blue";
    }
    if (localStorage.getItem('note_textcolor_green')) {
        document.querySelector('.note_area').style.color = "green";
        document.querySelector('.test_notetext').style.color = "green";
    }
    if (localStorage.getItem('note_textcolor_red')) {
        document.querySelector('.note_area').style.color = "red";
        document.querySelector('.test_notetext').style.color = "red";
    }
    if (localStorage.getItem('note_textcolor_orange')) {
        document.querySelector('.note_area').style.color = "orange";
        document.querySelector('.test_notetext').style.color = "orange";
    }
    if (localStorage.getItem('note_textcolor_yellow')) {
        document.querySelector('.note_area').style.color = "yellow";
        document.querySelector('.test_notetext').style.color = "yellow";
    }
}

function notecolor_remove() {
    localStorage.removeItem('note_textcolor_blue')
    localStorage.removeItem('note_textcolor_green')
    localStorage.removeItem('note_textcolor_red')
    localStorage.removeItem('note_textcolor_orange')
    localStorage.removeItem('note_textcolor_yellow')
    document.querySelector('.note_area').style.color = "";
    document.querySelector('.test_notetext').style.color = "";
}

function notetext_all_bold() {
    var Note = document.querySelector('.note_area');
    const note_text_bold = document.querySelector('.notetext_bold');
    localStorage.setItem('note_text_bold', note_text_bold);
    if (localStorage.getItem('note_text_bold') && Note.style.fontWeight == "normal") {
        Note.style.fontWeight = "bold";
        document.querySelector('.test_notetext').style.fontWeight = "bold";
    } else if (localStorage.getItem('note_text_bold') && Note.style.fontWeight == "bold") {
        Note.style.fontWeight = "normal";
        document.querySelector('.test_notetext').style.fontWeight = "normal";
        localStorage.removeItem('note_text_bold')
    } else {
        Note.style.fontWeight = "bold";
        document.querySelector('.test_notetext').style.fontWeight = "bold";
    }
}

function notetext_all_oblique() {
    var Note = document.querySelector('.note_area');
    const note_text_oblique = document.querySelector('.notetext_oblique');
    localStorage.setItem('note_text_oblique', note_text_oblique);
    if (localStorage.getItem('note_text_oblique') && Note.style.fontStyle == "normal") {
        Note.style.fontStyle = "oblique";
        document.querySelector('.test_notetext').style.fontStyle = "oblique";
    } else if (localStorage.getItem('note_text_oblique') && Note.style.fontStyle == "oblique") {
        Note.style.fontStyle = "normal";
        document.querySelector('.test_notetext').style.fontStyle = "normal";
        localStorage.removeItem('note_text_oblique')
    } else {
        Note.style.fontStyle = "oblique";
        document.querySelector('.test_notetext').style.fontStyle = "oblique";
    }
}

function notetext_all_underline() {
    var Note = document.querySelector('.note_area');
    const note_text_underline = document.querySelector('.notetext_underline');
    localStorage.setItem('note_text_underline', note_text_underline);
    if (Note.style.textDecoration == "none" && localStorage.getItem('note_text_underline')) {
        Note.style.textDecoration = "underline";
        document.querySelector('.test_notetext').style.textDecoration = "underline";
    } else if (Note.style.textDecoration == "underline" && localStorage.getItem('note_text_underline')) {
        Note.style.textDecoration = "none";
        document.querySelector('.test_notetext').style.textDecoration = "none";
        localStorage.removeItem('note_text_underline')
    } else {
        Note.style.textDecoration = "underline";
        document.querySelector('.test_notetext').style.textDecoration = "underline";
    }
}

// 保存
function save() {
    if (note_form.note_area.value === "") {
        document.querySelector('.window_error_text').textContent = "text none not save!"
        error_windows.classList.remove('active')
        sound3()
        document.querySelector('.test_allwindow').style.display = "block";
    } else {
        let noteData = document.note_form.note_area.value;
        localStorage.setItem('noteData', noteData);
        const memo_save = document.getElementById('memo_save_text');
        memo_save.textContent = "save!";
        document.querySelector('.note_title').textContent = "notepad(save)"
    }
}

function save2() {
    let textdropdata = document.drop_form.drop_area.value;
    localStorage.setItem('textdropdata', textdropdata);
    const memo_save2 = document.getElementById('drop_save_text');
    memo_save2.textContent = "drop text data save!";
}

document.querySelector('.note_close').addEventListener('mouseup', function () {
    setTimeout(() => {
        if (!note_pad.classList.contains('active') && localStorage.getItem('noteData')) {
            note_pad.classList.add('active')
            taskbtn_load()
        } else {
            document.querySelector('.warning_title_text').textContent = "notepad"
            document.querySelector('.window_warning_text').textContent = "notepad no save window close?(text allremove)"
            warning_windows.style.display = "block"
            document.querySelector('.close_button3').style.display = "block"
            sound5()
            document.querySelector('.test_allwindow').style.display = "block";
            document.querySelector('.shutdown_button').style.display = "none";
            document.querySelector('.warningclose_button').style.display = "block";
        }
    }, 100);
})

document.querySelector('.camera_close').addEventListener('mouseup', function () {
    setTimeout(() => {
        if (!sessionStorage.getItem('start_camera')) {
            camera_menu.classList.add('active')
            taskbtn_load()
        } else if (sessionStorage.getItem('start_camera')) {
            document.querySelector('.window_error_text').textContent = "camera no finish no close!"
            error_windows.classList.remove('active')
            sound3()
            document.querySelector('.test_allwindow').style.display = "block";
        }
    }, 100);
})

function warning_windows_close() {
    setTimeout(() => {
        warning_windows.style.display = "none";
        document.querySelector('.test_allwindow').style.display = "none";
        document.querySelector('.shutdown_button').style.display = "block";
        document.querySelector('.warningclose_button').style.display = "none";
        document.querySelector('.close_button3').style.display = "block"
        document.note_form.note_area.value = "";
        resetShowLength()
        note_pad.classList.add('active')
        taskbtn_load()
    }, 100);
}

function notedata_clear() {
    localStorage.removeItem('noteData');
    const memo_save = document.getElementById('memo_save_text');
    memo_save.textContent = "";
    document.querySelector('.note_title').textContent = "notepad"
}
document.getElementById('cleartextbtn').addEventListener('click', function () {
    document.getElementsByClassName("note_area")[0].value = '';
    const memo_save = document.getElementById('memo_save_text');
    memo_save.textContent = "";
    resetShowLength();
});
document.getElementById('cleartextbtn2').addEventListener('click', function () {
    localStorage.removeItem('textdropdata');
    document.querySelector(".drop_area").value = '';
    const memo_save2 = document.getElementById('drop_save_text');
    memo_save2.textContent = "";
});
function resetShowLength() {
    document.getElementById("inputlength").innerHTML = "0";
}

// 文字を入力する要素
const note_area = document.querySelector(".note_area");
// 文字数を表示する要素
const textCountElement = document.querySelector("#inputlength");

// キーボードで入力する場合
note_area.addEventListener("keyup", onChange);
note_area.addEventListener("keyup", notetitle);

// ペーストした場合
note_area.addEventListener("paste", () => {
    setTimeout(onChange, 10)
});

function notetitle() {
    notedata_clear()
    document.querySelector('.note_title').textContent = "*notepad";
}

function onChange() {
    let spaceCount = 0;
    const inputText = Array.from(note_area.value);
    const textCount = inputText.length;
    // 正規表現で空白を数をカウント
    inputText.forEach(space => {
        if (space.match(/\s/)) {
            spaceCount++
        }
    });

    const memo_save = document.getElementById('memo_save_text');
    memo_save.textContent = "";
    if (!localStorage.getItem('noteData')) {
        document.querySelector('.note_title').textContent = "notepad"
    }
    // 文字数を表示
    textCountElement.innerHTML = textCount - spaceCount;
}

function load() {
    let noteData = "";
    if (!localStorage.getItem('noteData')) {
        noteData = "メモは登録されていません。";
        setTimeout(() => {
            onChange()
        }, 100);
    }
    else {
        noteData = localStorage.getItem('noteData');
        setTimeout(() => {
            onChange()
        }, 100);
    }
    document.note_form.note_area.value = noteData;
    const memo_save = document.getElementById('memo_save_text');
    memo_save.textContent = "";
}

function win2000_load() {
    if (localStorage.getItem('MemoData_export')) {
        const old_windows_data = localStorage.getItem('MemoData_export');
        const a = document.querySelector('.note_area');
        a.textContent = (old_windows_data)
        localStorage.removeItem('MemoData_export')

        notice_menu.style.left = "0px"
        notice_menu.classList.remove('active')

        setTimeout(() => {
            notice_menu.classList.add('active')
        }, 5000);
    } else {
        document.querySelector('.window_error_text').textContent = "windows2000 textdata no!"
        error_windows.classList.remove('active')
        sound3();
        document.querySelector('.test_allwindow').style.display = "block";
    }
}

function load2() {
    let textdropdata = "";
    if (!localStorage.getItem('textdropdata')) {
        textdropdata = "";
        const memo_save2 = document.getElementById('drop_save_text');
        memo_save2.textContent = "";
    } else {
        textdropdata = localStorage.getItem('textdropdata');
        const memo_save2 = document.getElementById('drop_save_text');
        memo_save2.textContent = "text data save keep";
    }
    document.drop_form.drop_area.value = textdropdata;
}


let dr = document.querySelector('#drop');
// 要素の移動イベント
dr.addEventListener('dragover', function (evt) {
    //ブラウザのデフォルト動作を無効化する
    evt.preventDefault();
});
//ドロップ枠(DropZone)のdropイベント
dr.addEventListener('drop', function (evt) {
    if (!localStorage.getItem('textdropdata')) {
        //ブラウザのデフォルト動作を無効化する
        evt.preventDefault();
        evt.target.textContent = evt.dataTransfer.getData('text');
    } else {
        document.querySelector('.window_error_text').textContent = "textdata save & text drag no!"
        error_windows.classList.remove('active')
        sound3();
        document.querySelector('.test_allwindow').style.display = "block";
    }
});

var calc_result = document.getElementById("result");
function edit(calc_elem) {
    calc_result.value = calc_result.value + calc_elem.value;
}
function calc() {
    calc_result.value = new Function("return " + calc_result.value)();
    const child_graph = document.querySelector(".child_graph");
    child_graph.style.height = new Function("return " + calc_result.value)() / 100 + '%';
    child_graph.style.background = "lime"
    if (calc_result.value > 10000) {
        child_graph.style.height = "100%"
        child_graph.style.background = "red";
    }
    if (calc_result.value == 10000) {
        child_graph.style.background = "blue";
    }
    if (calc_result.value < 0) {
        child_graph.style.height = "100%"
        child_graph.style.background = "black";
    }
}

function calc2() {
    calc_result.value = new Function("return " + calc_result.value)();
    const child_graph = document.querySelector(".child_graph");
    calc_result.value = Math.round(calc_result.value);
    calc()
}

function calc_clear() {
    const child_graph = document.querySelector(".child_graph");
    child_graph.style.height = "0%"
    child_graph.style.background = "";
    calc_result.value = "";
}

document.querySelectorAll('.window_inline_list').forEach(function (window_inline_list) {
    window_inline_list.style.columnCount = "1";
});
document.querySelectorAll('.window_file_icon, .window_file_icon2').forEach(function (window_file_icon) {
    window_file_icon.style.width = "30px";
    window_file_icon.style.height = "20px";
    window_file_icon.style.marginBottom = "-20px";
});
document.querySelectorAll('.window_files').forEach(function (window_files) {
    window_files.style.paddingTop = "10px"
    let sss = window_files.firstElementChild;
    sss2 = sss.style.paddingLeft = "50px"
});


document.querySelector('.clock_button').addEventListener('click', function () {
    if (localStorage.getItem('clock_button')) {
        localStorage.removeItem('clock_button')
        document.querySelector('.clock_button').textContent = "off"
        document.querySelector('.time').style.display = "block"

        document.querySelector('.taskbar_rightgroup').style.width = ""
    } else {
        const clock_button = document.querySelector('.clock_button');
        localStorage.setItem('clock_button', clock_button);
        document.querySelector('.clock_button').textContent = "on"
        document.querySelector('.time').style.display = "none";

        document.querySelector('.taskbar_rightgroup').style.width = "140px"
    }
})


document.querySelector('.taskbar_position_button').addEventListener('click', function () {
    if (localStorage.getItem('taskbar_position_button')) {
        localStorage.removeItem('taskbar_position_button')

        document.querySelector('.taskbar_position_button').textContent = "top"
        document.getElementById('taskbar').style.top = ""
        document.querySelector('.child_start_menu').style.top = "auto"
        document.querySelector('.child_start_menu').style.bottom = ""

        document.querySelector('.battery_menu').style.top = "auto"
        document.querySelector('.battery_menu').style.bottom = ""

        document.querySelectorAll('.big').forEach(function (child_win_posi) {
            child_win_posi.style.top = "auto"
        })

    } else {
        const taskbar_position_button = document.querySelector('.taskbar_position_button');
        localStorage.setItem('taskbar_position_button', taskbar_position_button);

        document.querySelector('.taskbar_position_button').textContent = "bottom"
        document.getElementById('taskbar').style.top = "0px"
        document.querySelector('.child_start_menu').style.top = "40px"
        document.querySelector('.child_start_menu').style.bottom = "auto"

        document.querySelector('.battery_menu').style.top = "35px"
        document.querySelector('.battery_menu').style.bottom = "auto"

        document.querySelectorAll('.big').forEach(function (child_win_posi) {
            child_win_posi.style.top = "40px"
        })

    }
})

document.querySelectorAll('.window_files').forEach(function (window_files) {
    window_files.addEventListener('mousedown', function () {
        fileborder_reset()
    })
    window_files.addEventListener('mouseup', function () {
        fileborder_reset()
        window_files.classList.add('file_border');
    })
})

function fileborder_reset() {
    document.querySelectorAll('.window_files').forEach(function (window_files) {
        window_files.classList.remove('file_border');
    })
}

setInterval(() => {
    navigator.getBattery().then(function (battery) {
        let bu = document.querySelector('.taskbattery');
        bu2 = bu.innerHTML = Math.floor(battery.level * 100);
    });
    navigator.getBattery().then((battery) => {
        document.querySelector('.battery_time').textContent = (`${battery.dischargingTime}`);
    })
}, 1000);


async function startCamera() {
    const start_camera = document.querySelector('#start_camera');
    sessionStorage.setItem('start_camera', start_camera);
    const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
            facingMode: 'environment',

            aspectRatio: {
                exact: 1.6,
            },
        },
        audio: true,
    });
    videoElement.autoplay = true;
    videoElement.srcObject = cameraStream;
    videoElement.addEventListener("resize", () => {
        videoElement.videowidth = videoElement.videoWidth;
        videoElement.videoheight = videoElement.videoHeight;
    });
}

const videoElement = document.getElementById("v")
function startCamera2() {
    startCamera()
}

function stopCamera() {
    sessionStorage.removeItem('start_camera');
    const tracks = document.getElementById('v').srcObject.getTracks();
    tracks.forEach(track => {
        track.stop();
    });
    document.getElementById('v').srcObject = null;
}

const editor = document.getElementById("editor");
const preview = document.getElementById("preview");

function run() {
    document.querySelectorAll('.htmlviewer_run_menu').forEach(function (htmlviewer_run_menu) {
        htmlviewer_run_menu.closest('.child_windows');
        htmlviewer_run_menu.classList.remove('active');
        z = largestZIndex + 1;
        unko20 = htmlviewer_run_menu.style.zIndex = z;
    });
    preview.srcdoc = editor.value;
}

function testcode_save() {
    localStorage.setItem('editor', editor.value);
}
const editor2 = localStorage.getItem('editor');
editor.textContent = (editor2)

function testcode_html() {
    localStorage.removeItem('editor');
    editor.value = '<!DOCTYPE html>\n<html>\n<head>\n<title>document</title>\n</head>\n<body>\n<button onclick="test()">a</button>\n<script>\nfunction test(){\nalert()\n}\n< (この()は消してね　消さないと動作しません) /script>\n< (この()は消してね　消さないと動作しません) /body>\n</html>'
}

function preview2(obj, previewId) {
    let fileReader = new FileReader();
    fileReader.onload = (function () {
        document.getElementById(previewId).src = fileReader.result;
    });
    fileReader.readAsDataURL(obj.files[0]);
}

function cpubench() {
    start = (new Date()).getTime();
    n = 0;
    for (i = 0; i < 25000; i++) {
        for (j = 0; j < 25000; j++) {
            n = (n + i) / j;
        }
    }
    end = (new Date()).getTime();
    cputime = (end - start) / 1000;
    alert('計算時間は' + cputime + '秒でした');
}


const exportedData = localStorage.getItem("noteData");
const exportedData2 = localStorage.getItem("BKCOLOR");
const exportedData3 = localStorage.getItem("COLOR");
const exportedData4 = localStorage.getItem("driver_color");
const exportedData5 = localStorage.getItem("driver_sound");

document.getElementById("download").addEventListener("click", function () {
    if (localStorage.getItem("noteData")) {
        const blob = new Blob([exportedData], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "nexser_NOTEDATA.nex";
        a.click();
        URL.revokeObjectURL(url);
    }

    if (localStorage.getItem("BKCOLOR")) {
        const blob2 = new Blob([exportedData2], { type: "text/plain" });
        const url2 = URL.createObjectURL(blob2);
        const a2 = document.createElement("a");
        a2.href = url2;
        a2.download = "nexser_BKCOLOR.nex";
        a2.click();
        URL.revokeObjectURL(url2);
    }

    if (localStorage.getItem("COLOR")) {
        const blob3 = new Blob([exportedData3], { type: "text/plain" });
        const url3 = URL.createObjectURL(blob3);
        const a3 = document.createElement("a");
        a3.href = url3;
        a3.download = "nexser_COLOR.nex";
        a3.click();
        URL.revokeObjectURL(url3);
    }

    if (localStorage.getItem("driver_color")) {
        const blob4 = new Blob([exportedData4], { type: "text/plain" });
        const url4 = URL.createObjectURL(blob4);
        const a4 = document.createElement("a");
        a4.href = url4;
        a4.download = "nexser_DRIVER_COLOR.nex";
        a4.click();
        URL.revokeObjectURL(url4);
    }

    if (localStorage.getItem("driver_sound")) {
        const blob5 = new Blob([exportedData5], { type: "text/plain" });
        const url5 = URL.createObjectURL(blob5);
        const a5 = document.createElement("a");
        a5.href = url5;
        a5.download = "nexser_DRIVER_SOUND.nex";
        a5.click();
        URL.revokeObjectURL(url5);
    }

});


function fileChanged(input) {
    for (let i = 0; i < input.files.length; i++) {
        const file = input.files[i];
        const reader = new FileReader(exportedData);
        reader.readAsText(file, 'UTF-8');
        reader.onload = () => {
            console.log(reader.result);
            localStorage.setItem("noteData", reader.result)// JavaScriptオブジェクトとして表示
        };
        setTimeout(() => {
            load()
        }, 1000);
    }
}
function fileChanged2(input) {
    for (let i = 0; i < input.files.length; i++) {
        const file2 = input.files[i];
        const reader2 = new FileReader(exportedData2);
        reader2.readAsText(file2, 'UTF-8');
        reader2.onload = () => {
            console.log(reader2.result);
            localStorage.setItem("BKCOLOR", reader2.result) // JavaScriptオブジェクトとして表示
            setTimeout(() => {
                getStorage();
                setStorage()
                setColor()
            }, 1000);
        };
    }
}
function fileChanged3(input) {
    for (let i = 0; i < input.files.length; i++) {
        const file3 = input.files[i];
        const reader3 = new FileReader(exportedData3);
        reader3.readAsText(file3, 'UTF-8');
        reader3.onload = () => {
            console.log(reader3.result);
            localStorage.setItem("COLOR", reader3.result) // JavaScriptオブジェクトとして表示
            setTimeout(() => {
                getStorage();
                setStorage()
                setColor()
            }, 1000);
        };
    }
}
function fileChanged4(input) {
    for (let i = 0; i < input.files.length; i++) {
        const file4 = input.files[i];
        const reader4 = new FileReader(exportedData4);
        reader4.readAsText(file4, 'UTF-8');
        reader4.onload = () => {
            console.log(reader4.result);
            localStorage.setItem("driver_color", reader4.result) // JavaScriptオブジェクトとして表示
            document.querySelector('.installbutton_2').textContent = "uninstall"
            setTimeout(() => {
                getStorage();
                setStorage()
                setColor()
            }, 1000);
        };
    }
}
function fileChanged5(input) {
    for (let i = 0; i < input.files.length; i++) {
        const file5 = input.files[i];
        const reader5 = new FileReader(exportedData4);
        reader5.readAsText(file5, 'UTF-8');
        reader5.onload = () => {
            console.log(reader5.result);
            localStorage.setItem("driver_sound", reader5.result) // JavaScriptオブジェクトとして表示
            document.querySelector('.installbutton_1').textContent = "uninstall"
        };
    }
}

(function () {
    //60秒 * 3 = 180  (3分)
    const sec = 180;
    const events = ['keydown', 'mousemove', 'mousedown'];
    let timeoutId;

    // タイマー設定
    function setTimer() {
        timeoutId = setTimeout(server, sec * 1000);
    }
    function resetTimer() {
        clearTimeout(timeoutId);
        setTimer();
        if (screen_saver_group.style.display == "block") {
            document.querySelector('html').style.cursor = '';
            document.querySelector('.screen_saver1').style.display = "none"
        }
    }

    // イベント設定
    function setEvents(func) {
        let len = events.length;
        while (len--) {
            addEventListener(events[len], func, false);
        }
    }

    // ログアウト
    function server() {
        if (screen_saver_group.style.display == "none" || desktop.style.display == "block" && localStorage.getItem('saver_on')) {
            screen_saver_group.style.display = "block"
            document.querySelector('html').style.cursor = 'none';
            document.querySelector('.screen_saver1').style.display = "block"
            console.log("saver")

        } else {
            console.log("saver no!")
        }
    }

    setTimer();
    setEvents(resetTimer);
})();

const time = document.getElementById('time');
const startButton = document.getElementById('start');
const stopButton = document.getElementById('stop');
const resetButton = document.getElementById('reset');

// 開始時間
let startTime;
// 停止時間
let stopTime = 0;
// タイムアウトID
let timeoutID;

// 時間を表示する関数
function displayTime() {
    const currentTime = new Date(Date.now() - startTime + stopTime);
    const h = String(currentTime.getHours() - 9).padStart(2, '0');
    const m = String(currentTime.getMinutes()).padStart(2, '0');
    const s = String(currentTime.getSeconds()).padStart(2, '0');
    const ms = String(currentTime.getMilliseconds()).padStart(3, '0');

    time.textContent = `${h}:${m}:${s}.${ms}`;
    timeoutID = setTimeout(displayTime, 10);
}

// スタートボタンがクリックされたら時間を進める
startButton.addEventListener('click', () => {
    startButton.disabled = true;
    stopButton.disabled = false;
    resetButton.disabled = true;
    startTime = Date.now();
    displayTime();
});

// ストップボタンがクリックされたら時間を止める
stopButton.addEventListener('click', function () {
    timerstop()
});

// リセットボタンがクリックされたら時間を0に戻す
resetButton.addEventListener('click', function () {
    timerreset()
});

function timerstop() {
    startButton.disabled = false;
    stopButton.disabled = true;
    resetButton.disabled = false;
    clearTimeout(timeoutID);
    stopTime += (Date.now() - startTime);
}
function timerreset() {
    startButton.disabled = false;
    stopButton.disabled = true;
    resetButton.disabled = true;
    time.textContent = '00:00:00.000';
    stopTime = 0;
}