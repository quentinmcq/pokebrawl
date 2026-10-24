interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
}

export const isInstalled = () =>
  matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches

/**
 * Offers to install the app: Chrome and Edge hand over a prompt to show on demand, while Safari on iOS can only be
 * told where its « Add to Home Screen » entry is.
 */
export function setUpInstall(installButton: HTMLButtonElement, iosHint: HTMLElement) {
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  }
  if (isInstalled()) return

  let deferredPrompt: InstallPromptEvent | null = null
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event as InstallPromptEvent
    installButton.hidden = false
  })
  window.addEventListener('appinstalled', () => (installButton.hidden = true))
  installButton.addEventListener('click', async () => {
    await deferredPrompt?.prompt()
    deferredPrompt = null
    installButton.hidden = true
  })

  const isAppleMobile =
    /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent))
  iosHint.hidden = !isAppleMobile
}
