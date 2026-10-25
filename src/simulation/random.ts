/** Seeds run from 0 to just under this: six digits, short enough for an address. */
export const SEED_LIMIT = 1_000_000

export interface Random {
  /** Uniform float in [0, 1). */
  next(): number
  between(min: number, max: number): number
  chance(probability: number): boolean
  integer(maxExclusive: number): number
  shuffle<Item>(items: readonly Item[]): Item[]
}

// Mulberry32: tiny, fast and good enough for a game; the same seed always replays the same battle.
export function createRandom(seed: number): Random {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let mixed = state
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
  const integer = (maxExclusive: number) => Math.floor(next() * maxExclusive)
  return {
    next,
    between: (min, max) => min + next() * (max - min),
    chance: (probability) => next() < probability,
    integer,
    shuffle(items) {
      const shuffled = [...items]
      for (let index = shuffled.length - 1; index > 0; index--) {
        const swapIndex = integer(index + 1)
        ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!]
      }
      return shuffled
    },
  }
}
