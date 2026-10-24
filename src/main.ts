import './ui/style.css'
import { Application, Assets, type Spritesheet } from 'pixi.js'
import { COLORS, createLayout, orientationOf, type Layout } from './render/layout'
import { battleSearch, describesBattle, randomSeed, readBattleParams, type BattleParams } from './render/params'
import { buildTeams, createScene, type Scene } from './render/scene'
import { battleReport } from './report'
import { terrainForSeed } from './render/terrain'
import { readCollectionHash } from './collection'
import { readFriendChallenge } from './friend'
import { createComposer, isChallenge } from './ui/composer'
import { createControls } from './ui/controls'
import { setUpInstall, isInstalled } from './ui/install'
import { createMenu } from './ui/menu'
import { ordinal, savedNickname, saveNickname, submitScore } from './ui/ranking'
import { shareLink } from './ui/share'
import { createSound } from './ui/sound'
import { createSpriteFactory } from './ui/sprites'
import { readStored, writeStored } from './ui/storage'
import { canRecord, recordCanvas, videoBaseName, type Video } from './ui/recorder'
import { createVideoPanel } from './ui/videoPanel'

const windowLayout = () => createLayout(orientationOf(window.innerWidth, window.innerHeight))
const SPEED_KEYS: Record<string, number> = { Digit1: 1, Digit2: 2, Digit4: 4 }
// Challenges get replayed often: they start faster than watched battles, and each remembers its own speed.
const DEFAULT_SPEEDS = { challenge: 2, watch: 1 }
const SPEED_STORAGE_KEY = 'pokebrawl.speeds'
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
  window.addEventListener('pointerdown', () => sound.isEnabled() && sound.wake(), { once: true })
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
    scene = createScene(next, spritesheet, layout, (events) => sound.play(events, speed))
    app.stage.addChild(scene.view)
    document.title = `${scene.teamTitles[0]} contre ${scene.teamTitles[1]} · PokéBrawl`
  }

  function setPaused(value: boolean) {
    paused = value
    controls.setState(scene?.isOver() ? 'over' : paused ? 'paused' : 'playing')
    void holdScreen(!paused && scene !== null && !scene.isOver())
  }

  const endActions = element('end-actions')

  function startBattle(next: BattleParams) {
    params = next
    history.replaceState(null, '', battleSearch(next))
    showScene(next)
    speed = speeds[speedMode()]
    controls.setSpeed(speed)
    menu.close()
    composer.close()
    endActions.hidden = true
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
    endActions.hidden = true
    history.replaceState(null, '', location.pathname)
  }

  function openComposer() {
    leaveBattle()
    menu.close()
    composer.open(params)
  }

  function openSpectatorMenu() {
    leaveBattle()
    composer.close()
    menu.open(isChallenge(params) ? null : params)
  }

  // After a challenge, the settings lead back to the team to improve it; after a watched battle, to its menu.
  const openMenu = () => (isChallenge(params) ? openComposer() : openSpectatorMenu())

  const shareButton = endActions.querySelector<HTMLButtonElement>('[data-action="share"]')!
  const resultLine = endActions.querySelector<HTMLElement>('[data-role="result"]')!
  const reportList = endActions.querySelector<HTMLElement>('[data-role="report"]')!
  const publishForm = endActions.querySelector<HTMLFormElement>('[data-role="publish"]')!
  const publishError = publishForm.querySelector<HTMLElement>('[data-role="publish-error"]')!
  let publishable: { day: string; team: string } | null = null
  let resultMessage = ''

  // Sends today's win to the ranking under the saved nickname, and adds the rank to the result line.
  async function publish(name: string) {
    if (!publishable) return
    publishError.hidden = true
    const outcome = await submitScore(publishable.day, name, publishable.team)
    if ('error' in outcome) {
      publishError.textContent = outcome.error ?? ''
      publishError.hidden = false
      publishForm.hidden = false
      return
    }
    saveNickname(name)
    publishForm.hidden = true
    const { you, total } = outcome.ranking
    if (you) resultLine.textContent = `${resultMessage} · ${ordinal(you.rank)} sur ${total}`
  }
  publishForm.addEventListener('submit', (event) => {
    event.preventDefault()
    void publish(new FormData(publishForm).get('nickname')?.toString() ?? '')
  })

  let share: { text: string; url: string } | null = null

  function finishBattle() {
    if (!scene || !params) return
    sound.fanfare(!isChallenge(params) || scene.battle.outcome === 0)
    if (!isChallenge(params)) return
    const result = composer.finish(params, scene.battle.outcome === 0)
    share = result.shareText === null ? null : { text: result.shareText, url: result.shareUrl }
    publishable = result.publishable
    resultMessage = result.message ?? ''
    resultLine.textContent = result.message
    publishError.hidden = true
    const nickname = savedNickname()
    publishForm.hidden = publishable === null || nickname !== null
    if (publishable && nickname) void publish(nickname)
    resultLine.hidden = result.message === null
    const report = battleReport({ teams: buildTeams(params), seed: params.seed })
    reportList.replaceChildren(
      ...report.map((line) => Object.assign(document.createElement('li'), { textContent: line })),
    )
    reportList.hidden = report.length === 0
    shareButton.hidden = share === null
    shareButton.textContent = params.opponentName ? 'Renvoyer le défi' : 'Partager'
    // The daily seed is fixed: the same team would only replay the same battle.
    endActions.querySelector<HTMLElement>('[data-action="rematch"]')!.hidden = result.daily
    // The next step replaces the playback controls, which have nothing left to control.
    if (!recording) {
      controls.hide()
      endActions.hidden = false
    }
  }

  async function shareResult() {
    if (!share) return
    if ((await shareLink(share.text, share.url)) === 'copied') shareButton.textContent = 'Lien copié\u00a0!'
  }

  const composer = createComposer(element('composer'), {
    spriteOf: createSpriteFactory(spritesheet),
    onFight: startBattle,
    onSpectate: openSpectatorMenu,
  })
  element('menu').querySelector('[data-action="compose"]')!.addEventListener('click', openComposer)
  endActions.querySelector('[data-action="edit"]')!.addEventListener('click', openComposer)
  shareButton.addEventListener('click', () => void shareResult())
  endActions.querySelector('[data-action="rematch"]')!.addEventListener('click', () => {
    if (params) startBattle(withNewSeed(params))
  })

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
    applyLayout(windowLayout())
    controls.show()
    if (scene?.isOver() && isChallenge(params)) {
      controls.hide()
      endActions.hidden = false
    }
  }

  const videoPanel = createVideoPanel(element('recording'), element('video-ready'), () => void stopRecording())
  const controls = createControls(element('controls'), stage, {
    onToggle: togglePlay,
    onSpeed: setSpeed,
    onNewBattle: () => params && startBattle(withNewSeed(params)),
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
    else if (event.code === 'KeyR') startBattle(withNewSeed(params))
    else if (event.code === 'KeyF') toggleFullscreen()
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

  setUpInstall(element('install'), element('ios-install'))
  const friendChallenge = readFriendChallenge(location.search)
  const welcomedTeam = new URLSearchParams(location.search).get('equipe')
  function importCollectionFromHash() {
    const collection = readCollectionHash(location.hash)
    if (!collection) return false
    leaveBattle()
    composer.open(null)
    composer.importCollection(collection)
    return true
  }
  // A link opened in a tab already showing PokéBrawl only changes the hash, without loading the page again.
  window.addEventListener('hashchange', importCollectionFromHash)

  // What the address asks for: a PokéDate collection, a Pokémon to enrol, a friend's challenge, a battle to watch.
  function openFromAddress() {
    if (importCollectionFromHash()) return
    if (welcomedTeam) {
      leaveBattle()
      composer.open(null)
      composer.welcome(welcomedTeam)
    } else if (friendChallenge) {
      leaveBattle()
      composer.openFriendChallenge(friendChallenge)
    } else if (describesBattle(location.search)) startBattle(readBattleParams(location.search))
    else openComposer()
  }
  openFromAddress()
}

start().catch((error: unknown) => showError(error instanceof Error ? error.message : String(error)))
