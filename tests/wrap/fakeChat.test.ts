import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { MessagesDb } from '../../src/extract/messagesDb'
import { normalizeRows } from '../../src/extract/normalize'
import type { Wrap } from '../../src/types'
import { FAKE_PEOPLE, makeFakeDb } from '../../fixtures/makeFakeDb'
import { makeFakeWrap } from '../../fixtures/fakeWrap'

const nameOf = (wrap: Wrap, id: string) => wrap.people[id]

describe('the fake "Pasta Gang" chat', () => {
  let wrap: Wrap
  beforeAll(() => {
    wrap = makeFakeWrap('group')
  })

  it('counts every message', () => {
    expect(wrap.volume.total).toBe(302)
    expect(Object.fromEntries(Object.entries(wrap.volume.byPerson).map(([id, n]) => [nameOf(wrap, id), n]))).toEqual({
      'Alex Chen': 90, You: 80, 'Sam Rivera': 66, 'Jordan Lee': 60, 'Riley Park': 6,
    })
  })

  it('gives the expected awards', () => {
    expect(wrap.awards.map((a) => [a.id, nameOf(wrap, a.personId), a.value])).toEqual([
      ['main-character', 'Alex Chen', 29.8],
      ['ghost', 'Jordan Lee', 300],
      ['starter', 'Alex Chen', 60],
      ['comedian', 'Alex Chen', 70],
      ['hype', 'Sam Rivera', 61],
      ['night-owl', 'Jordan Lee', 100],
      ['double-texter', 'You', 20],
    ])
  })

  it('finds the streak, the greatest hits and the signature words', () => {
    expect(wrap.timing.longestStreakDays).toBe(61)
    expect(wrap.greatestHits.map((h) => [nameOf(wrap, h.senderId), h.text, h.reactions])).toEqual([
      ['Alex Chen', 'pasta tonight?', 4],
      ['You', 'omw', 3],
    ])
    expect(Object.fromEntries(Object.entries(wrap.words.signatureWordByPerson).map(([id, w]) => [nameOf(wrap, id), w]))).toEqual({
      'Alex Chen': 'pasta', You: 'omw', 'Sam Rivera': 'bet', 'Jordan Lee': 'sorry', 'Riley Park': 'heyyy',
    })
    expect(wrap.words.topWords.slice(0, 2)).toEqual([{ word: 'sorry', count: 120 }, { word: 'bet', count: 70 }])
    expect(wrap.words.topEmoji[0]).toEqual({ emoji: '🍝', count: 60 })
  })

  it('reports the one message it could not decode', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-chat-'))
    try {
      const db = MessagesDb.open(makeFakeDb(dir).path)
      try {
        const { undecodable } = normalizeRows(db.messageRows({ from: new Date('2026-01-01'), to: new Date('2027-01-01') }))
        expect(undecodable).toBe(1)
      } finally {
        db.close()
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('builds a solo wrap with top chats', () => {
    const solo = makeFakeWrap('solo')
    expect(solo.volume.total).toBe(312)
    expect(solo.topChats).toEqual([{ name: 'Pasta Gang', messages: 302 }, { name: 'Alex Chen', messages: 10 }])
  })

  it('never contains a raw handle, in group or solo', () => {
    for (const mode of ['group', 'solo'] as const) {
      const json = JSON.stringify(makeFakeWrap(mode))
      for (const p of Object.values(FAKE_PEOPLE)) expect(json).not.toContain(p.handle)
    }
  })

  it('uses only your own words in a solo wrap', () => {
    const solo = makeFakeWrap('solo')
    const words = solo.words.topWords.map((w) => w.word)
    for (const theirs of ['sorry', 'bet', 'pasta']) expect(words).not.toContain(theirs)
    expect(words).toContain('omw')
    expect(solo.words.topEmoji.map((e) => e.emoji)).not.toContain('🍝')
  })
})
