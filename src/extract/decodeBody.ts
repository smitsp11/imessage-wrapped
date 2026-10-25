/**
 * Newer macOS versions often leave `message.text` NULL and keep the text in
 * `attributedBody`, an NSAttributedString in Apple's "typedstream" format.
 * The string follows the class name "NSString", 5 bytes of type info, then a
 * length: one byte below 0x80, or 0x81 + 2 bytes, or 0x82 + 4 bytes (little-endian).
 * The length is signed in typedstream but never negative here, so it is read unsigned.
 * Returns null when there is no text or the blob can't be decoded (including invalid UTF-8).
 * Known limitation: only the first "NSString" is read, so messages whose text is stored under another
 * string class decode to null and are counted as undecodable.
 */
const CLASS_NAME = 'NSString'
const TYPE_INFO_LENGTH = 5
const INT16_TAG = 0x81
const INT32_TAG = 0x82
const utf8 = new TextDecoder('utf-8', { fatal: true })

export function decodeAttributedBody(blob: Uint8Array | null): string | null {
  if (!blob) return null
  const bytes = Buffer.from(blob.buffer, blob.byteOffset, blob.byteLength)
  const marker = bytes.indexOf(CLASS_NAME)
  if (marker === -1) return null

  let i = marker + CLASS_NAME.length + TYPE_INFO_LENGTH
  if (i >= bytes.length) return null

  let length: number
  const tag = bytes[i]
  if (tag === INT16_TAG) {
    if (i + 3 > bytes.length) return null
    length = bytes.readUInt16LE(i + 1)
    i += 3
  } else if (tag === INT32_TAG) {
    if (i + 5 > bytes.length) return null
    length = bytes.readUInt32LE(i + 1)
    i += 5
  } else if (tag !== undefined && tag < 0x80) {
    length = tag
    i += 1
  } else {
    return null
  }

  if (length === 0 || i + length > bytes.length) return null
  try {
    return utf8.decode(bytes.subarray(i, i + length))
  } catch {
    return null
  }
}
