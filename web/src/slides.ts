import { formatMinutes } from '../../src/format'
import type { Wrap } from '../../src/types'

export type Slide = { id: string; html: string }
type Row = { name: string; value: number }

const MAX_BARS = 6
const MAX_QUOTES = 3
const MAX_SIGNATURES = 6
/** the smallest bar stays visible */
const MIN_BAR_PERCENT = 2
/** a median over a handful of replies says little, so fewer than this don't make the fastest-replies list */
const MIN_REPLIES_FOR_FASTEST = 5
/** the id buildWrap gives the solo "Everyone else" bucket */
const OTHERS_ID = 'others'

export function escapeHtml(text: string): string {
  const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
  return text.replace(/[&<>"']/g, (c) => entities[c]!)
}

/** Own-property check: an id like "toString" must not find something on Object.prototype. */
function personName(wrap: Wrap, id: string): string {
  return Object.hasOwn(wrap.people, id) ? wrap.people[id]! : 'Someone'
}

function plural(n: number, word: string): string {
  return `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`
}

function hourLabel(hour: number): string {
  return `${hour % 12 || 12} ${hour < 12 ? 'AM' : 'PM'}`
}

/** `scale` "largest": the biggest value gets the full bar. "smallest": the smallest does (lower is better). */
function bars(
  rows: Row[],
  format: (value: number) => string = (n) => n.toLocaleString('en-US'),
  scale: 'largest' | 'smallest' = 'largest',
): string {
  const shown = rows.slice(0, MAX_BARS)
  const largest = Math.max(...shown.map((r) => r.value), 1)
  const smallest = Math.min(...shown.map((r) => r.value))
  const width = (value: number) => {
    const raw = scale === 'largest' ? (value / largest) * 100 : value <= 0 ? 100 : (smallest / value) * 100
    return Math.min(100, Math.max(MIN_BAR_PERCENT, raw))
  }
  const items = shown.map(
    (r) =>
      `<li><span class="name">${escapeHtml(r.name)}</span>` +
      `<span class="bar" style="--w:${Math.round(width(r.value))}%"></span>` +
      `<span class="value">${escapeHtml(format(r.value))}</span></li>`,
  )
  return `<ol class="bars">${items.join('')}</ol>`
}

/** Turns a wrap into story slides. Pure (no DOM), so it's unit-tested. */
export function buildSlides(wrap: Wrap): Slide[] {
  const isGroup = wrap.mode === 'group'
  const ranked = (record: Record<string, number>, order: 'desc' | 'asc' = 'desc', skip: string[] = []): Row[] =>
    Object.entries(record)
      .filter(([id]) => id !== OTHERS_ID && !skip.includes(id))
      .map(([id, value]) => ({ name: personName(wrap, id), value }))
      .sort((a, b) => (order === 'desc' ? b.value - a.value : a.value - b.value))
  const slides: Slide[] = []
  const year = escapeHtml(wrap.period.from.slice(0, 4))

  slides.push({
    id: 'intro',
    html: `<p class="kicker">${isGroup ? 'Group Chat Wrapped' : 'Your Texts Wrapped'} · ${year}</p>
      <h1>${escapeHtml(wrap.title)}</h1>
      <p class="big">${wrap.volume.total.toLocaleString('en-US')}</p><p>messages</p>
      <p class="hint"><span class="touch">Tap to continue</span><span class="pointer">Click or press → to continue</span></p>`,
  })

  // Solo: you are in every chat, so "who you text the most" leaves you out.
  const volumeRows = ranked(wrap.volume.byPerson, 'desc', isGroup ? [] : ['me'])
  if (volumeRows.length > 0) {
    slides.push({
      id: 'volume',
      html: `<h2>${isGroup ? 'Who talked the most' : 'Who you text the most'}</h2>${bars(volumeRows)}`,
    })
  }

  if (wrap.topChats.length > 0) {
    const rows = wrap.topChats.map((c) => ({ name: c.name, value: c.messages }))
    slides.push({ id: 'top-chats', html: `<h2>Your top chats</h2>${bars(rows)}` })
  }

  const top = Math.max(...wrap.timing.byHour)
  const peak = Math.max(top, 1)
  slides.push({
    id: 'hours',
    html: `<h2>Peak hour</h2><p class="big">${hourLabel(wrap.timing.byHour.indexOf(top))}</p>
      <div class="hours" aria-hidden="true">${wrap.timing.byHour
        .map((n) => `<span style="--h:${Math.max(0, Math.round((n / peak) * 100))}%"></span>`)
        .join('')}</div>`,
  })

  // Across all your chats the longest silence is ~0, so only a group chat shows it, and only when it's real.
  const silenceDays = wrap.timing.longestSilenceDays
  const silence = isGroup && silenceDays >= 2 ? ` Longest silence: ${plural(silenceDays, 'day')}.` : ''
  slides.push({
    id: 'streak',
    html: `<h2>Longest streak</h2><p class="big">${plural(wrap.timing.longestStreakDays, 'day')}</p>
      <p>in a row with at least one message.${silence}</p>`,
  })

  const { repliesByPerson } = wrap.replies
  const experienced = Object.fromEntries(
    Object.entries(wrap.replies.medianReplyMinutesByPerson).filter(
      ([id]) => Object.hasOwn(repliesByPerson, id) && repliesByPerson[id]! >= MIN_REPLIES_FOR_FASTEST,
    ),
  )
  const replies = ranked(experienced, 'asc')
  if (replies.length > 0) {
    slides.push({ id: 'replies', html: `<h2>Fastest replies</h2>${bars(replies, formatMinutes, 'smallest')}` })
  }

  const starts = ranked(wrap.starters.startsByPerson)
  if (starts.length > 0) {
    slides.push({ id: 'starters', html: `<h2>Who starts the conversation</h2>${bars(starts)}` })
  }

  const given = ranked(wrap.reactions.givenByPerson)
  if (given.length > 0) slides.push({ id: 'reactions', html: `<h2>Biggest reactors</h2>${bars(given)}` })

  const words = wordsSlide(wrap)
  if (words) slides.push(words)

  const hits = hitsSlide(wrap)
  if (hits) slides.push(hits)

  for (const award of wrap.awards) {
    slides.push({
      id: `award-${award.id}`,
      html: `<p class="kicker">Award</p><h2>${escapeHtml(award.title)}</h2>
        <p class="big">${escapeHtml(personName(wrap, award.personId))}</p><p>${escapeHtml(award.label)}</p>`,
    })
  }

  slides.push({
    id: 'outro',
    html: `<h2>That's a wrap</h2>
      <p>Made with iMessage Wrapped. This page lives in the link itself: nothing was stored on a server.</p>`,
  })
  return slides
}

function wordsSlide(wrap: Wrap): Slide | null {
  const { topWords, topEmoji, signatureWordByPerson } = wrap.words
  if (topWords.length === 0 && topEmoji.length === 0) return null
  const emoji = topEmoji.slice(0, 5).map((e) => escapeHtml(e.emoji)).join(' ')
  const wordItems = topWords
    .slice(0, 5)
    .map((w) => `<li>${escapeHtml(w.word)} <small>${w.count.toLocaleString('en-US')}</small></li>`)
    .join('')
  const sent = (id: string) => (Object.hasOwn(wrap.volume.byPerson, id) ? wrap.volume.byPerson[id]! : 0)
  // Over the cap, keep the people who sent the most messages (the sort is stable, so ties keep their order).
  const signature = Object.entries(signatureWordByPerson)
    .sort(([a], [b]) => sent(b) - sent(a))
    .slice(0, MAX_SIGNATURES)
    .map(([id, word]) => {
      const who = id === 'me' ? 'You say' : `${escapeHtml(personName(wrap, id))} says`
      return `<li>${who} <b>“${escapeHtml(word)}”</b></li>`
    })
    .join('')
  return {
    id: 'words',
    html: `<h2>${wrap.mode === 'group' ? "The group's vocabulary" : 'Your vocabulary'}</h2>
      ${emoji ? `<p class="label">Top emoji</p><p class="emoji">${emoji}</p>` : ''}
      ${wordItems ? `<p class="label">Top words</p><ol class="words">${wordItems}</ol>` : ''}
      ${signature ? `<ul class="signature">${signature}</ul>` : ''}`,
  }
}

function hitsSlide(wrap: Wrap): Slide | null {
  if (wrap.greatestHits.length === 0) return null
  const quotes = wrap.greatestHits.slice(0, MAX_QUOTES).map((h) => {
    const who = escapeHtml(personName(wrap, h.senderId))
    return (
      `<figure><blockquote>“${escapeHtml(h.text)}”</blockquote>` +
      `<figcaption>${who} · ${plural(h.reactions, 'reaction')}</figcaption></figure>`
    )
  })
  // Two or three quotes get a smaller type size so they fit.
  const size = quotes.length > 1 ? 'compact' : 'single'
  return { id: 'hits', html: `<h2>Greatest hits</h2><div class="quotes ${size}">${quotes.join('')}</div>` }
}
