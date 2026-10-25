import type { Message } from '../types'
import { contentMessages, increment } from './conversation'

export type VolumeStats = {
  total: number
  byPerson: Record<string, number>
  attachmentsByPerson: Record<string, number>
}

export function volumeStats(messages: Message[]): VolumeStats {
  const content = contentMessages(messages)
  const byPerson: Record<string, number> = {}
  const attachmentsByPerson: Record<string, number> = {}
  for (const m of content) {
    increment(byPerson, m.senderId)
    if (m.hasAttachment) increment(attachmentsByPerson, m.senderId)
  }
  return { total: content.length, byPerson, attachmentsByPerson }
}
