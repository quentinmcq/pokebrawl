import { Container, Graphics, Text, type TextStyleOptions } from 'pixi.js'
import { isAlive, secondsAt, type Battle, type TeamIndex } from '../simulation/battle'
import { CANVAS_WIDTH, COLORS, FONT_FAMILY, HUD_HEIGHT } from './layout'

const SIDE_MARGIN = 56
const HEALTH_BAR_Y = 168
const HEALTH_BAR_HEIGHT = 18

const textStyle = (fontSize: number, fill: number, fontWeight: TextStyleOptions['fontWeight'] = '800') => ({
  fontFamily: FONT_FAMILY,
  fontSize,
  fontWeight,
  fill,
})

const aliveCount = (battle: Battle, team: TeamIndex) =>
  battle.fighters.filter((fighter) => fighter.team === team && isAlive(fighter)).length

const remainingHealth = (battle: Battle, team: TeamIndex) =>
  battle.fighters.reduce((total, fighter) => (fighter.team === team ? total + fighter.hp : total), 0)

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

// Changing a Text re-renders its texture, so each one is only touched when its value changes.
const setText = (text: Text, value: string) => {
  if (text.text !== value) text.text = value
}

/** The band above the arena: each team's name and survivors, the clock, and the share of health left on each side. */
export function createHud(battle: Battle, teamTitles: [string, string]) {
  const view = new Container()
  view.addChild(new Graphics().rect(0, 0, CANVAS_WIDTH, HUD_HEIGHT).fill(COLORS.background))

  const titles = teamTitles.map((title, team) => {
    const text = new Text({ text: title, style: textStyle(40, COLORS.teams[team as TeamIndex], '700') })
    text.anchor.set(team === 0 ? 0 : 1, 0)
    text.position.set(team === 0 ? SIDE_MARGIN : CANVAS_WIDTH - SIDE_MARGIN, 28)
    return text
  })
  const counts = ([0, 1] as const).map((team) => {
    const text = new Text({ text: '', style: textStyle(76, COLORS.text) })
    text.anchor.set(team === 0 ? 0 : 1, 0)
    text.position.set(team === 0 ? SIDE_MARGIN : CANVAS_WIDTH - SIDE_MARGIN, 68)
    return text
  })
  const versus = new Text({ text: 'VS', style: textStyle(36, COLORS.mutedText) })
  versus.anchor.set(0.5, 0)
  versus.position.set(CANVAS_WIDTH / 2, 40)
  const timer = new Text({ text: '', style: textStyle(40, COLORS.text, '600') })
  timer.anchor.set(0.5, 0)
  timer.position.set(CANVAS_WIDTH / 2, 92)
  const healthBar = new Graphics()
  view.addChild(...titles, ...counts, versus, timer, healthBar)

  function update() {
    counts.forEach((text, team) => setText(text, String(aliveCount(battle, team as TeamIndex))))
    setText(timer, clock(secondsAt(battle.tick)))

    const firstHealth = remainingHealth(battle, 0)
    const secondHealth = remainingHealth(battle, 1)
    const barWidth = CANVAS_WIDTH - 2 * SIDE_MARGIN
    const firstWidth = barWidth * (firstHealth / Math.max(1, firstHealth + secondHealth))
    healthBar
      .clear()
      .roundRect(SIDE_MARGIN, HEALTH_BAR_Y, barWidth, HEALTH_BAR_HEIGHT, HEALTH_BAR_HEIGHT / 2)
      .fill(COLORS.teams[1])
      .roundRect(SIDE_MARGIN, HEALTH_BAR_Y, firstWidth, HEALTH_BAR_HEIGHT, HEALTH_BAR_HEIGHT / 2)
      .fill(COLORS.teams[0])
  }

  update()
  return { view, update }
}
