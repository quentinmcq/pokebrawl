import { typeColor } from '../render/effects'
import { TYPE_NAMES } from '../simulation/teams'
import type { Species, TypeKey } from '../simulation/types'
import { withoutDiacritics } from '../text'
import { LOCALE, nameOf, TEXT } from './i18n'

/** A Pokémon on offer: its price, and its names in both languages to search either. */
export interface CatalogueEntry {
  species: Species
  cost: number
  searchName: string
}

interface CatalogueOptions {
  entries: CatalogueEntry[]
  spriteOf: (speciesId: number) => HTMLElement
  /** The Pokémon caught on PokéDate: a star on their cards and a filter, but no edge in battle. */
  collection: Set<number>
  onPick: (speciesId: number) => void
}

const ALL = ''
const TYPE_NAME = TYPE_NAMES[LOCALE]

export const typeHex = (type: TypeKey) => `#${typeColor(type).toString(16).padStart(6, '0')}`

const DARK_TEXT = '#14162b'
const DARK_TEXT_LUMINANCE = 0.0085
const relativeLuminance = (color: number) => {
  const [red, green, blue] = [color >> 16, (color >> 8) & 0xff, color & 0xff].map((channel) => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!
}

/** White or dark text on a type's colour, whichever contrasts more: white reads poorly on Normal or Electric. */
export function typeTextColor(type: TypeKey) {
  const luminance = relativeLuminance(typeColor(type))
  const onWhite = 1.05 / (luminance + 0.05)
  const onDark = (luminance + 0.05) / (DARK_TEXT_LUMINANCE + 0.05)
  return onDark > onWhite ? DARK_TEXT : '#fff'
}
export const searchNameOf = (species: Species) => withoutDiacritics(`${species.names.fr} ${species.names.en}`)
const collectionStar = () => Object.assign(document.createElement('span'), { className: 'card-star', textContent: '★' })

/** Every Pokémon to pick from, filtered by name, type, generation or PokéDate collection, and sorted by price. */
export function createCatalogue(
  panel: HTMLElement,
  { entries, spriteOf, collection: caught, onPick }: CatalogueOptions,
) {
  const query = <Element extends HTMLElement>(selector: string) => panel.querySelector<Element>(selector)!
  const searchInput = query<HTMLInputElement>('input[name="search"]')
  const typeSelect = query<HTMLSelectElement>('select[name="type"]')
  const generationSelect = query<HTMLSelectElement>('select[name="generation"]')
  const sortSelect = query<HTMLSelectElement>('select[name="sort"]')
  const collectionCheckbox = query<HTMLInputElement>('input[name="collection"]')
  const cards = new Map<number, HTMLButtonElement>()
  let collection = caught
  let limits = { left: Number.POSITIVE_INFINITY, full: false }

  typeSelect.replaceChildren(
    new Option(TEXT.allTypes, ALL),
    ...Object.entries(TYPE_NAME).map(([key, name]) => new Option(name, key)),
  )
  generationSelect.replaceChildren(
    new Option(TEXT.allGenerations, ALL),
    ...Array.from({ length: 9 }, (_, index) => new Option(`Gen ${index + 1}`, String(index + 1))),
  )

  function cardOf({ species, cost }: CatalogueEntry) {
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
      dot.style.background = typeHex(type)
      dot.title = TYPE_NAME[type]
      types.append(dot)
    }
    if (collection.has(species.id)) card.append(collectionStar())
    card.append(
      spriteOf(species.id),
      Object.assign(document.createElement('span'), { className: 'card-name', textContent: nameOf(species) }),
      Object.assign(document.createElement('span'), { className: 'card-cost', textContent: String(cost) }),
      types,
    )
    cards.set(species.id, card)
    return card
  }

  // A card the budget or the team size no longer allows stays shown, but cannot be picked.
  function applyLimits() {
    for (const card of cards.values()) card.disabled = Number(card.dataset.cost) > limits.left || limits.full
  }

  function render() {
    const search = withoutDiacritics(searchInput.value.trim())
    const type = typeSelect.value as TypeKey | typeof ALL
    const generation = Number(generationSelect.value)
    const sort = sortSelect.value
    const shown = entries
      .filter(({ species, searchName }) => {
        if (search && !searchName.includes(search)) return false
        if (type && !species.types.includes(type)) return false
        if (collectionCheckbox.checked && !collection.has(species.id)) return false
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
    applyLimits()
  }

  function renderCollection() {
    query('[data-role="collection-filter"]').hidden = collection.size === 0
    query('[data-role="collection-import"]').hidden = collection.size > 0
    query('[data-role="collection-count"]').textContent = String(collection.size)
  }

  query('[data-role="cards"]').addEventListener('click', (event) => {
    const card = (event.target as Element).closest<HTMLButtonElement>('.card')
    if (card && !card.disabled) onPick(Number(card.dataset.id))
  })
  for (const control of [searchInput, typeSelect, generationSelect, sortSelect, collectionCheckbox])
    control.addEventListener('input', render)
  renderCollection()

  return {
    render,
    /** What the team can still take: points left, and whether it is full. */
    setLimits(left: number, full: boolean) {
      limits = { left, full }
      applyLimits()
    },
    /** Shows only one type, then brings the catalogue into view: the quickest way to a counter. */
    showType(type: TypeKey) {
      typeSelect.value = type
      render()
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' })
    },
    setCollection(ids: Set<number>) {
      collection = ids
      for (const [id, card] of cards) {
        card.querySelector('.card-star')?.remove()
        if (collection.has(id)) card.prepend(collectionStar())
      }
      renderCollection()
    },
  }
}
