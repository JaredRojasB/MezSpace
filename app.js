/* ============================================================
   MezSpace — app.js
   Sistema de Reserva de Escritorios · Meztal
   ============================================================ */

const ADMIN_PIN = 'meztal2024';

// Office layout definition
const SECTIONS = [
  { id:'MT1', label:'Meztal Teams 1', cols:5, rows:3, bookable:true,  screen:false },
  { id:'MT2', label:'Meztal Teams 2', cols:5, rows:3, bookable:true,  screen:false },
  { id:'WM1', label:'Watermark 1',    cols:4, rows:3, bookable:true,  screen:true  },
  { id:'WM2', label:'Watermark 2',    cols:4, rows:3, bookable:true,  screen:true  },
  { id:'NE',  label:'NE',             cols:1, rows:1, bookable:true,  screen:false },
];

const ADMIN_SECS = [
  { id:'RMT1', label:'Meztal Teams',      cols:2, rows:2 },
  { id:'RMT2', label:'Meztal Teams',      cols:2, rows:2 },
  { id:'RHQA', label:'Meztal HQ Admin',   cols:2, rows:2 },
  { id:'RHQR', label:'Meztal HQ Recruiting', cols:2, rows:2 },
];

const DAY_S  = ['dom','lun','mar','mié','jue','vie','sáb'];
const DAY_F  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const MONTH  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ── State ────────────────────────────────────────────────────
let S = {
  selDate:  todayStr(),
  selDesks: [],
  name:     '',
  email:    '',
  bookings: {},
  wkOffset: 0,
};

// ── Storage ──────────────────────────────────────────────────
const BK_KEY  = 'mezspace_bk_v1';
const SES_KEY = 'mezspace_ses_v1';

function loadBk() {
  try { S.bookings = JSON.parse(localStorage.getItem(BK_KEY) || '{}'); }
  catch(e) { S.bookings = {}; }
}
function saveBk() {
  localStorage.setItem(BK_KEY, JSON.stringify(S.bookings));
}
function loadSes() {
  try {
    const d = JSON.parse(sessionStorage.getItem(SES_KEY) || 'null');
    if (d) {
      S.name  = d.name  || '';
      S.email = d.email || '';
      const n = document.getElementById('userName');
      const e = document.getElementById('userEmail');
      if (n) n.value = S.name;
      if (e) e.value = S.email;
    }
  } catch(e) {}
}
function saveSes() {
  sessionStorage.setItem(SES_KEY, JSON.stringify({ name: S.name, email: S.email }));
}

// ── Date Helpers ─────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().split('T')[0];
}
function mkDate(str) {
  const [y,m,d] = str.split('-').map(Number);
  return new Date(y, m-1, d);
}
function fmtDate(str) {
  const dt = mkDate(str);
  return `${DAY_F[dt.getDay()]} ${dt.getDate()} de ${MONTH[dt.getMonth()]}`;
}
function fmtShort(str) {
  const dt = mkDate(str);
  return `${DAY_S[dt.getDay()]} ${dt.getDate()}/${dt.getMonth()+1}`;
}
function weekStart(offset) {
  const t  = new Date();
  const dw = t.getDay();
  const m  = new Date(t);
  m.setDate(t.getDate() - (dw === 0 ? 6 : dw - 1) + offset * 7);
  m.setHours(0,0,0,0);
  return m;
}
function weekDates(offset) {
  const m = weekStart(offset);
  return Array.from({length:7}, (_,i) => {
    const d = new Date(m); d.setDate(m.getDate()+i);
    return d.toISOString().split('T')[0];
  });
}

// ── Booking rules ─────────────────────────────────────────────
// Current week: always bookable (non-past days)
// Next week: unlocks Saturday night (day===6 or day===0)
function canBook(dateStr) {
  const today = todayStr();
  if (dateStr < today) return false;                      // past
  const cw = weekDates(0);
  if (cw.includes(dateStr)) return true;                  // current week
  const now  = new Date();
  const dow  = now.getDay();
  const nextWeek = weekDates(1);
  if ((dow === 6 || dow === 0) && nextWeek.includes(dateStr)) return true; // Sat/Sun next week
  return false;
}
function isPast(dateStr) {
  return dateStr < todayStr();
}
function nextWeekUnlocked() {
  const dow = new Date().getDay();
  return dow === 6 || dow === 0;
}

