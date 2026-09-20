// ═══════════════════════════════════════════════════════
//  DRAG & DROP PARA REORDENAR
// ═══════════════════════════════════════════════════════
function setupDrag(container, type) {
let dragged = null;
container.querySelectorAll('.sortable-item').forEach(item => {
const handle = item.querySelector('.drag-handle'); if (!handle) return;
handle.addEventListener('touchstart', e => {
dragged = item; item.classList.add('dragging'); e.preventDefault();
}, { passive:false });
handle.addEventListener('touchmove', e => {
if (!dragged) return; e.preventDefault();
const touch = e.touches[0];
const el = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.sortable-item');
if (el && el!==dragged) {
const mid = el.getBoundingClientRect().top + el.getBoundingClientRect().height/2;
touch.clientY < mid ? container.insertBefore(dragged,el) : container.insertBefore(dragged,el.nextSibling);
}
}, { passive:false });
handle.addEventListener('touchend', () => {
if (!dragged) return; dragged.classList.remove('dragging'); saveOrder(container,type); dragged=null;
});
handle.addEventListener('mousedown', e => {
dragged = item; item.classList.add('dragging'); e.preventDefault();
});
});
container.addEventListener('mousemove', e => {
if (!dragged) return;
const el = document.elementFromPoint(e.clientX,e.clientY)?.closest('.sortable-item');
if (el && el!==dragged) {
e.clientY < el.getBoundingClientRect().top+el.getBoundingClientRect().height/2
? container.insertBefore(dragged,el) : container.insertBefore(dragged,el.nextSibling);
}
});
container.addEventListener('mouseup', () => {
if (!dragged) return; dragged.classList.remove('dragging'); saveOrder(container,type); dragged=null;
});
}

function saveOrder(container, type) {
const ids = [...container.querySelectorAll('.sortable-item')].map(el => Number(el.dataset.id));
if (type==='clients') S.clients.sort((a,b) => ids.indexOf(Number(a.id))-ids.indexOf(Number(b.id)));
else                  S.products.sort((a,b) => ids.indexOf(Number(a.id))-ids.indexOf(Number(b.id)));
save();
}
