# Stickyfoot

A pixel-art slingshot endless runner, its level editor, and a local player
store — all in one self-contained HTML file. No build step, no server, no
dependencies beyond two Google fonts (it still runs offline; the fonts just
fall back).

## Running it

Open `stickyfoot.html` in any modern browser, or serve the folder:

    python3 -m http.server 8000

Everything — players, scores, saved maps, imported art — is kept in that
browser's local storage. Clearing site data erases it.

## What is in here

    stickyfoot.html                     the whole game, editor and player store
    examples/
      map_fern_hollow.map.json          the example map as one bundle (6 slides)
      fern-hollow/
        fern_hollow_01.collision.json   slide 1, hitboxes
        fern_hollow_01.art.json         slide 1, sprites
        …                               through slide 6
    templates/
      stickyfoot-block-16.png           16 × 16 tiling block, paint over it
      stickyfoot-block-32.png           32 × 32 version of the same
      stickyfoot-prop-guide-32.png      transparent 32 × 32 with alignment ticks

Import either form in the editor: the `.map.json` replaces the whole map, a
`.collision.json` + `.art.json` pair replaces the slide you are on.

## Cabinet mode

**Run game** in the header launches the arcade cabinet: fullscreen, no page
chrome, no navigation, and no exit but the ⏻ button, which confirms first. The
back button is caught and pushed back; closing the tab asks first. The attract
screen shows the top eight names and scores and offers one action — play.

A cabinet run is anonymous. When it ends the score is held aside and the player
is asked for a name, an email and a phone number. All three are trimmed and
validated; if any is missing or malformed the score is discarded and nothing is
written. Discarding, or letting the ninety-second timer run out, does the same.
Scores that pass are matched to existing players by email or phone digits, so a
regular keeps one row on the board.

## Playing

Drag away from the gecko to load the slingshot, aim the arc, release. Land on
a ledge and you can drag again. `platform` boxes are landed on from above,
`cling` boxes stick on any face — walls and ceilings included — `bounce` boxes
throw you back up, and `hazard` boxes end the run. So does falling off the
bottom, or letting the creeping rot on the left edge catch you.

Pressing **start run** drops the page chrome and opens the game view — stage
centred on black, menus inside the game. `F` or the ⛶ button goes to real
fullscreen and back; where a browser or embedding frame blocks the Fullscreen
API, it fills the window instead. `Esc` opens the in-game menu (resume,
restart, change player, leaderboard, fullscreen, leave), `P` also pauses, `R`
restarts, `F3` opens the node monitor.

On a phone in portrait the game view asks the device to lock to landscape;
where that is refused — iOS, and any embedded frame — the stage itself rotates
90° to fill the screen, with pointer input mapped back through the rotation.

## Architecture

**Node chain.** The world is a linked list of `LevelNode` objects, each exactly
1024 × 576 world pixels — the same frame the editor draws in. Each frame the
chain appends while the tail is less than one node past the right edge, and
destroys the head once it is fully off the left edge: the baked art canvas is
sized to 0 × 0 to release the bitmap, the box array is emptied, and the
`next`/`prev` pointers are nulled. Three or four nodes are alive at any moment
no matter how long the run lasts. `F3` shows spawned / live / destroyed counts
and the live bitmap budget.

**Two files per segment.** Collision never mentions art and art never mentions
collision; the runtime joins them by `id` and refuses any pair that is not
exactly one frame in size. See `examples/fern-hollow/` for real output, and the
"how it works" screen in the app for the annotated version.

**Maps.** A map is an ordered list of slides, one slide per node. The strip
under the editor canvas is that list; `+` between two slides inserts there,
blank or as a copy of the slide you are on.

**Slingshot.** The pull is measured in canvas space, reversed, clamped to
190 px and scaled to 23 px per tick. Gravity is 0.62 per tick on a fixed 60 Hz
accumulator, with movement substepped so nothing tunnels a 64 px ledge. The
dotted preview is the same integrator, and it shortens as your score climbs.

**Art sizes.** Every art pixel draws as a 4 × 4 block and pieces tile across
the rectangle you drag, so 16 × 16 px is one 64 px block. Multiples of 16 keep
the repeat on-grid. Imports are capped at 128 px a side. Exported art files
embed a copy of any custom sprite they use, which is why a segment stays
portable.

## Editing by hand

The JSON is plain and safe to edit in a text editor. Box types are
`platform`, `cling`, `hazard`, `bounce`; art layers are `background`,
`midground`, `foreground`, drawn in `z` order. Keep `width` and `height` at
1024 × 576 — the loader rejects anything else rather than scaling it.
