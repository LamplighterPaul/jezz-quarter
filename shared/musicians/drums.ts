import { decide, noulYes, sampledChoice, sampledLevel } from '../sample.ts'
import type { Answers, Decision, DrumsPart, Heard, Questions } from '../types.ts'

const KITS = {
  swing: 'ride cymbal swinging, feathered kick',
  latin: 'a latin pattern, cascara-ish',
  ballad: 'brushes, slow air',
  broken: 'broken time, Elvin-ish, not a grid',
  silence: 'this bar, nothing',
}

const KICKS = {
  one: 'kick on one',
  one_three: 'kick on one and three',
  scattered: 'kicks in the cracks',
  none: 'no kick',
}

const SNARES = {
  two_four: 'snare on two and four',
  four: 'snare on four only',
  chatter: 'chatter, not a backbeat',
  none: 'no snare',
}

const DENSITY = [
  'whisper: time only',
  'light: time plus a comment',
  'medium: present',
  'heavy: dropping bombs, filling',
]

export function drumsQuestions(heard: Heard): Questions {
  return {
    kit: {
      type: 'choice',
      instructions: `You are the drummer. Free jazz, no chart, no click from a leader. BPM is already set by the room, not by you. You heard: ${heard.last} How do you keep (or break) time this bar?`,
      criteria: KITS,
    },
    density: {
      type: 'score',
      instructions: 'How much drums this bar?',
      criteria: DENSITY,
    },
    kick: {
      type: 'choice',
      instructions: 'Bass drum this bar.',
      criteria: KICKS,
    },
    snare: {
      type: 'choice',
      instructions: 'Snare this bar.',
      criteria: SNARES,
    },
    fill: {
      type: 'noul',
      instructions: 'Do you throw a fill across the end of this bar? True = yes, a fill.',
      criteria: { true: 'a fill into the next bar', false: 'no fill, just time' },
    },
  }
}

export function assembleDrums(answers: Answers, heard: Heard, seed: number): { part: DrumsPart; decisions: Decision[] } {
  const kit = sampledChoice(answers, 'kit', 'swing', seed, 0.04)
  const density = sampledLevel(answers, 'density', DENSITY, 1, seed)
  const kick = sampledChoice(answers, 'kick', 'one', seed, 0.04)
  const snare = sampledChoice(answers, 'snare', 'two_four', seed, 0.04)
  const fill = noulYes(answers, 'fill') >= 0.6
  const rest = kit.key === 'silence'
  const decisions: Decision[] = []
  if (kit.decision) decisions.push({ ...kit.decision, seat: 'drums', label: 'Kit' })
  const dd = decide('drums', 'density', 'Density', DENSITY[density.index].split(':')[0], answers.density)
  if (dd) decisions.push(dd)
  if (kick.decision) decisions.push({ ...kick.decision, seat: 'drums', label: 'Kick' })
  if (snare.decision) decisions.push({ ...snare.decision, seat: 'drums', label: 'Snare' })
  const fd = decide('drums', 'fill', 'Fill', fill ? 'yes' : 'no', answers.fill)
  if (fd) decisions.push(fd)
  const part: DrumsPart = {
    seat: 'drums',
    rest,
    kit: kit.key,
    density: density.index,
    kick: kick.key,
    snare: snare.key,
    fill,
    heard: rest ? `tacet after ${heard.barsSoFar}` : `${kit.key} ${kick.key}/${snare.key}${fill ? ' fill' : ''}`,
  }
  return { part, decisions }
}
