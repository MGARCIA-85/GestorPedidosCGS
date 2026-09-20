// ═══════════════════════════════════════════════════════
//  GOOGLE SHEETS (Clientes compartidos con Planificador CGS)
// ═══════════════════════════════════════════════════════
const SHEETS_ID  = '1EsRshQe_iLHt1Sp70ouYhxTBWtL-s10TztJPTJMTtks';
const SHEETS_TAB = 'Clientes';
const SHEETS_HEADERS = ['ID Sistema','Nombre','ID Cliente','Prioridad','Contacto','Teléfono','Dirección','Departamento','Sector','Ruta','Tipo'];
let _sheetsSyncTimer = null;

// Arma las filas (encabezado + una fila por cliente) en el orden exacto de columnas de la Hoja
function buildClientsSheetRows() {
  const rows = [SHEETS_HEADERS];
  (S.clients||[]).forEach(c => {
    const dept = (S.depts||[]).find(d => d.id === c.deptId);
    const mun  = (S.municipios||[]).find(m => m.id === c.municipioId);
    const ruta = (S.rutasCliente||[]).find(r => r.id === c.rutaClienteId);
    rows.push([
      c.id != null ? String(c.id) : '',
      c.name || '',
      c.clientCode || '',
      c.priority || '',
      c.contact || '',
      c.phone || '',
      c.address || '',
      dept ? dept.name : '',
      mun ? mun.name : '',
      ruta ? ruta.name : '',
      c.isProspect ? 'Prospecto' : 'Cliente'
    ]);
  });
  return rows;
}

function renderSheetsStatus(msg, color) {
  const el = document.getElementById('sheets-status');
  if (!el) return;
  if (msg) { el.textContent = 'Estado: ' + msg; el.style.color = color || '#94a3b8'; return; }
  if (!_driveToken) { el.textContent = 'Estado: conecta Google Drive arriba primero (misma cuenta)'; el.style.color = '#94a3b8'; return; }
  const last = localStorage.getItem('gpgt_sheets_last');
  el.textContent = last ? ('Estado: última actualización ' + last) : 'Estado: aún no se ha sincronizado';
  el.style.color = '#94a3b8';
}

async function syncClientsToSheets(showToast) {
  const ok = await driveEnsureToken();
  if (!ok || !_driveToken) {
    if (showToast) toast('⚠️ Conecta Google Drive primero (Configuración → Respaldo)', '#ef4444');
    renderSheetsStatus('sin conectar', '#ef4444');
    return;
  }
  try {
    const rows = buildClientsSheetRows();
    const lastCol = String.fromCharCode(64 + SHEETS_HEADERS.length); // 11 columnas → 'K'
    const range = `${SHEETS_TAB}!A1:${lastCol}${rows.length}`;
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_ID}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + _driveToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ range, majorDimension: 'ROWS', values: rows })
      }
    );
    if (res.ok) {
      const now = nowDateTimeStr();
      localStorage.setItem('gpgt_sheets_last', now);
      renderSheetsStatus('última actualización ' + now, '#10b981');
      if (showToast) toast('📊 Clientes actualizados en Sheets', '#10b981');
    } else if (res.status === 401) {
      const renewed = await driveEnsureToken();
      if (renewed) return syncClientsToSheets(showToast);
      renderSheetsStatus('sesión vencida, reconecta Drive', '#ef4444');
    } else {
      if (showToast) toast('⚠️ Error al actualizar Sheets', '#ef4444');
      renderSheetsStatus('error al actualizar', '#ef4444');
    }
  } catch(e) {
    setTempConnIssue(true);
    if (showToast) toast('⚠️ Sin conexión', '#f59e0b');
  }
}
