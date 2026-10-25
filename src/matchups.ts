import { MATCHUPS_PATHS, type Locale } from './locale'
import { TEAM_SELECTORS, TYPE_NAMES, teamTitle } from './simulation/teams'
import type { TypeKey } from './simulation/types'
import { withoutDiacritics } from './text'

/**
 * A battle worth a page of its own: two ready-made teams, such as Gen 1 against Gen 3, or Fire against Water. Its
 * French slug identifies it, in the simulated results too; each language has its own title and address.
 */
export interface Matchup {
  teams: [string, string]
  slug: string
}

const generations = TEAM_SELECTORS.filter((selector) => selector.startsWith('gen'))
const types = TEAM_SELECTORS.filter((selector) => selector.startsWith('type:'))

// « Type Feu » or « Fire Type » reads better as just « Feu » or « Fire » in a page title.
export const shortTitle = (selector: string, locale: Locale) => {
  const type = /^type:([a-z]+)$/.exec(selector)?.[1]
  return type ? TYPE_NAMES[locale][type as TypeKey] : teamTitle(selector, locale)
}

const slugOf = (selector: string, locale: Locale) =>
  withoutDiacritics(shortTitle(selector, locale)).replaceAll(/[^a-z0-9]+/g, '-')

const VERSUS: Record<Locale, string> = { fr: 'contre', en: 'vs' }

export const matchupTitle = ({ teams }: Pick<Matchup, 'teams'>, locale: Locale) =>
  `${shortTitle(teams[0], locale)} ${VERSUS[locale]} ${shortTitle(teams[1], locale)}`

const matchupSlug = ({ teams }: Pick<Matchup, 'teams'>, locale: Locale) =>
  `${slugOf(teams[0], locale)}-${VERSUS[locale]}-${slugOf(teams[1], locale)}`

const matchupOf = (first: string, second: string): Matchup => {
  const teams: [string, string] = [first, second]
  return { teams, slug: matchupSlug({ teams }, 'fr') }
}

const pairsOf = (selectors: string[]) =>
  selectors.flatMap((first, index) => selectors.slice(index + 1).map((second) => matchupOf(first, second)))

/** Every page: each pair of generations, each pair of types, and the legendaries against each generation. */
export const MATCHUPS: Matchup[] = [
  ...pairsOf(generations),
  ...pairsOf(types),
  ...generations.map((generation) => matchupOf('legendaries', generation)),
]

export const matchupPath = (matchup: Matchup, locale: Locale) =>
  `${MATCHUPS_PATHS[locale]}${matchupSlug(matchup, locale)}/`
