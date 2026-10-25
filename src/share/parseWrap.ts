import { BrokenLinkError, NewerVersionError } from '../errors'
import { AWARD_IDS, REACTION_TYPES } from '../types'
import type { Wrap } from '../types'

const PERSON_ID = /^(me|others|p\d+)$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

function fail(): never {
  throw new BrokenLinkError()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isPersonId(value: unknown): value is string {
  return isString(value) && PERSON_ID.test(value)
}

function isOneOf(options: readonly string[]) {
  return (value: unknown) => isString(value) && options.includes(value)
}

function matches(pattern: RegExp) {
  return (value: unknown) => isString(value) && pattern.test(value)
}

function check(ok: boolean): void {
  if (!ok) fail()
}

/** A plain object whose own keys all pass `keyOk` and whose values all pass `valueOk`. */
function checkRecord(value: unknown, keyOk: (key: string) => boolean, valueOk: (v: unknown) => boolean): void {
  check(isRecord(value))
  const record = value as Record<string, unknown>
  for (const key of Object.keys(record)) check(keyOk(key) && Object.hasOwn(record, key) && valueOk(record[key]))
}

function checkPersonRecord(value: unknown, valueOk: (v: unknown) => boolean = isFiniteNumber): void {
  checkRecord(value, (key) => PERSON_ID.test(key), valueOk)
}

function checkNumbers(value: unknown, length: number): void {
  check(Array.isArray(value) && value.length === length && value.every(isFiniteNumber))
}

/** Each item must be an object whose listed fields pass their checks. */
function checkList(value: unknown, fields: Record<string, (v: unknown) => boolean>): void {
  check(Array.isArray(value))
  for (const item of value as unknown[]) {
    check(isRecord(item))
    for (const [name, ok] of Object.entries(fields)) check(ok((item as Record<string, unknown>)[name]))
  }
}

/** Checks every field the slides read. Throws BrokenLinkError (or NewerVersionError) instead of returning bad data. */
export function parseWrap(value: unknown): Wrap {
  if (!isRecord(value)) return fail()
  if (typeof value.version === 'number' && value.version > 1) throw new NewerVersionError()
  check(value.version === 1)
  check(value.mode === 'group' || value.mode === 'solo')
  check(isString(value.title))

  check(isRecord(value.period))
  const period = value.period as Record<string, unknown>
  check(matches(DATE)(period.from) && matches(DATE)(period.to))

  checkPersonRecord(value.people, isString)

  const { volume, timing, replies, starters, reactions, words } = value
  check(isRecord(volume) && isFiniteNumber(volume.total))
  checkPersonRecord((volume as Record<string, unknown>).byPerson)
  checkPersonRecord((volume as Record<string, unknown>).attachmentsByPerson)

  check(isRecord(timing))
  const t = timing as Record<string, unknown>
  checkNumbers(t.byMonth, 12)
  checkNumbers(t.byWeekday, 7)
  checkNumbers(t.byHour, 24)
  check(isFiniteNumber(t.longestStreakDays) && isFiniteNumber(t.longestSilenceDays))
  checkPersonRecord(t.lateNightShareByPerson)

  check(isRecord(replies))
  checkPersonRecord((replies as Record<string, unknown>).medianReplyMinutesByPerson)
  checkPersonRecord((replies as Record<string, unknown>).repliesByPerson)

  check(isRecord(starters))
  checkPersonRecord((starters as Record<string, unknown>).startsByPerson)
  checkPersonRecord((starters as Record<string, unknown>).doubleTextsByPerson)

  check(isRecord(reactions))
  const r = reactions as Record<string, unknown>
  checkPersonRecord(r.givenByPerson)
  checkPersonRecord(r.receivedByPerson)
  checkPersonRecord(r.laughsReceivedByPerson)
  checkRecord(r.byType, (key) => (REACTION_TYPES as readonly string[]).includes(key), isFiniteNumber)

  check(isRecord(words))
  const w = words as Record<string, unknown>
  checkList(w.topWords, { word: isString, count: isFiniteNumber })
  checkList(w.topEmoji, { emoji: isString, count: isFiniteNumber })
  checkPersonRecord(w.signatureWordByPerson, isString)
  if (w.longestMessage !== null) {
    check(isRecord(w.longestMessage))
    const longest = w.longestMessage as Record<string, unknown>
    check(isPersonId(longest.senderId) && isFiniteNumber(longest.length))
  }

  checkList(value.greatestHits, {
    senderId: isPersonId,
    text: isString,
    sentAt: isString,
    reactions: isFiniteNumber,
    laughs: isFiniteNumber,
  })
  checkList(value.awards, {
    id: isOneOf(AWARD_IDS),
    title: isString,
    personId: isPersonId,
    value: isFiniteNumber,
    label: isString,
  })
  checkList(value.topChats, { name: isString, messages: isFiniteNumber })

  return value as Wrap
}
