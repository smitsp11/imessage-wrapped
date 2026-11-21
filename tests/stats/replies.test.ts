import { expect, it } from 'vitest'
import { MAX_REPLY_GAP, replyStats } from '../../src/stats/replies'
import { HOUR, MINUTE, NEW_CONVERSATION_GAP } from '../../src/stats/conversation'
import { msg, react } from '../../fixtures/messages'

const T0 = Date.parse('2026-01-01T10:00:00Z')
const at = (offsetMs: number) => new Date(T0 + offsetMs).toISOString()
const DAY = 24 * HOUR

it("times each person's first message in a conversation from the conversation's first message", () => {
  const stats = replyStats([
    msg({ senderId: 'alex', sentAt: at(0) }), // alex starts
    msg({ senderId: 'sam', sentAt: at(2 * MINUTE) }), // sam joins 2 min in
    msg({ senderId: 'me', sentAt: at(3 * MINUTE) }), // 1 min after sam, but 3 min after the start: 3, not 1
    msg({ senderId: 'sam', sentAt: at(4 * MINUTE) }), // sam's later messages don't count
    msg({ senderId: 'me', sentAt: at(5 * MINUTE) }),
  ])
  expect(stats).toEqual({ medianReplyMinutesByPerson: { sam: 2, me: 3 }, repliesByPerson: { sam: 1, me: 1 } })
})

it('takes the median over several conversations and counts the conversations joined', () => {
  const stats = replyStats([
    msg({ senderId: 'alex', sentAt: at(0) }),
    msg({ senderId: 'me', sentAt: at(4 * MINUTE) }), // 4 min
    msg({ senderId: 'alex', sentAt: at(DAY) }),
    msg({ senderId: 'me', sentAt: at(DAY + 12 * MINUTE) }), // 12 min
    msg({ senderId: 'alex', sentAt: at(2 * DAY) }),
    msg({ senderId: 'me', sentAt: at(2 * DAY + 45 * MINUTE) }), // 45 min
  ])
  expect(stats).toEqual({ medianReplyMinutesByPerson: { me: 12 }, repliesByPerson: { me: 3 } })
})

it('times someone who joins late from the start, not from the last message', () => {
  const stats = replyStats([
    msg({ senderId: 'alex', sentAt: at(0) }),
    msg({ senderId: 'sam', sentAt: at(MINUTE) }),
    msg({ senderId: 'alex', sentAt: at(2 * HOUR) }),
    msg({ senderId: 'sam', sentAt: at(4 * HOUR) }),
    msg({ senderId: 'jordan', sentAt: at(5 * HOUR) }), // joins 5 h in, 1 h after the last message
  ])
  expect(stats.medianReplyMinutesByPerson).toEqual({ sam: 1, jordan: 300 })
})

it("leaves out someone who never sends in a conversation, and doesn't time the starter", () => {
  const stats = replyStats([
    msg({ senderId: 'alex', sentAt: at(0) }),
    msg({ senderId: 'alex', sentAt: at(MINUTE) }),
    msg({ senderId: 'sam', sentAt: at(3 * MINUTE) }),
    msg({ senderId: 'alex', sentAt: at(4 * MINUTE) }), // alex started it: never timed
    // a second conversation that only sam joins
    msg({ senderId: 'riley', sentAt: at(DAY) }),
    msg({ senderId: 'sam', sentAt: at(DAY + 7 * MINUTE) }),
  ])
  expect(stats).toEqual({ medianReplyMinutesByPerson: { sam: 5 }, repliesByPerson: { sam: 2 } })
})

it('counts a join at exactly 12 hours after the start but not 1 ms later', () => {
  // Messages every 5 hours keep the conversation going past 12 hours.
  const keepGoing = [0, 5 * HOUR, 10 * HOUR].map((t) => msg({ senderId: 'alex', sentAt: at(t) }))
  const exact = replyStats([...keepGoing, msg({ senderId: 'sam', sentAt: at(MAX_REPLY_GAP) })])
  expect(exact).toEqual({ medianReplyMinutesByPerson: { sam: 720 }, repliesByPerson: { sam: 1 } })
  const late = replyStats([...keepGoing, msg({ senderId: 'sam', sentAt: at(MAX_REPLY_GAP + 1) })])
  expect(late).toEqual({ medianReplyMinutesByPerson: {}, repliesByPerson: {} })
})

it('starts a new conversation after exactly the 6-hour gap, not 1 ms before', () => {
  const split = replyStats([
    msg({ senderId: 'alex', sentAt: at(0) }),
    msg({ senderId: 'sam', sentAt: at(NEW_CONVERSATION_GAP) }), // starts a new conversation: not a reply
    msg({ senderId: 'alex', sentAt: at(NEW_CONVERSATION_GAP + 2 * MINUTE) }), // alex joins sam's, 2 min in
  ])
  expect(split).toEqual({ medianReplyMinutesByPerson: { alex: 2 }, repliesByPerson: { alex: 1 } })
  const same = replyStats([
    msg({ senderId: 'alex', sentAt: at(0) }),
    msg({ senderId: 'sam', sentAt: at(NEW_CONVERSATION_GAP - 1) }), // still alex's conversation
  ])
  expect(same.repliesByPerson).toEqual({ sam: 1 })
})

it('never crosses chats: each chat has its own conversations', () => {
  const stats = replyStats([
    msg({ chatId: 1, senderId: 'alex', sentAt: at(0) }),
    msg({ chatId: 2, senderId: 'me', sentAt: at(MINUTE) }), // starts chat 2's conversation: not a reply to alex
    msg({ chatId: 2, senderId: 'sam', sentAt: at(3 * MINUTE) }), // joins chat 2's, 2 min in
    msg({ chatId: 1, senderId: 'me', sentAt: at(9 * MINUTE) }), // joins chat 1's, 9 min in
  ])
  expect(stats).toEqual({ medianReplyMinutesByPerson: { me: 9, sam: 2 }, repliesByPerson: { me: 1, sam: 1 } })
})

it('keeps a median under a minute to the second (0.01 min)', () => {
  const stats = replyStats([
    msg({ senderId: 'alex', sentAt: at(0) }),
    msg({ senderId: 'sam', sentAt: at(41 * 1000) }), // 41 s
  ])
  expect(stats.medianReplyMinutesByPerson.sam).toBe(0.68) // 41 / 60 = 0.6833…, rounded to 0.01
})

it('ignores reactions: reacting is not joining', () => {
  const first = msg({ senderId: 'alex', sentAt: at(0) })
  const stats = replyStats([first, react('sam', first, 'love', at(MINUTE)), msg({ senderId: 'sam', sentAt: at(5 * MINUTE) })])
  expect(stats.medianReplyMinutesByPerson).toEqual({ sam: 5 })
})
