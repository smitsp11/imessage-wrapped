import { expect, it } from 'vitest'
import { emojis, tokenize, wordStats } from '../../src/stats/words'
import { msg } from '../../fixtures/messages'

it('tokenizes: lowercases, drops short words, stopwords, numbers and links', () => {
  expect(tokenize('The PASTA is at https://x.com/abc 2026 tonight!')).toEqual(['pasta', 'tonight'])
})

it('finds emoji graphemes', () => {
  expect(emojis('bet 🍝 ok 👍🏽')).toEqual(['🍝', '👍🏽'])
})

it('finds top words, top emoji, signature words and the longest message', () => {
  const at = (i: number) => `2026-01-01T10:${String(i).padStart(2, '0')}:00Z`
  const messages = [
    ...Array.from({ length: 5 }, (_, i) => msg({ senderId: 'alex', sentAt: at(i), text: 'pasta tonight' })),
    ...Array.from({ length: 5 }, (_, i) => msg({ senderId: 'me', sentAt: at(10 + i), text: 'omw' })),
    msg({ senderId: 'me', sentAt: at(20), text: 'pasta' }),
    msg({ senderId: 'sam', sentAt: at(21), text: '🍝🍝' }),
    msg({ senderId: 'sam', sentAt: at(22), text: 'https://x.com/abc' }),
  ]
  const stats = wordStats(messages)
  expect(stats.topWords.slice(0, 3)).toEqual([
    { word: 'pasta', count: 6 },
    { word: 'omw', count: 5 },
    { word: 'tonight', count: 5 },
  ])
  expect(stats.topEmoji).toEqual([{ emoji: '🍝', count: 2 }])
  expect(stats.signatureWordByPerson).toEqual({ alex: 'tonight', me: 'omw' })
  expect(stats.longestMessage).toEqual({ senderId: 'sam', length: 17 })
})
