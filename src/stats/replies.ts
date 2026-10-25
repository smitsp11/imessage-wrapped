import type { Message } from '../types'
import { HOUR, MINUTE, increment, median, threads } from './conversation'

/** A message more than 12 hours after the last one isn't a reply, it's a new conversation. */
export const MAX_REPLY_GAP = 12 * HOUR

export type ReplyStats = {
  medianReplyMinutesByPerson: Record<string, number>
  repliesByPerson: Record<string, number>
}

export function replyStats(messages: Message[]): ReplyStats {
  const gaps: Record<string, number[]> = {}
  for (const thread of threads(messages)) {
    for (let i = 1; i < thread.length; i++) {
      const previous = thread[i - 1]!
      const current = thread[i]!
      if (current.senderId === previous.senderId) continue
      const gap = current.sentAt.getTime() - previous.sentAt.getTime()
      if (gap > MAX_REPLY_GAP) continue
      ;(gaps[current.senderId] ??= []).push(gap / MINUTE)
    }
  }

  const medianReplyMinutesByPerson: Record<string, number> = {}
  const repliesByPerson: Record<string, number> = {}
  for (const [person, list] of Object.entries(gaps)) {
    medianReplyMinutesByPerson[person] = Math.round(median(list) * 10) / 10
    increment(repliesByPerson, person, list.length)
  }
  return { medianReplyMinutesByPerson, repliesByPerson }
}
