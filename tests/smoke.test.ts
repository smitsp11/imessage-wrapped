import { expect, it } from 'vitest'

it('runs in UTC so time-based tests are stable', () => {
  expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('UTC')
})
