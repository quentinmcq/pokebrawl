import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { BaseStats, Move, MoveCategory, Pokedex, PokemonTypes, Species, TypeKey } from '../src/simulation/types'

const OUTPUT_FILE = join(import.meta.dirname, '..', 'src', 'data', 'pokemon.json')
const POKEAPI_URL = 'https://pokeapi.co/api/v2'
const POKEMON_COUNT = 1025
const MOVESET_SIZE = 4
const SAME_TYPE_BONUS = 1.5
const PARALLEL_REQUESTS = 12
const REQUEST_ATTEMPTS = 4

// Moves that make no sense without turns: charging, recharging, self-KO, or damage that depends on hidden state.
const EXCLUDED_MOVES = new Set([
  'explosion',
  'self-destruct',
  'misty-explosion',
  'final-gambit',
  'memento',
  'hyper-beam',
  'giga-impact',
  'blast-burn',
  'frenzy-plant',
  'hydro-cannon',
  'rock-wrecker',
  'roar-of-time',
  'prismatic-laser',
  'eternabeam',
  'meteor-assault',
  'solar-beam',
  'solar-blade',
  'sky-attack',
  'skull-bash',
  'razor-wind',
  'freeze-shock',
  'ice-burn',
  'meteor-beam',
  'electro-shot',
  'dig',
  'fly',
  'dive',
  'bounce',
  'phantom-force',
  'shadow-force',
  'sky-drop',
  'future-sight',
  'doom-desire',
  'focus-punch',
  'shell-trap',
  'beak-blast',
  'dream-eater',
  'last-resort',
  'belch',
  'synchronoise',
  'spit-up',
  'natural-gift',
  'fling',
  'snore',
  'sleep-talk',
  'steel-beam',
  'mind-blown',
  'chloroblast',
  'fake-out',
  'first-impression',
  'burn-up',
  'double-shock',
  'hyperspace-fury',
])

interface NamedResource {
  name: string
  url: string
}

interface LocalizedName {
  name: string
  language: NamedResource
}

interface ApiPokemon {
  id: number
  types: { slot: number; type: NamedResource }[]
  stats: { base_stat: number; stat: NamedResource }[]
  moves: { move: NamedResource; version_group_details: { move_learn_method: NamedResource }[] }[]
}

interface ApiSpecies {
  names: LocalizedName[]
  generation: NamedResource
  is_legendary: boolean
  is_mythical: boolean
}

interface ApiMove {
  id: number
  name: string
  names: LocalizedName[]
  type: NamedResource
  power: number | null
  accuracy: number | null
  damage_class: NamedResource
}

async function fetchJson<T>(url: string): Promise<T> {
  for (let attempt = 1; attempt <= REQUEST_ATTEMPTS; attempt++) {
    const response = await fetch(url).catch(() => null)
    if (response?.ok) return (await response.json()) as T
    if (attempt < REQUEST_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, 800 * attempt))
  }
  throw new Error(`Échec après ${REQUEST_ATTEMPTS} tentatives : ${url}`)
}

async function mapInParallel<Item, Result>(items: Item[], mapItem: (item: Item) => Promise<Result>) {
  const results: Result[] = []
  let nextIndex = 0
  await Promise.all(
    Array.from({ length: PARALLEL_REQUESTS }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex++
        results[index] = await mapItem(items[index]!)
      }
    }),
  )
  return results
}

const nameIn = (names: LocalizedName[], language: string, fallback: string) =>
  names.find((entry) => entry.language.name === language)?.name ?? fallback

const idFromResourceUrl = (url: string) => Number(url.split('/').filter(Boolean).pop())

const GENERATION_NUMBERS: Record<string, number> = {
  'generation-i': 1,
  'generation-ii': 2,
  'generation-iii': 3,
  'generation-iv': 4,
  'generation-v': 5,
  'generation-vi': 6,
  'generation-vii': 7,
  'generation-viii': 8,
  'generation-ix': 9,
}

function toBaseStats(stats: ApiPokemon['stats']): BaseStats {
  const statOf = (name: string) => stats.find(({ stat }) => stat.name === name)?.base_stat ?? 0
  return {
    hp: statOf('hp'),
    attack: statOf('attack'),
    defense: statOf('defense'),
    specialAttack: statOf('special-attack'),
    specialDefense: statOf('special-defense'),
    speed: statOf('speed'),
  }
}

