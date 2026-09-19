# Architecture

No framework, no bundler, no npm. Plain scripts loaded in order by
`index.html`, each file owning one concern. `build.py` inlines the lot into
`dist/stickyfoot.html` when you want a single portable file.

Because these are classic scripts rather than ES modules, **every file may use
anything defined in a file above it in the load order**, and `js/main.js` runs
last. That also means the dev tree opens straight from `file://` — no server
needed, though `python3 -m http.server` is nicer.

## Load order

```
css/tokens.css      colour tokens, light/dark, base type
css/shell.css       the page frame: marquee, nav, screens
css/game.css        stage, canvas, overlays, HUD, cabinet, score form
css/ui.css          panels, tables, forms, docs, dialogs, toast
css/editor.css      editor layout, palette, filmstrip

settings.json          every tunable number — the file you actually edit
js/core/settings.js    GENERATED from settings.json by build.py
js/core/constants.js   structural sizes, and live handles into SETTINGS
js/core/util.js        $ / $$, clamp, lerp, esc, toast, seeded noise
js/core/storage.js     players, scores, maps, prefs — all localStorage, guarded

js/art/manifest.js     the sprite list (id, file, label, cap)
js/art/sprite-data.js  GENERATED: inlined PNGs, empty in dev
js/art/sprites.js      registry, loader, drawPiece
js/art/biomes.js       block categories, biome tables, applyBiome
js/art/custom.js       player-imported PNGs, embedding, starter templates

js/audio/manifest.js   the sound effect list
js/audio/audio-data.js GENERATED: inlined WAVs (written for dev too)
js/audio/audio.js      context, three-stage mixer, loading, playback
js/audio/music.js      step sequencer and the two tracks, as data

js/level/format.js     the two-file format and its validation
js/level/generate.js   procedural author, opening pad, segment pool
js/level/node.js       LevelNode + NodeChain (the linked list and its cleanup)

js/game/game.js        run state, slingshot launch, fixed-step physics, scoring
js/game/render.js      backdrop, node art, gecko, HUD, node monitor, main loop
js/game/input.js       pointer to canvas mapping, including the rotated stage

js/editor/editor.js    open map, selected slide/layer, undo, canvas interaction
js/editor/filmstrip.js the slideshow strip: thumbnails, selection, insertion
js/editor/biome-ui.js  biome dropdown, apply-to-map, the new-biome form
js/editor/io.js        downloads, exports, imports, the copy-out dialog

js/ui/players.js       contact validation, leaderboard, confirm dialog
js/ui/audio-ui.js      the sound dialog and the delegated click sound
js/ui/view.js          immersive view, fullscreen, phone orientation
js/ui/cabinet.js       arcade mode: attract, lock-in, score entry
js/ui/run.js           start/pause/end a run, buttons and keys

js/main.js             screen router, boot
```

## The pieces that matter

**Node chain** (`js/level/node.js`). The world is a singly linked list of
`LevelNode`s, each exactly `NODE_W` x `NODE_H` — one tablet frame, the same
frame the editor draws in. Each frame the chain appends while the tail is less
than one node past the right edge, and destroys the head once it is fully off
the left edge: the baked art canvas is sized to 0 x 0 to release the bitmap, the
box array is emptied, and `next`/`prev` are nulled. Three or four nodes are
alive at any moment however long the run lasts. `F3` in game shows the counters.

**Two files per segment** (`js/level/format.js`). Collision never mentions art,
art never mentions collision; the runtime joins them by `id` and refuses any
pair that is not exactly one frame. `js/level/generate.js` writes the same shape
the editor exports, so the runtime cannot tell an authored segment from a
generated one.

**Physics** (`js/game/game.js`). Fixed 60 Hz accumulator, movement substepped so
nothing tunnels a 64px ledge, collision resolved on the shallower axis. The
trajectory preview runs the same integrator forward.

**Rendering** (`js/game/render.js`). Each node bakes its art layers into one
offscreen canvas on spawn, then the frame is one `drawImage` per visible node
plus the procedural parallax backdrop.

## Tuning

All of it is in `settings.json`. `build.py` turns that file into
`js/core/settings.js`, and `js/core/constants.js` exposes live handles into it —
`PHYS`, `CAM`, `FOOD`, `SCORE`, `AIM`, `DIFF` — which are references to the
objects inside `SETTINGS`, not copies.

That distinction matters: read `PHYS.gravity` at the point of use, never copy it
into a `const` at load. Because nothing copies, a settings.json re-read at boot
(which happens automatically over http(s)) lands everywhere at once, and you can
poke `SETTINGS.food.weights.fly = 50` in the console and see it immediately.

Structural values — `NODE_W`, `NODE_H`, `TILE`, `PX` — are read once at load,
because they are part of the segment file format. Changing those needs a rebuild
and invalidates segments authored at the old size.

**Categories and biomes** are the reskinning layer. Art pieces carry a `role`
from `BLOCK_CATEGORIES`; a biome maps role to sprite; `drawPiece(ctx, p, biome)`
resolves through it. `applyBiome()` also rewrites the stored sprite so exported
files stand alone. Collision never looks at any of this.

**Enemies** are per-node state like tokens. `Game.anchorEnemy()` resolves patrol
bounds once from the platform underneath, `moveEnemies()` walks and flips, and
`touchEnemies()` ends the run. No pathfinding, no player awareness, by design.

**Audio** is two halves: sampled effects (files in `assets/audio/`, decoded
into buffers) and synthesised music (oscillators driven by a lookahead
scheduler, patterns as plain arrays in `music.js`). Both feed a three-gain
mixer. Nothing is constructed until a user gesture, and every entry point is a
no-op when there is no context, so the rest of the codebase can call `Sfx()`
without guarding.

**Food tokens** live in the collision file as a `tokens` array, become per-node
state in `LevelNode` (so a repeated segment is restocked), and are checked every
tick by `Game.eat()`. **The vertical camera** is the second half of the camera
block in `Game.step()`; everything drawn in `js/game/render.js` is offset by
`Game.camY`, and `js/game/input.js` is untouched because aiming is measured in
canvas space.

## Build

```
python3 build.py       ->  dist/stickyfoot.html
```

It reads `index.html` for what to include and in what order, inlines each local
CSS and JS file, and base64s every sprite into a generated
`js/art/sprite-data.js`, which `sprites.js` prefers over `assets/sprites/*.png`
when present. Nothing is minified; the output is meant to stay readable.
