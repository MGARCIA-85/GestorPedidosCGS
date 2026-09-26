// ═══════════════════════════════════════════════════════
//  CLIENTES
// ═══════════════════════════════════════════════════════
let clientSortMode = 'order';

function sortClients(mode) {
clientSortMode = mode;
if (mode==='alpha')    S.clients.sort((a,b) => a.name.localeCompare(b.name,'es'));
if (mode==='recent')   S.clients.reverse();
if (mode==='priority') S.clients.sort((a,b) => {
  const pa = (a.priority||'').trim(), pb = (b.priority||'').trim();
  const list = S.priorityList || [];
  const ia = pa ? list.findIndex(p => p.name === pa) : -1;
  const ib = pb ? list.findIndex(p => p.name === pb) : -1;
  // Usa la posición configurada en la lista de prioridades (Configuración);
  // sin prioridad o una que ya no está en la lista se manda al final.
  const oa = ia === -1 ? Infinity : ia;
  const ob = ib === -1 ? Infinity : ib;
  return oa - ob;
});
document.getElementById('cli-drag-hint').style.display = mode==='manual' ? 'block' : 'none';
save(); renderClients();
}

function toggleFormPanel(id, header) {
  const body = document.getElementById(id);
  const arrow = header.querySelector('span');
  const open = body.style.display === 'none';
  body.style.display = open ? 'block' : 'none';
  if (arrow) arrow.textContent = open ? '▲' : '▼';
  if (open && id === 'prod-form-body') {
    renderColorPalette('np-color-pal', 'np-color', '');
  }
}

function collapseForm(bodyId) {
  const body = document.getElementById(bodyId);
  if (!body) return;
  body.style.display = 'none';
  // Actualizar flecha del header
  const header = body.previousElementSibling;
  if (header) { const arrow = header.querySelector('span'); if (arrow) arrow.textContent = '▼'; }
}

function ncFieldSearch(type, q) {
  const isDept  = type === 'dept';
  let list      = isDept ? (S.depts||[]) : (S.municipios||[]);
  const dropId  = isDept ? 'nc-dept-drop' : 'nc-mun-drop';
  const hiddenId= isDept ? 'nc-dept-id'   : 'nc-mun-id';
  const col     = isDept ? '#3b82f6' : '#7c3aed';
  const drop    = document.getElementById(dropId);
  if (!drop) return;
  // Cascada: Departamento filtra por Ruta elegida; Sector filtra por Departamento elegido
  if (isDept) {
    const rutaSel = document.getElementById('nc-route-id');
    const rutaId = rutaSel && rutaSel.value ? Number(rutaSel.value) : null;
    if (rutaId) list = list.filter(d => (d.rutaIds||[]).includes(rutaId));
    else { drop.style.display='block'; drop.innerHTML = '<div style="padding:9px 12px;font-size:12px;color:#f59e0b">Selecciona primero una Ruta</div>'; return; }
  } else {
    const deptHidden = document.getElementById('nc-dept-id');
    const deptId = deptHidden && deptHidden.value ? Number(deptHidden.value) : null;
    if (deptId) list = list.filter(m => (m.deptIds||[]).includes(deptId));
    else { drop.style.display='block'; drop.innerHTML = '<div style="padding:9px 12px;font-size:12px;color:#f59e0b">Selecciona primero un Departamento</div>'; return; }
  }
  const ql = (q||'').toLowerCase();
  let filtered = ql ? list.filter(x => x.name.toLowerCase().includes(ql)) : list;
  filtered = [...filtered].sort((a,b)=>a.name.localeCompare(b.name,'es'));
  if (!filtered.length) { drop.style.display='block'; drop.innerHTML = '<div style="padding:9px 12px;font-size:12px;color:#64748b">Sin resultados</div>'; return; }
  drop.style.display = 'block';
  drop.innerHTML = filtered.map(x =>
    `<div onmousedown="event.preventDefault()" onclick="ncSelectField('${type}',${x.id},'${x.name.replace(/'/g,"\\'")}');event.stopPropagation()"
      style="padding:9px 12px;font-size:13px;color:#f1f5f9;cursor:pointer;border-bottom:1px solid #2a3050">
      ${x.name}
    </div>`
  ).join('');
  setTimeout(() => { document.addEventListener('click', () => { drop.style.display = 'none'; }, { once: true }); }, 50);
}

function ncSelectField(type, id, name) {
  const isDept = type === 'dept';
  document.getElementById(isDept ? 'nc-dept-lbl' : 'nc-mun-lbl').value = name;
  document.getElementById(isDept ? 'nc-dept-id'  : 'nc-mun-id').value  = id;
  document.getElementById(isDept ? 'nc-dept-drop' : 'nc-mun-drop').style.display = 'none';
  // Cascada: si cambia el Departamento, limpiar el Sector elegido
  if (isDept) {
    const munLbl = document.getElementById('nc-mun-lbl');
    const munHid = document.getElementById('nc-mun-id');
    if (munLbl) munLbl.value = '';
    if (munHid) munHid.value = '';
  }
}

function clearNcDeptSector() {
  const deptLbl = document.getElementById('nc-dept-lbl');
  const deptHid = document.getElementById('nc-dept-id');
  const munLbl  = document.getElementById('nc-mun-lbl');
  const munHid  = document.getElementById('nc-mun-id');
  if (deptLbl) deptLbl.value = '';
  if (deptHid) deptHid.value = '';
  if (munLbl) munLbl.value = '';
  if (munHid) munHid.value = '';
}

function refreshNcRouteList() {
  const sel = document.getElementById('nc-route-id');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Sin ruta asignada —</option>';
  [...(S.rutasCliente || [])].sort((a,b)=>a.name.localeCompare(b.name,'es')).forEach(r => {
    const o = document.createElement('option');
    o.value = r.id; o.textContent = r.name;
    sel.appendChild(o);
  });
}

function cancelNewClient() {
  ['nc-n','nc-cid','nc-priority','nc-contact','nc-a','nc-p','nc-dept-lbl','nc-dept-id','nc-mun-lbl','nc-mun-id'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const sel = document.getElementById('nc-route-id'); if (sel) sel.value = '';
  collapseForm('cli-form-body');
}

function addClient() {
  const name = document.getElementById('nc-n').value.trim();
  if (!name) return alert('Ingresa el nombre del cliente.');
  const dup = S.clients.find(c => c.name.toLowerCase() === name.toLowerCase());
  if (dup) { toast('⚠️ Ya existe este cliente', '#ef4444'); return; }
  const isProspect = document.getElementById('nc-type-prospect')?.checked === true;
  const id = genId();
  const deptVal = document.getElementById('nc-dept-id')?.value;
  const munVal  = document.getElementById('nc-mun-id')?.value;
  const newClient = {
    id,
    name,
    clientCode:  document.getElementById('nc-cid')?.value.trim() || '',
    priority:    document.getElementById('nc-priority')?.value.trim() || '',
    contact:     document.getElementById('nc-contact')?.value.trim() || '',
    phone:       document.getElementById('nc-p').value.trim(),
    address:     document.getElementById('nc-a').value.trim(),
    deptId:      deptVal  ? Number(deptVal)  : null,
    municipioId: munVal   ? Number(munVal)   : null,
    rutaClienteId: document.getElementById('nc-route-id')?.value ? Number(document.getElementById('nc-route-id').value) : null
  };
  // Un prospecto nace excluido de la generación automática de rutas; un cliente normal nace incluido
  if (isProspect) { newClient.isProspect = true; }
  S.clients.push(newClient);
  if (newClient.address) syncPrincipalAddressFromField(id, newClient.address);
  const init = {}; S.products.forEach(p => { init[p.id] = p.basePrice; });
  S.cp[id] = init;
  save();
  ['nc-n','nc-cid','nc-priority','nc-contact','nc-p','nc-a','nc-dept-lbl','nc-mun-lbl','nc-dept-id','nc-mun-id'].forEach(i => {
    const el = document.getElementById(i); if (el) el.value = '';
  });
  const typeClientEl = document.getElementById('nc-type-client');
  if (typeClientEl) typeClientEl.checked = true;
  collapseForm('cli-form-body');
  if (isProspect) {
    toast('🧲 Prospecto agregado');
    goTab('prospects');
  } else {
    toast('👥 Cliente agregado');
    renderClients();
  }
}

// ── Edición masiva de clientes ──────────────────
if (!window._cliSel) window._cliSel = new Set();

function toggleCliSel(id, checked) {
  if (!window._cliSel) window._cliSel = new Set();
  if (checked) window._cliSel.add(id);
  else window._cliSel.delete(id);
  updateCliSelBar();
}

function updateCliSelBar() {
  let bar = document.getElementById('cli-sel-bar');
  const n = (window._cliSel||new Set()).size;
  if (!bar) return;
  const filtersRow = document.getElementById('cli-filters-row');
  if (n === 0) {
    bar.style.display = 'none';
    if (filtersRow) filtersRow.style.display = '';
    const _cp = document.getElementById('page-clients'); if (_cp) _cp.style.paddingTop = '';
    return;
  }
  if (filtersRow) filtersRow.style.display = 'none';
  bar.style.top = _getNavBottom() + 'px';
  bar.style.display = 'flex';
  const cnt = bar.querySelector('#cli-sel-count');
  if (cnt) cnt.textContent = n + ' cliente' + (n!==1?'s':'') + ' seleccionado' + (n!==1?'s':'');
  // Empujar lista para que no quede tapada por la barra
  setTimeout(() => {
    const barH = bar.offsetHeight;
    const page = document.getElementById('page-clients');
    if (page) {
      const oldPad = parseInt(page.style.paddingTop) || 0;
      const barBottom = bar.getBoundingClientRect().bottom;
      const pageTop = page.getBoundingClientRect().top;
      const newPad = Math.max(0, barBottom - pageTop + oldPad);
      if (Math.abs(newPad - oldPad) > 2) {
        const diff = newPad - oldPad;
        page.style.paddingTop = newPad + 'px';
        window.scrollBy(0, diff);
      }
    }
  }, 50);
}

function applyMassCliEdit() {
  const sel = window._cliSel;
  if (!sel || sel.size === 0) return toast('Selecciona al menos un cliente','#f59e0b');
  const rutaVal = document.getElementById('mass-ruta')?.value;
  const deptVal = document.getElementById('mass-dept')?.value;
  const munVal  = document.getElementById('mass-mun')?.value;
  const prioVal = document.getElementById('mass-priority')?.value;
  if (!rutaVal && !deptVal && !munVal && !prioVal) return toast('Selecciona al menos un campo a asignar','#f59e0b');
  sel.forEach(id => {
    const c = S.clients.find(x=>x.id===id);
    if (!c) return;
    if (rutaVal) c.rutaClienteId = Number(rutaVal);
    if (deptVal) c.deptId = Number(deptVal);
    if (munVal)  c.municipioId = Number(munVal);
    if (prioVal) c.priority = prioVal;
  });
  const count = sel.size;
  save(); renderClients();
  toast('✅ ' + count + ' clientes actualizados');
  window._cliSel = new Set();
  document.querySelectorAll('.cli-chk').forEach(chk => chk.checked = false);
  updateCliSelBar();
}

function clearCliSel() {
  window._cliSel = new Set();
  document.querySelectorAll('.cli-chk').forEach(chk => chk.checked = false);
  updateCliSelBar();
}

function selectAllCliVisible() {
  document.querySelectorAll('.cli-chk').forEach(chk => {
    chk.checked = true;
    window._cliSel.add(Number(chk.dataset.id));
  });
  updateCliSelBar();
}

function toggleCliMonthSec(secId) {
  if (!window._cliSecOpen) window._cliSecOpen = {};
  const el = document.getElementById(secId);
  const arrow = document.getElementById(secId+'-arrow');
  const isOpen = el && el.style.display !== 'none';
  const opening = !isOpen;

  if (opening) {
    // Extraer cid del secId: cso-month-{cid}-{key}
    const parts = secId.split('-');
    const cid = parts[2];
    // Colapsar todos los demás meses del mismo cliente
    document.querySelectorAll(`[id^="cso-month-${cid}-"]`).forEach(monthEl => {
      if (monthEl.id !== secId) {
        monthEl.style.display = 'none';
        monthEl.style.opacity = '1';
        window._cliSecOpen[monthEl.id] = false;
        const a = document.getElementById(monthEl.id + '-arrow');
        if (a) a.textContent = '▼';
      }
    });
    // Opacidad en encabezados de meses no abiertos
    setTimeout(() => {
      document.querySelectorAll(`[id^="cso-month-${cid}-"]`).forEach(monthEl => {
        const header = monthEl.previousElementSibling;
        if (header) header.style.opacity = monthEl.id === secId ? '1' : '0.4';
      });
    }, 30);
  } else {
    // Al cerrar, restaurar opacidad de todos
    const parts = secId.split('-');
    const cid = parts[2];
    document.querySelectorAll(`[id^="cso-month-${cid}-"]`).forEach(monthEl => {
      const header = monthEl.previousElementSibling;
      if (header) header.style.opacity = '1';
    });
  }

  window._cliSecOpen[secId] = opening;
  if (el) el.style.display = opening ? 'block' : 'none';
  if (arrow) arrow.textContent = opening ? '▲' : '▼';
}

function updateCliOrdSummary(cid) {
  const chks = document.querySelectorAll(`.cli-ord-chk[data-cid="${cid}"]:checked`);

  let panel = document.getElementById('cli-ord-fixed-summary');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'cli-ord-fixed-summary';
    panel.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9998;background:#0d1f0d;border-bottom:2px solid #10b981;padding:8px 12px;display:none;box-shadow:0 2px 12px #0008';
    document.body.appendChild(panel);
  }

  if (!chks.length) { panel.style.display = 'none'; return; }

  const totals = {};
  chks.forEach(chk => {
    const oid = Number(chk.dataset.oid);
    const o = S.orders.find(x => x.id === oid);
    if (!o) return;
    o.items.forEach(it => {
      const p = S.products.find(x => x.id === it.productId);
      if (!p) return;
      const key = it.productId;
      if (!totals[key]) totals[key] = { name: p.name, spec: p.presentation || '', qty: 0 };
      totals[key].qty += Number(it.qty);
    });
  });

  const lines = Object.values(totals).map(t => {
    const spec = t.spec ? ` (${t.spec})` : '';
    return `<span style="color:#f1f5f9;font-weight:600;margin-right:10px">${t.name}${spec} = <span style="color:#10b981">${t.qty}</span></span>`;
  }).join('');

  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <span style="font-size:11px;color:#4ade80;font-weight:700">📊 RESUMEN — ${chks.length} pedido(s)</span>
      <div style="display:flex;gap:6px">
        <button onclick="selectAllCliOrds(${cid})" style="background:transparent;border:1px solid #10b981;border-radius:5px;color:#10b981;padding:2px 8px;font-size:11px;cursor:pointer">✔ Todos</button>
        <button onclick="clearCliOrdSel(${cid})" style="background:transparent;border:1px solid #ef4444;border-radius:5px;color:#ef4444;padding:2px 8px;font-size:11px;cursor:pointer">✕ Limpiar</button>
      </div>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:4px;font-size:12px">${lines}</div>`;
  panel.style.display = 'block';
}

function selectAllCliOrds(cid) {
  document.querySelectorAll(`.cli-ord-chk[data-cid="${cid}"]`).forEach(chk => chk.checked = true);
  updateCliOrdSummary(cid);
}

function clearCliOrdSel(cid) {
  document.querySelectorAll(`.cli-ord-chk[data-cid="${cid}"]`).forEach(chk => chk.checked = false);
  const panel = document.getElementById('cli-ord-fixed-summary');
  if (panel) panel.style.display = 'none';
}

function openQuoteFromCli(oid) {
  showQuoteFromOrder(oid);
}
function openEditFromCli(oid) {
  const orig = S.orders.find(x=>x.id===oid);
  _cameFromClient = orig ? orig.clientId : oid;
  startEditOrder(oid);
}
function openDuplFromCli(oid) {
  const orig = S.orders.find(x=>x.id===oid);
  const cid = orig ? orig.clientId : null;
  _cameFromClient = cid;
  duplicateOrder(oid);
  if (cid && window._cliOpen) {
    window._cliOpen[cid] = true;
    setTimeout(() => {
      const sec = document.getElementById('cso-' + cid);
      if (sec) sec.style.display = 'block';
    }, 50);
  }
}
function openDelFromCli(oid) {
  const o = S.orders.find(x=>x.id===oid);
  if (!o) return;
  askConfirm('🗑 Eliminar pedido', `¿Eliminar el pedido de ${o.clientName}?`, () => {
    S.orders = S.orders.filter(x=>x.id!==oid);
    save(); renderClients(); renderList();
    toast('Pedido eliminado');
  });
}

function toggleCliSec(id) {
  if (!window._cliSecOpen) window._cliSecOpen = {};
  const opening = !window._cliSecOpen[id];

  if (opening) {
    // Extraer cid del id (ej: 'csp-42' → '42')
    const cid = id.split('-').pop();
    const prefixes = ['csp','csc','csd','csb','csn','cso'];
    // Colapsar todas las demás secciones del mismo cliente
    prefixes.forEach(p => {
      const secId = `${p}-${cid}`;
      if (secId !== id && window._cliSecOpen[secId]) {
        window._cliSecOpen[secId] = false;
        const secEl = document.getElementById(secId);
        if (secEl) secEl.style.display = 'none';
      }
    });
  }

  window._cliSecOpen[id] = opening;
  const el = document.getElementById(id);
  if (el) el.style.display = opening ? 'block' : 'none';
  if (opening) initOpenClientSortSections();
}

function renderClients() {
  // Corrige clientes que ya tenían una sola dirección guardada antes de
  // existir esta regla (campo "Dirección" vacío o desincronizado)
  migrateSoloUnaEsFiscal();
  // Recordar si hay ficha flotante activa
  const floatCid = window._floatCid || null;
  // Actualizar selector de prioridad (Nuevo Cliente) desde la lista maestra de Configuración
  const ncPrioSel = document.getElementById('nc-priority');
  if (ncPrioSel) {
    const curVal = ncPrioSel.value;
    ncPrioSel.innerHTML = '<option value="">— Sin prioridad —</option>' + (S.priorityList||[]).map(p=>`<option value="${p.name}">${p.name}</option>`).join('');
    ncPrioSel.value = curVal;
  }
  _renderClientsInternal();
  initOpenClientSortSections();
  if (floatCid) {
    setTimeout(() => restoreFloatingCard(floatCid), 50);
  }
}

