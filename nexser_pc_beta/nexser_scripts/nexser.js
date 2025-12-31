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

    const setup = document.querySelector('.setup');

    const nex_files = document.getElementById('files');
    const logoff = document.getElementsByClassName('logoff');
    const restart = document.getElementsByClassName('restart');
    const allwindows = document.querySelectorAll('.child_windows');

    const welcome_menu = document.querySelector('.welcome_menu');

    const nexser_guidebook_menu = document.querySelector('.nexser_guidebook_menu');
    const guidebook_window_menu = document.querySelector('.guidebook_window_menu');
    const guidebook_file_menu = document.querySelector('.guidebook_file_menu');
    const guidebook_taskbar_menu = document.querySelector('.guidebook_taskbar_menu');

    const start_menu = document.getElementById('start_menu');
    const taskbar = document.getElementById('taskbar');
    const toolbar = document.getElementById('toolbar');
    const battery_menu = document.querySelector('.battery_menu');
    const battery_child = document.querySelector('.battery_child');
    const background_text = document.getElementById('background_text');
    const background_text2 = document.getElementById('background_text2');

    const screen_saver_group = document.getElementById('screen_saver_group');

    const screen_prompt = document.getElementById('prompt');
    const prompt_text_value = document.querySelector('.focus');
    const nexser = document.getElementById('nexser');
    const nexser_program = document.getElementById('nexser_program');
    const desktop = document.getElementById('desktop');
    const pattern_backgrounds = document.getElementsByClassName('pattern_backgrounds')[0];
    const files_inline = document.querySelector('.files_inline');
    let fileElements = document.querySelectorAll('.window_files');
    const z_index = document.querySelector('.z_index');
    const startbtn = document.getElementById('startbtn');

    const mini_desktop = document.querySelector('.mini_desktop');

    const desktop_version_text = document.querySelector('.desktop_version_text');

    // soft_windows
    const password_menu = document.querySelector('.password_menu');
    const pass_signin_menu = document.querySelector('.pass_signin_menu');
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
    const mydocument_menu = document.querySelector('.mydocument_menu');
    const restriction_menu = document.querySelector('.restriction_menu');
    const location_menu = document.querySelector('.location_menu');
    const editor_menu = document.querySelector('.editor_menu');
    const url_droplist_menu = document.querySelector('.url_droplist_menu');
    const systemresouce_menu = document.querySelector('.systemresouce_menu');
    const trash_menu = document.querySelector('.trash_menu');

    const nexser_search_menu = document.querySelector('.nexser_search_menu');

    const tetris_mneu = document.querySelector('.tetris_menu');
    const bom_menu = document.querySelector('.bom_menu');
    const othello_menu = document.querySelector('.othello_menu');
    const memory_game_menu = document.querySelector('.memory_game_menu');
    const add_program_menu = document.querySelector('.add_program_menu');

    const titles = document.querySelectorAll('.title');
    const navys = document.querySelectorAll('.navy');

    const window_selectors = ['.big', '.w_left', '.w_right'];

    const windowanimation = 0.28;

    let isAnimating = false;
    let isAnimating_minimization = false;

    // app
    // note
    const note_area = document.querySelector('.note_area');
    // cpubench
    const cpumenu1 = document.querySelector('.cpumenu_1');
    const cpumenu2 = document.querySelector('.cpumenu_2');
    // editor
    const editor_2 = document.getElementById('editor_2');

    document.addEventListener('click', () => {
        const gameNone = localStorage.getItem('game_none');
        const workDeny = localStorage.getItem('work_deny');
        [
            { sel: '.game_window', msg: "制限されているため、起動できませんでした", cond: gameNone || workDeny },
            { sel: '.work_no', msg: "仕事用でセットアップされているため、起動できませんでした", cond: workDeny }
        ].forEach(({ sel, msg, cond }) => {
            if (cond) {
                document.querySelectorAll(`${sel}:not(.active)`).forEach(e => {
                    noticewindow_create("error", msg);
                    e.classList.add('active');
                });
            }
        });
        bigwindow_resize();
        document.querySelector('.local_memory2').innerHTML = `&emsp;${(calculateLocalStorageSize() / 1024).toFixed(2)}KB&emsp;`;
        removePopups();
        setTimeout(() => { firstLoad = false }, 500);
    });

    if (localStorage.getItem('work_deny')) {
        document.querySelector('.edition_text').textContent = "Work Edition";
    }

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

    let startX, startY, isDrawing = false, rectangle;
    nex_files.addEventListener('mousedown', e => {
        if (desktop.style.display !== "block") return;
        isDrawing = true;
        [startX, startY] = [e.clientX, e.clientY];
        rectangle = document.createElement('div');
        rectangle.className = 'rectangle';
        rectangle.style.cssText = `left:${startX}px;top:${startY}px;`;
        document.body.appendChild(rectangle);
    });
    document.addEventListener('mousemove', e => {
        if (!isDrawing || desktop.style.display !== "block") return;
        const [x, y] = [e.clientX, e.clientY];
        Object.assign(rectangle.style, {
            width: `${Math.abs(x - startX)}px`,
            height: `${Math.abs(y - startY)}px`,
            left: `${Math.min(startX, x)}px`,
            top: `${Math.min(startY, y)}px`
        });
    });
    document.addEventListener('mouseup', () => {
        isDrawing = false;
        rectangle_remove();
    });

    document.addEventListener('mousedown', e => {
        fileborder_reset();
        const isIn = s => document.querySelector(s)?.contains(e.target);
        const isInSome = s => Array.from(document.querySelectorAll(s)).some(el => el.contains(e.target));

        if (!Array.from(fileElements).some(el => el.contains(e.target))) {
            document.querySelectorAll('.window_files').forEach(win => win.classList.remove('file_border2'));
            const fb = document.querySelector('.file_border');
            if (fb) {
                fb.classList.add('file_border2');
                fb.classList.remove('file_border');
            }
        }

        if (!startbtn.contains(e.target) && !start_menu.contains(e.target)) startmenu_close();
        if (!isInSome('.windowtool_parent, .windowtool_child')) document.querySelectorAll('.windowtool_child').forEach(el => el.style.display = 'none');

        const batteryMenu = document.querySelector('.battery_menu');
        const batteryChild = document.querySelector('.battery_child');
        if (!isIn('.battery_child') && !isIn('.battery_menu')) {
            if (batteryMenu) batteryMenu.style.display = 'none';
            if (batteryChild) batteryChild.classList.remove('pressed');
        }

        const screenLight = document.querySelector('.screen_light_range_child');
        const litButton = document.querySelector('.lit_button');
        if (!isIn('.lit_button') && !isIn('.screen_light_range_child')) {
            if (screenLight) screenLight.style.display = 'none';
            if (litButton) litButton.classList.remove('pressed');
        }

        if (!isInSome('.child_windows, .child')) {
            title_navyremove();
            titlecolor_set();
        }

        if (!isInSome('.task_buttons')) {
            document.querySelectorAll('.task_buttons').forEach(btn => btn.classList.remove('tsk_pressed', 'pressed'));
            updateButtonClasses();
        }
    });

    function lightchild() {
        const screenLightRangeChild = document.querySelector('.screen_light_range_child');
        screenLightRangeChild.style.display = (screenLightRangeChild.style.display === "flex") ? "none" : "flex";
    }

    const tasks = [
        load_nexser,
        setColor,
        taskbar_none,
        screen_backtextload,
        notecolor_update,
        notetextsize_change,
        taskgroup_load,
        titlecolor_set,
        back_pattern_set,
        nexser_savedata_load
    ];
    (async () => {
        for (const task of tasks) {
            await new Promise(r => requestAnimationFrame(() => (task(), r())));
        }
        console.log('tasks completed');
    })();

    function nexser_savedata_load() {
        const t = localStorage.getItem('taskbar_height');
        taskbar.style.height = `${t}px`;
        const taskHeight = taskbar.clientHeight;

        [
            { key: 'driver_color', selector: '.installbutton_2', text: 'uninstall' },
            { key: 'driver_sound', selector: '.installbutton_1', text: 'uninstall' }
        ].forEach(({ key, selector, text }) => {
            if (localStorage.getItem(key)) {
                document.querySelector(selector).textContent = text;
            }
        });

        if (localStorage.getItem('backtext')) {
            background_text.textContent = localStorage.getItem('backtext_data');
            background_text.classList.add('block');
            document.querySelector('.backtext_mode').textContent = "ON";
        }

        if (localStorage.getItem('noteData')) {
            load();
            document.querySelector('.note_title').textContent = "notepad(save keep)";
        }
        if (localStorage.getItem('textdropdata')) load2();
        if (localStorage.getItem('objectiveData') || localStorage.getItem('objectiveTitleData')) objective_load();

        const startupElements = [
            'startup_note', 'startup_computer', 'startup_color', 'startup_screen',
            'startup_htmlviewer_edit', 'startup_guidebook', 'startup_objective', 'startup_calendar'
        ];
        startupElements.forEach(key => {
            if (localStorage.getItem(key)) {
                const el = document.querySelector(`.${key}`);
                if (el) el.textContent = "ON";
            }
        });

        if (localStorage.getItem('prompt_data2')) document.querySelector('.startup_speed').textContent = "HIGH";
        if (localStorage.getItem('auto_startup')) document.querySelector('.auto_startup').textContent = "ON";
        if (localStorage.getItem('driver_sound')) document.querySelector('.startup_sound').textContent = "UN INSTALL";

        if (localStorage.getItem('startup_versiontext')) {
            document.querySelector('.startup_versiontext').textContent = "ON";
            desktop_version_text.style.display = "block";
        } else {
            desktop_version_text.style.display = "none";
        }

        ['startup_1', 'startup_2', 'startup_3', 'startup_4', 'startup_5', 'startup_6'].forEach(key => {
            const el = document.querySelector(`.${key}`);
            if (el) el.textContent = localStorage.getItem(key) ? 'set!' : 'no set';
        });
        ['shutdown_1', 'shutdown_2', 'shutdown_3', 'shutdown_4', 'shutdown_5', 'shutdown_6'].forEach(key => {
            const el = document.querySelector(`.${key}`);
            if (el) el.textContent = localStorage.getItem(key) ? 'set!' : 'no set';
        });

        const styleMap = {
            'note_text_bold': { prop: 'fontWeight', val: 'bold' },
            'note_text_oblique': { prop: 'fontStyle', val: 'oblique' },
            'note_text_underline': { prop: 'textDecoration', val: 'underline' }
        };
        Object.entries(styleMap).forEach(([key, { prop, val }]) => {
            if (localStorage.getItem(key)) {
                note_area.style[prop] = val;
                const testNote = document.querySelector('.test_notetext');
                if (testNote) testNote.style[prop] = val;
            }
        });

        if (localStorage.getItem('window_invisible')) document.querySelector('.windowmode').textContent = "invisible";
        if (localStorage.getItem('window_afterimage_false')) document.querySelector('.windowafter').textContent = "OFF";

        const bodyEl = document.body;
        const fonts = {
            font_default: 'serif',
            font_sans_serif: 'sans-serif',
            font_cursive: 'cursive',
            font_fantasy: 'fantasy',
            font_monospace: 'monospace'
        };
        bodyEl.style.fontFamily = Object.entries(fonts).find(([key]) => localStorage.getItem(key))?.[1] || bodyEl.style.fontFamily;

        if (localStorage.getItem('windowfile_1')) {
            window_file_list_change();
        } else if (localStorage.getItem('windowfile_3')) {
            window_file_list_change2();
        } else if (localStorage.getItem('windowfile_2')) {
            window_file_list_reset();
        } else {
            document.querySelectorAll('.windowfile_time').forEach(el => el.style.display = "none");
        }

        const actions = {
            'clock_button': () => document.querySelector('.time').style.display = "none",
            'battery_button': () => document.querySelector('.task_battery').style.display = "none",
            'taskbar_zindex_0': () => taskbar.style.zIndex = "0",
            'taskbar_leftbtn': () => document.querySelector('.first_taskbar_buttons').style.display = "none",
            'taskbarbutton_autoadjustment': () => document.querySelector('.task_icons').classList.add('flex')
        };
        Object.entries(actions).forEach(([key, fn]) => {
            if (localStorage.getItem(key)) {
                const el = document.querySelector(`.${key}`);
                if (el) el.textContent = "on";
                fn();
            }
        });

        if (localStorage.getItem('taskbar_position_button')) {
            document.querySelector('.taskbar_position_button').textContent = "bottom";
            taskbar.style.top = "0px";
            document.getElementById('task_resizer').style.display = "none";
            document.getElementById('task_resizer2').style.display = "block";
        } else {
            document.getElementById('task_resizer').style.display = "block";
            document.getElementById('task_resizer2').style.display = "none";
        }

        if (localStorage.getItem('taskbar_position_button')) {
            if (localStorage.getItem('data_taskbar_none')) {
                files_inline.style.marginTop = "auto";
                files_inline.style.bottom = "";
            } else {
                files_inline.style.marginTop = `${t}px`;
                files_inline.style.bottom = "auto";
            }
            if (localStorage.getItem('taskbar_autohide')) {
                files_inline.style.marginTop = "40px";
            }
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
            toolbar.style.top = `${t}px`;
        } else {
            toolbar.style.bottom = `${t}px`;
            desktop_version_text.style.bottom = `${taskHeight}px`;
        }

        if (localStorage.getItem('toolbar_on')) toolbar.style.display = "block";

        if (localStorage.getItem('display_old')) old_screen();
        if (localStorage.getItem('list_shadow_on')) list_shadow();
        if (localStorage.getItem('file_none')) files_inline.style.display = "none";

        const fontSizeMap = {
            'backtext_small': '15px',
            'backtext_medium': '30px',
            'backtext_large': '45px'
        };
        Object.entries(fontSizeMap).forEach(([key, size]) => {
            if (localStorage.getItem(key)) {
                background_text.style.fontSize = size;
                background_text2.style.fontSize = size;
            }
        });

        const digitalClock = document.getElementsByClassName('digital_clock_area')[0];
        const analogClock = document.getElementsByClassName('analog_clock_area')[0];
        if (localStorage.getItem('clockdata_analog')) {
            if (digitalClock) digitalClock.style.display = "none";
            if (analogClock) analogClock.style.display = "block";
        } else {
            if (digitalClock) digitalClock.style.display = "flex";
            if (analogClock) analogClock.style.display = "none";
        }

        const saverOnEl = document.getElementsByClassName('saver_on')[0];
        const saverTextEl = document.getElementsByClassName('screensaver_text')[0];
        if (localStorage.getItem('saver_time')) {
            saverOnEl?.classList.remove('pointer_none');
            if (saverTextEl) saverTextEl.textContent = localStorage.getItem('saver_time');
        } else {
            localStorage.removeItem('saver_on');
            localStorage.removeItem('saver_time');
        }
        if (localStorage.getItem('saver_on')) {
            document.querySelector('.saver_mode').textContent = "ON";
        }
        [2, 3].forEach(num => {
            if (localStorage.getItem(`saver${num}`)) set_saver(num);
        });
        if (localStorage.getItem('taskbar_autohide')) {
            taskbar.style.bottom = "-35px";
            if (localStorage.getItem('taskbar_height')) {
                const t2 = t - 5;
                taskbar.style.bottom = `-${t2}px`;
            }
        }
        editorContent_load();
    }

    const dateClockElements = document.querySelectorAll('.date_clock');
    const dateDayElement = document.querySelector('.date_day');
    function taskgroup_load() {
        drawClock();
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        let hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = String(hours % 12 || 12).padStart(2, '0');

        dateDayElement.textContent = `${year}/${month}/${day}`;
        dateClockElements.forEach(el => {
            el.textContent = `\u00A0${hours}:${minutes}:${seconds}\u00A0${ampm}\u00A0`;
        });
        updateCurrentTime();
    }
    setInterval(taskgroup_load, 1000);

    function load_nexser() {
        localStorage.removeItem('no_shutdown');
        const hasPromptData = localStorage.getItem('prompt_data');
        const hasPromptData3 = localStorage.getItem('prompt_data3');
        const isAutoStartup = localStorage.getItem('auto_startup');
        const isDeskPrompt = localStorage.getItem('deskprompt');
        if (localStorage.getItem('password') && !localStorage.getItem('login') && !hasPromptData3 && hasPromptData) {
            toggleDisplay(false, false, true, false);
            pass_signin_menu.classList.remove('active');
            document.getElementById('pass_form').focus();
        } else if (!localStorage.getItem('start_nexser') && hasPromptData) {
            start_check();
        } else if (hasPromptData && localStorage.getItem('start_nexser')) {
            toggleDisplay(false, false, true, true);
            welcome_menu.classList.add('active');
        } else if (hasPromptData3) {
            toggleDisplay(false, true, false, false);
            nex.style.cursor = 'crosshair';
        } else {
            toggleDisplay(true, false, false, false);
            prompt_text_value.focus();
            command_help();
        }
        if (isDeskPrompt) {
            nexser_program.style.display = "block";
            desktop.style.display = "none";
            pattern_backgrounds.style.display = "none";
            nex.style.cursor = 'crosshair';
        } else {
            pattern_backgrounds.style.display = "block";
        }
        if (screen_prompt.style.display === "block" && isAutoStartup) {
            handleCommand("nexser");
            handleCommand("open");
        }
        sessionStorage.removeItem('start_camera');
        localStorage.removeItem('note_texts');
    }
    const toggleDisplay = (p, pr, n, d) => {
        [screen_prompt, nexser_program, nexser, desktop].forEach((el, i) => {
            el.style.display = [p, pr, n, d][i] ? "block" : "none";
        });
    };
    screen_prompt.onclick = () => prompt_text_value.focus();

    function startmenu_close() {
        start_menu.style.display = "none";
        startbtn.classList.remove('pressed');
    }
    startbtn.addEventListener('mousedown', function () {
        const isOpen = start_menu.style.display === "block";
        if (isOpen) startmenu_close();
        else {
            start_menu.style.display = "block";
            this.classList.add('pressed');
            updateStartMenuPosition();
        }
        fileborder_reset();
    });

    battery_child.addEventListener('click', () => {
        battery_menu.style.display = battery_menu.style.display === "block" ? "none" : "block";
    });

    function addUnifiedButtonListeners(button) {
        if (button.classList.contains('listener-added')) return;

        if (button.classList.contains('button2')) {
            const togglePressed = (pressed) => () => button.classList[pressed ? 'add' : 'remove']('pressed');
            button.addEventListener('mousedown', togglePressed(true));
            button.addEventListener('mouseleave', togglePressed(false));
            button.addEventListener('mouseup', togglePressed(false));
        } else if (button.classList.contains('button')) {
            button.addEventListener('click', () => button.classList.toggle('pressed'));
        }

        button.classList.add('listener-added');
    }

    const unifiedObserver = new MutationObserver((mutations) => {
        for (let mi = 0; mi < mutations.length; mi++) {
            const added = mutations[mi].addedNodes;
            for (let ai = 0; ai < added.length; ai++) {
                const node = added[ai];
                if (node.nodeType !== Node.ELEMENT_NODE) continue;
                if (node.nodeType === 1 && (node.classList.contains('button') || node.classList.contains('button2'))) {
                    addUnifiedButtonListeners(node);
                }
                const descendants = node.querySelectorAll ? node.querySelectorAll('.button, .button2') : null;
                if (descendants && descendants.length) {
                    for (let di = 0; di < descendants.length; di++) {
                        addUnifiedButtonListeners(descendants[di]);
                    }
                }
            }
        }
    });
    unifiedObserver.observe(document.body, { childList: true, subtree: true });

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
        document.querySelectorAll('video').forEach(video => video.pause());
        startProgress(20);
        desktop.style.display = "none";
        pattern_backgrounds.style.display = "none";
        welcome_menu.classList.add('active');
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
                    command_help();
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
            } else {
                toolbar.style.bottom = `${task}px`;
            }
        }, 500);
    }

    const toggleSetting = ({ selector, key, onText, offText }) => {
        const element = document.querySelector(selector);
        element.addEventListener('click', () => {
            const isSet = localStorage.getItem(key);
            element.textContent = isSet ? offText : onText;
            isSet ? localStorage.removeItem(key) : localStorage.setItem(key, 'true');
        });
    };
    const settings = [
        ['.startup_sound', 'driver_sound', 'UN INSTALL', 'INSTALL'],
        ['.startup_note', 'startup_note', 'ON', 'OFF'],
        ['.startup_computer', 'startup_computer', 'ON', 'OFF'],
        ['.startup_color', 'startup_color', 'ON', 'OFF'],
        ['.startup_screen', 'startup_screen', 'ON', 'OFF'],
        ['.startup_htmlviewer_edit', 'startup_htmlviewer_edit', 'ON', 'OFF'],
        ['.startup_guidebook', 'startup_guidebook', 'ON', 'OFF'],
        ['.startup_objective', 'startup_objective', 'ON', 'OFF'],
        ['.startup_calendar', 'startup_calendar', 'ON', 'OFF'],
        ['.startup_speed', 'prompt_data2', 'HIGH', 'LOW'],
        ['.auto_startup', 'auto_startup', 'ON', 'OFF']
    ];
    settings.forEach(([selector, key, onText, offText]) =>
        toggleSetting({ selector, key, onText, offText })
    );

    document.querySelector('.startup_versiontext').addEventListener('click', () => {
        const startupVersionText = document.querySelector('.startup_versiontext');
        const isSet = localStorage.getItem('startup_versiontext');
        startupVersionText.textContent = isSet ? "OFF" : "ON";
        desktop_version_text.style.display = isSet ? "none" : "block";
        isSet ? localStorage.removeItem('startup_versiontext') : localStorage.setItem('startup_versiontext', 'true');
    });

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
            pass_signin_menu.classList.remove('active')
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
            pass_signin_menu.classList.add('active')
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
        document.querySelector('.nexser_boot_menu').style.display = "none";
        localStorage.setItem('prompt_data', true);
        nexser.style.backgroundColor = "";
        ['#code_html', '#code_script', '#code_script2'].forEach(id => document.querySelector(id).style.display = "none");
        prompt_text_value.blur();
        window_none();
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
            nexser_shutdown()
        })
    })

    function nexser_shutdown() {
        nex.style.cursor = 'progress';
        startmenu_close();
        setTimeout(() => {
            if (sessionStorage.getItem('start_camera')) {
                noticewindow_create("error", "カメラが実行されているため、ログオフできません!");
            } else if (localStorage.getItem('no_shutdown')) {
                noticewindow_create("error", "welcomeウィンドウが起動するまでログオフできません!");
            } else if (gets === gets2 && gets3 === 0) {
                window_none();
                sound_stop();
                shutdown_sound();
                localStorage.removeItem('login');
                nex.style.cursor = 'none';
                desktop.style.display = "none";
                if (!localStorage.getItem('noteData')) {
                    note_clear();
                }
                setTimeout(() => {
                    document.querySelectorAll('.testwindow2').forEach(testwindow2 => testwindow2.remove());
                    document.querySelectorAll('.error_windows').forEach(errorwindow => errorwindow.remove());
                    window_none();
                    window_reset();
                    localStorage.removeItem('prompt_data');
                    fileborder_reset();
                    setTimeout(() => {
                        document.querySelectorAll('.button').forEach(button => button.classList.remove('pressed'));
                        nexser.style.display = "none";
                        screen_prompt.style.display = "block";
                        prompt_text_value.focus();
                        nex.style.cursor = '';
                        command_help();
                    }, 500);
                }, 1000);
            } else {
                noticewindow_create("warning", "実行されているウィンドウがあります! ログオフしますか?", null, nexser_shutdown_load)
                nex.style.cursor = '';
            }
        }, 100);
    }

    function nexser_shutdown_load() {
        window_none();
        nexser_shutdown();
    }

    Array.from(restart).forEach(element => {
        element.addEventListener('click', event => {
            nexser_restart()
        })
    })

    function nexser_restart() {
        nex.style.cursor = 'progress';
        startmenu_close();
        setTimeout(() => {
            if (sessionStorage.getItem('start_camera')) {
                noticewindow_create("error", "カメラが実行されているため、再起動はできません!");
                camera_menu.classList.remove('active');
            } else if (localStorage.getItem('no_shutdown')) {
                noticewindow_create("error", "welcomeウィンドウが起動するまで再起動はできません!");
            } else if (gets === gets2 && gets3 === 0) {
                sound_stop();
                shutdown_sound();
                localStorage.removeItem('login');
                nex.style.cursor = 'none';
                desktop.style.display = "none";
                if (!localStorage.getItem('noteData')) {
                    note_clear();
                }
                setTimeout(() => {
                    window_none();
                    window_reset();
                    fileborder_reset();
                    document.querySelector('.focus2').textContent = "";
                    setTimeout(() => {
                        document.querySelectorAll('.button').forEach(button => button.classList.remove('pressed'));
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
                    }
                } else {
                    taskbar.style.display = "block";
                    toolbar.style.top = "";
                    toolbar.style.left = "";
                    toolbar.style.bottom = "40px";
                    toolbar.style.bottom = `${t}px`;
                    const task = taskbar.clientHeight;
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
                        welcome();
                        localStorage.removeItem('no_shutdown');
                    };
                }, 5000);
                noticewindow_create("Nexser", "読み込んでいます...");
                document.querySelectorAll('.error_windows').forEach(errorwin => errorwin.remove());
            }, 2000);
        }
    }

    function nexser_on() {
        localStorage.setItem('start_nexser', true);
        welcome_menu.classList.add('active');
        setTimeout(() => {
            [desktop, nex_files, taskbar].forEach(el => el.style.display = "block");
            const task = taskbar.clientHeight;
            Object.assign(toolbar.style, { top: "", left: "", bottom: "40px" });
            [desktop_version_text].forEach(el => el.style.bottom = `${task}px`);
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
        windowpos_fix(welcome_menu)
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
        if (!localStorage.getItem('deskprompt') && localStorage.getItem('prompt_data')) {
            welcome_menu.classList.remove('active');
            welcome_animation();
        };
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
    }

    function nexser_signout() {
        if (localStorage.getItem('password') && gets === gets2) {
            welcome_menu.classList.add('active');
            localStorage.removeItem('login');
            desktop.style.display = "none";
            window_none();
            window_reset();
            pass_signin_menu.classList.remove('active');
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
        } else {
            localStorage.setItem('driver_color', true);
            document.querySelector('.installbutton_2').textContent = "uninstall";
        }
        titlecolor_remove();
        titlecolor_set();
    })

    function windowmode_reset() {
        localStorage.removeItem('window_invisible');
        document.querySelector('.windowmode').textContent = "default"
    }
    const modes = { window_invisible: "invisible" };
    Object.entries(modes).forEach(([id, textContent]) =>
        document.getElementById(id).addEventListener('click', () => {
            localStorage.getItem(id) ? localStorage.removeItem(id) : (windowmode_reset(), localStorage.setItem(id, true));
            document.querySelector('.windowmode').textContent = localStorage.getItem(id) ? textContent : "default";
        })
    );

    document.getElementById('backtext_on').addEventListener('click', function () {
        localStorage.setItem('backtext', true);
        background_text.textContent = localStorage.getItem('backtext_data');
        background_text.classList.add('block');
        document.querySelector('.backtext_mode').textContent = "ON";
    })
    document.getElementById('backtext_off').addEventListener('click', function () {
        localStorage.removeItem('backtext');
        background_text.classList.remove('block');
        document.querySelector('.backtext_mode').textContent = "OFF";
    })

    const sizes = {
        backtext_small: "15px",
        backtext_medium: "30px",
        backtext_large: "45px"
    };
    Object.entries(sizes).forEach(([key, size]) => {
        document.querySelector(`.${key}`).addEventListener('click', () => {
            backtextSize_clear();
            localStorage.setItem(key, true);
            background_text.style.fontSize = size;
            background_text2.style.fontSize = size;
        });
    });
    function backtextSize_clear() {
        background_text.style.fontSize = "";
        background_text2.style.fontSize = "";
        localStorage.removeItem('backtext_small');
        localStorage.removeItem('backtext_medium');
        localStorage.removeItem('backtext_large');
    }

    function window_reset() {
        const resetStyles = {
            left: "",
            top: "",
            height: "",
            width: "",
            transition: ""
        };
        document.querySelector('.bigminbtn').style.visibility = "visible";
        document.querySelector('.minimization_button').style.visibility = "visible";
        allwindows.forEach(w => {
            Object.assign(w.style, resetStyles);
            w.classList.remove('w_left', 'w_right', 'child_windows_invisible', 'minimization');
        });
        windowposition_reset();
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
        const removeTargets = ['.task_buttons', '.testwindow2', '.error_windows']
            .flatMap(sel => [...document.querySelectorAll(sel)]);
        removeTargets.forEach(el => el.remove());
        const resetStyles = {
            zIndex: "0",
            background: "",
            border: "",
            boxShadow: "",
            mixBlendMode: "",
            opacity: "",
            right: "",
            transition: ""
        };
        document.querySelectorAll('.child_windows').forEach(w => {
            w.classList.add('active');
            w.classList.remove('big', 'w_right', 'w_left');
            Object.assign(w.style, resetStyles);
            for (const c of w.children) c.style.display = "";
            const b = w.children[1]?.children[2];
            if (b) {
                b.dataset.isMaximized = "false";
                b.classList.replace("minbtn", "bigminbtn");
            }
        });
        largestZIndex = 0;
        originalDragData = null;
        isSnapped = false;
        windowtool();
        windowposition_reset();
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
        setTimeout(() => {
            window.location = '';
        }, 3000);
    }

    function colordata_clear() {
        body.style.color = "";
        nexser.style.backgroundColor = "";
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
        if (localStorage.getItem('taskbar_height') && localStorage.getItem('taskbar_autohide')) {
            const t2 = t - 5;
            taskbar.style.bottom = `-${t2}px`;
        }
        if (localStorage.getItem('taskbar_height') && localStorage.getItem('taskbar_position_button')) {
            files_inline.style.marginTop = "40px";
        }
        desktopfile_resize()
    }
    function taskbar_reset() {
        localStorage.removeItem('taskbar_autohide');
        taskbar.style.bottom = "";
        desktopfile_resize()
    }

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

    document.querySelectorAll('.start_menu').forEach(child_startmenu => {
        child_startmenu.addEventListener('mouseleave', () => {
            if (localStorage.getItem('taskbar_height') && localStorage.getItem('taskbar_autohide')) {
                const t = localStorage.getItem('taskbar_height');
                const t2 = t - 5;
                taskbar.style.bottom = `-${t2}px`;
            } else if (localStorage.getItem('taskbar_autohide')) {
                taskbar.style.bottom = "-35px";
            }
        });
        child_startmenu.addEventListener('mouseover', () => {
            taskbar.style.bottom = "";
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

    const output = document.getElementById('output');
    const command_input = document.getElementById('command_input');
    const prefix = document.getElementById('prefix');
    const commandHistory = [];
    command_input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            const command = command_input.value.trim();
            output.innerText += `${prefix.innerText}${command}\n`;
            commandHistory.push(command);
            handleCommand(command);
            command_input.value = '';
        }
    });
    function handleCommand(command) {
        document.querySelector('.code_group').style.display = "none";
        const args = command.split(' ');
        const cmd = args[0].toLowerCase();
        const args2 = args.slice(1);
        switch (cmd) {
            case 'help':
                output.innerText += `利用可能なコマンド:\n
          - help: このヘルプメッセージを表示\n
          - clear: 画面をクリア\n
          - date: 現在の日付と時刻を表示\n
          - time: 現在の時刻を表示\n
          - echo [message]: メッセージを出力\n
          - calc [expression]: 簡単な計算を実行 (例: calc 2+2)\n
          - setup: プロンプトが<nexser>の場合にセットアップを実行\n
          - reset: プロンプトを<user>に戻します\n
          - info: メモリ、バッテリ、ローカルストレージの情報を表示\n
          - whoami: 現在のプロンプト名を表示\n
          - random: 1～100までのランダムな数字を生成\n
          - reverse [message]: 入力文字列を反転\n
          - history: コマンド履歴を表示\n
          - nexser: プロンプトを<nexser>に変更します\n
          - version: nexser のバージョンを表示します\n
          - reload: ページを再読み込みします\n`;
                break;
            case 'help_storage':
                output.innerText += `利用可能なコマンド:\n
              - storage: プロンプトを<storage>に変更します\n
              - list - 全てのキーと値を表示\n
              - get [キー名] - 指定されたキーの値を取得\n
              - set [キー名] [値] - キーと値を設定\n
              - remove [キー名] - 指定されたキーを削除\n
              - maxsize 保存されている容量の一番大きいkey名のみを検出します\n`;
                break;
            case 'clear':
                output.innerText = '';
                break;
            case 'date':
                const now = new Date();
                output.innerText += `現在の日時: ${now.toLocaleString()}\n`;
                break;
            case 'time':
                const timeNow = new Date();
                output.innerText += `現在の時刻: ${timeNow.toTimeString().split(' ')[0]}\n`;
                break;
            case 'echo':
                const message = args.slice(1).join(' ');
                output.innerText += `${message}\n`;
                break;
            case 'calc':
                try {
                    const expression = args.slice(1).join('');
                    const result = eval(expression);
                    output.innerText += `計算結果: ${result}\n`;
                } catch (e) {
                    output.innerText += `エラー: 無効な計算式です。\n`;
                }
                break;
            case 'setup':
                if (!localStorage.getItem('setup')) {
                    if (prefix.innerText === '<nexser>') {
                        output.innerText += `setup connect...\n`;
                        command_input.blur();
                        setTimeout(() => {
                            nexser_setup();
                            document.querySelector('#output').style.display = "none";
                        }, 500);
                    } else {
                        output.innerText += `現在のプロンプトでは'setup'は利用できません。\n`;
                    }
                } else {
                    output.innerText += `'setup'は利用できません。\n`;
                }
                break;
            case 'info':
                const deviceMemory = navigator.deviceMemory || '不明';
                output.innerText += `デバイスメモリ: ${deviceMemory} GB\n`;
                if (navigator.getBattery) {
                    navigator.getBattery().then(battery => {
                        output.innerText += `バッテリ情報:\n  - 充電中: ${battery.charging ? 'はい' : 'いいえ'}\n  - 充電時間: ${battery.chargingTime} 秒\n  - 放電時間: ${battery.dischargingTime} 秒\n`;
                    });
                } else {
                    output.innerText += `バッテリ情報はブラウザでサポートされていません。\n`;
                }
                const localStorageKeys = localStorage.length;
                output.innerText += `ローカルストレージのキー数: ${localStorageKeys}\n`;
                break;
            case 'reset':
                prefix.innerText = '<user>';
                output.innerText += `プロンプトが<user>に戻されました。\n`;
                break;
            case 'whoami':
                output.innerText += `現在のプロンプト: ${prefix.innerText}\n`;
                break;
            case 'random':
                const randomNumber = Math.floor(Math.random() * 100) + 1;
                output.innerText += `ランダムな数字: ${randomNumber}\n`;
                break;
            case 'reverse':
                const reverseMessage = args.slice(1).join(' ').split('').reverse().join('');
                output.innerText += `反転結果: ${reverseMessage}\n`;
                break;
            case 'version':
                output.innerText += `nexser beta 1.9\n`;
                break;
            case 'reload':
                output.innerText = '';
                window.location = '';
                break;
            case 'open':
                if (localStorage.getItem('setup') && prefix.innerText === '<nexser>') {
                    output.innerText += `starting　nexser...\n`;
                    nexser_boot_check();
                } else {
                    output.innerText += `現在のプロンプトでは'${command}'は利用できません。\n`;
                }
                break;
            case 'program':
                if (localStorage.getItem('setup') && prefix.innerText === '<nexser>') {
                    output.innerText += `nexser program open...\n`;
                    localStorage.setItem('prompt_data3', true);
                    nexser_program_open();
                } else {
                    output.innerText += `現在のプロンプトでは'${command}'は利用できません。\n`;
                }
                break;
            case 'history':
                if (commandHistory.length === 0) {
                    output.innerText += `コマンド履歴はまだありません。\n`;
                } else {
                    output.innerText += `コマンド履歴:\n`;
                    commandHistory.forEach((cmd, index) => {
                        output.innerText += `  ${index + 1}: ${cmd}\n`;
                    });
                }
                break;
            case "list":
                if (prefix.innerText === '<storage>') {
                    if (localStorage.length === 0) {
                        output.innerText += `ローカルストレージは空です。\n`
                    } else {
                        output.innerText += `ローカルストレージの内容:\n`;
                        for (let i = 0; i < localStorage.length; i++) {
                            const key = localStorage.key(i);
                            const value = localStorage.getItem(key);
                            output.innerText += `${key}: ${value}\n`;
                        }
                    }
                } else {
                    output.innerText += `現在のプロンプトでは'${command}'は利用できません。\n`;
                }
                break;
            case "get":
                if (prefix.innerText === '<storage>') {
                    if (args2.length < 1) {
                        output.innerText += `キー名を指定してください。\n`;
                    } else {
                        const value = localStorage.getItem(args2[0]);
                        if (value === null) {
                            output.innerText += `キー '${args2[0]}' は存在しません。\n`;
                        } else {
                            output.innerText += `${args2[0]}: ${value}\n`;
                        }
                    }
                } else {
                    output.innerText += `現在のプロンプトでは'${command}'は利用できません。\n`;
                }
                break;
            case "set":
                if (prefix.innerText === '<storage>') {
                    if (args2.length < 2) {
                        output.innerText += `キー名と値を指定してください。\n`;
                    } else {
                        const key = args2[0];
                        const value = args2.slice(1).join(" ");
                        localStorage.setItem(key, value);
                        output.innerText += `キー '${key}' に値 '${value}' を設定しました。\n`;
                    }
                } else {
                    output.innerText += `現在のプロンプトでは'${command}'は利用できません。\n`;
                }
                break;
            case "remove":
                if (prefix.innerText === '<storage>') {
                    if (args2.length < 1) {
                        output.innerText += `キー名を指定してください。\n`;
                    } else {
                        localStorage.removeItem(args2[0]);
                        output.innerText += `キー '${args2[0]}' を削除しました。\n`;
                    }
                } else {
                    output.innerText += `現在のプロンプトでは'${command}'は利用できません。\n`;
                }
                break;
            case "maxsize":
                if (prefix.innerText === '<storage>') {
                    findLargestValue();
                } else {
                    output.innerText += `現在のプロンプトでは'${command}'は利用できません。\n`;
                }
                break;
            case 'nexser/code/html':
                document.querySelector('.code_group').style.display = "block";
                document.querySelector('#code_html').style.display = "block";
                document.querySelector('#code_script').style.display = "none";
                document.querySelector('#code_script2').style.display = "none";
                break;
            case 'nexser/code/script':
                document.querySelector('.code_group').style.display = "block";
                document.querySelector('#code_html').style.display = "none";
                document.querySelector('#code_script').style.display = "block";
                document.querySelector('#code_script2').style.display = "none";
                break;
            case 'nexser/code/script2':
                document.querySelector('.code_group').style.display = "block";
                document.querySelector('#code_html').style.display = "none";
                document.querySelector('#code_script').style.display = "none";
                document.querySelector('#code_script2').style.display = "block";
                break;
            default:
                if (command === 'nexser') {
                    prefix.innerText = '<nexser>';
                    output.innerText += `プロンプトが<nexser>に変更されました。\n`;
                } else if (command === 'storage') {
                    prefix.innerText = '<storage>';
                    output.innerText += `プロンプトが<storage>に変更されました。\n`;
                } else {
                    output.innerText += `'${command}' は認識されないコマンドです。'help' を入力して使用可能なコマンドを確認してください。\n`;
                }
        }
        output.scrollTop = output.scrollHeight;
    }
    function command_help() {
        if (localStorage.getItem('setup')) {
            output.innerText += `以下のコマンドを入力して Enter を押してください:\n`
            output.innerText += `- nexser 起動方法 -\n`
            output.innerText += `- 1. nexser を入力 -\n`
            output.innerText += `- 2. open を入力して実行してください -\n`;
        } else {
            output.innerText += `以下のコマンドを入力して Enter を押してください:\n
            - setup 方法 -\n
            - 1. nexser を入力 -\n
            - 2. setup を入力して実行してください -\n`;
        }
        output.innerText += `- その他コマンドは help を入力してください -\n(storage系は help_storage )\n`;
        if (localStorage.getItem('auto_startup')) {
            output.innerText += `nexser の自動起動は有効になっています\n`;
        }
        new IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting) entry.target.scrollIntoView({ block: 'center' });
        }, { threshold: 1.0 }).observe(command_input);
    }

    function findLargestValue() {
        if (localStorage.length === 0) {
            output.innerText += `ローカルストレージは空です。\n`;
            return;
        }
        let largestValueKey = null;
        let largestValueSize = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            const size = new Blob([value]).size;
            if (size > largestValueSize) {
                largestValueSize = size;
                largestValueKey = key;
            }
        }
        if (largestValueKey) {
            output.innerText += `最大容量の値:\n`;
            output.innerText += `Key: ${largestValueKey}\n`;
            output.innerText += `Size: ${largestValueSize} bytes\n`;
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
                    nexser.style.background = a;
                    localStorage.setItem('BKCOLOR', a);
                    resetWallpaper()
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
                noticewindow_create("warning", "全てのデータが削除されます。実行しますか?", "nexser", allStorage_clear);
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
                windowclose(window_prompt)
                break;

            case 'nexser/restart':
                window_none()
                nexser_restart()
                break;

            case 'windows95/open':
                processUrl('https://moti5768.github.io/moti.world/windows95.html', 'windows95');
                break;
            case 'windows2000/open':
                processUrl('https://moti5768.github.io/moti.world/windows%202000/windows2000_beta.html', 'windows2000');
                break;
            case 'windowsystem/open':
                processUrl('https://moti5768.github.io/moti.world/new%20OS/WindowSystem.html', 'windowsystem');
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

    ['.close_button'].forEach(cls => {
        document.querySelectorAll(cls).forEach(btn => {
            btn.addEventListener('click', () => {
                windowclose(btn);
            });
        });
    });

    function windowclose(cls) {
        const el = cls.closest('.child_windows');
        if (el) {
            el.classList.add('active');
        }
    }

    const originalSize = new WeakMap();
    const originalPosition = new WeakMap();
    function toggleMaximize(button) {
        const win = button.closest('.child_windows');
        if (!win) return;
        if (!button.dataset.isMaximized) button.dataset.isMaximized = 'false';
        const isMax = button.dataset.isMaximized === 'true';
        window_animation(win);
        if (isMax) {
            const size = originalSize.get(win);
            const pos = originalPosition.get(win);
            if (size && pos) {
                Object.assign(win.style, {
                    width: size.width,
                    height: size.height,
                    top: pos.top,
                    left: pos.left,
                });
            }
            win.classList.remove('w_right', 'w_left', 'big');
            button.classList.replace('minbtn', 'bigminbtn');
            button.dataset.isMaximized = 'false';
            setTimeout(() => {
                win.scrollTop = 0;
                win.scrollLeft = 0;
            }, windowanimation * 1000);
        } else {
            originalSize.set(win, { width: win.style.width, height: win.style.height });
            originalPosition.set(win, { top: win.style.top, left: win.style.left });
            win.classList.remove('minimization', 'w_right', 'w_left');
            win.style.left = "0";
            windowtop(win);
            win.classList.add('big');
            button.classList.replace('bigminbtn', 'minbtn');
            button.dataset.isMaximized = 'true';
        }
    }
    function addMinbigScreenButtonListeners(button) {
        if (button.dataset.listenerAdded) return;
        button.addEventListener('click', () => toggleMaximize(button));
        button.dataset.listenerAdded = 'true';
    }
    const minbigBtnObserver = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            if (mutation.type !== 'childList') return;
            mutation.addedNodes.forEach(node => {
                if (node.nodeType !== 1) return;
                if (node.matches('.bigminbtn')) addMinbigScreenButtonListeners(node);
                node.querySelectorAll('.bigminbtn').forEach(addMinbigScreenButtonListeners);
            });
        });
    });
    document.querySelectorAll('.bigminbtn').forEach(addMinbigScreenButtonListeners);
    minbigBtnObserver.observe(document.body, { childList: true, subtree: true });


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
            if (!animation.classList.contains('overzindex')) {
                animation.style.pointerEvents = "";
                animation.style.zIndex = largestZIndex++;
            }
        };
        if (localStorage.getItem('window_animation')) {
            animation.style.transition = `${windowanimation}s cubic-bezier(0,0,1,1)`;
            [...animation.children].forEach(c => c.style.display = 'none');
            document.querySelectorAll('.title, .title_buttons')
                .forEach(el => el.style.display = "flex");
            setTimeout(() => {
                animation.style.transition = "none";
                animation.style.transform = "none";
                animation.getBoundingClientRect();
                animation.style.transition = "";
                [...animation.children].forEach(c => c.style.display = '');
                windowtool();
                adjustHeight();
                isAnimating_minimization = false;
            }, windowanimation * 1000);
        } else {
            isAnimating_minimization = false;
            adjustHeight();
        }
    }

    document.querySelectorAll('.window_half_big').forEach(btn => {
        btn.addEventListener('click', e => {
            const win = btn.closest('.child_windows');
            win.classList.remove('w_right', 'w_left', 'big');
            const rect = btn.getBoundingClientRect();
            Object.assign(btn.style, {
                left: `${e.pageX - (e.clientX - rect.left)}px`,
                top: `${e.pageY - (e.clientY - rect.top)}px`
            });
            Object.assign(win.style, { height: "50%", width: "50%" });
            const child2 = win.children[1]?.children[2];
            if (child2) {
                child2.dataset.isMaximized = 'false';
                child2.classList.replace('minbtn', 'bigminbtn');
            }
            window_animation(win);
        });
    });

    document.querySelectorAll('.windowsize_reset').forEach(btn => {
        btn.addEventListener('click', e => {
            const win = btn.closest('.child_windows');
            Object.assign(win.style, {
                height: "", width: "",
                right: win.classList.contains('w_right') ? "0" : ""
            });
            win.classList.remove('big', 'w_left', 'w_right');
            const child2 = win.children[1]?.children[2];
            if (child2) {
                child2.dataset.isMaximized = 'false';
                child2.classList.replace('minbtn', 'bigminbtn');
            }
            window_animation(win);
            const rect = btn.getBoundingClientRect();
            Object.assign(btn.style, {
                left: `${e.pageX - (e.clientX - rect.left)}px`,
                top: `${e.pageY - (e.clientY - rect.top)}px`
            });
        });
    });

    if (!window._parentListListenersAdded) {
        document.addEventListener('mouseover', e => {
            const p = e.target.closest('.parent_list');
            if (p) {
                document.querySelectorAll('.windowtool_child').forEach(el => el.style.display = "none");
                const c = p.lastElementChild;
                if (c) c.style.display = "flex";
            }
        });
        const addLeave = el => {
            if (!el._leave) {
                el.addEventListener('mouseleave', () => {
                    document.querySelectorAll('.child_list').forEach(c => c.style.display = "none");
                });
                el._leave = true;
            }
        };
        document.querySelectorAll('.parent_list').forEach(addLeave);
        new MutationObserver(muts => {
            muts.forEach(m => {
                m.addedNodes.forEach(n => {
                    if (n.nodeType !== 1) return;
                    if (n.classList?.contains('parent_list')) addLeave(n);
                    else n.querySelectorAll?.('.parent_list')?.forEach(addLeave);
                });
            });
        }).observe(document.body, { childList: true, subtree: true });

        window._parentListListenersAdded = true;
    }

    document.querySelectorAll('.allwindow_toolbar').forEach(toolbar => {
        toolbar.addEventListener('click', () => {
            const isShown = [...document.querySelectorAll('.window_tool')].some(w => w.style.display === "block");
            document.querySelectorAll('.window_tool').forEach(w => w.style.display = isShown ? "none" : "block");
            localStorage[isShown ? 'removeItem' : 'setItem']('allwindow_toolbar', true);
            document.querySelectorAll('.window_inline_side').forEach(side => side.style.top = isShown ? "" : "31px");
            clock_menu.style.height = isShown ? "355px" : "";
        });
    });

    function windowtool() {
        const showTools = localStorage.getItem('allwindow_toolbar');
        document.querySelectorAll('.window_tool').forEach(tool => tool.style.display = showTools ? "block" : "none");
        document.querySelectorAll('.window_inline_side').forEach(side => side.style.top = showTools ? "31px" : "");
        clock_menu.style.height = showTools ? "" : "355px";
    }
    windowtool();

    const digital_clock_area = document.getElementsByClassName('digital_clock_area')[0];
    const analog_clock_area = document.getElementsByClassName('analog_clock_area')[0];
    ['clockdata_analog', 'clockdata_digital'].forEach(className => {
        document.querySelector(`.${className}`).addEventListener('click', () => {
            const isAnalog = className === 'clockdata_analog';
            if (isAnalog) {
                localStorage.setItem('clockdata_analog', true);
                digital_clock_area.style.display = "none";
                analog_clock_area.style.display = "block";
            } else {
                localStorage.removeItem('clockdata_analog');
                digital_clock_area.style.display = "flex";
                analog_clock_area.style.display = "none";
            }
        });
    });

    document.querySelectorAll('.window_inline_menus').forEach(container => {
        const parents = container.querySelectorAll('.window_inline_menus_parent');
        parents.forEach(parent => {
            parent.addEventListener('mousedown', () => {
                container.querySelectorAll('.select').forEach(el => el.classList.remove('select'));
                parents.forEach(p => p.lastElementChild.style.display = "none");
                parent.classList.add('select');
                parent.lastElementChild.style.display = "block";
            });
        });
    });
    document.querySelectorAll('.menuselect').forEach(child => {
        const secondChild = child.children[1];
        if (secondChild) secondChild.style.display = "block";
        child.classList.add('select');
    });

    document.querySelectorAll('.child_windows:not(.overzindex), .child').forEach(win => {
        const p = win.closest('.child_windows');
        const setZ = e => {
            p.scrollTop = 0;
            p.scrollLeft = 0;
            p.style.zIndex = largestZIndex++;
        };
        win.addEventListener('mousedown', () => setZ());
        win.querySelectorAll('iframe').forEach(iframe => {
            iframe.addEventListener('load', () => {
                try {
                    const d = iframe.contentDocument || iframe.contentWindow.document;
                    [d, d.body].forEach(el => el && el.addEventListener('mousedown', setZ));
                } catch { }
            });
        });
    });

    document.querySelectorAll('.window_prompt, .child').forEach(el =>
        el.addEventListener('mouseup', () =>
            document.querySelector('.focus2').focus()
        )
    );

    const title_navyremove = () => document.querySelectorAll('.navy').forEach(e => e.classList.remove('navy'));

    function nexser_search() {
        const input = document.getElementById('myInput');
        const filter = input.value.toUpperCase();
        const ul = document.getElementById("myUL");
        const liElements = ul.getElementsByTagName('li');
        Array.from(liElements).forEach(li => {
            const text = li.textContent.toUpperCase();
            li.style.display = text.includes(filter) ? "" : "none";
        });
    }

    function search_clear() {
        document.getElementById('myInput').value = "";
        nexser_search();
    }

    function cpubench_open() {
        if (!cpu_bench_menu.classList.contains('active') || cpumenu1.style.display === "block") {
            setTimeout(() => {
                cpumenu1.style.display = "none";
                document.querySelector('.cpubuttons').style.display = "none";
                document.querySelector('.cputitle').style.display = "none";
                cpumenu2.style.display = "block";
                document.querySelector('.cpubuttons').style.display = "flex";
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
        const els = Array.from(document.querySelectorAll(selector));
        let front = null, maxZ = -Infinity;
        const btns = document.querySelectorAll('.task_buttons');
        btns.forEach(b => b.remove());
        els.forEach(el => {
            const win = el.closest('.child_windows');
            const z = parseInt(getComputedStyle(el).zIndex) || 0;
            if (z > maxZ) maxZ = z, front = win;
            const { width, height } = getComputedStyle(el);
            Object.assign(el.style, { width, height });
        });
        if (front) {
            front.firstElementChild.classList.add(newClassName);
            startmenu_close();
            if (localStorage.getItem('titlebtn_left')) addLeftClass();
            if (savedStyle) windowtitle_style(savedStyle);
        }
        return front;
    }

    function titlebtn_left() {
        if (localStorage.getItem('titlebtn_left')) {
            localStorage.removeItem('titlebtn_left');
            const elements = document.querySelectorAll('.title, .title_buttons');
            elements.forEach(element => {
                element.classList.remove('left');
            });
        } else {
            localStorage.setItem('titlebtn_left', true);
            addLeftClass();
        }
    }

    function zindexwindow_addnavy() {
        title_navyremove();
        assignClassToFrontmostElement('.child_windows:not(.active):not(.minimization)', 'navy');
        test_windows_button();
        titlecolor_set();
        debounced_allwindow_resize();
        document.querySelectorAll('.button, .button2').forEach(addUnifiedButtonListeners);
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
    const backgroundImageChildren = backgroundImageParent.getElementsByClassName('nexser_background_image');
    let resizeScheduled = false;
    const resizeBackgroundImage = () => {
        if (resizeScheduled) return;
        resizeScheduled = true;
        requestAnimationFrame(() => {
            const w = backgroundImageParent.clientWidth + 'px';
            const h = backgroundImageParent.clientHeight + 'px';
            for (let i = 0; i < backgroundImageChildren.length; i++) {
                backgroundImageChildren[i].style.cssText = `width:${w};height:${h}`;
            }
            resizeScheduled = false;
        });
    };
    resizeBackgroundImage();
    window.addEventListener('resize', resizeBackgroundImage);

    function addDragButtonListeners(button) {
        if (button.dataset.listenerAdded) return;
        button.dataset.listenerAdded = true;
        const dragwindow = button.closest('.child_windows');
        let overlay, windowMoveElement, draggingElement;
        let x, y, originalDragData = null;
        let isSnapped = false;
        button.addEventListener('mousedown', () => {
            dragwindow.classList.add('drag');
        });

        function createOverlay() {
            overlay = document.createElement('div');
            Object.assign(overlay.style, {
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 9999
            });
            document.body.appendChild(overlay);
        }

        function mdown(e) {
            e.preventDefault();
            const event = e.type === 'mousedown' ? e : e.changedTouches[0];
            x = event.pageX - dragwindow.offsetLeft;
            y = event.pageY - dragwindow.offsetTop;
            createOverlay();
            if (e.target.classList.contains('drag_button') && !localStorage.getItem('window_afterimage_false')) {
                draggingElement = e.target.closest('.child_windows');
                const rect = draggingElement.getBoundingClientRect();
                offsetX = e.clientX - rect.left;
                offsetY = e.clientY - rect.top;
            }
            document.body.addEventListener('mousemove', mmove, { passive: false });
            document.body.addEventListener('touchmove', mmove, { passive: false });
            document.addEventListener('mouseup', mup);
            document.addEventListener('touchend', mup);
        }

        function mmove(e) {
            const drag = document.getElementsByClassName('drag')[0];
            if (!drag) return;
            const event = e.type === 'mousemove' ? e : e.changedTouches[0];
            const screenWidth = window.innerWidth;
            const screenHeight = window.innerHeight;
            if (!windowMoveElement && !localStorage.getItem('window_afterimage_false')) {
                windowMoveElement = document.createElement('div');
                windowMoveElement.className = 'window_move' + (drag.classList.contains('resize') ? ' resize' : '');
                Object.assign(windowMoveElement.style, {
                    width: drag.offsetWidth + 'px',
                    height: drag.offsetHeight + 'px',
                    position: 'absolute',
                    zIndex: largestZIndex++
                });
                applyStyles(windowMoveElement);
                document.body.appendChild(windowMoveElement);
            }
            if (!isSnapped && !localStorage.getItem('window_afterimage_false')) {
                windowMoveElement.style.top = (event.pageY - y) + 'px';
                windowMoveElement.style.left = (event.pageX - x) + 'px';
            } else if (!isSnapped) {
                drag.style.top = (event.pageY - y) + 'px';
                drag.style.left = (event.pageX - x) + 'px';
            }
            const haha = windowMoveElement || drag;
            if (localStorage.getItem('window_invisible') && localStorage.getItem('window_afterimage_false')) {
                haha.style.opacity = '0.5';
            }
            if (event.clientX <= 0 && !isSnapped) {
                saveOriginalData(haha);
                snapWindow(haha, 'left', screenWidth, screenHeight);
                isSnapped = true;
            } else if (event.clientX >= screenWidth - 1 && !isSnapped) {
                saveOriginalData(haha);
                snapWindow(haha, 'right', screenWidth, screenHeight);
                isSnapped = true;
            } else if (isSnapped && event.clientX > 0 && event.clientX < screenWidth - 1) {
                setTimeout(() => {
                    restoreOriginalData(haha);
                    haha.classList.remove('w_left', 'w_right');
                    if (draggingElement) draggingElement.classList.remove('w_left', 'w_right');
                    isSnapped = false;
                }, 0);
            }
            taskbar.addEventListener('mouseover', function () {
                document.body.removeEventListener("mousemove", mmove, false);
                document.body.removeEventListener("touchmove", mmove, false);
            });
        }

        function saveOriginalData(drag) {
            if (!originalDragData) {
                originalDragData = {
                    top: drag.style.top,
                    left: drag.style.left,
                    width: drag.style.width,
                    height: drag.style.height
                };
            }
        }

        function snapWindow(drag, position, screenWidth, screenHeight) {
            if (!drag.classList.contains('resize')) return;
            if (position === 'left') {
                Object.assign(drag.style, {
                    width: screenWidth / 2 + 'px',
                    height: screenHeight - taskbar.clientHeight + 'px',
                    top: '0px',
                    left: '0px'
                });
                drag.classList.add('w_left');
                draggingElement?.classList.add('w_left');
            } else if (position === 'right') {
                Object.assign(drag.style, {
                    width: screenWidth / 2 + 'px',
                    height: screenHeight - taskbar.clientHeight + 'px',
                    top: '0px',
                    left: screenWidth / 2 + 'px'
                });
                drag.classList.add('w_right');
                draggingElement?.classList.add('w_right');
            }
            if (localStorage.getItem('taskbar_autohide')) {
                drag.style.height = screenHeight + 'px';
            }
        }

        function restoreOriginalData(drag) {
            if (!originalDragData) return;
            Object.assign(drag.style, originalDragData);
            originalDragData = null;
        }

        function mup() {
            const drag = document.getElementsByClassName('drag')[0];
            if (drag) {
                drag.style.opacity = '';
                drag.classList.remove('drag');
            }
            document.body.removeChild(overlay);
            overlay = null;
            document.body.removeEventListener('mousemove', mmove);
            document.body.removeEventListener('touchmove', mmove);
            document.removeEventListener('mouseup', mup);
            document.removeEventListener('touchend', mup);
            if (windowMoveElement && draggingElement && !localStorage.getItem('window_afterimage_false')) {
                const rect = windowMoveElement.getBoundingClientRect();
                draggingElement.style.top = rect.top + 'px';
                draggingElement.style.left = rect.left + 'px';
                draggingElement.style.width = windowMoveElement.clientWidth + 'px';
                draggingElement.style.height = windowMoveElement.clientHeight + 'px';
                document.body.removeChild(windowMoveElement);
                windowMoveElement = null;
                draggingElement = null;
            }
        }
        button.addEventListener('mousedown', mdown, { passive: false });
        button.addEventListener('touchstart', mdown, { passive: false });
    }

    function observeNewElements3() {
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType !== 1) return;
                        if (node.matches('.drag_button')) addDragButtonListeners(node);
                        if (node.matches('.child_windows')) node.querySelectorAll('.drag_button').forEach(addDragButtonListeners);
                    });
                }
            });
        });
        observer.observe(document.getElementById('desktop'), {
            childList: true,
            subtree: true
        });
    }
    document.querySelectorAll('.drag_button').forEach(addDragButtonListeners);
    observeNewElements3();

    function windowtop(win) {
        const t = taskbar.clientHeight;
        if (localStorage.getItem('data_taskbar_none')) {
            win.style.top = "0";
        } else if (localStorage.getItem('taskbar_position_button')) {
            win.style.top = "40px";
            win.style.top = `${t}px`;
        } else if (win.classList.contains('w_right')) {
            win.style.top = "0";
            win.style.left = "";
        } else {
            win.style.top = "0";
        }
    }

    function applyStyles(element) {
        Object.assign(element.style, {
            background: "rgba(0, 0, 0, 0)",
            border: "solid 2px #fff",
            boxShadow: "none",
            mixBlendMode: "difference"
        });
    }

    let savedStyle = localStorage.getItem("currentStyle");
    function windowtitle_style(style) {
        document.querySelectorAll('.title').forEach(title => {
            title.style.fontStyle = style || "";
        });
        if (typeof style === "string" && style.trim()) {
            localStorage.setItem("currentStyle", style);
            savedStyle = style;
        } else {
            localStorage.removeItem("currentStyle");
            savedStyle = null;
        }
    }

    function check(a, b) {
        const r1 = a.getBoundingClientRect(), r2 = b.getBoundingClientRect();
        return !(r1.top > r2.bottom || r1.right < r2.left || r1.bottom < r2.top || r1.left > r2.right);
    }
    const elm1 = document.getElementById('taskbar');
    const elm2 = document.getElementById('toolbar');
    const taskHeight = () => taskbar.clientHeight;
    const taskSetting = () => localStorage.getItem('taskbar_position_button');
    document.querySelectorAll('.drag_button2').forEach(drag => {
        const target = drag.closest('#toolbar');
        let x = 0, y = 0;
        const getEvent = e => e.type.startsWith('mouse') ? e : e.changedTouches[0];
        const move = e => {
            const ev = getEvent(e);
            requestAnimationFrame(() => {
                target.style.left = `${ev.pageX - x}px`;
                target.style.top = `${ev.pageY - y}px`;
            });
        };
        const up = () => {
            ['mousemove', 'touchmove', 'mouseup', 'touchend', 'mouseleave'].forEach(t =>
                document.removeEventListener(t, move)
            );
            document.body.removeEventListener('mouseleave', up);
            if (check(taskbar, toolbar)) {
                toolbar.style.top = taskSetting() ? `${taskHeight()}px` : '';
                toolbar.style.bottom = taskSetting() ? '' : `${taskHeight()}px`;
            }
        };
        const down = e => {
            const ev = getEvent(e);
            x = ev.pageX - target.offsetLeft;
            y = ev.pageY - target.offsetTop;
            ['mousemove', 'touchmove'].forEach(t => document.addEventListener(t, move, { passive: false }));
            ['mouseup', 'touchend', 'mouseleave'].forEach(t => document.addEventListener(t, up, { passive: false }));
            document.body.addEventListener('mouseleave', up, { passive: false });
        };
        drag.addEventListener('mousedown', down, { passive: false });
        drag.addEventListener('touchstart', down, { passive: false });
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
    const DEFAULT_COLOR = "";
    const DEFAULT_BKCOLOR = "";
    function setColor() {
        if (localStorage.getItem('driver_color')) {
            const color = localStorage.getItem(KEY_COLOR) || DEFAULT_COLOR;
            const bkcolor = localStorage.getItem(KEY_BKCOLOR) || DEFAULT_BKCOLOR;
            body.style.color = color;
            const isLight = ["white", "whitesmoke"].includes(bkcolor);
            nexser.style.backgroundColor = bkcolor;
            mini_desktop.style.backgroundColor = bkcolor;
            [background_text, background_text2].forEach(el => el.style.color = isLight ? "black" : "");
            Array.from(document.getElementsByClassName('desktop_files')).forEach(el => {
                el.firstElementChild.style.color = isLight ? "black" : "";
            });
        }
    }
    function setStorage(type) {
        if (localStorage.getItem('driver_color')) {
            const bkcolor = type === "manual" ? document.getElementById("bkcolor").value : document.getElementById("select_backcolor").value;
            const color = type === "manual" ? document.getElementById("color").value : document.getElementById("select_textcolor").value;
            localStorage.setItem(KEY_BKCOLOR, bkcolor);
            localStorage.setItem(KEY_COLOR, color);
            setColor();
        } else {
            noticewindow_create("error", "カラードライバーがインストールされていません!");
        }
    }
    document.getElementById("changeBtn").addEventListener("click", () => {
        setStorage("manual");
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
        ['titlebar_red', 'titlebar_blue', 'titlebar_green', 'titlebar_yellow', 'titlebar_orange', 'titlebar_pink', 'titlebar_purple', 'titlebar_black', 'titlebar_teal', 'titlebar_new', 'titlebar_new2'].forEach(item => localStorage.removeItem(item));
    }

    ['red', 'blue', 'green', 'yellow', 'orange', 'pink', 'purple', 'black', 'teal', 'new', 'new2'].forEach(color => {
        document.querySelector(`.titlebar_${color}`).addEventListener('click', () => {
            localStorage.setItem(`titlebar_${color}`, `titlebar_${color}`);
        });
    });

    function titlecolor_set() {
        if (!localStorage.getItem('driver_color')) return;
        const c = {
            titlebar_red: ["#440000", "red"],
            titlebar_blue: ["#000044", "blue"],
            titlebar_green: ["#004400", "green"],
            titlebar_yellow: ["#FFFFAA", "yellow"],
            titlebar_orange: ["#FFAD90", "orange"],
            titlebar_pink: ["#FF00FF", "pink"],
            titlebar_purple: ["#5507FF", "purple"],
            titlebar_black: ["#555555", "black"],
            titlebar_teal: ["#483D8B", "teal"],
            titlebar_new: ["linear-gradient(to right, #5b5b5b, #C0C0C0)", "linear-gradient(to right, #02175e, #A3C1E2)"],
            titlebar_new2: ["linear-gradient(to right, #5b5b5b, #C0C0C0)", "linear-gradient(to right, black, blue)"]
        };
        const t = document.querySelectorAll('.title'), n = document.querySelectorAll('.navy');
        for (const k in c) {
            if (localStorage.getItem(k)) {
                const [bg, navy] = c[k];
                t.forEach(e => e.style.background = bg);
                n.forEach(e => e.style.background = navy);
                break;
            }
        }
    }

    document.querySelectorAll('.wallpaper_allremove_btn').forEach(wallpaper_allremove_btn => {
        wallpaper_allremove_btn.addEventListener('click', () => {
            resetWallpaper();
        });
    });
    document.querySelectorAll('.pattern_btn').forEach(color_btn => {
        color_btn.addEventListener('click', () => {
            back_pattern_remove();
            resetWallpaper();
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
    for (let i = 1; i <= 9; i++) {
        document.querySelector(`.back_pattern_${i}`)?.addEventListener('click', () => {
            setBackPattern(`back_pattern_${i}`);
        });
    }
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
            var elems = document.querySelectorAll(queryselectorname + ":not(.overzindex)"), len = elems.length;
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

    function indexover(windowElement) {
        windowElement.classList.add('overzindex');
        const wz2 = document.querySelector(".overzindex");
        if (wz2) {
            wz2.style.zIndex = "999999";
        }
        setTimeout(() => {
            windowElement.classList.remove('overzindex');
        }, windowanimation * 1000);
    }

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

    const now = new Date();
    const ampm = now.getHours() < 12 ? 'AM' : 'PM';
    const output_d = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}/${now.getHours() % 12 || 12}:${now.getMinutes().toString().padStart(2, '0')}${ampm}`;
    document.getElementById('lastaccess_day').textContent = output_d;

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
        if (!note_pad.classList.contains('active') && localStorage.getItem('noteData') && !localStorage.getItem('note_texts')) {
            note_pad.classList.add('active');
        } else if (localStorage.getItem('note_texts')) {
            noticewindow_create("warning", "編集中です。メモ帳を終了しますか?(内容は破棄されます)", "notepad", note_clear);
        } else {
            note_pad.classList.add('active');
        }
    })

    function note_clear() {
        document.note_form.note_area.value = "";
        resetShowLength();
        localStorage.removeItem('note_texts');
        document.querySelector('.note_title').textContent = "notepad";
        note_pad.classList.add('active');
    }

    document.querySelector('.objective_close').addEventListener('click', function () {
        if (!objective_menu.classList.contains('active') && localStorage.getItem('objectiveData') && localStorage.getItem('objectiveTitleData') && (!localStorage.getItem('objective_area'))) {
            objective_menu.classList.add('active');
            localStorage.removeItem('objective_area');
        } else if (localStorage.getItem('objective_area')) {
            noticewindow_create("warning", "タイトル と 内容を保存してから閉じてください", "&nbsp;objective sheet");
        } else if (!localStorage.getItem('objectiveData') && !localStorage.getItem('objectiveTitleData') && (!localStorage.getItem('objective_area'))) {
            document.getElementsByClassName('objective_title_area')[0].value = "";
            document.getElementsByClassName('objective_area')[0].value = "";
            objective_menu.classList.add('active');
            localStorage.removeItem('objective_area');
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
            camera_menu.classList.add('active');
        } else if (sessionStorage.getItem('start_camera')) {
            noticewindow_create("error", "カメラが実行されているため、ウィンドウが閉じれません!");
        }
    })

    function error_windows_close(e) {
        document.querySelector('.background_black')?.remove();
        e.target.closest('.child_windows')?.remove();
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

    const dr = document.querySelector('#drop');
    dr.addEventListener('dragover', e => e.preventDefault(), supportsPassive ? { passive: true } : false);
    dr.addEventListener('drop', e => {
        e.preventDefault();
        localStorage.getItem('textdropdata')
            ? noticewindow_create("error", "テキストが保存されているため、ドラッグした文字をドロップできません!")
            : e.target.textContent += e.dataTransfer.getData('text');
    });

    let calc_result = document.getElementById("result");
    const child_graph = document.querySelector(".child_graph");
    function edit(calc_elem) {
        calc_result.value = calc_result.value + calc_elem.value;
    }
    function calc() {
        calc_result.value = new Function("return " + calc_result.value)();
        child_graph.style.height = new Function("return " + calc_result.value)() / 100 + '%';
        child_graph.style.background = "lime";
        if (calc_result.value > 10000) {
            child_graph.style.height = "100%";
            child_graph.style.background = "red";
        }
        if (calc_result.value == 10000) {
            child_graph.style.background = "blue";
        }
        if (calc_result.value < 0) {
            child_graph.style.height = "100%";
            child_graph.style.background = "black";
        }
    }
    function calc2() {
        calc_result.value = new Function("return " + calc_result.value)();
        calc_result.value = Math.round(calc_result.value);
        calc();
    }
    function calc_clear() {
        child_graph.style.height = "0%";
        child_graph.style.background = "";
        calc_result.value = "";
    }
    function calc_oneremove() {
        const result = calc_result.value.slice(0, -1);
        if (!result) return calc_clear(), calc_result.value = "";
        try {
            calc_result.value = Math.round(new Function("return " + result)()) || "";
        } catch {
            calc_result.value = "";
        }
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

    function filettext_backcolor() {
        var isOff = localStorage.getItem('filettext_backcolor_off');
        var background = isOff ? "rgba(0, 0, 0, 0)" : "";
        Array.from(document.getElementsByClassName('desktop_files_text')).forEach(element => {
            element.style.background = background;
        });
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
        if (localStorage.getItem('taskbar_position_button')) {
            const t = localStorage.getItem('taskbar_height');
            localStorage.removeItem('taskbar_position_button');
            document.querySelector('.taskbar_position_button').textContent = "top";
            taskbar.style.top = "";
            battery_menu.style.top = "auto";
            battery_menu.style.bottom = "";
            files_inline.style.marginTop = "auto";
            files_inline.style.bottom = "";
            document.getElementById('task_resizer').style.display = "block";
            document.getElementById('task_resizer2').style.display = "none";
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
            document.querySelector('.taskbar_position_button').textContent = "bottom";
            taskbar.style.top = "0px";
            battery_menu.style.top = "35px";
            battery_menu.style.bottom = "auto";
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
            document.getElementById('task_resizer').style.display = "none";
            document.getElementById('task_resizer2').style.display = "block";
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
        document.querySelectorAll('.desktop_files').forEach(df => {
            const child = df.firstElementChild;
            if (child) child.classList.remove('file_select');
        });
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
        if (sessionStorage.getItem('start_camera')) {
            sessionStorage.removeItem('start_camera');
            const tracks = document.getElementById('v').srcObject.getTracks();
            tracks.forEach(track => {
                track.stop();
            });
            document.getElementById('v').srcObject = null;
        }
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

    let isStopped = false;
    function cpubench() {
        const canvas = document.getElementById('benchmarkCanvas');
        const ctx = canvas.getContext('2d');
        const numRectangles = 10000, batchSize = 10;
        let i = 0, startTime;
        const drawBatch = () => {
            if (isStopped) return;
            if (i === 0) {
                startTime = performance.now();
                document.querySelector('.cpurun_btn').classList.add('pointer_none');
                document.querySelector('.cpu_run_text').textContent = "描画中...";
            }
            for (let j = 0; j < batchSize && i < numRectangles; j++, i++) {
                ctx.fillStyle = `rgb(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255})`;
                ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 50, 50);
            }
            if (i < numRectangles) {
                requestAnimationFrame(drawBatch);
            } else {
                document.querySelector('.cpu_run_text').textContent =
                    `四角形を${numRectangles}個描画するのにかかった時間: ${Math.floor((performance.now() - startTime) / 1000)}秒`;
                document.querySelector('.cpurun_btn').classList.remove('pointer_none');
                document.querySelector('.cpurun_btn_clear').classList.remove('pointer_none');
            }
        };
        cpubench_clear();
        isStopped = false;
        drawBatch();
    }

    function cpubench_clear() {
        const canvas = document.getElementById('benchmarkCanvas');
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        document.querySelector('.cpu_run_text').textContent = "";
        isStopped = true;
        document.querySelector('.cpurun_btn').classList.remove('pointer_none');
        document.querySelector('.cpurun_btn_clear').classList.add('pointer_none');
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

    function startProgress(increment) {
        const bar = document.getElementById("myProgress");
        let val = 0;
        bar.style.display = "block";
        bar.value = val;
        const intervalID = setInterval(() => {
            if ((val += increment) >= 100) {
                val = 100;
                clearInterval(intervalID);
                setTimeout(() => bar.style.display = "none", 1000);
            }
            bar.value = val;
        }, 10);
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

    document.querySelectorAll('.close_button, .close_button2').forEach(close_buttons => {
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
        const r = ['大吉', '中吉', '小吉', '末吉', '凶', '大凶', '超大凶'];
        document.querySelector('.omikuji_text').textContent = r[(Math.random() * r.length) | 0] + ' です！';
    }

    function localmemory_size() {
        if (desktop.style.display !== "block") return;
        noticewindow_create("load", "容量計算中...");
        const memoryButton = document.querySelector('.local_memory_button');
        memoryButton.classList.add('pointer_none');
        const testKey = 'testStorageKey';
        const testData = new Array(1024).join('a');
        let maxSize = 0;
        try {
            for (; ; maxSize++) {
                localStorage.setItem(`${testKey}${maxSize}`, testData);
            }
        } catch (e) {
            // 容量到達
        } finally {
            for (let i = 0; i < maxSize; i++) {
                localStorage.removeItem(`${testKey}${i}`);
            }
        }
        document.querySelector('.local_memory').innerHTML = `&emsp;${maxSize}KB&emsp;`;
        localStorage.setItem('maxSize', maxSize);
        memoryButton.classList.remove('pointer_none');
        localStorage.removeItem('memoryOver');
        const loader = document.querySelector('.add_create_load_windows');
        if (loader) loader.remove();
        zindexwindow_addnavy();
        displayLocalStorageDetails();
        window.scrollTo(0, 0);
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
        const list = document.getElementById('localStorageList');
        const total = document.getElementById('totalSize');
        list.querySelectorAll('.localstorage_key').forEach(el => el.remove());
        const fragment = document.createDocumentFragment();
        let totalSize = 0;
        const keys = Object.keys(localStorage).sort();
        for (const key of keys) {
            const value = localStorage.getItem(key);
            const size = new Blob([value]).size;
            totalSize += size;
            const li = document.createElement('li');
            li.className = 'border localstorage_key';
            li.style.width = 'max-content';
            li.style.marginTop = '5px';
            li.textContent = `Keyname: ${key}, Size: ${size} Byte`;
            fragment.appendChild(li);
        }
        list.appendChild(fragment);
        total.textContent = `Total Size: ${totalSize} Byte`;
    }

    const paint_canvas = document.getElementById('paint_canvas');
    const paint_ctx = paint_canvas.getContext('2d');
    paint_ctx.fillStyle = '#ffffff';
    console.log(paint_ctx.getImageData(0, 0, 1, 1))
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
        localStorage.removeItem('eraser_color');
        document.querySelector('.draw_mode').textContent = "描き";
    });
    function startDrawing(e) {
        paint_isDrawing = true;
        const x = e.offsetX !== undefined ? e.offsetX : (e.touches?.[0]?.clientX || 0);
        const y = e.offsetY !== undefined ? e.offsetY : (e.touches?.[0]?.clientY || 0);
        [paint_lastX, paint_lastY] = [x, y];
    }
    function stopDrawing() {
        paint_isDrawing = false;
        paint_ctx.beginPath();
    }
    function paint_draw(e) {
        if (!paint_isDrawing) return;
        const x = e.offsetX !== undefined ? e.offsetX : (e.touches?.[0]?.clientX || 0);
        const y = e.offsetY !== undefined ? e.offsetY : (e.touches?.[0]?.clientY || 0);
        const drawModeElement = document.querySelector('.draw_mode');
        if (localStorage.getItem('eraser_color') === 'true') {
            paint_ctx.strokeStyle = paint_ctx.fillStyle;
            if (drawModeElement) drawModeElement.textContent = "消しゴム";
        } else {
            paint_ctx.strokeStyle = document.getElementById('paint_selectcolor').value;
            if (drawModeElement) drawModeElement.textContent = "描き";
        }
        paint_ctx.lineWidth = paint_lineWidth;
        paint_ctx.lineCap = 'round';
        paint_ctx.lineJoin = 'round';
        paint_ctx.beginPath();
        paint_ctx.moveTo(paint_lastX, paint_lastY);
        paint_ctx.lineTo(x, y);
        paint_ctx.stroke();
        [paint_lastX, paint_lastY] = [x, y];
    }
    const paintwidth = document.querySelector('.paint_width').value = "5";
    lineWidth = paintwidth;
    paint_ctx.strokeStyle = "black";
    // 線の太さの変更
    function changeLineWidth() {
        const paintwidth = Number(document.querySelector('.paint_width').value);
        if (!isNaN(paintwidth)) paint_lineWidth = paintwidth;
    }
    // 消しゴム
    function eraser() {
        var fillStyleColor = paint_ctx.fillStyle;
        if (localStorage.getItem('eraser_color')) {
            localStorage.removeItem('eraser_color');
            paint_ctx.strokeStyle = "black";
            document.querySelector('.draw_mode').textContent = "描き";
        } else {
            localStorage.setItem('eraser_color', true);
            document.querySelector('.draw_mode').textContent = "消しゴム";
        }
        strokeStyle = fillStyleColor;
    }
    if (localStorage.getItem('eraser_color') === 'true') {
        document.querySelector('.draw_mode').textContent = "消しゴム";
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

    function downloadCanvasAsPng() {
        let canvas = document.getElementById('paint_canvas');
        let link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = 'canvas.png';
        link.click();
    }
    function canvasdata_file() {
        var canvas = document.getElementById('paint_canvas');
        var dataURL = canvas.toDataURL();
        var jsonData = JSON.stringify({ image: dataURL });
        var blob = new Blob([jsonData], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = document.querySelector('.paint_filename').value + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function paintfiles(event) {
        var file = event.files[0];
        var reader = new FileReader();
        reader.onload = function (e) {
            var jsonData = e.target.result;
            var data = JSON.parse(jsonData);
            var canvas = document.getElementById('paint_canvas');
            var ctx = canvas.getContext('2d');
            var image = new Image();
            image.onload = function () {
                ctx.drawImage(image, 0, 0);
            };
            image.src = data.image;
        };
        reader.readAsText(file);
    }
    function paint_allclear() {
        paint_ctx.clearRect(0, 0, paint_canvas.width, paint_canvas.height);
        paint_ctx.fillStyle = '#ffffff';
        paint_ctx.fillRect(0, 0, paint_canvas.width, paint_canvas.height);
    }

    const wallpapers = [
        { key: 'wallpaper_95', src: 'nexser_image/Windows95_wallpaper.jpg' },
        { key: 'wallpaper_95_2', src: 'nexser_image/Windows95_wallpaper_2.png' },
        { key: 'wallpaper_xp', src: 'nexser_image/Windowsxp_wallpaper.jpg' },
        { key: 'wallpaper_space', src: 'nexser_image/space_wallpaper.png' }
    ];
    const [bgImg2, bgContainer, miniDesktop, deskimg] = [
        document.querySelector(".nexser_backgroundimage_child"),
        document.querySelector('.nexser_backgroundimage'),
        document.querySelector('.mini_desktop'),
        document.querySelector('.desk_img')
    ];
    function updateWallpaper(src = "") {
        localStorage.setItem('selectedWallpaper', src);
        if (bgImg2 && bgContainer) {
            bgImg2.src = src || "";
            bgContainer.style.display = src ? "block" : "none";
        }
        miniDesktop.innerHTML = src ? `<img src="${src}" style="width: 100%; height: 100%;">` : "";
        deskimg.innerHTML = src ? `<img src="${src}" style="width: 100%; height: 100%;">` : "";
    };
    const applySavedWallpaper = () => updateWallpaper(localStorage.getItem('selectedWallpaper') || "");
    wallpapers.forEach(({ key, src }) =>
        document.querySelector(`.${key}`)?.addEventListener('click', () => updateWallpaper(src))
    );
    wallpapers.forEach(({ key, src }) => {
        const element = document.querySelector(`.${key}`);
        if (element) {
            element.addEventListener('mouseover', () => {
                deskimg.innerHTML = src ? `<img src="${src}" style="width: 100%; height: 100%;">` : "";
            });
            element.addEventListener('mouseleave', () => {
                deskimg.innerHTML = "";
                if (localStorage.getItem('selectedWallpaper')) {
                    applySavedWallpaper();
                }
            });
        }
    });

    const resetWallpaper = () => {
        localStorage.removeItem('selectedWallpaper');
        updateWallpaper();
    };
    applySavedWallpaper();

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
        const ct = el => Array.from(el.children)
            .filter(e => e.textContent.trim())
            .reduce((u, c) => {
                const li = document.createElement("li"),
                    t = c.textContent.trim();
                li.style.cssText = "padding:4px 2px;font-family:Arial,sans-serif;cursor:default;";
                if (c.children.length) {
                    li.innerHTML = `<span class="button2" style="cursor:pointer;margin-right:5px;">►</span>${t}`;
                    const n = ct(c);
                    n.style.display = "none";
                    li.appendChild(n);
                    li.firstElementChild.onclick = e => {
                        e.stopPropagation();
                        const isHidden = n.style.display === "none";
                        n.style.display = isHidden ? "block" : "none";
                        e.target.textContent = isHidden ? "▼" : "►";
                    };
                } else {
                    li.innerHTML = `<span class="button2">${t}</span>`;
                }
                li.addEventListener("mouseenter", () => li.style.backgroundColor = "#eef");
                li.addEventListener("mouseleave", () => li.style.backgroundColor = "transparent");
                u.appendChild(li);
                return u;
            }, Object.assign(document.createElement("ul"), {
                style: "list-style:none;padding-left:20px;margin:0;"
            }));
        document.getElementById("nexser_files_output").appendChild(ct(nexser));
    }
    function nexser_files_output_remove() {
        document.getElementById('nexser_files_output').textContent = '';
    }

    function addResizers(element) {
        ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top', 'right', 'bottom', 'left'].forEach(pos => {
            element.appendChild(Object.assign(document.createElement('div'), { className: `resizer ${pos}` }));
        });
    }
    function makeResizableDivs(className) {
        const observer_resizer = new MutationObserver(mutations =>
            mutations.forEach(({ type, addedNodes }) =>
                type === 'childList' && addedNodes.forEach(node =>
                    node.nodeType === 1 && node.matches(className) && (addResizers(node), attachResizeHandlers(node))
                )
            )
        );
        document.querySelectorAll(className).forEach(element => (addResizers(element), attachResizeHandlers(element)));
        observer_resizer.observe(document.body, { childList: true, subtree: true });
    }
    function attachResizeHandlers(element) {
        const minSize = parseFloat(getComputedStyle(element).minWidth) || 20;
        const minHeight = parseFloat(getComputedStyle(element).minHeight) || 20;
        const maxSize = parseFloat(getComputedStyle(element).maxWidth) || Infinity;
        const maxHeight = parseFloat(getComputedStyle(element).maxHeight) || Infinity;
        let resizing = false, overlay, tempElement, orig = {}, largestZIndex = 1000;
        element.querySelectorAll('.resizer').forEach(resizer => {
            resizer.addEventListener('mousedown', e => {
                e.preventDefault();
                if (tempElement && localStorage.getItem('window_afterimage_false')) {
                    tempElement = null;
                }
                const rect = element.getBoundingClientRect(), styles = getComputedStyle(element);
                Object.assign(orig, {
                    w: parseFloat(styles.width), h: parseFloat(styles.height),
                    x: rect.left, y: rect.top, mx: e.pageX, my: e.pageY
                });
                resizing = true;
                if (!localStorage.getItem('window_afterimage_false')) {
                    tempElement = document.createElement('div');
                    tempElement.style.position = 'absolute';
                    tempElement.style.left = `${orig.x}px`;
                    tempElement.style.top = `${orig.y}px`;
                    tempElement.style.width = `${orig.w}px`;
                    tempElement.style.height = `${orig.h}px`;
                    tempElement.style.zIndex = `${largestZIndex++}`;
                    applyStyles(tempElement);
                    document.body.appendChild(tempElement);

                    overlay = document.createElement('div');
                    overlay.style.position = 'fixed';
                    overlay.style.top = '0';
                    overlay.style.left = '0';
                    overlay.style.width = '100%';
                    overlay.style.height = '100%';
                    overlay.style.cursor = getComputedStyle(resizer).cursor;
                    document.body.appendChild(overlay);
                    document.body.style.cursor = getComputedStyle(resizer).cursor;
                }
                const resize = e => {
                    const dx = e.pageX - orig.mx, dy = e.pageY - orig.my, target = tempElement || element;
                    if (/right/.test(resizer.className)) {
                        target.style.width = `${Math.min(Math.max(orig.w + dx, minSize), maxSize)}px`;
                    }
                    if (/left/.test(resizer.className)) {
                        const newWidth = orig.w - dx;
                        target.style.width = `${Math.min(Math.max(newWidth, minSize), maxSize)}px`;
                        if (newWidth >= minSize && newWidth <= maxSize) {
                            target.style.left = `${orig.x + dx}px`;
                        } else if (newWidth < minSize) {
                            target.style.left = `${orig.x + (orig.w - minSize)}px`;
                        }
                    }
                    if (/bottom/.test(resizer.className)) {
                        target.style.height = `${Math.min(Math.max(orig.h + dy, minHeight), maxHeight)}px`;
                    }
                    if (/top/.test(resizer.className)) {
                        const newHeight = orig.h - dy;
                        target.style.height = `${Math.min(Math.max(newHeight, minHeight), maxHeight)}px`;
                        if (newHeight >= minHeight && newHeight <= maxHeight) {
                            target.style.top = `${orig.y + dy}px`;
                        } else if (newHeight < minHeight) {
                            target.style.top = `${orig.y + (orig.h - minHeight)}px`;
                        }
                    }
                };
                const stopResize = () => {
                    if (resizing) {
                        if (tempElement) {
                            element.style.width = tempElement.style.width;
                            element.style.height = tempElement.style.height;
                            element.style.left = tempElement.style.left;
                            element.style.top = tempElement.style.top;
                            tempElement.remove();
                            overlay.remove();
                        }
                        element.classList.remove('w_left', 'w_right');
                        document.body.style.cursor = '';
                        resizing = false;
                        window.removeEventListener('mousemove', resize);
                        window.removeEventListener('mouseup', stopResize);
                    }
                };
                window.addEventListener('mousemove', resize);
                window.addEventListener('mouseup', stopResize);
            });
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
        allwindows.forEach(el => {
            if (el.classList.contains('content_center')) return;
            Object.assign(el.style, { left: "130px", top: "130px" });
        });
        Object.assign(welcome_menu.style, {
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)"
        });
    }

    let parents = document.querySelectorAll('.parentss');
    parents.forEach((parent, pIdx) => {
        const elements = parent.querySelectorAll('.editable');
        elements.forEach((el, eIdx) => {
            const saved = localStorage.getItem(`editable-${pIdx}-${eIdx}`);
            if (saved) el.textContent = saved;
        });
        parent.addEventListener('contextmenu', (e) => {
            if (e.target !== parent) return;
            e.preventDefault();
            elements.forEach((el, eIdx) => {
                const original = el.textContent;
                const newName = prompt('新しい名前を入力してください (20文字以内):', original);
                if (newName === null || newName === original) return;
                if (newName.length <= 20) {
                    el.textContent = newName;
                    localStorage.setItem(`editable-${pIdx}-${eIdx}`, newName);
                } else {
                    el.textContent = original;
                    nex.style.cursor = '';
                    noticewindow_create("warning", "名前は20文字以内で入力してください!", "File rename");
                }
            });
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
        if (!isAnimating_minimization) {
            isAnimating_minimization = true;
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
            if (localStorage.getItem('window_animation')) {
                indexover(window);
            }
            window.scrollTo(0, 0);
            window_animation(window);
            moveToTaskbarButton(window);
        };

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
        observer.observe(document.getElementById('desktop'), {
            childList: true,
            subtree: true
        });
    }
    document.querySelectorAll('.minimization_button').forEach(addMinimizationButtonListeners);
    observeNewElements4();

    const taskbar_b = document.getElementById('task_buttons2');
    function test_windows_button() {
        taskbar_b.querySelectorAll('.task_buttons').forEach(btn => btn.remove());
        const windows = document.querySelectorAll('.child_windows:not(.no_window):not(.active)');
        const fragment = document.createDocumentFragment();
        windows.forEach(windowElement => {
            const nestedChild2 = windowElement.children?.[0]?.children?.[1]?.textContent || '';
            const button = document.createElement('div');
            button.className = 'task_buttons button2';
            button.style.position = 'relative';
            button.textContent = `　　${nestedChild2}`;
            button.innerHTML += '<span class="title_icon"></span>';
            button.addEventListener('click', () => toggleWindow(windowElement));
            fragment.appendChild(button);
        });
        taskbar_b.appendChild(fragment);
        updateButtonClasses();
        document.querySelectorAll('.child_windows.minimization').forEach(moveToTaskbarButton);
    }

    function moveToTaskbarButton(minBtn) {
        const buttons = document.querySelectorAll('.task_buttons');
        const index = [...document.querySelectorAll('.child_windows:not(.active):not(.no_window)')].indexOf(minBtn);
        if (index >= 0 && buttons[index]) {
            const { top, left, width, height } = buttons[index].getBoundingClientRect();
            Object.assign(minBtn.style, {
                position: 'absolute',
                top: `${top}px`,
                left: `${left}px`,
                width: `${width}px`,
                height: `${height}px`,
                minWidth: '0px',
                minHeight: '0px'
            });
        }
    }

    function toggleWindow(win) {
        if (isAnimating) return;
        isAnimating = true;
        !win.classList.contains('overzindex') && (win.style.zIndex = largestZIndex++);
        win.classList.remove('active');
        const minimized = win.classList.contains('minimization');
        minimized && win.classList.remove('child_windows_invisible', 'minimization');
        minimized && localStorage.getItem('window_animation') && indexover(win);
        updateButtonClasses();
        if (!minimized) return isAnimating = false;
        win.style.minWidth = "0px";
        win.style.minHeight = "0px";
        setTimeout(() => {
            const parent = win.closest('.child_windows');
            window_animation(parent);
            Object.assign(parent.style, {
                top: parent.dataset.originalTops,
                left: parent.dataset.originalLefts,
                width: parent.dataset.originalWidths
            });
            setTimeout(() => {
                parent.style.height = parent.dataset.originalHeights;
                win.style.minWidth = win.style.minHeight = "";
                if ('scrollTop' in parent) {
                    parent.scrollTop = 0;
                    parent.scrollLeft = 0;
                }
                isAnimating = false;
            }, windowanimation * 1000);
        }, 0);
    }

    function updateButtonClasses() {
        const windows = document.querySelectorAll('.child_windows:not(.no_window):not(.active)');
        const buttons = document.querySelectorAll('.task_buttons');
        buttons.forEach((button, index) => {
            button.oncontextmenu = e => {
                e.preventDefault();
                popups('task_buttons', null, button.textContent);
            };
            const win = windows[index];
            if (win?.querySelector('.navy')) {
                button.classList.add('tsk_pressed');
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
        const processFile = (url, x, y) => new Promise(resolve => {
            const w = createElement('div', "child_windows testwindow2 w3 resize");
            Object.assign(w.style, { left: x + "px", top: y + "px", zIndex: largestZIndex++ });
            let fileData = JSON.parse(localStorage.getItem('fileData')) || [];
            fileData = fileData.filter(item => item.url !== url);
            const title = createElement('div', "title", w);
            createElement('span', "title_icon", title);
            createElement('span', "white_space_wrap", title, name);
            const btns = createElement('div', "title_buttons", w);
            createElement('span', "drag_button", btns, "\u00A0");
            const closeBtn = createElement('span', "close_button button2 allclose_button", btns);
            createElement('span', "bigminbtn button2", btns);
            createElement('span', "minimization_button button2", btns);
            createElement('br', null, btns);
            const title2 = createElement('div', "title2", w);
            title2.style.padding = "6px";
            title2.innerHTML = `<div class="bold large" style="display:flex;">
      <button class="button2 bold large" onclick="iframe_reload(event)">&nbsp;↻&nbsp;</button>&nbsp;location:&nbsp;
      <span class="medium border2 white_space_wrap" style="display:inline-block;background:#fff;overflow:hidden;text-overflow:ellipsis;">${url}</span>
      <span class="button2 small" style="margin-left:5px;" onclick="window2url_copy(event)">URLのコピー</span>
    </div>`;
            closeBtn.onclick = () => {
                const p = closeBtn.closest('.child_windows');
                if (p) { p.remove(); zindexwindow_addnavy(); }
            };
            const contents = createElement('div', "window_contents border2", w);
            const bottom = createElement('div', "window_bottom border2 bottom2", w);
            bottom.innerHTML = `
      Document:&nbsp;<span class="white_space_wrap" style="width:300%;">${name}</span>
      <span class="border">&nbsp;loading&nbsp;status:&nbsp;</span>
      <div class="progress-bar-container"><div class="progress-bar"></div></div>`;
            const style = document.createElement('style');
            style.textContent = `
      .bottom2 { display:flex; }
      .progress-bar-container { width:100%; position:relative; }
      .progress-bar { width:0%; height:100%; background:#00f; }`;
            bottom.appendChild(style);
            const addIframe = src => {
                const iframe = createElement('iframe', "item_preview", contents);
                iframe.src = src;
                Object.assign(iframe.style, { width: "100%", height: "100%" });
                contents.classList.add("scrollbar_none");
                Object.assign(contents.style, { overflow: "hidden" });
            };
            if (isYouTubeURL(url)) {
                addIframe(`https://www.youtube.com/embed/${extractYouTubeID(url)}`);
                contents.classList.add('window_resize');
            } else if (isPageUrl(url)) {
                addIframe(url);
                contents.classList.add('window_resize');
            } else {
                noticewindow_create("error", "このファイル形式はサポートされていません。");
            }
            dropArea.appendChild(w);
            setTimeout(() => {
                pagewindow();
                optimizeWindows();
                resolve();
            }, 0);
        });
        processFile(url, 0, 0);
    }

    function window2url_copy(e) {
        const txt = e.currentTarget.closest('div').children[1].textContent;
        if (!navigator.clipboard) return noticewindow_create("warning", "このブラウザには対応してません");
        navigator.clipboard.writeText(txt).then(() => noticewindow_create("clipboard", "コピーしました"), () => alert("コピー失敗"));
    }

    function iframe_reload(e) {
        const iframe = e.currentTarget.closest('.child_windows').children[3].firstElementChild;
        iframe.src = iframe.src;
    }

    function optimizeWindows() {
        const adjust = (win) => requestAnimationFrame(() => {
            const c = win.querySelector('.window_resize');
            if (c) c.style.height = `${win.clientHeight - (win.querySelector('.window_bottom')?.offsetHeight || 0) - 60}px`;
            const iframe = win.querySelector('iframe');
            const progressBar = win.querySelector('.progress-bar-container .progress-bar');
            if (!iframe || !progressBar) return;
            const resetProgressBar = () => progressBar.style.width = '0%';
            if (iframe._progressTimer) clearInterval(iframe._progressTimer);
            iframe.addEventListener('load', () => {
                clearInterval(iframe._progressTimer);
                progressBar.style.width = '100%';
                setTimeout(resetProgressBar, 100);
            });
            resetProgressBar();
            progressBar.style.width = '10%';
            let progress = 5;
            iframe._progressTimer = setInterval(() => {
                progressBar.style.width = `${progress = Math.min(progress + 50, 100)}%`;
                if (progress === 100) {
                    clearInterval(iframe._progressTimer);
                    setTimeout(resetProgressBar, 100);
                }
            }, 100);
        });

        new MutationObserver((m) =>
            m.forEach(({ addedNodes }) =>
                addedNodes.forEach((n) => n.classList?.contains('testwindow2') && !n.dataset.adjusted && (
                    n.dataset.adjusted = "true",
                    adjust(n),
                    [n, n.querySelector('.window_bottom')].forEach((el) => el && new ResizeObserver(() => adjust(n)).observe(el))
                ))
            )
        ).observe(document.body, { childList: true, subtree: true });

        document.querySelectorAll('.testwindow2:not([data-adjusted])').forEach((n) => {
            n.dataset.adjusted = "true";
            adjust(n);
            [n, n.querySelector('.window_bottom')].forEach((el) => el && new ResizeObserver(() => adjust(n)).observe(el));
        });
    }

    const dropArea = document.querySelector('#soft_windows');
    nex_files.addEventListener('dragover', e => e.preventDefault());
    nex_files.addEventListener('drop', e => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        const url = e.dataTransfer.getData('text/uri-list');
        const isSupported = f => {
            const t = f.type;
            return t.startsWith('image/') || t.startsWith('video/') || t === 'application/pdf' || t.startsWith('text/') || isYouTubeURL(url) || isPageUrl(url);
        };
        const processFile = (file, x, y) => new Promise((res, rej) => {
            const reader = new FileReader();
            reader.onload = ev => {
                const r = ev.target.result;
                const w = createElement('div', "child_windows testwindow2 resize");
                Object.assign(w.style, { left: `${x}px`, top: `${y}px`, zIndex: largestZIndex++ });
                const t = createElement('div', "title", w);
                createElement('span', "title_icon", t);
                createElement('span', "white_space_wrap", t, file.name);
                const btns = createElement('div', "title_buttons", w);
                createElement('span', "drag_button", btns, "\u00A0");
                const closeBtn = createElement('span', "close_button button2 allclose_button", btns);
                createElement('span', "bigminbtn button2", btns);
                createElement('span', "minimization_button button2", btns);
                createElement('br', null, btns);
                closeBtn.onclick = () => {
                    const p = closeBtn.closest('.child_windows');
                    if (p) {
                        p.remove();
                        zindexwindow_addnavy();
                    }
                };
                const contents = createElement('div', "window_contents", w);
                const addMedia = (tag, src) => {
                    const wrapper = document.createElement('div');
                    Object.assign(wrapper.style, { display: 'flex', flexDirection: 'column', alignItems: 'stretch', width: '100%', height: '100%', boxSizing: 'border-box' });
                    const video = Object.assign(document.createElement(tag), { src, controls: false });
                    Object.assign(video.style, { display: 'block', marginTop: '10px', width: '100%', height: '90%', boxSizing: 'border-box' });
                    wrapper.appendChild(video);
                    const controls = Object.assign(document.createElement('div'), { className: 'border2' });
                    Object.assign(controls.style, { display: 'flex', alignItems: 'center', width: '100%', height: '35px', padding: '2.5px', gap: '5px', boxSizing: 'border-box' });
                    wrapper.appendChild(controls);
                    const play = Object.assign(document.createElement('button'), { textContent: '▶', className: 'button2' });
                    Object.assign(play.style, { flex: '0 0 auto', padding: '2px 5px', fontSize: '15px' });
                    const seek = Object.assign(document.createElement('input'), { type: 'range', min: 0, max: 100, value: 0, className: 'border' });
                    Object.assign(seek.style, { flex: '1 1 auto', height: '12px', verticalAlign: 'middle', margin: 0, boxSizing: 'border-box' });
                    const timeDisplay = Object.assign(document.createElement('span'), { textContent: '0:00 / 0:00', className: 'button2' });
                    Object.assign(timeDisplay.style, { flex: '0 0 auto', minWidth: '60px', textAlign: 'right' });
                    controls.append(play, seek, timeDisplay);
                    contents.appendChild(wrapper);
                    contents.classList.add("scrollbar_none");
                    contents.style.background = "silver";
                    play.onclick = () => video.paused ? video.play() : video.pause();
                    video.onplay = () => play.textContent = '⏸';
                    video.onpause = () => play.textContent = '▶';
                    video.ontimeupdate = () => {
                        seek.value = (video.currentTime / video.duration) * 100 || 0;
                        const fmt = t => `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, '0')}`;
                        timeDisplay.textContent = `${fmt(video.currentTime)} / ${fmt(video.duration)}`;
                    };
                    seek.oninput = () => video.currentTime = (seek.value / 100) * video.duration;
                };
                const addIframe = src => {
                    const iframe = createElement('iframe', "item_preview", contents);
                    iframe.src = src;
                    Object.assign(iframe.style, { width: "100%", height: "100%" });
                    contents.classList.add("scrollbar_none");
                };
                const addMediaContent = (mediaTag, mediaSrc) => {
                    const mediaElement = createElement(mediaTag, "item_preview", contents);
                    mediaElement.src = mediaSrc;
                    contents.classList.add("scrollbar_none");
                };
                if (file.type.startsWith('image/')) {
                    addMediaContent('img', r);
                    const eDiv = document.createElement('div');
                    eDiv.innerHTML = `<div class="window_bottom border2"><span class="button2" onclick="updateWallpaper('${url}')">画像を背景に適用</span></div>`;
                    w.appendChild(eDiv);
                } else if (file.type.startsWith('video/')) addMedia('video', r);
                else if (file.type === 'application/pdf') addIframe(r);
                else if (file.type.startsWith('text/')) createElement('p', "item_preview", contents, r);
                else if (isYouTubeURL(url)) addIframe(`https://www.youtube.com/embed/${extractYouTubeID(url)}`);
                else if (isPageUrl(url)) addIframe(url);
                else {
                    noticewindow_create("error", "このファイル形式はサポートされていません。");
                    rej(new Error("Unsupported file type"));
                    return;
                }
                dropArea.appendChild(w);
                setTimeout(() => { pagewindow(); res(); }, 0);
            };
            reader.onerror = () => rej(new Error(`Failed to read file: ${file.name}`));
            reader.readAsDataURL(file);
        });
        for (let i = 0; i < files.length; i++) {
            const f = files[i];
            if (!isSupported(f)) {
                noticewindow_create("error", `対応していないファイルです: ${f.name}`);
                continue;
            }
            setTimeout(() => {
                noticewindow_create("loading", `読み込み中... ${i + 1} of ${files.length}: ${f.name}`);
                document.querySelector('.add_create_windows').style.zIndex = largestZIndex++;
                processFile(f, e.clientX, e.clientY).then(addwindow_remove).catch(err => {
                    console.error(`Error processing file ${i + 1}:`, err);
                    const m = document.querySelector('.processingMessage');
                    if (m) m.innerText = `Error processing file ${i + 1} of ${files.length}: ${f.name}`;
                });
            }, i * 200);
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
        document.querySelectorAll('.testwindow2:not(.nocreatewindow)').forEach(win => {
            Object.assign(win.style, { width: '650px', height: '400px' });
            win.classList.add('nocreatewindow');
            const centerElem = win.querySelector(`:scope > *:nth-child(${win.classList.contains('w3') ? 4 : 3}) > *`);
            centerElem ? centerElem.classList.add('center') : win.remove();
        });
        document.querySelectorAll('.testwindow2:not(.overzindex), .child').forEach(child => {
            const parent = child.closest('.testwindow2');
            child.addEventListener('mousedown', () => {
                document.addEventListener('mousemove', adjustSize);
                parent.scrollTop = parent.scrollLeft = 0;
                if (!parent.classList.contains('overzindex')) {
                    parent.style.zIndex = largestZIndex++;
                }
                adjustSize();
            });
            const adjustSize = () => {
                const { clientWidth: width, clientHeight: height } = parent;
                Object.assign(child.children[2]?.firstElementChild?.style || {}, {
                    maxWidth: `${width}px`,
                    maxHeight: `${height - 25}px`
                });
            };
        });
    }

    const removePopups = () => document.querySelectorAll('.popup').forEach(popup => popup.remove());
    const popups = (cls, url, text) =>
        document.querySelectorAll(`.${cls}`).forEach(button => {
            removePopups();
            const popup = document.createElement('div');
            popup.className = 'popup';
            popup.textContent = url ?? text;
            popup.style.zIndex = "999996";
            document.body.appendChild(popup);
            popup.style.left = `${event.pageX}px`;
            popup.style.top = `${event.pageY - popup.offsetHeight}px`;
            button.addEventListener('mouseleave', removePopups);
        });

    document.getElementById('exportButton').addEventListener('click', function () {
        const localStorageData = JSON.stringify(localStorage);
        function base64Encode(str) {
            return btoa(unescape(encodeURIComponent(str)));
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
            noticewindow_create("nexser", "データが復元されました! ページを再読み込みしますか?", null, reload);
            sound(4);
        } catch (error) {
            noticewindow_create("error", error.message);
        }
    });

    function reload() {
        window.location = '';
    }

    function nexser_search_button() {
        const fragment = document.createDocumentFragment();
        const windows = document.querySelectorAll('.child_windows:not(.window_nosearch)');
        for (let i = 0, len = windows.length; i < len; i++) {
            const nestedChild = windows[i].children[0]?.children[1];
            if (nestedChild?.textContent) {
                const li = document.createElement('li');
                li.className = 'borderinline_dotted button2 search_button white_space_wrap';
                li.textContent = `　${nestedChild.textContent}　`;
                li.addEventListener('click', () => toggleWindow(windows[i]));
                fragment.appendChild(li);
            }
        }
        document.getElementById('myUL').appendChild(fragment);
    }
    nexser_search_button();

    function filesposition() {
        const elements = document.querySelectorAll('.desktop_files');
        elements.forEach((element, index) => {
            element.addEventListener('mousedown', fileborder_reset);
            element.addEventListener('click', () => {
                element.firstElementChild.classList.add('file_select');
            });
            const saved = localStorage.getItem(`draggable-${index}`);
            if (saved) {
                const [x, y] = saved.split(',');
                Object.assign(element.style, {
                    position: 'absolute',
                    left: `${x}px`,
                    top: `${y}px`
                });
            }
            element.draggable = true;
            let offsetX = 0, offsetY = 0;
            element.addEventListener('dragstart', e => {
                const rect = element.getBoundingClientRect();
                offsetX = e.clientX - rect.left;
                offsetY = e.clientY - rect.top;
                e.dataTransfer.setData('text/plain', '');
                Object.assign(element.style, {
                    border: '1.95px dotted dimgray',
                    opacity: '0.9'
                });
                rectangle_remove();
            });
            element.addEventListener('dragend', e => {
                const x = e.clientX - offsetX;
                const y = e.clientY - offsetY;
                Object.assign(element.style, {
                    position: 'absolute',
                    left: `${x}px`,
                    top: `${y}px`,
                    border: '',
                    opacity: ''
                });
                element.firstElementChild.style.opacity = '';
                element.children[1].style.opacity = '';
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

    let timerText = document.getElementById('timerText');
    let set_btn = document.getElementById('set_btn');
    let parent_list = document.getElementById('parent_list');
    let record = JSON.parse(localStorage.getItem('alarms')) || [];
    let lastAlarmTime = '';
    const adjustDigit = n => (n < 10 ? '0' + n : n);
    const saveAlarms = () => localStorage.setItem('alarms', JSON.stringify(record));
    const createListItem = (hour, minute, id) => {
        const li = document.createElement('li');
        li.textContent = `${hour}時${minute}分`;
        li.id = id;
        li.classList.add('deletes', 'large');
        const span = document.createElement('span');
        span.textContent = '削除';
        span.classList.add('delete_btn', 'button2', 'large');
        li.appendChild(span);
        span.addEventListener('click', () => {
            record[id] = 'disabled';
            li.remove();
            saveAlarms();
        });
        return li;
    };
    const loadAlarms = () => {
        parent_list.innerHTML = '';
        record.forEach((alarm, i) => {
            if (alarm !== 'disabled') {
                parent_list.appendChild(createListItem(alarm.sethour, alarm.setminute, i));
            }
        });
    };
    set_btn.addEventListener('click', () => {
        if (parent_list.children.length >= 10) return;
        const f = document.alarm_form;
        const h = f.option_hours.value;
        const m = f.option_minutes.value;
        record.push({ sethour: h, setminute: m });
        parent_list.appendChild(createListItem(h, m, record.length - 1));
        saveAlarms();
    });
    const updateCurrentTime = () => {
        const now = new Date();
        const hh = adjustDigit(now.getHours());
        const mm = adjustDigit(now.getMinutes());
        const ss = adjustDigit(now.getSeconds());
        timerText.textContent = `${hh}:${mm}:${ss}`;
        const currentTimeKey = `${hh}:${mm}`;
        if (ss === '00' && currentTimeKey !== lastAlarmTime) {
            record.forEach(a => {
                if (a !== 'disabled' && a.sethour == now.getHours() && a.setminute == now.getMinutes()) {
                    noticewindow_create("alarm", "お時間です!　");
                    lastAlarmTime = currentTimeKey;
                }
            });
        }
    };
    loadAlarms();
    setInterval(updateCurrentTime, 1000);

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

    const [parent, child, rightGroup] = [
        '.first_taskbar_buttons',
        '.taskbar_buttons',
        '.taskbar_rightgroup',
        '#taskbar'
    ].map(sel => document.querySelector(sel));

    const debounce = (fn, delay) => {
        let t;
        return (...a) => {
            clearTimeout(t);
            t = setTimeout(() => fn.apply(this, a), delay);
        };
    };

    const taskbar_resize = () => {
        if (!parent || !child || !rightGroup || !taskbar) return;
        const offset = window.getComputedStyle(parent).display === 'none' ? 75 : 150;
        Object.assign(child.style, {
            position: 'absolute',
            left: `${parent.clientWidth + 70}px`,
            width: `${taskbar.clientWidth - rightGroup.clientWidth - offset}px`,
            height: `${taskbar.clientHeight - 3}px`
        });
    };

    const ro = new ResizeObserver(debounce(taskbar_resize, 100));
    window.addEventListener('resize', debounce(taskbar_resize, 100));
    ro.observe(rightGroup);

    const allwindow_resize = () => {
        cameraframe_resize();
        commandarea_resize();
        taskbar_resize();
        bigwindow_resize();
    };

    const debounced_allwindow_resize = debounce(allwindow_resize, 100);
    allwindows.forEach(el => ro.observe(el));

    function bigwindow_resize() {
        if (isAnimating) return;
        const th = taskbar.clientHeight;
        const autoHide = localStorage.getItem('taskbar_autohide');
        const posBtn = localStorage.getItem('taskbar_position_button');
        const noBottom = taskbar.style.bottom === "";
        const topPx = `${th}px`;
        const heightCalc = `calc(100% - ${th}px)`;
        const resizeElements = document.querySelectorAll('.big:not(.minimization), .w_left:not(.minimization), .w_right:not(.minimization)');
        resizeElements.forEach(el => requestAnimationFrame(() => {
            el.style.height = autoHide ? (noBottom ? heightCalc : "100%") : heightCalc;
            if (posBtn) {
                el.style.top = topPx;
                if (autoHide) el.style.height = `${window.innerHeight - th}px`;
            }
        }));
        document.querySelectorAll('.big:not(.minimization)').forEach(el =>
            requestAnimationFrame(() => el.style.width = "")
        );
        document.querySelectorAll('iframe, video, img').forEach(el =>
            requestAnimationFrame(() => {
                el.style.maxWidth = "100%";
                el.style.maxHeight = "100%";
            })
        );
    }

    function kakeibo_setCurrentDateTime() {
        const now = new Date();
        document.getElementById('kakeibo_date').value = now.toISOString().slice(0, 10);
        document.getElementById('kakeibo_time').value = now.toTimeString().slice(0, 5);
    }
    function kakeibo_addEntry() {
        const e = id => document.getElementById(id).value;
        const entry = {
            type: e('type'),
            amount: parseFloat(e('amount')) || 0,
            description: e('description'),
            date: e('kakeibo_date'),
            time: e('kakeibo_time')
        };
        kakeibo_saveEntry(entry);
        kakeibo_displayEntries();
        kakeibo_calculateTotal();
    }
    function kakeibo_saveEntry(entry) {
        const entries = JSON.parse(localStorage.getItem('entries')) || [];
        entries.push(entry);
        localStorage.setItem('entries', JSON.stringify(entries));
    }
    function kakeibo_loadEntries() {
        kakeibo_displayEntries();
        kakeibo_calculateTotal();
    }
    function kakeibo_displayEntries() {
        const entries = JSON.parse(localStorage.getItem('entries')) || [];
        const container = document.getElementById('entries');
        container.innerHTML = entries.map((e, i) => {
            const color = e.type === '収入' ? 'red' : 'blue';
            return `<div class="entry">
      <div class="border" style="color:${color};"><strong>${e.type}</strong>: ¥${e.amount} - ${e.description} (${e.date} ${e.time})</div>
      <button class="button2 medium" onclick="kakeibo_deleteEntry(${i})">削除</button>
    </div>`;
        }).join('');
    }
    function kakeibo_deleteEntry(i) {
        const entries = JSON.parse(localStorage.getItem('entries')) || [];
        entries.splice(i, 1);
        localStorage.setItem('entries', JSON.stringify(entries));
        kakeibo_displayEntries();
        kakeibo_calculateTotal();
    }
    function kakeibo_calculateTotal() {
        const entries = JSON.parse(localStorage.getItem('entries')) || [];
        const total = entries.reduce((sum, e) => sum + (e.type === '収入' ? e.amount : -e.amount), 0);
        document.getElementById('total').innerText = `¥${total}`;
    }
    kakeibo_loadEntries();
    kakeibo_setCurrentDateTime();

    const s = document.getElementById('opacitySlider'),
        d = document.querySelector('.screen_light'),
        v = document.getElementById('valueDisplay'),
        o = localStorage.getItem('divOpacity');
    o && (d.style.opacity = 1 - o, s.value = o * 100, v.textContent = s.value);
    s.oninput = () => {
        const val = s.value, op = 1 - val / 100;
        d.style.opacity = op;
        v.textContent = val;
        localStorage.setItem('divOpacity', 1 - op);
    };

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

    navigator.getBattery().then(b => {
        let lastWarn = 100, notice = null;
        const show = l => {
            notice?.remove();
            notice = Object.assign(document.createElement('div'), { className: 'border', textContent: `バッテリー残量が少なくなっています (${l}%)` });
            Object.assign(notice.style, { position: 'fixed', bottom: '100px', left: '50%', transform: 'translateX(-50%)', background: 'silver', padding: '10px 20px', zIndex: 999999 });
            document.body.appendChild(notice);
            setTimeout(() => notice?.remove(), 5000);
        };
        const update = () => {
            const l = Math.floor(b.level * 100), c = b.charging;
            battery_child.style.color = c ? (l === 100 ? 'lime' : '#FF9900') : 'black';
            battery_child.style.background = c ? 'black' : '';
            if (!c && l <= 20 && l < lastWarn) { lastWarn = l; show(l); }
            document.querySelector('.battery_time').textContent = c ? `${b.dischargingTime}` : `${b.dischargingTime} second`;
            document.querySelector('.taskbattery').textContent = l;
        };
        b.addEventListener('levelchange', update);
        b.addEventListener('chargingchange', update);
        update();
    });

    const menuItems = [
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
    ];
    const buttonsHTML = `
  <button class="button2 windowfile2 bold" style="width:25px;">・</button>
  <button class="button2 windowfile1 bold" style="width:25px;">ー</button>
  <button class="button2 windowfile3 bold" style="width:25px;">=&nbsp;=</button>
  <button class="button2 nexser_search" style="width:25px;"><span class="magnifying_glass"></span></button>
  <button class="button2" onclick="filetimes_test()" style="width:25px;margin-left:10px;">TR</button>
  <button class="button2" onclick="filetimes_test2()" style="width:25px;">TF</button>
  <button class="button2" onclick="window_subtitle()" style="width:25px;margin-left:10px;text-shadow:2px 2px 1px dimgray;">title</button>
`;
    document.querySelectorAll('.window_tool').forEach(tool => {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
    <span class="bold" style="position:absolute;margin-top:5px;">Address:</span>
    <span class="winchild_border"></span>
    <div class="windowtool_parent">
      <span class="startmenu_file_icon"></span>
      <button class="button2" style="height:20px;font-size:large;float:right;">&#x25BC;</button>
      &emsp;&emsp;<span class="windowtool_child_filenames"></span>
      <div class="windowtool_child"><ul>
        ${menuItems.map(item => `<li class="${item.class}"><span class="startmenu_file_icon"></span>${item.text}</li>`).join('')}
      </ul></div>
    </div>`;
        tool.appendChild(wrapper);
    });
    document.querySelectorAll('.windowtool_parent').forEach(parent => {
        const child = parent.querySelector('.windowtool_child');
        parent.addEventListener('mousedown', e => {
            if (!e.target.closest('.windowtool_child')) {
                child.style.display = (child.style.display === 'block') ? 'none' : 'block';
            }
        });
        child.addEventListener('click', e => {
            e.stopPropagation();
            child.style.display = 'none';
        });
    });
    document.querySelectorAll('.windowtool_child_filenames').forEach(filename => {
        const windowDiv = filename.closest('.child_windows');
        filename.textContent = windowDiv?.children[0]?.lastElementChild?.textContent || '';
    });
    document.querySelectorAll('.windowtool_buttons_child').forEach(container => {
        const div = document.createElement('div');
        div.innerHTML = buttonsHTML;
        div.style = "display:flex;height:25px;";
        container.appendChild(div);
    });
    requestAnimationFrame(() => {
        const setMode = (set, others, action) => {
            localStorage.setItem(set, true);
            others.forEach(k => localStorage.removeItem(k));
            action();
        };
        document.querySelectorAll('.windowfile1').forEach(btn =>
            btn.addEventListener('click', () => setMode('windowfile_1', ['windowfile_2', 'windowfile_3'], window_file_list_change))
        );
        document.querySelectorAll('.windowfile2').forEach(btn =>
            btn.addEventListener('click', () => setMode('windowfile_2', ['windowfile_1', 'windowfile_3'], window_file_list_reset))
        );
        document.querySelectorAll('.windowfile3').forEach(btn =>
            btn.addEventListener('click', () => setMode('windowfile_3', ['windowfile_1', 'windowfile_2'], window_file_list_change2))
        );
        document.querySelectorAll('.nexser_search').forEach(btn => {
            btn.onclick = () => toggleWindow(nexser_search_menu);
        });
        if (localStorage.getItem('filetimes')) {
            document.querySelectorAll('.windowfile_time').forEach(el => el.style.display = 'none');
        }
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

    document.querySelectorAll('.file_windows').forEach(el => {
        const title = el.querySelector('.title')?.lastElementChild?.textContent;
        if (!title) return;
        el.children[4]?.insertAdjacentHTML('afterbegin',
            `<div class="xx-large bold window_subtitles" style="display:none;background:linear-gradient(225deg,#d8fafa 20%,#d2fcd2 50%,whitesmoke,#dbdbdb);text-shadow:4px 4px 2px dimgray;">
      ${title}
      <div class="welcome_icons" style="opacity:0.2;z-index:-1;">
        <span class="welicon_1"></span><span class="welicon_2"></span>
      </div>
    </div>`);
    });
    if (localStorage.getItem('window_subtitle')) {
        document.querySelectorAll('.window_subtitles').forEach(element => {
            element.style.display = "block";
        });
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

    function noticewindow_create(window_icon, errorTitle, errorMessage = "Error", func_command, func_command_sub) {
        nex.style.cursor = "";

        const isWarning = window_icon === "warning",
            isError = window_icon === "error",
            isLoad = window_icon === "load",
            hasFunc = typeof func_command === "function",
            hasFuncSub = typeof func_command_sub === "function",
            taskbarZIndex = parseInt(window.getComputedStyle(taskbar).zIndex, 10) || 0;

        if (isWarning) sound(4);
        if (isError) sound(2);

        if (!errorMessage || errorMessage === "Error") {
            errorMessage = isWarning ? "warning" : isError ? "error" : isLoad ? "loading" : window_icon;
        }

        const iconHTML = isWarning ? '<span class="warning_icon bold" style="position: absolute; top: 45px;">!</span>'
            : isError ? '<span class="error_icon">✕</span>' : '';

        const createButton = (text, left, handlers = []) => {
            const btn = document.createElement("span");
            btn.className = "button2 borderinline_dotted";
            btn.style.position = "relative";
            btn.style.left = left;
            btn.style.transform = "translateX(-50%)";
            btn.innerHTML = text;
            handlers.forEach(h => btn.addEventListener("click", h));
            return btn;
        };

        const entryDiv = document.createElement("div");
        entryDiv.className = `child_windows error_windows back_silver no_window ${isLoad ? 'add_create_load_windows' : 'add_create_windows'}`;

        const contentDiv = document.createElement("div");
        contentDiv.className = "window_content";
        contentDiv.innerHTML = `<p>${iconHTML}<span class="window_error_text">${errorTitle}</span></p>`;

        const buttonOk = createButton("&emsp;OK&emsp;", hasFunc ? "40%" : "50%", [error_windows_close]);
        if (hasFunc) buttonOk.addEventListener("click", func_command);
        contentDiv.appendChild(buttonOk);

        if (hasFunc) {
            const buttonNo = createButton("&emsp;NO&emsp;", "45%", [error_windows_close]);
            if (hasFuncSub) buttonNo.addEventListener("click", func_command_sub);
            contentDiv.appendChild(buttonNo);
        }

        entryDiv.innerHTML = `
    <div class="title">
      <span class="bold error_title_text">${errorMessage}</span>
    </div>
    <div class="title_buttons">
      <span class="drag_button">&nbsp;</span>
      <span class="close_button button2 allclose_button"></span>
    </div>`;
        entryDiv.appendChild(contentDiv);
        entryDiv.querySelector(".close_button").addEventListener("click", error_windows_close);

        entryDiv.addEventListener("mousedown", e => {
            if (!entryDiv.classList.contains("overzindex")) {
                e.currentTarget.style.zIndex = largestZIndex++;
            }
        });

        if (hasFunc) {
            const bgDiv = document.createElement("div");
            bgDiv.className = "background_black";
            bgDiv.style.zIndex = taskbarZIndex + 1;
            body.appendChild(bgDiv);
            entryDiv.classList.add("overzindex", "overzindex2");
            requestAnimationFrame(() => {
                const bgZ = parseInt(window.getComputedStyle(bgDiv).zIndex, 10) || 0;
                document.querySelector(".overzindex").style.zIndex = bgZ + 1;
            });
        }

        if (localStorage.getItem('setup')) {
            dropArea.appendChild(entryDiv);
        } else {
            document.querySelector('.setup_windows').appendChild(entryDiv);
            const bgBlack = document.querySelector('.background_black');
            if (bgBlack) bgBlack.style.opacity = "0";
            entryDiv.children[1].children[1].style.display = "none";
        }

        entryDiv.style.maxHeight = "0px";
        entryDiv.style.maxWidth = "0px";
        windowpos_fix(entryDiv);
        entryDiv.style.zIndex = largestZIndex++;
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


    const maxRecentColors = 15;
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
        filettext_backcolor();

        // --- dropList 復元 ---
        const dropList = document.querySelector('#drop_zone ul');
        const savedContent = localStorage.getItem('dropListContent');
        if (savedContent) {
            dropList.innerHTML = savedContent;
            Array.from(dropList.children).forEach(el => {
                el.draggable = true;
                el.addEventListener('dragstart', e => {
                    e.dataTransfer.setData('text/plain', e.target.outerHTML);
                    e.target.style.opacity = "0.9";
                });
                el.addEventListener('contextmenu', e => {
                    e.preventDefault();
                    showContextMenu(e, el);
                    removefile_Border();
                    applyBorder(e, el);
                });
            });
        }

        // --- ボタンごとのメニュー設定 ---
        const toggleSettings = [
            ['.nexser_guidebook', nexser_guidebook_menu], ['.guidebook_window', guidebook_window_menu],
            ['.guidebook_file', guidebook_file_menu], ['.guidebook_taskbar', guidebook_taskbar_menu],
            ['.passmenu_button', password_menu], ['.localstorage_details', localstorage_details_menu],
            ['.kakeibo_btn', kakeibo_menu], ['.document_button', mydocument_menu],
            ['.restriction_btn', restriction_menu], ['.test_button', main],
            ['.test_button2', my_computer], ['.test_button3', control],
            ['.test_button4', color_menu], ['.test_button5', system_menu],
            ['.test_button6', window_prompt], ['.test_button7', clock_menu],
            ['.test_button8', sound_menu], ['.test_button9', driver_menu],
            ['.test_button10', mouse_menu], ['.test_button11', screen_text_menu],
            ['.test_button12', note_pad, notefocus], ['.test_button13', text_drop_menu],
            ['.test_button14', windowmode_menu], ['.test_button15', accessory_menu],
            ['.test_button16', calc_menu], ['.test_button17', nexser_sound_menu],
            ['.test_button18', camera_menu], ['.test_button19', htmlviewer_edit_menu],
            ['.test_button20', htmlviewer_run_menu], ['.test_button22', font_menu],
            ['.test_button23', file_setting_menu], ['.test_button24', debug_menu],
            ['.test_button25', file_download_menu], ['.test_button26', display_menu],
            ['.test_button27', stopwatch_menu, timerreset], ['.test_button28', add_program_menu],
            ['.test_button30', objective_menu], ['.test_button31', calendar_menu, caload],
            ['.test_button32', cpu_bench_menu, cpubench_open], ['.test_button33', browser_menu],
            ['.test_button35', taskbar_setting_menu], ['.test_button37', device_menu],
            ['.test_button38', omikuji_menu], ['.test_button39', localstorage_monitor_menu],
            ['.test_button40', paint_menu], ['.test_button42', nexser_files_menu, () => {
                setTimeout(() => { nexser_files_output_remove(); nexser_files_windowload(); }, 100);
            }],
            ['.test_button45', alarm_menu], ['.test_button46', location_menu],
            ['.test_button47', editor_menu], ['.test_button48', url_droplist_menu],
            ['.trash_can', trash_menu], ['.test_button29', tetris_mneu],
            ['.test_button49', systemresouce_menu], ['.test_button34', bom_menu],
            ['.test_button41', othello_menu], ['.test_button44', memory_game_menu]
        ];

        toggleSettings.forEach(([sel, menu, extra]) => {
            document.querySelectorAll(sel).forEach(el => el.onclick = () => { toggleWindow(menu); extra?.(); });
        });

        // --- ウィンドウファイルクリック・時間表示 ---
        const files = Array.from(document.querySelectorAll('.window_files'));

        const updateFileTime = (el, key) => {
            const now = new Date();
            let t = el.querySelector('.windowfile_time') || (() => {
                const li = document.createElement('li');
                li.className = 'windowfile_time';
                el.appendChild(li);
                return li;
            })();
            t.textContent = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
            localStorage.setItem(key, t.textContent);
            displayFileTimes();
        };

        const displayFileTimes = () => {
            const w1 = localStorage.getItem('windowfile_1'), w2 = localStorage.getItem('windowfile_2'), w3 = localStorage.getItem('windowfile_3');
            document.querySelectorAll('.windowfile_time').forEach(el => {
                el.style.display = ((!w1 && !w2 && !w3) || (!w1 && w2 && !w3)) ? 'none' : '';
            });
        };

        files.forEach((el, i) => {
            const key = `windowfile_time_${i}`;
            el.addEventListener('mousedown', () => document.querySelector('.file_border')?.classList.replace('file_border', 'file_border2'));
            el.addEventListener('click', () => {
                files.forEach(f => f.classList.remove('file_border', 'file_border2'));
                el.classList.add('file_border');
                updateFileTime(el, key);
            });

            const saved = localStorage.getItem(key);
            if (saved) el.querySelector('.windowfile_time')?.remove();
            const t = el.querySelector('.windowfile_time') || (() => {
                const li = document.createElement('li');
                li.className = 'windowfile_time';
                el.appendChild(li);
                return li;
            })();
            if (saved) t.textContent = saved;
        });

        displayFileTimes();
    }


    function showContextMenu(event, element) {
        document.querySelector('.context-menu')?.remove();
        const menu = document.createElement('span');
        menu.className = 'context-menu border back_silver';
        menu.style = `position: absolute;
        z-index: 99999;
        top: ${event.clientY}px;
        left: ${event.clientX}px;`;
        menu.innerHTML = `<p id="delete" class="back_silver hover_blue" style="z-index:99999;">&nbsp;Delete&nbsp;</p>`;
        document.body.appendChild(menu);
        const { offsetHeight: mh, offsetWidth: mw } = menu;
        const { innerHeight: wh, innerWidth: ww } = window;
        menu.style.top = `${Math.min(event.clientY, wh - mh)}px`;
        menu.style.left = `${Math.min(event.clientX, ww - mw)}px`;
        document.getElementById('delete').onclick = () => {
            element.remove();
            menu.remove();
            saveToLocalStorage();
        };
        document.addEventListener('click', () => {
            menu.remove();
            removefile_Border();
        }, { once: true });
    }

    function applyBorder(e, element) {
        element.classList.add('file_border3')
    }
    function removefile_Border() {
        fileElements.forEach((rf) => {
            rf.classList.remove('file_border3')
        })
    }
    function filepositon_reset() {
        document.querySelectorAll('.desktop_files').forEach((desktop_file, index) => {
            ['left', 'top', 'position'].forEach(style => desktop_file.style[style] = "");
            localStorage.removeItem(`draggable-${index}`);
        });
    }

    fileElements.forEach(item => {
        item.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', e.target.outerHTML);
            e.target.style.opacity = "0.9";
        });
    });
    nex_files.addEventListener('dragover', e => e.preventDefault());
    nex_files.addEventListener('drop', e => {
        e.preventDefault();
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = e.dataTransfer.getData('text/plain');
        const firstChild = tempDiv.firstElementChild;
        if (firstChild?.classList.contains('window_files')) {
            const droppedContent = firstChild.querySelector('li').innerHTML;
            const existingFile = [...document.querySelectorAll('.desktop_files')].find(item => item.innerHTML.includes(droppedContent));
            if (!existingFile) {
                const newFile = document.createElement('div');
                newFile.className = `desktop_files ${firstChild.className.replace('window_files', '').trim()}`;
                newFile.draggable = true;
                newFile.innerHTML = `
                    <li class="desktop_files_text editable">${droppedContent}</li>
                    <span class="dli-folder"></span>`;
                document.querySelector('.files_inline').appendChild(newFile);
                newFile.addEventListener('contextmenu', e => {
                    e.preventDefault();
                    updateLocalStorageOnDelete(newFile.className);
                    newFile.remove();
                });
                saveToLocalStorage_deskfiles(newFile);
            }
        }
    });
    function saveToLocalStorage_deskfiles(file) {
        const files = JSON.parse(localStorage.getItem('desktopFiles')) || [];
        files.push({ className: file.className, innerHTML: file.innerHTML });
        localStorage.setItem('desktopFiles', JSON.stringify(files));
        loadFromLocalStorage();
        filesposition();
        fileicon();
    }
    function updateLocalStorageOnDelete(className) {
        const files = (JSON.parse(localStorage.getItem('desktopFiles')) || []).filter(file => file.className !== className);
        localStorage.setItem('desktopFiles', JSON.stringify(files));
    }
    if (localStorage.getItem('desktopFiles')) {
        JSON.parse(localStorage.getItem('desktopFiles')).forEach(data => {
            const file = document.createElement('div');
            file.className = data.className;
            file.draggable = true;
            file.innerHTML = data.innerHTML;
            document.querySelector('.files_inline').appendChild(file);
            file.addEventListener('contextmenu', e => {
                e.preventDefault();
                updateLocalStorageOnDelete(file.className);
                file.remove();
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

    const addLeftClass = () => {
        const elements = document.querySelectorAll('.title, .title_buttons');
        elements.forEach(element => {
            if (!element.classList.contains('left')) {
                element.classList.add('left');
            }
        });
    };

    function updateStartMenuPosition() {
        const { top, bottom } = taskbar.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const isBottom = top > windowHeight / 2;
        Object.assign(start_menu.style, {
            top: isBottom ? "auto" : `${bottom}px`,
            bottom: isBottom ? `${windowHeight - top}px` : "auto",
        });
        document.querySelectorAll("#start_menu li").forEach(folder => {
            folder.querySelector(".startmenu_file_icon") ||
                folder.prepend(Object.assign(document.createElement("span"), { className: "startmenu_file_icon" }));
            const submenu = folder.querySelector(".submenu");
            if (submenu && !folder.querySelector(".arrow")) {
                folder.prepend(Object.assign(document.createElement("span"), { className: "arrow", textContent: "➡" }));
                folder.style.position = "relative";
                submenu.classList.add("border");
            }
        });
    }

    (() => {
        const r = document.getElementById('resultArea');
        if (!r) return;
        const gl = document.createElement('canvas').getContext('webgl') || document.createElement('canvas').getContext('experimental-webgl');
        const max = gl?.getParameter(gl.MAX_TEXTURE_SIZE);
        if (!max) return void (r.textContent = 'WebGL未対応の環境です。');
        const p = document.createElement('p');
        Object.assign(p.style, {
            whiteSpace: 'pre',
            fontSize: '15px',
            color: '#000080',
            backgroundColor: '#C0C0C0',
            padding: '4px',
            border: '2px inset #808080',
        });
        r.appendChild(p);
        const maxPx = max ** 2;
        let prev = '';
        setInterval(() => {
            let total = 0;
            const els = document.body.getElementsByTagName('*');
            for (let i = 0, len = els.length; i < len; i++) {
                const el = els[i];
                if (!el.getBoundingClientRect || !el.offsetParent) continue;
                const s = getComputedStyle(el);
                if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) continue;
                const rect = el.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) continue;
                if (el.tagName === 'VIDEO' && (el.paused || el.ended)) continue;
                total += Math.floor(rect.width * rect.height * devicePixelRatio ** 2);
            }
            const usage = (total / maxPx) * 100;
            const warn = usage > 100 ? '⚠️ 上限超過！描画崩れ・パフォーマンス低下の可能性あり。'
                : usage > 80 ? '⚠️ 高負荷。ちらつき・遅延の恐れあり。'
                    : usage > 50 ? '⚠️ 負荷上昇中。描画のちらつきに注意。' : '';
            const filled = Math.min(Math.round(usage / 2), 50);
            let bar = '';
            for (let i = 0; i < 50; i++) {
                bar += `<span style="display:inline-block;width:10px;margin:1.5px;color:${i < filled ? '#000080' : 'gray'}">■</span>`;
            }
            const text = `GPU描画リソース使用率: ${usage.toFixed(1)}%\n[${bar}]\n${warn}`;
            if (text !== prev) p.innerHTML = prev = text;
        }, 1000);
    })();

    function nexser_setup() {
        setup.style.display = "block";
        setTimeout(() => noticewindow_create('Nexser Setup', "Nexser のセットアップを行います。", null, setup1, cancel_setup), 500);
    }
    function cancel_setup() {
        noticewindow_create('warning', "セットアップを中止しました!\n再ロードして最初からやり直してください", "nexser");
    }
    function setup1() {
        noticewindow_create('Nexser Setup', "どちらかをクリックしてください( OK: 個人向け NO: 仕事用 )", null, () => setup2(false), () => setup2(true));
    }
    function setup2(workMode) {
        if (workMode == true) {
            localStorage.setItem('work_deny', true);
        } else if (localStorage.getItem('work_deny')) {
            localStorage.removeItem('work_deny');
        }
        noticewindow_create('Nexser Setup', workMode ? "仕事用　でセットアップをしています..." : "個人向け　でセットアップをしています...");
        setTimeout(() => complete_setup(), 3000);
    }
    function complete_setup() {
        noticewindow_create('Nexser Setup', "セットアップが完了しました! 5秒後に再ロードします...");
        localStorage.setItem('setup', true);
        setTimeout(() => window.location.reload(), 5000);
    }

    let isResizing = 0; // 0: なし, 1: 下から, 2: 上から
    const resizers = [
        { el: 'task_resizer', direction: 1 },
        { el: 'task_resizer2', direction: 2 }
    ];
    resizers.forEach(({ el, direction }) => {
        document.getElementById(el).addEventListener('mousedown', () => {
            isResizing = direction;
            nex.style.cursor = 'ns-resize';
        });
    });
    nexser.addEventListener('mousemove', e => {
        if (!isResizing) return;
        const cursorY = e.clientY;
        const snapped = Math.round((isResizing === 1 ? window.innerHeight - cursorY : cursorY) / 40) * 40;
        const height = Math.min(280, Math.max(40, snapped));
        taskbar.style.height = `${height}px`;
        if (isResizing === 1) {
            desktop_version_text.style.top = "";
            toolbar.style.bottom = desktop_version_text.style.bottom = taskbar.style.height;
        } else {
            toolbar.style.top = desktop_version_text.style.top = taskbar.style.height;
            if (!localStorage.getItem('taskbar_autohide')) {
                files_inline.style.marginTop = `${taskbar.clientHeight}px`;
            }
        }
        localStorage.setItem('taskbar_height', height);
        if (localStorage.getItem('taskbar_autohide')) taskbar.style.bottom = "";
        bigwindow_resize();
    });
    nexser.addEventListener('mouseup', () => {
        isResizing = 0;
        nex.style.cursor = '';
    });

    function addprogram_window() {
        noticewindow_create("warning", "新しいプログラムファイルが選択されました。実行しますか？", null, () => restoreFromNex2(document.getElementById('file-input')), error_windows_close)
    }
    // addprogram
    const base64ToUtf8 = str => decodeURIComponent(escape(atob(str)));
    function restoreFromNex(input) {
        const file = input.files[0];
        if (!file || !file.name.endsWith('.nex')) return noticewindow_create("warning", "有効な.nexファイルを選択してください"), document.getElementById('restored-output').textContent = "", document.getElementById('filename').textContent = "", document.querySelector('.addbtn_program').classList.add('pointer_none');
        const reader = new FileReader();
        reader.onload = () => {
            const restoredCode = base64ToUtf8(reader.result);
            const size = new Blob([restoredCode]).size;
            document.getElementById('restored-output').textContent = `${size} バイト`;
            document.getElementById('filename').textContent = `${file.name} `;
            document.querySelector('.addbtn_program').classList.remove('pointer_none');
        };
        reader.readAsText(file);
    }
    function restoreFromNex2(input) {
        const file = input.files[0];
        if (!file || !file.name.endsWith('.nex')) return noticewindow_create("warning", "有効な.nexファイルを選択してください");
        const reader = new FileReader();
        reader.onload = () => {
            const restoredCode = base64ToUtf8(reader.result);
            try { eval(restoredCode); document.querySelector('.addbtn_program').classList.add('pointer_none'); } catch (e) { console.error('実行エラー:', e); }
        };
        reader.readAsText(file);
    }

    function windowpos_fix(win) {
        const rect = win.getBoundingClientRect();
        win.style.left = `${rect.left}px`;
        win.style.top = `${rect.top}px`;
        win.style.transform = "none";
    }

};