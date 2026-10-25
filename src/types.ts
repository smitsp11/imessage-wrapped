export type ReactionType = 'love' | 'like' | 'dislike' | 'laugh' | 'emphasize' | 'question' | 'emoji'

export type Message = {
  id: number
  guid: string
  chatId: number
  /** "me", a raw handle (phone/email) while extracting, or a short id like "p1" inside a Wrap */
  senderId: string
  sentAt: Date
  /** null for attachment-only messages and for reactions */
  text: string | null
  isFromMe: boolean
  reactsToGuid: string | null
  reactionType: ReactionType | null
  reactionEmoji: string | null
  hasAttachment: boolean
}

export type Chat = {
  id: number
  name: string
  isGroup: boolean
  memberIds: string[]
  messageCount: number
}

export type AwardId =
  | 'main-character'
  | 'ghost'
  | 'starter'
  | 'comedian'
  | 'hype'
  | 'night-owl'
  | 'double-texter'
  | 'lurker'

export type Award = {
  id: AwardId
  title: string
  personId: string
  value: number
  label: string
}
