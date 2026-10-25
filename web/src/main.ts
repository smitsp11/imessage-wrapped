import { NewerVersionError } from '../../src/errors'
import { unpackWrap } from '../../src/share/pack'
import { parseWrap } from '../../src/share/parseWrap'
import type { Wrap } from '../../src/types'
import { buildSlides, escapeHtml } from './slides'

const app = document.querySelector<HTMLElement>('#app')!
const REPO_URL = 'https://github.com/smitsp11/imessage-wrapped'

/** "#demo" loads the fake demo; any other "#..." is a packed wrap. Nothing is sent to a server. */
async function loadWrap(): Promise<Wrap | null> {
  const hash = location.hash.slice(1)
  if (!hash) return null
  // A fetched file is untrusted too: check its shape like a link's.
  if (hash === 'demo') return parseWrap(await (await fetch('/demo.json')).json())
  return unpackWrap(hash)
}

function showLanding(): void {
  document.onclick = null
  document.onkeydown = null
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
  document.onclick = null
  document.onkeydown = null
  app.innerHTML = `
    <section class="slide landing">
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(message)}</p>
      <a class="button" href="#">Home</a>
    </section>`
}

function showBroken(): void {
  showError('This link is broken', 'It may have been cut off when it was copied. Ask for it again.')
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
    app.innerHTML = `
      <div class="progress">${slides.map((_, i) => `<span class="${i <= index ? 'done' : ''}"></span>`).join('')}</div>
      <section class="slide" data-testid="slide" data-slide="${slide.id}">${slide.html}</section>`
  }
  // Like Instagram stories: tap the left third of the screen to go back, anywhere else to go forward.
  document.onclick = (event) => go(event.clientX < window.innerWidth / 3 ? -1 : 1)
  document.onkeydown = (event) => {
    if (event.key === 'ArrowRight') go(1)
    if (event.key === 'ArrowLeft') go(-1)
  }
  render()
}

async function start(): Promise<void> {
  try {
    const wrap = await loadWrap()
    if (wrap) play(wrap)
    else showLanding()
  } catch (error) {
    if (error instanceof NewerVersionError) showError('Newer version', error.message)
    else showBroken()
  }
}

window.addEventListener('hashchange', () => void start())
void start()
