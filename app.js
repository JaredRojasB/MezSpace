/* ============================================================
   MezSpace v4 — app.js
   Meztal | Sistema de Reserva de Escritorios
   ============================================================ */

const ADMIN_PIN = 'meztal2024';

/*
  Layout:
  ─────────────────────────────────────────────────────────
  MT1 / MT2 :  4 cols × 2 facing rows = 8 desks each
  WM1 / WM2 :  1 standalone desk  +  3 cols × 2 rows = 7 desks each
  NE         :  1 desk (visible, NOT bookable)

  Desk IDs:
    MT1-A1 … MT1-A4  (top row)    MT1-B1 … MT1-B4  (bottom row)
    WM1-S             (standalone) WM1-A1…A3  WM1-B1…B3
    NE-1              (non-bookable)
  ─────────────────────────────────────────────────────────
*/
const SECTIONS = [
  { id:'MT1', cols:4, standalone:false },
  { id:'MT2', cols:4, standalone:false },
  { id:'WM1', cols:3, standalone:true  },
  { id:'WM2', cols:3, standalone:true  },
];

const ADMIN_SECS = [
  { label:'Meztal Teams',         rows:2 },
  { label:'Meztal Teams',         rows:2 },
  { label:'Meztal HQ Admin',      rows:2 },
  { label:'Meztal HQ Recruiting', rows:2 },
];

const DAY_S = ['dom','lun','mar','mié','jue','vie','sáb'];
const DAY_F = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const MONTH = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

let S = {
  selDate:  todayStr(),
  selDesks: [],
  name:  '',
  email: '',
  bookings:  {},
  wkOffset:  0,
};

// ── Storage ───────────────────────────────────────────────────
function loadBk()  { try { S.bookings = JSON.parse(localStorage.getItem('mzsp_bk')||'{}'); } catch(e) { S.bookings={}; } }
function saveBk()  { localStorage.setItem('mzsp_bk', JSON.stringify(S.bookings)); }
function loadSes() {
  try {
    const d = JSON.parse(sessionStorage.getItem('mzsp_ses')||'null');
    if (d) {
      S.name=d.name||''; S.email=d.email||'';
      const n=document.getElementById('userName'), e=document.getElementById('userEmail');
      if (n) n.value=S.name; if (e) e.value=S.email;
    }
  } catch(e){}
}
function saveSes() { sessionStorage.setItem('mzsp_ses', JSON.stringify({name:S.name,email:S.email})); }

// ── Date helpers ──────────────────────────────────────────────
function todayStr() { return new Date().toISOString().split('T')[0]; }
function mkDate(str) { const[y,m,d]=str.split('-').map(Number); return new Date(y,m-1,d); }
function fmtDate(str) { const dt=mkDate(str); return `${DAY_F[dt.getDay()]} ${dt.getDate()} de ${MONTH[dt.getMonth()]}`; }
function fmtShort(str){ const dt=mkDate(str); return `${DAY_S[dt.getDay()]} ${dt.getDate()}/${dt.getMonth()+1}`; }
function weekStart(offset) {
  const t=new Date(), m=new Date(t), dw=t.getDay();
  m.setDate(t.getDate()-(dw===0?6:dw-1)+offset*7);
  m.setHours(0,0,0,0); return m;
}
function weekDates(offset) {
  const m=weekStart(offset);
  return Array.from({length:7},(_,i)=>{ const d=new Date(m); d.setDate(m.getDate()+i); return d.toISOString().split('T')[0]; });
}

// ── Booking rules ─────────────────────────────────────────────
function canBook(dateStr) {
  if (dateStr<todayStr()) return false;
  if (weekDates(0).includes(dateStr)) return true;
  const dow=new Date().getDay();
  if ((dow===6||dow===0)&&weekDates(1).includes(dateStr)) return true;
  return false;
}
function isPast(dateStr)      { return dateStr<todayStr(); }
function nextWeekUnlocked()   { const d=new Date().getDay(); return d===6||d===0; }

