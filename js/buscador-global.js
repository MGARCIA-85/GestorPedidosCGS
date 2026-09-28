// ═══════════════════════════════════════════════════════
//  BUSCADOR GLOBAL
// ═══════════════════════════════════════════════════════
function toggleGlobalSearch(e) {
  if (e) e.stopPropagation();
  const wrap = document.getElementById('global-search-wrap');
  const inp  = document.getElementById('global-search-inp');
  const isOpen = wrap.style.display !== 'none';
  wrap.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    inp.value = '';
    const res = document.getElementById('global-search-results');
    if (_searchHistory.length) {
      const _hicons = {client:'👥',order:'📋',product:'🏷️',route:'🚚'};
      const _hicons2 = {client:'👥',order:'📋',product:'🏷️',route:'🚚'};
      res.innerHTML = `<div style="padding:5px 12px;font-size:10px;color:#64748b;font-weight:700;background:#161929;letter-spacing:.5px">🕐 BÚSQUEDAS RECIENTES</div>` +
        _searchHistory.map(h=>{
          const e = typeof h==='object'?h:{label:h,type:'',id:null};
          const icon = _hicons2[e.type]||'🔍';
          const nav = e.type==='client'?'gsGoClient('+e.id+')'
            :e.type==='order'?'gsGoOrder('+e.id+')'
            :e.type==='product'?'gsGoProd('+e.id+')'
            :e.type==='route'?'gsGoRoute('+e.id+')'
            :'runGlobalSearch()';
          return '<div class="gs-opt" onclick="'+nav+'" style="display:flex;justify-content:space-between;align-items:center"><span style="color:#94a3b8;font-size:13px">'+icon+' '+e.label+'</span><span style="color:#475569;font-size:11px">↗</span></div>';
        }).join('');
      res.innerHTML = `<div style="padding:5px 12px;font-size:10px;color:#64748b;font-weight:700;background:#161929;letter-spacing:.5px">🕐 BÚSQUEDAS RECIENTES</div>` +
        _searchHistory.map(h=>{
          const e = typeof h==='object'?h:{label:h,type:'',id:null};
          const icon = _hicons[e.type]||'🔍';
          const nav = e.type==='client'?'gsGoClient('+e.id+')'
            :e.type==='order'?'gsGoOrder('+e.id+')'
            :e.type==='product'?'gsGoProd('+e.id+')'
            :e.type==='route'?'gsGoRoute('+e.id+')'
            :'runGlobalSearch()';
          return '<div class="gs-opt" onclick="'+nav+'" style="display:flex;justify-content:space-between;align-items:center"><span style="color:#94a3b8;font-size:13px">'+icon+' '+e.label+'</span><span style="color:#475569;font-size:11px">↗</span></div>';
        }).join('');
      res.style.display = 'block';
    } else {
      res.style.display = 'none';
    }
    setTimeout(()=>inp.focus(),100);
  }
}

function highlightMatch(text, q) {
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return text;
  return text.slice(0,idx)+'<mark style="background:#f59e0b;color:#111;border-radius:2px;padding:0 2px">'+text.slice(idx,idx+q.length)+'</mark>'+text.slice(idx+q.length);
}

function gsGoClient(cid) {
  const c = S.clients.find(x=>x.id===Number(cid));
  if (c) saveSearchHistory(c.name, 'client', cid);
  const wrap = document.getElementById('global-search-wrap');
  if (wrap) wrap.style.display = 'none';
  openClientCard(cid);
}

function gsGoOrder(oid) {
  const o = S.orders.find(x=>x.id===Number(oid));
  if (o) saveSearchHistory(o.clientName+(o.quote?' · '+o.quote:''), 'order', oid);
  const wrap = document.getElementById('global-search-wrap');
  if (wrap) wrap.style.display = 'none';
  const fCli = document.getElementById('f-cli');
  const fSt  = document.getElementById('f-st');
  if (fCli) fCli.value = '';
  if (fSt)  fSt.value  = '';
  goTab('list');
  setTimeout(()=>{
    renderList();
    setTimeout(()=>{
      const card = document.querySelector(`#lst-body [data-id="${oid}"]`);
      if (card) {
        card.style.outline = '2px solid #f59e0b';
        card.style.boxShadow = '0 0 0 4px #f59e0b33';
        card.scrollIntoView({behavior:'smooth', block:'center'});
        setTimeout(()=>{ card.style.outline=''; card.style.boxShadow=''; }, 2500);
      }
    }, 300);
  }, 250);
}

