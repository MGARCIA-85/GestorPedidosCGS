// ═══════════════════════════════════════════════════════
//  RESPALDO AUTOMÁTICO
// ═══════════════════════════════════════════════════════
const AUTO_BK_KEY  = 'gpgt_auto_backup';
const AUTO_BK_META = 'gpgt_auto_backup_meta';
let _autoBkTimer = null;

function setAutoBackupInterval(minutes) {
  if (_autoBkTimer) clearInterval(_autoBkTimer);
  const mins = Number(minutes);
  S.autoBkInterval = mins; save();
  if (mins > 0) {
    _autoBkTimer = setInterval(runAutoBackup, mins * 60 * 1000);
    toast('⏱️ Respaldo automático: cada ' + (mins >= 60 ? (mins/60)+'h' : mins+'min'), '#10b981');
  } else {
    toast('Respaldo automático desactivado', '#64748b');
  }
  renderBackup();
}

function runAutoBackup() {
  try {
    const data = JSON.stringify(S);
    localStorage.setItem(AUTO_BK_KEY, data);
    const now = new Date();
    const meta = { date: nowDateTimeStr(), ts: now.getTime(), size: (data.length/1024).toFixed(1)+'KB' };
    localStorage.setItem(AUTO_BK_META, JSON.stringify(meta));
    toast('💾 Respaldo automático guardado', '#10b981');
    renderBackup();
  } catch(e) { toast('⚠️ Error en respaldo automático', '#ef4444'); }
}

function checkAutoBackupDue() {
  const mins = S.autoBkInterval != null ? Number(S.autoBkInterval) : 60;
  if (!mins) return;
  try {
    const meta = JSON.parse(localStorage.getItem(AUTO_BK_META) || 'null');
    const lastTs = meta ? meta.ts : 0;
    const elapsed = (Date.now() - lastTs) / 60000; // minutos
    if (elapsed >= mins) runAutoBackup();
  } catch(e) {}
}

function initAutoBackup() {
  const mins = S.autoBkInterval != null ? S.autoBkInterval : 60;
  if (S.autoBkInterval == null) { S.autoBkInterval = 60; save(); }
  const sel = document.getElementById('auto-bk-interval');
  if (sel) sel.value = String(mins);
  if (_autoBkTimer) clearInterval(_autoBkTimer);
  if (mins > 0) {
    // Timer de respaldo cada minuto que verifica si ya pasó el intervalo
    _autoBkTimer = setInterval(checkAutoBackupDue, 60 * 1000);
    // Verificar inmediatamente al arrancar
    checkAutoBackupDue();
  }
  // Verificar también al retomar visibilidad (app vuelve al fondo)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkAutoBackupDue();
  });
  renderBackup();
}

function exportClientsExcel() {
const rows = S.clients.map(c => {
  const dept = (S.depts||[]).find(d=>d.id===c.deptId);
  const mun  = (S.municipios||[]).find(m=>m.id===c.municipioId);
  const ruta = (S.rutasCliente||[]).find(r=>r.id===c.rutaClienteId);
  return {
    'ID Sistema': 'GP-0' + c.id,
    'Nombre': c.name || '',
    'ID Cliente': c.clientCode || '',
    'Prioridad': c.priority || '',
    'Contacto': c.contact || '',
    'Teléfono': c.phone || '',
    'Dirección': c.address || '',
    'Departamento': dept ? dept.name : '',
    'Sector': mun ? mun.name : '',
    'Ruta': ruta ? ruta.name : '',
    'Tipo': c.isProspect ? 'Prospecto' : 'Cliente'
  };
});
const ws = XLSX.utils.json_to_sheet(rows);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
XLSX.writeFile(wb, `clientes_${new Date().toISOString().slice(0,10)}.xlsx`);
toast('📇 Excel de clientes descargado');
}

// Busca el id de una ruta/departamento/sector por su nombre (coincidencia exacta, sin mayúsculas/espacios)
function findEntityIdByName(list, name) {
  const n = (name||'').toString().trim().toLowerCase();
  if (!n) return null;
  const found = (list||[]).find(x => (x.name||'').toString().trim().toLowerCase() === n);
  return found ? found.id : null;
}

function applyImportFieldsToClient(c, row, nombre) {
  if (row['ID Cliente'] !== undefined && row['ID Cliente'] !== '') c.clientCode = row['ID Cliente'].toString().trim();
  if (row['Prioridad']  !== undefined && row['Prioridad']  !== '') c.priority   = row['Prioridad'].toString().trim();
  if (row['Contacto']   !== undefined && row['Contacto']   !== '') c.contact    = row['Contacto'].toString().trim();
  if (row['Teléfono']   !== undefined && row['Teléfono']   !== '') c.phone      = row['Teléfono'].toString().trim();
  if (row['Dirección']  !== undefined && row['Dirección']  !== '') c.address    = row['Dirección'].toString().trim();
  if (row['Departamento'] !== undefined && row['Departamento'] !== '') {
    const did = findEntityIdByName(S.depts, row['Departamento']);
    if (did !== null) c.deptId = did;
  }
  if (row['Sector'] !== undefined && row['Sector'] !== '') {
    const mid = findEntityIdByName(S.municipios, row['Sector']);
    if (mid !== null) c.municipioId = mid;
  }
  if (row['Ruta'] !== undefined && row['Ruta'] !== '') {
    const rid = findEntityIdByName(S.rutasCliente, row['Ruta']);
    if (rid !== null) c.rutaClienteId = rid;
  }
  // Actualizar el nombre guardado en pedidos existentes si el nombre cambió en el archivo
  if (nombre && nombre !== c.name) {
    c.name = nombre;
    S.orders.forEach(o => { if (Number(o.clientId) === c.id) o.clientName = c.name; });
  }
}

