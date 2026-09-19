# Jezz Quarter

**Four minds. One room.**

A live, freely improvising jazz quartet, seen from a candlelit table.
Four independent [Jevs](https://typesafe.ai) play piano, bass, drums and horn.
No chart, no prompt, no prescribed chord changes. The drummer sets the tempo.
Everyone in the room hears the same performance.

**[Come in: jezzquarter.zammitpaul.com](https://jezzquarter.zammitpaul.com)**

- Sound starts muted. The top-right button turns your audio on or off; the band,
  other listeners, and the animations keep going.
- Alone, the audience is empty. A second listener brings in one guest; a third
  brings another. They walk out when the room thins. The illustration caps at
  two other guests, while the counter shows the full audience.
- Cheer or boo once every 30 seconds. The musicians hear those reactions as
  evidence about the last few bars, and each chooses how to respond.
- Empty room: the performance clock pauses. Someone arriving resumes it.
- Minutes are shared room time, counted once, not multiplied by the audience.

## Local debug mixer

Open [the backstage mixer](https://jezzquarter.zammitpaul.com/?debug) by adding
`?debug` to the URL. Each instrument has mute, solo, and level controls. You can
solo several players together. Muting includes their reverb tails. These controls
change only this browser's output: the band, shared clock, other listeners, and
Jev history keep going. Use Reset mix to hear all four again.

Each channel also exposes Choice/Score/Noul decisions, original probabilities,
confidence where supplied, and the result our code actually selected. A sampled
result can differ from Jev's top Choice. All this is inspection, not a room-wide
parameter editor. See [the loop review](docs/jev-loop-review.md).

## The musicians

Each musician gets its own TypeSafe request containing its previous gesture,
recent choices and sounded notes from all four players, repetition/rest counts,
and recent audience feedback. They cannot inspect the others' next answers.
Every harness uses all three primitives: **Choice**, **Noul**, and **Score**.

Code turns musical gestures into notes: voicing families, walking lines, swing,
brushes, fills and melodic shapes. It does not choose a fixed progression or
force instruments to agree. The drummer chooses tempo; each bar carries its own
BPM so all listeners schedule the change on the same boundary.

See [design and sources](docs/musicians.md) for the TypeSafe contract and the
Levine passages that informed listening, comping and voicing behavior.

## Run

Requires Node 26 (native TypeScript support).

```sh
npm ci
npm run build
TYPESAFE_API_KEY=... npm start   # http://localhost:8787
npm test
npm run lint
```

Without a key this runs a clearly labelled random rehearsal. This service has
its **own TypeSafe key**; do not reuse the jev-piano keys.

`BPM` (default 88) is only a pre-performance fallback; the first drummer decision
sets the actual tempo. `DAILY_USD_CAP` defaults to 3. `STATS_FILE` defaults to
`./data/stats.json`. `PORT` defaults to 8787. `/api/health` reports the live room.

`npm run dev` runs Vite, proxying API/WebSocket traffic to port 8787.
Deployment uses the existing Kamal setup; see `config/deploy.example.yml`.
Never commit deployment secrets.

Anonymous signed browser cookies group tabs into one listener and enforce one
reaction cooldown across reconnects. They are not accounts or permanent person
identities. Clearing cookies creates a new visitor. Only two decorative audience
characters are drawn, however many people join.

## Counter migration

The original counter re-added elapsed session time on every pause/resume. Since
that inflated historical total cannot be reconstructed, version 2 starts a new
measured counter and preserves the old record as `legacyStats`. `countingSince`
records when the corrected measurement began. New totals persist atomically.

## Artwork

The club and spectator sprites were generated with ImageGen from the supplied
pixel-art direction. Editable source PNGs live in `art-source/`; compressed
runtime artwork lives in `public/art/`. The stage uses restrained note-driven
WebGL motion; without WebGL or with reduced motion it remains a still image.
Spectator entry, sitting and exit are independent sprite animations.

## Licence

MIT.
