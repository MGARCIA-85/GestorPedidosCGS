// ═══════════════════════════════════════════════════════
//  RUTAS
// ═══════════════════════════════════════════════════════
if (!S.routes)  S.routes  = [];
if (!S.nextRid) S.nextRid = 1;
S.routes.forEach(r => { if (!r.orders) r.orders = []; });

// ── Crear ruta ────────────────────────────────────────
function createRoute() {
  const name = document.getElementById('route-name').value.trim();
  if (!name) { toast('Escribe un nombre para la ruta','#ef4444'); return; }
  S.routes.push({ id: S.nextRid++, name, orders: [] });
  document.getElementById('route-name').value = '';
  collapseForm('route-form-body');
  save(); renderRoutes(); toast('✔ Ruta creada');
}

// ── Renombrar ruta ────────────────────────────────────
function promptRenameRoute(rid) {
  const r = S.routes.find(x => x.id === rid); if (!r) return;
  const wrap = document.getElementById('route-edit-'+rid);
  if (!wrap) return;
  const inp = wrap.querySelector('.route-name-inp');
  if (!inp) return;
  const isOpen = wrap.style.display !== 'none';
  wrap.style.display = isOpen ? 'none' : 'flex';
  if (!isOpen) { inp.value = r.name; inp.focus(); inp.select(); renderRouteMunOrderEditor(rid); }
}

function saveRouteName(rid) {
  const r = S.routes.find(x => x.id === rid); if (!r) return;
  const wrap = document.getElementById('route-edit-'+rid);
  const inp  = wrap ? wrap.querySelector('.route-name-inp') : null;
  const val  = inp ? inp.value.trim() : '';
  if (!val) { toast('El nombre no puede estar vacío','#ef4444'); return; }
  r.name = val;
  wrap.style.display = 'none';
  save(); renderRoutes(); toast('✔ Nombre actualizado');
}

// Editor del orden manual de Sectores para una ruta ya creada. Lista plana
// (sin agrupar por Departamento) con los Sectores presentes en los pedidos
// actuales de esa ruta.
function renderRouteMunOrderEditor(rid) {
  const wrap = document.getElementById('route-mun-order-'+rid);
  if (!wrap) return;
  const r = S.routes.find(x => x.id === rid);
  if (!r) return;
  const orders = (r.orders||[]).map(id => S.orders.find(o=>o.id===id)).filter(Boolean);
  const munIds = new Set();
  orders.forEach(o => {
    const cli = S.clients.find(c=>c.id===o.clientId);
    if (cli && cli.municipioId) munIds.add(Number(cli.municipioId));
  });
  if (!munIds.size) {
    wrap.innerHTML = '<div style="font-size:11px;color:#64748b">Esta ruta aún no tiene pedidos con Sector asignado.</div>';
    return;
  }
  if (!S.routeMunOrder) S.routeMunOrder = {};
  const relevantIds = [...munIds];
  let ordered = (S.routeMunOrder[rid] || []).filter(id => relevantIds.includes(id));
  // Los sectores de esta ruta que aún no tengan orden propio, se agregan
  // siguiendo la plantilla general guardada (si la tienen)
  const template = S.genMunOrderTemplate || [];
  const fromTemplate = template.filter(id => relevantIds.includes(id) && !ordered.includes(id));
  ordered = [...ordered, ...fromTemplate];
  relevantIds.forEach(id => { if (!ordered.includes(id)) ordered.push(id); });

  const rows = ordered.map(mid => {
    const m = (S.municipios||[]).find(x=>x.id===mid);
    if (!m) return '';
    return `<div class="sortable-item route-mun-order-item" data-id="${mid}" style="display:flex;align-items:center;gap:6px;background:#0d0d1f;border:1px solid #1a1a3a;border-radius:6px;padding:5px 9px;margin-bottom:4px">
      <span class="drag-handle" style="font-size:14px">≡</span>
      <span style="flex:1;font-size:12px;color:#f1f5f9">🏘️ ${m.name}</span>
    </div>`;
  }).join('');

  wrap.innerHTML = `<div style="font-size:10px;color:#64748b;margin-bottom:6px">Mantén presionado ≡ para arrastrar y definir el orden de visita de los Sectores (sin importar su Departamento)</div>${rows}`;
  setupDrag(wrap, (c)=>saveRouteMunOrderFromDOM(c, rid), 'route-mun-order-item');
}

function saveRouteMunOrderFromDOM(container, rid) {
  if (!S.routeMunOrder) S.routeMunOrder = {};
  const ids = [...container.querySelectorAll('.route-mun-order-item')].map(el => Number(el.dataset.id));
  S.routeMunOrder[rid] = ids;
  // También actualizar la plantilla general reutilizable
  if (!S.genMunOrderTemplate) S.genMunOrderTemplate = [];
  const rest = S.genMunOrderTemplate.filter(id => !ids.includes(id));
  S.genMunOrderTemplate = [...rest, ...ids];
  save();
}

