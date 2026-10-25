import type { Ranking, ScoreSubmission } from '../leaderboard'
import type { ServerError } from '../messages'
import { TEXT } from './i18n'
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
    const payload = (await response.json()) as Ranking | ServerFailure
    return 'error' in payload ? { error: errorText(payload) } : { ranking: payload }
  } catch {
    return { error: TEXT.rankingUnreachable }
  }
}

/** What the server says when it refuses a score: a code, and the French text older versions of the app show. */
interface ServerFailure {
  error: string
  code?: { server: ServerError } | { nickname: keyof typeof TEXT.nicknameErrors }
}

const errorText = ({ error, code }: ServerFailure) =>
  !code ? error : 'server' in code ? TEXT.serverErrors[code.server] : TEXT.nicknameErrors[code.nickname]

/** Lists a ranking; once the day is over, each line can replay its team against that day's horde. */
export function renderRanking(
  list: HTMLElement,
  summary: HTMLElement,
  ranking: Ranking | null,
  onReplay: (team: string) => void,
) {
  if (!ranking) {
    summary.textContent = TEXT.rankingUnavailable
    list.replaceChildren()
    return
  }
  summary.textContent = ranking.total === 0 ? TEXT.rankingEmpty : TEXT.rankingSummary(ranking.total, ranking.you)
  list.replaceChildren(
    ...ranking.entries.map((entry) => {
      const item = document.createElement('li')
      item.className = 'ranking-entry'
      item.append(
        Object.assign(document.createElement('span'), {
          className: 'ranking-rank',
          textContent: TEXT.ordinal(entry.rank),
        }),
        Object.assign(document.createElement('span'), { className: 'ranking-name', textContent: entry.name }),
        Object.assign(document.createElement('span'), {
          className: 'ranking-points',
          textContent: TEXT.rankingEntry(entry.points, entry.size),
        }),
      )
      const { team } = entry
      if (team) {
        const replay = Object.assign(document.createElement('button'), {
          type: 'button',
          className: 'ranking-replay',
          textContent: TEXT.watch,
          title: TEXT.watchBattleOf(entry.name),
        })
        replay.addEventListener('click', () => onReplay(team))
        item.append(replay)
      }
      return item
    }),
  )
}
