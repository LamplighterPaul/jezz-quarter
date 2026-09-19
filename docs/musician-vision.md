# Independent musicians: question framing first

Design direction, 19 September 2026. This is a proposal, not a description of
implemented behavior. Bass and horn come first; piano and drums remain deferred.

Paul's central correction: work on the assumption that Jev already has musical
knowledge. Our job is to give it useful evidence and ask the right questions.
Test that assumption through playing and listening before adding musical rules.
Do not rebuild jev-piano as a theory engine with Jev choosing between its presets.

## What Levine contributes

Source: Mark Levine, *The Jazz Piano Book*, Sher Music, 1989, from Paul's local
Obsidian vault. The 316-page scan was OCR'd; prose was reviewed across all 23
chapters, with selected pages checked visually. The notation-heavy examples and
reference material were skimmed, not exhaustively transcribed or performed.
Page numbers below are printed page numbers, nine below the PDF page number.
Neither the scan nor extracted text belongs in this repository.

- Page 121 discusses convincing playing even when musicians briefly choose
  different harmonic alterations, and the loss of spontaneity from excessive
  specificity. Agreement need not be arranged before anyone plays.
- Pages 223–234 describe accompaniment as listening, stimulation, space and
  adjustment to the particular player. Sometimes accompaniment leads.
- Page 250 presents theory as an explanation of music that remains subordinate
  to musical experience. It does not justify a compulsory scale filter.
- Page 263 distinguishes a vocabulary of practiced patterns from the musical
  ideas those patterns serve. Our renderer currently supplies too much of the
  idea through fixed contours and rhythms.
- Pages 269–272 emphasize ensemble awareness, listening back and learning from
  performance. Evaluate these harnesses through audible musical passages.

These are inspirations. The architecture below is our engineering proposal, not
a claim that Levine describes AI or this particular free improvisation setup.

## Four players with separate judgment

Each instrument owns its questions and private memory. Shared infrastructure can
carry events and time; it must not decide the band's harmony or musical direction.
The drummer owns the room's BPM, as Paul requires.

Give each musician an ordered account of what has actually sounded: who played
which named notes, when, for how long, and with what articulation and dynamics.
Keep pitches paired with their timing. Include the player's own recent phrase,
current sounding note, rests and prior decisions. Preserve continuity across bar
boundaries instead of resetting every musical dimension once per bar.

Keep everyone else's private intent, queued notes and future decisions private.
Filter listening evidence by the audible time at invocation. A committed bar
that has not finished sounding is not fully heard history. Interpretations of
harmony can remain each musician's own; do not publish the pianist's choice as
the correct chord that the others must follow.

## Ask for playing, with context

The common question is: **Given what you have heard and your own phrase so far,
what do you play next?** The bass and horn need different musical perspectives,
but neither needs a music lesson in every request.

Illustrative question framing, not final API schemas:

| Primitive | Bass | Horn |
| --- | --- | --- |
| Choice | Which pitch do you play at this next attack, given your line and the ensemble you have heard? | Which pitch do you play at this next attack, given your phrase and the ensemble you have heard? |
| Noul | Do you make a new attack at this opportunity? | Do you make a new attack at this opportunity? |
| Score | If you attack here, how strongly do you accent this note, from very light to emphatic? | If you attack here, how strongly do you accent this note, from very light to emphatic? |

These examples illustrate the division of responsibility; three questions alone
do not specify a complete performance. Jev also needs control over onset, length
and articulation. Silence, sustaining, repetition, chromatic notes, leaps and
offbeat entries must be expressible. Do not preselect only notes that our code
considers harmonically appropriate. A finite instrument interface is unavoidable;
keep its limits explicit and based on supported execution, not musical taste.

Choice pitch options can cover the supported chromatic register. Code supplies
unambiguous note names and exact timing; Jev judges their musical use. Avoid
making every note a mandatory choice among "support", "answer" and "contrast":
those can become another restrictive menu of composer-written gestures.

TypeSafe questions in a batch are independent. A pitch answer cannot silently
depend on a timing or phrase answer from that same batch. Questions must specify
their conditions explicitly; unused speculative answers can be discarded. When
a decision truly needs a previous answer, sequence it privately within that
musician. Never obtain coherence by exposing another player's future choices.

## Execution and evaluation

Code owns event clocks, note-to-frequency conversion, range validation, audio
rendering, request deadlines and memory storage. Jev receives symbolic events;
it does not hear our audio. Do not ask it for sample scheduling, exact arithmetic,
or an unconstrained score through an API that answers bounded questions.

The renderer should perform the chosen action faithfully. It should not repair
an unexpected note, force a resolution, fill every silence or expand a vague
"climb" into a melody of its own. Cheer and boo provide evidence about the
preceding passage, not instructions that silently overwrite the player's choice.

Invocation cadence remains an experiment: the next attack, release or entry is
a better musical unit to investigate than mandatory whole-bar style changes.
Measure Jev latency before promising a request for every fast note. Any short
private planning buffer must remain hidden from other players until it sounds.

First compare question wording on identical recorded contexts and broadly
available actions. Inspect returned distributions and audition outcomes with the
debug mixer. Start with direct model decisions to see what Jev actually chooses;
test sampling separately instead of treating added randomness as musical freedom.
Listen for phrase continuity, response to others, useful space and development.
Consonance alone is not success, and a surprising note is not automatically a bug.

TypeSafe references: [primitives](https://docs.typesafe.ai/primitives),
[Choice](https://docs.typesafe.ai/primitives/choice),
[Noul](https://docs.typesafe.ai/primitives/noul),
[Score](https://docs.typesafe.ai/primitives/score), and
[Jev limitations](https://docs.typesafe.ai/model-jaggedness/jev-1.13).
The existing implementation is described in [the loop review](jev-loop-review.md).
