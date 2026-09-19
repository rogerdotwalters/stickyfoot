"use strict";
/* The sound dialog: three sliders and a mute, mapped straight onto the three
 * gain stages in js/audio/audio.js. Levels are saved as they move, so there is
 * no OK button to forget to press.
 *
 * Reachable from the header, from the in-game menu, and from the M key.
 */

function audioIcon(){
  const m = Audio.mix();
  const on = !m.muted && m.master > 0.001;
  $("#btnAudio").textContent = on ? "\u25B6 sound" : "\u25A0 muted";
  $("#btnAudio").setAttribute("aria-label", on ? "sound settings" : "sound is muted");
}
function syncAudioDialog(){
  const m = Audio.mix();
  $("#volMaster").value = m.master;
  $("#volMusic").value  = m.music;
  $("#volSfx").value    = m.sfx;
  $("#volMute").checked = m.muted;
  $("#volMasterOut").textContent = Math.round(m.master*100) + "%";
  $("#volMusicOut").textContent  = Math.round(m.music*100) + "%";
  $("#volSfxOut").textContent    = Math.round(m.sfx*100) + "%";
  audioIcon();
}
function openAudioDialog(){
  syncAudioDialog();
  $("#dlgAudio").showModal();
}
$("#btnAudio").onclick = openAudioDialog;
$("#btnMenuSound").onclick = openAudioDialog;
$("#audioClose").onclick = ()=>{ try{ $("#dlgAudio").close(); }catch(e){} };

for(const [id, kind] of [["#volMaster","master"], ["#volMusic","music"], ["#volSfx","sfx"]]){
  $(id).oninput = e => {
    Audio.setLevel(kind, e.target.value);
    syncAudioDialog();
  };
  // one click of feedback when you let go of a slider, not on every pixel
  $(id).onchange = () => { if(kind !== "music") Sfx("click"); };
}
$("#volMute").onchange = e => { Audio.setLevel("muted", e.target.checked); syncAudioDialog(); };

function toggleMute(){
  Audio.setLevel("muted", !Audio.mix().muted);
  syncAudioDialog();
  toast(Audio.mix().muted ? "Sound off" : "Sound on");
}

/* Any button in the interface clicks. Delegated, so nothing has to remember. */
document.addEventListener("click", ev => {
  const b = ev.target.closest && ev.target.closest("button");
  if(!b || b.id === "volMute") return;
  if(b.closest("#dlgAudio")) return;          // the dialog makes its own noise
  Sfx("click");
}, true);
