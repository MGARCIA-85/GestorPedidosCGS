function isOrderBlocked(o) {
  const ts = ordDateTs(o);
  if (!ts) return false;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return ts > todayStart;
}


function canAdvanceOrderStatus(o, newStatus) {
  if (newStatus === 'Confirmado' && isOrderBlocked(o)) return { ok:false, reason:'blocked' };
  if (!o.delivery && newStatus !== 'Cotización')       return { ok:false, reason:'no-delivery' };
  return { ok:true };
}


function handleConfirmBlocked(o, reason) {
  if (reason === 'blocked')      showOrderBlockedAlert(o.id);
  else if (reason === 'no-delivery') toast('📍 El pedido no tiene dirección de entrega. Edítalo primero.', '#ef4444');
}


function renderQuotesList() {
  const body = document.getElementById('quotes-list-body');
  const titleTop = document.getElementById('quotes-title-top');
  if (!body) return;
  const prospectIds = new Set(S.clients.filter(c=>c.isProspect).map(c=>c.id));
  const quotes = S.orders.filter(o => prospectIds.has(Number(o.clientId)) && !o.cancelled);
  if (titleTop) titleTop.textContent = `(${quotes.length})`;
  if (!quotes.length) {
    body.innerHTML = '<div style="text-align:center;color:#64748b;padding:30px 10px;font-size:13px">Aún no tienes cotizaciones.<br>Presiona "+ Nueva" y elige un prospecto como cliente.</div>';
    return;
  }
  const sorted = [...quotes].sort((a,b)=>ordDateTs(b)-ordDateTs(a));
  body.innerHTML = sorted.map(o => {
    const total = orderTotal(o.items, o.clientId);
    const disp = o.applyIva ? total*1.12 : total;
    const sCls = o.cancelled?'#ef4444':o.status==='Concluido'?'#4ade80':o.status==='Confirmado'?'#60a5fa':'#f1f5f9';
    return `<div style="background:#161929;border-radius:10px;padding:12px;margin-bottom:10px;border-left:3px solid ${sCls}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
        <div style="font-weight:800;font-size:14px;color:#f1f5f9;cursor:pointer;text-decoration:underline" onclick="openProspectFullCard(${o.clientId})">${o.clientName}</div>
        <div style="font-weight:800;font-size:14px;color:#f59e0b">${Q(disp)}</div>
      </div>
      <div style="font-size:11px;color:#64748b;margin-bottom:10px">${(o.date||'').split(',')[0]} · <span style="color:${sCls}">${o.cancelled?'🚫 CANCELADO':o.status}</span></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="bb" style="flex:1;min-width:70px;padding:7px 0;font-size:11px" onclick="showQuoteFromOrder(${o.id})">📄 Cotizar</button>
        <button class="bs" style="flex:1;min-width:70px;padding:7px 0;font-size:11px" onclick="startEditOrder(${o.id})">✏️ Editar</button>
        ${o.status==='Cotización'&&!o.cancelled?`<button class="bs" style="flex:1;min-width:70px;padding:7px 0;font-size:11px;color:#f59e0b;border-color:#f59e0b" onclick="cancelOrder(${o.id})">🚫 Cancelar</button>`:''}
        <button class="br" style="flex-shrink:0;padding:7px 10px;font-size:11px" onclick="delOrder(${o.id})">🗑</button>
      </div>
      ${o.cancelled?`<button onclick="reactivateOrder(${o.id})" style="width:100%;padding:7px 0;background:transparent;border:1px solid #10b981;border-radius:6px;color:#10b981;font-size:11px;font-weight:700;cursor:pointer;margin-top:6px">🔄 Reactivar pedido</button>`:''}
    </div>`;
  }).join('');
}


// ═══════════════════════════════════════════════════════
//  AUTOCOMPLETE CLIENTES Y PRODUCTOS
// ═══════════════════════════════════════════════════════
function acOpen(id){ const d=document.getElementById(id); if(d) d.classList.add('open'); }
function acClose(id){ const d=document.getElementById(id); if(d) d.classList.remove('open'); }
function acBlur(dropId){ setTimeout(()=>acClose(dropId), 200); }

function acCliInput() {
  const txt = document.getElementById('ord-cli-txt');
  const drop = document.getElementById('ac-cli-drop');
  const q = normalizeStr(txt.value.trim());
  let matches = S.clients.filter(c => normalizeStr(c.name).includes(q) || normalizeStr(c.phone||'').includes(q));
  if (window._prospectFirstMode) {
    matches = [...matches].sort((a,b) => (b.isProspect?1:0) - (a.isProspect?1:0));
  }
  drop.innerHTML = '';
  if (!matches.length) {
    drop.innerHTML = '<div class="ac-empty">Sin resultados</div>';
    acOpen('ac-cli-drop'); return;
  }
  matches.forEach(c => {
    const d = document.createElement('div');
    d.className = 'ac-opt';
    d.innerHTML = `<span style="${priorityNameStyle(c.priority,'inherit')}">${c.name}</span>` + (c.isProspect ? ' <small style="color:#f59e0b">(Prospecto)</small>' : '') + (isClientBlocked(c) ? ' <small style="color:#ef4444">(Bloqueado)</small>' : '') + (c.phone ? '<small>📞 '+c.phone+'</small>' : '');
    d.onmousedown = () => {
      if (isClientBlocked(c)) { toast('🔒 Este cliente está bloqueado. No se pueden generar pedidos nuevos.', '#ef4444'); acClose('ac-cli-drop'); return; }
      document.getElementById('ord-cli').value = c.id;
      txt.value = c.name;
      acClose('ac-cli-drop');
      onCliChange();
    };
    drop.appendChild(d);
  });
  acOpen('ac-cli-drop');
}

function acProdInput(i) {
  const txt = document.getElementById('prod-txt-'+i);
  const drop = document.getElementById('ac-prod-drop-'+i);
  if (!txt || !drop) return;
  const cid = Number(document.getElementById('ord-cli').value);
  const q = normalizeStr(txt.value.trim());
  const cp = (S.cp[cid] || S.cp[String(cid)] || {});
  const assigned = cp._visible;
  const hasAssigned = assigned && assigned.length > 0;

  const cliAuthProds = (() => { const c = S.clients.find(x=>x.id===cid); return (c && c.authorizedProducts) || []; })();
  const activeProducts = S.products.filter(p => !p.inactive && (!(S.restrictedFamilies||[]).includes((p.family||'').trim()) || cliAuthProds.includes(p.id)));
  const pool = hasAssigned
    ? activeProducts.filter(p => assigned.includes(p.id) || assigned.includes(String(p.id)))
    : activeProducts;

  const matches = pool.filter(p =>
    normalizeStr(p.name).includes(q) ||
    normalizeStr(p.presentation||'').includes(q) ||
    normalizeStr(p.family||'').includes(q)
  );

  const outsideMatches = hasAssigned
    ? activeProducts.filter(p =>
        !(assigned.includes(p.id) || assigned.includes(String(p.id))) &&
        (q.length === 0 || normalizeStr(p.name).includes(q) ||
         normalizeStr(p.presentation||'').includes(q) ||
         normalizeStr(p.family||'').includes(q))
      )
    : [];

  drop.innerHTML = '';

  if (!matches.length && !outsideMatches.length) {
    const addDiv = document.createElement('div');
    addDiv.className = 'ac-empty';
    addDiv.style.cssText = 'cursor:pointer;color:#f59e0b';
    addDiv.textContent = '⚠️ Sin resultados. ¿Asignar producto a este cliente?';
    addDiv.onmousedown = () => { acClose('ac-prod-drop-'+i); showAddProdToCliModal(cid, i); };
    drop.appendChild(addDiv);
    acOpen('ac-prod-drop-'+i); return;
  }

  // Mostrar matches de la lista
  matches.forEach(p => {
    const pr = cliPrice(cid, p.id, p.basePrice);
    const d = document.createElement('div');
    d.className = 'ac-opt';
    if (p.color) { d.style.cssText = `border-left:4px solid ${p.color}`; }
    const nameSpan = p.color ? `<span style="color:${p.color};font-weight:700">${p.name}</span>` : p.name;
    d.innerHTML = nameSpan + '<small>'+(p.presentation||'')+(p.family?' · '+p.family:'')+' — '+Q(pr)+'</small>';
    d.onmousedown = () => { txt.value = p.name; acClose('ac-prod-drop-'+i); setPid(i, p.id); };
    drop.appendChild(d);
  });

  // Separador + matches fuera de la lista
  if (outsideMatches.length) {
    const sep = document.createElement('div');
    sep.style.cssText = 'font-size:10px;font-weight:800;color:#f59e0b;padding:6px 12px 2px;text-transform:uppercase;letter-spacing:1px;background:#161929';
    sep.textContent = '+ Fuera de la lista — asignar al agregar';
    drop.appendChild(sep);
    outsideMatches.forEach(p => {
      const pr = cliPrice(cid, p.id, p.basePrice);
      const d = document.createElement('div');
      d.className = 'ac-opt';
      d.style.cssText = 'opacity:.85;border-left:3px solid #f59e0b';
      d.innerHTML = p.name + '<small>'+(p.presentation||'')+(p.family?' · '+p.family:'')+' — '+Q(pr)+'</small>';
      d.onmousedown = () => {
        // Asignar a la lista del cliente y agregar al pedido
        const cp2 = S.cp[cid] || {};
        let vis = (cp2._visible || []).map(Number);
        if (!vis.includes(Number(p.id))) vis.push(Number(p.id));
        cp2._visible = vis;
        S.cp[cid] = cp2;
        save();
        toast('📌 '+p.name+' asignado a este cliente','#10b981');
        txt.value = p.name;
        acClose('ac-prod-drop-'+i);
        setPid(i, p.id);
      };
      drop.appendChild(d);
    });
  }

  acOpen('ac-prod-drop-'+i);
}

