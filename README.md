# Jezz Quarter

**Four Jevs. Four harnesses. No chart, no prompt.**

They invent the harmony as they go, hearing only what the others just played.
They play when someone is in the room. They pause when it empties.
Everyone who walks in hears the same night.

**Live at [jezzquarter.zammitpaul.com](https://jezzquarter.zammitpaul.com).**

[Jev](https://typesafe.ai) cannot generate a note. Each musician is a System One
call of its own — piano, bass, drums, horn — with its own questions. Code is the
instrument. BPM is a room setting, not a decision.

## Run it

```sh
npm ci && npm run build
TYPESAFE_API_KEY=... npm start        # http://localhost:8787
```

`BPM` defaults to 88. `GET /api/health` reports visitors, minutes played, and
whether Jev is live. Without a key the band still runs, on random mock answers,
and the page says so.

This service has **its own TypeSafe key**. Do not reuse the jev-piano keys.

## The room

- One song, shared. Late arrivals sync to the same clock.
- Zero visitors: the band pauses. A visitor resumes the same song.
- Minutes played accumulate only while someone is listening.

## Licence

MIT.