// ── Booking CRUD ──────────────────────────────────────────────
function dayBk(date)         { return S.bookings[date]||{}; }
function getDeskBk(date, id) { return (S.bookings[date]||{})[id]||null; }
function addBk(date, id, name, email) {
  if (getDeskBk(date,id)) return false;
  if (!S.bookings[date]) S.bookings[date]={};
  S.bookings[date][id]={name,email,ts:Date.now()};
  saveBk(); return true;
}
function cancelBk(date, id) {
  if (!S.bookings[date]) return;
  delete S.bookings[date][id];
  if (!Object.keys(S.bookings[date]).length) delete S.bookings[date];
  saveBk();
}
function myBkList(email) {
  const today=todayStr(), r=[];
  Object.entries(S.bookings).forEach(([date,desks])=>{
    if (date<today) return;
    Object.entries(desks).forEach(([id,bk])=>{ if(bk.email===email) r.push({date,id,...bk}); });
  });
  return r.sort((a,b)=>a.date.localeCompare(b.date));
}
function deskStatus(id) {
  const bk=getDeskBk(S.selDate,id);
  if (!bk) return 'available';
  if (S.email&&bk.email===S.email) return 'mine';
  return 'occupied';
}

// ── SVG Icons ─────────────────────────────────────────────────
const DUAL_MON = `<div class="desk-icon">
  <svg viewBox="0 0 52 22" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="22" height="14" rx="1.5" stroke="currentColor" stroke-width="1.6"/>
    <path d="M7 19h10M12 15v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    <rect x="29" y="1" width="22" height="14" rx="1.5" stroke="currentColor" stroke-width="1.6"/>
    <path d="M35 19h10M40 15v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  </svg>
</div>`;

const SINGLE_MON = `<div class="desk-icon">
  <svg viewBox="0 0 26 22" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="24" height="14" rx="1.5" stroke="currentColor" stroke-width="1.6"/>
    <path d="M8 19h10M13 15v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  </svg>
</div>`;

const ADM_MON = `<svg viewBox="0 0 24 18" fill="none" style="width:12px;height:auto">
  <rect x="1" y="1" width="22" height="13" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
  <path d="M6 17h12M12 14v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>`;

// ── Build a bookable desk element ─────────────────────────────
function mkDesk(id, icon) {
  const bk     = getDeskBk(S.selDate, id);
  const stat   = deskStatus(id);
  const isSel  = S.selDesks.includes(id);
  const locked = !canBook(S.selDate);
  const past   = isPast(S.selDate);

  const el = document.createElement('div');
  let cls = 'desk';
  if (isSel)              cls += ' selected';
  else if (stat==='mine')     cls += ' mine';
  else if (stat==='occupied') cls += ' occupied';
  if (locked||past) cls += ' locked-date';
  el.className = cls;
  el.dataset.id = id;

  const shortLabel = id.split('-').slice(1).join('');
  const tipText = bk ? bk.name : isSel ? 'Seleccionado' : locked ? 'No disponible aún' : past ? 'Fecha pasada' : 'Disponible';

  el.innerHTML = `${icon||DUAL_MON}
    <span class="desk-id">${shortLabel}</span>
    <div class="desk-tip">${tipText}</div>`;

  if (bk&&!isSel) el.style.color = stat==='mine' ? '#2E7D32' : 'var(--orange)';
  else if (isSel) el.style.color = 'var(--blue)';

  if (!locked&&!past) {
    if (stat==='occupied'||stat==='mine') el.addEventListener('click', ()=>onOccupied(id,bk));
    else el.addEventListener('click', ()=>onDesk(id));
  }
  return el;
}

