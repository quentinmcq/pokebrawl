// The public address, for canonical links, the sitemap and the audience counters.
export const SITE_URL = 'https://pokebrawl.fr'

// The site's other addresses send each page to pokebrawl.fr, the same path and query kept. The API and the service
// worker still answer on them, for the apps installed before the move.
const HOSTS_REDIRECTED_TO_SITE = new Set(['www.pokebrawl.fr', 'pokebrawl.quentin-macq.workers.dev'])
const STILL_SERVED_EVERYWHERE = (pathname: string) => pathname.startsWith('/api/') || pathname === '/sw.js'

/** Where a request to one of the site's other addresses goes, or `null` when it is answered where it is. */
export function canonicalRedirect(url: URL) {
  if (!HOSTS_REDIRECTED_TO_SITE.has(url.host) || STILL_SERVED_EVERYWHERE(url.pathname)) return null
  return new URL(url.pathname + url.search, SITE_URL).href
}
