

// ── Trasladado desde el bloque "MODAL DE CONFIRMACIÓN" (mal etiquetado) ──
function addDept() {
  const inp = document.getElementById('new-dept-name');
  const name = inp.value.trim();
  if (!name) { toast('Escribe el nombre del departamento', '#ef4444'); return; }
  const rutaId = null;
  if (!S.depts) S.depts = [];
  if (S.depts.some(d => d.name.toLowerCase() === name.toLowerCase())) { toast('Ese departamento ya existe', '#f59e0b'); return; }
  S.depts.push({ id: genId(), name, rutaId });
  inp.value = '';
  window._configAddOpen = null;
  save(); renderDeptList(); renderClientsIfActive(); renderConfigLists();
  toast('🏛️ Departamento agregado');
}

function getPriorityColor(name) {
  const n = (name||'').trim();
  if (!n) return null;
  const item = (S.priorityList||[]).find(p => p.name === n);
  return item ? item.color : null;
}

function isPriorityBlocking(name) {
  const n = (name||'').trim();
  if (!n) return false;
  const item = (S.priorityList||[]).find(p => p.name === n);
  return !!(item && item.blocks);
}

function isPriorityExcludedFromRoute(name) {
  const n = (name||'').trim();
  if (!n) return false;
  const item = (S.priorityList||[]).find(p => p.name === n);
  return !!(item && item.excludeRoute);
}

function isClientBlocked(c) {
  return !!c && isPriorityBlocking(c.priority);
}

function getLinkedOldClientIds(cid) {
  const result = [];
  const seen = new Set([Number(cid)]);
  let current = S.clients.find(c => c.id === Number(cid));
  while (current && current.linkedFromClientId && !seen.has(Number(current.linkedFromClientId))) {
    const prev = S.clients.find(c => c.id === Number(current.linkedFromClientId));
    if (!prev) break;
    result.push(prev.id);
    seen.add(prev.id);
    current = prev;
  }
  return result;
}

function getEffectiveClientIds(cid) {
  return [Number(cid), ...getLinkedOldClientIds(cid)];
}

function expandSelectedClientNames(names) {
  const expanded = new Set(names);
  (names||[]).forEach(n => {
    const c = S.clients.find(x => x.name === n);
    if (c) getLinkedOldClientIds(c.id).forEach(oldId => {
      const oldC = S.clients.find(x => x.id === oldId);
      if (oldC) expanded.add(oldC.name);
    });
  });
  return [...expanded];
}

function priorityNameStyle(name, fallbackColor) {
  const color = getPriorityColor(name) || fallbackColor || 'inherit';
  const strike = isPriorityBlocking(name) ? 'text-decoration:line-through;' : '';
  return `color:${color};${strike}`;
}

function priorityColorSwatches(inputId) {
  return `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px">` +
    PRIORITY_COLOR_PALETTE.map(c => `<button type="button" onclick="document.getElementById('${inputId}').value='${c}'" title="${c}" style="width:22px;height:22px;border-radius:50%;background:${c};border:1px solid #0006;cursor:pointer;padding:0;flex-shrink:0"></button>`).join('') +
    `</div>`;
}

function addPriorityItem() {
  const inp = document.getElementById('new-priority-name');
  const colorInp = document.getElementById('new-priority-color');
  const blocksInp = document.getElementById('new-priority-blocks');
  const exclRouteInp = document.getElementById('new-priority-exclroute');
  const name = inp.value.trim();
  if (!name) { toast('Escribe el nombre de la prioridad', '#ef4444'); return; }
  if (!S.priorityList) S.priorityList = [];
  if (S.priorityList.some(p => p.name.toLowerCase() === name.toLowerCase())) { toast('Esa prioridad ya existe', '#f59e0b'); return; }
  S.priorityList.push({ name, color: (colorInp && colorInp.value) || '#ef4444', blocks: !!(blocksInp && blocksInp.checked), excludeRoute: !!(exclRouteInp && exclRouteInp.checked) });
  inp.value = '';
  window._configAddOpen = null;
  save(); renderConfigLists();
  toast('⭐ Prioridad agregada');
}

function renderPriorityList() {
  const wrap = document.getElementById('priority-list');
  if (!wrap) return;
  const list = S.priorityList || [];
  if (!list.length) { wrap.innerHTML = '<div style="font-size:12px;color:#64748b;padding:4px 0">Sin prioridades. Agrega una arriba.</div>'; return; }
  wrap.innerHTML = list.map((item, idx) => {
    const name = item.name;
    const color = item.color || '#ef4444';
    const blocks = !!item.blocks;
    const exclRoute = !!item.excludeRoute;
    const count = S.clients.filter(c => c.priority === name).length;
    const isEditing = window._editingPriority === idx;
    if (isEditing) {
      return `<div style="padding:6px 0;border-bottom:1px solid #1e2640">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
          <input type="color" id="edit-priority-color-${idx}" value="${color}" style="width:38px;height:34px;padding:0;border:1px solid #2a3050;border-radius:6px;background:none;cursor:pointer;flex-shrink:0"/>
          <input id="edit-priority-${idx}" value="${name.replace(/"/g,'&quot;')}" style="flex:1;background:#161929;border:1px solid #3b82f6;border-radius:6px;padding:5px 8px;color:#f1f5f9;font-size:13px;box-sizing:border-box"/>
        </div>
        ${priorityColorSwatches('edit-priority-color-'+idx)}
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:8px;padding:8px;background:#0d0f18;border-radius:8px;border:1px solid #2a3050">
          <input type="checkbox" id="edit-priority-blocks-${idx}" ${blocks?'checked':''} style="width:16px;height:16px;cursor:pointer;accent-color:#ef4444"/>
          <span style="font-size:13px;color:#f1f5f9">🔒 Esta prioridad bloquea al cliente</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:8px;padding:8px;background:#0d0f18;border-radius:8px;border:1px solid #2a3050">
          <input type="checkbox" id="edit-priority-exclroute-${idx}" ${exclRoute?'checked':''} style="width:16px;height:16px;cursor:pointer;accent-color:#f59e0b"/>
          <span style="font-size:13px;color:#f1f5f9">🚫 Excluir de la generación automática de rutas</span>
        </label>
        <div style="display:flex;gap:6px">
          <button onclick="confirmSavePriorityItem(${idx})" style="flex:1;background:#10b981;border:none;border-radius:6px;color:#fff;padding:6px 8px;cursor:pointer;font-size:12px">💾 Guardar</button>
          <button onclick="window._editingPriority=null;renderPriorityList()" style="background:#475569;border:none;border-radius:6px;color:#fff;padding:6px 8px;cursor:pointer;font-size:12px">✕</button>
        </div>
      </div>`;
    }
    return `<div style="display:flex;align-items:center;gap:4px;padding:6px 0;border-bottom:1px solid #1e2640">
      <div style="display:flex;flex-direction:column;gap:1px">
        <button onclick="movePriorityItem(${idx},-1)" ${idx===0?'disabled':''} style="background:none;border:none;color:${idx===0?'#334155':'#94a3b8'};cursor:${idx===0?'default':'pointer'};font-size:12px;padding:0 4px;line-height:1">▲</button>
        <button onclick="movePriorityItem(${idx},1)" ${idx===list.length-1?'disabled':''} style="background:none;border:none;color:${idx===list.length-1?'#334155':'#94a3b8'};cursor:${idx===list.length-1?'default':'pointer'};font-size:12px;padding:0 4px;line-height:1">▼</button>
      </div>
      <span style="width:16px;height:16px;border-radius:50%;background:${color};flex-shrink:0;border:1px solid #0006"></span>
      <button onclick="window._editingPriority=${idx};renderPriorityList()" style="background:none;border:none;color:#f59e0b;cursor:pointer;font-size:14px;padding:2px 4px">✏️</button>
      <span style="flex:1;font-size:13px;color:${color}">⭐ ${name}${blocks?' 🔒':''}${exclRoute?' 🚫':''} <span style="color:#64748b;font-size:11px">(${count} cliente${count!==1?'s':''})</span></span>
      <button class="br" style="font-size:10px;padding:2px 8px" onclick="deletePriorityItem(${idx})">✕</button>
    </div>`;
  }).join('');
}

