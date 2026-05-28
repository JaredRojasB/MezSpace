/* ============================================================
   MezSpace v6 — app.js
   ============================================================ */

const ADMIN_PIN    = 'meztal2024';
const TOTAL_DESKS  = 30;

const SECTIONS = [
  { id:'MT1', cols:4, standalone:false, label:'Fila 1' },
  { id:'MT2', cols:4, standalone:false, label:'Fila 2' },
  { id:'WM1', cols:3, standalone:true,  label:'Fila 3' },
  { id:'WM2', cols:3, standalone:true,  label:'Fila 4' },
];

const ADMIN_SECS = [
  { label:'Meztal Teams',         rows:2 },
  { label:'Meztal Teams',         rows:2 },
  { label:'Meztal HQ Admin',      rows:2 },
  { label:'Meztal HQ Recruiting', rows:2 },
];

const DAY_S  = ['dom','lun','mar','mié','jue','vie','sáb'];
const DAY_F  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const MONTH  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

let S = { selDate:todayStr(), selDesks:[], name:'', email:'', bookings:{}, wkOffset:0, pendingCancel:null };

// ── Storage ───────────────────────────────────────────────────
function loadBk()  { try{S.bookings=JSON.parse(localStorage.getItem('mzsp_bk')||'{}');}catch(e){S.bookings={};} }
function saveBk()  { localStorage.setItem('mzsp_bk',JSON.stringify(S.bookings)); }
function loadSes() {
  try {
    const d=JSON.parse(sessionStorage.getItem('mzsp_ses')||'null');
    if(d){ S.name=d.name||''; S.email=d.email||'';
      const n=document.getElementById('userName'), e=document.getElementById('userEmail');
      if(n)n.value=S.name; if(e)e.value=S.email; }
  }catch(e){}
}
function saveSes(){ sessionStorage.setItem('mzsp_ses',JSON.stringify({name:S.name,email:S.email})); }

// ── Dates ─────────────────────────────────────────────────────
function todayStr(){ return new Date().toISOString().split('T')[0]; }
function mkDate(s){ const[y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); }
function fmtDate(s){ const dt=mkDate(s); return `${DAY_F[dt.getDay()]} ${dt.getDate()} de ${MONTH[dt.getMonth()]}`; }
function fmtShort(s){ const dt=mkDate(s); return `${DAY_S[dt.getDay()]} ${dt.getDate()}/${dt.getMonth()+1}`; }
function weekStart(o){
  const t=new Date(), m=new Date(t), dw=t.getDay();
  m.setDate(t.getDate()-(dw===0?6:dw-1)+o*7); m.setHours(0,0,0,0); return m;
}
function weekDates(o){
  const m=weekStart(o);
  return Array.from({length:7},(_,i)=>{ const d=new Date(m); d.setDate(m.getDate()+i); return d.toISOString().split('T')[0]; });
}
function canBook(s){
  if(s<todayStr())return false;
  if(weekDates(0).includes(s))return true;
  const dw=new Date().getDay();
  return (dw===6||dw===0)&&weekDates(1).includes(s);
}
function isPast(s){ return s<todayStr(); }
function nextWkUnlocked(){ const d=new Date().getDay(); return d===6||d===0; }

// ── Bookings ──────────────────────────────────────────────────
function dayBk(d)       { return S.bookings[d]||{}; }
function getDk(d,id)    { return (S.bookings[d]||{})[id]||null; }
function addBk(d,id,n,e){
  if(getDk(d,id))return false;
  if(!S.bookings[d])S.bookings[d]={};
  S.bookings[d][id]={name:n,email:e,ts:Date.now()}; saveBk(); return true;
}
function delBk(d,id){
  if(!S.bookings[d])return;
  delete S.bookings[d][id];
  if(!Object.keys(S.bookings[d]).length)delete S.bookings[d];
  saveBk();
}
function myList(email){
  const t=todayStr(),r=[];
  Object.entries(S.bookings).forEach(([d,desks])=>{
    if(d<t)return;
    Object.entries(desks).forEach(([id,bk])=>{ if(bk.email===email)r.push({d,id,...bk}); });
  });
  return r.sort((a,b)=>a.d.localeCompare(b.d));
}
function status(id){
  const bk=getDk(S.selDate,id);
  if(!bk)return 'free';
  if(S.email&&bk.email===S.email)return 'mine';
  return 'taken';
}
function initials(n){
  if(!n)return '?';
  const p=n.trim().split(/\s+/);
  return p.length===1?p[0][0].toUpperCase():(p[0][0]+p[p.length-1][0]).toUpperCase();
}

