/**
 * soundEngine.js
 * Dual audio engine: Synthesized Web Audio API + HTML5 Audio fallback.
 * Ensures instant, low-latency sound cues on any browser without blocking.
 */

class SoundEngine {
  constructor() {
    this.soundOn = true;
    this.ctx = null;
    this.audioElements = {
      match: new Audio('/sounds/match.mp3'),
      mismatch: new Audio('/sounds/mismatch.mp3')
    };
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggle() {
    this.soundOn = !this.soundOn;
    return this.soundOn;
  }

  playFlip() {
    if (!this.soundOn) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(540, this.ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch (_) {}
  }

  playMatch(combo = 1) {
    if (!this.soundOn) return;
    this.init();

    // Play MP3 fallback if available
    if (this.audioElements.match && combo === 1) {
      try {
        const clone = this.audioElements.match.cloneNode();
        clone.volume = 0.6;
        clone.play().catch(() => {});
      } catch (_) {}
    }

    // Synthesized chime chord (C5 - E5 - G5 - C6)
    if (!this.ctx) return;
    try {
      const baseFreq = 523.25 * (1 + (combo - 1) * 0.1); // Pitch rises with combo
      const notes = [baseFreq, baseFreq * 1.25, baseFreq * 1.5, baseFreq * 2];

      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + i * 0.06);

        gain.gain.setValueAtTime(0.15, this.ctx.currentTime + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.06 + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + i * 0.06);
        osc.stop(this.ctx.currentTime + i * 0.06 + 0.35);
      });
    } catch (_) {}
  }

  playMismatch() {
    if (!this.soundOn) return;
    this.init();

    if (this.audioElements.mismatch) {
      try {
        const clone = this.audioElements.mismatch.cloneNode();
        clone.volume = 0.5;
        clone.play().catch(() => {});
      } catch (_) {}
    }

    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(120, this.ctx.currentTime + 0.18);

      gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.18);
    } catch (_) {}
  }

  playVictory() {
    if (!this.soundOn || !this.ctx) return;
    this.init();
    try {
      const fanfare = [523.25, 659.25, 783.99, 1046.5]; // C, E, G, High C
      fanfare.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.12);

        gain.gain.setValueAtTime(0.2, this.ctx.currentTime + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.12 + 0.6);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + idx * 0.12);
        osc.stop(this.ctx.currentTime + idx * 0.12 + 0.6);
      });
    } catch (_) {}
  }

  playPop() {
    if (!this.soundOn || !this.ctx) return;
    this.init();
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch (_) {}
  }
}

export const sounds = new SoundEngine();
