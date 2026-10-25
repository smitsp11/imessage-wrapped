# iMessage Wrapped

[![CI](https://github.com/smitsp11/imessage-wrapped/actions/workflows/ci.yml/badge.svg)](https://github.com/smitsp11/imessage-wrapped/actions/workflows/ci.yml)

Spotify Wrapped for your iMessage group chats. It runs on your Mac, reads your Messages database, and turns a chat into story slides: who talks the most, who ghosts, who starts the conversations, the group's greatest hits (ranked by the reactions people already gave), and awards backed by real numbers. There is no AI in v1. Every slide is a number computed from the data.

It has two modes that share the same code: a **group wrap** (one chat, stats for every member) and a **solo wrap** (you, across all your chats, for a year).

## Demo

The demo is a fake group chat. The site isn't deployed yet, so run it locally:

```bash
npm install
npm run web:dev        # then open http://localhost:5173/#demo
```

or `npm run wrapped -- demo`, which builds the same fake wrap and opens it in your browser (start `npm run web:dev` first if the page is blank). Neither needs Full Disk Access.

## Why it works this way

- **One Mac already has the whole group chat.** Every member's messages are on your Mac, so your friends install nothing. They open a link.
- **Reactions are free labels.** The group already voted on what was funny. Ranking messages by reactions finds the greatest hits without a model.
- **The link is the wrap.** The stats are compressed into the part of the URL after `#`. Browsers never send that part to a server, so there is no backend and nothing is stored.

## Requirements

- A Mac with Messages in iCloud turned on
- Node 22 or newer (`.nvmrc` is set to 22)
- Full Disk Access for your terminal: System Settings → Privacy & Security → Full Disk Access

Viewing a wrap works on any device with a browser.

## Use it

```bash
npm install
npm run wrapped -- list                              # your chats, busiest first
npm run wrapped -- group <chat id or name> [--year 2026]
npm run wrapped -- me [--year 2026]                  # solo wrap across all your chats
npm run wrapped -- share out/<file>.json             # review it, then get a link to send
npm run wrapped -- demo [--out file.json]            # fake group chat, no access needed
```

`--year` defaults to this year. `--db <path>` points any command at a different `chat.db` (used for testing). Wraps are saved to `out/`, which is gitignored because they contain names and quotes. Set `DEBUG=1` to see full error details instead of a one-line message.

The preview and the links point at `http://localhost:5173` unless you set `WRAPPED_SITE`.

## Privacy

- It reads a temporary copy of `chat.db` and deletes the copy when it finishes, including on Ctrl-C or a closed terminal. Queries run only on the copy.
- Phone numbers and emails never enter a wrap. People become `me`, `p1`, `p2`…, and a contact with no name is shown masked (`+1 ••• ••• 4821`).
- Solo wraps keep you and the 5 contacts who sent the most messages. Everyone else is one person, "Everyone else". Solo word stats and quotes use only your own messages.
- The share link carries the wrap after `#`, which browsers never send to a server. Links are capped at 8 KB (if a wrap is bigger, the lowest-ranked quotes are dropped and listed), and the viewer validates a link's size, characters and shape before showing anything.
- `share` prints everything that will go into the link and lets you drop any signature word or quote first. It warns on quotes that look like they contain a phone number or email. You confirm before a link is made.
- Message text is never logged. The only place it is printed is that `share` review.

## Awards

Each award comes from one stat, compared unrounded. A person needs at least 50 messages to be considered, a tie for the best number means no award, and the winning number must clear a floor.

| Award | Goes to | Floor |
|---|---|---|
| Main Character | largest share of messages | none |
| The Ghost | slowest median reply | at least 60 min, and at least 10 replies |
| The Starter | most conversation starts | 3 |
| The Comedian | most Haha reactions received per message | 1 per 100 messages |
| Hype Man | most reactions given | 3 |
| Night Owl | highest share of messages sent 12–5 AM | 10% |
| Double Texter | most double texts | 3 |
| The Lurker | smallest share of messages | under half of an even split, and at least 3 people qualify |

Solo wraps skip Main Character and The Lurker. "Everyone else" is a sum of many people, so it is left out before ranking and never wins; the best real contact gets the award instead.

## How it's built

```
chat.db copy ─▶ extract ─▶ Message[] ─▶ stats + awards ─▶ wrap ─▶ Wrap JSON ─▶ share ─▶ link
                                                                      │                   │
                                                                      └──────▶ web (slides) ◀┘
```

| Folder | What it does |
|---|---|
| `src/extract` | copies `chat.db`, reads chats and messages, decodes `attributedBody`, resolves reactions and removals, looks up contact names |
| `src/stats` | one file per stat group: volume, timing, replies, starters, reactions, greatest hits, words |
| `src/awards` | the award rules above |
| `src/wrap` | builds the single `Wrap` object and replaces handles with short ids |
| `src/share` | `pack` compresses a wrap into a URL-safe string and back; `parseWrap` validates untrusted data |
| `src/cli.ts`, `src/cliHelpers.ts` | the commands and their input checking |
| `web` | a plain Vite page that plays the slides from a link or `#demo` |
| `fixtures` | a generated fake `chat.db` with scripted friends |

Design notes are in `docs/design.md`.

## Tests

```bash
npm test            # unit + integration tests (vitest, runs in UTC)
npx playwright install chromium   # once, for the browser tests
npm run e2e         # the slides in a real browser (Playwright, desktop + phone)
npm run typecheck
```

The integration tests build a fake `chat.db` with Apple's real table and column names and a scripted group chat where every answer is known in advance (for example, Jordan's median reply is exactly 5 hours). No real messages are in this repo, and the fake database is generated at test time.

## How I built it

I designed this with Claude Code, working out the idea from first principles and writing the spec in `docs/design.md`. Claude wrote most of the code from a test-first plan, and every task was reviewed twice. I made the product decisions: group-chat-first, no AI in v1, link-as-data sharing, and the privacy rules above.

## Limits (v1)

- Only a Mac can make wraps. Viewing works anywhere.
- A chat split across iMessage and SMS counts as separate chats.
- Group chats with mixed iPhone and Android members (MMS/RCS) may cut very long links.
- Languages written without spaces (Chinese, Japanese, Thai) count whole phrases as words.
- No AI captions.

## License

MIT. See `LICENSE`.
