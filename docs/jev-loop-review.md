# Jev loop review — 19 September 2026

The musicians must remain independent. No musician gets another musician's
next-bar answers, and no conductor chooses their harmony. The drummer owns the
room's tempo. These are product requirements, not problems to optimize away.

This release changes the interface and local monitoring. It exposes more decision
metadata but does not change the musical questions, sampling or rendering.

## What runs today

`server/room.ts` starts four concurrent `ask()` calls for each four-beat bar.
Each gets its own instrument identity and previous gesture, up to eight recent
bars containing all players' gestures and note summaries, repetition/rest counts,
the previous tempo, and recent cheer/boo feedback.

`server/jev.ts` sends `POST https://api.typesafe.ai/v1/systemone` with exactly
`{ model, state, questions }`. The default model is `jev-latest`. The key stays
on the server. There is no API temperature parameter in this integration.

| Player | Choice                              | Score          | Noul               | Questions |
| ------ | ----------------------------------- | -------------- | ------------------ | --------- |
| Piano  | root, quality, voicing, timing      | density        | rest               | 6         |
| Bass   | feel, motion, target, root          | touch/energy   | wander             | 6         |
| Drums  | kit, kick, snare                    | tempo, density | tempo change, fill | 7         |
| Horn   | colour, phrase shape, landing pitch | register       | rest               | 5         |

That is four requests and 24 questions per bar. Each musician's questions are
batched. TypeSafe also evaluates those questions independently within a request:
the piano's voicing question does not see its root answer from that same request.
Speculative answers are used only where relevant, e.g. a resting horn produces no
notes regardless of its other answers.

After the requests return, `shared/sample.ts` and each `assemble*()` function
translate the answers into a musical gesture:

- **Choice:** sample the returned distribution. Most choices use a local
  temperature of 1.15; piano and bass roots use 1.20. This flattens the
  distribution slightly. The played choice can differ from Jev's top choice.
- **Score:** sample a discrete level for density, touch and register. For tempo,
  interpolate the returned expected level onto code-owned anchors of 56, 88,
  124, 168 and 216 BPM. This is our mapping, not a precise BPM inferred by Jev.
- **Noul:** compare its yes probability with a seeded random draw. This is our
  stochastic action policy, not a TypeSafe requirement. On the opening bar the
  drummer establishes tempo regardless of the tempo-change Noul.

`shared/render.ts` turns gestures into notes. Piano voicings and attack patterns,
bass lines, drum rhythms and horn contours are code-defined techniques. The
renderer retains previous voicing, bass note, horn note/motif and heard harmony.
Bass and horn use previously committed harmony, not the new pianist's choices.
`src/audio/kit.ts` synthesizes the resulting notes in each visitor's browser.
Jev receives symbolic descriptions; it does not listen to actual audio.

All four calls must finish before the bar is assembled. The drummer's result
sets its BPM, and all clients schedule the same notes on the same bar boundary.
The next request starts up to 1.6 seconds before the current bar ends. Late calls
push the next bar start to at least 250 ms after the current room clock.
`stats.ms` sums the four call durations; it is not parallel wall-clock latency.

There is a listening-fidelity limitation: history contains the whole previously
committed bar even while its last notes may not yet have sounded. No upcoming
bar's answers are shared between musicians, but this is still more knowledge
than a musician has from hearing alone. A future refinement should distinguish
committed notes from already-sounded notes and give each player only the latter.

## What the documentation means for this quartet

The review covered the 109 pages listed by the documentation index on this date:
concepts, primitive guides, patterns, HTTP API, models/jaggedness, Python and
JavaScript SDK references, demos and 18 cookbooks. General guidance and every
page's purpose were reviewed; unrelated sample applications were not executed.
The downloaded reference snapshot is local, outside this repository.

- [Primitives](https://docs.typesafe.ai/primitives): question IDs are application
  bookkeeping, not model context. Each instruction must name its actual task.
  Answers in one request cannot condition on one another. Batch independent
  questions, and only chain when new evidence/options truly depend on an answer.
- [Choice](https://docs.typesafe.ai/primitives/choice): the returned `choice` is
  the highest-probability option. Application sampling is an additional policy.
  Describe useful musical alternatives clearly; uncertainty is not inherently a
  request for more randomness.
- [Score](https://docs.typesafe.ai/primitives/score): levels are ordered,
  descriptive and zero-indexed. `score` is their probability-weighted mean.
  Distinct distributions can have the same mean; preserve their probabilities.
- [Noul](https://docs.typesafe.ai/primitives/noul): the value is probability of
  yes, not intensity. It has no separate confidence field. Our per-bar coin toss
  can trigger a change even when the answer leans toward no.
- [Confidence](https://docs.typesafe.ai/confidence): confidence summarizes the
  distribution's shape and is not the probability of a sampled alternative.
  The debug mixer displays it separately from option probabilities.
- [State](https://docs.typesafe.ai/concepts/state) and
  [building guidance](https://docs.typesafe.ai/concepts/how-to-build-with-system-one):
  keep state relevant and named; make questions short and atomic. Put counting,
  timing and exact pitch arithmetic in code. Current numeric MIDI sets lose the
  order of a melody; named notes, intervals and phrase summaries would give Jev
  more useful listening evidence.
- [Jev 1.13 limitations](https://docs.typesafe.ai/model-jaggedness/jev-1.13):
  do not ask for precision arithmetic, imply unstated conditions, or treat Score
  interpolation as an exact numeric estimate. The current tempo mapping is a
  musical policy that needs listening tests, not a calibrated BPM measurement.
- [Models](https://docs.typesafe.ai/models): `jev-latest` is an alias; record the
  returned version and pin one during comparative musical tests. Jev is text-only.
- [HTTP API](https://docs.typesafe.ai/api) and
  [JS retry policy](https://docs.typesafe.ai/sdk/javascript/api/interfaces/RetryPolicy):
  the current hand-written client retries 429/529 three times with backoff but
  does not honor Retry-After or retry other transient errors. Its 20-second
  per-attempt timeout is much longer than a bar. A musical deadline and explicit
  recovery policy deserve a separate change.

## Next musical experiments, preserving independence

1. Give each player a compact memory of its own phrase: ordered notes, contour,
   duration, where it left space, and what actually sounded from the others.
   Develop, answer, extend or break that phrase; do not silently resample every
   musical dimension from scratch every bar.
2. Make the drummer's tempo decision about continuing or deliberately changing
   a passage. Compare a direct Noul decision with today's repeated sampling on
   recorded states. Keep the drummer in charge; do not install a fixed BPM.
3. Compare direct Choice, unmodified distribution sampling and the current
   temperature settings with identical recorded states and seeds. Let listening
   and observable repetition/tempo metrics decide. Keep room for disagreement,
   silence and going outside.
4. Keep each question understandable alone. If two answers within one player's
   technique must agree, compose them in code or ask about concrete coherent
   alternatives. Never solve it by revealing another player's future bar.
5. Improve instrumental phrasing and timbre separately from Jev. A good decision
   can still sound mechanical through a limited rhythm template or synthesizer.

The local `?debug` mixer makes those listening comparisons possible now. It
changes channel output gains after each instrument's reverb; it never changes
questions, feedback, note history, room time or another visitor's mix.
