// What the browser keeps between visits; the composer and the achievements read the same entries.
export const STORAGE_KEYS = {
  team: 'pokebrawl.team',
  challenge: 'pokebrawl.challenge',
  wins: 'pokebrawl.wins',
  daily: 'pokebrawl.daily',
  friend: 'pokebrawl.friend',
  collection: 'pokebrawl.collection',
  achievements: 'pokebrawl.achievements',
  achievementStats: 'pokebrawl.achievement-stats',
}

// Per-browser conveniences only (the last team, beaten hordes): storage can be missing or full, and the app still works.
export function readStored<Value>(key: string, fallback: Value): Value {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as Value)
  } catch {
    return fallback
  }
}

export function writeStored(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Private browsing or a full storage: the choice simply won't be remembered.
  }
}
