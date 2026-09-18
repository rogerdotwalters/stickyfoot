# Adding sprites

Every sprite in Stickyfoot is a real PNG in `assets/sprites/`. There is no art
drawn in code — `js/art/manifest.js` is just a list of files.

    assets/sprites/dirt.png        16 x 16, 150 bytes
    assets/sprites/fern.png        16 x 16
    assets/sprites/gecko_idle.png  22 x 11

## The size rule

One art pixel draws as a **4 x 4 block** on screen (`PX` in
`js/core/constants.js`), and a piece **tiles** across whatever rectangle you
drag out in the editor. So:

| PNG size | draws as | use for |
|---|---|---|
| 16 x 16 | one 64px grid block | ground, walls, anything stretched |
| 32 x 32 | a 128px block | chunkier ground, big props |
| 64 x 16 | a 256 x 64 band | wide trim, girders |
| 32 x 48 | a 128 x 192 prop | signs, statues, trees |

Multiples of 16 keep the repeat lined up with the editor grid. Between 4 and
128 px a side. Transparent background, no anti-aliasing, no soft shadows — the
game scales with nearest-neighbour, so a fuzzy edge becomes a fuzzy block.

Flat pixel art at these sizes is a few hundred bytes. All 22 built-in sprites
together are 4.4 kB.

## Adding one permanently

1. Save your PNG into `assets/sprites/`, e.g. `mossy_brick.png`.
2. Add a line to `js/art/manifest.js`:

   ```js
   { id:"mossy_brick", file:"mossy_brick.png", label:"mossy" },
   ```

3. Reload. It is in the editor palette.
4. Run `python3 build.py` when you want the single-file build to include it.

### The manifest fields

| field | meaning |
|---|---|
| `id` | the name `.art.json` files refer to. Renaming breaks existing segments. |
| `file` | the PNG in `assets/sprites/` |
| `label` | palette caption. Omit it and the sprite loads but stays out of the palette — the gecko frames do this. |
| `cap` | another sprite id drawn on the **first row** when this one tiles downward. |
| `role` | which of the sixteen block categories this sprite fills. Pieces placed with it inherit the role, which is what lets a biome swap them. |
| `biome` | a note about which set it belongs to. Informational only — biome membership is decided by `js/art/biomes.js`. |

`cap` is how soil grows grass:

```js
{ id:"dirt",     file:"dirt.png", label:"soil", cap:"dirt_top" },
{ id:"dirt_top", file:"dirt_top.png" },
```

`dirt_top` has no `label`, so it never shows in the palette — it only exists as
the cap row of `dirt`.

## Sprites for a biome

A biome needs one sprite for each of the sixteen categories. To build one:

1. Draw a PNG per category into `assets/sprites/` — the snow set is named
   `snow_base`, `ice_wall`, `frost_fern` and so on.
2. Add each to `js/art/manifest.js` with its `role`.
3. Either add the biome to `BUILTIN_BIOMES` in `js/art/biomes.js`, or make it in
   the editor with **new biome…**, which stores it in this browser.

Enemy sprites follow the same pattern with no role: `enemy_<kind>.png`, listed
in the manifest, with the kind and its speed in `settings.json`.

## Editing what's already there

Open `assets/sprites/fern.png` in any pixel editor, keep the canvas size, save
over it. Nothing else to change.

The gecko is three frames: `gecko_idle.png`, `gecko_fly.png` (legs swept back)
and `gecko_stick.png` (splayed toe pads, used when clinging to a wall). All
three are 22 x 11. If you resize them, also look at `GECKO_W` / `GECKO_H` in
`js/core/constants.js` — that is the collision box, deliberately smaller than
the sprite so landings feel forgiving.

## The other route: import art

The editor's **import art** button takes a PNG, GIF, WebP or JPEG and keeps it
in the browser's local storage. Use it for one-offs, for testing, or when you
cannot edit the files (playing a hosted copy, say).

Imported pieces show with a dashed border in the palette. They are **not** in
`assets/sprites/`, so they only exist on that machine — but any art file you
export embeds a copy of every custom sprite it uses, in a `sprites` block:

```json
{
  "format": "stickyfoot.art",
  "id": "seg_meadow_01",
  "sprites": {
    "art_mossy_brick": { "label":"mossy", "w":16, "h":16, "src":"data:image/png;base64,..." }
  },
  "layers": [ ... ]
}
```

So a segment stays portable: importing it elsewhere installs the art it needs.
When you want an imported piece to become permanent, save the PNG into
`assets/sprites/` and add it to the manifest as above.

**Starter files** (the button next to import) give you correctly sized PNGs to
paint over: a 16 x 16 tiling block, a 32 x 32 version, and a transparent
32 x 32 guide with corner ticks. There are copies in `templates/`.

## When a sprite doesn't show

A missing sprite draws as a **magenta box**, in the game and in the editor. That
means the id in the art file has no entry in the registry: either the manifest
line is missing, the filename is wrong, or the PNG failed to decode. The browser
console logs `[stickyfoot] sprite failed to load: <id> <file>` for each one.
