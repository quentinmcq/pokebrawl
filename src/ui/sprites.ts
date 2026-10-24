import type { Spritesheet } from 'pixi.js'

/**
 * A Pokémon sprite as an HTML element, cut out of the sheet the arena already loaded. Its size comes from the CSS
 * `--size` of its context, so that one element works in a card, a team chip or a strip.
 */
export function createSpriteFactory(spritesheet: Spritesheet) {
  const { frames, meta } = spritesheet.data
  const sheetSize = meta.size!
  const imageUrl = `${import.meta.env.BASE_URL}${meta.image}`

  return (speciesId: number) => {
    const element = document.createElement('span')
    element.className = 'sprite'
    const { frame } = frames[String(speciesId)]!
    const properties = {
      '--x': frame.x,
      '--y': frame.y,
      '--w': frame.w,
      '--h': frame.h,
      '--extent': Math.max(frame.w, frame.h),
      '--sheet-w': sheetSize.w,
      '--sheet-h': sheetSize.h,
    }
    for (const [name, value] of Object.entries(properties)) element.style.setProperty(name, String(value))
    element.style.backgroundImage = `url(${imageUrl})`
    return element
  }
}
