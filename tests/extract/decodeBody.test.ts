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

it.each([127, 128, 70_000])('decodes %i-byte text', (n) => {
  const text = 'a'.repeat(n)
  expect(decodeAttributedBody(makeAttributedBody(text))).toBe(text)
})

it('returns null for a truncated blob', () => {
  const blob = makeAttributedBody('hello world')
  expect(decodeAttributedBody(blob.subarray(0, blob.length - 7))).toBeNull()
})

it('returns null for an unknown length tag', () => {
  const blob = makeAttributedBody('hi')
  blob[blob.indexOf('NSString') + 13] = 0x83
  expect(decodeAttributedBody(blob)).toBeNull()
})

it('returns null for empty text and for invalid UTF-8', () => {
  expect(decodeAttributedBody(makeAttributedBody(''))).toBeNull()
  const blob = makeAttributedBody('ab')
  blob[blob.indexOf('NSString') + 14] = 0xc3
  blob[blob.indexOf('NSString') + 15] = 0x28
  expect(decodeAttributedBody(blob)).toBeNull()
})

it('decodes a view that starts partway into a larger buffer', () => {
  const blob = makeAttributedBody('offset ok')
  const padded = new Uint8Array(blob.length + 4)
  padded.set(blob, 4)
  expect(decodeAttributedBody(padded.subarray(4))).toBe('offset ok')
})