// ── Render floor plan ─────────────────────────────────────────
function renderFloor() {
  const fp = document.getElementById('floorPlan');
  if (!fp) return;
  fp.innerHTML = '';

  /* ── Left: bookable employee area ── */
  const left = document.createElement('div');
  left.className = 'floor-left';

  // Mock rooms at top
  const top = document.createElement('div');
  top.className = 'floor-top';
  top.innerHTML = `
    <div class="mock-room"><div class="mock-room-lbl">IT Room</div></div>
    <div class="mock-room"><div class="mock-room-lbl">Conference Room</div></div>`;
  left.appendChild(top);

  // 4 employee sections
  SECTIONS.forEach(sec => {
    const wrap = document.createElement('div');
    wrap.className = 'sec-wrap';

    // Standalone bookable desk (WM sections)
    if (sec.standalone) {
      const stdWrap = document.createElement('div');
      stdWrap.className = 'desk-standalone';
      stdWrap.appendChild(mkDesk(`${sec.id}-S`, SINGLE_MON));
      wrap.appendChild(stdWrap);
    }

    // Double-row block
    const block = document.createElement('div');
    block.className = 'sec-block';

    const rowA = document.createElement('div');
    rowA.className = 'desk-row';
    for (let c=1; c<=sec.cols; c++) rowA.appendChild(mkDesk(`${sec.id}-A${c}`));

    const sep = document.createElement('div');
    sep.className = 'row-sep';

    const rowB = document.createElement('div');
    rowB.className = 'desk-row';
    for (let c=1; c<=sec.cols; c++) rowB.appendChild(mkDesk(`${sec.id}-B${c}`));

    block.appendChild(rowA);
    block.appendChild(sep);
    block.appendChild(rowB);
    wrap.appendChild(block);
    left.appendChild(wrap);
  });

  // NE desk — visible, NOT bookable
  const neWrap = document.createElement('div');
  neWrap.className = 'ne-wrap';
  const neDesk = document.createElement('div');
  neDesk.className = 'desk desk-ne';
  neDesk.innerHTML = `${SINGLE_MON}<span class="desk-id">NE</span><div class="desk-tip">No disponible</div>`;
  neWrap.appendChild(neDesk);
  left.appendChild(neWrap);

  fp.appendChild(left);

  /* ── Right: admin area — same height via flex ── */
  const right = document.createElement('div');
  right.className = 'floor-right';
  right.innerHTML = '<div class="adm-zone-lbl">Área Administrativa</div>';

  ADMIN_SECS.forEach(sec => {
    const s = document.createElement('div');
    s.className = 'adm-sec';
    const lbl = document.createElement('div');
    lbl.className = 'adm-sec-lbl';
    lbl.textContent = sec.label;
    s.appendChild(lbl);
    for (let r=0; r<sec.rows; r++) {
      const row = document.createElement('div');
      row.className = 'adm-desk-row';
      for (let c=0; c<2; c++) {
        const d = document.createElement('div');
        d.className = 'desk-adm';
        d.innerHTML = ADM_MON;
        row.appendChild(d);
      }
      s.appendChild(row);
    }
    right.appendChild(s);
  });

  fp.appendChild(right);
}

function onDesk(id) {
  const idx = S.selDesks.indexOf(id);
  if (idx>=0) S.selDesks.splice(idx,1); else S.selDesks.push(id);
  renderFloor(); renderSelList();
}
function onOccupied(id, bk) {
  if (!bk) return;
  const myEmail = S.email||document.getElementById('userEmail')?.value.trim();
  if (bk.email===myEmail) {
    if (confirm(`¿Cancelar tu reserva del escritorio ${id} para el ${fmtDate(S.selDate)}?`)) {
      cancelBk(S.selDate,id); toast('Reserva cancelada','info');
      renderFloor(); renderWeekBar(); renderMyBk();
    }
  } else { toast(`Ocupado por: ${bk.name}`,'info'); }
}

// ── Week Bar ──────────────────────────────────────────────────
function renderWeekBar() {
  const strip=document.getElementById('dayStrip'),wkLbl=document.getElementById('wkLabel');
  const prev=document.getElementById('prevWk'),next=document.getElementById('nextWk');
  if (!strip) return;
  const dates=weekDates(S.wkOffset), today=todayStr();
  const s=mkDate(dates[0]),e=mkDate(dates[6]);
  if (wkLbl) wkLbl.textContent=`${s.getDate()} ${MONTH[s.getMonth()].substr(0,3)} — ${e.getDate()} ${MONTH[e.getMonth()].substr(0,3)} ${e.getFullYear()}`;
  strip.innerHTML='';
  dates.forEach(d=>{
    const dt=mkDate(d),locked=!canBook(d)&&!isPast(d),past=isPast(d),hasBk=Object.keys(dayBk(d)).length>0;
    const chip=document.createElement('div');
    let cls='day-chip';
    if (d===S.selDate) cls+=' active'; else if(d===today) cls+=' today';
    if (locked) cls+=' locked'; if(past&&d!==S.selDate) cls+=' past'; if(hasBk) cls+=' has-bk';
    chip.className=cls;
    chip.innerHTML=`<span class="dn">${DAY_S[dt.getDay()]}</span><span class="dd">${dt.getDate()}</span><span class="dot"></span>`;
    if (!locked) chip.addEventListener('click',()=>{ S.selDate=d; S.selDesks=[]; renderWeekBar(); renderFloor(); renderSelList(); updateDateTag(); });
    strip.appendChild(chip);
  });
  if(prev) prev.disabled=S.wkOffset<=0;
  if(next) next.disabled=S.wkOffset>=1||!nextWeekUnlocked();
}
function updateDateTag() { const el=document.getElementById('dateTag'); if(el) el.textContent=fmtDate(S.selDate); }