// ── Eliminar ruta ─────────────────────────────────────
// ── Renderizar lista de rutas ─────────────────────────
function renderRoutes() {
  const wrap = document.getElementById('routes-list');
  if (!wrap) return;

  // Renderizar chips de departamentos, municipios y rutas en panel Generar
  renderGenChips('dept');
  renderGenChips('mun');
  renderGenRutaChips();
  renderGenOrderList();

  if (!S.routes.length) {
    wrap.innerHTML = '<div style="text-align:center;color:#64748b;padding:24px 0">Sin rutas creadas. Agrega una arriba.</div>';
    return;
  }
  if (!window._routeOpen) window._routeOpen = {};
  if (!window._routeSel) window._routeSel = {};  // pedidos seleccionados por ruta
  if (!window._cliOpen)   window._cliOpen   = {};
  if (!S.pinnedRoutes) S.pinnedRoutes = [];

  // Pinned primero, luego el resto más reciente primero
  const pinned    = S.routes.filter(r => S.pinnedRoutes.includes(r.id));
  const unpinned  = S.routes.filter(r => !S.pinnedRoutes.includes(r.id));
  const unpinnedSorted = _routeAsc ? [...unpinned] : [...unpinned].reverse();
  const sorted    = [...pinned, ...unpinnedSorted];

  wrap.innerHTML = sorted.map(r => {
    if (!r.orders) r.orders = [];
    const orders = r.orders.map(id => S.orders.find(o=>o.id===id)).filter(Boolean);
    // Ordenar pedidos de la ruta según configuración
    if (!S.routeOrdSort) S.routeOrdSort = {};
    const rSortRaw = S.routeOrdSort[r.id] || {s1:'default',s2:'none',s3:'none'};
    const rSort1 = typeof rSortRaw==='object' ? (rSortRaw.s1||'default') : rSortRaw;
    const rSort2 = typeof rSortRaw==='object' ? (rSortRaw.s2||'none')    : 'none';
    const rSort3 = typeof rSortRaw==='object' ? (rSortRaw.s3||'none')    : 'none';
    const rSort  = rSort1;
    // Orden manual de Sectores definido para esta ruta (si existe, lista
    // plana sin agrupar por Departamento). Departamento se ordena siempre
    // alfabéticamente; el orden manual solo aplica a Sector.
    const munOrder  = (S.routeMunOrder  && S.routeMunOrder[r.id]) || null;
    const _getSortVal = (o,key) => {
      const cli = S.clients.find(c=>c.id===o.clientId)||{};
      if (key==='alpha')  return (o.clientName||'').toLowerCase();
      if (key==='dept')   return ((S.depts||[]).find(x=>x.id===cli.deptId)||{name:''}).name.toLowerCase();
      if (key==='mun') {
        const m = (S.municipios||[]).find(x=>x.id===cli.municipioId);
        let rank = 999999;
        if (munOrder) { const ix = munOrder.indexOf(Number(cli.municipioId)); if (ix!==-1) rank = ix; }
        return String(rank).padStart(6,'0') + '_' + (m?m.name.toLowerCase():'');
      }
      if (key==='ruta')   return ((S.rutasCliente||[]).find(x=>x.id===cli.rutaClienteId)||{name:''}).name.toLowerCase();
      if (key==='recent') return -ordDateTs(o);
      if (key==='old')    return  ordDateTs(o);
      return '';
    };
    const _cmpR = (a,b,key) => {
      if (!key||key==='none') return 0;
      const va=_getSortVal(a,key), vb=_getSortVal(b,key);
      return typeof va==='string' ? va.localeCompare(vb,'es') : va-vb;
    };
    const orderedOrders = [...orders].sort((a,b) => {
      if (rSort1==='default'||rSort1==='manual') return 0;
      return _cmpR(a,b,rSort1) || _cmpR(a,b,rSort2) || _cmpR(a,b,rSort3);
    });
    // Filtro por Sector (independiente del orden elegido arriba)
    if (!window._routeMunFilter) window._routeMunFilter = {};
    const munFilterVal = window._routeMunFilter[r.id] || '';
    const munOptions = [...new Set(orders.map(o => {
      const cli = S.clients.find(c=>c.id===o.clientId);
      return cli && cli.municipioId ? Number(cli.municipioId) : null;
    }).filter(Boolean))]
      .map(id => (S.municipios||[]).find(m=>m.id===id))
      .filter(Boolean)
      .sort((a,b)=>a.name.localeCompare(b.name,'es'));
    const filteredOrders = munFilterVal
      ? orderedOrders.filter(o => { const cli = S.clients.find(c=>c.id===o.clientId); return cli && Number(cli.municipioId)===Number(munFilterVal); })
      : orderedOrders;
    const pend   = orders.filter(o=>o.status==='Confirmado').length;
    const fact   = orders.filter(o=>o.status==='Concluido').length;
    const tot    = orders.reduce((s,o)=>{
      if (o.sapMode) { const sc = getSapCalcForOrder(o); return s + (sc ? sc.totalConIva : 0); }
      const b=orderTotal(o.items,o.clientId);return s+(o.applyIva?b*1.12:b);
    },0);
    const isOpen   = !!window._routeOpen[r.id];
    const isPinned = (S.pinnedRoutes||[]).includes(r.id);

    const ordRows = filteredOrders.length ? filteredOrders.map((o, rIdx) => {
      const oTot = orderTotal(o.items,o.clientId);
      const sapCalc = o.sapMode ? getSapCalcForOrder(o) : null;
      const oDisp = sapCalc ? sapCalc.totalConIva : (o.applyIva ? oTot*1.12 : oTot);
      const statusColor = isOrderBlocked(o)?'#a855f7':o.status==='Concluido'?'#4ade80':o.status==='Confirmado'?'#60a5fa':'#f1f5f9';
      const items = o.items.map(it=>{
        const p=S.products.find(x=>x.id===(it.productId||Number(it.pid)));
        return `<span style="font-size:11px;color:#94a3b8">• ${p?p.name:'—'} ×${it.qty}</span>`;
      }).join(' ');
      const ordOpen = window._ordOpen && window._ordOpen[o.id];
      const itemsHtml = sapCalc ? sapCalc.items.map(r => {
        return `<div style="font-size:12px;padding:5px 0;border-bottom:1px solid #1e2640">
          <div style="display:flex;justify-content:space-between;align-items:baseline;gap:6px">
            <span style="color:#f1f5f9;font-weight:600;flex:1;min-width:0">${r.qty} ${r.name} × ${Q(r.sapPriceNoIva)}/${r.sapUnitLabel} <span style="color:#facc15;font-size:10px">+IVA</span></span>
            <span style="color:#f1f5f9;font-weight:700;flex-shrink:0">${Q(r.sapLineTotalWithIva)}</span>
          </div>
          ${specTagLineHtml(r.specLabel)}
        </div>`;
      }).join('') : o.items.map(it => {
        const p   = S.products.find(x => x.id === (it.productId || Number(it.pid)));
        const pres = itemSpecLabel(it,p);
        const pr  = (it.customPrice != null) ? it.customPrice : cliPrice(o.clientId, it.productId||it.pid, p?.basePrice||0);
        const ul  = p?.unitLabel || 'unidad';
        const us  = itemUnitSizeFor(it, p);
        const sub = pr * it.qty * us;
        const ivaText = o.applyIva ? ' <span style="color:#facc15;font-size:10px">+IVA</span>' : '';
        return `<div style="font-size:12px;padding:5px 0;border-bottom:1px solid #1e2640">
          <div style="display:flex;justify-content:space-between;align-items:baseline;gap:6px">
            <span style="color:#f1f5f9;font-weight:600;flex:1;min-width:0">${it.qty} ${p?p.name:'—'} × ${Q(pr)}/${ul}${ivaText}</span>
            <span style="color:#f1f5f9;font-weight:700;flex-shrink:0">${Q(sub)}</span>
          </div>
          ${specTagLineHtml(pres)}
        </div>`;
      }).join('');

      return `<div data-oid="${o.id}" data-rid="${r.id}" style="background:#161929;border-radius:8px;margin-bottom:6px;border-left-width:3px;border-left-style:solid;border-left-color:${statusColor};overflow:hidden;${rSort==='manual'?'cursor:grab':''}">
        <!-- CABECERA: siempre visible, clic para expandir -->
        <div onclick="toggleRouteOrd(${o.id})" style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;cursor:pointer">
          <div style="flex:1;min-width:0;display:flex;align-items:center;gap:6px">
            ${rSort==='manual'?`<span class="route-drag-handle" style="color:#64748b;font-size:16px;margin-right:6px;cursor:grab;user-select:none;touch-action:none">≡</span>`:''}
            <input type="checkbox" class="route-ord-chk" data-rid="${r.id}" data-oid="${o.id}"
              style="width:16px;height:16px;cursor:pointer;accent-color:#10b981;flex-shrink:0"
              ${(window._routeSel[r.id]||new Set()).has(o.id)?'checked':''}
              onclick="event.stopPropagation();toggleRouteOrdSel(${r.id},${o.id},this.checked)"/>
            <div style="display:flex;flex-direction:column;min-width:0">
              <div><span style="font-size:13px;font-weight:700;color:#f1f5f9">#${rIdx+1} </span><span style="font-size:13px;font-weight:700;color:${clientNameColor(o)};cursor:pointer;text-decoration:underline" onclick="event.stopPropagation();openClientCard(${o.clientId})">${o.clientName}</span></div>
              <div style="font-size:10px;color:#64748b;margin-top:2px">${fmtOrdDate(o.date)}${o.quote?' · Cot: <strong style="color:#2dd4bf">'+o.quote+'</strong>':''}${o.oc?' · Orden: <strong style="color:#818cf8">'+o.oc+'</strong>':''}</div>
              ${isOrderBlocked(o)?`<div style="font-size:10px;color:#a855f7;font-weight:700">🔒 Bloqueado (fecha futura)</div>`:''}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:5px;flex-shrink:0">
            <span style="font-size:10px;color:${statusColor};font-weight:700">${o.status}</span>
            <span style="color:#64748b;font-size:20px;font-weight:700">${ordOpen?'▲':'▼'}</span>
          </div>
        </div>
        <!-- DETALLE: colapsable -->
        ${ordOpen ? `<div style="padding:0 10px 10px">
          <!-- Entrega y quoteNote ARRIBA de productos -->
          ${o.delivery?`<div style="font-size:11px;color:#3b82f6;font-weight:600;margin-bottom:4px;margin-top:4px">📍 ${o.delivery}</div>`:''}
          ${o.quoteNote?`<div style="font-size:11px;color:#38bdf8;font-weight:700;margin-bottom:6px">📅 Fecha de entrega: ${fmtEntrega(o.quoteNote)}</div>`:''}
          <!-- Productos -->
          <div style="background:#0d0f18;border-radius:6px;padding:6px 8px;margin-bottom:8px">
            ${itemsHtml || '<div style="font-size:11px;color:#64748b">Sin productos</div>'}
          </div>
          <!-- Total y bonif -->
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap">
            <span style="font-size:13px;font-weight:700;color:#f1f5f9">TOTAL ${Q(oDisp)}</span>
            ${sapCalc?'<span style="font-size:9px;font-weight:700;color:#fff;background:#7c3aed;padding:1px 6px;border-radius:4px">🧮 SAP</span>':''}
            <button onclick="openSalesforceModal(${o.id})" style="background:#0f1e3a;border:1px solid #3b82f6;border-radius:6px;color:#60a5fa;font-size:10px;font-weight:700;padding:3px 8px;cursor:pointer;white-space:nowrap">☁️ Salesforce</button>
            ${(o.bonusLines&&o.bonusLines.length)?(()=>{
              const av = o.bonusLines.every(bl => bl.fromRuleId != null);
              const ae = o.bonusLines.every(bl => bl.exceptional);
              const ic = av ? '✅' : ae ? '🎗️' : '⚠️';
              const bc = av ? '#10b981' : ae ? '#f59e0b' : '#ef4444';
              return `<span style="font-size:10px;background:#1e3a8a;color:${bc};padding:1px 6px;border-radius:6px;font-weight:700">${ic} Bonif.</span>`;
            })():''}
          </div>
          <!-- Comentarios normales ABAJO -->
          ${(o.comments&&o.comments.length)?o.comments.filter(Boolean).map(cm=>`<div style="font-size:11px;color:#f97316;font-style:italic;margin-bottom:3px">💬 ${cm}</div>`).join(''):''}
          <!-- Bonificación -->
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
            return `<div style="margin-top:4px"><div style="font-size:11px;color:#10b981;font-weight:700;margin-bottom:3px">🎁 BONIFICACIÓN</div><div style="background:#0d0f18;border-radius:5px;padding:4px 6px">${bLines}</div></div>`;
          })()}
          <!-- Botones -->
          <div style="display:flex;gap:4px;align-items:center;margin-top:6px" onclick="event.stopPropagation()">
            <button class="bs" style="flex:1;font-size:11px;padding:5px 2px" onclick="editOrderFromRoute(${o.id})">✏️ Editar</button>
            <button class="bb" style="flex:1;font-size:11px;padding:5px 2px" onclick="openQuoteFromRoute(${o.id})">📄 Cot.</button>
            <button class="bv" style="flex:1;font-size:11px;padding:5px 2px" onclick="duplicateOrder(${o.id})">📋 Dupl.</button>
            <button class="br" style="flex:1;font-size:11px;padding:5px 2px" onclick="removeOrderFromRoute(${o.id},${r.id})">✕</button>
          </div>
        </div>` : ''}
      </div>`;
    }).join('') : '<div style="font-size:12px;color:#64748b;padding:8px 0">Sin pedidos. Presiona <strong>🛒 + Pedido</strong>.</div>';

    // Color del título según estado de pedidos
    const _allConc  = orders.length > 0 && orders.every(o => o.status === 'Concluido');
    const _allConfOrConc = orders.length > 0 && orders.every(o => o.status === 'Confirmado' || o.status === 'Concluido');
    const _anyEdited = orders.some(o => o.status !== 'Cotización');
    const _titleColor = orders.length === 0 ? '#f1f5f9'
      : _allConc ? '#4ade80'
      : _allConfOrConc ? '#60a5fa'
      : _anyEdited ? '#f59e0b'
      : '#f1f5f9';

    return `<div class="card" data-rid="${r.id}" style="margin-bottom:10px;padding-bottom:${isOpen?'12px':'4px'};transition:opacity 0.3s">
      <!-- Encabezado: nombre completo arriba, botones abajo -->
      <div onclick="toggleRoute(${r.id})" style="cursor:pointer;margin-bottom:6px">
        <div style="font-weight:800;font-size:16px;color:${_titleColor};line-height:1.3">${isPinned?'📌 ':'🚚 '}${r.name}</div>
        <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap;align-items:center">
          <span style="font-size:10px;background:#1e3a5f;color:#60a5fa;padding:1px 7px;border-radius:8px">${orders.length} pedidos</span>
          ${pend?`<span style="font-size:10px;background:#422006;color:#fb923c;padding:1px 7px;border-radius:8px">${pend} pend.</span>`:''}
          ${fact?`<span style="font-size:10px;background:#1e3a8a;color:#4ade80;padding:1px 7px;border-radius:8px">${fact} concl.</span>`:''}
          <span style="font-size:10px;font-weight:700;color:#f59e0b">Total: ${Q(tot)}</span>
          <span style="font-size:11px;color:#64748b">${isOpen?'▲':'▼'}</span>
        </div>
      </div>
      <!-- Botones compactos en una sola fila -->
      <div style="display:flex;gap:4px;flex-wrap:nowrap" onclick="event.stopPropagation()">
        <button style="flex:1;font-size:11px;padding:5px 2px;background:${isPinned?'#92400e':'transparent'};border:1px solid ${isPinned?'#f59e0b':'#475569'};border-radius:7px;color:${isPinned?'#f59e0b':'#94a3b8'};cursor:pointer" onclick="togglePinRoute(${r.id})" title="${isPinned?'Desanclar':'Anclar'}">📌</button>
        <button class="bs" style="flex:1;font-size:11px;padding:5px 2px" onclick="addOrderToRoute(${r.id})" title="Agregar pedido">🛒</button>
        <button class="bg" style="flex:1;font-size:11px;padding:5px 2px" onclick="markRouteConcluido(${r.id})" title="Concluir todos">✔</button>
        <button class="bs" style="flex:1;font-size:11px;padding:5px 2px" onclick="promptRenameRoute(${r.id})" title="Renombrar">✏️</button>
        <button class="br" style="flex:1;font-size:11px;padding:5px 2px" onclick="deleteRoute(${r.id})" title="Eliminar ruta">🗑</button>
      </div>
      <!-- Contenido colapsable -->
      <div id="route-body-${r.id}" style="display:${isOpen?'block':'none'}">
        <!-- Editar nombre y orden de Sectores inline -->
        <div id="route-edit-${r.id}" style="display:none;flex-direction:column;gap:8px;margin:10px 0 4px">
          <div style="display:flex;gap:6px;align-items:center">
            <input class="inp route-name-inp" style="margin:0;flex:1" placeholder="Nuevo nombre..."/>
            <button class="bg" style="padding:9px 12px;white-space:nowrap" onclick="saveRouteName(${r.id})">✔ Guardar</button>
          </div>
          <div>
            <div style="font-size:11px;color:#94a3b8;font-weight:700;margin-bottom:4px">↕️ Orden de Sectores de esta ruta</div>
            <div id="route-mun-order-${r.id}"></div>
          </div>
        </div>
        <!-- Pedidos -->
        <div style="margin-bottom:8px">
          <div style="display:flex;gap:4px;overflow:hidden">
            <select onchange="setRouteOrdSort(${r.id},'s1',this.value)" style="flex:1;min-width:0;font-size:11px;background:#161929;color:#f1f5f9;border:1px solid #2a3050;border-radius:6px;padding:3px 6px">
              <option value="default" ${rSort1==='default'?'selected':''}>Como se agregaron</option>
              <option value="alpha"   ${rSort1==='alpha'?'selected':''}>A→Z Cliente</option>
              <option value="ruta"    ${rSort1==='ruta'?'selected':''}>🚚 Ruta</option>
              <option value="dept"    ${rSort1==='dept'?'selected':''}>🏛️ Departamento</option>
              <option value="mun"     ${rSort1==='mun'?'selected':''}>🏘️ Sector</option>
              <option value="recent"  ${rSort1==='recent'?'selected':''}>Más recientes</option>
              <option value="old"     ${rSort1==='old'?'selected':''}>Más antiguos</option>
              <option value="manual"  ${rSort1==='manual'?'selected':''}>⇅ Manual</option>
            </select>
            <select onchange="setRouteOrdSort(${r.id},'s2',this.value)" style="flex:1;min-width:0;font-size:11px;background:#161929;color:#f1f5f9;border:1px solid #2a3050;border-radius:6px;padding:3px 6px">
              <option value="none"   ${rSort2==='none'?'selected':''}>—</option>
              <option value="alpha"  ${rSort2==='alpha'?'selected':''}>A→Z Cliente</option>
              <option value="ruta"   ${rSort2==='ruta'?'selected':''}>🚚 Ruta</option>
              <option value="dept"   ${rSort2==='dept'?'selected':''}>🏛️ Departamento</option>
              <option value="mun"    ${rSort2==='mun'?'selected':''}>🏘️ Sector</option>
              <option value="recent" ${rSort2==='recent'?'selected':''}>Más recientes</option>
              <option value="old"    ${rSort2==='old'?'selected':''}>Más antiguos</option>
            </select>
            <select onchange="setRouteOrdSort(${r.id},'s3',this.value)" style="flex:1;min-width:0;font-size:11px;background:#161929;color:#f1f5f9;border:1px solid #2a3050;border-radius:6px;padding:3px 6px">
              <option value="none"   ${(rSort3||'none')==='none'?'selected':''}>—</option>
              <option value="alpha"  ${(rSort3||'none')==='alpha'?'selected':''}>A→Z Cliente</option>
              <option value="ruta"   ${(rSort3||'none')==='ruta'?'selected':''}>🚚 Ruta</option>
              <option value="dept"   ${(rSort3||'none')==='dept'?'selected':''}>🏛️ Departamento</option>
              <option value="mun"    ${(rSort3||'none')==='mun'?'selected':''}>🏘️ Sector</option>
              <option value="recent" ${(rSort3||'none')==='recent'?'selected':''}>Más recientes</option>
              <option value="old"    ${(rSort3||'none')==='old'?'selected':''}>Más antiguos</option>
            </select>
          </div>
        </div>
        ${munOptions.length?`<div style="margin-bottom:8px">
          <select onchange="setRouteMunFilter(${r.id},this.value)" style="width:100%;font-size:11px;background:#161929;color:#f1f5f9;border:1px solid #2a3050;border-radius:6px;padding:5px 6px">
            <option value="">🏘️ Todos los Sectores</option>
            ${munOptions.map(m=>`<option value="${m.id}" ${String(munFilterVal)===String(m.id)?'selected':''}>${m.name}</option>`).join('')}
          </select>
        </div>`:''}
        ${rSort1==='manual'?`<div style="font-size:10px;color:#64748b;margin-bottom:6px;text-align:center">Mantén presionado ≡ para arrastrar y reordenar</div>`:''}
        <div style="margin-top:0" id="route-orders-${r.id}">${ordRows}</div>
      </div>
    </div>`;
  }).join('');
  // Inicializar swipe en pedidos de ruta
  setTimeout(() => {
    document.querySelectorAll('[data-oid][data-rid]').forEach(el => {
      if (!el.dataset.swipeInit) {
        el.dataset.swipeInit = '1';
        initRouteSwipe(el, Number(el.dataset.oid), Number(el.dataset.rid));
      }
    });
  }, 100);
}

