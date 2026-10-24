import { describe, expect, it } from 'vitest'
import { pokedex } from '../src/pokedex'
import { battleReport } from '../src/report'
import { selectTeam } from '../src/simulation/teams'

const setupOf = (first: string, second: string) => ({
  teams: [selectTeam(pokedex, first), selectTeam(pokedex, second)] as [
    ReturnType<typeof selectTeam>,
    ReturnType<typeof selectTeam>,
  ],
  seed: 3,
})

describe('battleReport', () => {
  it('points out the types the opponents punished', () => {
    const lines = battleReport(setupOf('ids:5*20', 'horde:type:water:1000'))
    expect(lines.some((line) => line.includes('super efficaces') && line.includes('Feu'))).toBe(true)
  })

  it('points out attacks that hit resistant opponents', () => {
    // Magikarp only knows Tackle, a Normal move that Rock Pokémon resist.
    const lines = battleReport(setupOf('ids:129*100', 'horde:type:rock:1000'))
    expect(lines.some((line) => line.includes('peu efficaces'))).toBe(true)
  })

  it('names the best value in the team, in a few lines at most', () => {
    const lines = battleReport(setupOf('ids:66*10,129*20', 'horde:gen1:1000'))
    expect(lines.length).toBeLessThanOrEqual(3)
    expect(lines.some((line) => line.startsWith('Meilleur rapport') || line.includes('peu efficaces'))).toBe(true)
  })
})
