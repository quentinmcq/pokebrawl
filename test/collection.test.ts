import { describe, expect, it } from 'vitest'
import { decodeCollection, readCollectionHash } from '../src/collection'

// Builds a code the way PokéDate does: two bits per Pokémon (1 seen, 2 caught, 3 caught shiny), base64url.
function codeOf(states: Record<number, number>, seenShinies = '') {
  const bytes = new Uint8Array(Math.ceil(1025 / 4))
  for (const [id, state] of Object.entries(states)) {
    const index = Number(id) - 1
    bytes[Math.floor(index / 4)]! |= state << ((index % 4) * 2)
  }
  let length = bytes.length
  while (length > 0 && bytes[length - 1] === 0) length--
  const payload = btoa(String.fromCharCode(...bytes.subarray(0, length)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
  return `1.${payload}${seenShinies ? `.${seenShinies}` : ''}`
}

describe('PokéDate collection', () => {
  it('keeps the Pokémon caught, shiny or not, and leaves those only seen', () => {
    expect(decodeCollection(codeOf({ 1: 2, 25: 3, 150: 1, 1025: 2 }, 'a-b'))).toEqual([1, 25, 1025])
  })

  it('reads the code from the link hash', () => {
    expect(readCollectionHash(`#pokedex=${codeOf({ 6: 2 })}`)).toEqual([6])
    expect(readCollectionHash('#autre=1')).toBeNull()
  })

  it('refuses what is not a PokéDate code', () => {
    expect(decodeCollection('2.AAAA')).toBeNull()
    expect(decodeCollection('1.%%%')).toBeNull()
  })
})