// ═══════════════════════════════════════════════════════
//  PEDIDO
// ═══════════════════════════════════════════════════════
function renderOrderPage() {
const banner = document.getElementById('edit-banner');
const btnSub = document.getElementById('btn-submit');
const secTit = document.getElementById('order-sec-title');
// Mostrar banner de ruta si aplica
const _prid = sessionStorage.getItem('pendingRouteId') || localStorage.getItem('currentRouteId');
const routeBanner = document.getElementById('route-order-banner');
if (routeBanner) {
  if (_prid && S.routes) {
    const _rr = S.routes.find(x=>x.id==_prid);
    routeBanner.style.display = 'flex';
    const bn = document.getElementById('route-banner-name');
    if (bn) bn.textContent = _rr ? _rr.name : 'Ruta';
  } else {
    routeBanner.style.display = 'none';
  }
}
const btnCancelNew = document.getElementById('btn-cancel-new');
if (editingOid !== null) {
banner.style.display = 'flex';
btnSub.textContent   = '💾 Guardar Cambios';
if (btnCancelNew) btnCancelNew.style.display = 'none';
const _span = secTit.querySelector('span'); if (_span) _span.textContent = 'Editando Pedido';
const ord = S.orders.find(x => x.id === editingOid);
if (ord) {
  document.getElementById('ord-cli').value = ord.clientId;
  const cli = S.clients.find(x => x.id === ord.clientId);
  if (cli) document.getElementById('ord-cli-txt').value = cli.name;
}
} else {
banner.style.display = 'none';
btnSub.textContent   = '✅ Registrar Pedido';
if (btnCancelNew) btnCancelNew.style.display = '';
const _span2 = secTit.querySelector('span'); if (_span2) _span2.textContent = 'Crear Nuevo Pedido';
// Limpiar campos al iniciar un pedido nuevo
const _q = document.getElementById('ord-quote'); if (_q) _q.value = '';
const _o = document.getElementById('ord-oc');    if (_o) _o.value = '';
const _d = document.getElementById('ord-delivery'); if (_d) _d.value = '';
// Precargar fecha actual
const _fd = document.getElementById('ord-date');
if (_fd) { const _now = new Date(); _fd.value = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}-${String(_now.getDate()).padStart(2,'0')}`; }
// Limpiar fecha de entrega
const _qn = document.getElementById('ord-quote-note'); if (_qn) _qn.value = '';
// Si viene de duplicar, precargar los datos
if (_duplicatingData) {
  const d = _duplicatingData;
  // Asignar cliente
  const _cliHid = document.getElementById('ord-cli');
  const _cliTxt = document.getElementById('ord-cli-txt');
  const _cli = S.clients.find(c => c.id === Number(d.clientId));
  if (_cliHid) _cliHid.value = d.clientId;
  if (_cliTxt && _cli) _cliTxt.value = _cli.name;
  // Mostrar formulario manualmente
  const _body = document.getElementById('ord-body');
  const _ph   = document.getElementById('ord-ph');
  const _info = document.getElementById('ord-cli-info');
  if (_body) _body.style.display = 'block';
  if (_ph)   _ph.style.display   = 'none';
  if (_info && _cli) _info.innerHTML = (_cli.phone?'📞 '+_cli.phone:'') + (_cli.address?' &nbsp;📍 '+_cli.address:'');
  refreshDeliverySel(Number(d.clientId));
  // Llenar campos
  const fields = {'ord-quote':d.quote,'ord-quote-note':d.quoteNote,'ord-oc':d.oc};
  Object.entries(fields).forEach(([fid,val])=>{ const el=document.getElementById(fid); if(el) el.value=val||''; });
  const ivaEl=document.getElementById('ord-iva'); if(ivaEl) ivaEl.checked=d.applyIva;
  const ivaIncEl=document.getElementById('ord-iva-inc'); if(ivaIncEl) ivaIncEl.checked=d.pricesIncIva;
  if (d.comments && d.comments.length) {
    setComments(d.comments);
  } else {
    setComments(['']);
  }
  renderItems(); renderOrdBonusRows(); refreshTotalWithIVA(); onDeliveryInputChange();
  // Mostrar alerta o precargar dirección
  const _cid = Number(d.clientId);
  const _defIdx = S.defaultAddresses && S.defaultAddresses[_cid] !== undefined ? S.defaultAddresses[_cid] : null;
  const _defAddrs = (S.savedAddresses && S.savedAddresses[_cid]) || [];
  if (_defIdx !== null && _defAddrs[_defIdx]) {
    showDeliveryAlert(_cid, _defAddrs[_defIdx]);
  } else if (_defIdx === null && _defAddrs.length === 1) {
    const inp = document.getElementById('ord-delivery');
    if (inp) { inp.value = _defAddrs[0]; onDeliveryInputChange(); }
  }
  toast('📋 Duplicado — edita y guarda','#3b82f6');
  _duplicatingData = null;
  return;
}
}
onCliChange();
}

function onCliChange(skipAlert) {
const cid  = Number(document.getElementById('ord-cli').value);
const info = document.getElementById('ord-cli-info');
const body = document.getElementById('ord-body');
const ph   = document.getElementById('ord-ph');
if (!cid) { body.style.display='none'; ph.style.display='block'; info.textContent=''; return; }
const c = S.clients.find(x => x.id === cid);
info.innerHTML = (c.phone ? '📞 '+c.phone : '') + (c.address ? ' &nbsp;📍 '+c.address : '');
body.style.display = 'block'; ph.style.display = 'none';
// Si es un pedido nuevo (no edición ni duplicado), precargar el contacto guardado en la ficha del cliente
if (editingOid === null && !_duplicatingData && !_isDuplicateSession) {
  const contactField = document.getElementById('ord-contact');
  if (contactField) contactField.value = c.contact || '';
}
refreshDeliverySel(cid);

// Sugerir o precargar dirección
const _defIdx = S.defaultAddresses && S.defaultAddresses[cid] !== undefined ? S.defaultAddresses[cid] : null;
const _defAddrs = (S.savedAddresses && S.savedAddresses[cid]) || [];
if (_defIdx !== null && _defAddrs[_defIdx] && !_duplicatingData && !skipAlert && editingOid === null) {
  // Tiene favorita → mostrar alerta
  showDeliveryAlert(cid, _defAddrs[_defIdx]);
} else if (_defIdx === null && _defAddrs.length === 1 && !_duplicatingData && !skipAlert && editingOid === null) {
  // Exactamente una dirección sin favorita → precargar directamente
  const inp = document.getElementById('ord-delivery');
  if (inp) { inp.value = _defAddrs[0]; onDeliveryInputChange(); }
}
if (editingOid === null && !_duplicatingData && !_isDuplicateSession) {
  // Recopilar TODOS los pedidos del cliente (cualquier estado), ordenados del más nuevo al más viejo
  const facturados = [...S.orders]
    .filter(o => Number(o.clientId) === cid && o.items && o.items.length)
    .sort((a,b) => { const td = ordDateTs(b)-ordDateTs(a); return td !== 0 ? td : b.id-a.id; });
  ordItems = [{ pid:'', qty:1 }];
  ordBonusLines = [];
  ordComments = [''];
  ordConditions = [];
  // Precargar comentarios predefinidos del cliente
  let clientPinned = (S.savedComments && S.savedComments[cid]) || [];
  if (!Array.isArray(clientPinned)) clientPinned = [];
  if (clientPinned.length) ordComments = [...clientPinned, ''];
}
renderItems();
renderOrdBonusRows();
renderCommentFields();
renderConditionFields();
// Activar visualmente el toggle "Los precios ya incluyen IVA" por defecto
const ivaIncChkInit = document.getElementById('ord-iva-inc');
if (ivaIncChkInit && !editingOid) { ivaIncChkInit.checked = true; }
refreshTotalWithIVA();
}

function renderOrdBonusRows() {
  const section = document.getElementById('ord-bonus-section');
  const wrap    = document.getElementById('ord-bonus-rows');
  if (!section || !wrap) return;
  if (!ordBonusLines.length) { section.style.display='none'; return; }
  section.style.display = 'block';
  wrap.innerHTML = ordBonusLines.map((bl,i) => {
    const pOpts = S.products.map(p=>`<option value="${p.id}" ${p.id===Number(bl.productId)?'selected':''}>${p.name}${p.presentation ? ' ('+p.presentation+')' : ''}</option>`).join('');
    const blP = S.products.find(p=>p.id===Number(bl.productId));
    let specSelectHtml = '';
    if (blP) {
      ensureProductSpecs(blP);
      const activeSpecs = blP.specs.filter(s=>s.active);
      if (activeSpecs.length > 1) {
        if (bl.specId == null || !activeSpecs.some(s=>String(s.id)===String(bl.specId))) bl.specId = null;
        const needsChoice = bl.specId == null;
        specSelectHtml = `<select onchange="chooseBonusSpec(${i}, this.value)" style="flex:1;min-width:0;background:${needsChoice?'#2a1010':'#0d0f18'};color:${needsChoice?'#ef4444':'#f1f5f9'};border:1px solid ${needsChoice?'#ef4444':'#2a3050'};border-radius:6px;padding:4px 8px;font-size:11px">
          <option value="">-- Elegir especificación --</option>
          ${activeSpecs.map(s=>`<option value="${s.id}" ${String(bl.specId)===String(s.id)?'selected':''}>${s.label}${s.weightKg?' · '+s.weightKg+'kg':''}</option>`).join('')}
        </select>`;
      } else if (activeSpecs.length === 1) {
        bl.specId = activeSpecs[0].id;
      }
    }
    // Subtotal de la línea de bonificación (mismo cálculo usado en el
    // desglose de bonificación del total), en la misma línea que la
    // especificación.
    const unitSize = itemUnitSizeFor(bl, blP);
    const subtotal = (Number(bl.price)||0) * unitSize * (Number(bl.qty)||0);
    const specAndSubRow = `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
      ${specSelectHtml || '<span></span>'}
      <span style="font-size:11px;color:#10b981;font-weight:700;white-space:nowrap;margin-left:auto">Subtotal: ${Q(subtotal)}</span>
    </div>`;
    return `<div style="background:#0d0f18;padding:6px;border-radius:7px;margin-bottom:5px">
      <div style="display:grid;grid-template-columns:1fr 45px 65px 28px;gap:4px;align-items:center;margin-bottom:4px">
        <select onchange="ordBonusLines[${i}].productId=Number(this.value);ordBonusLines[${i}].specId=null;window._bonusConfirmed=true;renderOrdBonusRows();refreshTotal(Number(document.getElementById('ord-cli').value))" style="background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:6px;padding:4px;font-size:11px;min-width:0">${pOpts}</select>
        <input type="number" value="${bl.qty||1}" min="1" onchange="ordBonusLines[${i}].qty=Number(this.value);window._bonusConfirmed=true;renderOrdBonusRows();refreshTotal(Number(document.getElementById('ord-cli').value))" style="background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:6px;padding:4px;font-size:11px;width:100%"/>
        <input type="number" value="${bl.price||0}" min="0" step="0.01" onchange="ordBonusLines[${i}].price=Number(this.value);window._bonusConfirmed=true;renderOrdBonusRows();refreshTotal(Number(document.getElementById('ord-cli').value))" style="background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:6px;padding:4px;font-size:11px;width:100%"/>
        <button onclick="ordBonusLines.splice(${i},1);window._bonusConfirmed=true;renderOrdBonusRows();refreshTotal(Number(document.getElementById('ord-cli').value))" style="background:#ef444420;border:1px solid #ef4444;border-radius:5px;color:#ef4444;padding:2px 4px;font-size:11px;cursor:pointer">✕</button>
      </div>
      ${specAndSubRow}
      <input value="${bl.ruleName&&bl.ruleName!=='Manual'?bl.ruleName:''}" placeholder="Comentario (ej: Por consumo Trim. Q2)" onchange="ordBonusLines[${i}].ruleName=this.value||'Manual'" style="width:100%;background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:6px;padding:4px 8px;font-size:11px;margin-bottom:4px"/>
      <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:${bl.exceptional?'#f59e0b':'#64748b'};cursor:pointer">
        <input type="checkbox" ${bl.exceptional?'checked':''} onchange="ordBonusLines[${i}].exceptional=this.checked;window._bonusConfirmed=true;renderOrdBonusRows()" style="width:14px;height:14px;accent-color:#f59e0b"/>
        🎗️ Bonificación excepcional (cortesía, no pertenece a ninguna regla)
      </label>
    </div>`;
  }).join('');
}

function addOrdBonusRow() {
  const section = document.getElementById('ord-bonus-section');
  if (section) section.style.display='block';
  const cid = Number(document.getElementById('ord-cli').value);

  // Si ya hay bonificaciones en el formulario actual, copiar la última
  let pid = 0, pr = 0;
  if (ordBonusLines.length > 0) {
    const last = ordBonusLines[ordBonusLines.length - 1];
    pid = last.productId;
    pr  = last.price != null ? last.price : cliPrice(cid, pid, (S.products.find(p=>p.id===pid)||{}).basePrice||0);
  } else {
    // Sin bonificación previa — usar primer producto disponible
    const cp = S.cp[cid] || S.cp[String(cid)] || {};
    const vis = cp._visible;
    const firstProd = (vis && vis.length)
      ? S.products.find(p => vis.includes(p.id) || vis.includes(String(p.id)))
      : S.products[0];
    pid = firstProd?.id || 0;
    pr  = cliPrice(cid, pid, firstProd?.basePrice || 0);
  }

  ordBonusLines.push({ productId: pid, qty:1, price:pr, specId:null, ruleName:'Manual' });
  window._bonusConfirmed = true;
  renderOrdBonusRows();
  refreshTotal(cid);
}

function renderItems() {
const cid  = Number(document.getElementById('ord-cli').value);
const wrap = document.getElementById('ord-items');
wrap.innerHTML = '';
ordItems.forEach((it, i) => {
const card = document.createElement('div');
card.className = 'card sortable-item';
card.dataset.idx = i;
let opts = '<option value="">-- Seleccionar producto --</option>';
// Agrupar productos por familia (excluyendo restringidas si el cliente no tiene permiso)
const cliAuthProdsSel = (() => { const c = S.clients.find(x=>x.id===cid); return (c && c.authorizedProducts) || []; })();
const families = [];
const famMap   = {};
S.products.forEach(p => {
const famRaw = p.family && p.family.trim() ? p.family.trim() : '';
if (famRaw && (S.restrictedFamilies||[]).includes(famRaw) && !cliAuthProdsSel.includes(p.id) && String(p.id)!==String(it.pid)) return;
const fam = famRaw || '— Sin departamento —';
if (!famMap[fam]) { famMap[fam] = []; families.push(fam); }
famMap[fam].push(p);
});
// Ordenar familias (Sin categoría al final)
families.sort((a,b) => {
if(a==='— Sin departamento —') return 1;
if(b==='— Sin departamento —') return -1;
return a.localeCompare(b,'es');
});
families.forEach(fam => {
opts += `<optgroup label="${fam}">`;
famMap[fam].forEach(p => {
const pr  = cliPrice(cid, p.id, p.basePrice);
const us  = Number(p.unitSize)||1;
const ul  = p.unitLabel||'unidad';
const ps  = us>1 ? Q(pr)+'/'+ul+' → '+Q(pr*us)+' c/u' : Q(pr)+'/'+ul;
const sel = String(p.id)===String(it.pid) ? 'selected' : '';
opts += `<option value="${p.id}" ${sel}>${p.name} (${p.presentation||'—'}) — ${ps}</option>`;
});
opts += '</optgroup>';
});
const remBtn = '';
const selectedP = it.pid ? S.products.find(p=>String(p.id)===String(it.pid)) : null;
if (selectedP) {
  ensureProductSpecs(selectedP);
  const activeSpecsForRow = selectedP.specs.filter(s => s.active);
  if (activeSpecsForRow.length === 1 && it.specId == null) it.specId = activeSpecsForRow[0].id;
}
// Los botones de reordenar solo hacen falta si hay más de una línea; con
// una sola no tienen nada que mover y solo desperdician espacio.
const needsMoveBtns = ordItems.length > 1;
const moveUpBtn = i > 0 ? `<button type="button" onclick="moveItemUp(${i})" style="background:#2a3050;border:none;border-radius:5px;color:#94a3b8;width:26px;height:26px;font-size:13px;cursor:pointer">▲</button>` : `<div style="width:26px;height:26px"></div>`;
const moveDownBtn = i < ordItems.length-1 ? `<button type="button" onclick="moveItemDown(${i})" style="background:#2a3050;border:none;border-radius:5px;color:#94a3b8;width:26px;height:26px;font-size:13px;cursor:pointer">▼</button>` : `<div style="width:26px;height:26px"></div>`;
const moveBtnsCol = needsMoveBtns ? `<div style="display:flex;flex-direction:column;gap:3px;flex-shrink:0">${moveUpBtn}${moveDownBtn}</div>` : '';
card.innerHTML = `
<div style="display:flex;gap:8px;align-items:flex-end">
${moveBtnsCol}
<div style="flex:3"><label class="lbl">Producto</label>
<div class="ac-wrap" style="position:relative">
<input class="inp ac-inp" id="prod-txt-${i}" autocomplete="off" placeholder="Buscar producto..." value="${it.pid ? (S.products.find(p=>String(p.id)===String(it.pid))||{name:''}).name : ''}" oninput="acProdInput(${i})" onfocus="acProdInput(${i})" onblur="acBlur('ac-prod-drop-${i}')" style="margin-bottom:0${selectedP&&selectedP.color?`;border-left:4px solid ${selectedP.color};color:${selectedP.color};font-weight:700`:''}"/>
<div class="ac-drop" id="ac-prod-drop-${i}"></div>
</div></div>
<div style="flex:1"><label class="lbl">Cantidad</label>
<input class="inp" id="qty${i}" type="number" min="1" step="1" value="${it.qty}"
style="margin-bottom:0" oninput="setQty(${i},this.value)"/></div>
<div style="flex:1">
<label class="lbl">Precio</label>
<div id="ref-price-${i}" style="font-size:10px;color:#64748b;font-weight:600;margin-top:-6px;margin-bottom:4px"></div>
<input class="inp" type="number" step="0.01"
value="${(it && it.price!=null)?it.price:cliPrice(cid, it.pid, 0)}"
oninput="setPrice(${i}, this.value)" style="margin-bottom:0"/>
</div>
</div>
<div id="sub${i}" style="margin-top:8px"></div>
${remBtn}`;
wrap.appendChild(card);
refreshSub(i, cid);
});
refreshTotal(cid);
setTimeout(() => {
  document.querySelectorAll('#ord-items .sortable-item[data-idx]').forEach(el => {
    if (!el.dataset.swipeInit) {
      el.dataset.swipeInit = '1';
      initPriceLineSwipe(el, Number(el.dataset.idx));
    }
  });
}, 50);
}

function moveItemUp(i) {
  if (i <= 0) return;
  [ordItems[i-1], ordItems[i]] = [ordItems[i], ordItems[i-1]];
  renderItems();
}
function moveItemDown(i) {
  if (i >= ordItems.length-1) return;
  [ordItems[i+1], ordItems[i]] = [ordItems[i], ordItems[i+1]];
  renderItems();
}

function setPid(i, val) {
  ordItems[i].pid = val;
  const cid = Number(document.getElementById('ord-cli').value);
  const p   = S.products.find(x => x.id === Number(val));
  if (p) {
    ensureProductSpecs(p);
    const activeSpecs = p.specs.filter(s => s.active);
    // Si solo hay una especificación activa, se autoselecciona; si hay
    // varias, queda sin elegir hasta que el usuario la escoja en la línea.
    ordItems[i].specId = activeSpecs.length === 1 ? activeSpecs[0].id : null;
    const listPrice = cliPrice(cid, p.id, p.basePrice);
    // Precargar con precio de lista (no el histórico)
    ordItems[i].price = listPrice;
  } else {
    ordItems[i].specId = null;
  }
  renderItems();
}
function chooseSpec(i, val) {
  if (!ordItems[i]) return;
  ordItems[i].specId = val ? Number(val) : null;
  refreshSub(i, Number(document.getElementById('ord-cli').value));
  renderSapCalc();
}
function chooseBonusSpec(i, val) {
  if (!ordBonusLines[i]) return;
  ordBonusLines[i].specId = val ? Number(val) : null;
  window._bonusConfirmed = true;
  renderOrdBonusRows();
  renderSapCalc();
}
function setPrice(i, val) {
if(!ordItems[i]) return;
ordItems[i].price = Number(val);
const cid = Number(document.getElementById('ord-cli').value);
refreshSub(i, cid);
refreshTotal(cid);
}

// ── Deslizar en la línea de precio: derecha = establecer como precio de lista,
// izquierda = quitar de la lista de precios ─────────────────────────────────
function initPriceLineSwipe(el, i) {
  let startX = 0, startY = 0, dragging = false;
  const THRESHOLD = 90;
  const resetVisual = () => {
    el.style.transform = 'translateX(0)';
    el.style.background = '';
  };
  el.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    dragging = false;
    el.style.transition = 'none';
  }, {passive:true});
  el.addEventListener('touchmove', e => {
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (!dragging && Math.abs(dx) < 10) return;
    if (Math.abs(dy) > Math.abs(dx)) return;
    dragging = true;
    const clamped = Math.max(-120, Math.min(120, dx));
    el.style.transform = `translateX(${clamped}px)`;
    if (dx < 0) {
      // Izquierda: actualizar precio de lista
      const pct = Math.min(1, -dx / THRESHOLD);
      el.style.background = `rgba(16,185,129,${pct*0.35})`;
    } else {
      // Derecha: eliminar de la lista de precios
      const pct = Math.min(1, dx / THRESHOLD);
      el.style.background = `rgba(239,68,68,${pct*0.35})`;
    }
  }, {passive:true});
  el.addEventListener('touchend', e => {
    if (!dragging) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    el.style.transition = 'transform 0.25s, background 0.25s';
    resetVisual();
    if (Math.abs(dy) > Math.abs(dx) || Math.abs(dx) < THRESHOLD) return;
    if (dx < 0) confirmSetListPrice(i);
    else confirmRemoveListPrice(i);
  }, {passive:true});
}

// Devuelve la lista de precios compartida a la que pertenece un cliente, o null si tiene precios individuales
function getClientSharedPriceList(cid) {
  const listId = S.cp[cid] && S.cp[cid]._priceListId;
  if (!listId) return null;
  return (S.priceLists||[]).find(x => x.id === listId) || null;
}

function confirmSetListPrice(i) {
  const cid = Number(document.getElementById('ord-cli').value);
  const it = ordItems[i];
  if (!it || !it.pid) return;
  const p = S.products.find(x => x.id === Number(it.pid));
  if (!p) return;
  const newPrice = it.price != null ? Number(it.price) : cliPrice(cid, p.id, p.basePrice);
  const listPrice = cliPrice(cid, p.id, p.basePrice);
  if (isNaN(newPrice) || newPrice === listPrice) { toast('El precio no cambió respecto a la lista','#f59e0b'); return; }
  const cli = S.clients.find(x => x.id === cid);
  if (!cli) return;
  const sharedList = getClientSharedPriceList(cid);

  const modal = document.getElementById('confirm-modal');
  const inner = modal.querySelector('div');
  const warn = sharedList ? `<div style="font-size:11px;color:#f59e0b;background:#3a2a0d;border:1px solid #f59e0b;border-radius:8px;padding:8px;margin-bottom:10px;text-align:left">⚠️ ${cli.name} comparte la lista "${sharedList.name}" con otros clientes. Este cambio los afectará a todos.</div>` : '';
  inner.innerHTML = `
    <div style="font-size:28px;margin-bottom:8px">💲</div>
    <div style="font-size:15px;font-weight:700;color:#f1f5f9;margin-bottom:6px">Actualizar precio de lista</div>
    <div style="font-size:12px;color:#94a3b8;margin-bottom:10px">¿Deseas actualizar el precio de <strong style="color:#f1f5f9">${p.name}</strong> a <strong style="color:#10b981">${Q(newPrice)}</strong> en la lista de precios de <strong style="color:#f1f5f9">${cli.name}</strong>?</div>
    ${warn}
    <div style="display:flex;gap:10px">
      <button onclick="document.getElementById('confirm-modal').style.display='none'" style="flex:1;padding:10px;border-radius:9px;border:1px solid #475569;background:transparent;color:#f1f5f9;font-weight:700;cursor:pointer;font-size:13px">Cancelar</button>
      <button onclick="applyListPriceUpdate(${i})" style="flex:1;padding:10px;border-radius:9px;border:none;background:#10b981;color:#fff;font-weight:800;cursor:pointer;font-size:13px">✔ Actualizar</button>
    </div>`;
  modal.style.display = 'flex';
}

function confirmRemoveListPrice(i) {
  const cid = Number(document.getElementById('ord-cli').value);
  const it = ordItems[i];
  if (!it || !it.pid) return;
  const p = S.products.find(x => x.id === Number(it.pid));
  if (!p) return;
  const cli = S.clients.find(x => x.id === cid);
  if (!cli) return;
  const cp = S.cp[cid] || S.cp[String(cid)];
  const hasOverride = cp && (cp[p.id] != null || cp[String(p.id)] != null);
  if (!hasOverride) { toast('Este producto ya está al precio base','#f59e0b'); return; }
  const sharedList = getClientSharedPriceList(cid);

  const modal = document.getElementById('confirm-modal');
  const inner = modal.querySelector('div');
  const warn = sharedList ? `<div style="font-size:11px;color:#f59e0b;background:#3a2a0d;border:1px solid #f59e0b;border-radius:8px;padding:8px;margin-bottom:10px;text-align:left">⚠️ ${cli.name} comparte la lista "${sharedList.name}" con otros clientes. Este cambio los afectará a todos.</div>` : '';
  inner.innerHTML = `
    <div style="font-size:28px;margin-bottom:8px">🗑️</div>
    <div style="font-size:15px;font-weight:700;color:#f1f5f9;margin-bottom:6px">Quitar de la lista de precios</div>
    <div style="font-size:12px;color:#94a3b8;margin-bottom:10px">¿Deseas eliminar <strong style="color:#f1f5f9">${p.name}</strong> de la lista de precios de <strong style="color:#f1f5f9">${cli.name}</strong>? Volverá al precio base (${Q(p.basePrice)}).</div>
    ${warn}
    <div style="display:flex;gap:10px">
      <button onclick="document.getElementById('confirm-modal').style.display='none'" style="flex:1;padding:10px;border-radius:9px;border:1px solid #475569;background:transparent;color:#f1f5f9;font-weight:700;cursor:pointer;font-size:13px">Cancelar</button>
      <button onclick="applyListPriceRemove(${i})" style="flex:1;padding:10px;border-radius:9px;border:none;background:#ef4444;color:#fff;font-weight:800;cursor:pointer;font-size:13px">🗑 Eliminar</button>
    </div>`;
  modal.style.display = 'flex';
}

function applyListPriceUpdate(i) {
  document.getElementById('confirm-modal').style.display = 'none';
  const cid = Number(document.getElementById('ord-cli').value);
  const it = ordItems[i];
  if (!it || !it.pid) return;
  const pid = Number(it.pid);
  const p = S.products.find(x => x.id === pid);
  if (!p) return;
  const newPrice = it.price != null ? Number(it.price) : cliPrice(cid, pid, p.basePrice);
  const sharedList = getClientSharedPriceList(cid);
  if (sharedList) {
    sharedList.prices[pid] = newPrice;
    if (!sharedList.visibleProds) sharedList.visibleProds = [];
    if (!sharedList.visibleProds.includes(pid)) sharedList.visibleProds.push(pid);
    (sharedList.clientIds||[]).forEach(otherCid => {
      if (!S.cp[otherCid]) S.cp[otherCid] = {};
      S.cp[otherCid][pid] = newPrice;
    });
  } else {
    if (!S.cp[cid]) S.cp[cid] = {};
    S.cp[cid][pid] = newPrice;
  }
  save();
  renderItems();
  toast('✅ Precio de lista actualizado','#10b981');
}

function applyListPriceRemove(i) {
  document.getElementById('confirm-modal').style.display = 'none';
  const cid = Number(document.getElementById('ord-cli').value);
  const it = ordItems[i];
  if (!it || !it.pid) return;
  const pid = Number(it.pid);
  const p = S.products.find(x => x.id === pid);
  if (!p) return;
  const sharedList = getClientSharedPriceList(cid);
  if (sharedList) {
    delete sharedList.prices[pid];
    sharedList.visibleProds = (sharedList.visibleProds||[]).filter(x => x !== pid);
    (sharedList.clientIds||[]).forEach(otherCid => {
      if (S.cp[otherCid]) {
        delete S.cp[otherCid][pid];
        if (Array.isArray(S.cp[otherCid]._visible)) {
          S.cp[otherCid]._visible = S.cp[otherCid]._visible.filter(x => Number(x) !== pid);
        }
      }
    });
  } else if (S.cp[cid]) {
    delete S.cp[cid][pid];
    if (Array.isArray(S.cp[cid]._visible)) {
      S.cp[cid]._visible = S.cp[cid]._visible.filter(x => Number(x) !== pid);
    }
  }
  it.price = null; // el pedido vuelve a mostrar el precio base/de lista
  save();
  renderItems();
  toast('🗑️ Producto eliminado de la lista de precios del cliente','#10b981');
}

function setQty(i, val) {
ordItems[i].qty = val;
const cid = Number(document.getElementById('ord-cli').value);
refreshSub(i, cid); refreshTotal(cid);
}
function remItem(i)   { ordItems.splice(i,1); renderItems(); }
function addOrdItem() { ordItems.push({pid:'',qty:1}); renderItems(); }

function refreshSub(i, cid) {
const el = document.getElementById('sub'+i); if (!el) return;
const it = ordItems[i]; if (!it.pid) { el.innerHTML=''; return; }
const p  = S.products.find(x => x.id===Number(it.pid)); if (!p) { el.innerHTML=''; return; }
ensureProductSpecs(p);
const activeSpecs = p.specs.filter(s=>s.active);
const canPickSpec = activeSpecs.length > 1;
const trueChosen = activeSpecs.find(s => String(s.id)===String(it.specId));
const fallbackSpec = activeSpecs[0] || p.specs[0];
const chosenSpec = trueChosen || (canPickSpec ? null : fallbackSpec);
const specLabel = chosenSpec ? chosenSpec.label : (canPickSpec ? '' : (p.presentation||''));
const needsSpecChoice = canPickSpec && !trueChosen;
const listPrice = cliPrice(cid, p.id, p.basePrice);
const prRaw = (it && it.price!=null)? it.price : listPrice;
// Mostrar precio de lista como referencia en el label con color
const refEl = document.getElementById('ref-price-'+i);
if (refEl) {
  const priceColor = prRaw < listPrice ? '#ef4444' : prRaw > listPrice ? '#4ade80' : '#60a5fa';
  refEl.textContent = 'Lista: '+Q(listPrice);
  refEl.style.color = priceColor;
}
const us    = itemUnitSizeFor(it, p);
const ul    = p.unitLabel||'unidad';
const qty   = Number(it.qty)||1;
const units = qty*us;
const sub  = prRaw * units;
const ivaIncGlobal = document.getElementById('ord-iva-inc')?.checked || false;
const prBase = ivaIncGlobal ? prRaw / 1.12 : prRaw;
const ivaAmt = ivaIncGlobal ? (prRaw - prBase) * units : 0;
const ivaRow = ivaIncGlobal ? `
<div style="font-size:11px;color:#64748b;margin-top:4px;padding-top:4px;border-top:1px solid #2a3050">
Sin IVA: <span style="color:#94a3b8">${Q(prBase)}/${ul}</span> &nbsp;·&nbsp;
IVA 12%: <span style="color:#60a5fa">${Q(ivaAmt)}</span>
</div>` : '';
const remBtnInline = ordItems.length > 1
  ? `<button class="br" style="padding:4px 10px;font-size:12px;margin-left:8px" onclick="remItem(${i})">✕</button>` : '';
// La etiqueta de especificación: si el producto tiene más de una activa,
// es tocable y despliega (con el mismo mecanismo del buscador de producto,
// no un <select> nativo, para que abra siempre con un solo toque) la lista
// de especificaciones. Mientras no se haya elegido, aparece vacía y en
// rojo como aviso; al elegir, se pone blanca. Si solo tiene una
// especificación, queda igual que siempre (informativa, no tocable).
const tagBaseStyle = 'font-size:12px;padding:4px 11px;font-weight:700';
let specTagHtml;
if (canPickSpec) {
  const selStyle = needsSpecChoice
    ? `background:#2a1010;border:1px solid #ef4444;color:#ef4444;${tagBaseStyle}`
    : `background:#161929;border:1px solid #2a3050;color:#f1f5f9;${tagBaseStyle}`;
  specTagHtml = `<select onchange="chooseSpec(${i}, this.value)" style="border-radius:6px;cursor:pointer;${selStyle}">
<option value="" ${needsSpecChoice?'selected':''}>-- Elegir --</option>
${activeSpecs.map(s=>`<option value="${s.id}" ${String(it.specId)===String(s.id)?'selected':''}>${s.label}${s.weightKg?' · '+s.weightKg+'kg':''}</option>`).join('')}
</select>`;
} else {
  specTagHtml = specLabel ? `<span class="tag" style="${tagBaseStyle}">${specLabel}</span>` : '<span></span>';
}
el.innerHTML = `<div style="background:#161929;border-radius:8px;padding:8px 10px">
<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
${specTagHtml}
<div style="display:flex;align-items:center">
<span style="color:#10b981;font-weight:700;font-size:14px">Subtotal: ${Q(sub)}</span>
${remBtnInline}
</div>
</div>
${ivaRow}</div>`;
}

function refreshTotal(cid) {
const box = document.getElementById('ord-total-box');
const has = ordItems.some(it => it.pid) || (ordBonusLines && ordBonusLines.length > 0);
if (!has) { box.style.display='none'; return; }
box.style.display = 'block';
refreshTotalWithIVA();
renderSapCalc();
}

// ── Calcular para SAP ───────────────────────────────────────────────────
// Capa de SOLO LECTURA sobre el pedido actual: NO modifica ordItems,
// ordBonusLines, ni nada que se vaya a guardar. Solo muestra, para cada
// línea (incluidas bonificaciones, que se facturan a valor normal), la
// cantidad y precio sin IVA a 2 decimales tal como deben capturarse en
// SAP — en kilos si el producto está marcado "Se factura por kilo", o en
// la unidad de venta normal si no. Cuando el botón no está activo, nada
// de esto se ejecuta y el resto del formulario funciona exactamente igual
// que siempre.
function resetSapCalcUI() {
  window._sapCalcOpen = false;
  window._sapConfirmed = false;
  const panel = document.getElementById('ord-sap-panel');
  const roundRow = document.getElementById('ord-sap-round-row');
  const btn = document.getElementById('btn-sap-calc');
  const roundChk = document.getElementById('ord-sap-round');
  if (panel) { panel.style.display = 'none'; panel.innerHTML = ''; }
  if (roundRow) roundRow.style.display = 'none';
  if (btn) { btn.style.background = 'transparent'; btn.style.color = '#a78bfa'; }
  if (roundChk) roundChk.checked = false;
  window._sapRoundMode = 'floor';
}
function toggleSapCalc() {
  window._sapCalcOpen = !window._sapCalcOpen;
  const panel = document.getElementById('ord-sap-panel');
  const roundRow = document.getElementById('ord-sap-round-row');
  const btn = document.getElementById('btn-sap-calc');
  if (panel)   panel.style.display = window._sapCalcOpen ? 'block' : 'none';
  if (roundRow) roundRow.style.display = window._sapCalcOpen ? 'block' : 'none';
  if (btn) { btn.style.background = window._sapCalcOpen ? '#7c3aed' : 'transparent'; btn.style.color = window._sapCalcOpen ? '#fff' : '#a78bfa'; }
  if (window._sapCalcOpen) renderSapCalc();
}

function _sapFmtQty(n) {
  return (Math.abs(n - Math.round(n)) < 0.005) ? String(Math.round(n)) : n.toFixed(2);
}