function movePriorityItem(idx, dir) {
  const list = S.priorityList;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= list.length) return;
  [list[idx], list[newIdx]] = [list[newIdx], list[idx]];
  save(); renderConfigLists();
}

function confirmSavePriorityItem(idx) {
  const inp = document.getElementById('edit-priority-'+idx);
  const newName = inp ? inp.value.trim() : '';
  if (!newName) return toast('El nombre no puede estar vacío','#ef4444');
  askConfirm('¿Guardar cambios en esta prioridad?', '', () => savePriorityItem(idx), '💾 Guardar', '#10b981', '💾');
}

function savePriorityItem(idx) {
  const inp = document.getElementById('edit-priority-'+idx);
  const colorInp = document.getElementById('edit-priority-color-'+idx);
  const blocksInp = document.getElementById('edit-priority-blocks-'+idx);
  const exclRouteInp = document.getElementById('edit-priority-exclroute-'+idx);
  const newName = inp ? inp.value.trim() : '';
  if (!newName) return toast('El nombre no puede estar vacío','#ef4444');
  const oldName = S.priorityList[idx].name;
  if (S.priorityList.some((p,i) => i!==idx && p.name.toLowerCase()===newName.toLowerCase())) return toast('Esa prioridad ya existe','#f59e0b');
  S.priorityList[idx] = { name: newName, color: (colorInp && colorInp.value) || S.priorityList[idx].color, blocks: !!(blocksInp && blocksInp.checked), excludeRoute: !!(exclRouteInp && exclRouteInp.checked) };
  S.clients.forEach(c => { if (c.priority === oldName) c.priority = newName; });
  window._editingPriority = null;
  save(); renderConfigLists(); renderClientsIfActive();
  toast('✅ Prioridad actualizada','#10b981');
}

function deletePriorityItem(idx) {
  const item = (S.priorityList||[])[idx];
  const name = item ? item.name : null;
  if (!name) return;
  const count = S.clients.filter(c => c.priority === name).length;
  const msg = count ? `Esto quitará la prioridad "${name}" de ${count} cliente(s). ¿Continuar?` : `¿Eliminar "${name}"?`;
  askConfirm('🗑 Eliminar prioridad', msg, () => {
    S.clients.forEach(c => { if (c.priority === name) c.priority = ''; });
    S.priorityList.splice(idx, 1);
    save(); renderConfigLists(); renderClientsIfActive();
    toast('Prioridad eliminada');
  });
}

function addFamilyItem() {
  const inp = document.getElementById('new-family-name');
  const name = inp.value.trim();
  if (!name) { toast('Escribe el nombre de la familia', '#ef4444'); return; }
  if (!S.familyList) S.familyList = [];
  if (S.familyList.some(f => f.toLowerCase() === name.toLowerCase())) { toast('Esa familia ya existe', '#f59e0b'); return; }
  S.familyList.push(name);
  inp.value = '';
  window._configAddOpen = null;
  save(); renderConfigLists();
  toast('🏷️ Familia agregada');
}

