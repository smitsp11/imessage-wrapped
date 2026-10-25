import type { Hit } from './stats/greatestHits'
import type { ReactionStats } from './stats/reactions'
import type { ReplyStats } from './stats/replies'
import type { StarterStats } from './stats/starters'
import type { TimingStats } from './stats/timing'
import type { VolumeStats } from './stats/volume'
import type { WordStats } from './stats/words'

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
  /** handles of the other members (never includes "me") */
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
  /** the number behind the award; its unit depends on the award (percent, minutes or a count). `label` is the display text. */
  value: number
  label: string
}

export type Wrap = {
  version: 1
  mode: 'group' | 'solo'
  title: string
  /** local calendar dates, YYYY-MM-DD */
  period: { from: string; to: string }
  /** short id → display name */
  people: Record<string, string>
  volume: VolumeStats
  timing: TimingStats
  replies: ReplyStats
  starters: StarterStats
  reactions: ReactionStats
  words: WordStats
  greatestHits: Hit[]
  awards: Award[]
  topChats: { name: string; messages: number }[]
}
