import { describe, expect, it } from 'vitest'
import { battleSearch, DEFAULT_TEAMS, readBattleParams } from '../src/render/params'

describe('battle params', () => {
  it('reads both teams and the seed from the URL', () => {
    expect(readBattleParams('?a=gen2&b=type:water&seed=42')).toEqual({ teams: ['gen2', 'type:water'], seed: 42 })
  })

  it('falls back to the default teams and a fresh seed', () => {
    expect(readBattleParams('', () => 7)).toEqual({ teams: DEFAULT_TEAMS, seed: 7 })
    expect(readBattleParams('?seed=abc', () => 7).seed).toBe(7)
    expect(readBattleParams('?seed=-3', () => 7).seed).toBe(7)
  })

  it('writes params that read back the same', () => {
    const params = { teams: ['ids:25,6', 'legendaries'] as [string, string], seed: 123 }
    expect(readBattleParams(battleSearch(params))).toEqual(params)
  })
})