// ── SVG desk icons — architectural top-down view ──────────────

// Dual monitor horizontal (standard desks)
function dualH(col){
  return `<div class="desk-icon"><svg viewBox="0 0 60 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- desk surface -->
    <rect x="1" y="4" width="58" height="20" rx="3" fill="${col}" fill-opacity=".07" stroke="${col}" stroke-opacity=".5" stroke-width="1.4"/>
    <!-- monitor left -->
    <rect x="5" y="7" width="22" height="13" rx="2" fill="${col}" fill-opacity=".18" stroke="${col}" stroke-opacity=".7" stroke-width="1.2"/>
    <!-- monitor right -->
    <rect x="33" y="7" width="22" height="13" rx="2" fill="${col}" fill-opacity=".18" stroke="${col}" stroke-opacity=".7" stroke-width="1.2"/>
    <!-- chair (arc below) -->
    <path d="M18 26 Q30 30 42 26" stroke="${col}" stroke-opacity=".45" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  </svg></div>`;
}

// Dual monitor vertical (WM standalone)
function dualV(col){
  return `<div class="desk-icon"><svg viewBox="0 0 30 56" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- desk surface -->
    <rect x="2" y="1" width="26" height="54" rx="3" fill="${col}" fill-opacity=".07" stroke="${col}" stroke-opacity=".5" stroke-width="1.4"/>
    <!-- monitor top -->
    <rect x="5" y="5" width="20" height="20" rx="2" fill="${col}" fill-opacity=".18" stroke="${col}" stroke-opacity=".7" stroke-width="1.2"/>
    <!-- monitor bottom -->
    <rect x="5" y="31" width="20" height="20" rx="2" fill="${col}" fill-opacity=".18" stroke="${col}" stroke-opacity=".7" stroke-width="1.2"/>
    <!-- chair (right side arc) -->
    <path d="M28 18 Q32 28 28 38" stroke="${col}" stroke-opacity=".45" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  </svg></div>`;
}

// Single monitor (NE / admin)
function singleH(col){
  return `<div class="desk-icon"><svg viewBox="0 0 36 22" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="2" width="34" height="16" rx="2.5" fill="${col}" fill-opacity=".07" stroke="${col}" stroke-opacity=".4" stroke-width="1.3"/>
    <rect x="5" y="5" width="26" height="10" rx="1.5" fill="${col}" fill-opacity=".16" stroke="${col}" stroke-opacity=".6" stroke-width="1.1"/>
    <path d="M12 20 Q18 23 24 20" stroke="${col}" stroke-opacity=".4" stroke-width="1.4" fill="none" stroke-linecap="round"/>
  </svg></div>`;
}

const ADM_SVG = `<svg viewBox="0 0 28 18" fill="none" style="width:13px;height:auto">
  <rect x="1" y="1" width="26" height="12" rx="2" stroke="currentColor" stroke-opacity=".4" stroke-width="1.2"/>
  <rect x="4" y="3" width="20" height="8" rx="1" fill="currentColor" fill-opacity=".12" stroke="currentColor" stroke-opacity=".35" stroke-width="1"/>
  <path d="M9 16 Q14 18 19 16" stroke="currentColor" stroke-opacity=".3" stroke-width="1.3" fill="none" stroke-linecap="round"/>
</svg>`;

// ── Color per state ───────────────────────────────────────────
const COL = {
  free:   '#111C2E',
  taken:  '#E8722A',
  mine:   '#2A7A42',
  sel:    '#2C5FD4',
  locked: '#111C2E',
  ne:     '#111C2E',
};

