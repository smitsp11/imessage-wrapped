# iMessage Wrapped

Spotify Wrapped for your iMessage group chats.

Pick a group chat and get a set of story slides: who talks the most, who ghosts, who starts every conversation, the chat's greatest hits (ranked by the reactions you all already gave), and awards like The Ghost, Night Owl and Double Texter. Then send your friends a link. They tap through it on any phone, no app needed.

Everything runs on your Mac. Nothing is uploaded, and there's no AI: every slide is a number counted from your messages.

There are two kinds of wrap:

- **Group wrap:** one group chat, with stats and awards for everyone in it.
- **Solo wrap:** your year across all your chats.

## Try the demo

The demo uses a made-up group chat, so it doesn't need access to your messages.

```bash
git clone https://github.com/smitsp11/imessage-wrapped.git
cd imessage-wrapped
npm install
npm run web:dev
```

Then open http://localhost:5173/#demo and tap through the slides (or use the arrow keys).

## Make your own

### What you need

- A Mac with Messages in iCloud turned on, so your full history is on the Mac
- [Node.js](https://nodejs.org) 22 or newer
- Full Disk Access for your terminal app (Terminal, iTerm, Warp or VS Code). macOS keeps your Messages database private, so you have to allow this once: **System Settings → Privacy & Security → Full Disk Access**, turn on your terminal app, then restart it.

### Steps

1. Start the viewer in one terminal window and leave it running:

   ```bash
   npm run web:dev
   ```

2. In a second window, find the chat you want:

   ```bash
   npm run wrapped -- list
   ```

   This shows your 30 busiest chats with an id, a message count and a name.

3. Build a wrap for that chat, using its id or part of its name:

   ```bash
   npm run wrapped -- group "Pasta Gang"
   npm run wrapped -- group 123 --year 2025
   ```

   It saves the wrap to `out/` and opens a preview in your browser.

   For your own year across every chat, use `npm run wrapped -- me` instead.

4. Make a link to send:

   ```bash
   npm run wrapped -- share out/pasta-gang-2026.json
   ```

   You'll see everything that will go into the link: names, awards, top words, signature words and quotes. You can remove any signature word or quote, then confirm, and it prints the link.

`--year` defaults to the current year.

### Sharing the link

Right now the link points at the viewer running on your own Mac (`http://localhost:5173`), so it only opens on your Mac. To send it to friends, host the `web` folder somewhere public:

```bash
npm run web:build      # builds the site into web/dist
```

Then upload `web/dist` to any static host (Vercel, Netlify, GitHub Pages…) and set `WRAPPED_SITE` to its address when you run `share`:

```bash
WRAPPED_SITE=https://your-site.example npm run wrapped -- share out/pasta-gang-2026.json
```

The site never stores anything. The wrap lives inside the link itself.

## Privacy

- **Your messages stay on your Mac.** The tool reads a temporary copy of the Messages database and deletes it when it's done, even if you press Ctrl-C or close the terminal.
- **No phone numbers or emails in a wrap.** People are stored as short ids. Anyone who isn't in your Contacts is shown masked, like `+1 ••• ••• 4821`.
- **The link is the wrap.** The data sits after the `#` in the link, and browsers never send that part to a server. Links are limited to 8 KB. If a wrap is too big, the least-reacted quotes are left out and you're told which.
- **You see everything before you share.** `share` lists everything that goes into the link, lets you remove signature words and quotes, and warns you about any quote that looks like it contains a phone number or email.
- **Solo wraps stay about you.** They name only you and the 5 people who sent the most messages in your chats. Everyone else is grouped as "Everyone else", and only your own words and quotes are used.
- **Saved wraps stay local.** The files in `out/` contain names and quotes. That folder is ignored by git, so it won't be committed by accident.

## The awards

Each award comes from one number. To keep it fair:

- Someone needs at least 50 messages to win anything.
- If two people tie for the top, nobody gets that award.
- The winner has to clear a minimum, so nobody becomes "The Ghost" for replying in 3 minutes.

| Award | Goes to | Minimum |
|---|---|---|
| Main Character | the biggest share of messages | none |
| The Ghost | the slowest typical reply | 1 hour, over at least 10 replies |
| The Starter | the most conversations started | 3 |
| The Comedian | the most laughs received per message | 1 laugh per 100 messages |
| Hype Man | the most reactions given | 3 |
| Night Owl | the biggest share of messages sent 12–5 AM | 10% |
| Double Texter | the most double texts | 3 |
| The Lurker | the smallest share of messages | under half of an even share, in a group of 3 or more |

Solo wraps don't give Main Character or The Lurker.

## Troubleshooting

- **"macOS blocked access to your Messages database"**: give your terminal app Full Disk Access (see above) and restart it.
- **Everyone shows up as masked numbers**: the tool couldn't read your Contacts. Full Disk Access usually fixes this too.
- **The preview page is blank**: start the viewer with `npm run web:dev` and run the command again.
- **"has no messages in that period"**: try another year with `--year`.
- **Something else went wrong**: run the command again with `DEBUG=1` in front to see the full error.

## Limits

- You need a Mac to make a wrap. Anyone can view one.
- If a chat moved between iMessage and SMS, each part counts as its own chat.
- In group chats with Android members, some carriers may cut very long links.
- In languages written without spaces (Chinese, Japanese, Thai), whole phrases count as one word.

## Development

```bash
npm test                          # unit and integration tests
npm run typecheck
npx playwright install chromium   # once
npm run e2e                       # browser tests, desktop and phone sizes
```

The tests use a generated fake Messages database with a scripted group chat whose answers are known in advance (for example, Jordan's typical reply is exactly 5 hours). No real messages are in this repo. Any command accepts `--db <path>` to read a different database file.

| Folder | What it does |
|---|---|
| `src/extract` | reads chats, messages and contact names from a copy of the databases |
| `src/stats` | the numbers: volume, timing, replies, conversation starters, reactions, greatest hits, words |
| `src/awards` | the award rules |
| `src/wrap` | puts everything into one wrap and replaces phone numbers with short ids |
| `src/share` | turns a wrap into a link and checks links before showing them |
| `src/cli.ts` | the `wrapped` commands |
| `web` | the slide viewer |
| `fixtures` | the fake database used by the tests and the demo |

More detail is in [`docs/design.md`](docs/design.md).

## License

MIT. See [`LICENSE`](LICENSE).
