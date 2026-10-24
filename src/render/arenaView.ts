import { Container, Graphics, Sprite, Texture, type Spritesheet } from 'pixi.js'
import { isAlive, type Fighter } from '../simulation/battle'
import { COLORS, type Layout } from './layout'
import { displayedPosition, secondsSince, type Playback } from './playback'
import { paintTerrain, type Terrain } from './terrain'

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

// Terrain pixels are twice the size of screen pixels, about the scale of the Pokémon sprites drawn over them.
const TERRAIN_PIXEL_SIZE = 2

function createTerrainSprite(terrain: Terrain, seed: number, { arena }: Layout) {
  const { width, height } = arena
  const canvas = paintTerrain(
    terrain,
    seed,
    Math.round(width / TERRAIN_PIXEL_SIZE),
    Math.round(height / TERRAIN_PIXEL_SIZE),
  )
  const texture = Texture.from(canvas)
  texture.source.scaleMode = 'nearest'
  const sprite = new Sprite(texture)
  sprite.position.set(arena.left, arena.top)
  sprite.setSize(width, height)
  return sprite
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

/** Draws the ground and every fighter: a ring in the team colour, the sprite, and a health bar once hurt. */
export function createArenaView(
  playback: Playback,
  spritesheet: Spritesheet,
  terrain: Terrain,
  seed: number,
  layout: Layout,
) {
  const { unit } = layout
  const view = new Container()
  const rings = new Graphics()
  const fighterLayer = new Container({ sortableChildren: true })
  const healthBars = new Graphics()
  const ground = createTerrainSprite(terrain, seed, layout)
  view.addChild(ground, rings, fighterLayer, healthBars)

  const sprites = playback.battle.fighters.map((fighter) => {
    const texture = spritesheet.textures[String(fighter.species.id)]
    if (!texture) throw new Error(`Sprite absent pour #${fighter.species.id}`)
    const sprite = new Sprite({ texture, anchor: { x: 0.5, y: 1 } })
    sprite.scale.set((SPRITE_SIZE_UNITS * unit) / Math.max(texture.width, texture.height))
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
      const feet = layout.toScreen(position.x, position.y)
      const body = layout.toScreen(position.x + lunge.x, position.y + lunge.y)
      const screenX = body.x
      const feetY = body.y + FEET_OFFSET_UNITS * unit
      sprite.position.set(screenX, feetY)
      sprite.zIndex = feetY

      // Sprites face left: turning them towards their target makes the crowd look like it is charging.
      const target = fighter.targetIndex === null ? null : playback.battle.fighters[fighter.targetIndex]
      const facingRight = target ? layout.toScreen(target.x, target.y).x > feet.x : fighter.team === 0
      sprite.scale.x = Math.abs(sprite.scale.x) * (facingRight ? -1 : 1)

      const effects = playback.effects[fighter.index]!
      if (!isAlive(fighter)) {
        // The fall waits for the blow to land, so that a fighter never drops before the projectile reaches it.
        const elapsed = (secondsSince(playback, fighter.knockedOutAtTick) ?? 0) - effects.knockOutDelaySeconds
        const progress = Math.min(1, Math.max(0, elapsed) / KNOCK_OUT_SECONDS)
        sprite.visible = progress < 1
        sprite.alpha = 1 - progress
        sprite.rotation = progress * (facingRight ? 1.4 : -1.4)
        sprite.tint = elapsed >= 0 ? COLORS.hurt : 0xffffff
        continue
      }

      const hurtElapsed = (secondsSince(playback, effects.hurtAtTick) ?? -1) - effects.hurtDelaySeconds
      sprite.tint = hurtElapsed >= 0 && hurtElapsed < HURT_FLASH_SECONDS ? COLORS.hurt : 0xffffff

      const teamColor = COLORS.teams[fighter.team]
      rings
        .ellipse(
          feet.x,
          feet.y + FEET_OFFSET_UNITS * unit * 0.8,
          RING_RADIUS_X_UNITS * unit,
          RING_RADIUS_Y_UNITS * unit,
        )
        .fill({ color: teamColor, alpha: 0.35 })
        .stroke({ color: teamColor, width: 3, alpha: 0.9 })

      if (fighter.hp === fighter.maxHp) continue
      const barWidth = HEALTH_BAR_WIDTH_UNITS * unit
      const barX = screenX - barWidth / 2
      const barY = feetY - sprite.height - HEALTH_BAR_GAP - HEALTH_BAR_HEIGHT
      healthBars
        .rect(barX - 2, barY - 2, barWidth + 4, HEALTH_BAR_HEIGHT + 4)
        .fill(COLORS.healthBackground)
        .rect(barX, barY, barWidth * (fighter.hp / fighter.maxHp), HEALTH_BAR_HEIGHT)
        .fill(teamColor)
    }
  }

  // The ground texture belongs to this battle alone, unlike the shared spritesheet.
  const groundTexture = ground.texture
  const destroy = () => {
    view.destroy({ children: true })
    groundTexture.destroy(true)
  }

  return { view, update, destroy }
}
