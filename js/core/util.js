"use strict";
/* Small helpers used everywhere: DOM lookups, clamping, escaping, toasts, deterministic noise. */

const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const clamp = (v,a,b) => v<a?a:v>b?b:v;
const lerp = (a,b,t) => a+(b-a)*t;
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(msg){
  const t=$("#toast");
  // in fullscreen only the fullscreen subtree renders, so move the toast inside it
  const host = document.fullscreenElement || document.body;
  if(t.parentElement !== host) host.appendChild(t);
  t.textContent=msg; t.hidden=false;
  clearTimeout(toast._t); toast._t=setTimeout(()=>t.hidden=true,2600);
}
function hash32(n){ n=(n^61)^(n>>>16); n=(n+(n<<3))|0; n^=n>>>4; n=Math.imul(n,0x27d4eb2d); n^=n>>>15; return (n>>>0)/4294967296; }
function rngFrom(seed){ let s=seed>>>0||1; return ()=>{ s^=s<<13; s>>>=0; s^=s>>17; s^=s<<5; s>>>=0; return s/4294967296; }; }
const pick = (rnd, arr) => arr[Math.floor(rnd()*arr.length) % arr.length];
