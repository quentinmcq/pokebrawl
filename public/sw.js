// Serves the app from a cache so that it opens offline once installed, and refreshes that cache in the background.
const CACHE_NAME = 'pokebrawl-v1'
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
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return
  // Every battle link (?a=…&b=…) opens the same page, cached once under « / ».
  const cacheKey = request.mode === 'navigate' ? '/' : request
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
