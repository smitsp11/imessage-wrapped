import { expect, it } from 'vitest'
import { starterStats } from '../../src/stats/starters'
import { msg } from '../../fixtures/messages'

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
