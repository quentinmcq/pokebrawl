import { analyseHorde, fillAtRandom } from '../advice'
import {
  currentStreak,
  dailyChallenge,
  dailyDayOf,
  dayOf,
  EMPTY_DAILY_RECORD,
  previousDay,
  recordDailyWin,
  type DailyRecord,
} from '../daily'
import { friendChallengeSearch, type FriendChallenge } from '../friend'
import { checkNickname } from '../nickname'
import { pokedex } from '../pokedex'
import { randomSeed, type BattleParams } from '../render/params'
import { terrainForSeed } from '../render/terrain'
import { costOf, MAX_TEAM_SIZE, TEAM_BUDGET, teamCost } from '../simulation/cost'
import {
  parseHorde,
  selectorOfCounts,
  selectTeam,
  TEAM_SELECTORS,
  TYPE_NAMES,
  teamTitle,
  toFighterSetup,
} from '../simulation/teams'
import type { TypeKey } from '../simulation/types'
import { createCatalogue, searchNameOf, typeHex, typeTextColor, type CatalogueEntry } from './catalogue'
import { LOCALE, nameOf, TEXT } from './i18n'
import { fetchRanking, renderRanking, savedNickname, saveNickname } from './ranking'
import { shareLink, siteUrl } from './share'
import { track } from './track'
import { readStored, STORAGE_KEYS, writeStored } from './storage'

const LEVELS = [800, 1000, 1250]
type Mode = 'daily' | 'training' | 'friend'
const DEFAULT_CHALLENGE = { mode: 'daily' as Mode, horde: 'gen1', level: 1000 }

interface ComposerHandlers {
  spriteOf: (speciesId: number) => HTMLElement
  onFight: (params: BattleParams) => void
  onSpectate: () => void
}

const hordeSelector = (horde: string, level: number) => `horde:${horde}:${level}`
const today = () => dayOf(new Date())
const TYPE_NAME = TYPE_NAMES[LOCALE]

/** What the end of a challenge says, and what to share after it. */
export interface ChallengeResult {
  /** `replay`: a past day's battle, replayed from the ranking, which counts for nothing. */
  mode: Mode | 'replay'
  message: string | null
  share: { text: string; url: string } | null
  /** Today's daily horde beaten: the score can go to the ranking. */
  publishable: { day: string; team: string } | null
}

const typeChip = (type: TypeKey, tag: 'span' | 'button') => {
  const chip = document.createElement(tag)
  chip.className = 'type-chip'
  chip.textContent = TYPE_NAME[type]
  chip.style.background = typeHex(type)
  chip.style.color = typeTextColor(type)
  return chip
}

const adviceLine = (label: string, ...content: (Node | string)[]) => {
  const line = Object.assign(document.createElement('p'), { className: 'advice-line' })
  line.append(Object.assign(document.createElement('span'), { textContent: label }), ...content)
  return line
}

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

