import { runBattle, type BattleSetup, type Fighter } from './simulation/battle'
import { costOf } from './simulation/cost'
import type { Locale } from './locale'
import { MESSAGES } from './messages'
import { TYPE_NAMES } from './simulation/teams'
import type { TypeKey } from './simulation/types'

// Past these shares, the type matchups explain the battle better than luck does.
const WEAK_HITS_WORTH_A_WORD = 0.3
const STRONG_HITS_TAKEN_WORTH_A_WORD = 0.35
const MAX_LINES = 3

interface SpeciesTally {
  name: string
  copies: number
  points: number
  knockOuts: number
  damage: number
}

/**
 * Why a battle went the way it did, from the first team's side, in a few plain sentences: whether its attacks hit
 * weak spots, which of its types the opponents punished, and which Pokémon were worth their price. Battles replay
 * identically from their setup, so the report replays it rather than recording anything while it plays.
 */
export function battleReport(setup: BattleSetup, locale: Locale) {
  const text = MESSAGES[locale]
  const given = { strong: 0, weak: 0, total: 0 }
  const taken = { strong: 0, total: 0 }
  const strongHitsTakenByType = new Map<TypeKey, number>()

  const { battle } = runBattle(setup, (events, ongoing) => {
    for (const event of events) {
      if (event.kind !== 'hit') continue
      const attacker = ongoing.fighters[event.attacker]!
      if (attacker.team === 0) {
        given.total++
        if (event.multiplier >= 2) given.strong++
        if (event.multiplier < 1) given.weak++
      } else {
        taken.total++
        if (event.multiplier < 2) continue
        taken.strong++
        for (const type of ongoing.fighters[event.target]!.types)
          strongHitsTakenByType.set(type, (strongHitsTakenByType.get(type) ?? 0) + 1)
      }
    }
  })

  const lines: string[] = []
  if (given.total > 0 && given.weak / given.total >= WEAK_HITS_WORTH_A_WORD)
    lines.push(text.weakHits(given.weak / given.total))
  const [mostHitType] = [...strongHitsTakenByType].toSorted(([, a], [, b]) => b - a)
  if (taken.total > 0 && taken.strong / taken.total >= STRONG_HITS_TAKEN_WORTH_A_WORD && mostHitType)
    lines.push(text.strongHitsTaken(taken.strong / taken.total, TYPE_NAMES[locale][mostHitType[0]]))

  const tallies = new Map<number, SpeciesTally>()
  for (const fighter of battle.fighters.filter((candidate: Fighter) => candidate.team === 0)) {
    const tally = tallies.get(fighter.species.id) ?? {
      name: fighter.species.names[locale],
      copies: 0,
      points: 0,
      knockOuts: 0,
      damage: 0,
    }
    tally.copies++
    tally.points += costOf(fighter)
    tally.knockOuts += fighter.knockOuts
    tally.damage += fighter.damageDealt
    tallies.set(fighter.species.id, tally)
  }
  const byValue = [...tallies.values()].toSorted((a, b) => b.damage / b.points - a.damage / a.points)
  const best = byValue[0]
  const worst = byValue.at(-1)
  if (best && best.damage > 0) lines.push(text.bestValue(best.name, best.copies, best.knockOuts, best.points))
  if (worst && worst !== best)
    lines.push(text.worstValue(worst.name, worst.copies, Math.round(worst.damage), worst.points))
  return lines.slice(0, MAX_LINES)
}
