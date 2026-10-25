import type { Locale } from './simulation/types'

export type { Locale }
export const LOCALES: Locale[] = ['fr', 'en']

/** French lives at the root, English under /en/, as on PokéDate: the address alone tells the language. */
export const localeOfPath = (pathname: string): Locale =>
  pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'fr'

export const HOME_PATHS: Record<Locale, string> = { fr: '/', en: '/en/' }
export const MATCHUPS_PATHS: Record<Locale, string> = { fr: '/combats/', en: '/en/battles/' }
export const NUMBER_LOCALES: Record<Locale, string> = { fr: 'fr-FR', en: 'en-GB' }
