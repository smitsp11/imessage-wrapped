import type { Message } from '../types'

export const MINUTE = 60_000
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

/** Real messages only (no reactions). */
export function contentMessages(messages: Message[]): Message[] {
  return messages.filter((m) => m.reactionType === null)
}

/** Content messages split per chat, each sorted by time, so a reply never crosses chats. */
export function threads(messages: Message[]): Message[][] {
  const byChat = new Map<number, Message[]>()
  for (const m of contentMessages(messages)) {
    const list = byChat.get(m.chatId) ?? []
    list.push(m)
    byChat.set(m.chatId, list)
  }
  return [...byChat.values()].map((list) => list.sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime()))
}

/** Counts a key in a Map. */
export function bump(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1)
}

/** Sort comparator: highest count first, ties broken by key so the order is deterministic. */
export function byCountThenKey(counts: Map<string, number> | Record<string, number>) {
  const count = (key: string) => (counts instanceof Map ? counts.get(key) : counts[key]) ?? 0
  return (a: string, b: string) => count(b) - count(a) || (a < b ? -1 : a > b ? 1 : 0)
}

export function increment(counts: Record<string, number>, key: string, by = 1): void {
  counts[key] = (counts[key] ?? 0) + by
}

/** values must be non-empty */
export function median(values: number[]): number {
  if (values.length === 0) throw new Error('median of an empty list')
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}
