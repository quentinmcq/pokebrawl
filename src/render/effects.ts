import { Container, Graphics, Text } from 'pixi.js'
import type { BattleEvent } from '../simulation/battle'
import { createRandom, type Random } from '../simulation/random'
import type { TypeKey } from '../simulation/types'
import { FONT_FAMILY, toScreenX, toScreenY, UNIT } from './layout'
import { displayedPosition, secondsSince, takePendingEvents, type Playback, type ShownEvent } from './playback'

type ProjectileKind = 'orb' | 'beam' | 'bolt' | 'shards' | 'leaves' | 'wave' | 'crescent'
type ImpactKind = 'burst' | 'ring' | 'star' | 'splash' | 'cloud' | 'slash'

interface TypeVisual {
  color: number
  light: number
  projectile: ProjectileKind
  impacts: ImpactKind[]
}

// One look per type rather than per move: hundreds of moves share eighteen recognisable families.
const TYPE_VISUALS: Record<TypeKey, TypeVisual> = {
  normal: { color: 0xd8d2c0, light: 0xffffff, projectile: 'orb', impacts: ['star'] },
  fire: { color: 0xff6a1a, light: 0xffd23f, projectile: 'orb', impacts: ['burst', 'cloud'] },
  water: { color: 0x3d8bff, light: 0xb8e6ff, projectile: 'beam', impacts: ['splash'] },
  electric: { color: 0xffd400, light: 0xfffbe0, projectile: 'bolt', impacts: ['burst'] },
  grass: { color: 0x3fb52e, light: 0xb6f07a, projectile: 'leaves', impacts: ['burst'] },
  ice: { color: 0x6fd8ff, light: 0xffffff, projectile: 'shards', impacts: ['star', 'burst'] },
  fighting: { color: 0xe0582a, light: 0xffc08a, projectile: 'orb', impacts: ['ring', 'star'] },
  poison: { color: 0xa64ad8, light: 0xe0a8ff, projectile: 'orb', impacts: ['cloud', 'burst'] },
  ground: { color: 0xb07c3e, light: 0xe8c890, projectile: 'orb', impacts: ['cloud', 'burst'] },
  flying: { color: 0x9cc2ff, light: 0xffffff, projectile: 'crescent', impacts: ['slash'] },
  psychic: { color: 0xff4f9e, light: 0xffc4e0, projectile: 'wave', impacts: ['ring'] },
  bug: { color: 0x9cbc18, light: 0xe0f080, projectile: 'shards', impacts: ['burst'] },
  rock: { color: 0xa08858, light: 0xe0d0a8, projectile: 'shards', impacts: ['burst', 'cloud'] },
  ghost: { color: 0x6a4ab8, light: 0xc0a8ff, projectile: 'orb', impacts: ['cloud', 'ring'] },
  dragon: { color: 0x6a5cff, light: 0xc0b8ff, projectile: 'beam', impacts: ['burst', 'ring'] },
  dark: { color: 0x3c2e3c, light: 0xd04a6a, projectile: 'wave', impacts: ['slash'] },
  steel: { color: 0xa8b4c4, light: 0xffffff, projectile: 'shards', impacts: ['star', 'burst'] },
  fairy: { color: 0xff8ad0, light: 0xffffff, projectile: 'orb', impacts: ['star', 'burst'] },
}

// Effects are drawn a third larger than the arena scale, so that they still read inside a dense crowd.
const EFFECT_UNIT = UNIT * 1.35
const SUPER_EFFECTIVE_COLOR = 0xffe14a
const KNOCK_OUT_COLOR = 0xffffff
const OUTLINE_COLOR = 0x12131f
const IMPACT_SECONDS: Record<ImpactKind, number> = {
  burst: 0.4,
  ring: 0.35,
  star: 0.28,
  splash: 0.45,
  cloud: 0.55,
  slash: 0.25,
}
const BEAM_LINGER_SECONDS = 0.12
const PARTICLES_PER_IMPACT = 7
// The busiest moments of a crowd battle launch over a hundred attacks per second; past this, plain hits go unseen.
const MAX_ACTIVE_ATTACKS = 160
const LABEL_SECONDS = 0.9
const LABEL_RISE_UNITS = 0.9
const MAX_LABELS = 6
const LABEL_HEAD_OFFSET_UNITS = 1.7