function createClientFromImportRow(row, nombre) {
  const id = genId();
  const tipo = (row['Tipo']||'').toString().trim().toLowerCase();
  const isProspect = tipo === 'prospecto';
  const newClient = {
    id,
    name: nombre,
    clientCode:  (row['ID Cliente']||'').toString().trim(),
    priority:    (row['Prioridad']||'').toString().trim(),
    contact:     (row['Contacto']||'').toString().trim(),
    phone:       (row['Teléfono']||'').toString().trim(),
    address:     (row['Dirección']||'').toString().trim(),
    deptId:        findEntityIdByName(S.depts, row['Departamento']),
    municipioId:   findEntityIdByName(S.municipios, row['Sector']),
    rutaClienteId: findEntityIdByName(S.rutasCliente, row['Ruta'])
  };
  if (isProspect) { newClient.isProspect = true; }
  S.clients.push(newClient);
  const init = {}; S.products.forEach(p => { init[p.id] = p.basePrice; });
  S.cp[id] = init;
  return newClient;
}

function importClientsExcel(e) {
const file = e.target.files[0]; if (!file) return;
const status = document.getElementById('import-clients-status');
const reader = new FileReader();
reader.onload = function(ev) {
  try {
    const wb = XLSX.read(new Uint8Array(ev.target.result), {type:'array'});
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, {defval:''});
    let actualizados = 0, noEncontrados = 0, creados = 0;
    rows.forEach(row => {
      const sysIdRaw = (row['ID Sistema']||'').toString().trim().replace(/^GP-0*/i, '');
      const sysId = sysIdRaw !== '' ? Number(sysIdRaw) : null;
      const hasSysId = sysId !== null && !isNaN(sysId);
      const nombre = (row['Nombre']||'').toString().trim();
      let c = null;
      if (hasSysId) {
        // Si trae ID Sistema pero no coincide con ningún cliente, NO se crea nada — se reporta como no encontrado
        c = S.clients.find(x => x.id === sysId);
        if (!c) { noEncontrados++; return; }
      } else {
        // Sin ID Sistema: buscar por nombre entre los existentes
        if (nombre) c = S.clients.find(x => x.name.toLowerCase() === nombre.toLowerCase());
        if (!c) {
          if (!nombre) { noEncontrados++; return; } // sin nombre no se puede crear nada
          createClientFromImportRow(row, nombre);
          creados++;
          return;
        }
      }
      applyImportFieldsToClient(c, row, nombre);
      actualizados++;
    });
    save();
    renderClients(); renderProspects();
    const parts = [];
    if (creados) parts.push(`${creados} cliente(s) nuevo(s) creado(s)`);
    if (actualizados) parts.push(`${actualizados} actualizado(s)`);
    if (noEncontrados) parts.push(`${noEncontrados} no encontrado(s)`);
    const msg = '✅ ' + (parts.length ? parts.join(', ') : 'Nada que importar');
    status.textContent = msg;
    toast(msg);
  } catch(err) {
    console.error(err);
    status.textContent = '❌ Error al leer el archivo. Verifica que sea el Excel exportado por la app.';
    toast('❌ Error al procesar el archivo', '#ef4444');
  }
  e.target.value = '';
};
reader.readAsArrayBuffer(file);
}

function exportBackup() {
S.lastBk = nowDateTimeStr(); save();
const a = document.createElement('a');
a.href = URL.createObjectURL(new Blob([JSON.stringify(S,null,2)],{type:'application/json'}));
a.download = `respaldo_pedidos_${new Date().toISOString().slice(0,10)}.json`;
a.click(); renderBackup(); toast('💾 Respaldo descargado');
}

function importBackup(e) {
const file = e.target.files[0]; if (!file) return;
const r = new FileReader();
r.onload = ev => {
try {
const d = JSON.parse(ev.target.result);
if (!d.products||!d.clients||!d.orders) return alert('Archivo inválido o dañado.');
if (!confirm(`¿Restaurar respaldo?\n\n• ${d.clients.length} clientes\n• ${d.products.length} productos\n• ${d.orders.length} pedidos\n\nEsto reemplazará todos los datos actuales.`)) return;
S = d;
// Garantizar campos nuevos
if (!S.biz)          S.biz = { name:'Mi Negocio',sub:'',phone:'',addr:'',email:'',footer:'Cotización válida por 15 días.',emoji:'📦',logoData:'' };
if (!S.biz.logoData) S.biz.logoData = '';
if (!S.biz.emoji)    S.biz.emoji    = '📦';
if (!S.cp)           S.cp = {};
if (S.products) S.products.forEach(p => { if (!p.unitLabel) p.unitLabel='unidad'; if (!p.unitSize) p.unitSize=1; });
if (!S.routes)   S.routes  = [];
if (!S.nextRid)  S.nextRid = S.routes.length ? Math.max(...S.routes.map(r=>r.id))+1 : 1;
save(); toast('✅ Datos restaurados correctamente');
renderBackup(); refreshLogoPreview(); renderRoutes();
document.getElementById('imp-file').value = '';
} catch(err) { alert('Error al leer el archivo. Asegúrate de que sea un respaldo válido.'); }
};
r.readAsText(file);
}

