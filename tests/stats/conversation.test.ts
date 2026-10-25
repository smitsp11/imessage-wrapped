import { expect, it } from 'vitest'
import { median, threads } from '../../src/stats/conversation'
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
