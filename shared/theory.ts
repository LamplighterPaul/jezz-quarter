export const NOTE_NAMES = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'Gb',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
] as const
export const mod12 = (n: number) => ((n % 12) + 12) % 12
export const midiName = (m: number) =>
  `${NOTE_NAMES[mod12(m)]}${Math.floor(m / 12) - 1}`
export const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12)

export const QUALITIES: Record<string, { pcs: number[]; about: string }> = {
  maj7: { pcs: [0, 4, 7, 11], about: 'major seventh — open, settled' },
  min7: {
    pcs: [0, 3, 7, 10],
    about: 'minor seventh — dark, ordinary jazz minor',
  },
  dom7: { pcs: [0, 4, 7, 10], about: 'dominant seventh — wants to move' },
  alt: {
    pcs: [0, 4, 6, 10],
    about: 'altered dominant — tense, b5, no perfect fifth',
  },
  halfdim: {
    pcs: [0, 3, 6, 10],
    about: 'half diminished — minor seventh with a flattened fifth',
  },
  minmaj: {
    pcs: [0, 3, 7, 11],
    about: 'minor major seventh — tonic minor, a little haunted',
  },
  sus: { pcs: [0, 5, 7, 10], about: 'suspended dominant — no third, hanging' },
  lydian: {
    pcs: [0, 4, 6, 11],
    about: 'lydian major — raised fourth, floating',
  },
}

export const qualityCriteria = () =>
  Object.fromEntries(Object.entries(QUALITIES).map(([k, v]) => [k, v.about]))

export const tonicCriteria = () =>
  Object.fromEntries(NOTE_NAMES.map((n) => [n, `${n}`]))

export function chordPcs(root: number, quality: string): number[] {
  return (QUALITIES[quality] ?? QUALITIES.dom7).pcs.map((i) => (root + i) % 12)
}

export function nearestPc(pc: number, near: number): number {
  const base = Math.round(near)
  let best = base
  let bestDist = Infinity
  for (let m = base - 6; m <= base + 6; m++) {
    if (mod12(m) !== mod12(pc)) continue
    const d = Math.abs(m - base)
    if (d < bestDist) {
      bestDist = d
      best = m
    }
  }
  return Math.max(21, Math.min(108, best))
}

export function voice(
  root: number,
  quality: string,
  previous: number[],
  low = 48,
  high = 72,
): number[] {
  const pcs = chordPcs(root, quality)
  const centre = previous.length
    ? previous.reduce((a, b) => a + b, 0) / previous.length
    : (low + high) / 2
  const notes = pcs.map((pc) => {
    const candidates: number[] = []
    for (let m = low; m <= high; m++) if (mod12(m) === pc) candidates.push(m)
    if (!candidates.length) return nearestPc(pc, centre)
    const target = previous.length
      ? previous.reduce(
          (best, p) =>
            Math.abs(mod12(p) - pc) < Math.abs(mod12(best) - pc) ? p : best,
          previous[0],
        )
      : centre
    return candidates.reduce(
      (best, m) => (Math.abs(m - target) < Math.abs(best - target) ? m : best),
      candidates[0],
    )
  })
  return [...new Set(notes)].sort((a, b) => a - b)
}

export function scalePcs(root: number, color: string): number[] {
  const steps: Record<string, number[]> = {
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    altered: [0, 1, 3, 4, 6, 8, 10],
    diminished: [0, 1, 3, 4, 6, 7, 9, 10],
    pentatonic: [0, 2, 4, 7, 9],
    blues: [0, 3, 5, 6, 7, 10],
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    lydian: [0, 2, 4, 6, 7, 9, 11],
  }
  return (steps[color] ?? steps.mixolydian).map((s) => (root + s) % 12)
}

export function ladder(pcs: number[], anchor: number, n: number): number {
  const set = new Set(pcs.map(mod12))
  if (!set.size) return anchor
  let m = Math.round(anchor)
  let guard = 0
  while (!set.has(mod12(m)) && guard++ < 24) m++
  const step = n >= 0 ? 1 : -1
  for (let k = 0; k !== n; k += step) {
    guard = 0
    do {
      m += step
    } while (!set.has(mod12(m)) && guard++ < 24)
  }
  return Math.max(21, Math.min(108, m))
}

/** Distinct playable voicing families. No imposed chord progression. */
export function voiceFor(
  root: number,
  quality: string,
  family: string,
  previous: number[],
): number[] {
  const chord = (QUALITIES[quality] ?? QUALITIES.dom7).pcs
  const third = chord[1]
  const seventh = chord[3]
  if (family === 'single')
    return [nearestPc(root + third, previous.at(-1) ?? 64)]
  let intervals: number[]
  if (family === 'three_note') intervals = [0, third, seventh]
  else if (family === 'fourths') intervals = [2, 7, 12, 17]
  else if (family === 'cluster') intervals = [third, third + 1, 5, seventh, 14]
  else
    intervals = [
      third,
      seventh,
      quality === 'alt' ? 13 : 14,
      quality === 'min7' ? 17 : quality === 'alt' ? 20 : 21,
    ]
  const centre = previous.length
    ? previous.reduce((a, b) => a + b, 0) / previous.length
    : 60
  const candidates: number[][] = []
  for (let octave = 3; octave <= 5; octave++) {
    const base = 12 * octave + root
    const notes = [...new Set(intervals.map((i) => base + i))].sort(
      (a, b) => a - b,
    )
    if (notes[0] >= 45 && notes.at(-1)! <= 84) candidates.push(notes)
  }
  const cost = (notes: number[]) =>
    Math.abs(notes.reduce((a, b) => a + b, 0) / notes.length - centre)
  return (
    candidates.sort((a, b) => cost(a) - cost(b))[0] ??
    voice(root, quality, previous)
  )
}