function isUsableInMelee(move: ApiMove) {
  return move.damage_class.name !== 'status' && (move.power ?? 0) > 0 && !EXCLUDED_MOVES.has(move.name)
}

const isLearnedByLevel = ({ version_group_details }: ApiPokemon['moves'][number]) =>
  version_group_details.some(({ move_learn_method }) => move_learn_method.name === 'level-up')

function toMove(move: ApiMove): Move {
  return {
    id: move.id,
    names: { fr: nameIn(move.names, 'fr', move.name), en: nameIn(move.names, 'en', move.name) },
    type: move.type.name as TypeKey,
    power: move.power!,
    accuracy: move.accuracy,
    category: move.damage_class.name as MoveCategory,
  }
}

const STRUGGLE: Move = {
  id: 165,
  names: { fr: 'Lutte', en: 'Struggle' },
  type: 'normal',
  power: 50,
  accuracy: null,
  category: 'physical',
}

// Greedy pick of the strongest expected hits, one per type so that each Pokémon keeps some coverage.
function chooseMoveset(types: PokemonTypes, stats: BaseStats, learnable: Move[]) {
  const strongerStat = Math.max(stats.attack, stats.specialAttack)
  const expectedPower = (move: Move) =>
    move.power *
    ((move.accuracy ?? 100) / 100) *
    (types.includes(move.type) ? SAME_TYPE_BONUS : 1) *
    ((move.category === 'physical' ? stats.attack : stats.specialAttack) / strongerStat)

  const moveset: Move[] = []
  for (const move of learnable.toSorted((a, b) => expectedPower(b) - expectedPower(a) || a.id - b.id)) {
    if (moveset.length === MOVESET_SIZE) break
    if (!moveset.some((chosen) => chosen.type === move.type)) moveset.push(move)
  }
  return moveset.length > 0 ? moveset : [STRUGGLE]
}

console.info('Capacités…')
const moveList = await fetchJson<{ results: NamedResource[] }>(`${POKEAPI_URL}/move?limit=2000`)
const apiMoves = await mapInParallel(moveList.results, ({ url }) => fetchJson<ApiMove>(url))
const usableMoves = new Map(apiMoves.filter(isUsableInMelee).map((move) => [move.id, toMove(move)]))

console.info('Pokémon et espèces…')
const pokemonIds = Array.from({ length: POKEMON_COUNT }, (_, index) => index + 1)
const pokemon = await mapInParallel(pokemonIds, async (id): Promise<Species> => {
  const [apiPokemon, apiSpecies] = await Promise.all([
    fetchJson<ApiPokemon>(`${POKEAPI_URL}/pokemon/${id}`),
    fetchJson<ApiSpecies>(`${POKEAPI_URL}/pokemon-species/${id}`),
  ])
  const types = apiPokemon.types.toSorted((a, b) => a.slot - b.slot).map(({ type }) => type.name) as PokemonTypes
  const stats = toBaseStats(apiPokemon.stats)
  const toUsableMoves = (learned: ApiPokemon['moves']) =>
    learned.map(({ move }) => usableMoves.get(idFromResourceUrl(move.url))).filter((move) => move !== undefined)
  const learnedByLevel = toUsableMoves(apiPokemon.moves.filter(isLearnedByLevel))
  // Level-up moves are the iconic ones; machines would give Hydro Pump to Magikarp.
  const learnable = learnedByLevel.length > 0 ? learnedByLevel : toUsableMoves(apiPokemon.moves)
  const englishName = nameIn(apiSpecies.names, 'en', String(id))
  return {
    id,
    names: { fr: nameIn(apiSpecies.names, 'fr', englishName), en: englishName },
    types,
    stats,
    generation: GENERATION_NUMBERS[apiSpecies.generation.name] ?? 0,
    rarity: apiSpecies.is_mythical ? 'mythical' : apiSpecies.is_legendary ? 'legendary' : null,
    moves: chooseMoveset(types, stats, learnable).map((move) => move.id),
  }
})

const usedMoveIds = new Set(pokemon.flatMap((species) => species.moves))
const moves = [...usableMoves.values(), STRUGGLE]
  .filter((move, index, all) => usedMoveIds.has(move.id) && all.findIndex((other) => other.id === move.id) === index)
  .toSorted((a, b) => a.id - b.id)

const pokedex: Pokedex = { pokemon, moves }
writeFileSync(OUTPUT_FILE, JSON.stringify(pokedex))
console.info(`${pokemon.length} Pokémon, ${moves.length} capacités → ${OUTPUT_FILE}`)
