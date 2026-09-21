const ACT_EXP_KEY   = 'cgs_activation_expiry';
const SESSION_KEY   = 'cgs_session_active';

// Códigos gestionados en Firebase Firestore (colección: codigos)
// Agrega/modifica códigos desde console.firebase.google.com sin tocar este archivo

function checkLock() {
  const ls = document.getElementById('lock-screen');

  // 1. Verificar si ya hay sesión activa en esta pestaña
  if (sessionStorage.getItem(SESSION_KEY) === '1') {
    ls.style.display = 'none';
    return;
  }

  // 2. Verificar código de activación y expiración
  const savedCode = localStorage.getItem(ACT_CODE_KEY);
  const expiry    = localStorage.getItem(ACT_EXP_KEY);
  const now       = Date.now();

  if (!savedCode || !expiry) {
    // No activado — mostrar panel de código
    ls.style.display = 'flex';
    showLockPanel('code');
    return;
  }

  if (now > parseInt(expiry)) {
    // Expirado
    ls.style.display = 'flex';
    showLockPanel('expired');
    return;
  }

  // 3. Activado y vigente — verificar contraseña de sesión
  const pwd = localStorage.getItem(LOCK_KEY);
  if (!pwd) {
    // Sin contraseña, entrar directo
    sessionStorage.setItem(SESSION_KEY, '1');
    ls.style.display = 'none';
    return;
  }
  ls.style.display = 'flex';
  showLockPanel('pwd');
  setTimeout(() => document.getElementById('lock-input').focus(), 100);
}

function showLockPanel(panel) {
  document.getElementById('lock-panel-pwd').style.display     = panel === 'pwd'     ? 'flex' : 'none';
  document.getElementById('lock-panel-code').style.display    = panel === 'code'    ? 'flex' : 'none';
  document.getElementById('lock-panel-expired').style.display = panel === 'expired' ? 'flex' : 'none';
}

function unlockApp() {
  const pwd   = localStorage.getItem(LOCK_KEY);
  const input = document.getElementById('lock-input').value;
  const errEl = document.getElementById('lock-error');
  if (!pwd || input === pwd) {
    sessionStorage.setItem(SESSION_KEY, '1');
    document.getElementById('lock-screen').style.display = 'none';
    document.getElementById('lock-input').value = '';
    errEl.style.display = 'none';
  } else {
    errEl.style.display = 'block';
    document.getElementById('lock-input').value = '';
    document.getElementById('lock-input').focus();
  }
}

async function activateApp() {
  const input = document.getElementById('lock-code-input').value.trim().toUpperCase();
  const errEl = document.getElementById('lock-code-error');
  const btn   = document.querySelector('#lock-panel-code button');

  if (!input) return;

  // Mostrar estado de carga
  if (btn) { btn.textContent = 'Verificando...'; btn.disabled = true; }
  errEl.style.display = 'none';

  try {
    let resultado = { valido: false };

    if (window._verificarCodigoFirebase) {
      resultado = await window._verificarCodigoFirebase(input);
    } else {
      // Fallback local si Firebase no cargó
      const LOCAL = { 'GESTPCGS9379':36500, 'GEST365CGS88':365, 'CGS90GEST234':90, 'PRUEBA1CGS30':30 };
      if (LOCAL[input] !== undefined) resultado = { valido: true, dias: LOCAL[input] };
    }

    if (resultado.valido) {
      const dias   = Number(resultado.dias); // forzar número
      const expiry = dias >= 36500 ? 9999999999999 : Date.now() + dias * 24 * 60 * 60 * 1000;
      localStorage.setItem(ACT_CODE_KEY, input);
      localStorage.setItem(ACT_EXP_KEY, String(expiry));
      localStorage.setItem('cgs_act_dias', String(dias)); // guardar días originales
      sessionStorage.setItem(SESSION_KEY, '1');
      document.getElementById('lock-screen').style.display = 'none';
      document.getElementById('lock-code-input').value = '';
      const msg = dias >= 36500 ? '✅ App activada — Acceso de por vida' : '✅ App activada por ' + dias + ' días';
      toast(msg, '#10b981');
    } else {
      errEl.style.display = 'block';
      document.getElementById('lock-code-input').value = '';
      document.getElementById('lock-code-input').focus();
    }
  } finally {
    if (btn) { btn.textContent = 'Activar'; btn.disabled = false; }
  }
}

