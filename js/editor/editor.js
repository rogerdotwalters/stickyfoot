"use strict";
/* Editor state: the open map, the selected slide and layer, undo, canvas painting and mouse handling. */

/* ---------- 6. editor ---------- */
const ecv = $("#edit"), ectx = ecv.getContext("2d");
ectx.imageSmoothingEnabled = false;
const HANDLES = ["nw","n","ne","e","se","s","sw","w"];

/* ---- a map is an ordered list of slides; each slide is one node ---- */
function slideId(base){
  let id = base.replace(/[^a-zA-Z0-9_\-]/g,"_"), n = 2;
  const taken = new Set((Ed && Ed.map ? Ed.map.nodes : []).map(x=>x.id));
  while(taken.has(id)) id = base + "_" + (n++);
  return id;
}
function newSlide(n){ return emptySegment("seg_"+Date.now().toString(36)+"_"+n, "slide "+(n+1)); }
function newMap(name){
  return { id:"map_"+Date.now().toString(36), name:name||"untitled map", nodes:[ newSlide(0) ] };
}
function cloneSlide(seg){
  const c = JSON.parse(JSON.stringify(seg));
  c.id = slideId((seg.id||"seg") + "_copy");
  c.name = (seg.name||"slide") + " copy";
  c.collision.id = c.art.id = c.id;
  return c;
}
/* The example map is the opening stretch of the built-in world, copied so
   you can pull it apart without touching the original. */
function exampleMap(){
  const nodes = Pool.builtin.slice(0,6).map((seg,i)=>{
    const c = JSON.parse(JSON.stringify(seg));
    c.id = "fern_hollow_" + String(i+1).padStart(2,"0");
    c.name = "Fern Hollow " + (i+1);
    c.collision.id = c.art.id = c.id;
    return c;
  });
  return { id:"map_fern_hollow", name:"Fern Hollow (example)", nodes };
}

const Ed = {
  map: null, slide: 0, seg: null, dirty: false,
  layer: "midground",
  tool: "place",
  sprite: "dirt",
  boxType: "platform",
  sel: null,
  grid: true, snap: 16,
  foodKind: "fly",
  foeKind: "spider",
  vis: {background:true, midground:true, foreground:true, collision:true, tokens:true, enemies:true},
  undo: [],
  drag: null,
  init(){
    const saved = Store.activeMap();
    this.map = saved ? JSON.parse(JSON.stringify(saved)) : newMap();
    if(!Array.isArray(this.map.nodes) || !this.map.nodes.length) this.map.nodes = [newSlide(0)];
    this.dirty = false;
    this.slide = 0; this.seg = this.map.nodes[0];
  },
  openMap(map){
    this.map = JSON.parse(JSON.stringify(map));
    if(!this.map.nodes.length) this.map.nodes = [newSlide(0)];
    for(const n of this.map.nodes){ absorbSprites(n.art); delete n.art.sprites; }
    this.undo.length = 0; this.dirty = false;
    this.goto(0);
  },
  goto(i){
    this.slide = clamp(i, 0, this.map.nodes.length-1);
    this.seg = this.map.nodes[this.slide];
    this.sel = null; this.drag = null;
    filmRender(); edBuildBiomeBar(); edSyncFields(); edPaint();
  },
  useSeg(seg){ this.map.nodes[this.slide] = seg; this.seg = seg; this.dirty = true; },
  insert(at, copyFrom){
    const seg = copyFrom ? cloneSlide(copyFrom) : newSlide(clamp(at,0,this.map.nodes.length));
    this.map.nodes.splice(clamp(at,0,this.map.nodes.length), 0, seg);
    this.dirty = true; this.undo.length = 0;
    this.goto(clamp(at,0,this.map.nodes.length-1));
    toast(copyFrom ? "Copied into slide " + (this.slide+1) : "Slide " + (this.slide+1) + " added");
  },
  removeSlide(i){
    if(this.map.nodes.length <= 1){ toast("A map needs at least one slide."); return; }
    this.map.nodes.splice(i,1);
    this.dirty = true; this.undo.length = 0;
    this.goto(Math.min(i, this.map.nodes.length-1));
  },
  pushUndo(){
    this.undo.push({i:this.slide, json:JSON.stringify(this.seg)});
    if(this.undo.length>40) this.undo.shift();
    this.dirty = true;
  },
  popUndo(){
    const u = this.undo.pop(); if(!u){ toast("Nothing left to undo."); return; }
    const i = clamp(u.i, 0, this.map.nodes.length-1);
    this.map.nodes[i] = JSON.parse(u.json);
    this.slide = i; this.seg = this.map.nodes[i]; this.sel = null;
    filmRender(); edSyncFields(); edPaint();
  },
  layerPieces(name){
    const l = this.seg.art.layers.find(l=>l.name===name);
    return l ? l.pieces : [];
  },
  activeItems(){
    if(this.layer==="collision") return this.seg.collision.boxes;
    if(this.layer==="tokens")    return this.seg.collision.tokens;
    if(this.layer==="enemies")   return this.seg.collision.enemies;
    return this.layerPieces(this.layer);
  }
};
Ed.init();

