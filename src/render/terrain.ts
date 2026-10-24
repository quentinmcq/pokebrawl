import { createRandom, type Random } from '../simulation/random'

export const TERRAINS = ['grass', 'sand', 'snow', 'cave'] as const
export type Terrain = (typeof TERRAINS)[number]

export const TERRAIN_NAMES: Record<Terrain, string> = {
  grass: 'Prairie',
  sand: 'Désert',
  snow: 'Toundra',
  cave: 'Grotte',
}

export const isTerrain = (value: unknown): value is Terrain => TERRAINS.includes(value as Terrain)

// The ground has its own random stream, so that changing a terrain never changes the battle itself.
const TERRAIN_SEED_OFFSET = 0x7e44a1
export const terrainForSeed = (seed: number): Terrain => TERRAINS[createRandom(seed ^ TERRAIN_SEED_OFFSET).integer(4)]!

/** A tiny pixel drawing: each character picks a colour from the terrain palette, `.` is transparent. */
type Pattern = readonly string[]

interface Decoration {
  pattern: Pattern
  /** Average number of copies per 10 000 terrain pixels. */
  density: number
  /** Copies scattered around each spot, for clumps of flowers, stones or crystals. */
  group?: number
}

interface TerrainStyle {
  /** Dark, base and light tones of the ground, mixed with a dithered noise. */
  ground: [string, string, string]
  palette: Record<string, string>
  decorations: Decoration[]
  cracks?: { color: string; density: number }
  border: string
  lines: { color: string; alpha: number }
}

const TUFT: Pattern = ['..l...l..', 'l.l.l.l.l', 'dldldldld', '.ddddddd.']
// The tall grass where wild Pokémon hide, as a tile repeated in small patches.
const TALL_GRASS: Pattern = ['.l....l.', 'lLl..lLl', 'dLd..dLd', 'dLdl.dLd', 'ddlLlddd', '.ddLdd..', '..dddd..']
const FLOWER: Pattern = ['.w.', 'wyw', '.w.']
const RED_FLOWER: Pattern = ['.r.', 'ryr', '.r.']
const PEBBLE: Pattern = ['.SS.', 'Sssk', '.kk.']
const ROCK: Pattern = ['..SSS...', '.SSsss..', 'SSssssk.', 'Sssssskk', '.kkkkkk.']
const RIPPLE: Pattern = ['....rrrr....', '..rr....rr..', 'rr........rr']
const CACTUS: Pattern = [
  '...g...',
  '..gGg..',
  'g.gGg..',
  'gGgGg.g',
  '.ggGgGg',
  '..gGgg.',
  '..gGg..',
  '..gGg..',
  '.kkkkk.',
]
const DRY_TUFT: Pattern = ['b..b..b', '.b.b.b.', '..bbb..']
const SNOW_MOUND: Pattern = ['...wwww...', '.wwwwwwww.', 'wwwwwwwwss', '.ssssssss.']
const SNOWY_ROCK: Pattern = ['..www...', '.wwwww..', 'wwwwwws.', 'sssssskk', '.kkkkkk.']
const SPARKLE: Pattern = ['.w.', 'www', '.w.']
const CRYSTAL: Pattern = ['...C...', '..cC...', '..cCc.C', '.CcCccC', 'cCcCcCc', 'kkkkkkk']
const PURPLE_CRYSTAL: Pattern = ['.P.', 'pP.', 'pPp', 'pPp', 'kkk']

