import { formatMinutes } from '../../src/format'
import type { Wrap } from '../../src/types'

export type Slide = { id: string; html: string }
type Row = { name: string; value: number }

const MAX_BARS = 6
const MAX_QUOTES = 3

export function escapeHtml(text: string): string {
  const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
  return text.replace(/[&<>"']/g, (c) => entities[c]!)
}

function hourLabel(hour: number): string {
  return `${hour % 12 || 12} ${hour < 12 ? 'AM' : 'PM'}`
}

function bars(rows: Row[], format: (value: number) => string = String): string {
  const max = Math.max(...rows.map((r) => r.value), 1)
  const items = rows.slice(0, MAX_BARS).map(
    (r) =>
      `<li><span class="name">${escapeHtml(r.name)}</span>` +
      `<span class="bar" style="--w:${(r.value / max) * 100}%"></span>` +
      `<span class="value">${escapeHtml(format(r.value))}</span></li>`,
  )
  return `<ol class="bars">${items.join('')}</ol>`
}

/** Turns a wrap into story slides. Pure (no DOM), so it's unit-tested. */
export function buildSlides(wrap: Wrap): Slide[] {
  // Own-property check: an id like "toString" must not find something on Object.prototype.
  const rawName = (id: string) => (Object.hasOwn(wrap.people, id) ? wrap.people[id]! : 'Someone')
  const name = (id: string) => escapeHtml(rawName(id))
  const ranked = (record: Record<string, number>, order: 'desc' | 'asc' = 'desc'): Row[] =>
    Object.entries(record)
      .map(([id, value]) => ({ name: rawName(id), value }))
      .sort((a, b) => (order === 'desc' ? b.value - a.value : a.value - b.value))
  const isGroup = wrap.mode === 'group'
  const slides: Slide[] = []

  slides.push({
    id: 'intro',
    html: `<p class="kicker">${isGroup ? 'Group Chat Wrapped' : 'Your Texts Wrapped'} · ${escapeHtml(wrap.period.from.slice(0, 4))}</p>
      <h1>${escapeHtml(wrap.title)}</h1>
      <p class="big">${wrap.volume.total.toLocaleString('en-US')}</p><p>messages</p>`,
  })

  slides.push({ id: 'volume', html: `<h2>${isGroup ? 'Who talked the most' : 'Who you text the most'}</h2>${bars(ranked(wrap.volume.byPerson))}` })

  if (wrap.topChats.length > 0) {
    slides.push({ id: 'top-chats', html: `<h2>Your top chats</h2>${bars(wrap.topChats.map((c) => ({ name: c.name, value: c.messages })))}` })
  }

  const peak = Math.max(...wrap.timing.byHour, 1)
  slides.push({
    id: 'hours',
    html: `<h2>Peak hour</h2><p class="big">${hourLabel(wrap.timing.byHour.indexOf(Math.max(...wrap.timing.byHour)))}</p>
      <div class="hours">${wrap.timing.byHour.map((n) => `<span style="--h:${(n / peak) * 100}%"></span>`).join('')}</div>`,
  })

  // Across all your chats the longest silence is ~0, so only a single group chat shows it.
  const silence = isGroup ? ` Longest silence: ${String(wrap.timing.longestSilenceDays)} days.` : ''
  slides.push({
    id: 'streak',
    html: `<h2>Longest streak</h2><p class="big">${String(wrap.timing.longestStreakDays)} days</p>
      <p>in a row with at least one message.${silence}</p>`,
  })

  const replies = ranked(wrap.replies.medianReplyMinutesByPerson, 'asc')
  if (replies.length > 0) slides.push({ id: 'replies', html: `<h2>Fastest replies</h2>${bars(replies, formatMinutes)}` })

  const starts = ranked(wrap.starters.startsByPerson)
  if (starts.length > 0) slides.push({ id: 'starters', html: `<h2>Who starts the conversation</h2>${bars(starts)}` })

  const given = ranked(wrap.reactions.givenByPerson)
  if (given.length > 0) slides.push({ id: 'reactions', html: `<h2>Biggest reactors</h2>${bars(given)}` })

  if (wrap.words.topWords.length > 0 || wrap.words.topEmoji.length > 0) {
    const signature = Object.entries(wrap.words.signatureWordByPerson)
      .map(([id, word]) => `<li>${name(id)} says <b>“${escapeHtml(word)}”</b></li>`)
      .join('')
    slides.push({
      id: 'words',
      html: `<h2>${isGroup ? "The group's vocabulary" : 'Your vocabulary'}</h2>
        <p class="emoji">${wrap.words.topEmoji.slice(0, 5).map((e) => escapeHtml(e.emoji)).join(' ')}</p>
        <ol class="words">${wrap.words.topWords.slice(0, 5).map((w) => `<li>${escapeHtml(w.word)} <small>${w.count.toLocaleString('en-US')}</small></li>`).join('')}</ol>
        ${signature ? `<ul class="signature">${signature}</ul>` : ''}`,
    })
  }

  if (wrap.greatestHits.length > 0) {
    const quotes = wrap.greatestHits
      .slice(0, MAX_QUOTES)
      .map((h) => `<blockquote>“${escapeHtml(h.text)}”<cite>${name(h.senderId)} · ${h.reactions.toLocaleString('en-US')} reactions</cite></blockquote>`)
    slides.push({ id: 'hits', html: `<h2>Greatest hits</h2>${quotes.join('')}` })
  }

  for (const award of wrap.awards) {
    slides.push({
      id: `award-${award.id}`,
      html: `<p class="kicker">Award</p><h1>${escapeHtml(award.title)}</h1>
        <p class="big">${name(award.personId)}</p><p>${escapeHtml(award.label)}</p>`,
    })
  }

  slides.push({
    id: 'outro',
    html: `<h2>That's a wrap</h2><p>Made with iMessage Wrapped. This page lives in the link itself: nothing was stored on a server.</p>`,
  })
  return slides
}
