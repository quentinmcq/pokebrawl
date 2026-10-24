import type { Video } from './recorder'

/** The recording indicator, then the finished video to share or download; both stay out of the recorded canvas. */
export function createVideoPanel(indicator: HTMLElement, ready: HTMLElement, onStop: () => void) {
  const shareButton = ready.querySelector<HTMLButtonElement>('[data-action="share"]')!
  const downloadLink = ready.querySelector<HTMLAnchorElement>('[data-action="download"]')!
  let video: Video | null = null
  let videoUrl: string | null = null

  indicator.querySelector('button')!.addEventListener('click', onStop)
  ready.querySelector('[data-action="close"]')!.addEventListener('click', close)

  // On a phone, sharing sends the video straight to TikTok or Instagram; a download is the way everywhere else.
  shareButton.addEventListener('click', async () => {
    if (!video) return
    const file = new File([video.blob], video.fileName, { type: video.blob.type })
    await navigator.share({ files: [file], title: 'PokéBrawl' }).catch(() => {})
  })

  function close() {
    ready.hidden = true
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    video = null
    videoUrl = null
  }

  return {
    showRecording() {
      close()
      indicator.hidden = false
    },
    showVideo(next: Video) {
      indicator.hidden = true
      video = next
      videoUrl = URL.createObjectURL(next.blob)
      downloadLink.href = videoUrl
      downloadLink.download = next.fileName
      const file = new File([next.blob], next.fileName, { type: next.blob.type })
      shareButton.hidden = !navigator.canShare?.({ files: [file] })
      ready.hidden = false
    },
  }
}
