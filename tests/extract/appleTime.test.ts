import { expect, it } from 'vitest'
import { APPLE_EPOCH_MS, appleMsToDate, toAppleNs } from '../../src/extract/appleTime'

it('uses 2001-01-01 as the epoch', () => {
  expect(APPLE_EPOCH_MS).toBe(978_307_200_000)
})

it('round-trips a date through Apple nanoseconds', () => {
  const date = new Date('2026-01-05T20:00:00Z')
  const ms = Number(toAppleNs(date) / 1_000_000n)
  expect(appleMsToDate(ms)).toEqual(date)
})
