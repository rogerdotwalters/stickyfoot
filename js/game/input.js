"use strict";
/* Pointer input for the slingshot, including the inverse of the rotated-stage transform. */

/* ---- pointer input ---- */
/* Aim is measured in canvas space, not world space: the camera keeps
   creeping while you hold the drag, and the pull should not drift with it. */
function toCanvas(ev){
  const r = cv.getBoundingClientRect();
  if(document.documentElement.classList.contains("turned")){
    // the stage is rotated 90° clockwise, so the rect is the rotated bounding box:
    // its width is the canvas's on-screen height and vice versa.
    const cx = r.left + r.width/2, cy = r.top + r.height/2;
    const dx = ev.clientX - cx, dy = ev.clientY - cy;
    const W = r.height, H = r.width;          // css size of the un-rotated canvas
    return { x: (W/2 + dy) * (NODE_W/W), y: (H/2 - dx) * (NODE_H/H) };
  }
  const s = NODE_W / r.width;
  return { x:(ev.clientX - r.left)*s, y:(ev.clientY - r.top)*s };
}
cv.addEventListener("pointerdown", ev=>{
  if(Game.state!=="live" || !Game.gecko || Game.gecko.mode!=="rest") return;
  cv.setPointerCapture(ev.pointerId);
  const p = toCanvas(ev);
  Game.aim = { start:p, drag:{x:0,y:0} };
  ev.preventDefault();
});
cv.addEventListener("pointermove", ev=>{
  if(!Game.aim) return;
  const p = toCanvas(ev);
  Game.aim.drag = { x:p.x - Game.aim.start.x, y:p.y - Game.aim.start.y };
});
function endAim(ev){
  if(!Game.aim) return;
  const d = Game.aim.drag; Game.aim = null;
  if(Game.state==="live" && Game.gecko.mode==="rest") Game.launchFrom(d);
}
cv.addEventListener("pointerup", endAim);
cv.addEventListener("pointercancel", ()=>{ Game.aim=null; });
cv.addEventListener("contextmenu", e=>e.preventDefault());