const STYLES: Record<Terrain, TerrainStyle> = {
  grass: {
    ground: ['#4a9141', '#4f9a45', '#58a74d'],
    palette: {
      d: '#3a7533',
      l: '#7cc463',
      L: '#96d97a',
      w: '#f4f4e8',
      y: '#ffd84a',
      r: '#ff6b6b',
      s: '#9aa0a6',
      S: '#c7ccd1',
      k: '#3d6e35',
    },
    decorations: [
      { pattern: TUFT, density: 9 },
      { pattern: TALL_GRASS, density: 0.25, group: 6 },
      { pattern: FLOWER, density: 0.8, group: 4 },
      { pattern: RED_FLOWER, density: 0.4, group: 3 },
      { pattern: ROCK, density: 0.25 },
    ],
    border: '#2f5e2a',
    lines: { color: '#ffffff', alpha: 0.32 },
  },
  sand: {
    ground: ['#dbb873', '#e2c27c', '#e9cd8e'],
    palette: { r: '#c99f58', s: '#a88a5a', S: '#f3e3b5', k: '#b8955a', g: '#4f8a3e', G: '#76b35a', b: '#b59a4a' },
    decorations: [
      { pattern: RIPPLE, density: 7 },
      { pattern: PEBBLE, density: 0.8, group: 3 },
      { pattern: ROCK, density: 0.35 },
      { pattern: DRY_TUFT, density: 1.5 },
      { pattern: CACTUS, density: 0.3 },
    ],
    border: '#a8844a',
    lines: { color: '#ffffff', alpha: 0.35 },
  },
  snow: {
    ground: ['#d6e2f0', '#e2ebf6', '#eef4fb'],
    palette: { w: '#ffffff', s: '#b4c6dc', k: '#7d8a9a' },
    decorations: [
      { pattern: SNOW_MOUND, density: 2 },
      { pattern: SPARKLE, density: 1.5, group: 3 },
      { pattern: SNOWY_ROCK, density: 0.5 },
    ],
    cracks: { color: '#b4cbe3', density: 0.8 },
    border: '#9fb3cc',
    lines: { color: '#6f8fb8', alpha: 0.35 },
  },
  cave: {
    ground: ['#524c48', '#5b5551', '#645d58'],
    palette: { s: '#7a726b', S: '#958c84', k: '#3a3532', c: '#4fb5e8', C: '#b4ecff', p: '#9a62d8', P: '#dcb8ff' },
    decorations: [
      { pattern: PEBBLE, density: 1.5, group: 3 },
      { pattern: ROCK, density: 1 },
      { pattern: CRYSTAL, density: 0.2, group: 2 },
      { pattern: PURPLE_CRYSTAL, density: 0.25, group: 3 },
    ],
    cracks: { color: '#3a3532', density: 2 },
    border: '#2e2a27',
    lines: { color: '#e8e0d8', alpha: 0.22 },
  },
}

const NOISE_CELL_SIZE = 30
const DETAIL_CELL_SIZE = 9
const DETAIL_WEIGHT = 0.35
const GROUP_SPREAD = 9
const DITHER_STRENGTH = 0.22
const TONE_THRESHOLDS = [0.4, 0.62]
// Ordered dithering gives the soft patches between tones the look of hand-placed pixels.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
const BORDER_WIDTH = 3
const LINE_WIDTH = 2
const LINE_INSET = 10
const CORNER_RADIUS = 12

const toRgb = (hex: string) => [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16))
const smooth = (value: number) => value * value * (3 - 2 * value)

function valueNoise(width: number, height: number, cellSize: number, random: Random) {
  const columns = Math.ceil(width / cellSize) + 2
  const rows = Math.ceil(height / cellSize) + 2
  const grid = Array.from({ length: columns * rows }, () => random.next())
  const at = (column: number, row: number) => grid[row * columns + column]!
  return (x: number, y: number) => {
    const column = Math.floor(x / cellSize)
    const row = Math.floor(y / cellSize)
    const dx = smooth(x / cellSize - column)
    const dy = smooth(y / cellSize - row)
    const top = at(column, row) + (at(column + 1, row) - at(column, row)) * dx
    const bottom = at(column, row + 1) + (at(column + 1, row + 1) - at(column, row + 1)) * dx
    return top + (bottom - top) * dy
  }
}

function paintGround(context: CanvasRenderingContext2D, style: TerrainStyle, random: Random) {
  const { width, height } = context.canvas
  const image = context.createImageData(width, height)
  const tones = style.ground.map(toRgb)
  // A finer second layer breaks the blocky outline that a single coarse grid leaves.
  const coarse = valueNoise(width, height, NOISE_CELL_SIZE, random)
  const detail = valueNoise(width, height, DETAIL_CELL_SIZE, random)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dither = (BAYER[(y % 4) * 4 + (x % 4)]! / 16 - 0.5) * DITHER_STRENGTH
      const value = coarse(x, y) * (1 - DETAIL_WEIGHT) + detail(x, y) * DETAIL_WEIGHT + dither
      const tone = tones[value < TONE_THRESHOLDS[0]! ? 0 : value < TONE_THRESHOLDS[1]! ? 1 : 2]!
      const offset = (y * width + x) * 4
      image.data.set([tone[0]!, tone[1]!, tone[2]!, 255], offset)
    }
  }
  context.putImageData(image, 0, 0)
}