// ── Side Panel ────────────────────────────────────────────────
function renderSelList() {
  const list=document.getElementById('selList'),btn=document.getElementById('confirmBtn');
  if (!list) return;
  list.innerHTML='';
  if (!S.selDesks.length) { list.innerHTML='<div class="sel-empty">Haz clic en un escritorio<br>para seleccionarlo</div>'; }
  else { S.selDesks.forEach(id=>{ const el=document.createElement('div'); el.className='sel-item'; el.innerHTML=`<span class="sel-item-id">${id}</span><button class="btn-rm" onclick="removeDesk('${id}')" title="Quitar">✕</button>`; list.appendChild(el); }); }
  if (btn) btn.disabled=!S.selDesks.length;
}
function removeDesk(id) { S.selDesks=S.selDesks.filter(x=>x!==id); renderFloor(); renderSelList(); }
function confirmBooking() {
  const nEl=document.getElementById('userName'),eEl=document.getElementById('userEmail');
  const name=nEl?.value.trim()||'',email=eEl?.value.trim()||'';
  if (!name)                        { toast('Ingresa tu nombre completo','err'); nEl?.focus(); return; }
  if (!email||!email.includes('@')) { toast('Ingresa un correo válido','err');   eEl?.focus(); return; }
  if (!S.selDesks.length) return;
  let ok=0,dup=0;
  S.selDesks.forEach(id=>{ addBk(S.selDate,id,name,email)?ok++:dup++; });
  S.name=name; S.email=email; saveSes(); S.selDesks=[];
  if (ok)  toast(`✓ ${ok} escritorio${ok>1?'s':''} reservado${ok>1?'s':''}`, 'ok');
  if (dup) toast(`${dup} escritorio(s) ya estaban ocupados`, 'err');
  renderFloor(); renderWeekBar(); renderSelList(); renderMyBk();
}

// ── My Bookings ───────────────────────────────────────────────
function renderMyBk() {
  const container=document.getElementById('myBkList'); if (!container) return;
  const email=S.email||document.getElementById('userEmail')?.value.trim();
  if (!email) { container.innerHTML='<div class="bk-empty">Ingresa tu correo para ver tus reservas</div>'; return; }
  const bks=myBkList(email);
  if (!bks.length) { container.innerHTML='<div class="bk-empty">Sin reservas activas</div>'; return; }
  container.innerHTML='';
  bks.forEach(bk=>{ const item=document.createElement('div'); item.className='my-bk-item'; item.innerHTML=`<span class="bk-desk">${bk.id}</span><span class="bk-date">${fmtShort(bk.date)}</span><button class="btn-bk-cancel" onclick="cancelMyBk('${bk.date}','${bk.id}')" title="Cancelar">✕</button>`; container.appendChild(item); });
}
function cancelMyBk(date, id) {
  const email=S.email||document.getElementById('userEmail')?.value.trim();
  const bk=getDeskBk(date,id); if(!bk||bk.email!==email) return;
  if (confirm(`¿Cancelar reserva ${id} — ${fmtDate(date)}?`)) { cancelBk(date,id); toast('Reserva cancelada','info'); renderFloor(); renderWeekBar(); renderMyBk(); }
}

// ── Toast ─────────────────────────────────────────────────────
function toast(msg,type='info') {
  const z=document.getElementById('toastZone'); if(!z) return;
  const t=document.createElement('div'); t.className=`toast ${type}`; t.textContent=msg;
  z.appendChild(t);
  setTimeout(()=>{ t.style.transition='all .25s'; t.style.opacity='0'; t.style.transform='translateX(60px)'; setTimeout(()=>t.remove(),280); },3000);
}

