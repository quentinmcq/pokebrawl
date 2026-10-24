import { describe, expect, it } from 'vitest'
import { createRandom } from '../src/simulation/random'

describe('createRandom', () => {
  it('replays the same sequence for the same seed', () => {
    const first = createRandom(42)
    const second = createRandom(42)
    expect(Array.from({ length: 5 }, first.next)).toEqual(Array.from({ length: 5 }, second.next))
  })

  it('gives different sequences for different seeds', () => {
    expect(createRandom(1).next()).not.toBe(createRandom(2).next())
  })

  it('stays within bounds', () => {
    const random = createRandom(7)
    for (let draw = 0; draw < 1000; draw++) {
      const integer = random.integer(16)
      expect(integer).toBeGreaterThanOrEqual(0)
      expect(integer).toBeLessThan(16)
    }
  })

  it('shuffles without losing or duplicating items', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8]
    expect(
      createRandom(3)
        .shuffle(items)
        .toSorted((a, b) => a - b),
    ).toEqual(items)
  })
})
