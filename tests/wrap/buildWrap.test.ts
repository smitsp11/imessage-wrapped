import { describe, expect, it } from 'vitest'
import { EmptyPeriodError } from '../../src/errors'
import { buildWrap } from '../../src/wrap/buildWrap'
import { msg } from '../../fixtures/messages'

const period = { from: new Date('2026-01-01T00:00:00Z'), to: new Date('2027-01-01T00:00:00Z') }
const nameFor = (handle: string) => ({ '+14165550101': 'Alex Chen', '+14165550102': 'Sam Rivera' })[handle] ?? handle

describe('buildWrap', () => {
  it('replaces handles with short ids, busiest first, and keeps "me"', () => {
    const wrap = buildWrap(
      [
        msg({ senderId: '+14165550102', sentAt: '2026-03-01T10:00:00Z' }),
        msg({ senderId: '+14165550101', sentAt: '2026-03-01T10:01:00Z' }),
        msg({ senderId: '+14165550101', sentAt: '2026-03-01T10:02:00Z' }),
        msg({ senderId: 'me', sentAt: '2026-03-01T10:03:00Z' }),
        msg({ senderId: 'me', sentAt: '2025-12-31T10:03:00Z' }), // outside the period
      ],
      { mode: 'group', title: 'Test', ...period, nameFor },
    )
    expect(wrap.people).toEqual({ p1: 'Alex Chen', me: 'You', p2: 'Sam Rivera' })
    expect(wrap.volume.byPerson).toEqual({ p2: 1, p1: 2, me: 1 })
    expect(JSON.stringify(wrap)).not.toContain('+1416')
    expect(wrap.period).toEqual({ from: '2026-01-01T00:00:00.000Z', to: '2027-01-01T00:00:00.000Z' })
  })

  it('refuses an empty period', () => {
    expect(() => buildWrap([], { mode: 'group', title: 'Test', ...period, nameFor })).toThrow(EmptyPeriodError)
  })
})
