import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MissingDatabaseError } from '../../src/errors'
import { MessagesDb } from '../../src/extract/messagesDb'
import { FAKE_PEOPLE, type FakeDb, makeFakeDb } from '../../fixtures/makeFakeDb'

const YEAR = { from: new Date('2026-01-01T00:00:00Z'), to: new Date('2027-01-01T00:00:00Z') }
let dir: string
let fake: FakeDb
let db: MessagesDb

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'messages-db-test-'))
  fake = makeFakeDb(dir)
  db = MessagesDb.open(fake.path)
})
afterAll(() => {
  db.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('MessagesDb', () => {
  it('lists chats, busiest first', () => {
    const chats = db.listChats()
    expect(chats.map((c) => [c.id, c.name, c.isGroup, c.messageCount])).toEqual([
      [fake.groupChatId, 'Pasta Gang', true, 402], // includes the rename event
      [fake.dmChatId, '', false, 10],
    ])
    expect(chats[0]?.memberIds).toHaveLength(4)
    expect(chats[0]?.memberIds).toContain(FAKE_PEOPLE.jordan.handle)
  })

  it('returns rows for one chat in a period, oldest first', () => {
    const rows = db.messageRows({ chatIds: [fake.groupChatId], ...YEAR })
    expect(rows).toHaveLength(401)
    expect(rows[0]).toMatchObject({ text: 'pasta tonight?', handle: FAKE_PEOPLE.alex.handle, isFromMe: 0 })
    expect(rows.every((r, i) => i === 0 || r.dateMs >= rows[i - 1]!.dateMs)).toBe(true)
  })

  it('returns rows for every chat when no chat is given', () => {
    expect(db.messageRows(YEAR)).toHaveLength(411)
  })

  it('returns nothing for a period with no messages', () => {
    expect(db.messageRows({ from: new Date('2020-01-01'), to: new Date('2021-01-01') })).toEqual([])
  })

  it('works on a copy, never the original file', () => {
    expect(fs.readdirSync(dir)).toEqual(['chat.db'])
  })

  it('explains when there is no database', () => {
    expect(() => MessagesDb.open(path.join(dir, 'missing', 'chat.db'))).toThrow(MissingDatabaseError)
  })
})
