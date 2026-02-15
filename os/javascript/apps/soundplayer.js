//soundplayer.js
import { FS } from "../fs.js";
import { alertWindow } from "../window.js";

export default function main(content, options) {
    const container = document.createElement("div");
    // 全体の背景を少し落ち着いた色にし、フォントを調整
    container.style.cssText = "padding:12px; display:flex; flex-direction:column; gap:10px; height:100%; box-sizing:border-box; background:#f5f5f5; font-family: sans-serif; color: black;";

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:10px; border-bottom:1px solid #ccc;">
            <div style="font-weight:bold; font-size:14px;">サウンド設定</div>
            <input type="file" id="audio-input" accept=".mp3,.ogg,.wav" style="display:none" multiple>
            <button id="upload-btn" style="padding:4px 12px; cursor:pointer;">音声をインポート</button>
        </div>
        <div id="player-list" style="flex:1; overflow-y:auto; background:#fff; border:1px solid #999;">
        </div>
    `;
    content.appendChild(container);

    const listEl = container.querySelector("#player-list");
    const inputEl = container.querySelector("#audio-input");

    if (!FS.Programs.Music) FS.Programs.Music = { type: "folder" };

    const refresh = () => {
        listEl.innerHTML = "";
        const music = FS.Programs.Music;
        const config = JSON.parse(FS.System["SoundConfig.json"].content || "{}");

        const files = Object.keys(music).filter(name => name !== "type");

        if (files.length === 0) {
            listEl.innerHTML = `<div style="padding:20px; text-align:center; color:#888; font-size:12px;">ファイルがありません</div>`;
            return;
        }

        files.forEach(name => {
            // 現在このファイルがどのイベントに設定されているか確認（バッジ用）
            const assignedEvents = Object.keys(config).filter(key => config[key] === name);

            const row = document.createElement("div");
            row.style.cssText = "padding:8px 12px; border-bottom:1px solid #ccc; display:flex; justify-content:space-between; align-items:center;";

            // 割り当てがある場合はイベント名を表示
            const statusText = assignedEvents.length > 0
                ? `<span style="font-size:10px; background:#eee; padding:2px 5px; margin-left:8px; color:#666;">${assignedEvents.join(", ")}</span>`
                : "";

            row.innerHTML = `
                <div style="flex:1; display:flex; align-items:center; overflow:hidden;">
                    <span style="font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${name}</span>
                    ${statusText}
                </div>
                <div style="display:flex; gap:6px; align-items:center; margin-left:10px;">
                    <button class="play-btn" data-name="${name}" style="padding:2px 8px; cursor:pointer; font-size:11px;">再生</button>
                    <button class="delete-btn" data-name="${name}" style="padding:2px 8px; cursor:pointer; font-size:11px; background:#fff; border:1px solid #ccc;">削除</button>
                    <select class="event-assign" data-filename="${name}" style="font-size:11px; padding:1px;">
                        <option value="ignore">イベントに設定</option>
                        <option value="" ${assignedEvents.length === 0 ? 'selected' : ''}>(デフォルト)</option>
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
            const config = JSON.parse(FS.System["SoundConfig.json"].content || "{}");

            // --- 追加: 既存の重複設定をクリアする処理 ---
            // このファイルが他のイベントに設定されていたら、それを削除する
            Object.keys(config).forEach(key => {
                if (config[key] === fileName) {
                    delete config[key];
                }
            });
            // ------------------------------------------

            // 選択されたのが「(デフォルト)」以外なら、新しいイベントに割り当て
            if (eventName !== "") {
                config[eventName] = fileName;
            }

            FS.System["SoundConfig.json"].content = JSON.stringify(config, null, 2);
            refresh();
        }
    };

    container.querySelector("#upload-btn").onclick = () => inputEl.click();

    inputEl.onchange = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        // 許可する拡張子のリスト
        const allowedExtensions = /(\.mp3|\.ogg|\.wav)$/i;

        for (const file of files) {
            // --- 追加: ファイル形式のチェック ---
            if (!allowedExtensions.exec(file.name)) {
                alertWindow(`ファイル「${file.name}」はサポートされていない形式です。mp3, ogg, wav形式を選択してください。`);
                continue; // このファイルをスキップして次へ
            }
            // ----------------------------------

            await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    FS.Programs.Music[file.name] = {
                        type: "file",
                        subtype: "audio",
                        content: ev.target.result
                    };
                    resolve();
                };
                reader.readAsDataURL(file);
            });
        }

        refresh();
    };

    // 再生・削除（通知なし）
    listEl.onclick = (e) => {
        const name = e.target.dataset.name;
        if (!name) return;

        if (e.target.classList.contains("play-btn")) {
            const data = FS.Programs.Music[name].content;
            new Audio(data).play();
        }

        if (e.target.classList.contains("delete-btn")) {
            delete FS.Programs.Music[name];
            const config = JSON.parse(FS.System["SoundConfig.json"].content || "{}");
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