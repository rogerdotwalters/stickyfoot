"use strict";
/* Players, contact validation, the leaderboard table and the confirm dialog. */

/* ---------- 7. players, leaderboard, shell ---------- */
function ask(msg, okLabel){
  return new Promise(res=>{
    const dlg = $("#dlgAsk");
    $("#askText").textContent = msg;
    $("#askOk").textContent = okLabel || "confirm";
    let settled = false;
    const finish = v => { if(settled) return; settled = true; try{ dlg.close(); }catch(e){} res(v); };
    $("#askOk").onclick = ()=>finish(true);
    $("#askCancel").onclick = ()=>finish(false);
    dlg.addEventListener("cancel", ()=>finish(false), {once:true});
    dlg.showModal();
  });
}
function paintChip(){
  const u = Store.active();
  const el = $("#chipName");
  el.textContent = u ? u.name : "no player";
  el.className = u ? "" : "none";
  $("#startWho").textContent = u ? u.name : "none";
  $("#startBest").textContent = u ? (u.best|0) : Store.topScore();
}
function fmtDate(ts){
  if(!ts) return "—";
  const d = new Date(ts), now = Date.now();
  if(now-ts < 86400000) return d.toLocaleTimeString([], {hour:"numeric", minute:"2-digit"});
  return d.toLocaleDateString([], {month:"short", day:"numeric"});
}
function renderBoard(){
  const body = $("#boardBody"), rows = Store.ranked();
  body.innerHTML = "";
  $("#boardEmpty").style.display = rows.length ? "none" : "block";
  $("#boardTable").style.display = rows.length ? "table" : "none";
  rows.forEach((u,i)=>{
    const tr = document.createElement("tr");
    if(u.id===Store.activeId) tr.className = "me";
    tr.innerHTML =
      '<td class="rank">'+(i+1)+'</td>'+
      '<td><b>'+esc(u.name)+'</b>'+(u.id===Store.activeId?' <span class="pill">playing</span>':'')+'</td>'+
      '<td>'+esc(maskContact(userEmail(u)||"—"))+'</td>'+
      '<td>'+esc(maskContact(userPhone(u)||"—"))+'</td>'+
      '<td class="score-cell">'+(u.best|0)+'</td>'+
      '<td>'+(u.bestLedges|0)+'</td>'+
      '<td>'+(u.runs|0)+'</td>'+
      '<td>'+fmtDate(u.lastAt)+'</td>';
    const td = document.createElement("td");
    td.style.whiteSpace = "nowrap";
    const play = document.createElement("button"); play.className="btn small"; play.textContent="play as";
    play.onclick = ()=>{ Store.setActive(u.id); renderBoard(); toast(u.name+" is up."); };
    const edit = document.createElement("button"); edit.className="btn small"; edit.textContent="edit";
    edit.onclick = ()=>openEdit(u.id);
    td.append(play, document.createTextNode(" "), edit);
    tr.appendChild(td);
    body.appendChild(tr);
  });
  paintChip();
}
$("#userForm").onsubmit = e=>{
  e.preventDefault();
  const name = clean($("#uName").value), email = clean($("#uEmail").value), phone = clean($("#uPhone").value);
  const err = $("#userErr");
  if(!validName(name)){ err.textContent = "A name needs between two and forty characters."; return; }
  if(!validEmail(email)){ err.textContent = "Enter an email like rosa@example.com."; return; }
  if(!validPhone(phone)){ err.textContent = "Enter a phone number with 7 to 15 digits."; return; }
  if(Store.findBy(email, phone)){ err.textContent = "Someone with that email or phone is already on the list."; return; }
  err.textContent = "";
  const u = Store.addUser(name, email, phone);
  if(!Store.activeId) Store.setActive(u.id);
  $("#uName").value = ""; $("#uEmail").value = ""; $("#uPhone").value = "";
  renderBoard(); renderHiScores(); toast(name+" added.");
};
let editingId = null;
function openEdit(id){
  const u = Store.users.find(x=>x.id===id); if(!u) return;
  editingId = id;
  $("#eName").value = u.name; $("#eEmail").value = userEmail(u); $("#ePhone").value = userPhone(u);
  $("#eScore").value = u.best|0; $("#eLedges").value = u.bestLedges|0;
  $("#editErr").textContent = "";
  $("#dlgEdit").showModal();
}
$("#editCancel").onclick = ()=>$("#dlgEdit").close();
$("#editSave").onclick = ()=>{
  const u = Store.users.find(x=>x.id===editingId); if(!u) return;
  const name = clean($("#eName").value), email = clean($("#eEmail").value), phone = clean($("#ePhone").value);
  if(!validName(name)){ $("#editErr").textContent = "A name needs between two and forty characters."; return; }
  if(!validEmail(email)){ $("#editErr").textContent = "That email does not look right."; return; }
  if(!validPhone(phone)){ $("#editErr").textContent = "A phone number needs 7 to 15 digits."; return; }
  u.name = name; u.email = email.toLowerCase(); u.phone = phone; u.contact = u.email;
  u.best = Math.max(0, +$("#eScore").value||0);
  u.bestLedges = Math.max(0, +$("#eLedges").value||0);
  Store.saveUsers(); renderBoard(); renderHiScores(); $("#dlgEdit").close(); toast("Saved.");
};
$("#editDelete").onclick = async ()=>{
  const u = Store.users.find(x=>x.id===editingId); if(!u) return;
  $("#dlgEdit").close();
  if(!await ask("Delete "+u.name+" and their scores from this device?", "delete player")){ $("#dlgEdit").showModal(); return; }
  Store.removeUser(editingId); renderBoard(); renderHiScores(); toast("Player deleted.");
};
$("#btnMask").onclick = ()=>{
  Store.prefs.mask = !Store.prefs.mask; Store.savePrefs();
  $("#btnMask").textContent = Store.prefs.mask ? "show contact details" : "hide contact details";
  renderBoard();
};
$("#btnExportUsers").onclick = async ()=>{
  if(!Store.users.length){ toast("No players to export yet."); return; }
  const head = "name,email,phone,best score,best ledges,best distance,runs,last run\n";
  const rows = Store.ranked().map(u =>
    [u.name,userEmail(u),userPhone(u),u.best|0,u.bestLedges|0,u.bestDist|0,u.runs|0,u.lastAt?new Date(u.lastAt).toISOString():""]
      .map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(",")).join("\n");
  await saveFile("stickyfoot-players.csv", head+rows);
};
$("#btnWipe").onclick = async ()=>{
  if(!await ask("Erase every player, score and saved segment stored on this device? This cannot be undone.", "erase everything")) return;
  try{ Object.values(KEY).forEach(k=>localStorage.removeItem(k)); }catch(e){}
  CustomArt.items = []; Ed.openMap(newMap()); repaintArt();
  Store.users = []; Store.segs = []; Store.maps = []; Store.activeId = null; Store.activeMapId = null;
  Store.prefs = {mask:false, useCustom:"builtin"};
  renderBoard(); edBuildSegList(); refreshWorldButton(); toast("Local data erased.");
};

/* ---- player picker ---- */
$("#playerChip").onclick = openPicker;
$("#btnPickPlayer").onclick = openPicker;
function openPicker(){
  if(!Store.users.length){ go("players"); $("#uName").focus(); toast("Add a player first."); return; }
  const sel = $("#pickUser"); sel.innerHTML = "";
  for(const u of Store.users){
    const o = document.createElement("option");
    o.value = u.id; o.textContent = u.name + " — best " + (u.best|0);
    if(u.id===Store.activeId) o.selected = true;
    sel.appendChild(o);
  }
  $("#dlgPlayer").showModal();
}
$("#pickCancel").onclick = ()=>$("#dlgPlayer").close();
$("#pickOk").onclick = ()=>{ Store.setActive($("#pickUser").value); $("#dlgPlayer").close(); renderBoard(); };
