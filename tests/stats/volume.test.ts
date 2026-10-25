import { expect, it } from 'vitest'
import { volumeStats } from '../../src/stats/volume'
import { msg, react } from '../../fixtures/messages'

it('counts messages and attachments per person, ignoring reactions', () => {
  const a = msg({ senderId: 'alex', sentAt: '2026-01-01T10:00:00Z' })
  const messages = [
    a,
    msg({ senderId: 'me', sentAt: '2026-01-01T10:01:00Z', text: null, hasAttachment: true }),
    react('me', a, 'laugh', '2026-01-01T10:02:00Z'),
  ]
  expect(volumeStats(messages)).toEqual({ total: 2, byPerson: { alex: 1, me: 1 }, attachmentsByPerson: { me: 1 } })
})
