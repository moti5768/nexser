// soundplayer.js
import { FS } from "../fs.js";
import { alertWindow } from "../window.js";

export default function main(content, options) {
    // 再生中のオーディオオブジェクトを保持する変数
    let currentAudio = null;

    const container = document.createElement("div");
    // 全体の背景を少し落ち着いた色にし、フォントを調整
    container.style.cssText = "padding:12px; display:flex; flex-direction:column; gap:10px; height:100%; box-sizing:border-box; background:#f5f5f5; font-family: sans-serif; color: black;";

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:10px; border-bottom:1px solid #ccc;">
            <div style="font-weight:bold; font-size:14px;">サウンド設定</div>
            <input type="file" id="audio-input" accept=".mp3,.ogg,.wav,.m4a,.aac,.flac" style="display:none" multiple>
            <button id="upload-btn" style="padding:4px 12px; cursor:pointer;">音声をインポート</button>
        </div>
        <div id="player-list" style="flex:1; overflow-y:auto; background:#fff; border:1px solid #999;">
        </div>
    `;
    content.appendChild(container);

    const listEl = container.querySelector("#player-list");
    const inputEl = container.querySelector("#audio-input");

    // --- 初期化処理 ---
    if (!FS.Programs.Music) FS.Programs.Music = { type: "folder" };
    if (!FS.System) FS.System = { type: "folder" };
    if (!FS.System["SoundConfig.json"]) {
        FS.System["SoundConfig.json"] = { type: "file", content: "{}" };
    }

    const refresh = () => {
        listEl.innerHTML = "";
        const music = FS.Programs.Music;

        // 安全にJSONをパース
        let config = {};
        try {
            config = JSON.parse(FS.System["SoundConfig.json"].content || "{}");
        } catch (e) {
            config = {};
        }

        const files = Object.keys(music).filter(name => name !== "type");

        if (files.length === 0) {
            listEl.innerHTML = `<div style="padding:20px; text-align:center; color:#888; font-size:12px;">ファイルがありません</div>`;
            return;
        }

        files.forEach(name => {
            // 現在このファイルがどのイベントに設定されているか確認
            const assignedEvents = Object.keys(config).filter(key => config[key] === name);

            const row = document.createElement("div");
            row.style.cssText = "padding:8px 12px; border-bottom:1px solid #ccc; display:flex; justify-content:space-between; align-items:center;";

            const statusText = assignedEvents.length > 0
                ? `<span style="font-size:10px; background:#e1f5fe; border:1px solid #b3e5fc; padding:2px 5px; margin-left:8px; color:#0277bd; border-radius:3px;">${assignedEvents.join(", ")}</span>`
                : "";

            row.innerHTML = `
                <div style="flex:1; display:flex; align-items:center; overflow:hidden;">
                    <span style="font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${name}">${name}</span>
                    ${statusText}
                </div>
                <div style="display:flex; gap:6px; align-items:center; margin-left:10px;">
                    <button class="play-btn" data-name="${name}" style="padding:2px 8px; cursor:pointer; font-size:11px;">再生</button>
                    <button class="stop-btn" style="padding:2px 8px; cursor:pointer; font-size:11px;">停止</button>
                    <button class="delete-btn" data-name="${name}" style="padding:2px 8px; cursor:pointer; font-size:11px; background:#fff; border:1px solid #ccc;">削除</button>
                    <select class="event-assign" data-filename="${name}" style="font-size:11px; padding:1px;">
                        <option value="ignore">イベントに設定</option>
                        <option value="" ${assignedEvents.length === 0 ? 'selected' : ''}>(なし)</option>
                        <option value="startup" ${config.startup === name ? 'selected' : ''}>起動音</option>
                        <option value="logoff" ${config.logoff === name ? 'selected' : ''}>ログオフ</option>
                        <option value="error" ${config.error === name ? 'selected' : ''}>エラー</option>
                        <option value="notify" ${config.notify === name ? 'selected' : ''}>通知</option>
                    </select>
                </div>
            `;
            listEl.appendChild(row);
        });
    };

    // イベント変更
    listEl.onchange = (e) => {
        if (e.target.classList.contains("event-assign")) {
            const eventName = e.target.value;
            if (eventName === "ignore") return;

            const fileName = e.target.dataset.filename;
            let config = JSON.parse(FS.System["SoundConfig.json"].content || "{}");

            // 同一ファイル内の他の割り当てを消す（排他的設定を維持）
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
    // soundplayer.js のアップロード部分の修正案

    inputEl.onchange = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const allowedExtensions = /(\.mp3|\.ogg|\.wav|\.m4a|\.aac|\.flac)$/i;

        // 1. 一時的なオブジェクトに読み込み結果を格納する
        const loadedFiles = {};

        for (const file of files) {
            if (!allowedExtensions.exec(file.name)) {
                alertWindow(`ファイル「${file.name}」はサポートされていない形式です。`);
                continue;
            }

            await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    // ここではまだ FS に代入せず、一時変数に保持
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

        // 2. すべてのファイルの読み込み完了後、一気に FS へ反映
        // これにより、fs.js の Proxy による保存（saveFS）の実行回数を 1回 に抑え、
        // 処理中のデータ競合（破損）を防ぎます。
        Object.assign(FS.Programs.Music, loadedFiles);

        inputEl.value = "";
        refresh();
    };

    // 再生・停止・削除ロジック
    listEl.onclick = (e) => {
        const name = e.target.dataset.name;

        // 再生ボタン
        if (e.target.classList.contains("play-btn")) {
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
            }
            const data = FS.Programs.Music[name].content;
            currentAudio = new Audio(data);

            // 再生終了時のクリーンアップ
            currentAudio.onended = () => { currentAudio = null; };
            currentAudio.play().catch(err => {
                console.error("Playback error:", err);
                alertWindow("再生に失敗しました。ファイルが破損している可能性があります。");
            });
        }

        // 停止ボタン
        if (e.target.classList.contains("stop-btn")) {
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
                currentAudio = null;
            }
        }

        // 削除ボタン
        if (e.target.classList.contains("delete-btn")) {
            if (!name) return;

            if (currentAudio) {
                currentAudio.pause();
                currentAudio = null;
            }

            delete FS.Programs.Music[name];
            let config = JSON.parse(FS.System["SoundConfig.json"].content || "{}");
            let changed = false;
            Object.keys(config).forEach(k => {
                if (config[k] === name) { delete config[k]; changed = true; }
            });
            if (changed) FS.System["SoundConfig.json"].content = JSON.stringify(config, null, 2);
            refresh();
        }
    };

    refresh();
}