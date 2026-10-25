import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { afterAll, expect, it } from 'vitest'
import { makeFakeDb } from '../../fixtures/makeFakeDb'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-db-test-'))
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }))

it('builds a chat.db with the scripted group chat and a DM', () => {
  const fake = makeFakeDb(dir)
  const db = new Database(fake.path, { readonly: true })
  const count = (chatId: number) =>
    (db.prepare('SELECT COUNT(*) AS n FROM chat_message_join WHERE chat_id = ?').get(chatId) as { n: number }).n
  expect(count(fake.groupChatId)).toBe(401)
  expect(count(fake.dmChatId)).toBe(10)
  db.close()
})
