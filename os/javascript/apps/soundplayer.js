// soundplayer.js
import { FS, forceSave } from "../fs.js";
import { resolveFS } from "../fs-utils.js";
import { FILE_ASSOCIATIONS } from "../file-associations.js";

const SOUND_CONFIG_PATH = "C:/System/SoundConfig.json";

export default function main(content, options = {}) {
    const { syscall } = options;
    let isDisposed = false;
    let currentAudio = null;
    let currentVolume = 1.0;
    let isLooping = false;
    let searchQuery = "";

    const stopCurrentAudio = () => {
        if (!currentAudio) return;
        currentAudio.pause();
        currentAudio.onended = null;
        if (currentAudio.src && currentAudio.src.startsWith("blob:")) {
            URL.revokeObjectURL(currentAudio.src);
        }
        currentAudio.src = "";
        currentAudio = null;
    };

    const loadSoundConfig = async () => {
        try {
            const raw = syscall?.readFile ? await syscall.readFile(SOUND_CONFIG_PATH) : "{}";
            return JSON.parse(typeof raw === "string" && raw.trim() ? raw : "{}");
        } catch (err) {
            console.warn("[SoundPlayer] Failed to parse SoundConfig.json:", err);
            return {};
        }
    };

    const saveSoundConfig = async (config) => {
        if (!syscall?.writeFile) {
            throw new Error("syscall.writeFile が利用できません");
        }
        await syscall.writeFile(SOUND_CONFIG_PATH, JSON.stringify(config, null, 2));
    };

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
    if (!FS["C:"]) FS["C:"] = { type: "folder" };
    if (!FS["C:"].Programs) FS["C:"].Programs = { type: "folder" };
    if (!FS["C:"].Programs.Music) FS["C:"].Programs.Music = { type: "folder" };
    if (!FS["C:"].System) FS["C:"].System = { type: "folder" };
    if (!FS["C:"].System["SoundConfig.json"]) {
        FS["C:"].System["SoundConfig.json"] = { type: "file", content: "{}" };
    }

    const isSystemMetaKey = (key) => {
        return key === "type" || key === "system" || key === "originalPath" || key === "entry" || key === "singleton" || key === "target";
    };

    // サブフォルダを再帰的に走査してファイルパス（folder/file.mp3）の配列を作る関数
    const audioExtensions = Object.keys(FILE_ASSOCIATIONS).filter(
        ext => FILE_ASSOCIATIONS[ext] === "C:/Programs/Applications/AudioPlayer.app"
    );

    const collectAudioFiles = (node, currentPath = "", visited = new Set()) => {
        let files = [];
        if (!node || typeof node !== "object") return files;
        if (visited.has(node)) return [];
        visited.add(node);

        for (const name in node) {
            if (isSystemMetaKey(name)) continue;
            const child = node[name];
            const fullPath = currentPath ? `${currentPath}/${name}` : name;

            if (child && child.type === "folder") {
                files = files.concat(collectAudioFiles(child, fullPath, visited));
            } else if (child && child.type === "file") {
                const lowerName = name.toLowerCase();
                if (audioExtensions.some(ext => lowerName.endsWith(ext))) {
                    files.push(fullPath);
                }
            }
        }
        return files;
    };

    const refresh = async () => {
        const musicNode = resolveFS("C:/Programs/Music");
        if (!musicNode) return;

        const config = await loadSoundConfig();
        if (isDisposed) return;

        listEl.innerHTML = "";
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
        stopCurrentAudio();
    };

    // イベント割り当て変更
    listEl.onchange = async (e) => {
        if (e.target.classList.contains("event-assign")) {
            const eventName = e.target.value;
            if (eventName === "ignore") return;

            const fileName = e.target.dataset.filename;
            try {
                const config = await loadSoundConfig();
                Object.keys(config).forEach(key => {
                    if (config[key] === fileName) delete config[key];
                });

                if (eventName !== "") {
                    config[eventName] = fileName;
                }

                await saveSoundConfig(config);
                await refresh();
            } catch (err) {
                console.error("[SoundPlayer] Config save failed:", err);
                window.nexser?.windowAPI.alertWindow(`設定の保存に失敗しました: ${err.message}`, { title: "soundplayer" });
            }
        }
    };

    container.querySelector("#upload-btn").onclick = () => inputEl.click();

    // ファイルインポート共通関数 (syscall.writeFile経由・File/Blob直接保存)
    const handleFilesImport = async (files) => {
        if (!files || files.length === 0) return;
        if (!syscall?.writeFile) {
            window.nexser?.windowAPI.alertWindow("システムコール (syscall.writeFile) が利用できません。", { title: "soundplayer" });
            return;
        }

        const allowedExtensions = /(\.mp3|\.ogg|\.wav|\.m4a|\.aac|\.flac)$/i;

        for (const file of files) {
            if (!allowedExtensions.test(file.name)) {
                window.nexser?.windowAPI.alertWindow(`ファイル「${file.name}」はサポートされていない形式です。`, { title: "soundplayer" });
                continue;
            }

            try {
                await syscall.writeFile(`C:/Programs/Music/${file.name}`, file);
            } catch (err) {
                console.error(`[SoundPlayer] Import failed (${file.name}):`, err);
                window.nexser?.windowAPI.alertWindow(`インポートに失敗しました (${file.name}): ${err.message}`, { title: "soundplayer" });
            }
        }

        await refresh();
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
            stopCurrentAudio();

            if (!syscall?.readFile) {
                window.nexser?.windowAPI.alertWindow("システムコール (syscall.readFile) が利用できません。", { title: "soundplayer" });
                return;
            }

            const fullPath = `C:/Programs/Music/${path}`;
            let audioData = null;
            try {
                audioData = await syscall.readFile(fullPath);
            } catch (err) {
                console.error("[SoundPlayer] Read error:", err);
                window.nexser?.windowAPI.alertWindow(`データの取得に失敗しました: ${err.message}`, { title: "soundplayer" });
                return;
            }

            if (isDisposed) return;
            if (!audioData) {
                window.nexser?.windowAPI.alertWindow("ファイルが見つかりませんでした。", { title: "soundplayer" });
                return;
            }

            let audioSrc = "";
            if (audioData instanceof Blob || audioData instanceof File) {
                audioSrc = URL.createObjectURL(audioData);
            } else if (audioData instanceof ArrayBuffer || ArrayBuffer.isView(audioData)) {
                audioSrc = URL.createObjectURL(new Blob([audioData], { type: "audio/mpeg" }));
            } else if (typeof audioData === "string") {
                audioSrc = audioData;
            }

            currentAudio = new Audio(audioSrc);
            currentAudio.volume = currentVolume;
            currentAudio.loop = isLooping;
            currentAudio.onended = () => {
                if (!currentAudio?.loop) stopCurrentAudio();
            };
            currentAudio.play().catch(err => {
                console.error("Playback error:", err);
                stopCurrentAudio();
                window.nexser?.windowAPI.alertWindow("再生に失敗しました。", { title: "soundplayer" });
            });
        }

        // 停止ボタン
        if (e.target.classList.contains("stop-btn")) {
            stopCurrentAudio();
        }

        // 削除ボタン
        if (e.target.classList.contains("delete-btn")) {
            if (!path) return;
            stopCurrentAudio();

            const parts = path.split("/");
            const fileName = parts.pop();
            const parentPath = parts.length > 0 ? `C:/Programs/Music/${parts.join("/")}` : "C:/Programs/Music";
            const parentNode = resolveFS(parentPath);

            if (parentNode && parentNode[fileName]) {
                delete parentNode[fileName];
            }

            try {
                const config = await loadSoundConfig();
                let changed = false;
                Object.keys(config).forEach(k => {
                    if (config[k] === path) { delete config[k]; changed = true; }
                });
                if (changed) {
                    await saveSoundConfig(config);
                } else {
                    await forceSave?.();
                }
            } catch (err) {
                console.error("[SoundPlayer] Config cleanup failed:", err);
            }

            await refresh();
        }
    };

    refresh();

    return {
        isTabApp: false,
        dispose: () => {
            isDisposed = true;
            stopCurrentAudio();
            console.log("SoundPlayer disposed successfully.");
        }
    };
}