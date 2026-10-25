import { describe, expect, it } from 'vitest'
import { pokedex } from '../src/pokedex'
import type { TeamSetup } from '../src/simulation/battle'
import { selectTeam, teamTitle, trimToSameSize } from '../src/simulation/teams'

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
    expect(teamTitle('gen1', 'fr')).toBe('Gen 1')
    expect(teamTitle('type:fire', 'fr')).toBe('Type Feu')
    expect(teamTitle('legendaries', 'fr')).toBe('Légendaires')
    expect(teamTitle('ids:25,6', 'fr')).toBe('Ton équipe')
  })
})

const gen1AndGen3 = () => [selectTeam(pokedex, 'gen1'), selectTeam(pokedex, 'gen3')] as [TeamSetup, TeamSetup]
const keptIds = (seed: number) => trimToSameSize(gen1AndGen3(), seed)[0].fighters.map(({ species }) => species.id)

describe('trimToSameSize', () => {
  it('keeps as many Pokémon on each side as on the smaller one', () => {
    const [first, second] = trimToSameSize(gen1AndGen3(), 42)
    expect(first.fighters).toHaveLength(135)
    expect(second.fighters).toHaveLength(135)
  })

  it('picks the same Pokémon for the same seed, and others for another seed', () => {
    expect(keptIds(42)).toEqual(keptIds(42))
    expect(keptIds(42)).not.toEqual(keptIds(43))
    expect(keptIds(42)).toEqual(keptIds(42).toSorted((a, b) => a - b))
  })
})
