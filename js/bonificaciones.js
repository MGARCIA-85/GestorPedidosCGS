// ═══════════════════════════════════════════════════════
//  BONIFICACIONES
// ═══════════════════════════════════════════════════════

// Calcula unidades acumuladas de una regla para un cliente
function calcBonusProgress(cid, r, extraOrd) {
  // Si hay resetTs usar timestamp exacto, sino usar startDate
  const resetTs = r.resetTs ? new Date(r.resetTs).getTime() : null;
  const startDateStr = r.startDate || '2000-01-01';

  // Obtener índice de la regla para excluir pedidos que la rechazaron
  const ruleIdx = (S.bonuses[cid]||[]).indexOf(r);

  const _includedCids = [Number(cid), ...(r.extraClientIds||[]).map(Number)];
  let orders = S.orders.filter(o =>
    _includedCids.includes(Number(o.clientId)) &&
    (o.status==='Confirmado'||o.status==='Concluido') &&
    !(o.bonusDeclined && ruleIdx >= 0 && o.bonusDeclined.includes(ruleIdx))
  );
  if (extraOrd && !orders.find(o=>o.id===extraOrd.id)) {
    // Solo incluir extraOrd si no rechazó esta regla
    const extraDeclined = extraOrd.bonusDeclined || [];
    if (!(ruleIdx >= 0 && extraDeclined.includes(ruleIdx))) {
      orders = [...orders, extraOrd];
    }
  }

  // Convierte fecha del pedido a timestamp usando el ID del pedido como proxy de orden
  // El ID es autoincremental, así que pedidos más nuevos tienen ID mayor
  function orderPassesFilter(o) {
    const parts = (o.date||'').split('/');
    let oDateStr = '';
    if (parts.length >= 3) {
      const d = parseInt(parts[0]), m = parseInt(parts[1]), y = parseInt(parts[2]);
      oDateStr = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    }
    // Filtrar por vigencia de la regla
    if (r.vigenciaStart && oDateStr && oDateStr < r.vigenciaStart) return false;
    if (r.vigenciaEnd   && oDateStr && oDateStr > r.vigenciaEnd)   return false;

    if (resetTs) {
      const resetOid = r._resetOid || 0;
      return o.id > resetOid;
    }
    if (!oDateStr) return true;
    return oDateStr >= startDateStr;
  }

  if (r.ruleType === 'mix') {
    const results = [];
    // Umbrales individuales
    (r.mixIndTargets||[]).forEach(t => {
      let appUnits = 0;
      orders.forEach(o => {
        if (!orderPassesFilter(o)) return;
        o.items.forEach(it => {
          if (Number(it.productId||it.pid) === t.productId) appUnits += Number(it.qty);
        });
      });
      const prod = S.products.find(x=>x.id===t.productId);
      results.push({ label: prod?prod.name:'Producto', app: appUnits, manual: 0, threshold: t.threshold });
    });
    // Pool compartido
    if ((r.mixPoolProds||[]).length && r.mixPoolThreshold) {
      let totalMixPool = 0;
      (r.mixPoolProds||[]).forEach(pid => {
        let qty = 0;
        orders.forEach(o => {
          if (!orderPassesFilter(o)) return;
          o.items.forEach(it => { if (Number(it.productId||it.pid)===pid) qty+=Number(it.qty); });
        });
        const prod = S.products.find(x=>x.id===pid);
        totalMixPool += qty;
        results.push({ label: prod?prod.name:'Producto', app: qty, manual: 0, threshold: null, isDetail: true });
      });
      results.push({ label: 'Pool compartido', app: totalMixPool, manual: Number(r.manualUnits)||0, threshold: r.mixPoolThreshold, isPool: true, mixPoolTitle: r.mixPoolTitle });
    }
    // Pool con equivalencias
    if ((r.mixEqProds||[]).length && r.mixEqThreshold) {
      let appUnits = 0;
      orders.forEach(o => {
        if (!orderPassesFilter(o)) return;
        o.items.forEach(it => {
          const pid = Number(it.productId||it.pid);
          const ep = (r.mixEqProds||[]).find(x => x.productId === pid);
          if (ep) appUnits += Number(it.qty) * (Number(ep.factor)||1);
        });
      });
      let totalEqMix = 0;
      (r.mixEqProds||[]).forEach(ep => {
        let qty = 0;
        orders.forEach(o => {
          if (!orderPassesFilter(o)) return;
          o.items.forEach(it => { if (Number(it.productId||it.pid) === ep.productId) qty += Number(it.qty); });
        });
        const prod = S.products.find(x=>x.id===ep.productId);
        const equiv = Math.round(qty * (Number(ep.factor)||1) * 100) / 100;
        totalEqMix += equiv;
        results.push({ label: (prod?prod.name:'Producto')+' ×'+ep.factor, app: qty, manual: 0, threshold: null, isDetail: true, equiv, productId: ep.productId, factor: ep.factor, unitLabel: ep.unitLabel||'' });
      });
      results.push({ label: 'Total pool equivalencias', app: Math.round(totalEqMix*100)/100, manual: Number(r.manualUnits)||0, threshold: r.mixEqThreshold, isPool: true, isPoolEq: true, mixEqTitle: r.mixEqTitle });
    }
    if (!results.length) return [{ label: 'Sin metas', app: 0, manual: 0, threshold: 1 }];
    return results;

  } else if (r.ruleType === 'poolEq') {
    let totalEq = 0;
    const detalle = (r.poolEqProds||[]).map(ep => {
      let qty = 0;
      orders.forEach(o => {
        if (!orderPassesFilter(o)) return;
        o.items.forEach(it => { if (Number(it.productId||it.pid) === ep.productId) qty += Number(it.qty); });
      });
      const prod = S.products.find(x=>x.id===ep.productId);
      const equiv = Math.round(qty * (Number(ep.factor)||1) * 100) / 100;
      totalEq += equiv;
      return { label: (prod?prod.name:'Producto')+' ×'+ep.factor, app: qty, manual: 0, threshold: null, isDetail: true, equiv, productId: ep.productId, factor: ep.factor, unitLabel: ep.unitLabel||'' };
    });
    const totalRow = { label: r.poolLabel||'Total pool', app: Math.round(totalEq*100)/100, manual: Number(r.manualUnits)||0, threshold: r.threshold, isPool: true };
    return [...detalle, totalRow];

  } else if (r.ruleType === 'pool') {
    let totalPool = 0;
    const detalle = (r.poolProds||[]).map(pid => {
      let qty = 0;
      orders.forEach(o => {
        if (!orderPassesFilter(o)) return;
        o.items.forEach(it => { if (Number(it.productId||it.pid) === pid) qty += Number(it.qty); });
      });
      const prod = S.products.find(x=>x.id===pid);
      totalPool += qty;
      return { label: prod?prod.name:'Producto', app: qty, manual: 0, threshold: null, isDetail: true };
    });
    const totalRow = { label: r.poolLabel||'Total', app: totalPool, manual: Number(r.manualUnits)||0, threshold: r.threshold, isPool: true };
    return [...detalle, totalRow];

  } else {
    return (r.targets||[]).map((t,ti) => {
      let appUnits = 0;
      orders.forEach(o => {
        if (!orderPassesFilter(o)) return;
        o.items.forEach(it => {
          if (Number(it.productId||it.pid) === Number(t.productId)) appUnits += Number(it.qty);
        });
      });
      const p = S.products.find(x=>x.id===Number(t.productId));
      return { label: p ? p.name+'': '—', app: appUnits, manual: Number(t.manualUnits)||0, threshold: t.threshold, ti };
    });
  }
}

// Retorna true si TODOS los contadores de la regla están cumplidos
function isBonusComplete(cid, r, extraOrd) {
  const progress = calcBonusProgress(cid, r, extraOrd);
  return progress.every(p => (p.app + p.manual) >= p.threshold);
}

function closeBonusModal() {
  document.getElementById('bonus-modal').style.display = 'none';
}

let _brExtraClients = [];

function brSearchExtraClients() {
  const txt = document.getElementById('br-extra-cli-search');
  const drop = document.getElementById('br-extra-cli-drop');
  if (!txt || !drop) return;
  const currentCid = Number(document.getElementById('bonus-modal')?.dataset.cid);
  const q = normalizeStr(txt.value.trim());
  const matches = S.clients.filter(c =>
    Number(c.id) !== currentCid &&
    !_brExtraClients.includes(c.id) &&
    (q.length===0 || normalizeStr(c.name).includes(q))
  ).slice(0, 30);
  drop.innerHTML = '';
  if (!matches.length) { drop.innerHTML = '<div class="ac-empty">Sin resultados</div>'; acOpen('br-extra-cli-drop'); return; }
  matches.forEach(c => {
    const d = document.createElement('div');
    d.className = 'ac-opt';
    d.textContent = c.name;
    d.style.color = getPriorityColor(c.priority) || ''; d.style.textDecoration = isPriorityBlocking(c.priority) ? 'line-through' : '';
    d.onmousedown = () => {
      _brExtraClients.push(c.id);
      txt.value = '';
      acClose('br-extra-cli-drop');
      brRenderExtraClientChips();
    };
    drop.appendChild(d);
  });
  acOpen('br-extra-cli-drop');
}

function brRenderExtraClientChips() {
  const wrap = document.getElementById('br-extra-cli-chips');
  if (!wrap) return;
  wrap.innerHTML = '';
  _brExtraClients.forEach(cid => {
    const c = S.clients.find(x=>x.id===cid);
    if (!c) return;
    const chip = document.createElement('div');
    chip.style.cssText = 'display:flex;align-items:center;gap:5px;background:#1e2236;border:1px solid #2a3050;border-radius:20px;padding:4px 6px 4px 12px;font-size:12px;color:#f1f5f9';
    chip.innerHTML = `<span>${c.name}</span>`;
    const btn = document.createElement('button');
    btn.textContent = '✕';
    btn.style.cssText = 'background:none;border:none;color:#ef4444;cursor:pointer;font-size:13px;padding:2px 4px';
    btn.onclick = () => {
      _brExtraClients = _brExtraClients.filter(x=>x!==cid);
      brRenderExtraClientChips();
    };
    chip.appendChild(btn);
    wrap.appendChild(chip);
  });
}

function toggleBrSection(id) {
  const body = document.getElementById(id);
  const arrow = document.getElementById(id + '-arrow');
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if (arrow) arrow.textContent = open ? '▶' : '▼';
}

