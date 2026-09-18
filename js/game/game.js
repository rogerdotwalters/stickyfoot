"use strict";
/* The run itself: state, slingshot launch, fixed-step physics, collision resolution, scoring. */

/* ---------- 5. runtime ---------- */
const cv = $("#game"), ctx = cv.getContext("2d", {alpha:false});
ctx.imageSmoothingEnabled = false;

const chain = new NodeChain();
const Game = {
  state: "ready",          // ready | live | dead | paused
  camX: 0, camY: 0, creep: 0, started: false,
  score: 0, ledges: 0, maxX: 0, dist: 0, food: 0, eaten: 0,
  gecko: null, aim: null, lastBox: null,
  parts: [], pops: [], shake: 0, flash: 0, t: 0,
  debug: false, deathWhy: "",
  reset(forcedSeg){
    chain.reset();
    chain.mode = Store.prefs.useCustom;
    chain.forced = Array.isArray(forcedSeg) ? forcedSeg.filter(Boolean) : (forcedSeg ? [forcedSeg] : []);
    chain.ensureAhead(0, NODE_W);
    // the entry point in the collision file decides where a run begins
    const pads = chain.head.boxes.filter(b=>b.type==="platform"||b.type==="cling").sort((a,b)=>a.x-b.x);
    const entry = chain.head.seg && chain.head.seg.collision.entry;
    let pad = entry ? pads.find(b => entry.x >= b.x && entry.x <= b.x + b.w) : null;
    let gx;
    if(pad) gx = entry.x;
    else { pad = pads[0]; gx = pad ? Math.min(pad.x + 70, pad.x + pad.w - 40) : 120; }
    const gy = pad ? pad.y - PHYS.geckoHeight/2 : 300;
    this.gecko = { x:gx, y:gy, vx:0, vy:0, ang:0, mode:"rest", face:"top", squash:0, blink:0 };
    this.camX = gx - NODE_W/2;          // gecko dead centre before the first pull
    this.camY = CAM.followVertical ? clamp(gy - CAM.height, CAM.minY, CAM.maxY) : 0;
    this.startX = gx;
    this.creep = 0; this.started = false; this.score = 0; this.ledges = 0;
    this.maxX = gx; this.dist = 0; this.aim = null; this.lastBox = pad || null;
    this.food = 0; this.eaten = 0;
    this.parts.length = 0; this.pops.length = 0; this.shake = 0; this.flash = 0; this.deathWhy = "";
    this.state = "live";
  },
  /* ---- fixed-step physics ---- */
  step(){
    const g = this.gecko;
    this.t++;
    if(g.blink>0) g.blink--; else if(Math.random()<0.006) g.blink = 8;
    if(g.squash>0) g.squash--;

    if(g.mode === "fly"){
      // substep so nothing tunnels through a 64px ledge
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(g.vx), Math.abs(g.vy)) / 7));
      for(let s=0; s<steps && g.mode==="fly"; s++){
        g.vy += PHYS.gravity/steps;
        g.vx *= Math.pow(PHYS.airDrag, 1/steps);
        g.x += g.vx/steps; g.y += g.vy/steps;
        this.collide();
      }
      g.ang = Math.atan2(g.vy, g.vx);
      if(this.t % 3 === 0 && Math.hypot(g.vx,g.vy) > 6)
        this.spark(g.x - Math.cos(g.ang)*20, g.y - Math.sin(g.ang)*20, "#9ce85a", 0.5);
    }

    // camera, horizontally: eases onto the gecko, never rewinds, always creeping right
    if(this.started) this.creep = CAM.creepBase + Math.min(this.ledges*CAM.creepPerLedge, CAM.creepMax);
    const lead = this.started ? CAM.leadX : CAM.startLeadX;   // centred at rest, leading once flying
    const follow = Math.max(this.camX, g.x - lead);
    this.camX = lerp(this.camX, follow, CAM.ease) + this.creep;
    if(g.x > this.camX + CAM.maxLeadX) this.camX = g.x - CAM.maxLeadX;

    // camera, vertically: holds CAM.height until the gecko leaves the deadzone,
    // then follows up and down within CAM.minY..CAM.maxY. Horizontal is untouched.
    if(CAM.followVertical){
      const onScreen = g.y - this.camY;
      let want = this.camY;
      if(onScreen < CAM.height - CAM.deadzone)      want = g.y - (CAM.height - CAM.deadzone);
      else if(onScreen > CAM.height + CAM.deadzone) want = g.y - (CAM.height + CAM.deadzone);
      this.camY = lerp(this.camY, clamp(want, CAM.minY, CAM.maxY), CAM.verticalEase);
    } else this.camY = 0;

    chain.ensureAhead(this.camX, NODE_W);
    chain.cull(this.camX);

    this.maxX = Math.max(this.maxX, g.x);
    this.dist = Math.max(0, Math.floor((this.maxX - this.startX) / TILE));
    this.score = Math.max(0, this.ledges*SCORE.perLedge + Math.max(0,this.dist)*SCORE.perTile + this.food);

    this.moveEnemies();
    this.touchEnemies();
    if(this.state !== "live") return;
    this.eat();

    // floating score pops
    for(let i=this.pops.length-1;i>=0;i--){
      const q = this.pops[i]; q.y -= 0.7; q.life--;
      if(q.life<=0) this.pops.splice(i,1);
    }

    // particles
    for(let i=this.parts.length-1;i>=0;i--){
      const p = this.parts[i];
      p.vy += 0.16; p.x += p.vx; p.y += p.vy; p.life--;
      if(p.life<=0) this.parts.splice(i,1);
    }
    if(this.shake>0) this.shake--;
    if(this.flash>0) this.flash--;

    // death checks
    if(g.y - PHYS.geckoHeight > NODE_H + 140) this.die("You fell into the green");
    else if(g.x + PHYS.geckoWidth/2 < this.camX + 6) this.die("The rot caught you");
  },
  /* Enemies walk the ledge they stand on, turn at its edges, and never do
     anything cleverer than that. Bounds are resolved once, on first sight. */
  anchorEnemy(e){
    const boxes = chain.boxesNear(e.x, e.y, e.w, e.h + 10);
    let best = null;
    for(const b of boxes){
      if(b.type !== "platform" && b.type !== "cling") continue;
      if(Math.abs((e.y + e.h) - b.y) > 12) continue;          // must be standing on it
      if(e.x + e.w <= b.x || e.x >= b.x + b.w) continue;
      if(!best || b.y < best.y) best = b;
    }
    if(best){ e.minX = best.x; e.maxX = best.x + best.w; e.y = best.y - e.h; }
    else { e.minX = e.x - TILE*2; e.maxX = e.x + e.w + TILE*2; }   // nothing under it: pace in place
  },
  moveEnemies(){
    for(let n = chain.head; n; n = n.next){
      for(const e of n.enemies){
        if(e.minX === null) this.anchorEnemy(e);
        e.t++;
        e.x += enemySpeed(e.kind) * e.dir;
        if(e.x < e.minX){ e.x = e.minX; e.dir = 1; }
        else if(e.x + e.w > e.maxX){ e.x = e.maxX - e.w; e.dir = -1; }
      }
    }
  },
  touchEnemies(){
    const g = this.gecko;
    const L = g.x - PHYS.geckoWidth/2, T = g.y - PHYS.geckoHeight/2;
    for(let n = chain.head; n; n = n.next){
      if(!n.enemies.length) continue;
      for(const e of n.enemies){
        // a little forgiveness: the killing box is inset from the sprite
        const pad = 8;
        if(e.x + pad < L + PHYS.geckoWidth && e.x + e.w - pad > L &&
           e.y + pad < T + PHYS.geckoHeight && e.y + e.h - pad > T){
          this.die("A " + e.kind + " got you");
          return;
        }
      }
    }
  },
  /* Food tokens are checked every tick, resting or flying: a gecko standing
     next to a fly should get it. Weights come from settings.json. */
  eat(){
    const g = this.gecko;
    const L = g.x - PHYS.geckoWidth/2, T = g.y - PHYS.geckoHeight/2;
    for(let n = chain.head; n; n = n.next){
      if(!n.tokens.length) continue;
      if(n.x + NODE_W < L - 64 || n.x > L + PHYS.geckoWidth + 64) continue;
      for(const t of n.tokens){
        if(t.taken) continue;
        if(t.x < L + PHYS.geckoWidth && t.x + t.w > L && t.y < T + PHYS.geckoHeight && t.y + t.h > T){
          t.taken = true;
          const w = foodWeight(t.kind);
          this.food += w; this.eaten++;
          this.pops.push({x:t.x + t.w/2, y:t.y + t.h/2, text:"+"+w, life:46});
          this.burst(t.x + t.w/2, t.y + t.h/2, "#ffc24b", 8);
        }
      }
    }
  },
  collide(){
    const g = this.gecko;
    const L = g.x - PHYS.geckoWidth/2, T = g.y - PHYS.geckoHeight/2;
    const boxes = chain.boxesNear(L, T, PHYS.geckoWidth, PHYS.geckoHeight);
    for(const b of boxes){
      const ox = Math.min(L+PHYS.geckoWidth, b.x+b.w) - Math.max(L, b.x);
      const oy = Math.min(T+PHYS.geckoHeight, b.y+b.h) - Math.max(T, b.y);
      if(ox <= 0 || oy <= 0) continue;
      if(b.type === "hazard"){ this.die("Spiked"); return; }
      // resolve on the shallower axis
      const fromLeft = (L + PHYS.geckoWidth/2) < (b.x + b.w/2);
      const fromTop  = (T + PHYS.geckoHeight/2) < (b.y + b.h/2);
      if(ox < oy){
        g.x += fromLeft ? -ox : ox;
        if(b.type === "cling"){ this.stick(b, fromLeft ? "left" : "right"); return; }
        if(b.type === "bounce"){ g.vx = -g.vx*0.8; }
        else { g.vx = 0; g.vy *= 0.92; }
      } else {
        g.y += fromTop ? -oy : oy;
        if(b.type === "cling"){ this.stick(b, fromTop ? "top" : "bottom"); return; }
        if(b.type === "bounce"){ g.vy = -Math.abs(g.vy)*0.82; if(Math.abs(g.vy)<5) g.vy=-9;
          this.burst(g.x, b.y, "#b477e0"); return; }
        if(fromTop && g.vy >= 0){ this.stick(b, "top"); return; }
        g.vy = Math.abs(g.vy)*0.3;
      }
    }
  },
  stick(box, face){
    const g = this.gecko;
    g.vx = 0; g.vy = 0; g.mode = "rest"; g.face = face; g.squash = 7;
    if(face==="top")    { g.y = box.y - PHYS.geckoHeight/2; g.ang = 0; }
    if(face==="bottom") { g.y = box.y + box.h + PHYS.geckoHeight/2; g.ang = 0; }
    if(face==="left")   { g.x = box.x - PHYS.geckoWidth/2; g.ang = 0; }
    if(face==="right")  { g.x = box.x + box.w + PHYS.geckoWidth/2; g.ang = 0; }
    this.burst(g.x, g.y + PHYS.geckoHeight/2, face==="top" ? "#c8b08a" : "#ffc24b");
    if(box !== this.lastBox){
      this.lastBox = box; this.ledges++; this.flash = 6;
    }
  },
  die(why){
    if(this.state !== "live") return;
    this.state = "dead"; this.deathWhy = why; this.shake = 14;
    this.burst(this.gecko.x, this.gecko.y, "#ff6f61", 22);
    if(Cabinet.on){ Cabinet.endRun(); return; }
    const res = Store.recordRun(this.score, this.ledges, this.dist);
    showDeath(res.isBest);
  },
  burst(x,y,color,n=12){
    for(let i=0;i<n;i++) this.parts.push({x, y, vx:(Math.random()-0.5)*5, vy:-Math.random()*4,
      life:18+Math.random()*16, c:color, s:PX});
  },
  spark(x,y,color,p){
    if(Math.random()>p) return;
    this.parts.push({x,y,vx:(Math.random()-0.5)*1.2, vy:-Math.random()*0.6, life:10, c:color, s:PX});
  },
  /* ---- slingshot ---- */
  launchFrom(dragVec){
    const g = this.gecko;
    const len = Math.hypot(dragVec.x, dragVec.y);
    if(len < 14) return false;
    const power = Math.min(len, PHYS.maxDragPixels) / PHYS.maxDragPixels;
    const nx = -dragVec.x/len, ny = -dragVec.y/len;
    g.vx = nx * power * PHYS.maxLaunchSpeed;
    g.vy = ny * power * PHYS.maxLaunchSpeed;
    g.mode = "fly"; this.started = true;
    this.burst(g.x, g.y, "#a5ef65", 9);
    return true;
  },
  previewSteps(){ return Math.max(AIM.minPreviewSteps, AIM.previewSteps - this.ledges*AIM.previewFalloffPerLedge); }
};

/* ---- trajectory preview (same integrator as the real thing) ---- */
function simulate(vx, vy, steps){
  const pts = []; let x = Game.gecko.x, y = Game.gecko.y;
  for(let i=0;i<steps;i++){
    vy += PHYS.gravity; vx *= PHYS.airDrag; x += vx; y += vy;
    if(i%3===0) pts.push({x,y});
    if(y > NODE_H + 200) break;
  }
  return pts;
}
