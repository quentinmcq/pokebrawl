import type { ShownEvent } from '../render/playback'
import type { TypeKey } from '../simulation/types'
import { readStored, writeStored } from './storage'

const STORAGE_KEY = 'pokebrawl.sound'
const MASTER_VOLUME = 0.22
// A crowd battle lands up to a hundred blows a second: past this many sounds at once, plain hits stay silent.
const MAX_SOUNDS_PER_WINDOW = 6
const SOUND_WINDOW_SECONDS = 0.1

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
 * Browsers only start sound after a tap, so the audio wakes up on the first one.
 */
export function createSound() {
  let enabled = readStored<boolean>(STORAGE_KEY, true)
  let context: AudioContext | null = null
  let master: GainNode | null = null
  let windowStart = 0
  let soundsInWindow = 0

  function wake() {
    if (!context) {
      context = new AudioContext()
      master = context.createGain()
      master.gain.value = MASTER_VOLUME
      master.connect(context.destination)
    }
    if (context.state === 'suspended') void context.resume()
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

  /** Sounds each event when its blow lands, `travelSeconds` later on the battle's clock, played at `speed`. */
  function play(events: ShownEvent[], speed: number) {
    if (!enabled || !context || context.state !== 'running') return
    for (const { event, travelSeconds } of events) {
      const start = context.currentTime + travelSeconds / speed
      if (event.kind === 'knockOut') {
        if (admit(true)) tone(start, 520, 90, 0.22, 0.5, 'square')
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

  return {
    wake,
    play,
    fanfare,
    isEnabled: () => enabled,
    setEnabled(value: boolean) {
      enabled = value
      writeStored(STORAGE_KEY, value)
      if (value) wake()
    },
  }
}