function clearAll() {
if (!confirm('⚠️ ¿Borrar TODOS los datos?\n\nClientes, productos y pedidos se eliminarán permanentemente.\nEsta acción NO se puede deshacer.')) return;
if (!confirm('¿Confirmas que quieres borrar todo?')) return;
S = { biz:S.biz, products:[], nextPid:1, clients:[], nextCid:1, cp:{}, orders:[], nextOid:1, lastBk:null };
save(); toast('🗑 Todos los datos eliminados'); renderBackup();
}

// ═══════════════════════════════════════════════════════
//  GOOGLE DRIVE
// ═══════════════════════════════════════════════════════
const DRIVE_CLIENT_ID = '818392124571-d97uh9tb7u082jfnssmltanfdp0tguhe.apps.googleusercontent.com';
const DRIVE_SCOPE     = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets';
const DRIVE_FILE_NAME = 'gestor_cgs_backup.json';
const DRIVE_REDIRECT  = 'https://mgarcia-85.github.io/GestorPedidosCGS/index.html';
const DRIVE_GAS_URL   = 'https://script.google.com/macros/s/AKfycbzwBosbUUT7vPPhlOR1K-G1LCCVyfxBcexFQMQa5LMlhfdTxzoOzsNQ4gyuQV20nIXLHA/exec';
let _driveToken = null;
let _driveFileId = null;
let _driveRefreshToken = null;
let _driveTokenExpiry = 0;

function driveConnect() {
  const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' +
    'client_id=' + encodeURIComponent(DRIVE_CLIENT_ID) +
    '&redirect_uri=' + encodeURIComponent(DRIVE_REDIRECT) +
    '&response_type=code' +
    '&scope=' + encodeURIComponent(DRIVE_SCOPE) +
    '&prompt=consent' +
    '&access_type=offline';
  window.location.href = authUrl;
}