function openBonusModal(cid, ri) {
  if (!S.bonuses) S.bonuses = {};
  if (!S.bonuses[cid]) S.bonuses[cid] = [];
  const isEdit = ri !== null && ri !== undefined;
  let r = isEdit ? S.bonuses[cid][ri] : { ruleType:'mix', name:'', mixIndTargets:[], mixPoolProds:[], mixEqProds:[], bonusItems:[], deadline:'', startDate: new Date().toISOString().split('T')[0], extraClientIds:[] };
  _brExtraClients = (r.extraClientIds||[]).slice();

  // Migrar reglas antiguas (individual/pool/poolEq) al formato MIX unificado, sin perder su configuración
  if (isEdit && r.ruleType !== 'mix') {
    if (r.ruleType === 'individual') {
      r = { ...r, ruleType:'mix', mixIndTargets: r.targets||[], mixPoolProds:[], mixPoolThreshold:null, mixEqProds:[], mixEqThreshold:null };
    } else if (r.ruleType === 'pool') {
      r = { ...r, ruleType:'mix', mixIndTargets:[], mixPoolProds: r.poolProds||[], mixPoolThreshold: r.threshold, mixEqProds:[], mixEqThreshold:null };
    } else if (r.ruleType === 'poolEq') {
      r = { ...r, ruleType:'mix', mixIndTargets:[], mixPoolProds:[], mixPoolThreshold:null, mixEqProds: r.poolEqProds||[], mixEqThreshold: r.threshold };
    }
  }

  const prodOpts = () => S.products.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  const isPool = r.ruleType === 'pool';

  const targetsHtml = (targets) => (targets||[]).map((t,i)=>{
    const sel = S.products.map(p=>`<option value="${p.id}" ${String(p.id)===String(t.productId)?'selected':''}>${p.name}</option>`).join('');
    return `<div class="br-target-row" style="display:flex;gap:5px;align-items:center;margin-bottom:5px;overflow:hidden">
      <select class="br-tpid" style="flex:1;min-width:0;width:0;background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:7px;padding:5px;font-size:12px">${sel}</select>
      <input type="number" class="br-tqty" value="${t.threshold||''}" placeholder="Umbral" min="1" style="width:65px;flex-shrink:0;background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:7px;padding:5px;font-size:12px"/>
      <button onclick="this.closest('.br-target-row').remove()" style="flex-shrink:0;background:#ef444420;border:1px solid #ef4444;border-radius:6px;color:#ef4444;padding:3px 7px;font-size:12px;cursor:pointer">x</button>
    </div>`;
  }).join('');

  const poolHtml = (r2) => (r2.poolProds||[]).map(pid=>{
    const sel = S.products.map(p=>`<option value="${p.id}" ${String(p.id)===String(pid)?'selected':''}>${p.name}</option>`).join('');
    return `<div class="br-pool-row" style="display:flex;gap:5px;align-items:center;margin-bottom:5px">
      <select class="br-ppid" style="flex:1;background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:7px;padding:5px;font-size:12px">${sel}</select>
      <button onclick="this.closest('.br-pool-row').remove()" style="background:#ef444420;border:1px solid #ef4444;border-radius:6px;color:#ef4444;padding:3px 7px;font-size:12px;cursor:pointer">x</button>
    </div>`;
  }).join('');

  const poolEqHtml = (r2) => (r2.poolEqProds||[]).map(ep=>{
    const sel = S.products.map(p=>`<option value="${p.id}" ${String(p.id)===String(ep.productId)?'selected':''}>${p.name}</option>`).join('');
    return `<div class="br-pooleq-row" style="display:flex;gap:5px;align-items:center;margin-bottom:5px">
      <select class="br-eqpid" style="flex:1;min-width:0;background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:7px;padding:5px;font-size:11px">${sel}</select>
      <input type="number" class="br-eqfactor" value="${ep.factor||1}" min="0.01" step="0.01" placeholder="Factor" title="1 galón=1, 1 litro=0.5" style="width:70px;background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:7px;padding:5px;font-size:12px"/>
      <button onclick="this.closest('.br-pooleq-row').remove()" style="background:#ef444420;border:1px solid #ef4444;border-radius:6px;color:#ef4444;padding:3px 7px;font-size:12px;cursor:pointer">x</button>
    </div>`;
  }).join('');

  const mixIndHtml = (r2) => (r2.mixIndTargets||[]).map((t,i)=>{
    const sel = S.products.map(p=>`<option value="${p.id}" ${String(p.id)===String(t.productId)?'selected':''}>${p.name}</option>`).join('');
    return `<div class="br-mix-ind-row" style="display:flex;gap:5px;align-items:center;margin-bottom:5px">
      <select class="br-mix-ind-pid" style="flex:1;min-width:0;background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:7px;padding:5px;font-size:11px">${sel}</select>
      <input type="number" class="br-mix-ind-thr" value="${t.threshold||''}" min="1" placeholder="Meta" style="width:70px;background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:7px;padding:5px;font-size:12px"/>
      <button onclick="this.closest('.br-mix-ind-row').remove()" style="background:#ef444420;border:1px solid #ef4444;border-radius:6px;color:#ef4444;padding:3px 7px;font-size:12px;cursor:pointer">x</button>
    </div>`;
  }).join('');

  const mixPoolHtml = (r2) => (r2.mixPoolProds||[]).map(pid=>{
    const sel = S.products.map(p=>`<option value="${p.id}" ${String(p.id)===String(pid)?'selected':''}>${p.name}</option>`).join('');
    return `<div class="br-mix-pool-row" style="display:flex;gap:5px;align-items:center;margin-bottom:5px">
      <select class="br-mix-pool-pid" style="flex:1;background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:7px;padding:5px;font-size:12px">${sel}</select>
      <button onclick="this.closest('.br-mix-pool-row').remove()" style="background:#ef444420;border:1px solid #ef4444;border-radius:6px;color:#ef4444;padding:3px 7px;font-size:12px;cursor:pointer">x</button>
    </div>`;
  }).join('');

  const mixEqHtml = (r2) => (r2.mixEqProds||[]).map(ep=>{
    const sel = S.products.map(p=>`<option value="${p.id}" ${String(p.id)===String(ep.productId)?'selected':''}>${p.name}</option>`).join('');
    return `<div class="br-mix-eq-row" style="display:flex;flex-direction:column;gap:4px;margin-bottom:8px;padding:5px;background:#12162a;border-radius:7px">
      <div style="display:flex;gap:5px;align-items:center">
        <select class="br-mix-eq-pid" style="flex:1;min-width:0;background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:7px;padding:5px;font-size:11px">${sel}</select>
        <input type="number" class="br-mix-eq-factor" value="${ep.factor||1}" min="0.01" step="0.01" placeholder="Factor" style="width:70px;background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:7px;padding:5px;font-size:12px"/>
        <button onclick="this.closest('.br-mix-eq-row').remove()" style="background:#ef444420;border:1px solid #ef4444;border-radius:6px;color:#ef4444;padding:3px 7px;font-size:12px;cursor:pointer">x</button>
      </div>
      <input type="text" class="br-mix-eq-unit" value="${ep.unitLabel||''}" placeholder="Nombre/unidad para el reporte (ej: GALONES, LITROS) — opcional" style="width:100%;background:#0d0f18;color:#94a3b8;border:1px solid #2a3050;border-radius:6px;padding:4px 6px;font-size:11px"/>
    </div>`;
  }).join('');

  const bonusItemsHtml = (items) => (items||[]).map(bi=>{
    const sel = S.products.map(p=>`<option value="${p.id}" ${String(p.id)===String(bi.productId)?'selected':''}>${p.name}</option>`).join('');
    return `<div class="br-bonus-row" style="background:#0d1f0d;border:1px solid #1a3a1a;border-radius:8px;padding:6px;margin-bottom:6px">
      <div style="display:grid;grid-template-columns:1fr 45px 70px 28px;gap:4px;align-items:center;margin-bottom:4px">
        <select class="br-bpid" style="background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:6px;padding:4px;font-size:11px;min-width:0">${sel}</select>
        <input type="number" class="br-bqty" value="${bi.qty||1}" min="1" placeholder="Cant" style="background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:6px;padding:4px;font-size:11px;width:100%"/>
        <input type="number" class="br-bprice" value="${bi.price!=null?bi.price:''}" min="0" step="0.01" placeholder="Precio" style="background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:6px;padding:4px;font-size:11px;width:100%"/>
        <button onclick="this.closest('.br-bonus-row').remove()" style="background:#ef444420;border:1px solid #ef4444;border-radius:5px;color:#ef4444;padding:2px 4px;font-size:11px;cursor:pointer">x</button>
      </div>
      <input class="br-bcomment" value="${bi.comment||''}" placeholder="Comentario (ej: Por consumo Trim. Q2)" style="width:100%;background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:6px;padding:4px 8px;font-size:11px"/>
    </div>`;
  }).join('');

  document.getElementById('bonus-modal-body').innerHTML = `
    <div style="font-size:15px;font-weight:800;color:#f59e0b;margin-bottom:12px;text-align:center">${isEdit?'EDITAR':'NUEVA'} REGLA DE BONIFICACION</div>
    <div style="font-size:11px;color:#94a3b8;margin-bottom:3px">NOMBRE:</div>
    <input id="br-name" value="${r.name||''}" placeholder="Ej: Bonif. Q2 Laca" style="width:100%;background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:8px;padding:7px;margin-bottom:10px;font-size:13px"/>
    <div style="font-size:11px;color:#94a3b8;margin-bottom:3px">CLIENTES ADICIONALES (opcional — su consumo también cuenta para esta meta):</div>
    <div style="position:relative;margin-bottom:6px">
      <input type="text" id="br-extra-cli-search" class="inp" placeholder="Buscar cliente por nombre..." oninput="brSearchExtraClients()" autocomplete="off"/>
      <div id="br-extra-cli-drop" class="ac-drop" style="position:absolute;left:0;right:0"></div>
    </div>
    <div id="br-extra-cli-chips" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px"></div>
    <div style="font-size:11px;color:#94a3b8;font-weight:700;margin-bottom:6px">TIPO:</div>
    <input type="hidden" id="br-type-fixed" value="mix"/>
    <div id="br-individual-section" style="display:none">
      <div id="br-target-rows"></div>
    </div>
    <div id="br-pool-section" style="display:none">
      <div style="display:none">PRODUCTOS DEL POOL (cualquier combo suma):</div>
      <div id="br-pool-rows">${poolHtml(r)}</div>
      <button onclick="addPoolRow()" style="width:100%;background:#1e3a5f;border:1px dashed #60a5fa;border-radius:7px;color:#60a5fa;padding:5px;font-size:12px;cursor:pointer;margin-bottom:6px">+ Producto al pool</button>
      <div style="font-size:11px;color:#94a3b8;margin-bottom:3px">UMBRAL TOTAL:</div>
      <input type="number" id="br-pool-threshold" value="${r.threshold||''}" placeholder="Ej: 15" min="1" style="width:100%;background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:8px;padding:7px;margin-bottom:10px;font-size:13px"/>
    </div>
    <div id="br-pooleq-section" style="display:${r.ruleType==='poolEq'?'block':'none'}">
      <div style="font-size:11px;color:#94a3b8;margin-bottom:5px">PRODUCTOS CON EQUIVALENCIA:</div>
      <div id="br-pooleq-rows">${poolEqHtml(r)}</div>
      <button onclick="addPoolEqRow()" style="width:100%;background:#1e3a5f;border:1px dashed #60a5fa;border-radius:7px;color:#60a5fa;padding:5px;font-size:12px;cursor:pointer;margin-bottom:6px">+ Producto con equivalencia</button>
      <div style="font-size:11px;color:#94a3b8;margin-bottom:3px">UMBRAL TOTAL (unidades base):</div>
      <input type="number" id="br-pooleq-threshold" value="${r.ruleType==='poolEq'?r.threshold||'':''}" placeholder="Ej: 900" min="1" style="width:100%;background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:8px;padding:7px;margin-bottom:10px;font-size:13px"/>
    </div>
    <div id="br-mix-section" style="display:block">
      <div style="font-size:11px;color:#f59e0b;font-weight:700;margin-bottom:8px">🎯 PRODUCTO MIX — cumplir lo que aplique:</div>

      ${(()=>{ const hasInd = (r.mixIndTargets||[]).length > 0; return `
      <div onclick="toggleBrSection('br-ind-body')" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;background:#12162a;border-radius:7px;padding:8px 10px;margin-bottom:${hasInd?'6px':'8px'}">
        <span style="font-size:12px;color:#4ade80;font-weight:700">🔹 Umbrales individuales${hasInd?` (${r.mixIndTargets.length})`:''}</span>
        <span id="br-ind-body-arrow" style="color:#4ade80;font-size:11px">${hasInd?'▼':'▶'}</span>
      </div>
      <div id="br-ind-body" style="display:${hasInd?'block':'none'}">
        <div id="br-mix-ind-rows">${mixIndHtml(r)}</div>
        <button onclick="addMixIndRow()" style="width:100%;background:#1e2a1a;border:1px dashed #4ade80;border-radius:7px;color:#4ade80;padding:5px;font-size:12px;cursor:pointer;margin-bottom:10px">+ Producto individual</button>
      </div>`; })()}

      ${(()=>{ const hasPool = (r.mixPoolProds||[]).length > 0; return `
      <div onclick="toggleBrSection('br-pool-body')" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;background:#12162a;border-radius:7px;padding:8px 10px;margin-bottom:${hasPool?'6px':'8px'}">
        <span style="font-size:12px;color:#a78bfa;font-weight:700">🔹 Pool compartido${hasPool?` (${r.mixPoolProds.length})`:''}</span>
        <span id="br-pool-body-arrow" style="color:#a78bfa;font-size:11px">${hasPool?'▼':'▶'}</span>
      </div>
      <div id="br-pool-body" style="display:${hasPool?'block':'none'}">
        <div id="br-mix-pool-rows">${mixPoolHtml(r)}</div>
        <button onclick="addMixPoolRow()" style="width:100%;background:#1e2a3a;border:1px dashed #a78bfa;border-radius:7px;color:#a78bfa;padding:5px;font-size:12px;cursor:pointer;margin-bottom:6px">+ Producto al pool</button>
        <div style="font-size:11px;color:#94a3b8;margin-bottom:3px">TÍTULO PARA REPORTES (opcional, si no se llena se arma automático con los nombres):</div>
        <input type="text" id="br-mix-pool-title" value="${r.ruleType==='mix'?(r.mixPoolTitle||''):''}" placeholder="Ej: Ácido Muriático + Thinner" style="width:100%;background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:8px;padding:7px;margin-bottom:6px;font-size:13px"/>
        <div style="font-size:11px;color:#94a3b8;margin-bottom:3px">UMBRAL TOTAL DEL POOL COMPARTIDO (opcional):</div>
        <input type="number" id="br-mix-pool-threshold" value="${r.ruleType==='mix'?r.mixPoolThreshold||'':''}" placeholder="Ej: 15" min="1" style="width:100%;background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:8px;padding:7px;margin-bottom:10px;font-size:13px"/>
      </div>`; })()}

      ${(()=>{ const hasEq = (r.mixEqProds||[]).length > 0; return `
      <div onclick="toggleBrSection('br-eq-body')" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;background:#12162a;border-radius:7px;padding:8px 10px;margin-bottom:${hasEq?'6px':'0px'}">
        <span style="font-size:12px;color:#60a5fa;font-weight:700">🔹 Pool con equivalencias${hasEq?` (${r.mixEqProds.length})`:''}</span>
        <span id="br-eq-body-arrow" style="color:#60a5fa;font-size:11px">${hasEq?'▼':'▶'}</span>
      </div>
      <div id="br-eq-body" style="display:${hasEq?'block':'none'}">
        <div id="br-mix-eq-rows">${mixEqHtml(r)}</div>
        <button onclick="addMixEqRow()" style="width:100%;background:#1e3a5f;border:1px dashed #60a5fa;border-radius:7px;color:#60a5fa;padding:5px;font-size:12px;cursor:pointer;margin-bottom:6px">+ Producto con equivalencia</button>
        <div style="font-size:11px;color:#94a3b8;margin-bottom:3px">TÍTULO PARA REPORTES (opcional, si no se llena se arma automático con los nombres):</div>
        <input type="text" id="br-mix-eq-title" value="${r.ruleType==='mix'?(r.mixEqTitle||''):''}" placeholder="Ej: Ácido Muriático y Thinner" style="width:100%;background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:8px;padding:7px;margin-bottom:6px;font-size:13px"/>
        <div style="font-size:11px;color:#94a3b8;margin-bottom:3px">UMBRAL TOTAL DEL POOL (opcional):</div>
        <input type="number" id="br-mix-eq-threshold" value="${r.ruleType==='mix'?r.mixEqThreshold||'':''}" placeholder="Ej: 900" min="1" style="width:100%;background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:8px;padding:7px;margin-bottom:6px;font-size:13px"/>
      </div>`; })()}
    </div>
    <div style="font-size:11px;color:#10b981;font-weight:700;margin-bottom:5px">BONIFICACION A ENTREGAR:</div>
    <div id="br-bonus-rows">${bonusItemsHtml(r.bonusItems)}</div>
    <button onclick="addBonusItemRow()" style="width:100%;background:#052e16;border:1px dashed #10b981;border-radius:7px;color:#10b981;padding:5px;font-size:12px;cursor:pointer;margin-bottom:10px">+ Producto de bonif.</button>
    <div style="display:flex;gap:8px;margin-bottom:10px">
      <div style="flex:1"><div style="font-size:11px;color:#94a3b8;margin-bottom:3px">Fecha inicio:</div>
        <input type="date" id="br-start" value="${r.startDate||new Date().toISOString().split('T')[0]}" style="width:100%;background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:8px;padding:6px;font-size:12px"/></div>
      <div style="flex:1"><div style="font-size:11px;color:#94a3b8;margin-bottom:3px">Fecha limite:</div>
        <input type="date" id="br-deadline" value="${r.deadline||''}" style="width:100%;background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:8px;padding:6px;font-size:12px"/></div>
    </div>
    <div style="font-size:11px;color:#60a5fa;font-weight:700;margin-bottom:5px;margin-top:4px">VIGENCIA DE LA REGLA:</div>
    <div style="display:flex;gap:8px;margin-bottom:10px">
      <div style="flex:1"><div style="font-size:11px;color:#94a3b8;margin-bottom:3px">Vigencia inicio:</div>
        <input type="date" id="br-vigencia-start" value="${r.vigenciaStart||new Date().toISOString().split('T')[0]}" style="width:100%;background:#0d0f18;color:#f1f5f9;border:1px solid #3b82f6;border-radius:8px;padding:6px;font-size:12px"/></div>
      <div style="flex:1"><div style="font-size:11px;color:#94a3b8;margin-bottom:3px">Vigencia fin:</div>
        <input type="date" id="br-vigencia-end" value="${r.vigenciaEnd||''}" placeholder="Sin fecha fin" style="width:100%;background:#0d0f18;color:#f1f5f9;border:1px solid #3b82f6;border-radius:8px;padding:6px;font-size:12px"/></div>
    </div>
    <div style="display:flex;gap:8px">
      <button onclick="closeBonusModal()" style="flex:1;padding:10px;border-radius:9px;border:1px solid #475569;background:transparent;color:#f1f5f9;font-weight:700;cursor:pointer">Cancelar</button>
      <button onclick="saveBonusRule(${cid},${isEdit?ri:'null'})" style="flex:1;padding:10px;border-radius:9px;border:none;background:#f59e0b;color:#000;font-weight:800;cursor:pointer">Guardar</button>
    </div>`;

  document.getElementById('bonus-modal').dataset.cid = cid;
  document.getElementById('bonus-modal').style.display = 'flex';
  brRenderExtraClientChips();
}


function addPoolRow() {
  const prodOpts = S.products.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  const div = document.createElement('div');
  div.className='br-pool-row'; div.style.cssText='display:flex;gap:5px;align-items:center;margin-bottom:5px';
  div.innerHTML=`<select class="br-ppid" style="flex:1;background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:7px;padding:5px;font-size:12px">${prodOpts}</select>
    <button onclick="this.closest('.br-pool-row').remove()" style="background:#ef444420;border:1px solid #ef4444;border-radius:6px;color:#ef4444;padding:3px 7px;font-size:12px;cursor:pointer">x</button>`;
  document.getElementById('br-pool-rows').appendChild(div);
}

