import type { FighterSetup, TeamSetup } from './battle'
import type { Pokedex, Species, TypeKey } from './types'

export const TEAM_SELECTOR_EXAMPLES = ['gen1', 'type:fire', 'legendaries', 'ids:25,6,150']

function speciesMatching(pokedex: Pokedex, selector: string): Species[] {
  const generation = /^gen([1-9])$/.exec(selector)?.[1]
  if (generation) return pokedex.pokemon.filter((species) => species.generation === Number(generation))

  const type = /^type:([a-z]+)$/.exec(selector)?.[1]
  if (type) return pokedex.pokemon.filter((species) => species.types.includes(type as TypeKey))

  if (selector === 'legendaries') return pokedex.pokemon.filter((species) => species.rarity !== null)

  const ids = /^ids:([\d,]+)$/.exec(selector)?.[1]
  if (ids) {
    return ids.split(',').map((id) => {
      const species = pokedex.pokemon[Number(id) - 1]
      if (!species) throw new Error(`Pokémon inconnu : ${id}`)
      return species
    })
  }

  throw new Error(`Équipe inconnue : « ${selector} » (exemples : ${TEAM_SELECTOR_EXAMPLES.join(', ')})`)
}

const TYPE_NAMES_FR: Record<TypeKey, string> = {
  normal: 'Normal',
  fire: 'Feu',
  water: 'Eau',
  electric: 'Électrik',
  grass: 'Plante',
  ice: 'Glace',
  fighting: 'Combat',
  poison: 'Poison',
  ground: 'Sol',
  flying: 'Vol',
  psychic: 'Psy',
  bug: 'Insecte',
  rock: 'Roche',
  ghost: 'Spectre',
  dragon: 'Dragon',
  dark: 'Ténèbres',
  steel: 'Acier',
  fairy: 'Fée',
}

/** The name shown on screen for a team selector: `gen1` becomes « Gen 1 », `type:fire` becomes « Type Feu ». */
export function teamTitle(selector: string) {
  const generation = /^gen([1-9])$/.exec(selector)?.[1]
  if (generation) return `Gen ${generation}`
  const type = /^type:([a-z]+)$/.exec(selector)?.[1]
  if (type && type in TYPE_NAMES_FR) return `Type ${TYPE_NAMES_FR[type as TypeKey]}`
  if (selector === 'legendaries') return 'Légendaires'
  if (selector.startsWith('ids:')) return 'Sélection'
  return selector
}

export function toFighterSetup(species: Species, pokedex: Pokedex): FighterSetup {
  const moves = species.moves.map((id) => {
    const move = pokedex.moves.find((candidate) => candidate.id === id)
    if (!move) throw new Error(`Capacité ${id} absente des données de ${species.names.en}`)
    return move
  })
  return { species, moves }
}

export function selectTeam(pokedex: Pokedex, selector: string): TeamSetup {
  const species = speciesMatching(pokedex, selector)
  if (species.length === 0) throw new Error(`Aucun Pokémon pour « ${selector} »`)
  return { label: selector, fighters: species.map((candidate) => toFighterSetup(candidate, pokedex)) }
}
