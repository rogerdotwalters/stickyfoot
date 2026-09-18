"use strict";
/* The editor's biome controls: pick one for a slide, push it across the whole
 * map, and build new ones by filling a sprite in for every category.
 *
 * Applying a biome rewrites the `sprite` of every piece that carries a `role`.
 * Pieces keep their role, so the next swap works just as well, and nothing
 * about collision, tokens or enemies is touched.
 */

function edBuildBiomeBar(){
  const sel = $("#edBiome");
  sel.innerHTML = "";
  const none = document.createElement("option");
  none.value = ""; none.textContent = "(as drawn)";
  sel.appendChild(none);
  for(const b of Biomes.all()){
    const o = document.createElement("option");
    o.value = b.id;
    o.textContent = b.name + (b.builtin ? "" : " ·");
    if(b.id === Ed.seg.art.biome) o.selected = true;
    sel.appendChild(o);
  }
  const b = Biomes.get(Ed.seg.art.biome);
  const gaps = b ? Biomes.missing(b) : [];
  $("#edBiomeNote").textContent = !b ? "Pieces draw with the sprite they were placed with."
    : gaps.length ? gaps.length + " categor" + (gaps.length===1?"y":"ies") + " unfilled: " + gaps.slice(0,3).join(", ")
    : "all " + CATEGORY_IDS.length + " categories filled";
  $("#edBiomeEdit").disabled = !b || !!(b && b.builtin);
}

$("#edBiome").onchange = e => {
  Ed.pushUndo();
  const n = applyBiome(Ed.seg, e.target.value);
  edBuildBiomeBar(); filmRender(); edPaint(); edSyncFields();
  toast(e.target.value ? "Swapped " + n + " piece" + (n===1?"":"s") + " to this biome"
                       : "Biome cleared — pieces keep the art they were drawn with");
};
$("#edBiomeAll").onclick = () => {
  const id = $("#edBiome").value;
  Ed.pushUndo();
  let n = 0;
  for(const seg of Ed.map.nodes) n += applyBiome(seg, id);
  Ed.dirty = true;
  edBuildBiomeBar(); filmRender(); edPaint(); edSyncFields();
  toast("Swapped " + n + " piece" + (n===1?"":"s") + " across " + Ed.map.nodes.length + " slides");
};

/* ---- the biome dialog ---- */
let bioDraft = null, bioEditingId = null;

