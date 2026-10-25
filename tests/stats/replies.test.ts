import { expect, it } from 'vitest'
import { MAX_REPLY_GAP, replyStats } from '../../src/stats/replies'
import { MINUTE } from '../../src/stats/conversation'
import { msg, react } from '../../fixtures/messages'

it('measures median reply time per person, within a chat and within 12 hours', () => {
  const stats = replyStats([
    msg({ senderId: 'alex', sentAt: '2026-01-01T10:00:00Z' }),
    msg({ chatId: 2, senderId: 'me', sentAt: '2026-01-01T10:01:00Z' }), // first in another chat: not a reply
    msg({ senderId: 'me', sentAt: '2026-01-01T10:04:00Z' }), // reply in 4 min
    msg({ senderId: 'me', sentAt: '2026-01-01T10:05:00Z' }), // same sender: not a reply
    msg({ senderId: 'alex', sentAt: '2026-01-01T10:15:00Z' }), // reply in 11 min: timed from my first message (10:04), not my last (10:05)
    msg({ senderId: 'sam', sentAt: '2026-01-01T23:00:00Z' }), // 12h45m later: not a reply
  ])
  expect(stats).toEqual({
    medianReplyMinutesByPerson: { me: 4, alex: 11 },
    repliesByPerson: { me: 1, alex: 1 },
  })
})

const T0 = Date.parse('2026-01-01T10:00:00Z')
const at = (offsetMs: number) => new Date(T0 + offsetMs).toISOString()

it("a double text doesn't reset the clock", () => {
  const stats = replyStats([
    msg({ senderId: 'me', sentAt: '2026-01-01T10:00:00Z' }),
    msg({ senderId: 'me', sentAt: '2026-01-01T14:00:00Z' }),
    msg({ senderId: 'alex', sentAt: '2026-01-01T14:05:00Z' }),
  ])
  expect(stats.medianReplyMinutesByPerson).toEqual({ alex: 245 })
})

it('counts a reply at exactly 12 hours but not 1 ms later', () => {
  const exact = replyStats([msg({ senderId: 'me', sentAt: at(0) }), msg({ senderId: 'alex', sentAt: at(MAX_REPLY_GAP) })])
  expect(exact.repliesByPerson).toEqual({ alex: 1 })
  const late = replyStats([msg({ senderId: 'me', sentAt: at(0) }), msg({ senderId: 'alex', sentAt: at(MAX_REPLY_GAP + 1) })])
  expect(late.repliesByPerson).toEqual({})
})

it('ignores reactions between two messages', () => {
  const first = msg({ senderId: 'me', sentAt: at(0) })
  const stats = replyStats([
    first,
    react('alex', first, 'love', at(MINUTE)),
    msg({ senderId: 'alex', sentAt: at(5 * MINUTE) }),
  ])
  expect(stats.medianReplyMinutesByPerson).toEqual({ alex: 5 })
})

it("a gap over 12 hours doesn't affect the next pair in the same chat", () => {
  const stats = replyStats([
    msg({ senderId: 'me', sentAt: at(0) }),
    msg({ senderId: 'alex', sentAt: at(MAX_REPLY_GAP + MINUTE) }), // too late
    msg({ senderId: 'me', sentAt: at(MAX_REPLY_GAP + 3 * MINUTE) }), // 2 min after alex
  ])
  expect(stats).toEqual({ medianReplyMinutesByPerson: { me: 2 }, repliesByPerson: { me: 1 } })
})
