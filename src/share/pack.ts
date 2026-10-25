import { WrappedError } from '../errors'
import type { Hit } from '../stats/greatestHits'
import type { Wrap } from '../types'

/** Characters allowed after the "#". Long enough for stats + a few quotes, short enough to paste. */
export const MAX_LINK_CHARS = 8192

export async function packWrap(wrap: Wrap): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(wrap))
  return toBase64Url(await transform(json, new CompressionStream('deflate-raw')))
}

export async function unpackWrap(packed: string): Promise<Wrap> {
  const json = await transform(fromBase64Url(packed), new DecompressionStream('deflate-raw'))
  const wrap = JSON.parse(new TextDecoder().decode(json)) as Wrap
  if (wrap.version !== 1) throw new WrappedError('This wrap was made by a newer version of iMessage Wrapped.')
  return wrap
}

/** Removes quotes from the end (fewest reactions) until the packed wrap fits. */
export async function fitToLimit(wrap: Wrap, limit = MAX_LINK_CHARS): Promise<{ packed: string; dropped: Hit[] }> {
  const kept = [...wrap.greatestHits]
  const dropped: Hit[] = []
  for (;;) {
    const packed = await packWrap({ ...wrap, greatestHits: kept })
    if (packed.length <= limit) return { packed, dropped }
    const last = kept.pop()
    if (!last) throw new WrappedError('This wrap is too big to fit in a link.')
    dropped.unshift(last)
  }
}

async function transform(
  bytes: Uint8Array<ArrayBuffer>,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array<ArrayBuffer>> {
  const output = new Blob([bytes]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(output).arrayBuffer())
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '==='.slice((base64.length + 3) % 4)
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}
