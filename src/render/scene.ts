import { Container, type Spritesheet } from 'pixi.js'
import { pokedex } from '../pokedex'
import { createBattle, type TeamSetup } from '../simulation/battle'
import { selectTeam, teamTitle, trimToSameSize } from '../simulation/teams'
import { createArenaView } from './arenaView'
import { createEffectsView } from './effects'
import { createEndBanner } from './endBanner'
import { createHud } from './hud'
import type { BattleParams } from './params'
import { advancePlayback, createPlayback } from './playback'

// Leaves a moment to take in both crowds before they charge.
const START_DELAY_SECONDS = 1.5

export type Scene = ReturnType<typeof createScene>

export function buildTeams({ teams: [first, second], seed, sameSize }: BattleParams) {
  const teams: [TeamSetup, TeamSetup] = [selectTeam(pokedex, first), selectTeam(pokedex, second)]
  return sameSize ? trimToSameSize(teams, seed) : teams
}

/** Everything drawn for one battle, from the line-up to the winner, so that the next one starts on a clean stage. */
export function createScene(params: BattleParams, spritesheet: Spritesheet) {
  const battle = createBattle({ teams: buildTeams(params), seed: params.seed })
  const teamTitles: [string, string] = [teamTitle(params.teams[0]), teamTitle(params.teams[1])]
  const playback = createPlayback(battle)
  const arena = createArenaView(playback, spritesheet, params.terrain, params.seed)
  const effects = createEffectsView(playback, params.seed)
  const hud = createHud(battle, teamTitles)
  const endBanner = createEndBanner(battle, teamTitles)
  const view = new Container()
  view.addChild(arena.view, effects.view, hud.view, endBanner.view)
  arena.update()

  let waitingSeconds = START_DELAY_SECONDS

  function advance(seconds: number) {
    let remaining = seconds
    if (waitingSeconds > 0) {
      waitingSeconds -= remaining
      if (waitingSeconds > 0) return
      remaining = -waitingSeconds
    }
    advancePlayback(playback, remaining)
    arena.update()
    effects.update()
    hud.update()
    endBanner.update(remaining)
  }

  function destroy() {
    arena.destroy()
    view.destroy({ children: true })
  }

  return { view, battle, teamTitles, advance, destroy, isOver: () => battle.outcome !== null }
}
