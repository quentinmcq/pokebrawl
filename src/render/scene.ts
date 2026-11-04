import { Container, type Spritesheet } from 'pixi.js'
import { pokedex } from '../pokedex'
import { createBattle, type TeamSetup } from '../simulation/battle'
import { checkNickname } from '../nickname'
import { selectTeam, teamTitle, trimToSameSize } from '../simulation/teams'
import { createArenaView } from './arenaView'
import { createCamera } from './camera'
import { createEffectsView } from './effects'
import { createEndScreen } from './endScreen'
import { createHud } from './hud'
import type { Layout } from './layout'
import type { BattleParams } from './params'
import { advancePlayback, createPlayback, takePendingEvents, type ShownEvent } from './playback'
import { LOCALE, TEXT } from '../ui/i18n'

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
export function createScene(
  params: BattleParams,
  spritesheet: Spritesheet,
  initialLayout: Layout,
  /** Hears every event as the screen shows it, for the sound. */
  onEvents: (events: ShownEvent[]) => void = () => {},
  /** Whether the camera follows the melee, or shows the whole arena. */
  initiallyFollowing = true,
) {
  const battle = createBattle({ teams: buildTeams(params), seed: params.seed })
  const opponent = params.opponentName === null ? null : checkNickname(params.opponentName)
  const teamTitles: [string, string] = [
    teamTitle(params.teams[0], LOCALE),
    opponent ? TEXT.friendTeam(opponent.ok ? opponent.nickname : TEXT.aFriend) : teamTitle(params.teams[1], LOCALE),
  ]
  const playback = createPlayback(battle)
  const view = new Container()

  function drawIn(layout: Layout) {
    const arena = createArenaView(playback, spritesheet, params.terrain, params.seed, layout)
    const effects = createEffectsView(playback, params.seed, layout)
    const hud = createHud(battle, teamTitles, layout)
    const endScreen = createEndScreen(battle, teamTitles, spritesheet, layout)
    const camera = createCamera(playback, layout)
    camera.content.addChild(arena.view, effects.view)
    view.addChild(camera.view, hud.view, endScreen.view)
    arena.update()
    camera.snap(following)
    return { arena, effects, hud, endScreen, camera }
  }
  let following = initiallyFollowing
  let parts = drawIn(initialLayout)
  let endScreenBesideActions = false

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
    parts.camera.update(remaining, following)
    const events = takePendingEvents(playback)
    parts.effects.update(events)
    onEvents(events)
    parts.hud.update()
    parts.endScreen.update(remaining)
  }

  /**
   * Plays the rest of the battle at once, for a player who only wants the outcome: the simulation is deterministic,
   * so the result is the very one the full playback would have shown. Its many effects are dropped, not drawn.
   */
  function skipToEnd() {
    waitingSeconds = 0
    while (battle.outcome === null) advancePlayback(playback, 1)
    takePendingEvents(playback)
    parts.arena.update()
    parts.camera.snap(following)
    parts.hud.update()
  }

  function clear() {
    parts.arena.destroy()
    parts.endScreen.destroy()
    for (const child of view.removeChildren()) child.destroy({ children: true })
  }

  function relayout(layout: Layout) {
    clear()
    parts = drawIn(layout)
    parts.endScreen.setBesideActions(endScreenBesideActions)
  }

  function setEndScreenBesideActions(value: boolean) {
    endScreenBesideActions = value
    parts.endScreen.setBesideActions(value)
  }

  function setFollowing(value: boolean) {
    following = value
    parts.camera.update(0, following)
  }

  function destroy() {
    clear()
    view.destroy()
  }

  return {
    view,
    battle,
    teamTitles,
    advance,
    skipToEnd,
    relayout,
    setEndScreenBesideActions,
    setFollowing,
    destroy,
    isOver: () => battle.outcome !== null,
  }
}
