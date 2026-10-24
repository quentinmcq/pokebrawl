import data from './data/pokemon.json'
import type { Pokedex } from './simulation/types'

export const pokedex = data as unknown as Pokedex
