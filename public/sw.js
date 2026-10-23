// Our Shared Lists service worker: offline app shell + cached build assets.
// Supabase (API, auth, realtime) is cross-origin and never touched here.
const SHELL_CACHE = 'osl-shell-v1'
const ASSET_CACHE = 'osl-assets-v1'
const SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png', '/icons/icon-512.png']
const MAX_ASSETS = 60

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  for (const req of keys.slice(0, Math.max(0, keys.length - max))) await cache.delete(req)
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // Pages: network first so deploys show up immediately; cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(SHELL_CACHE).then((cache) => cache.put('/', copy))
          }
          return res
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  // Hashed build assets never change: cache first.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const type = res.headers.get('content-type') || ''
            // Skip the SPA fallback (index.html) served for assets missing after a deploy.
            if (res.ok && !type.includes('text/html')) {
              const copy = res.clone()
              caches
                .open(ASSET_CACHE)
                .then((cache) => cache.put(req, copy))
                .then(() => trim(ASSET_CACHE, MAX_ASSETS))
            }
            return res
          }),
      ),
    )
  }
})
