# Listening, not a lead sheet

The quartet has four separate musician harnesses. No player receives another
player's future decisions, queued notes or scheduled release times. The drummer
alone sets BPM. Piano and drums keep their existing musical questions and
rendering techniques; bass and horn now choose their notes directly.

See [the current bass/horn implementation](bass-horn-iteration.md),
[the high-level vision](musician-vision.md), and
[the earlier loop review](jev-loop-review.md).

## Listening and feedback

At every request, listening is cut off at the room's current audible time.
Ordered events retain instrument, named pitch (or drum sound), onset, duration
heard so far, whether the note is still sounding, and velocity. Three recent bars
are sent in compact notation; repetition counts use up to eight completed bars.
Bass and horn separately retain their own last 32 chosen actions and send the
last 12 plus the unfolding private plan. No shared chord interpretation becomes
an instruction for the band.

A cheer approves the preceding passage; a boo invites a fresh response. Neither
sets a chord or rewrites an answer. Reactions refer to the currently audible bar
and its preceding three bars, expire after six subsequent bars or sixty seconds,
and are limited to one per browser per thirty seconds.

## Levine and TypeSafe

Mark Levine's *The Jazz Piano Book* informed the question-framing discussion,
particularly pp. 121, 223–234, 250 and 263. Theory and learned patterns support
musical judgment; they do not become mandatory harmony rules. Reading scope and
sources are recorded in [the vision note](musician-vision.md).

Each TypeSafe question is independent, including questions in the same request.
The new note questions explicitly condition pitch, release and accent on playing;
those answers are unused when Noul chooses a rest. A later request sees the
player's own preceding answers. All four harnesses use Choice, Noul and Score.

## Timing and graphics

Bars carry absolute start times and drummer-selected BPM. Sound and performer
motion follow that clock. A model deadline is a technical limitation, visible in
debug, and is never reported as a Jev-chosen rest. Local mute changes output gain
without changing the performance or listening evidence.

The stage remains an illustration with subtle note-driven WebGL displacement.
Replacing musicians with independently animated sprites is deferred.

## Artwork production

Built-in ImageGen was used with the user's blue pixel-art jazz-club image as
reference. The first prompt preserved the intimate seated viewpoint, amber
lamps, four performers and indigo curtains, removed adventure-game controls,
and changed the sign to Jezz Quarter. A second edit removed all spectators
while preserving the stage composition. The audience prompt requested a
transparent 3-column × 2-row sheet: woman/man, each with two walking frames and
one seated frame. Source outputs: `art-source/club-empty.png` and
`art-source/audience.png`. Runtime WebP conversions do not alter their content.
