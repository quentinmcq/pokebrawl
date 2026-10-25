import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pokedex } from '../src/pokedex'

// The same cries as PokéDate's, from PokeAPI. Nearly all are Ogg Vorbis (Safari plays it since iOS 18.4), a few MP3
// under the same extension: the browser decodes them by content, whatever the name says.
const CRIES_BASE_URL = 'https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest'
const OUTPUT_DIR = join(import.meta.dirname, '..', 'public', 'cries')
const PARALLEL_DOWNLOADS = 12
const DOWNLOAD_ATTEMPTS = 4

async function download(url: string): Promise<Buffer | null> {
  for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt++) {
    const response = await fetch(url).catch(() => null)
    if (response?.ok) return Buffer.from(await response.arrayBuffer())
    if (response?.status === 404) return null
    await new Promise((resolve) => setTimeout(resolve, 800 * attempt))
  }
  throw new Error(`Échec du téléchargement : ${url}`)
}

mkdirSync(OUTPUT_DIR, { recursive: true })
const missing: number[] = []
const queue = pokedex.pokemon.map(({ id }) => id)
let downloaded = 0
await Promise.all(
  Array.from({ length: PARALLEL_DOWNLOADS }, async () => {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      const path = join(OUTPUT_DIR, `${id}.ogg`)
      if (existsSync(path)) continue
      const cry = await download(`${CRIES_BASE_URL}/${id}.ogg`)
      if (cry) writeFileSync(path, cry)
      else missing.push(id)
      if (++downloaded % 200 === 0) console.info(`  ${downloaded} cris`)
    }
  }),
)
console.info(`OK : cris dans public/cries${missing.length > 0 ? ` (introuvables : ${missing.join(', ')})` : ''}`)