function renderSapCalc() {
  const panel = document.getElementById('ord-sap-panel');
  if (!panel || !window._sapCalcOpen) return;
  const cid = Number(document.getElementById('ord-cli').value);
  const roundMode = window._sapRoundMode || 'floor';
  const roundFn = (n) => roundMode === 'round' ? Math.round(n*100)/100 : Math.floor(n*100)/100;

  function calcLine(p, qty, priceWithIva, weightKgPerQty, unitSizePerQty) {
    if (!p || !qty || priceWithIva == null) return null;
    const unitSize = unitSizePerQty != null ? Number(unitSizePerQty) : (Number(p.unitSize) || 1);
    const totalUnits = Number(qty) * unitSize;
    const lineTotalWithIva = totalUnits * Number(priceWithIva);
    let sapQty, sapUnitLabel;
    if (p.facturaPorKilo) {
      const w = weightKgPerQty != null ? Number(weightKgPerQty) : Number(p.weightKg || 0);
      sapQty = Number(qty) * w;
      sapUnitLabel = 'kg';
    } else {
      sapQty = totalUnits;
      sapUnitLabel = p.unitLabel || 'unidad';
    }
    if (!sapQty) return null;
    const sapPriceWithIva = lineTotalWithIva / sapQty;
    const sapPriceNoIva = roundFn(sapPriceWithIva / 1.12);
    const sapLineTotalWithIva = sapQty * sapPriceNoIva * 1.12;
    return { sapQty, sapUnitLabel, sapPriceNoIva, sapLineTotalWithIva };
  }

  let rows = '';
  let grand = 0;

  ordItems.filter(it => it.pid && Number(it.qty) > 0).forEach(it => {
    const p = S.products.find(x => x.id === Number(it.pid));
    if (!p) return;
    ensureProductSpecs(p);
    const chosenSpec = p.specs.find(s => String(s.id)===String(it.specId)) || p.specs.filter(s=>s.active)[0] || p.specs[0];
    const priceWithIva = it.price != null ? it.price : cliPrice(cid, p.id, p.basePrice);
    const r = calcLine(p, it.qty, priceWithIva, chosenSpec ? chosenSpec.weightKg : null, chosenSpec ? chosenSpec.unitSize : null);
    if (!r) return;
    grand += r.sapLineTotalWithIva;
    rows += `<div class="prow"><span style="color:#f1f5f9">${p.name}${chosenSpec?' ('+chosenSpec.label+')':''}</span><span style="color:#94a3b8">${_sapFmtQty(r.sapQty)} ${r.sapUnitLabel} × ${Q(r.sapPriceNoIva)}</span></div>`;
  });

  (ordBonusLines || []).forEach(bl => {
    const p = S.products.find(x => x.id === Number(bl.productId));
    if (!p) return;
    ensureProductSpecs(p);
    const activeSpecs = p.specs.filter(s=>s.active);
    const chosenSpec = p.specs.find(s=>String(s.id)===String(bl.specId)) || (activeSpecs.length<=1 ? (activeSpecs[0]||p.specs[0]) : null);
    const priceWithIva = Number(bl.price) || 0;
    const r = calcLine(p, bl.qty, priceWithIva, chosenSpec ? chosenSpec.weightKg : null, chosenSpec ? chosenSpec.unitSize : null);
    if (!r) return;
    grand += r.sapLineTotalWithIva;
    rows += `<div class="prow"><span style="color:#f59e0b">🎁 ${p.name}${chosenSpec?' ('+chosenSpec.label+')':''}</span><span style="color:#94a3b8">${_sapFmtQty(r.sapQty)} ${r.sapUnitLabel} × ${Q(r.sapPriceNoIva)}</span></div>`;
  });

  panel.innerHTML = `<div style="background:#1a1030;border:1px solid #7c3aed;border-radius:8px;padding:10px">
<div style="font-size:11px;color:#a78bfa;margin-bottom:6px">⚖️ Cantidad y precio (sin IVA, 2 decimales) tal como deben ingresarse en SAP. No afecta el pedido ni la cotización que ve el cliente.</div>
${rows || '<div style="font-size:12px;color:#64748b">Agrega productos para ver el cálculo.</div>'}
<div class="prow" style="border-top:1px solid #2a3050;margin-top:6px;padding-top:6px">
<span style="font-weight:800;color:#f1f5f9">TOTAL con IVA (SAP)</span>
<span style="font-weight:800;color:#10b981">${Q(grand)}</span>
</div>
</div>`;
}

function refreshTotalWithIVA() {
const cid      = Number(document.getElementById('ord-cli').value);
const ivaChk   = document.getElementById('ord-iva');
const track    = document.getElementById('iva-track');
const thumb    = document.getElementById('iva-thumb');
const breakdown= document.getElementById('ord-breakdown');
const subtotalEl = document.getElementById('ord-subtotal-val');
const ivaEl    = document.getElementById('ord-iva-val');
const totalEl  = document.getElementById('ord-total-val');
if (!ivaChk || !totalEl) return;
const allPricesIncIva = document.getElementById('ord-iva-inc')?.checked || false;
// Calcular subtotal (suma de precios tal como están ingresados) — SOLO productos, sin bonificación
const subtotal = ordItems.reduce((s,it) => s+lineTotal(cid,it.pid,it.qty, it.price!=null?it.price:null, it.specId), 0);
// Si los precios incluyen IVA, la base es subtotal/1.12 y el IVA es subtotal - base
const subtotalSinIva      = allPricesIncIva ? subtotal / 1.12 : subtotal;
const subtotalIvaIncluido = allPricesIncIva ? subtotal : 0;
const useIva   = ivaChk.checked;
const incTrack = document.getElementById('iva-inc-track');
const incThumb = document.getElementById('iva-inc-thumb');
// Apariencia toggle "Agregar IVA"
if (track)    track.style.background = useIva          ? '#f59e0b' : '#2a3050';
if (thumb)    thumb.style.left       = useIva          ? '21px'    : '3px';
// Apariencia toggle "Ya incluye IVA"
if (incTrack) incTrack.style.background = allPricesIncIva ? '#60a5fa' : '#2a3050';
if (incThumb) incThumb.style.left       = allPricesIncIva ? '21px'    : '3px';
// Calcular totales
let baseParaIva, ivaMonto, totalFinal;
if (allPricesIncIva) {
// Los precios incluyen IVA → desglosar
baseParaIva = subtotalSinIva;                        // precio / 1.12
ivaMonto    = subtotal - baseParaIva;                // IVA contenido
totalFinal  = subtotal;                              // total no cambia
} else if (useIva) {
// Precios sin IVA → agregar 12%
baseParaIva = subtotal;
ivaMonto    = subtotal * 0.12;
totalFinal  = subtotal + ivaMonto;
} else {
baseParaIva = subtotal;
ivaMonto    = 0;
totalFinal  = subtotal;
}
const hayDesglose = useIva || allPricesIncIva;
if (hayDesglose) {
if (subtotalEl) subtotalEl.textContent = Q(baseParaIva);
if (ivaEl)      ivaEl.textContent      = Q(ivaMonto);
if (totalEl)    totalEl.textContent    = Q(totalFinal);
if (breakdown)  breakdown.style.display = 'block';
} else {
if (totalEl)   totalEl.textContent     = Q(subtotal);
if (breakdown) breakdown.style.display = 'none';
}

// Desglose SEPARADO de la bonificación (no afecta el total del pedido)
const bonusSubtotal = (ordBonusLines||[]).reduce((s,bl) => {
  const bp = S.products.find(x=>x.id===Number(bl.productId));
  const unitSize = itemUnitSizeFor(bl, bp);
  return s + (Number(bl.price)||0) * unitSize * (Number(bl.qty)||0);
}, 0);
const bonusBox = document.getElementById('ord-bonus-breakdown');
if (bonusBox) {
  if (bonusSubtotal > 0 && hayDesglose) {
    let bBase, bIva, bTotal;
    if (allPricesIncIva) {
      bBase = bonusSubtotal / 1.12;
      bIva  = bonusSubtotal - bBase;
      bTotal = bonusSubtotal;
    } else if (useIva) {
      bBase = bonusSubtotal;
      bIva  = bonusSubtotal * 0.12;
      bTotal = bonusSubtotal + bIva;
    } else {
      bBase = bonusSubtotal; bIva = 0; bTotal = bonusSubtotal;
    }
    bonusBox.style.display = 'block';
    bonusBox.innerHTML = `
      <div class="prow"><span style="color:#94a3b8">Subtotal bonificación (sin IVA)</span><span style="color:#f1f5f9;font-weight:700">${Q(bBase)}</span></div>
      <div class="prow"><span style="color:#94a3b8">IVA 12% bonificación</span><span style="color:#60a5fa;font-weight:700">${Q(bIva)}</span></div>
      <div class="prow"><span style="color:#94a3b8;font-weight:700">Total bonificación</span><span style="color:#10b981;font-weight:800">${Q(bTotal)}</span></div>`;
  } else {
    bonusBox.style.display = 'none';
    bonusBox.innerHTML = '';
  }
}
}

function submitOrder(isQuote) {
const cid = Number(document.getElementById('ord-cli').value);
if (!cid) return alert('Selecciona un cliente.');
if (editingOid === null) {
  const _cliBlockChk = S.clients.find(x=>x.id===cid);
  if (isClientBlocked(_cliBlockChk)) { toast('🔒 Este cliente está bloqueado. No se pueden generar pedidos nuevos.', '#ef4444'); return; }
}
const valid = ordItems.filter(it => it.pid && Number(it.qty) > 0);
if (!valid.length && !ordBonusLines.length) return alert('Agrega al menos un producto o una bonificación.');

// Validar que los productos con más de una especificación activa tengan una elegida
{
  const missingSpec = valid.filter(it => {
    const p = S.products.find(x=>x.id===Number(it.pid));
    if (!p) return false;
    ensureProductSpecs(p);
    const active = p.specs.filter(s=>s.active);
    return active.length > 1 && !active.some(s=>String(s.id)===String(it.specId));
  });
  if (missingSpec.length) {
    const nombres = missingSpec.map(it => { const p=S.products.find(x=>x.id===Number(it.pid)); return p?p.name:''; }).join(', ');
    toast('Selecciona la especificación de: '+nombres, '#f59e0b');
    return;
  }
  const missingBonusSpec = (ordBonusLines||[]).filter(bl => {
    const p = S.products.find(x=>x.id===Number(bl.productId));
    if (!p) return false;
    ensureProductSpecs(p);
    const active = p.specs.filter(s=>s.active);
    return active.length > 1 && !active.some(s=>String(s.id)===String(bl.specId));
  });
  if (missingBonusSpec.length) {
    const nombres = missingBonusSpec.map(bl => { const p=S.products.find(x=>x.id===Number(bl.productId)); return p?p.name:''; }).join(', ');
    toast('Selecciona la especificación de la bonificación: '+nombres, '#f59e0b');
    return;
  }
}

const delivery = document.getElementById('ord-delivery')?.value.trim() || '';
if (!delivery) return toast('El campo Entrega no puede estar vacío.', '#ef4444');
if (document.getElementById('delivery-alert')) return toast('Confirma o cambia la dirección de entrega sugerida.', '#f59e0b');

// Validar productos restringidos (por producto específico, no toda la familia)
const cliRest = S.clients.find(x=>x.id===cid);
{
  const cliAuthProdsVal = (cliRest && cliRest.authorizedProducts) || [];
  const restrictedItems = [];
  valid.forEach((it) => {
    const p = S.products.find(x=>x.id===Number(it.pid));
    const fam = p && p.family ? p.family.trim() : '';
    if (fam && (S.restrictedFamilies||[]).includes(fam) && !cliAuthProdsVal.includes(p.id)) {
      restrictedItems.push({idx: ordItems.indexOf(it), p, fam});
    }
  });
  if (restrictedItems.length) {
    const listHtml = restrictedItems.map(r => `<div style="font-size:13px;color:#f1f5f9;margin-bottom:2px">🔒 ${r.p.name} <span style="color:#94a3b8;font-size:11px">(${r.fam})</span></div>`).join('');
    const restPids = restrictedItems.map(r=>r.p.id);
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
    overlay.innerHTML = `<div style="background:#1e2236;border:1px solid #ef4444;border-radius:14px;padding:20px;max-width:360px;width:100%">
      <div style="font-size:15px;font-weight:800;color:#ef4444;margin-bottom:8px">🔒 Producto restringido</div>
      <div style="font-size:12px;color:#94a3b8;margin-bottom:10px">${cliRest?cliRest.name:'Este cliente'} no tiene permiso para comprar:</div>
      ${listHtml}
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:16px">
        <button onclick="const c=S.clients.find(x=>x.id===${cid});if(c){c.authorizedProducts=[...(c.authorizedProducts||[]),...[${restPids.join(',')}]];save();}this.closest('div[style*=fixed]').remove();submitOrder(${isQuote})"
          style="padding:10px;background:#10b981;border:none;border-radius:8px;color:#fff;font-weight:700;font-size:14px;cursor:pointer">✅ Dar permiso a este cliente y continuar</button>
        <button onclick="[${restrictedItems.map(r=>r.idx).join(',')}].sort((a,b)=>b-a).forEach(i=>ordItems.splice(i,1));renderItems();this.closest('div[style*=fixed]').remove();toast('🗑 Producto(s) restringido(s) quitado(s) del pedido','#f59e0b')"
          style="padding:10px;background:transparent;border:1px solid #ef4444;border-radius:8px;color:#ef4444;font-weight:700;font-size:14px;cursor:pointer">🗑 Quitar producto(s) y continuar editando</button>
        <button onclick="this.closest('div[style*=fixed]').remove()"
          style="padding:10px;background:#2a3050;border:none;border-radius:8px;color:#94a3b8;font-weight:700;font-size:14px;cursor:pointer">Cancelar</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    return;
  }
}

// Alerta de bonificación al duplicar
if (_duplicatingFrom && ordBonusLines.length > 0 && !window._bonusConfirmed) {
  const _ivaOn = document.getElementById('ord-iva')?.checked || false;
  const bonusDesc = ordBonusLines.map(bl => {
    const p = S.products.find(x=>x.id===Number(bl.productId));
    const spec = p?.presentation ? ` (${p.presentation})` : '';
    const ivaTxtE = _ivaOn ? ' <span style="font-size:10px;color:#60a5fa">+IVA</span>' : '';
    return `<div style="font-size:13px;color:#f1f5f9;margin-bottom:2px">🎁 ${bl.qty} ${p?p.name:'—'}${spec} × ${Q(bl.price||0)}${ivaTxtE}</div>`;
  }).join('');
  // Mostrar modal
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
  overlay.innerHTML = `<div style="background:#1e2236;border:1px solid #f59e0b;border-radius:14px;padding:20px;max-width:360px;width:100%">
    <div style="font-size:15px;font-weight:800;color:#f59e0b;margin-bottom:8px">🎁 Pedido con bonificación</div>
    <div style="font-size:12px;color:#94a3b8;margin-bottom:10px">Este pedido incluye bonificación:</div>
    ${bonusDesc}
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:16px">
      <button onclick="this.closest('div[style*=fixed]').remove();window._bonusConfirmed=true;submitOrder(${isQuote})"
        style="padding:10px;background:#10b981;border:none;border-radius:8px;color:#fff;font-weight:700;font-size:14px;cursor:pointer">✅ Confirmar y registrar</button>
      <button onclick="this.closest('div[style*=fixed]').remove()"
        style="padding:10px;background:#2a3050;border:1px solid #f59e0b;border-radius:8px;color:#f59e0b;font-weight:700;font-size:14px;cursor:pointer">✏️ Editar bonificación</button>
      <button onclick="ordBonusLines=[];renderOrdBonusRows();this.closest('div[style*=fixed]').remove();window._bonusConfirmed=true;submitOrder(${isQuote})"
        style="padding:10px;background:transparent;border:1px solid #ef4444;border-radius:8px;color:#ef4444;font-weight:700;font-size:14px;cursor:pointer">🗑 Eliminar bonificación y registrar</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  return;
}
window._bonusConfirmed = false;

// Confirmación al guardar en modo SAP: afecta solo cómo se van a MOSTRAR
// las tarjetas/cotización/reportes de este pedido (cantidades en kilos
// donde aplique, precios sin IVA truncados). Los datos reales que
// ingresaste no se tocan, y se puede desactivar después editando el pedido.
// No aplica al botón "Cotizar" (vista previa), solo a Registrar/Guardar.
if (!isQuote && window._sapCalcOpen && !window._sapConfirmed) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
  overlay.innerHTML = `<div style="background:#1e2236;border:1px solid #7c3aed;border-radius:14px;padding:20px;max-width:360px;width:100%">
    <div style="font-size:15px;font-weight:800;color:#a78bfa;margin-bottom:8px">🧮 Guardar en modo SAP</div>
    <div style="font-size:12px;color:#94a3b8;margin-bottom:10px">Las tarjetas, la cotización y los reportes de este pedido van a mostrar las cantidades y precios convertidos para SAP (kilos donde el producto lo requiera, precio sin IVA truncado a 2 decimales) en vez de lo que ingresaste. Los datos reales del pedido no cambian, y puedes desactivarlo después editando el pedido con el botón "Calcular para SAP" apagado.</div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:16px">
      <button onclick="this.closest('div[style*=fixed]').remove();window._sapConfirmed=true;submitOrder(${isQuote})"
        style="padding:10px;background:#7c3aed;border:none;border-radius:8px;color:#fff;font-weight:700;font-size:14px;cursor:pointer">✅ Sí, guardar en modo SAP</button>
      <button onclick="this.closest('div[style*=fixed]').remove()"
        style="padding:10px;background:#2a3050;border:none;border-radius:8px;color:#94a3b8;font-weight:700;font-size:14px;cursor:pointer">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  return;
}
window._sapConfirmed = false;

const cli  = S.clients.find(c => c.id===cid);
const comments = getComments();
const note = comments.join(' | ');  // backward compat field
const quote = document.getElementById('ord-quote')?.value.trim() || '';
const quoteNote = document.getElementById('ord-quote-note')?.value.trim() || '';
const oc = document.getElementById('ord-oc')?.value.trim() || '';
const contact = document.getElementById('ord-contact')?.value.trim() || '';
const applyIvaRaw     = document.getElementById('ord-iva')?.checked || false;
const pricesIncIvaRaw = document.getElementById('ord-iva-inc')?.checked || false;
// En modo SAP el precio que se ingresa siempre incluye IVA (así es como se
// cotiza al cliente), sin importar cómo estuvieran estos 2 interruptores.
// No aplica a la vista previa de "Cotizar", solo a Registrar/Guardar.
const sapModeOn    = !isQuote && !!window._sapCalcOpen;
const applyIva     = sapModeOn ? false : applyIvaRaw;
const pricesIncIva = sapModeOn ? true  : pricesIncIvaRaw;
const items = valid.map(it => {
const p = S.products.find(x => x.id===Number(it.pid));
const defaultPrice = cliPrice(cid, Number(it.pid), p?.basePrice||0);
const usedPrice = (it.price != null) ? Number(it.price) : defaultPrice;
const item = { productId:Number(it.pid), qty:Number(it.qty), customPrice:usedPrice };
// Especificación: se "congela" en el pedido la que estaba elegida/activa en
// este momento (etiqueta, peso y unidades por especificación), para que
// cambios futuros al producto (o a su especificación) no alteren pedidos
// ya hechos ni sus reportes.
if (p) {
  ensureProductSpecs(p);
  const chosenSpec = p.specs.find(s => String(s.id)===String(it.specId)) || p.specs.filter(s=>s.active)[0] || p.specs[0];
  if (chosenSpec) {
    item.specId = chosenSpec.id;
    item.specLabel = chosenSpec.label;
    item.specWeightKg = chosenSpec.weightKg;
    item.specUnitSize = chosenSpec.unitSize;
  }
}
return item;
});

// Modo edición
if (editingOid !== null) {
const ord = S.orders.find(x => x.id===editingOid);
if (ord) {
// Verificar si la fecha del pedido fue modificada
const dateFieldEl = document.getElementById('ord-date');
let newDateStr = null;
if (dateFieldEl && dateFieldEl.value) {
  const [y,m,d] = dateFieldEl.value.split('-');
  newDateStr = `${parseInt(d)}/${parseInt(m)}/${y}, 12:00:00 a.\u00a0m.`;
}
const originalDateYMD = (ord.date||'').split(',')[0].trim();
const newDateYMD = (newDateStr||'').split(',')[0].trim();
if (newDateStr && newDateYMD !== originalDateYMD) {
  const confirmChange = confirm('Vas a cambiar la fecha original de este pedido.\n\n¿Deseas continuar?');
  if (confirmChange) {
    ord.date = newDateStr;
  }
}
ord.clientId   = cli.id;
ord.clientName = cli.name;
ord.items        = items;
ord.bonusLines   = ordBonusLines.length ? ordBonusLines.map(bl=>({...bl})) : [];
ord.note         = note;
ord.comments     = comments;
ord.conditions   = ordConditions.filter(c=>c&&c.trim());
ord.contact      = contact;
ord.quote        = quote;
ord.quoteNote    = quoteNote;
ord.oc           = oc;
ord.delivery     = delivery;
ord.applyIva     = applyIva;
ord.pricesIncIva = pricesIncIva;
// Modo SAP: sapMode=true si se guardó con el botón activo (y confirmado);
// false si se guardó con el botón apagado — así queda reversible: basta
// con editar el pedido sin el botón activo para "desactivarlo".
ord.sapMode       = sapModeOn;
ord.sapRoundMode  = sapModeOn ? (window._sapRoundMode || 'floor') : undefined;
ord.editedAt     = nowDateTimeStr();
}
save(); toast('💾 Pedido actualizado');
// Verificar bonificaciones al editar
const editedOrd2 = S.orders.find(o=>o.id===editingOid);
if (editedOrd2) {
  checkBonusAlert(editedOrd2.clientId, editedOrd2.id, null, editedOrd2);
}
editingOid = null; ordItems = [{pid:'',qty:1}]; ordBonusLines = []; resetSapCalcUI();
document.getElementById('ord-cli').value = ''; document.getElementById('ord-cli-txt').value = '';
ordComments = [''];
document.getElementById('ord-iva').checked = false;
document.getElementById('ord-iva-inc').checked = true;
refreshTotalWithIVA();
onCliChange();
if (_cameFromClient !== null) {
  const _retCid = _cameFromClient;
  _cameFromClient = null;
  openClientCard(_retCid);
} else if (_cameFromRoute) {
  _cameFromRoute = false; goTab('routes');
} else {
  goTab('list');
  setTimeout(() => window.scrollTo({ top: _listScrollY, behavior: 'instant' }), 50);
}
return;
}

// Cotización temporal (no se guarda)
if (isQuote) {
if (!quote) return alert('Debe llenar el campo de cotización.');
showQuote({
id: 'T'+Date.now(), clientId:cli.id, clientName:cli.name,
quote, note, comments, items, applyIva, pricesIncIva, date:nowDateTimeStr(), status:'Cotización', isTemp:true,
conditions: ordConditions.filter(c=>c&&c.trim()), contact
});
return;
}

// Si el pedido viene de una duplicación, verificar que no tenga productos bloqueados
if (_duplicatingFrom) {
  const blockedProds = ordItems
    .map(it => S.products.find(p => Number(p.id) === Number(it.pid)))
    .filter(p => p && p.inactive);
  if (blockedProds.length) {
    const nombres = [...new Set(blockedProds.map(p => p.name))].join(', ');
    alert(`🔒 No se puede registrar este pedido.\n\nEl producto "${nombres}" está bloqueado. Reemplázalo o quítalo del pedido antes de guardar.`);
    return;
  }
}

// Verificar que toda bonificación manual sin marca de regla esté explícitamente marcada como excepcional
const unverifiedBonus = ordBonusLines.filter(bl => !bl.fromRuleId && !bl.exceptional);
if (unverifiedBonus.length) {
  alert('⚠️ Hay una bonificación en este pedido que no proviene de ninguna regla verificada.\n\nMarca la casilla "🎗️ Bonificación excepcional" en esa línea, o quítala, antes de guardar.');
  return;
}

// Nuevo pedido
const newOrd = {
  id:genId(), clientId:cli.id, clientName:cli.name,
  note, comments, quote, quoteNote, oc, delivery, applyIva, pricesIncIva, items, contact,
  conditions: ordConditions.filter(c=>c&&c.trim()),
  bonusLines: ordBonusLines.length ? ordBonusLines.map(bl=>({...bl})) : undefined,
  sapMode: sapModeOn, sapRoundMode: sapModeOn ? (window._sapRoundMode || 'floor') : undefined,
  date:(()=>{
    const fd = document.getElementById('ord-date')?.value;
    if (fd) {
      const [y,m,d] = fd.split('-');
      return `${parseInt(d)}/${parseInt(m)}/${y}, 12:00:00 a.\u00a0m.`;
    }
    return nowDateTimeStr();
  })(), status:'Cotización'
};
// Si viene de duplicar, preservar routeId solo si NO viene de ficha cliente
if (_duplicatingFrom) {
  const _origDup = S.orders.find(x => x.id === _duplicatingFrom);
  if (_origDup && _origDup.routeId && _cameFromClient === null) {
    newOrd.routeId = _origDup.routeId;
    const _route = S.routes ? S.routes.find(r => r.id === _origDup.routeId) : null;
    if (_route) { if (!_route.orders) _route.orders = []; _route.orders.push(newOrd.id); }
  }
  newOrd.duplicatedFrom = _duplicatingFrom;
  _duplicatingFrom = null;
  _isDuplicateSession = false;
}
S.orders.push(newOrd);

// Función para finalizar después de resolver bonificaciones
function finishSave() {
  // Si el pedido viene del botón "Enviar bonificación", reiniciar la regla
  if (window._pendingBonusReset) {
    const { cid: _bcid, ri: _bri } = window._pendingBonusReset;
    window._pendingBonusReset = null;
    const rules = S.bonuses?.[_bcid] || S.bonuses?.[String(_bcid)];
    const r = rules?.[_bri];
    if (r) {
      const lastOid = newOrd.id;
      resetBonusRule(r, lastOid, new Date().toISOString().split('T')[0]);
      if (!S.bonuses[_bcid]) S.bonuses[_bcid] = S.bonuses[String(_bcid)];
      toast('🎁 Bonificación entregada — período reiniciado','#10b981');
    }
  }
  const _isDup = !!newOrd.duplicatedFrom;
  const _pendRid = !_isDup && (sessionStorage.getItem('pendingRouteId') || localStorage.getItem('currentRouteId'));
  if (_pendRid) {
    const _route = S.routes ? S.routes.find(r => r.id == _pendRid) : null;
    if (_route) {
      if (!_route.orders) _route.orders = [];
      if (!_route.orders.includes(newOrd.id)) _route.orders.push(newOrd.id);
      newOrd.routeId = _route.id;
    }
    sessionStorage.removeItem('pendingRouteId');
    localStorage.removeItem('currentRouteId');
    save(); toast('✅ Pedido agregado a la ruta');
    if (_route) { setTimeout(()=>{ goTab('routes'); }, 300); }
  } else {
    sessionStorage.removeItem('pendingRouteId');
    localStorage.removeItem('currentRouteId');
    save(); toast('✅ Pedido registrado');
  }
  editingOid = null;
  resetSapCalcUI();
  document.getElementById('ord-quote').value='';
  document.getElementById('ord-oc').value='';
  const contactClearEl = document.getElementById('ord-contact'); if (contactClearEl) contactClearEl.value='';
  document.getElementById('ord-cli').value = ''; document.getElementById('ord-cli-txt').value = '';
  ordComments = [''];
  document.getElementById('ord-iva').checked = false;
  document.getElementById('ord-iva-inc').checked = true;
  refreshTotalWithIVA();
  ordItems = [{pid:'',qty:1}]; onCliChange();
  if (_cameFromClient !== null) {
    const _retCid = _cameFromClient;
    _cameFromClient = null;
    openClientCard(_retCid);
  } else if (_cameFromRoute) {
    _cameFromRoute = false;
    const _newOrdId = newOrd.id;
    goTab('routes');
    setTimeout(() => {
      const el = document.querySelector(`[data-oid="${_newOrdId}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 400);
  } else { goTab('list'); }
}

// Verificar bonificaciones antes de finalizar
const bonusTriggered = checkBonusAlert(cid, newOrd.id, finishSave, newOrd);
if (!bonusTriggered) finishSave();
}