/* ---- sidebar ---- */
function edBuildLayers(){
  const host = $("#layerList"); host.innerHTML = "";
  const rows = [
    {key:"foreground", label:"foreground art"},
    {key:"collision",  label:"collision boxes"},
    {key:"tokens",     label:"food tokens"},
    {key:"enemies",    label:"enemies"},
    {key:"midground",  label:"midground art"},
    {key:"background", label:"background art"}
  ];
  for(const r of rows){
    const el = document.createElement("div");
    el.className = "layer-row" + (Ed.layer===r.key?" sel":"");
    el.innerHTML = '<button class="eye" title="show or hide">'+(Ed.vis[r.key]?"◉":"○")+'</button><span>'+r.label+'</span>';
    el.onclick = e => {
      if(e.target.classList.contains("eye")){ Ed.vis[r.key] = !Ed.vis[r.key]; }
      else { Ed.layer = r.key; Ed.sel = null; }
      edBuildLayers(); edBuildPalette(); edPaint(); edSyncFields();
    };
    host.appendChild(el);
  }
}
function edBuildPalette(){
  const host = $("#palette"); host.innerHTML = "";
  if(Ed.layer === "enemies"){
    $("#paletteHint").textContent = "Enemies walk the ledge they are standing on and turn at its edges. " +
      "They never chase. Drop one on a platform; speeds are in settings.json.";
    for(const kind of enemyKinds()){
      const el = document.createElement("div");
      el.className = "swatch" + (Ed.foeKind===kind?" sel":"");
      const c = document.createElement("canvas"); c.width=32; c.height=32;
      const cx = c.getContext("2d"); cx.imageSmoothingEnabled=false;
      const sp = SPRITES[enemySprite(kind)];
      if(sp) cx.drawImage(sp.canvas,0,0,sp.w,sp.h,0,0,32,32);
      else { cx.fillStyle="rgba(255,46,168,0.25)"; cx.fillRect(0,0,32,32); }
      el.appendChild(c);
      el.appendChild(document.createTextNode(kind));
      el.onclick = ()=>{ Ed.foeKind = kind; edBuildPalette(); };
      host.appendChild(el);
    }
    return;
  }
  if(Ed.layer === "tokens"){
    $("#paletteHint").textContent = "Food tokens add their weight to the score when the gecko touches them. " +
      "The weights, and the list of kinds, live in settings.json.";
    for(const kind of foodKinds()){
      const el = document.createElement("div");
      el.className = "swatch" + (Ed.foodKind===kind?" sel":"");
      const c = document.createElement("canvas"); c.width=32; c.height=32;
      const cx = c.getContext("2d"); cx.imageSmoothingEnabled=false;
      const sp = SPRITES[foodSprite(kind)];
      if(sp) cx.drawImage(sp.canvas,0,0,sp.w,sp.h,0,0,32,32);
      else { cx.fillStyle="rgba(255,46,168,0.25)"; cx.fillRect(0,0,32,32); }
      el.appendChild(c);
      el.appendChild(document.createTextNode(kind + " " + foodWeight(kind)));
      el.onclick = ()=>{ Ed.foodKind = kind; edBuildPalette(); };
      host.appendChild(el);
    }
    return;
  }
  if(Ed.layer === "collision"){
    $("#paletteHint").textContent = "Collision boxes are the only thing the physics reads. Drag the corners to resize, and put art underneath on the midground layer.";
    for(const t of BOX_TYPES){
      const el = document.createElement("div");
      el.className = "swatch" + (Ed.boxType===t?" sel":"");
      el.innerHTML = '<div style="height:34px;border:2px solid '+BOX_COLORS[t]+';background:'+BOX_COLORS[t]+'33;margin-bottom:2px"></div>'+t;
      el.onclick = ()=>{ Ed.boxType = t; edBuildPalette(); };
      host.appendChild(el);
    }
    return;
  }
  $("#paletteHint").textContent = "Art is decoration only — nothing here stops the gecko. Soil and stone grow a capped top row automatically; imported pieces are dashed.";
  const list = ART_PIECES.concat(CustomArt.items.map(a=>({id:a.id, label:a.label, mine:true})));
  for(const p of list){
    const el = document.createElement("div");
    el.className = "swatch" + (Ed.sprite===p.id?" sel":"") + (p.mine?" mine":"");
    const c = document.createElement("canvas"); c.width=32; c.height=32;
    const cx = c.getContext("2d"); cx.imageSmoothingEnabled=false;
    const sp = SPRITES[SPRITE_CAPS[p.id]||p.id];
    if(sp){
      const k = Math.min(32/sp.w, 32/sp.h), dw = Math.max(1,Math.round(sp.w*k)), dh = Math.max(1,Math.round(sp.h*k));
      cx.drawImage(sp.canvas,0,0,sp.w,sp.h,(32-dw)>>1,(32-dh)>>1,dw,dh);
    } else {
      cx.fillStyle = "rgba(255,46,168,0.25)"; cx.fillRect(0,0,32,32);
    }
    el.appendChild(c);
    el.appendChild(document.createTextNode(p.label));
    const role = roleOfSprite(p.id);
    if(role){
      const tag = document.createElement("div");
      tag.style.cssText = "font-size:9px;color:var(--amber);line-height:1.1";
      const cat = BLOCK_CATEGORIES.find(c=>c.id===role);
      tag.textContent = cat ? cat.label : role;
      el.appendChild(tag);
      el.title = p.id + " — category: " + role;
    } else el.title = p.id + " — no category, so biome swaps skip it";
    el.onclick = ()=>{ Ed.sprite = p.id; edBuildPalette(); };
    if(p.mine){
      const x = document.createElement("button");
      x.className = "swatch-x"; x.textContent = "×"; x.title = "remove this piece from the palette";
      x.onclick = async ev => {
        ev.stopPropagation();
        let uses = 0;
        for(const n of Ed.map.nodes) for(const l of n.art.layers) uses += l.pieces.filter(q=>q.sprite===p.id).length;
        const msg = uses ? "“"+p.label+"” is placed "+uses+" time"+(uses===1?"":"s")+" in this map. Remove the piece and everything drawn with it?"
                         : "Remove “"+p.label+"” from the palette?";
        if(!await ask(msg, "remove piece")) return;
        if(uses){
          Ed.pushUndo();
          for(const n of Ed.map.nodes) for(const l of n.art.layers)
            l.pieces = l.pieces.filter(q=>q.sprite!==p.id);
        }
        CustomArt.drop(p.id);
        if(Ed.sprite===p.id) Ed.sprite = "dirt";
        Ed.sel = null; repaintArt(); edSyncFields();
      };
      el.appendChild(x);
    }
    host.appendChild(el);
  }
}
function edBuildSegList(){
  const host = $("#segList"); host.innerHTML = "";
  if(!Store.maps.length){
    host.innerHTML = '<div class="ed-hint">No saved maps yet. Build a few slides and press “save map”, or load the example to take it apart.</div>';
    return;
  }
  for(const m of Store.maps){
    const row = document.createElement("div");
    row.className = "segrow";
    const n = (m.nodes||[]).length;
    row.innerHTML = '<span title="'+esc(m.id)+'">'+esc(m.name)+' <span class="slide-num">'+n+'</span></span>';
    if(m.id === Store.activeMapId) row.style.borderColor = "var(--lime)";
    const open = document.createElement("button"); open.className="btn small"; open.textContent="open";
    open.onclick = async ()=>{
      if(Ed.dirty && !await ask("“"+Ed.map.name+"” has unsaved changes. Open “"+m.name+"” anyway?", "discard and open")) return;
      Ed.openMap(m); Store.activeMapId = m.id; Store.saveMaps();
      edBuildSegList(); refreshWorldButton(); toast("Opened "+m.name);
    };
    const del = document.createElement("button"); del.className="btn small danger"; del.textContent="×"; del.title="delete map";
    del.onclick = async ()=>{
      if(!await ask("Delete the map “"+m.name+"” and all "+n+" of its slides?", "delete map")) return;
      Store.maps = Store.maps.filter(x=>x.id!==m.id);
      if(Store.activeMapId===m.id) Store.activeMapId = Store.maps[0] ? Store.maps[0].id : null;
      Store.saveMaps(); edBuildSegList(); refreshWorldButton();
    };
    row.append(open, del);
    host.appendChild(row);
  }
}
function edSyncFields(){
  $("#edName").value = Ed.seg.name;
  $("#edId").value = Ed.seg.id;
  $("#edMapName").value = Ed.map.name;
  $("#edTitle").textContent = Ed.map.name + (Ed.dirty ? " •" : "") +
    "  ·  slide " + (Ed.slide+1) + " of " + Ed.map.nodes.length +
    "  ·  " + Ed.seg.collision.boxes.length + " boxes";
  $("#edGrid").textContent = Ed.grid ? "grid on" : "grid off";
  $$(".ed-bar [data-tool]").forEach(b=>b.classList.toggle("primary", b.dataset.tool===Ed.tool));
  const s = Ed.sel;
  $("#selW").disabled = !s; $("#selH").disabled = !s;
  if(s){
    $("#selW").value = s.w; $("#selH").value = s.h;
    const what = s.type ? ("collision · "+s.type)
               : (s.kind && Ed.layer==="enemies") ? ("enemy · "+s.kind+" · speed "+enemySpeed(s.kind))
               : s.kind ? ("food · "+s.kind+" · +"+foodWeight(s.kind))
               : ("art · "+s.sprite);
    $("#selInfo").textContent = what + "  at " + s.x + "," + s.y;
  } else {
    $("#selW").value = ""; $("#selH").value = "";
    $("#selInfo").textContent = "Nothing selected. Click a piece on the active layer to pick it up.";
  }
  const px = Ed.seg.art.layers.reduce((n,l)=>n+l.pieces.length,0);
  $("#edStatus").textContent = NODE_W+" × "+NODE_H+" — "+px+" art pieces, "+
    Ed.seg.collision.boxes.length+" boxes, "+(Ed.seg.collision.tokens||[]).length+" tokens, "+
    (Ed.seg.collision.enemies||[]).length+" enemies";
}

