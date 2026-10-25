import { HOME_PATHS, localeOfPath, type Locale } from '../locale'
import { MESSAGES, TRANSLATED_ATTRIBUTES, type PageKey } from '../messages'

/** The language of the page, from its address: `/en/` is English, the rest French. */
export const LOCALE: Locale = typeof location === 'undefined' ? 'fr' : localeOfPath(location.pathname)
export const TEXT = MESSAGES[LOCALE]

/** A Pokémon's or a move's name in the page's language. */
export const nameOf = ({ names }: { names: Record<Locale, string> }) => names[LOCALE]

/** The home page in the page's language, where the app lives. */
export const HOME_PATH = HOME_PATHS[LOCALE]

/** Writes the page's texts in its language; the HTML is French, so a French page is left as it is. */
export function translatePage() {
  document.documentElement.lang = LOCALE
  if (LOCALE === 'fr') return
  for (const element of document.querySelectorAll<HTMLElement>('[data-i18n]'))
    element.innerHTML = TEXT.page[element.dataset.i18n as PageKey]
  for (const attribute of TRANSLATED_ATTRIBUTES)
    for (const element of document.querySelectorAll(`[data-i18n-${attribute}]`))
      element.setAttribute(attribute, TEXT.page[element.getAttribute(`data-i18n-${attribute}`) as PageKey])
}