// ═══════════════════════════════════════════════════════
//  EDITAR PEDIDO
// ═══════════════════════════════════════════════════════
function startEditOrder(id) {
const ord = S.orders.find(x => x.id===id); if (!ord) return;
_isDuplicateSession = false; _duplicatingData = null; _duplicatingFrom = null;
_listScrollY = window.scrollY;
editingOid = id;
ordItems   = ord.items.map(it => ({ pid:String(it.productId), qty:it.qty, price: it.customPrice != null ? it.customPrice : null, priceIncludesIva: !!it.priceIncludesIva, specId: it.specId != null ? it.specId : null }));
ordBonusLines = (ord.bonusLines||[]).map(bl => ({...bl}));
ordConditions = (ord.conditions||[]).slice();
goTab('order');
setTimeout(() => {
document.getElementById('ord-cli').value  = ord.clientId;
// Cargar comentarios (nuevo formato array o legado string)
if (ord.comments && ord.comments.length) {
setComments(ord.comments);
} else if (ord.note) {
setComments([ord.note]);
} else {
setComments(['']);
}
renderConditionFields();
const ivaChk = document.getElementById('ord-iva');
if (ivaChk) ivaChk.checked = !!ord.applyIva;
const ivaIncChk = document.getElementById('ord-iva-inc');
if (ivaIncChk) ivaIncChk.checked = !!ord.pricesIncIva;
const quoteInp = document.getElementById('ord-quote');
if (quoteInp) quoteInp.value = ord.quote || '';
const quoteNoteInp = document.getElementById('ord-quote-note');
if (quoteNoteInp) {
  // Si el valor guardado es una fecha en formato d/m/yyyy, convertirla a YYYY-MM-DD
  const qnVal = ord.quoteNote || '';
  const qnParts = qnVal.split('/');
  if (qnParts.length === 3) {
    const d = qnParts[0].padStart(2,'0'), m = qnParts[1].padStart(2,'0'), y = qnParts[2].trim().split(',')[0];
    quoteNoteInp.value = `${y}-${m}-${d}`;
  } else if (qnVal.match(/^\d{4}-\d{2}-\d{2}$/)) {
    quoteNoteInp.value = qnVal;
  } else {
    quoteNoteInp.value = qnVal;
  }
}
const ocInp = document.getElementById('ord-oc');
if (ocInp) ocInp.value = ord.oc || '';
const deliveryInp = document.getElementById('ord-delivery');
if (deliveryInp) deliveryInp.value = ord.delivery || '';
const contactInp = document.getElementById('ord-contact');
if (contactInp) contactInp.value = ord.contact || '';
// Cargar fecha del pedido en formato YYYY-MM-DD
const dateInp = document.getElementById('ord-date');
if (dateInp && ord.date) {
  const parts = ord.date.split(',')[0].split('/');
  if (parts.length === 3) {
    const d = parts[0].padStart(2,'0'), m = parts[1].padStart(2,'0'), y = parts[2].trim();
    dateInp.value = `${y}-${m}-${d}`;
  }
}
onCliChange();
// Si el pedido no tiene dirección y el cliente tiene favorita → mostrar alerta
if (!ord.delivery) {
  const _cid = Number(ord.clientId);
  const _defIdx = S.defaultAddresses && S.defaultAddresses[_cid] !== undefined ? S.defaultAddresses[_cid] : null;
  const _defAddrs = (S.savedAddresses && S.savedAddresses[_cid]) || [];
  if (_defIdx !== null && _defAddrs[_defIdx]) {
    setTimeout(() => showDeliveryAlert(_cid, _defAddrs[_defIdx]), 100);
  }
}
}, 60);
}

function cancelEdit() {
editingOid = null; ordItems = [{pid:'',qty:1}]; ordBonusLines = []; resetSapCalcUI();
const _wasDuplicating = !!_duplicatingFrom || !!_duplicatingData || _isDuplicateSession;
_duplicatingFrom = null; _duplicatingData = null; _isDuplicateSession = false;
const _prevAlert = document.getElementById('delivery-alert');
if (_prevAlert) _prevAlert.remove();
document.getElementById('ord-cli').value = ''; document.getElementById('ord-cli-txt').value = '';
const _qInp = document.getElementById('ord-quote'); if (_qInp) _qInp.value = '';
const _qnInp = document.getElementById('ord-quote-note'); if (_qnInp) _qnInp.value = '';
const _oInp = document.getElementById('ord-oc');    if (_oInp) _oInp.value = '';
const _dInp = document.getElementById('ord-delivery'); if (_dInp) _dInp.value = '';
ordComments = [''];
renderCommentFields();
const ivaChk = document.getElementById('ord-iva');
if (ivaChk) { ivaChk.checked = false; }
const ivaIncChk = document.getElementById('ord-iva-inc');
if (ivaIncChk) { ivaIncChk.checked = false; refreshTotalWithIVA(); }
document.getElementById('edit-banner').style.display = 'none';
document.getElementById('btn-submit').textContent    = '✅ Registrar Pedido';
const secTitle = document.getElementById('order-sec-title');
if (secTitle) { const span = secTitle.querySelector('span'); if (span) span.textContent = 'Crear Nuevo Pedido'; }
if (_cameFromClient !== null) {
  const _returnCid = _cameFromClient;
  _cameFromClient = null;
  _cameFromRoute = false;
  onCliChange();
  openClientCard(_returnCid);
  return;
}
if (_cameFromRoute) { _cameFromRoute = false; onCliChange(); goTab('routes'); return; }
_cameFromRoute = false;
onCliChange(); goTab('list');
}

// ═══════════════════════════════════════════════════════
//  COMENTARIOS MÚLTIPLES
// ═══════════════════════════════════════════════════════
function renderCommentFields() {
const wrap = document.getElementById('ord-comments-list');
if (!wrap) return;
wrap.innerHTML = '';
const cid = Number(document.getElementById('ord-cli').value);
let saved = (S.savedComments && S.savedComments[cid]) || [];
if (!Array.isArray(saved)) { saved = []; if (S.savedComments) S.savedComments[cid] = []; }
ordComments.forEach((c, i) => {
const row = document.createElement('div');
row.style.cssText = 'display:flex;gap:6px;align-items:flex-start;margin-bottom:6px';
const isPinned = c.trim() && saved.includes(c.trim());
const pinStyle = isPinned
  ? 'background:#052e16;border:1px solid #10b981;border-radius:7px;padding:4px 8px;flex-shrink:0;cursor:pointer;font-size:14px;color:#10b981'
  : 'background:transparent;border:1px solid #475569;border-radius:7px;padding:4px 8px;flex-shrink:0;cursor:pointer;font-size:14px;color:#475569';
const remBtn = ordComments.length > 1
  ? `<button class="br" onclick="removeComment(${i})" style="padding:4px 8px;flex-shrink:0">✕</button>` : '';
const ta = document.createElement('textarea');
ta.style.flex = '1';
ta.placeholder = 'Ej: Entregar el martes, confirmar al 5000-0000…';
ta.value = c;
ta.oninput = function() { ordComments[i] = this.value; };
row.appendChild(ta);
const pinBtn = document.createElement('button');
pinBtn.setAttribute('style', pinStyle);
pinBtn.textContent = '📌';
pinBtn.onclick = function() { pinComment(i); };
row.appendChild(pinBtn);
if (ordComments.length > 1) {
  const remEl = document.createElement('button');
  remEl.className = 'br';
  remEl.setAttribute('style','padding:4px 8px;flex-shrink:0');
  remEl.textContent = '✕';
  remEl.onclick = function() { removeComment(i); };
  row.appendChild(remEl);
}
wrap.appendChild(row);
});
renderSavedCommentsBar();
}

function pinComment(i) {
const txt = ordComments[i] && ordComments[i].trim();
if (!txt) return toast('Escribe un comentario primero','#ef4444');
const cid = Number(document.getElementById('ord-cli').value);
if (!cid) return toast('Selecciona un cliente primero','#ef4444');
if (!S.savedComments) S.savedComments = {};
let saved = S.savedComments[cid] || [];
if (!Array.isArray(saved)) saved = [];
const idx = saved.indexOf(txt);
if (idx >= 0) {
  saved.splice(idx, 1);
  toast('📌 Comentario quitado de predefinidos','#64748b');
} else {
  saved.push(txt);
  toast('📌 Comentario guardado para este cliente','#10b981');
}
S.savedComments[cid] = saved;
save();
renderCommentFields();
}

function useComment(txt) {
// Escribe el texto en el primer campo vacío, o crea uno nuevo
const empty = ordComments.findIndex(c => !c.trim());
if (empty >= 0) {
  ordComments[empty] = txt;
} else {
  ordComments.push(txt);
}
renderCommentFields();
// Sincronizar textareas con el array
setTimeout(() => {
  const areas = document.querySelectorAll('#ord-comments-list textarea');
  areas.forEach((ta, i) => { if (ordComments[i] !== undefined) ta.value = ordComments[i]; });
}, 10);
}

function showDeliveryAlert(cid, addr) {
  // Eliminar alerta anterior si existe
  const prev = document.getElementById('delivery-alert');
  if (prev) prev.remove();

  const inp = document.getElementById('ord-delivery');
  if (!inp) return;

  const alert = document.createElement('div');
  alert.id = 'delivery-alert';
  alert.style.cssText = 'background:#1e3a5f;border:1px solid #3b82f6;border-radius:8px;padding:10px 12px;margin-bottom:8px;font-size:13px;color:#f1f5f9';
  alert.innerHTML = `
    <div style="margin-bottom:8px">📍 <strong>Entregar en:</strong> ${addr}</div>
    <div style="display:flex;gap:8px">
      <button onclick="confirmDelivery('${addr.replace(/'/g,"\\'")}');document.getElementById('delivery-alert').remove();" style="flex:1;padding:7px;background:#10b981;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer">✅ Confirmar</button>
      <button onclick="document.getElementById('delivery-alert').remove();document.getElementById('ord-delivery').value='';onDeliveryInputChange();const _sel=document.getElementById('ord-delivery-sel');if(_sel){_sel.focus();if(_sel.showPicker)_sel.showPicker();}" style="flex:1;padding:7px;background:#475569;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer">🔄 Cambiar</button>
    </div>`;

  inp.parentNode.insertBefore(alert, inp);
}

function confirmDelivery(addr) {
  const inp = document.getElementById('ord-delivery');
  if (inp) { inp.value = addr; onDeliveryInputChange(); }
}

function refreshDeliverySel(cid) {
  const sel = document.getElementById('ord-delivery-sel');
  const inp = document.getElementById('ord-delivery');
  const btn = document.getElementById('ord-delivery-save-btn');
  if (!sel) return;
  if (!S.savedAddresses) S.savedAddresses = {};
  const addrs = S.savedAddresses[cid] || [];
  sel.innerHTML = '<option value="">— Seleccionar dirección guardada —</option>' +
    addrs.map((a,i) => `<option value="${i}">${a}</option>`).join('');
  if (btn) btn.style.display = 'none';
}

function onDeliverySelChange() {
  const sel = document.getElementById('ord-delivery-sel');
  const inp = document.getElementById('ord-delivery');
  const btn = document.getElementById('ord-delivery-save-btn');
  if (!sel || !inp) return;
  const idx = sel.value;
  const cid = Number(document.getElementById('ord-cli')?.value);
  if (idx === '') {
    inp.value = '';
    if (btn) btn.style.display = 'none';
    return;
  }
  const addrs = (S.savedAddresses && S.savedAddresses[cid]) || [];
  inp.value = addrs[Number(idx)] || '';
  if (btn) btn.style.display = 'none';
}

function onDeliveryInputChange() {
  const inp = document.getElementById('ord-delivery');
  const btn = document.getElementById('ord-delivery-save-btn');
  const sel = document.getElementById('ord-delivery-sel');
  if (!inp || !btn) return;
  const txt = inp.value.trim();
  const cid = Number(document.getElementById('ord-cli')?.value);
  if (!cid || !txt) { btn.style.display = 'none'; return; }
  const addrs = (S.savedAddresses && S.savedAddresses[cid]) || [];
  // Mostrar botón guardar solo si la dirección no está ya guardada
  btn.style.display = addrs.includes(txt) ? 'none' : 'inline-block';
}

function saveDeliveryToClient() {
  const inp = document.getElementById('ord-delivery');
  const txt = inp ? inp.value.trim() : '';
  const cid = Number(document.getElementById('ord-cli')?.value);
  if (!cid || !txt) return;
  if (!S.savedAddresses) S.savedAddresses = {};
  let arr = S.savedAddresses[cid] || [];
  if (!Array.isArray(arr)) arr = [];
  if (arr.includes(txt)) return toast('Ya existe esa dirección','#f59e0b');
  arr.push(txt);
  S.savedAddresses[cid] = arr;
  save();
  refreshDeliverySel(cid);
  const btn = document.getElementById('ord-delivery-save-btn');
  if (btn) btn.style.display = 'none';
  toast('📍 Dirección guardada en el cliente','#10b981');
}

function toggleSavedComments() {
const bar = document.getElementById('saved-comments-bar');
if (!bar) return;
const open = bar.style.display === 'flex';
bar.style.display = open ? 'none' : 'flex';
if (!open) renderSavedCommentsBar();
}

function renderSavedCommentsBar() {
const bar = document.getElementById('saved-comments-bar');
if (!bar || bar.style.display === 'none') return;
const cid = Number(document.getElementById('ord-cli').value);
let saved = (S.savedComments && S.savedComments[cid]) || [];
if (!Array.isArray(saved)) { saved = []; if (S.savedComments) S.savedComments[cid] = []; }
if (!saved.length) { bar.innerHTML = '<span style="font-size:12px;color:#64748b;padding:4px">No hay comentarios predefinidos para este cliente.</span>'; return; }
bar.innerHTML = '';
saved.forEach((c, i) => {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:4px;background:#1e2236;border:1px solid #2a3050;border-radius:7px;padding:4px 8px;font-size:12px;max-width:100%';
  const span = document.createElement('span');
  span.style.cssText = 'cursor:pointer;color:#f1f5f9;flex:1;white-space:pre-line';
  span.textContent = c;
  span.onclick = function() { useComment(c); };
  row.appendChild(span);
  const btn = document.createElement('button');
  btn.style.cssText = 'background:none;border:none;color:#ef4444;cursor:pointer;font-size:14px;padding:0 2px';
  btn.title = 'Quitar predefinido';
  btn.textContent = '✕';
  btn.onclick = function() { removeSavedComment(i); };
  row.appendChild(btn);
  bar.appendChild(row);
});
}

function removeSavedComment(i) {
const cid = Number(document.getElementById('ord-cli').value);
if (!S.savedComments || !S.savedComments[cid]) return;
S.savedComments[cid].splice(i, 1);
save();
renderCommentFields();
renderSavedCommentsBar();
}
function addCommentField() {
ordComments.push('');
renderCommentFields();
// Enfocar el nuevo textarea
const all = document.querySelectorAll('#ord-comments-list textarea');
if (all.length) all[all.length-1].focus();
}
function removeComment(i) {
ordComments.splice(i, 1);
renderCommentFields();
}

// ── Términos y condiciones de la oferta (mismo patrón que los comentarios,
// pero con una lista de predefinidos GLOBAL en S.savedConditions, no por cliente) ──
function renderConditionFields() {
const wrap = document.getElementById('ord-conditions-list');
if (!wrap) return;
wrap.innerHTML = '';
let saved = S.savedConditions || [];
if (!Array.isArray(saved)) { saved = []; S.savedConditions = []; }
ordConditions.forEach((c, i) => {
const row = document.createElement('div');
row.style.cssText = 'display:flex;gap:6px;align-items:flex-start;margin-bottom:6px';
const isPinned = c.trim() && saved.includes(c.trim());
const pinStyle = isPinned
  ? 'background:#052e16;border:1px solid #10b981;border-radius:7px;padding:4px 8px;flex-shrink:0;cursor:pointer;font-size:14px;color:#10b981'
  : 'background:transparent;border:1px solid #475569;border-radius:7px;padding:4px 8px;flex-shrink:0;cursor:pointer;font-size:14px;color:#475569';
const ta = document.createElement('textarea');
ta.style.cssText = 'flex:1;background:#161929;border:1px solid #2a3050;border-radius:8px;padding:9px 11px;color:#f1f5f9;font-size:13px;outline:none;resize:vertical;min-height:46px;line-height:1.4';
ta.placeholder = 'Ej: Precios sujetos a cambio sin previo aviso...';
ta.value = c;
ta.oninput = function() { ordConditions[i] = this.value; };
row.appendChild(ta);
const pinBtn = document.createElement('button');
pinBtn.setAttribute('style', pinStyle);
pinBtn.textContent = '📌';
pinBtn.onclick = function() { pinCondition(i); };
row.appendChild(pinBtn);
const remEl = document.createElement('button');
remEl.className = 'br';
remEl.setAttribute('style','padding:9px 10px;flex-shrink:0');
remEl.textContent = '✕';
remEl.onclick = function() { removeCondition(i); };
row.appendChild(remEl);
wrap.appendChild(row);
});
renderSavedConditionsBar();
}

function addConditionField() {
ordConditions.push('');
renderConditionFields();
const all = document.querySelectorAll('#ord-conditions-list textarea');
if (all.length) all[all.length-1].focus();
}

function removeCondition(i) {
ordConditions.splice(i, 1);
renderConditionFields();
}

function pinCondition(i) {
const txt = ordConditions[i] && ordConditions[i].trim();
if (!txt) return toast('Escribe una condición primero','#ef4444');
if (!S.savedConditions) S.savedConditions = [];
const idx = S.savedConditions.indexOf(txt);
if (idx >= 0) {
  S.savedConditions.splice(idx, 1);
  toast('📌 Condición quitada de predefinidas','#64748b');
} else {
  S.savedConditions.push(txt);
  toast('📌 Condición guardada como predefinida','#10b981');
}
save();
renderConditionFields();
}

function toggleSavedConditions() {
const bar = document.getElementById('saved-conditions-bar');
if (!bar) return;
const open = bar.style.display === 'flex';
bar.style.display = open ? 'none' : 'flex';
if (!open) renderSavedConditionsBar();
}

function renderSavedConditionsBar() {
const bar = document.getElementById('saved-conditions-bar');
if (!bar || bar.style.display === 'none') return;
let saved = S.savedConditions || [];
if (!Array.isArray(saved)) { saved = []; S.savedConditions = []; }
if (!saved.length) { bar.innerHTML = '<span style="font-size:12px;color:#64748b;padding:4px">No hay condiciones predefinidas.</span>'; return; }
bar.innerHTML = '';
saved.forEach((c, i) => {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:4px;background:#1e2236;border:1px solid #2a3050;border-radius:7px;padding:4px 8px;font-size:12px;max-width:100%';
  const span = document.createElement('span');
  span.style.cssText = 'cursor:pointer;color:#f1f5f9;flex:1;white-space:pre-line';
  span.textContent = c;
  span.onclick = function() { useCondition(c); };
  row.appendChild(span);
  const btn = document.createElement('button');
  btn.style.cssText = 'background:none;border:none;color:#ef4444;cursor:pointer;font-size:14px;padding:0 2px';
  btn.title = 'Quitar predefinida';
  btn.textContent = '✕';
  btn.onclick = function() { removeSavedCondition(i); };
  row.appendChild(btn);
  bar.appendChild(row);
});
}

function removeSavedCondition(i) {
if (!S.savedConditions) return;
S.savedConditions.splice(i, 1);
save();
renderConditionFields();
renderSavedConditionsBar();
}

function useCondition(txt) {
const empty = ordConditions.findIndex(c => !c.trim());
if (empty >= 0) {
  ordConditions[empty] = txt;
} else {
  ordConditions.push(txt);
}
renderConditionFields();
setTimeout(() => {
  const areas = document.querySelectorAll('#ord-conditions-list textarea');
  areas.forEach((ta, i) => { if (ordConditions[i] !== undefined) ta.value = ordConditions[i]; });
}, 10);
}

function getComments() {
return ordComments.map(c=>c.trim()).filter(Boolean);
}
function setComments(arr) {
ordComments = (arr && arr.length) ? [...arr] : [''];
renderCommentFields();
}

