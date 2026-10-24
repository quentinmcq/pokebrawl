import { describe, expect, it } from 'vitest'
import { pokedex } from '../src/pokedex'
import { createBattle, runBattle, stepBattle, type BattleSetup } from '../src/simulation/battle'
import { selectTeam } from '../src/simulation/teams'

const setupOf = (first: string, second: string, seed = 1): BattleSetup => ({
  teams: [selectTeam(pokedex, first), selectTeam(pokedex, second)],
  seed,
})

describe('battle', () => {
  it('replays exactly the same battle from the same seed', () => {
    const first = runBattle(setupOf('gen1', 'gen2', 42))
    const second = runBattle(setupOf('gen1', 'gen2', 42))
    expect(second.battle.tick).toBe(first.battle.tick)
    expect(second.battle.fighters.map((fighter) => fighter.hp)).toEqual(
      first.battle.fighters.map((fighter) => fighter.hp),
    )
  })

  it('ends with a winner whose survivors are the only fighters left', () => {
    const { result } = runBattle(setupOf('gen1', 'gen3', 7))
    expect(result.outcome).not.toBe('draw')
    const loser = result.outcome === 0 ? 1 : 0
    expect(result.survivors[loser]).toHaveLength(0)
    expect(result.survivors[result.outcome as 0 | 1].length).toBeGreaterThan(0)
  })

  it('lets a legendary beat a Magikarp', () => {
    for (const seed of [1, 2, 3]) {
      expect(runBattle(setupOf('ids:150', 'ids:129', seed)).result.outcome).toBe(0)
    }
  })

  it('counts every knock-out once', () => {
    const { battle } = runBattle(setupOf('type:fire', 'type:water', 3))
    const knockedOut = battle.fighters.filter((fighter) => fighter.hp === 0).length
    expect(battle.fighters.reduce((total, fighter) => total + fighter.knockOuts, 0)).toBe(knockedOut)
  })

  it('keeps every fighter inside the arena', () => {
    const battle = createBattle(setupOf('gen1', 'gen5', 11))
    for (let tick = 0; tick < 200; tick++) stepBattle(battle)
    for (const fighter of battle.fighters) {
      expect(fighter.x).toBeGreaterThanOrEqual(0)
      expect(fighter.x).toBeLessThanOrEqual(36)
      expect(fighter.y).toBeGreaterThanOrEqual(0)
      expect(fighter.y).toBeLessThanOrEqual(64)
    }
  })

  it('spawns the first team at the top and the second at the bottom', () => {
    const battle = createBattle(setupOf('gen1', 'gen3'))
    const topTeam = battle.fighters.filter((fighter) => fighter.team === 0)
    const bottomTeam = battle.fighters.filter((fighter) => fighter.team === 1)
    expect(Math.max(...topTeam.map((fighter) => fighter.y))).toBeLessThan(
      Math.min(...bottomTeam.map((fighter) => fighter.y)),
    )
  })
})
