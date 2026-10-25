import { expect, it } from 'vitest'
import { timingStats } from '../../src/stats/timing'
import { msg } from '../../fixtures/messages'

it('builds the heatmaps, streak, silence and late-night share', () => {
  const t = timingStats([
    msg({ senderId: 'alex', sentAt: '2026-01-01T02:00:00Z' }), // Thursday, late night
    msg({ senderId: 'alex', sentAt: '2026-01-02T20:00:00Z' }), // Friday
    msg({ senderId: 'me', sentAt: '2026-01-03T20:30:00Z' }), // Saturday
    msg({ senderId: 'me', sentAt: '2026-01-10T21:00:00Z' }), // Saturday, a week later
  ])
  expect(t.byMonth[0]).toBe(4)
  expect(t.byWeekday).toEqual([0, 0, 0, 0, 1, 1, 2])
  expect([t.byHour[2], t.byHour[20], t.byHour[21]]).toEqual([1, 2, 1])
  expect(t.longestStreakDays).toBe(3)
  expect(t.longestSilenceDays).toBe(7)
  expect(t.lateNightShareByPerson).toEqual({ alex: 0.5, me: 0 })
})

it('handles no messages', () => {
  expect(timingStats([]).longestStreakDays).toBe(0)
})
