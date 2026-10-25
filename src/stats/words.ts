import type { Message } from '../types'
import { contentMessages } from './conversation'
import { STOPWORDS } from './stopwords'

export type WordStats = {
  topWords: { word: string; count: number }[]
  topEmoji: { emoji: string; count: number }[]
  signatureWordByPerson: Record<string, string>
  /** only the length is kept, never the text; counted in code points, links not counted */
  longestMessage: { senderId: string; length: number } | null
}

export const TOP_LIMIT = 10
export const MIN_SIGNATURE_COUNT = 5

const LINK = /\b(?:https?:\/\/|www\.)\S+/gi
// Languages written without spaces (Chinese, Japanese, Thai) stay one token in v1.
const WORD = /[\p{L}\p{M}\p{N}']+/gu
// \uFE0F catches keycaps and emoji-style symbols; plain symbols like (c) and (tm) are not emoji.
const EMOJI = /\p{Emoji_Presentation}|\uFE0F/u
const graphemes = new Intl.Segmenter('en', { granularity: 'grapheme' })

export function tokenize(text: string): string[] {
  // iPhone text uses curly apostrophes
  const words = text.replace(LINK, ' ').normalize('NFC').replace(/[\u2018\u2019\u02BC]/g, "'").toLowerCase().match(WORD) ?? []
  return words
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter((w) => w.length >= 3 && !/^\d+$/.test(w) && !STOPWORDS.has(w))
}

export function emojis(text: string): string[] {
  if (!EMOJI.test(text)) return []
  return [...graphemes.segment(text)].map((s) => s.segment).filter((g) => EMOJI.test(g))
}

export function wordStats(messages: Message[]): WordStats {
  const wordTotals = new Map<string, number>()
  const emojiTotals = new Map<string, number>()
  const wordsByPerson = new Map<string, Map<string, number>>()
  let longestMessage: WordStats['longestMessage'] = null

  for (const m of contentMessages(messages)) {
    if (!m.text) continue
    const personWords = wordsByPerson.get(m.senderId) ?? new Map<string, number>()
    for (const word of tokenize(m.text)) {
      bump(wordTotals, word)
      bump(personWords, word)
    }
    wordsByPerson.set(m.senderId, personWords)
    for (const emoji of emojis(m.text)) bump(emojiTotals, emoji)

    const length = [...m.text.replace(LINK, ' ').trim()].length
    if (length === 0) continue
    if (!longestMessage || length > longestMessage.length) longestMessage = { senderId: m.senderId, length }
  }

  return {
    topWords: top(wordTotals).map(([word, count]) => ({ word, count })),
    topEmoji: top(emojiTotals).map(([emoji, count]) => ({ emoji, count })),
    signatureWordByPerson: signatureWords(wordsByPerson, wordTotals),
    longestMessage,
  }
}

/**
 * A person's signature word is the one they over-use most compared with everyone else:
 * the biggest smoothed log ratio of (their rate) / (everyone else's rate), used at least 5 times.
 */
function signatureWords(byPerson: Map<string, Map<string, number>>, totals: Map<string, number>): Record<string, string> {
  const vocabulary = totals.size
  const allWords = sum(totals)
  const result: Record<string, string> = {}

  for (const [person, words] of byPerson) {
    const personWords = sum(words)
    const otherWords = allWords - personWords
    if (otherWords === 0) continue
    let best: { word: string; score: number } | null = null
    for (const [word, count] of words) {
      if (count < MIN_SIGNATURE_COUNT) continue
      const otherCount = (totals.get(word) ?? 0) - count
      const score =
        Math.log((count + 1) / (personWords + vocabulary)) - Math.log((otherCount + 1) / (otherWords + vocabulary))
      if (score > 0 && (!best || score > best.score || (score === best.score && word < best.word))) best = { word, score }
    }
    if (best) result[person] = best.word
  }
  return result
}

function bump(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1)
}

function sum(counts: Map<string, number>): number {
  let total = 0
  for (const n of counts.values()) total += n
  return total
}

function top(counts: Map<string, number>): [string, number][] {
  return [...counts].sort(([a, x], [b, y]) => y - x || (a < b ? -1 : a > b ? 1 : 0)).slice(0, TOP_LIMIT)
}
