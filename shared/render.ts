// Code is the instrument. Four parts become notes. No musical judgement here.

import { bassRoot } from './musicians/bass.ts'
import { ladder, nearestPc, scalePcs, voice } from './theory.ts'
import type { Bar, Note } from './types.ts'

export interface RenderState {
  lastVoicing: number[]
  lastBass: number
  lastHorn: number
}

const BEATS = 4

function offset(time: string): number {
  if (time === 'anticipate') return -0.5
  if (time === 'behind') return 0.5
  return 0
}

function pianoNotes(bar: Bar, state: RenderState): Note[] {
  const p = bar.parts.piano
  if (p.rest) return []
  const off = offset(p.time)
  const v = voice(p.root, p.quality, state.lastVoicing)
  state.lastVoicing = v
  const notes: Note[] = []
  const attacks = p.density === 0 ? [0] : p.density === 1 ? [0, 2] : p.density === 2 ? [0, 1.5, 3] : [0, 1, 2, 3]
  const hold = p.density === 0 ? 3.2 : p.density === 3 ? 0.7 : 1.2
  const vel = 0.38 + 0.12 * p.density
  for (const t of attacks) {
    const at = Math.max(0, t + off)
    if (p.voicing === 'single') {
      notes.push({ at, beats: hold, midi: v[Math.min(2, v.length - 1)] ?? 60, velocity: vel, seat: 'piano', kind: 'tone' })
    } else {
      const use = p.voicing === 'cluster' ? v : p.voicing === 'fourths' ? v.filter((_, i) => i % 1 === 0) : v
      for (const m of use) notes.push({ at, beats: hold, midi: m, velocity: vel * (p.voicing === 'rootless' ? 0.9 : 1), seat: 'piano', kind: 'tone' })
    }
  }
  return notes
}

function bassNotes(bar: Bar, state: RenderState): Note[] {
  const b = bar.parts.bass
  if (b.rest) return []
  const root = bassRoot(b, bar.parts.piano.root)
  const dest = nearestPc(root, state.lastBass || 38)
  const notes: Note[] = []
  const vel = 0.55
  if (b.feel === 'pedal') {
    notes.push({ at: 0, beats: 4, midi: dest, velocity: vel, seat: 'bass', kind: 'tone' })
  } else if (b.feel === 'two') {
    notes.push({ at: 0, beats: 2, midi: nearestPc(modToward(state.lastBass, dest, 0.4), dest), velocity: vel, seat: 'bass', kind: 'tone' })
    notes.push({ at: 2, beats: 2, midi: dest, velocity: vel * 0.92, seat: 'bass', kind: 'tone' })
  } else if (b.feel === 'broken') {
    notes.push({ at: 0, beats: 0.7, midi: state.lastBass || dest, velocity: vel, seat: 'bass', kind: 'tone' })
    notes.push({ at: 1.5, beats: 0.7, midi: nearestPc((root + 7) % 12, dest), velocity: vel * 0.85, seat: 'bass', kind: 'tone' })
    notes.push({ at: 3, beats: 0.9, midi: dest, velocity: vel, seat: 'bass', kind: 'tone' })
  } else {
    // walk
    const mid1 = nearestPc(approach(root, dest, 1), dest)
    const mid2 = nearestPc(approach(root, dest, 2), dest)
    const line = [state.lastBass || dest, mid1, mid2, dest]
    line.forEach((m, i) => notes.push({ at: i, beats: 1, midi: clampBass(m, dest), velocity: vel * (i === 0 ? 1 : 0.88), seat: 'bass', kind: 'tone' }))
  }
  const last = notes[notes.length - 1]
  if (last) state.lastBass = last.midi
  return notes
}

function approach(root: number, dest: number, step: number): number {
  const pc = (root + (step === 3 ? 0 : step === 1 ? 4 : 7)) % 12
  return nearestPc(pc, dest)
}

function modToward(from: number, to: number, t: number): number {
  if (!from) return to
  return Math.round(from + (to - from) * t)
}

function clampBass(m: number, near: number): number {
  let x = m
  while (x > 50) x -= 12
  while (x < 28) x += 12
  if (Math.abs(x - near) > 9 && near) x = nearestPc(x, near)
  return Math.max(28, Math.min(52, x))
}

