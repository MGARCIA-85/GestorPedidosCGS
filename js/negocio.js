// ═══════════════════════════════════════════════════════
//  INFORMACIÓN DEL NEGOCIO
// ═══════════════════════════════════════════════════════
function loadBizForm() {
const b = S.biz;
document.getElementById('biz-emoji').value  = b.emoji  || '📦';
document.getElementById('biz-name').value   = b.name   || '';
document.getElementById('biz-sub').value    = b.sub    || '';
const execEl = document.getElementById('biz-exec'); if (execEl) execEl.value = b.exec || '';
document.getElementById('biz-phone').value  = b.phone  || '';
document.getElementById('biz-addr').value   = b.addr   || '';
document.getElementById('biz-email').value  = b.email  || '';
document.getElementById('biz-footer').value = b.footer || '';
refreshLogoPreview();
}

function onLogoFile(e) {
const f = e.target.files[0]; if (!f) return;
const r = new FileReader();
r.onload = ev => { S.biz.logoData = ev.target.result; refreshLogoPreview(); };
r.readAsDataURL(f);
}

function clearLogo() { S.biz.logoData = ''; refreshLogoPreview(); }

function refreshLogoPreview() {
const emoji = document.getElementById('biz-emoji')?.value || S.biz.emoji || '📦';
const name  = document.getElementById('biz-name')?.value  || S.biz.name  || 'GestorPedidos GT';
const sub   = document.getElementById('biz-sub')?.value   || S.biz.sub   || 'Pedidos · Clientes · Precios';
const hasLogo = !!S.biz.logoData;
// Header
const hEm = document.getElementById('biz-logo-emoji');
const hIm = document.getElementById('biz-logo-img');
if (hasLogo) {
hEm.style.display = 'none'; hIm.style.display = 'block'; hIm.src = S.biz.logoData;
} else {
hEm.style.display = ''; hIm.style.display = 'none'; hEm.textContent = emoji;
}
// Preview en form
const lpEm = document.getElementById('lp-emoji');
const lpIm = document.getElementById('lp-img');
if (lpEm && lpIm) {
if (hasLogo) { lpEm.style.display='none'; lpIm.style.display='block'; lpIm.src=S.biz.logoData; }
else         { lpEm.style.display=''; lpIm.style.display='none'; lpEm.textContent=emoji; }
}
document.getElementById('hdr-name').textContent = name;
document.getElementById('hdr-sub').textContent  = sub;
}

function saveBizInfo() {
S.biz.emoji  = document.getElementById('biz-emoji').value.trim() || '📦';
S.biz.name   = document.getElementById('biz-name').value.trim()  || 'Mi Negocio';
S.biz.sub    = document.getElementById('biz-sub').value.trim();
S.biz.exec   = document.getElementById('biz-exec')?.value.trim() || '';
S.biz.phone  = document.getElementById('biz-phone').value.trim();
S.biz.addr   = document.getElementById('biz-addr').value.trim();
S.biz.email  = document.getElementById('biz-email').value.trim();
S.biz.footer = document.getElementById('biz-footer').value.trim();
save(); refreshLogoPreview(); toast('✔ Información del negocio guardada');
}

document.addEventListener('input', e => {
if (['biz-emoji','biz-name','biz-sub'].includes(e.target.id)) refreshLogoPreview();
});
