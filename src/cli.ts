import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline/promises'
import { parseArgs } from 'node:util'
import { makeFakeWrap } from '../fixtures/fakeWrap'
import { findChat, looksLikeContactInfo, numbersToRemove, slug } from './cliHelpers'
import { BrokenLinkError, NewerVersionError, WrappedError } from './errors'
import { ContactBook } from './extract/contactBook'
import { DEFAULT_CHAT_DB, MessagesDb } from './extract/messagesDb'
import { normalizeRows } from './extract/normalize'
import { maskHandle } from './format'
import { fitToLimit } from './share/pack'
import { parseWrap } from './share/parseWrap'
import type { Chat, Wrap } from './types'
import { buildWrap } from './wrap/buildWrap'

/** Where links point. Only the part after "#" carries data, and browsers never send it to the server. */
const SITE = process.env.WRAPPED_SITE ?? 'http://localhost:5173'
const OUT_DIR = 'out'
const LIST_LIMIT = 30

const USAGE = `Usage:
  npm run wrapped -- list                          your chats, busiest first
  npm run wrapped -- group <chat id or name> [--year 2026]
  npm run wrapped -- me [--year 2026]
  npm run wrapped -- share out/<file>.json
  npm run wrapped -- demo [--out file.json]        a fake group chat, no Full Disk Access needed`

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { year: { type: 'string' }, db: { type: 'string' }, out: { type: 'string' } },
  })
  const [command, arg] = positionals
  const year = values.year ? Number(values.year) : new Date().getFullYear()
  if (!Number.isInteger(year)) throw new WrappedError(`"${values.year}" isn't a year. Try --year 2026.`)
  const dbPath = values.db ?? DEFAULT_CHAT_DB

  switch (command) {
    case 'list':
      return list(dbPath)
    case 'group':
      if (!arg) throw new WrappedError(USAGE)
      return group(dbPath, arg, year)
    case 'me':
      return solo(dbPath, year)
    case 'share':
      if (!arg) throw new WrappedError(USAGE)
      return share(arg)
    case 'demo':
      return demo(values.out)
    default:
      console.log(USAGE)
  }
}

/** Opens the database copy, and makes sure the private temp copy is removed however this ends (including Ctrl-C). */
async function withDb<T>(dbPath: string, fn: (db: MessagesDb) => Promise<T> | T): Promise<T> {
  const db = MessagesDb.open(dbPath)
  const onInterrupt = () => {
    db.close()
    process.exit(130)
  }
  process.once('SIGINT', onInterrupt)
  try {
    return await fn(db)
  } finally {
    process.removeListener('SIGINT', onInterrupt)
    db.close()
  }
}

/** Contacts are optional: without them, names are masked. */
function loadContacts(): ContactBook {
  let contacts: ContactBook
  try {
    contacts = ContactBook.fromMac()
  } catch {
    console.log("Couldn't read Contacts, so names will be masked.")
    return new ContactBook([])
  }
  if (contacts.skippedSources > 0) console.log(`Skipped ${contacts.skippedSources} contact source(s) that couldn't be read.`)
  return contacts
}

async function list(dbPath: string): Promise<void> {
  await withDb(dbPath, (db) => {
    const contacts = loadContacts()
    for (const chat of loadChats(db, contacts).slice(0, LIST_LIMIT)) {
      const kind = chat.isGroup ? 'group' : 'dm   '
      console.log(`${String(chat.id).padStart(6)}  ${String(chat.messageCount).padStart(7)} msgs  ${kind}  ${chat.name}`)
    }
  })
}

async function group(dbPath: string, query: string, year: number): Promise<void> {
  await withDb(dbPath, async (db) => {
    const contacts = loadContacts()
    const chat = findChat(loadChats(db, contacts), query)
    const { from, to } = yearRange(year)
    const { messages, undecodable } = normalizeRows(db.messageRows({ chatIds: [chat.id], from, to }))
    const wrap = buildWrap(messages, { mode: 'group', title: chat.name, from, to, nameFor: nameLookup(contacts) })
    report(saveWrap(wrap, `${slug(chat.name)}-${year}.json`), undecodable)
    await preview(wrap)
  })
}

async function solo(dbPath: string, year: number): Promise<void> {
  await withDb(dbPath, async (db) => {
    const contacts = loadContacts()
    const chats = loadChats(db, contacts)
    const { from, to } = yearRange(year)
    const { messages, undecodable } = normalizeRows(db.messageRows({ from, to }))
    const wrap = buildWrap(messages, { mode: 'solo', title: `Your ${year}`, from, to, nameFor: nameLookup(contacts), chats })
    report(saveWrap(wrap, `me-${year}.json`), undecodable)
    await preview(wrap)
  })
}

