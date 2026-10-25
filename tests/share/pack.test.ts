import { describe, expect, it } from 'vitest'
import { BrokenLinkError, NewerVersionError, WrappedError } from '../../src/errors'
import { MAX_LINK_CHARS, fitToLimit, packWrap, unpackWrap } from '../../src/share/pack'
import type { Wrap } from '../../src/types'
import { makeFakeWrap } from '../../fixtures/fakeWrap'

/** Pseudo-random letters, so the text doesn't compress away. */
function noise(seed: number, length: number): string {
  let x = seed
  let out = ''
  for (let i = 0; i < length; i++) {
    x = (x * 1103515245 + 12345) % 2147483648
    out += String.fromCharCode(97 + (x % 26))
  }
  return out
}

describe('share links', () => {
  const wrap = makeFakeWrap('group')

  it('round-trips a wrap', async () => {
    const packed = await packWrap(wrap)
    expect(packed).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(await unpackWrap(packed)).toEqual(wrap)
  })

  it('drops the least-reacted quotes until the link fits', async () => {
    const hits = Array.from({ length: 10 }, (_, i) => ({
      senderId: 'p1', text: noise(i + 1, 280), sentAt: '2026-01-01T00:00:00.000Z', reactions: 10 - i, laughs: 0,
    }))
    const { packed, dropped } = await fitToLimit({ ...wrap, greatestHits: hits }, 3000)
    expect(packed.length).toBeLessThanOrEqual(3000)
    expect(dropped.length).toBeGreaterThan(0)
    const kept = (await unpackWrap(packed)).greatestHits
    expect([...kept, ...dropped]).toEqual(hits)
  })

  it('fails clearly when even no quotes is too big', async () => {
    await expect(fitToLimit(wrap, 10)).rejects.toThrow(WrappedError)
  })

  it.each(['group', 'solo'] as const)('round-trips the %s fake wrap, even with a newline in the link', async (mode) => {
    const original = makeFakeWrap(mode)
    const packed = await packWrap(original)
    const middle = Math.floor(packed.length / 2)
    expect(await unpackWrap(`${packed.slice(0, middle)}\n${packed.slice(middle)}`)).toEqual(original)
  })

  describe('untrusted links', () => {
    const packAny = (value: unknown) => packWrap(value as Wrap)

    it('rejects unusable links with BrokenLinkError', async () => {
      const packed = await packWrap(wrap)
      const broken = [
        '<script>alert(1)</script>',
        packed.slice(0, -20),
        '',
        'a'.repeat(MAX_LINK_CHARS + 1),
        await packAny(null),
        await packAny({ version: 1 }),
      ]
      for (const link of broken) await expect(unpackWrap(link)).rejects.toThrow(BrokenLinkError)
    })

    it('says so when the wrap is from a newer version', async () => {
      await expect(unpackWrap(await packAny({ version: 2 }))).rejects.toThrow(NewerVersionError)
    })
  })
})
