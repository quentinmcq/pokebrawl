import { ARENA_HEIGHT, ARENA_WIDTH, type TeamIndex } from '../simulation/battle'

type Orientation = 'portrait' | 'landscape'

export const HUD_HEIGHT = 210
const ARENA_MARGIN = 30
const LANDSCAPE_HUD_SCALE = 0.7

/**
 * Where the arena sits on the canvas. The canvas keeps a video resolution whatever the window size (CSS scales it):
 * 1080 × 1920 upright for phones and vertical videos, 1920 × 1080 on wide screens. Landscape shows the same arena
 * turned a quarter, the first team on the left: the simulation never changes, so one seed is one battle in both.
 */
export interface Layout {
  orientation: Orientation
  width: number
  height: number
  /** Pixels per arena unit. */
  unit: number
  /** The score band is laid out at the upright size, then shrunk on wide screens, where it would take a fifth of the height. */
  hudScale: number
  arena: { left: number; top: number; width: number; height: number }
  toScreen: (x: number, y: number) => { x: number; y: number }
}

export const orientationOf = (width: number, height: number): Orientation => (width > height ? 'landscape' : 'portrait')

export function createLayout(orientation: Orientation): Layout {
  const landscape = orientation === 'landscape'
  const width = landscape ? 1920 : 1080
  const height = landscape ? 1080 : 1920
  const columns = landscape ? ARENA_HEIGHT : ARENA_WIDTH
  const rows = landscape ? ARENA_WIDTH : ARENA_HEIGHT
  const hudScale = landscape ? LANDSCAPE_HUD_SCALE : 1
  const hudHeight = HUD_HEIGHT * hudScale
  const unit = Math.min((width - 2 * ARENA_MARGIN) / columns, (height - hudHeight - ARENA_MARGIN) / rows)
  const arena = { left: (width - columns * unit) / 2, top: hudHeight, width: columns * unit, height: rows * unit }
  return {
    orientation,
    width,
    height,
    unit,
    hudScale,
    arena,
    toScreen: landscape
      ? (x, y) => ({ x: arena.left + y * unit, y: arena.top + x * unit })
      : (x, y) => ({ x: arena.left + x * unit, y: arena.top + y * unit }),
  }
}

export const COLORS = {
  background: 0x12131f,
  text: 0xf4f3ff,
  mutedText: 0xa9acd6,
  healthBackground: 0x0b0c14,
  hurt: 0xff7070,
  teams: [0x3d9bff, 0xff4d5e] as Record<TeamIndex, number>,
}

export const FONT_FAMILY = 'system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif'
// Safari on iPhone measures the system font a little narrower than it draws it at some sizes: without room around
// each text, PixiJS cut off its last letter.
export const textPaddingFor = (fontSize: number) => Math.ceil(fontSize * 0.3)