// ── Build desk ────────────────────────────────────────────────
function mkDesk(id, iconFn, nonBookable){
  const bk      = getDk(S.selDate, id);
  const st      = status(id);
  const isSel   = S.selDesks.includes(id);
  const locked  = !canBook(S.selDate);
  const past    = isPast(S.selDate);

  const el = document.createElement('div');
  let cls = 'desk';
  if (nonBookable)     cls += ' desk-ne';
  else if (isSel)      cls += ' selected';
  else if (st==='mine')cls += ' mine';
  else if (st==='taken')cls += ' occupied';
  if (!nonBookable && (locked||past)) cls += ' locked-date';
  el.className = cls;
  el.dataset.id = id;

  // Pick color for icon
  const col = nonBookable ? COL.ne
    : isSel ? COL.sel
    : st==='mine' ? COL.mine
    : st==='taken'? COL.taken
    : (locked||past)? COL.locked
    : COL.free;

  const shortId = id.split('-').slice(1).join('');
  const tipTxt  = nonBookable ? 'No disponible'
    : bk         ? `${bk.name}${st==='mine'?' (tú)':''}`
    : isSel      ? 'Seleccionado'
    : locked     ? 'No disponible aún'
    : past       ? 'Fecha pasada'
    : 'Disponible';

  el.innerHTML = `${iconFn(col)}
    <span class="desk-id">${shortId}</span>
    <div class="desk-tip">${tipTxt}</div>`;

  // Badge
  if (bk && !nonBookable && !isSel){
    const b = document.createElement('div');
    b.className = 'desk-badge';
    b.textContent = initials(bk.name);
    el.appendChild(b);
  }

  if (!nonBookable && !locked && !past){
    if (st==='taken'||st==='mine') el.addEventListener('click',()=>onOccupied(id,bk));
    else el.addEventListener('click',()=>onDesk(id));
  }
  return el;
}

// ── Render floor ──────────────────────────────────────────────
function renderFloor(){
  const fp = document.getElementById('floorPlan');
  if (!fp) return;
  fp.innerHTML = '';

  /* Left */
  const left = document.createElement('div');
  left.className = 'floor-left';

  // Rooms
  const rooms = document.createElement('div');
  rooms.className = 'rooms-row';
  rooms.innerHTML = `
    <div class="room-box">
      <div class="room-box-icon">💻</div>
      <div class="room-box-lbl">IT Room</div>
    </div>
    <div class="room-box">
      <div class="room-box-icon">🪑</div>
      <div class="room-box-lbl">Conference Room</div>
    </div>`;
  left.appendChild(rooms);

  // Sections
  SECTIONS.forEach(sec=>{
    const row = document.createElement('div');
    row.className = 'sec-row';

    const tag = document.createElement('div');
    tag.className = 'row-tag';
    tag.textContent = sec.label;
    row.appendChild(tag);

    const content = document.createElement('div');
    content.className = 'sec-content';

    if(sec.standalone){
      const std = document.createElement('div');
      std.className = 'desk-standalone';
      std.appendChild(mkDesk(`${sec.id}-S`, dualV));
      content.appendChild(std);
    }

    const block = document.createElement('div');
    block.className = 'sec-block';
    const rA = document.createElement('div'); rA.className='desk-row';
    for(let c=1;c<=sec.cols;c++) rA.appendChild(mkDesk(`${sec.id}-A${c}`, dualH));
    const sep = document.createElement('div'); sep.className='row-divider';
    const rB = document.createElement('div'); rB.className='desk-row';
    for(let c=1;c<=sec.cols;c++) rB.appendChild(mkDesk(`${sec.id}-B${c}`, dualH));
    block.appendChild(rA); block.appendChild(sep); block.appendChild(rB);
    content.appendChild(block);
    row.appendChild(content);
    left.appendChild(row);
  });

  // NE
  const neRow = document.createElement('div');
  neRow.className = 'ne-row';
  const neTag = document.createElement('div');
  neTag.className = 'row-tag'; neTag.textContent = 'NE';
  const neDsk = mkDesk('NE-1', singleH, true);
  neRow.appendChild(neTag); neRow.appendChild(neDsk);
  left.appendChild(neRow);
  fp.appendChild(left);

  /* Right — admin */
  const right = document.createElement('div');
  right.className = 'floor-right';
  right.innerHTML = '<div class="adm-header">Área Administrativa</div>';
  ADMIN_SECS.forEach(sec=>{
    const s = document.createElement('div'); s.className='adm-sec';
    const l = document.createElement('div'); l.className='adm-sec-lbl'; l.textContent=sec.label;
    s.appendChild(l);
    for(let r=0;r<sec.rows;r++){
      const row = document.createElement('div'); row.className='adm-row';
      for(let c=0;c<2;c++){
        const d=document.createElement('div'); d.className='adm-desk'; d.innerHTML=ADM_SVG; row.appendChild(d);
      }
      s.appendChild(row);
    }
    right.appendChild(s);
  });
  fp.appendChild(right);
}

