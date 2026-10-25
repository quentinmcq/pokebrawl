const DOWNLOAD_ATTEMPTS = 4

/** A file from the web, tried a few times over a shaky connection; `null` when it does not exist. */
export async function download(url: string): Promise<Buffer | null> {
  for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt++) {
    const response = await fetch(url).catch(() => null)
    if (response?.ok) return Buffer.from(await response.arrayBuffer())
    if (response?.status === 404) return null
    await new Promise((resolve) => setTimeout(resolve, 800 * attempt))
  }
  throw new Error(`Échec du téléchargement : ${url}`)
}
