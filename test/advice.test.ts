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

  it('spends what the budget allows and keeps the Pokémon already chosen', () => {
    // Always drawing the last affordable Pokémon: three more at 30, then 5 points too few for anything.
    const filled = fillAtRandom(new Map([[2, 1]]), catalogue, 95, 100, () => 0.99)
    expect(filled.get(2)).toBe(4)
    expect(filled.has(1)).toBe(false)
  })

  it('stops at the size limit', () => {
    const filled = fillAtRandom(new Map(), catalogue, 1000, 3, () => 0)
    expect(filled.get(1)).toBe(3)
  })
})
