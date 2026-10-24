import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const SPRITE_CACHE_DIR = join(import.meta.dirname, '..', '.cache', 'sprites')
const ICONS_DIR = join(import.meta.dirname, '..', 'public', 'icons')
const PIKACHU = 25
const CHARMANDER = 4

// Two rivals face off over the colours of both camps; maskable icons keep them inside the central safe zone.
function background(width: number, height = width) {
  const x = (share: number) => width * share
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="#12131f"/>
  <polygon points="0,0 ${x(0.62)},0 ${x(0.38)},${height} 0,${height}" fill="#3d9bff" opacity="0.85"/>
  <polygon points="${x(0.62)},0 ${width},0 ${width},${height} ${x(0.38)},${height}" fill="#ff4d5e" opacity="0.85"/>
  <polygon points="${x(0.58)},0 ${x(0.66)},0 ${x(0.42)},${height} ${x(0.34)},${height}" fill="#ffd23f"/>
</svg>`)
}

async function fighter(id: number, height: number, mirrored: boolean) {
  const trimmed = sharp(readFileSync(join(SPRITE_CACHE_DIR, `${id}.png`))).trim()
  const resized = await trimmed.resize({ height, kernel: 'nearest' }).png().toBuffer()
  return mirrored ? sharp(resized).flop().png().toBuffer() : resized
}

async function icon(size: number, safeZone: number) {
  const spriteHeight = Math.round(size * 0.42 * safeZone)
  const left = await fighter(PIKACHU, spriteHeight, true)
  const right = await fighter(CHARMANDER, spriteHeight, false)
  const leftWidth = (await sharp(left).metadata()).width
  const top = Math.round(size / 2 - spriteHeight / 2)
  const gap = Math.round(size * 0.04 * safeZone)
  return sharp(background(size))
    .composite([
      { input: left, left: Math.round(size / 2 - gap - leftWidth), top },
      { input: right, left: Math.round(size / 2 + gap), top },
    ])
    .png()
    .toBuffer()
}

// The picture shown when a link to PokéBrawl is shared in a messaging app.
async function linkPreview() {
  const [width, height] = [1200, 630]
  const spriteHeight = 300
  const left = await fighter(PIKACHU, spriteHeight, true)
  const right = await fighter(CHARMANDER, spriteHeight, false)
  const leftWidth = (await sharp(left).metadata()).width
  const text = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect x="250" y="430" width="700" height="150" rx="28" fill="#12131f" opacity="0.9"/>
  <text x="600" y="512" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="78" font-weight="800" fill="#f4f3ff">Poké<tspan fill="#ffd23f">Brawl</tspan></text>
  <text x="600" y="558" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="28" fill="#a9acd6">Compose ton équipe, bats la horde, défie tes amis</text>
</svg>`)
  return sharp(background(width, height))
    .composite([
      { input: left, left: Math.round(width / 2 - 40 - leftWidth), top: 90 },
      { input: right, left: Math.round(width / 2 + 40), top: 90 },
      { input: text, left: 0, top: 0 },
    ])
    .png()
    .toBuffer()
}

mkdirSync(ICONS_DIR, { recursive: true })
const outputs: [name: string, size: number, safeZone: number][] = [
  ['icon-192.png', 192, 1],
  ['icon-512.png', 512, 1],
  ['icon-maskable-512.png', 512, 0.75],
  ['apple-touch-icon.png', 180, 0.9],
  ['favicon.png', 48, 1.1],
]
for (const [name, size, safeZone] of outputs) writeFileSync(join(ICONS_DIR, name), await icon(size, safeZone))
writeFileSync(join(ICONS_DIR, '..', 'og.png'), await linkPreview())
console.info(
  `OK : ${outputs.length} icônes dans public/icons et l'image d'aperçu public/og.png (à partir des sprites en cache de « bun run sprites »)`,
)