/** Shows exactly what goes into the link and lets you drop quotes before making it. */
async function share(file: string): Promise<void> {
  const wrap = readWrapFile(file)
  const name = (id: string) => wrap.people[id] ?? 'Someone'
  console.log('This link will contain:\n')
  console.log(`  Title:  ${wrap.title}`)
  console.log(`  People: ${Object.values(wrap.people).join(', ')}`)
  console.log(`  Awards: ${wrap.awards.map((a) => `${a.title} → ${name(a.personId)}`).join('; ')}`)
  if (wrap.topChats.length > 0) console.log(`  Top chats: ${wrap.topChats.map((c) => c.name).join(', ')}`)
  console.log(`  Top words: ${wrap.words.topWords.map((w) => w.word).join(', ')}`)
  console.log('  Signature words:')
  const signatures = Object.entries(wrap.words.signatureWordByPerson)
  signatures.forEach(([id, word], i) => console.log(`    ${i + 1}. ${name(id)}: "${word}"`))
  console.log('  Quotes:')
  wrap.greatestHits.forEach((hit, i) => {
    console.log(`    ${i + 1}. "${hit.text}" (${name(hit.senderId)})`)
    if (looksLikeContactInfo(hit.text)) console.log('       ⚠ contains what looks like a phone number or email')
  })

  const rl = readline.createInterface({ input: process.stdin })
  // Reading lines from one iterator keeps piped input working (rl.question loses lines that arrive before it is asked).
  const lines = rl[Symbol.asyncIterator]()
  const ask = async (prompt: string): Promise<string> => {
    process.stdout.write(prompt)
    const line = await lines.next()
    if (line.done) console.log()
    return line.done ? '' : line.value
  }
  try {
    // Signature words and quotes can name people outside the chat, so each one can be removed.
    const dropSignatures = numbersToRemove(await ask('\nSignature word numbers to remove, or Enter to keep all: '))
    const dropQuotes = numbersToRemove(await ask('Quote numbers to remove (e.g. 1,3), or Enter to keep all: '))
    const reviewed: Wrap = {
      ...wrap,
      words: {
        ...wrap.words,
        signatureWordByPerson: Object.fromEntries(signatures.filter((_, i) => !dropSignatures.has(i))),
      },
      greatestHits: wrap.greatestHits.filter((_, i) => !dropQuotes.has(i)),
    }
    if ((await ask('Make the link? (y/n) ')).trim().toLowerCase() !== 'y') {
      console.log('No link made.')
      return
    }
    const { packed, dropped } = await fitToLimit(reviewed)
    if (dropped.length > 0) console.log(`Removed ${dropped.length} more quote(s) so the link isn't too long.`)
    console.log(`\n${SITE}/#${packed}\n`)
  } finally {
    rl.close()
  }
}

/** Reads a saved wrap, and gives a clear error for a missing, hand-edited or wrong file. */
function readWrapFile(file: string): Wrap {
  let text: string
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    throw new WrappedError(`Couldn't read ${file}.`)
  }
  try {
    return parseWrap(JSON.parse(text))
  } catch (err) {
    if (err instanceof NewerVersionError) throw err
    if (err instanceof SyntaxError || err instanceof BrokenLinkError) {
      throw new WrappedError(`${file} isn't a valid wrap file. Use a file that "group", "me" or "demo" saved.`)
    }
    throw err
  }
}

async function demo(out: string | undefined): Promise<void> {
  const wrap = makeFakeWrap('group')
  if (out) {
    fs.writeFileSync(out, JSON.stringify(wrap, null, 2))
    console.log(`Saved ${out}`)
    return
  }
  report(saveWrap(wrap, 'demo.json'), 0)
  await preview(wrap)
}

function loadChats(db: MessagesDb, contacts: ContactBook): Chat[] {
  return db.listChats().map((chat) => ({ ...chat, name: chatName(chat, contacts) }))
}

/** Unnamed chats are named after their members, like Messages does. */
function chatName(chat: Chat, contacts: ContactBook): string {
  if (chat.name) return chat.name
  const names = chat.memberIds.map(nameLookup(contacts))
  return names.slice(0, 3).join(', ') + (names.length > 3 ? ` +${names.length - 3}` : '')
}

function nameLookup(contacts: ContactBook): (handle: string) => string {
  return (handle) => contacts.nameFor(handle) ?? maskHandle(handle)
}

function yearRange(year: number): { from: Date; to: Date } {
  return { from: new Date(year, 0, 1), to: new Date(year + 1, 0, 1) }
}

function saveWrap(wrap: Wrap, fileName: string): string {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const file = path.join(OUT_DIR, fileName)
  fs.writeFileSync(file, JSON.stringify(wrap, null, 2))
  return file
}

function report(file: string, undecodable: number): void {
  console.log(`Saved ${file}`)
  if (undecodable > 0) console.log(`Skipped ${undecodable} message(s) that couldn't be decoded.`)
}

async function preview(wrap: Wrap): Promise<void> {
  const { packed, dropped } = await fitToLimit(wrap)
  if (dropped.length > 0) console.log(`Left ${dropped.length} quote(s) out of the preview so the link isn't too long.`)
  console.log('Opening the preview. If the page is blank, start the viewer with: npm run web:dev')
  execFile('open', [`${SITE}/#${packed}`])
}

main().catch((err: unknown) => {
  if (err instanceof WrappedError) {
    console.error(err.message)
    process.exit(1)
  }
  throw err
})
