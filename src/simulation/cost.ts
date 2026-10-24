import { attackIntervalSecondsOf, type FighterSetup } from './battle'
import { battleStatsOf, LEVEL } from './damage'

export const TEAM_BUDGET = 1000
export const MAX_TEAM_SIZE = 100
// Even the weakest Pokémon costs a hundredth of the budget, so that a team never outgrows the arena.
export const MIN_COST = TEAM_BUDGET / MAX_TEAM_SIZE
/**
 * In a crowd battle a side's strength grows with the square of its numbers (Lanchester's law), so a cost in
 * proportion to raw strength makes swarms unbeatable. Close to its square root, armies of one budget built from
 * weak, average or elite Pokémon each win 35 to 65 % of the time against one another (`bun run balance`).
 */
const COST_EXPONENT = 0.48
// An average Pokémon costs about 25 points.
const COST_SCALE = 0.5
// An average Pokémon, with every base stat at 80, stands as the yardstick for attack and defence.
const REFERENCE = battleStatsOf({ hp: 80, attack: 80, defense: 80, specialAttack: 80, specialDefense: 80, speed: 80 })
const LEVEL_FACTOR = Math.floor((2 * LEVEL) / 5 + 2)

/** Damage dealt per second against an average target, times the hits it takes to fall: what a fighter is worth. */
export function strengthOf({ species, moves }: FighterSetup) {
  const stats = battleStatsOf(species.stats)
  const hitOf = (move: FighterSetup['moves'][number]) => {
    const physical = move.category === 'physical'
    const attack = physical ? stats.attack : stats.specialAttack
    const defense = physical ? REFERENCE.defense : REFERENCE.specialDefense
    const sameType = species.types.includes(move.type) ? 1.5 : 1
    return ((LEVEL_FACTOR * move.power * attack) / defense / 50 + 2) * sameType * ((move.accuracy ?? 100) / 100)
  }
  const offense = Math.max(...moves.map(hitOf)) / attackIntervalSecondsOf(species.stats.speed)
  const bulk = (stats.maxHp * (stats.defense + stats.specialDefense)) / (2 * REFERENCE.defense)
  return offense * bulk
}

export const costOf = (fighter: FighterSetup) =>
  Math.max(MIN_COST, Math.round(COST_SCALE * strengthOf(fighter) ** COST_EXPONENT))

export const teamCost = (fighters: FighterSetup[]) => fighters.reduce((total, fighter) => total + costOf(fighter), 0)