/* ---- painting ---- */
function edPaint(){
  ectx.fillStyle = "#0d1a14"; ectx.fillRect(0,0,NODE_W,NODE_H);
  // grid
  if(Ed.grid){
    ectx.strokeStyle = "rgba(120,180,140,0.10)"; ectx.lineWidth = 1;
    for(let x=0;x<=NODE_W;x+=Ed.snap){ ectx.beginPath(); ectx.moveTo(x+.5,0); ectx.lineTo(x+.5,NODE_H); ectx.stroke(); }
    for(let y=0;y<=NODE_H;y+=Ed.snap){ ectx.beginPath(); ectx.moveTo(0,y+.5); ectx.lineTo(NODE_W,y+.5); ectx.stroke(); }
    ectx.strokeStyle = "rgba(120,180,140,0.26)";
    for(let x=0;x<=NODE_W;x+=TILE){ ectx.beginPath(); ectx.moveTo(x+.5,0); ectx.lineTo(x+.5,NODE_H); ectx.stroke(); }
    for(let y=0;y<=NODE_H;y+=TILE){ ectx.beginPath(); ectx.moveTo(0,y+.5); ectx.lineTo(NODE_W,y+.5); ectx.stroke(); }
  }
  // art layers, back to front
  const layers = Ed.seg.art.layers.slice().sort((a,b)=>(a.z|0)-(b.z|0));
  for(const layer of layers){
    if(!Ed.vis[layer.name]) continue;
    ectx.globalAlpha = (Ed.layer==="collision" || Ed.layer===layer.name) ? 1 : 0.5;
    const biome = Biomes.get(Ed.seg.art.biome);
    for(const p of layer.pieces) drawPiece(ectx, p, biome);
  }
  ectx.globalAlpha = 1;
  // collision overlay
  if(Ed.vis.collision){
    for(const b of Ed.seg.collision.boxes){
      const col = BOX_COLORS[b.type] || "#fff";
      ectx.fillStyle = col + (Ed.layer==="collision" ? "44" : "22");
      ectx.fillRect(b.x, b.y, b.w, b.h);
      ectx.strokeStyle = col; ectx.lineWidth = 2;
      ectx.strokeRect(b.x+1, b.y+1, b.w-2, b.h-2);
      if(Ed.layer==="collision"){
        ectx.fillStyle = col; ectx.font = '11px Silkscreen, monospace';
        ectx.fillText(b.type, b.x+5, b.y+15);
      }
    }
  }
  // food tokens
  if(Ed.vis.tokens){
    for(const t of Ed.seg.collision.tokens){
      const sp = SPRITES[tokenSprite(t.kind, Biomes.get(Ed.seg.art.biome))];
      if(sp){
        const w = sp.w*PX, h = sp.h*PX;
        ectx.drawImage(sp.canvas,0,0,sp.w,sp.h, t.x + (t.w-w)/2, t.y + (t.h-h)/2, w, h);
      } else {
        ectx.fillStyle = "rgba(255,46,168,0.28)"; ectx.fillRect(t.x, t.y, t.w, t.h);
      }
      if(Ed.layer==="tokens"){
        ectx.strokeStyle = "#ffd98a"; ectx.lineWidth = 2; ectx.setLineDash([5,4]);
        ectx.strokeRect(t.x+1, t.y+1, t.w-2, t.h-2); ectx.setLineDash([]);
        ectx.fillStyle = "#ffd98a"; ectx.font = '11px Silkscreen, monospace';
        ectx.fillText("+" + foodWeight(t.kind), t.x+4, t.y+14);
      }
    }
  }

  // enemies
  if(Ed.vis.enemies){
    for(const e of Ed.seg.collision.enemies){
      const sp = SPRITES[enemySprite(e.kind)];
      if(sp){
        const w = sp.w*PX, h = sp.h*PX;
        ectx.drawImage(sp.canvas,0,0,sp.w,sp.h, e.x + (e.w-w)/2, e.y + (e.h-h)/2, w, h);
      } else { ectx.fillStyle = "rgba(255,46,168,0.28)"; ectx.fillRect(e.x, e.y, e.w, e.h); }
      if(Ed.layer==="enemies"){
        ectx.strokeStyle = "#ff9c92"; ectx.lineWidth = 2; ectx.setLineDash([5,4]);
        ectx.strokeRect(e.x+1, e.y+1, e.w-2, e.h-2); ectx.setLineDash([]);
        // show the ledge it will end up patrolling
        const pad = Ed.seg.collision.boxes.filter(b=>(b.type==="platform"||b.type==="cling") &&
          Math.abs((e.y+e.h)-b.y) <= 12 && e.x+e.w > b.x && e.x < b.x+b.w)[0];
        ectx.strokeStyle = "#ff9c92"; ectx.lineWidth = 3;
        if(pad){
          ectx.beginPath(); ectx.moveTo(pad.x+2, pad.y-3); ectx.lineTo(pad.x+pad.w-2, pad.y-3); ectx.stroke();
        } else {
          ectx.fillStyle = "#ff9c92"; ectx.font = '11px Silkscreen, monospace';
          ectx.fillText("no ledge under it", e.x, e.y-4);
        }
      }
    }
  }

  // entry marker
  const e = Ed.seg.collision.entry || {x:96,y:380};
  const gs = SPRITES.gecko_idle;
  if(gs){
    ectx.globalAlpha = .75;
    ectx.drawImage(gs.canvas,0,0,gs.w,gs.h, e.x-gs.w*PX/2, e.y-gs.h*PX/2, gs.w*PX, gs.h*PX);
    ectx.globalAlpha = 1;
  } else {
    ectx.strokeStyle = "#8ef05c"; ectx.lineWidth = 2; ectx.strokeRect(e.x-24, e.y-16, 48, 32);
  }
  // selection
  if(Ed.sel){
    const s = Ed.sel;
    ectx.strokeStyle = "#ffffff"; ectx.setLineDash([6,4]); ectx.lineWidth = 2;
    ectx.strokeRect(s.x, s.y, s.w, s.h); ectx.setLineDash([]);
    ectx.fillStyle = "#ffffff";
    for(const h of HANDLES){ const p = handlePos(s,h); ectx.fillRect(p.x-6,p.y-6,12,12); }
  }
  // frame
  ectx.strokeStyle = "rgba(255,194,75,0.6)"; ectx.lineWidth = 4;
  ectx.strokeRect(2,2,NODE_W-4,NODE_H-4);
  filmTouchSoon();
}
function handlePos(s,h){
  const cx = s.x+s.w/2, cy = s.y+s.h/2, r = s.x+s.w, b = s.y+s.h;
  return {nw:{x:s.x,y:s.y}, n:{x:cx,y:s.y}, ne:{x:r,y:s.y}, e:{x:r,y:cy},
          se:{x:r,y:b}, s:{x:cx,y:b}, sw:{x:s.x,y:b}, w:{x:s.x,y:cy}}[h];
}
function edToWorld(ev){
  const r = ecv.getBoundingClientRect(); const s = NODE_W/r.width;
  return { x:(ev.clientX-r.left)*s, y:(ev.clientY-r.top)*s };
}
function hitTest(p){
  const items = Ed.activeItems();
  for(let i=items.length-1;i>=0;i--){
    const it = items[i];
    if(p.x>=it.x && p.x<=it.x+it.w && p.y>=it.y && p.y<=it.y+it.h) return it;
  }
  return null;
}
ecv.addEventListener("pointerdown", ev=>{
  ecv.setPointerCapture(ev.pointerId);
  const p = edToWorld(ev);
  // handle grab first
  if(Ed.sel){
    for(const h of HANDLES){
      const hp = handlePos(Ed.sel,h);
      if(Math.abs(p.x-hp.x)<11 && Math.abs(p.y-hp.y)<11){
        Ed.pushUndo();
        Ed.drag = {kind:"resize", h, start:p, o:{...Ed.sel}};
        return;
      }
    }
  }
  const hit = hitTest(p);
  if(hit){
    Ed.sel = hit; Ed.pushUndo();
    Ed.drag = {kind:"move", start:p, o:{...hit}};
    edPaint(); edSyncFields(); return;
  }
  if(Ed.tool === "place"){
    Ed.pushUndo();
    const x = snapVal(p.x-TILE/2, ev), y = snapVal(p.y-TILE/2, ev);
    let item;
    if(Ed.layer==="collision"){ item = {x, y, w:TILE*3, h:TILE, type:Ed.boxType}; Ed.seg.collision.boxes.push(item); }
    else if(Ed.layer==="tokens"){ item = {x, y, w:TILE, h:TILE, kind:Ed.foodKind}; Ed.seg.collision.tokens.push(item); }
    else if(Ed.layer==="enemies"){ item = {x, y, w:TILE, h:TILE, kind:Ed.foeKind}; Ed.seg.collision.enemies.push(item); }
    else {
      item = {sprite:Ed.sprite, x, y, w:TILE, h:TILE};
      const role = roleOfSprite(Ed.sprite);
      if(role) item.role = role;            // what makes the piece biome-swappable
      Ed.layerPieces(Ed.layer).push(item);
    }
    Ed.sel = item;
    Ed.drag = {kind:"resize", h:"se", start:{x:item.x+item.w, y:item.y+item.h}, o:{...item}};
  } else {
    Ed.sel = null;
  }
  edPaint(); edSyncFields();
});
ecv.addEventListener("pointermove", ev=>{
  if(!Ed.drag || !Ed.sel) return;
  const p = edToWorld(ev), d = Ed.drag, s = Ed.sel, o = d.o;
  if(d.kind==="move"){
    s.x = clamp(snapVal(o.x + (p.x-d.start.x), ev), 0, NODE_W-s.w);
    s.y = clamp(snapVal(o.y + (p.y-d.start.y), ev), -TILE, NODE_H);
  } else {
    let x1=o.x, y1=o.y, x2=o.x+o.w, y2=o.y+o.h;
    const nx = clamp(snapVal(p.x, ev), 0, NODE_W), ny = clamp(snapVal(p.y, ev), 0, NODE_H);
    if(d.h.includes("w")) x1 = nx; if(d.h.includes("e")) x2 = nx;
    if(d.h.includes("n")) y1 = ny; if(d.h.includes("s")) y2 = ny;
    s.x = Math.min(x1,x2); s.y = Math.min(y1,y2);
    s.w = Math.max(Ed.snap, Math.abs(x2-x1)); s.h = Math.max(Ed.snap, Math.abs(y2-y1));
  }
  edPaint(); edSyncFields();
});
function edEnd(){ Ed.drag = null; edSyncFields(); }
ecv.addEventListener("pointerup", edEnd);
ecv.addEventListener("pointercancel", edEnd);

