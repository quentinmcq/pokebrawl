import { describe, expect, it } from 'vitest'
import { pokedex } from '../src/pokedex'
import { costOf, MAX_TEAM_SIZE, MIN_COST, teamCost, TEAM_BUDGET } from '../src/simulation/cost'
import { hordeOf, selectTeam, teamTitle, toFighterSetup } from '../src/simulation/teams'

const fighter = (name: string) =>
  toFighterSetup(
    pokedex.pokemon.find((species) => species.names.fr === name)!,
    pokedex,
  )

const gen1HordeIds = () => hordeOf(pokedex, 'gen1', TEAM_BUDGET).map(({ species }) => species.id)

describe('costOf', () => {
  it('charges more for stronger Pokémon', () => {
    expect(costOf(fighter('Mewtwo'))).toBeGreaterThan(costOf(fighter('Dracaufeu')))
    expect(costOf(fighter('Dracaufeu'))).toBeGreaterThan(costOf(fighter('Pikachu')))
  })

  it('never goes below the floor that keeps a team inside the arena', () => {
    expect(costOf(fighter('Magicarpe'))).toBe(MIN_COST)
    for (const species of pokedex.pokemon)
      expect(costOf(toFighterSetup(species, pokedex))).toBeGreaterThanOrEqual(MIN_COST)
    expect(TEAM_BUDGET / MIN_COST).toBe(MAX_TEAM_SIZE)
  })
})

describe('hordes', () => {
  it('draws a horde worth just under its value', () => {
    for (const selector of ['gen1', 'legendaries', 'type:dragon']) {
      const horde = hordeOf(pokedex, selector, TEAM_BUDGET)
      expect(teamCost(horde)).toBeLessThanOrEqual(TEAM_BUDGET)
      expect(teamCost(horde)).toBeGreaterThan(TEAM_BUDGET - MIN_COST * 2)
    }
  })

  it('draws the same horde every time, so that a player can study it', () => {
    expect(gen1HordeIds()).toEqual(gen1HordeIds())
  })

  it('selects hordes and repeated Pokémon from a selector', () => {
    expect(selectTeam(pokedex, 'horde:gen3:800').fighters.length).toBeGreaterThan(0)
    expect(teamTitle('horde:type:fire:1000')).toBe('Horde Type Feu')
    const team = selectTeam(pokedex, 'ids:66*10,6*2')
    expect(team.fighters.map(({ species }) => species.names.en)).toEqual([
      ...Array.from({ length: 10 }, () => 'Machop'),
      'Charizard',
      'Charizard',
    ])
    expect(() => selectTeam(pokedex, 'ids:25*0')).toThrow()
  })
})