function bioSpriteOptions(cat, chosen){
  const sel = document.createElement("select");
  const blank = document.createElement("option");
  blank.value = ""; blank.textContent = "— none —";
  sel.appendChild(blank);
  const forCat = [], others = [];
  for(const s of SPRITE_MANIFEST) (s.role === cat ? forCat : others).push(s);
  for(const a of CustomArt.items) others.push({id:a.id, label:a.label});
  const add = (list, label) => {
    if(!list.length) return;
    const g = document.createElement("optgroup"); g.label = label;
    for(const s of list){
      const o = document.createElement("option");
      o.value = s.id; o.textContent = (s.label ? s.label + " — " : "") + s.id;
      if(s.id === chosen) o.selected = true;
      g.appendChild(o);
    }
    sel.appendChild(g);
  };
  add(forCat, "for this category");
  add(others, "anything else");
  return sel;
}
function bioRenderRows(){
  const host = $("#bioRows");
  host.innerHTML = "";
  for(const cat of BLOCK_CATEGORIES){
    const row = document.createElement("div");
    row.className = "bio-row" + (bioDraft.assets[cat.id] ? "" : " empty");
    const c = document.createElement("canvas"); c.width = 28; c.height = 28;
    const cx = c.getContext("2d"); cx.imageSmoothingEnabled = false;
    const sp = SPRITES[bioDraft.assets[cat.id]];
    if(sp){
      const k = Math.min(28/sp.w, 28/sp.h);
      cx.drawImage(sp.canvas,0,0,sp.w,sp.h,(28-sp.w*k)/2,(28-sp.h*k)/2,sp.w*k,sp.h*k);
    }
    const name = document.createElement("span");
    name.className = "bio-cat"; name.textContent = cat.label; name.title = cat.hint;
    const sel = bioSpriteOptions(cat.id, bioDraft.assets[cat.id]);
    sel.onchange = () => { bioDraft.assets[cat.id] = sel.value; bioRenderRows(); };
    row.append(c, name, sel);
    host.appendChild(row);
  }
}
function openBiomeDialog(editId){
  bioEditingId = editId || null;
  const copySel = $("#bioCopy");
  copySel.innerHTML = "";
  for(const b of Biomes.all()){
    const o = document.createElement("option");
    o.value = b.id; o.textContent = b.name;
    copySel.appendChild(o);
  }
  if(editId){
    const b = Biomes.get(editId);
    bioDraft = { id:b.id, name:b.name, assets:Object.assign({}, b.assets) };
    $("#bioHead").textContent = "edit biome";
    copySel.value = editId; copySel.disabled = true;
  } else {
    bioDraft = Biomes.blank(Biomes.get(Ed.seg.art.biome) ? Ed.seg.art.biome : BUILTIN_BIOMES[0].id);
    $("#bioHead").textContent = "new biome";
    copySel.value = Ed.seg.art.biome || BUILTIN_BIOMES[0].id;
    copySel.disabled = false;
  }
  $("#bioName").value = bioDraft.name;
  $("#bioErr").textContent = "";
  $("#bioDelete").hidden = !editId;
  bioRenderRows();
  $("#dlgBiome").showModal();
}
$("#bioCopy").onchange = e => {
  const from = Biomes.get(e.target.value);
  if(!from) return;
  bioDraft.assets = Object.assign({}, from.assets);
  bioRenderRows();
};
$("#edBiomeNew").onclick = () => openBiomeDialog(null);
$("#edBiomeEdit").onclick = () => {
  const b = Biomes.get(Ed.seg.art.biome);
  if(!b){ toast("Pick a biome first."); return; }
  if(b.builtin){ toast("Built-in biomes are read-only — make a new one from this as a copy."); return; }
  openBiomeDialog(b.id);
};
$("#bioCancel").onclick = () => { try{ $("#dlgBiome").close(); }catch(e){} };
$("#bioDelete").onclick = async () => {
  if(!bioEditingId) return;
  try{ $("#dlgBiome").close(); }catch(e){}
  if(!await ask("Delete the biome \u201c" + bioDraft.name + "\u201d? Slides using it fall back to the art they were drawn with.", "delete biome")) return;
  Biomes.drop(bioEditingId);
  for(const seg of Ed.map.nodes) if(seg.art.biome === bioEditingId) seg.art.biome = "";
  edBuildBiomeBar(); filmRender(); edPaint();
};
$("#bioSave").onclick = () => {
  const name = clean($("#bioName").value);
  if(name.length < 2){ $("#bioErr").textContent = "Give the biome a name."; return; }
  const empty = CATEGORY_IDS.filter(c => !bioDraft.assets[c]);
  if(empty.length){
    $("#bioErr").textContent = "Still to fill: " + empty.map(c => {
      const cat = BLOCK_CATEGORIES.find(x => x.id === c); return cat ? cat.label : c;
    }).join(", ");
    return;
  }
  const id = bioEditingId || ("biome_" + name.toLowerCase().replace(/[^a-z0-9]+/g,"_").slice(0,20) + "_" + Date.now().toString(36).slice(-4));
  Biomes.put({ id, name, assets:Object.assign({}, bioDraft.assets) });
  try{ $("#dlgBiome").close(); }catch(e){}
  Ed.pushUndo();
  applyBiome(Ed.seg, id);
  edBuildBiomeBar(); filmRender(); edPaint(); edSyncFields();
  toast("Saved \u201c" + name + "\u201d and applied it to this slide");
};
