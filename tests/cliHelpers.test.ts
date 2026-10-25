import { describe, expect, it } from 'vitest'
import { ChatNotFoundError } from '../src/errors'
import { findChat, looksLikeContactInfo, numbersToRemove, slug } from '../src/cliHelpers'
import type { Chat } from '../src/types'

const chat = (id: number, name: string): Chat => ({ id, name, isGroup: true, memberIds: [], messageCount: 1 })
const chats = [chat(1, 'Pasta Gang'), chat(2, 'Pasta Club'), chat(3, 'Family')]

describe('looksLikeContactInfo', () => {
  it.each(['call me 416-555-0123', 'text +1 (416) 555 0123', 'its 4165550123', 'mail a.b@example.com'])('flags %s', (text) => {
    expect(looksLikeContactInfo(text)).toBe(true)
  })
  it.each(['pasta tonight?', 'see you at 7', 'room 204 at 5pm', 'lol @ you'])('ignores %s', (text) => {
    expect(looksLikeContactInfo(text)).toBe(false)
  })
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
    expect([...numbersToRemove('1, 3')]).toEqual([0, 2])
  })
  it('ignores blanks and junk', () => {
    expect(numbersToRemove('').size).toBe(0)
    expect(numbersToRemove('a, 0, -2, 1.5').size).toBe(0)
  })
})

describe('findChat', () => {
  it('matches an id exactly', () => expect(findChat(chats, '3').name).toBe('Family'))
  it('matches a unique name part, ignoring case', () => expect(findChat(chats, 'fam').id).toBe(3))
  it('rejects ambiguous and unknown names with suggestions', () => {
    expect(() => findChat(chats, 'pasta')).toThrow(ChatNotFoundError)
    expect(() => findChat(chats, 'zzz')).toThrow(/1  Pasta Gang/)
  })
})
