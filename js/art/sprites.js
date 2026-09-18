"use strict";
/* The sprite registry.
 *
 * Sprites are PNG files in assets/sprites/, listed in manifest.js. They are
 * loaded into canvases once at boot and drawn with nearest-neighbour scaling.
 *
 * Two sources, same code path:
 *   dev      each PNG is fetched from assets/sprites/<file>
 *   built    build.py writes js/art/sprite-data.js, which defines SPRITE_DATA
 *            as { id: "data:image/png;base64,..." }, and that wins
 *
 * Loading is deliberately not blocking. The game boots immediately and repaints
 * as sprites arrive; anything still missing draws as a magenta box rather than
 * a silent hole, so a broken filename is obvious instead of invisible.
 */

const ASSET_BASE = "assets/sprites/";

const SPRITES = {};       // id -> {canvas, w, h}
const SPRITE_CAPS = {};   // id -> id drawn on the first tiled row
const ART_PIECES = [];    // palette entries, in manifest order

for(const s of SPRITE_MANIFEST){
  if(s.cap) SPRITE_CAPS[s.id] = s.cap;
  if(s.label) ART_PIECES.push({id:s.id, label:s.label});
}

/** Decode any image source into the registry under `id`. Resolves true/false. */
function registerSpriteFromSrc(id, src){
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width  = img.naturalWidth  || img.width;
      c.height = img.naturalHeight || img.height;
      const x = c.getContext("2d");
      x.imageSmoothingEnabled = false;
      x.drawImage(img, 0, 0);
      SPRITES[id] = {canvas:c, w:c.width, h:c.height};
      res(true);
    };
    img.onerror = () => res(false);
    img.src = src;
  });
}

/** Load every sprite in the manifest. Called once from main.js. */
function loadSprites(){
  const inline = (typeof SPRITE_DATA !== "undefined") ? SPRITE_DATA : null;
  const jobs = SPRITE_MANIFEST.map(s =>
    registerSpriteFromSrc(s.id, (inline && inline[s.id]) || (ASSET_BASE + s.file))
      .then(ok => {
        if(!ok) console.warn("[stickyfoot] sprite failed to load:", s.id, s.file);
        return ok;
      })
  );
  return Promise.all(jobs).then(results => {
    const ok = results.filter(Boolean).length;
    if(typeof repaintArt === "function") repaintArt();
    if(ok < results.length) console.warn("[stickyfoot] " + (results.length-ok) + " sprite(s) missing");
    return ok;
  });
}

/**
 * Draw one art piece: tile its sprite across the rectangle, swapping in the cap
 * variant on the first row when the sprite declares one.
 *
 * With a biome, a piece that carries a role draws through that biome's table
 * instead — that is the whole of the reskinning mechanism.
 */
function drawPiece(ctx, p, biome){
  const id = (biome && p.role && biome.assets[p.role]) ? biome.assets[p.role] : p.sprite;
  const sp = SPRITES[id];
  if(!sp){   // not loaded, or an imported sprite that never arrived: show it
    ctx.save();
    ctx.fillStyle = "rgba(255,46,168,0.22)"; ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = "#ff2ea8"; ctx.lineWidth = 2; ctx.strokeRect(p.x+1, p.y+1, p.w-2, p.h-2);
    ctx.restore(); return;
  }
  const tw = sp.w*PX, th = sp.h*PX;
  const cap = SPRITE_CAPS[id] ? SPRITES[SPRITE_CAPS[id]] : null;
  const w = Math.max(PX, p.w|0), h = Math.max(PX, p.h|0);
  ctx.save();
  ctx.beginPath(); ctx.rect(p.x, p.y, w, h); ctx.clip();
  for(let y=0; y<h; y+=th){
    for(let x=0; x<w; x+=tw){
      const use = (cap && y===0) ? cap : sp;
      ctx.drawImage(use.canvas, 0,0,use.w,use.h, p.x+x, p.y+y, tw, th);
    }
  }
  ctx.restore();
}
