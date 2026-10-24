import { pokedex } from '../pokedex'
import { randomSeed, type BattleParams } from '../render/params'
import { TERRAIN_NAMES, TERRAINS, terrainForSeed, isTerrain } from '../render/terrain'
import { selectTeam, TEAM_SELECTORS, teamTitle } from '../simulation/teams'

const RANDOM_TERRAIN = ''

interface MenuHandlers {
  /** The choices changed: the stage shows the line-up they would give. */
  onPreview: (params: BattleParams) => void
  onStart: (params: BattleParams) => void
}

function optionsOf(select: HTMLSelectElement, entries: [value: string, label: string][]) {
  select.replaceChildren(...entries.map(([value, label]) => new Option(label, value)))
}

const known = (select: HTMLSelectElement, value: string) => [...select.options].some((option) => option.value === value)

/** The form shown before a battle: both teams, the terrain, the seed and the same-size option. */
export function createMenu(form: HTMLFormElement, { onPreview, onStart }: MenuHandlers) {
  const field = <Element extends HTMLElement>(name: string) => form.elements.namedItem(name) as Element
  const firstTeam = field<HTMLSelectElement>('a')
  const secondTeam = field<HTMLSelectElement>('b')
  const terrain = field<HTMLSelectElement>('terrain')
  const seed = field<HTMLInputElement>('seed')
  const sameSize = field<HTMLInputElement>('same')

  const teamEntries = TEAM_SELECTORS.map((selector): [string, string] => [
    selector,
    `${teamTitle(selector)} (${selectTeam(pokedex, selector).fighters.length})`,
  ])
  optionsOf(firstTeam, teamEntries)
  optionsOf(secondTeam, teamEntries)
  optionsOf(terrain, [
    [RANDOM_TERRAIN, 'Au hasard'],
    ...TERRAINS.map((key): [string, string] => [key, TERRAIN_NAMES[key]]),
  ])

  // An empty seed means a new one at each launch; the preview keeps one so that it does not reshuffle on every change.
  let previewSeed = randomSeed()

  function readParams(): BattleParams {
    const typedSeed = Number.parseInt(seed.value, 10)
    const chosenSeed = Number.isSafeInteger(typedSeed) && typedSeed >= 0 ? typedSeed : previewSeed
    return {
      teams: [firstTeam.value, secondTeam.value],
      seed: chosenSeed,
      terrain: isTerrain(terrain.value) ? terrain.value : terrainForSeed(chosenSeed),
      sameSize: sameSize.checked,
    }
  }

  form.addEventListener('change', () => onPreview(readParams()))
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    onStart(readParams())
    previewSeed = randomSeed()
  })

  function open(current: BattleParams | null) {
    if (current) {
      if (known(firstTeam, current.teams[0])) firstTeam.value = current.teams[0]
      if (known(secondTeam, current.teams[1])) secondTeam.value = current.teams[1]
      sameSize.checked = current.sameSize
    } else {
      firstTeam.value = 'gen1'
      secondTeam.value = 'gen3'
    }
    form.hidden = false
    onPreview(readParams())
  }

  return { open, close: () => (form.hidden = true) }
}
