# Listening, not a lead sheet

The quartet has four independent TypeSafe calls per bar. Each call has a
musician-specific `self`, the same recent ensemble evidence, and audience
reactions. No call sees the other three answers for the new bar. There is no
central musical planner, tune list, chord chart, root whitelist or progression.
The drummer alone chooses the room tempo. Code spells notes and keeps time.

## TypeSafe contract (checked 19 September 2026)

- [Primitives](https://docs.typesafe.ai/primitives): questions are independent,
  even within a request. A question ID is not sent to the model, so each question
  explicitly states its musician and the next-gesture decision.
- [Choice](https://docs.typesafe.ai/primitives/choice): use a distribution over
  named musical gestures. Sample its nonzero support with a small temperature
  adjustment; do not discard quieter alternatives with a probability floor.
- [Noul](https://docs.typesafe.ai/primitives/noul): a probability of yes, used for
  rests, independent bass movement, fills and deliberate tempo changes. Sampling
  supplies variation without turning uncertainty into a permanent rest.
- [Score](https://docs.typesafe.ai/primitives/score): ordered descriptive levels,
  zero-indexed. Density, register and articulation select levels from their
  distributions. Tempo uses the expected score, interpolating between five
  playable pace anchors (56, 88, 124, 168, 216 BPM). Noul decides whether to
  change tempo; the opening bar always establishes it.
- [State](https://docs.typesafe.ai/concepts/state): send relevant structured
  evidence. We supply the last eight bars, actual note/rhythm summaries,
  repetition and silence streaks, and the reacted-to passage.

A cheer approves the preceding passage; a boo asks for a fresh response. Neither
sets a chord or directly rewrites a musician's answer. Reactions are associated
with the currently audible bar and its preceding three bars, expire after six
subsequent bars or sixty seconds, and are limited to one per browser per thirty
seconds. All four musicians receive them independently.

## Levine inspiration

Read from Mark Levine, *The Jazz Piano Book* (Sher Music, 1989), the introduction,
Chapter 7 (Left-Hand Voicings, especially pp. 41–43), and Chapter 21 (Comping,
pp. 223–228). The local scan was OCR'd for these sections; no book pages or
transcriptions are included in this repository.

Applied ideas: listen before responding; balance stimulation and space; use
anticipation and varying attack placement; distinguish rootless voicings from
root-position shells, quartal colors and clusters. Rootless voicings can leave
room for the bass without making that an absolute rule. The book's examples
are inspiration for instrumental technique, not a compulsory harmony sequence.

## Repairs to the original instruments

The original renderer used the same chord notes for rootless, fourths and
clusters, ignored the bass's selected motion, and ignored register in some horn
shapes. Those decisions now affect their instruments. Bass and horn respond to
previously heard harmony rather than secretly following the pianist's new
choice. The drummer's textures have distinct rhythms and timbres. Drum noise
bursts now have enough duration and gain to be heard against the piano.

The old live snapshot showed repeated drum silence with 98–99% probability.
Questions now ask explicitly for the *next* gesture, not a description of the
previous one, and expose repetition and silence as observations. Silence is
still allowed; there is no forced drum override.

## Timing and graphics

Each bar carries its tempo and absolute start time. Rendering, sound and
performer motion follow that bar's clock. A late model response gets a small
scheduling lead instead of silently losing the downbeat. Local mute controls
the final audio gain, leaving the room connection and visual schedule intact.
Animation is a subtle displacement of the illustrated heads, hands and
instruments in response to note events; it is not generated video.

## Artwork production

Built-in ImageGen was used with the user's blue pixel-art jazz-club image as
reference. The first prompt preserved the intimate seated viewpoint, amber
lamps, four performers and indigo curtains, removed adventure-game controls,
and changed the sign to Jezz Quarter. A second edit removed all spectators
while preserving the stage composition. The audience prompt requested a
transparent 3-column × 2-row sheet: woman/man, each with two walking frames and
one seated frame. Source outputs: `art-source/club-empty.png` and
`art-source/audience.png`. Runtime WebP conversions do not alter their content.
