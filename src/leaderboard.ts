import { pokedex } from './pokedex'
import { MAX_TEAM_SIZE, TEAM_BUDGET, teamCost } from './simulation/cost'
import { selectTeam } from './simulation/teams'

/** What both the browser and the server agree on about the daily ranking. */
export interface RankingEntry {
  rank: number
  name: string
  points: number
  size: number
  /** Only once the day is over: showing it earlier would hand out the answer. */
  team?: string
}

export interface Ranking {
  day: string
  total: number
  entries: RankingEntry[]
  you: { rank: number; points: number } | null
}

export interface ScoreSubmission {
  playerId: string
  name: string
  team: string
}

export const RANKING_SIZE = 20
export const isPlayerId = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)

/** The points and size of a submitted team, or `null` when it breaks the rules (budget, size, unknown Pokémon). */
export function scoreOfTeam(team: unknown) {
  if (typeof team !== 'string' || team.length > 1000 || !team.startsWith('ids:')) return null
  try {
    const { fighters } = selectTeam(pokedex, team)
    const points = teamCost(fighters)
    if (fighters.length === 0 || fighters.length > MAX_TEAM_SIZE || points > TEAM_BUDGET) return null
    return { points, size: fighters.length }
  } catch {
    return null
  }
}
