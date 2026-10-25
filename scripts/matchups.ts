import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { MATCHUPS } from '../src/matchups'
import { pokedex } from '../src/pokedex'
import { isAlive, runBattle, type TeamSetup } from '../src/simulation/battle'
import { selectTeam, trimToSameSize } from '../src/simulation/teams'

/*
 * Simulates every matchup page's battles once, offline, and keeps the results in src/data/matchups.json, which the
 * pages are built from. Battles are played as in the app, with as many Pokémon on each side; the work is split
 * across processes, one per core.
 */
const { values: options } = parseArgs({
  options: {
    runs: { type: 'string', default: '200' },
    shard: { type: 'string' },
    shards: { type: 'string', default: String(Math.max(1, availableParallelism() - 1)) },
  },
})
const RUNS = Number(options.runs)
const SHARDS = Number(options.shards)
const CACHE_DIR = join(import.meta.dirname, '..', '.cache', 'matchups')
const OUTPUT = join(import.meta.dirname, '..', 'src', 'data', 'matchups.json')
const TOP_POKEMON = 8

export interface MatchupResult {
  slug: string
  runs: number
  /** Pokémon on each side, the same for both. */
  size: number
  wins: [number, number, number]
  averageSeconds: number
  averageSurvivors: number
  /** The Pokémon with the most knock-outs per battle, on either side. */
  top: { id: number; team: 0 | 1; knockOuts: number }[]
  /** A battle the usual winner wins, to watch from the page. */
  exampleSeed: number
}

function simulate(index: number): MatchupResult {
  const { slug, teams } = MATCHUPS[index]!
  const selected: [TeamSetup, TeamSetup] = [selectTeam(pokedex, teams[0]), selectTeam(pokedex, teams[1])]
  const wins: [number, number, number] = [0, 0, 0]
  const knockOuts = new Map<string, number>()
  const winners: number[] = []
  let seconds = 0
  let survivors = 0
  let size = 0
  for (let seed = 1; seed <= RUNS; seed++) {
    const trimmed = trimToSameSize(selected, seed)
    size = trimmed[0].fighters.length
    const { battle, result } = runBattle({ teams: trimmed, seed })
    wins[result.outcome === 'draw' ? 2 : result.outcome]++
    winners.push(result.outcome === 'draw' ? 2 : result.outcome)
    seconds += result.durationSeconds
    survivors += battle.fighters.filter(isAlive).length
    for (const fighter of battle.fighters) {
      const key = `${fighter.team}:${fighter.species.id}`
      knockOuts.set(key, (knockOuts.get(key) ?? 0) + fighter.knockOuts)
    }
  }
  const usualWinner = wins[0] >= wins[1] ? 0 : 1
  const top = [...knockOuts]
    .toSorted(([, a], [, b]) => b - a)
    .slice(0, TOP_POKEMON)
    .map(([key, total]) => {
      const [team, id] = key.split(':').map(Number)
      return { id: id!, team: team as 0 | 1, knockOuts: Math.round((total / RUNS) * 100) / 100 }
    })
  return {
    slug,
    runs: RUNS,
    size,
    wins,
    averageSeconds: Math.round(seconds / RUNS),
    averageSurvivors: Math.round(survivors / RUNS),
    top,
    exampleSeed: winners.indexOf(usualWinner) + 1,
  }
}

if (options.shard !== undefined) {
  const shard = Number(options.shard)
  const results = MATCHUPS.map((_, index) => index)
    .filter((index) => index % SHARDS === shard)
    .map(simulate)
  mkdirSync(CACHE_DIR, { recursive: true })
  writeFileSync(join(CACHE_DIR, `${shard}.json`), JSON.stringify(results))
} else {
  const started = performance.now()
  const workers = Array.from({ length: SHARDS }, (_, shard) =>
    Bun.spawn(['bun', import.meta.path, '--shard', String(shard), '--shards', String(SHARDS), '--runs', String(RUNS)], {
      stdout: 'inherit',
      stderr: 'inherit',
    }),
  )
  const codes = await Promise.all(workers.map((worker) => worker.exited))
  if (codes.some((code) => code !== 0)) throw new Error('Une partie des simulations a échoué')
  const results = Array.from(
    { length: SHARDS },
    (_, shard) => JSON.parse(readFileSync(join(CACHE_DIR, `${shard}.json`), 'utf8')) as MatchupResult[],
  ).flat()
  const bySlug = Object.fromEntries(results.map((result) => [result.slug, result]))
  writeFileSync(OUTPUT, `${JSON.stringify(MATCHUPS.map(({ slug }) => bySlug[slug]))}\n`)
  const minutes = ((performance.now() - started) / 60_000).toFixed(1)
  console.info(`OK : ${results.length} affiches, ${RUNS} combats chacune, en ${minutes} min sur ${SHARDS} processus`)
}
