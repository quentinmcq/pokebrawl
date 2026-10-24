import { runBattle, type BattleSetup, type Fighter } from './simulation/battle'
import { costOf } from './simulation/cost'
import { TYPE_NAMES_FR } from './simulation/teams'
import type { TypeKey } from './simulation/types'

// Past these shares, the type matchups explain the battle better than luck does.
const WEAK_HITS_WORTH_A_WORD = 0.3
const STRONG_HITS_TAKEN_WORTH_A_WORD = 0.35
const MAX_LINES = 3

const percent = (share: number) => `${Math.round(share * 100)} %`

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
export function battleReport(setup: BattleSetup) {
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
    lines.push(
      `${percent(given.weak / given.total)} de tes attaques étaient peu efficaces ou sans effet : vise les faiblesses de l’adversaire.`,
    )
  const [mostHitType] = [...strongHitsTakenByType].toSorted(([, a], [, b]) => b - a)
  if (taken.total > 0 && taken.strong / taken.total >= STRONG_HITS_TAKEN_WORTH_A_WORD && mostHitType)
    lines.push(
      `${percent(taken.strong / taken.total)} des coups reçus étaient super efficaces, surtout sur tes Pokémon ${TYPE_NAMES_FR[mostHitType[0]]}.`,
    )

  const tallies = new Map<number, SpeciesTally>()
  for (const fighter of battle.fighters.filter((candidate: Fighter) => candidate.team === 0)) {
    const tally = tallies.get(fighter.species.id) ?? {
      name: fighter.species.names.fr,
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
  if (best && best.damage > 0)
    lines.push(
      `Meilleur rapport : ${best.name}${best.copies > 1 ? ` (×${best.copies})` : ''}, ${best.knockOuts} K.O. pour ${best.points} points.`,
    )
  if (worst && worst !== best)
    lines.push(
      `Le moins rentable : ${worst.name}${worst.copies > 1 ? ` (×${worst.copies})` : ''}, ${Math.round(worst.damage)} dégâts pour ${worst.points} points.`,
    )
  return lines.slice(0, MAX_LINES)
}
