/* =========================================================================
   MiFitApp · Service Worker
   IMPORTANTE: cada vez que publiques cambios, incrementa VERSION
   (y APP_VERSION en js/app.js). Así los teléfonos descargan la nueva versión
   y la app muestra el aviso "Nueva versión disponible".
   ========================================================================= */
const VERSION = '1.6.0';
const CACHE = `mifit-v${VERSION}`;   // prefijo nuevo; el activate también limpia los cachés antiguos «mifitapp-»
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/ejercicios.js',
  './js/avatar.js',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png'
];

self.addEventListener('install', (e) => {
  // cache: 'reload' salta la caché HTTP del navegador (GitHub Pages usa max-age=600). Sin esto,
  // la versión nueva podía precachearse con archivos VIEJOS y "actualizarse" sin cambiar nada.
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(ASSETS.map((u) =>
        fetch(new Request(u, { cache: 'reload' })).then((r) => {
          if (!r.ok) throw new Error('No se pudo descargar ' + u);
          return c.put(u, r);
        })
      ))
    )
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => (k.startsWith('mifitapp-') || k.startsWith('mifit-v')) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Gemini y otros: directo a la red

  // Navegación: responde con la app en caché (offline-first)
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.match('./index.html').then((cached) => cached || fetch(req).catch(() => caches.match('./')))
    );
    return;
  }

  // Recursos estáticos: cache-first con respaldo en red
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
