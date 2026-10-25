import type { Message } from '../types'
import { HOUR, MINUTE, increment, threads } from './conversation'

/** After 6 quiet hours, the next message starts a new conversation. */
export const NEW_CONVERSATION_GAP = 6 * HOUR
/** Sending again after 10+ minutes with no reply in between is a double text. */
export const DOUBLE_TEXT_GAP = 10 * MINUTE

export type StarterStats = {
  startsByPerson: Record<string, number>
  doubleTextsByPerson: Record<string, number>
}

export function starterStats(messages: Message[]): StarterStats {
  const startsByPerson: Record<string, number> = {}
  const doubleTextsByPerson: Record<string, number> = {}
  for (const thread of threads(messages)) {
    thread.forEach((current, i) => {
      const previous = thread[i - 1]
      const gap = previous ? current.sentAt.getTime() - previous.sentAt.getTime() : Infinity
      if (gap >= NEW_CONVERSATION_GAP) increment(startsByPerson, current.senderId)
      else if (previous?.senderId === current.senderId && gap >= DOUBLE_TEXT_GAP) {
        increment(doubleTextsByPerson, current.senderId)
      }
    })
  }
  return { startsByPerson, doubleTextsByPerson }
}
