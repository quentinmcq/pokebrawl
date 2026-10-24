import { pokedex } from '../pokedex'
import { typeColor } from '../render/effects'
import { randomSeed, type BattleParams } from '../render/params'
import { terrainForSeed } from '../render/terrain'
import { costOf, MAX_TEAM_SIZE, TEAM_BUDGET, teamCost } from '../simulation/cost'
import { hordeOf, TEAM_SELECTORS, TYPE_NAMES_FR, teamTitle, toFighterSetup } from '../simulation/teams'
import type { Species, TypeKey } from '../simulation/types'
import { readStored, writeStored } from './storage'

const LEVELS = [800, 1000, 1250]
const DEFAULT_CHALLENGE = { horde: 'gen1', level: 1000 }
const STORAGE_KEYS = { team: 'pokebrawl.team', challenge: 'pokebrawl.challenge', wins: 'pokebrawl.wins' }
const ALL = ''

interface Entry {
  species: Species
  cost: number
  searchName: string
}

interface ComposerHandlers {
  spriteOf: (speciesId: number) => HTMLElement
  onFight: (params: BattleParams) => void
  onSpectate: () => void
}

const normalized = (text: string) =>
  text
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLowerCase()
const hordeSelector = (horde: string, level: number) => `horde:${horde}:${level}`

/** `ids:25*3,6` back into how many of each Pokémon; anything malformed gives an empty team. */
function parseTeam(selector: string | undefined) {
  const team = new Map<number, number>()
  const ids = /^ids:([\d,*]+)$/.exec(selector ?? '')?.[1]
  for (const entry of ids?.split(',') ?? []) {
    const [id, count = 1] = entry.split('*').map(Number)
    if (pokedex.pokemon[id! - 1] && Number.isInteger(count) && count > 0) team.set(id!, (team.get(id!) ?? 0) + count)
  }
  return team
}

const teamSelector = (team: Map<number, number>) =>
  `ids:${[...team]
    .toSorted(([a], [b]) => a - b)
    .map(([id, count]) => (count > 1 ? `${id}*${count}` : String(id)))
    .join(',')}`