function renderFamilyList() {
  const wrap = document.getElementById('family-list');
  if (!wrap) return;
  const list = S.familyList || [];
  if (!list.length) { wrap.innerHTML = '<div style="font-size:12px;color:#64748b;padding:4px 0">Sin familias. Agrega una arriba.</div>'; return; }
  wrap.innerHTML = list.map((name, idx) => {
    const count = S.products.filter(p => (p.family||'').trim() === name).length;
    const isRestricted = (S.restrictedFamilies||[]).includes(name);
    const isEditing = window._editingFamily === idx;
    if (isEditing) {
      return `<div style="padding:6px 0;border-bottom:1px solid #1e2640">
        <input id="edit-family-${idx}" value="${name.replace(/"/g,'&quot;')}" style="width:100%;background:#161929;border:1px solid #3b82f6;border-radius:6px;padding:5px 8px;color:#f1f5f9;font-size:13px;margin-bottom:6px;box-sizing:border-box"/>
        <div style="display:flex;gap:6px">
          <button onclick="confirmSaveFamilyItem(${idx})" style="flex:1;background:#10b981;border:none;border-radius:6px;color:#fff;padding:6px 8px;cursor:pointer;font-size:12px">💾 Guardar</button>
          <button onclick="window._editingFamily=null;renderFamilyList()" style="background:#475569;border:none;border-radius:6px;color:#fff;padding:6px 8px;cursor:pointer;font-size:12px">✕</button>
        </div>
      </div>`;
    }
    return `<div style="display:flex;align-items:center;gap:4px;padding:6px 0;border-bottom:1px solid #1e2640">
      <div style="display:flex;flex-direction:column;gap:1px">
        <button onclick="moveFamilyItem(${idx},-1)" ${idx===0?'disabled':''} style="background:none;border:none;color:${idx===0?'#334155':'#94a3b8'};cursor:${idx===0?'default':'pointer'};font-size:12px;padding:0 4px;line-height:1">▲</button>
        <button onclick="moveFamilyItem(${idx},1)" ${idx===list.length-1?'disabled':''} style="background:none;border:none;color:${idx===list.length-1?'#334155':'#94a3b8'};cursor:${idx===list.length-1?'default':'pointer'};font-size:12px;padding:0 4px;line-height:1">▼</button>
      </div>
      <button onclick="window._editingFamily=${idx};renderFamilyList()" style="background:none;border:none;color:#f59e0b;cursor:pointer;font-size:14px;padding:2px 4px">✏️</button>
      <span style="flex:1;font-size:13px;color:#f1f5f9">🏷️ ${name}${isRestricted?' 🔒':''} <span style="color:#64748b;font-size:11px">(${count} producto${count!==1?'s':''})</span></span>
      <button class="br" style="font-size:10px;padding:2px 8px" onclick="deleteFamilyItem(${idx})">✕</button>
    </div>`;
  }).join('');
}

function moveFamilyItem(idx, dir) {
  const list = S.familyList;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= list.length) return;
  [list[idx], list[newIdx]] = [list[newIdx], list[idx]];
  save(); renderConfigLists(); renderProductsIfActive();
}

function confirmSaveFamilyItem(idx) {
  const inp = document.getElementById('edit-family-'+idx);
  const newName = inp ? inp.value.trim() : '';
  if (!newName) return toast('El nombre no puede estar vacío','#ef4444');
  askConfirm('¿Guardar cambios en esta familia?', '', () => saveFamilyItem(idx), '💾 Guardar', '#10b981', '💾');
}

function saveFamilyItem(idx) {
  const inp = document.getElementById('edit-family-'+idx);
  const newName = inp ? inp.value.trim() : '';
  if (!newName) return toast('El nombre no puede estar vacío','#ef4444');
  const oldName = S.familyList[idx];
  if (S.familyList.some((f,i) => i!==idx && f.toLowerCase()===newName.toLowerCase())) return toast('Esa familia ya existe','#f59e0b');
  S.familyList[idx] = newName;
  S.products.forEach(p => { if ((p.family||'').trim() === oldName) p.family = newName; });
  if (S.restrictedFamilies) S.restrictedFamilies = S.restrictedFamilies.map(f => f === oldName ? newName : f);
  window._editingFamily = null;
  save(); renderConfigLists(); renderProductsIfActive();
  toast('✅ Familia actualizada','#10b981');
}

function deleteFamilyItem(idx) {
  const name = (S.familyList||[])[idx];
  if (!name) return;
  const count = S.products.filter(p => (p.family||'').trim() === name).length;
  const msg = count ? `${count} producto(s) usan la familia "${name}". El campo Familia de esos productos quedará vacío. ¿Continuar?` : `¿Eliminar "${name}"?`;
  askConfirm('🗑 Eliminar familia', msg, () => {
    S.products.forEach(p => { if ((p.family||'').trim() === name) p.family = ''; });
    if (S.restrictedFamilies) S.restrictedFamilies = S.restrictedFamilies.filter(f => f !== name);
    S.familyList.splice(idx, 1);
    save(); renderConfigLists(); renderProductsIfActive();
    toast('Familia eliminada');
  });
}

function renderConfig() {
  // Punto de entrada al abrir la pestaña Configuración: dibuja las 3 tarjetas principales
  const mainOpen = window._configMainOpenKey || null;
  const mainWrap = document.getElementById('config-main-grid');
  const listsSection = document.getElementById('config-lists-section');
  const bizSection = document.getElementById('config-bizinfo-section');
  const backupSection = document.getElementById('config-backup-section');
  if (listsSection) listsSection.style.display = mainOpen === 'lists' ? 'block' : 'none';
  if (bizSection) bizSection.style.display = mainOpen === 'bizinfo' ? 'block' : 'none';
  if (backupSection) backupSection.style.display = mainOpen === 'backup' ? 'block' : 'none';
  if (mainOpen === 'lists') renderConfigLists();
  if (mainOpen === 'bizinfo') { loadBizForm(); setTimeout(refreshActivationInfo, 100); }
  if (mainOpen === 'backup') renderBackup();
}

function toggleConfigMain(key) {
  window._configMainOpenKey = window._configMainOpenKey === key ? null : key;
  renderConfig();
}

function renderConfigLists() {
  const wrap = document.getElementById('config-list');
  if (!wrap) return;
  const openKey = window._configOpenKey || null;
  const items = [
    {key:'rutas',    icon:'🚚', label:'Rutas',              sub:'',                          count:(S.rutasCliente||[]).length},
    {key:'depts',    icon:'🏛️', label:'Departamentos',       sub:'depende de Ruta',           count:(S.depts||[]).length},
    {key:'muns',     icon:'🏘️', label:'Sectores',            sub:'depende de Departamento',   count:(S.municipios||[]).length},
    {key:'priority', icon:'⭐', label:'Prioridad',           sub:'',                          count:(S.priorityList||[]).length},
    {key:'families', icon:'🏷️', label:'Familia / Categoría', sub:'',                          count:(S.familyList||[]).length},
  ];
  wrap.innerHTML = items.map(it => {
    const isOpen = it.key === openKey;
    return `
    <div class="card" style="margin-bottom:8px" id="config-card-${it.key}">
      <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="event.stopPropagation();toggleConfigSection('${it.key}')">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:18px">${it.icon}</span>
          <div>
            <div style="font-size:14px;color:#f1f5f9">${it.label}</div>
            ${it.sub ? `<div style="font-size:11px;color:#64748b">${it.sub}</div>` : ''}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:12px;color:#64748b">${it.count}</span>
          <span style="font-size:13px;color:#64748b">${isOpen?'▾':'▸'}</span>
        </div>
      </div>
      ${isOpen ? `<div id="config-section-${it.key}" style="margin-top:10px;border-top:1px solid #2a3050;padding-top:10px" onclick="event.stopPropagation()">${configSectionInnerHTML(it.key)}</div>` : ''}
    </div>
  `;
  }).join('');
  renderRutaClienteList(); renderDeptList(); renderMunList(); renderPriorityList(); renderFamilyList();
}

