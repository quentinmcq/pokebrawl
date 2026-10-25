import { execFileSync } from 'node:child_process'
import { parseArgs } from 'node:util'
import { dailyChallenge, dayOf } from '../src/daily'
import { isDay } from '../src/leaderboard'
import { pokedex } from '../src/pokedex'
import { runBattle } from '../src/simulation/battle'
import { selectTeam } from '../src/simulation/teams'

/*
 * The free Worker cannot replay battles, so this replays a day's ranking here: every team that does not actually beat
 * that day's horde, or no longer fits the rules, is listed, and removed with --apply.
 */
const { values: options } = parseArgs({
  options: {
    day: { type: 'string', default: dayOf(new Date()) },
    apply: { type: 'boolean', default: false },
    local: { type: 'boolean', default: false },
  },
})
// « yesterday » is what the nightly job checks: the last complete day, in French time.
const yesterday = () => {
  const date = new Date(`${dayOf(new Date())}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}
const day = options.day === 'yesterday' ? yesterday() : options.day === 'today' ? dayOf(new Date()) : options.day
if (!isDay(day)) throw new Error(`Jour invalide : ${day} (format 2026-10-25, today ou yesterday)`)
const target = options.local ? '--local' : '--remote'

function query<Row>(sql: string): Row[] {
  const output = execFileSync('bunx', ['wrangler', 'd1', 'execute', 'pokebrawl', target, '--json', '--command', sql], {
    encoding: 'utf8',
  })
  return (JSON.parse(output) as { results: Row[] }[])[0]?.results ?? []
}

const { seed } = dailyChallenge(day)
// The day was checked against a strict pattern above, so it is safe inside the query.
const scores = query<{ player_hash: string; name: string; points: number; team: string; horde: string | null }>(
  `SELECT player_hash, name, points, team, horde FROM daily_scores WHERE day = '${day}' ORDER BY points`,
)

/*
 * Each score is replayed against the horde the server drew when it arrived: hordes follow the prices, which may have
 * changed since, and so may the points of the team. Scores sent before hordes were stored cannot be checked fairly
 * and are left alone.
 */
const uncheckable = scores.filter(({ horde }) => horde === null)
const cheats = scores.filter(({ team, horde }) => {
  if (horde === null) return false
  try {
    const { result } = runBattle({ teams: [selectTeam(pokedex, team), selectTeam(pokedex, horde)], seed })
    return result.outcome !== 0
  } catch {
    return true
  }
})

console.info(
  `${day} : ${scores.length} scores, ${cheats.length} invalides${uncheckable.length > 0 ? `, ${uncheckable.length} non vérifiables (envoyés avant l’enregistrement des hordes)` : ''}`,
)
for (const { name, points, team } of cheats) console.info(`  ${name} — ${points} points — ${team}`)
if (cheats.length > 0 && options.apply) {
  const hashes = cheats.map(({ player_hash }) => `'${player_hash.replaceAll(/[^0-9a-f]/g, '')}'`).join(',')
  query(`DELETE FROM daily_scores WHERE day = '${day}' AND player_hash IN (${hashes})`)
  console.info(`${cheats.length} scores supprimés.`)
} else if (cheats.length > 0) console.info('Relance avec --apply pour les supprimer.')
