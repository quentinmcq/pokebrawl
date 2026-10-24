export interface BattleParams {
  teams: [string, string]
  seed: number
}

export const DEFAULT_TEAMS: [string, string] = ['gen1', 'gen3']
const MAX_RANDOM_SEED = 1_000_000

export const randomSeed = () => Math.floor(Math.random() * MAX_RANDOM_SEED)

/** Reads `?a=gen1&b=gen3&seed=42`; a missing or invalid seed gets a random one, to be written back into the URL. */
export function readBattleParams(search: string, pickSeed = randomSeed): BattleParams {
  const query = new URLSearchParams(search)
  const seed = Number(query.get('seed') ?? Number.NaN)
  return {
    teams: [query.get('a') || DEFAULT_TEAMS[0], query.get('b') || DEFAULT_TEAMS[1]],
    seed: Number.isSafeInteger(seed) && seed >= 0 ? seed : pickSeed(),
  }
}

export function battleSearch({ teams: [first, second], seed }: BattleParams) {
  return `?${new URLSearchParams({ a: first, b: second, seed: String(seed) })}`
}