function configAddFormHTML(key) {
  if (key === 'rutas') return `
    <input class="inp" id="new-ruta-cliente-name" placeholder="Nombre de la ruta"/>
    <button class="bg" style="width:100%;margin-bottom:10px" onclick="addRutaCliente()">✔ Agregar Ruta</button>`;
  if (key === 'depts') return `
    <input class="inp" id="new-dept-name" placeholder="Nombre del departamento"/>
    <div style="font-size:11px;color:#64748b;margin-bottom:8px">La ruta se asigna después, desde la lista de Rutas.</div>
    <button class="bg" style="width:100%;margin-bottom:10px" onclick="addDept()">✔ Agregar Departamento</button>`;
  if (key === 'muns') return `
    <input class="inp" id="new-mun-name" placeholder="Nombre del sector"/>
    <div style="font-size:11px;color:#64748b;margin-bottom:8px">El departamento se asigna después, desde la lista de Departamentos.</div>
    <button class="bg" style="width:100%;margin-bottom:10px" onclick="addMun()">✔ Agregar Sector</button>`;
  if (key === 'priority') return `
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
      <input type="color" id="new-priority-color" value="#ef4444" style="width:40px;height:38px;padding:0;border:1px solid #2a3050;border-radius:6px;background:none;cursor:pointer;flex-shrink:0"/>
      <input class="inp" id="new-priority-name" placeholder="Ej: Alta, VIP, 1..." style="flex:1;margin:0"/>
    </div>
    ${priorityColorSwatches('new-priority-color')}
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:10px;padding:8px;background:#0d0f18;border-radius:8px;border:1px solid #2a3050">
      <input type="checkbox" id="new-priority-blocks" style="width:16px;height:16px;cursor:pointer;accent-color:#ef4444"/>
      <span style="font-size:13px;color:#f1f5f9">🔒 Esta prioridad bloquea al cliente (no se le podrán generar pedidos nuevos)</span>
    </label>
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:10px;padding:8px;background:#0d0f18;border-radius:8px;border:1px solid #2a3050">
      <input type="checkbox" id="new-priority-exclroute" style="width:16px;height:16px;cursor:pointer;accent-color:#f59e0b"/>
      <span style="font-size:13px;color:#f1f5f9">🚫 Excluir de la generación automática de rutas</span>
    </label>
    <button class="bg" style="width:100%;margin-bottom:10px" onclick="addPriorityItem()">✔ Agregar Prioridad</button>`;
  if (key === 'families') return `
    <input class="inp" id="new-family-name" placeholder="Ej: Thinner, Ácido..."/>
    <button class="bg" style="width:100%;margin-bottom:10px" onclick="addFamilyItem()">✔ Agregar Familia</button>`;
  return '';
}

function configListContainerId(key) {
  return {rutas:'ruta-cliente-list', depts:'dept-list', muns:'mun-list', priority:'priority-list', families:'family-list'}[key];
}

function configAddLabel(key) {
  return {rutas:'+ Nueva Ruta', depts:'+ Nuevo Departamento', muns:'+ Nuevo Sector', priority:'+ Nueva Prioridad', families:'+ Nueva Familia'}[key];
}

function toggleConfigAddForm(key) {
  const opening = window._configAddOpen !== key;
  window._configAddOpen = opening ? key : null;
  renderConfigLists();
}

function configSectionInnerHTML(key) {
  const addOpen = window._configAddOpen === key;
  return `
    <button class="bs" style="width:100%;margin-bottom:10px" onclick="toggleConfigAddForm('${key}')">${addOpen?'✕ Cancelar':configAddLabel(key)}</button>
    ${addOpen ? `<div style="background:#0d1525;border:1px solid #2a3050;border-radius:10px;padding:10px;margin-bottom:10px">${configAddFormHTML(key)}</div>` : ''}
    <div id="${configListContainerId(key)}"></div>`;
}

function toggleConfigSection(key) {
  const opening = window._configOpenKey !== key;
  window._configOpenKey = opening ? key : null;
  renderConfigLists();
}

