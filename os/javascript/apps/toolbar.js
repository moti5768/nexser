// toolbar.js
import { saveSetting, loadSetting } from "./settings.js";

export default function ToolbarApp(content, options) {
    if (!content) return;

    const win = content.parentElement;
    let unsubCreated = null;
    let unsubActivated = null;

    if (win) {
        win.classList.add("ime-toolbar-window");
        // 保存キャッシュによる上書きを防ぐため !important で強制固定（高さ40px・幅250px）
        win.style.setProperty('width', '250px', 'important');
        win.style.setProperty('height', '40px', 'important');
        win.style.setProperty('min-height', '40px', 'important');
        win.style.setProperty('max-height', '40px', 'important');

        // ⭐ 十分に大きな固定 z-index を付与（常に手前に表示され、ウィンドウシステムの邪魔もしない）
        win.style.setProperty('z-index', '99999', 'important');
    }

    // ⭐ 保存された位置と統合状態の非同期復元処理
    (async () => {
        const isIntegratedSaved = await loadSetting("toolbarIntegrated");
        const savedLeft = await loadSetting("toolbarLeft");
        const savedTop = await loadSetting("toolbarTop");

        if (isIntegratedSaved) {
            integrateIntoTaskbar();
        } else if (win) {
            let targetLeft = savedLeft;
            let targetTop = savedTop;

            if (targetLeft === null || targetTop === null) {
                // 保存データがない場合はタスクバーに被らない画面右下の初期位置を動的計算
                const winWidth = 250;
                const winHeight = 40;
                const margin = 0; // 画面端やタスクバーからの余白

                const taskbar = document.getElementById("taskbar");
                targetLeft = window.innerWidth - winWidth - margin;
                targetTop = window.innerHeight - winHeight - margin;

                if (taskbar) {
                    const tbRect = taskbar.getBoundingClientRect();
                    // タスクバーが下部にある場合
                    if (tbRect.top > 0 && tbRect.height < tbRect.width) {
                        targetTop = tbRect.top - winHeight - margin;
                    }
                    // タスクバーが上部にある場合
                    else if (tbRect.top <= 0 && tbRect.height < tbRect.width) {
                        targetTop = tbRect.bottom + margin;
                    }
                    // タスクバーが右側にある場合
                    else if (tbRect.left > 0 && tbRect.width < tbRect.height) {
                        targetLeft = tbRect.left - winWidth - margin;
                    }
                    // タスクバーが左側にある場合
                    else if (tbRect.left <= 0 && tbRect.width < tbRect.height) {
                        targetLeft = tbRect.right + margin;
                    }
                }
            }

            win.style.setProperty('left', `${Math.max(0, targetLeft)}px`, 'important');
            win.style.setProperty('top', `${Math.max(0, targetTop)}px`, 'important');
        }
    })();

    content.classList.add("scrollbar_none");
    content.style.boxSizing = "border-box";
    content.style.overflow = "hidden"; // スクロールバーを完全に隠す

    // クラシック風IMEツールバーのUI構築
    content.innerHTML = `
        <div class="ime-toolbar-inner border2" style="
            display: flex; 
            align-items: center; 
            height: 100%; 
            padding: 4px 6px; 
            gap: 5px; 
            background: #c0c0c0; 
            box-sizing: border-box;
            font-size: 12px; 
            font-family: 'MS Sans Serif', Tahoma, sans-serif;
            user-select: none;
            width: 100%;
            position: relative;
        ">
            <div class="ime-drag-handle button" style="
                padding: 0 6px; 
                background: #808080; 
                color: #ffffff; 
                font-weight: bold; 
                font-size: 11px; 
                line-height: 1;
                height: 28px;
                display: flex;
                align-items: center;
            " title="ドラッグして移動 / タスクバーにドロップで統合">::</div>
            
            <button class="ime-mode-btn toolbar-btn" style="
                padding: 0 8px; 
                font-weight: bold; 
                min-width: 40px; 
                height: 28px;
                font-size: 13px;
            " title="入力モード切替">あ</button>
            
            <button class="ime-kana-btn toolbar-btn" style="
                padding: 0 6px; 
                font-size: 11px; 
                height: 28px;
                min-width: 38px;
            " title="全角/半角切替">全/半</button>
            
            <button class="ime-setting-btn toolbar-btn" style="
                padding: 0 8px; 
                font-size: 12px; 
                height: 28px;
            " title="IMEプロパティ・設定">⚙</button>
        </div>
    `;

    // 共通のクラシックボタン用スタイルを注入（重複防止）
    const styleId = "ime-toolbar-styles";
    if (!document.getElementById(styleId)) {
        const styleEl = document.createElement("style");
        styleEl.id = styleId;
        styleEl.textContent = `
            .toolbar-btn {
                background: #c0c0c0;
                border: 1px solid;
                border-color: #ffffff #808080 #808080 #ffffff;
                color: #000000;
                cursor: pointer;
                box-sizing: border-box;
                display: flex;
                align-items: center;
                justify-content: center;
                line-height: 1;
            }
            .toolbar-btn:active, .toolbar-btn.pressed {
                border-color: #808080 #ffffff #ffffff #808080;
                padding-top: 1px;
                padding-left: 1px;
                background: #d4d0c8;
            }
            .ime-menu-popup {
                position: absolute;
                top: 42px;
                right: 5px;
                background: #c0c0c0;
                border: 2px solid;
                border-color: #ffffff #404040 #404040 #ffffff;
                box-shadow: 2px 2px 5px rgba(0,0,0,0.3);
                padding: 2px;
                z-index: 99999;
                font-family: 'MS Sans Serif', Tahoma, sans-serif;
                font-size: 11px;
                display: none;
            }
            .ime-menu-item {
                padding: 4px 16px 4px 12px;
                cursor: pointer;
                white-space: nowrap;
            }
            .ime-menu-item:hover {
                background: #000080;
                color: #ffffff;
            }
            .ime-menu-separator {
                height: 1px;
                background: #808080;
                border-bottom: 1px solid #ffffff;
                margin: 3px 2px;
            }
        `;
        document.head.appendChild(styleEl);
    }

    // 内部状態
    let isIntegrated = false;
    let integratedElement = null;
    let currentMode = "hiragana"; // 'hiragana' | 'katakana' | 'ascii'
    let isFullWidth = true;

    // 設定メニュー（ポップアップ）の作成
    const menuPopup = document.createElement("div");
    menuPopup.className = "ime-menu-popup";
    menuPopup.innerHTML = `
        <div class="ime-menu-item" data-action="pad">IME パッド(&P)</div>
        <div class="ime-menu-item" data-action="dict">単語登録(&D)</div>
        <div class="ime-menu-separator"></div>
        <div class="ime-menu-item" data-action="properties">プロパティ(&R)</div>
    `;
    content.querySelector(".ime-toolbar-inner").appendChild(menuPopup);

    const modeBtn = content.querySelector(".ime-mode-btn");
    const kanaBtn = content.querySelector(".ime-kana-btn");
    const settingBtn = content.querySelector(".ime-setting-btn");

    // モード更新をアクティブ要素へ通知する関数
    function updateImeState(notifyGlobal = true) {
        if (currentMode === "hiragana") {
            modeBtn.textContent = isFullWidth ? "あ" : "a";
        } else if (currentMode === "katakana") {
            modeBtn.textContent = isFullWidth ? "カ" : "ｶ";
        } else {
            modeBtn.textContent = "A";
        }

        kanaBtn.textContent = isFullWidth ? "全角" : "半角";
        kanaBtn.classList.toggle("pressed", !isFullWidth);

        if (integratedElement) {
            const tbModeBtn = integratedElement.querySelector(".ime-mode-btn-tb");
            if (tbModeBtn) tbModeBtn.textContent = modeBtn.textContent;
        }

        if (notifyGlobal) {
            const activeEl = document.activeElement;
            if (activeEl) {
                activeEl.dispatchEvent(new CustomEvent("imeModeChange", {
                    detail: { mode: currentMode, isFullWidth }
                }));
            }
        }
    }

    // モードボタンクリック: ひらがな ⇄ カタカナ ⇄ 英数 の循環
    modeBtn.onclick = (e) => {
        e.stopPropagation();
        closeMenu();
        if (currentMode === "hiragana") {
            currentMode = "katakana";
        } else if (currentMode === "katakana") {
            currentMode = "ascii";
        } else {
            currentMode = "hiragana";
            isFullWidth = true;
        }
        updateImeState();
    };

    // 全/半角ボタンクリック
    kanaBtn.onclick = (e) => {
        e.stopPropagation();
        closeMenu();
        isFullWidth = !isFullWidth;
        updateImeState();
    };

    // 設定ボタンクリック（メニュー開閉）
    settingBtn.onclick = (e) => {
        e.stopPropagation();
        const isVisible = menuPopup.style.display === "block";
        menuPopup.style.display = isVisible ? "none" : "block";
    };

    // メニュー項目クリック時の処理
    menuPopup.onclick = (e) => {
        e.stopPropagation();
        const action = e.target.getAttribute("data-action");
        if (action) {
            console.log(`IME Menu Action: ${action}`);
            alert(`[IME模擬機能] ${e.target.textContent} が選択されました。`);
        }
        closeMenu();
    };

    function closeMenu() {
        menuPopup.style.display = "none";
    }

    // 外部クリックでメニューを閉じる
    const onDocumentClick = () => closeMenu();
    document.addEventListener("click", onDocumentClick);

    // ============================
    // IMEの変換状態（composition）の監視
    // ============================
    const onCompositionStart = () => {
        modeBtn.style.borderColor = "#000080";
    };
    const onCompositionEnd = () => {
        modeBtn.style.borderColor = "";
    };
    document.addEventListener("compositionstart", onCompositionStart);
    document.addEventListener("compositionend", onCompositionEnd);

    // ============================
    // ドラッグ移動 ＆ タスクバー統合・分離ロジック
    // ============================
    const handle = content.querySelector(".ime-drag-handle");
    let isDragging = false;
    let startX = 0, startY = 0;
    let lastOffsetX = 0; // ウィンドウ上のどの位置を掴んでいたかのオフセットを保持

    function checkTaskbarIntersection(clientX, clientY) {
        const taskbar = document.getElementById("taskbar");
        if (!taskbar) return false;
        const rect = taskbar.getBoundingClientRect();
        return (
            clientX >= rect.left &&
            clientX <= rect.right &&
            clientY >= rect.top &&
            clientY <= rect.bottom
        );
    }

    // ウィンドウドラッグ処理を共通関数化
    function startWindowDrag(clientX, clientY, customOffsetX = null) {
        isDragging = true;
        startX = clientX;
        startY = clientY;

        const winWidth = win ? (win.offsetWidth || 250) : 250;
        const winHeight = win ? (win.offsetHeight || 40) : 40;

        // はみ出る前の有効な位置を保持する変数（初期位置をセット）
        let lastValidLeft = win ? parseFloat(win.style.left) || 0 : 0;
        let lastValidTop = win ? parseFloat(win.style.top) || 0 : 0;

        if (win) {
            window.nexser?.windowAPI?.bringToFront(win);
            const rect = win.getBoundingClientRect();
            lastOffsetX = customOffsetX !== null ? customOffsetX : (clientX - rect.left);
        }

        const onPointerMove = (moveEv) => {
            if (!isDragging) return;
            const dx = moveEv.clientX - startX;
            const dy = moveEv.clientY - startY;

            if (!isIntegrated && win) {
                const curLeft = parseFloat(win.style.left) || 0;
                const curTop = parseFloat(win.style.top) || 0;

                let newLeft = curLeft + dx;
                let newTop = curTop + dy;

                // ⭐ 縦方向（上下）のタスクバーや画面外へのハミ出し防止制限
                if (newTop < 0) newTop = 0;

                const taskbar = document.getElementById("taskbar");
                if (taskbar) {
                    const tbRect = taskbar.getBoundingClientRect();

                    // 下部タスクバーの場合、タスクバーより下へ移動させない
                    if (tbRect.top > 0 && tbRect.top < window.innerHeight && tbRect.height < tbRect.width) {
                        if (newTop + winHeight > tbRect.top) {
                            newTop = tbRect.top - winHeight;
                        }
                    }
                    // 上部タスクバーの場合、タスクバーより上へ移動させない
                    else if (tbRect.top <= 0 && tbRect.height < tbRect.width) {
                        if (newTop < tbRect.bottom) {
                            newTop = tbRect.bottom;
                        }
                    }
                }

                // ⭐ 横方向（左右）は制限せず、自由にハミ出して動かせるようにする
                win.style.left = `${newLeft}px`;
                win.style.top = `${newTop}px`;
                startX = moveEv.clientX;
                startY = moveEv.clientY;

                // ⭐ ツールバー本体が画面の横方向（左右）に完全に収まっている場合は、「安全な位置」として常時更新
                if (newLeft >= 0 && newLeft + winWidth <= window.innerWidth) {
                    lastValidLeft = newLeft;
                    lastValidTop = newTop;
                }

                // mousemove中にもタスクバーとの交差を判定し、重なったら即時統合する
                if (checkTaskbarIntersection(moveEv.clientX, moveEv.clientY)) {
                    isDragging = false;
                    document.removeEventListener("pointermove", onPointerMove);
                    document.removeEventListener("pointerup", onPointerUp);
                    integrateIntoTaskbar(true, moveEv);
                    return;
                }
            }
        };

        const onPointerUp = (upEv) => {
            if (!isDragging) return;
            isDragging = false;
            document.removeEventListener("pointermove", onPointerMove);
            document.removeEventListener("pointerup", onPointerUp);

            if (!isIntegrated && win) {
                const currentLeft = parseFloat(win.style.left) || 0;

                // ⭐ mouseupした時に画面の横方向（左右）からはみ出ていたら、はみ出る前の安全な位置に戻す
                if (currentLeft < 0 || currentLeft + winWidth > window.innerWidth) {
                    win.style.left = `${lastValidLeft}px`;
                    win.style.top = `${lastValidTop}px`;
                }

                // ドラッグ終了時（または復元後）の位置を保存
                saveSetting("toolbarLeft", parseFloat(win.style.left) || 0);
                saveSetting("toolbarTop", parseFloat(win.style.top) || 0);
            }

            if (!isIntegrated && checkTaskbarIntersection(upEv.clientX, upEv.clientY)) {
                integrateIntoTaskbar();
            }
        };

        document.addEventListener("pointermove", onPointerMove);
        document.addEventListener("pointerup", onPointerUp);
    }

    handle.addEventListener("pointerdown", (e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        e.stopPropagation();
        closeMenu();
        const rect = handle.getBoundingClientRect();
        const winRect = win.getBoundingClientRect();
        const handleOffsetFromWin = rect.left - winRect.left;
        const clickOffsetInHandle = e.clientX - rect.left;
        startWindowDrag(e.clientX, e.clientY, handleOffsetFromWin + clickOffsetInHandle);
    });

    function integrateIntoTaskbar(isDraggingContinuation = false, moveEv = null) {
        const taskbar = document.getElementById("taskbar");
        if (!taskbar) return;
        const trayArea = taskbar.querySelector(".taskbar-tray") || taskbar;

        isIntegrated = true;
        saveSetting("toolbarIntegrated", true); // ⭐ 統合状態を保存

        if (win) {
            win.style.display = "none";
        }

        integratedElement = document.createElement("div");
        integratedElement.className = "taskbar-ime-toolbar";
        Object.assign(integratedElement.style, {
            display: "flex",
            alignItems: "center",
            gap: "2px",
            padding: "0 3px",
            border: "1px inset #fff",
            background: "#c0c0c0",
            fontSize: "11px",
            userSelect: "none",
            height: "24px",
            boxSizing: "border-box"
        });

        integratedElement.innerHTML = `
            <span class="ime-detach-handle" style="cursor: move; font-size: 9px; padding: 0 2px; color: #404040;" title="ドラッグして分離">::</span>
            <button class="ime-mode-btn-tb toolbar-btn" style="font-size: 10px; padding: 0 4px; font-weight: bold; height: 18px;">${modeBtn.textContent}</button>
        `;

        const tbModeBtn = integratedElement.querySelector(".ime-mode-btn-tb");
        tbModeBtn.onclick = () => {
            currentMode = currentMode === "hiragana" ? "ascii" : "hiragana";
            updateImeState();
        };

        const detachHandle = integratedElement.querySelector(".ime-detach-handle");

        const startDetaching = () => {
            let isDetaching = true;

            const onDetachMove = (mEv) => {
                if (!isDetaching) return;

                // タスクバー外に出たかを判定し、即時切り離す
                if (!checkTaskbarIntersection(mEv.clientX, mEv.clientY)) {
                    isDetaching = false;
                    document.removeEventListener("pointermove", onDetachMove);
                    document.removeEventListener("pointerup", onDetachUp);
                    detachFromTaskbar(mEv.clientX, mEv.clientY, true, mEv);
                    return;
                }
            };

            const onDetachUp = (uEv) => {
                if (!isDetaching) return;
                isDetaching = false;
                document.removeEventListener("pointermove", onDetachMove);
                document.removeEventListener("pointerup", onDetachUp);

                if (!checkTaskbarIntersection(uEv.clientX, uEv.clientY)) {
                    detachFromTaskbar(uEv.clientX, uEv.clientY, false);
                }
            };

            document.addEventListener("pointermove", onDetachMove);
            document.addEventListener("pointerup", onDetachUp);
        };

        detachHandle.addEventListener("pointerdown", (e) => {
            if (e.pointerType === "mouse" && e.button !== 0) return;
            e.stopPropagation();
            lastOffsetX = 15;
            startDetaching();
        });

        trayArea.appendChild(integratedElement);

        // mousemove中のドラッグからそのまま統合された場合、即座に分離監視を開始する
        if (isDraggingContinuation && moveEv) {
            startDetaching();
        }
    }

    function detachFromTaskbar(clientX, clientY, resumeDrag = false, moveEv = null) {
        if (!isIntegrated) return;
        isIntegrated = false;
        saveSetting("toolbarIntegrated", false); // ⭐ ウィンドウモード（非統合）状態を保存

        if (integratedElement) {
            integratedElement.remove();
            integratedElement = null;
        }

        if (win) {
            win.style.display = "block";
            const newLeft = Math.max(0, clientX - lastOffsetX);
            const newTop = Math.max(0, clientY - 20);
            win.style.left = `${newLeft}px`;
            win.style.top = `${newTop}px`;

            // ⭐ 分離時の位置を保存
            saveSetting("toolbarLeft", newLeft);
            saveSetting("toolbarTop", newTop);

            window.nexser?.windowAPI?.bringToFront(win);

            // 切り離した瞬間にマウスボタンが押されたままであれば、正確なオフセットを引き継いでドラッグ状態を再開する
            if (resumeDrag && moveEv) {
                startWindowDrag(moveEv.clientX, moveEv.clientY, lastOffsetX);
            }
        }
    }

    // 初期状態の反映
    updateImeState(false);

    return {
        dispose: () => {
            document.removeEventListener("click", onDocumentClick);
            document.removeEventListener("compositionstart", onCompositionStart);
            document.removeEventListener("compositionend", onCompositionEnd);
            if (integratedElement) integratedElement.remove();
            if (menuPopup) menuPopup.remove();
            console.log("Toolbar app resources released completely.");
        }
    };
}