/** The home screen of the game: pick a horde to beat, then spend the budget on any Pokémon, as many times as wished. */
export function createComposer(section: HTMLElement, { spriteOf, onFight, onSpectate }: ComposerHandlers) {
  const query = <Element extends HTMLElement>(selector: string) => section.querySelector<Element>(selector)!
  const hordeSelect = query<HTMLSelectElement>('select[name="horde"]')
  const levelButtons = [...section.querySelectorAll<HTMLButtonElement>('[data-level]')]
  const modeButtons = [...section.querySelectorAll<HTMLButtonElement>('[data-mode]')]
  const rankingButtons = [...section.querySelectorAll<HTMLButtonElement>('[data-ranking]')]
  let rankingDay: 'today' | 'yesterday' = 'today'
  const fightButton = query<HTMLButtonElement>('[data-action="fight"]')

  const entries: CatalogueEntry[] = pokedex.pokemon.map((species) => ({
    species,
    cost: costOf(toFighterSetup(species, pokedex)),
    searchName: searchNameOf(species),
  }))
  const entryOf = (id: number) => entries[id - 1]!

  let team = parseTeam(readStored<string | undefined>(STORAGE_KEYS.team, undefined))
  let challenge = { ...DEFAULT_CHALLENGE, ...readStored<Partial<typeof DEFAULT_CHALLENGE>>(STORAGE_KEYS.challenge, {}) }
  const wins = new Set(readStored<string[]>(STORAGE_KEYS.wins, []))
  let dailyRecord = readStored<DailyRecord>(STORAGE_KEYS.daily, EMPTY_DAILY_RECORD)
  let friendChallenge = readStored<FriendChallenge | null>(STORAGE_KEYS.friend, null)
  if (challenge.mode === 'friend' && !friendChallenge) challenge = { ...challenge, mode: 'daily' }
  const challengerInput = query<HTMLInputElement>('input[name="challenger"]')
  const challengeStatus = query('[data-role="challenge-status"]')
  const catalogue = createCatalogue(query('.catalog'), {
    entries,
    spriteOf,
    // No edge in battle for the Pokémon caught on PokéDate, which the daily ranking could not check.
    collection: new Set(readStored<number[]>(STORAGE_KEYS.collection, [])),
    onPick(id) {
      team.set(id, (team.get(id) ?? 0) + 1)
      saveTeam()
      renderTeam()
    },
  })

  const teamSize = () => [...team.values()].reduce((total, count) => total + count, 0)
  const spent = () => [...team].reduce((total, [id, count]) => total + entryOf(id).cost * count, 0)

  /** The horde and seed to fight: today's challenge, or the chosen training horde with a fresh seed. */
  function opponent(): { horde: string; seed: number; opponentName: string | null } {
    if (challenge.mode === 'training')
      return { horde: hordeSelector(challenge.horde, challenge.level), seed: randomSeed(), opponentName: null }
    if (challenge.mode === 'friend' && friendChallenge)
      return { horde: friendChallenge.team, seed: friendChallenge.seed, opponentName: friendChallenge.name }
    const { horde, seed } = dailyChallenge(today())
    return { horde, seed, opponentName: null }
  }

  function renderFriend() {
    if (!friendChallenge) return
    const { name, size, points } = friendChallenge
    query('[data-role="friend-title"]').textContent = TEXT.friendTitle(name)
    query('[data-role="friend-status"]').textContent = TEXT.friendStatus(size, points)
  }

  function renderDaily() {
    const day = today()
    const { horde } = dailyChallenge(day)
    const best = dailyRecord.bestByDay[day]
    const streak = currentStreak(dailyRecord, day)
    query('[data-role="daily-title"]').textContent = TEXT.dailyTitle(day, teamTitle(horde, LOCALE))
    const goal = best === undefined ? TEXT.dailyGoal : TEXT.dailyBest(best)
    query('[data-role="daily-status"]').textContent = `${goal}${streak > 0 ? ` · 🔥 ${TEXT.days(streak)}` : ''}`
    void renderRankingOf(rankingDay === 'today' ? day : previousDay(day))
  }

  // Answers may arrive out of order when the tabs are switched quickly: only the last request is drawn.
  let rankingRequest = 0
  async function renderRankingOf(day: string) {
    for (const button of rankingButtons) button.ariaPressed = String(button.dataset.ranking === rankingDay)
    const request = ++rankingRequest
    query('[data-role="ranking-summary"]').textContent = TEXT.page.loadingShort
    const ranking = await fetchRanking(day)
    if (request !== rankingRequest) return
    const { horde, seed } = dailyChallenge(day)
    renderRanking(
      query('[data-role="ranking-list"]'),
      query('[data-role="ranking-summary"]'),
      ranking,
      (replayedTeam) =>
        onFight({
          teams: [replayedTeam, horde],
          seed,
          terrain: terrainForSeed(seed),
          sameSize: false,
          opponentName: null,
        }),
    )
  }

  function renderChallenge() {
    const daily = challenge.mode === 'daily'
    for (const button of modeButtons) {
      button.ariaPressed = String(button.dataset.mode === challenge.mode)
      if (button.dataset.mode !== 'friend') continue
      button.hidden = !friendChallenge
      if (friendChallenge) button.textContent = TEXT.friendTitle(friendChallenge.name)
    }
    query('[data-role="daily"]').hidden = !daily
    query('[data-role="friend"]').hidden = challenge.mode !== 'friend'
    query('[data-role="training"]').hidden = challenge.mode !== 'training'
    if (daily) renderDaily()
    if (challenge.mode === 'friend') renderFriend()
    hordeSelect.replaceChildren(
      ...TEAM_SELECTORS.map((selector) => {
        const beaten = wins.has(hordeSelector(selector, challenge.level))
        return new Option(`${teamTitle(selector, LOCALE)}${beaten ? ' ✓' : ''}`, selector)
      }),
    )
    hordeSelect.value = challenge.horde
    for (const button of levelButtons) button.ariaPressed = String(Number(button.dataset.level) === challenge.level)
    const horde = selectTeam(pokedex, opponent().horde).fighters
    const beaten = challenge.mode === 'training' && wins.has(hordeSelector(challenge.horde, challenge.level))
    query('[data-role="horde-summary"]').textContent = TEXT.hordeSummary(horde.length, teamCost(horde), beaten)
    query('[data-role="horde"]').replaceChildren(...horde.map(({ species }) => spriteOf(species.id)))
    renderAdvice(horde)
  }

  // Clicking a type worth aiming at filters the catalogue on it, the quickest way to a counter.
  function renderAdvice(horde: ReturnType<typeof selectTeam>['fighters']) {
    const { dominant, targets } = analyseHorde(horde)
    const advice = query('[data-role="advice"]')
    advice.replaceChildren()
    if (dominant.length === 0) return
    advice.append(adviceLine(TEXT.hordeTypes, ...dominant.map((type) => typeChip(type, 'span'))))
    if (targets.length === 0) return
    const targetChips = targets.map((type) => {
      const chip = typeChip(type, 'button') as HTMLButtonElement
      chip.type = 'button'
      chip.title = TEXT.showType(TYPE_NAME[type])
      chip.addEventListener('click', () => catalogue.showType(type))
      return chip
    })
    const hint = Object.assign(document.createElement('span'), {
      className: 'advice-hint',
      textContent: TEXT.tapToFilter,
    })
    advice.append(adviceLine(TEXT.effectiveTypes, ...targetChips, hint))
  }

  function renderTeam() {
    const used = spent()
    const size = teamSize()
    query<HTMLElement>('.budget-fill').style.width = `${(100 * used) / TEAM_BUDGET}%`
    query('[data-role="budget-summary"]').textContent = TEXT.budgetSummary(used, size, size >= MAX_TEAM_SIZE)
    // A friend can only be challenged with a team to beat.
    query('[data-role="challenge-friend"]').hidden = size === 0
    query('[data-role="team"]').replaceChildren(
      ...[...team]
        .toSorted(([a], [b]) => a - b)
        .map(([id, count]) => {
          const chip = document.createElement('button')
          chip.type = 'button'
          chip.className = 'chip'
          chip.dataset.id = String(id)
          chip.title = TEXT.remove(nameOf(entryOf(id).species))
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
    catalogue.setLimits(TEAM_BUDGET - used, size >= MAX_TEAM_SIZE)
  }

  function saveTeam() {
    writeStored(STORAGE_KEYS.team, team.size > 0 ? selectorOfCounts(team) : undefined)
  }

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
  query('[data-action="fill"]').addEventListener('click', () => {
    const prices = entries.map(({ species, cost }) => ({ id: species.id, cost }))
    team = fillAtRandom(team, prices, TEAM_BUDGET - spent(), MAX_TEAM_SIZE - teamSize(), Math.random)
    saveTeam()
    renderTeam()
  })
  query('[data-action="clear"]').addEventListener('click', () => {
    team = new Map()
    saveTeam()
    renderTeam()
  })

  function setChallenge(next: typeof challenge) {
    challenge = next
    writeStored(STORAGE_KEYS.challenge, challenge)
    renderChallenge()
  }
  hordeSelect.addEventListener('change', () => setChallenge({ ...challenge, horde: hordeSelect.value }))
  for (const button of levelButtons)
    button.addEventListener('click', () => setChallenge({ ...challenge, level: Number(button.dataset.level) }))
  for (const button of rankingButtons)
    button.addEventListener('click', () => {
      rankingDay = button.dataset.ranking as typeof rankingDay
      renderDaily()
    })
  for (const button of modeButtons)
    button.addEventListener('click', () => setChallenge({ ...challenge, mode: button.dataset.mode as Mode }))

  fightButton.addEventListener('click', () => {
    if (team.size === 0) return
    const { horde, seed, opponentName } = opponent()
    onFight({
      teams: [selectorOfCounts(team), horde],
      seed,
      terrain: terrainForSeed(seed),
      sameSize: false,
      opponentName,
    })
  })

  /** A link to send: the team as it stands, under the player's nickname, with a fresh seed for both players. */
  function challengeOf(name: string) {
    const url = siteUrl(friendChallengeSearch({ team: selectorOfCounts(team), name, seed: randomSeed() }))
    return { text: TEXT.challengeText(name, teamSize(), spent()), url }
  }

  function showChallengeStatus(message: string) {
    challengeStatus.textContent = message
    challengeStatus.hidden = false
  }

  // The nickname field only shows when there is none yet, or to correct a refused one.
  challengerInput.value = savedNickname() ?? ''
  async function challengeFriend() {
    if (team.size === 0) return showChallengeStatus(TEXT.composeFirst)
    const typed = !challengerInput.hidden
    const nickname = checkNickname(typed ? challengerInput.value : savedNickname())
    if (!nickname.ok) {
      challengerInput.hidden = false
      challengerInput.focus()
      if (typed) showChallengeStatus(TEXT.nicknameErrors[nickname.error])
      return
    }
    saveNickname(nickname.nickname)
    const { text, url } = challengeOf(nickname.nickname)
    const outcome = await shareLink(text, url)
    if (outcome === 'cancelled') return
    if (outcome !== 'failed') track('share-challenge')
    showChallengeStatus(
      outcome === 'copied' ? TEXT.challengeCopied : outcome === 'shared' ? TEXT.challengeSent : TEXT.shareFailed,
    )
  }
  query('[data-action="challenge"]').addEventListener('click', () => void challengeFriend())
  challengerInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') void challengeFriend()
  })
  query('[data-action="spectate"]').addEventListener('click', onSpectate)

  // The way to the PokéDate Pokédex only shows until its Pokémon have arrived.
  function renderCollectionImport(caught: number) {
    query('[data-role="collection-import"]').hidden = caught > 0
  }
  renderCollectionImport(readStored<number[]>(STORAGE_KEYS.collection, []).length)

  /** One of each of these Pokémon, the cheapest first, as far as the budget and the team size go; says how many. */
  function addOneOfEach(ids: number[]) {
    let added = 0
    for (const id of [...ids].toSorted((a, b) => entryOf(a).cost - entryOf(b).cost || a - b)) {
      if (spent() + entryOf(id).cost > TEAM_BUDGET || teamSize() >= MAX_TEAM_SIZE) continue
      team.set(id, (team.get(id) ?? 0) + 1)
      added++
    }
    saveTeam()
    renderTeam()
    return added
  }

  return {
    /** Reopens on the battle just fought, or on the last team and horde this browser remembers. */
    open(current: BattleParams | null) {
      const horde = parseHorde(current?.teams[1] ?? '')
      if (current?.opponentName && friendChallenge) challenge = { ...challenge, mode: 'friend' }
      else if (horde && dailyDayOf(current!.teams[1])) challenge = { ...challenge, mode: 'daily' }
      else if (horde && TEAM_SELECTORS.includes(horde.pool) && LEVELS.includes(horde.value))
        challenge = { mode: 'training', horde: horde.pool, level: horde.value }
      const fought = parseTeam(current?.teams[0])
      if ((horde || current?.opponentName) && fought.size > 0) team = fought
      challengeStatus.hidden = true
      query('[data-role="team-notice"]').hidden = true
      renderChallenge()
      catalogue.render()
      renderTeam()
      section.hidden = false
      section.scrollTop = 0
    },
    close: () => (section.hidden = true),
    /**
     * Adds the Pokémon of a link from another site (`?equipe=ids:25`, from PokéDate) to the team, as far as the budget
     * goes, and says so: the visitor arrives with their Pokémon already enrolled.
     */
    welcome(selector: string) {
      const added: string[] = []
      for (const [id, count] of parseTeam(selector)) {
        for (let copy = 0; copy < count; copy++) {
          if (spent() + entryOf(id).cost > TEAM_BUDGET || teamSize() >= MAX_TEAM_SIZE) break
          team.set(id, (team.get(id) ?? 0) + 1)
          if (!added.includes(nameOf(entryOf(id).species))) added.push(nameOf(entryOf(id).species))
        }
      }
      if (added.length === 0) return
      saveTeam()
      renderTeam()
      const notice = query('[data-role="team-notice"]')
      notice.textContent = TEXT.welcomed(added)
      notice.hidden = false
    },
    /** Keeps the Pokémon caught on PokéDate, received by link, and says how to find them. */
    importCollection(ids: number[]) {
      writeStored(STORAGE_KEYS.collection, ids)
      renderCollectionImport(ids.length)
      catalogue.setCollection(new Set(ids), { showOnly: true })
      const notice = query('[data-role="team-notice"]')
      notice.replaceChildren(ids.length === 0 ? TEXT.noCollection : TEXT.collection(ids.length))
      if (ids.length > 0) {
        const add = Object.assign(document.createElement('button'), {
          type: 'button',
          className: 'primary',
          textContent: TEXT.addCollection,
        })
        add.addEventListener('click', () => {
          notice.replaceChildren(TEXT.collectionAdded(addOneOfEach(ids)))
          catalogue.showAll()
        })
        notice.append(add)
      }
      notice.hidden = false
      notice.scrollIntoView({ behavior: 'smooth', block: 'center' })
    },
    /** Opens on a friend's team, received by link, to beat with the player's own. */
    openFriendChallenge(received: FriendChallenge) {
      friendChallenge = received
      writeStored(STORAGE_KEYS.friend, received)
      setChallenge({ ...challenge, mode: 'friend' })
      this.open(null)
    },
    /** Records the end of a challenge: a tick on a beaten training horde, the score and streak of the daily one. */
    finish(params: BattleParams, won: boolean): ChallengeResult {
      const nothing = { message: null, share: null, publishable: null }
      if (params.opponentName) {
        if (!won) return { ...nothing, mode: 'friend', message: TEXT.friendLost(params.opponentName) }
        // The winner sends the challenge back, with the team that just won.
        const name = savedNickname() ?? TEXT.aFriend
        return {
          ...nothing,
          mode: 'friend',
          message: TEXT.friendWon(params.opponentName),
          share: {
            text: TEXT.challengeBackText(name),
            url: siteUrl(friendChallengeSearch({ team: params.teams[0], name, seed: randomSeed() })),
          },
        }
      }
      const day = dailyDayOf(params.teams[1])
      if (!day) {
        if (won) {
          wins.add(params.teams[1])
          writeStored(STORAGE_KEYS.wins, [...wins])
        }
        return { ...nothing, mode: 'training' }
      }
      // A past day's battle, or today's horde fought with another seed than the challenge's, counts for nothing.
      if (day !== today() || params.seed !== dailyChallenge(day).seed) return { ...nothing, mode: 'replay' }
      if (!won) return { ...nothing, mode: 'daily', message: TEXT.dailyLost }
      const points = teamCost(selectTeam(pokedex, params.teams[0]).fighters)
      dailyRecord = recordDailyWin(dailyRecord, day, points)
      writeStored(STORAGE_KEYS.daily, dailyRecord)
      const best = dailyRecord.bestByDay[day]!
      const streak = currentStreak(dailyRecord, day)
      return {
        mode: 'daily',
        message: TEXT.dailyWon(points, best < points ? best : null, streak),
        share: {
          text: TEXT.dailyShare(day, teamTitle(params.teams[1], LOCALE), points, streak).join('\n'),
          url: siteUrl(),
        },
        publishable: { day, team: params.teams[0] },
      }
    },
  }
}

/** A battle the composer set up: against a horde, or against a friend's team. */
export const isChallenge = (params: BattleParams | null) =>
  params !== null && (params.teams[1].startsWith('horde:') || params.opponentName !== null)