function edDeleteSel(){
  if(!Ed.sel) return;
  Ed.pushUndo();
  const items = Ed.activeItems();
  const i = items.indexOf(Ed.sel);
  if(i>=0) items.splice(i,1);
  Ed.sel = null; edPaint(); edSyncFields();
}
$("#selW").oninput = e=>{ if(Ed.sel){ Ed.sel.w = Math.max(8, +e.target.value||8); edPaint(); } };
$("#selH").oninput = e=>{ if(Ed.sel){ Ed.sel.h = Math.max(8, +e.target.value||8); edPaint(); } };
$("#edDelete").onclick = edDeleteSel;
$("#edUndo").onclick = ()=>Ed.popUndo();
$("#edGrid").onclick = ()=>{ Ed.grid = !Ed.grid; edSyncFields(); edPaint(); };
$$(".ed-bar [data-tool]").forEach(b=> b.onclick = ()=>{ Ed.tool = b.dataset.tool; Ed.sel=null; edSyncFields(); edPaint(); });
$("#edClear").onclick = ()=>{
  Ed.pushUndo();
  if(Ed.layer==="collision") Ed.seg.collision.boxes.length = 0;
  else if(Ed.layer==="tokens") Ed.seg.collision.tokens.length = 0;
  else if(Ed.layer==="enemies") Ed.seg.collision.enemies.length = 0;
  else Ed.layerPieces(Ed.layer).length = 0;
  Ed.sel = null; edPaint(); edSyncFields();
};
$("#edNew").onclick = async ()=>{
  if(Ed.dirty && !await ask("“"+Ed.map.name+"” has unsaved changes. Start a new map anyway?", "discard and start")) return;
  Ed.openMap(newMap("map "+(Store.maps.length+1)));
  toast("New map with one empty slide.");
};
$("#edExample").onclick = async ()=>{
  if(Ed.dirty && !await ask("“"+Ed.map.name+"” has unsaved changes. Load the example anyway?", "discard and load")) return;
  const ex = exampleMap();
  ex.id = "map_fern_hollow_" + Date.now().toString(36);   // a copy, not the original
  Ed.openMap(ex);
  toast("Loaded the example map — 6 slides, yours to break.");
};
$("#edName").oninput = e=>{ Ed.seg.name = e.target.value || "untitled slide"; Ed.dirty = true; edSyncFields(); filmTouchSoon(); };
$("#edMapName").oninput = e=>{ Ed.map.name = e.target.value || "untitled map"; Ed.dirty = true; edSyncFields(); };
$("#edId").oninput = e=>{
  const id = (e.target.value||"").trim().replace(/[^a-zA-Z0-9_\-]/g,"_") || "seg";
  Ed.seg.id = Ed.seg.collision.id = Ed.seg.art.id = id;
  Ed.dirty = true;
};
document.addEventListener("keydown", ev=>{
  if($("#screen-editor").classList.contains("on")){
    if(ev.target.tagName==="INPUT") return;
    if(ev.key==="Delete"||ev.key==="Backspace"){ edDeleteSel(); ev.preventDefault(); }
    if(ev.key==="z" && (ev.ctrlKey||ev.metaKey)){ Ed.popUndo(); ev.preventDefault(); }
    if(Ed.sel && ["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(ev.key)){
      const d = ev.shiftKey ? 1 : Ed.snap;
      if(ev.key==="ArrowLeft") Ed.sel.x -= d; if(ev.key==="ArrowRight") Ed.sel.x += d;
      if(ev.key==="ArrowUp") Ed.sel.y -= d; if(ev.key==="ArrowDown") Ed.sel.y += d;
      edPaint(); edSyncFields(); ev.preventDefault();
    }
    if(ev.key==="d" && Ed.sel){
      Ed.pushUndo();
      const copy = JSON.parse(JSON.stringify(Ed.sel)); copy.x += TILE;
      Ed.activeItems().push(copy); Ed.sel = copy; edPaint(); edSyncFields();
    }
  }
});
