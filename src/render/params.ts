import { isTerrain, terrainForSeed, type Terrain } from './terrain'

export interface BattleParams {
  teams: [string, string]
  seed: number
  terrain: Terrain
  /** Both sides keep as many Pokémon as the smaller one, picked at random from the seed; on unless `same=0`. */
  sameSize: boolean
  /** Who sent the second team, in a challenge between friends: it shows as « Équipe de Sacha ». */
  opponentName: string | null
}

export const DEFAULT_TEAMS: [string, string] = ['gen1', 'gen3']
const MAX_RANDOM_SEED = 1_000_000

export const randomSeed = () => Math.floor(Math.random() * MAX_RANDOM_SEED)

/** True when the URL describes a battle, as a shared link does, rather than the bare home page. */
export const describesBattle = (search: string) => new URLSearchParams(search).has('a')

/**
 * Reads `?a=gen1&b=gen3&seed=42&terrain=grass&same=0`. A missing or invalid seed gets a random one and a missing
 * terrain follows from the seed, so that once written back the URL always replays the same battle.
 */
export function readBattleParams(search: string, pickSeed = randomSeed): BattleParams {
  const query = new URLSearchParams(search)
  const seedValue = Number(query.get('seed') ?? Number.NaN)
  const seed = Number.isSafeInteger(seedValue) && seedValue >= 0 ? seedValue : pickSeed()
  const terrain = query.get('terrain')
  return {
    teams: [query.get('a') || DEFAULT_TEAMS[0], query.get('b') || DEFAULT_TEAMS[1]],
    seed,
    terrain: isTerrain(terrain) ? terrain : terrainForSeed(seed),
    sameSize: query.get('same') !== '0',
    opponentName: query.get('nb') || null,
  }
}

export function battleSearch({ teams: [first, second], seed, terrain, sameSize, opponentName }: BattleParams) {
  const query = new URLSearchParams({ a: first, b: second, seed: String(seed), terrain })
  if (!sameSize) query.set('same', '0')
  if (opponentName) query.set('nb', opponentName)
  return `?${query}`
}
