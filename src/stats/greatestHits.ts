import type { Message } from '../types'
import { contentMessages } from './conversation'

export type Hit = { senderId: string; text: string; sentAt: string; reactions: number; laughs: number }

export const MIN_HIT_REACTIONS = 2
export const MAX_QUOTE_LENGTH = 280

/** The group already voted on what was funny: rank text messages by their reactions. */
export function greatestHits(messages: Message[], limit = 10): Hit[] {
  const counts = new Map<string, { reactions: number; laughs: number }>()
  for (const r of messages) {
    if (!r.reactionType || !r.reactsToGuid) continue
    const count = counts.get(r.reactsToGuid) ?? { reactions: 0, laughs: 0 }
    count.reactions += 1
    if (r.reactionType === 'laugh') count.laughs += 1
    counts.set(r.reactsToGuid, count)
  }

  return contentMessages(messages)
    .flatMap((m) => {
      const count = counts.get(m.guid)
      if (!m.text || !count || count.reactions < MIN_HIT_REACTIONS) return []
      return [{ senderId: m.senderId, text: m.text.slice(0, MAX_QUOTE_LENGTH), sentAt: m.sentAt.toISOString(), ...count }]
    })
    .sort((a, b) => b.reactions - a.reactions || b.laughs - a.laughs || a.sentAt.localeCompare(b.sentAt))
    .slice(0, limit)
}