// ═══════════════════════════════════════════════════════
//  DUPLICAR PEDIDO
// ═══════════════════════════════════════════════════════
function duplicateOrder(id) {
  const orig = S.orders.find(x => x.id === id); if (!orig) return;
  _isDuplicateSession = true;

  // Precargar estado antes de abrir el formulario
  editingOid = null;
  ordItems = orig.items.map(it => ({ pid:String(it.productId||it.pid), qty:it.qty, price: it.customPrice != null ? it.customPrice : null, priceIncludesIva: !!it.priceIncludesIva, specId: it.specId != null ? it.specId : null }));
  ordBonusLines = orig.bonusLines ? orig.bonusLines.map(bl=>({...bl})) : [];
  _duplicatingFrom = id;
  if (orig.routeId) _cameFromRoute = true;
  sessionStorage.removeItem('pendingRouteId');
  localStorage.removeItem('currentRouteId');
  _duplicatingData = {
    clientId:   orig.clientId,
    quote:      orig.quote      || '',
    quoteNote:  orig.quoteNote  || '',
    oc:         orig.oc         || '',
    delivery:   orig.delivery   || '',
    applyIva:   orig.applyIva   || false,
    pricesIncIva: orig.pricesIncIva || false,
    comments:   orig.comments ? [...orig.comments] : (orig.note ? [orig.note] : [])
  };

  goTab('order');
}
let _orderTab = 'all';
let _orderAsc = false; // false = recientes primero (default)

let _selectedClients = [];

function renderCliTags() {
  const tagsEl = document.getElementById('f-cli-tags');
  if (!tagsEl) return;
  tagsEl.innerHTML = '';
  _selectedClients.forEach(n => {
    const chip = document.createElement('div');
    chip.style.cssText = 'display:flex;align-items:center;gap:5px;background:#1e2236;border:1px solid #2a3050;border-radius:20px;padding:4px 6px 4px 12px;font-size:12px;color:#f1f5f9';
    const span = document.createElement('span');
    span.textContent = n;
    chip.appendChild(span);
    const btn = document.createElement('button');
    btn.textContent = '✕';
    btn.style.cssText = 'background:none;border:none;color:#ef4444;cursor:pointer;font-size:13px;padding:2px 4px';
    btn.onmousedown = (e) => removeCliTag(n, e);
    chip.appendChild(btn);
    tagsEl.appendChild(chip);
  });
}

function removeCliTag(name, e) {
  if (e) e.preventDefault();
  _selectedClients = _selectedClients.filter(x => x !== name);
  renderCliTags();
  renderList();
}

function filterReportCli() {
  const inp  = document.getElementById('f-cli-report');
  const drop = document.getElementById('f-cli-drop');
  if (!inp || !drop) return;
  const q = inp.value.trim().toLowerCase();
  const names = [...new Set(S.orders.map(o=>o.clientName))].sort((a,b)=>a.localeCompare(b,'es'));
  const available = names.filter(n => !_selectedClients.includes(n));
  const matches = q ? available.filter(n=>n.toLowerCase().includes(q)) : available;
  if (!matches.length) { drop.style.display='none'; return; }
  drop.innerHTML = matches.slice(0,15).map(n =>
    `<div style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid #2a3050;color:#f1f5f9" onmousedown="selectReportCli('${n.replace(/'/g,"\\'")}')">${n}</div>`
  ).join('');
  drop.style.display = 'block';
}

function selectReportCli(name) {
  if (!_selectedClients.includes(name)) {
    _selectedClients.push(name);
    renderCliTags();
  }
  const inp = document.getElementById('f-cli-report');
  if (inp) inp.value = '';
  const drop = document.getElementById('f-cli-drop');
  if (drop) drop.style.display = 'none';
  renderList();
}

function clearReportFilters() {
  _selectedClients = [];
  renderCliTags();
  const f = document.getElementById('f-cli-report');
  const disp = document.getElementById('date-range-display');
  if (f) f.value = '';
  if (disp) disp.value = '';
  _drpFrom = null; _drpTo = null; _drpStep = 'from';
  const d1 = document.getElementById('f-date-from');
  const d2 = document.getElementById('f-date-to');
  if (d1) d1.value = '';
  if (d2) d2.value = '';
  // Limpiar también productos y la casilla de bonificaciones del reporte multi-filtro
  _mfrProductIds = [];
  mfrRenderProdChips();
  const prodSearch = document.getElementById('mfr-prod-search');
  if (prodSearch) prodSearch.value = '';
  const bonusChk = document.getElementById('mfr-include-bonus');
  if (bonusChk) bonusChk.checked = true;
  const bonusFilteredChk = document.getElementById('mfr-bonus-filtered');
  if (bonusFilteredChk) bonusFilteredChk.checked = false;
  renderList();
}

function getReportFiltered() {
  const _prospectIds1 = new Set(S.clients.filter(c=>c.isProspect).map(c=>c.id));
  const ords = S.orders.filter(o=>!_prospectIds1.has(Number(o.clientId)) && !o.cancelled);
  const base = _orderAsc ? [...ords].filter(o=>!o.routeId).sort((a,b)=>{ const td=ordDateTs(a)-ordDateTs(b); return td!==0?td:a.id-b.id; }) : [...ords].filter(o=>!o.routeId).sort((a,b)=>{ const td=ordDateTs(b)-ordDateTs(a); return td!==0?td:b.id-a.id; });
  let filtered = _orderTab === 'all' ? base : base.filter(o=>o.status===_orderTab);
  const fCli  = (document.getElementById('f-cli-report')?.value||'').trim();
  const fFrom = document.getElementById('f-date-from')?.value;
  const fTo   = document.getElementById('f-date-to')?.value;
  if (_selectedClients && _selectedClients.length) { const _expNames1 = expandSelectedClientNames(_selectedClients); filtered = filtered.filter(o=>_expNames1.includes(o.clientName)); }

  if (fFrom||fTo) {
    filtered = filtered.filter(o=>{
      const parts=(o.date||'').split('/');
      if(parts.length<3) return true;
      const d=parseInt(parts[0]),m=parseInt(parts[1]),y=parseInt(parts[2]);
      const ds=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      if(fFrom&&ds<fFrom) return false;
      if(fTo&&ds>fTo) return false;
      return true;
    });
  }

  // Filtro por producto (el mismo criterio que usa el reporte por clientes
  // y productos): antes solo se aplicaba al generar el reporte, no al
  // presionar "Filtrar" sobre la lista general de pedidos.
  if (_mfrProductIds && _mfrProductIds.length) {
    const includeBonus  = document.getElementById('mfr-include-bonus')?.checked !== false;
    const bonusFiltered = document.getElementById('mfr-bonus-filtered')?.checked === true;
    filtered = filtered.filter(o => {
      const hasProdItem = o.items.some(it => _mfrProductIds.includes(Number(it.productId||it.pid)));
      if (hasProdItem) return true;
      if (!includeBonus) return false;
      const hasBonus = (o.bonusLines||[]).length > 0;
      if (!hasBonus) return false;
      return bonusFiltered ? (o.bonusLines||[]).some(bl => _mfrProductIds.includes(Number(bl.productId))) : true;
    });
  }

  return filtered;
}

// ── Selección de pedidos para reporte general ──
if (!window._ordSel) window._ordSel = new Set();


function toggleOrdSel(oid, checked) {
  if (!window._ordSel) window._ordSel = new Set();
  if (checked) window._ordSel.add(oid);
  else window._ordSel.delete(oid);
  updateOrdSelBar();
}

function _getNavBottom() {
  const nav = document.getElementById('nav');
  const hdr = document.querySelector('.app-header');
  let top = 0;
  if (hdr) top += hdr.offsetHeight;
  if (nav) top += nav.offsetHeight;
  return top;
}

function updateOrdSelBar() {
  const bar = document.getElementById('ord-sel-bar');
  const n = (window._ordSel||new Set()).size;
  if (!bar) return;
  if (n === 0) {
    bar.style.display = 'none';
    const page = document.getElementById('page-list');
    if (page) page.style.paddingTop = '';
    return;
  }
  bar.style.top = _getNavBottom() + 'px';
  bar.style.display = 'flex';
  document.getElementById('ord-sel-count').textContent = n + ' pedido' + (n!==1?'s':'') + ' seleccionado' + (n!==1?'s':'');
  // Resumen: total y clientes
  const selOrds = [...(window._ordSel)].map(id => S.orders.find(o=>o.id===id)).filter(Boolean);
  const total = selOrds.reduce((s,o)=>{ const t=orderTotal(o.items,o.clientId); return s+(o.applyIva?t*1.12:t); },0);
  const prods = {};
  selOrds.forEach(o => o.items.forEach(it => {
    const p = S.products.find(x=>x.id===(it.productId||Number(it.pid)));
    const k = (p?p.name:'—');
    prods[k] = (prods[k]||0) + Number(it.qty);
  }));
  const prodLines = Object.entries(prods).map(([k,v])=>`• ${k}: <strong style="color:#f1f5f9">${v}</strong>`).join(' &nbsp;');
  document.getElementById('ord-sel-summary').innerHTML =
    `<div style="color:#f59e0b;font-weight:700;margin-bottom:3px">Total: ${Q(total)}</div>${prodLines}`;
  setTimeout(() => {
    const barBottom = bar.getBoundingClientRect().bottom;
    const page = document.getElementById('page-list');
    if (page) {
      const oldPad = parseInt(page.style.paddingTop) || 0;
      const pageTop = page.getBoundingClientRect().top;
      const newPad = Math.max(0, barBottom - pageTop + oldPad);
      if (Math.abs(newPad - oldPad) > 2) {
        const diff = newPad - oldPad;
        page.style.paddingTop = newPad + 'px';
        window.scrollBy(0, diff);
      }
    }
  }, 80);
}

function clearOrdSel() {
  window._ordSel = new Set();
  document.querySelectorAll('.ord-report-chk').forEach(chk => chk.checked = false);
  ['Cotización','Confirmado','Concluido'].forEach(s => { _ordStatusActive[s]=false; });
  const r = {Cotización:{b:'#64748b',c:'#94a3b8'}, Confirmado:{b:'#1d4ed8',c:'#60a5fa'}, Concluido:{b:'#15803d',c:'#4ade80'}};
  const m = {Cotización:'ord-btn-cot', Confirmado:'ord-btn-con', Concluido:'ord-btn-fin'};
  Object.entries(m).forEach(([s,id])=>{ const b=document.getElementById(id); if(b){b.style.background='transparent';b.style.color=r[s].c;b.style.borderColor=r[s].b;} });
  updateOrdSelBar();
}

function selectAllOrdVisible() {
  document.querySelectorAll('.ord-report-chk').forEach(chk => {
    chk.checked = true;
    window._ordSel.add(Number(chk.dataset.oid));
  });
  updateOrdSelBar();
}
const _ordStatusActive = {};
function toggleOrdByStatus(status) {
  const btnMap = {Cotización:'ord-btn-cot', Confirmado:'ord-btn-con', Concluido:'ord-btn-fin'};
  const colorMap = {Cotización:{b:'#64748b',c:'#94a3b8',ab:'#475569',ac:'#fff'}, Confirmado:{b:'#1d4ed8',c:'#60a5fa',ab:'#1d4ed8',ac:'#fff'}, Concluido:{b:'#15803d',c:'#4ade80',ab:'#15803d',ac:'#fff'}};
  const btn = document.getElementById(btnMap[status]);
  const col = colorMap[status];

  // Si ningún botón de estado está activo, limpiar selección manual primero
  const anyActive = Object.values(_ordStatusActive).some(v => v);
  if (!anyActive && !_ordStatusActive[status]) {
    window._ordSel = new Set();
    document.querySelectorAll('.ord-report-chk').forEach(chk => chk.checked = false);
  }

  if (_ordStatusActive[status]) {
    _ordStatusActive[status] = false;
    document.querySelectorAll('.ord-report-chk').forEach(chk => {
      const o = S.orders.find(x => x.id === Number(chk.dataset.oid));
      if (o && o.status === status) { chk.checked = false; window._ordSel.delete(Number(chk.dataset.oid)); }
    });
    if (btn) { btn.style.background='transparent'; btn.style.color=col.c; btn.style.borderColor=col.b; }
  } else {
    _ordStatusActive[status] = true;
    document.querySelectorAll('.ord-report-chk').forEach(chk => {
      const o = S.orders.find(x => x.id === Number(chk.dataset.oid));
      if (o && o.status === status) { chk.checked = true; window._ordSel.add(Number(chk.dataset.oid)); }
    });
    if (btn) { btn.style.background=col.ab; btn.style.color=col.ac; btn.style.borderColor=col.ab; }
  }
  updateOrdSelBar();
}
function generateOrderReportSel() {
  if (!window._ordSel || window._ordSel.size === 0) {
    return toast('Selecciona al menos un pedido con ☑️', '#f59e0b');
  }
  const selIds = [...window._ordSel];
  generateOrderReport(selIds);
  window._ordSel = new Set();
  document.querySelectorAll('.ord-report-chk').forEach(chk => chk.checked = false);
  updateOrdSelBar();
}

