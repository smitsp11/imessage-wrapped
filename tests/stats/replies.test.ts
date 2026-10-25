import { expect, it } from 'vitest'
import { replyStats } from '../../src/stats/replies'
import { msg } from '../../fixtures/messages'

it('measures median reply time per person, within a chat and within 12 hours', () => {
  const stats = replyStats([
    msg({ senderId: 'alex', sentAt: '2026-01-01T10:00:00Z' }),
    msg({ chatId: 2, senderId: 'me', sentAt: '2026-01-01T10:01:00Z' }), // first in another chat: not a reply
    msg({ senderId: 'me', sentAt: '2026-01-01T10:04:00Z' }), // reply in 4 min
    msg({ senderId: 'me', sentAt: '2026-01-01T10:05:00Z' }), // same sender: not a reply
    msg({ senderId: 'alex', sentAt: '2026-01-01T10:15:00Z' }), // reply in 10 min
    msg({ senderId: 'sam', sentAt: '2026-01-01T23:00:00Z' }), // 12h45m later: not a reply
  ])
  expect(stats).toEqual({
    medianReplyMinutesByPerson: { me: 4, alex: 10 },
    repliesByPerson: { me: 1, alex: 1 },
  })
})
