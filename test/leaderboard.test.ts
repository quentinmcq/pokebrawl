import { describe, expect, it } from 'vitest'
import { isPlayerId, scoreOfTeam } from '../src/leaderboard'
import { checkNickname } from '../src/nickname'
import { pokedex } from '../src/pokedex'
import { costOf, TEAM_BUDGET, teamCost } from '../src/simulation/cost'
import { selectTeam } from '../src/simulation/teams'

describe('nicknames', () => {
  it('accepts ordinary names, accents included', () => {
    expect(checkNickname('  Sacha   du Bourg ')).toEqual({ ok: true, nickname: 'Sacha du Bourg' })
    expect(checkNickname('Constance').ok).toBe(true)
    expect(checkNickname('Éloïse-42').ok).toBe(true)
  })

  it('refuses names too short, too long, with symbols or insults, even disguised', () => {
    for (const name of ['', 'a', 'x'.repeat(21), '<script>', 'fdp', 'P u t a i n', 'pu7ain']) {
      expect(checkNickname(name).ok).toBe(false)
    }
  })
})

describe('submitted teams', () => {
  it('computes the points on the server side', () => {
    const team = 'ids:66*10,6*2'
    expect(scoreOfTeam(team)).toEqual({ points: teamCost(selectTeam(pokedex, team).fighters), size: 12 })
  })

  it('refuses teams over budget, too large, or not made of Pokémon ids', () => {
    // One Mewtwo more than the budget allows, whatever its calibrated price.
    const overBudget = `ids:150*${Math.floor(TEAM_BUDGET / costOf(selectTeam(pokedex, 'ids:150').fighters[0]!)) + 1}`
    for (const team of [overBudget, 'ids:129*101', 'gen1', 'horde:gen1:1000', 'ids:9999', 'ids:', 42, null]) {
      expect(scoreOfTeam(team)).toBeNull()
    }
  })

  it('recognises player ids made by the browser', () => {
    expect(isPlayerId(crypto.randomUUID())).toBe(true)
    expect(isPlayerId('admin')).toBe(false)
  })
})
