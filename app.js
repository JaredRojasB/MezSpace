/* MezSpace v8 — app.js  (Hourly booking · Conference Room timeline · Authorized emails & company logos [demo]) */

const ADMIN_PIN = 'meztal2024';

// ── Time config (GDL: 7am–6pm) ──────────────────────────────
const T_START = 7;     // 7:00 AM
const T_END   = 18;    // 6:00 PM
const T_SPAN  = T_END - T_START; // 11 hours

function mkTimeOpts(){
  const o=[];
  for(let h=T_START;h<=T_END;h++){
    o.push(`${String(h).padStart(2,'0')}:00`);
    if(h<T_END) o.push(`${String(h).padStart(2,'0')}:30`);
  }
  return o;
}
function fmtT(t){
  if(!t)return'—';
  const[h,m]=t.split(':').map(Number);
  const ap=h>=12?'PM':'AM', hd=h>12?h-12:h===0?12:h;
  return `${hd}:${String(m).padStart(2,'0')} ${ap}`;
}
function tF(t){ if(!t)return 0; const[h,m]=t.split(':').map(Number); return h+m/60; }
function fToT(f){ const h=Math.floor(f),m=Math.round((f-h)*60); return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; }
function fmtDur(s,e){ const d=tF(e)-tF(s); if(d<=0)return'—'; const h=Math.floor(d),m=Math.round((d%1)*60); return m?`${h}h ${m}m`:`${h}h`; }
function tOverlap(s1,e1,s2,e2){ return tF(s1)<tF(e2)&&tF(e1)>tF(s2); }

// ── Companies ──────────────────────────────────────────────
const COMPANIES={
  'Accushield':'#A75075',
  'Anthem':'#31EB0B',
  'Asbury Communities':'#58C6FF',
  'Atlas':'#515309',
  'Avanti':'#FDAA39',
  'Bickford SL':'#08528F',
  'CCL':'#ECBAFE',
  'Choice Digital':'#9E4306',
  'Compass Group':'#079D87',
  'Full Life Care':'#FE8980',
  'GKV':'#7B7EFA',
  'HumanGood':'#7D951E',
  'KARE':'#EF1CF6',
  'Lenity Management':'#5A17DD',
  'Lifespace':'#A27400',
  'LTC Properties Inc':'#0C6C42',
  'Markentum':'#4DE0DE',
  'Milestone':'#E4CD19',
  'NIC':'#0084BF',
  'Oxford Road':'#F80A0C',
  'Rendever':'#86CB92',
  'Sodalis Senior Living':'#A00E31',
  'Sona Senior Living':'#D581AF',
  'Sunrise':'#98007E',
  'Transforming Age':'#F84975',
  'Trustwell Living':'#D27310',
  'Watermark':'#4E7823',
  'Wyld':'#5869AD',
  'GKV US':'#00E7B3',
};
const COMPANY_NAMES=Object.keys(COMPANIES).sort();

// ── Authorized directory (DEMO: stored only in this browser) ──
// Final version: this list lives in the cloud database and is managed from the admin panel.
const DIR_KEY='mzsp_dir';
const DEMO_EMAILS={'ana.lopez@atlas-demo.com':'Atlas','luis.garcia@kare-demo.com':'KARE','maria.perez@watermark-demo.com':'Watermark'};
let DIR={logos:{},extra:{},removed:[],emails:{}};
function loadDir(){
  let d=null;try{d=JSON.parse(localStorage.getItem(DIR_KEY)||'null');}catch(e){}
  if(!d)d={logos:{},extra:{},removed:[],emails:{...DEMO_EMAILS}};
  DIR={logos:d.logos||{},extra:d.extra||{},removed:d.removed||[],emails:d.emails||{}};
  Object.entries(DIR.extra).forEach(([n,c])=>{COMPANIES[n]=c;});
  DIR.removed.forEach(n=>{delete COMPANIES[n];});
  COMPANY_NAMES.length=0;COMPANY_NAMES.push(...Object.keys(COMPANIES).sort((a,b)=>a.localeCompare(b)));
}
function saveDir(){
  try{localStorage.setItem(DIR_KEY,JSON.stringify(DIR));return true;}
  catch(e){toast('Browser storage is full. Use a smaller logo image.','err');return false;}
}
function normEmail(e){return (e||'').trim().toLowerCase();}
function coLogo(n){return DIR.logos[n]||null;}
function emailCompany(e){const c=DIR.emails[normEmail(e)];return c&&COMPANIES[c]?c:null;}
function logoImg(n,size,border){const l=coLogo(n);return l?`<img src="${l}" alt="${x(n)}" style="width:${size}px;height:${size}px;border-radius:50%;background:#fff;object-fit:contain;border:1.5px solid ${border||coColor(n)};flex-shrink:0">`:'';}

// ── Floor ──────────────────────────────────────────────────
const LEFT_SECS=[
  {id:'F1',label:'Row 1',cols:4,standalone:false},
  {id:'F2',label:'Row 2',cols:4,standalone:false},
  {id:'F3',label:'Row 3',cols:3,standalone:true},
  {id:'F4',label:'Row 4',cols:3,standalone:true},
];
const RIGHT_SECS=[
  {id:'F5',label:'Row 5',cols:1,standalone:true},
  {id:'F6',label:'Row 6',cols:1,standalone:true},
];
const ADM_SECS=[
  {label:'HQ Admin',desks:3},
  {label:'HQ Recruiting',desks:3},
];
const TOTAL_DESKS=36;

// ── Locale ─────────────────────────────────────────────────
const DAY_S=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAY_F=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTH=['January','February','March','April','May','June','July','August','September','October','November','December'];

// ── State ──────────────────────────────────────────────────
let S={
  selDate:todayStr(), selDesks:[],
  name:'',email:'',company:'',
  startTime:'07:00',endTime:'18:00',allDay:true,
  bookings:{},wkOffset:0,
  calYear:new Date().getFullYear(),calMonth:new Date().getMonth(),
  pendingCancel:null,
};

// ── Storage ────────────────────────────────────────────────
function loadBk(){
  try{S.bookings=JSON.parse(localStorage.getItem('mzsp_bk')||'{}');}catch(e){S.bookings={};}
  // Alinear reservas guardadas con la paleta vigente de empresas
  Object.values(S.bookings).forEach(dk=>Object.entries(dk).forEach(([id,v])=>{
    (id==='CONF'?v:[v]).forEach(bk=>{if(bk&&COMPANIES[bk.company])bk.color=COMPANIES[bk.company];});
  }));
}
function saveBk(){localStorage.setItem('mzsp_bk',JSON.stringify(S.bookings));}
function loadSes(){
  try{
    const d=JSON.parse(sessionStorage.getItem('mzsp_ses')||'null');
    if(!d)return;
    S.name=d.name||'';S.email=d.email||'';S.company=d.company||'';
    S.allDay=d.allDay!==undefined?d.allDay:true;
    S.startTime=d.startTime||'07:00';S.endTime=d.endTime||'18:00';
    const n=document.getElementById('userName'),e=document.getElementById('userEmail'),c=document.getElementById('userCompany');
    if(n)n.value=S.name;if(e)e.value=S.email;if(c){c.value=S.company;updateSwatchColor();}
    setTimeMode(S.allDay);
  }catch(e){}
}
function saveSes(){sessionStorage.setItem('mzsp_ses',JSON.stringify({name:S.name,email:S.email,company:S.company,allDay:S.allDay,startTime:S.startTime,endTime:S.endTime}));}

// ── Dates ──────────────────────────────────────────────────
function todayStr(){return new Date().toISOString().split('T')[0];}
function mkDate(s){const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d);}
function fmtDate(s){const dt=mkDate(s);return `${DAY_F[dt.getDay()]}, ${MONTH[dt.getMonth()]} ${dt.getDate()} ${dt.getFullYear()}`;}
function fmtShort(s){const dt=mkDate(s);return `${DAY_S[dt.getDay()]} ${MONTH[dt.getMonth()].slice(0,3)} ${dt.getDate()}`;}
function fmtMed(s){const dt=mkDate(s);return `${MONTH[dt.getMonth()].slice(0,3)} ${dt.getDate()}, ${dt.getFullYear()}`;}
function weekStart(o){const t=new Date(),m=new Date(t),dw=t.getDay();m.setDate(t.getDate()-(dw===0?6:dw-1)+o*7);m.setHours(0,0,0,0);return m;}
function weekDates(o){const m=weekStart(o);return Array.from({length:7},(_,i)=>{const d=new Date(m);d.setDate(m.getDate()+i);return d.toISOString().split('T')[0];});}
function canBook(s){if(s<todayStr())return false;if(weekDates(0).includes(s))return true;const dw=new Date().getDay();return(dw===6||dw===0)&&weekDates(1).includes(s);}
function isPast(s){return s<todayStr();}
function nextWkUnlocked(){const d=new Date().getDay();return d===6||d===0;}

// ── Booking CRUD ───────────────────────────────────────────
function getSlot(d,id){return(S.bookings[d]||{})[id]||null;}
function addBk(d,id,n,e,co,color,st,et,allDay){
  if(getSlot(d,id))return false;
  if(!S.bookings[d])S.bookings[d]={};
  S.bookings[d][id]={name:n,email:e,company:co,color,startTime:st,endTime:et,allDay,ts:Date.now()};
  saveBk();return true;
}
function delBk(d,id){if(!S.bookings[d])return;delete S.bookings[d][id];if(!Object.keys(S.bookings[d]).length)delete S.bookings[d];saveBk();}
function delUserDay(d,email){Object.keys(S.bookings[d]||{}).forEach(id=>{if(id!=='CONF'&&getSlot(d,id)?.email===email)delBk(d,id);});}
function myList(email){
  const t=todayStr(),r=[];
  Object.entries(S.bookings).forEach(([d,dk])=>{
    if(d<t)return;
    Object.entries(dk).forEach(([id,bk])=>{if(id!=='CONF'&&bk.email===email)r.push({d,id,...bk});});
  });
  return r.sort((a,b)=>a.d.localeCompare(b.d));
}
function getConf(d){return(S.bookings[d]?.CONF)||[];}
function addConf(d,name,email,co,color,st,et){
  const existing=getConf(d);
  for(const bk of existing){if(tOverlap(st,et,bk.startTime,bk.endTime))return false;}
  if(!S.bookings[d])S.bookings[d]={};
  if(!S.bookings[d].CONF)S.bookings[d].CONF=[];
  S.bookings[d].CONF.push({name,email,company:co,color,startTime:st,endTime:et,ts:Date.now()});
  saveBk();return true;
}
function delConf(d,ts){if(!S.bookings[d]?.CONF)return;S.bookings[d].CONF=S.bookings[d].CONF.filter(b=>b.ts!==ts);saveBk();}

