import fs from 'node:fs'
import { expect, test } from '@playwright/test'
import { MAX_LINK_CHARS, packWrap } from '../src/share/pack'
import type { Wrap } from '../src/types'

const demo = () => JSON.parse(fs.readFileSync('web/public/demo.json', 'utf8')) as Wrap

async function tapUntilOutro(page: import('@playwright/test').Page): Promise<void> {
  const slide = page.getByTestId('slide')
  for (let i = 0; i < 40 && (await slide.getAttribute('data-slide')) !== 'outro'; i++) {
    await page.mouse.click(1000, 360) // right two-thirds = next
  }
  await expect(slide).toHaveAttribute('data-slide', 'outro')
}

test('the landing page explains who can make a wrap and opens the demo', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Making one needs a Mac')).toBeVisible()
  await page.getByRole('link', { name: 'See a demo' }).click()
  await expect(page.getByTestId('slide')).toHaveAttribute('data-slide', 'intro')
  await tapUntilOutro(page)
  await page.mouse.click(100, 360) // left third = back
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
