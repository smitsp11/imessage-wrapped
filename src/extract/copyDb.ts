import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * Copies a SQLite file and its -wal/-shm companions into a new temp folder,
 * so we never read (or lock) the live file. On APFS the copy is an instant clone.
 */
export function copyDatabase(sourcePath: string): { path: string; dir: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wrapped-'))
  const target = path.join(dir, path.basename(sourcePath))
  try {
    fs.copyFileSync(sourcePath, target, fs.constants.COPYFILE_FICLONE)
    for (const suffix of ['-wal', '-shm']) {
      if (fs.existsSync(sourcePath + suffix)) {
        fs.copyFileSync(sourcePath + suffix, target + suffix, fs.constants.COPYFILE_FICLONE)
      }
    }
  } catch (err) {
    fs.rmSync(dir, { recursive: true, force: true })
    throw err
  }
  return { path: target, dir }
}
