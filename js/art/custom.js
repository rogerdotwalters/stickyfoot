"use strict";
/* Art pieces imported by the player as PNG/GIF/WebP, kept as data URLs, plus the starter templates. */

"use strict";
/* ---------- 2b. imported art pieces ----------
   A custom sprite is a small PNG kept as a data URL. The library lives in
   local storage; exported art files carry a copy of every sprite they use,
   so a segment you hand to someone else still draws correctly. */
const ART_MAX = 128;            // px, either side
const ART_MAX_BYTES = 220000;   // roughly, as a data URL

const CustomArt = {
  items: load("stickyfoot.art.v1", []),
  store(){ save("stickyfoot.art.v1", this.items); },
  get(id){ return this.items.find(a=>a.id===id) || null; },
  put(item){
    const i = this.items.findIndex(a=>a.id===item.id);
    if(i>=0) this.items[i] = item; else this.items.push(item);
    this.store();
  },
  drop(id){ this.items = this.items.filter(a=>a.id!==id); this.store(); delete SPRITES[id]; }
};
/* registerSpriteFromSrc() lives in sprites.js — the same decoder is used for
   manifest PNGs and for pieces the player imports. */

/* attach every custom sprite this art file uses, so the file stands alone */
function embedSprites(art){
  const used = new Set();
  for(const l of (art.layers||[])) for(const p of (l.pieces||[])) used.add(p.sprite);
  const out = {};
  used.forEach(id=>{ const a = CustomArt.get(id); if(a) out[id] = {label:a.label, w:a.w, h:a.h, src:a.src}; });
  if(Object.keys(out).length) art.sprites = out; else delete art.sprites;
  return art;
}
/* take the sprites out of an incoming art file and make them usable here */
function absorbSprites(art){
  if(!art || !art.sprites) return 0;
  let n = 0;
  for(const id of Object.keys(art.sprites)){
    const a = art.sprites[id];
    if(!a || typeof a.src !== "string") continue;
    if(!CustomArt.get(id)){ CustomArt.put({id, label:a.label||id, w:a.w|0, h:a.h|0, src:a.src}); n++; }
    if(!SPRITES[id]) registerSpriteFromSrc(id, a.src).then(()=>repaintArt());
  }
  return n;
}
function repaintArt(){
  if(typeof edBuildPalette === "function") edBuildPalette();
  if(typeof edPaint === "function") edPaint();
  if(typeof filmRender === "function") filmRender();
}
function readDataURL(file){
  return new Promise((res, rej)=>{
    const r = new FileReader();
    r.onload = ()=>res(r.result);
    r.onerror = ()=>rej(new Error("could not read " + file.name));
    r.readAsDataURL(file);
  });
}
function measureImage(src){
  return new Promise(res=>{
    const img = new Image();
    img.onload = ()=>res({w:img.naturalWidth||img.width, h:img.naturalHeight||img.height});
    img.onerror = ()=>res(null);
    img.src = src;
  });
}
function artIdFor(name){
  const base = "art_" + name.replace(/\.[^.]+$/,"").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"").slice(0,24);
  return base === "art_" ? "art_piece" : base;
}
$("#artImport").onclick = ()=>$("#artFile").click();
$("#artFile").onchange = async e=>{
  const files = Array.from(e.target.files||[]); e.target.value = "";
  let added = 0, notes = [];
  for(const file of files){
    if(!/^image\/(png|gif|webp|jpeg)$/.test(file.type)){ toast("“"+file.name+"” is not a PNG, GIF, WebP or JPEG."); continue; }
    let src;
    try{ src = await readDataURL(file); }catch(err){ toast(err.message); continue; }
    if(src.length > ART_MAX_BYTES){ toast("“"+file.name+"” is too heavy. Keep a block under about 30 KB — flat pixel art gets there easily."); continue; }
    const dim = await measureImage(src);
    if(!dim){ toast("“"+file.name+"” would not decode as an image."); continue; }
    if(dim.w < 4 || dim.h < 4 || dim.w > ART_MAX || dim.h > ART_MAX){
      toast("“"+file.name+"” is "+dim.w+" × "+dim.h+". Art must be between 4 and "+ART_MAX+" px on each side."); continue;
    }
    if(dim.w % 8 || dim.h % 8) notes.push(file.name+" is "+dim.w+"×"+dim.h+" — multiples of 16 line up with the grid");
    const id = artIdFor(file.name);
    const label = file.name.replace(/\.[^.]+$/,"").slice(0,9) || "piece";
    CustomArt.put({id, label, w:dim.w, h:dim.h, src});
    await registerSpriteFromSrc(id, src);
    if(typeof Ed !== "undefined") Ed.sprite = id;
    added++;
  }
  if(added) { repaintArt(); toast(added === 1 ? "Added 1 art piece — it is selected in the palette." : "Added "+added+" art pieces."); }
  if(notes.length) setTimeout(()=>toast(notes[0]), 2800);
};
/* ---- starter files ---- */
function makeTemplate(kind){
  const size = kind === "block16" ? 16 : 32;
  const c = document.createElement("canvas"); c.width = size; c.height = size;
  const x = c.getContext("2d");
  if(kind === "guide32"){
    x.fillStyle = "rgba(255,255,255,0.30)";
    [[0,0],[size-2,0],[0,size-2],[size-2,size-2]].forEach(([a,b])=>x.fillRect(a,b,2,2));
    x.fillStyle = "rgba(255,255,255,0.12)";
    x.fillRect(size/2-1, 0, 1, size); x.fillRect(0, size/2-1, size, 1);
  } else {
    x.fillStyle = "#6b7a6e"; x.fillRect(0,0,size,size);
    x.fillStyle = "#8d9c90"; x.fillRect(0,0,size,1); x.fillRect(0,0,1,size);
    x.fillStyle = "#454f48"; x.fillRect(0,size-1,size,1); x.fillRect(size-1,0,1,size);
    x.fillStyle = "rgba(0,0,0,0.20)";
    for(let i=1;i<size-1;i++){
      const h = hash32(i*31 + size);
      if(h < 0.3) x.fillRect(1 + Math.floor(h*4*(size-2)) % (size-2), i, 1, 1);
    }
  }
  return c;
}
function templateToBlob(c){ return new Promise(res=>c.toBlob(res, "image/png")); }
$("#artTemplate").onclick = ()=>$("#dlgTpl").showModal();
$("#tplClose").onclick = ()=>{ try{ $("#dlgTpl").close(); }catch(e){} };
async function grabTemplate(kind, filename){
  try{ $("#dlgTpl").close(); }catch(e){}
  const blob = await templateToBlob(makeTemplate(kind));
  if(!blob){ toast("This browser would not render the template."); return; }
  await saveFile(filename, blob);
}
$("#tplBlock16").onclick = ()=>grabTemplate("block16", "stickyfoot-block-16.png");
$("#tplBlock32").onclick = ()=>grabTemplate("block32", "stickyfoot-block-32.png");
$("#tplGuide32").onclick = ()=>grabTemplate("guide32", "stickyfoot-prop-guide-32.png");

/* bring the stored library back to life on load */
Promise.all(CustomArt.items.map(a=>registerSpriteFromSrc(a.id, a.src)))
  .then(ok=>{ if(ok.length) repaintArt(); });
