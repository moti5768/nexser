let supportsPassive = false;
try {
    const opts = { passive: false, get passive() { supportsPassive = true; return false; } };
    window.addEventListener("testPassive", null, opts);
    window.removeEventListener("testPassive", null, opts);
} catch (e) { }

document.addEventListener('wheel', function (e) {
    if (e.ctrlKey) {
        e.preventDefault();
    }
}, { passive: false });
document.addEventListener('touchmove', function (e) {
    if (e.touches.length > 1) {
        e.preventDefault();
    }
}, { passive: false });

const ua = navigator.userAgent.toLowerCase();
if (ua.includes("mobile")) {
    // Mobile (iPhone、iPad「Chrome、Edge」、Android)
    alert("この端末は対応していません!")
} else if (ua.indexOf("ipad") > -1 || (ua.indexOf("macintosh") > -1 && "ontouchend" in document)) {
    // Mobile (iPad「Safari」)
    alert("この端末は対応していません!")
} else {

    const body = document.querySelector('body');

    const nex = document.getElementById('nex');
    const nex_files = document.getElementById('files');
    const logoff = document.getElementsByClassName('logoff');
    const restart = document.getElementsByClassName('restart');
    const allwindows = document.querySelectorAll('.child_windows');

    const welcome_menu = document.querySelector('.welcome_menu');

    const nexser_guidebook_menu = document.querySelector('.nexser_guidebook_menu');
    const guidebook_window_menu = document.querySelector('.guidebook_window_menu');
    const guidebook_file_menu = document.querySelector('.guidebook_file_menu');
    const guidebook_taskbar_menu = document.querySelector('.guidebook_taskbar_menu');

    const parent_start_menu = document.getElementById('start_menu');
    const child_start_menu = document.querySelector('.child_start_menu');
    const taskbar = document.getElementById('taskbar');
    const toolbar = document.getElementById('toolbar');
    const battery_menu = document.querySelector('.battery_menu');
    const battery_child = document.querySelector('.battery_child');
    const background_text = document.getElementById('background_text');
    const background_text2 = document.getElementById('background_text2');

    const screen_saver_group = document.getElementById('screen_saver_group');

    const nameText = document.querySelector('.name');
    const msg = document.querySelector('.test_name');
    const screen_prompt = document.getElementById('prompt');
    const prompt_text = document.querySelector('.prompt_text');
    const prompt_text_value = document.querySelector('.focus');
    const nexser = document.getElementById('nexser');
    const nexser_program = document.getElementById('nexser_program');
    const desktop = document.getElementById('desktop');
    const pattern_backgrounds = document.getElementsByClassName('pattern_backgrounds')[0];
    const files_inline = document.querySelector('.files_inline');
    const fileElements = document.querySelectorAll('.window_files');
    const z_index = document.querySelector('.z_index');

    const mini_desktop = document.querySelector('.mini_desktop');

    const desktop_version_text = document.querySelector('.desktop_version_text');

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
    const cpu_bench_menu = document.querySelector('.cpu_bench_menu');
    const device_menu = document.querySelector('.device_menu');
    const command_help_menu = document.querySelector('.command_help_menu');
    const omikuji_menu = document.querySelector('.omikuji_menu');
    const localstorage_monitor_menu = document.querySelector('.localstorage_monitor_menu');
    const localstorage_details_menu = document.querySelector('.localstorage_details_menu');
    const paint_menu = document.querySelector('.paint_menu');
    const nexser_files_menu = document.querySelector('.nexser_files_menu');
    const alarm_menu = document.querySelector('.alarm_menu');
    const test_site_menu = document.querySelector('.test_site_menu');
    const kakeibo_menu = document.querySelector('.kakeibo_menu');
    const nexser_nextversion_menu = document.querySelector('.nexser_nextversion_menu');
    const mydocument_menu = document.querySelector('.mydocument_menu');
    const restriction_menu = document.querySelector('.restriction_menu');
    const location_menu = document.querySelector('.location_menu');
    const editor_menu = document.querySelector('.editor_menu');
    const url_droplist_menu = document.querySelector('.url_droplist_menu');

    const nexser_search_menu = document.querySelector('.nexser_search_menu');

    const warning_windows = document.querySelector('.warning_windows');

    const tetris_mneu = document.querySelector('.tetris_menu');
    const bom_menu = document.querySelector('.bom_menu');
    const othello_menu = document.querySelector('.othello_menu');
    const memory_game_menu = document.querySelector('.memory_game_menu');

    const titles = document.querySelectorAll('.title');
    const navys = document.querySelectorAll('.navy');

    const window_selectors = ['.big', '.leftwindow', '.rightwindow'];

    const windowanimation = 0.25;

    // app
    // note
    const note_area = document.querySelector('.note_area');
    // cpubench
    const cpumenu1 = document.querySelector('.cpumenu_1');
    const cpumenu2 = document.querySelector('.cpumenu_2');
    // editor
    const editor_2 = document.getElementById('editor_2');

    document.addEventListener('click', () => {
        if (localStorage.getItem('game_none')) {
            document.querySelectorAll('.game_window:not(.active)').forEach((test) => {
                noticewindow_create("error", "制限されているため、起動ができませんでした");
                test.classList.add('active')
                test.classList.remove('selectwindows')
            })
        }
        bigwindow_resize();
        document.querySelector('.local_memory2').innerHTML = `&emsp;${(calculateLocalStorageSize() / 1024).toFixed(2)}KB&emsp;`;
        removePopups();
        setTimeout(() => {
            firstLoad = false;
        }, 500);
    })

    function game_true() {
        localStorage.setItem('game_none', true)
        document.getElementsByClassName('game_text')[0].textContent = "ON"
    }
    function game_false() {
        localStorage.removeItem('game_none')
        document.getElementsByClassName('game_text')[0].textContent = "OFF"
    }
    if (localStorage.getItem('game_none')) {
        document.getElementsByClassName('game_text')[0].textContent = "ON"
    }

    // マウスドラッグで出てくる水色のエリアの描画
    let startX, startY, isDrawing = false, rectangle;
    nex_files.addEventListener('mousedown', (e) => {
        if (desktop.style.display !== "block") return;
        [startX, startY, isDrawing] = [e.clientX, e.clientY, true];
        rectangle = Object.assign(document.createElement('div'), {
            className: 'rectangle',
            style: {
                left: `${startX}px`,
                top: `${startY}px`
            }
        });
        document.body.appendChild(rectangle);
    });
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    function handleMouseMove(e) {
        if (!isDrawing || desktop.style.display !== "block") return;
        const [currentX, currentY] = [e.clientX, e.clientY];
        const [width, height] = [Math.abs(currentX - startX), Math.abs(currentY - startY)];
        Object.assign(rectangle.style, {
            width: `${width}px`,
            height: `${height}px`,
            left: `${Math.min(startX, currentX)}px`,
            top: `${Math.min(startY, currentY)}px`
        });
    }
    function handleMouseUp() {
        isDrawing = false;
        rectangle_remove();
    }

    document.addEventListener('mousedown', (e) => {
        fileborder_reset()
        var isClickInsideStartButton7 = Array.from(fileElements).some(button => button.contains(e.target));
        if (!isClickInsideStartButton7) {
            Array.from(document.getElementsByClassName('window_files')).forEach((window_files3) => {
                window_files3.classList.remove('file_border2');
                if (window_files3.classList.contains('file_border')) {
                    document.querySelector('.file_border').classList.add('file_border2');
                    document.querySelector('.file_border2').classList.remove('file_border');
                }
            })
        }

        var isClickInsideStartButton = document.getElementById('startbtn').contains(e.target);
        var isClickInsideParentStartMenu2 = document.querySelector('.parentstartmenu2').contains(e.target);
        if (!isClickInsideStartButton && !isClickInsideParentStartMenu2) {
            startmenu_close()
        }
        var isClickInsideStartButton3 = Array.from(document.querySelectorAll('.windowtool_parent,.windowtool_child')).some(button => button.contains(e.target));
        if (!isClickInsideStartButton3) {
            document.querySelectorAll('.windowtool_child').forEach(button => {
                button.style.display = "none";
            });
        }

        var isClickInsideStartButton4 = battery_child.contains(e.target);
        var isClickInsideStartButton4_2 = battery_menu.contains(e.target);
        if (!isClickInsideStartButton4 && !isClickInsideStartButton4_2) {
            battery_menu.style.display = "none";
            battery_child.classList.remove('pressed');
        }

        var isClickInsideStartButton5 = document.querySelector('.lit_button').contains(e.target);
        var isClickInsideStartButton6 = document.querySelector('.screen_light_range_child').contains(e.target);
        if (!isClickInsideStartButton5 && !isClickInsideStartButton6) {
            document.querySelector('.screen_light_range_child').style.display = "none";
            document.querySelector('.lit_button').classList.remove('pressed');
        }

        var isClickInsideStartButton7 = Array.from(document.querySelectorAll('.child_windows, .child')).some(button => button.contains(e.target));
        if (!isClickInsideStartButton7) {
            title_navyremove();
            titlecolor_set();
        }

        var isClickInsideStartButton8 = Array.from(document.querySelectorAll('.task_buttons')).some(button => button.contains(e.target));
        if (!isClickInsideStartButton8) {
            document.querySelectorAll('.task_buttons').forEach(button =>
                button.classList.remove('tsk_pressed', 'pressed')
            );
            updateButtonClasses();
        }
    });

    function lightchild() {
        const screenLightRangeChild = document.querySelector('.screen_light_range_child');
        screenLightRangeChild.style.display = (screenLightRangeChild.style.display === "flex") ? "none" : "flex";
    }

    const tasks = [
        load_nexser,
        getStorage,
        taskbar_none,
        screen_backtextload,
        notecolor_update,
        notetextsize_change,
        taskgroup_load,
        window_back_silver,
        caload,
        titlecolor_set,
        back_pattern_set,
        pageLoad,
        nexser_savedata_load
    ];
    const runTasks = async () => {
        await Promise.all(tasks.map(task => new Promise(resolve => {
            requestAnimationFrame(() => resolve(task()));
        })));
        console.log('tasks completed');
    };
    runTasks();

    function nexser_savedata_load() {
        const t = localStorage.getItem('taskbar_height');
        taskbar.style.height = `${t}px`;
        const task = taskbar.clientHeight;
        if (localStorage.getItem('driver_color')) {
            document.querySelector('.installbutton_2').textContent = "uninstall";
        }
        if (localStorage.getItem('driver_sound')) {
            document.querySelector('.installbutton_1').textContent = "uninstall";
        }
        if (localStorage.getItem('backtext')) {
            background_text.textContent = localStorage.getItem('backtext_data');
            background_text.classList.add('block');
            document.querySelector('.backtext_mode').textContent = "ON";
        }
        if (localStorage.getItem('noteData')) {
            load()
            document.querySelector('.note_title').textContent = "notepad(save keep)";
        }
        if (localStorage.getItem('textdropdata')) {
            load2()
        }
        if (localStorage.getItem('objectiveData') || localStorage.getItem('objectiveTitleData')) {
            objective_load()
        }
        const startupElements = [
            { key: 'startup_note', selector: '.startup_note' },
            { key: 'startup_computer', selector: '.startup_computer' },
            { key: 'startup_color', selector: '.startup_color' },
            { key: 'startup_screen', selector: '.startup_screen' },
            { key: 'startup_htmlviewer_edit', selector: '.startup_htmlviewer_edit' },
            { key: 'startup_guidebook', selector: '.startup_guidebook' },
            { key: 'startup_objective', selector: '.startup_objective' },
            { key: 'startup_calendar', selector: '.startup_calendar' }
        ];
        startupElements.forEach(({ key, selector }) => {
            if (localStorage.getItem(key)) {
                document.querySelector(selector).textContent = "ON";
            }
        });
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
            desktop_version_text.style.display = "block";
        } else {
            desktop_version_text.style.display = "none";
        }

        const startupKeys = ['startup_1', 'startup_2', 'startup_3', 'startup_4', 'startup_5', 'startup_6'];
        startupKeys.forEach(key => {
            const element = document.querySelector(`.${key}`);
            element.textContent = localStorage.getItem(key) ? 'set!' : 'no set';
        });

        const shutdownElements = ['shutdown_1', 'shutdown_2', 'shutdown_3', 'shutdown_4', 'shutdown_5', 'shutdown_6'];
        shutdownElements.forEach(element => {
            const isSet = localStorage.getItem(`${element}`);
            document.querySelector(`.${element}`).textContent = isSet ? "set!" : "no set";
        });

        const styleMap = {
            'note_text_bold': { property: 'fontWeight', value: 'bold' },
            'note_text_oblique': { property: 'fontStyle', value: 'oblique' },
            'note_text_underline': { property: 'textDecoration', value: 'underline' }
        };
        Object.keys(styleMap).forEach(key => {
            if (localStorage.getItem(key)) {
                const { property, value } = styleMap[key];
                note_area.style[property] = value;
                document.querySelector('.test_notetext').style[property] = value;
            }
        });

        if (localStorage.getItem('window_invisible')) {
            document.querySelector('.windowmode').textContent = "invisible"
        }
        if (localStorage.getItem('window_borderblack')) {
            document.querySelector('.windowmode').textContent = "border black"
        }
        if (localStorage.getItem('window_afterimage_false')) {
            document.querySelector('.windowafter').textContent = "OFF"
        }

        const fontMap = {
            'font_default': 'serif',
            'font_sans_serif': 'sans-serif',
            'font_cursive': 'cursive',
            'font_fantasy': 'fantasy',
            'font_monospace': 'monospace'
        };
        Object.keys(fontMap).forEach(key => {
            if (localStorage.getItem(key)) {
                body.style.fontFamily = fontMap[key];
            }
        });

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
            document.querySelector('.taskbar_zindex_0').textContent = "on";
        }
        if (localStorage.getItem('taskbar_leftbtn')) {
            document.querySelector('.taskbar_leftbtn').textContent = "on";
            document.querySelector('.first_taskbar_buttons').style.display = "none";
        }
        if (localStorage.getItem('taskbarbutton_autoadjustment')) {
            document.querySelector('.taskbarbutton_autoadjustment').textContent = "on";
            document.querySelector('.task_icons').classList.add('flex');
        }

        if (localStorage.getItem('taskbar_position_button')) {
            document.querySelector('.taskbar_position_button').textContent = "bottom"
            taskbar.style.top = "0px";
            child_start_menu.style.top = "40px";
            child_start_menu.style.bottom = "auto";
        }

        if (localStorage.getItem('taskbar_position_button') && localStorage.getItem('data_taskbar_none')) {
            files_inline.style.marginTop = "auto";
            files_inline.style.bottom = "";
        } else if (localStorage.getItem('taskbar_position_button') && !localStorage.getItem('data_taskbar_none')) {
            files_inline.style.marginTop = "40px";
            files_inline.style.bottom = "auto";
            files_inline.style.marginTop = `${t}px`;
        } else {
            files_inline.style.marginTop = "auto";
            files_inline.style.bottom = "";
        }

        if (localStorage.getItem('data_taskbar_none') && localStorage.getItem('taskbar_position_button')) {
            toolbar.style.top = `0px`;
        } else if (localStorage.getItem('data_taskbar_none') && !localStorage.getItem('taskbar_position_button')) {
            toolbar.style.bottom = `0px`;
            desktop_version_text.style.bottom = `0px`;
        } else if (localStorage.getItem('taskbar_position_button')) {
            toolbar.style.top = `${task}px`;
            toolbar.style.top = `${t}px`;
            child_start_menu.style.top = `${task}px`;
            child_start_menu.style.top = `${t}px`;
        } else {
            toolbar.style.bottom = `${task}px`;
            toolbar.style.bottom = `${t}px`;
            desktop_version_text.style.bottom = `${task}px`;
            child_start_menu.style.bottom = `${task}px`;
            child_start_menu.style.bottom = `${t}px`;
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
            files_inline.style.display = "none"
        }

        const fontSizeMap = {
            'backtext_small': '15px',
            'backtext_medium': '30px',
            'backtext_large': '45px'
        };
        Object.keys(fontSizeMap).forEach(key => {
            if (localStorage.getItem(key)) {
                const fontSize = fontSizeMap[key];
                background_text.style.fontSize = fontSize;
                background_text2.style.fontSize = fontSize;
            }
        });
        if (localStorage.getItem('allwindow_toolbar')) {
            document.querySelectorAll('.window_tool').forEach(window_tool => window_tool.style.display = "block");
            document.querySelectorAll('.window_inline_side').forEach(window_inline_side => window_inline_side.style.top = "31px");
        } else {
            clock_menu.style.height = "355px"
            document.querySelectorAll('.window_tool').forEach(window_tool => window_tool.style.display = "none");
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

        [2, 3].forEach(saverNum => {
            if (localStorage.getItem(`saver${saverNum}`)) {
                set_saver(saverNum);
            }
        });

        if (localStorage.getItem('taskbar_autohide')) {
            taskbar.style.bottom = "-35px"
        }
        if (localStorage.getItem('taskbar_height') && (localStorage.getItem('taskbar_autohide'))) {
            const t2 = t - 5;
            taskbar.style.bottom = `-${t2}px`;
        }
        if (localStorage.getItem('taskbar_height')) {
            document.getElementsByClassName('taskbar_height_value')[0].value = localStorage.getItem('taskbar_height');
        } else {
            document.getElementsByClassName('taskbar_height_value')[0].value = "40";
        }

        function setBackgroundImage(key, className, resizeFunction) {
            if (localStorage.getItem(key)) {
                document.querySelector(className).style.display = "block";
                resizeFunction();
            }
        }
        setBackgroundImage('wallpaper_95', '.nexser_backgroundimage_1', minidesk_backgroundresize1);
        setBackgroundImage('wallpaper_95_2', '.nexser_backgroundimage_2', minidesk_backgroundresize2);
        setBackgroundImage('wallpaper_xp', '.nexser_backgroundimage_3', minidesk_backgroundresize3);
        setBackgroundImage('wallpaper_space', '.nexser_backgroundimage_4', minidesk_backgroundresize4);
        editorContent_load();
    }

    function taskgroup_load() {
        drawClock();
        const date = new Date();
        const [year, month, day, hours, minutes, seconds] = [
            date.getFullYear(),
            (date.getMonth() + 1).toString().padStart(2, '0'),
            date.getDate().toString().padStart(2, '0'),
            date.getHours().toString().padStart(2, '0'),
            date.getMinutes().toString().padStart(2, '0'),
            date.getSeconds().toString().padStart(2, '0')
        ];
        document.querySelector('.date_day').textContent = `${year}/${month}/${day}`;
        [...document.getElementsByClassName('date_clock')].forEach(element => {
            element.textContent = `${hours}:${minutes}:${seconds}`;
        });
        updateCurrentTime();
    }
    setInterval(taskgroup_load, 1000);

    function load_nexser() {
        localStorage.removeItem('no_shutdown')
        if (localStorage.getItem('password') && !localStorage.getItem('login') && !localStorage.getItem('prompt_data3') && localStorage.getItem('prompt_data')) {
            screen_prompt.style.display = "none";
            nexser_program.style.display = "none";
            nexser.style.display = "block";
            desktop.style.display = "none";
            document.querySelector('.pass_signin_menu').classList.remove('active')
            document.getElementById('pass_form').focus();
        } else if (!localStorage.getItem('start_nexser') && localStorage.getItem('prompt_data')) {
            start_check()
        } else if (localStorage.getItem('prompt_data') && localStorage.getItem('start_nexser')) {
            screen_prompt.style.display = "none";
            nexser_program.style.display = "none";
            nexser.style.display = "block";
            desktop.style.display = "block"
            welcome_menu.classList.add('active');
        } else if (localStorage.getItem('prompt_data3')) {
            screen_prompt.style.display = "none";
            nexser_program.style.display = "block";
            nexser.style.display = "none";
            desktop.style.display = "none";
            nex.style.cursor = 'crosshair';
        } else {
            screen_prompt.style.display = "block";
            nexser_program.style.display = "none";
            nexser.style.display = "none";
            desktop.style.display = "none";
            prompt_text_value.focus();
        }
        if (localStorage.getItem('deskprompt')) {
            nexser_program.style.display = "block";
            desktop.style.display = "none";
            pattern_backgrounds.style.display = "none";
            nex.style.cursor = 'crosshair';
        } else {
            pattern_backgrounds.style.display = "block";
        }

        if (screen_prompt.style.display === "block" && localStorage.getItem('auto_startup')) {
            help_command()
            prompt_text_check()
        }
        sessionStorage.removeItem('start_camera');
        localStorage.removeItem('note_texts');
    }

    document.querySelector('#prompt').addEventListener('click', function () {
        prompt_text_value.focus();
    })

    function startmenu_close() {
        if (parent_start_menu.style.display === "block") {
            parent_start_menu.style.display = "none";
            document.getElementById('startbtn').classList.remove('pressed');
        }
    }
    document.getElementById('startbtn').addEventListener('mousedown', function () {
        if (parent_start_menu.style.display === "block") {
            startmenu_close()
        } else {
            parent_start_menu.style.display = "block";
            document.getElementById('startbtn').classList.add('pressed');
        }
        fileborder_reset()
    })

    battery_child.addEventListener('click', function () {
        if (battery_menu.style.display === "block") {
            battery_menu.style.display = "none";
        } else {
            battery_menu.style.display = "block";
        }
    })

    function addButtonListeners(button) {
        if (!button.classList.contains('listener-added')) {
            const togglePressed = (pressed) => () => button.classList[pressed ? 'add' : 'remove']('pressed');
            button.addEventListener('mousedown', togglePressed(true));
            button.addEventListener('mouseleave', togglePressed(false));
            button.addEventListener('mouseup', togglePressed(false));
            button.classList.add('listener-added');
        }
    }
    const observer_btn = new MutationObserver((mutations) => {
        mutations.forEach(({ addedNodes }) => {
            addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('button2')) {
                    addButtonListeners(node);
                }
            });
        });
    });
    observer_btn.observe(document.body, { childList: true, subtree: true });

    function addButtonListeners2(button) {
        if (!button.classList.contains('listener-added')) {
            button.addEventListener('click', () => button.classList.toggle('pressed'));
            button.classList.add('listener-added');
        }
    }
    const observer_btn2 = new MutationObserver((mutations) => {
        mutations.forEach(({ addedNodes }) => {
            addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('button')) {
                    addButtonListeners2(node);
                }
            });
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
        playBeep();
        startmenu_close();
        document.querySelectorAll('video').forEach(video => video.pause());
        startProgress(20);
        desktop.style.display = "none";
        pattern_backgrounds.style.display = "none";
        welcome_menu.classList.add('active');
        welcome_menu.classList.remove('selectwindows');
        nex.style.cursor = 'crosshair';
        setTimeout(function () {
            screen_prompt.style.display = "none";
            taskbar_none();
            nexser_program.style.display = "block";
        }, 100);
    }

    function nexser_program_close() {
        nex.style.cursor = '';
        if (!localStorage.getItem('deskprompt')) {
            setTimeout(function () {
                localStorage.removeItem('prompt_data3')
                screen_prompt.style.display = "block";
                setTimeout(function () {
                    taskbar_none();
                    nexser_program.style.display = "none";
                    prompt_text_value.focus();
                }, 100);
            }, 100);
        } else {
            nexser_program.style.display = "none";
            localStorage.removeItem('deskprompt');
            setTimeout(() => {
                desktop.style.display = "block";
                pattern_backgrounds.style.display = "block";
            }, 500);
        }

        setTimeout(() => {
            const task = taskbar.clientHeight;
            if (localStorage.getItem('taskbar_position_button')) {
                toolbar.style.top = `${task}px`;
                child_start_menu.style.top = `${task}px`
            } else {
                toolbar.style.bottom = `${task}px`;
                child_start_menu.style.bottom = `${task}px`
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

    const font_clear = () =>
        ['font_serif', 'font_sans_serif', 'font_cursive', 'font_fantasy', 'font_monospace'].forEach(item => localStorage.removeItem(item));

    const setFont = font => {
        font_clear();
        localStorage.setItem(`font_${font}`, true);
        document.body.style.fontFamily = font;
    };

    ['sans_serif', 'cursive', 'fantasy', 'monospace', 'serif'].forEach(font =>
        document.querySelector(`.font_${font}`).addEventListener('click', () => setFont(font))
    );

    function nexser_boot_check() {
        if (localStorage.getItem('driver_sound')) {
            nexser_start()
            nex.style.cursor = 'none';
        } else if (!localStorage.getItem('driver_sound') && !localStorage.getItem('start_nexser')) {
            screen_prompt.style.display = "none";
            document.querySelector('.nexser_boot_menu').style.display = "block";
            document.querySelector('.nexser_bootmenu_text').textContent = "サウンドドライバー がインストールされていません!";
            document.querySelector('.nexser_bootmenu_text2').textContent = "インストールして nexser を起動しますか?";
        } else {
            nexser_start()
            nex.style.cursor = 'none';
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
        if (document.querySelector('.password').value === "") {
            noticewindow_create("warning", "パスワードが入力されていません!", "warning");
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
            nex.style.cursor = '';
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
        if (password_unlock2 === document.getElementById('pass_form').value) {
            firstLoad = false;
            document.querySelector('.pass_signin_menu').classList.add('active')
            document.querySelector('.pass_no').textContent = "";
            start_check();
            localStorage.setItem('login', true);
            document.getElementById('pass_form').value = "";
        } else {
            document.querySelector('.pass_no').textContent = "パスワードが違います!";
            document.getElementById('pass_form').focus();
        }
    }

    function nexser_start() {
        const nexser = document.querySelector("#nexser");
        document.querySelector('.nexser_boot_menu').style.display = "none";
        localStorage.setItem('prompt_data', true);
        nexser.style.backgroundColor = "";
        ['#code_html', '#code_script', '#code_script2'].forEach(id => document.querySelector(id).style.display = "none");
        prompt_text_value.blur();
        window_none();
        startmenu_close();
        nex.style.cursor = 'none';
        const showNexser = (delay) => {
            setTimeout(() => {
                screen_prompt.style.display = "none";
                setTimeout(() => {
                    nexser.style.display = "block";
                    setTimeout(() => {
                        pass_check();
                        taskbar_none();
                        if (localStorage.getItem('login_welcome') && !localStorage.getItem('password')) {
                            welcome();
                        }
                    }, delay);
                }, delay);
                nex.style.cursor = 'progress';
                pattern_backgrounds.style.display = "block";
            }, delay);
        };
        if (localStorage.getItem('prompt_data2')) {
            startProgress(20);
            showNexser(100);
        } else {
            startProgress(1);
            showNexser(1500);
        }
    }


    Array.from(logoff).forEach(element => {
        element.addEventListener('click', event => {
            nex.style.cursor = 'progress';
            startmenu_close()
            setTimeout(() => {
                if (sessionStorage.getItem('start_camera')) {
                    noticewindow_create("error", "カメラが実行されているため、ログオフできません!");
                } else if (localStorage.getItem('no_shutdown')) {
                    noticewindow_create("error", "welcomeウィンドウが起動するまでログオフできません!");
                } else if (gets === gets2 && gets3 === 0) {
                    sound_stop();
                    shutdown_sound();
                    localStorage.removeItem('login');
                    nex.style.cursor = 'none';
                    desktop.style.display = "none";
                    if (!localStorage.getItem('noteData')) {
                        document.note_form.note_area.value = "";
                        resetShowLength();
                        document.querySelector('.note_title').textContent = "notepad"
                    }
                    setTimeout(() => {
                        document.querySelectorAll('.testwindow2').forEach(testwindow2 => testwindow2.remove());
                        document.querySelectorAll('.error_windows').forEach(errorwindow => errorwindow.remove());
                        window_none();
                        window_reset();
                        localStorage.removeItem('prompt_data');
                        document.querySelector('#code_html').style.display = "none";
                        document.querySelector('#code_script').style.display = "none";
                        document.querySelector('#code_script2').style.display = "none";
                        fileborder_reset();
                        document.querySelector('.black_screen').style.display = "none";
                        setTimeout(() => {
                            document.querySelectorAll('.button').forEach(button => button.classList.remove('pressed'));
                            nameText.value = "";
                            msg.innerText = "";
                            prompt_text.style.color = "";
                            nexser.style.display = "none";
                            screen_prompt.style.display = "block";
                            prompt_text_value.focus();
                            nex.style.cursor = '';
                        }, 500);
                    }, 1000);
                } else {
                    warning_windows.style.display = "block";
                    document.querySelector('.close_button3').style.display = "block"
                    document.querySelector('.shutdown_button').style.display = "block";
                    document.querySelector('.warningclose_button').style.display = "none";
                    document.querySelector('.warning_title_text').textContent = "warning";
                    document.querySelector('.window_warning_text').textContent = "実行されているウィンドウがあります! ログオフしますか?";
                    document.querySelector('.black_screen').style.display = "block";
                    sound(4);
                    nex.style.cursor = '';
                }
            }, 100);
        })
    })

    Array.from(restart).forEach(element => {
        element.addEventListener('click', event => {
            nexser_restart()
        })
    })

    function nexser_restart() {
        nex.style.cursor = 'progress';
        startmenu_close()
        setTimeout(() => {
            if (sessionStorage.getItem('start_camera')) {
                noticewindow_create("error", "カメラが実行されているため、再起動はできません!");
            } else if (localStorage.getItem('no_shutdown')) {
                noticewindow_create("error", "welcomeウィンドウが起動するまで再起動はできません!");
            } else if (gets === gets2 && gets3 === 0) {
                sound_stop();
                shutdown_sound();
                localStorage.removeItem('login');
                nex.style.cursor = 'none';
                desktop.style.display = "none";
                if (!localStorage.getItem('noteData')) {
                    document.note_form.note_area.value = "";
                    resetShowLength();
                    document.querySelector('.note_title').textContent = "notepad"
                }
                setTimeout(() => {
                    window_none();
                    window_reset();
                    document.querySelector('#code_html').style.display = "none";
                    document.querySelector('#code_script').style.display = "none";
                    document.querySelector('#code_script2').style.display = "none";
                    fileborder_reset();
                    document.querySelector('.focus2').textContent = "";
                    setTimeout(() => {
                        document.querySelectorAll('.button').forEach(button => button.classList.remove('pressed'));
                        nameText.value = "";
                        msg.innerText = "";
                        prompt_text.style.color = "";
                        nexser.style.display = "none";
                        document.querySelector('.restart_text').style.display = "block";
                    }, 500);
                    setTimeout(() => {
                        document.querySelector('.restart_text').style.display = "none";
                    }, 2500);
                    setTimeout(() => {
                        nexser_start();
                    }, 3500);
                }, 1500);
            } else {
                noticewindow_create("error", "全てのウィンドウが閉じてないため、再起動できません!");
            }
        }, 100);
    }

    function start_check() {
        document.getElementsByClassName('pass_signin_menu')[0].classList.remove('selectwindows');
        if (localStorage.getItem('login_welcome') && localStorage.getItem('password')) {
            localStorage.setItem('no_shutdown', true);
        };
        const t = localStorage.getItem('taskbar_height');
        nex_files.style.display = "none";
        nex.style.cursor = 'none';
        taskbar.style.display = "none";
        nex_files.style.display = "none";
        if (!localStorage.getItem('start_nexser') || desktop.style.display === "block") {
            screen_prompt.style.display = "none";
            nexser_program.style.display = "none";
            nexser.style.display = "block";
            desktop.style.display = "none";
            welcome_menu.classList.remove('active');
            welcome_animation();
        } else {
            startup_sound();
            screen_prompt.style.display = "none";
            nexser_program.style.display = "none";
            nexser.style.display = "block";
            welcome_menu.classList.add('active');
            setTimeout(() => {
                desktop.style.display = "block";
                toolbar.style.display = "block";
                toolbar.style.top = "";
                toolbar.style.left = "";
                toolbar.style.bottom = "0px";
            }, 500);
            setTimeout(() => {
                setColor();
                nex.style.cursor = '';
                toolbar.style.display = "none";
            }, 1500);
            setTimeout(() => {
                startup_window_open();
                if (localStorage.getItem('toolbar_on')) {
                    toolbar.style.display = "block";
                }
                if (localStorage.getItem('taskbar_position_button')) {
                    taskbar.style.display = "block";
                    toolbar.style.bottom = "";
                    toolbar.style.left = "";
                    toolbar.style.top = "40px";
                    toolbar.style.top = `${t}px`;
                    files_inline.style.marginTop = `${t}px`;
                    if (localStorage.getItem('data_taskbar_none')) {
                        taskbar.style.display = "none";
                        toolbar.style.top = "0px";
                        files_inline.style.marginTop = "0px";
                    } else {
                        taskbar.style.display = "block";
                        toolbar.style.top = "40px";
                        toolbar.style.top = `${t}px`;
                        const task = taskbar.clientHeight;
                        child_start_menu.style.top = `${task}px`;
                    }
                } else {
                    taskbar.style.display = "block";
                    toolbar.style.top = "";
                    toolbar.style.left = "";
                    toolbar.style.bottom = "40px";
                    toolbar.style.bottom = `${t}px`;
                    const task = taskbar.clientHeight;
                    child_start_menu.style.bottom = `${task}px`;
                    if (localStorage.getItem('data_taskbar_none')) {
                        taskbar.style.display = "none";
                        toolbar.style.bottom = "0px";
                        desktop_version_text.style.bottom = "0px"
                    } else {
                        taskbar.style.display = "block";
                        toolbar.style.bottom = "40px";
                        toolbar.style.bottom = `${t}px`;
                        desktop_version_text.style.bottom = `${task}px`
                    }
                }
                nex_files.style.display = "block";
                setTimeout(() => {
                    if (localStorage.getItem('login_welcome') && localStorage.getItem('password')) {
                        welcome()
                        localStorage.removeItem('no_shutdown')
                    };
                }, 5000);
                noticewindow_create("Nexser", "読み込んでいます...");
                document.querySelectorAll('.error_windows').forEach(errorwin => errorwin.remove());
            }, 2000);
        }
    }

    function nexser_on() {
        localStorage.setItem('start_nexser', true);
        welcome_menu.classList.replace('selectwindows', 'active');
        setTimeout(() => {
            [desktop, nex_files, taskbar].forEach(el => el.style.display = "block");
            const task = taskbar.clientHeight;
            Object.assign(toolbar.style, { top: "", left: "", bottom: "40px" });
            [child_start_menu, desktop_version_text].forEach(el => el.style.bottom = `${task}px`);
            localmemory_size();
            setTimeout(() => {
                setColor();
                nex.style.cursor = '';
                startup_window_open();
            }, 500);
        }, 250);
    }

    document.querySelector('.login_welcome').addEventListener('click', () => {
        localStorage.setItem('login_welcome', true);
    });
    document.querySelector('.nologin_welcome').addEventListener('click', () => {
        localStorage.removeItem('login_welcome');
    });

    function welcome_animation() {
        sound_stop();
        sound(6);
        welcome_menu.style.zIndex = largestZIndex++;
        const [startNexser, welcomeText1, welcomeUnderline, welcomeText2, welcomeIcons] = [
            document.getElementsByClassName('start_nexser')[0],
            document.getElementsByClassName('welcome_text1')[0],
            document.getElementsByClassName('welcome_underline')[0],
            document.getElementsByClassName('welcome_text2')[0],
            document.getElementsByClassName('welcome_icons')[0],
        ];
        nex.style.cursor = 'none';
        startNexser.style.display = 'none';
        welcomeText1.style.position = 'absolute';
        welcomeText1.style.fontSize = '80px';
        welcomeText1.style.marginTop = '125px';
        welcomeText1.style.marginLeft = '50px';
        welcomeUnderline.style.right = '0';
        welcomeUnderline.style.width = '0';
        welcomeText2.style.display = 'none';
        welcomeIcons.style.display = 'none';
        setTimeout(() => {
            welcomeText1.style.transition = '0.25s cubic-bezier(0, 0, 1, 1)';
            welcomeText1.style.fontSize = '40px';
            welcomeText1.style.marginTop = '0';
            welcomeText1.style.marginLeft = '0';
        }, 500);
        setTimeout(() => {
            welcomeUnderline.style.transition = '0.25s cubic-bezier(0, 0, 1, 1)';
            welcomeUnderline.style.width = '100%';
            setTimeout(() => {
                welcomeText2.style.display = 'block';
                welcomeIcons.style.display = 'block';
                nex.style.cursor = '';
                if (!localStorage.getItem('start_nexser')) {
                    startNexser.style.display = 'block';
                } else {
                    document.getElementsByClassName('startnexser_close')[0].classList.remove('pointer_none');
                }
            }, 300);
        }, 1000);
    }

    function welcome() {
        welcome_menu.classList.remove('active');
        welcome_animation();
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
        if (localStorage.getItem('password') && gets === gets2) {
            welcome_menu.classList.add('active');
            localStorage.removeItem('login');
            document.getElementById('desktop').style.display = "none";
            window_none();
            window_reset();
            document.querySelector('.pass_signin_menu').classList.remove('active')
            sound_stop();
            document.getElementById('pass_form').focus();
        } else if (localStorage.getItem('password') && gets != gets2) {
            noticewindow_create("error", "全てのウィンドウを終了してください!");
        } else {
            noticewindow_create("error", "パスワードを登録していないため、サインアウトができません!");
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

    function handleStartupClick(startupClass) {
        startupsound_reset();
        const startupElement = document.querySelector(`.${startupClass}`);
        const isSet = localStorage.getItem(startupClass);
        startupElement.textContent = isSet ? "no set" : "set!";
        if (!isSet) {
            localStorage.setItem(startupClass, true);
        }
    }

    document.querySelector('.startup_1').addEventListener('click', () => handleStartupClick('startup_1'));
    document.querySelector('.startup_2').addEventListener('click', () => handleStartupClick('startup_2'));
    document.querySelector('.startup_3').addEventListener('click', () => handleStartupClick('startup_3'));
    document.querySelector('.startup_4').addEventListener('click', () => handleStartupClick('startup_4'));
    document.querySelector('.startup_5').addEventListener('click', () => handleStartupClick('startup_5'));
    document.querySelector('.startup_6').addEventListener('click', () => handleStartupClick('startup_6'));

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

    document.querySelector('.shutdown_1').addEventListener('click', () => handleShutdownClick('shutdown_1'));
    document.querySelector('.shutdown_2').addEventListener('click', () => handleShutdownClick('shutdown_2'));
    document.querySelector('.shutdown_3').addEventListener('click', () => handleShutdownClick('shutdown_3'));
    document.querySelector('.shutdown_4').addEventListener('click', () => handleShutdownClick('shutdown_4'));
    document.querySelector('.shutdown_5').addEventListener('click', () => handleShutdownClick('shutdown_5'));
    document.querySelector('.shutdown_6').addEventListener('click', () => handleShutdownClick('shutdown_6'));

    function shutdownsound_reset() {
        const shutdownKeys = ['shutdown_1', 'shutdown_2', 'shutdown_3', 'shutdown_4', 'shutdown_5', 'shutdown_6'];
        shutdownKeys.forEach(key => {
            if (localStorage.getItem(key)) {
                localStorage.removeItem(key);
                document.querySelector(`.${key}`).textContent = "no set";
            }
        });
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
        background_text.textContent = localStorage.getItem('backtext_data');
        background_text.classList.add('block');
        document.querySelector('.backtext_mode').textContent = "ON"
    })
    document.getElementById('backtext_off').addEventListener('click', function () {
        localStorage.removeItem('backtext');
        background_text.classList.remove('block');
        document.querySelector('.backtext_mode').textContent = "OFF"
    })


    document.querySelector('.backtext_small').addEventListener('click', function () {
        backtextSize_clear();
        localStorage.setItem('backtext_small', true);
        background_text.style.fontSize = "15px";
        background_text2.style.fontSize = "15px";
    })
    document.querySelector('.backtext_medium').addEventListener('click', function () {
        backtextSize_clear();
        localStorage.setItem('backtext_medium', true);
        background_text.style.fontSize = "30px";
        background_text2.style.fontSize = "30px";
    })
    document.querySelector('.backtext_large').addEventListener('click', function () {
        backtextSize_clear();
        localStorage.setItem('backtext_large', true);
        background_text.style.fontSize = "45px";
        background_text2.style.fontSize = "45px";
    })

    function backtextSize_clear() {
        background_text.style.fontSize = "";
        background_text2.style.fontSize = "";
        localStorage.removeItem('backtext_small');
        localStorage.removeItem('backtext_medium');
        localStorage.removeItem('backtext_large');
    }

    function window_reset() {
        allwindows.forEach(allwindow => {
            allwindow.style.left = "";
            allwindow.style.top = "";
            allwindow.style.height = "";
            allwindow.style.width = "";
            const notearea = note_area;
            notearea.style.height = "";
            notearea.style.width = "";
            windowposition_reset();
            allwindow.classList.remove('leftwindow', 'rightwindow', 'child_windows_invisible');
            allwindow.style.transition = "";
            document.querySelector('.bigscreen_button').style.visibility = "visible";
            document.querySelector('.minscreen_button').style.visibility = "visible";
            document.querySelector('.minimization_button').style.visibility = "visible";
            allwindow.classList.remove('minimization', 'selectwindows');
        });
        bom_reset();
        timerstop();
        timerreset();
        cpubench_clear();
        cpubench_reset();
        prompt2_text_clear();
        calc_clear();
        resetGame();
        nexser_prompt_reset();
        document.querySelector('.password').value = "";
        document.getElementById('pass_form').value = "";
    }

    function window_none() {
        document.querySelectorAll('.task_buttons').forEach(task_buttons => task_buttons.remove());
        document.querySelectorAll('.testwindow2').forEach(task_buttons => task_buttons.remove());
        document.querySelectorAll('.error_windows').forEach(task_buttons => task_buttons.remove());
        allwindows.forEach(allwindow_none => {
            allwindow_none.classList.add('active');
            allwindow_none.classList.remove('big', 'rightwindow', 'leftwindow', 'selectwindows');
            allwindow_none.style.right = "";
            allwindow_none.style.transition = "";
        });
        windowposition_reset();
        note_area.style.height = "";
        note_area.style.width = "";
        warning_windows.style.display = "none";
    }
    function window_active() {
        document.querySelectorAll('.child_windows:not(.window_nosearch)').forEach(allwindow_active => allwindow_active.classList.remove('active'));
    }

    function title_center() {
        titles.forEach(title => {
            title.classList.add('text_center');
            localStorage.setItem('title_center', true);
        });
    }

    function title_center_reset() {
        titles.forEach(title => {
            title.classList.remove('text_center');
            localStorage.removeItem('title_center');
        });
    }

    if (localStorage.getItem('title_center')) {
        title_center()
    }

    Array.from(document.getElementsByClassName('nexser_title_text')).forEach((nexser_title_text) => {
        const nexserTitle = document.querySelector('.nexser_title').textContent;
        nexser_title_text.textContent = nexserTitle;
    })

    function allStorage_clear() {
        const alllength = localStorage.length;
        if (alllength > 0) {
            noticewindow_create("warning", "nexserのデータを全削除しました。3秒後に再ロードします", "nexser");
            if (sessionStorage.getItem('start_camera')) {
                stopCamera()
            }
            sessionStorage.clear();
            localStorage.clear();
        }
    }

    function colordata_clear() {
        body.style.color = "";
        document.querySelector("#nexser").style.backgroundColor = "";
        mini_desktop.style.backgroundColor = "";
        localStorage.removeItem(KEY_COLOR, color);
        localStorage.removeItem(KEY_BKCOLOR, bkcolor);
        background_text.style.color = ""
        background_text2.style.color = ""
        Array.from(document.getElementsByClassName('desktop_files')).forEach((desktop_files) => {
            const deskfile_text = desktop_files.firstElementChild;
            deskfile_text.style.color = ""
        })
    }

    function taskbar_autohide() {
        const t = localStorage.getItem('taskbar_height');
        localStorage.setItem('taskbar_autohide', true);
        taskbar.style.bottom = "-35px";
        if (localStorage.getItem('taskbar_height') && (localStorage.getItem('taskbar_autohide'))) {
            const t2 = t - 5;
            taskbar.style.bottom = `-${t2}px`;
        }
        desktopfile_resize()
    }
    function taskbar_reset() {
        localStorage.removeItem('taskbar_autohide');
        taskbar.style.bottom = "";
        desktopfile_resize()
    }

    document.querySelectorAll('#taskbar').forEach(taskbar => {
        taskbar.addEventListener('mouseleave', () => {
            if (localStorage.getItem('taskbar_height') && localStorage.getItem('taskbar_autohide')) {
                const t = localStorage.getItem('taskbar_height');
                const t2 = t - 5;
                taskbar.style.bottom = `-${t2}px`;
            } else if (localStorage.getItem('taskbar_autohide')) {
                taskbar.style.bottom = "-35px";
            }
            bigwindow_resize();
        });
        taskbar.addEventListener('mouseover', () => {
            taskbar.style.bottom = "";
            bigwindow_resize();
        });
    });

    document.querySelectorAll('.child_start_menu').forEach(child_start_menu => {
        child_start_menu.addEventListener('mouseleave', () => {
            if (localStorage.getItem('taskbar_height') && localStorage.getItem('taskbar_autohide')) {
                const t = localStorage.getItem('taskbar_height');
                const t2 = t - 5;
                taskbar.style.bottom = `-${t2}px`;
            } else if (localStorage.getItem('taskbar_autohide')) {
                taskbar.style.bottom = "-35px";
            }
        });
        child_start_menu.addEventListener('mouseover', () => {
            taskbar.style.bottom = "";
        });
        child_start_menu.addEventListener('click', () => {
            titlecolor_set();
        });
    });

    function taskbar_none() {
        if (localStorage.getItem('data_taskbar_none')) {
            taskbar.style.display = "none";
            toggleWindow(my_computer);
            if (localStorage.getItem('taskbar_position_button')) {
                toolbar.style.top = "0px";
            } else {
                toolbar.style.bottom = "0px";
            }
        }

        if (localStorage.getItem('taskbar_position_button') && localStorage.getItem('data_taskbar_none')) {
            files_inline.style.marginTop = "auto"
            files_inline.style.bottom = ""
        } else if (localStorage.getItem('taskbar_position_button') && !localStorage.getItem('data_taskbar_none')) {
            files_inline.style.marginTop = "40px"
            files_inline.style.bottom = "auto"
        } else {
            files_inline.style.marginTop = "auto"
            files_inline.style.bottom = ""
        }

        if (localStorage.getItem('data_taskbar_none')) {
            window_selectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(element => element.style.top = "auto");
            });
        } else if (localStorage.getItem('taskbar_position_button')) {
            window_selectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(element => {
                    element.style.transition = "";
                    element.style.top = "40px";
                });
            });
        }
    }

    function taskbar_active() {
        localStorage.removeItem('data_taskbar_none');
        taskbar.style.display = "block";
        const task = taskbar.clientHeight;
        const t = localStorage.getItem('taskbar_height');
        taskbar.style.height = `${t}px`;
        toggleWindow(my_computer);

        if (check(elm1, elm2) && !localStorage.getItem('taskbar_position_button')) {
            toolbar.style.bottom = `${task}px`;
            files_inline.style.marginTop = `${task}px`;
        } else if (check(elm1, elm2)) {
            toolbar.style.bottom = "";
        }
        if (check(elm1, elm2) && localStorage.getItem('taskbar_position_button')) {
            toolbar.style.top = `${task}px`;
            files_inline.style.marginTop = `${task}px`;
        } else if (check(elm1, elm2)) {
            toolbar.style.top = "";
        }

        if (localStorage.getItem('data_taskbar_none')) {
            window_selectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(element => element.style.top = "auto");
            });
        } else if (localStorage.getItem('taskbar_position_button')) {
            window_selectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(element => {
                    element.style.transition = "";
                    element.style.top = "40px";
                    element.style.top = `${task}px`;
                });
            });
        }

        if (localStorage.getItem('taskbar_position_button') && localStorage.getItem('data_taskbar_none')) {
            files_inline.style.marginTop = "auto";
            files_inline.style.bottom = "";
        } else if (localStorage.getItem('taskbar_position_button') && !localStorage.getItem('data_taskbar_none')) {
            files_inline.style.marginTop = `${task}px`;
            files_inline.style.bottom = "auto";
        } else {
            files_inline.style.marginTop = "auto";
            files_inline.style.bottom = "";
        }
    }

    function help_command() {
        prompt_text_value.value = "nexser/open"
    }

    function help_command2() {
        prompt_text_value.value = "nexser/program"
    }

    function help_command_clear() {
        prompt_text_value.value = ""
    }

    function pageLoad() {
        nameText.addEventListener('keydown', enterKeyPress);
        function enterKeyPress(event) {
            if (event.key === 'Enter') {
                butotnClick();
                firstLoad = false;
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
        input.disabled = true;
        document.querySelector('.name2').classList.add('pointer_none');
        document.querySelector('.name2').classList.remove('name2');
        document.querySelector('.focus2').classList.remove('focus2');
        const newInputContainer = document.createElement('div');
        newInputContainer.className = 'input_container prompt_hukusei2';
        newInputContainer.innerHTML = `<span class="small">nexser/></span><textarea rows="1" class="command_input2 name2 focus2" style="height: auto; width: 100%;" placeholder="|" onkeydown="commandarea_resize(),handleKeyDown(event, this)"></textarea>`;
        document.getElementById('form_container').appendChild(newInputContainer);
        setTimeout(() => {
            document.getElementsByClassName('focus2')[0].focus()
        }, 0);
    }

    function executeCommand2() {
        const name = document.getElementsByClassName('focus2')[0].value;
        document.querySelector('.name2').classList.remove('name2');
        const newInputContainer = document.createElement('div');
        newInputContainer.className = 'input_container prompt_hukusei2　pointer_none';
        newInputContainer.innerHTML = `<span class="command_input2 name2 miss" style="color: red; height: 100%; width: 100%;">'${name}' は操作可能なプログラムとして認識されていません。</span>`;
        document.getElementById('form_container').appendChild(newInputContainer);
    }

    function commandarea_resize() {
        const textarea = document.querySelector('.focus2');
        textarea.addEventListener('input', () => {
            textarea.style.height = textarea.scrollHeight + 'px';
        });
    }

    function nexser_prompt_reset() {
        setTimeout(() => {
            document.querySelectorAll('.prompt_hukusei2, .miss').forEach(prompt_hukusei2 => {
                prompt_hukusei2.remove();
            });
            document.querySelector('.command2').classList.add('name2', 'focus2');
            document.querySelector('.command2').classList.remove('pointer_none');
            document.querySelector('.command2').disabled = false;
            document.getElementsByClassName('focus2')[0].focus();
            document.querySelector('.focus2').style.height = "";
            prompt2_text_clear();
        }, 0);
    }

    function prompt_text_check() {
        const prompt_text_value2 = prompt_text_value.value;
        switch (prompt_text_value2) {
            case '':

                msg.innerText = "";
                prompt_text.style.color = "";
                break;
            case 'nexser/open':
                prompt_text.style.color = "yellow";
                nameText.value = "nexser boot...";
                nexser_boot_check();
                break;
            case 'nexser/program':
                localStorage.setItem('prompt_data3', true);
                prompt_text.style.color = "";
                nexser_program_open()
                break;

            case 'nexser/code/html':
                prompt_text.style.color = "";
                document.querySelector('#code_html').style.display = "block";
                document.querySelector('#code_script').style.display = "none";
                document.querySelector('#code_script2').style.display = "none";
                break;
            case 'nexser/code/script':
                prompt_text.style.color = "";
                document.querySelector('#code_html').style.display = "none";
                document.querySelector('#code_script').style.display = "block";
                document.querySelector('#code_script2').style.display = "none";
                break;
            case 'nexser/code/script2':
                prompt_text.style.color = "";
                document.querySelector('#code_html').style.display = "none";
                document.querySelector('#code_script').style.display = "none";
                document.querySelector('#code_script2').style.display = "block";
                break;
            default:
                msg.innerText = "";
                prompt_text.style.color = "red";
                break;
        }
    }

    function prompt_text_check2() {

        const prompt_text_value3 = document.getElementsByClassName('focus2')[0].value;
        const prompt_text_value4 = prompt_text_value3;

        const command_1 = "backgroundColor()=>";
        const a = prompt_text_value4.substring(19);

        const command_2 = "textColor()=>";
        const b = prompt_text_value4.substring(13);

        const command_3 = "alert()=>";
        const c = prompt_text_value4.substring(9);

        const command_4 = "math()=>";
        const d = prompt_text_value4.substring(8);

        const command_5 = "console(num)=>";
        const e = prompt_text_value4.substring(14);

        const command_6 = "console(str)=>";
        const f = prompt_text_value4.substring(14);

        const command_7 = "binary(10->2)=>";
        const g = prompt_text_value4.substring(15);

        const command_8 = "binary(2->10)=>";
        const h = prompt_text_value4.substring(15);

        const command_9 = "program(num->text)=>";
        const i2 = prompt_text_value4.substring(20);

        const command_10 = "program(context->text)=>";
        const j = prompt_text_value4.substring(24);

        const command_11 = "program(text->num)=>";
        const k = prompt_text_value4.substring(20);

        const command_12 = "program(text->context)=>";
        const l = prompt_text_value4.substring(24);

        switch (prompt_text_value4) {

            case command_1 + a:
                if (localStorage.getItem('driver_color')) {
                    document.querySelector('#nexser').style.background = a;
                    localStorage.setItem('BKCOLOR', a);
                    wallpaper_allremove()
                } else {
                    noticewindow_create("error", "カラードライバーがインストールされていません!")
                }
                break;

            case command_2 + b:
                if (localStorage.getItem('driver_color')) {
                    body.style.color = b;
                    localStorage.setItem('COLOR', b);
                } else {
                    noticewindow_create("error", "カラードライバーがインストールされていません!")
                }
                break;

            case command_3 + c:
                alert(c);
                break;

            case command_4 + d:
                var result5 = Function('return (' + d + ');')();
                document.querySelector('#shell').textContent = result5;
                shellmenu_open()
                break;

            case command_5 + e:
                var result2 = Function('return (' + e + ');')();
                document.querySelector('#shell').value = result2;
                shellmenu_open()
                break;

            case command_6 + f:
                document.querySelector('#shell').value = f;
                shellmenu_open()
                break;

            case command_7 + g:
                const g2 = parseInt(g);
                document.querySelector('#shell').value = (g2.toString(2));
                shellmenu_open()
                break;

            case command_8 + h:
                const h2 = parseInt(h, 2);
                document.querySelector('#shell').value = (h2.toString(10));
                shellmenu_open()
                break;

            case command_9 + i2:
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
                        preview.srcdoc = test999;
                        toggleWindow(htmlviewer_run_menu)
                    }, 500);
                }, 100);
                break;

            case command_10 + j:
                let newStr2 = (String(j)

                    .replaceAll("{h}", "<html>").replaceAll("{/h}", "</html>")
                    .replaceAll("{class}", "class=")
                    .replaceAll("{id}", "id=")
                    .replaceAll("{ne}", "name=")
                    .replaceAll("{ve}", "value=")

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
                    .replaceAll("{s", "<script")

                    .replaceAll("{conlog}", "console.log")

                    .replaceAll("{dmt}", "document")
                    .replaceAll("{gid}", "getElementById")
                    .replaceAll("{qes}", "querySelector")
                    .replaceAll("{qesall}", "querySelectorAll")

                    .replaceAll("{texcon}", "textContent")
                    .replaceAll("{intext}", "innerText")
                    .replaceAll("{inhtml}", "innerHTML")

                    .replaceAll("{addevlis}", "addEventListener")
                    .replaceAll("{onclk}", "onclick")
                    .replaceAll("{func}", "function")
                    .replaceAll("$l_storage.", "localStorage.")
                    .replaceAll("$s_storage.", "sessionStorage.")
                    .replaceAll("$inr_set", "setInterval")
                    .replaceAll("$sme_out", "setTimeout")

                    .replaceAll("$cst", "const")
                    .replaceAll("$lt", "let")
                    .replaceAll("$vr", "var")

                );
                document.querySelector('#shell').textContent = (String(newStr2));

                const test9992 = document.querySelector('#shell').textContent;

                setTimeout(() => {
                    shellmenu_open()
                    document.getElementById('shell').innerText = document.getElementById('shell').value = test9992;
                    setTimeout(() => {
                        toggleWindow(htmlviewer_run_menu)
                        preview.srcdoc = test9992;
                    }, 500);
                }, 100);
                break;


            case command_11 + k:
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
                let newStr10 = (String(l)
                    .replaceAll("<html>", "{h}").replaceAll("</html>", "{/h}")
                    .replaceAll("class=", "{class}")
                    .replaceAll("id=", "{id}")
                    .replaceAll("name=", "{ne}")
                    .replaceAll("value=", "{ve}")

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
                    .replaceAll("<script", "{s")

                    .replaceAll("console.log", "{conlog}")

                    .replaceAll("document", "{dmt}")
                    .replaceAll("getElementById", "{gid}")
                    .replaceAll("querySelector", "{qes}")
                    .replaceAll("querySelectorAll", "{qesall}")

                    .replaceAll("textContent", "{texcon}")
                    .replaceAll("innerText", "{intext}")
                    .replaceAll("innerHTML", "{inhtml}")

                    .replaceAll("addEventListener", "{addevlis}")
                    .replaceAll("onclick", "{onclk}")
                    .replaceAll("function", "{func}")

                    .replaceAll("localStorage.", "$l_storage.")
                    .replaceAll("sessionStorage.", "$s_storage.")
                    .replaceAll("setInterval", "$inr_set")
                    .replaceAll("setTimeout", "$sme_out")

                    .replaceAll("const", "$cst")
                    .replaceAll("let", "$lt")
                    .replaceAll("var", "$vr")

                );
                document.querySelector('#shell').textContent = (String(newStr10));
                const test9999 = document.querySelector('#shell').textContent;
                setTimeout(() => {
                    shellmenu_open()
                    document.getElementById('shell').innerText = document.getElementById('shell').value = test9999;
                }, 100);
                break;

            case '':
                break;

            case 'local/memory':
                localmemory_size();
                setTimeout(() => {
                    toggleWindow(localstorage_details_menu)
                }, 500);
                break;

            case 'help':
                toggleWindow(command_help_menu)
                break;

            case 'screen/full':
                full();
                break;

            case 'screen/min':
                min();
                break;

            case 'taskbar/none':
                taskbar.style.display = "none";
                localStorage.setItem('data_taskbar_none', true);
                taskbar_none()
                break;

            case 'taskbar/active':
                taskbar_active()
                break;

            case 'allwindow/reset':
                window_reset()
                break;

            case 'allwindow/close':
                if (localStorage.getItem('data_taskbar_none')) {
                    noticewindow_create("error", "タスクバーが非表示のため、ウィンドウが閉じれません!");
                } else {
                    window_none()
                }
                break;

            case 'allwindow/open':
                window_active();
                cpubench_open();
                break;

            case 'window/afterimage/false':
                localStorage.setItem('window_afterimage_false', true);
                document.querySelector('.windowafter').textContent = "OFF";
                break;

            case 'window/afterimage/true':
                localStorage.removeItem('window_afterimage_false');
                document.querySelector('.windowafter').textContent = "ON";
                break;

            case 'cpu/bench':
                toggleWindow(cpu_bench_menu)
                cpubench_open();
                break;

            case 'nexser/data/clear':
                allStorage_clear()
                setTimeout(() => {
                    window.location = '';
                }, 3000);
                break;

            case 'welcome':
                welcome()
                break;

            case 'file/none':
                localStorage.setItem('file_none', true);
                files_inline.style.display = "none";
                break;

            case 'file/active':
                localStorage.removeItem('file_none');
                files_inline.style.display = "flex";
                break;

            case 'page/20230528':
                toggleWindow(test_site_menu)
                break;

            case 'title/center':
                title_center()
                break;

            case 'title/center/reset':
                title_center_reset()
                break;

            case 'reset':
                nexser_prompt_reset()
                break;

            case 'exit':
                nexser_prompt_reset()
                windowclose(".window_prompt")
                break;

            case 'nexser/restart':
                window_none()
                nexser_restart()
                break;

            case 'windows95/open':
                location.href = 'https://moti5768.github.io/moti.world/windows95.html'
                break;

            case 'windows2000/open':
                location.href = 'https://moti5768.github.io/moti.world/windows%202000/windows2000_beta.html'
                break;
            case 'windowsystem/open':
                location.href = 'https://moti5768.github.io/moti.world/new%20OS/WindowSystem.html'
                break;

            default:
                executeCommand2()
                break;
        }
    }

    function shellmenu_open() {
        document.querySelectorAll('.prompt_shell_menu').forEach(prompt_shell_menu => {
            toggleWindow(prompt_shell_menu);
        });
    }
    function shellmenu_close() {
        document.querySelectorAll('.prompt_shell_menu').forEach(prompt_shell_menu => {
            prompt_shell_menu.closest('.child_windows');
            document.getElementById('shell').value = "";
            document.getElementById('shell').textContent = "";
            document.getElementById('shell').innerHTML = "";
            prompt_shell_menu.classList.add('active');
            prompt_shell_menu.classList.remove('selectwindows');
        });
    }

    function prompt2_text_clear() {
        document.querySelectorAll('.focus2').forEach(focus2 => {
            focus2.value = "";
        });
    }

    function screen_backtextload() {
        document.getElementById('back_text_input').textContent = localStorage.getItem('backtext_data');
    }

    function backtext_check() {
        let backtext_data = document.back_text_form.back_text.value;
        localStorage.setItem('backtext_data', backtext_data);
        background_text.textContent = localStorage.getItem('backtext_data');
    }
    function backtext_clear() {
        document.back_text_form.back_text.value = "";
        localStorage.removeItem('backtext_data');
        background_text.textContent = "";
    }

    setInterval(() => {
        const localkey_length = localStorage.length;
        if (screen_prompt.style.display === "block") {
            navigator.getBattery().then((battery) => {
                const updateInnerHTML = (className, value) => {
                    document.querySelector(`.${className}`).textContent = value;
                };
                updateInnerHTML('level', battery.level);
                updateInnerHTML('charging', battery.charging);
                updateInnerHTML('chargingTime', battery.chargingTime);
                updateInnerHTML('dischargingTime', battery.dischargingTime);
            });
            document.querySelector('.length_localStorage').textContent = localkey_length;
        } else {
            document.getElementsByClassName('local_keylength')[0].textContent = localkey_length;
            background_text2.textContent = localStorage.getItem('backtext_data');
            const get = document.getElementsByClassName('child_windows');
            const get2 = document.getElementsByClassName('active');
            const get3 = document.getElementsByClassName('task_buttons');
            gets = get.length;
            gets2 = get2.length;
            gets3 = get3.length;
            document.getElementsByClassName('child_windows_length')[0].textContent = gets;
            document.getElementsByClassName('active_length')[0].textContent = gets2;
            if (localStorage.getItem(KEY_BKCOLOR, bkcolor)) {
                mini_desktop.style.backgroundColor = bkcolor;
            }
            const updateStyle = (element, isExported) => {
                element.style.color = isExported ? "white" : "";
                element.style.background = isExported ? "black" : "";
            };
            const inportIcon = document.querySelector('.inport_icon');
            updateStyle(inportIcon, localStorage.getItem('MemoData_export'));
            const setTextContent = (selector, className) => {
                document.querySelector(selector).textContent = document.getElementsByClassName(className).length;
            };
            setTextContent('.title_navy', 'navy');
            setTextContent('.drag_window', 'drag');
            document.getElementsByClassName('cpu_cores')[0].textContent = navigator.hardwareConcurrency;
        }
    }, 100);

    ['.close_button', '.close_button3'].forEach(cls => {
        document.querySelectorAll(cls).forEach(btn => {
            btn.addEventListener('click', () => {
                const el = btn.closest(cls === '.close_button' ? '.child_windows' : '.warning_windows');
                if (el) cls === '.close_button' ? (el.classList.add('active'), el.classList.remove('selectwindows')) : el.style.display = 'none';
                document.querySelector('.black_screen').style.display = "none";
            });
        });
    });

    function windowclose(cls) {
        document.querySelectorAll(cls).forEach(btn => {
            const el = btn.closest(cls === cls ? '.child_windows' : '.warning_windows');
            if (el) cls === cls ? (el.classList.add('active'), el.classList.remove('selectwindows')) : el.style.display = 'none';
        });
    }

    function addBigScreenButtonListeners(button) {
        if (!button.dataset.listenerAdded) {
            button.addEventListener('mousedown', function () {
                setTimeout(() => {
                    const elements = document.querySelector('.navy');
                    const elements2 = elements.closest('.child_windows');
                    Object.assign(elements2.dataset, {
                        originalWidth: elements2.style.width,
                        originalHeight: elements2.style.height,
                        originalTop: elements2.style.top,
                        originalLeft: elements2.style.left
                    });
                }, 0);
            });
            button.addEventListener('click', function () {
                const bigscreenbutton = button.closest('.child_windows');
                bigscreenbutton.classList.remove('minimization');
                const t = localStorage.getItem('taskbar_height');
                bigscreenbutton.style.height = "";
                bigscreenbutton.style.width = "";
                bigscreenbutton.style.left = "0";
                if (localStorage.getItem('data_taskbar_none')) {
                    bigscreenbutton.style.top = "0";
                } else if (localStorage.getItem('taskbar_position_button')) {
                    bigscreenbutton.style.top = "40px";
                    bigscreenbutton.style.top = `${t}px`;
                } else if (bigscreenbutton.classList.contains('rightwindow')) {
                    bigscreenbutton.style.top = "0";
                    bigscreenbutton.style.left = "";
                } else {
                    bigscreenbutton.style.top = "0";
                }
                window_animation(bigscreenbutton)
                bigscreenbutton.classList.remove('rightwindow', 'leftwindow');
                bigscreenbutton.classList.add('big');
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
                minscreenbutton.classList.remove('rightwindow', 'leftwindow', 'big');
                const elements = document.querySelector('.navy');
                const elements2 = elements.closest('.child_windows');
                Object.assign(elements2.style, {
                    width: elements2.dataset.originalWidth,
                    height: elements2.dataset.originalHeight,
                    top: elements2.dataset.originalTop,
                    left: elements2.dataset.originalLeft
                });
                window_animation(minscreenbutton)
                setTimeout(() => {
                    minscreenbutton.scrollTop = 0;
                    minscreenbutton.scrollLeft = 0;
                }, 250);
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
    function window_animation(animation) {
        animation.style.pointerEvents = "none";
        const adjustHeight = () => {
            if (animation.classList.contains('minimization')) {
                animation.classList.add('child_windows_invisible');
            }
            animation.style.pointerEvents = "";
            animation.style.zIndex = largestZIndex++;
        };
        if (localStorage.getItem('window_animation')) {
            animation.style.transition = `${windowanimation}s cubic-bezier(0, 0, 1, 1)`;
            Array.from(animation.children).forEach(child => child.style.display = 'none');
            document.querySelectorAll('.title, .title_buttons').forEach(el => el.style.display = "block");
            document.querySelectorAll('.title2').forEach(el => el.style.display = "flex");
            setTimeout(() => {
                animation.style.transition = "";
                Array.from(animation.children).forEach(child => child.style.display = '');
                if (localStorage.getItem('allwindow_toolbar')) {
                    document.querySelectorAll('.window_tool').forEach(el => el.style.display = "block");
                }
                adjustHeight();
            }, windowanimation * 1000);
        } else {
            adjustHeight();
        }
    }

    document.querySelectorAll('.window_fullleft').forEach(window_left => {
        window_left.addEventListener('click', () => {
            const windowleft = window_left.closest('.child_windows');
            windowleft.classList.add('leftwindow');
            const t = localStorage.getItem('taskbar_height');
            windowleft.style.right = "auto";
            windowleft.style.left = "0";
            windowleft.style.height = "100%";
            windowleft.style.width = "49.9%";
            if (localStorage.getItem('data_taskbar_none')) {
                windowleft.style.top = "0";
            } else if (localStorage.getItem('taskbar_position_button')) {
                windowleft.style.top = "40px";
                windowleft.style.top = `${t}px`;
            } else {
                windowleft.style.top = "0";
            }
            window_animation(windowleft);
            if (windowleft.classList.contains('rightwindow')) {
                document.querySelector('.rightwindow').classList.replace('rightwindow', 'leftwindow');
            }
            windowleft.classList.remove('big');
        });
    });
    document.querySelectorAll('.window_fullright').forEach(window_right => {
        window_right.addEventListener('click', () => {
            const windowright = window_right.closest('.child_windows');
            windowright.classList.add('rightwindow');
            const t = localStorage.getItem('taskbar_height');
            windowright.style.left = "";
            windowright.style.right = "0px";
            windowright.style.height = "100%";
            windowright.style.width = "49.9%";
            if (localStorage.getItem('data_taskbar_none')) {
                windowright.style.top = "0";
            } else if (localStorage.getItem('taskbar_position_button')) {
                windowright.style.top = "40px";
                windowright.style.top = `${t}px`;
            } else {
                windowright.style.top = "0";
            }
            window_animation(windowright);
            if (windowright.classList.contains('leftwindow')) {
                document.querySelector('.leftwindow').classList.replace('leftwindow', 'rightwindow');
            }
            windowright.classList.remove('big');
        });
    });

    document.querySelectorAll('.window_half_big').forEach(window_half_big => {
        window_half_big.addEventListener('mousedown', () => {
            const elements2 = document.querySelector('.title.navy').closest('.child_windows');
            ['width', 'height', 'top', 'left'].forEach(attr => elements2.dataset[`original${attr.charAt(0).toUpperCase() + attr.slice(1)}`] = elements2.style[attr]);
        });
        window_half_big.addEventListener('click', event => {
            const windowhalfbig = window_half_big.closest('.child_windows');
            windowhalfbig.classList.remove('rightwindow', 'leftwindow', 'big');
            const shiftX = event.clientX - window_half_big.getBoundingClientRect().left;
            const shiftY = event.clientY - window_half_big.getBoundingClientRect().top;
            const moveAt = (pageX, pageY) => {
                window_half_big.style.left = pageX - shiftX + 'px';
                window_half_big.style.top = pageY - shiftY + 'px';
            };
            moveAt(event.pageX, event.pageY);
            windowhalfbig.style.height = "55%";
            windowhalfbig.style.width = "55%";
            window_animation(windowhalfbig);
        });
    });

    document.querySelectorAll('.windowsize_reset').forEach(windowsize_reset => {
        windowsize_reset.addEventListener('click', event => {
            const windowsizereset = windowsize_reset.closest('.child_windows');
            windowsizereset.style.height = windowsizereset.style.width = "";
            windowsizereset.style.right = windowsizereset.classList.contains('rightwindow') ? "0" : "";
            windowsizereset.classList.remove('big', 'leftwindow', 'rightwindow');
            window_animation(windowsizereset);
            const shiftX = event.clientX - windowsize_reset.getBoundingClientRect().left;
            const shiftY = event.clientY - windowsize_reset.getBoundingClientRect().top;
            windowsize_reset.style.left = `${event.pageX - shiftX}px`;
            windowsize_reset.style.top = `${event.pageY - shiftY}px`;
        });
    });

    document.querySelectorAll('.parent_list').forEach(parent_list => {
        parent_list.addEventListener('mouseover', () => {
            parent_list.lastElementChild.style.display = "flex";
            document.querySelectorAll('.windowtool_child').forEach(el => el.style.display = "none");
        });
        parent_list.addEventListener('mouseleave', () => {
            document.querySelectorAll('.child_list').forEach(el => el.style.display = "none");
        });
    });

    document.querySelectorAll('.allwindow_toolbar').forEach(allwindow_toolbar => {
        allwindow_toolbar.addEventListener('click', () => {
            document.querySelectorAll('.window_tool').forEach(window_tool => {
                if (window_tool.style.display === "block") {
                    window_tool.style.display = "none";
                    localStorage.removeItem('allwindow_toolbar');
                    document.querySelectorAll('.window_inline_side').forEach(window_inline_side => {
                        window_inline_side.style.top = "";
                    });
                    clock_menu.style.height = "355px";
                } else {
                    window_tool.style.display = "block";
                    localStorage.setItem('allwindow_toolbar', true);
                    document.querySelectorAll('.window_inline_side').forEach(window_inline_side => {
                        window_inline_side.style.top = "31px";
                    });
                    clock_menu.style.height = "";
                }
            });
        });
    });

    const digital_clock_area = document.getElementsByClassName('digital_clock_area');
    const analog_clock_area = document.getElementsByClassName('analog_clock_area')
    document.querySelectorAll('.clockdata_analog').forEach(clockdata_analog => {
        clockdata_analog.addEventListener('click', () => {
            localStorage.setItem('clockdata_analog', true);
            digital_clock_area[0].style.display = "none";
            analog_clock_area[0].style.display = "block";
        });
    });
    document.querySelectorAll('.clockdata_digital').forEach(clockdata_digital => {
        clockdata_digital.addEventListener('click', () => {
            localStorage.removeItem('clockdata_analog');
            digital_clock_area[0].style.display = "flex";
            analog_clock_area[0].style.display = "none";
        });
    });

    const menuLists = document.querySelectorAll('.parent_start_menu_lists, .child_start_menu_lists, .child_start_menu_lists2');
    menuLists.forEach(menuList => {
        menuList.addEventListener('mouseover', () => {
            menuList.lastElementChild.style.display = "block";
        });
        menuList.addEventListener('mouseleave', () => {
            document.querySelectorAll('.child_start_menu_lists, .child_start_menu_lists2, .child_start_menu_lists3')
                .forEach(childMenuList => childMenuList.style.display = "none");
        });
    });

    document.querySelectorAll('.window_inline_menus').forEach(container => {
        container.querySelectorAll('.window_inline_menus_parent').forEach(parent => {
            parent.addEventListener('mousedown', () => {
                container.querySelectorAll('.menuparent1, .menuchild1, .select').forEach(el => {
                    el.classList.remove('menuparent1', 'menuchild1', 'select');
                });
                container.querySelectorAll('.window_inline_menus_parent').forEach(p => {
                    p.lastElementChild.style.display = "none";
                });
                parent.classList.add('select');
                parent.lastElementChild.style.display = "block";
            });
        });
    });
    document.querySelectorAll('.window_inline_menus .menuchild1').forEach(child => {
        child.style.display = "block";
    });

    function window_back_silver() {
        Array.from(document.getElementsByClassName('back_silver')).forEach(el => el.style.background = "silver");
    }

    document.querySelectorAll('.child_windows, .child').forEach(windowElement => {
        const parentWindow = windowElement.closest('.child_windows');
        const addEventListeners = element => {
            element.addEventListener('mousedown', () => {
                parentWindow.scrollTop = 0;
                parentWindow.scrollLeft = 0;
                parentWindow.style.zIndex = largestZIndex++;
            });
        };
        addEventListeners(windowElement);
        windowElement.querySelectorAll('iframe').forEach(iframe => {
            iframe.addEventListener('load', () => {
                try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    [iframeDoc, iframeDoc.body].forEach(addEventListeners);
                } catch (e) {
                    console.error('iframe no access:', e);
                }
            });
        });
    });

    document.querySelectorAll('.window_prompt, .child').forEach(el =>
        el.addEventListener('mouseup', () =>
            document.querySelector('.focus2').focus()
        )
    );

    function title_navyremove() {
        document.querySelectorAll('.navy').forEach(navy => navy.classList.remove('navy'));
    }

    function nexser_search() {
        const input = document.getElementById('myInput');
        const filter = input.value.toUpperCase();
        const ul = document.getElementById("myUL");
        const liElements = ul.getElementsByTagName('li');
        const liArray = Array.from(liElements);
        liArray.forEach(li => {
            const textContent = li.getElementsByTagName("span")[0].textContent.toUpperCase();
            li.style.display = textContent.includes(filter) ? "" : "none";
        });
    }

    function search_clear() {
        document.getElementById('myInput').value = "";
        nexser_search()
    }

    function cpubench_open() {
        if (!cpu_bench_menu.classList.contains('active') || cpumenu1.style.display === "block") {
            setTimeout(() => {
                cpumenu1.style.display = "none";
                document.querySelector('.cpubuttons').style.display = "none";
                document.querySelector('.cputitle').style.display = "none";
                cpumenu2.style.display = "block";
                document.querySelector('.cpubuttons').style.display = "block";
                document.querySelector('.cputitle').style.display = "flex";
            }, 3000);
        }
    }

    function cpubench_reset() {
        cpumenu1.style.display = "block";
        cpumenu2.style.display = "none";
        document.querySelector('.cpubuttons').style.display = "none";
        document.querySelector('.cputitle').style.display = "none";
        cpu_bench_menu.style.height = "";
        cpu_bench_menu.style.width = "";
    }

    function assignClassToFrontmostElement(selector, newClassName) {
        const elements = Array.from(document.querySelectorAll(selector));
        const frontmostElement = elements.reduce((maxElement, element) => {
            const childWindow = element.closest('.child_windows');
            if (!childWindow.classList.contains('selectwindows')) {
                document.querySelectorAll('.task_buttons').forEach(taskButton => taskButton.remove());
                childWindow.classList.add('selectwindows');
            }
            const zIndex = parseInt(window.getComputedStyle(element).zIndex, 10) || 0;
            return zIndex > (maxElement?.zIndex || -Infinity) ? { element: childWindow, zIndex } : maxElement;
        }, null);
        if (frontmostElement) {
            frontmostElement.element.firstElementChild.classList.add(newClassName);
        }
        elements.forEach(element => {
            const { width, height } = getComputedStyle(element);
            Object.assign(element.style, { width, height });
        });
        return frontmostElement;
    }

    function zindexwindow_addnavy() {
        startmenu_close();
        title_navyremove();
        assignClassToFrontmostElement('.child_windows:not(.active):not(.minimization)', 'navy');
        test_windows_button();
        titlecolor_set();
        allwindow_resize();
        Array.from(document.getElementsByClassName('button')).forEach(addButtonListeners2);
        Array.from(document.getElementsByClassName('button2')).forEach(addButtonListeners);
        window.scrollTo(0, 0);
        resizeBackgroundImage();
        document.querySelectorAll('.child_windows').forEach(w => w.scrollTop = w.scrollLeft = 0);
    }

    const notefocus = () => {
        note_area.focus();
        displayCursorPos();
    };

    const cameraframe_parent = document.querySelector('.camera_menu');
    const cameraframe_child = document.getElementById('v');
    const cameraframe_resize = () => {
        cameraframe_child.style.width = `${cameraframe_parent.clientWidth}px`;
        cameraframe_child.style.height = `${cameraframe_parent.clientHeight - 85}px`;
    };

    const backgroundImageParent = document.getElementById('nexser');
    const backgroundImageChildren = Array.from(backgroundImageParent.getElementsByClassName('nexser_background_image'));
    const resizeBackgroundImage = () => {
        requestAnimationFrame(() => {
            backgroundImageChildren.forEach(child => {
                child.style.width = `${backgroundImageParent.clientWidth}px`;
                child.style.height = `${backgroundImageParent.clientHeight}px`;
            });
        });
    };
    resizeBackgroundImage();

    let clones = false;
    function addDragButtonListeners(button) {
        if (!button.dataset.listenerAdded) {
            const dragwindow = button.closest('.child_windows');
            button.addEventListener('mousedown', function () {
                if (dragwindow.classList.contains('leftwindow') || dragwindow.classList.contains('rightwindow')) {
                    dragwindow.style.height = "55%";
                    dragwindow.style.width = "55%";
                    dragwindow.classList.remove('leftwindow', 'rightwindow');
                }
                dragwindow.classList.add("drag");
            });
            let drag2 = button.closest('.child_windows');
            let x, y;
            let overlay;
            button.addEventListener("mousedown", mdown, { passive: false }, false);
            button.addEventListener("touchstart", mdown, { passive: false }, false);
            function mdown(e) {
                const event = e.type === "mousedown" ? e : e.changedTouches[0];
                x = event.pageX - drag2.offsetLeft;
                y = event.pageY - drag2.offsetTop;
                overlay = document.createElement('div');
                overlay.style.position = 'fixed';
                overlay.style.top = 0;
                overlay.style.left = 0;
                overlay.style.width = '100%';
                overlay.style.height = '100%';
                overlay.style.zIndex = 9999;
                document.body.appendChild(overlay);
                document.body.addEventListener("mousemove", mmove, { passive: false }, false);
                document.body.addEventListener("touchmove", mmove, { passive: false }, false);
                document.addEventListener("mouseup", mup, false);
                document.addEventListener("touchend", mup, false);
            }
            function mmove(e) {
                setTimeout(() => {
                    if (localStorage.getItem('window_invisible') && localStorage.getItem('window_afterimage_false')) {
                        drag.style.opacity = "0.5"
                    } else if (localStorage.getItem('window_borderblack') && localStorage.getItem('window_afterimage_false')) {
                        applyStyles(drag);
                    } else if (!localStorage.getItem('window_afterimage_false')) {
                        applyStyles(drag);
                    }
                }, 0);
                if (!clones && !localStorage.getItem('window_afterimage_false')) {
                    const clone = dragwindow.cloneNode(true);
                    dragwindow.parentNode.appendChild(clone).classList.add('clones');
                    [clone, dragwindow].forEach(el => el.style.zIndex = largestZIndex++);
                    requestAnimationFrame(() => {
                        dragwindow.parentNode.appendChild(clone).children[0].classList.add('navy');
                        applyStyles(dragwindow, titlecolor_set());
                    });
                    clones = true;
                }
                const drag = document.getElementsByClassName("drag")[0];
                const event = e.type === "mousemove" ? e : e.changedTouches[0];
                drag.style.top = event.pageY - y + "px";
                drag.style.left = event.pageX - x + "px";
                taskbar.addEventListener('mouseover', function () {
                    document.body.removeEventListener("mousemove", mmove, false);
                    document.body.removeEventListener("touchmove", mmove, false);
                })
            }
            function mup() {
                const drag = document.getElementsByClassName("drag")[0];
                if (drag) {
                    drag.classList.remove("drag");
                }
                document.body.removeEventListener("mousemove", mmove, false);
                document.body.removeEventListener("touchmove", mmove, false);
                document.removeEventListener("mouseup", mup, false);
                document.removeEventListener("touchend", mup, false);
                if (overlay) {
                    document.body.removeChild(overlay);
                }
                setTimeout(() => {
                    ["background", "borderStyle", "borderColor", "borderWidth", "boxShadow", "mixBlendMode"].forEach(style => drag.style[style] = "");
                    Array.from(drag.children).forEach(child => child.style.opacity = "");
                    window_back_silver();
                }, 0);
                if (clones && !localStorage.getItem('window_afterimage_false')) {
                    document.querySelector('.clones').remove();
                }
                clones = false;
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

    function applyStyles(element) {
        element.style.background = "rgba(0, 0, 0, 0)";
        element.style.borderStyle = "solid";
        element.style.borderColor = "#fff";
        element.style.borderWidth = "3px";
        element.style.boxShadow = "none";
        element.style.mixBlendMode = "difference";
        for (const child of element.children) {
            child.style.opacity = "0";
        }
    }

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

    document.querySelectorAll('.drag_button2').forEach(drag => {
        let drag2 = drag.closest('#toolbar');
        let x, y;
        const mdown_2 = e => {
            let event = e.type === "mousedown" ? e : e.changedTouches[0];
            x = event.pageX - drag2.offsetLeft;
            y = event.pageY - drag2.offsetTop;
            document.addEventListener("mousemove", mmove_2, { passive: false });
            document.addEventListener("touchmove", mmove_2, { passive: false });
            document.addEventListener("mouseup", mup_2, { passive: false });
            document.addEventListener("touchend", mup_2, { passive: false });
            document.addEventListener("mouseleave", mup_2, { passive: false });
            document.body.addEventListener("mouseleave", mup_2, { passive: false });
        };
        const mmove_2 = e => {
            let event = e.type === "mousemove" ? e : e.changedTouches[0];
            requestAnimationFrame(() => {
                drag2.style.top = event.pageY - y + "px";
                drag2.style.left = event.pageX - x + "px";
            });
        };
        const mup_2 = () => {
            document.removeEventListener("mousemove", mmove_2);
            document.removeEventListener("touchmove", mmove_2);
            document.removeEventListener("mouseup", mup_2);
            document.removeEventListener("touchend", mup_2);
            document.removeEventListener("mouseleave", mup_2);
            document.body.removeEventListener("mouseleave", mup_2);
            const task = taskbar.clientHeight;
            if (check(elm1, elm2) && localStorage.getItem('taskbar_position_button')) {
                toolbar.style.top = `${task}px`;
            } else if (check(elm1, elm2)) {
                toolbar.style.top = "";
                toolbar.style.bottom = `${task}px`;
            }
        };
        drag.addEventListener("mousedown", mdown_2, { passive: false });
        drag.addEventListener("touchstart", mdown_2, { passive: false });
    });

    document.querySelectorAll('.toolbar_on, .toolbar_off').forEach((element) => {
        element.addEventListener('click', () => {
            const isOn = element.classList.contains('toolbar_on');
            isOn ? localStorage.setItem('toolbar_on', true) : localStorage.removeItem('toolbar_on');
            toolbar.style.display = isOn ? "block" : "none";
        });
    });

    document.querySelectorAll('.filettext_backcolor_off, .filettext_backcolor_on').forEach((element) => {
        element.addEventListener('click', () => {
            const isOff = element.classList.contains('filettext_backcolor_off');
            isOff ? localStorage.setItem('filettext_backcolor_off', true) : localStorage.removeItem('filettext_backcolor_off');
            filettext_backcolor();
        });
    });

    document.querySelectorAll('.saver_on, .saver_off').forEach((element) => {
        element.addEventListener('click', () => {
            const isOn = element.classList.contains('saver_on');
            isOn ? localStorage.setItem('saver_on', true) : localStorage.removeItem('saver_on');
            document.querySelector('.saver_mode').textContent = isOn ? "ON" : "OFF";
        });
    });

    document.querySelectorAll('.display_old, .display_now').forEach((element) => {
        element.addEventListener('click', () => {
            const isOld = element.classList.contains('display_old');
            isOld ? localStorage.setItem('display_old', true) : localStorage.removeItem('display_old');
            isOld ? old_screen() : old_screen_reset();
        });
    });

    document.querySelectorAll('.list_shadow_on, .list_shadow_off').forEach((element) => {
        element.addEventListener('click', () => {
            const isOn = element.classList.contains('list_shadow_on');
            isOn ? localStorage.setItem('list_shadow_on', true) : localStorage.removeItem('list_shadow_on');
            isOn ? list_shadow() : list_shadow_reset();
        });
    });



    const KEY_COLOR = "COLOR";
    const KEY_BKCOLOR = "BKCOLOR";

    let color = null;
    let bkcolor = null;

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
            noticewindow_create("error", "カラードライバーがインストールされていません!");
        }
    }

    /*
     * 文字色と背景色を変更する
     */
    function setColor() {
        setTimeout(() => {
            if (localStorage.getItem('driver_color')) {
                body.style.color = color;
                document.getElementById("nexser").style.backgroundColor = bkcolor;
                mini_desktop.style.backgroundColor = bkcolor;
                if (bkcolor === "white" || bkcolor === "whitesmoke") {
                    background_text.style.color = "black"
                    background_text2.style.color = "black"
                    Array.from(document.getElementsByClassName('desktop_files')).forEach((desktop_files) => {
                        const deskfile_text = desktop_files.firstElementChild;
                        deskfile_text.style.color = "black"
                    })
                } else {
                    background_text.style.color = ""
                    background_text2.style.color = ""
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
            noticewindow_create("error", "カラードライバーがインストールされていません!");
        }
    });

    const colorBtns = document.querySelectorAll('.color_btn');

    colorBtns.forEach(color_btn => {
        color_btn.addEventListener('click', () => {
            titlecolor_remove();
            if (localStorage.getItem('driver_color')) {
                setTimeout(() => {
                    titlecolor_set();
                });
            } else {
                noticewindow_create("error", "カラードライバーがインストールされていません!");
            }
            titles.forEach(title => title.style.background = "");
            navys.forEach(navys => navys.style.background = "");
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
        };
        if (!localStorage.getItem('driver_color')) return;
        Object.entries(colors).forEach(([key, [bgColor, navyColor]]) => {
            if (localStorage.getItem(key)) {
                document.querySelectorAll('.title').forEach(title => title.style.background = bgColor);
                document.querySelectorAll('.navy').forEach(navy => navy.style.background = navyColor);
            }
        });
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
        const backgroundClasses = ['backgrounds1', 'backgrounds2', 'backgrounds3', 'backgrounds4', 'backgrounds5', 'backgrounds6', 'backgrounds7', 'backgrounds8', 'backgrounds9'];
        backgroundClasses.forEach(className => {
            const key = `back_pattern_${backgroundClasses.indexOf(className) + 1}`;
            if (localStorage.getItem(key)) {
                document.getElementsByClassName(className)[0].style.display = "block";
            }
        });
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
                sound(0)
            }
            if (localStorage.getItem('startup_2')) {
                sound(5)
            }
            if (localStorage.getItem('startup_3')) {
                sound(7)
            }
            if (localStorage.getItem('startup_4')) {
                sound(9)
            }
            if (localStorage.getItem('startup_5')) {
                sound(11)
            }
            if (localStorage.getItem('startup_6')) {
                sound(14)
            }
        }
    }

    function shutdown_sound() {
        if (localStorage.getItem('driver_sound')) {
            if (localStorage.getItem('shutdown_1')) {
                sound(1)
            }
            if (localStorage.getItem('shutdown_2')) {
                sound(3)
            }
            if (localStorage.getItem('shutdown_3')) {
                sound(8)
            }
            if (localStorage.getItem('shutdown_4')) {
                sound(10)
            }
            if (localStorage.getItem('shutdown_5')) {
                sound(12)
            }
            if (localStorage.getItem('shutdown_6')) {
                sound(15)
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
            noticewindow_create("warning", "未対応")
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

    const button = document.getElementById("button1");
    button.addEventListener("contextmenu", event => {
        event.preventDefault();
        toggleClass(".mouse_right");
    });
    button.addEventListener("click", () => toggleClass(".mouse_left"));
    function toggleClass(selector) {
        const element = document.querySelector(selector);
        element.classList.add("active");
        setTimeout(() => element.classList.remove("active"), 250);
    }

    function notecolor_change(color) {
        notecolor_remove();
        localStorage.setItem('note_textcolor', color);
        notecolor_update();
    }
    function notecolor_update() {
        const storedColor = localStorage.getItem('note_textcolor');
        document.querySelectorAll('.note_area, .test_notetext').forEach(el => {
            el.style.color = storedColor || "";
        });
    }
    function notecolor_remove() {
        localStorage.removeItem('note_textcolor');
        document.querySelectorAll('.note_area, .test_notetext').forEach(el => el.style.color = "");
    }

    function notetext_all_bold() {
        localStorage.setItem('note_text_bold', true);
        notetitle();
        if (localStorage.getItem('note_text_bold') && note_area.style.fontWeight === "normal") {
            note_area.style.fontWeight = "bold";
            document.querySelector('.test_notetext').style.fontWeight = "bold";
        } else if (localStorage.getItem('note_text_bold') && note_area.style.fontWeight === "bold") {
            note_area.style.fontWeight = "normal";
            document.querySelector('.test_notetext').style.fontWeight = "normal";
            localStorage.removeItem('note_text_bold')
        } else {
            note_area.style.fontWeight = "bold";
            document.querySelector('.test_notetext').style.fontWeight = "bold";
        }
    }
    function notetext_all_oblique() {
        localStorage.setItem('note_text_oblique', true);
        notetitle();
        if (localStorage.getItem('note_text_oblique') && note_area.style.fontStyle === "normal") {
            note_area.style.fontStyle = "oblique";
            document.querySelector('.test_notetext').style.fontStyle = "oblique";
        } else if (localStorage.getItem('note_text_oblique') && note_area.style.fontStyle === "oblique") {
            note_area.style.fontStyle = "normal";
            document.querySelector('.test_notetext').style.fontStyle = "normal";
            localStorage.removeItem('note_text_oblique')
        } else {
            note_area.style.fontStyle = "oblique";
            document.querySelector('.test_notetext').style.fontStyle = "oblique";
        }
    }
    function notetext_all_underline() {
        localStorage.setItem('note_text_underline', true);
        notetitle();
        if (note_area.style.textDecoration === "none" && localStorage.getItem('note_text_underline')) {
            note_area.style.textDecoration = "underline";
            document.querySelector('.test_notetext').style.textDecoration = "underline";
        } else if (note_area.style.textDecoration === "underline" && localStorage.getItem('note_text_underline')) {
            note_area.style.textDecoration = "none";
            document.querySelector('.test_notetext').style.textDecoration = "none";
            localStorage.removeItem('note_text_underline')
        } else {
            note_area.style.textDecoration = "underline";
            document.querySelector('.test_notetext').style.textDecoration = "underline";
        }
    }

    function notetext_reset() {
        ['notetext_small', 'notetext_medium', 'notetext_large', 'notetext_x-large'].forEach(item => localStorage.removeItem(item));
    }
    function notetext_size(size) {
        notetext_reset();
        localStorage.setItem(size, true);
        notetextsize_change();
        notetitle();
    }
    function notetextsize_change() {
        let noteData = document.getElementsByClassName('note_area')[0];
        ['small', 'medium', 'large', 'x-large'].forEach(size => {
            if (localStorage.getItem(`notetext_${size}`)) {
                noteData.style.fontSize = size;
            }
        });
    }

    // 保存
    function save() {
        if (note_form.note_area.value == "") {
            noticewindow_create("warning", "テキストが無いため、保存できません!", "&nbsp;notepad");
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
        localStorage.setItem('textdropdata', document.drop_form.drop_area.value);
        document.getElementById('drop_save_text').textContent = "drop text data save!";
    }

    function objective_save() {
        const titleValue = objective_title_form.objective_title_area.value.trim();
        const contentValue = objective_form.objective_area.value.trim();
        if (titleValue === "" && contentValue === "") {
            noticewindow_create("warning", "タイトルと内容が入力されていません!", "&nbsp;objective sheet");
        } else if (titleValue === "") {
            noticewindow_create("warning", "タイトルが入力されていません!", "&nbsp;objective sheet");
        } else if (contentValue === "") {
            noticewindow_create("warning", "内容が入力されていません!", "&nbsp;objective sheet");
        } else {
            localStorage.setItem('objectiveTitleData', titleValue);
            localStorage.setItem('objectiveData', contentValue);
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
        } else if (localStorage.getItem('note_texts')) {
            document.querySelector('.warning_title_text').textContent = "notepad"
            document.querySelector('.window_warning_text').textContent = "編集中です。ウィンドウを終了しますか?(内容は破棄されます)"
            warning_windows.style.display = "block"
            document.querySelector('.close_button3').style.display = "block"
            sound(4)
            document.querySelector('.shutdown_button').style.display = "none";
            document.querySelector('.warningclose_button').style.display = "block";
        } else {
            localStorage.removeItem('note_texts');
            note_pad.classList.add('active');
            note_pad.classList.remove('selectwindows')
        }
    })

    document.querySelector('.objective_close').addEventListener('click', function () {
        if (!objective_menu.classList.contains('active') && localStorage.getItem('objectiveData') && localStorage.getItem('objectiveTitleData') && (!localStorage.getItem('objective_area'))) {
            objective_menu.classList.add('active');
            localStorage.removeItem('objective_area');
            objective_menu.classList.remove('selectwindows')
        } else if (localStorage.getItem('objective_area')) {
            document.querySelector('.warning_title_text').textContent = "objective sheet"
            document.querySelector('.window_warning_text').textContent = "タイトル と 内容を保存してから閉じてください";
            warning_windows.style.display = "block"
            document.querySelector('.close_button3').style.display = "block"
            sound(4)
            document.querySelector('.shutdown_button').style.display = "none";
            document.querySelector('.warningclose_button').style.display = "none";
        } else if (!localStorage.getItem('objectiveData') && !localStorage.getItem('objectiveTitleData') && (!localStorage.getItem('objective_area'))) {
            document.getElementsByClassName('objective_title_area')[0].value = "";
            document.getElementsByClassName('objective_area')[0].value = "";
            objective_menu.classList.add('active');
            localStorage.removeItem('objective_area');
            objective_menu.classList.remove('selectwindows')
        }
    })
    localStorage.removeItem('objective_area')

    document.querySelectorAll('.objective_title_area, .objective_area').forEach(objectives_area => {
        objectives_area.addEventListener("keydown", event => {
            if (event.ctrlKey && event.key === 's') {
                event.preventDefault();
            } else {
                objective_title();
            }
        });
        objectives_area.addEventListener("keyup", event => {
            if (event.ctrlKey && event.key === 's') {
                objective_save();
            }
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
        } else if (sessionStorage.getItem('start_camera')) {
            noticewindow_create("error", "カメラが実行されているため、ウィンドウが閉じれません!");
        }
    })

    function warning_windows_close() {
        warning_windows.style.display = "none";
        document.querySelector('.shutdown_button').style.display = "block";
        document.querySelector('.warningclose_button').style.display = "none";
        document.querySelector('.close_button3').style.display = "block"
        document.note_form.note_area.value = "";
        resetShowLength();
        localStorage.removeItem('note_texts');
        note_pad.classList.add('active');
        note_pad.classList.remove('selectwindows');
    }

    function error_windows_close(event) {
        const clickedElement = event.target;
        const parentElement = clickedElement.closest('.child_windows');
        parentElement.remove();
        zindexwindow_addnavy();
    }

    function notedata_clear() {
        localStorage.removeItem('noteData');
        const memo_save = document.getElementById('memo_save_text');
        memo_save.textContent = "";
    }

    function notearea_allselect() {
        notetitle();
        note_area.select();
    }

    function notearea_time() {
        notetitle();
        const note_time = new Date();
        note_area.value = note_area.value + note_time.toLocaleString();
    }
    document.getElementById('cleartextbtn').addEventListener('click', function () {
        document.getElementsByClassName("note_area")[0].value = '';
        const memo_save = document.getElementById('memo_save_text');
        memo_save.textContent = "";
        resetShowLength();
        notetitle()
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
    note_area.addEventListener("keydown", event => {
        if (event.ctrlKey && event.key === 's') {
            event.preventDefault();
        } else {
            notetitle(event);
            setTimeout(onChange, 10);
        }
    });
    note_area.addEventListener("keyup", event => {
        if (event.ctrlKey && event.key === 's') {
            save();
        }
    });

    note_area.addEventListener("paste", () => {
        setTimeout(onChange, 10)
    });

    function notetitle() {
        notedata_clear();
        localStorage.setItem('note_texts', true);
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
        notefocus()
        const noteAreaValue = note_area.value;
        const spaceCount = (noteAreaValue.match(/\s/g) || []).length;
        const textCount = noteAreaValue.length;
        document.getElementById('memo_save_text').textContent = "";
        if (!localStorage.getItem('noteData')) {
            document.querySelector('.note_title').textContent = "*notepad";
        }
        textCountElement.innerHTML = textCount - spaceCount;
    }

    function load() {
        const noteData = localStorage.getItem('noteData') || "メモは登録されていません。";
        document.note_form.note_area.value = noteData;
        document.getElementById('memo_save_text').textContent = "";
        setTimeout(onChange, 100);
    }

    function objective_load() {
        const objectiveTitleData = localStorage.getItem('objectiveTitleData') || '';
        const objectiveData = localStorage.getItem('objectiveData') || '';
        document.objective_title_form.objective_title_area.value = objectiveTitleData;
        document.objective_form.objective_area.value = objectiveData;
    }

    function win2000_load() {
        if (localStorage.getItem('MemoData_export')) {
            noticewindow_create("notepad", "テキストデータを受け取りました!");
            note_area.textContent = localStorage.getItem('MemoData_export');
            localStorage.removeItem('MemoData_export');
        } else {
            noticewindow_create("error", "テキストデータがエクスポートされていません!", "&nbsp;notepad");
        }
    }

    function load2() {
        const textdropdata = localStorage.getItem('textdropdata') || '';
        document.getElementById('drop_save_text').textContent = textdropdata ? 'text data save keep' : '';
        document.drop_form.drop_area.value = textdropdata;
    }

    let dr = document.querySelector('#drop');
    dr.addEventListener('dragover', supportsPassive ? { passive: true } : false, function (evt) {
        evt.preventDefault();
    });
    dr.addEventListener('drop', function (evt) {
        evt.preventDefault();
        if (!localStorage.getItem('textdropdata')) {
            evt.target.textContent += evt.dataTransfer.getData('text');
        } else {
            noticewindow_create("error", "テキストが保存されているため、ドラッグした文字をドロップできません!");
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
        const setStyle = (elements, styles) => Array.from(elements).forEach(el => Object.assign(el.style, styles));
        setStyle(document.getElementsByClassName('window_inline_list'), { columnCount: "1", display: "block" });
        setStyle(document.querySelectorAll('.window_file_icon, .window_file_icon2'), { width: "28px", height: "18px", marginTop: "5px" });
        setStyle(document.querySelectorAll('.window_file_icon > span'), { width: "10px", height: "2.5px" });
        setStyle(document.getElementsByClassName('window_files'), { margin: "0px", paddingTop: "10px", width: "100%" });
        Array.from(document.getElementsByClassName('window_files')).forEach(window_files => {
            Object.assign(window_files.firstElementChild.style, { paddingLeft: "50px", width: "auto" });
        });
        if (!localStorage.getItem('filetimes')) {
            setStyle(document.getElementsByClassName('windowfile_time'), { display: "block" });
        }
    }

    function window_file_list_change2() {
        const setStyle = (elements, styles) => Array.from(elements).forEach(el => Object.assign(el.style, styles));
        setStyle(document.getElementsByClassName('window_inline_list'), { columnCount: "2", display: "block" });
        setStyle(document.querySelectorAll('.window_file_icon, .window_file_icon2'), { width: "28px", height: "18px", marginTop: "5px" });
        setStyle(document.querySelectorAll('.window_file_icon > span'), { width: "10px", height: "2.5px" });
        setStyle(document.getElementsByClassName('window_files'), { margin: "0px", paddingTop: "10px", width: "100%" });
        Array.from(document.getElementsByClassName('window_files')).forEach(window_files => {
            Object.assign(window_files.firstElementChild.style, { paddingLeft: "50px", width: "auto" });
        });
        if (!localStorage.getItem('filetimes')) {
            setStyle(document.getElementsByClassName('windowfile_time'), { display: "block" });
        }
    }

    function window_file_list_reset() {
        const resetStyle = (elements, styles) => Array.from(elements).forEach(el => Object.assign(el.style, styles));
        resetStyle(document.getElementsByClassName('window_inline_list'), { columnCount: "", display: "flex" });
        resetStyle(document.querySelectorAll('.window_file_icon, .window_file_icon2'), { width: "", height: "", marginTop: "" });
        resetStyle(document.querySelectorAll('.window_file_icon > span'), { width: "", height: "" });
        resetStyle(document.getElementsByClassName('window_files'), { margin: "", paddingTop: "", width: "" });
        Array.from(document.getElementsByClassName('window_files')).forEach(window_files => {
            Object.assign(window_files.firstElementChild.style, { paddingLeft: "", width: "" });
        });
        resetStyle(document.getElementsByClassName('windowfile_time'), { display: "none" });
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

    document.querySelector('.taskbar_leftbtn').addEventListener('click', function () {
        if (localStorage.getItem('taskbar_leftbtn')) {
            localStorage.removeItem('taskbar_leftbtn')
            document.querySelector('.taskbar_leftbtn').textContent = "off";
            document.querySelector('.first_taskbar_buttons').style.display = "";
        } else {
            localStorage.setItem('taskbar_leftbtn', true);
            document.querySelector('.taskbar_leftbtn').textContent = "on"
            document.querySelector('.first_taskbar_buttons').style.display = "none";
        }
    })

    document.querySelector('.taskbarbutton_autoadjustment').addEventListener('click', function () {
        if (localStorage.getItem('taskbarbutton_autoadjustment')) {
            localStorage.removeItem('taskbarbutton_autoadjustment')
            document.querySelector('.taskbarbutton_autoadjustment').textContent = "off";
            document.querySelector('.task_icons').classList.remove('flex');
        } else {
            localStorage.setItem('taskbarbutton_autoadjustment', true);
            document.querySelector('.taskbarbutton_autoadjustment').textContent = "on";
            document.querySelector('.task_icons').classList.add('flex');
        }
    })

    document.querySelector('.taskbar_position_button').addEventListener('click', function () {
        const t = localStorage.getItem('taskbar_height');
        const task = taskbar.clientHeight;
        if (localStorage.getItem('taskbar_position_button')) {
            const t = localStorage.getItem('taskbar_height');
            localStorage.removeItem('taskbar_position_button')

            document.querySelector('.taskbar_position_button').textContent = "top"
            taskbar.style.top = ""
            child_start_menu.style.top = "auto"
            child_start_menu.style.bottom = "";

            child_start_menu.style.bottom = `${task}px`
            child_start_menu.style.bottom = `${t}px`

            battery_menu.style.top = "auto"
            battery_menu.style.bottom = ""

            files_inline.style.marginTop = "auto"
            files_inline.style.bottom = ""


            window_selectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(element => element.style.top = "auto");
            });

            if (check(elm1, elm2) && localStorage.getItem('taskbar_position_button')) {
                toolbar.style.top = "40px";
                toolbar.style.top = `${t}px`;

            } else if (check(elm1, elm2)) {
                toolbar.style.top = "";
                toolbar.style.bottom = `${t}px`;
            }

        } else {
            localStorage.setItem('taskbar_position_button', true);

            document.querySelector('.taskbar_position_button').textContent = "bottom"
            taskbar.style.top = "0px"
            child_start_menu.style.top = "40px"
            child_start_menu.style.bottom = "auto"
            child_start_menu.style.top = `${task}px`
            child_start_menu.style.top = `${t}px`
            battery_menu.style.top = "35px"
            battery_menu.style.bottom = "auto"

            if (localStorage.getItem('taskbar_position_button') && localStorage.getItem('data_taskbar_none')) {
                files_inline.style.marginTop = "auto"
                files_inline.style.bottom = ""
            } else if (localStorage.getItem('taskbar_position_button') && !localStorage.getItem('data_taskbar_none')) {
                files_inline.style.marginTop = "40px"
                files_inline.style.bottom = "auto"

                files_inline.style.marginTop = `${t}px`
            } else {
                files_inline.style.marginTop = "auto"
                files_inline.style.bottom = ""
            }

            if (localStorage.getItem('data_taskbar_none')) {
                window_selectors.forEach(selector => {
                    document.querySelectorAll(selector).forEach(element => element.style.top = "auto");
                });
            } else {
                window_selectors.forEach(selector => {
                    document.querySelectorAll(selector).forEach(element => {
                        element.style.transition = "";
                        element.style.top = "40px";
                        element.style.top = `${t}px`;
                    });
                });
            }

            if (check(elm1, elm2) && localStorage.getItem('taskbar_position_button')) {
                toolbar.style.top = "40px";
                toolbar.style.top = `${t}px`;
            } else if (check(elm1, elm2)) {
                toolbar.style.top = "";
                toolbar.style.bottom = `${t}px`;
            }

        }
    })

    function fileborder_reset() {
        Array.from(document.getElementsByClassName('desktop_files')).forEach((df) => {
            const file10 = df.firstElementChild;
            file10.classList.remove('file_select');
        })
    }

    async function startCamera() {
        sessionStorage.setItem('start_camera', true);
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
    let currentKey = null;
    function editor_setCurrentKey(key) {
        currentKey = key;
    }
    function editor_saveToLocalStorage(key) {
        const value = editor.value;
        localStorage.setItem(key, value);
        noticewindow_create("editor", `${key} をローカルストレージに保存しました!`);
    }
    function editor_loadFromLocalStorage(key) {
        editor.classList.remove('pointer_none');
        document.querySelector('.html_mode').textContent = key
        const value = localStorage.getItem(key);
        if (value !== null) {
            editor.value = '';
            editor.value = value;
        } else {
            editor.value = '';
        }
    }
    editor.classList.add('pointer_none');
    function editor_saveCurrentEditorValue() {
        if (currentKey !== null) {
            const value = editor.value;
            localStorage.setItem(currentKey, value);
            noticewindow_create("editor", `${currentKey} をローカルストレージに保存しました!`);
        }
    }
    function testcode_html() {
        localStorage.removeItem('editor');
        editor.value = '<!DOCTYPE html>\n<html>\n<head>\n<title>document</title>\n</head>\n<body>\n<button onclick="test()">a</button>\n<script>\nfunction test(){\nalert("sample text")\n}\n</script>\n</body>\n</html>'
    }
    function testcode_clear() {
        localStorage.removeItem('editor');
        editor.value = '';
    }
    function run() {
        document.querySelectorAll('.htmlviewer_run_menu').forEach(htmlviewer_run_menu => toggleWindow(htmlviewer_run_menu));
        preview.srcdoc = editor.value;
    }

    let isStopped = false; // ストップフラグ

    function cpubench() {
        const cpu_canvas = document.getElementById('benchmarkCanvas');
        const cpu_ctx = cpu_canvas.getContext('2d');
        const numRectangles = 10000;
        const batchSize = 10;
        let i = 0;
        let startTime;
        let isStopped = false;
        function drawBatch() {
            if (isStopped) return;
            if (i === 0) {
                startTime = performance.now();
                document.querySelector('.cpurun_btn').classList.add('pointer_none');
                document.querySelector('.cpu_run_text').textContent = "描画中...";
            }
            for (let j = 0; j < batchSize && i < numRectangles; j++, i++) {
                cpu_ctx.fillStyle = `rgb(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255})`;
                cpu_ctx.fillRect(Math.random() * cpu_canvas.width, Math.random() * cpu_canvas.height, 50, 50);
            }
            if (i < numRectangles) {
                requestAnimationFrame(drawBatch);
            } else {
                const endTime = performance.now();
                const timeTaken = Math.floor((endTime - startTime) / 1000);
                document.querySelector('.cpu_run_text').textContent = `四角形を${numRectangles}個描画するのにかかった時間: ${timeTaken}秒`;
                document.querySelector('.cpurun_btn').classList.remove('pointer_none');
                document.querySelector('.cpurun_btn_clear').classList.remove('pointer_none');
            }
        }
        cpubench_clear();
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
            document.getElementsByClassName('saver_on')[0].classList.remove('pointer_none');
            saver_setTimer();
            setEvents(resetTimer);
            document.getElementsByClassName('screensaver_text')[0].textContent = stime;
        } else {
            noticewindow_create("error", "指定時間の範囲内ではありません!");
        }
    }

    function savertime_clear() {
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

    function saver_count() {
        testtime2 = setTimeout(() => {
            sec = localStorage.getItem('saver_time');
            if (localStorage.getItem('saver_on')) {
                document.querySelector('.saver_time').textContent = len++;
            }
            saver_count()
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
        saver_count();
        saver_setTimer();
        document.querySelector('.saver_time').textContent = len = 0;
        if (localStorage.getItem('saver_on')) {
            document.querySelector('.saver_time').textContent = len++;
        }
        if (screen_saver_group.style.display === "block") {
            nex.style.cursor = '';
            screen_saver_group.style.display = "none";
            ['.screen_saver1', '.screen_saver2', '.screen_saver3'].forEach(selector => {
                document.querySelector(selector).style.display = "none";
            });
        }
    }
    // イベント設定
    function setEvents(func) {
        while (len--) {
            addEventListener(events[len], func, false);
        }
    }
    function saver_clear() {
        ['saver1', 'saver2', 'saver3'].forEach(item => localStorage.removeItem(item));
    }
    function set_saver(saverNum) {
        saver_clear();
        localStorage.setItem(`saver${saverNum}`, true);
        document.getElementsByClassName('screen_mode')[0].textContent = saverNum.toString();
    }
    function saver1() { set_saver(1); }
    function saver2() { set_saver(2); }
    function saver3() { set_saver(3); }
    function screen_saver() {
        const saverKeys = ['saver1', 'saver2', 'saver3'];
        if (screen_saver_group.style.display === "none" && desktop.style.display === "block" &&
            localStorage.getItem('saver_on') && localStorage.getItem('saver_time')) {
            screen_saver_group.style.display = "block";
            const activeSaver = saverKeys.find(key => localStorage.getItem(key)) || 'saver1';
            document.querySelector(`.screen_${activeSaver}`).style.display = "block";
            nex.style.cursor = 'none';
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

    var val, intervalID;
    function startProgress(increment) {
        document.getElementById("myProgress").style.display = "block";
        val = 0;
        document.getElementById("myProgress").value = val;
        intervalID = setInterval(() => updateProgress(increment), 0);
    }
    function updateProgress(increment) {
        val += increment;
        document.getElementById("myProgress").value = val;
        document.getElementById("myProgress").innerText = val + "%";
        if (val >= 100) {
            clearInterval(intervalID);
            setTimeout(() => {
                document.getElementById("myProgress").style.display = "none";
                val = 0;
            }, 1000);
        }
    }

    function old_screen() {
        nex.classList.add('old');
    }
    function old_screen_reset() {
        nex.classList.remove('old');
    }

    function backcolorfilter_clear() {
        localStorage.removeItem("backcolor_filter");
        nex.style.filter = "";
    }
    function applyFilter(filterType, filterValue) {
        backcolorfilter_clear();
        nex.style.filter = filterValue;
        localStorage.setItem("backcolor_filter", filterType);
    }
    function color_bw() { applyFilter("blackwhite", "grayscale(100%)"); }
    function color_invert() { applyFilter("invert", "invert(100%)"); }
    function color_hue() { applyFilter("hue", "hue-rotate(100deg)"); }
    const filterType = localStorage.getItem("backcolor_filter");
    const filters = {
        "blackwhite": "grayscale(100%)",
        "invert": "invert(100%)",
        "hue": "hue-rotate(100deg)"
    };
    if (filterType && filters[filterType]) {
        nex.style.filter = filters[filterType];
    }

    function toggleShadow(action) {
        document.querySelectorAll('.child_list, .sample_child_list').forEach(childlist_shadow => {
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
        const task = taskbar.clientHeight;

        if (taskvalue === "") {
            taskvalue = 40;
            const t = localStorage.setItem('taskbar_height', taskvalue);
            taskbar.style.height = "40px"
            files_inline.style.marginTop = ""

            if (check(elm1, elm2) && !localStorage.getItem('taskbar_position_button')) {
                toolbar.style.bottom = `${task}px`;
            } else if (check(elm1, elm2)) {
                toolbar.style.bottom = "";
            }

            if (check(elm1, elm2) && localStorage.getItem('taskbar_position_button')) {
                toolbar.style.top = `${task}px`;
            } else if (check(elm1, elm2)) {
                toolbar.style.top = "";
            }

        } else if (0 <= taskvalue && taskvalue < 40) {
            noticewindow_create("error", "タスクバーの設定範囲以下に設定されています!");
        } else if (40 <= taskvalue && taskvalue < 251) {
            const t = localStorage.setItem('taskbar_height', taskvalue);
            taskbar.style.height = taskvalue + "px"
            desktop_version_text.style.bottom = "40px";
            desktop_version_text.style.bottom = taskvalue + "px";
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
                files_inline.style.marginTop = `${t2}px`
                const task = taskbar.clientHeight;
                child_start_menu.style.top = `${task}px`
                child_start_menu.style.top = `${t}px`
            } else if (localStorage.getItem('taskbar_autohide')) {
                taskbar_autohide();
                const task = taskbar.clientHeight;
                child_start_menu.style.bottom = `${task}px`
            } else {
                const task = taskbar.clientHeight;
                child_start_menu.style.bottom = `${task}px`
                child_start_menu.style.bottom = `${t}px`
            }
        } else {
            noticewindow_create("error", "タスクバーの設定範囲を超えています!");
        }
    }

    document.querySelector('.taskbar_height_value').addEventListener('input', function () { if (this.value.length > 3) this.value = this.value.slice(0, 3); });
    function taskheight_clear() {
        document.getElementsByClassName('taskbar_height_value')[0].value = "40";
        localStorage.removeItem('taskbar_height');
        taskbar.style.height = "";
        child_start_menu.style.top = "";
        child_start_menu.style.bottom = "";
        if (localStorage.getItem('taskbar_position_button')) {
            files_inline.style.marginTop = "40px";
            const task = taskbar.clientHeight;
            child_start_menu.style.top = `${task}px`;
            desktop_version_text.style.bottom = "0px";
        } else if (localStorage.getItem('taskbar_autohide')) {
            taskbar_autohide();
        } else {
            const task = taskbar.clientHeight;
            child_start_menu.style.bottom = `${task}px`;
            desktop_version_text.style.bottom = "40px";
        }
    }

    const clock_canvas = document.getElementById("analog_clock");
    const clock_ctx = clock_canvas.getContext('2d');
    const dayArr = ["日", "月", "火", "水", "木", "金", "土"];

    function drawHand(length, width, angle) {
        clock_ctx.beginPath();
        clock_ctx.moveTo(150, 150);
        clock_ctx.lineTo(150 + length * Math.cos(Math.PI / 180 * (270 + angle)), 150 + length * Math.sin(Math.PI / 180 * (270 + angle)));
        clock_ctx.lineWidth = width;
        clock_ctx.stroke();
    }

    function drawClock() {
        const d = new Date();
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        const date = d.getDate();
        const day = d.getDay();
        const hours24 = d.getHours();
        const hours = hours24 % 12;
        const minutes = d.getMinutes();
        const seconds = d.getSeconds();
        const dateText = `${year}-${("0" + month).slice(-2)}-${("0" + date).slice(-2)} ${dayArr[day]}`;
        const amPm = hours24 >= 12 ? "午後" : "午前";

        clock_ctx.clearRect(0, 0, clock_canvas.width, clock_canvas.height);
        clock_ctx.beginPath();
        clock_ctx.arc(150, 150, 150, 0, Math.PI * 2);
        clock_ctx.lineWidth = 1.0;
        clock_ctx.stroke();

        for (let i = 0; i < 60; i++) {
            clock_ctx.beginPath();
            clock_ctx.moveTo(150 + 150 * Math.cos(Math.PI / 180 * (270 + i * 6)), 150 + 150 * Math.sin(Math.PI / 180 * (270 + i * 6)));
            clock_ctx.lineTo(150 + (i % 5 === 0 ? 140 : 145) * Math.cos(Math.PI / 180 * (270 + i * 6)), 150 + (i % 5 === 0 ? 140 : 145) * Math.sin(Math.PI / 180 * (270 + i * 6)));
            clock_ctx.lineWidth = i % 5 === 0 ? 1.5 : 1;
            clock_ctx.stroke();
        }

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

        drawHand(140, 1, seconds * 6);
        drawHand(130, 3, 6 * (minutes + seconds / 60));
        drawHand(100, 6, 30 * (hours + minutes / 60));
    }

    document.querySelectorAll('.close_button, .close_button2, .close_button3, .close_button4').forEach(close_buttons => {
        close_buttons.classList.add('allclose_button');
    });
    document.querySelectorAll('.pointer_none *').forEach(element => {
        element.classList.add('pointer_none');
    });


    navigator.mediaDevices.enumerateDevices()
        .then((devices) => {
            devices.forEach((device) => {
                document.querySelector('.device_text').innerHTML = (device.kind + ": " + device.label + "<br>" +
                    " id = " + device.deviceId + "<br>" + "group = " + device.groupId);
            });
        })
        .catch((error) => {
            document.querySelector('.device_text').textContent = ("デバイスが検出されませんでした:", error);
        });

    getOrientation()
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
    window.addEventListener("orientationchange", getOrientation);

    function drawOmikuji() {
        const omikuji_results = ['大吉', '中吉', '小吉', '末吉', '凶', '大凶', '超大凶'];
        const index = Math.floor(Math.random() * omikuji_results.length);
        document.querySelector('.omikuji_text').textContent = omikuji_results[index] + ' です！';
    }


    function localmemory_size() {
        if (desktop.style.display === "block") {
            noticewindow_create("load", "データを読み込み中...");
            document.querySelector('.local_memory_button').classList.add('pointer_none');
            const testKey = 'testStorageKey';
            const testData = new Array(1024).join('a');
            let maxSize = 0;
            try {
                while (true) {
                    localStorage.setItem(testKey + maxSize, testData);
                    maxSize++;
                }
            } catch (e) {
                // error
            } finally {
                for (let i = 0; i < maxSize; i++) {
                    localStorage.removeItem(testKey + i);
                }
            }
            document.querySelector('.local_memory').innerHTML = "";
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                const value = localStorage.getItem(key);
                const valueSize = new Blob([value]).size;
            }
            setTimeout(() => {
                document.querySelector('.local_memory').innerHTML = `&emsp;${maxSize}KB&emsp;`;
                localStorage.setItem('maxSize', maxSize);
                document.querySelector('.local_memory_button').classList.remove('pointer_none');
                if (localStorage.getItem('memoryOver')) {
                    localStorage.removeItem('memoryOver');
                }
                document.querySelector('.add_create_load_windows').remove();
                zindexwindow_addnavy();
                displayLocalStorageDetails();
                window.scrollTo(0, 0);
            }, 0);
        }
    }

    let lastKeys = getLocalStorageKeysAndValues();
    function checkStorageChange() {
        const currentKeys = getLocalStorageKeysAndValues();
        if (Object.keys(currentKeys).length !== Object.keys(lastKeys).length || Object.keys(currentKeys).some(key => currentKeys[key] !== lastKeys[key])) {
            lastKeys = currentKeys;
            localmemory_size();
        }
        const maxSize = localStorage.getItem('maxSize');
        if (maxSize === '0' && !localStorage.getItem('memoryOver')) {
            noticewindow_create("warning", "nexser の保存容量を超えています!", "nexser");
            localStorage.setItem('memoryOver', true);
        } else if (localStorage.getItem('memoryOver') && maxSize !== '0') {
            localStorage.removeItem('memoryOver');
        }
    }
    function getLocalStorageKeysAndValues() {
        return Object.keys(localStorage).reduce((storage, key) => {
            if (!key.startsWith('windowfile_time')) storage[key] = localStorage[key];
            return storage;
        }, {});
    }
    function calculateLocalStorageSize() {
        return Object.entries(localStorage).reduce((total, [key, value]) => key.startsWith('windowfile_time') ? total : total + key.length + value.length, 0);
    }

    document.querySelector('.local_memory').innerHTML = `&emsp;${localStorage.getItem('maxSize')}KB&emsp;`;
    function displayLocalStorageDetails() {
        document.querySelectorAll('.localstorage_key').forEach(localstorage_key => localstorage_key.remove());
        const list = document.getElementById('localStorageList');
        let totalSize = 0;
        const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).sort();
        keys.forEach(key => {
            const value = localStorage.getItem(key);
            const valueSize = new Blob([value]).size;
            totalSize += valueSize;
            const listItem = document.createElement('li');
            listItem.classList.add('border', 'localstorage_key');
            listItem.style.width = "max-content";
            listItem.style.marginTop = "5px";
            listItem.textContent = `Keyname: ${key}, Size: ${valueSize} Byte`;
            list.appendChild(listItem);
        });
        document.getElementById('totalSize').textContent = `Total Size: ${totalSize} Byte`;
    }

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

    let bgImg = document.createElement("img");
    const wallpaper_allremove = () => {
        bgImg.src = "";
        bgImg.style.display = "none";
        ['.nexser_backgroundimage_1', '.nexser_backgroundimage_2', '.nexser_backgroundimage_3', '.nexser_backgroundimage_4'].forEach(selector => {
            document.querySelector(selector).style.display = "none";
        });
        ['wallpaper_95', 'wallpaper_95_2', 'wallpaper_xp', 'wallpaper_space'].forEach(item => localStorage.removeItem(item));
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
    document.querySelector('.wallpaper_space').addEventListener('click', () => setWallpaper('wallpaper_space', '.nexser_backgroundimage_4', minidesk_backgroundresize4));
    function bk_applyStyles() {
        if (!bgImg.src.includes("nexser_image") || !bgImg.src.includes("http")) {
            bgImg.style.display = "none";
        } else {
            bgImg.style.display = "block";
            bgImg.style.width = `${mini_desktop.clientWidth}px`;
            bgImg.style.height = `${mini_desktop.clientHeight}px`;
            mini_desktop.appendChild(bgImg);
        }
    }
    function minidesk_backgroundresize1() {
        bgImg.src = "nexser_image/Windows95_wallpaper.jpg";
        bk_applyStyles();
    }
    function minidesk_backgroundresize2() {
        bgImg.src = "nexser_image/Windows95_wallpaper_2.png";
        bk_applyStyles();
    }
    function minidesk_backgroundresize3() {
        bgImg.src = "nexser_image/Windowsxp_wallpaper.jpg";
        bk_applyStyles();
    }
    function minidesk_backgroundresize4() {
        bgImg.src = "nexser_image/space_wallpaper.png";
        bk_applyStyles();
    }


    const othello_board = document.getElementById('othello_board');
    const size = 8;
    let currentPlayer = 'othello_black';

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
        const output = document.getElementById('nexser_files_output');
        function createTree(element) {
            const ul = document.createElement('ul');
            for (const child of element.children) {
                const li = document.createElement('li');
                const textContent = child.textContent.trim();
                li.textContent = textContent;
                li.classList.add(textContent.includes('.') ? 'nexser_files_file' : 'nexser_files_folder');
                const childTree = createTree(child);
                if (childTree) {
                    li.appendChild(childTree);
                }
                ul.appendChild(li);
            }
            return ul.children.length ? ul : null;
        }
        const tree = createTree(nexser);
        if (tree) {
            output.appendChild(tree);
        }
    }
    function nexser_files_output_remove() {
        const parentElement = document.getElementById('nexser_files_output');
        parentElement.innerHTML = '';
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
        const observer_resizer = new MutationObserver(mutations => {
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
        observer_resizer.observe(document.body, { childList: true, subtree: true });
    }
    function attachResizeHandlers(element) {
        const resizers = element.querySelectorAll('.resizer');
        const minSize = 20;
        let originalWidth, originalHeight, originalX, originalY, originalMouseX, originalMouseY;
        let overlay;
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
                overlay = document.createElement('div');
                overlay.style.position = 'fixed';
                overlay.style.top = 0;
                overlay.style.left = 0;
                overlay.style.width = '100%';
                overlay.style.height = '100%';
                overlay.style.zIndex = 9999;
                overlay.style.cursor = getComputedStyle(resizer).cursor;
                document.body.appendChild(overlay);
                window.addEventListener('mousemove', resize);
                window.addEventListener('mouseup', stopResize);
            });
            function resize(e) {
                const dx = e.pageX - originalMouseX;
                const dy = e.pageY - originalMouseY;
                const resizer2 = resizer.closest('.child_windows');
                resizer2.classList.remove('leftwindow', 'rightwindow');
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
                if (!clones && !localStorage.getItem('window_afterimage_false')) {
                    const clone = resizer2.cloneNode(true);
                    resizer2.parentNode.appendChild(clone).classList.add('clones');
                    [clone, resizer2].forEach(el => el.style.zIndex = largestZIndex++);
                    requestAnimationFrame(() => {
                        clone.parentNode.appendChild(clone).children[0].classList.add('navy');
                        applyStyles(resizer2, titlecolor_set());
                    });
                    clones = true;
                }
                taskbar.addEventListener('mousemove', stopResize);
            }
            function stopResize() {
                const resizer2 = resizer.closest('.child_windows');
                taskbar.removeEventListener('mousemove', stopResize);
                window.removeEventListener('mousemove', resize);
                window.removeEventListener('mouseup', stopResize);
                if (overlay.parentNode) {
                    document.body.removeChild(overlay);
                }
                if (clones && !localStorage.getItem('window_afterimage_false')) {
                    resizer2.style.background = "";
                    resizer2.style.borderStyle = "";
                    resizer2.style.borderColor = "";
                    resizer2.style.borderWidth = "";
                    resizer2.style.boxShadow = "";
                    resizer2.style.mixBlendMode = "";
                    Array.from(resizer2.children).forEach(child => child.style.opacity = "");
                    document.querySelector('.clones').remove();
                }
                setTimeout(() => {
                    window_back_silver();
                }, 0);
                clones = false;
            }
        });
    }
    makeResizableDivs('.resize');

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
        allwindows.forEach(element => {
            element.style.left = "130px";
            element.style.top = "130px";
        });

        const pass_signin_menu = document.querySelector('.pass_signin_menu');
        pass_signin_menu.style.top = "50%";
        pass_signin_menu.style.left = "50%";
        pass_signin_menu.style.transform = "translate(-50%, -50%)";

        welcome_menu.style.top = "50%";
        welcome_menu.style.left = "50%";
        welcome_menu.style.transform = "translate(-50%, -50%)";
    }

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
                        nex.style.cursor = '';
                        noticewindow_create("warning", "名前は20文字以内で入力してください!", "File rename");
                        element.textContent = originalName;
                    } else {
                        element.textContent = originalName;
                    }
                });
            }
        });
    });

    function addMinimizationButtonListeners(button) {
        if (!button.dataset.listenerAdded) {
            button.addEventListener('click', handleMinimizationButtonClick);
            button.dataset.listenerAdded = true;
        }
    }
    function handleMinimizationButtonClick() {
        const minimizationButton = this.closest('.child_windows');
        if (minimizationButton?.firstElementChild?.classList.contains('navy')) {
            minimizeWindow(minimizationButton);
        }
    }
    function minimizeWindow(window) {
        const windowElement = window.closest('.child_windows');
        if (!windowElement) return;
        Object.assign(windowElement.dataset, {
            originalWidths: windowElement.style.width,
            originalHeights: windowElement.style.height,
            originalTops: windowElement.style.top,
            originalLefts: windowElement.style.left
        });
        window.style.height = '20px';
        window.classList.add('minimization');
        window.scrollTo(0, 0);
        window_animation(window);
        moveToTaskbarButton(window);
    }
    function observeNewElements4() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1 && node.matches('.minimization_button')) {
                            addMinimizationButtonListeners(node);
                        } else if (node.nodeType === 1 && node.matches('.child_windows')) {
                            node.querySelectorAll('.minimization_button').forEach(addMinimizationButtonListeners);
                        }
                    });
                }
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
    document.querySelectorAll('.minimization_button').forEach(addMinimizationButtonListeners);
    observeNewElements4();

    const taskbar_b = document.getElementById('task_buttons2');
    function test_windows_button() {
        document.querySelectorAll('.task_buttons').forEach(task_buttons => task_buttons.remove());
        document.querySelectorAll('.child_windows.selectwindows:not(.no_window):not(.clones)').forEach(windowElement => {
            const nestedChild2 = windowElement.children[0].children[1].textContent;
            const button = document.createElement('div');
            button.className = 'task_buttons button2';
            button.style.position = "relative";
            button.textContent = `　　${nestedChild2}`;
            button.innerHTML += '<span class="title_icon"></span>';
            button.addEventListener('click', () => toggleWindow(windowElement), { once: true });
            taskbar_b.appendChild(button);
        });
        updateButtonClasses();
    }

    function moveToTaskbarButton(minimization_button) {
        const task_buttons = document.querySelectorAll('.task_buttons');
        const index = Array.from(document.querySelectorAll('.child_windows.selectwindows:not(.no_window)')).indexOf(minimization_button);
        if (index !== -1) {
            const button = task_buttons[index];
            const rect = button.getBoundingClientRect();
            Object.assign(minimization_button.style, {
                position: 'absolute',
                top: `${rect.top}px`,
                left: `${rect.left}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
                minWidth: "0px",
                minHeight: "0px"
            });
        }
    }

    let isAnimating = false;
    function toggleWindow(windowElement) {
        if (isAnimating) return;
        isAnimating = true;
        windowElement.style.zIndex = largestZIndex++;
        windowElement.classList.remove('active');
        if (windowElement.classList.contains('minimization')) {
            windowElement.classList.remove('child_windows_invisible')
        }
        updateButtonClasses();
        if (windowElement.classList.contains('minimization')) {
            windowElement.classList.remove('minimization');
            windowElement.style.minWidth = "0px";
            windowElement.style.minHeight = "0px";
            setTimeout(() => {
                const elements22 = windowElement.closest('.child_windows');
                window_animation(elements22);
                Object.assign(elements22.style, {
                    top: elements22.dataset.originalTops,
                    left: elements22.dataset.originalLefts,
                    width: elements22.dataset.originalWidths
                });
                setTimeout(() => {
                    Object.assign(elements22.style, {
                        height: elements22.dataset.originalHeights,
                        scrollTop: 0,
                        scrollLeft: 0
                    });
                    windowElement.style.minWidth = "";
                    windowElement.style.minHeight = "";
                    isAnimating = false;
                }, windowanimation * 1000);
            }, 0);
        } else {
            isAnimating = false;
        }
    }

    function updateButtonClasses() {
        const windows = document.querySelectorAll('.child_windows.selectwindows:not(.no_window)');
        const buttons = document.querySelectorAll('.task_buttons');
        buttons.forEach(button => {
            button.oncontextmenu = (event) => {
                event.preventDefault();
                popups('task_buttons', null, button.textContent);
            };
        });
        windows.forEach((windowElement, index) => {
            if (windowElement.querySelector('.navy')) {
                buttons[index]?.classList.add('tsk_pressed');
            }
        });
    }

    function generateButtonsFromLocalStorage() {
        const fileData = JSON.parse(localStorage.getItem('fileData')) || [];
        fileData.forEach(item => {
            createButton(item.name, item.url);
        });
    }
    generateButtonsFromLocalStorage();
    document.getElementById('urllist_dropzone').addEventListener('dragover', (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
    });
    document.getElementById('urllist_dropzone').addEventListener('drop', (event) => {
        event.preventDefault();
        const files = event.dataTransfer.files;
        const url = event.dataTransfer.getData('text/plain');
        const processFile = (file) => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    let fileData = JSON.parse(localStorage.getItem('fileData')) || [];
                    fileData.push({ name: file.name, url: url });
                    localStorage.setItem('fileData', JSON.stringify(fileData));
                    resolve(file.name);
                };
                reader.readAsDataURL(file);
            });
        };
        if (url && files.length === 0) {
        }
        Array.from(files).forEach(file => {
            processFile(file).then((fileName) => {
                createButton(fileName, url);
                console.log(`Processed file: ${file.name}`);
            });
        });
        let storedFileData = JSON.parse(localStorage.getItem('fileData')) || [];
        console.log("Stored file data:", storedFileData);
    });
    function createButton(name, url) {
        const button = document.createElement('li');
        Object.assign(button.style, { height: "35px", width: "400px", margin: "3px" });
        button.className = 'savebtn button2 white_space_wrap large';
        button.textContent = name;
        button.addEventListener('click', () => {
            if (!sessionStorage.getItem('savebtn_delete')) {
                processUrl(url, name)
            } else {
                removeButton(button, url);
            };
        });
        button.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            popups('savebtn', url);
            document.getElementById('saveurl').textContent = url;
        });
        document.getElementById('buttonContainer').appendChild(button);
    }
    function savebtn_deletemode() {
        if (sessionStorage.getItem('savebtn_delete')) {
            sessionStorage.removeItem('savebtn_delete');
            document.getElementById('del_mode').textContent = "Off"
        } else {
            sessionStorage.setItem('savebtn_delete', true)
            document.getElementById('del_mode').textContent = "On"
        }
    }
    if (sessionStorage.getItem('savebtn_delete')) {
        document.getElementById('del_mode').textContent = "On"
    }
    function removeButton(button, url) {
        document.getElementById('buttonContainer').removeChild(button);
        const updateLocalStorage = (key, filterFn) => {
            const data = JSON.parse(localStorage.getItem(key)) || [];
            const updatedData = data.filter(filterFn);
            localStorage.setItem(key, JSON.stringify(updatedData));
        };
        updateLocalStorage('fileData', item => item.url !== url);
    }

    function processUrl(url, name) {
        const processFile = (url, x, y) => {
            return new Promise((resolve) => {
                const windowDiv = createElement('div', "child_windows testwindow2 resize", null);
                windowDiv.style.left = `${x}px`;
                windowDiv.style.top = `${y}px`;
                windowDiv.style.zIndex = largestZIndex++;
                let fileData = JSON.parse(localStorage.getItem('fileData')) || [];
                fileData = fileData.filter(item => item.url !== url);
                const titleDiv = createElement('div', "title", windowDiv);
                createElement('span', "title_icon", titleDiv);
                createElement('span', "white_space_wrap", titleDiv, name);
                const titleButtons = createElement('div', "title_buttons", windowDiv);
                createElement('span', "drag_button", titleButtons, "&nbsp;");
                const closeButton = createElement('span', "close_button button2 allclose_button", titleButtons);
                createElement('span', "bigscreen_button button2", titleButtons);
                createElement('span', "minscreen_button button2", titleButtons);
                createElement('span', "minimization_button button2", titleButtons);
                createElement('br', null, titleButtons);
                closeButton.addEventListener('click', () => {
                    const parentWindow = closeButton.closest('.child_windows');
                    if (parentWindow) {
                        parentWindow.remove();
                        zindexwindow_addnavy();
                    }
                });
                const windowContents = createElement('div', "window_contents", windowDiv);
                const addIframe = (src) => {
                    const iframe = createElement('iframe', "item_preview", windowContents);
                    iframe.src = src;
                    iframe.style.width = "100%";
                    iframe.style.height = "100%";
                    windowContents.classList.add("scrollbar_none");
                };
                windowDiv.classList.add('selectwindows');
                if (isYouTubeURL(url)) {
                    addIframe(`https://www.youtube.com/embed/${extractYouTubeID(url)}`);
                } else if (isPageUrl(url)) {
                    addIframe(url)
                } else {
                    noticewindow_create("error", "このファイル形式はサポートされていません。");
                }
                setTimeout(() => {
                    pagewindow();
                    resolve();
                }, 0);
                dropArea2.appendChild(windowDiv);
            });
        };
        processFile(url, 0, 0);
    }

    const dropArea = document.querySelector('#files');
    const dropArea2 = document.querySelector('#soft_windows');
    dropArea.addEventListener('dragover', (event) => {
        event.preventDefault();
    });
    dropArea.addEventListener('drop', (event) => {
        event.preventDefault();
        const files = event.dataTransfer.files;
        const files2 = event.dataTransfer;
        const url = files2.getData('text/uri-list');
        const processFile = (file, x, y) => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const result = e.target.result;
                    const windowDiv = createElement('div', "child_windows testwindow2 resize", null);
                    windowDiv.style.left = `${event.clientX}px`;
                    windowDiv.style.top = `${event.clientY}px`;
                    windowDiv.style.zIndex = largestZIndex++;
                    const titleDiv = createElement('div', "title", windowDiv);
                    createElement('span', "title_icon", titleDiv);
                    createElement('span', "white_space_wrap", titleDiv, file.name);
                    const titleButtons = createElement('div', "title_buttons", windowDiv);
                    createElement('span', "drag_button", titleButtons, "&nbsp;");
                    const closeButton = createElement('span', "close_button button2 allclose_button", titleButtons);
                    createElement('span', "bigscreen_button button2", titleButtons);
                    createElement('span', "minscreen_button button2", titleButtons);
                    createElement('span', "minimization_button button2", titleButtons);
                    createElement('br', null, titleButtons);
                    closeButton.addEventListener('click', () => {
                        const parentWindow = closeButton.closest('.child_windows');
                        if (parentWindow) {
                            parentWindow.remove();
                            zindexwindow_addnavy();
                        }
                    });
                    const windowContents = createElement('div', "window_contents", windowDiv);
                    const addMediaContent = (mediaTag, mediaSrc) => {
                        const mediaElement = createElement(mediaTag, "item_preview", windowContents);
                        mediaElement.src = mediaSrc;
                        if (mediaTag === 'video') mediaElement.controls = true;
                        windowContents.classList.add("scrollbar_none");
                    };
                    const addIframe = (src) => {
                        const iframe = createElement('iframe', "item_preview", windowContents);
                        iframe.src = src;
                        iframe.style.width = "100%";
                        iframe.style.height = "100%";
                        windowContents.classList.add("scrollbar_none");
                    };
                    windowDiv.classList.add('selectwindows');
                    if (file.type.startsWith('image/')) {
                        addMediaContent('img', result);
                    } else if (file.type.startsWith('video/')) {
                        addMediaContent('video', result);
                    } else if (file.type === 'application/pdf') {
                        addIframe(result);
                    } else if (file.type.startsWith('text/')) {
                        createElement('p', "item_preview", windowContents, e.target.result);
                    } else if (isYouTubeURL(url)) {
                        addIframe(`https://www.youtube.com/embed/${extractYouTubeID(url)}`);
                    } else if (isPageUrl(url)) {
                        addIframe(url)
                    } else {
                        noticewindow_create("error", "このファイル形式はサポートされていません。");
                    }
                    setTimeout(() => {
                        pagewindow();
                        resolve();
                    }, 0);
                    dropArea2.appendChild(windowDiv);
                };
                reader.readAsDataURL(file);
            })
        }
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            setTimeout(() => {
                noticewindow_create("loading", `読み込み中... ${i + 1} of ${files.length}: ${file.name}`)
                document.querySelector('.add_create_windows').style.zIndex = largestZIndex++;
                processFile(file, event.clientX, event.clientY).then(() => {
                    addwindow_remove()
                }).catch(error => {
                    console.error(`Error processing file ${i + 1}:`, error);
                    processingMessage.innerText = `Error processing file ${i + 1} of ${files.length}: ${file.name}`;
                });
            }, i * 250);
        }
    });

    function createElement(tag, className, parent, innerHTML) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (innerHTML) element.innerHTML = innerHTML;
        if (parent) parent.appendChild(element);
        return element;
    };

    function isPageUrl(url) {
        return /(^https?:\/\/|\.html$|\.htm$|\.com$|\.jp$|\.pdf$|\.jpeg$|\.jpg$|\.png$|\.mp4$|\.mp3$)/i.test(url);
    }
    function isYouTubeURL(url_youtube) {
        return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/.test(url_youtube);
    }
    function extractYouTubeID(url_youtube) {
        const match = url_youtube.match(/(?:youtu\.be\/|youtube\.com\/(?:v\/|u\/\w\/|embed\/|watch\?v=|&v=))([^#&?]{11})/);
        return match ? match[1] : null;
    }

    function pagewindow() {
        const testWindows = document.querySelectorAll('.testwindow2:not(.nocreatewindow)');
        testWindows.forEach((testWindow) => {
            testWindow.style.width = '500px';
            testWindow.style.height = '400px';
            testWindow.classList.add("nocreatewindow");
            const centerElement = testWindow.querySelector('.testwindow2 > *:nth-child(3) > *');
            if (centerElement) {
                centerElement.classList.add('center');
            } else {
                testWindow.remove()
            }
        });
        const childWindows = document.querySelectorAll('.testwindow2, .child');
        childWindows.forEach(childWindow => {
            const zindexChildWindow = childWindow.closest('.testwindow2');
            const handleMouseMoveScrollReset = () => {
                document.removeEventListener('mouseup', handleMouseDownResize);
                document.addEventListener('mousemove', handleMouseDownResize);
                zindexChildWindow.scrollTop = 0;
                zindexChildWindow.scrollLeft = 0;
                zindexChildWindow.style.zIndex = largestZIndex++;
            };
            const handleMouseDownResize = () => {
                const { clientWidth: width, clientHeight: height } = zindexChildWindow;
                Object.assign(childWindow.children[2].firstElementChild.style, {
                    maxWidth: `${width}px`,
                    maxHeight: `${height - 25}px`
                });
            };
            childWindow.addEventListener('mousedown', () => {
                handleMouseMoveScrollReset();
                handleMouseDownResize();
            });
        });
    }
    const removePopups = () => document.querySelectorAll('.popup').forEach(popup => popup.remove());
    function popups(popups, url, text) {
        document.querySelectorAll(`.${popups}`).forEach(button => {
            removePopups();
            const popup = document.createElement('div');
            popup.className = 'popup';
            if (url == null) {
                popup.textContent = text;
            } else {
                popup.textContent = url;
            }
            popup.style.zIndex = "999996";
            document.body.appendChild(popup);
            popup.style.left = `${event.pageX}px`;
            popup.style.top = `${event.pageY - popup.offsetHeight}px`;
            button.addEventListener('mouseleave', removePopups);
        });
    }

    document.getElementById('exportButton').addEventListener('click', function () {
        const localStorageData = JSON.stringify(localStorage);
        function base64Encode(str) {
            return btoa(unescape(encodeURIComponent(str)));
        }
        function base64Decode(str) {
            return decodeURIComponent(escape(atob(str)));
        }
        function xorEncrypt(data, key) {
            let encrypted = '';
            for (let i = 0; i < data.length; i++) {
                encrypted += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
            }
            return encrypted;
        }
        const key = 'your-encryption-key';
        const encodedData = base64Encode(localStorageData);
        const encryptedData = xorEncrypt(encodedData, key);
        const blob = new Blob([encryptedData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'nexser_storageData_locked.json';
        a.click();
        URL.revokeObjectURL(url);
    });

    document.getElementById('fileInput').addEventListener('change', async function (event) {
        const file = event.target.files[0];
        const key = 'your-encryption-key';
        const chunkSize = 1024 * 1024;
        const processChunk = async (file, offset, chunkSize, key) => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const base64Decode = str => decodeURIComponent(escape(atob(str)));
                    const xorDecrypt = (data, key) => data.split('').map((char, i) => String.fromCharCode(char.charCodeAt(0) ^ key.charCodeAt(i % key.length))).join('');
                    resolve(JSON.parse(base64Decode(xorDecrypt(e.target.result, key))));
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (error) => reject(error);
            reader.readAsText(file.slice(offset, offset + chunkSize));
        });
        const processFileInChunks = async (file, key, chunkSize) => {
            const totalChunks = Math.ceil(file.size / chunkSize);
            let allData = {};
            for (let offset = 0; offset < totalChunks * chunkSize; offset += chunkSize) {
                const data = await processChunk(file, offset, chunkSize, key);
                allData = { ...allData, ...data };
                await new Promise(resolve => setTimeout(resolve, 0));
            }
            return allData;
        };
        try {
            const allData = await processFileInChunks(file, key, chunkSize);
            localStorage.clear();
            sessionStorage.clear();
            Object.keys(allData).forEach(key => localStorage.setItem(key, allData[key]));
            noticewindow_create("nexser", "データが復元されました! ページを再読み込みしてください。");
            sound(4);
        } catch (error) {
            noticewindow_create("error", error.message);
        }
    });

    function nexser_search_button() {
        const fragment = document.createDocumentFragment();
        const windowElements = document.querySelectorAll('.child_windows:not(.window_nosearch)');
        windowElements.forEach(windowElement => {
            const nestedChild = windowElement.children[0]?.children[1];
            if (nestedChild && nestedChild.textContent) {
                const button = document.createElement('li');
                button.className = 'borderinline_dotted button2 search_button white_space_wrap';
                const span = document.createElement('span');
                span.textContent = `　${nestedChild.textContent}　`;
                button.appendChild(span);
                button.addEventListener('click', () => toggleWindow(windowElement));
                fragment.appendChild(button);
            }
        });
        document.getElementById('myUL').appendChild(fragment);
    }
    nexser_search_button();

    function filesposition() {
        Array.from(document.getElementsByClassName('desktop_files')).forEach(desktop_files => {
            desktop_files.addEventListener('mousedown', () => {
                fileborder_reset()
            });
            desktop_files.addEventListener('click', () => {
                desktop_files.firstElementChild.classList.add('file_select');
            });
        });
        const elements = document.querySelectorAll('.desktop_files');
        elements.forEach((element, index) => {
            const savedPosition = localStorage.getItem(`draggable-${index}`);
            if (savedPosition) {
                const [x, y] = savedPosition.split(',');
                element.style.position = 'absolute';
                element.style.left = `${x}px`;
                element.style.top = `${y}px`;
            }
            element.draggable = true;
            let offsetX, offsetY;
            element.addEventListener('dragstart', (e) => {
                offsetX = e.clientX - element.getBoundingClientRect().left;
                offsetY = e.clientY - element.getBoundingClientRect().top;
                e.dataTransfer.setData('text/plain', null);
                element.style.border = '1.95px dotted dimgray';
                element.style.opacity = '0.9';
                rectangle_remove();
            });
            element.addEventListener('dragend', (e) => {
                const x = e.clientX - offsetX;
                const y = e.clientY - offsetY;
                element.style.position = 'absolute';
                element.style.left = `${x}px`;
                element.style.top = `${y}px`;
                element.firstElementChild.style.opacity = '';
                element.children[1].style.opacity = '';
                element.style.opacity = '';
                element.style.border = '';
                localStorage.setItem(`draggable-${index}`, `${x},${y}`);
            });
        });

    }
    function rectangle_remove() {
        document.querySelectorAll('.rectangle').forEach(e => e.remove());
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
        currentDate = new Date();
        alarm_hours = adjustDigit(currentDate.getHours());
        alarm_minutes = adjustDigit(currentDate.getMinutes());
        alarm_seconds = adjustDigit(currentDate.getSeconds());
        timerText.innerHTML = `${alarm_hours}:${alarm_minutes}:${alarm_seconds}`;
        for (var i = 0, len = record.length; i < len; i++) {
            if (record[i].sethour == currentDate.getHours() && record[i].setminute == currentDate.getMinutes() && alarm_seconds == 0) {
                noticewindow_create("alarm", "お時間です!　");
            };
        };
    }
    loadAlarms();

    window.onerror = function (message, source, lineno, colno, error) {
        const errorMessage = `
            メッセージ: ${message}
            ソース: ${source}
            行: ${lineno}
            列: ${colno}
            エラーオブジェクト: ${error}
        `;
        console.log(errorMessage);
        checkStorageChange();
        return false;
    };

    const taskbar_resize = () => {
        setTimeout(() => {
            const [parent, child, rightGroup, taskbar] = [
                '.first_taskbar_buttons',
                '.taskbar_buttons',
                '.taskbar_rightgroup',
                '#taskbar'
            ].map(sel => document.querySelector(sel));
            const isParentHidden = window.getComputedStyle(parent).display === 'none';
            Object.assign(child.style, {
                position: 'absolute',
                left: `${parent.clientWidth + 70}px`,
                width: `${taskbar.clientWidth - rightGroup.clientWidth - (isParentHidden ? 75 : 150)}px`,
                height: `${taskbar.clientHeight - 3}px`
            });
        }, 150);
    };


    const taskbarInitResize = () => {
        window.addEventListener('resize', taskbar_resize);
        new ResizeObserver(taskbar_resize).observe(document.querySelector('.taskbar_rightgroup'));
    };
    window.addEventListener('resize', resizeBackgroundImage);
    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            allwindow_resize();
            taskbarInitResize();
        }
    });
    allwindows.forEach(element => resizeObserver.observe(element));
    function allwindow_resize() {
        cameraframe_resize();
        commandarea_resize();
        taskbar_resize();
        bigwindow_resize();
    }

    function bigwindow_resize() {
        const taskbarHeight = `calc(100% - ${taskbar.clientHeight}px)`;
        const taskbarAutoHide = localStorage.getItem('taskbar_autohide');
        const taskbarBottomEmpty = taskbar.style.bottom === "";
        const elements = document.querySelectorAll('.big:not(.minimization),.leftwindow:not(.minimization),.rightwindow:not(.minimization)');
        elements.forEach(allbig => {
            if (!isAnimating) {
                requestAnimationFrame(() => {
                    allbig.style.width = "";
                    if (taskbarAutoHide) {
                        allbig.style.height = taskbarBottomEmpty ? taskbarHeight : "";
                    } else {
                        allbig.style.height = taskbarHeight;
                    }
                });
            }
        });
        document.querySelectorAll('iframe,video,img').forEach(allbig => {
            setTimeout(() => {
                allbig.style.maxWidth = "100%";
                allbig.style.maxHeight = "100%";
            }, 50);
        });
    }

    function kakeibo_setCurrentDateTime() {
        const now = new Date();
        const date = now.toISOString().split('T')[0];
        const time = now.toTimeString().split(' ')[0].slice(0, 5);
        document.getElementById('kakeibo_date').value = date;
        document.getElementById('kakeibo_time').value = time;
    }
    function kakeibo_addEntry() {
        const type = document.getElementById('type').value;
        const amount = parseFloat(document.getElementById('amount').value) || 0;
        const description = document.getElementById('description').value;
        const date = document.getElementById('kakeibo_date').value;
        const time = document.getElementById('kakeibo_time').value;
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

    const config = { attributes: true, childList: true, subtree: true, attributeFilter: ['class', 'style'] };
    let previousActiveCount = 0, previousLargestZIndex = largestZIndex;
    const callback = () => {
        const currentActiveCount = [...allwindows].filter(node => node.classList.contains('active')).length;
        if (currentActiveCount !== previousActiveCount || previousLargestZIndex !== largestZIndex) {
            previousActiveCount = currentActiveCount;
            previousLargestZIndex = largestZIndex;
            z_index.textContent = getLargestZIndex('.child_windows');
            zindexwindow_addnavy();
            setTimeout(() => document.querySelector('.focus2').blur(), 0);
        }
    };
    const observer = new MutationObserver(callback);
    allwindows.forEach(node => observer.observe(node, config));

    navigator.getBattery().then((battery) => {
        function updateChargeInfo() {
            if (battery.level == 1 && battery.charging == true) {
                battery_child.style.color = "lime";
                battery_child.style.background = "black";
            } else if (battery.charging == false) {
                battery_child.style.color = "black";
                battery_child.style.background = "";
            } else {
                battery_child.style.color = "#FF9900";
                battery_child.style.background = "black";
            }
            if (0 <= battery.level && battery.level < 0.21 && battery.charging == false) {
                noticewindow_create("warning", "バッテリー残量が少なくなっています!", "warning");
            }
            if (battery.charging == true) {
                document.getElementsByClassName('battery_time')[0].textContent = (`${battery.dischargingTime}`);
            } else {
                document.getElementsByClassName('battery_time')[0].textContent = (`${battery.dischargingTime} second`);
            }
            const taskBatteryElements = document.getElementsByClassName('taskbattery');
            taskBatteryElements[0].textContent = Math.floor(battery.level * 100);
        }
        battery.addEventListener('levelchange', updateChargeInfo);
        battery.addEventListener('chargingchange', updateChargeInfo);
        updateChargeInfo()
    })

    document.querySelectorAll('.window_tool').forEach(windowtool_files => {
        const windowtool_files_parent = document.createElement('div');
        windowtool_files_parent.innerHTML = `<span class="bold" style="position: absolute; margin-top: 5px;">Address</span>
  <span class="winchild_border"></span>
  <div class="windowtool_parent">
    <span class="startmenu_file_icon"></span>
    <button class="button2" style="height: 20px; font-size: large; float: right;">&#x25BC;</button>
    &emsp;&emsp;<span class="windowtool_child_filenames"></span>
    <div class="windowtool_child">
      <ul>
        ${[
                { text: 'main', class: 'test_button' },
                { text: 'my computer', class: 'test_button2' },
                { text: 'browser', class: 'test_button33' },
                { text: 'control panel', class: 'test_button3' },
                { text: 'accessory', class: 'test_button15' },
                { text: 'sound', class: 'test_button8' },
                { text: 'nexser prompt', class: 'test_button6' },
                { text: 'driver', class: 'test_button9' },
                { text: 'notepad', class: 'test_button12' },
                { text: 'objective sheet', class: 'test_button30' },
            ].map(item => `
          <li class="${item.class}"><span class="startmenu_file_icon"></span>${item.text}</li>`).join('')}
      </ul>
    </div>
  </div>`;
        windowtool_files.appendChild(windowtool_files_parent);
    });
    document.querySelectorAll('.windowtool_parent').forEach(parent => {
        const child = parent.lastElementChild;
        parent.addEventListener('mousedown', (event) => {
            if (!event.target.closest('.windowtool_child')) {
                child.style.display = (child.style.display === 'block') ? 'none' : 'block';
            }
        });
        child.addEventListener('click', (event) => {
            event.stopPropagation();
            child.style.display = 'none';
        });
    });
    document.querySelectorAll('.windowtool_child_filenames').forEach(filename => {
        filename.textContent = filename.closest('.child_windows').children[0].lastElementChild.textContent;
    });
    document.querySelectorAll('.windowtool_buttons_child').forEach(windowtool_buttons_child => {
        const buttonsHTML = `<button class="button2 windowfile2 bold" style="width: 25px;">・</button>
  <button class="button2 windowfile1 bold" style="width: 25px;">ー</button>
  <button class="button2 windowfile3 bold" style="width: 25px;">=&nbsp;=</button>
  <button class="button2 nexser_search" style="width: 25px;">&nbsp;<span class="magnifying_glass"></span></button>
  <button class="button2" onclick="filetimes_test()" style="width: 25px; margin-left: 10px;">TR</button>
  <button class="button2" onclick="filetimes_test2()" style="width: 25px;">TF</button>
  <button class="button2" onclick="window_subtitle()" style="width: 25px; margin-left: 10px; text-shadow: 4px 4px 2px dimgray;">title</button>`;
        const windowtool_childbtns = document.createElement('div');
        windowtool_childbtns.innerHTML = buttonsHTML;
        windowtool_childbtns.style = "display: flex; height: 25px;";
        windowtool_buttons_child.appendChild(windowtool_childbtns);
        setTimeout(() => {
            document.querySelectorAll('.windowfile1').forEach((windowfile_1) => {
                windowfile_1.addEventListener('click', () => {
                    localStorage.setItem('windowfile_1', true);
                    localStorage.removeItem('windowfile_2');
                    localStorage.removeItem('windowfile_3');
                    window_file_list_change();
                });
            });
            document.querySelectorAll('.windowfile2').forEach((windowfile_2) => {
                windowfile_2.addEventListener('click', () => {
                    localStorage.setItem('windowfile_2', true);
                    localStorage.removeItem('windowfile_1');
                    localStorage.removeItem('windowfile_3');
                    window_file_list_reset();
                });
            });
            document.querySelectorAll('.windowfile3').forEach((windowfile3) => {
                windowfile3.addEventListener('click', () => {
                    localStorage.setItem('windowfile_3', true);
                    localStorage.removeItem('windowfile_1');
                    localStorage.removeItem('windowfile_2');
                    window_file_list_change2();
                });
            });
            document.querySelectorAll('.nexser_search').forEach(nexser_search => { nexser_search.onclick = null; nexser_search.onclick = () => { toggleWindow(nexser_search_menu); }; });
            if (localStorage.getItem('filetimes')) {
                document.querySelectorAll('.windowfile_time').forEach(windowfileTime => {
                    windowfileTime.style.display = 'none';
                });
            }
        }, 100);
    });

    function window_subtitle() {
        if (localStorage.getItem('window_subtitle')) {
            localStorage.removeItem('window_subtitle');
            document.querySelectorAll('.window_subtitles').forEach(element => {
                element.style.display = "none"
            })
        } else {
            localStorage.setItem('window_subtitle', true);
            document.querySelectorAll('.window_subtitles').forEach(element => {
                element.style.display = "block"
            })
        }
    }

    document.querySelectorAll('.file_windows').forEach(file_windows => {
        const lastChildElement = file_windows.querySelector('.title').lastElementChild;
        const test3 = file_windows.children[4];
        const file_windows_parent_html = `<div class="xx-large bold window_subtitles" style="display: none; background: linear-gradient(225deg,rgb(216, 250, 250) 20%,rgb(210, 252, 210) 50%, whitesmoke,rgb(219, 219, 219)); text-shadow: 4px 4px 2px dimgray;">
                ${lastChildElement.textContent} 
                <div class="welcome_icons" style="opacity: 0.2; z-index: -1;">
                    <span class="welicon_1"></span>
                    <span class="welicon_2"></span>
                </div>
            </div>`;
        test3.insertAdjacentHTML('afterbegin', file_windows_parent_html);
    });
    if (localStorage.getItem('window_subtitle')) {
        document.querySelectorAll('.window_subtitles').forEach(element => {
            element.style.display = "block"
        })
    }

    function filetimes_test() {
        localStorage.removeItem('filetimes')
        if (localStorage.getItem('windowfile_1') || localStorage.getItem('windowfile_3')) {
            Array.from(document.getElementsByClassName('windowfile_time')).forEach((windowfile_time) => {
                windowfile_time.style.display = "block"
            })
        }
    }
    function filetimes_test2() {
        localStorage.setItem('filetimes', true)
        if (localStorage.getItem('filetimes')) {
            Array.from(document.getElementsByClassName('windowfile_time')).forEach((windowfile_time) => {
                windowfile_time.style.display = "none"
            })
        }
    }

    function addwindow_remove() {
        document.querySelector('.add_create_windows').remove();
    }

    function noticewindow_create(window_icon, errorTitle, errorMessage = "Error") {
        nex.style.cursor = "";
        const entryDiv = document.createElement("div");
        const isWarning = window_icon === "warning";
        const isError = window_icon === "error";
        const isLoad = window_icon === "load";
        entryDiv.className = "child_windows error_windows back_silver no_window";
        if (isWarning) {
            sound(4);
            errorMessage = "warning";
        } else if (isError) {
            sound(2);
        } else if (isLoad) {
            errorMessage = "loading";
            entryDiv.classList.add('add_create_load_windows')
        } else {
            errorMessage = window_icon;
            entryDiv.classList.add('add_create_windows')
        }
        const icon = isWarning ? '<span class="warning_icon bold" style="position: absolute; top: 45px;">!</span>' :
            isError ? '<span class="error_icon">✕</span>' : '';
        entryDiv.innerHTML = `
            <div class="title"><span class="bold error_title_text">${errorMessage}</span></div>
            <div class="title_buttons">
                <span class="drag_button">&nbsp;</span>
                <span class="close_button button2 allclose_button" onclick="error_windows_close(event)"></span>
            </div>
            <div class="window_content">
                <p>${icon}<span class="window_error_text">${errorTitle}</span></p>
                <span class="button2 borderinline_dotted" style="position: relative; left: 50%; 
                transform: translateX(-50%);" onclick="error_windows_close(event)">&emsp;OK&emsp;</span>
            </div>`;
        entryDiv.addEventListener("mousedown", event => {
            event.currentTarget.style.zIndex = ++largestZIndex;
        });
        dropArea2.appendChild(entryDiv);
        window_back_silver();
        entryDiv.style.zIndex = ++largestZIndex;
    }

    function showPosition(position) {
        const { latitude, longitude, accuracy } = position.coords;
        document.getElementById('location').innerHTML =
            `緯度: ${latitude} <br> 経度: ${longitude} <br> 精度: ${accuracy} メートル`;
    }
    function showError(error) {
        const messages = {
            1: "ユーザーが位置情報の取得を拒否しました。",
            2: "位置情報が利用できません。",
            3: "位置情報の取得がタイムアウトしました。",
            0: "不明なエラーが発生しました。"
        };
        document.getElementById('location').innerHTML = (messages[error.code] || messages[0]);
    }
    function poti_btn() {
        if (navigator.geolocation) {
            document.getElementById('location').innerHTML = "loading..."
            navigator.geolocation.watchPosition(showPosition, showError, {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            });
        } else {
            document.getElementById('location').innerHTML = "このブラウザでは位置情報がサポートされていません。";
        }
    }

    document.querySelectorAll('.frame_fullbutton').forEach(button => {
        button.addEventListener('click', function () {
            let parent = button.closest('.child_windows');
            if (parent) {
                let iframeOrVideo = parent.querySelector('iframe, video');
                if (iframeOrVideo) {
                    if (iframeOrVideo.requestFullscreen) {
                        iframeOrVideo.requestFullscreen();
                    } else if (iframeOrVideo.mozRequestFullScreen) {
                        iframeOrVideo.mozRequestFullScreen();
                    } else if (iframeOrVideo.webkitRequestFullscreen) {
                        iframeOrVideo.webkitRequestFullscreen();
                    } else if (iframeOrVideo.msRequestFullscreen) {
                        iframeOrVideo.msRequestFullscreen();
                    }
                }
            }
        });
    });


    let selectedImage = null;

    function execCmd(command, value = null) {
        document.execCommand(command, false, value);
    }

    editor_2.addEventListener('mousedown', () => {
        const images = editor_2.querySelectorAll('img');
        for (const img of images) {
            img.style.border = '';
        }
    });
    editor_2.addEventListener("keydown", event => {
        if (event.ctrlKey && event.key === 's') {
            event.preventDefault();
        }
    });
    editor_2.addEventListener("keyup", event => {
        if (event.ctrlKey && event.key === 's') {
            saveContent();
        }
    });

    function saveContent() {
        const content = editor_2.innerHTML;
        const doc = new DOMParser().parseFromString(content, 'text/html');
        const imageMap = {};
        Array.from(doc.getElementsByTagName('img')).forEach(img => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const originalSrc = img.src;
            const uniqueKey = generateUniqueKey();
            canvas.width = img.width / 10;
            canvas.height = img.height / 10;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            img.src = canvas.toDataURL('image/jpeg', 0.0005);
            imageMap[uniqueKey] = originalSrc;
            img.setAttribute('data-url', uniqueKey);
        });
        const editorContent = {
            htmlContent: btoa(unescape(encodeURIComponent(doc.body.innerHTML))),
            imageMap: imageMap
        };
        localStorage.setItem('editorContent', JSON.stringify(editorContent));
        noticewindow_create("Editor", "保存しました!");
    }
    function editorContent_load() {
        const savedEditorContent = localStorage.getItem('editorContent');
        if (savedEditorContent) {
            const parsedEditorContent = JSON.parse(savedEditorContent);
            const doc = new DOMParser().parseFromString(decodeURIComponent(escape(atob(parsedEditorContent.htmlContent))), 'text/html');
            const imageMap = parsedEditorContent.imageMap;
            Array.from(doc.getElementsByTagName('img')).forEach(img => {
                const uniqueKey = img.getAttribute('data-url');
                if (imageMap[uniqueKey]) {
                    img.src = imageMap[uniqueKey];
                }
            });
            editor_2.innerHTML = doc.body.innerHTML;
        }
    }
    function generateUniqueKey() {
        return 'img_' + Math.random().toString(36).substr(2, 9);
    }

    function toggleDecoration() {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const parentElement = range.commonAncestorContainer.parentElement;

            if (parentElement && parentElement.style.border) {
                // 装飾を解除
                const textNode = document.createTextNode(parentElement.textContent);
                parentElement.parentNode.replaceChild(textNode, parentElement);
            } else {
                const selectedText = range.toString().trim();
                if (selectedText) {
                    // 装飾を追加
                    const span = document.createElement('span');
                    span.style.border = '2px solid black';
                    span.style.display = 'inline';
                    span.textContent = selectedText;
                    range.deleteContents();
                    range.insertNode(span);
                }
            }
        }
        if (selectedImage) {
            if (selectedImage.classList.contains('img_border')) {
                selectedImage.classList.remove('img_border')
            } else {
                selectedImage.classList.add('img_border')
            }
        }
    }

    function toggleShadows() {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const parentElement = range.commonAncestorContainer.parentElement;
            if (parentElement && parentElement.style.textShadow) {
                parentElement.style.textShadow = '';
            } else {
                const span = document.createElement('span');
                span.style.textShadow = '3px 3px 6px dimgray';
                span.textContent = range.toString();
                range.deleteContents();
                range.insertNode(span);
            }
        }
    }

    function toggleBoxShadow() {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const parentElement = range.commonAncestorContainer.parentElement;
            if (parentElement && parentElement.style.boxShadow) {
                parentElement.style.boxShadow = '';
            } else {
                const span = document.createElement('span');
                span.style.boxShadow = '3px 3px 6px dimgray';
                span.textContent = range.toString();
                range.deleteContents();
                range.insertNode(span);
            }
        }
        if (selectedImage) {
            if (selectedImage.style.boxShadow) {
                selectedImage.style.boxShadow = '';
            } else {
                selectedImage.style.boxShadow = '5px 5px 15px rgba(0, 0, 0, 0.5)';
            }
        }
    }

    editor_2.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
            setTimeout(() => {
                setNormal();
            }, 0);
        }
    });


    function setNormal() {
        const selectElement = document.getElementById('fontSizeSelect');
        selectElement.value = '5';
        changeFontSize(selectElement.value);
    }

    editor_2.addEventListener('input', function (event) {
        if (event.inputType === 'insertParagraph') {
            const selection = window.getSelection();
            const range = selection.getRangeAt(0);
            const newNode = document.createElement('span');
            let rootParent = range.startContainer;
            while (rootParent.parentNode && rootParent.nodeName !== 'DIV') {
                rootParent = rootParent.parentNode;
            }
            if (rootParent.nodeName === 'DIV') {
                console.log('Clearing all children of:', rootParent);
                while (rootParent.firstChild) {
                    rootParent.removeChild(rootParent.firstChild);
                }
            }
            newNode.appendChild(document.createTextNode('\u200B'));
            rootParent.appendChild(newNode);
            range.setStart(newNode, 0);
            range.setEnd(newNode, 0);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    });

    function changeFontSize(size) {
        document.execCommand('fontSize', false, size);
    }

    function exportToHTML() {
        const elements = editor_2.getElementsByTagName('*');
        for (let i = 0; i < elements.length; i++) {
            elements[i].setAttribute('contenteditable', 'false');
        }
        const content = editor_2.innerHTML;
        // 新しいドキュメントを作成してコンテンツを保持
        const doc = document.implementation.createHTMLDocument('Exported Content');
        doc.body.innerHTML = content;
        // 元のドキュメントからスタイルをコピー
        const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
        styles.forEach(style => {
            doc.head.appendChild(style.cloneNode(true));
        });
        const blob = new Blob([doc.documentElement.outerHTML], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'editor_content.html';
        a.click();
        URL.revokeObjectURL(url);
        setTimeout(() => {
            for (let i = 0; i < elements.length; i++) {
                elements[i].setAttribute('contenteditable', 'true');
            }
        }, 1000);
    }

    function printDiv() {
        var printContents = editor_2.innerHTML;
        var originalContents = document.body.innerHTML;
        document.body.style.backgroundColor = "white";
        document.body.style.height = "100vh";
        var printContainer = document.createElement('div');
        printContainer.innerHTML = printContents;
        var bodyChildren = document.body.children;
        for (var i = 0; i < bodyChildren.length; i++) {
            if (bodyChildren[i] !== printContainer) {
                bodyChildren[i].style.display = 'none';
            }
        }
        document.body.appendChild(printContainer);
        window.print();
        setTimeout(() => {
            for (var i = 0; i < bodyChildren.length; i++) {
                bodyChildren[i].style.display = '';
            }
            document.body.removeChild(printContainer);
        }, 500);
    }


    const maxRecentColors = 15; // 最近使用した色の最大数

    // ローカルストレージから色を取得
    const recentTextColors = JSON.parse(localStorage.getItem('recentTextColors')) || [];
    const recentBgColors = JSON.parse(localStorage.getItem('recentBgColors')) || [];

    document.getElementById('editor_textColor').addEventListener('change', function () {
        addRecentColor(this.value, recentTextColors, 'recentTextColors');
        applyTextColor(this.value);
    });

    document.getElementById('editor_bgColor').addEventListener('change', function () {
        addRecentColor(this.value, recentBgColors, 'recentBgColors');
        applyBgColor(this.value);
    });

    function addRecentColor(color, colorArray, storageKey) {
        if (!colorArray.includes(color)) {
            if (colorArray.length >= maxRecentColors) {
                colorArray.shift(); // 古い色を削除
            }
            colorArray.push(color);
            localStorage.setItem(storageKey, JSON.stringify(colorArray));
            updateRecentColors(colorArray, storageKey);
        }
    }

    function updateRecentColors(colorArray, elementId) {
        const recentColorsDiv = document.getElementById(elementId);
        recentColorsDiv.innerHTML = '';
        colorArray.forEach(color => {
            const colorBox = document.createElement('div');
            colorBox.className = 'color-box border2';
            colorBox.style.backgroundColor = color;
            colorBox.addEventListener('click', function () {
                if (elementId === 'recentTextColors') {
                    applyTextColor(color);
                } else if (elementId === 'recentBgColors') {
                    applyBgColor(color);
                }
            });
            recentColorsDiv.appendChild(colorBox);
        });
    }

    function applyTextColor(color) {
        document.execCommand('foreColor', false, color);
    }

    function applyBgColor(color) {
        document.execCommand('hiliteColor', false, color);
    }

    document.getElementById('colorPickerButton').addEventListener('click', function () {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const selectedText = range.startContainer.parentElement;
            const color = window.getComputedStyle(selectedText).color;
            console.log(color)
            const colorPanelContainer = document.getElementById('colorPanelContainer');
            colorPanelContainer.style.backgroundColor = color;
            colorPanelContainer.addEventListener('click', function () {
                document.execCommand('foreColor', false, color);
            });
        }
    });

    // ページロード時に最近使用した色を表示
    updateRecentColors(recentTextColors, 'recentTextColors');
    updateRecentColors(recentBgColors, 'recentBgColors');

    const color_panel_parent = document.querySelector('.color_panel_parent');
    const color_panel_child = document.querySelector('.color_panel_child');

    color_panel_parent.style.left = "-110px";

    color_panel_parent.addEventListener('click', function () {
        if (color_panel_parent.style.left === "-110px") {
            color_panel_parent.style.left = "";
        } else {
            color_panel_parent.style.left = "-110px";
        }
    });

    color_panel_child.addEventListener('click', function (event) {
        event.stopPropagation(); // 親要素のクリックイベントが発火しないようにする
    });
    document.querySelector('.cpc2').addEventListener('click', function (event) {
        event.stopPropagation(); // 親要素のクリックイベントが発火しないようにする
    });

    setTimeout(() => {

        function applyImageHandlers(img) {
            img.style.position = 'absolute';
            img.style.cursor = 'pointer';
            img.setAttribute('draggable', 'false'); // 画像のデフォルトのドラッグを無効化

            img.addEventListener('click', function (event) {
                event.stopPropagation(); // クリックイベントのバブリングを防止
                if (selectedImage) {
                    selectedImage.style.border = ''; // 以前の選択を解除
                }
                selectedImage = img;
                img.style.border = '1.5px solid blue'; // 選択された画像を強調表示
            });

            img.addEventListener('mousedown', function (event) {
                img.setAttribute('contenteditable', 'false'); // 画像を一時的に編集不可に設定

                const editorRect = editor_2.getBoundingClientRect();
                let shiftX = event.clientX - img.getBoundingClientRect().left;
                let shiftY = event.clientY - img.getBoundingClientRect().top;

                function moveAt(pageX, pageY) {
                    img.style.left = pageX - shiftX - editorRect.left + editor_2.scrollLeft + 'px';
                    img.style.top = pageY - shiftY - editorRect.top + editor_2.scrollTop + 'px';
                }

                function onMouseMove(event) {
                    moveAt(event.pageX, event.pageY);
                    img.style.border = '1.5px dashed red';
                }

                document.addEventListener('mousemove', onMouseMove);

                document.addEventListener('mouseup', function () {
                    document.removeEventListener('mousemove', onMouseMove);
                    img.setAttribute('contenteditable', 'true'); // ドラッグ終了後に再度編集可能に設定
                }, { once: true });

                img.addEventListener('dragstart', function (event) {
                    event.preventDefault(); // デフォルトのドラッグアンドドロップを無効化
                });
                event.preventDefault();
            });

            if (!img.hasAttribute('contextmenu-listener')) {
                img.setAttribute('contextmenu-listener', 'true');
            }
            img.addEventListener('contextmenu', (event) => {
                event.preventDefault();
                if (confirm('この画像を削除しますか？')) {
                    img.remove();
                }
            });
        }

        // 初期画像にハンドラを適用
        document.querySelectorAll('#editor_2 img').forEach(applyImageHandlers);

        // ドラッグ中のテキスト選択を防止
        document.addEventListener('selectstart', function (event) {
            if (event.target.tagName === 'IMG') {
                event.preventDefault();
            }
        });

        // MutationObserverを使用して新しい画像にハンドラを適用
        const observer = new MutationObserver(function (mutationsList) {
            for (let mutation of mutationsList) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.tagName === 'IMG') {
                            applyImageHandlers(node);
                        }
                    });
                }
            }
        });

        observer.observe(editor_2, { childList: true, subtree: true });

        editor_2.addEventListener('dragenter', function (event) {
            if (event.dataTransfer.types.includes('Files')) {
                event.preventDefault();
                event.stopPropagation();
            }
        });

        editor_2.addEventListener('dragover', function (event) {
            if (event.dataTransfer.types.includes('Files')) {
                event.preventDefault();
                event.stopPropagation();
            }
        });

        editor_2.addEventListener('dragleave', function (event) {
            if (event.dataTransfer.types.includes('Files')) {
                event.preventDefault();
                event.stopPropagation();
            }
        });

        editor_2.addEventListener('drop', function (event) {
            if (event.dataTransfer.types.includes('Files')) {
                event.preventDefault();
                event.stopPropagation();

                const files = event.dataTransfer.files;
                for (let file of files) {
                    if (file.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onload = function (e) {
                            const img = document.createElement('img');
                            img.src = e.target.result;
                            img.style.position = 'absolute';
                            img.onload = function () {
                                img.style.left = event.clientX - editor_2.getBoundingClientRect().left + editor_2.scrollLeft - img.width / 4 + 'px';
                                img.style.top = event.clientY - editor_2.getBoundingClientRect().top + editor_2.scrollTop - img.height / 4 + 'px';
                            };
                            editor_2.appendChild(img);
                            applyImageHandlers(img);
                        };
                        reader.readAsDataURL(file);
                    }
                }
            }
        });
    }, 500);

    const dropZone = document.getElementById('drop_zone');
    const dropList = dropZone.querySelector('ul');
    fileElements.forEach(draggable => {
        draggable.setAttribute('draggable', 'true');
        draggable.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', e.target.outerHTML);
        });
        draggable.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showContextMenu(e, draggable);
        });
    });
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        const data = e.dataTransfer.getData('text/plain');
        const tempElement = document.createElement('div');
        tempElement.innerHTML = data;
        if (tempElement.querySelector('.desktop_files')) {
            return;
        }
        const tempChildren = tempElement.children;
        if (tempChildren.length === 0) {
            noticewindow_create("warning", '無効なデータです');
            return;
        }
        dropList.innerHTML += data;
        const newElement = dropList.lastElementChild;
        if (!newElement) {
            noticewindow_create("warning", '新しい要素が追加されていません。');
            return;
        }
        newElement.setAttribute('draggable', 'true');
        newElement.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', e.target.outerHTML);
        });
        newElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showContextMenu(e, newElement);
        });
        const firstLi = newElement.querySelector('li');
        if (firstLi) {
            firstLi.textContent += ' shortcut';
        }
        saveToLocalStorage();
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
            const loadedElements = dropList.children;
            Array.from(loadedElements).forEach(element => {
                element.setAttribute('draggable', 'true');
                element.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', e.target.outerHTML);
                });
                element.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    showContextMenu(e, element);
                    removefile_Border()
                    applyBorder(e, element);
                });
            });
        }

        document.querySelectorAll('.nexser_guidebook').forEach(nexser_guidebook => { nexser_guidebook.onclick = null; nexser_guidebook.onclick = () => { toggleWindow(nexser_guidebook_menu); }; });
        document.querySelectorAll('.guidebook_window').forEach(guidebook_window => { guidebook_window.onclick = null; guidebook_window.onclick = () => { toggleWindow(guidebook_window_menu); }; });
        document.querySelectorAll('.guidebook_file').forEach(guidebook_file => { guidebook_file.onclick = null; guidebook_file.onclick = () => { toggleWindow(guidebook_file_menu); }; });
        document.querySelectorAll('.guidebook_taskbar').forEach(guidebook_taskbar => { guidebook_taskbar.onclick = null; guidebook_taskbar.onclick = () => { toggleWindow(guidebook_taskbar_menu); }; });

        document.querySelectorAll('.passmenu_button').forEach(passmenu_button => { passmenu_button.onclick = null; passmenu_button.onclick = () => { toggleWindow(password_menu); }; });
        document.querySelectorAll('.localstorage_details').forEach(localstorage_details => { localstorage_details.onclick = null; localstorage_details.onclick = () => { toggleWindow(localstorage_details_menu); }; });
        document.querySelectorAll('.kakeibo_btn').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(kakeibo_menu); }; });
        document.querySelectorAll('.document_button').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(mydocument_menu); }; });
        document.querySelectorAll('.restriction_btn').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(restriction_menu); }; });

        document.querySelectorAll('.test_button').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(main); }; });
        document.querySelectorAll('.test_button2').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(my_computer); }; });
        document.querySelectorAll('.test_button3').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(control); }; });
        document.querySelectorAll('.test_button4').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(color_menu); }; });
        document.querySelectorAll('.test_button5').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(system_menu); }; });
        document.querySelectorAll('.test_button6').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(window_prompt); }; });
        document.querySelectorAll('.test_button7').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(clock_menu); }; });
        document.querySelectorAll('.test_button8').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(sound_menu); }; });
        document.querySelectorAll('.test_button9').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(driver_menu); }; });
        document.querySelectorAll('.test_button10').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(mouse_menu); }; });
        document.querySelectorAll('.test_button11').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(screen_text_menu); bk_applyStyles(); }; });
        document.querySelectorAll('.test_button12').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(note_pad); notefocus(); }; });
        document.querySelectorAll('.test_button13').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(text_drop_menu); }; });
        document.querySelectorAll('.test_button14').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(windowmode_menu); }; });
        document.querySelectorAll('.test_button15').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(accessory_menu); }; });
        document.querySelectorAll('.test_button16').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(calc_menu); }; });
        document.querySelectorAll('.test_button17').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(nexser_sound_menu); }; });
        document.querySelectorAll('.test_button18').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(camera_menu); }; });
        document.querySelectorAll('.test_button19').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(htmlviewer_edit_menu); }; });
        document.querySelectorAll('.test_button20').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(htmlviewer_run_menu); }; });

        document.querySelectorAll('.test_button22').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(font_menu); }; });
        document.querySelectorAll('.test_button23').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(file_setting_menu); }; });
        document.querySelectorAll('.test_button24').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(debug_menu); }; });
        document.querySelectorAll('.test_button25').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(file_download_menu); }; });
        document.querySelectorAll('.test_button26').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(display_menu); }; });
        document.querySelectorAll('.test_button27').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(stopwatch_menu); timerreset(); }; });
        document.querySelectorAll('.test_button28').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(comment_menu); }; });
        document.querySelectorAll('.test_button30').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(objective_menu); }; });
        document.querySelectorAll('.test_button31').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(calendar_menu); }; });
        document.querySelectorAll('.test_button32').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(cpu_bench_menu); cpubench_open(); }; });
        document.querySelectorAll('.test_button33').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(browser_menu); }; });
        document.querySelectorAll('.test_button35').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(taskbar_setting_menu); }; });
        document.querySelectorAll('.test_button37').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(device_menu); }; });
        document.querySelectorAll('.test_button38').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(omikuji_menu); }; });
        document.querySelectorAll('.test_button39').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(localstorage_monitor_menu); }; });
        document.querySelectorAll('.test_button40').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(paint_menu); }; });

        document.querySelectorAll('.test_button42').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(nexser_files_menu); setTimeout(() => { nexser_files_output_remove(); nexser_files_windowload(); }, 100); }; });
        document.querySelectorAll('.test_button45').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(alarm_menu); }; });
        document.querySelectorAll('.test_button46').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(location_menu); }; });
        document.querySelectorAll('.test_button47').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(editor_menu); }; });
        document.querySelectorAll('.test_button48').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(url_droplist_menu); }; });

        // games

        document.querySelectorAll('.test_button29').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(tetris_mneu); }; });
        document.querySelectorAll('.test_button34').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(bom_menu); }; });
        document.querySelectorAll('.test_button41').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(othello_menu); }; });
        document.querySelectorAll('.test_button44').forEach(testbtn => { testbtn.onclick = null; testbtn.onclick = () => { toggleWindow(memory_game_menu); }; });

        // fileclick

        function handleMouseDown(event) {
            const target = event.currentTarget;
            if (target.classList.contains('file_border')) {
                const fileBorder = document.querySelector('.file_border');
                if (fileBorder) {
                    fileBorder.classList.replace('file_border', 'file_border2');
                }
            }
        }
        function handleClick(event) {
            const target = event.currentTarget;
            document.querySelectorAll('.window_files').forEach((el) => el.classList.remove('file_border', 'file_border2'));
            target.classList.add('file_border');
        }
        document.querySelectorAll('.window_files').forEach((el) => {
            el.addEventListener('mousedown', handleMouseDown);
            el.addEventListener('click', handleClick);
        });

        document.querySelectorAll('.window_files').forEach((element, index) => {
            const uniqueKey = `windowfile_time_${index}`;
            element.addEventListener('click', () => {
                let timeElements = element.querySelectorAll('.windowfile_time');
                if (timeElements.length > 1) {
                    timeElements.forEach((timeElement, i) => {
                        if (i < timeElements.length - 1) {
                            timeElement.remove();
                        }
                    });
                }
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
                filetime_display();
            });
            const savedDateTime = localStorage.getItem(uniqueKey);
            if (savedDateTime) {
                let timeElements = element.querySelectorAll('.windowfile_time');
                if (timeElements.length > 1) {
                    timeElements.forEach((timeElement, i) => {
                        if (i < timeElements.length - 1) {
                            timeElement.remove();
                        }
                    });
                }
                let timeElement = element.querySelector('.windowfile_time');
                if (!timeElement) {
                    timeElement = document.createElement('li');
                    timeElement.className = 'windowfile_time';
                    element.appendChild(timeElement);
                }
                timeElement.textContent = savedDateTime;
                filetime_display();
            }
        });
        function filetime_display() {
            if (!localStorage.getItem('windowfile_1') && !localStorage.getItem('windowfile_2') && !localStorage.getItem('windowfile_3') ||
                !localStorage.getItem('windowfile_1') && localStorage.getItem('windowfile_2') && !localStorage.getItem('windowfile_3')) {
                document.querySelectorAll('.windowfile_time').forEach(windowfile_time =>
                    windowfile_time.style.display = "none"
                );
            }
        }
    }

    function showContextMenu(event, element) {
        const existingMenu = document.querySelector('.context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
        const contextMenu = document.createElement('span');
        contextMenu.className = 'context-menu border back_silver';
        contextMenu.style.position = 'absolute';
        contextMenu.style.top = `${event.clientY}px`;
        contextMenu.style.left = `${event.clientX}px`;
        contextMenu.style.zIndex = '99999';
        contextMenu.innerHTML = '<p id="delete" class="back_silver hover_blue" style="z-index: 99999;">&nbsp;Delete&nbsp;</p>';
        document.body.appendChild(contextMenu);
        const menuHeight = contextMenu.offsetHeight;
        const menuWidth = contextMenu.offsetWidth;
        const windowHeight = window.innerHeight;
        const windowWidth = window.innerWidth;
        let top = event.clientY;
        let left = event.clientX;
        if (top + menuHeight > windowHeight) {
            top = windowHeight - menuHeight;
        }
        if (left + menuWidth > windowWidth) {
            left = windowWidth - menuWidth;
        }
        contextMenu.style.top = `${top}px`;
        contextMenu.style.left = `${left}px`;
        document.getElementById('delete').addEventListener('click', () => {
            element.remove();
            contextMenu.remove();
            saveToLocalStorage();
        });
        document.addEventListener('click', () => {
            contextMenu.remove();
            removefile_Border()
        }, { once: true });
    }
    function applyBorder(event, element) {
        element.classList.add('file_border3')
    }
    function removefile_Border() {
        document.querySelectorAll('.window_files').forEach((rf) => {
            rf.classList.remove('file_border3')
        })
    }
    function filepositon_reset() {
        document.querySelectorAll('.desktop_files').forEach((desktop_file, index) => {
            ['left', 'top', 'position'].forEach(style => desktop_file.style[style] = "");
            localStorage.removeItem(`draggable-${index}`);
        });
    }

    document.querySelectorAll('.window_files').forEach(item => {
        item.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', e.target.outerHTML);
        });
    });
    document.querySelector('#files').addEventListener('dragover', e => e.preventDefault());
    document.querySelector('#files').addEventListener('drop', e => {
        e.preventDefault();
        const data = e.dataTransfer.getData('text/plain');
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = data;
        const firstChild = tempDiv.firstElementChild;
        if (firstChild && firstChild.classList.contains('window_files')) {
            const droppedContent = firstChild.querySelector('li').innerHTML;
            const existingFile = Array.from(document.querySelectorAll('.desktop_files')).find(item => item.innerHTML.includes(droppedContent));
            if (!existingFile) {
                const newDesktopFile = document.createElement('div');
                const originalClasses = firstChild.className.split(' ').filter(cn => cn !== 'window_files').join(' ');
                newDesktopFile.className = `desktop_files ${originalClasses}`;
                newDesktopFile.draggable = true;
                newDesktopFile.innerHTML = `
                    <li class="desktop_files_text editable">${droppedContent}</li>
                    <span class="dli-folder"></span>
                `;
                document.querySelector('.files_inline').appendChild(newDesktopFile);
                newDesktopFile.addEventListener('contextmenu', e => {
                    e.preventDefault();
                    newDesktopFile.remove();
                    updateLocalStorage();
                });
                saveToLocalStorage_deskfiles(newDesktopFile);
            }
        }
    });
    function saveToLocalStorage_deskfiles(newFile) {
        const savedFiles = JSON.parse(localStorage.getItem('desktopFiles')) || [];
        savedFiles.push({ className: newFile.className, innerHTML: newFile.innerHTML });
        localStorage.setItem('desktopFiles', JSON.stringify(savedFiles));
        loadFromLocalStorage();
        filesposition();
        fileicon();
    }
    function updateLocalStorage() {
        const savedFiles = JSON.parse(localStorage.getItem('desktopFiles')) || [];
        const updatedFiles = Array.from(document.querySelectorAll('.files_inline .desktop_files')).filter(file =>
            savedFiles.some(savedFile => savedFile.innerHTML === file.innerHTML)
        ).map(file => ({
            className: file.className,
            innerHTML: file.innerHTML
        }));
        localStorage.setItem('desktopFiles', JSON.stringify(updatedFiles));
    }
    const savedData = localStorage.getItem('desktopFiles');
    if (savedData) {
        const dataToLoad = JSON.parse(savedData);
        dataToLoad.forEach(fileData => {
            const newFile = document.createElement('div');
            newFile.className = fileData.className;
            newFile.draggable = true;
            newFile.innerHTML = fileData.innerHTML;
            document.querySelector('.files_inline').appendChild(newFile);

            newFile.addEventListener('contextmenu', e => {
                e.preventDefault();
                newFile.remove();
                updateLocalStorage();
            });
        });
    }
    filesposition();
    loadFromLocalStorage();
    fileicon();

    function desktopfile_resize() {
        files_inline.style.height = localStorage.getItem('taskbar_autohide') ? "" : `${window.innerHeight - taskbar.clientHeight}px`;
    }
    desktopfile_resize();
    taskbar && new ResizeObserver(desktopfile_resize).observe(taskbar);

    function fileicon() {
        document.querySelectorAll('.window_file_icon, .dli-folder').forEach(icon => !icon.querySelector('span') && icon.appendChild(document.createElement('span')));
    }

};