"use strict";
/* The immersive game view, fullscreen, and the orientation handling for phones. */

/* ---- the game view: chrome out of the way, stage on black ---- */
function isImmersive(){ return $("#stageFill").classList.contains("immersive"); }
function isFull(){ return !!(document.fullscreenElement || document.webkitFullscreenElement); }
function setImmersive(on){
  $("#stageFill").classList.toggle("immersive", on);
  $(".cabinet").classList.toggle("ingame", on);
  document.body.classList.toggle("ingame", on);
  if(!on) unlockOrientation();
  syncHud(); syncTurn();
}
const portraitQ = (window.matchMedia ? window.matchMedia("(orientation: portrait)")
                                     : {matches:false, addEventListener(){}, addListener(){}});
/* Android and friends can actually turn the screen; everywhere else we turn the stage. */
async function lockLandscape(){
  try{
    if(typeof screen !== "undefined" && screen.orientation && screen.orientation.lock)
      await screen.orientation.lock("landscape");
  }catch(e){ /* refused or unsupported — syncTurn covers it */ }
  syncTurn();
}
function unlockOrientation(){
  try{ if(typeof screen !== "undefined" && screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); }
  catch(e){}
}
function syncTurn(){
  const active = isImmersive() || isFull();
  const turn = active && portraitQ.matches && window.innerWidth < 900;
  $("#stageFill").classList.toggle("turned", turn);
  document.documentElement.classList.toggle("turned", turn);
}
if(portraitQ.addEventListener) portraitQ.addEventListener("change", syncTurn);
else if(portraitQ.addListener) portraitQ.addListener(syncTurn);
window.addEventListener("resize", syncTurn);
window.addEventListener("orientationchange", ()=>setTimeout(syncTurn, 120));

async function toggleFullscreen(){
  const el = $("#stageFill");
  if(isFull()){
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    unlockOrientation();
    if(exit) try{ await exit.call(document); }catch(e){}
    syncHud(); syncTurn(); return;
  }
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  try{
    if(!req) throw new Error("unsupported");
    await req.call(el, {navigationUI:"hide"});
    lockLandscape();
  }catch(e){
    if(!isImmersive()){
      setImmersive(true);
      toast("Fullscreen is blocked in this frame — filled the window instead.");
    } else {
      toast("Fullscreen is blocked here. Open the game in its own tab for the real thing.");
    }
  }
  syncHud();
}
function syncHud(){
  const full = isFull();
  $("#btnFull").textContent = full ? "▣" : "⛶";
  $("#btnFull").title = (full ? "leave fullscreen" : "fullscreen") + " (F)";
  $("#btnFullDeck").textContent = full ? "leave fullscreen" : "fullscreen";
  $("#btnMenu").hidden = !(Game.state === "live" || Game.state === "paused");
  $("#btnPower").hidden = !Cabinet.on;
  $("#btnQuit").textContent = Cabinet.on ? "shut down" : "leave game";
  $("#btnMenuPlayer").hidden = Cabinet.on;
  $("#btnMenuBoard").hidden = Cabinet.on;
}
document.addEventListener("fullscreenchange", ()=>{
  // leaving fullscreen mid-run keeps the game view; leaving it in the lobby returns the chrome
  if(!isFull()){
    unlockOrientation();
    if(Cabinet.on) toast("Fullscreen closed — press ⛶ to restore it. The cabinet is still running.");
    else if(!Game.gecko) setImmersive(false);
  }
  syncHud(); syncTurn();
});
document.addEventListener("webkitfullscreenchange", syncHud);
