import { ChatNotFoundError, WrappedError } from './errors'
import type { Chat } from './types'

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/
/** 7 or more digits, with up to 3 spaces, dots, dashes or brackets between them (so a date like 2025-10-25 is flagged too) */
const PHONE = /\+?\d(?:[\s().-]{0,3}\d){6,}/

/** True if a quote looks like it holds a phone number or email address. Only used to warn, so false alarms are fine. */
export function looksLikeContactInfo(text: string): boolean {
  return EMAIL.test(text) || PHONE.test(text)
}

export function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'chat'
}

/** The first year Apple timestamps can hold is 2001; a year past next year can't have messages. */
const FIRST_YEAR = 2001

/** `--year` text → a 4-digit year from 2001 to next year. No text means this year. */
export function parseYear(text: string | undefined, now: Date = new Date()): number {
  const thisYear = now.getFullYear()
  if (text === undefined) return thisYear
  const year = Number(text)
  if (!/^\d{4}$/.test(text) || year < FIRST_YEAR || year > thisYear + 1) {
    throw new WrappedError(`"${text}" isn't a year. Try --year ${thisYear}.`)
  }
  return year
}

export type Removal = { remove: Set<number> } | { error: string }

/** "1 3" or "1, 3" → indexes {0, 2}. Anything that isn't a number from 1 to `max` is an error, never ignored. */
export function numbersToRemove(answer: string, max: number): Removal {
  const remove = new Set<number>()
  for (const token of answer.split(/[\s,]+/).filter(Boolean)) {
    if (!/^\d+$/.test(token)) return { error: `"${token}" isn't a number.` }
    const n = Number(token)
    if (n < 1 || n > max) return { error: `${n} isn't in the list (1 to ${max}).` }
    remove.add(n - 1)
  }
  return { remove }
}

/** Anything but yes/y (any case) means no. */
export function isYes(answer: string): boolean {
  return /^y(es)?$/i.test(answer.trim())
}

export function findChat(chats: Chat[], query: string): Chat {
  const byId = chats.find((c) => String(c.id) === query)
  if (byId) return byId
  const wanted = query.toLowerCase()
  const exact = chats.filter((c) => c.name.toLowerCase() === wanted)
  if (exact.length === 1) return exact[0]!
  const matches = exact.length > 1 ? exact : chats.filter((c) => c.name.toLowerCase().includes(wanted))
  if (matches.length === 1) return matches[0]!
  const suggestions = (matches.length > 0 ? matches : chats).slice(0, 5).map((c) => `${c.id}  ${c.name}`)
  throw new ChatNotFoundError(query, suggestions)
}
