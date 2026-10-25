import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { maskHandle } from '../src/format'
import { MessagesDb } from '../src/extract/messagesDb'
import { normalizeRows } from '../src/extract/normalize'
import type { Wrap } from '../src/types'
import { buildWrap } from '../src/wrap/buildWrap'
import { FAKE_PEOPLE, makeFakeDb } from './makeFakeDb'

const FROM = new Date(2026, 0, 1)
const TO = new Date(2027, 0, 1)

function fakeName(handle: string): string {
  return Object.values(FAKE_PEOPLE).find((p) => p.handle === handle)?.name ?? maskHandle(handle)
}

/** Builds a wrap from a freshly generated fake chat.db. Used by tests and `wrapped demo`. */
export function makeFakeWrap(mode: 'group' | 'solo' = 'group'): Wrap {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wrapped-fake-'))
  try {
    const fake = makeFakeDb(dir)
    const db = MessagesDb.open(fake.path)
    try {
      const chats = db.listChats().map((c) => ({ ...c, name: c.name || fakeName(c.memberIds[0] ?? '') }))
      const chatIds = mode === 'group' ? [fake.groupChatId] : undefined
      const { messages } = normalizeRows(db.messageRows({ chatIds, from: FROM, to: TO }))
      const title = mode === 'group' ? 'Pasta Gang' : 'Your 2026'
      return buildWrap(messages, { mode, title, from: FROM, to: TO, nameFor: fakeName, chats })
    } finally {
      db.close()
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}
