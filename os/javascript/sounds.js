// sounds.js
import { FS } from "./fs.js";
import { resolveFS } from "./fs-utils.js";

let audioCtx = null;
let isSoundHalted = false;

// 再生中のオーディオインスタンスを保持するセット（GCによる音声途切れ・未再生を防止）
const activeAudios = new Set();
const pendingGestureCleanups = new Set();

export function stopAllSounds() {
    for (const cleanup of Array.from(pendingGestureCleanups)) {
        try { cleanup(); } catch (_) { }
    }
    pendingGestureCleanups.clear();

    for (const audio of Array.from(activeAudios)) {
        try {
            audio.pause();
            audio.currentTime = 0;
        } catch (_) { }
    }
    activeAudios.clear();

    if (audioCtx && audioCtx.state === "running") {
        audioCtx.suspend().catch(() => { });
    }
}

function registerOneShotGesture(callback) {
    if (isSoundHalted) return;
    let fired = false;
    const cleanup = () => {
        document.removeEventListener("click", handler);
        document.removeEventListener("keydown", handler);
        pendingGestureCleanups.delete(cleanup);
    };
    const handler = () => {
        if (fired) return;
        fired = true;
        cleanup();
        if (!isSoundHalted) callback();
    };
    pendingGestureCleanups.add(cleanup);
    document.addEventListener("click", handler);
    document.addEventListener("keydown", handler);
}

if (typeof window !== "undefined" && !window._soundsLifecycleHooksInstalled) {
    window._soundsLifecycleHooksInstalled = true;
    window.addEventListener("nexser-bsod", () => {
        isSoundHalted = true;
        stopAllSounds();
    });
}

/**
 * AudioContextを安全に取得・初期化（シングルトン化 ＆ 自動再生ポリシー対策）
 */
function getAudioContext() {
    if (isSoundHalted) return null;
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return null;
        audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => { });
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
    if (isSoundHalted) return;
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
    if (isSoundHalted) return;
    try {
        const configNode = FS["C:"]?.System?.["SoundConfig.json"];
        let configText = configNode?.content;
        if (configText === "__EXTERNAL_DATA__") {
            const { getFileContent } = await import("./fs-db.js");
            configText = await getFileContent("C:/System/SoundConfig.json");
        }
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

                if (audioData && !isSoundHalted) {
                    const audio = new Audio(audioData);

                    // GCによる破棄を防ぐためSetに保持し、終了時に削除
                    activeAudios.add(audio);
                    audio.onended = () => activeAudios.delete(audio);
                    audio.onerror = () => activeAudios.delete(audio);

                    audio.play().catch(err => {
                        activeAudios.delete(audio);
                        // オートプレイ制限 (NotAllowedError) への対処（click/keydown 相互解除で二重再生を防止）
                        if (err.name === "NotAllowedError" && !isSoundHalted) {
                            registerOneShotGesture(() => {
                                audio.play().then(() => {
                                    activeAudios.add(audio);
                                }).catch(() => {
                                    activeAudios.delete(audio);
                                });
                            });
                        }
                    });
                }
            }
        } else if (eventName === 'startup') {
            try {
                startup_sound();
            } catch (e) {
                registerOneShotGesture(() => {
                    startup_sound();
                });
            }
        }
    } catch (e) {
        console.warn("Sound event failed", e);
    }
}