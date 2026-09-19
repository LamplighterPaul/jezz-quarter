import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planLine, freshMemory, type AskLine } from '../server/line-player.ts'
import { listeningState } from '../server/listening.ts'
import { bassQuestions } from '../shared/musicians/bass.ts'
import { hornQuestions } from '../shared/musicians/horn.ts'
import { RANGES, noteName, readAction } from '../shared/musicians/line.ts'
import type { Answers, Bar, Questions } from '../shared/types.ts'

function response(pitch: string, duration: string, attack = 1): Answers {
  const choice = (key: string) => ({
    type: 'choice' as const,
    choice: key,
    probabilities: { [key]: 1 },
    confidence: 1,
  })
  return {
    pitch: choice(pitch),
    duration: choice(duration),
    articulation: choice('connected'),
    attack: { type: 'noul', noul: attack },
    accent: {
      type: 'score',
      score: 2.3,
      probabilities: { '2': 0.7, '3': 0.3 },
      confidence: 0.7,
    },
  }
}
const run = (answers: Answers) => ({
  answers,
  model: 'test',
  ms: 10,
  inputTokens: 10,
  questions: 5,
})
const listen = (seat: 'bass' | 'horn') => () =>
  listeningState(seat, [], 120, {}, 0)

test('every pitch in the supported chromatic range remains available', () => {
  for (const [seat, questions] of [
    ['bass', bassQuestions()],
    ['horn', hornQuestions()],
  ] as const) {
    const pitch = questions.pitch
    assert.equal(pitch.type, 'choice')
    if (pitch.type !== 'choice') throw new Error('missing pitch choice')
    const [low, high] = RANGES[seat]
    assert.deepEqual(
      Object.keys(pitch.criteria),
      Array.from({ length: high - low + 1 }, (_, i) => noteName(low + i)),
    )
  }
})

test('each action sees its own prior decisions; exact notes, rests, rhythm and accent survive', async () => {
  const states: any[] = []
  const answers = [
    response('C2', 'quarter'),
    response('Gb2', 'eighth', 0.1),
    response('B2', 'to_boundary'),
  ]
  const ask: AskLine = async (state) => {
    states.push(state)
    return run(answers[states.length - 1])
  }
  const memory = freshMemory()
  const result = await planLine('bass', 12, memory, listen('bass'), ask, 1000)
  assert.equal(result.part.planning, 'complete')
  assert.deepEqual(
    result.part.events.map((e) => [e.at, e.midi, e.duration]),
    [
      [0, 36, 1],
      [1, null, 0.5],
      [1.5, 47, 2.5],
    ],
  )
  assert.equal(result.part.events[0].accent, 2.3)
  assert.equal(states[0].self.private_plan.length, 0)
  assert.equal(states[1].self.private_plan[0].split(' ')[1], 'C2')
  assert.equal(states[2].self.private_plan[1].split(' ')[1], 'rest')
  assert.deepEqual(
    memory.events,
    [],
    'uncommitted planning must not mutate memory',
  )
  const nextStates: any[] = []
  await planLine(
    'bass',
    13,
    result.memory,
    listen('bass'),
    async (state) => {
      nextStates.push(state)
      return run(response('Bb2', 'whole'))
    },
    1000,
  )
  assert.equal(nextStates[0].self.previous_phrase.at(-1).split(' ')[1], 'B2')
})

test('pitch/release/accent are not used when Noul chooses a rest', async () => {
  const result = await planLine(
    'horn',
    0,
    freshMemory(),
    listen('horn'),
    async () =>
      run({
        attack: { type: 'noul', noul: 0.01 },
        duration: {
          type: 'choice',
          choice: 'whole',
          probabilities: { whole: 1 },
          confidence: 1,
        },
      }),
    1000,
  )
  assert.equal(result.part.planning, 'complete')
  assert.equal(result.part.rest, true)
  assert.equal(result.decisions.length, 2)
})

test('a malformed pitch does not get repaired or silently replaced', async () => {
  const result = await planLine(
    'horn',
    0,
    freshMemory(),
    listen('horn'),
    async () => run(response('banana', 'whole')),
    1000,
  )
  assert.equal(result.part.planning, 'error')
  assert.deepEqual(result.part.events, [])
})

