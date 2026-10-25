import { expect, it } from 'vitest'
import { reactionStats } from '../../src/stats/reactions'
import { msg, react } from '../../fixtures/messages'

it('counts reactions given and received, skipping self-reactions and missing targets', () => {
  const a = msg({ senderId: 'alex', sentAt: '2026-01-01T10:00:00Z' })
  const b = msg({ senderId: 'me', sentAt: '2026-01-01T10:01:00Z' })
  const stats = reactionStats([
    a,
    b,
    react('sam', a, 'laugh', '2026-01-01T10:02:00Z'),
    react('me', a, 'laugh', '2026-01-01T10:03:00Z'),
    react('alex', b, 'love', '2026-01-01T10:04:00Z'),
    react('me', b, 'love', '2026-01-01T10:05:00Z'), // my own message
    msg({ senderId: 'sam', sentAt: '2026-01-01T10:06:00Z', text: null, reactsToGuid: 'gone', reactionType: 'like' }),
  ])
  expect(stats).toEqual({
    // my love on my own message doesn't count: not given, not in byType
    givenByPerson: { sam: 2, me: 1, alex: 1 },
    receivedByPerson: { alex: 2, me: 1 },
    laughsReceivedByPerson: { alex: 2 },
    byType: { laugh: 2, love: 1, like: 1 },
  })
})

it('counts emoji tapbacks by type', () => {
  const a = msg({ senderId: 'alex', sentAt: '2026-01-01T10:00:00Z' })
  const stats = reactionStats([a, react('sam', a, 'emoji', '2026-01-01T10:01:00Z')])
  expect(stats.byType).toEqual({ emoji: 1 })
})

it('returns empty records for no messages', () => {
  expect(reactionStats([])).toEqual({ givenByPerson: {}, receivedByPerson: {}, laughsReceivedByPerson: {}, byType: {} })
})
