import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { afterAll, expect, it } from 'vitest'
import { toAppleNs } from '../../src/extract/appleTime'
import { FAKE_PEOPLE, makeFakeDb } from '../../fixtures/makeFakeDb'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-db-test-'))
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }))

it('builds a chat.db with the scripted group chat and a DM', () => {
  const fake = makeFakeDb(dir)
  const db = new Database(fake.path, { readonly: true })
  const count = (chatId: number) =>
    (db.prepare('SELECT COUNT(*) AS n FROM chat_message_join WHERE chat_id = ?').get(chatId) as { n: number }).n
  expect(count(fake.groupChatId)).toBe(402) // 401 messages + 1 rename event
  expect(count(fake.dmChatId)).toBe(10)
  db.close()
})

it('matches the scripted scenario', () => {
  const fake = makeFakeDb(fs.mkdtempSync(path.join(dir, 'scenario-')))
  const db = new Database(fake.path, { readonly: true })
  const group = fake.groupChatId
  const rows = (sql: string) => db.prepare(sql).all(group) as Record<string, number | string>[]
  const inGroup = `FROM message m JOIN chat_message_join j ON j.message_id = m.ROWID
    LEFT JOIN handle h ON h.ROWID = m.handle_id WHERE j.chat_id = ?`
  const real = `${inGroup} AND m.item_type = 0 AND m.associated_message_type = 0`

  expect(rows(`SELECT 1 ${inGroup} AND m.is_from_me = 1 AND m.handle_id <> 0`)).toEqual([])
  expect(
    rows(`SELECT 1 ${inGroup} AND m.associated_message_guid IS NOT NULL
      AND m.associated_message_guid NOT IN (SELECT 'p:0/' || guid FROM message)`),
  ).toEqual([])
  expect(rows(`SELECT 1 ${inGroup} AND m.item_type <> 0`)).toHaveLength(1)

  const nameByHandle = new Map<string, string>(Object.values(FAKE_PEOPLE).map((p) => [p.handle, p.name]))
  const counts: Record<string, number> = {}
  for (const row of rows(`SELECT m.is_from_me AS me, h.id AS handle, COUNT(*) AS n ${real}
      GROUP BY m.is_from_me, h.id`)) {
    const who = row.me ? 'me' : nameByHandle.get(String(row.handle))!
    counts[who] = Number(row.n)
  }
  expect(counts).toEqual({ 'Alex Chen': 91, me: 80, 'Sam Rivera': 66, 'Jordan Lee': 60, 'Riley Park': 6 })

  const range = db.prepare(`SELECT MIN(m.date) AS first, MAX(m.date) AS last ${real}`).safeIntegers().get(group) as {
    first: bigint
    last: bigint
  }
  expect(range.first).toBe(toAppleNs(new Date('2026-01-05T20:00:00Z')))
  expect(range.last).toBe(toAppleNs(new Date('2026-03-06T01:14:00Z')))
  db.close()
})