// ── Booking CRUD ─────────────────────────────────────────────
function dayBk(date)           { return S.bookings[date] || {}; }
function getDeskBk(date, id)   { return dayBk(date)[id] || null; }
function addBk(date, id, name, email) {
  if (getDeskBk(date, id)) return false;
  if (!S.bookings[date]) S.bookings[date] = {};
  S.bookings[date][id] = { name, email, ts: Date.now() };
  saveBk();
  return true;
}
function cancelBk(date, id) {
  if (!S.bookings[date]) return;
  delete S.bookings[date][id];
  if (!Object.keys(S.bookings[date]).length) delete S.bookings[date];
  saveBk();
}
function myBkList(email) {
  const r = [];
  Object.entries(S.bookings).forEach(([date, desks]) =>
    Object.entries(desks).forEach(([id, bk]) => {
      if (bk.email === email) r.push({date, id, ...bk});
    })
  );
  return r.sort((a,b) => a.date.localeCompare(b.date));
}

// ── Desk ID helpers ───────────────────────────────────────────
function deskId(secId, row, col) {
  return `${secId}-${row+1}${String.fromCharCode(65+col)}`;
}
function deskLabel(id) {
  return id.split('-').slice(1).join('-');
}
function deskStatus(id) {
  const bk = getDeskBk(S.selDate, id);
  if (!bk) return 'available';
  if (S.email && bk.email === S.email) return 'mine';
  return 'occupied';
}

// ── Monitor SVG ───────────────────────────────────────────────
const MONITOR_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="2" y="4" width="20" height="13" rx="2" stroke="currentColor" stroke-width="1.5"/>
  <path d="M8 21h8M12 17v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>`;

const MONITOR_SM = `<svg viewBox="0 0 24 24" fill="none" style="width:13px;height:13px">
  <rect x="2" y="4" width="20" height="13" rx="2" stroke="currentColor" stroke-width="1.5"/>
  <path d="M8 21h8M12 17v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>`;

// ── Floor Plan ────────────────────────────────────────────────
function renderFloor() {
  const fp = document.getElementById('floorPlan');
  if (!fp) return;
  fp.innerHTML = '';

  // Left side
  const left = document.createElement('div');
  left.className = 'floor-left';

  // Top mock rooms
  const top = document.createElement('div');
  top.className = 'floor-top';
  top.innerHTML = `
    <div class="mock-room">
      <div class="mock-room-circle">🪑</div>
      <div class="mock-room-lbl">Conference Room</div>
    </div>
    <div class="mock-room" style="min-width:90px">
      <div style="font-size:18px;margin-bottom:6px">📦</div>
      <div class="mock-room-lbl">Storage / Calls</div>
    </div>`;
  left.appendChild(top);

  // Desk sections
  SECTIONS.forEach(sec => {
    const wrap = document.createElement('div');
    wrap.className = 'sec-wrap';

    const lbl = document.createElement('div');
    lbl.className = 'sec-label';
    lbl.textContent = sec.label;
    wrap.appendChild(lbl);

    const body = document.createElement('div');
    body.className = 'sec-body';

    if (sec.screen) {
      body.innerHTML += `<div class="sec-screen"><div class="sec-screen-box">🖥️</div></div>`;
    }

    const grid = document.createElement('div');
    grid.className = `desk-grid g${sec.cols}`;

    for (let r = 0; r < sec.rows; r++) {
      for (let c = 0; c < sec.cols; c++) {
        const id   = deskId(sec.id, r, c);
        const bk   = getDeskBk(S.selDate, id);
        const stat = deskStatus(id);
        const isSel  = S.selDesks.includes(id);
        const locked = !canBook(S.selDate);
        const past   = isPast(S.selDate);

        const desk = document.createElement('div');
        let cls = 'desk';
        if (isSel) cls += ' selected';
        else if (stat === 'mine') cls += ' mine';
        else if (stat === 'occupied') cls += ' occupied';
        if (locked || past) cls += ' locked-date';
        desk.className = cls;
        desk.dataset.id = id;

        const tip = bk  ? bk.name
                  : isSel ? 'Seleccionado'
                  : 'Disponible';

        desk.innerHTML = `${MONITOR_SVG}<span class="desk-id">${deskLabel(id)}</span>
          <div class="desk-tip">${tip}</div>`;

        if (!locked && !past && stat !== 'occupied') {
          desk.addEventListener('click', () => onDesk(id));
        } else if (stat === 'occupied' || stat === 'mine') {
          desk.addEventListener('click', () => onOccupied(id, bk));
        }

        grid.appendChild(desk);
      }
    }

    body.appendChild(grid);
    wrap.appendChild(body);
    left.appendChild(wrap);
  });

  // Right side: admin area
  const right = document.createElement('div');
  right.className = 'floor-right';
  right.innerHTML = '<div class="adm-zone-lbl">Área Administrativa</div>';

  ADMIN_SECS.forEach(sec => {
    const s = document.createElement('div');
    const l = document.createElement('div');
    l.className = 'adm-sec-lbl';
    l.textContent = sec.label;
    const g = document.createElement('div');
    g.className = `desk-grid g${sec.cols}`;
    for (let i = 0; i < sec.cols * sec.rows; i++) {
      const d = document.createElement('div');
      d.className = 'desk admin-only';
      d.innerHTML = MONITOR_SM;
      g.appendChild(d);
    }
    s.appendChild(l);
    s.appendChild(g);
    right.appendChild(s);
  });

  fp.appendChild(left);
  fp.appendChild(right);
}