function toggleRouteOrd(oid) {
  if (!window._ordOpen) window._ordOpen = {};
  const opening = !window._ordOpen[oid];
  // Colapsar todos los demás pedidos
  if (opening) Object.keys(window._ordOpen).forEach(k => { window._ordOpen[k] = false; });
  window._ordOpen[oid] = opening;
  renderRoutes();
  // Opacidad: si hay alguno abierto, opacar los demás
  setTimeout(() => {
    const anyOpen = Object.values(window._ordOpen).some(v => v);
    document.querySelectorAll('[data-oid]').forEach(el => {
      const elOid = Number(el.dataset.oid);
      if (anyOpen && !window._ordOpen[elOid]) {
        el.style.opacity = '0.35';
      } else {
        el.style.opacity = '1';
      }
    });
  }, 50);
}

let _routeAsc = false;
function setRouteOrdSort(rid, level, mode) {
  if (!S.routeOrdSort) S.routeOrdSort = {};
  const cur = S.routeOrdSort[rid] || {s1:'default',s2:'none',s3:'none'};
  const obj  = typeof cur==='object' ? {...cur} : {s1:cur,s2:'none',s3:'none'};
  obj[level] = mode;
  S.routeOrdSort[rid] = obj;
  save();
  renderRoutes();
  if (obj.s1==='manual') setTimeout(()=>initRouteOrderDrag(rid),100);
}

// Filtro por Sector dentro de las tarjetas de pedidos de una ruta (solo
// afecta lo que se muestra; no cambia el orden ni los totales de la ruta)
function setRouteMunFilter(rid, val) {
  if (!window._routeMunFilter) window._routeMunFilter = {};
  window._routeMunFilter[rid] = val;
  renderRoutes();
}

function initRouteOrderDrag(rid) {
  const container = document.getElementById('route-orders-'+rid);
  if (!container) return;
  let dragging = null;
  container.querySelectorAll('[data-oid]').forEach(card => {
    const handle = card.querySelector('.route-drag-handle');
    if (!handle) return;
    handle.addEventListener('touchstart', e => {
      dragging = card;
      card.style.opacity = '0.5';
      e.preventDefault();
    }, { passive: false });
    handle.addEventListener('mousedown', e => {
      dragging = card;
      card.style.opacity = '0.5';
    });
  });
  container.addEventListener('touchmove', e => {
    if (!dragging) return;
    e.preventDefault();
    const touch = e.touches[0];
    const els = container.querySelectorAll('[data-oid]');
    els.forEach(el => {
      if (el === dragging) return;
      const rect = el.getBoundingClientRect();
      if (touch.clientY > rect.top && touch.clientY < rect.bottom) {
        if (touch.clientY < rect.top + rect.height/2) container.insertBefore(dragging, el);
        else el.after(dragging);
      }
    });
  }, { passive: false });
  const endDrag = () => {
    if (!dragging) return;
    dragging.style.opacity = '1';
    // Guardar nuevo orden en r.orders
    const r = S.routes.find(x=>x.id===rid); if (!r) { dragging=null; return; }
    const visibleIds = [...container.querySelectorAll('[data-oid]')].map(el=>Number(el.dataset.oid));
    const hasHidden = (r.orders||[]).some(id => !visibleIds.includes(id));
    if (hasHidden) {
      // Si hay un filtro de Sector activo, algunos pedidos de la ruta no
      // están visibles/arrastrables ahora mismo: se conservan en su
      // posición original, y solo se reordenan entre sí los visibles.
      const merged = [];
      let vi = 0;
      (r.orders||[]).forEach(id => {
        if (visibleIds.includes(id)) { merged.push(visibleIds[vi]); vi++; }
        else merged.push(id);
      });
      r.orders = merged;
    } else {
      r.orders = visibleIds;
    }
    dragging = null;
    save(); renderRoutes();
    setTimeout(()=>initRouteOrderDrag(rid),100);
  };
  container.addEventListener('touchend', endDrag);
  document.addEventListener('mouseup', endDrag);
  container.addEventListener('mousemove', e => {
    if (!dragging) return;
    const els = container.querySelectorAll('[data-oid]');
    els.forEach(el => {
      if (el === dragging) return;
      const rect = el.getBoundingClientRect();
      if (e.clientY > rect.top && e.clientY < rect.bottom) {
        if (e.clientY < rect.top + rect.height/2) container.insertBefore(dragging, el);
        else el.after(dragging);
      }
    });
  });
}

function toggleRouteSort() {
  _routeAsc = !_routeAsc;
  const btn = document.getElementById('btn-route-sort');
  if (btn) btn.textContent = _routeAsc ? '🕐 Antiguos' : '🕐 Recientes';
  renderRoutes();
}

