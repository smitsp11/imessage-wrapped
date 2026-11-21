import { expect, it } from 'vitest'
import { NEW_CONVERSATION_GAP, byCountThenKey, conversations, median, threads } from '../../src/stats/conversation'
import { msg, react } from '../../fixtures/messages'

it('median handles odd and even counts and rejects empty input', () => {
  expect(median([5, 1, 3])).toBe(3)
  expect(median([4, 1, 3, 2])).toBe(2.5)
  expect(() => median([])).toThrow('median of an empty list')
})

it('threads splits per chat, sorts each by time and drops reactions', () => {
  const late = msg({ senderId: 'alex', chatId: 1, sentAt: '2026-01-01T10:05:00Z' })
  const early = msg({ senderId: 'me', chatId: 1, sentAt: '2026-01-01T10:00:00Z' })
  const other = msg({ senderId: 'sam', chatId: 2, sentAt: '2026-01-01T09:00:00Z' })
  const result = threads([late, other, react('me', late, 'laugh', '2026-01-01T10:06:00Z'), early])
  expect(result).toHaveLength(2)
  expect(result.find((t) => t[0]!.chatId === 1)).toEqual([early, late])
  expect(result.find((t) => t[0]!.chatId === 2)).toEqual([other])
})

it('byCountThenKey sorts by count, highest first, then by key, for a Map or a plain object', () => {
  const keys = ['sam', 'alex', 'jordan', 'riley']
  const counts = { sam: 2, alex: 2, jordan: 5, riley: 1 }
  const expected = ['jordan', 'alex', 'sam', 'riley']
  expect([...keys].sort(byCountThenKey(counts))).toEqual(expected)
  expect([...keys].sort(byCountThenKey(new Map(Object.entries(counts))))).toEqual(expected)
})

it('conversations splits each chat at a quiet gap of at least 6 hours, and never across chats', () => {
  const t = (ms: number) => new Date(Date.parse('2026-01-01T10:00:00Z') + ms).toISOString()
  const a = msg({ senderId: 'alex', chatId: 1, sentAt: t(0) })
  const b = msg({ senderId: 'me', chatId: 1, sentAt: t(NEW_CONVERSATION_GAP - 1) }) // just under the gap: same one
  const c = msg({ senderId: 'sam', chatId: 1, sentAt: t(2 * NEW_CONVERSATION_GAP - 1) }) // exactly the gap after b: a new one
  const d = msg({ senderId: 'me', chatId: 2, sentAt: t(1) })
  expect(conversations([c, d, react('sam', a, 'laugh', t(2)), b, a])).toEqual([[a, b], [c], [d]])
})
