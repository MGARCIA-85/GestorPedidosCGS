// ═══════════════════════════════════════════════════════
//  PRODUCTOS
// ═══════════════════════════════════════════════════════
let prodSortMode = 'order';

function sortProds(mode) {
prodSortMode = mode;
if (mode==='alpha')      S.products.sort((a,b) => (a.name+a.presentation).localeCompare(b.name+b.presentation,'es'));
if (mode==='alphaDesc')  S.products.sort((a,b) => (b.name+b.presentation).localeCompare(a.name+a.presentation,'es'));
if (mode==='family')     S.products.sort((a,b) => {
  const famList = S.familyList || [];
  const ia = famList.indexOf((a.family||'').trim());
  const ib = famList.indexOf((b.family||'').trim());
  const posA = ia === -1 ? famList.length : ia; // sin familia (o no listada) va al final
  const posB = ib === -1 ? famList.length : ib;
  return posA - posB || (a.name+a.presentation).localeCompare(b.name+b.presentation,'es');
});
if (mode==='recent')     S.products.reverse();
document.getElementById('prod-drag-hint').style.display = mode==='manual' ? 'block' : 'none';
save(); renderProducts();
}

function setupPreview() {
['np-n','np-pres','np-ul','np-us','np-pr'].forEach(id => {
const el = document.getElementById(id);
if (el) el.addEventListener('input', updatePreview);
});
}

function updatePreview() {
const name = document.getElementById('np-n').value.trim();
const pres = document.getElementById('np-pres').value.trim();
const ul   = document.getElementById('np-ul').value.trim() || 'unidad';
const us   = Number(document.getElementById('np-us').value) || 1;
const pr   = Number(document.getElementById('np-pr').value) || 0;
const box  = document.getElementById('np-preview');
const colorEl = document.getElementById('np-color');
const color = colorEl ? colorEl.value : '';
if (!name || !pr) { box.style.display='none'; return; }
const sub = pr*us;
const nameStyled = color ? `<span style="color:${color};font-weight:800">${name}</span>` : `<strong>${name}</strong>`;
box.setAttribute('style', `background:#161929;border-radius:8px;padding:8px;display:block${color?`;border-left:4px solid ${color}`:''}`);
box.innerHTML = us>1
? `✅ <strong>Vista previa:</strong> 1 ${pres||'presentación'} = ${us} ${ul}s × ${Q(pr)} = <strong style="color:#10b981">${Q(sub)}</strong> por ${pres} — ${nameStyled}`
: `✅ <strong>Vista previa:</strong> ${nameStyled} (${pres||'—'}) → ${Q(pr)} por ${ul}`;
}

