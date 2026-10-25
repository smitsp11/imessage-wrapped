import { describe, expect, it } from 'vitest'
import { ChatNotFoundError, WrappedError } from '../src/errors'
import { findChat, isYes, looksLikeContactInfo, numbersToRemove, parseYear, slug } from '../src/cliHelpers'
import type { Chat } from '../src/types'

const chat = (id: number, name: string): Chat => ({ id, name, isGroup: true, memberIds: [], messageCount: 1 })
const chats = [chat(1, 'Pasta Gang'), chat(2, 'Pasta Club'), chat(3, 'Family')]

describe('looksLikeContactInfo', () => {
  it.each(['call me 416-555-0123', 'text +1 (416) 555 0123', 'its 4165550123', 'mail a.b@example.com', '416 - 555 - 0199', '416  555  0199'])('flags %s', (text) => {
    expect(looksLikeContactInfo(text)).toBe(true)
  })
  it.each(['pasta tonight?', 'see you at 7', 'room 204 at 5pm', 'lol @ you'])('ignores %s', (text) => {
    expect(looksLikeContactInfo(text)).toBe(false)
  })
})

it('flags a date, which is an accepted false alarm', () => {
  expect(looksLikeContactInfo('see you 2025-10-25')).toBe(true)
})

describe('slug', () => {
  it('makes a safe file name', () => {
    expect(slug('Pasta Gang 🍝!')).toBe('pasta-gang')
    expect(slug('../../etc')).toBe('etc')
  })
  it('falls back when nothing is left', () => {
    expect(slug('🍝')).toBe('chat')
  })
})

describe('numbersToRemove', () => {
  it('turns 1-based answers into 0-based indexes', () => {
    expect(numbersToRemove('1 3', 3)).toEqual({ remove: new Set([0, 2]) })
    expect(numbersToRemove('1, 3', 3)).toEqual({ remove: new Set([0, 2]) })
  })
  it('treats an empty answer as nothing to remove', () => {
    expect(numbersToRemove('', 3)).toEqual({ remove: new Set() })
    expect(numbersToRemove('  ', 3)).toEqual({ remove: new Set() })
  })
  it('rejects out-of-range numbers and unknown words', () => {
    expect(numbersToRemove('9', 3)).toHaveProperty('error')
    expect(numbersToRemove('0', 3)).toHaveProperty('error')
    expect(numbersToRemove('abc', 3)).toHaveProperty('error')
    expect(numbersToRemove('1, x', 3)).toHaveProperty('error')
    expect(numbersToRemove('1.5', 3)).toHaveProperty('error')
  })
})

describe('parseYear', () => {
  const now = new Date(2026, 9, 25)
  it('defaults to this year', () => expect(parseYear(undefined, now)).toBe(2026))
  it('accepts 2001 through next year', () => {
    expect(parseYear('2001', now)).toBe(2001)
    expect(parseYear('2027', now)).toBe(2027)
  })
  it.each(['99', '2000', '2028', '20266', 'abc', '', '2026.5', '+2026'])('rejects %j', (text) => {
    expect(() => parseYear(text, now)).toThrow(WrappedError)
  })
})

describe('isYes', () => {
  it.each(['y', 'Y', 'yes', ' YES '])('accepts %j', (a) => expect(isYes(a)).toBe(true))
  it.each(['', 'n', 'yep', 'yes please'])('rejects %j', (a) => expect(isYes(a)).toBe(false))
})

describe('findChat', () => {
  it('matches an id exactly', () => expect(findChat(chats, '3').name).toBe('Family'))
  it('prefers an exact name over a longer one that contains it', () => {
    expect(findChat([chat(1, 'Pasta'), chat(2, 'Pasta Gang')], 'pasta').id).toBe(1)
  })
  it('matches a unique name part, ignoring case', () => expect(findChat(chats, 'fam').id).toBe(3))
  it('rejects ambiguous and unknown names with suggestions', () => {
    expect(() => findChat(chats, 'pasta')).toThrow(ChatNotFoundError)
    expect(() => findChat(chats, 'zzz')).toThrow(/1  Pasta Gang/)
  })
})
