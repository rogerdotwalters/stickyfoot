"use strict";
/* Structural constants, and live handles on everything in settings.json.
 *
 * The numbers themselves live in settings.json; build.py turns that into
 * js/core/settings.js, which is loaded before this file. The shorthands below
 * (PHYS, CAM, FOOD, SCORE ...) are references to the very objects inside
 * SETTINGS, not copies — so when the page is served over http(s) and boot
 * re-reads settings.json, edits land without touching any of this code.
 *
 * Read tunables through those handles (PHYS.gravity), never copy them into a
 * const, or live reloading silently stops working.
 */

const S     = SETTINGS;
const PHYS  = S.physics;
const CAM   = S.camera;
const FOOD  = S.food;
const SCORE = S.scoring;
const AIM   = S.aim;
const DIFF  = S.difficulty;
const FOES  = S.enemies;
const BIOME = S.biomes;

/* Baked into the segment file format: a node is exactly this big, and every
   .collision.json / .art.json declares the same size or is refused. Changing
   these needs a rebuild, and invalidates segments authored at the old size. */
const NODE_W = S.world.nodeWidth;    // one node == one tablet frame
const NODE_H = S.world.nodeHeight;
const TILE   = S.world.tile;         // world px per art tile
const PX     = S.world.artPixel;     // sprite pixel -> world px

/* The collision vocabulary. Adding a type here means teaching Game.collide()
   in js/game/game.js what it does. */
const BOX_TYPES  = ["platform", "cling", "hazard", "bounce"];
const BOX_COLORS = { platform:"#4fd06a", cling:"#ffc24b", hazard:"#ff5a4a", bounce:"#8f6aff" };

/* Food token kinds come from settings.json; each needs an
   assets/sprites/food_<kind>.png listed in js/art/manifest.js. */
function foodKinds(){ return Object.keys(FOOD.weights); }
function foodWeight(kind){
  const w = FOOD.weights[kind];
  return typeof w === "number" ? w : FOOD.defaultWeight;
}
function foodSprite(kind){ return "food_" + kind; }

/* Enemies: same shape, kinds and speeds from settings.json. */
function enemyKinds(){ return Object.keys(FOES.kinds); }
function enemySpeed(kind){
  const k = FOES.kinds[kind];
  return (k && typeof k.speed === "number") ? k.speed : FOES.defaultSpeed;
}
function enemySprite(kind){ return "enemy_" + kind; }

/* Deep-merge a freshly fetched settings.json into the live objects above.
   Objects are mutated in place so existing references keep working. */
function mergeSettings(into, from){
  for(const k of Object.keys(from)){
    if(k.charAt(0) === "_") continue;
    const v = from[k];
    if(v && typeof v === "object" && !Array.isArray(v) && into[k] && typeof into[k] === "object")
      mergeSettings(into[k], v);
    else into[k] = v;
  }
  return into;
}

/* Served over http(s): pick up settings.json without a rebuild. From file://
   fetch is blocked, and the built page has no file beside it — both fall back
   to the values baked into settings.js, which is the same data. */
function refreshSettings(){
  if(!/^https?:$/.test(location.protocol) || typeof fetch !== "function") return Promise.resolve(false);
  return fetch("settings.json", {cache:"no-store"})
    .then(r => r.ok ? r.json() : null)
    .then(json => {
      if(!json) return false;
      const w = json.world || {};
      if((w.nodeWidth && w.nodeWidth !== NODE_W) || (w.nodeHeight && w.nodeHeight !== NODE_H) ||
         (w.tile && w.tile !== TILE) || (w.artPixel && w.artPixel !== PX))
        console.warn("[stickyfoot] settings.json changed a world size — run build.py and reload");
      mergeSettings(S, json);
      return true;
    })
    .catch(() => false);
}
