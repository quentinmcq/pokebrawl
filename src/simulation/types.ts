export type Locale = 'fr' | 'en'

export type TypeKey =
  | 'normal'
  | 'fire'
  | 'water'
  | 'electric'
  | 'grass'
  | 'ice'
  | 'fighting'
  | 'poison'
  | 'ground'
  | 'flying'
  | 'psychic'
  | 'bug'
  | 'rock'
  | 'ghost'
  | 'dragon'
  | 'dark'
  | 'steel'
  | 'fairy'

export type PokemonTypes = [TypeKey] | [TypeKey, TypeKey]

export interface BaseStats {
  hp: number
  attack: number
  defense: number
  specialAttack: number
  specialDefense: number
  speed: number
}

type Rarity = 'legendary' | 'mythical' | null

export type MoveCategory = 'physical' | 'special'

export interface Move {
  id: number
  names: Record<Locale, string>
  type: TypeKey
  power: number
  /** `null` for moves that never miss. */
  accuracy: number | null
  category: MoveCategory
}

export interface Species {
  id: number
  names: Record<Locale, string>
  types: PokemonTypes
  stats: BaseStats
  generation: number
  rarity: Rarity
  /** Move ids, best first. */
  moves: number[]
}

export interface Pokedex {
  pokemon: Species[]
  moves: Move[]
}
