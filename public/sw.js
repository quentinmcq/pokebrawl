// Serves the app from a cache so that it opens offline once installed, and refreshes that cache in the background.
// A new name empties the older caches on activation: v1 could keep a « qui gagne ? » page as the app's home.
const CACHE_NAME = 'pokebrawl-v2'
const APP_SHELL = ['/', '/manifest.webmanifest', '/sprites.json', '/sprites.webp']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  // The ranking and the counters must always reach the server, never come from a cache.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return
  // Every link into the app (?a=…, ?defi=…) opens the same page, cached once under « / »; the « qui gagne ? »
  // pages are pages of their own, each under its address.
  const cacheKey = request.mode !== 'navigate' ? request : url.pathname === '/' ? '/' : url.pathname
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(cacheKey)
      const fresh = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(cacheKey, response.clone())
          return response
        })
        .catch(() => cached)
      return cached ?? fresh
    }),
  )
})
