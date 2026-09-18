"use strict";
/* LevelNode and NodeChain: the linked list of screens, and the cleanup that keeps memory flat. */

/* ---------- 4. LevelNode + NodeChain ---------- */
let BITMAP_BYTES = 0;
class LevelNode {
  constructor(seg, worldX, index){
    this.seg = seg; this.x = worldX; this.index = index;
    this.biome = Biomes.get(seg.art.biome);
    this.next = null; this.prev = null; this.dead = false;
    this.art = null;
    this.boxes = seg.collision.boxes.map(b => ({
      x: worldX + b.x, y: b.y, w: b.w, h: b.h, type: b.type
    }));
    // enemies are per node too: state (position, direction) belongs to this
    // instance of the segment, not to the file
    this.enemies = (seg.collision.enemies || []).map(e => ({
      x: worldX + e.x, y: e.y, w: e.w || TILE, h: e.h || TILE,
      kind: e.kind, dir: e.dir === -1 ? -1 : 1, minX: null, maxX: null, t: 0
    }));
    // food tokens are per node, so a segment that comes round again is stocked
    this.tokens = (seg.collision.tokens || []).map(t => ({
      x: worldX + t.x, y: t.y, w: t.w || TILE, h: t.h || TILE, kind: t.kind, taken: false
    }));
  }
  /** Bake this node's art layers into one 1024×576 bitmap, once. */
  ensureArt(){
    if(this.art || this.dead) return this.art;
    const c = document.createElement("canvas"); c.width=NODE_W; c.height=NODE_H;
    const ctx = c.getContext("2d"); ctx.imageSmoothingEnabled = false;
    const layers = this.seg.art.layers.slice().sort((a,b)=>(a.z|0)-(b.z|0));
    for(const layer of layers) for(const p of layer.pieces) drawPiece(ctx, p, this.biome);
    BITMAP_BYTES += NODE_W*NODE_H*4;
    this.art = c; return c;
  }
  /** Release everything this node owns. Called the moment it leaves screen. */
  destroy(){
    if(this.dead) return;
    this.dead = true;
    if(this.art){ this.art.width = 0; this.art.height = 0; this.art = null; BITMAP_BYTES -= NODE_W*NODE_H*4; }
    this.boxes.length = 0;
    this.tokens.length = 0;
    this.enemies.length = 0;
    this.biome = null;
    this.seg = null; this.next = null; this.prev = null;
  }
}
class NodeChain {
  constructor(){ this.reset(); }
  reset(){
    let n = this.head;
    while(n){ const nx = n.next; n.destroy(); n = nx; }
    this.head = this.tail = null;
    this.live = 0; this.spawned = 0; this.destroyed = 0; this.nextIndex = 0;
    this.mode = Store.prefs.useCustom;
    this.forced = [];     // slides pinned to the head of the chain (editor test)
    BITMAP_BYTES = 0;
  }
  append(){
    const i = this.nextIndex++;
    const seg = (i < this.forced.length && this.forced[i]) ? this.forced[i] : Pool.choose(i, this.mode);
    const x = this.tail ? this.tail.x + NODE_W : 0;
    const node = new LevelNode(seg, x, i);
    if(this.tail){ this.tail.next = node; node.prev = this.tail; this.tail = node; }
    else { this.head = this.tail = node; }
    node.ensureArt();
    this.live++; this.spawned++;
    return node;
  }
  /** Keep at least one full node of runway past the right edge. */
  ensureAhead(camX, viewW){
    let guard = 0;
    while((!this.tail || this.tail.x + NODE_W < camX + viewW + NODE_W) && guard++ < 6) this.append();
  }
  /** Delete every node that has fully scrolled off the left edge. */
  cull(camX){
    while(this.head && this.head.x + NODE_W < camX - 8){
      const gone = this.head;
      this.head = gone.next;
      if(this.head) this.head.prev = null; else this.tail = null;
      gone.destroy();
      this.live--; this.destroyed++;
    }
  }
  *visible(camX, viewW){
    for(let n=this.head; n; n=n.next){
      if(n.x + NODE_W < camX) continue;
      if(n.x > camX + viewW) break;
      yield n;
    }
  }
  /** Collision boxes near a world rect (only live nodes are consulted). */
  boxesNear(x, y, w, h){
    const out = [];
    for(let n=this.head; n; n=n.next){
      if(n.x + NODE_W < x - 64 || n.x > x + w + 64) continue;
      for(const b of n.boxes){
        if(b.x < x+w+32 && b.x+b.w > x-32 && b.y < y+h+32 && b.y+b.h > y-32) out.push(b);
      }
    }
    return out;
  }
}