function renderDeptList() {
  const wrap = document.getElementById('dept-list');
  if (!wrap) return;
  if (!S.depts || !S.depts.length) {
    wrap.innerHTML = '<div style="font-size:12px;color:#64748b;padding:4px 0">Sin departamentos. Agrega uno arriba.</div>';
    return;
  }
  const sorted = [...S.depts].sort((a,b) => a.name.localeCompare(b.name,'es'));
  wrap.innerHTML = sorted.map(cat => {
    const count = S.clients.filter(c => c.deptId === cat.id).length;
    const isEditing = window._editingDept === cat.id;
    const isExpanded = window._expandedDept === cat.id;
    const rutas = (cat.rutaIds||[]).map(rid => (S.rutasCliente||[]).find(r=>r.id===rid)).filter(Boolean);
    const munCount = (S.municipios||[]).filter(m => (m.deptIds||[]).includes(cat.id)).length;
    if (isEditing) {
      return `<div style="padding:6px 0;border-bottom:1px solid #1e2640">
        <input id="edit-dept-${cat.id}" value="${cat.name.replace(/"/g,'&quot;')}" style="width:100%;background:#161929;border:1px solid #3b82f6;border-radius:6px;padding:5px 8px;color:#f1f5f9;font-size:13px;margin-bottom:6px;box-sizing:border-box"/>
        <div style="display:flex;gap:6px">
          <button onclick="confirmSaveDeptName(${cat.id})" style="flex:1;background:#10b981;border:none;border-radius:6px;color:#fff;padding:6px 8px;cursor:pointer;font-size:12px">💾 Guardar</button>
          <button onclick="window._editingDept=null;renderDeptList()" style="background:#475569;border:none;border-radius:6px;color:#fff;padding:6px 8px;cursor:pointer;font-size:12px">✕</button>
        </div>
      </div>`;
    }
    return `<div style="padding:6px 0;border-bottom:1px solid #1e2640">
      <div style="display:flex;align-items:center;gap:6px">
        <button onclick="event.stopPropagation();window._editingDept=${cat.id};renderDeptList()" style="background:none;border:none;color:#60a5fa;cursor:pointer;font-size:14px;padding:2px 4px">✏️</button>
        <span onclick="toggleExpandDept(${cat.id})" style="flex:1;font-size:13px;color:#f1f5f9;cursor:pointer">🏛️ ${cat.name} <span style="color:#64748b;font-size:11px">(${count} cliente${count!==1?'s':''} · ${munCount} sector${munCount!==1?'es':''})</span>${rutas.length?`<span style="display:block;font-size:11px;color:#10b981">🚚 ${rutas.map(r=>r.name).join(', ')}</span>`:'<span style="display:block;font-size:11px;color:#f59e0b">⚠️ Sin ruta asignada</span>'}</span>
        <span onclick="toggleExpandDept(${cat.id})" style="font-size:12px;color:#64748b;cursor:pointer;padding:2px 4px">${isExpanded?'▾':'▸'}</span>
        <button class="br" style="font-size:10px;padding:2px 8px" onclick="event.stopPropagation();deleteDept(${cat.id})">✕</button>
      </div>
      ${isExpanded ? `<div style="margin-top:8px;margin-left:24px;background:#0d1525;border:1px solid #2a3050;border-radius:8px;padding:8px">
        <div id="dept-mun-list-${cat.id}"></div>
        <div style="position:relative;margin-top:8px">
          <input placeholder="🔍 Buscar otro sector (de cualquier departamento)..." oninput="searchMunForDept(${cat.id},this.value)" style="width:100%;background:#161929;border:1px solid #2a3050;border-radius:7px;padding:7px 9px;color:#f1f5f9;font-size:12px;box-sizing:border-box"/>
          <div id="dept-mun-search-drop-${cat.id}" style="display:none;position:absolute;top:100%;left:0;right:0;background:#1e2040;border:1px solid #7c3aed;border-radius:8px;z-index:200;max-height:160px;overflow-y:auto;margin-top:2px"></div>
        </div>
      </div>` : ''}
    </div>`;
  }).join('');
}

function toggleExpandDept(id) {
  window._expandedDept = window._expandedDept === id ? null : id;
  renderDeptList();
  if (window._expandedDept) renderDeptMunChecklist(window._expandedDept);
}

function renderDeptMunChecklist(deptId) {
  const wrap = document.getElementById('dept-mun-list-'+deptId);
  if (!wrap) return;
  const available = (S.municipios||[]).filter(m => !(m.deptIds||[]).length || (m.deptIds||[]).includes(deptId));
  if (!available.length) {
    wrap.innerHTML = '<div style="font-size:12px;color:#64748b">No hay sectores disponibles. Usa el buscador para tomar uno de otro departamento.</div>';
    return;
  }
  wrap.innerHTML = [...available].sort((a,b)=>a.name.localeCompare(b.name,'es')).map(m => {
    const belongs = (m.deptIds||[]).includes(deptId);
    return `<label style="display:flex;align-items:center;gap:7px;padding:4px 0;cursor:pointer">
      <input type="checkbox" ${belongs?'checked':''} onchange="assignMunToDept(${m.id},${deptId},this.checked)" style="width:15px;height:15px;accent-color:#7c3aed;flex-shrink:0"/>
      <span style="font-size:12px;color:#f1f5f9">🏘️ ${m.name}</span>
    </label>`;
  }).join('');
}

function searchMunForDept(deptId, q) {
  const drop = document.getElementById('dept-mun-search-drop-'+deptId);
  if (!drop) return;
  const ql = (q||'').trim().toLowerCase();
  if (!ql) { drop.style.display = 'none'; return; }
  const matches = (S.municipios||[]).filter(m => m.name.toLowerCase().includes(ql));
  if (!matches.length) { drop.style.display = 'block'; drop.innerHTML = '<div style="padding:9px 12px;font-size:12px;color:#64748b">Sin resultados</div>'; return; }
  drop.style.display = 'block';
  drop.innerHTML = matches.map(m => {
    const belongs = (m.deptIds||[]).includes(deptId);
    const otherDepts = (m.deptIds||[]).filter(did=>did!==deptId).map(did=>(S.depts.find(x=>x.id===did)||{}).name).filter(Boolean);
    return `<div onclick="pickMunForDept(${m.id},${deptId})" style="padding:9px 12px;font-size:13px;color:#f1f5f9;cursor:pointer;border-bottom:1px solid #2a3050">
      🏘️ ${m.name}${otherDepts.length ? `<span style="display:block;font-size:11px;color:#f59e0b">⚠️ También en ${otherDepts.join(', ')}</span>` : ''}${belongs ? '<span style="display:block;font-size:11px;color:#10b981">Ya está en este departamento</span>' : ''}
    </div>`;
  }).join('');
}

function pickMunForDept(munId, deptId) {
  const drop = document.getElementById('dept-mun-search-drop-'+deptId);
  if (drop) drop.style.display = 'none';
  const m = (S.municipios||[]).find(x => x.id === munId);
  if (!m) return;
  if ((m.deptIds||[]).includes(deptId)) return;
  const otherDepts = (m.deptIds||[]).map(did=>(S.depts.find(x=>x.id===did)||{}).name).filter(Boolean);
  if (otherDepts.length) {
    showMoveOrAddModal(
      `"${m.name}" ya pertenece a ${otherDepts.join(', ')}`,
      () => moveMunToDept(munId, deptId),
      () => assignMunToDept(munId, deptId, true)
    );
  } else {
    assignMunToDept(munId, deptId, true);
  }
}

function moveMunToDept(munId, deptId) {
  const m = (S.municipios||[]).find(x => x.id === munId);
  if (!m) return;
  m.deptIds = [deptId];
  save(); renderDeptList(); renderMunList(); renderClientsIfActive(); renderConfigLists();
  if (window._expandedDept) renderDeptMunChecklist(window._expandedDept);
  toast('🔀 Sector movido', '#10b981');
}

