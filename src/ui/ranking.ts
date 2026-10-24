import type { Ranking, ScoreSubmission } from '../leaderboard'
import { readStored, writeStored } from './storage'

const PLAYER_KEY = 'pokebrawl.player'
const NAME_KEY = 'pokebrawl.name'

/** A random id kept in this browser, so that each player holds one line per day without an account. */
export function playerId() {
  const stored = readStored<string | null>(PLAYER_KEY, null)
  if (stored) return stored
  const created = crypto.randomUUID()
  writeStored(PLAYER_KEY, created)
  return created
}

export const savedNickname = () => readStored<string | null>(NAME_KEY, null)
export const saveNickname = (name: string) => writeStored(NAME_KEY, name)

const endpoint = (day: string) => `${import.meta.env.BASE_URL}api/daily/${day}`

/** The ranking of a day, or `null` when the server cannot be reached: the game goes on without it. */
export async function fetchRanking(day: string): Promise<Ranking | null> {
  try {
    const response = await fetch(endpoint(day), { headers: { 'x-player-id': playerId() } })
    return response.ok ? ((await response.json()) as Ranking) : null
  } catch {
    return null
  }
}

export async function submitScore(day: string, name: string, team: string) {
  const body: ScoreSubmission = { playerId: playerId(), name, team }
  try {
    const response = await fetch(endpoint(day), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = (await response.json()) as Ranking | { error: string }
    return 'error' in payload ? { error: payload.error } : { ranking: payload }
  } catch {
    return { error: 'Classement injoignable : ton score est gardé sur cet appareil.' }
  }
}

export const ordinal = (rank: number) => (rank === 1 ? '1er' : `${rank}e`)

/** Lists a ranking; once the day is over, each line can replay its team against that day's horde. */
export function renderRanking(
  list: HTMLElement,
  summary: HTMLElement,
  ranking: Ranking | null,
  onReplay: (team: string) => void,
) {
  if (!ranking) {
    summary.textContent = 'Classement indisponible pour le moment.'
    list.replaceChildren()
    return
  }
  const players = `${ranking.total} joueur${ranking.total > 1 ? 's' : ''}`
  const you = ranking.you ? ` · toi : ${ordinal(ranking.you.rank)} avec ${ranking.you.points} points` : ''
  summary.textContent = ranking.total === 0 ? 'Personne n’a encore battu cette horde.' : `${players}${you}`
  list.replaceChildren(
    ...ranking.entries.map((entry) => {
      const item = document.createElement('li')
      item.className = 'ranking-entry'
      item.append(
        Object.assign(document.createElement('span'), { className: 'ranking-rank', textContent: ordinal(entry.rank) }),
        Object.assign(document.createElement('span'), { className: 'ranking-name', textContent: entry.name }),
        Object.assign(document.createElement('span'), {
          className: 'ranking-points',
          textContent: `${entry.points} pts · ${entry.size} Pokémon`,
        }),
      )
      const { team } = entry
      if (team) {
        const replay = Object.assign(document.createElement('button'), {
          type: 'button',
          className: 'ranking-replay',
          textContent: 'Voir',
          title: `Revoir le combat de ${entry.name}`,
        })
        replay.addEventListener('click', () => onReplay(team))
        item.append(replay)
      }
      return item
    }),
  )
}
