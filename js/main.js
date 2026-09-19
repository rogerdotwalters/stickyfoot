"use strict";
/* Screen router and boot. Loaded last; everything above is already defined by the time this runs. */

/* ---------- 8. router + boot ---------- */
function go(name){
  if(!name || !$("#screen-"+name)) return;
  if(Cabinet.on && name !== "play"){ toast("Shut the cabinet down first."); return; }
  $$(".screen").forEach(s=>s.classList.toggle("on", s.id==="screen-"+name));
  $$(".nav-btn").forEach(b=>{
    if(b.dataset.go===name) b.setAttribute("aria-current","page"); else b.removeAttribute("aria-current");
  });
  if(name==="players") renderBoard();
  if(name==="editor"){ edBuildLayers(); edBuildPalette(); edBuildSegList(); edBuildBiomeBar(); filmRender(); edSyncFields(); edPaint(); }
  if(name!=="play" && !Cabinet.on){
    if(Game.state==="live") openMenu();
    if(isFull() && document.exitFullscreen) try{ document.exitFullscreen(); }catch(e){}
    setImmersive(false);
  }
  window.scrollTo({top:0});
}
$$(".nav-btn[data-go]").forEach(b=> b.onclick = ()=>go(b.dataset.go));

audioIcon();
refreshSettings();      // settings.json, when the page is served over http(s)
loadSprites();          // PNGs from assets/sprites (or inlined by build.py)
Pool.init();
syncHud();
paintChip();
renderHiScores();
renderBoard();
refreshWorldButton();
$("#btnMask").textContent = Store.prefs.mask ? "show contact details" : "hide contact details";
edBuildLayers(); edBuildPalette(); edBuildSegList(); edBuildBiomeBar(); filmRender(); edSyncFields();
/* draw a still frame behind the start overlay */
drawBackdrop(0);
if(document.fonts && document.fonts.ready) document.fonts.ready.then(()=>{ if(Game.state!=="live") drawBackdrop(0); edPaint(); });