function onDesk(id) {
  const idx = S.selDesks.indexOf(id);
  if (idx >= 0) S.selDesks.splice(idx, 1);
  else S.selDesks.push(id);
  renderFloor();
  renderSelList();
}

function onOccupied(id, bk) {
  if (!bk) return;
  const myEmail = S.email || document.getElementById('userEmail')?.value.trim();
  if (bk.email === myEmail) {
    if (confirm(`¿Cancelar tu reserva del escritorio ${deskLabel(id)} para el ${fmtDate(S.selDate)}?`)) {
      cancelBk(S.selDate, id);
      toast('Reserva cancelada', 'info');
      renderFloor();
      renderWeekBar();
      renderMyBk();
    }
  } else {
    toast(`Ocupado por: ${bk.name}`, 'info');
  }
}

// ── Week Bar ──────────────────────────────────────────────────
function renderWeekBar() {
  const strip  = document.getElementById('dayStrip');
  const wkLbl  = document.getElementById('wkLabel');
  const prevBtn = document.getElementById('prevWk');
  const nextBtn = document.getElementById('nextWk');
  if (!strip) return;

  const dates = weekDates(S.wkOffset);
  const today = todayStr();

  // Week label
  const s = mkDate(dates[0]), e = mkDate(dates[6]);
  if (wkLbl) wkLbl.textContent =
    `${s.getDate()} ${MONTH[s.getMonth()].substring(0,3)} — ${e.getDate()} ${MONTH[e.getMonth()].substring(0,3)} ${e.getFullYear()}`;

  strip.innerHTML = '';
  dates.forEach(d => {
    const dt     = mkDate(d);
    const locked = !canBook(d) && !isPast(d);
    const past   = isPast(d);
    const hasBk  = Object.keys(dayBk(d)).length > 0;

    const chip = document.createElement('div');
    let cls = 'day-chip';
    if (d === S.selDate) cls += ' active';
    else if (d === today) cls += ' today';
    if (locked) cls += ' locked';
    if (past && d !== S.selDate) cls += ' past';
    if (hasBk) cls += ' has-bk';
    chip.className = cls;

    chip.innerHTML = `<span class="dn">${DAY_S[dt.getDay()]}</span>
      <span class="dd">${dt.getDate()}</span>
      <span class="dot"></span>`;

    if (!locked) {
      chip.addEventListener('click', () => {
        S.selDate  = d;
        S.selDesks = [];
        renderWeekBar();
        renderFloor();
        renderSelList();
        updateDateTag();
      });
    }
    strip.appendChild(chip);
  });

  if (prevBtn) prevBtn.disabled = S.wkOffset <= 0;
  if (nextBtn) nextBtn.disabled = S.wkOffset >= 1 || !nextWeekUnlocked();
}