function restoreFloatingCard(cid) {
  // Aplicar opacidad
  document.querySelectorAll('[id^="cc-"]').forEach(el => {
    const elCid = Number(el.id.replace('cc-', ''));
    el.style.opacity = elCid === Number(cid) ? '1' : '0.35';
  });
  // Restaurar posición fija
  const el = document.getElementById('cc-' + cid);
  if (el && !el.dataset.floatCid) {
    el.dataset.floatCid = cid;
    el.style.cssText += ';position:fixed;top:0;left:0;right:0;z-index:800;background:#1e2236;border-bottom:2px solid #f59e0b;box-shadow:0 8px 24px #000a;max-height:85vh;overflow-y:auto;margin:0;border-radius:0';
    if (!el.querySelector('#float-close-btn')) {
      const closeBtn = document.createElement('button');
      closeBtn.id = 'float-close-btn';
      closeBtn.textContent = '✕ Cerrar';
      closeBtn.style.cssText = 'position:sticky;top:4px;float:right;background:#1e2236;border:1px solid #475569;border-radius:6px;color:#94a3b8;padding:4px 10px;font-size:11px;cursor:pointer;z-index:801;margin:4px 4px 0 0';
      closeBtn.onclick = closeFloatingCard;
      el.insertBefore(closeBtn, el.firstChild);
    }
  }
}

function renderClientsIfActive() {
  // Evita reconstruir la lista completa de Clientes (potencialmente cientos de tarjetas)
  // cuando el usuario está en otra pestaña, como Configuración, y no la está viendo.
  if (_currentTab === 'clients') renderClients();
}

function renderProductsIfActive() {
  if (_currentTab === 'products') renderProducts();
}

