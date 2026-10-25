import { pickAwards } from '../awards/rules'
import { EmptyPeriodError } from '../errors'
import { maskHandle } from '../format'
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
const SOLO_TOP_PEOPLE = 5
const OTHERS_ID = 'others'
/** stands in for "everyone outside your top contacts" until ids are assigned; cannot collide with a real handle */
const OTHERS_HANDLE = '\0others'

export function buildWrap(all: Message[], options: BuildOptions): Wrap {
  const inPeriod = all.filter((m) => m.sentAt >= options.from && m.sentAt < options.to)
  if (contentMessages(inPeriod).length === 0) throw new EmptyPeriodError(options.title)

  // A name that is just the handle (no contact found) is masked, so no phone number or email leaves this function.
  const display = (handle: string) => {
    const name = options.nameFor(handle)
    return name === handle ? maskHandle(handle) : name
  }

  // Phone numbers and emails never leave this function: people become "me", "p1", "p2"…
  // Solo wraps keep only your top contacts; everyone else is one person.
  const solo = options.mode === 'solo'
  const kept = solo ? topContacts(inPeriod) : null
  const grouped = kept ? inPeriod.map((m) => (m.senderId === 'me' || kept.has(m.senderId) ? m : { ...m, senderId: OTHERS_HANDLE })) : inPeriod
  const ids = assignPersonIds(grouped)
  const messages = grouped.map((m) => ({ ...m, senderId: ids.get(m.senderId)! }))
  const people: Record<string, string> = {}
  for (const [handle, id] of ids) people[id] = handle === 'me' ? 'You' : handle === OTHERS_HANDLE ? 'Everyone else' : display(handle)

  const volume = volumeStats(messages)
  const timing = timingStats(messages)
  const replies = replyStats(messages)
  const starters = starterStats(messages)
  const reactions = reactionStats(messages)

  // Solo: hits are your own messages, but everyone's reactions count, so rank over all messages with one id per person.
  const hits = solo
    ? greatestHits(relabel(inPeriod, assignPersonIds(inPeriod))).filter((h) => h.senderId === 'me')
    : greatestHits(messages)
  // If "Everyone else" was the unique winner of an award, the award is simply dropped.
  const awards = pickAwards({ volume, timing, replies, starters, reactions }, options.mode).filter((a) => a.personId !== OTHERS_ID)

  return {
    version: 1,
    mode: options.mode,
    title: options.title,
    period: { from: localDate(options.from), to: localDate(options.to) },
    people,
    volume,
    timing,
    replies,
    starters,
    reactions,
    // Solo mode shows your own vocabulary, not words from everyone you texted.
    words: wordStats(solo ? messages.filter((m) => m.senderId === 'me') : messages),
    greatestHits: hits,
    awards,
    topChats: solo ? topChats(messages, options.chats ?? []) : [],
  }
}

function relabel(messages: Message[], ids: Map<string, string>): Message[] {
  return messages.map((m) => ({ ...m, senderId: ids.get(m.senderId)! }))
}

/** 'YYYY-MM-DD' in the local timezone. */
function localDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function byCountThenKey(counts: Record<string, number>) {
  return (a: string, b: string) => counts[b]! - counts[a]! || (a < b ? -1 : a > b ? 1 : 0)
}

function countBySender(messages: Message[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const m of messages) increment(counts, m.senderId, m.reactionType === null ? 1 : 0)
  return counts
}

/** Solo mode: the handles of your SOLO_TOP_PEOPLE busiest contacts. */
function topContacts(messages: Message[]): Set<string> {
  const counts = countBySender(messages)
  return new Set(
    Object.keys(counts)
      .filter((handle) => handle !== 'me')
      .sort(byCountThenKey(counts))
      .slice(0, SOLO_TOP_PEOPLE),
  )
}

/** "me" stays "me"; everyone else gets p1, p2… ordered by how much they wrote (the solo "others" bucket keeps its own id). */
function assignPersonIds(messages: Message[]): Map<string, string> {
  const counts = countBySender(messages)
  const others = Object.keys(counts)
    .filter((handle) => handle !== 'me' && handle !== OTHERS_HANDLE)
    .sort(byCountThenKey(counts))
  const ids = new Map(others.map((handle, i) => [handle, `p${i + 1}`]))
  if ('me' in counts) ids.set('me', 'me')
  if (OTHERS_HANDLE in counts) ids.set(OTHERS_HANDLE, OTHERS_ID)
  return ids
}

function topChats(messages: Message[], chats: Chat[]): Wrap['topChats'] {
  const counts = new Map<number, number>()
  for (const m of contentMessages(messages)) counts.set(m.chatId, (counts.get(m.chatId) ?? 0) + 1)
  return [...counts]
    .sort(([idA, a], [idB, b]) => b - a || idA - idB)
    .slice(0, TOP_CHATS)
    .map(([chatId, count]) => ({ name: chats.find((c) => c.id === chatId)?.name || 'A chat', messages: count }))
}
