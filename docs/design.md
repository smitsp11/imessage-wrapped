# iMessage Wrapped: design

Status: approved Oct 25, 2026. v1 scope.

## What it is

A "Spotify Wrapped" for iMessage that runs on your own Mac. It reads the local Messages database and builds story-style slides of stats. It has two modes, and both use the same code:

- **Group wrap:** one group chat, with stats and awards for every member. You share it back to that group with a link.
- **Solo wrap:** you compared with everyone, across all your chats, for a chosen period (for example, 2026).

There's no AI in v1. Every slide is a number computed from the data, and every award comes from a stat.

## Why it's built this way

- **One Mac already has the whole group chat.** Every member's messages are on each member's Mac, so one person can make the wrap and friends only need to open a link.
- **Reactions are labels people already added.** Sorting messages by the number of Haha/Love reactions gives the group's "greatest hits" without any model.
- **Privacy stops at the chat.** A group wrap goes only to people who were in that chat. The raw message history never leaves the Mac.

## Constraints

- TypeScript (strict), Node 22+ (current better-sqlite3 requires it). No heavy framework.
- Read-only. The tool always works on a temporary copy of `chat.db` (plus its `-wal` and `-shm` files) and never on the live file.
- Message text never goes into logs. Generated wraps go to `out/`, which is gitignored.
- The repo, tests and demo contain no real message data. They all use a generated fake database.

## Structure

```
src/
  extract/
    messagesDb.ts       MessagesDb class: copies chat.db, opens it read-only (better-sqlite3), queries chats and messages
    contactBook.ts      ContactBook class: maps phone numbers and emails to names from the macOS AddressBook databases
    decodeBody.ts       pulls plain text out of the `attributedBody` blob when `text` is NULL
    appleTime.ts        converts Apple timestamps (ns since 2001-01-01) to Date
    normalize.ts        database rows → Message[]
  stats/                one file per stat group, all of them standalone functions over Message[]
    volume.ts  timing.ts  replies.ts  starters.ts  reactions.ts  words.ts  greatestHits.ts
  awards/
    rules.ts            Award rules: stats → Award[] (each award carries the number that earned it)
  wrap/
    buildWrap.ts        Message[] + mode → Wrap (the single JSON shape the slides render)
  share/
    pack.ts             Wrap → compressed, base64url string; and the reverse
  cli.ts                command-line entry point
  types.ts              Message, Person, Chat, Wrap, Award
web/                    Vite app: reads a Wrap (from a local file or the link) and plays the slides
fixtures/
  makeFakeDb.ts         builds a fake chat.db using Apple's real tables, with scripted conversations
tests/                  vitest, plus one Playwright test for the slides
```

Classes are used only where something holds state: `MessagesDb` (the database connection) and `ContactBook` (the name lookup). Everything else is a plain function.

## Data model

```ts
type Message = {
  id: number
  guid: string
  chatId: number
  senderId: string        // handle (phone/email), or "me"
  sentAt: Date
  text: string | null     // null for attachment-only messages
  isFromMe: boolean
  reactsToGuid: string | null // set when this row is a reaction (tapback)
  reactionType: 'love' | 'like' | 'dislike' | 'laugh' | 'emphasize' | 'question' | 'emoji' | null
  reactionEmoji: string | null // only for 'emoji' reactions
  hasAttachment: boolean
}
```

Reactions are rows in `message` with `associated_message_type` 2000–2006 (added) or 3000–3006 (removed). 2006 is a custom emoji reaction, and the emoji is in `associated_message_emoji`. `associated_message_guid` points to the target as `p:<part>/<guid>` or `bp:<guid>`; we strip the prefix. A removed reaction cancels the matching earlier one from the same sender. Type 2007 (sticker reactions) is ignored in v1.

## Stats (v1)

| Group | Stats |
|---|---|
| Volume | total messages; each person's share; attachments sent |
| Timing | heatmap by month, weekday and hour; longest daily streak; longest silence; share sent 12–5 AM |
| Replies | median reply time per person (only replies within 12 h count) |
| Starters | who sends the first message after a gap of 6 h or more; double texts (2+ in a row with no reply for 10 min) |
| Reactions | given and received per person and type; most-reacted messages (greatest hits) |
| Words | top emoji; top words (stopwords removed); each person's signature word (most over-used compared with the rest of the group, by log-odds); longest message |

Solo mode uses the same functions. "Members" become "me" and "everyone else," and it adds top people and top group chats ranked by volume.

## Awards

Each award comes from one stat and needs a minimum sample (at least 50 messages from that person in the period) so nobody wins on a handful of texts.

