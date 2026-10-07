// Service worker: la app abre y funciona sin internet.
// HTML: primero la red (para recibir versiones nuevas), si no hay, la copia guardada.
// Archivos con hash (assets/): primero la copia guardada, porque nunca cambian.
const CACHE = 'plata-v1'
const SHELL = ['./', './index.html', './manifest.webmanifest', './apple-touch-icon.png', './icon-192.png', './icon-512.png']
const MAX_ASSETS = 80

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

async function trim(cache) {
  const keys = await cache.keys()
  const assets = keys.filter((r) => r.url.includes('/assets/'))
  for (const r of assets.slice(0, Math.max(0, assets.length - MAX_ASSETS))) await cache.delete(r)
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('./index.html', copy))
          return res
        })
        .catch(() => caches.match('./index.html')),
    )
    return
  }

  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && url.pathname.includes('/assets/')) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy).then(() => trim(c)))
          }
          return res
        }),
    ),
  )
})
