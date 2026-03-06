// AudioPlayer.js
import { FS } from "../fs.js";
import { getFileContent } from "../fs-db.js";
import { alertWindow, updateWindowTitle } from "../window.js";

/**
 * 高機能オーディオプレーヤー（安定動作・シーク戻り完全修正版）
 */
export default function main(content, options) {
    let currentAudio = null;
    let updateTimer = null;
    let isDragging = false;
    let isLoading = false;
    let currentPath = options?.path || null;
    let currentVolume = 0.7;

    let playMode = 0;
    const modeLabels = ["OFF", "全曲", "1曲"];
    const modeColors = ["#888", "#1db954", "#3498db"];

    const win = content.parentElement;
    const titleTextEl = win?.querySelector(".title-text");

    if (win && win.classList.contains("window")) {
        win.style.height = "260px";
    }

    const container = document.createElement("div");
    container.style.cssText = `
        padding: 15px; 
        display: flex; 
        flex-direction: column; 
        gap: 12px; 
        background: #1a1a1a; 
        color: #eee; 
        height: 100%; 
        box-sizing: border-box; 
        font-family: 'Segoe UI', sans-serif;
        user-select: none;
    `;

    container.innerHTML = `
        <div id="display-name" style="font-size: 13px; color: #1db954; font-weight: bold; text-align: center; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; min-height: 1.2em;">
            楽曲を選択してください
        </div>
        
        <div style="display: flex; align-items: center; gap: 8px;">
            <span id="cur-time" style="font-size: 11px; min-width: 35px; text-align: right;">0:00</span>
            <input type="range" id="progress-bar" value="0" max="100" step="0.1" style="flex: 1; cursor: pointer; accent-color: #1db954; touch-action: none;">
            <span id="dur-time" style="font-size: 11px; min-width: 35px;">0:00</span>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0 5px;">
            <div id="volume-container" style="position: relative; width: 30px; display: flex; justify-content: center;">
                <span id="vol-icon" style="cursor: pointer; font-size: 14px;">🔊</span>
                <input type="range" id="vol-slider" min="0" max="1" step="0.01" value="0.7" style="position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%) rotate(-90deg); transform-origin: bottom center; width: 80px; display: none; accent-color: #1db954; cursor: pointer; touch-action: none;">
            </div>

            <div style="display: flex; align-items: center; gap: 12px;">
                <button id="btn-prev" style="background: transparent; border: none; color: #ccc; cursor: pointer; font-size: 16px;">⏮</button>
                <button id="btn-play" style="width: 45px; height: 45px; border-radius: 50%; border: none; background: #fff; cursor: pointer; color: #000; font-size: 18px; display: flex; align-items: center; justify-content: center;">▶</button>
                <button id="btn-next" style="background: transparent; border: none; color: #ccc; cursor: pointer; font-size: 16px;">⏭</button>
            </div>

            <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                <button id="btn-mode" style="background: #333; border: 1px solid #444; color: #888; cursor: pointer; border-radius: 4px; font-size: 9px; padding: 2px 5px; min-width: 55px; transition: 0.2s;">モード: OFF</button>
                <button id="btn-stop" style="padding: 4px 10px; border: 1px solid #444; background: transparent; color: #888; cursor: pointer; border-radius: 12px; font-size: 10px;">一時停止</button>
            </div>
        </div>
    `;
    content.appendChild(container);

    const titleEl = container.querySelector("#display-name");
    const progressEl = container.querySelector("#progress-bar");
    const playBtn = container.querySelector("#btn-play");
    const stopBtn = container.querySelector("#btn-stop");
    const prevBtn = container.querySelector("#btn-prev");
    const nextBtn = container.querySelector("#btn-next");
    const modeBtn = container.querySelector("#btn-mode");
    const curTimeEl = container.querySelector("#cur-time");
    const durTimeEl = container.querySelector("#dur-time");
    const volIcon = container.querySelector("#vol-icon");
    const volSlider = container.querySelector("#vol-slider");

    const cleanupAudio = () => {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.onended = null;
            currentAudio.onerror = null;
            currentAudio.onplay = null;
            currentAudio.onpause = null;
            currentAudio.onloadedmetadata = null;
            if (currentAudio.src.startsWith("blob:")) {
                URL.revokeObjectURL(currentAudio.src);
            }
            currentAudio.src = "";
            try { currentAudio.load(); } catch (e) { }
            currentAudio = null;
        }
        if (updateTimer) {
            clearInterval(updateTimer);
            updateTimer = null;
        }
    };

    const formatTime = (sec) => {
        if (isNaN(sec) || sec < 0) return "0:00";
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const updateUI = () => {
        // ドラッグ中、または「指を離した直後の同期中」はUI更新をスキップ
        if (!currentAudio || isDragging || isNaN(currentAudio.duration)) return;
        const per = (currentAudio.currentTime / currentAudio.duration) * 100;
        progressEl.value = per || 0;
        curTimeEl.innerText = formatTime(currentAudio.currentTime);
        progressEl.style.background = `linear-gradient(to right, #1db954 ${per}%, #444 ${per}%)`;
    };

    const getSongList = () => Object.keys(FS.Programs.Music).filter(k => k !== "type");

    const changeSong = (direction) => {
        const songs = getSongList();
        if (songs.length === 0) return;
        const currentFileName = currentPath ? currentPath.split("/").pop() : null;
        let idx = songs.indexOf(currentFileName);

        if (direction === "next") {
            idx = (idx + 1) % songs.length;
        } else {
            if (currentAudio && currentAudio.currentTime > 3) {
                currentAudio.currentTime = 0;
                return;
            }
            idx = (idx - 1 + songs.length) % songs.length;
        }
        loadAndPlay(songs[idx]);
    };

    const loadAndPlay = async (pathOrName) => {
        if (isLoading) return;
        isLoading = true;
        cleanupAudio();

        const fileName = pathOrName.split("/").pop();
        currentPath = `Programs/Music/${fileName}`;

        const fileNode = FS.Programs.Music[fileName];
        if (!fileNode) {
            alertWindow(`ファイルが見つかりません: ${fileName}`);
            isLoading = false;
            return;
        }

        let audioData = fileNode.content;
        if (audioData === "__EXTERNAL_DATA__") {
            audioData = await getFileContent(currentPath);
        }

        if (!audioData) {
            alertWindow("再生データの読み込みに失敗しました。");
            isLoading = false;
            return;
        }

        try {
            currentAudio = new Audio(audioData);
            currentAudio.volume = currentVolume; // ★保存しておいた音量を適用
            volSlider.value = currentVolume;    // ★スライダーのつまみの位置も合わせる
            if (titleEl) titleEl.innerText = fileName;
            updateWindowTitle(win, fileName, false);

            currentAudio.onloadedmetadata = () => {
                durTimeEl.innerText = formatTime(currentAudio.duration);
                updateUI();
            };

            currentAudio.onplay = () => {
                playBtn.innerText = "⏸";
                playBtn.style.background = "#1db954";
                if (!updateTimer) updateTimer = setInterval(updateUI, 100);
            };

            currentAudio.onpause = () => {
                playBtn.innerText = "▶";
                playBtn.style.background = "#fff";
            };

            currentAudio.onended = () => {
                if (playMode === 1) {
                    changeSong("next");
                } else if (playMode === 2) {
                    currentAudio.currentTime = 0;
                    currentAudio.play();
                } else {
                    playBtn.innerText = "▶";
                    playBtn.style.background = "#fff";
                    if (updateTimer) {
                        clearInterval(updateTimer);
                        updateTimer = null;
                    }
                }
            };

            await currentAudio.play();
        } catch (e) {
            console.error("Playback failed", e);
        } finally {
            isLoading = false;
        }
    };

    modeBtn.onclick = () => {
        playMode = (playMode + 1) % 3;
        modeBtn.innerText = `モード: ${modeLabels[playMode]}`;
        modeBtn.style.color = modeColors[playMode];
        modeBtn.style.borderColor = modeColors[playMode];
    };

    playBtn.onclick = () => {
        if (!currentAudio) {
            const songs = getSongList();
            if (songs.length > 0) loadAndPlay(songs[0]);
            return;
        }
        currentAudio.paused ? currentAudio.play() : currentAudio.pause();
    };

    stopBtn.onclick = () => { if (currentAudio) currentAudio.pause(); };
    nextBtn.onclick = () => changeSong("next");
    prevBtn.onclick = () => changeSong("prev");

    volIcon.onclick = () => {
        volSlider.style.display = volSlider.style.display === "none" ? "block" : "none";
    };

    volSlider.oninput = () => {
        const val = parseFloat(volSlider.value);
        if (currentAudio) currentAudio.volume = val;
        volIcon.innerText = val === 0 ? "🔇" : val < 0.5 ? "🔉" : "🔊";
    };
    window.addEventListener("click", (e) => {
        if (e.target !== volIcon && e.target !== volSlider) {
            volSlider.style.display = "none";
        }
    });

    // --- シークバー（動いていた元のロジック + タッチ対応 + 戻り防止） ---
    const startDragging = () => { isDragging = true; };

    const endDragging = () => {
        if (isDragging && currentAudio && !isNaN(currentAudio.duration)) {
            currentAudio.currentTime = (progressEl.value / 100) * currentAudio.duration;
            // 指を離してから 150ms の間は updateUI をブロックし続ける（重要：これで戻るのを防ぐ）
            setTimeout(() => { isDragging = false; }, 150);
        } else {
            isDragging = false;
        }
    };

    // マウスとタッチ両方の開始を検知
    progressEl.onmousedown = startDragging;
    progressEl.ontouchstart = startDragging;

    // スライド中の表示更新
    progressEl.oninput = () => {
        if (currentAudio && !isNaN(currentAudio.duration)) {
            const per = progressEl.value;
            curTimeEl.innerText = formatTime((per / 100) * currentAudio.duration);
            progressEl.style.background = `linear-gradient(to right, #1db954 ${per}%, #444 ${per}%)`;
        }
    };

    // マウスとタッチ両方の終了を検知
    progressEl.onmouseup = endDragging;
    progressEl.ontouchend = endDragging;

    // 万が一バーの外で離した場合のセーフティ
    const globalHandleUp = () => { if (isDragging) endDragging(); };
    window.addEventListener("mouseup", globalHandleUp);
    window.addEventListener("touchend", globalHandleUp);

    if (currentPath) loadAndPlay(currentPath);

    const observer = new MutationObserver(() => {
        if (!document.body.contains(container)) {
            cleanupAudio();
            window.removeEventListener("mouseup", globalHandleUp);
            window.removeEventListener("touchend", globalHandleUp);
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}