function stamp(
  context: CanvasRenderingContext2D,
  pattern: Pattern,
  palette: Record<string, string>,
  x: number,
  y: number,
) {
  pattern.forEach((line, row) => {
    for (let column = 0; column < line.length; column++) {
      const color = palette[line[column]!]
      if (!color) continue
      context.fillStyle = color
      context.fillRect(x + column, y + row, 1, 1)
    }
  })
}

function paintCracks(context: CanvasRenderingContext2D, cracks: NonNullable<TerrainStyle['cracks']>, random: Random) {
  const { width, height } = context.canvas
  const count = Math.round(((width * height) / 10_000) * cracks.density)
  context.fillStyle = cracks.color
  for (let crack = 0; crack < count; crack++) {
    let x = random.integer(width)
    let y = random.integer(height)
    let direction = random.between(0, 2 * Math.PI)
    const length = 8 + random.integer(24)
    for (let step = 0; step < length; step++) {
      context.fillRect(Math.round(x), Math.round(y), 1, 1)
      direction += random.between(-0.6, 0.6)
      x += Math.cos(direction)
      y += Math.sin(direction)
    }
  }
}

function paintLines(context: CanvasRenderingContext2D, style: TerrainStyle) {
  const { width, height } = context.canvas
  context.globalAlpha = style.lines.alpha
  context.fillStyle = style.lines.color
  const inset = LINE_INSET
  context.fillRect(inset, inset, width - 2 * inset, LINE_WIDTH)
  context.fillRect(inset, height - inset - LINE_WIDTH, width - 2 * inset, LINE_WIDTH)
  context.fillRect(inset, inset, LINE_WIDTH, height - 2 * inset)
  context.fillRect(width - inset - LINE_WIDTH, inset, LINE_WIDTH, height - 2 * inset)
  context.fillRect(inset, Math.round(height / 2 - LINE_WIDTH / 2), width - 2 * inset, LINE_WIDTH)
  // A pixel circle drawn point by point stays crisp once the texture is scaled up.
  const radius = Math.round(width * 0.11)
  const points = new Set<string>()
  for (let step = 0; step < 720; step++) {
    const angle = (step / 720) * 2 * Math.PI
    points.add(
      `${Math.round(width / 2 + Math.cos(angle) * radius)},${Math.round(height / 2 + Math.sin(angle) * radius)}`,
    )
  }
  for (const point of points) {
    const [x, y] = point.split(',').map(Number)
    context.fillRect(x! - 1, y! - 1, LINE_WIDTH, LINE_WIDTH)
  }
  context.globalAlpha = 1
}

function paintBorder(context: CanvasRenderingContext2D, style: TerrainStyle) {
  const { width, height } = context.canvas
  context.strokeStyle = style.border
  context.lineWidth = BORDER_WIDTH * 2
  context.beginPath()
  context.roundRect(0, 0, width, height, CORNER_RADIUS)
  context.stroke()
  context.globalCompositeOperation = 'destination-in'
  context.beginPath()
  context.roundRect(0, 0, width, height, CORNER_RADIUS)
  context.fill()
  context.globalCompositeOperation = 'source-over'
}

/** Paints a pixel-art ground of the given size; the same terrain and seed always give the same picture. */
export function paintTerrain(terrain: Terrain, seed: number, width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D indisponible')
  const style = STYLES[terrain]
  const random = createRandom(seed ^ TERRAIN_SEED_OFFSET)

  paintGround(context, style, random)
  if (style.cracks) paintCracks(context, style.cracks, random)
  for (const { pattern, density, group = 1 } of style.decorations) {
    const count = Math.round(((width * height) / 10_000) * density)
    const patternWidth = pattern[0]!.length
    for (let spot = 0; spot < count; spot++) {
      const x = random.integer(width - patternWidth)
      const y = random.integer(height - pattern.length)
      for (let copy = 0; copy < group; copy++) {
        const spread = copy === 0 ? 0 : GROUP_SPREAD
        const copyX = Math.round(x + random.between(-spread, spread))
        const copyY = Math.round(y + random.between(-spread, spread) / 2)
        stamp(context, pattern, style.palette, copyX, copyY)
      }
    }
  }
  paintLines(context, style)
  paintBorder(context, style)
  return canvas
}
