# Bass and horn: notes chosen by Jev

Implemented 19 September 2026. This replaces the bass walking templates and horn
scale/contour templates. Piano and drum musical harnesses remain unchanged.

## Invocation

The room starts four independent musician tasks for each upcoming four-beat
window. Piano and drums make their existing request. Bass and horn each run a
private sequence of requests, one per note or rest. They execute concurrently
with the other musicians; their decisions are never given to another player.

Each bass/horn request asks five independent questions:

| Question | Primitive | Execution |
| --- | --- | --- |
| Play at this position? | Noul | At least 0.5 means attack; otherwise rest |
| Which concert pitch? | Choice | All semitones E1–G4 for bass, Bb2–G6 for horn |
| Rhythmic spacing? | Choice | Duration until this player's next action |
| How to release? | Choice | Detached, separated or connected |
| How strong an accent? | Score | Continuous mapping from five touch levels to velocity |

Spacing includes sixteenths, triplet eighths, eighths, long swung eighths,
dotted values, quarters, halves and whole notes, where they fit. A fractional
window remainder is available explicitly. Pitch descriptions include the exact
interval from the player's own previous note, computed by code. No notes are
removed for harmonic reasons.

The cursor advances by the chosen spacing. The next request receives that
player's private choices so far. Pitch, release and accent answers are unused
when the action is a rest. Each request gets fresh, causally filtered listening:
no attacks after invocation time, and only the elapsed duration of a held note.
Other players' parts and decisions are never serialized into listening state.

The renderer maps chosen actions directly to notes. No hidden root, scale,
contour, approach tone, random transposition or melodic repair remains for bass
or horn. The browser no longer shortens these note durations by an extra 10%.

## Decision policy and experiments

Initial live probes with bare note names repeatedly selected C. Framing the
question as the next note of an unfolding phrase, with computed interval labels,
produced moving lines without narrowing the available pitches.

A ten-bar direct-choice band probe then developed repeated-pitch loops and growing
request costs from verbose history. Listening was compacted to three recent bars;
own memory sends the last twelve actions, while retaining thirty-two privately.
The same frozen listening state was tested with direct choices and distribution
sampling. The sampled bass explored another pitch and longer spacing; the horn
chose to rest under both policies. This is limited behavioral evidence, not proof
of musical quality or of a universally better policy.

The default samples **pitch and spacing only**, from Jev's original probabilities,
with no temperature adjustment or probability floor. `LINE_POLICY=direct` selects
Jev's top choices for comparison. Articulation uses the top Choice, Noul uses a
0.5 threshold, and accent uses the returned Score. Debug shows the policy, original
distributions, top choice and executed choice separately.

In a subsequent 16-bar live-API probe, 30 of 32 musician windows completed within
their deadline. Lines showed repeated notes, different pitches, triplets, longer
holds and changing register. Two windows ran out of planning time near the end.
The scheduling margin was then adjusted to start planning earlier. These are
engineering observations; Paul should audition the result using the debug mixer.

## Current engineering bounds

This iteration still transports music in four-beat windows. Phrase memory crosses
those boundaries, but individual note/rest actions currently end within their
window; cross-bar ties and continuously streamed actions are not implemented.
The finite pitch range, supported rhythm values and synth articulation are the
instrument interface. There is no consonance or scale gate.

Planning begins about 100 ms into the current bar. Bass/horn requests have a
shared per-window deadline, allowing roughly 200 ms delivery lead; opening allows
three seconds. They refresh heard evidence between their own decisions. A slow
request is cancelled; completed decisions play, and the unplanned remainder is
left silent, without inventing replacement notes. Debug reports `deadline` or
`error` separately from a chosen rest. Piano/drum request recovery is unchanged
and can still delay the whole bar.

Stats include successful-response tokens and summed call time, plus wall time.
A cancelled request may have been billed upstream without returning usage; these
usage figures cannot account for such unknown charges. Successful responses are
accounted immediately, even if another musician later fails. The existing room
budget remains in force.

Tests cover causal listening, private-plan isolation, memory continuity, exact
rendering of dissonant choices, rests, sampling support, invalid answers, deadlines,
fractional durations, drummer tempo ownership and existing room/mixer behavior.