function onDesk(id){
  const i=S.selDesks.indexOf(id);
  if(i>=0) S.selDesks.splice(i,1); else S.selDesks.push(id);
  renderFloor(); renderSelList();
}
function onOccupied(id,bk){
  if(!bk)return;
  const me=S.email||document.getElementById('userEmail')?.value.trim();
  if(bk.email===me) openModal(S.selDate,id,bk.name);
  else toast(`Ocupado por: ${bk.name}`,'info');
}

// ── Modal ─────────────────────────────────────────────────────
function openModal(date,id,name){
  S.pendingCancel={date,id};
  const m=document.getElementById('cancelModal');
  const b=document.getElementById('modalBody');
  if(!m||!b)return;
  b.innerHTML=`¿Cancelar la reserva del escritorio <strong>${id}</strong> para el <strong>${fmtDate(date)}</strong>?`;
  m.classList.remove('hidden');
}
function closeModal(){ S.pendingCancel=null; document.getElementById('cancelModal')?.classList.add('hidden'); }
function doCancel(){
  if(!S.pendingCancel)return;
  const{date,id}=S.pendingCancel;
  delBk(date,id); closeModal();
  toast('Reserva cancelada','info');
  renderFloor(); renderWeekBar(); renderSelList(); renderMyBk(); updateOcc();
}

// ── Occupancy ─────────────────────────────────────────────────
function updateOcc(){
  const n=Object.keys(dayBk(S.selDate)).length;
  const pct=Math.round(n/TOTAL_DESKS*100);
  const fill=document.getElementById('occFill');
  const num=document.getElementById('occNum');
  const dt=document.getElementById('occDate');
  if(fill){ fill.style.width=pct+'%'; fill.className='occ-fill'+(pct>=80?' high':pct>=50?' mid':' low'); }
  if(num) num.textContent=`${n} de ${TOTAL_DESKS} escritorios ocupados`;
  if(dt)  dt.textContent=fmtDate(S.selDate);
}

// ── Week strip ────────────────────────────────────────────────
function renderWeekBar(){
  const chips=document.getElementById('dayChips');
  const rng=document.getElementById('wkRange');
  const prev=document.getElementById('prevWk');
  const next=document.getElementById('nextWk');
  if(!chips)return;

  const dates=weekDates(S.wkOffset), today=todayStr();
  const s=mkDate(dates[0]), e=mkDate(dates[6]);
  if(rng) rng.textContent=`${s.getDate()} ${MONTH[s.getMonth()].substr(0,3)} — ${e.getDate()} ${MONTH[e.getMonth()].substr(0,3)} ${e.getFullYear()}`;

  chips.innerHTML='';
  dates.forEach(d=>{
    const dt=mkDate(d);
    const locked=!canBook(d)&&!isPast(d);
    const past=isPast(d);
    const hasBk=Object.keys(dayBk(d)).length>0;
    const chip=document.createElement('div');
    let cls='day-chip';
    if(d===S.selDate) cls+=' active';
    else if(d===today) cls+=' today';
    if(locked) cls+=' locked';
    if(past&&d!==S.selDate) cls+=' past';
    if(hasBk) cls+=' has-bk';
    chip.className=cls;
    chip.innerHTML=`<span class="dn">${DAY_S[dt.getDay()]}</span><span class="dd">${dt.getDate()}</span><span class="day-pip"></span>`;
    if(!locked) chip.addEventListener('click',()=>{
      S.selDate=d; S.selDesks=[];
      renderWeekBar(); renderFloor(); renderSelList(); updateOcc();
    });
    chips.appendChild(chip);
  });
  if(prev) prev.disabled=S.wkOffset<=0;
  if(next) next.disabled=S.wkOffset>=1||!nextWkUnlocked();
}