function togglePinRoute(rid) {
  if (!S.pinnedRoutes) S.pinnedRoutes = [];
  const idx = S.pinnedRoutes.indexOf(rid);
  if (idx >= 0) S.pinnedRoutes.splice(idx, 1);
  else S.pinnedRoutes.push(rid);
  save(); renderRoutes();
}

function toggleRoute(rid) {
  if (!window._routeOpen) window._routeOpen = {};
  if (!window._routeSel) window._routeSel = {};
  if (!window._cliOpen)   window._cliOpen   = {};
  const opening = !window._routeOpen[rid];
  if (opening) Object.keys(window._routeOpen).forEach(k => { window._routeOpen[k] = false; });
  window._routeOpen[rid] = opening;
  renderRoutes();
  // Opacidad en rutas colapsadas
  setTimeout(() => {
    const anyOpen = Object.values(window._routeOpen).some(v => v);
    document.querySelectorAll('.card[data-rid]').forEach(el => {
      const elRid = Number(el.dataset.rid);
      el.style.opacity = anyOpen && !window._routeOpen[elRid] ? '0.4' : '1';
    });
  }, 50);
}

// ── Agregar pedido a ruta ─────────────────────────────
function addOrderToRoute(rid) {
  sessionStorage.setItem('pendingRouteId', rid);
  _cameFromRoute = true;
  goTab('order');
  toast('🛒 Crea el pedido. Se asignará a la ruta automáticamente.');
}

// ── Editar pedido desde la ruta ───────────────────────
let _cameFromRoute = false;
let _cameFromClient = null; // id del pedido si viene desde ficha cliente
let _listScrollY = 0;
function editOrderFromRoute(oid) {
  _cameFromRoute = true;
  startEditOrder(oid);
}

// ── Quitar pedido de ruta (sin eliminar) ──────────────
// ── Cambiar estado de pedido desde ruta ──────────────
function initOrderSwipe(el, oid, onDone) {
  let startX = 0, startY = 0, dragging = false;
  const THRESHOLD = 80;

  const resetVisual = () => {
    el.style.transform = 'translateX(0)';
    el.style.background = '';
    el.style.removeProperty('border-left-color');
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
    const clamped = Math.max(-130, Math.min(130, dx));
    el.style.transform = `translateX(${clamped}px)`;
    if (dx > 0) {
      const pct = Math.min(1, dx / THRESHOLD);
      el.style.background = `rgba(96,165,250,${pct * 0.5})`;
      el.style.setProperty('border-left-color', `rgba(96,165,250,${pct})`, 'important');
    } else {
      const pct = Math.min(1, -dx / THRESHOLD);
      el.style.background = `rgba(5,46,22,${pct * 0.8})`;
      el.style.setProperty('border-left-color', `rgba(74,222,128,${pct})`, 'important');
    }
  }, {passive:true});

  el.addEventListener('touchend', e => {
    if (!dragging) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    el.style.transition = 'transform 0.3s, background 0.3s, border-color 0.3s';

    if (Math.abs(dy) > Math.abs(dx) || Math.abs(dx) < THRESHOLD) {
      resetVisual();
      return;
    }

    const o = S.orders.find(x=>x.id===oid); if (!o) return;

    if (dx > 0) {
      // Retroceder un estado: Concluido → Confirmado → Cotización
      const prevStatus = { 'Concluido':'Confirmado', 'Confirmado':'Cotización' };
      const newStatus = prevStatus[o.status];
      if (!newStatus) { resetVisual(); return; }
      o.status = newStatus;
      el.style.transform = 'translateX(0)';
      el.style.background = '#1e3a5f';
      el.style.setProperty('border-left-color', '#60a5fa', 'important');
    } else {
      // Avanzar un estado: Cotización → Confirmado → Concluido
      const nextStatus = { 'Cotización':'Confirmado', 'Confirmado':'Concluido' };
      const newStatus = nextStatus[o.status];
      if (!newStatus) { resetVisual(); return; }
      const _check = canAdvanceOrderStatus(o, newStatus);
      if (!_check.ok) { resetVisual(); handleConfirmBlocked(o, _check.reason); return; }
      o.status = newStatus;
      el.style.transform = 'translateX(0)';
      el.style.background = newStatus==='Concluido' ? '#052e16' : '#1e3a5f';
      el.style.setProperty('border-left-color', newStatus==='Concluido' ? '#4ade80' : '#60a5fa', 'important');
    }
    save();
    setTimeout(onDone, 400);
  }, {passive:true});
}

// Envoltorios: mantienen los nombres originales (usados en el resto del código)
// para que Pedidos, Ficha de cliente y Rutas compartan la misma lógica de deslizar.
function initListSwipe(el, oid) { initOrderSwipe(el, oid, () => renderList()); }
function initCliOrdSwipe(el, oid) { initOrderSwipe(el, oid, () => renderClients()); }
function initRouteSwipe(el, oid, rid) { initOrderSwipe(el, oid, () => renderRoutes()); }



function markRouteConcluido(rid) {
  const r = S.routes.find(x=>x.id===rid); if(!r) return;
  if (!r.orders) r.orders = [];
  const pend = r.orders.map(id=>S.orders.find(o=>o.id===id)).filter(o=>o&&o.status!=='Concluido');
  if (!pend.length) { toast('Todos los pedidos ya están concluidos','#10b981'); return; }
  const sinDir = pend.filter(o=>!o.delivery);
  if (sinDir.length) {
    toast(`📍 ${sinDir.length} pedido(s) sin dirección de entrega. Edítalos primero.`, '#ef4444'); return;
  }
  askConfirm('¿Concluir '+pend.length+' pedido(s)?', 'Se marcarán como Concluido.', () => {
    pend.forEach(o=>o.status='Concluido');
    save(); renderRoutes(); renderList(); toast('✔ '+pend.length+' pedidos concluidos');
  }, '✔ Confirmar');
  const btn = document.getElementById('confirm-ok-btn');
  if (btn) { btn.style.background='#10b981'; btn.style.color='#fff'; }
}

// ── Selección de pedidos en ruta ──────────────────
function toggleRouteOrdSel(rid, oid, checked) {
  if (!window._routeSel) window._routeSel = {};
  if (!window._routeSel[rid]) window._routeSel[rid] = new Set();
  if (checked) window._routeSel[rid].add(oid);
  else window._routeSel[rid].delete(oid);
  updateRouteSelBar();
}

function updateRouteSelBar() {
  const bar = document.getElementById('route-sel-bar');
  if (!bar) return;
  // Contar todos los seleccionados en todas las rutas
  let allSel = [];
  Object.values(window._routeSel||{}).forEach(set => set.forEach(id => allSel.push(id)));
  const n = allSel.length;
  if (n === 0) {
    bar.style.display = 'none';
    const page = document.getElementById('page-routes');
    if (page) page.style.paddingTop = '';
    return;
  }
  bar.style.top = _getNavBottom() + 'px';
  bar.style.display = 'flex';
  document.getElementById('route-sel-count').textContent = n + ' pedido' + (n!==1?'s':'') + ' seleccionado' + (n!==1?'s':'');
  // Resumen
  const selOrds = allSel.map(id => S.orders.find(o=>o.id===id)).filter(Boolean);
  const total = selOrds.reduce((s,o)=>{ const t=orderTotal(o.items,o.clientId); return s+(o.applyIva?t*1.12:t); },0);
  const prods = {};
  selOrds.forEach(o => o.items.forEach(it => {
    const p = S.products.find(x=>x.id===(it.productId||Number(it.pid)));
    const k = (p?p.name:'—');
    prods[k] = (prods[k]||0) + Number(it.qty);
  }));
  const prodLines = Object.entries(prods).map(([k,v])=>`• ${k}: <strong style="color:#f1f5f9">${v}</strong>`).join(' &nbsp;');
  document.getElementById('route-sel-summary').innerHTML =
    `<div style="color:#f59e0b;font-weight:700;margin-bottom:3px">Total: ${Q(total)}</div>${prodLines}`;
  setTimeout(() => {
    const barH = bar.offsetHeight;
    const _rp = document.getElementById('page-routes');
    if (_rp) {
      const oldPad = parseInt(_rp.style.paddingTop) || 0;
      const barBottom = bar.getBoundingClientRect().bottom;
      const pageTop = _rp.getBoundingClientRect().top;
      const newPad = Math.max(0, barBottom - pageTop + oldPad);
      if (Math.abs(newPad - oldPad) > 2) {
        const diff = newPad - oldPad;
        _rp.style.paddingTop = newPad + 'px';
        window.scrollBy(0, diff);
      }
    }
  }, 50);
}

function selectAllRouteVisible() {
  if (!window._routeSel) window._routeSel = {};
  document.querySelectorAll('.route-ord-chk').forEach(chk => {
    if (chk.offsetParent === null) return;
    const rid = Number(chk.dataset.rid);
    const oid = Number(chk.dataset.oid);
    if (!window._routeSel[rid]) window._routeSel[rid] = new Set();
    window._routeSel[rid].add(oid);
    chk.checked = true;
  });
  updateRouteSelBar();
}
const _routeStatusActive = {};
function toggleRouteByStatus(status) {
  const btnMap = {Cotización:'rut-btn-cot', Confirmado:'rut-btn-con', Concluido:'rut-btn-fin'};
  const colorMap = {Cotización:{b:'#64748b',c:'#94a3b8',ab:'#475569',ac:'#fff'}, Confirmado:{b:'#1d4ed8',c:'#60a5fa',ab:'#1d4ed8',ac:'#fff'}, Concluido:{b:'#15803d',c:'#4ade80',ab:'#15803d',ac:'#fff'}};
  const btn = document.getElementById(btnMap[status]);
  const col = colorMap[status];

  // Si ningún botón de estado está activo, limpiar selección manual primero
  const anyActive = Object.values(_routeStatusActive).some(v => v);
  if (!anyActive && !_routeStatusActive[status]) {
    window._routeSel = {};
    document.querySelectorAll('.route-ord-chk').forEach(chk => chk.checked = false);
  }

  if (_routeStatusActive[status]) {
    _routeStatusActive[status] = false;
    document.querySelectorAll('.route-ord-chk').forEach(chk => {
      if (chk.offsetParent === null) return;
      const rid = Number(chk.dataset.rid);
      const oid = Number(chk.dataset.oid);
      const o = S.orders.find(x => x.id === oid);
      if (o && o.status === status) { chk.checked = false; if (window._routeSel[rid]) window._routeSel[rid].delete(oid); }
    });
    if (btn) { btn.style.background='transparent'; btn.style.color=col.c; btn.style.borderColor=col.b; }
  } else {
    _routeStatusActive[status] = true;
    document.querySelectorAll('.route-ord-chk').forEach(chk => {
      if (chk.offsetParent === null) return;
      const rid = Number(chk.dataset.rid);
      const oid = Number(chk.dataset.oid);
      const o = S.orders.find(x => x.id === oid);
      if (o && o.status === status) {
        if (!window._routeSel[rid]) window._routeSel[rid] = new Set();
        window._routeSel[rid].add(oid); chk.checked = true;
      }
    });
    if (btn) { btn.style.background=col.ab; btn.style.color=col.ac; btn.style.borderColor=col.ab; }
  }
  updateRouteSelBar();
}

