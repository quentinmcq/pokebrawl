import type { Achievement } from '../achievements'
import { battleReport } from '../report'
import type { BattleParams } from '../render/params'
import { buildTeams } from '../render/scene'
import { teamCost } from '../simulation/cost'
import type { createAchievements } from './achievementsView'
import type { ChallengeResult } from './composer'
import { LOCALE, TEXT } from './i18n'
import { savedNickname, saveNickname, submitScore } from './ranking'
import { shareLink } from './share'
import { readStored, STORAGE_KEYS } from './storage'
import { showToast } from './toast'
import { track } from './track'

interface EndActionsHandlers {
  onEdit: () => void
  onRematch: () => void
}

const WIN_EVENTS = {
  daily: 'win-daily',
  training: 'win-training',
  friend: 'win-friend',
} as const

/**
 * What follows a challenge, in HTML over the arena: why the battle went that way, the result, the achievements it
 * earned, the daily score sent to the ranking, and the buttons to improve the team, play again or share.
 */
export function createEndActions(
  panel: HTMLElement,
  achievements: ReturnType<typeof createAchievements>,
  { onEdit, onRematch }: EndActionsHandlers,
) {
  const query = <Element extends HTMLElement>(selector: string) => panel.querySelector<Element>(selector)!
  const shareButton = query<HTMLButtonElement>('[data-action="share"]')
  const resultLine = query('[data-role="result"]')
  const reportList = query('[data-role="report"]')
  const unlockedLine = query('[data-role="unlocked"]')
  const publishForm = query<HTMLFormElement>('[data-role="publish"]')
  const publishError = query('[data-role="publish-error"]')
  let result: ChallengeResult | null = null
  let shownUnlocked: Achievement[] = []

  function showUnlocked(earned: Achievement[]) {
    shownUnlocked = earned
    unlockedLine.hidden = earned.length === 0
    unlockedLine.textContent = TEXT.unlocked(earned.map(({ title }) => title[LOCALE]))
  }

  // Sends today's win to the ranking under the saved nickname, and adds the rank to the result line.
  async function publish(name: string) {
    const publishable = result?.publishable
    if (!publishable) return
    publishError.hidden = true
    const outcome = await submitScore(publishable.day, name, publishable.team)
    if ('error' in outcome) {
      publishError.textContent = outcome.error ?? ''
      publishError.hidden = false
      publishForm.hidden = false
      return
    }
    saveNickname(name)
    track('publish')
    publishForm.hidden = true
    const { you, total } = outcome.ranking
    if (you) {
      resultLine.textContent = TEXT.rankLine(result?.message ?? '', you.rank, total)
      showUnlocked([...shownUnlocked, ...achievements.recordRank(you.rank)])
    }
  }

  // Only the player's own team counts: today's daily horde, a training horde or a friend, never a replayed battle.
  function recordAchievements(params: BattleParams, mode: ChallengeResult['mode']) {
    if (mode === 'replay') return []
    const fighters = buildTeams(params)[0].fighters
    const win = {
      speciesIds: fighters.map(({ species }) => species.id),
      points: teamCost(fighters),
      collection: readStored<number[]>(STORAGE_KEYS.collection, []),
    }
    return mode === 'friend' ? achievements.recordFriendWin(win) : achievements.recordWin(win)
  }

  async function shareResult() {
    if (!result?.share) return
    const outcome = await shareLink(result.share.text, result.share.url)
    if (outcome === 'shared' || outcome === 'copied') track(result.mode === 'friend' ? 'share-back' : 'share-daily')
    if (outcome === 'copied') showToast(TEXT.linkCopied)
  }

  publishForm.addEventListener('submit', (event) => {
    event.preventDefault()
    void publish(new FormData(publishForm).get('nickname')?.toString() ?? '')
  })
  shareButton.addEventListener('click', () => void shareResult())
  query('[data-action="edit"]').addEventListener('click', onEdit)
  query('[data-action="rematch"]').addEventListener('click', onRematch)

  /** Fills the panel for a challenge just over; showing it is up to the caller. */
  function fill(params: BattleParams, finished: ChallengeResult, won: boolean) {
    result = finished
    const { mode, message, share, publishable } = finished
    showUnlocked(won ? recordAchievements(params, mode) : [])
    if (won && mode !== 'replay') track(WIN_EVENTS[mode])
    resultLine.textContent = message
    resultLine.hidden = message === null
    publishError.hidden = true
    const nickname = savedNickname()
    publishForm.hidden = publishable === null || nickname !== null
    if (publishable && nickname) void publish(nickname)
    const report = battleReport({ teams: buildTeams(params), seed: params.seed }, LOCALE)
    reportList.replaceChildren(
      ...report.map((line) => Object.assign(document.createElement('li'), { textContent: line })),
    )
    reportList.hidden = report.length === 0
    shareButton.hidden = share === null
    shareButton.textContent = mode === 'friend' ? TEXT.sendBack : TEXT.page.share
    // Only a training horde gets a new seed: the daily seed and a friend's are fixed, the same team would replay the
    // same battle.
    query('[data-action="rematch"]').hidden = mode !== 'training'
    // After another player's battle, the way back leads home, not to « my team ».
    query('[data-action="edit"]').textContent = mode === 'replay' ? TEXT.backHome : TEXT.page.editTeam
  }

  return { fill }
}
