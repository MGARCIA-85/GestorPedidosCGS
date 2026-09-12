// Planificador CGS - Service Worker
// Sube este número cada vez que publiques cambios para forzar actualización
const CACHE_VERSION = 'v33';
const CACHE_NAME = 'planificador-cgs-' + CACHE_VERSION;

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        ASSETS.map((url) =>
          fetch(url, { cache: 'reload' }).then((res) => cache.put(url, res))
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // La librería de Excel (CDN) siempre se busca en red primero, con caída a caché
  if (req.url.includes('cdnjs.cloudflare.com')) {
    event.respondWith(
      fetch(req).then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Archivos propios de la app: caché primero, red como respaldo
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
