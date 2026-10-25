import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { copyDatabase } from './copyDb'

export type ContactEntry = {
  first: string | null
  last: string | null
  nickname: string | null
  org: string | null
  /** a phone number or email address */
  value: string
}

const CONTACTS_SQL = `
  SELECT r.ZFIRSTNAME AS first, r.ZLASTNAME AS last, r.ZNICKNAME AS nickname, r.ZORGANIZATION AS org,
    p.ZFULLNUMBER AS value
  FROM ZABCDPHONENUMBER p JOIN ZABCDRECORD r ON r.Z_PK = p.ZOWNER
  WHERE p.ZFULLNUMBER IS NOT NULL
  UNION ALL
  SELECT r.ZFIRSTNAME, r.ZLASTNAME, r.ZNICKNAME, r.ZORGANIZATION, e.ZADDRESS
  FROM ZABCDEMAILADDRESS e JOIN ZABCDRECORD r ON r.Z_PK = e.ZOWNER
  WHERE e.ZADDRESS IS NOT NULL`

/** Phones → last 10 digits (so +1 and formatting don't matter); emails → lowercase. */
export function normalizeHandle(id: string): string {
  if (id.includes('@')) return id.trim().toLowerCase()
  const digits = id.replace(/\D/g, '')
  return digits.length > 10 ? digits.slice(-10) : digits
}

function displayName(entry: ContactEntry): string | null {
  const full = [entry.first, entry.last].filter(Boolean).join(' ').trim()
  return full || entry.nickname || entry.org || null
}

/** Maps Messages handles to names from the macOS Contacts databases. */
export class ContactBook {
  private readonly names = new Map<string, string>()

  constructor(entries: ContactEntry[]) {
    for (const entry of entries) {
      const name = displayName(entry)
      if (name) this.names.set(normalizeHandle(entry.value), name)
    }
  }

  /** Reads the local Contacts database and every synced source (iCloud, Google…). */
  static fromMac(home: string = os.homedir()): ContactBook {
    const root = path.join(home, 'Library', 'Application Support', 'AddressBook')
    const sourcesDir = path.join(root, 'Sources')
    const sources = fs.existsSync(sourcesDir)
      ? fs.readdirSync(sourcesDir).map((dir) => path.join(sourcesDir, dir, 'AddressBook-v22.abcddb'))
      : []
    const files = [path.join(root, 'AddressBook-v22.abcddb'), ...sources].filter((file) => fs.existsSync(file))
    return new ContactBook(files.flatMap(readContacts))
  }

  nameFor(handleId: string): string | null {
    return this.names.get(normalizeHandle(handleId)) ?? null
  }

  get size(): number {
    return this.names.size
  }
}

function readContacts(file: string): ContactEntry[] {
  const copy = copyDatabase(file)
  let db: Database.Database | undefined
  try {
    db = new Database(copy.path, { readonly: true })
    return db.prepare(CONTACTS_SQL).all() as ContactEntry[]
  } finally {
    db?.close()
    fs.rmSync(copy.dir, { recursive: true, force: true })
  }
}
