import { parseArgs } from 'node:util'
import { dailyChallenge, dayOf, isDay, previousDay } from '../src/daily'
import { pokedex } from '../src/pokedex'
import { runBattle } from '../src/simulation/battle'
import { selectTeam } from '../src/simulation/teams'
import { queryD1 } from './d1'

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
const yesterday = () => previousDay(dayOf(new Date()))
const day = options.day === 'yesterday' ? yesterday() : options.day === 'today' ? dayOf(new Date()) : options.day
if (!isDay(day)) throw new Error(`Jour invalide : ${day} (format 2026-10-25, today ou yesterday)`)

const query = <Row>(sql: string) => queryD1<Row>(sql, { local: options.local })

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
// A horde the server stored is always valid; should one ever fail to read, its scores are not the players' fault.
const hordeOf = (selector: string | null) => {
  try {
    return selector === null ? null : selectTeam(pokedex, selector)
  } catch {
    return null
  }
}
const uncheckable = scores.filter(({ horde }) => hordeOf(horde) === null)
const cheats = scores.filter(({ team, horde: selector }) => {
  const horde = hordeOf(selector)
  if (horde === null) return false
  // A team that breaks the rules does not even reach the battle.
  try {
    return runBattle({ teams: [selectTeam(pokedex, team), horde], seed }).result.outcome !== 0
  } catch {
    return true
  }
})

console.info(
  `${day} : ${scores.length} scores, ${cheats.length} invalides${uncheckable.length > 0 ? `, ${uncheckable.length} non vérifiables (horde absente ou illisible)` : ''}`,
)
for (const { name, points, team } of cheats) console.info(`  ${name} — ${points} points — ${team}`)
if (cheats.length > 0 && options.apply) {
  const hashes = cheats.map(({ player_hash }) => `'${player_hash.replaceAll(/[^0-9a-f]/g, '')}'`).join(',')
  query(`DELETE FROM daily_scores WHERE day = '${day}' AND player_hash IN (${hashes})`)
  console.info(`${cheats.length} scores supprimés.`)
} else if (cheats.length > 0) console.info('Relance avec --apply pour les supprimer.')
