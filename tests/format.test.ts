import { describe, expect, it } from 'vitest'
import { formatMinutes, maskHandle, percent } from '../src/format'

describe('formatMinutes', () => {
  it('shows minutes under an hour', () => expect(formatMinutes(4)).toBe('4 min'))
  it('shows hours and minutes', () => expect(formatMinutes(300)).toBe('5h 0m'))
  it('shows days and hours past a day', () => expect(formatMinutes(1500)).toBe('1d 1h'))
})

describe('percent', () => {
  it('turns a fraction into a percent with one decimal', () => expect(percent(90 / 302)).toBe(29.8))
})

describe('maskHandle', () => {
  it('keeps only the last 4 digits of a phone number', () => expect(maskHandle('+14165550101')).toBe('+1 ••• ••• 0101'))
  it('hides most of an email', () => expect(maskHandle('jordan@example.com')).toBe('j•••@example.com'))
})
