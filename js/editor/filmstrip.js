"use strict";
/* The slideshow strip under the canvas: thumbnails, selection, and inserting slides. */

/* ---- the slideshow strip ---- */
function slideThumb(seg, w, h){
  const c = document.createElement("canvas"); c.width = w||176; c.height = h||99;
  const x = c.getContext("2d"); x.imageSmoothingEnabled = false;
  x.fillStyle = "#0d1a14"; x.fillRect(0,0,c.width,c.height);
  x.save(); x.scale(c.width/NODE_W, c.height/NODE_H);
  const biome = Biomes.get(seg.art.biome);
  const layers = seg.art.layers.slice().sort((a,b)=>(a.z|0)-(b.z|0));
  for(const l of layers) for(const p of l.pieces) drawPiece(x, p, biome);
  for(const t of (seg.collision.tokens || [])){
    const sp = SPRITES[tokenSprite(t.kind, biome)];
    if(sp) x.drawImage(sp.canvas,0,0,sp.w,sp.h, t.x, t.y, t.w||TILE, t.h||TILE);
  }
  for(const e of (seg.collision.enemies || [])){
    const sp = SPRITES[enemySprite(e.kind)];
    if(sp) x.drawImage(sp.canvas,0,0,sp.w,sp.h, e.x, e.y, e.w||TILE, e.h||TILE);
  }
  for(const b of seg.collision.boxes){
    x.fillStyle = (BOX_COLORS[b.type]||"#fff") + "55";
    x.fillRect(b.x, b.y, b.w, b.h);
  }
  x.restore();
  return c;
}
function openInsert(at){
  const cur = Ed.slide + 1;
  $("#insText").textContent = "The new slide goes in at position " + (at+1) +
    ", between what is there now. Copy slide " + cur + " to keep its layout, or start empty.";
  const dlg = $("#dlgInsert");
  const done = copy => { try{ dlg.close(); }catch(e){} Ed.insert(at, copy ? Ed.map.nodes[Ed.slide] : null); };
  $("#insBlank").onclick = ()=>done(false);
  $("#insCopy").onclick  = ()=>done(true);
  $("#insCancel").onclick = ()=>{ try{ dlg.close(); }catch(e){} };
  dlg.showModal();
}
function filmRender(){
  const host = $("#film"); if(!host) return;
  host.innerHTML = "";
  const plus = at => {
    const b = document.createElement("button");
    b.className = "ins"; b.textContent = "+";
    b.title = "add a slide here";
    b.setAttribute("aria-label", "add a slide at position " + (at+1));
    b.onclick = e => { e.stopPropagation(); openInsert(at); };
    return b;
  };
  host.appendChild(plus(0));
  Ed.map.nodes.forEach((seg, i) => {
    const el = document.createElement("div");
    el.className = "slide" + (i===Ed.slide ? " sel" : "");
    el.setAttribute("role","tab");
    el.setAttribute("aria-selected", i===Ed.slide ? "true" : "false");
    el.appendChild(slideThumb(seg));
    const cap = document.createElement("div");
    cap.className = "slide-cap";
    cap.innerHTML = '<span class="slide-num">' + (i+1) + '</span><span>' + esc(seg.name || seg.id) + '</span>';
    el.appendChild(cap);
    const x = document.createElement("button");
    x.className = "slide-x"; x.textContent = "×"; x.title = "delete this slide";
    x.onclick = async ev => {
      ev.stopPropagation();
      if(await ask("Delete slide " + (i+1) + " (" + (seg.name||seg.id) + ") from this map?", "delete slide"))
        Ed.removeSlide(i);
    };
    el.appendChild(x);
    el.onclick = ()=>{ if(i!==Ed.slide) Ed.goto(i); };
    host.appendChild(el);
    host.appendChild(plus(i+1));
  });
  const count = document.createElement("span");
  count.className = "film-count";
  count.textContent = Ed.map.nodes.length + (Ed.map.nodes.length===1?" slide":" slides") +
    " · " + (Ed.map.nodes.length*NODE_W) + "px of world";
  host.appendChild(count);
  // keep the current slide in view without moving the page
  const sel = host.querySelector(".slide.sel");
  if(sel) host.scrollLeft = sel.offsetLeft - host.clientWidth/2 + sel.offsetWidth/2;
}
let thumbTimer = 0;
function filmTouchSoon(){
  clearTimeout(thumbTimer);
  thumbTimer = setTimeout(()=>{
    const host = $("#film"); if(!host) return;
    const c = host.querySelector(".slide.sel canvas"); if(!c) return;
    const fresh = slideThumb(Ed.map.nodes[Ed.slide], c.width, c.height);
    const cx = c.getContext("2d"); cx.clearRect(0,0,c.width,c.height); cx.drawImage(fresh,0,0);
    const cap = host.querySelector(".slide.sel .slide-cap span:last-child");
    if(cap) cap.textContent = Ed.seg.name || Ed.seg.id;
  }, 140);
}

function snapVal(v, ev){ return (Ed.grid && !(ev && ev.altKey)) ? Math.round(v/Ed.snap)*Ed.snap : Math.round(v); }
