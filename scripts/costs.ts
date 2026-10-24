import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { pokedex } from '../src/pokedex'
import { runBattle, type Fighter, type FighterSetup, type TeamSetup } from '../src/simulation/battle'
import { estimatedCostOf, MAX_TEAM_SIZE, MIN_COST, TEAM_BUDGET } from '../src/simulation/cost'
import { createRandom } from '../src/simulation/random'
import { toFighterSetup } from '../src/simulation/teams'

/*
 * Prices every Pokémon by battle rather than by formula. Each round, every Pokémon takes 40 % of a team's budget
 * among the same random teammates, and that team fights mixed reference teams; the score is how much more of its
 * value is left standing than of its opponents'. A Pokémon is then made dearer when it scores above the median,
 * cheaper below, and the rounds converge on prices where no Pokémon is a better buy than another.
 *
 * Measuring each Pokémon inside a mixed team matters: alone, a team of one species lacks type coverage, and against
 * teams of a given size the strong few and the weak many do not compare fairly. Priced that way, swarms of weak
 * Pokémon ended up beating every other strategy.
 */
const { values: options } = parseArgs({
  options: { rounds: { type: 'string', default: '6' }, references: { type: 'string', default: '10' } },
})
const ROUNDS = Number(options.rounds)
const REFERENCES = Number(options.references)
const OUTPUT = join(import.meta.dirname, '..', 'src', 'data', 'costs.json')
// Bold corrections first, gentle ones once prices are close.
// The Pokémon makes up part of its team only, so its price weighs less on the score: steps are larger to match.
const firstStep = 1.6
const lastStep = 0.5
const FOCUS_SHARE = 0.4
const PICK_ATTEMPTS = 500

const everyone = pokedex.pokemon.map((species) => toFighterSetup(species, pokedex))
const costs = new Map(everyone.map((fighter) => [fighter.species.id, estimatedCostOf(fighter)]))
const costOf = (fighter: { species: { id: number } }) => costs.get(fighter.species.id)!

function mixedTeam(seed: number, budget = TEAM_BUDGET, maxSize = MAX_TEAM_SIZE): TeamSetup {
  const random = createRandom(seed)
  const fighters: FighterSetup[] = []
  let left = budget
  for (let attempt = 0; attempt < PICK_ATTEMPTS && fighters.length < maxSize; attempt++) {
    const pick = everyone[random.integer(everyone.length)]!
    if (costOf(pick) > left) continue
    fighters.push(pick)
    left -= costOf(pick)
  }
  return { label: 'mixed', fighters }
}

const valueStanding = (fighters: Fighter[], team: 0 | 1) =>
  fighters
    .filter((fighter) => fighter.team === team)
    .reduce((total, fighter) => total + (costOf(fighter) * fighter.hp) / fighter.maxHp, 0) / TEAM_BUDGET

/** The Pokémon for 40 % of the budget, then teammates drawn from a seed shared by every Pokémon of the round. */
function teamFeaturing(fighter: FighterSetup, teammatesSeed: number): TeamSetup {
  const copies = Math.max(1, Math.round((TEAM_BUDGET * FOCUS_SHARE) / costOf(fighter)))
  const featured = Array.from({ length: copies }, () => fighter)
  const teammates = mixedTeam(teammatesSeed, TEAM_BUDGET - copies * costOf(fighter), MAX_TEAM_SIZE - copies)
  return { label: 'featured', fighters: [...featured, ...teammates.fighters] }
}

/** From -1 (wiped out, opponents intact) to 1 (intact, opponents wiped out), averaged over the reference teams. */
function scoreOf(fighter: FighterSetup, references: TeamSetup[], round: number) {
  const total = references.reduce((sum, reference, index) => {
    const team = teamFeaturing(fighter, 5000 + round * 100 + index)
    const { battle } = runBattle({ teams: [team, reference], seed: 7 + index })
    return sum + valueStanding(battle.fighters, 0) - valueStanding(battle.fighters, 1)
  }, 0)
  return total / references.length
}

const quantile = (scores: number[], share: number) =>
  scores.toSorted((a, b) => a - b)[Math.floor(share * (scores.length - 1))]!

const spread = (scores: number[], median: number) => {
  const at = (share: number) => (quantile(scores, share) - median).toFixed(2)
  const typical = scores.filter((score) => Math.abs(score - median) <= 0.25).length
  return `médiane ${median.toFixed(2)}, écart à la médiane 10 %–90 % : ${at(0.1)} à ${at(0.9)}, ${Math.round((100 * typical) / scores.length)} % à moins de 0,25`
}

for (let round = 0; round < ROUNDS; round++) {
  const started = performance.now()
  const references = Array.from({ length: REFERENCES }, (_, index) => mixedTeam(1000 + round * 100 + index))
  const scores = everyone.map((fighter) => scoreOf(fighter, references, round))
  const step = firstStep + ((lastStep - firstStep) * round) / Math.max(1, ROUNDS - 1)
  const median = quantile(scores, 0.5)
  everyone.forEach((fighter, index) => {
    const corrected = Math.round(costOf(fighter) * Math.exp(step * (scores[index]! - median)))
    costs.set(fighter.species.id, Math.max(MIN_COST, corrected))
  })
  const seconds = Math.round((performance.now() - started) / 1000)
  console.info(`Tour ${round + 1}/${ROUNDS} (${seconds} s) : ${spread(scores, median)}`)
}

writeFileSync(OUTPUT, `${JSON.stringify(Object.fromEntries(costs))}\n`)
const named = (name: string) => everyone.find(({ species }) => species.names.fr === name)!
console.info(
  `OK : ${costs.size} coûts dans src/data/costs.json. ${['Magicarpe', 'Pikachu', 'Goupix', 'Dracaufeu', 'Mewtwo', 'Kyogre'].map((name) => `${name} ${costOf(named(name))}`).join(', ')}`,
)
