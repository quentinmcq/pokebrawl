// MP4 first: TikTok and Instagram take it everywhere, WebM only as a last resort for older browsers.
const VIDEO_TYPES = [
  'video/mp4;codecs=avc1.640028',
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm',
]
const FRAMES_PER_SECOND = 60
const BITS_PER_SECOND = 10_000_000

export interface Video {
  blob: Blob
  fileName: string
}

const supportedType = () =>
  typeof MediaRecorder === 'undefined' ? undefined : VIDEO_TYPES.find((type) => MediaRecorder.isTypeSupported(type))

export const canRecord = () => supportedType() !== undefined && 'captureStream' in HTMLCanvasElement.prototype

/** Records whatever the canvas draws, as the browser composes it, until `stop` hands back the video. */
export function recordCanvas(canvas: HTMLCanvasElement, baseName: string) {
  const mimeType = supportedType()
  if (!mimeType) throw new Error('Enregistrement vidéo indisponible dans ce navigateur')
  const stream = canvas.captureStream(FRAMES_PER_SECOND)
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: BITS_PER_SECOND })
  const chunks: Blob[] = []
  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  })
  recorder.start()

  function stop() {
    return new Promise<Video>((resolve) => {
      recorder.addEventListener(
        'stop',
        () => {
          for (const track of stream.getTracks()) track.stop()
          const extension = mimeType!.startsWith('video/mp4') ? 'mp4' : 'webm'
          resolve({ blob: new Blob(chunks, { type: mimeType!.split(';')[0] }), fileName: `${baseName}.${extension}` })
        },
        { once: true },
      )
      recorder.stop()
    })
  }

  return { stop }
}

/** A file name safe everywhere: `type:fire` becomes `type-fire`. */
export const videoBaseName = (teams: [string, string], seed: number) =>
  `pokebrawl-${teams.join('-vs-')}-${seed}`.replaceAll(/[^a-z0-9-]+/gi, '-')
