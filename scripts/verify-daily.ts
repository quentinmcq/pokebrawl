import { execFileSync } from 'node:child_process'
import { parseArgs } from 'node:util'
import { dailyChallenge, dayOf } from '../src/daily'
import { isDay, scoreOfTeam } from '../src/leaderboard'
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
const day = options.day
if (!isDay(day)) throw new Error(`Jour invalide : ${day} (format 2026-10-25)`)
const target = options.local ? '--local' : '--remote'

function query<Row>(sql: string): Row[] {
  const output = execFileSync('bunx', ['wrangler', 'd1', 'execute', 'pokebrawl', target, '--json', '--command', sql], {
    encoding: 'utf8',
  })
  return (JSON.parse(output) as { results: Row[] }[])[0]?.results ?? []
}

const { horde, seed } = dailyChallenge(day)
// The day was checked against a strict pattern above, so it is safe inside the query.
const scores = query<{ player_hash: string; name: string; points: number; team: string }>(
  `SELECT player_hash, name, points, team FROM daily_scores WHERE day = '${day}' ORDER BY points`,
)
const cheats = scores.filter(({ team, points }) => {
  const score = scoreOfTeam(team)
  if (!score || score.points !== points) return true
  const { result } = runBattle({ teams: [selectTeam(pokedex, team), selectTeam(pokedex, horde)], seed })
  return result.outcome !== 0
})

console.info(`${day} : ${scores.length} scores, ${cheats.length} invalides`)
for (const { name, points, team } of cheats) console.info(`  ${name} — ${points} points — ${team}`)
if (cheats.length > 0 && options.apply) {
  const hashes = cheats.map(({ player_hash }) => `'${player_hash.replaceAll(/[^0-9a-f]/g, '')}'`).join(',')
  query(`DELETE FROM daily_scores WHERE day = '${day}' AND player_hash IN (${hashes})`)
  console.info(`${cheats.length} scores supprimés.`)
} else if (cheats.length > 0) console.info('Relance avec --apply pour les supprimer.')
