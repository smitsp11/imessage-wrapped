import type { Message } from '../types'
import { HOUR, MINUTE, median, threads } from './conversation'

/** More than 12 hours later is too late to count as a reply. Replies are timed from the first unanswered message. */
export const MAX_REPLY_GAP = 12 * HOUR

export type ReplyStats = {
  medianReplyMinutesByPerson: Record<string, number>
  repliesByPerson: Record<string, number>
}

export function replyStats(messages: Message[]): ReplyStats {
  const replyMinutesByPerson: Record<string, number[]> = {}
  for (const thread of threads(messages)) {
    let turnStart = thread[0] // first message of the current run by one sender
    if (!turnStart) continue
    for (let i = 1; i < thread.length; i++) {
      const current = thread[i]!
      if (current.senderId === turnStart.senderId) continue
      const gap = current.sentAt.getTime() - turnStart.sentAt.getTime()
      if (gap <= MAX_REPLY_GAP) (replyMinutesByPerson[current.senderId] ??= []).push(gap / MINUTE)
      turnStart = current
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
