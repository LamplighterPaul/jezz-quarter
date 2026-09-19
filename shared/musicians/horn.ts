import { NOTE_NAMES, tonicCriteria } from '../theory.ts'
import { decide, noulYes, sampledChoice, sampledLevel } from '../sample.ts'
import type { Answers, Decision, Heard, HornPart, Questions } from '../types.ts'

const COLORS = {
  mixolydian: 'mixolydian — dominant, the ordinary jazz seventh scale',
  dorian: 'dorian — minor with a raised sixth',
  altered: 'altered — as tense as it gets over a dominant',
  diminished: 'diminished — symmetric, slippery',
  pentatonic: 'pentatonic — five notes, folk and McCoy',
  blues: 'blues — the minor pentatonic plus the blue note',
  chromatic: 'chromatic — any note, outside on purpose',
  lydian: 'lydian — raised fourth, floating',
}

const SHAPES = {
  long: 'one long tone, held',
  climb: 'a climb',
  fall: 'a descent',
  motif: 'the same shape you just played, moved',
  fragments: 'short fragments, breaths between',
}

const REGISTER = [
  'low: chest, around the staff',
  'middle: speaking range',
  'high: above the staff',
  'altissimo: the top, sparse',
]

export function hornQuestions(heard: Heard): Questions {
  return {
    rest: {
      type: 'noul',
      instructions: `You are the horn. Free jazz, no head, no changes. You heard: ${heard.last} Should you rest this bar and leave it to the rhythm section? True = rest.`,
      criteria: {
        true: 'this bar is better without you',
        false: 'you play',
      },
    },
    color: {
      type: 'choice',
      instructions: 'Which colour do you blow, given what you just heard — not given a chart, because there is none.',
      criteria: COLORS,
    },
    shape: {
      type: 'choice',
      instructions: 'The shape of the line this bar.',
      criteria: SHAPES,
    },
    register: {
      type: 'score',
      instructions: 'Where on the horn?',
      criteria: REGISTER,
    },
    landing: {
      type: 'choice',
      instructions: 'Pitch class you come to rest on, if you play.',
      criteria: tonicCriteria(),
    },
  }
}

export function assembleHorn(answers: Answers, heard: Heard, seed: number): { part: HornPart; decisions: Decision[] } {
  const rest = noulYes(answers, 'rest') >= 0.55
  const color = sampledChoice(answers, 'color', 'mixolydian', seed, 0.04)
  const shape = sampledChoice(answers, 'shape', 'fragments', seed, 0.04)
  const register = sampledLevel(answers, 'register', REGISTER, 1, seed)
  const landing = sampledChoice(answers, 'landing', 'C', seed, 0.05)
  const decisions: Decision[] = []
  const rd = decide('horn', 'rest', 'Rest', rest ? 'yes' : 'no', answers.rest)
  if (rd) decisions.push(rd)
  if (color.decision) decisions.push({ ...color.decision, seat: 'horn', label: 'Colour' })
  if (shape.decision) decisions.push({ ...shape.decision, seat: 'horn', label: 'Shape' })
  const rg = decide('horn', 'register', 'Register', REGISTER[register.index].split(':')[0], answers.register)
  if (rg) decisions.push(rg)
  if (landing.decision) decisions.push({ ...landing.decision, seat: 'horn', label: 'Landing' })
  const part: HornPart = {
    seat: 'horn',
    rest,
    color: color.key,
    shape: shape.key,
    register: register.index,
    landing: Math.max(0, NOTE_NAMES.indexOf(landing.key as (typeof NOTE_NAMES)[number])),
    heard: rest ? `rested after ${heard.barsSoFar}` : `${color.key} ${shape.key} → ${landing.key}`,
  }
  return { part, decisions }
}
