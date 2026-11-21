import type { Message } from '../types'
import { MINUTE, conversations, increment } from './conversation'

export { NEW_CONVERSATION_GAP } from './conversation'
/** Sending again after 10+ minutes with no reply in between is a double text. Reactions don't count as an answer. */
export const DOUBLE_TEXT_GAP = 10 * MINUTE

export type StarterStats = {
  startsByPerson: Record<string, number>
  doubleTextsByPerson: Record<string, number>
}

// Double texts live here with conversation starts: both are about who keeps the conversation going.
// A conversation's first message is a start (see `conversations`), so the first message of the period in each chat
// always counts as one. Reply times (replies.ts) use the same conversations.
export function starterStats(messages: Message[]): StarterStats {
  const startsByPerson: Record<string, number> = {}
  const doubleTextsByPerson: Record<string, number> = {}
  for (const conversation of conversations(messages)) {
    conversation.forEach((current, i) => {
      const previous = conversation[i - 1]
      if (!previous) increment(startsByPerson, current.senderId)
      else if (previous.senderId === current.senderId && current.sentAt.getTime() - previous.sentAt.getTime() >= DOUBLE_TEXT_GAP) {
        increment(doubleTextsByPerson, current.senderId)
      }
    })
  }
  return { startsByPerson, doubleTextsByPerson }
}
