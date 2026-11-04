import { Container, Graphics } from 'pixi.js'
import { isAlive } from '../simulation/battle'
import type { Layout } from './layout'
import { displayedPosition, type Playback } from './playback'

// On a phone, 270 Pokémon across the arena are about 20 pixels each: the camera closes in on the melee instead.
const MAX_ZOOM = 2.5
// The few fighters that wander away from the crowd would otherwise keep the camera wide open.
const CROWD_SHARE = 0.8
const MARGIN_UNITS = 3
// A front line spans the whole width of an upright arena: framing all of it would never zoom. The shot may be this much
// narrower (or shorter) than the crowd, centred on its middle, as long as the other side of the crowd still fits.
const CROP_ALLOWANCE = 1.8
// How fast the camera catches up with the crowd, per second of battle: smooth, never a jump.
const FOLLOW_RATE = 1.2

interface Framing {
  zoom: number
  x: number
  y: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function quantile(sorted: number[], share: number) {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(share * (sorted.length - 1))))]!
}

/**
 * Holds the arena and its effects, and frames the crowd still standing. It only reads the battle, so one seed always
 * gives the same shots, in a recorded video too. Off, or once the battle is over, it shows the whole arena.
 */
export function createCamera(playback: Playback, layout: Layout) {
  const { arena } = layout
  const center = { x: arena.left + arena.width / 2, y: arena.top + arena.height / 2 }
  const view = new Container()
  const content = new Container()
  const mask = new Graphics({ visible: false }).rect(arena.left, arena.top, arena.width, arena.height).fill(0xffffff)
  view.addChild(content, mask)
  const overview: Framing = { zoom: 1, ...center }
  let current: Framing = { ...overview }
  let masked = false

  function crowdFraming(): Framing {
    const alive = playback.battle.fighters.filter(isAlive)
    if (alive.length === 0 || playback.battle.outcome !== null) return overview
    const corners = alive.map((fighter) => {
      const { x, y } = displayedPosition(playback, fighter)
      return layout.toScreen(x, y)
    })
    const xs = corners.map(({ x }) => x).toSorted((a, b) => a - b)
    const ys = corners.map(({ y }) => y).toSorted((a, b) => a - b)
    const outside = (1 - CROWD_SHARE) / 2
    const margin = MARGIN_UNITS * layout.unit
    const left = quantile(xs, outside) - margin
    const right = quantile(xs, 1 - outside) + margin
    const top = quantile(ys, outside) - margin
    const bottom = quantile(ys, 1 - outside) + margin
    const widthFit = arena.width / (right - left)
    const heightFit = arena.height / (bottom - top)
    const zoom = clamp(
      Math.min(widthFit, heightFit) * CROP_ALLOWANCE,
      1,
      Math.min(MAX_ZOOM, Math.max(widthFit, heightFit)),
    )
    // The shot never leaves the arena: near an edge, it slides back inside rather than show the void around it.
    const halfWidth = arena.width / zoom / 2
    const halfHeight = arena.height / zoom / 2
    return {
      zoom,
      x: clamp(quantile(xs, 0.5), arena.left + halfWidth, arena.left + arena.width - halfWidth),
      y: clamp(quantile(ys, 0.5), arena.top + halfHeight, arena.top + arena.height - halfHeight),
    }
  }

  function apply() {
    content.scale.set(current.zoom)
    content.pivot.set(current.x, current.y)
    content.position.set(center.x, center.y)
    // Unzoomed, nothing spills out of the arena: no mask, so the sprites at its top edge keep their heads. Setting a
    // mask rebuilds how PixiJS draws the whole scene: only when it changes, never at every frame.
    const zoomed = current.zoom > 1.001
    if (zoomed !== masked) {
      masked = zoomed
      content.mask = zoomed ? mask : null
      mask.visible = zoomed
    }
  }

  function update(seconds: number, following: boolean) {
    const target = following ? crowdFraming() : overview
    const progress = 1 - Math.exp(-FOLLOW_RATE * seconds)
    current = {
      zoom: current.zoom + (target.zoom - current.zoom) * progress,
      x: current.x + (target.x - current.x) * progress,
      y: current.y + (target.y - current.y) * progress,
    }
    apply()
  }

  /** Jumps straight to the right shot, for a battle skipped to its end or a redrawn screen. */
  function snap(following: boolean) {
    current = following ? crowdFraming() : { ...overview }
    apply()
  }

  apply()
  return { view, content, update, snap }
}
