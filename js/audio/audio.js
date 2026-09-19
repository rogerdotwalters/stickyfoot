"use strict";
/* The audio engine.
 *
 * One AudioContext, three gain stages — master, then music and sfx beneath it —
 * so the mixer in the sound dialog maps straight onto the graph:
 *
 *     sfx buffers  ->  sfxGain   -\
 *                                  >-- masterGain -> speakers
 *     music voices ->  musicGain -/
 *
 * Browsers refuse to start audio until the page has been touched, so nothing is
 * created until the first real gesture; before that every call here is a no-op.
 * Everything degrades quietly: no Web Audio, no files, no problem — the game
 * runs silent rather than throwing.
 *
 * Levels come from settings.json (audio.*) and are overridden by whatever the
 * player sets in the sound dialog, which is kept in local storage.
 */

const Audio = {
  ctx: null,
  master: null, musicGain: null, sfxGain: null,
  buffers: {},          // id -> AudioBuffer
  meta: {},             // id -> manifest entry
  started: false,       // has a gesture unlocked us
  loading: null,

  /* ---- mixer levels: settings.json defaults, player overrides on top ---- */
  mix(){
    if(!Store.prefs.audio) Store.prefs.audio = {};
    const p = Store.prefs.audio, d = S.audio;
    return {
      master: typeof p.master === "number" ? p.master : d.master,
      music:  typeof p.music  === "number" ? p.music  : d.music,
      sfx:    typeof p.sfx    === "number" ? p.sfx    : d.sfx,
      muted:  typeof p.muted === "boolean" ? p.muted  : !!d.muted
    };
  },
  setLevel(kind, value){
    if(!Store.prefs.audio) Store.prefs.audio = {};
    Store.prefs.audio[kind] = (kind === "muted") ? !!value : clamp(+value, 0, 1);
    Store.savePrefs();
    this.applyMix();
    if(typeof audioIcon === "function") audioIcon();   // keep the header honest
  },
  applyMix(){
    if(!this.ctx) return;
    const m = this.mix(), t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(m.muted ? 0 : m.master, t, 0.02);
    this.musicGain.gain.setTargetAtTime(m.music * (Music.ducked ? 0.35 : 1), t, 0.05);
    this.sfxGain.gain.setTargetAtTime(m.sfx, t, 0.02);
  },

  /* ---- setup, on the first gesture ---- */
  start(){
    if(this.started) return Promise.resolve(false);
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if(!Ctx) return Promise.resolve(false);
    this.started = true;
    try{
      this.ctx = new Ctx();
      this.master    = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain   = this.ctx.createGain();
      this.musicGain.connect(this.master);
      this.sfxGain.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.applyMix();
      if(this.ctx.state === "suspended") this.ctx.resume();
    }catch(e){
      console.warn("[stickyfoot] no audio:", e.message);
      this.ctx = null; return Promise.resolve(false);
    }
    return this.loadAll().then(() => { Music.resume(); return true; });
  },

  loadAll(){
    if(this.loading) return this.loading;
    const inline = (typeof AUDIO_DATA !== "undefined") ? AUDIO_DATA : null;
    const jobs = SFX_MANIFEST.map(s => {
      this.meta[s.id] = s;
      const src = inline && inline[s.id];
      const bytes = src ? Promise.resolve(base64ToBuffer(src))
                        : fetch("assets/audio/" + s.file).then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status));
      return bytes
        .then(buf => this.ctx.decodeAudioData(buf))
        .then(decoded => { this.buffers[s.id] = decoded; })
        .catch(() => console.warn("[stickyfoot] sound failed to load:", s.id, s.file));
    });
    this.loading = Promise.all(jobs);
    return this.loading;
  },

  /** Fire and forget. Safe to call before audio exists, or at any volume. */
  play(id, opts){
    if(!this.ctx || this.mix().muted) return;
    const buf = this.buffers[id];
    if(!buf) return;
    const m = this.meta[id] || {};
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const vary = (opts && opts.vary !== undefined) ? opts.vary : (m.vary || 0);
    src.playbackRate.value = ((opts && opts.rate) || 1) * (1 + (Math.random()*2 - 1) * vary);
    const g = this.ctx.createGain();
    g.gain.value = ((opts && opts.gain) || 1) * (m.gain === undefined ? 1 : m.gain);
    src.connect(g); g.connect(this.sfxGain);
    src.start();
  }
};

/** Shorthand used all over the game code. */
function Sfx(id, opts){ Audio.play(id, opts); }

function base64ToBuffer(dataUrl){
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

/* The first touch or key anywhere starts everything. Browsers require the
   gesture; we also use it as the cue to begin the menu music. */
(function armAudio(){
  const go = () => {
    document.removeEventListener("pointerdown", go, true);
    document.removeEventListener("keydown", go, true);
    Audio.start();
  };
  document.addEventListener("pointerdown", go, true);
  document.addEventListener("keydown", go, true);
})();