function _renderClientsInternal() {
if (!window._cliOpen) window._cliOpen = {};
const _cliCountVisible = S.clients.filter(c=>!c.isProspect).length;
const _ct = document.getElementById('cli-title-top'); if (_ct) _ct.textContent = '(' + _cliCountVisible + ')';
document.getElementById('cli-title').value = _cliCountVisible;
// Poblar selector de rutas en clientes
const cliRutaSel = document.getElementById('cli-ruta-filter');
if (cliRutaSel) {
  const curRuta = cliRutaSel.value;
  cliRutaSel.innerHTML = '<option value="">🚚 Ruta</option>' +
    '<option value="__none__" ' + (curRuta==='__none__'?'selected':'') + '>— Sin ruta —</option>' +
    [...(S.rutasCliente||[])].sort((a,b)=>a.name.localeCompare(b.name,'es')).map(r=>`<option value="${r.id}" ${curRuta==r.id?'selected':''}>${r.name}</option>`).join('');
}
const massRuta = document.getElementById('mass-ruta');
const massDept = document.getElementById('mass-dept');
const massMun  = document.getElementById('mass-mun');
if (massRuta) {
  massRuta.innerHTML = '<option value="">🚚 Ruta...</option>' +
    [...(S.rutasCliente||[])].sort((a,b)=>a.name.localeCompare(b.name,'es')).map(r=>`<option value="${r.id}">${r.name}</option>`).join('');
}
if (massDept) {
  massDept.innerHTML = '<option value="">🏛️ Depto...</option>' +
    [...(S.depts||[])].sort((a,b)=>a.name.localeCompare(b.name,'es')).map(d=>`<option value="${d.id}">${d.name}</option>`).join('');
}
if (massMun) {
  massMun.innerHTML = '<option value="">🏘️ Sector...</option>' +
    [...(S.municipios||[])].sort((a,b)=>a.name.localeCompare(b.name,'es')).map(m=>`<option value="${m.id}">${m.name}</option>`).join('');
}
const massPriority = document.getElementById('mass-priority');
if (massPriority) {
  massPriority.innerHTML = '<option value="">⭐ Prioridad...</option>' +
    (S.priorityList||[]).map(p=>`<option value="${p.name}">${p.name}</option>`).join('');
}

const rfSel = document.getElementById('cli-dept-filter');
if (rfSel) {
  const curVal = rfSel.value;
  rfSel.innerHTML = '<option value="">🏛️ Todos</option>' +
    [...(S.depts||[])].sort((a,b)=>a.name.localeCompare(b.name,'es')).map(d=>`<option value="${d.id}" ${String(d.id)===curVal?'selected':''}>${d.name}</option>`).join('') +
    `<option value="__none__" ${curVal==='__none__'?'selected':''}>— Sin departamento</option>`;
}
const munSel = document.getElementById('cli-mun-filter');
if (munSel) {
  const curMun = munSel.value;
  munSel.innerHTML = '<option value="">🏘️ Todos</option>' +
    [...(S.municipios||[])].sort((a,b)=>a.name.localeCompare(b.name,'es')).map(m=>`<option value="${m.id}" ${String(m.id)===curMun?'selected':''}>${m.name}</option>`).join('') +
    `<option value="__none__" ${curMun==='__none__'?'selected':''}>— Sin sector</option>`;
}
const prioSel = document.getElementById('cli-priority-filter');
if (prioSel) {
  const curPrio = prioSel.value;
  prioSel.innerHTML = '<option value="">⭐ Todas</option>' +
    (S.priorityList||[]).map(p=>`<option value="${p.name}" ${p.name===curPrio?'selected':''}>${p.name}</option>`).join('') +
    `<option value="__none__" ${curPrio==='__none__'?'selected':''}>— Sin prioridad</option>`;
}
const routeFilter = rfSel ? rfSel.value : '';
const munFilter   = munSel ? munSel.value : '';

const body = document.getElementById('cli-body');
const _visibleClients = S.clients.filter(c=>!c.isProspect || Number(c.id)===Number(window._floatCid) || Number(c.id)===Number(window._prospectEditAfterLoad));
if (!_visibleClients.length) { body.innerHTML='<div style="text-align:center;color:#64748b;padding:20px">Sin clientes aún.</div>'; return; }
body.innerHTML = '';
let list = clientSortMode==='alpha'
? [...(_visibleClients)].sort((a,b)=>a.name.localeCompare(b.name,'es'))
: _visibleClients;

// Aplicar filtros
const rutaFilter = document.getElementById('cli-ruta-filter')?.value || '';
if (rutaFilter === '__none__') list = list.filter(c => !c.rutaClienteId);
else if (rutaFilter) list = list.filter(c => String(c.rutaClienteId) === rutaFilter);
if (routeFilter === '__none__') list = list.filter(c => !c.deptId);
else if (routeFilter) list = list.filter(c => String(c.deptId) === routeFilter);
if (munFilter === '__none__') list = list.filter(c => !c.municipioId);
else if (munFilter) list = list.filter(c => String(c.municipioId) === munFilter);
const prioFilter = document.getElementById('cli-priority-filter')?.value || '';
if (prioFilter === '__none__') list = list.filter(c => !(c.priority||'').trim());
else if (prioFilter) list = list.filter(c => (c.priority||'') === prioFilter);

document.getElementById('cli-title').textContent = (rutaFilter||routeFilter||munFilter||prioFilter)
  ? `Clientes (${list.length} de ${_visibleClients.length})`
  : `Clientes (${_visibleClients.length})`;
list.forEach(c => {
const card = document.createElement('div');
card.className = 'card sortable-item'; card.id = 'cc-'+c.id; card.dataset.id = c.id;
const _cpData = S.cp[c.id] || S.cp[String(c.id)] || {};
const _hasCustomList = !!(_cpData._visible && _cpData._visible.length > 0);
const prows = S.products.filter(p => {
const cp = _cpData;
const visible = cp._visible;
return !visible || visible.includes(p.id) || visible.includes(String(p.id));
}).map(p => {
const pr   = cliPrice(c.id, p.id, p.basePrice);
const diff = pr - p.basePrice;
const ul   = p.unitLabel||'unidad';
const us   = Number(p.unitSize)||1;
const col  = diff>0?'#10b981':diff<0?'#ef4444':'#f1f5f9';
const dt   = diff!==0 ? ` <span style="font-size:10px;opacity:.75">(${diff>0?'+':''}${Q(diff)})</span>` : '';
const hint = us>1 ? ` <span style="font-size:10px;color:#64748b">/${ul}</span>` : '';
return `<div class="prow">
<span style="color:#94a3b8">${p.name}${p.presentation?` <span class="tag">${p.presentation}</span>`:''}</span>
<span style="font-weight:700;color:${col}">${Q(pr)}${hint}${dt}</span>
</div>`;
}).join('');
const isCliOpen = !!window._cliOpen[c.id];
card.innerHTML = `
<div style="display:flex;justify-content:space-between;align-items:flex-start;cursor:pointer" onclick="toggleCli(${c.id})">
<div style="display:flex;align-items:center;gap:6px">
<input type="checkbox" class="cli-chk" data-id="${c.id}"
  style="width:17px;height:17px;flex-shrink:0;cursor:pointer;accent-color:#10b981;margin-top:2px"
  ${(window._cliSel||new Set()).has(c.id)?'checked':''}
  onclick="event.stopPropagation();toggleCliSel(${c.id},this.checked)"/>
<div>
<div style="font-weight:800;font-size:15px;${priorityNameStyle(c.priority,'#f1f5f9')}">${c.name}</div>
${(()=>{ const _replacement = S.clients.find(x=>x.linkedFromClientId===c.id); return _replacement?`<div onclick="event.stopPropagation();openClientCard(${_replacement.id})" style="font-size:11px;color:#a855f7;font-weight:700;margin-top:1px;cursor:pointer;text-decoration:underline">🔗 Reemplazado por: ${_replacement.name}</div>`:''; })()}
${c.clientCode ? `<div style="font-size:12px;color:#64748b">🆔 ${c.clientCode}</div>` : ''}
${c.priority ? `<div style="font-size:12px;color:#f59e0b">⭐ ${c.priority}</div>` : ''}
${c.phone   ? `<div style="font-size:12px;color:#64748b">📞 ${c.phone}</div>` : ''}
${c.deptId ? (()=>{ const cat=(S.depts||[]).find(x=>x.id===c.deptId); return cat?`<div style="font-size:10px;display:inline-block;background:#1e3a5f;color:#60a5fa;padding:1px 8px;border-radius:8px;margin-top:2px">🏛️ ${cat.name}</div>`:''; })() : ''}
${c.municipioId ? (()=>{ const m=(S.municipios||[]).find(x=>x.id===c.municipioId); return m?`<div style="font-size:10px;display:inline-block;background:#1e1040;color:#a78bfa;padding:1px 8px;border-radius:8px;margin-top:2px;margin-left:3px">🏘️ ${m.name}</div>`:''; })() : ''}
${c.address ? `<div style="font-size:12px;color:#64748b">📍 ${c.address}</div>` : ''}
</div>
</div>
<div style="display:flex;gap:6px;flex-shrink:0;align-items:center" onclick="event.stopPropagation()">
<button class="bg" style="font-size:11px;padding:4px 10px" onclick="newOrderForClient(${c.id})">🛒 Pedido</button>
<button class="bs" onclick="editCliForm(${c.id})">✏️</button>
<button class="br" onclick="delClient(${c.id})">🗑</button>
<span style="font-size:13px;color:#64748b;margin-left:2px">${isCliOpen?'▲':'▼'}</span>
</div>
</div>
<div style="display:${isCliOpen?'block':'none'}">
<div class="price-sub">
<div onclick="toggleCliSec('csp-${c.id}')" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;padding:2px 0;margin-bottom:4px">
  <span style="font-size:11px;color:${_hasCustomList?'#4ade80':'#f1f5f9'};font-weight:700">💰 LISTA DE PRECIOS</span>
  <span style="color:#64748b;font-size:11px">▼</span>
</div>
<div id="csp-${c.id}" style="display:${(window._cliSecOpen&&window._cliSecOpen['csp-'+c.id])?'block':'none'}">
${prows}
${(()=>{
  const _plId = _cpData._priceListId;
  const _pl = _plId ? (S.priceLists||[]).find(x=>x.id===_plId) : null;
  return _pl
    ? `<div style="margin-bottom:6px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <span style="font-size:10px;background:#1e3a5f;color:#60a5fa;padding:2px 8px;border-radius:10px;font-weight:700">🏷️ Lista compartida: ${_pl.name}</span>
        <button onclick="unlinkCliFromPriceList(${c.id})" style="font-size:10px;background:none;border:1px solid #ef4444;color:#ef4444;border-radius:8px;padding:2px 8px;cursor:pointer">Desvincular</button>
      </div>`
    : `<div style="margin-bottom:6px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <span style="font-size:10px;background:#2a1f00;color:#f59e0b;padding:2px 8px;border-radius:10px;font-weight:700">✏️ Lista personalizada</span>
        <button onclick="openLinkToSharedList(${c.id})" style="font-size:10px;background:none;border:1px solid #60a5fa;color:#60a5fa;border-radius:8px;padding:2px 8px;cursor:pointer">🔗 Vincular a lista compartida</button>
      </div>`;
})()}
<button class="bp2" onclick="editCliPrices(${c.id})">✏️ Editar precios de este cliente</button>
<button class="bg" style="margin-top:6px;width:100%;font-size:12px" onclick="showPriceListDoc(${c.id})">📄 Generar listado de precios</button>
</div>
</div>
${(()=>{
  const pinnedComs = (S.savedComments && S.savedComments[c.id]) || [];
  const validComs = Array.isArray(pinnedComs) ? pinnedComs : [];
  const comRows = validComs.map((cm,i) => `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;background:#161929;border-radius:7px;padding:6px 10px">
      <span style="flex:1;font-size:12px;color:#f1f5f9">${cm}</span>
      <button onclick="removeCliComment(${c.id},${i})" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:14px;padding:0 2px" title="Eliminar">✕</button>
    </div>`).join('');
  return `<div style="margin-top:10px;border-top:1px solid #2a3050;padding-top:10px">
    <div onclick="toggleCliSec('csc-${c.id}')" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;padding:2px 0;margin-bottom:4px">
      <span style="font-size:11px;color:${validComs.length?'#4ade80':'#94a3b8'};font-weight:700">💬 COMENTARIOS ANCLADOS${validComs.length?` (${validComs.length})`:''}</span>
      <span style="color:#64748b;font-size:11px">▼</span>
    </div>
    <div id="csc-${c.id}" style="display:${(window._cliSecOpen&&window._cliSecOpen['csc-'+c.id])?'block':'none'}">
    ${comRows || '<div style="font-size:11px;color:#64748b;margin-bottom:6px">Sin comentarios anclados.</div>'}
    <div style="display:flex;gap:6px;margin-top:4px">
      <input class="inp" id="new-cli-com-${c.id}" placeholder="Nuevo comentario anclado..." style="margin-bottom:0;flex:1;font-size:12px"/>
      <button class="bg" style="padding:8px 12px;white-space:nowrap;font-size:12px" onclick="addCliComment(${c.id})">+ Agregar</button>
    </div>
  </div>
  </div>`;
})()}
${(()=>{
  if (!S.savedAddresses) S.savedAddresses = {};
  const addrs = S.savedAddresses[c.id] || [];
  const addrRows = addrs.map((addr,i) => {
    const isDefault = (S.defaultAddresses && S.defaultAddresses[c.id] === i);
    const isPrincipal = (S.principalAddresses && S.principalAddresses[c.id] === i);
    return `
    <div class="sortable-item cli-addr-item" data-idx="${i}" style="display:flex;align-items:center;gap:6px;margin-bottom:5px;background:#161929;border-radius:7px;padding:6px 10px;border:1px solid ${isDefault?'#f59e0b':'transparent'}">
      <span class="drag-handle" style="font-size:14px;flex-shrink:0">≡</span>
      <span onclick="setPrincipalAddress(${c.id},${i})" style="cursor:pointer;flex-shrink:0;font-size:10px;font-weight:700;padding:2px 7px;border-radius:9px;background:${isPrincipal?'#14532d':'#1e2333'};color:${isPrincipal?'#4ade80':'#64748b'};border:1px solid ${isPrincipal?'#22c55e':'#334155'}" title="Marcar como dirección Fiscal">Fiscal</span>
      <span style="flex:1;font-size:12px;color:#f1f5f9">${isDefault?'⭐ ':''}${addr}</span>
      <button onclick="setDefaultAddress(${c.id},${i})" style="background:none;border:none;color:${isDefault?'#f59e0b':'#475569'};cursor:pointer;font-size:13px;padding:0 4px" title="Favorita (formulario de pedidos)">${isDefault?'⭐':'☆'}</button>
      <button onclick="editCliAddress(${c.id},${i})" style="background:none;border:none;color:#60a5fa;cursor:pointer;font-size:13px;padding:0 4px" title="Editar">✏️</button>
      <button onclick="removeCliAddress(${c.id},${i})" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:14px;padding:0 2px" title="Eliminar">✕</button>
    </div>`}).join('');
  return `<div style="margin-top:10px;border-top:1px solid #2a3050;padding-top:10px">
    <div onclick="toggleCliSec('csd-${c.id}')" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;padding:2px 0;margin-bottom:4px">
      <span style="font-size:11px;color:${addrs.length?'#4ade80':'#94a3b8'};font-weight:700">📍 Direcciones${addrs.length?` (${addrs.length})`:''}</span>
      <span style="color:#64748b;font-size:11px">▼</span>
    </div>
    <div id="csd-${c.id}" style="display:${(window._cliSecOpen&&window._cliSecOpen['csd-'+c.id])?'block':'none'}">
    ${addrs.length>1?`<div style="font-size:10px;color:#64748b;margin-bottom:6px;text-align:center">Mantén presionado ≡ para arrastrar y reordenar</div>`:''}
    ${addrRows || '<div style="font-size:11px;color:#64748b;margin-bottom:6px">Sin direcciones guardadas.</div>'}
    <div style="display:flex;gap:6px;margin-top:4px">
      <input class="inp" id="new-cli-addr-${c.id}" placeholder="Nueva dirección..." style="margin-bottom:0;flex:1;font-size:12px"/>
      <button class="bg" style="padding:8px 12px;white-space:nowrap;font-size:12px" onclick="addCliAddress(${c.id})">+ Agregar</button>
    </div>
  </div>
  </div>`;
})()}
${(()=>{
  if (!S.bonuses) S.bonuses = {};
  const ownRules = (S.bonuses[c.id] || []).map(r => ({ r, ownerCid: c.id }));
  // Reglas de OTROS clientes donde este cliente fue agregado como "cliente adicional"
  const sharedRules = [];
  Object.keys(S.bonuses).forEach(ownerId => {
    if (Number(ownerId) === Number(c.id)) return;
    (S.bonuses[ownerId]||[]).forEach(r => {
      if ((r.extraClientIds||[]).map(Number).includes(Number(c.id))) {
        sharedRules.push({ r, ownerCid: Number(ownerId) });
      }
    });
  });
  const rulesWithOwner = [...ownRules, ...sharedRules];
  const rules = rulesWithOwner.map(x=>x.r);
  if (!rules.length) return `<div style="margin-top:10px;border-top:1px solid #2a3050;padding-top:10px">
    <div onclick="toggleCliSec('csb-${c.id}')" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;padding:2px 0;margin-bottom:4px">
      <span style="font-size:11px;color:#94a3b8;font-weight:700">🎁 BONIFICACIONES</span>
      <span style="color:#64748b;font-size:11px">▼</span>
    </div>
    <div id="csb-${c.id}" style="display:${(window._cliSecOpen&&window._cliSecOpen['csb-'+c.id])?'block':'none'}">
      <div style="font-size:11px;color:#64748b;margin-bottom:6px">Sin reglas configuradas.</div>
      <button class="bg" style="font-size:11px;padding:5px 12px" onclick="addBonusRule(${c.id})">+ Nueva regla</button>
    </div>
  </div>`;
  const rulesHtml = rulesWithOwner.map((_rw,ri) => {
    const r = _rw.r;
    const ownerCid = _rw.ownerCid;
    const isSharedFromOther = Number(ownerCid) !== Number(c.id);
    const ownerCli = isSharedFromOther ? S.clients.find(x=>x.id===ownerCid) : null;
    const progress = calcBonusProgress(ownerCid, r);
    const complete = !r.inactive && isBonusComplete(ownerCid, r);
    const readyBadge = complete ? `<span style="font-size:10px;background:#052e16;color:#10b981;padding:2px 7px;border-radius:8px;font-weight:700">🎁 Lista!</span>` : '';
    // Descripción de productos a acumular
    let accumDesc = '';
    if (r.ruleType==='pool') {
      accumDesc = (r.poolProds||[]).map(pid=>{const p2=S.products.find(x=>x.id===Number(pid));return p2?p2.name:''}).filter(Boolean).join(' / ');
    } else {
      accumDesc = (r.targets||[]).map(t=>{const p2=S.products.find(x=>x.id===Number(t.productId));return p2?p2.name+' ×'+t.threshold:''}).filter(Boolean).join(' + ');
    }
    const bonusDesc = (r.bonusItems||[]).map(bi=>{const p2=S.products.find(x=>x.id===Number(bi.productId));return `${bi.qty} ${p2?p2.name:'—'}`;}).join(' + ');
    // Barras de progreso con campo manual por línea
    const bars = progress.map((pg, pgi) => {
      // Fila de detalle (producto individual dentro del pool)
      if (pg.isDetail) {
        const equivTxt = (pg.equiv !== undefined && pg.equiv !== null)
          ? ` uds → <b style="color:#94a3b8">${pg.equiv} equiv</b>`
          : ` uds`;
        return `<div style="display:flex;justify-content:space-between;font-size:10px;color:#64748b;padding:2px 6px;margin-bottom:2px;border-left:2px solid #2a3050">
          <span>${pg.label}</span>
          <span>${pg.app}${equivTxt}</span>
        </div>`;
      }
      const tot = pg.app + pg.manual;
      const pct = Math.min(100, Math.round(tot/pg.threshold*100));
      const col = progressColor(pct);
      const tidx = pg.isPool ? 'pool' : (pg.ti !== undefined ? pg.ti : pgi);
      return `<div style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;margin-bottom:2px">
          <span>${pg.label}</span>
          <span style="font-weight:700;color:${col}">${tot}/${pg.threshold}</span>
        </div>
        <div style="background:#2a3050;border-radius:4px;height:7px;overflow:hidden;margin-bottom:2px">
          <div style="height:100%;background:${col};width:${pct}%;border-radius:4px"></div>
        </div>
        <div style="font-size:10px;color:#64748b;margin-bottom:4px">App: ${pg.app} · Manual: ${pg.manual}</div>
        <div style="display:flex;gap:5px">
          <input type="number" min="0" step="1" placeholder="+ externas" id="bm-${ownerCid}-${ri}-${tidx}" style="flex:1;background:#0d0f18;border:1px solid #2a3050;border-radius:6px;padding:4px 8px;color:#f1f5f9;font-size:11px"/>
          <button onclick="addBonusManual(${ownerCid},${ri},'${tidx}',1)" style="background:#1e3a5f;border:none;border-radius:6px;color:#60a5fa;padding:4px 10px;font-size:11px;cursor:pointer">+</button>
          <button onclick="addBonusManual(${ownerCid},${ri},'${tidx}',-1)" style="background:#2d0f0f;border:1px solid #ef4444;border-radius:6px;color:#ef4444;padding:4px 10px;font-size:11px;cursor:pointer">−</button>
        </div>
      </div>`;
    }).join('');
    return `<div style="background:#161929;border-radius:8px;padding:10px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <div style="flex:1">
          ${isSharedFromOther?`<div style="font-size:9px;background:#1e3a5f;color:#60a5fa;padding:1px 7px;border-radius:8px;font-weight:700;display:inline-block;margin-bottom:3px">🔗 Compartida desde ${ownerCli?ownerCli.name:'otro cliente'}</div>`:''}
          <div style="font-size:11px;font-weight:700;color:${r.inactive?'#64748b':'#f1f5f9'}">${r.name||accumDesc}${r.inactive?' (inactiva)':''}</div>
          <div style="font-size:10px;color:${r.inactive?'#475569':'#10b981'};margin-top:1px">🎁 ${bonusDesc}</div>
          ${r.deadline?`<div style="font-size:10px;color:#94a3b8">Período: ${fmtDDMMYYYY(r.startDate)||''}→${fmtDDMMYYYY(r.deadline)}</div>`:''}
          ${r.vigenciaStart?`<div style="font-size:10px;color:#60a5fa">Vigencia: ${fmtDDMMYYYY(r.vigenciaStart)}${r.vigenciaEnd?' → '+fmtDDMMYYYY(r.vigenciaEnd):' → activa'}</div>`:''}
        </div>
        <div style="display:flex;gap:4px;align-items:center;margin-left:6px">
          ${readyBadge}
          <button onclick="editBonusRule(${ownerCid},${ri})" style="background:none;border:1px solid #475569;border-radius:6px;color:#94a3b8;padding:2px 6px;font-size:11px;cursor:pointer">✏️</button>
          <button onclick="toggleBonusActive(${ownerCid},${ri})" style="background:none;border:1px solid ${r.inactive?'#10b981':'#f59e0b'};border-radius:6px;color:${r.inactive?'#10b981':'#f59e0b'};padding:2px 6px;font-size:11px;cursor:pointer">${r.inactive?'▶ Activar':'⏸'}</button>
          ${isSharedFromOther?'':`<button onclick="delBonusRule(${ownerCid},${ri})" style="background:none;border:1px solid #ef4444;border-radius:6px;color:#ef4444;padding:2px 6px;font-size:11px;cursor:pointer">✕</button>`}
        </div>
      </div>
      ${bars}
      ${complete?`<button onclick="sendBonusOrder(${ownerCid},${ri})" style="width:100%;background:#052e16;border:1px solid #10b981;border-radius:6px;color:#10b981;padding:8px;font-size:12px;font-weight:700;cursor:pointer;margin-top:6px">🎁 Enviar bonificación</button><button onclick="deliverBonus(${ownerCid},${ri})" style="width:100%;background:#1e293b;border:1px solid #64748b;border-radius:6px;color:#94a3b8;padding:6px;font-size:11px;font-weight:700;cursor:pointer;margin-top:4px">🔄 Reiniciar</button>`:''}
    </div>`;
  }).join('');
  return `<div style="margin-top:10px;border-top:1px solid #2a3050;padding-top:10px">
    <div onclick="toggleCliSec('csb-${c.id}')" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;padding:2px 0;margin-bottom:4px">
      <span style="font-size:11px;color:#4ade80;font-weight:700">🎁 BONIFICACIONES (${rules.length})</span>
      <span style="color:#64748b;font-size:11px">▼</span>
    </div>
    <div id="csb-${c.id}" style="display:${(window._cliSecOpen&&window._cliSecOpen['csb-'+c.id])?'block':'none'}">
      <div style="display:flex;justify-content:flex-end;gap:6px;margin-bottom:8px;flex-wrap:wrap">
        <button style="font-size:11px;padding:4px 10px;background:transparent;border:1px solid #f59e0b;border-radius:6px;color:#f59e0b;cursor:pointer" onclick="runVerifyOldBonusForClient(${c.id})">🔍 Verificar antiguas</button>
        <button style="font-size:11px;padding:4px 10px;background:transparent;border:1px solid #3b82f6;border-radius:6px;color:#60a5fa;cursor:pointer" onclick="showBonusReport(${c.id})">📄 Progreso</button>
        <button style="font-size:11px;padding:4px 10px;background:transparent;border:1px solid #10b981;border-radius:6px;color:#10b981;cursor:pointer" onclick="showBonusEntregasReport(${c.id})">📋 Bonificaciones</button>
        <button class="bg" style="font-size:11px;padding:4px 10px" onclick="addBonusRule(${c.id})">+ Nueva regla</button>
      </div>
      ${rulesHtml}
    </div>
  </div>`;
})()}
${(()=>{
  if (!S.clientNotesArr) S.clientNotesArr = {};
  const notes = S.clientNotesArr[c.id] || [];
  const noteRows = notes.map((n,i) => {
    const isOpen = window._noteOpen && window._noteOpen[`${c.id}_${i}`];
    return `<div class="sortable-item cli-note-item" data-idx="${i}" style="background:#0d0f18;border:1px solid #2a3050;border-radius:8px;margin-bottom:6px;overflow:hidden">
      <div onclick="toggleCliNote(${c.id},${i})" style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;cursor:pointer">
        <span class="drag-handle" style="font-size:14px;flex-shrink:0;margin-right:6px">≡</span>
        <span style="font-size:12px;color:#f1f5f9;font-weight:600;flex:1">${n.title||'Sin título'}</span>        <div style="display:flex;gap:6px;align-items:center">
          <button onclick="event.stopPropagation();deleteCliNote(${c.id},${i})" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:13px;padding:0 2px">✕</button>
          <span style="color:#64748b;font-size:11px">${isOpen?'▲':'▼'}</span>
        </div>
      </div>
      ${isOpen ? `<div style="padding:8px 10px;border-top:1px solid #2a3050">
        <input id="note-title-${c.id}-${i}" value="${(n.title||'').replace(/"/g,'&quot;')}" placeholder="Título..."
          style="width:100%;background:#161929;border:1px solid #2a3050;border-radius:6px;padding:6px 8px;color:#f1f5f9;font-size:13px;font-weight:600;margin-bottom:8px;box-sizing:border-box"/>
        <!-- Editor de texto simple -->
        <textarea id="note-body-${c.id}-${i}"
          style="width:100%;background:#ffffff;border:1px solid #2a3050;border-radius:6px;padding:10px;color:#1e293b;font-size:14px;line-height:1.7;box-sizing:border-box;min-height:200px;outline:none;word-break:break-word;font-family:inherit;resize:vertical">${(n.body||'').replace(/<br>/g,'\n').replace(/<[^>]*>/g,'')}</textarea>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button onclick="saveCliNote(${c.id},${i})" style="flex:1;padding:8px;background:#10b981;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer">💾 Guardar</button>
          <button onclick="toggleCliNote(${c.id},${i})" style="flex:1;padding:8px;background:#475569;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer">✕ Cancelar</button>
        </div>
      </div>` : ''}
    </div>`;
  }).join('');
  return `<div style="margin-top:10px;border-top:1px solid #2a3050;padding-top:10px">
    <div onclick="toggleCliSec('csn-${c.id}')" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;padding:2px 0;margin-bottom:4px">
      <span style="font-size:11px;color:${notes.length?'#4ade80':'#94a3b8'};font-weight:700">📝 NOTAS ${notes.length?`(${notes.length})`:''}</span>
      <span style="color:#64748b;font-size:11px">▼</span>
    </div>
    <div id="csn-${c.id}" style="display:${(window._cliSecOpen&&window._cliSecOpen['csn-'+c.id])?'block':'none'}">
      ${notes.length>1?`<div style="font-size:10px;color:#64748b;margin-bottom:6px;text-align:center">Mantén presionado ≡ para arrastrar y reordenar</div>`:''}
      ${noteRows||'<div style="font-size:11px;color:#64748b;margin-bottom:6px">Sin notas.</div>'}
      <button onclick="addCliNote(${c.id})" style="width:100%;padding:7px;background:transparent;border:1px dashed #3b82f6;border-radius:6px;color:#60a5fa;font-size:12px;cursor:pointer;margin-top:4px">+ Agregar nota</button>
    </div>
  </div>`;
})()}

${(()=>{
  const _effIds = getEffectiveClientIds(c.id);
  const cliOrds = [...S.orders].filter(o=>_effIds.includes(Number(o.clientId))).sort((a,b)=>{ const td=ordDateTs(b)-ordDateTs(a); return td!==0?td:b.id-a.id; });
  if (!cliOrds.length) return '';
  const rows_map = {};
  cliOrds.forEach(o=>{
    const tot = orderTotal(o.items,o.clientId);
    const sapCalc = o.sapMode ? getSapCalcForOrder(o) : null;
    const disp = sapCalc ? sapCalc.totalConIva : (o.applyIva?tot*1.12:tot);
    const sCls = o.cancelled?'#ef4444':isOrderBlocked(o)?'#a855f7':o.status==='Concluido'?'#4ade80':o.status==='Confirmado'?'#60a5fa':'#f1f5f9';
    const itemsHtml = sapCalc ? sapCalc.items.map(r=>{
      const spec = r.specLabel ? ` (${r.specLabel})` : '';
      return `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:4px;font-size:11px;padding:3px 0;border-bottom:1px solid #1e2640">
        <span style="color:#f1f5f9;font-weight:600;flex:1;min-width:0">${r.qty} ${r.name}${spec} × ${Q(r.sapPriceNoIva)}/${r.sapUnitLabel} <span style="color:#facc15;font-size:10px">+IVA</span></span>
        <span style="color:#f1f5f9;font-weight:700;flex-shrink:0">${Q(r.sapLineTotalWithIva)}</span>
      </div>`;
    }).join('') : o.items.map(it=>{
      const p = S.products.find(x=>x.id===it.productId);
      if (!p) return '';
      const pr = (it.customPrice!=null)?it.customPrice:cliPrice(o.clientId,it.productId,p.basePrice||0);
      const ul = p.unitLabel||'unidad';
      const us = itemUnitSizeFor(it, p);
      const sub = pr*it.qty*us;
      const spec = itemSpecLabel(it,p) ? ` (${itemSpecLabel(it,p)})` : '';
      const iva = o.applyIva?` <span style="color:#facc15;font-size:10px">+IVA</span>`:'';
      return `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:4px;font-size:11px;padding:3px 0;border-bottom:1px solid #1e2640">
        <span style="color:#f1f5f9;font-weight:600;flex:1;min-width:0">${it.qty} ${p.name}${spec} × ${Q(pr)}/${ul}${iva}</span>
        <span style="color:#f1f5f9;font-weight:700;flex-shrink:0">${Q(sub)}</span>
      </div>`;
    }).filter(Boolean).join('');
    const cotBtn = `<button onclick="openQuoteFromCli(${o.id})" style="flex:1;padding:5px 0;background:transparent;border:1px solid #3b82f6;border-radius:6px;color:#60a5fa;font-size:11px;cursor:pointer">📄 Cot.</button>`;
    const editBtn = `<button onclick="openEditFromCli(${o.id})" style="flex:1;padding:5px 0;background:transparent;border:1px solid #f59e0b;border-radius:6px;color:#f59e0b;font-size:11px;cursor:pointer">✏️ Editar</button>`;
    const duplBtn = `<button onclick="openDuplFromCli(${o.id})" style="flex:1;padding:5px 0;background:transparent;border:1px solid #a855f7;border-radius:6px;color:#a855f7;font-size:11px;cursor:pointer">📋 Dupl.</button>`;
    const delBtn  = `<button onclick="openDelFromCli(${o.id})" style="flex:1;padding:5px 0;background:transparent;border:1px solid #ef4444;border-radius:6px;color:#ef4444;font-size:11px;cursor:pointer">🗑</button>`;
    const reactBtn = o.cancelled ? `<button onclick="reactivateOrder(${o.id})" style="width:100%;padding:6px 0;background:transparent;border:1px solid #10b981;border-radius:6px;color:#10b981;font-size:11px;font-weight:700;cursor:pointer;margin-top:4px">🔄 Reactivar pedido</button>` : '';
    const _isInherited = Number(o.clientId) !== Number(c.id);
    const rowHtml = `<div data-cli-oid="${o.id}" style="background:#161929;border-radius:8px;padding:8px 10px;margin-bottom:8px;border-left-width:3px;border-left-style:solid;border-left-color:${sCls};touch-action:pan-y">
      ${_isInherited?`<div style="font-size:10px;color:#a855f7;font-weight:700;margin-bottom:4px">📁 Cuenta anterior</div>`:''}
      ${isOrderBlocked(o)?`<div style="font-size:10px;color:#a855f7;font-weight:700;margin-bottom:4px">🔒 Bloqueado (fecha futura)</div>`:''}
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
        <div style="display:flex;align-items:center;gap:6px">
          <input type="checkbox" class="cli-ord-chk" data-cid="${c.id}" data-oid="${o.id}" onchange="updateCliOrdSummary(${c.id})"
            style="width:15px;height:15px;accent-color:#10b981;cursor:pointer;flex-shrink:0"/>
          <div style="font-size:11px;color:#94a3b8">${fmtOrdDate(o.date)}${o.quote?' · <strong style="color:#2dd4bf">'+o.quote+'</strong>':''}${o.oc?' · OC: <strong style="color:#818cf8">'+o.oc+'</strong>':''}</div>
        </div>
        <div style="display:flex;align-items:center;gap:5px">
          ${o.routeId?`<span style="font-size:10px;color:#f59e0b;font-weight:700">(RUTA)</span>`:''}
          <span style="font-size:10px;color:${sCls};font-weight:700">${o.cancelled?'🚫 CANCELADO':o.status}</span>
        </div>
      </div>
      ${o.delivery?`<div style="font-size:11px;color:#3b82f6;font-weight:600;margin-bottom:3px">📍 ${o.delivery}</div>`:''}
      ${o.quoteNote?`<div style="font-size:11px;color:#38bdf8;font-weight:700;margin-bottom:4px">📅 Fecha de entrega: ${fmtEntrega(o.quoteNote)}</div>`:''}
      <div style="background:#0d0f18;border-radius:5px;padding:4px 6px;margin-bottom:4px">${itemsHtml}</div>
      <div style="font-size:13px;font-weight:700;color:#f1f5f9;margin-bottom:4px">TOTAL ${Q(disp)}${sapCalc?' <span style="font-size:9px;font-weight:700;color:#fff;background:#7c3aed;padding:1px 6px;border-radius:4px;margin-left:4px">🧮 SAP</span>':''}</div>
      ${(o.comments&&o.comments.length)?o.comments.filter(Boolean).map(cm=>`<div style="font-size:11px;color:#f97316;font-style:italic;margin-bottom:3px">💬 ${cm}</div>`).join(''):''}
      ${(()=>{
        if (!o.bonusLines||!o.bonusLines.length) return '';
        const bLines = sapCalc ? sapCalc.bonusLines.map(r=>{
          const spec = r.specLabel?` (${r.specLabel})`:'';
          return `<div style="font-size:11px;color:#f1f5f9;font-weight:600;padding:2px 0;border-bottom:1px solid #1e2640">${r.qty} ${r.name}${spec} × ${Q(r.sapPriceNoIva)}/${r.sapUnitLabel} <span style="font-size:9px;color:#facc15">+IVA</span></div>`;
        }).join('') : o.bonusLines.map(bl=>{
          const p = S.products.find(x=>x.id===Number(bl.productId));
          const spec = p?.presentation?` (${p.presentation})`:'';
          const ul = p?.unitLabel||'unidad';
          const ivaLbl = o.applyIva ? ` <span style="font-size:9px;color:#facc15">+IVA</span>` : '';
          return `<div style="font-size:11px;color:#f1f5f9;font-weight:600;padding:2px 0;border-bottom:1px solid #1e2640">${bl.qty} ${p?p.name:'—'}${spec} × ${Q(bl.price||0)}/${ul}${ivaLbl}</div>`;
        }).join('');
        const allVerified2 = o.bonusLines.every(bl => bl.fromRuleId != null);
        const allExceptional2 = o.bonusLines.every(bl => bl.exceptional);
        const bonusBadge2 = allVerified2
          ? '<span style="font-size:9px;background:#052e16;color:#10b981;padding:1px 6px;border-radius:6px;font-weight:700;margin-left:6px">✅ Meta 100%</span>'
          : allExceptional2
            ? '<span style="font-size:9px;background:#2a1f00;color:#f59e0b;padding:1px 6px;border-radius:6px;font-weight:700;margin-left:6px">🎗️ Excepcional</span>'
            : '<span style="font-size:9px;background:#2d0f0f;color:#ef4444;padding:1px 6px;border-radius:6px;font-weight:700;margin-left:6px">⚠️ Sin verificar</span>';
        return `<div style="margin-top:4px"><div style="font-size:11px;color:#10b981;font-weight:700;margin-bottom:3px">🎁 BONIFICACIÓN${bonusBadge2}</div><div style="background:#0d0f18;border-radius:5px;padding:4px 6px">${bLines}</div></div>`;
      })()}
      <div style="display:flex;gap:5px;margin-top:4px">${cotBtn}${editBtn}${duplBtn}${delBtn}</div>
      ${reactBtn}
    </div>`;
    rows_map[o.id] = rowHtml;
  });
  return `<div style="margin-top:10px;border-top:1px solid #2a3050;padding-top:10px">
    <div onclick="toggleCliSec('cso-${c.id}')" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;padding:2px 0;margin-bottom:4px">
      <span style="font-size:11px;color:${cliOrds.length?'#4ade80':'#94a3b8'};font-weight:700">📦 ÚLTIMOS PEDIDOS${cliOrds.length?` (${cliOrds.length})`:''}</span>
      <div style="display:flex;align-items:center;gap:6px">
        <button onclick="event.stopPropagation();showBonusHistoryReport(${c.id})" style="font-size:10px;padding:2px 8px;background:transparent;border:1px solid #10b981;border-radius:5px;color:#10b981;cursor:pointer">📋 Detalle Pedidos</button>
        <span style="color:#64748b;font-size:11px">▼</span>
      </div>
    </div>
    <div id="cso-${c.id}" style="display:${(window._cliSecOpen&&window._cliSecOpen['cso-'+c.id])?'block':'none'}">
      ${(()=>{
        // Agrupar por mes
        const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        const groups = {};
        cliOrds.forEach(o => {
          const parts = (o.date||'').split(',')[0].split('/');
          const m = parts.length===3 ? parseInt(parts[1])-1 : new Date().getMonth();
          const y = parts.length===3 ? parseInt(parts[2]) : new Date().getFullYear();
          const key = `${y}-${String(m+1).padStart(2,'0')}`;
          const label = `${monthNames[m]} ${y}`;
          if (!groups[key]) groups[key] = {label, orders:[]};
          groups[key].orders.push(o);
        });
        return Object.keys(groups).sort().reverse().map(key => {
          const g = groups[key];
          const secId = `cso-month-${c.id}-${key}`;
          const isMonthOpen = window._cliSecOpen && window._cliSecOpen[secId] === true;

          // Resumen de productos del mes
          const monthTotals = {};
          g.orders.forEach(o => {
            o.items.forEach(it => {
              const p = S.products.find(x=>x.id===it.productId);
              if (!p) return;
              if (!monthTotals[it.productId]) monthTotals[it.productId] = {name:p.name, spec:p.presentation||'', qty:0};
              monthTotals[it.productId].qty += Number(it.qty);
            });
          });
          const summaryLine = Object.values(monthTotals).map(t=>{
            const spec = t.spec?` (${t.spec})`:'';
            return `<span style="color:#f1f5f9;font-size:10px;margin-right:8px">${t.name}${spec} = <span style="color:#10b981;font-weight:700">${t.qty}</span></span>`;
          }).join('');

          // Resumen de productos bonificados del mes
          const monthBonusTotals = {};
          g.orders.forEach(o => {
            (o.bonusLines||[]).forEach(bl => {
              const p = S.products.find(x=>x.id===Number(bl.productId));
              if (!p) return;
              if (!monthBonusTotals[bl.productId]) monthBonusTotals[bl.productId] = {name:p.name, spec:p.presentation||'', qty:0};
              monthBonusTotals[bl.productId].qty += Number(bl.qty);
            });
          });
          const bonusSummaryLine = Object.values(monthBonusTotals).map(t=>{
            const spec = t.spec?` (${t.spec})`:'';
            return `<span style="color:#f1f5f9;font-size:10px;margin-right:8px">${t.name}${spec} = <span style="color:#f59e0b;font-weight:700">${t.qty}</span></span>`;
          }).join('');

          const monthRows = g.orders.map(o => rows_map[o.id]||'').join('');
          return `<div style="margin-bottom:6px">
            <div onclick="toggleCliMonthSec('${secId}')" style="cursor:pointer;padding:6px 8px;background:#161929;border-radius:6px;margin-bottom:4px;border-left:3px solid #3b82f6">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${(summaryLine||bonusSummaryLine)?'4px':'0'}">
                <span style="font-size:12px;color:#60a5fa;font-weight:700">📅 ${g.label} <span style="color:#64748b;font-size:10px">(${g.orders.length})</span></span>
                <span style="color:#64748b;font-size:11px" id="${secId}-arrow">${isMonthOpen?'▲':'▼'}</span>
              </div>
              ${summaryLine?`<div style="display:flex;flex-wrap:wrap;gap:2px">${summaryLine}</div>`:''}
              ${bonusSummaryLine?`<div style="display:flex;flex-wrap:wrap;gap:2px;align-items:center;margin-top:3px"><span style="font-size:10px;color:#f59e0b;font-weight:700;margin-right:4px">🎁 Bonificado:</span>${bonusSummaryLine}</div>`:''}
            </div>
            <div id="${secId}" style="display:${isMonthOpen?'block':'none'}">${monthRows}</div>
          </div>`;
        }).join('');
      })()}
    </div>
  </div>`;
})()}
</div>`;
body.appendChild(card);
});
setTimeout(() => {
  document.querySelectorAll('[data-cli-oid]').forEach(el => {
    if (!el.dataset.swipeInit) {
      el.dataset.swipeInit = '1';
      initCliOrdSwipe(el, Number(el.dataset.cliOid));
    }
  });
}, 100);
}