function gsGoProd(pid) {
  const p = S.products.find(x=>x.id===Number(pid));
  if (p) saveSearchHistory(p.name+(p.presentation?' ('+p.presentation+')':''), 'product', pid);
  const wrap = document.getElementById('global-search-wrap');
  if (wrap) wrap.style.display = 'none';
  goTab('products');
  setTimeout(()=>{
    renderProducts();
    setTimeout(()=>{
      const card = document.querySelector(`#prod-body [data-id="${pid}"]`);
      if (card) {
        card.style.outline = '2px solid #f59e0b';
        card.style.boxShadow = '0 0 0 4px #f59e0b33';
        card.scrollIntoView({behavior:'smooth', block:'center'});
        setTimeout(()=>{ card.style.outline=''; card.style.boxShadow=''; }, 2500);
      }
    }, 200);
  }, 250);
}

function gsGoRoute(rid) {
  const r = (S.routes||[]).find(x=>x.id===Number(rid));
  if (r) saveSearchHistory(r.name, 'route', rid);
  const wrap = document.getElementById('global-search-wrap');
  if (wrap) wrap.style.display = 'none';
  goTab('routes');
  setTimeout(()=>{
    if (!window._routeOpen) window._routeOpen = {};
  if (!window._routeSel) window._routeSel = {};  // pedidos seleccionados por ruta
    window._routeOpen[rid] = true;
    renderRoutes();
    // Scroll al card de la ruta
    setTimeout(()=>{
      const cards = document.querySelectorAll('#routes-list .card');
      const idx   = (S.routes||[]).findIndex(r=>r.id===rid);
      if (idx>=0 && cards[idx]) cards[idx].scrollIntoView({behavior:'smooth',block:'start'});
    }, 100);
  }, 250);
}

// Normalizar texto quitando tildes para búsqueda
function normalizeStr(s) {
  return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}

let _searchHistory = JSON.parse(localStorage.getItem('gs_history')||'[]');

function saveSearchHistory(label, type, id) {
  if (!label) return;
  const entry = { label, type, id };
  _searchHistory = [entry, ..._searchHistory.filter(h=>!(h.label===label&&h.type===type))].slice(0,8);
  localStorage.setItem('gs_history', JSON.stringify(_searchHistory));
}