function shareOrderReportSel() {
  if (!window._ordSel || window._ordSel.size === 0) {
    return toast('Selecciona al menos un pedido con ☑️', '#f59e0b');
  }
  const selIds = [...window._ordSel];
  let filtered = getReportFiltered().filter(o => selIds.includes(o.id));
  if (!filtered.length) return toast('Sin pedidos para compartir','#f59e0b');

  // Helper: extraer comentarios de un pedido
  function getCmts(o) {
    return (o.comments&&o.comments.length ? o.comments : (o.note?[o.note]:[])).filter(c=>c&&c.trim());
  }

  // Helper: líneas de productos de un pedido
  function getProdLines(o) {
    const ivaText = o.applyIva ? ' + IVA' : '';
    return o.items.map(it => {
      const p = S.products.find(x=>x.id===(it.productId||Number(it.pid)));
      const pr = (it.customPrice!=null)?it.customPrice:cliPrice(o.clientId,it.productId||it.pid,p?.basePrice||0);
      const ul = p?.unitLabel||'unidad';
      const spec = itemSpecLabel(it,p) ? ` (${itemSpecLabel(it,p)})` : '';
      return `》${it.qty} ${p?p.name:'—'}${spec}\nPrecio: ${Q(pr)}/${ul}${ivaText}`;
    }).join('\n');
  }

  // Helper: bloque de bonificación
  function getBonusBlock(o) {
    if (!o.bonusLines || !o.bonusLines.length) return '';
    const lines = o.bonusLines.map(bl => {
      const p = S.products.find(x=>x.id===Number(bl.productId));
      const ul = p?.unitLabel||'unidad';
      const spec = p?.presentation ? ` (${p.presentation})` : '';
      const ivaTxt = o.applyIva ? ' +IVA' : '';
      const comment = bl.ruleName ? `\n${bl.ruleName}` : '';
      return `${bl.qty} ${p?p.name:'—'}${spec}\nPrecio: ${Q(bl.price||0)}/${ul}${ivaTxt}${comment}`;
    }).join('\n');
    return `\n》BONIFICACIÓN《\n${lines}`;
  }

  // Helper: total de un pedido
  function getTotal(o) {
    const t = orderTotal(o.items, o.clientId);
    return o.applyIva ? t*1.12 : t;
  }

  const uniqueClients = [...new Set(filtered.map(o => o.clientId))];
  const sameClient = uniqueClients.length === 1;

  let subject, body;

  if (sameClient) {
    const clientName = filtered[0].clientName;
    const cliObj = S.clients.find(c => c.id === filtered[0].clientId);
    const idPart = cliObj && cliObj.clientCode ? `ID: ${cliObj.clientCode} - ` : '';
    const quotes = filtered.map(o => o.quote||'').filter(q=>q);
    const uniqueQuotes = [...new Set(quotes)];
    const sameQuote = uniqueQuotes.length === 1;

    // Asunto
    subject = sameQuote && uniqueQuotes[0]
      ? `${idPart}${clientName} - ${uniqueQuotes[0]}`
      : `${idPart}${clientName}`;

    // Verificar si todos los pedidos tienen exactamente los mismos comentarios
    const firstCmts = getCmts(filtered[0]).join('||');
    const sameCmts = filtered.every(o => getCmts(o).join('||') === firstCmts);

    if (sameCmts) {
      // Caso 1: mismo cliente, comentarios idénticos — comentarios una sola vez al inicio
      const sharedCmts = getCmts(filtered[0]);
      const cmtBlock = sharedCmts.length ? sharedCmts.join('\n') + '\n\n' : '';
      // Dirección: si todos tienen la misma va arriba, si no va en cada pedido
      const firstDelivery = filtered[0].delivery || '';
      const sameDelivery = filtered.every(o => (o.delivery || '') === firstDelivery);
      const sharedDelivery = sameDelivery && firstDelivery ? `Entrega: ${firstDelivery}\n\n` : '';
      // QuoteNote: si todos tienen el mismo va arriba, si no va en cada pedido
      const firstQNote = filtered[0].quoteNote || '';
      const sameQNote = filtered.every(o => (o.quoteNote || '') === firstQNote);
      const sharedQNote = sameQNote && firstQNote ? `Fecha de entrega: ${fmtEntrega(firstQNote)}\n\n` : '';

      const pedidoLines = filtered.map((o, i) => {
        const cotLine = (!sameQuote && o.quote) ? `Cot. ${o.quote}\n` : '';
        const ocLine = o.oc ? `Orden ${o.oc}\n` : '';
        const qNoteLine = (!sameQNote && o.quoteNote) ? `Fecha de entrega: ${fmtEntrega(o.quoteNote)}\n` : '';
        const deliveryLine = (!sameDelivery && o.delivery) ? `Entrega: ${o.delivery}\n` : '';
        const prodLines = getProdLines(o);
        const bonusBlock = getBonusBlock(o);
        return `Pedido #${i+1}\n${cotLine}${ocLine}${qNoteLine}${deliveryLine}${prodLines}\nTOTAL: ${Q(getTotal(o))}${bonusBlock}`;
      }).join('\n\n');

      body = `Buen día, por favor facturar y coordinar despacho.\n\n${sharedQNote}${sharedDelivery}${cmtBlock}${pedidoLines}`;

    } else {
      // Caso 2: comentarios mixtos — comunes arriba, únicos en cada pedido
      const allCmtSets = filtered.map(o => getCmts(o));
      const commonCmts = allCmtSets[0].filter(c =>
        allCmtSets.every(cmts => cmts.includes(c))
      );
      const commonBlock = commonCmts.length ? commonCmts.join('\n') + '\n\n' : '';
      // Dirección: si todos tienen la misma va arriba, si no va en cada pedido
      const firstDelivery2 = filtered[0].delivery || '';
      const sameDelivery2 = filtered.every(o => (o.delivery || '') === firstDelivery2);
      const sharedDelivery2 = sameDelivery2 && firstDelivery2 ? `Entrega: ${firstDelivery2}\n\n` : '';
      // QuoteNote: si todos tienen el mismo va arriba, si no va en cada pedido
      const firstQNote2 = filtered[0].quoteNote || '';
      const sameQNote2 = filtered.every(o => (o.quoteNote || '') === firstQNote2);
      const sharedQNote2 = sameQNote2 && firstQNote2 ? `Fecha de entrega: ${fmtEntrega(firstQNote2)}\n\n` : '';

      const pedidoLines = filtered.map((o, i) => {
        const cotLine = (!sameQuote && o.quote) ? `Cot. ${o.quote}\n` : '';
        const ocLine = o.oc ? `Orden ${o.oc}\n` : '';
        const qNoteLine = (!sameQNote2 && o.quoteNote) ? `Fecha de entrega: ${fmtEntrega(o.quoteNote)}\n` : '';
        const deliveryLine = (!sameDelivery2 && o.delivery) ? `Entrega: ${o.delivery}\n` : '';
        const uniqueCmts = getCmts(o).filter(c => !commonCmts.includes(c));
        const cmtBlock = uniqueCmts.length ? uniqueCmts.join('\n') + '\n\n' : '';
        const prodLines = getProdLines(o);
        const bonusBlock = getBonusBlock(o);
        return `Pedido #${i+1}\n${cotLine}${ocLine}${qNoteLine}${deliveryLine}${cmtBlock}${prodLines}\nTOTAL: ${Q(getTotal(o))}${bonusBlock}`;
      }).join('\n\n');

      body = `Buen día, por favor facturar y coordinar despacho.\n\n${sharedQNote2}${sharedDelivery2}${commonBlock}${pedidoLines}`;
    }

  } else {
    // Caso 3: múltiples clientes — texto general actual
    subject = 'Pedidos Varios';
    const mailLines = filtered.map((o, i) => {
      const cmts = getCmts(o);
      const cliObj3 = S.clients.find(c => c.id === o.clientId);
      const idLine = cliObj3 && cliObj3.clientCode ? `ID: ${cliObj3.clientCode} - ${o.clientName}` : `${o.clientName}`;
      const cotLine = o.quote ? `Cot: ${o.quote}` : '';
      const ocLine  = o.oc    ? `Orden ${o.oc}` : '';
      const qNoteLine3 = o.quoteNote ? `Fecha de entrega: ${fmtEntrega(o.quoteNote)}` : '';
      const deliveryLine = o.delivery ? `Entrega: ${o.delivery}` : '';
      const cmtLines = cmts.map(c => `${c}`).join('\n');
      const prodLines = getProdLines(o);
      const bonusBlock = getBonusBlock(o);
      let t = [`Pedido #${i+1}`, idLine, cotLine, ocLine, qNoteLine3, deliveryLine].filter(Boolean).join('\n');
      if (cmtLines) t += '\n' + cmtLines + '\n\n'; else t += '\n';
      t += prodLines;
      t += '\n' + `TOTAL: ${Q(getTotal(o))}`;
      if (bonusBlock) t += '\n\n' + bonusBlock;
      return t;
    }).join('\n\n');
    body = 'Buen día, por favor facturar:\n\n' + mailLines;
  }

  if (navigator.share) {
    navigator.share({ title: subject, text: body }).catch(() => {});
  } else {
    location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  window._ordSel = new Set();
  document.querySelectorAll('.ord-report-chk').forEach(chk => chk.checked = false);
  updateOrdSelBar();
}

function generateOrderReport(selIds) {
  let filtered = getReportFiltered();
  if (selIds) filtered = filtered.filter(o => selIds.includes(o.id));
  if (!filtered.length) return toast('Sin pedidos para el filtro seleccionado','#f59e0b');
  const b = S.biz;
  const fCli  = (document.getElementById('f-cli-report')?.value||'').trim();
  const fFrom = document.getElementById('f-date-from')?.value;
  const fTo   = document.getElementById('f-date-to')?.value;
  const defaultTitle = fCli ? `Informe: ${fCli}` : 'Informe de Pedidos';
  const title = prompt('Título del informe (también será el nombre del archivo):', defaultTitle) || defaultTitle;
  const periodo = (fFrom||fTo) ? `${fFrom||'inicio'} → ${fTo||'hoy'}` : fmtOrdDate((()=>{ const n=new Date(); return `${String(n.getDate()).padStart(2,'0')}/${String(n.getMonth()+1).padStart(2,'0')}/${n.getFullYear()}`; })());
  // Total con IVA a mostrar por pedido: si está en modo SAP, usa el total
  // convertido (kg + precio sin IVA truncado); si no, el total normal.
  function _ordDispTotal(o) {
    if (o.sapMode) { const sc = getSapCalcForOrder(o); return sc ? sc.totalConIva : 0; }
    const t = orderTotal(o.items, o.clientId);
    return o.applyIva ? t*1.12 : t;
  }
  const tot = filtered.reduce((s,o)=>s+_ordDispTotal(o),0);

  // Resumen de productos
  const prodTotals = {};
  const prodWeights = {};
  filtered.forEach(o => o.items.forEach(it=>{
    const p=S.products.find(x=>x.id===(it.productId||Number(it.pid)));
    const key=(p?p.name:'—');
    prodTotals[key]=(prodTotals[key]||0)+Number(it.qty);
    { const _w = it.specWeightKg != null ? it.specWeightKg : (p && p.weightKg); if (_w) prodWeights[key]=(prodWeights[key]||0)+Number(it.qty)*Number(_w); }
  }));
  const totalWeightKg = Object.values(prodWeights).reduce((s,w)=>s+w,0);
  const prodSummaryRows = Object.entries(prodTotals).sort((a,b)=>(prodWeights[b[0]]||0)-(prodWeights[a[0]]||0) || a[0].localeCompare(b[0],'es'))
    .map(([k,v])=>{
      const w = prodWeights[k];
      const wTxt = w ? ` (${w.toLocaleString('es-GT',{maximumFractionDigits:2})} kg)` : '';
      return `<div style="display:flex;justify-content:space-between;padding:3px 8px;font-size:12px;border-bottom:1px solid #f0f0f0"><span>${k}</span><strong>${v}${wTxt}</strong></div>`;
    }).join('');

  // Filas de pedidos
  const rows = filtered.map((o,i)=>{
    const oDisp = _ordDispTotal(o);
    const sapCalc = o.sapMode ? getSapCalcForOrder(o) : null;
    const prods = sapCalc ? sapCalc.items.map(r=>`<tr><td style="padding:5px 8px;font-size:12px">${r.name}${r.specLabel?` <span style="color:#374151">(${r.specLabel})</span>`:''}</td>
        <td style="padding:5px 8px;text-align:center;font-size:12px">${r.qty}</td>
        <td style="padding:5px 8px;text-align:right;font-size:12px">${Q(r.sapPriceNoIva)}/${r.sapUnitLabel} <span style="color:#2563eb;font-size:10px">+IVA</span></td>
        <td style="padding:5px 8px;text-align:right;font-weight:700;font-size:12px">${Q(r.sapLineTotalWithIva)}</td></tr>`).join('') : o.items.map(it=>{
      const p=S.products.find(x=>x.id===(it.productId||Number(it.pid)));
      const pr=(it.customPrice!=null)?it.customPrice:cliPrice(o.clientId,it.productId||it.pid,p?.basePrice||0);
      const ul=p?.unitLabel||'unidad';
      const _ivaTag1 = o.applyIva ? ' <span style="color:#2563eb;font-size:10px">+IVA</span>' : '';
      return `<tr><td style="padding:5px 8px;font-size:12px">${p?p.name:'—'}${p?.presentation?` <span style="color:#374151">(${p.presentation})</span>`:''}</td>
        <td style="padding:5px 8px;text-align:center;font-size:12px">${it.qty}</td>
        <td style="padding:5px 8px;text-align:right;font-size:12px">${Q(pr)}/${ul}${_ivaTag1}</td>
        <td style="padding:5px 8px;text-align:right;font-weight:700;font-size:12px">${Q(pr*it.qty*itemUnitSizeFor(it,p))}</td></tr>`;
    }).join('');
    const bonusRowsHtml = sapCalc ? sapCalc.bonusLines.map(r=>`<tr style="background:#f0fdf4"><td style="padding:4px 8px;color:#15803d"><span style="font-size:11px;font-weight:700">${r.name}${r.specLabel?' ('+r.specLabel+')':''}</span>${r.ruleName&&r.ruleName!=='Manual'?`<br><span style="font-size:10px;color:#6b7280">${r.ruleName}</span>`:''}</td>
        <td style="padding:4px 8px;text-align:center;color:#15803d">${r.qty}</td>
        <td style="padding:4px 8px;text-align:right;color:#15803d">${Q(r.sapPriceNoIva)}/${r.sapUnitLabel} <span style="font-size:10px">+IVA</span></td>
        <td style="padding:4px 8px;text-align:right;font-weight:700;color:#15803d">${Q(r.sapLineTotalWithIva)}</td></tr>`).join('') : (o.bonusLines||[]).map(bl=>{
      const p=S.products.find(x=>x.id===Number(bl.productId));
      const ul=p?.unitLabel||'unidad';
      const sub=(bl.price||0)*bl.qty*itemUnitSizeFor(bl,p);
      const _ivaTagB1 = o.applyIva ? ' <span style="font-size:10px">+IVA</span>' : '';
      return `<tr style="background:#f0fdf4"><td style="padding:4px 8px;color:#15803d"><span style="font-size:11px;font-weight:700">${p?p.name+' ('+(p.presentation||'')+')'  :'—'}</span>${bl.ruleName&&bl.ruleName!=='Manual'?`<br><span style="font-size:10px;color:#6b7280">${bl.ruleName}</span>`:''}</td>
        <td style="padding:4px 8px;text-align:center;color:#15803d">${bl.qty}</td>
        <td style="padding:4px 8px;text-align:right;color:#15803d">${Q(bl.price||0)}/${ul}${_ivaTagB1}</td>
        <td style="padding:4px 8px;text-align:right;font-weight:700;color:#15803d">${Q(sub)}</td></tr>`;
    }).join('');
    const cmts = (o.comments&&o.comments.length?o.comments:(o.note?[o.note]:[])).filter(c=>c&&c.trim());
    const stColor = o.status==='Concluido'?'#15803d':o.status==='Confirmado'?'#1d4ed8':'#64748b';
    const metaLine = [o.quote?`<strong>📋 Cot: ${o.quote}</strong>`:'', o.oc?`<strong>📄 OC: ${o.oc}</strong>`:''].filter(Boolean).join(' &nbsp;·&nbsp; ');
    const deliveryHtml = o.delivery ? `<div style="padding:4px 12px;font-size:16px;background:#f0f9ff;border-top:1px solid #bae6fd;color:#0369a1;font-weight:700">📍 Entrega: ${o.delivery}</div>` : '';
    const cmtsHtml = cmts.length ? `<div style="padding:5px 12px;font-size:11px;background:#fffbeb;border-top:1px solid #fde68a">` +
      cmts.map((c,ci) => ci===0
        ? `<span style="color:#92400e;font-weight:800;background:#fef08a;padding:1px 4px;border-radius:3px">💬 ${c}</span>`
        : `<span style="color:#374151;font-weight:600">💬 ${c}</span>`
      ).join('<br>') + '</div>' : '';
    const bonusSeparator = bonusRowsHtml ? `<tr style="background:#f0fdf4"><td colspan="4" style="padding:2px 8px;font-size:10px;color:#15803d;border-top:2px dashed #86efac;font-weight:700">─── BONIFICACIONES ───</td></tr>` : '';
    const _cliRep = S.clients.find(c => c.id === o.clientId);
    const _idRep = _cliRep && _cliRep.clientCode ? `ID: ${_cliRep.clientCode} - ` : '';
    return `<div style="border:1px solid #e5e7eb;border-radius:8px;margin-bottom:12px;overflow:hidden;page-break-inside:avoid">
      <div style="background:#f9fafb;padding:8px 12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div style="flex:1;min-width:0">
            <div style="font-size:16px;font-weight:900;color:#1e3a8a">#${i+1} ${_idRep}${o.clientName}</div>
            ${o.quote?`<div style="font-size:13px;color:#111;margin-top:2px">📋 Cot: <strong>${o.quote}</strong></div>`:''}
            ${o.oc?`<div style="font-size:13px;color:#111;margin-top:2px">📄 OC: <strong>${o.oc}</strong></div>`:''}
            ${o.quoteNote?`<div style="font-size:16px;color:#f59e0b;font-weight:700;margin-top:3px;padding:3px 7px;background:#fffbeb;border-left:3px solid #f59e0b;border-radius:3px">Fecha de entrega: ${fmtEntrega(o.quoteNote)}</div>`:''}
          </div>
          <span style="font-size:11px;font-weight:700;color:${stColor};border:1px solid ${stColor};border-radius:12px;padding:2px 8px;white-space:nowrap;margin-left:8px">${o.status}</span>
        </div>
      </div>
      ${deliveryHtml}
      ${cmtsHtml}
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:#f3f4f6"><th style="padding:5px 8px;text-align:left;font-size:12px">Producto</th><th style="padding:5px 8px;font-size:12px">Cant.</th><th style="padding:5px 8px;font-size:12px">P/Unidad</th><th style="padding:5px 8px;font-size:12px">Subtotal</th></tr></thead>
        <tbody>${prods}${bonusSeparator}${bonusRowsHtml}</tbody>
      </table>
      <div style="text-align:right;padding:6px 12px;font-weight:800;font-size:13px;border-top:2px solid #111">TOTAL: ${Q(oDisp)}</div>
    </div>`;
  }).join('');

  const logoHtml = b.logoData ? `<img src="${b.logoData}" style="width:50px;height:50px;border-radius:8px;object-fit:cover"/>` : `<div style="font-size:28px">${b.emoji||'📦'}</div>`;
  // Generar texto del correo (debe ir antes del template html)
  const mailLines = filtered.map((o, i) => {
    const oDisp = _ordDispTotal(o);
    const sapCalc2 = o.sapMode ? getSapCalcForOrder(o) : null;
    const cmts = (o.comments&&o.comments.length?o.comments:(o.note?[o.note]:[])).filter(c=>c&&c.trim());
    const cotLine = o.quote ? `Cot: ${o.quote}` : '';
    const ocLine  = o.oc    ? `Orden ${o.oc}` : '';
    const cmtLines = cmts.map(c => `•${c}`).join('\n');
    const prodLines = sapCalc2 ? sapCalc2.items.map(r => {
      const spec = r.specLabel ? ` (${r.specLabel})` : '';
      return '》'+r.qty+' '+r.name+spec+'\nPrecio: '+Q(r.sapPriceNoIva)+'/'+r.sapUnitLabel+' + IVA';
    }).join('\n') : o.items.map(it => {
      const p = S.products.find(x=>x.id===(it.productId||Number(it.pid)));
      const pr = (it.customPrice!=null)?it.customPrice:cliPrice(o.clientId,it.productId||it.pid,p?.basePrice||0);
      const ul = p?.unitLabel||'unidad';
      const spec = itemSpecLabel(it,p) ? ` (${itemSpecLabel(it,p)})` : '';
      const ivaText = o.applyIva ? ' + IVA' : '';
      return '》'+it.qty+' '+(p?p.name:'—')+spec+'\nPrecio: '+Q(pr)+'/'+ul+ivaText;
    }).join('\n');
    const bonusLines = sapCalc2 ? sapCalc2.bonusLines.map(r => {
      const spec = r.specLabel ? ` (${r.specLabel})` : '';
      return r.qty+' '+r.name+spec+'\nPrecio: '+Q(r.sapPriceNoIva)+'/'+r.sapUnitLabel+' + IVA';
    }).join('\n') : (o.bonusLines||[]).map(bl => {
      const p = S.products.find(x=>x.id===Number(bl.productId));
      const ul = p?.unitLabel||'unidad';
      const spec = p?.presentation ? ' ('+p.presentation+')' : '';
      const ivaTxtC = o.applyIva ? ' + IVA' : '';
      return bl.qty+' '+(p?p.name:'—')+spec+'\nPrecio: '+Q(bl.price||0)+'/'+ul+ivaTxtC;
    }).join('\n');
    const bonusBlock = bonusLines ? '》BONIFICACIÓN《\n'+bonusLines : '';
    const parts = ['#'+(i+1), o.clientName, cotLine, ocLine, cmtLines, '', prodLines];
    if (bonusBlock) { parts.push(''); parts.push(bonusBlock); }
    parts.push(''); parts.push('TOTAL: '+Q(oDisp));
    return parts.filter(l=>l!==null&&l!==undefined).join('\n');
  }).join('\n\n');
  const mailBody = 'Buen día, por favor facturar:\n\n' + mailLines;
  const mailSubject = title;

  const tPend = filtered.filter(o=>o.status==='Confirmado').reduce((s,o)=>s+_ordDispTotal(o),0);
  const tFact = filtered.filter(o=>o.status==='Concluido').reduce((s,o)=>s+_ordDispTotal(o),0);

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;padding:14px;color:#111;font-size:17px}
  .hdr{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid #111}
  .sum{display:flex;gap:6px;margin-bottom:14px}
  .sb{flex:1;border:1px solid #e5e7eb;border-radius:7px;padding:6px 4px;text-align:center;min-width:0}
  .sb .l{font-size:11px;color:#6b7280;margin-bottom:2px}.sb .v{font-size:14px;font-weight:800;white-space:nowrap}
  table{font-size:12px}th,td{font-size:12px}
  @media print{button{display:none!important}body{padding:6px}}</style>
  </head><body>
  <div class="hdr">
    <div style="display:flex;gap:12px;align-items:center"><div>
      <div style="font-size:19px;font-weight:900">${b.name||'Mi Negocio'}</div>
    </div></div>
    <div style="text-align:right">
      <div style="font-size:16px;font-weight:800">${title}</div>
      <div style="font-size:11px;color:#6b7280">${periodo}</div>
    </div>
  </div>
  <div class="sum">
    <div class="sb"><div class="l">Pedidos</div><div class="v">${filtered.length}</div></div>
    <div class="sb"><div class="l">TOTAL</div><div class="v" style="color:#d97706">${Q(tot)}</div></div>
    ${totalWeightKg > 0 ? `<div class="sb"><div class="l">PESO TOTAL</div><div class="v" style="color:#1d4ed8">${totalWeightKg.toLocaleString('es-GT',{maximumFractionDigits:2})} kg</div></div>` : ''}
  </div>
  <div style="margin-bottom:14px;display:flex;gap:16px;padding:0 12px">
    <button onclick="document.body.style.zoom=(parseFloat(document.body.style.zoom||1)-0.1).toFixed(1)" style="padding:16px 28px;background:#475569;color:#fff;border:none;border-radius:8px;font-size:32px;cursor:pointer;font-weight:700;line-height:1">－</button>
    <button onclick="window.print()" style="flex:1;padding:16px 4px;background:#1d4ed8;color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer;font-weight:700">🖨️ Imprimir / PDF</button>
    <button onclick="document.body.style.zoom=(parseFloat(document.body.style.zoom||1)+0.1).toFixed(1)" style="padding:16px 28px;background:#475569;color:#fff;border:none;border-radius:8px;font-size:32px;cursor:pointer;font-weight:700;line-height:1">＋</button>
  </div>
  <div style="margin-bottom:14px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
    <div style="background:#1e3a8a;color:#fff;padding:7px 12px;font-weight:800;font-size:13px">📦 Resumen de Productos</div>
    <div style="column-count:3;column-gap:0;column-rule:1px solid #e5e7eb">${prodSummaryRows}</div>
  </div>
  ${rows}
</body></html>`;

  const blob = new Blob([html], {type:'text/html;charset=utf-8'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.target = '_blank';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}


let _mfrProductIds = [];

function mfrSearchProds() {
  const txt = document.getElementById('mfr-prod-search');
  const drop = document.getElementById('mfr-prod-drop');
  if (!txt || !drop) return;
  const rect = txt.getBoundingClientRect();
  drop.style.position = 'fixed';
  drop.style.top = (rect.bottom + 2) + 'px';
  drop.style.left = rect.left + 'px';
  drop.style.width = rect.width + 'px';
  drop.style.right = 'auto';
  const q = normalizeStr(txt.value.trim());
  const matches = S.products.filter(p =>
    !_mfrProductIds.includes(p.id) &&
    (q.length===0 || normalizeStr(p.name).includes(q) || normalizeStr(p.presentation||'').includes(q))
  ).slice(0, 30);
  drop.innerHTML = '';
  if (!matches.length) { drop.innerHTML = '<div class="ac-empty">Sin resultados</div>'; acOpen('mfr-prod-drop'); return; }
  matches.forEach(p => {
    const d = document.createElement('div');
    d.className = 'ac-opt';
    d.innerHTML = `${p.name}${p.presentation?` <small>${p.presentation}</small>`:''}`;
    d.onmousedown = () => {
      _mfrProductIds.push(p.id);
      txt.value = '';
      acClose('mfr-prod-drop');
      mfrRenderProdChips();
    };
    drop.appendChild(d);
  });
  acOpen('mfr-prod-drop');
}

function mfrRenderProdChips() {
  const wrap = document.getElementById('mfr-prod-chips');
  if (!wrap) return;
  wrap.innerHTML = '';
  _mfrProductIds.forEach(pid => {
    const p = S.products.find(x=>x.id===pid);
    if (!p) return;
    const chip = document.createElement('div');
    chip.style.cssText = 'display:flex;align-items:center;gap:5px;background:#1e2236;border:1px solid #2a3050;border-radius:20px;padding:4px 6px 4px 12px;font-size:12px;color:#f1f5f9';
    chip.innerHTML = `<span>${p.name}</span>`;
    const btn = document.createElement('button');
    btn.textContent = '✕';
    btn.style.cssText = 'background:none;border:none;color:#ef4444;cursor:pointer;font-size:13px;padding:2px 4px';
    btn.onclick = () => {
      _mfrProductIds = _mfrProductIds.filter(x=>x!==pid);
      mfrRenderProdChips();
    };
    chip.appendChild(btn);
    wrap.appendChild(chip);
  });
}

function generateMultiFilterReport() {
  const clientNames = _selectedClients.slice();
  const prodIds = _mfrProductIds.slice(); // vacío = todos los productos
  if (!clientNames.length && !prodIds.length) { toast('Selecciona al menos un cliente o un producto', '#f59e0b'); return; }
  // Sin cliente(s) marcado(s): incluir todos los clientes (menos prospectos,
  // igual que en la lista general de pedidos), filtrando solo por producto.
  const clientIds = clientNames.length
    ? S.clients.filter(c => clientNames.includes(c.name)).map(c => c.id)
    : S.clients.filter(c => !c.isProspect).map(c => c.id);
  const includeBonus = document.getElementById('mfr-include-bonus')?.checked !== false;
  const bonusFiltered = document.getElementById('mfr-bonus-filtered')?.checked === true;

  const fFrom = document.getElementById('f-date-from')?.value;
  const fTo   = document.getElementById('f-date-to')?.value;
  const fromStr = fFrom || '2000-01-01';
  const toStr   = fTo   || '2099-12-31';

  function toYMD(d) {
    if (!d) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(d))) return d;
    const p = String(d).split(',')[0].split('/');
    return p.length===3 ? `${p[2].trim()}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}` : d;
  }

  let filtered = S.orders.filter(o =>
    clientIds.includes(Number(o.clientId)) &&
    (o.status==='Confirmado'||o.status==='Concluido')
  ).filter(o => { const ds=toYMD(o.date); return ds>=fromStr && ds<=toStr; });

  if (prodIds.length) {
    filtered = filtered.filter(o => {
      const hasProdItem = o.items.some(it => prodIds.includes(Number(it.productId||it.pid)));
      if (hasProdItem) return true;
      if (!includeBonus) return false;
      const hasBonus = (o.bonusLines||[]).length > 0;
      if (!hasBonus) return false;
      // Caso 1 (solo includeBonus): cualquier bonificación incluye el pedido.
      // Caso 2 (includeBonus + bonusFiltered): solo si la bonificación es de un producto filtrado.
      return bonusFiltered ? (o.bonusLines||[]).some(bl => prodIds.includes(Number(bl.productId))) : true;
    });
  }

  if (!filtered.length) { toast('No hay pedidos que coincidan con los filtros', '#f59e0b'); return; }

  filtered.sort((a,b)=>ordDateTs(a)-ordDateTs(b));

  const b = S.biz || {};
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  function fmtD(d) {
    if (!d) return '—';
    if (String(d).includes('/')) {
      const parts = String(d).split(',')[0].split('/');
      if (parts.length===3) return `${parts[0].padStart(2,'0')}/${parts[1].padStart(2,'0')}/${parts[2].trim()}`;
      return String(d).split(',')[0];
    }
    return d;
  }

  let grandTotal = 0;
  const byMonth = {};
  // Resumen de productos: por mes y total general
  const prodByMonth = {}; // { monthKey: { prodName: qty } }
  const prodGrandTotal = {}; // { prodName: qty }
  const prodWeightTotal = {}; // { prodName: kg } — para ordenar el resumen general por peso
  filtered.forEach(o => {
    const ds = toYMD(o.date);
    const key = ds ? ds.slice(0,7) : 'sin-fecha';
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(o);
    const itemsForSummary = prodIds.length ? o.items.filter(it => prodIds.includes(Number(it.productId||it.pid))) : o.items;
    itemsForSummary.forEach(it => {
      const pid = Number(it.productId||it.pid);
      const p = S.products.find(x=>x.id===pid);
      const name = p ? p.name : '—';
      if (!prodByMonth[key]) prodByMonth[key] = {};
      prodByMonth[key][name] = (prodByMonth[key][name]||0) + Number(it.qty);
      prodGrandTotal[name] = (prodGrandTotal[name]||0) + Number(it.qty);
      { const _w = it.specWeightKg != null ? it.specWeightKg : (p && p.weightKg); if (_w) prodWeightTotal[name] = (prodWeightTotal[name]||0) + Number(it.qty)*Number(_w); }
    });
  });

  const groupsHtml = Object.keys(byMonth).sort().map(monthKey => {
    const [y, m] = monthKey.split('-');
    const mesLabel = m ? `${MESES[parseInt(m)-1]} ${y}` : 'Sin fecha';
    const monthOrders = byMonth[monthKey];
    let monthTotal = 0;

    const ordersHtml = monthOrders.map(o => {
      let ordTotal = 0;
      const itemsToShow = prodIds.length ? o.items.filter(it => prodIds.includes(Number(it.productId||it.pid))) : o.items;
      const itemsHtml = itemsToShow.map(it => {
        const pid = Number(it.productId||it.pid);
        const p = S.products.find(x=>x.id===pid);
        const us = itemUnitSizeFor(it, p);
        const pr = (it.customPrice!=null) ? it.customPrice : cliPrice(o.clientId, pid, p?.basePrice||0);
        const sub = pr * us * Number(it.qty);
        ordTotal += sub;
        return `<div style="display:flex;justify-content:space-between;padding:2px 0;font-size:13px"><span>${it.qty} ${p?p.name:'—'}</span><strong>${Q(sub)}</strong></div>`;
      }).join('');
      const bonusLinesToShowMfr = (bonusFiltered && prodIds.length)
        ? (o.bonusLines||[]).filter(bl => prodIds.includes(Number(bl.productId)))
        : (o.bonusLines||[]);
      const bonusHtml = (includeBonus && bonusLinesToShowMfr.length)
        ? `<div style="margin-top:6px;padding:6px 8px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:5px"><div style="font-size:11px;color:#1d4ed8;font-weight:700;margin-bottom:3px">🎁 Bonificación</div>${bonusLinesToShowMfr.map(bl=>{
            const p = S.products.find(x=>x.id===Number(bl.productId));
            return `<div style="font-size:12px;color:#1e3a8a">${bl.qty} ${p?p.name:'—'}</div>`;
          }).join('')}</div>`
        : '';
      monthTotal += ordTotal;
      return `<div style="margin-bottom:8px;padding:8px;background:#f8fafc;border-radius:6px;border-left:3px solid #94a3b8">
        <div style="display:flex;justify-content:space-between;font-size:13px;color:#374151;font-weight:700;margin-bottom:2px">
          <span>${fmtD(o.date)} · ${o.clientName}</span>
          <strong style="color:#1e293b">${Q(ordTotal)}</strong>
        </div>
        ${o.oc?`<div style="font-size:14px;font-weight:800;color:#1e3a8a;margin-bottom:4px">Orden: ${o.oc}</div>`:''}
        ${itemsHtml}
        ${bonusHtml}
      </div>`;
    }).join('');

    grandTotal += monthTotal;
    return `<div style="margin-bottom:16px">
      <div style="background:#1e3a8a;padding:6px 12px;border-radius:6px;margin-bottom:8px">
        <span style="font-size:13px;font-weight:800;color:#fff">${mesLabel}</span>
        <span style="font-size:11px;color:#93c5fd;margin-left:8px">Total: ${Q(monthTotal)}</span>
      </div>
      ${ordersHtml}
    </div>`;
  }).join('');

  // Resumen de productos por mes (agrupado todo junto, arriba del detalle de pedidos)
  const monthSummaryBlocks = Object.keys(byMonth).sort().map(monthKey => {
    const [y, m] = monthKey.split('-');
    const mesLabel = m ? `${MESES[parseInt(m)-1]} ${y}` : 'Sin fecha';
    const rows = Object.entries(prodByMonth[monthKey]||{}).sort((a,b)=>(prodWeightTotal[b[0]]||0)-(prodWeightTotal[a[0]]||0) || b[1]-a[1])
      .map(([name,qty])=>`<div style="display:flex;justify-content:space-between;padding:3px 8px;font-size:12px;border-bottom:1px solid #f0f0f0"><span>${name}</span><strong>${qty}</strong></div>`).join('');
    return `<div style="margin-bottom:8px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
      <div style="background:#eff6ff;color:#1e3a8a;padding:4px 8px;font-weight:700;font-size:12px">${mesLabel}</div>
      ${rows}
    </div>`;
  }).join('');

  const grandProdSummary = Object.entries(prodGrandTotal).sort((a,b)=>(prodWeightTotal[b[0]]||0)-(prodWeightTotal[a[0]]||0) || b[1]-a[1])
    .map(([name,qty])=>`<div style="display:flex;justify-content:space-between;padding:3px 8px;font-size:12px;border-bottom:1px solid #f0f0f0"><span>${name}</span><strong>${qty}</strong></div>`).join('');

  const titleClients = clientNames.length > 2 ? `${clientNames.length} clientes` : clientNames.join(', ');
  const titleProds = prodIds.length ? S.products.filter(p=>prodIds.includes(p.id)).map(p=>p.name).join(', ') : 'Todos los productos';

  const b2 = S.biz || {};
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reporte por clientes y productos</title>
  <style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;padding:16px;background:#fff;color:#1e293b;zoom:175%}@media print{body{padding:8px}}</style></head>
  <body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #1e3a8a">
      <div>
        <div style="font-size:20px;font-weight:900;color:#1e3a8a">${b2.name||'Empresa'}</div>
        ${b2.exec?`<div style="font-size:12px;color:#64748b">${b2.exec}</div>`:''}
        ${b2.phone?`<div style="font-size:12px;color:#64748b">📞 ${b2.phone}</div>`:''}
      </div>
      <div style="text-align:right"><div style="font-size:11px;color:#64748b">Generado: ${fmtOrdDate((()=>{ const n=new Date(); return `${String(n.getDate()).padStart(2,'0')}/${String(n.getMonth()+1).padStart(2,'0')}/${n.getFullYear()}`; })())}</div></div>
    </div>
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 14px;margin-bottom:16px">
      <div style="font-size:16px;font-weight:800;color:#1e3a8a">📄 Reporte por Clientes y Productos</div>
      <div style="font-size:12px;color:#64748b;margin-top:4px">Clientes: ${titleClients}</div>
      <div style="font-size:12px;color:#64748b">Productos: ${titleProds}</div>
      <div style="font-size:11px;color:#64748b;margin-top:2px">Período: ${fFrom||'inicio'} → ${fTo||'hoy'}</div>
    </div>
    <div style="margin-bottom:16px;border:1px solid #1e3a8a;border-radius:8px;overflow:hidden">
      <div style="background:#1e3a8a;color:#fff;padding:7px 12px;font-weight:800;font-size:14px">📦 Resumen de Productos por Mes</div>
      <div style="padding:8px">${monthSummaryBlocks}</div>
      ${grandProdSummary?`<div style="border-top:2px solid #1e3a8a">
        <div style="background:#eff6ff;color:#1e3a8a;padding:5px 8px;font-weight:700;font-size:12px">TOTAL GENERAL</div>
        ${grandProdSummary}
      </div>`:''}
    </div>
    ${groupsHtml}
    <div style="background:#1e3a8a;padding:10px 14px;border-radius:8px;display:flex;justify-content:space-between;margin-top:8px">
      <span style="font-size:14px;font-weight:800;color:#fff">TOTAL GENERAL:</span>
      <span style="font-size:14px;font-weight:800;color:#fde68a">${Q(grandTotal)}</span>
    </div>
    <script>window.onload=function(){window.print()}<\/script>
  </body></html>`;

  const blob = new Blob([html], {type:'text/html'});
  window.open(URL.createObjectURL(blob), '_blank');
}

function toggleOrderFilters() {
  const p = document.getElementById('order-filters-panel');
  const ov = document.getElementById('order-filters-overlay');
  if (!p || !ov) return;
  const isOpen = ov.style.display !== 'none';
  ov.style.display = isOpen ? 'none' : 'flex';
  p.style.display = isOpen ? 'none' : 'block';
}

function closeOrderFiltersOutside(e) {
  const p = document.getElementById('order-filters-panel');
  const btn = document.querySelector('[onclick="toggleOrderFilters()"]');
  const drp = document.getElementById('date-range-picker');
  const cliDrop = document.getElementById('f-cli-drop');
  if (!p) return;
  // No cerrar si el clic fue dentro del panel, el botón, el calendario o el dropdown
  if (p.contains(e.target) || (btn && btn.contains(e.target)) ||
      (drp && drp.contains(e.target)) || (cliDrop && cliDrop.contains(e.target))) return;
  p.style.display = 'none';
  if (drp) drp.style.display = 'none';
  if (cliDrop) cliDrop.style.display = 'none';
  document.removeEventListener('click', closeOrderFiltersOutside);
}

function toggleOrderSort() {
  _orderAsc = !_orderAsc;
  const btn = document.getElementById('btn-ord-sort');
  if (btn) btn.textContent = _orderAsc ? '🕐 Antiguos' : '🕐 Recientes';
  renderList();
}

function setOrderTab(tab) {
  _orderTab = tab;
  ['all','Cotización','Confirmado','Concluido'].forEach(t => {
    const btn = document.getElementById('tab-'+(t==='all'?'all':t));
    if (!btn) return;
    btn.style.outline = t === tab ? '2px solid #f59e0b' : 'none';
  });
  renderList();
}

function renderList() {

const _prospectIds2 = new Set(S.clients.filter(c=>c.isProspect).map(c=>c.id));
const ords = S.orders.filter(o=>!_prospectIds2.has(Number(o.clientId)) && !o.cancelled);
// Poblar clientes ya no es necesario con autocompletado
['Cotización','Confirmado','Concluido'].forEach(st => {
  const el = document.getElementById('cnt-'+st);
  if (el) el.textContent = '('+ords.filter(o=>o.status===st&&!o.routeId).length+')';
});
// El resto del filtrado (tab, cliente, fecha, producto) vive en una sola
// función compartida con los reportes, para no tener que mantener la
// misma lógica en dos lugares (y que un filtro nuevo no se quede sin
// aplicar en uno de los dos).
let filtered = getReportFiltered();
document.getElementById('lt').textContent = `Pedidos (${filtered.length})`;
const body = document.getElementById('lst-body');
if (!filtered.length) { body.innerHTML='<div style="text-align:center;color:#64748b;padding:40px">Sin pedidos sin ruta.</div>'; return; }
body.innerHTML = '';
filtered.forEach(o => {
const tot   = orderTotal(o.items, o.clientId);
const sapCalc = o.sapMode ? getSapCalcForOrder(o) : null;
const lines = sapCalc ? sapCalc.items.map(r => {
const nombre = `${r.name}${r.specLabel?` (${r.specLabel})`:''}`;
return `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:4px;font-size:12px;padding:3px 0;border-bottom:1px solid #1e2640">
  <span style="color:#f1f5f9;font-weight:600;flex:1;min-width:0">${r.qty} ${nombre} × ${Q(r.sapPriceNoIva)}/${r.sapUnitLabel} <span style="font-size:9px;color:#facc15">+IVA</span></span>
  <span style="color:#f1f5f9;font-weight:700;flex-shrink:0">${Q(r.sapLineTotalWithIva)}</span>
</div>`;
}).join('') : o.items.map(it => {
const p      = S.products.find(x => x.id===it.productId);
const pr     = (it.customPrice != null) ? it.customPrice : cliPrice(o.clientId, it.productId, p?.basePrice||0);
const us     = itemUnitSizeFor(it, p);
const ul     = p?.unitLabel||'unidad';
const sub    = pr * it.qty * us;
const lineDisplay = o.applyIva ? Q(sub*1.12) : Q(sub);
const ivaLabel = o.applyIva ? ` <span style="font-size:9px;color:#facc15">+IVA</span>` : '';
const spec = itemSpecLabel(it,p) ? ` (${itemSpecLabel(it,p)})` : '';
const nombre = `${p?p.name:'Eliminado'}${spec}`;
return `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:4px;font-size:12px;padding:3px 0;border-bottom:1px solid #1e2640">
  <span style="color:#f1f5f9;font-weight:600;flex:1;min-width:0">${it.qty} ${nombre} × ${Q(pr)}/${ul}${ivaLabel}</span>
  <span style="color:#f1f5f9;font-weight:700;flex-shrink:0">${lineDisplay}</span>
</div>`;
}).join('');
const sCls = o.status==='Concluido'?'bp-fact':o.status==='Cotización'?'bp-quot':'bp-pend';
const _blocked = isOrderBlocked(o);
const swipeColor = _blocked?'#a855f7':o.status==='Concluido'?'#4ade80':o.status==='Confirmado'?'#60a5fa':'#f1f5f9';
const card = document.createElement('div');
card.className = 'card';
card.dataset.id = o.id;
card.dataset.oid = o.id;
card.style.borderLeftWidth = '3px';
card.style.borderLeftStyle = 'solid';
card.style.borderLeftColor = swipeColor;
card.innerHTML = `
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
<div style="display:flex;align-items:flex-start;gap:8px">
<input type="checkbox" class="ord-report-chk" data-oid="${o.id}"
  style="width:16px;height:16px;margin-top:3px;cursor:pointer;accent-color:#10b981;flex-shrink:0"
  ${(window._ordSel||new Set()).has(o.id)?'checked':''}
  onclick="event.stopPropagation();toggleOrdSel(${o.id},this.checked)"/>
<div>
<div style="font-weight:800;font-size:15px;color:${clientNameColor(o)};cursor:pointer;text-decoration:underline" onclick="event.stopPropagation();openClientCard(${o.clientId})">${o.clientName}</div>
<div style="font-size:10px;color:#64748b">${fmtOrdDate(o.date)}${o.editedAt?' · Editado: '+fmtOrdDate(o.editedAt):''}</div>
${_blocked?`<div style="font-size:11px;color:#a855f7;font-weight:700;margin-top:1px">🔒 Bloqueado (fecha futura)</div>`:''}
${o.quote?`<div style="font-size:11px;color:#94a3b8;margin-top:1px">Cot: <strong style="color:#2dd4bf">${o.quote}</strong></div>`:''}
${o.oc?`<div style="font-size:11px;color:#94a3b8;margin-top:1px">OC: <strong style="color:#818cf8">${o.oc}</strong></div>`:''}
${o.delivery?`<div style="font-size:11px;color:#3b82f6;margin-top:1px">📍 Entrega: ${o.delivery}</div>`:''}
${o.quoteNote?`<div style="font-size:11px;color:#38bdf8;font-weight:700;margin-top:1px">📅 Fecha de entrega: ${fmtEntrega(o.quoteNote)}</div>`:''}
</div>
</div>
</div>
<div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px">
</div>
</div>
${lines}
${(()=>{
const cmts = o.comments && o.comments.length ? o.comments : (o.note ? [o.note] : []);
return cmts.map(c=>`<div style="font-size:11px;color:#f97316;margin-top:4px">💬 ${c}</div>`).join('');
})()}
<div style="margin-top:8px">
${(()=>{
if(sapCalc) return '<div style=\"font-size:11px;color:#64748b;margin-bottom:2px\">Sin IVA: '+Q(sapCalc.subtotalSinIva)+' &nbsp;+&nbsp; IVA 12%: '+Q(sapCalc.ivaMonto)+'</div>';
if(o.pricesIncIva) return '<div style=\"font-size:11px;color:#64748b;margin-bottom:2px\">Sin IVA: '+Q(tot/1.12)+' &nbsp;+&nbsp; IVA 12%: '+Q(tot-tot/1.12)+'</div>';
if(o.applyIva)    return '<div style=\"font-size:11px;color:#64748b;margin-bottom:2px\">Subtotal: '+Q(tot)+' &nbsp;+&nbsp; IVA 12%: '+Q(tot*0.12)+'</div>';
return '';
})()}
<div style="font-weight:800;font-size:15px;color:#f1f5f9;display:flex;align-items:center;gap:6px;flex-wrap:wrap">TOTAL ${Q(sapCalc ? sapCalc.totalConIva : (o.pricesIncIva ? tot : o.applyIva ? tot*1.12 : tot))}
${(sapCalc||o.pricesIncIva||o.applyIva) ? '<span style=\"font-size:10px;font-weight:600;color:#facc15;background:#1e3a5f;padding:1px 6px;border-radius:4px\">IVA incl.</span>' : ''}
${sapCalc ? '<span style=\"font-size:10px;font-weight:700;color:#fff;background:#7c3aed;padding:1px 7px;border-radius:4px\">🧮 SAP</span>' : ''}
<span class="${sCls}" style="margin-left:auto">${o.status}</span></div>
</div>
${(()=>{
if (!o.bonusLines||!o.bonusLines.length) return '';
const bLines = sapCalc ? sapCalc.bonusLines.map(r=>{
  const spec = r.specLabel?` (${r.specLabel})`:'';
  return `<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0;border-bottom:1px solid #1e2640"><span style="color:#f1f5f9;font-weight:600">${r.qty} ${r.name}${spec} × ${Q(r.sapPriceNoIva)}/${r.sapUnitLabel} <span style="font-size:9px;color:#facc15">+IVA</span></span></div>`;
}).join('') : o.bonusLines.map(bl=>{
  const p = S.products.find(x=>x.id===Number(bl.productId));
  const spec = p?.presentation?` (${p.presentation})`:'';
  const ul = p?.unitLabel||'unidad';
  const ivaLbl = o.applyIva ? ` <span style="font-size:9px;color:#facc15">+IVA</span>` : '';
  return `<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0;border-bottom:1px solid #1e2640"><span style="color:#f1f5f9;font-weight:600">${bl.qty} ${p?p.name:'—'}${spec} × ${Q(bl.price||0)}/${ul}${ivaLbl}</span></div>`;
}).join('');
const allVerified = o.bonusLines.every(bl => bl.fromRuleId != null);
const allExceptional = o.bonusLines.every(bl => bl.exceptional);
const bonusBadge = allVerified
  ? '<span style="font-size:9px;background:#052e16;color:#10b981;padding:1px 6px;border-radius:6px;font-weight:700;margin-left:6px">✅ Meta 100%</span>'
  : allExceptional
    ? '<span style="font-size:9px;background:#2a1f00;color:#f59e0b;padding:1px 6px;border-radius:6px;font-weight:700;margin-left:6px">🎗️ Excepcional</span>'
    : '<span style="font-size:9px;background:#2d0f0f;color:#ef4444;padding:1px 6px;border-radius:6px;font-weight:700;margin-left:6px">⚠️ Sin verificar</span>';
return `<div style="margin-top:6px"><div style="font-size:11px;color:#10b981;font-weight:700;margin-bottom:3px">🎁 BONIFICACIÓN${bonusBadge}</div><div style="background:#0d0f18;border-radius:5px;padding:4px 6px">${bLines}</div></div>`;
})()}
<div class="two">
<div style="display:flex;align-items:center;gap:10px;flex:1;background:#161929;border-radius:9px;padding:8px 12px;border:1px solid #2a3050">
  ${(()=>{
    const isConf = o.status==='Confirmado'||o.status==='Concluido';
    const isConc = o.status==='Concluido';
    return `
    <label style="display:flex;align-items:center;gap:6px;cursor:pointer" title="Confirmado">
      <div style="position:relative;width:36px;height:20px">
        <input type="checkbox" ${isConf?'checked':''} onchange="setOrderStatus(${o.id},this.checked,'switch')" style="opacity:0;width:0;height:0;position:absolute"/>
        <span onclick="this.previousElementSibling.click()" style="position:absolute;inset:0;border-radius:10px;background:${isConf?'#3b82f6':'#2a3050'};transition:background .2s;cursor:pointer"></span>
        <span onclick="this.previousElementSibling.previousElementSibling.click()" style="position:absolute;top:3px;left:${isConf?'19px':'3px'};width:14px;height:14px;background:#fff;border-radius:50%;transition:left .2s;pointer-events:none"></span>
      </div>
      <span style="font-size:11px;color:${isConf?'#60a5fa':'#64748b'};font-weight:700">${isConf?'Confirmado':'Cotización'}</span>
    </label>
    <div style="width:1px;height:20px;background:#2a3050"></div>
    <label style="display:flex;align-items:center;gap:6px;cursor:pointer" title="Concluido">
      <div onclick="setOrderStatus(${o.id},null,'check')" style="width:22px;height:22px;border-radius:50%;border:2px solid ${isConc?'#10b981':'#475569'};background:${isConc?'#10b981':'transparent'};display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .2s">
        ${isConc?'<span style="color:#fff;font-size:12px;font-weight:900">✓</span>':''}
      </div>
      <span style="font-size:11px;color:${isConc?'#10b981':'#64748b'};font-weight:700">${isConc?'Concluido':''}</span>
    </label>`;
  })()}
</div>
<select class="sel" style="margin:0;flex:1;font-size:12px" onchange="assignOrderToRoute(${o.id},this)">
<option value="">🗺️ ${o.routeId ? '✔ '+(S.routes.find(r=>r.id===o.routeId)||{name:'Ruta'}).name : 'Asignar a ruta...'}</option>
${S.routes.slice().reverse().map(r=>`<option value="${r.id}" ${o.routeId===r.id?'selected':''}>${r.name}</option>`).join('')}
${o.routeId ? '<option value="__remove__">✕ Quitar de ruta</option>' : ''}
</select>
</div>
<div style="display:flex;gap:6px;margin-top:6px">
<button class="bv" style="flex:1" onclick="duplicateOrder(${o.id})" title="Duplicar pedido">📋 Duplicar</button>
<button class="bb" style="flex:1" onclick="showQuoteFromOrder(${o.id})">📄 Cotizar</button>
<button class="bs" style="flex:1" onclick="startEditOrder(${o.id})">✏️ Editar</button>
${o.status==='Cotización'?`<button class="bs" style="flex:1;color:#f59e0b;border-color:#f59e0b" onclick="cancelOrder(${o.id})">🚫 Cancelar</button>`:''}
<button class="br" style="flex:0" onclick="delOrder(${o.id})">🗑</button>
</div>`;
body.appendChild(card);
});
setTimeout(() => {
  document.querySelectorAll('#lst-body [data-oid]').forEach(el => {
    if (!el.dataset.swipeInit) {
      el.dataset.swipeInit = '1';
      initListSwipe(el, Number(el.dataset.oid));
    }
  });
}, 100);
}


function assignOrderToRoute(oid, sel) {
  const val = sel.value;
  const o = S.orders.find(x=>x.id===oid); if (!o) return;
  // Quitar de ruta anterior
  if (o.routeId) {
    const prev = S.routes.find(r=>r.id===o.routeId);
    if (prev) prev.orders = (prev.orders||[]).filter(id=>id!==oid);
  }
  if (val === '__remove__' || !val) {
    delete o.routeId;
    save(); renderList(); toast('Pedido quitado de la ruta');
  } else {
    const rid = Number(val);
    const r = S.routes.find(x=>x.id===rid); if (!r) return;
    if (!r.orders) r.orders = [];
    if (!r.orders.includes(oid)) r.orders.push(oid);
    o.routeId = rid;
    save(); renderList(); toast('✔ Pedido asignado a: '+r.name);
  }
}
function setOrderStatus(id, checked, type) {
  const o = S.orders.find(x=>x.id===id); if (!o) return;
  if (type==='switch') {
    if (o.status==='Concluido') return;
    const newSt = (o.status==='Confirmado') ? 'Cotización' : 'Confirmado';
    if (newSt === 'Confirmado') {
      const check = canAdvanceOrderStatus(o, newSt);
      if (!check.ok) { handleConfirmBlocked(o, check.reason); renderList(); return; }
    }
    o.status = newSt;
    if (o.status==='Confirmado') {
      // Si el cliente de este pedido es un prospecto, se convierte en cliente automáticamente
      const clientOfOrder = S.clients.find(c=>c.id===Number(o.clientId));
      if (clientOfOrder && clientOfOrder.isProspect) {
        delete clientOfOrder.isProspect;
        toast('✅ "' + clientOfOrder.name + '" se convirtió en cliente automáticamente', '#10b981');
      }
      save();
      const triggered = checkBonusAlert(o.clientId, o.id, ()=>{ renderList(); renderRoutes(); renderQuotesList(); renderProspects(); }, o);
      if (!triggered) { renderList(); renderRoutes(); renderQuotesList(); renderProspects(); }
      return;
    }
  } else if (type==='check') {
    const newSt = (o.status==='Concluido') ? 'Confirmado' : 'Concluido';
    if (newSt === 'Concluido' && !o.delivery) {
      toast('📍 El pedido no tiene dirección de entrega. Edítalo primero.', '#ef4444'); return;
    }
    o.status = newSt;
  }
  save(); renderList(); renderRoutes();
}

function togStatus(id) {
const o = S.orders.find(x=>x.id===id); if (!o) return;
const cycle = {'Cotización':'Confirmado','Confirmado':'Concluido','Concluido':'Cotización'};
const newStatus = cycle[o.status] || 'Cotización';
const _check = canAdvanceOrderStatus(o, newStatus);
if (!_check.ok) { handleConfirmBlocked(o, _check.reason); return; }
// Si va a Confirmado, verificar bonificaciones primero
if (newStatus === 'Confirmado') {
  o.status = 'Confirmado';
  const clientOfOrder2 = S.clients.find(c=>c.id===Number(o.clientId));
  if (clientOfOrder2 && clientOfOrder2.isProspect) {
    delete clientOfOrder2.isProspect;
    toast('✅ "' + clientOfOrder2.name + '" se convirtió en cliente automáticamente', '#10b981');
  }
  save();
  const triggered = checkBonusAlert(o.clientId, o.id, () => {
    renderList(); renderRoutes(); renderQuotesList(); renderProspects();
  }, o);
  if (!triggered) {
    renderList(); renderRoutes(); renderQuotesList(); renderProspects();
  }
  return;
}
o.status = newStatus;
save();
const card = document.querySelector(`[data-id="${id}"]`);
if (card) {
  const btn = card.querySelector('[onclick^="togStatus"]');
  if (btn) btn.textContent = newStatus==='Cotización'?'📄 Cotización':newStatus==='Confirmado'?'✅ Confirmado':'✔ Concluido';
}
['Cotización','Confirmado','Concluido'].forEach(st => {
  const el = document.getElementById('cnt-'+st);
  if (el) el.textContent = '('+S.orders.filter(x=>x.status===st&&!x.routeId).length+')';
});
}



function cancelOrder(id) {
  const o = S.orders.find(x => x.id===id);
  if (!o) return;
  if (o.status !== 'Cotización') { toast('⚠️ Solo se pueden cancelar pedidos en estado Cotización', '#ef4444'); return; }
  askConfirm('¿Cancelar este pedido?', `Dejará de aparecer en Pedidos, pero se conservará en la ficha de ${o.clientName} y podrás reactivarlo cuando quieras.`, () => {
    o.cancelled = true;
    save();
    renderList();
    toast('🚫 Pedido cancelado');
  }, 'Cancelar pedido', '#ef4444', '🚫');
}


function reactivateOrder(id) {
  const o = S.orders.find(x => x.id===id);
  if (!o) return;
  askConfirm('¿Reactivar este pedido?', 'Volverá a aparecer en Pedidos como Cotización.', () => {
    delete o.cancelled;
    o.status = 'Cotización';
    save();
    renderList();
    renderClients();
    toast('✅ Pedido reactivado', '#10b981');
  }, 'Reactivar', '#10b981', '✅');
}


function delOrder(id) {
  const o = S.orders.find(x => x.id===id);
  const name = o ? o.clientName : '—';
  const prods = o ? o.items.map(it => {
    const p = S.products.find(x=>x.id===(it.productId||Number(it.pid)));
    return (p?p.name:'—') + ' ×' + it.qty;
  }).join(', ') : '';
  const tot = o ? Q(o.applyIva ? orderTotal(o.items,o.clientId)*1.12 : orderTotal(o.items,o.clientId)) : '';
  const inner = document.querySelector('#confirm-modal > div');
  if (!inner) return;
  inner.innerHTML = `
    <div style="font-size:28px;margin-bottom:8px">📦</div>
    <div style="font-size:15px;font-weight:700;color:#f1f5f9;margin-bottom:4px">¿Eliminar este pedido?</div>
    <div style="font-size:13px;font-weight:700;color:#f59e0b;margin-bottom:2px">${name}</div>
    <div style="font-size:11px;color:#94a3b8;margin-bottom:2px">${prods}</div>
    <div style="font-size:12px;color:#4ade80;margin-bottom:14px">${tot}</div>
    <div style="font-size:12px;color:#94a3b8;margin-bottom:14px">Esta acción no se puede deshacer.</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <button onclick="confirmDel(false)" style="padding:10px;border-radius:9px;border:1px solid #475569;background:transparent;color:#f1f5f9;font-weight:700;cursor:pointer;font-size:13px">Cancelar</button>
      <button onclick="confirmDel(true)" style="padding:10px;border-radius:9px;border:none;background:#ef4444;color:#fff;font-weight:800;cursor:pointer;font-size:13px">🗑 Eliminar pedido</button>
    </div>`;
  document.getElementById('confirm-modal').style.display = 'flex';
  _confirmCb = () => {
    S.orders = S.orders.filter(o => o.id!==id); save(); renderList();
    toast('🗑 Pedido eliminado');
  };
}


// ═══════════════════════════════════════════════════════
//  COTIZACIÓN
// ═══════════════════════════════════════════════════════
let currentQuote = null;

function showQuoteFromOrder(id) {
const o = S.orders.find(x=>x.id===id); if (!o) return;
if (!o.quote || !o.quote.trim()) { toast('Debe llenar el campo de cotización primero', '#ef4444'); return; }
showQuote(o);
}

function buildQuoteHTML(ord) {
const b    = S.biz;
const cli  = S.clients.find(c => c.id===ord.clientId);
const tot  = orderTotal(ord.items, ord.clientId);
const sapCalc = ord.sapMode ? getSapCalcForOrder(ord) : null;
const qNum = ord.quote || 'COT-'+String(ord.id||Date.now()).toString().slice(-6).padStart(6,'0');
const logoHtml = b.logoData
? `<img src="${b.logoData}" style="width:240px;height:120px;border-radius:10px;object-fit:contain"/>`
: `<div style="width:240px;height:120px;background:#f59e0b;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:42px">${b.emoji||'📦'}</div>`;
const bizLines = [
b.sub   ? `<p style="font-size:12px;color:#6b7280;margin:1px 0">${b.sub}</p>` : '',
b.addr  ? `<p style="font-size:12px;color:#6b7280;margin:1px 0">📍 ${b.addr}</p>` : '',
b.exec  ? `<p style="font-size:12px;color:#374151;margin:1px 0">Ejecutivo de ventas: ${b.exec}</p>` : '',
b.phone ? `<p style="font-size:12px;color:#6b7280;margin:1px 0">Teléfono: ${b.phone}</p>` : '',
b.email ? `<p style="font-size:12px;color:#6b7280;margin:1px 0">Correo electrónico: ${b.email}</p>` : '',
].filter(Boolean).join('');
const cliInfo = [
cli?.phone   ? '📞 '+cli.phone   : '',
cli?.address ? '📍 '+cli.address : '',
].filter(Boolean).join(' · ');
const rows = sapCalc ? sapCalc.items.map(r => `<tr>
<td style="padding:7px 6px">${r.name}${r.specLabel?` <span style="color:#374151">(${r.specLabel})</span>`:''}</td>
<td style="padding:7px 6px;text-align:center">${r.qty}</td>
<td style="padding:7px 6px;text-align:right">${Q(r.sapPriceNoIva)}/${r.sapUnitLabel}<div style="font-size:9px;color:#2563eb;font-weight:600;margin-top:2px">+IVA</div></td>
<td style="padding:7px 6px;text-align:right;font-weight:700">${Q(r.sapLineTotalWithIva)}</td>
</tr>`).join('') : ord.items.map(it => {
const p     = S.products.find(x => x.id===(it.productId||Number(it.pid)));
const pr    = (it.customPrice != null) ? it.customPrice : cliPrice(ord.clientId, it.productId||it.pid, p?.basePrice||0);
const us    = itemUnitSizeFor(it, p);
const ul    = p?.unitLabel||'unidad';
const units = Number(it.qty)*us;
const sub   = pr*units;
const ivaBadge = ord.applyIva
? `<div style="font-size:9px;color:#2563eb;font-weight:600;margin-top:2px">+IVA 12%</div>` : '';
return `<tr>
<td style="padding:7px 6px">${p?p.name:'—'}${p?.presentation?` <span style="color:#374151">(${p.presentation})</span>`:''}</td>
<td style="padding:7px 6px;text-align:center">${it.qty}</td>
<td style="padding:7px 6px;text-align:right">${Q(pr)}/${ul}${ivaBadge}</td>
<td style="padding:7px 6px;text-align:right;font-weight:700">${ord.applyIva?Q(sub*1.12):Q(sub)}</td>
</tr>`;
}).join('');

// Líneas de bonificación
const bonusRows = sapCalc ? sapCalc.bonusLines.map(r => `<tr style="background:#f0fdf4">
<td style="padding:7px 6px;color:#15803d">
  <div style="font-size:10px;color:#15803d">${r.name}${r.specLabel?' ('+r.specLabel+')':''}</div>
  ${r.ruleName&&r.ruleName!=='Manual'?`<div style="font-size:10px;color:#6b7280">${r.ruleName}</div>`:''}
</td>
<td style="padding:7px 6px;text-align:center;color:#15803d">${r.qty}</td>
<td style="padding:7px 6px;text-align:right;color:#15803d">${Q(r.sapPriceNoIva)}/${r.sapUnitLabel} <span style="font-size:9px">+IVA</span></td>
<td style="padding:7px 6px;text-align:right;font-weight:700;color:#15803d">${Q(r.sapLineTotalWithIva)}</td>
</tr>`).join('') : (ord.bonusLines||[]).map(bl => {
const p  = S.products.find(x=>x.id===Number(bl.productId));
const pr = bl.price||0;
const ul = p?.unitLabel||'unidad';
const us = itemUnitSizeFor(bl, p);
const sub = pr * bl.qty * us;
const _ivaTagB2 = ord.applyIva ? ' <span style="font-size:9px">+IVA</span>' : '';
return `<tr style="background:#f0fdf4">
<td style="padding:7px 6px;color:#15803d">
  <div style="font-size:10px;color:#15803d">${p?p.name:'—'}${p?.presentation?' ('+p.presentation+')':''}</div>
  ${bl.ruleName&&bl.ruleName!=='Manual'?`<div style="font-size:10px;color:#6b7280">${bl.ruleName}</div>`:''}
</td>
<td style="padding:7px 6px;text-align:center;color:#15803d">${bl.qty}</td>
<td style="padding:7px 6px;text-align:right;color:#15803d">${Q(pr)}/${ul}${_ivaTagB2}</td>
<td style="padding:7px 6px;text-align:right;font-weight:700;color:#15803d">${Q(sub)}</td>
</tr>`;
}).join('');
// Comentarios — van ARRIBA de la tabla
const cmtsQuote = (()=>{
const cmts = ord.comments && ord.comments.length ? ord.comments : (ord.note ? [ord.note] : []);
return cmts.filter(Boolean).map(c=>`<div class="qt-note" style="background:#fffbeb;border-left:3px solid #f59e0b;padding:4px 8px;margin-bottom:3px;border-radius:3px">${c.split('\n').join('<br>')}</div>`).join('');
})();
const bonusSepQ = bonusRows ? `<tr style="background:#f0fdf4"><td colspan="4" style="padding:2px 8px;font-size:10px;color:#15803d;border-top:2px dashed #86efac;font-weight:700">─── BONIFICACIONES ───</td></tr>` : '';
return `<div class="qt">
<div class="qt-head">
<div class="qt-logo">${logoHtml}</div>
<div class="qt-biz"><h2>${b.name||'Mi Negocio'}</h2>${bizLines}</div>
</div>
<div style="font-size:16px;font-weight:800;margin-top:16px;margin-bottom:1px;color:#111">COTIZACIÓN</div>
<div style="font-size:16px;font-weight:900;margin-bottom:4px;color:#111">N° ${qNum}</div>
<div style="font-size:12px;color:#6b7280;margin-bottom:2px">Fecha: ${(ord.date||'').split(',')[0]}</div>
<div style="font-size:13px;margin-top:2px">Cliente: <strong>${ord.clientName}</strong></div>
${ord.contact?`<div style="font-size:13px;margin-top:2px">Contacto: <strong>${ord.contact}</strong></div>`:''}
${ord.quoteNote?`<div style="font-size:12px;color:#374151;margin-top:4px;padding:5px 8px;background:#f9fafb;border-left:3px solid #f59e0b;border-radius:3px"><strong>Fecha de entrega:</strong> ${fmtEntrega(ord.quoteNote)}</div>`:''}
${ord.delivery?`<div style="font-size:12px;color:#0369a1;margin-top:4px;padding:5px 8px;background:#f0f9ff;border-left:3px solid #bae6fd;border-radius:3px">Entrega: ${ord.delivery.split('\n').join('<br>')}</div>`:''}
${cliInfo?`<div class="qt-cli"><strong>${ord.clientName}</strong><span style="color:#6b7280;margin-left:6px">${cliInfo}</span></div>`:''}
${cmtsQuote}
<table class="qt-tbl">
<thead><tr>
<th>Producto</th>
<th style="text-align:center">Cant.</th>
<th style="text-align:right">P/Unidad</th>
<th style="text-align:right">Subtotal</th>
</tr></thead>
<tbody>${rows}${bonusSepQ}${bonusRows}</tbody>
</table>
<div class="qt-total">TOTAL: <span style="color:#b45309">${Q(sapCalc ? sapCalc.totalConIva : (ord.pricesIncIva ? tot : ord.applyIva ? tot*1.12 : tot))}</span></div>
${(()=>{
if(sapCalc) return '<div style=\"font-size:11px;color:#6b7280;text-align:right;margin-top:4px;padding-top:4px\">Subtotal (SAP, sin IVA): '+Q(sapCalc.subtotalSinIva)+' &nbsp;+&nbsp; IVA 12%: '+Q(sapCalc.ivaMonto)+'</div>';
if(ord.pricesIncIva) return '<div style=\"font-size:11px;color:#6b7280;text-align:right;margin-top:4px;padding-top:4px\">Precio incluye IVA &nbsp;·&nbsp; Base: '+Q(tot/1.12)+' &nbsp;+&nbsp; IVA 12%: '+Q(tot-tot/1.12)+'</div>';
if(ord.applyIva)    return '<div style=\"font-size:11px;color:#6b7280;text-align:right;margin-top:4px;padding-top:4px\">Subtotal: '+Q(tot)+' &nbsp;+&nbsp; IVA 12%: '+Q(tot*0.12)+'</div>';
return '';
})()}
${(ord.conditions&&ord.conditions.length)?`<div class="qt-note"><div style="font-weight:700;margin-bottom:3px">Términos y condiciones de la oferta</div>${ord.conditions.map(c=>c.split('\n').map(l=>`<div>${l}</div>`).join('')).join('')}</div>`:''}
${b.footer?`<div class="qt-note" style="margin-top:6px"><div style="font-weight:700;margin-bottom:3px">Datos bancarios</div>${b.footer.split('\n').map(l=>`<div>${l}</div>`).join('')}</div>`:''}
</div>`;
}

let _prevDocTitle = '';
function showQuote(ord) {
currentQuote = ord;
document.getElementById('quote-preview').innerHTML = buildQuoteHTML(ord);
document.getElementById('quote-modal').classList.add('show');
_prevDocTitle = document.title;
document.title = buildCotFilename(ord);
}

function closeQuote() {
document.getElementById('quote-modal').classList.remove('show');
if (_prevDocTitle) document.title = _prevDocTitle;
}

function printQuote() {
if (!currentQuote) return;
const qHTML = buildQuoteHTML(currentQuote);
// CSS inline para la ventana de impresión
const css = `
*{box-sizing:border-box;margin:0;padding:0}
body{background:#fff;color:#111;font-family:'Segoe UI',Arial,sans-serif;padding:16px}
.qt{max-width:600px;margin:0 auto}
.qt-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #e5e7eb}
.qt-logo{width:240px;height:120px;border-radius:10px;overflow:hidden;background:#f59e0b;display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0}
.qt-logo img{width:100%;height:100%;object-fit:contain}
.qt-biz{text-align:right;flex:1;padding-left:10px}
.qt-biz h2{font-size:16px;font-weight:800}.qt-biz p{font-size:11px;color:#6b7280;line-height:1.6}
.qt-title{font-size:16px;font-weight:800;margin-bottom:4px}
.qt-meta{font-size:11px;color:#6b7280;margin-bottom:14px}
.qt-cli{background:#f9fafb;border-radius:8px;padding:10px 12px;margin-bottom:14px;font-size:12px;color:#374151}
.qt-cli strong{display:block;font-size:13px;font-weight:700;margin-bottom:2px;color:#111}
table.qt-tbl{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px}
table.qt-tbl th{background:#f3f4f6;padding:8px 6px;text-align:left;font-weight:700;border-bottom:2px solid #e5e7eb;color:#374151}
table.qt-tbl td{padding:7px 6px;border-bottom:1px solid #f3f4f6;color:#374151}
.qt-total{text-align:right;font-size:16px;font-weight:800;padding:10px 0;border-top:2px solid #111}
.qt-note{font-size:11px;color:#6b7280;margin-top:10px;padding-top:10px;border-top:1px solid #e5e7eb}
.qt-footer{text-align:center;font-size:10px;color:#9ca3af;margin-top:14px;padding-top:10px;border-top:1px solid #f3f4f6}
@media print{body{padding:8px}}`;

// Método 1: iframe oculto (funciona en la mayoría de celulares)
try {
let iframe = document.getElementById('print-iframe');
if (!iframe) {
iframe = document.createElement('iframe');
iframe.id = 'print-iframe';
iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:800px;height:600px;border:none;';
document.body.appendChild(iframe);
}
const doc = iframe.contentDocument || iframe.contentWindow.document;
doc.open();
doc.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${document.title}</title><style>${css}</style></head><body>${qHTML}
</body></html>`);
doc.close();
setTimeout(() => {
try {
iframe.contentWindow.focus();
iframe.contentWindow.print();
} catch(e2) { fallbackDownload(qHTML, css); }
}, 400);
} catch(e) { fallbackDownload(qHTML, css); }
}

function buildCotFilename(ord) {
  const cli = (ord.clientName||'cliente').toUpperCase().trim();
  const qNum = (ord.quote||'').trim();
  return qNum ? `${qNum} ${cli}` : `Cot ${cli}`;
}

function fallbackDownload(html, css) {
  const fname = buildCotFilename(currentQuote);
  const full = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${fname}</title><style>${css}</style></head><body>${html}
</body></html>`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([full], {type:'text/html'}));
  a.download = fname + '.html'; a.click();
  toast('📥 Descargada — ábrela y usa Imprimir para PDF', '#60a5fa');
}

function shareOrderEmail() {
if (!currentQuote) return;
const ord = currentQuote;
const sapCalc = ord.sapMode ? getSapCalcForOrder(ord) : null;

// Productos con 》y precio
const prodLines = sapCalc ? sapCalc.items.map(r => {
  const spec = r.specLabel ? ` (${r.specLabel})` : '';
  return `》${r.qty} ${r.name}${spec}\nPrecio: ${Q(r.sapPriceNoIva)}/${r.sapUnitLabel} + IVA`;
}).join('\n') : ord.items.map(it => {
  const p  = S.products.find(x => x.id===(it.productId||Number(it.pid)));
  const pr = (it.customPrice != null) ? it.customPrice : cliPrice(ord.clientId, it.productId||it.pid, p?.basePrice||0);
  const ul = p?.unitLabel||'unidad';
  const ivaText = ord.applyIva ? ' + IVA' : '';
  const spec = itemSpecLabel(it,p) ? ` (${itemSpecLabel(it,p)})` : '';
  return `》${it.qty} ${p?p.name:'—'}${spec}\nPrecio: ${Q(pr)}/${ul}${ivaText}`;
}).join('\n');

// Bonificaciones
const bonusLines = sapCalc ? sapCalc.bonusLines.map(r => {
  const spec = r.specLabel ? ` (${r.specLabel})` : '';
  const comment = r.ruleName ? `\n${r.ruleName}` : '';
  return `${r.qty} ${r.name}${spec}\nPrecio: ${Q(r.sapPriceNoIva)}/${r.sapUnitLabel} +IVA${comment}`;
}).join('\n') : (ord.bonusLines||[]).map(bl => {
  const p  = S.products.find(x => x.id===Number(bl.productId));
  const ul = p?.unitLabel||'unidad';
  const spec = p?.presentation ? ` (${p.presentation})` : '';
  const ivaTxtB = ord.applyIva ? ' +IVA' : '';
  const comment = bl.ruleName ? `\n${bl.ruleName}` : '';
  return `${bl.qty} ${p?p.name:'—'}${spec}\nPrecio: ${Q(bl.price||0)}/${ul}${ivaTxtB}${comment}`;
}).join('\n');
const bonusBlock = bonusLines ? `》BONIFICACIÓN《\n${bonusLines}` : '';

const tot = orderTotal(ord.items, ord.clientId);
const totalFinal = sapCalc ? sapCalc.totalConIva : (ord.applyIva ? tot*1.12 : tot);

// Comentarios con bullet •
const cmts = (ord.comments && ord.comments.length ? ord.comments : (ord.note ? [ord.note] : [])).filter(c=>c&&c.trim());
const comentariosTexto = cmts.map(c => `•${c}`).join('\n');

const ocLine = ord.oc ? `Orden ${ord.oc}` : '';
const qNoteLine = ord.quoteNote ? `Fecha de entrega: ${fmtEntrega(ord.quoteNote)}` : '';
const deliveryLine = ord.delivery ? `Entrega: ${ord.delivery}` : '';

let t = [ocLine, qNoteLine, deliveryLine].filter(Boolean).join('\n');
if (comentariosTexto) t += (t ? '\n' : '') + comentariosTexto + '\n\n';
else t += (t ? '\n' : '');
t += prodLines;
t += '\n' + `TOTAL: ${Q(totalFinal)}`;
if (bonusBlock) t += '\n\n' + bonusBlock;

const body = `Buen día, por favor facturar:\n\n${t}`;
const cli = S.clients.find(c => c.id === ord.clientId);
const idPart = cli && cli.clientCode ? `ID: ${cli.clientCode} - ` : '';
const cotPart = ord.quote ? ` - ${ord.quote}` : '';
const subject = `${idPart}${ord.clientName}${cotPart}`;

if (navigator.share) {
  navigator.share({ title: subject, text: body }).catch(() => {});
} else {
  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
}

function shareQuote() {
if (!currentQuote) return;
const text = buildQuoteText(currentQuote);
location.href = 'whatsapp://send?text=' + encodeURIComponent(text);
}

function buildQuoteText(ord) {
const b   = S.biz;
const tot = orderTotal(ord.items, ord.clientId);
const sapCalc = ord.sapMode ? getSapCalcForOrder(ord) : null;
const qNum = ord.quote || '';
const fechaSolo = (ord.date||'').split(',')[0];

let t = '';

// Encabezado empresa
t += `*${b.name||'Cotización'}*\n`;
if (b.exec)  t += `${b.exec}\n`;
if (b.phone) t += `📞 ${b.phone}\n`;
if (b.email) t += `✉ ${b.email}\n`;
t += `\n📄 *COTIZACIÓN*\n`;
if (qNum) t += `No. ${qNum}\n`;
t += `Fecha: ${fechaSolo}\n`;
if (ord.delivery) t += `Dirección de entrega: ${ord.delivery}\n`;
t += `\n`;
t += `Cliente: *${ord.clientName}*\n`;

// Comentarios normales
const cmts = ord.comments && ord.comments.length ? ord.comments : (ord.note ? [ord.note] : []);
cmts.filter(Boolean).forEach(c => { t += `- ${c}\n`; });

// Productos
t += '\n';
if (sapCalc) {
  sapCalc.items.forEach(r => {
    const spec = r.specLabel ? ` (${r.specLabel})` : '';
    t += `- ${r.qty} *${r.name.toUpperCase()}${spec}*\n`;
    t += `  Precio ${Q(r.sapPriceNoIva)}/${r.sapUnitLabel} +IVA\n`;
  });
} else {
  ord.items.forEach(it => {
    const p   = S.products.find(x => x.id===(it.productId||Number(it.pid)));
    const pr  = (it.customPrice != null) ? it.customPrice : cliPrice(ord.clientId, it.productId||it.pid, p?.basePrice||0);
    const ul  = p?.unitLabel||'unidad';
    const spec = itemSpecLabel(it,p) ? ` (${itemSpecLabel(it,p)})` : '';
    const ivaText = ord.applyIva ? ' +IVA' : '';
    t += `- ${it.qty} *${p?p.name.toUpperCase():'—'}${spec}*\n`;
    t += `  Precio ${Q(pr)}/${ul}${ivaText}\n`;
  });
}

// Total
const totalFinal = sapCalc ? sapCalc.totalConIva : (ord.applyIva ? tot*1.12 : tot);
const ivaLabel = (sapCalc || ord.applyIva) ? ' _(IVA incluido)_' : '';
t += `\n*TOTAL: ${Q(totalFinal)}*${ivaLabel}\n`;

// Bonificaciones
const bonusLines = sapCalc ? sapCalc.bonusLines.map(r => {
  const spec = r.specLabel ? ` (${r.specLabel})` : '';
  return `- ${r.qty} *${r.name.toUpperCase()}${spec}*\n  Precio ${Q(r.sapPriceNoIva)}/${r.sapUnitLabel} +IVA`;
}).join('\n') : (ord.bonusLines||[]).map(bl => {
  const p  = S.products.find(x=>x.id===Number(bl.productId));
  const ul = p?.unitLabel||'unidad';
  const spec = p?.presentation ? ` (${p.presentation})` : '';
  const ivaTxtD = ord.applyIva ? ' +IVA' : '';
  return `- ${bl.qty} *${p?p.name.toUpperCase():'—'}${spec}*\n  Precio ${Q(bl.price||0)}/${ul}${ivaTxtD}`;
}).join('\n');
if (bonusLines) t += `\n》BONIFICACIÓN《\n${bonusLines}\n`;

// Pie de página
if (b.footer) t += `\n${b.footer}`;

return t;
}




