import { Application, Assets, type Spritesheet } from 'pixi.js'
import { pokedex } from '../pokedex'
import { createBattle } from '../simulation/battle'
import { selectTeam, teamTitle } from '../simulation/teams'
import { createArenaView } from './arenaView'
import { createEndBanner } from './endBanner'
import { createHud } from './hud'
import { CANVAS_HEIGHT, CANVAS_WIDTH, COLORS } from './layout'
import { battleSearch, randomSeed, readBattleParams } from './params'
import { advancePlayback, createPlayback } from './playback'

// Leaves a moment to take in both crowds before they charge.
const START_DELAY_SECONDS = 1.5
const SPEED_KEYS: Record<string, number> = { Digit1: 1, Digit2: 2, Digit4: 4 }

function showError(message: string) {
  const paragraph = document.createElement('p')
  paragraph.className = 'error'
  paragraph.textContent = message
  document.body.replaceChildren(paragraph)
}

async function start() {
  const params = readBattleParams(location.search)
  history.replaceState(null, '', battleSearch(params))
  const [first, second] = params.teams
  const battle = createBattle({ teams: [selectTeam(pokedex, first), selectTeam(pokedex, second)], seed: params.seed })
  const teamTitles: [string, string] = [teamTitle(first), teamTitle(second)]
  document.title = `${teamTitles[0]} contre ${teamTitles[1]} · PokéBrawl`

  const spritesheet = await Assets.load<Spritesheet>(`${import.meta.env.BASE_URL}sprites.json`).catch(() => {
    throw new Error('Sprites introuvables : lance « bun run sprites » puis recharge la page.')
  })

  const app = new Application()
  await app.init({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, background: COLORS.background, antialias: true })
  document.body.replaceChildren(app.canvas)

  const playback = createPlayback(battle)
  const arena = createArenaView(playback, spritesheet)
  const hud = createHud(battle, teamTitles)
  const endBanner = createEndBanner(battle, teamTitles)
  app.stage.addChild(arena.view, hud.view, endBanner.view)

  let speed = 1
  let paused = false
  let waitingSeconds = START_DELAY_SECONDS
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') paused = !paused
    else if (event.code === 'KeyR') location.search = battleSearch({ ...params, seed: randomSeed() })
    else if (event.code in SPEED_KEYS) speed = SPEED_KEYS[event.code]!
    else return
    event.preventDefault()
  })

  app.ticker.add((ticker) => {
    if (paused) return
    let seconds = (ticker.deltaMS / 1000) * speed
    if (waitingSeconds > 0) {
      waitingSeconds -= seconds
      if (waitingSeconds > 0) return
      seconds = -waitingSeconds
    }
    advancePlayback(playback, seconds)
    arena.update()
    hud.update()
    endBanner.update(seconds)
  })
  arena.update()
}

start().catch((error: unknown) => showError(error instanceof Error ? error.message : String(error)))
