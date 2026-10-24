import { describe, expect, it } from 'vitest'
import { pokedex } from '../src/pokedex'
import { selectTeam, teamTitle } from '../src/simulation/teams'

const namesOf = (selector: string) => selectTeam(pokedex, selector).fighters.map(({ species }) => species.names.en)

describe('selectTeam', () => {
  it('selects a whole generation', () => {
    expect(selectTeam(pokedex, 'gen1').fighters).toHaveLength(151)
    expect(selectTeam(pokedex, 'gen3').fighters).toHaveLength(135)
  })

  it('selects by type, rarity or id', () => {
    expect(namesOf('type:fire')).toContain('Charizard')
    expect(namesOf('legendaries')).toContain('Mewtwo')
    expect(namesOf('ids:25,6')).toEqual(['Pikachu', 'Charizard'])
  })

  it('gives every Pokémon at least one move', () => {
    for (const { moves } of selectTeam(pokedex, 'gen9').fighters) expect(moves.length).toBeGreaterThan(0)
  })

  it('rejects unknown selectors', () => {
    expect(() => selectTeam(pokedex, 'gen12')).toThrow()
    expect(() => selectTeam(pokedex, 'ids:2000')).toThrow()
  })
})

describe('teamTitle', () => {
  it('names a team for the screen', () => {
    expect(teamTitle('gen1')).toBe('Gen 1')
    expect(teamTitle('type:fire')).toBe('Type Feu')
    expect(teamTitle('legendaries')).toBe('Légendaires')
    expect(teamTitle('ids:25,6')).toBe('Sélection')
  })
})
