import { readStored, STORAGE_KEYS, writeStored } from './storage'
import { track } from './track'

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
}

export const isInstalled = () =>
  matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches

const isAppleMobile = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent))

/**
 * Offers to install the app: Chrome and Edge hand over a prompt to show on demand, while Safari on iOS can only be
 * told where its « Add to Home Screen » entry is. The offer waits for a first win, when the player has a reason to
 * come back, and goes for good once closed.
 */
export function setUpInstall(offer: HTMLElement, hasWon: () => boolean) {
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  }
  const installButton = offer.querySelector<HTMLButtonElement>('[data-action="install"]')!
  const iosHint = offer.querySelector<HTMLElement>('[data-role="ios-install"]')!
  let deferredPrompt: InstallPromptEvent | null = null
  let dismissed = readStored(STORAGE_KEYS.installDismissed, false)

  function refresh() {
    const canInstall = deferredPrompt !== null || isAppleMobile()
    offer.hidden = isInstalled() || dismissed || !canInstall || !hasWon()
    installButton.hidden = deferredPrompt === null
    iosHint.hidden = deferredPrompt !== null
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event as InstallPromptEvent
    refresh()
  })
  window.addEventListener('appinstalled', () => {
    offer.hidden = true
    track('install')
  })
  installButton.addEventListener('click', async () => {
    await deferredPrompt?.prompt()
    deferredPrompt = null
    refresh()
  })
  offer.querySelector('[data-action="dismiss-install"]')!.addEventListener('click', () => {
    dismissed = true
    writeStored(STORAGE_KEYS.installDismissed, true)
    refresh()
  })
  refresh()
  return { refresh }
}