function assignMunToDept(munId, deptId, checked) {
  const m = (S.municipios||[]).find(x => x.id === munId);
  if (!m) return;
  if (!m.deptIds) m.deptIds = [];
  if (checked) {
    if (!m.deptIds.includes(deptId)) m.deptIds.push(deptId);
  } else {
    m.deptIds = m.deptIds.filter(id => id !== deptId);
  }
  save(); renderDeptList(); renderMunList(); renderClientsIfActive(); renderConfigLists();
  if (window._expandedDept) renderDeptMunChecklist(window._expandedDept);
  toast(checked ? '✅ Sector asignado' : 'Sector desasignado', '#10b981');
}

function confirmSaveDeptName(id) {
  const inp = document.getElementById('edit-dept-'+id);
  const name = inp ? inp.value.trim() : '';
  if (!name) return toast('El nombre no puede estar vacío','#ef4444');
  askConfirm('¿Guardar cambios en este departamento?', '', () => saveDeptName(id), '💾 Guardar', '#10b981', '💾');
}

function saveDeptName(id) {
  const inp = document.getElementById('edit-dept-'+id);
  const name = inp ? inp.value.trim() : '';
  if (!name) return toast('El nombre no puede estar vacío','#ef4444');
  const dept = S.depts.find(d => d.id === id);
  if (dept) {
    dept.name = name;
    save(); renderDeptList(); renderClientsIfActive(); renderConfigLists();
    toast('✅ Departamento actualizado','#10b981');
  }
  window._editingDept = null;
}

function deleteDept(id) {
  const cat = (S.depts||[]).find(c=>c.id===id);
  if (!cat) return;
  const count = S.clients.filter(c=>c.deptId===id).length;
  const msg = count
    ? `Esto quitará el departamento "${cat.name}" de ${count} cliente(s). ¿Continuar?`
    : `¿Eliminar el departamento "${cat.name}"?`;
  askConfirm('🗑 Eliminar departamento', msg, () => {
    S.clients.forEach(c => { if (c.deptId===id) c.deptId=null; });
    (S.municipios||[]).forEach(m => { if (m.deptIds) m.deptIds = m.deptIds.filter(did => did !== id); });
    S.depts = S.depts.filter(c=>c.id!==id);
    save(); renderDeptList(); renderMunList(); renderClientsIfActive(); renderConfigLists();
    toast('Departamento eliminado');
  });
}

function addRutaCliente() {
  const inp = document.getElementById('new-ruta-cliente-name');
  const name = inp.value.trim();
  if (!name) { toast('Escribe el nombre de la ruta', '#ef4444'); return; }
  if (!S.rutasCliente) S.rutasCliente = [];
  if (S.rutasCliente.some(r => r.name.toLowerCase() === name.toLowerCase())) { toast('Esa ruta ya existe', '#f59e0b'); return; }
  S.rutasCliente.push({ id: genId(), name });
  inp.value = '';
  window._configAddOpen = null;
  save(); renderRutaClienteList(); renderClientsIfActive(); renderConfigLists();
  toast('🚚 Ruta agregada');
}

function renderRutaClienteList() {
  const wrap = document.getElementById('ruta-cliente-list');
  if (!wrap) return;
  if (!S.rutasCliente || !S.rutasCliente.length) {
    wrap.innerHTML = '<div style="font-size:12px;color:#64748b;padding:4px 0">Sin rutas. Agrega una arriba.</div>';
    return;
  }
  const sorted = [...S.rutasCliente].sort((a,b) => a.name.localeCompare(b.name,'es'));
  wrap.innerHTML = sorted.map(r => {
    const count = S.clients.filter(c => c.rutaClienteId === r.id).length;
    const isEditing = window._editingRuta === r.id;
    const isExpanded = window._expandedRuta === r.id;
    const deptCount = (S.depts||[]).filter(d => (d.rutaIds||[]).includes(r.id)).length;
    if (isEditing) {
      return `<div style="display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid #1e2640">
        <input id="edit-ruta-${r.id}" value="${r.name.replace(/"/g,'&quot;')}" style="flex:1;background:#161929;border:1px solid #3b82f6;border-radius:6px;padding:5px 8px;color:#f1f5f9;font-size:13px"/>
        <button onclick="confirmSaveRutaName(${r.id})" style="background:#10b981;border:none;border-radius:6px;color:#fff;padding:4px 8px;cursor:pointer;font-size:12px">💾</button>
        <button onclick="window._editingRuta=null;renderRutaClienteList()" style="background:#475569;border:none;border-radius:6px;color:#fff;padding:4px 8px;cursor:pointer;font-size:12px">✕</button>
      </div>`;
    }
    return `<div style="padding:6px 0;border-bottom:1px solid #1e2640">
      <div style="display:flex;align-items:center;gap:6px">
        <button onclick="event.stopPropagation();window._editingRuta=${r.id};renderRutaClienteList()" style="background:none;border:none;color:#60a5fa;cursor:pointer;font-size:14px;padding:2px 4px">✏️</button>
        <span onclick="toggleExpandRuta(${r.id})" style="flex:1;font-size:13px;color:#f1f5f9;cursor:pointer">🚚 ${r.name} <span style="color:#64748b;font-size:11px">(${count} cliente${count!==1?'s':''} · ${deptCount} depto${deptCount!==1?'s':''})</span></span>
        <span onclick="toggleExpandRuta(${r.id})" style="font-size:12px;color:#64748b;cursor:pointer;padding:2px 4px">${isExpanded?'▾':'▸'}</span>
        <button class="br" style="font-size:10px;padding:2px 8px" onclick="event.stopPropagation();deleteRutaCliente(${r.id})">✕</button>
      </div>
      ${isExpanded ? `<div style="margin-top:8px;margin-left:24px;background:#0d1525;border:1px solid #2a3050;border-radius:8px;padding:8px">
        <div id="ruta-dept-list-${r.id}"></div>
        <div style="position:relative;margin-top:8px">
          <input placeholder="🔍 Buscar otro departamento (de cualquier ruta)..." oninput="searchDeptForRuta(${r.id},this.value)" style="width:100%;background:#161929;border:1px solid #2a3050;border-radius:7px;padding:7px 9px;color:#f1f5f9;font-size:12px;box-sizing:border-box"/>
          <div id="ruta-dept-search-drop-${r.id}" style="display:none;position:absolute;top:100%;left:0;right:0;background:#1e2640;border:1px solid #3b82f6;border-radius:8px;z-index:200;max-height:160px;overflow-y:auto;margin-top:2px"></div>
        </div>
      </div>` : ''}
    </div>`;
  }).join('');
}

