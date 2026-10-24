import './ui/style.css'
import { Application, Assets, type Spritesheet } from 'pixi.js'
import { CANVAS_HEIGHT, CANVAS_WIDTH, COLORS } from './render/layout'
import { battleSearch, describesBattle, randomSeed, readBattleParams, type BattleParams } from './render/params'
import { createScene, type Scene } from './render/scene'
import { terrainForSeed } from './render/terrain'
import { createControls } from './ui/controls'
import { createMenu } from './ui/menu'

const SPEED_KEYS: Record<string, number> = { Digit1: 1, Digit2: 2, Digit4: 4 }

const element = <Element extends HTMLElement>(id: string) => document.getElementById(id) as Element
const stage = element<HTMLElement>('stage')

function showError(message: string) {
  const paragraph = document.createElement('p')
  paragraph.className = 'error'
  paragraph.textContent = message
  stage.replaceChildren(paragraph)
}

// A fresh seed keeps a chosen terrain but rerolls one that only followed from the previous seed.
function withNewSeed(params: BattleParams): BattleParams {
  const seed = randomSeed()
  const terrain = params.terrain === terrainForSeed(params.seed) ? terrainForSeed(seed) : params.terrain
  return { ...params, seed, terrain }
}

async function start() {
  const spritesheet = await Assets.load<Spritesheet>(`${import.meta.env.BASE_URL}sprites.json`).catch(() => {
    throw new Error('Sprites introuvables : lance « bun run sprites » puis recharge la page.')
  })
  const app = new Application()
  await app.init({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, background: COLORS.background, antialias: true })
  stage.querySelector('.loading')?.remove()
  stage.prepend(app.canvas)

  let scene: Scene | null = null
  let params: BattleParams | null = null
  let speed = 1
  let paused = false
  let wakeLock: WakeLockSentinel | null = null

  // Keeps the phone screen on while a battle plays; the browser drops the lock whenever the page is hidden.
  async function holdScreen(hold: boolean) {
    if (!hold) {
      await wakeLock?.release().catch(() => {})
      wakeLock = null
      return
    }
    if (wakeLock || !('wakeLock' in navigator)) return
    wakeLock = await navigator.wakeLock.request('screen').catch(() => null)
    wakeLock?.addEventListener('release', () => (wakeLock = null))
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void holdScreen(scene !== null && !paused && !scene.isOver())
  })

  function showScene(next: BattleParams) {
    scene?.destroy()
    scene = createScene(next, spritesheet)
    app.stage.addChild(scene.view)
    document.title = `${scene.teamTitles[0]} contre ${scene.teamTitles[1]} · PokéBrawl`
  }

  function setPaused(value: boolean) {
    paused = value
    controls.setState(scene?.isOver() ? 'over' : paused ? 'paused' : 'playing')
    void holdScreen(!paused && scene !== null && !scene.isOver())
  }

  function startBattle(next: BattleParams) {
    params = next
    history.replaceState(null, '', battleSearch(next))
    showScene(next)
    menu.close()
    controls.show()
    setPaused(false)
  }

  const togglePlay = () => (scene?.isOver() && params ? startBattle(params) : setPaused(!paused))

  function openMenu() {
    paused = true
    void holdScreen(false)
    controls.hide()
    history.replaceState(null, '', location.pathname)
    menu.open(params)
  }

  const menu = createMenu(element<HTMLFormElement>('menu'), {
    onPreview: (preview) => {
      showScene(preview)
      paused = true
    },
    onStart: startBattle,
  })

  const fullscreenAvailable = document.fullscreenEnabled
  const toggleFullscreen = () => {
    if (!fullscreenAvailable) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen().catch(() => {})
  }
  const controls = createControls(element('controls'), stage, {
    onToggle: togglePlay,
    onSpeed: (value) => controls.setSpeed((speed = value)),
    onNewBattle: () => params && startBattle(withNewSeed(params)),
    onMenu: openMenu,
    onFullscreen: toggleFullscreen,
  })
  controls.setSpeed(speed)
  controls.setFullscreen(fullscreenAvailable, false)
  document.addEventListener('fullscreenchange', () =>
    controls.setFullscreen(fullscreenAvailable, document.fullscreenElement !== null),
  )

  window.addEventListener('keydown', (event) => {
    const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement
    if (typing || !params || !element('menu').hidden) return
    if (event.code === 'Space') togglePlay()
    else if (event.code === 'KeyR') startBattle(withNewSeed(params))
    else if (event.code === 'KeyF') toggleFullscreen()
    else if (event.code in SPEED_KEYS) controls.setSpeed((speed = SPEED_KEYS[event.code]!))
    else return
    event.preventDefault()
  })

  app.ticker.add((ticker) => {
    if (!scene || paused) return
    const wasOver = scene.isOver()
    scene.advance((ticker.deltaMS / 1000) * speed)
    if (!wasOver && scene.isOver()) setPaused(false)
  })

  if (describesBattle(location.search)) startBattle(readBattleParams(location.search))
  else openMenu()
}

start().catch((error: unknown) => showError(error instanceof Error ? error.message : String(error)))
