import { describe, expect, it } from 'vitest'
import { formatMinutes, maskHandle, percent } from '../src/format'

describe('formatMinutes', () => {
  it('shows minutes under an hour', () => expect(formatMinutes(4)).toBe('4 min'))
  it('shows hours and minutes', () => expect(formatMinutes(300)).toBe('5h 0m'))
  it('shows days and hours past a day', () => expect(formatMinutes(1500)).toBe('1d 1h'))
  it('rounds down before choosing units', () => expect(formatMinutes(59.4)).toBe('59 min'))
  it('rounds up into the hour unit', () => expect(formatMinutes(59.6)).toBe('1h 0m'))
  it('shows exactly one day', () => expect(formatMinutes(1440)).toBe('1d 0h'))
})

describe('percent', () => {
  it('turns a fraction into a percent with one decimal', () => expect(percent(90 / 302)).toBe(29.8))
  it('handles 0', () => expect(percent(0)).toBe(0))
  it('handles 1', () => expect(percent(1)).toBe(100))
})

describe('maskHandle', () => {
  it('keeps only the last 4 digits of a phone number', () => expect(maskHandle('+14165550101')).toBe('+1 ••• ••• 0101'))
  it('hides most of an email', () => expect(maskHandle('jordan@example.com')).toBe('j•••@example.com'))
  it('ignores phone formatting', () => expect(maskHandle('+1 (416) 555-0101')).toBe('+1 ••• ••• 0101'))
  it('omits the +1 prefix for other countries', () => expect(maskHandle('+447700900123')).toBe('••• ••• 0123'))
  it('fully hides handles with fewer than 4 digits', () => expect(maskHandle('12')).toBe('•••'))
  it('splits emails on the last @', () => expect(maskHandle('a@b@c.com')).toBe('a•••@c.com'))
})
