"use strict";
/* Music.
 *
 * Not files — a small step sequencer driving oscillators, which is why two
 * looping tracks cost about a hundred lines instead of a megabyte. A track is
 * data: a tempo, a root note, a chord walk, and three sixteen-step patterns for
 * bass, lead and hat. Edit the numbers below and the music changes; they are
 * semitone offsets from the track's root, and `null` is a rest.
 *
 * The scheduler is the usual Web Audio pattern: a timer wakes up every 25 ms
 * and books any notes due in the next 120 ms, so timing comes from the audio
 * clock rather than from setInterval drift.
 */

const TRACKS = {
  // the lobby and the attract screen: slow, wide, a bit damp
  menu: {
    name: "Terrarium",
    bpm: 84, root: 55,                       // A1
    prog: [0, 0, -4, -5],                    // one transposition per bar
    bassWave: "triangle", leadWave: "triangle",
    bassGain: 0.30, leadGain: 0.13, hatGain: 0.035,
    bass: [0, null, null, 12, null, 0, null, null, 7, null, null, 12, null, null, 0, null],
    lead: [24, null, 31, null, 28, null, null, 24, null, 31, null, 36, null, 28, null, null],
    hat:  [1, null, null, 1, null, null, 1, null, 1, null, null, 1, null, 1, null, null]
  },
  // a run: brisker, tighter, more insistent
  game: {
    name: "Stickyfoot",
    bpm: 138, root: 55,
    prog: [0, 3, -2, 5],
    bassWave: "square", leadWave: "square",
    bassGain: 0.26, leadGain: 0.10, hatGain: 0.05,
    bass: [0, null, 0, 7, null, 0, 12, null, 0, null, 7, null, 10, null, 7, null],
    lead: [24, 28, null, 31, null, 28, null, 36, 35, null, 31, null, 28, null, 24, null],
    hat:  [1, null, 1, null, 1, null, 1, 1, 1, null, 1, null, 1, 1, null, 1]
  }
};

const Music = {
  track: null, name: null, ducked: false,
  step: 0, bar: 0, nextTime: 0, timer: 0, noise: null,

  /** "menu", "game", or null for silence. Safe before audio exists. */
  play(name){
    if(this.name === name) return;
    this.name = name;
    this.track = name ? TRACKS[name] : null;
    this.step = 0; this.bar = 0;
    if(!Audio.ctx) return;                    // will start when audio unlocks
    this.stopTimer();
    if(!this.track) return;
    this.nextTime = Audio.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.tick(), 25);
  },
  resume(){ const n = this.name; this.name = null; this.play(n || "menu"); },
  stopTimer(){ if(this.timer){ clearInterval(this.timer); this.timer = 0; } },
  stop(){ this.stopTimer(); this.name = null; this.track = null; },
  /** Drop the music under a menu without stopping it. */
  duck(on){ this.ducked = !!on; Audio.applyMix(); },

  tick(){
    if(!Audio.ctx || !this.track) return;
    const spb = 60 / this.track.bpm / 4;                 // seconds per 16th
    while(this.nextTime < Audio.ctx.currentTime + 0.12){
      this.schedule(this.nextTime, spb);
      this.nextTime += spb;
      this.step++;
      if(this.step >= 16){ this.step = 0; this.bar = (this.bar + 1) % this.track.prog.length; }
    }
  },
  schedule(when, spb){
    const t = this.track;
    const shift = t.prog[this.bar] || 0;
    const b = t.bass[this.step], l = t.lead[this.step], h = t.hat[this.step];
    if(b !== null && b !== undefined) this.note(when, semi(t.root, b + shift), spb*2.4, t.bassWave, t.bassGain);
    if(l !== null && l !== undefined) this.note(when, semi(t.root, l + shift), spb*1.6, t.leadWave, t.leadGain);
    if(h) this.hit(when, t.hatGain);
  },
  note(when, freq, dur, wave, gain){
    const ctx = Audio.ctx;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = wave || "square";
    osc.frequency.setValueAtTime(freq, when);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), when + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g); g.connect(Audio.musicGain);
    osc.start(when); osc.stop(when + dur + 0.02);
  },
  hit(when, gain){
    const ctx = Audio.ctx;
    if(!this.noise){                                     // one shared noise buffer
      const n = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
      const d = n.getChannelData(0);
      for(let i = 0; i < d.length; i++) d[i] = (Math.random()*2 - 1) * (1 - i/d.length);
      this.noise = n;
    }
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 6000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.06);
    src.connect(hp); hp.connect(g); g.connect(Audio.musicGain);
    src.start(when); src.stop(when + 0.1);
  }
};

/** Semitones above a root frequency. */
function semi(root, n){ return root * Math.pow(2, n/12); }
