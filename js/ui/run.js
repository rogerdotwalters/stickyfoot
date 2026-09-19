"use strict";
/* Starting, pausing and ending a run, and the buttons and keys that drive it. */

/* ---- run control ---- */
function hideOverlays(){ ["#ovStart","#ovDead","#ovPause","#ovScore"].forEach(k=>$(k).hidden = true); }
function enterGame(forced){
  setImmersive(true);
  startRun(forced);
}
function exitGame(){
  if(Cabinet.on){ Cabinet.stop(); return; }   // only the power switch leaves
  Music.duck(false);
  Music.play(S.audio.musicScene.menu);
  Game.state = "ready"; Game.gecko = null; Game.aim = null;
  chain.reset();
  hideOverlays();
  $("#ovStart").hidden = false;
  if(isFull() && document.exitFullscreen) try{ document.exitFullscreen(); }catch(e){}
  setImmersive(false);
  paintChip(); syncHud();
}
function openMenu(){
  if(Game.state !== "live") return;
  Game.state = "paused";
  $("#pauseScore").textContent = Game.score;
  $("#pauseLedges").textContent = Game.ledges;
  const u = Store.active();
  $("#pauseWho").textContent = u ? u.name : "none";
  $("#ovPause").hidden = false; Music.duck(true); syncHud();
}
function closeMenu(){
  if(Game.state !== "paused") return;
  $("#ovPause").hidden = true; Game.state = "live"; Music.duck(false); syncHud();
}
function startRun(forcedSeg){
  hideOverlays();
  Sfx("start");
  Music.duck(false);
  Music.play(S.audio.musicScene.run);
  Game.reset(forcedSeg || null);
  syncHud();
}
function showDeath(isBest){
  $("#deadWhy").textContent = Game.deathWhy;
  $("#deadScore").textContent = Game.score;
  $("#deadLedges").textContent = Game.ledges;
  $("#deadDist").textContent = Game.dist + "m";
  const u = Store.active();
  $("#deadBest").textContent = u ? (u.best|0) : Store.topScore();
  $("#deadNote").textContent = !u ? "No player is active, so this run was not scored."
    : (isBest ? "New personal best." : "");
  $("#ovDead").hidden = false;
  Music.play(S.audio.musicScene.menu);
  if(isBest) setTimeout(()=>Sfx("fanfare"), 420);
  syncHud();
  renderBoard(); renderHiScores();
}
$("#btnPlay").onclick = ()=>{ if(Cabinet.on) startRun(); else enterGame(); };
$("#btnAgain").onclick = ()=>startRun();
$("#btnToBoard").onclick = ()=>{ exitGame(); go("players"); };
$("#btnDeadExit").onclick = ()=>exitGame();
$("#btnResume").onclick = closeMenu;
$("#btnRestart").onclick = ()=>startRun();
$("#btnMenuPlayer").onclick = openPicker;
$("#btnMenuBoard").onclick = ()=>{ exitGame(); go("players"); };
$("#btnMenuFull").onclick = toggleFullscreen;
$("#btnQuit").onclick = exitGame;
$("#btnMenu").onclick = ()=>{ Game.state === "paused" ? closeMenu() : openMenu(); };
$("#btnFull").onclick = toggleFullscreen;
$("#btnFullDeck").onclick = toggleFullscreen;
$("#btnDebug").onclick = ()=>{ Game.debug = !Game.debug; };
function refreshWorldButton(){
  const n = Pool.custom().length;
  const labels = {builtin:"world: built-in", mixed:"world: mixed", custom:"world: my map"};
  if(Store.prefs.useCustom!=="builtin" && !n) Store.prefs.useCustom = "builtin";
  $("#btnSegSource").textContent = labels[Store.prefs.useCustom] + (n ? " ("+n+")" : "");
}
$("#btnSegSource").onclick = ()=>{
  const order = ["builtin","mixed","custom"];
  if(!Pool.custom().length){ toast("Save a map in the editor first."); return; }
  Store.prefs.useCustom = order[(order.indexOf(Store.prefs.useCustom)+1)%order.length];
  Store.savePrefs(); refreshWorldButton();
  toast("New runs will use: " + $("#btnSegSource").textContent.replace("world: ",""));
};
document.addEventListener("keydown", ev=>{
  if(!$("#screen-play").classList.contains("on")) return;
  if(ev.target.tagName==="INPUT" || ev.target.tagName==="SELECT") return;
  if(ev.key==="F3"){ Game.debug = !Game.debug; ev.preventDefault(); }
  if(ev.key==="r" || ev.key==="R"){ if(Game.state!=="ready") startRun(); }
  if(ev.key==="f" || ev.key==="F"){ toggleFullscreen(); ev.preventDefault(); }
  if(ev.key==="m" || ev.key==="M"){ toggleMute(); }
  if(ev.key==="p" || ev.key==="P"){ Game.state==="paused" ? closeMenu() : openMenu(); }
  if(ev.key==="Escape"){
    if(Game.state==="live") openMenu();
    else if(Game.state==="paused") closeMenu();
    else if(isImmersive() && !isFull()) setImmersive(false);
  }
  if(ev.key===" " && Game.state==="ready"){ enterGame(); ev.preventDefault(); }
});
