// sounds.js
import { FS } from "./fs.js";
import { resolveFS } from "./fs-utils.js";

let audioCtx = null;

// 再生中のオーディオインスタンスを保持するセット（GCによる音声途切れ・未再生を防止）
const activeAudios = new Set();

/**
 * AudioContextを安全に取得・初期化（シングルトン化 ＆ 自動再生ポリシー対策）
 */
function getAudioContext() {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return null;
        audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

/**
 * 汎用的なトーン生成ヘルパー
 */
function playTone(frequency, type, duration, volume = 0.2) {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

        gainNode.gain.setValueAtTime(volume, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.start();
        oscillator.stop(ctx.currentTime + duration);
    } catch (e) {
        console.warn("Audio playback failed:", e);
    }
}

/**
 * 起動音 (Startup Sound)
 */
export function startupSound() {
    playTone(880, 'square', 0.1, 0.2);
}

/**
 * エラー音などのシステム効果音
 */
export function errorSound() {
    playTone(150, 'sawtooth', 0.2, 0.15);
}

// 既存コードとの互換性エイリアス
export const startup_sound = startupSound;

/**
 * FSに保存された音声データを再生する
 */
export async function playSavedAudio(path) {
    const file = resolveFS(`C:/Programs/Music/${path}`);
    if (file && file.content) {
        let audioData = file.content;
        if (audioData === "__EXTERNAL_DATA__") {
            const { getFileContent } = await import("./fs-db.js");
            audioData = await getFileContent(`C:/Programs/Music/${path}`);
        }
        if (audioData) {
            const audio = new Audio(audioData);

            // GCによる破棄を防ぐためSetに保持し、終了時に削除
            activeAudios.add(audio);
            audio.onended = () => activeAudios.delete(audio);
            audio.onerror = () => activeAudios.delete(audio);

            audio.play().catch(err => {
                activeAudios.delete(audio);
                console.error(err);
            });
        }
    }
}

/**
 * システムイベントに関連付けられた音声を再生する
 */
export async function playSystemEventSound(eventName) {
    try {
        const configText = FS["C:"]?.System?.["SoundConfig.json"]?.content;
        const config = JSON.parse(configText || "{}");
        const path = config[eventName];

        if (path) {
            const file = resolveFS(`C:/Programs/Music/${path}`);
            if (file) {
                let audioData = file.content;

                if (audioData === "__EXTERNAL_DATA__") {
                    const { getFileContent } = await import("./fs-db.js");
                    audioData = await getFileContent(`C:/Programs/Music/${path}`);
                }

                if (audioData) {
                    const audio = new Audio(audioData);

                    // GCによる破棄を防ぐためSetに保持し、終了時に削除
                    activeAudios.add(audio);
                    audio.onended = () => activeAudios.delete(audio);
                    audio.onerror = () => activeAudios.delete(audio);

                    audio.play().catch(err => {
                        activeAudios.delete(audio);
                        // オートプレイ制限 (NotAllowedError) への対処
                        if (err.name === "NotAllowedError") {
                            const playOnGesture = () => {
                                audio.play().then(() => {
                                    activeAudios.add(audio);
                                }).catch(() => {
                                    activeAudios.delete(audio);
                                });
                            };
                            document.addEventListener("click", playOnGesture, { once: true });
                            document.addEventListener("keydown", playOnGesture, { once: true });
                        }
                    });
                }
            }
        } else if (eventName === 'startup') {
            try {
                startup_sound();
            } catch (e) {
                const playBeepOnGesture = () => {
                    startup_sound();
                };
                document.addEventListener("click", playBeepOnGesture, { once: true });
                document.addEventListener("keydown", playBeepOnGesture, { once: true });
            }
        }
    } catch (e) {
        console.warn("Sound event failed", e);
    }
}