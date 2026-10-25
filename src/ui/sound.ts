import type { ShownEvent } from '../render/playback'
import type { TypeKey } from '../simulation/types'
import { readStored, writeStored } from './storage'

const STORAGE_KEY = 'pokebrawl.sound'
const MASTER_VOLUME = 0.22
// A crowd battle lands up to a hundred blows a second: past this many sounds at once, plain hits stay silent.
const MAX_SOUNDS_PER_WINDOW = 6
const SOUND_WINDOW_SECONDS = 0.1
// A melee knocks out several Pokémon a second: one short, quiet cry now and then marks them, more is a din.
const CRY_GAP_SECONDS = 2
const CRY_VOLUME = 0.28
const KNOCK_OUT_CRY_SECONDS = 0.8
// At ×4, knock-outs follow each other too fast for any cry to make sense.
const MAX_SPEED_WITH_CRIES = 2
const CHAMPION_CRY_VOLUME = 0.5
const PARALLEL_CRY_DOWNLOADS = 6

// Each type gets its own pitch, so that a fire battle does not sound like a water one.
const TYPE_PITCHES: Record<TypeKey, number> = {
  normal: 330,
  fire: 262,
  water: 392,
  electric: 880,
  grass: 349,
  ice: 784,
  fighting: 196,
  poison: 233,
  ground: 147,
  flying: 523,
  psychic: 659,
  bug: 587,
  rock: 165,
  ghost: 220,
  dragon: 175,
  dark: 185,
  steel: 698,
  fairy: 988,
}

/**
 * The battle's sound, synthesised on the spot (no files to download): a thump for physical blows, a zap for special
 * ones, pitched by type, louder when super effective, a falling blip for each knock-out and a short tune at the end.
 * Knock-outs play the fallen Pokémon's cry when it has loaded, and the end of a battle the cry of its best Pokémon.
 * Browsers only start sound after a tap, so the audio wakes up on the first one.
 */
