/** Builds a minimal typedstream blob shaped like the ones Messages writes. */
const HEADER = Buffer.from(
  '\x04\x0bstreamtyped\x81\xe8\x03\x84\x01@\x84\x84\x84\x12NSAttributedString\x00\x84\x84\x08NSObject\x00\x85\x92\x84\x84\x84\x08',
  'latin1',
)
const TYPE_INFO = Buffer.from([0x01, 0x94, 0x84, 0x01, 0x2b])
const TRAILER = Buffer.from([0x86, 0x84, 0x02, 0x69, 0x49, 0x01])

function encodeLength(length: number): Buffer {
  if (length < 0x80) return Buffer.from([length])
  if (length <= 0x7fff) {
    const out = Buffer.alloc(3)
    out[0] = 0x81
    out.writeUInt16LE(length, 1)
    return out
  }
  const out = Buffer.alloc(5)
  out[0] = 0x82
  out.writeUInt32LE(length, 1)
  return out
}

export function makeAttributedBody(text: string): Buffer {
  const utf8 = Buffer.from(text, 'utf8')
  return Buffer.concat([HEADER, Buffer.from('NSString', 'latin1'), TYPE_INFO, encodeLength(utf8.length), utf8, TRAILER])
}
