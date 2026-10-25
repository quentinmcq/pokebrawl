import { HOME_PATH } from './i18n'

/**
 * Hands a message and its link to the phone's share sheet, or copies both where there is none (most computers).
 * Says what happened, so that the button can tell the player; closing the share sheet is no failure.
 */
export async function shareLink(text: string, url: string): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  if (navigator.share) {
    try {
      await navigator.share({ text, url })
      return 'shared'
    } catch (error) {
      return error instanceof DOMException && error.name === 'AbortError' ? 'cancelled' : 'failed'
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`)
    return 'copied'
  } catch {
    return 'failed'
  }
}

/** The address of the home page in the page's language, with the given query. */
export const siteUrl = (search = '') => `${location.origin}${HOME_PATH}${search}`
