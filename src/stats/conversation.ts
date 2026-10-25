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
