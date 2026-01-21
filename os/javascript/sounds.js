// sounds.js
export function startup_sound() {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'square';
    oscillator.frequency.value = 880;

    gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);

    oscillator.connect(gainNode).connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.1);
}