"use strict";
/* Everything that persists: players, scores, saved maps, preferences. Local storage only, every call guarded. */

/* ---------- 2. local storage ---------- */
const KEY = { users:"stickyfoot.users.v1", active:"stickyfoot.active.v1",
              segs:"stickyfoot.segments.v1", prefs:"stickyfoot.prefs.v1",
              maps:"stickyfoot.maps.v1", activeMap:"stickyfoot.activemap.v1",
              art:"stickyfoot.art.v1" };
function load(key, fallback){
  try{ const raw = localStorage.getItem(key); if(raw==null) return fallback; return JSON.parse(raw); }
  catch(e){ return fallback; }
}
function save(key, value){
  try{ localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch(e){ toast("This browser refused to save local data."); return false; }
}
const Store = {
  users: load(KEY.users, []),
  activeId: load(KEY.active, null),
  segs: load(KEY.segs, []),
  maps: load(KEY.maps, []),
  activeMapId: load(KEY.activeMap, null),
  prefs: Object.assign({mask:false, useCustom:"builtin"}, load(KEY.prefs, {})),
  saveUsers(){ save(KEY.users, this.users); },
  saveSegs(){ save(KEY.segs, this.segs); },
  saveMaps(){ save(KEY.maps, this.maps); save(KEY.activeMap, this.activeMapId); },
  activeMap(){ return this.maps.find(m=>m.id===this.activeMapId) || this.maps[0] || null; },
  upsertMap(map){
    const i = this.maps.findIndex(m=>m.id===map.id);
    if(i>=0) this.maps[i] = map; else this.maps.push(map);
    this.activeMapId = map.id; this.saveMaps();
  },
  savePrefs(){ save(KEY.prefs, this.prefs); },
  active(){ return this.users.find(u=>u.id===this.activeId) || null; },
  setActive(id){ this.activeId=id; save(KEY.active,id); paintChip(); },
  addUser(name, email, phone){
    const u = { id:"u"+Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36),
      name:clean(name), email:clean(email).toLowerCase(), phone:clean(phone),
      contact:clean(email).toLowerCase(),
      best:0, bestLedges:0, bestDist:0, runs:0, lastAt:null, createdAt:Date.now() };
    this.users.push(u); this.saveUsers(); return u;
  },
  findBy(email, phone){
    const e = clean(email).toLowerCase(), pk = phoneKey(phone);
    return this.users.find(u => (e && userEmail(u).toLowerCase() === e) ||
                                (pk && phoneKey(userPhone(u)) === pk)) || null;
  },
  /* A cabinet run is anonymous until it ends. The score only lands if the
     name, email and phone all pass; otherwise nothing is written at all. */
  saveScore(entry){
    const name = clean(entry.name), email = clean(entry.email).toLowerCase(), phone = clean(entry.phone);
    if(!validName(name) || !validEmail(email) || !validPhone(phone)) return {ok:false};
    let u = this.findBy(email, phone);
    if(!u) u = this.addUser(name, email, phone);
    else { u.name = name; u.email = email; u.phone = phone; u.contact = email; }
    u.runs = (u.runs|0) + 1; u.lastAt = Date.now();
    const isBest = (entry.score|0) > (u.best|0);
    if(isBest) u.best = entry.score|0;
    if((entry.ledges|0) > (u.bestLedges|0)) u.bestLedges = entry.ledges|0;
    if((entry.dist|0) > (u.bestDist|0)) u.bestDist = entry.dist|0;
    this.saveUsers();
    const rank = this.ranked().findIndex(x=>x.id===u.id) + 1;
    return {ok:true, user:u, isBest, rank};
  },
  ranked(){ return this.users.slice().sort((a,b)=>(b.best|0)-(a.best|0) || a.name.localeCompare(b.name)); },
  removeUser(id){
    this.users = this.users.filter(u=>u.id!==id); this.saveUsers();
    if(this.activeId===id) this.setActive(this.users[0]?this.users[0].id:null);
  },
  recordRun(score, ledges, dist){
    const u = this.active(); if(!u) return {isBest:false};
    u.runs = (u.runs|0)+1; u.lastAt = Date.now();
    let isBest = false;
    if(score > (u.best|0)){ u.best = score; isBest = true; }
    if(ledges > (u.bestLedges|0)) u.bestLedges = ledges;
    if(dist > (u.bestDist|0)) u.bestDist = dist;
    this.saveUsers(); return {isBest};
  },
  topScore(){ return this.users.reduce((m,u)=>Math.max(m,u.best|0),0); }
};
/* one-time migration: the old flat segment library becomes a map */
if(!Store.maps.length && Store.segs.length){
  Store.maps.push({ id:"map_library", name:"Imported segments",
                    nodes: Store.segs.map(x=>JSON.parse(JSON.stringify(x))) });
  Store.activeMapId = "map_library";
  Store.saveMaps();
}

/* every field is trimmed and collapsed before it is judged or stored */
function clean(v){ return String(v == null ? "" : v).replace(/\s+/g," ").trim(); }
function validName(v){ const t = clean(v); return t.length >= 2 && t.length <= 40; }
function validEmail(v){
  const t = clean(v).toLowerCase();
  return t.length <= 80 && /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(t);
}
function validPhone(v){
  const t = clean(v);
  if(!/^\+?[\d\s().-]+$/.test(t)) return false;
  const d = t.replace(/\D/g,"");
  return d.length >= 7 && d.length <= 15;
}
function phoneKey(v){ return clean(v).replace(/\D/g,""); }
function userEmail(u){ return u.email || (u.contact && u.contact.includes("@") ? u.contact : ""); }
function userPhone(u){ return u.phone || (u.contact && !u.contact.includes("@") ? u.contact : ""); }
function maskContact(c){
  if(!Store.prefs.mask) return c;
  if(c.includes("@")){ const [a,b]=c.split("@"); return a.slice(0,2)+"•••@"+b; }
  return c.replace(/\d(?=\d{2})/g,"•");
}