function toggleExpandRuta(id) {
  window._expandedRuta = window._expandedRuta === id ? null : id;
  renderRutaClienteList();
  if (window._expandedRuta) renderRutaDeptChecklist(window._expandedRuta);
}

function renderRutaDeptChecklist(rutaId) {
  const wrap = document.getElementById('ruta-dept-list-'+rutaId);
  if (!wrap) return;
  const available = (S.depts||[]).filter(d => !(d.rutaIds||[]).length || (d.rutaIds||[]).includes(rutaId));
  if (!available.length) {
    wrap.innerHTML = '<div style="font-size:12px;color:#64748b">No hay departamentos disponibles. Usa el buscador para tomar uno de otra ruta.</div>';
    return;
  }
  wrap.innerHTML = [...available].sort((a,b)=>a.name.localeCompare(b.name,'es')).map(d => {
    const belongs = (d.rutaIds||[]).includes(rutaId);
    return `<label style="display:flex;align-items:center;gap:7px;padding:4px 0;cursor:pointer">
      <input type="checkbox" ${belongs?'checked':''} onchange="assignDeptToRuta(${d.id},${rutaId},this.checked)" style="width:15px;height:15px;accent-color:#10b981;flex-shrink:0"/>
      <span style="font-size:12px;color:#f1f5f9">🏛️ ${d.name}</span>
    </label>`;
  }).join('');
}

function searchDeptForRuta(rutaId, q) {
  const drop = document.getElementById('ruta-dept-search-drop-'+rutaId);
  if (!drop) return;
  const ql = (q||'').trim().toLowerCase();
  if (!ql) { drop.style.display = 'none'; return; }
  const matches = (S.depts||[]).filter(d => d.name.toLowerCase().includes(ql));
  if (!matches.length) { drop.style.display = 'block'; drop.innerHTML = '<div style="padding:9px 12px;font-size:12px;color:#64748b">Sin resultados</div>'; return; }
  drop.style.display = 'block';
  drop.innerHTML = matches.map(d => {
    const belongs = (d.rutaIds||[]).includes(rutaId);
    const otherRutas = (d.rutaIds||[]).filter(rid=>rid!==rutaId).map(rid=>(S.rutasCliente.find(x=>x.id===rid)||{}).name).filter(Boolean);
    return `<div onclick="pickDeptForRuta(${d.id},${rutaId})" style="padding:9px 12px;font-size:13px;color:#f1f5f9;cursor:pointer;border-bottom:1px solid #2a3050">
      🏛️ ${d.name}${otherRutas.length ? `<span style="display:block;font-size:11px;color:#f59e0b">⚠️ También en ${otherRutas.join(', ')}</span>` : ''}${belongs ? '<span style="display:block;font-size:11px;color:#10b981">Ya está en esta ruta</span>' : ''}
    </div>`;
  }).join('');
}

function pickDeptForRuta(deptId, rutaId) {
  const drop = document.getElementById('ruta-dept-search-drop-'+rutaId);
  if (drop) drop.style.display = 'none';
  const d = (S.depts||[]).find(x => x.id === deptId);
  if (!d) return;
  if ((d.rutaIds||[]).includes(rutaId)) return; // ya está aquí, nada que hacer
  const otherRutas = (d.rutaIds||[]).map(rid=>(S.rutasCliente.find(x=>x.id===rid)||{}).name).filter(Boolean);
  if (otherRutas.length) {
    showMoveOrAddModal(
      `"${d.name}" ya pertenece a ${otherRutas.join(', ')}`,
      () => moveDeptToRuta(deptId, rutaId),
      () => assignDeptToRuta(deptId, rutaId, true)
    );
  } else {
    assignDeptToRuta(deptId, rutaId, true);
  }
}

function moveDeptToRuta(deptId, rutaId) {
  const dept = (S.depts||[]).find(d => d.id === deptId);
  if (!dept) return;
  dept.rutaIds = [rutaId];
  save(); renderRutaClienteList(); renderDeptList(); renderClientsIfActive(); renderConfigLists();
  if (window._expandedRuta) renderRutaDeptChecklist(window._expandedRuta);
  toast('🔀 Departamento movido', '#10b981');
}