/** The home screen of the game: pick a horde to beat, then spend the budget on any Pokémon, as many times as wished. */
export function createComposer(section: HTMLElement, { spriteOf, onFight, onSpectate }: ComposerHandlers) {
  const query = <Element extends HTMLElement>(selector: string) => section.querySelector<Element>(selector)!
  const hordeSelect = query<HTMLSelectElement>('select[name="horde"]')
  const levelButtons = [...section.querySelectorAll<HTMLButtonElement>('[data-level]')]
  const searchInput = query<HTMLInputElement>('input[name="search"]')
  const typeSelect = query<HTMLSelectElement>('select[name="type"]')
  const generationSelect = query<HTMLSelectElement>('select[name="generation"]')
  const sortSelect = query<HTMLSelectElement>('select[name="sort"]')
  const fightButton = query<HTMLButtonElement>('[data-action="fight"]')

  const entries: Entry[] = pokedex.pokemon.map((species) => ({
    species,
    cost: costOf(toFighterSetup(species, pokedex)),
    searchName: normalized(`${species.names.fr} ${species.names.en}`),
  }))
  const entryOf = (id: number) => entries[id - 1]!

  let team = parseTeam(readStored<string | undefined>(STORAGE_KEYS.team, undefined))
  let challenge = readStored(STORAGE_KEYS.challenge, DEFAULT_CHALLENGE)
  const wins = new Set(readStored<string[]>(STORAGE_KEYS.wins, []))

  typeSelect.replaceChildren(
    new Option('Tous les types', ALL),
    ...Object.entries(TYPE_NAMES_FR).map(([key, name]) => new Option(name, key)),
  )
  generationSelect.replaceChildren(
    new Option('Toutes les générations', ALL),
    ...Array.from({ length: 9 }, (_, index) => new Option(`Gen ${index + 1}`, String(index + 1))),
  )

  const teamSize = () => [...team.values()].reduce((total, count) => total + count, 0)
  const spent = () => [...team].reduce((total, [id, count]) => total + entryOf(id).cost * count, 0)

  function renderChallenge() {
    hordeSelect.replaceChildren(
      ...TEAM_SELECTORS.map((selector) => {
        const beaten = wins.has(hordeSelector(selector, challenge.level))
        return new Option(`${teamTitle(selector)}${beaten ? ' ✓' : ''}`, selector)
      }),
    )
    hordeSelect.value = challenge.horde
    for (const button of levelButtons) button.ariaPressed = String(Number(button.dataset.level) === challenge.level)
    const horde = hordeOf(pokedex, challenge.horde, challenge.level)
    const beaten = wins.has(hordeSelector(challenge.horde, challenge.level))
    query('[data-role="horde-summary"]').textContent =
      `${horde.length} Pokémon · ${teamCost(horde)} points${beaten ? ' · déjà battue ✓' : ''}`
    query('[data-role="horde"]').replaceChildren(...horde.map(({ species }) => spriteOf(species.id)))
  }

  function renderTeam() {
    const used = spent()
    const size = teamSize()
    query<HTMLElement>('.budget-fill').style.width = `${(100 * used) / TEAM_BUDGET}%`
    query('[data-role="budget-summary"]').textContent =
      `${used} / ${TEAM_BUDGET} points · ${size} Pokémon${size >= MAX_TEAM_SIZE ? ' (maximum)' : ''}`
    query('[data-role="team"]').replaceChildren(
      ...[...team]
        .toSorted(([a], [b]) => a - b)
        .map(([id, count]) => {
          const chip = document.createElement('button')
          chip.type = 'button'
          chip.className = 'chip'
          chip.dataset.id = String(id)
          chip.title = `Retirer un ${entryOf(id).species.names.fr}`
          chip.append(spriteOf(id))
          if (count > 1)
            chip.append(
              Object.assign(document.createElement('span'), { className: 'chip-count', textContent: `×${count}` }),
            )
          return chip
        }),
    )
    query('[data-role="team-hint"]').hidden = size > 0
    fightButton.disabled = size === 0
    const left = TEAM_BUDGET - used
    for (const card of cards.values()) card.disabled = Number(card.dataset.cost) > left || size >= MAX_TEAM_SIZE
  }

  const cards = new Map<number, HTMLButtonElement>()
  function cardOf({ species, cost }: Entry) {
    const existing = cards.get(species.id)
    if (existing) return existing
    const card = document.createElement('button')
    card.type = 'button'
    card.className = 'card'
    card.dataset.id = String(species.id)
    card.dataset.cost = String(cost)
    const types = document.createElement('span')
    types.className = 'card-types'
    for (const type of species.types) {
      const dot = document.createElement('i')
      dot.style.background = `#${typeColor(type).toString(16).padStart(6, '0')}`
      dot.title = TYPE_NAMES_FR[type]
      types.append(dot)
    }
    card.append(
      spriteOf(species.id),
      Object.assign(document.createElement('span'), { className: 'card-name', textContent: species.names.fr }),
      Object.assign(document.createElement('span'), { className: 'card-cost', textContent: String(cost) }),
      types,
    )
    cards.set(species.id, card)
    return card
  }

  function renderCards() {
    const search = normalized(searchInput.value.trim())
    const type = typeSelect.value as TypeKey | typeof ALL
    const generation = Number(generationSelect.value)
    const sort = sortSelect.value
    const shown = entries
      .filter(({ species, searchName }) => {
        if (search && !searchName.includes(search)) return false
        if (type && !species.types.includes(type)) return false
        return !generation || species.generation === generation
      })
      .toSorted((a, b) =>
        sort === 'id'
          ? a.species.id - b.species.id
          : sort === '-cost'
            ? b.cost - a.cost || a.species.id - b.species.id
            : a.cost - b.cost || a.species.id - b.species.id,
      )
    query('[data-role="cards"]').replaceChildren(...shown.map(cardOf))
    renderTeam()
  }

  function saveTeam() {
    writeStored(STORAGE_KEYS.team, team.size > 0 ? teamSelector(team) : undefined)
  }

  query('[data-role="cards"]').addEventListener('click', (event) => {
    const card = (event.target as Element).closest<HTMLButtonElement>('.card')
    if (!card || card.disabled) return
    const id = Number(card.dataset.id)
    team.set(id, (team.get(id) ?? 0) + 1)
    saveTeam()
    renderTeam()
  })
  query('[data-role="team"]').addEventListener('click', (event) => {
    const chip = (event.target as Element).closest<HTMLButtonElement>('.chip')
    if (!chip) return
    const id = Number(chip.dataset.id)
    const count = (team.get(id) ?? 0) - 1
    if (count > 0) team.set(id, count)
    else team.delete(id)
    saveTeam()
    renderTeam()
  })
  query('[data-action="clear"]').addEventListener('click', () => {
    team = new Map()
    saveTeam()
    renderTeam()
  })
  for (const control of [searchInput, typeSelect, generationSelect, sortSelect])
    control.addEventListener('input', renderCards)

  function setChallenge(next: typeof challenge) {
    challenge = next
    writeStored(STORAGE_KEYS.challenge, challenge)
    renderChallenge()
  }
  hordeSelect.addEventListener('change', () => setChallenge({ ...challenge, horde: hordeSelect.value }))
  for (const button of levelButtons)
    button.addEventListener('click', () => setChallenge({ ...challenge, level: Number(button.dataset.level) }))

  fightButton.addEventListener('click', () => {
    if (team.size === 0) return
    const seed = randomSeed()
    onFight({
      teams: [teamSelector(team), hordeSelector(challenge.horde, challenge.level)],
      seed,
      terrain: terrainForSeed(seed),
      sameSize: false,
    })
  })
  query('[data-action="spectate"]').addEventListener('click', onSpectate)

  return {
    /** Reopens on the battle just fought, or on the last team and horde this browser remembers. */
    open(current: BattleParams | null) {
      const horde = /^horde:(.+):(\d+)$/.exec(current?.teams[1] ?? '')
      if (horde && TEAM_SELECTORS.includes(horde[1]!) && LEVELS.includes(Number(horde[2]))) {
        challenge = { horde: horde[1]!, level: Number(horde[2]) }
        const fought = parseTeam(current?.teams[0])
        if (fought.size > 0) team = fought
      }
      renderChallenge()
      renderCards()
      section.hidden = false
      section.scrollTop = 0
    },
    close: () => (section.hidden = true),
    /** Remembers a horde beaten at its level, shown with a tick from then on. */
    recordWin(params: BattleParams) {
      if (!params.teams[1].startsWith('horde:')) return
      wins.add(params.teams[1])
      writeStored(STORAGE_KEYS.wins, [...wins])
    },
  }
}

export const isChallenge = (params: BattleParams | null) => params?.teams[1].startsWith('horde:') ?? false
