import { Container, Graphics, Text } from 'pixi.js'
import { isAlive, type Battle } from '../simulation/battle'
import { COLORS, FONT_FAMILY, type Layout } from './layout'

// The last knock-out finishes its animation before the banner covers the arena.
const DELAY_SECONDS = 0.8
const FADE_IN_SECONDS = 0.5
const PANEL_WIDTH = 760
const PANEL_HEIGHT = 250

/** A banner announcing the winner over the arena; the full end screen comes later. */
export function createEndBanner(battle: Battle, teamTitles: [string, string], { arena }: Layout) {
  const view = new Container({ visible: false })
  const centerX = arena.left + arena.width / 2
  const centerY = arena.top + arena.height / 2
  let shownForSeconds = 0

  function show() {
    const { outcome } = battle
    if (outcome === null) return
    const survivors = battle.fighters.filter(isAlive).length
    const color = outcome === 'draw' ? COLORS.text : COLORS.teams[outcome]
    const headline = outcome === 'draw' ? 'Égalité !' : `${teamTitles[outcome]} gagne !`
    const details = `${survivors} survivant${survivors > 1 ? 's' : ''}`
    const panel = new Graphics()
      .roundRect(centerX - PANEL_WIDTH / 2, centerY - PANEL_HEIGHT / 2, PANEL_WIDTH, PANEL_HEIGHT, 32)
      .fill({ color: COLORS.background, alpha: 0.88 })
      .stroke({ color, width: 6 })
    const title = new Text({
      text: headline,
      style: { fontFamily: FONT_FAMILY, fontSize: 92, fontWeight: '900', fill: color },
    })
    title.anchor.set(0.5)
    title.position.set(centerX, centerY - 34)
    if (title.width > PANEL_WIDTH - 60) title.scale.set((PANEL_WIDTH - 60) / title.width)
    const subtitle = new Text({
      text: details,
      style: { fontFamily: FONT_FAMILY, fontSize: 44, fontWeight: '600', fill: COLORS.mutedText },
    })
    subtitle.anchor.set(0.5)
    subtitle.position.set(centerX, centerY + 66)
    view.addChild(panel, title, subtitle)
    view.visible = true
  }

  function update(deltaSeconds: number) {
    if (battle.outcome === null) return
    shownForSeconds += deltaSeconds
    if (shownForSeconds < DELAY_SECONDS) return
    if (!view.visible) show()
    const progress = Math.min(1, (shownForSeconds - DELAY_SECONDS) / FADE_IN_SECONDS)
    view.alpha = progress
    view.scale.set(0.9 + 0.1 * progress)
    view.pivot.set(centerX, centerY)
    view.position.set(centerX, centerY)
  }

  return { view, update }
}
