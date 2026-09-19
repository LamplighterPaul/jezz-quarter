// Bass and horn notes are Jev's explicit actions; piano/drums retain their techniques.
import { noise } from './sample.ts'
import { voiceFor } from './theory.ts'
import { lineNotes } from './musicians/line.ts'
import type { Bar, Note } from './types.ts'

export interface RenderState {
  lastVoicing: number[]
}
const BEATS = 4

function pianoNotes(bar: Bar, state: RenderState): Note[] {
  const p = bar.parts.piano
  if (p.rest) return []
  const v = voiceFor(p.root, p.quality, p.voicing, state.lastVoicing)
  state.lastVoicing = v
  const patterns = [
    [[0.5], [2], [0]],
    [
      [0.5, 2.5],
      [0, 2],
      [1, 3.5],
    ],
    [
      [0, 1.5, 3],
      [0.5, 2, 3.5],
      [0, 2.5, 3.5],
    ],
    [
      [0, 1, 2.5, 3.5],
      [0.5, 1.5, 2, 3.5],
      [0, 0.66, 2, 2.66, 3.5],
    ],
  ]
  const attacks =
    patterns[p.density][Math.floor(noise(bar.index + 1, 'comp-rhythm') * 3)]
  const off = p.time === 'anticipate' ? -0.22 : p.time === 'behind' ? 0.15 : 0
  const hold = p.density === 0 ? 2.4 : p.density === 3 ? 0.38 : 0.75
  return attacks.flatMap((t, attack) =>
    v.map((midi, voice) => ({
      at: Math.max(0, t + off) + voice * 0.009,
      beats: hold * (0.8 + noise(bar.index + attack, 'piano-hold') * 0.4),
      midi,
      velocity: (0.32 + 0.09 * p.density) * (voice === v.length - 1 ? 1 : 0.78),
      seat: 'piano' as const,
      kind: 'tone',
    })),
  )
}

function drumsNotes(bar: Bar): Note[] {
  const d = bar.parts.drums
  if (d.rest) return []
  const notes: Note[] = []
  const hit = (at: number, kind: NonNullable<Note['kind']>, velocity: number) =>
    notes.push({
      at,
      beats: 0.18,
      midi: kind === 'kick' ? 36 : kind === 'snare' ? 38 : 81,
      velocity,
      seat: 'drums',
      kind,
    })
  const density = 0.65 + d.density * 0.13
  const variant = Math.floor(noise(bar.index + 1, 'drums-pattern') * 3)
  if (d.kit === 'swing') {
    // Spang-a-lang: quarter pulse, swung skips on two/four, not eight identical taps.
    for (const at of [0, 1, 2, 3])
      hit(at, 'ride', (at % 2 ? 0.57 : 0.42) * density)
    for (const at of [1.66, 3.66]) hit(at, 'ride', 0.34 * density)
    hit(1, 'hat', 0.26)
    hit(3, 'hat', 0.3)
  } else if (d.kit === 'latin') {
    for (const at of [0, 0.5, 1.5, 2, 2.5, 3.5])
      hit(at, 'rim', (at % 1 ? 0.45 : 0.6) * density)
    for (const at of [0, 1, 2, 3]) hit(at, 'hat', 0.25 * density)
  } else if (d.kit === 'ballad') {
    hit(0, 'brush', 0.45 * density)
    hit(2, 'brush', 0.38 * density)
    hit(1, 'hat', 0.2)
    hit(3, 'hat', 0.24)
  } else {
    const patterns = [
      [0, 0.66, 1.5, 2.66, 3.5],
      [0, 1.33, 2, 2.66, 3.66],
      [0.33, 1, 1.66, 2.5, 3.33],
    ]
    for (const at of patterns[variant])
      hit(
        at,
        'ride',
        (0.3 + noise(bar.index + Math.round(at * 10), 'ride-touch') * 0.25) *
          density,
      )
  }
  if (d.kick === 'one' || d.kick === 'one_three') hit(0, 'kick', 0.68 * density)
  if (d.kick === 'one_three') hit(2, 'kick', 0.58 * density)
  if (d.kick === 'scattered') {
    hit(variant === 0 ? 0.66 : 0.5, 'kick', 0.55)
    hit(2.5, 'kick', 0.64)
  }
  const snare = d.kit === 'ballad' ? 'brush' : 'snare'
  if (d.snare === 'two_four') {
    hit(1, snare, 0.48 * density)
    hit(3, snare, 0.6 * density)
  }
  if (d.snare === 'four') hit(3, snare, 0.6 * density)
  if (d.snare === 'chatter') {
    hit(0.66 + variant * 0.16, snare, 0.4)
    hit(2.33, snare, 0.5)
  }
  if (d.density >= 2) hit(variant === 0 ? 2.66 : 0.33, 'snare', 0.2)
  if (d.fill)
    for (let i = 0; i < 4; i++)
      hit(3 + i * 0.24, i % 2 ? 'tom' : 'snare', 0.45 + 0.08 * i)
  return notes
}

export function renderBar(bar: Bar, state: RenderState): Note[] {
  const notes = [
    ...pianoNotes(bar, state),
    ...lineNotes('bass', bar.parts.bass.events),
    ...drumsNotes(bar),
    ...lineNotes('horn', bar.parts.horn.events),
  ]
  return notes.sort((a, b) => a.at - b.at)
}
export const beatsPerBar = BEATS
