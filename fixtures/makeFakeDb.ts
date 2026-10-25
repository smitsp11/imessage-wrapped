import path from 'node:path'
import Database from 'better-sqlite3'
import { toAppleNs } from '../src/extract/appleTime'
import { makeAttributedBody } from './attributedBody'

/** Fake people. The handles use reserved 555-01xx numbers and example.com. */
export const FAKE_PEOPLE = {
  alex: { handle: '+14165550101', name: 'Alex Chen' },
  sam: { handle: '+14165550102', name: 'Sam Rivera' },
  jordan: { handle: 'jordan@example.com', name: 'Jordan Lee' },
  riley: { handle: '+14165550104', name: 'Riley Park' },
} as const

type Friend = keyof typeof FAKE_PEOPLE
type Sender = Friend | 'me'

export type FakeDb = { path: string; groupChatId: number; dmChatId: number }

/** The subset of Apple's real schema that MessagesDb reads, with the same names. */
const SCHEMA = `
  CREATE TABLE handle (ROWID INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL, service TEXT);
  CREATE TABLE chat (ROWID INTEGER PRIMARY KEY AUTOINCREMENT, guid TEXT, style INTEGER, chat_identifier TEXT, display_name TEXT);
  CREATE TABLE message (
    ROWID INTEGER PRIMARY KEY AUTOINCREMENT, guid TEXT UNIQUE NOT NULL, text TEXT, attributedBody BLOB,
    handle_id INTEGER DEFAULT 0, date INTEGER, is_from_me INTEGER DEFAULT 0, item_type INTEGER DEFAULT 0,
    cache_has_attachments INTEGER DEFAULT 0, associated_message_guid TEXT,
    associated_message_type INTEGER DEFAULT 0, associated_message_emoji TEXT
  );
  CREATE TABLE chat_message_join (chat_id INTEGER, message_id INTEGER, message_date INTEGER DEFAULT 0, PRIMARY KEY (chat_id, message_id));
  CREATE TABLE chat_handle_join (chat_id INTEGER, handle_id INTEGER, UNIQUE (chat_id, handle_id));
`

const LOVE = 2000
const LAUGH = 2003
const REMOVE_LAUGH = 3003
const GROUP_STYLE = 43
const DM_STYLE = 45

type AddOptions = { text?: string; body?: Buffer; attachment?: boolean; reactTo?: string; reactType?: number }

