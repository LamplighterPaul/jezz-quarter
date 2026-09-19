// Piano Jev. Invents harmony. Does not see the other three this bar.
// Levine: stimulate, or stay out of the way. Rootless because a bassist exists.

import { NOTE_NAMES, qualityCriteria, tonicCriteria } from '../theory.ts'
import { decide, noulYes, sampledChoice, sampledLevel } from '../sample.ts'
import type { Answers, Decision, Heard, PianoPart, Questions } from '../types.ts'

const VOICINGS = {
  three_note: 'root, third and seventh — the essential three',
  rootless: 'third, seventh, ninth, thirteenth — no root, the bass has that',
  fourths: 'stacked fourths, So What colour, open and modal',
  cluster: 'a tight cluster, notes rubbing',
  single: 'one note, or an octave, nothing else',
}

const TIMES = {
  anticipate: 'a half beat early — more energy',
  on: 'right on the beat',
  behind: 'a little late, dragging on purpose',
}

const DENSITY = [
  'almost nothing: one stab, lots of air',
  'sparse: a couple of attacks in the bar',
  'medium: present, not busy',
  'busy: filling the holes, McCoy-ish',
]

export function pianoQuestions(heard: Heard): Questions {
  return {
    rest: {
      type: 'noul',
      instructions: `You are the pianist in a free jazz quartet. There is no chart and no leader. You hear what just happened. Should you sit this bar out — Count Basie air, play when they don't? True = lay out.`,
      criteria: {
        true: 'this bar is better silent from you; the others have it',
        false: 'you should play something this bar',
      },
    },
    root: {
      type: 'choice',
      instructions: `Pick a root for this bar. You are inventing the harmony, not following a lead sheet. Hear ${heard.last} React, don't explain. Stay, move a little, or jump.`,
      criteria: tonicCriteria(),
    },
    quality: {
      type: 'choice',
      instructions: 'What quality of chord, given what you just heard? Free jazz: you may clash. You may also agree.',
      criteria: qualityCriteria(),
    },
    voicing: {
      type: 'choice',
      instructions: 'How do you put it under your hands? Rootless is the late-1950s default when a bass is walking. Not a rule.',
      criteria: VOICINGS,
    },
    time: {
      type: 'choice',
      instructions: 'Where in the beat do the attacks sit?',
      criteria: TIMES,
    },
    density: {
      type: 'score',
      instructions: 'How much piano this bar?',
      criteria: DENSITY,
    },
  }
}

export function assemblePiano(answers: Answers, heard: Heard, seed: number): { part: PianoPart; decisions: Decision[] } {
  const restP = noulYes(answers, 'rest')
  const rest = restP >= 0.55
  const root = sampledChoice(answers, 'root', 'C', seed, 0.06, 1.4)
  const quality = sampledChoice(answers, 'quality', 'dom7', seed, 0.05)
  const voicing = sampledChoice(answers, 'voicing', 'rootless', seed, 0.04)
  const time = sampledChoice(answers, 'time', 'on', seed, 0.04)
  const density = sampledLevel(answers, 'density', DENSITY, 1, seed)
  const decisions: Decision[] = []
  const restA = answers.rest
  const rd = decide('piano', 'rest', 'Lay out', rest ? 'yes' : 'no', restA)
  if (rd) decisions.push(rd)
  if (root.decision) decisions.push({ ...root.decision, seat: 'piano', label: 'Root' })
  if (quality.decision) decisions.push({ ...quality.decision, seat: 'piano', label: 'Quality' })
  if (voicing.decision) decisions.push({ ...voicing.decision, seat: 'piano', label: 'Voicing' })
  if (time.decision) decisions.push({ ...time.decision, seat: 'piano', label: 'Time' })
  const densA = answers.density
  const dd = decide('piano', 'density', 'Density', DENSITY[density.index].split(':')[0], densA)
  if (dd) decisions.push(dd)
  const part: PianoPart = {
    seat: 'piano',
    rest,
    root: Math.max(0, NOTE_NAMES.indexOf(root.key as (typeof NOTE_NAMES)[number])),
    quality: quality.key,
    voicing: voicing.key,
    density: density.index,
    time: time.key,
    heard: rest ? `laid out after ${heard.barsSoFar}` : `${root.key}${quality.key === 'maj7' ? 'Δ' : quality.key === 'min7' ? '-' : quality.key} ${voicing.key} ${time.key}`,
  }
  return { part, decisions }
}
