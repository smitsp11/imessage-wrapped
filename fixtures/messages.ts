import type { Message, ReactionType } from '../src/types'

let nextId = 1

export function msg(partial: Partial<Omit<Message, 'sentAt'>> & { senderId: string; sentAt: string }): Message {
  const id = nextId++
  return {
    id,
    guid: `guid-${id}`,
    chatId: 1,
    text: 'hello',
    isFromMe: partial.senderId === 'me',
    reactsToGuid: null,
    reactionType: null,
    reactionEmoji: null,
    hasAttachment: false,
    ...partial,
    sentAt: new Date(partial.sentAt),
  }
}

export function react(senderId: string, target: Message, reactionType: ReactionType, sentAt: string): Message {
  return msg({ senderId, sentAt, text: null, chatId: target.chatId, reactsToGuid: target.guid, reactionType })
}
