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
      // no lurker: c's 20% isn't under half of an even 3-way split (16.7%)
    ])
  })

  it('needs enough replies before anyone can be The Ghost', () => {
    const few: AwardInputs = { ...inputs, replies: { medianReplyMinutesByPerson: { a: 120, c: 600 }, repliesByPerson: { a: 30, c: 9 } } }
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
    expect(ids).toContain('comedian')
  })

  it('gives the lurker only to someone under half of an even split, and no main character on a tie', () => {
    const lurk: AwardInputs = { ...inputs, volume: { total: 650, byPerson: { a: 300, b: 300, c: 50 }, attachmentsByPerson: {} } }
    const awards = pickAwards(lurk)
    expect(awards.find((a) => a.id === 'lurker')).toMatchObject({ personId: 'c', value: 7.7, label: 'only 7.7% of messages' })
    expect(awards.map((a) => a.id)).not.toContain('main-character')
  })

  it('gives no award when the best number is tied', () => {
    const tie: AwardInputs = { ...inputs, volume: { total: 300, byPerson: { a: 100, b: 100, c: 100 }, attachmentsByPerson: {} } }
    const ids = pickAwards(tie).map((a) => a.id)
    expect(ids).not.toContain('main-character')
    expect(ids).not.toContain('lurker')
  })

  const ids = (i: AwardInputs) => pickAwards(i).map((a) => a.id)

  it('gives no Ghost when the slowest median is under an hour', () => {
    const i = { ...inputs, replies: { ...inputs.replies, medianReplyMinutesByPerson: { a: 3, b: 5, c: 30, d: 900 } } }
    expect(ids(i)).not.toContain('ghost')
  })

  it('gives no Night Owl when the unique best share is under 10%', () => {
    const i = { ...inputs, timing: { ...inputs.timing, lateNightShareByPerson: { a: 0.05, b: 0.04, c: 0, d: 1 } } }
    expect(ids(i)).not.toContain('night-owl')
  })

  it('gives no Starter when the unique best is under 3', () => {
    const i = { ...inputs, starters: { ...inputs.starters, startsByPerson: { b: 2, c: 1 } } }
    expect(ids(i)).not.toContain('starter')
  })

  it('gives no Hype Man when the unique best is under 3', () => {
    const i = { ...inputs, reactions: { ...inputs.reactions, givenByPerson: { c: 2, a: 1 } } }
    expect(ids(i)).not.toContain('hype')
  })

  it('gives no Double Texter when the unique best is under 3', () => {
    const i = { ...inputs, starters: { ...inputs.starters, doubleTextsByPerson: { a: 2 } } }
    expect(ids(i)).not.toContain('double-texter')
  })

  it('gives no Comedian under 1 laugh per 100 messages', () => {
    const i = { ...inputs, reactions: { ...inputs.reactions, laughsReceivedByPerson: { a: 1 } } } // 1 of 120 messages
    expect(ids(i)).not.toContain('comedian')
  })

  it('says "laugh" for exactly 1 per 100 messages', () => {
    const i = { ...inputs, reactions: { ...inputs.reactions, laughsReceivedByPerson: { b: 1 } } } // 1 of 100 messages
    expect(pickAwards(i).find((a) => a.id === 'comedian')?.label).toBe('1 laugh per 100 messages')
  })

  it('counts exactly 50 messages as enough, 49 as not', () => {
    const edge = (n: number): AwardInputs => ({
      ...inputs,
      volume: { total: 300, byPerson: { a: 120, b: 100, c: 60, d: n }, attachmentsByPerson: {} },
    })
    expect(pickAwards(edge(49)).find((a) => a.id === 'night-owl')?.personId).toBe('b')
    expect(pickAwards(edge(50)).find((a) => a.id === 'night-owl')?.personId).toBe('d')
  })

  it('lets exactly 10 replies qualify for The Ghost', () => {
    const ten: AwardInputs = { ...inputs, replies: { medianReplyMinutesByPerson: { a: 3, c: 600 }, repliesByPerson: { a: 30, c: 10 } } }
    expect(pickAwards(ten).find((a) => a.id === 'ghost')?.personId).toBe('c')
  })

  it('allows a lurker with exactly 3 qualifiers', () => {
    const three: AwardInputs = { ...inputs, volume: { total: 650, byPerson: { a: 300, b: 300, c: 50 }, attachmentsByPerson: {} } }
    expect(pickAwards(three).map((a) => a.id)).toContain('lurker')
  })

  it('skips Main Character and Lurker in solo mode', () => {
    const ids = pickAwards(inputs, 'solo').map((a) => a.id)
    expect(ids).not.toContain('main-character')
    expect(ids).not.toContain('lurker')
    expect(ids).toEqual(['ghost', 'starter', 'comedian', 'hype', 'night-owl', 'double-texter'])
  })
})
