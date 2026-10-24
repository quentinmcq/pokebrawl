import { parseArgs } from 'node:util'
import { pokedex } from '../src/pokedex'
import {
  runBattle,
  secondsAt,
  type Battle,
  type BattleEvent,
  type Fighter,
  type TeamSetup,
} from '../src/simulation/battle'
import { selectTeam, trimToSameSize } from '../src/simulation/teams'

const { values: options } = parseArgs({
  options: {
    a: { type: 'string', default: 'gen1' },
    b: { type: 'string', default: 'gen3' },
    // Every Pokémon of each team, rather than as many on each side as on the smaller one.
    full: { type: 'boolean', default: false },
    seed: { type: 'string', default: String(Date.now() % 1_000_000) },
    log: { type: 'boolean', default: false },
  },
})

const seed = Number(options.seed)
const selectedTeams = [selectTeam(pokedex, options.a), selectTeam(pokedex, options.b)] as [TeamSetup, TeamSetup]
const teams = options.full ? selectedTeams : trimToSameSize(selectedTeams, seed)
const TIMELINE_INTERVAL_SECONDS = 10
const LAST_KNOCK_OUTS_SHOWN = 5

const clock = (tick: number) => {
  const seconds = Math.floor(secondsAt(tick))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
const nameOf = (fighter: Fighter) => fighter.species.names.fr
const teamOf = (battle: Battle, fighter: Fighter) => battle.teamLabels[fighter.team]
const aliveCount = (battle: Battle, team: 0 | 1) =>
  battle.fighters.filter((fighter) => fighter.team === team && fighter.hp > 0).length

function describe(event: BattleEvent, battle: Battle) {
  const fighter = (index: number) => battle.fighters[index]!
  switch (event.kind) {
    case 'hit': {
      const notes = [
        event.multiplier === 0 && 'sans effet',
        event.multiplier >= 2 && `super efficace ×${event.multiplier}`,
        event.multiplier > 0 && event.multiplier < 1 && 'peu efficace',
        event.critical && 'coup critique',
      ].filter(Boolean)
      const suffix = notes.length > 0 ? ` (${notes.join(', ')})` : ''
      return `${nameOf(fighter(event.attacker))} → ${event.move.names.fr} → ${nameOf(fighter(event.target))} : −${event.damage} PV${suffix}`
    }
    case 'miss':
      return `${nameOf(fighter(event.attacker))} rate ${event.move.names.fr} sur ${nameOf(fighter(event.target))}`
    case 'knockOut':
      return `${nameOf(fighter(event.fighter))} (${teamOf(battle, fighter(event.fighter))}) est K.O., battu par ${nameOf(fighter(event.by))}`
  }
}

console.info(
  `\n${teams[0].label} (${teams[0].fighters.length}) contre ${teams[1].label} (${teams[1].fighters.length}) — graine ${seed}\n`,
)

const knockOutLines: string[] = []
let firstKnockOutShown = false
let nextTimelineSeconds = TIMELINE_INTERVAL_SECONDS
const startedAt = performance.now()

const { battle, result } = runBattle({ teams, seed }, (events, ongoingBattle) => {
  for (const event of events) {
    const line = `  ${clock(event.tick)}  ${describe(event, ongoingBattle)}`
    if (options.log) console.info(line)
    if (event.kind !== 'knockOut') continue
    knockOutLines.push(line)
    if (!firstKnockOutShown && !options.log) console.info(`${line}  ← premier K.O.`)
    firstKnockOutShown = true
  }
  if (!options.log && secondsAt(ongoingBattle.tick) >= nextTimelineSeconds) {
    console.info(
      `  ${clock(ongoingBattle.tick)}  ${ongoingBattle.teamLabels[0]} ${aliveCount(ongoingBattle, 0)} · ${ongoingBattle.teamLabels[1]} ${aliveCount(ongoingBattle, 1)}`,
    )
    nextTimelineSeconds += TIMELINE_INTERVAL_SECONDS
  }
})

if (!options.log) {
  console.info('\nDerniers K.O. :')
  knockOutLines.slice(-LAST_KNOCK_OUTS_SHOWN).forEach((line) => console.info(line))
}

const winnerText = result.outcome === 'draw' ? 'Match nul' : `Victoire de ${battle.teamLabels[result.outcome]}`
const survivors = result.outcome === 'draw' ? [] : result.survivors[result.outcome]
console.info(`\n${winnerText} en ${clock(battle.tick)}, ${survivors.length} survivant(s)`)
if (survivors.length > 0 && survivors.length <= 20) console.info(`Survivants : ${survivors.map(nameOf).join(', ')}`)

console.info('\nMeilleurs combattants :')
battle.fighters
  .toSorted((a, b) => b.knockOuts - a.knockOuts || b.damageDealt - a.damageDealt)
  .slice(0, 5)
  .forEach((fighter, rank) =>
    console.info(
      `  ${rank + 1}. ${nameOf(fighter)} (${teamOf(battle, fighter)}) — ${fighter.knockOuts} K.O., ${fighter.damageDealt} dégâts`,
    ),
  )
console.info(`\nSimulé en ${Math.round(performance.now() - startedAt)} ms`)
