"use strict";
/* Every sound effect the game can play.
 *
 * To add one: drop a .wav (or .ogg/.mp3) into assets/audio/, add a line here,
 * and call Sfx("name"). Run `python3 build.py` to fold it into the single-file
 * build, or `python3 tools/make-sfx.py` to regenerate the sample set.
 *
 * gain   a per-sound trim, so you can balance without re-rendering the file
 * vary   random pitch spread, ±this fraction. Keeps repeated sounds from
 *        turning into a machine gun.
 */
const SFX_MANIFEST = [
  { id:"launch",  file:"launch.wav",  gain:0.9, vary:0.12 },  // the slingshot release
  { id:"land",    file:"land.wav",    gain:0.8, vary:0.10 },  // sticking a ledge
  { id:"cling",   file:"cling.wav",   gain:0.7, vary:0.14 },  // grabbing a wall or ceiling
  { id:"eat",     file:"eat.wav",     gain:0.8, vary:0.16 },  // a food token
  { id:"bounce",  file:"bounce.wav",  gain:0.8, vary:0.08 },  // a bounce box
  { id:"hurt",    file:"hurt.wav",    gain:0.8, vary:0.08 },  // a hard knock, not fatal
  { id:"die",     file:"die.wav",     gain:0.9, vary:0    },  // the run ending
  { id:"click",   file:"click.wav",   gain:0.5, vary:0.06 },  // any button
  { id:"start",   file:"start.wav",   gain:0.8, vary:0    },  // a run beginning
  { id:"fanfare", file:"fanfare.wav", gain:0.8, vary:0    }   // a score that made the board
];
