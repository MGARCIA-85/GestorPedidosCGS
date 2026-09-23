// ═══════════════════════════════════════════════════════
//  DRAG & DROP PARA REORDENAR
// ═══════════════════════════════════════════════════════
// container: elemento que contiene los ítems arrastrables (deben ser hijos directos)
// target: 'products' (compatibilidad con el uso original) o una función callback(container)
//         que se ejecuta al soltar, para guardar el nuevo orden donde corresponda.
// itemClass: clase CSS de los ítems arrastrables dentro de este container (por defecto 'sortable-item').
//            Permite tener varios niveles de arrastre anidados sin que se mezclen entre sí.
function setupDrag(container, target, itemClass) {
itemClass = itemClass || 'sortable-item';
const sel = '.' + itemClass;
let dragged = null;
const onDone = (c) => {
if (typeof target === 'function') target(c);
else saveOrder(c, target);
};
container.querySelectorAll(sel).forEach(item => {
const handle = item.querySelector('.drag-handle'); if (!handle) return;
handle.addEventListener('touchstart', e => {
dragged = item; item.classList.add('dragging'); e.preventDefault();
}, { passive:false });
handle.addEventListener('touchmove', e => {
if (!dragged) return; e.preventDefault();
const touch = e.touches[0];
const el = document.elementFromPoint(touch.clientX, touch.clientY)?.closest(sel);
if (el && el!==dragged && el.parentElement===dragged.parentElement) {
const mid = el.getBoundingClientRect().top + el.getBoundingClientRect().height/2;
touch.clientY < mid ? container.insertBefore(dragged,el) : container.insertBefore(dragged,el.nextSibling);
}
}, { passive:false });
handle.addEventListener('touchend', () => {
if (!dragged) return; dragged.classList.remove('dragging'); onDone(container); dragged=null;
});
handle.addEventListener('mousedown', e => {
dragged = item; item.classList.add('dragging'); e.preventDefault();
});
});
container.addEventListener('mousemove', e => {
if (!dragged) return;
const el = document.elementFromPoint(e.clientX,e.clientY)?.closest(sel);
if (el && el!==dragged && el.parentElement===dragged.parentElement) {
e.clientY < el.getBoundingClientRect().top+el.getBoundingClientRect().height/2
? container.insertBefore(dragged,el) : container.insertBefore(dragged,el.nextSibling);
}
});
container.addEventListener('mouseup', () => {
if (!dragged) return; dragged.classList.remove('dragging'); onDone(container); dragged=null;
});
}

function saveOrder(container, type) {
const ids = [...container.querySelectorAll('.sortable-item')].map(el => Number(el.dataset.id));
if (type === 'products') { S.products.sort((a,b) => ids.indexOf(Number(a.id))-ids.indexOf(Number(b.id))); }
save();
}