export function makeFakeDb(dir: string): FakeDb {
  const dbPath = path.join(dir, 'chat.db')
  const db = new Database(dbPath)
  db.exec(SCHEMA)

  const insertHandle = db.prepare('INSERT INTO handle (id, service) VALUES (?, ?)')
  const handleIds = {} as Record<Friend, number>
  for (const key of Object.keys(FAKE_PEOPLE) as Friend[]) {
    handleIds[key] = Number(insertHandle.run(FAKE_PEOPLE[key].handle, 'iMessage').lastInsertRowid)
  }

  const insertChat = db.prepare('INSERT INTO chat (guid, style, chat_identifier, display_name) VALUES (?, ?, ?, ?)')
  const insertMember = db.prepare('INSERT INTO chat_handle_join (chat_id, handle_id) VALUES (?, ?)')
  function addChat(style: number, identifier: string, name: string, members: number[]): number {
    const id = Number(insertChat.run(`iMessage;${style === GROUP_STYLE ? '+' : '-'};${identifier}`, style, identifier, name).lastInsertRowid)
    for (const member of members) insertMember.run(id, member)
    return id
  }
  const groupChatId = addChat(GROUP_STYLE, 'chat100000000000000001', 'Pasta Gang', Object.values(handleIds))
  const dmChatId = addChat(DM_STYLE, FAKE_PEOPLE.alex.handle, '', [handleIds.alex])

  const insertMessage = db.prepare(`
    INSERT INTO message (guid, text, attributedBody, handle_id, date, is_from_me, cache_has_attachments,
      associated_message_guid, associated_message_type)
    VALUES (@guid, @text, @body, @handleId, @date, @fromMe, @attachment, @assocGuid, @assocType)`)
  const insertJoin = db.prepare('INSERT INTO chat_message_join (chat_id, message_id, message_date) VALUES (?, ?, ?)')

  let counter = 0
  function add(chatId: number, sender: Sender, at: Date, opts: AddOptions = {}): string {
    const guid = `FAKE-${String(++counter).padStart(5, '0')}`
    const fromMe = sender === 'me'
    // Like Messages: my own group messages have handle_id 0; in a DM they carry the other person's handle.
    const handleId = fromMe ? (chatId === dmChatId ? handleIds.alex : 0) : handleIds[sender]
    const date = toAppleNs(at)
    const { lastInsertRowid } = insertMessage.run({
      guid,
      text: opts.text ?? null,
      body: opts.body ?? null,
      handleId,
      date,
      fromMe: fromMe ? 1 : 0,
      attachment: opts.attachment ? 1 : 0,
      assocGuid: opts.reactTo ? `p:0/${opts.reactTo}` : null,
      assocType: opts.reactType ?? 0,
    })
    insertJoin.run(chatId, lastInsertRowid, date)
    return guid
  }

  /** Day 0 is Monday 2026-01-05; times are UTC. */
  function at(day: number, time: string): Date {
    const [hours = 0, minutes = 0] = time.split(':').map(Number)
    return new Date(Date.UTC(2026, 0, 5 + day, hours, minutes))
  }

  const g = groupChatId
  db.transaction(() => {
    for (let d = 0; d < 60; d++) {
      const opener = add(g, 'alex', at(d, '20:00'), { text: 'pasta tonight?' })
      add(g, 'sam', at(d, '20:03'), { reactTo: opener, reactType: LAUGH })
      add(g, 'sam', at(d, '20:04'), { text: 'bet im in 🍝' })
      if (d % 12 === 0) add(g, 'sam', at(d, '20:05'), { text: 'bet bet' })
      if (d === 10) add(g, 'sam', at(d, '20:06'), { text: '\uFFFC', attachment: true })
      const omw = add(g, 'me', at(d, '20:14'), { text: 'omw' })
      if (d === 7) for (const who of ['me', 'jordan', 'riley'] as const) add(g, who, at(d, '20:20'), { reactTo: opener, reactType: LAUGH })
      if (d === 20) for (const who of ['alex', 'sam', 'jordan'] as const) add(g, who, at(d, '20:30'), { reactTo: omw, reactType: LOVE })
      if (d % 3 === 0) add(g, 'me', at(d, '20:40'), { text: 'where is everyone' })
      if (d === 30) {
        add(g, 'riley', at(d, '20:50'), { reactTo: opener, reactType: LAUGH })
        add(g, 'riley', at(d, '20:51'), { reactTo: opener, reactType: REMOVE_LAUGH })
      }
      if (d === 45) add(g, 'alex', at(d, '20:50'), { body: Buffer.from([1, 2, 3]) })
      const sorry = add(g, 'jordan', at(d + 1, '01:14'), { body: makeAttributedBody('sorry sorry just woke up') })
      if (d % 2 === 0) {
        add(g, 'alex', at(d + 1, '01:15'), { text: 'lol classic jordan' })
        add(g, 'me', at(d + 1, '01:30'), { reactTo: sorry, reactType: LOVE })
      }
      if (d % 10 === 0) add(g, 'riley', at(d + 1, '01:20'), { text: 'heyyy' })
    }
    for (let i = 0; i < 10; i++) {
      add(dmChatId, i % 2 === 0 ? 'alex' : 'me', new Date(Date.UTC(2026, 1, 1, 12, 2 * i)), { text: `dm message ${i}` })
    }
  })()

  db.close()
  return { path: dbPath, groupChatId, dmChatId }
}
