const CACHE = 'gestor-cgs-v661';
const FILES = ['./index.html', './manifest.json', './js/core.js', './js/drive-sync.js', './js/sheets-sync.js', './js/drag-drop.js', './js/productos.js', './js/bonificaciones.js', './js/buscador-global.js', './js/bloqueo-app.js', './js/clientes.js', './js/negocio.js', './js/pedidos.js', './js/configuracion.js', './js/rutas.js', './GP_activ.png', './GP_spalsh.png', './favicon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => { e.respondWith(fetch(e.request).catch(() => caches.match(e.request))); });
