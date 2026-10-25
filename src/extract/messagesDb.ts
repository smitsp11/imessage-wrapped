import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { MissingDatabaseError, NoFullDiskAccessError, errorCode } from '../errors'
import type { Chat } from '../types'
import { toAppleNs } from './appleTime'
import { copyDatabase } from './copyDb'
import type { MessageRow } from './normalize'

export const DEFAULT_CHAT_DB = path.join(os.homedir(), 'Library', 'Messages', 'chat.db')

const GROUP_STYLE = 43
const MEMBER_SEPARATOR = '\u001f'

const CHATS_SQL = `
  SELECT c.ROWID AS id, COALESCE(c.display_name, '') AS name, c.style AS style,
    (SELECT COUNT(*) FROM chat_message_join j WHERE j.chat_id = c.ROWID) AS messageCount,
    (SELECT GROUP_CONCAT(h.id, char(31)) FROM chat_handle_join chj
       JOIN handle h ON h.ROWID = chj.handle_id WHERE chj.chat_id = c.ROWID) AS members
  FROM chat c
  ORDER BY messageCount DESC, c.ROWID`

type ChatRow = { id: number; name: string; style: number; messageCount: number; members: string | null }

export type RowQuery = { chatIds?: number[]; from: Date; to: Date }

/** Read-only access to a copy of the Messages database. */
export class MessagesDb {
  private constructor(
    private readonly db: Database.Database,
    private readonly tempDir: string,
    private readonly hasEmoji: boolean,
  ) {}

  static open(sourcePath: string = DEFAULT_CHAT_DB): MessagesDb {
    let copy: { path: string; dir: string }
    try {
      copy = copyDatabase(sourcePath)
    } catch (err) {
      const code = errorCode(err)
      if (code === 'ENOENT') throw new MissingDatabaseError(sourcePath)
      if (code === 'EPERM' || code === 'EACCES') throw new NoFullDiskAccessError()
      throw err
    }
    let db: Database.Database | undefined
    try {
      db = new Database(copy.path, { readonly: true })
      // Older macOS has no associated_message_emoji (it came with emoji tapbacks).
      const columns = db.pragma('table_info(message)') as { name: string }[]
      const hasEmoji = columns.some((c) => c.name === 'associated_message_emoji')
      db.prepare(CHATS_SQL) // fails here, not later, if this isn't a Messages database
      return new MessagesDb(db, copy.dir, hasEmoji)
    } catch (err) {
      db?.close()
      fs.rmSync(copy.dir, { recursive: true, force: true })
      throw err
    }
  }

  listChats(): Chat[] {
    const rows = this.db.prepare(CHATS_SQL).all() as ChatRow[]
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      isGroup: r.style === GROUP_STYLE,
      memberIds: r.members ? r.members.split(MEMBER_SEPARATOR) : [],
      messageCount: r.messageCount,
    }))
  }

  /**
   * Real messages (item_type 0) in [from, to), oldest first.
   * A message joined to two chats comes back once per chat (rare; only matters without chatIds).
   */
  messageRows({ chatIds, from, to }: RowQuery): MessageRow[] {
    if (chatIds && chatIds.length === 0) return []
    const chatFilter = chatIds ? `AND j.chat_id IN (${chatIds.map(() => '?').join(', ')})` : ''
    const sql = `
      SELECT m.ROWID AS id, m.guid AS guid, j.chat_id AS chatId, m.is_from_me AS isFromMe, h.id AS handle,
        m.date / 1000000 AS dateMs, m.text AS text,
        CASE WHEN m.text IS NULL OR m.text = '' THEN m.attributedBody END AS body,
        m.cache_has_attachments AS hasAttachment, m.associated_message_guid AS assocGuid,
        m.associated_message_type AS assocType, ${this.hasEmoji ? 'm.associated_message_emoji' : 'NULL'} AS assocEmoji
      FROM message m
      JOIN chat_message_join j ON j.message_id = m.ROWID
      LEFT JOIN handle h ON h.ROWID = m.handle_id
      WHERE m.item_type = 0 AND m.date >= ? AND m.date < ? ${chatFilter}
      ORDER BY m.date, m.ROWID`
    return this.db.prepare(sql).all(toAppleNs(from), toAppleNs(to), ...(chatIds ?? [])) as MessageRow[]
  }

  close(): void {
    try {
      this.db.close()
    } finally {
      fs.rmSync(this.tempDir, { recursive: true, force: true })
    }
  }
}
