import { clamp } from './util.js';

/* ---------------- AUDIO ---------------- */
export let AC = null;
export function ac() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } return AC; }
export function tone(f, dur, type, vol, when) {
  const c = ac(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type || 'sine'; o.frequency.value = f;
  g.gain.setValueAtTime(0, c.currentTime + (when || 0));
  g.gain.linearRampToValueAtTime(vol || 0.12, c.currentTime + (when || 0) + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + (when || 0) + dur);
  o.connect(g); g.connect(c.destination);
  o.start(c.currentTime + (when || 0)); o.stop(c.currentTime + (when || 0) + dur + 0.05);
}
export const sCash = () => { tone(880, .12, 'triangle', .10); tone(1320, .16, 'triangle', .08, .06); };
export const sBig = () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, .5, 'triangle', .09, i * .09)); };
export const sBad = () => { tone(196, .3, 'sawtooth', .07); tone(147, .4, 'sawtooth', .06, .12); };
export const sTap = () => tone(440, .06, 'square', .04);
export const sWin = () => { [392, 494, 587, 784, 988, 1175].forEach((f, i) => tone(f, .9, 'triangle', .10, i * .13)); };

/* =========================================================
   GENERATIVE GAME MUSIC — a real soundtrack per district
   ========================================================= */
export let ambientZone = null;
export const Music = {
  enabled: true, zone: null, nextNote: 0, step: 0, timer: null,
  master: null, noiseBuf: null,
  // midi helpers
  f: m => 440 * Math.pow(2, (m - 69) / 12),
  themes: {
    1: { bpm: 84, root: 57, scale: [0, 3, 5, 7, 10],        // A minor pent — lo-fi grind
       chords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -2, 2]],
       kick: [0, 8, 10], hat: [2, 6, 10, 14], pad: .5, melP: .30, bright: 0 },
    2: { bpm: 100, root: 60, scale: [0, 2, 4, 7, 9],         // C major pent — main street
       chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]],
       kick: [0, 4, 8, 12], hat: [2, 6, 10, 14], pad: .4, melP: .38, bright: 1 },
    3: { bpm: 112, root: 52, scale: [0, 3, 5, 7, 10],        // E minor pent — synth row
       chords: [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-7, -4, 0]],
       kick: [0, 6, 8, 14], hat: [1, 3, 5, 7, 9, 11, 13, 15], pad: .35, melP: .5, bright: 2 },
    4: { bpm: 76, root: 50, scale: [0, 2, 4, 7, 9],         // D major pent — sovereign, warm
       chords: [[0, 4, 7], [-5, 0, 4], [-3, 2, 4], [-7, -3, 0]],
       kick: [0, 7, 8, 11], hat: [4, 12], pad: .6, melP: .34, bright: 0 },
    5: { bpm: 96, root: 55, scale: [0, 3, 5, 7, 10],        // G minor pent — capital tension
       chords: [[0, 3, 7], [-4, 0, 3], [-1, 3, 6], [-5, -2, 2]],
       kick: [0, 8], hat: [4, 12], pad: .55, melP: .2, bright: 0 },
    6: { bpm: 92, root: 53, scale: [0, 2, 4, 7, 9],         // F major pent — skyline triumph
       chords: [[0, 4, 7], [2, 5, 9], [-3, 0, 4], [-1, 4, 7]],
       kick: [0, 4, 8, 12], hat: [2, 6, 10, 14], pad: .7, melP: .42, bright: 1 }
  },
  lastMel: 0,
  init() {
    if (this.master || !ac()) return;
    this.master = AC.createGain();
    this.master.gain.value = 0.0;
    this.master.connect(AC.destination);
    // noise buffer for hats
    const len = AC.sampleRate * 0.1;
    this.noiseBuf = AC.createBuffer(1, len, AC.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    this.nextNote = AC.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 90);
    this.master.gain.linearRampToValueAtTime(this.enabled ? 0.9 : 0, AC.currentTime + 2);
  },
  setZone(z) { this.zone = z; },
  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.linearRampToValueAtTime(on ? 0.9 : 0, AC.currentTime + 0.6);
  },
  tone(freq, t, dur, type, vol, attack) {
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + (attack || 0.02));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  },
  hat(t, vol) {
    const s = AC.createBufferSource(); s.buffer = this.noiseBuf;
    const g = AC.createGain(); g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    s.connect(g); g.connect(this.master); s.start(t);
  },
  kick(t) {
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.10);
    g.gain.setValueAtTime(0.30, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.3);
  },
  schedule() {
    if (!this.master) return;
    const th = this.themes[this.zone] || this.themes[1];
    const spb = 60 / th.bpm / 4; // 16th note length
    while (this.nextNote < AC.currentTime + 0.35) {
      const t = this.nextNote, s = this.step % 16, bar = Math.floor(this.step / 16) % 4;
      const chord = th.chords[bar];
      // kick
      if (th.kick.includes(s)) this.kick(t);
      // hats
      if (th.hat.includes(s)) this.hat(t, 0.05);
      // bass on beats 1 & 3
      if (s === 0 || s === 8)
        this.tone(this.f(th.root - 12 + chord[0]), t, spb * 6, 'sine', 0.14, 0.01);
      // pad: chord at bar start, slow attack, long
      if (s === 0) chord.forEach(iv =>
        this.tone(this.f(th.root + iv), t, spb * 15, 'triangle', 0.035 * th.pad, spb * 4));
      // melody: sparse pentatonic random walk on 8ths
      if (s % 2 === 0 && Math.random() < th.melP) {
        let idx = this.lastMel + (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.7 ? 1 : 2);
        idx = clamp(idx, 0, th.scale.length * 2 - 1);
        this.lastMel = idx;
        const oct = Math.floor(idx / th.scale.length), deg = th.scale[idx % th.scale.length];
        const mtype = th.bright === 2 ? 'square' : (th.bright === 1 ? 'triangle' : 'sine');
        this.tone(this.f(th.root + 12 + oct * 12 + deg), t, spb * 3, 'triangle',
          th.bright === 2 ? 0.035 : 0.05, 0.015);
        if (th.bright === 2) // synth row gets an echo arp
          this.tone(this.f(th.root + 24 + deg), t + spb, spb * 2, 'square', 0.018, 0.01);
      }
      this.step++; this.nextNote += spb;
    }
  }
};
export function setZoneAmbient(zoneId) {
  ambientZone = zoneId;
  if (AC) { Music.init(); Music.setZone(zoneId); }
}