async function driveHandleRedirect() {
  const search = window.location.search;
  if (!search.includes('code=')) return;
  const params = new URLSearchParams(search.replace('?',''));
  const code = params.get('code');
  if (!code) return;
  history.replaceState(null, '', window.location.pathname);
  toast('⏳ Conectando con Google Drive...','#f59e0b');
  try {
    const res = await fetch(DRIVE_GAS_URL + '?action=exchange&code=' + encodeURIComponent(code));
    const data = await res.json();
    if (data.access_token) {
      _driveToken = data.access_token;
      _driveRefreshToken = data.refresh_token;
      _driveTokenExpiry = Date.now() + (data.expires_in || 3600) * 1000 - 60000;
      localStorage.setItem('gpgt_drive_token', data.access_token);
      localStorage.setItem('gpgt_drive_refresh', data.refresh_token || '');
      localStorage.setItem('gpgt_drive_expiry', String(_driveTokenExpiry));
      // Verificar si ya existe respaldo en Drive antes de guardar
      try {
        const search = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=name='${DRIVE_FILE_NAME}'&fields=files(id,modifiedTime)&orderBy=modifiedTime+desc`,
          { headers: { Authorization: 'Bearer '+_driveToken } }
        );
        const found = await search.json();
        if (found.files && found.files.length) {
          // Hay respaldo existente — preguntar si importar
          _driveFileId = found.files[0].id;
          localStorage.setItem('gpgt_drive_file_id', _driveFileId);
          const modal = document.getElementById('confirm-modal');
          const inner = modal.querySelector('div');
          inner.innerHTML = `
            <div style="font-size:28px;margin-bottom:8px">☁️</div>
            <div style="font-size:15px;font-weight:700;color:#f1f5f9;margin-bottom:6px">Drive conectado</div>
            <div style="font-size:12px;color:#94a3b8;margin-bottom:18px">Se encontró un respaldo existente en Drive.<br>¿Deseas importar esos datos?</div>
            <div style="display:flex;gap:10px">
              <button onclick="confirmDel(false)" style="flex:1;padding:10px;border-radius:9px;border:1px solid #475569;background:transparent;color:#f1f5f9;font-weight:700;cursor:pointer;font-size:13px">No importar<br><span style="font-weight:400;font-size:11px">(Mantener datos actuales)</span></button>
              <button onclick="confirmDel(true)" style="flex:1;padding:10px;border-radius:9px;border:none;background:#10b981;color:#fff;font-weight:800;cursor:pointer;font-size:13px">📥 Importar<br><span style="font-weight:400;font-size:11px">(Importar backup de Drive)</span></button>
            </div>`;
          modal.style.display = 'flex';
          _confirmCb = () => driveRestoreBackup(true);
        } else {
          // No hay respaldo — guardar el actual
          toast('✅ Google Drive conectado','#10b981');
          driveSaveBackup(false);
        }
      } catch(err) {
        toast('✅ Google Drive conectado','#10b981');
        driveSaveBackup(false);
      }
      renderDriveStatus();
      goTab('backup');
    } else {
      toast('⚠️ Error al conectar Drive: ' + JSON.stringify(data.error),'#ef4444');
    }
  } catch(e) {
    toast('⚠️ Error: ' + e.message,'#ef4444');
  }
}

async function driveEnsureToken() {
  if (_driveToken && Date.now() < _driveTokenExpiry) return true;
  const refresh = _driveRefreshToken || localStorage.getItem('gpgt_drive_refresh');
  if (!refresh) {
    _driveToken = null; renderDriveStatus();
    toast('⚠️ Drive: no hay refresh_token guardado', '#ef4444');
    return false;
  }
  try {
    const res = await fetch(DRIVE_GAS_URL + '?action=refresh&refresh_token=' + encodeURIComponent(refresh));
    if (!res.ok) {
      // Falla temporal del servidor/red — NO se desconecta Drive, solo se avisa discretamente y se reintenta después
      setTempConnIssue(true);
      toast('⚠️ Drive: sin respuesta al renovar token (temporal)', '#f59e0b');
      return false;
    }
    const data = await res.json();
    if (data.access_token) {
      setTempConnIssue(false);
      _driveToken = data.access_token;
      _driveTokenExpiry = Date.now() + (data.expires_in || 3600) * 1000 - 60000;
      localStorage.setItem('gpgt_drive_token', data.access_token);
      localStorage.setItem('gpgt_drive_expiry', String(_driveTokenExpiry));
      return true;
    }
    // Solo una revocación confirmada por Google (invalid_grant) desconecta Drive de verdad
    if (data.error === 'invalid_grant') {
      _driveToken = null;
      _driveRefreshToken = null;
      localStorage.removeItem('gpgt_drive_refresh');
      localStorage.removeItem('gpgt_drive_token');
      renderDriveStatus();
      toast('⚠️ Drive desconectado (token revocado) — reconecta en Empresa', '#ef4444');
    } else {
      // Respuesta no reconocida (probablemente por una conexión inestable) — falla temporal, NO se borra la conexión
      setTempConnIssue(true);
      toast('⚠️ Drive: respuesta inesperada al renovar token (temporal) — se reintentará', '#f59e0b');
    }
    return false;
  } catch(e) {
    // Error de red (sin señal, timeout, etc.) — falla temporal, NO se borra la conexión
    setTempConnIssue(true);
    toast('⚠️ Drive: sin conexión al renovar token — se reintentará', '#f59e0b');
    return false;
  }
}

// Indicador discreto de problema temporal de conexión (no desconecta Drive, solo informa)
let _tempConnIssue = false;
function setTempConnIssue(active) {
  _tempConnIssue = active;
  updateOfflineBadge();
}

function updateOfflineBadge() {
  const b = document.getElementById('offline-badge');
  if (!b) return;
  const offline = !navigator.onLine || _tempConnIssue;
  if (offline) {
    b.textContent = '🔴';
    b.title = 'Sin señal — los cambios se guardan localmente y se sincronizarán al recuperar conexión';
  } else {
    b.textContent = '🟢';
    b.title = 'Con señal';
  }
}

// Al recuperar conexión (o volver de segundo plano), reintenta silenciosamente y refresca el estado real de Drive
let _syncCheckInProgress = false;

async function recheckDriveOnResume() {
  updateOfflineBadge();
  if (!navigator.onLine) return;
  const hasRefresh = _driveRefreshToken || localStorage.getItem('gpgt_drive_refresh');
  if (hasRefresh) {
    setTempConnIssue(false);
    const ok = await driveEnsureToken();
    if (ok) await checkRemoteSyncStatus();
  }
  renderDriveStatus();
}

// Revisa si el respaldo en Drive cambió desde la última vez que este dispositivo se sincronizó,
// y si este dispositivo tiene cambios propios sin subir — para decidir qué aviso mostrar (si alguno).
async function checkRemoteSyncStatus() {
  const lastSyncedSnap = localStorage.getItem('gpgt_last_synced_snapshot');
  if (!lastSyncedSnap) return; // primera conexión — ya la maneja el flujo inicial de conectar Drive
  if (_syncCheckInProgress) return;
  if (document.getElementById('confirm-modal')?.style.display === 'flex') return; // ya hay un modal abierto
  _syncCheckInProgress = true;
  try {
    const meta = await driveGetRemoteMeta();
    if (!meta) return;
    const lastSyncedTime = localStorage.getItem('gpgt_last_synced_time');
    const remoteChanged = !lastSyncedTime || meta.modifiedTime !== lastSyncedTime;
    if (!remoteChanged) return; // nada nuevo en Drive
    if (hasUnsyncedLocalChanges()) {
      showSyncConflictModal(meta);
    } else {
      showSyncSimpleUpdateModal(meta);
    }
  } finally {
    _syncCheckInProgress = false;
  }
}

// Caso simple: Drive tiene algo nuevo y este dispositivo no tiene cambios propios pendientes
function showSyncSimpleUpdateModal(meta) {
  const modal = document.getElementById('confirm-modal');
  const inner = modal.querySelector('div');
  inner.innerHTML = `
    <div style="font-size:28px;margin-bottom:8px">☁️🔄</div>
    <div style="font-size:15px;font-weight:700;color:#f1f5f9;margin-bottom:6px">Hay datos más recientes en Drive</div>
    <div style="font-size:12px;color:#94a3b8;margin-bottom:18px">Otro dispositivo actualizó la información. Impórtala para seguir trabajando con lo más reciente.</div>
    <div style="display:flex;gap:10px">
      <button onclick="document.getElementById('confirm-modal').style.display='none'" style="flex:1;padding:10px;border-radius:9px;border:1px solid #475569;background:transparent;color:#f1f5f9;font-weight:700;cursor:pointer;font-size:13px">Más tarde</button>
      <button onclick="syncSimpleImport('${meta.id}')" style="flex:1;padding:10px;border-radius:9px;border:none;background:#10b981;color:#fff;font-weight:800;cursor:pointer;font-size:13px">📥 Importar ahora</button>
    </div>`;
  modal.style.display = 'flex';
}

async function syncSimpleImport(fileId) {
  document.getElementById('confirm-modal').style.display = 'none';
  toast('⏳ Importando datos de Drive...', '#f59e0b');
  const data = await driveFetchRemoteContent(fileId);
  if (!data || !data.clients) { toast('⚠️ No se pudo importar el respaldo', '#ef4444'); return; }
  const meta = await driveGetRemoteMeta();
  localStorage.setItem(LS, JSON.stringify(data));
  markSynced(data, meta ? meta.modifiedTime : null);
  toast('✅ Datos actualizados. Recargando...', '#10b981');
  setTimeout(() => window.location.reload(), 1200);
}

// Caso de conflicto real: Drive cambió Y este dispositivo también tiene cambios sin subir
function showSyncConflictModal(meta) {
  const modal = document.getElementById('confirm-modal');
  const inner = modal.querySelector('div');
  inner.innerHTML = `
    <div style="font-size:28px;margin-bottom:8px">⚠️☁️</div>
    <div style="font-size:15px;font-weight:700;color:#f1f5f9;margin-bottom:6px">Cambios en dos dispositivos a la vez</div>
    <div style="font-size:12px;color:#94a3b8;margin-bottom:18px">Este dispositivo tiene cambios sin subir, y otro dispositivo también actualizó datos mientras tanto.</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <button onclick="syncResolveConflict('merge','${meta.id}')" style="padding:10px;border-radius:9px;border:none;background:#10b981;color:#fff;font-weight:800;cursor:pointer;font-size:13px">🔀 Combinar<br><span style="font-weight:400;font-size:11px">(Recomendado: junta ambos cambios)</span></button>
      <button onclick="syncResolveConflict('overwrite','${meta.id}')" style="padding:10px;border-radius:9px;border:1px solid #ef4444;background:transparent;color:#fca5a5;font-weight:700;cursor:pointer;font-size:13px">Guardar de todos modos<br><span style="font-weight:400;font-size:11px">(Reemplaza lo de Drive con lo de este dispositivo)</span></button>
      <button onclick="document.getElementById('confirm-modal').style.display='none'" style="padding:10px;border-radius:9px;border:1px solid #475569;background:transparent;color:#f1f5f9;font-weight:700;cursor:pointer;font-size:13px">Cancelar</button>
    </div>`;
  modal.style.display = 'flex';
}

async function syncResolveConflict(action, fileId) {
  document.getElementById('confirm-modal').style.display = 'none';
  if (action === 'overwrite') {
    toast('☁️ Guardando tus datos en Drive...', '#f59e0b');
    await driveSaveBackup(true);
    return;
  }
  // Combinar
  toast('⏳ Combinando datos de ambos dispositivos...', '#f59e0b');
  const remoteData = await driveFetchRemoteContent(fileId);
  if (!remoteData || !remoteData.clients) { toast('⚠️ No se pudo descargar el respaldo remoto para combinar', '#ef4444'); return; }
  const { anyClash } = await driveMergeAndSave(remoteData);
  renderOrderPage(); renderBackup();
  if (anyClash) {
    toast('✅ Combinado. Algunos registros se editaron en ambos lados — se conservó la versión de este dispositivo en esos casos.', '#f59e0b');
  } else {
    toast('✅ Datos combinados correctamente. Nada se perdió.', '#10b981');
  }
}

window.addEventListener('online', () => { setTempConnIssue(false); recheckDriveOnResume(); });
window.addEventListener('offline', () => { updateOfflineBadge(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') recheckDriveOnResume();
});

async function driveRestoreBackup(skipConfirm = false) {
  if (!_driveToken) return toast('Primero conecta Google Drive','#f59e0b');
  const doRestore = async () => {
    try {
      toast('⏳ Buscando respaldo en Drive...','#f59e0b');
      const search = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='${DRIVE_FILE_NAME}'&fields=files(id,name,modifiedTime)&orderBy=modifiedTime+desc`,
        { headers: { Authorization: 'Bearer '+_driveToken } }
      );
      if (!search.ok) {
        const err = await search.json();
        if (err.error?.code === 401) { const renewed = await driveEnsureToken(); if (!renewed) { renderDriveStatus(); return toast('Sesión expirada. Vuelve a conectar Drive.','#ef4444'); } return driveSaveBackup(showToast); }
        return toast('⚠️ Error: '+JSON.stringify(err.error?.message),'#ef4444');
      }
      const found = await search.json();
      if (!found.files || !found.files.length) return toast('⚠️ No se encontró respaldo en Drive','#ef4444');
      const fInfo = found.files[0];
      const fid = fInfo.id;
      _driveFileId = fid;
      localStorage.setItem('gpgt_drive_file_id', fid);
      toast('⏳ Descargando datos...','#f59e0b');
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fid}?alt=media`,
        { headers: { Authorization: 'Bearer '+_driveToken } }
      );
      if (!res.ok) return toast('⚠️ Error al descargar','#ef4444');
      const data = await res.json();
      if (!data || !data.clients) return toast('⚠️ El archivo de Drive no tiene datos válidos','#ef4444');
      localStorage.setItem(LS, JSON.stringify(data));
      markSynced(data, fInfo.modifiedTime);
      toast('✅ Datos importados. Recargando...','#10b981');
      setTimeout(() => window.location.reload(), 1500);
    } catch(e) { toast('⚠️ Error: '+e.message,'#ef4444'); }
  };

  if (skipConfirm) { doRestore(); return; }

  const modal = document.getElementById('confirm-modal');
  const inner = modal.querySelector('div');
  inner.innerHTML = `
    <div style="font-size:28px;margin-bottom:8px">☁️</div>
    <div id="confirm-msg" style="font-size:15px;font-weight:700;color:#f1f5f9;margin-bottom:6px">¿Importar datos desde Drive?</div>
    <div id="confirm-sub" style="font-size:12px;color:#94a3b8;margin-bottom:18px">Esto reemplazará todos los datos actuales con el último respaldo guardado en Drive.</div>
    <div style="display:flex;gap:10px">
      <button onclick="confirmDel(false)" style="flex:1;padding:10px;border-radius:9px;border:1px solid #475569;background:transparent;color:#f1f5f9;font-weight:700;cursor:pointer;font-size:14px">Cancelar</button>
      <button onclick="confirmDel(true)" style="flex:1;padding:10px;border-radius:9px;border:none;background:#10b981;color:#fff;font-weight:800;cursor:pointer;font-size:14px">📥 Importar</button>
    </div>`;
  modal.style.display = 'flex';
  _confirmCb = doRestore;
}

function driveDisconnect() {
  _driveToken = null;
  _driveFileId = null;
  _driveRefreshToken = null;
  _driveTokenExpiry = 0;
  localStorage.removeItem('gpgt_drive_token');
  localStorage.removeItem('gpgt_drive_file_id');
  localStorage.removeItem('gpgt_drive_refresh');
  localStorage.removeItem('gpgt_drive_expiry');
  toast('Drive desconectado','#64748b');
  renderDriveStatus();
}

async function driveSaveBackup(showToast=true) {
  const ok = await driveEnsureToken();
  if (!ok || !_driveToken) return;
  try {
    const data = JSON.stringify(S, null, 2);
    const fileId = _driveFileId || localStorage.getItem('gpgt_drive_file_id');
    let url, method;
    if (fileId) {
      url    = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&fields=id,modifiedTime`;
      method = 'PATCH';
    } else {
      // Buscar si ya existe
      const search = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='${DRIVE_FILE_NAME}'+and+trashed=false&fields=files(id)`,
        { headers: { Authorization: 'Bearer '+_driveToken } }
      );
      const found = await search.json();
      if (found.files && found.files.length) {
        _driveFileId = found.files[0].id;
        localStorage.setItem('gpgt_drive_file_id', _driveFileId);
        url    = `https://www.googleapis.com/upload/drive/v3/files/${_driveFileId}?uploadType=media&fields=id,modifiedTime`;
        method = 'PATCH';
      } else {
        // Crear nuevo
        const meta = await fetch(
          'https://www.googleapis.com/drive/v3/files',
          { method:'POST', headers:{ Authorization:'Bearer '+_driveToken, 'Content-Type':'application/json' },
            body: JSON.stringify({ name: DRIVE_FILE_NAME }) }
        );
        const mj = await meta.json();
        _driveFileId = mj.id;
        localStorage.setItem('gpgt_drive_file_id', _driveFileId);
        url    = `https://www.googleapis.com/upload/drive/v3/files/${_driveFileId}?uploadType=media&fields=id,modifiedTime`;
        method = 'PATCH';
      }
    }
    const res = await fetch(url, {
      method, headers: { Authorization:'Bearer '+_driveToken, 'Content-Type':'application/json' },
      body: data
    });
    if (res.ok) {
      const rj = await res.json();
      const now = nowDateTimeStr();
      S.lastDriveBk = now;
      try { localStorage.setItem(LS, JSON.stringify(S)); } catch(e) {}
      markSynced(S, rj.modifiedTime);
      if (showToast) toast('☁️ Guardado en Drive: '+now,'#10b981');
      renderDriveStatus();
    } else {
      // Token expirado — intentar renovar antes de asumir que está desconectado
      const err = await res.json();
      if (err.error?.code === 401) {
        const renewed = await driveEnsureToken();
        if (renewed) return driveSaveBackup(showToast);
        renderDriveStatus();
      }
      else if (showToast) toast('⚠️ Error al guardar en Drive','#ef4444');
    }
  } catch(e) { setTempConnIssue(true); if (showToast) toast('⚠️ Sin conexión','#f59e0b'); }
}


