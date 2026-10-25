import fs from 'node:fs'
import { expect, test } from '@playwright/test'
import { MAX_LINK_CHARS, packWrap } from '../src/share/pack'
import type { Wrap } from '../src/types'

const demo = () => JSON.parse(fs.readFileSync('web/public/demo.json', 'utf8')) as Wrap

type Page = import('@playwright/test').Page

/** A point inside the slide card: `x` is a fraction of its width. Taps are measured against the card, not the window. */
async function tap(page: Page, x: number): Promise<void> {
  const box = (await page.getByTestId('slide').boundingBox())!
  await page.mouse.click(box.x + box.width * x, box.y + box.height / 2)
}

const currentSlide = (page: Page) => page.getByTestId('slide').getAttribute('data-slide')

async function tapUntilOutro(page: Page): Promise<void> {
  const slide = page.getByTestId('slide')
  for (let i = 0; i < 40 && (await currentSlide(page)) !== 'outro'; i++) await tap(page, 0.8) // right = next
  await expect(slide).toHaveAttribute('data-slide', 'outro')
}

test('the landing page explains who can make a wrap and opens the demo', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Making one needs a Mac')).toBeVisible()
  await page.getByRole('link', { name: 'See a demo' }).click()
  await expect(page.getByTestId('slide')).toHaveAttribute('data-slide', 'intro')
  await tap(page, 0.8)
  const second = await currentSlide(page)
  await tap(page, 0.8)
  const third = await currentSlide(page)
  expect(third).not.toBe(second)
  await tap(page, 0.15) // left third of the card = back
  await expect(page.getByTestId('slide')).toHaveAttribute('data-slide', second!)
  await tapUntilOutro(page)
  await tap(page, 0.15)
  await expect(page.getByTestId('slide')).not.toHaveAttribute('data-slide', 'outro')
})

test('a packed link plays the wrap inside it', async ({ page }) => {
  await page.goto(`/#${await packWrap({ ...demo(), title: 'Linked Chat' })}`)
  await expect(page.getByRole('heading', { name: 'Linked Chat' })).toBeVisible()
  await tapUntilOutro(page)
})

test('a link ending in "-" or "_" still plays', async ({ page }) => {
  // Vary the title until the packed link ends in one of the URL-safe characters. Deterministic: same titles every run.
  let title = ''
  let packed = ''
  for (let i = 0; i < 500 && !/[-_]$/.test(packed); i++) {
    title = `Linked Chat ${i}`
    packed = await packWrap({ ...demo(), title })
  }
  expect(packed).toMatch(/[-_]$/)
  await page.goto(`/#${packed}`)
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await tapUntilOutro(page)
})

test('a broken link says so', async ({ page }) => {
  await page.goto('/#not-a-real-wrap')
  await expect(page.getByText('This link is broken')).toBeVisible()
})

test('a link with characters changed in the middle is broken', async ({ page }) => {
  const packed = await packWrap({ ...demo(), title: 'Linked Chat' })
  const mid = Math.floor(packed.length / 2)
  const swapped = packed.slice(mid, mid + 6).replace(/./g, (c) => (c === 'A' ? 'B' : 'A'))
  await page.goto(`/#${packed.slice(0, mid)}${swapped}${packed.slice(mid + 6)}`)
  await expect(page.getByText('This link is broken')).toBeVisible()
})

test('an over-long link is broken', async ({ page }) => {
  await page.goto(`/#${'A'.repeat(MAX_LINK_CHARS + 1)}`)
  await expect(page.getByText('This link is broken')).toBeVisible()
})

test('a wrap from a newer version says so', async ({ page }) => {
  await page.goto(`/#${await packWrap({ ...demo(), version: 2 } as unknown as Wrap)}`)
  await expect(page.getByText('made by a newer version')).toBeVisible()
})

test('arrow keys and Space move through the slides and stop at both ends', async ({ page }) => {
  await page.goto('/#demo')
  const slide = page.getByTestId('slide')
  await expect(slide).toHaveAttribute('data-slide', 'intro')
  await page.keyboard.press('ArrowLeft')
  await expect(slide).toHaveAttribute('data-slide', 'intro')
  await page.keyboard.press('ArrowRight')
  const second = await currentSlide(page)
  expect(second).not.toBe('intro')
  await page.keyboard.press('Space')
  expect(await currentSlide(page)).not.toBe(second)
  await page.keyboard.press('ArrowLeft')
  await expect(slide).toHaveAttribute('data-slide', second!)
  for (let i = 0; i < 40; i++) await page.keyboard.press('ArrowRight')
  await expect(slide).toHaveAttribute('data-slide', 'outro')
  await page.keyboard.press('ArrowRight')
  await expect(slide).toHaveAttribute('data-slide', 'outro')
})

test('Escape goes home, and taps there do nothing', async ({ page }) => {
  await page.goto('/#demo')
  await expect(page.getByTestId('slide')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByText('Making one needs a Mac')).toBeVisible()
  await page.mouse.click(300, 300)
  await page.keyboard.press('ArrowRight')
  await expect(page.getByText('Making one needs a Mac')).toBeVisible()
  await expect(page.getByTestId('slide')).toHaveCount(0)
})

test('the outro can watch again', async ({ page }) => {
  await page.goto('/#demo')
  await tapUntilOutro(page)
  await expect(page.getByRole('link', { name: 'Make your own' })).toBeVisible()
  await page.getByRole('link', { name: 'Watch again' }).click()
  await expect(page.getByTestId('slide')).toHaveAttribute('data-slide', 'intro')
})

test('a failed demo fetch says the demo could not load, not that a link is broken', async ({ page }) => {
  await page.route('**/demo.json', (route) => route.fulfill({ status: 500, body: 'nope' }))
  await page.goto('/#demo')
  await expect(page.getByText("Couldn't load the demo. Try again.")).toBeVisible()
  await expect(page.getByText('This link is broken')).toHaveCount(0)
})

test('long names and quotes never overflow a slide', async ({ page }) => {
  const wrap = demo()
  const longName = 'W'.repeat(24)
  const quote = 'this is a very long quote that keeps going and going '.repeat(3).slice(0, 150)
  const long: Wrap = {
    ...wrap,
    people: { ...wrap.people, p1: longName, p2: longName.toLowerCase() },
    greatestHits: [1, 2, 3].map((n) => ({
      senderId: 'p1',
      text: `${n} ${quote}`,
      sentAt: '2026-01-12T20:00:00.000Z',
      reactions: 9 - n,
      laughs: 1,
    })),
  }
  await page.goto(`/#${await packWrap(long)}`)
  const slide = page.getByTestId('slide')
  let sawHits = false
  for (let i = 0; i < 40; i++) {
    const overflow = await slide.evaluate((el) => el.scrollWidth - el.clientWidth)
    expect(overflow, `slide ${i} overflows sideways`).toBeLessThanOrEqual(0)
    const id = await currentSlide(page)
    if (id === 'hits') {
      sawHits = true
      await expect(page.getByRole('heading', { name: 'Greatest hits' })).toBeVisible()
    }
    if (id === 'outro') break
    await page.keyboard.press('ArrowRight')
  }
  expect(sawHits).toBe(true)
})