// ── Employee init ─────────────────────────────────────────────
function initEmployee() {
  loadBk(); loadSes();
  renderWeekBar(); renderFloor(); renderSelList(); updateDateTag(); renderMyBk();
  document.getElementById('prevWk')?.addEventListener('click',()=>{ if(S.wkOffset>0){S.wkOffset--;renderWeekBar();} });
  document.getElementById('nextWk')?.addEventListener('click',()=>{ if(S.wkOffset<1&&nextWeekUnlocked()){S.wkOffset++;renderWeekBar();} });
  document.getElementById('confirmBtn')?.addEventListener('click',confirmBooking);
  document.getElementById('userEmail')?.addEventListener('blur',()=>{ const v=document.getElementById('userEmail')?.value.trim(); if(v){S.email=v;renderMyBk();} });
}

// ══════════════════════════════════════════════════════════════
//   ADMIN
// ══════════════════════════════════════════════════════════════
function checkPin() {
  const pin=document.getElementById('pinInput')?.value||'';
  if (pin===ADMIN_PIN) {
    document.getElementById('pinOverlay').style.display='none';
    document.getElementById('adminContent').style.display='block';
    initAdmin();
  } else {
    const err=document.getElementById('pinErr');
    if(err){err.textContent='PIN incorrecto.';err.style.display='block';}
    const inp=document.getElementById('pinInput'); if(inp){inp.value='';inp.focus();}
  }
}
function initAdmin() {
  loadBk(); renderAdminStats(); renderAdminTable();
  document.getElementById('filterSearch')?.addEventListener('input',applyAdminFilters);
  document.getElementById('filterDate')?.addEventListener('change',applyAdminFilters);
  document.getElementById('btnClear')?.addEventListener('click',()=>{ const s=document.getElementById('filterSearch'),d=document.getElementById('filterDate'); if(s)s.value='';if(d)d.value=''; renderAdminTable(); });
}
function applyAdminFilters() { renderAdminTable(document.getElementById('filterSearch')?.value||'',document.getElementById('filterDate')?.value||''); }
function getAllBkRows() {
  const rows=[];
  Object.entries(S.bookings).forEach(([date,desks])=>Object.entries(desks).forEach(([id,bk])=>rows.push({date,id,...bk})));
  return rows.sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
}
function renderAdminStats() {
  const all=getAllBkRows(),today=todayStr(),cw=weekDates(0);
  const el=id=>document.getElementById(id);
  if(el('sToday')) el('sToday').textContent=Object.keys(dayBk(today)).length;
  if(el('sWeek'))  el('sWeek').textContent=all.filter(r=>cw.includes(r.date)).length;
  if(el('sUsers')) el('sUsers').textContent=new Set(all.map(r=>r.email)).size;
  if(el('sTotal')) el('sTotal').textContent=all.length;
}
function renderAdminTable(search='',dateFilter='') {
  const tbody=document.getElementById('adminTbody'); if(!tbody) return;
  let rows=getAllBkRows();
  if(search){const q=search.toLowerCase();rows=rows.filter(r=>r.name.toLowerCase().includes(q)||r.email.toLowerCase().includes(q)||r.id.toLowerCase().includes(q));}
  if(dateFilter) rows=rows.filter(r=>r.date===dateFilter);
  if(!rows.length){tbody.innerHTML='<tr><td colspan="5" class="tbl-empty">No hay reservas que coincidan con los filtros</td></tr>';return;}
  tbody.innerHTML='';
  rows.forEach(r=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td><span class="desk-pill">${r.id}</span></td><td style="font-weight:700">${esc(r.name)}</td><td style="color:var(--gray-400)">${esc(r.email)}</td><td>${fmtDate(r.date)}</td><td><button class="btn-row-cancel" onclick="adminCancel('${r.date}','${r.id}')">Cancelar</button></td>`; tbody.appendChild(tr); });
}
function adminCancel(date,id) {
  if(!confirm(`¿Cancelar escritorio ${id} — ${fmtDate(date)}?`)) return;
  cancelBk(date,id); toast('Reserva cancelada','info'); renderAdminStats(); applyAdminFilters();
}
function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

// ── Auto-init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',()=>{
  if(document.getElementById('floorPlan')) initEmployee();
  if(document.getElementById('pinOverlay')){
    loadBk();
    document.getElementById('pinInput')?.focus();
    document.getElementById('pinInput')?.addEventListener('keydown',e=>{ if(e.key==='Enter') checkPin(); });
  }
});
