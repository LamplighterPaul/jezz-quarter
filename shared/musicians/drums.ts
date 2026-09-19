import { forMusician } from './context.ts'
import { decide, sampledNoul, sampledChoice, sampledLevel } from '../sample.ts'
import type {
  Answers,
  Decision,
  DrumsPart,
  Heard,
  Questions,
} from '../types.ts'

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
  return forMusician('drums', {
    tempo_change: {
      type: 'noul',
      instructions:
        'Should the drummer establish a different tempo at the next bar boundary? Opening the set calls for choosing a tempo. During a phrase, keep the pulse unless the music calls for a deliberate change, not an accidental drift.',
      criteria: {
        true: 'a new tempo would serve the next passage',
        false: 'the current pulse still serves the band',
      },
    },
    tempo: {
      type: 'score',
      instructions:
        'What pace would suit the drummer’s next passage? Judge pace only; density and loudness are separate. This answer sets the room BPM when establishing or changing tempo.',
      criteria: [
        'Unhurried ballad: wide space between pulses, breathing room for sustained phrases',
        'Relaxed walking pace: laid-back, head-nodding swing',
        'Medium swing: forward-moving conversation, comfortable walking bass',
        'Brisk swing: buoyant, urgent lines and quick responses',
        'Burning uptempo: racing bebop energy and short agile gestures',
      ],
    },
    kit: {
      type: 'choice',
      instructions: `You are the drummer. Free jazz, no chart, no click from a leader. You own the pulse and the room tempo. A brief silence can be expressive, but keeping time and re-entering are your responsibility. You heard: ${heard.last} How do you keep (or break) time this bar?`,
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
      instructions:
        'Do you throw a fill across the end of this bar? True = yes, a fill.',
      criteria: {
        true: 'a fill into the next bar',
        false: 'no fill, just time',
      },
    },
  })
}

export function assembleDrums(
  answers: Answers,
  heard: Heard,
  seed: number,
): { part: DrumsPart; decisions: Decision[] } {
  const kit = sampledChoice(answers, 'kit', 'swing', seed, 0, 1.15)
  const density = sampledLevel(answers, 'density', DENSITY, 1, seed)
  const kick = sampledChoice(answers, 'kick', 'one', seed, 0, 1.15)
  const snare = sampledChoice(answers, 'snare', 'two_four', seed, 0, 1.15)
  const fill = sampledNoul(answers, 'fill', seed)
  const rest = kit.key === 'silence'
  const tempoScore = answers.tempo?.type === 'score' ? answers.tempo.score : 1
  const tempos = [56, 88, 124, 168, 216]
  const level = Math.max(
    0,
    Math.min(4, Number.isFinite(tempoScore) ? tempoScore : 1),
  )
  const lower = Math.floor(level)
  const desired = Math.round(
    tempos[lower] +
      (tempos[Math.min(4, lower + 1)] - tempos[lower]) * (level - lower),
  )
  const changeTempo =
    heard.barsSoFar === 0 || sampledNoul(answers, 'tempo_change', seed)
  const bpm = changeTempo ? desired : heard.bpm
  const decisions: Decision[] = []
  const tempoChangeDecision = decide(
    'drums',
    'tempo_change',
    'Change tempo',
    changeTempo ? 'yes' : 'no',
    answers.tempo_change,
  )
  if (tempoChangeDecision) decisions.push(tempoChangeDecision)
  const tempoDecision = decide(
    'drums',
    'tempo',
    'Tempo',
    `${bpm} bpm`,
    answers.tempo,
  )
  if (tempoDecision) decisions.push(tempoDecision)
  if (kit.decision)
    decisions.push({ ...kit.decision, seat: 'drums', label: 'Kit' })
  const dd = decide(
    'drums',
    'density',
    'Density',
    DENSITY[density.index].split(':')[0],
    answers.density,
  )
  if (dd) decisions.push(dd)
  if (kick.decision)
    decisions.push({ ...kick.decision, seat: 'drums', label: 'Kick' })
  if (snare.decision)
    decisions.push({ ...snare.decision, seat: 'drums', label: 'Snare' })
  const fd = decide('drums', 'fill', 'Fill', fill ? 'yes' : 'no', answers.fill)
  if (fd) decisions.push(fd)
  const part: DrumsPart = {
    seat: 'drums',
    bpm,
    rest,
    kit: kit.key,
    density: density.index,
    kick: kick.key,
    snare: snare.key,
    fill,
    heard: rest
      ? `tacet after ${heard.barsSoFar}`
      : `${kit.key} · ${bpm} bpm${fill ? ' · filling' : ''}`,
  }
  return { part, decisions }
}
