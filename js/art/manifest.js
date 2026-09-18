"use strict";
/* Every sprite the game knows about.
 *
 * To add one:
 *   1. draw a PNG and save it in assets/sprites/
 *   2. add a line here
 *   3. reload (or re-run build.py for the single-file version)
 *
 * id     the name art pieces refer to. Used in .art.json files, so renaming an
 *        id breaks any segment that already uses it.
 * file   the PNG in assets/sprites/
 * label  short palette caption. Leave it out to keep the sprite out of the
 *        editor palette (the gecko frames and the capped top rows do this).
 * cap    another sprite id drawn on the first row when this one is tiled down a
 *        rectangle. This is what puts grass on soil and moss on stone.
 *
 * Sizes: one art pixel draws as a 4 x 4 block (PX in js/core/constants.js) and
 * a piece tiles across whatever rectangle it is dragged out to, so 16 x 16
 * is exactly one 64px grid block. Multiples of 16 keep the repeat on the grid.
 * See docs/ADDING-SPRITES.md.
 */
const SPRITE_MANIFEST = [
  // --- ground, tiled; the *_top entries are their cap rows ---
  { id:"dirt",      file:"dirt.png",      label:"soil",    cap:"dirt_top", role:"block_base"  },
  { id:"dirt_top",  file:"dirt_top.png", role:"block_top"   },
  { id:"stone",     file:"stone.png",     label:"stone",   cap:"stone_top", role:"stone_wall" },
  { id:"stone_top", file:"stone_top.png", role:"block_top"  },
  { id:"plank",     file:"plank.png",     label:"plank", role:"wood_plank"   },
  { id:"crate",     file:"crate.png",     label:"crate"   },
  { id:"moss",      file:"moss.png",      label:"moss", role:"moss"    },

  // --- props and decoration ---
  { id:"fern",      file:"fern.png",      label:"fern", role:"plant_fern"    },
  { id:"mushroom",  file:"mushroom.png",  label:"shroom", role:"plant_shrub"  },
  { id:"vine",      file:"vine.png",      label:"vine"    },
  { id:"rock",      file:"rock.png",      label:"rock"    },
  { id:"trunk",     file:"trunk.png",     label:"trunk", role:"tree_trunk"   },
  { id:"canopy",    file:"canopy.png",    label:"leaves", role:"tree_leaves"  },
  { id:"cloud",     file:"cloud.png",     label:"cloud", role:"cloud"   },
  { id:"lantern",   file:"lantern.png",   label:"lamp"    },
  { id:"sign",      file:"sign.png",      label:"sign", role:"sign"    },
  { id:"crystal",   file:"crystal.png",   label:"crystal" },

  // --- art that usually sits over a hazard box ---
  { id:"spike",     file:"spike.png",     label:"spikes", role:"spike"  },
  { id:"thorn",     file:"thorn.png",     label:"thorns", role:"thorn"  },

  { id:"shrub",     file:"shrub.png",     label:"shrub",  role:"plant_shrub" },
  { id:"door",      file:"door.png",      label:"door",   role:"wood_door"   },

  // --- the snow biome: same categories, different art. These are recolours of
  //     the grove set to show the swap working; replace the PNGs with real art. ---
  { id:"snow_base",    file:"snow_base.png",    label:"snow",     role:"block_base",  biome:"snow", cap:"snow_top" },
  { id:"snow_top",     file:"snow_top.png",     role:"block_top",  biome:"snow" },
  { id:"ice_wall",     file:"ice_wall.png",     label:"ice",      role:"stone_wall",  biome:"snow", cap:"ice_wall_top" },
  { id:"ice_wall_top", file:"ice_wall_top.png", role:"block_top",  biome:"snow" },
  { id:"cold_plank",   file:"cold_plank.png",   label:"cold wood",role:"wood_plank",  biome:"snow" },
  { id:"cold_crate",   file:"cold_crate.png",   label:"crate",    biome:"snow" },
  { id:"frost_moss",   file:"frost_moss.png",   label:"frost",    role:"moss",        biome:"snow" },
  { id:"frost_fern",   file:"frost_fern.png",   label:"fern",     role:"plant_fern",  biome:"snow" },
  { id:"frost_shrub",  file:"frost_shrub.png",  label:"shrub",    role:"plant_shrub", biome:"snow" },
  { id:"frost_trunk",  file:"frost_trunk.png",  label:"trunk",    role:"tree_trunk",  biome:"snow" },
  { id:"frost_canopy", file:"frost_canopy.png", label:"leaves",   role:"tree_leaves", biome:"snow" },
  { id:"ice_thorn",    file:"ice_thorn.png",    label:"thorns",   role:"thorn",       biome:"snow" },
  { id:"ice_spike",    file:"ice_spike.png",    label:"spikes",   role:"spike",       biome:"snow" },
  { id:"frost_sign",   file:"frost_sign.png",   label:"sign",     role:"sign",        biome:"snow" },
  { id:"frost_door",   file:"frost_door.png",   label:"door",     role:"wood_door",   biome:"snow" },
  { id:"snow_cloud",   file:"snow_cloud.png",   label:"cloud",    role:"cloud",       biome:"snow" },

  // --- enemies; placed from the editor's enemy layer ---
  { id:"enemy_spider", file:"enemy_spider.png" },
  { id:"enemy_beetle", file:"enemy_beetle.png" },

  // --- food tokens; placed from the editor's token layer, not the art palette.
  //     One per kind in settings.json > food.weights, named food_<kind>.png ---
  { id:"food_fly",     file:"food_fly.png", role:"food_1"     },
  { id:"food_moth",    file:"food_moth.png", role:"food_2"    },
  { id:"food_cricket", file:"food_cricket.png" },
  { id:"food_grub",    file:"food_grub.png"    },

  // --- the gecko; drawn by the runtime, not placeable ---
  { id:"gecko_idle",  file:"gecko_idle.png"  },
  { id:"gecko_fly",   file:"gecko_fly.png"   },
  { id:"gecko_stick", file:"gecko_stick.png" }
];
