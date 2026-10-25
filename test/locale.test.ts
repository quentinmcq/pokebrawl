import { describe, expect, it } from 'vitest'
import { localeOfPath } from '../src/locale'
import { MATCHUPS, matchupPath, matchupTitle } from '../src/matchups'
import { MESSAGES } from '../src/messages'
import { checkNickname } from '../src/nickname'
import { teamTitle } from '../src/simulation/teams'

describe('languages', () => {
  it('reads the language from the address', () => {
    expect(localeOfPath('/')).toBe('fr')
    expect(localeOfPath('/combats/gen-1-contre-gen-3/')).toBe('fr')
    expect(localeOfPath('/en')).toBe('en')
    expect(localeOfPath('/en/battles/')).toBe('en')
    expect(localeOfPath('/english')).toBe('fr')
  })

  it('writes ranks as each language does', () => {
    expect([1, 2, 3, 4].map(MESSAGES.fr.ordinal)).toEqual(['1er', '2e', '3e', '4e'])
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 111].map(MESSAGES.en.ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '111th',
    ])
  })

  it('names teams and matchups in English', () => {
    expect(teamTitle('type:fire', 'en')).toBe('Fire Type')
    expect(teamTitle('horde:gen1:1000', 'en')).toBe('Gen 1')
    const matchup = MATCHUPS.find(({ teams }) => teams[0] === 'gen1' && teams[1] === 'gen3')!
    expect(matchupTitle(matchup, 'en')).toBe('Gen 1 vs Gen 3')
    expect(matchupPath(matchup, 'en')).toBe('/en/battles/gen-1-vs-gen-3/')
    expect(matchupPath(matchup, 'fr')).toBe('/combats/gen-1-contre-gen-3/')
  })

  it('gives every matchup its own English address', () => {
    const paths = MATCHUPS.map((matchup) => matchupPath(matchup, 'en'))
    expect(new Set(paths).size).toBe(MATCHUPS.length)
  })

  it('words nickname errors in both languages', () => {
    const check = checkNickname('a')
    expect(check.ok).toBe(false)
    if (check.ok) return
    expect(MESSAGES.fr.nicknameErrors[check.error]).toBe('Ton pseudo est trop court.')
    expect(MESSAGES.en.nicknameErrors[check.error]).toBe('Your nickname is too short.')
  })
})