function dayBk(d){return S.bookings[d]||{};}
function deskStatus(id){const bk=getSlot(S.selDate,id);if(!bk)return'free';if(S.email&&bk.email===S.email)return'mine';return'taken';}
function initials(n){if(!n)return'?';const p=n.trim().split(/\s+/);return p.length===1?p[0][0].toUpperCase():(p[0][0]+p[p.length-1][0]).toUpperCase();}
function hexToRgba(hex,a=0.18){const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return `rgba(${r},${g},${b},${a})`;}
function coColor(name){return COMPANIES[name]||'#378ADD';}
function txtOn(hex){const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return (0.299*r+0.587*g+0.114*b)>150?'#111C2E':'#fff';}

// ── Swatch ─────────────────────────────────────────────────
function updateSwatchColor(){
  const sel=document.getElementById('userCompany'),sw=document.getElementById('companySwatch');
  if(!sel||!sw)return;
  const co=sel.value;
  if(co&&COMPANIES[co]){sw.style.background=COMPANIES[co];sw.style.display='inline-block';}else sw.style.display='none';
  S.company=co;renderFloor();renderSelList();
}

// ── Time mode ──────────────────────────────────────────────
function setTimeMode(allDay){
  S.allDay=allDay;
  const btnAD=document.getElementById('btnAllDay'),btnC=document.getElementById('btnCustom'),tc=document.getElementById('timeCustom');
  if(btnAD)btnAD.classList.toggle('active',allDay);
  if(btnC)btnC.classList.toggle('active',!allDay);
  if(tc)tc.style.display=allDay?'none':'flex';
  if(allDay){S.startTime='07:00';S.endTime='18:00';}
  renderSelList();
}
function onStartChange(){
  S.startTime=document.getElementById('startTime')?.value||'07:00';
  const et=document.getElementById('endTime');
  if(et&&tF(S.endTime)<=tF(S.startTime)){
    const newEnd=Math.min(T_END,tF(S.startTime)+1);
    S.endTime=fToT(newEnd);et.value=S.endTime;
  }
  renderSelList();
}
function onEndChange(){
  S.endTime=document.getElementById('endTime')?.value||'18:00';
  renderSelList();
}

