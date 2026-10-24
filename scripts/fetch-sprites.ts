import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import sharp, { type OverlayOptions } from 'sharp'
import { pokedex } from '../src/pokedex'

const CACHE_DIR = join(import.meta.dirname, '..', '.cache', 'sprites')
const PUBLIC_DIR = join(import.meta.dirname, '..', 'public')
const SPRITES_BASE_URL = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon'
const PARALLEL_DOWNLOADS = 12
const DOWNLOAD_ATTEMPTS = 4
const SPRITE_SIZE = 96
const SHEET_WIDTH = 2048
// Neighbours in the sheet stay apart so that linear filtering never bleeds one sprite into another.
const SHEET_PADDING = 2
const MAX_TEXTURE_SIZE = 4096
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 }

async function download(url: string): Promise<Buffer | null> {
  for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt++) {
    const response = await fetch(url).catch(() => null)
    if (response?.ok) return Buffer.from(await response.arrayBuffer())
    if (response?.status === 404) return null
    await new Promise((resolve) => setTimeout(resolve, 800 * attempt))
  }
  throw new Error(`Échec du téléchargement : ${url}`)
}

const builtFromArtwork: number[] = []

// The newest Pokémon have no pixel sprite yet: their official artwork, shrunk to the same size, stands in.
async function spriteOf(id: number): Promise<Buffer> {
  const cachePath = join(CACHE_DIR, `${id}.png`)
  if (existsSync(cachePath)) return readFileSync(cachePath)
  let sprite = await download(`${SPRITES_BASE_URL}/${id}.png`)
  if (!sprite) {
    const artwork = await download(`${SPRITES_BASE_URL}/other/official-artwork/${id}.png`)
    if (!artwork) throw new Error(`Aucune image pour #${id}`)
    builtFromArtwork.push(id)
    sprite = await sharp(artwork)
      .resize(SPRITE_SIZE, SPRITE_SIZE, { fit: 'contain', background: TRANSPARENT })
      .png()
      .toBuffer()
  }
  mkdirSync(dirname(cachePath), { recursive: true })
  writeFileSync(cachePath, sprite)
  return sprite
}

// Sprites are drawn at one size in the arena, so their transparent margins are trimmed away.
async function trimmed(sprite: Buffer) {
  const { data, info } = await sharp(sprite).trim().png().toBuffer({ resolveWithObject: true })
  return { image: data, width: info.width, height: info.height }
}

const ids = pokedex.pokemon.map((species) => species.id)
const sprites = new Map<number, Awaited<ReturnType<typeof trimmed>>>()
const queue = [...ids]
await Promise.all(
  Array.from({ length: PARALLEL_DOWNLOADS }, async () => {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      sprites.set(id, await trimmed(await spriteOf(id)))
      if (sprites.size % 200 === 0) console.info(`  ${sprites.size}/${ids.length}`)
    }
  }),
)

// Shelf packing in Pokédex order: good enough for sprites of similar sizes, and the sheet stays readable.
const frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }> = {}
const placements: OverlayOptions[] = []
let x = 0
let y = 0
let shelfHeight = 0
for (const id of ids) {
  const sprite = sprites.get(id)!
  if (x + sprite.width > SHEET_WIDTH) {
    x = 0
    y += shelfHeight + SHEET_PADDING
    shelfHeight = 0
  }
  frames[id] = { frame: { x, y, w: sprite.width, h: sprite.height } }
  placements.push({ input: sprite.image, left: x, top: y })
  x += sprite.width + SHEET_PADDING
  shelfHeight = Math.max(shelfHeight, sprite.height)
}
const sheetHeight = y + shelfHeight
if (sheetHeight > MAX_TEXTURE_SIZE) throw new Error(`Planche trop haute pour un GPU mobile : ${sheetHeight} px`)

const sheet = await sharp({
  create: { width: SHEET_WIDTH, height: sheetHeight, channels: 4, background: TRANSPARENT },
})
  .composite(placements)
  .webp({ lossless: true })
  .toBuffer()
mkdirSync(PUBLIC_DIR, { recursive: true })
writeFileSync(join(PUBLIC_DIR, 'sprites.webp'), sheet)
writeFileSync(
  join(PUBLIC_DIR, 'sprites.json'),
  JSON.stringify({ frames, meta: { image: 'sprites.webp', size: { w: SHEET_WIDTH, h: sheetHeight }, scale: 1 } }),
)

console.info(
  `OK : ${ids.length} sprites dans public/sprites.webp (${SHEET_WIDTH} × ${sheetHeight}, ${Math.round(sheet.length / 1024)} Ko)`,
)
if (builtFromArtwork.length > 0) console.info(`Fabriqués à partir de l'artwork : ${builtFromArtwork.join(', ')}`)