function cancelNewProduct() {
  ['np-n','np-fam','np-pres','np-ul','np-us','np-pr'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const prev = document.getElementById('np-preview'); if (prev) prev.style.display = 'none';
  collapseForm('prod-form-body');
}

const PROD_COLOR_PALETTE = ['#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e','#10b981','#14b8a6','#06b6d4','#3b82f6','#6366f1','#8b5cf6','#a855f7','#d946ef','#ec4899','#f43f5e'];

function renderColorPalette(containerId, hiddenInputId, selectedColor) {
  const cont = document.getElementById(containerId);
  if (!cont) return;
  let html = `<div onclick="selectProdColor('${containerId}','${hiddenInputId}','')" style="width:30px;height:30px;border-radius:8px;cursor:pointer;background:#1e2640;border:2px solid ${!selectedColor?'#fff':'#2a3050'};display:flex;align-items:center;justify-content:center;font-size:14px;color:#64748b">✕</div>`;
  PROD_COLOR_PALETTE.forEach(c => {
    const isSel = selectedColor === c;
    html += `<div onclick="selectProdColor('${containerId}','${hiddenInputId}','${c}')" style="width:30px;height:30px;border-radius:8px;cursor:pointer;background:${c};border:2px solid ${isSel?'#fff':'transparent'};box-shadow:${isSel?'0 0 0 2px '+c:'none'}"></div>`;
  });
  cont.innerHTML = html;
}

function selectProdColor(containerId, hiddenInputId, color) {
  const input = document.getElementById(hiddenInputId);
  if (input) input.value = color;
  renderColorPalette(containerId, hiddenInputId, color);
  if (hiddenInputId === 'np-color') updatePreview();
}

function addProduct() {
const name = document.getElementById('np-n').value.trim();
const fam  = document.getElementById('np-fam').value.trim();
const pres = document.getElementById('np-pres').value.trim();
const ul   = document.getElementById('np-ul').value.trim() || 'unidad';
const us   = Number(document.getElementById('np-us').value) || 1;
const pr   = Number(document.getElementById('np-pr').value);
const colorEl = document.getElementById('np-color');
const color = colorEl ? colorEl.value : '';
if (!name) return alert('Ingresa el nombre del producto.');
if (pr == null || isNaN(pr) || document.getElementById('np-pr').value.trim() === '') return alert('Ingresa el precio por unidad.');
const dup = S.products.find(p => p.name.toLowerCase() === name.toLowerCase() && (p.presentation||'').toLowerCase() === (pres||'').toLowerCase());
if (dup) { toast('⚠️ Ya existe este producto', '#ef4444'); return; }
const id = genId();
S.products.push({ id, name, family:fam||'', presentation:pres, unitLabel:ul, unitSize:us, basePrice:pr, color });
S.clients.forEach(c => { S.cp[c.id] = { ...S.cp[c.id], [id]: pr }; });
save();
['np-n','np-fam','np-pres','np-ul','np-us','np-pr'].forEach(i => document.getElementById(i).value='');
if (colorEl) colorEl.value = '';
renderColorPalette('np-color-pal', 'np-color', '');
document.getElementById('np-preview').style.display = 'none';
collapseForm('prod-form-body');
toast('🏷️ Producto agregado'); renderProducts(); renderPriceLists();
}

function renderProducts() {
document.getElementById('prod-title').textContent = `Productos (${S.products.length})`;
const body = document.getElementById('prod-body');
if (!S.products.length) { body.innerHTML='<div style="text-align:center;color:#64748b;padding:20px">Sin productos.</div>'; return; }
body.innerHTML = '';
const list = S.products; // ya ordenados por sortProds
let lastFamHeader = null;
// Actualizar selector de familias (Nuevo Producto) desde la lista maestra de Configuración
const npFamSel = document.getElementById('np-fam');
if(npFamSel){
const curVal = npFamSel.value;
npFamSel.innerHTML = '<option value="">— Selecciona una familia —</option>' + (S.familyList||[]).map(f=>`<option value="${f}">${f}</option>`).join('');
npFamSel.value = curVal;
}
list.forEach(p => {
// Encabezado de categoría si modo es family
if (prodSortMode === 'family') {
  const fam = p.family && p.family.trim() ? p.family.trim() : '— Sin departamento —';
  if (fam !== lastFamHeader) {
    lastFamHeader = fam;
    const h = document.createElement('div');
    h.style.cssText = 'font-size:10px;font-weight:800;color:#f59e0b;text-transform:uppercase;letter-spacing:1px;padding:10px 0 4px';
    h.textContent = fam + ((S.restrictedFamilies||[]).includes(fam) ? ' 🔒' : '');
    body.appendChild(h);
  }
}
const div = document.createElement('div');
div.className = 'ir sortable-item'; div.id = 'pr-'+p.id; div.dataset.id = p.id;
const ul       = p.unitLabel||'unidad';
const us       = Number(p.unitSize)||1;
const convLine = us>1 ? `<div style="font-size:11px;color:#64748b">1 ${p.presentation} = ${us} ${ul}s → <strong style="color:#10b981">${Q(p.basePrice*us)}</strong> c/u</div>` : '';
const dh       = prodSortMode==='manual' ? `<span class="drag-handle" title="Arrastrar">≡</span>` : '';
if (p.inactive) div.style.opacity = '0.55';
div.innerHTML = `
<div style="display:flex;align-items:center;gap:8px">
${dh}
<div>
<div style="font-weight:700;font-size:14px;color:${p.inactive?'#94a3b8':(p.color||'#f1f5f9')}">${p.name}${p.inactive?' <span style="font-size:10px;background:#2a1f00;color:#f59e0b;border-radius:4px;padding:1px 7px;font-weight:700">🔒 BLOQUEADO</span>':''}</div>
${p.family ? `<span style="font-size:10px;background:#1e3a5f;color:#93c5fd;border-radius:4px;padding:1px 7px;margin-right:4px">${p.family}</span>` : ''}
${p.presentation ? `<span class="tag" style="display:inline-block;margin:2px 0">${p.presentation}</span>` : ''}
${(p.specs && p.specs.filter(s=>s.active).length > 1) ? `<span style="font-size:10px;background:#1e2333;color:#a78bfa;border-radius:4px;padding:1px 7px;margin-left:4px">⚖️ ${p.specs.filter(s=>s.active).length} especificaciones</span>` : ''}
<div style="font-size:12px;color:#64748b">Precio: <span style="color:#f59e0b;font-weight:800">${Q(p.basePrice)}</span>/${ul}</div>
${convLine}
</div>
</div>
<div style="display:flex;gap:6px">
<button class="bs" onclick="editProd(${p.id})">✏️</button>
<button class="bs" onclick="toggleProdActive(${p.id})" title="${p.inactive?'Desbloquear':'Bloquear'}">${p.inactive?'🔓':'🔒'}</button>
<button class="br" onclick="delProd(${p.id})">🗑</button>
</div>`;
body.appendChild(div);
});
if (prodSortMode==='manual') setupDrag(body,'products');
}

function editProd(id) {
const p   = S.products.find(x=>x.id===id);
ensureProductSpecs(p);
window._editingSpecs = window._editingSpecs || {};
window._editingSpecs[id] = p.specs.map(s => ({...s}));
const row = document.getElementById('pr-'+id);
row.className = 'card'; row.style.display='block';
row.innerHTML = `
<label class="lbl">Nombre</label>
<input class="inp" id="epn-${id}" value="${p.name}"/>
<label class="lbl">Familia / Categoría</label>
<select class="sel" id="epfam-${id}" style="width:100%;margin-bottom:12px">
<option value="">— Selecciona una familia —</option>
${(S.familyList||[]).map(f=>`<option value="${f}" ${p.family===f?'selected':''}>${f}</option>`).join('')}
</select>
<label style="display:flex;align-items:center;gap:8px;background:#2a1f00;border:1px solid #f59e0b;border-radius:8px;padding:8px 10px;margin-bottom:12px;cursor:pointer">
<input type="checkbox" id="epfamrestricted-${id}" ${p.family && (S.restrictedFamilies||[]).includes(p.family.trim()) ? 'checked' : ''} style="width:17px;height:17px;accent-color:#f59e0b"/>
<span style="font-size:12px;color:#f59e0b;font-weight:700">🔒 Familia restringida (requiere permiso especial del cliente)</span>
</label>
<label style="display:flex;align-items:center;gap:8px;background:#1a1030;border:1px solid #7c3aed;border-radius:8px;padding:8px 10px;margin-bottom:12px;cursor:pointer">
<input type="checkbox" id="epfacturakilo-${id}" ${p.facturaPorKilo ? 'checked' : ''} style="width:17px;height:17px;accent-color:#7c3aed"/>
<span style="font-size:12px;color:#a78bfa;font-weight:700">⚖️ Se factura por kilo (para "Calcular para SAP")</span>
</label>
<label class="lbl">Unidad de precio</label>
<input class="inp" id="epul-${id}" value="${p.unitLabel||'unidad'}"/>
<label class="lbl">Unidades por especificación</label>
<input class="inp" id="epus-${id}" type="number" step="0.001" min="0.001" value="${p.unitSize||1}"/>
<label class="lbl">Precio por unidad (Q)</label>
<input class="inp" id="eppr-${id}" type="number" step="0.01" value="${p.basePrice}"/>
<label class="lbl">Especificaciones <span style="color:#64748b;font-weight:400">(peso y SKU por variante — marca cuáles están activas)</span></label>
<div id="epspecs-${id}"></div>
<button type="button" onclick="addProdSpecRow(${id})" style="width:100%;padding:8px;background:transparent;border:1px dashed #3b82f6;border-radius:6px;color:#60a5fa;font-size:12px;cursor:pointer;margin-bottom:12px">+ Agregar especificación</button>
<label class="lbl">Color del producto (selector de pedidos)</label>
<input type="hidden" id="epcolor-${id}" value="${p.color||''}"/>
<div id="epcolor-pal-${id}" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px"></div>
<div class="two">
<button class="bg" onclick="saveProd(${id})">✔ Guardar</button>
<button class="bs" onclick="renderProducts()">Cancelar</button>
</div>`;
renderColorPalette('epcolor-pal-'+id, 'epcolor-'+id, p.color||'');
renderProdSpecsRows(id);
}

function renderProdSpecsRows(id) {
  const wrap = document.getElementById('epspecs-'+id);
  if (!wrap) return;
  const specs = (window._editingSpecs && window._editingSpecs[id]) || [];
  wrap.innerHTML = specs.map((s,i) => `
    <div style="display:flex;gap:6px;align-items:center;background:#161929;border:1px solid #2a3050;border-radius:8px;padding:8px;margin-bottom:6px;flex-wrap:wrap">
      <input class="inp spec-label-${id}" data-i="${i}" placeholder="Especificación" value="${(s.label||'').replace(/"/g,'&quot;')}" style="flex:2;min-width:110px;margin:0"/>
      <input class="inp spec-weight-${id}" data-i="${i}" type="number" step="0.001" min="0" placeholder="Peso kg" value="${s.weightKg??''}" style="flex:1;min-width:75px;margin:0"/>
      <input class="inp spec-sku-${id}" data-i="${i}" placeholder="SKU" value="${(s.sku||'').replace(/"/g,'&quot;')}" style="flex:1;min-width:95px;margin:0"/>
      <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:${s.active?'#4ade80':'#64748b'};white-space:nowrap">
        <input type="checkbox" class="spec-active-${id}" data-i="${i}" ${s.active?'checked':''} style="width:15px;height:15px;accent-color:#10b981"/> Activa
      </label>
      <button type="button" onclick="removeProdSpecRow(${id},${i})" style="background:none;border:none;color:#ef4444;font-size:16px;cursor:pointer;padding:0 4px">✕</button>
    </div>`).join('') || '<div style="font-size:11px;color:#64748b;margin-bottom:8px">Sin especificaciones. Agrega al menos una.</div>';
  wrap.querySelectorAll(`.spec-label-${id},.spec-weight-${id},.spec-sku-${id},.spec-active-${id}`).forEach(el => {
    el.addEventListener('input', () => syncProdSpecsFromDOM(id));
    el.addEventListener('change', () => syncProdSpecsFromDOM(id));
  });
}

function syncProdSpecsFromDOM(id) {
  const wrap = document.getElementById('epspecs-'+id);
  if (!wrap) return;
  const specs = window._editingSpecs[id];
  wrap.querySelectorAll(`.spec-label-${id}`).forEach(el => { const i=Number(el.dataset.i); if(specs[i]) specs[i].label = el.value; });
  wrap.querySelectorAll(`.spec-weight-${id}`).forEach(el => { const i=Number(el.dataset.i); if(specs[i]) specs[i].weightKg = el.value!==''?Number(el.value):null; });
  wrap.querySelectorAll(`.spec-sku-${id}`).forEach(el => { const i=Number(el.dataset.i); if(specs[i]) specs[i].sku = el.value; });
  wrap.querySelectorAll(`.spec-active-${id}`).forEach(el => { const i=Number(el.dataset.i); if(specs[i]) specs[i].active = el.checked; });
}

function addProdSpecRow(id) {
  syncProdSpecsFromDOM(id);
  const specs = window._editingSpecs[id];
  const maxId = specs.reduce((m,s)=>Math.max(m,Number(s.id)||0),0);
  specs.push({ id: maxId+1, label:'', weightKg:null, sku:'', active:true });
  renderProdSpecsRows(id);
}

function removeProdSpecRow(id, idx) {
  syncProdSpecsFromDOM(id);
  const specs = window._editingSpecs[id];
  if (specs.length <= 1) { toast('Debe quedar al menos una especificación','#f59e0b'); return; }
  specs.splice(idx,1);
  renderProdSpecsRows(id);
}

function saveProd(id) {
const p = S.products.find(x=>x.id===id);
p.name         = document.getElementById('epn-'+id).value.trim();
p.family       = document.getElementById('epfam-'+id).value.trim();
p.unitLabel    = document.getElementById('epul-'+id).value.trim() || 'unidad';
p.unitSize     = Number(document.getElementById('epus-'+id).value) || 1;
p.basePrice    = Number(document.getElementById('eppr-'+id).value);
p.facturaPorKilo = document.getElementById('epfacturakilo-'+id)?.checked || false;
syncProdSpecsFromDOM(id);
const specsIn = (window._editingSpecs[id]||[]).filter(s => (s.label||'').trim());
if (!specsIn.length) { toast('Agrega al menos una especificación con nombre','#ef4444'); return; }
p.specs = specsIn.map(s => ({ id:s.id, label:(s.label||'').trim(), weightKg: s.weightKg!=null&&s.weightKg!==''?Number(s.weightKg):null, sku:(s.sku||'').trim(), active: !!s.active }));
if (!p.specs.some(s=>s.active)) p.specs[0].active = true; // no dejar el producto sin ninguna especificación seleccionable
syncProductPrimarySpec(p);
delete window._editingSpecs[id];
const colorEl  = document.getElementById('epcolor-'+id);
p.color        = colorEl ? colorEl.value : '';
// Aplicar/quitar restricción a TODA la familia
const restrictedChk = document.getElementById('epfamrestricted-'+id);
if (!S.restrictedFamilies) S.restrictedFamilies = [];
if (p.family) {
  const idx = S.restrictedFamilies.indexOf(p.family);
  if (restrictedChk && restrictedChk.checked) {
    if (idx === -1) S.restrictedFamilies.push(p.family);
  } else {
    if (idx !== -1) S.restrictedFamilies.splice(idx, 1);
  }
}
save(); toast('✔ Producto actualizado'); renderProducts();
}


// ── Trasladado desde el bloque "MODAL DE CONFIRMACIÓN" (mal etiquetado) ──
function toggleProdActive(id) {
  id = Number(id);
  const p = S.products.find(x => Number(x.id)===id);
  if (!p) return;
  p.inactive = !p.inactive;
  save();
  toast(p.inactive ? '🔒 Producto bloqueado' : '🔓 Producto desbloqueado', p.inactive ? '#f59e0b' : '#10b981');
  renderProducts();
}

function delProd(id) {
  id = Number(id);
  const p = S.products.find(x => Number(x.id)===id);
  const nombre = p ? p.name + (p.presentation ? ' (' + p.presentation + ')' : '') : '—';
  // Contar en cuántos pedidos aparece (como venta o como bonificación),
  // para saber el impacto real antes de eliminar.
  const affectedOrders = S.orders.filter(o =>
    (o.items||[]).some(i => Number(i.productId)===id) ||
    (o.bonusLines||[]).some(bl => Number(bl.productId)===id)
  );
  const n = affectedOrders.length;
  const sub = n
    ? `${nombre}\n⚠️ Este producto aparece en ${n} pedido${n===1?'':'s'}. Se eliminará de esos pedidos (y de sus bonificaciones, si aplica).\nEsta acción no se puede deshacer.`
    : `${nombre}\n✅ Este producto no aparece en ningún pedido — puedes eliminarlo con tranquilidad.\nEsta acción no se puede deshacer.`;
  askConfirm('¿Eliminar este producto?', sub, () => {
    S.orders.forEach(o => {
      o.items = (o.items||[]).filter(i => Number(i.productId)!==id);
      if (o.bonusLines) o.bonusLines = o.bonusLines.filter(bl => Number(bl.productId)!==id);
    });
    S.products = S.products.filter(p => Number(p.id)!==id);
    Object.keys(S.cp).forEach(cid => { if (S.cp[cid]) delete S.cp[cid][id]; });
    save(); toast('🗑 Producto eliminado'); renderProducts(); renderList();
  });
}

