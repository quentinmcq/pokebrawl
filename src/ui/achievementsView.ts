import { ACHIEVEMENTS, newlyUnlocked, type Achievement, type AchievementState, type CountedWin } from '../achievements'
import { currentStreak, dayOf, EMPTY_DAILY_RECORD, type DailyRecord } from '../daily'
import { LOCALE } from './i18n'
import { readStored, STORAGE_KEYS, writeStored } from './storage'

interface Stats {
  friendWins: number
  bestRank: number | null
}

/**
 * The achievements of this browser: earned from what the game already keeps (hordes beaten, daily streak) and two
 * counters of their own, shown as a collection of badges in the composer.
 */
export function createAchievements(panel: HTMLElement, spriteOf: (speciesId: number) => HTMLElement) {
  const unlocked = new Map(Object.entries(readStored<Record<string, string>>(STORAGE_KEYS.achievements, {})))
  let stats = readStored<Stats>(STORAGE_KEYS.achievementStats, { friendWins: 0, bestRank: null })

  const state = (): AchievementState => ({
    trainingWins: readStored<string[]>(STORAGE_KEYS.wins, []),
    dailyStreak: currentStreak(readStored<DailyRecord>(STORAGE_KEYS.daily, EMPTY_DAILY_RECORD), dayOf(new Date())),
    friendWins: stats.friendWins,
    bestRank: stats.bestRank,
  })

  function unlock(win: CountedWin | null): Achievement[] {
    const earned = newlyUnlocked(new Set(unlocked.keys()), state(), win)
    for (const achievement of earned) unlocked.set(achievement.id, new Date().toISOString())
    if (earned.length > 0) writeStored(STORAGE_KEYS.achievements, Object.fromEntries(unlocked))
    render()
    return earned
  }

  function saveStats(next: Stats) {
    stats = next
    writeStored(STORAGE_KEYS.achievementStats, stats)
  }

  function render() {
    panel.querySelector('[data-role="achievements-count"]')!.textContent = `${unlocked.size}/${ACHIEVEMENTS.length}`
    panel.querySelector('[data-role="badges"]')!.replaceChildren(
      ...ACHIEVEMENTS.map((achievement) => {
        const badge = document.createElement('li')
        badge.className = `badge${unlocked.has(achievement.id) ? ' badge--unlocked' : ''}`
        const progress = unlocked.has(achievement.id) ? null : achievement.progress?.(state())
        badge.append(
          spriteOf(achievement.emblem),
          Object.assign(document.createElement('b'), { textContent: achievement.title[LOCALE] }),
          Object.assign(document.createElement('span'), {
            textContent: progress
              ? `${achievement.description[LOCALE]} (${progress.done}/${progress.total})`
              : achievement.description[LOCALE],
          }),
        )
        return badge
      }),
    )
  }

  render()
  return {
    render,
    /** After a counted win: the achievements it earned, if any. */
    recordWin: (win: CountedWin) => unlock(win),
    recordFriendWin(win: CountedWin) {
      saveStats({ ...stats, friendWins: stats.friendWins + 1 })
      return unlock(win)
    },
    /** After a score is published: a better rank may earn the podium. */
    recordRank(rank: number) {
      if (stats.bestRank === null || rank < stats.bestRank) saveStats({ ...stats, bestRank: rank })
      return unlock(null)
    },
  }
}