function updateDateTag() {
  const el = document.getElementById('dateTag');
  if (el) el.textContent = fmtDate(S.selDate);
}

// ── Side Panel ────────────────────────────────────────────────
function renderSelList() {
  const list = document.getElementById('selList');
  const btn  = document.getElementById('confirmBtn');
  if (!list) return;
  list.innerHTML = '';

  if (!S.selDesks.length) {
    list.innerHTML = '<div class="sel-empty">Haz clic en un escritorio<br>para seleccionarlo</div>';
  } else {
    S.selDesks.forEach(id => {
      const item = document.createElement('div');
      item.className = 'sel-item';
      item.innerHTML = `<span class="sel-item-id">${id}</span>
        <button class="btn-rm" onclick="removeDesk('${id}')" title="Quitar">✕</button>`;
      list.appendChild(item);
    });
  }
  if (btn) btn.disabled = !S.selDesks.length;
}

function removeDesk(id) {
  S.selDesks = S.selDesks.filter(x => x !== id);
  renderFloor();
  renderSelList();
}

function confirmBooking() {
  const nEl = document.getElementById('userName');
  const eEl = document.getElementById('userEmail');
  const name  = nEl ? nEl.value.trim() : '';
  const email = eEl ? eEl.value.trim() : '';

  if (!name)                    { toast('Ingresa tu nombre completo', 'err'); nEl?.focus(); return; }
  if (!email || !email.includes('@')) { toast('Ingresa un correo válido', 'err'); eEl?.focus(); return; }
  if (!S.selDesks.length)       return;

  let ok = 0, dup = 0;
  S.selDesks.forEach(id => {
    if (addBk(S.selDate, id, name, email)) ok++;
    else dup++;
  });

  S.name  = name;
  S.email = email;
  saveSes();
  S.selDesks = [];

  if (ok)  toast(`¡${ok} escritorio${ok>1?'s':''} reservado${ok>1?'s':''}!`, 'ok');
  if (dup) toast(`${dup} escritorio(s) ya estaban ocupados`, 'err');

  renderFloor();
  renderWeekBar();
  renderSelList();
  renderMyBk();
}

// ── My Bookings ───────────────────────────────────────────────
function renderMyBk() {
  const container = document.getElementById('myBkList');
  if (!container) return;

  const email = S.email || document.getElementById('userEmail')?.value.trim();
  if (!email) {
    container.innerHTML = '<div class="bk-empty">Ingresa tu correo para ver tus reservas</div>';
    return;
  }

  const bks = myBkList(email).filter(b => b.date >= todayStr());
  if (!bks.length) {
    container.innerHTML = '<div class="bk-empty">Sin reservas activas esta semana</div>';
    return;
  }
  container.innerHTML = '';
  bks.forEach(bk => {
    const item = document.createElement('div');
    item.className = 'my-bk-item';
    item.innerHTML = `<span class="bk-desk">${bk.id}</span>
      <span class="bk-date">${fmtShort(bk.date)}</span>
      <button class="btn-bk-cancel" onclick="cancelMyBk('${bk.date}','${bk.id}')" title="Cancelar">✕</button>`;
    container.appendChild(item);
  });
}

function cancelMyBk(date, id) {
  const email = S.email || document.getElementById('userEmail')?.value.trim();
  const bk = getDeskBk(date, id);
  if (!bk || bk.email !== email) return;
  if (confirm(`¿Cancelar reserva de ${deskLabel(id)} — ${fmtDate(date)}?`)) {
    cancelBk(date, id);
    toast('Reserva cancelada', 'info');
    renderFloor();
    renderWeekBar();
    renderMyBk();
  }
}

// ── Toast ─────────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const z = document.getElementById('toastZone');
  if (!z) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  z.appendChild(t);
  setTimeout(() => {
    t.style.transition = 'all .25s ease';
    t.style.opacity    = '0';
    t.style.transform  = 'translateX(60px)';
    setTimeout(() => t.remove(), 260);
  }, 3000);
}