// ═══════════════════════════════════════════════════════
//  SINCRONIZACIÓN MULTI-DISPOSITIVO
// ═══════════════════════════════════════════════════════

// Guarda el "punto de referencia": cómo quedaron los datos la última vez que este
// dispositivo estuvo sincronizado con Drive (para poder comparar más adelante).
function markSynced(dataObj, remoteTime) {
  try {
    localStorage.setItem('gpgt_last_synced_snapshot', JSON.stringify(dataObj));
    if (remoteTime) localStorage.setItem('gpgt_last_synced_time', remoteTime);
  } catch(e) {}
}

// ¿Este dispositivo tiene cambios que no ha logrado subir a Drive todavía?
function hasUnsyncedLocalChanges() {
  try {
    const snap = localStorage.getItem('gpgt_last_synced_snapshot');
    if (!snap) return false; // nunca se ha sincronizado — no hay base para comparar
    return snap !== JSON.stringify(S);
  } catch(e) { return false; }
}

// Metadatos del respaldo actual en Drive (sin descargar el contenido completo)
async function driveGetRemoteMeta() {
  try {
    const fileId = _driveFileId || localStorage.getItem('gpgt_drive_file_id');
    if (fileId) {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,modifiedTime`, { headers:{ Authorization:'Bearer '+_driveToken } });
      if (res.ok) return await res.json();
      return null;
    }
    const search = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${DRIVE_FILE_NAME}'+and+trashed=false&fields=files(id,modifiedTime)&orderBy=modifiedTime+desc`,
      { headers:{ Authorization:'Bearer '+_driveToken } }
    );
    if (!search.ok) return null;
    const found = await search.json();
    return (found.files && found.files.length) ? found.files[0] : null;
  } catch(e) { return null; }
}

