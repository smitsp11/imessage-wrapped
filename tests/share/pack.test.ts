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

async function deflateToBase64Url(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  const deflated = new Uint8Array(await new Response(stream).arrayBuffer())
  return btoa(String.fromCharCode(...deflated)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
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

    it('rejects an otherwise valid wrap that is longer than the cap', async () => {
      const tooLong = await packWrap({ ...wrap, title: noise(1, 14000) })
      expect(tooLong.length).toBeGreaterThan(MAX_LINK_CHARS)
      await expect(unpackWrap(tooLong)).rejects.toThrow(BrokenLinkError)
    })

    it('rejects bytes that are not valid UTF-8, even inside an otherwise valid wrap', async () => {
      const marker = 'ZZ'
      const bytes = new TextEncoder().encode(JSON.stringify({ ...wrap, title: marker }))
      const at = bytes.indexOf(marker.charCodeAt(0))
      bytes[at] = 0xff // lone 0xFF can never be UTF-8
      await expect(unpackWrap(await deflateToBase64Url(bytes))).rejects.toThrow(BrokenLinkError)
    })

    it('rejects a truncated link', async () => {
      await expect(unpackWrap((await packWrap(wrap)).slice(0, -20))).rejects.toThrow(BrokenLinkError)
    })

    it.each([
      ['invalid characters', async () => '<script>alert(1)</script>'],
      ['an empty link', async () => ''],
      ['valid characters that are not deflate', async () => 'a'.repeat(MAX_LINK_CHARS + 1)],
      ['JSON null', () => packAny(null)],
      ['JSON without the wrap fields', () => packAny({ version: 1 })],
    ])('rejects %s', async (_label, makeLink) => {
      await expect(unpackWrap(await makeLink())).rejects.toThrow(BrokenLinkError)
    })

    it('says so when the wrap is from a newer version', async () => {
      await expect(unpackWrap(await packAny({ version: 2 }))).rejects.toThrow(NewerVersionError)
    })
  })
})