// ── SVG icons ──────────────────────────────────────────────
// Monitor icons (SVG, non-scaling strokes: crisp at any size, all modern browsers)
function monSVG(x,y,c,w=24){const h=w*0.62,sx=x,sy=y;return `
  <rect x="${sx+1}" y="${sy+1}" width="${w-2}" height="${h}" rx="2.2" fill="${c}" fill-opacity=".10" stroke="${c}" stroke-width="1.4" vector-effect="non-scaling-stroke"/>
  <rect x="${sx+3}" y="${sy+3}" width="${w-6}" height="${h-4}" rx="1" fill="${c}" fill-opacity=".14"/>
  <path d="M${sx+w/2-1.6} ${sy+h+1} L${sx+w/2-2.2} ${sy+h+4.2} H${sx+w/2+2.2} L${sx+w/2+1.6} ${sy+h+1}" fill="${c}" fill-opacity=".35" stroke="${c}" stroke-width="1.1" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
  <path d="M${sx+w/2-5.5} ${sy+h+4.6} H${sx+w/2+5.5}" stroke="${c}" stroke-width="1.6" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;}
function dualH(c='currentColor'){return `<div class="desk-icon"><svg viewBox="0 0 54 22" fill="none" preserveAspectRatio="xMidYMid meet">${monSVG(1,0.5,c)}${monSVG(29,0.5,c)}</svg></div>`;}
function dualV(c='currentColor'){return `<div class="desk-icon"><svg viewBox="0 0 26 46" fill="none" preserveAspectRatio="xMidYMid meet">${monSVG(1,0.5,c)}${monSVG(1,23.5,c)}</svg></div>`;}
function singleH(c='currentColor'){return `<div class="desk-icon"><svg viewBox="0 0 26 22" fill="none" preserveAspectRatio="xMidYMid meet">${monSVG(1,0.5,c)}</svg></div>`;}
const ADM_MON=`<svg viewBox="0 0 24 18" fill="none" style="width:12px;height:auto"><rect x="1" y="1" width="22" height="13" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M6 17h12M12 14v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;

// ── Build desk ─────────────────────────────────────────────
function mkDesk(id,iconFn,nonBookable=false){
  const bk=getSlot(S.selDate,id),st=deskStatus(id),isSel=S.selDesks.includes(id);
  const locked=!canBook(S.selDate),past=isPast(S.selDate);
  const co=S.company||document.getElementById('userCompany')?.value||'';
  const selColor=co?coColor(co):'#2C5FD4';
  const el=document.createElement('div');
  let cls='desk';
  if(nonBookable)cls+=' desk-ne';else if(isSel)cls+=' selected';
  if(!nonBookable&&(locked||past))cls+=' locked-date';
  el.className=cls;el.dataset.id=id;
  let iconColor='#8898B0';
  if(!nonBookable&&bk){iconColor=bk.color||'#8898B0';el.style.background=hexToRgba(iconColor,0.18);el.style.borderColor=iconColor;el.style.borderWidth='2px';}
  else if(isSel){iconColor=selColor;el.style.background=hexToRgba(selColor,0.22);el.style.borderColor=selColor;el.style.borderWidth='2.5px';}
  const shortId=id.split('-').slice(1).join('');
  const timeStr=bk?(bk.allDay?'All Day':`${fmtT(bk.startTime)}–${fmtT(bk.endTime)}`):'';
  const tip=nonBookable?'Not available':bk?`${bk.name} · ${timeStr}`:isSel?`Selected · ${S.allDay?'All Day':fmtT(S.startTime)+'–'+fmtT(S.endTime)}`:locked?'Not available yet':past?'Past date':'Available — click to select';
  // Company logo fills the whole desk when booked (or selected by a user whose company has a logo)
  const fillCo=nonBookable?'':(bk&&!isSel?bk.company:(isSel?co:''));
  const fillLogo=fillCo?coLogo(fillCo):null;
  if(fillLogo){
    el.classList.add('has-logo');if(isSel)el.classList.add('logo-sel');
    el.style.background='#fff';
    el.innerHTML=`<div class="desk-logo-fill" role="img" aria-label="${x(fillCo)}" style="background-image:url('${fillLogo}')"></div><span class="desk-id">${shortId}</span><div class="desk-tip">${tip}</div>`;
    if(isSel){const ck=document.createElement('div');ck.className='desk-check';ck.style.background=selColor;ck.innerHTML='<svg viewBox="0 0 12 12" fill="none"><path d="M2.5 6.2l2.2 2.2 4.8-4.9" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';el.appendChild(ck);}
  }else{
    el.innerHTML=`${iconFn(iconColor)}<span class="desk-id">${shortId}</span><div class="desk-tip">${tip}</div>`;
    if(bk&&!nonBookable&&!isSel){const badge=document.createElement('div');badge.className='desk-badge';badge.style.background=iconColor;badge.style.color=txtOn(iconColor);badge.textContent=initials(bk.name);el.appendChild(badge);}
  }
  if(!nonBookable&&!locked&&!past){
    if(st==='taken'||st==='mine')el.addEventListener('click',()=>onOccupied(id,bk));
    else el.addEventListener('click',()=>onDesk(id));
  }
  return el;
}

// ── Render floor ───────────────────────────────────────────
function renderFloor(){
  const fp=document.getElementById('floorPlan');if(!fp)return;
  fp.innerHTML='';

  const co=S.company||document.getElementById('userCompany')?.value||'';
  const selColor=co?coColor(co):'#2C5FD4';
  const isConfSelected=S.selDesks.includes('CONF');

  // LEFT
  const bldL=document.createElement('div');bldL.className='building building-left';
  const lCard=document.createElement('div');lCard.className='bld-card';
  const topRooms=document.createElement('div');topRooms.className='rooms-row';
  const confBks=getConf(S.selDate);
  let confExtra='';
  let confClasses='room-box conf-room-box';

  if(confBks.length){
    const colors=confBks.map(b=>b.color||'#888');
    const firstColor=colors[0];
    confExtra=` data-booked="1" style="background:${hexToRgba(firstColor,.18)};border-color:${firstColor};border-width:2px;opacity:1"`;
    confClasses+=' booked';
    topRooms.dataset.confBooked='1';
  } else if(isConfSelected){
    // ✨ CORREGIDO: Se forzó el 'box-shadow' directamente en línea para heredar la sombra idéntica a los escritorios
    confExtra=` style="background:${hexToRgba(selColor,.22)};border-color:${selColor};border-width:2.5px;box-shadow: var(--sh);"`;
    confClasses+=' selected';
  }

  const confBadge=confBks.length
    ? `<div style="display:flex;gap:2px;margin-bottom:2px">${confBks.map(b=>coLogo(b.company)?logoImg(b.company,22,b.color):`<span style="width:7px;height:7px;border-radius:50%;background:${b.color||'#888'};display:inline-block"></span>`).join('')}</div><div style="font-size:7px;color:var(--orange);font-weight:700">${confBks.length} booked</div>`
    : isConfSelected
    ? `<div class="room-box-sub" style="color:${selColor};font-weight:700">Selected ${co ? '· '+co : ''}</div>`
    : '<div class="room-box-sub" style="color:var(--orange);font-weight:700">Click to book ▶</div>';

  // HR & IT tooltip rendered on body to avoid floor-card overflow:hidden clipping
  const hritHTML = `
    <div style="margin-bottom:4px"><strong style="font-size:12px;color:#111C2E">HR Staff</strong></div>
    <div style="font-weight:600;color:#1C2B3D">Sara Michel de Caso Gonzales</div>
    <div style="color:#8898B0;font-size:10.5px">michel.caso@meztal.com</div>
    <div style="border-top:1px solid #DDE3EE;margin:8px 0"></div>
    <div style="color:#4A5E78;font-size:10.5px;line-height:1.6">
      <b>On-site:</b> Mon, Wed &amp; Fri · 9 AM – 6 PM<br>
      <b>Remote:</b> Tue &amp; Thu · 9 AM – 6 PM
    </div>
    <div style="border-top:1px solid #DDE3EE;margin:10px 0 8px"></div>
    <div style="margin-bottom:4px"><strong style="font-size:12px;color:#111C2E">IT Staff</strong></div>
    <div style="font-weight:600;color:#1C2B3D">Jared Jacob Rojas Barrón</div>
    <div style="color:#8898B0;font-size:10.5px">jared.rojas@deiotmexico.com</div>
    <div style="border-top:1px solid #DDE3EE;margin:8px 0"></div>
    <div style="color:#4A5E78;font-size:10.5px;line-height:1.6">
      <b>On-site:</b> Mon – Thu · 8 AM – 12 PM<br>
      <b>Remote:</b> Fri · 8 AM – 12 PM
    </div>
    <div style="color:#4A5E78;font-size:10.5px;margin-top:6px">
      Issues: <a href="https://deiotmexico.com/support/" target="_blank" style="color:#E8722A;font-weight:600">deiotmexico.com/support/</a>
    </div>
  `;

  topRooms.innerHTML=`
    <div class="room-box" id="hritBox">
      <div class="room-box-lbl">HR &amp; IT</div>
      <div class="room-box-sub">Office</div>
    </div>
    <div class="${confClasses}" id="confRoomBox"${confExtra}>
      <div class="room-box-lbl" style="${(confBks.length || isConfSelected)?'color:var(--navy)':''}">Conference</div>
      ${confBadge}
    </div>`;
  lCard.appendChild(topRooms);
  // HR & IT body tooltip (avoids floor-card overflow:hidden clipping)
  setTimeout(()=>{
    const hritEl=document.getElementById('hritBox');
    if(!hritEl)return;
    let tip=document.getElementById('_hrit_tip');
    if(!tip){
      tip=document.createElement('div');
      tip.id='_hrit_tip';
      tip.className='hrit-floating-tip';
      document.body.appendChild(tip);
    }
    tip.innerHTML=hritHTML;
    hritEl.addEventListener('mouseenter',()=>{
      const r=hritEl.getBoundingClientRect();
      tip.style.top=(r.bottom+window.scrollY+10)+'px';
      tip.style.left=(r.left+window.scrollX)+'px';
      tip.style.opacity='1';tip.style.pointerEvents='auto';
    });
    hritEl.addEventListener('mouseleave',()=>{
      tip.style.opacity='0';tip.style.pointerEvents='none';
    });
  },0);
  // Apply company color using setProperty (overrides !important CSS)
  const confEl = topRooms.querySelector('#confRoomBox');
  if(confEl) {
    const applyColor = (c, alpha=0.22) => {
      confEl.style.setProperty('background', hexToRgba(c, alpha), 'important');
      confEl.style.setProperty('border-color', c, 'important');
      confEl.style.setProperty('border-width', '2px', 'important');
      confEl.style.setProperty('opacity', '1', 'important');
    };
    if(confBks.length) {
      applyColor(confBks[0].color || '#888', 0.18);
    } else if(isConfSelected && co) {
      applyColor(selColor, 0.22);
    }
    confEl.addEventListener('click', () => openConf(S.selDate));
  }

  LEFT_SECS.forEach(sec=>{
    const row=document.createElement('div');row.className='sec-row';
    const tag=document.createElement('div');tag.className='row-tag';tag.textContent=sec.label;row.appendChild(tag);
    const content=document.createElement('div');content.className='sec-content';
    if(sec.standalone){const sw=document.createElement('div');sw.className='standalone-wrap';sw.appendChild(mkDesk(`${sec.id}-S`,dualV));content.appendChild(sw);}
    const block=document.createElement('div');block.className='sec-block';
    const rA=document.createElement('div');rA.className='desk-row';
    for(let c=1;c<=sec.cols;c++)rA.appendChild(mkDesk(`${sec.id}-A${c}`,dualH));
    const sep=document.createElement('div');sep.className='row-sep';
    const rB=document.createElement('div');rB.className='desk-row';
    for(let c=1;c<=sec.cols;c++)rB.appendChild(mkDesk(`${sec.id}-B${c}`,dualH));
    block.appendChild(rA);block.appendChild(sep);block.appendChild(rB);
    content.appendChild(block);row.appendChild(content);lCard.appendChild(row);
  });
  const mzL=document.createElement('div');mzL.className='meztal-zone';mzL.id='cemZone';
  mzL.innerHTML=`<div class="mz-desk-mini"></div><div class="mz-desk-mini"></div>
    <div class="meztal-zone-lbl" style="cursor:default">Community Experience Manager</div>
    <div class="mz-desk-mini"></div><div class="mz-desk-mini"></div>`;
  lCard.appendChild(mzL);
  // CEM body-level tooltip
  setTimeout(()=>{
    const cemEl=document.getElementById('cemZone');
    if(!cemEl)return;
    let cemTip=document.getElementById('_cem_tip');
    if(!cemTip){
      cemTip=document.createElement('div');
      cemTip.id='_cem_tip';
      cemTip.className='hrit-floating-tip';
      document.body.appendChild(cemTip);
    }
    cemTip.innerHTML=`
      <div style="margin-bottom:4px"><strong style="font-size:12px;color:#111C2E">Community Experience Manager</strong></div>
      <div style="font-weight:600;color:#1C2B3D">Noemi Esparza</div>
      <div style="color:#8898B0;font-size:10.5px">nesparza@meztal.com</div>
      <div style="border-top:1px solid #DDE3EE;margin:8px 0"></div>
      <div style="color:#4A5E78;font-size:10.5px;line-height:1.6">
        <b>On-site:</b> Mon, Wed &amp; Fri · 8 AM – 6 PM<br>
        <b>Remote:</b> Tue &amp; Thu · 8 AM – 6 PM
      </div>`;
    cemEl.addEventListener('mouseenter',()=>{
      const r=cemEl.getBoundingClientRect();
      cemTip.style.top=(r.top+window.scrollY-cemTip.offsetHeight-10)+'px';
      cemTip.style.left=(r.left+window.scrollX)+'px';
      cemTip.style.opacity='1';cemTip.style.pointerEvents='auto';
    });
    cemEl.addEventListener('mouseleave',()=>{
      cemTip.style.opacity='0';cemTip.style.pointerEvents='none';
    });
  },0);bldL.appendChild(lCard);fp.appendChild(bldL);

  // RIGHT
  const bldR=document.createElement('div');bldR.className='building building-right';
  const rCard=document.createElement('div');rCard.className='bld-card';
  const common=document.createElement('div');common.className='common-area';
  common.innerHTML=`<div class="common-circle"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 2"/></svg></div><span class="common-lbl">Common Area</span>`;
  rCard.appendChild(common);
  RIGHT_SECS.forEach(sec=>{
    const row=document.createElement('div');row.className='sec-row';
    const tag=document.createElement('div');tag.className='row-tag';tag.textContent=sec.label;row.appendChild(tag);
    const content=document.createElement('div');content.className='sec-content';
    if(sec.standalone){const sw=document.createElement('div');sw.className='standalone-wrap';sw.appendChild(mkDesk(`${sec.id}-S`,dualH));content.appendChild(sw);}
    const block=document.createElement('div');block.className='sec-block';
    const rA=document.createElement('div');rA.className='desk-row';
    for(let c=1;c<=sec.cols;c++)rA.appendChild(mkDesk(`${sec.id}-A${c}`,dualH));
    const sep2=document.createElement('div');sep2.className='row-sep';
    const rB=document.createElement('div');rB.className='desk-row';
    for(let c=1;c<=sec.cols;c++)rB.appendChild(mkDesk(`${sec.id}-B${c}`,dualH));
    block.appendChild(rA);block.appendChild(sep2);block.appendChild(rB);
    content.appendChild(block);row.appendChild(content);rCard.appendChild(row);
  });
  const sepL=document.createElement('div');sepL.className='bld-sep';rCard.appendChild(sepL);
  // HQ sections: same visual size as Row 5/6 but non-bookable
  ADM_SECS.forEach(sec=>{
    const row=document.createElement('div');row.className='sec-row';
    // Gray tag (non-bookable style)
    const tag=document.createElement('div');tag.className='row-tag';
    tag.style.cssText='background:#8898B0;font-size:clamp(6px,.65vw,8.5px)';
    tag.textContent=sec.label;row.appendChild(tag);
    const content=document.createElement('div');content.className='sec-content';
    // Standalone non-bookable desk
    const sw=document.createElement('div');sw.className='standalone-wrap';
    const dS=document.createElement('div');dS.className='desk desk-ne';
    dS.innerHTML=dualH('#BCC8DA')+'<span class="desk-id" style="color:#BCC8DA">—</span>';
    sw.appendChild(dS);content.appendChild(sw);
    // Block with top/bottom non-bookable desk
    const block=document.createElement('div');block.className='sec-block';
    block.style.background='var(--gray-50)';
    const rA=document.createElement('div');rA.className='desk-row';
    const dA=document.createElement('div');dA.className='desk desk-ne';
    dA.innerHTML=dualH('#BCC8DA')+'<span class="desk-id" style="color:#BCC8DA">—</span>';
    rA.appendChild(dA);
    const sep2=document.createElement('div');sep2.className='row-sep';
    const rB=document.createElement('div');rB.className='desk-row';
    const dB=document.createElement('div');dB.className='desk desk-ne';
    dB.innerHTML=dualH('#BCC8DA')+'<span class="desk-id" style="color:#BCC8DA">—</span>';
    rB.appendChild(dB);
    block.appendChild(rA);block.appendChild(sep2);block.appendChild(rB);
    content.appendChild(block);row.appendChild(content);rCard.appendChild(row);
  });
  bldR.appendChild(rCard);fp.appendChild(bldR);
}

function onDesk(id){const i=S.selDesks.indexOf(id);if(i>=0)S.selDesks.splice(i,1);else S.selDesks.push(id);renderFloor();renderSelList();}
function onOccupied(id,bk){if(!bk)return;const me=S.email||document.getElementById('userEmail')?.value.trim();if(bk.email===me)openModal(S.selDate,id,bk.name);else toast(`Occupied — ${bk.name}${bk.company?' ('+bk.company+')':''}${bk.allDay?'':', '+fmtT(bk.startTime)+'–'+fmtT(bk.endTime)}`,'info');}

// ── Cancel modal ───────────────────────────────────────────
function openModal(date,id,name){S.pendingCancel={date,id};const m=document.getElementById('cancelModal'),b=document.getElementById('modalBody');if(!m||!b)return;b.innerHTML=`Cancel <strong>${id}</strong> for <strong>${fmtMed(date)}</strong>?`;m.classList.remove('hidden');}
function closeModal(){S.pendingCancel=null;document.getElementById('cancelModal')?.classList.add('hidden');}
function doCancel(){if(!S.pendingCancel)return;const{date,id}=S.pendingCancel;delBk(date,id);closeModal();toast('Reservation cancelled','info');renderFloor();renderWeekBar();renderSelList();renderMyBk();renderCalendar();updateOcc();}

// ── Occupancy ──────────────────────────────────────────────
function updateOcc(){
  const bks=dayBk(S.selDate),n=Object.keys(bks).filter(k=>k!=='CONF').length;
  const pct=Math.round(n/TOTAL_DESKS*100);
  const fill=document.getElementById('occFill'),num=document.getElementById('occNum'),dt=document.getElementById('occDate');
  if(fill){fill.style.width=pct+'%';fill.className='occ-fill'+(pct>=80?' high':pct>=50?' mid':' low');}
  if(num)num.textContent=`${n} / ${TOTAL_DESKS} desks`;
  if(dt)dt.textContent=fmtDate(S.selDate);
}

// ── Week bar ───────────────────────────────────────────────
function renderWeekBar(){
  const chips=document.getElementById('dayChips'),rng=document.getElementById('wkRange'),prev=document.getElementById('prevWk'),next=document.getElementById('nextWk');
  if(!chips)return;
  const dates=weekDates(S.wkOffset),today=todayStr();
  const s=mkDate(dates[0]),e=mkDate(dates[6]);
  if(rng)rng.textContent=`${MONTH[s.getMonth()].slice(0,3)} ${s.getDate()} — ${MONTH[e.getMonth()].slice(0,3)} ${e.getDate()}, ${e.getFullYear()}`;
  chips.innerHTML='';
  dates.forEach(d=>{
    const dt=mkDate(d),locked=!canBook(d)&&!isPast(d),past=isPast(d),hasBk=Object.keys(dayBk(d)).filter(k=>k!=='CONF').length>0;
    const chip=document.createElement('div');
    let cls='day-chip';
    if(d===S.selDate)cls+=' active';else if(d===today)cls+=' today';
    if(locked)cls+=' locked';if(past&&d!==S.selDate)cls+=' past';if(hasBk)cls+=' has-bk';
    chip.className=cls;
    chip.innerHTML=`<span class="dn">${DAY_S[dt.getDay()]}</span><span class="dd">${dt.getDate()}</span><span class="day-pip"></span>`;
    if(!locked)chip.addEventListener('click',()=>selectDate(d));
    chips.appendChild(chip);
  });
  if(prev)prev.disabled=S.wkOffset<=0;
  if(next)next.disabled=S.wkOffset>=1||!nextWkUnlocked();
}
function selectDate(d){S.selDate=d;S.selDesks=[];const nw=weekDates(1);if(nw.includes(d)&&nextWkUnlocked())S.wkOffset=1;else S.wkOffset=0;renderWeekBar();renderFloor();renderSelList();updateOcc();renderCalendar();}

// ── Calendar ───────────────────────────────────────────────
function renderCalendar(){
  const container=document.getElementById('calGrid'),monthLbl=document.getElementById('calMonthLbl');
  if(!container)return;
  const year=S.calYear,month=S.calMonth,today=todayStr();
  const email=S.email||document.getElementById('userEmail')?.value.trim();
  const bkDates=new Set(email?myList(email).map(b=>b.d):[]);
  if(monthLbl)monthLbl.textContent=`${MONTH[month].slice(0,3)} ${year}`;
  const hdrs=['Mo','Tu','We','Th','Fr','Sa','Su'];
  let html=hdrs.map(h=>`<div class="cal-hdr">${h}</div>`).join('');
  const firstDow=new Date(year,month,1).getDay(),offset=firstDow===0?6:firstDow-1;
  for(let i=0;i<offset;i++)html+=`<div class="cal-cell cal-empty"></div>`;
  const dim=new Date(year,month+1,0).getDate();
  for(let d=1;d<=dim;d++){
    const ds=`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const pastDay=ds<today,locked=!canBook(ds)&&!pastDay;
    let cls='cal-cell';
    if(ds===today)cls+=' cal-today';if(ds===S.selDate)cls+=' cal-selected';
    if(bkDates.has(ds))cls+=' cal-has-bk';if(pastDay)cls+=' cal-past-day';if(locked)cls+=' cal-locked';
    const click=(!pastDay&&!locked)?`onclick="selectDate('${ds}')"`:'' ;
    html+=`<div class="${cls}" ${click}>${d}</div>`;
  }
  container.innerHTML=html;
}

// ── Selection list ─────────────────────────────────────────
function renderSelList(){
  const list=document.getElementById('selList'),btn=document.getElementById('confirmBtn');
  if(!list)return;
  list.innerHTML='';
  const co=S.company||document.getElementById('userCompany')?.value||'';
  const c=co?coColor(co):'#2C5FD4';
  const timeTag=S.allDay?'All Day':`${fmtT(S.startTime)}–${fmtT(S.endTime)}`;
  if(!S.selDesks.length){
    list.innerHTML='<div class="sel-empty">Click any desk on the floor plan to select it</div>';
  }else{
    S.selDesks.forEach(id=>{
      const el=document.createElement('div');el.className='sel-item';
      const labelText = id === 'CONF' ? 'Conference Room' : id;
      el.style.background=hexToRgba(c,.13);el.style.border=`1px solid ${hexToRgba(c,.4)}`;
      el.innerHTML=`<span class="sel-item-id" style="color:${c}">${labelText}</span>
        <span class="sel-time-tag">${timeTag}</span>
        <button class="btn-rm" onclick="rmDesk('${id}')" title="Remove">✕</button>`;
      list.appendChild(el);
    });
  }
  if(btn)btn.disabled=!S.selDesks.length;
}
function rmDesk(id){S.selDesks=S.selDesks.filter(x=>x!==id);renderFloor();renderSelList();}

// ── Confirm booking ────────────────────────────────────────
function doBook(){
  const nEl=document.getElementById('userName'),eEl=document.getElementById('userEmail'),cEl=document.getElementById('userCompany');
  const name=nEl?.value.trim()||'',email=eEl?.value.trim()||'',company=cEl?.value||'';
  if(!name){toast('Please enter your name','err');nEl?.focus();return;}
  if(!company&&emailCompany(email)){checkEmailStatus();return doBook();}
  if(!company){toast('Please select your company','err');cEl?.focus();return;}
  if(!email||!email.includes('@')){toast('Please enter a valid email','err');eEl?.focus();return;}
  const authCo=emailCompany(email);
  if(!authCo){toast('This email is not on the authorized list. Ask the Meztal admin to add it (demo: list saved in this browser only).','err');eEl?.focus();checkEmailStatus();return;}
  if(authCo!==company){toast(`This email is authorized for ${authCo}, not ${company}`,'err');checkEmailStatus();return;}
  if(!S.selDesks.length)return;
  if(!S.allDay&&tF(S.endTime)<=tF(S.startTime)){toast('End time must be after start time','err');return;}
  
  const color=coColor(company);
  const st=S.allDay?'07:00':S.startTime, et=S.allDay?'18:00':S.endTime;
  let ok=0, dup=0, isConfBooked=false;
  
  S.selDesks.forEach(id=>{
    if(id === 'CONF') {
      if(addConf(S.selDate, name, email, company, color, st, et)) {
        isConfBooked = true;
        ok++;
      } else {
        dup++;
      }
    } else {
      addBk(S.selDate,id,name,email,company,color,st,et,S.allDay)?ok++:dup++;
    }
  });
  
  S.name=name;S.email=email;S.company=company;saveSes();S.selDesks=[];
  
  if(ok) {
    if(isConfBooked) {
      toast(`✓ Conference Room successfully booked · ${fmtT(st)}–${fmtT(et)}`, 'ok');
    } else {
      toast(`✓ ${ok} desk${ok>1?'s':''} reserved`+(S.allDay?'':` · ${fmtT(st)}–${fmtT(et)}`), 'ok');
    }
  }
  if(dup) {
    toast(isConfBooked ? 'That time slot overlaps with an existing booking' : `${dup} desk${dup>1?'s were':' was'} already taken`,'err');
  }
  
  renderFloor();renderWeekBar();renderSelList();renderMyBk();renderCalendar();updateOcc();
}

// ── My bookings ────────────────────────────────────────────
function renderMyBk(){
  const c=document.getElementById('myBkList');if(!c)return;
  const email=S.email||document.getElementById('userEmail')?.value.trim();
  if(!email){c.innerHTML='<div class="bk-empty">Enter your email to see your reservations</div>';return;}
  const bks=myList(email);
  if(!bks.length){c.innerHTML='<div class="bk-empty">No active reservations</div>';return;}
  c.innerHTML='';
  bks.forEach(bk=>{
    const item=document.createElement('div');item.className='bk-item';
    const color=bk.color||'#378ADD';
    const timeStr=bk.allDay?'All Day':`${fmtT(bk.startTime)}–${fmtT(bk.endTime)}`;
    item.innerHTML=`<div class="bk-dot" style="background:${color}"></div>
      <div class="bk-info"><div class="bk-desk">${bk.id}</div>
      <div class="bk-meta">${fmtShort(bk.d)} · ${timeStr}</div></div>
      <button class="btn-cancel-bk" onclick="triggerCancel('${bk.d}','${bk.id}')">Cancel</button>`;
    c.appendChild(item);
  });
}
function triggerCancel(d,id){const bk=getSlot(d,id);openModal(d,id,bk?.name||'');}

// ── Toast ──────────────────────────────────────────────────
function toast(msg,type='info'){
  const z=document.getElementById('toastZone');if(!z)return;
  const t=document.createElement('div');t.className=`toast ${type}`;t.textContent=msg;
  z.appendChild(t);
  setTimeout(()=>{t.style.transition='all .25s';t.style.opacity='0';t.style.transform='translateX(60px)';setTimeout(()=>t.remove(),280);},3200);
}

// ══════════════════════════════════════════════════════════
//   CONFERENCE ROOM TIMELINE
// ══════════════════════════════════════════════════════════
let CONF = { date: null, selStart: null, selEnd: null, drag: null, dragX0: 0, dragS0: 0, dragE0: 0 };

function tPct(h) { return ((h - T_START) / T_SPAN) * 100; }
function pctT(p) { return T_START + (p / 100) * T_SPAN; }
function snapH(h) { return Math.round(h * 12) / 12; }  // 5-min intervals
function clampH(h) { return Math.max(T_START, Math.min(T_END, h)); }
const MIN_DUR = 1/6;    // 10 minutes minimum
const MAX_DUR = 6.0;    // 6 hours
function getAvailStart(){
  if(CONF.date===todayStr()){
    const now=new Date(),nowH=now.getHours()+now.getMinutes()/60;
    return Math.min(T_END-MIN_DUR, Math.ceil(nowH*12)/12);
  }
  return T_START;
}
function clampToAvail(h){ return Math.max(getAvailStart(), Math.min(T_END, h)); }

function getTrackPct(e) {
  const track = document.getElementById('tlTrack'); if (!track) return 0;
  const r = track.getBoundingClientRect();
  const x = (e.clientX || e.touches?.[0]?.clientX || 0) - r.left;
  return Math.max(0, Math.min(100, (x / r.width) * 100));
}

function openConf(date) {
  CONF.date = date; CONF.selStart = null; CONF.selEnd = null; CONF.drag = null;
  const o = document.getElementById('confOverlay'); if (!o) return;
  o.classList.remove('hidden');
  document.getElementById('confDateLbl').textContent = fmtDate(date);
  renderTL(); updateConfDetails();
  
  const track = document.getElementById('tlTrack');
  if (track) { track.onmousedown = tlMouseDown; }
}
function closeConf() { document.getElementById('confOverlay')?.classList.add('hidden'); }
function fmtHourLbl(h) { const ap = h >= 12 ? 'PM' : 'AM', hd = h > 12 ? h - 12 : h === 0 ? 12 : h; return `${hd}${ap}`; }

function renderTL() {
  const tlLabels = document.getElementById('tlLabels'), tlTrack = document.getElementById('tlTrack');
  if (!tlLabels || !tlTrack) return;

  let lblHtml = '';
  for (let h = T_START; h <= T_END; h++) {
    lblHtml += `<div class="tl-lbl" style="left: ${tPct(h)}%">${fmtHourLbl(h)}</div>`;
  }
  tlLabels.innerHTML = lblHtml;

  let trackHtml = '';
  for (let h = T_START; h <= T_END; h++) {
    trackHtml += `<div style="position: absolute; top: 0; bottom: 0; left: ${tPct(h)}%; width: 1px; background: rgba(0, 0, 0, 0.04); pointer-events: none"></div>`;
  }

  const today = todayStr();
  if (CONF.date === today) {
    const now = new Date();
    const nowH = now.getHours() + now.getMinutes() / 60;
    if (nowH > T_START) {
      const pW = Math.min(100, tPct(nowH));
      trackHtml += `<div class="tl-past" style="left:0; width:${pW}%"></div>`;
      trackHtml += `<div class="tl-now-line" style="left:${pW}%"></div>`;
    }
  }

  getConf(CONF.date).forEach(bk => {
    const l = tPct(tF(bk.startTime)), w = tPct(tF(bk.endTime)) - l;
    const c = bk.color || '#888';
    trackHtml += `<div class="tl-bk" style="left: ${l}%; width: ${w}%; background: ${c}; opacity: .85">
      <span style="color: ${txtOn(c)}; font-size: 10px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 4px; display:flex; align-items:center; gap:4px">${logoImg(bk.company,14,'#fff')}${initials(bk.name)} ${bk.company || ''}</span></div>`;
  });

  if (CONF.selStart !== null && CONF.selEnd !== null) {
    const l = tPct(CONF.selStart), w = tPct(CONF.selEnd) - l;
    trackHtml += `<div class="tl-sel" id="tlSel" style="left: ${l}%; width: ${w}%">
      <div class="tl-handle" id="tlHL"></div>
      <div class="tl-handle tl-hr" id="tlHR"></div>
    </div>`;
  }

  tlTrack.innerHTML = trackHtml;
}

function updateConfDetails() {
  const timeLbl = document.getElementById('confTimeLbl'), btn = document.getElementById('btnBookConf');
  if (CONF.selStart === null || CONF.selEnd === null) {
    if (timeLbl) timeLbl.textContent = 'Select a time above';
    if (btn) { btn.disabled = true; btn.textContent = 'Choose a time'; }
  } else {
    const st = fToT(CONF.selStart), et = fToT(CONF.selEnd), dur = fmtDur(st,et);
    if (timeLbl) timeLbl.textContent = `${fmtT(st)} – ${fmtT(et)} (${dur})`;
    if (btn) { btn.disabled = false; btn.textContent = `Select this time (${dur})`; }
  }
}

function tlMouseDown(e) {
  e.preventDefault();
  const raw = clampH(snapH(pctT(getTrackPct(e))));
  // Silently clamp to available time — no toast during interaction
  const avail = getAvailStart();
  const hour  = Math.max(avail, raw);

  const hlEl=document.getElementById('tlHL'),hrEl=document.getElementById('tlHR'),selEl=document.getElementById('tlSel');
  if(hlEl&&hrEl&&CONF.selStart!==null){
    const hlR=hlEl.getBoundingClientRect(),hrR=hrEl.getBoundingClientRect(),cx=e.clientX;
    if(cx>=hlR.left-12&&cx<=hlR.right+12){CONF.drag='left';}
    else if(cx>=hrR.left-12&&cx<=hrR.right+12){CONF.drag='right';}
    else if(selEl){const selR=selEl.getBoundingClientRect();if(cx>=selR.left&&cx<=selR.right)CONF.drag='move';}
    else CONF.drag=null;
  }
  if(!CONF.drag){
    // New selection: start at clicked (clamped) hour, initial width = 30 min
    const initEnd = clampToAvail(hour + MIN_DUR);
    CONF.drag='new'; CONF.selStart=hour; CONF.selEnd=initEnd;
  }
  CONF.dragX0=e.clientX; CONF.dragS0=CONF.selStart; CONF.dragE0=CONF.selEnd;
  renderTL(); updateConfDetails();
  document.addEventListener('mousemove',tlMouseMove);
  document.addEventListener('mouseup',tlMouseUp);
}

function tlMouseMove(e) {
  if (!CONF.drag) return;
  const track = document.getElementById('tlTrack'); if (!track) return;
  const r = track.getBoundingClientRect(), dH = ((e.clientX - CONF.dragX0) / r.width) * T_SPAN;
  
  // limitMin: use Math.ceil to avoid snapping into the past
  const limitMin = (CONF.date === todayStr())
    ? Math.min(T_END - MIN_DUR, Math.ceil((new Date().getHours() + new Date().getMinutes()/60) * 12) / 12)
    : T_START;

  if (CONF.drag === 'new') {
    const rawH = clampH(snapH(pctT(getTrackPct(e))));
    const safeH = Math.max(limitMin, rawH);
    if (safeH > CONF.dragS0) { CONF.selStart = CONF.dragS0; CONF.selEnd = safeH; }
    else if (safeH < CONF.dragS0) { CONF.selStart = Math.max(limitMin, safeH); CONF.selEnd = CONF.dragS0; }
    // Enforce min duration (10 min minimum)
    if (CONF.selEnd - CONF.selStart < MIN_DUR) CONF.selEnd = clampH(CONF.selStart + MIN_DUR);
  } else if (CONF.drag === 'move') {
    const dur = CONF.dragE0 - CONF.dragS0;
    let ns = snapH(CONF.dragS0 + dH), ne = snapH(CONF.dragE0 + dH);
    if (ns < limitMin) { ns = limitMin; ne = limitMin + dur; }
    if (ne > T_END) { ne = T_END; ns = T_END - dur; }
    CONF.selStart = ns; CONF.selEnd = ne;
  } else if (CONF.drag === 'left') {
    CONF.selStart = clampH(snapH(CONF.dragS0 + dH));
    if (CONF.selStart < limitMin) CONF.selStart = limitMin;
    if (CONF.selStart > CONF.selEnd - MIN_DUR) CONF.selStart = CONF.selEnd - MIN_DUR;
  } else if (CONF.drag === 'right') {
    CONF.selEnd = clampToAvail(snapH(CONF.dragE0 + dH));
    if (CONF.selEnd < CONF.selStart + MIN_DUR) CONF.selEnd = CONF.selStart + MIN_DUR;
    if (CONF.selEnd > CONF.selStart + MAX_DUR) CONF.selEnd = CONF.selStart + MAX_DUR;
  }
  renderTL(); updateConfDetails();
}
function tlMouseUp() { CONF.drag = null; document.removeEventListener('mousemove', tlMouseMove); document.removeEventListener('mouseup', tlMouseUp); }

function bookConf() {
  if (CONF.selStart === null || CONF.selEnd === null) return;
  const st = fToT(CONF.selStart), et = fToT(CONF.selEnd);
  
  setTimeMode(false);
  
  const stInput = document.getElementById('startTime');
  const etInput = document.getElementById('endTime');
  if (stInput) stInput.value = st;
  if (etInput) etInput.value = et;
  
  S.startTime = st;
  S.endTime = et;
  
  if (!S.selDesks.includes('CONF')) { S.selDesks.push('CONF'); }
  
  closeConf();
  renderSelList();
  renderFloor();
  toast("Time slot selected! Now please enter your details and click Confirm", "info");
}

// ── Email authorization (demo) ─────────────────────────────
function checkEmailStatus(){
  const e=document.getElementById('userEmail'),c=document.getElementById('userCompany'),st=document.getElementById('emailStatus');
  if(!e||!st)return;
  const v=e.value.trim(),co=emailCompany(v);
  if(!v){st.className='f-hint';st.textContent='';if(c)c.disabled=false;return;}
  if(co){
    if(c){c.value=co;c.disabled=true;}
    st.className='f-hint ok';st.innerHTML=`${logoImg(co,14)}<span>Authorized email · ${x(co)}</span>`;
    if(S.company!==co){S.company=co;updateSwatchColor();}
  }else{
    if(c)c.disabled=false;
    st.className='f-hint err';st.textContent=v.includes('@')?'Not on the authorized list. Ask the Meztal admin to add it.':'';
  }
}

// ── Employee init ──────────────────────────────────────────
function initEmployee(){
  const sel=document.getElementById('userCompany');
  if(sel){sel.innerHTML='<option value="">Select your company…</option>';COMPANY_NAMES.forEach(name=>{const o=document.createElement('option');o.value=name;o.textContent=name;sel.appendChild(o);});sel.addEventListener('change',updateSwatchColor);}
  
  const opts=mkTimeOpts();
  ['startTime','endTime'].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    el.innerHTML='';opts.forEach(t=>{const o=document.createElement('option');o.value=t;o.textContent=fmtT(t);el.appendChild(o);});
  });
  const stEl=document.getElementById('startTime'),etEl=document.getElementById('endTime');
  if(stEl){stEl.value='07:00';stEl.addEventListener('change',onStartChange);}
  if(etEl){etEl.value='18:00';etEl.addEventListener('change',onEndChange);}
  document.getElementById('btnAllDay')?.addEventListener('click',()=>setTimeMode(true));
  document.getElementById('btnCustom')?.addEventListener('click',()=>setTimeMode(false));

  loadBk();loadSes();checkEmailStatus();
  renderWeekBar();renderFloor();renderSelList();updateOcc();renderMyBk();renderCalendar();

  document.getElementById('prevWk')?.addEventListener('click',()=>{if(S.wkOffset>0){S.wkOffset--;renderWeekBar();}});
  document.getElementById('nextWk')?.addEventListener('click',()=>{if(S.wkOffset<1&&nextWkUnlocked()){S.wkOffset++;renderWeekBar();}});
  document.getElementById('confirmBtn')?.addEventListener('click',doBook);
  document.getElementById('cancelNo')?.addEventListener('click',closeModal);
  document.getElementById('cancelYes')?.addEventListener('click',doCancel);
  document.getElementById('cancelModal')?.addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal();});
  document.getElementById('calPrev')?.addEventListener('click',()=>{S.calMonth--;if(S.calMonth<0){S.calMonth=11;S.calYear--;}renderCalendar();});
  document.getElementById('calNext')?.addEventListener('click',()=>{S.calMonth++;if(S.calMonth>11){S.calMonth=0;S.calYear++;}renderCalendar();});
  document.getElementById('userEmail')?.addEventListener('input',checkEmailStatus);
  document.getElementById('userEmail')?.addEventListener('blur',()=>{const v=document.getElementById('userEmail')?.value.trim();if(v){S.email=v;renderMyBk();renderCalendar();}});
  
  document.getElementById('confOverlay')?.addEventListener('click',e=>{if(e.target===e.currentTarget)closeConf();});
  document.getElementById('btnCloseConf')?.addEventListener('click',closeConf);
  document.getElementById('btnBookConf')?.addEventListener('click',bookConf);
  // tlTrack mousedown bound in openConf() to avoid duplicate listeners
}

// ══════════════════════════════════════════════════════════
//   ADMIN
// ══════════════════════════════════════════════════════════
function checkPin(){
  const pin=document.getElementById('pinInput')?.value||'';
  if(pin===ADMIN_PIN){document.getElementById('pinScreen').style.display='none';document.getElementById('adminDash').style.display='block';initAdmin();}
  else{const e=document.getElementById('pinErr');if(e){e.textContent='Incorrect PIN.';e.style.display='block';}const i=document.getElementById('pinInput');if(i){i.value='';i.focus();}}
}
function initAdmin(){
  loadBk();renderAdmStats();renderRowOcc();renderDirAdmin();renderReport();renderAdmTable();renderConfTable();
  initDirAdmin();
  document.getElementById('repMonth')?.addEventListener('change',renderReport);
  document.getElementById('btnRepCsv')?.addEventListener('click',reportCsv);
  document.getElementById('btnRepPrint')?.addEventListener('click',()=>window.print());
  document.getElementById('fsearch')?.addEventListener('input',admFilter);
  document.getElementById('fdate')?.addEventListener('change',admFilter);
  document.getElementById('fcompany')?.addEventListener('change',admFilter);
  document.getElementById('btnClear')?.addEventListener('click',()=>{['fsearch','fdate','fcompany'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});renderAdmTable();});
}
function admFilter(){renderAdmTable(document.getElementById('fsearch')?.value||'',document.getElementById('fdate')?.value||'',document.getElementById('fcompany')?.value||'');}
function allRows(){const r=[];Object.entries(S.bookings).forEach(([d,dk])=>Object.entries(dk).forEach(([id,bk])=>{if(id!=='CONF')r.push({d,id,...bk});}));return r.sort((a,b)=>b.d.localeCompare(a.d)||a.id.localeCompare(b.id));}
function groupedRows(){
  const all=allRows(),map={};
  all.forEach(r=>{const key=`${r.email}||${r.d}`;if(!map[key])map[key]={name:r.name,email:r.email,company:r.company,color:r.color,d:r.d,desks:[]};map[key].desks.push(r);});
  return Object.values(map).sort((a,b)=>b.d.localeCompare(a.d)||a.name.localeCompare(b.name));
}
function renderAdmStats(){
  const all=allRows(),today=todayStr(),cw=weekDates(0);
  const g=id=>document.getElementById(id);
  if(g('sToday'))g('sToday').textContent=Object.keys(dayBk(today)).filter(k=>k!=='CONF').length;
  if(g('sWeek'))g('sWeek').textContent=all.filter(r=>cw.includes(r.d)).length;
  if(g('sUsers'))g('sUsers').textContent=new Set(all.map(r=>r.email)).size;
  if(g('sTotal'))g('sTotal').textContent=all.length;
  const dl=document.getElementById('admDateLbl');if(dl)dl.textContent=fmtDate(today);
  const cf=document.getElementById('fcompany');
  if(cf&&cf.options.length<=1)COMPANY_NAMES.forEach(n=>{const o=document.createElement('option');o.value=n;o.textContent=n;cf.appendChild(o);});
}
function renderRowOcc(){
  const grid=document.getElementById('rowOccGrid');if(!grid)return;
  const today=todayStr(),bk=dayBk(today);
  const defs=[...LEFT_SECS,...RIGHT_SECS],totals={'F1':8,'F2':8,'F3':7,'F4':7,'F5':3,'F6':3};
  grid.innerHTML='';
  defs.forEach(sec=>{
    const tot=totals[sec.id]||8,occ=Object.keys(bk).filter(id=>id.startsWith(sec.id+'-')).length;
    const pct=Math.round(occ/tot*100),colors={low:'#2E7D32',mid:'#E65100',high:'#C62828'},cls=pct>=80?'high':pct>=50?'mid':'low';
    const card=document.createElement('div');card.style.cssText='background:var(--gray-50);border:1px solid var(--gray-200);border-radius:8px;padding:10px 12px';
    card.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span style="font-size:11px;font-weight:700;color:var(--navy)">${sec.label}</span><span style="font-size:11px;font-weight:700;color:${colors[cls]}">${occ}/${tot}</span></div><div style="height:6px;background:var(--gray-200);border-radius:99px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${colors[cls]};border-radius:99px"></div></div>`;
    grid.appendChild(card);
  });
  const confBks=getConf(today);
  if(confBks.length){const card=document.createElement('div');card.style.cssText='background:var(--gray-50);border:1px solid var(--gray-200);border-radius:8px;padding:10px 12px';card.innerHTML=`<div style="font-size:11px;font-weight:700;color:var(--navy);margin-bottom:6px">Conference Room</div><div style="font-size:10px;color:var(--gray-600)">${confBks.length} booking${confBks.length>1?'s':''} today</div>`;grid.appendChild(card);}
}
function rowLabel(id){const sec=id.split('-')[0];return{'F1':'Row 1','F2':'Row 2','F3':'Row 3','F4':'Row 4','F5':'Row 5','F6':'Row 6'}[sec]||sec;}
function deskSummary(desks){
  const byRow={};
  desks.forEach(bk=>{const lbl=rowLabel(bk.id);if(!byRow[lbl])byRow[lbl]=[];byRow[lbl].push({id:bk.id.split('-').slice(1).join(''),allDay:bk.allDay,st:bk.startTime,et:bk.endTime});});
  return Object.entries(byRow).map(([lbl,ds]) => {
    const timeStr=ds[0].allDay?'All Day':`${fmtT(ds[0].st)}–${fmtT(ds[0].et)}`;
    return `<b>${lbl}:</b> ${ds.map(d=>d.id).join(', ')} <span style="color:var(--orange);font-size:10px">[${timeStr}]</span>`;
  }).join(' &nbsp;·&nbsp; ');
}
function renderAdmTable(search='',df='',co=''){
  const tb=document.getElementById('admTbody');if(!tb)return;
  let rows=groupedRows();
  if(search){const q=search.toLowerCase();rows=rows.filter(r=>r.name?.toLowerCase().includes(q)||r.email?.toLowerCase().includes(q)||r.desks.some(d=>d.id.toLowerCase().includes(q))||r.company?.toLowerCase().includes(q));}
  if(df)rows=rows.filter(r=>r.d===df);
  if(co)rows=rows.filter(r=>r.company===co);
  if(!rows.length){tb.innerHTML='<tr><td colspan="5" class="tbl-empty">No reservations found</td></tr>';return;}
  tb.innerHTML='';
  rows.forEach(r=>{
    const c=r.color||'#888',cnt=r.desks.length;
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td><div style="font-weight:700;color:var(--navy)">${x(r.name||'—')}</div><div style="font-size:10.5px;color:var(--gray-400);margin-top:1px">${x(r.email||'')}</div></td>
      <td><span class="co-pill" style="background:${hexToRgba(c,.14)};color:${c}"><span style="width:8px;height:8px;border-radius:50%;background:${c};display:inline-block;flex-shrink:0"></span>${x(r.company||'')}</span></td>
      <td style="white-space:nowrap">${fmtMed(r.d)}</td>
      <td><div style="font-size:11px;color:var(--gray-600);line-height:1.6">${deskSummary(r.desks)}</div><div style="font-size:10px;color:var(--gray-400);margin-top:2px">${cnt} desk${cnt>1?'s':''}</div></td>
      <td><button class="btn-tbl-cancel" onclick="admCancelUser('${r.d}','${encodeURIComponent(r.email)}')">Delete all</button></td>`;
    tb.appendChild(tr);
  });
}
function admCancelUser(d,enc){
  const email=decodeURIComponent(enc),bks=Object.entries(dayBk(d)).filter(([id,bk])=>id!=='CONF'&&bk.email===email);
  if(!bks.length)return;
  const name=bks[0][1].name||email,count=bks.length;
  if(!confirm(`Delete ${count} reservation${count>1?'s':''} for ${name} on ${fmtMed(d)}?`))return;
  delUserDay(d,email);
  toast(`Deleted ${count} reservation${count>1?'s':''}`,'info');
  renderAdmStats();renderRowOcc();renderReport();admFilter();renderConfTable();
}
function renderConfTable(){
  const tb=document.getElementById('confTbody');if(!tb)return;
  const all=[];
  Object.entries(S.bookings).forEach(([d,bks])=>{(bks.CONF||[]).forEach(bk=>all.push({d,...bk}));});
  all.sort((a,b)=>b.d.localeCompare(a.d)||tF(a.startTime)-tF(b.startTime));
  if(!all.length){tb.innerHTML='<tr><td colspan="5" class="tbl-empty">No conference room bookings</td></tr>';return;}
  tb.innerHTML='';
  all.forEach(r=>{
    const c=r.color||'#888',dur=fmtDur(r.startTime,r.endTime);
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td><div style="font-weight:700;color:var(--navy)">${x(r.name||'—')}</div><div style="font-size:10.5px;color:var(--gray-400)">${x(r.email||'')}</div></td>
      <td><span class="co-pill" style="background:${hexToRgba(c,.14)};color:${c}"><span style="width:8px;height:8px;border-radius:50%;background:${c};display:inline-block;flex-shrink:0"></span>${x(r.company||'')}</span></td>
      <td style="white-space:nowrap">${fmtMed(r.d)}</td>
      <td><b>${fmtT(r.startTime)}</b> – <b>${fmtT(r.endTime)}</b><div style="font-size:10px;color:var(--gray-400)">${dur}</div></td>
      <td><button class="btn-tbl-cancel" onclick="admDelConf('${r.d}',${r.ts})">Cancel</button></td>`;
    tb.appendChild(tr);
  });
}
function admDelConf(d,ts){if(!confirm('Cancel this conference room booking?'))return;delConf(d,Number(ts));toast('Conference booking cancelled','info');renderAdmStats();renderRowOcc();renderReport();renderConfTable();}

