import type { Message } from '../types'
import { HOUR, MINUTE, conversations, median } from './conversation'

/** Showing up more than 12 hours after a conversation started is too late to count as a reply. */
export const MAX_REPLY_GAP = 12 * HOUR

/**
 * medianReplyMinutesByPerson: the median time each person took to join a conversation someone else started.
 * repliesByPerson: how many conversations they joined that way.
 */
export type ReplyStats = {
  medianReplyMinutesByPerson: Record<string, number>
  repliesByPerson: Record<string, number>
}

/**
 * Each chat is split into conversations (see `conversations`), and the clock starts at a conversation's first message.
 * Everyone else's first message in it is their reply, timed from that start, if it comes within MAX_REPLY_GAP.
 * The starter isn't timed, later messages don't count, and people who never send in it aren't counted for it.
 * So in a busy group chat, sending a second after someone else doesn't make you fast: only how soon you joined does.
 */
export function replyStats(messages: Message[]): ReplyStats {
  const replyMinutesByPerson: Record<string, number[]> = {}
  for (const conversation of conversations(messages)) {
    const start = conversation[0]!
    const joined = new Set([start.senderId])
    for (const m of conversation) {
      if (joined.has(m.senderId)) continue
      joined.add(m.senderId)
      const wait = m.sentAt.getTime() - start.sentAt.getTime()
      if (wait <= MAX_REPLY_GAP) (replyMinutesByPerson[m.senderId] ??= []).push(wait / MINUTE)
    }
  }

  const medianReplyMinutesByPerson: Record<string, number> = {}
  const repliesByPerson: Record<string, number> = {}
  for (const [person, list] of Object.entries(replyMinutesByPerson)) {
    medianReplyMinutesByPerson[person] = Math.round(median(list) * 10) / 10
    repliesByPerson[person] = list.length
  }
  return { medianReplyMinutesByPerson, repliesByPerson }
}