async function driveFetchRemoteContent(fileId) {
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, { headers:{ Authorization:'Bearer '+_driveToken } });
    if (!res.ok) return null;
    return await res.json();
  } catch(e) { return null; }
}

// Combina un arreglo (pedidos, clientes, productos, etc.) identificado por "id",
// comparando la versión base (última sincronización), la local y la remota.
function mergeArrayById(base, local, remote, idKey='id') {
  base = base || []; local = local || []; remote = remote || [];
  const baseMap = new Map(base.map(x => [x[idKey], x]));
  const localMap = new Map(local.map(x => [x[idKey], x]));
  const remoteMap = new Map(remote.map(x => [x[idKey], x]));
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);
  const merged = [];
  let hadClash = false;
  for (const id of allIds) {
    const b = baseMap.get(id), l = localMap.get(id), r = remoteMap.get(id);
    if (l && !r) {
      if (b) { if (JSON.stringify(l) !== JSON.stringify(b)) merged.push(l); /* si no cambió, se respeta el borrado remoto */ }
      else merged.push(l); // nuevo local
    } else if (r && !l) {
      if (b) { if (JSON.stringify(r) !== JSON.stringify(b)) merged.push(r); /* si no cambió, se respeta el borrado local */ }
      else merged.push(r); // nuevo remoto
    } else if (l && r) {
      const lStr = JSON.stringify(l), rStr = JSON.stringify(r);
      if (lStr === rStr) { merged.push(l); continue; }
      const bStr = JSON.stringify(b);
      const lChanged = lStr !== bStr, rChanged = rStr !== bStr;
      if (lChanged && !rChanged) merged.push(l);
      else if (rChanged && !lChanged) merged.push(r);
      else { merged.push(l); hadClash = true; } // ambos cambiaron el mismo registro — se conserva el local
    }
  }
  return { merged, hadClash };
}

