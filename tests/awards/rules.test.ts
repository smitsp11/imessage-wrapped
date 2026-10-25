import { describe, expect, it } from 'vitest'
import { type AwardInputs, pickAwards } from '../../src/awards/rules'

const inputs: AwardInputs = {
  volume: { total: 300, byPerson: { a: 120, b: 100, c: 60, d: 20 }, attachmentsByPerson: {} },
  timing: {
    byMonth: [], byWeekday: [], byHour: [], longestStreakDays: 0, longestSilenceDays: 0,
    lateNightShareByPerson: { a: 0.1, b: 0.5, c: 0, d: 1 },
  },
  replies: { medianReplyMinutesByPerson: { a: 3, b: 45, c: 600, d: 900 }, repliesByPerson: { a: 30, b: 30, c: 12, d: 5 } },
  starters: { startsByPerson: { b: 30, c: 2 }, doubleTextsByPerson: { a: 12 } },
  reactions: { givenByPerson: { c: 80, a: 5 }, receivedByPerson: {}, laughsReceivedByPerson: { b: 40 }, byType: {} },
}

describe('pickAwards', () => {
  it('gives each award to the qualifying person with the best number', () => {
    expect(pickAwards(inputs).map((a) => [a.id, a.personId, a.value, a.label])).toEqual([
      ['main-character', 'a', 40, '40% of all messages'],
      ['ghost', 'c', 600, 'median reply 10h 0m'],
      ['starter', 'b', 30, 'started 30 conversations'],
      ['comedian', 'b', 40, '40 laughs per 100 messages'],
      ['hype', 'c', 80, 'gave 80 reactions'],
      ['night-owl', 'b', 50, '50% of messages sent 12–5 AM'], // d has 100% but only 20 messages
      ['double-texter', 'a', 12, '12 double texts'],
      ['lurker', 'c', 20, 'only 20% of messages'],
    ])
  })

  it('needs enough replies before anyone can be The Ghost', () => {
    const few: AwardInputs = { ...inputs, replies: { medianReplyMinutesByPerson: { a: 3, c: 600 }, repliesByPerson: { a: 30, c: 9 } } }
    expect(pickAwards(few).find((a) => a.id === 'ghost')?.personId).toBe('a')
  })

  it('skips awards nobody earned and the lurker in small groups', () => {
    const small: AwardInputs = {
      ...inputs,
      volume: { total: 220, byPerson: { a: 120, b: 100 }, attachmentsByPerson: {} },
      starters: { startsByPerson: {}, doubleTextsByPerson: {} },
    }
    const ids = pickAwards(small).map((a) => a.id)
    expect(ids).not.toContain('starter')
    expect(ids).not.toContain('double-texter')
    expect(ids).not.toContain('lurker')
  })
})
