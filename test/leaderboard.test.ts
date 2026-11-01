import { describe, expect, it } from 'vitest'
import { isPlayerId, scoreOfTeam } from '../src/leaderboard'
import { checkNickname, randomNickname } from '../src/nickname'
import { pokedex } from '../src/pokedex'
import { costOf, TEAM_BUDGET, teamCost } from '../src/simulation/cost'
import { createRandom } from '../src/simulation/random'
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

describe('random nicknames', () => {
  it('pairs a Pokémon name with three digits, and always passes the nickname rules', () => {
    const names = pokedex.pokemon.flatMap((species) => [species.names.fr, species.names.en])
    const random = createRandom(7).next
    for (let draw = 0; draw < 2000; draw++) {
      const nickname = randomNickname(names, random)
      expect(nickname).toMatch(/ \d{3}$/)
      expect(checkNickname(nickname)).toEqual({ ok: true, nickname })
    }
  })
})

describe('submitted teams', () => {
  it('computes the points on the server side', () => {
    const team = 'ids:66*3,6*2'
    expect(scoreOfTeam(team)).toEqual({ points: teamCost(selectTeam(pokedex, team).fighters), size: 5 })
  })

  it('refuses more than three copies of the same Pokémon', () => {
    expect(scoreOfTeam('ids:129*3,25')).not.toBeNull()
    expect(scoreOfTeam('ids:129*4,25')).toBeNull()
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
