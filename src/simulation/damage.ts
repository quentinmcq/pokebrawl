import type { Random } from './random'
import { typeEffectiveness } from './typeChart'
import type { BaseStats, Move, PokemonTypes } from './types'

export const LEVEL = 50
const PERFECT_INDIVIDUAL_VALUE = 31
const SAME_TYPE_BONUS = 1.5
const CRITICAL_CHANCE = 1 / 24
const CRITICAL_BONUS = 1.5

export interface BattleStats {
  maxHp: number
  attack: number
  defense: number
  specialAttack: number
  specialDefense: number
  speed: number
}

export interface Combatant {
  types: PokemonTypes
  stats: BattleStats
}

interface HitRoll {
  damage: number
  multiplier: number
  critical: boolean
}

// Official level formula with perfect individual values, no effort values and a neutral nature.
const otherStatAtLevel = (base: number) => Math.floor(((2 * base + PERFECT_INDIVIDUAL_VALUE) * LEVEL) / 100) + 5

export function battleStatsOf(base: BaseStats): BattleStats {
  // Shedinja is the only Pokémon with 1 base HP, and always has exactly 1 HP.
  const maxHp = base.hp === 1 ? 1 : Math.floor(((2 * base.hp + PERFECT_INDIVIDUAL_VALUE) * LEVEL) / 100) + LEVEL + 10
  return {
    maxHp,
    attack: otherStatAtLevel(base.attack),
    defense: otherStatAtLevel(base.defense),
    specialAttack: otherStatAtLevel(base.specialAttack),
    specialDefense: otherStatAtLevel(base.specialDefense),
    speed: otherStatAtLevel(base.speed),
  }
}

function attackAndDefense(move: Move, attacker: Combatant, defender: Combatant) {
  return move.category === 'physical'
    ? { attack: attacker.stats.attack, defense: defender.stats.defense }
    : { attack: attacker.stats.specialAttack, defense: defender.stats.specialDefense }
}

const sameTypeBonus = (move: Move, attacker: Combatant) => (attacker.types.includes(move.type) ? SAME_TYPE_BONUS : 1)

/** Average damage before randomness, used to pick the best move against a target. */
export function expectedDamage(move: Move, attacker: Combatant, defender: Combatant) {
  const { attack, defense } = attackAndDefense(move, attacker, defender)
  const accuracy = (move.accuracy ?? 100) / 100
  return (
    move.power *
    (attack / defense) *
    accuracy *
    sameTypeBonus(move, attacker) *
    typeEffectiveness(move.type, defender.types)
  )
}

export function rollDamage(move: Move, attacker: Combatant, defender: Combatant, random: Random): HitRoll {
  const multiplier = typeEffectiveness(move.type, defender.types)
  if (multiplier === 0) return { damage: 0, multiplier, critical: false }

  const { attack, defense } = attackAndDefense(move, attacker, defender)
  const critical = random.chance(CRITICAL_CHANCE)
  const levelFactor = Math.floor((2 * LEVEL) / 5 + 2)
  const baseDamage = Math.floor(Math.floor((levelFactor * move.power * attack) / defense) / 50) + 2
  const randomFactor = (85 + random.integer(16)) / 100
  const damage = Math.floor(
    baseDamage * (critical ? CRITICAL_BONUS : 1) * randomFactor * sameTypeBonus(move, attacker) * multiplier,
  )
  return { damage: Math.max(1, damage), multiplier, critical }
}

export const hits = (move: Move, random: Random) => move.accuracy === null || random.chance(move.accuracy / 100)
