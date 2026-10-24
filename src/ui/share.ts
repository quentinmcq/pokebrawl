/**
 * Hands a message and its link to the phone's share sheet, or copies both where there is none (most computers).
 * Says what happened, so that the button can tell the player.
 */
export async function shareLink(text: string, url: string): Promise<'shared' | 'copied' | 'failed'> {
  if (navigator.share) {
    try {
      await navigator.share({ text, url })
      return 'shared'
    } catch {
      return 'failed'
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`)
    return 'copied'
  } catch {
    return 'failed'
  }
}

export const siteUrl = (search = '') => `${location.origin}${import.meta.env.BASE_URL}${search}`
