// ═══════════════════════════════════════════════════════
//  ESTADO Y PERSISTENCIA
// ═══════════════════════════════════════════════════════
// Capturar token de Google Drive inmediatamente al cargar
(function() {
  const h = window.location.hash || '';
  if (h.includes('access_token')) {
    // Eliminar el # inicial y parsear
    const params = new URLSearchParams(h.substring(1));
    const tok = params.get('access_token');
    if (tok) {
      localStorage.setItem('gpgt_drive_token', tok);
      localStorage.setItem('gpgt_drive_pending', '1');
      history.replaceState(null, '', window.location.pathname);
    }
  }
})();

const LS = 'gpgt_v3';

let S = {
biz: { name:'Mi Negocio', sub:'', phone:'', addr:'', email:'', footer:'Cotización válida por 15 días.', emoji:'📦', logoData:'' },
products: [
{ id:1, name:'Thinner Laca', presentation:'Galón', unitLabel:'galón', unitSize:1,  basePrice:52.00 },
{ id:2, name:'Thinner Laca', presentation:'Tonel', unitLabel:'galón', unitSize:55, basePrice:52.00 },
{ id:3, name:'Agua pura',    presentation:'Litro', unitLabel:'litro', unitSize:1,  basePrice:5.00  },
],
nextPid: 4,
clients: [
{ id:1, name:'Juan García', phone:'5001-1234', address:'Zona 1, Guatemala' },
{ id:2, name:'María López', phone:'5002-5678', address:'Zona 10, Guatemala' },
],
nextCid: 3,
cp: {
1:{ 1:52.00, 2:52.00, 3:5.00 },
2:{ 1:50.00, 2:50.00, 3:4.50 },
},
orders: [],
nextOid: 1,
categories: [],
nextDeptId: 1,
municipios: [],
  rutasCliente: [],
nextMunId: 1,
  nextRutaClienteId: 1,
lastBk: null,
};

let ordItems    = [{ pid:'', qty:1, price:null }];
let ordComments = [''];
let ordConditions = [];
let _duplicatingFrom = null;
let _duplicatingData = null;
let _isDuplicateSession = false;
let editingOid  = null;
let ordBonusLines = []; // bonificaciones del pedido en edición

