var supportsPassive = false; try { var opts = Object.defineProperty({}, 'passive', { get: function () { supportsPassive = true; } }); window.addEventListener("testPassive", null, opts); window.removeEventListener("testPassive", null, opts); } catch (e) { }

const ua = navigator.userAgent.toLowerCase();
if (ua.includes("mobile")) {
    // Mobile (iPhone、iPad「Chrome、Edge」、Android)
    alert("この端末は対応していません!")
} else if (ua.indexOf("ipad") > -1 || (ua.indexOf("macintosh") > -1 && "ontouchend" in document)) {
    // Mobile (iPad「Safari」)
    alert("この端末は対応していません!")
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
    const prompt = document.getElementById('prompt');
    const prompt_text = document.querySelector('.prompt_text');
    const prompt_text2 = document.querySelector('.prompt_text2');
    const nexser = document.getElementById('nexser');
    const nexser_program = document.getElementById('nexser_program');
    const desktop = document.getElementById('desktop');
    const z_index = document.querySelector('.z_index');

    // soft_windows
    const password_menu = document.querySelector('.password_menu');
    const main = document.querySelector('.main');
    const my_computer = document.querySelector('.my_computer');
    const control = document.querySelector('.control_panel');
    const color_menu = document.querySelector('.color_menu');
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
    const file_setting_menu = document.querySelector('.file_setting_menu');
    const debug_menu = document.querySelector('.debug_menu');
    const file_download_menu = document.querySelector('.file_download_menu');
    const display_menu = document.querySelector('.display_menu');
    const stopwatch_menu = document.querySelector('.stopwatch_menu');
    const comment_menu = document.querySelector('.comment_menu');
    const objective_menu = document.querySelector('.objective_menu');
    const calendar_menu = document.querySelector('.calendar_menu');
    const browser_menu = document.querySelector('.browser_menu');
    const taskbar_setting_menu = document.querySelector('.taskbar_setting_menu');
    const youtubevideo_menu = document.querySelector('.youtubevideo_menu');
    const cpu_calc_menu = document.querySelector('.cpu_calc_menu');
    const device_menu = document.querySelector('.device_menu');
    const command_help_menu = document.querySelector('.command_help_menu');
    const omikuji_menu = document.querySelector('.omikuji_menu');
    const localstorage_monitor_menu = document.querySelector('.localstorage_monitor_menu');
    const paint_menu = document.querySelector('.paint_menu');
    const nexser_files_menu = document.querySelector('.nexser_files_menu');

    const notice_menu = document.querySelector('.notice_menu');

    const nexser_search_menu = document.querySelector('.nexser_search_menu');

    const error_windows = document.querySelector('.error_windows');
    const warning_windows = document.querySelector('.warning_windows');

    const tetris_mneu = document.querySelector('.tetris_menu');
    const bom_menu = document.querySelector('.bom_menu');
    const othello_menu = document.querySelector('.othello_menu');


    let startX, startY, isDrawing = false;
    let rectangle;

    document.addEventListener('mousedown', (e) => {
        if (desktop.style.display == "block") {
            startX = e.clientX;
            startY = e.clientY;
            isDrawing = true;

            rectangle = document.createElement('div');
            rectangle.className = 'rectangle';
            rectangle.style.left = `${startX}px`;
            rectangle.style.top = `${startY}px`;
            document.body.appendChild(rectangle);
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (isDrawing && desktop.style.display == "block") {
            const currentX = e.clientX;
            const currentY = e.clientY;
            const width = currentX - startX;
            const height = currentY - startY;

            rectangle.style.width = `${Math.abs(width)}px`;
            rectangle.style.height = `${Math.abs(height)}px`;
            rectangle.style.left = `${Math.min(startX, currentX)}px`;
            rectangle.style.top = `${Math.min(startY, currentY)}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        isDrawing = false;
        if (rectangle) {
            document.body.removeChild(rectangle);
        }
    });



    function lights() {
        const lightvalue = document.querySelector('.light_value').value;
        document.querySelector('.screen_light').style.opacity = lightvalue;
        localStorage.setItem('light_level', lightvalue);
    }

    const lightlevel = localStorage.getItem('light_level');
    if (localStorage.getItem('light_level')) {
        document.querySelector('.screen_light').style.opacity = lightlevel;
        document.querySelector('.light_value').value = lightlevel;
    }

    function lightchild() {
        const screen_light_range_child = document.querySelector('.screen_light_range_child');
        if (screen_light_range_child.style.display == "block") {
            screen_light_range_child.style.display = "none"
        } else {
            screen_light_range_child.style.display = "block"
        }
    }

    // nexser_load

    new Promise((resolve) => {
        setTimeout(getStorage, resolve());
        setTimeout(taskbar_none, resolve());
        setTimeout(title_none, resolve());
        setTimeout(screen_backtextload, resolve());
        setTimeout(notecolor_change, resolve());
        setTimeout(notetextsize_change, resolve());
        setTimeout(taskgroup_load, resolve());
        setTimeout(window_back_silver, resolve());
        setTimeout(caload, resolve());
        setTimeout(titlecolor_set, resolve());
        setTimeout(back_pattern_set, resolve());
        setTimeout(load_videourl, resolve());
        setTimeout(pageLoad, resolve())
        setTimeout(load_nexser, resolve());
        setTimeout(() => {
            const t = localStorage.getItem('taskbar_height');
            taskbar.style.height = t + "px";

            if (localStorage.getItem('driver_color')) {
                document.querySelector('.installbutton_2').textContent = "uninstall"
            }
            if (localStorage.getItem('driver_sound')) {
                document.querySelector('.installbutton_1').textContent = "uninstall"
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
            } else if (localStorage.getItem('windowfile_3')) {
                window_file_list_change2()
            } else if (localStorage.getItem('windowfile_2')) {
                window_file_list_reset()
            } else {
                Array.from(document.getElementsByClassName('windowfile_time')).forEach((windowfile_time) => {
                    windowfile_time.style.display = "none"
                })
            }
            if (localStorage.getItem('clock_button')) {
                document.querySelector('.clock_button').textContent = "on"
                document.querySelector('.time').style.display = "none";
            }

            if (localStorage.getItem('taskbar_zindex_0')) {
                taskbar.style.zIndex = "0";
                document.querySelector('.taskbar_zindex_0').textContent = "on"
            }

            if (localStorage.getItem('taskbar_position_button')) {
                document.querySelector('.taskbar_position_button').textContent = "bottom"
                document.getElementById('taskbar').style.top = "0px"
                document.querySelector('.child_start_menu').style.top = "40px"
                document.querySelector('.child_start_menu').style.bottom = "auto"
                document.querySelector('.battery_menu').style.top = "35px"
                document.querySelector('.battery_menu').style.bottom = "auto"
            }




            if (localStorage.getItem('taskbar_position_button') && localStorage.getItem('data_taskbar_none')) {
                document.querySelector('.files_inline').style.top = "auto"
                document.querySelector('.files_inline').style.bottom = ""
            } else if (localStorage.getItem('taskbar_position_button') && !localStorage.getItem('data_taskbar_none')) {
                document.querySelector('.files_inline').style.top = "40px"
                document.querySelector('.files_inline').style.bottom = "auto"

                document.querySelector('.files_inline').style.top = t + "px"
            } else {
                document.querySelector('.files_inline').style.top = "auto"
                document.querySelector('.files_inline').style.bottom = ""
            }



            if (localStorage.getItem('data_taskbar_none') && localStorage.getItem('taskbar_position_button')) {
                toolbar.style.top = "0px";
            } else if (localStorage.getItem('data_taskbar_none') && !localStorage.getItem('taskbar_position_button')) {
                toolbar.style.bottom = "0px";
            } else if (localStorage.getItem('taskbar_position_button')) {
                const task = document.getElementById('taskbar').clientHeight;
                toolbar.style.top = task + "px";
                toolbar.style.top = t + "px";

                document.querySelector('.child_start_menu').style.top = task + "px"
                document.querySelector('.child_start_menu').style.top = t + "px"
            } else {
                const task = document.getElementById('taskbar').clientHeight;
                toolbar.style.bottom = task + "px";
                toolbar.style.bottom = t + "px";
                document.querySelector('.desktop_version_text').style.bottom = task + "px";

                document.querySelector('.child_start_menu').style.bottom = task + "px"
                document.querySelector('.child_start_menu').style.bottom = t + "px"
            }

            if (localStorage.getItem('toolbar_on')) {
                toolbar.style.display = "block"
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
            if (localStorage.getItem('allwindow_toolbar')) {
                document.querySelectorAll('.window_tool').forEach(function (window_tool) {
                    window_tool.style.display = "block"
                })
                document.querySelectorAll('.window_inline_side').forEach(function (window_inline_side) {
                    window_inline_side.style.top = "31px"
                })
            } else {
                document.querySelector('.clock_menu').style.height = "355px"
                document.querySelectorAll('.window_tool').forEach(function (window_tool) {
                    window_tool.style.display = "none"
                })
            }
            if (localStorage.getItem('clockdata_analog')) {
                document.getElementsByClassName('digital_clock_area')[0].style.display = "none";
                document.getElementsByClassName('analog_clock_area')[0].style.display = "block"
            } else {
                document.getElementsByClassName('digital_clock_area')[0].style.display = "flex";
                document.getElementsByClassName('analog_clock_area')[0].style.display = "none"
            }

            if (localStorage.getItem('saver_time')) {
                document.getElementsByClassName('saver_on')[0].classList.remove('pointer_none');
                document.getElementsByClassName('screensaver_text')[0].textContent = localStorage.getItem('saver_time');
            } else {
                localStorage.removeItem('saver_on')
                localStorage.removeItem('saver_time')
            }
            if (localStorage.getItem('saver_on')) {
                document.querySelector('.saver_mode').textContent = "ON"
            }

            if (localStorage.getItem('saver2')) {
                saver2()
            }
            if (localStorage.getItem('saver3')) {
                saver3()
            }

            if (localStorage.getItem('backcolor_blackwhite')) {
                document.getElementById('nex').style.filter = "grayscale(100%)";
            }
            if (localStorage.getItem('backcolor_invert')) {
                document.getElementById('nex').style.filter = "invert(100%)";
            }
            if (localStorage.getItem('backcolor_hue')) {
                document.getElementById('nex').style.filter = "hue-rotate(100deg)";
            }

            if (localStorage.getItem('taskbar_autohide')) {
                document.getElementById('taskbar').style.bottom = "-35px"
            }
            if (localStorage.getItem('taskbar_height') && (localStorage.getItem('taskbar_autohide'))) {
                const t2 = t - 5;
                document.getElementById('taskbar').style.bottom = "-" + t2 + "px";
            }

            if (localStorage.getItem('wallpaper_95')) {
                document.querySelector('.nexser_backgroundimage_1').style.display = "block"
            }
            if (localStorage.getItem('wallpaper_xp')) {
                document.querySelector('.nexser_backgroundimage_2').style.display = "block"
            }

            resolve();
        }, 10);

        function taskgroup_load() {
            setTimeout(() => {
                getTime();
                var date = new Date();
                var year = date.getFullYear();
                var month = date.getMonth() + 1;
                var day = date.getDate();
                document.querySelector('.date_day').textContent = (year + "/" + month + "/" + day + "");
                var hours = date.getHours().toString().padStart(2, '0');
                var minutes = date.getMinutes().toString().padStart(2, '0');
                var seconds = date.getSeconds().toString().padStart(2, '0');
                let clock = document.getElementsByClassName('date_clock');
                Array.from(clock).forEach((element) => {
                    element.textContent = (hours + ":" + minutes + ":" + seconds + "");
                });

                navigator.getBattery().then((battery) => {
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

                    if (0 <= battery.level && battery.level < 0.21 && battery.charging == false) {
                        document.querySelector('.notice_text').textContent = "バッテリー残量が少なくなっています!(※充電しない限りこの表示は残り続けます。)"
                        notice_menu.style.display = "block";
                    } else {
                        notice_menu.style.display = "none"
                    }
                    resolve()
                }, 1000)
                setTimeout(() => {
                    navigator.getBattery().then((battery) => {
                        let bu = document.getElementsByClassName('taskbattery');
                        bu2 = bu[0].textContent = Math.floor(battery.level * 100);
                    });
                    navigator.getBattery().then((battery) => {
                        if (battery.charging == true) {
                            document.getElementsByClassName('battery_time')[0].textContent = (`${battery.dischargingTime}`);
                        } else if (battery.charging == false) {
                            document.getElementsByClassName('battery_time')[0].textContent = (`${battery.dischargingTime}` + "second");
                        }
                    })
                    resolve()
                }, 50);
                taskgroup_load();
            }, 50)
        }
        setTimeout(() => {
            localmemory_size()
            resolve()
        }, 500);
    }).then(() => {
        // 処理が無事終わったことを受けとって実行される処理
    });

    function load_nexser() {
        localStorage.removeItem('no_shutdown')
        if (localStorage.getItem('password') && !localStorage.getItem('login') && !localStorage.getItem('prompt_data3') && localStorage.getItem('prompt_data')) {
            prompt.style.display = "none";
            nexser_program.style.display = "none";
            nexser.style.display = "block";
            desktop.style.display = "none";
            document.querySelector('.password_form').style.display = "block";
            document.querySelector('#pass_form').focus();
        } else if (!localStorage.getItem('start_nexser') && localStorage.getItem('prompt_data')) {
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
            document.getElementById('nex').style.cursor = 'crosshair';
        } else {
            prompt.style.display = "block";
            nexser_program.style.display = "none";
            nexser.style.display = "none";
            desktop.style.display = "none";
            document.querySelector('.focus').focus();
        }
        if (localStorage.getItem('deskprompt')) {
            nexser_program.style.display = "block";
            desktop.style.display = "none";
            document.getElementsByClassName('pattern_backgrounds')[0].style.display = "none";
            document.getElementById('nex').style.cursor = 'crosshair';
        } else {
            document.getElementsByClassName('pattern_backgrounds')[0].style.display = "block";
        }

        sessionStorage.removeItem('start_camera');
        localStorage.removeItem('note_texts');
    }

    document.querySelector('#prompt').addEventListener('click', function () {
        document.querySelector('.focus').focus();
    })

    document.getElementById('startbtn').addEventListener('mousedown', function () {
        document.querySelectorAll('.windowtool_child').forEach(function (windowtool_child) {
            windowtool_child.style.display = "none"
        })
        Array.from(document.getElementsByClassName('desktop_files')).forEach((df1) => {
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

            document.querySelector('.screen_light_range_child').style.display = "none";
            document.querySelector('.sit_button').classList.remove('pressed');
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
        document.querySelector('.screen_light_range_child').style.display = "none";
        document.querySelector('.sit_button').classList.remove('pressed');
        alltitle_navyreomve();
        document.querySelectorAll('.windowtool_child').forEach(function (windowtool_child) {
            windowtool_child.style.display = "none"
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
        alltitle_navyreomve();
        titlecolor_set();
        document.querySelectorAll('.windowtool_child').forEach(function (windowtool_child) {
            windowtool_child.style.display = "none"
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

    document.querySelectorAll('.child_windows,.welcome_windows,.error_windows,.warning_windows').forEach(function (allwindow) {
        allwindow.addEventListener('mousedown', function () {
            document.querySelector('.battery_child').classList.remove('pressed');
            document.querySelector('.battery_menu').style.display = "none";
            document.querySelector('.screen_light_range_child').style.display = "none";
            document.querySelector('.sit_button').classList.remove('pressed');
        })
    })

    Array.from(document.getElementsByClassName('button')).forEach((button) => {
        button.addEventListener('click', () => {
            let tscbtn = button.firstChild;
            tscbtn = button.classList.toggle('pressed');
        });
    });

    Array.from(document.getElementsByClassName('button2')).forEach((button2) => {
        button2.addEventListener('mousedown', () => {
            button2.classList.add('pressed');
        });
        button2.addEventListener('mouseleave', () => {
            button2.classList.remove('pressed');
        });
        button2.addEventListener('mouseup', () => {
            button2.classList.remove('pressed');
        });
    });

    document.querySelector('.deskprompt').addEventListener('click', function (deskprompt) {
        localStorage.setItem('deskprompt', deskprompt);
    })
    document.querySelector('#shell').addEventListener('click', function () {
        document.getElementById('shell').blur()
    })
    document.querySelector('#shell').addEventListener('mousedown', function () {
        document.getElementById('shell').blur()
    })

    function nexser_program_open() {
        func2();
        desktop.style.display = "none";
        document.getElementsByClassName('pattern_backgrounds')[0].style.display = "none";
        document.getElementsByClassName('welcome_windows')[0].style.display = "none";
        sound_stop();
        document.querySelector('.prompt_error_text').textContent = "";
        document.getElementById('nex').style.cursor = 'crosshair';
        document.querySelector('.test_allwindow').style.display = "none";
        setTimeout(function () {
            prompt.style.display = "none";
            setTimeout(function () {
                taskbar_none();
                nexser_program.style.display = "block";
            }, 50);
        }, 50);
    }

    function nexser_program_close() {
        document.getElementById('nex').style.cursor = '';
        document.querySelector('.test_allwindow').style.display = "none";
        if (!localStorage.getItem('deskprompt')) {
            setTimeout(function () {
                localStorage.removeItem('prompt_data3')
                prompt.style.display = "block";
                setTimeout(function () {
                    taskbar_none();
                    nexser_program.style.display = "none";
                    document.querySelector('.focus').focus();
                }, 100);
            }, 100);
        } else {
            nexser_program.style.display = "none";
            localStorage.removeItem('deskprompt');
            setTimeout(() => {
                desktop.style.display = "block";
                document.getElementsByClassName('pattern_backgrounds')[0].style.display = "block";
            }, 500);
        }

        setTimeout(() => {
            if (localStorage.getItem('taskbar_position_button')) {
                const task = document.getElementById('taskbar').clientHeight;
                toolbar.style.top = task + "px";

                document.querySelector('.child_start_menu').style.top = task + "px"
            } else {
                const task = document.getElementById('taskbar').clientHeight;
                toolbar.style.bottom = task + "px";

                document.querySelector('.child_start_menu').style.bottom = task + "px"
            }
        }, 500);
    }

    document.querySelector('.startup_note').addEventListener('click', function (startup_note) {
        if (localStorage.getItem('startup_note')) {
            localStorage.removeItem('startup_note')
            document.querySelector('.startup_note').textContent = "OFF"
        } else {
            localStorage.setItem('startup_note', startup_note);
            document.querySelector('.startup_note').textContent = "ON"
        }
    })
    document.querySelector('.startup_computer').addEventListener('click', function (startup_computer) {
        if (localStorage.getItem('startup_computer')) {
            localStorage.removeItem('startup_computer')
            document.querySelector('.startup_computer').textContent = "OFF"
        } else {
            localStorage.setItem('startup_computer', startup_computer);
            document.querySelector('.startup_computer').textContent = "ON"
        }
    })
    document.querySelector('.startup_color').addEventListener('click', function (startup_color) {
        if (localStorage.getItem('startup_color')) {
            localStorage.removeItem('startup_color')
            document.querySelector('.startup_color').textContent = "OFF"
        } else {
            localStorage.setItem('startup_color', startup_color);
            document.querySelector('.startup_color').textContent = "ON"
        }
    })
    document.querySelector('.startup_screen').addEventListener('click', function (startup_screen) {
        if (localStorage.getItem('startup_screen')) {
            localStorage.removeItem('startup_screen')
            document.querySelector('.startup_screen').textContent = "OFF"
        } else {
            localStorage.setItem('startup_screen', startup_screen);
            document.querySelector('.startup_screen').textContent = "ON"
        }
    })
    document.querySelector('.startup_htmlviewer_edit').addEventListener('click', function (startup_htmlviewer_edit) {
        if (localStorage.getItem('startup_htmlviewer_edit')) {
            localStorage.removeItem('startup_htmlviewer_edit')
            document.querySelector('.startup_htmlviewer_edit').textContent = "OFF"
        } else {
            localStorage.setItem('startup_htmlviewer_edit', startup_htmlviewer_edit);
            document.querySelector('.startup_htmlviewer_edit').textContent = "ON"
        }
    })
    document.querySelector('.startup_guidebook').addEventListener('click', function (startup_guidebook) {
        if (localStorage.getItem('startup_guidebook')) {
            localStorage.removeItem('startup_guidebook')
            document.querySelector('.startup_guidebook').textContent = "OFF"
        } else {
            localStorage.setItem('startup_guidebook', startup_guidebook);
            document.querySelector('.startup_guidebook').textContent = "ON"
        }
    })
    document.querySelector('.startup_objective').addEventListener('click', function (startup_objective) {
        if (localStorage.getItem('startup_objective')) {
            localStorage.removeItem('startup_objective')
            document.querySelector('.startup_objective').textContent = "OFF"
        } else {
            localStorage.setItem('startup_objective', startup_objective);
            document.querySelector('.startup_objective').textContent = "ON"
        }
    })
    document.querySelector('.startup_calendar').addEventListener('click', function (startup_calendar) {
        if (localStorage.getItem('startup_calendar')) {
            localStorage.removeItem('startup_calendar')
            document.querySelector('.startup_calendar').textContent = "OFF"
        } else {
            localStorage.setItem('startup_calendar', startup_calendar);
            document.querySelector('.startup_calendar').textContent = "ON"
        }
    })

    document.querySelector('.startup_speed').addEventListener('click', function (prompt_data2) {
        if (localStorage.getItem('prompt_data2')) {
            localStorage.removeItem('prompt_data2')
            document.querySelector('.startup_speed').textContent = "LOW"
        } else {
            localStorage.setItem('prompt_data2', prompt_data2);
            document.querySelector('.startup_speed').textContent = "HIGH"
        }
    })

    document.querySelector('.startup_sound').addEventListener('click', function (startup_sound) {
        if (localStorage.getItem('driver_sound')) {
            localStorage.removeItem('driver_sound')
            document.querySelector('.startup_sound').textContent = "INSTALL"
            document.querySelector('.installbutton_1').textContent = "install"
        } else {
            localStorage.setItem('driver_sound', startup_sound);
            document.querySelector('.startup_sound').textContent = "UN INSTALL"
            document.querySelector('.installbutton_1').textContent = "uninstall"
        }
    })

    document.querySelector('.startup_versiontext').addEventListener('click', function (startup_versiontext) {
        if (localStorage.getItem('startup_versiontext')) {
            localStorage.removeItem('startup_versiontext')
            document.querySelector('.startup_versiontext').textContent = "OFF"
            document.querySelector('.desktop_version_text').style.display = "none";
        } else {
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

    document.querySelector('.font_default').addEventListener('click', function (font_default) {
        font_clear()
        document.querySelector("body").style.fontFamily = "serif";
    })

    document.querySelector('.font_sans_serif').addEventListener('click', function (font_sans_serif) {
        font_clear()
        localStorage.setItem('font_sans_serif', font_sans_serif);
        document.querySelector("body").style.fontFamily = "sans-serif";
    })

    document.querySelector('.font_cursive').addEventListener('click', function (font_cursive) {
        font_clear()
        localStorage.setItem('font_cursive', font_cursive);
        document.querySelector("body").style.fontFamily = "cursive";
    })

    document.querySelector('.font_fantasy').addEventListener('click', function (font_fantasy) {
        font_clear()
        localStorage.setItem('font_fantasy', font_fantasy);
        document.querySelector("body").style.fontFamily = "fantasy";
    })

    document.querySelector('.font_monospace').addEventListener('click', function (font_monospace) {
        font_clear()
        localStorage.setItem('font_monospace', font_monospace);
        document.querySelector("body").style.fontFamily = "monospace";
    })

    function nexser_boot_check() {
        if (localStorage.getItem('driver_sound')) {
            nexser_start()
            document.getElementById('nex').style.cursor = 'none';
        } else if (!localStorage.getItem('driver_sound') && !localStorage.getItem('start_nexser')) {
            prompt.style.display = "none";
            document.querySelector('.nexser_boot_menu').style.display = "block";
            document.querySelector('.nexser_bootmenu_text').textContent = "サウンドドライバー がインストールされていません!";
            document.querySelector('.nexser_bootmenu_text2').textContent = "インストールして nexser を起動しますか?";
        } else {
            nexser_start()
            document.getElementById('nex').style.cursor = 'none';
        }
    }

    document.querySelector('.boot_sound').addEventListener('click', function (boot_sound) {
        if (localStorage.getItem('driver_sound')) {
            localStorage.removeItem('driver_sound')
            document.querySelector('.startup_sound').textContent = "INSTALL"
            document.querySelector('.installbutton_1').textContent = "install"
        } else {
            localStorage.setItem('driver_sound', boot_sound);
            document.querySelector('.startup_sound').textContent = "UN INSTALL"
            document.querySelector('.installbutton_1').textContent = "uninstall"
        }
    })

    function pass_submit(passlogin) {
        if (document.querySelector('.password').value == "") {
            document.querySelector('.window_error_text').textContent = "パスワードが入力されていません!"
            error_windows.classList.remove('active')
            document.querySelector('.test_allwindow').style.display = "block";
            sound3()
        } else {
            const pass = document.querySelector('.password').value;

            const password_lock = (String(pass)
                .replaceAll("0", "a+b").replaceAll("1", "c#d").replaceAll("2", "e*f")
                .replaceAll("3", "g|h").replaceAll("4", "i=j").replaceAll("5", "k[l")
                .replaceAll("6", "m]n").replaceAll("7", "o-p").replaceAll("8", "q>r")
                .replaceAll("9", "s<t")
            );

            localStorage.setItem('password', password_lock);
            localStorage.setItem('login', passlogin);
            document.querySelector('.passcode').textContent = "登録しました";
        }
    }

    function pass_reset() {
        document.querySelector('.password').value = "";
        localStorage.removeItem('password');
        localStorage.removeItem('login');
        document.querySelector('.passcode').textContent = "登録していません";
    }

    if (localStorage.getItem('password')) {
        document.querySelector('.passcode').textContent = "登録しています";
    }

    function pass_check() {

        if (localStorage.getItem('password') && !localStorage.getItem('login')) {
            document.querySelector('.password_form').style.display = "block";
            document.getElementById('pass_form').focus();
            document.getElementById('nex').style.cursor = '';
        } else {
            start_check()
        }
    }

    function password_login(login) {

        const password_unlock = localStorage.getItem('password');

        const password_unlock2 = (String(password_unlock)
            .replaceAll("a+b", "0").replaceAll("c#d", "1").replaceAll("e*f", "2")
            .replaceAll("g|h", "3").replaceAll("i=j", "4").replaceAll("k[l", "5")
            .replaceAll("m]n", "6").replaceAll("o-p", "7").replaceAll("q>r", "8")
            .replaceAll("s<t", "9")
        );

        if (password_unlock2 == document.querySelector('#pass_form').value) {
            document.querySelector('.password_form').style.display = "none";
            document.querySelector('.pass_no').textContent = "";
            start_check();
            localStorage.setItem('login', login);
            document.querySelector('#pass_form').value = "";
        } else {
            document.querySelector('.pass_no').textContent = "パスワードが違います!";
            document.querySelector('#pass_form').focus();
        }
    }

    function nexser_start() {
        load_videourl();
        document.querySelector('.nexser_boot_menu').style.display = "none";
        const prompt_data = "nexser_boot_test";
        localStorage.setItem('prompt_data', prompt_data);
        document.querySelector("#nexser").style.backgroundColor = "";
        document.querySelector('.test_allwindow').style.display = "none";
        document.querySelector('.welcome_windows').style.display = "none";
        document.querySelector('#code_html').style.display = "none";
        document.querySelector('#code_script').style.display = "none";
        document.querySelector('#code_script2').style.display = "none";
        document.querySelector('.start_button').classList.remove('pressed');
        document.querySelector('.focus').blur();
        window_none();
        document.getElementById('nex').style.cursor = 'none';
        if (localStorage.getItem('prompt_data2')) {
            func2();
            setTimeout(function () {
                console.log(largestZIndex)
                prompt.style.display = "none";
                setTimeout(function () {
                    nexser.style.display = "block";
                    setTimeout(function () {
                        pass_check()
                        taskbar_none();
                        if (localStorage.getItem('login_welcome') && !localStorage.getItem('password')) {
                            welcome()
                        };
                    }, 100);
                }, 100);
            }, 100)
            setTimeout(() => {
                document.getElementById('nex').style.cursor = 'progress';
                document.querySelector('.pattern_backgrounds').style.display = "block";
            }, 100);
        } else {
            func1();
            setTimeout(function () {
                prompt.style.display = "none";
                setTimeout(function () {
                    nexser.style.display = "block";
                    setTimeout(function () {
                        pass_check()
                        taskbar_none();
                        if (localStorage.getItem('login_welcome') && !localStorage.getItem('password')) {
                            welcome()
                        };
                    }, 1500);
                }, 1500)
            }, 1500);
            setTimeout(() => {
                document.getElementById('nex').style.cursor = 'progress';
                document.querySelector('.pattern_backgrounds').style.display = "block";
            }, 2000);
        }
    }

    Array.from(shutdown).forEach(element => {
        element.addEventListener('click', event => {
            document.getElementById('nex').style.cursor = 'progress';
            setTimeout(() => {
                document.querySelector('.test_allwindow').style.display = "block";
                if (sessionStorage.getItem('start_camera')) {
                    document.getElementById('nex').style.cursor = '';
                    document.querySelector('.window_error_text').textContent = "camera no finish no shutdown!"
                    error_windows.classList.remove('active')
                    sound3()
                    document.querySelector('.test_allwindow').style.display = "block";
                } else if (localStorage.getItem('no_shutdown')) {
                    document.getElementById('nex').style.cursor = '';
                    document.querySelector('.window_error_text').textContent = "welcomeウィンドウが起動するまでシャットダウンはできません!"
                    error_windows.classList.remove('active')
                    sound3()
                    document.querySelector('.test_allwindow').style.display = "block";
                } else if (gets == gets2) {
                    sound_stop();
                    shutdown_sound();
                    localStorage.removeItem('login');
                    document.querySelector('.welcome_windows').style.display = "none";
                    document.getElementById('nex').style.cursor = 'none';
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
                        document.querySelector('#code_html').style.display = "none";
                        document.querySelector('#code_script').style.display = "none";
                        document.querySelector('#code_script2').style.display = "none";
                        fileborder_reset();

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
                            document.getElementById('nex').style.cursor = '';
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
                    document.getElementById('nex').style.cursor = '';
                }
            }, 100);
        })
    })

    Array.from(restart).forEach(element => {
        element.addEventListener('click', event => {
            document.getElementById('nex').style.cursor = 'progress';
            setTimeout(() => {
                document.querySelector('.test_allwindow').style.display = "block";
                if (sessionStorage.getItem('start_camera')) {
                    document.getElementById('nex').style.cursor = '';
                    document.querySelector('.window_error_text').textContent = "camera no finish no restart!"
                    error_windows.classList.remove('active')
                    sound3()
                    document.querySelector('.test_allwindow').style.display = "block";
                } else if (localStorage.getItem('no_shutdown')) {
                    document.getElementById('nex').style.cursor = '';
                    document.querySelector('.window_error_text').textContent = "welcomeウィンドウが起動するまで再起動はできません!"
                    error_windows.classList.remove('active')
                    sound3()
                    document.querySelector('.test_allwindow').style.display = "block";
                } else if (gets == gets2) {
                    sound_stop();
                    shutdown_sound();
                    localStorage.removeItem('login');
                    document.querySelector('.welcome_windows').style.display = "none";
                    document.getElementById('nex').style.cursor = 'none';
                    if (!localStorage.getItem('noteData')) {
                        document.note_form.note_area.value = "";
                        resetShowLength();
                        document.querySelector('.note_title').textContent = "notepad"
                    }
                    setTimeout(() => {
                        window_none();
                        desktop.style.display = "none";
                        window_reset();
                        document.querySelector('#code_html').style.display = "none";
                        document.querySelector('#code_script').style.display = "none";
                        document.querySelector('#code_script2').style.display = "none";
                        fileborder_reset();
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
                            document.querySelector('.restart_text').style.display = "block";
                            start_menu.style.display = "none";
                        }, 500);
                        setTimeout(() => {
                            document.querySelector('.restart_text').style.display = "none";
                        }, 2500);
                        setTimeout(() => {
                            nexser_start()
                        }, 3500);
                    }, 1500);
                } else {
                    document.getElementById('nex').style.cursor = '';
                    document.querySelector('.window_error_text').textContent = "window open no restart!"
                    error_windows.classList.remove('active')
                    prompt_text2.style.color = "";
                    document.querySelector('.test_allwindow').style.display = "block";
                    sound3()
                }
            }, 100);
        })
    })

    function start_check(start_check) {
        if (localStorage.getItem('login_welcome') && localStorage.getItem('password')) {
            localStorage.setItem('no_shutdown', start_check)
        };
        const t = localStorage.getItem('taskbar_height');
        taskbar.style.display = "none";
        document.getElementById('files').style.display = "none";
        document.getElementById('nex').style.cursor = 'none';
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
                document.getElementById('nex').style.cursor = '';
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

                    if (localStorage.getItem('data_taskbar_none')) {
                        taskbar.style.display = "none";
                        toolbar.style.top = "0px";
                        document.querySelector('.files_inline').style.top = "0px"
                    } else {
                        taskbar.style.display = "block";
                        toolbar.style.top = "40px";
                        toolbar.style.top = t + "px";
                    }

                } else {
                    taskbar.style.display = "block";

                    if (localStorage.getItem('data_taskbar_none')) {
                        taskbar.style.display = "none";
                        toolbar.style.bottom = "0px";
                    } else {
                        taskbar.style.display = "block";
                        toolbar.style.bottom = "40px";
                        toolbar.style.bottom = t + "px";
                    }

                }
                const task = document.getElementById('taskbar').clientHeight;
                toolbar.style.top = "";
                toolbar.style.left = "";
                toolbar.style.bottom = "40px";
                toolbar.style.bottom = t + "px";

                document.querySelector('.child_start_menu').style.bottom = task + "px";
                document.querySelector('.desktop_version_text').style.bottom = task + "px";
                document.getElementById('files').style.display = "block";

                setTimeout(() => {
                    if (localStorage.getItem('login_welcome') && localStorage.getItem('password')) {
                        welcome()
                        localStorage.removeItem('no_shutdown')
                    };
                }, 5000);
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

                const task = document.getElementById('taskbar').clientHeight;
                toolbar.style.top = "";
                toolbar.style.left = "";
                toolbar.style.bottom = "40px";

                document.querySelector('.child_start_menu').style.bottom = task + "px";
                document.querySelector('.desktop_version_text').style.bottom = task + "px";
            }, 500);
            setTimeout(() => {
                setColor()
                document.getElementById('nex').style.cursor = '';
            }, 1500);
            setTimeout(() => {
                startup_window_open()
                taskbtn_load()
            }, 2000);
        }, 50);
    }

    document.getElementsByClassName('startnexser_close')[0].addEventListener('click', function () {
        setTimeout(() => {
            document.getElementsByClassName('welcome_windows')[0].style.display = "none"
        }, 100);
    })

    document.querySelector('.login_welcome').addEventListener('click', function (login_welcome) {
        localStorage.setItem('login_welcome', login_welcome);
    })
    document.querySelector('.nologin_welcome').addEventListener('click', function () {
        localStorage.removeItem('login_welcome');
    })


    function welcome_animation() {
        sound_stop();
        sound7();
        document.getElementById('nex').style.cursor = 'none';
        document.getElementsByClassName('start_nexser')[0].style.display = "none";
        document.getElementsByClassName('startnexser_close')[0].style.display = "none";
        document.getElementsByClassName('welcome_window_inline')[0].style.display = "none";
        document.getElementsByClassName('welcome_text1')[0].style.position = "absolute";
        document.getElementsByClassName('welcome_text1')[0].style.fontSize = "80px";
        document.getElementsByClassName('welcome_text1')[0].style.marginTop = "125px";
        document.getElementsByClassName('welcome_text1')[0].style.marginLeft = "50px";
        document.getElementsByClassName('welcome_underline')[0].style.right = "0";
        document.getElementsByClassName('welcome_underline')[0].style.width = "0%";
        document.getElementsByClassName('welcome_text2')[0].style.display = "none";
        document.getElementsByClassName('welcome_icons')[0].style.display = "none";

        setTimeout(() => {

            setTimeout(() => {
                document.getElementsByClassName('welcome_window_inline')[0].style.display = "block"
                setTimeout(() => {
                    document.getElementsByClassName('welcome_text1')[0].style.fontSize = "70px"
                    document.getElementsByClassName('welcome_text1')[0].style.marginTop = "80px"
                    document.getElementsByClassName('welcome_text1')[0].style.marginLeft = "25px"
                    document.getElementsByClassName('welcome_text1')[0].style.transition = "0.25s cubic-bezier(0, 0, 1, 1)"
                    document.getElementsByClassName('welcome_text1')[0].style.fontSize = "40px"
                    document.getElementsByClassName('welcome_text1')[0].style.marginTop = "0px"
                    document.getElementsByClassName('welcome_text1')[0].style.marginLeft = "0px"
                }, 500);

                setTimeout(() => {
                    document.getElementsByClassName('welcome_underline')[0].style.width = "5%"
                    document.getElementsByClassName('welcome_underline')[0].style.transition = "0.25s cubic-bezier(0, 0, 1, 1)"
                    document.getElementsByClassName('welcome_underline')[0].style.width = "100%"
                    setTimeout(() => {
                        document.getElementsByClassName('welcome_text2')[0].style.display = "block";
                        document.getElementsByClassName('welcome_icons')[0].style.display = "block";
                        document.getElementById('nex').style.cursor = '';
                        if (!localStorage.getItem('start_nexser')) {
                            document.getElementsByClassName('start_nexser')[0].style.display = "block";
                        } else {
                            document.getElementsByClassName('start_nexser')[0].style.display = "none";
                            document.getElementsByClassName('startnexser_close')[0].style.display = "block";
                        }
                    }, 300);
                }, 1000);

            }, 250);

        });

    }

    function welcome() {
        document.querySelector('.welcome_windows').style.display = "block"
        welcome_animation();
    }

    startup_window_open()
    function startup_window_open() {
        if (localStorage.getItem('startup_computer')) {
            const element = document.querySelector('.my_computer');
            element.closest('.child_windows');
            element.classList.remove('active');
            zindexwindow_addnavy()
        }
        if (localStorage.getItem('startup_note')) {
            const element = document.querySelector('.note_pad');
            element.closest('.child_windows');
            element.classList.remove('active');
            zindexwindow_addnavy()
        }
        if (!note_pad.classList.contains('active')) {
            document.querySelector('.note_area').focus();
        }
        if (localStorage.getItem('startup_color')) {
            const element = document.querySelector('.color');
            element.closest('.child_windows');
            element.classList.remove('active');
            zindexwindow_addnavy()
        }
        if (localStorage.getItem('startup_screen')) {
            const element = document.querySelector('.screen_text_menu');
            element.closest('.child_windows');
            element.classList.remove('active');
            zindexwindow_addnavy()
        }
        if (localStorage.getItem('startup_htmlviewer_edit')) {
            const element = document.querySelector('.htmlviewer_edit_menu');
            element.closest('.child_windows');
            element.classList.remove('active');
            zindexwindow_addnavy()
        }
        if (localStorage.getItem('startup_guidebook')) {
            const element = document.querySelector('.nexser_guidebook_menu');
            element.closest('.child_windows');
            element.classList.remove('active');
            zindexwindow_addnavy()
        }
        if (localStorage.getItem('startup_objective')) {
            const element = document.querySelector('.objective_menu');
            element.closest('.child_windows');
            element.classList.remove('active');
            zindexwindow_addnavy()
        }
        if (localStorage.getItem('startup_calendar')) {
            const element = document.querySelector('.calendar_menu');
            element.closest('.child_windows');
            element.classList.remove('active');
            zindexwindow_addnavy()
        }
        titlecolor_set()
    }


    function nexser_signout() {
        if (localStorage.getItem('password') && gets == gets2) {
            document.getElementsByClassName('welcome_windows')[0].style.display = "none";
            document.querySelector('.password_form').style.display = "block";
            localStorage.removeItem('login');
            document.getElementById('desktop').style.display = "none";
            document.querySelector('#pass_form').focus();
            sound_stop()
        } else if (localStorage.getItem('password') && gets != gets2) {
            document.getElementById('nex').style.cursor = '';
            document.querySelector('.window_error_text').textContent = "全てのウィンドウを終了してください!"
            error_windows.classList.remove('active')
            document.querySelector('.test_allwindow').style.display = "block";
            sound3()
        } else {
            document.getElementById('nex').style.cursor = '';
            document.querySelector('.window_error_text').textContent = "パスワードを登録していないため、サインアウトができません!"
            error_windows.classList.remove('active')
            document.querySelector('.test_allwindow').style.display = "block";
            sound3()
        }
    }

    document.getElementById('sound_driver').addEventListener('click', function (sound_driver) {
        if (localStorage.getItem('driver_sound')) {
            localStorage.removeItem('driver_sound')
            document.querySelector('.installbutton_1').textContent = "install"
            document.querySelector('.startup_sound').textContent = "INSTALL"
            sound_stop()
        } else {
            localStorage.setItem('driver_sound', sound_driver);
            document.querySelector('.installbutton_1').textContent = "uninstall"
            document.querySelector('.startup_sound').textContent = "UN INSTALL"
        }
    })
    document.getElementById('color_driver').addEventListener('click', function (color_driver) {
        if (localStorage.getItem('driver_color')) {
            localStorage.removeItem('driver_color')
            document.querySelector('.installbutton_2').textContent = "install"
            colordata_clear();
            titlecolor_remove();
            titlecolor_set();
        } else {
            localStorage.setItem('driver_color', color_driver);
            document.querySelector('.installbutton_2').textContent = "uninstall";
            titlecolor_remove();
            titlecolor_set();
        }
    })

    document.querySelector('.startup_1').addEventListener('click', function (startup_1) {
        startupsound_reset()
        if (localStorage.getItem('startup_1')) {
            document.querySelector('.startup_1').textContent = "no set"
        } else {
            localStorage.setItem('startup_1', startup_1);
            document.querySelector('.startup_1').textContent = "set!"
        }
    })
    document.querySelector('.startup_2').addEventListener('click', function (startup_2) {
        startupsound_reset()
        if (localStorage.getItem('startup_2')) {
            document.querySelector('.startup_2').textContent = "no set"
        } else {
            localStorage.setItem('startup_2', startup_2);
            document.querySelector('.startup_2').textContent = "set!"
        }
    })
    document.querySelector('.startup_3').addEventListener('click', function (startup_3) {
        startupsound_reset()
        if (localStorage.getItem('startup_3')) {
            document.querySelector('.startup_3').textContent = "no set"
        } else {
            localStorage.setItem('startup_3', startup_3);
            document.querySelector('.startup_3').textContent = "set!"
        }
    })
    document.querySelector('.startup_4').addEventListener('click', function (startup_4) {
        startupsound_reset()
        if (localStorage.getItem('startup_4')) {
            document.querySelector('.startup_4').textContent = "no set"
        } else {
            localStorage.setItem('startup_4', startup_4);
            document.querySelector('.startup_4').textContent = "set!"
        }
    })
    document.querySelector('.startup_5').addEventListener('click', function (startup_5) {
        startupsound_reset()
        if (localStorage.getItem('startup_5')) {
            document.querySelector('.startup_5').textContent = "no set"
        } else {
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

    document.querySelector('.shutdown_1').addEventListener('click', function (shutdown_1) {
        shutdownsound_reset()
        if (localStorage.getItem('shutdown_1')) {
            document.querySelector('.shutdown_1').textContent = "no set"
        } else {
            localStorage.setItem('shutdown_1', shutdown_1);
            document.querySelector('.shutdown_1').textContent = "set!"
        }
    })
    document.querySelector('.shutdown_2').addEventListener('click', function (shutdown_2) {
        shutdownsound_reset()
        if (localStorage.getItem('shutdown_2')) {
            document.querySelector('.shutdown_2').textContent = "no set"
        } else {
            localStorage.setItem('shutdown_2', shutdown_2);
            document.querySelector('.shutdown_2').textContent = "set!"
        }
    })
    document.querySelector('.shutdown_3').addEventListener('click', function (shutdown_3) {
        shutdownsound_reset()
        if (localStorage.getItem('shutdown_3')) {
            document.querySelector('.shutdown_3').textContent = "no set"
        } else {
            localStorage.setItem('shutdown_3', shutdown_3);
            document.querySelector('.shutdown_3').textContent = "set!"
        }
    })
    document.querySelector('.shutdown_4').addEventListener('click', function (shutdown_4) {
        shutdownsound_reset()
        if (localStorage.getItem('shutdown_4')) {
            document.querySelector('.shutdown_4').textContent = "no set"
        } else {
            localStorage.setItem('shutdown_4', shutdown_4);
            document.querySelector('.shutdown_4').textContent = "set!"
        }
    })
    document.querySelector('.shutdown_5').addEventListener('click', function (shutdown_5) {
        shutdownsound_reset()
        if (localStorage.getItem('shutdown_5')) {
            document.querySelector('.shutdown_5').textContent = "no set"
        } else {
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

    document.getElementById('window_invisible').addEventListener('click', function (window_invisible) {
        if (localStorage.getItem('window_invisible')) {
            localStorage.removeItem('window_invisible');
            document.querySelector('.windowmode').textContent = "default"
        } else {
            windowmode_reset()
            localStorage.setItem('window_invisible', window_invisible);
            document.querySelector('.windowmode').textContent = "invisible"
        }
    })
    document.getElementById('window_borderblack').addEventListener('click', function (window_borderblack) {
        if (localStorage.getItem('window_borderblack')) {
            localStorage.removeItem('window_borderblack');
            document.querySelector('.windowmode').textContent = "default"
        } else {
            windowmode_reset()
            localStorage.setItem('window_borderblack', window_borderblack);
            document.querySelector('.windowmode').textContent = "border black"
        }
    })

    document.getElementById('backtext_on').addEventListener('click', function (backtext) {
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


    document.querySelector('.backtext_small').addEventListener('click', function (backtext_small) {
        backtextSize_clear();
        localStorage.setItem('backtext_small', backtext_small);
        const backtext_data2 = localStorage.getItem('backtext_data');
        document.querySelector('#background_text').style.fontSize = "15px";
        document.querySelector('#background_text2').style.fontSize = "15px";
    })
    document.querySelector('.backtext_medium').addEventListener('click', function (backtext_medium) {
        backtextSize_clear();
        localStorage.setItem('backtext_medium', backtext_medium);
        const backtext_data2 = localStorage.getItem('backtext_data');
        document.querySelector('#background_text').style.fontSize = "30px";
        document.querySelector('#background_text2').style.fontSize = "30px";
    })
    document.querySelector('.backtext_large').addEventListener('click', function (backtext_large) {
        backtextSize_clear();
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

        bom_reset();
        cpubench_clear();
        timerstop();
        timerreset();
        cpubench_clear();
        cpucalc_reset();
        p_clear();
        calc_clear();
        preview2_stop();
        videourl_reset();
        document.querySelector('.password').value = "";
        document.querySelector('#pass_form').value = "";

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

        document.querySelectorAll('.windowtool_child').forEach(function (windowtool_child) {
            windowtool_child.style.display = "none"
        })

    }
    function window_active() {
        document.querySelectorAll('.child_windows').forEach(function (allwindow_active) {
            allwindow_active.classList.remove('active');
            notice_menu.style.display = "block"
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

    function title_center() {
        document.querySelectorAll('.title').forEach(function (title) {
            title.classList.add('center')
            localStorage.setItem('title_center', title)
        });
    }

    Array.from(document.getElementsByClassName('nexser_title_text')).forEach((nexser_title_text) => {
        const nexserTitle = document.querySelector('.nexser_title').textContent;
        nexser_title_text.textContent = nexserTitle;
    })

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
            taskbar_active();
            document.querySelector('.files_inline').style.display = "flex";

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
            document.getElementById('taskbar').style.bottom = "";
            document.getElementById('taskbar').style.height = "";
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
        Array.from(document.getElementsByClassName('desktop_files')).forEach((desktop_files) => {
            const deskfile_text = desktop_files.firstElementChild;
            deskfile_text.style.color = ""
        })
    }

    function taskbar_autohide(taskbar_autohide) {
        const t = localStorage.getItem('taskbar_height');
        localStorage.setItem('taskbar_autohide', taskbar_autohide);
        document.getElementById('taskbar').style.bottom = "-35px";
        if (localStorage.getItem('taskbar_height') && (localStorage.getItem('taskbar_autohide'))) {
            const t2 = t - 5;
            document.getElementById('taskbar').style.bottom = "-" + t2 + "px";
        }
    }
    function taskbar_reset() {
        localStorage.removeItem('taskbar_autohide');
        document.getElementById('taskbar').style.bottom = "";
    }


    document.querySelectorAll('#taskbar').forEach(function (taskbar) {
        taskbar.addEventListener('mouseleave', function () {
            if (localStorage.getItem('taskbar_height') && (localStorage.getItem('taskbar_autohide'))) {
                const t = localStorage.getItem('taskbar_height');
                const t2 = t - 5;
                document.getElementById('taskbar').style.bottom = "-" + t2 + "px";
            } else if (!localStorage.getItem('taskbar_height') && localStorage.getItem('taskbar_autohide')) {
                document.getElementById('taskbar').style.bottom = "-35px"
            }
        });
        taskbar.addEventListener('mouseover', function () {
            taskbar.style.bottom = ""
        });
    })

    document.querySelectorAll('.child_start_menu').forEach(function (child_start_menu) {
        child_start_menu.addEventListener('mouseleave', function () {
            if (localStorage.getItem('taskbar_height') && (localStorage.getItem('taskbar_autohide'))) {
                const t = localStorage.getItem('taskbar_height');
                const t2 = t - 5;
                document.getElementById('taskbar').style.bottom = "-" + t2 + "px"; z
            } else if (localStorage.getItem('taskbar_autohide')) {
                taskbar.style.bottom = "-35px"
            }
        });
        child_start_menu.addEventListener('mouseover', function () {
            taskbar.style.bottom = ""
        });
        child_start_menu.addEventListener('click', function () {
            titlecolor_set()
        });
    })

    function taskbar_none() {
        if (localStorage.getItem('data_taskbar_none')) {
            taskbar.style.display = "none";
            my_computer.classList.remove('active');

            if (localStorage.getItem('taskbar_position_button')) {
                toolbar.style.top = "0px";
            } else {
                toolbar.style.bottom = "0px";
            }
        }

        if (localStorage.getItem('taskbar_position_button') && localStorage.getItem('data_taskbar_none')) {
            document.querySelector('.files_inline').style.top = "auto"
            document.querySelector('.files_inline').style.bottom = ""
        } else if (localStorage.getItem('taskbar_position_button') && !localStorage.getItem('data_taskbar_none')) {
            document.querySelector('.files_inline').style.top = "40px"
            document.querySelector('.files_inline').style.bottom = "auto"
        } else {
            document.querySelector('.files_inline').style.top = "auto"
            document.querySelector('.files_inline').style.bottom = ""
        }

        if (localStorage.getItem('data_taskbar_none')) {
            document.querySelectorAll('.big').forEach(function (child_win_posi) {
                child_win_posi.style.top = "auto"
            })
            document.querySelectorAll('.leftwindow').forEach(function (child_win_posi2) {
                child_win_posi2.style.top = "auto"
            })
            document.querySelectorAll('.rightwindow').forEach(function (child_win_posi3) {
                child_win_posi3.style.top = "auto"
            })
        } else if (localStorage.getItem('taskbar_position_button')) {
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

    }

    function taskbar_active() {
        localStorage.removeItem('data_taskbar_none');
        const task = document.getElementById('taskbar').clientHeight;
        const t = localStorage.getItem('taskbar_height');
        taskbar.style.height = t + "px";

        if (!localStorage.getItem('data_taskbar_none')) {
            taskbar.style.display = "block";
            my_computer.classList.remove('active');

            if (check(elm1, elm2) && !localStorage.getItem('taskbar_position_button')) {
                toolbar.style.bottom = task + "px";
                toolbar.style.bottom = t + "px";
                document.querySelector('.files_inline').style.top = t + "px"
            } else if (check(elm1, elm2)) {
                toolbar.style.bottom = "";
            }

            if (check(elm1, elm2) && localStorage.getItem('taskbar_position_button')) {
                toolbar.style.top = task + "px";
                toolbar.style.top = t + "px";
            } else if (check(elm1, elm2)) {
                toolbar.style.top = "";
            }

            if (localStorage.getItem('data_taskbar_none')) {
                document.querySelectorAll('.big').forEach(function (child_win_posi) {
                    child_win_posi.style.top = "auto"
                })
                document.querySelectorAll('.leftwindow').forEach(function (child_win_posi2) {
                    child_win_posi2.style.top = "auto"
                })
                document.querySelectorAll('.rightwindow').forEach(function (child_win_posi3) {
                    child_win_posi3.style.top = "auto"
                })
            } else if (localStorage.getItem('taskbar_position_button')) {
                document.querySelectorAll('.big').forEach(function (child_win_posi) {
                    child_win_posi.style.transition = "";
                    child_win_posi.style.top = "40px";

                    child_win_posi.style.top = t + "px";
                })
                document.querySelectorAll('.leftwindow').forEach(function (child_win_posi2) {
                    child_win_posi2.style.transition = "";
                    child_win_posi2.style.top = "40px";

                    child_win_posi2.style.top = t + "px";
                })
                document.querySelectorAll('.rightwindow').forEach(function (child_win_posi3) {
                    child_win_posi3.style.transition = "";
                    child_win_posi3.style.top = "40px";

                    child_win_posi3.style.top = t + "px";
                })
            }

        }

        if (localStorage.getItem('taskbar_position_button') && localStorage.getItem('data_taskbar_none')) {
            document.querySelector('.files_inline').style.top = "auto"
            document.querySelector('.files_inline').style.bottom = ""
        } else if (localStorage.getItem('taskbar_position_button') && !localStorage.getItem('data_taskbar_none')) {
            document.querySelector('.files_inline').style.top = t + "px"
            document.querySelector('.files_inline').style.bottom = "auto"
        } else {
            document.querySelector('.files_inline').style.top = "auto"
            document.querySelector('.files_inline').style.bottom = ""
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

    // document.addEventListener('DOMContentLoaded', pageLoad)
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
                document.querySelector('#code_script2').style.display = "none";
                break;
            case 'nexser/code/script':
                document.querySelector('.prompt_error_text').textContent = "connect";
                prompt_text.style.color = "";
                document.querySelector('#code_html').style.display = "none";
                document.querySelector('#code_script').style.display = "block";
                document.querySelector('#code_script2').style.display = "none";
                break;
            case 'nexser/code/script2':
                document.querySelector('.prompt_error_text').textContent = "connect";
                prompt_text.style.color = "";
                document.querySelector('#code_html').style.display = "none";
                document.querySelector('#code_script').style.display = "none";
                document.querySelector('#code_script2').style.display = "block";
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

        const command_1 = "backgroundColor()=>";
        const a = prompt_text5.substring(19);

        const command_2 = "textColor()=>";
        const b = prompt_text5.substring(13);

        const command_3 = "alert()=>";
        const c = prompt_text5.substring(9);

        const command_4 = "math()=>";
        const d = prompt_text5.substring(8);

        const command_5 = "console(num)=>";
        const e = prompt_text5.substring(14);

        const command_6 = "console(str)=>";
        const f = prompt_text5.substring(14);

        const command_7 = "binary(10->2)=>";
        const g = prompt_text5.substring(15);

        const command_8 = "binary(2->10)=>";
        const h = prompt_text5.substring(15);

        const command_9 = "program(num->text)=>";
        const i2 = prompt_text5.substring(20);

        const command_10 = "program(context->text)=>";
        const j = prompt_text5.substring(24);

        const command_11 = "program(text->num)=>";
        const k = prompt_text5.substring(20);

        const command_12 = "program(text->context)=>";
        const l = prompt_text5.substring(24);

        switch (prompt_text5) {

            // commands
            case command_1 + a:
                prompt_text2.style.color = "";
                document.querySelector('#nexser').style.background = a;
                break;

            case command_2 + b:
                prompt_text2.style.color = "";
                document.querySelector('body').style.color = b;
                break;

            case command_3 + c:
                prompt_text2.style.color = "";
                alert(c);
                break;

            case command_4 + d:
                prompt_text2.style.color = "";
                var result5 = Function('return (' + d + ');')();
                document.querySelector('#shell').textContent = result5;
                shellmenu_open()
                break;

            case command_5 + e:
                prompt_text2.style.color = "";
                var result2 = Function('return (' + e + ');')();
                break;

            case command_6 + f:
                prompt_text2.style.color = "";
                break;

            case command_7 + g:
                prompt_text2.style.color = "";
                const g2 = parseInt(g);
                document.querySelector('#shell').textContent = (g2.toString(2));
                shellmenu_open()
                break;

            case command_8 + h:
                prompt_text2.style.color = "";
                const h2 = parseInt(h, 2);
                document.querySelector('#shell').textContent = (h2.toString(10));
                shellmenu_open()
                break;

            case command_9 + i2:
                prompt_text2.style.color = "";

                // let arraySplit = i2.split('');
                let newStr = (String(i2).replace(/[a-z]/gi, "")
                    .replaceAll("01|", "A").replaceAll("02|", "B").replaceAll("03|", "C").replaceAll("04|", "D").replaceAll("05|", "E").replaceAll("06|", "F")
                    .replaceAll("07|", "G").replaceAll("08|", "H").replaceAll("09|", "I").replaceAll("10|", "J").replaceAll("11|", "K").replaceAll("12|", "L")
                    .replaceAll("13|", "M").replaceAll("14|", "N").replaceAll("15|", "O").replaceAll("16|", "P").replaceAll("17|", "Q").replaceAll("18|", "R")
                    .replaceAll("19|", "S").replaceAll("20|", "T").replaceAll("21|", "U").replaceAll("22|", "V").replaceAll("23|", "W").replaceAll("24|", "X")
                    .replaceAll("25|", "Y").replaceAll("26|", "Z")


                    .replaceAll("01^", "a").replaceAll("02^", "b").replaceAll("03^", "c").replaceAll("04^", "d").replaceAll("05^", "e").replaceAll("06^", "f")
                    .replaceAll("07^", "g").replaceAll("08^", "h").replaceAll("09^", "i").replaceAll("10^", "j").replaceAll("11^", "k").replaceAll("12^", "l")
                    .replaceAll("13^", "m").replaceAll("14^", "n").replaceAll("15^", "o").replaceAll("16^", "p").replaceAll("17^", "q").replaceAll("18^", "r")
                    .replaceAll("19^", "s").replaceAll("20^", "t").replaceAll("21^", "u").replaceAll("22^", "v").replaceAll("23^", "w").replaceAll("24^", "x")
                    .replaceAll("25^", "y").replaceAll("26^", "z")

                );

                document.querySelector('#shell').textContent = (String(newStr).replace(/[,]/gi, ""));

                const test999 = document.querySelector('#shell').textContent;

                setTimeout(() => {

                    shellmenu_open()
                    document.getElementById('shell').innerHTML = document.getElementById('shell').value = test999;

                    setTimeout(() => {

                        document.querySelectorAll('.htmlviewer_run_menu').forEach(function (htmlviewer_run_menu) {
                            htmlviewer_run_menu.closest('.child_windows');
                            htmlviewer_run_menu.classList.remove('active');
                            htmlviewer_run_menu.style.zIndex = largestZIndex++;
                            zindexwindow_addnavy();
                        });
                        preview.srcdoc = test999;

                    }, 100);
                }, 100);
                break;

            case command_10 + j:

                prompt_text2.style.color = "";
                let newStr2 = (String(j)

                    .replaceAll("{h}", "<html>").replaceAll("{/h}", "</html>")
                    .replaceAll("{class}", "class=")
                    .replaceAll("{id}", "id=")


                    .replaceAll("{sty}", "<style>").replaceAll("{/sty}", "</style>")
                    .replaceAll("{bgc}", "background-color")
                    .replaceAll("{bk}", "background")
                    .replaceAll("{clr}", "color")
                    .replaceAll("{mgn}", "margin")
                    .replaceAll("{pdg}", "padding")
                    .replaceAll("{dsp}", "display")
                    .replaceAll("{wdh}", "width")
                    .replaceAll("{hgt}", "height")
                    .replaceAll("{pstn}", "position")
                    .replaceAll("{ftsze}", "font-size")
                    .replaceAll("{ftwigt}", "font-weight")
                    .replaceAll("{brdr}", "border")


                    .replaceAll("{s}", "<script>").replaceAll("{/s}", "</script>")

                    .replaceAll("{conlog}", "console.log")

                    .replaceAll("{dmt}", "document")
                    .replaceAll("{gid}", "getElementById")
                    .replaceAll("{qes}", "querySelector")

                    .replaceAll("{texcon}", "textContent")
                    .replaceAll("{intext}", "innerText")
                    .replaceAll("{inhtml}", "innerHTML")

                    .replaceAll("{addevlis}", "addEventListener")
                    .replaceAll("{onclk}", "onclick")
                    .replaceAll("{func}", "function")


                );
                document.querySelector('#shell').textContent = (String(newStr2));

                const test9992 = document.querySelector('#shell').textContent;

                setTimeout(() => {

                    shellmenu_open()
                    document.getElementById('shell').innerText = document.getElementById('shell').value = test9992;

                    setTimeout(() => {

                        document.querySelectorAll('.htmlviewer_run_menu').forEach(function (htmlviewer_run_menu) {
                            htmlviewer_run_menu.closest('.child_windows');
                            htmlviewer_run_menu.classList.remove('active');
                            htmlviewer_run_menu.style.zIndex = largestZIndex++;
                            zindexwindow_addnavy();
                        });
                        preview.srcdoc = test9992;

                    }, 100);
                }, 100);
                break;



            case command_11 + k:

                prompt_text2.style.color = "";

                let arraySplit3 = k.split('');
                let newStr3 = (String(arraySplit3)
                    .replaceAll("A", "01|").replaceAll("B", "02|").replaceAll("C", "03|").replaceAll("D", "04|").replaceAll("E", "05|").replaceAll("F", "06|")
                    .replaceAll("G", "07|").replaceAll("H", "08|").replaceAll("I", "09|").replaceAll("J", "10|").replaceAll("K", "11|").replaceAll("L", "12|")
                    .replaceAll("M", "13|").replaceAll("N", "14|").replaceAll("O", "15|").replaceAll("P", "16|").replaceAll("Q", "17|").replaceAll("R", "18|")
                    .replaceAll("S", "19|").replaceAll("T", "20|").replaceAll("U", "21|").replaceAll("V", "22|").replaceAll("W", "23|").replaceAll("X", "24|")
                    .replaceAll("Y", "25|").replaceAll("Z", "26|")


                    .replaceAll("a", "01^").replaceAll("b", "02^").replaceAll("c", "03^").replaceAll("d", "04^").replaceAll("e", "05^").replaceAll("f", "06^")
                    .replaceAll("g", "07^").replaceAll("h", "08^").replaceAll("i", "09^").replaceAll("j", "10^").replaceAll("k", "11^").replaceAll("l", "12^")
                    .replaceAll("m", "13^").replaceAll("n", "14^").replaceAll("o", "15^").replaceAll("p", "16^").replaceAll("q", "17^").replaceAll("r", "18^")
                    .replaceAll("s", "19^").replaceAll("t", "20^").replaceAll("u", "21^").replaceAll("v", "22^").replaceAll("w", "23^").replaceAll("x", "24^")
                    .replaceAll("y", "25^").replaceAll("z", "26^")

                );

                document.querySelector('#shell').innerHTML = (String(newStr3).replace(/[,]/gi, ""));

                const test9995 = document.querySelector('#shell').textContent;

                setTimeout(() => {

                    shellmenu_open()
                    document.getElementById('shell').textContent = document.getElementById('shell').value = test9995;

                }, 100);
                break;



            case command_12 + l:

                prompt_text2.style.color = "";
                let newStr10 = (String(l)

                    .replaceAll("<html>", "{h}").replaceAll("</html>", "{/h}")
                    .replaceAll("class=", "{class}")
                    .replaceAll("id=", "{id}")


                    .replaceAll("<style>", "{sty}").replaceAll("</style>", "{/sty}")
                    .replaceAll("background-color", "{bgc}")
                    .replaceAll("background", "{bk}")
                    .replaceAll("color", "{clr}")
                    .replaceAll("margin", "{mgn}")
                    .replaceAll("padding", "{pdg}")
                    .replaceAll("display", "{dsp}")
                    .replaceAll("width", "{wdh}")
                    .replaceAll("height", "{hgt}")
                    .replaceAll("position", "{pstn}")
                    .replaceAll("font-size", "{ftsze}")
                    .replaceAll("font-weight", "{ftwigt}")
                    .replaceAll("border", "{brdr}")


                    .replaceAll("<script>", "{s}").replaceAll("</script>", "{/s}")

                    .replaceAll("console.log", "{conlog}")

                    .replaceAll("document", "{dmt}")
                    .replaceAll("getElementById", "{gid}",)
                    .replaceAll("querySelector", "{qes}",)

                    .replaceAll("textContent", "{texcon}")
                    .replaceAll("innerText", "{intext}")
                    .replaceAll("innerHTML", "{inhtml}")

                    .replaceAll("addEventListener", "{addevlis}")
                    .replaceAll("onclick", "{onclk}")
                    .replaceAll("function", "{func}")

                );
                document.querySelector('#shell').textContent = (String(newStr10));

                const test9999 = document.querySelector('#shell').textContent;

                setTimeout(() => {
                    shellmenu_open()
                    document.getElementById('shell').innerText = document.getElementById('shell').value = test9999;
                }, 100);
                break;


            case 'nexser/memory':
                document.querySelector('.memory_menu').classList.remove('active');

                document.querySelectorAll('.memory_menu').forEach(function (memory_menu) {
                    memory_menu.closest('.child_windows');
                    memory_menu.classList.remove('active');
                    memory_menu.style.zIndex = largestZIndex++;
                    zindexwindow_addnavy();
                })

                prompt_text2.style.color = "";
                break;


            case '':
                prompt_text2.style.color = "";
                break;
            case 'help':
                prompt_text2.style.color = "";

                command_help_menu.classList.remove('active');
                command_help_menu.style.zIndex = largestZIndex++;
                zindexwindow_addnavy();
                break;
            case 'windows95/sound/start/play':
                sound();
                prompt_text2.style.color = "";
                break;
            case 'windows95/sound/shutdown/play':
                sound2();
                prompt_text2.style.color = "";
                break;
            case 'screen/full':
                full();
                prompt_text2.style.color = "";
                break;
            case 'screen/min':
                min();
                prompt_text2.style.color = "";
                break;
            case 'taskbar/none':
                taskbar.style.display = "none";
                const data_taskbar_none = document.prompt_text_form2.prompt_text2.value;
                localStorage.setItem('data_taskbar_none', data_taskbar_none);
                prompt_text2.style.color = "";
                taskbar_none()
                break;
            case 'taskbar/active':
                prompt_text2.style.color = "";
                taskbar_active()
                break;
            case 'allwindow/reset':
                prompt_text2.style.color = "";
                window_reset()
                break;
            case 'allwindow/close':
                if (localStorage.getItem('data_taskbar_none')) {
                    document.querySelector('.window_error_text').textContent = "taskbar none window close no!"
                    error_windows.classList.remove('active')
                    prompt_text2.style.color = "";
                    document.querySelector('.test_allwindow').style.display = "block";
                    sound3()
                } else {

                    prompt_text2.style.color = "";
                    window_none()
                    taskbtn_load()
                }
                break;
            case 'allwindow/open':
                prompt_text2.style.color = "";
                window_active();
                taskbtn_load();
                cpucalc_open();
                break;
            case 'allwindow/min':
                prompt_text2.style.color = "";
                allwindow_min()
                break;
            case 'allwindow/big':
                prompt_text2.style.color = "";
                allwindow_big()
                break;
            case 'title/none':
                const data_title_none = document.prompt_text_form2.prompt_text2.value;
                localStorage.setItem('data_title_none', data_title_none);
                prompt_text2.style.color = "";
                title_none()
                break;
            case 'title/active':
                localStorage.removeItem('data_title_none');
                prompt_text2.style.color = "";
                title_active()
                break;
            case 'window/font/large':
                prompt_text2.style.color = "";
                let test_window = document.getElementsByClassName('child_windows')
                Array.from(test_window).forEach(element => {
                    element.style.fontSize = "20px";
                })
                break;
            case 'window/font/reset':
                prompt_text2.style.color = "";
                let test_window2 = document.getElementsByClassName('child_windows')
                Array.from(test_window2).forEach(element => {
                    element.style.fontSize = "";
                })
                break;
            case 'cpu/bench':
                prompt_text2.style.color = "";
                cpu_calc_menu.classList.remove('active');
                cpucalc_open();
                break;
            case 'nexser/data/clear':
                allStorage_clear()
                prompt_text2.style.color = "";
                break;
            case 'welcome':
                prompt_text2.style.color = "";
                welcome()
                break;
            case 'file/none':
                const file_none = document.prompt_text_form2.prompt_text2.value;
                localStorage.setItem('file_none', file_none);
                prompt_text2.style.color = "";
                document.querySelector('.files_inline').style.display = "none";
                break;
            case 'file/active':
                localStorage.removeItem('file_none');
                prompt_text2.style.color = "";
                document.querySelector('.files_inline').style.display = "flex";
                break;

            case 'windows95/open':
                location.href = 'https://moti5768.github.io/moti.world/windows95.html'
                prompt_text2.style.color = "";
                break;
            case 'windows2000/open':
                location.href = 'https://moti5768.github.io/moti.world/windows%202000/windows2000_beta.html'
                prompt_text2.style.color = "";
                break;
            case 'windowsystem/open':
                location.href = 'https://moti5768.github.io/moti.world/new%20OS/WindowSystem.html'
                prompt_text2.style.color = "";
                break;
            default:
                prompt_text2.style.color = "red";
                break;
        }
    }


    function shellmenu_open() {
        document.querySelectorAll('.prompt_shell_menu').forEach(function (prompt_shell_menu) {
            prompt_shell_menu.closest('.child_windows');
            prompt_shell_menu.classList.remove('active');
            prompt_shell_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy();
        });
    }

    function p_clear() {
        document.querySelector('.focus2').value = "";
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
            navigator.getBattery().then((battery) => {
                document.getElementsByClassName('level')[0].innerHTML = battery.level;
                document.getElementsByClassName('charging')[0].innerHTML = battery.charging;
                document.getElementsByClassName('chargingTime')[0].innerHTML = battery.chargingTime;
                document.getElementsByClassName('dischargingTime')[0].innerHTML = battery.dischargingTime;
            });
            document.getElementsByClassName('memory')[0].textContent = (`Memory:   ${(performance.memory.usedJSHeapSize / 1024).toFixed(2)}KB`);
            document.getElementsByClassName('memory2')[0].textContent = (`使用可能なメモリ    ${(performance.memory.jsHeapSizeLimit / 1048576).toFixed(2)}MB`);
            document.getElementsByClassName('memory3')[0].textContent = (`割り当てられたメモリ  ${(performance.memory.totalJSHeapSize / 1024).toFixed(2)}KB`);
            document.getElementsByClassName('memory4')[0].textContent = (`現在使用中のメモリ   ${(performance.memory.usedJSHeapSize / 1024).toFixed(2)}KB`);

            const locallength = localStorage.length;
            document.getElementsByClassName('length_localStorage')[0].textContent = (locallength);

        } else {
            const locallength = localStorage.length;
            document.getElementsByClassName('tests')[0].textContent = (locallength);

            const backtext_data2 = localStorage.getItem('backtext_data');
            document.getElementById('background_text2').textContent = (backtext_data2)

            const get = document.getElementsByClassName('child_windows');
            const get2 = document.getElementsByClassName('active');
            gets = get.length;
            gets2 = get2.length - 2;
            document.getElementsByClassName('child_windows_length')[0].textContent = (gets);
            document.getElementsByClassName('active_length')[0].textContent = (gets2);

            if (localStorage.getItem(KEY_BKCOLOR, bkcolor)) {
                document.getElementsByClassName('mini_desktop')[0].style.backgroundColor = bkcolor;
            }

            if (localStorage.getItem('MemoData_export')) {
                document.getElementsByClassName('inport_icon')[0].style.color = "white"
                document.getElementsByClassName('inport_icon')[0].style.background = "black"
            } else {
                document.getElementsByClassName('inport_icon')[0].style.color = ""
                document.getElementsByClassName('inport_icon')[0].style.background = ""
            }
            const un = document.getElementsByClassName('navy').length;
            document.querySelector('.title_navy').textContent = un;

            const un2 = document.getElementsByClassName('drag').length;
            document.querySelector('.drag_window').textContent = un2;

            document.getElementsByClassName('cpu_cores')[0].textContent = (navigator.hardwareConcurrency);

            document.getElementsByClassName('window_memory')[0].textContent = (`Memory:   ${(performance.memory.usedJSHeapSize / 1024).toFixed(2)}KB`);
            document.getElementsByClassName('window_memory2')[0].textContent = (`使用可能なメモリ    ${(performance.memory.jsHeapSizeLimit / 1048576).toFixed(2)}MB`);
            document.getElementsByClassName('window_memory3')[0].textContent = (`割り当てられたメモリ  ${(performance.memory.totalJSHeapSize / 1024).toFixed(2)}KB`);
            document.getElementsByClassName('window_memory4')[0].textContent = (`現在使用中のメモリ   ${(performance.memory.usedJSHeapSize / 1024).toFixed(2)}KB`);

        }
    }, 100);
    Array.from(document.getElementsByClassName('window_inline_list')).forEach((window_inline_list) => {
        window_inline_list.addEventListener('click', function () {
            taskbtn_load()
        });
    })
    Array.from(document.getElementsByClassName('desktop_files')).forEach((desktop_files) => {
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
                const closebutton_closest = close_button.closest('.child_windows');
                closebutton_closest.classList.add('active');
                taskbtn_load()
            }, 100);
        });
    })
    document.querySelectorAll('.close_button2').forEach(function (close_button2) {
        close_button2.addEventListener('click', function () {
            setTimeout(() => {
                const closebutton2 = close_button2.closest('.error_windows');
                closebutton2.classList.add('active');
                document.querySelector('.test_allwindow').style.display = "none";
                document.getElementsByClassName('error_title_text')[0].textContent = "error";
                document.getElementsByClassName('error_icon')[0].style.display = "";
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
        bigscreen_button.addEventListener('mousedown', function () {
            const elements = document.querySelectorAll('.child_windows');
            elements.forEach(element => {
                element.dataset.originalWidth = element.style.width;
                element.dataset.originalHeight = element.style.height;
                element.dataset.originalTop = element.style.top;
                element.dataset.originalLeft = element.style.left;
            });
        })
        bigscreen_button.addEventListener('click', function () {
            const bigscreenbutton = bigscreen_button.closest('.child_windows');

            const childElements = bigscreenbutton.children;
            for (let child of childElements) {
                child.style.display = 'none';
                document.querySelectorAll('.title,.title_buttons').forEach(function (titles) {
                    titles.style.display = "block"
                })
                document.querySelectorAll('.title2').forEach(function (window_title2) {
                    window_title2.style.display = "flex"
                })
            }

            bigscreenbutton.classList.remove('rightwindow');
            bigscreenbutton.classList.remove('leftwindow');

            const t = localStorage.getItem('taskbar_height');
            if (localStorage.getItem('data_taskbar_none')) {
                bigscreenbutton.style.height = ""
                bigscreenbutton.style.width = ""
                bigscreenbutton.style.top = "0"
                bigscreenbutton.style.left = "0"
                bigscreenbutton.style.transition = "0.15s cubic-bezier(0, 0, 1, 1)"
            } else if (localStorage.getItem('taskbar_position_button')) {
                bigscreenbutton.style.height = ""
                bigscreenbutton.style.width = ""
                bigscreenbutton.style.top = "40px"
                bigscreenbutton.style.left = "0"

                bigscreenbutton.style.top = t + "px"

                bigscreenbutton.style.transition = "0.15s cubic-bezier(0, 0, 1, 1)"
            } else {
                bigscreenbutton.style.height = ""
                bigscreenbutton.style.width = ""
                bigscreenbutton.style.top = "0"
                bigscreenbutton.style.left = "0"
                bigscreenbutton.style.transition = "0.15s cubic-bezier(0, 0, 1, 1)"
            }

            setTimeout(() => {
                bigscreenbutton.style.transition = ""
                for (let child of childElements) {
                    child.style.display = '';
                }
                if (localStorage.getItem('allwindow_toolbar')) {
                    document.querySelectorAll('.window_tool').forEach(function (window_tool) {
                        window_tool.style.display = "block"
                    })
                }
            }, 150);
            bigscreenbutton.classList.add('big');
            if (!note_pad.classList.contains('active')) {
                document.querySelector('.note_area').focus()
            }

            setTimeout(() => {
                const task = document.getElementById('taskbar').clientHeight;
                const child_windows_big2 = bigscreenbutton.clientHeight;
                bigscreenbutton.style.height = child_windows_big2 + - + task + "px"
            }, 150);

        });
    })


    document.querySelectorAll('.minscreen_button').forEach(function (minscreen_button) {
        minscreen_button.addEventListener('click', function () {

            const minscreenbutton = minscreen_button.closest('.child_windows');
            const childElements = minscreenbutton.children;

            for (let child of childElements) {
                child.style.display = 'none';
                document.querySelectorAll('.title,.title_buttons').forEach(function (titles) {
                    titles.style.display = "block"
                })
                document.querySelectorAll('.title2').forEach(function (window_title2) {
                    window_title2.style.display = "flex"
                })
            }

            minscreenbutton.classList.remove('rightwindow');
            minscreenbutton.classList.remove('leftwindow');

            minscreenbutton.classList.add('default');
            minscreenbutton.classList.remove('big');

            const elements = document.querySelectorAll('.child_windows');
            elements.forEach(element => {
                element.style.width = element.dataset.originalWidth;
                element.style.height = element.dataset.originalHeight;
                element.style.top = element.dataset.originalTop;
                element.style.left = element.dataset.originalLeft;
            });

            minscreenbutton.style.transition = "0.15s cubic-bezier(0, 0, 1, 1)"
            setTimeout(() => {
                if (!note_pad.classList.contains('active')) {
                    document.querySelector('.note_area').focus()
                }
                minscreenbutton.style.transition = ""
            }, 150);

            setTimeout(() => {
                for (let child of childElements) {
                    child.style.display = '';
                }
                if (localStorage.getItem('allwindow_toolbar')) {
                    document.querySelectorAll('.window_tool').forEach(function (window_tool) {
                        window_tool.style.display = "block"
                    })
                }
            }, 150);
        });
    });

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
            alliwindow_min.style.transition = "0.15s cubic-bezier(0, 0, 1, 1)"
            setTimeout(() => {
                alliwindow_min.classList.remove('big');
                alliwindow_min.style.transition = ""
            }, 150);
        });
    }

    function allwindow_big() {
        document.querySelectorAll('.child_windows').forEach(function (alliwindow_big) {
            const bigscreenbutton = alliwindow_big.closest('.child_windows');
            const childElements = bigscreenbutton.children;

            for (let child of childElements) {
                child.style.display = 'none';
                document.querySelectorAll('.title,.title_buttons').forEach(function (titles) {
                    titles.style.display = "block"
                })
                document.querySelectorAll('.title2').forEach(function (window_title2) {
                    window_title2.style.display = "flex"
                })
            }

            bigscreenbutton.classList.remove('rightwindow');
            bigscreenbutton.classList.remove('leftwindow');

            if (localStorage.getItem('taskbar_position_button')) {
                bigscreenbutton.style.height = ""
                bigscreenbutton.style.width = ""
                bigscreenbutton.style.top = "40px"
                bigscreenbutton.style.left = "0"
                bigscreenbutton.style.transition = "0.15s cubic-bezier(0, 0, 1, 1)"
            } else {
                bigscreenbutton.style.height = ""
                bigscreenbutton.style.width = ""
                bigscreenbutton.style.top = "0"
                bigscreenbutton.style.left = "0"
                bigscreenbutton.style.transition = "0.15s cubic-bezier(0, 0, 1, 1)"
            }
            setTimeout(() => {
                bigscreenbutton.style.transition = ""
                for (let child of childElements) {
                    child.style.display = '';
                }
                if (localStorage.getItem('allwindow_toolbar')) {
                    document.querySelectorAll('.window_tool').forEach(function (window_tool) {
                        window_tool.style.display = "block"
                    })
                }
            }, 150);
            bigscreenbutton.classList.add('big');
            if (!note_pad.classList.contains('active')) {
                document.querySelector('.note_area').focus()
            }
        });
    }

    document.querySelectorAll('.window_fullleft').forEach(function (window_left) {
        window_left.addEventListener('click', function () {
            const windowleft = window_left.closest('.child_windows');

            windowleft.classList.remove('rightwindow');
            windowleft.classList.add('leftwindow');

            const t = localStorage.getItem('taskbar_height');
            if (localStorage.getItem('data_taskbar_none')) {
                windowleft.style.right = "auto";
                windowleft.style.top = "0";
                windowleft.style.left = "0";
                windowleft.style.height = "100%";
                windowleft.style.width = "49.9%";
                windowleft.style.transition = "0.15s cubic-bezier(0, 0, 1, 1)";
            } else if (localStorage.getItem('taskbar_position_button')) {
                windowleft.style.right = "auto";
                windowleft.style.top = "40px";
                windowleft.style.left = "0";
                windowleft.style.height = "100%";
                windowleft.style.width = "49.9%";

                windowleft.style.top = t + "px";

                windowleft.style.transition = "0.15s cubic-bezier(0, 0, 1, 1)";
            } else {
                windowleft.style.right = "auto";
                windowleft.style.top = "0";
                windowleft.style.left = "0";
                windowleft.style.height = "100%";
                windowleft.style.width = "49.9%";
                windowleft.style.transition = "0.15s cubic-bezier(0, 0, 1, 1)";
            }
            setTimeout(() => {
                windowleft.style.transition = "";
                zindexwindow_addnavy()
                titlecolor_set()
            }, 150);


            setTimeout(() => {
                const task = document.getElementById('taskbar').clientHeight;
                const child_windows_big2 = windowleft.clientHeight;
                windowleft.style.height = child_windows_big2 + - + task + "px"
            }, 150);

            windowleft.classList.remove('big');
            windowleft.classList.remove('default');
        });
    })
    document.querySelectorAll('.window_fullright').forEach(function (window_right) {
        window_right.addEventListener('click', function () {
            const windowright = window_right.closest('.child_windows');

            windowright.classList.remove('leftwindow');
            windowright.classList.add('rightwindow');

            const t = localStorage.getItem('taskbar_height');
            if (localStorage.getItem('data_taskbar_none')) {
                windowright.style.left = "";
                windowright.style.top = "0";
                windowright.style.right = "0px";
                windowright.style.height = "100%";
                windowright.style.width = "49.9%";
                windowright.style.transition = "0.15s cubic-bezier(0, 0, 1, 1)";
            } else if (localStorage.getItem('taskbar_position_button')) {
                windowright.style.left = "";
                windowright.style.top = "40px";
                windowright.style.right = "0px";
                windowright.style.height = "100%";
                windowright.style.width = "49.9%";

                windowright.style.top = t + "px";

                windowright.style.transition = "0.15s cubic-bezier(0, 0, 1, 1)";
            } else {
                windowright.style.left = "";
                windowright.style.top = "0";
                windowright.style.right = "0px";
                windowright.style.height = "100%";
                windowright.style.width = "49.9%";
                windowright.style.transition = "0.15s cubic-bezier(0, 0, 1, 1)";
            }
            setTimeout(() => {
                windowright.style.transition = "";
                zindexwindow_addnavy()
                titlecolor_set()
            }, 150);

            setTimeout(() => {
                const task = document.getElementById('taskbar').clientHeight;
                const child_windows_big2 = windowright.clientHeight;
                windowright.style.height = child_windows_big2 + - + task + "px"
            }, 150);

            windowright.classList.remove('big');
            windowright.classList.remove('default');
        });
    })

    document.querySelectorAll('.window_half_big').forEach(function (window_half_big) {
        window_half_big.addEventListener('click', function () {
            const windowhalfbig = window_half_big.closest('.child_windows');

            windowhalfbig.classList.remove('rightwindow');
            windowhalfbig.classList.remove('leftwindow');
            windowhalfbig.classList.remove('half2');

            let shiftX = event.clientX - window_half_big.getBoundingClientRect().left;
            let shiftY = event.clientY - window_half_big.getBoundingClientRect().top;
            let top = document.querySelector('.top');
            console.log(top)
            moveAt(event.pageX, event.pageY);
            function moveAt(pageX, pageY) {
                window_half_big.style.left = pageX - shiftX + 'px';
                window_half_big.style.top = pageY - shiftY + 'px';
            }
            function onMouseMove(event) {
                moveAt(event.pageX, event.pageY);
            }

            windowhalfbig.style.height = "55%"
            windowhalfbig.style.width = "55%"
            windowhalfbig.style.transition = "0.15s cubic-bezier(0, 0, 1, 1)"
            setTimeout(() => {
                windowhalfbig.style.transition = ""
            }, 150);
            windowhalfbig.classList.remove('big')
        })
    })

    document.querySelectorAll('.windowsize_reset').forEach(function (windowsize_reset) {
        windowsize_reset.addEventListener('click', function () {
            const windowsizereset = windowsize_reset.closest('.child_windows');
            windowsizereset.style.transition = "0.15s cubic-bezier(0, 0, 1, 1)";

            if (windowsizereset.classList.contains('rightwindow')) {
                windowsizereset.style.height = "";
                windowsizereset.style.width = "max-content";
                windowsizereset.style.right = "0";
            } else {
                windowsizereset.style.height = "";
                windowsizereset.style.width = "";
                windowsizereset.style.right = "";
            }

            windowsizereset.classList.remove('big');

            setTimeout(() => {
                windowsizereset.style.transition = ""
            }, 150);

            windowsizereset.classList.remove('leftwindow');
            windowsizereset.classList.remove('rightwindow');

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

    document.querySelectorAll('.parent_list').forEach(function (parent_list) {
        parent_list.addEventListener('mouseover', function () {
            let parentlist = parent_list.lastElementChild;
            parentlist.style.display = "flex"
            document.querySelectorAll('.windowtool_child').forEach(function (windowtool_child) {
                windowtool_child.style.display = "none"
            })
            document.querySelectorAll('.parent_list').forEach(function (c_list) {
                c_list.addEventListener('mouseleave', function () {
                    document.querySelectorAll('.child_list', '.active').forEach(function (cb_list) {
                        cb_list.style.display = "none";
                    })
                })
            })
        })
    })

    document.querySelectorAll('.windowtool_parent').forEach(function (windowtool_parent) {
        windowtool_parent.addEventListener('click', function () {
            let parentlist = windowtool_parent.lastElementChild;
            if (parentlist.style.display == "block") {
                parentlist.style.display = "none"
            } else {
                parentlist.style.display = "block"
            }
        })
    })
    document.querySelectorAll('.windowtool_child').forEach(function (windowtool_child) {
        windowtool_child.addEventListener('click', function () {
            taskbtn_load()
        })
    })
    document.querySelectorAll('.allwindow_toolbar').forEach(function (allwindow_toolbar) {
        allwindow_toolbar.addEventListener('click', function () {
            document.querySelectorAll('.window_tool').forEach(function (window_tool) {
                if (window_tool.style.display == "block") {
                    window_tool.style.display = "none"
                    localStorage.removeItem('allwindow_toolbar');

                    document.querySelectorAll('.window_inline_side').forEach(function (window_inline_side) {
                        window_inline_side.style.top = ""
                    })
                    document.querySelector('.clock_menu').style.height = "355px"
                } else {
                    window_tool.style.display = "block"
                    localStorage.setItem('allwindow_toolbar', allwindow_toolbar);
                    document.querySelectorAll('.window_inline_side').forEach(function (window_inline_side) {
                        window_inline_side.style.top = "31px"
                    })
                    document.querySelector('.clock_menu').style.height = ""
                }
            })
        })
    })

    toolbar.addEventListener('mousedown', function () {
        alltitle_navyreomve();
        titlecolor_set();
    })


    document.querySelectorAll('.clockdata_analog').forEach(function (clockdata_analog) {
        clockdata_analog.addEventListener('click', function () {
            localStorage.setItem('clockdata_analog', clockdata_analog)
            document.getElementsByClassName('digital_clock_area')[0].style.display = "none";
            document.getElementsByClassName('analog_clock_area')[0].style.display = "block"
        })
    })
    document.querySelectorAll('.clockdata_digital').forEach(function (clockdata_digital) {
        clockdata_digital.addEventListener('click', function () {
            localStorage.removeItem('clockdata_analog')
            document.getElementsByClassName('digital_clock_area')[0].style.display = "flex";
            document.getElementsByClassName('analog_clock_area')[0].style.display = "none"
        })
    })

    document.querySelectorAll('.title, .drag_button').forEach(function (title) {
        title.addEventListener('mousedown', function () {
            document.querySelectorAll('.windowtool_child').forEach(function (windowtool_child) {
                windowtool_child.style.display = "none"
            })
            setTimeout(() => {
                zindexwindow_addnavy()
                titlecolor_set()
            }, 100);
        })

    })
    document.querySelectorAll('.title2').forEach(function (title2) {
        title2.addEventListener('mousedown', function () {
            document.querySelectorAll('.windowtool_child').forEach(function (windowtool_child) {
                windowtool_child.style.display = "none"
            })
        })
    })
    document.querySelectorAll('.window_contents').forEach(function (window_contents) {
        window_contents.addEventListener('mousedown', function () {
            document.querySelectorAll('.windowtool_child').forEach(function (windowtool_child) {
                windowtool_child.style.display = "none"
            })
        })
    })


    Array.from(document.getElementsByClassName('desktop_files')).forEach((desktop_files) => {
        desktop_files.addEventListener('mousedown', function () {
            Array.from(document.getElementsByClassName('desktop_files')).forEach((df1) => {
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
            })
            parent_list.classList.add('select');

            document.querySelectorAll('.window_inline_menus_parent').forEach(function (parent_list3) {
                const menus_child = parent_list3.lastElementChild;
                menus_child.style.display = "none"
            })
        })
    })
    document.querySelectorAll('.window_inline_menus_parent').forEach(function (parent_list4) {
        parent_list4.addEventListener('mousedown', function () {
            const menus_child2 = parent_list4.lastElementChild;
            menus_child2.style.display = "block"
        })
    })

    document.querySelectorAll('.menuchild1').forEach(function (menuchild1) {
        menuchild1.style.display = "block"
    })

    function window_back_silver() {
        Array.from(document.getElementsByClassName('back_silver')).forEach((back_silver) => {
            back_silver.style.background = "silver"
        })
    }

    document.querySelectorAll('.child_windows, .child').forEach(function (z_index_child_windows) {
        const zindexchildwindows = z_index_child_windows.closest('.child_windows');
        z_index_child_windows.addEventListener('mousedown', function () {
            start_menu.style.display = "none";
            document.querySelector('.start_button').classList.remove('pressed');
            taskbtn_load()
            window_z_index = zindexchildwindows.style.zIndex = largestZIndex++;
            getLargestZIndex('.child_windows');
            z_index.textContent = getLargestZIndex('.child_windows');
            zindexwindow_addnavy()
            titlecolor_set()

            const elements = document.querySelectorAll('.rectangle');
            elements.forEach(element => {
                element.classList.remove('rectangle');
            });
        });
        z_index_child_windows.addEventListener('click', function () {
            zindexwindow_addnavy()
            setTimeout(() => {
                zindexwindow_addnavy()
                titlecolor_set()
            }, 100);
            setTimeout(() => {
                resizeTextarea()
            }, 150);
        })
    })

    document.querySelectorAll('.note_pad, .child').forEach(function (notepad_foccus) {
        notepad_foccus.addEventListener('mouseup', function () {
            if (!note_pad.classList.contains('active')) {
                document.querySelector('.note_area').focus()
            }
        });
    })
    document.querySelectorAll('.window_prompt, .child').forEach(function (window_prompt) {
        window_prompt.addEventListener('mouseup', function () {
            document.querySelector('.focus2').focus()
        });
    })

    function alltitle_navyreomve() {
        document.querySelectorAll('.title').forEach(function (wt) {
            wt.classList.remove('navy')
        })
    }

    document.querySelectorAll('.nexser_search').forEach(function (nexser_search) {
        nexser_search.addEventListener('click', function () {
            nexser_search_menu.classList.toggle('active');
            nexser_search_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });

    function nexser_search() {
        var input, filter, ul, li, a, i, txtValue;
        input = document.getElementById('myInput');
        filter = input.value.toUpperCase();
        ul = document.getElementById("myUL");
        li = ul.getElementsByTagName('li');
        for (i = 0; i < li.length; i++) {
            a = li[i].getElementsByTagName("span")[0];
            txtValue = a.textContent || a.innerText;
            if (txtValue.toUpperCase().indexOf(filter) > -1) {
                li[i].style.display = "";
            } else {
                li[i].style.display = "none";
            }
        }
    }

    document.querySelectorAll('.nexser_guidebook').forEach(function (nexser_guidebook) {
        nexser_guidebook.addEventListener('click', function () {
            nexser_guidebook_menu.classList.toggle('active');
            nexser_guidebook_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });
    document.querySelectorAll('.guidebook_window').forEach(function (guidebook_window) {
        guidebook_window.addEventListener('click', function () {
            guidebook_window_menu.classList.toggle('active');
            guidebook_window_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });
    document.querySelectorAll('.guidebook_file').forEach(function (guidebook_file) {
        guidebook_file.addEventListener('click', function () {
            guidebook_file_menu.classList.toggle('active');
            guidebook_file_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });
    document.querySelectorAll('.guidebook_taskbar').forEach(function (guidebook_taskbar) {
        guidebook_taskbar.addEventListener('click', function () {
            guidebook_taskbar_menu.classList.toggle('active');
            guidebook_taskbar_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });

    document.querySelectorAll('.passmenu_button').forEach(function (passmenu_button) {
        passmenu_button.addEventListener('click', function () {
            password_menu.classList.toggle('active');
            password_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });

    document.querySelectorAll('.test_button').forEach(function (test_button) {
        test_button.addEventListener('click', function () {
            main.classList.toggle('active');
            main.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });
    document.querySelectorAll('.test_button2').forEach(function (test_button2) {
        test_button2.addEventListener('click', function () {
            my_computer.classList.toggle('active');
            my_computer.style.zIndex = largestZIndex++;;
            zindexwindow_addnavy();
        });
    });
    document.querySelectorAll('.test_button3').forEach(function (test_button3) {
        test_button3.addEventListener('click', function () {
            control.classList.toggle('active');
            control.style.zIndex = largestZIndex++;
            zindexwindow_addnavy();
        });
    });
    document.querySelectorAll('.test_button4').forEach(function (test_button4) {
        test_button4.addEventListener('click', function () {
            color_menu.classList.toggle('active');
            color_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });
    document.querySelectorAll('.test_button5').forEach(function (test_button5) {
        test_button5.addEventListener('click', function () {
            system_menu.classList.toggle('active');
            system_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });
    document.querySelectorAll('.test_button6').forEach(function (test_button6) {
        test_button6.addEventListener('click', function () {
            window_prompt.classList.toggle('active');
            window_prompt.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });
    document.querySelectorAll('.test_button7').forEach(function (test_button7) {
        test_button7.addEventListener('click', function () {
            clock_menu.classList.toggle('active');
            clock_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });
    document.querySelectorAll('.test_button8').forEach(function (test_button8) {
        test_button8.addEventListener('click', function () {
            sound_menu.classList.toggle('active');
            sound_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });
    document.querySelectorAll('.test_button9').forEach(function (test_button9) {
        test_button9.addEventListener('click', function () {
            driver_menu.classList.toggle('active');
            driver_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });
    document.querySelectorAll('.test_button10').forEach(function (test_button10) {
        test_button10.addEventListener('click', function () {
            mouse_menu.classList.toggle('active');
            mouse_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });
    document.querySelectorAll('.test_button11').forEach(function (test_button11) {
        test_button11.addEventListener('click', function () {
            screen_text_menu.classList.toggle('active');
            screen_text_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });
    document.querySelectorAll('.test_button12').forEach(function (test_button12) {
        test_button12.addEventListener('click', function () {
            note_pad.classList.toggle('active');
            note_pad.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
            if (!note_pad.classList.contains('active')) {
                document.querySelector('.note_area').focus()
                resizeTextarea()
            }
        });
    });
    document.querySelectorAll('.test_button13').forEach(function (test_button13) {
        test_button13.addEventListener('click', function () {
            text_drop_menu.classList.toggle('active');
            text_drop_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });
    document.querySelectorAll('.test_button14').forEach(function (test_button14) {
        test_button14.addEventListener('click', function () {
            windowmode_menu.classList.toggle('active');
            windowmode_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });
    document.querySelectorAll('.test_button15').forEach(function (test_button15) {
        test_button15.addEventListener('click', function () {
            accessory_menu.classList.toggle('active');
            accessory_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });
    document.querySelectorAll('.test_button16').forEach(function (test_button16) {
        test_button16.addEventListener('click', function () {
            calc_menu.classList.toggle('active');
            calc_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });
    document.querySelectorAll('.test_button17').forEach(function (test_button17) {
        test_button17.addEventListener('click', function () {
            nexser_sound_menu.classList.toggle('active');
            nexser_sound_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });
    document.querySelectorAll('.test_button18').forEach(function (test_button18) {
        test_button18.addEventListener('click', function () {
            camera_menu.classList.toggle('active');
            camera_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });
    document.querySelectorAll('.test_button19').forEach(function (test_button19) {
        test_button19.addEventListener('click', function () {
            htmlviewer_edit_menu.classList.toggle('active');
            htmlviewer_edit_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });
    document.querySelectorAll('.test_button20').forEach(function (test_button20) {
        test_button20.addEventListener('click', function () {
            htmlviewer_run_menu.classList.toggle('active');
            htmlviewer_run_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });
    document.querySelectorAll('.test_button21').forEach(function (test_button21) {
        test_button21.addEventListener('click', function () {
            uploadvideo_menu.classList.toggle('active');
            uploadvideo_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });
    document.querySelectorAll('.test_button22').forEach(function (test_button22) {
        test_button22.addEventListener('click', function () {
            font_menu.classList.toggle('active');
            font_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });
    document.querySelectorAll('.test_button23').forEach(function (test_button23) {
        test_button23.addEventListener('click', function () {
            file_setting_menu.classList.toggle('active');
            file_setting_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });
    document.querySelectorAll('.test_button24').forEach(function (test_button24) {
        test_button24.addEventListener('click', function () {
            debug_menu.classList.toggle('active');
            debug_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });
    document.querySelectorAll('.test_button25').forEach(function (test_button25) {
        test_button25.addEventListener('click', function () {
            file_download_menu.classList.toggle('active');
            file_download_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });
    document.querySelectorAll('.test_button26').forEach(function (test_button26) {
        test_button26.addEventListener('click', function () {
            display_menu.classList.toggle('active');
            display_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });
    document.querySelectorAll('.test_button27').forEach(function (test_button27) {
        test_button27.addEventListener('click', function () {
            stopwatch_menu.classList.toggle('active');
            stopwatch_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy();
            timerreset()
        });
    });
    document.querySelectorAll('.test_button28').forEach(function (test_button28) {
        test_button28.addEventListener('click', function () {
            comment_menu.classList.toggle('active');
            comment_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });
    document.querySelectorAll('.test_button30').forEach(function (test_button30) {
        test_button30.addEventListener('click', function () {
            objective_menu.classList.toggle('active');
            objective_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });
    document.querySelectorAll('.test_button31').forEach(function (test_button31) {
        test_button31.addEventListener('click', function () {
            calendar_menu.classList.toggle('active');
            calendar_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });

    document.querySelectorAll('.test_button32').forEach(function (test_button32) {
        test_button32.addEventListener('click', function () {
            cpu_calc_menu.classList.toggle('active');
            cpu_calc_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
            cpucalc_open();
        });
    });

    document.querySelectorAll('.test_button33').forEach(function (test_button33) {
        test_button33.addEventListener('click', function () {
            browser_menu.classList.toggle('active');
            browser_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });

    document.querySelectorAll('.test_button35').forEach(function (test_button35) {
        test_button35.addEventListener('click', function () {
            taskbar_setting_menu.classList.toggle('active');
            taskbar_setting_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });

    document.querySelectorAll('.test_button36').forEach(function (test_button36) {
        test_button36.addEventListener('click', function () {
            youtubevideo_menu.classList.toggle('active');
            youtubevideo_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });

    document.querySelectorAll('.test_button37').forEach(function (test_button37) {
        test_button37.addEventListener('click', function () {
            device_menu.classList.toggle('active');
            device_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });

    document.querySelectorAll('.test_button38').forEach(function (test_button38) {
        test_button38.addEventListener('click', function () {
            omikuji_menu.classList.toggle('active');
            omikuji_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });

    document.querySelectorAll('.test_button39').forEach(function (test_button39) {
        test_button39.addEventListener('click', function () {
            localstorage_monitor_menu.classList.toggle('active');
            localstorage_monitor_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });

    document.querySelectorAll('.test_button40').forEach(function (test_button40) {
        test_button40.addEventListener('click', function () {
            paint_menu.classList.toggle('active');
            paint_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });

    document.querySelectorAll('.test_button42').forEach(function (test_button42) {
        test_button42.addEventListener('click', function () {
            nexser_files_menu.classList.toggle('active');
            nexser_files_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy();
            setTimeout(() => {
                nexser_files_windowload()
            }, 100);
        });
    });


    function cpucalc_open() {
        const cpumenu1 = document.querySelector('.cpumenu_1');
        document.getElementsByClassName('cpu_calc_menu')[0].style.zIndex = largestZIndex++;
        document.getElementsByClassName('focus2')[0].blur()

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
        }, 100);
    }

    // games

    document.querySelectorAll('.test_button29').forEach(function (test_button29) {
        test_button29.addEventListener('click', function () {
            tetris_mneu.classList.toggle('active');
            tetris_mneu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });

    document.querySelectorAll('.test_button34').forEach(function (test_button29) {
        test_button29.addEventListener('click', function () {
            bom_menu.classList.toggle('active');
            bom_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });

    document.querySelectorAll('.test_button41').forEach(function (test_button41) {
        test_button41.addEventListener('click', function () {
            othello_menu.classList.toggle('active');
            othello_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy()
        });
    });


    // 最前面のz-indexを持つ要素に新しいクラス名を付与する関数
    function assignClassToFrontmostElement(className, newClassName) {
        // 同じクラス名を持つすべての要素を取得
        const elements = document.querySelectorAll('.' + className);
        // 最前面のz-indexを格納する変数
        let highestZIndex = -Infinity;
        let frontmostElement = null;

        // 各要素に対してループ処理
        elements.forEach(function (element) {
            const ele2 = element.closest('.child_windows')
            // 現在の要素のz-indexを取得
            const zIndex = parseInt(window.getComputedStyle(element).zIndex, 10) || 0;
            // 最前面の要素を更新
            if (zIndex > highestZIndex) {
                highestZIndex = zIndex;
                frontmostElement = ele2;
            }
        });

        // 最前面の要素が見つかった場合、新しいクラス名を付与
        if (frontmostElement) {
            const foo1 = frontmostElement.firstElementChild;
            foo1.classList.add(newClassName);
        }

        // 最前面の要素とそのz-indexを返す
        return {
            element: frontmostElement,
            zIndex: highestZIndex
        };
    }

    function zindexwindow_addnavy() {
        alltitle_navyreomve()
        assignClassToFrontmostElement('child_windows:not(.active)', 'navy');
        titlecolor_set()
    }

    document.querySelector('.time').addEventListener('click', function () {
        taskbtn_load()
    })

    const note_parent = document.querySelector('.note_pad');
    const note_child = document.getElementById('note_text');

    const resizeTextarea = () => {
        note_child.style.width = `${note_parent.clientWidth + - + 5}px`;
        note_child.style.height = `${note_parent.clientHeight + - + 100}px`;
    };

    note_parent.addEventListener('mousemove', resizeTextarea);

    document.querySelectorAll('.drag_button').forEach(function (drag) {
        drag.addEventListener('mousedown', function () {
            const dragwindow = drag.closest('.child_windows');
            if (dragwindow.classList.contains('leftwindow')) {
                dragwindow.style.height = "55%";
                dragwindow.style.width = "55%";
                dragwindow.classList.remove('leftwindow');

                dragwindow.style.transition = "0.15s cubic-bezier(0, 0, 1, 1)";
                setTimeout(() => {
                    dragwindow.style.transition = ""
                }, 150);
            }
            if (dragwindow.classList.contains('rightwindow')) {
                dragwindow.style.height = "55%";
                dragwindow.style.width = "55%";
                dragwindow.classList.remove('rightwindow');

                dragwindow.style.transition = "0.15s cubic-bezier(0, 0, 1, 1)";
                setTimeout(() => {
                    dragwindow.style.transition = ""
                }, 150);
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
            const elements = document.querySelectorAll('.rectangle');
            // 各要素からクラスを削除
            elements.forEach(element => {
                element.classList.remove('rectangle');
            });

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
                document.querySelectorAll('.child_windows').forEach(function (title) {
                    title.style.opacity = "0.5";
                })
            }
            // 移動してる時だけ黒枠のみ
            if (localStorage.getItem('window_borderblack')) {
                document.querySelectorAll('.child_windows, .child').forEach(function (title) {
                    document.querySelector('iframe').style.opacity = "0";
                    title.style.background = "rgba(255, 255, 255, 0)";
                    title.style.border = "solid 2px black";
                })
                document.querySelectorAll('.title,.title2,.title_buttons,.window_tool,.window_contents,.window_content,.window_bottom,.prompt_content').forEach(function (title) {
                    title.style.opacity = "0"
                })
            }
        }
        //マウスボタンが上がったら発火
        function mup(e) {

            document.querySelectorAll('.drag').forEach(function (drag_windows) {
                drag_windows.classList.remove("drag");
            })

            document.body.removeEventListener("mousemove", mmove, false);
            drag.removeEventListener("mouseup", mup, false);
            document.body.removeEventListener("touchmove", { passive: false }, mmove, false);
            drag.removeEventListener("touchend", { passive: false }, mup, false);

            document.querySelectorAll('.title').forEach(function (title) {
                document.querySelector('.navy').style.background = ""
                window_prompt.style.background = "black"
                window_back_silver()
            })
            // 半透明
            document.querySelectorAll('.child_windows').forEach(function (title) {
                title.style.opacity = "";
                window_prompt.style.background = "black"
                window_back_silver()
            })
            // 移動してる時だけ黒枠のみ
            document.querySelectorAll('.child_windows, .child').forEach(function (title) {
                title.style.background = "";
                title.style.border = "";
                document.querySelector('iframe').style.opacity = "";
                window_prompt.style.background = "black"
                window_back_silver()
            })
            document.querySelectorAll('.title,.title2,.title_buttons,.window_tool,.window_contents,.window_content,.window_bottom,.prompt_content').forEach(function (title) {
                title.style.opacity = ""
                window_back_silver()
            })
            titlecolor_set()
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
        )
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
            const elements = document.querySelectorAll('.rectangle');
            // 各要素からクラスを削除
            elements.forEach(element => {
                element.classList.remove('rectangle');
            });
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

            const task = document.getElementById('taskbar').clientHeight;
            if (check(elm1, elm2) && localStorage.getItem('taskbar_position_button')) {
                toolbar.style.top = task + "px";
            } else if (check(elm1, elm2)) {
                toolbar.style.top = "";
                toolbar.style.bottom = task + "px";
            }

        }
    })

    document.querySelector('.toolbar_on').addEventListener('click', function (toolbar_on) {
        localStorage.setItem('toolbar_on', toolbar_on);
        toolbar.style.display = "block"
    })
    document.querySelector('.toolbar_off').addEventListener('click', function () {
        localStorage.removeItem('toolbar_on');
        toolbar.style.display = "none"
    })

    document.querySelector('.filettext_backcolor_off').addEventListener('click', function (filettext_backcolor_off) {
        localStorage.setItem('filettext_backcolor_off', filettext_backcolor_off);
        filettext_backcolor()
    })
    document.querySelector('.filettext_backcolor_on').addEventListener('click', function () {
        localStorage.removeItem('filettext_backcolor_off');
        filettext_backcolor()
    })

    document.querySelector('.saver_on').addEventListener('click', function (saver_on) {
        localStorage.setItem('saver_on', saver_on);
        document.querySelector('.saver_mode').textContent = "ON"
    })
    document.querySelector('.saver_off').addEventListener('click', function () {
        localStorage.removeItem('saver_on');
        document.querySelector('.saver_mode').textContent = "OFF"
    })


    document.querySelector('.display_old').addEventListener('click', function (display_old) {
        localStorage.setItem('display_old', display_old);
        old_screen();
    })
    document.querySelector('.display_now').addEventListener('click', function () {
        localStorage.removeItem('display_old');
        old_screen_reset();
    })

    document.querySelector('.list_shadow_on').addEventListener('click', function (list_shadow_on) {
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
        } else {
            document.querySelector('.window_error_text').textContent = "driver color no install!"
            error_windows.classList.remove('active')
            prompt_text2.style.color = "";
            document.querySelector('.test_allwindow').style.display = "block";
            sound3()
        }
    }

    /*
     * 文字色と背景色を変更する
     */
    function setColor() {
        setTimeout(() => {
            if (localStorage.getItem('driver_color')) {
                document.querySelector("body").style.color = color;
                document.getElementById("nexser").style.backgroundColor = bkcolor;
                document.getElementsByClassName("mini_desktop")[0].style.backgroundColor = bkcolor;
                if (bkcolor == "white" || bkcolor == "whitesmoke") {
                    background_text.style.color = "black"
                    document.getElementById('background_text2').style.color = "black"
                    Array.from(document.getElementsByClassName('desktop_files')).forEach((desktop_files) => {
                        const deskfile_text = desktop_files.firstElementChild;
                        deskfile_text.style.color = "black"
                    })
                } else {
                    background_text.style.color = ""
                    document.getElementById('background_text2').style.color = ""
                    Array.from(document.getElementsByClassName('desktop_files')).forEach((desktop_files) => {
                        const deskfile_text = desktop_files.firstElementChild;
                        deskfile_text.style.color = ""
                    })
                }
            }
        }, 0);
    }

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
            document.querySelector('.test_allwindow').style.display = "block";
            sound3()
        }
    });

    document.querySelectorAll('.color_btn').forEach(function (color_btn) {
        color_btn.addEventListener('click', function () {
            titlecolor_remove();
            if (localStorage.getItem('driver_color')) {
                titlecolor_set();
            } else {
                document.querySelector('.window_error_text').textContent = "driver color no install!"
                error_windows.classList.remove('active')
                document.querySelector('.test_allwindow').style.display = "block";
                sound3()
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
        localStorage.removeItem('titlebar_teal');
    }

    document.querySelector('.titlebar_red').addEventListener('click', function (titlebar_red) {
        localStorage.setItem('titlebar_red', titlebar_red);
    })
    document.querySelector('.titlebar_blue').addEventListener('click', function (titlebar_blue) {
        localStorage.setItem('titlebar_blue', titlebar_blue);
    })
    document.querySelector('.titlebar_green').addEventListener('click', function (titlebar_green) {
        localStorage.setItem('titlebar_green', titlebar_green);
    })
    document.querySelector('.titlebar_yellow').addEventListener('click', function (titlebar_yellow) {
        localStorage.setItem('titlebar_yellow', titlebar_yellow);
    })
    document.querySelector('.titlebar_orange').addEventListener('click', function (titlebar_orange) {
        localStorage.setItem('titlebar_orange', titlebar_orange);
    })
    document.querySelector('.titlebar_pink').addEventListener('click', function (titlebar_pink) {
        localStorage.setItem('titlebar_pink', titlebar_pink);
    })
    document.querySelector('.titlebar_purple').addEventListener('click', function (titlebar_purple) {
        localStorage.setItem('titlebar_purple', titlebar_purple);
    })
    document.querySelector('.titlebar_black').addEventListener('click', function (titlebar_black) {
        localStorage.setItem('titlebar_black', titlebar_black);
    })
    document.querySelector('.titlebar_teal').addEventListener('click', function (titlebar_teal) {
        localStorage.setItem('titlebar_teal', titlebar_teal);
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
            if (localStorage.getItem('titlebar_teal')) {
                document.querySelectorAll('.title').forEach(function (title) {
                    title.style.background = "#483D8B";
                });
                document.querySelectorAll('.navy').forEach(function (navy) {
                    navy.style.background = "teal";
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
        document.querySelector('.backgrounds9').style.display = "none";
        localStorage.removeItem('back_pattern_1');
        localStorage.removeItem('back_pattern_2');
        localStorage.removeItem('back_pattern_3');
        localStorage.removeItem('back_pattern_4');
        localStorage.removeItem('back_pattern_5');
        localStorage.removeItem('back_pattern_6');
        localStorage.removeItem('back_pattern_7');
        localStorage.removeItem('back_pattern_8');
        localStorage.removeItem('back_pattern_9');
    }

    document.querySelector('.back_pattern_1').addEventListener('click', function (back_pattern_1) {
        localStorage.setItem('back_pattern_1', back_pattern_1);
        back_pattern_set()
    })
    document.querySelector('.back_pattern_2').addEventListener('click', function (back_pattern_2) {
        localStorage.setItem('back_pattern_2', back_pattern_2);
        back_pattern_set()
    })
    document.querySelector('.back_pattern_3').addEventListener('click', function (back_pattern_3) {
        localStorage.setItem('back_pattern_3', back_pattern_3);
        back_pattern_set()
    })
    document.querySelector('.back_pattern_4').addEventListener('click', function (back_pattern_4) {
        localStorage.setItem('back_pattern_4', back_pattern_4);
        back_pattern_set()
    })
    document.querySelector('.back_pattern_5').addEventListener('click', function (back_pattern_5) {
        localStorage.setItem('back_pattern_5', back_pattern_5);
        back_pattern_set()
    })
    document.querySelector('.back_pattern_6').addEventListener('click', function (back_pattern_6) {
        localStorage.setItem('back_pattern_6', back_pattern_6);
        back_pattern_set()
    })
    document.querySelector('.back_pattern_7').addEventListener('click', function (back_pattern_7) {
        localStorage.setItem('back_pattern_7', back_pattern_7);
        back_pattern_set()
    })
    document.querySelector('.back_pattern_8').addEventListener('click', function (back_pattern_8) {
        localStorage.setItem('back_pattern_8', back_pattern_8);
        back_pattern_set()
    })
    document.querySelector('.back_pattern_9').addEventListener('click', function (back_pattern_9) {
        localStorage.setItem('back_pattern_9', back_pattern_9);
        back_pattern_set()
    })

    function back_pattern_set() {
        if (localStorage.getItem('back_pattern_1')) {
            document.getElementsByClassName('backgrounds1')[0].style.display = "block";
        }
        if (localStorage.getItem('back_pattern_2')) {
            document.getElementsByClassName('backgrounds2')[0].style.display = "block";
        }
        if (localStorage.getItem('back_pattern_3')) {
            document.getElementsByClassName('backgrounds3')[0].style.display = "block";
        }
        if (localStorage.getItem('back_pattern_4')) {
            document.getElementsByClassName('backgrounds4')[0].style.display = "block";
        }
        if (localStorage.getItem('back_pattern_5')) {
            document.getElementsByClassName('backgrounds5')[0].style.display = "block";
        }
        if (localStorage.getItem('back_pattern_6')) {
            document.getElementsByClassName('backgrounds6')[0].style.display = "block";
        }
        if (localStorage.getItem('back_pattern_7')) {
            document.getElementsByClassName('backgrounds7')[0].style.display = "block";
        }
        if (localStorage.getItem('back_pattern_8')) {
            document.getElementsByClassName('backgrounds8')[0].style.display = "block";
        }
        if (localStorage.getItem('back_pattern_9')) {
            document.getElementsByClassName('backgrounds9')[0].style.display = "block";
        }
    }


    var largestZIndex = 0;
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
        document.querySelector('.mouse_right').classList.add('active');
        setTimeout(() => {
            document.querySelector('.mouse_right').classList.remove('active');
        }, 250);
    });

    // 左クリックイベントの登録
    document.getElementById("button1").addEventListener("click", function () {
        document.querySelector('.mouse_left').classList.add('active');
        setTimeout(() => {
            document.querySelector('.mouse_left').classList.remove('active');
        }, 250);
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

    function notetext_reset() {
        localStorage.removeItem('notetext_small');
        localStorage.removeItem('notetext_medium');
        localStorage.removeItem('notetext_large');
    }

    function notetextsize_change() {
        let noteData = document.getElementsByClassName('note_area')
        if (localStorage.getItem('notetext_small')) {
            noteData[0].style.fontSize = "small";
        }
        if (localStorage.getItem('notetext_medium')) {
            noteData[0].style.fontSize = "medium";
        }
        if (localStorage.getItem('notetext_large')) {
            noteData[0].style.fontSize = "large";
        }
    }

    function notetext_small(notetext_small) {
        notetext_reset();
        localStorage.setItem('notetext_small', notetext_small);
        notetextsize_change()
    }
    function notetext_medium(notetext_medium) {
        notetext_reset();
        localStorage.setItem('notetext_medium', notetext_medium);
        notetextsize_change()
    }
    function notetext_large(notetext_large) {
        notetext_reset();
        localStorage.setItem('notetext_large', notetext_large);
        notetextsize_change()
    }

    // 保存
    function save() {
        if (note_form.note_area.value === "") {
            document.querySelector('.window_error_text').textContent = "text none not save!"
            error_windows.classList.remove('active')
            document.querySelector('.test_allwindow').style.display = "block";
            sound3()
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
            document.querySelector('.test_allwindow').style.display = "block";
            sound3()
        } else if (objective_form.objective_area.value === "") {
            document.querySelector('.window_error_text').textContent = "内容が入力されていません!"
            error_windows.classList.remove('active')
            document.querySelector('.test_allwindow').style.display = "block";
            sound3()
        }
        if (!objective_title_form.objective_title_area.value == "" || !objective_form.objective_area.value == "") {
            let objectiveTitleData = document.objective_title_form.objective_title_area.value;
            localStorage.setItem('objectiveTitleData', objectiveTitleData);
            let objectiveData = document.objective_form.objective_area.value;
            localStorage.setItem('objectiveData', objectiveData);
            localStorage.removeItem('objective_area');
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
            if (!objective_menu.classList.contains('active') && localStorage.getItem('objectiveData') && localStorage.getItem('objectiveTitleData') && (!localStorage.getItem('objective_area'))) {
                objective_menu.classList.add('active');
                localStorage.removeItem('objective_area');
                taskbtn_load();
            } else if (localStorage.getItem('objective_area')) {
                document.querySelector('.warning_title_text').textContent = "objective sheet"
                document.querySelector('.window_warning_text').textContent = "タイトル と 内容を保存してから閉じてください";
                warning_windows.style.display = "block"
                document.querySelector('.close_button3').style.display = "block"
                sound5()
                document.querySelector('.test_allwindow').style.display = "block";
                document.querySelector('.shutdown_button').style.display = "none";
                document.querySelector('.warningclose_button').style.display = "none";
            } else {
                objective_menu.classList.add('active');
                localStorage.removeItem('objective_area');
                taskbtn_load();
            }
        }, 100);
    })
    localStorage.removeItem('objective_area')

    document.querySelectorAll('.objective_title_area,.objective_area').forEach(function (objectives_area) {
        objectives_area.addEventListener('keyup', function () {
            console.log("objective_area")
            localStorage.setItem('objective_area', objective_menu);
        });
    });

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
            zindexwindow_addnavy()
        }, 100);
    }

    function error_windows_close() {
        setTimeout(() => {
            document.querySelector('.test_allwindow').style.display = "none";
            error_windows.classList.add('active');
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

    function notearea_allselect() {
        document.querySelector('.note_area').select();
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
        localStorage.removeItem('objective_area');
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
        resizeTextarea()
    }

    function onChange() {
        resizeTextarea()
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
            notice_menu.style.display = "block"

            setTimeout(() => {
                notice_menu.style.display = "none"
            }, 5000);
        } else {
            document.querySelector('.window_error_text').textContent = "windows2000 textdata no!"
            error_windows.classList.remove('active')
            document.querySelector('.test_allwindow').style.display = "block";
            sound3();
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
            document.querySelector('.test_allwindow').style.display = "block";
            sound3();
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
        calc_result.value = Math.round(calc_result.value);
        calc();
    }

    function calc_clear() {
        const child_graph = document.querySelector(".child_graph");
        child_graph.style.height = "0%"
        child_graph.style.background = "";
        calc_result.value = "";
    }

    function calc_oneremove() {
        const ca1 = calc_result.value;
        const result = ca1.slice(0, -1);
        calc_result.value = result;
        calc_result.value = new Function("return " + calc_result.value)();
        calc_result.value = Math.round(calc_result.value);
        calc();
    }

    function window_file_list_change() {
        Array.from(document.getElementsByClassName('window_inline_list')).forEach((window_inline_list) => {
            window_inline_list.style.columnCount = "1";
            window_inline_list.style.display = "block";
        });
        document.querySelectorAll('.window_file_icon, .window_file_icon2').forEach(function (window_file_icon) {
            window_file_icon.style.width = "28px";
            window_file_icon.style.height = "18px";
            window_file_icon.style.marginBottom = "-20px";
        });
        Array.from(document.getElementsByClassName('window_files')).forEach((window_files) => {
            window_files.style.margin = "0px";
            window_files.style.paddingTop = "10px";
            window_files.style.width = "100%";
            let sss = window_files.firstElementChild;
            sss.style.paddingLeft = "50px";
            sss.style.width = "auto";
        });

        Array.from(document.getElementsByClassName('windowfile_time')).forEach((windowfile_time) => {
            windowfile_time.style.display = "block"
        })
    }

    function window_file_list_change2() {
        Array.from(document.getElementsByClassName('window_inline_list')).forEach((window_inline_list) => {
            window_inline_list.style.columnCount = "2";
            window_inline_list.style.display = "block";
        });
        document.querySelectorAll('.window_file_icon, .window_file_icon2').forEach(function (window_file_icon) {
            window_file_icon.style.width = "28px";
            window_file_icon.style.height = "18px";
            window_file_icon.style.marginBottom = "-20px";
        });
        Array.from(document.getElementsByClassName('window_files')).forEach((window_files) => {
            window_files.style.margin = "0px";
            window_files.style.paddingTop = "10px";
            window_files.style.width = "100%";
            let sss = window_files.firstElementChild;
            var sss2 = sss.style.paddingLeft = "50px";
            var sss2 = sss.style.width = "auto";
        });

        Array.from(document.getElementsByClassName('windowfile_time')).forEach((windowfile_time) => {
            windowfile_time.style.display = "block"
        })
    }

    function window_file_list_reset() {
        Array.from(document.getElementsByClassName('window_inline_list')).forEach((window_inline_list) => {
            window_inline_list.style.columnCount = "";
            window_inline_list.style.display = "flex";
        });
        document.querySelectorAll('.window_file_icon, .window_file_icon2').forEach(function (window_file_icon) {
            window_file_icon.style.width = "";
            window_file_icon.style.height = "";
            window_file_icon.style.marginBottom = "";
        });
        Array.from(document.getElementsByClassName('window_files')).forEach((window_files) => {
            window_files.style.margin = "";
            window_files.style.paddingTop = "";
            window_files.style.width = "";
            let sss = window_files.firstElementChild;
            sss2 = sss.style.paddingLeft = "";
            sss2 = sss.style.width = "";
        });

        Array.from(document.getElementsByClassName('windowfile_time')).forEach((windowfile_time) => {
            windowfile_time.style.display = "none"
        })
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

    Array.from(document.getElementsByClassName('windowfile1')).forEach((windowfile_1) => {
        windowfile_1.addEventListener('click', function () {
            localStorage.setItem('windowfile_1', windowfile_1);
            localStorage.removeItem('windowfile_2')
            localStorage.removeItem('windowfile_3')
            window_file_list_change()
        })
    })
    Array.from(document.getElementsByClassName('windowfile2')).forEach((windowfile_2) => {
        windowfile_2.addEventListener('click', function () {
            localStorage.setItem('windowfile_2', windowfile_2);
            localStorage.removeItem('windowfile_1')
            localStorage.removeItem('windowfile_3')
            window_file_list_reset()
        })
    })
    Array.from(document.getElementsByClassName('windowfile3')).forEach((windowfile_3) => {
        windowfile_3.addEventListener('click', function () {
            localStorage.setItem('windowfile_3', windowfile_3);
            localStorage.removeItem('windowfile_1')
            localStorage.removeItem('windowfile_2')
            window_file_list_change2()
        })
    })

    document.querySelector('.clock_button').addEventListener('click', function (clock_button) {
        if (localStorage.getItem('clock_button')) {
            localStorage.removeItem('clock_button')
            document.querySelector('.clock_button').textContent = "off"
            document.querySelector('.time').style.display = "block"
        } else {
            localStorage.setItem('clock_button', clock_button);
            document.querySelector('.clock_button').textContent = "on"
            document.querySelector('.time').style.display = "none";
        }
    })

    document.querySelector('.taskbar_zindex_0').addEventListener('click', function (taskbar_zindex_0) {
        if (localStorage.getItem('taskbar_zindex_0')) {
            localStorage.removeItem('taskbar_zindex_0')
            taskbar.style.zIndex = "";
            document.querySelector('.taskbar_zindex_0').textContent = "off"
        } else {
            localStorage.setItem('taskbar_zindex_0', taskbar_zindex_0);
            taskbar.style.zIndex = "0";
            document.querySelector('.taskbar_zindex_0').textContent = "on"
        }
    })

    document.querySelector('.files_inline, .child').addEventListener('mousedown', function () {
        getLargestZIndex('.child_windows');
        z_index.textContent = getLargestZIndex('.child_windows');
    })

    document.querySelector('.taskbar_position_button').addEventListener('click', function () {
        const t = localStorage.getItem('taskbar_height');
        if (localStorage.getItem('taskbar_position_button')) {
            const t = localStorage.getItem('taskbar_height');
            localStorage.removeItem('taskbar_position_button')

            document.querySelector('.taskbar_position_button').textContent = "top"
            document.getElementById('taskbar').style.top = ""
            document.querySelector('.child_start_menu').style.top = "auto"
            document.querySelector('.child_start_menu').style.bottom = "";

            const task = document.getElementById('taskbar').clientHeight;

            document.querySelector('.child_start_menu').style.bottom = task + "px"
            document.querySelector('.child_start_menu').style.bottom = t + "px"

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

            if (check(elm1, elm2) && localStorage.getItem('taskbar_position_button')) {
                toolbar.style.top = "40px";
                toolbar.style.top = t + "px";

            } else if (check(elm1, elm2)) {
                toolbar.style.top = "";
                toolbar.style.bottom = t + "px";
            }

        } else {
            const taskbar_position_button = document.querySelector('.taskbar_position_button');
            localStorage.setItem('taskbar_position_button', taskbar_position_button);

            document.querySelector('.taskbar_position_button').textContent = "bottom"
            document.getElementById('taskbar').style.top = "0px"
            document.querySelector('.child_start_menu').style.top = "40px"
            document.querySelector('.child_start_menu').style.bottom = "auto"

            const task = document.getElementById('taskbar').clientHeight;

            document.querySelector('.child_start_menu').style.top = task + "px"
            document.querySelector('.child_start_menu').style.top = t + "px"

            document.querySelector('.battery_menu').style.top = "35px"
            document.querySelector('.battery_menu').style.bottom = "auto"

            if (localStorage.getItem('taskbar_position_button') && localStorage.getItem('data_taskbar_none')) {
                document.querySelector('.files_inline').style.top = "auto"
                document.querySelector('.files_inline').style.bottom = ""
            } else if (localStorage.getItem('taskbar_position_button') && !localStorage.getItem('data_taskbar_none')) {
                document.querySelector('.files_inline').style.top = "40px"
                document.querySelector('.files_inline').style.bottom = "auto"

                document.querySelector('.files_inline').style.top = t + "px"
            } else {
                document.querySelector('.files_inline').style.top = "auto"
                document.querySelector('.files_inline').style.bottom = ""
            }

            if (localStorage.getItem('data_taskbar_none')) {
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
                document.querySelectorAll('.big').forEach(function (child_win_posi) {
                    child_win_posi.style.transition = "";
                    child_win_posi.style.top = "40px";

                    child_win_posi.style.top = t + "px";
                })
                document.querySelectorAll('.leftwindow').forEach(function (child_win_posi2) {
                    child_win_posi2.style.transition = "";
                    child_win_posi2.style.top = "40px";

                    child_win_posi2.style.top = t + "px";
                })
                document.querySelectorAll('.rightwindow').forEach(function (child_win_posi3) {
                    child_win_posi3.style.transition = "";
                    child_win_posi3.style.top = "40px";

                    child_win_posi3.style.top = t + "px";
                })
            }

            if (check(elm1, elm2) && localStorage.getItem('taskbar_position_button')) {
                toolbar.style.top = "40px";
                toolbar.style.top = t + "px";
            } else if (check(elm1, elm2)) {
                toolbar.style.top = "";
                toolbar.style.bottom = t + "px";
            }

        }
    })

    Array.from(document.getElementsByClassName('window_files')).forEach((window_files) => {
        window_files.addEventListener('mousedown', function () {
            fileborder_reset()
        })
        window_files.addEventListener('click', function () {
            fileborder_reset()
            window_files.classList.add('file_border');
        })
    })

    function fileborder_reset() {
        Array.from(document.getElementsByClassName('window_files')).forEach((window_files) => {
            window_files.classList.remove('file_border');
        })
        Array.from(document.getElementsByClassName('desktop_files')).forEach((df1) => {
            const file10 = df1.firstElementChild;
            file10.classList.remove('file_select');
        })
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
            htmlviewer_run_menu.style.zIndex = largestZIndex++;
            zindexwindow_addnavy();
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

    function testcode_clear() {
        localStorage.removeItem('editor');
        editor.value = '';
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
            }, 500);
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
                }, 500);
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
                }, 500);
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
                }, 500);
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

    function savertime() {
        const stime = document.getElementsByClassName('saver_second')[0].value;

        if (60 <= stime && stime < 901) {
            localStorage.removeItem('saver_time')
            localStorage.setItem('saver_time', stime)
            document.getElementsByClassName('saver_on')[0].classList.remove('pointer_none')
            saver_setTimer();
            setEvents(resetTimer);
            document.getElementsByClassName('screensaver_text')[0].textContent = stime;
        } else {
            document.querySelector('.window_error_text').textContent = "指定時間の範囲内ではありません!"
            error_windows.classList.remove('active')
            document.querySelector('.test_allwindow').style.display = "block";
            sound3();
        }
    }

    let sec = localStorage.getItem('saver_time');
    const events = ['keydown', 'mousemove', 'mousedown'];
    let timeoutId;
    let testtime2;
    let len = events.length;
    screen_saver_group.style.display = "none"

    saver_setTimer();
    setEvents(resetTimer);

    function sever2() {
        testtime2 = setTimeout(() => {
            sec = localStorage.getItem('saver_time');
            if (localStorage.getItem('saver_on')) {
                document.querySelector('.saver_time').textContent = len++;
            }
            sever2()
        }, 1000);
        if (!localStorage.getItem('saver_on')) {
            document.querySelector('.saver_time').textContent = "none";
        }
    }

    // タイマー設定
    function saver_setTimer() {
        sec = localStorage.getItem('saver_time');
        timeoutId = setTimeout(screen_saver, sec * 1000);
    }
    function resetTimer() {
        sec = localStorage.getItem('saver_time');
        clearTimeout(timeoutId);
        clearTimeout(testtime2);
        sever2()
        saver_setTimer();
        document.querySelector('.saver_time').textContent = len = 0;
        if (localStorage.getItem('saver_on')) {
            document.querySelector('.saver_time').textContent = len++;
        }
        if (screen_saver_group.style.display == "block") {
            document.getElementById('nex').style.cursor = '';
            screen_saver_group.style.display = "none";
            document.querySelector('.screen_saver1').style.display = "none"
            document.querySelector('.screen_saver2').style.display = "none"
            document.querySelector('.screen_saver3').style.display = "none"
        }
    }

    // イベント設定
    function setEvents(func) {
        while (len--) {
            addEventListener(events[len], func, false);
        }
    }

    function saver_clear() {
        localStorage.removeItem('saver1')
        localStorage.removeItem('saver2')
        localStorage.removeItem('saver3')
    }

    function saver1(saver1) {
        saver_clear();
        localStorage.setItem('saver1', saver1);
        document.getElementsByClassName('screen_mode')[0].textContent = "1";
    }
    function saver2(saver2) {
        saver_clear();
        localStorage.setItem('saver2', saver2);
        document.getElementsByClassName('screen_mode')[0].textContent = "2";
    }
    function saver3(saver3) {
        saver_clear();
        localStorage.setItem('saver3', saver3);
        document.getElementsByClassName('screen_mode')[0].textContent = "3";
    }
    // ログアウト
    function screen_saver() {
        if (screen_saver_group.style.display == "none" && desktop.style.display == "block" && localStorage.getItem('saver_on') && localStorage.getItem('saver_time')) {
            screen_saver_group.style.display = "block";
            if (localStorage.getItem('saver1') && localStorage.getItem('saver_time')) {
                document.querySelector('.screen_saver1').style.display = "block";
            } else if (localStorage.getItem('saver2') && localStorage.getItem('saver_time')) {
                document.querySelector('.screen_saver2').style.display = "block";
            } else if (localStorage.getItem('saver3') && localStorage.getItem('saver_time')) {
                document.querySelector('.screen_saver3').style.display = "block";
            } else if (localStorage.getItem('saver_time')) {
                document.querySelector('.screen_saver1').style.display = "block";
            }
            document.getElementById('nex').style.cursor = 'none';
        }
        setTimeout(() => {
            clearTimeout(timeoutId);
            clearTimeout(testtime2);
        }, 1000);
    }

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
        startButton.classList.add('pointer_none')
        stopButton.classList.remove('pointer_none')
        resetButton.classList.add('pointer_none')
        startTime = Date.now();
        displayTime();
    });

    // ストップボタンがクリックされたら時間を止める
    stopButton.addEventListener('click', function () {
        stopButton.classList.add('pointer_none')
        timerstop()
    });

    // リセットボタンがクリックされたら時間を0に戻す
    resetButton.addEventListener('click', function () {
        resetButton.classList.add('pointer_none')
        timerreset()
    });

    function timerstop() {
        startButton.classList.remove('pointer_none')
        stopButton.classList.add('pointer_none')
        resetButton.classList.remove('pointer_none')
        clearTimeout(timeoutID);
        stopTime += (Date.now() - startTime);
    }
    function timerreset() {
        startButton.classList.remove('pointer_none')
        stopButton.classList.add('pointer_none')
        resetButton.classList.add('pointer_none')
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
    var val;
    // 一定間隔で処理を行うintervalのIDを保持
    var intervalID;

    function func1() {
        document.getElementById("myProgress").style.display = "block"
        val = 0;
        document.getElementById("myProgress").value = val;
        intervalID = setInterval("updateProgress()", 0);
    }

    function updateProgress() {
        val += 1;
        document.getElementById("myProgress").value = val;
        document.getElementById("myProgress").innerText = val + "%";
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
        intervalID = setInterval("updateProgress2()", 0);
    }

    function updateProgress2() {
        val += 20;
        document.getElementById("myProgress").value = val;
        document.getElementById("myProgress").innerText = val + "%";
        if (val == 100) {
            clearInterval(intervalID);
            setTimeout(() => {
                document.getElementById("myProgress").style.display = "none";
                val = 0;
            }, 1000);
        }
    }

    function old_screen() {
        document.getElementById('nex').classList.add('old');
    }
    function old_screen_reset() {
        document.getElementById('nex').classList.remove('old');
    }

    function backcolorfilter_clear() {
        localStorage.removeItem("backcolor_blackwhite");
        localStorage.removeItem("backcolor_invert");
        localStorage.removeItem("backcolor_hue");
        document.getElementById('nex').style.filter = "";
    }

    function color_bw(backcolor_blackwhite) {
        backcolorfilter_clear()
        document.getElementById('nex').style.filter = "grayscale(100%)";
        localStorage.setItem("backcolor_blackwhite", backcolor_blackwhite);
    }

    function color_invert(backcolor_invert) {
        backcolorfilter_clear()
        document.getElementById('nex').style.filter = "invert(100%)";
        localStorage.setItem("backcolor_invert", backcolor_invert);
    }

    function color_hue(backcolor_hue) {
        backcolorfilter_clear()
        document.getElementById('nex').style.filter = "hue-rotate(100deg)";
        localStorage.setItem("backcolor_hue", backcolor_hue);
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

    function taskheight_submit() {
        let taskvalue = document.getElementsByClassName('taskbar_height_value')[0].value;
        const task = document.getElementById('taskbar').clientHeight;

        if (taskvalue == "") {
            taskvalue = 40;
            const t = localStorage.setItem('taskbar_height', taskvalue);
            document.getElementById('taskbar').style.height = "40px"
            document.querySelector('.files_inline').style.top = ""

            if (check(elm1, elm2) && !localStorage.getItem('taskbar_position_button')) {
                toolbar.style.bottom = task + "px";
            } else if (check(elm1, elm2)) {
                toolbar.style.bottom = "";
            }

            if (check(elm1, elm2) && localStorage.getItem('taskbar_position_button')) {
                toolbar.style.top = task + "px";
            } else if (check(elm1, elm2)) {
                toolbar.style.top = "";
            }

        } else if (0 <= taskvalue && taskvalue < 40) {
            document.querySelector('.window_error_text').textContent = "タスクバーの設定範囲以下に設定されています!"
            error_windows.classList.remove('active')
            document.querySelector('.test_allwindow').style.display = "block";
            sound3();
        } else if (40 <= taskvalue && taskvalue < 151) {
            const t = localStorage.setItem('taskbar_height', taskvalue);
            taskbar.style.height = taskvalue + "px"
            document.querySelector('.desktop_version_text').style.bottom = "40px";
            document.querySelector('.desktop_version_text').style.bottom = taskvalue + "px";

            if (check(elm1, elm2) && !localStorage.getItem('taskbar_position_button')) {
                toolbar.style.bottom = taskvalue + "px";
            } else if (check(elm1, elm2)) {
                toolbar.style.bottom = "";
            }

            if (check(elm1, elm2) && localStorage.getItem('taskbar_position_button')) {
                setTimeout(() => {
                    toolbar.style.bottom = "";
                    toolbar.style.top = taskvalue + "px";
                }, 10);
            } else if (check(elm1, elm2)) {
                toolbar.style.top = "";
            }

            if (localStorage.getItem('taskbar_position_button')) {
                const t2 = localStorage.getItem('taskbar_height');
                document.querySelector('.files_inline').style.top = t2 + "px"

                const task = document.getElementById('taskbar').clientHeight;

                document.querySelector('.child_start_menu').style.top = task + "px"
                document.querySelector('.child_start_menu').style.top = t + "px"
            } else {
                const task = document.getElementById('taskbar').clientHeight;

                document.querySelector('.child_start_menu').style.bottom = task + "px"
                document.querySelector('.child_start_menu').style.bottom = t + "px"
            }

        } else {
            document.querySelector('.window_error_text').textContent = "タスクバーの設定範囲を超えています!"
            error_windows.classList.remove('active')
            document.querySelector('.test_allwindow').style.display = "block";
            sound3();
        }
    }

    function taskheight_clear() {
        document.getElementsByClassName('taskbar_height_value')[0].value = "";
        localStorage.removeItem('taskbar_height');
        taskbar.style.height = "";
        if (localStorage.getItem('taskbar_position_button')) {
            document.querySelector('.files_inline').style.top = "40px"

            const task = document.getElementById('taskbar').clientHeight;
            document.querySelector('.child_start_menu').style.top = task + "px"
            document.querySelector('.desktop_version_text').style.bottom = "0px";
        } else {
            const task = document.getElementById('taskbar').clientHeight;
            document.querySelector('.child_start_menu').style.bottom = task + "px"
            document.querySelector('.desktop_version_text').style.bottom = "40px";
        }
    }

    document.querySelectorAll('.window_files').forEach(function (window_files) {
        window_files.addEventListener('click', function () {
            const wf = window_files.lastElementChild;
            wf.textContent = new Date().toLocaleString();
        })
    })

    const clock_canvas = document.getElementById("analog_clock");
    const clock_ctx = clock_canvas.getContext('2d');
    let d;
    let year;
    let month;
    let date;
    let day;
    let dayArr = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    let hours;
    let minutes;
    let seconds;
    let dateText;

    function sRotate() {
        clock_ctx.beginPath();
        clock_ctx.moveTo(150, 150);
        clock_ctx.lineTo(150 + 140 * Math.cos(Math.PI / 180 * (270 + seconds * 6)), 150 + 140 * Math.sin(Math.PI / 180 * (270 + seconds * 6)));
        clock_ctx.lineWidth = 1.0;
        clock_ctx.stroke();
    }

    function mRotate() {
        clock_ctx.beginPath();
        clock_ctx.moveTo(150, 150);
        clock_ctx.lineWidth = 3.0;
        clock_ctx.lineTo(150 + 130 * Math.cos(Math.PI / 180 * (270 + 6 * (minutes + seconds / 60))), 150 + 130 * Math.sin(Math.PI / 180 * (270 + 6 * (minutes + seconds / 60))));
        clock_ctx.stroke();
    }

    function hRotate() {
        clock_ctx.beginPath();
        clock_ctx.moveTo(150, 150);
        clock_ctx.lineWidth = 6.0;
        clock_ctx.lineTo(150 + 100 * Math.cos(Math.PI / 180 * (270 + 30 * (hours + minutes / 60))), 150 + 100 * Math.sin(Math.PI / 180 * (270 + 30 * (hours + minutes / 60))));
        clock_ctx.stroke();
    }

    function rotate() {
        sRotate();
        mRotate();
        hRotate();
    }

    function branchAmPm() {
        if (hours >= 0) {
            return "P M";
        } else {
            return "A M";
        }
    }

    function clock_draw() {
        drawBoard();
        drawScale();
        drawText();
        rotate();
    }

    function drawText() {
        dateText = `${year}-${("0" + month).slice(-2)}-${("0" + date).slice(-2)} ${dayArr[day]}`;
        clock_ctx.font = "20px 'ＭＳ ゴシック'";
        clock_ctx.textAlign = "center";
        textArrX = [210, 255, 275, 260, 215, 150, 90, 45, 25, 45, 85, 150];
        textArrY = [55, 100, 160, 225, 270, 285, 270, 220, 160, 100, 55, 35];
        for (let i = 0; i <= 11; i++) {
            clock_ctx.fillText(i + 1, textArrX[i], textArrY[i]);
        }
        clock_ctx.font = "15px 'ＭＳ ゴシック'";
        clock_ctx.fillText(dateText, 150, 80);
        clock_ctx.fillText(branchAmPm(), 150, 100);
    }

    function drawScale() {
        for (let l = 0; l < 60; l++) {
            clock_ctx.beginPath();
            clock_ctx.moveTo(150 + 150 * Math.cos(Math.PI / 180 * (270 + l * 6)), 150 + 150 * Math.sin(Math.PI / 180 * (270 + l * 6)));
            clock_ctx.lineTo(150 + 145 * Math.cos(Math.PI / 180 * (270 + l * 6)), 150 + 145 * Math.sin(Math.PI / 180 * (270 + l * 6)));
            clock_ctx.lineWidth = 1;
            clock_ctx.stroke();
        }
        for (let m = 0; m < 12; m++) {
            clock_ctx.beginPath();
            clock_ctx.moveTo(150 + 150 * Math.cos(Math.PI / 180 * (270 + m * 30)), 150 + 150 * Math.sin(Math.PI / 180 * (270 + m * 30)));
            clock_ctx.lineTo(150 + 140 * Math.cos(Math.PI / 180 * (270 + m * 30)), 150 + 140 * Math.sin(Math.PI / 180 * (270 + m * 30)));
            clock_ctx.lineWidth = 1.5;
            clock_ctx.stroke();
        }
    }

    function drawBoard() {
        clock_ctx.clearRect(0, 0, clock_canvas.width, clock_canvas.height);
        clock_ctx.beginPath();
        clock_ctx.arc(150, 150, 150, 0, Math.PI * 2);
        clock_ctx.lineWidth = 1.0;
        clock_ctx.stroke();
    }

    function getTime() {
        d = new Date();
        year = d.getFullYear();
        month = d.getMonth() + 1;
        date = d.getDate();
        day = d.getDay();
        hours = d.getHours() - 12;
        minutes = d.getMinutes();
        seconds = d.getSeconds();
        clock_draw()
    }

    document.querySelector('.youtubevideo_button').addEventListener('click', function () {
        const url = document.querySelector("#youtube").value;
        const id = url.replace("watch?v=", "embed/");
        document.querySelector("#youtubeframe").src = id + "?enablejsapi=1&mute=1";
        setTimeout(() => {
            y_iframeController('playVideo');
        }, 1000);

    });

    function url_save() {
        const url2 = document.querySelector("#youtube").value;
        const id2 = url2.replace("watch?v=", "embed/");
        const url3 = id2 + "?enablejsapi=1&mute=1";
        localStorage.setItem('video_url', url3)
    }

    function url_remove() {
        localStorage.removeItem('video_url');
        document.querySelector("#youtubeframe").src = "";
    }

    function videourl_reset() {
        y_iframeController('stopVideo');
        document.querySelector("#youtubeframe").src = "";
    }

    function load_videourl() {
        if (localStorage.getItem('video_url')) {
            const youtubeurl = localStorage.getItem('video_url');
            document.querySelector('#youtube').value = youtubeurl;
            const url = document.querySelector("#youtube").value;
            document.querySelector("#youtubeframe").src = url;
        }
    }

    // 再生ボタンを押した時のアクション（JavaScriptの場合）
    document.getElementById('youtube_play').addEventListener('click', function () {
        y_iframeController('playVideo');
    });

    // 一時停止ボタンを押した時のアクション（JavaScriptの場合）
    document.getElementById('youtube_pause').addEventListener('click', function () {
        y_iframeController('pauseVideo');
    });

    // 停止ボタンを押した時のアクション（JavaScriptの場合）
    document.getElementById('youtube_stop').addEventListener('click', function () {
        y_iframeController('stopVideo');
    });

    // シークバー移動ボタンを押した時のアクション（JavaScriptの場合）
    document.getElementById('youtube_seek').addEventListener('click', function () {
        //(secondsパラメータ : 指定の秒数の位置へ移動)
        y_iframeController('seekTo', '[20]');
    });

    // ミュートボタン（音声無し）を押した時のアクション（JavaScriptの場合）
    document.getElementById('youtube_mute').addEventListener('click', function () {
        y_iframeController('mute');
    });

    // アンミュート（音声あり）ボタンを押した時のアクション（JavaScriptの場合）
    document.getElementById('youtube_unmute').addEventListener('click', function () {
        y_iframeController('unMute');
    });

    // postMessageを送信する関数
    function y_iframeController(action, arg = null) {
        const youtubeWindow = document.getElementById("youtubeframe").contentWindow;
        youtubeWindow.postMessage('{"event":"command", "func":"' + action + '", "args":' + arg + '}', '*');
    };

    document.querySelectorAll('.close_button,.close_button2,.close_button3,.close_button4').forEach(function (close_buttons) {
        close_buttons.textContent = "✕"
    })
    document.querySelectorAll('.minimization_button').forEach(function (minimization_buttons) {
        minimization_buttons.textContent = "_"
    })
    document.querySelectorAll('.bigscreen_button').forEach(function (bigscreen_buttons) {
        bigscreen_buttons.textContent = "☐"
    })
    document.querySelectorAll('.minscreen_button').forEach(function (minscreen_buttons) {
        minscreen_buttons.textContent = "❒"
    })

    navigator.mediaDevices.enumerateDevices()
        .then((devices) => {
            devices.forEach((device) => {
                document.querySelector('.device_text').textContent = (device.kind + ": " + device.label +
                    " id = " + device.deviceId);
            });
        })
        .catch((error) => {
            document.querySelector('.device_text').textContent = ("デバイスが検出されませんでした:", error);
        });

    getOrientation()

    // JavaScriptで画面の向きを判定
    function getOrientation() {
        var type = screen.orientation.type;
        var ori = "";
        if (type == "portrait-primary") {
            ori = "縦向き(上部が上)";
        } else if (type == "portrait-secondary") {
            ori = "縦向き(上部が下)";
        } else if (type == "landscape-primary") {
            ori = "横向き(上部が左)";
        } else if (type == "landscape-secondary") {
            ori = "横向き(上部が右)";
        }
        document.getElementById("orientation").innerHTML = ori + "<br>" + screen.orientation.angle + "度";
    }
    // デバイスの向き変更イベントを追跡
    window.addEventListener("orientationchange", getOrientation);

    function drawOmikuji() {
        // おみくじの結果のリスト
        const omikuji_results = ['大吉', '中吉', '小吉', '末吉', '凶', '大凶', '超大凶'];
        // ランダムなインデックスを生成
        const index = Math.floor(Math.random() * omikuji_results.length);
        // 結果をアラートで表示
        document.querySelector('.omikuji_text').textContent = omikuji_results[index] + ' です！';
    }

    function localmemory_size() {
        var testKey = 'testStorageKey';
        var testData = new Array(1024).join('a'); // 1KBのデータを作成
        var success = true;
        var maxSize = 0;
        try {
            // ローカルストレージに1KBずつデータを追加していく
            while (success) {
                localStorage.setItem(testKey + maxSize, testData);
                maxSize++;
            }
        } catch (e) {
            success = false;
        }
        for (var i = 0; i < maxSize; i++) {
            localStorage.removeItem(testKey + i);
        }
        document.querySelector('.local_memory').innerHTML = '&emsp;' + maxSize + 'KB' + '&emsp;';
        localStorage.setItem('maxSize', maxSize)
    }

    setInterval(() => {
        function getLocalStorageSize() {
            let total = 0;
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    total += key.length + localStorage[key].length;
                }
            }
            return total;
        }
        const sizeInKilobytes = getLocalStorageSize() / 1024;
        document.querySelector('.local_memory2').innerHTML = '&emsp;' + sizeInKilobytes + 'KB' + '&emsp;';
        if (localStorage.getItem('maxSize') == 0) {
            document.querySelector('.window_error_text').textContent = "nexser の保存容量を超えています!"
            error_windows.classList.remove('active')
            document.querySelector('.test_allwindow').style.display = "block";
            sound3()
        }
    }, 1000);

    // HTMLのcanvas要素を取得
    const paint_canvas = document.getElementById('paint_canvas');
    const paint_ctx = paint_canvas.getContext('2d');

    // 背景色を設定
    paint_ctx.fillStyle = '#ffffff';
    paint_ctx.fillRect(0, 0, paint_canvas.width, paint_canvas.height);

    function paintcanvas_background() {
        const paintcanvas_backgroundcolor = document.querySelector('.paint_background').value;
        paint_ctx.fillStyle = paintcanvas_backgroundcolor;
        paint_ctx.fillRect(0, 0, paint_canvas.width, paint_canvas.height);
    }

    // 描画状態のフラグ
    let paint_isDrawing = false;
    let paint_lastX = 0;
    let paint_lastY = 0;
    let paint_lineWidth = 5;

    // マウス操作に対応
    paint_canvas.addEventListener('mousedown', startDrawing);
    paint_canvas.addEventListener('mousemove', paint_draw);
    paint_canvas.addEventListener('mouseup', stopDrawing);
    paint_canvas.addEventListener('mouseout', stopDrawing);

    // タッチ操作に対応（タッチデバイス用）
    paint_canvas.addEventListener('touchstart', startDrawing);
    paint_canvas.addEventListener('touchmove', paint_draw);
    paint_canvas.addEventListener('touchend', stopDrawing);

    document.getElementById('paint_selectcolor').addEventListener('change', function () {
        localStorage.removeItem('eraser_color')
    });

    // 描画開始
    function startDrawing(e) {
        paint_isDrawing = true;
        [paint_lastX, paint_lastY] = [e.offsetX || e.touches[0].clientX, e.offsetY || e.touches[0].clientY];
    }

    // 描画停止
    function stopDrawing() {
        paint_isDrawing = false;
        paint_ctx.beginPath();
    }

    // 描画
    function paint_draw(e) {
        if (!paint_isDrawing) return;
        if (localStorage.getItem('eraser_color')) {
            paint_ctx.strokeStyle = "white";
        } else {
            paint_ctx.strokeStyle = document.getElementById('paint_selectcolor').value;
        }

        paint_ctx.lineWidth = paint_lineWidth;
        paint_ctx.lineCap = 'round';
        paint_ctx.lineJoin = 'round';
        paint_ctx.beginPath();
        paint_ctx.moveTo(paint_lastX, paint_lastY);
        paint_ctx.lineTo(e.offsetX || e.touches[0].clientX, e.offsetY || e.touches[0].clientY);
        paint_ctx.stroke();
        [paint_lastX, paint_lastY] = [e.offsetX || e.touches[0].clientX, e.offsetY || e.touches[0].clientY];
    }
    const paintwidth = document.querySelector('.paint_width').value = "5";
    lineWidth = paintwidth;
    paint_ctx.strokeStyle = "black";
    // 線の太さの変更
    function changeLineWidth() {
        const paintwidth = document.querySelector('.paint_width').value;
        paint_lineWidth = paintwidth;
    }

    // 消しゴム
    function eraser(eraser_color) {
        var fillStyleColor = paint_ctx.fillStyle;
        strokeStyle = fillStyleColor;
        localStorage.setItem('eraser_color', eraser_color)
    }

    // 図形の描画
    function drawShape(shape) {
        // ここに図形を描画するコードを追加
    }

    // テキストのスタイルを設定
    paint_ctx.font = '48px serif';
    paint_ctx.textAlign = 'center';
    paint_ctx.textBaseline = 'middle';

    function paintcanvas_text() {
        const paintcanvas_text = document.querySelector('.paint_text').value;

        paint_ctx.fillStyle = 'white';
        paint_ctx.strokeStyle = 'black';
        paint_ctx.lineWidth = '1';
        paint_ctx.fillText(paintcanvas_text, paint_canvas.width / 2, paint_canvas.height / 2);
        paint_ctx.strokeText(paintcanvas_text, paint_canvas.width / 2, paint_canvas.height / 2);
    }




    paint_canvas.addEventListener('dragover', (event) => {
        event.preventDefault();
    });

    paint_canvas.addEventListener('drop', (event) => {
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            const paint_image = new Image();
            const reader = new FileReader();
            reader.onload = (e) => {
                paint_image.src = e.target.result;
                paint_image.onload = () => {
                    paint_ctx.drawImage(paint_image, 0, 0, paint_canvas.width, paint_canvas.height);
                };
            };
            reader.readAsDataURL(file);
        }
    });



    // キャンバスを画像として保存
    function downloadCanvasAsPng() {
        let canvas = document.getElementById('paint_canvas');
        let link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = 'canvas.png';
        link.click();
    }

    // Canvasの内容をJSONに出力
    function canvasdata_file() {
        var canvas = document.getElementById('paint_canvas');
        var dataURL = canvas.toDataURL();
        var jsonData = JSON.stringify({ image: dataURL });

        // JSONデータをBlobとして外部ファイルに保存
        var blob = new Blob([jsonData], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = document.querySelector('.paint_filename').value + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function testfiles(event) {
        var file = event.files[0]; // 選択されたファイルを取得
        var reader = new FileReader();
        // ファイルの読み込みが完了したら実行されるイベント
        reader.onload = function (e) {
            var jsonData = e.target.result; // 読み込んだファイルの内容
            var data = JSON.parse(jsonData); // JSONデータをオブジェクトに変換
            // Canvasに描画
            var canvas = document.getElementById('paint_canvas');
            var ctx = canvas.getContext('2d');
            var image = new Image();
            // 画像が読み込まれたらCanvasに描画
            image.onload = function () {
                ctx.drawImage(image, 0, 0);
            };
            // ImageオブジェクトのソースにデータURLを設定
            image.src = data.image;
        };
        // ファイルの内容をテキストとして読み込む
        reader.readAsText(file);
    }

    function paint_allclear() {
        paint_ctx.clearRect(0, 0, paint_canvas.width, paint_canvas.height);
        paint_ctx.fillStyle = '#ffffff';
        paint_ctx.fillRect(0, 0, paint_canvas.width, paint_canvas.height);
    }

    function wallpaper_allremove() {
        document.querySelector('.nexser_backgroundimage_1').style.display = "none"
        document.querySelector('.nexser_backgroundimage_2').style.display = "none"
        localStorage.removeItem('wallpaper_95')
        localStorage.removeItem('wallpaper_xp')
    }


    document.querySelector('.wallpaper_95').addEventListener('click', function (wallpaper_95) {
        wallpaper_allremove()
        localStorage.setItem('wallpaper_95', wallpaper_95);
        document.querySelector('.nexser_backgroundimage_1').style.display = "block"
    })

    document.querySelector('.wallpaper_xp').addEventListener('click', function (wallpaper_xp) {
        wallpaper_allremove()
        localStorage.setItem('wallpaper_xp', wallpaper_xp);
        document.querySelector('.nexser_backgroundimage_2').style.display = "block"
    })

    const othello_board = document.getElementById('othello_board');
    const size = 8;
    let currentPlayer = 'othello_black';

    // Initialize board
    for (let i = 0; i < size * size; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.dataset.index = i;
        cell.addEventListener('click', handleClick);
        othello_board.appendChild(cell);
    }

    othello_start()

    function othello_reset() {
        document.querySelectorAll('.othello_white,.othello_black').forEach(othello_board_child => {
            othello_board_child.remove()
        });
    }

    function othello_start() {
        othello_reset()
        // Set initial pieces
        const initialPositions = [27, 28, 35, 36];
        initialPositions.forEach(index => {
            const piece = document.createElement('div');
            piece.classList.add(index % 2 === 0 ? 'othello_white' : 'othello_black');
            othello_board.children[index].appendChild(piece);
        });
    }

    function handleClick(event) {
        const cell = event.target;
        if (cell.children.length > 0) return; // Ignore if cell is not empty

        const piece = document.createElement('div');
        piece.classList.add(currentPlayer);
        cell.appendChild(piece);

        // Switch player
        currentPlayer = currentPlayer === 'othello_black' ? 'othello_white' : 'othello_black';
    }


    function nexser_files_windowload() {
        const parent = document.getElementById('nexser');
        const output = document.getElementById('nexser_files_output');

        function createTree(element) {
            const ul = document.createElement('ul');
            Array.from(element.children).forEach(child => {
                const li = document.createElement('li');
                const textContent = child.textContent.trim();
                li.textContent = textContent;

                // クラス名を生成して適用
                if (textContent.includes('.')) {
                    li.classList.add('nexser_files_file');
                } else {
                    li.classList.add('nexser_files_folder');
                }

                const childTree = createTree(child);
                if (childTree) {
                    li.appendChild(childTree);
                }
                ul.appendChild(li);
            });
            return ul.children.length ? ul : null;
        }

        const tree = createTree(parent);
        if (tree) {
            output.appendChild(tree);
        }
    }

    function nexser_files_output_remove() {

        const parentElement = document.getElementById('nexser_files_output');

        // すべての子要素を削除
        while (parentElement.firstChild) {
            parentElement.removeChild(parentElement.firstChild);
        }
    }

    function addResizers(element) {
        const resizerPositions = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top', 'right', 'bottom', 'left'];
        resizerPositions.forEach(position => {
            const resizer = document.createElement('div');
            resizer.classList.add('resizer', position);
            element.appendChild(resizer);
        });
    }

    function makeResizableDivs(className) {
        const elements = document.querySelectorAll(className);
        elements.forEach(element => {
            addResizers(element);
            const resizers = element.querySelectorAll('.resizer');
            const minimum_size = 20;
            let original_width = 0;
            let original_height = 0;
            let original_x = 0;
            let original_y = 0;
            let original_mouse_x = 0;
            let original_mouse_y = 0;

            resizers.forEach(resizer => {
                resizer.addEventListener('mousedown', function (e) {
                    e.preventDefault();
                    original_width = parseFloat(getComputedStyle(element, null).getPropertyValue('width').replace('px', ''));
                    original_height = parseFloat(getComputedStyle(element, null).getPropertyValue('height').replace('px', ''));
                    original_x = element.getBoundingClientRect().left;
                    original_y = element.getBoundingClientRect().top;
                    original_mouse_x = e.pageX;
                    original_mouse_y = e.pageY;

                    window.addEventListener('mousemove', resize);
                    window.addEventListener('mouseup', stopResize);
                });

                function resize(e) {
                    if (resizer.classList.contains('right')) {
                        const width = original_width + (e.pageX - original_mouse_x);
                        if (width > minimum_size) {
                            element.style.width = width + 'px';
                        }
                    } else if (resizer.classList.contains('left')) {
                        const width = original_width - (e.pageX - original_mouse_x);
                        if (width > minimum_size) {
                            element.style.width = width + 'px';
                            element.style.left = original_x + (e.pageX - original_mouse_x) + 'px';
                        }
                    } else if (resizer.classList.contains('bottom')) {
                        const height = original_height + (e.pageY - original_mouse_y);
                        if (height > minimum_size) {
                            element.style.height = height + 'px';
                        }
                    } else if (resizer.classList.contains('top')) {
                        const height = original_height - (e.pageY - original_mouse_y);
                        if (height > minimum_size) {
                            element.style.height = height + 'px';
                            element.style.top = original_y + (e.pageY - original_mouse_y) + 'px';
                        }
                    } else if (resizer.classList.contains('bottom-right')) {
                        const width = original_width + (e.pageX - original_mouse_x);
                        const height = original_height + (e.pageY - original_mouse_y);
                        if (width > minimum_size) {
                            element.style.width = width + 'px';
                        }
                        if (height > minimum_size) {
                            element.style.height = height + 'px';
                        }
                    } else if (resizer.classList.contains('bottom-left')) {
                        const height = original_height + (e.pageY - original_mouse_y);
                        const width = original_width - (e.pageX - original_mouse_x);
                        if (height > minimum_size) {
                            element.style.height = height + 'px';
                        }
                        if (width > minimum_size) {
                            element.style.width = width + 'px';
                            element.style.left = original_x + (e.pageX - original_mouse_x) + 'px';
                        }
                    } else if (resizer.classList.contains('top-right')) {
                        const width = original_width + (e.pageX - original_mouse_x);
                        const height = original_height - (e.pageY - original_mouse_y);
                        if (width > minimum_size) {
                            element.style.width = width + 'px';
                        }
                        if (height > minimum_size) {
                            element.style.height = height + 'px';
                            element.style.top = original_y + (e.pageY - original_mouse_y) + 'px';
                        }
                    } else if (resizer.classList.contains('top-left')) {
                        const width = original_width - (e.pageX - original_mouse_x);
                        const height = original_height - (e.pageY - original_mouse_y);
                        if (width > minimum_size) {
                            element.style.width = width + 'px';
                            element.style.left = original_x + (e.pageX - original_mouse_x) + 'px';
                        }
                        if (height > minimum_size) {
                            element.style.height = height + 'px';
                            element.style.top = original_y + (e.pageY - original_mouse_y) + 'px';
                        }
                    }
                    const elements = document.querySelectorAll('.rectangle');
                    // 各要素からクラスを削除
                    elements.forEach(element => {
                        element.classList.remove('rectangle');
                    });
                }

                function stopResize() {
                    window.removeEventListener('mousemove', resize);
                    window.removeEventListener('mouseup', stopResize);
                }
            });
        });
    }

    makeResizableDivs('.resize');

};

