import { TEAM_SELECTORS, teamTitle } from './simulation/teams'

/** A battle worth a page of its own: two ready-made teams, such as Gen 1 against Gen 3, or Fire against Water. */
export interface Matchup {
  teams: [string, string]
  slug: string
  title: string
}

const generations = TEAM_SELECTORS.filter((selector) => selector.startsWith('gen'))
const types = TEAM_SELECTORS.filter((selector) => selector.startsWith('type:'))

// « Type Feu » reads better as just « Feu » in a page title.
export const shortTitle = (selector: string) => teamTitle(selector).replace(/^Type /, '')

const slugOf = (selector: string) =>
  shortTitle(selector)
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')

const matchupOf = (first: string, second: string): Matchup => ({
  teams: [first, second],
  slug: `${slugOf(first)}-contre-${slugOf(second)}`,
  title: `${shortTitle(first)} contre ${shortTitle(second)}`,
})

const pairsOf = (selectors: string[]) =>
  selectors.flatMap((first, index) => selectors.slice(index + 1).map((second) => matchupOf(first, second)))

/** Every page: each pair of generations, each pair of types, and the legendaries against each generation. */
export const MATCHUPS: Matchup[] = [
  ...pairsOf(generations),
  ...pairsOf(types),
  ...generations.map((generation) => matchupOf('legendaries', generation)),
]

export const matchupPath = ({ slug }: Matchup) => `/combats/${slug}/`
