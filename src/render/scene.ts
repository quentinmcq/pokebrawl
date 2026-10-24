import { Container, type Spritesheet } from 'pixi.js'
import { pokedex } from '../pokedex'
import { createBattle, type TeamSetup } from '../simulation/battle'
import { selectTeam, teamTitle, trimToSameSize } from '../simulation/teams'
import { createArenaView } from './arenaView'
import { createEffectsView } from './effects'
import { createEndBanner } from './endBanner'
import { createHud } from './hud'
import type { Layout } from './layout'
import type { BattleParams } from './params'
import { advancePlayback, createPlayback } from './playback'

// Leaves a moment to take in both crowds before they charge.
const START_DELAY_SECONDS = 1.5

export type Scene = ReturnType<typeof createScene>

export function buildTeams({ teams: [first, second], seed, sameSize }: BattleParams) {
  const teams: [TeamSetup, TeamSetup] = [selectTeam(pokedex, first), selectTeam(pokedex, second)]
  return sameSize ? trimToSameSize(teams, seed) : teams
}

/**
 * Everything drawn for one battle, from the line-up to the winner, so that the next one starts on a clean stage.
 * Turning the screen redraws the scene in the new layout without touching the battle.
 */
export function createScene(params: BattleParams, spritesheet: Spritesheet, initialLayout: Layout) {
  const battle = createBattle({ teams: buildTeams(params), seed: params.seed })
  const teamTitles: [string, string] = [teamTitle(params.teams[0]), teamTitle(params.teams[1])]
  const playback = createPlayback(battle)
  const view = new Container()

  function drawIn(layout: Layout) {
    const arena = createArenaView(playback, spritesheet, params.terrain, params.seed, layout)
    const effects = createEffectsView(playback, params.seed, layout)
    const hud = createHud(battle, teamTitles, layout)
    const endBanner = createEndBanner(battle, teamTitles, layout)
    view.addChild(arena.view, effects.view, hud.view, endBanner.view)
    arena.update()
    return { arena, effects, hud, endBanner }
  }
  let parts = drawIn(initialLayout)

  let waitingSeconds = START_DELAY_SECONDS

  function advance(seconds: number) {
    let remaining = seconds
    if (waitingSeconds > 0) {
      waitingSeconds -= remaining
      if (waitingSeconds > 0) return
      remaining = -waitingSeconds
    }
    advancePlayback(playback, remaining)
    parts.arena.update()
    parts.effects.update()
    parts.hud.update()
    parts.endBanner.update(remaining)
  }

  function clear() {
    parts.arena.destroy()
    for (const child of view.removeChildren()) child.destroy({ children: true })
  }

  function relayout(layout: Layout) {
    clear()
    parts = drawIn(layout)
  }

  function destroy() {
    clear()
    view.destroy()
  }

  return { view, battle, teamTitles, advance, relayout, destroy, isOver: () => battle.outcome !== null }
}
