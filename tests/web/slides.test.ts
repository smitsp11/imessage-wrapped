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

  it('keeps the silence sentence in group mode', () => {
    const html = buildSlides(makeFakeWrap('group')).find((s) => s.id === 'streak')!.html
    expect(html).toContain('Longest silence')
  })
})
