import { decide, sampledChoice } from '../sample.ts'
import type { Answers, Decision, Note, Questions } from '../types.ts'

export type LineSeat = 'bass' | 'horn'
export const noteName = (midi: number) =>
  `${['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'][midi % 12]}${Math.floor(midi / 12) - 1}`

// An instrument interface, not a harmony filter. Every semitone is available.
export const RANGES = { bass: [28, 67], horn: [46, 91] } as const
const LENGTHS = {
  sixteenth: 0.25,
  triplet: 1 / 3,
  eighth: 0.5,
  swing: 2 / 3,
  dotted_eighth: 0.75,
  quarter: 1,
  dotted_quarter: 1.5,
  half: 2,
  dotted_half: 3,
  whole: 4,
}
const TOUCH = ['very light', 'gentle', 'clear', 'strong', 'emphatic']
const GATES = { detached: 0.45, separated: 0.8, connected: 1 }

export interface LineEvent {
  at: number
  duration: number
  midi: number | null
  articulation: keyof typeof GATES
  accent: number
}

export function lineQuestions(
  seat: LineSeat,
  identity: string,
  remaining: number,
  previous?: number,
): Questions {
  const prefix = `You are the ${seat} in an improvising jazz quartet. ${identity} Choose your NEXT action at self.next_action. Listen to recent_bars and remember your own previous_phrase and private_plan. No key or progression is prescribed. `
  const [low, high] = RANGES[seat]
  const lengths = Object.fromEntries(
    Object.entries(LENGTHS)
      .filter(([, beats]) => beats <= remaining + 1e-6)
      .map(([key, beats]) => [
        key,
        `${({ sixteenth: 'Sixteenth note', triplet: 'Triplet eighth', eighth: 'Eighth note', swing: 'Long swung eighth', dotted_eighth: 'Dotted eighth', quarter: 'Quarter note', dotted_quarter: 'Dotted quarter', half: 'Half note', dotted_half: 'Dotted half', whole: 'Whole note' } as Record<string, string>)[key]}: ${beats.toFixed(3)} beats until your next action`,
      ]),
  )
  // Always permit space to the window boundary, including a fractional remainder.
  if (Object.keys(lengths).length < 2 && remaining <= 0.25 + 1e-6)
    lengths.short = `${(remaining / 2).toFixed(3)} beats, a short subdivision`
  if (
    !Object.values(LENGTHS).some((beats) => Math.abs(beats - remaining) < 1e-6)
  )
    lengths.to_boundary = `${remaining.toFixed(3)} beats, to the end of this planning window`
  const interval = (midi: number) => {
    if (previous === undefined) return ''
    const distance = Math.abs(midi - previous)
    const names = [
      'unison',
      'minor second',
      'major second',
      'minor third',
      'major third',
      'perfect fourth',
      'tritone',
      'perfect fifth',
      'minor sixth',
      'major sixth',
      'minor seventh',
      'major seventh',
    ]
    if (!distance) return `; repeat your previous ${noteName(previous)}`
    const octaves = Math.floor(distance / 12),
      remainder = distance % 12
    const span = [
      octaves ? `${octaves} octave${octaves > 1 ? 's' : ''}` : '',
      remainder ? names[remainder] : '',
    ]
      .filter(Boolean)
      .join(' plus ')
    return `; ${span} ${midi > previous ? 'above' : 'below'} your previous ${noteName(previous)}`
  }
  const questions: Questions = {
    attack: {
      type: 'noul',
      instructions:
        'Do you play a new note at this cursor? Yes means attack; no means leave a rest. Decide what serves the music now.',
      criteria: { true: 'play a note now', false: 'leave space now' },
    },
    pitch: {
      type: 'choice',
      instructions:
        'If you attack at this cursor, choose the NEXT NOTE of your unfolding line. Your private_plan contains the notes you have already chosen for this phrase; continue from its last note, or from previous_phrase when starting this window. Shape a jazz phrase in conversation with the heard ensemble. Repeating, developing and starting a new idea are all possible. Select a next note, not a key or tonal centre. This answer is unused if you rest.',
      criteria: Object.fromEntries(
        Array.from({ length: high - low + 1 }, (_, i) => [
          noteName(low + i),
          `Play concert ${noteName(low + i)}${interval(low + i)}`,
        ]),
      ),
    },
    duration: {
      type: 'choice',
      instructions:
        'Choose the rhythmic value of your next note or rest in this jazz phrase. Consider the rhythm of your preceding phrase and what the ensemble has played. A window boundary is not a phrase ending.',
      criteria: lengths,
    },
    articulation: {
      type: 'choice',
      instructions:
        'If you play a note at this cursor, how do you release it within its rhythmic spacing? This answer is unused if you rest.',
      criteria: {
        detached: 'short, detached; release early',
        separated: 'give the note space before the next action',
        connected: 'sustain right up to the next action',
      },
    },
    accent: {
      type: 'score',
      instructions:
        'If you play a note at this cursor, how strongly do you accent it? Judge touch only; this answer is unused if you rest.',
      criteria: TOUCH,
    },
  }
  return Object.fromEntries(
    Object.entries(questions).map(([id, q]) => [
      id,
      { ...q, instructions: prefix + q.instructions },
    ]),
  )
}

