var supportsPassive = false; try { var opts = Object.defineProperty({}, 'passive', { get: function () { supportsPassive = true; } }); window.addEventListener("testPassive", null, opts); window.removeEventListener("testPassive", null, opts); } catch (e) { }

const ua = navigator.userAgent.toLowerCase();
if (ua.includes("mobile")) {
    // Mobile (iPhone、iPad「Chrome、Edge」、Android)
} else if (ua.indexOf("ipad") > -1 || (ua.indexOf("macintosh") > -1 && "ontouchend" in document)) {
    // Mobile (iPad「Safari」)
} else {
    const shutdown = document.getElementsByClassName('shutdown');
    const restart = document.getElementsByClassName('restart');

    const nexser_guidebook_menu = document.querySelector('.nexser_guidebook_menu');
    const guidebook_window_menu = document.querySelector('.guidebook_window_menu');
    const guidebook_file_menu = document.querySelector('.guidebook_file_menu');
    const guidebook_taskbar_menu = document.querySelector('.guidebook_taskbar_menu');

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
    const nexser = document.getElementById('nexser');
    const nexser_program = document.getElementById('nexser_program');
    const desktop = document.getElementById('desktop');
    const z_index = document.querySelector('.z_index');

    // soft_windows
    const main = document.querySelector('.main');
    const my_computer = document.querySelector('.my_computer');
    const control = document.querySelector('.control_panel');
    const color_menu = document.querySelector('.color');
    const system_menu = document.querySelector('.system_menu');
    const window_prompt = document.querySelector('.window_prompt');
    const clock_menu = document.querySelector('.clock_menu');
    const sound_menu = document.querySelector('.sound_menu');
    const driver_menu = document.querySelector('.driver_menu');
    const mouse_menu = document.querySelector('.mouse_menu');
    const screen_text_menu = document.querySelector('.screen_text_menu');
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
    const objective_menu = document.querySelector('.objective_menu');
    const calendar_menu = document.querySelector('.calendar_menu');
    const browser_menu = document.querySelector('.browser_menu');

    const cpu_calc_menu = document.querySelector('.cpu_calc_menu');

    const command_help_menu = document.querySelector('.command_help_menu')

    const notice_menu = document.querySelector('.notice_menu');

    const error_windows = document.querySelector('.error_windows');
    const warning_windows = document.querySelector('.warning_windows');

    // game

    const tetris_mneu = document.querySelector('.tetris_menu');

    let sound_1, sound_2, sound_3, sound_4, sound_5, sound_6, sound_7, sound_8, sound_9, sound_10, sound_11, sound_12, sound_13;

    sound_1 = new Audio("//github.com/moti5768/nexser/raw/main/nexser_sounds/The-Microsoft-Sound.mp3");
    sound_2 = new Audio("//github.com/moti5768/nexser/raw/main/nexser_sounds/tada.mp3");
    sound_3 = new Audio("//github.com/moti5768/nexser/raw/main/nexser_sounds/chord.mp3");
    sound_4 = new Audio("//github.com/moti5768/nexser/raw/main/nexser_sounds/chimes.mp3");
    sound_5 = new Audio("//github.com/moti5768/nexser/raw/main/nexser_sounds/ding.mp3");
    sound_6 = new Audio("//github.com/moti5768/nexser/raw/main/nexser_sounds/utopia.mp3");
    sound_7 = new Audio("//github.com/moti5768/nexser/raw/main/nexser_sounds/welcome.mp3");
    sound_8 = new Audio("//github.com/moti5768/nexser/raw/main/nexser_sounds/windows98.start.mp3");
    sound_9 = new Audio("//github.com/moti5768/nexser/raw/main/nexser_sounds/windows98.logoff.mp3");
    sound_10 = new Audio("//github.com/moti5768/nexser/raw/main/nexser_sounds/windows2000_startup.mp3");
    sound_11 = new Audio("//github.com/moti5768/nexser/raw/main/nexser_sounds/windows2000_shutdown.mp3");
    sound_12 = new Audio("//github.com/moti5768/nexser/raw/main/nexser_sounds/windowsxp_startup.mp3");
    sound_13 = new Audio("//github.com/moti5768/nexser/raw/main/nexser_sounds/windowsxp_shutdown.mp3");

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

        document.querySelectorAll('.sound_play_button').forEach(function (sound_play_button2) {
            sound_play_button2.textContent = "▶"
        })
    }

    console.log(location.href);

    document.querySelectorAll('.sound_play_button').forEach(function (sound_play_button2) {
        sound_play_button2.textContent = "▶"
    })
    document.querySelectorAll('.sound_play_button').forEach(function (sound_play_button) {
        sound_play_button.addEventListener('mousedown', function () {
            sound_stop()
            document.querySelectorAll('.sound_play_button').forEach(function (sound_play_button2) {
                sound_play_button2.textContent = "▶"
            })
        })
        sound_play_button.addEventListener('click', function () {
            if (!localStorage.getItem('driver_sound')) {
                document.querySelector('.window_error_text').textContent = "driver sound no install!"
                error_windows.classList.remove('active')
                prompt_text2.style.color = "";
                sound3()
                document.querySelector('.test_allwindow').style.display = "block";
                sound_play_button2.textContent = "▶"
            } else {
                sound_play_button.textContent = "||"
            }
        })
    })
    document.querySelectorAll('.sound_stop_button').forEach(function (sound_stop_button) {
        sound_stop_button.addEventListener('mousedown', function () {
            sound_stop()
            document.querySelectorAll('.sound_play_button').forEach(function (sound_play_button2) {
                sound_play_button2.textContent = "▶"
            })
        })
    })

    document.querySelector('#prompt').addEventListener('click', function () {
        document.querySelector('.focus').focus();
    })

    document.getElementById('startbtn').addEventListener('mousedown', function () {
        document.querySelectorAll('.desktop_files').forEach(function (df1) {
            const file10 = df1.firstElementChild;
            file10.classList.remove('file_select');
        })
        if (start_menu.style.display == "block") {
            // noneで非表示
            start_menu.style.display = "none";
            document.querySelector('.start_button').classList.remove('pressed')
        } else {
            // blockで表示
            start_menu.style.display = "block";
            document.querySelector('.start_button').classList.add('pressed');
            document.querySelector('.battery_menu').style.display = "none";
            document.querySelector('.battery_child').classList.remove('pressed');
        }
    })
    document.querySelector('.battery_child').addEventListener('click', function () {
        if (document.querySelector('.battery_menu').style.display == "block") {
            // noneで非表示
            document.querySelector('.battery_menu').style.display = "none";
        } else {
            // blockで表示
            document.querySelector('.battery_menu').style.display = "block";
        }
    })
    document.getElementById('files').addEventListener('mousedown', function () {
        start_menu.style.display = "none";
        document.querySelector('.start_button').classList.remove('pressed');
        document.querySelector('.battery_child').classList.remove('pressed');
        document.querySelector('.battery_menu').style.display = "none";
        document.querySelectorAll('.title').forEach(function (wt) {
            wt.classList.remove('navy');
        })
        titlecolor_set();
    });
    document.getElementById('files').addEventListener('click', function () {
        titlecolor_set();
    });
    document.getElementById('taskbar').addEventListener('click', function () {
        titlecolor_set();
    });
    document.getElementById('taskbar').addEventListener('mousedown', function () {
        document.querySelectorAll('.title').forEach(function (wt) {
            wt.classList.remove('navy');
            titlecolor_set();
        })
    });
    parent_start_menu.addEventListener('click', function () {
        start_menu.style.display = "none";
        document.querySelector('.start_button').classList.remove('pressed');
        taskbtn_load()
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
        button2.addEventListener('mousedown', function () {
            button2.classList.add('pressed');
            addEventListener('mouseup', function () {
                document.querySelectorAll('.button2').forEach(function (button2) {
                    button2.classList.remove('pressed');
                })
            });
        });
        button2.addEventListener('mouseleave', function () {
            button2.classList.remove('pressed');
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

        if (localStorage.getItem('deskprompt')) {
            nexser_program.style.display = "block";
            desktop.style.display = "none";
            document.querySelector('.pattern_backgrounds').style.display = "none";
        } else {
            document.querySelector('.pattern_backgrounds').style.display = "block";
        }
    }



    document.querySelector('.deskprompt').addEventListener('click', function () {
        const deskprompt = document.querySelector('.deskprompt');
        localStorage.setItem('deskprompt', deskprompt);
    })


    function nexser_program_open() {
        func2();
        desktop.style.display = "none";
        document.querySelector('.pattern_backgrounds').style.display = "none";
        document.querySelector('.welcome_windows').style.display = "none";
        sound_stop();
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
        if (!localStorage.getItem('deskprompt')) {
            setTimeout(function () {
                localStorage.removeItem('prompt_data3')
                prompt.style.display = "block";
                setTimeout(function () {
                    taskbar_none();
                    nexser_program.style.display = "none";
                    document.querySelector('.focus').focus();
                }, 500);
            }, 500);
        } else {
            nexser_program.style.display = "none";
            localStorage.removeItem('deskprompt');
            setTimeout(() => {
                desktop.style.display = "block";
                document.querySelector('.pattern_backgrounds').style.display = "block";
            }, 1000);
        }
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
    document.querySelector('.startup_computer').addEventListener('click', function () {
        if (localStorage.getItem('startup_computer')) {
            localStorage.removeItem('startup_computer')
            document.querySelector('.startup_computer').textContent = "OFF"
        } else {
            const startup_computer = document.querySelector('.startup_computer');
            localStorage.setItem('startup_computer', startup_computer);
            document.querySelector('.startup_computer').textContent = "ON"
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
    document.querySelector('.startup_guidebook').addEventListener('click', function () {
        if (localStorage.getItem('startup_guidebook')) {
            localStorage.removeItem('startup_guidebook')
            document.querySelector('.startup_guidebook').textContent = "OFF"
        } else {
            const startup_guidebook = document.querySelector('.startup_guidebook');
            localStorage.setItem('startup_guidebook', startup_guidebook);
            document.querySelector('.startup_guidebook').textContent = "ON"
        }
    })
    document.querySelector('.startup_objective').addEventListener('click', function () {
        if (localStorage.getItem('startup_objective')) {
            localStorage.removeItem('startup_objective')
            document.querySelector('.startup_objective').textContent = "OFF"
        } else {
            const startup_objective = document.querySelector('.startup_objective');
            localStorage.setItem('startup_objective', startup_objective);
            document.querySelector('.startup_objective').textContent = "ON"
        }
    })
    document.querySelector('.startup_calendar').addEventListener('click', function () {
        if (localStorage.getItem('startup_calendar')) {
            localStorage.removeItem('startup_calendar')
            document.querySelector('.startup_calendar').textContent = "OFF"
        } else {
            const startup_calendar = document.querySelector('.startup_calendar');
            localStorage.setItem('startup_calendar', startup_calendar);
            document.querySelector('.startup_calendar').textContent = "ON"
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

    document.querySelector('.startup_versiontext').addEventListener('click', function () {
        if (localStorage.getItem('startup_versiontext')) {
            localStorage.removeItem('startup_versiontext')
            document.querySelector('.startup_versiontext').textContent = "OFF"
            document.querySelector('.desktop_version_text').style.display = "none";
        } else {
            const startup_versiontext = document.querySelector('.startup_versiontext');
            localStorage.setItem('startup_versiontext', startup_versiontext);
            document.querySelector('.startup_versiontext').textContent = "ON";
            document.querySelector('.desktop_version_text').style.display = "block";
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

    function nexser_boot_check() {
        if (localStorage.getItem('driver_sound')) {
            nexser_start()
        } else if (!localStorage.getItem('driver_sound') && !localStorage.getItem('start_nexser')) {
            prompt.style.display = "none";
            document.querySelector('.nexser_boot_menu').style.display = "block";
            document.querySelector('.nexser_bootmenu_text').textContent = "サウンドドライバー がインストールされていません!";
            document.querySelector('.nexser_bootmenu_text2').textContent = "インストールして nexser を起動しますか?";
        } else {
            nexser_start()
        }
    }

    document.querySelector('.boot_sound').addEventListener('click', function () {
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

    function nexser_start() {
        document.querySelector('.nexser_boot_menu').style.display = "none";
        const prompt_data = "nexser_boot_test";
        localStorage.setItem('prompt_data', prompt_data);
        document.querySelector("#nexser").style.backgroundColor = "";
        document.querySelector('.test_allwindow').style.display = "none";
        document.querySelector('.welcome_windows').style.display = "none";
        document.querySelector('#code_html').style.display = "none";
        document.querySelector('#code_script').style.display = "none";
        document.querySelector('.start_button').classList.remove('pressed');

        document.querySelector('.focus').blur();
        document.querySelector('html').style.cursor = 'none';
        window_none();
        if (localStorage.getItem('prompt_data2')) {
            func2();
            setTimeout(function () {
                console.log(largestZIndex)
                prompt.style.display = "none";
                setTimeout(function () {
                    nexser.style.display = "block";
                    setTimeout(function () {
                        start_check()
                        taskbar_none();
                        if (localStorage.getItem('login_welcome')) {
                            welcome()
                        };
                    }, 100);
                }, 100);
            }, 100)
            setTimeout(() => {
                document.querySelector('html').style.cursor = 'progress';
                document.querySelector('.pattern_backgrounds').style.display = "block";
            }, 100);
        } else {
            func1();
            setTimeout(function () {
                prompt.style.display = "none";
                setTimeout(function () {
                    nexser.style.display = "block";
                    setTimeout(function () {
                        start_check()
                        taskbar_none();
                        if (localStorage.getItem('login_welcome')) {
                            welcome()
                        };
                    }, 1500);
                }, 1500)
            }, 1500);
            setTimeout(() => {
                document.querySelector('html').style.cursor = 'progress';
                document.querySelector('.pattern_backgrounds').style.display = "block";
            }, 2000);
        }
    }

    Array.from(shutdown).forEach(element => {
        element.addEventListener('click', event => {
            document.querySelector('html').style.cursor = 'progress';
            setTimeout(() => {
                document.querySelector('.test_allwindow').style.display = "block";
                if (sessionStorage.getItem('start_camera')) {
                    document.querySelector('html').style.cursor = '';
                    document.querySelector('.window_error_text').textContent = "camera no finish no shutdown!"
                    error_windows.classList.remove('active')
                    sound3()
                    document.querySelector('.test_allwindow').style.display = "block";
                } else if (gets == gets2) {
                    sound_stop();
                    shutdown_sound();
                    document.querySelector('.welcome_windows').style.display = "none";
                    document.querySelector('html').style.cursor = 'none';
                    if (!localStorage.getItem('noteData')) {
                        document.note_form.note_area.value = "";
                        resetShowLength();
                        document.querySelector('.note_title').textContent = "notepad"
                    }
                    setTimeout(() => {
                        window_none();
                        desktop.style.display = "none";
                        localStorage.removeItem('prompt_data');
                        window_reset();
                        preview2_stop();
                        timerstop();
                        timerreset();
                        document.querySelector('#code_html').style.display = "none";
                        document.querySelector('#code_script').style.display = "none";
                        fileborder_reset();
                        cpubench_clear();
                        cpucalc_reset();
                        p_clear();
                        calc_clear();
                        document.querySelector('.focus2').textContent = "";

                        setTimeout(() => {
                            document.querySelectorAll('.button').forEach(function (button) {
                                let tscbtn = button.firstChild;
                                tscbtn = button.classList.remove('pressed');
                            });
                            document.getElementsByClassName('name')[0].value = "";
                            document.querySelector('.prompt_error_text').textContent = "";
                            msg.innerText = "";
                            prompt_text.style.color = "";
                            nexser.style.display = "none";
                            prompt.style.display = "block";
                            start_menu.style.display = "none";
                            document.querySelector('.focus').focus();
                            document.querySelector('html').style.cursor = '';
                        }, 500);
                    }, 1000);
                } else {
                    warning_windows.style.display = "block";
                    document.querySelector('.close_button3').style.display = "block"
                    document.querySelector('.shutdown_button').style.display = "block";
                    document.querySelector('.warningclose_button').style.display = "none";
                    document.querySelector('.warning_title_text').textContent = "warning"
                    document.querySelector('.window_warning_text').textContent = "task window open! shutdown?"
                    sound5()
                    document.querySelector('html').style.cursor = '';
                }
            }, 100);
        })
    })

    Array.from(restart).forEach(element => {
        element.addEventListener('click', event => {
            document.querySelector('html').style.cursor = 'progress';
            setTimeout(() => {
                document.querySelector('.test_allwindow').style.display = "block";
                if (sessionStorage.getItem('start_camera')) {
                    document.querySelector('html').style.cursor = '';
                    document.querySelector('.window_error_text').textContent = "camera no finish no restart!"
                    error_windows.classList.remove('active')
                    sound3()
                    document.querySelector('.test_allwindow').style.display = "block";
                } else if (gets == gets2) {
                    sound_stop();
                    shutdown_sound();
                    document.querySelector('.welcome_windows').style.display = "none";
                    document.querySelector('html').style.cursor = 'none';
                    if (!localStorage.getItem('noteData')) {
                        document.note_form.note_area.value = "";
                        resetShowLength();
                        document.querySelector('.note_title').textContent = "notepad"
                    }
                    setTimeout(() => {
                        window_none();
                        desktop.style.display = "none";
                        window_reset();
                        preview2_stop();
                        timerstop();
                        timerreset();
                        document.querySelector('#code_html').style.display = "none";
                        document.querySelector('#code_script').style.display = "none";
                        fileborder_reset();
                        cpubench_clear();
                        cpucalc_reset();
                        p_clear();
                        calc_clear();
                        document.querySelector('.focus2').textContent = "";

                        setTimeout(() => {
                            document.querySelectorAll('.button').forEach(function (button) {
                                let tscbtn = button.firstChild;
                                tscbtn = button.classList.remove('pressed');
                            });
                            document.getElementsByClassName('name')[0].value = "";
                            document.querySelector('.prompt_error_text').textContent = "";
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
                    document.querySelector('html').style.cursor = '';
                    document.querySelector('.window_error_text').textContent = "window open no restart!"
                    error_windows.classList.remove('active')
                    prompt_text2.style.color = "";
                    sound3()
                    document.querySelector('.test_allwindow').style.display = "block";
                }
            }, 100);
        })
    })

    function start_check() {
        document.querySelector('html').style.cursor = 'none';
        taskbar.style.display = "none";
        document.getElementById('files').style.display = "none";
        if (!localStorage.getItem('start_nexser') || desktop.style.display == "block") {
            prompt.style.display = "none";
            nexser_program.style.display = "none";
            nexser.style.display = "block";
            desktop.style.display = "none";
            document.querySelector('.welcome_windows').style.display = "block";
            welcome_animation()
        } else {
            startup_sound();
            prompt.style.display = "none";
            nexser_program.style.display = "none";
            nexser.style.display = "block";
            document.querySelector('.welcome_windows').style.display = "none";
            setTimeout(() => {
                desktop.style.display = "block";
                toolbar.style.display = "block";
                toolbar.style.top = "";
                toolbar.style.left = "";
                toolbar.style.bottom = "0px";
            }, 500);
            setTimeout(() => {
                setColor();
                document.querySelector('html').style.cursor = '';
                toolbar.style.display = "none";
            }, 1500);
            setTimeout(() => {
                startup_window_open();
                taskbtn_load();
                if (localStorage.getItem('toolbar_on')) {
                    toolbar.style.display = "block";
                }
                if (localStorage.getItem('taskbar_position_button')) {
                    taskbar.style.display = "block";
                    toolbar.style.bottom = "";
                    toolbar.style.left = "";
                    toolbar.style.top = "40px";
                } else {
                    taskbar.style.display = "block";
                    toolbar.style.top = "";
                    toolbar.style.left = "";
                    toolbar.style.bottom = "40px";
                }
                document.getElementById('files').style.display = "block";
            }, 2000);
        }
    }

    function nexser_on() {
        setTimeout(() => {
            const start_nexser = document.querySelector('.start_nexser');
            localStorage.setItem('start_nexser', start_nexser);
            document.querySelector('.welcome_windows').style.display = ""
            setTimeout(() => {
                desktop.style.display = "block";
                document.getElementById('files').style.display = "block";
                document.getElementById('taskbar').style.display = "block";
            }, 1000);
            setTimeout(() => {
                setColor()
                document.querySelector('html').style.cursor = '';
            }, 2000);
            setTimeout(() => {
                startup_window_open()
                taskbtn_load()
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

    document.querySelector('.login_welcome').addEventListener('click', function () {
        const login_welcome = document.querySelector('.login_welcome');
        localStorage.setItem('login_welcome', login_welcome);
    })
    document.querySelector('.nologin_welcome').addEventListener('click', function () {
        localStorage.removeItem('login_welcome');
    })


    function welcome_animation() {
        sound_stop();
        document.querySelector('html').style.cursor = 'none';
        sound7();
        document.querySelector('.start_nexser').style.display = "none";
        document.querySelector('.startnexser_close').style.display = "none";
        document.querySelector('.welcome_window_inline').style.display = "none";
        document.querySelector('.welcome_text1').style.position = "absolute";
        document.querySelector('.welcome_text1').style.fontSize = "80px";
        document.querySelector('.welcome_text1').style.marginTop = "125px";
        document.querySelector('.welcome_text1').style.marginLeft = "50px";
        document.querySelector('.welcome_underline').style.right = "0";
        const welunder = document.querySelector('.welcome_underline');
        welunder.style.width = "0%"
        document.querySelector('.welcome_text2').style.display = "none";
        document.querySelector('.welcome_icons').style.display = "none";

        setTimeout(() => {

            setTimeout(() => {
                document.querySelector('.welcome_window_inline').style.display = "block"
                setTimeout(() => {
                    document.querySelector('.welcome_text1').style.fontSize = "70px"
                    document.querySelector('.welcome_text1').style.marginTop = "80px"
                    document.querySelector('.welcome_text1').style.marginLeft = "25px"
                }, 1000);
                setTimeout(() => {
                    document.querySelector('.welcome_text1').style.fontSize = "60px"
                    document.querySelector('.welcome_text1').style.marginTop = "40px"
                    document.querySelector('.welcome_text1').style.marginLeft = "15px"
                }, 1200);
                setTimeout(() => {
                    document.querySelector('.welcome_text1').style.fontSize = "50px"
                    document.querySelector('.welcome_text1').style.marginTop = "20px"
                    document.querySelector('.welcome_text1').style.marginLeft = "10px"
                }, 1400);
                setTimeout(() => {
                    document.querySelector('.welcome_text1').style.fontSize = "45px"
                    document.querySelector('.welcome_text1').style.marginTop = "10px"
                    document.querySelector('.welcome_text1').style.marginLeft = "5px"
                }, 1500);
                setTimeout(() => {
                    document.querySelector('.welcome_text1').style.fontSize = "40px"
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
                    document.querySelector('.welcome_icons').style.display = "block";
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
        welcome_animation();
    }

    startup_window_open()
    function startup_window_open() {
        if (localStorage.getItem('startup_computer')) {
            const element = document.querySelector('.my_computer');
            element.closest('.child_windows');
            element.classList.remove('active');

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            wt = element.firstElementChild;
            wt.classList.add('navy');
        }
        if (localStorage.getItem('startup_note')) {
            const element = document.querySelector('.note_pad');
            element.closest('.child_windows');
            element.classList.remove('active');

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            wt = element.firstElementChild;
            wt.classList.add('navy');
        }
        if (!note_pad.classList.contains('active')) {
            document.querySelector('.note_area').focus();
        }
        if (localStorage.getItem('startup_color')) {
            const element = document.querySelector('.color');
            element.closest('.child_windows');
            element.classList.remove('active');

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            wt = element.firstElementChild;
            wt.classList.add('navy');
        }
        if (localStorage.getItem('startup_screen')) {
            const element = document.querySelector('.screen_text_menu');
            element.closest('.child_windows');
            element.classList.remove('active');

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            wt = element.firstElementChild;
            wt.classList.add('navy');
        }
        if (localStorage.getItem('startup_htmlviewer_edit')) {
            const element = document.querySelector('.htmlviewer_edit_menu');
            element.closest('.child_windows');
            element.classList.remove('active');

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            wt = element.firstElementChild;
            wt.classList.add('navy');
        }
        if (localStorage.getItem('startup_guidebook')) {
            const element = document.querySelector('.nexser_guidebook_menu');
            element.closest('.child_windows');
            element.classList.remove('active');

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            wt = element.firstElementChild;
            wt.classList.add('navy');
        }
        if (localStorage.getItem('startup_objective')) {
            const element = document.querySelector('.objective_menu');
            element.closest('.child_windows');
            element.classList.remove('active');

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            wt = element.firstElementChild;
            wt.classList.add('navy');
        }
        if (localStorage.getItem('startup_calendar')) {
            const element = document.querySelector('.calendar_menu');
            element.closest('.child_windows');
            element.classList.remove('active');

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            wt = element.firstElementChild;
            wt.classList.add('navy');
        }
        titlecolor_set()
    }

    document.getElementById('sound_driver').addEventListener('click', function () {
        if (localStorage.getItem('driver_sound')) {
            localStorage.removeItem('driver_sound')
            document.querySelector('.installbutton_1').textContent = "install"
            document.querySelector('.startup_sound').textContent = "INSTALL"
            sound_stop()
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
            titlecolor_remove();
            titlecolor_set();
        } else {
            const color_driver = document.querySelector('#color_driver');
            localStorage.setItem('driver_color', color_driver);
            document.querySelector('.installbutton_2').textContent = "uninstall";
            titlecolor_remove();
            titlecolor_set();
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

    document.getElementById('backtext_on').addEventListener('click', function () {
        const backtext = document.querySelector('#backtext_on');
        localStorage.setItem('backtext', backtext);
        const backtext_data2 = localStorage.getItem('backtext_data');
        document.querySelector('#background_text').textContent = (backtext_data2);
        document.querySelector('#background_text').classList.add('block');
        document.querySelector('.backtext_mode').textContent = "ON"
    })
    document.getElementById('backtext_off').addEventListener('click', function () {
        localStorage.removeItem('backtext');
        document.querySelector('#background_text').classList.remove('block');
        document.querySelector('.backtext_mode').textContent = "OFF"
    })


    document.querySelector('.backtext_small').addEventListener('click', function () {
        backtextSize_clear();
        const backtext_small = document.querySelector('.backtext_small');
        localStorage.setItem('backtext_small', backtext_small);
        const backtext_data2 = localStorage.getItem('backtext_data');
        document.querySelector('#background_text').style.fontSize = "15px";
        document.querySelector('#background_text2').style.fontSize = "15px";
    })
    document.querySelector('.backtext_medium').addEventListener('click', function () {
        backtextSize_clear();
        const backtext_medium = document.querySelector('.backtext_medium');
        localStorage.setItem('backtext_medium', backtext_medium);
        const backtext_data2 = localStorage.getItem('backtext_data');
        document.querySelector('#background_text').style.fontSize = "30px";
        document.querySelector('#background_text2').style.fontSize = "30px";
    })
    document.querySelector('.backtext_large').addEventListener('click', function () {
        backtextSize_clear();
        const backtext_large = document.querySelector('.backtext_large');
        localStorage.setItem('backtext_large', backtext_large);
        const backtext_data2 = localStorage.getItem('backtext_data');
        document.querySelector('#background_text').style.fontSize = "45px";
        document.querySelector('#background_text2').style.fontSize = "45px";
    })

    function backtextSize_clear() {
        document.querySelector('#background_text').style.fontSize = "";
        document.querySelector('#background_text2').style.fontSize = "";
        localStorage.removeItem('backtext_small');
        localStorage.removeItem('backtext_medium');
        localStorage.removeItem('backtext_large');
    }

    function all_load() {
        localStorage.removeItem('note_texts');
        taskgroup_load();
        batterylevel();
        window_back_silver();
        caload();
        titlecolor_set();
        back_pattern_set();
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
        if (localStorage.getItem('backtext')) {
            document.querySelector('.backtext_mode').textContent = "ON"
        }
        if (localStorage.getItem('noteData')) {
            load()
            document.querySelector('.note_title').textContent = "notepad(save keep)"
        }
        if (localStorage.getItem('textdropdata')) {
            load2()
        }
        if (localStorage.getItem('objectiveData') || localStorage.getItem('objectiveTitleData')) {
            objective_load()
        }
        if (localStorage.getItem('startup_note')) {
            document.querySelector('.startup_note').textContent = "ON"
        }
        if (localStorage.getItem('startup_computer')) {
            document.querySelector('.startup_computer').textContent = "ON"
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
        if (localStorage.getItem('startup_guidebook')) {
            document.querySelector('.startup_guidebook').textContent = "ON"
        }
        if (localStorage.getItem('startup_objective')) {
            document.querySelector('.startup_objective').textContent = "ON"
        }
        if (localStorage.getItem('startup_calendar')) {
            document.querySelector('.startup_calendar').textContent = "ON"
        }
        if (localStorage.getItem('prompt_data2')) {
            document.querySelector('.startup_speed').textContent = "HIGH"
        }
        if (localStorage.getItem('driver_sound')) {
            document.querySelector('.startup_sound').textContent = "UN INSTALL"
        }
        if (localStorage.getItem('startup_versiontext')) {
            document.querySelector('.startup_versiontext').textContent = "ON"
            document.querySelector('.desktop_version_text').style.display = "block";
        } else {
            document.querySelector('.desktop_version_text').style.display = "none";
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

        if (localStorage.getItem('windowfile_1')) {
            window_file_list_change()
        }
        if (localStorage.getItem('windowfile_2')) {
            window_file_list_reset()
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
            document.querySelector('.files_inline').style.top = "40px"
            document.querySelector('.files_inline').style.bottom = "auto"
        }

        if (localStorage.getItem('taskbar_position_button')) {
            toolbar.style.top = "40px";
        }
        if (localStorage.getItem('toolbar_on')) {
            toolbar.style.display = "block"
        }
        if (localStorage.getItem('saver_on')) {
            document.querySelector('.saver_mode').textContent = "ON"
        }
        if (localStorage.getItem('display_old')) {
            old_screen()
        }
        if (localStorage.getItem('list_shadow_on')) {
            list_shadow()
        }
        if (localStorage.getItem('file_none')) {
            document.querySelector('.files_inline').style.display = "none"
        }

        if (localStorage.getItem('backtext_small')) {
            document.querySelector('#background_text').style.fontSize = "15px";
            document.querySelector('#background_text2').style.fontSize = "15px"
        }
        if (localStorage.getItem('backtext_medium')) {
            document.querySelector('#background_text').style.fontSize = "30px";
            document.querySelector('#background_text2').style.fontSize = "30px"
        }
        if (localStorage.getItem('backtext_large')) {
            document.querySelector('#background_text').style.fontSize = "45px";
            document.querySelector('#background_text2').style.fontSize = "45px"
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
            if (my_computer.classList.contains('active')) {
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
            if (screen_text_menu.classList.contains('active')) {
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
            const notearea = document.querySelector('.note_area');
            notearea.style.height = "";
            notearea.style.width = "";
            allwindow.classList.add('default');
            allwindow.classList.remove('leftwindow');
            allwindow.classList.remove('rightwindow');
            allwindow.style.transition = "";
            document.querySelector('.bigscreen_button').style.visibility = "visible";
            document.querySelector('.minscreen_button').style.visibility = "visible";
            document.querySelector('.minimization_button').style.visibility = "visible";
            allwindow.classList.remove('half2');
        });
    }
    function window_none() {
        document.querySelectorAll('.child_windows').forEach(function (allwindow_none) {
            allwindow_none.classList.add('active');
            allwindow_none.classList.remove('big');

            allwindow_none.classList.remove('rightwindow');
            allwindow_none.classList.remove('leftwindow');
            allwindow_none.style.right = "";
            allwindow_none.classList.add('default');
            allwindow_none.style.transition = "";
        });
        const notearea = document.querySelector('.note_area');
        notearea.style.height = "";
        notearea.style.width = "";
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
        // localStorage.removeItem('data_taskbar_none');
        toolbar.style.display = "none";
        colordata_clear();
        old_screen_reset();
        list_shadow_reset();
        back_pattern_remove();
        titlecolor_remove();
    }

    function allStorage_clear() {
        const alllength = localStorage.length;
        if (alllength > 0) {

            if (sessionStorage.getItem('start_camera')) {
                stopCamera()
            }

            localStorage.clear();
            sessionStorage.clear();
            alldata_clear();
            document.querySelector('.tests').textContent = (alllength);

            document.querySelector('.test_allwindow').style.display = "block";
            warning_windows.style.display = "block";
            document.querySelector('.shutdown_button').style.display = "block";
            document.querySelector('.warningclose_button').style.display = "none";
            document.querySelector('.warning_title_text').textContent = "nexser";
            document.querySelector('.window_warning_text').textContent = "nexser alldata remove!!";
            document.querySelector('.installbutton_1').textContent = "install";
            document.querySelector('.startup_sound').textContent = "INSTALL";
            document.querySelector('.startup_versiontext').textContent = "OFF";
            document.querySelector('.installbutton_2').textContent = "install";

            document.querySelector('.close_button3').style.display = "none";
            document.querySelector('.taskbar_position_button').textContent = "top";
            document.getElementById('taskbar').style.top = "";
            document.querySelector('.child_start_menu').style.top = "auto";
            document.querySelector('.child_start_menu').style.bottom = "";

            document.querySelector('.startup_computer').textContent = "OFF";
            document.querySelector('.startup_note').textContent = "OFF";
            document.querySelector('.startup_color').textContent = "OFF";
            document.querySelector('.startup_screen').textContent = "OFF";
            document.querySelector('.startup_htmlviewer_edit').textContent = "OFF";
            document.querySelector('.startup_guidebook').textContent = "OFF";

            document.querySelector('.startup_htmlviewer_edit').textContent = "OFF";
            document.querySelector('.startup_speed').textContent = "OFF";

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
        document.querySelectorAll('.desktop_files').forEach(function (desktop_files) {
            const deskfile_text = desktop_files.firstElementChild;
            deskfile_text.style.color = ""
        })
    }

    function taskbar_none() {
        if (localStorage.getItem('data_taskbar_none')) {
            taskbar.style.display = "none";
            my_computer.classList.remove('active');
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
                document.querySelector('.prompt_error_text').textContent = "";
                msg.innerText = "";
                prompt_text.style.color = "";
                break;
            case 'nexser/open':
                prompt_text.style.color = "yellow";
                document.getElementsByClassName('name')[0].value = "nexser boot...";
                document.querySelector('.prompt_error_text').textContent = "success";
                nexser_boot_check();
                break;
            case 'nexser/program':
                const prompt_data3 = document.prompt_text_form.prompt_text.value;
                localStorage.setItem('prompt_data3', prompt_data3);
                prompt_text.style.color = "";
                document.querySelector('.prompt_error_text').textContent = "success";
                nexser_program_open()
                break;

            case 'nexser/code/html':
                document.querySelector('.prompt_error_text').textContent = "connect";
                prompt_text.style.color = "";
                document.querySelector('#code_html').style.display = "block";
                document.querySelector('#code_script').style.display = "none";
                break;
            case 'nexser/code/script':
                document.querySelector('.prompt_error_text').textContent = "connect";
                prompt_text.style.color = "";
                document.querySelector('#code_script').style.display = "block";
                document.querySelector('#code_html').style.display = "none";
                break;
            case 'nexser/code/html/copy':
                var copyTarget = document.getElementById('code_html');
                copyTarget.select();
                document.execCommand("Copy");
                document.querySelector('.prompt_error_text').textContent = "";
                document.querySelector('#code_html').style.display = "none";
                document.querySelector('#code_script').style.display = "none";
                document.querySelector('.focus').focus();
                break;
            case 'nexser/code/script/copy':
                var copyTarget = document.getElementById('code_script');
                copyTarget.select();
                document.execCommand("Copy");
                document.querySelector('.prompt_error_text').textContent = "";
                document.querySelector('#code_html').style.display = "none";
                document.querySelector('#code_script').style.display = "none";
                document.querySelector('.focus').focus();
                break;

            default:
                document.querySelector('.prompt_error_text').textContent = "コマンドが違います!";
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
                msg2.innerText = "";
                prompt_text2.style.color = "";

                command_help_menu.classList.remove('active');
                z = largestZIndex++;
                command_help_menu.style.zIndex = z;

                document.querySelectorAll('.title').forEach(function (wt) {
                    wt.classList.remove('navy')
                })
                wt = command_help_menu.firstElementChild;
                wt.classList.add('navy');
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
            case 'allwindow/big':
                document.querySelector('.prompt_error_text2').textContent = "";
                prompt_text2.style.color = "";
                allwindow_big()
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
                cpu_calc_menu.classList.remove('active');
                cpucalc_open();
                break;
            case 'nexser/data/clear':
                document.querySelector('.prompt_error_text2').textContent = "";
                allStorage_clear()
                prompt_text2.style.color = "";
                break;
            case 'welcome':
                document.querySelector('.prompt_error_text2').textContent = "";
                prompt_text2.style.color = "";
                welcome()
                break;
            case 'file/none':
                document.querySelector('.prompt_error_text2').textContent = "";
                const file_none = document.prompt_text_form2.prompt_text2.value;
                localStorage.setItem('file_none', file_none);
                prompt_text2.style.color = "";
                document.querySelector('.files_inline').style.display = "none";
                break;
            case 'file/active':
                document.querySelector('.prompt_error_text2').textContent = "";
                localStorage.removeItem('file_none');
                prompt_text2.style.color = "";
                document.querySelector('.files_inline').style.display = "flex";
                break;

            case 'windows95/open':
                document.querySelector('.prompt_error_text2').textContent = "";
                window.open("//moti5768.github.io/moti.world/windows95.html");
                prompt_text2.style.color = "";
                break;
            case 'windows2000/open':
                document.querySelector('.prompt_error_text2').textContent = "";
                window.open("//moti5768.github.io/moti.world/windows%202000/windows2000_beta.html");
                prompt_text2.style.color = "";
                break;
            case 'windowsystem/open':
                document.querySelector('.prompt_error_text2').textContent = "";
                window.open("//moti5768.github.io/moti.world/new%20OS/WindowSystem.html");
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

    function p_clear() {
        document.querySelector('.p_text').value = "";
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
    function backtext_clear() {
        document.back_text_form.back_text.value = "";
        localStorage.removeItem('backtext_data');
        document.querySelector('#background_text').textContent = "";
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
            const un = document.getElementsByClassName('navy').length;
            document.querySelector('.title_navy').textContent = un;
        }
    }, 100);

    document.querySelectorAll('.window_inline_list').forEach(function (window_inline_list) {
        window_inline_list.addEventListener('click', function () {
            taskbtn_load()
        });
    })
    document.querySelectorAll('.desktop_files').forEach(function (desktop_files) {
        desktop_files.addEventListener('click', function () {
            start_menu.style.display = "none";
            document.querySelector('.start_button').classList.remove('pressed');
            setTimeout(() => {
                taskbtn_load()
            });
        });
    })
    document.querySelectorAll('.close_button').forEach(function (close_button) {
        close_button.addEventListener('click', function () {
            setTimeout(() => {
                const closebutton = close_button.closest('.child_windows');
                closebutton.classList.add('active');
                taskbtn_load()

                const cb = close_button.closest('.child_windows');
                const cb2 = cb.firstElementChild;
                cb2.classList.remove('navy')
            }, 100);
            setTimeout(() => {
                document.querySelectorAll('.select_window').forEach(function (select_window) {
                    const select_window2 = select_window.closest('.child_windows');
                    const select_window3 = select_window2.firstElementChild;
                    select_window3.classList.add('navy')
                })
            }, 150);
        });
    })
    document.querySelectorAll('.close_button2').forEach(function (close_button2) {
        close_button2.addEventListener('click', function () {
            setTimeout(() => {
                const closebutton2 = close_button2.closest('.error_windows');
                closebutton2.classList.add('active');
                document.querySelector('.test_allwindow').style.display = "none";
            }, 100);
        });
    })
    document.querySelectorAll('.close_button3').forEach(function (close_button3) {
        close_button3.addEventListener('click', function () {
            setTimeout(() => {
                const closebutton3 = close_button3.closest('.warning_windows');
                closebutton3.style.display = "none"
                document.querySelector('.test_allwindow').style.display = "none";
            }, 100);
        });
    })

    document.querySelectorAll('.close_button4').forEach(function (close_button4) {
        close_button4.addEventListener('click', function () {
            setTimeout(() => {
                const cb = close_button4.closest('.child_windows');
                const cb2 = cb.firstElementChild;
                cb2.classList.remove('navy')
            }, 100);
        });
    })


    document.querySelectorAll('.child_windows').forEach(function (child_windows) {
        child_windows.classList.add('default')
    })

    document.querySelectorAll('.minimization_button').forEach(function (minimizationbutton) {
        minimizationbutton.addEventListener('click', function () {
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
            const bigscreenbutton2 = bigscreenbutton.lastElementChild;
            bigscreenbutton2.style.bottom = "40px";

            bigscreenbutton.classList.remove('rightwindow');
            bigscreenbutton.classList.remove('leftwindow');

            if (localStorage.getItem('taskbar_position_button')) {
                bigscreenbutton.style.height = ""
                bigscreenbutton.style.width = ""
                bigscreenbutton.style.top = "40px"
                bigscreenbutton.style.left = "0"
                bigscreenbutton.style.transition = "0.08s cubic-bezier(0, 0, 1, 1)"
            } else {
                bigscreenbutton.style.height = ""
                bigscreenbutton.style.width = ""
                bigscreenbutton.style.top = "0"
                bigscreenbutton.style.left = "0"
                bigscreenbutton.style.transition = "0.08s cubic-bezier(0, 0, 1, 1)"
            }
            setTimeout(() => {
                bigscreenbutton.style.transition = ""
            }, 100);
            bigscreenbutton.classList.add('big');
            if (!note_pad.classList.contains('active')) {
                document.querySelector('.note_area').focus()
            }
        });
    })

    document.querySelectorAll('.minscreen_button').forEach(function (minscreen_button) {
        minscreen_button.addEventListener('click', function () {
            const minscreenbutton = minscreen_button.closest('.child_windows');
            const minscreenbutton2 = minscreenbutton.lastElementChild;
            minscreenbutton2.style.bottom = "0px"

            const minscreenbutton3 = minscreenbutton.getComputedStyle;
            console.log(minscreenbutton3);

            minscreenbutton.classList.remove('rightwindow');
            minscreenbutton.classList.remove('leftwindow');

            minscreenbutton.classList.add('default');
            minscreenbutton.style.top = "";
            minscreenbutton.style.left = "";
            minscreenbutton.style.right = "";
            minscreenbutton.style.transition = "0.08s cubic-bezier(0, 0, 1, 1)"
            setTimeout(() => {
                if (!note_pad.classList.contains('active')) {
                    document.querySelector('.note_area').focus()
                }
                minscreenbutton.classList.remove('big');
                minscreenbutton.style.transition = ""
            }, 100);
        });
    })
    function allwindow_min() {
        document.querySelectorAll('.child_windows').forEach(function (alliwindow_min) {
            alliwindow_min.style.top = "";
            alliwindow_min.style.left = "";
            alliwindow_min.style.height = "";
            alliwindow_min.style.width = "0";
            system_menu.style.width = "600px";
            display_menu.style.width = "600px";
            const notearea = document.querySelector('.note_area');
            notearea.style.height = "";
            notearea.style.width = "";
            alliwindow_min.classList.remove('leftwindow');
            alliwindow_min.classList.remove('rightwindow');
            alliwindow_min.style.transition = "0.025s cubic-bezier(0, 0, 1, 1)"
            setTimeout(() => {
                alliwindow_min.classList.remove('big');
                alliwindow_min.style.transition = ""
            }, 30);
        });
    }

    function allwindow_big() {
        document.querySelectorAll('.child_windows').forEach(function (alliwindow_big) {
            const bigscreenbutton = alliwindow_big.closest('.child_windows');
            const bigscreenbutton2 = bigscreenbutton.lastElementChild;
            bigscreenbutton2.style.bottom = "40px";

            bigscreenbutton.classList.remove('rightwindow');
            bigscreenbutton.classList.remove('leftwindow');

            if (localStorage.getItem('taskbar_position_button')) {
                bigscreenbutton.style.height = ""
                bigscreenbutton.style.width = ""
                bigscreenbutton.style.top = "40px"
                bigscreenbutton.style.left = "0"
                bigscreenbutton.style.transition = "0.08s cubic-bezier(0, 0, 1, 1)"
            } else {
                bigscreenbutton.style.height = ""
                bigscreenbutton.style.width = ""
                bigscreenbutton.style.top = "0"
                bigscreenbutton.style.left = "0"
                bigscreenbutton.style.transition = "0.08s cubic-bezier(0, 0, 1, 1)"
            }
            setTimeout(() => {
                bigscreenbutton.style.transition = ""
            }, 100);
            bigscreenbutton.classList.add('big');
            if (!note_pad.classList.contains('active')) {
                document.querySelector('.note_area').focus()
            }
        });
    }

    document.querySelectorAll('.window_fullleft').forEach(function (window_left) {
        window_left.addEventListener('click', function () {
            const windowleft = window_left.closest('.child_windows');
            const windowleft2 = windowleft.lastElementChild;
            windowleft2.style.bottom = "40px";

            windowleft.classList.remove('rightwindow');
            windowleft.classList.add('leftwindow');

            if (localStorage.getItem('taskbar_position_button')) {
                windowleft.style.right = "auto";
                windowleft.style.top = "40px";
                windowleft.style.left = "0";
                windowleft.style.height = "100%";
                windowleft.style.width = "49.9%";
                windowleft.style.transition = "0.08s cubic-bezier(0, 0, 1, 1)";
            } else {
                windowleft.style.right = "auto";
                windowleft.style.top = "0";
                windowleft.style.left = "0";
                windowleft.style.height = "100%";
                windowleft.style.width = "49.9%";
                windowleft.style.transition = "0.08s cubic-bezier(0, 0, 1, 1)";
            }

            windowleft.classList.remove('big');
            windowleft.classList.remove('default');
        });
    })
    document.querySelectorAll('.window_fullright').forEach(function (window_right) {
        window_right.addEventListener('click', function () {
            const windowright = window_right.closest('.child_windows');
            const windowright2 = windowright.lastElementChild;
            windowright2.style.bottom = "40px";

            windowright.classList.remove('leftwindow');
            windowright.classList.add('rightwindow');

            if (localStorage.getItem('taskbar_position_button')) {
                windowright.style.left = "auto";
                windowright.style.top = "40px";
                windowright.style.right = "0";
                windowright.style.height = "100%";
                windowright.style.width = "49.9%";
                windowright.style.transition = "0.08s cubic-bezier(0, 0, 1, 1)";
            } else {
                windowright.style.left = "auto";
                windowright.style.top = "0";
                windowright.style.right = "0";
                windowright.style.height = "100%";
                windowright.style.width = "49.9%";
                windowright.style.transition = "0.08s cubic-bezier(0, 0, 1, 1)";
            }

            windowright.classList.remove('big');
            windowright.classList.remove('default');
        });
    })

    document.querySelectorAll('.window_half_big').forEach(function (window_half_big) {
        window_half_big.addEventListener('click', function () {
            const windowhalfbig = window_half_big.closest('.child_windows');
            const windowhalfbig2 = windowhalfbig.lastElementChild;
            windowhalfbig2.style.bottom = "0"

            windowhalfbig.classList.remove('rightwindow');
            windowhalfbig.classList.remove('leftwindow');
            windowhalfbig.classList.remove('half2');

            let shiftX = event.clientX - window_half_big.getBoundingClientRect().left;
            let shiftY = event.clientY - window_half_big.getBoundingClientRect().top;
            let top = document.querySelector('.top');
            moveAt(event.pageX, event.pageY);
            // ボールを（pageX、pageY）座標の中心に置く
            function moveAt(pageX, pageY) {
                window_half_big.style.left = pageX - shiftX + 'px';
                window_half_big.style.top = pageY - shiftY + 'px';
            }
            function onMouseMove(event) {
                moveAt(event.pageX, event.pageY);
            }

            windowhalfbig.style.height = "55%"
            windowhalfbig.style.width = "55%"
            windowhalfbig.style.transition = "0.08s cubic-bezier(0, 0, 1, 1)"
            setTimeout(() => {
                windowhalfbig.style.transition = ""
            }, 100);
            windowhalfbig.classList.remove('big')
        })
    })

    document.querySelectorAll('.windowsize_reset').forEach(function (windowsize_reset) {
        windowsize_reset.addEventListener('click', function () {
            const windowsizereset = windowsize_reset.closest('.child_windows');
            const windowsizereset2 = windowsizereset.lastElementChild;
            windowsizereset2.style.bottom = "0"

            if (windowsizereset.classList.contains('rightwindow')) {
                windowsizereset.style.height = "";
                windowsizereset.style.width = "0";
            } else {
                windowsizereset.style.height = "";
                windowsizereset.style.width = "";
            }

            windowsizereset.classList.remove('big');

            windowsizereset.style.transition = "0.08s cubic-bezier(0, 0, 1, 1)"
            setTimeout(() => {
                windowsizereset.style.transition = ""
            }, 100);

            windowsizereset.classList.remove('rightwindow');
            windowsizereset.classList.remove('leftwindow');

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

    document.querySelectorAll('.note_fullleft').forEach(function (note_fullleft) {
        note_fullleft.addEventListener('click', function () {
            const notearea = document.querySelector('.note_area');
            notearea.style.height = "80vh"
            notearea.style.width = ""
            notearea.style.resize = "none"
        })
    })
    document.querySelectorAll('.note_fullright').forEach(function (note_fullright) {
        note_fullright.addEventListener('click', function () {
            const notearea = document.querySelector('.note_area');
            notearea.style.height = "80vh"
            notearea.style.width = ""
            notearea.style.resize = "none"
        })
    })

    document.querySelectorAll('.note_halfbig').forEach(function (note_halfbig) {
        note_halfbig.addEventListener('click', function () {
            const notearea = document.querySelector('.note_area');
            notearea.style.height = "41.5vh"
            notearea.style.width = ""
            notearea.style.resize = "none"
        })
    })
    document.querySelectorAll('.note_sizereset').forEach(function (note_sizereset) {
        note_sizereset.addEventListener('click', function () {
            const notearea = document.querySelector('.note_area');
            notearea.style.height = ""
            notearea.style.width = ""
            notearea.style.resize = ""

            const notearea2 = notearea.closest('.child_windows');
            notearea2.style.width = "0"
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

    document.querySelectorAll('.desktop_files').forEach(function (desktop_files) {
        desktop_files.addEventListener('mousedown', function () {
            document.querySelectorAll('.desktop_files').forEach(function (df1) {
                const file10 = df1.firstElementChild;
                file10.classList.remove('file_select');
            })
        })
        desktop_files.addEventListener('click', function () {
            const file10 = desktop_files.firstElementChild;
            file10.classList.add('file_select');
        })
    })

    document.querySelectorAll('.parent_start_menu_lists').forEach(function (parent_startmenu_lists) {
        parent_startmenu_lists.addEventListener('mouseover', function () {
            let parentstartmenulists = parent_startmenu_lists.lastElementChild;
            parentstartmenulists.style.display = "block"
        })

        parent_startmenu_lists.addEventListener('mouseleave', function () {
            document.querySelectorAll('.child_start_menu_lists').forEach(function (child_startmenu_lists) {
                child_startmenu_lists.style.display = "none";
            })
            document.querySelectorAll('.child_start_menu_lists2').forEach(function (child_startmenu_lists) {
                child_startmenu_lists.style.display = "none";
            })
            document.querySelectorAll('.child_start_menu_lists3').forEach(function (child_startmenu_lists) {
                child_startmenu_lists.style.display = "none";
            })
        })
    })

    document.querySelectorAll('.child_start_menu_lists').forEach(function (child_startmenu_lists) {
        child_startmenu_lists.addEventListener('mouseover', function () {
            let childstartmenulists = child_startmenu_lists.lastElementChild;
            childstartmenulists.style.display = "block"
        })

        child_startmenu_lists.addEventListener('mouseleave', function () {
            document.querySelectorAll('.child_start_menu_lists').forEach(function (child_startmenu_lists2) {
                child_startmenu_lists2.style.display = "none";
            })
            document.querySelectorAll('.child_start_menu_lists2').forEach(function (child_startmenu_lists2) {
                child_startmenu_lists2.style.display = "none";
            })
        })
    })

    document.querySelectorAll('.child_start_menu_lists2').forEach(function (child_startmenu_lists) {
        child_startmenu_lists.addEventListener('mouseover', function () {
            let childstartmenulists = child_startmenu_lists.lastElementChild;
            childstartmenulists.style.display = "block"
        })

        child_startmenu_lists.addEventListener('mouseleave', function () {
            document.querySelectorAll('.child_start_menu_lists').forEach(function (child_startmenu_lists2) {
                child_startmenu_lists2.style.display = "none";
            })
            document.querySelectorAll('.child_start_menu_lists2').forEach(function (child_startmenu_lists2) {
                child_startmenu_lists2.style.display = "none";
            })
            document.querySelectorAll('.child_start_menu_lists3').forEach(function (child_startmenu_lists2) {
                child_startmenu_lists2.style.display = "none";
            })
        })
    })

    document.querySelectorAll('.window_inline_menus_parent').forEach(function (parent_list) {
        parent_list.addEventListener('mousedown', function () {
            document.querySelectorAll('.menuparent1').forEach(function (menuparent1) {
                menuparent1.classList.remove('menuparent1')
            })
            document.querySelectorAll('.menuchild1').forEach(function (menuchild1) {
                menuchild1.classList.remove('menuchild1')
            })

            document.querySelectorAll('.window_inline_menus_parent').forEach(function (parent_list2) {
                parent_list2.classList.remove('select');
                const menus_child = parent_list2.lastElementChild;
                menus_child.style.display = "none"
            })
            parent_list.classList.add('select');
            const menus_child2 = parent_list.lastElementChild;
            menus_child2.style.display = "block"
        })
    })

    document.querySelectorAll('.menuchild1').forEach(function (menuchild1) {
        menuchild1.style.display = "block"
    })

    function window_back_silver() {
        document.querySelectorAll('.back_silver').forEach(function (back_silver) {
            back_silver.style.background = "silver"
        })
    }

    document.querySelectorAll('.child_windows, .child').forEach(function (z_index_child_windows) {

        const zindexchildwindows = z_index_child_windows.closest('.child_windows');
        const t_childwindows = zindexchildwindows.firstElementChild;

        z_index_child_windows.addEventListener('mousedown', function () {
            start_menu.style.display = "none";
            document.querySelector('.start_button').classList.remove('pressed');
            taskbtn_load()
            document.querySelectorAll('.title').forEach(function (wt1) {
                wt1.classList.remove('navy')
            })
            t_childwindows.classList.add('navy');

            z = largestZIndex++;
            window_z_index = zindexchildwindows.style.zIndex = z;
            getLargestZIndex('.child_windows');
            z_index.textContent = getLargestZIndex('.child_windows');

            titlecolor_set()
        });
        z_index_child_windows.addEventListener('click', function () {
            titlecolor_set()
        })
    })

    document.querySelectorAll('.note_pad, .child').forEach(function (notepad_foccus) {
        notepad_foccus.addEventListener('mouseup', function () {
            if (!note_pad.classList.contains('active')) {
                document.querySelector('.note_area').focus()
            }
        });
    })

    document.querySelectorAll('.nexser_guidebook').forEach(function (nexser_guidebook) {
        nexser_guidebook.addEventListener('click', function () {
            nexser_guidebook_menu.classList.toggle('active');
            nexser_guidebook_menu.closest('.child_windows');
            z = largestZIndex++;
            nexser_guidebook_menu.style.zIndex = z;

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            test = nexser_guidebook_menu.firstElementChild;
            test.classList.add('navy');
        });
    });
    document.querySelectorAll('.guidebook_window').forEach(function (guidebook_window) {
        guidebook_window.addEventListener('click', function () {
            guidebook_window_menu.classList.toggle('active');
            guidebook_window_menu.closest('.child_windows');
            z = largestZIndex++;
            guidebook_window_menu.style.zIndex = z;

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            test = guidebook_window_menu.firstElementChild;
            test.classList.add('navy');
        });
    });
    document.querySelectorAll('.guidebook_file').forEach(function (guidebook_file) {
        guidebook_file.addEventListener('click', function () {
            guidebook_file_menu.classList.toggle('active');
            guidebook_file_menu.closest('.child_windows');
            z = largestZIndex++;
            guidebook_file_menu.style.zIndex = z;

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            test = guidebook_file_menu.firstElementChild;
            test.classList.add('navy');
        });
    });
    document.querySelectorAll('.guidebook_taskbar').forEach(function (guidebook_taskbar) {
        guidebook_taskbar.addEventListener('click', function () {
            guidebook_taskbar_menu.classList.toggle('active');
            guidebook_taskbar_menu.closest('.child_windows');
            z = largestZIndex++;
            guidebook_taskbar_menu.style.zIndex = z;

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            test = guidebook_taskbar_menu.firstElementChild;
            test.classList.add('navy');
        });
    });

    document.querySelectorAll('.test_button').forEach(function (test_button) {
        test_button.addEventListener('click', function () {
            main.classList.toggle('active');
            main.closest('.child_windows');
            z = largestZIndex++;
            main.style.zIndex = z;

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            wt = main.firstElementChild;
            wt.classList.add('navy');
        });
    });
    document.querySelectorAll('.test_button2').forEach(function (test_button2) {
        test_button2.addEventListener('click', function () {
            my_computer.classList.toggle('active');
            my_computer.closest('.child_windows');
            z = largestZIndex++;
            my_computer.style.zIndex = z;

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            wt = my_computer.firstElementChild;
            wt.classList.add('navy');
        });
    });
    document.querySelectorAll('.test_button3').forEach(function (test_button3) {
        test_button3.addEventListener('click', function () {
            control.classList.toggle('active');
            control.closest('.child_windows');
            z = largestZIndex++;
            control.style.zIndex = z;

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            wt = control.firstElementChild;
            wt.classList.add('navy');
        });
    });
    document.querySelectorAll('.test_button4').forEach(function (test_button4) {
        test_button4.addEventListener('click', function () {
            color_menu.classList.toggle('active');
            color_menu.closest('.child_windows');
            z = largestZIndex++;
            color_menu.style.zIndex = z;

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            wt = color_menu.firstElementChild;
            wt.classList.add('navy');
        });
    });
    document.querySelectorAll('.test_button5').forEach(function (test_button5) {
        test_button5.addEventListener('click', function () {
            system_menu.classList.toggle('active');
            system_menu.closest('.child_windows');
            z = largestZIndex++;
            system_menu.style.zIndex = z;

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            wt = system_menu.firstElementChild;
            wt.classList.add('navy');
        });
    });
    document.querySelectorAll('.test_button6').forEach(function (test_button6) {
        test_button6.addEventListener('click', function () {
            window_prompt.classList.toggle('active');
            window_prompt.closest('.child_windows');
            z = largestZIndex++;
            window_prompt.style.zIndex = z;

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            wt = window_prompt.firstElementChild;
            wt.classList.add('navy');
        });
    });
    document.querySelectorAll('.test_button7').forEach(function (test_button7) {
        test_button7.addEventListener('click', function () {
            clock_menu.classList.toggle('active');
            clock_menu.closest('.child_windows');
            z = largestZIndex++;
            clock_menu.style.zIndex = z;

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            wt = clock_menu.firstElementChild;
            wt.classList.add('navy');
        });
    });
    document.querySelectorAll('.test_button8').forEach(function (test_button8) {
        test_button8.addEventListener('click', function () {
            sound_menu.classList.toggle('active');
            sound_menu.closest('.child_windows');
            z = largestZIndex++;
            sound_menu.style.zIndex = z;

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            wt = sound_menu.firstElementChild;
            wt.classList.add('navy');
        });
    });
    document.querySelectorAll('.test_button9').forEach(function (test_button9) {
        test_button9.addEventListener('click', function () {
            driver_menu.classList.toggle('active');
            driver_menu.closest('.child_windows');
            z = largestZIndex++;
            driver_menu.style.zIndex = z;

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            wt = driver_menu.firstElementChild;
            wt.classList.add('navy');
        });
    });
    document.querySelectorAll('.test_button10').forEach(function (test_button10) {
        test_button10.addEventListener('click', function () {
            mouse_menu.classList.toggle('active');
            mouse_menu.closest('.child_windows');
            z = largestZIndex++;
            mouse_menu.style.zIndex = z;

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            wt = mouse_menu.firstElementChild;
            wt.classList.add('navy');
        });
    });
    document.querySelectorAll('.test_button11').forEach(function (test_button11) {
        test_button11.addEventListener('click', function () {
            screen_text_menu.classList.toggle('active');
            screen_text_menu.closest('.child_windows');
            z = largestZIndex++;
            screen_text_menu.style.zIndex = z;

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            wt = screen_text_menu.firstElementChild;
            wt.classList.add('navy');
        });
    });
    document.querySelectorAll('.test_button12').forEach(function (test_button12) {
        test_button12.addEventListener('click', function () {
            note_pad.classList.toggle('active');
            note_pad.closest('.child_windows');
            z = largestZIndex++;
            note_pad.style.zIndex = z;
            if (!note_pad.classList.contains('active')) {
                document.querySelector('.note_area').focus()
                document.querySelectorAll('.title').forEach(function (wt1) {
                    wt1.classList.remove('navy')
                })
                const note2 = note_pad.firstElementChild;
                note2.classList.add('navy');

            }
        });
    });
    document.querySelectorAll('.test_button13').forEach(function (test_button13) {
        test_button13.addEventListener('click', function () {
            text_drop_menu.classList.toggle('active');
            text_drop_menu.closest('.child_windows');
            z = largestZIndex++;
            text_drop_menu.style.zIndex = z;

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            wt = text_drop_menu.firstElementChild;
            wt.classList.add('navy');
        });
    });
    document.querySelectorAll('.test_button14').forEach(function (test_button14) {
        test_button14.addEventListener('click', function () {
            windowmode_menu.classList.toggle('active');
            windowmode_menu.closest('.child_windows');
            z = largestZIndex++;
            windowmode_menu.style.zIndex = z;

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            wt = windowmode_menu.firstElementChild;
            wt.classList.add('navy');
        });
    });
    document.querySelectorAll('.test_button15').forEach(function (test_button15) {
        test_button15.addEventListener('click', function () {
            accessory_menu.classList.toggle('active');
            accessory_menu.closest('.child_windows');
            z = largestZIndex++;
            accessory_menu.style.zIndex = z;

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            wt = accessory_menu.firstElementChild;
            wt.classList.add('navy');
        });
    });
    document.querySelectorAll('.test_button16').forEach(function (test_button16) {
        test_button16.addEventListener('click', function () {
            calc_menu.classList.toggle('active');
            calc_menu.closest('.child_windows');
            z = largestZIndex++;
            calc_menu.style.zIndex = z;

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            wt = calc_menu.firstElementChild;
            wt.classList.add('navy');
        });
    });
    document.querySelectorAll('.test_button17').forEach(function (test_button17) {
        test_button17.addEventListener('click', function () {
            nexser_sound_menu.classList.toggle('active');
            nexser_sound_menu.closest('.child_windows');
            z = largestZIndex++;
            nexser_sound_menu.style.zIndex = z;

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            wt = nexser_sound_menu.firstElementChild;
            wt.classList.add('navy');
        });
    });
    document.querySelectorAll('.test_button18').forEach(function (test_button18) {
        test_button18.addEventListener('click', function () {
            camera_menu.classList.toggle('active');
            camera_menu.closest('.child_windows');
            z = largestZIndex++;
            camera_menu.style.zIndex = z;

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            wt = camera_menu.firstElementChild;
            wt.classList.add('navy');
        });
    });
    document.querySelectorAll('.test_button19').forEach(function (test_button19) {
        test_button19.addEventListener('click', function () {
            htmlviewer_edit_menu.classList.toggle('active');
            htmlviewer_edit_menu.closest('.child_windows');
            z = largestZIndex++;
            htmlviewer_edit_menu.style.zIndex = z;

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            wt = htmlviewer_edit_menu.firstElementChild;
            wt.classList.add('navy');
        });
    });
    document.querySelectorAll('.test_button20').forEach(function (test_button20) {
        test_button20.addEventListener('click', function () {
            htmlviewer_run_menu.classList.toggle('active');
            htmlviewer_run_menu.closest('.child_windows');
            z = largestZIndex++;
            htmlviewer_run_menu.style.zIndex = z;

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            wt = htmlviewer_run_menu.firstElementChild;
            wt.classList.add('navy');
        });
    });
    document.querySelectorAll('.test_button21').forEach(function (test_button21) {
        test_button21.addEventListener('click', function () {
            uploadvideo_menu.classList.toggle('active');
            uploadvideo_menu.closest('.child_windows');
            z = largestZIndex++;
            uploadvideo_menu.style.zIndex = z;

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            wt = uploadvideo_menu.firstElementChild;
            wt.classList.add('navy');
        });
    });
    document.querySelectorAll('.test_button22').forEach(function (test_button22) {
        test_button22.addEventListener('click', function () {
            font_menu.classList.toggle('active');
            font_menu.closest('.child_windows');
            z = largestZIndex++;
            font_menu.style.zIndex = z;

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            wt = font_menu.firstElementChild;
            wt.classList.add('navy');
        });
    });
    document.querySelectorAll('.test_button23').forEach(function (test_button23) {
        test_button23.addEventListener('click', function () {
            setting_menu.classList.toggle('active');
            setting_menu.closest('.child_windows');
            z = largestZIndex++;
            setting_menu.style.zIndex = z;

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            wt = setting_menu.firstElementChild;
            wt.classList.add('navy');
        });
    });
    document.querySelectorAll('.test_button24').forEach(function (test_button24) {
        test_button24.addEventListener('click', function () {
            debug_menu.classList.toggle('active');
            debug_menu.closest('.child_windows');
            z = largestZIndex++;
            debug_menu.style.zIndex = z;

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            wt = debug_menu.firstElementChild;
            wt.classList.add('navy');
        });
    });
    document.querySelectorAll('.test_button25').forEach(function (test_button25) {
        test_button25.addEventListener('click', function () {
            file_download_menu.classList.toggle('active');
            file_download_menu.closest('.child_windows');
            z = largestZIndex++;
            file_download_menu.style.zIndex = z;

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            wt = file_download_menu.firstElementChild;
            wt.classList.add('navy');
        });
    });
    document.querySelectorAll('.test_button26').forEach(function (test_button26) {
        test_button26.addEventListener('click', function () {
            display_menu.classList.toggle('active');
            display_menu.closest('.child_windows');
            z = largestZIndex++;
            display_menu.style.zIndex = z;

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            wt = display_menu.firstElementChild;
            wt.classList.add('navy');
        });
    });
    document.querySelectorAll('.test_button27').forEach(function (test_button27) {
        test_button27.addEventListener('click', function () {
            stopwatch_menu.classList.toggle('active');
            stopwatch_menu.closest('.child_windows');
            z = largestZIndex++;
            stopwatch_menu.style.zIndex = z;

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            wt = stopwatch_menu.firstElementChild;
            wt.classList.add('navy');
        });
    });
    document.querySelectorAll('.test_button28').forEach(function (test_button28) {
        test_button28.addEventListener('click', function () {
            comment_menu.classList.toggle('active');
            comment_menu.closest('.child_windows');
            z = largestZIndex++;
            comment_menu.style.zIndex = z;

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            wt = comment_menu.firstElementChild;
            wt.classList.add('navy');
        });
    });
    document.querySelectorAll('.test_button30').forEach(function (test_button30) {
        test_button30.addEventListener('click', function () {
            objective_menu.classList.toggle('active');
            objective_menu.closest('.child_windows');
            z = largestZIndex++;
            objective_menu.style.zIndex = z;

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            test = objective_menu.firstElementChild;
            test.classList.add('navy');
        });
    });
    document.querySelectorAll('.test_button31').forEach(function (test_button31) {
        test_button31.addEventListener('click', function () {
            calendar_menu.classList.toggle('active');
            calendar_menu.closest('.child_windows');
            z = largestZIndex++;
            calendar_menu.style.zIndex = z;

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            test = calendar_menu.firstElementChild;
            test.classList.add('navy');
        });
    });

    document.querySelectorAll('.test_button32').forEach(function (test_button32) {
        test_button32.addEventListener('click', function () {
            cpu_calc_menu.classList.toggle('active');
            cpu_calc_menu.closest('.child_windows');
            z = largestZIndex++;
            cpu_calc_menu.style.zIndex = z;

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            test = cpu_calc_menu.firstElementChild;
            test.classList.add('navy');
            cpucalc_open();
        });
    });

    document.querySelectorAll('.test_button33').forEach(function (test_button33) {
        test_button33.addEventListener('click', function () {
            browser_menu.classList.toggle('active');
            browser_menu.closest('.child_windows');
            z = largestZIndex++;
            browser_menu.style.zIndex = z;

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            test = browser_menu.firstElementChild;
            test.classList.add('navy');
        });
    });

    function cpucalc_open() {
        const cpumenu1 = document.querySelector('.cpumenu_1');

        if (!cpu_calc_menu.classList.contains('active') || cpumenu1.style.display == "block") {
            setTimeout(() => {
                document.querySelector('.cpumenu_1').style.display = "none";
                document.querySelector('.cpubuttons').style.display = "none";
                document.querySelector('.cputitle').style.display = "none";
                setTimeout(() => {
                    document.querySelector('.cpumenu_2').style.display = "block";
                    document.querySelector('.cpubuttons').style.display = "block";
                    document.querySelector('.cputitle').style.display = "flex";
                }, 0);
            }, 3000);
        }
    }

    function cpucalc_reset() {
        setTimeout(() => {
            document.querySelector('.cpumenu_1').style.display = "block";
            document.querySelector('.cpumenu_2').style.display = "none";
            document.querySelector('.cpubuttons').style.display = "none";
            document.querySelector('.cputitle').style.display = "none";
        }, 200);
    }

    // games

    document.querySelectorAll('.test_button29').forEach(function (test_button29) {
        test_button29.addEventListener('click', function () {
            tetris_mneu.classList.toggle('active');
            tetris_mneu.closest('.child_windows');
            z = largestZIndex++;
            tetris_mneu.style.zIndex = z;

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            wt = tetris_mneu.firstElementChild;
            wt.classList.add('navy');
        });
    });

    document.querySelector('.time').addEventListener('click', function () {
        taskbtn_load()
    })

    document.querySelectorAll('.note_drag').forEach(function (note_drag) {
        note_drag.addEventListener('mousedown', function () {
            const notedrag = note_drag.closest('.child_windows');
            if (notedrag.classList.contains('leftwindow')) {
                const notearea = document.querySelector('.note_area');
                notearea.style.height = "41.5vh";
                notearea.style.width = "";
                notearea.style.resize = "none";
            }
            if (notedrag.classList.contains('rightwindow')) {
                const notearea = document.querySelector('.note_area');
                notearea.style.height = "41.5vh";
                notearea.style.width = "";
                notearea.style.resize = "none";
            }
        })
    })

    document.querySelectorAll('.drag_button').forEach(function (drag) {
        drag.addEventListener('mousedown', function () {
            const dragwindow = drag.closest('.child_windows');
            const dragwindow2 = dragwindow.lastElementChild;
            if (dragwindow.classList.contains('leftwindow')) {
                dragwindow.style.height = "55%";
                dragwindow.style.width = "55%";
                dragwindow2.style.bottom = "0";
                dragwindow.classList.remove('leftwindow');

                dragwindow.style.transition = "0.08s cubic-bezier(0, 0, 1, 1)";
                setTimeout(() => {
                    dragwindow.style.transition = ""
                }, 100);
            }
            if (dragwindow.classList.contains('rightwindow')) {
                dragwindow.style.height = "55%";
                dragwindow.style.width = "55%";
                dragwindow2.style.bottom = "0";
                dragwindow.classList.remove('rightwindow');

                dragwindow.style.transition = "0.08s cubic-bezier(0, 0, 1, 1)";
                setTimeout(() => {
                    dragwindow.style.transition = ""
                }, 100);
            }
        })
        let drag2 = drag.closest('.child_windows');
        //要素内のクリックされた位置を取得するグローバル（のような）変数
        var x;
        var y;
        //マウスが要素内で押されたとき、又はタッチされたとき発火
        drag.addEventListener("mousedown", mdown, { passive: false }, false);
        drag.addEventListener("touchstart", mdown, { passive: false }, false);
        //マウスが押された際の関数
        function mdown(e) {
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
            document.body.addEventListener("mousemove", mmove, { passive: false }, false);
            document.body.addEventListener("touchmove", mmove, { passive: false }, false);
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
            //マウスが動いた場所に要素を動かす
            drag.style.top = event.pageY - y + "px";
            drag.style.left = event.pageX - x + "px";
            //マウスボタンが離されたとき、またはカーソルが外れたとき発火
            drag.addEventListener("mouseup", mup, false);
            document.body.addEventListener("mouseleave", mup, false);
            drag.addEventListener("touchend", mup, false);
            document.body.addEventListener("touchleave", mup, false);
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
            document.body.removeEventListener("touchmove", { passive: false }, mmove, false);
            drag.removeEventListener("touchend", { passive: false }, mup, false);
            //クラス名 .drag も消す
            drag.classList.remove("drag");
            document.querySelectorAll('.title').forEach(function (title) {
                document.querySelector('.navy').style.background = ""
                window_prompt.style.background = "rgb(51, 51, 184)"
                window_back_silver()
            })
            // 半透明
            document.querySelectorAll('.child_windows').forEach(function (title) {
                title.style.opacity = "";
                window_prompt.style.background = "rgb(51, 51, 184)"
                window_back_silver()
            })
            // 移動してる時だけ黒枠のみ
            document.querySelectorAll('.child_windows').forEach(function (title) {
                title.style.background = "";
                title.style.border = "";
                document.querySelector('iframe').style.opacity = "";
                window_prompt.style.background = "rgb(51, 51, 184)"
                window_back_silver()
            })
            document.querySelectorAll('.title,.title2,.title_buttons,.window_inline_list,.mini_window,button,input,textarea,p,#prompt2,.window_inline_list2').forEach(function (title) {
                title.style.opacity = ""
                window_back_silver()
            })
        }
    })


    function check(elm1, elm2) {

        const d1 = elm1.getBoundingClientRect();
        const d2 = elm2.getBoundingClientRect();

        return !(
            d1.top > d2.bottom ||
            d1.right < d2.left ||
            d1.bottom < d2.top ||
            d1.left > d2.right
        );

    }

    const elm1 = document.getElementById('taskbar');
    const elm2 = document.getElementById('toolbar');

    document.querySelectorAll('.drag_button2').forEach(function (drag) {
        let drag2 = drag.closest('#toolbar');
        //要素内のクリックされた位置を取得するグローバル（のような）変数
        var x;
        var y;
        //マウスが要素内で押されたとき、又はタッチされたとき発火
        drag.addEventListener("mousedown", mdown, { passive: false }, false);
        drag.addEventListener("touchstart", mdown, { passive: false }, false);
        //マウスが押された際の関数
        function mdown(e) {
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
            drag.classList.remove("drag");

            if (check(elm1, elm2) && localStorage.getItem('taskbar_position_button')) {
                toolbar.style.top = "40px";
            } else if (check(elm1, elm2)) {
                toolbar.style.top = "";
            }

        }
    })

    document.querySelector('.toolbar_on').addEventListener('click', function () {
        const toolbar_on = document.querySelector('.toolbar_on');
        localStorage.setItem('toolbar_on', toolbar_on);
        toolbar.style.display = "block"
    })
    document.querySelector('.toolbar_off').addEventListener('click', function () {
        localStorage.removeItem('toolbar_on');
        toolbar.style.display = "none"
    })

    document.querySelector('.filettext_backcolor_off').addEventListener('click', function () {
        const filettext_backcolor_off = document.querySelector('.filettext_backcolor_off');
        localStorage.setItem('filettext_backcolor_off', filettext_backcolor_off);
        filettext_backcolor()
    })
    document.querySelector('.filettext_backcolor_on').addEventListener('click', function () {
        localStorage.removeItem('filettext_backcolor_off');
        filettext_backcolor()
    })

    document.querySelector('.saver_on').addEventListener('click', function () {
        const saver_on = document.querySelector('.saver_on');
        localStorage.setItem('saver_on', saver_on);
        document.querySelector('.saver_mode').textContent = "ON"
    })
    document.querySelector('.saver_off').addEventListener('click', function () {
        localStorage.removeItem('saver_on');
        document.querySelector('.saver_mode').textContent = "OFF"
    })


    document.querySelector('.display_old').addEventListener('click', function () {
        const display_old = document.querySelector('.display_old');
        localStorage.setItem('display_old', display_old);
        old_screen();
    })
    document.querySelector('.display_now').addEventListener('click', function () {
        localStorage.removeItem('display_old');
        old_screen_reset();
    })

    document.querySelector('.list_shadow_on').addEventListener('click', function () {
        const list_shadow_on = document.querySelector('.list_shadow_on');
        localStorage.setItem('list_shadow_on', list_shadow_on);
        list_shadow();
    })
    document.querySelector('.list_shadow_off').addEventListener('click', function () {
        localStorage.removeItem('list_shadow_on');
        list_shadow_reset();
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
        } else {
            document.querySelector('.window_error_text').textContent = "driver color no install!"
            error_windows.classList.remove('active')
            prompt_text2.style.color = "";
            sound3()
            document.querySelector('.test_allwindow').style.display = "block";
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
                document.querySelectorAll('.desktop_files').forEach(function (desktop_files) {
                    const deskfile_text = desktop_files.firstElementChild;
                    deskfile_text.style.color = "black"
                })
            } else {
                background_text.style.color = ""
                document.getElementById('background_text2').style.color = ""
                document.querySelectorAll('.desktop_files').forEach(function (desktop_files) {
                    const deskfile_text = desktop_files.firstElementChild;
                    deskfile_text.style.color = ""
                })
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
            } else {
                document.querySelector('.window_error_text').textContent = "driver color no install!"
                error_windows.classList.remove('active')
                prompt_text2.style.color = "";
                sound3()
                document.querySelector('.test_allwindow').style.display = "block";
            }
        });
        // ローカルストレージの内容をチェック
        getStorage();
    });

    document.querySelectorAll('.color_btn').forEach(function (color_btn) {
        color_btn.addEventListener('click', function () {
            titlecolor_remove();
            if (localStorage.getItem('driver_color')) {
                titlecolor_set();
            } else {
                document.querySelector('.window_error_text').textContent = "driver color no install!"
                error_windows.classList.remove('active')
                sound3()
                document.querySelector('.test_allwindow').style.display = "block";
            }
            document.querySelectorAll('.title').forEach(function (title) {
                title.style.background = "";
            });
            document.querySelectorAll('.navy').forEach(function (navy) {
                navy.style.background = "";
            });
        })
    });

    function titlecolor_remove() {
        document.querySelectorAll('.title').forEach(function (title) {
            title.style.background = "";
        });
        document.querySelectorAll('.navy').forEach(function (navy) {
            navy.style.background = "";
        });
        localStorage.removeItem('titlebar_red');
        localStorage.removeItem('titlebar_blue');
        localStorage.removeItem('titlebar_green');
        localStorage.removeItem('titlebar_yellow');
        localStorage.removeItem('titlebar_orange');
        localStorage.removeItem('titlebar_pink');
        localStorage.removeItem('titlebar_purple');
        localStorage.removeItem('titlebar_black');
    }

    document.querySelector('.titlebar_red').addEventListener('click', function () {
        const titlebar_red = document.querySelector('.titlebar_red');
        localStorage.setItem('titlebar_red', titlebar_red);
    })
    document.querySelector('.titlebar_blue').addEventListener('click', function () {
        const titlebar_blue = document.querySelector('.titlebar_blue');
        localStorage.setItem('titlebar_blue', titlebar_blue);
    })
    document.querySelector('.titlebar_green').addEventListener('click', function () {
        const titlebar_green = document.querySelector('.titlebar_green');
        localStorage.setItem('titlebar_green', titlebar_green);
    })
    document.querySelector('.titlebar_yellow').addEventListener('click', function () {
        const titlebar_yellow = document.querySelector('.titlebar_yellow');
        localStorage.setItem('titlebar_yellow', titlebar_yellow);
    })
    document.querySelector('.titlebar_orange').addEventListener('click', function () {
        const titlebar_orange = document.querySelector('.titlebar_orange');
        localStorage.setItem('titlebar_orange', titlebar_orange);
    })
    document.querySelector('.titlebar_pink').addEventListener('click', function () {
        const titlebar_pink = document.querySelector('.titlebar_pink');
        localStorage.setItem('titlebar_pink', titlebar_pink);
    })
    document.querySelector('.titlebar_purple').addEventListener('click', function () {
        const titlebar_purple = document.querySelector('.titlebar_purple');
        localStorage.setItem('titlebar_purple', titlebar_purple);
    })
    document.querySelector('.titlebar_black').addEventListener('click', function () {
        const titlebar_black = document.querySelector('.titlebar_black');
        localStorage.setItem('titlebar_black', titlebar_black);
    })

    function titlecolor_set() {
        if (localStorage.getItem('driver_color')) {
            if (localStorage.getItem('titlebar_red')) {
                document.querySelectorAll('.title').forEach(function (title) {
                    title.style.background = "#440000";
                });
                document.querySelectorAll('.navy').forEach(function (navy) {
                    navy.style.background = "red";
                });
            }
            if (localStorage.getItem('titlebar_blue')) {
                document.querySelectorAll('.title').forEach(function (title) {
                    title.style.background = "#000044";
                });
                document.querySelectorAll('.navy').forEach(function (navy) {
                    navy.style.background = "blue";
                });
            }
            if (localStorage.getItem('titlebar_green')) {
                document.querySelectorAll('.title').forEach(function (title) {
                    title.style.background = "#004400";
                });
                document.querySelectorAll('.navy').forEach(function (navy) {
                    navy.style.background = "green";
                });
            }
            if (localStorage.getItem('titlebar_yellow')) {
                document.querySelectorAll('.title').forEach(function (title) {
                    title.style.background = "#FFFFAA";
                });
                document.querySelectorAll('.navy').forEach(function (navy) {
                    navy.style.background = "yellow";
                });
            }
            if (localStorage.getItem('titlebar_orange')) {
                document.querySelectorAll('.title').forEach(function (title) {
                    title.style.background = "#FFAD90";
                });
                document.querySelectorAll('.navy').forEach(function (navy) {
                    navy.style.background = "orange";
                });
            }
            if (localStorage.getItem('titlebar_pink')) {
                document.querySelectorAll('.title').forEach(function (title) {
                    title.style.background = "#FF00FF";
                });
                document.querySelectorAll('.navy').forEach(function (navy) {
                    navy.style.background = "pink";
                });
            }
            if (localStorage.getItem('titlebar_purple')) {
                document.querySelectorAll('.title').forEach(function (title) {
                    title.style.background = "#5507FF";
                });
                document.querySelectorAll('.navy').forEach(function (navy) {
                    navy.style.background = "purple";
                });
            }
            if (localStorage.getItem('titlebar_black')) {
                document.querySelectorAll('.title').forEach(function (title) {
                    title.style.background = "#555555";
                });
                document.querySelectorAll('.navy').forEach(function (navy) {
                    navy.style.background = "black";
                });
            }
        }
    }



    document.querySelectorAll('.pattern_btn').forEach(function (color_btn) {
        color_btn.addEventListener('click', function () {
            back_pattern_remove();
        });
    })

    function back_pattern_remove() {
        document.querySelector('.backgrounds1').style.display = "none";
        document.querySelector('.backgrounds2').style.display = "none";
        document.querySelector('.backgrounds3').style.display = "none";
        document.querySelector('.backgrounds4').style.display = "none";
        document.querySelector('.backgrounds5').style.display = "none";
        document.querySelector('.backgrounds6').style.display = "none";
        document.querySelector('.backgrounds7').style.display = "none";
        document.querySelector('.backgrounds8').style.display = "none";
        localStorage.removeItem('back_pattern_1');
        localStorage.removeItem('back_pattern_2');
        localStorage.removeItem('back_pattern_3');
        localStorage.removeItem('back_pattern_4');
        localStorage.removeItem('back_pattern_5');
        localStorage.removeItem('back_pattern_6');
        localStorage.removeItem('back_pattern_7');
        localStorage.removeItem('back_pattern_8');
    }

    document.querySelector('.back_pattern_1').addEventListener('click', function () {
        const back_pattern_1 = document.querySelector('.back_pattern_1');
        localStorage.setItem('back_pattern_1', back_pattern_1);
        back_pattern_set()
    })
    document.querySelector('.back_pattern_2').addEventListener('click', function () {
        const back_pattern_2 = document.querySelector('.back_pattern_2');
        localStorage.setItem('back_pattern_2', back_pattern_2);
        back_pattern_set()
    })
    document.querySelector('.back_pattern_3').addEventListener('click', function () {
        const back_pattern_3 = document.querySelector('.back_pattern_3');
        localStorage.setItem('back_pattern_3', back_pattern_3);
        back_pattern_set()
    })
    document.querySelector('.back_pattern_4').addEventListener('click', function () {
        const back_pattern_4 = document.querySelector('.back_pattern_4');
        localStorage.setItem('back_pattern_4', back_pattern_4);
        back_pattern_set()
    })
    document.querySelector('.back_pattern_5').addEventListener('click', function () {
        const back_pattern_5 = document.querySelector('.back_pattern_5');
        localStorage.setItem('back_pattern_5', back_pattern_5);
        back_pattern_set()
    })
    document.querySelector('.back_pattern_6').addEventListener('click', function () {
        const back_pattern_6 = document.querySelector('.back_pattern_6');
        localStorage.setItem('back_pattern_6', back_pattern_6);
        back_pattern_set()
    })
    document.querySelector('.back_pattern_7').addEventListener('click', function () {
        const back_pattern_7 = document.querySelector('.back_pattern_7');
        localStorage.setItem('back_pattern_7', back_pattern_7);
        back_pattern_set()
    })
    document.querySelector('.back_pattern_8').addEventListener('click', function () {
        const back_pattern_8 = document.querySelector('.back_pattern_8');
        localStorage.setItem('back_pattern_8', back_pattern_8);
        back_pattern_set()
    })

    function back_pattern_set() {
        if (localStorage.getItem('back_pattern_1')) {
            document.querySelector('.backgrounds1').style.display = "block";
        }
        if (localStorage.getItem('back_pattern_2')) {
            document.querySelector('.backgrounds2').style.display = "block";
        }
        if (localStorage.getItem('back_pattern_3')) {
            document.querySelector('.backgrounds3').style.display = "block";
        }
        if (localStorage.getItem('back_pattern_4')) {
            document.querySelector('.backgrounds4').style.display = "block";
        }
        if (localStorage.getItem('back_pattern_5')) {
            document.querySelector('.backgrounds5').style.display = "block";
        }
        if (localStorage.getItem('back_pattern_6')) {
            document.querySelector('.backgrounds6').style.display = "block";
        }
        if (localStorage.getItem('back_pattern_7')) {
            document.querySelector('.backgrounds7').style.display = "block";
        }
        if (localStorage.getItem('back_pattern_8')) {
            document.querySelector('.backgrounds8').style.display = "block";
        }
    }


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

    function taskgroup_load() {
        setTimeout(() => {
            var date = new Date();
            var year = date.getFullYear();
            var month = date.getMonth() + 1;
            var day = date.getDate();
            document.querySelector('.date_day').textContent = (year + "/" + month + "/" + day + "");
            var hours = date.getHours().toString().padStart(2, '0');
            var minutes = date.getMinutes().toString().padStart(2, '0');
            var seconds = date.getSeconds().toString().padStart(2, '0');
            var clock = document.querySelectorAll('.date_clock, .date_clock2');
            clock.forEach(function (clock_text) {
                clock_text.textContent = (hours + ":" + minutes + ":" + seconds + "");
            });
            navigator.getBattery().then(function (battery) {
                if (battery.level == 1 && battery.charging == true) {
                    document.querySelector('.battery_child').style.color = "lime"
                    document.querySelector('.battery_child').style.background = "black"
                } else if (battery.charging == false) {
                    document.querySelector('.battery_child').style.color = "black"
                    document.querySelector('.battery_child').style.background = ""
                } else {
                    document.querySelector('.battery_child').style.color = "#FF9900"
                    document.querySelector('.battery_child').style.background = "black"
                }

                if (battery.level == 0.20 && battery.charging == false) {
                    document.querySelector('.notice_text').textContent = "バッテリー残量が少なくなっています!(※充電しない限りこの表示は残り続けます。)"
                    notice_menu.style.left = "0px";
                    notice_menu.classList.remove('active');
                } else {
                    notice_menu.classList.add('active');
                }
            })
            taskgroup_load();
        }, 100)
    }

    const nowdate = new Date();
    const yeardate = nowdate.getFullYear();
    const monthdate = nowdate.getMonth();
    const dates = nowdate.getDate();
    const hourdate = nowdate.getHours();
    const mindate = nowdate.getMinutes();
    let ampm = '';
    if (hourdate < 12) {
        ampm = 'AM';
    } else {
        ampm = 'PM';
    }

    const outputdate = `${yeardate}/${monthdate + 1}/${dates}/${hourdate % 12}:${mindate}${ampm}`;
    document.getElementById('lastaccess_day').textContent = outputdate;

    // 右クリックイベントの登録
    document.getElementById("button1").addEventListener("contextmenu", function (event) {
        event.preventDefault();
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
            localStorage.removeItem('note_texts');
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

    function objective_save() {
        if (objective_form.objective_area.value === "" && objective_title_form.objective_title_area.value === "") {
            document.querySelector('.window_error_text').textContent = "タイトルと内容が入力されていません!"
            error_windows.classList.remove('active')
            sound3()
            document.querySelector('.test_allwindow').style.display = "block";
        } else if (objective_title_form.objective_title_area.value === "") {
            document.querySelector('.window_error_text').textContent = "タイトルが入力されていません!"
            error_windows.classList.remove('active')
            sound3()
            document.querySelector('.test_allwindow').style.display = "block";
        } else if (objective_form.objective_area.value === "") {
            document.querySelector('.window_error_text').textContent = "内容が入力されていません!"
            error_windows.classList.remove('active')
            sound3()
            document.querySelector('.test_allwindow').style.display = "block";
        }
        if (!objective_title_form.objective_title_area.value == "" || !objective_form.objective_area.value == "") {
            let objectiveTitleData = document.objective_title_form.objective_title_area.value;
            localStorage.setItem('objectiveTitleData', objectiveTitleData);
            let objectiveData = document.objective_form.objective_area.value;
            localStorage.setItem('objectiveData', objectiveData);
        }

    }

    document.querySelector('.note_close').addEventListener('click', function () {
        setTimeout(() => {
            if (!localStorage.getItem('noteData')) {
                document.querySelector('.note_title').textContent = "notepad";
            }
            if (!note_pad.classList.contains('active') && localStorage.getItem('noteData') && !localStorage.getItem('note_texts')) {
                note_pad.classList.add('active');
                taskbtn_load();
            } else if (localStorage.getItem('note_texts')) {
                document.querySelector('.warning_title_text').textContent = "notepad"
                document.querySelector('.window_warning_text').textContent = "notepad no save window close?(text allremove)"
                warning_windows.style.display = "block"
                document.querySelector('.close_button3').style.display = "block"
                sound5()
                document.querySelector('.test_allwindow').style.display = "block";
                document.querySelector('.shutdown_button').style.display = "none";
                document.querySelector('.warningclose_button').style.display = "block";
            } else {
                localStorage.removeItem('note_texts');
                note_pad.classList.add('active');
                taskbtn_load();
            }
        }, 100);
    })


    document.querySelector('.objective_close').addEventListener('click', function () {
        setTimeout(() => {
            if (!objective_menu.classList.contains('active') && localStorage.getItem('objectiveData') || localStorage.getItem('objectiveTitleData')) {
                objective_menu.classList.add('active');
                taskbtn_load();
            } else {
                document.querySelector('.warning_title_text').textContent = "objective sheet"
                document.querySelector('.window_warning_text').textContent = "タイトル もしくは 内容を保存してから閉じてください";
                warning_windows.style.display = "block"
                document.querySelector('.close_button3').style.display = "block"
                sound5()
                document.querySelector('.test_allwindow').style.display = "block";
                document.querySelector('.shutdown_button').style.display = "none";
                document.querySelector('.warningclose_button').style.display = "none";
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
            resetShowLength();
            localStorage.removeItem('note_texts');
            note_pad.classList.add('active');
            taskbtn_load()
        }, 100);
    }

    function notedata_clear() {
        localStorage.removeItem('noteData');
        const memo_save = document.getElementById('memo_save_text');
        memo_save.textContent = "";
        const note_texts = document.querySelector('.note_area');
        localStorage.setItem('note_texts', note_texts);
        document.querySelector('.note_title').textContent = "notepad"
    }
    document.getElementById('cleartextbtn').addEventListener('click', function () {
        document.getElementsByClassName("note_area")[0].value = '';
        const memo_save = document.getElementById('memo_save_text');
        memo_save.textContent = "";
        resetShowLength();

        const note_texts = document.querySelector('.note_area');
        localStorage.setItem('note_texts', note_texts);
    });
    document.getElementById('cleartextbtn2').addEventListener('click', function () {
        localStorage.removeItem('textdropdata');
        document.querySelector(".drop_area").value = '';
        const memo_save2 = document.getElementById('drop_save_text');
        memo_save2.textContent = "";
    });
    document.getElementById('cleartextbtn3').addEventListener('click', function () {
        document.querySelector(".objective_area").value = '';
        document.querySelector(".objective_title_area").value = '';
    });

    function objectiveData_clear() {
        localStorage.removeItem('objectiveData');
        localStorage.removeItem('objectiveTitleData');
        document.querySelector(".objective_area").value = '';
        document.querySelector(".objective_title_area").value = '';
    }

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
        const note_texts = document.querySelector('.note_area');
        localStorage.setItem('note_texts', note_texts);
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

    function objective_load() {
        let objectiveTitleData = "";
        let objectiveData = "";
        if (!localStorage.getItem('objectiveTitleData')) {
            objectiveTitleData = "";
        }
        else {
            objectiveTitleData = localStorage.getItem('objectiveTitleData');
        }
        document.objective_title_form.objective_title_area.value = objectiveTitleData;

        if (!localStorage.getItem('objectiveData')) {
            objectiveData = "";
        }
        else {
            objectiveData = localStorage.getItem('objectiveData');
        }
        document.objective_form.objective_area.value = objectiveData;
    }

    function win2000_load() {
        if (localStorage.getItem('MemoData_export')) {
            document.querySelector('.notice_text').textContent = "winodws2000からテキストデータを受け取りました!"
            const old_windows_data = localStorage.getItem('MemoData_export');
            const a = document.querySelector('.note_area');
            a.textContent = (old_windows_data);
            localStorage.removeItem('MemoData_export');

            notice_menu.style.left = "0px";
            notice_menu.classList.remove('active');

            setTimeout(() => {
                notice_menu.classList.add('active');
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
    dr.addEventListener('dragover', supportsPassive ? { passive: true } : false, function (evt) {
        evt.preventDefault();
    });
    dr.addEventListener('drop', function (evt) {
        if (!localStorage.getItem('textdropdata')) {
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
        calc();
    }

    function calc_clear() {
        const child_graph = document.querySelector(".child_graph");
        child_graph.style.height = "0%"
        child_graph.style.background = "";
        calc_result.value = "";
    }

    function window_file_list_change() {
        document.querySelectorAll('.window_inline_list').forEach(function (window_inline_list) {
            window_inline_list.style.columnCount = "1";
            window_inline_list.style.display = "block";
        });
        document.querySelectorAll('.window_file_icon, .window_file_icon2').forEach(function (window_file_icon) {
            window_file_icon.style.width = "30px";
            window_file_icon.style.height = "20px";
            window_file_icon.style.marginBottom = "-20px";
        });
        document.querySelectorAll('.window_files').forEach(function (window_files) {
            window_files.style.margin = "0px";
            window_files.style.paddingTop = "10px";
            window_files.style.width = "100%";
            let sss = window_files.firstElementChild;
            sss2 = sss.style.paddingLeft = "50px";
            sss2 = sss.style.width = "";
        });
    }
    function window_file_list_reset() {
        document.querySelectorAll('.window_inline_list').forEach(function (window_inline_list) {
            window_inline_list.style.columnCount = "";
            window_inline_list.style.display = "flex";
        });
        document.querySelectorAll('.window_file_icon, .window_file_icon2').forEach(function (window_file_icon) {
            window_file_icon.style.width = "";
            window_file_icon.style.height = "";
            window_file_icon.style.marginBottom = "";
        });
        document.querySelectorAll('.window_files').forEach(function (window_files) {
            window_files.style.margin = "";
            window_files.style.paddingTop = "";
            window_files.style.width = "";
            let sss = window_files.firstElementChild;
            sss2 = sss.style.paddingLeft = "";
            sss2 = sss.style.width = "";
        });
    }

    filettext_backcolor()

    function filettext_backcolor() {
        if (localStorage.getItem('filettext_backcolor_off')) {
            var desktop_files_text = document.getElementsByClassName('desktop_files_text');
            for (var i = 0, len = desktop_files_text.length; i < len; i++) {
                desktop_files_text[i].style.background = "rgba(0, 0, 0, 0)";
            }
        } else {
            var desktop_files_text = document.getElementsByClassName('desktop_files_text');
            for (var i = 0, len = desktop_files_text.length; i < len; i++) {
                desktop_files_text[i].style.background = ""
            }
        }
    }

    document.querySelector('.windowfile1').addEventListener('click', function () {
        const windowfile_1 = document.querySelector('.windowfile1');
        localStorage.setItem('windowfile_1', windowfile_1);
        localStorage.removeItem('windowfile_2')
        window_file_list_change()
    })
    document.querySelector('.windowfile2').addEventListener('click', function () {
        const windowfile_2 = document.querySelector('.windowfile1');
        localStorage.setItem('windowfile_2', windowfile_2);
        localStorage.removeItem('windowfile_1')
        window_file_list_reset()
    })


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

    document.querySelector('.files_inline, .child').addEventListener('mousedown', function () {
        getLargestZIndex('.child_windows');
        z_index.textContent = getLargestZIndex('.child_windows');
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

            document.querySelector('.files_inline').style.top = "auto"
            document.querySelector('.files_inline').style.bottom = ""

            document.querySelectorAll('.big').forEach(function (child_win_posi) {
                child_win_posi.style.top = "auto"
            })
            document.querySelectorAll('.leftwindow').forEach(function (child_win_posi2) {
                child_win_posi2.style.top = "auto"
            })
            document.querySelectorAll('.rightwindow').forEach(function (child_win_posi3) {
                child_win_posi3.style.top = "auto"
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

            document.querySelector('.files_inline').style.top = "40px"
            document.querySelector('.files_inline').style.bottom = "auto"

            document.querySelectorAll('.big').forEach(function (child_win_posi) {
                child_win_posi.style.transition = "";
                child_win_posi.style.top = "40px";
            })
            document.querySelectorAll('.leftwindow').forEach(function (child_win_posi2) {
                child_win_posi2.style.transition = "";
                child_win_posi2.style.top = "40px";
            })
            document.querySelectorAll('.rightwindow').forEach(function (child_win_posi3) {
                child_win_posi3.style.transition = "";
                child_win_posi3.style.top = "40px";
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
        document.querySelectorAll('.desktop_files').forEach(function (df1) {
            const file10 = df1.firstElementChild;
            file10.classList.remove('file_select');
        })
    }

    function batterylevel() {
        setTimeout(() => {
            navigator.getBattery().then(function (battery) {
                let bu = document.querySelector('.taskbattery');
                bu2 = bu.innerHTML = Math.floor(battery.level * 100);
            });
            navigator.getBattery().then((battery) => {
                if (battery.charging == true) {
                    document.querySelector('.battery_time').textContent = (`${battery.dischargingTime}`);
                } else if (battery.charging == false) {
                    document.querySelector('.battery_time').textContent = (`${battery.dischargingTime}` + "seconds");
                }
            })
            batterylevel();
        }, 100);
    }

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
            z = largestZIndex++;
            htmlviewer_run_menu.style.zIndex = z;

            document.querySelectorAll('.title').forEach(function (wt) {
                wt.classList.remove('navy')
            })
            wt = htmlviewer_run_menu.firstElementChild;
            wt.classList.add('navy');
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

    function preview2_play() {
        const videoElement = document.querySelector('.preview2');
        videoElement.play();
    }
    function preview2_stop() {
        const videoElement = document.querySelector('.preview2');
        videoElement.pause();
    }

    function video_stop() {
        const playerWindow = document.querySelector('.video3').contentWindow;
        playerWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
    }

    function cpubench() {
        start = (new Date()).getTime();
        n = 0;
        for (i = 0; i < 10000; i++) {
            for (j = 0; j < 10000; j++) {
                n = (n + i) / j;
            }
        }
        end = (new Date()).getTime();
        cputime = (end - start) / 1000;
        document.querySelector('.cpu_run_text').textContent = ('計算時間は' + cputime + '秒でした');
    }
    function cpubench2() {
        start = (new Date()).getTime();
        n = 0;
        for (i = 0; i < 15000; i++) {
            for (j = 0; j < 15000; j++) {
                n = (n + i) / j;
            }
        }
        end = (new Date()).getTime();
        cputime = (end - start) / 1000;
        document.querySelector('.cpu_run_text2').textContent = ('計算時間は' + cputime + '秒でした');
    }
    function cpubench3() {
        start = (new Date()).getTime();
        n = 0;
        for (i = 0; i < 20000; i++) {
            for (j = 0; j < 20000; j++) {
                n = (n + i) / j;
            }
        }
        end = (new Date()).getTime();
        cputime = (end - start) / 1000;
        document.querySelector('.cpu_run_text3').textContent = ('計算時間は' + cputime + '秒でした');
    }
    function cpubench4() {
        start = (new Date()).getTime();
        n = 0;
        for (i = 0; i < 25000; i++) {
            for (j = 0; j < 25000; j++) {
                n = (n + i) / j;
            }
        }
        end = (new Date()).getTime();
        cputime = (end - start) / 1000;
        document.querySelector('.cpu_run_text4').textContent = ('計算時間は' + cputime + '秒でした');
    }

    function cpubench_clear() {
        document.querySelector('.cpu_run_text').textContent = "";
        document.querySelector('.cpu_run_text2').textContent = "";
        document.querySelector('.cpu_run_text3').textContent = "";
        document.querySelector('.cpu_run_text4').textContent = "";
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
        let len = events.length;

        // タイマー設定
        function setTimer() {
            timeoutId = setTimeout(server, sec * 1000);
        }
        function resetTimer() {
            clearTimeout(timeoutId);
            setTimer();
            if (localStorage.getItem('saver_on')) {
                document.querySelector('.saver_time').textContent = (len = 0);
            } else {
                document.querySelector('.saver_time').textContent = "none";
            }
            if (screen_saver_group.style.display == "block") {
                document.querySelector('html').style.cursor = '';
                document.querySelector('.screen_saver1').style.display = "none"
            }
        }

        // イベント設定
        function setEvents(func) {
            while (len--) {
                addEventListener(events[len], func, false);
            }
            setInterval(() => {
                if (localStorage.getItem('saver_on')) {
                    document.querySelector('.saver_time').textContent = (len++);
                } else {
                    document.querySelector('.saver_time').textContent = "none";
                }
            }, 1000);
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

    // calendar


    const week = ["日", "月", "火", "水", "木", "金", "土"];
    const today = new Date();
    // 月末だとずれる可能性があるため、1日固定で取得
    var showDate = new Date(today.getFullYear(), today.getMonth(), 1);

    // 初期表示
    function caload() {
        showProcess(today, calendar);
    };
    // 前の月表示
    function c_prev() {
        showDate.setMonth(showDate.getMonth() - 1);
        showProcess(showDate);
    }

    // 次の月表示
    function c_next() {
        showDate.setMonth(showDate.getMonth() + 1);
        showProcess(showDate);
    }

    // カレンダー表示
    function showProcess(date) {
        var year = date.getFullYear();
        var month = date.getMonth();
        document.querySelector('#header').innerHTML = year + "年 " + (month + 1) + "月";

        var calendar = createProcess(year, month);
        document.querySelector('#calendar').innerHTML = calendar;
    }

    // カレンダー作成
    function createProcess(year, month) {
        // 曜日
        var calendar = "<table><tr class='dayOfWeek'>";
        for (var i = 0; i < week.length; i++) {
            calendar += "<th>" + week[i] + "</th>";
        }
        calendar += "</tr>";

        var count = 0;
        var startDayOfWeek = new Date(year, month, 1).getDay();
        var endDate = new Date(year, month + 1, 0).getDate();
        var lastMonthEndDate = new Date(year, month, 0).getDate();
        var row = Math.ceil((startDayOfWeek + endDate) / week.length);

        // 1行ずつ設定
        for (var i = 0; i < row; i++) {
            calendar += "<tr>";
            // 1colum単位で設定
            for (var j = 0; j < week.length; j++) {
                if (i == 0 && j < startDayOfWeek) {
                    // 1行目で1日まで先月の日付を設定
                    calendar += "<td class='disabled'>" + (lastMonthEndDate - startDayOfWeek + j + 1) + "</td>";
                } else if (count >= endDate) {
                    // 最終行で最終日以降、翌月の日付を設定
                    count++;
                    calendar += "<td class='disabled'>" + (count - endDate) + "</td>";
                } else {
                    // 当月の日付を曜日に照らし合わせて設定
                    count++;
                    if (year == today.getFullYear()
                        && month == (today.getMonth())
                        && count == today.getDate()) {
                        calendar += "<td class='today'>" + count + "</td>";
                    } else {
                        calendar += "<td>" + count + "</td>";
                    }
                }
            }
            calendar += "</tr>";
        }
        return calendar;
    }

    // progress
    // プログレスバーの進捗値
    var val;
    // 一定間隔で処理を行うintervalのIDを保持
    var intervalID;

    // ボタンを押した時に動く関数
    function func1() {
        document.getElementById("myProgress").style.display = "block"
        val = 0;
        document.getElementById("myProgress").value = val;
        // 50msおきにプログレスバーを更新する
        intervalID = setInterval("updateProgress()", 0);
    }

    // プログレスバーを更新する
    function updateProgress() {
        // プログレスバーの進捗値を更新し、プログレスバーに反映させる
        val += 1;
        document.getElementById("myProgress").value = val;
        document.getElementById("myProgress").innerText = val + "%";
        // console.log("progress:", val, "%");

        // 最大値まで達したら終了
        if (val == 100) {
            clearInterval(intervalID);
            setTimeout(() => {
                document.getElementById("myProgress").style.display = "none";
                val = 0;
            }, 1000);
        }
    }

    function func2() {
        document.getElementById("myProgress").style.display = "block"
        val = 0;
        document.getElementById("myProgress").value = val;
        // 50msおきにプログレスバーを更新する
        intervalID = setInterval("updateProgress2()", 0);
    }

    // プログレスバーを更新する
    function updateProgress2() {
        // プログレスバーの進捗値を更新し、プログレスバーに反映させる
        val += 20;
        document.getElementById("myProgress").value = val;
        document.getElementById("myProgress").innerText = val + "%";
        // console.log("progress:", val, "%");

        // 最大値まで達したら終了
        if (val == 100) {
            clearInterval(intervalID);
            setTimeout(() => {
                document.getElementById("myProgress").style.display = "none";
                val = 0;
            }, 1000);
        }
    }

    // old_screen()

    function old_screen() {
        document.getElementById('nex').classList.add('old');
    }
    function old_screen_reset() {
        document.getElementById('nex').classList.remove('old');
    }


    // list_shadow()

    function list_shadow() {
        document.querySelectorAll('.child_list').forEach(function (childlist_shadow) {
            let childlist_shadow2 = childlist_shadow.lastElementChild;
            childlist_shadow2.classList.add('shadow');
        })
        document.querySelectorAll('.sample_child_list').forEach(function (childlist_shadow) {
            let childlist_shadow2 = childlist_shadow.lastElementChild;
            childlist_shadow2.classList.add('shadow');
        })
    }
    function list_shadow_reset() {
        document.querySelectorAll('.child_list').forEach(function (childlist_shadow) {
            let childlist_shadow2 = childlist_shadow.lastElementChild;
            childlist_shadow2.classList.remove('shadow');
        })
        document.querySelectorAll('.sample_child_list').forEach(function (childlist_shadow) {
            let childlist_shadow2 = childlist_shadow.lastElementChild;
            childlist_shadow2.classList.remove('shadow');
        })
    }

}