function load() {
try {
// Intentar clave actual
let d = localStorage.getItem(LS);
// Migrar desde versiones anteriores si no hay datos nuevos
if (!d) {
for (const old of ['gpgt_v2','gpgt_v1','gestorpedidos_gt_v1']) {
const prev = localStorage.getItem(old);
if (prev) { d = prev; localStorage.setItem(LS, prev); localStorage.removeItem(old); break; }
}
}
if (d) S = JSON.parse(d);
} catch(e) {}
// Garantizar campos nuevos en datos antiguos
if (!S.biz) S.biz = { name:'Mi Negocio', sub:'', phone:'', addr:'', email:'', footer:'Cotización válida por 15 días.', emoji:'📦', logoData:'' };
if (!S.biz.emoji)    S.biz.emoji    = '📦';
if (!S.biz.logoData) S.biz.logoData = '';
if (!S.biz.footer)   S.biz.footer   = 'Cotización válida por 15 días.';
if (!S.savedConditions) S.savedConditions = [];
if (!S.cp)           S.cp           = {};
if (!S.nextOid)      S.nextOid      = (S.orders ? S.orders.length : 0) + 1;
if (!S.depts)   S.depts   = [];
if (!S.nextDeptId)    S.nextDeptId    = (S.depts.length ? Math.max(...S.depts.map(c=>c.id)) + 1 : 1);
if (!S.municipios)    S.municipios    = [];
if (!S.nextMunId)     S.nextMunId     = (S.municipios.length ? Math.max(...S.municipios.map(m=>m.id)) + 1 : 1);
if (!S.nextRutaClienteId) S.nextRutaClienteId = ((S.rutasCliente||[]).length ? Math.max(...S.rutasCliente.map(r=>r.id)) + 1 : 1);
// Migrar routeId de clientes a deptId si existía antes
if (S.clients) S.clients.forEach(c => { if (c.routeId && !c.deptId) { c.deptId = c.routeId; delete c.routeId; } });
if (S.products) S.products.forEach(p => {
if (!p.unitLabel) p.unitLabel = 'unidad';
if (!p.unitSize)  p.unitSize  = 1;
});
// Migrar familias y prioridades ya usadas en texto libre a las listas maestras de Configuración
if (!S.familyList) {
  S.familyList = [...new Set((S.products||[]).map(p=>(p.family||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
}
if (!S.priorityList) {
  S.priorityList = [...new Set((S.clients||[]).map(c=>(c.priority||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
}
// Migrar priorityList de lista de textos a lista de objetos {name, color}, para poder asignar un color a cada prioridad
if (S.priorityList.length && typeof S.priorityList[0] === 'string') {
  const defaultPalette = ['#ef4444','#f59e0b','#10b981','#3b82f6','#a855f7','#ec4899','#14b8a6','#84cc16'];
  S.priorityList = S.priorityList.map((name, i) => ({ name, color: defaultPalette[i % defaultPalette.length] }));
}
// Migrar rutaId (uno solo) / deptId (uno solo) a rutaIds / deptIds (listas), permitiendo múltiples padres
(S.depts||[]).forEach(d => {
  if (!d.rutaIds) {
    d.rutaIds = d.rutaId ? [d.rutaId] : [];
    delete d.rutaId;
  }
});
(S.municipios||[]).forEach(m => {
  if (!m.deptIds) {
    m.deptIds = m.deptId ? [m.deptId] : [];
    delete m.deptId;
  }
});
}

let _driveSyncTimer = null;
function save() {
  try { localStorage.setItem(LS, JSON.stringify(S)); } catch(e) {}
  // Sincronizar con Drive con debounce de 5 segundos
  if (_driveSyncTimer) clearTimeout(_driveSyncTimer);
  _driveSyncTimer = setTimeout(() => {
    if (typeof driveSaveBackup === 'function' && _driveToken) driveSaveBackup(false);
  }, 5000);
  // Sincronizar clientes con Google Sheets, mismo patrón de espera
  if (_sheetsSyncTimer) clearTimeout(_sheetsSyncTimer);
  _sheetsSyncTimer = setTimeout(() => {
    if (typeof syncClientsToSheets === 'function' && _driveToken) syncClientsToSheets(false);
  }, 5000);
}

// Genera un ID único basado en el momento exacto de creación (en vez de un contador simple).
// Esto evita que dos dispositivos que crean un registro nuevo al mismo tiempo, sin haberse
// sincronizado todavía, terminen usando el mismo número de ID por coincidencia.
function genId() {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}


// ═══════════════════════════════════════════════════════
//  UTILIDADES
// ═══════════════════════════════════════════════════════
function fmtEntrega(val) {
  if (!val) return '';
  // YYYY-MM-DD → dd/mm/yyyy
  if (val.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [y,m,d] = val.split('-');
    return `${d}/${m}/${y}`;
  }
  // d/m/yyyy → dd/mm/yyyy
  if (val.includes('/')) {
    const parts = val.split(',')[0].split('/');
    if (parts.length === 3) {
      return `${parts[0].padStart(2,'0')}/${parts[1].padStart(2,'0')}/${parts[2].trim()}`;
    }
  }
  return val;
}

// Formatear fecha de pedido (d/m/yyyy,... → dd/mm/yyyy)
function fmtOrdDate(dateStr) {
  if (!dateStr) return '';
  const raw = String(dateStr).split(',')[0].trim();
  const parts = raw.split('/');
  if (parts.length === 3) {
    return `${parts[0].padStart(2,'0')}/${parts[1].padStart(2,'0')}/${parts[2].trim()}`;
  }
  return raw;
}

// ── Calendario de rango de fechas ────────────────────────────────
let _drpFrom = null, _drpTo = null, _drpStep = 'from'; // 'from' o 'to'
let _drpViewYear, _drpViewMonth;

function toggleDateRangePicker() {
  const picker = document.getElementById('date-range-picker');
  if (picker.style.display === 'none') {
    const now = new Date();
    _drpViewYear  = now.getFullYear();
    _drpViewMonth = now.getMonth();
    renderDrpCalendar();
    picker.style.display = 'block';
    setTimeout(() => document.addEventListener('click', closeDrpOutside), 100);
  } else {
    picker.style.display = 'none';
    document.removeEventListener('click', closeDrpOutside);
  }
}

function closeDrpOutside(e) {
  const picker = document.getElementById('date-range-picker');
  const inp    = document.getElementById('date-range-display');
  if (picker && !picker.contains(e.target) && e.target !== inp) {
    picker.style.display = 'none';
    document.removeEventListener('click', closeDrpOutside);
  }
}

function drpSelectDay(ds) {
  if (_drpStep === 'from') {
    _drpFrom = ds; _drpTo = null; _drpStep = 'to';
    renderDrpCalendar();
  } else {
    if (ds < _drpFrom) { _drpTo = _drpFrom; _drpFrom = ds; }
    else _drpTo = ds;
    _drpStep = 'from';
    applyDateRange();
  }
}

function renderDrpCalendar() {
  const cal = document.getElementById('drp-calendar');
  const state = document.getElementById('drp-state');
  if (!cal) return;

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const DIAS  = ['D','L','M','X','J','V','S'];
  const y = _drpViewYear, m = _drpViewMonth;
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m+1, 0).getDate();

  const pad = n => String(n).padStart(2,'0');
  const toStr = d => `${y}-${pad(m+1)}-${pad(d)}`;

  state.textContent = _drpStep === 'from' ? 'Selecciona fecha inicio' :
    `Inicio: ${fmtEntrega(_drpFrom)} — Selecciona fecha fin`;
  state.style.color = _drpStep === 'from' ? '#f59e0b' : '#60a5fa';

  let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <button onclick="drpPrevMonth()" style="background:none;border:none;color:#f1f5f9;font-size:16px;cursor:pointer;padding:4px 8px">‹</button>
    <span style="font-size:13px;font-weight:700;color:#f1f5f9">${MESES[m]} ${y}</span>
    <button onclick="drpNextMonth()" style="background:none;border:none;color:#f1f5f9;font-size:16px;cursor:pointer;padding:4px 8px">›</button>
  </div>
  <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center">`;

  DIAS.forEach(d => { html += `<div style="font-size:10px;color:#64748b;padding:2px">${d}</div>`; });

  for (let i = 0; i < firstDay; i++) html += '<div></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const ds = toStr(d);
    const isFrom = ds === _drpFrom;
    const isTo   = ds === _drpTo;
    const inRange = _drpFrom && _drpTo && ds > _drpFrom && ds < _drpTo;
    const todayNow = new Date(); const todayDsNow = `${todayNow.getFullYear()}-${String(todayNow.getMonth()+1).padStart(2,'0')}-${String(todayNow.getDate()).padStart(2,'0')}`;
    const isToday = ds === todayDsNow;
    const bg = isFrom||isTo ? '#f59e0b' : inRange ? '#2a3050' : 'transparent';
    const color = isFrom||isTo ? '#000' : isToday ? '#f59e0b' : '#f1f5f9';
    const fw = isFrom||isTo||isToday ? '700' : '400';
    const brd = isToday&&!isFrom&&!isTo ? '1px solid #f59e0b' : 'none';
    html += `<div onclick="drpSelectDay('${ds}')" style="padding:5px 2px;border-radius:5px;cursor:pointer;background:${bg};color:${color};font-size:12px;font-weight:${fw};border:${brd}">${d}</div>`;
  }

  html += '</div>';
  cal.innerHTML = html;
}

function drpPrevMonth() {
  if (_drpViewMonth === 0) { _drpViewMonth = 11; _drpViewYear--; }
  else _drpViewMonth--;
  renderDrpCalendar();
}
function drpNextMonth() {
  if (_drpViewMonth === 11) { _drpViewMonth = 0; _drpViewYear++; }
  else _drpViewMonth++;
  renderDrpCalendar();
}

function applyDateRange() {
  const fi = document.getElementById('f-date-from');
  const ti = document.getElementById('f-date-to');
  const disp = document.getElementById('date-range-display');
  if (fi) fi.value = _drpFrom || '';
  if (ti) ti.value = _drpTo   || '';
  if (disp) disp.value = _drpFrom && _drpTo
    ? `${fmtEntrega(_drpFrom)} → ${fmtEntrega(_drpTo)}`
    : _drpFrom ? fmtEntrega(_drpFrom) : '';
  renderList();
  if (_drpFrom && _drpTo) {
    document.getElementById('date-range-picker').style.display = 'none';
    document.removeEventListener('click', closeDrpOutside);
  }
}

function setDateRangePreset(preset) {
  const today = new Date();
  const pad = n => String(n).padStart(2,'0');
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  if (preset === 'hoy') { _drpFrom = fmt(today); _drpTo = fmt(today); }
  else if (preset === 'semana') {
    const s = new Date(today); s.setDate(today.getDate() - today.getDay());
    _drpFrom = fmt(s); _drpTo = fmt(today);
  } else if (preset === 'mes') {
    const s = new Date(today.getFullYear(), today.getMonth(), 1);
    _drpFrom = fmt(s); _drpTo = fmt(today);
  } else if (preset === 'mes_ant') {
    const s = new Date(today.getFullYear(), today.getMonth()-1, 1);
    const e = new Date(today.getFullYear(), today.getMonth(), 0);
    _drpFrom = fmt(s); _drpTo = fmt(e);
  }
  _drpStep = 'from';
  applyDateRange();
  renderDrpCalendar();
  document.getElementById('date-range-picker').style.display = 'none';
}

function clearDateRange() {
  _drpFrom = null; _drpTo = null; _drpStep = 'from';
  const fi = document.getElementById('f-date-from');
  const ti = document.getElementById('f-date-to');
  const disp = document.getElementById('date-range-display');
  if (fi) fi.value = '';
  if (ti) ti.value = '';
  if (disp) disp.value = '';
  renderList();
  document.getElementById('date-range-picker').style.display = 'none';
}

function clientNameColor(o) {
  if (isOrderBlocked(o)) return '#a855f7';
  const status = o && o.status;
  if (status === 'Confirmado') return '#60a5fa';
  if (status === 'Concluido')  return '#4ade80';
  return '#f1f5f9'; // Cotización = blanco
}

function ordDateTs(o) {
  // Parsear fecha del pedido en formato "d/m/yyyy, ..." o "d/m/yyyy"
  const raw = (o.date||'').split(',')[0].trim();
  const parts = raw.split('/');
  if (parts.length === 3) {
    const d = parseInt(parts[0]), m = parseInt(parts[1]), y = parseInt(parts[2]);
    return new Date(y, m-1, d).getTime();
  }
  return 0;
}

// Un pedido está "bloqueado" si su fecha de pedido está configurada después de la fecha real de hoy

// Regla única para decidir si un pedido puede avanzar de estado (a "Confirmado" o a "Concluido").
// Centraliza aquí cualquier condición nueva que se agregue a futuro,
// para que los 5 puntos donde se puede avanzar un pedido (switch, ciclo de
// estado, y los 3 gestos de deslizar) usen siempre la misma regla.

// Muestra el aviso correspondiente cuando canConfirmOrder() rechaza un pedido

function goEditOrderAndFocusDate(id) {
  const modal = document.getElementById('confirm-modal');
  if (modal) modal.style.display = 'none';
  startEditOrder(id);
  setTimeout(() => {
    const dateInp = document.getElementById('ord-date');
    if (dateInp) {
      dateInp.focus();
      if (typeof dateInp.showPicker === 'function') {
        try { dateInp.showPicker(); } catch(e) {}
      }
    }
  }, 250);
}

function showOrderBlockedAlert(oid) {
  const modal = document.getElementById('confirm-modal');
  const inner = modal.querySelector('div');
  inner.innerHTML = `
    <div style="font-size:28px;margin-bottom:8px">🔒</div>
    <div style="font-size:15px;font-weight:700;color:#f1f5f9;margin-bottom:6px">Pedido bloqueado</div>
    <div style="font-size:12px;color:#94a3b8;margin-bottom:18px">Actualiza la fecha o espera a que esta se cumpla.</div>
    <div style="display:flex;gap:10px">
      <button onclick="document.getElementById('confirm-modal').style.display='none'" style="flex:1;padding:10px;border-radius:9px;border:1px solid #475569;background:transparent;color:#f1f5f9;font-weight:700;cursor:pointer;font-size:13px">Cancelar</button>
      <button onclick="goEditOrderAndFocusDate(${oid})" style="flex:1;padding:10px;border-radius:9px;border:none;background:#a855f7;color:#fff;font-weight:800;cursor:pointer;font-size:13px">📅 Actualizar fecha</button>
    </div>`;
  modal.style.display = 'flex';
}

function Q(n) {
return 'Q' + Number(n||0).toLocaleString('es-GT', { minimumFractionDigits:2, maximumFractionDigits:2 });
}

function cliPrice(cid, pid, base) {
const cp = S.cp[cid] || S.cp[String(cid)];
if (cp && cp[pid] != null)        return cp[pid];
if (cp && cp[String(pid)] != null) return cp[String(pid)];
return base;
}

function lineTotal(cid, pid, qty, customPrice) {
const p = S.products.find(x => x.id === Number(pid));
if (!p) return 0;
const pr = (customPrice != null) ? customPrice : cliPrice(cid, p.id, p.basePrice);
return pr * (Number(p.unitSize)||1) * Number(qty);
}

function orderTotal(items, cid) {
return items.reduce((s, it) => s + lineTotal(cid, it.productId||it.pid, it.qty, it.customPrice != null ? it.customPrice : null), 0);
}

function toast(msg, col) {
const t = document.getElementById('toast');
t.textContent = msg;
t.style.background = col || '#10b981';
t.classList.add('show');
setTimeout(() => t.classList.remove('show'), 2600);
}


// ═══════════════════════════════════════════════════════
//  PROSPECTOS (clientes potenciales)
// ═══════════════════════════════════════════════════════







function goTab(name, _fromPop) {
// 'bizinfo' y 'backup' viven ahora dentro de Configuración: redirigir y abrir su tarjeta
if (name === 'bizinfo' || name === 'backup') {
  window._configMainOpenKey = name;
  name = 'config';
}
document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
document.querySelectorAll('#nav button').forEach(b => b.classList.remove('active'));
const pageEl = document.getElementById('page-'+name);
if (pageEl) pageEl.classList.add('active');
// Nuevo orden del nav: list, clients, products, routes, prospects, quotes
const tabs = ['list','clients','products','routes','prospects','quotes'];
const idx  = tabs.indexOf(name);
if (idx >= 0) {
  const btns = document.querySelectorAll('#nav button');
  if (btns[idx]) btns[idx].classList.add('active');
}
if (name==='order')    renderOrderPage();
if (name==='list')     renderList();
if (name==='clients')  { renderClients(); renderDeptList(); renderMunList(); }
if (name==='products') { renderProducts(); renderPriceLists(); }
if (name==='routes')   renderRoutes();
if (name==='prospects') renderProspects();
if (name==='quotes')    renderQuotesList();
if (name==='config')    renderConfig();
// Registrar en el historial del navegador para el botón Atrás de Android
if (!_fromPop) {
  _currentTab = name;
  if (_navHistory[_navHistory.length - 1] !== name) {
    _navHistory.push(name);
    if (_navHistory.length > 20) _navHistory.shift();
  }
  history.pushState({ tab: name }, '', '#' + name);
}
}

// Botón Atrás de Android — usando hash para que Chrome registre el historial
var _currentTab = 'list';
var _navHistory = ['list'];

window.addEventListener('popstate', function(e) {
  if (_navHistory.length > 1) {
    _navHistory.pop();
    var prev = _navHistory[_navHistory.length - 1];
    _currentTab = prev;
    goTab(prev, true);
  } else {
    // Al límite: re-push para no salir
    history.pushState({ tab: _currentTab }, '', '#' + _currentTab);
  }
});

// Estado inicial
history.replaceState({ tab: 'list' }, '', '#list');





// ── Trasladado desde el bloque "MODAL DE CONFIRMACIÓN" (mal etiquetado) ──
let _confirmCb = null;
function askConfirm(msg, sub, cb, btnText, btnColor, icon) {
  const inner = document.querySelector('#confirm-modal > div');
  if (inner && !document.getElementById('confirm-msg')) {
    inner.innerHTML = `
      <div id="confirm-icon" style="font-size:28px;margin-bottom:8px">🗑</div>
      <div id="confirm-msg" style="font-size:15px;font-weight:700;color:#f1f5f9;margin-bottom:6px"></div>
      <div id="confirm-sub" style="font-size:12px;color:#94a3b8;margin-bottom:18px"></div>
      <div style="display:flex;gap:10px">
        <button onclick="confirmDel(false)" style="flex:1;padding:10px;border-radius:9px;border:1px solid #475569;background:transparent;color:#f1f5f9;font-weight:700;cursor:pointer;font-size:14px">Cancelar</button>
        <button id="confirm-ok-btn" onclick="confirmDel(true)" style="flex:1;padding:10px;border-radius:9px;border:none;background:#ef4444;color:#fff;font-weight:800;cursor:pointer;font-size:14px">Eliminar</button>
      </div>`;
  }
  document.getElementById('confirm-msg').textContent = msg;
  document.getElementById('confirm-sub').textContent = sub || '';
  const btn = document.getElementById('confirm-ok-btn');
  if (btn) { btn.textContent = btnText || 'Eliminar'; btn.style.background = btnColor || '#ef4444'; }
  const iconEl = document.getElementById('confirm-icon');
  if (iconEl) iconEl.textContent = icon || '🗑';
  document.getElementById('confirm-modal').style.display = 'flex';
  _confirmCb = cb;
}

function bonusAlertConfirm() { if (window._bonusAlertConfirmCb) window._bonusAlertConfirmCb(); window._bonusAlertConfirmCb=null; window._bonusAlertCancelCb=null; }
function bonusAlertCancel()  { if (window._bonusAlertCancelCb)  window._bonusAlertCancelCb();  window._bonusAlertConfirmCb=null; window._bonusAlertCancelCb=null; }

function bonusAlertCancel()  { if (window._bonusAlertCancelCb)  window._bonusAlertCancelCb();  window._bonusAlertConfirmCb=null; window._bonusAlertCancelCb=null; }


function confirmDel(yes) {
  document.getElementById('confirm-modal').style.display = 'none';
  const btn = document.getElementById('confirm-ok-btn');
  if (btn) { btn.style.background='#ef4444'; btn.textContent='Eliminar'; }
  if (yes && _confirmCb) _confirmCb();
  _confirmCb = null;
  window._bonusOnCancel = null;
}


// ── Especificaciones de producto (peso/SKU por variante) ───────────────
// Cada producto puede tener varias "especificaciones" (antes solo tenía un
// campo de Presentación y un Peso). Cada especificación tiene su propio
// peso y SKU, y puede marcarse activa/inactiva. Esto migra productos
// antiguos (que solo tenían presentation/weightKg sueltos) hacia esa
// estructura la primera vez que se necesitan, sin perder sus datos.
function ensureProductSpecs(p) {
  if (!p) return [];
  if (!p.specs || !Array.isArray(p.specs) || !p.specs.length) {
    p.specs = [{
      id: 1,
      label: p.presentation || '',
      weightKg: p.weightKg != null ? p.weightKg : null,
      sku: '',
      active: true
    }];
  }
  return p.specs;
}

// Mantiene p.presentation / p.weightKg como espejo del producto: si hay una
// sola especificación activa, usa esa; si hay varias, usa la primera activa.
// Esto es solo para que las pantallas que aún muestran esos campos (listas,
// buscadores, autocompletados de productos sin pedido asociado) sigan
// funcionando sin cambios, mostrando un valor representativo.
function syncProductPrimarySpec(p) {
  if (!p) return;
  const specs = p.specs || [];
  const active = specs.filter(s => s.active);
  const primary = active[0] || specs[0] || null;
  p.presentation = primary ? (primary.label || '') : (p.presentation || '');
  p.weightKg = primary ? primary.weightKg : (p.weightKg != null ? p.weightKg : null);
}

// Etiqueta de especificación a mostrar para una línea de pedido: usa la que
// quedó "congelada" en el pedido al momento de venderse (it.specLabel); si
// el pedido es de antes de que existiera esto, cae al valor actual del
// producto (comportamiento igual al de siempre).
function itemSpecLabel(it, p) {
  if (it && it.specLabel) return it.specLabel;
  return p ? (p.presentation || '') : '';
}

// ── Modo SAP: cálculo compartido para mostrar un pedido convertido ─────
// Un pedido marcado o.sapMode=true guarda sus datos reales intactos
// (cantidad, precio con IVA, unidad de venta normal) — esta función NO
// modifica nada, solo calcula, para mostrar, la cantidad y precio como se
// deben capturar en SAP: en kilos + precio por kg sin IVA cuando el
// producto está marcado "Se factura por kilo"; en la unidad de venta
// normal + precio sin IVA en caso contrario. El redondeo (truncar hacia
// abajo o normal) usa el que se guardó en el pedido al momento de
// confirmarlo, para que el resultado no cambie si luego cambia la
// preferencia por defecto.
function getSapCalcForOrder(o) {
  if (!o || !o.sapMode) return null;
  const roundMode = o.sapRoundMode || 'floor';
  const roundFn = (n) => roundMode === 'round' ? Math.round(n*100)/100 : Math.floor(n*100)/100;

  function calcLine(p, qty, priceWithIva, weightKgPerQty) {
    if (!p || !qty || priceWithIva == null) return null;
    const unitSize = Number(p.unitSize) || 1;
    const totalUnits = Number(qty) * unitSize;
    const lineTotalWithIva = totalUnits * Number(priceWithIva);
    let sapQty, sapUnitLabel;
    if (p.facturaPorKilo) {
      const w = weightKgPerQty != null ? Number(weightKgPerQty) : Number(p.weightKg || 0);
      sapQty = Number(qty) * w;
      sapUnitLabel = 'Kilo';
    } else {
      sapQty = totalUnits;
      sapUnitLabel = p.unitLabel || 'unidad';
    }
    if (!sapQty) return null;
    const sapPriceWithIva = lineTotalWithIva / sapQty;
    const sapPriceNoIva = roundFn(sapPriceWithIva / 1.12);
    const sapLineTotalWithIva = sapQty * sapPriceNoIva * 1.12;
    const sapLineTotalNoIva = sapQty * sapPriceNoIva;
    return { sapQty, sapUnitLabel, sapPriceNoIva, sapLineTotalWithIva, sapLineTotalNoIva };
  }

  const items = (o.items||[]).map(it => {
    const p = S.products.find(x=>x.id===Number(it.productId));
    if (!p) return null;
    ensureProductSpecs(p);
    const spec = p.specs.find(s=>String(s.id)===String(it.specId));
    const r = calcLine(p, it.qty, it.customPrice, spec?spec.weightKg:null);
    if (!r) return null;
    return { ...r, productId: p.id, name: p.name, specLabel: spec?spec.label:(it.specLabel||''), qty: it.qty };
  }).filter(Boolean);

  const bonusLines = (o.bonusLines||[]).map(bl => {
    const p = S.products.find(x=>x.id===Number(bl.productId));
    if (!p) return null;
    ensureProductSpecs(p);
    const activeSpecs = p.specs.filter(s=>s.active);
    const spec = p.specs.find(s=>String(s.id)===String(bl.specId)) || (activeSpecs.length<=1 ? (activeSpecs[0]||p.specs[0]) : null);
    const r = calcLine(p, bl.qty, bl.price, spec?spec.weightKg:null);
    if (!r) return null;
    return { ...r, productId: p.id, name: p.name, specLabel: spec?spec.label:'', qty: bl.qty, ruleName: bl.ruleName, exceptional: bl.exceptional };
  }).filter(Boolean);

  const subtotalSinIva = items.reduce((s,x)=>s+x.sapLineTotalNoIva,0);
  const ivaMonto        = items.reduce((s,x)=>s+(x.sapLineTotalWithIva - x.sapLineTotalNoIva),0);
  const totalConIva     = subtotalSinIva + ivaMonto;

  return { items, bonusLines, subtotalSinIva, ivaMonto, totalConIva };
}
