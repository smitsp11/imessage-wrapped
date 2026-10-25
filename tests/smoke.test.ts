import { expect, it } from 'vitest'

it('runs in UTC so time-based tests are stable', () => {
  expect(new Date('2026-01-01T02:00:00Z').getHours()).toBe(2)
})
