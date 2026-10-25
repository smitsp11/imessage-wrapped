import { NewerVersionError } from '../../src/errors'
import { unpackWrap } from '../../src/share/pack'
import { parseWrap } from '../../src/share/parseWrap'
import type { Wrap } from '../../src/types'
import { buildSlides, escapeHtml } from './slides'

const app = document.querySelector<HTMLElement>('#app')!
const REPO_URL = 'https://github.com/smitsp11/imessage-wrapped'

class DemoLoadError extends Error {}

/** "#demo" loads the fake demo; any other "#..." is a packed wrap. Nothing is sent to a server. */
async function loadWrap(): Promise<Wrap | null> {
  const hash = location.hash.slice(1)
  if (!hash) return null
  if (hash === 'demo') return loadDemo()
  return unpackWrap(hash)
}

async function loadDemo(): Promise<Wrap> {
  try {
    const response = await fetch(import.meta.env.BASE_URL + 'demo.json')
    if (!response.ok) throw new DemoLoadError()
    // A fetched file is untrusted too: check its shape like a link's.
    return parseWrap(await response.json())
  } catch {
    throw new DemoLoadError()
  }
}

/** Leaves story mode: no taps or keys until a wrap is playing again. */
function stopPlaying(): void {
  document.onclick = null
  document.onkeydown = null
}

function showLanding(): void {
  stopPlaying()
  app.innerHTML = `
    <section class="slide landing">
      <p class="kicker">iMessage Wrapped</p>
      <h1>Spotify Wrapped, for your group chats</h1>
      <p>Viewing a wrap works on any phone. Making one needs a Mac with Messages in iCloud turned on.</p>
      <a class="button" href="#demo">See a demo</a>
      <a class="link" href="${REPO_URL}">Make your own</a>
    </section>`
}

function showError(title: string, message: string): void {
  stopPlaying()
  app.innerHTML = `
    <section class="slide landing">
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(message)}</p>
      <a class="button" href="#">Home</a>
    </section>`
}

function play(wrap: Wrap): void {
  const slides = buildSlides(wrap)
  let index = 0
  const go = (step: number) => {
    index = Math.min(slides.length - 1, Math.max(0, index + step))
    render()
  }
  const render = () => {
    const slide = slides[index]!
    const links =
      slide.id === 'outro'
        ? `<a class="button" href="#" data-restart>Watch again</a><a class="link" href="${REPO_URL}">Make your own</a>`
        : ''
    app.innerHTML = `
      <div class="progress">${slides.map((_, i) => `<span class="${i <= index ? 'done' : ''}"></span>`).join('')}</div>
      <section class="slide" data-testid="slide" data-slide="${slide.id}">${slide.html}${links}</section>`
  }
  // Like Instagram stories: tap the left third of the card to go back, anywhere else to go forward.
  document.onclick = (event) => {
    const target = event.target as Element
    if (target.closest('[data-restart]')) {
      event.preventDefault()
      index = 0
      render()
      return
    }
    if (target.closest('a')) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    if (window.getSelection()?.toString()) return
    const card = app.getBoundingClientRect()
    go(event.clientX < card.left + card.width / 3 ? -1 : 1)
  }
  document.onkeydown = (event) => {
    if (event.key === 'ArrowRight') go(1)
    if (event.key === 'ArrowLeft') go(-1)
    if (event.key === 'Escape') location.hash = ''
    // Space and Enter on a focused link should still activate the link.
    if ((event.key === ' ' || event.key === 'Enter') && !(event.target as Element).closest('a')) {
      event.preventDefault()
      go(1)
    }
  }
  render()
}

/** Only the latest call may draw: a slow load from an earlier hash must not overwrite a newer page. */
let loadId = 0

async function start(): Promise<void> {
  const token = ++loadId
  try {
    const wrap = await loadWrap()
    if (token !== loadId) return
    if (wrap) play(wrap)
    else showLanding()
  } catch (error) {
    if (token !== loadId) return
    if (error instanceof NewerVersionError) showError('Newer version', `${error.message} Try refreshing the page.`)
    else if (error instanceof DemoLoadError) showError('Demo unavailable', "Couldn't load the demo. Try again.")
    else showError('This link is broken', 'It may have been cut off when it was copied. Ask for it again.')
  }
}

window.addEventListener('hashchange', () => void start())
void start()
