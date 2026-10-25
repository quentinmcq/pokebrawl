/**
 * A group of buttons where one is pressed, with a highlight that slides to it rather than jumping, as on PokéDate.
 * Call it again whenever the pressed button changes.
 */
export function slideSegmented(group: HTMLElement) {
  const buttons = [...group.querySelectorAll<HTMLButtonElement>(':scope > button')]
  if (!group.querySelector(':scope > .segmented-indicator')) {
    group.classList.add('segmented--slide')
    group.prepend(
      Object.assign(document.createElement('span'), { className: 'segmented-indicator', ariaHidden: 'true' }),
    )
  }
  group.style.setProperty('--count', String(buttons.length))
  group.style.setProperty(
    '--active-index',
    String(
      Math.max(
        0,
        buttons.findIndex((button) => button.ariaPressed === 'true'),
      ),
    ),
  )
}