function saveRouteEmailConfig() {
  const body = document.getElementById('route-email-body')?.value.trim() || '';
  localStorage.setItem('route_email_body', body);
  toast('✅ Configuración de correo guardada');
  document.getElementById('email-route-body').style.display = 'none';
}

async function shareRouteSelEmail() {
  let allSel = [];
  Object.entries(window._routeSel||{}).forEach(([rid, set]) => set.forEach(id => allSel.push(id)));
  if (!allSel.length) return toast('Selecciona al menos un pedido primero','#f59e0b');

  const allSelArr = Object.entries(window._routeSel||{}).map(([rid,set])=>({rid:Number(rid),oids:[...set]}));
  // Asunto = nombre de la ruta seleccionada
  let subject = 'Informe de Ruta';
  const _rutasSel = allSelArr.map(x => S.routes.find(r=>Number(r.id)===Number(x.rid))).filter(Boolean);
  if (_rutasSel.length === 1) {
    subject = _rutasSel[0].name;
  } else if (_rutasSel.length > 1) {
    subject = _rutasSel.map(r=>r.name).join(', ');
  }
  const bodyText = localStorage.getItem('route_email_body') || '';
  let htmlContent = null;
  if (allSelArr.length === 1) {
    htmlContent = generateRouteReport(allSelArr[0].rid, allSelArr[0].oids, true);
  } else {
    let orders = [];
    allSelArr.forEach(({oids}) => oids.forEach(oid => { const o=S.orders.find(x=>x.id===oid); if(o) orders.push(o); }));
    const tempRid = -99;
    const subj2 = localStorage.getItem('route_email_subject') || 'Seleccionados';
    S.routes = [...S.routes, { id: tempRid, name: subj2, orders: orders.map(o=>o.id) }];
    htmlContent = generateRouteReport(tempRid, orders.map(o=>o.id), true);
    S.routes = S.routes.filter(r=>r.id !== tempRid);
  }
  if (!htmlContent) return toast('No se pudo generar el informe','#ef4444');

  const fileName = (subject.replace(/[^a-zA-Z0-9]/g,'_') || 'Informe_Ruta') + '.html';
  const blob = new Blob([htmlContent], {type:'text/html;charset=utf-8'});
  const file = new File([blob], fileName, {type:'text/html'});

  if (navigator.share && navigator.canShare && navigator.canShare({files:[file]})) {
    try { await navigator.share({ title: subject, text: bodyText, files: [file] }); return; }
    catch(e) { if (e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => { URL.revokeObjectURL(url); window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`; }, 800);
}

function clearAllRouteSel() {
  window._routeSel = {};
  document.querySelectorAll('.route-ord-chk').forEach(chk => chk.checked = false);
  ['Cotización','Confirmado','Concluido'].forEach(s => { _routeStatusActive[s]=false; });
  const r = {Cotización:{b:'#64748b',c:'#94a3b8'}, Confirmado:{b:'#1d4ed8',c:'#60a5fa'}, Concluido:{b:'#15803d',c:'#4ade80'}};
  const m = {Cotización:'rut-btn-cot', Confirmado:'rut-btn-con', Concluido:'rut-btn-fin'};
  Object.entries(m).forEach(([s,id])=>{ const b=document.getElementById(id); if(b){b.style.background='transparent';b.style.color=r[s].c;b.style.borderColor=r[s].b;} });
  updateRouteSelBar();
}

function printAllRouteSel() {
  // Recolectar todos los pedidos seleccionados de todas las rutas
  let allSel = [];
  Object.entries(window._routeSel||{}).forEach(([rid, set]) => {
    if (set.size > 0) allSel.push({ rid: Number(rid), oids: [...set] });
  });
  if (!allSel.length) return toast('Selecciona al menos un pedido','#f59e0b');
  // Si son de una sola ruta, usar generateRouteReport
  if (allSel.length === 1) {
    generateRouteReport(allSel[0].rid, allSel[0].oids);
  } else {
    // Varias rutas: generar reporte combinado
    generateCombinedRouteReport(allSel);
  }
}

function generateCombinedRouteReport(allSel) {
  // Recopilar todos los pedidos en orden
  let orders = [];
  allSel.forEach(({rid, oids}) => {
    oids.forEach(oid => {
      const o = S.orders.find(x=>x.id===oid);
      if (o) orders.push(o);
    });
  });
  if (!orders.length) return toast('Sin pedidos seleccionados','#ef4444');
  // Reusar generateRouteReport con override de orders
  // Crear ruta temporal
  const tempRid = -1;
  const _routeSubj2 = localStorage.getItem('route_email_subject') || 'Seleccionados';
  const tempRoute = { id: tempRid, name: _routeSubj2, orders: orders.map(o=>o.id) };
  const origRoutes = S.routes;
  S.routes = [...S.routes, tempRoute];
  generateRouteReport(tempRid, orders.map(o=>o.id));
  S.routes = origRoutes;
}

// ── Informe de ruta solo con seleccionados ──────────────────

function generateRouteReport(rid, selIds, returnHTML=false) {
  const route = S.routes.find(r=>r.id===rid); if(!route) return;
  if (!route.orders) route.orders = [];
  let orders = route.orders.map(id=>S.orders.find(o=>o.id===id)).filter(Boolean);
  if (selIds) orders = orders.filter(o => selIds.includes(o.id));
  if (!orders.length) { toast('La ruta no tiene pedidos','#ef4444'); return; }

  // Aplicar el mismo orden configurado en la vista
  const rSortRaw = (S.routeOrdSort||{})[rid] || {s1:'default',s2:'none',s3:'none'};
  const rSort1 = typeof rSortRaw==='object' ? (rSortRaw.s1||'default') : rSortRaw;
  const rSort2 = typeof rSortRaw==='object' ? (rSortRaw.s2||'none')    : 'none';
  const rSort3 = typeof rSortRaw==='object' ? (rSortRaw.s3||'none')    : 'none';
  const _gsv = (o,key) => {
    const cli = S.clients.find(c=>c.id===o.clientId)||{};
    const munOrder  = (S.routeMunOrder  && S.routeMunOrder[rid]) || null;
    if (key==='alpha')  return (o.clientName||'').toLowerCase();
    if (key==='dept')   return ((S.depts||[]).find(x=>x.id===cli.deptId)||{name:''}).name.toLowerCase();
    if (key==='mun') {
      const m = (S.municipios||[]).find(x=>x.id===cli.municipioId);
      let rank = 999999;
      if (munOrder) { const ix = munOrder.indexOf(Number(cli.municipioId)); if (ix!==-1) rank = ix; }
      return String(rank).padStart(6,'0') + '_' + (m?m.name.toLowerCase():'');
    }
    if (key==='ruta')   return ((S.rutasCliente||[]).find(x=>x.id===cli.rutaClienteId)||{name:''}).name.toLowerCase();
    if (key==='recent') return -ordDateTs(o);
    if (key==='old')    return  ordDateTs(o);
    return '';
  };
  const _cmp = (a,b,key) => {
    if (!key||key==='none') return 0;
    const va=_gsv(a,key), vb=_gsv(b,key);
    return typeof va==='string' ? va.localeCompare(vb,'es') : va-vb;
  };
  if (rSort1 !== 'default' && rSort1 !== 'manual') {
    orders.sort((a,b) => _cmp(a,b,rSort1) || _cmp(a,b,rSort2) || _cmp(a,b,rSort3));
  }
  const b = S.biz;
  // Total con IVA por pedido: si está en modo SAP, usa el convertido.
  function _ordDispTotal(o) {
    if (o.sapMode) { const sc = getSapCalcForOrder(o); return sc ? sc.totalConIva : 0; }
    const bv = orderTotal(o.items, o.clientId);
    return o.applyIva ? bv*1.12 : bv;
  }
  const tDisp = orders.reduce((s,o)=>s+_ordDispTotal(o),0);
  const tPend = orders.filter(o=>o.status==='Confirmado').reduce((s,o)=>s+_ordDispTotal(o),0);
  const tFact = orders.filter(o=>o.status==='Concluido').reduce((s,o)=>s+_ordDispTotal(o),0);

  const rows = orders.map((o, rIdx) => {
    const disp = _ordDispTotal(o);
    const sapCalc = o.sapMode ? getSapCalcForOrder(o) : null;
    const items = sapCalc ? sapCalc.items.map(r => `<tr>
        <td style="padding:5px 8px">${r.name}${r.specLabel?` <span style="color:#374151">(${r.specLabel})</span>`:''}</td>
        <td style="padding:5px 8px;text-align:center">${r.qty}</td>
        <td style="padding:5px 8px;text-align:right">${Q(r.sapPriceNoIva)}/${r.sapUnitLabel}<br><small style="color:#2563eb">+IVA</small></td>
        <td style="padding:5px 8px;text-align:right;font-weight:700">${Q(r.sapLineTotalWithIva)}</td>
      </tr>`).join('') : o.items.map(it => {
      const p  = S.products.find(x=>x.id===(it.productId||Number(it.pid)));
      const pr = (it.customPrice!=null)?it.customPrice:cliPrice(o.clientId,it.productId||it.pid,p?.basePrice||0);
      const us = itemUnitSizeFor(it, p);
      const ul = p?.unitLabel||'unidad';
      const sub = pr*us*Number(it.qty);
      return `<tr>
        <td style="padding:5px 8px">${p?p.name:'—'}${p?.presentation?` <span style="color:#374151">(${p.presentation})</span>`:''}</td>
        <td style="padding:5px 8px;text-align:center">${it.qty}</td>
        <td style="padding:5px 8px;text-align:right">${Q(pr)}/${ul}${o.applyIva?'<br><small style="color:#2563eb">+IVA: '+Q(pr*0.12)+'/'+ul+'</small>':''}</td>
        <td style="padding:5px 8px;text-align:right;font-weight:700">${Q(o.applyIva?sub*1.12:sub)}</td>
      </tr>`;
    }).join('');
    const cmts = (o.comments&&o.comments.length)?o.comments:(o.note?[o.note]:[]);
    const sc = o.status==='Concluido'?'#15803d':o.status==='Cotización'?'#64748b':'#1d4ed8';
    const metaExtra = [
      o.quote ? `<span style="font-size:13px;font-weight:800;color:#111">📋 Cot: <strong>${o.quote}</strong></span>` : '',
      o.oc    ? `<span style="font-size:13px;font-weight:800;color:#111">📄 OC: <strong>${o.oc}</strong></span>`    : ''
    ].filter(Boolean).join(' &nbsp;·&nbsp; ');
    const deliveryHtmlR = o.delivery ? `<div style="padding:4px 12px;font-size:16px;background:#f0f9ff;border-top:1px solid #bae6fd;color:#0369a1;font-weight:700">📍 Entrega: ${o.delivery}</div>` : '';
    // Bonificaciones
    const bonusRows = sapCalc ? sapCalc.bonusLines.map(r => `<tr style="background:#eff6ff">
        <td style="padding:5px 8px;color:#15803d"><small style="font-weight:700">${r.name}${r.specLabel?' ('+r.specLabel+')':''}</small>${r.ruleName&&r.ruleName!=='Manual'?`<br><small style="color:#6b7280">${r.ruleName}</small>`:''}</td>
        <td style="padding:5px 8px;text-align:center;color:#15803d">${r.qty}</td>
        <td style="padding:5px 8px;text-align:right;color:#15803d">${Q(r.sapPriceNoIva)}/${r.sapUnitLabel} <small>+IVA</small></td>
        <td style="padding:5px 8px;text-align:right;font-weight:700;color:#15803d">${Q(r.sapLineTotalWithIva)}</td>
      </tr>`).join('') : (o.bonusLines||[]).map(bl => {
      const p  = S.products.find(x=>x.id===Number(bl.productId));
      const ul = p?.unitLabel||'unidad';
      const us = itemUnitSizeFor(bl, p);
      const sub = (bl.price||0)*bl.qty*us;
      const _ivaTagB3 = o.applyIva ? ' <small>+IVA</small>' : '';
      return `<tr style="background:#eff6ff">
        <td style="padding:5px 8px;color:#15803d"><small style="font-weight:700">${p?p.name+' ('+p.presentation+')':'—'}</small>${bl.ruleName&&bl.ruleName!=='Manual'?`<br><small style="color:#6b7280">${bl.ruleName}</small>`:''}</td>
        <td style="padding:5px 8px;text-align:center;color:#15803d">${bl.qty}</td>
        <td style="padding:5px 8px;text-align:right;color:#15803d">${Q(bl.price||0)}/${ul}${_ivaTagB3}</td>
        <td style="padding:5px 8px;text-align:right;font-weight:700;color:#15803d">${Q(sub)}</td>
      </tr>`;
    }).join('');
    // Comentarios — primero amarillo, resto azul oscuro
    const cmtsHtml = cmts.length ? `<div style="padding:6px 12px;font-size:11px;background:#fffbeb;border-top:1px solid #fde68a;border-bottom:1px solid #fde68a">` +
      cmts.map((c,ci) => ci===0
        ? `<span style="color:#92400e;font-weight:800;background:#fef08a;padding:1px 4px;border-radius:3px">💬 ${c}</span>`
        : `<span style="color:#374151;font-weight:600">💬 ${c}</span>`
      ).join('<br>') + '</div>' : '';
    const bonusSep = bonusRows ? `<tr><td colspan="4" style="padding:2px 8px;font-size:10px;color:#15803d;border-top:2px dashed #86efac;font-weight:700;background:#eff6ff">─── BONIFICACIONES ───</td></tr>` : '';
    const _cliRoute = S.clients.find(c => c.id === o.clientId);
    const _idRoute = _cliRoute && _cliRoute.clientCode ? `ID: ${_cliRoute.clientCode} - ` : '';
    return `<div style="break-inside:avoid;margin-bottom:14px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
      <div style="background:#f9fafb;padding:8px 12px;border-bottom:1px solid #e5e7eb">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <span style="font-size:12px;color:#6b7280;font-weight:600">#${rIdx+1} &nbsp;</span><span style="font-weight:900;font-size:16px;color:${o.status==='Confirmado'?'#1d4ed8':o.status==='Concluido'?'#15803d':'#1e3a8a'}">${_idRoute}${o.clientName}</span>
          </div>
          <span style="font-size:11px;font-weight:700;color:${sc};border:1px solid ${sc};padding:1px 8px;border-radius:10px">${o.status}</span>
        </div>
        ${metaExtra ? `<div style="margin-top:5px">${metaExtra}</div>` : ''}
        ${o.quoteNote?`<div style="font-size:16px;color:#f59e0b;font-weight:700;margin-top:4px;padding:3px 7px;background:#fffbeb;border-left:3px solid #f59e0b;border-radius:3px">Fecha de entrega: ${fmtEntrega(o.quoteNote)}</div>`:''}
      </div>
      ${deliveryHtmlR}
      ${cmtsHtml}
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:#f3f4f6">
          <th style="padding:5px 8px;text-align:left">Producto</th>
          <th style="padding:5px 8px;text-align:center">Cant.</th>
          <th style="padding:5px 8px;text-align:right">P/Unidad</th>
          <th style="padding:5px 8px;text-align:right">Subtotal</th>
        </tr></thead>
        <tbody>${items}${bonusSep}${bonusRows}</tbody>
      </table>
      <div style="padding:5px 12px;text-align:right;font-weight:800;font-size:13px;border-top:1px solid #e5e7eb;background:#fafafa">
        TOTAL: ${Q(disp)}${(sapCalc||o.applyIva)?'<span style="font-size:10px;font-weight:400;color:#6b7280;margin-left:5px">(IVA incl.)</span>':''}${sapCalc?'<span style="font-size:9px;font-weight:700;color:#7c3aed;margin-left:6px">🧮 SAP</span>':''}
      </div>
    </div>`;
  }).join('');

// Resumen de productos
const prodTotals = {};
const prodWeights = {};
orders.forEach(o => {
  o.items.forEach(it => {
    const p = S.products.find(x=>x.id===(it.productId||Number(it.pid)));
    const key = (p ? p.name : '—');
    prodTotals[key] = (prodTotals[key]||0) + Number(it.qty);
    { const _w = it.specWeightKg != null ? it.specWeightKg : (p && p.weightKg); if (_w) prodWeights[key] = (prodWeights[key]||0) + Number(it.qty)*Number(_w); }
  });
});
const totalWeightKg = Object.values(prodWeights).reduce((s,w)=>s+w,0);
const prodSummaryRows = Object.entries(prodTotals)
  .sort((a,b)=>(prodWeights[b[0]]||0)-(prodWeights[a[0]]||0) || a[0].localeCompare(b[0],'es'))
  .map(([k,v])=>{
    const w = prodWeights[k];
    const wTxt = w ? ` (${w.toLocaleString('es-GT',{maximumFractionDigits:2})} kg)` : '';
    return `<div style="display:flex;justify-content:space-between;padding:3px 8px;font-size:12px;border-bottom:1px solid #f0f0f0"><span>${k}</span><strong style="margin-left:8px;white-space:nowrap">${v}${wTxt}</strong></div>`;
  })
  .join('');
const prodSummaryHTML = `<div style="margin-bottom:14px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
  <div style="background:#1e3a8a;color:#fff;padding:7px 12px;font-weight:800;font-size:13px">📦 Resumen de Productos</div>
  <div style="column-count:3;column-gap:0;column-rule:1px solid #e5e7eb">${prodSummaryRows}</div>
</div>`;

    const _emailSubject = route.name || localStorage.getItem('route_email_subject') || 'Informe de Ruta';
  const _emailBody    = localStorage.getItem('route_email_body') || '';
  const _mailtoHref   = 'mailto:?subject=' + encodeURIComponent(_emailSubject) + '&body=' + encodeURIComponent(_emailBody);

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Informe ${route.name}</title>
<style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;padding:14px;color:#111;font-size:17px}
.hdr{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid #111}
.sum{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px}
.sb{flex:1;min-width:100px;border:1px solid #e5e7eb;border-radius:7px;padding:8px;text-align:center}
.sb .l{font-size:13px;color:#6b7280;margin-bottom:3px}.sb .v{font-size:20px;font-weight:800}
table{font-size:17px}th,td{font-size:17px}
@media print{button{display:none!important}body{padding:6px}}</style>
</head><body>
<div class="hdr">
  <div>
    <div style="font-size:19px;font-weight:900">${b.name||'Mi Negocio'}</div>


  </div>
  <div style="text-align:right">
    <div style="font-size:16px;font-weight:800">🚚 ${route.name}</div>
    <div style="font-size:11px;color:#6b7280">Generado: ${fmtOrdDate((()=>{ const n=new Date(); return `${String(n.getDate()).padStart(2,'0')}/${String(n.getMonth()+1).padStart(2,'0')}/${n.getFullYear()}`; })())}</div>
  </div>
</div>
<div class="sum">
  <div class="sb"><div class="l">Pedidos</div><div class="v">${orders.length}</div></div>
  <div class="sb"><div class="l">TOTAL RUTA</div><div class="v" style="color:#d97706">${Q(tDisp)}</div></div>
  ${totalWeightKg > 0 ? `<div class="sb"><div class="l">PESO TOTAL</div><div class="v" style="color:#1d4ed8">${totalWeightKg.toLocaleString('es-GT',{maximumFractionDigits:2})} kg</div></div>` : ''}
</div>
<div style="margin-bottom:14px;display:flex;gap:16px;padding:0 12px">
  <button onclick="document.body.style.zoom=(parseFloat(document.body.style.zoom||1)-0.1).toFixed(1)" style="padding:16px 28px;background:#475569;color:#fff;border:none;border-radius:8px;font-size:32px;cursor:pointer;font-weight:700;line-height:1">－</button>
  <button onclick="window.print()" style="flex:1;padding:16px 4px;background:#1d4ed8;color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer;font-weight:700">🖨️ Imprimir / PDF</button>
  <button onclick="document.body.style.zoom=(parseFloat(document.body.style.zoom||1)+0.1).toFixed(1)" style="padding:16px 28px;background:#475569;color:#fff;border:none;border-radius:8px;font-size:32px;cursor:pointer;font-weight:700;line-height:1">＋</button>
</div>
${prodSummaryHTML}
${rows}

</body></html>`;
  if (returnHTML) return html;
  // Usar Blob URL para evitar bloqueo de popup en Chrome Android
  const blob = new Blob([html], {type:'text/html;charset=utf-8'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.target = '_blank';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}



// ── Trasladado desde el bloque "MODAL DE CONFIRMACIÓN" (mal etiquetado) ──
function renderGenRutaChips() {
  const wrap = document.getElementById('gen-ruta-checks');
  if (!wrap) return;
  const checked = new Set([...document.querySelectorAll('.gen-ruta-cb:checked')].map(cb=>cb.value));
  wrap.innerHTML = (S.rutasCliente || []).map(r => `
    <label style="display:flex;align-items:center;gap:5px;background:#0d2010;border:1px solid #1a3a1a;border-radius:8px;padding:5px 10px;cursor:pointer;font-size:13px;color:#f1f5f9">
      <input type="checkbox" class="gen-ruta-cb" value="${r.id}" ${checked.has(String(r.id))?'checked':''} style="accent-color:#10b981" onchange="onGenRutaChange()"/> ${r.name}
    </label>`).join('');
}

// Cascada: al cambiar la(s) Ruta(s) marcada(s), Departamento se refiltra por
// ellas y queda todo marcado por defecto (y Sector, que depende de
// Departamento, también)
function onGenRutaChange() {
  checkAllGenChipsAfterFilter('dept');
  checkAllGenChipsAfterFilter('mun');
  renderGenOrderList();
}

// Cascada: al cambiar el/los Departamento(s) marcado(s), Sector se refiltra
// por ellos y queda todo marcado por defecto
function onGenDeptChange() {
  checkAllGenChipsAfterFilter('mun');
  renderGenOrderList();
}

// Re-filtra un nivel de chips (según lo marcado en el nivel anterior) y
// deja todas sus opciones resultantes marcadas por defecto.
function checkAllGenChipsAfterFilter(type) {
  renderGenChips(type);
  document.querySelectorAll('.gen-'+type+'-cb').forEach(cb => cb.checked = true);
  renderGenChips(type);
}

// Botones "Seleccionar todos" / "Limpiar": actúan solo sobre su propio
// nivel; el siguiente nivel simplemente se refiltra, sin forzar su estado.
function selectAllGenChips(type) {
  document.querySelectorAll('.gen-'+type+'-cb').forEach(cb => cb.checked = true);
  renderGenChips(type);
  refreshGenChildLevels(type);
}

function clearGenChips(type) {
  document.querySelectorAll('.gen-'+type+'-cb').forEach(cb => cb.checked = false);
  renderGenChips(type);
  refreshGenChildLevels(type);
}

function refreshGenChildLevels(type) {
  if (type==='ruta') { renderGenChips('dept'); renderGenChips('mun'); }
  else if (type==='dept') { renderGenChips('mun'); }
  renderGenOrderList();
}

function renderGenChips(type) {
  const wrap = document.getElementById('gen-'+type+'-checks');
  if (!wrap) return;
  const q    = (document.getElementById('gen-'+type+'-search')?.value||'').toLowerCase();
  let list = type==='dept' ? (S.depts||[]) : (S.municipios||[]);
  const cls  = 'gen-'+type+'-cb';
  const col  = type==='dept' ? '#10b981' : '#7c3aed';
  const bg   = type==='dept' ? '#0d1f0d' : '#0d0d1f';
  const bdr  = type==='dept' ? '#1a3a1a' : '#1a1a3a';

  // Cascada: Departamento se filtra por la(s) Ruta(s) marcada(s);
  // Sector se filtra por el/los Departamento(s) marcado(s).
  // Si no hay nada marcado en el nivel anterior, se muestran todas
  // las opciones (igual que hoy: "vacío = todos").
  if (type === 'dept') {
    const selRutas = [...document.querySelectorAll('.gen-ruta-cb:checked')].map(cb => Number(cb.value));
    if (selRutas.length) list = list.filter(d => (d.rutaIds||[]).some(rid => selRutas.includes(rid)));
  } else {
    const selDepts = [...document.querySelectorAll('.gen-dept-cb:checked')].map(cb => Number(cb.value));
    if (selDepts.length) list = list.filter(m => (m.deptIds||[]).some(did => selDepts.includes(did)));
  }

  if (!list.length) {
    const msg = type==='dept' ? 'Sin departamentos en la(s) ruta(s) marcada(s)' : 'Sin sectores en el/los departamento(s) marcado(s)';
    wrap.innerHTML = '<span style="font-size:11px;color:#64748b">'+msg+'</span>';
    return;
  }
  // Mantener estado de checks existentes antes de re-render
  const checked = new Set([...document.querySelectorAll('.'+cls+':checked')].map(cb=>cb.value));
  const filtered = q ? list.filter(x=>x.name.toLowerCase().includes(q)) : list;
  if (!filtered.length) { wrap.innerHTML='<span style="font-size:11px;color:#64748b">Sin resultados</span>'; return; }
  const cascadeCall = type==='dept' ? ';onGenDeptChange()' : ';renderGenOrderList()';
  wrap.innerHTML = filtered.map(x=>
    `<label style="display:flex;align-items:center;gap:5px;background:${checked.has(String(x.id))?col+'33':bg};border:1px solid ${checked.has(String(x.id))?col:bdr};border-radius:8px;padding:6px 10px;cursor:pointer;font-size:12px;color:#f1f5f9;transition:all .15s" onclick="this.querySelector('input').checked=!this.querySelector('input').checked;this.style.background=this.querySelector('input').checked?'${col}33':'${bg}';this.style.borderColor=this.querySelector('input').checked?'${col}':'${bdr}'${cascadeCall}">
      <input type="checkbox" class="${cls}" value="${x.id}" ${checked.has(String(x.id))?'checked':''} style="width:15px;height:15px;accent-color:${col};pointer-events:none"/> ${x.name}
    </label>`
  ).join('');
}

function filterGenChips(type) { renderGenChips(type); }

// ── Orden de visita de Sectores, definido al generar ──
// Vive en el panel "Generar Pedidos": lista plana (sin agrupar por
// Departamento) que se arrastra para definir el orden y se guarda
// asociada a la ruta que se está creando en ese momento.
//
// Además, cada vez que arrastras, se actualiza S.genMunOrderTemplate: una
// plantilla general que recuerda tu orden preferido de Sectores y se usa
// para pre-ordenar automáticamente la próxima vez que generes cualquier
// ruta, para no tener que rehacerlo cada vez.
function resetGenOrderState() {
  window._genMunOrder = [];
}

// Al abrir el panel "Generar Pedidos" desde cero: Ruta queda vacía (sin
// selección), pero Departamento y Sector inician con todo marcado por
// defecto. Debe llamarse después de renderRoutes(), para que los chips
// ya existan en el DOM.
function applyGenDefaultSelection() {
  checkAllGenChipsAfterFilter('dept');
  checkAllGenChipsAfterFilter('mun');
  renderGenOrderList();
}

function renderGenOrderList() {
  const wrap = document.getElementById('gen-order-list');
  if (!wrap) return;
  const selDepts = [...document.querySelectorAll('.gen-dept-cb:checked')].map(cb => Number(cb.value));
  const selMuns  = [...document.querySelectorAll('.gen-mun-cb:checked')].map(cb => Number(cb.value));

  if (!selDepts.length) {
    wrap.innerHTML = '<div style="font-size:11px;color:#64748b">Marca uno o más Departamentos arriba para poder definir el orden de sus Sectores.</div>';
    return;
  }

  // Sectores relevantes: los marcados en el filtro Sector (si hay alguno);
  // si no se marcó ninguno, todos los de los Departamentos marcados.
  const munsOfDepts = (S.municipios||[]).filter(m => (m.deptIds||[]).some(did => selDepts.includes(did)));
  const checkedMuns = munsOfDepts.filter(m => selMuns.includes(m.id));
  const relevantMuns = checkedMuns.length ? checkedMuns : munsOfDepts;
  const relevantIds = relevantMuns.map(m=>m.id);

  if (!window._genMunOrder) window._genMunOrder = [];
  // Conservar el orden ya arrastrado en esta sesión; quitar lo que ya no aplica
  window._genMunOrder = window._genMunOrder.filter(id => relevantIds.includes(id));
  // Los sectores relevantes que aún no están en esta sesión, se agregan
  // siguiendo la plantilla guardada (si la tienen) para no partir de cero
  const template = S.genMunOrderTemplate || [];
  const fromTemplate = template.filter(id => relevantIds.includes(id) && !window._genMunOrder.includes(id));
  window._genMunOrder = [...window._genMunOrder, ...fromTemplate];
  // Cualquier sector relevante que ni siquiera esté en la plantilla, al final
  relevantIds.forEach(id => { if (!window._genMunOrder.includes(id)) window._genMunOrder.push(id); });

  const munRows = window._genMunOrder.map(mid => {
    const m = (S.municipios||[]).find(x=>x.id===mid);
    if (!m) return '';
    return `<div class="sortable-item gen-mun-order-item" data-id="${mid}" style="display:flex;align-items:center;gap:6px;background:#0d0d1f;border:1px solid #1a1a3a;border-radius:6px;padding:5px 9px;margin-bottom:4px">
      <span class="drag-handle" style="font-size:14px">≡</span>
      <span style="flex:1;font-size:12px;color:#f1f5f9">🏘️ ${m.name}</span>
    </div>`;
  }).join('');

  wrap.innerHTML = `<div style="font-size:10px;color:#64748b;margin-bottom:6px">Mantén presionado ≡ para arrastrar. Este orden se recuerda para las próximas rutas que generes.</div>${munRows||'<div style="font-size:11px;color:#64748b">Sin sectores para ordenar.</div>'}`;

  setupDrag(wrap, saveGenMunOrderFromDOM, 'gen-mun-order-item');
}

function saveGenMunOrderFromDOM(container) {
  const ids = [...container.querySelectorAll('.gen-mun-order-item')].map(el => Number(el.dataset.id));
  window._genMunOrder = ids;
  // Actualizar la plantilla general reutilizable: el grupo recién ordenado
  // se reubica al final de la plantilla, en su nuevo orden relativo; lo
  // demás que ya estaba en la plantilla conserva su posición entre sí.
  if (!S.genMunOrderTemplate) S.genMunOrderTemplate = [];
  const rest = S.genMunOrderTemplate.filter(id => !ids.includes(id));
  S.genMunOrderTemplate = [...rest, ...ids];
  save();
}

function toggleGenSection(bodyId, arrowId) {
  const body = document.getElementById(bodyId);
  const arrow = document.getElementById(arrowId);
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if (arrow) arrow.textContent = open ? '▼' : '▲';
}

function generateRouteOrdersFromPanel() {
  const routeName = document.getElementById('gen-route-name')?.value.trim();
  const selDepts = [...document.querySelectorAll('.gen-dept-cb:checked')].map(cb => Number(cb.value));
  const selMuns  = [...document.querySelectorAll('.gen-mun-cb:checked')].map(cb => Number(cb.value));
  const selRutas = [...document.querySelectorAll('.gen-ruta-cb:checked')].map(cb => Number(cb.value));

  if (!routeName) { toast('Escribe el nombre de la nueva ruta', '#f59e0b'); return; }

  if (!S.routes) S.routes = [];
  if (!S.nextRid) S.nextRid = (S.routes.length ? Math.max(...S.routes.map(r=>r.id)) + 1 : 1);
  const newRoute = { id: S.nextRid++, name: routeName, orders: [] };
  S.routes.push(newRoute);

  // Guardar el orden manual de Sectores definido en el panel, asociado a
  // esta ruta (se usará al ordenar sus pedidos por Sector). Es una lista
  // plana, no agrupada por Departamento.
  if (!S.routeMunOrder) S.routeMunOrder = {};
  if (window._genMunOrder && window._genMunOrder.length) {
    S.routeMunOrder[newRoute.id] = [...window._genMunOrder];
  }

  generateRouteOrders(newRoute.id, routeName, selDepts, selMuns, selRutas);
  document.getElementById('gen-route-name').value = '';
  resetGenOrderState();
}

function generateRouteOrders(rid, routeTitle, selDepts, selMuns, selRutas) {
  const r = S.routes.find(x => x.id === rid);
  if (!r) return;

  let clis = [...S.clients];
  if (selRutas && selRutas.length) clis = clis.filter(c => selRutas.includes(Number(c.rutaClienteId)));
  if (selDepts && selDepts.length) clis = clis.filter(c => selDepts.map(Number).includes(Number(c.deptId)));
  if (selMuns  && selMuns.length)  clis = clis.filter(c => selMuns.map(Number).includes(Number(c.municipioId)));
  // Excluir clientes marcados para no incluirse en la generación automática de rutas
  clis = clis.filter(c => !c.isProspect && !isClientBlocked(c) && !isPriorityExcludedFromRoute(c.priority));

  if (!clis.length) {
    toast("⚠️ No hay clientes que coincidan con los filtros seleccionados.", "#f59e0b");
    return;
  }

  const msg = "Se crearán " + clis.length + " pedido(s) en Cotización para la ruta \"" + r.name + "\". ¿Continuar?";

  askConfirm('🚀 Generar pedidos de ruta', msg, () => {
    if (!r.orders) r.orders = [];
    const now = nowDateTimeStr();

    clis.forEach(c => {
      // Todos los pedidos históricos del cliente, ordenados por más reciente
      const histOrdenes = [...S.orders]
        .filter(o => Number(o.clientId) === c.id)
        .sort((a,b) => { const td = ordDateTs(b)-ordDateTs(a); return td !== 0 ? td : b.id-a.id; });

      // Construir lista de productos únicos de TODO el historial del cliente
      // Para cada producto, usar el precio más reciente
      const productMap = new Map(); // productId → item
      // Recorrer pedidos del más antiguo al más reciente para que el precio reciente sobreescriba
      [...histOrdenes].reverse().forEach(o => {
        (o.items || []).forEach(it => {
          const pid = it.productId || it.pid;
          productMap.set(String(pid), { ...it, productId: Number(pid) });
        });
      });
      const items = [...productMap.values()];

      // Configuración IVA del último pedido
      const lastOrd = histOrdenes[0];
      const applyIva      = lastOrd?.applyIva      || false;
      const pricesIncIva  = lastOrd?.pricesIncIva  || false;

      // Comentarios anclados del cliente
      const pinnedComs = (S.savedComments && S.savedComments[c.id]) || [];
      const comments   = Array.isArray(pinnedComs) ? [...pinnedComs] : [];

      // Dirección de entrega: solo precargar si tiene exactamente una dirección sin favorita
      const _cliAddrs = (S.savedAddresses && S.savedAddresses[c.id]) || [];
      const _defIdx = S.defaultAddresses && S.defaultAddresses[c.id] !== undefined ? S.defaultAddresses[c.id] : null;
      let delivery = '';
      if (_defIdx === null && _cliAddrs.length === 1) {
        delivery = _cliAddrs[0]; // Solo una dirección → precargar
      }
      // Si tiene favorita o varias → dejar vacío para confirmar al editar

      const newOrd = {
        id:          genId(),
        clientId:    c.id,
        clientName:  c.name,
        items,
        bonusLines:  [],
        status:      'Cotización',
        date:        now,
        routeId:     rid,
        routeTitle:  routeTitle || '',
        applyIva,
        pricesIncIva,
        quote:       '',
        oc:          '',
        delivery,
        comments
      };
      S.orders.push(newOrd);
      r.orders.push(newOrd.id);
    });

    save();
    renderRoutes();
    window._routeOpen[rid] = true;
    renderRoutes();
    const ti = document.getElementById('gen-route-title');
    if (ti) ti.value = '';
    collapseForm('gen-route-body');
    toast('✅ ' + clis.length + ' pedido(s) generados en Cotización', '#10b981');
  }, '🚀 Generar', '#10b981');
}

function deleteRoute(rid) {
  const r = S.routes.find(x => x.id === rid); if (!r) return;
  if (!r.orders) r.orders = [];
  const n = r.orders.length;
  const inner = document.querySelector('#confirm-modal > div');
  if (!inner) return;
  inner.innerHTML = `
    <div style="font-size:28px;margin-bottom:8px">🚚</div>
    <div style="font-size:15px;font-weight:700;color:#f1f5f9;margin-bottom:6px">Eliminar ruta "${r.name}"</div>
    <div style="font-size:12px;color:#94a3b8;margin-bottom:18px">${n} pedido(s) en esta ruta. ¿Qué hacer con ellos?</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <button onclick="confirmDel(false)" style="padding:10px;border-radius:9px;border:1px solid #475569;background:transparent;color:#f1f5f9;font-weight:700;cursor:pointer;font-size:13px">Cancelar</button>
      <button onclick="window._routeDelCb('unlink')" style="padding:10px;border-radius:9px;border:none;background:#3b82f6;color:#fff;font-weight:800;cursor:pointer;font-size:13px">🔗 Solo desvincular pedidos (los conserva)</button>
      <button onclick="window._routeDelCb('delete')" style="padding:10px;border-radius:9px;border:none;background:#ef4444;color:#fff;font-weight:800;cursor:pointer;font-size:13px">🗑 Eliminar ruta Y pedidos</button>
    </div>`;
  document.getElementById('confirm-modal').style.display = 'flex';
  window._routeDelCb = (action) => {
    document.getElementById('confirm-modal').style.display = 'none';
    inner.innerHTML = ''; // reset para próximo uso
    if (action === 'unlink') {
      r.orders.forEach(oid => { const o = S.orders.find(x=>x.id===oid); if (o) { delete o.routeId; delete o.routeTitle; } });
    } else if (action === 'delete') {
      r.orders.forEach(oid => { S.orders = S.orders.filter(x=>x.id!==oid); });
    }
    S.routes = S.routes.filter(x => x.id !== rid);
    save(); renderRoutes(); toast('🗑 Ruta eliminada');
  };
}

function removeOrderFromRoute(oid, rid) {
  const inner = document.querySelector('#confirm-modal > div');
  if (!inner) return;
  const _o = S.orders.find(x=>x.id===oid);
  const _cliName = _o ? _o.clientName : '—';
  const _prodDesc = _o ? _o.items.map(it=>{const p=S.products.find(x=>x.id===(it.productId||Number(it.pid)));return (p?p.name:'—')+' ×'+it.qty;}).join(', ') : '';
  const _tot = _o ? Q(_o.applyIva ? orderTotal(_o.items,_o.clientId)*1.12 : orderTotal(_o.items,_o.clientId)) : '';
  inner.innerHTML = `
    <div style="font-size:28px;margin-bottom:8px">📦</div>
    <div style="font-size:15px;font-weight:700;color:#f1f5f9;margin-bottom:4px">Quitar pedido de la ruta</div>
    <div style="font-size:13px;font-weight:700;color:#f59e0b;margin-bottom:2px">${_cliName}</div>
    <div style="font-size:11px;color:#94a3b8;margin-bottom:2px">${_prodDesc}</div>
    <div style="font-size:12px;color:#4ade80;margin-bottom:14px">${_tot}</div>
    <div style="font-size:12px;color:#94a3b8;margin-bottom:14px">¿Qué deseas hacer con este pedido?</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <button onclick="confirmDel(false)" style="padding:10px;border-radius:9px;border:1px solid #475569;background:transparent;color:#f1f5f9;font-weight:700;cursor:pointer;font-size:13px">Cancelar</button>
      <button onclick="window._ordRouteCb('unlink')" style="padding:10px;border-radius:9px;border:none;background:#3b82f6;color:#fff;font-weight:800;cursor:pointer;font-size:13px">🔗 Solo desvincular (conservar pedido)</button>
      <button onclick="window._ordRouteCb('delete')" style="padding:10px;border-radius:9px;border:none;background:#ef4444;color:#fff;font-weight:800;cursor:pointer;font-size:13px">🗑 Eliminar pedido por completo</button>
    </div>`;
  document.getElementById('confirm-modal').style.display = 'flex';
  window._ordRouteCb = (action) => {
    document.getElementById('confirm-modal').style.display = 'none';
    inner.innerHTML = '';
    const r = S.routes.find(x=>x.id===rid);
    if (r) r.orders = (r.orders||[]).filter(x=>x!==oid);
    if (action === 'unlink') {
      const o = S.orders.find(x=>x.id===oid);
      if (o) { delete o.routeId; delete o.routeTitle; }
    } else if (action === 'delete') {
      S.orders = S.orders.filter(x=>x.id!==oid);
    }
    save(); renderRoutes(); toast(action==='delete'?'🗑 Pedido eliminado':'Pedido desvinculado de la ruta');
  };
}

function openQuoteFromRoute(oid) {
  const o = S.orders.find(x => x.id === oid);
  if (!o) return;
  showQuote(o);
}

