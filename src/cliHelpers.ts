import { ChatNotFoundError } from './errors'
import type { Chat } from './types'

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/
/** 7 or more digits, allowing spaces, dots, dashes and brackets between them */
const PHONE = /\+?\d(?:[\s().-]?\d){6,}/

/** True if a quote looks like it holds a phone number or email address. Only used to warn, so false alarms are fine. */
export function looksLikeContactInfo(text: string): boolean {
  return EMAIL.test(text) || PHONE.test(text)
}

export function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'chat'
}

/** "1, 3" → {0, 2} */
export function numbersToRemove(answer: string): Set<number> {
  return new Set(answer.split(',').map((s) => Number(s.trim()) - 1).filter((n) => Number.isInteger(n) && n >= 0))
}

export function findChat(chats: Chat[], query: string): Chat {
  const byId = chats.find((c) => String(c.id) === query)
  if (byId) return byId
  const matches = chats.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
  if (matches.length === 1) return matches[0]!
  const suggestions = (matches.length > 0 ? matches : chats).slice(0, 5).map((c) => `${c.id}  ${c.name}`)
  throw new ChatNotFoundError(query, suggestions)
}
