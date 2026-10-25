// Serves the app from a cache so that it opens offline once installed, and refreshes that cache in the background.
// A new name empties the older caches on activation: v1 could keep a « qui gagne ? » page as the app's home, v2 a
// friend's challenge.
const CACHE_NAME = 'pokebrawl-v3'
const APP_SHELL = ['/', '/en/', '/manifest.webmanifest', '/manifest-en.webmanifest', '/sprites.json', '/sprites.webp']

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
  // Every link into the app (?a=…, ?defi=…) opens the same page, cached under its path (« / » or « /en/ »); the
  // « qui gagne ? » pages are pages of their own, each under its address.
  const navigation = request.mode === 'navigate'
  const cacheKey = navigation ? url.pathname : request
  // The server writes a friend's challenge into the page it sends for « ?defi=… »: only a plain address is kept.
  // A redirected answer is never kept: when the site moves to its own domain, the old address redirects every page.
  const keeps = (response) => response.ok && !response.redirected && (!navigation || url.search === '')
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(cacheKey)
      const fresh = fetch(request)
        .then((response) => {
          if (response.redirected && new URL(response.url).origin !== self.location.origin) {
            // The site has moved: this old copy is dropped, and the next visit follows the move.
            void caches.delete(CACHE_NAME)
            return navigation ? Response.redirect(response.url, 301) : response
          }
          if (keeps(response)) cache.put(cacheKey, response.clone())
          return response
        })
        .catch(() => cached)
      return cached ?? fresh
    }),
  )
})
