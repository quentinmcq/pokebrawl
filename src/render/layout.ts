import { ARENA_HEIGHT, ARENA_WIDTH, type TeamIndex } from '../simulation/battle'

// The canvas keeps the resolution of a vertical video whatever the window size; CSS scales it to fit.
export const CANVAS_WIDTH = 1080
export const CANVAS_HEIGHT = 1920
export const HUD_HEIGHT = 210
const ARENA_BOTTOM_MARGIN = 30

/** Pixels per arena unit. */
export const UNIT = Math.min(
  CANVAS_WIDTH / ARENA_WIDTH,
  (CANVAS_HEIGHT - HUD_HEIGHT - ARENA_BOTTOM_MARGIN) / ARENA_HEIGHT,
)
export const ARENA_LEFT = (CANVAS_WIDTH - ARENA_WIDTH * UNIT) / 2
export const ARENA_TOP = HUD_HEIGHT

export const toScreenX = (x: number) => ARENA_LEFT + x * UNIT
export const toScreenY = (y: number) => ARENA_TOP + y * UNIT

export const COLORS = {
  background: 0x12131f,
  text: 0xf4f3ff,
  mutedText: 0xa9acd6,
  healthBackground: 0x0b0c14,
  hurt: 0xff7070,
  teams: [0x3d9bff, 0xff4d5e] as Record<TeamIndex, number>,
}

export const FONT_FAMILY = 'system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif'
