import type { FighterSetup } from './simulation/battle'
import { MAX_COPIES } from './simulation/cost'
import { typeEffectiveness } from './simulation/typeChart'
import type { TypeKey } from './simulation/types'

const ALL_TYPES = Object.keys({
  normal: 0,
  fire: 0,
  water: 0,
  electric: 0,
  grass: 0,
  ice: 0,
  fighting: 0,
  poison: 0,
  ground: 0,
  flying: 0,
  psychic: 0,
  bug: 0,
  rock: 0,
  ghost: 0,
  dragon: 0,
  dark: 0,
  steel: 0,
  fairy: 0,
} satisfies Record<TypeKey, number>) as TypeKey[]
const DOMINANT_TYPES_SHOWN = 2
const TARGET_TYPES_SHOWN = 3
// A type resisted by a horde member costs half of what a super effective hit brings.
const RESISTED_WEIGHT = 0.5

/**
 * What a horde is made of and how to hit it: its most common types, and the attack types that are super effective
 * against the most of its members while few of them resist it.
 */
export function analyseHorde(horde: FighterSetup[]) {
  const counts = new Map<TypeKey, number>()
  for (const { species } of horde) for (const type of species.types) counts.set(type, (counts.get(type) ?? 0) + 1)
  const dominant = [...counts]
    .toSorted(([, a], [, b]) => b - a)
    .slice(0, DOMINANT_TYPES_SHOWN)
    .map(([type]) => type)

  const targets = ALL_TYPES.map((type) => {
    const multipliers = horde.map(({ species }) => typeEffectiveness(type, species.types))
    const superEffective = multipliers.filter((multiplier) => multiplier >= 2).length
    const resisted = multipliers.filter((multiplier) => multiplier < 1).length
    return { type, superEffective, score: superEffective - RESISTED_WEIGHT * resisted }
  })
    .filter(({ superEffective }) => superEffective > 0)
    .toSorted((a, b) => b.score - a.score)
    .slice(0, TARGET_TYPES_SHOWN)
    .map(({ type }) => type)

  return { dominant, targets }
}

interface Priced {
  id: number
  cost: number
}

/** Adds random Pokémon the budget still allows, one at a time, until none fits. */
export function fillAtRandom(
  team: Map<number, number>,
  catalogue: Priced[],
  budgetLeft: number,
  sizeLeft: number,
  random: () => number,
) {
  const filled = new Map(team)
  let left = budgetLeft
  let room = sizeLeft
  for (;;) {
    const affordable = catalogue.filter(({ id, cost }) => cost <= left && (filled.get(id) ?? 0) < MAX_COPIES)
    if (affordable.length === 0 || room === 0) return filled
    const pick = affordable[Math.floor(random() * affordable.length)]!
    filled.set(pick.id, (filled.get(pick.id) ?? 0) + 1)
    left -= pick.cost
    room--
  }
}
