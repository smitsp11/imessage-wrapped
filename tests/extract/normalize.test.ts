import { describe, expect, it } from 'vitest'
import { APPLE_EPOCH_MS } from '../../src/extract/appleTime'
import { type MessageRow, normalizeRows } from '../../src/extract/normalize'
import { makeAttributedBody } from '../../fixtures/attributedBody'

function row(partial: Partial<MessageRow> & { id: number }): MessageRow {
  return {
    guid: `G${partial.id}`,
    chatId: 1,
    isFromMe: 0,
    handle: '+14165550101',
    dateMs: 800_000_000_000 + partial.id * 60_000,
    text: 'hi',
    body: null,
    hasAttachment: 0,
    assocGuid: null,
    assocType: 0,
    assocEmoji: null,
    ...partial,
  }
}

describe('normalizeRows', () => {
  it('turns a plain row into a message', () => {
    const { messages } = normalizeRows([row({ id: 1 })])
    expect(messages[0]).toEqual({
      id: 1,
      guid: 'G1',
      chatId: 1,
      senderId: '+14165550101',
      sentAt: new Date(APPLE_EPOCH_MS + 800_000_060_000),
      text: 'hi',
      isFromMe: false,
      reactsToGuid: null,
      reactionType: null,
      reactionEmoji: null,
      hasAttachment: false,
    })
  })

  it('uses "me" for my own messages', () => {
    const { messages } = normalizeRows([row({ id: 1, isFromMe: 1, handle: null })])
    expect(messages[0]?.senderId).toBe('me')
  })

  it('falls back to attributedBody when text is null', () => {
    const { messages } = normalizeRows([row({ id: 1, text: null, body: makeAttributedBody('from the blob') })])
    expect(messages[0]?.text).toBe('from the blob')
  })

  it('skips and counts messages it cannot decode', () => {
    const result = normalizeRows([row({ id: 1, text: null, body: new Uint8Array([1, 2, 3]) })])
    expect(result).toEqual({ messages: [], undecodable: 1 })
  })

  it('keeps attachment-only messages with null text', () => {
    const { messages } = normalizeRows([row({ id: 1, text: '\uFFFC', hasAttachment: 1 })])
    expect(messages[0]).toMatchObject({ text: null, hasAttachment: true })
  })

  it('skips rows with no text and no attachment without counting them', () => {
    expect(normalizeRows([row({ id: 1, text: null })])).toEqual({ messages: [], undecodable: 0 })
  })

  it('reads reactions and strips the part prefix from the target', () => {
    const { messages } = normalizeRows([
      row({ id: 1 }),
      row({ id: 2, text: null, assocType: 2003, assocGuid: 'p:0/G1' }),
      row({ id: 3, text: null, assocType: 2000, assocGuid: 'bp:G1', handle: '+14165550102' }),
    ])
    expect(messages.slice(1).map((m) => [m.reactionType, m.reactsToGuid])).toEqual([
      ['laugh', 'G1'],
      ['love', 'G1'],
    ])
  })

  it('cancels a reaction the same person later removed', () => {
    const { messages } = normalizeRows([
      row({ id: 1 }),
      row({ id: 2, text: null, assocType: 2003, assocGuid: 'p:0/G1', handle: '+1999' }),
      row({ id: 3, text: null, assocType: 2003, assocGuid: 'p:0/G1', handle: '+1888' }),
      row({ id: 4, text: null, assocType: 3003, assocGuid: 'p:0/G1', handle: '+1999' }),
    ])
    expect(messages.map((m) => m.id)).toEqual([1, 3])
  })

  it('keeps the emoji of a custom emoji reaction', () => {
    const { messages } = normalizeRows([row({ id: 1, text: null, assocType: 2006, assocGuid: 'p:0/G9', assocEmoji: '🔥' })])
    expect(messages[0]).toMatchObject({ reactionType: 'emoji', reactionEmoji: '🔥' })
  })

  it('ignores sticker reactions', () => {
    expect(normalizeRows([row({ id: 1, text: null, assocType: 2007, assocGuid: 'p:0/G9' })])).toEqual({
      messages: [],
      undecodable: 0,
    })
  })

  it('keeps a caption next to an attachment placeholder', () => {
    const { messages } = normalizeRows([row({ id: 1, text: '￼ nice pic', hasAttachment: 1 })])
    expect(messages[0]).toMatchObject({ text: 'nice pic', hasAttachment: true })
  })

  it('keeps only the last add when a reaction is re-added after removal', () => {
    const { messages } = normalizeRows([
      row({ id: 1 }),
      row({ id: 2, text: null, assocType: 2003, assocGuid: 'p:0/G1' }),
      row({ id: 3, text: null, assocType: 3003, assocGuid: 'p:0/G1' }),
      row({ id: 4, text: null, assocType: 2003, assocGuid: 'p:0/G1' }),
    ])
    expect(messages.map((m) => m.id)).toEqual([1, 4])
  })

  it('ignores a removal with no earlier add', () => {
    expect(normalizeRows([row({ id: 1, text: null, assocType: 3003, assocGuid: 'p:0/G1' })])).toEqual({
      messages: [],
      undecodable: 0,
    })
  })

  it('keeps different reaction types from the same sender on the same target', () => {
    const { messages } = normalizeRows([
      row({ id: 1, text: null, assocType: 2000, assocGuid: 'p:0/G9' }),
      row({ id: 2, text: null, assocType: 2003, assocGuid: 'p:0/G9' }),
    ])
    expect(messages.map((m) => m.reactionType)).toEqual(['love', 'laugh'])
  })

  it('cancels my own reaction removal', () => {
    const { messages } = normalizeRows([
      row({ id: 1, text: null, isFromMe: 1, handle: null, assocType: 2000, assocGuid: 'p:0/G9' }),
      row({ id: 2, text: null, isFromMe: 1, handle: null, assocType: 3000, assocGuid: 'p:0/G9' }),
    ])
    expect(messages).toEqual([])
  })

  it('cancels an emoji reaction removal', () => {
    const { messages } = normalizeRows([
      row({ id: 1, text: null, assocType: 2006, assocGuid: 'p:0/G9', assocEmoji: '🔥' }),
      row({ id: 2, text: null, assocType: 3006, assocGuid: 'p:0/G9', assocEmoji: '🔥' }),
    ])
    expect(messages).toEqual([])
  })

  it('ignores a removal with an unknown code', () => {
    const { messages } = normalizeRows([
      row({ id: 1, text: null, assocType: 2003, assocGuid: 'p:0/G9' }),
      row({ id: 2, text: null, assocType: 3007, assocGuid: 'p:0/G9' }),
    ])
    expect(messages.map((m) => m.id)).toEqual([1])
  })

  it('treats reactions to different parts of one message separately', () => {
    const { messages } = normalizeRows([
      row({ id: 1 }),
      row({ id: 2, text: null, assocType: 2003, assocGuid: 'p:0/G1' }),
      row({ id: 3, text: null, assocType: 2003, assocGuid: 'p:1/G1' }),
      row({ id: 4, text: null, assocType: 3003, assocGuid: 'p:0/G1' }),
    ])
    expect(messages.slice(1).map((m) => m.id)).toEqual([3])
  })
})
