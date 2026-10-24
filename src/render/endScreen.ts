import { Container, Graphics, Sprite, Text, Texture, type Spritesheet, type TextStyleOptions } from 'pixi.js'
import { summarizeBattle, type Battle, type Fighter } from '../simulation/battle'
import { COLORS, FONT_FAMILY, type Layout } from './layout'

// The last knock-out finishes its animation before the screen covers the arena.
const DELAY_SECONDS = 0.8
const FADE_IN_SECONDS = 0.5
// Laid out once at this size, then scaled to fit the arena whichever way it is turned.
const PANEL_WIDTH = 880
const PANEL_HEIGHT = 1230
const FIT_SHARE = 0.94
const MVP_SPRITE_SIZE = 230
const PODIUM_SIZE = 3
const PODIUM_SPRITE_SIZE = 96
const SURVIVORS_PER_ROW = 9
const SURVIVOR_ROWS = 2
const SURVIVOR_SPRITE_SIZE = 72
const BOB_PIXELS = 8

const style = (fontSize: number, fill: number, fontWeight: TextStyleOptions['fontWeight'] = '800') => ({
  fontFamily: FONT_FAMILY,
  fontSize,
  fontWeight,
  fill,
})

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? 's' : ''}`
const statsOf = (fighter: Fighter) =>
  `${fighter.knockOuts} K.O. · ${Math.round(fighter.damageDealt).toLocaleString('fr-FR')} dégâts`

/**
 * Pixel sprites blown up several times turn to mush when smoothed: the end screen copies its few large sprites out
 * of the shared sheet into textures of their own, enlarged without smoothing.
 */
function crispTexture(texture: Texture) {
  const { frame } = texture
  const canvas = document.createElement('canvas')
  canvas.width = frame.width
  canvas.height = frame.height
  const context = canvas.getContext('2d')!
  context.drawImage(
    texture.source.resource as CanvasImageSource,
    frame.x,
    frame.y,
    frame.width,
    frame.height,
    0,
    0,
    frame.width,
    frame.height,
  )
  const crisp = Texture.from(canvas)
  crisp.source.scaleMode = 'nearest'
  return crisp
}

/** The winner, the most valuable Pokémon, the podium and the survivors, over the arena once the battle is over. */
export function createEndScreen(
  battle: Battle,
  teamTitles: [string, string],
  spritesheet: Spritesheet,
  layout: Layout,
) {
  const { arena } = layout
  const view = new Container({ visible: false })
  const panel = new Container()
  view.addChild(panel)
  const ownTextures: Texture[] = []
  let mvpSprite: Sprite | null = null
  let shownForSeconds = 0

  function addText(text: string, textStyle: TextStyleOptions, x: number, y: number, maxWidth = PANEL_WIDTH - 60) {
    const label = new Text({ text, style: textStyle })
    label.anchor.set(0.5, 0)
    label.position.set(x, y)
    if (label.width > maxWidth) label.scale.set(maxWidth / label.width)
    panel.addChild(label)
    return label
  }

  function addSprite(fighter: Fighter, size: number, x: number, bottom: number, crisp: boolean) {
    const sheetTexture = spritesheet.textures[String(fighter.species.id)]!
    const texture = crisp ? crispTexture(sheetTexture) : sheetTexture
    if (crisp) ownTextures.push(texture)
    const sprite = new Sprite({ texture, anchor: { x: 0.5, y: 1 } })
    sprite.scale.set(size / Math.max(texture.width, texture.height))
    // Sprites face left; turned towards the middle, the podium looks at its champion.
    if (x < PANEL_WIDTH / 2) sprite.scale.x *= -1
    sprite.position.set(x, bottom)
    panel.addChild(sprite)
    return sprite
  }

  function addHeading(text: string, y: number) {
    addText(text.toUpperCase(), { ...style(26, COLORS.mutedText, '700'), letterSpacing: 4 }, PANEL_WIDTH / 2, y)
  }

  function show() {
    const { outcome, durationSeconds, survivors, mostValuable } = summarizeBattle(battle)
    const winnerColor = outcome === 'draw' ? COLORS.text : COLORS.teams[outcome]
    const winners = outcome === 'draw' ? [] : survivors[outcome]

    panel.addChild(
      new Graphics()
        .roundRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 40)
        .fill({ color: COLORS.background, alpha: 0.92 })
        .stroke({ color: winnerColor, width: 6 }),
    )
    const headline = outcome === 'draw' ? 'Égalité !' : `${teamTitles[outcome]} gagne !`
    addText(headline, style(88, winnerColor, '900'), PANEL_WIDTH / 2, 44)
    addText(
      `${plural(winners.length, 'survivant')} · ${clock(durationSeconds)}`,
      style(40, COLORS.mutedText, '600'),
      PANEL_WIDTH / 2,
      150,
    )

    addHeading('Meilleur Pokémon', 240)
    const mvpColor = COLORS.teams[mostValuable.team]
    panel.addChild(
      new Graphics()
        .ellipse(PANEL_WIDTH / 2, 505, 150, 34)
        .fill({ color: mvpColor, alpha: 0.35 })
        .stroke({ color: mvpColor, width: 5 }),
    )
    mvpSprite = addSprite(mostValuable, MVP_SPRITE_SIZE, PANEL_WIDTH / 2, 515, true)
    mvpSprite.scale.x = -Math.abs(mvpSprite.scale.x)
    addText(mostValuable.species.names.fr, style(60, COLORS.text, '900'), PANEL_WIDTH / 2, 535)
    addText(statsOf(mostValuable), style(36, mvpColor, '700'), PANEL_WIDTH / 2, 610)

    const podium = battle.fighters
      .filter((fighter) => fighter !== mostValuable)
      .toSorted((a, b) => b.knockOuts - a.knockOuts || b.damageDealt - a.damageDealt)
      .slice(0, PODIUM_SIZE)
    addHeading('Ensuite', 690)
    const columnWidth = PANEL_WIDTH / PODIUM_SIZE
    podium.forEach((fighter, rank) => {
      const x = columnWidth * (rank + 0.5)
      addSprite(fighter, PODIUM_SPRITE_SIZE, x, 840, true)
      addText(fighter.species.names.fr, style(30, COLORS.teams[fighter.team], '800'), x, 850, columnWidth - 20)
      addText(`${fighter.knockOuts} K.O.`, style(28, COLORS.mutedText, '600'), x, 890, columnWidth - 20)
    })

    if (winners.length === 0) return
    addHeading('Survivants', 960)
    const shown = winners.slice(0, SURVIVORS_PER_ROW * SURVIVOR_ROWS)
    const cellWidth = (PANEL_WIDTH - 60) / SURVIVORS_PER_ROW
    shown.forEach((fighter, index) => {
      const column = index % SURVIVORS_PER_ROW
      const row = Math.floor(index / SURVIVORS_PER_ROW)
      addSprite(fighter, SURVIVOR_SPRITE_SIZE, 30 + cellWidth * (column + 0.5), 1075 + row * 80, false)
    })
    const hidden = winners.length - shown.length
    if (hidden > 0) addText(`et ${hidden} autres`, style(26, COLORS.mutedText, '600'), PANEL_WIDTH / 2, 1170)
  }

  function update(deltaSeconds: number) {
    if (battle.outcome === null) return
    shownForSeconds += deltaSeconds
    if (shownForSeconds < DELAY_SECONDS) return
    if (!view.visible) {
      show()
      view.visible = true
    }
    const progress = Math.min(1, (shownForSeconds - DELAY_SECONDS) / FADE_IN_SECONDS)
    const fit = Math.min((arena.width * FIT_SHARE) / PANEL_WIDTH, (arena.height * FIT_SHARE) / PANEL_HEIGHT)
    view.alpha = progress
    panel.pivot.set(PANEL_WIDTH / 2, PANEL_HEIGHT / 2)
    panel.scale.set(fit * (0.9 + 0.1 * progress))
    panel.position.set(arena.left + arena.width / 2, arena.top + arena.height / 2)
    if (mvpSprite) mvpSprite.y = 515 - Math.abs(Math.sin(shownForSeconds * 3)) * BOB_PIXELS
  }

  function destroy() {
    view.destroy({ children: true })
    for (const texture of ownTextures) texture.destroy(true)
  }

  return { view, update, destroy }
}
