"use strict";
/* Saving and loading: downloads, the two-file export, the map bundle, and imports. */

/* ---- export / import ---- */
let dlCap, dlTried = false;
async function getDownloads(){
  if(!dlTried){
    dlTried = true;
    try { dlCap = (window.claude && window.claude.use) ? await window.claude.use("downloads") : null; }
    catch(e){ dlCap = null; }
  }
  return dlCap;
}
/* Last resort: hand the text over in a dialog so nothing is ever trapped
   inside the page just because a browser refused a download. */
function showJson(filename, text){
  $("#jsonTitle").textContent = filename;
  $("#jsonText").value = text;
  $("#dlgJson").showModal();
  setTimeout(()=>{ try{ $("#jsonText").focus(); $("#jsonText").select(); }catch(e){} }, 50);
}
$("#jsonClose").onclick = ()=>{ try{ $("#dlgJson").close(); }catch(e){} };
$("#jsonCopy").onclick = async ()=>{
  const t = $("#jsonText");
  try{
    if(navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(t.value);
    else { t.select(); document.execCommand("copy"); }
    toast("Copied to the clipboard.");
  }catch(e){ t.select(); toast("Select all and copy with your keyboard."); }
};

async function saveFile(filename, text){
  const cap = await getDownloads();
  if(cap){
    try { await cap.save({filename, data:text}); toast("Saved "+filename); return true; }
    catch(err){
      if(err && err.code === "declined") return false;
      toast("Could not save "+filename+" ("+((err&&err.code)||"error")+")");
      return false;
    }
  }
  try{
    const blob = (typeof Blob !== "undefined" && text instanceof Blob) ? text
               : new Blob([text], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
    toast("Saved "+filename); return true;
  }catch(e){ /* fall through to the dialog */ }
  if(typeof text === "string"){
    showJson(filename, text);
    toast("Downloads are blocked here — copy the text instead.");
    return true;
  }
  toast("Could not save " + filename + " in this view.");
  return false;
}
function currentFiles(){
  const col = JSON.parse(JSON.stringify(Ed.seg.collision));
  const art = JSON.parse(JSON.stringify(Ed.seg.art));
  delete art.sprites;
  col.id = art.id = Ed.seg.id; col.name = art.name = Ed.seg.name;
  col.width = art.width = NODE_W; col.height = art.height = NODE_H;
  return {col, art};
}
$("#edExportCol").onclick = async ()=>{ const f = currentFiles(); await saveFile(Ed.seg.id+".collision.json", JSON.stringify(f.col,null,2)); };
$("#edExportArt").onclick = async ()=>{ const f = currentFiles(); await saveFile(Ed.seg.id+".art.json", JSON.stringify(embedSprites(f.art),null,2)); };
$("#edExportBoth").onclick = async ()=>{
  const f = currentFiles();
  const ok = await saveFile(Ed.seg.id+".collision.json", JSON.stringify(f.col,null,2));
  if(ok !== false) await saveFile(Ed.seg.id+".art.json", JSON.stringify(embedSprites(f.art),null,2));
};
function mapFiles(){
  // every slide, normalised into its two files
  return Ed.map.nodes.map(seg=>{
    const col = JSON.parse(JSON.stringify(seg.collision));
    const art = JSON.parse(JSON.stringify(seg.art));
    delete art.sprites;
    col.id = art.id = seg.id; col.name = art.name = seg.name;
    col.width = art.width = NODE_W; col.height = art.height = NODE_H;
    return {col, art};
  });
}
function checkMap(){
  const files = mapFiles();
  for(let i=0;i<files.length;i++){
    const v = validatePair(files[i].col, files[i].art);
    if(!v.ok) return {ok:false, why:"slide "+(i+1)+": "+v.why};
  }
  const ids = new Set();
  for(const seg of Ed.map.nodes){
    if(ids.has(seg.id)) return {ok:false, why:"two slides share the id "+seg.id};
    ids.add(seg.id);
  }
  return {ok:true, files};
}
$("#edSave").onclick = ()=>{
  const r = checkMap();
  if(!r.ok){ toast(r.why); return; }
  const map = { id: Ed.map.id, name: Ed.map.name,
    nodes: Ed.map.nodes.map((seg,i)=>({ id:seg.id, name:seg.name,
      collision:r.files[i].col, art:r.files[i].art })) };
  Store.upsertMap(JSON.parse(JSON.stringify(map)));
  Ed.dirty = false;
  edBuildSegList(); edSyncFields(); refreshWorldButton();
  toast("Saved “"+map.name+"” — "+map.nodes.length+" slides");
};
$("#edExportMap").onclick = async ()=>{
  const r = checkMap();
  if(!r.ok){ toast(r.why); return; }
  const bundle = { format:"stickyfoot.map", version:1, id:Ed.map.id, name:Ed.map.name,
    width:NODE_W, height:NODE_H,
    nodes: r.files.map(f=>({collision:f.col, art:embedSprites(f.art)})) };
  await saveFile(Ed.map.id + ".map.json", JSON.stringify(bundle, null, 2));
};
$("#edTest").onclick = ()=>{
  const f = currentFiles();
  const v = validatePair(f.col, f.art);
  if(!v.ok){ toast(v.why); return; }
  if(!f.col.boxes.some(b=>b.type==="platform" || b.type==="cling")){
    toast("Add at least one platform so the gecko has somewhere to start."); return;
  }
  go("play");
  enterGame(Ed.map.nodes.slice(Ed.slide).map(x=>JSON.parse(JSON.stringify(x))));
};
/* Every slide as its own pair of files — the format the runtime and other
   people's editors read. One map bundle is easier to move; pairs are easier
   to hand-edit and to swap one at a time. */
$("#edExportAll").onclick = async ()=>{
  const r = checkMap();
  if(!r.ok){ toast(r.why); return; }
  let done = 0;
  for(const f of r.files){
    if(await saveFile(f.col.id + ".collision.json", JSON.stringify(f.col, null, 2)) === false) break;
    if(await saveFile(f.art.id + ".art.json", JSON.stringify(embedSprites(f.art), null, 2)) === false) break;
    done++;
  }
  if(done) toast("Exported " + done + " slide" + (done===1?"":"s") + " as file pairs.");
};
$("#edCopyMap").onclick = ()=>{
  const r = checkMap();
  if(!r.ok){ toast(r.why); return; }
  const bundle = { format:MAP_FORMAT, version:1, id:Ed.map.id, name:Ed.map.name,
    width:NODE_W, height:NODE_H,
    nodes: r.files.map(f=>({collision:f.col, art:embedSprites(f.art)})) };
  showJson(Ed.map.id + ".map.json", JSON.stringify(bundle, null, 2));
};
$("#edImport").onclick = ()=>$("#edFile").click();
$("#edFile").onchange = async e=>{
  const files = Array.from(e.target.files||[]);
  e.target.value = "";
  let col=null, art=null, bundle=null;
  for(const f of files){
    try{
      const j = JSON.parse(await f.text());
      if(j.format===COL_FORMAT) col = j;
      else if(j.format===ART_FORMAT) art = j;
      else if(j.format===MAP_FORMAT) bundle = j;
    }catch(err){ toast("“"+f.name+"” is not valid JSON."); return; }
  }
  if(bundle){
    if(!Array.isArray(bundle.nodes) || !bundle.nodes.length){ toast("That map file has no slides."); return; }
    const nodes = [];
    for(let i=0;i<bundle.nodes.length;i++){
      const r = segFromFiles(bundle.nodes[i].collision, bundle.nodes[i].art);
      if(!r.ok){ toast("slide "+(i+1)+": "+r.why); return; }
      absorbSprites(r.seg.art);
      nodes.push(normaliseSlide(r.seg));
    }
    if(Ed.dirty && !await ask("“"+Ed.map.name+"” has unsaved changes. Import over it?", "discard and import")) return;
    Ed.openMap({ id:(bundle.id||"map_imported")+"", name:bundle.name||"imported map", nodes });
    toast("Imported "+nodes.length+" slides");
    return;
  }
  if(!col || !art){ toast("Select a .map.json, or both files of a pair: .collision.json and .art.json."); return; }
  const r = segFromFiles(col, art);
  if(!r.ok){ toast(r.why); return; }
  Ed.pushUndo();
  absorbSprites(r.seg.art);
  Ed.useSeg(normaliseSlide(r.seg));
  Ed.sel = null; filmRender(); edSyncFields(); edPaint();
  toast("Imported "+r.seg.id+" into slide "+(Ed.slide+1));
};
