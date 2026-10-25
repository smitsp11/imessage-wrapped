import { expect, it } from 'vitest'
import { decodeAttributedBody } from '../../src/extract/decodeBody'
import { makeAttributedBody } from '../../fixtures/attributedBody'

it('decodes short text', () => {
  expect(decodeAttributedBody(makeAttributedBody('sorry sorry just woke up'))).toBe('sorry sorry just woke up')
})

it('decodes text longer than 127 bytes (two-byte length)', () => {
  const long = 'a'.repeat(300)
  expect(decodeAttributedBody(makeAttributedBody(long))).toBe(long)
})

it('decodes emoji', () => {
  expect(decodeAttributedBody(makeAttributedBody('bet 🍝'))).toBe('bet 🍝')
})

it('returns null for null or garbage', () => {
  expect(decodeAttributedBody(null)).toBeNull()
  expect(decodeAttributedBody(new Uint8Array([1, 2, 3]))).toBeNull()
})