function addBonusItemRow() {
  const prodOpts = S.products.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  const div = document.createElement('div');
  div.className = 'br-bonus-row';
  div.style.cssText = 'background:#0d1f0d;border:1px solid #1a3a1a;border-radius:8px;padding:6px;margin-bottom:6px';
  div.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 45px 70px 28px;gap:4px;align-items:center;margin-bottom:4px">
      <select class="br-bpid" style="background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:6px;padding:4px;font-size:11px;min-width:0">${prodOpts}</select>
      <input type="number" class="br-bqty" value="1" min="1" placeholder="Cant" style="background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:6px;padding:4px;font-size:11px;width:100%"/>
      <input type="number" class="br-bprice" value="" min="0" step="0.01" placeholder="Precio" style="background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:6px;padding:4px;font-size:11px;width:100%"/>
      <button onclick="this.closest('.br-bonus-row').remove()" style="background:#ef444420;border:1px solid #ef4444;border-radius:5px;color:#ef4444;padding:2px 4px;font-size:11px;cursor:pointer">x</button>
    </div>
    <input class="br-bcomment" value="" placeholder="Comentario (ej: Por consumo Trim. Q2)" style="width:100%;background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:6px;padding:4px 8px;font-size:11px"/>`;
  document.getElementById('br-bonus-rows').appendChild(div);
}

function saveBonusRule(cid, ri) {
  const name = document.getElementById('br-name').value.trim();
  const startDate = document.getElementById('br-start').value;
  const deadline  = document.getElementById('br-deadline').value;
  const vigenciaStart = document.getElementById('br-vigencia-start').value;
  const vigenciaEnd   = document.getElementById('br-vigencia-end').value;
  const isPool = document.getElementById('br-pool-section').style.display !== 'none';
  const isPoolEq = !!document.getElementById('br-pooleq-section') && document.getElementById('br-pooleq-section').style.display !== 'none';
  const isMix = !!document.getElementById('br-mix-section') && document.getElementById('br-mix-section').style.display !== 'none';
  const bonusRows = document.querySelectorAll('.br-bonus-row');
  const bonusItems = [];
  bonusRows.forEach(row => {
    const pid     = row.querySelector('.br-bpid')?.value;
    const qty     = Number(row.querySelector('.br-bqty')?.value)||1;
    const priceRaw = row.querySelector('.br-bprice')?.value;
    const price   = priceRaw !== '' && priceRaw != null ? Number(priceRaw) : null;
    const comment = row.querySelector('.br-bcomment')?.value.trim() || '';
    if (pid) bonusItems.push({ productId: Number(pid), qty, price, comment });
  });
  if (!bonusItems.length) return toast('Agrega al menos un producto de bonificacion','#f59e0b');
  let rule;
  if (isMix) {
    const indRows = document.querySelectorAll('.br-mix-ind-row');
    const mixIndTargets = [];
    indRows.forEach(row => {
      const pid = row.querySelector('.br-mix-ind-pid')?.value;
      const thr = Number(row.querySelector('.br-mix-ind-thr')?.value);
      if (pid && thr) mixIndTargets.push({ productId: Number(pid), threshold: thr });
    });
    const poolRows = document.querySelectorAll('.br-mix-pool-row');
    const mixPoolProds = [];
    poolRows.forEach(row => {
      const pid = row.querySelector('.br-mix-pool-pid')?.value;
      if (pid) mixPoolProds.push(Number(pid));
    });
    const mixPoolThreshold = Number(document.getElementById('br-mix-pool-threshold').value) || 0;
    const mixPoolTitle = (document.getElementById('br-mix-pool-title')?.value || '').trim();
    const eqRows = document.querySelectorAll('.br-mix-eq-row');
    const mixEqProds = [];
    eqRows.forEach(row => {
      const pid = row.querySelector('.br-mix-eq-pid')?.value;
      const factor = Number(row.querySelector('.br-mix-eq-factor')?.value) || 1;
      const unitLabel = (row.querySelector('.br-mix-eq-unit')?.value || '').trim();
      if (pid) mixEqProds.push({ productId: Number(pid), factor, unitLabel });
    });
    const mixEqThreshold = Number(document.getElementById('br-mix-eq-threshold').value) || 0;
    const mixEqTitle = (document.getElementById('br-mix-eq-title')?.value || '').trim();
    if (!mixIndTargets.length && !mixPoolProds.length && !mixEqProds.length) return toast('Agrega al menos un producto','#f59e0b');
    rule = { ruleType:'mix', name, mixIndTargets, mixPoolProds, mixPoolThreshold, mixPoolTitle, mixEqProds, mixEqThreshold, mixEqTitle, bonusItems, startDate, deadline, vigenciaStart, vigenciaEnd, manualUnits:0, extraClientIds: _brExtraClients.slice() };
  } else if (isPoolEq) {
    const eqRows = document.querySelectorAll('.br-pooleq-row');
    const poolEqProds = [];
    eqRows.forEach(row => {
      const pid = row.querySelector('.br-eqpid')?.value;
      const factor = Number(row.querySelector('.br-eqfactor')?.value) || 1;
      if (pid) poolEqProds.push({ productId: Number(pid), factor });
    });
    const threshold = Number(document.getElementById('br-pooleq-threshold').value);
    if (!poolEqProds.length) return toast('Agrega productos al pool','#f59e0b');
    if (!threshold) return toast('Ingresa el umbral total','#f59e0b');
    rule = { ruleType:'poolEq', name, poolEqProds, threshold, bonusItems, startDate, deadline, vigenciaStart, vigenciaEnd, manualUnits:0 };
  } else if (isPool) {
    const poolRows = document.querySelectorAll('.br-pool-row');
    const poolProds = [];
    poolRows.forEach(row => { const pid = row.querySelector('.br-ppid')?.value; if(pid) poolProds.push(Number(pid)); });
    const threshold = Number(document.getElementById('br-pool-threshold').value);
    if (!poolProds.length) return toast('Agrega productos al pool','#f59e0b');
    if (!threshold) return toast('Ingresa el umbral total','#f59e0b');
    rule = { ruleType:'pool', name, poolProds, threshold, bonusItems, startDate, deadline, vigenciaStart, vigenciaEnd, manualUnits:0 };
  } else {
    const targetRows = document.querySelectorAll('.br-target-row');
    const targets = [];
    targetRows.forEach(row => {
      const pid = row.querySelector('.br-tpid')?.value;
      const thr = Number(row.querySelector('.br-tqty')?.value);
      if (pid && thr) targets.push({ productId:Number(pid), threshold:thr, manualUnits:0 });
    });
    if (!targets.length) return toast('Agrega al menos un producto con umbral','#f59e0b');
    rule = { ruleType:'individual', name, targets, bonusItems, startDate, deadline, vigenciaStart, vigenciaEnd };
  }
  if (!S.bonuses) S.bonuses = {};
  if (!S.bonuses[cid]) S.bonuses[cid] = [];
  if (ri !== null && ri !== 'null' && ri !== undefined) {
    const old = S.bonuses[cid][ri];
    if (old && rule.ruleType==='individual' && old.ruleType==='individual') {
      rule.targets.forEach(t => { const ot=(old.targets||[]).find(x=>x.productId===t.productId); if(ot) t.manualUnits=ot.manualUnits||0; });
    }
    if (old && rule.ruleType==='pool') rule.manualUnits=old.manualUnits||0;
    // Preservar el ciclo actual al editar
    if (old && old.resetTs)      rule.resetTs      = old.resetTs;
    if (old && old._resetOid)    rule._resetOid    = old._resetOid;
    if (old && old._cycleCount)  rule._cycleCount  = old._cycleCount;
    if (old && old.history)      rule.history      = old.history;
    if (old && old.inactive)     rule.inactive     = old.inactive;
    if (old && old.vigenciaStart && !vigenciaStart) rule.vigenciaStart = old.vigenciaStart;
    if (old && old.vigenciaEnd   && !vigenciaEnd)   rule.vigenciaEnd   = old.vigenciaEnd;
    S.bonuses[cid][ri] = rule;
  } else {
    S.bonuses[cid].push(rule);
  }
  closeBonusModal();
  save(); toast('Regla guardada','#10b981');
  window._cliOpen[cid]=true; renderClients();
}

function showBonusReport(cid) {
  const c = S.clients.find(x => x.id === Number(cid));
  if (!S.bonuses) S.bonuses = {};
  const ownRules = (S.bonuses[cid] || []).map(r => ({ r, ownerCid: Number(cid) }));
  const sharedRules = [];
  Object.keys(S.bonuses).forEach(ownerId => {
    if (Number(ownerId) === Number(cid)) return;
    (S.bonuses[ownerId]||[]).forEach(r => {
      if ((r.extraClientIds||[]).map(Number).includes(Number(cid))) {
        sharedRules.push({ r, ownerCid: Number(ownerId) });
      }
    });
  });
  const rulesWithOwner = [...ownRules, ...sharedRules];
  const rules = rulesWithOwner.map(x=>x.r);
  if (!rules.length) { toast('No hay reglas de bonificación', '#f59e0b'); return; }
  const biz = S.biz || {};

  const rulesHtml = rulesWithOwner.map(_rw => {
    const r = _rw.r;
    const ownerCid = _rw.ownerCid;
    const startDate = r.startDate || '';
    const endDate   = r.endDate || r.deadline || '';
    const progress  = calcBonusProgress(ownerCid, r);
    const isSharedFromOther = Number(ownerCid) !== Number(cid);
    const ownerCli = isSharedFromOther ? S.clients.find(x=>x.id===ownerCid) : null;
    const _includedCidsRep = [ownerCid, ...(r.extraClientIds||[]).map(Number)];

    // Agrupar consumo por mes para cada producto
    const startDateStr = r.startDate || '2000-01-01';
    const endDateStr   = r.endDate || r.deadline || '2099-12-31';
    const orders = S.orders.filter(o =>
      _includedCidsRep.includes(Number(o.clientId)) &&
      (o.status === 'Confirmado' || o.status === 'Concluido')
    ).filter(o => {
      const parts = (o.date||'').split('/');
      if (parts.length < 3) return false;
      const d = parseInt(parts[0]), m = parseInt(parts[1]), y = parseInt(parts[2]);
      const ds = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      return ds >= startDateStr && ds <= endDateStr;
    });

    // Construir meses del período
    const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const months = [];
    if (startDate && endDate) {
      const [sy,sm] = startDate.split('-').map(Number);
      const [ey,em] = endDate.split('-').map(Number);
      let y = sy, m = sm;
      while (y < ey || (y === ey && m <= em)) {
        months.push({y, m, label: monthNames[m-1]+' '+y});
        m++; if (m > 12) { m = 1; y++; }
        if (months.length > 24) break;
      }
    }

    // Agrupar filas: juntar isDetail + su total (isPool) en un solo bloque
    const groupedProgress = [];
    let detailGroup = null;
    progress.forEach(pg => {
      if (pg.isDetail) {
        if (!detailGroup) detailGroup = { items: [], totalRow: null };
        detailGroup.items.push(pg);
      } else if (detailGroup && pg.isPool) {
        detailGroup.totalRow = pg;
        groupedProgress.push({ type: 'poolGroup', detailGroup });
        detailGroup = null;
      } else {
        if (detailGroup) { groupedProgress.push({ type: 'poolGroup', detailGroup }); detailGroup = null; }
        groupedProgress.push({ type: 'single', prog: pg });
      }
    });
    if (detailGroup) groupedProgress.push({ type: 'poolGroup', detailGroup });

    const targetsHtml = groupedProgress.map(group => {
      if (group.type === 'poolGroup') {
        const { items, totalRow } = group.detailGroup;
        if (!totalRow) return '';
        const total = totalRow.app + totalRow.manual;
        const pct = Math.min(100, Math.round(total / totalRow.threshold * 100));
        const color = progressColor(pct);
        const restante = Math.max(0, totalRow.threshold - total);

        // Título: nombres de productos sin el ×factor
        // Construir título: parte común + partes distintas en línea aparte
        const nombres = items.map(it => it.label.replace(/\s×[\d.]+$/, ''));
        const { parteComun, partesDistintas, comunLen } = splitTituloComun(nombres);
        const _tituloManual = totalRow.mixPoolTitle ? totalRow.mixPoolTitle : totalRow.mixEqTitle ? totalRow.mixEqTitle : (r.ruleType==='poolEq' && r.poolLabel) ? r.poolLabel : '';
        const titulo = _tituloManual
          ? _tituloManual
          : (parteComun && partesDistintas
            ? `${parteComun}<br><span style="font-weight:700">${partesDistintas}</span>`
            : nombres.join(' / '));

        // Datos por producto: nombre, unidad, cantidades por mes
        const prodData = items.map(it => {
          const p2 = it.productId != null ? S.products.find(x => x.id === it.productId) : S.products.find(x => x.name === it.label.replace(/\s×[\d.]+$/, ''));
          const prodName = p2 ? p2.name : it.label.replace(/\s×[\d.]+$/, '');
          const eqDef = it.productId != null ? it : (r.ruleType==='mix' ? (r.mixEqProds||[]).find(e=>e.productId===p2?.id) : (r.poolEqProds||[]).find(e=>e.productId===p2?.id));
          const words = (p2?.name||'').trim().split(/\s+/);
          const unitSing = (eqDef && eqDef.unitLabel) ? eqDef.unitLabel : (words[words.length-1]||'unidad');
          // Pluralizar
          const pluralize = (u, q) => {
            if (q <= 1) return u;
            const up = u === u.toUpperCase();
            const l = u.toLowerCase();
            if (l.endsWith('ón')) return u.slice(0,-2)+(up?'ONES':'ones');
            if (l.endsWith('el')||l.endsWith('or')) return u+(up?'ES':'es');
            return u+(up?'S':'s');
          };
          // Total consumido de este producto
          let totalQty = 0;
          orders.forEach(o => { o.items.forEach(oi => { if (p2 && Number(oi.productId||oi.pid)===p2.id) totalQty += Number(oi.qty); }); });
          // Por mes
          const byMonth = {};
          months.forEach(({y,m,label}) => {
            let qty = 0;
            orders.forEach(o => {
              const parts = (o.date||'').split('/');
              if (parts.length < 3) return;
              if (parseInt(parts[1])===m && parseInt(parts[2])===y)
                o.items.forEach(oi => { if (p2 && Number(oi.productId||oi.pid)===p2.id) qty += Number(oi.qty); });
            });
            byMonth[label] = qty;
          });
          return { prodName, p2, unitSing, pluralize, totalQty, byMonth, eqDef };
        });

        // Detectar si es pool con equivalencias (tiene ×factor) o pool compartido
        const esEquivalencias = items.some(it => /×[\d.]+$/.test(it.label));

        let consumidoStr, restanteStr, consumidoEsMultilinea = false, lineas = '';
        if (esEquivalencias) {
          // Pool con equivalencias: "548 GALONES / 200 LITROS (72%)"
          consumidoStr = prodData.map(pd => pd.totalQty > 0 ? `${pd.totalQty} ${pd.pluralize(pd.unitSing, pd.totalQty)}` : null).filter(Boolean).join(' / ') + ` (${pct}%)`;
          const restUniqueLabels = [...new Set(prodData.map(pd => (pd.eqDef && pd.eqDef.unitLabel) ? pd.eqDef.unitLabel : '').filter(Boolean))];
          restanteStr = restUniqueLabels.length ? `${restante} ${restUniqueLabels.join(' / ')}` : String(restante);
        } else {
          // Pool compartido: cada producto en su línea, restante simple
          consumidoEsMultilinea = true;
          lineas = prodData.filter(pd => pd.totalQty > 0).map(pd => {
            const nombreCorto = parteComun ? pd.prodName.split(' ').slice(comunLen).join(' ') : pd.prodName;
            return `${pd.totalQty} ${nombreCorto}`;
          }).join(' / ');
          consumidoStr = `${pct}%<br><span style="font-weight:700">${lineas}</span>`;
          restanteStr = String(restante);
        }

        const pBar = `<div style="background:#e2e8f0;border-radius:4px;height:8px;margin:4px 0">
          <div style="background:${color};width:${pct}%;height:8px;border-radius:4px"></div></div>`;

        // Consumo por mes combinado
        let monthRowsPool = '';
        if (months.length) {
          months.forEach(({label}) => {
            const partes = prodData.map(pd => {
              if (pd.byMonth[label] <= 0) return null;
              return `${pd.byMonth[label]} ${pd.prodName}`;
            }).filter(Boolean);
            if (partes.length) monthRowsPool += `<tr><td style="padding:2px 0 2px 12px;font-size:12px;color:#374151;vertical-align:top">${label}</td><td style="padding:2px 0;font-size:12px;color:#374151;text-align:right">${partes.join('<br>')}</td></tr>`;
          });
        }

        const detalleTexto = consumidoEsMultilinea ? lineas : consumidoStr.replace(/\s*\(\d+%\)$/,'');
        return `<div style="margin-bottom:14px;padding:10px;background:#f8fafc;border-radius:8px;border-left:3px solid ${color}">
          <div style="font-weight:700;font-size:13px;color:#1e293b;margin-bottom:4px">${titulo}</div>
          <div style="display:flex;justify-content:space-between;font-size:12px;color:#374151;margin-bottom:4px">
            <span>Meta: <span style="color:#1e293b;font-weight:700">${totalRow.threshold}</span></span>
            <span style="font-weight:700">${totalRow.app}/${totalRow.threshold} (${pct}%)</span>
          </div>
          ${pBar}
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="font-size:12px;color:#374151;padding:2px 0">Restante:</td><td style="font-size:12px;color:${restante>0?'#dc2626':'#374151'};font-weight:700;text-align:right">${restanteStr}</td></tr>
            ${monthRowsPool ? `<tr><td colspan="2" style="padding:4px 0 2px;font-size:11px;color:#64748b;font-weight:600">Consumo por mes:</td></tr>${monthRowsPool}` : ''}
          </table>
        </div>`;
      }
      const prog = group.prog;
      const p = S.products.find(x => prog.label && prog.label.startsWith(x.name));
      // Usar última palabra del nombre como unidad con plural automático
      function getUnitFromName(name, qty) {
        if (!name) return qty===1?'unidad':'unidades';
        const words = name.trim().split(/\s+/);
        const last = words[words.length-1];
        // Pluralizar
        if (qty <= 1) return last;
        const isUpper = last === last.toUpperCase();
        const l = last.toLowerCase();
        let plural;
        if (l.endsWith('ón')) plural = last.slice(0,-2)+(isUpper?'ONES':'ones');
        else if (l.endsWith('el')) plural = last+(isUpper?'ES':'es');
        else if (l.endsWith('ro')) plural = last+(isUpper?'S':'s');
        else if (l.endsWith('o'))  plural = last.slice(0,-1)+(isUpper?'OS':'os');
        else if (l.endsWith('a'))  plural = last.slice(0,-1)+(isUpper?'AS':'as');
        else plural = last+(isUpper?'S':'s');
        return plural;
      }
      const ul = (qty) => getUnitFromName(p?.name, qty);
      const total = prog.app + prog.manual;
      const restante = Math.max(0, prog.threshold - total);
      const pct = Math.min(100, Math.round(total / prog.threshold * 100));
      const color = progressColor(pct);

      // Consumo por mes
      let monthRows = '';
      if (months.length) {
        monthRows = `<tr><td colspan="2" style="padding:4px 0 2px;font-size:11px;color:#64748b;font-weight:600">Consumo por mes:</td></tr>`;
        months.forEach(({y, m, label}) => {
          let qty = 0;
          orders.forEach(o => {
            const parts = (o.date||'').split('/');
            if (parts.length < 3) return;
            const om = parseInt(parts[1]), oy = parseInt(parts[2]);
            if (oy === y && om === m) {
              o.items.forEach(it => {
                if (p && Number(it.productId||it.pid) === p.id) qty += Number(it.qty);
              });
            }
          });
          if (qty > 0) monthRows += `<tr><td style="padding:2px 0 2px 12px;font-size:12px;color:#374151">${label}</td><td style="padding:2px 0;font-size:12px;color:#374151;text-align:right">${qty} ${ul(qty)}</td></tr>`;
        });
      }

      const pBar = `<div style="background:#e2e8f0;border-radius:4px;height:8px;margin:4px 0">
        <div style="background:${color};width:${pct}%;height:8px;border-radius:4px"></div></div>`;

      return `<div style="margin-bottom:14px;padding:10px;background:#f8fafc;border-radius:8px;border-left:3px solid ${color}">
        <div style="font-weight:700;font-size:13px;color:#1e293b;margin-bottom:4px">${prog.label.replace(/\(\)/g,'').trim()}</div>
        <div style="display:flex;justify-content:space-between;font-size:12px;color:#374151;margin-bottom:4px">
          <span>Meta: <span style="color:#1e293b;font-weight:700">${prog.threshold}</span></span>
          <span style="font-weight:700">${total}/${prog.threshold} (${pct}%)</span>
        </div>
        ${pBar}
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="font-size:12px;color:#374151;padding:2px 0">Restante:</td><td style="font-size:12px;color:${restante>0?'#dc2626':'#374151'};font-weight:700;text-align:right">${restante}</td></tr>
          ${monthRows}
        </table>
      </div>`;
    }).join('');

    const bonifItems = (r.bonusItems||[]).map(bi => {
      const p = S.products.find(x=>x.id===Number(bi.productId));
      const spec = '';
      return `${bi.qty} ${p?p.name:'—'}${spec}`;
    }).join(', ');

    return `<div style="margin-bottom:20px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">
      <div style="background:#1e3a8a;padding:10px 14px">
        <div style="font-weight:800;font-size:15px;color:#fff">${r.name||'Sin nombre'}</div>
        ${startDate||endDate ? `<div style="font-size:11px;color:#93c5fd;margin-top:2px">Período: ${startDate?fmtDDMMYYYY(startDate):'—'} → ${endDate?fmtDDMMYYYY(endDate):'—'}</div>` : ''}
        ${bonifItems ? `<div style="font-size:11px;color:#6ee7b7;margin-top:2px">🎁 Bonificación: ${bonifItems}</div>` : ''}
      </div>
      <div style="padding:12px 14px">${targetsHtml}</div>
    </div>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Reporte Bonificaciones - ${c?.name||''}</title>
  <style>
    body{font-family:Arial,sans-serif;margin:0;padding:16px;background:#fff;color:#1e293b}
    @media print{body{padding:8px}}
  </style>
  </head><body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #1e3a8a">
    <div>
      <div style="font-size:20px;font-weight:900;color:#1e3a8a">${biz.name||'Empresa'}</div>
      ${biz.exec?`<div style="font-size:12px;color:#64748b">${biz.exec}</div>`:''}
      ${biz.phone?`<div style="font-size:12px;color:#64748b">📞 ${biz.phone}</div>`:''}
    </div>
    <div style="text-align:right">
      <div style="font-size:11px;color:#64748b">Generado: ${fmtOrdDate((()=>{ const n=new Date(); return `${String(n.getDate()).padStart(2,'0')}/${String(n.getMonth()+1).padStart(2,'0')}/${n.getFullYear()}`; })())}</div>
    </div>
  </div>
  <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:10px 14px;margin-bottom:16px">
    <div style="font-size:16px;font-weight:800;color:#0369a1">📊 REPORTE DE BONIFICACIONES</div>
    <div style="font-size:14px;font-weight:700;color:#1e293b;margin-top:4px">${c?.name||''}</div>
    ${c?.address?`<div style="font-size:12px;color:#64748b">📍 ${c.address}</div>`:''}
    ${c?.phone?`<div style="font-size:12px;color:#64748b">📞 ${c.phone}</div>`:''}
  </div>
  ${rulesHtml}
  <script>window.onload=function(){window.print()}<\/script>
  </body></html>`;

  const blob = new Blob([html], {type:'text/html'});
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

function buildReportModal(cid, title, color, onGenerate, extraHtml='') {
  const c = S.clients.find(x => x.id === Number(cid));
  const overlay = document.createElement('div');
  overlay.id = 'report-modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
  overlay.innerHTML = `<div style="background:#1e2236;border:1px solid ${color};border-radius:14px;padding:20px;max-width:360px;width:100%">
    <div style="font-size:15px;font-weight:800;color:${color};margin-bottom:8px">${title}</div>
    <div style="font-size:13px;font-weight:700;color:#f1f5f9;margin-bottom:12px">${c?.name||''}</div>
    <input type="text" id="modal-drp-display" readonly placeholder="📅 Selecciona rango de fechas"
      onclick="toggleModalDrp()"
      style="width:100%;background:#0d0f18;border:1px solid ${color};border-radius:8px;padding:8px 12px;font-size:13px;color:#f1f5f9;cursor:pointer;box-sizing:border-box;margin-bottom:10px"/>
    <div id="modal-drp-picker" onclick="event.stopPropagation()" style="display:none;background:#161929;border:1px solid #2a3050;border-radius:10px;padding:10px;margin-bottom:10px">
      <div id="modal-drp-state" style="font-size:11px;color:#f59e0b;margin-bottom:6px;font-weight:700">Selecciona fecha inicio</div>
      <div id="modal-drp-calendar"></div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:8px">
        <button onclick="setModalDrpPreset('hoy')" style="font-size:10px;padding:3px 8px;background:#2a3050;border:none;border-radius:5px;color:#f1f5f9;cursor:pointer">Hoy</button>
        <button onclick="setModalDrpPreset('semana')" style="font-size:10px;padding:3px 8px;background:#2a3050;border:none;border-radius:5px;color:#f1f5f9;cursor:pointer">Esta semana</button>
        <button onclick="setModalDrpPreset('mes')" style="font-size:10px;padding:3px 8px;background:#2a3050;border:none;border-radius:5px;color:#f1f5f9;cursor:pointer">Este mes</button>
        <button onclick="setModalDrpPreset('mes_ant')" style="font-size:10px;padding:3px 8px;background:#2a3050;border:none;border-radius:5px;color:#f1f5f9;cursor:pointer">Mes anterior</button>
        <button onclick="setModalDrpPreset('anio')" style="font-size:10px;padding:3px 8px;background:#2a3050;border:none;border-radius:5px;color:#f1f5f9;cursor:pointer">Este año</button>
      </div>
    </div>
    ${extraHtml}
    <div style="display:flex;gap:8px;margin-top:4px">
      <button onclick="document.getElementById('report-modal-overlay').remove()" style="flex:1;padding:10px;background:transparent;border:1px solid #475569;border-radius:8px;color:#94a3b8;font-size:13px;cursor:pointer">Cancelar</button>
      <button id="modal-gen-btn" onclick="${onGenerate}" style="flex:2;padding:10px;background:${color};border:none;border-radius:8px;color:#fff;font-weight:700;font-size:13px;cursor:pointer">📋 Generar</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  // Inicializar el calendario del modal
  window._mdrpFrom = null; window._mdrpTo = null; window._mdrpStep = 'from';
  const now = new Date();
  window._mdrpYear = now.getFullYear(); window._mdrpMonth = now.getMonth();
  renderModalDrpCalendar();
}

function toggleModalDrp() {
  const p = document.getElementById('modal-drp-picker');
  if (p) p.style.display = p.style.display==='none' ? 'block' : 'none';
}

function renderModalDrpCalendar() {
  const cal = document.getElementById('modal-drp-calendar');
  const state = document.getElementById('modal-drp-state');
  if (!cal) return;
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const DIAS  = ['D','L','M','X','J','V','S'];
  const y = window._mdrpYear, m = window._mdrpMonth;
  const firstDay = new Date(y,m,1).getDay();
  const daysInMonth = new Date(y,m+1,0).getDate();
  const pad = n => String(n).padStart(2,'0');
  const toStr = d => `${y}-${pad(m+1)}-${pad(d)}`;

  state.textContent = window._mdrpStep==='from' ? 'Selecciona fecha inicio'
    : `Inicio: ${fmtEntrega(window._mdrpFrom)} — Selecciona fecha fin`;
  state.style.color = window._mdrpStep==='from' ? '#f59e0b' : '#60a5fa';

  let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
    <button onclick="mdrpPrev()" style="background:none;border:none;color:#f1f5f9;font-size:16px;cursor:pointer;padding:2px 8px">‹</button>
    <span style="font-size:12px;font-weight:700;color:#f1f5f9">${MESES[m]} ${y}</span>
    <button onclick="mdrpNext()" style="background:none;border:none;color:#f1f5f9;font-size:16px;cursor:pointer;padding:2px 8px">›</button>
  </div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center">`;
  DIAS.forEach(d=>{ html+=`<div style="font-size:10px;color:#64748b;padding:2px">${d}</div>`; });
  for(let i=0;i<firstDay;i++) html+='<div></div>';
  for(let d=1;d<=daysInMonth;d++){
    const ds=toStr(d);
    const isFrom=ds===window._mdrpFrom, isTo=ds===window._mdrpTo;
    const inRange=window._mdrpFrom&&window._mdrpTo&&ds>window._mdrpFrom&&ds<window._mdrpTo;
    const todayM = new Date(); const todayDsM = `${todayM.getFullYear()}-${String(todayM.getMonth()+1).padStart(2,'0')}-${String(todayM.getDate()).padStart(2,'0')}`;
    const isTodayM = ds === todayDsM;
    const bg=isFrom||isTo?'#f59e0b':inRange?'#2a3050':'transparent';
    const col=isFrom||isTo?'#000':isTodayM?'#f59e0b':'#f1f5f9';
    const fw=isFrom||isTo||isTodayM?'700':'400';
    const border=isTodayM&&!isFrom&&!isTo?'1px solid #f59e0b':'none';
    html+=`<div onclick="mdrpSelectDay('${ds}')" style="padding:5px 2px;border-radius:5px;cursor:pointer;background:${bg};color:${col};font-size:12px;font-weight:${fw};border:${border}">${d}</div>`;
  }
  html+='</div>';
  cal.innerHTML=html;
}

function mdrpPrev(){ if(window._mdrpMonth===0){window._mdrpMonth=11;window._mdrpYear--;}else window._mdrpMonth--; renderModalDrpCalendar(); }
function mdrpNext(){ if(window._mdrpMonth===11){window._mdrpMonth=0;window._mdrpYear++;}else window._mdrpMonth++; renderModalDrpCalendar(); }

function mdrpSelectDay(ds) {
  if(window._mdrpStep==='from'){
    window._mdrpFrom=ds; window._mdrpTo=null; window._mdrpStep='to';
    renderModalDrpCalendar();
  } else {
    if(ds<window._mdrpFrom){window._mdrpTo=window._mdrpFrom;window._mdrpFrom=ds;}
    else window._mdrpTo=ds;
    window._mdrpStep='from';
    const disp=document.getElementById('modal-drp-display');
    if(disp) disp.value=`${fmtEntrega(window._mdrpFrom)} → ${fmtEntrega(window._mdrpTo)}`;
    document.getElementById('modal-drp-picker').style.display='none';
    renderModalDrpCalendar();
  }
}

function setModalDrpPreset(preset) {
  const today=new Date();
  const pad=n=>String(n).padStart(2,'0');
  const fmt=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  if(preset==='hoy'){window._mdrpFrom=fmt(today);window._mdrpTo=fmt(today);}
  else if(preset==='semana'){const s=new Date(today);s.setDate(today.getDate()-today.getDay());window._mdrpFrom=fmt(s);window._mdrpTo=fmt(today);}
  else if(preset==='mes'){window._mdrpFrom=`${today.getFullYear()}-${pad(today.getMonth()+1)}-01`;window._mdrpTo=fmt(today);}
  else if(preset==='mes_ant'){const s=new Date(today.getFullYear(),today.getMonth()-1,1);const e=new Date(today.getFullYear(),today.getMonth(),0);window._mdrpFrom=fmt(s);window._mdrpTo=fmt(e);}
  else if(preset==='anio'){window._mdrpFrom=`${today.getFullYear()}-01-01`;window._mdrpTo=fmt(today);}
  const disp=document.getElementById('modal-drp-display');
  if(disp) disp.value=`${fmtEntrega(window._mdrpFrom)} → ${fmtEntrega(window._mdrpTo)}`;
  document.getElementById('modal-drp-picker').style.display='none';
  renderModalDrpCalendar();
}

function showBonusEntregasReport(cid) {
  const ownRules2 = (S.bonuses && (S.bonuses[cid] || S.bonuses[String(cid)])) || [];
  const sharedRules2 = [];
  if (S.bonuses) {
    Object.keys(S.bonuses).forEach(ownerId => {
      if (Number(ownerId) === Number(cid)) return;
      (S.bonuses[ownerId]||[]).forEach(r => {
        if ((r.extraClientIds||[]).map(Number).includes(Number(cid))) sharedRules2.push(r);
      });
    });
  }
  const rules = [...ownRules2, ...sharedRules2];
  if (!rules.length) { toast('No hay reglas de bonificación configuradas', '#f59e0b'); return; }
  buildReportModal(cid, '📋 Reporte de Bonificaciones', '#10b981',
    `generateBonusHistoryReport(${cid},window._mdrpFrom,window._mdrpTo);document.getElementById('report-modal-overlay').remove()`);
}

let _bhrProductIds = [];

function bhrSearchProds() {
  const txt = document.getElementById('bhr-prod-search');
  const drop = document.getElementById('bhr-prod-drop');
  if (!txt || !drop) return;
  const rect = txt.getBoundingClientRect();
  drop.style.position = 'fixed';
  drop.style.top = (rect.bottom + 2) + 'px';
  drop.style.left = rect.left + 'px';
  drop.style.width = rect.width + 'px';
  drop.style.right = 'auto';
  const q = normalizeStr(txt.value.trim());
  const matches = S.products.filter(p =>
    !_bhrProductIds.includes(p.id) &&
    (q.length===0 || normalizeStr(p.name).includes(q) || normalizeStr(p.presentation||'').includes(q))
  ).slice(0, 30);
  drop.innerHTML = '';
  if (!matches.length) { drop.innerHTML = '<div class="ac-empty">Sin resultados</div>'; acOpen('bhr-prod-drop'); return; }
  matches.forEach(p => {
    const d = document.createElement('div');
    d.className = 'ac-opt';
    d.innerHTML = `${p.name}`;
    d.onmousedown = () => {
      _bhrProductIds.push(p.id);
      txt.value = '';
      acClose('bhr-prod-drop');
      bhrRenderProdChips();
    };
    drop.appendChild(d);
  });
  acOpen('bhr-prod-drop');
}

function bhrRenderProdChips() {
  const wrap = document.getElementById('bhr-prod-chips');
  if (!wrap) return;
  wrap.innerHTML = '';
  _bhrProductIds.forEach(pid => {
    const p = S.products.find(x=>x.id===pid);
    if (!p) return;
    const chip = document.createElement('div');
    chip.style.cssText = 'display:flex;align-items:center;gap:5px;background:#1e2236;border:1px solid #2a3050;border-radius:20px;padding:4px 6px 4px 12px;font-size:12px;color:#f1f5f9';
    chip.innerHTML = `<span>${p.name}</span>`;
    const btn = document.createElement('button');
    btn.textContent = '✕';
    btn.style.cssText = 'background:none;border:none;color:#ef4444;cursor:pointer;font-size:13px;padding:2px 4px';
    btn.onclick = () => {
      _bhrProductIds = _bhrProductIds.filter(x=>x!==pid);
      bhrRenderProdChips();
    };
    chip.appendChild(btn);
    wrap.appendChild(chip);
  });
}

function showBonusHistoryReport(cid) {
  _bhrProductIds = [];
  buildReportModal(cid, '📋 Reporte de Pedidos', '#10b981',
    `generateBonusSimpleReport(${cid},window._mdrpFrom,window._mdrpTo,document.getElementById('bhr-include-bonus').checked,_bhrProductIds.slice(),document.getElementById('bhr-only-filtered').checked,document.getElementById('bhr-bonus-filtered').checked);document.getElementById('report-modal-overlay').remove()`,
    `<div style="font-size:11px;color:#94a3b8;margin-bottom:4px">Productos (opcional — vacío incluye todos):</div>
    <div style="position:relative;margin-bottom:6px">
      <input type="text" id="bhr-prod-search" class="inp" placeholder="Buscar producto por nombre..." oninput="bhrSearchProds()" autocomplete="off"/>
      <div id="bhr-prod-drop" class="ac-drop" style="position:absolute;left:0;right:0"></div>
    </div>
    <div id="bhr-prod-chips" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px"></div>
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:10px;padding:8px;background:#0d0f18;border-radius:8px;border:1px solid #2a3050">
      <input type="checkbox" id="bhr-only-filtered" style="width:16px;height:16px;cursor:pointer;accent-color:#10b981"/>
      <span style="font-size:13px;color:#f1f5f9">Mostrar solo el producto filtrado (ocultar los demás del pedido)</span>
    </label>
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:10px;padding:8px;background:#0d0f18;border-radius:8px;border:1px solid #2a3050">
      <input type="checkbox" id="bhr-include-bonus" checked style="width:16px;height:16px;cursor:pointer;accent-color:#10b981"/>
      <span style="font-size:13px;color:#f1f5f9">Incluir bonificaciones en el reporte</span>
    </label>
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:10px;padding:8px;background:#0d0f18;border-radius:8px;border:1px solid #2a3050">
      <input type="checkbox" id="bhr-bonus-filtered" style="width:16px;height:16px;cursor:pointer;accent-color:#10b981"/>
      <span style="font-size:13px;color:#f1f5f9">Filtrar también las bonificaciones por los productos seleccionados</span>
    </label>`);
}

function generateBonusSimpleReport(cid, fromStr, toStr, includeBonus=true, prodIds=[], onlyFiltered=false, bonusFiltered=false) {
  const c   = S.clients.find(x => x.id === Number(cid));
  const biz = S.biz || {};

  function fmtD(d) {
    if (!d) return '—';
    if (String(d).includes('/')) {
      const parts = String(d).split(',')[0].split('/');
      if (parts.length===3) return `${parts[0].padStart(2,'0')}/${parts[1].padStart(2,'0')}/${parts[2].trim()}`;
      return String(d).split(',')[0];
    }
    const p = String(d).split('-');
    return p.length===3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
  }
  function toYMD(d) {
    if (!d) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(d))) return d;
    const p = String(d).split(',')[0].split('/');
    return p.length===3 ? `${p[2].trim()}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}` : d;
  }
  function getUnit(name, qty) {
    return '';
  }

  // Todos los pedidos del cliente en el rango (incluye cuentas anteriores vinculadas)
  const _effIdsRep1 = getEffectiveClientIds(cid);
  let allOrders = S.orders
    .filter(o => _effIdsRep1.includes(Number(o.clientId)) &&
      (o.status==='Confirmado'||o.status==='Concluido'))
    .sort((a,b)=>ordDateTs(a)-ordDateTs(b))
    .filter(o => { const ds=toYMD(o.date); return ds>=fromStr && ds<=toStr; });

  // Filtrar por productos seleccionados (si hay alguno)
  if (prodIds && prodIds.length) {
    allOrders = allOrders.filter(o => {
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

  if (!allOrders.length) { toast('No hay pedidos en el rango seleccionado', '#f59e0b'); return; }

  // Agrupar todos los pedidos por mes y mostrar con etiqueta de mes
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  // Construir lista plana de pedidos con bonificación marcada
  let grandTotal = 0;
  let entregaNum = 0;

  // Agrupar pedidos por mes
  const byMonth = {};
  allOrders.forEach(o => {
    const ds = toYMD(o.date);
    const key = ds ? ds.slice(0,7) : 'sin-fecha'; // YYYY-MM
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(o);
  });

  // Detectar cuáles pedidos tienen bonificación para numerar entregas
  const bonusOids = new Set(allOrders.filter(o=>o.bonusLines&&o.bonusLines.length).map(o=>o.id));

  const groupsHtml = Object.keys(byMonth).sort().map(monthKey => {
    const [y, m] = monthKey.split('-');
    const mesLabel = m ? `${MESES[parseInt(m)-1]} ${y}` : 'Sin fecha';
    const monthOrders = byMonth[monthKey];
    let monthTotal = 0;

    const ordersHtml = monthOrders.map(o => {
      let ordTotal = 0;
      const itemsForOrder = (onlyFiltered && prodIds && prodIds.length)
        ? o.items.filter(it => prodIds.includes(Number(it.productId||it.pid)))
        : o.items;
      const itemsHtml = itemsForOrder.map(it => {
        const pid = Number(it.productId||it.pid);
        const p = S.products.find(x=>x.id===pid);
        const us = Number(p?.unitSize)||1;
        const ul = p?.unitLabel||'unidad';
        const pr = it.customPrice!=null ? Number(it.customPrice)
                 : it.price!=null ? Number(it.price)
                 : cliPrice(cid, pid, p?.basePrice||0);
        const qty = Number(it.qty)||0;
        const sub = qty * us * pr;
        ordTotal += sub;
        const unitDesc = us > 1 ? ` × ${us} ${ul}` : '';
        const _ivaTagN = o.applyIva ? ' <span style="color:#2563eb">+IVA</span>' : '';
        return `<tr>
          <td style="padding:2px 0 2px 6px;font-size:12px;color:#1e293b">${p?p.name:'—'}</td>
          <td style="padding:2px 0;font-size:12px;color:#374151;text-align:center">${qty} ${getUnit(p?p.name:'',qty)}</td>
          <td style="padding:2px 0;font-size:11px;color:#64748b;text-align:center">${Q(pr)}/${ul}${unitDesc}${_ivaTagN}</td>
          <td style="padding:2px 0;font-size:12px;font-weight:600;color:#1e293b;text-align:right">${Q(sub)}</td>
        </tr>`;
      }).join('');
      monthTotal += ordTotal;
      grandTotal += ordTotal;

      const ocPart = o.oc ? ` · Orden: ${o.oc}` : '';
      let bonifRow = '';
      const bonusLinesToShow = (bonusFiltered && prodIds && prodIds.length)
        ? (o.bonusLines||[]).filter(bl => prodIds.includes(Number(bl.productId)))
        : (o.bonusLines||[]);
      if (includeBonus && bonusLinesToShow.length) {
        entregaNum++;
        const bItems = bonusLinesToShow.map(bl => {
          const p = S.products.find(x=>x.id===Number(bl.productId));
          const us = Number(p?.unitSize)||1;
          const ul = p?.unitLabel||'unidad';
          const sub = (bl.qty||0) * us * (bl.price||0);
          const spec = '';
          const _ivaTagRep = o.applyIva ? ' <span style="font-size:10px;color:#2563eb">+IVA</span>' : '';
          const comentarioBl = bl.ruleName ? `<div style="font-size:11px;color:#64748b;font-style:italic;margin-top:1px">💬 ${bl.ruleName}</div>` : '';
          return `<div>
            <div style="display:flex;justify-content:space-between;font-size:12px;color:#1e3a8a">
              <span>${bl.qty} ${p?p.name:'—'}${spec} × ${Q(bl.price||0)}/${ul}${_ivaTagRep}</span>
              <span style="font-weight:700">${Q(sub)}</span>
            </div>
            ${comentarioBl}
          </div>`;
        }).join('');
        bonifRow = `<div style="margin-top:6px;padding:6px 8px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:5px">
          <div style="font-size:11px;color:#1d4ed8;font-weight:700;margin-bottom:3px">🎁 Bonificación correspondiente (${fmtD(o.date)}):</div>
          ${bItems}
        </div>`;
      }

      return `<div style="margin-bottom:8px;padding:8px;background:#f8fafc;border-radius:6px;border-left:3px solid #94a3b8">
        <div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:4px">${fmtD(o.date)}${ocPart}</div>
        <table style="width:100%;border-collapse:collapse">
          ${itemsHtml}
          <tr style="border-top:1px solid #e2e8f0">
            <td colspan="3" style="font-size:12px;font-weight:600;color:#374151;padding:3px 0">Total pedido:</td>
            <td style="font-size:12px;font-weight:700;color:#1e293b;text-align:right">${Q(ordTotal)}</td>
          </tr>
        </table>
        ${bonifRow}
      </div>`;
    }).join('');

    return `<div style="margin-bottom:16px">
      <div style="background:#1e3a8a;padding:6px 12px;border-radius:6px;margin-bottom:8px">
        <span style="font-size:13px;font-weight:800;color:#fff">${mesLabel}</span>
        <span style="font-size:11px;color:#93c5fd;margin-left:8px">Total: ${Q(monthTotal)}</span>
      </div>
      ${ordersHtml}
    </div>`;
  }).join('');


  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Reporte de Pedidos - ${c?.name||''}</title>
  <style>body{font-family:Arial,sans-serif;margin:0;padding:16px;background:#fff;color:#1e293b}@media print{body{padding:8px}}</style>
  </head><body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #1e3a8a">
    <div>
      <div style="font-size:20px;font-weight:900;color:#1e3a8a">${biz.name||'Empresa'}</div>
      ${biz.exec?`<div style="font-size:12px;color:#64748b">${biz.exec}</div>`:''}
      ${biz.phone?`<div style="font-size:12px;color:#64748b">📞 ${biz.phone}</div>`:''}
    </div>
    <div style="text-align:right"><div style="font-size:11px;color:#64748b">Generado: ${fmtOrdDate((()=>{ const n=new Date(); return `${String(n.getDate()).padStart(2,'0')}/${String(n.getMonth()+1).padStart(2,'0')}/${n.getFullYear()}`; })())}</div></div>
  </div>
  <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 14px;margin-bottom:16px">
    <div style="font-size:16px;font-weight:800;color:#1e3a8a">📋 REPORTE DE PEDIDOS</div>
    <div style="font-size:14px;font-weight:700;color:#1e293b;margin-top:4px">${c?.name||''}</div>
    <div style="font-size:11px;color:#64748b;margin-top:2px">Período: ${fmtD(fromStr)} → ${fmtD(toStr)} · ${entregaNum} entrega(s)</div>
  </div>
  ${groupsHtml}
  <div style="background:#1e3a8a;padding:10px 14px;border-radius:8px;display:flex;justify-content:space-between;margin-top:8px">
    <span style="font-size:14px;font-weight:800;color:#fff">TOTAL GENERAL:</span>
    <span style="font-size:14px;font-weight:800;color:#fde68a">${Q(grandTotal)}</span>
  </div>
  <script>window.onload=function(){window.print()}<\/script>
  </body></html>`;

  const blob=new Blob([html],{type:'text/html'});
  window.open(URL.createObjectURL(blob),'_blank');
}
function generateBonusHistoryReport(cid, fromStr, toStr) {
  const c   = S.clients.find(x => x.id === Number(cid));
  const biz = S.biz || {};

  function fmtD(d) {
    if (!d) return '—';
    if (String(d).includes('/')) {
      const parts = String(d).split(',')[0].split('/');
      if (parts.length===3) return `${parts[0].padStart(2,'0')}/${parts[1].padStart(2,'0')}/${parts[2].trim()}`;
      return String(d).split(',')[0];
    }
    const p = String(d).split('-');
    return p.length===3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
  }
  function toYMD(d) {
    if (!d) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(d))) return d;
    const p = String(d).split(',')[0].split('/');
    return p.length===3 ? `${p[2].trim()}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}` : d;
  }
  function getUnit(name, qty) {
    return '';
  }

  // Obtener todos los pedidos del cliente ordenados por fecha (incluye cuentas anteriores vinculadas)
  const _effIdsRep2 = getEffectiveClientIds(cid);
  const allOrders = S.orders
    .filter(o => _effIdsRep2.includes(Number(o.clientId)) &&
      (o.status==='Confirmado'||o.status==='Concluido'))
    .sort((a,b)=>ordDateTs(a)-ordDateTs(b));

  // Obtener reglas del cliente — activas e inactivas
  const ownRulesRep = ((S.bonuses && (S.bonuses[cid] || S.bonuses[String(cid)])) || []).map(r => ({ rule:r, ownerCid: Number(cid) }));
  const sharedRulesRep = [];
  if (S.bonuses) {
    Object.keys(S.bonuses).forEach(ownerId => {
      if (Number(ownerId) === Number(cid)) return;
      (S.bonuses[ownerId]||[]).forEach(r => {
        if ((r.extraClientIds||[]).map(Number).includes(Number(cid))) sharedRulesRep.push({ rule:r, ownerCid: Number(ownerId) });
      });
    });
  }
  const rulesWithOwnerRep = [...ownRulesRep, ...sharedRulesRep];
  const rules = rulesWithOwnerRep.map(x=>x.rule);

  if (!rules.length) { toast('No hay reglas de bonificación configuradas', '#f59e0b'); return; }

  // Construir secciones por regla
  const sectionsHtml = rulesWithOwnerRep.map(({rule, ownerCid: _ruleOwnerCid}, ruleIndex) => {
    const ruleProds = getRuleProds(rule);

    // Usamos siempre el dueño REAL de la regla (más sus clientes adicionales si tiene),
    // sin importar desde la ficha de qué cliente se esté viendo este reporte.
    const ruleOrders = S.orders.filter(o => [_ruleOwnerCid, ...(rule.extraClientIds||[]).map(Number)].includes(Number(o.clientId)) &&
          (o.status==='Confirmado'||o.status==='Concluido')).sort((a,b)=>ordDateTs(a)-ordDateTs(b));

    const vigStart = rule.vigenciaStart || fromStr;
    const vigEnd   = rule.vigenciaEnd   || toStr;
    const effectiveFrom = vigStart > fromStr ? vigStart : fromStr;
    const effectiveTo   = vigEnd   < toStr   ? vigEnd   : toStr;

    // Usamos la VIGENCIA COMPLETA de la regla (no el rango elegido en el reporte) para
    // agrupar correctamente cada entrega con sus propios pedidos reales, sin importar
    // qué rango de fechas se esté consultando en este reporte.
    const vigOrders = ruleOrders.filter(o => {
      const ds = toYMD(o.date);
      if (ds < vigStart || ds > vigEnd) return false;
      // Incluir si tiene productos de la meta
      const tieneMetaProds = o.items.some(it => ruleProds.includes(Number(it.productId||it.pid)));
      // O si la bonificación fue generada específicamente con el botón "Enviar bonificación" de ESTA regla
      const tieneBonifDeEstaRegla = o.bonusLines && o.bonusLines.length &&
        o.bonusLines.some(bl => Number(bl.fromRuleId) === Number(ruleIndex));
      return tieneMetaProds || tieneBonifDeEstaRegla;
    });

    if (!vigOrders.length) return '';

    const allGroups = [];
    let currentGroup = [];
    vigOrders.forEach(o => {
      currentGroup.push(o);
      if (o.bonusLines && o.bonusLines.length &&
          o.bonusLines.some(bl => Number(bl.fromRuleId) === Number(ruleIndex))) {
        allGroups.push({ orders: [...currentGroup], bonusOrd: o });
        currentGroup = [];
      }
    });
    if (currentGroup.length) allGroups.push({ orders: currentGroup, bonusOrd: null });

    // Mostrar solo los grupos relevantes al rango de fechas elegido en este reporte:
    // una entrega completada se muestra si su fecha de entrega cae dentro del rango,
    // y el grupo "en curso" se muestra si tiene actividad dentro del rango o si no hay
    // fechas de filtro aplicadas.
    const _repFrom = fromStr || '0000-00-00';
    const _repTo   = toStr   || '9999-99-99';
    const groups = allGroups.filter(g => {
      if (g.bonusOrd) {
        const ds = toYMD(g.bonusOrd.date);
        return ds >= _repFrom && ds <= _repTo;
      }
      // Grupo en curso: mostrar si tiene algún pedido dentro del rango, o si no se filtró por fecha
      return (!fromStr && !toStr) || g.orders.some(o => { const ds = toYMD(o.date); return ds >= _repFrom && ds <= _repTo; });
    });

    if (!groups.length) return '';

    let entregaNum = 0;
    const groupsHtml = groups.map(g => {
      const isCurrent = !g.bonusOrd;
      entregaNum++;
      const startDate = fmtD(g.orders[0].date);
      const endDate   = g.bonusOrd ? fmtD(g.bonusOrd.date) : '...';

      const prodTotals = {};
      g.orders.forEach(o => {
        o.items.forEach(it => {
          const pid = Number(it.productId||it.pid);
          if (!ruleProds.includes(pid)) return;
          const p = S.products.find(x=>x.id===pid);
          if (!prodTotals[pid]) prodTotals[pid] = { name:p?p.name:'—', qty:0, orders:[] };
          prodTotals[pid].qty += Number(it.qty);
          const existing = prodTotals[pid].orders.find(x=>x.oid===o.id);
          if (existing) existing.qty += Number(it.qty);
          else prodTotals[pid].orders.push({ oid:o.id, date:o.date, oc:o.oc||'', qty:Number(it.qty) });
        });
      });

      const prodsHtml = Object.values(prodTotals).map(pt => {
        const rows = pt.orders.map(po =>
          `<tr>
            <td style="padding:2px 0 2px 10px;font-size:12px;color:#374151">${fmtD(po.date)}${po.oc?' · Orden: '+po.oc:''}</td>
            <td style="padding:2px 0;font-size:12px;color:#1e293b;font-weight:600;text-align:right">${po.qty} ${getUnit(pt.name,po.qty)}</td>
          </tr>`
        ).join('');
        return `<div style="margin-bottom:8px;padding:8px;background:#f8fafc;border-radius:6px;border-left:3px solid #64748b">
          <div style="font-weight:700;font-size:12px;color:#1e293b;margin-bottom:4px">${pt.name}</div>
          <table style="width:100%;border-collapse:collapse">
            ${rows}
            <tr style="border-top:1px solid #e2e8f0">
              <td style="font-size:12px;font-weight:600;color:#374151;padding:3px 0">Total:</td>
              <td style="font-size:12px;font-weight:700;color:#1e293b;text-align:right">${pt.qty} ${getUnit(pt.name,pt.qty)}</td>
            </tr>
          </table>
        </div>`;
      }).join('');

      let bonifHtml = '';
      if (g.bonusOrd && g.bonusOrd.bonusLines && g.bonusOrd.bonusLines.length) {
        // Barra de cumplimiento
        let rTargets;
        if (rule.ruleType === 'pool') {
          rTargets = [{productId:null,threshold:rule.threshold,isPool:true,poolProds:rule.poolProds||[]}];
        } else if (rule.ruleType === 'poolEq') {
          rTargets = [{productId:null,threshold:rule.threshold,isPool:true,poolEqProds:rule.poolEqProds||[],isPoolEq:true}];
        } else if (rule.ruleType === 'mix') {
          rTargets = [
            ...(rule.mixIndTargets||[]),
            ...(rule.mixPoolProds&&rule.mixPoolProds.length&&rule.mixPoolThreshold ? [{productId:null,threshold:rule.mixPoolThreshold,isPool:true,poolProds:rule.mixPoolProds,mixPoolTitle:rule.mixPoolTitle}] : []),
            ...(rule.mixEqProds&&rule.mixEqProds.length&&rule.mixEqThreshold ? [{productId:null,threshold:rule.mixEqThreshold,isPool:true,poolEqProds:rule.mixEqProds,isPoolEq:true,mixEqTitle:rule.mixEqTitle}] : [])
          ];
        } else {
          rTargets = (rule.targets||[]);
        }
        const barHtml = rTargets.map(t => {
          const tp = t.isPool ? null : S.products.find(x=>x.id===Number(t.productId));
          const tName = tp?tp.name:(t.label||'Total');

          // Función para obtener unidad (última palabra del nombre)
          function getUnitWord(name, qty) {
            if (!name) return '';
            const words = name.trim().split(/\s+/);
            const last = words[words.length-1];
            if (qty <= 1) return last;
            const up = last === last.toUpperCase();
            const l = last.toLowerCase();
            if (l.endsWith('ón')) return last.slice(0,-2)+(up?'ONES':'ones');
            if (l.endsWith('el')||l.endsWith('or')) return last+(up?'ES':'es');
            return last+(up?'S':'s');
          }

          if (t.isPoolEq) {
            // Pool con equivalencias: calcular por producto + total
            const eqProds = t.poolEqProds||[];
            let totalEq = 0;
            const prodQtys = eqProds.map(ep => {
              let qty = 0;
              g.orders.forEach(o => o.items.forEach(it => {
                if (Number(it.productId||it.pid)===Number(ep.productId)) qty+=Number(it.qty);
              }));
              const p2 = S.products.find(x=>x.id===Number(ep.productId));
              const equiv = Math.round(qty*(Number(ep.factor)||1)*100)/100;
              totalEq += equiv;
              return { name: p2?p2.name:'Producto', qty, factor: ep.factor, unitLabel: ep.unitLabel||'' };
            });
            const meta = t.threshold||0;
            const pct  = meta>0 ? Math.min(100,Math.round(totalEq/meta*100)) : 100;
            const col  = progressColor(pct);
            const restante = Math.max(0, meta - totalEq);
            // Título con parte común
            const nombres = prodQtys.map(p=>p.name);
            const { parteComun, partesDistintas } = splitTituloComun(nombres);
            const tituloHtml = t.mixEqTitle
              ? t.mixEqTitle
              : (parteComun && partesDistintas ? `${parteComun}<br>${partesDistintas}` : `${nombres.join(' / ')}`);
            const consumidoRaw = prodQtys.map(p=>p.qty>0?`${p.qty} ${p.unitLabel ? p.unitLabel : getUnitWord(p.name,p.qty)}`:null).filter(Boolean).join(' / ');
            const eqUnitLabels = [...new Set(prodQtys.map(p=>p.unitLabel).filter(Boolean))];
            const restanteStr = eqUnitLabels.length ? `${restante} ${eqUnitLabels.join(' / ')}` : String(restante);
            return `<div style="margin-bottom:8px;padding:8px;background:#f0f4ff;border-radius:6px;border-left:3px solid ${col}">
              <div style="font-size:12px;font-weight:700;color:#1e293b;margin-bottom:4px">${tituloHtml}</div>
              <div style="display:flex;justify-content:space-between;font-size:12px;color:#374151;margin-bottom:4px">
                <span>Meta: <span style="color:#1e293b;font-weight:700">${meta}</span></span>
                <span style="font-weight:700">${pct}%${pct>=100?' ✅':''}</span>
              </div>
              ${consumidoRaw?`<div style="font-size:12px;color:#64748b;margin-bottom:4px">${consumidoRaw}</div>`:''}
              <div style="background:#e2e8f0;border-radius:4px;height:7px;margin-bottom:6px">
                <div style="background:${col};width:${pct}%;height:7px;border-radius:4px"></div>
              </div>
              <div style="font-size:12px;color:#374151">Restante: <span style="font-weight:700;color:${restante>0?'#dc2626':'#374151'}">${restanteStr||'0'}</span></div>
            </div>`;
          }

          // Pool compartido: detalle por producto
          if (t.isPool && !t.isPoolEq) {
            const poolPids = (t.poolProds||[]).map(Number);
            let totalPool = 0;
            const prodQtys = poolPids.map(pid => {
              let qty = 0;
              g.orders.forEach(o => o.items.forEach(it => {
                if (Number(it.productId||it.pid)===pid) qty+=Number(it.qty);
              }));
              const p2 = S.products.find(x=>x.id===pid);
              totalPool += qty;
              return { name: p2?p2.name:'Producto', qty };
            }).filter(p=>p.qty>0);
            const meta = t.threshold||0;
            const pct  = meta>0 ? Math.min(100,Math.round(totalPool/meta*100)) : 100;
            const col  = progressColor(pct);
            const restante = Math.max(0, meta - totalPool);
            // Detectar si tienen texto en común
            const nombres = prodQtys.map(p=>p.name);
            const { comunLen } = splitTituloComun(nombres);
            const tieneComun = comunLen > 0 && nombres.length > 1;
            // Título (prioriza el título manual configurado en la regla)
            let tituloPool;
            if (t.mixPoolTitle) {
              tituloPool = t.mixPoolTitle;
            } else if (tieneComun) {
              const parteComun = nombres[0].split(' ').slice(0,comunLen).join(' ');
              const partesDistintas = nombres.map(n=>n.split(' ').slice(comunLen).join(' ')).join(' / ');
              tituloPool = partesDistintas
                ? `${parteComun}<br>${partesDistintas}`
                : `${parteComun}`;
            } else {
              tituloPool = nombres.join('<br>') || 'Pool compartido';
            }
            // Progreso: X% + productos en una línea "5 LACA TONEL / 1 ACRÍLICO TONEL"
            const lineasCons = prodQtys.map(p=>{
              const nombreCorto = tieneComun ? p.name.split(' ').slice(comunLen).join(' ') : p.name;
              return `${p.qty} ${nombreCorto}`;
            }).join(' / ');
            const consumidoHtml = `${pct}%<br><span style="color:#64748b">${lineasCons}</span>`;
            const restanteHtml = String(restante);
            return `<div style="margin-bottom:8px;padding:8px;background:#f0f4ff;border-radius:6px;border-left:3px solid ${col}">
              <div style="font-size:12px;font-weight:700;color:#1e293b;margin-bottom:4px">${tituloPool}</div>
              <div style="display:flex;justify-content:space-between;font-size:12px;color:#374151;margin-bottom:4px">
                <span>Meta: <span style="color:#1e293b;font-weight:700">${meta}</span></span>
                <span style="font-weight:700">${pct}%${pct>=100?' ✅':''}</span>
              </div>
              ${lineasCons?`<div style="font-size:12px;color:#64748b;margin-bottom:4px">${lineasCons}</div>`:''}
              <div style="background:#e2e8f0;border-radius:4px;height:7px;margin-bottom:6px">
                <div style="background:${col};width:${pct}%;height:7px;border-radius:4px"></div>
              </div>
              <div style="font-size:12px;color:#374151">Restante: <span style="font-weight:700;color:${restante>0?'#dc2626':'#374151'}">${restante}</span></div>
            </div>`;
          }

          // Individual
          let logro = 0;
          g.orders.forEach(o => o.items.forEach(it => {
            const pid = Number(it.productId||it.pid);
            if (pid===Number(t.productId)) logro+=Number(it.qty);
          }));
          const meta = t.threshold||0;
          const pct  = meta>0 ? Math.min(100,Math.round(logro/meta*100)) : 100;
          const col  = progressColor(pct);
          const restante = Math.max(0, meta - logro);
          const unitCons = getUnitWord(tName, logro);
          const unitRest = getUnitWord(tName, restante);
          const unitMeta = getUnitWord(tName, meta);
          return `<div style="margin-bottom:8px;padding:8px;background:#f0f4ff;border-radius:6px;border-left:3px solid ${col}">
            <div style="font-size:12px;font-weight:700;color:#1e293b;margin-bottom:4px">${tName}</div>
            <div style="display:flex;justify-content:space-between;font-size:12px;color:#374151;margin-bottom:4px">
              <span>Meta: <span style="color:#1e293b;font-weight:700">${meta}</span></span>
              <span style="font-weight:700">${logro}/${meta} (${pct}%)${pct>=100?' ✅':''}</span>
            </div>
            <div style="background:#e2e8f0;border-radius:4px;height:7px;margin-bottom:6px">
              <div style="background:${col};width:${pct}%;height:7px;border-radius:4px"></div>
            </div>
            <div style="font-size:12px;color:#374151">Restante: <span style="font-weight:700;color:${restante>0?'#dc2626':'#374151'}">${restante}</span></div>
          </div>`;
        }).join('');
        // Sin precio
        const items = g.bonusOrd.bonusLines.map(bl => {
          const p = S.products.find(x=>x.id===Number(bl.productId));
          const spec = '';
          return `${bl.qty} ${p?p.name:'—'}${spec}`;
        }).join('<br>');
        bonifHtml = `<div style="margin-top:8px;padding:8px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px">
          ${barHtml}
          <div style="font-size:11px;color:#1d4ed8;font-weight:700;margin-bottom:3px">🎁 Bonificación correspondiente (${fmtD(g.bonusOrd.date)}):</div>
          <div style="font-size:12px;color:#1e293b">${items}</div>
        </div>`;
      }
      const headerBg  = isCurrent ? '#fef9c3' : '#dbeafe';
      const headerCol = isCurrent ? '#854d0e' : '#1d4ed8';
      const label     = isCurrent ? `En curso — ${startDate} → ...` : `Entrega #${entregaNum} — ${startDate} → ${endDate}`;
      const badge     = isCurrent ? '⏳' : '✅';

      // Barra de progreso para período en curso
      let cursoBarHtml = '';
      if (isCurrent) {
        let rTargets;
        if (rule.ruleType === 'pool') {
          rTargets = [{productId:null,threshold:rule.threshold,isPool:true,poolProds:rule.poolProds||[]}];
        } else if (rule.ruleType === 'poolEq') {
          rTargets = [{productId:null,threshold:rule.threshold,isPool:true,poolEqProds:rule.poolEqProds||[],isPoolEq:true}];
        } else if (rule.ruleType === 'mix') {
          rTargets = [
            ...(rule.mixIndTargets||[]),
            ...(rule.mixPoolProds&&rule.mixPoolProds.length&&rule.mixPoolThreshold ? [{productId:null,threshold:rule.mixPoolThreshold,isPool:true,poolProds:rule.mixPoolProds,mixPoolTitle:rule.mixPoolTitle}] : []),
            ...(rule.mixEqProds&&rule.mixEqProds.length&&rule.mixEqThreshold ? [{productId:null,threshold:rule.mixEqThreshold,isPool:true,poolEqProds:rule.mixEqProds,isPoolEq:true,mixEqTitle:rule.mixEqTitle}] : [])
          ];
        } else {
          rTargets = (rule.targets||[]);
        }
        // Función unidad local
        function getUnitWordCurso(name, qty) {
          if (!name) return '';
          const words = name.trim().split(/\s+/);
          const last = words[words.length-1];
          if (qty <= 1) return last;
          const up = last === last.toUpperCase();
          const l = last.toLowerCase();
          if (l.endsWith('ón')) return last.slice(0,-2)+(up?'ONES':'ones');
          if (l.endsWith('el')||l.endsWith('or')) return last+(up?'ES':'es');
          return last+(up?'S':'s');
        }
        cursoBarHtml = `<div style="margin-top:8px;padding:8px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px">` +
          rTargets.map(t => {
            const tp = t.isPool ? null : S.products.find(x=>x.id===Number(t.productId));
            const tName = tp?tp.name:(t.label||'Total');

            // Pool con equivalencias
            if (t.isPoolEq) {
              const eqProds = t.poolEqProds||[];
              let totalEq = 0;
              const prodQtys = eqProds.map(ep => {
                let qty = 0;
                g.orders.forEach(o => o.items.forEach(it => {
                  if (Number(it.productId||it.pid)===Number(ep.productId)) qty+=Number(it.qty);
                }));
                const p2 = S.products.find(x=>x.id===Number(ep.productId));
                totalEq += Math.round(qty*(Number(ep.factor)||1)*100)/100;
                return { name:p2?p2.name:'Producto', qty };
              });
              const meta = t.threshold||0;
              const pct  = meta>0 ? Math.min(100,Math.round(totalEq/meta*100)) : 0;
              const col  = progressColor(pct);
              // Título parte común
              const nombres = prodQtys.map(p=>p.name);
              const { parteComun, partesDistintas } = splitTituloComun(nombres);
              const tituloEq = t.mixEqTitle ? t.mixEqTitle : (parteComun && partesDistintas ? `${parteComun}<br>${partesDistintas}` : `${nombres.join(' / ')}`);
              const detalleEq = prodQtys.filter(p=>p.qty>0).map((p,i)=>`${p.qty} ${eqProds[i]&&eqProds[i].unitLabel ? eqProds[i].unitLabel : getUnitWordCurso(p.name,p.qty)}`).join(' / ');
              const restanteEq = Math.max(0, meta - totalEq);
              const curEqUniqueLabels = [...new Set((eqProds||[]).map(ep=>ep.unitLabel).filter(Boolean))];
              const restanteDetalle = curEqUniqueLabels.length ? `${restanteEq} ${curEqUniqueLabels.join(' / ')}` : String(restanteEq);
              return `<div style="margin-bottom:8px;padding:8px;background:#f0f4ff;border-radius:6px;border-left:3px solid ${col}">
                <div style="font-size:12px;font-weight:700;color:#1e293b;margin-bottom:4px">${tituloEq}</div>
                <div style="display:flex;justify-content:space-between;font-size:11px;color:#374151;margin-bottom:3px">
                  <span>Meta: ${meta}</span>
                  <span style="color:${col};font-weight:700">${totalEq} / ${meta} (${pct}%)${pct>=100?' ✅':''}</span>
                </div>
                ${detalleEq?`<div style="font-size:11px;color:#64748b;margin-bottom:3px">${detalleEq}</div>`:''}
                <div style="background:#e2e8f0;border-radius:4px;height:7px;margin-bottom:3px">
                  <div style="background:${col};width:${pct}%;height:7px;border-radius:4px"></div>
                </div>
                <div style="font-size:11px;color:${restanteEq>0?'#dc2626':'#374151'}">Restante: ${restanteDetalle||'0'}</div>
              </div>`;
            }

            let logro = 0;
            g.orders.forEach(o => o.items.forEach(it => {
              const pid = Number(it.productId||it.pid);
              if (t.isPool) { if((t.poolProds||[]).includes(pid)) logro+=Number(it.qty); }
              else { if(pid===Number(t.productId)) logro+=Number(it.qty); }
            }));
            const meta = t.threshold||0;
            const pct  = meta>0 ? Math.min(100,Math.round(logro/meta*100)) : 0;
            const col  = progressColor(pct);
            const restante = Math.max(0, meta - logro);
            // Título del pool compartido: nombres de los productos, con parte común si aplica
            let tituloPoolCurso = tName;
            if (t.isPool) {
              if (t.mixPoolTitle) {
                tituloPoolCurso = t.mixPoolTitle;
              } else {
                const nombresPool = (t.poolProds||[]).map(pid2 => {
                  const p2 = S.products.find(x=>x.id===Number(pid2));
                  return p2 ? p2.name : 'Producto';
                });
                if (nombresPool.length) {
                  const { parteComun: pc2, partesDistintas: pd2 } = splitTituloComun(nombresPool);
                  tituloPoolCurso = (pc2 && pd2) ? `${pc2}<br>${pd2}` : nombresPool.join(' / ');
                }
              }
            }
            return `<div style="margin-bottom:8px;padding:8px;background:#f0f4ff;border-radius:6px;border-left:3px solid ${col}">
              <div style="font-size:12px;font-weight:700;color:#1e293b;margin-bottom:4px">${tituloPoolCurso}</div>
              <div style="display:flex;justify-content:space-between;font-size:11px;color:#374151;margin-bottom:3px">
                <span>Meta: ${meta} ${getUnit(tName,meta)}</span>
                <span style="color:${col};font-weight:700">${logro} / ${meta} (${pct}%)${pct>=100?' ✅':''}</span>
              </div>
              <div style="background:#e2e8f0;border-radius:4px;height:7px;margin-bottom:3px">
                <div style="background:${col};width:${pct}%;height:7px;border-radius:4px"></div>
              </div>
              <div style="font-size:11px;color:${restante>0?'#dc2626':'#374151'}">Restante: ${restante} ${getUnit(tName,restante)}</div>
            </div>`;
          }).join('') + `</div>`;
      }

      return `<div style="margin-bottom:12px">
        <div style="background:${headerBg};padding:6px 10px;border-radius:6px;margin-bottom:6px;display:flex;justify-content:space-between">
          <span style="font-size:12px;font-weight:700;color:${headerCol}">${label}</span>
          <span>${badge}</span>
        </div>
        ${prodsHtml}${bonifHtml}${cursoBarHtml}
      </div>`;
    }).join('');

    const vigs = rule.vigenciaStart ? `Vigencia: ${fmtD(rule.vigenciaStart)} → ${rule.vigenciaEnd?fmtD(rule.vigenciaEnd):'activa'}` : '';
    return `<div style="margin-bottom:20px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">
      <div style="background:#1e3a8a;padding:10px 14px">
        <div style="font-weight:800;font-size:14px;color:#fff">${rule.name||'Sin nombre'}${rule.inactive?' (inactiva)':''}</div>
        ${vigs?`<div style="font-size:11px;color:#93c5fd;margin-top:2px">\uD83D\uDCC5 ${vigs}</div>`:''}
        <div style="font-size:11px;color:#93c5fd;margin-top:2px">${groups.filter(g=>g.bonusOrd).length} entrega(s)</div>
      </div>
      <div style="padding:12px 14px">${groupsHtml||'<div style="font-size:12px;color:#64748b">Sin pedidos en el período.</div>'}</div>
    </div>`;
  }).filter(Boolean).join('');

  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Reporte de Bonificaciones - ${c?.name||''}</title>
  <style>body{font-family:Arial,sans-serif;margin:0;padding:16px;background:#fff;color:#1e293b}@media print{body{padding:8px}}</style>
  </head><body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #1e3a8a">
    <div>
      <div style="font-size:20px;font-weight:900;color:#1e3a8a">${biz.name||'Empresa'}</div>
      ${biz.exec?`<div style="font-size:12px;color:#64748b">${biz.exec}</div>`:''}
      ${biz.phone?`<div style="font-size:12px;color:#64748b">📞 ${biz.phone}</div>`:''}
    </div>
    <div style="text-align:right"><div style="font-size:11px;color:#64748b">Generado: ${fmtOrdDate((()=>{ const n=new Date(); return `${String(n.getDate()).padStart(2,'0')}/${String(n.getMonth()+1).padStart(2,'0')}/${n.getFullYear()}`; })())}</div></div>
  </div>
  <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 14px;margin-bottom:16px">
    <div style="font-size:16px;font-weight:800;color:#1e3a8a">📋 REPORTE DE BONIFICACIONES</div>
    <div style="font-size:14px;font-weight:700;color:#1e293b;margin-top:4px">${c?.name||''}</div>
    <div style="font-size:11px;color:#64748b;margin-top:2px">Período del reporte: ${fmtD(fromStr)} → ${fmtD(toStr)}</div>
  </div>
  ${sectionsHtml}
  <script>window.onload=function(){window.print()}<\/script>
  </body></html>`;

  const blob=new Blob([html],{type:'text/html'});
  window.open(URL.createObjectURL(blob),'_blank');
}

function addBonusRule(cid) { openBonusModal(cid, null); }
function editBonusRule(cid, ri) { openBonusModal(cid, ri); }

function toggleBonusActive(cid, ri) {
  const rules = S.bonuses?.[cid] || S.bonuses?.[String(cid)];
  const r = rules?.[ri]; if (!r) return;
  if (r.inactive) {
    // Reactivar — resetear contadores y empezar período nuevo
    askConfirm('¿Activar regla?', 'El conteo empezará desde cero. El historial se conserva.', () => {
      r.inactive = false;
      resetBonusRule(r, 0, new Date().toISOString().split('T')[0]);
      save(); toast('✅ Regla activada — nuevo período iniciado', '#10b981');
      if (!window._cliOpen) window._cliOpen = {};
      window._cliOpen[Number(cid)] = true;
      renderClients();
    }, 'Activar', '#10b981');
  } else {
    // Desactivar
    r.inactive = true;
    save(); toast('⏸ Regla desactivada', '#f59e0b');
    if (!window._cliOpen) window._cliOpen = {};
    window._cliOpen[Number(cid)] = true;
    renderClients();
  }
}

function delBonusRule(cid, ri) {
  askConfirm('Eliminar esta regla?', 'Se perdera el progreso acumulado.', () => {
    if (S.bonuses && S.bonuses[cid]) S.bonuses[cid].splice(ri,1);
    save(); window._cliOpen[cid]=true; renderClients();
  });
}

function addBonusManual(cid, ri, tidx, sign=1) {
  const inp = document.getElementById(`bm-${cid}-${ri}-${tidx}`);
  const val = Number(inp?.value);
  if (!val||val<=0) return toast('Ingresa una cantidad válida','#f59e0b');
  const r = S.bonuses?.[cid]?.[ri]; if (!r) return;
  const delta = val * sign;
  if (tidx === 'pool' || r.ruleType==='pool') {
    r.manualUnits = Math.max(0, (Number(r.manualUnits)||0)+delta);
  } else {
    const ti = Number(tidx);
    if (r.targets && r.targets[ti]) r.targets[ti].manualUnits = Math.max(0, (Number(r.targets[ti].manualUnits)||0)+delta);
  }
  inp.value='';
  save(); toast(sign>0?'✅ Unidades agregadas':'✅ Unidades quitadas','#10b981');
  window._cliOpen[cid]=true; renderClients();
}

function resetBonusRule(r, deliveredOid, deliveredDate) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  // Parsear fecha del pedido que completó el umbral como startDate del nuevo ciclo
  let startStr = todayStr;
  if (deliveredDate) {
    const raw = String(deliveredDate).split(',')[0].trim();
    const parts = raw.split('/');
    if (parts.length === 3) {
      startStr = `${parts[2].trim()}-${String(parts[1]).padStart(2,'0')}-${String(parts[0]).padStart(2,'0')}`;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      startStr = raw;
    }
  }

  // Guardar historial
  if (!r.history) r.history = [];
  r.history.push({
    startDate: r.startDate || '',
    endDate:   r.deadline  || '',
    deliveredOid,
    deliveredDate: deliveredDate || todayStr
  });

  // Calcular nuevo período con la misma duración, iniciando en la fecha del pedido
  if (r.deadline && r.startDate) {
    const origStart = new Date(r.startDate + 'T00:00:00');
    const origEnd   = new Date(r.deadline  + 'T00:00:00');
    const durDays   = Math.round((origEnd - origStart) / (1000*60*60*24));
    const newStart  = new Date(startStr + 'T00:00:00');
    const newEnd    = new Date(newStart);
    newEnd.setDate(newEnd.getDate() + durDays);
    r.startDate = startStr;
    r.deadline  = `${newEnd.getFullYear()}-${String(newEnd.getMonth()+1).padStart(2,'0')}-${String(newEnd.getDate()).padStart(2,'0')}`;
  } else {
    r.startDate = startStr;
  }

  // Resetear contadores — _resetOid para que calcBonusProgress filtre correctamente
  r.manualUnits = 0;
  if (r.targets) r.targets.forEach(t => { t.manualUnits = 0; });
  r.resetTs   = today.toISOString();
  r._resetOid = Number(deliveredOid) || 0;
}

function deliverBonus(cid, ri) {
  askConfirm('¿Marcar bonificación como entregada?', 'El contador reiniciará desde hoy con el mismo período.', () => {
    const _cid = Number(cid);
    const _ri  = Number(ri);
    const rules = S.bonuses?.[_cid] || S.bonuses?.[String(_cid)];
    const r = rules?.[_ri];
    if (!r) { toast('No se encontró la regla', '#ef4444'); return; }
    const lastOrd = [...S.orders].filter(o=>Number(o.clientId)===_cid).sort((a,b)=>b.id-a.id)[0];
    const lastOid = lastOrd?.id || 0;
    resetBonusRule(r, lastOid, new Date().toISOString().split('T')[0]);
    // Asegurar que se guarda en la key correcta
    if (!S.bonuses[_cid]) S.bonuses[_cid] = S.bonuses[String(_cid)];
    save(); toast('🎁 Bonificación entregada — nuevo período iniciado','#10b981');
    if (!window._cliOpen) window._cliOpen = {};
    window._cliOpen[_cid] = true;
    renderClients();
  }, 'Confirmar');
  const btn = document.getElementById('confirm-ok-btn');
  if (btn) btn.style.background='#10b981';
}
function verifyOldBonusOrders(cid) {
  cid = Number(cid);
  if (!S.bonuses || !S.bonuses[cid]) return { verified: 0, remaining: 0 };
  const rules = S.bonuses[cid];
  const candidateOrders = S.orders.filter(o =>
    Number(o.clientId) === cid &&
    o.bonusLines && o.bonusLines.length &&
    o.bonusLines.some(bl => !bl.fromRuleId && !bl.exceptional)
  ).sort((a,b) => ordDateTs(a) - ordDateTs(b));

  const originalOrders = S.orders;
  let verifiedCount = 0;

  candidateOrders.forEach(ord => {
    const cutoffTs = ordDateTs(ord);
    // Simular el mundo hasta la fecha de este pedido (inclusive), para revisar
    // si en ese momento alguna regla del cliente ya había cumplido su meta.
    S.orders = originalOrders.filter(o => ordDateTs(o) <= cutoffTs);
    try {
      let matchedRuleIdx = null;
      rules.forEach((r, ri) => {
        if (matchedRuleIdx !== null) return;
        if (isBonusComplete(cid, r)) matchedRuleIdx = ri;
      });
      if (matchedRuleIdx !== null) {
        ord.bonusLines.forEach(bl => {
          if (!bl.fromRuleId && !bl.exceptional) bl.fromRuleId = matchedRuleIdx;
        });
        verifiedCount++;
      }
    } finally {
      S.orders = originalOrders;
    }
  });

  if (verifiedCount > 0) save();
  const remaining = candidateOrders.length - verifiedCount;
  return { verified: verifiedCount, remaining };
}

function runVerifyOldBonusForClient(cid) {
  const res = verifyOldBonusOrders(cid);
  if (res.verified === 0 && res.remaining === 0) {
    toast('No hay bonificaciones antiguas por revisar', '#64748b');
    return;
  }
  toast(`✅ ${res.verified} verificada(s) automáticamente${res.remaining ? `, ${res.remaining} pendiente(s) por revisar manualmente` : ''}`, '#10b981');
  renderClients();
}

function checkBonusAlert(cid, oid, onDone, extraOrd) {
  if (!S.bonuses || !S.bonuses[cid]) return false;
  // Si el pedido ya tiene una bonificación cargada, no mostrar la alerta
  if (extraOrd && extraOrd.bonusLines && extraOrd.bonusLines.length) return false;
  const rules = S.bonuses[cid];
  const declined = extraOrd?.bonusDeclined || [];
  const triggered = rules.map((r,ri)=>({r,ri})).filter(({r,ri})=>
    !r.inactive &&
    !declined.includes(ri) &&
    isBonusComplete(cid, r, extraOrd)
  );
  if (!triggered.length) return false;

  const { r, ri } = triggered[0];

  // Construir filas editables de bonificación
  const prodOpts = S.products.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  const bonusRowsHtml = (r.bonusItems||[]).map((bi,i) => {
    const pOpts = S.products.map(p=>`<option value="${p.id}" ${p.id===Number(bi.productId)?'selected':''}>${p.name}</option>`).join('');
    const defaultPr = bi.price != null ? bi.price : cliPrice(cid, bi.productId, S.products.find(x=>x.id===Number(bi.productId))?.basePrice||0);
    return `<div class="ba-row" style="background:#0d1f0d;border:1px solid #1a3a1a;border-radius:8px;padding:6px;margin-bottom:6px">
      <div style="display:grid;grid-template-columns:1fr 45px 70px;gap:4px;align-items:center;margin-bottom:4px">
        <select class="ba-pid" style="background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:6px;padding:4px;font-size:11px;min-width:0">${pOpts}</select>
        <input type="number" class="ba-qty" value="${bi.qty}" min="1" style="background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:6px;padding:4px;font-size:11px;width:100%"/>
        <input type="number" class="ba-price" value="${defaultPr}" min="0" step="0.01" placeholder="Precio" style="background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:6px;padding:4px;font-size:11px;width:100%"/>
      </div>
      <input class="ba-comment" value="${bi.comment||''}" placeholder="Comentario (ej: Por consumo Trim. Q2)" style="width:100%;background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:6px;padding:4px 8px;font-size:11px"/>
    </div>`;
  }).join('');

  document.getElementById('bonus-modal-body').innerHTML = `
    <div style="font-size:24px;margin-bottom:6px;text-align:center">🎁</div>
    <div style="font-size:14px;font-weight:800;color:#10b981;margin-bottom:4px;text-align:center">¡Corresponde bonificación!</div>
    <div style="font-size:11px;color:#94a3b8;margin-bottom:10px;text-align:center">${r.name||'Regla de bonificación'}</div>
    <div style="font-size:11px;color:#94a3b8;font-weight:700;margin-bottom:5px">PRODUCTOS A AGREGAR (editable):</div>
    <div id="ba-rows">${bonusRowsHtml}</div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <button onclick="bonusAlertCancel()" style="flex:1;padding:10px;border-radius:9px;border:1px solid #475569;background:transparent;color:#f1f5f9;font-weight:700;cursor:pointer;font-size:13px">No agregar</button>
      <button onclick="bonusAlertConfirm()" style="flex:1;padding:10px;border-radius:9px;border:none;background:#10b981;color:#fff;font-weight:800;cursor:pointer;font-size:13px">✓ Agregar</button>
    </div>`;
  document.getElementById('bonus-modal').style.display = 'flex';

  window._bonusAlertConfirmCb = () => {
    const ord = S.orders.find(o=>o.id===oid); if (!ord) return;
    const rows = document.querySelectorAll('.ba-row');
    if (!ord.bonusLines) ord.bonusLines = [];
    const deliveredItems = [];
    rows.forEach(row => {
      const pid      = Number(row.querySelector('.ba-pid')?.value);
      const qty      = Number(row.querySelector('.ba-qty')?.value)||1;
      const priceRaw = row.querySelector('.ba-price')?.value;
      const pr       = priceRaw !== '' && priceRaw != null ? Number(priceRaw) : cliPrice(cid, pid, S.products.find(x=>x.id===pid)?.basePrice||0);
      const comment  = row.querySelector('.ba-comment')?.value.trim() || '';
      const ruleLabel = comment || r.name || '';
      ord.bonusLines.push({ productId:pid, qty, price:pr, ruleName:ruleLabel, fromRuleId: Number(ri) });
      deliveredItems.push({ productId:pid, qty, price:pr });
    });
    ord.status = 'Confirmado';
    const clientOfOrder3 = S.clients.find(c=>c.id===Number(cid));
    if (clientOfOrder3 && clientOfOrder3.isProspect) {
      delete clientOfOrder3.isProspect;
      toast('✅ "' + clientOfOrder3.name + '" se convirtió en cliente automáticamente', '#10b981');
    }

    // Reset automático con nuevo período desde hoy
    resetBonusRule(r, oid, ord.date);
    // Agregar items entregados al último historial
    if (r.history && r.history.length) {
      r.history[r.history.length - 1].deliveredItems = deliveredItems;
    }

    document.getElementById('bonus-modal').style.display = 'none';
    save(); toast('🎁 Bonificación agregada — nuevo período iniciado','#10b981');
    if (onDone) onDone();
  };

  window._bonusAlertCancelCb = () => {
    // Marcar este pedido como "bonificación rechazada" para no volver a preguntar
    const ord = S.orders.find(o=>o.id===oid);
    if (ord) {
      if (!ord.bonusDeclined) ord.bonusDeclined = [];
      // Guardar el índice de la regla rechazada para este pedido
      if (!ord.bonusDeclined.includes(ri)) ord.bonusDeclined.push(ri);
      ord.status = 'Confirmado';
      const clientOfOrder4 = S.clients.find(c=>c.id===Number(ord.clientId));
      if (clientOfOrder4 && clientOfOrder4.isProspect) {
        delete clientOfOrder4.isProspect;
        toast('✅ "' + clientOfOrder4.name + '" se convirtió en cliente automáticamente', '#10b981');
      }
      save();
    }
    document.getElementById('bonus-modal').style.display = 'none';
    if (onDone) onDone();
  };
  return true;
}


// ── Trasladado desde el bloque "MODAL DE CONFIRMACIÓN" (mal etiquetado) ──
function addPoolEqRow(pid, factor) {
  const prodOpts = S.products.map(p=>`<option value="${p.id}" ${String(p.id)===String(pid||'')?'selected':''}>${p.name}</option>`).join('');
  const row = document.createElement('div');
  row.className = 'br-pooleq-row';
  row.style.cssText = 'display:flex;gap:5px;align-items:center;margin-bottom:5px';
  row.innerHTML = `
    <select class="br-eqpid" style="flex:1;min-width:0;background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:7px;padding:5px;font-size:11px">${prodOpts}</select>
    <input type="number" class="br-eqfactor" value="${factor||1}" min="0.01" step="0.01" placeholder="Factor" title="1 galón=1, 1 litro=0.5" style="width:70px;background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:7px;padding:5px;font-size:12px"/>
    <button onclick="this.closest('.br-pooleq-row').remove()" style="background:#ef444420;border:1px solid #ef4444;border-radius:6px;color:#ef4444;padding:3px 7px;font-size:12px;cursor:pointer">x</button>`;
  document.getElementById('br-pooleq-rows').appendChild(row);
}

function addMixIndRow(pid, threshold) {
  const prodOpts = S.products.map(p=>`<option value="${p.id}" ${String(p.id)===String(pid||'')?'selected':''}>${p.name}</option>`).join('');
  const row = document.createElement('div');
  row.className = 'br-mix-ind-row';
  row.style.cssText = 'display:flex;gap:5px;align-items:center;margin-bottom:5px';
  row.innerHTML = `
    <select class="br-mix-ind-pid" style="flex:1;min-width:0;background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:7px;padding:5px;font-size:11px">${prodOpts}</select>
    <input type="number" class="br-mix-ind-thr" value="${threshold||''}" min="1" placeholder="Meta" style="width:70px;background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:7px;padding:5px;font-size:12px"/>
    <button onclick="this.closest('.br-mix-ind-row').remove()" style="background:#ef444420;border:1px solid #ef4444;border-radius:6px;color:#ef4444;padding:3px 7px;font-size:12px;cursor:pointer">x</button>`;
  document.getElementById('br-mix-ind-rows').appendChild(row);
}

function addMixEqRow(pid, factor, unitLabel) {
  const prodOpts = S.products.map(p=>`<option value="${p.id}" ${String(p.id)===String(pid||'')?'selected':''}>${p.name}</option>`).join('');
  const row = document.createElement('div');
  row.className = 'br-mix-eq-row';
  row.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin-bottom:8px;padding:5px;background:#12162a;border-radius:7px';
  row.innerHTML = `
    <div style="display:flex;gap:5px;align-items:center">
      <select class="br-mix-eq-pid" style="flex:1;min-width:0;background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:7px;padding:5px;font-size:11px">${prodOpts}</select>
      <input type="number" class="br-mix-eq-factor" value="${factor||1}" min="0.01" step="0.01" placeholder="Factor" style="width:70px;background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:7px;padding:5px;font-size:12px"/>
      <button onclick="this.closest('.br-mix-eq-row').remove()" style="background:#ef444420;border:1px solid #ef4444;border-radius:6px;color:#ef4444;padding:3px 7px;font-size:12px;cursor:pointer">x</button>
    </div>
    <input type="text" class="br-mix-eq-unit" value="${unitLabel||''}" placeholder="Nombre/unidad para el reporte (ej: GALONES, LITROS) — opcional" style="width:100%;background:#0d0f18;color:#94a3b8;border:1px solid #2a3050;border-radius:6px;padding:4px 6px;font-size:11px"/>`;
  document.getElementById('br-mix-eq-rows').appendChild(row);
}

function addMixPoolRow(pid) {
  const prodOpts = S.products.map(p=>`<option value="${p.id}" ${String(p.id)===String(pid||'')?'selected':''}>${p.name}</option>`).join('');
  const row = document.createElement('div');
  row.className = 'br-mix-pool-row';
  row.style.cssText = 'display:flex;gap:5px;align-items:center;margin-bottom:5px';
  row.innerHTML = `
    <select class="br-mix-pool-pid" style="flex:1;background:#0d0f18;color:#f1f5f9;border:1px solid #2a3050;border-radius:7px;padding:5px;font-size:12px">${prodOpts}</select>
    <button onclick="this.closest('.br-mix-pool-row').remove()" style="background:#ef444420;border:1px solid #ef4444;border-radius:6px;color:#ef4444;padding:3px 7px;font-size:12px;cursor:pointer">x</button>`;
  document.getElementById('br-mix-pool-rows').appendChild(row);
}

function sendBonusOrder(cid, ri) {
  const _cid = Number(cid);
  const rules = S.bonuses?.[_cid] || S.bonuses?.[String(_cid)];
  const r = rules?.[Number(ri)];
  if (!r) { toast('No se encontró la regla', '#ef4444'); return; }
  if (!(r.bonusItems||[]).length) { toast('Esta regla no tiene bonificación configurada', '#f59e0b'); return; }

  // Preparar pedido nuevo
  editingOid = null;
  ordItems = [{ pid:'', qty:1, price:null }];
  ordComments = [''];
  ordConditions = [];
  // Cargar las líneas de bonificación de la regla, marcadas con la regla de origen
  ordBonusLines = (r.bonusItems||[]).map(bi => {
    const p = S.products.find(x=>x.id===Number(bi.productId));
    return { productId: Number(bi.productId), qty: Number(bi.qty)||1, price: bi.price!=null?bi.price:(p?p.basePrice||0:0), ruleName: r.name||'Bonificación', fromRuleId: Number(ri) };
  });
  window._bonusConfirmed = true;
  window._pendingBonusReset = { cid: _cid, ri: Number(ri) };

  goTab('order');
  setTimeout(() => {
    const cli = S.clients.find(c => c.id === _cid);
    // Asignar cliente en los campos
    const cliHid = document.getElementById('ord-cli');
    const cliTxt = document.getElementById('ord-cli-txt');
    if (cliHid) cliHid.value = _cid;
    if (cliTxt && cli) cliTxt.value = cli.name;
    // Mostrar el formulario (igual que en duplicar)
    const body = document.getElementById('ord-body');
    const ph   = document.getElementById('ord-ph');
    const info = document.getElementById('ord-cli-info');
    if (body) body.style.display = 'block';
    if (ph)   ph.style.display   = 'none';
    if (info && cli) info.innerHTML = (cli.phone?'📞 '+cli.phone:'') + (cli.address?' &nbsp;📍 '+cli.address:'');
    refreshDeliverySel(_cid);
    setComments(['']);
    const ivaIncEl = document.getElementById('ord-iva-inc'); if (ivaIncEl) ivaIncEl.checked = true;
    renderItems();
    renderOrdBonusRows();
    renderConditionFields();
    refreshTotalWithIVA();
    onDeliveryInputChange();
    toast('🎁 Bonificación cargada — completa y guarda el pedido','#10b981');
  }, 300);
}

