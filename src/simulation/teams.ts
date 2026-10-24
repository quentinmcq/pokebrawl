import type { FighterSetup, TeamSetup } from './battle'
import { costOf, MAX_TEAM_SIZE, MIN_COST } from './cost'
import { createRandom } from './random'
import type { Pokedex, Species, TypeKey } from './types'

export const TEAM_SELECTOR_EXAMPLES = ['gen1', 'type:fire', 'legendaries', 'ids:25,6*3,150', 'horde:gen1:1000']

function speciesMatching(pokedex: Pokedex, selector: string): Species[] {
  const generation = /^gen([1-9])$/.exec(selector)?.[1]
  if (generation) return pokedex.pokemon.filter((species) => species.generation === Number(generation))

  const type = /^type:([a-z]+)$/.exec(selector)?.[1]
  if (type) return pokedex.pokemon.filter((species) => species.types.includes(type as TypeKey))

  if (selector === 'legendaries') return pokedex.pokemon.filter((species) => species.rarity !== null)

  // `ids:66*10,6*2` fields ten Machop and two Charizard.
  const ids = /^ids:([\d,*]+)$/.exec(selector)?.[1]
  if (ids) {
    return ids.split(',').flatMap((entry) => {
      const [id, count = '1'] = entry.split('*')
      const species = pokedex.pokemon[Number(id) - 1]
      if (!species) throw new Error(`Pokémon inconnu : ${id}`)
      const copies = Number(count)
      if (!Number.isInteger(copies) || copies < 1 || copies > MAX_TEAM_SIZE)
        throw new Error(`Nombre invalide pour #${id} : ${count}`)
      return Array.from({ length: copies }, () => species)
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

/** Every ready-made team, in the order a menu lists them. */
export const TEAM_SELECTORS = [
  ...Array.from({ length: 9 }, (_, index) => `gen${index + 1}`),
  'legendaries',
  ...Object.keys(TYPE_NAMES_FR).map((type) => `type:${type}`),
]

const hashOf = (text: string) =>
  [...text].reduce((hash, character) => Math.imul(hash ^ character.charCodeAt(0), 16_777_619), 2_166_136_261)

/**
 * A horde worth `value` points drawn from a ready-made team, the same every time for the same selector so that a
 * player can study it and come back with a better answer. Small pools repeat their Pokémon to reach the value.
 */
export function hordeOf(pokedex: Pokedex, selector: string, value: number): FighterSetup[] {
  const pool = speciesMatching(pokedex, selector).map((species) => toFighterSetup(species, pokedex))
  const random = createRandom(hashOf(`${selector}:${value}`))
  const horde: FighterSetup[] = []
  let left = value
  while (left >= MIN_COST && horde.length < MAX_TEAM_SIZE) {
    const affordable = random.shuffle(pool).filter((fighter) => costOf(fighter) <= left)
    if (affordable.length === 0) break
    for (const fighter of affordable) {
      if (costOf(fighter) > left || horde.length === MAX_TEAM_SIZE) continue
      horde.push(fighter)
      left -= costOf(fighter)
    }
  }
  return horde.toSorted((a, b) => a.species.id - b.species.id)
}

/** The name shown on screen for a team selector: `gen1` becomes « Gen 1 », `type:fire` becomes « Type Feu ». */
export function teamTitle(selector: string): string {
  const generation = /^gen([1-9])$/.exec(selector)?.[1]
  if (generation) return `Gen ${generation}`
  const type = /^type:([a-z]+)$/.exec(selector)?.[1]
  if (type && type in TYPE_NAMES_FR) return `Type ${TYPE_NAMES_FR[type as TypeKey]}`
  if (selector === 'legendaries') return 'Légendaires'
  if (selector.startsWith('ids:')) return 'Ton équipe'
  const horde = /^horde:(.+):\d+$/.exec(selector)?.[1]
  if (horde) return `Horde ${teamTitle(horde)}`
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

// Its own random stream, so that trimming the teams leaves the rest of the battle as the seed dictates.
const SAME_SIZE_SEED_OFFSET = 0x5a3e

/** Keeps as many Pokémon on each side as on the smaller one, picked at random but kept in Pokédex order. */
export function trimToSameSize(teams: [TeamSetup, TeamSetup], seed: number): [TeamSetup, TeamSetup] {
  const size = Math.min(teams[0].fighters.length, teams[1].fighters.length)
  const random = createRandom(seed ^ SAME_SIZE_SEED_OFFSET)
  const trim = (team: TeamSetup): TeamSetup => {
    if (team.fighters.length === size) return team
    const kept = new Set(random.shuffle(team.fighters).slice(0, size))
    return { ...team, fighters: team.fighters.filter((fighter) => kept.has(fighter)) }
  }
  return [trim(teams[0]), trim(teams[1])]
}

export function selectTeam(pokedex: Pokedex, selector: string): TeamSetup {
  const horde = /^horde:(.+):(\d+)$/.exec(selector)
  if (horde) return { label: selector, fighters: hordeOf(pokedex, horde[1]!, Number(horde[2])) }
  const species = speciesMatching(pokedex, selector)
  if (species.length === 0) throw new Error(`Aucun Pokémon pour « ${selector} »`)
  return { label: selector, fighters: species.map((candidate) => toFighterSetup(candidate, pokedex)) }
}
