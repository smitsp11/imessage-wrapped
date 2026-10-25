import { expect, it } from 'vitest'
import { greatestHits } from '../../src/stats/greatestHits'
import { msg, react } from '../../fixtures/messages'

it('ranks text messages by reactions, needing at least 2', () => {
  const top = msg({ senderId: 'alex', sentAt: '2026-01-01T10:00:00Z', text: 'pasta tonight?' })
  const second = msg({ senderId: 'me', sentAt: '2026-01-02T10:00:00Z', text: 'omw' })
  const single = msg({ senderId: 'sam', sentAt: '2026-01-03T10:00:00Z', text: 'bet' })
  const photo = msg({ senderId: 'sam', sentAt: '2026-01-04T10:00:00Z', text: null, hasAttachment: true })
  const at = '2026-01-05T10:00:00Z'
  const hits = greatestHits([
    top, second, single, photo,
    react('sam', top, 'laugh', at), react('me', top, 'laugh', at), react('riley', top, 'love', at),
    react('alex', second, 'love', at), react('sam', second, 'love', at),
    react('alex', single, 'love', at),
    ...['a', 'b', 'c', 'd', 'e'].map((who) => react(who, photo, 'love', at)),
  ])
  expect(hits).toEqual([
    { senderId: 'alex', text: 'pasta tonight?', sentAt: '2026-01-01T10:00:00.000Z', reactions: 3, laughs: 2 },
    { senderId: 'me', text: 'omw', sentAt: '2026-01-02T10:00:00.000Z', reactions: 2, laughs: 0 },
  ])
})

const at = '2026-01-05T10:00:00Z'

it('ignores self-reactions', () => {
  const m = msg({ senderId: 'alex', sentAt: '2026-01-01T10:00:00Z', text: 'hi' })
  expect(greatestHits([m, react('alex', m, 'love', at), react('alex', m, 'laugh', at)])).toEqual([])
})

it('counts each person once per message', () => {
  const m = msg({ senderId: 'alex', sentAt: '2026-01-01T10:00:00Z', text: 'hi' })
  expect(greatestHits([m, react('sam', m, 'love', at), react('sam', m, 'laugh', at)])).toEqual([])
})

it('caps the list at the limit', () => {
  const ms = [1, 2, 3].map((d) => msg({ senderId: 'alex', sentAt: `2026-01-0${d}T10:00:00Z`, text: `m${d}` }))
  const reactions = ms.flatMap((m) => [react('sam', m, 'love', at), react('riley', m, 'love', at)])
  expect(greatestHits([...ms, ...reactions], 2)).toHaveLength(2)
})

it('breaks ties by laughs, then older first', () => {
  const old = msg({ senderId: 'alex', sentAt: '2026-01-01T10:00:00Z', text: 'old' })
  const newer = msg({ senderId: 'alex', sentAt: '2026-01-02T10:00:00Z', text: 'newer' })
  const funny = msg({ senderId: 'alex', sentAt: '2026-01-03T10:00:00Z', text: 'funny' })
  const hits = greatestHits([
    newer, old, funny,
    react('sam', old, 'love', at), react('riley', old, 'love', at),
    react('sam', newer, 'love', at), react('riley', newer, 'love', at),
    react('sam', funny, 'laugh', at), react('riley', funny, 'love', at),
  ])
  expect(hits.map((h) => h.text)).toEqual(['funny', 'old', 'newer'])
})

it('returns nothing for no messages', () => {
  expect(greatestHits([])).toEqual([])
})

it('truncates by whole code points and marks the cut', () => {
  const m = msg({ senderId: 'alex', sentAt: '2026-01-01T10:00:00Z', text: 'a'.repeat(279) + '😂😂' })
  const [hit] = greatestHits([m, react('sam', m, 'love', at), react('riley', m, 'love', at)])
  expect(hit.text.isWellFormed()).toBe(true)
  expect(hit.text).toBe('a'.repeat(279) + '😂…')
})
