import type { Bar, Seat } from '../shared/types.ts'

const seats: Seat[] = ['piano', 'bass', 'drums', 'horn']
export function listeningState(
  seat: Seat,
  bars: Bar[],
  bpm: number,
  audience: unknown,
) {
  const recent = bars.slice(-8)
  const last = recent.at(-1)
  const signature = (bar: Bar, role: Seat) =>
    JSON.stringify({ ...bar.parts[role], heard: undefined })
  const repetition = Object.fromEntries(
    seats.map((role) => {
      const own = last ? signature(last, role) : ''
      let sameGestureBars = 0
      let silentBars = 0
      for (
        let i = recent.length - 1;
        i >= 0 && signature(recent[i], role) === own;
        i--
      )
        sameGestureBars++
      for (let i = recent.length - 1; i >= 0 && recent[i].parts[role].rest; i--)
        silentBars++
      return [
        role,
        { same_gesture_bars: sameGestureBars, silent_bars: silentBars },
      ]
    }),
  )
  return {
    room: 'A live jazz quartet improvising freely. No chart. No fixed changes. No prewritten song.',
    self: {
      instrument: seat,
      previous_gesture:
        last?.parts[seat] ?? 'Opening: you have not played yet.',
    },
    pulse: {
      bpm,
      owner: 'drums',
      note: 'The drummer alone sets tempo for the next bar; all instruments share that clock.',
    },
    recent_bars: recent.map((bar) => ({
      bar: bar.index,
      bpm: bar.bpm,
      musicians: bar.parts,
      sounded: Object.fromEntries(
        seats.map((role) => {
          const notes = bar.notes.filter((n) => n.seat === role)
          return [
            role,
            {
              attacks: notes.length,
              pitches: [...new Set(notes.map((n) => n.midi))],
              rhythm: [...new Set(notes.map((n) => n.at))],
            },
          ]
        }),
      ),
    })),
    repetition,
    audience,
    practice:
      'Listen, support, provoke and leave room. Develop a motif rather than repeat the same cell unchanged. Rootless, quartal, clusters and single notes are different colors, not rules. Silence is a breath, not a permanent assignment. You may agree or go outside. Make a next gesture, do not merely describe what was played.',
  }
}
