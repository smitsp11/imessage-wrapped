import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

export type FakeContact = {
  first?: string
  last?: string
  nickname?: string
  org?: string
  phones?: string[]
  emails?: string[]
}

/** Creates a tiny AddressBook-style database with just the tables and columns we read. */
export function makeAddressBook(file: string, contacts: FakeContact[]): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const db = new Database(file)
  db.exec(`
    CREATE TABLE ZABCDRECORD (Z_PK INTEGER PRIMARY KEY, ZFIRSTNAME TEXT, ZLASTNAME TEXT, ZNICKNAME TEXT, ZORGANIZATION TEXT);
    CREATE TABLE ZABCDPHONENUMBER (Z_PK INTEGER PRIMARY KEY, ZOWNER INTEGER, ZFULLNUMBER TEXT);
    CREATE TABLE ZABCDEMAILADDRESS (Z_PK INTEGER PRIMARY KEY, ZOWNER INTEGER, ZADDRESS TEXT);`)
  const addRecord = db.prepare('INSERT INTO ZABCDRECORD (ZFIRSTNAME, ZLASTNAME, ZNICKNAME, ZORGANIZATION) VALUES (?, ?, ?, ?)')
  const addPhone = db.prepare('INSERT INTO ZABCDPHONENUMBER (ZOWNER, ZFULLNUMBER) VALUES (?, ?)')
  const addEmail = db.prepare('INSERT INTO ZABCDEMAILADDRESS (ZOWNER, ZADDRESS) VALUES (?, ?)')
  for (const c of contacts) {
    const owner = addRecord.run(c.first ?? null, c.last ?? null, c.nickname ?? null, c.org ?? null).lastInsertRowid
    for (const phone of c.phones ?? []) addPhone.run(owner, phone)
    for (const email of c.emails ?? []) addEmail.run(owner, email)
  }
  db.close()
}
