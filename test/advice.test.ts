import { describe, expect, it } from 'vitest'
import { analyseHorde, fillAtRandom } from '../src/advice'
import { pokedex } from '../src/pokedex'
import { selectTeam } from '../src/simulation/teams'

describe('analyseHorde', () => {
  it('names the main types of a horde and the attack types that hit it hardest', () => {
    const { dominant, targets } = analyseHorde(selectTeam(pokedex, 'type:fire').fighters)
    expect(dominant[0]).toBe('fire')
    expect(targets).toContain('water')
    expect(targets).not.toContain('grass')
  })
})

describe('fillAtRandom', () => {
  const catalogue = [
    { id: 1, cost: 10 },
    { id: 2, cost: 30 },
  ]

  it('spends what the budget allows, keeps the Pokémon already chosen, and never goes past three copies', () => {
    // Always drawing the last affordable Pokémon: two more at 30 reach three copies, then the cheap one three times.
    const filled = fillAtRandom(new Map([[2, 1]]), catalogue, 95, 100, () => 0.99)
    expect(filled.get(2)).toBe(3)
    expect(filled.get(1)).toBe(3)
  })

  it('stops at the size limit', () => {
    const filled = fillAtRandom(new Map(), catalogue, 1000, 3, () => 0)
    expect(filled.get(1)).toBe(3)
  })
})
