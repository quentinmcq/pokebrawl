import { describe, expect, it } from 'vitest'
import { battleSearch, DEFAULT_TEAMS, describesBattle, readBattleParams } from '../src/render/params'
import { terrainForSeed } from '../src/render/terrain'

describe('battle params', () => {
  it('reads the teams, seed, terrain and same-size option from the URL', () => {
    expect(readBattleParams('?a=gen2&b=type:water&seed=42&terrain=snow&same=1')).toEqual({
      teams: ['gen2', 'type:water'],
      seed: 42,
      terrain: 'snow',
      sameSize: true,
    })
  })

  it('falls back to the default teams, a fresh seed and the terrain of that seed', () => {
    expect(readBattleParams('', () => 7)).toEqual({
      teams: DEFAULT_TEAMS,
      seed: 7,
      terrain: terrainForSeed(7),
      sameSize: false,
    })
    expect(readBattleParams('?seed=abc', () => 7).seed).toBe(7)
    expect(readBattleParams('?seed=-3', () => 7).seed).toBe(7)
    expect(readBattleParams('?seed=5&terrain=lava').terrain).toBe(terrainForSeed(5))
  })

  it('writes params that read back the same', () => {
    const params = {
      teams: ['ids:25,6', 'legendaries'] as [string, string],
      seed: 123,
      terrain: 'cave' as const,
      sameSize: true,
    }
    expect(readBattleParams(battleSearch(params))).toEqual(params)
    expect(describesBattle(battleSearch(params))).toBe(true)
    expect(describesBattle('')).toBe(false)
  })
})
