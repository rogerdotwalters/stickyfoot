"use strict";
/* Block categories and biomes.
 *
 * Every placeable art piece carries a `role` — one of BLOCK_CATEGORIES — as
 * well as the concrete sprite it was authored with. A biome is a table from
 * role to sprite id:
 *
 *     { id:"snow", name:"Hoarfrost", assets:{ block_base:"snow_base", ... } }
 *
 * When a slide names a biome, every piece with a role draws through that table
 * instead of its authored sprite, so one dropdown reskins a whole level. A
 * piece with no role (or a role the biome has no entry for) falls back to the
 * sprite in the file, which is also what happens when no biome is set at all.
 *
 * Nothing about collision, tokens or enemies changes with the biome. Swapping
 * art never changes how a level plays.
 */

const BLOCK_CATEGORIES = [
  { id:"block_base",  label:"ground",      hint:"the tiled body of a platform" },
  { id:"block_top",   label:"ground top",  hint:"cap row: grass, snow, moss" },
  { id:"plant_shrub", label:"shrub",       hint:"small plant" },
  { id:"plant_fern",  label:"fern",        hint:"tall plant" },
  { id:"tree_trunk",  label:"trunk",       hint:"vertical, often over a cling box" },
  { id:"tree_leaves", label:"leaves",      hint:"canopy above a trunk" },
  { id:"food_1",      label:"food 1",      hint:"art for the first food kind" },
  { id:"food_2",      label:"food 2",      hint:"art for the second food kind" },
  { id:"sign",        label:"sign",        hint:"signpost, marker" },
  { id:"moss",        label:"moss",        hint:"surface texture patch" },
  { id:"thorn",       label:"thorns",      hint:"usually over a hazard box" },
  { id:"spike",       label:"spikes",      hint:"usually over a hazard box" },
  { id:"stone_wall",  label:"stone wall",  hint:"the harder tiled body" },
  { id:"wood_plank",  label:"planks",      hint:"built platforms" },
  { id:"wood_door",   label:"door",        hint:"decorative doorway" },
  { id:"cloud",       label:"cloud",       hint:"background drift" }
];
const CATEGORY_IDS = BLOCK_CATEGORIES.map(c => c.id);

const BUILTIN_BIOMES = [
  { id:"grove", name:"Fern Grove", builtin:true, assets:{
      block_base:"dirt",       block_top:"dirt_top",   plant_shrub:"shrub",
      plant_fern:"fern",       tree_trunk:"trunk",     tree_leaves:"canopy",
      food_1:"food_fly",       food_2:"food_moth",     sign:"sign",
      moss:"moss",             thorn:"thorn",          spike:"spike",
      stone_wall:"stone",      wood_plank:"plank",     wood_door:"door",
      cloud:"cloud" } },
  { id:"snow", name:"Hoarfrost", builtin:true, assets:{
      block_base:"snow_base",  block_top:"snow_top",   plant_shrub:"frost_shrub",
      plant_fern:"frost_fern", tree_trunk:"frost_trunk", tree_leaves:"frost_canopy",
      food_1:"food_fly",       food_2:"food_moth",     sign:"frost_sign",
      moss:"frost_moss",       thorn:"ice_thorn",      spike:"ice_spike",
      stone_wall:"ice_wall",   wood_plank:"cold_plank", wood_door:"frost_door",
      cloud:"snow_cloud" } }
];

const Biomes = {
  custom: load("stickyfoot.biomes.v1", []),
  store(){ save("stickyfoot.biomes.v1", this.custom); },
  all(){ return BUILTIN_BIOMES.concat(this.custom); },
  get(id){
    if(!id) return null;
    return this.all().find(b => b.id === id) || null;
  },
  /** A biome with every category filled, ready to edit. */
  blank(copyFrom){
    const base = copyFrom ? this.get(copyFrom) : BUILTIN_BIOMES[0];
    const assets = {};
    for(const c of CATEGORY_IDS) assets[c] = (base && base.assets[c]) || "";
    return { id:"", name:"", assets };
  },
  put(biome){
    const i = this.custom.findIndex(b => b.id === biome.id);
    if(i >= 0) this.custom[i] = biome; else this.custom.push(biome);
    this.store();
  },
  drop(id){ this.custom = this.custom.filter(b => b.id !== id); this.store(); },
  /** Which categories a biome has no usable sprite for. Checked against the
      manifest and the imported library, not against what has finished
      decoding, so this is stable from the first frame. */
  known(id){
    if(!id) return false;
    return SPRITE_MANIFEST.some(s => s.id === id) || CustomArt.items.some(a => a.id === id);
  },
  missing(biome){
    return CATEGORY_IDS.filter(c => !this.known(biome.assets[c]));
  }
};

/** The sprite an art piece should actually draw with, under a biome. */
function resolveSprite(piece, biome){
  if(biome && piece.role && biome.assets[piece.role]) return biome.assets[piece.role];
  return piece.sprite;
}
/** The category a sprite was registered under, if any. */
function roleOfSprite(id){
  const entry = SPRITE_MANIFEST.find(s => s.id === id);
  return (entry && entry.role) || null;
}
/** Food art follows the biome for the first two kinds. */
function tokenSprite(kind, biome){
  const i = foodKinds().indexOf(kind);
  const cat = i === 0 ? "food_1" : i === 1 ? "food_2" : null;
  if(biome && cat && biome.assets[cat]) return biome.assets[cat];
  return foodSprite(kind);
}
/** Rewrite a slide's art so every roled piece uses this biome's sprites. */
function applyBiome(seg, biomeId){
  const biome = Biomes.get(biomeId);
  seg.art.biome = biomeId || "";
  if(!biome) return 0;
  let n = 0;
  for(const layer of seg.art.layers){
    for(const p of layer.pieces){
      if(p.role && biome.assets[p.role] && p.sprite !== biome.assets[p.role]){
        p.sprite = biome.assets[p.role]; n++;
      }
    }
  }
  return n;
}
