import { createRandom } from './simulation/random'
import { parseHorde, TEAM_SELECTORS } from './simulation/teams'

// Everyone gets a new challenge at midnight in France, where the players are.
const TIME_ZONE = 'Europe/Paris'
export const DAILY_LEVEL = 1000
const MAX_SEED = 1_000_000

/** `2026-10-25` for the given moment, in French time. */
export const dayOf = (moment: Date) =>
  new Intl.DateTimeFormat('fr-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    moment,
  )

const seedOfDay = (day: string) => Number(day.replaceAll('-', ''))

/**
 * The challenge of the day: a horde and a seed drawn from the date, the same for every player. With the seed fixed,
 * the outcome depends on the team alone, which turns the battle into a puzzle: who beats it with the fewest points?
 */
export function dailyChallenge(day: string) {
  const random = createRandom(seedOfDay(day))
  const pool = TEAM_SELECTORS[random.integer(TEAM_SELECTORS.length)]!
  return { day, pool, horde: `horde:${pool}:${DAILY_LEVEL}:${day}`, seed: random.integer(MAX_SEED) }
}

export const dailyDayOf = (hordeSelector: string) => {
  const variant = parseHorde(hordeSelector)?.variant
  return variant && /^\d{4}-\d{2}-\d{2}$/.test(variant) ? variant : null
}

const previousDay = (day: string) => {
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
