let supportsPassive = false;
try {
    const opts = { passive: false, get passive() { supportsPassive = true; return false; } };
    window.addEventListener("testPassive", null, opts);
    window.removeEventListener("testPassive", null, opts);
} catch (e) { }

const ua = navigator.userAgent.toLowerCase();
if (ua.includes("mobile")) {
    // Mobile (iPhone、iPad「Chrome、Edge」、Android)
    alert("この端末は対応していません!")
} else if (ua.indexOf("ipad") > -1 || (ua.indexOf("macintosh") > -1 && "ontouchend" in document)) {
    // Mobile (iPad「Safari」)
    alert("この端末は対応していません!")
} else {
    const logoff = document.getElementsByClassName('logoff');
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
    const screen_prompt = document.getElementById('prompt');
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
    const cpu_bench_menu = document.querySelector('.cpu_bench_menu');
    const device_menu = document.querySelector('.device_menu');
    const command_help_menu = document.querySelector('.command_help_menu');
    const omikuji_menu = document.querySelector('.omikuji_menu');
    const localstorage_monitor_menu = document.querySelector('.localstorage_monitor_menu');
    const localstorage_details_menu = document.querySelector('.localstorage_details_menu');
    const paint_menu = document.querySelector('.paint_menu');
    const nexser_files_menu = document.querySelector('.nexser_files_menu');
    const url_drop_menu = document.querySelector('.url_drop_menu');
    const alarm_menu = document.querySelector('.alarm_menu');
    const test_site_menu = document.querySelector('.test_site_menu');
    const console_error_menu = document.querySelector('.console_error_menu');
    const kakeibo_menu = document.querySelector('.kakeibo_menu');
    const nexser_nextversion_menu = document.querySelector('.nexser_nextversion_menu');
    const mydocument_menu = document.querySelector('.mydocument_menu');

    const notice_menu = document.querySelector('.notice_menu');

    const nexser_search_menu = document.querySelector('.nexser_search_menu');

    const error_windows = document.querySelector('.error_windows');
    const warning_windows = document.querySelector('.warning_windows');

    const tetris_mneu = document.querySelector('.tetris_menu');
    const bom_menu = document.querySelector('.bom_menu');
    const othello_menu = document.querySelector('.othello_menu');
    const memory_game_menu = document.querySelector('.memory_game_menu');


    // マウスドラッグで出てくる水色のエリアの描画
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

        getLargestZIndex('.child_windows');
        z_index.textContent = getLargestZIndex('.child_windows');

        var isClickInsideStartButton7 = Array.from(document.querySelectorAll('.window_files')).some(button => button.contains(e.target));
        if (!isClickInsideStartButton7) {
            Array.from(document.getElementsByClassName('window_files')).forEach((window_files3) => {
                window_files3.classList.remove('file_border2');
                if (window_files3.classList.contains('file_border')) {
                    document.querySelector('.file_border').classList.add('file_border2');
                    document.querySelector('.file_border2').classList.remove('file_border');
                }
            })
        }

        var isClickInsideStartButton = document.querySelector('.start_button').contains(e.target);
        var isClickInsideParentStartMenu2 = document.querySelector('.parentstartmenu2').contains(e.target);
        if (!isClickInsideStartButton && !isClickInsideParentStartMenu2) {
            startmenu_close()
        }
        var isClickInsideStartButton3 = Array.from(document.querySelectorAll('.windowtool_child ,.windowtool_parent')).some(button => button.contains(e.target));
        if (!isClickInsideStartButton3) {
            document.querySelectorAll('.windowtool_child').forEach(button => {
                button.style.display = "none";
            });
        }

        var isClickInsideStartButton4 = document.querySelector('.battery_child').contains(e.target);
        var isClickInsideStartButton4_2 = document.querySelector('.battery_menu').contains(e.target);
        if (!isClickInsideStartButton4 && !isClickInsideStartButton4_2) {
            document.querySelector('.battery_menu').style.display = "none";
            document.querySelector('.battery_child').classList.remove('pressed');
        }

        var isClickInsideStartButton5 = document.querySelector('.sit_button').contains(e.target);
        var isClickInsideStartButton6 = document.querySelector('.screen_light_range_child').contains(e.target);
        if (!isClickInsideStartButton5 && !isClickInsideStartButton6) {
            document.querySelector('.screen_light_range_child').style.display = "none";
            document.querySelector('.sit_button').classList.remove('pressed');
        }

        var isClickInsideStartButton7 = Array.from(document.querySelectorAll('.child_windows, .child')).some(button => button.contains(e.target));
        if (!isClickInsideStartButton7) {
            title_navyreomve();
            titlecolor_set();
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
        rectangle_remove()
    });

    function lightchild() {
        const screen_light_range_child = document.querySelector('.screen_light_range_child');
        if (screen_light_range_child.style.display == "flex") {
            screen_light_range_child.style.display = "none"
        } else {
            screen_light_range_child.style.display = "flex"
        }
    }

    // nexser_load
    const tasks = [
        load_nexser,
        getStorage,
        taskbar_none,
        title_none,
        screen_backtextload,
        notecolor_change,
        notetextsize_change,
        taskgroup_load,
        window_back_silver,
        caload,
        titlecolor_set,
        back_pattern_set,
        load_videourl,
        pageLoad,
        nexser_savedata_load
    ];

    Promise.all(tasks.map(task => new Promise(resolve => setTimeout(() => resolve(task()), 50))))
        .then(() => {
            console.log('すべてのタスクが完了しました');
        });

    function nexser_savedata_load() {
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
        if (localStorage.getItem('auto_startup')) {
            document.querySelector('.auto_startup').textContent = "ON"
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
        if (localStorage.getItem('battery_button')) {
            document.querySelector('.battery_button').textContent = "on"
            document.querySelector('.task_battery').style.display = "none";
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
            document.querySelector('.desktop_version_text').style.bottom = "0px"
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

        if (localStorage.getItem('taskbar_autohide')) {
            document.getElementById('taskbar').style.bottom = "-35px"
        }
        if (localStorage.getItem('taskbar_height') && (localStorage.getItem('taskbar_autohide'))) {
            const t2 = t - 5;
            document.getElementById('taskbar').style.bottom = "-" + t2 + "px";
        }

        if (localStorage.getItem('wallpaper_95')) {
            document.querySelector('.nexser_backgroundimage_1').style.display = "block";
            minidesk_backgroundresize1();
            background_img.style.width = "100%"
            background_img.style.height = "100%"
        }
        if (localStorage.getItem('wallpaper_95_2')) {
            document.querySelector('.nexser_backgroundimage_2').style.display = "block";
            minidesk_backgroundresize2();
            background_img.style.width = "100%"
            background_img.style.height = "100%"
        }
        if (localStorage.getItem('wallpaper_xp')) {
            document.querySelector('.nexser_backgroundimage_3').style.display = "block";
            minidesk_backgroundresize3();
            background_img.style.width = "100%"
            background_img.style.height = "100%"
        }
    }



    function taskgroup_load() {
        drawClock();
        var date = new Date();
        var year = date.getFullYear();
        var month = (date.getMonth() + 1).toString().padStart(2, '0');
        var day = date.getDate().toString().padStart(2, '0');
        document.querySelector('.date_day').textContent = `${year}/${month}/${day}`;

        var hours = date.getHours().toString().padStart(2, '0');
        var minutes = date.getMinutes().toString().padStart(2, '0');
        var seconds = date.getSeconds().toString().padStart(2, '0');

        let clockElements = document.getElementsByClassName('date_clock');
        for (let element of clockElements) {
            element.textContent = `${hours}:${minutes}:${seconds}`;
        }
    }
    setInterval(taskgroup_load, 1000);

    function notice_closekeep() {
        localStorage.setItem('notice_closekeep', true)
    }

    function load_nexser() {
        localStorage.removeItem('no_shutdown')
        if (localStorage.getItem('password') && !localStorage.getItem('login') && !localStorage.getItem('prompt_data3') && localStorage.getItem('prompt_data')) {
            screen_prompt.style.display = "none";
            nexser_program.style.display = "none";
            nexser.style.display = "block";
            desktop.style.display = "none";
            document.querySelector('.pass_signin_menu').classList.remove('active')
            document.querySelector('#pass_form').focus();
        } else if (!localStorage.getItem('start_nexser') && localStorage.getItem('prompt_data')) {
            start_check()
        } else if (localStorage.getItem('prompt_data') && localStorage.getItem('start_nexser')) {
            screen_prompt.style.display = "none";
            nexser_program.style.display = "none";
            nexser.style.display = "block";
            desktop.style.display = "block"
            document.querySelector('.welcome_windows').style.display = "none";
        } else if (localStorage.getItem('prompt_data3')) {
            screen_prompt.style.display = "none";
            nexser_program.style.display = "block";
            nexser.style.display = "none";
            desktop.style.display = "none";
            document.getElementById('nex').style.cursor = 'crosshair';
        } else {
            screen_prompt.style.display = "block";
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

        if (screen_prompt.style.display == "block" && localStorage.getItem('auto_startup')) {
            help_command()
            prompt_text_check()
        }

        sessionStorage.removeItem('start_camera');
        localStorage.removeItem('note_texts');
    }

    document.querySelector('#prompt').addEventListener('click', function () {
        document.querySelector('.focus').focus();
    })

    function startmenu_close() {
        if (parent_start_menu.style.display == "block") {
            parent_start_menu.style.display = "none";
            document.querySelector('.start_button').classList.remove('pressed');
        }
    }
    document.getElementById('startbtn').addEventListener('mousedown', function () {
        setTimeout(() => {
            if (parent_start_menu.style.display == "block") {
                startmenu_close()
            } else {
                parent_start_menu.style.display = "block";
                document.querySelector('.start_button').classList.add('pressed');
            }
        }, 0);
        Array.from(document.getElementsByClassName('desktop_files')).forEach((df1) => {
            const file10 = df1.firstElementChild;
            file10.classList.remove('file_select');
        })
    })

    document.querySelector('.battery_child').addEventListener('click', function () {
        if (document.querySelector('.battery_menu').style.display == "block") {
            document.querySelector('.battery_menu').style.display = "none";
        } else {
            document.querySelector('.battery_menu').style.display = "block";
        }
    })


    function addButtonListeners(button_1) {
        if (!button_1.classList.contains('listener-added')) {
            button_1.addEventListener('mousedown', () => button_1.classList.add('pressed'));
            button_1.addEventListener('mouseleave', () => button_1.classList.remove('pressed'));
            button_1.addEventListener('mouseup', () => button_1.classList.remove('pressed'));
            button_1.classList.add('listener-added');
        }
    }
    const observer_btn1 = new MutationObserver((mutations_1) => {
        mutations_1.forEach((mutation_1) => {
            if (mutation_1.type === 'childList') {
                mutation_1.addedNodes.forEach((node_1) => {
                    if (node_1.nodeType === 1 && node_1.classList.contains('button2')) {
                        addButtonListeners(node_1);
                    }
                });
            }
        });
    });
    observer_btn1.observe(document.body, { childList: true, subtree: true });


    function addButtonListeners2(button_2) {
        if (!button_2.classList.contains('listener-added')) {
            button_2.addEventListener('click', () => button_2.classList.toggle('pressed'));
            button_2.classList.add('listener-added');
        }
    }
    const observer_btn2 = new MutationObserver((mutations_2) => {
        mutations_2.forEach((mutation_2) => {
            if (mutation_2.type === 'childList') {
                mutation_2.addedNodes.forEach((node_2) => {
                    if (node_2.nodeType === 1 && node_2.classList.contains('button')) {
                        addButtonListeners2(node_2);
                    }
                });
            }
        });
    });
    observer_btn2.observe(document.body, { childList: true, subtree: true });


    document.querySelector('.deskprompt').addEventListener('click', function () {
        localStorage.setItem('deskprompt', true);
    })
    document.querySelector('#shell').addEventListener('click', function () {
        document.getElementById('shell').blur()
    })
    document.querySelector('#shell').addEventListener('mousedown', function () {
        document.getElementById('shell').blur()
    })

    function nexser_program_open() {
        startmenu_close();
        y_iframeController('pauseVideo');
        preview2_stop();
        document.querySelectorAll('video').forEach(video => video.pause());
        func2();
        desktop.style.display = "none";
        document.getElementsByClassName('pattern_backgrounds')[0].style.display = "none";
        document.getElementsByClassName('welcome_windows')[0].style.display = "none";
        sound_stop();
        document.querySelector('.prompt_error_text').textContent = "";
        document.getElementById('nex').style.cursor = 'crosshair';
        document.querySelector('.test_allwindow').style.display = "none";
        setTimeout(function () {
            screen_prompt.style.display = "none";
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
                screen_prompt.style.display = "block";
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

    const toggleSetting_program = (selector, key, onText, offText) => {
        document.querySelector(selector).addEventListener('click', () => {
            if (localStorage.getItem(key)) {
                localStorage.removeItem(key);
                document.querySelector(selector).textContent = offText;
            } else {
                localStorage.setItem(key, true);
                document.querySelector(selector).textContent = onText;
            }
        });
    };
    toggleSetting_program('.startup_sound', 'driver_sound', 'UN INSTALL', 'INSTALL');
    toggleSetting_program('.startup_versiontext', 'startup_versiontext', 'ON', 'OFF');
    toggleSetting_program('.startup_note', 'startup_note', 'ON', 'OFF');
    toggleSetting_program('.startup_computer', 'startup_computer', 'ON', 'OFF');
    toggleSetting_program('.startup_color', 'startup_color', 'ON', 'OFF');
    toggleSetting_program('.startup_screen', 'startup_screen', 'ON', 'OFF');
    toggleSetting_program('.startup_htmlviewer_edit', 'startup_htmlviewer_edit', 'ON', 'OFF');
    toggleSetting_program('.startup_guidebook', 'startup_guidebook', 'ON', 'OFF');
    toggleSetting_program('.startup_objective', 'startup_objective', 'ON', 'OFF');
    toggleSetting_program('.startup_calendar', 'startup_calendar', 'ON', 'OFF');
    toggleSetting_program('.startup_speed', 'prompt_data2', 'HIGH', 'LOW');
    toggleSetting_program('.auto_startup', 'auto_startup', 'ON', 'OFF');

    const font_clear = () => {
        ['font_default', 'font_sans_serif', 'font_cursive', 'font_fantasy', 'font_monospace'].forEach(item => localStorage.removeItem(item));
    };
    const setFont = (font) => {
        font_clear();
        localStorage.setItem(`font_${font}`, true);
        document.querySelector("body").style.fontFamily = font;
    };
    document.querySelector('.font_default').addEventListener('click', () => {
        font_clear();
        document.querySelector("body").style.fontFamily = "serif";
    });
    document.querySelector('.font_sans_serif').addEventListener('click', () => setFont('sans_serif'));
    document.querySelector('.font_cursive').addEventListener('click', () => setFont('cursive'));
    document.querySelector('.font_fantasy').addEventListener('click', () => setFont('fantasy'));
    document.querySelector('.font_monospace').addEventListener('click', () => setFont('monospace'));

    function nexser_boot_check() {
        if (localStorage.getItem('driver_sound')) {
            nexser_start()
            document.getElementById('nex').style.cursor = 'none';
        } else if (!localStorage.getItem('driver_sound') && !localStorage.getItem('start_nexser')) {
            screen_prompt.style.display = "none";
            document.querySelector('.nexser_boot_menu').style.display = "block";
            document.querySelector('.nexser_bootmenu_text').textContent = "サウンドドライバー がインストールされていません!";
            document.querySelector('.nexser_bootmenu_text2').textContent = "インストールして nexser を起動しますか?";
        } else {
            nexser_start()
            document.getElementById('nex').style.cursor = 'none';
        }
    }

    document.querySelector('.boot_sound').addEventListener('click', () => {
        if (localStorage.getItem('driver_sound')) {
            localStorage.removeItem('driver_sound');
            document.querySelector('.startup_sound').textContent = "INSTALL";
            document.querySelector('.installbutton_1').textContent = "install";
        } else {
            localStorage.setItem('driver_sound', true);
            document.querySelector('.startup_sound').textContent = "UN INSTALL";
            document.querySelector('.installbutton_1').textContent = "uninstall";
        }
    });

    function pass_submit() {
        if (document.querySelector('.password').value == "") {
            document.querySelector('.window_error_text').textContent = "パスワードが入力されていません!"
            error_windows.classList.remove('active')
            document.querySelector('.test_allwindow').style.display = "block";
            sound3()
        } else {
            const pass = document.querySelector('.password').value;

            const password_lock = (String(pass)
                .replaceAll("0", ".a+b.").replaceAll("1", ".c#d.").replaceAll("2", ".e*f.")
                .replaceAll("3", ".g|h.").replaceAll("4", ".i=j.").replaceAll("5", ".k[l.")
                .replaceAll("6", ".m]n.").replaceAll("7", ".o-p.").replaceAll("8", ".q>r.")
                .replaceAll("9", ".s<t.")
            );

            localStorage.setItem('password', password_lock);
            localStorage.setItem('login', true);
            document.getElementsByClassName('passcode')[0].textContent = "登録しました";
        }
    }

    function pass_reset() {
        document.querySelector('.password').value = "";
        localStorage.removeItem('password');
        localStorage.removeItem('login');
        document.getElementsByClassName('passcode')[0].textContent = "登録していません";
    }

    if (localStorage.getItem('password')) {
        document.getElementsByClassName('passcode')[0].textContent = "登録しています";
    }

    function pass_check() {
        setColor();
        if (localStorage.getItem('password') && !localStorage.getItem('login')) {
            document.querySelector('.pass_signin_menu').classList.remove('active')
            document.getElementById('pass_form').focus();
            document.getElementById('nex').style.cursor = '';
        } else {
            start_check()
        }
    }

    function password_login() {
        const password_unlock = localStorage.getItem('password');
        const password_unlock2 = (String(password_unlock)
            .replaceAll(".a+b.", "0").replaceAll(".c#d.", "1").replaceAll(".e*f.", "2")
            .replaceAll(".g|h.", "3").replaceAll(".i=j.", "4").replaceAll(".k[l.", "5")
            .replaceAll(".m]n.", "6").replaceAll(".o-p.", "7").replaceAll(".q>r.", "8")
            .replaceAll(".s<t.", "9")
        );
        if (password_unlock2 == document.querySelector('#pass_form').value) {
            document.querySelector('.pass_signin_menu').classList.add('active')
            document.querySelector('.pass_no').textContent = "";
            start_check();
            localStorage.setItem('login', true);
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
        document.querySelector('.focus').blur();
        window_none();
        startmenu_close();
        document.getElementById('nex').style.cursor = 'none';
        if (localStorage.getItem('prompt_data2')) {
            func2();
            setTimeout(function () {
                screen_prompt.style.display = "none";
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
                screen_prompt.style.display = "none";
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

    Array.from(logoff).forEach(element => {
        element.addEventListener('click', event => {
            document.getElementById('nex').style.cursor = 'progress';
            startmenu_close()
            setTimeout(() => {
                document.querySelector('.test_allwindow').style.display = "block";
                if (sessionStorage.getItem('start_camera')) {
                    document.getElementById('nex').style.cursor = '';
                    document.querySelector('.window_error_text').textContent = "カメラが実行されているため、ログオフできません!"
                    error_windows.classList.remove('active');
                    document.querySelector('.test_allwindow').style.display = "block";
                    sound3()
                } else if (localStorage.getItem('no_shutdown')) {
                    document.getElementById('nex').style.cursor = '';
                    document.querySelector('.window_error_text').textContent = "welcomeウィンドウが起動するまでシャットダウンはできません!"
                    error_windows.classList.remove('active')
                    document.querySelector('.test_allwindow').style.display = "block";
                    sound3()
                } else if (gets == gets2 && gets3 === 0) {
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
                        document.querySelectorAll('.testwindow2').forEach(function (testwindow2) {
                            testwindow2.remove()
                        })
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
                                button.classList.remove('pressed');
                            });
                            document.getElementsByClassName('name')[0].value = "";
                            document.querySelector('.prompt_error_text').textContent = "";
                            msg.innerText = "";
                            prompt_text.style.color = "";
                            nexser.style.display = "none";
                            screen_prompt.style.display = "block";
                            document.getElementsByClassName('focus')[0].focus();
                            document.getElementById('nex').style.cursor = '';
                        }, 500);
                    }, 1000);
                } else {
                    warning_windows.style.display = "block";
                    document.querySelector('.close_button3').style.display = "block"
                    document.querySelector('.shutdown_button').style.display = "block";
                    document.querySelector('.warningclose_button').style.display = "none";
                    document.querySelector('.warning_title_text').textContent = "warning"
                    document.querySelector('.window_warning_text').textContent = "実行されているウィンドウがあります! ログオフしますか?"
                    sound5()
                    document.getElementById('nex').style.cursor = '';
                }
            }, 100);
        })
    })

    Array.from(restart).forEach(element => {
        element.addEventListener('click', event => {
            document.getElementById('nex').style.cursor = 'progress';
            startmenu_close()
            setTimeout(() => {
                document.querySelector('.test_allwindow').style.display = "block";
                if (sessionStorage.getItem('start_camera')) {
                    document.getElementById('nex').style.cursor = '';
                    document.querySelector('.window_error_text').textContent = "カメラが実行されているため、再起動はできません!"
                    error_windows.classList.remove('active')
                    sound3()
                    document.querySelector('.test_allwindow').style.display = "block";
                } else if (localStorage.getItem('no_shutdown')) {
                    document.getElementById('nex').style.cursor = '';
                    document.querySelector('.window_error_text').textContent = "welcomeウィンドウが起動するまで再起動はできません!"
                    error_windows.classList.remove('active')
                    sound3()
                    document.querySelector('.test_allwindow').style.display = "block";
                } else if (gets == gets2 && gets3 === 0) {
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
                                button.classList.remove('pressed');
                            });
                            document.getElementsByClassName('name')[0].value = "";
                            document.querySelector('.prompt_error_text').textContent = "";
                            msg.innerText = "";
                            prompt_text.style.color = "";
                            nexser.style.display = "none";
                            document.querySelector('.restart_text').style.display = "block";
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
                    document.querySelector('.window_error_text').textContent = "全てのウィンドウが閉じてないため、再起動できません!"
                    error_windows.classList.remove('active')
                    prompt_text2.style.color = "";
                    document.querySelector('.test_allwindow').style.display = "block";
                    sound3()
                }
            }, 100);
        })
    })

    function start_check() {
        document.getElementsByClassName('pass_signin_menu')[0].classList.remove('selectwindows')
        test_windows_button()
        if (localStorage.getItem('login_welcome') && localStorage.getItem('password')) {
            localStorage.setItem('no_shutdown', true)
        };
        const t = localStorage.getItem('taskbar_height');
        document.getElementById('files').style.display = "none";
        document.getElementById('nex').style.cursor = 'none';
        taskbar.style.display = "none";
        document.getElementById('files').style.display = "none";
        if (!localStorage.getItem('start_nexser') || desktop.style.display == "block") {
            screen_prompt.style.display = "none";
            nexser_program.style.display = "none";
            nexser.style.display = "block";
            desktop.style.display = "none";
            document.querySelector('.welcome_windows').style.display = "block";
            welcome_animation()
        } else {
            startup_sound();
            screen_prompt.style.display = "none";
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
                if (localStorage.getItem('toolbar_on')) {
                    toolbar.style.display = "block";
                }
                if (localStorage.getItem('taskbar_position_button')) {
                    taskbar.style.display = "block";
                    const task = document.getElementById('taskbar').clientHeight;
                    toolbar.style.bottom = "";
                    toolbar.style.left = "";
                    toolbar.style.top = "40px";
                    toolbar.style.top = t + "px";
                    document.querySelector('.files_inline').style.top = t + "px"

                    document.querySelector('.child_start_menu').style.top = task + "px"

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
                    const task = document.getElementById('taskbar').clientHeight;
                    toolbar.style.top = "";
                    toolbar.style.left = "";
                    toolbar.style.bottom = "40px";
                    toolbar.style.bottom = t + "px";
                    document.querySelector('.child_start_menu').style.bottom = task + "px"
                    if (localStorage.getItem('data_taskbar_none')) {
                        taskbar.style.display = "none";
                        toolbar.style.bottom = "0px";
                        document.querySelector('.desktop_version_text').style.bottom = "0px"
                    } else {
                        taskbar.style.display = "block";
                        toolbar.style.bottom = "40px";
                        toolbar.style.bottom = t + "px";
                        document.querySelector('.desktop_version_text').style.bottom = task + "px"
                    }

                }
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
                localmemory_size()
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
            }, 2000);
        }, 50);
    }

    document.getElementsByClassName('startnexser_close')[0].addEventListener('click', function () {
        document.getElementsByClassName('welcome_windows')[0].style.display = "none"
    })

    document.querySelector('.login_welcome').addEventListener('click', () => {
        localStorage.setItem('login_welcome', true);
    });
    document.querySelector('.nologin_welcome').addEventListener('click', () => {
        localStorage.removeItem('login_welcome');
    });

    function welcome_animation() {
        sound_stop();
        sound7();
        const nex = document.getElementById('nex');
        const startNexser = document.getElementsByClassName('start_nexser')[0];
        const startNexserClose = document.getElementsByClassName('startnexser_close')[0];
        const welcomeWindowInline = document.getElementsByClassName('welcome_window_inline')[0];
        const welcomeText1 = document.getElementsByClassName('welcome_text1')[0];
        const welcomeUnderline = document.getElementsByClassName('welcome_underline')[0];
        const welcomeText2 = document.getElementsByClassName('welcome_text2')[0];
        const welcomeIcons = document.getElementsByClassName('welcome_icons')[0];
        nex.style.cursor = 'none';
        startNexser.style.display = "none";
        startNexserClose.style.display = "none";
        welcomeWindowInline.style.display = "none";
        welcomeText1.style.position = "absolute";
        welcomeText1.style.fontSize = "80px";
        welcomeText1.style.marginTop = "125px";
        welcomeText1.style.marginLeft = "50px";
        welcomeUnderline.style.right = "0";
        welcomeUnderline.style.width = "0%";
        welcomeText2.style.display = "none";
        welcomeIcons.style.display = "none";
        setTimeout(() => {
            welcomeWindowInline.style.display = "block";
            setTimeout(() => {
                welcomeText1.style.transition = "0.25s cubic-bezier(0, 0, 1, 1)";
                welcomeText1.style.fontSize = "40px";
                welcomeText1.style.marginTop = "0px";
                welcomeText1.style.marginLeft = "0px";
            }, 500);
            setTimeout(() => {
                welcomeUnderline.style.transition = "0.25s cubic-bezier(0, 0, 1, 1)";
                welcomeUnderline.style.width = "100%";
                setTimeout(() => {
                    welcomeText2.style.display = "block";
                    welcomeIcons.style.display = "block";
                    nex.style.cursor = '';
                    if (!localStorage.getItem('start_nexser')) {
                        startNexser.style.display = "block";
                    } else {
                        startNexserClose.style.display = "block";
                    }
                }, 300);
            }, 1000);
        }, 250);
    }

    function welcome() {
        document.querySelector('.welcome_windows').style.display = "block"
        welcome_animation();
        startmenu_close();
    }

    startup_window_open()
    function startup_window_open() {
        const elements = [
            { key: 'startup_computer', selector: '.my_computer' },
            { key: 'startup_note', selector: '.note_pad' },
            { key: 'startup_color', selector: '.color_menu' },
            { key: 'startup_screen', selector: '.screen_text_menu' },
            { key: 'startup_htmlviewer_edit', selector: '.htmlviewer_edit_menu' },
            { key: 'startup_guidebook', selector: '.nexser_guidebook_menu' },
            { key: 'startup_objective', selector: '.objective_menu' },
            { key: 'startup_calendar', selector: '.calendar_menu' }
        ];
        elements.forEach(item => {
            if (localStorage.getItem(item.key)) {
                const element = document.querySelector(item.selector);
                element.classList.remove('active');
            }
        });
        titlecolor_set();
    }

    function nexser_signout() {
        startmenu_close()
        if (localStorage.getItem('password') && gets == gets2) {
            document.getElementsByClassName('welcome_windows')[0].style.display = "none";
            localStorage.removeItem('login');
            document.getElementById('desktop').style.display = "none";
            document.querySelector('#pass_form').focus();
            window_none();
            window_reset();
            document.querySelector('.pass_signin_menu').classList.remove('active')
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

    document.getElementById('sound_driver').addEventListener('click', function () {
        if (localStorage.getItem('driver_sound')) {
            localStorage.removeItem('driver_sound')
            document.querySelector('.installbutton_1').textContent = "install"
            document.querySelector('.startup_sound').textContent = "INSTALL"
            sound_stop()
        } else {
            localStorage.setItem('driver_sound', true);
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
            localStorage.setItem('driver_color', true);
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
            localStorage.setItem('startup_1', true);
            document.querySelector('.startup_1').textContent = "set!"
        }
    })
    document.querySelector('.startup_2').addEventListener('click', function () {
        startupsound_reset()
        if (localStorage.getItem('startup_2')) {
            document.querySelector('.startup_2').textContent = "no set"
        } else {
            localStorage.setItem('startup_2', true);
            document.querySelector('.startup_2').textContent = "set!"
        }
    })
    document.querySelector('.startup_3').addEventListener('click', function () {
        startupsound_reset()
        if (localStorage.getItem('startup_3')) {
            document.querySelector('.startup_3').textContent = "no set"
        } else {
            localStorage.setItem('startup_3', true);
            document.querySelector('.startup_3').textContent = "set!"
        }
    })
    document.querySelector('.startup_4').addEventListener('click', function () {
        startupsound_reset()
        if (localStorage.getItem('startup_4')) {
            document.querySelector('.startup_4').textContent = "no set"
        } else {
            localStorage.setItem('startup_4', true);
            document.querySelector('.startup_4').textContent = "set!"
        }
    })
    document.querySelector('.startup_5').addEventListener('click', function () {
        startupsound_reset()
        if (localStorage.getItem('startup_5')) {
            document.querySelector('.startup_5').textContent = "no set"
        } else {
            localStorage.setItem('startup_5', true);
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
            localStorage.setItem('shutdown_1', true);
            document.querySelector('.shutdown_1').textContent = "set!"
        }
    })
    document.querySelector('.shutdown_2').addEventListener('click', function () {
        shutdownsound_reset()
        if (localStorage.getItem('shutdown_2')) {
            document.querySelector('.shutdown_2').textContent = "no set"
        } else {
            localStorage.setItem('shutdown_2', true);
            document.querySelector('.shutdown_2').textContent = "set!"
        }
    })
    document.querySelector('.shutdown_3').addEventListener('click', function () {
        shutdownsound_reset()
        if (localStorage.getItem('shutdown_3')) {
            document.querySelector('.shutdown_3').textContent = "no set"
        } else {
            localStorage.setItem('shutdown_3', true);
            document.querySelector('.shutdown_3').textContent = "set!"
        }
    })
    document.querySelector('.shutdown_4').addEventListener('click', function () {
        shutdownsound_reset()
        if (localStorage.getItem('shutdown_4')) {
            document.querySelector('.shutdown_4').textContent = "no set"
        } else {
            localStorage.setItem('shutdown_4', true);
            document.querySelector('.shutdown_4').textContent = "set!"
        }
    })
    document.querySelector('.shutdown_5').addEventListener('click', function () {
        shutdownsound_reset()
        if (localStorage.getItem('shutdown_5')) {
            document.querySelector('.shutdown_5').textContent = "no set"
        } else {
            localStorage.setItem('shutdown_5', true);
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
            localStorage.removeItem('window_invisible');
            document.querySelector('.windowmode').textContent = "default"
        } else {
            windowmode_reset()
            localStorage.setItem('window_invisible', true);
            document.querySelector('.windowmode').textContent = "invisible"
        }
    })
    document.getElementById('window_borderblack').addEventListener('click', function () {
        if (localStorage.getItem('window_borderblack')) {
            localStorage.removeItem('window_borderblack');
            document.querySelector('.windowmode').textContent = "default"
        } else {
            windowmode_reset()
            localStorage.setItem('window_borderblack', true);
            document.querySelector('.windowmode').textContent = "border black"
        }
    })

    document.getElementById('backtext_on').addEventListener('click', function () {
        localStorage.setItem('backtext', true);
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
        localStorage.setItem('backtext_small', true);
        const backtext_data2 = localStorage.getItem('backtext_data');
        document.querySelector('#background_text').style.fontSize = "15px";
        document.querySelector('#background_text2').style.fontSize = "15px";
    })
    document.querySelector('.backtext_medium').addEventListener('click', function () {
        backtextSize_clear();
        localStorage.setItem('backtext_medium', true);
        const backtext_data2 = localStorage.getItem('backtext_data');
        document.querySelector('#background_text').style.fontSize = "30px";
        document.querySelector('#background_text2').style.fontSize = "30px";
    })
    document.querySelector('.backtext_large').addEventListener('click', function () {
        backtextSize_clear();
        localStorage.setItem('backtext_large', true);
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

    function window_reset() {
        document.querySelectorAll('.child_windows').forEach(function (allwindow) {
            allwindow.style.left = "";
            allwindow.style.top = "";
            allwindow.style.height = "";
            allwindow.style.width = "";
            const notearea = document.querySelector('.note_area');
            notearea.style.height = "";
            notearea.style.width = "";
            windowposition_reset();
            allwindow.classList.remove('leftwindow');
            allwindow.classList.remove('rightwindow');
            allwindow.style.transition = "";
            document.querySelector('.bigscreen_button').style.visibility = "visible";
            document.querySelector('.minscreen_button').style.visibility = "visible";
            document.querySelector('.minimization_button').style.visibility = "visible";
            allwindow.classList.remove('minimization');
            allwindow.classList.remove('selectwindows')
            test_windows_button();
        });

        bom_reset();
        timerstop();
        timerreset();
        cpubench_clear();
        cpubench_reset();
        prompt2_text_clear();
        calc_clear();
        preview2_stop();
        videourl_reset();
        resetGame();
        nexser_prompt_reset();
        document.querySelector('.password').value = "";
        document.querySelector('#pass_form').value = "";

    }
    function window_none() {
        document.querySelectorAll('.task_buttons').forEach(function (task_buttons) {
            task_buttons.remove()
        })

        document.querySelectorAll('.child_windows').forEach(function (allwindow_none) {
            allwindow_none.classList.add('active');
            allwindow_none.classList.remove('big');
            allwindow_none.classList.remove('rightwindow');
            allwindow_none.classList.remove('leftwindow');
            allwindow_none.classList.remove('selectwindows');
            allwindow_none.style.right = "";
            windowposition_reset()
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
        document.querySelectorAll('.title').forEach(function () {
            title.classList.add('center')
            localStorage.setItem('title_center', true)
        });
    }

    Array.from(document.getElementsByClassName('nexser_title_text')).forEach((nexser_title_text) => {
        const nexserTitle = document.querySelector('.nexser_title').textContent;
        nexser_title_text.textContent = nexserTitle;
    })

    function allStorage_clear() {
        const alllength = localStorage.length;
        if (alllength > 0) {
            if (sessionStorage.getItem('start_camera')) {
                stopCamera()
            }
            localStorage.clear();
            sessionStorage.clear();
            document.querySelector('.tests').textContent = (alllength);
            taskbar_active();
            document.querySelector('.test_allwindow').style.display = "block";
            warning_windows.style.display = "block";
            document.querySelector('.shutdown_button').style.display = "block";
            document.querySelector('.warningclose_button').style.display = "none";
            document.querySelector('.warning_title_text').textContent = "nexser";
            document.querySelector('.window_warning_text').textContent = "nexserのデータを全削除しました!　5秒後に再ロードします!";
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

    function taskbar_autohide() {
        const t = localStorage.getItem('taskbar_height');
        localStorage.setItem('taskbar_autohide', true);
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
                document.getElementById('taskbar').style.bottom = "-" + t2 + "px";
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

    function pageLoad() {
        let textbox = document.querySelector('.name');
        textbox.addEventListener('keydown', enterKeyPress);

        function enterKeyPress(event) {
            if (event.key === 'Enter') {
                butotnClick()
            }
        }
    }

    function butotnClick() {
        msg.innerText = '\b' + nameText.value + '';
        prompt_text_check();
    }

    function handleKeyDown(event, input) {
        if (event.key === 'Enter') {
            executeCommand(input);
        }
    }

    function executeCommand(input) {
        prompt_text_check2()
        // 入力フォームを無効化
        input.disabled = true;
        document.querySelector('.name2').classList.add('pointer_none');
        document.querySelector('.name2').classList.remove('name2');
        document.querySelector('.focus2').classList.remove('focus2');
        // 新しい入力フォームを生成
        const newInputContainer = document.createElement('div');
        newInputContainer.className = 'input_container';
        newInputContainer.classList.add('prompt_hukusei2');
        newInputContainer.innerHTML = `<span class="small">nexser/></span><textarea rows="1" class="command_input2 name2 focus2" placeholder="|" onkeydown="handleKeyDown(event, this)"></textarea>`;
        // 新しい入力フォームを追加
        document.getElementById('form_container').appendChild(newInputContainer);
        setTimeout(() => {
            document.getElementsByClassName('focus2')[0].focus()
        }, 0);
    }


    function executeCommand2() {
        const name = document.getElementsByClassName('focus2')[0].value;
        document.querySelector('.name2').classList.add('pointer_none');
        document.querySelector('.name2').classList.remove('name2');
        document.querySelector('.focus2').classList.remove('focus2');
        // 新しい入力フォームを生成
        const newInputContainer = document.createElement('div');
        newInputContainer.className = 'input_container';
        newInputContainer.classList.add('prompt_hukusei2');
        newInputContainer.innerHTML = `<textarea rows="1" class="command_input2 name2 focus2" style="color: red;" placeholder="|">${name} は操作可能なプログラムとして認識されていません。</textarea>`;
        // 新しい入力フォームを追加
        document.getElementById('form_container').appendChild(newInputContainer);
    }

    function commandarea_resize() {
        const textarea = document.querySelector('.focus2');
        textarea.addEventListener('input', () => {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        });
    }

    function nexser_prompt_reset() {
        setTimeout(() => {
            document.querySelectorAll('.prompt_hukusei2').forEach(function (prompt_hukusei2) {
                prompt_hukusei2.remove()
            })
            document.querySelector('.command2').classList.add('name2');
            document.querySelector('.command2').classList.add('focus2');
            document.querySelector('.command2').classList.remove('pointer_none');
            document.querySelector('.command2').disabled = false;
            document.getElementsByClassName('focus2')[0].focus()
            document.querySelector('.focus2').style.height = "";
            prompt2_text_clear();
            prompt_text2.style.color = "";
        }, 10);
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

        const prompt_text4 = document.getElementsByClassName('focus2')[0].value;
        const prompt_text5 = prompt_text4;

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
                localStorage.setItem('BKCOLOR', a);
                wallpaper_allremove()
                break;

            case command_2 + b:
                prompt_text2.style.color = "";
                document.querySelector('body').style.color = b;
                localStorage.setItem('COLOR', b);
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
                document.querySelector('#shell').value = result2;
                shellmenu_open()
                break;

            case command_6 + f:
                prompt_text2.style.color = "";
                document.querySelector('#shell').value = f;
                shellmenu_open()
                break;

            case command_7 + g:
                prompt_text2.style.color = "";
                const g2 = parseInt(g);
                document.querySelector('#shell').value = (g2.toString(2));
                shellmenu_open()
                break;

            case command_8 + h:
                prompt_text2.style.color = "";
                const h2 = parseInt(h, 2);
                document.querySelector('#shell').value = (h2.toString(10));
                shellmenu_open()
                break;

            case command_9 + i2:
                prompt_text2.style.color = "";

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

            case '':
                prompt_text2.style.color = "";
                break;

            case 'local/memory':
                prompt_text2.style.color = "";
                new Promise((resolve) => {
                    setTimeout(() => {
                        localmemory_size(),
                            resolve();
                    }, 0)
                    setTimeout(() => {
                        localstorage_details_menu.classList.remove('active');
                        localstorage_details_menu.style.zIndex = largestZIndex++;
                        resolve()
                    }, 2000);
                })
                break;

            case 'help':
                prompt_text2.style.color = "";
                command_help_menu.classList.remove('active');
                command_help_menu.style.zIndex = largestZIndex++;
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
                const data_taskbar_none = document.querySelector('.focus2').value;
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
                    document.querySelector('.window_error_text').textContent = "タスクバーが非表示のため、ウィンドウが閉じれません!"
                    error_windows.classList.remove('active')
                    prompt_text2.style.color = "";
                    document.querySelector('.test_allwindow').style.display = "block";
                    sound3()
                } else {
                    prompt_text2.style.color = "";
                    window_none()
                }
                break;
            case 'allwindow/open':
                prompt_text2.style.color = "";
                window_active();
                cpubench_open();
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
                const data_title_none = document.querySelector('.focus2').value;
                localStorage.setItem('data_title_none', data_title_none);
                prompt_text2.style.color = "";
                title_none()
                break;
            case 'title/active':
                localStorage.removeItem('data_title_none');
                prompt_text2.style.color = "";
                title_active()
                break;
            case 'cpu/bench':
                prompt_text2.style.color = "";
                cpu_bench_menu.classList.remove('active');
                cpubench_open();
                break;
            case 'nexser/data/clear':
                prompt_text2.style.color = "";
                allStorage_clear()
                setTimeout(() => {
                    window.location = '';
                }, 5000);
                break;
            case 'welcome':
                prompt_text2.style.color = "";
                welcome()
                break;
            case 'file/none':
                const file_none = document.querySelector('.focus2').value;
                localStorage.setItem('file_none', file_none);
                prompt_text2.style.color = "";
                document.querySelector('.files_inline').style.display = "none";
                break;
            case 'file/active':
                localStorage.removeItem('file_none');
                prompt_text2.style.color = "";
                document.querySelector('.files_inline').style.display = "flex";
                break;
            case 'page/20230528':
                prompt_text2.style.color = "";
                document.querySelector('.test_site_menu').classList.remove('active');
                test_site_menu.style.zIndex = largestZIndex++;
                break;
            case 'next/version/nexser':
                prompt_text2.style.color = "";
                nexser_nextversion_menu.classList.remove('active');
                nexser_nextversion_menu.style.zIndex = largestZIndex++;
                break;

            case 'startmenu(console(error))=>true':
                prompt_text2.style.color = "";
                localStorage.setItem('startmenu_console', prompt_text2);
                document.querySelector('.console_list').style.display = "block";
                break;
            case 'startmenu(console(error))=>false':
                prompt_text2.style.color = "";
                localStorage.removeItem('startmenu_console');
                document.querySelector('.console_list').style.display = "none";
                break;

            case 'reset':
                prompt_text2.style.color = "";
                nexser_prompt_reset()
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
                prompt_text2.style.color = "";
                executeCommand2()
                break;
        }
        titlecolor_set()
    }

    if (localStorage.getItem('startmenu_console')) {
        document.querySelector('.console_list').style.display = "block"
    }

    function shellmenu_open() {
        document.querySelectorAll('.prompt_shell_menu').forEach(function (prompt_shell_menu) {
            prompt_shell_menu.closest('.child_windows');
            prompt_shell_menu.classList.remove('active');
            prompt_shell_menu.style.zIndex = largestZIndex++;
        });
    }
    function shellmenu_close() {
        document.querySelectorAll('.prompt_shell_menu').forEach(function (prompt_shell_menu) {
            prompt_shell_menu.closest('.child_windows');
            document.getElementById('shell').value = "";
            document.getElementById('shell').textContent = "";
            document.getElementById('shell').innerHTML = "";
            prompt_shell_menu.classList.add('active');
            prompt_shell_menu.classList.remove('selectwindows');
            prompt_shell_menu.style.zIndex = largestZIndex++;
            test_windows_button()
        });
    }

    function prompt2_text_clear() {
        document.querySelectorAll('.focus2').forEach(function (focus2) {
            focus2.value = "";
        })
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
        if (screen_prompt.style.display == "block") {
            navigator.getBattery().then((battery) => {
                document.getElementsByClassName('level')[0].innerHTML = battery.level;
                document.getElementsByClassName('charging')[0].innerHTML = battery.charging;
                document.getElementsByClassName('chargingTime')[0].innerHTML = battery.chargingTime;
                document.getElementsByClassName('dischargingTime')[0].innerHTML = battery.dischargingTime;
            });
            const locallength = localStorage.length;
            document.getElementsByClassName('length_localStorage')[0].textContent = (locallength);
        } else {
            const locallength = localStorage.length;
            document.getElementsByClassName('tests')[0].textContent = (locallength);

            const backtext_data2 = localStorage.getItem('backtext_data');
            document.getElementById('background_text2').textContent = (backtext_data2)

            const get = document.getElementsByClassName('child_windows');
            const get2 = document.getElementsByClassName('active');
            const get3 = document.getElementsByClassName('task_buttons');
            gets = get.length;
            gets2 = get2.length - 1;
            gets3 = get3.length;
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
        }
    }, 100);

    document.querySelectorAll('.close_button').forEach(function (close_button) {
        close_button.addEventListener('click', function () {
            const closebutton_closest = close_button.closest('.child_windows');
            closebutton_closest.classList.add('active');
            closebutton_closest.classList.remove('selectwindows')
            test_windows_button()
        });
    })
    document.querySelectorAll('.close_button2').forEach(function (close_button2) {
        close_button2.addEventListener('click', function () {
            const closebutton2 = close_button2.closest('.error_windows');
            closebutton2.classList.add('active');
            document.querySelector('.test_allwindow').style.display = "none";
            document.getElementsByClassName('error_title_text')[0].textContent = "error";
            document.getElementsByClassName('error_icon')[0].style.display = "";
        });
    })
    document.querySelectorAll('.close_button3').forEach(function (close_button3) {
        close_button3.addEventListener('click', function () {
            const closebutton3 = close_button3.closest('.warning_windows');
            closebutton3.style.display = "none"
            document.querySelector('.test_allwindow').style.display = "none";
        });
    })

    document.querySelectorAll('.minimization_button').forEach(function (minimizationbutton) {
        const minimization_button = minimizationbutton.closest('.child_windows');
        minimizationbutton.addEventListener('click', function () {
            minimization_button.classList.remove('big');
            minimization_button.classList.add('minimization');
            minimization_button.style.height = "0px"
            minimization_button.style.width = "0px"
            minimization_button.scrollTop = 0;
            minimization_button.scrollLeft = 0;
        });
    })



    function addBigScreenButtonListeners(button) {
        if (!button.dataset.listenerAdded) {
            button.addEventListener('mousedown', function () {
                const elements = document.querySelector('.navy');
                const elements2 = elements.closest('.child_windows');
                elements2.dataset.originalWidth = elements2.style.width;
                elements2.dataset.originalHeight = elements2.style.height;
                elements2.dataset.originalTop = elements2.style.top;
                elements2.dataset.originalLeft = elements2.style.left;
            });
            button.addEventListener('click', function () {
                const bigscreenbutton = button.closest('.child_windows');
                bigscreenbutton.classList.remove('minimization');
                const childElements = bigscreenbutton.children;
                for (let child of childElements) {
                    child.style.display = 'none';
                    document.querySelectorAll('.title,.title_buttons').forEach(function (titles) {
                        titles.style.display = "block";
                    });
                    document.querySelectorAll('.title2').forEach(function (window_title2) {
                        window_title2.style.display = "flex";
                    });
                }
                const t = localStorage.getItem('taskbar_height');
                if (localStorage.getItem('data_taskbar_none')) {
                    bigscreenbutton.style.height = "";
                    bigscreenbutton.style.width = "";
                    bigscreenbutton.style.top = "0";
                    bigscreenbutton.style.left = "0";
                } else if (localStorage.getItem('taskbar_position_button')) {
                    bigscreenbutton.style.height = "";
                    bigscreenbutton.style.width = "";
                    bigscreenbutton.style.top = "40px";
                    bigscreenbutton.style.left = "0";
                    bigscreenbutton.style.top = t + "px";
                } else if (bigscreenbutton.classList.contains('rightwindow')) {
                    bigscreenbutton.style.height = "";
                    bigscreenbutton.style.width = "";
                    bigscreenbutton.style.top = "0";
                    bigscreenbutton.style.left = "";
                } else {
                    bigscreenbutton.style.height = "";
                    bigscreenbutton.style.width = "";
                    bigscreenbutton.style.top = "0";
                    bigscreenbutton.style.left = "0";
                }
                if (localStorage.getItem('window_animation')) {
                    bigscreenbutton.style.transition = "0.15s cubic-bezier(0, 0, 1, 1)";
                }
                bigscreenbutton.classList.remove('rightwindow');
                bigscreenbutton.classList.remove('leftwindow');
                setTimeout(() => {
                    bigscreenbutton.style.transition = "";
                    for (let child of childElements) {
                        child.style.display = '';
                    }
                    if (localStorage.getItem('allwindow_toolbar')) {
                        document.querySelectorAll('.window_tool').forEach(function (window_tool) {
                            window_tool.style.display = "block";
                        });
                    }
                }, 150);
                bigscreenbutton.classList.add('big');
                setTimeout(() => {
                    const task = document.getElementById('taskbar').clientHeight;
                    const child_windows_big2 = bigscreenbutton.clientHeight;
                    bigscreenbutton.style.height = child_windows_big2 - task + "px";
                }, 150);
            });
            button.dataset.listenerAdded = true;
        }
    }
    function observeNewElements() {
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) {
                            if (node.matches('.bigscreen_button')) {
                                addBigScreenButtonListeners(node);
                            }
                            if (node.matches('.child_windows')) {
                                node.querySelectorAll('.bigscreen_button').forEach(addBigScreenButtonListeners);
                            }
                        }
                    });
                }
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
    document.querySelectorAll('.bigscreen_button').forEach(addBigScreenButtonListeners);
    observeNewElements();




    function addMinScreenButtonListeners(button) {
        if (!button.dataset.listenerAdded) {
            button.addEventListener('click', function () {
                const minscreenbutton = button.closest('.child_windows');
                const childElements = minscreenbutton.children;
                for (let child of childElements) {
                    child.style.display = 'none';
                    document.querySelectorAll('.title,.title_buttons').forEach(function (titles) {
                        titles.style.display = "block";
                    });
                    document.querySelectorAll('.title2').forEach(function (window_title2) {
                        window_title2.style.display = "flex";
                    });
                }
                minscreenbutton.classList.remove('rightwindow');
                minscreenbutton.classList.remove('leftwindow');
                minscreenbutton.classList.remove('big');
                const elements = document.querySelector('.navy');
                const elements2 = elements.closest('.child_windows');
                elements2.style.width = elements2.dataset.originalWidth;
                elements2.style.height = elements2.dataset.originalHeight;
                elements2.style.top = elements2.dataset.originalTop;
                elements2.style.left = elements2.dataset.originalLeft;
                if (localStorage.getItem('window_animation')) {
                    minscreenbutton.style.transition = "0.15s cubic-bezier(0, 0, 1, 1)";
                }
                setTimeout(() => {
                    minscreenbutton.style.transition = "";
                    setTimeout(() => {
                        minscreenbutton.scrollTop = 0;
                        minscreenbutton.scrollLeft = 0;
                    }, 100);
                }, 150);
                setTimeout(() => {
                    for (let child of childElements) {
                        child.style.display = '';
                    }
                    if (localStorage.getItem('allwindow_toolbar')) {
                        document.querySelectorAll('.window_tool').forEach(function (window_tool) {
                            window_tool.style.display = "block";
                        });
                    }
                }, 150);
            });
            button.dataset.listenerAdded = true;
        }
    }
    function observeNewElements2() {
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) {
                            if (node.matches('.minscreen_button')) {
                                addMinScreenButtonListeners(node);
                            }
                            if (node.matches('.child_windows')) {
                                node.querySelectorAll('.minscreen_button').forEach(addMinScreenButtonListeners);
                            }
                        }
                    });
                }
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
    document.querySelectorAll('.minscreen_button').forEach(addMinScreenButtonListeners);
    observeNewElements2();




    function window_animation_true() {
        localStorage.setItem('window_animation', true);
    }
    function window_animation_false() {
        localStorage.removeItem('window_animation');
    }

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
            if (localStorage.getItem('window_animation')) {
                alliwindow_min.style.transition = "0.15s cubic-bezier(0, 0, 1, 1)"
            }
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
            } else {
                bigscreenbutton.style.height = ""
                bigscreenbutton.style.width = ""
                bigscreenbutton.style.top = "0"
                bigscreenbutton.style.left = "0"
            }
            if (localStorage.getItem('window_animation')) {
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
            } else if (localStorage.getItem('taskbar_position_button')) {
                windowleft.style.right = "auto";
                windowleft.style.top = "40px";
                windowleft.style.left = "0";
                windowleft.style.height = "100%";
                windowleft.style.width = "49.9%";
                windowleft.style.top = t + "px";
            } else {
                windowleft.style.right = "auto";
                windowleft.style.top = "0";
                windowleft.style.left = "0";
                windowleft.style.height = "100%";
                windowleft.style.width = "49.9%";
            }
            if (localStorage.getItem('window_animation')) {
                windowleft.style.transition = "0.15s cubic-bezier(0, 0, 1, 1)";
            }
            setTimeout(() => {
                windowleft.style.transition = "";
                titlecolor_set()
            }, 150);


            setTimeout(() => {
                const task = document.getElementById('taskbar').clientHeight;
                const child_windows_big2 = windowleft.clientHeight;
                windowleft.style.height = child_windows_big2 + - + task + "px"
            }, 150);

            windowleft.classList.remove('big');
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
            } else if (localStorage.getItem('taskbar_position_button')) {
                windowright.style.left = "";
                windowright.style.top = "40px";
                windowright.style.right = "0px";
                windowright.style.height = "100%";
                windowright.style.width = "49.9%";
                windowright.style.top = t + "px";
            } else {
                windowright.style.left = "";
                windowright.style.top = "0";
                windowright.style.right = "0px";
                windowright.style.height = "100%";
                windowright.style.width = "49.9%";
            }
            if (localStorage.getItem('window_animation')) {
                windowright.style.transition = "0.15s cubic-bezier(0, 0, 1, 1)";
            }
            setTimeout(() => {
                windowright.style.transition = "";
                titlecolor_set()
            }, 150);

            setTimeout(() => {
                const task = document.getElementById('taskbar').clientHeight;
                const child_windows_big2 = windowright.clientHeight;
                windowright.style.height = child_windows_big2 + - + task + "px"
            }, 150);

            windowright.classList.remove('big');
        });
    })

    document.querySelectorAll('.window_half_big').forEach(function (window_half_big) {
        window_half_big.addEventListener('mousedown', function () {
            const elements = document.querySelector('.title.navy');
            const elements2 = elements.closest('.child_windows');
            elements2.dataset.originalWidth = elements2.style.width;
            elements2.dataset.originalHeight = elements2.style.height;
            elements2.dataset.originalTop = elements2.style.top;
            elements2.dataset.originalLeft = elements2.style.left;
        })
        window_half_big.addEventListener('click', function () {
            const windowhalfbig = window_half_big.closest('.child_windows');

            windowhalfbig.classList.remove('rightwindow');
            windowhalfbig.classList.remove('leftwindow');

            let shiftX = event.clientX - window_half_big.getBoundingClientRect().left;
            let shiftY = event.clientY - window_half_big.getBoundingClientRect().top;
            let top = document.querySelector('.top');
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
            if (localStorage.getItem('window_animation')) {
                windowhalfbig.style.transition = "0.15s cubic-bezier(0, 0, 1, 1)"
            }
            setTimeout(() => {
                windowhalfbig.style.transition = ""
            }, 150);
            windowhalfbig.classList.remove('big')
        })
    })

    document.querySelectorAll('.windowsize_reset').forEach(function (windowsize_reset) {
        windowsize_reset.addEventListener('click', function () {
            const windowsizereset = windowsize_reset.closest('.child_windows');
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
            if (localStorage.getItem('window_animation')) {
                windowsizereset.style.transition = "0.15s cubic-bezier(0, 0, 1, 1)";
            }
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

    document.querySelectorAll('.parent_list').forEach(parent_list => {
        parent_list.addEventListener('mouseover', () => {
            const parentlist = parent_list.lastElementChild;
            parentlist.style.display = "flex";
            document.querySelectorAll('.windowtool_child').forEach(windowtool_child => {
                windowtool_child.style.display = "none";
            });
            document.querySelectorAll('.parent_list').forEach(c_list => {
                c_list.addEventListener('mouseleave', () => {
                    document.querySelectorAll('.child_list').forEach(cb_list => {
                        cb_list.style.display = "none";
                    });
                });
            });
        });
    });

    document.querySelectorAll('.windowtool_parent').forEach(windowtool_parent => {
        windowtool_parent.addEventListener('click', () => {
            const parentlist = windowtool_parent.lastElementChild;
            parentlist.style.display = (parentlist.style.display === "block") ? "none" : "block";
        });
    });

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
                    localStorage.setItem('allwindow_toolbar', true);
                    document.querySelectorAll('.window_inline_side').forEach(function (window_inline_side) {
                        window_inline_side.style.top = "31px"
                    })
                    document.querySelector('.clock_menu').style.height = ""
                }
            })
        })
    })

    document.querySelectorAll('.clockdata_analog').forEach(clockdata_analog => {
        clockdata_analog.addEventListener('click', () => {
            localStorage.setItem('clockdata_analog', true);
            document.getElementsByClassName('digital_clock_area')[0].style.display = "none";
            document.getElementsByClassName('analog_clock_area')[0].style.display = "block";
        });
    });
    document.querySelectorAll('.clockdata_digital').forEach(clockdata_digital => {
        clockdata_digital.addEventListener('click', () => {
            localStorage.removeItem('clockdata_analog');
            document.getElementsByClassName('digital_clock_area')[0].style.display = "flex";
            document.getElementsByClassName('analog_clock_area')[0].style.display = "none";
        });
    });

    Array.from(document.getElementsByClassName('desktop_files')).forEach(desktop_files => {
        desktop_files.addEventListener('mousedown', () => {
            Array.from(document.getElementsByClassName('desktop_files')).forEach(df1 => {
                df1.firstElementChild.classList.remove('file_select');
            });
        });
        desktop_files.addEventListener('click', () => {
            desktop_files.firstElementChild.classList.add('file_select');
        });
    });

    document.querySelectorAll('.parent_start_menu_lists').forEach(parent_startmenu_lists => {
        parent_startmenu_lists.addEventListener('mouseover', () => {
            parent_startmenu_lists.lastElementChild.style.display = "block";
        });
        parent_startmenu_lists.addEventListener('mouseleave', () => {
            document.querySelectorAll('.child_start_menu_lists, .child_start_menu_lists2, .child_start_menu_lists3').forEach(child_startmenu_lists => {
                child_startmenu_lists.style.display = "none";
            });
        });
    });
    document.querySelectorAll('.child_start_menu_lists').forEach(child_startmenu_lists => {
        child_startmenu_lists.addEventListener('mouseover', () => {
            child_startmenu_lists.lastElementChild.style.display = "block";
        });
        child_startmenu_lists.addEventListener('mouseleave', () => {
            document.querySelectorAll('.child_start_menu_lists, .child_start_menu_lists2').forEach(child_startmenu_lists2 => {
                child_startmenu_lists2.style.display = "none";
            });
        });
    });
    document.querySelectorAll('.child_start_menu_lists2').forEach(child_startmenu_lists => {
        child_startmenu_lists.addEventListener('mouseover', () => {
            child_startmenu_lists.lastElementChild.style.display = "block";
        });
        child_startmenu_lists.addEventListener('mouseleave', () => {
            document.querySelectorAll('.child_start_menu_lists, .child_start_menu_lists2, .child_start_menu_lists3').forEach(child_startmenu_lists2 => {
                child_startmenu_lists2.style.display = "none";
            });
        });
    });

    document.querySelectorAll('.window_inline_menus_parent').forEach(parent_list => {
        parent_list.addEventListener('mousedown', () => {
            document.querySelectorAll('.menuparent1').forEach(menuparent1 => {
                menuparent1.classList.remove('menuparent1');
            });
            document.querySelectorAll('.menuchild1').forEach(menuchild1 => {
                menuchild1.classList.remove('menuchild1');
            });
            document.querySelectorAll('.window_inline_menus_parent').forEach(parent_list2 => {
                parent_list2.classList.remove('select');
            });
            parent_list.classList.add('select');

            document.querySelectorAll('.window_inline_menus_parent').forEach(parent_list3 => {
                const menus_child = parent_list3.lastElementChild;
                menus_child.style.display = "none";
            });
        });
    });
    document.querySelectorAll('.window_inline_menus_parent').forEach(parent_list4 => {
        parent_list4.addEventListener('mousedown', () => {
            const menus_child2 = parent_list4.lastElementChild;
            menus_child2.style.display = "block";
        });
    });
    document.querySelectorAll('.menuchild1').forEach(menuchild1 => {
        menuchild1.style.display = "block";
    });

    function window_back_silver() {
        Array.from(document.getElementsByClassName('back_silver')).forEach((back_silver) => {
            back_silver.style.background = "silver"
        })
    }

    document.querySelectorAll('.child_windows, .child').forEach(function (z_index_child_windows) {
        const zindexchildwindows = z_index_child_windows.closest('.child_windows');
        z_index_child_windows.addEventListener('mousedown', function () {
            zindexchildwindows.scrollTop = 0;
            zindexchildwindows.scrollLeft = 0;
            window_z_index = zindexchildwindows.style.zIndex = largestZIndex++;
            zindexwindow_addnavy();
            titlecolor_set();
            rectangle_remove();
        });
        z_index_child_windows.addEventListener('click', function () {
            zindexchildwindows.scrollTop = 0;
            zindexchildwindows.scrollLeft = 0;
            titlecolor_set()
        })
        z_index_child_windows.addEventListener('dblclick', function () {
            if (zindexchildwindows.classList.contains('minimization')) {
                zindexchildwindows.classList.remove('minimization');
                zindexchildwindows.style.width = ""
                zindexchildwindows.style.height = ""
            }
        })
    })

    document.querySelectorAll('.window_prompt, .child').forEach(window_prompt => {
        window_prompt.addEventListener('mouseup', () => {
            document.querySelector('.focus2').focus();
        });
    });

    function title_navyreomve() {
        document.querySelectorAll('.navy').forEach(wt => {
            wt.classList.remove('navy');
        })
    }

    document.querySelectorAll('.nexser_search').forEach(nexser_search => {
        nexser_search.addEventListener('click', () => {
            nexser_search_menu.classList.toggle('active');
            nexser_search_menu.style.zIndex = largestZIndex++;
        })
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

    function search_clear() {
        document.getElementById('myInput').value = "";
    }





















    document.querySelectorAll('.nexser_guidebook').forEach(nexser_guidebook =>
        nexser_guidebook.addEventListener('click', () => {
            nexser_guidebook_menu.classList.toggle('active');
            nexser_guidebook_menu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.guidebook_window').forEach(guidebook_window =>
        guidebook_window.addEventListener('click', () => {
            guidebook_window_menu.classList.toggle('active');
            guidebook_window_menu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.guidebook_file').forEach(guidebook_file =>
        guidebook_file.addEventListener('click', () => {
            guidebook_file_menu.classList.toggle('active');
            guidebook_file_menu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.guidebook_taskbar').forEach(guidebook_taskbar =>
        guidebook_taskbar.addEventListener('click', () => {
            guidebook_taskbar_menu.classList.toggle('active');
            guidebook_taskbar_menu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.passmenu_button').forEach(passmenu_button =>
        passmenu_button.addEventListener('click', () => {
            password_menu.classList.toggle('active');
            password_menu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.localstorage_details').forEach(localstorage_details =>
        localstorage_details.addEventListener('click', () => {
            localstorage_details_menu.classList.toggle('active');
            localstorage_details_menu.style.zIndex = largestZIndex++;
        })
    );

    document.querySelectorAll('.console_error_btn').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            console_error_menu.classList.toggle('active');
            console_error_menu.style.zIndex = largestZIndex++;
        })
    );

    document.querySelectorAll('.kakeibo_btn').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            kakeibo_menu.classList.toggle('active');
            kakeibo_menu.style.zIndex = largestZIndex++;
        })
    );

    document.querySelectorAll('.document_button').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            mydocument_menu.classList.toggle('active');
            mydocument_menu.style.zIndex = largestZIndex++;
        })
    );

    document.querySelectorAll('.test_button').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            main.classList.toggle('active');
            main.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.test_button2').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            my_computer.classList.toggle('active');
            my_computer.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.test_button3').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            control.classList.toggle('active');
            control.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.test_button4').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            color_menu.classList.toggle('active');
            color_menu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.test_button5').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            system_menu.classList.toggle('active');
            system_menu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.test_button6').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            window_prompt.classList.toggle('active');
            window_prompt.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.test_button7').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            clock_menu.classList.toggle('active');
            clock_menu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.test_button8').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            sound_menu.classList.toggle('active');
            sound_menu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.test_button9').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            driver_menu.classList.toggle('active');
            driver_menu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.test_button10').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            mouse_menu.classList.toggle('active');
            mouse_menu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.test_button11').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            screen_text_menu.classList.toggle('active');
            screen_text_menu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.test_button12').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            note_pad.classList.toggle('active');
            note_pad.style.zIndex = largestZIndex++;
            resizeTextarea();
        })
    );
    document.querySelectorAll('.test_button13').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            text_drop_menu.classList.toggle('active');
            text_drop_menu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.test_button14').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            windowmode_menu.classList.toggle('active');
            windowmode_menu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.test_button15').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            accessory_menu.classList.toggle('active');
            accessory_menu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.test_button16').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            calc_menu.classList.toggle('active');
            calc_menu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.test_button17').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            nexser_sound_menu.classList.toggle('active');
            nexser_sound_menu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.test_button18').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            camera_menu.classList.toggle('active');
            camera_menu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.test_button19').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            htmlviewer_edit_menu.classList.toggle('active');
            htmlviewer_edit_menu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.test_button20').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            htmlviewer_run_menu.classList.toggle('active');
            htmlviewer_run_menu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.test_button21').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            uploadvideo_menu.classList.toggle('active');
            uploadvideo_menu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.test_button22').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            font_menu.classList.toggle('active');
            font_menu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.test_button23').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            file_setting_menu.classList.toggle('active');
            file_setting_menu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.test_button24').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            debug_menu.classList.toggle('active');
            debug_menu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.test_button25').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            file_download_menu.classList.toggle('active');
            file_download_menu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.test_button26').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            display_menu.classList.toggle('active');
            display_menu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.test_button27').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            stopwatch_menu.classList.toggle('active');
            stopwatch_menu.style.zIndex = largestZIndex++;
            timerreset()
        })
    );
    document.querySelectorAll('.test_button28').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            comment_menu.classList.toggle('active');
            comment_menu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.test_button30').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            objective_menu.classList.toggle('active');
            objective_menu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.test_button31').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            calendar_menu.classList.toggle('active');
            calendar_menu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.test_button32').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            cpu_bench_menu.classList.toggle('active');
            cpu_bench_menu.style.zIndex = largestZIndex++;
            cpubench_open();
        })
    );
    document.querySelectorAll('.test_button33').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            browser_menu.classList.toggle('active');
            browser_menu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.test_button35').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            taskbar_setting_menu.classList.toggle('active');
            taskbar_setting_menu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.test_button36').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            youtubevideo_menu.classList.toggle('active');
            youtubevideo_menu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.test_button37').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            device_menu.classList.toggle('active');
            device_menu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.test_button38').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            omikuji_menu.classList.toggle('active');
            omikuji_menu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.test_button39').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            localstorage_monitor_menu.classList.toggle('active');
            localstorage_monitor_menu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.test_button40').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            paint_menu.classList.toggle('active');
            paint_menu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.test_button42').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            nexser_files_menu.classList.toggle('active');
            nexser_files_menu.style.zIndex = largestZIndex++;
            setTimeout(() => {
                nexser_files_output_remove()
                nexser_files_windowload()
            }, 100);
        })
    );
    document.querySelectorAll('.test_button43').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            url_drop_menu.classList.toggle('active');
            url_drop_menu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.test_button45').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            alarm_menu.classList.toggle('active');
            alarm_menu.style.zIndex = largestZIndex++;
        })
    );


    // games

    document.querySelectorAll('.test_button29').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            tetris_mneu.classList.toggle('active');
            tetris_mneu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.test_button34').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            bom_menu.classList.toggle('active');
            bom_menu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.test_button41').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            othello_menu.classList.toggle('active');
            othello_menu.style.zIndex = largestZIndex++;
        })
    );
    document.querySelectorAll('.test_button44').forEach(testbtn =>
        testbtn.addEventListener('click', () => {
            memory_game_menu.classList.toggle('active');
            memory_game_menu.style.zIndex = largestZIndex++;
        })
    );





    function cpubench_open() {
        const cpumenu1 = document.querySelector('.cpumenu_1');
        document.getElementsByClassName('cpu_bench_menu')[0].style.zIndex = largestZIndex++;
        if (!cpu_bench_menu.classList.contains('active') || cpumenu1.style.display == "block") {
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

    function cpubench_reset() {
        setTimeout(() => {
            document.querySelector('.cpumenu_1').style.display = "block";
            document.querySelector('.cpumenu_2').style.display = "none";
            document.querySelector('.cpubuttons').style.display = "none";
            document.querySelector('.cputitle').style.display = "none";
        }, 100);
    }



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
            if (!ele2.classList.contains('selectwindows')) {
                document.querySelectorAll('.task_buttons').forEach(function (task_butttons) {
                    task_butttons.remove()
                })
                ele2.classList.add('selectwindows')
                test_windows_button()
            }
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
        startmenu_close();
        title_navyreomve();
        assignClassToFrontmostElement('child_windows:not(.active)', 'navy');
        titlecolor_set();
        allwindow_resize();
        document.querySelectorAll('.bigscreen_button').forEach(element => {
            if (!element.querySelector('.bigscreen_button_child')) {
                const newChild = document.createElement('div');
                newChild.className = 'bigscreen_button_child';
                element.appendChild(newChild);
            }
        });
        Array.from(document.getElementsByClassName('button')).forEach(addButtonListeners2);
        Array.from(document.getElementsByClassName('button2')).forEach(addButtonListeners);
    }

    const note_parent = document.querySelector('.note_pad');
    const note_child = document.getElementById('note_text');
    const resizeTextarea = () => {
        const hehehe1 = note_parent.firstElementChild;
        if (hehehe1.classList.contains('navy')) {
            note_child.style.width = `${note_parent.clientWidth + - + 5}px`;
            note_child.style.height = `${note_parent.clientHeight + - + 105}px`;
            document.querySelector('.note_area').focus()
            displayCursorPos()
        }
    };

    const youtubeframe_parent = document.querySelector('.youtubevideo_menu');
    const youtubeframe_child = document.getElementById('youtubeframe');
    const youtubeframe_resize = () => {
        youtubeframe_child.style.width = `${youtubeframe_parent.clientWidth}px`;
        youtubeframe_child.style.height = `${youtubeframe_parent.clientHeight + - + 50}px`;
    };

    const cameraframe_parent = document.querySelector('.camera_menu');
    const cameraframe_child = document.getElementById('v');
    const cameraframe_resize = () => {
        cameraframe_child.style.width = `${cameraframe_parent.clientWidth}px`;
        cameraframe_child.style.height = `${cameraframe_parent.clientHeight + - + 85}px`;
    };

    const url_drop_parent = document.querySelector('.url_drop_menu');
    const url_drop_child = document.querySelector('.url_drop_area');
    const url_drop_resize = () => {
        url_drop_child.style.width = `${url_drop_parent.clientWidth}px`;
        url_drop_child.style.height = `${url_drop_parent.clientHeight + - + 55}px`;
    };

    const objective_parent = document.querySelector('.objective_menu');
    const objective_child = document.querySelector('.objective_area');
    const objective_resize = () => {
        objective_child.style.width = `${objective_parent.clientWidth + - + 5}px`;
        objective_child.style.height = `${objective_parent.clientHeight + - + 160}px`;
    };

    const window_prompt_content2 = document.querySelector('.window_prompt_content2');
    const window_prompt_resize = () => {
        window_prompt_content2.style.width = `${window_prompt.clientWidth}px`;
        window_prompt_content2.style.height = `${window_prompt.clientHeight + - + 50}px`;
    };

    const shell_parent = document.querySelector('.prompt_shell_menu');
    const shell_child = document.querySelector('#shell');
    const shell_resize = () => {
        shell_child.style.width = `${shell_parent.clientWidth}px`;
        shell_child.style.height = `${shell_parent.clientHeight + - + 30}px`;
    };

    const test_site_parent = document.querySelector('.test_site_menu');
    const test_site_child = document.querySelector('.site_frame');
    const test_site_resize = () => {
        test_site_child.style.width = `${test_site_parent.clientWidth}px`;
        test_site_child.style.height = `${test_site_parent.clientHeight + - + 30}px`;
    };

    const background_image_parent = document.getElementById('nexser');
    const background_image_child = document.querySelector('.nexser_background_image');
    const background_image_child2 = background_image_child.children;

    const resize_background_image = () => {
        for (let i = 0; i < background_image_child2.length; i++) {
            background_image_child2[i].style.width = `${background_image_parent.clientWidth}px`;
            background_image_child2[i].style.height = `${background_image_parent.clientHeight}px`;
        }
    };

    const nexser_nextversion_parent = document.querySelector('.nexser_nextversion_menu');
    const nexser_nextversion_child = document.querySelector('.nexser_nextframe');
    const nexser_nextversion_resize = () => {
        const hehehe1 = nexser_nextversion_parent.firstElementChild;
        if (hehehe1.classList.contains('navy')) {
            nexser_nextversion_child.style.width = `${nexser_nextversion_parent.clientWidth + - + 0}px`;
            nexser_nextversion_child.style.height = `${nexser_nextversion_parent.clientHeight + - + 20}px`;
        }
    };

    const htmlview_parent = document.querySelector('.htmlviewer_run_menu');
    const htmlview_child = document.querySelector('.html_view');
    const htmlview_resize = () => {
        const hehehe1 = htmlview_parent.firstElementChild;
        if (hehehe1.classList.contains('navy')) {
            htmlview_child.style.width = `${htmlview_parent.clientWidth + - + 0}px`;
            htmlview_child.style.height = `${htmlview_parent.clientHeight + - + 20}px`;
        }
    };

    const htmlview_parent2 = document.querySelector('.htmlviewer_edit_menu');
    const htmlview_child2 = document.querySelector('#editor');
    const htmlview_resize2 = () => {
        const hehehe1 = htmlview_parent2.firstElementChild;
        if (hehehe1.classList.contains('navy')) {
            htmlview_child2.style.width = `${htmlview_parent2.clientWidth + - + 5}px`;
            htmlview_child2.style.height = `${htmlview_parent2.clientHeight + - + 65}px`;
        }
    };



    function addDragButtonListeners(button) {
        if (!button.dataset.listenerAdded) {
            button.addEventListener('mousedown', function () {
                const dragwindow = button.closest('.child_windows');
                if (dragwindow.classList.contains('leftwindow')) {
                    dragwindow.style.height = "55%";
                    dragwindow.style.width = "55%";
                    dragwindow.classList.remove('leftwindow');
                    if (localStorage.getItem('window_animation')) {
                        dragwindow.style.transition = "0.15s cubic-bezier(0, 0, 1, 1)";
                    }
                }
                if (dragwindow.classList.contains('rightwindow')) {
                    dragwindow.style.height = "55%";
                    dragwindow.style.width = "55%";
                    dragwindow.classList.remove('rightwindow');
                    if (localStorage.getItem('window_animation')) {
                        dragwindow.style.transition = "0.15s cubic-bezier(0, 0, 1, 1)";
                    }
                }
                setTimeout(() => {
                    dragwindow.style.transition = "";
                }, 150);
            });
            let drag2 = button.closest('.child_windows');
            var x, y;
            button.addEventListener("mousedown", mdown, { passive: false }, false);
            button.addEventListener("touchstart", mdown, { passive: false }, false);
            function mdown(e) {
                drag2.classList.add("drag");
                var event = e.type === "mousedown" ? e : e.changedTouches[0];
                x = event.pageX - drag2.offsetLeft;
                y = event.pageY - drag2.offsetTop;
                document.body.addEventListener("mousemove", mmove, { passive: false }, false);
                document.body.addEventListener("touchmove", mmove, { passive: false }, false);
            }
            function mmove(e) {
                var drag = document.getElementsByClassName("drag")[0];
                var event = e.type === "mousemove" ? e : e.changedTouches[0];
                rectangle_remove();
                drag.style.top = event.pageY - y + "px";
                drag.style.left = event.pageX - x + "px";
                drag.addEventListener("mouseup", mup, false);
                document.body.addEventListener("mouseleave", mup, false);
                drag.addEventListener("touchend", mup, false);
                document.body.addEventListener("touchleave", mup, false);
                if (localStorage.getItem('window_invisible')) {
                    document.querySelectorAll('.child_windows').forEach(function (title) {
                        title.style.opacity = "0.5";
                    });
                }
                if (localStorage.getItem('window_borderblack')) {
                    document.querySelectorAll('.child_windows, .child').forEach(function (title) {
                        document.querySelector('iframe').style.opacity = "0";
                        title.style.background = "rgba(255, 255, 255, 0)";
                        title.style.border = "solid 2px black";
                    });
                    document.querySelectorAll('.title,.title2,.title_buttons,.window_tool,.window_contents,.window_content,.window_bottom,.prompt_content').forEach(function (title) {
                        title.style.opacity = "0";
                    });
                }
            }
            function mup(e) {
                document.querySelectorAll('.drag').forEach(function (drag_windows) {
                    drag_windows.classList.remove("drag");
                });
                document.body.removeEventListener("mousemove", mmove, false);
                button.removeEventListener("mouseup", mup, false);
                document.body.removeEventListener("touchmove", { passive: false }, mmove, false);
                button.removeEventListener("touchend", { passive: false }, mup, false);
                document.querySelectorAll('.child_windows').forEach(function (title) {
                    title.style.opacity = "";
                    window_prompt.style.background = "black";
                    window_back_silver();
                });
                document.querySelectorAll('.child_windows, .child').forEach(function (title) {
                    title.style.background = "";
                    title.style.border = "";
                    document.querySelector('iframe').style.opacity = "";
                    window_prompt.style.background = "black";
                    window_back_silver();
                });
                document.querySelectorAll('.title,.title2,.title_buttons,.window_tool,.window_contents,.window_content,.window_bottom,.prompt_content').forEach(function (title) {
                    title.style.opacity = "";
                    window_back_silver();
                });
                titlecolor_set();
            }
            button.dataset.listenerAdded = true;
        }
    }
    function observeNewElements3() {
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) {
                            if (node.matches('.drag_button')) {
                                addDragButtonListeners(node);
                            }
                            if (node.matches('.child_windows')) {
                                node.querySelectorAll('.drag_button').forEach(addDragButtonListeners);
                            }
                        }
                    });
                }
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
    document.querySelectorAll('.drag_button').forEach(addDragButtonListeners);
    observeNewElements3();



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
            rectangle_remove();
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

    document.querySelector('.toolbar_on').addEventListener('click', () => {
        localStorage.setItem('toolbar_on', true);
        toolbar.style.display = "block";
    });
    document.querySelector('.toolbar_off').addEventListener('click', () => {
        localStorage.removeItem('toolbar_on');
        toolbar.style.display = "none";
    });

    document.querySelector('.filettext_backcolor_off').addEventListener('click', () => {
        localStorage.setItem('filettext_backcolor_off', true);
        filettext_backcolor();
    });
    document.querySelector('.filettext_backcolor_on').addEventListener('click', () => {
        localStorage.removeItem('filettext_backcolor_off');
        filettext_backcolor();
    });

    document.querySelector('.saver_on').addEventListener('click', function () {
        localStorage.setItem('saver_on', true);
        document.querySelector('.saver_mode').textContent = "ON"
    })
    document.querySelector('.saver_off').addEventListener('click', function () {
        localStorage.removeItem('saver_on');
        document.querySelector('.saver_mode').textContent = "OFF"
    })

    document.querySelector('.display_old').addEventListener('click', () => {
        localStorage.setItem('display_old', true);
        old_screen();
        resize_background_image();
    });
    document.querySelector('.display_now').addEventListener('click', () => {
        localStorage.removeItem('display_old');
        old_screen_reset();
        resize_background_image();
    });

    document.querySelector('.list_shadow_on').addEventListener('click', () => {
        localStorage.setItem('list_shadow_on', true);
        list_shadow();
    });
    document.querySelector('.list_shadow_off').addEventListener('click', () => {
        localStorage.removeItem('list_shadow_on');
        list_shadow_reset();
    });


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
            document.querySelector('.window_error_text').textContent = "カラードライバーがインストールされていません!"
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
            document.querySelector('.window_error_text').textContent = "カラードライバーがインストールされていません!"
            error_windows.classList.remove('active')
            prompt_text2.style.color = "";
            document.querySelector('.test_allwindow').style.display = "block";
            sound3()
        }
    });

    const colorBtns = document.querySelectorAll('.color_btn');
    const titles = document.querySelectorAll('.title');
    const navies = document.querySelectorAll('.navy');
    const errorText = document.querySelector('.window_error_text');
    const testAllWindow = document.querySelector('.test_allwindow');

    colorBtns.forEach(color_btn => {
        color_btn.addEventListener('click', () => {
            titlecolor_remove();
            if (localStorage.getItem('driver_color')) {
                titlecolor_set();
            } else {
                errorText.textContent = "カラードライバーがインストールされていません!";
                error_windows.classList.remove('active');
                testAllWindow.style.display = "block";
                sound3();
            }
            titles.forEach(title => title.style.background = "");
            navies.forEach(navy => navy.style.background = "");
        });
    });


    function titlecolor_remove() {
        document.querySelectorAll('.title, .navy').forEach(el => el.style.background = "");
        ['titlebar_red', 'titlebar_blue', 'titlebar_green', 'titlebar_yellow', 'titlebar_orange', 'titlebar_pink', 'titlebar_purple', 'titlebar_black', 'titlebar_teal', 'titlebar_new'].forEach(item => localStorage.removeItem(item));
    }

    ['red', 'blue', 'green', 'yellow', 'orange', 'pink', 'purple', 'black', 'teal', 'new'].forEach(color => {
        document.querySelector(`.titlebar_${color}`).addEventListener('click', () => {
            localStorage.setItem(`titlebar_${color}`, `titlebar_${color}`);
        });
    });


    function titlecolor_set() {
        const colors = {
            titlebar_red: ["#440000", "red"],
            titlebar_blue: ["#000044", "blue"],
            titlebar_green: ["#004400", "green"],
            titlebar_yellow: ["#FFFFAA", "yellow"],
            titlebar_orange: ["#FFAD90", "orange"],
            titlebar_pink: ["#FF00FF", "pink"],
            titlebar_purple: ["#5507FF", "purple"],
            titlebar_black: ["#555555", "black"],
            titlebar_teal: ["#483D8B", "teal"],
            titlebar_new: ["linear-gradient(to right, #5b5b5b, #C0C0C0)", "linear-gradient(to right, #02175e, #A3C1E2)"]
        }
        const driverColor = localStorage.getItem('driver_color');
        if (driverColor) {
            Object.entries(colors).forEach(([key, [bgColor, navyColor]]) => {
                if (localStorage.getItem(key)) {
                    document.querySelectorAll('.title').forEach(title => {
                        title.style.background = bgColor;
                    });
                    document.querySelectorAll('.navy').forEach(navy => {
                        navy.style.background = navyColor;
                    });
                }
            });
        }
    }

    document.querySelectorAll('.wallpaper_allremove_btn').forEach(wallpaper_allremove_btn => {
        wallpaper_allremove_btn.addEventListener('click', () => {
            wallpaper_allremove();
        });
    });

    document.querySelectorAll('.pattern_btn').forEach(color_btn => {
        color_btn.addEventListener('click', () => {
            back_pattern_remove();
            wallpaper_allremove();
        });
    });

    const back_pattern_remove = () => {
        for (let i = 1; i <= 9; i++) {
            document.querySelector(`.backgrounds${i}`).style.display = "none";
            localStorage.removeItem(`back_pattern_${i}`);
        }
    };

    const setBackPattern = (pattern) => {
        localStorage.setItem(pattern, true);
        back_pattern_set();
    };

    document.querySelector('.back_pattern_1').addEventListener('click', () => setBackPattern('back_pattern_1'));
    document.querySelector('.back_pattern_2').addEventListener('click', () => setBackPattern('back_pattern_2'));
    document.querySelector('.back_pattern_3').addEventListener('click', () => setBackPattern('back_pattern_3'));
    document.querySelector('.back_pattern_4').addEventListener('click', () => setBackPattern('back_pattern_4'));
    document.querySelector('.back_pattern_5').addEventListener('click', () => setBackPattern('back_pattern_5'));
    document.querySelector('.back_pattern_6').addEventListener('click', () => setBackPattern('back_pattern_6'));
    document.querySelector('.back_pattern_7').addEventListener('click', () => setBackPattern('back_pattern_7'));
    document.querySelector('.back_pattern_8').addEventListener('click', () => setBackPattern('back_pattern_8'));
    document.querySelector('.back_pattern_9').addEventListener('click', () => setBackPattern('back_pattern_9'));

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
        localStorage.setItem('note_textcolor_blue', true);
        notecolor_change()
    }
    function notecolor_change_green() {
        notecolor_remove()
        localStorage.setItem('note_textcolor_green', true);
        notecolor_change()
    }
    function notecolor_change_red() {
        notecolor_remove()
        localStorage.setItem('note_textcolor_red', true);
        notecolor_change()
    }
    function notecolor_change_orange() {
        notecolor_remove()
        localStorage.setItem('note_textcolor_orange', true);
        notecolor_change()
    }
    function notecolor_change_yellow() {
        notecolor_remove()
        localStorage.setItem('note_textcolor_yellow', true);
        notecolor_change()
    }
    function notecolor_change() {
        const colors = ['blue', 'green', 'red', 'orange', 'yellow'];
        colors.forEach(color => {
            if (localStorage.getItem(`note_textcolor_${color}`)) {
                document.querySelectorAll('.note_area, .test_notetext').forEach(el => el.style.color = color);
            }
        });
    }
    function notecolor_remove() {
        const colors = ['blue', 'green', 'red', 'orange', 'yellow'];
        colors.forEach(color => localStorage.removeItem(`note_textcolor_${color}`));
        document.querySelectorAll('.note_area, .test_notetext').forEach(el => el.style.color = "");
        notetitle();
    }

    function notetext_all_bold() {
        var Note = document.querySelector('.note_area');
        localStorage.setItem('note_text_bold', true);
        notetitle();
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
        localStorage.setItem('note_text_oblique', true);
        notetitle();
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
        localStorage.setItem('note_text_underline', true);
        notetitle();
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

    function notetext_small() {
        notetext_reset();
        localStorage.setItem('notetext_small', true);
        notetextsize_change()
        notetitle()
    }
    function notetext_medium() {
        notetext_reset();
        localStorage.setItem('notetext_medium', true);
        notetextsize_change()
        notetitle()
    }
    function notetext_large() {
        notetext_reset();
        localStorage.setItem('notetext_large', true);
        notetextsize_change()
        notetitle()
    }

    // 保存
    function save() {
        if (note_form.note_area.value === "") {
            document.querySelector('.window_error_text').textContent = "テキストが無いため、保存できません!"
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
        if (!objective_title_form.objective_title_area.value == "" && !objective_form.objective_area.value == "") {
            let objectiveTitleData = document.objective_title_form.objective_title_area.value;
            localStorage.setItem('objectiveTitleData', objectiveTitleData);
            let objectiveData = document.objective_form.objective_area.value;
            localStorage.setItem('objectiveData', objectiveData);
            localStorage.removeItem('objective_area');
            document.querySelector('.objective_title').textContent = "objective sheet(save)";
        }
    }
    if (localStorage.getItem('objectiveTitleData') && localStorage.getItem('objectiveData')) {
        document.querySelector('.objective_title').textContent = "objective sheet(save keep)";
    }

    document.querySelector('.note_close').addEventListener('click', function () {
        if (!localStorage.getItem('noteData')) {
            document.querySelector('.note_title').textContent = "notepad";
        }
        if (!note_pad.classList.contains('active') && localStorage.getItem('noteData') && !localStorage.getItem('note_texts')) {
            note_pad.classList.add('active');
            note_pad.classList.remove('selectwindows')
            test_windows_button()
        } else if (localStorage.getItem('note_texts')) {
            document.querySelector('.warning_title_text').textContent = "notepad"
            document.querySelector('.window_warning_text').textContent = "編集中です。ウィンドウを終了しますか?(内容は破棄されます)"
            warning_windows.style.display = "block"
            document.querySelector('.close_button3').style.display = "block"
            sound5()
            document.querySelector('.test_allwindow').style.display = "block";
            document.querySelector('.shutdown_button').style.display = "none";
            document.querySelector('.warningclose_button').style.display = "block";
        } else {
            localStorage.removeItem('note_texts');
            note_pad.classList.add('active');
            note_pad.classList.remove('selectwindows')
            test_windows_button()
        }
    })

    document.querySelector('.objective_close').addEventListener('click', function () {
        if (!objective_menu.classList.contains('active') && localStorage.getItem('objectiveData') && localStorage.getItem('objectiveTitleData') && (!localStorage.getItem('objective_area'))) {
            objective_menu.classList.add('active');
            localStorage.removeItem('objective_area');
            objective_menu.classList.remove('selectwindows')
            test_windows_button()
        } else if (localStorage.getItem('objective_area')) {
            document.querySelector('.warning_title_text').textContent = "objective sheet"
            document.querySelector('.window_warning_text').textContent = "タイトル と 内容を保存してから閉じてください";
            warning_windows.style.display = "block"
            document.querySelector('.close_button3').style.display = "block"
            sound5()
            document.querySelector('.test_allwindow').style.display = "block";
            document.querySelector('.shutdown_button').style.display = "none";
            document.querySelector('.warningclose_button').style.display = "none";
        } else if (!localStorage.getItem('objectiveData') && !localStorage.getItem('objectiveTitleData') && (!localStorage.getItem('objective_area'))) {
            document.getElementsByClassName('objective_title_area')[0].value = "";
            document.getElementsByClassName('objective_area')[0].value = "";
            objective_menu.classList.add('active');
            localStorage.removeItem('objective_area');
            objective_menu.classList.remove('selectwindows')
            test_windows_button()
        }
    })
    localStorage.removeItem('objective_area')

    document.querySelectorAll('.objective_title_area,.objective_area').forEach(function (objectives_area) {
        objectives_area.addEventListener("keydown", function (event) {
            if (event.ctrlKey && event.key === 's') {
                event.preventDefault();
            } else {
                objective_title(event);
            }
            objectives_area.addEventListener("keyup", function (event) {
                if (event.ctrlKey && event.key === 's') {
                    objective_save()
                }
            })
        });
    });
    function objective_title() {
        objectiveData_clear();
        document.querySelector('.objective_title').textContent = "*objective sheet";
        localStorage.setItem('objective_area', true);
    }

    document.querySelector('.camera_close').addEventListener('mouseup', function () {
        if (!sessionStorage.getItem('start_camera')) {
            camera_menu.classList.add('active')
            camera_menu.classList.remove('selectwindows')
            test_windows_button()

        } else if (sessionStorage.getItem('start_camera')) {
            document.querySelector('.window_error_text').textContent = "カメラが実行されているため、ウィンドウが閉じれません!"
            error_windows.classList.remove('active')
            sound3()
            document.querySelector('.test_allwindow').style.display = "block";
        }
    })

    function warning_windows_close() {
        warning_windows.style.display = "none";
        document.querySelector('.test_allwindow').style.display = "none";
        document.querySelector('.shutdown_button').style.display = "block";
        document.querySelector('.warningclose_button').style.display = "none";
        document.querySelector('.close_button3').style.display = "block"
        document.note_form.note_area.value = "";
        resetShowLength();
        localStorage.removeItem('note_texts');
        note_pad.classList.add('active');
        note_pad.classList.remove('selectwindows')
        test_windows_button()
    }

    function error_windows_close() {
        setTimeout(() => {
            document.querySelector('.test_allwindow').style.display = "none";
            error_windows.classList.add('active');
        }, 100);
    }

    function notedata_clear() {
        localStorage.removeItem('noteData');
        const memo_save = document.getElementById('memo_save_text');
        memo_save.textContent = "";
        localStorage.setItem('note_texts', true);
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
        document.querySelector('.objective_title').textContent = "objective sheet";
    }

    function resetShowLength() {
        document.getElementById("inputlength").innerHTML = "0";
    }
    const note_area = document.querySelector(".note_area");
    const textCountElement = document.getElementById("inputlength");
    const getCursorPos = () => {
        const textBeforeCursor = note_area.value.substring(0, note_area.selectionStart);
        const lines = textBeforeCursor.split('\n');
        return { line: lines.length, column: lines[lines.length - 1].length + 1 };
    };
    const displayCursorPos = () => {
        const pos = getCursorPos();
        document.getElementsByClassName('notetext_lines')[0].textContent = `Line: ${pos.line}, Column: ${pos.column}`;
    };
    note_area.addEventListener("keydown", function (event) {
        if (event.ctrlKey && event.key === 's') {
            event.preventDefault();
        } else {
            notetitle(event);
            setTimeout(() => {
                onChange()
            }, 10);
        }
        note_area.addEventListener("keyup", function (event) {
            if (event.ctrlKey && event.key === 's') {
                save()
            }
        })
    });
    document.addEventListener('keyup', function (event) {
        if (event.key === 's' && event.getModifierState('Fn')) {
            if (localStorage.getItem('note_texts')) {
                save();
            }
        }
    });
    note_area.addEventListener("paste", () => {
        setTimeout(onChange, 10)
    });

    function notetitle() {
        notedata_clear();
        resizeTextarea();
        document.querySelector('.note_title').textContent = "*notepad";
    }

    function note_lineheight() {
        notetitle();
        if (localStorage.getItem('note_lineheight')) {
            localStorage.removeItem('note_lineheight')
            note_area.style.lineHeight = ""
        } else {
            note_area.style.lineHeight = "1.5"
            localStorage.setItem('note_lineheight', true)
        }
    }
    function note_textspacing() {
        notetitle();
        if (localStorage.getItem('note_textspacing')) {
            localStorage.removeItem('note_textspacing')
            note_area.style.letterSpacing = ""
        } else {
            note_area.style.letterSpacing = "0.25em"
            localStorage.setItem('note_textspacing', true)
        }
    }
    if (localStorage.getItem('note_lineheight')) {
        note_area.style.lineHeight = "1.5"
    }
    if (localStorage.getItem('note_textspacing')) {
        note_area.style.letterSpacing = "0.25em"
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
        document.getElementById('memo_save_text').textContent = "";
        if (!localStorage.getItem('noteData')) {
            document.querySelector('.note_title').textContent = "*notepad"
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
            notice_menu.classList.remove('active')
        } else {
            document.querySelector('.window_error_text').textContent = "windows2000からテキストデータがエクスポートされていません!"
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
        evt.preventDefault();
        if (!localStorage.getItem('textdropdata')) {
            evt.target.textContent += evt.dataTransfer.getData('text'); // 新しいテキストを追加
        } else {
            document.querySelector('.window_error_text').textContent = "テキストが保存されているため、ドラッグした文字をドロップできません!";
            error_windows.classList.remove('active');
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
            localStorage.setItem('windowfile_1', true);
            localStorage.removeItem('windowfile_2')
            localStorage.removeItem('windowfile_3')
            window_file_list_change()
        })
    })
    Array.from(document.getElementsByClassName('windowfile2')).forEach((windowfile_2) => {
        windowfile_2.addEventListener('click', function () {
            localStorage.setItem('windowfile_2', true);
            localStorage.removeItem('windowfile_1')
            localStorage.removeItem('windowfile_3')
            window_file_list_reset()
        })
    })
    Array.from(document.getElementsByClassName('windowfile3')).forEach((windowfile_3) => {
        windowfile_3.addEventListener('click', function () {
            localStorage.setItem('windowfile_3', true);
            localStorage.removeItem('windowfile_1')
            localStorage.removeItem('windowfile_2')
            window_file_list_change2()
        })
    })

    document.querySelector('.clock_button').addEventListener('click', function () {
        if (localStorage.getItem('clock_button')) {
            localStorage.removeItem('clock_button')
            document.querySelector('.clock_button').textContent = "off"
            document.querySelector('.time').style.display = "block"
        } else {
            localStorage.setItem('clock_button', true);
            document.querySelector('.clock_button').textContent = "on"
            document.querySelector('.time').style.display = "none";
        }
    })

    document.querySelector('.battery_button').addEventListener('click', function () {
        if (localStorage.getItem('battery_button')) {
            localStorage.removeItem('battery_button')
            document.querySelector('.battery_button').textContent = "off"
            document.querySelector('.task_battery').style.display = "block"
        } else {
            localStorage.setItem('battery_button', true);
            document.querySelector('.battery_button').textContent = "on"
            document.querySelector('.task_battery').style.display = "none";
        }
    })

    document.querySelector('.taskbar_zindex_0').addEventListener('click', function () {
        if (localStorage.getItem('taskbar_zindex_0')) {
            localStorage.removeItem('taskbar_zindex_0')
            taskbar.style.zIndex = "";
            document.querySelector('.taskbar_zindex_0').textContent = "off"
        } else {
            localStorage.setItem('taskbar_zindex_0', true);
            taskbar.style.zIndex = "0";
            document.querySelector('.taskbar_zindex_0').textContent = "on"
        }
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
            localStorage.setItem('taskbar_position_button', true);

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
            if (window_files.classList.contains('file_border')) {
                document.querySelector('.file_border').classList.add('file_border2')
                document.querySelector('.file_border2').classList.remove('file_border')
            }
        })
        window_files.addEventListener('click', function () {
            Array.from(document.getElementsByClassName('window_files')).forEach((window_files2) => {
                window_files2.classList.remove('file_border');
                window_files2.classList.remove('file_border2');
            })
            window_files.classList.add('file_border');
        })
    })

    function fileborder_reset() {
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
        editor.value = '<!DOCTYPE html>\n<html>\n<head>\n<title>document</title>\n</head>\n<body>\n<button onclick="test()">a</button>\n<script>\nfunction test(){\nalert("sample text")\n}\n</script>\n</body>\n</html>'
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

    let isStopped = false; // ストップフラグ

    function cpubench() {
        const cpu_canvas = document.getElementById('benchmarkCanvas');
        const cpu_ctx = cpu_canvas.getContext('2d');
        const numRectangles = 10000;
        const batchSize = 10; // 一度に描画する四角形の数
        let i = 0;
        cpubench_clear()
        isStopped = false;
        const startTime = performance.now();
        document.querySelector('.cpurun_btn').classList.add('pointer_none')
        document.querySelector('.cpu_run_text').textContent = "描画中...";

        function drawBatch() {
            if (isStopped) return; // ストップフラグが立っている場合は描画を中止

            for (let j = 0; j < batchSize && i < numRectangles; j++, i++) {
                cpu_ctx.fillStyle = `rgb(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255})`;
                cpu_ctx.fillRect(Math.random() * cpu_canvas.width, Math.random() * cpu_canvas.height, 50, 50);
            }
            if (i < numRectangles) {
                requestAnimationFrame(drawBatch);
            } else {
                const endTime = performance.now();
                const timeTaken = Math.floor((endTime - startTime) / 1000); // ミリ秒を秒に変換し、少数を切り捨て
                document.querySelector('.cpu_run_text').textContent = `四角形を${numRectangles}個描画するのにかかった時間: ${timeTaken}秒`;
                document.querySelector('.cpurun_btn').classList.remove('pointer_none')
                document.querySelector('.cpurun_btn_clear').classList.remove('pointer_none')
            }
        }
        drawBatch();
    }

    function cpubench_clear() {
        isStopped = true;
        const cpu_canvas = document.getElementById('benchmarkCanvas');
        const cpu_ctx = cpu_canvas.getContext('2d');
        cpu_ctx.clearRect(0, 0, cpu_canvas.width, cpu_canvas.height);
        i = 0;
        document.querySelector('.cpu_run_text').textContent = "";
        document.querySelector('.cpurun_btn').classList.remove('pointer_none')
        document.querySelector('.cpurun_btn_clear').classList.add('pointer_none')
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

    function savertime_clear() {
        const stime = document.getElementsByClassName('saver_second')[0].value;
        localStorage.removeItem('saver_time')
        document.getElementsByClassName('screensaver_text')[0].textContent = "none";
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

    function saver1() {
        saver_clear();
        localStorage.setItem('saver1', true);
        document.getElementsByClassName('screen_mode')[0].textContent = "1";
    }
    function saver2() {
        saver_clear();
        localStorage.setItem('saver2', true);
        document.getElementsByClassName('screen_mode')[0].textContent = "2";
    }
    function saver3() {
        saver_clear();
        localStorage.setItem('saver3', true);
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

    const week = ["日", "月", "火", "水", "木", "金", "土"];
    const today = new Date();
    // 月末だとずれる可能性があるため、1日固定で取得
    var showDate = new Date(today.getFullYear(), today.getMonth(), 1);

    // 初期表示
    function caload() {
        showProcess(today, calendar);
    };
    function c_prev() {
        showDate.setMonth(showDate.getMonth() - 1);
        showProcess(showDate);
    }
    function c_next() {
        showDate.setMonth(showDate.getMonth() + 1);
        showProcess(showDate);
    }
    function showProcess(date) {
        var year = date.getFullYear();
        var month = date.getMonth();
        document.querySelector('#header').innerHTML = year + "年 " + (month + 1) + "月";
        var calendar = createProcess(year, month);
        document.querySelector('#calendar').innerHTML = calendar;
    }
    function createProcess(year, month) {
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
        localStorage.removeItem("backcolor_filter");
        document.getElementById('nex').style.filter = "";
    }
    function applyFilter(filterType, filterValue) {
        backcolorfilter_clear();
        document.getElementById('nex').style.filter = filterValue;
        localStorage.setItem("backcolor_filter", filterType);
    }
    function color_bw() { applyFilter("blackwhite", "grayscale(100%)"); }
    function color_invert() { applyFilter("invert", "invert(100%)"); }
    function color_hue() { applyFilter("hue", "hue-rotate(100deg)"); }
    window.onload = function () {
        const filterType = localStorage.getItem("backcolor_filter");
        const filters = {
            "blackwhite": "grayscale(100%)",
            "invert": "invert(100%)",
            "hue": "hue-rotate(100deg)"
        };
        if (filterType && filters[filterType]) {
            document.getElementById('nex').style.filter = filters[filterType];
        }
    };

    function toggleShadow(action) {
        document.querySelectorAll('.child_list, .sample_child_list').forEach(function (childlist_shadow) {
            let childlist_shadow2 = childlist_shadow.lastElementChild;
            if (action === 'add') {
                childlist_shadow2.classList.add('shadow');
            } else if (action === 'remove') {
                childlist_shadow2.classList.remove('shadow');
            }
        });
    }

    function list_shadow() {
        toggleShadow('add');
    }

    function list_shadow_reset() {
        toggleShadow('remove');
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

    const clock_canvas = document.getElementById("analog_clock");
    const clock_ctx = clock_canvas.getContext('2d');
    const dayArr = ["日", "月", "火", "水", "木", "金", "土"];

    // 時計の針を描く関数
    function drawHand(length, width, angle) {
        clock_ctx.beginPath();
        clock_ctx.moveTo(150, 150);
        clock_ctx.lineTo(150 + length * Math.cos(Math.PI / 180 * (270 + angle)), 150 + length * Math.sin(Math.PI / 180 * (270 + angle)));
        clock_ctx.lineWidth = width;
        clock_ctx.stroke();
    }

    // 時計を描く関数
    function drawClock() {
        const d = new Date();
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        const date = d.getDate();
        const day = d.getDay();
        const hours = d.getHours() % 12;
        const minutes = d.getMinutes();
        const seconds = d.getSeconds();
        const dateText = `${year}-${("0" + month).slice(-2)}-${("0" + date).slice(-2)} ${dayArr[day]}`;
        const amPm = hours >= 12 ? "午後" : "午前";

        // キャンバスをクリア
        clock_ctx.clearRect(0, 0, clock_canvas.width, clock_canvas.height);
        clock_ctx.beginPath();
        clock_ctx.arc(150, 150, 150, 0, Math.PI * 2);
        clock_ctx.lineWidth = 1.0;
        clock_ctx.stroke();

        // 目盛りを描く
        for (let i = 0; i < 60; i++) {
            clock_ctx.beginPath();
            clock_ctx.moveTo(150 + 150 * Math.cos(Math.PI / 180 * (270 + i * 6)), 150 + 150 * Math.sin(Math.PI / 180 * (270 + i * 6)));
            clock_ctx.lineTo(150 + (i % 5 === 0 ? 140 : 145) * Math.cos(Math.PI / 180 * (270 + i * 6)), 150 + (i % 5 === 0 ? 140 : 145) * Math.sin(Math.PI / 180 * (270 + i * 6)));
            clock_ctx.lineWidth = i % 5 === 0 ? 1.5 : 1;
            clock_ctx.stroke();
        }

        // 数字と日付を描く
        clock_ctx.font = "20px 'ＭＳ ゴシック'";
        clock_ctx.textAlign = "center";
        const textArrX = [210, 255, 275, 260, 215, 150, 90, 45, 25, 45, 85, 150];
        const textArrY = [55, 100, 160, 225, 270, 285, 270, 220, 160, 100, 55, 35];
        for (let i = 0; i < 12; i++) {
            clock_ctx.fillText(i + 1, textArrX[i], textArrY[i]);
        }
        clock_ctx.font = "15px 'ＭＳ ゴシック'";
        clock_ctx.fillText(dateText, 150, 80);
        clock_ctx.fillText(amPm, 150, 100);

        // 針を描く
        drawHand(140, 1, seconds * 6);
        drawHand(130, 3, 6 * (minutes + seconds / 60));
        drawHand(100, 6, 30 * (hours + minutes / 60));
    }

    document.querySelector('.youtubevideo_button').addEventListener('click', function () {
        const url = document.querySelector("#youtube").value;
        const id = url.replace("watch?v=", "embed/");
        document.querySelector("#youtubeframe").src = id + "?enablejsapi=1&mute=1";
        setTimeout(() => {
            y_iframeController('unMute');
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
        if (desktop.style.display == "block") {
            document.getElementById('shell').value = "";
            document.querySelector('.local_memory_button').classList.add('pointer_none');

            document.querySelectorAll('.prompt_shell_menu').forEach(function (prompt_shell_menu) {
                prompt_shell_menu.closest('.child_windows');
                prompt_shell_menu.classList.remove('active');
                prompt_shell_menu.style.zIndex = largestZIndex++;
            });

            var testKey = 'testStorageKey';
            var testData = new Array(1024).join('a'); // 1KBのデータを作成
            var success = true;
            var maxSize = 0; try {
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
            document.querySelector('.local_memory').innerHTML = ""
            const delay = 25;
            const totalDelay = localStorage.length * delay;
            for (let i = 0; i < localStorage.length; i++) {
                setTimeout(() => {
                    const key = localStorage.key(i);
                    const value = localStorage.getItem(key);
                    const valueType = typeof value;
                    const valueLength = value.length;
                    const valueSize = new Blob([value]).size; // バイト数を計算
                    document.getElementById('shell').value = (`Key: ${key}, Value: ${value}, Type: ${valueType}, Length: ${valueLength}, Size: ${valueSize} bytes`);
                }, i * delay);
            }
            setTimeout(() => {
                shellmenu_close();
                document.querySelector('.local_memory').innerHTML = '&emsp;' + maxSize + 'KB' + '&emsp;';
                localStorage.setItem('maxSize', maxSize);
                displayLocalStorageDetails();
                document.querySelector('.local_memory_button').classList.remove('pointer_none');
            }, totalDelay + 500);
        }
    }
    document.querySelector('.local_memory').innerHTML = '&emsp;' + localStorage.getItem('maxSize') + "KB" + '&emsp;';

    function displayLocalStorageDetails() {
        document.querySelectorAll('.localstorage_key').forEach(function (localstorage_key) {
            localstorage_key.remove();
        });
        const list = document.getElementById('localStorageList');
        let totalSize = 0;
        // すべてのキーを取得してアルファベット順にソート
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            keys.push(localStorage.key(i));
        }
        keys.sort(); // キーをアルファベット順にソート

        // ソートされたキーを使ってループ
        keys.forEach(function (key) {
            const value = localStorage.getItem(key);
            const valueSize = new Blob([value]).size; // バイト数を計算
            totalSize += valueSize;
            const listItem = document.createElement('li');
            listItem.classList.add('border');
            listItem.classList.add('localstorage_key');
            listItem.style.width = "max-content";
            listItem.style.marginTop = "5px";
            listItem.textContent = `Keyname: ${key}, Size: ${valueSize} Byte`;
            list.appendChild(listItem);
        });

        // 合計サイズを表示
        const totalSizeElement = document.getElementById('totalSize');
        totalSizeElement.textContent = `Total Size: ${totalSize} Byte`;
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
    const paint_canvas = document.getElementById('paint_canvas');
    const paint_ctx = paint_canvas.getContext('2d');
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

    const wallpaper_allremove = () => {
        background_img.src = "";
        background_img.style.display = "none";
        ['.nexser_backgroundimage_1', '.nexser_backgroundimage_2', '.nexser_backgroundimage_3'].forEach(selector => {
            document.querySelector(selector).style.display = "none";
        });
        ['wallpaper_95', 'wallpaper_95_2', 'wallpaper_xp'].forEach(item => localStorage.removeItem(item));
    };
    const setWallpaper = (key, imageClass, resizeFunction) => {
        wallpaper_allremove();
        localStorage.setItem(key, true);
        document.querySelector(imageClass).style.display = "block";
        resizeFunction();
    };
    document.querySelector('.wallpaper_95').addEventListener('click', () => setWallpaper('wallpaper_95', '.nexser_backgroundimage_1', minidesk_backgroundresize1));
    document.querySelector('.wallpaper_95_2').addEventListener('click', () => setWallpaper('wallpaper_95_2', '.nexser_backgroundimage_2', minidesk_backgroundresize2));
    document.querySelector('.wallpaper_xp').addEventListener('click', () => setWallpaper('wallpaper_xp', '.nexser_backgroundimage_3', minidesk_backgroundresize3));

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
        const initialPositions = [27, 28, 35, 36];
        initialPositions.forEach(index => {
            const piece = document.createElement('div');
            piece.classList.add(index % 2 === 0 ? 'othello_white' : 'othello_black');
            othello_board.children[index].appendChild(piece);
        });
    }

    function handleClick(event) {
        const cell = event.target;
        if (cell.children.length > 0) return;
        const piece = document.createElement('div');
        piece.classList.add(currentPlayer);
        cell.appendChild(piece);
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
        while (parentElement.firstChild) {
            parentElement.removeChild(parentElement.firstChild);
        }
    }

    function addResizers(element) {
        const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top', 'right', 'bottom', 'left'];
        positions.forEach(pos => {
            const resizer = document.createElement('div');
            resizer.classList.add('resizer', pos);
            element.appendChild(resizer);
        });
    }

    function makeResizableDivs(className) {
        const elements = document.querySelectorAll(className);
        elements.forEach(element => {
            addResizers(element);
            attachResizeHandlers(element);
        });

        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1 && node.matches(className)) {
                            addResizers(node);
                            attachResizeHandlers(node);
                        }
                    });
                }
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    function attachResizeHandlers(element) {
        const resizers = element.querySelectorAll('.resizer');
        const minSize = 20;
        let originalWidth, originalHeight, originalX, originalY, originalMouseX, originalMouseY;

        resizers.forEach(resizer => {
            resizer.addEventListener('mousedown', e => {
                e.preventDefault();
                const styles = getComputedStyle(element);
                originalWidth = parseFloat(styles.width);
                originalHeight = parseFloat(styles.height);
                originalX = element.getBoundingClientRect().left;
                originalY = element.getBoundingClientRect().top;
                originalMouseX = e.pageX;
                originalMouseY = e.pageY;

                window.addEventListener('mousemove', resize);
                window.addEventListener('mouseup', stopResize);
            });

            function resize(e) {
                const dx = e.pageX - originalMouseX;
                const dy = e.pageY - originalMouseY;

                if (resizer.classList.contains('right') || resizer.classList.contains('bottom-right') || resizer.classList.contains('top-right')) {
                    const newWidth = originalWidth + dx;
                    if (newWidth > minSize) element.style.width = newWidth + 'px';
                }
                if (resizer.classList.contains('left') || resizer.classList.contains('bottom-left') || resizer.classList.contains('top-left')) {
                    const newWidth = originalWidth - dx;
                    if (newWidth > minSize) {
                        element.style.width = newWidth + 'px';
                        element.style.left = originalX + dx + 'px';
                    }
                }
                if (resizer.classList.contains('bottom') || resizer.classList.contains('bottom-right') || resizer.classList.contains('bottom-left')) {
                    const newHeight = originalHeight + dy;
                    if (newHeight > minSize) element.style.height = newHeight + 'px';
                }
                if (resizer.classList.contains('top') || resizer.classList.contains('top-right') || resizer.classList.contains('top-left')) {
                    const newHeight = originalHeight - dy;
                    if (newHeight > minSize) {
                        element.style.height = newHeight + 'px';
                        element.style.top = originalY + dy + 'px';
                    }
                }
                rectangle_remove();
            }
            function stopResize() {
                window.removeEventListener('mousemove', resize);
                window.removeEventListener('mouseup', stopResize);
            }
        });
    }
    makeResizableDivs('.resize');



    const dropzone = document.getElementById('dropzone');
    const url_iframe = document.getElementById('url_iframe');

    dropzone.addEventListener('dragover', (event) => {
        event.preventDefault();
        dropzone.style.backgroundColor = '#f0f0f0';
    });

    dropzone.addEventListener('dragleave', (event) => {
        dropzone.style.backgroundColor = '';
    });

    dropzone.addEventListener('drop', (event) => {
        event.preventDefault();
        dropzone.style.backgroundColor = '';

        const url = event.dataTransfer.getData('text/uri-list');
        if (url) {
            url_iframe.src = url;
            url_iframe.style.display = "block"
            dropzone.style.display = "none"
        } else {
            document.getElementById('nex').style.cursor = '';
            document.querySelector('.window_error_text').textContent = "有効なURLをドロップしてください。"
            error_windows.classList.remove('active')
            document.querySelector('.test_allwindow').style.display = "block";
            sound3()
        }
    });

    function urldrop_reset() {
        url_iframe.src = "";
        url_iframe.style.display = "none"
        dropzone.style.display = "block"
    }


    const cards = ['A', 'A', 'B', 'B', 'C', 'C', 'D', 'D', 'E', 'E', 'F', 'F'];
    let firstCard = null;
    let secondCard = null;
    let lockBoard = false;
    let matchCount = 0;
    let card_startTime;
    let card_timerInterval;

    function shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    function createBoard() {
        const gameBoard = document.getElementById('game-board');
        gameBoard.innerHTML = '';
        shuffle(cards);
        cards.forEach(card => {
            const cardElement = document.createElement('div');
            cardElement.classList.add('card', 'card_hidden');
            cardElement.dataset.value = card;
            cardElement.addEventListener('click', flipCard);
            gameBoard.appendChild(cardElement);
        });
        card_startTime = new Date();
        card_timerInterval = setInterval(updateElapsedTime, 1000);
    }

    function flipCard() {
        if (lockBoard) return;
        if (this === firstCard) return;

        this.classList.remove('card_hidden');
        this.textContent = this.dataset.value;

        if (!firstCard) {
            firstCard = this;
            return;
        }

        secondCard = this;
        lockBoard = true;

        checkForMatch();
    }

    function checkForMatch() {
        if (firstCard.dataset.value === secondCard.dataset.value) {
            disableCards();
            updateMatchCount();
            if (matchCount === cards.length / 2) {
                clearInterval(card_timerInterval);
                showCongratulationsMessage();
            }
        } else {
            unflipCards();
        }
    }

    function disableCards() {
        firstCard.classList.add('card_matched');
        secondCard.classList.add('card_matched');
        firstCard.removeEventListener('click', flipCard);
        secondCard.removeEventListener('click', flipCard);
        resetBoard();
    }

    function unflipCards() {
        setTimeout(() => {
            firstCard.classList.add('card_hidden');
            secondCard.classList.add('card_hidden');
            firstCard.textContent = '';
            secondCard.textContent = '';
            resetBoard();
        }, 1000);
    }

    function resetBoard() {
        [firstCard, secondCard, lockBoard] = [null, null, false];
    }

    function updateMatchCount() {
        matchCount++;
        document.getElementById('match-count').textContent = matchCount;
    }

    function resetGame() {
        matchCount = 0;
        document.getElementById('match-count').textContent = matchCount;
        document.getElementById('game_board_text').textContent = ""
        clearInterval(card_timerInterval);
        document.getElementById('elapsed-time').textContent = '0';
        document.getElementsByClassName('start_card')[0].style.display = "block"
        document.getElementById('game-board').style.display = "none"
    }

    function showCongratulationsMessage() {
        document.getElementById('game_board_text').textContent = "CLEAR!!"
    }

    function updateElapsedTime() {
        const elapsedTime = Math.floor((new Date() - card_startTime) / 1000);
        document.getElementById('elapsed-time').textContent = elapsedTime;
    }

    function card_board_start() {
        document.getElementsByClassName('start_card')[0].style.display = "none"
        document.getElementById('game-board').style.display = "block"
        createBoard()
    }

    windowposition_reset()
    function windowposition_reset() {
        document.querySelectorAll('.child_windows').forEach(element => {
            element.style.left = "130px";
            element.style.top = "130px";
        });
        const noticewindow = document.querySelector('.notice_menu');
        noticewindow.style.top = "45%";
        noticewindow.style.left = "50%";
        noticewindow.style.transform = "translate(-50%, -50%)";

        const pass_signin_menu = document.querySelector('.pass_signin_menu');
        pass_signin_menu.style.top = "50%";
        pass_signin_menu.style.left = "50%";
        pass_signin_menu.style.transform = "translate(-50%, -50%)";
    }

    document.addEventListener('DOMContentLoaded', function () {
        // クラス名が "parent" の要素をすべて取得
        var parents = document.querySelectorAll('.parentss');

        parents.forEach(function (parent, parentIndex) {
            // 親要素内のクラス名が "editable" の子要素をすべて取得
            var elements = parent.querySelectorAll('.editable');

            // ローカルストレージから保存された名前を読み込む
            elements.forEach(function (element, index) {
                var savedName = localStorage.getItem('editable-' + parentIndex + '-' + index);
                if (savedName) {
                    element.textContent = savedName;
                }
            });

            parent.addEventListener('contextmenu', function (event) {
                event.preventDefault();
                if (event.target === parent) {
                    elements.forEach(function (element, index) {
                        var originalName = element.textContent;
                        var newName = prompt('新しい名前を入力してください (20文字以内):', element.textContent);
                        if (newName && newName.length <= 20) {
                            element.textContent = newName;
                            localStorage.setItem('editable-' + parentIndex + '-' + index, newName);
                        } else if (newName) {
                            document.getElementById('nex').style.cursor = '';
                            document.querySelector('.window_error_text').textContent = "名前は20文字以内で入力してください!"
                            error_windows.classList.remove('active');
                            document.querySelector('.test_allwindow').style.display = "block";
                            sound3()
                            element.textContent = originalName;
                        } else {
                            element.textContent = originalName;
                        }
                    });
                }
            });
        });
    });

    const taskbar_b = document.querySelector('#task_buttons2');
    function test_windows_button() {
        resize_background_image();
        document.querySelectorAll('.task_buttons').forEach(function (task_buttons) {
            task_buttons.remove()
        });
        const windows = document.querySelectorAll('.child_windows.selectwindows');
        windows.forEach((windowElement) => {
            // 1番目の子要素を取得
            const firstChild = windowElement.children[0];
            // その子要素の中の2番目の子要素を取得
            const nestedChild = firstChild.children[1];
            const nestedChild2 = nestedChild.textContent;
            const button = document.createElement('span');
            button.className = 'task_buttons button2';
            button.textContent = nestedChild2;
            taskbar_b.appendChild(button);
            button.addEventListener('click', () => toggleWindow(windowElement));
        });
    };

    function toggleWindow(windowElement) {
        windowElement.classList.remove('active');
        windowElement.style.zIndex = largestZIndex++;
    }

    const dropArea = document.querySelector('#files');
    const dropArea2 = document.querySelector('#soft_windows');

    dropArea.addEventListener('dragover', (event) => {
        event.preventDefault();
        dropArea.style.borderColor = '#000';
    });

    dropArea.addEventListener('dragleave', () => {
        dropArea.style.borderColor = '#ccc';
    });

    dropArea.addEventListener('drop', (event) => {
        event.preventDefault();
        dropArea.style.borderColor = '#ccc';
        const files = event.dataTransfer.files;
        const files2 = event.dataTransfer;
        const url = files2.getData('text/uri-list');

        // ファイルを1つずつ処理する関数
        const processFile = (file, x, y) => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const result = e.target.result;
                    const windowDiv = document.createElement('div');
                    windowDiv.className = "child_windows testwindow2 resize"
                    windowDiv.style.left = `${event.clientX}px`;
                    windowDiv.style.top = `${event.clientY}px`;
                    windowDiv.style.zIndex = largestZIndex++;

                    const newChild = document.createElement('div');
                    newChild.className = "title"
                    windowDiv.appendChild(newChild);

                    const newChild2 = document.createElement('span');
                    newChild2.className = "title_icon"
                    newChild.appendChild(newChild2);

                    const newChild22 = document.createElement('span');
                    newChild22.textContent = `${file.name}`;
                    newChild22.className = "white_space_wrap";
                    newChild.appendChild(newChild22);

                    const newChild3 = document.createElement('div');
                    newChild3.className = "title_buttons"
                    windowDiv.appendChild(newChild3);

                    const newChild4_4 = document.createElement('span');
                    newChild4_4.className = "drag_button"
                    newChild4_4.innerHTML = "&nbsp;"
                    newChild3.appendChild(newChild4_4);

                    const newChild4 = document.createElement('span');
                    newChild4.className = "close_button button2"
                    newChild4.textContent = "✕"
                    newChild3.appendChild(newChild4);

                    newChild4.addEventListener('click', () => {
                        const newChild4_2 = newChild4.closest('.child_windows');
                        if (newChild4_2) {
                            newChild4_2.remove();
                            zindexwindow_addnavy();
                            test_windows_button();
                        }
                    });

                    const newChild4_1 = document.createElement('span');
                    newChild4_1.className = "bigscreen_button button2"
                    newChild4_1.textContent = "☐"
                    newChild3.appendChild(newChild4_1);

                    const newChild4_2 = document.createElement('span');
                    newChild4_2.className = "minscreen_button button2"
                    newChild4_2.textContent = "❒"
                    newChild3.appendChild(newChild4_2);

                    const newChild4_5 = document.createElement('br');
                    newChild3.appendChild(newChild4_5);

                    const newChild6 = document.createElement('div');
                    newChild6.className = "window_contents"
                    windowDiv.appendChild(newChild6);
                    setTimeout(() => {
                        windowDiv.classList.add('no_create_windows');
                    }, 100);

                    if (file.type.startsWith('image/')) {
                        windowDiv.classList.add('selectwindows');
                        const img = document.createElement('img');
                        img.src = result;
                        img.className = "item_preview";
                        newChild6.appendChild(img);
                        setTimeout(() => {
                            test_windows_button()
                        }, 100);
                    } else if (file.type.startsWith('video/')) {
                        windowDiv.classList.add('selectwindows');
                        const video = document.createElement('video');
                        video.src = result;
                        video.controls = true;
                        video.className = "item_preview";
                        newChild6.appendChild(video);
                        setTimeout(() => {
                            test_windows_button()
                        }, 1000);
                    } else if (file.type === 'application/pdf') {
                        windowDiv.classList.add('selectwindows');
                        const iframe = document.createElement('iframe');
                        iframe.src = result;
                        iframe.className = "item_preview";
                        newChild6.appendChild(iframe);
                        setTimeout(() => {
                            test_windows_button()
                        }, 100);
                    } else if (file.type.startsWith('text/')) {
                        windowDiv.classList.add('selectwindows');
                        const text = document.createElement('p');
                        text.textContent = e.target.result;
                        text.className = "item_preview";
                        newChild6.appendChild(text);
                        setTimeout(() => {
                            test_windows_button()
                        }, 100);
                    } else if (isYouTubeURL(url)) {
                        windowDiv.classList.add('selectwindows');
                        const iframe = document.createElement('iframe');
                        iframe.src = `https://www.youtube.com/embed/${extractYouTubeID(url)}`;
                        iframe.className = "item_preview";
                        newChild6.classList.add('scrollbar_none')
                        newChild6.appendChild(iframe);
                        setTimeout(() => {
                            test_windows_button();
                        }, 100);
                    } else {
                        const unsupported = document.createElement('p');
                        unsupported.textContent = 'このファイル形式はサポートされていません。';
                        unsupported.classList.add('item_preview');
                        newChild6.appendChild(unsupported);
                        setTimeout(() => {
                            test_windows_button()
                        }, 100);
                    }

                    function isYouTubeURL(url_youtube) {
                        return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/.test(url_youtube);
                    }
                    function extractYouTubeID(url_youtube) {
                        const match = url_youtube.match(/(?:youtu\.be\/|youtube\.com\/(?:v\/|u\/\w\/|embed\/|watch\?v=|&v=))([^#&?]{11})/);
                        return match ? match[1] : null;
                    }

                    setTimeout(() => {
                        document.querySelectorAll('.testwindow2:not(.no_create_windows)').forEach(function (testwindow2) {
                            const testwindow2_1 = testwindow2.children[2];
                            const testwindow2_2 = testwindow2_1.firstElementChild;
                            testwindow2_2.style.width = "100%"
                            testwindow2_2.style.height = "100%"
                            testwindow2.style.width = "500px"
                            testwindow2.style.height = "400px"
                        })

                        document.querySelectorAll('.testwindow2, .child').forEach(function (z_index_child_windows) {
                            const zindexchildwindows = z_index_child_windows.closest('.testwindow2');
                            z_index_child_windows.addEventListener('mousedown', function () {
                                zindexchildwindows.scrollTop = 0;
                                zindexchildwindows.scrollLeft = 0;
                                setTimeout(() => {
                                    document.querySelectorAll('.testwindow2').forEach(function (testwindow2) {
                                        const testwindow2_1 = testwindow2.children[2];
                                        const testwindow2_2 = testwindow2_1.firstElementChild;
                                        testwindow2_2.style.maxWidth = `${testwindow2.clientWidth}px`;
                                        testwindow2_2.style.maxHeight = `${testwindow2.clientHeight + - + 25}px`;
                                    })
                                    zindexchildwindows.style.zIndex = largestZIndex++;
                                }, 0);
                                rectangle_remove();
                            });
                        })

                        document.querySelectorAll('.testwindow2').forEach(function (testwindow2) {
                            testwindow2.addEventListener('mousemove', function () {
                                const testwindow2_1 = testwindow2.children[2];
                                const testwindow2_2 = testwindow2_1.firstElementChild;
                                testwindow2_2.style.width = "100%";
                                testwindow2_2.style.height = "100%";
                                testwindow2_2.style.maxWidth = `${testwindow2.clientWidth}px`;
                                testwindow2_2.style.maxHeight = `${testwindow2.clientHeight + - + 25}px`;
                            })
                        });
                        resolve();
                    }, 0);
                    dropArea2.appendChild(windowDiv);
                };
                reader.readAsDataURL(file);
            })
        }

        // 各ファイルを1つずつ処理
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            setTimeout(() => {
                document.querySelector('.warning_title_text').textContent = "nexser"
                document.querySelector('.window_warning_text').textContent = `読み込み中... ${i + 1} of ${files.length}: ${file.name}`;
                warning_windows.style.display = "block"
                document.querySelector('.close_button3').style.display = "block"
                document.querySelector('.shutdown_button').style.display = "none";
                document.querySelector('.warningclose_button').style.display = "none";
                processFile(file, event.clientX, event.clientY).then(() => {
                    warning_windows.style.display = "none";
                }).catch(error => {
                    console.error(`Error processing file ${i + 1}:`, error);
                    processingMessage.innerText = `Error processing file ${i + 1} of ${files.length}: ${file.name}`;
                });
            }, i * 250);
        }
        rectangle_remove();
    });


    document.getElementById('exportButton').addEventListener('click', function () {
        const localStorageData = JSON.stringify(localStorage);

        // Base64エンコード関数
        function base64Encode(str) {
            return btoa(unescape(encodeURIComponent(str)));
        }

        // Base64デコード関数
        function base64Decode(str) {
            return decodeURIComponent(escape(atob(str)));
        }

        // XOR暗号化関数
        function xorEncrypt(data, key) {
            let encrypted = '';
            for (let i = 0; i < data.length; i++) {
                encrypted += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
            }
            return encrypted;
        }

        const key = 'your-encryption-key'; // 暗号化キーを設定

        // データをエンコードして圧縮
        const encodedData = base64Encode(localStorageData);

        // 圧縮データを暗号化
        const encryptedData = xorEncrypt(encodedData, key);

        // 暗号化データをBlobに変換してダウンロード
        const blob = new Blob([encryptedData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'nexser_storageData_encrypted.json';
        a.click();
        URL.revokeObjectURL(url);
    });



    document.getElementById('fileInput').addEventListener('change', function (event) {
        const file = event.target.files[0];
        const reader = new FileReader();
        reader.onload = function (event) {
            // Base64デコード関数
            function base64Decode(str) {
                return decodeURIComponent(escape(atob(str)));
            }

            // XOR復号化関数
            function xorDecrypt(data, key) {
                let decrypted = '';
                for (let i = 0; i < data.length; i++) {
                    decrypted += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
                }
                return decrypted;
            }

            const key = 'your-encryption-key'; // 暗号化キーを設定
            const encryptedData = event.target.result;

            // データを復号化
            const decryptedData = xorDecrypt(encryptedData, key);

            // データをデコード
            const decodedData = base64Decode(decryptedData);

            // JSON形式にパース
            const data = JSON.parse(decodedData);

            // ローカルストレージをクリアしてデータを復元
            localStorage.clear();
            sessionStorage.clear();
            for (const key in data) {
                localStorage.setItem(key, data[key]);
            }

            // UIの更新
            document.querySelector('.warning_title_text').textContent = "nexser";
            document.querySelector('.window_warning_text').textContent = "データが復元されました! ページを再読み込みしてください。";
            warning_windows.style.display = "block";
            document.querySelector('.close_button3').style.display = "block";
            sound5();
            document.querySelector('.test_allwindow').style.display = "block";
            document.querySelector('.shutdown_button').style.display = "none";
            document.querySelector('.warningclose_button').style.display = "none";
        };
        reader.readAsText(file);
    });

    function nexser_search_button() {
        const search_windows = document.querySelectorAll('.child_windows:not(.window_nosearch)');
        search_windows.forEach((windowElement) => {
            // 1番目の子要素を取得
            const firstChild = windowElement.children[0];
            // その子要素の中の2番目の子要素を取得
            const nestedChild = firstChild.children[1];
            const nestedChild2 = nestedChild.textContent;
            const button = document.createElement('li');
            button.className = 'borderinline_dotted button2 search_button white_space_wrap';
            const button_span_child = document.createElement('span');
            button_span_child.textContent = "　" + nestedChild2 + "　";
            document.getElementById('myUL').appendChild(button);
            button.appendChild(button_span_child);
            button.addEventListener('click', () => toggleWindow(windowElement));
        });
    };
    nexser_search_button()

    const elements = document.querySelectorAll('.desktop_files');
    elements.forEach((element, index) => {
        const savedPosition = localStorage.getItem(`draggable-${index}`);
        if (savedPosition) {
            const [x, y] = savedPosition.split(',');
            element.style.position = "absolute";
            element.style.left = `${x}px`;
            element.style.top = `${y}px`;
        }
        element.draggable = true;
        let offsetX, offsetY;
        element.addEventListener('dragstart', (e) => {
            offsetX = e.clientX - element.getBoundingClientRect().left;
            offsetY = e.clientY - element.getBoundingClientRect().top;
            e.dataTransfer.setData('text/plain', null);
            element.style.border = "1.95px dotted dimgray";
            element.style.opacity = "0.99";
            const element2 = element.firstElementChild;
            const element3 = element.children[1];
            element2.style.opacity = "0";
            element3.style.opacity = "0";
            setTimeout(() => {
                element2.style.opacity = "";
                element3.style.opacity = "";
            }, 0);
            rectangle_remove()
        });
        element.addEventListener('dragend', (e) => {
            const x = e.clientX - offsetX;
            const y = e.clientY - offsetY;
            element.style.position = "absolute";
            element.style.left = `${x}px`;
            element.style.top = `${y}px`;
            const element2 = element.firstElementChild;
            const element3 = element.children[1];
            element2.style.opacity = "";
            element3.style.opacity = "";
            element.style.opacity = "";
            element.style.border = "";
            localStorage.setItem(`draggable-${index}`, `${x},${y}`);
        });
    });

    function rectangle_remove() {
        const elements = document.querySelectorAll('.rectangle');
        elements.forEach(element => {
            element.remove('rectangle');
        });
    }

    var background_img = document.createElement("img");
    function minidesk_backgroundresize1() {
        background_img.style.display = "block";
        background_img.src = "nexser_image/Windows95_wallpaper.jpg"; // 画像のパスを指定
        // 特定のクラスを持つ要素を取得
        var targetElement = document.querySelector(".mini_desktop");
        targetElement.appendChild(background_img);
        const minidesk_parent = document.querySelector('.mini_desktop');
        const minidesk_child = background_img
        minidesk_child.style.width = `${minidesk_parent.clientWidth}px`;
        minidesk_child.style.height = `${minidesk_parent.clientHeight}px`;
    }
    function minidesk_backgroundresize2() {
        background_img.style.display = "block";
        background_img.src = "nexser_image/Windows95_wallpaper_2.png"; // 画像のパスを指定
        // 特定のクラスを持つ要素を取得
        var targetElement = document.querySelector(".mini_desktop");
        targetElement.appendChild(background_img);
        const minidesk_parent = document.querySelector('.mini_desktop');
        const minidesk_child = background_img
        minidesk_child.style.width = `${minidesk_parent.clientWidth}px`;
        minidesk_child.style.height = `${minidesk_parent.clientHeight}px`;
    }
    function minidesk_backgroundresize3() {
        background_img.style.display = "block";
        background_img.src = "nexser_image/Windowsxp_wallpaper.jpg"; // 画像のパスを指定
        // 特定のクラスを持つ要素を取得
        var targetElement = document.querySelector(".mini_desktop");
        targetElement.appendChild(background_img);
        const minidesk_parent = document.querySelector('.mini_desktop');
        const minidesk_child = background_img
        minidesk_child.style.width = `${minidesk_parent.clientWidth}px`;
        minidesk_child.style.height = `${minidesk_parent.clientHeight}px`;
    }

    document.querySelectorAll('.search_button').forEach(search_button =>
        search_button.addEventListener('click', () => {
            if (!cpu_bench_menu.classList.contains('active')) {
                cpubench_open()
            }
        })
    );

    let currentDate = new Date();
    let alarm_hours = currentDate.getHours();
    let alarm_minutes = currentDate.getMinutes();
    let alarm_seconds = currentDate.getSeconds();
    let timerText = document.getElementById('timerText');
    let set_btn = document.getElementById('set_btn');
    let delete_btn = document.getElementById('delete_btn');
    let option_hours;
    let option_minutes;
    let parent_list = document.getElementById('parent_list');
    let record = JSON.parse(localStorage.getItem('alarms')) || [];
    let x = record.length;
    let Setting = function (sethour, setminute) {
        this.sethour = sethour;
        this.setminute = setminute;
    };
    function adjustDigit(num) {
        let digit;
        if (num < 10) { digit = `0${num}`; }
        else { digit = num; }
        return digit;
    }
    set_btn.addEventListener('click', function () {
        let lis = parent_list.getElementsByTagName('li');
        let len = lis.length;
        if (len >= 10) { return; }
        option_hours = document.alarm_form.option_hours.value;
        option_minutes = document.alarm_form.option_minutes.value;
        record[x] = new Setting(option_hours, option_minutes);
        let container_list = document.createElement('li');
        let list_content = document.createTextNode(`${record[x].sethour}時${record[x].setminute}分`);
        parent_list.appendChild(container_list);
        container_list.appendChild(list_content);
        let list_span = document.createElement('span');
        let id_li = document.createAttribute('id');
        let id_span = document.createAttribute('id');
        let span_content = document.createTextNode('削除');
        container_list.appendChild(list_span);
        list_span.appendChild(span_content);
        container_list.setAttributeNode(id_li);
        container_list.id = x;
        container_list.classList.add('deletes', 'large');
        list_span.classList.add('delete_btn', 'button2', 'large');
        addDeleteFunctionality();
        x++;
        saveAlarms();
    });
    function saveAlarms() {
        localStorage.setItem('alarms', JSON.stringify(record));
    }
    function loadAlarms() {
        for (let i = 0; i < record.length; i++) {
            if (record[i] !== 'disabled') {
                let container_list = document.createElement('li');
                let list_content = document.createTextNode(`${record[i].sethour}時${record[i].setminute}分`);
                parent_list.appendChild(container_list);
                container_list.appendChild(list_content);
                let list_span = document.createElement('span');
                let span_content = document.createTextNode('削除');
                container_list.appendChild(list_span);
                list_span.appendChild(span_content);
                container_list.id = i;
                container_list.classList.add('deletes', 'large');
                list_span.classList.add('delete_btn', 'button2', 'large');
            }
        }
        addDeleteFunctionality();
    }
    function addDeleteFunctionality() {
        let deletes = document.getElementsByClassName('deletes');
        for (var i = 0, de_len = deletes.length; i < de_len; i++) {
            deletes[i].onclick = function () {
                record[this.id] = 'disabled';
                this.id = 'temp';
                var temp = document.getElementById('temp');
                temp.parentNode.removeChild(temp);
                saveAlarms();
            };
        }
    }
    function updateCurrentTime() {
        setTimeout(function () {
            currentDate = new Date();
            alarm_hours = adjustDigit(currentDate.getHours());
            alarm_minutes = adjustDigit(currentDate.getMinutes());
            alarm_seconds = adjustDigit(currentDate.getSeconds());
            timerText.innerHTML = `${alarm_hours}:${alarm_minutes}:${alarm_seconds}`;
            for (var i = 0, len = record.length; i < len; i++) {
                if (record[i].sethour == currentDate.getHours() && record[i].setminute == currentDate.getMinutes() && alarm_seconds == 0) {
                    alert('お時間です!');
                };
            };
            updateCurrentTime();
        }, 500);
    }
    loadAlarms();
    updateCurrentTime();

    window.onerror = function (message, source, lineno, colno, error) {
        const errorLog = document.getElementById('console_error_text');
        const errorMessage = `
            メッセージ: ${message}
            ソース: ${source}
            行: ${lineno}
            列: ${colno}
            エラーオブジェクト: ${error}
        `;
        errorLog.innerHTML += errorMessage + '\n' + '<br>';
        test_alert()
        return false;
    };

    function test_alert() {
        document.querySelectorAll('.error_btn').forEach(btn => btn.remove());
        const errorBtn = document.createElement('span');
        errorBtn.className = "button2 error_btn bold";
        errorBtn.textContent = "✕";
        Object.assign(errorBtn.style, {
            background: "red",
            color: "white"
        });
        document.querySelector('.first_taskbar_buttons').appendChild(errorBtn);
        errorBtn.addEventListener('click', () => {
            console_error_menu.classList.toggle('active');
            console_error_menu.style.zIndex = largestZIndex++;
        });
        taskbar_resize();
    }

    const taskbar_resize = () => {
        setTimeout(() => {
            const taskbar = document.querySelector('#taskbar');
            const taskbtnParent = document.querySelector('.first_taskbar_buttons');
            const taskbtnChild = document.querySelector('.taskbar_buttons');
            const taskbtnRightGroup = document.querySelector('.taskbar_rightgroup');
            taskbtnChild.style.position = "absolute";
            taskbtnChild.style.left = `${taskbtnParent.clientWidth + 70}px`;
            taskbtnChild.style.width = `${taskbar.clientWidth - taskbtnRightGroup.clientWidth - 150}px`;
            const taskheight_parent = document.querySelector('#taskbar');
            const taskheight_child = document.querySelector('.taskbar_buttons');
            taskheight_child.style.height = `${taskheight_parent.clientHeight - + 3}px`;
        }, 100);
    };
    const taskbar_initResize = () => {
        window.addEventListener('resize', allwindow_resize);
        new ResizeObserver(() => taskbar_resize()).observe(document.querySelector('.taskbar_rightgroup'));
    };
    setTimeout(taskbar_initResize, 100);

    window.addEventListener('resize', resize_background_image);
    setTimeout(resize_background_image, 100);

    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            allwindow_resize()
        }
    });
    const allwindow_resizes = document.querySelectorAll('.child_windows');
    allwindow_resizes.forEach(element => resizeObserver.observe(element));
    function allwindow_resize() {
        url_drop_resize()
        resizeTextarea()
        youtubeframe_resize()
        cameraframe_resize()
        url_drop_resize()
        objective_resize()
        window_prompt_resize()
        commandarea_resize()
        shell_resize()
        test_site_resize()
        nexser_nextversion_resize()
        htmlview_resize()
        htmlview_resize2()
        taskbar_resize()
    }

    function console_errortext_clear() {
        document.getElementById('console_error_text').innerHTML = "";
        document.querySelector('.error_btn').remove()
    }

    function kakeibo_setCurrentDateTime() {
        const now = new Date();
        const date = now.toISOString().split('T')[0];
        const time = now.toTimeString().split(' ')[0].slice(0, 5);
        document.getElementById('date').value = date;
        document.getElementById('time').value = time;
    }
    function kakeibo_addEntry() {
        const type = document.getElementById('type').value;
        const amount = parseFloat(document.getElementById('amount').value) || 0;
        const description = document.getElementById('description').value;
        const date = document.getElementById('date').value;
        const time = document.getElementById('time').value;
        const entry = { type, amount, description, date, time };
        kakeibo_saveEntry(entry);
        kakeibo_displayEntries();
        kakeibo_calculateTotal();
    }
    function kakeibo_saveEntry(entry) {
        let entries = JSON.parse(localStorage.getItem('entries')) || [];
        entries.push(entry);
        localStorage.setItem('entries', JSON.stringify(entries));
    }
    function kakeibo_loadEntries() {
        kakeibo_displayEntries();
        kakeibo_calculateTotal();
    }
    function kakeibo_displayEntries() {
        const entries = JSON.parse(localStorage.getItem('entries')) || [];
        const entriesContainer = document.getElementById('entries');
        entriesContainer.innerHTML = '';
        entries.forEach((entry, index) => {
            const entryDiv = document.createElement('div');
            entryDiv.classList.add('entry');
            const color = entry.type === '収入' ? 'red' : 'blue';
            entryDiv.innerHTML = `
                <div class="border" style="color: ${color};"><strong>${entry.type}</strong>: ¥${entry.amount} - ${entry.description} (${entry.date} ${entry.time})</div>
                <button class="button2 medium" onclick="kakeibo_deleteEntry(${index})">削除</button>
            `;
            entriesContainer.appendChild(entryDiv);
        });
    }
    function kakeibo_deleteEntry(index) {
        let entries = JSON.parse(localStorage.getItem('entries')) || [];
        entries.splice(index, 1);
        localStorage.setItem('entries', JSON.stringify(entries));
        kakeibo_displayEntries();
        kakeibo_calculateTotal();
    }
    function kakeibo_calculateTotal() {
        const entries = JSON.parse(localStorage.getItem('entries')) || [];
        let total = 0;
        entries.forEach(entry => {
            if (entry.type === '収入') {
                total += entry.amount;
            } else {
                total -= entry.amount;
            }
        });
        document.getElementById('total').innerText = `¥${total}`;
    }
    kakeibo_loadEntries();
    kakeibo_setCurrentDateTime();

    const slider = document.getElementById('opacitySlider');
    const targetDiv = document.querySelector('.screen_light');
    const valueDisplay = document.getElementById('valueDisplay');
    const savedOpacity = localStorage.getItem('divOpacity');
    if (savedOpacity !== null) {
        targetDiv.style.opacity = 1 - savedOpacity;
        slider.value = savedOpacity * 100;
        valueDisplay.textContent = slider.value;
    }
    slider.addEventListener('input', () => {
        const opacityValue = 1 - (slider.value / 100);
        targetDiv.style.opacity = opacityValue;
        valueDisplay.textContent = slider.value;
        localStorage.setItem('divOpacity', 1 - opacityValue);
    });


    const targetNodes = document.querySelectorAll('.child_windows');
    const config = { attributes: true, childList: true, subtree: true, attributeFilter: ['class', 'style'] };
    let previousActiveCount = 0;
    let previousLargestZIndex = largestZIndex;

    const callback = function (mutationsList) {
        const currentActiveCount = Array.from(targetNodes).filter(node => node.classList.contains('active')).length;
        let zIndexChanged = false;
        if (previousLargestZIndex !== largestZIndex) {
            previousLargestZIndex = largestZIndex;
            zIndexChanged = true;
        }
        if (currentActiveCount !== previousActiveCount || zIndexChanged) {
            previousActiveCount = currentActiveCount;
            zindexwindow_addnavy();
            setTimeout(() => {
                document.getElementsByClassName('focus2')[0].blur();
            }, 0);
        }
    };
    const observer = new MutationObserver(callback);
    targetNodes.forEach(node => observer.observe(node, config));


    navigator.getBattery().then((battery) => {
        function updateChargeInfo() {
            if (battery.level == 1 && battery.charging == true) {
                document.querySelector('.battery_child').style.color = "lime"
                document.querySelector('.battery_child').style.background = "black"
            } else if (battery.charging == false) {
                document.querySelector('.battery_child').style.color = "black"
                document.querySelector('.battery_child').style.background = ""
            } else {
                document.querySelector('.battery_child').style.color = "#FF9900"
                document.querySelector('.battery_child').style.background = "black"
                localStorage.setItem('notice_closekeep', battery)
            }
            if (!battery.charging && 0 <= battery.level && battery.level < 0.21) {
                localStorage.removeItem('notice_closekeep')
            }
            if (0 <= battery.level && battery.level < 0.21 && battery.charging == false && !localStorage.getItem('notice_closekeep')) {
                document.querySelector('.notice_text').textContent = "バッテリー残量が少なくなっています!"
                notice_menu.classList.remove('active')
                notice_menu.style.zIndex = largestZIndex++;
                localStorage.removeItem('notice_closekeep')
            } else {
                notice_menu.classList.add('active')
            }
            if (battery.charging == true) {
                document.getElementsByClassName('battery_time')[0].textContent = (`${battery.dischargingTime}`);
            } else if (battery.charging == false) {
                document.getElementsByClassName('battery_time')[0].textContent = (`${battery.dischargingTime}` + "second");
            }
            let bu = document.getElementsByClassName('taskbattery');
            bu2 = bu[0].textContent = Math.floor(battery.level * 100);
        }
        battery.addEventListener('levelchange', updateChargeInfo);
        battery.addEventListener('chargingchange', updateChargeInfo);
        updateChargeInfo()
    })

    document.querySelectorAll('.window_files').forEach((element, index) => {
        const uniqueKey = `windowfile_time_${index}`;
        element.addEventListener('click', () => {
            let timeElement = element.querySelector('.windowfile_time');
            if (!timeElement) {
                timeElement = document.createElement('li');
                timeElement.className = 'windowfile_time';
                element.appendChild(timeElement);
            }
            const now = new Date();
            const formattedDateTime = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
            timeElement.textContent = formattedDateTime;
            localStorage.setItem(uniqueKey, formattedDateTime);
            filetime_display()
        });
        const savedDateTime = localStorage.getItem(uniqueKey);
        if (savedDateTime) {
            const timeElement = document.createElement('li');
            timeElement.className = 'windowfile_time';
            timeElement.textContent = savedDateTime;
            element.appendChild(timeElement);
            filetime_display()
        }
    });
    function filetime_display() {
        if (!localStorage.getItem('windowfile_1') && !localStorage.getItem('windowfile_2') && !localStorage.getItem('windowfile_3')) {
            document.querySelectorAll('.windowfile_time').forEach(windowfile_time =>
                windowfile_time.style.display = "none"
            );
        }
    }

















    document.addEventListener('DOMContentLoaded', (event) => {
        const draggables = document.querySelectorAll('.window_files');
        const dropZone = document.getElementById('drop_zone');
        const dropList = dropZone.querySelector('ul');

        draggables.forEach(draggable => {
            draggable.setAttribute('draggable', 'true');

            draggable.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', e.target.outerHTML);
            });
        });

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            const data = e.dataTransfer.getData('text/plain');
            dropList.innerHTML += data;

            // 再度ドロップされた要素もドラッグ可能にする
            const newElement = dropList.lastElementChild;
            newElement.setAttribute('draggable', 'true');
            newElement.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', e.target.outerHTML);
            });

            // Save to local storage
            saveToLocalStorage();
        });

        // Load from local storage on page load
        loadFromLocalStorage();
    });

    function saveToLocalStorage() {
        const dropList = document.querySelector('#drop_zone ul');
        localStorage.setItem('dropListContent', dropList.innerHTML);
    }

    function loadFromLocalStorage() {
        const dropList = document.querySelector('#drop_zone ul');
        const savedContent = localStorage.getItem('dropListContent');
        if (savedContent) {
            dropList.innerHTML = savedContent;

            // Make loaded elements draggable
            const loadedElements = dropList.children;
            Array.from(loadedElements).forEach(element => {
                element.setAttribute('draggable', 'true');
                element.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', e.target.outerHTML);
                });
            });
        }
    }



};