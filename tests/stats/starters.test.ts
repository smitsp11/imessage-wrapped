import { expect, it } from 'vitest'
import { DOUBLE_TEXT_GAP, NEW_CONVERSATION_GAP, starterStats } from '../../src/stats/starters'
import { msg, react } from '../../fixtures/messages'

it('counts conversation starts and double texts', () => {
  const stats = starterStats([
    msg({ senderId: 'alex', sentAt: '2026-01-01T08:00:00Z' }), // start
    msg({ senderId: 'me', sentAt: '2026-01-01T08:05:00Z' }),
    msg({ senderId: 'me', sentAt: '2026-01-01T08:20:00Z' }), // double text (15 min, no reply)
    msg({ senderId: 'me', sentAt: '2026-01-01T08:21:00Z' }), // 1 min later: just a burst
    msg({ senderId: 'alex', sentAt: '2026-01-01T16:00:00Z' }), // start (7h39m gap)
    msg({ senderId: 'alex', sentAt: '2026-01-01T16:30:00Z' }), // double text
  ])
  expect(stats).toEqual({ startsByPerson: { alex: 2 }, doubleTextsByPerson: { me: 1, alex: 1 } })
})

const T0 = Date.parse('2026-01-01T08:00:00Z')
const at = (offsetMs: number) => new Date(T0 + offsetMs).toISOString()

it('starts a conversation at exactly the gap, not 1 ms before', () => {
  const exact = starterStats([msg({ senderId: 'alex', sentAt: at(0) }), msg({ senderId: 'me', sentAt: at(NEW_CONVERSATION_GAP) })])
  expect(exact.startsByPerson).toEqual({ alex: 1, me: 1 })
  const early = starterStats([msg({ senderId: 'alex', sentAt: at(0) }), msg({ senderId: 'me', sentAt: at(NEW_CONVERSATION_GAP - 1) })])
  expect(early.startsByPerson).toEqual({ alex: 1 })
})

it('double texts at exactly the gap, not 1 ms before', () => {
  const exact = starterStats([msg({ senderId: 'me', sentAt: at(0) }), msg({ senderId: 'me', sentAt: at(DOUBLE_TEXT_GAP) })])
  expect(exact.doubleTextsByPerson).toEqual({ me: 1 })
  const early = starterStats([msg({ senderId: 'me', sentAt: at(0) }), msg({ senderId: 'me', sentAt: at(DOUBLE_TEXT_GAP - 1) })])
  expect(early.doubleTextsByPerson).toEqual({})
})

it('counts the first message of each chat as a start, and never double texts across chats', () => {
  const stats = starterStats([
    msg({ chatId: 1, senderId: 'me', sentAt: at(0) }),
    msg({ chatId: 2, senderId: 'me', sentAt: at(15 * 60_000) }),
  ])
  expect(stats).toEqual({ startsByPerson: { me: 2 }, doubleTextsByPerson: {} })
})

it("a reaction between two of my messages doesn't prevent a double text", () => {
  const first = msg({ senderId: 'me', sentAt: at(0) })
  const stats = starterStats([first, react('alex', first, 'love', at(5 * 60_000)), msg({ senderId: 'me', sentAt: at(20 * 60_000) })])
  expect(stats.doubleTextsByPerson).toEqual({ me: 1 })
})
