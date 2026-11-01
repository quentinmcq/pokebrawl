// Prints a team that beats today's daily horde. Run by Bun, as Playwright's loader cannot read the simulation's JSON
// data; battles are deterministic, so the app's battle ends the same way.
import { fillAtRandom } from '../src/advice'
import { dailyChallenge, dayOf } from '../src/daily'
import { pokedex } from '../src/pokedex'
import { runBattle } from '../src/simulation/battle'
import { costOf, MAX_TEAM_SIZE, TEAM_BUDGET } from '../src/simulation/cost'
import { createRandom } from '../src/simulation/random'
import { selectorOfCounts, selectTeam, toFighterSetup } from '../src/simulation/teams'

const { horde, seed } = dailyChallenge(dayOf(new Date()))
const opponent = selectTeam(pokedex, horde)
const prices = pokedex.pokemon.map((species) => ({ id: species.id, cost: costOf(toFighterSetup(species, pokedex)) }))
for (let attempt = 1; attempt <= 200; attempt++) {
  const team = selectorOfCounts(fillAtRandom(new Map(), prices, TEAM_BUDGET, MAX_TEAM_SIZE, createRandom(attempt).next))
  if (runBattle({ teams: [selectTeam(pokedex, team), opponent], seed }).result.outcome === 0) {
    console.log(team)
    process.exit(0)
  }
}
throw new Error('No winning team found for today')
