import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const SPRITE_CACHE_DIR = join(import.meta.dirname, '..', '.cache', 'sprites')
const ICONS_DIR = join(import.meta.dirname, '..', 'public', 'icons')
const PIKACHU = 25
const CHARMANDER = 4

// Two rivals face off over the colours of both camps; maskable icons keep them inside the central safe zone.
function background(size: number) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" fill="#12131f"/>
  <polygon points="0,0 ${size * 0.62},0 ${size * 0.38},${size} 0,${size}" fill="#3d9bff" opacity="0.85"/>
  <polygon points="${size * 0.62},0 ${size},0 ${size},${size} ${size * 0.38},${size}" fill="#ff4d5e" opacity="0.85"/>
  <polygon points="${size * 0.58},0 ${size * 0.66},0 ${size * 0.42},${size} ${size * 0.34},${size}" fill="#ffd23f"/>
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

mkdirSync(ICONS_DIR, { recursive: true })
const outputs: [name: string, size: number, safeZone: number][] = [
  ['icon-192.png', 192, 1],
  ['icon-512.png', 512, 1],
  ['icon-maskable-512.png', 512, 0.75],
  ['apple-touch-icon.png', 180, 0.9],
  ['favicon.png', 48, 1.1],
]
for (const [name, size, safeZone] of outputs) writeFileSync(join(ICONS_DIR, name), await icon(size, safeZone))
console.info(`OK : ${outputs.length} icônes dans public/icons (à partir des sprites en cache de « bun run sprites »)`)
