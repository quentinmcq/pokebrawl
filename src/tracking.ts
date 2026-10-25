import { COLLECTION_HASH_KEY } from './collection'
import { MATCHUPS_PATHS } from './locale'

/**
 * What PokéBrawl counts, per day and nothing more: no visitor is identified, only totals are kept. The server
 * refuses any other name, so that the counters stay a short, readable list.
 */
export const TRACKED_EVENTS = [
  // Once per browser session, with where the visitor came from.
  'visit',
  'arrival-pokedate',
  'arrival-friend',
  'arrival-matchup-page',
  'arrival-search',
  'arrival-other-site',
  'arrival-direct',
  // A « qui gagne ? » page read.
  'matchup-page',
  // Battles started, by mode, and challenges won.
  'battle-daily',
  'battle-training',
  'battle-friend',
  'battle-watch',
  'win-daily',
  'win-training',
  'win-friend',
  // What spreads the game: shares, challenges sent, scores published, installs, videos.
  'share-daily',
  'share-challenge',
  'share-back',
  'publish',
  'install',
  'video',
] as const

export type TrackedEvent = (typeof TRACKED_EVENTS)[number]

export const isTrackedEvent = (value: unknown): value is TrackedEvent =>
  typeof value === 'string' && (TRACKED_EVENTS as readonly string[]).includes(value)

const SEARCH_ENGINES = /(^|\.)(google|bing|duckduckgo|qwant|ecosia|yahoo|startpage|brave)\./

/** Where a visit came from, from what the page knows on arrival. */
export function arrivalOf({
  search,
  hash,
  referrer,
  host,
}: {
  search: string
  hash: string
  referrer: string
  host: string
}): TrackedEvent {
  const query = new URLSearchParams(search)
  if (query.has('equipe') || hash.includes(`${COLLECTION_HASH_KEY}=`)) return 'arrival-pokedate'
  if (query.has('defi')) return 'arrival-friend'
  if (!referrer) return 'arrival-direct'
  let from: URL
  try {
    from = new URL(referrer)
  } catch {
    return 'arrival-direct'
  }
  if (from.host === host)
    return Object.values(MATCHUPS_PATHS).some((path) => from.pathname.startsWith(path))
      ? 'arrival-matchup-page'
      : 'arrival-direct'
  if (from.host.endsWith('pokedate.fr')) return 'arrival-pokedate'
  if (SEARCH_ENGINES.test(from.host)) return 'arrival-search'
  return 'arrival-other-site'
}