function runGlobalSearch() {
  const raw = document.getElementById('global-search-inp').value.trim();
  const q   = normalizeStr(raw);
  const res = document.getElementById('global-search-results');

  // Sin texto — mostrar historial
  if (!raw) {
    if (_searchHistory.length) {
      res.innerHTML = `<div style="padding:5px 12px;font-size:10px;color:#64748b;font-weight:700;background:#161929;letter-spacing:.5px">🕐 BÚSQUEDAS RECIENTES</div>` +
        _searchHistory.map(h=>`<div class="gs-opt" onclick="document.getElementById('global-search-inp').value='${h.replace(/'/g,"\\'")}';runGlobalSearch()" style="display:flex;justify-content:space-between;align-items:center">
          <span style="color:#94a3b8;font-size:13px">${h}</span>
          <span style="color:#475569;font-size:11px">↗</span>
        </div>`).join('');
      res.style.display = 'block';
    } else {
      res.style.display = 'none';
    }
    return;
  }

  let html = '';
  const hl = t => highlightMatch(t, raw);
  const match = s => normalizeStr(s).includes(q);

  // ── Clientes ──────────────────────────────────────
  const clis = S.clients.filter(x => match(x.name) || match(x.phone||''));
  if (clis.length) {
    html += `<div style="padding:5px 12px;font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;background:#161929;letter-spacing:.5px">👥 Clientes</div>`;
    html += clis.slice(0,6).map(x =>
      `<div class="gs-opt" onclick="gsGoClient(${x.id})">
        <div style="font-weight:700;${priorityNameStyle(x.priority,'#f1f5f9')}">${hl(x.name)}</div>
        ${x.phone?`<div style="font-size:11px;color:#64748b">📞 ${hl(x.phone)}</div>`:''}
      </div>`).join('');
  }

  // ── Productos ─────────────────────────────────────
  const prods = S.products.filter(x => match(x.name) || match(x.presentation||'') || match(x.family||''));
  if (prods.length) {
    html += `<div style="padding:5px 12px;font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;background:#161929;letter-spacing:.5px">🏷️ Productos</div>`;
    html += prods.slice(0,6).map(x =>
      `<div class="gs-opt" onclick="gsGoProd(${x.id})">
        <div style="font-weight:700;color:#f1f5f9">${hl(x.name)} <span style="font-size:11px;color:#64748b">${x.presentation||''}</span></div>
        <div style="font-size:11px;color:#f59e0b">${Q(x.basePrice)} ${x.family?'· '+x.family:''}</div>
      </div>`).join('');
  }

  // ── Rutas ─────────────────────────────────────────
  const rts = (S.routes||[]).filter(x => match(x.name));

  // ── Pedidos ───────────────────────────────────────
  const ords = [...S.orders].sort((a,b)=>{ const td=ordDateTs(b)-ordDateTs(a); return td!==0?td:b.id-a.id; }).filter(x =>
    match(x.clientName) ||
    match(x.quote||'') ||
    match(x.oc||'') ||
    ((x.comments||[]).some(cm=>match(cm))) ||
    x.items.some(it=>{ const p=S.products.find(p=>p.id===(it.productId||Number(it.pid))); return p&&match(p.name); })
  );
  if (ords.length) {
    html += `<div style="padding:5px 12px;font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;background:#161929;letter-spacing:.5px">📋 Pedidos (${ords.length})</div>`;
    html += ords.map(x => {
      const sapCalc = x.sapMode ? getSapCalcForOrder(x) : null;
      const sc   = x.status==='Concluido'?'#4ade80':x.status==='Cotización'?'#60a5fa':'#fb923c';
      const route = x.routeId ? (S.routes||[]).find(r=>r.id===x.routeId) : null;
      return `<div class="gs-opt" onclick="gsGoOrder(${x.id})">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
          <div>${orderInfoHtml(x, {showName:true, link:false, nameSize:13, delivery:true, hl})}</div>
          <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">
            ${route?`<span style="font-size:10px;color:#f59e0b;font-weight:700">(RUTA)</span>`:''}
            <span style="font-size:10px;color:${sc};font-weight:700;border:1px solid ${sc};padding:0 5px;border-radius:8px">${x.status}</span>
          </div>
        </div>
        ${orderBodyHtml(x, sapCalc, {})}
      </div>`;
    }).join('');
  }

  // ── Rutas ─────────────────────────────────────────
  if (rts.length) {
    html += `<div style="padding:5px 12px;font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;background:#161929;letter-spacing:.5px">🚚 Rutas</div>`;
    html += rts.slice(0,5).map(x => {
      const tot = (x.orders||[]).map(id=>S.orders.find(o=>o.id===id)).filter(Boolean)
        .reduce((s,o)=>s+orderTotalWithIva(o),0);
      return `<div class="gs-opt" onclick="gsGoRoute(${x.id})">
        <div style="font-weight:700;color:#f59e0b">🚚 ${hl(x.name)}</div>
        ${x.desc?`<div style="font-size:11px;color:#64748b">${x.desc}</div>`:''}
        <div style="font-size:11px;color:#60a5fa;margin-top:2px">${(x.orders||[]).length} pedidos · <span style="color:#f59e0b">${Q(tot)}</span></div>
      </div>`;
    }).join('');
  }

  if (!html) html = `<div style="padding:14px;text-align:center;color:#64748b;font-size:13px">Sin resultados para "<strong>${raw}</strong>"</div>`;
  res.innerHTML = html;
  res.style.display = 'block';
}

// Cerrar al tocar fuera
document.addEventListener('click', e => {
  const wrap = document.getElementById('global-search-wrap');
  const btn  = e.target.closest('button[onclick*="toggleGlobalSearch"]');
  if (wrap && wrap.style.display !== 'none' && !wrap.contains(e.target) && !btn) {
    wrap.style.display = 'none';
  }
});
