import { describe, expect, it } from 'vitest'
import { currentStreak, dailyChallenge, dailyDayOf, dayOf, EMPTY_DAILY_RECORD, recordDailyWin } from '../src/daily'
import { pokedex } from '../src/pokedex'
import { selectTeam } from '../src/simulation/teams'

const idsOf = (selector: string) => selectTeam(pokedex, selector).fighters.map(({ species }) => species.id)

describe('daily challenge', () => {
  it('changes at midnight in France', () => {
    expect(dayOf(new Date('2026-10-24T21:30:00Z'))).toBe('2026-10-24')
    expect(dayOf(new Date('2026-10-24T22:30:00Z'))).toBe('2026-10-25')
  })

  it('gives every player the same horde and seed for a day, and another the next day', () => {
    expect(dailyChallenge('2026-10-25')).toEqual(dailyChallenge('2026-10-25'))
    const days = ['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28'].map((day) => dailyChallenge(day).horde)
    expect(new Set(days).size).toBeGreaterThan(1)
  })

  it('draws a horde of its own, unlike the training horde of the same pool', () => {
    const { pool, horde, day } = dailyChallenge('2026-10-25')
    expect(idsOf(horde)).not.toEqual(idsOf(`horde:${pool}:1000`))
    expect(dailyDayOf(horde)).toBe(day)
    expect(dailyDayOf(`horde:${pool}:1000`)).toBeNull()
  })
})

describe('daily record', () => {
  it('keeps the fewest points of each day', () => {
    let record = recordDailyWin(EMPTY_DAILY_RECORD, '2026-10-25', 800)
    record = recordDailyWin(record, '2026-10-25', 640)
    record = recordDailyWin(record, '2026-10-25', 900)
    expect(record.bestByDay['2026-10-25']).toBe(640)
  })

  it('counts consecutive days won, and starts over after a missed day', () => {
    let record = recordDailyWin(EMPTY_DAILY_RECORD, '2026-10-30', 800)
    record = recordDailyWin(record, '2026-10-31', 800)
    record = recordDailyWin(record, '2026-11-01', 800)
    expect(record.streak).toBe(3)
    expect(currentStreak(record, '2026-11-02')).toBe(3)
    expect(currentStreak(record, '2026-11-03')).toBe(0)
    expect(recordDailyWin(record, '2026-11-03', 800).streak).toBe(1)
  })
})
