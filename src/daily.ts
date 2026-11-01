import { createRandom, SEED_LIMIT } from './simulation/random'
import { parseHorde, TEAM_SELECTORS } from './simulation/teams'

// Everyone gets a new challenge at midnight in France, where the players are.
const TIME_ZONE = 'Europe/Paris'
const DAILY_LEVEL = 1000

/** `2026-10-25` for the given moment, in French time. */
export const dayOf = (moment: Date) =>
  new Intl.DateTimeFormat('fr-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    moment,
  )

const CLOCK_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})
const SECONDS_PER_DAY = 24 * 60 * 60

/** How long until the next challenge, at midnight in French time. */
export function secondsUntilNextDay(moment: Date) {
  const [hours, minutes, seconds] = CLOCK_FORMAT.format(moment).split(':').map(Number)
  return SECONDS_PER_DAY - (hours! * 3600 + minutes! * 60 + seconds!)
}

const seedOfDay = (day: string) => Number(day.replaceAll('-', ''))

/**
 * The challenge of the day: a horde and a seed drawn from the date, the same for every player. With the seed fixed,
 * the outcome depends on the team alone, which turns the battle into a puzzle: who beats it with the fewest points?
 */
export function dailyChallenge(day: string) {
  const random = createRandom(seedOfDay(day))
  const pool = TEAM_SELECTORS[random.integer(TEAM_SELECTORS.length)]!
  return { day, pool, horde: `horde:${pool}:${DAILY_LEVEL}:${day}`, seed: random.integer(SEED_LIMIT) }
}

/** `2026-10-25`: a day as the ranking and the daily hordes write it. */
export const isDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)

export const dailyDayOf = (hordeSelector: string) => {
  const variant = parseHorde(hordeSelector)?.variant
  return variant && isDay(variant) ? variant : null
}

export const previousDay = (day: string) => {
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

export interface DailyRecord {
  /** The fewest points that beat each day's horde. */
  bestByDay: Record<string, number>
  streak: number
  lastWonDay: string | null
}

export const EMPTY_DAILY_RECORD: DailyRecord = { bestByDay: {}, streak: 0, lastWonDay: null }

/** A win keeps the best score of its day and lengthens the streak if the day before was won too. */
export function recordDailyWin(record: DailyRecord, day: string, points: number): DailyRecord {
  const best = Math.min(points, record.bestByDay[day] ?? Number.POSITIVE_INFINITY)
  const streak =
    record.lastWonDay === day ? record.streak : record.lastWonDay === previousDay(day) ? record.streak + 1 : 1
  return { bestByDay: { ...record.bestByDay, [day]: best }, streak, lastWonDay: day }
}

/** The streak still alive today: won today, or yesterday and today is yet to be played. */
export const currentStreak = (record: DailyRecord, today: string) =>
  record.lastWonDay === today || record.lastWonDay === previousDay(today) ? record.streak : 0

const GRID_WIDTH = 10
const GRID_CELLS = 50

/**
 * The team after a daily win, as Wordle shares its guesses: a green square per Pokémon still standing, a black one
 * per Pokémon knocked out, survivors first. It tells how the battle went without giving away the team, which the
 * ranking hides until the day is over. Past 50 Pokémon, each square stands for a share of the team.
 */
export function survivorGrid(alive: boolean[]) {
  const standing = alive.filter(Boolean).length
  const cells = Math.min(alive.length, GRID_CELLS)
  const greens = alive.length > GRID_CELLS ? Math.round((standing / alive.length) * cells) : standing
  const squares = Array.from({ length: cells }, (_, index) => (index < greens ? '🟩' : '⬛'))
  return Array.from({ length: Math.ceil(cells / GRID_WIDTH) }, (_, row) =>
    squares.slice(row * GRID_WIDTH, (row + 1) * GRID_WIDTH).join(''),
  ).join('\n')
}