//  LISTAS DE PRECIOS GLOBALES
// ═══════════════════════════════════════════════════════
function renderPriceLists() {
  const body = document.getElementById('price-lists-body');
  if (!body) return;
  if (!S.priceLists) S.priceLists = [];
  if (!window._plOpen) window._plOpen = {};
  if (!S.priceLists.length) {
    body.innerHTML = '<div style="font-size:12px;color:#64748b;padding:8px 0">Sin listas creadas. Crea una para asignar a clientes.</div>';
    return;
  }
  body.innerHTML = S.priceLists.map(pl => {
    const isOpen = !!window._plOpen[pl.id];
    const clientNames = (pl.clientIds||[]).map(cid => {
      const c = S.clients.find(x=>x.id===cid);
      return c ? `<span style="font-size:10px;background:#1e3a5f;color:#60a5fa;padding:1px 7px;border-radius:8px;margin:2px">${c.name}</span>` : '';
    }).join('');
    const priceRows = S.products.map(p => {
      const pr = pl.prices && pl.prices[p.id] != null ? pl.prices[p.id] : p.basePrice;
      const diff = pr - p.basePrice;
      const col = diff>0?'#10b981':diff<0?'#ef4444':'#94a3b8';
      return `<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px;border-bottom:1px solid #2a3050">
        <span style="color:#94a3b8">${p.name} <span class="tag">${p.presentation||''}</span></span>
        <strong style="color:${col}">${Q(pr)}</strong>
      </div>`;
    }).join('');
    return `<div class="card" style="margin-bottom:8px;padding:0;overflow:hidden">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;cursor:pointer" onclick="togglePL(${pl.id})">
        <div style="font-weight:800;font-size:14px;color:#f59e0b">${pl.name} <span style="font-size:10px;color:#64748b;font-weight:400">${(pl.clientIds||[]).length?'('+pl.clientIds.length+' clientes)':''}</span></div>
        <div style="display:flex;gap:5px;align-items:center" onclick="event.stopPropagation()">
          <button class="bs" style="font-size:11px;padding:4px 8px" onclick="editPriceList(${pl.id})">✏️</button>
          <button class="br" style="font-size:11px;padding:4px 8px" onclick="deletePriceList(${pl.id})">🗑</button>
          <span style="color:#64748b;font-size:13px;pointer-events:none">${isOpen?'▲':'▼'}</span>
        </div>
      </div>
      <div style="display:${isOpen?'block':'none'};padding:0 14px 14px">
        <div style="flex-wrap:wrap;display:flex;gap:4px;margin-bottom:8px">${clientNames||'<span style="font-size:11px;color:#64748b">Sin clientes asignados</span>'}</div>
        <details><summary style="font-size:11px;color:#64748b;cursor:pointer">Ver precios</summary><div style="margin-top:6px">${priceRows}</div></details>
      </div>
    </div>`;
  }).join('');
}

function togglePLSection() {
  const body = document.getElementById('pl-section-body');
  const arrow = document.getElementById('pl-section-arrow');
  if (!body) return;
  const open = body.style.display === 'none';
  body.style.display = open ? 'block' : 'none';
  if (arrow) arrow.textContent = open ? '▲' : '▼';
  if (open) renderPriceLists();
}

function togglePL(id) {
  if (!window._plOpen) window._plOpen = {};
  window._plOpen[id] = !window._plOpen[id];
  renderPriceLists();
}

function createPriceList() {
  const name = prompt('Nombre de la lista (ej: Lista Mayorista):');
  if (!name || !name.trim()) return;
  if (!S.priceLists) S.priceLists = [];
  const id = Date.now();
  S.priceLists.push({ id, name: name.trim(), prices: {}, clientIds: [], visibleProds: [] });
  save(); renderPriceLists();
  setTimeout(() => editPriceList(id), 100);
}

function deletePriceList(id) {
  askConfirm('¿Eliminar esta lista de precios?', '', () => {
    S.priceLists = (S.priceLists||[]).filter(pl=>pl.id!==id);
    save(); renderPriceLists(); toast('🗑 Lista eliminada');
  });
}

let _plEditState = null; // { productIds:[], clientIds:[] }

// ── Buscador de clientes para Lista de Precios ──────────────────────────────
function plSearchClients(id) {
  const txt = document.getElementById('pl-cli-search-'+id);
  const drop = document.getElementById('pl-cli-drop-'+id);
  if (!txt || !drop) return;
  const q = normalizeStr(txt.value.trim());
  const matches = S.clients.filter(c =>
    !_plEditState.clientIds.includes(c.id) &&
    (q.length===0 || normalizeStr(c.name).includes(q) || normalizeStr(c.phone||'').includes(q))
  ).slice(0, 30);
  drop.innerHTML = '';
  if (!matches.length) { drop.innerHTML = '<div class="ac-empty">Sin resultados</div>'; acOpen('pl-cli-drop-'+id); return; }
  matches.forEach(c => {
    const d = document.createElement('div');
    d.className = 'ac-opt';
    d.textContent = c.name;
    d.style.color = getPriorityColor(c.priority) || ''; d.style.textDecoration = isPriorityBlocking(c.priority) ? 'line-through' : '';
    d.onmousedown = () => {
      _plEditState.clientIds.push(c.id);
      txt.value = '';
      acClose('pl-cli-drop-'+id);
      const pl = (S.priceLists||[]).find(x=>x.id===id);
      plRenderClientChips(id, pl);
      const listEl = document.getElementById('pl-cli-list-'+id);
      if (listEl) listEl.innerHTML = plCliListOptions(id);
    };
    drop.appendChild(d);
  });
  acOpen('pl-cli-drop-'+id);
}

function plRenderClientChips(id, pl) {
  const wrap = document.getElementById('pl-cli-chips-'+id);
  if (!wrap) return;
  wrap.innerHTML = '';
  _plEditState.clientIds.forEach(cid => {
    const c = S.clients.find(x=>x.id===cid);
    if (!c) return;
    const chip = document.createElement('div');
    chip.style.cssText = 'display:flex;align-items:center;gap:5px;background:#1e2236;border:1px solid #2a3050;border-radius:20px;padding:4px 6px 4px 12px;font-size:12px;color:#f1f5f9';
    chip.innerHTML = `<span>${c.name}</span>`;
    const btn = document.createElement('button');
    btn.textContent = '✕';
    btn.style.cssText = 'background:none;border:none;color:#ef4444;cursor:pointer;font-size:13px;padding:2px 4px';
    btn.onclick = () => {
      _plEditState.clientIds = _plEditState.clientIds.filter(x=>x!==cid);
      plRenderClientChips(id, pl);
      const listEl = document.getElementById('pl-cli-list-'+id);
      if (listEl) listEl.innerHTML = plCliListOptions(id);
    };
    chip.appendChild(btn);
    wrap.appendChild(chip);
  });
}

// ── Buscador de productos para Lista de Precios ─────────────────────────────
function plSearchProds(id) {
  const txt = document.getElementById('pl-prod-search-'+id);
  const drop = document.getElementById('pl-prod-drop-'+id);
  if (!txt || !drop) return;
  const q = normalizeStr(txt.value.trim());
  const matches = S.products.filter(p =>
    !_plEditState.productIds.includes(p.id) &&
    (q.length===0 || normalizeStr(p.name).includes(q) || normalizeStr(p.presentation||'').includes(q))
  ).slice(0, 30);
  drop.innerHTML = '';
  if (!matches.length) { drop.innerHTML = '<div class="ac-empty">Sin resultados</div>'; acOpen('pl-prod-drop-'+id); return; }
  matches.forEach(p => {
    const d = document.createElement('div');
    d.className = 'ac-opt';
    d.innerHTML = `${p.name}${p.presentation?` <small>${p.presentation}</small>`:''}`;
    d.onmousedown = () => {
      _plEditState.productIds.push(p.id);
      txt.value = '';
      acClose('pl-prod-drop-'+id);
      const pl = (S.priceLists||[]).find(x=>x.id===id);
      plRenderProdChips(id, pl);
      const listEl = document.getElementById('pl-prod-list-'+id);
      if (listEl) listEl.innerHTML = plProdListOptions(id);
    };
    drop.appendChild(d);
  });
  acOpen('pl-prod-drop-'+id);
}

