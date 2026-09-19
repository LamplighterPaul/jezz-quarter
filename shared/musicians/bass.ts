// Bass Jev. Own mind. May lock to what it heard, or wander off and invent a root.

import { NOTE_NAMES, tonicCriteria } from '../theory.ts'
import { decide, noulYes, sampledChoice } from '../sample.ts'
import type { Answers, BassPart, Decision, Heard, Questions } from '../types.ts'

const FEELS = {
  walk: 'walking four to the bar, the jazz default',
  two: 'in two — half notes, more air',
  pedal: 'a pedal tone, one note held or repeated',
  broken: 'broken time, not a steady walk',
  rest: 'this bar, nothing from you',
}

const MOTION = {
  stay: 'stay near where you just were',
  step_up: 'step up',
  step_down: 'step down',
  fifth: 'move by a fifth',
  leap: 'a leap, then recover',
}

const TARGET = {
  root: 'the root of what you heard the piano leave hanging',
  fifth: 'the fifth of that sound',
  third: 'the third of that sound',
  approach: 'chromatic approach into wherever you land',
  own: 'ignore them — pick your own pitch',
}

export function bassQuestions(heard: Heard): Questions {
  return {
    wander: {
      type: 'noul',
      instructions: `You are the bassist. Free jazz, no chart. You heard: ${heard.last} True = invent your own root this bar, even if it disagrees with the piano. False = answer what you heard.`,
      criteria: {
        true: 'go your own way this bar',
        false: 'answer the sound you just heard',
      },
    },
    feel: {
      type: 'choice',
      instructions: 'How do you time this bar? Walking is common. Silence is allowed. Broken time is allowed.',
      criteria: FEELS,
    },
    motion: {
      type: 'choice',
      instructions: 'From your last note, where does the line go?',
      criteria: MOTION,
    },
    target: {
      type: 'choice',
      instructions: 'What are you aiming at, if you are aiming at all?',
      criteria: TARGET,
    },
    root: {
      type: 'choice',
      instructions: 'If you are inventing, which pitch class is home this bar? If you are answering, this is a guess at where the music sat.',
      criteria: tonicCriteria(),
    },
  }
}

export function assembleBass(answers: Answers, heard: Heard, seed: number): { part: BassPart; decisions: Decision[] } {
  const wander = noulYes(answers, 'wander') >= 0.55
  const feel = sampledChoice(answers, 'feel', 'walk', seed, 0.04)
  const motion = sampledChoice(answers, 'motion', 'stay', seed, 0.04)
  const target = sampledChoice(answers, 'target', wander ? 'own' : 'root', seed, 0.04)
  const root = sampledChoice(answers, 'root', 'C', seed, 0.06, 1.3)
  const rest = feel.key === 'rest'
  const decisions: Decision[] = []
  const w = decide('bass', 'wander', 'Wander', wander ? 'yes' : 'no', answers.wander)
  if (w) decisions.push(w)
  if (feel.decision) decisions.push({ ...feel.decision, seat: 'bass', label: 'Feel' })
  if (motion.decision) decisions.push({ ...motion.decision, seat: 'bass', label: 'Motion' })
  if (target.decision) decisions.push({ ...target.decision, seat: 'bass', label: 'Aim' })
  if (root.decision) decisions.push({ ...root.decision, seat: 'bass', label: 'Pitch' })
  const rootN = Math.max(0, NOTE_NAMES.indexOf(root.key as (typeof NOTE_NAMES)[number]))
  const part: BassPart = {
    seat: 'bass',
    rest,
    feel: feel.key,
    motion: motion.key,
    target: target.key,
    wander,
    root: rootN,
    heard: rest ? `tacet after ${heard.barsSoFar}` : `${feel.key} ${wander ? 'own ' + root.key : target.key} ${motion.key}`,
  }
  return { part, decisions }
}

export function bassRoot(part: BassPart, pianoRoot: number): number {
  if (part.wander || part.target === 'own') return part.root
  if (part.target === 'fifth') return (pianoRoot + 7) % 12
  if (part.target === 'third') return (pianoRoot + 4) % 12
  return pianoRoot
}
