# Stickyfoot

A pixel-art slingshot endless runner, a level editor, an arcade cabinet mode
and a local player store. No framework, no bundler, no npm.

## Running it

**The source tree** — open `index.html`, or serve the folder:

    python3 -m http.server 8000

Plain scripts and real PNG assets. Edit any file, reload, done.

**The single file** — `dist/stickyfoot.html` is the whole thing inlined,
including every sprite. Open it from anywhere, email it, drop it on a static
host. Rebuild it after changes:

    python3 build.py

## Layout

    index.html              markup, and the load order for everything else
    settings.json           every tunable number: food weights, camera, physics
    build.py                inlines the tree into dist/stickyfoot.html
    css/                    tokens · shell · game · ui · editor
    js/core/                settings (generated) · constants · util · storage
    js/art/                 manifest (the sprite list) · sprites · biomes · custom
    js/level/               format · generate · node (the linked chain)
    js/game/                game (physics) · render · input
    js/editor/              editor · filmstrip · biome-ui · io
    js/audio/               manifest · audio (engine) · music (sequencer)
    js/ui/                  players · audio-ui · view · cabinet · run
    js/main.js              router and boot
    assets/sprites/*.png    every sprite, as actual files
    assets/audio/*.wav      ten sample sound effects
    tools/make-sfx.py       regenerates those WAVs from their recipes
    examples/               the Fern Hollow map, as pairs and as one bundle
    templates/             correctly sized PNGs to paint over
    docs/ARCHITECTURE.md    what each file does, and how the node chain works
    docs/ADDING-SPRITES.md  sizes, the manifest, and importing art

Start with `docs/ARCHITECTURE.md`. Tuning — food weights, camera height,
gravity, launch speed, the gecko's hitbox — is all in `settings.json`.

## Playing

Drag away from the gecko to load the slingshot, aim the arc, release. Land on a
ledge and drag again. `platform` boxes are landed on from above, `cling` boxes
stick on any face including walls and ceilings, `bounce` throws you back up,
`hazard` ends the run. So does falling, or letting the creeping rot on the left
edge catch you.

Food tokens along the way add their weight to the score: a fly is 10, a grub is
100, and the numbers are yours to change in `settings.json`.

The camera keeps the gecko at a fixed horizontal lead as before, and now follows
it up and down too, with a deadzone so small hops do not slosh the view around.
`camera.height` sets where the gecko sits vertically; `camera.followVertical:
false` restores the old fixed behaviour.

`F` fullscreens, `Esc` opens the in-game menu, `P` pauses, `R` restarts, `F3`
shows the node monitor.

## Cabinet mode

**Run game** in the header launches the arcade cabinet: fullscreen, no chrome,
no navigation, no exit but the power button, which confirms first. The back
button is caught and pushed back; closing the tab asks first. The attract screen
shows the top eight names and scores and offers one action — play.

A cabinet run is anonymous. When it ends the score is held aside and the player
is asked for a name, an email and a phone number. All three are trimmed and
validated; if any is missing or malformed the score is discarded and nothing is
written. Discarding, or letting the ninety-second timer run out, does the same.
Scores that pass are matched to existing players by email or phone digits, so a
regular keeps one row on the board.

On a phone in portrait the game view asks the device to lock to landscape; where
that is refused — iOS, and any embedded frame — the stage itself rotates 90° to
fill the screen, with pointer input mapped back through the rotation.

## The editor

A **map** is an ordered list of slides; one slide is one node. The strip under
the canvas is that list, in the order the runtime links them. Click a slide to
edit it; the `+` between two slides inserts there, blank or as a copy of the one
you are on. **Load example** gives you a copy of the opening six nodes.

Exports, all from the bottom bar:

| button | writes |
|---|---|
| export map (one file) | `<map>.map.json` — every slide, in order |
| export every slide pair | `<slide>.collision.json` + `<slide>.art.json`, per slide |
| export slide pair | just the slide you are on |
| copy map json | the bundle in a dialog, to copy by hand |

If a browser blocks downloads, exports fall back to that same copy dialog rather
than failing silently. Import takes either form back: a `.map.json` replaces the
whole map, a pair replaces the current slide.

## Biomes

Every art piece carries a category — `block_base`, `plant_fern`, `stone_wall`,
sixteen in all — alongside the sprite it was drawn with. A biome maps each
category to a sprite, so picking one from the editor's dropdown reskins a whole
level at once, and **apply to whole map** does every slide. Swapping is lossless
and never touches collision, tokens or enemies.

Two ship: **Fern Grove** and **Hoarfrost** (recolours, meant to be replaced with
real art). **New biome…** gives you a row per category, prefilled from whichever
biome you copy, and will not save until all sixteen are filled. Generated nodes
rotate through `biomes.order` in `settings.json` as you travel.

## Enemies

Simple patrollers: they snap to the ledge they are standing on and walk edge to
edge, turning around forever. No chasing, no jumping, no awareness of you at
all — obstacles with a schedule. Touching one ends the run. Place them from the
editor's **enemies** layer, which draws the ledge each one will walk; kinds and
speeds are in `settings.json`.

## Sound

Effects are real WAV files in `assets/audio/`, listed in
`js/audio/manifest.js` — launch, land, cling, eat, bounce, hurt, die, click,
start, fanfare. Swap any of them for your own, or re-render the samples with
`python3 tools/make-sfx.py`.

Music is synthesised rather than sampled: a step sequencer in
`js/audio/music.js` plays patterns you can edit as data. **Terrarium** in the
menus, **Stickyfoot** during a run, ducking under the in-game menu.

The sound dialog — the header button, the in-game menu, or `M` to mute — moves
three gains: overall, music, effects. Levels save per device as you drag them;
the starting values are in `settings.json` under `audio`. Audio only starts
after the first click or keypress, because browsers insist.

## Settings

Everything adjustable is in `settings.json`:

```json
"food":   { "weights": { "fly": 10, "moth": 25, "cricket": 50, "grub": 100 } },
"camera": { "height": 320, "deadzone": 80, "minY": -240, "maxY": 180,
            "followVertical": true, "leadX": 340 },
"physics":{ "gravity": 0.62, "maxLaunchSpeed": 23, "maxDragPixels": 190 },
"audio":  { "master": 0.8, "music": 0.45, "sfx": 0.85, "muted": false }
```

Served over http(s), the game re-reads the file at boot — edit and reload, no
rebuild. From `file://` or in the built page it uses the copy baked into
`js/core/settings.js`, so run `python3 build.py` to fold changes in. Values
under `world` (node size, tile size) are part of the segment file format and
always need a rebuild.

## Data

Players, scores, saved maps and imported art live in this browser's local
storage under the `stickyfoot.*` keys. Nothing is sent anywhere, and clearing
site data erases it. Local storage is per origin, so moving the game to a new
domain starts fresh — export your maps first.
