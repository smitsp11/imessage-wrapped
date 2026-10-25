import { describe, expect, it } from 'vitest'
import { ContactBook, normalizeHandle } from '../../src/extract/contactBook'

describe('normalizeHandle', () => {
  it('keeps the last 10 digits of a phone number', () => {
    expect(normalizeHandle('+1 (416) 555-0101')).toBe('4165550101')
    expect(normalizeHandle('416-555-0101')).toBe('4165550101')
  })
  it('lowercases emails', () => expect(normalizeHandle(' Jordan@Example.com ')).toBe('jordan@example.com'))
})

describe('ContactBook', () => {
  const book = new ContactBook([
    { first: 'Alex', last: 'Chen', nickname: null, org: null, value: '+1 (416) 555-0101' },
    { first: null, last: null, nickname: null, org: 'Pizza Place', value: '416-555-0199' },
    { first: 'Jordan', last: 'Lee', nickname: null, org: null, value: 'Jordan@Example.com' },
  ])

  it('finds names whatever format the handle uses', () => {
    expect(book.nameFor('+14165550101')).toBe('Alex Chen')
    expect(book.nameFor('4165550199')).toBe('Pizza Place')
    expect(book.nameFor('jordan@example.com')).toBe('Jordan Lee')
  })
  it('returns null for unknown handles', () => expect(book.nameFor('+19995550000')).toBeNull())
})
