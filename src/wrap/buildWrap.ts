import { pickAwards } from '../awards/rules'
import { EmptyPeriodError } from '../errors'
import { contentMessages, increment } from '../stats/conversation'
import { greatestHits } from '../stats/greatestHits'
import { reactionStats } from '../stats/reactions'
import { replyStats } from '../stats/replies'
import { starterStats } from '../stats/starters'
import { timingStats } from '../stats/timing'
import { volumeStats } from '../stats/volume'
import { wordStats } from '../stats/words'
import type { Chat, Message, Wrap } from '../types'

export type BuildOptions = {
  mode: 'group' | 'solo'
  title: string
  from: Date
  to: Date
  /** display name for a raw handle (only called for handles, never for "me") */
  nameFor: (handle: string) => string
  /** solo mode: chats with display names, for the top-chats slide */
  chats?: Chat[]
}

const TOP_CHATS = 5

export function buildWrap(all: Message[], options: BuildOptions): Wrap {
  const inPeriod = all.filter((m) => m.sentAt >= options.from && m.sentAt < options.to)
  if (contentMessages(inPeriod).length === 0) throw new EmptyPeriodError(options.title)

  // Phone numbers and emails never leave this function: people become "me", "p1", "p2"…
  const ids = assignPersonIds(inPeriod)
  const messages = inPeriod.map((m) => ({ ...m, senderId: ids.get(m.senderId)! }))
  const people: Record<string, string> = {}
  for (const [handle, id] of ids) people[id] = handle === 'me' ? 'You' : options.nameFor(handle)

  const volume = volumeStats(messages)
  const timing = timingStats(messages)
  const replies = replyStats(messages)
  const starters = starterStats(messages)
  const reactions = reactionStats(messages)

  return {
    version: 1,
    mode: options.mode,
    title: options.title,
    period: { from: options.from.toISOString(), to: options.to.toISOString() },
    people,
    volume,
    timing,
    replies,
    starters,
    reactions,
    // Solo mode shows your own vocabulary, not words from everyone you texted.
    words: wordStats(options.mode === 'solo' ? messages.filter((m) => m.senderId === 'me') : messages),
    greatestHits: greatestHits(messages),
    awards: pickAwards({ volume, timing, replies, starters, reactions }, options.mode),
    topChats: options.mode === 'solo' ? topChats(messages, options.chats ?? []) : [],
  }
}

/** "me" stays "me"; everyone else gets p1, p2… ordered by how much they wrote. */
function assignPersonIds(messages: Message[]): Map<string, string> {
  const counts: Record<string, number> = {}
  for (const m of messages) increment(counts, m.senderId, m.reactionType === null ? 1 : 0)
  const others = Object.keys(counts)
    .filter((handle) => handle !== 'me')
    .sort((a, b) => counts[b]! - counts[a]! || a.localeCompare(b))
  const ids = new Map(others.map((handle, i) => [handle, `p${i + 1}`]))
  if ('me' in counts) ids.set('me', 'me')
  return ids
}

function topChats(messages: Message[], chats: Chat[]): Wrap['topChats'] {
  const counts = new Map<number, number>()
  for (const m of contentMessages(messages)) counts.set(m.chatId, (counts.get(m.chatId) ?? 0) + 1)
  return [...counts]
    .sort(([, a], [, b]) => b - a)
    .slice(0, TOP_CHATS)
    .map(([chatId, count]) => ({ name: chats.find((c) => c.id === chatId)?.name ?? 'A chat', messages: count }))
}
