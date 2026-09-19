// Code supplies playable technique; each Jev chooses its own gesture.
import { noise } from './sample.ts'
import { ladder, nearestPc, scalePcs, voiceFor, mod12 } from './theory.ts'
import type { Bar, Note } from './types.ts'

export interface RenderState {
  lastVoicing: number[]
  lastBass: number
  lastHorn: number
  heardRoot?: number
  heardQuality?: string
  hornMotif?: number[]
}
const BEATS = 4
const bounded = (midi: number, low: number, high: number) => {
  while (midi < low) midi += 12
  while (midi > high) midi -= 12
  return midi
}

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

function bassNotes(bar: Bar, state: RenderState): Note[] {
  const b = bar.parts.bass
  if (b.rest) return []
  const heardRoot = state.heardRoot ?? b.root
  const third = ['min7', 'halfdim', 'minmaj'].includes(state.heardQuality ?? '')
    ? 3
    : 4
  const root =
    b.wander || b.target === 'own'
      ? b.root
      : mod12(
          heardRoot +
            (b.target === 'fifth' ? 7 : b.target === 'third' ? third : 0),
        )
  const motion =
    b.motion === 'step_up'
      ? 2
      : b.motion === 'step_down'
        ? -2
        : b.motion === 'fifth'
          ? 7
          : b.motion === 'leap'
            ? noise(bar.index, 'leap') > 0.5
              ? 10
              : -9
            : 0
  const start = bounded(state.lastBass + motion, 28, 55)
  const dest = bounded(nearestPc(root, start), 28, 55)
  const vel = 0.4 + 0.11 * b.energy
  let line: number[]
  let times: number[]
  let holds: number[]
  if (b.feel === 'pedal') {
    line = [dest]
    times = [0]
    holds = [3.7]
  } else if (b.feel === 'two') {
    line = [start, dest]
    times = [0, 2]
    holds = [1.7, 1.7]
  } else if (b.feel === 'broken') {
    line = [start, nearestPc(root + 7, start), dest]
    times =
      noise(bar.index, 'bass-time') > 0.5 ? [0.33, 1.66, 3] : [0, 2.33, 3.66]
    holds = [0.6, 0.6, 0.3]
  } else {
    const direction = dest >= start ? 1 : -1
    const approach = dest - direction
    line = [
      start,
      bounded(
        nearestPc(root + (bar.index % 2 ? third : 7), start + direction * 3),
        28,
        55,
      ),
      approach,
      dest,
    ]
    if (b.target === 'approach')
      line = [start, dest + direction * 2, dest + direction, dest]
    times = [0, 1, 2, 3]
    holds = [0.88, 0.88, 0.88, 0.88]
  }
  state.lastBass = line.at(-1) ?? dest
  return line.map((midi, i) => ({
    at: times[i],
    beats: holds[i],
    midi: bounded(midi, 28, 55),
    velocity: vel * (i % 2 ? 0.88 : 1),
    seat: 'bass',
    kind: 'tone',
  }))
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

function hornNotes(bar: Bar, state: RenderState): Note[] {
  const h = bar.parts.horn
  if (h.rest) return []
  // Answer the harmony already heard, never peek at this bar's piano decision.
  const root = state.heardRoot ?? h.landing
  const pcs = scalePcs(root, h.color)
  const base = [55, 65, 76, 86][h.register]
  const dest = bounded(nearestPc(h.landing, base), base - 7, base + 9)
  const shift = Math.floor(noise(bar.index + 1, 'horn-shift') * 4) - 1
  const start = ladder(pcs, base, shift)
  let line: number[]
  let times: number[]
  let holds: number[]
  if (h.shape === 'long') {
    line = [dest]
    times = [0.16]
    holds = [3.45]
  } else if (h.shape === 'climb' || h.shape === 'fall') {
    const direction = h.shape === 'climb' ? 1 : -1
    line = [
      start,
      ladder(pcs, start, direction),
      ladder(pcs, start, direction * 3),
      dest,
    ]
    times = bar.index % 2 ? [0.33, 1, 2.33, 3] : [0, 0.66, 2, 3.33]
    holds = [0.5, 0.75, 0.5, 0.58]
  } else if (h.shape === 'motif') {
    const motif = state.hornMotif ?? [0, 2, -1, 3]
    line = motif.map((step) => ladder(pcs, start, step))
    line[line.length - 1] = dest
    times = [0, 0.66, 1.66, 3]
    holds = [0.5, 0.6, 0.85, 0.8]
  } else {
    line = [start, ladder(pcs, start, bar.index % 2 ? -2 : 2), dest]
    times = bar.index % 2 ? [0.33, 1.66, 3.33] : [0.66, 2, 3]
    holds = [0.34, 0.42, 0.7]
  }
  if (h.shape !== 'motif' && line.length >= 3)
    state.hornMotif = [
      0,
      line[1] > line[0] ? 1 : -1,
      line[2] > line[0] ? 2 : -2,
      0,
    ]
  state.lastHorn = line.at(-1) ?? dest
  return line.map((midi, i) => ({
    at: times[i],
    beats: holds[i],
    midi,
    velocity: 0.46 + noise(bar.index + i, 'horn-touch') * 0.13,
    seat: 'horn',
    kind: 'tone',
  }))
}

export function renderBar(bar: Bar, state: RenderState): Note[] {
  const notes = [
    ...pianoNotes(bar, state),
    ...bassNotes(bar, state),
    ...drumsNotes(bar),
    ...hornNotes(bar, state),
  ]
  if (!bar.parts.piano.rest) {
    state.heardRoot = bar.parts.piano.root
    state.heardQuality = bar.parts.piano.quality
  } else if (!bar.parts.bass.rest) state.heardRoot = bar.parts.bass.root
  return notes.sort((a, b) => a.at - b.at)
}
export const beatsPerBar = BEATS
