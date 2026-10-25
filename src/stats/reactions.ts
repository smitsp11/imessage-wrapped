import type { Message } from '../types'
import { contentMessages, increment } from './conversation'

export type ReactionStats = {
  givenByPerson: Record<string, number>
  receivedByPerson: Record<string, number>
  laughsReceivedByPerson: Record<string, number>
  byType: Record<string, number>
}

export function reactionStats(messages: Message[]): ReactionStats {
  const senderByGuid = new Map(contentMessages(messages).map((m) => [m.guid, m.senderId]))
  const stats: ReactionStats = { givenByPerson: {}, receivedByPerson: {}, laughsReceivedByPerson: {}, byType: {} }

  for (const reaction of messages) {
    if (!reaction.reactionType) continue
    const target = reaction.reactsToGuid ? senderByGuid.get(reaction.reactsToGuid) : undefined
    if (target === reaction.senderId) continue // reacting to yourself doesn't count
    increment(stats.givenByPerson, reaction.senderId)
    increment(stats.byType, reaction.reactionType)

    if (!target) continue
    increment(stats.receivedByPerson, target)
    // a custom emoji tapback (even a laughing one) isn't counted as a laugh in v1
    if (reaction.reactionType === 'laugh') increment(stats.laughsReceivedByPerson, target)
  }
  return stats
}
