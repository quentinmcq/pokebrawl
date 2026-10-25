// Long enough to read a short sentence, short enough not to linger over the game.
const TOAST_SECONDS = 3
let hideTimer: ReturnType<typeof setTimeout> | undefined

/** A message that rises at the bottom of the screen for a few seconds, impossible to miss: a link copied, a challenge sent. */
export function showToast(message: string) {
  const toast = document.getElementById('toast')!
  toast.textContent = message
  toast.classList.add('is-visible')
  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => toast.classList.remove('is-visible'), TOAST_SECONDS * 1000)
}