// ── Side panel ────────────────────────────────────────────────
function renderSelList(){
  const list=document.getElementById('selList');
  const btn=document.getElementById('confirmBtn');
  if(!list)return;
  list.innerHTML='';
  if(!S.selDesks.length){ list.innerHTML='<div class="sel-empty">Haz clic en un escritorio<br>para seleccionarlo</div>'; }
  else {
    S.selDesks.forEach(id=>{
      const el=document.createElement('div'); el.className='sel-item';
      el.innerHTML=`<span class="sel-item-id">${id}</span>
        <button class="btn-rm" onclick="rmDesk('${id}')" title="Quitar">✕</button>`;
      list.appendChild(el);
    });
  }
  if(btn) btn.disabled=!S.selDesks.length;
}
function rmDesk(id){ S.selDesks=S.selDesks.filter(x=>x!==id); renderFloor(); renderSelList(); }

function doBook(){
  const nEl=document.getElementById('userName');
  const eEl=document.getElementById('userEmail');
  const name=nEl?.value.trim()||'';
  const email=eEl?.value.trim()||'';
  if(!name){ toast('Ingresa tu nombre completo','err'); nEl?.focus(); return; }
  if(!email||!email.includes('@')){ toast('Ingresa un correo válido','err'); eEl?.focus(); return; }
  if(!S.selDesks.length)return;
  let ok=0, dup=0;
  S.selDesks.forEach(id=>{ addBk(S.selDate,id,name,email)?ok++:dup++; });
  S.name=name; S.email=email; saveSes(); S.selDesks=[];
  if(ok)  toast(`✓ ${ok} escritorio${ok>1?'s':''} reservado${ok>1?'s':''}`, 'ok');
  if(dup) toast(`${dup} escritorio(s) ya ocupados`, 'err');
  renderFloor(); renderWeekBar(); renderSelList(); renderMyBk(); updateOcc();
}

function renderMyBk(){
  const c=document.getElementById('myBkList'); if(!c)return;
  const email=S.email||document.getElementById('userEmail')?.value.trim();
  if(!email){ c.innerHTML='<div class="bk-empty">Ingresa tu correo para ver tus reservas</div>'; return; }
  const bks=myList(email);
  if(!bks.length){ c.innerHTML='<div class="bk-empty">Sin reservas activas</div>'; return; }
  c.innerHTML='';
  bks.forEach(bk=>{
    const item=document.createElement('div'); item.className='bk-item';
    item.innerHTML=`
      <div class="bk-color"></div>
      <div class="bk-info">
        <div class="bk-desk">${bk.id}</div>
        <div class="bk-date">${fmtDate(bk.d)}</div>
      </div>
      <button class="btn-cancel-bk" onclick="triggerCancel('${bk.d}','${bk.id}')">Cancelar</button>`;
    c.appendChild(item);
  });
}
function triggerCancel(d,id){
  const bk=getDk(d,id); openModal(d,id,bk?.name||'');
}

// ── Toast ─────────────────────────────────────────────────────
function toast(msg,type='info'){
  const z=document.getElementById('toastZone'); if(!z)return;
  const t=document.createElement('div'); t.className=`toast ${type}`; t.textContent=msg;
  z.appendChild(t);
  setTimeout(()=>{ t.style.transition='all .25s'; t.style.opacity='0'; t.style.transform='translateX(60px)'; setTimeout(()=>t.remove(),280); },3000);
}

// ── Init employee ─────────────────────────────────────────────
function initEmployee(){
  loadBk(); loadSes();
  renderWeekBar(); renderFloor(); renderSelList(); updateOcc(); renderMyBk();
  document.getElementById('prevWk')?.addEventListener('click',()=>{ if(S.wkOffset>0){S.wkOffset--;renderWeekBar();} });
  document.getElementById('nextWk')?.addEventListener('click',()=>{ if(S.wkOffset<1&&nextWkUnlocked()){S.wkOffset++;renderWeekBar();} });
  document.getElementById('confirmBtn')?.addEventListener('click',doBook);
  document.getElementById('cancelNo')?.addEventListener('click',closeModal);
  document.getElementById('cancelYes')?.addEventListener('click',doCancel);
  document.getElementById('cancelModal')?.addEventListener('click',e=>{ if(e.target===e.currentTarget)closeModal(); });
  document.getElementById('userEmail')?.addEventListener('blur',()=>{
    const v=document.getElementById('userEmail')?.value.trim(); if(v){S.email=v;renderMyBk();}
  });
}

