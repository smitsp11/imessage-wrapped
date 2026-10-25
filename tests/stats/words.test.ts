import { expect, it } from 'vitest'
import { emojis, tokenize, wordStats } from '../../src/stats/words'
import { msg, react } from '../../fixtures/messages'

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
  // sam's link-only message is empty once links are removed, so alex's "pasta tonight" (13) is the longest
  expect(stats.longestMessage).toEqual({ senderId: 'alex', length: 13 })
})

const at = (i: number) => new Date(Date.UTC(2026, 0, 1, 10, i)).toISOString()
const many = (senderId: string, text: string, n: number, start = 0) =>
  Array.from({ length: n }, (_, i) => msg({ senderId, sentAt: at(start + i), text }))

it('treats curly apostrophes like straight ones and drops contractions', () => {
  expect(tokenize('doesn\u2019t won\u2019t I\u2019m')).toEqual([])
})

it('keeps words with combining marks whole', () => {
  expect(tokenize('\u0928\u092E\u0938\u094D\u0924\u0947 \u0926\u094B\u0938\u094D\u0924')).toEqual([
    '\u0928\u092E\u0938\u094D\u0924\u0947',
    '\u0926\u094B\u0938\u094D\u0924',
  ])
  expect(tokenize('cafe\u0301')).toEqual(['caf\u00E9'])
})

it('counts flags and keycaps as emoji but not plain symbols', () => {
  expect(emojis('go \u{1F1E8}\u{1F1E6} 1\uFE0F\u20E3')).toEqual(['\u{1F1E8}\u{1F1E6}', '1\uFE0F\u20E3'])
  expect(emojis('brand\u2122 \u00A9 2026')).toEqual([])
})

it('drops www links', () => {
  expect(tokenize('look www.example.com')).toEqual(['look'])
})

it('gives no signature word to someone with nobody to compare with', () => {
  const others = Array.from({ length: 50 }, (_, i) => `word${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}x`)
  const messages = [...many('alex', 'pasta', 60), ...others.map((w, i) => msg({ senderId: 'alex', sentAt: at(100 + i), text: w }))]
  expect(wordStats(messages).signatureWordByPerson).toEqual({})
})

it('needs 5 uses for a signature word', () => {
  const base = many('sam', 'bet', 10)
  expect(wordStats([...base, ...many('alex', 'omw', 4, 20)]).signatureWordByPerson).toEqual({ sam: 'bet' })
  expect(wordStats([...base, ...many('alex', 'omw', 5, 20)]).signatureWordByPerson).toEqual({ sam: 'bet', alex: 'omw' })
})

it('gives no signature word when two people use a word equally', () => {
  const messages = [...many('alex', 'pasta', 5), ...many('sam', 'pasta', 5, 10)]
  expect(wordStats(messages).signatureWordByPerson).toEqual({})
})

it('caps top words at 10 with alphabetical tie-break', () => {
  const words = Array.from({ length: 12 }, (_, i) => `w${String.fromCharCode(97 + i)}x`)
  const stats = wordStats([...words].reverse().map((w, i) => msg({ senderId: 'alex', sentAt: at(i), text: w })))
  expect(stats.topWords.map((w) => w.word)).toEqual(words.slice(0, 10))
})

it('breaks signature-word ties alphabetically', () => {
  const messages = [...many('alex', 'zebra', 5), ...many('alex', 'apple', 5, 10), ...many('sam', 'bet', 10, 20)]
  expect(wordStats(messages).signatureWordByPerson.alex).toBe('apple')
})

it('skips reactions and messages without text', () => {
  const target = msg({ senderId: 'alex', sentAt: at(0), text: 'pasta' })
  const stats = wordStats([
    target,
    react('sam', target, 'love', at(1)),
    { ...react('sam', target, 'laugh', at(3)), text: 'pasta' },
    msg({ senderId: 'sam', sentAt: at(2), text: null }),
  ])
  expect(stats.topWords).toEqual([{ word: 'pasta', count: 1 }])
  expect(stats.longestMessage).toEqual({ senderId: 'alex', length: 5 })
})

it('handles empty input', () => {
  expect(wordStats([])).toEqual({ topWords: [], topEmoji: [], signatureWordByPerson: {}, longestMessage: null })
})