| Award | Rule |
|---|---|
| Main Character | largest share of messages |
| The Ghost | slowest median reply |
| The Starter | most conversation starts |
| The Comedian | most Haha reactions received per message |
| Hype Man | most reactions given |
| Night Owl | highest share sent 12–5 AM |
| Double Texter | most double texts |
| The Lurker | smallest share of messages (among people who qualify) |

## Sharing

The link carries the wrap itself: `https://<site>/#<packed wrap>`. People appear in a wrap as short ids (`me`, `p1`, `p2`…) with display names, never as phone numbers or emails.

1. `wrapped share <file>` prints exactly what will go into the link: names, numbers and each quote.
2. You confirm (y/n) and can drop any quote first.
3. The wrap is compressed (deflate via `CompressionStream`, which both Node and browsers have) and base64url-encoded into the part after `#`.
4. The static site reads the `#` part in the browser. Browsers never send it to a server, so the host stores nothing.

The site is a static Vite build on Vercel. There's no backend and no database.

A link may hold at most 8 KB after the `#`. If a wrap is bigger, the CLI drops quotes (lowest reaction count first) until it fits and tells you what was dropped.

## Commands

```
wrapped list                          chats with message counts and members
wrapped group <chatId> [--year 2026]  build a group wrap → out/<name>.json, open a local preview
wrapped me [--year 2026]              build a solo wrap → out/me-2026.json, open a local preview
wrapped share <out/file.json>         review → print the share link
wrapped demo [--out file]             build a wrap from the fake database (no Full Disk Access needed)
```

## Errors

| Situation | Behaviour |
|---|---|
| No Full Disk Access | explain how to grant it to the terminal app, then exit with code 1 |
| chat.db missing (not a Mac / never signed in) | clear message, exit 1 |
| Handle with no contact | show the number masked (`+1 ••• ••• 4821`) |
| `attributedBody` can't be decoded | skip the message, count it, report only the count |
| Chat ID not found | list the closest matches by name |
| Period with no messages | say so; don't render empty slides |

## Testing

- **Fake database:** `fixtures/makeFakeDb.ts` builds a `chat.db` with Apple's real table and column names (`message`, `handle`, `chat`, `chat_message_join`, `chat_handle_join`) and scripted fake friends with known answers. Example: "Alex replies in a median 4 minutes," "Sam laughs at 30 messages." It's generated at test time and never committed.
- **Messages that count:** only rows with `item_type = 0` (real messages, not "X named the conversation" events), and only rows with text or an attachment.
- **Unit tests:** every stat and award function is tested against hand-built `Message[]` inputs with exact expected values.
- **Integration test:** fake db → `MessagesDb` → `buildWrap` → expected Wrap.
- **Share round trip:** `unpack(pack(wrap))` deep-equals `wrap`, plus the 8 KB trimming.
- **Slides:** one Playwright test opens the demo link and checks that the first and last slides render and that tapping advances.

## Out of scope for v1

AI captions or summaries, video export, Android/WhatsApp, other people running it on their own Macs (works, but not a supported flow), and editing the wrap in the browser.

## Open questions (after v1, think through from first principles)

v1 is the simplest flow: `wrapped list` ranks your chats by activity, you pick one, build it, and share the link. These questions are deliberately left open:

- **One wrap per chat, or one place for all of them?** Someone with 5 active group chats shouldn't have to run the tool 5 times. One idea: "build all" finds every chat with steady activity (e.g. at least weekly) and makes a local home page with one card per chat, and you choose which ones to send.
- **How does it get sent?** v1: copy the link and paste it into the chat. Later: open Messages with the link already filled in, but you always press send yourself. Never auto-send.
- **Who makes it?** Any member with a Mac can make the same wrap, because everyone has the same messages. Differences come from when each person joined, deleted messages, or whether Messages in iCloud has synced full history to their Mac.
- **Viewers pick themselves.** When a friend opens the link, they tap their name and get their own slide first (their award, their stats).
- **People without a Mac.**
  - *Viewing* needs nothing: the link opens in any phone browser.
  - *Making* needs the Messages database. iPhones don't expose it directly. A later path is an unencrypted iPhone backup on Windows/Mac (it holds the same database as `sms.db`); Android would need an SMS export app.
  - The landing page must say clearly: "Making a wrap needs a Mac with Messages in iCloud turned on. Viewing works anywhere."

## Build order (one commit each)

1. Scaffold: TS config, vitest, typecheck, .gitignore
2. Fake database generator
3. Extract: MessagesDb, ContactBook, decodeBody, normalize
4. Stats, one commit per group
5. Awards
6. buildWrap + CLI
7. Slides app
8. Share pack/unpack + link page
9. Demo deploy (fake data)
10. README: what, why, architecture, privacy, how to run, and how AI was used to build it
