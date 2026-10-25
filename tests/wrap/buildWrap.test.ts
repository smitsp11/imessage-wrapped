import { describe, expect, it } from 'vitest'
import { EmptyPeriodError } from '../../src/errors'
import { buildWrap } from '../../src/wrap/buildWrap'
import { msg, react } from '../../fixtures/messages'

const period = { from: new Date(2026, 0, 1), to: new Date(2027, 0, 1) }
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
    expect(wrap.period).toEqual({ from: '2026-01-01', to: '2027-01-01' })
  })

  it('refuses an empty period', () => {
    expect(() => buildWrap([], { mode: 'group', title: 'Test', ...period, nameFor })).toThrow(EmptyPeriodError)
  })

  it('never lets a raw handle through, even when nameFor has no name', () => {
    const wrap = buildWrap(
      [msg({ senderId: '+14165550199', sentAt: '2026-03-01T10:00:00Z' }), msg({ senderId: 'me', sentAt: '2026-03-01T10:01:00Z' })],
      { mode: 'group', title: 'Test', ...period, nameFor: (h) => h },
    )
    expect(JSON.stringify(wrap)).not.toContain('4165550199')
  })

  it('reports period as local calendar dates in any timezone', () => {
    const old = process.env.TZ
    process.env.TZ = 'Europe/Paris'
    try {
      const wrap = buildWrap([msg({ senderId: 'me', sentAt: '2026-03-01T10:00:00Z' })], {
        mode: 'group', title: 'Test', from: new Date(2026, 0, 1), to: new Date(2027, 0, 1), nameFor,
      })
      expect(wrap.period.from).toBe('2026-01-01')
    } finally {
      if (old === undefined) delete process.env.TZ
      else process.env.TZ = old
    }
  })

  it('refuses a period with only reactions', () => {
    const target = msg({ senderId: 'me', sentAt: '2025-12-31T10:00:00Z' })
    expect(() =>
      buildWrap([target, react('+14165550101', target, 'love', '2026-03-01T10:00:00Z')], { mode: 'group', title: 'Test', ...period, nameFor }),
    ).toThrow(EmptyPeriodError)
  })

  it('gives a reactions-only person an id and a name', () => {
    const target = msg({ senderId: 'me', sentAt: '2026-03-01T10:00:00Z' })
    const wrap = buildWrap([target, react('+14165550101', target, 'love', '2026-03-01T10:01:00Z')], {
      mode: 'group', title: 'Test', ...period, nameFor,
    })
    expect(wrap.people).toEqual({ p1: 'Alex Chen', me: 'You' })
  })

  it('includes a message exactly at from and excludes one exactly at to', () => {
    const wrap = buildWrap(
      [msg({ senderId: 'me', sentAt: period.from.toISOString() }), msg({ senderId: 'me', sentAt: period.to.toISOString() })],
      { mode: 'group', title: 'Test', ...period, nameFor },
    )
    expect(wrap.volume.total).toBe(1)
  })

  describe('solo mode', () => {
    const handles = Array.from({ length: 7 }, (_, i) => `+1416555020${i}`)
    const messages = () => {
      const out = handles.flatMap((h, i) =>
        Array.from({ length: 60 - i * 5 }, (_, k) => msg({ senderId: h, chatId: i + 1, sentAt: `2026-03-01T10:${String(k % 60).padStart(2, '0')}:00Z`, text: `hi ${k}` })),
      )
      const mine = Array.from({ length: 60 }, (_, k) => msg({ senderId: 'me', chatId: 1, sentAt: `2026-03-02T10:${String(k).padStart(2, '0')}:00Z`, text: 'mine' }))
      const theirs = out.filter((m) => m.senderId === handles[6])[0]!
      const hit = mine[0]!
      return [...out, ...mine, react(handles[5]!, hit, 'love', '2026-03-02T11:00:00Z'), react(handles[6]!, hit, 'laugh', '2026-03-02T11:01:00Z'),
        react('me', theirs, 'love', '2026-03-02T11:02:00Z'), react(handles[0]!, theirs, 'love', '2026-03-02T11:03:00Z')]
    }
    const solo = buildWrap(messages(), { mode: 'solo', title: 'Test', ...period, nameFor: (h) => `Name ${h.slice(-1)}` })

    it('keeps you, five contacts and one "Everyone else"', () => {
      expect(Object.keys(solo.people).sort()).toEqual(['me', 'others', 'p1', 'p2', 'p3', 'p4', 'p5'])
      expect(solo.people.others).toBe('Everyone else')
      expect(solo.people.me).toBe('You')
    })

    it('never gives an award to "Everyone else"', () => {
      expect(solo.awards.some((a) => a.personId === 'others')).toBe(false)
    })

    it('keeps only your own messages as greatest hits, counting everyone\'s reactions', () => {
      expect(solo.greatestHits.length).toBe(1)
      expect(solo.greatestHits.every((h) => h.senderId === 'me')).toBe(true)
      expect(solo.greatestHits[0]!.reactions).toBe(2)
    })
  })

  it('caps top chats at 5, breaking ties by chat id', () => {
    const rows = [6, 5, 4, 3, 2, 1].map((chatId) => msg({ senderId: 'me', chatId, sentAt: '2026-03-01T10:00:00Z' }))
    const chats = [1, 2, 3, 4, 5, 6].map((id) => ({ id, name: id === 1 ? '' : `Chat ${id}`, isGroup: true, memberIds: [], messageCount: 1 }))
    const wrap = buildWrap(rows, { mode: 'solo', title: 'Test', ...period, nameFor, chats })
    expect(wrap.topChats.map((c) => c.name)).toEqual(['A chat', 'Chat 2', 'Chat 3', 'Chat 4', 'Chat 5'])
  })
})
