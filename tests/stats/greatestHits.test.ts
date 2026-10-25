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
