import { compactListening } from './listening.ts'
import { bassQuestions } from '../shared/musicians/bass.ts'
import { hornQuestions } from '../shared/musicians/horn.ts'
import {
  describeLine,
  noteName,
  readAction,
  type LineEvent,
  type LineSeat,
} from '../shared/musicians/line.ts'
import type {
  BassPart,
  Decision,
  HornPart,
  Questions,
} from '../shared/types.ts'
import type { Run } from './jev.ts'

export type AskLine = (
  state: unknown,
  questions: Questions,
  signal?: AbortSignal,
) => Promise<Run>
export interface LineMemory {
  events: Array<LineEvent & { bar: number }>
}
export const freshMemory = (): LineMemory => ({ events: [] })

/** The sequence is private to this seat. Neither callback receives another
 * player's current plan. Memory is returned transactionally, committed with bar. */
export async function planLine(
  seat: LineSeat,
  bar: number,
  memory: LineMemory,
  listen: () => ReturnType<typeof import('./listening.ts').listeningState>,
  ask: AskLine,
  budgetMs: number,
  seed = 0,
) {
  const started = performance.now()
  const deadline = AbortSignal.timeout(Math.max(1, Math.round(budgetMs)))
  const events: LineEvent[] = [],
    decisions: Decision[] = [],
    runs: Run[] = []
  let calls = 0
  let at = 0
  let planning: BassPart['planning'] = 'complete'
  try {
    while (at < 4 - 1e-6) {
      if (deadline.aborted) {
        planning = 'deadline'
        break
      }
      const previous =
        [...memory.events, ...events].findLast((event) => event.midi !== null)
          ?.midi ?? undefined
      const questions =
        seat === 'bass'
          ? bassQuestions(4 - at, previous)
          : hornQuestions(4 - at, previous)
      const observed = compactListening(listen())
      const describe = (event: LineEvent & { bar?: number }) =>
        `${event.bar ?? bar}:${Number(event.at.toFixed(3))} ${event.midi === null ? 'rest' : noteName(event.midi)} / ${Number(event.duration.toFixed(3))} beats / ${event.articulation} / accent ${event.accent.toFixed(1)}`
      const own = [...memory.events, ...events]
      const lastNote = own.findLast((event) => event.midi !== null)
      let repeated = 0
      for (
        let i = own.length - 1;
        i >= 0 && own[i].midi === lastNote?.midi;
        i--
      )
        repeated++
      calls++
      const run = await ask(
        {
          ...observed,
          self: {
            ...observed.self,
            previous_phrase: memory.events.slice(-12).map(describe),
            last_note: previous === undefined ? null : noteName(previous),
            consecutive_same_pitch: repeated,
            notation:
              'Private events: bar:beat pitch / rhythmic spacing / release / accent (0 light to 4 emphatic). These are your own choices, not evidence about the others.',
            private_plan: events.map(describe),
            next_action: {
              bar,
              beat: Number(at.toFixed(3)),
              remaining_beats: Number((4 - at).toFixed(3)),
              note: 'Plan your next note or rest here. Your private plan has not sounded yet. The four-beat window is a scheduling boundary, not an instruction to end your phrase.',
            },
          },
        },
        questions,
        deadline,
      )
      runs.push(run)
      const action = readAction(
        seat,
        run.answers,
        questions,
        at,
        4 - at,
        events.length,
        seed ? (seed + events.length) >>> 0 || 1 : 0,
      )
      events.push(action.event)
      decisions.push(...action.decisions)
      at += action.event.duration
    }
  } catch (error) {
    planning = deadline.aborted ? 'deadline' : 'error'
    // No guessed pitches or replacement licks after a failed request.
    if (planning === 'error')
      console.error(
        `${seat} planning:`,
        error instanceof Error ? error.message : 'request failed',
      )
  }
  const part: BassPart | HornPart = {
    seat,
    events,
    rest: events.every((event) => event.midi === null),
    heard: describeLine(events),
    planning,
    planningMs: Math.round(performance.now() - started),
    calls,
    answeredCalls: runs.length,
    policy: seed ? 'sample' : 'direct',
  }
  return {
    part,
    decisions,
    runs,
    memory: {
      events: [
        ...memory.events,
        ...events.map((event) => ({ ...event, bar })),
      ].slice(-32),
    },
  }
}
