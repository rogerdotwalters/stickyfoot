"use strict";
/* The procedural author and the segment pool. Writes segments in exactly the shape the editor exports. */

const GROUND_SPRITES = ["dirt","stone","plank"];
/* Generated pieces carry their category, exactly like editor-placed ones, so a
   generated node reskins with the biome just as an authored one does. */
function piece(sprite, x, y, w, h){
  const p = {sprite, x, y, w, h};
  const r = roleOfSprite(sprite);
  if(r) p.role = r;
  return p;
}
function biomeForNode(index){
  if(!BIOME.rotate || !BIOME.order.length) return BIOME.order[0] || BUILTIN_BIOMES[0].id;
  return BIOME.order[Math.floor(index / Math.max(1, BIOME.nodesPerBiome)) % BIOME.order.length];
}

function genSegment(index, difficulty){
  const rnd = rngFrom(0x9e37 + index*2654435761 % 4294967291);
  const id = "gen_"+index;
  const seg = emptySegment(id, "generated "+index);
  const boxes = seg.collision.boxes;
  const L = {}; seg.art.layers.forEach(l => L[l.name]=l.pieces);
  const ground = GROUND_SPRITES[Math.floor(rnd()*GROUND_SPRITES.length)];
  const d = clamp(difficulty, 0, 1);
  const minGap = DIFF.gapMinEasy + d*(DIFF.gapMinHard - DIFF.gapMinEasy);
  const maxGap = DIFF.gapMaxEasy + d*(DIFF.gapMaxHard - DIFF.gapMaxEasy);

  // ---- ledges across the frame ----
  let x = Math.floor(rnd()*2)*TILE;
  let y = 320 + Math.floor(rnd()*3)*TILE;   // seam-friendly opening height
  let first = true;
  while(x < NODE_W - 128){
    let w = Math.round((first ? 200 : 128 + rnd()*200) / TILE) * TILE;
    w = Math.min(w, NODE_W - x);            // a ledge never overhangs the frame
    const bottomless = !first && rnd() < 0.35 + d*0.2;
    const h = bottomless ? TILE : NODE_H - y;
    boxes.push({x, y, w, h, type:"platform"});
    L.midground.push(piece(ground, x, y, w, Math.max(h, TILE)));
    // decorate the top
    if(rnd()<0.75){
      const decor = pick(rnd, ["fern","shrub","mushroom","rock","sign","lantern","moss"]);
      const dw = decor==="moss" ? Math.min(w, TILE*2) : TILE;
      const dx = x + Math.floor(rnd()*Math.max(1,(w-dw)/TILE))*TILE;
      L.background.push(piece(decor, dx, y-TILE, dw, TILE));
    }
    // hazard crown on some ledges
    if(!first && rnd() < 0.18 + d*0.28 && w >= TILE*3){
      const hx = x + TILE*(1+Math.floor(rnd()*Math.max(1,(w/TILE)-2)));
      boxes.push({x:hx, y:y-40, w:TILE, h:40, type:"hazard"});
      L.foreground.push(piece(rnd()<0.5?"spike":"thorn", hx, y-TILE, TILE, TILE));
    }
    // cling column / bounce pad variety
    if(rnd() < 0.22 + d*0.18 && !first){
      const cx = x + w + TILE;
      if(cx < NODE_W - TILE){
        const cy = clamp(y - TILE*(2+Math.floor(rnd()*2)), 64, NODE_H-TILE*3);
        boxes.push({x:cx, y:cy, w:TILE, h:TILE*3, type:"cling"});
        L.midground.push(piece("trunk", cx, cy, TILE, TILE*3));
        L.background.push(piece("canopy", cx-TILE, cy-TILE, TILE*3, TILE));
      }
    }
    // a patroller on a ledge wide enough to walk
    if(!first && w >= TILE*FOES.minLedgeTiles && rnd() < FOES.spawnChance * (0.5 + d)){
      const kinds = enemyKinds();
      const kind = kinds[Math.floor(rnd()*kinds.length) % kinds.length];
      seg.collision.enemies.push({x: x + Math.floor(w/2) - TILE/2, y: y - TILE, w:TILE, h:TILE, kind});
    }

    // food over the gap ahead: the arc you have to fly anyway
    const gap = Math.round((minGap + rnd()*(maxGap-minGap))/TILE)*TILE;
    if(rnd() < FOOD.spawnChance){
      const kinds = foodKinds();
      // rarer kinds are worth more, so weight the draw against the value
      const kind = kinds.slice().sort((a,b)=>foodWeight(a)-foodWeight(b))[
                     Math.min(kinds.length-1, Math.floor(Math.pow(rnd(), 2.2) * kinds.length))];
      const count = 1 + Math.floor(rnd() * Math.max(1, FOOD.clusterMax));
      const arcY  = clamp(y - TILE*(1 + Math.floor(rnd()*2)), TILE, NODE_H - TILE*2);
      for(let i=0;i<count;i++){
        const tx = x + w + Math.round(gap*(i+1)/(count+1)/16)*16 - TILE/2;
        if(tx < 0 || tx + TILE > NODE_W) continue;
        const rise = (count>1) ? Math.round(Math.sin(Math.PI*(i+1)/(count+1)) * TILE) : 0;
        seg.collision.tokens.push({x:tx, y:clamp(arcY - rise, 0, NODE_H-TILE), w:TILE, h:TILE, kind});
      }
    }

    first = false;
    x += w + gap;
    y = clamp(y + (rnd()<0.5?-1:1)*Math.floor(rnd()*3)*TILE, 224, NODE_H-TILE*2);
  }
  // ---- backdrop clutter ----
  const clutter = 2 + Math.floor(rnd()*3);
  for(let i=0;i<clutter;i++){
    L.background.push(piece("cloud", Math.floor(rnd()*(NODE_W-TILE*2)), 40+Math.floor(rnd()*160), TILE*2, TILE));
  }
  if(rnd()<0.5) L.background.push(piece("vine", Math.floor(rnd()*(NODE_W-TILE)), 0, TILE, TILE*2));
  seg.art.biome = biomeForNode(index);
  seg.collision.entry = {x:96, y:boxes.length?boxes[0].y-40:380};
  return seg;
}

