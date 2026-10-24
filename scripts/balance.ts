import { parseArgs } from 'node:util'
import { pokedex } from '../src/pokedex'
import { runBattle, type FighterSetup, type TeamSetup } from '../src/simulation/battle'
import { costOf, MAX_TEAM_SIZE, strengthOf, TEAM_BUDGET } from '../src/simulation/cost'
import { createRandom } from '../src/simulation/random'
import { toFighterSetup } from '../src/simulation/teams'

// Armies of one budget built from different strength tiers fight each other: with well-tuned costs, none dominates.
const { values: options } = parseArgs({ options: { runs: { type: 'string', default: '30' } } })
const runs = Number(options.runs)

const everyone = pokedex.pokemon
  .map((species) => toFighterSetup(species, pokedex))
  .toSorted((a, b) => strengthOf(a) - strengthOf(b))
const tier = (from: number, to: number) =>
  everyone.slice(Math.floor(from * everyone.length), Math.floor(to * everyone.length))
const tiers = { élite: tier(0.95, 1), forts: tier(0.75, 0.95), moyens: tier(0.35, 0.65), faibles: tier(0.05, 0.3) }
const MATCHUPS = [
  ['élite', 'faibles'],
  ['élite', 'moyens'],
  ['forts', 'faibles'],
  ['moyens', 'faibles'],
] as const
const PICK_ATTEMPTS = 500

function army(pool: FighterSetup[], seed: number): TeamSetup {
  const random = createRandom(seed)
  const fighters: FighterSetup[] = []
  let left = TEAM_BUDGET
  for (let attempt = 0; attempt < PICK_ATTEMPTS && fighters.length < MAX_TEAM_SIZE; attempt++) {
    const pick = pool[random.integer(pool.length)]!
    if (costOf(pick) > left) continue
    fighters.push(pick)
    left -= costOf(pick)
  }
  return { label: '', fighters }
}

const costOfSpecies = (name: string) => costOf(everyone.find(({ species }) => species.names.fr === name)!)
console.info(
  `\nCoûts : ${['Magicarpe', 'Pikachu', 'Dracaufeu', 'Mewtwo', 'Kyogre'].map((name) => `${name} ${costOfSpecies(name)}`).join(', ')}`,
)
console.info(`Armées de ${TEAM_BUDGET} points, ${runs} combats par affiche (camps alternés) :\n`)
for (const [first, second] of MATCHUPS) {
  let wins = 0
  const sizes = [0, 0]
  for (let run = 0; run < runs; run++) {
    const armies = [army(tiers[first], run * 7 + 1), army(tiers[second], run * 7 + 2)] as const
    sizes[0]! += armies[0].fighters.length
    sizes[1]! += armies[1].fighters.length
    const swapped = run % 2 === 1
    const { result } = runBattle({
      teams: swapped ? [armies[1], armies[0]] : [armies[0], armies[1]],
      seed: run + 100,
    })
    if (result.outcome === (swapped ? 1 : 0)) wins++
  }
  const average = (total: number) => Math.round(total / runs)
  console.info(
    `  ${first} (${average(sizes[0]!)} Pokémon) contre ${second} (${average(sizes[1]!)}) : ${Math.round((100 * wins) / runs)} % pour ${first}`,
  )
}
