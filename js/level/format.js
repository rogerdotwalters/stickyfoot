"use strict";
/* The segment file format: what a collision file and an art file must contain, and how a pair is validated. */

/* ---------- 3. segment format ---------- */
const COL_FORMAT = "stickyfoot.collision", ART_FORMAT = "stickyfoot.art", MAP_FORMAT = "stickyfoot.map";
const LAYERS = [
  {name:"background", z:0},
  {name:"midground",  z:1},
  {name:"foreground", z:2}
];
function emptySegment(id, name){
  return {
    id, name: name || "untitled segment",
    collision: { format:COL_FORMAT, version:1, id, width:NODE_W, height:NODE_H,
                 entry:{x:96, y:380}, boxes:[], tokens:[], enemies:[] },
    art:       { format:ART_FORMAT, version:1, id, width:NODE_W, height:NODE_H,
                 biome: BUILTIN_BIOMES[0].id,
                 layers: LAYERS.map(l=>({name:l.name, z:l.z, pieces:[]})) }
  };
}
/* Validates a loaded pair. Returns {ok, why} — the runtime refuses to
   link anything that is not exactly one tablet frame. */
function validatePair(col, art){
  if(!col || col.format!==COL_FORMAT) return {ok:false, why:"collision file has the wrong format tag"};
  if(!art || art.format!==ART_FORMAT) return {ok:false, why:"art file has the wrong format tag"};
  if(!col.id || !art.id) return {ok:false, why:"both files need an id"};
  if(col.id !== art.id) return {ok:false, why:"the two files have different ids ("+col.id+" / "+art.id+")"};
  for(const f of [col, art]){
    if(f.width!==NODE_W || f.height!==NODE_H)
      return {ok:false, why:"every segment must be "+NODE_W+" × "+NODE_H+", got "+f.width+" × "+f.height};
  }
  if(!Array.isArray(col.boxes)) return {ok:false, why:"collision file has no boxes array"};
  for(const b of col.boxes){
    if(!BOX_TYPES.includes(b.type)) return {ok:false, why:"unknown box type: "+b.type};
    if([b.x,b.y,b.w,b.h].some(n=>typeof n!=="number")) return {ok:false, why:"a box has non-numeric bounds"};
  }
  if(col.tokens !== undefined){
    if(!Array.isArray(col.tokens)) return {ok:false, why:"tokens must be an array"};
    for(const t of col.tokens){
      if(typeof t.kind !== "string") return {ok:false, why:"a food token has no kind"};
      if(typeof t.x !== "number" || typeof t.y !== "number") return {ok:false, why:"a food token has no position"};
      // an unknown kind is allowed through — it scores food.defaultWeight and
      // draws as a magenta box, which is easier to spot than a silent drop
    }
  }
  if(col.enemies !== undefined){
    if(!Array.isArray(col.enemies)) return {ok:false, why:"enemies must be an array"};
    for(const e of col.enemies){
      if(typeof e.kind !== "string") return {ok:false, why:"an enemy has no kind"};
      if(typeof e.x !== "number" || typeof e.y !== "number") return {ok:false, why:"an enemy has no position"};
    }
  }
  if(art.biome !== undefined && typeof art.biome !== "string")
    return {ok:false, why:"biome must be the id of a biome, or left out"};
  if(!Array.isArray(art.layers)) return {ok:false, why:"art file has no layers array"};
  return {ok:true};
}
/* every slide carries the three standard layers and an entry point */
function normaliseSlide(seg){
  const have = Array.isArray(seg.art.layers) ? seg.art.layers : [];
  seg.art.layers = LAYERS.map(l=>{
    const f = have.find(x=>x.name===l.name);
    return {name:l.name, z:l.z, pieces: f && Array.isArray(f.pieces) ? f.pieces : []};
  });
  if(!seg.collision.entry) seg.collision.entry = {x:96, y:380};
  if(!Array.isArray(seg.collision.tokens)) seg.collision.tokens = [];
  if(!Array.isArray(seg.collision.enemies)) seg.collision.enemies = [];
  if(typeof seg.art.biome !== "string") seg.art.biome = "";
  // pieces authored before categories existed get one from their sprite
  for(const l of seg.art.layers) for(const p of l.pieces)
    if(!p.role){ const r = roleOfSprite(p.sprite); if(r) p.role = r; }
  delete seg.art.sprites;      // the library holds the pixels; exports re-attach them
  return seg;
}
function segFromFiles(col, art){
  const v = validatePair(col, art); if(!v.ok) return {ok:false, why:v.why};
  return {ok:true, seg:{ id:col.id, name:art.name || col.name || col.id, collision:col, art:art }};
}

/* ---- procedural author: writes segments in the exact same shape the
   editor exports, so runtime code never knows the difference ---- */
