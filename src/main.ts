import './ui/style.css'
// PixiJS otherwise compiles some of its code with `new Function`, which the Content-Security-Policy forbids.
import 'pixi.js/unsafe-eval'
import { Application, Assets, type Spritesheet } from 'pixi.js'
import { COLORS, createLayout, orientationOf, type Layout } from './render/layout'
import { battleSearch, describesBattle, randomSeed, readBattleParams, type BattleParams } from './render/params'
import { buildTeams, createScene, type Scene } from './render/scene'
import { isAlive, summarizeBattle } from './simulation/battle'
import { terrainForSeed } from './render/terrain'
import { readCollectionHash } from './collection'
import { dailyDayOf } from './daily'
import { readFriendChallenge } from './friend'
import { createAchievements } from './ui/achievementsView'
import { createComposer, isChallenge } from './ui/composer'
import { createEndActions } from './ui/endActions'
import { createControls } from './ui/controls'
import { setUpInstall, isInstalled } from './ui/install'
import { createMenu } from './ui/menu'
import { TEXT, translatePage } from './ui/i18n'
import { createSound } from './ui/sound'
import { track, trackVisit } from './ui/track'
import { createSpriteFactory } from './ui/sprites'
import { readStored, STORAGE_KEYS, writeStored } from './ui/storage'
import { canRecord, recordCanvas, videoBaseName, type Video } from './ui/recorder'
import { createVideoPanel } from './ui/videoPanel'

const windowLayout = () => createLayout(orientationOf(window.innerWidth, window.innerHeight))
const SPEED_KEYS: Record<string, number> = { Digit1: 1, Digit2: 2, Digit4: 4 }
// Challenges get replayed often: they start faster than watched battles, and each remembers its own speed.
const DEFAULT_SPEEDS = { challenge: 2, watch: 1 }
const SPEED_STORAGE_KEY = 'pokebrawl.speeds'
const END_SCREEN_DELAY_SECONDS = 0.8
// The end screen fades in after 1.3 s; the video then holds it for a few seconds before stopping.
const END_SCREEN_HOLD_SECONDS = 4.5

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

// The daily challenge and a friend's are played with their own seed: a new one would be another battle.
const isRerollable = (battle: BattleParams) => !battle.opponentName && !dailyDayOf(battle.teams[1])

function isPlayable(battle: BattleParams) {
  try {
    buildTeams(battle)
    return true
  } catch {
    return false
  }
}

