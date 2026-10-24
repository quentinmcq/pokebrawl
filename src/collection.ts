/**
 * The Pokémon a player caught on PokéDate, the sibling site, received through `#pokedex=<code>`. The code is
 * PokéDate's own transfer format (version 1): two bits per Pokémon in Pokédex order (unknown, seen, caught, caught
 * shiny), packed into bytes and written in base64url, then optionally a dot and seen shinies, ignored here.
 */
const FORMAT_VERSION = '1'
const BITS_PER_POKEMON = 2
const POKEMON_PER_BYTE = 8 / BITS_PER_POKEMON
const STATE_MASK = 0b11
const CAUGHT_STATES = new Set([2, 3])
const BASE64URL_PATTERN = /^[\w-]*$/
export const POKEMON_COUNT = 1025
export const COLLECTION_HASH_KEY = 'pokedex'

/** The ids of the Pokémon caught on PokéDate, or `null` for a code that is not PokéDate's. */
export function decodeCollection(code: string): number[] | null {
  const [version, payload = ''] = code.split('.')
  if (version !== FORMAT_VERSION || !BASE64URL_PATTERN.test(payload)) return null
  let bytes: Uint8Array
  try {
    bytes = Uint8Array.from(atob(payload.replaceAll('-', '+').replaceAll('_', '/')), (character) =>
      character.charCodeAt(0),
    )
  } catch {
    return null
  }
  const caught: number[] = []
  for (let index = 0; index < Math.min(bytes.length * POKEMON_PER_BYTE, POKEMON_COUNT); index++) {
    const state =
      (bytes[Math.floor(index / POKEMON_PER_BYTE)]! >> ((index % POKEMON_PER_BYTE) * BITS_PER_POKEMON)) & STATE_MASK
    if (CAUGHT_STATES.has(state)) caught.push(index + 1)
  }
  return caught
}

export const readCollectionHash = (hash: string) => {
  const code = new URLSearchParams(hash.replace(/^#/, '')).get(COLLECTION_HASH_KEY)
  return code ? decodeCollection(code) : null
}