function plRenderProdChips(id, pl) {
  const wrap = document.getElementById('pl-prod-chips-'+id);
  if (!wrap) return;
  wrap.innerHTML = '';
  // Recorrer en el orden del listado general, filtrando solo los seleccionados
  S.products.filter(p => _plEditState.productIds.includes(p.id)).forEach(p => {
    const pid = p.id;
    const val = pl.prices && pl.prices[pid]!=null ? pl.prices[pid] : p.basePrice;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:8px;background:#161929;border-radius:8px;padding:6px 8px';
    row.innerHTML = `
      <span style="font-size:12px;color:#f1f5f9;flex:1">${p.name} <span class="tag">${p.presentation||''}</span></span>
      <span style="font-size:10px;color:#64748b">${Q(p.basePrice)}</span>
      <input type="number" step="0.01" value="${val}" id="plp-${id}-${pid}" style="width:80px;background:#0d0f18;border:1px solid #2a3050;border-radius:6px;padding:4px 6px;color:#f1f5f9;font-size:12px"/>`;
    const btn = document.createElement('button');
    btn.textContent = '✕';
    btn.style.cssText = 'background:none;border:none;color:#ef4444;cursor:pointer;font-size:14px;padding:0 4px;flex-shrink:0';
    btn.onclick = () => {
      _plEditState.productIds = _plEditState.productIds.filter(x=>x!==pid);
      plRenderProdChips(id, pl);
      const listEl = document.getElementById('pl-prod-list-'+id);
      if (listEl) listEl.innerHTML = plProdListOptions(id);
    };
    row.appendChild(btn);
    wrap.appendChild(row);
  });
}

function plProdListOptions(id) {
  const remaining = S.products.filter(p => !_plEditState.productIds.includes(p.id));
  if (!remaining.length) return '<option value="">Todos los productos ya están agregados</option>';
  const famGroups = {};
  remaining.forEach(p => {
    const fam = p.family && p.family.trim() ? p.family.trim() : '— Sin departamento —';
    if (!famGroups[fam]) famGroups[fam] = [];
    famGroups[fam].push(p);
  });
  const famsSorted = Object.keys(famGroups).sort((a,b) => a==='— Sin departamento —'?1:b==='— Sin departamento —'?-1:a.localeCompare(b,'es'));
  return famsSorted.map(fam =>
    `<optgroup label="${fam}">${famGroups[fam].map(p=>`<option value="${p.id}">${p.name} — ${p.presentation||'—'}</option>`).join('')}</optgroup>`
  ).join('');
}

function plAddFromList(id) {
  const sel = document.getElementById('pl-prod-list-'+id);
  if (!sel) return;
  const ids = Array.from(sel.selectedOptions).map(o=>Number(o.value)).filter(Boolean);
  if (!ids.length) return;
  ids.forEach(pid => { if (!_plEditState.productIds.includes(pid)) _plEditState.productIds.push(pid); });
  const pl = (S.priceLists||[]).find(x=>x.id===id);
  plRenderProdChips(id, pl);
  const listEl = document.getElementById('pl-prod-list-'+id);
  if (listEl) listEl.innerHTML = plProdListOptions(id);
}