function drumsNotes(bar: Bar): Note[] {
  const d = bar.parts.drums
  if (d.rest) return []
  const notes: Note[] = []
  const hat = d.kit === 'ballad' ? 'hat' : 'ride'
  const swing = d.kit !== 'latin'
  for (let beat = 0; beat < 4; beat++) {
    const t = swing && beat % 1 === 0 ? beat : beat
    notes.push({ at: t, beats: 0.25, midi: hat === 'ride' ? 81 : 76, velocity: 0.28 + 0.06 * d.density, seat: 'drums', kind: hat })
    if (swing) notes.push({ at: beat + 0.66, beats: 0.15, midi: 81, velocity: 0.18, seat: 'drums', kind: 'ride' })
  }
  if (d.kick === 'one' || d.kick === 'one_three') notes.push({ at: 0, beats: 0.3, midi: 36, velocity: 0.7, seat: 'drums', kind: 'kick' })
  if (d.kick === 'one_three') notes.push({ at: 2, beats: 0.3, midi: 36, velocity: 0.62, seat: 'drums', kind: 'kick' })
  if (d.kick === 'scattered') {
    notes.push({ at: 0.75, beats: 0.2, midi: 36, velocity: 0.55, seat: 'drums', kind: 'kick' })
    notes.push({ at: 2.5, beats: 0.2, midi: 36, velocity: 0.5, seat: 'drums', kind: 'kick' })
  }
  if (d.snare === 'two_four') {
    notes.push({ at: 1, beats: 0.2, midi: 38, velocity: 0.55, seat: 'drums', kind: 'snare' })
    notes.push({ at: 3, beats: 0.2, midi: 38, velocity: 0.62, seat: 'drums', kind: 'snare' })
  }
  if (d.snare === 'four') notes.push({ at: 3, beats: 0.2, midi: 38, velocity: 0.6, seat: 'drums', kind: 'snare' })
  if (d.snare === 'chatter') {
    notes.push({ at: 0.5, beats: 0.12, midi: 38, velocity: 0.35, seat: 'drums', kind: 'snare' })
    notes.push({ at: 2.25, beats: 0.12, midi: 38, velocity: 0.4, seat: 'drums', kind: 'snare' })
  }
  if (d.fill) {
    for (let i = 0; i < 4; i++) notes.push({ at: 3 + i * 0.2, beats: 0.12, midi: 38 + (i % 2) * 5, velocity: 0.5, seat: 'drums', kind: 'snare' })
  }
  return notes
}

function hornNotes(bar: Bar, state: RenderState): Note[] {
  const h = bar.parts.horn
  if (h.rest) return []
  const root = bar.parts.piano.rest ? bar.parts.bass.root : bar.parts.piano.root
  const pcs = scalePcs(root, h.color)
  const base = [52, 64, 76, 86][h.register] ?? 64
  const dest = nearestPc(h.landing, state.lastHorn || base)
  const notes: Note[] = []
  const vel = 0.48
  if (h.shape === 'long') {
    notes.push({ at: 0.1, beats: 3.6, midi: dest, velocity: vel, seat: 'horn', kind: 'tone' })
  } else if (h.shape === 'climb') {
    for (let i = 0; i < 4; i++) notes.push({ at: i, beats: 0.9, midi: ladder(pcs, base, i), velocity: vel, seat: 'horn', kind: 'tone' })
  } else if (h.shape === 'fall') {
    for (let i = 0; i < 4; i++) notes.push({ at: i, beats: 0.9, midi: ladder(pcs, dest, -i), velocity: vel, seat: 'horn', kind: 'tone' })
  } else if (h.shape === 'motif') {
    const start = state.lastHorn || base
    notes.push({ at: 0, beats: 0.6, midi: start, velocity: vel, seat: 'horn', kind: 'tone' })
    notes.push({ at: 1, beats: 0.6, midi: ladder(pcs, start, 1), velocity: vel, seat: 'horn', kind: 'tone' })
    notes.push({ at: 2, beats: 1.6, midi: dest, velocity: vel, seat: 'horn', kind: 'tone' })
  } else {
    notes.push({ at: 0.2, beats: 0.5, midi: ladder(pcs, base, 0), velocity: vel, seat: 'horn', kind: 'tone' })
    notes.push({ at: 1.5, beats: 0.4, midi: ladder(pcs, base, 2), velocity: vel * 0.9, seat: 'horn', kind: 'tone' })
    notes.push({ at: 3, beats: 0.8, midi: dest, velocity: vel, seat: 'horn', kind: 'tone' })
  }
  const last = notes[notes.length - 1]
  if (last) state.lastHorn = last.midi
  return notes
}

export function renderBar(bar: Bar, state: RenderState): Note[] {
  const notes = [
    ...pianoNotes(bar, state),
    ...bassNotes(bar, state),
    ...drumsNotes(bar),
    ...hornNotes(bar, state),
  ]
  return notes.sort((a, b) => a.at - b.at)
}

export const beatsPerBar = BEATS
