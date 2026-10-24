import { Container, Graphics, Sprite, type Spritesheet } from 'pixi.js'
import { ARENA_HEIGHT, ARENA_WIDTH, isAlive, type Fighter } from '../simulation/battle'
import { ARENA_LEFT, ARENA_TOP, COLORS, toScreenX, toScreenY, UNIT } from './layout'
import { displayedPosition, secondsSince, type Playback } from './playback'

// Sprites are larger than the collision circle: a crowd that overlaps a little reads better than tiny figures.
const SPRITE_SIZE_UNITS = 1.8
const FEET_OFFSET_UNITS = 0.45
const RING_RADIUS_X_UNITS = 0.7
const RING_RADIUS_Y_UNITS = 0.27
const HEALTH_BAR_WIDTH_UNITS = 1.2
const HEALTH_BAR_HEIGHT = 7
const HEALTH_BAR_GAP = 6
const LUNGE_SECONDS = 0.22
const LUNGE_DISTANCE_UNITS = 0.4
const HURT_FLASH_SECONDS = 0.14
const KNOCK_OUT_SECONDS = 0.6

function drawArenaFloor() {
  const width = ARENA_WIDTH * UNIT
  const height = ARENA_HEIGHT * UNIT
  return new Graphics()
    .roundRect(ARENA_LEFT, ARENA_TOP, width, height, 24)
    .fill(COLORS.arena)
    .moveTo(ARENA_LEFT + 24, ARENA_TOP + height / 2)
    .lineTo(ARENA_LEFT + width - 24, ARENA_TOP + height / 2)
    .stroke({ color: COLORS.arenaLine, width: 4 })
    .circle(ARENA_LEFT + width / 2, ARENA_TOP + height / 2, 4 * UNIT)
    .stroke({ color: COLORS.arenaLine, width: 4 })
}

function lungeOffset(playback: Playback, fighter: Fighter, x: number, y: number) {
  const effects = playback.effects[fighter.index]!
  const elapsed = secondsSince(playback, effects.attackedAtTick)
  if (elapsed === null || elapsed >= LUNGE_SECONDS || effects.attackTarget === null) return { x: 0, y: 0 }
  const target = displayedPosition(playback, playback.battle.fighters[effects.attackTarget]!)
  const distance = Math.hypot(target.x - x, target.y - y)
  if (distance === 0) return { x: 0, y: 0 }
  const reach = Math.sin((elapsed / LUNGE_SECONDS) * Math.PI) * LUNGE_DISTANCE_UNITS
  return { x: ((target.x - x) / distance) * reach, y: ((target.y - y) / distance) * reach }
}

/** Draws the floor and every fighter: a ring in the team colour, the sprite, and a health bar once hurt. */
export function createArenaView(playback: Playback, spritesheet: Spritesheet) {
  const view = new Container()
  const rings = new Graphics()
  const fighterLayer = new Container({ sortableChildren: true })
  const healthBars = new Graphics()
  view.addChild(drawArenaFloor(), rings, fighterLayer, healthBars)

  const sprites = playback.battle.fighters.map((fighter) => {
    const texture = spritesheet.textures[String(fighter.species.id)]
    if (!texture) throw new Error(`Sprite absent pour #${fighter.species.id}`)
    const sprite = new Sprite({ texture, anchor: { x: 0.5, y: 1 } })
    sprite.scale.set((SPRITE_SIZE_UNITS * UNIT) / Math.max(texture.width, texture.height))
    fighterLayer.addChild(sprite)
    return sprite
  })

  function update() {
    rings.clear()
    healthBars.clear()
    for (const fighter of playback.battle.fighters) {
      const sprite = sprites[fighter.index]!
      const position = displayedPosition(playback, fighter)
      const lunge = lungeOffset(playback, fighter, position.x, position.y)
      const screenX = toScreenX(position.x + lunge.x)
      const feetY = toScreenY(position.y + lunge.y + FEET_OFFSET_UNITS)
      sprite.position.set(screenX, feetY)
      sprite.zIndex = feetY

      // Sprites face left: turning them towards their target makes the crowd look like it is charging.
      const target = fighter.targetIndex === null ? null : playback.battle.fighters[fighter.targetIndex]
      const facingRight = target ? target.x > fighter.x : fighter.team === 0
      sprite.scale.x = Math.abs(sprite.scale.x) * (facingRight ? -1 : 1)

      if (!isAlive(fighter)) {
        const progress = Math.min(1, (secondsSince(playback, fighter.knockedOutAtTick) ?? 0) / KNOCK_OUT_SECONDS)
        sprite.visible = progress < 1
        sprite.alpha = 1 - progress
        sprite.rotation = progress * (facingRight ? 1.4 : -1.4)
        sprite.tint = COLORS.hurt
        continue
      }

      const hurtElapsed = secondsSince(playback, playback.effects[fighter.index]!.hurtAtTick)
      sprite.tint = hurtElapsed !== null && hurtElapsed < HURT_FLASH_SECONDS ? COLORS.hurt : 0xffffff

      const teamColor = COLORS.teams[fighter.team]
      rings
        .ellipse(
          toScreenX(position.x),
          toScreenY(position.y) + FEET_OFFSET_UNITS * UNIT * 0.8,
          RING_RADIUS_X_UNITS * UNIT,
          RING_RADIUS_Y_UNITS * UNIT,
        )
        .fill({ color: teamColor, alpha: 0.35 })
        .stroke({ color: teamColor, width: 3, alpha: 0.9 })

      if (fighter.hp === fighter.maxHp) continue
      const barWidth = HEALTH_BAR_WIDTH_UNITS * UNIT
      const barX = screenX - barWidth / 2
      const barY = feetY - sprite.height - HEALTH_BAR_GAP - HEALTH_BAR_HEIGHT
      healthBars
        .rect(barX - 2, barY - 2, barWidth + 4, HEALTH_BAR_HEIGHT + 4)
        .fill(COLORS.healthBackground)
        .rect(barX, barY, barWidth * (fighter.hp / fighter.maxHp), HEALTH_BAR_HEIGHT)
        .fill(teamColor)
    }
  }

  return { view, update }
}