// Combina la tabla de precios por cliente (estructura anidada clienteId -> productoId -> precio)
function mergeCp(base, local, remote) {
  base = base || {}; local = local || {}; remote = remote || {};
  const allClientIds = new Set([...Object.keys(local), ...Object.keys(remote)]);
  const merged = {};
  let hadClash = false;
  for (const cid of allClientIds) {
    const b = base[cid] || {}, l = local[cid] || {}, r = remote[cid] || {};
    const allPid = new Set([...Object.keys(l), ...Object.keys(r)]);
    const obj = {};
    for (const pid of allPid) {
      const bv = b[pid], lv = l[pid], rv = r[pid];
      if (lv === rv) { if (lv !== undefined) obj[pid] = lv; continue; }
      const lChanged = lv !== bv, rChanged = rv !== bv;
      if (lChanged && !rChanged) obj[pid] = lv;
      else if (rChanged && !lChanged) obj[pid] = rv;
      else { obj[pid] = lv; hadClash = true; }
    }
    merged[cid] = obj;
  }
  return { merged, hadClash };
}

// Combina todas las colecciones de datos usando el respaldo más reciente de Drive
// como "remoto", el último punto sincronizado como "base", y S como "local".
async function driveMergeAndSave(remoteData) {
  const baseStr = localStorage.getItem('gpgt_last_synced_snapshot');
  const base = baseStr ? JSON.parse(baseStr) : {};
  const mergedS = JSON.parse(JSON.stringify(S));
  let anyClash = false;

  [['products','id'], ['clients','id'], ['orders','id'], ['depts','id'],
   ['municipios','id'], ['rutasCliente','id']].forEach(([key, idKey]) => {
    const { merged, hadClash } = mergeArrayById(base[key], S[key], remoteData[key], idKey);
    mergedS[key] = merged;
    if (hadClash) anyClash = true;
  });

  const cpRes = mergeCp(base.cp, S.cp, remoteData.cp);
  mergedS.cp = cpRes.merged;
  if (cpRes.hadClash) anyClash = true;

  // Datos de empresa (un solo objeto, no colección): si solo cambió un lado, usar ese; si ambos, se queda el local
  const bBiz = JSON.stringify(base.biz||{}), lBiz = JSON.stringify(S.biz||{}), rBiz = JSON.stringify(remoteData.biz||{});
  if (lBiz !== rBiz && lBiz === bBiz) mergedS.biz = remoteData.biz;

  // Contadores de próximos IDs: usar el mayor de ambos lados para no repetir IDs
  ['nextPid','nextCid','nextOid','nextDeptId','nextMunId','nextRutaClienteId'].forEach(k => {
    mergedS[k] = Math.max(S[k]||1, remoteData[k]||1);
  });

  S = mergedS;
  try { localStorage.setItem(LS, JSON.stringify(S)); } catch(e) {}
  await driveSaveBackup(false);
  return { anyClash };
}