/* The run opens on a hand-made pad: a wide ledge under the middle of the
   screen, with the first real ledge already in view to aim at. */
function openingSegment(){
  const seg = emptySegment("opening_pad", "Opening pad");
  const L = {}; seg.art.layers.forEach(l => L[l.name] = l.pieces);
  const y = 448, h = NODE_H - y;
  seg.collision.boxes.push({x:0, y, w:704, h, type:"platform"});
  L.midground.push(piece("dirt", 0, y, 704, h));
  L.background.push(piece("fern",  128, y-TILE, TILE, TILE));
  L.background.push(piece("sign",  320, y-TILE, TILE, TILE));
  L.background.push(piece("shrub", 608, y-TILE, TILE, TILE));
  L.background.push(piece("cloud", 192, 104, TILE*2, TILE));
  L.background.push(piece("cloud", 640, 64,  TILE*2, TILE));
  seg.collision.boxes.push({x:896, y:320, w:128, h:TILE, type:"platform"});
  L.midground.push(piece("stone", 896, 320, 128, TILE));
  L.background.push(piece("lantern", 928, 320-TILE, TILE, TILE));
  seg.collision.tokens.push({x:768, y:y-TILE*2, w:TILE, h:TILE, kind:"fly"});
  seg.collision.tokens.push({x:832, y:y-TILE*3, w:TILE, h:TILE, kind:"fly"});
  seg.art.biome = BUILTIN_BIOMES[0].id;
  seg.collision.entry = {x:512, y:y-40};
  return seg;
}

/* segment pool: built-ins are generated once, the library holds the
   player's own exported pairs */
const Pool = {
  builtin: [],
  init(){ this.builtin = []; for(let i=0;i<10;i++) this.builtin.push(genSegment(i, i/12)); },
  custom(){ const m = Store.activeMap(); return m && Array.isArray(m.nodes) ? m.nodes : []; },
  /** Pick the segment used for chain position `index`. */
  choose(index, mode){
    const custom = this.custom();
    if(index === 0 && mode !== "custom") return (this.opening || (this.opening = openingSegment()));
    if(mode==="custom" && custom.length) return custom[index % custom.length];
    if(mode==="mixed" && custom.length && (index%3===1)) return custom[Math.floor(hash32(index)*custom.length)%custom.length];
    if(index < 2) return this.builtin[index % this.builtin.length];      // gentle opening
    return genSegment(index, clamp((index-2)/40, 0, 1));                  // endless procedural
  }
};