// ── Employee Init ─────────────────────────────────────────────
function initEmployee() {
  loadBk();
  loadSes();
  renderWeekBar();
  renderFloor();
  renderSelList();
  updateDateTag();
  renderMyBk();

  document.getElementById('prevWk')?.addEventListener('click', () => {
    if (S.wkOffset > 0) { S.wkOffset--; renderWeekBar(); }
  });
  document.getElementById('nextWk')?.addEventListener('click', () => {
    if (S.wkOffset < 1 && nextWeekUnlocked()) { S.wkOffset++; renderWeekBar(); }
  });
  document.getElementById('confirmBtn')?.addEventListener('click', confirmBooking);
  document.getElementById('userEmail')?.addEventListener('change', renderMyBk);
  document.getElementById('userEmail')?.addEventListener('blur', () => {
    const v = document.getElementById('userEmail').value.trim();
    if (v) { S.email = v; renderMyBk(); }
  });
}

// ══════════════════════════════════════════════
//   ADMIN
// ══════════════════════════════════════════════
function checkPin() {
  const pin = document.getElementById('pinInput')?.value || '';
  if (pin === ADMIN_PIN) {
    document.getElementById('pinOverlay').style.display   = 'none';
    document.getElementById('adminContent').style.display = 'block';
    initAdmin();
  } else {
    const err = document.getElementById('pinErr');
    if (err) { err.textContent = 'PIN incorrecto. Inténtalo de nuevo.'; err.style.display = 'block'; }
    const inp = document.getElementById('pinInput');
    if (inp) { inp.value = ''; inp.focus(); }
  }
}

function initAdmin() {
  loadBk();
  renderAdminStats();
  renderAdminTable();

  document.getElementById('filterSearch')?.addEventListener('input', applyAdminFilters);
  document.getElementById('filterDate')?.addEventListener('change', applyAdminFilters);
  document.getElementById('btnClear')?.addEventListener('click', () => {
    const s = document.getElementById('filterSearch');
    const d = document.getElementById('filterDate');
    if (s) s.value = '';
    if (d) d.value = '';
    renderAdminTable();
  });
}

function applyAdminFilters() {
  const s = document.getElementById('filterSearch')?.value || '';
  const d = document.getElementById('filterDate')?.value || '';
  renderAdminTable(s, d);
}

function renderAdminStats() {
  const all = getAllBkRows();
  const today = todayStr();
  const todayCount = Object.keys(dayBk(today)).length;
  const cw = weekDates(0);
  const weekCount = all.filter(r => cw.includes(r.date)).length;
  const uniqueUsers = new Set(all.map(r => r.email)).size;

  const el = id => document.getElementById(id);
  if (el('sToday'))  el('sToday').textContent  = todayCount;
  if (el('sWeek'))   el('sWeek').textContent   = weekCount;
  if (el('sUsers'))  el('sUsers').textContent  = uniqueUsers;
  if (el('sTotal'))  el('sTotal').textContent  = all.length;
}

function getAllBkRows() {
  const rows = [];
  Object.entries(S.bookings).forEach(([date, desks]) =>
    Object.entries(desks).forEach(([id, bk]) =>
      rows.push({ date, id, ...bk })
    )
  );
  return rows.sort((a,b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

function renderAdminTable(search = '', dateFilter = '') {
  const tbody = document.getElementById('adminTbody');
  if (!tbody) return;

  let rows = getAllBkRows();

  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q)
    );
  }
  if (dateFilter) rows = rows.filter(r => r.date === dateFilter);

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="tbl-empty">No hay reservas que coincidan con los filtros</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="desk-pill">${r.id}</span></td>
      <td style="font-weight:700">${escHtml(r.name)}</td>
      <td style="color:var(--gray-400)">${escHtml(r.email)}</td>
      <td>${fmtDate(r.date)}</td>
      <td>
        <button class="btn-row-cancel"
          onclick="adminCancel('${r.date}','${r.id}')">Cancelar</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

function adminCancel(date, id) {
  if (!confirm(`¿Cancelar la reserva del escritorio ${id} para el ${fmtDate(date)}?`)) return;
  cancelBk(date, id);
  toast('Reserva cancelada por administrador', 'info');
  renderAdminStats();
  applyAdminFilters();
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Auto-init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('floorPlan'))  initEmployee();
  if (document.getElementById('pinOverlay')) {
    loadBk();
    document.getElementById('pinInput')?.focus();
    document.getElementById('pinInput')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') checkPin();
    });
  }
});
