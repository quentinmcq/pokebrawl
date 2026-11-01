import { describe, expect, it } from 'vitest'
import { ACHIEVEMENTS, newlyUnlocked, type AchievementState, type CountedWin } from '../src/achievements'

const STARTING: AchievementState = { trainingWins: [], dailyStreak: 0, friendWins: 0, bestRank: null }
const win = (overrides: Partial<CountedWin> = {}): CountedWin => ({
  speciesIds: Array.from({ length: 30 }, (_, index) => index + 1),
  points: 900,
  collection: [],
  ...overrides,
})
const ids = (achievements: { id: string }[]) => achievements.map(({ id }) => id)

describe('achievements', () => {
  it('gives the first win, and nothing else, for an ordinary victory', () => {
    expect(ids(newlyUnlocked(new Set(), STARTING, win()))).toEqual(['first-win'])
    expect(newlyUnlocked(new Set(['first-win']), STARTING, win())).toEqual([])
  })

  it('rewards the shape of a winning team', () => {
    const unlocked = ids(
      newlyUnlocked(
        new Set(['first-win']),
        STARTING,
        win({ speciesIds: Array.from({ length: 60 }, (_, index) => [129, 10, 13, 16, 19][index % 5]!), points: 600 }),
      ),
    )
    expect(unlocked).toEqual(expect.arrayContaining(['triplets', 'swarm', 'magikarp']))
    expect(ids(newlyUnlocked(new Set(), STARTING, win({ speciesIds: [150, 150], points: 136 })))).toEqual(
      expect.arrayContaining(['thrifty', 'few']),
    )
  })

  it('counts the hordes beaten towards the long goals', () => {
    const generations = ACHIEVEMENTS.find(({ id }) => id === 'generations')!
    const someBeaten = { ...STARTING, trainingWins: ['horde:gen1:1000', 'horde:gen1:800', 'horde:gen3:1250'] }
    expect(generations.progress!(someBeaten)).toEqual({ done: 2, total: 9 })
    expect(ids(newlyUnlocked(new Set(), someBeaten, null))).toEqual(['hard'])
    const allBeaten = {
      ...STARTING,
      trainingWins: Array.from({ length: 9 }, (_, index) => `horde:gen${index + 1}:1000`),
    }
    expect(ids(newlyUnlocked(new Set(), allBeaten, null))).toContain('generations')
  })

  it('needs a whole team of PokéDate catches for the PokéDate badge', () => {
    expect(ids(newlyUnlocked(new Set(), STARTING, win({ speciesIds: [25, 6], collection: [25, 6, 1] })))).toContain(
      'pokedate',
    )
    expect(ids(newlyUnlocked(new Set(), STARTING, win({ speciesIds: [25, 7], collection: [25, 6] })))).not.toContain(
      'pokedate',
    )
  })

  it('follows streaks, friends and rankings', () => {
    const state = { ...STARTING, dailyStreak: 7, friendWins: 1, bestRank: 2 }
    expect(ids(newlyUnlocked(new Set(), state, null))).toEqual(expect.arrayContaining(['streak-7', 'friend', 'podium']))
    expect(ids(newlyUnlocked(new Set(), state, null))).not.toContain('streak-30')
  })
})