export function readAction(
  seat: LineSeat,
  answers: Answers,
  questions: Questions,
  at: number,
  remaining: number,
  index: number,
  seed = 0,
) {
  const choice = (id: string) => {
    const answer = answers[id],
      question = questions[id]
    if (
      answer?.type !== 'choice' ||
      question?.type !== 'choice' ||
      !Object.hasOwn(question.criteria, answer.choice)
    )
      throw new Error(`Invalid ${seat} ${id} answer`)
    const selected =
      seed && (id === 'pitch' || id === 'duration')
        ? sampledChoice(answers, id, answer.choice, seed, 0, 1).key
        : answer.choice
    if (!Object.hasOwn(question.criteria, selected))
      throw new Error(`Invalid ${seat} sampled ${id}`)
    return selected
  }
  const attack = answers.attack
  if (
    attack?.type !== 'noul' ||
    !Number.isFinite(attack.noul) ||
    attack.noul < 0 ||
    attack.noul > 1
  )
    throw new Error(`Invalid ${seat} attack answer`)
  const length = choice('duration')
  const duration =
    length === 'to_boundary'
      ? remaining
      : length === 'short'
        ? remaining / 2
        : LENGTHS[length as keyof typeof LENGTHS]
  const playing = attack.noul >= 0.5
  let midi: number | null = null
  let articulation: LineEvent['articulation'] = 'connected'
  let accent = 0
  const decisions: Decision[] = []
  function record(id: string, label: string, picked: string) {
    const decision = decide(
      seat,
      `${index}.${id}`,
      `${index + 1} · ${label}`,
      picked,
      answers[id],
    )
    if (decision) decisions.push(decision)
  }
  record('attack', 'Attack', playing ? 'yes' : 'no')
  record('duration', 'Spacing', `${duration.toFixed(3)} beats`)
  if (playing) {
    const pitch = choice('pitch')
    const [low, high] = RANGES[seat]
    midi = Array.from({ length: high - low + 1 }, (_, i) => low + i).find(
      (n) => noteName(n) === pitch,
    )!
    articulation = choice('articulation') as LineEvent['articulation']
    const score = answers.accent
    if (
      score?.type !== 'score' ||
      !Number.isFinite(score.score) ||
      score.score < 0 ||
      score.score > TOUCH.length - 1
    )
      throw new Error(`Invalid ${seat} accent answer`)
    accent = score.score
    record('pitch', 'Pitch', pitch)
    record('articulation', 'Release', articulation)
    record('accent', 'Touch', TOUCH[Math.round(accent)])
  }
  const event: LineEvent = { at, duration, midi, articulation, accent }
  return { event, decisions }
}

export function lineNotes(seat: LineSeat, events: LineEvent[]): Note[] {
  return events.flatMap((event) =>
    event.midi === null
      ? []
      : [
          {
            seat,
            kind: 'tone' as const,
            at: event.at,
            midi: event.midi,
            beats: event.duration * GATES[event.articulation],
            velocity: 0.24 + event.accent * 0.15,
          },
        ],
  )
}

export function describeLine(events: LineEvent[]): string {
  return (
    events
      .map(
        (event) =>
          `${event.midi === null ? 'rest' : noteName(event.midi)} (${Number(event.duration.toFixed(2))})`,
      )
      .join(' · ') || 'Leaving space'
  )
}