function plCliListOptions(id) {
  const remaining = S.clients.filter(c => !_plEditState.clientIds.includes(c.id));
  if (!remaining.length) return '<option value="">Todos los clientes ya están agregados</option>';
  return remaining.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

function plAddCliFromList(id) {
  const sel = document.getElementById('pl-cli-list-'+id);
  if (!sel) return;
  const ids = Array.from(sel.selectedOptions).map(o=>Number(o.value)).filter(Boolean);
  if (!ids.length) return;
  ids.forEach(cid => { if (!_plEditState.clientIds.includes(cid)) _plEditState.clientIds.push(cid); });
  const pl = (S.priceLists||[]).find(x=>x.id===id);
  plRenderClientChips(id, pl);
  const listEl = document.getElementById('pl-cli-list-'+id);
  if (listEl) listEl.innerHTML = plCliListOptions(id);
}

function editPriceList(id) {
  const pl = (S.priceLists||[]).find(x=>x.id===id);
  if (!pl) return;
  if (!pl.visibleProds) pl.visibleProds = Object.keys(pl.prices||{}).map(Number); // compatibilidad con listas ya creadas: solo los que ya tienen precio
  _plEditState = { productIds: pl.visibleProds.slice(), clientIds: (pl.clientIds||[]).slice() };
  const modal = document.getElementById('confirm-modal');
  const inner = modal.querySelector('div');
  inner.innerHTML = `
    <div style="font-weight:800;font-size:15px;color:#f59e0b;margin-bottom:10px;flex-shrink:0">✏️ ${pl.name}</div>
    <div style="overflow-y:auto;flex:1;min-height:0;text-align:left">
    <div style="font-size:11px;color:#94a3b8;font-weight:700;margin-bottom:4px">ASIGNAR A CLIENTES:</div>
    <div style="position:relative;margin-bottom:6px">
      <input type="text" id="pl-cli-search-${id}" class="inp" placeholder="Buscar cliente por nombre..." oninput="plSearchClients(${id})" autocomplete="off"/>
      <div id="pl-cli-drop-${id}" class="ac-drop" style="position:absolute;left:0;right:0"></div>
    </div>
    <div id="pl-cli-chips-${id}" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px"></div>
    <div style="font-size:11px;color:#94a3b8;margin-bottom:4px">O elige del listado (manten presionado para varios):</div>
    <select class="inp" id="pl-cli-list-${id}" multiple style="margin-bottom:6px;height:100px">${plCliListOptions(id)}</select>
    <button class="bg" style="width:100%;padding:8px;margin-bottom:12px" onclick="plAddCliFromList(${id})">+ Agregar seleccionados</button>

    <div style="font-size:11px;color:#94a3b8;font-weight:700;margin-bottom:4px">PRODUCTOS EN LA LISTA:</div>
    <div style="position:relative;margin-bottom:6px">
      <input type="text" id="pl-prod-search-${id}" class="inp" placeholder="Buscar producto por nombre..." oninput="plSearchProds(${id})" autocomplete="off"/>
      <div id="pl-prod-drop-${id}" class="ac-drop" style="position:absolute;left:0;right:0"></div>
    </div>
    <div id="pl-prod-chips-${id}" style="max-height:260px;overflow-y:auto;margin-bottom:6px"></div>
    <div style="font-size:11px;color:#94a3b8;margin-bottom:4px">O elige del listado (manten presionado para varios):</div>
    <select class="inp" id="pl-prod-list-${id}" multiple style="margin-bottom:6px;height:120px">${plProdListOptions(id)}</select>
    <button class="bg" style="width:100%;padding:8px;margin-bottom:6px" onclick="plAddFromList(${id})">+ Agregar seleccionados</button>
    </div>
    <div style="display:flex;gap:8px;margin-top:12px;flex-shrink:0">
      <button onclick="confirmDel(false)" style="flex:1;padding:10px;border-radius:9px;border:1px solid #475569;background:transparent;color:#f1f5f9;font-weight:700;cursor:pointer">Cancelar</button>
      <button onclick="confirmDel(true)" style="flex:1;padding:10px;border-radius:9px;border:none;background:#f59e0b;color:#000;font-weight:800;cursor:pointer">✔ Guardar</button>
    </div>`;
  modal.style.display = 'flex';
  plRenderClientChips(id, pl);
  plRenderProdChips(id, pl);
  _confirmCb = () => {
    // Guardar precios leyendo lo que el usuario haya escrito en cada input
    _plEditState.productIds.forEach(pid => {
      const inp = document.getElementById(`plp-${id}-${pid}`);
      if (inp) {
        pl.prices[pid] = Number(inp.value);
      } else if (pl.prices[pid] == null) {
        const p = S.products.find(x=>x.id===pid);
        pl.prices[pid] = p ? p.basePrice : 0;
      }
    });
    pl.visibleProds = _plEditState.productIds.slice();
    // Guardar clientes y aplicar precios
    const newClients = _plEditState.clientIds.slice();
    // Quitar lista de clientes anteriores que ya no están
    (pl.clientIds||[]).forEach(cid => {
      if (!newClients.includes(cid)) {
        if (S.cp[cid] && S.cp[cid]._priceListId === id) {
          delete S.cp[cid]._priceListId;
        }
      }
    });
    pl.clientIds = newClients;
    // Aplicar precios a clientes asignados, respetando la visibilidad elegida
    newClients.forEach(cid => {
      if (!S.cp[cid]) S.cp[cid] = {};
      const existing = S.cp[cid];
      S.products.forEach(p => { existing[p.id] = pl.prices[p.id]; });
      existing._priceListId = id;
      existing._visible = pl.visibleProds.slice();
    });
    save(); renderPriceLists(); toast('✅ Lista guardada y aplicada a clientes','#10b981');
  };
}


function addCliComment(cid) {
  const inp = document.getElementById('new-cli-com-'+cid);
  const txt = inp ? inp.value.trim() : '';
  if (!txt) return toast('Escribe un comentario','#f59e0b');
  if (!S.savedComments) S.savedComments = {};
  let arr = S.savedComments[cid] || [];
  if (!Array.isArray(arr)) arr = [];
  if (arr.includes(txt)) return toast('Ya existe ese comentario','#f59e0b');
  arr.push(txt);
  S.savedComments[cid] = arr;
  save(); toast('💬 Comentario anclado','#10b981'); renderClients();
}

function removeCliComment(cid, idx) {
  if (!S.savedComments || !S.savedComments[cid]) return;
  let arr = S.savedComments[cid];
  if (!Array.isArray(arr)) return;
  arr.splice(idx, 1);
  S.savedComments[cid] = arr;
  save(); renderClients();
}

function addCliNote(cid) {
  if (!S.clientNotesArr) S.clientNotesArr = {};
  if (!S.clientNotesArr[cid]) S.clientNotesArr[cid] = [];
  const idx = S.clientNotesArr[cid].length;
  S.clientNotesArr[cid].push({ title: '', body: '' });
  if (!window._noteOpen) window._noteOpen = {};
  window._noteOpen[`${cid}_${idx}`] = true;
  save(); renderClients();
  setTimeout(() => {
    const el = document.getElementById(`note-title-${cid}-${idx}`);
    if (el) el.focus();
  }, 100);
}

function toggleCliNote(cid, idx) {
  if (!window._noteOpen) window._noteOpen = {};
  const key = `${cid}_${idx}`;
  window._noteOpen[key] = !window._noteOpen[key];
  renderClients();
}



function saveCliNote(cid, idx) {
  if (!S.clientNotesArr || !S.clientNotesArr[cid]) return;
  const title = document.getElementById(`note-title-${cid}-${idx}`)?.value.trim() || '';
  const bodyEl = document.getElementById(`note-body-${cid}-${idx}`);
  const body = bodyEl ? bodyEl.value.trim() : '';
  S.clientNotesArr[cid][idx] = { title, body };
  if (!window._noteOpen) window._noteOpen = {};
  window._noteOpen[`${cid}_${idx}`] = false;
  save(); toast('📝 Nota guardada', '#10b981'); renderClients();
}

function deleteCliNote(cid, idx) {
  if (!S.clientNotesArr || !S.clientNotesArr[cid]) return;
  S.clientNotesArr[cid].splice(idx, 1);
  save(); renderClients();
}

function setDefaultAddress(cid, idx) {
  if (!S.defaultAddresses) S.defaultAddresses = {};
  if (S.defaultAddresses[cid] === idx) {
    // Ya estaba marcada como favorita: al presionar de nuevo, se deselecciona
    delete S.defaultAddresses[cid];
    save(); toast('☆ Favorita quitada','#94a3b8'); renderClients();
  } else {
    S.defaultAddresses[cid] = idx;
    save(); toast('📍 Dirección predeterminada guardada','#10b981'); renderClients();
  }
}

// Marca una dirección de la lista como "Fiscal" y refleja su texto
// en el campo "Dirección" de la ficha del cliente. Independiente de la
// favorita (⭐) usada en el formulario de pedidos: pueden coincidir o no.
function setPrincipalAddress(cid, idx) {
  if (!S.principalAddresses) S.principalAddresses = {};
  S.principalAddresses[cid] = idx;
  const arr = (S.savedAddresses && S.savedAddresses[cid]) || [];
  const c = S.clients.find(x => x.id === cid);
  if (c && arr[idx] !== undefined) c.address = arr[idx];
  save(); toast('🧾 Dirección fiscal actualizada','#10b981'); renderClients();
}

// Si el listado de direcciones del cliente queda con una sola entrada,
// esta pasa a ser automáticamente la Fiscal y llena el campo "Dirección"
// de la ficha del cliente. Devuelve true si hizo algún cambio (para que
// quien la llame en lote sepa si necesita guardar).
function enforceSoloUnaEsFiscal(cid) {
  const arr = (S.savedAddresses && S.savedAddresses[cid]) || [];
  if (arr.length !== 1) return false;
  if (!S.principalAddresses) S.principalAddresses = {};
  const c = S.clients.find(x => x.id === cid);
  const yaEsFiscal = S.principalAddresses[cid] === 0;
  const yaSincronizada = c && c.address === arr[0];
  if (yaEsFiscal && yaSincronizada) return false;
  S.principalAddresses[cid] = 0;
  if (c) c.address = arr[0];
  return true;
}

// Revisión de todos los clientes: corrige retroactivamente a quienes ya
// tenían una sola dirección guardada antes de que existiera esta regla
// (su campo "Dirección" pudo haber quedado vacío o desactualizado).
function migrateSoloUnaEsFiscal() {
  if (!S.clients || !S.savedAddresses) return;
  let changed = false;
  S.clients.forEach(c => { if (enforceSoloUnaEsFiscal(c.id)) changed = true; });
  if (changed) save();
}

// Guarda el nuevo orden de la lista de Direcciones tras arrastrar. Remapea
// los índices de Favorita (⭐) y Fiscal, ya que ambos se guardan por
// posición y esa posición cambia al reordenar.
function saveClientAddrOrder(container, cid) {
  if (!S.savedAddresses || !S.savedAddresses[cid]) return;
  const oldIdxs = [...container.querySelectorAll('.cli-addr-item')].map(el => Number(el.dataset.idx));
  const arr = S.savedAddresses[cid];
  S.savedAddresses[cid] = oldIdxs.map(i => arr[i]);
  if (S.defaultAddresses && S.defaultAddresses[cid] !== undefined) {
    const ni = oldIdxs.indexOf(S.defaultAddresses[cid]);
    if (ni !== -1) S.defaultAddresses[cid] = ni; else delete S.defaultAddresses[cid];
  }
  if (S.principalAddresses && S.principalAddresses[cid] !== undefined) {
    const ni = oldIdxs.indexOf(S.principalAddresses[cid]);
    if (ni !== -1) S.principalAddresses[cid] = ni; else delete S.principalAddresses[cid];
  }
  save(); renderClients();
}

// Guarda el nuevo orden de la lista de Notas tras arrastrar.
function saveClientNotesOrder(container, cid) {
  if (!S.clientNotesArr || !S.clientNotesArr[cid]) return;
  const oldIdxs = [...container.querySelectorAll('.cli-note-item')].map(el => Number(el.dataset.idx));
  const arr = S.clientNotesArr[cid];
  S.clientNotesArr[cid] = oldIdxs.map(i => arr[i]);
  // Las notas abiertas para edición se identifican por posición; al
  // reordenar, cerrar cualquier nota abierta de este cliente para evitar
  // que quede mostrando el contenido de otra nota por error.
  if (window._noteOpen) {
    Object.keys(window._noteOpen).forEach(k => { if (k.startsWith(cid+'_')) delete window._noteOpen[k]; });
  }
  save(); renderClients();
}

// Activa el arrastre para las secciones de Direcciones/Notas que estén
// abiertas. Se llama tras cada render, ya que el DOM se reconstruye.
function initOpenClientSortSections() {
  if (!window._cliSecOpen) return;
  Object.keys(window._cliSecOpen).forEach(id => {
    if (!window._cliSecOpen[id]) return;
    const cid = Number(id.split('-').pop());
    const el = document.getElementById(id);
    if (!el) return;
    if (id.startsWith('csd-')) setupDrag(el, (c) => saveClientAddrOrder(c, cid), 'cli-addr-item');
    else if (id.startsWith('csn-')) setupDrag(el, (c) => saveClientNotesOrder(c, cid), 'cli-note-item');
  });
}

// Sincroniza el campo "Dirección" de la ficha del cliente hacia su listado
// general de direcciones, marcándola como "Fiscal":
// - Si el texto ya existe tal cual en el listado, solo marca esa entrada.
// - Si no existe, agrega una entrada nueva y mueve el marcador Fiscal a
//   ella, dejando la entrada anterior suelta en la lista (conserva su
//   marca de favorita ⭐ si la tenía, ya que su índice no cambia).
function syncPrincipalAddressFromField(cid, txt) {
  if (!txt) return;
  if (!S.savedAddresses) S.savedAddresses = {};
  if (!S.principalAddresses) S.principalAddresses = {};
  let arr = S.savedAddresses[cid] || [];
  if (!Array.isArray(arr)) arr = [];
  const existingIdx = arr.indexOf(txt);
  if (existingIdx !== -1) {
    S.principalAddresses[cid] = existingIdx;
  } else {
    arr.push(txt);
    S.principalAddresses[cid] = arr.length - 1;
  }
  S.savedAddresses[cid] = arr;
  enforceSoloUnaEsFiscal(cid);
}

function addCliAddress(cid) {
  const inp = document.getElementById('new-cli-addr-'+cid);
  const txt = inp ? inp.value.trim() : '';
  if (!txt) return toast('Escribe una dirección','#f59e0b');
  if (!S.savedAddresses) S.savedAddresses = {};
  let arr = S.savedAddresses[cid] || [];
  if (!Array.isArray(arr)) arr = [];
  if (arr.includes(txt)) return toast('Ya existe esa dirección','#f59e0b');
  arr.push(txt);
  S.savedAddresses[cid] = arr;
  enforceSoloUnaEsFiscal(cid);
  save(); toast('📍 Dirección guardada','#10b981'); renderClients();
}

function removeCliAddress(cid, idx) {
  if (!S.savedAddresses || !S.savedAddresses[cid]) return;
  let arr = S.savedAddresses[cid];
  if (!Array.isArray(arr)) return;
  arr.splice(idx, 1);
  S.savedAddresses[cid] = arr;
  // Reacomodar el índice de la dirección "Fiscal" tras el borrado
  if (S.principalAddresses && S.principalAddresses[cid] !== undefined) {
    if (S.principalAddresses[cid] === idx) delete S.principalAddresses[cid];
    else if (S.principalAddresses[cid] > idx) S.principalAddresses[cid]--;
  }
  enforceSoloUnaEsFiscal(cid);
  save(); renderClients();
}

function editCliAddress(cid, idx) {
  if (!S.savedAddresses || !S.savedAddresses[cid]) return;
  const arr = S.savedAddresses[cid];
  const newVal = prompt('Editar dirección:', arr[idx]);
  if (newVal === null) return;
  const txt = newVal.trim();
  if (!txt) return toast('La dirección no puede estar vacía','#f59e0b');
  arr[idx] = txt;
  S.savedAddresses[cid] = arr;
  // Si esta es la dirección marcada como Fiscal, reflejar el cambio en la ficha del cliente
  if (S.principalAddresses && S.principalAddresses[cid] === idx) {
    const c = S.clients.find(x => x.id === cid);
    if (c) c.address = txt;
  }
  save(); toast('📍 Dirección actualizada','#10b981'); renderClients();
}

function newOrderForClient(cid) {
  const _cliChk = S.clients.find(c => c.id === Number(cid));
  if (isClientBlocked(_cliChk)) {
    toast('🔒 Este cliente está bloqueado. No se pueden generar pedidos nuevos.', '#ef4444');
    return;
  }
  editingOid = null;
  _isDuplicateSession = false; _duplicatingData = null; _duplicatingFrom = null;
  ordItems = [{pid:'',qty:1}];
  ordComments = [''];
  goTab('order');
  setTimeout(() => {
    const _cli = S.clients.find(c => c.id === Number(cid));
    document.getElementById('ord-cli').value = cid;
    const cliTxt = document.getElementById('ord-cli-txt');
    if (cliTxt && _cli) cliTxt.value = _cli.name;
    document.getElementById('ord-iva-inc').checked = true;
    document.getElementById('ord-iva').checked = false;
    onCliChange();
    refreshTotalWithIVA();
  }, 100);
}




function toggleCli(cid) {
  const opening = !window._cliOpen[cid];
  if (opening) {
    Object.keys(window._cliOpen).forEach(k => { window._cliOpen[k] = false; });
    window._cliOpen[cid] = true;
    window._floatCid = Number(cid);
    renderClients();
    setTimeout(() => restoreFloatingCard(cid), 150);
  } else {
    window._cliOpen[cid] = false;
    window._floatCid = null;
    closeFloatingCard();
    renderClients();
  }
}
function cancelEditCliForm(id) {
  const c = S.clients.find(x=>x.id===Number(id));
  if (c && c.isProspect) {
    goTab('prospects');
  } else {
    renderClients();
  }
}

function updateRestProdCount(cid) {
  const list = document.getElementById('restprod-list-'+cid);
  const countEl = document.getElementById('restprod-count-'+cid);
  if (!list || !countEl) return;
  const n = list.querySelectorAll('.restprod-chk:checked').length;
  countEl.textContent = n ? (n+' producto(s) autorizado(s)') : 'Ninguno autorizado';
}

function closeRestProdList(cid) {
  const list = document.getElementById('restprod-list-'+cid);
  const arrow = document.getElementById('restprod-arrow-'+cid);
  if (list) list.style.display = 'none';
  if (arrow) arrow.textContent = '▸';
  document.removeEventListener('click', window['_restProdOutsideHandler_'+cid]);
  delete window['_restProdOutsideHandler_'+cid];
}

function toggleRestProdList(cid) {
  const list = document.getElementById('restprod-list-'+cid);
  const arrow = document.getElementById('restprod-arrow-'+cid);
  if (!list) return;
  const opening = list.style.display === 'none';
  list.style.display = opening ? 'block' : 'none';
  if (arrow) arrow.textContent = opening ? '▾' : '▸';

  if (opening) {
    const handler = function(e) {
      const wrap = document.getElementById('restprod-wrap-'+cid);
      if (wrap && !wrap.contains(e.target)) closeRestProdList(cid);
    };
    window['_restProdOutsideHandler_'+cid] = handler;
    setTimeout(() => document.addEventListener('click', handler), 0);
  } else {
    document.removeEventListener('click', window['_restProdOutsideHandler_'+cid]);
    delete window['_restProdOutsideHandler_'+cid];
  }
}

function buildRestrictedProdChecklist(c) {
  const restFams = S.restrictedFamilies || [];
  if (!restFams.length) return '';
  const authorized = c.authorizedProducts || (c.authorizedRestricted ? S.products.filter(p=>restFams.includes((p.family||'').trim())).map(p=>p.id) : []);
  const countTxt = authorized.length ? (authorized.length+' producto(s) autorizado(s)') : 'Ninguno autorizado';
  let html = '<div onclick="toggleRestProdList('+c.id+')" style="display:flex;justify-content:space-between;align-items:center;background:#052e16;border:1px solid #10b981;border-radius:8px;padding:10px;margin-bottom:2px;cursor:pointer">'
            + '<span style="font-size:12px;color:#10b981;font-weight:700">🔒 Permisos de productos restringidos</span>'
            + '<span style="font-size:11px;color:#94a3b8"><span id="restprod-count-'+c.id+'">'+countTxt+'</span> <span id="restprod-arrow-'+c.id+'" style="display:inline-block">▸</span></span>'
            + '</div>';
  html += '<div id="restprod-list-'+c.id+'" style="display:none;background:#052e16;border:1px solid #10b981;border-top:none;border-radius:0 0 8px 8px;padding:10px;margin-bottom:12px;max-height:220px;overflow-y:auto">';
  restFams.forEach(fam => {
    const prods = S.products.filter(p => (p.family||'').trim() === fam);
    if (!prods.length) return;
    html += '<div style="font-size:11px;font-weight:800;color:#10b981;text-transform:uppercase;letter-spacing:1px;margin:8px 0 4px">'+fam+'</div>';
    prods.forEach(p => {
      const checked = authorized.includes(p.id) ? 'checked' : '';
      html += '<label style="display:flex;align-items:center;gap:7px;padding:4px 0;cursor:pointer">'
            + '<input type="checkbox" class="restprod-chk" data-pid="'+p.id+'" data-cid="'+c.id+'" '+checked+' onchange="updateRestProdCount('+c.id+')" style="width:15px;height:15px;accent-color:#10b981;flex-shrink:0"/>'
            + '<span style="font-size:12px;color:#f1f5f9">'+p.name+(p.presentation?' ('+p.presentation+')':'')+'</span>'
            + '</label>';
    });
  });
  html += '</div>';
  return html;
}

function editCliForm(id) {
const c = S.clients.find(x=>x.id===id);
const curDept = (S.depts||[]).find(d=>d.id===c.deptId);
const curMun  = (S.municipios||[]).find(m=>m.id===c.municipioId);
const linkedClient = c.linkedFromClientId ? S.clients.find(x=>x.id===c.linkedFromClientId) : null;
document.getElementById("cc-"+id).innerHTML =
'<label class="lbl">Nombre</label><input class="inp" id="ecn-'+id+'" value="'+c.name+'"/>' +
'<label class="lbl">ID Cliente</label><input class="inp" id="eccid-'+id+'" value="'+(c.clientCode||'')+'" placeholder="Código de identificación"/>' +
'<label class="lbl">⭐ Prioridad</label><select class="sel" id="ecpriority-'+id+'" style="width:100%;margin-bottom:12px"><option value="">— Sin prioridad —</option>'+(S.priorityList||[]).map(p=>'<option value="'+p.name+'" '+(c.priority===p.name?'selected':'')+'>'+p.name+'</option>').join('')+'</select>' +
'<label class="lbl">🔗 Cuenta anterior (opcional)</label>' +
'<div style="font-size:11px;color:#64748b;margin-bottom:4px">Si este cliente reemplaza a otro (cambio de razón social), relaciónalo aquí para ver su historial de pedidos.</div>' +
'<div style="position:relative;margin-bottom:6px">' +
'<input id="ecll-'+id+'" class="inp" style="margin-bottom:0" placeholder="Buscar cliente anterior..." value="'+(linkedClient?linkedClient.name.replace(/"/g,'&quot;'):'')+'" autocomplete="off" oninput="cliLinkSearch('+id+',this.value)" onfocus="cliLinkSearch('+id+',this.value)"/>' +
'<input type="hidden" id="ecl-'+id+'" value="'+(c.linkedFromClientId||'')+'"/>' +
'<div id="ecldrop-'+id+'" style="display:none;position:absolute;top:100%;left:0;right:0;background:#1e2640;border:1px solid #a855f7;border-radius:8px;z-index:200;max-height:160px;overflow-y:auto"></div>' +
'</div>' +
'<button type="button" onclick="unlinkCliPrevious('+id+')" style="font-size:11px;background:none;border:1px solid #ef4444;color:#ef4444;border-radius:8px;padding:3px 10px;cursor:pointer;margin-bottom:12px">Quitar relación</button>' +
'<div id="restprod-wrap-'+id+'">' + buildRestrictedProdChecklist(c) + '</div>' +
'<label class="lbl">Contacto</label><input class="inp" id="eccontact-'+id+'" value="'+(c.contact||'')+'" placeholder="Nombre de la persona de contacto"/>' +
'<label class="lbl">Teléfono</label><input class="inp" id="ecp-'+id+'" value="'+(c.phone||"")+'" />' +
'<label class="lbl">Dirección</label><input class="inp" id="eca-'+id+'" value="'+(c.address||"")+'" />' +
'<label class="lbl">🚚 Ruta</label>' +
'<select id="ecr-'+id+'" class="sel" style="margin-bottom:12px;width:100%" onchange="clearCliDeptSector('+id+')">' +
'<option value="">— Sin ruta —</option>' +
[...(S.rutasCliente||[])].sort((a,b)=>a.name.localeCompare(b.name,'es')).map(r=>'<option value="'+r.id+'"'+(c.rutaClienteId===r.id?' selected':'')+'>'+r.name+'</option>').join('') +
'</select>' +
'<label class="lbl">🏛️ Departamento</label>' +
'<div style="position:relative;margin-bottom:10px">' +
'<input id="ecdl-'+id+'" class="inp" style="margin-bottom:0" placeholder="Buscar departamento..." value="'+(curDept?curDept.name:'')+'" autocomplete="off" oninput="cliFieldSearch(\'dept\','+id+',this.value)" onfocus="cliFieldSearch(\'dept\','+id+',this.value)"/>' +
'<input type="hidden" id="ecc-'+id+'" value="'+(c.deptId||'')+'"/>' +
'<div id="ecdrop-'+id+'" style="display:none;position:absolute;top:100%;left:0;right:0;background:#1e2640;border:1px solid #3b82f6;border-radius:8px;z-index:200;max-height:160px;overflow-y:auto"></div>' +
'</div>' +
'<label class="lbl">🏘️ Sector</label>' +
'<div style="position:relative;margin-bottom:10px">' +
'<input id="ecml-'+id+'" class="inp" style="margin-bottom:0" placeholder="Buscar sector..." value="'+(curMun?curMun.name:'')+'" autocomplete="off" oninput="cliFieldSearch(\'mun\','+id+',this.value)" onfocus="cliFieldSearch(\'mun\','+id+',this.value)"/>' +
'<input type="hidden" id="ecm-'+id+'" value="'+(c.municipioId||'')+'"/>' +
'<div id="ecmdrop-'+id+'" style="display:none;position:absolute;top:100%;left:0;right:0;background:#1e2040;border:1px solid #7c3aed;border-radius:8px;z-index:200;max-height:160px;overflow-y:auto"></div>' +
'</div>' +
'<div class="two">' +
'<button class="bg" onclick="saveCliForm('+id+')">✔ Guardar</button>' +
'<button class="bs" onclick="cancelEditCliForm('+id+')">Cancelar</button>' +
'</div>';
}

function cliLinkSearch(cid, q) {
  const drop = document.getElementById('ecldrop-'+cid);
  if (!drop) return;
  const ql = q.toLowerCase();
  let list = S.clients.filter(x => x.id !== cid && (!ql || x.name.toLowerCase().includes(ql)));
  list = list.sort((a,b)=>a.name.localeCompare(b.name,'es')).slice(0,30);
  if (!list.length) { drop.style.display='block'; drop.innerHTML = '<div style="padding:9px 12px;font-size:12px;color:#64748b">Sin resultados</div>'; return; }
  drop.style.display='block';
  drop.innerHTML = list.map(x=>
    `<div onclick="selectCliLink(${cid},${x.id},'${x.name.replace(/'/g,"\\'")}');event.stopPropagation()"
      style="padding:9px 12px;font-size:13px;${priorityNameStyle(x.priority,'#f1f5f9')}cursor:pointer;border-bottom:1px solid #2a3050"
      onmousedown="event.preventDefault()">
      ${x.name}
    </div>`
  ).join('');
  setTimeout(()=>{ document.addEventListener('click', ()=>{ drop.style.display='none'; }, {once:true}); }, 50);
}

function selectCliLink(cid, linkedId, name) {
  if (getLinkedOldClientIds(linkedId).includes(Number(cid)) || Number(linkedId) === Number(cid)) {
    toast('⚠️ No se puede crear una relación circular entre estos clientes', '#ef4444');
    return;
  }
  const lbl = document.getElementById('ecll-'+cid);
  const hid = document.getElementById('ecl-'+cid);
  const drp = document.getElementById('ecldrop-'+cid);
  if (lbl) lbl.value = name;
  if (hid) hid.value = linkedId;
  if (drp) drp.style.display = 'none';
}

function unlinkCliPrevious(cid) {
  const lbl = document.getElementById('ecll-'+cid);
  const hid = document.getElementById('ecl-'+cid);
  if (lbl) lbl.value = '';
  if (hid) hid.value = '';
}

function cliFieldSearch(type, cid, q) {
  const isDept = type==='dept';
  let list = isDept ? (S.depts||[]) : (S.municipios||[]);
  const dropId = isDept ? 'ecdrop-'+cid : 'ecmdrop-'+cid;
  const drop   = document.getElementById(dropId);
  if (!drop) return;
  // Cascada: Departamento filtra por Ruta elegida; Sector filtra por Departamento elegido
  if (isDept) {
    const rutaSel = document.getElementById('ecr-'+cid);
    const rutaId = rutaSel && rutaSel.value ? Number(rutaSel.value) : null;
    if (rutaId) list = list.filter(d => (d.rutaIds||[]).includes(rutaId));
    else { drop.style.display='block'; drop.innerHTML = '<div style="padding:9px 12px;font-size:12px;color:#f59e0b">Selecciona primero una Ruta</div>'; return; }
  } else {
    const deptHidden = document.getElementById('ecc-'+cid);
    const deptId = deptHidden && deptHidden.value ? Number(deptHidden.value) : null;
    if (deptId) list = list.filter(m => (m.deptIds||[]).includes(deptId));
    else { drop.style.display='block'; drop.innerHTML = '<div style="padding:9px 12px;font-size:12px;color:#f59e0b">Selecciona primero un Departamento</div>'; return; }
  }
  const ql = q.toLowerCase();
  let filtered = ql ? list.filter(x=>x.name.toLowerCase().includes(ql)) : list;
  filtered = [...filtered].sort((a,b)=>a.name.localeCompare(b.name,'es'));
  if (!filtered.length) { drop.style.display='block'; drop.innerHTML = '<div style="padding:9px 12px;font-size:12px;color:#64748b">Sin resultados</div>'; return; }
  drop.style.display='block';
  drop.innerHTML = filtered.map(x=>
    `<div onclick="selectCliField('${type}',${cid},${x.id},'${x.name.replace(/'/g,"\\'")}');event.stopPropagation()"
      style="padding:9px 12px;font-size:13px;color:#f1f5f9;cursor:pointer;border-bottom:1px solid #2a3050"
      onmousedown="event.preventDefault()">
      ${x.name}
    </div>`
  ).join('');
  // Cerrar al hacer click fuera
  setTimeout(()=>{ document.addEventListener('click', ()=>{ drop.style.display='none'; }, {once:true}); }, 50);
}

function selectCliField(type, cid, id, name) {
  const isDept = type==='dept';
  const labelId = isDept ? 'ecdl-'+cid : 'ecml-'+cid;
  const hiddenId= isDept ? 'ecc-'+cid  : 'ecm-'+cid;
  const dropId  = isDept ? 'ecdrop-'+cid : 'ecmdrop-'+cid;
  const lbl = document.getElementById(labelId);
  const hid = document.getElementById(hiddenId);
  const drp = document.getElementById(dropId);
  if (lbl) lbl.value = name;
  if (hid) hid.value = id;
  if (drp) drp.style.display='none';
  // Cascada: si cambia el Departamento, limpiar el Sector elegido (puede que ya no pertenezca)
  if (isDept) {
    const munLbl = document.getElementById('ecml-'+cid);
    const munHid = document.getElementById('ecm-'+cid);
    if (munLbl) munLbl.value = '';
    if (munHid) munHid.value = '';
  }
}

function clearCliDeptSector(cid) {
  const deptLbl = document.getElementById('ecdl-'+cid);
  const deptHid = document.getElementById('ecc-'+cid);
  const munLbl  = document.getElementById('ecml-'+cid);
  const munHid  = document.getElementById('ecm-'+cid);
  if (deptLbl) deptLbl.value = '';
  if (deptHid) deptHid.value = '';
  if (munLbl) munLbl.value = '';
  if (munHid) munHid.value = '';
}

function saveCliForm(id) {
const c = S.clients.find(x=>x.id===id);
c.name       = document.getElementById("ecn-"+id).value.trim();
c.clientCode = document.getElementById("eccid-"+id)?.value.trim() || '';
c.contact    = document.getElementById("eccontact-"+id)?.value.trim() || '';
c.priority   = document.getElementById("ecpriority-"+id)?.value.trim() || '';
const selLink = document.getElementById("ecl-"+id)?.value;
c.linkedFromClientId = selLink ? Number(selLink) : null;
const restWrap = document.getElementById("restprod-wrap-"+id);
c.authorizedProducts = restWrap ? [...restWrap.querySelectorAll('.restprod-chk:checked')].map(el=>Number(el.dataset.pid)) : (c.authorizedProducts||[]);
delete c.authorizedRestricted;
c.phone      = document.getElementById("ecp-"+id).value.trim();
// Actualizar el nombre guardado en todos sus pedidos/cotizaciones existentes
S.orders.forEach(o => { if (Number(o.clientId) === id) o.clientName = c.name; });
c.address    = document.getElementById("eca-"+id).value.trim();
syncPrincipalAddressFromField(id, c.address);
const selDept = document.getElementById("ecc-"+id)?.value;
const selMun  = document.getElementById("ecm-"+id)?.value;
c.deptId     = selDept ? Number(selDept) : null;
c.municipioId= selMun  ? Number(selMun)  : null;
  const selRoute = document.getElementById('ecr-'+id)?.value;
  c.rutaClienteId = selRoute ? Number(selRoute) : null;
save();
if (c.isProspect) {
  toast("✔ Prospecto actualizado");
  goTab('prospects');
} else {
  toast("✔ Cliente actualizado");
  renderClients();
}
}

function captureCliPriceInputs(cid) {
  // Captura los valores actuales de los inputs de precio en pantalla,
  // sin guardarlos todavía, para no perderlos al agregar/quitar productos
  const captured = {};
  document.querySelectorAll(`[id^="pe-${cid}-"]`).forEach(inp => {
    const pid = inp.id.replace(`pe-${cid}-`, '');
    if (inp.value !== '' && !isNaN(Number(inp.value))) captured[pid] = Number(inp.value);
  });
  return captured;
}

function applyCapturedCliPrices(cid, captured) {
  if (!captured) return;
  const cp = S.cp[cid] || {};
  Object.keys(captured).forEach(pid => { cp[pid] = captured[pid]; });
  S.cp[cid] = cp;
}

function editCliPrices(cid) {
const c  = S.clients.find(x=>x.id===cid);
const cp = S.cp[cid] || S.cp[String(cid)] || {};
const visible = (cp._visible || []).map(Number);

// Productos asignados, en el mismo orden configurado en la lista general de productos
const assigned = S.products.filter(p => visible.includes(Number(p.id)));

// Productos no asignados agrupados por categoría
const unassigned = S.products.filter(p => !visible.includes(Number(p.id)));
const famGroups = {};
unassigned.forEach(p => {
  const fam = p.family && p.family.trim() ? p.family.trim() : '— Sin departamento —';
  if (!famGroups[fam]) famGroups[fam] = [];
  famGroups[fam].push(p);
});
const famsSorted = Object.keys(famGroups).sort((a,b) => a==='— Sin departamento —'?1:b==='— Sin departamento —'?-1:a.localeCompare(b,'es'));

// Filas de productos asignados
let lastFam = null;
const assignedRows = assigned.length ? assigned.map(p => {
  const val  = cp[p.id]!=null ? cp[p.id] : (cp[String(p.id)]!=null ? cp[String(p.id)] : p.basePrice);
  const ul   = p.unitLabel||'unidad';
  const us   = Number(p.unitSize)||1;
  const hint = us>1 ? `<span style="font-size:10px;color:#64748b;margin-left:5px">1 ${p.presentation}=${us} ${ul}s</span>` : '';
  const fam  = p.family && p.family.trim() ? p.family.trim() : '— Sin departamento —';
  let header = '';
  if (fam !== lastFam) { header = `<div style="font-size:10px;font-weight:800;color:#f59e0b;text-transform:uppercase;letter-spacing:1px;margin:10px 0 4px">${fam}</div>`; lastFam = fam; }
  return `${header}<div style="margin-bottom:8px;background:#161929;border-radius:8px;padding:10px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
    <span style="font-weight:700;font-size:13px">${p.name} <span class="tag">${p.presentation||'—'}</span>${hint}</span>
    <button onclick="removeCliProduct(${cid},${p.id})" style="background:none;border:1px solid #ef4444;border-radius:6px;color:#ef4444;padding:2px 8px;font-size:12px;cursor:pointer">✕</button>
  </div>
  <div style="display:flex;gap:8px;align-items:center">
    <span style="color:#64748b;font-size:12px">Base: ${Q(p.basePrice)}/${ul}</span>
    <input class="inp" id="pe-${cid}-${p.id}" type="number" step="0.01" value="${val}"
    style="margin-bottom:0;flex:1;max-width:120px" oninput="updDiff(${cid},${p.id},${p.basePrice})"/>
    <span id="pd-${cid}-${p.id}" style="font-size:11px;white-space:nowrap;min-width:55px;text-align:right"></span>
  </div>
</div>`;
}).join('') : '<div style="font-size:12px;color:#64748b;padding:8px 0">Sin productos asignados.</div>';

// Opciones del selector múltiple (agrupadas por categoría con <optgroup>)
const addOptions = unassigned.length
  ? famsSorted.map(fam =>
    `<optgroup label="${fam}">${famGroups[fam].map(p=>`<option value="${p.id}">${p.name} — ${p.presentation||'—'}</option>`).join('')}</optgroup>`
  ).join('')
  : '<option value="">Todos los productos ya están asignados</option>';

// Botones de agregar por categoría completa
const famBtns = famsSorted.map((fam,fi) => {
  const safeId = 'famcat-'+cid+'-'+fi;
  return `<button class="bs" style="font-size:11px;padding:4px 10px;margin:2px" id="${safeId}" onclick="addCliCatById('${safeId}',${cid})">+ ${fam}</button>`;
}).join('');
// Guardar mapa de fam por safeId para recuperar al hacer clic
window._famCatMap = window._famCatMap || {};
famsSorted.forEach((fam,fi) => { window._famCatMap['famcat-'+cid+'-'+fi] = fam; });

const _plSource = (() => {
  const plId = cp._priceListId;
  const pl = plId ? (S.priceLists||[]).find(x=>x.id===plId) : null;
  return pl
    ? `<span style="font-size:10px;background:#1e3a5f;color:#60a5fa;padding:2px 8px;border-radius:10px;font-weight:700">🏷️ Lista compartida: ${pl.name}</span>`
    : `<span style="font-size:10px;background:#2a1f00;color:#f59e0b;padding:2px 8px;border-radius:10px;font-weight:700">✏️ Lista personalizada</span>`;
})();
document.getElementById('cc-'+cid).innerHTML = `
<div style="font-weight:800;font-size:14px;margin-bottom:4px;color:#f59e0b">💲 Productos de ${c.name}</div>
<div style="margin-bottom:8px">${_plSource}</div>
<div class="hint" style="margin-bottom:10px">Solo estos productos aparecen al crear pedidos para este cliente.</div>
<div id="cli-prod-list-${cid}">${assignedRows}</div>
${unassigned.length ? `
<div style="margin-top:12px;border-top:1px solid #2a3050;padding-top:10px">
  <div style="font-size:11px;font-weight:800;color:#94a3b8;margin-bottom:6px">AGREGAR POR CATEGORÍA:</div>
  <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px">${famBtns}</div>
  <div style="font-size:11px;color:#94a3b8;margin-bottom:4px">O selección individual (manten presionado para varios):</div>
  <select class="inp" id="cli-add-prod-${cid}" multiple style="margin-bottom:6px;height:120px">${addOptions}</select>
  <button class="bg" style="width:100%;padding:8px" onclick="addCliProduct(${cid})">+ Agregar seleccionados</button>
</div>` : ''}
<div class="two" style="margin-top:10px">
<button class="bg" style="flex:1;padding:10px" onclick="saveCliPrices(${cid})">✔ Guardar</button>
<button class="bs" onclick="renderClients()">Cancelar</button>
</div>`;
assigned.forEach(p => updDiff(cid, p.id, p.basePrice));
}

function addCliCatById(safeId, cid) {
const fam = (window._famCatMap || {})[safeId];
if (!fam) return;
addCliCategory(cid, fam);
}

function addCliCategory(cid, fam) {
const captured = captureCliPriceInputs(cid);
const cp = S.cp[cid] || {};
let visible = (cp._visible || []).map(Number);
S.products.filter(p => (p.family&&p.family.trim()?p.family.trim():'— Sin departamento —') === fam)
  .forEach(p => { if (!visible.includes(Number(p.id))) visible.push(Number(p.id)); });
cp._visible = visible;
S.cp[cid] = cp;
applyCapturedCliPrices(cid, captured);
editCliPrices(cid);
}

function showAddProdToCliModal(cid, itemIdx) {
const c = S.clients.find(x=>x.id===cid);
if (!c) return;
const cp = S.cp[cid] || {};
const visible = (cp._visible || []).map(Number);
const unassigned = S.products.filter(p => !visible.includes(Number(p.id)));
if (!unassigned.length) return toast('Todos los productos ya están asignados a este cliente','#10b981');

// Reutilizar el modal de confirmación con contenido custom
const modal = document.getElementById('confirm-modal');
modal.querySelector('#confirm-msg').textContent = `Agregar producto a ${c.name}`;
modal.querySelector('#confirm-sub').textContent = '';
// Reemplazar botones con selector
const inner = modal.querySelector('div');
const famGroups = {};
unassigned.forEach(p => {
  const fam = p.family && p.family.trim() ? p.family.trim() : '— Sin departamento —';
  if (!famGroups[fam]) famGroups[fam] = [];
  famGroups[fam].push(p);
});
const famsSorted = Object.keys(famGroups).sort((a,b)=>a==='— Sin departamento —'?1:b==='— Sin departamento —'?-1:a.localeCompare(b,'es'));
const opts = famsSorted.map(fam=>
  `<optgroup label="${fam}">${famGroups[fam].map(p=>`<option value="${p.id}">${p.name} — ${p.presentation||'—'}</option>`).join('')}</optgroup>`
).join('');
inner.innerHTML = `
  <div style="font-size:15px;font-weight:700;color:#f59e0b;margin-bottom:8px">Agregar a ${c.name}</div>
  <div style="font-size:12px;color:#94a3b8;margin-bottom:8px">Selecciona productos (manten presionado para varios):</div>
  <select id="modal-add-prod" multiple style="width:100%;height:160px;background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:8px;padding:6px;margin-bottom:12px">${opts}</select>
  <div style="display:flex;gap:10px">
    <button onclick="confirmDel(false)" style="flex:1;padding:10px;border-radius:9px;border:1px solid #475569;background:transparent;color:#f1f5f9;font-weight:700;cursor:pointer">Cancelar</button>
    <button onclick="confirmAddProd(${cid},${itemIdx})" style="flex:1;padding:10px;border-radius:9px;border:none;background:#f59e0b;color:#000;font-weight:800;cursor:pointer">+ Agregar</button>
  </div>`;
modal.style.display = 'flex';
_confirmCb = null;
}

function confirmAddProd(cid, itemIdx) {
const sel = document.getElementById('modal-add-prod');
const selected = Array.from(sel.selectedOptions).map(o=>Number(o.value)).filter(Boolean);
if (!selected.length) return toast('Selecciona al menos un producto','#f59e0b');
const cp = S.cp[cid] || {};
let visible = (cp._visible || []).map(Number);
selected.forEach(pid => { if (!visible.includes(pid)) visible.push(pid); });
cp._visible = visible;
S.cp[cid] = cp;
save();
document.getElementById('confirm-modal').style.display = 'none';
toast('✅ Producto(s) agregados a este cliente','#10b981');
// Re-enfocar el campo de búsqueda
setTimeout(() => {
  const txt = document.getElementById('prod-txt-'+itemIdx);
  if (txt) { txt.value=''; txt.focus(); acProdInput(itemIdx); }
}, 200);
}

function addCliProduct(cid) {
const sel = document.getElementById('cli-add-prod-'+cid);
if (!sel) return;
const selected = Array.from(sel.selectedOptions).map(o => Number(o.value)).filter(Boolean);
if (!selected.length) return toast('Selecciona al menos un producto','#f59e0b');
const captured = captureCliPriceInputs(cid);
const cp = S.cp[cid] || {};
let visible = (cp._visible || []).map(Number);
selected.forEach(pid => { if (!visible.includes(pid)) visible.push(pid); });
cp._visible = visible;
S.cp[cid] = cp;
applyCapturedCliPrices(cid, captured);
editCliPrices(cid);
}

function removeCliProduct(cid, pid) {
const captured = captureCliPriceInputs(cid);
const cp = S.cp[cid] || {};
let visible = (cp._visible || []).map(Number);
visible = visible.filter(id => id !== Number(pid));
cp._visible = visible;
S.cp[cid] = cp;
applyCapturedCliPrices(cid, captured);
editCliPrices(cid);
}

function updDiff(cid, pid, base) {
const inp = document.getElementById(`pe-${cid}-${pid}`);
const el  = document.getElementById(`pd-${cid}-${pid}`);
if (!inp||!el) return;
const diff = Number(inp.value)-base;
el.textContent = diff===0 ? '' : (diff>0?'▲':'▼')+Q(Math.abs(diff));
el.style.color = diff>0?'#10b981':diff<0?'#ef4444':'';
}

let _linkExtraClients = [];

function openLinkToSharedList(cid) {
  cid = Number(cid);
  const cli = S.clients.find(x=>x.id===cid);
  if (!cli) return;
  _linkExtraClients = [];
  const modal = document.getElementById('confirm-modal');
  const inner = modal.querySelector('div');
  inner.innerHTML = `
    <div style="font-weight:800;font-size:15px;color:#f59e0b;margin-bottom:10px;flex-shrink:0">🔗 Vincular a lista compartida</div>
    <div style="overflow-y:auto;flex:1;min-height:0;text-align:left">
    <div id="link-cli-name-desc" style="font-size:11px;color:#94a3b8;margin-bottom:4px"></div>
    <div style="font-size:11px;color:#94a3b8;margin-bottom:3px">NOMBRE DE LA NUEVA LISTA:</div>
    <input type="text" id="link-new-list-name" class="inp" placeholder="Ej: Lista Mayorista" style="margin-bottom:10px"/>
    <div style="font-size:11px;color:#94a3b8;margin-bottom:4px">CLIENTES A VINCULAR (opcional, puedes agregar más después):</div>
    <div style="position:relative;margin-bottom:6px">
      <input type="text" id="link-cli-search" class="inp" placeholder="Buscar cliente por nombre..." autocomplete="off"/>
      <div id="link-cli-drop" class="ac-drop" style="position:absolute;left:0;right:0"></div>
    </div>
    <div id="link-cli-chips" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px"></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:12px;flex-shrink:0">
      <button onclick="confirmDel(false)" style="flex:1;padding:10px;border-radius:9px;border:1px solid #475569;background:transparent;color:#f1f5f9;font-weight:700;cursor:pointer">Cancelar</button>
      <button onclick="confirmDel(true)" style="flex:1;padding:10px;border-radius:9px;border:none;background:#f59e0b;color:#000;font-weight:800;cursor:pointer">✔ Crear y vincular</button>
    </div>`;
  document.getElementById('link-cli-name-desc').textContent = 'Se creará una nueva lista compartida usando los precios actuales de ' + cli.name + '.';
  const _linkSearchInput = document.getElementById('link-cli-search');
  if (_linkSearchInput) _linkSearchInput.oninput = () => linkSearchClients(cid);
  modal.style.display = 'flex';
  _confirmCb = () => {
    const name = (document.getElementById('link-new-list-name')?.value||'').trim();
    if (!name) { toast('Escribe un nombre para la lista','#ef4444'); return; }
    if (!S.priceLists) S.priceLists = [];
    const cp = S.cp[cid] || {};
    const visible = (cp._visible || []).map(Number);
    const prices = {};
    visible.forEach(pid => { prices[pid] = cp[pid] != null ? cp[pid] : (S.products.find(p=>p.id===pid)?.basePrice || 0); });
    const listId = Date.now();
    const clientIds = [Number(cid), ..._linkExtraClients];
    S.priceLists.push({ id: listId, name, prices, clientIds, visibleProds: visible.slice() });
    // Vincular a todos los clientes incluidos
    clientIds.forEach(otherCid => {
      if (!S.cp[otherCid]) S.cp[otherCid] = {};
      const otherCp = S.cp[otherCid];
      visible.forEach(pid => { otherCp[pid] = prices[pid]; });
      otherCp._visible = visible.slice();
      otherCp._priceListId = listId;
    });
    save(); renderClients();
    toast('🔗 Lista compartida creada y vinculada','#10b981');
  };
}

function linkSearchClients(cid) {
  const txt = document.getElementById('link-cli-search');
  const drop = document.getElementById('link-cli-drop');
  if (!txt || !drop) return;
  // Posicionar el desplegable de forma fija respecto a la pantalla,
  // así queda siempre visible aunque esté dentro de un contenedor con scroll
  const rect = txt.getBoundingClientRect();
  drop.style.position = 'fixed';
  drop.style.top = (rect.bottom + 2) + 'px';
  drop.style.left = rect.left + 'px';
  drop.style.width = rect.width + 'px';
  drop.style.right = 'auto';
  const q = normalizeStr(txt.value.trim());
  const matches = S.clients.filter(c =>
    Number(c.id) !== Number(cid) &&
    !_linkExtraClients.includes(c.id) &&
    (q.length===0 || normalizeStr(c.name).includes(q))
  ).slice(0, 30);
  drop.innerHTML = '';
  if (!matches.length) { drop.innerHTML = '<div class="ac-empty">Sin resultados</div>'; acOpen('link-cli-drop'); return; }
  matches.forEach(c => {
    const d = document.createElement('div');
    d.className = 'ac-opt';
    d.textContent = c.name;
    d.style.color = getPriorityColor(c.priority) || ''; d.style.textDecoration = isPriorityBlocking(c.priority) ? 'line-through' : '';
    d.onmousedown = () => {
      _linkExtraClients.push(c.id);
      txt.value = '';
      acClose('link-cli-drop');
      linkRenderClientChips();
    };
    drop.appendChild(d);
  });
  acOpen('link-cli-drop');
}

function linkRenderClientChips() {
  const wrap = document.getElementById('link-cli-chips');
  if (!wrap) return;
  wrap.innerHTML = '';
  _linkExtraClients.forEach(cid => {
    const c = S.clients.find(x=>x.id===cid);
    if (!c) return;
    const chip = document.createElement('div');
    chip.style.cssText = 'display:flex;align-items:center;gap:5px;background:#1e2236;border:1px solid #2a3050;border-radius:20px;padding:4px 6px 4px 12px;font-size:12px;color:#f1f5f9';
    chip.innerHTML = `<span>${c.name}</span>`;
    const btn = document.createElement('button');
    btn.textContent = '✕';
    btn.style.cssText = 'background:none;border:none;color:#ef4444;cursor:pointer;font-size:13px;padding:2px 4px';
    btn.onclick = () => {
      _linkExtraClients = _linkExtraClients.filter(x=>x!==cid);
      linkRenderClientChips();
    };
    chip.appendChild(btn);
    wrap.appendChild(chip);
  });
}

function unlinkCliFromPriceList(cid) {
  const cp = S.cp[cid] || {};
  const plId = cp._priceListId;
  if (!plId) return;
  const pl = (S.priceLists||[]).find(x=>x.id===plId);
  askConfirm(
    '¿Desvincular de la lista compartida?',
    'Este cliente pasará a tener una lista de precios personalizada. Cambios futuros a "'+(pl?pl.name:'la lista')+'" ya no lo afectarán.',
    () => {
      delete cp._priceListId;
      if (pl) pl.clientIds = (pl.clientIds||[]).filter(x=>Number(x)!==Number(cid));
      S.cp[cid] = cp;
      save(); renderClients();
      toast('✏️ Cliente desvinculado — ahora tiene lista personalizada','#f59e0b');
    },
    'Desvincular', '#ef4444'
  );
}

function saveCliPrices(cid) {
const existing = S.cp[cid] || {};
const visible = (existing._visible || []).map(Number);
const cp = { _visible: visible, _priceListId: existing._priceListId };
// Guardar precios solo de los productos asignados
visible.forEach(pid => {
  const inp = document.getElementById(`pe-${cid}-${pid}`);
  cp[pid] = inp ? Number(inp.value) : (existing[pid] || S.products.find(p=>p.id===pid)?.basePrice || 0);
});

// CONGELAR precios en pedidos históricos que no tengan customPrice guardado
S.orders.filter(o => Number(o.clientId) === Number(cid)).forEach(o => {
  o.items.forEach(it => {
    if (it.customPrice == null) {
      const p = S.products.find(x => x.id === Number(it.productId));
      // Usar el precio ACTUAL (antes del cambio) para congelar
      it.customPrice = cliPrice(cid, Number(it.productId), p?.basePrice || 0);
    }
  });
});

S.cp[cid] = cp;

// Si el cliente pertenece a una lista compartida, propagar los cambios a la lista
// y a TODOS los demás clientes que la comparten
if (existing._priceListId) {
  const pl = (S.priceLists||[]).find(x=>x.id===existing._priceListId);
  if (pl) {
    pl.visibleProds = visible.slice();
    visible.forEach(pid => { pl.prices[pid] = cp[pid]; });
    (pl.clientIds||[]).forEach(otherCid => {
      if (Number(otherCid) === Number(cid)) return; // ya se guardó arriba
      if (!S.cp[otherCid]) S.cp[otherCid] = {};
      const otherCp = S.cp[otherCid];
      visible.forEach(pid => { otherCp[pid] = cp[pid]; });
      otherCp._visible = visible.slice();
      otherCp._priceListId = pl.id;
    });
    toast('💲 Precios guardados y aplicados a la lista compartida'); save(); renderClients();
    return;
  }
}

save(); toast('💲 Precios guardados'); renderClients();
}


function showPriceListDoc(cid) {
  const c  = S.clients.find(x => x.id === cid);
  if (!c) return;
  const cp = S.cp[cid] || S.cp[String(cid)] || {};
  const visible = (cp._visible || []).map(Number);
  if (!visible.length) { toast('Este cliente no tiene lista de precios asignada.', '#f59e0b'); return; }

  const biz = S.biz || {};
  const Qf  = v => 'Q' + Number(v).toFixed(2);
  const today = fmtOrdDate((()=>{ const n=new Date(); return `${String(n.getDate()).padStart(2,'0')}/${String(n.getMonth()+1).padStart(2,'0')}/${n.getFullYear()}`; })());

  // Leer texto personalizado guardado en la app principal
  const FOOTER_KEY = 'priceListFooter_' + cid;
  const savedFooter = localStorage.getItem(FOOTER_KEY) || '';

  const prods = S.products
    .filter(p => visible.includes(Number(p.id)))
    .map(p => {
      const pr = (cp[p.id] != null) ? cp[p.id] : p.basePrice;
      const ul = p.unitLabel || 'u';
      return { name: p.name, presentation: p.presentation||'', pr, ul };
    });

  const rows = prods.map(p =>
    `<tr>
      <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#1e293b">${p.name}${p.presentation ? ` <span style="font-size:11px;color:#64748b">(${p.presentation})</span>` : ''}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:700;text-align:right;color:#1e293b">${Qf(p.pr)}<span style="font-size:10px;color:#64748b">/${p.ul}</span></td>
    </tr>`
  ).join('');

  const logoHtml = biz.logoData
    ? `<img src="${biz.logoData}" style="height:48px;object-fit:contain"/>`
    : `<div style="font-size:28px">${biz.logoEmoji||'📦'}</div>`;

  // Armar mensaje WhatsApp aquí (en la ventana principal, sin bloqueos)
  function buildWAMsg(footerTxt) {
    let msg = '*Listado de precios*\n';
    msg += '*Cliente:* ' + c.name + '\n';
    msg += '*Fecha:* ' + today + '\n\n';
    prods.forEach(p => {
      msg += '- *' + p.name + (p.presentation ? ' ' + p.presentation : '') + '*\n';
      msg += 'Precio ' + Qf(p.pr) + '/' + p.ul + '\n';
    });
    if (footerTxt) msg += '\n' + footerTxt;
    return msg;
  }

  // Mostrar modal interno en lugar de ventana emergente
  const modalId = 'price-list-modal-' + cid;
  const existing = document.getElementById(modalId);
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = modalId;
  modal.style.cssText = 'position:fixed;inset:0;background:#000a;z-index:9999;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:20px 10px';

  modal.innerHTML = `
    <div style="background:#f8fafc;border-radius:14px;width:100%;max-width:600px;overflow:hidden;box-shadow:0 8px 32px #0005">
      <!-- Header -->
      <div style="background:#0d0f18;color:#f1f5f9;padding:16px 20px;display:flex;justify-content:space-between;align-items:center">
        <div style="display:flex;align-items:center;gap:10px">
          ${logoHtml}
          <div><div style="font-weight:800;font-size:14px">${biz.name||'GTM - CALDIC'}</div>${biz.phone?`<div style="font-size:11px;color:#94a3b8">📞 ${biz.phone}</div>`:''}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:16px;font-weight:800;color:#00c97a">LISTA DE PRECIOS</div>
          <div style="font-size:11px;color:#94a3b8">Cliente: <strong style="color:#60a5fa">${c.name}</strong></div>
          <div style="font-size:11px;color:#94a3b8">Fecha: ${today}</div>
        </div>
      </div>
      <!-- Body -->
      <div style="padding:20px" id="price-list-printable-${cid}">
        <div style="background:#fff;border-radius:10px;padding:12px 16px;margin-bottom:14px;border:1px solid #e2e8f0">
          <div style="font-weight:700;font-size:14px;color:#1e3a8a">👤 ${c.name}</div>
          ${c.phone?`<div style="font-size:12px;color:#64748b">📞 ${c.phone}</div>`:''}
          ${c.address?`<div style="font-size:12px;color:#64748b">📍 ${c.address}</div>`:''}
        </div>
        <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden">
          <thead style="background:#0d0f18;color:#f1f5f9">
            <tr><th style="padding:8px 10px;font-size:12px;text-align:left">Producto</th><th style="padding:8px 10px;font-size:12px;text-align:right">Precio</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div id="footer-display-${cid}" style="font-size:12px;color:#475569;margin-top:12px;white-space:pre-line">${savedFooter}</div>
      </div>
      <!-- Texto personalizado -->
      <div style="padding:0 20px 14px">
        <textarea id="footer-ta-${cid}" placeholder="Escribe un texto personalizado (opcional)..." style="width:100%;border:1px solid #e2e8f0;border-radius:8px;padding:8px;font-size:12px;resize:vertical;min-height:55px;box-sizing:border-box">${savedFooter}</textarea>
        <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap">
          <button onclick="savePLFooter(${cid})" style="background:#1e3a5f;color:#fff;border:none;padding:8px 14px;border-radius:8px;font-size:12px;cursor:pointer">💾 Guardar texto</button>
          <button onclick="printPL(${cid})" style="background:#334155;color:#fff;border:none;padding:8px 14px;border-radius:8px;font-size:12px;cursor:pointer">🖨 Imprimir / PDF</button>
          <button onclick="waPL(${cid})" style="background:#25d366;color:#fff;border:none;padding:8px 14px;border-radius:8px;font-size:12px;cursor:pointer">📤 WhatsApp</button>
          <button onclick="document.getElementById('${modalId}').remove()" style="background:#ef4444;color:#fff;border:none;padding:8px 14px;border-radius:8px;font-size:12px;cursor:pointer">✕ Cerrar</button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(modal);

  // Guardar texto personalizado
  window['savePLFooter'] = function(id) {
    const txt = document.getElementById('footer-ta-' + id).value.trim();
    localStorage.setItem('priceListFooter_' + id, txt);
    document.getElementById('footer-display-' + id).textContent = txt;
    toast('Texto guardado ✔', '#10b981');
  };

  // Imprimir: abre ventana solo con la parte imprimible
  window['printPL'] = function(id) {
    const footer = document.getElementById('footer-ta-' + id).value.trim();
    const printContent = document.getElementById('price-list-printable-' + id).innerHTML;
    const w = window.open('', '_blank', 'width=700,height=900');
    if (!w) { toast('Activa ventanas emergentes para imprimir', '#f59e0b'); return; }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/>
      <style>
        body{font-family:Arial,sans-serif;margin:20px;color:#1e293b}
        table{width:100%;border-collapse:collapse}
        th{background:#0d0f18;color:#fff;padding:8px 10px;font-size:12px;text-align:left}
        th:last-child{text-align:right}
        td{padding:7px 10px;border-bottom:1px solid #e2e8f0;font-size:13px}
        td:last-child{font-weight:700;text-align:right}
      </style></head><body>
      ${printContent}
      <script>window.onload=function(){window.print()}<\/script>
      </body></html>`);
    w.document.close();
  };

  // WhatsApp: construir mensaje y abrir enlace directamente
  window['waPL'] = function(id) {
    const footer = document.getElementById('footer-ta-' + id).value.trim();
    const msg = buildWAMsg(footer);
    location.href = 'https://wa.me/?text=' + encodeURIComponent(msg);
  };
}



// ── Prospectos y ficha flotante de cliente (trasladado desde Pedidos) ──
function openProspectFullCard(id) {
  goTab('clients');
  setTimeout(() => {
    window._cliOpen = window._cliOpen || {};
    Object.keys(window._cliOpen).forEach(k => { window._cliOpen[k] = false; });
    window._cliOpen[id] = true;
    window._floatCid = Number(id);
    renderClients();
    setTimeout(() => restoreFloatingCard(id), 150);
  }, 150);
}

function deleteProspect(id) {
  const hasOrders = S.orders.some(o => Number(o.clientId) === id);
  const sub = hasOrders ? 'Este prospecto tiene cotizaciones asociadas. Se eliminarán también.' : 'Esta acción no se puede deshacer.';
  askConfirm('¿Eliminar este prospecto?', sub, () => {
    S.orders = S.orders.filter(o => Number(o.clientId) !== id);
    S.clients = S.clients.filter(c => c.id !== id);
    delete S.cp[id];
    save();
    renderProspects();
    toast('🗑 Prospecto eliminado');
  });
}

function convertProspectToClient(id) {
  const c = S.clients.find(x=>x.id===id);
  if (!c) return;
  askConfirm('✅ Convertir en cliente', `"${c.name}" pasará a formar parte de tu catálogo de clientes normal, junto con todas sus cotizaciones (que pasarán a ser pedidos).`, () => {
    delete c.isProspect;
    save();
    toast('✅ Cliente convertido: ' + c.name, '#10b981');
    goTab('clients');
  }, 'Convertir', '#10b981', '✅');
}

function renderProspects() {
  const body = document.getElementById('prospects-body');
  const titleTop = document.getElementById('prospects-title-top');
  if (!body) return;
  const prospects = S.clients.filter(c => c.isProspect);
  if (titleTop) titleTop.textContent = `(${prospects.length})`;
  if (!prospects.length) {
    body.innerHTML = '<div style="text-align:center;color:#64748b;padding:30px 10px;font-size:13px">Aún no tienes prospectos.<br>Presiona "+ Nuevo" para agregar el primero.</div>';
    return;
  }
  body.innerHTML = prospects.map(c => {
    const cliOrders = [...S.orders].filter(o => Number(o.clientId) === c.id);
    const total = cliOrders.reduce((s,o) => s + orderTotal(o.items, o.clientId), 0);
    return `<div class="card" id="cc-${c.id}">
<div style="display:flex;justify-content:space-between;align-items:flex-start;cursor:pointer" onclick="openProspectFullCard(${c.id})">
<div style="display:flex;align-items:center;gap:6px">
<input type="checkbox" class="cli-chk" data-id="${c.id}"
  style="width:17px;height:17px;flex-shrink:0;cursor:pointer;accent-color:#10b981;margin-top:2px"
  ${(window._cliSel||new Set()).has(c.id)?'checked':''}
  onclick="event.stopPropagation();toggleCliSel(${c.id},this.checked)"/>
<div>
<div style="font-weight:800;font-size:15px;${priorityNameStyle(c.priority,'#f1f5f9')}">${c.name}</div>
${c.clientCode ? `<div style="font-size:12px;color:#64748b">🆔 ${c.clientCode}</div>` : ''}
${c.priority ? `<div style="font-size:12px;color:#f59e0b">⭐ ${c.priority}</div>` : ''}
${c.phone   ? `<div style="font-size:12px;color:#64748b">📞 ${c.phone}</div>` : ''}
${c.deptId ? (()=>{ const cat=(S.depts||[]).find(x=>x.id===c.deptId); return cat?`<div style="font-size:10px;display:inline-block;background:#1e3a5f;color:#60a5fa;padding:1px 8px;border-radius:8px;margin-top:2px">🏛️ ${cat.name}</div>`:''; })() : ''}
${c.municipioId ? (()=>{ const m=(S.municipios||[]).find(x=>x.id===c.municipioId); return m?`<div style="font-size:10px;display:inline-block;background:#1e1040;color:#a78bfa;padding:1px 8px;border-radius:8px;margin-top:2px;margin-left:3px">🏘️ ${m.name}</div>`:''; })() : ''}
${c.address ? `<div style="font-size:12px;color:#64748b">📍 ${c.address}</div>` : ''}
</div>
</div>
<div style="display:flex;gap:6px;flex-shrink:0;align-items:center" onclick="event.stopPropagation()">
<button class="bg" style="font-size:11px;padding:4px 10px" onclick="convertProspectToClient(${c.id})">✅ Convertir</button>
<button class="br" onclick="deleteProspect(${c.id})">🗑</button>
</div>
</div>
<div style="font-size:11px;color:#64748b;margin-top:6px" onclick="openProspectFullCard(${c.id})">${cliOrders.length} cotización(es)${total>0?' · '+Q(total):''}</div>
</div>`;
  }).join('');
}

function openNewProspectForm() {
  goTab('clients');
  setTimeout(() => {
    const cliForm = document.getElementById('cli-form-body');
    if (cliForm) cliForm.style.display = 'block';
    refreshNcRouteList();
    const typeProspectEl = document.getElementById('nc-type-prospect');
    if (typeProspectEl) typeProspectEl.checked = true;
    const nameField = document.getElementById('nc-n');
    if (nameField) { nameField.scrollIntoView({behavior:'smooth', block:'center'}); }
    // Refuerzo: asegurar que la lista de rutas quede cargada, aunque la primera vez llegue demasiado pronto
    setTimeout(refreshNcRouteList, 200);
  }, 150);
}

function openClientCard(cid) {
  if (!window._cliOpen) window._cliOpen = {};
  closeFloatingCard();
  Object.keys(window._cliOpen).forEach(k => { window._cliOpen[k] = false; });
  window._cliOpen[Number(cid)] = true;
  window._floatCid = Number(cid);
  goTab('clients');
  setTimeout(() => {
    renderClients();
    setTimeout(() => restoreFloatingCard(cid), 150);
  }, 100);
}

function closeFloatingCard() {
  const cid = window._floatCid;
  window._floatCid = null;
  if (cid && window['_restProdOutsideHandler_'+cid]) closeRestProdList(cid);

  // Colapsar ficha del cliente
  if (cid && window._cliOpen) window._cliOpen[cid] = false;

  // Colapsar todas las secciones internas
  if (cid && window._cliSecOpen) {
    const prefixes = ['csp','csc','csd','csb','csn','cso'];
    prefixes.forEach(p => {
      const secId = `${p}-${cid}`;
      window._cliSecOpen[secId] = false;
      const secEl = document.getElementById(secId);
      if (secEl) secEl.style.display = 'none';
    });
  }

  // Restaurar estilos
  document.querySelectorAll('[id^="cc-"]').forEach(el => {
    if (el.dataset.floatCid) {
      el.removeAttribute('style');
      delete el.dataset.floatCid;
      const btn = el.querySelector('#float-close-btn');
      if (btn) btn.remove();
    }
    el.style.opacity = '1';
  });

  // Si el cliente cerrado es un prospecto, regresar a la pestaña de Prospectos
  const wasProspect = cid && S.clients.find(c=>Number(c.id)===Number(cid) && c.isProspect);
  if (wasProspect) {
    goTab('prospects');
  } else {
    renderClients();
  }
}



// ── Trasladado desde el bloque "MODAL DE CONFIRMACIÓN" (mal etiquetado) ──
function delClient(id) {
  id = Number(id);
  const c = S.clients.find(x => Number(x.id)===id);
  const nombre = c ? c.name : '—';
  const hasOrders = S.orders.some(o => Number(o.clientId)===id);
  const ordCount = S.orders.filter(o => Number(o.clientId)===id).length;
  const sub = nombre + (hasOrders ? '\n⚠️ Tiene ' + ordCount + ' pedido(s) activo(s) que también se eliminarán.' : '\nEsta acción no se puede deshacer.');
  askConfirm('¿Eliminar este cliente?', sub, () => {
    S.orders = S.orders.filter(o => Number(o.clientId)!==id);
    S.clients = S.clients.filter(c => Number(c.id)!==id);
    delete S.cp[id]; delete S.cp[String(id)];
    save(); toast('🗑 Cliente eliminado'); renderClients(); renderList();
  });
}

