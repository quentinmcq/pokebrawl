import { stepBattle, TICKS_PER_SECOND, type Battle, type BattleEvent, type Fighter } from '../simulation/battle'
import type { Move } from '../simulation/types'

export const SECONDS_PER_TICK = 1 / TICKS_PER_SECOND
// A frame arriving after a long pause (hidden tab) would otherwise replay seconds of battle in one go.
const MAX_TICKS_PER_ADVANCE = 20
/** Units per second: even from the far end of its reach, a special attack lands within a quarter of a second. */
export const PROJECTILE_SPEED = 30

/** Special attacks fly to their target, physical ones land at once: the target reacts when the blow arrives. */
export const travelSecondsOf = (move: Move, distance: number) =>
  move.category === 'special' ? distance / PROJECTILE_SPEED : 0

/** An event as the screen shows it: where the attacker stood and how long its attack takes to land. */
export interface ShownEvent {
  event: BattleEvent
  from: { x: number; y: number }
  travelSeconds: number
}

export interface FighterEffects {
  attackedAtTick: number | null
  attackTarget: number | null
  hurtAtTick: number | null
  hurtDelaySeconds: number
  knockOutDelaySeconds: number
}

/**
 * Plays a battle in real time for the screen: the simulation keeps its fixed 20 steps per second while the display,
 * at 60 frames per second or more, draws each fighter between its previous and current positions.
 */
export interface Playback {
  battle: Battle
  previousPositions: { x: number; y: number }[]
  effects: FighterEffects[]
  /** Keeps counting once the battle is over, so that the last knock-outs and the end screen still animate. */
  clockTick: number
  secondsIntoTick: number
  /** Events since the display last took them, for the attack effects. */
  pendingEvents: ShownEvent[]
}

export function createPlayback(battle: Battle): Playback {
  return {
    battle,
    previousPositions: battle.fighters.map(({ x, y }) => ({ x, y })),
    effects: battle.fighters.map(() => ({
      attackedAtTick: null,
      attackTarget: null,
      hurtAtTick: null,
      hurtDelaySeconds: 0,
      knockOutDelaySeconds: 0,
    })),
    clockTick: battle.tick,
    secondsIntoTick: 0,
    pendingEvents: [],
  }
}

function step(playback: Playback) {
  const { battle, previousPositions, effects } = playback
  battle.fighters.forEach((fighter, index) => {
    previousPositions[index]!.x = fighter.x
    previousPositions[index]!.y = fighter.y
  })
  for (const event of stepBattle(battle)) {
    if (event.kind === 'knockOut') {
      const delay = effects[event.fighter]!.hurtDelaySeconds
      effects[event.fighter]!.knockOutDelaySeconds = delay
      const { x, y } = battle.fighters[event.fighter]!
      playback.pendingEvents.push({ event, from: { x, y }, travelSeconds: delay })
      continue
    }
    const attacker = battle.fighters[event.attacker]!
    const target = battle.fighters[event.target]!
    const travelSeconds = travelSecondsOf(event.move, Math.hypot(target.x - attacker.x, target.y - attacker.y))
    playback.pendingEvents.push({ event, from: { x: attacker.x, y: attacker.y }, travelSeconds })
    effects[event.attacker]!.attackedAtTick = event.tick
    effects[event.attacker]!.attackTarget = event.target
    if (event.kind === 'hit' && event.damage > 0) {
      effects[event.target]!.hurtAtTick = event.tick
      effects[event.target]!.hurtDelaySeconds = travelSeconds
    }
  }
  playback.clockTick++
}

export function advancePlayback(playback: Playback, seconds: number) {
  playback.secondsIntoTick += seconds
  let ticks = 0
  while (playback.secondsIntoTick >= SECONDS_PER_TICK && ticks < MAX_TICKS_PER_ADVANCE) {
    playback.secondsIntoTick -= SECONDS_PER_TICK
    step(playback)
    ticks++
  }
  playback.secondsIntoTick = Math.min(playback.secondsIntoTick, SECONDS_PER_TICK)
}

const progressInTick = (playback: Playback) => playback.secondsIntoTick / SECONDS_PER_TICK

export function displayedPosition(playback: Playback, fighter: Fighter) {
  const previous = playback.previousPositions[fighter.index]!
  const progress = progressInTick(playback)
  return {
    x: previous.x + (fighter.x - previous.x) * progress,
    y: previous.y + (fighter.y - previous.y) * progress,
  }
}

/** Hands over the events since the last call, oldest first. */
export function takePendingEvents(playback: Playback) {
  const events = playback.pendingEvents
  playback.pendingEvents = []
  return events
}

/** Time elapsed on screen since something happened at `tick`, or `null` if it never happened. */
export function secondsSince(playback: Playback, tick: number | null) {
  if (tick === null) return null
  return (playback.clockTick - tick + progressInTick(playback)) * SECONDS_PER_TICK
}
