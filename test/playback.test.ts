import { describe, expect, it } from 'vitest'
import { pokedex } from '../src/pokedex'
import {
  advancePlayback,
  createPlayback,
  displayedPosition,
  SECONDS_PER_TICK,
  takePendingEvents,
} from '../src/render/playback'
import { createBattle, runBattle, type BattleSetup } from '../src/simulation/battle'
import { selectTeam } from '../src/simulation/teams'

const setup = (): BattleSetup => ({ teams: [selectTeam(pokedex, 'gen1'), selectTeam(pokedex, 'gen3')], seed: 42 })

describe('playback', () => {
  it('advances the battle at its own pace whatever the frame rate', () => {
    const playback = createPlayback(createBattle(setup()))
    // A little over one second, so that rounding in the frame durations cannot drop the last tick.
    for (let frame = 0; frame < 61; frame++) advancePlayback(playback, 1 / 60)
    expect(playback.battle.tick).toBe(20)
  })

  it('draws fighters between their previous and current positions', () => {
    const playback = createPlayback(createBattle(setup()))
    // One tick at a time: a single long advance would hit the cap on ticks per frame.
    for (let tick = 0; tick < 30; tick++) advancePlayback(playback, SECONDS_PER_TICK)
    advancePlayback(playback, SECONDS_PER_TICK / 2)
    const fighter = playback.battle.fighters.find((candidate) => {
      const previous = playback.previousPositions[candidate.index]!
      return previous.x !== candidate.x || previous.y !== candidate.y
    })!
    const previous = playback.previousPositions[fighter.index]!
    const position = displayedPosition(playback, fighter)
    expect(position.x).toBeCloseTo((previous.x + fighter.x) / 2)
    expect(position.y).toBeCloseTo((previous.y + fighter.y) / 2)
  })

  it('plays the same battle as the simulation alone', () => {
    const playback = createPlayback(createBattle(setup()))
    while (playback.battle.outcome === null) advancePlayback(playback, 1 / 60)
    const { battle } = runBattle(setup())
    expect(playback.battle.tick).toBe(battle.tick)
    expect(playback.battle.outcome).toBe(battle.outcome)
  })

  it('hands over each event once, with special attacks taking time to land', () => {
    const playback = createPlayback(createBattle(setup()))
    for (let frame = 0; frame < 15 * 60; frame++) advancePlayback(playback, 1 / 60)
    const shown = takePendingEvents(playback)
    expect(takePendingEvents(playback)).toEqual([])
    const attacks = shown.flatMap((item) =>
      item.event.kind === 'knockOut' ? [] : [{ ...item, move: item.event.move }],
    )
    expect(attacks.some(({ move, travelSeconds }) => move.category === 'special' && travelSeconds > 0)).toBe(true)
    expect(
      attacks.filter(({ move }) => move.category === 'physical').every(({ travelSeconds }) => travelSeconds === 0),
    ).toBe(true)
  })
})
