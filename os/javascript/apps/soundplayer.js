// soundplayer.js
import { FS, forceSave } from "../fs.js";
import { resolveFS } from "../fs-utils.js";
import { alertWindow } from "../window.js";
import { getFileContent } from "../fs-db.js";
import { FILE_ASSOCIATIONS } from "../file-associations.js";

export default function main(content, options) {
    let currentAudio = null;
    let currentVolume = 1.0;
    let isLooping = false;
    let searchQuery = "";

    const container = document.createElement("div");
    // Windows 95 スタイル（#c0c0c0背景、MS Sans Serifフォント、クラシックな余白）
    container.style.cssText = `
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        height: 100%;
        box-sizing: border-box;
        background: #c0c0c0;
        font-family: 'MS Sans Serif', Tahoma, sans-serif;
        font-size: 12px;
        color: #000000;
        user-select: none;
    `;

    container.innerHTML = `
        <!-- 上部コントロール行: 検索 & インポート -->
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px;">
            <div style="display: flex; align-items: center; gap: 4px; flex: 1;">
                <span style="white-space: nowrap;">検索:</span>
                <input type="text" id="search-input" class="border" placeholder="ファイル名..." style="flex: 1; padding: 2px 4px; font-size: 11px; outline: none;">
            </div>
            <input type="file" id="audio-input" accept=".mp3,.ogg,.wav,.m4a,.aac,.flac" style="display:none" multiple>
            <button id="upload-btn" style="cursor: pointer; font-size: 11px; white-space: nowrap;">インポート</button>
        </div>

        <!-- 音声プレイヤー・コントロールバー (Win95グループボックス風) -->
        <fieldset style="padding: 6px 8px; margin: 0; display: flex; align-items: center; gap: 10px; background: #c0c0c0;">
            <legend style="padding: 0 4px; color: #000000;">プレイヤー制御</legend>
            <div style="display: flex; align-items: center; gap: 4px;">
                <span>音量:</span>
                <input type="range" id="volume-slider" min="0" max="1" step="0.05" value="1" style="width: 70px; cursor: pointer;">
            </div>
            <div style="display: flex; align-items: center; gap: 4px;">
                <input type="checkbox" id="loop-checkbox" style="cursor: pointer;">
                <label for="loop-checkbox" style="cursor: pointer;">ループ</label>
            </div>
            <div style="margin-left: auto;">
                <button id="stop-all-btn" style="padding: 2px 6px; cursor: pointer; font-size: 11px;">全体停止</button>
            </div>
        </fieldset>

        <!-- ファイルリスト表示部 (Win95凹みコンテナ) -->
        <div id="player-list" class="border" style="flex: 1; overflow-y: auto;">
        </div>

        <div id="drop-zone-hint" style="font-size: 10px; color: #404040; text-align: center;">
            ※ 音声ファイルをウィンドウにドラッグ＆ドロップして追加できます
        </div>
    `;
    content.appendChild(container);

    const listEl = container.querySelector("#player-list");
    const inputEl = container.querySelector("#audio-input");
    const searchInput = container.querySelector("#search-input");
    const volumeSlider = container.querySelector("#volume-slider");
    const loopCheckbox = container.querySelector("#loop-checkbox");

    // --- 初期化処理 ---
    if (!FS.Programs.Music) FS.Programs.Music = { type: "folder" };
    if (!FS.System) FS.System = { type: "folder" };
    if (!FS.System["SoundConfig.json"]) {
        FS.System["SoundConfig.json"] = { type: "file", content: "{}" };
    }

    const isSystemMetaKey = (key) => {
        return key === "type" || key === "system" || key === "originalPath" || key === "entry" || key === "singleton" || key === "target";
    };

    // サブフォルダを再帰的に走査してファイルパス（folder/file.mp3）の配列を作る関数
    // file-associations.js から AudioPlayer.app が割り当てられている拡張子を自動取得[cite: 3]
    const audioExtensions = Object.keys(FILE_ASSOCIATIONS).filter(
        ext => FILE_ASSOCIATIONS[ext] === "Programs/Applications/AudioPlayer.app"
    );

    const collectAudioFiles = (node, currentPath = "", visited = new Set()) => {
        let files = [];
        if (!node || typeof node !== "object") return files;
        if (visited.has(node)) return visited;
        visited.add(node);

        for (const name in node) {
            if (isSystemMetaKey(name)) continue;
            const child = node[name];
            const fullPath = currentPath ? `${currentPath}/${name}` : name;

            if (child && child.type === "folder") {
                files = files.concat(collectAudioFiles(child, fullPath, visited));
            } else if (child && child.type === "file") {
                const lowerName = name.toLowerCase();
                // 音声用拡張子に一致するものだけをリストに追加[cite: 3]
                if (audioExtensions.some(ext => lowerName.endsWith(ext))) {
                    files.push(fullPath);
                }
            }
        }
        return files;
    };

    const refresh = () => {
        listEl.innerHTML = "";
        const musicNode = resolveFS("Programs/Music");
        if (!musicNode) return;

        let config = {};
        try {
            config = JSON.parse(FS.System["SoundConfig.json"].content || "{}");
        } catch (e) {
            config = {};
        }

        const files = collectAudioFiles(musicNode);
        const filteredFiles = files.filter(name => name.toLowerCase().includes(searchQuery.toLowerCase()));

        if (filteredFiles.length === 0) {
            listEl.innerHTML = `<div style="padding: 20px; text-align: center; color: #808080; font-size: 11px;">ファイルがありません</div>`;
            return;
        }

        filteredFiles.forEach(name => {
            const assignedEvents = Object.keys(config).filter(key => config[key] === name);
            const row = document.createElement("div");
            row.style.cssText = "padding: 6px 8px; border-bottom: 1px dotted #dfdfdf; display: flex; justify-content: space-between; align-items: center; background: #ffffff;";

            const statusText = assignedEvents.length > 0
                ? `<span style="font-size: 10px; background: #000080; color: #ffffff; padding: 1px 4px; margin-left: 6px; border-radius: 2px;">${assignedEvents.join(", ")}</span>`
                : "";

            row.innerHTML = `
                <div style="flex: 1; display: flex; align-items: center; overflow: hidden;">
                    <span style="font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${name}">${name}</span>
                    ${statusText}
                </div>
                <div style="display: flex; gap: 4px; align-items: center; margin-left: 8px;">
                    <button class="play-btn" data-name="${name}" style=" padding: 2px 6px; cursor: pointer; font-size: 10px;">再生</button>
                    <button class="stop-btn" style=" padding: 2px 6px; cursor: pointer; font-size: 10px;">停止</button>
                    <button class="delete-btn" data-name="${name}" style=" padding: 2px 6px; cursor: pointer; font-size: 10px;">削除</button>
                    <select class="event-assign border" data-filename="${name}" style="font-size: 11px;">
                        <option value="ignore">割当設定...</option>
                        <option value="" ${assignedEvents.length === 0 ? 'selected' : ''}>(なし)</option>
                        <option value="startup" ${config.startup === name ? 'selected' : ''}>起動音</option>
                        <option value="logoff" ${config.logoff === name ? 'selected' : ''}>ログオフ</option>
                        <option value="error" ${config.error === name ? 'selected' : ''}>エラー</option>
                        <option value="notify" ${config.notify === name ? 'selected' : ''}>通知</option>
                        <option value="minimize" ${config.minimize === name ? 'selected' : ''}>最小化</option>
                        <option value="maximize" ${config.maximize === name ? 'selected' : ''}>最大化</option>
                        <option value="restore" ${config.restore === name ? 'selected' : ''}>元に戻す</option>
                        <option value="resize" ${config.resize === name ? 'selected' : ''}>サイズ変更</option>
                        <option value="open" ${config.open === name ? 'selected' : ''}>ウィンドウの起動</option>
                        <option value="close" ${config.close === name ? 'selected' : ''}>ウィンドウを閉じる</option>
                    </select>
                </div>
            `;
            listEl.appendChild(row);
        });
    };

    // 検索入力
    searchInput.oninput = (e) => {
        searchQuery = e.target.value;
        refresh();
    };

    // 音量・ループ操作
    volumeSlider.oninput = (e) => {
        currentVolume = parseFloat(e.target.value);
        if (currentAudio) currentAudio.volume = currentVolume;
    };

    loopCheckbox.onchange = (e) => {
        isLooping = e.target.checked;
        if (currentAudio) currentAudio.loop = isLooping;
    };

    container.querySelector("#stop-all-btn").onclick = () => {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.src = "";
            currentAudio = null;
        }
    };

    // イベント割り当て変更
    listEl.onchange = (e) => {
        if (e.target.classList.contains("event-assign")) {
            const eventName = e.target.value;
            if (eventName === "ignore") return;

            const fileName = e.target.dataset.filename;
            let config = JSON.parse(FS.System["SoundConfig.json"].content || "{}");

            Object.keys(config).forEach(key => {
                if (config[key] === fileName) delete config[key];
            });

            if (eventName !== "") {
                config[eventName] = fileName;
            }

            FS.System["SoundConfig.json"].content = JSON.stringify(config, null, 2);
            refresh();
        }
    };

    container.querySelector("#upload-btn").onclick = () => inputEl.click();

    // ファイルインポート共通関数
    const handleFilesImport = async (files) => {
        if (!files || files.length === 0) return;

        const allowedExtensions = /(\.mp3|\.ogg|\.wav|\.m4a|\.aac|\.flac)$/i;
        const loadedFiles = {};

        for (const file of files) {
            if (!allowedExtensions.exec(file.name)) {
                alertWindow(`ファイル「${file.name}」はサポートされていない形式です。`);
                continue;
            }

            await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    loadedFiles[file.name] = {
                        type: "file",
                        subtype: "audio",
                        content: ev.target.result
                    };
                    resolve();
                };
                reader.readAsDataURL(file);
            });
        }

        Object.assign(FS.Programs.Music, loadedFiles);
        await forceSave?.();
        window.dispatchEvent(new Event("fs-updated"));
        refresh();
    };

    inputEl.onchange = async (e) => {
        await handleFilesImport(e.target.files);
        inputEl.value = "";
    };

    // ドラッグ＆ドロップ対応
    container.ondragover = (e) => { e.preventDefault(); };
    container.ondrop = async (e) => {
        e.preventDefault();
        if (e.dataTransfer && e.dataTransfer.files) {
            await handleFilesImport(e.dataTransfer.files);
        }
    };

    // 再生・停止・削除ロジック
    listEl.onclick = async (e) => {
        const path = e.target.dataset.name;

        // 再生ボタン
        if (e.target.classList.contains("play-btn")) {
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.src = "";
            }

            let fileNode = resolveFS(`Programs/Music/${path}`);
            if (!fileNode) {
                alertWindow("ファイルが見つかりませんでした。");
                return;
            }
            let audioData = fileNode.content;

            if (audioData === "__EXTERNAL_DATA__") {
                audioData = await getFileContent(`Programs/Music/${path}`);
            }

            if (!audioData) {
                alertWindow("データの取得に失敗しました。");
                return;
            }

            currentAudio = new Audio(audioData);
            currentAudio.volume = currentVolume;
            currentAudio.loop = isLooping;
            currentAudio.onended = () => {
                if (!currentAudio.loop) currentAudio = null;
            };
            currentAudio.play().catch(err => {
                console.error("Playback error:", err);
                alertWindow("再生に失敗しました。");
            });
        }

        // 停止ボタン
        if (e.target.classList.contains("stop-btn")) {
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.src = "";
                currentAudio = null;
            }
        }

        // 削除ボタン
        if (e.target.classList.contains("delete-btn")) {
            if (!path) return;
            if (currentAudio) {
                currentAudio.pause();
                currentAudio = null;
            }

            const parts = path.split("/");
            const fileName = parts.pop();
            const parentPath = parts.length > 0 ? `Programs/Music/${parts.join("/")}` : "Programs/Music";
            const parentNode = resolveFS(parentPath);

            if (parentNode && parentNode[fileName]) {
                delete parentNode[fileName];
            }

            let config = JSON.parse(FS.System["SoundConfig.json"].content || "{}");
            let changed = false;
            Object.keys(config).forEach(k => {
                if (config[k] === path) { delete config[k]; changed = true; }
            });
            if (changed) FS.System["SoundConfig.json"].content = JSON.stringify(config, null, 2);

            await forceSave?.();
            window.dispatchEvent(new Event("fs-updated"));
            refresh();
        }
    };

    refresh();

    return {
        isTabApp: false,
        dispose: () => {
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.src = "";
                currentAudio = null;
            }
            console.log("SoundPlayer disposed successfully.");
        }
    };
}