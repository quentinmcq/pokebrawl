import { SITE_URL } from '../site'
import { arrivalOf, type TrackedEvent } from '../tracking'

const VISIT_SESSION_KEY = 'pokebrawl.visit-counted'
// Crawlers and audit tools run the page's scripts too: they must not be counted.
const AUTOMATED_BROWSER = /bot|crawl|spider|slurp|lighthouse|headlesschrome|pagespeed/i

// Only the real site counts, never local development or a preview.
const isCounted = () => location.host === new URL(SITE_URL).host && !AUTOMATED_BROWSER.test(navigator.userAgent)

/** Adds one to today's count of an event; best effort, never in the way of the game. */
export function track(name: TrackedEvent) {
  if (!isCounted()) return
  navigator.sendBeacon?.(
    `${import.meta.env.BASE_URL}api/events`,
    new Blob([JSON.stringify({ name })], { type: 'application/json' }),
  )
}

/** Counts the visit and where it came from, once per browser session. */
export function trackVisit() {
  try {
    if (sessionStorage.getItem(VISIT_SESSION_KEY)) return
    sessionStorage.setItem(VISIT_SESSION_KEY, '1')
  } catch {
    // Without session storage, each load counts as a visit.
  }
  track('visit')
  track(arrivalOf({ search: location.search, hash: location.hash, referrer: document.referrer, host: location.host }))
}