async function start() {
  const spritesheet = await Assets.load<Spritesheet>(`${import.meta.env.BASE_URL}sprites.json`).catch(() => {
    throw new Error('Sprites introuvables : lance « bun run sprites » puis recharge la page.')
  })
  let layout: Layout = windowLayout()
  stage.dataset.orientation = layout.orientation
  const app = new Application()
  await app.init({ width: layout.width, height: layout.height, background: COLORS.background, antialias: true })
  stage.querySelector('.loading')?.remove()
  stage.prepend(app.canvas)

  function applyLayout(next: Layout) {
    if (next.orientation === layout.orientation) return
    layout = next
    stage.dataset.orientation = layout.orientation
    app.renderer.resize(layout.width, layout.height)
    scene?.relayout(layout)
  }
  // A wide window gets the arena turned sideways rather than a narrow strip in the middle of the screen; a video
  // being recorded stays upright whatever happens to the window.
  window.addEventListener('resize', () => {
    if (!recording) applyLayout(windowLayout())
  })

  let recording: { stop: () => Promise<Video>; heldSeconds: number } | null = null
  const sound = createSound()
  // Browsers keep sound off until the page is touched: the first tap anywhere wakes it.
  sound.unlockOnGesture()
  let scene: Scene | null = null
  let params: BattleParams | null = null
  const speeds = { ...DEFAULT_SPEEDS, ...readStored<Partial<typeof DEFAULT_SPEEDS>>(SPEED_STORAGE_KEY, {}) }
  const speedMode = () => (isChallenge(params) ? 'challenge' : 'watch')
  let speed = speeds.watch
  function setSpeed(value: number) {
    speed = value
    speeds[speedMode()] = value
    writeStored(SPEED_STORAGE_KEY, speeds)
    controls.setSpeed(value)
  }
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
    const shown = createScene(next, spritesheet, layout, (events) =>
      sound.play(events, speed, (fighter) => shown.battle.fighters[fighter]!.species.id),
    )
    scene = shown
    app.stage.addChild(scene.view)
    document.title = TEXT.battleTitle(...scene.teamTitles)
  }

  function setPaused(value: boolean) {
    paused = value
    controls.setState(scene?.isOver() ? 'over' : paused ? 'paused' : 'playing')
    void holdScreen(!paused && scene !== null && !scene.isOver())
  }

  const endActions = element('end-actions')
  // The end screen moves aside for the next steps of a challenge, then takes the whole arena again.
  function showEndActions(shown: boolean) {
    endActions.hidden = !shown
    scene?.setEndScreenBesideActions(shown)
  }

  function startBattle(next: BattleParams) {
    params = next
    app.ticker.start()
    track(
      next.opponentName
        ? 'battle-friend'
        : dailyDayOf(next.teams[1])
          ? 'battle-daily'
          : isChallenge(next)
            ? 'battle-training'
            : 'battle-watch',
    )
    history.replaceState(null, '', battleSearch(next))
    showScene(next)
    void sound.loadCries(scene!.battle.fighters.map(({ species }) => species.id))
    speed = speeds[speedMode()]
    controls.setSpeed(speed)
    menu.close()
    composer.close()
    showEndActions(false)
    controls.setBattleKind({ rerollable: isRerollable(next), challenge: isChallenge(next) })
    controls.show()
    setPaused(false)
  }

  // The battle ends here rather than in the ticker, which would not see it change: its end is handled at once.
  function skipToEnd() {
    if (!scene || scene.isOver() || recording) return
    scene.skipToEnd()
    setPaused(false)
    finishBattle()
  }

  const togglePlay = () => (scene?.isOver() && params ? startBattle(params) : setPaused(!paused))

  function leaveBattle() {
    paused = true
    void holdScreen(false)
    controls.hide()
    showEndActions(false)
    history.replaceState(null, '', location.pathname)
    document.title = TEXT.page.title
  }

  function openComposer() {
    install.refresh()
    leaveBattle()
    menu.close()
    composer.open(params)
    // The home screen covers the whole arena: drawing it 60 times a second underneath only slowed scrolling on phones.
    app.ticker.stop()
    // A streak can lapse overnight: the progress shown follows today's state.
    achievements.render()
  }

  function openSpectatorMenu() {
    leaveBattle()
    composer.close()
    app.ticker.start()
    menu.open(isChallenge(params) ? null : params)
  }

  // After a challenge, the settings lead back to the team to improve it; after a watched battle, to its menu.
  const openMenu = () => (isChallenge(params) ? openComposer() : openSpectatorMenu())

  function finishBattle() {
    if (!scene || !params) return
    sound.fanfare(!isChallenge(params) || scene.battle.outcome === 0)
    // The end screen fades in 0.8 s of battle time after the last knock-out.
    sound.champion(summarizeBattle(scene.battle).mostValuable.species.id, END_SCREEN_DELAY_SECONDS / speed)
    if (!isChallenge(params)) return
    const won = scene.battle.outcome === 0
    const survivors = scene.battle.fighters.filter(({ team }) => team === 0).map(isAlive)
    endActionsPanel.fill(params, composer.finish(params, won, survivors), won)
    // The next step replaces the playback controls, which have nothing left to control.
    if (!recording) {
      controls.hide()
      showEndActions(true)
    }
  }

  const spriteOf = createSpriteFactory(spritesheet)
  const achievements = createAchievements(element('composer').querySelector('[data-role="achievements"]')!, spriteOf)
  const install = setUpInstall(element('install-offer'), () =>
    Object.hasOwn(readStored<Record<string, string>>(STORAGE_KEYS.achievements, {}), 'first-win'),
  )
  const endActionsPanel = createEndActions(endActions, achievements, {
    onEdit: openComposer,
    onRematch: () => params && startBattle(withNewSeed(params)),
  })

  const composer = createComposer(element('composer'), {
    spriteOf,
    onFight: startBattle,
    onSpectate: openSpectatorMenu,
  })
  element('menu').querySelector('[data-action="compose"]')!.addEventListener('click', openComposer)

  const menu = createMenu(element<HTMLFormElement>('menu'), {
    onPreview: (preview) => {
      showScene(preview)
      paused = true
    },
    onStart: startBattle,
  })

  const fullscreenAvailable = document.fullscreenEnabled && !isInstalled()
  const toggleFullscreen = () => {
    if (!fullscreenAvailable) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen().catch(() => {})
  }
  // A video always replays the battle from its first second, upright, at the chosen speed.
  function startRecording() {
    if (!params || recording) return
    applyLayout(createLayout('portrait'))
    startBattle(params)
    controls.hide()
    recording = { ...recordCanvas(app.canvas, videoBaseName(params.teams, params.seed)), heldSeconds: 0 }
    videoPanel.showRecording()
  }

  async function stopRecording() {
    if (!recording) return
    const finished = recording
    recording = null
    videoPanel.showVideo(await finished.stop())
    track('video')
    applyLayout(windowLayout())
    controls.show()
    if (scene?.isOver() && isChallenge(params)) {
      controls.hide()
      showEndActions(true)
    }
  }

  const videoPanel = createVideoPanel(element('recording'), element('video-ready'), () => void stopRecording())
  const controls = createControls(element('controls'), stage, {
    onToggle: togglePlay,
    onSpeed: setSpeed,
    onNewBattle: () => {
      if (params && isRerollable(params)) startBattle(withNewSeed(params))
    },
    onMenu: openMenu,
    onFullscreen: toggleFullscreen,
    onRecord: startRecording,
    onSkip: skipToEnd,
    onSound: () => {
      sound.setEnabled(!sound.isEnabled())
      controls.setSound(sound.isEnabled())
    },
  })
  controls.setRecordingAvailable(canRecord())
  controls.setSound(sound.isEnabled())
  controls.setSpeed(speed)
  controls.setFullscreen(fullscreenAvailable, false)
  document.addEventListener('fullscreenchange', () =>
    controls.setFullscreen(fullscreenAvailable, document.fullscreenElement !== null),
  )

  window.addEventListener('keydown', (event) => {
    const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement
    if (typing || !params || !element('menu').hidden || !element('composer').hidden) return
    if (recording) {
      if (event.code === 'Escape') void stopRecording()
      return
    }
    if (event.code === 'Space') togglePlay()
    else if (event.code === 'KeyR') {
      if (isRerollable(params)) startBattle(withNewSeed(params))
    } else if (event.code === 'KeyF') toggleFullscreen()
    else if (event.code === 'KeyS') skipToEnd()
    else if (event.code in SPEED_KEYS) setSpeed(SPEED_KEYS[event.code]!)
    else return
    event.preventDefault()
  })

  app.ticker.add((ticker) => {
    if (!scene || paused) return
    const wasOver = scene.isOver()
    const seconds = (ticker.deltaMS / 1000) * speed
    scene.advance(seconds)
    if (!wasOver && scene.isOver()) {
      setPaused(false)
      finishBattle()
    }
    if (recording && scene.isOver() && (recording.heldSeconds += seconds) >= END_SCREEN_HOLD_SECONDS)
      void stopRecording()
  })

  // Read before the address is tidied up, since it tells where the visitor came from.
  trackVisit()
  const friendChallenge = readFriendChallenge(location.search, TEXT.aFriend)
  const welcomedTeam = new URLSearchParams(location.search).get('equipe')
  function importCollectionFromHash() {
    const collection = readCollectionHash(location.hash)
    if (!collection) return false
    leaveBattle()
    composer.open(null, 'builder')
    composer.importCollection(collection)
    return true
  }
  // A link opened in a tab already showing PokéBrawl only changes the hash, without loading the page again.
  window.addEventListener('hashchange', importCollectionFromHash)

  // A link edited by hand may name a team that does not exist: the home page opens rather than an error.
  const linkedBattle = readBattleParams(location.search)

  // What the address asks for: a PokéDate collection, a Pokémon to enrol, a friend's challenge, a battle to watch.
  function openFromAddress() {
    if (importCollectionFromHash()) return
    if (welcomedTeam) {
      leaveBattle()
      composer.open(null, 'builder')
      composer.welcome(welcomedTeam)
    } else if (friendChallenge) {
      leaveBattle()
      composer.openFriendChallenge(friendChallenge)
    } else if (describesBattle(location.search) && isPlayable(linkedBattle)) startBattle(linkedBattle)
    else openComposer()
  }
  openFromAddress()
}

translatePage()
start().catch((error: unknown) => showError(error instanceof Error ? error.message : String(error)))