// ══════════════════════════════════════════════════════════════
//   ADMIN
// ══════════════════════════════════════════════════════════════
function checkPin(){
  const pin=document.getElementById('pinInput')?.value||'';
  if(pin===ADMIN_PIN){
    document.getElementById('pinScreen').style.display='none';
    document.getElementById('adminDash').style.display='block';
    initAdmin();
  }else{
    const e=document.getElementById('pinErr');
    if(e){e.textContent='PIN incorrecto.';e.style.display='block';}
    const i=document.getElementById('pinInput'); if(i){i.value='';i.focus();}
  }
}
function initAdmin(){
  loadBk(); renderAdmStats(); renderAdmTable();
  document.getElementById('fsearch')?.addEventListener('input',admFilter);
  document.getElementById('fdate')?.addEventListener('change',admFilter);
  document.getElementById('btnClear')?.addEventListener('click',()=>{
    const s=document.getElementById('fsearch'),d=document.getElementById('fdate');
    if(s)s.value=''; if(d)d.value=''; renderAdmTable();
  });
}
function admFilter(){ renderAdmTable(document.getElementById('fsearch')?.value||'',document.getElementById('fdate')?.value||''); }
function allRows(){
  const r=[];
  Object.entries(S.bookings).forEach(([d,dk])=>Object.entries(dk).forEach(([id,bk])=>r.push({d,id,...bk})));
  return r.sort((a,b)=>b.d.localeCompare(a.d)||a.id.localeCompare(b.id));
}
function renderAdmStats(){
  const all=allRows(), today=todayStr(), cw=weekDates(0);
  const g=id=>document.getElementById(id);
  if(g('sToday')) g('sToday').textContent=Object.keys(dayBk(today)).length;
  if(g('sWeek'))  g('sWeek').textContent=all.filter(r=>cw.includes(r.d)).length;
  if(g('sUsers')) g('sUsers').textContent=new Set(all.map(r=>r.email)).size;
  if(g('sTotal')) g('sTotal').textContent=all.length;
}
function renderAdmTable(search='',df=''){
  const tb=document.getElementById('admTbody'); if(!tb)return;
  let rows=allRows();
  if(search){const q=search.toLowerCase();rows=rows.filter(r=>r.name.toLowerCase().includes(q)||r.email.toLowerCase().includes(q)||r.id.toLowerCase().includes(q));}
  if(df) rows=rows.filter(r=>r.d===df);
  if(!rows.length){tb.innerHTML='<tr><td colspan="5" class="tbl-empty">Sin reservas para estos filtros</td></tr>';return;}
  tb.innerHTML='';
  rows.forEach(r=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td><span class="d-pill">${r.id}</span></td><td style="font-weight:700">${x(r.name)}</td><td style="color:var(--text-tertiary)">${x(r.email)}</td><td>${fmtDate(r.d)}</td><td><button class="btn-tbl-cancel" onclick="admCancel('${r.d}','${r.id}')">Cancelar</button></td>`;
    tb.appendChild(tr);
  });
}
function admCancel(d,id){
  if(!confirm(`¿Cancelar escritorio ${id} — ${fmtDate(d)}?`))return;
  delBk(d,id); toast('Reserva cancelada','info'); renderAdmStats(); admFilter();
}
function x(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

document.addEventListener('DOMContentLoaded',()=>{
  if(document.getElementById('floorPlan')) initEmployee();
  if(document.getElementById('pinScreen')){
    loadBk();
    document.getElementById('pinInput')?.focus();
    document.getElementById('pinInput')?.addEventListener('keydown',e=>{ if(e.key==='Enter')checkPin(); });
  }
});
