import type { Message } from '../types'
import { contentMessages } from './conversation'

export type Hit = { senderId: string; text: string; sentAt: string; reactions: number; laughs: number }

export const MIN_HIT_REACTIONS = 2
export const MAX_QUOTE_LENGTH = 280

/**
 * The group already voted on what was funny: rank text messages by their reactions.
 * Each person counts once per message, and reacting to your own message doesn't count.
 * A custom emoji tapback (even a laughing one) isn't counted as a laugh in v1.
 */
export function greatestHits(messages: Message[], limit = 10): Hit[] {
  const senderByGuid = new Map(contentMessages(messages).map((m) => [m.guid, m.senderId]))
  const reactors = new Map<string, Set<string>>()
  const laughers = new Map<string, Set<string>>()
  for (const r of messages) {
    if (!r.reactionType || !r.reactsToGuid) continue
    if (senderByGuid.get(r.reactsToGuid) === r.senderId) continue
    reactors.set(r.reactsToGuid, (reactors.get(r.reactsToGuid) ?? new Set()).add(r.senderId))
    if (r.reactionType === 'laugh') {
      laughers.set(r.reactsToGuid, (laughers.get(r.reactsToGuid) ?? new Set()).add(r.senderId))
    }
  }

  return contentMessages(messages)
    .flatMap((m) => {
      const reactions = reactors.get(m.guid)?.size ?? 0
      if (!m.text || reactions < MIN_HIT_REACTIONS) return []
      const chars = Array.from(m.text)
      const text = chars.length > MAX_QUOTE_LENGTH ? chars.slice(0, MAX_QUOTE_LENGTH).join('') + '…' : m.text
      return [{ senderId: m.senderId, text, sentAt: m.sentAt.toISOString(), reactions, laughs: laughers.get(m.guid)?.size ?? 0 }]
    })
    .sort((a, b) => b.reactions - a.reactions || b.laughs - a.laughs || a.sentAt.localeCompare(b.sentAt))
    .slice(0, limit)
}