// ══════════════════════════════════════════════════════════
//   MONTHLY REPORT
// ══════════════════════════════════════════════════════════
function bkHours(bk){return bk.allDay?T_SPAN:Math.max(0,tF(bk.endTime)-tF(bk.startTime));}
function workDaysIn(y,m){let n=0;const t=new Date(y,m+1,0).getDate();for(let d=1;d<=t;d++){const w=new Date(y,m,d).getDay();if(w>0&&w<6)n++;}return n;}
function reportData(ym){
  const [y,mo]=ym.split('-').map(Number),pre=ym+'-';
  const desks=[],conf=[];
  Object.entries(S.bookings).forEach(([d,dk])=>{
    if(!d.startsWith(pre))return;
    Object.entries(dk).forEach(([id,v])=>{
      if(id==='CONF')v.forEach(b=>conf.push({d,...b}));
      else desks.push({d,id,...v});
    });
  });
  const wd=workDaysIn(y,mo-1),cap=wd*TOTAL_DESKS;
  const byCo={},byDay={},byRow={};
  desks.forEach(r=>{
    const hrs=bkHours(r),co=r.company||'—';
    (byCo[co]=byCo[co]||{co,desks:0,hours:0,users:new Set(),conf:0,confH:0});byCo[co].desks++;byCo[co].hours+=hrs;byCo[co].users.add(r.email);
    (byDay[r.d]=byDay[r.d]||{d:r.d,desks:0,hours:0});byDay[r.d].desks++;byDay[r.d].hours+=hrs;
    const rl=rowLabel(r.id);(byRow[rl]=byRow[rl]||{row:rl,desks:0,hours:0});byRow[rl].desks++;byRow[rl].hours+=hrs;
  });
  conf.forEach(c=>{const co=c.company||'—';(byCo[co]=byCo[co]||{co,desks:0,hours:0,users:new Set(),conf:0,confH:0});byCo[co].conf++;byCo[co].confH+=bkHours({allDay:false,startTime:c.startTime,endTime:c.endTime});byCo[co].users.add(c.email);});
  return {ym,desks,conf,wd,cap,byCo:Object.values(byCo).sort((a,b)=>b.desks-a.desks||b.conf-a.conf||a.co.localeCompare(b.co)),
    byDay:Object.values(byDay).sort((a,b)=>a.d.localeCompare(b.d)),byRow:Object.values(byRow).sort((a,b)=>a.row.localeCompare(b.row)),
    users:new Set([...desks,...conf].map(r=>r.email)).size,
    deskHours:desks.reduce((s,r)=>s+bkHours(r),0),confHours:conf.reduce((s,r)=>s+bkHours({allDay:false,startTime:r.startTime,endTime:r.endTime}),0)};
}
function fmtH(h){return (Math.round(h*10)/10).toString();}
function renderReport(){
  const inp=document.getElementById('repMonth'),box=document.getElementById('repBody');if(!inp||!box)return;
  if(!inp.value){const n=new Date();inp.value=`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;}
  const R=reportData(inp.value),[y,mo]=inp.value.split('-').map(Number);
  const occ=R.cap?Math.round(R.desks.length/R.cap*1000)/10:0;
  const peak=R.byDay.slice().sort((a,b)=>b.desks-a.desks)[0];
  const kpi=(v,l)=>`<div class="rep-kpi"><b>${v}</b><span>${l}</span></div>`;
  let html=`<div style="font-size:12px;color:var(--gray-600);margin-bottom:10px"><b>${MONTH[mo-1]} ${y}</b> &middot; ${R.wd} working days &middot; capacity ${R.cap} desk-days</div>
  <div class="rep-kpis">
    ${kpi(R.desks.length,'Desk reservations')}
    ${kpi(occ+'%','Average occupancy (Mon-Fri)')}
    ${kpi(fmtH(R.deskHours),'Desk hours booked')}
    ${kpi(R.users,'Unique users')}
    ${kpi(peak?fmtShort(peak.d)+' ('+peak.desks+')':'—','Busiest day')}
    ${kpi(R.conf.length+' / '+fmtH(R.confHours)+' h','Conference room bookings / hours')}
  </div>`;
  if(!R.desks.length&&!R.conf.length){box.innerHTML=html+'<div class="tbl-empty">No reservations in this month</div>';return;}
  const tbl=(head,rows)=>`<table class="rep-tbl"><thead><tr>${head.map((h,i)=>`<th class="${i?'n':''}">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map((c,i)=>`<td class="${i?'n':''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const coRows=R.byCo.map(c=>{const col=coColor(c.co);return [`${coLogo(c.co)?logoImg(c.co,16).replace('style="','style="vertical-align:middle;margin-right:6px;'):`<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${col};margin-right:6px"></span>`}${x(c.co)}`,c.desks,fmtH(c.hours),c.users.size,c.conf];});
  const dayRows=R.byDay.map(d=>[fmtShort(d.d),d.desks,Math.round(d.desks/TOTAL_DESKS*100)+'%',fmtH(d.hours)]);
  const rowRows=R.byRow.map(r=>[r.row,r.desks,fmtH(r.hours)]);
  html+=`<div class="rep-grid">
    <div><div class="rep-h">By company</div>${tbl(['Company','Desk-days','Hours','Users','Conf.'],coRows)}</div>
    <div><div class="rep-h">By day</div>${tbl(['Day','Desks','Occupancy','Hours'],dayRows)}</div>
    <div><div class="rep-h">By row</div>${tbl(['Row','Desk-days','Hours'],rowRows)}</div>
  </div>`;
  box.innerHTML=html;
}
function csvCell(v){v=String(v==null?'':v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}
function reportCsv(){
  const ym=document.getElementById('repMonth')?.value;if(!ym)return;
  const R=reportData(ym),rows=[['Type','Date','Desk','Name','Email','Company','Start','End','Hours']];
  R.desks.sort((a,b)=>a.d.localeCompare(b.d)||a.id.localeCompare(b.id)).forEach(r=>rows.push(['Desk',r.d,r.id,r.name,r.email,r.company,r.allDay?'07:00':r.startTime,r.allDay?'18:00':r.endTime,fmtH(bkHours(r))]));
  R.conf.sort((a,b)=>a.d.localeCompare(b.d)||tF(a.startTime)-tF(b.startTime)).forEach(r=>rows.push(['Conference',r.d,'CONF',r.name,r.email,r.company,r.startTime,r.endTime,fmtH(bkHours({allDay:false,startTime:r.startTime,endTime:r.endTime}))]));
  const blob=new Blob(['\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`MezSpace_report_${ym}.csv`;document.body.appendChild(a);a.click();a.remove();
}

// ══════════════════════════════════════════════════════════
//   AUTHORIZED COMPANIES, EMAILS & LOGOS (admin)
// ══════════════════════════════════════════════════════════
let _logoTarget=null;
function initDirAdmin(){
  document.getElementById('btnAddEmail')?.addEventListener('click',addDirEmail);
  document.getElementById('dirEmail')?.addEventListener('keydown',e=>{if(e.key==='Enter')addDirEmail();});
  document.getElementById('btnImport')?.addEventListener('click',importDir);
  document.getElementById('dirEmailSearch')?.addEventListener('input',renderDirEmails);
  document.getElementById('btnAddCo')?.addEventListener('click',addDirCompany);
  document.getElementById('btnResetDir')?.addEventListener('click',()=>{
    if(!confirm('Reset the demo list of companies, emails and logos in this browser?'))return;
    localStorage.removeItem(DIR_KEY);location.reload();
  });
  const f=document.getElementById('logoFile');
  f?.addEventListener('change',()=>{const file=f.files[0];f.value='';if(file&&_logoTarget)readLogo(file,_logoTarget);});
}
function fillCoSelect(sel,keep){
  if(!sel)return;const v=keep?sel.value:'';
  sel.innerHTML='<option value="">Company…</option>'+COMPANY_NAMES.map(n=>`<option value="${x(n)}">${x(n)}</option>`).join('');
  if(v&&COMPANIES[v])sel.value=v;
}
function renderDirAdmin(){
  fillCoSelect(document.getElementById('dirEmailCo'),true);
  renderDirEmails();renderDirCompanies();
  const cnt=document.getElementById('dirCount');
  if(cnt)cnt.textContent=`${Object.keys(DIR.emails).length} emails · ${COMPANY_NAMES.length} companies · ${Object.keys(DIR.logos).length} logos`;
}
function renderDirEmails(){
  const box=document.getElementById('dirEmailList');if(!box)return;
  const q=(document.getElementById('dirEmailSearch')?.value||'').toLowerCase();
  const rows=Object.entries(DIR.emails).filter(([e,c])=>!q||e.includes(q)||c.toLowerCase().includes(q)).sort((a,b)=>a[1].localeCompare(b[1])||a[0].localeCompare(b[0]));
  box.innerHTML=rows.length?rows.map(([e,c])=>`<div class="dir-row">
      ${coLogo(c)?logoImg(c,18):`<span class="dir-dot" style="background:${coColor(c)}"></span>`}
      <div class="dir-main"><div class="dir-name">${x(e)}</div><div class="dir-sub">${x(c)}${COMPANIES[c]?'':' (company removed)'}</div></div>
      <button class="dir-btn danger" onclick="delDirEmail('${encodeURIComponent(e)}')">Remove</button></div>`).join('')
    :'<div class="tbl-empty">No authorized emails</div>';
}
function renderDirCompanies(){
  const box=document.getElementById('dirCoList');if(!box)return;
  const count={};Object.values(DIR.emails).forEach(c=>{count[c]=(count[c]||0)+1;});
  box.innerHTML=COMPANY_NAMES.map(n=>{const k=encodeURIComponent(n),lg=coLogo(n);return `<div class="dir-row">
      ${lg?logoImg(n,26):`<span class="dir-logo-empty" style="border-color:${coColor(n)};color:${coColor(n)}">${x(initials(n))}</span>`}
      <div class="dir-main"><div class="dir-name">${x(n)}</div><div class="dir-sub">${count[n]||0} email${(count[n]||0)===1?'':'s'} · ${lg?'logo loaded':'no logo yet (uses color)'}</div></div>
      <button class="dir-btn" onclick="pickLogo('${k}')">${lg?'Change logo':'Upload logo'}</button>
      ${lg?`<button class="dir-btn" onclick="delLogo('${k}')">Remove logo</button>`:''}
      <button class="dir-btn danger" onclick="delDirCompany('${k}')">Delete</button></div>`;}).join('');
}
function addDirEmail(){
  const eEl=document.getElementById('dirEmail'),cEl=document.getElementById('dirEmailCo');
  const e=normEmail(eEl?.value),c=cEl?.value||'';
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)){toast('Enter a valid email','err');eEl?.focus();return;}
  if(!c){toast('Select the company for this email','err');cEl?.focus();return;}
  const was=DIR.emails[e];DIR.emails[e]=c;if(!saveDir())return;
  eEl.value='';toast(was?`Email updated · ${c}`:`Email authorized · ${c}`,'ok');renderDirAdmin();
}
function delDirEmail(k){const e=decodeURIComponent(k);if(!confirm(`Remove ${e} from the authorized list?`))return;delete DIR.emails[e];saveDir();toast('Email removed','info');renderDirAdmin();}
function importDir(){
  const ta=document.getElementById('dirImport');if(!ta)return;
  const lower={};COMPANY_NAMES.forEach(n=>lower[n.toLowerCase()]=n);
  let ok=0,bad=[];
  ta.value.split(/\r?\n/).map(l=>l.trim()).filter(Boolean).forEach(l=>{
    const [e,...rest]=l.split(/[,;\t]/);const em=normEmail(e),co=lower[(rest.join(',')||'').trim().toLowerCase()];
    if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)&&co){DIR.emails[em]=co;ok++;}else bad.push(l);
  });
  if(!saveDir())return;
  ta.value=bad.join('\n');
  toast(`${ok} email${ok===1?'':'s'} imported`+(bad.length?` · ${bad.length} line${bad.length===1?'':'s'} not recognized (left in the box)`:''),bad.length?'err':'ok');
  renderDirAdmin();
}
function addDirCompany(){
  const nEl=document.getElementById('dirCoName'),cEl=document.getElementById('dirCoColor');
  const n=(nEl?.value||'').trim();
  if(!n){toast('Enter the company name','err');nEl?.focus();return;}
  if(COMPANY_NAMES.some(c=>c.toLowerCase()===n.toLowerCase())){toast('That company already exists','err');return;}
  const col=(cEl?.value||'#2C5FD4').toUpperCase();
  DIR.extra[n]=col;DIR.removed=DIR.removed.filter(r=>r!==n);COMPANIES[n]=col;
  COMPANY_NAMES.push(n);COMPANY_NAMES.sort((a,b)=>a.localeCompare(b));
  if(!saveDir())return;nEl.value='';toast(`Company added · ${n}. You can now upload its logo.`,'ok');renderDirAdmin();
}
function delDirCompany(k){
  const n=decodeURIComponent(k);const emails=Object.keys(DIR.emails).filter(e=>DIR.emails[e]===n);
  if(!confirm(`Delete ${n}?`+(emails.length?` Its ${emails.length} authorized email(s) will also be removed.`:'')+' Existing reservations are kept.'))return;
  emails.forEach(e=>delete DIR.emails[e]);delete DIR.logos[n];
  if(DIR.extra[n])delete DIR.extra[n];else if(!DIR.removed.includes(n))DIR.removed.push(n);
  delete COMPANIES[n];const i=COMPANY_NAMES.indexOf(n);if(i>=0)COMPANY_NAMES.splice(i,1);
  saveDir();toast(`${n} deleted`,'info');renderDirAdmin();
}
function pickLogo(k){_logoTarget=decodeURIComponent(k);document.getElementById('logoFile')?.click();}
function delLogo(k){const n=decodeURIComponent(k);delete DIR.logos[n];saveDir();toast('Logo removed','info');renderDirAdmin();renderReport();}
function readLogo(file,name){
  if(!file.type.startsWith('image/')){toast('Choose an image file (PNG, JPG or SVG)','err');return;}
  const fr=new FileReader();
  fr.onload=()=>{const img=new Image();img.onload=()=>{
    const M=160,sc=Math.min(1,M/Math.max(img.width,img.height));
    const cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(img.width*sc));cv.height=Math.max(1,Math.round(img.height*sc));
    cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
    DIR.logos[name]=cv.toDataURL('image/png');
    if(!saveDir()){delete DIR.logos[name];return;}
    toast(`Logo saved for ${name}`,'ok');renderDirAdmin();renderReport();
  };img.onerror=()=>toast('Could not read that image','err');img.src=fr.result;};
  fr.readAsDataURL(file);
}

function x(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

// ── Boot ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',()=>{
  loadDir();
  if(document.getElementById('floorPlan'))initEmployee();
  if(document.getElementById('pinScreen')){loadBk();document.getElementById('pinInput')?.focus();document.getElementById('pinInput')?.addEventListener('keydown',e=>{if(e.key==='Enter')checkPin();});}
});