export function createSound() {
  let enabled = readStored<boolean>(STORAGE_KEY, true)
  let context: AudioContext | null = null
  let master: GainNode | null = null
  let windowStart = 0
  let soundsInWindow = 0
  let lastCryAt = Number.NEGATIVE_INFINITY
  const cries = new Map<number, AudioBuffer>()
  const requestedCries = new Set<number>()

  // Decoding works before the first tap, with the audio still suspended: cries can load ahead of the battle.
  function ensureContext() {
    if (!context) {
      context = new AudioContext()
      master = context.createGain()
      master.gain.value = MASTER_VOLUME
      master.connect(context.destination)
    }
    return context
  }

  function wake() {
    const audio = ensureContext()
    if (audio.state === 'running') return
    void audio.resume()
    // Safari on iPhone only lets sound out once something has played within the gesture: an empty sample will do.
    const silence = audio.createBufferSource()
    silence.buffer = audio.createBuffer(1, 1, audio.sampleRate)
    silence.connect(audio.destination)
    silence.start()
  }

  /**
   * Starts the sound on the player's first gestures. Safari on iPhone ignores a bare touch on the screen and waits
   * for a tap or a click, so every kind of gesture tries until the sound actually runs.
   */
  function unlockOnGesture() {
    const gestures = ['pointerdown', 'touchend', 'click', 'keydown'] as const
    const unlock = () => {
      if (!enabled) return
      wake()
      if (context?.state === 'running') for (const gesture of gestures) window.removeEventListener(gesture, unlock)
    }
    for (const gesture of gestures) window.addEventListener(gesture, unlock)
  }
  // Back from another app, iPhone has often suspended the sound again: the next gesture restarts it.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && context && context.state !== 'running') unlockOnGesture()
  })

  /** Fetches and decodes, in the background, the cries a battle may play; any that fails simply stays silent. */
  async function loadCries(ids: number[]) {
    if (!enabled) return
    const audio = ensureContext()
    const queue = [...new Set(ids)].filter((id) => !requestedCries.has(id))
    for (const id of queue) requestedCries.add(id)
    await Promise.all(
      Array.from({ length: PARALLEL_CRY_DOWNLOADS }, async () => {
        for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
          try {
            const response = await fetch(`${import.meta.env.BASE_URL}cries/${id}.ogg`)
            if (response.ok) cries.set(id, await audio.decodeAudioData(await response.arrayBuffer()))
          } catch {
            // An unsupported format (Safari before 18.4) or a network hiccup: that Pokémon stays silent.
          }
        }
      }),
    )
  }

  /**
   * Plays a Pokémon's cry if it has loaded, cut short with a fade for a knock-out; the champion's plays whole and
   * skips the gap kept between cries. Says whether it played.
   */
  function cry(id: number, start: number, isChampion = false) {
    const buffer = cries.get(id)
    if (!enabled || !context || context.state !== 'running' || !buffer) return false
    if (!isChampion && start - lastCryAt < CRY_GAP_SECONDS) return false
    lastCryAt = start
    const source = context.createBufferSource()
    const gain = context.createGain()
    source.buffer = buffer
    gain.gain.setValueAtTime(isChampion ? CHAMPION_CRY_VOLUME : CRY_VOLUME, start)
    if (!isChampion) {
      gain.gain.setValueAtTime(CRY_VOLUME, start + KNOCK_OUT_CRY_SECONDS * 0.6)
      gain.gain.linearRampToValueAtTime(0, start + KNOCK_OUT_CRY_SECONDS)
    }
    source.connect(gain).connect(master!)
    source.start(start)
    if (!isChampion) source.stop(start + KNOCK_OUT_CRY_SECONDS)
    return true
  }

  // Lets a sound through unless the moment is already crowded; notable sounds always pass.
  function admit(notable: boolean) {
    if (!context) return false
    if (context.currentTime - windowStart > SOUND_WINDOW_SECONDS) {
      windowStart = context.currentTime
      soundsInWindow = 0
    }
    if (!notable && soundsInWindow >= MAX_SOUNDS_PER_WINDOW) return false
    soundsInWindow++
    return true
  }

  function tone(start: number, from: number, to: number, duration: number, volume: number, wave: OscillatorType) {
    const oscillator = context!.createOscillator()
    const gain = context!.createGain()
    oscillator.type = wave
    oscillator.frequency.setValueAtTime(from, start)
    oscillator.frequency.exponentialRampToValueAtTime(to, start + duration)
    gain.gain.setValueAtTime(volume, start)
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
    oscillator.connect(gain).connect(master!)
    oscillator.start(start)
    oscillator.stop(start + duration)
  }

  function thump(start: number, pitch: number, volume: number) {
    const length = Math.floor(context!.sampleRate * 0.08)
    const buffer = context!.createBuffer(1, length, context!.sampleRate)
    const samples = buffer.getChannelData(0)
    for (let index = 0; index < length; index++) samples[index] = (Math.random() * 2 - 1) * (1 - index / length) ** 2
    const noise = context!.createBufferSource()
    noise.buffer = buffer
    const filter = context!.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = pitch * 3
    const gain = context!.createGain()
    gain.gain.value = volume
    noise.connect(filter).connect(gain).connect(master!)
    noise.start(start)
    tone(start, pitch, pitch / 2, 0.08, volume * 0.6, 'sine')
  }

  /**
   * Sounds each event when its blow lands, `travelSeconds` later on the battle's clock, played at `speed`;
   * `speciesOf` tells which Pokémon a fighter is, for its cry.
   */
  function play(events: ShownEvent[], speed: number, speciesOf: (fighter: number) => number) {
    if (!enabled || !context || context.state !== 'running') return
    for (const { event, travelSeconds } of events) {
      const start = context.currentTime + travelSeconds / speed
      if (event.kind === 'knockOut') {
        const cried = speed <= MAX_SPEED_WITH_CRIES && cry(speciesOf(event.fighter), start)
        if (!cried && admit(true)) tone(start, 520, 90, 0.22, 0.5, 'square')
        continue
      }
      if (event.kind !== 'hit') continue
      const superEffective = event.multiplier >= 2
      if (!admit(superEffective || event.critical)) continue
      const pitch = TYPE_PITCHES[event.move.type] * (superEffective ? 1.5 : event.multiplier < 1 ? 0.75 : 1)
      const volume = superEffective ? 0.7 : event.multiplier < 1 ? 0.25 : 0.4
      if (event.move.category === 'physical') thump(start, pitch, volume)
      else tone(start, pitch * 2, pitch, 0.12, volume * 0.6, 'triangle')
      if (event.critical) tone(start, 2400, 1800, 0.05, 0.3, 'square')
    }
  }

  /** A rising tune for a win, a falling one for a loss. */
  function fanfare(won: boolean) {
    if (!enabled || !context || context.state !== 'running') return
    const notes = won ? [523, 659, 784, 1047] : [392, 330, 262, 196]
    notes.forEach((note, index) => tone(context!.currentTime + index * 0.13, note, note, 0.2, 0.45, 'square'))
  }

  /** The cry of the battle's best Pokémon, as the end screen shows it `delaySeconds` from now. */
  function champion(id: number, delaySeconds: number) {
    if (context) cry(id, context.currentTime + delaySeconds, true)
  }

  return {
    wake,
    unlockOnGesture,
    loadCries,
    play,
    fanfare,
    champion,
    isEnabled: () => enabled,
    setEnabled(value: boolean) {
      enabled = value
      writeStored(STORAGE_KEY, value)
      if (value) wake()
    },
  }
}