interface Particle {
  angle: number
  speed: number
  size: number
}

interface Impact {
  kind: ImpactKind
  color: number
  light: number
  scale: number
  startTick: number
  delaySeconds: number
  /** Followed until the blow lands, then fixed there. */
  targetIndex: number
  offset: { x: number; y: number }
  position: { x: number; y: number } | null
  particles: Particle[]
  rotation: number
}

interface Projectile {
  kind: ProjectileKind
  color: number
  light: number
  startTick: number
  travelSeconds: number
  from: { x: number; y: number }
  targetIndex: number
  /** Misses fly past their target. */
  offset: { x: number; y: number }
  phase: number
  /** A few zigzags drawn in turn make a lightning bolt flicker. */
  jitters: number[][]
}

interface Label {
  text: Text
  startTick: number
  x: number
  y: number
}

const channels = (color: number) => [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff] as const
const luminance = (color: number) => {
  const [red, green, blue] = channels(color)
  return (0.299 * red + 0.587 * green + 0.114 * blue) / 255
}
// Pale names vanish on sand or snow and dark ones on rock: the outline carries the rest.
const labelColorOf = ({ color, light }: TypeVisual) => (luminance(color) < 0.4 ? light : color)

const darken = (color: number, factor: number) => {
  const [red, green, blue] = channels(color).map((channel) => Math.round(channel * factor))
  return (red! << 16) | (green! << 8) | blue!
}

function createParticles(random: Random, count: number): Particle[] {
  return Array.from({ length: count }, () => ({
    angle: random.between(0, 2 * Math.PI),
    speed: random.between(1.5, 3.5),
    size: random.between(0.1, 0.2),
  }))
}

function diamond(graphics: Graphics, x: number, y: number, length: number, width: number, angle: number) {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return graphics.poly([
    x + cos * length,
    y + sin * length,
    x - sin * width,
    y + cos * width,
    x - cos * length,
    y - sin * length,
    x + sin * width,
    y - cos * width,
  ])
}

