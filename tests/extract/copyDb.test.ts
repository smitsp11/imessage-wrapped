import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { copyDatabase } from '../../src/extract/copyDb'

let dir: string
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'copy-db-test-'))
})
afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

it('copies the file and its -wal and -shm companions into a new folder', () => {
  const source = path.join(dir, 'chat.db')
  fs.writeFileSync(source, 'main')
  fs.writeFileSync(source + '-wal', 'wal')
  fs.writeFileSync(source + '-shm', 'shm')

  const copy = copyDatabase(source)
  try {
    expect(path.dirname(copy.path)).toBe(copy.dir)
    expect(copy.dir).not.toBe(dir)
    expect(fs.readFileSync(copy.path, 'utf8')).toBe('main')
    expect(fs.readFileSync(copy.path + '-wal', 'utf8')).toBe('wal')
    expect(fs.readFileSync(copy.path + '-shm', 'utf8')).toBe('shm')
  } finally {
    fs.rmSync(copy.dir, { recursive: true, force: true })
  }
})

it('removes its temp folder when the copy fails', () => {
  const made = vi.spyOn(fs, 'mkdtempSync')
  try {
    expect(() => copyDatabase(path.join(dir, 'missing.db'))).toThrow(expect.objectContaining({ code: 'ENOENT' }))
    const tempDir = made.mock.results[0]?.value as string
    expect(tempDir).toBeTruthy()
    expect(fs.existsSync(tempDir)).toBe(false)
  } finally {
    made.mockRestore()
  }
})