function updateDriveDisconnectAlert() {
  const alertEl = document.getElementById('drive-disconnect-alert');
  if (!alertEl) return;
  if (_driveToken) {
    alertEl.style.display = 'none';
  } else {
    // Se muestra siempre que no haya conexión activa, incluso en un dispositivo nuevo que nunca se conectó
    alertEl.style.display = 'flex';
  }
}

function renderDriveStatus() {
  const st  = document.getElementById('drive-status');
  const cb  = document.getElementById('drive-connect-btn');
  const sb  = document.getElementById('drive-sync-btn');
  const db  = document.getElementById('drive-disconnect-btn');
  if (!st) return;
  const rb  = document.getElementById('drive-restore-btn');
  if (_driveToken) {
    st.innerHTML  = `<span style="color:#10b981">✅ Conectado</span>${S.lastDriveBk?' · Último sync: '+S.lastDriveBk:''}`;
    if (cb) cb.style.display = 'none';
    if (sb) sb.style.display = '';
    if (rb) rb.style.display = '';
    if (db) db.style.display = '';
  } else {
    st.textContent = 'Estado: no conectado';
    if (cb) cb.style.display = '';
    if (sb) sb.style.display = 'none';
    if (rb) rb.style.display = 'none';
    if (db) db.style.display = 'none';
  }
  updateDriveDisconnectAlert();
  renderSheetsStatus();
}

function initDrive() {
  updateOfflineBadge();
  const tok = localStorage.getItem('gpgt_drive_token');
  const fid = localStorage.getItem('gpgt_drive_file_id');
  const ref = localStorage.getItem('gpgt_drive_refresh');
  const exp = localStorage.getItem('gpgt_drive_expiry');
  const pending = localStorage.getItem('gpgt_drive_pending');
  if (tok) { _driveToken = tok; }
  if (fid) { _driveFileId = fid; }
  if (ref) { _driveRefreshToken = ref; }
  if (exp) { _driveTokenExpiry = parseInt(exp); }
  if (pending) {
    localStorage.removeItem('gpgt_drive_pending');
    setTimeout(async () => {
      // Verificar si hay respaldo existente en Drive
      try {
        const search = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=name='${DRIVE_FILE_NAME}'&fields=files(id,modifiedTime)&orderBy=modifiedTime+desc`,
          { headers: { Authorization: 'Bearer '+_driveToken } }
        );
        const found = await search.json();
        if (found.files && found.files.length) {
          // Hay respaldo — preguntar si importar
          _driveFileId = found.files[0].id;
          localStorage.setItem('gpgt_drive_file_id', _driveFileId);
          const modal = document.getElementById('confirm-modal');
          const inner = modal.querySelector('div');
          inner.innerHTML = `
            <div style="font-size:28px;margin-bottom:8px">☁️</div>
            <div style="font-size:15px;font-weight:700;color:#f1f5f9;margin-bottom:6px">Drive conectado</div>
            <div style="font-size:12px;color:#94a3b8;margin-bottom:18px">Se encontró un respaldo existente en Drive.<br>¿Deseas importar esos datos?</div>
            <div style="display:flex;gap:10px">
              <button onclick="confirmDel(false)" style="flex:1;padding:10px;border-radius:9px;border:1px solid #475569;background:transparent;color:#f1f5f9;font-weight:700;cursor:pointer;font-size:13px">No importar<br><span style="font-weight:400;font-size:11px">(Mantener datos actuales)</span></button>
              <button onclick="confirmDel(true)" style="flex:1;padding:10px;border-radius:9px;border:none;background:#10b981;color:#fff;font-weight:800;cursor:pointer;font-size:13px">📥 Importar<br><span style="font-weight:400;font-size:11px">(Importar backup de Drive)</span></button>
            </div>`;
          modal.style.display = 'flex';
          _confirmCb = () => driveRestoreBackup(true);
        } else {
          // No hay respaldo — guardar el actual
          toast('✅ Google Drive conectado','#10b981');
          driveSaveBackup(false);
        }
      } catch(e) {
        toast('✅ Google Drive conectado','#10b981');
      }
      renderDriveStatus();
      goTab('backup');
    }, 800);
  }
  renderDriveStatus();
  if (_driveToken && !pending) checkRemoteSyncStatus();
}
