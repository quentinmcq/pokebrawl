import { TEXT } from './i18n'
import { slideSegmented } from './segmented'

// Stroke icons in a 24 × 24 grid, after the Lucide set.
const ICONS = {
  leave: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  replay: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  shuffle:
    '<path d="m18 14 4 4-4 4"/><path d="m18 2 4 4-4 4"/><path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/>',
  settings: '<path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4"/>',
  enterFullscreen:
    '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
  skip: '<path d="M5 4l10 8-10 8z"/><path d="M19 5v14"/>',
  soundOn: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/>',
  soundOff: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/>',
  record: '<circle cx="12" cy="12" r="7" fill="currentColor" stroke="none"/>',
  exitFullscreen:
    '<path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/>',
  more: '<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
}
// The bar fades away during the battle so that it never hides the action, and comes back on the next touch.
const IDLE_DELAY_MS = 2500
const MOUSE_ZONE_SHARE = 0.25

type PlayState = 'playing' | 'paused' | 'over'

interface ControlHandlers {
  onLeave: () => void
  onToggle: () => void
  onSpeed: (speed: number) => void
  onNewBattle: () => void
  onMenu: () => void
  onFullscreen: () => void
  onRecord: () => void
  onSkip: () => void
  onSound: () => void
}

const icon = (name: keyof typeof ICONS) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`
const setIcon = (target: HTMLButtonElement, name: keyof typeof ICONS) => {
  target.querySelector('svg')?.remove()
  target.insertAdjacentHTML('afterbegin', icon(name))
}

/**
 * The touch-friendly bar over the arena; it lives outside the canvas, so a recorded video never shows it. Only what a
 * battle needs at a glance sits in the bar (leave, pause, speed, result); the rest goes in a menu where each action
 * says its name.
 */
export function createControls(nav: HTMLElement, stage: HTMLElement, handlers: ControlHandlers) {
  const button = (action: string) => nav.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!
  const label = (role: string) => nav.querySelector<HTMLElement>(`[data-role="${role}"]`)!
  const toggleButton = button('toggle')
  const moreButton = button('more')
  const moreMenu = nav.querySelector<HTMLElement>('.more-menu')!
  const speedButtons = [...nav.querySelectorAll<HTMLButtonElement>('[data-speed]')]
  setIcon(button('leave'), 'leave')
  setIcon(button('skip'), 'skip')
  setIcon(moreButton, 'more')
  setIcon(button('new'), 'shuffle')
  setIcon(button('record'), 'record')
  setIcon(button('menu'), 'settings')
  let state: PlayState = 'playing'
  let idleTimer: ReturnType<typeof setTimeout> | undefined

  function setMenuOpen(open: boolean) {
    moreMenu.hidden = !open
    moreButton.ariaExpanded = String(open)
  }

  nav.addEventListener('click', (event) => {
    const target = (event.target as Element).closest('button')
    if (!target) return
    const action = target.dataset.action
    if (action === 'more') setMenuOpen(moreButton.ariaExpanded !== 'true')
    else setMenuOpen(false)
    if (target.dataset.speed) handlers.onSpeed(Number(target.dataset.speed))
    else if (action === 'leave') handlers.onLeave()
    else if (action === 'toggle') handlers.onToggle()
    else if (action === 'new') handlers.onNewBattle()
    else if (action === 'menu') handlers.onMenu()
    else if (action === 'fullscreen') handlers.onFullscreen()
    else if (action === 'record') handlers.onRecord()
    else if (action === 'skip') handlers.onSkip()
    else if (action === 'sound') handlers.onSound()
    wake()
  })

  // The bar stays while its menu is open, and fades away again once the battle goes on.
  function wake() {
    nav.classList.remove('is-idle')
    clearTimeout(idleTimer)
    if (state === 'playing')
      idleTimer = setTimeout(() => {
        setMenuOpen(false)
        nav.classList.add('is-idle')
      }, IDLE_DELAY_MS)
  }
  stage.addEventListener('pointerdown', (event) => {
    if (nav.hidden || nav.contains(event.target as Node)) return
    setMenuOpen(false)
    wake()
  })
  // A mouse moves all the time over a computer screen: only nearing the bottom, where the bar sits, brings it back.
  stage.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' || nav.hidden) return
    const { top, height } = stage.getBoundingClientRect()
    if (event.clientY - top > height * (1 - MOUSE_ZONE_SHARE) || nav.contains(event.target as Node)) wake()
  })

  function setState(next: PlayState) {
    state = next
    setIcon(toggleButton, state === 'playing' ? 'pause' : state === 'paused' ? 'play' : 'replay')
    toggleButton.ariaLabel = state === 'playing' ? TEXT.page.pause : state === 'paused' ? TEXT.resume : TEXT.replay
    button('skip').hidden = state === 'over'
    wake()
  }

  function setSpeed(speed: number) {
    for (const speedButton of speedButtons)
      speedButton.ariaPressed = String(Number(speedButton.dataset.speed) === speed)
    slideSegmented(speedButtons[0]!.parentElement!)
  }

  function setFullscreen(available: boolean, active: boolean) {
    button('fullscreen').hidden = !available
    setIcon(button('fullscreen'), active ? 'exitFullscreen' : 'enterFullscreen')
    label('fullscreen-label').textContent = active ? TEXT.exitFullscreen : TEXT.page.fullscreen
  }

  function setSound(enabled: boolean) {
    setIcon(button('sound'), enabled ? 'soundOn' : 'soundOff')
    label('sound-label').textContent = enabled ? TEXT.page.mute : TEXT.unmute
  }

  return {
    setSound,
    setRecordingAvailable: (available: boolean) => (button('record').hidden = !available),
    /**
     * What the battle allows: a new seed only where the seed is free (a watched battle, a training horde), and the
     * way back to the team after a challenge or to the line-up after a watched battle.
     */
    setBattleKind({ rerollable, challenge }: { rerollable: boolean; challenge: boolean }) {
      button('new').hidden = !rerollable
      label('menu-label').textContent = challenge ? TEXT.page.editTeam : TEXT.changeTeams
    },
    show: () => {
      nav.hidden = false
      wake()
    },
    hide: () => {
      setMenuOpen(false)
      nav.hidden = true
    },
    setState,
    setSpeed,
    setFullscreen,
  }
}