/** Projectiles, impacts and move names over the arena, all drawn from the battle's own events and clock. */
export function createEffectsView(playback: Playback, seed: number) {
  const view = new Container()
  const graphics = new Graphics()
  const labelLayer = new Container()
  view.addChild(graphics, labelLayer)
  // The effects draw on their own random stream: the same seed replays the same fireworks, for a re-recorded video.
  const random = createRandom(seed ^ 0xe11ec7)
  let projectiles: Projectile[] = []
  let impacts: Impact[] = []
  const labels: (Label | null)[] = Array.from({ length: MAX_LABELS }, () => null)
  const labelTexts = labels.map(() => {
    const text = new Text({
      text: '',
      style: {
        fontFamily: FONT_FAMILY,
        fontSize: 30,
        fontWeight: '900',
        fill: 0xffffff,
        stroke: { color: OUTLINE_COLOR, width: 6 },
      },
    })
    text.anchor.set(0.5, 1)
    text.visible = false
    labelLayer.addChild(text)
    return text
  })

  const fighterPosition = (index: number) => displayedPosition(playback, playback.battle.fighters[index]!)

  function addImpact(
    kind: ImpactKind,
    visual: { color: number; light: number },
    options: Partial<Impact> & { startTick: number; targetIndex: number },
  ) {
    impacts.push({
      kind,
      color: visual.color,
      light: visual.light,
      scale: 1,
      delaySeconds: 0,
      offset: { x: 0, y: 0 },
      position: null,
      particles: createParticles(random, PARTICLES_PER_IMPACT),
      rotation: random.between(0, Math.PI),
      ...options,
    })
  }

  function showLabel(event: Extract<BattleEvent, { kind: 'hit' }>, from: { x: number; y: number }, color: number) {
    const slot = labels.indexOf(null)
    if (slot === -1) return
    const text = labelTexts[slot]!
    text.text = event.move.names.fr
    text.style.fill = color
    text.style.fontSize = event.multiplier >= 2 ? 36 : 30
    text.visible = true
    labels[slot] = { text, startTick: event.tick, x: from.x, y: from.y - LABEL_HEAD_OFFSET_UNITS }
  }

  function addAttack({ event, from, travelSeconds }: ShownEvent, knockedOut: Set<number>) {
    if (event.kind === 'knockOut') {
      addImpact(
        'cloud',
        { color: KNOCK_OUT_COLOR, light: KNOCK_OUT_COLOR },
        {
          startTick: event.tick,
          targetIndex: event.fighter,
          delaySeconds: travelSeconds,
          scale: 1.3,
        },
      )
      addImpact(
        'star',
        { color: KNOCK_OUT_COLOR, light: SUPER_EFFECTIVE_COLOR },
        {
          startTick: event.tick,
          targetIndex: event.fighter,
          delaySeconds: travelSeconds,
          scale: 0.8,
        },
      )
      return
    }
    const visual = TYPE_VISUALS[event.move.type]
    const hit = event.kind === 'hit'
    const superEffective = hit && event.multiplier >= 2
    const notable = superEffective || (hit && (event.critical || knockedOut.has(event.target)))
    if (!notable && projectiles.length + impacts.length / 2 > MAX_ACTIVE_ATTACKS) return

    const offset = hit ? { x: 0, y: 0 } : { x: random.between(-1, 1) * 1.2, y: random.between(-1, 1) * 1.2 }
    if (event.move.category === 'special') {
      projectiles.push({
        kind: visual.projectile,
        color: visual.color,
        light: visual.light,
        startTick: event.tick,
        travelSeconds,
        from,
        targetIndex: event.target,
        offset,
        phase: random.between(0, 2 * Math.PI),
        jitters: Array.from({ length: 3 }, () => Array.from({ length: 4 }, () => random.between(-0.35, 0.35))),
      })
    }
    if (!hit) return

    const scale = superEffective ? 1.5 : event.multiplier < 1 ? 0.7 : 1
    const timing = { startTick: event.tick, targetIndex: event.target, delaySeconds: travelSeconds, scale }
    for (const kind of visual.impacts) addImpact(kind, visual, timing)
    if (event.move.category === 'physical' && !visual.impacts.includes('star'))
      addImpact('star', { color: 0xffffff, light: visual.light }, { ...timing, scale: scale * 0.7 })
    if (superEffective) addImpact('ring', { color: SUPER_EFFECTIVE_COLOR, light: 0xffffff }, { ...timing, scale: 1.6 })
    if (event.critical) addImpact('star', { color: 0xffffff, light: SUPER_EFFECTIVE_COLOR }, { ...timing, scale: 1.4 })
    if (notable) showLabel(event, from, labelColorOf(visual))
  }

  function drawProjectile(projectile: Projectile, age: number) {
    const target = fighterPosition(projectile.targetIndex)
    const to = { x: target.x + projectile.offset.x, y: target.y + projectile.offset.y }
    const progress = projectile.travelSeconds > 0 ? Math.min(1, age / projectile.travelSeconds) : 1
    const at = (share: number) => ({
      x: toScreenX(projectile.from.x + (to.x - projectile.from.x) * share),
      y: toScreenY(projectile.from.y + (to.y - projectile.from.y) * share),
    })
    const head = at(progress)
    const start = at(0)
    const angle = Math.atan2(to.y - projectile.from.y, to.x - projectile.from.x)
    const outline = darken(projectile.color, 0.55)
    const linger = Math.max(0, 1 - (age - projectile.travelSeconds) / BEAM_LINGER_SECONDS)

    switch (projectile.kind) {
      case 'orb': {
        for (let trail = 3; trail >= 1; trail--) {
          const point = at(Math.max(0, progress - trail * 0.12))
          graphics
            .circle(point.x, point.y, (0.2 - trail * 0.04) * EFFECT_UNIT)
            .fill({ color: projectile.color, alpha: 0.5 / trail })
        }
        graphics.circle(head.x, head.y, 0.36 * EFFECT_UNIT).fill({ color: projectile.light, alpha: 0.35 })
        graphics
          .circle(head.x, head.y, 0.22 * EFFECT_UNIT)
          .fill(projectile.color)
          .stroke({ color: outline, width: 2 })
        graphics
          .circle(head.x - 0.06 * EFFECT_UNIT, head.y - 0.06 * EFFECT_UNIT, 0.08 * EFFECT_UNIT)
          .fill(projectile.light)
        break
      }
      case 'beam': {
        // The beam grows to its target, then fades out whole.
        const width = age <= projectile.travelSeconds ? 1 : linger
        for (const [thickness, color] of [
          [0.24, projectile.color],
          [0.09, projectile.light],
        ] as const) {
          graphics
            .moveTo(start.x, start.y)
            .lineTo(head.x, head.y)
            .stroke({ color, width: thickness * EFFECT_UNIT * width, alpha: 0.9, cap: 'round' })
        }
        break
      }
      case 'bolt': {
        const end = at(1)
        const jitter = projectile.jitters[Math.floor(age * 30) % projectile.jitters.length]!
        const normal = { x: -Math.sin(angle), y: Math.cos(angle) }
        const points = [start]
        jitter.forEach((offset, index) => {
          const point = at((index + 1) / (jitter.length + 1))
          points.push({ x: point.x + normal.x * offset * EFFECT_UNIT, y: point.y + normal.y * offset * EFFECT_UNIT })
        })
        points.push(end)
        const alpha = Math.max(0, 1 - age / (projectile.travelSeconds + 0.15))
        for (const [width, color] of [
          [0.2, projectile.color],
          [0.07, projectile.light],
        ] as const) {
          graphics.moveTo(points[0]!.x, points[0]!.y)
          for (const point of points.slice(1)) graphics.lineTo(point.x, point.y)
          graphics.stroke({ color, width: width * EFFECT_UNIT, alpha, cap: 'round', join: 'round' })
        }
        break
      }
      case 'shards':
      case 'leaves': {
        const normal = { x: -Math.sin(angle), y: Math.cos(angle) }
        for (let index = 0; index < 3; index++) {
          const share = Math.max(0, progress - index * 0.1)
          const point = at(share)
          const swirl =
            projectile.kind === 'leaves'
              ? Math.sin(projectile.phase + share * 9 + index * 2) * 0.35
              : (index - 1) * 0.18
          const x = point.x + normal.x * swirl * EFFECT_UNIT
          const y = point.y + normal.y * swirl * EFFECT_UNIT
          const spin = projectile.kind === 'leaves' ? projectile.phase + age * 18 + index : angle
          diamond(graphics, x, y, 0.2 * EFFECT_UNIT, 0.08 * EFFECT_UNIT, spin)
            .fill(projectile.color)
            .stroke({ color: outline, width: 1.5 })
        }
        break
      }
      case 'wave': {
        for (let ring = 0; ring < 2; ring++) {
          const point = at(Math.max(0, progress - ring * 0.18))
          graphics.circle(point.x, point.y, (0.22 + ring * 0.12 + progress * 0.12) * EFFECT_UNIT).stroke({
            color: ring === 0 ? projectile.color : projectile.light,
            width: 0.08 * EFFECT_UNIT,
            alpha: 0.9 - ring * 0.3,
          })
        }
        break
      }
      case 'crescent': {
        const radius = 0.32 * EFFECT_UNIT
        const startAngle = angle - Math.PI / 2
        graphics
          .moveTo(head.x + Math.cos(startAngle) * radius, head.y + Math.sin(startAngle) * radius)
          .arc(head.x, head.y, radius, startAngle, startAngle + Math.PI)
          .stroke({ color: projectile.color, width: 0.12 * EFFECT_UNIT, cap: 'round' })
          .moveTo(head.x + Math.cos(startAngle) * radius * 0.7, head.y + Math.sin(startAngle) * radius * 0.7)
          .arc(head.x, head.y, radius * 0.7, startAngle, startAngle + Math.PI)
          .stroke({ color: projectile.light, width: 0.06 * EFFECT_UNIT, cap: 'round' })
        break
      }
    }
  }

  function drawImpact(impact: Impact, age: number) {
    if (!impact.position) {
      const target = fighterPosition(impact.targetIndex)
      impact.position = { x: target.x + impact.offset.x, y: target.y + impact.offset.y }
    }
    const x = toScreenX(impact.position.x)
    // Impacts land on the body rather than at the feet.
    const y = toScreenY(impact.position.y - 0.5)
    const progress = age / IMPACT_SECONDS[impact.kind]
    const fade = 1 - progress
    const size = impact.scale * EFFECT_UNIT

    switch (impact.kind) {
      case 'burst':
      case 'splash':
        for (const particle of impact.particles) {
          const distance = particle.speed * age * impact.scale
          const fall = impact.kind === 'splash' ? 6 * age * age - 1.2 * age : 0
          const px = x + Math.cos(particle.angle) * distance * EFFECT_UNIT
          const py =
            y + (Math.sin(particle.angle) * distance * (impact.kind === 'splash' ? 0.5 : 1) + fall) * EFFECT_UNIT
          const color = particle.size > 0.15 ? impact.color : impact.light
          graphics.circle(px, py, particle.size * size * (0.4 + 0.6 * fade)).fill({ color, alpha: fade })
        }
        break
      case 'ring':
        graphics
          .circle(x, y, (0.25 + progress * 0.85) * size)
          .stroke({ color: impact.color, width: 0.12 * size * fade + 1, alpha: fade })
        break
      case 'star':
        graphics
          .star(x, y, 4, (0.3 + 0.5 * Math.sin(Math.min(1, progress) * Math.PI)) * size, 0.12 * size, impact.rotation)
          .fill({ color: impact.light, alpha: fade })
          .stroke({ color: impact.color, width: 2, alpha: fade })
        break
      case 'cloud':
        impact.particles.slice(0, 4).forEach((particle) => {
          const distance = (0.2 + progress * 0.4) * impact.scale
          graphics
            .circle(
              x + Math.cos(particle.angle) * distance * EFFECT_UNIT,
              y + Math.sin(particle.angle) * distance * EFFECT_UNIT * 0.6,
              (0.22 + progress * 0.2) * size,
            )
            .fill({ color: impact.color, alpha: 0.55 * fade })
        })
        break
      case 'slash':
        for (let line = 0; line < 2; line++) {
          const angle = impact.rotation + line * 1.1
          const reveal = Math.min(1, progress * 2.5)
          const half = 0.6 * size
          const startX = x - Math.cos(angle) * half
          const startY = y - Math.sin(angle) * half
          graphics
            .moveTo(startX, startY)
            .lineTo(startX + Math.cos(angle) * 2 * half * reveal, startY + Math.sin(angle) * 2 * half * reveal)
            .stroke({ color: line === 0 ? impact.light : impact.color, width: 0.09 * size, alpha: fade, cap: 'round' })
        }
        break
    }
  }

  function drawLabels() {
    labels.forEach((label, slot) => {
      if (!label) return
      const age = secondsSince(playback, label.startTick) ?? 0
      if (age >= LABEL_SECONDS) {
        label.text.visible = false
        labels[slot] = null
        return
      }
      const progress = age / LABEL_SECONDS
      label.text.position.set(toScreenX(label.x), toScreenY(label.y - progress * LABEL_RISE_UNITS))
      label.text.alpha = Math.min(1, progress * 8, (1 - progress) * 3)
      label.text.scale.set(Math.min(1, 0.6 + progress * 4))
    })
  }

  function update() {
    const shown = takePendingEvents(playback)
    const knockedOut = new Set(shown.flatMap(({ event }) => (event.kind === 'knockOut' ? [event.fighter] : [])))
    for (const event of shown) addAttack(event, knockedOut)

    graphics.clear()
    projectiles = projectiles.filter((projectile) => {
      const age = secondsSince(playback, projectile.startTick) ?? 0
      const lifetime = projectile.travelSeconds + (projectile.kind === 'bolt' ? 0.15 : BEAM_LINGER_SECONDS)
      if (age > lifetime) return false
      if (age <= projectile.travelSeconds || projectile.kind === 'beam' || projectile.kind === 'bolt')
        drawProjectile(projectile, age)
      return true
    })
    impacts = impacts.filter((impact) => {
      const age = (secondsSince(playback, impact.startTick) ?? 0) - impact.delaySeconds
      if (age > IMPACT_SECONDS[impact.kind]) return false
      if (age >= 0) drawImpact(impact, age)
      return true
    })
    drawLabels()
  }

  return { view, update }
}
