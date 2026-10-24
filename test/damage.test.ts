import { describe, expect, it } from 'vitest'
import { battleStatsOf, rollDamage, type Combatant } from '../src/simulation/damage'
import { createRandom } from '../src/simulation/random'
import type { Move } from '../src/simulation/types'

const move = (overrides: Partial<Move>): Move => ({
  id: 1,
  names: { fr: 'Test', en: 'Test' },
  type: 'normal',
  power: 80,
  accuracy: 100,
  category: 'physical',
  ...overrides,
})

const combatant = (types: Combatant['types']): Combatant => ({
  types,
  stats: battleStatsOf({ hp: 100, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100, speed: 100 }),
})

describe('battleStatsOf', () => {
  it('follows the official level 50 formula', () => {
    // Pikachu: 35 HP, 55 Attack, 90 Speed.
    const stats = battleStatsOf({ hp: 35, attack: 55, defense: 40, specialAttack: 50, specialDefense: 50, speed: 90 })
    expect(stats.maxHp).toBe(110)
    expect(stats.attack).toBe(75)
    expect(stats.speed).toBe(110)
  })

  it('gives Shedinja exactly 1 HP', () => {
    expect(
      battleStatsOf({ hp: 1, attack: 90, defense: 45, specialAttack: 30, specialDefense: 30, speed: 40 }).maxHp,
    ).toBe(1)
  })
})

describe('rollDamage', () => {
  it('does nothing against an immune type', () => {
    const roll = rollDamage(move({ type: 'normal' }), combatant(['normal']), combatant(['ghost']), createRandom(1))
    expect(roll).toEqual({ damage: 0, multiplier: 0, critical: false })
  })

  it('hits harder when super effective and with the same type', () => {
    const attacker = combatant(['water'])
    const neutral = rollDamage(move({ type: 'water' }), attacker, combatant(['normal']), createRandom(5))
    const superEffective = rollDamage(move({ type: 'water' }), attacker, combatant(['fire']), createRandom(5))
    expect(superEffective.multiplier).toBe(2)
    expect(superEffective.damage).toBeGreaterThan(neutral.damage * 1.9)
  })

  it('always deals at least 1 damage when the move can hit', () => {
    const weakMove = move({ power: 1, type: 'grass' })
    expect(rollDamage(weakMove, combatant(['normal']), combatant(['fire', 'dragon']), createRandom(9)).damage).toBe(1)
  })
})