test('request deadline preserves completed choices and marks technical silence', async () => {
  let calls = 0
  const result = await planLine(
    'bass',
    0,
    freshMemory(),
    listen('bass'),
    async (_state, _questions, signal) => {
      if (++calls === 1) return run(response('D2', 'quarter'))
      await new Promise((_resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('timeout not enforced')),
          1000,
        )
        signal!.addEventListener(
          'abort',
          () => {
            clearTimeout(timer)
            reject(signal!.reason)
          },
          { once: true },
        )
      })
      throw new Error('unreachable')
    },
    20,
  )
  assert.equal(result.part.planning, 'deadline')
  assert.equal(result.part.events.length, 1)
  assert.equal(result.part.events[0].midi, 38)
})

test('only sounded events cross musician boundaries, including partial durations', () => {
  const bar = {
    index: 7,
    bpm: 120,
    at: 10,
    beats: 4,
    parts: {
      piano: { heard: 'SECRET PLAN' },
      horn: { events: ['SECRET FUTURE'] },
    },
    decisions: [{ picked: 'SECRET ANSWER' }],
    notes: [
      { seat: 'piano', midi: 60, at: 0, beats: 3, velocity: 0.5 },
      { seat: 'horn', midi: 66, at: 1.5, beats: 1, velocity: 0.6 },
    ],
  } as unknown as Bar
  const futureBar = { ...bar, index: 8, at: 12 }
  const first = listeningState('bass', [bar, futureBar], 120, {}, 10.5)
  assert.equal(first.recent_bars.length, 1)
  assert.equal(first.recent_bars[0].events.length, 1)
  assert.equal(first.recent_bars[0].events[0].duration_heard, 1)
  assert.equal(first.recent_bars[0].events[0].still_sounding, true)
  assert.ok(!JSON.stringify(first).includes('SECRET'))
  assert.ok(!JSON.stringify(first).includes('Gb4'))
  const later = listeningState('bass', [bar], 120, {}, 11)
  assert.equal(later.recent_bars[0].events[1].sound, 'Gb4')
  assert.equal(later.recent_bars[0].events[1].duration_heard, 0.5)
})

test("parallel players cannot see each other's private plans", async () => {
  const captured: Record<string, any[]> = { bass: [], horn: [] }
  const makeAsk =
    (seat: 'bass' | 'horn'): AskLine =>
    async (state, questions: Questions) => {
      captured[seat].push(state)
      assert.ok(questions.pitch)
      return run(
        response(
          seat === 'bass' ? 'D2' : 'Ab5',
          captured[seat].length === 1 ? 'quarter' : 'dotted_half',
        ),
      )
    }
  await Promise.all(
    ['bass', 'horn'].map((s) => {
      const seat = s as 'bass' | 'horn'
      return planLine(seat, 0, freshMemory(), listen(seat), makeAsk(seat), 1000)
    }),
  )
  assert.equal(captured.bass[1].self.private_plan[0].split(' ')[1], 'D2')
  assert.ok(!JSON.stringify(captured.bass).includes('Ab5'))
  assert.equal(captured.horn[1].self.private_plan[0].split(' ')[1], 'Ab5')
  assert.ok(!JSON.stringify(captured.horn).includes('D2'))
})

test('duration choices stay valid at fractional window endings', () => {
  for (const remaining of [4, 1, 0.5, 1 / 3, 0.25, 1 / 12]) {
    const question = bassQuestions(remaining).duration
    assert.equal(question.type, 'choice')
    if (question.type === 'choice')
      assert.ok(Object.keys(question.criteria).length >= 2)
  }
})

test('sampling preserves every supported alternative, with no temperature or pitch repair', () => {
  const answers = response('C2', 'quarter')
  answers.pitch = {
    type: 'choice',
    choice: 'C2',
    probabilities: { C2: 0.6, Gb2: 0.4 },
    confidence: 0.3,
  }
  const selected = new Set<number | null>()
  for (let seed = 1; seed <= 80; seed++) {
    const action = readAction('bass', answers, bassQuestions(), 0, 4, 0, seed)
    selected.add(action.event.midi)
    assert.equal(
      action.decisions.find((d) => d.id === '0.pitch')?.modelPicked,
      'C2',
    )
  }
  assert.deepEqual(selected, new Set([36, 42]))
})