function showMoveOrAddModal(title, onMove, onAdd) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
  overlay.innerHTML = `<div style="background:#1e2236;border:1px solid #2a3050;border-radius:14px;padding:20px;max-width:340px;width:100%">
    <div style="font-size:15px;font-weight:700;color:#f1f5f9;margin-bottom:16px">${title}</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <button id="mova-move-btn" style="padding:10px;background:#3b82f6;border:none;border-radius:8px;color:#fff;font-weight:700;font-size:14px;cursor:pointer">🔀 Mover aquí (lo quita de donde estaba)</button>
      <button id="mova-add-btn" style="padding:10px;background:#10b981;border:none;border-radius:8px;color:#fff;font-weight:700;font-size:14px;cursor:pointer">➕ Agregar también aquí</button>
      <button id="mova-cancel-btn" style="padding:10px;background:transparent;border:1px solid #475569;border-radius:8px;color:#f1f5f9;font-weight:700;font-size:14px;cursor:pointer">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#mova-move-btn').onclick = () => { overlay.remove(); onMove(); };
  overlay.querySelector('#mova-add-btn').onclick = () => { overlay.remove(); onAdd(); };
  overlay.querySelector('#mova-cancel-btn').onclick = () => overlay.remove();
}

function assignDeptToRuta(deptId, rutaId, checked) {
  const dept = (S.depts||[]).find(d => d.id === deptId);
  if (!dept) return;
  if (!dept.rutaIds) dept.rutaIds = [];
  if (checked) {
    if (!dept.rutaIds.includes(rutaId)) dept.rutaIds.push(rutaId);
  } else {
    dept.rutaIds = dept.rutaIds.filter(id => id !== rutaId);
  }
  save(); renderRutaClienteList(); renderDeptList(); renderClientsIfActive(); renderConfigLists();
  if (window._expandedRuta) renderRutaDeptChecklist(window._expandedRuta);
  toast(checked ? '✅ Departamento asignado' : 'Departamento desasignado', '#10b981');
}

function confirmSaveRutaName(id) {
  const inp = document.getElementById('edit-ruta-'+id);
  const name = inp ? inp.value.trim() : '';
  if (!name) return toast('El nombre no puede estar vacío','#ef4444');
  askConfirm('¿Guardar cambios en esta ruta?', '', () => saveRutaName(id), '💾 Guardar', '#10b981', '💾');
}

function saveRutaName(id) {
  const inp = document.getElementById('edit-ruta-'+id);
  const name = inp ? inp.value.trim() : '';
  if (!name) return toast('El nombre no puede estar vacío','#ef4444');
  const r = S.rutasCliente.find(x => x.id === id);
  if (r) { r.name = name; save(); renderRutaClienteList(); renderClientsIfActive(); renderConfigLists(); toast('✅ Ruta actualizada','#10b981'); }
  window._editingRuta = null;
}

function deleteRutaCliente(id) {
  const r = (S.rutasCliente||[]).find(x=>x.id===id);
  if (!r) return;
  const count = S.clients.filter(c=>c.rutaClienteId===id).length;
  const msg = count
    ? `Esto quitará la ruta "${r.name}" de ${count} cliente(s). ¿Continuar?`
    : `¿Eliminar la ruta "${r.name}"?`;
  askConfirm('🗑 Eliminar ruta', msg, () => {
    S.clients.forEach(c => { if (c.rutaClienteId===id) c.rutaClienteId=null; });
    (S.depts||[]).forEach(d => { if (d.rutaIds) d.rutaIds = d.rutaIds.filter(rid => rid !== id); });
    S.rutasCliente = S.rutasCliente.filter(x=>x.id!==id);
    save(); renderRutaClienteList(); renderDeptList(); renderClientsIfActive(); renderConfigLists();
    toast('Ruta eliminada');
  });
}

function addMun() {
  const inp = document.getElementById('new-mun-name');
  const name = inp.value.trim();
  if (!name) { toast('Escribe el nombre del sector', '#ef4444'); return; }
  const deptId = null;
  if (!S.municipios) S.municipios = [];
  if (S.municipios.some(m => m.name.toLowerCase() === name.toLowerCase())) { toast('Ese sector ya existe', '#f59e0b'); return; }
  S.municipios.push({ id: genId(), name, deptId });
  inp.value = '';
  window._configAddOpen = null;
  save(); renderMunList(); renderClientsIfActive(); renderConfigLists();
  toast('🏘️ Sector agregado');
}

function renderMunList() {
  const wrap = document.getElementById('mun-list');
  if (!wrap) return;
  if (!S.municipios || !S.municipios.length) {
    wrap.innerHTML = '<div style="font-size:12px;color:#64748b;padding:4px 0">Sin sectores. Agrega uno arriba.</div>';
    return;
  }
  const sorted = [...S.municipios].sort((a,b) => a.name.localeCompare(b.name,'es'));
  wrap.innerHTML = sorted.map(m => {
    const count = S.clients.filter(c => c.municipioId === m.id).length;
    const isEditing = window._editingMun === m.id;
    const depts = (m.deptIds||[]).map(did => (S.depts||[]).find(d=>d.id===did)).filter(Boolean);
    if (isEditing) {
      return `<div style="padding:6px 0;border-bottom:1px solid #1e2640">
        <input id="edit-mun-${m.id}" value="${m.name.replace(/"/g,'&quot;')}" style="width:100%;background:#161929;border:1px solid #3b82f6;border-radius:6px;padding:5px 8px;color:#f1f5f9;font-size:13px;margin-bottom:6px;box-sizing:border-box"/>
        <div style="display:flex;gap:6px">
          <button onclick="confirmSaveMunName(${m.id})" style="flex:1;background:#10b981;border:none;border-radius:6px;color:#fff;padding:6px 8px;cursor:pointer;font-size:12px">💾 Guardar</button>
          <button onclick="window._editingMun=null;renderMunList()" style="background:#475569;border:none;border-radius:6px;color:#fff;padding:6px 8px;cursor:pointer;font-size:12px">✕</button>
        </div>
      </div>`;
    }
    return `<div style="display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid #1e2640">
      <button onclick="window._editingMun=${m.id};renderMunList()" style="background:none;border:none;color:#a78bfa;cursor:pointer;font-size:14px;padding:2px 4px">✏️</button>
      <span style="flex:1;font-size:13px;color:#f1f5f9">🏘️ ${m.name} <span style="color:#64748b;font-size:11px">(${count} cliente${count!==1?'s':''})</span>${depts.length?`<span style="display:block;font-size:11px;color:#10b981">🏛️ ${depts.map(d=>d.name).join(', ')}</span>`:'<span style="display:block;font-size:11px;color:#f59e0b">⚠️ Sin departamento asignado</span>'}</span>
      <button class="br" style="font-size:10px;padding:2px 8px" onclick="deleteMun(${m.id})">✕</button>
    </div>`;
  }).join('');
}

function confirmSaveMunName(id) {
  const inp = document.getElementById('edit-mun-'+id);
  const name = inp ? inp.value.trim() : '';
  if (!name) return toast('El nombre no puede estar vacío','#ef4444');
  askConfirm('¿Guardar cambios en este sector?', '', () => saveMunName(id), '💾 Guardar', '#10b981', '💾');
}

function saveMunName(id) {
  const inp = document.getElementById('edit-mun-'+id);
  const name = inp ? inp.value.trim() : '';
  if (!name) return toast('El nombre no puede estar vacío','#ef4444');
  const m = S.municipios.find(x => x.id === id);
  if (m) {
    m.name = name;
    save(); renderMunList(); renderClientsIfActive(); renderConfigLists();
    toast('✅ Sector actualizado','#10b981');
  }
  window._editingMun = null;
}

function deleteMun(id) {
  const m = (S.municipios||[]).find(x=>x.id===id);
  if (!m) return;
  const count = S.clients.filter(c=>c.municipioId===id).length;
  const msg = count
    ? `Esto quitará el sector "${m.name}" de ${count} cliente(s). ¿Continuar?`
    : `¿Eliminar el sector "${m.name}"?`;
  askConfirm('🗑 Eliminar sector', msg, () => {
    S.clients.forEach(c => { if (c.municipioId===id) c.municipioId=null; });
    S.municipios = S.municipios.filter(x=>x.id!==id);
    save(); renderMunList(); renderClientsIfActive(); renderConfigLists();
    toast('Sector eliminado');
  });
}

