import { parseArgs } from 'node:util'
import { pokedex } from '../src/pokedex'
import { runBattle, type TeamSetup } from '../src/simulation/battle'
import { selectTeam, trimToSameSize } from '../src/simulation/teams'

const { values: options } = parseArgs({
  options: {
    a: { type: 'string', default: 'gen1' },
    b: { type: 'string', default: 'gen3' },
    same: { type: 'boolean', default: false },
    runs: { type: 'string', default: '100' },
    'first-seed': { type: 'string', default: '1' },
  },
})

const runs = Number(options.runs)
const firstSeed = Number(options['first-seed'])
const teams = [selectTeam(pokedex, options.a), selectTeam(pokedex, options.b)] as [TeamSetup, TeamSetup]
const TOP_SPECIES_SHOWN = 10

const wins = { 0: 0, 1: 0, draw: 0 }
let totalSeconds = 0
const knockOutsBySpecies = new Map<string, number>()
const startedAt = performance.now()

for (let run = 0; run < runs; run++) {
  const seed = firstSeed + run
  const { battle, result } = runBattle({ teams: options.same ? trimToSameSize(teams, seed) : teams, seed })
  wins[result.outcome]++
  totalSeconds += result.durationSeconds
  for (const fighter of battle.fighters) {
    const name = `${fighter.species.names.fr} (${battle.teamLabels[fighter.team]})`
    knockOutsBySpecies.set(name, (knockOutsBySpecies.get(name) ?? 0) + fighter.knockOuts)
  }
}

const percent = (count: number) => `${((100 * count) / runs).toFixed(1)} %`
console.info(
  `\n${teams[0].label} contre ${teams[1].label}, ${runs} combats (graines ${firstSeed} à ${firstSeed + runs - 1})\n`,
)
console.info(`  ${teams[0].label} : ${percent(wins[0])}`)
console.info(`  ${teams[1].label} : ${percent(wins[1])}`)
if (wins.draw > 0) console.info(`  Nuls : ${percent(wins.draw)}`)
console.info(`  Durée moyenne : ${(totalSeconds / runs).toFixed(0)} s`)

console.info('\nK.O. moyens par combat :')
;[...knockOutsBySpecies]
  .toSorted(([, a], [, b]) => b - a)
  .slice(0, TOP_SPECIES_SHOWN)
  .forEach(([name, knockOuts], rank) => console.info(`  ${rank + 1}. ${name} — ${(knockOuts / runs).toFixed(1)}`))

const elapsed = performance.now() - startedAt
console.info(`\n${Math.round(elapsed)} ms au total, ${Math.round(elapsed / runs)} ms par combat`)
