"use strict";
/* Drawing: parallax backdrop, node art, gecko, HUD, node monitor, and the main loop. */

/* ---------- backdrop (procedural, infinite, parallax) ---------- */
function biome(camX){
  const band = Math.floor(camX / (NODE_W*6)) % 3;
  return [
    {top:"#173a4a", bot:"#2f6b5a", hill:"#14303a", tree:"#0f2a2a"},
    {top:"#3a2a52", bot:"#6b4a5a", hill:"#2a1e3c", tree:"#1d152a"},
    {top:"#1b3a24", bot:"#4a6b34", hill:"#16301c", tree:"#0f2416"}
  ][band];
}
function drawBackdrop(camX, camY){
  camY = camY || 0;
  const sky = camY * 0.25;            // the far world drifts a little with the camera
  const bm = biome(camX);
  const grad = ctx.createLinearGradient(0,0,0,NODE_H);
  grad.addColorStop(0, bm.top); grad.addColorStop(1, bm.bot);
  ctx.fillStyle = grad; ctx.fillRect(0,0,NODE_W,NODE_H);
  ctx.save(); ctx.translate(0, -sky);
  // far hills
  ctx.fillStyle = bm.hill;
  const step = 32, off = camX*0.18;
  ctx.beginPath(); ctx.moveTo(0, NODE_H);
  for(let sx=-step; sx<=NODE_W+step; sx+=step){
    const wx = sx + off;
    const i = Math.floor(wx/step);
    const h = 150 + hash32(i)*70 + Math.sin(wx*0.004)*40;
    ctx.lineTo(sx - (off % step), NODE_H - h);
  }
  ctx.lineTo(NODE_W+step, NODE_H); ctx.closePath(); ctx.fill();
  // mid tree line
  ctx.fillStyle = bm.tree;
  const off2 = camX*0.42, step2 = 48;
  for(let sx=-step2; sx<=NODE_W+step2; sx+=step2){
    const wx = sx + off2, i = Math.floor(wx/step2);
    const h = 90 + hash32(i*7919)*120;
    const x = sx - (off2 % step2);
    ctx.fillRect(x+14, NODE_H-h-60, 14, h);
    ctx.beginPath(); ctx.moveTo(x-6, NODE_H-h-46); ctx.lineTo(x+21, NODE_H-h-96); ctx.lineTo(x+48, NODE_H-h-46);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = "rgba(8,18,14,0.35)"; ctx.fillRect(0, NODE_H-70, NODE_W, 70);
  ctx.restore();
}
function drawRot(camX, t){
  // the creeping left edge: touch it and the run ends
  const g = ctx.createLinearGradient(0,0,110,0);
  g.addColorStop(0,"rgba(12,26,16,0.95)"); g.addColorStop(0.6,"rgba(24,54,30,0.55)"); g.addColorStop(1,"rgba(24,54,30,0)");
  ctx.fillStyle = g; ctx.fillRect(0,0,110,NODE_H);
  ctx.fillStyle = "#1d3a22";
  for(let y=-20; y<NODE_H+20; y+=28){
    const w = 26 + Math.sin((y+t*2)*0.06)*14 + hash32(Math.floor(y/28)+Math.floor(t/40))*10;
    ctx.fillRect(0, y, w, 20);
  }
  ctx.fillStyle = "#6fbf5a";
  for(let y=-20; y<NODE_H+20; y+=28){
    const w = 26 + Math.sin((y+t*2)*0.06)*14;
    ctx.fillRect(w, y+6, 6, 6);
  }
}
function drawGecko(g){
  const sp = g.mode==="fly" ? SPRITES.gecko_fly : (g.face==="top" ? SPRITES.gecko_idle : SPRITES.gecko_stick);
  if(!sp) return;                      // sprites still loading
  const w = sp.w*PX, h = sp.h*PX;
  ctx.save();
  ctx.translate(Math.round(g.x - Game.camX), Math.round(g.y - Game.camY));
  let a = 0;
  if(g.mode==="fly") a = Math.round(g.ang/(Math.PI/8))*(Math.PI/8);
  else if(g.face==="left") a = Math.PI/2;
  else if(g.face==="right") a = -Math.PI/2;
  else if(g.face==="bottom") a = Math.PI;
  ctx.rotate(a);
  const sq = g.squash>0 ? 1 + g.squash*0.02 : 1;
  ctx.scale(sq, 2-sq);
  ctx.drawImage(sp.canvas, 0,0,sp.w,sp.h, -w/2, -h/2, w, h);
  if(g.blink>4 && g.mode!=="fly"){ ctx.fillStyle="#3d8f2c"; ctx.fillRect(w/2-12, -h/2+12, 8, 8); }
  ctx.restore();
}
/* Uneaten tokens and the enemies patrolling, on every live node. */
function drawTokens(){
  const bob = Math.sin(Game.t * FOOD.bobSpeed) * FOOD.bobAmplitude;
  for(const n of chain.visible(Game.camX, NODE_W)){
    for(const t of n.tokens){
      if(t.taken) continue;
      const sp = SPRITES[tokenSprite(t.kind, n.biome)];
      const x = Math.round(t.x - Game.camX), y = Math.round(t.y - Game.camY + bob);
      if(!sp){
        ctx.fillStyle = "rgba(255,46,168,0.3)"; ctx.fillRect(x, y, t.w, t.h);
        continue;
      }
      const w = sp.w*PX, h = sp.h*PX;
      ctx.drawImage(sp.canvas, 0,0,sp.w,sp.h, x + (t.w-w)/2, y + (t.h-h)/2, w, h);
    }
  }
  // enemies, flipped to face the way they are walking
  for(const n of chain.visible(Game.camX, NODE_W)){
    for(const e of n.enemies){
      const sp = SPRITES[enemySprite(e.kind)];
      const x = Math.round(e.x - Game.camX), y = Math.round(e.y - Game.camY);
      if(!sp){ ctx.fillStyle = "rgba(255,46,168,0.3)"; ctx.fillRect(x, y, e.w, e.h); continue; }
      const w = sp.w*PX, h = sp.h*PX;
      const step = Math.sin(e.t * 0.25) * 2;      // a slight waddle
      ctx.save();
      ctx.translate(x + e.w/2, y + e.h/2 + step);
      ctx.scale(e.dir < 0 ? -1 : 1, 1);
      ctx.drawImage(sp.canvas, 0,0,sp.w,sp.h, -w/2, -h/2, w, h);
      ctx.restore();
    }
  }

  // "+25" rising where something was eaten
  ctx.font = '16px Silkscreen, monospace'; ctx.textAlign = "center";
  for(const q of Game.pops){
    ctx.globalAlpha = Math.min(1, q.life/22);
    ctx.fillStyle = "#ffd98a";
    ctx.fillText(q.text, Math.round(q.x - Game.camX), Math.round(q.y - Game.camY));
  }
  ctx.globalAlpha = 1; ctx.textAlign = "left";
}

function drawHUD(){
  ctx.font = '20px Silkscreen, monospace'; ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(8,16,12,0.55)"; ctx.fillRect(14,14,256,64);
  ctx.fillStyle = "#b6ff8a"; ctx.fillText(String(Game.score), 26, 22);
  ctx.font = '11px Silkscreen, monospace'; ctx.fillStyle = "#9bc0a6";
  ctx.fillText("ledges " + Game.ledges + "   " + Game.dist + "m" +
               (Game.eaten ? "   food " + Game.food : ""), 26, 54);
  const best = Store.topScore();
  ctx.textAlign = "right"; ctx.fillStyle = "#ffc24b";
  ctx.fillText("best " + best, NODE_W-20, 24);
  ctx.fillStyle = "#9bc0a6";
  if(Cabinet.on) ctx.fillText("cabinet", NODE_W-20, 42);
  else { const who = Store.active(); ctx.fillText(who ? who.name : "no player — run not scored", NODE_W-20, 42); }
  ctx.textAlign = "left";
}
function drawDebug(){
  ctx.font = '11px Silkscreen, monospace';
  ctx.fillStyle = "rgba(8,16,12,0.8)"; ctx.fillRect(14, 92, 258, 104);
  ctx.fillStyle = "#7ec8ff";
  const lines = [
    "nodes live      " + chain.live,
    "spawned         " + chain.spawned,
    "destroyed       " + chain.destroyed,
    "bitmaps         " + (BITMAP_BYTES/1048576).toFixed(1) + " MB",
    "head index      " + (chain.head ? chain.head.index : "-"),
    "camera          " + Math.round(Game.camX) + " , " + Math.round(Game.camY)
  ];
  lines.forEach((l,i)=>ctx.fillText(l, 24, 100+i*16));
  ctx.strokeStyle = "rgba(126,200,255,0.7)"; ctx.lineWidth = 2;
  for(const n of chain.visible(Game.camX, NODE_W)){
    const x = n.x - Game.camX;
    ctx.strokeRect(x+1, 1 - Game.camY, NODE_W-2, NODE_H-2);
    ctx.fillStyle = "rgba(126,200,255,0.9)";
    ctx.fillText("node " + n.index, x+10, NODE_H-22 - Game.camY);
    ctx.strokeStyle = "rgba(255,120,90,0.8)";
    for(const b of n.boxes){ ctx.strokeRect(b.x - Game.camX, b.y - Game.camY, b.w, b.h); }
    ctx.strokeStyle = "rgba(126,200,255,0.7)";
  }
}
function render(){
  const sx = Game.shake ? (Math.random()-0.5)*Game.shake : 0;
  const sy = Game.shake ? (Math.random()-0.5)*Game.shake : 0;
  ctx.save(); ctx.translate(Math.round(sx), Math.round(sy));
  drawBackdrop(Game.camX, Game.camY);
  for(const n of chain.visible(Game.camX, NODE_W)){
    const art = n.ensureArt();
    if(art) ctx.drawImage(art, Math.round(n.x - Game.camX), Math.round(-Game.camY));
  }
  // slingshot band + arc
  const g = Game.gecko;
  if(Game.aim && g.mode==="rest"){
    const d = Game.aim.drag;
    const len = Math.min(Math.hypot(d.x,d.y), PHYS.maxDragPixels);
    const power = len/PHYS.maxDragPixels;
    if(len > 8){
      const nx = -d.x/Math.hypot(d.x,d.y), ny = -d.y/Math.hypot(d.x,d.y);
      const pts = simulate(nx*power*PHYS.maxLaunchSpeed, ny*power*PHYS.maxLaunchSpeed, Game.previewSteps());
      pts.forEach((p,i)=>{
        const a = 1 - i/pts.length;
        ctx.fillStyle = "rgba(245,251,239," + (0.12+a*0.55).toFixed(2) + ")";
        const s = PX * (i<3?2:1);
        ctx.fillRect(Math.round(p.x-Game.camX)-s/2, Math.round(p.y-Game.camY)-s/2, s, s);
      });
      const ux = d.x/Math.hypot(d.x,d.y), uy = d.y/Math.hypot(d.x,d.y);
      ctx.strokeStyle = "#ffc24b"; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(g.x - Game.camX, g.y - Game.camY);
      ctx.lineTo(g.x - Game.camX + ux*len, g.y - Game.camY + uy*len);
      ctx.stroke();
      ctx.fillStyle = "#ffc24b";
      ctx.fillRect(g.x - Game.camX + ux*len - 5, g.y - Game.camY + uy*len - 5, 10, 10);
      // power meter
      ctx.fillStyle = "rgba(8,16,12,0.6)"; ctx.fillRect(NODE_W/2-90, NODE_H-40, 180, 16);
      ctx.fillStyle = power>0.92 ? "#ff6f61" : "#8ef05c";
      ctx.fillRect(NODE_W/2-86, NODE_H-36, 172*power, 8);
    }
  }
  drawTokens();
  for(const p of Game.parts){
    ctx.globalAlpha = Math.min(1, p.life/14);
    ctx.fillStyle = p.c;
    ctx.fillRect(Math.round(p.x-Game.camX), Math.round(p.y-Game.camY), p.s, p.s);
  }
  ctx.globalAlpha = 1;
  if(Game.gecko) drawGecko(Game.gecko);
  drawRot(Game.camX, Game.t);
  if(Game.flash>0){ ctx.fillStyle = "rgba(142,240,92," + (Game.flash/30) + ")"; ctx.fillRect(0,0,NODE_W,NODE_H); }
  ctx.restore();
  drawHUD();
  if(Game.debug) drawDebug();
}

/* ---- main loop ---- */
let acc = 0, last = performance.now();
function frame(now){
  requestAnimationFrame(frame);
  const dt = Math.min(now - last, 120); last = now;
  if(Game.state === "live"){
    acc += dt;
    let guard = 0;
    while(acc >= 16.6667 && guard++ < 5){ Game.step(); acc -= 16.6667; }
  } else acc = 0;
  if(Game.gecko) render();
  else { ctx.fillStyle = "#07100d"; ctx.fillRect(0,0,NODE_W,NODE_H); drawBackdrop(0, 0); }
}
requestAnimationFrame(frame);
