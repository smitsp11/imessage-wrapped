import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { ContactBook, type ContactEntry, normalizeHandle } from '../../src/extract/contactBook'
import { makeAddressBook } from '../../fixtures/makeAddressBook'

const entry = (over: Partial<ContactEntry> & { handle: string }): ContactEntry => ({
  first: null,
  last: null,
  nickname: null,
  org: null,
  ...over,
})

describe('normalizeHandle', () => {
  it('keeps the last 10 digits of a phone number', () => {
    expect(normalizeHandle('+1 (416) 555-0101')).toBe('4165550101')
    expect(normalizeHandle('416-555-0101')).toBe('4165550101')
  })
  it('lowercases emails', () => expect(normalizeHandle(' Jordan@Example.com ')).toBe('jordan@example.com'))
  it('ignores a phone extension', () => {
    expect(normalizeHandle('416-555-0101 ext. 23')).toBe('4165550101')
    expect(normalizeHandle('416-555-0101,,23')).toBe('4165550101')
  })
  it('leaves emails containing x or ext alone', () => {
    expect(normalizeHandle('Maxext@Example.com')).toBe('maxext@example.com')
  })
})

describe('ContactBook', () => {
  const book = new ContactBook([
    { first: 'Alex', last: 'Chen', nickname: null, org: null, handle: '+1 (416) 555-0101' },
    { first: null, last: null, nickname: null, org: 'Pizza Place', handle: '416-555-0199' },
    { first: 'Jordan', last: 'Lee', nickname: null, org: null, handle: 'Jordan@Example.com' },
    { first: 'Junk', last: 'Entry', nickname: null, org: null, handle: 'N/A' },
  ])

  it('finds names whatever format the handle uses', () => {
    expect(book.nameFor('+14165550101')).toBe('Alex Chen')
    expect(book.nameFor('4165550199')).toBe('Pizza Place')
    expect(book.nameFor('jordan@example.com')).toBe('Jordan Lee')
  })
  it('returns null for unknown handles', () => expect(book.nameFor('+19995550000')).toBeNull())
  it('never matches a handle that has no usable key', () => {
    expect(book.nameFor('me')).toBeNull()
    expect(book.nameFor('urn:biz:abc')).toBeNull()
    expect(book.size).toBe(3)
  })
  it('keeps the first entry for a shared handle', () => {
    const shared = new ContactBook([
      entry({ first: 'First', handle: '416-555-0101' }),
      entry({ first: 'Second', handle: '+14165550101' }),
    ])
    expect(shared.nameFor('4165550101')).toBe('First')
  })
  it('picks a display name', () => {
    const names = new ContactBook([
      entry({ nickname: 'Nicky', handle: '4165550001' }),
      entry({ first: 'Solo', handle: '4165550002' }),
      entry({ nickname: '   ', org: 'Acme', handle: '4165550003' }),
      entry({ nickname: '  ', handle: '4165550004' }),
    ])
    expect(names.nameFor('4165550001')).toBe('Nicky')
    expect(names.nameFor('4165550002')).toBe('Solo')
    expect(names.nameFor('4165550003')).toBe('Acme')
    expect(names.nameFor('4165550004')).toBeNull()
  })
})

describe('ContactBook.fromMac', () => {
  const homes: string[] = []
  const freshHome = () => {
    const h = fs.mkdtempSync(path.join(os.tmpdir(), 'contacts-test-'))
    homes.push(h)
    return h
  }
  afterAll(() => {
    for (const h of homes) fs.rmSync(h, { recursive: true, force: true })
  })
  const abDir = (home: string) => path.join(home, 'Library', 'Application Support', 'AddressBook')

  it('reads the root database and sources, skips a corrupt source, and leaves no temp copies', () => {
    const home = freshHome()
    const root = abDir(home)
    makeAddressBook(path.join(root, 'AddressBook-v22.abcddb'), [
      { first: 'Alex', last: 'Chen', phones: ['+1 (416) 555-0101'] },
      { first: 'Root', last: 'Wins', phones: ['416-555-0300'] },
    ])
    makeAddressBook(path.join(root, 'Sources', 'A', 'AddressBook-v22.abcddb'), [
      { first: 'Jordan', last: 'Lee', emails: ['Jordan@Example.com'] },
      { first: 'Source', last: 'Loses', phones: ['4165550300'] },
    ])
    fs.mkdirSync(path.join(root, 'Sources', 'B'), { recursive: true })
    fs.mkdirSync(path.join(root, 'Sources', 'C'), { recursive: true })
    fs.writeFileSync(path.join(root, 'Sources', 'C', 'AddressBook-v22.abcddb'), 'junk bytes, not sqlite')

    const spy = vi.spyOn(fs, 'mkdtempSync')
    let book: ContactBook
    let copies: string[]
    try {
      book = ContactBook.fromMac(home)
      copies = spy.mock.results.map((r) => String(r.value)).filter((p) => path.basename(p).startsWith('wrapped-'))
    } finally {
      spy.mockRestore()
    }
    expect(book.nameFor('+14165550101')).toBe('Alex Chen')
    expect(book.nameFor('jordan@example.com')).toBe('Jordan Lee')
    expect(book.nameFor('+14165550300')).toBe('Root Wins')
    expect(book.skippedSources).toBe(1)
    expect(copies).toHaveLength(3)
    for (const c of copies) expect(fs.existsSync(c)).toBe(false)
  })

  it('returns an empty book when there is no AddressBook', () => {
    const book = ContactBook.fromMac(freshHome())
    expect(book.size).toBe(0)
    expect(book.skippedSources).toBe(0)
  })

  it('rethrows when every existing source is unreadable', () => {
    const home = freshHome()
    const file = path.join(abDir(home), 'AddressBook-v22.abcddb')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, 'junk bytes, not sqlite')
    expect(() => ContactBook.fromMac(home)).toThrow()
  })
})
