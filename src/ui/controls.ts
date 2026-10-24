// Stroke icons in a 24 × 24 grid, after the Lucide set.
const ICONS = {
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  replay: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  shuffle:
    '<path d="m18 14 4 4-4 4"/><path d="m18 2 4 4-4 4"/><path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/>',
  settings: '<path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4"/>',
  enterFullscreen:
    '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
  exitFullscreen:
    '<path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/>',
}
// The bar fades away during the battle so that it never hides the action, and comes back on the next touch.
const IDLE_DELAY_MS = 2500

export type PlayState = 'playing' | 'paused' | 'over'

interface ControlHandlers {
  onToggle: () => void
  onSpeed: (speed: number) => void
  onNewBattle: () => void
  onMenu: () => void
  onFullscreen: () => void
}

const icon = (name: keyof typeof ICONS) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`

/** The touch-friendly bar over the arena; it lives outside the canvas, so a recorded video never shows it. */
export function createControls(nav: HTMLElement, stage: HTMLElement, handlers: ControlHandlers) {
  const button = (action: string) => nav.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!
  const toggleButton = button('toggle')
  const fullscreenButton = button('fullscreen')
  const speedButtons = [...nav.querySelectorAll<HTMLButtonElement>('[data-speed]')]
  button('new').innerHTML = icon('shuffle')
  button('menu').innerHTML = icon('settings')
  let state: PlayState = 'playing'
  let idleTimer: ReturnType<typeof setTimeout> | undefined

  nav.addEventListener('click', (event) => {
    const target = (event.target as Element).closest('button')
    if (!target) return
    if (target.dataset.speed) handlers.onSpeed(Number(target.dataset.speed))
    else if (target.dataset.action === 'toggle') handlers.onToggle()
    else if (target.dataset.action === 'new') handlers.onNewBattle()
    else if (target.dataset.action === 'menu') handlers.onMenu()
    else if (target.dataset.action === 'fullscreen') handlers.onFullscreen()
    wake()
  })

  function wake() {
    nav.classList.remove('is-idle')
    clearTimeout(idleTimer)
    if (state === 'playing') idleTimer = setTimeout(() => nav.classList.add('is-idle'), IDLE_DELAY_MS)
  }
  stage.addEventListener('pointerdown', (event) => {
    if (!nav.hidden && !nav.contains(event.target as Node)) wake()
  })
  stage.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'mouse' && !nav.hidden) wake()
  })

  function setState(next: PlayState) {
    state = next
    toggleButton.innerHTML = icon(state === 'playing' ? 'pause' : state === 'paused' ? 'play' : 'replay')
    toggleButton.ariaLabel = state === 'playing' ? 'Pause' : state === 'paused' ? 'Reprendre' : 'Revoir le combat'
    wake()
  }

  function setSpeed(speed: number) {
    for (const speedButton of speedButtons)
      speedButton.ariaPressed = String(Number(speedButton.dataset.speed) === speed)
  }

  function setFullscreen(available: boolean, active: boolean) {
    fullscreenButton.hidden = !available
    fullscreenButton.innerHTML = icon(active ? 'exitFullscreen' : 'enterFullscreen')
    fullscreenButton.ariaLabel = active ? 'Quitter le plein écran' : 'Plein écran'
  }

  return {
    show: () => {
      nav.hidden = false
      wake()
    },
    hide: () => (nav.hidden = true),
    setState,
    setSpeed,
    setFullscreen,
  }
}
