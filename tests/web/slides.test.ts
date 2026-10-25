import { describe, expect, it } from 'vitest'
import { buildSlides, escapeHtml } from '../../web/src/slides'
import { makeFakeWrap } from '../../fixtures/fakeWrap'

describe('buildSlides', () => {
  it('builds the group slide sequence', () => {
    expect(buildSlides(makeFakeWrap('group')).map((s) => s.id)).toEqual([
      'intro', 'volume', 'hours', 'streak', 'replies', 'starters', 'reactions', 'words', 'hits',
      'award-main-character', 'award-ghost', 'award-starter', 'award-comedian', 'award-hype',
      'award-night-owl', 'award-double-texter', 'outro',
    ])
  })

  it('adds top chats in solo mode', () => {
    expect(buildSlides(makeFakeWrap('solo')).map((s) => s.id)).toContain('top-chats')
  })

  it('escapes names and quotes', () => {
    const wrap = makeFakeWrap('group')
    wrap.people.p1 = '<img src=x onerror=alert(1)>'
    const html = buildSlides(wrap).map((s) => s.html).join('')
    expect(html).not.toContain('<img')
    expect(escapeHtml(`<a href="x">'`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;')
  })

  it('shows ids that are not in people as "Someone"', () => {
    const wrap = makeFakeWrap('group')
    wrap.volume.byPerson = { toString: 5 }
    wrap.awards[0]!.personId = 'toString'
    const slides = buildSlides(wrap)
    const volume = slides.find((s) => s.id === 'volume')!.html
    expect(volume).toContain('Someone')
    expect(volume).not.toContain('function')
    expect(slides.find((s) => s.id === 'award-main-character')!.html).toContain('Someone')
  })

  it('hides the silence sentence and an empty signature list in solo mode', () => {
    const wrap = makeFakeWrap('solo')
    wrap.words.signatureWordByPerson = {}
    const slides = buildSlides(wrap)
    expect(slides.find((s) => s.id === 'streak')!.html).not.toMatch(/silence/i)
    expect(slides.find((s) => s.id === 'words')!.html).not.toContain('class="signature"')
    expect(slides.find((s) => s.id === 'words')!.html).toContain('Your vocabulary')
  })

  it('keeps the silence sentence in group mode when it is at least 2 days', () => {
    const wrap = makeFakeWrap('group')
    wrap.timing.longestSilenceDays = 3
    expect(slideHtml(wrap, 'streak')).toContain('Longest silence: 3 days.')
    wrap.timing.longestSilenceDays = 1
    expect(slideHtml(wrap, 'streak')).not.toMatch(/silence/i)
  })

  it('pluralises counts', () => {
    const wrap = makeFakeWrap('group')
    wrap.timing.longestStreakDays = 1
    wrap.greatestHits = [{ senderId: 'p1', text: 'hi', sentAt: '2026-01-01T00:00:00Z', reactions: 1, laughs: 0 }]
    expect(slideHtml(wrap, 'streak')).toContain('1 day<')
    expect(slideHtml(wrap, 'hits')).toContain('1 reaction<')
    wrap.timing.longestStreakDays = 2
    wrap.greatestHits[0]!.reactions = 2
    expect(slideHtml(wrap, 'streak')).toContain('2 days<')
    expect(slideHtml(wrap, 'hits')).toContain('2 reactions<')
  })

  it('says "You say" for your own signature word', () => {
    const wrap = makeFakeWrap('group')
    wrap.words.signatureWordByPerson = { me: 'omw', p1: 'lol' }
    const html = slideHtml(wrap, 'words')
    expect(html).toContain('You say <b>')
    expect(html).not.toContain('You says')
    expect(html).toContain('Alex Chen says <b>')
  })

  it('makes the fastest replier the full bar and lists them first', () => {
    const html = slideHtml(makeFakeWrap('group'), 'replies')
    const widths = [...html.matchAll(/--w:([\d.]+)%/g)].map((m) => Number(m[1]))
    expect(html.indexOf('Alex Chen')).toBeLessThan(html.indexOf('Sam Rivera'))
    expect(widths[0]).toBe(100)
    expect(widths[widths.length - 1]).toBeLessThan(100)
  })

  it('leaves people with fewer than 5 replies out of fastest replies', () => {
    const wrap = makeFakeWrap('group')
    wrap.replies.medianReplyMinutesByPerson.p4 = 0.5
    wrap.replies.repliesByPerson.p4 = 4
    const html = slideHtml(wrap, 'replies')
    expect(html).not.toContain('Riley Park')
    expect(html).toContain('--w:100%')
  })

  it('never shows "Everyone else" in ranked slides, and not you in who-you-text', () => {
    const wrap = makeFakeWrap('solo')
    wrap.people.others = 'Everyone else'
    wrap.volume.byPerson.others = 999
    wrap.starters.startsByPerson.others = 999
    wrap.reactions.givenByPerson.others = 999
    wrap.replies.medianReplyMinutesByPerson.others = 0.1
    wrap.replies.repliesByPerson.others = 99
    const slides = buildSlides(wrap)
    for (const id of ['volume', 'replies', 'starters', 'reactions']) {
      expect(slides.find((s) => s.id === id)!.html).not.toContain('Everyone else')
    }
    expect(slides.find((s) => s.id === 'volume')!.html).not.toContain('You')
  })

  it('escapes every text field from the wrap', () => {
    const evil = "<b x='1'>"
    const wrap = makeFakeWrap('solo')
    wrap.title = evil
    wrap.greatestHits = [{ senderId: 'p1', text: evil, sentAt: '2026-01-01T00:00:00Z', reactions: 3, laughs: 1 }]
    wrap.awards = [{ id: 'ghost', title: evil, personId: 'p1', value: 1, label: evil }]
    wrap.words.topEmoji = [{ emoji: evil, count: 1 }]
    wrap.words.topWords = [{ word: evil, count: 1 }]
    wrap.words.signatureWordByPerson = { p1: evil }
    wrap.topChats = [{ name: evil, messages: 1 }]
    const html = buildSlides(wrap).map((s) => s.html).join('')
    expect(html).not.toContain('<b ')
    expect(html).toContain('&lt;b x=&#39;1&#39;&gt;')
    for (const id of ['intro', 'top-chats', 'words', 'hits', 'award-ghost']) {
      expect(slideHtml(wrap, id)).toContain('&lt;b x=&#39;1&#39;&gt;')
    }
  })

  it('builds the solo slide sequence', () => {
    expect(buildSlides(makeFakeWrap('solo')).map((s) => s.id)).toEqual([
      'intro', 'volume', 'top-chats', 'hours', 'streak', 'replies', 'starters', 'reactions', 'words', 'hits',
      'award-ghost', 'award-starter', 'award-comedian', 'award-hype', 'award-night-owl', 'award-double-texter', 'outro',
    ])
  })

  it('skips slides with nothing to show', () => {
    const wrap = makeFakeWrap('group')
    wrap.greatestHits = []
    wrap.awards = []
    wrap.replies = { medianReplyMinutesByPerson: {}, repliesByPerson: {} }
    wrap.starters.startsByPerson = {}
    wrap.reactions.givenByPerson = {}
    const ids = buildSlides(wrap).map((s) => s.id)
    expect(ids).toEqual(['intro', 'volume', 'hours', 'streak', 'words', 'outro'])
  })

  it('hides the emoji and word lists when empty', () => {
    const wrap = makeFakeWrap('group')
    wrap.words.topEmoji = []
    const html = slideHtml(wrap, 'words')
    expect(html).not.toContain('Top emoji')
    expect(html).toContain('Top words')
  })

  it('marks the hour chart decorative, titles awards with h2 and wraps quotes in figures', () => {
    const slides = buildSlides(makeFakeWrap('group'))
    const html = (id: string) => slides.find((s) => s.id === id)!.html
    expect(html('hours')).toContain('class="hours" aria-hidden="true"')
    expect(html('award-ghost')).toContain('<h2>')
    expect(html('award-ghost')).not.toContain('<h1>')
    expect(html('hits')).toContain('<figure><blockquote>')
    expect(html('hits')).toContain('<figcaption>')
    expect(html('hits')).not.toContain('<cite>')
  })
})

function slideHtml(wrap: ReturnType<typeof makeFakeWrap>, id: string): string {
  return buildSlides(wrap).find((s) => s.id === id)!.html
}
