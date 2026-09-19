import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderBar } from '../shared/render.ts'
import { voiceFor, mod12 } from '../shared/theory.ts'
import { assembleDrums, drumsQuestions } from '../shared/musicians/drums.ts'
import { bassQuestions } from '../shared/musicians/bass.ts'
import { pianoQuestions } from '../shared/musicians/piano.ts'
import { hornQuestions } from '../shared/musicians/horn.ts'
import type { Bar, Heard } from '../shared/types.ts'
import { AudienceFeedback } from '../server/feedback.ts'
import { listeningState } from '../server/listening.ts'

const heard: Heard = { barsSoFar: 0, last: 'Opening', recent: '', bpm: 88 }
const fixture = (): Bar => ({
  index: 0,
  at: 0,
  bpm: 120,
  beats: 4,
  decisions: [],
  notes: [],
  stats: { model: 'test', ms: 0, questions: 0, inputTokens: 0, usd: 0 },
  parts: {
    piano: {
      seat: 'piano',
      rest: false,
      root: 0,
      quality: 'dom7',
      voicing: 'rootless',
      density: 2,
      time: 'on',
      heard: 'C7',
    },
    bass: {
      seat: 'bass',
      rest: false,
      root: 0,
      feel: 'walk',
      motion: 'step_up',
      target: 'root',
      wander: false,
      energy: 1,
      heard: 'walking',
    },
    drums: {
      seat: 'drums',
      rest: false,
      bpm: 120,
      kit: 'swing',
      density: 2,
      kick: 'one_three',
      snare: 'two_four',
      fill: true,
      heard: 'swing',
    },
    horn: {
      seat: 'horn',
      rest: false,
      color: 'blues',
      shape: 'climb',
      register: 1,
      landing: 0,
      heard: 'climbing',
    },
  },
})
const state = () => ({
  lastVoicing: [],
  lastBass: 38,
  lastHorn: 64,
  heardRoot: 0,
  heardQuality: 'dom7',
})

test('all four independent harnesses use Choice, Noul and Score', () => {
  for (const questions of [
    pianoQuestions,
    bassQuestions,
    drumsQuestions,
    hornQuestions,
  ]) {
    assert.deepEqual(
      new Set(Object.values(questions(heard)).map((q) => q.type)),
      new Set(['choice', 'score', 'noul']),
    )
    for (const q of Object.values(questions(heard)))
      assert.match(q.instructions, /NEXT gesture/)
  }
})
test('the drummer establishes the opening tempo and holds it when no change is chosen', () => {
  const answers = {
    tempo: {
      type: 'score' as const,
      score: 2,
      probabilities: { '2': 1 },
      confidence: 1,
    },
    tempo_change: { type: 'noul' as const, noul: 0 },
  }
  assert.equal(assembleDrums(answers, heard, 1).part.bpm, 124)
  assert.equal(
    assembleDrums(answers, { ...heard, barsSoFar: 8, bpm: 107 }, 1).part.bpm,
    107,
  )
})
test('voicing choices produce distinct notes; rootless omits the root', () => {
  const families = ['rootless', 'three_note', 'fourths', 'cluster', 'single']
  const notes = families.map((f) => voiceFor(0, 'dom7', f, []))
  assert.equal(new Set(notes.map((n) => JSON.stringify(n))).size, 5)
  assert.ok(notes[0].every((n) => mod12(n) !== 0))
  assert.equal(notes[1].length, 3)
  assert.equal(notes[4].length, 1)
})
test('bass motion changes the line, and it answers previous harmony rather than new piano choices', () => {
  const a = fixture()
  const b = fixture()
  b.parts.bass.motion = 'step_down'
  const notes = (bar: Bar) =>
    renderBar(bar, state()).filter((n) => n.seat === 'bass')
  assert.notDeepEqual(notes(a), notes(b))
  b.parts.bass.motion = 'step_up'
  b.parts.piano.root = 6
  assert.deepEqual(notes(a), notes(b))
})
test('drum textures differ, include audible kick/snare and remain finite within the bar', () => {
  const sets = []
  for (const kit of ['swing', 'latin', 'ballad', 'broken']) {
    const bar = fixture()
    bar.parts.drums.kit = kit
    const notes = renderBar(bar, state())
    const drums = notes.filter((n) => n.seat === 'drums')
    assert.ok(drums.some((n) => n.kind === 'kick'))
    assert.ok(drums.some((n) => n.kind === 'snare' || n.kind === 'brush'))
    sets.push(JSON.stringify(drums))
    for (const n of notes) {
      assert.ok(Number.isFinite(n.midi) && Number.isFinite(n.velocity))
      assert.ok(n.at >= 0 && n.at < 4)
      assert.ok(n.beats > 0)
    }
  }
  assert.equal(new Set(sets).size, 4)
})
test('audience cooldown spans reaction types and identities, feedback expires', () => {
  const audience = new AudienceFeedback()
  assert.equal(audience.react('one', 'cheer', 10, 100).accepted, true)
  assert.equal(audience.react('one', 'boo', 11, 200).accepted, false)
  assert.equal(audience.react('two', 'boo', 11, 200).accepted, true)
  assert.equal(audience.recent(12, 300).cheers, 1)
  assert.deepEqual(audience.recent(12, 300).passages[0], {
    reaction: 'cheer',
    fromBar: 7,
    throughBar: 10,
  })
  assert.equal(audience.react('one', 'boo', 14, 30100).accepted, true)
  assert.equal(audience.recent(30, 100000).boos, 0)
})
test('listening state exposes actual played notes, repetition and distinct self seats', () => {
  const bars = Array.from({ length: 4 }, (_, index) => ({
    ...fixture(),
    index,
  }))
  const s = listeningState('drums', bars, 120, { boos: 1 })
  assert.equal(s.self.instrument, 'drums')
  assert.equal(s.repetition.drums.same_gesture_bars, 4)
  assert.equal(s.recent_bars.length, 4)
  assert.deepEqual(s.audience, { boos: 1 })
})