function showPwdPanel() {
  const panel = document.getElementById('pwd-panel');
  const inner = document.getElementById('pwd-panel-inner');
  if (!panel || !inner) return;
  const hasPwd = !!localStorage.getItem(LOCK_KEY);
  panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
  inner.innerHTML = `
    <div style="color:#94a3b8;font-size:12px;margin-bottom:4px">${hasPwd ? 'Cambiar contraseña' : 'Crear contraseña'}</div>
    ${hasPwd ? `<input id="pwd-old" type="password" placeholder="Contraseña actual" style="background:#0d0f18;border:1px solid #2a3050;border-radius:8px;padding:10px;color:#f1f5f9;font-size:13px;width:100%;box-sizing:border-box"/>` : ''}
    <input id="pwd-new1" type="password" placeholder="Nueva contraseña" style="background:#0d0f18;border:1px solid #2a3050;border-radius:8px;padding:10px;color:#f1f5f9;font-size:13px;width:100%;box-sizing:border-box"/>
    <input id="pwd-new2" type="password" placeholder="Confirmar contraseña" style="background:#0d0f18;border:1px solid #2a3050;border-radius:8px;padding:10px;color:#f1f5f9;font-size:13px;width:100%;box-sizing:border-box"/>
    <div style="display:flex;gap:6px">
      <button onclick="savePwdPanel()" style="background:#00c97a;color:#001a10;border:none;border-radius:8px;padding:9px 14px;font-size:13px;font-weight:700;cursor:pointer;flex:1">💾 Guardar</button>
      ${hasPwd ? `<button onclick="deletePwd()" style="background:#ef4444;color:#fff;border:none;border-radius:8px;padding:9px 14px;font-size:13px;cursor:pointer">🗑 Quitar</button>` : ''}
    </div>
  `;
}

function savePwdPanel() {
  const hasPwd = !!localStorage.getItem(LOCK_KEY);
  const oldEl  = document.getElementById('pwd-old');
  const np1    = (document.getElementById('pwd-new1')?.value || '').trim();
  const np2    = (document.getElementById('pwd-new2')?.value || '').trim();
  if (hasPwd) {
    const old = oldEl?.value || '';
    if (old !== localStorage.getItem(LOCK_KEY)) { toast('Contraseña actual incorrecta', '#ef4444'); return; }
  }
  if (!np1) { toast('Escribe una contraseña', '#f59e0b'); return; }
  if (np1 !== np2) { toast('Las contraseñas no coinciden', '#ef4444'); return; }
  localStorage.setItem(LOCK_KEY, np1);
  document.getElementById('pwd-panel').style.display = 'none';
  toast('🔐 Contraseña guardada', '#10b981');
}

function deletePwd() {
  localStorage.removeItem(LOCK_KEY);
  document.getElementById('pwd-panel').style.display = 'none';
  toast('🔓 Contraseña eliminada', '#10b981');
}

function refreshActivationInfo() {
  const el = document.getElementById('activation-info');
  if (!el) return;
  const code   = localStorage.getItem(ACT_CODE_KEY);
  const expiry = localStorage.getItem(ACT_EXP_KEY);
  if (!code || !expiry) {
    el.textContent = '⚠️ App no activada';
    el.style.color = '#ef4444';
    return;
  }
  const exp = parseInt(expiry);
  if (exp >= 9999999999990) {
    el.textContent = '✅ Acceso de por vida · Código: ' + code;
    el.style.color = '#10b981';
    return;
  }
  const _now = Date.now();
  const remaining = Math.ceil((exp - _now) / 86400000);
  const _expD = new Date(exp);
  const _expDate = String(_expD.getDate()).padStart(2,'0')+'/'+String(_expD.getMonth()+1).padStart(2,'0')+'/'+_expD.getFullYear();
  if (remaining <= 0) {
    el.textContent = '⚠️ Acceso expirado · Venció: ' + _expDate;
    el.style.color = '#ef4444';
  } else if (remaining <= 30) {
    el.textContent = '⚠️ Vence en ' + remaining + ' días (' + _expDate + ') · Código: ' + code;
    el.style.color = '#f59e0b';
  } else {
    el.textContent = '✅ Vence en ' + remaining + ' días (' + _expDate + ') · Código: ' + code;
    el.style.color = '#10b981';
  }
}
