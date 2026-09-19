import { noteName } from '../shared/musicians/line.ts'
import type { Bar, Heard, Seat } from '../shared/types.ts'

const seats: Seat[] = ['piano', 'bass', 'drums', 'horn']

/** Only public performance evidence, cut off at invocation time. Never serialize
 * other players' parts, decisions, queued notes, or planned release times. */
export function listeningState(
  seat: Seat,
  bars: Bar[],
  bpm: number,
  audience: unknown,
  heardThrough: number,
) {
  const recent = bars.filter((bar) => bar.at <= heardThrough).slice(-8)
  const recent_bars = recent.map((bar) => {
    const elapsedBeats = Math.max(0, ((heardThrough - bar.at) * bar.bpm) / 60)
    return {
      bar: bar.index,
      bpm: bar.bpm,
      heard_beats: Math.min(bar.beats, elapsedBeats),
      complete: elapsedBeats >= bar.beats,
      events: bar.notes
        .filter((note) => note.at <= elapsedBeats)
        .map((note) => ({
          instrument: note.seat,
          beat: Number(note.at.toFixed(3)),
          sound: note.seat === 'drums' ? note.kind : noteName(note.midi),
          duration_heard: Number(
            Math.min(note.beats, elapsedBeats - note.at).toFixed(3),
          ),
          still_sounding: note.at + note.beats > elapsedBeats,
          velocity: Number(note.velocity.toFixed(3)),
        })),
    }
  })
  const complete = recent_bars.filter((bar) => bar.complete)
  const repetition = Object.fromEntries(
    seats.map((role) => {
      const signature = (bar: (typeof recent_bars)[number]) =>
        JSON.stringify(bar.events.filter((e) => e.instrument === role))
      const last = complete.at(-1)
      let same = 0,
        silent = 0
      for (
        let i = complete.length - 1;
        i >= 0 && last && signature(complete[i]) === signature(last);
        i--
      )
        same++
      for (
        let i = complete.length - 1;
        i >= 0 && !complete[i].events.some((e) => e.instrument === role);
        i--
      )
        silent++
      return [role, { same_gesture_bars: same, silent_bars: silent }]
    }),
  )
  return {
    room: 'A live jazz quartet improvising freely, with no chart or prescribed changes.',
    heard_through_seconds: heardThrough,
    self: { instrument: seat },
    pulse: {
      bpm,
      owner: 'drums',
      note: 'The drummer sets BPM. Positions and durations are expressed in that shared beat.',
    },
    recent_bars,
    repetition,
    audience,
  }
}

export function heardSummary(
  state: ReturnType<typeof listeningState>,
  barsSoFar: number,
): Heard {
  const summaries = state.recent_bars
    .slice(-4)
    .map(
      (bar) =>
        `bar ${bar.bar}${bar.complete ? '' : ' (only partly heard)'}: ${bar.events.map((e) => `${e.instrument} ${e.sound} at beat ${e.beat}, heard for ${e.duration_heard} beats${e.still_sounding ? ' and still sounding' : ''}`).join('; ') || 'no attacks heard'}`,
    )
  return {
    barsSoFar,
    bpm: state.pulse.bpm,
    last: summaries.at(-1) ?? 'The room is quiet. Opening of the set.',
    recent: summaries.join(' | ') || 'Nothing heard yet.',
  }
}

/** Compact notation keeps each independent question focused as history grows. */
export function compactListening(state: ReturnType<typeof listeningState>) {
  return {
    ...state,
    notation:
      'Each heard event is sound@beat / duration-heard / velocity; ~ means still sounding, with its eventual release unknown. Beats start at 0.',
    recent_bars: state.recent_bars.slice(-3).map((bar) => ({
      bar: bar.bar,
      bpm: bar.bpm,
      heard_beats: Number(bar.heard_beats.toFixed(3)),
      complete: bar.complete,
      players: Object.fromEntries(
        seats.map((seat) => [
          seat,
          bar.events
            .filter((e) => e.instrument === seat)
            .map(
              (e) =>
                `${e.sound}@${e.beat}/${e.duration_heard}/${e.velocity}${e.still_sounding ? '~' : ''}`,
            )
            .join(' ') || 'no attacks heard',
        ]),
      ),
    })),
  }
}
