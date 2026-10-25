import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { MissingDatabaseError, NoFullDiskAccessError } from '../../src/errors'
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

  it('returns no rows for an empty chat list, and every row for both chats', () => {
    expect(db.messageRows({ chatIds: [], ...YEAR })).toEqual([])
    expect(db.messageRows({ chatIds: [fake.groupChatId, fake.dmChatId], ...YEAR })).toHaveLength(411)
  })

  it('treats the period as half-open: [from, to)', () => {
    const first = new Date('2026-01-05T20:00:00Z')
    const end = new Date('2027-01-01T00:00:00Z')
    expect(db.messageRows({ chatIds: [fake.groupChatId], from: first, to: end })).toHaveLength(401)
    expect(db.messageRows({ chatIds: [fake.groupChatId], from: new Date('2026-01-01T00:00:00Z'), to: first })).toHaveLength(0)
  })
})

describe('MessagesDb on isolated files', () => {
  function freshDir(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'messages-db-test-'))
    cleanup.push(d)
    return d
  }
  const cleanup: string[] = []
  afterAll(() => {
    for (const d of cleanup) fs.rmSync(d, { recursive: true, force: true })
  })

  it('sees rows that are still only in the -wal file', () => {
    const d = freshDir()
    const f = makeFakeDb(d)
    const writer = new Database(f.path)
    let reader: MessagesDb | undefined
    try {
      writer.pragma('wal_autocheckpoint = 0')
      const date = (Date.UTC(2026, 5, 1) - Date.UTC(2001, 0, 1)) * 1_000_000
      const { lastInsertRowid } = writer
        .prepare('INSERT INTO message (guid, text, date, item_type) VALUES (?, ?, ?, 0)')
        .run('WAL-ONLY', 'only in the wal', date)
      writer.prepare('INSERT INTO chat_message_join (chat_id, message_id, message_date) VALUES (?, ?, ?)').run(f.dmChatId, lastInsertRowid, date)
      reader = MessagesDb.open(f.path)
      expect(reader.messageRows({ chatIds: [f.dmChatId], ...YEAR }).map((r) => r.text)).toContain('only in the wal')
    } finally {
      reader?.close()
      writer.close()
    }
  })

  it('removes its temp copy on close()', () => {
    const f = makeFakeDb(freshDir())
    const spy = vi.spyOn(fs, 'mkdtempSync')
    let copyDir: string
    try {
      const opened = MessagesDb.open(f.path)
      copyDir = spy.mock.results.map((r) => String(r.value)).find((p) => path.basename(p).startsWith('wrapped-')) ?? ''
      expect(copyDir).not.toBe('')
      expect(fs.existsSync(copyDir)).toBe(true)
      opened.close()
    } finally {
      spy.mockRestore()
    }
    expect(fs.existsSync(copyDir)).toBe(false)
  })

  it('rejects a file that is not a Messages database', () => {
    const d = freshDir()
    const file = path.join(d, 'chat.db')
    fs.writeFileSync(file, 'definitely not sqlite, just some junk bytes')
    const spy = vi.spyOn(fs, 'mkdtempSync')
    try {
      expect(() => MessagesDb.open(file)).toThrow()
      const copies = spy.mock.results.map((r) => String(r.value)).filter((p) => path.basename(p).startsWith('wrapped-'))
      expect(copies).toHaveLength(1)
      expect(fs.existsSync(copies[0]!)).toBe(false) // the private copy is cleaned up
    } finally {
      spy.mockRestore()
    }
  })

  it.skipIf(process.getuid?.() === 0)('explains when macOS blocks access', () => {
    const d = freshDir()
    const f = makeFakeDb(d)
    fs.chmodSync(f.path, 0o000)
    try {
      expect(() => MessagesDb.open(f.path)).toThrow(NoFullDiskAccessError)
    } finally {
      fs.chmodSync(f.path, 0o644)
    }
  })
})
