"use strict";
/* Arcade cabinet mode: attract screen, locked-in navigation, and the end-of-run score entry. */

/* ---- arcade cabinet mode ----
   Launched deliberately, left deliberately. No page chrome, no back button,
   no way out but the power switch. */
const Cabinet = {
  on:false, guard:false, timer:0, pending:null,
  async start(){
    if(this.on) return;
    this.on = true;
    document.body.classList.add("cabinet-mode");
    go("play");
    setImmersive(true);
    const el = $("#stageFill");
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    try{
      if(!req) throw new Error("unsupported");
      await req.call(el, {navigationUI:"hide"});
      lockLandscape();
    }catch(e){ toast("Fullscreen is blocked in this frame — running filled instead."); }
    this.armGuards();
    this.attract();
    syncHud();
  },
  async stop(){
    if(!await ask("Shut the cabinet down and go back to the dashboard?", "shut down")) return;
    this.on = false; this.pending = null;
    clearInterval(this.timer);
    document.body.classList.remove("cabinet-mode");
    $("#ovScore").hidden = true;
    $("#ovStart").classList.remove("cabinet");
    exitGame();
  },
  armGuards(){
    if(this.guard) return;
    this.guard = true;
    try{ history.pushState({stickyfoot:"cabinet"}, ""); }catch(e){}
    window.addEventListener("popstate", ()=>{
      if(!this.on) return;
      try{ history.pushState({stickyfoot:"cabinet"}, ""); }catch(e){}
      toast("The cabinet is running. Use the ⏻ button to shut it down.");
    });
    window.addEventListener("beforeunload", e=>{
      if(!this.on) return;
      e.preventDefault(); e.returnValue = "";
    });
  },
  /* attract screen: high scores and one button */
  attract(){
    clearInterval(this.timer);
    this.pending = null;
    Game.state = "ready"; Game.gecko = null; Game.aim = null;
    chain.reset();
    hideOverlays();
    renderHiScores();
    $("#ovStart").classList.add("cabinet");
    $("#ovStart").hidden = false;
    Music.duck(false);
    Music.play(S.audio.musicScene.menu);
    syncHud();
  },
  endRun(){
    this.pending = { score:Game.score, ledges:Game.ledges, dist:Game.dist };
    $("#scoreValue").textContent = Game.score;
    $("#sName").value = ""; $("#sEmail").value = ""; $("#sPhone").value = "";
    $("#scoreErr").textContent = "";
    $$("#ovScore input").forEach(i=>i.classList.remove("bad"));
    hideOverlays();
    $("#ovScore").hidden = false;
    syncHud();
    this.left = 90;
    clearInterval(this.timer);
    this.timer = setInterval(()=>{
      this.left--;
      $("#scoreTimer").textContent = "discarded in " + this.left + "s";
      if(this.left <= 0){ clearInterval(this.timer); this.discard(true); }
    }, 1000);
    $("#scoreTimer").textContent = "discarded in " + this.left + "s";
    setTimeout(()=>{ try{ $("#sName").focus(); }catch(e){} }, 60);
  },
  submit(){
    if(!this.pending) return;
    const name = clean($("#sName").value), email = clean($("#sEmail").value), phone = clean($("#sPhone").value);
    const bad = [];
    $("#sName").classList.toggle("bad", !validName(name));   if(!validName(name)) bad.push("a name of at least two characters");
    $("#sEmail").classList.toggle("bad", !validEmail(email)); if(!validEmail(email)) bad.push("a valid email");
    $("#sPhone").classList.toggle("bad", !validPhone(phone)); if(!validPhone(phone)) bad.push("a phone number of 7 to 15 digits");
    if(bad.length){
      $("#scoreErr").textContent = "The score is only kept with " + bad.join(", ") + ".";
      return;
    }
    const res = Store.saveScore({name, email, phone, score:this.pending.score,
                                 ledges:this.pending.ledges, dist:this.pending.dist});
    clearInterval(this.timer);
    if(!res.ok){ $("#scoreErr").textContent = "Those details were rejected, so the score was discarded."; this.attract(); return; }
    renderBoard();
    Sfx("fanfare");
    toast(res.isBest ? (res.user.name + " — new personal best, rank " + res.rank)
                     : (res.user.name + " saved at rank " + res.rank));
    this.attract();
  },
  discard(bySeconds){
    clearInterval(this.timer);
    this.pending = null;   // nothing is written
    if(bySeconds) toast("No details entered — that score was discarded.");
    this.attract();
  }
};
function renderHiScores(){
  const host = $("#attractScores");
  const rows = Store.ranked().filter(u=>(u.best|0) > 0).slice(0, 8);
  let html = '<h3>high scores</h3>';
  if(!rows.length) html += '<p class="hs-empty">No scores yet. The board is yours.</p>';
  else html += rows.map((u,i)=>
    '<div class="hs-row"><span class="hs-rank">' + (i+1) + '</span>' +
    '<span class="hs-name">' + esc(u.name) + '</span>' +
    '<span class="hs-score">' + (u.best|0) + '</span></div>').join("");
  host.innerHTML = html;
}
$("#btnRunGame").onclick = ()=>{
  try{ Cabinet.start(); }
  catch(err){ Cabinet.on = false; toast("The cabinet could not start: " + err.message); }
};
$("#btnPower").onclick = ()=>Cabinet.stop();
$("#btnScoreSave").onclick = ()=>Cabinet.submit();
$("#btnScoreSkip").onclick = ()=>Cabinet.discard(false);
$$("#ovScore input").forEach(inp=>{
  inp.addEventListener("keydown", ev=>{ if(ev.key==="Enter"){ Cabinet.submit(); ev.preventDefault(); } });
  inp.addEventListener("input", ()=>{
    inp.classList.remove("bad");
    if(Cabinet.pending) Cabinet.left = Math.max(Cabinet.left|0, 45);   // don't rush someone typing
  });
});
