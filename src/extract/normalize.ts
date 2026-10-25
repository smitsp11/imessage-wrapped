import type { Message, ReactionType } from '../types'
import { appleMsToDate } from './appleTime'
import { decodeAttributedBody } from './decodeBody'

/** One row from the message query in MessagesDb. */
export type MessageRow = {
  id: number
  guid: string
  chatId: number
  isFromMe: number
  handle: string | null
  /** milliseconds since the Apple epoch */
  dateMs: number
  text: string | null
  body: Uint8Array | null
  hasAttachment: number
  assocGuid: string | null
  assocType: number | null
  assocEmoji: string | null
}

export type NormalizeResult = { messages: Message[]; undecodable: number }

/** associated_message_type: 2000 + index adds a reaction, 3000 + index removes it. */
const REACTIONS: ReactionType[] = ['love', 'like', 'dislike', 'laugh', 'emphasize', 'question', 'emoji']
const ADD_BASE = 2000
const REMOVE_BASE = 3000

/** Rows must be sorted by time so removals come after the reactions they cancel. */
export function normalizeRows(rows: MessageRow[]): NormalizeResult {
  const out: (Message | null)[] = [] // null marks a reaction that was later removed; filtered out at the end
  const activeReactions = new Map<string, number>()
  let undecodable = 0

  for (const row of rows) {
    const senderId = row.isFromMe === 1 ? 'me' : (row.handle ?? 'unknown')
    const assocType = row.assocType ?? 0

    if (assocType !== 0) {
      const removal = assocType >= REMOVE_BASE
      const reactionType = REACTIONS[assocType - (removal ? REMOVE_BASE : ADD_BASE)]
      if (!reactionType || !row.assocGuid) continue // stickers and other non-reaction links

      const target = stripPartPrefix(row.assocGuid)
      const key = `${senderId}|${row.assocGuid}|${reactionType}`
      if (removal) {
        const index = activeReactions.get(key)
        if (index !== undefined) out[index] = null
        activeReactions.delete(key)
        continue
      }
      activeReactions.set(key, out.length)
      out.push(toMessage(row, senderId, {
        text: null,
        reactsToGuid: target,
        reactionType,
        reactionEmoji: reactionType === 'emoji' ? row.assocEmoji : null,
      }))
      continue
    }

    const text = cleanText(row.text || decodeAttributedBody(row.body))
    if (text === null && !row.hasAttachment) {
      if (row.body) undecodable++
      continue
    }
    out.push(toMessage(row, senderId, { text, reactsToGuid: null, reactionType: null, reactionEmoji: null }))
  }

  return { messages: out.filter((m): m is Message => m !== null), undecodable }
}

function toMessage(
  row: MessageRow,
  senderId: string,
  rest: Pick<Message, 'text' | 'reactsToGuid' | 'reactionType' | 'reactionEmoji'>,
): Message {
  return {
    id: row.id,
    guid: row.guid,
    chatId: row.chatId,
    senderId,
    sentAt: appleMsToDate(row.dateMs),
    isFromMe: row.isFromMe === 1,
    hasAttachment: row.hasAttachment === 1,
    ...rest,
  }
}

/** Reaction targets look like "p:0/<guid>" (a part of a message) or "bp:<guid>". */
function stripPartPrefix(guid: string): string {
  return guid.replace(/^(?:p:\d+\/|bp:)/, '')
}

/** Attachments show up as U+FFFC placeholders inside the text. */
function cleanText(text: string | null): string | null {
  if (text === null) return null
  const cleaned = text.replace(/\uFFFC/g, '').trim()
  return cleaned.length > 0 ? cleaned : null
}
